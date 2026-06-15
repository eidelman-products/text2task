import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseAmount } from "@/lib/tasks/parse-amount";
import { parseDeadline } from "@/lib/tasks/parse-deadline";
import {
  buildDuplicateCandidateFromProjectPayload,
  findDuplicateProject,
  type DuplicateProjectMatch,
} from "@/lib/tasks/project-duplicate-detection";

const MAX_PROJECTS = 50;
const MAX_SUBTASKS_PER_PROJECT = 200;

const ProjectImportSchema = z
  .object({
    projects: z
      .array(z.record(z.string(), z.unknown()))
      .min(1)
      .max(MAX_PROJECTS),
    duplicateOverrideGroupIndexes: z
      .array(z.number().int().nonnegative().safe())
      .max(MAX_PROJECTS)
      .default([]),
  })
  .strict();

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type JsonRecord = Record<string, unknown>;
type ProjectSubtaskInput = JsonRecord & {
  resources?: JsonRecord[];
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
type JoinedTaskRow = JsonRecord & {
  clients?: ClientRow | ClientRow[] | null;
  projects?: JsonRecord | JsonRecord[] | null;
};

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

function errorResponse(
  code: string,
  error: string,
  status: number,
  extra: JsonRecord = {}
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      error,
      ...extra,
    },
    { status }
  );
}

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

function getProjectBody(body: JsonRecord) {
  return body.project && typeof body.project === "object"
    ? (body.project as JsonRecord)
    : body;
}

function getClientPayload(body: JsonRecord) {
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

function extractProjectSubtasks(body: JsonRecord): ProjectSubtaskInput[] {
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

function getSubtaskTitle(subtask: ProjectSubtaskInput) {
  return pickFirstString(
    subtask.task_title,
    subtask.taskTitle,
    subtask.title,
    subtask.task
  );
}

function getProjectPayload(body: JsonRecord) {
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
    deadline_date: deadlineDate,
    priority: pickFirstString(projectBody.priority) || "Medium",
    status: pickFirstString(projectBody.status) || "New",
    source: pickFirstString(projectBody.source) || "Pasted text",
    raw_input: pickFirstString(projectBody.raw_input, projectBody.rawInput),
  };
}

function validateProject(body: JsonRecord, groupIndex: number) {
  const project = getProjectPayload(body);
  const subtasks = extractProjectSubtasks(body);

  if (!project.title && subtasks.length === 0) {
    return `Project group ${groupIndex + 1} needs a title or subtasks.`;
  }

  if (subtasks.length > MAX_SUBTASKS_PER_PROJECT) {
    return `Project group ${groupIndex + 1} has too many subtasks.`;
  }

  if (subtasks.length > 0 && subtasks.some((subtask) => !getSubtaskTitle(subtask))) {
    return `Project group ${groupIndex + 1} has a subtask without a title.`;
  }

  return null;
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

function isDoneStatus(value: unknown) {
  return String(value || "").trim().toLowerCase() === "done";
}

function cleanJoinedTask(task: JoinedTaskRow, fallbackClient: ClientRow | null) {
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

async function findProjectDuplicate(
  supabase: SupabaseServerClient,
  userId: string,
  body: JsonRecord
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

async function createProjectGroup({
  supabase,
  userId,
  body,
  onProjectCreated,
}: {
  supabase: SupabaseServerClient;
  userId: string;
  body: JsonRecord;
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
  const resourceRows: JsonRecord[] = [];

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

async function rollbackCreatedProjects(
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
    console.error("Project import rollback error:", {
      resourcesError,
      tasksError,
      projectsError,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = ProjectImportSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("INVALID_PAYLOAD", "Invalid import request", 400);
    }

    const { projects, duplicateOverrideGroupIndexes } = parsed.data;
    const overrideIndexes = new Set(duplicateOverrideGroupIndexes);

    if (
      duplicateOverrideGroupIndexes.some((index) => index >= projects.length)
    ) {
      return errorResponse(
        "INVALID_PAYLOAD",
        "Invalid duplicate override index",
        400
      );
    }

    const validationFailures = projects.flatMap((project, groupIndex) => {
      const error = validateProject(project, groupIndex);
      return error ? [{ groupIndex, error }] : [];
    });

    if (validationFailures.length > 0) {
      return errorResponse(
        "VALIDATION_FAILED",
        "One or more project groups are invalid",
        400,
        { failedGroups: validationFailures }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
    }

    const duplicates: Array<{
      groupIndex: number;
      duplicate: DuplicateProjectMatch;
    }> = [];

    for (let groupIndex = 0; groupIndex < projects.length; groupIndex += 1) {
      if (overrideIndexes.has(groupIndex)) continue;

      const duplicate = await findProjectDuplicate(
        supabase,
        user.id,
        projects[groupIndex]
      );

      if (duplicate) {
        duplicates.push({ groupIndex, duplicate });
      }
    }

    if (duplicates.length > 0) {
      return errorResponse(
        "DUPLICATE_PROJECT_DETECTED",
        "One or more projects may already exist",
        409,
        {
          duplicates,
          createdProjects: [],
          createdTasks: [],
          failedGroups: [],
        }
      );
    }

    const createdProjectIds: string[] = [];
    const createdProjects: unknown[] = [];
    const createdTasks: unknown[] = [];
    let activeGroupIndex = 0;

    try {
      for (
        activeGroupIndex = 0;
        activeGroupIndex < projects.length;
        activeGroupIndex += 1
      ) {
        const result = await createProjectGroup({
          supabase,
          userId: user.id,
          body: projects[activeGroupIndex],
          onProjectCreated: (projectId) => createdProjectIds.push(projectId),
        });

        createdProjects.push(result.project);
        createdTasks.push(...result.tasks);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import projects";

      await rollbackCreatedProjects(supabase, user.id, createdProjectIds);

      return errorResponse("IMPORT_FAILED", message, 500, {
        createdProjects: [],
        createdTasks: [],
        duplicates: [],
        failedGroups: [{ groupIndex: activeGroupIndex, error: message }],
      });
    }

    return NextResponse.json({
      ok: true,
      createdProjects,
      createdTasks,
      duplicates: [],
      failedGroups: [],
    });
  } catch (error) {
    console.error("Project import route error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to import projects", 500);
  }
}
