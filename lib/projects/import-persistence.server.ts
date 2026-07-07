import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { parseAmount } from "@/lib/tasks/parse-amount";
import { parseDeadline } from "@/lib/tasks/parse-deadline";
import {
  buildDuplicateCandidateFromProjectPayload,
  findDuplicateProject,
  findDuplicateProjectStrict,
  type DuplicateProjectMatch,
} from "@/lib/tasks/project-duplicate-detection";

export const PROJECT_IMPORT_MAX_PROJECTS = 50;
const PROJECT_IMPORT_MAX_SUBTASKS_PER_PROJECT = 200;

const ProjectImportSuccessSchema = z
  .object({
    ok: z.literal(true),
    createdProjects: z.array(z.record(z.string(), z.unknown())),
    createdTasks: z.array(z.record(z.string(), z.unknown())),
    duplicates: z.array(z.unknown()),
    failedGroups: z.array(z.unknown()),
  })
  .strict();

const ProjectImportAttemptSchema = z
  .object({
    id: z.string().uuid(),
    request_hash: z.string(),
    status: z.enum(["started", "committed", "failed"]),
    result_json: z.unknown(),
    error_code: z.string().nullable(),
    payload_json: z.unknown(),
  })
  .strict();

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ProjectImportJsonRecord = Record<string, unknown>;

type ProjectSubtaskInput = ProjectImportJsonRecord & {
  resources?: ProjectImportJsonRecord[];
};

type ClientRow = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string | null;
};

type JoinedTaskRow = ProjectImportJsonRecord & {
  clients?: ClientRow | ClientRow[] | null;
  projects?: ProjectImportJsonRecord | ProjectImportJsonRecord[] | null;
};

type ProjectImportAttemptRow = z.infer<typeof ProjectImportAttemptSchema>;

type ProjectImportSuccess = z.infer<typeof ProjectImportSuccessSchema>;

export type PreparedProjectImportPersistenceInput = Readonly<{
  requestHash: string;
  payloadJson: ProjectImportJsonRecord[];
}>;

export type ProjectImportPersistenceOptions = Readonly<{
  defaultProjectPriority?: boolean;
  inheritProjectFieldsToSubtasks?: boolean;
}>;

export type ClaimedImportAttempt = Readonly<{
  userId: string;
  attemptId: string;
  idempotencyKey: string;
  requestHash: string;
  payloadJson: ProjectImportJsonRecord[];
}>;

type ProjectImportClaimResult =
  | Readonly<{
      kind: "claimed";
      attempt: ProjectImportAttemptRow;
      requestHash: string;
      payloadJson: ProjectImportJsonRecord[];
    }>
  | Readonly<{ kind: "conflict" }>
  | Readonly<{ kind: "replay"; result: ProjectImportJsonRecord }>
  | Readonly<{ kind: "in_progress" }>
  | Readonly<{ kind: "failed"; errorCode: string | null }>;

export type ProjectImportDuplicateResult = Readonly<{
  groupIndex: number;
  duplicate: DuplicateProjectMatch;
}>;

export type TransactionalImportFailureCategory =
  | "unauthorized"
  | "invalid_payload"
  | "attempt_conflict"
  | "import_failed";

type ExecuteClaimedProjectImportResult =
  | Readonly<{ kind: "saved"; result: ProjectImportSuccess }>
  | Readonly<{ kind: "replay"; result: ProjectImportJsonRecord }>
  | Readonly<{
      kind: "unparsed_success";
      result: unknown;
      validationError: z.inferFlattenedErrors<
        typeof ProjectImportSuccessSchema
      >;
    }>
  | Readonly<{
      kind: "failed";
      category: TransactionalImportFailureCategory;
    }>;

type ResolvedProjectImportPersistenceOptions = Readonly<{
  defaultProjectPriority: boolean;
  inheritProjectFieldsToSubtasks: boolean;
}>;

const TASK_WITH_CONTEXT_SELECT = `
  *,
  clients (
    id,
    name,
    contact_name,
    phone,
    email,
    notes,
    created_at
  ),
  projects (
    id,
    client_id,
    client_name,
    contact_name,
    title,
    summary,
    amount,
    amount_value,
    currency_code,
    deadline_text,
    deadline_date,
    priority,
    status,
    source,
    raw_input,
    created_at,
    updated_at,
    completed_at,
    is_archived,
    archived_at,
    deleted_at
  )
`;

