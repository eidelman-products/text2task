import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseDeadline } from "@/lib/tasks/parse-deadline";
import { parseAmount } from "@/lib/tasks/parse-amount";
import {
  buildDuplicateCandidateFromProjectPayload,
  findDuplicateProject,
} from "@/lib/tasks/project-duplicate-detection";

type TasksView = "active" | "archived" | "all" | "stats";

type ProjectResourceInput = {
  resource_type?: string;
  title?: string;
  url?: string;
  notes?: string;
};

type ProjectSubtaskInput = {
  task?: string;
  task_title?: string;
  taskTitle?: string;
  title?: string;
  amount?: unknown;
  deadline?: unknown;
  deadline_text?: unknown;
  deadlineText?: unknown;
  priority?: unknown;
  status?: unknown;
  source?: unknown;
  raw_input?: unknown;
  rawInput?: unknown;
  contact_name?: unknown;
  contactName?: unknown;
  resources?: ProjectResourceInput[];
};

function normalizeAmountInput(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  return null;
}

function normalizeClientName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalClientField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pickFirstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function normalizeEmail(value: unknown): string {
  const email = normalizeOptionalClientField(value);

  if (!email) return "";

  return email.toLowerCase();
}

function normalizePhone(value: unknown): string {
  const phone = normalizeOptionalClientField(value);

  if (!phone) return "";

  return phone;
}

function normalizeTasksView(value: string | null): TasksView {
  if (value === "archived") return "archived";
  if (value === "all") return "all";
  if (value === "stats") return "stats";
  return "active";
}

function isDoneStatus(status: string | null | undefined) {
  return String(status || "").trim().toLowerCase() === "done";
}

function cleanTaskWithJoinedClient(task: any) {
  const cleanTask = {
    ...task,
    client: Array.isArray(task.clients)
      ? task.clients[0] ?? null
      : task.clients ?? null,
    project: Array.isArray(task.projects)
      ? task.projects[0] ?? null
      : task.projects ?? null,
  };

  const { clients, projects, ...result } = cleanTask;
  return result;
}

function cleanTaskWithClientFallback(task: any, clientData: any = null) {
  const taskWithClient = {
    ...task,
    client: Array.isArray(task.clients)
      ? task.clients[0] ?? clientData
      : task.clients ?? clientData,
    project: Array.isArray(task.projects)
      ? task.projects[0] ?? null
      : task.projects ?? null,
  };

  const { clients, projects, ...cleanTask } = taskWithClient;
  return cleanTask;
}

function getContactNameFromBody(body: any): string {
  return pickFirstString(
    body.contact_name,
    body.contactName,
    body.contact_person,
    body.contactPerson,
    body.person_name,
    body.personName,
    body.sender_name,
    body.senderName,
    body.client_contact_name,
    body.clientContactName
  );
}

function getClientPayloadFromBody(body: any) {
  const client_name = pickFirstString(
    body.client_name,
    body.clientName,
    body.client,
    body.customer_name,
    body.customerName,
    body.customer
  );

  const contact_name = getContactNameFromBody(body);

  const rawPhone = pickFirstString(
    body.client_phone,
    body.clientPhone,
    body.phone,
    body.phone_number,
    body.phoneNumber,
    body.client_mobile,
    body.clientMobile,
    body.mobile
  );

  const rawEmail = pickFirstString(
    body.client_email,
    body.clientEmail,
    body.email,
    body.email_address,
    body.emailAddress,
    body.client_mail,
    body.clientMail
  );

  const client_notes = pickFirstString(
    body.client_notes,
    body.clientNotes,
    body.notes,
    body.client_note,
    body.clientNote
  );

  return {
    client_name: normalizeClientName(client_name),
    contact_name: normalizeOptionalClientField(contact_name),
    client_phone: normalizePhone(rawPhone),
    client_email: normalizeEmail(rawEmail),
    client_notes,
  };
}

function getTaskTitleFromBody(body: any): string {
  return pickFirstString(
    body.task_title,
    body.taskTitle,
    body.title,
    body.task,
    body.name
  );
}

function getDeadlineTextFromBody(body: any): string {
  return pickFirstString(
    body.deadline_text,
    body.deadlineText,
    body.deadline,
    body.due_date_text,
    body.dueDateText,
    body.due_date,
    body.dueDate
  );
}

