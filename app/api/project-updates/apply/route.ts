import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  findDuplicateSubtaskInNewTitles,
  findDuplicateSubtaskInProject,
  type DuplicateSubtaskMatch,
} from "@/lib/tasks/subtask-duplicate-detection";
import {
  normalizeProjectUpdateBudget,
  resolveProjectUpdateDeadline,
} from "@/lib/project-updates/project-update-field-normalizers";
import {
  asJsonRecord,
  buildTransactionalApplyPayloadItem,
  findNonApplicableAcceptedItem,
  getExactStringValue,
  getNumberValue,
  getStringValue,
  getTaskTitleFromItem,
  validateProjectPriorityChoice,
  type ProjectClientRow,
  type ProjectRow,
  type ProjectUpdateItemRow,
} from "@/lib/project-updates/project-update-apply.server";
import {
  dashboardTasksNoStoreHeaders,
  loadDashboardTasksForUser,
  type DashboardTaskRow,
} from "@/lib/tasks/load-dashboard-tasks.server";

import type {
  JsonRecord,
  ProjectTimelineEvent,
  ProjectUpdate,
  ProjectUpdateItem,
  ProjectUpdateItemType,
} from "@/lib/project-updates/project-update-types";

const ApplyProjectUpdateRequestSchema = z
  .object({
    projectUpdateId: z.string().min(1, "Project update id is required."),
    acceptedItemIds: z.array(z.string().min(1)).default([]),
    rejectedItemIds: z.array(z.string().min(1)).default([]),
    editedItems: z
      .array(
        z.object({
          itemId: z.string().min(1),
          newValue: z.record(z.string(), z.unknown()),
        })
      )
      .default([]),
  })
  .refine(
    (value) => value.acceptedItemIds.length > 0 || value.rejectedItemIds.length > 0,
    {
      message: "At least one accepted or rejected item id is required.",
      path: ["acceptedItemIds"],
    }
  );

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ApplyProjectUpdateResponse =
  | {
      ok: true;
      update: ProjectUpdate;
      project: ProjectRow | null;
      projectTasks: ProjectTaskSnapshotRow[];
      dashboardTasks: ProjectTaskSnapshotRow[];
      appliedItems: ProjectUpdateItem[];
      rejectedItems: ProjectUpdateItem[];
      timelineEvents: ProjectTimelineEvent[];
    }
  | {
      ok: false;
      code?: string;
      error: string;
      message?: string;
      duplicate?: DuplicateSubtaskMatch;
      details?: unknown;
    };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ProjectUpdateRow = ProjectUpdate;

type ProjectUpdateClaimFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
  details?: unknown;
};

type ProjectUpdateClaimResult =
  | {
      ok: true;
      attemptId: string;
      update: ProjectUpdateRow;
    }
  | ProjectUpdateClaimFailure;

type EditedItemOverride = {
  itemId: string;
  newValue: JsonRecord;
};

type ProjectTaskSnapshotRow = DashboardTaskRow;

type TransactionalApplyResult = {
  update: ProjectUpdate;
  appliedItems: ProjectUpdateItem[];
  rejectedItems: ProjectUpdateItem[];
  timelineEvents: ProjectTimelineEvent[];
};

function getOptionalString(record: JsonRecord, keys: string[]): string | null {
  return getStringValue(record, keys, null);
}

function getOptionalNumber(record: JsonRecord, keys: string[]): number | null {
  return getNumberValue(record, keys, null);
}

function normalizeAllowedChoice(
  value: string | null,
  allowed: string[],
  fieldName: string
): string | null {
  if (value === null) return null;

  const match = allowed.find((option) => option.toLowerCase() === value.toLowerCase());

  if (!match) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  return match;
}

function compactJsonRecord(record: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string") return value.trim().length > 0;
      return true;
    })
  );
}