const DEFAULT_PROJECT_IMPORT_PERSISTENCE_OPTIONS: ResolvedProjectImportPersistenceOptions =
  {
    defaultProjectPriority: true,
    inheritProjectFieldsToSubtasks: true,
  };

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function normalizeAmountInput(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.trim() || null;
  return null;
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeProjectDeadlineDateInput(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();

  if (!raw) {
    return null;
  }

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return raw;
    }

    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return null;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatDateOnly(parsed);
}

function isJsonRecord(value: unknown): value is ProjectImportJsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getProjectBody(body: ProjectImportJsonRecord) {
  return isJsonRecord(body.project) ? body.project : body;
}

function getClientPayload(body: ProjectImportJsonRecord) {
  const clientName = pickFirstString(
    body.client_name,
    body.clientName,
    body.client,
    body.customer_name,
    body.customerName,
    body.customer
  );
  const contactName = pickFirstString(
    body.contact_name,
    body.contactName,
    body.contact_person,
    body.contactPerson
  );
  const phone = pickFirstString(
    body.client_phone,
    body.clientPhone,
    body.phone
  );
  const email = pickFirstString(
    body.client_email,
    body.clientEmail,
    body.email
  ).toLowerCase();
  const notes = pickFirstString(body.client_notes, body.clientNotes, body.notes);

  return {
    client_name: clientName,
    contact_name: contactName,
    client_phone: phone,
    client_email: email,
    client_notes: notes,
  };
}

function extractProjectSubtasks(
  body: ProjectImportJsonRecord
): ProjectSubtaskInput[] {
  const projectBody = getProjectBody(body);
  const possibleArrays = [
    body.subtasks,
    body.tasks,
    body.items,
    body.deliverables,
    projectBody.subtasks,
    projectBody.tasks,
    projectBody.items,
    projectBody.deliverables,
  ];

  for (const value of possibleArrays) {
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is ProjectSubtaskInput =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item)
      );
    }
  }

  return [];
}

function getSubtaskTitle(subtask: ProjectSubtaskInput | undefined) {
  if (!subtask) {
    return "";
  }

  return pickFirstString(
    subtask.task_title,
    subtask.taskTitle,
    subtask.title,
    subtask.task
  );
}

function getProjectPayload(
  body: ProjectImportJsonRecord,
  options: ResolvedProjectImportPersistenceOptions =
    DEFAULT_PROJECT_IMPORT_PERSISTENCE_OPTIONS
) {
  const projectBody = getProjectBody(body);
  const client = getClientPayload(projectBody);
  const rawAmountInput = normalizeAmountInput(
    projectBody.amount ??
      projectBody.budget ??
      projectBody.price ??
      projectBody.cost ??
      projectBody.value
  );
  const parsedAmount = parseAmount(rawAmountInput);
  const amount =
    parsedAmount.displayAmount ??
    (typeof rawAmountInput === "string"
      ? rawAmountInput
      : typeof rawAmountInput === "number"
        ? String(rawAmountInput)
        : null);
  const deadlineText = pickFirstString(
    projectBody.deadline_text,
    projectBody.deadlineText,
    projectBody.deadline
  );
  const { deadlineDate } = parseDeadline(deadlineText);
  const suppliedDeadlineDate = normalizeProjectDeadlineDateInput(
    projectBody.deadline_date ?? projectBody.deadlineDate
  );
  const parsedDeadlineDate = normalizeProjectDeadlineDateInput(deadlineDate);
  const priority = pickFirstString(projectBody.priority);

  return {
    ...client,
    title:
      pickFirstString(
        projectBody.project_title,
        projectBody.projectTitle,
        projectBody.title,
        projectBody.name
      ) || pickFirstString(projectBody.task_title, projectBody.task),
    summary: pickFirstString(
      projectBody.summary,
      projectBody.project_summary,
      projectBody.description
    ),
    amount,
    amount_value: parsedAmount.amountValue,
    currency_code: parsedAmount.currencyCode,
    deadline_text: deadlineText,
    deadline_date: suppliedDeadlineDate ?? parsedDeadlineDate,
    priority:
      priority || (options.defaultProjectPriority ? "Medium" : null),
    status: pickFirstString(projectBody.status) || "New",
    source: pickFirstString(projectBody.source) || "Pasted text",
    raw_input: pickFirstString(projectBody.raw_input, projectBody.rawInput),
  };
}

