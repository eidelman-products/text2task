import type { UnscheduledProjectCalendarItem } from "@/lib/calendar/calendar-types";

/**
 * Matches the generic-client pattern documented in
 * load-calendar-range.server.ts / lib/supabase/query-builder-like.ts.
 */
type CalendarQueryResult = {
  data: Record<string, unknown>[] | null;
  error: unknown;
};

interface UnscheduledFilterChain extends PromiseLike<CalendarQueryResult> {
  eq(column: string, value: unknown): this;
  is(column: string, value: unknown): this;
  or(filters: string): this;
  order(column: string, options?: { ascending?: boolean }): this;
  limit(count: number): this;
}

type LoadUnscheduledProjectsSupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => UnscheduledFilterChain;
  };
};

export type LoadUnscheduledProjectsResult =
  | { ok: true; items: UnscheduledProjectCalendarItem[] }
  | { ok: false; status: number; error: string };

const UNSCHEDULED_PROJECT_SELECT = `
  id,
  title,
  status,
  priority,
  client_name,
  created_at
`;

type UnscheduledProjectRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  client_name: string | null;
  created_at: string | null;
};

function normalizeUnscheduledProjectRow(
  row: UnscheduledProjectRow
): UnscheduledProjectCalendarItem {
  return {
    id: row.id,
    title: row.title ?? "Untitled project",
    clientName: row.client_name,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at ?? "",
  };
}

const DEFAULT_UNSCHEDULED_PROJECT_LIMIT = 50;

/**
 * Active (non-archived, non-deleted), non-Done projects with no deadline
 * set, for the Unscheduled Projects panel -- per
 * docs/TEXT2TASK_WORK_CALENDAR_MAPPING.md section 18 / the locked
 * architecture decisions for this milestone. A Done project with no
 * deadline is intentionally excluded: a finished project doesn't need to
 * keep prompting the user to schedule work it will never do.
 */
export async function loadUnscheduledProjects<Client>({
  supabase,
  userId,
  limit = DEFAULT_UNSCHEDULED_PROJECT_LIMIT,
}: {
  supabase: Client;
  userId: string;
  limit?: number;
}): Promise<LoadUnscheduledProjectsResult> {
  const client = supabase as LoadUnscheduledProjectsSupabaseLikeClient;

  // `.neq("status", "Done")` would silently drop projects with no status set
  // at all: in SQL three-valued logic, `NULL <> 'Done'` evaluates to NULL,
  // not true, so a plain `.neq()` excludes NULL-status rows from a WHERE
  // clause. A brand-new project with no status yet is exactly the kind of
  // row this panel exists to surface, so "not Done" is expressed as an
  // explicit not-Done-or-null OR, mirroring the same is_archived pattern
  // above rather than a bare `.neq()`.
  const { data, error } = await client
    .from("projects")
    .select(UNSCHEDULED_PROJECT_SELECT)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or("is_archived.eq.false,is_archived.is.null")
    .is("deadline_date", null)
    .or("status.neq.Done,status.is.null")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, status: 500, error: "Could not load unscheduled projects." };
  }

  return {
    ok: true,
    items: ((data ?? []) as UnscheduledProjectRow[]).map(normalizeUnscheduledProjectRow),
  };
}
