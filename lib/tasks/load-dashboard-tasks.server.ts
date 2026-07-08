export type DashboardTasksView = "active" | "archived" | "all" | "stats";

export type DashboardTaskRow = Record<string, unknown>;

type DashboardTaskLoaderClient = {
  from: (table: "tasks") => any;
};

type LoadDashboardTasksInput = {
  supabase: DashboardTaskLoaderClient;
  userId: string;
  view: DashboardTasksView;
  projectId?: string | null;
};

export const dashboardTasksNoStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const dashboardTaskSelect = `
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
    priority_source,
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

export async function loadDashboardTasksForUser({
  supabase,
  userId,
  view,
  projectId,
}: LoadDashboardTasksInput): Promise<DashboardTaskRow[]> {
  let query = supabase
    .from("tasks")
    .select(dashboardTaskSelect)
    .eq("user_id", userId);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  if (view !== "stats") {
    query = query.is("deleted_at", null);
  }

  if (view === "active") {
    query = query.or("is_archived.eq.false,is_archived.is.null");
  }

  if (view === "archived") {
    query = query.eq("is_archived", true);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    throw new Error(error.message || "Failed to load dashboard tasks.");
  }

  return (data ?? []).map(cleanDashboardTaskRow);
}

function cleanDashboardTaskRow(task: any): DashboardTaskRow {
  const taskWithRelations = {
    ...task,
    client: Array.isArray(task.clients)
      ? task.clients[0] ?? null
      : task.clients ?? null,
    project: Array.isArray(task.projects)
      ? task.projects[0] ?? null
      : task.projects ?? null,
  };

  const { clients, projects, ...cleanTask } = taskWithRelations;

  return cleanTask;
}