export function validateProjectImportGroups(
  projects: ProjectImportJsonRecord[]
) {
  return projects.flatMap((project, groupIndex) => {
    const payload = getProjectPayload(project);
    const subtasks = extractProjectSubtasks(project);

    if (!payload.title && subtasks.length === 0) {
      return [
        {
          groupIndex,
          error: `Project group ${groupIndex + 1} needs a title or subtasks.`,
        },
      ];
    }

    if (subtasks.length > PROJECT_IMPORT_MAX_SUBTASKS_PER_PROJECT) {
      return [
        {
          groupIndex,
          error: `Project group ${groupIndex + 1} has too many subtasks.`,
        },
      ];
    }

    if (
      subtasks.length > 0 &&
      subtasks.some((subtask) => !getSubtaskTitle(subtask))
    ) {
      return [
        {
          groupIndex,
          error: `Project group ${groupIndex + 1} has a subtask without a title.`,
        },
      ];
    }

    return [];
  });
}

function normalizeResourceType(value: unknown) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  const allowed = new Set([
    "website",
    "logo",
    "image",
    "banner",
    "reference",
    "file",
    "note",
    "link",
  ]);

  return allowed.has(raw) ? raw : "link";
}

function resolveProjectImportPersistenceOptions(
  options: ProjectImportPersistenceOptions = {}
): ResolvedProjectImportPersistenceOptions {
  return {
    defaultProjectPriority:
      options.defaultProjectPriority ??
      DEFAULT_PROJECT_IMPORT_PERSISTENCE_OPTIONS.defaultProjectPriority,
    inheritProjectFieldsToSubtasks:
      options.inheritProjectFieldsToSubtasks ??
      DEFAULT_PROJECT_IMPORT_PERSISTENCE_OPTIONS.inheritProjectFieldsToSubtasks,
  };
}

type ProjectPayload = ReturnType<typeof getProjectPayload>;

function getSubtaskAmountInput({
  subtask,
  project,
  options,
}: {
  subtask: ProjectSubtaskInput;
  project: ProjectPayload;
  options: ResolvedProjectImportPersistenceOptions;
}): string | number | null {
  return normalizeAmountInput(
    options.inheritProjectFieldsToSubtasks
      ? subtask.amount ?? project.amount
      : subtask.amount
  );
}

function getSubtaskAmount({
  rawAmount,
  parsedAmount,
  project,
  options,
}: {
  rawAmount: string | number | null;
  parsedAmount: ReturnType<typeof parseAmount>;
  project: ProjectPayload;
  options: ResolvedProjectImportPersistenceOptions;
}): string | null {
  return (
    parsedAmount.displayAmount ??
    (typeof rawAmount === "string"
      ? rawAmount
      : typeof rawAmount === "number"
        ? String(rawAmount)
        : options.inheritProjectFieldsToSubtasks
          ? project.amount
          : null)
  );
}

function getSubtaskAmountValue({
  parsedAmount,
  project,
  options,
}: {
  parsedAmount: ReturnType<typeof parseAmount>;
  project: ProjectPayload;
  options: ResolvedProjectImportPersistenceOptions;
}): number | null {
  return (
    parsedAmount.amountValue ??
    (options.inheritProjectFieldsToSubtasks ? project.amount_value : null)
  );
}

function getSubtaskCurrencyCode({
  parsedAmount,
  project,
  options,
}: {
  parsedAmount: ReturnType<typeof parseAmount>;
  project: ProjectPayload;
  options: ResolvedProjectImportPersistenceOptions;
}): string | null {
  return (
    parsedAmount.currencyCode ??
    (options.inheritProjectFieldsToSubtasks ? project.currency_code : null)
  );
}

function getSubtaskDeadlineText({
  subtask,
  project,
  options,
}: {
  subtask: ProjectSubtaskInput;
  project: ProjectPayload;
  options: ResolvedProjectImportPersistenceOptions;
}): string {
  const taskDeadlineText = pickFirstString(
    subtask.deadline_text,
    subtask.deadlineText,
    subtask.deadline
  );

  return options.inheritProjectFieldsToSubtasks
    ? taskDeadlineText || project.deadline_text
    : taskDeadlineText;
}

function getSubtaskDeadlineDate({
  deadlineDate,
  project,
  options,
}: {
  deadlineDate: string | null;
  project: ProjectPayload;
  options: ResolvedProjectImportPersistenceOptions;
}): string | null {
  return (
    deadlineDate ??
    (options.inheritProjectFieldsToSubtasks ? project.deadline_date : null)
  );
}

function getSubtaskPriority({
  subtask,
  project,
  options,
}: {
  subtask: ProjectSubtaskInput;
  project: ProjectPayload;
  options: ResolvedProjectImportPersistenceOptions;
}): string {
  const taskPriority = pickFirstString(subtask.priority);

  return options.inheritProjectFieldsToSubtasks
    ? taskPriority || project.priority || "Medium"
    : taskPriority || "Medium";
}

