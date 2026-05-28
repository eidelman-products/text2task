import { createClient } from "@/lib/supabase/server";

import type { ExistingProjectUpdateContext } from "@/lib/project-updates/project-update-types";

type LoadProjectUpdateContextResult =
  | {
      ok: true;
      userId: string;
      context: ExistingProjectUpdateContext;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

type ProjectRelationRow = ExistingProjectUpdateContext["project"] & {
  clients?: unknown;
};

type ClientRelationRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type TaskRelationRow = {
  id: number;
  project_id: string;
  task_title: string | null;
  status: string | null;
  priority: string | null;
  deadline_text: string | null;
  deadline_date: string | null;
  amount: string | null;
  subtask_order: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function getSingleRelation<T>(value: unknown): T | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }

  return value as T;
}

function normalizeClient(value: unknown): ExistingProjectUpdateContext["client"] {
  const client = getSingleRelation<ClientRelationRow>(value);

  if (!client?.id) {
    return null;
  }

  return {
    id: client.id,
    name: client.name ?? null,
    phone: client.phone ?? null,
    email: client.email ?? null,
    notes: client.notes ?? null,
  };
}

function normalizeProject(
  project: ProjectRelationRow
): ExistingProjectUpdateContext["project"] {
  return {
    id: project.id,
    user_id: project.user_id,
    client_id: project.client_id ?? null,

    title: project.title ?? null,
    summary: project.summary ?? null,

    client_name: project.client_name ?? null,
    contact_name: project.contact_name ?? null,

    amount: project.amount ?? null,
    amount_value: project.amount_value ?? null,
    currency_code: project.currency_code ?? null,

    deadline_text: project.deadline_text ?? null,
    deadline_date: project.deadline_date ?? null,

    priority: project.priority ?? null,
    status: project.status ?? null,

    created_at: project.created_at ?? null,
    updated_at: project.updated_at ?? null,
  };
}

function normalizeSubtask(task: TaskRelationRow): ExistingProjectUpdateContext["subtasks"][number] {
  return {
    id: task.id,
    project_id: task.project_id,
    task_title: task.task_title ?? null,
    status: task.status ?? null,
    priority: task.priority ?? null,
    deadline_text: task.deadline_text ?? null,
    deadline_date: task.deadline_date ?? null,
    amount: task.amount ?? null,
    subtask_order: task.subtask_order ?? null,
    created_at: task.created_at ?? null,
    updated_at: task.updated_at ?? null,
  };
}

export async function loadProjectUpdateContext(
  projectId: string
): Promise<LoadProjectUpdateContextResult> {
  if (!projectId || typeof projectId !== "string") {
    return {
      ok: false,
      status: 400,
      error: "Missing project id.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      status: 401,
      error: "You must be signed in to load a project update context.",
    };
  }

  const { data: project, error: projectError } = await supabase
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
      status,
      created_at,
      updated_at,
      clients:clients (
        id,
        name,
        phone,
        email,
        notes
      )
    `
    )
    .eq("id", projectId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (projectError || !project) {
    return {
      ok: false,
      status: 404,
      error: "Project not found or you do not have access to it.",
    };
  }

  const { data: subtasks, error: subtasksError } = await supabase
    .from("tasks")
    .select(
      `
      id,
      project_id,
      task_title,
      status,
      priority,
      deadline_text,
      deadline_date,
      amount,
      subtask_order,
      created_at,
      updated_at
    `
    )
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("subtask_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (subtasksError) {
    return {
      ok: false,
      status: 500,
      error: "Could not load project subtasks.",
    };
  }

  const typedProject = project as ProjectRelationRow;
  const typedSubtasks = (subtasks ?? []) as TaskRelationRow[];

  return {
    ok: true,
    userId: user.id,
    context: {
      project: normalizeProject(typedProject),
      client: normalizeClient(typedProject.clients),
      subtasks: typedSubtasks.map(normalizeSubtask),
    },
  };
}