function normalizeEditedNewValueForItem(item: ProjectUpdateItemRow, rawValue: JsonRecord): JsonRecord {
  switch (item.type as ProjectUpdateItemType) {
    case "new_subtask": {
      const taskTitle =
        getOptionalString(rawValue, ["task_title", "title", "name"]) || item.title;

      if (!taskTitle?.trim()) {
        throw new Error("New subtask edits require a task title.");
      }

      return compactJsonRecord({
        task_title: taskTitle,
        deadline_text: getOptionalString(rawValue, ["deadline_text", "deadline"]),
        amount: getOptionalString(rawValue, ["amount", "budget", "price", "cost"]),
        amount_value: getOptionalNumber(rawValue, ["amount_value", "budget_value"]),
        currency_code: getOptionalString(rawValue, ["currency_code", "currency"]),
        priority:
          normalizeAllowedChoice(
            getOptionalString(rawValue, ["priority"]),
            ["Low", "Medium", "High"],
            "priority"
          ) ?? "Medium",
        status:
          normalizeAllowedChoice(
            getOptionalString(rawValue, ["status"]),
            ["New", "In Progress", "Review", "Urgent", "Done"],
            "status"
          ) ?? "New",
      });
    }

    case "update_subtask": {
      const normalized = compactJsonRecord({
        task_title: getOptionalString(rawValue, ["task_title", "title", "name"]),
        deadline_text: getOptionalString(rawValue, ["deadline_text", "deadline"]),
        deadline_date: getOptionalString(rawValue, ["deadline_date"]),
        amount: getOptionalString(rawValue, ["amount", "budget", "price", "cost"]),
        amount_value: getOptionalNumber(rawValue, ["amount_value", "budget_value"]),
        currency_code: getOptionalString(rawValue, ["currency_code", "currency"]),
        priority: normalizeAllowedChoice(
          getOptionalString(rawValue, ["priority"]),
          ["Low", "Medium", "High"],
          "priority"
        ),
        status: normalizeAllowedChoice(
          getOptionalString(rawValue, ["status"]),
          ["New", "In Progress", "Review", "Urgent", "Done"],
          "status"
        ),
        notes: getOptionalString(rawValue, ["notes", "note"]),
      });

      if (Object.keys(normalized).length === 0) {
        throw new Error("Subtask edits require at least one supported field.");
      }

      return normalized;
    }

    case "deadline_change": {
      const deadlineText = getOptionalString(rawValue, ["deadline_text", "deadline", "value"]);

      if (!deadlineText) {
        throw new Error("Deadline edits require a suggested deadline.");
      }

      return compactJsonRecord({
        deadline_text: deadlineText,
        deadline_date: getOptionalString(rawValue, ["deadline_date"]),
      });
    }

    case "budget_change": {
      const amount = getOptionalString(rawValue, ["amount", "budget", "price", "cost", "value"]);

      if (!amount) {
        throw new Error("Budget edits require a suggested amount.");
      }

      return compactJsonRecord({
        amount,
        amount_value: getOptionalNumber(rawValue, ["amount_value", "budget_value"]),
        currency_code: getOptionalString(rawValue, ["currency_code", "currency"]),
      });
    }

    case "priority_change": {
      const priority = validateProjectPriorityChoice(
        getExactStringValue(rawValue, ["priority", "value"])
      );

      if (!priority) {
        throw new Error("Priority edits require a suggested priority.");
      }

      return { priority };
    }

    case "status_change": {
      const status = normalizeAllowedChoice(
        getOptionalString(rawValue, ["status", "value"]),
        ["New", "In Progress", "Review", "Urgent", "Done"],
        "status"
      );

      if (!status) {
        throw new Error("Status edits require a suggested status.");
      }

      return { status };
    }

    case "client_detail_change": {
      const normalized = compactJsonRecord({
        client_name: getOptionalString(rawValue, ["client_name", "name"]),
        contact_name: getOptionalString(rawValue, ["contact_name"]),
        phone: getOptionalString(rawValue, ["phone"]),
        email: getOptionalString(rawValue, ["email"]),
        notes: getOptionalString(rawValue, ["notes", "client_notes"]),
      });

      if (Object.keys(normalized).length === 0) {
        throw new Error("Client detail edits require at least one supported field.");
      }

      return normalized;
    }

    case "project_note":
    case "client_note": {
      const note = getOptionalString(rawValue, ["note", "notes", "value"]);

      if (!note) {
        throw new Error("Note edits require note text.");
      }

      return { note };
    }

    case "duplicate_warning":
    case "no_action":
      return compactJsonRecord(rawValue);

    default:
      return compactJsonRecord(rawValue);
  }
}