function buildFallbackSubtask({
  fallbackTitle,
  project,
  options,
}: {
  fallbackTitle: string;
  project: ProjectPayload;
  options: ResolvedProjectImportPersistenceOptions;
}): ProjectSubtaskInput {
  if (options.inheritProjectFieldsToSubtasks) {
    return {
      task: fallbackTitle,
      amount: project.amount,
      deadline: project.deadline_text,
      priority: project.priority,
      status: project.status,
      source: project.source,
      raw_input: project.raw_input,
    };
  }

  return {
    task: fallbackTitle,
    status: project.status,
    source: project.source,
    raw_input: project.raw_input,
  };
}

function buildCanonicalImportPayload(
  projects: ProjectImportJsonRecord[],
  options: ResolvedProjectImportPersistenceOptions
) {
  return projects.map((body) => {
    const project = getProjectPayload(body, options);
    const subtasks = extractProjectSubtasks(body).map((subtask) => {
      const rawAmount = getSubtaskAmountInput({ subtask, project, options });
      const parsedAmount = parseAmount(rawAmount);
      const deadlineText = getSubtaskDeadlineText({
        subtask,
        project,
        options,
      });
      const { deadlineDate } = parseDeadline(deadlineText);
      const resources = Array.isArray(subtask.resources)
        ? subtask.resources.flatMap((resource) => {
            const title = pickFirstString(resource.title);
            const url = pickFirstString(resource.url);
            const notes = pickFirstString(resource.notes);

            if (!title && !url && !notes) return [];

            return [
              {
                resource_type: normalizeResourceType(resource.resource_type),
                title,
                url,
                notes,
              },
            ];
          })
        : [];

      return {
        task_title: getSubtaskTitle(subtask),
        contact_name:
          pickFirstString(subtask.contact_name, subtask.contactName) ||
          project.contact_name,
        amount: getSubtaskAmount({ rawAmount, parsedAmount, project, options }),
        amount_value: getSubtaskAmountValue({
          parsedAmount,
          project,
          options,
        }),
        currency_code: getSubtaskCurrencyCode({
          parsedAmount,
          project,
          options,
        }),
        deadline_text: deadlineText,
        deadline_date: getSubtaskDeadlineDate({
          deadlineDate,
          project,
          options,
        }),
        priority: getSubtaskPriority({ subtask, project, options }),
        status: pickFirstString(subtask.status) || project.status || "New",
        source: pickFirstString(subtask.source) || project.source,
        raw_input:
          pickFirstString(subtask.raw_input, subtask.rawInput) ||
          project.raw_input,
        resources,
      };
    });

    return {
      project,
      subtasks,
    };
  });
}

function getImportRequestHash(
  projects: ProjectImportJsonRecord[],
  options: ResolvedProjectImportPersistenceOptions
) {
  return createHash("sha256")
    .update(JSON.stringify(buildCanonicalImportPayload(projects, options)))
    .digest("hex");
}

function buildTransactionalImportGroups(
  projects: ProjectImportJsonRecord[],
  options: ResolvedProjectImportPersistenceOptions
) {
  return projects.map((body) => {
    const project = getProjectPayload(body, options);
    const subtasks = extractProjectSubtasks(body);
    const fallbackTitle =
      project.title || getSubtaskTitle(subtasks[0]) || "Untitled project";
    const normalizedSubtasks =
      subtasks.length > 0
        ? subtasks
        : [buildFallbackSubtask({ fallbackTitle, project, options })];

    return {
      client: {
        name: project.client_name,
        contact_name: project.contact_name || null,
        phone: project.client_phone || null,
        email: project.client_email || null,
        notes: project.client_notes || null,
      },
      project: {
        client_name: project.client_name,
        contact_name: project.contact_name || null,
        title: fallbackTitle,
        summary: project.summary || null,
        amount: project.amount,
        amount_value: project.amount_value,
        currency_code: project.currency_code,
        deadline_text: project.deadline_text,
        deadline_date: project.deadline_date,
        priority: project.priority,
        status: project.status,
        source: project.source,
        raw_input: project.raw_input,
      },
      tasks: normalizedSubtasks.map((subtask, index) => {
        const rawAmount = getSubtaskAmountInput({ subtask, project, options });
        const parsedAmount = parseAmount(rawAmount);
        const deadlineText = getSubtaskDeadlineText({
          subtask,
          project,
          options,
        });
        const { deadlineDate } = parseDeadline(deadlineText);
        const resources = Array.isArray(subtask.resources)
          ? subtask.resources.flatMap((resource) => {
              const title = pickFirstString(resource.title);
              const url = pickFirstString(resource.url);
              const notes = pickFirstString(resource.notes);

              if (!title && !url && !notes) return [];

              return [
                {
                  resource_type: normalizeResourceType(resource.resource_type),
                  title: title || null,
                  url: url || null,
                  notes: notes || null,
                },
              ];
            })
          : [];

        return {
          client_name: project.client_name,
          contact_name:
            pickFirstString(subtask.contact_name, subtask.contactName) ||
            project.contact_name ||
            null,
          subtask_order: index + 1,
          task_title: getSubtaskTitle(subtask),
          amount: getSubtaskAmount({
            rawAmount,
            parsedAmount,
            project,
            options,
          }),
          amount_value: getSubtaskAmountValue({
            parsedAmount,
            project,
            options,
          }),
          currency_code: getSubtaskCurrencyCode({
            parsedAmount,
            project,
            options,
          }),
          deadline_text: deadlineText,
          deadline_date: getSubtaskDeadlineDate({
            deadlineDate,
            project,
            options,
          }),
          priority: getSubtaskPriority({ subtask, project, options }),
          status: pickFirstString(subtask.status) || project.status || "New",
          source: pickFirstString(subtask.source) || project.source,
          raw_input:
            pickFirstString(subtask.raw_input, subtask.rawInput) ||
            project.raw_input,
          resources,
        };
      }),
    };
  });
}