function getSourceFromBody(body: any): string {
  return (
    pickFirstString(
      body.source,
      body.input_source,
      body.inputSource,
      body.origin
    ) || "Pasted text"
  );
}

function getRawInputFromBody(body: any): string {
  return pickFirstString(
    body.raw_input,
    body.rawInput,
    body.original_text,
    body.originalText,
    body.input,
    body.text
  );
}

function getProjectPayloadFromBody(body: any) {
  const projectBody =
    body.project && typeof body.project === "object" ? body.project : body;

  const clientPayload = getClientPayloadFromBody(projectBody);

  const title =
    pickFirstString(
      projectBody.project_title,
      projectBody.projectTitle,
      projectBody.project_name,
      projectBody.projectName,
      projectBody.title,
      projectBody.name
    ) || getTaskTitleFromBody(projectBody);

  const summary = pickFirstString(
    projectBody.summary,
    projectBody.project_summary,
    projectBody.projectSummary,
    projectBody.description
  );

  const rawAmountInput = normalizeAmountInput(
    projectBody.amount ??
      projectBody.budget ??
      projectBody.price ??
      projectBody.cost ??
      projectBody.value ??
      projectBody.amount_text ??
      projectBody.amountText
  );

  const parsedAmount = parseAmount(rawAmountInput);

  const amount =
    parsedAmount.displayAmount ??
    (typeof rawAmountInput === "string"
      ? rawAmountInput
      : typeof rawAmountInput === "number"
        ? String(rawAmountInput)
        : null);

  const deadline_text = getDeadlineTextFromBody(projectBody);
  const { deadlineDate } = parseDeadline(deadline_text);

  const priority =
    pickFirstString(
      projectBody.priority,
      projectBody.project_priority,
      projectBody.projectPriority
    ) || "Medium";

  const status =
    pickFirstString(
      projectBody.status,
      projectBody.project_status,
      projectBody.projectStatus
    ) || "New";

  const source = getSourceFromBody(projectBody);
  const raw_input = getRawInputFromBody(projectBody);

  return {
    ...clientPayload,
    title,
    summary,
    amount,
    amount_value: parsedAmount.amountValue,
    currency_code: parsedAmount.currencyCode,
    deadline_text,
    deadline_date: deadlineDate,
    priority,
    status,
    source,
    raw_input,
  };
}

function extractProjectSubtasks(body: any): ProjectSubtaskInput[] {
  const projectBody =
    body.project && typeof body.project === "object" ? body.project : body;

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
      return value.filter((item) => item && typeof item === "object");
    }
  }

  return [];
}

function isProjectCreateRequest(body: any) {
  if (!body || typeof body !== "object") return false;

  const projectBody =
    body.project && typeof body.project === "object" ? body.project : null;

  const hasProjectFlag =
    body.mode === "project" ||
    body.type === "project" ||
    body.save_as === "project" ||
    body.saveAs === "project" ||
    body.create_project === true ||
    body.createProject === true ||
    Boolean(projectBody);

  const hasSubtasks = extractProjectSubtasks(body).length > 0;

  return hasProjectFlag || hasSubtasks;
}

function shouldSkipDuplicateCheck(body: any) {
  return (
    body?.skip_duplicate_check === true ||
    body?.skipDuplicateCheck === true ||
    body?.save_anyway === true ||
    body?.saveAnyway === true ||
    body?.allow_duplicate === true ||
    body?.allowDuplicate === true ||
    body?.force_save === true ||
    body?.forceSave === true
  );
}

function getSubtaskTitle(subtask: ProjectSubtaskInput): string {
  return pickFirstString(
    subtask.task_title,
    subtask.taskTitle,
    subtask.title,
    subtask.task
  );
}