function applyEditedOverridesToItems(input: {
  items: ProjectUpdateItemRow[];
  overrides: Map<string, JsonRecord>;
}) {
  return input.items.map((item) => {
    const override = input.overrides.get(item.id);

    if (!override) return item;

    return {
      ...item,
      new_value: override,
    };
  });
}

function normalizeProjectFieldItemForApply(input: {
  project: ProjectRow;
  item: ProjectUpdateItemRow;
}): ProjectUpdateItemRow {
  const { project, item } = input;
  const nextValue = asJsonRecord(item.new_value);

  if (item.type === "deadline_change") {
    const deadlineText = getStringValue(nextValue, [
      "deadline_text",
      "deadline",
      "value",
    ]);

    if (!deadlineText) {
      throw new Error("Deadline edits require a suggested deadline.");
    }

    return {
      ...item,
      new_value: resolveProjectUpdateDeadline({
        deadlineText,
        currentDeadlineDate: project.deadline_date,
      }),
    };
  }

  if (item.type === "budget_change") {
    const amountText = getStringValue(nextValue, [
      "amount",
      "budget",
      "price",
      "cost",
      "value",
    ]);

    if (!amountText) {
      throw new Error("Budget edits require a suggested amount.");
    }

    const normalizedBudget = normalizeProjectUpdateBudget({
      amountText,
      existingCurrencyCode: project.currency_code,
      existingAmountText: project.amount,
    });

    if (!normalizedBudget) {
      throw new Error("Budget edits require a numeric suggested amount.");
    }

    return {
      ...item,
      new_value: normalizedBudget,
    };
  }

  return item;
}

function normalizeAcceptedProjectFieldItemsForApply(input: {
  project: ProjectRow;
  items: ProjectUpdateItemRow[];
  acceptedItemIds: Set<string>;
}) {
  return input.items.map((item) => {
    if (!input.acceptedItemIds.has(item.id)) {
      return item;
    }

    return normalizeProjectFieldItemForApply({
      project: input.project,
      item,
    });
  });
}

function buildNormalizedEditedItemsForApply(input: {
  editedOverrides: Map<string, JsonRecord>;
  acceptedItems: ProjectUpdateItemRow[];
}) {
  const normalizedEditedItems = new Map(input.editedOverrides);

  input.acceptedItems.forEach((item) => {
    if (item.type !== "deadline_change" && item.type !== "budget_change") {
      return;
    }

    const nextValue = asJsonRecord(item.new_value);

    if (nextValue) {
      normalizedEditedItems.set(item.id, nextValue);
    }
  });

  return Array.from(normalizedEditedItems, ([itemId, newValue]) => ({
    itemId,
    newValue,
  }));
}

async function loadProjectUpdateForApply(input: {
  supabase: SupabaseServerClient;
  projectUpdateId: string;
  userId: string;
}): Promise<
  | {
      ok: true;
      update: ProjectUpdateRow;
      project: ProjectRow;
      items: ProjectUpdateItemRow[];
    }
  | {
      ok: false;
      status: number;
      error: string;
    }
> {
  const { data: update, error: updateError } = await input.supabase
    .from("project_updates")
    .select("*")
    .eq("id", input.projectUpdateId)
    .eq("user_id", input.userId)
    .single();

  if (updateError || !update) {
    return {
      ok: false,
      status: 404,
      error: "Project update not found or you do not have access to it.",
    };
  }

  const typedUpdate = update as ProjectUpdateRow;

  const { data: project, error: projectError } = await input.supabase
    .from("projects")
    .select(
      `
      id,
      user_id,
      client_id,
      title,
      summary,
      client_name,
      contact_name,
      amount,
      amount_value,
      currency_code,
      deadline_text,
      deadline_date,
      priority,
      priority_source,
      status,
      deleted_at
    `
    )
    .eq("id", typedUpdate.project_id)
    .eq("user_id", input.userId)
    .is("deleted_at", null)
    .single();

  if (projectError || !project) {
    return {
      ok: false,
      status: 404,
      error: "Project not found or you do not have access to it.",
    };
  }

  const { data: items, error: itemsError } = await input.supabase
    .from("project_update_items")
    .select("*")
    .eq("project_update_id", input.projectUpdateId)
    .eq("project_id", typedUpdate.project_id)
    .eq("user_id", input.userId)
    .order("created_at", { ascending: true });

  if (itemsError) {
    return {
      ok: false,
      status: 500,
      error: "Could not load project update items.",
    };
  }

  return {
    ok: true,
    update: typedUpdate,
    project: project as ProjectRow,
    items: (items ?? []) as ProjectUpdateItemRow[],
  };
}