export function prepareProjectImportPersistenceInput(
  projects: ProjectImportJsonRecord[],
  options?: ProjectImportPersistenceOptions
): PreparedProjectImportPersistenceInput {
  const resolvedOptions = resolveProjectImportPersistenceOptions(options);

  return {
    requestHash: getImportRequestHash(projects, resolvedOptions),
    payloadJson: buildTransactionalImportGroups(projects, resolvedOptions),
  };
}

function parseProjectImportAttempt(value: unknown) {
  const parsed = ProjectImportAttemptSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error("Project import attempt response is invalid");
  }

  return parsed.data;
}

export async function claimProjectImportAttempt({
  userId,
  idempotencyKey,
  projects,
  options,
}: {
  userId: string;
  idempotencyKey: string;
  projects: ProjectImportJsonRecord[];
  options?: ProjectImportPersistenceOptions;
}): Promise<ProjectImportClaimResult> {
  const { requestHash, payloadJson } =
    prepareProjectImportPersistenceInput(projects, options);

  const { data: insertedAttempt, error: insertError } = await supabaseAdmin
    .from("project_import_attempts")
    .insert({
      user_id: userId,
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      payload_json: payloadJson,
      status: "started",
    })
    .select("id, request_hash, status, result_json, error_code, payload_json")
    .single();

  if (!insertError && insertedAttempt) {
    return {
      kind: "claimed",
      attempt: parseProjectImportAttempt(insertedAttempt),
      requestHash,
      payloadJson,
    };
  }

  if (insertError?.code !== "23505") {
    throw new Error("Could not claim import attempt");
  }

  const { data: existingAttempt, error: lookupError } = await supabaseAdmin
    .from("project_import_attempts")
    .select("id, request_hash, status, result_json, error_code, payload_json")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .single();

  if (lookupError || !existingAttempt) {
    throw new Error("Could not load import attempt");
  }

  const attempt = parseProjectImportAttempt(existingAttempt);

  if (attempt.request_hash !== requestHash) {
    return { kind: "conflict" };
  }

  if (attempt.status === "committed") {
    if (!isJsonRecord(attempt.result_json)) {
      throw new Error("Committed import attempt has no replayable result");
    }

    return {
      kind: "replay",
      result: attempt.result_json,
    };
  }

  if (attempt.status === "failed") {
    return {
      kind: "failed",
      errorCode: attempt.error_code,
    };
  }

  if (attempt.error_code === "AWAITING_DUPLICATE_OVERRIDE") {
    const { data: resumedAttempts, error: resumeError } = await supabaseAdmin
      .from("project_import_attempts")
      .update({
        error_code: null,
        payload_json: payloadJson,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", attempt.id)
      .eq("user_id", userId)
      .eq("status", "started")
      .eq("error_code", "AWAITING_DUPLICATE_OVERRIDE")
      .select("id, request_hash, status, result_json, error_code, payload_json");

    if (resumeError) {
      throw new Error("Could not resume import attempt");
    }

    if (resumedAttempts?.length === 1) {
      return {
        kind: "claimed",
        attempt: parseProjectImportAttempt(resumedAttempts[0]),
        requestHash,
        payloadJson,
      };
    }
  }

  return { kind: "in_progress" };
}

export function toClaimedImportAttempt({
  userId,
  attempt,
  idempotencyKey,
  requestHash,
  payloadJson,
}: {
  userId: string;
  attempt: ProjectImportAttemptRow;
  idempotencyKey: string;
  requestHash: string;
  payloadJson: ProjectImportJsonRecord[];
}): ClaimedImportAttempt {
  return {
    userId,
    attemptId: attempt.id,
    idempotencyKey,
    requestHash,
    payloadJson,
  };
}

export async function prepareProjectImportAttemptForDuplicateReview(
  attempt: ClaimedImportAttempt
) {
  const { data, error } = await supabaseAdmin
    .from("project_import_attempts")
    .update({
      error_code: "AWAITING_DUPLICATE_OVERRIDE",
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", attempt.attemptId)
    .eq("user_id", attempt.userId)
    .eq("status", "started")
    .select("id");

  if (error || data?.length !== 1) {
    throw new Error("Could not prepare import attempt");
  }
}

export async function failProjectImportAttempt(
  attempt: ClaimedImportAttempt,
  errorCode: string
) {
  const { data, error } = await supabaseAdmin
    .from("project_import_attempts")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      error_code: errorCode,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", attempt.attemptId)
    .eq("user_id", attempt.userId)
    .eq("status", "started")
    .select("id");

  if (error || data?.length !== 1) {
    console.error("Project import attempt failure-state update failed");
  }
}

async function loadCommittedProjectImportResult(attempt: ClaimedImportAttempt) {
  const { data, error } = await supabaseAdmin
    .from("project_import_attempts")
    .select("status, result_json")
    .eq("id", attempt.attemptId)
    .eq("user_id", attempt.userId)
    .single();

  if (error) {
    return null;
  }

  return data?.status === "committed" && isJsonRecord(data.result_json)
    ? data.result_json
    : null;
}

function classifyTransactionalImportError(error: {
  code?: string | null;
  message?: string | null;
}): TransactionalImportFailureCategory {
  const message = error.message || "";

  if (message.includes("UNAUTHORIZED")) {
    return "unauthorized";
  }

  if (
    message.includes("INVALID_ATTEMPT") ||
    message.includes("INVALID_GROUPS") ||
    message.includes("INVALID_PROJECT") ||
    message.includes("INVALID_TASKS") ||
    message.includes("INVALID_RESOURCES")
  ) {
    return "invalid_payload";
  }

  if (
    message.includes("ATTEMPT_NOT_FOUND") ||
    message.includes("ATTEMPT_CONFLICT") ||
    message.includes("ATTEMPT_PAYLOAD_CONFLICT") ||
    message.includes("ATTEMPT_NOT_READY")
  ) {
    return "attempt_conflict";
  }

  return "import_failed";
}

export async function executeClaimedProjectImport(
  attempt: ClaimedImportAttempt
): Promise<ExecuteClaimedProjectImportResult> {
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    "import_projects_transaction",
    {
      p_attempt_id: attempt.attemptId,
      p_idempotency_key: attempt.idempotencyKey,
      p_request_hash: attempt.requestHash,
      p_groups: attempt.payloadJson,
    }
  );

  if (rpcError) {
    const committedResult = await loadCommittedProjectImportResult(attempt);

    if (committedResult) {
      return {
        kind: "replay",
        result: committedResult,
      };
    }

    await failProjectImportAttempt(attempt, "TRANSACTIONAL_IMPORT_FAILED");

    return {
      kind: "failed",
      category: classifyTransactionalImportError(rpcError),
    };
  }

  const parsedRpcData = ProjectImportSuccessSchema.safeParse(rpcData);

  if (!parsedRpcData.success) {
    return {
      kind: "unparsed_success",
      result: rpcData,
      validationError: parsedRpcData.error.flatten(),
    };
  }

  return {
    kind: "saved",
    result: parsedRpcData.data,
  };
}

export async function findProjectDuplicate(
  supabase: SupabaseServerClient,
  userId: string,
  body: ProjectImportJsonRecord
) {
  const project = getProjectPayload(body);
  const subtasks = extractProjectSubtasks(body);

  return findDuplicateProject({
    supabase,
    userId,
    candidate: buildDuplicateCandidateFromProjectPayload({
      client_name: project.client_name,
      contact_name: project.contact_name,
      amount: project.amount,
      deadline_text: project.deadline_text,
      deadline_date: project.deadline_date,
      title: project.title,
      summary: project.summary,
      subtasks: subtasks.map((subtask) => ({
        task_title: getSubtaskTitle(subtask),
      })),
    }),
  });
}

export async function findProjectDuplicateStrict(
  supabase: SupabaseServerClient,
  userId: string,
  body: ProjectImportJsonRecord
) {
  const project = getProjectPayload(body);
  const subtasks = extractProjectSubtasks(body);

  return findDuplicateProjectStrict({
    supabase,
    userId,
    candidate: buildDuplicateCandidateFromProjectPayload({
      client_name: project.client_name,
      contact_name: project.contact_name,
      amount: project.amount,
      deadline_text: project.deadline_text,
      deadline_date: project.deadline_date,
      title: project.title,
      summary: project.summary,
      subtasks: subtasks.map((subtask) => ({
        task_title: getSubtaskTitle(subtask),
      })),
    }),
  });
}

async function upsertClient(
  supabase: SupabaseServerClient,
  userId: string,
  project: ReturnType<typeof getProjectPayload>
) {
  if (!project.client_name) {
    return { clientId: null, clientData: null };
  }

  const { data: existingClients, error: lookupError } = await supabase
    .from("clients")
    .select("id, name, contact_name, phone, email, notes, created_at")
    .eq("user_id", userId)
    .ilike("name", project.client_name)
    .limit(1);

  if (lookupError) {
    throw new Error(lookupError.message || "Failed to lookup client");
  }

  const existingClient = existingClients?.[0] ?? null;

  if (existingClient) {
    const nextClient = {
      contact_name: project.contact_name || existingClient.contact_name || null,
      phone: project.client_phone || existingClient.phone || null,
      email: project.client_email || existingClient.email || null,
      notes: project.client_notes || existingClient.notes || null,
    };
    const shouldUpdate =
      nextClient.contact_name !== (existingClient.contact_name || null) ||
      nextClient.phone !== (existingClient.phone || null) ||
      nextClient.email !== (existingClient.email || null) ||
      nextClient.notes !== (existingClient.notes || null);

    if (!shouldUpdate) {
      return { clientId: existingClient.id, clientData: existingClient };
    }

    const { data: updatedClient, error: updateError } = await supabase
      .from("clients")
      .update(nextClient)
      .eq("id", existingClient.id)
      .eq("user_id", userId)
      .select("id, name, contact_name, phone, email, notes, created_at")
      .single();

    if (updateError || !updatedClient) {
      throw new Error(updateError?.message || "Failed to update client details");
    }

    return { clientId: updatedClient.id, clientData: updatedClient };
  }

  const { data: newClient, error: createError } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      name: project.client_name,
      contact_name: project.contact_name || null,
      phone: project.client_phone || null,
      email: project.client_email || null,
      notes: project.client_notes || null,
    })
    .select("id, name, contact_name, phone, email, notes, created_at")
    .single();

  if (createError || !newClient) {
    throw new Error(createError?.message || "Failed to create client");
  }

  return { clientId: newClient.id, clientData: newClient };
}

export async function createProjectGroup({
  supabase,
  userId,
  body,
  onProjectCreated,
}: {
  supabase: SupabaseServerClient;
  userId: string;
  body: ProjectImportJsonRecord;
  onProjectCreated: (projectId: string) => void;
}) {
  const project = getProjectPayload(body);
  const subtasks = extractProjectSubtasks(body);
  const { clientId, clientData } = await upsertClient(supabase, userId, project);
  const nowIso = new Date().toISOString();
  const fallbackTitle =
    project.title || getSubtaskTitle(subtasks[0]) || "Untitled project";

  const { data: createdProject, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      client_id: clientId,
      client_name: project.client_name,
      contact_name: project.contact_name || null,
      title: fallbackTitle,
      summary: project.summary || null,
      amount: project.amount,
      amount_value: project.amount_value,
      currency_code: project.currency_code,
      deadline_text: project.deadline_text,
      deadline_date: project.deadline_date,
      priority: project.priority,
      status: project.status,
      source: project.source,
      raw_input: project.raw_input,
      is_archived: false,
      archived_at: null,
      completed_at: isDoneStatus(project.status) ? nowIso : null,
      deleted_at: null,
    })
    .select("*")
    .single();

  if (projectError || !createdProject) {
    throw new Error(projectError?.message || "Failed to create project");
  }

  onProjectCreated(createdProject.id);

  const normalizedSubtasks =
    subtasks.length > 0
      ? subtasks
      : [
          {
            task: fallbackTitle,
            amount: project.amount,
            deadline: project.deadline_text,
            priority: project.priority,
            status: project.status,
            source: project.source,
            raw_input: project.raw_input,
          },
        ];
  const taskRows = normalizedSubtasks.map((subtask, index) => {
    const rawAmount = normalizeAmountInput(subtask.amount ?? project.amount);
    const parsedAmount = parseAmount(rawAmount);
    const deadlineText =
      pickFirstString(
        subtask.deadline_text,
        subtask.deadlineText,
        subtask.deadline
      ) || project.deadline_text;
    const { deadlineDate } = parseDeadline(deadlineText);
    const status = pickFirstString(subtask.status) || project.status || "New";

    return {
      user_id: userId,
      client_name: project.client_name,
      contact_name:
        pickFirstString(subtask.contact_name, subtask.contactName) ||
        project.contact_name ||
        null,
      client_id: clientId,
      project_id: createdProject.id,
      subtask_order: index + 1,
      task_title: getSubtaskTitle(subtask),
      amount:
        parsedAmount.displayAmount ??
        (typeof rawAmount === "string"
          ? rawAmount
          : typeof rawAmount === "number"
            ? String(rawAmount)
            : project.amount),
      amount_value: parsedAmount.amountValue ?? project.amount_value,
      currency_code: parsedAmount.currencyCode ?? project.currency_code,
      deadline_text: deadlineText,
      deadline_date: deadlineDate ?? project.deadline_date,
      priority: pickFirstString(subtask.priority) || project.priority || "Medium",
      status,
      source: pickFirstString(subtask.source) || project.source,
      raw_input: pickFirstString(subtask.raw_input, subtask.rawInput) || project.raw_input,
      is_archived: false,
      archived_at: null,
      completed_at: isDoneStatus(status) ? nowIso : null,
      deleted_at: null,
    };
  });

  const { data: insertedTasks, error: tasksError } = await supabase
    .from("tasks")
    .insert(taskRows)
    .select(TASK_WITH_CONTEXT_SELECT);

  if (tasksError) {
    throw new Error(tasksError.message || "Failed to create project tasks");
  }

  const cleanTasks = (insertedTasks ?? []).map((task) =>
    cleanJoinedTask(task, clientData)
  );
  const resourceRows: ProjectImportJsonRecord[] = [];

  normalizedSubtasks.forEach((subtask, index) => {
    const resources = Array.isArray(subtask.resources) ? subtask.resources : [];

    resources.forEach((resource) => {
      const title = pickFirstString(resource.title);
      const url = pickFirstString(resource.url);
      const notes = pickFirstString(resource.notes);

      if (!title && !url && !notes) return;

      resourceRows.push({
        user_id: userId,
        project_id: createdProject.id,
        task_id: insertedTasks?.[index]?.id ?? null,
        resource_type: normalizeResourceType(resource.resource_type),
        title: title || null,
        url: url || null,
        storage_path: null,
        file_name: null,
        mime_type: null,
        size_bytes: null,
        notes: notes || null,
      });
    });
  });

  if (resourceRows.length > 0) {
    const { error: resourcesError } = await supabase
      .from("task_resources")
      .insert(resourceRows);

    if (resourcesError) {
      throw new Error(resourcesError.message || "Failed to create task resources");
    }
  }

  return {
    project: createdProject,
    tasks: cleanTasks,
  };
}

