import { normalizeEmbeddedRelation } from "@/lib/supabase/joined-row";
import type { EmbeddedClientRow } from "@/lib/supabase/joined-row";

export function getQueryErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string" &&
    (error as { message: string }).message
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

export type DashboardTasksView = "active" | "archived" | "all" | "stats";

export type DashboardTaskRow = Record<string, unknown>;

type JoinedDashboardTaskRow = DashboardTaskRow & {
  clients?: EmbeddedClientRow | EmbeddedClientRow[] | null;
  projects?: Record<string, unknown> | Record<string, unknown>[] | null;
};

type DashboardTaskQueryResult = {
  data: JoinedDashboardTaskRow[] | null;
  error: unknown;
};

/*
  Precise local shape of the query chain this loader actually builds --
  distinct from lib/supabase/query-builder-like.ts's SupabaseFilterBuilderLike
  because here order() is the terminal, awaited call (there is no limit()
  after it), whereas the duplicate-detection queries always call limit()
  last. Reusing the same shared interface for both would force order() to
  serve two incompatible roles.
*/
interface DashboardTaskFilterBuilder {
  eq(column: string, value: unknown): this;
  is(column: string, value: unknown): this;
  or(filters: string): this;
  order(
    column: string,
    options?: { ascending?: boolean }
  ): PromiseLike<DashboardTaskQueryResult>;
}

type DashboardTaskLoaderClient = {
  from: (table: "tasks") => {
    select: (columns: string) => DashboardTaskFilterBuilder;
  };
};

type LoadDashboardTasksInput<Client> = {
  supabase: Client;
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

/*
  supabase is accepted through an unconstrained generic and narrowed with a
  single `as` assertion, rather than typed as DashboardTaskLoaderClient
  directly: this repo's real Supabase client has no Database schema
  generic, which makes its query-builder methods (particularly `.eq()`)
  resolve to a very deep type. Comparing that real type structurally
  against any interface that also declares an `eq` member overflows
  TypeScript's type-instantiation depth limit at real call sites (verified
  directly against this exact loader). An unconstrained generic parameter
  has nothing concrete to structurally compare at the call boundary, so
  both the real client and test fakes are accepted, while the query below
  is still fully type-checked against the precise DashboardTaskLoaderClient
  shape once narrowed.
*/
export async function loadDashboardTasksForUser<Client>({
  supabase,
  userId,
  view,
  projectId,
}: LoadDashboardTasksInput<Client>): Promise<DashboardTaskRow[]> {
  const client = supabase as DashboardTaskLoaderClient;

  let query = client.from("tasks").select(dashboardTaskSelect).eq(
    "user_id",
    userId
  );

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
    throw new Error(getQueryErrorMessage(error, "Failed to load dashboard tasks."));
  }

  return (data ?? []).map(cleanDashboardTaskRow);
}

function cleanDashboardTaskRow(task: JoinedDashboardTaskRow): DashboardTaskRow {
  const taskWithRelations = {
    ...task,
    client: normalizeEmbeddedRelation(task.clients),
    project: normalizeEmbeddedRelation(task.projects),
  };

  const { clients, projects, ...cleanTask } = taskWithRelations;

  return cleanTask;
}