function getApplyOperationalDetails(update: ProjectUpdateRow) {
  return {
    status: update.status,
    applyAttemptId: update.apply_attempt_id,
    applyStartedAt: update.apply_started_at,
    applyFailedAt: update.apply_failed_at,
    applyErrorCode: update.apply_error_code,
  };
}

function getProjectUpdateStateFailure(
  update: ProjectUpdateRow
): ProjectUpdateClaimFailure {
  const details = getApplyOperationalDetails(update);

  if (update.status === "applied") {
    return {
      ok: false,
      status: 409,
      code: "project_update_already_applied",
      error: "This project update was already applied. Refresh the workspace to see the latest changes.",
      details,
    };
  }

  if (update.status === "applying") {
    return {
      ok: false,
      status: 409,
      code: "project_update_apply_in_progress",
      error:
        "This project update is already being applied. Wait for it to finish, then refresh the workspace. If it remains in progress, contact support before trying again.",
      details,
    };
  }

  if (update.status === "failed") {
    const error = update.apply_attempt_id
      ? "A previous apply attempt failed after it started. It was not retried automatically. Contact support before trying again."
      : "This project update is in a failed state and cannot be applied. Re-analyze the client update or contact support before trying again.";

    return {
      ok: false,
      status: 409,
      code: "project_update_apply_failed",
      error,
      details,
    };
  }

  return {
    ok: false,
    status: 409,
    code: "project_update_invalid_state",
    error: `This project update cannot be applied while its status is "${update.status}".`,
    details,
  };
}

async function claimProjectUpdateForApply(input: {
  supabase: SupabaseServerClient;
  projectUpdateId: string;
  userId: string;
}): Promise<ProjectUpdateClaimResult> {
  const attemptId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  const { data: claimedUpdate, error: claimError } = await input.supabase
    .from("project_updates")
    .update({
      status: "applying",
      apply_started_at: startedAt,
      apply_attempt_id: attemptId,
      apply_failed_at: null,
      apply_error_code: null,
    })
    .eq("id", input.projectUpdateId)
    .eq("user_id", input.userId)
    .in("status", ["analyzed", "reviewed"])
    .select("*")
    .maybeSingle();

  if (claimError) {
    console.error("Could not claim project update for apply:", {
      stage: "claim_apply",
      category: "claim_failed",
    });

    return {
      ok: false,
      status: 500,
      code: "project_update_claim_failed",
      error: "Text2Task could not safely start applying this update. No changes were applied.",
    };
  }

  if (claimedUpdate) {
    return {
      ok: true,
      attemptId,
      update: claimedUpdate as ProjectUpdateRow,
    };
  }

  const { data: currentUpdate, error: currentError } = await input.supabase
    .from("project_updates")
    .select("*")
    .eq("id", input.projectUpdateId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (currentError || !currentUpdate) {
    return {
      ok: false,
      status: 404,
      code: "project_update_not_found",
      error: "Project update not found or you do not have access to it.",
    };
  }

  const typedUpdate = currentUpdate as ProjectUpdateRow;
  return getProjectUpdateStateFailure(typedUpdate);
}

function buildValidatedEditedItemOverrides(input: {
  editedItems: EditedItemOverride[];
  loadedItems: ProjectUpdateItemRow[];
  acceptedItemIds: Set<string>;
  rejectedItemIds: Set<string>;
}): Map<string, JsonRecord> {
  const loadedItemsById = new Map(input.loadedItems.map((item) => [item.id, item]));
  const overrides = new Map<string, JsonRecord>();

  for (const editedItem of input.editedItems) {
    const item = loadedItemsById.get(editedItem.itemId);

    if (!item) {
      throw new Error("Edited item does not belong to this project update.");
    }

    if (input.rejectedItemIds.has(editedItem.itemId)) {
      throw new Error("Rejected items cannot receive edited values.");
    }

    if (!input.acceptedItemIds.has(editedItem.itemId)) {
      throw new Error("Only accepted items can receive edited values.");
    }

    overrides.set(
      editedItem.itemId,
      normalizeEditedNewValueForItem(item, editedItem.newValue)
    );
  }

  return overrides;
}

async function findDuplicateAcceptedNewSubtask(input: {
  supabase: SupabaseServerClient;
  userId: string;
  projectId: string;
  acceptedItems: ProjectUpdateItemRow[];
}): Promise<DuplicateSubtaskMatch | null> {
  const newSubtaskTitles = input.acceptedItems
    .filter((item) => item.type === "new_subtask")
    .map((item) => getTaskTitleFromItem(item))
    .filter((title) => title.trim().length > 0);

  if (newSubtaskTitles.length === 0) {
    return null;
  }

  const duplicateWithinRequest = findDuplicateSubtaskInNewTitles(newSubtaskTitles);

  if (duplicateWithinRequest) {
    return duplicateWithinRequest;
  }

  for (const title of newSubtaskTitles) {
    const duplicate = await findDuplicateSubtaskInProject({
      supabase: input.supabase,
      userId: input.userId,
      projectId: input.projectId,
      candidateTitle: title,
    });

    if (duplicate) {
      return duplicate;
    }
  }

  return null;
}

async function markProjectUpdateApplyFailed(input: {
  supabase: SupabaseServerClient;
  userId: string;
  updateId: string;
  attemptId: string;
  errorCode: string;
}): Promise<{
  recorded: boolean;
  update: ProjectUpdate | null;
  recordingError: string | null;
}> {
  const { data, error } = await input.supabase
    .from("project_updates")
    .update({
      status: "failed",
      apply_failed_at: new Date().toISOString(),
      apply_error_code: input.errorCode,
    })
    .eq("id", input.updateId)
    .eq("user_id", input.userId)
    .eq("status", "applying")
    .eq("apply_attempt_id", input.attemptId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Could not record failed project update apply attempt:", {
      stage: "record_failed_apply",
      category: "record_failed_state_unavailable",
    });

    return {
      recorded: false,
      update: null,
      recordingError: "record_failed_state_unavailable",
    };
  }

  return {
    recorded: Boolean(data),
    update: data ? (data as ProjectUpdate) : null,
    recordingError: null,
  };
}