export async function rollbackCreatedProjects(
  supabase: SupabaseServerClient,
  userId: string,
  projectIds: string[]
) {
  if (projectIds.length === 0) return;

  const { error: resourcesError } = await supabase
    .from("task_resources")
    .delete()
    .in("project_id", projectIds)
    .eq("user_id", userId);
  const { error: tasksError } = await supabase
    .from("tasks")
    .delete()
    .in("project_id", projectIds)
    .eq("user_id", userId);
  const { error: projectsError } = await supabase
    .from("projects")
    .delete()
    .in("id", projectIds)
    .eq("user_id", userId);

  if (resourcesError || tasksError || projectsError) {
    console.error("Project import rollback failed");
  }
}

function isDoneStatus(value: unknown) {
  return String(value || "").trim().toLowerCase() === "done";
}

function cleanJoinedTask(
  task: JoinedTaskRow,
  fallbackClient: ClientRow | null
) {
  const cleanTask = {
    ...task,
    client: Array.isArray(task.clients)
      ? task.clients[0] ?? fallbackClient
      : task.clients ?? fallbackClient,
    project: Array.isArray(task.projects)
      ? task.projects[0] ?? null
      : task.projects ?? null,
  };

  delete cleanTask.clients;
  delete cleanTask.projects;
  return cleanTask;
}