function normalizeResourceType(value: unknown): string {
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

async function checkProjectDuplicateBeforeSave({
  supabase,
  userId,
  body,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  body: any;
}) {
  if (shouldSkipDuplicateCheck(body)) {
    return null;
  }

  const projectPayload = getProjectPayloadFromBody(body);
  const subtasks = extractProjectSubtasks(body);

  const duplicateCandidate = buildDuplicateCandidateFromProjectPayload({
    client_name: projectPayload.client_name,
    contact_name: projectPayload.contact_name,
    amount: projectPayload.amount,
    deadline_text: projectPayload.deadline_text,
    deadline_date: projectPayload.deadline_date,
    title: projectPayload.title,
    summary: projectPayload.summary,
    subtasks: subtasks.map((subtask) => ({
      task_title: getSubtaskTitle(subtask),
    })),
  });

  return findDuplicateProject({
    supabase,
    userId,
    candidate: duplicateCandidate,
  });
}

async function upsertClientForUser({
  supabase,
  userId,
  client_name,
  contact_name,
  client_phone,
  client_email,
  client_notes,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  client_name: string;
  contact_name: string;
  client_phone: string;
  client_email: string;
  client_notes: string;
}) {
  let clientId: string | null = null;
  let clientData: any = null;

  if (!client_name) {
    return { clientId, clientData };
  }

  const { data: existingClients, error: clientLookupError } = await supabase
    .from("clients")
    .select("id, name, contact_name, phone, email, notes, created_at")
    .eq("user_id", userId)
    .ilike("name", client_name)
    .limit(1);

  if (clientLookupError) {
    throw new Error(clientLookupError.message || "Failed to lookup client");
  }

  if (existingClients && existingClients.length > 0) {
    const existingClient = existingClients[0];

    clientId = existingClient.id;

    const nextContactName =
      contact_name || existingClient.contact_name || null;
    const nextPhone = client_phone || existingClient.phone || null;
    const nextEmail = client_email || existingClient.email || null;
    const nextNotes = client_notes || existingClient.notes || null;

    const shouldUpdateClient =
      nextContactName !== (existingClient.contact_name || null) ||
      nextPhone !== (existingClient.phone || null) ||
      nextEmail !== (existingClient.email || null) ||
      nextNotes !== (existingClient.notes || null);

    if (shouldUpdateClient) {
      const { data: updatedClient, error: updateClientError } = await supabase
        .from("clients")
        .update({
          contact_name: nextContactName,
          phone: nextPhone,
          email: nextEmail,
          notes: nextNotes,
        })
        .eq("id", existingClient.id)
        .eq("user_id", userId)
        .select("id, name, contact_name, phone, email, notes, created_at")
        .single();

      if (updateClientError) {
        throw new Error(
          updateClientError.message || "Failed to update client details"
        );
      }

      clientData = updatedClient;
    } else {
      clientData = existingClient;
    }
  } else {
    const { data: newClient, error: createClientError } = await supabase
      .from("clients")
      .insert({
        user_id: userId,
        name: client_name,
        contact_name: contact_name || null,
        phone: client_phone || null,
        email: client_email || null,
        notes: client_notes || null,
      })
      .select("id, name, contact_name, phone, email, notes, created_at")
      .single();

    if (createClientError) {
      throw new Error(createClientError.message || "Failed to create client");
    }

    clientId = newClient.id;
    clientData = newClient;
  }

  return { clientId, clientData };
}

async function createProjectWithSubtasks({
  supabase,
  userId,
  body,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  body: any;
}) {
  const projectPayload = getProjectPayloadFromBody(body);
  const subtasks = extractProjectSubtasks(body);

  if (!projectPayload.title && subtasks.length === 0) {
    throw new Error("Project title or subtasks are required");
  }

  const { clientId, clientData } = await upsertClientForUser({
    supabase,
    userId,
    client_name: projectPayload.client_name,
    contact_name: projectPayload.contact_name,
    client_phone: projectPayload.client_phone,
    client_email: projectPayload.client_email,
    client_notes: projectPayload.client_notes,
  });

  const nowIso = new Date().toISOString();
  const projectCompletedAt = isDoneStatus(projectPayload.status) ? nowIso : null;

  const fallbackProjectTitle =
    projectPayload.title || getSubtaskTitle(subtasks[0]) || "Untitled project";

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      client_id: clientId,
      client_name: projectPayload.client_name,
      contact_name: projectPayload.contact_name || null,
      title: fallbackProjectTitle,
      summary: projectPayload.summary || null,
      amount: projectPayload.amount,
      amount_value: projectPayload.amount_value,
      currency_code: projectPayload.currency_code,
      deadline_text: projectPayload.deadline_text,
      deadline_date: projectPayload.deadline_date,
      priority: projectPayload.priority,
      status: projectPayload.status,
      source: projectPayload.source,
      raw_input: projectPayload.raw_input,
      is_archived: false,
      archived_at: null,
      completed_at: projectCompletedAt,
      deleted_at: null,
    })
    .select("*")
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message || "Failed to create project");
  }

  const normalizedSubtasks =
    subtasks.length > 0
      ? subtasks
      : [
          {
            task: fallbackProjectTitle,
            amount: projectPayload.amount,
            deadline: projectPayload.deadline_text,
            priority: projectPayload.priority,
            status: projectPayload.status,
            source: projectPayload.source,
            raw_input: projectPayload.raw_input,
          },
        ];

  const taskRows = normalizedSubtasks
    .map((subtask, index) => {
      const subtaskTitle = getSubtaskTitle(subtask);

      if (!subtaskTitle) return null;

      const rawAmountInput = normalizeAmountInput(
        subtask.amount ??
          projectPayload.amount ??
          body.amount ??
          body.budget ??
          body.price ??
          body.cost ??
          body.value
      );

      const parsedAmount = parseAmount(rawAmountInput);

      const amount =
        parsedAmount.displayAmount ??
        (typeof rawAmountInput === "string"
          ? rawAmountInput
          : typeof rawAmountInput === "number"
            ? String(rawAmountInput)
            : projectPayload.amount);

      const deadlineText =
        pickFirstString(
          subtask.deadline_text,
          subtask.deadlineText,
          subtask.deadline
        ) || projectPayload.deadline_text;

      const { deadlineDate } = parseDeadline(deadlineText);

      const status =
        pickFirstString(subtask.status) || projectPayload.status || "New";

      return {
        user_id: userId,
        client_name: projectPayload.client_name,
        contact_name:
          pickFirstString(subtask.contact_name, subtask.contactName) ||
          projectPayload.contact_name ||
          null,
        client_id: clientId,
        project_id: project.id,
        subtask_order: index + 1,
        task_title: subtaskTitle,
        amount,
        amount_value: parsedAmount.amountValue ?? projectPayload.amount_value,
        currency_code:
          parsedAmount.currencyCode ?? projectPayload.currency_code,
        deadline_text: deadlineText,
        deadline_date: deadlineDate ?? projectPayload.deadline_date,
        priority:
          pickFirstString(subtask.priority) ||
          projectPayload.priority ||
          "Medium",
        status,
        source: pickFirstString(subtask.source) || projectPayload.source,
        raw_input:
          pickFirstString(subtask.raw_input, subtask.rawInput) ||
          projectPayload.raw_input,
        is_archived: false,
        archived_at: null,
        completed_at: isDoneStatus(status) ? nowIso : null,
        deleted_at: null,
      };
    })
    .filter(Boolean);

  if (taskRows.length === 0) {
    throw new Error("At least one subtask title is required");
  }

  const { data: insertedTasks, error: tasksError } = await supabase
    .from("tasks")
    .insert(taskRows)
    .select(
      `
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
    `
    );

  if (tasksError) {
    throw new Error(tasksError.message || "Failed to create project tasks");
  }

  const cleanTasks = (insertedTasks ?? []).map((task) =>
    cleanTaskWithClientFallback(task, clientData)
  );

  const resourceRows: any[] = [];

  normalizedSubtasks.forEach((subtask, index) => {
    const task = cleanTasks[index];
    const resources = Array.isArray(subtask.resources)
      ? subtask.resources
      : [];

    resources.forEach((resource) => {
      const title = pickFirstString(resource.title);
      const url = pickFirstString(resource.url);
      const notes = pickFirstString(resource.notes);

      if (!title && !url && !notes) return;

      resourceRows.push({
        user_id: userId,
        project_id: project.id,
        task_id: task?.id ?? null,
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

  let resources: any[] = [];

  if (resourceRows.length > 0) {
    const { data: insertedResources, error: resourcesError } = await supabase
      .from("task_resources")
      .insert(resourceRows)
      .select("*");

    if (resourcesError) {
      throw new Error(
        resourcesError.message || "Failed to create task resources"
      );
    }

    resources = insertedResources ?? [];
  }

  return {
    project,
    tasks: cleanTasks,
    resources,
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const view = normalizeTasksView(url.searchParams.get("view"));

    let query = supabase
      .from("tasks")
      .select(
        `
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
      `
      )
      .eq("user_id", user.id);

    if (view !== "stats") {
      query = query.is("deleted_at", null);
    }

    if (view === "active") {
      query = query.eq("is_archived", false);
    }

    if (view === "archived") {
      query = query.eq("is_archived", true);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("tasks GET error:", error);

      return NextResponse.json(
        { error: error.message || "Failed to load tasks" },
        { status: 500 }
      );
    }

    const tasks = (data ?? []).map(cleanTaskWithJoinedClient);

    return NextResponse.json({
      view,
      tasks,
    });
  } catch (error: any) {
    console.error("tasks GET unexpected error:", error);

    return NextResponse.json(
      { error: error.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (isProjectCreateRequest(body)) {
      try {
        const duplicate = await checkProjectDuplicateBeforeSave({
          supabase,
          userId: user.id,
          body,
        });

        if (duplicate) {
          return NextResponse.json(
            {
              error: "DUPLICATE_PROJECT_DETECTED",
              message:
                "This project may already exist. Review the existing project before saving again.",
              duplicate,
            },
            { status: 409 }
          );
        }

        const result = await createProjectWithSubtasks({
          supabase,
          userId: user.id,
          body,
        });

        return NextResponse.json({
          project: result.project,
          tasks: result.tasks,
          resources: result.resources,
        });
      } catch (projectError: any) {
        console.error("project create error:", projectError);

        return NextResponse.json(
          {
            error:
              projectError.message || "Failed to save project with subtasks",
          },
          { status: 500 }
        );
      }
    }

    const {
      client_name,
      contact_name,
      client_phone,
      client_email,
      client_notes,
    } = getClientPayloadFromBody(body);

    const task_title = getTaskTitleFromBody(body);

    const rawAmountInput = normalizeAmountInput(
      body.amount ??
        body.budget ??
        body.price ??
        body.cost ??
        body.value ??
        body.amount_text ??
        body.amountText
    );

    const parsedAmount = parseAmount(rawAmountInput);

    const amount =
      parsedAmount.displayAmount ??
      (typeof rawAmountInput === "string"
        ? rawAmountInput
        : typeof rawAmountInput === "number"
          ? String(rawAmountInput)
          : null);

    const deadline_text = getDeadlineTextFromBody(body);

    const priority =
      pickFirstString(body.priority, body.task_priority, body.taskPriority) ||
      "Medium";

    const status =
      pickFirstString(body.status, body.task_status, body.taskStatus) || "New";

    const source = getSourceFromBody(body);

    const raw_input = getRawInputFromBody(body);

    if (!task_title) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      );
    }

    const { deadlineDate } = parseDeadline(deadline_text);

    let clientId: string | null = null;
    let clientData: any = null;

    try {
      const clientResult = await upsertClientForUser({
        supabase,
        userId: user.id,
        client_name,
        contact_name,
        client_phone,
        client_email,
        client_notes,
      });

      clientId = clientResult.clientId;
      clientData = clientResult.clientData;
    } catch (clientError: any) {
      console.error("client save error:", clientError);

      return NextResponse.json(
        { error: clientError.message || "Failed to save client" },
        { status: 500 }
      );
    }

    const nowIso = new Date().toISOString();
    const completed_at = isDoneStatus(status) ? nowIso : null;

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        client_name,
        contact_name: contact_name || null,
        client_id: clientId,
        project_id: null,
        subtask_order: null,
        task_title,
        amount,
        amount_value: parsedAmount.amountValue,
        currency_code: parsedAmount.currencyCode,
        deadline_text,
        deadline_date: deadlineDate,
        priority,
        status,
        source,
        raw_input,
        is_archived: false,
        archived_at: null,
        completed_at,
        deleted_at: null,
      })
      .select(
        `
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
      `
      )
      .single();

    if (error) {
      console.error("task insert error:", error);

      return NextResponse.json(
        { error: error.message || "Failed to save task" },
        { status: 500 }
      );
    }

    const cleanTask = cleanTaskWithClientFallback(data, clientData);

    return NextResponse.json({ task: cleanTask });
  } catch (error: any) {
    console.error("tasks POST unexpected error:", error);

    return NextResponse.json(
      { error: error.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}