function parseTransactionalApplyResult(
  value: unknown
): TransactionalApplyResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const result = value as Record<string, unknown>;

  if (
    !result.update ||
    typeof result.update !== "object" ||
    Array.isArray(result.update) ||
    !Array.isArray(result.appliedItems) ||
    !Array.isArray(result.rejectedItems) ||
    !Array.isArray(result.timelineEvents)
  ) {
    return null;
  }

  return {
    update: result.update as ProjectUpdate,
    appliedItems: result.appliedItems as ProjectUpdateItem[],
    rejectedItems: result.rejectedItems as ProjectUpdateItem[],
    timelineEvents: result.timelineEvents as ProjectTimelineEvent[],
  };
}

async function recoverTransactionalApplyResult(input: {
  supabase: SupabaseServerClient;
  userId: string;
  updateId: string;
  attemptId: string;
  acceptedItemIds: string[];
  rejectedItemIds: string[];
}): Promise<TransactionalApplyResult | null> {
  const { data: update, error: updateError } = await input.supabase
    .from("project_updates")
    .select("*")
    .eq("id", input.updateId)
    .eq("user_id", input.userId)
    .eq("status", "applied")
    .eq("apply_attempt_id", input.attemptId)
    .maybeSingle();

  if (updateError || !update) {
    return null;
  }

  const loadItems = async (itemIds: string[]) => {
    if (itemIds.length === 0) return [];

    const { data, error } = await input.supabase
      .from("project_update_items")
      .select("*")
      .in("id", itemIds)
      .eq("project_update_id", input.updateId)
      .eq("user_id", input.userId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error("recover_applied_items_failed");
    }

    return (data ?? []) as ProjectUpdateItem[];
  };

  try {
    const [appliedItems, rejectedItems, timelineResult] = await Promise.all([
      loadItems(input.acceptedItemIds),
      loadItems(input.rejectedItemIds),
      input.acceptedItemIds.length > 0
        ? input.supabase
            .from("project_timeline_events")
            .select("*")
            .eq("source_update_id", input.updateId)
            .eq("user_id", input.userId)
            .in("source_item_id", input.acceptedItemIds)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (timelineResult.error) {
      throw new Error("recover_timeline_events_failed");
    }

    return {
      update: update as ProjectUpdate,
      appliedItems,
      rejectedItems,
      timelineEvents: (timelineResult.data ?? []) as ProjectTimelineEvent[],
    };
  } catch {
    console.warn("Recovered applied update, but related apply result reads failed:", {
      stage: "recover_transactional_apply",
      category: "related_result_reads_failed",
    });

    return {
      update: update as ProjectUpdate,
      appliedItems: [],
      rejectedItems: [],
      timelineEvents: [],
    };
  }
}

async function reloadProjectAfterApply(input: {
  supabase: SupabaseServerClient;
  userId: string;
  projectId: string;
}): Promise<ProjectRow | null> {
  const { data, error } = await input.supabase
    .from("projects")
    .select(
      `
      id,
      user_id,
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
      priority_source,
      status,
      source,
      raw_input,
      created_at,
      updated_at,
      completed_at,
      is_archived,
      archived_at,
      deleted_at,
      clients:clients (
        id,
        name,
        contact_name,
        phone,
        email,
        notes,
        created_at
      )
    `
    )
    .eq("id", input.projectId)
    .eq("user_id", input.userId)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    console.warn(
      "Could not reload project after applying client update:",
      {
        stage: "reload_project_after_apply",
        category: error ? "reload_failed" : "project_not_found",
      }
    );
    return null;
  }

  const project = data as ProjectRow & { clients?: ProjectClientRow | ProjectClientRow[] | null };
  const client = Array.isArray(project.clients)
    ? project.clients[0] ?? null
    : project.clients ?? null;
  const cleanProject = {
    ...project,
    client,
  };
  delete cleanProject.clients;

  return cleanProject as ProjectRow;
}

async function reloadProjectTasksAfterApply(input: {
  supabase: SupabaseServerClient;
  userId: string;
  projectId: string;
}): Promise<ProjectTaskSnapshotRow[]> {
  try {
    return await loadDashboardTasksForUser({
      supabase: input.supabase,
      userId: input.userId,
      view: "active",
      projectId: input.projectId,
    });
  } catch {
    console.warn(
      "Could not reload project task snapshot after applying client update:",
      {
        stage: "reload_project_tasks_after_apply",
        category: "reload_failed",
      }
    );
    return [];
  }
}

async function reloadActiveDashboardTasksAfterApply(input: {
  supabase: SupabaseServerClient;
  userId: string;
}): Promise<ProjectTaskSnapshotRow[]> {
  try {
    return await loadDashboardTasksForUser({
      supabase: input.supabase,
      userId: input.userId,
      view: "active",
    });
  } catch {
    console.warn(
      "Could not reload active dashboard task snapshot after applying client update:",
      {
        stage: "reload_dashboard_tasks_after_apply",
        category: "reload_failed",
      }
    );
    return [];
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "Invalid JSON request body.",
      },
      { status: 400, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const parsedBody = ApplyProjectUpdateRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "Invalid project update apply request.",
        details: parsedBody.error.flatten(),
      },
      { status: 400, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const { projectUpdateId, acceptedItemIds, rejectedItemIds, editedItems } = parsedBody.data;

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "You must be signed in to apply project updates.",
      },
      { status: 401, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const uniqueAcceptedIds = Array.from(new Set(acceptedItemIds));
  const uniqueRejectedIds = Array.from(new Set(rejectedItemIds));
  const duplicateIds = uniqueAcceptedIds.filter((id) => uniqueRejectedIds.includes(id));

  if (duplicateIds.length > 0) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "The same update item cannot be both accepted and rejected.",
        details: { duplicateIds },
      },
      { status: 400, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const loaded = await loadProjectUpdateForApply({
    supabase,
    projectUpdateId,
    userId: user.id,
  });

  if (!loaded.ok) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: loaded.error,
      },
      { status: loaded.status, headers: dashboardTasksNoStoreHeaders }
    );
  }

  if (loaded.update.status !== "analyzed" && loaded.update.status !== "reviewed") {
    const stateFailure = getProjectUpdateStateFailure(loaded.update);

    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        code: stateFailure.code,
        error: stateFailure.error,
        message: stateFailure.error,
        details: stateFailure.details,
      },
      { status: stateFailure.status, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const acceptedItems = loaded.items.filter((item) => uniqueAcceptedIds.includes(item.id));
  const rejectedItems = loaded.items.filter((item) => uniqueRejectedIds.includes(item.id));

  if (acceptedItems.length !== uniqueAcceptedIds.length) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "One or more accepted update items were not found.",
      },
      { status: 404, headers: dashboardTasksNoStoreHeaders }
    );
  }

  if (rejectedItems.length !== uniqueRejectedIds.length) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "One or more rejected update items were not found.",
      },
      { status: 404, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const nonApplicableAcceptedItem = findNonApplicableAcceptedItem(acceptedItems);

  if (nonApplicableAcceptedItem) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        code: "project_update_item_not_applicable",
        error:
          "One or more accepted items are not directly applicable (already exists, no change needed, or needs review) and cannot be applied automatically. Re-analyze or choose a different item.",
      },
      { status: 400, headers: dashboardTasksNoStoreHeaders }
    );
  }

  let editedOverrides: Map<string, JsonRecord>;

  try {
    editedOverrides = buildValidatedEditedItemOverrides({
      editedItems: editedItems.map((item) => ({
        itemId: item.itemId,
        newValue: item.newValue as JsonRecord,
      })),
      loadedItems: loaded.items,
      acceptedItemIds: new Set(uniqueAcceptedIds),
      rejectedItemIds: new Set(uniqueRejectedIds),
    });
  } catch {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "Invalid edited item values.",
      },
      { status: 400, headers: dashboardTasksNoStoreHeaders }
    );
  }

  let preflightItemsForApply: ProjectUpdateItemRow[];
  let preflightAcceptedItems: ProjectUpdateItemRow[];

  try {
    preflightItemsForApply = normalizeAcceptedProjectFieldItemsForApply({
      project: loaded.project,
      items: applyEditedOverridesToItems({
        items: loaded.items,
        overrides: editedOverrides,
      }),
      acceptedItemIds: new Set(uniqueAcceptedIds),
    });
    preflightAcceptedItems = preflightItemsForApply.filter((item) =>
      uniqueAcceptedIds.includes(item.id)
    );
  } catch {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "Invalid project update values.",
      },
      { status: 400, headers: dashboardTasksNoStoreHeaders }
    );
  }

  try {
    const duplicateSubtask = await findDuplicateAcceptedNewSubtask({
      supabase,
      userId: user.id,
      projectId: loaded.project.id,
      acceptedItems: preflightAcceptedItems,
    });

    if (duplicateSubtask) {
      return NextResponse.json<ApplyProjectUpdateResponse>(
        {
          ok: false,
          code: "duplicate_subtask",
          error:
            "This suggested subtask looks similar to an existing subtask. Edit the title or unselect this change before applying.",
          message:
            "This suggested subtask looks similar to an existing subtask. Edit the title or unselect this change before applying.",
          duplicate: duplicateSubtask,
        },
        { status: 409, headers: dashboardTasksNoStoreHeaders }
      );
    }
  } catch {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        code: "project_update_preflight_failed",
        error: "Could not safely validate this project update.",
      },
      { status: 500, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const claim = await claimProjectUpdateForApply({
    supabase,
    projectUpdateId,
    userId: user.id,
  });

  if (!claim.ok) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        code: claim.code,
        error: claim.error,
        message: claim.error,
        details: claim.details,
      },
      { status: claim.status, headers: dashboardTasksNoStoreHeaders }
    );
  }

  let applyStage = "build_transactional_payload";

  try {
    const itemsForApply = preflightItemsForApply;
    const acceptedItemsForApply = itemsForApply.filter((item) =>
      uniqueAcceptedIds.includes(item.id)
    );
    const normalizedApplyPayload = acceptedItemsForApply.map((item) =>
      buildTransactionalApplyPayloadItem({
        project: loaded.project,
        item,
      })
    );
    const normalizedEditedItems = buildNormalizedEditedItemsForApply({
      editedOverrides,
      acceptedItems: acceptedItemsForApply,
    });

    applyStage = "transactional_apply";

    const updateId = loaded.update.id;
    const applyAttemptId = claim.attemptId;
    const acceptedItemIds = uniqueAcceptedIds;
    const rejectedItemIds = uniqueRejectedIds;
    const rpcArgs = {
      p_update_id: updateId,
      p_apply_attempt_id: applyAttemptId,
      p_accepted_item_ids: acceptedItemIds,
      p_rejected_item_ids: rejectedItemIds,
      p_edited_items: normalizedEditedItems,
      p_apply_payload: normalizedApplyPayload,
    };

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "apply_project_update_transaction",
      rpcArgs
    );

    let transactionalResult = parseTransactionalApplyResult(rpcData);

    if (rpcError) {
      transactionalResult = await recoverTransactionalApplyResult({
        supabase,
        userId: user.id,
        updateId: loaded.update.id,
        attemptId: claim.attemptId,
        acceptedItemIds: uniqueAcceptedIds,
        rejectedItemIds: uniqueRejectedIds,
      });

      if (!transactionalResult) {
        throw new Error("transactional_apply_unavailable");
      }

      console.warn(
        "Project update apply RPC returned an error after commit; recovered committed result:",
        {
          stage: "transactional_apply",
          category: "rpc_error_after_commit_recovered",
        }
      );
    }

    if (!transactionalResult) {
      transactionalResult = await recoverTransactionalApplyResult({
        supabase,
        userId: user.id,
        updateId: loaded.update.id,
        attemptId: claim.attemptId,
        acceptedItemIds: uniqueAcceptedIds,
        rejectedItemIds: uniqueRejectedIds,
      });
    }

    if (!transactionalResult) {
      /*
        A successful RPC response means the transaction committed. Keep that
        server success authoritative even if the returned JSON cannot be
        narrowed or the follow-up recovery read fails.
      */
      console.error("Committed project update apply result could not be narrowed:", {
        stage: "transactional_apply",
        category: "committed_result_not_narrowed",
        hasRpcData: rpcData !== null && rpcData !== undefined,
      });

      const committedAt = new Date().toISOString();
      transactionalResult = {
        update: {
          ...claim.update,
          status: "applied",
          reviewed_by: user.id,
          applied_by: user.id,
          reviewed_at: committedAt,
          applied_at: committedAt,
          apply_failed_at: null,
          apply_error_code: null,
        },
        appliedItems: acceptedItemsForApply.map((item) => ({
          ...item,
          status: "applied",
        })),
        rejectedItems: itemsForApply
          .filter((item) => uniqueRejectedIds.includes(item.id))
          .map((item) => ({ ...item, status: "rejected" })),
        timelineEvents: [],
      };
    }

    const updatedProject = await reloadProjectAfterApply({
      supabase,
      userId: user.id,
      projectId: loaded.project.id,
    });
    const projectTasks = await reloadProjectTasksAfterApply({
      supabase,
      userId: user.id,
      projectId: loaded.project.id,
    });
    const dashboardTasks = await reloadActiveDashboardTasksAfterApply({
      supabase,
      userId: user.id,
    });

    return NextResponse.json<ApplyProjectUpdateResponse>({
      ok: true,
      update: transactionalResult.update,
      project: updatedProject,
      projectTasks,
      dashboardTasks,
      appliedItems: transactionalResult.appliedItems,
      rejectedItems: transactionalResult.rejectedItems,
      timelineEvents: transactionalResult.timelineEvents,
    }, {
      headers: dashboardTasksNoStoreHeaders,
    });
  } catch {
    const errorCode = `project_update_${applyStage}_failed`;

    console.error("Project update apply attempt failed:", {
      stage: applyStage,
      category: "apply_attempt_failed",
    });

    const failedState = await markProjectUpdateApplyFailed({
      supabase,
      userId: user.id,
      updateId: loaded.update.id,
      attemptId: claim.attemptId,
      errorCode,
    });
    const recoveryMessage = failedState.recorded
      ? "The update was marked failed and will not be retried automatically. Contact support before trying again."
      : "Text2Task could not record the recovery state. Do not retry this update until support has inspected it.";

    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        code: "project_update_apply_failed",
        error: `Could not apply project update. ${recoveryMessage}`,
        message: recoveryMessage,
        details: {
          applyAttemptId: claim.attemptId,
          applyErrorCode: errorCode,
          failedStateRecorded: failedState.recorded,
          applyFailedAt: failedState.update?.apply_failed_at ?? null,
        },
      },
      { status: 500, headers: dashboardTasksNoStoreHeaders }
    );
  }
}
