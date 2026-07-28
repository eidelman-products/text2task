import { parseDateOnly } from "@/lib/tasks/date-only";
import { getDeadlineUi } from "@/lib/tasks/get-deadline-ui";
import {
  CALENDAR_EVENT_SELECT,
  normalizeCalendarEventRow,
  type CalendarEventRelationRow,
} from "@/lib/calendar/calendar-events-repository.server";
import type { CalendarItem, CalendarRangeQuery, ProjectDeadlineCalendarItem } from "@/lib/calendar/calendar-types";

/**
 * Server-only Work Calendar read model: merges project deadlines (a
 * read-time projection of `projects.deadline_date` -- never persisted or
 * duplicated) with persisted `calendar_events` rows into one sorted
 * `CalendarItem[]`. This is the only place these two sources are combined;
 * no UI component queries Supabase directly.
 *
 * Matches lib/supabase/query-builder-like.ts's documented pattern: the real
 * Supabase client has no `Database` schema generic, so its query-builder
 * methods carry a very deep inferred type that overflows TypeScript's
 * structural-assignability depth limit when compared directly against a
 * named interface. `supabase` is accepted through an unconstrained generic
 * and narrowed with one `as` assertion per query.
 */
type CalendarQueryResult = {
  data: Record<string, unknown>[] | null;
  error: unknown;
};

interface RangeFilterChain extends PromiseLike<CalendarQueryResult> {
  eq(column: string, value: unknown): this;
  is(column: string, value: unknown): this;
  or(filters: string): this;
  gte(column: string, value: unknown): this;
  lte(column: string, value: unknown): this;
}

type LoadCalendarRangeSupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => RangeFilterChain;
  };
};

export type LoadCalendarRangeResult =
  | { ok: true; items: CalendarItem[] }
  | { ok: false; status: number; error: string };

const PROJECT_DEADLINE_SELECT = `
  id,
  title,
  status,
  priority,
  deadline_text,
  deadline_date,
  client_name
`;

type ProjectDeadlineRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  deadline_text: string | null;
  deadline_date: string | null;
  client_name: string | null;
};

/**
 * Returns `null` for a row whose `deadline_date` doesn't parse -- should be
 * unreachable given the query itself filters on a non-null range, but a raw
 * database row is never trusted blindly (see the identical reasoning in
 * calendar-events-repository.server.ts's normalizeCalendarEventRow).
 */
function normalizeProjectDeadlineRow(
  row: ProjectDeadlineRow
): ProjectDeadlineCalendarItem | null {
  const date = parseDateOnly(row.deadline_date);
  if (!date) return null;

  // Overdue classification is reused verbatim from getDeadlineUi -- never
  // reimplemented here (see lib/tasks/get-deadline-ui.ts, already
  // timezone-safe and already the single source of truth for this
  // classification everywhere else project deadlines are displayed).
  const deadlineUi = getDeadlineUi(row.deadline_text, row.deadline_date, row.status);

  return {
    kind: "project_deadline",
    id: `project:${row.id}`,
    date,
    projectId: row.id,
    title: row.title ?? "Untitled project",
    clientName: row.client_name,
    status: row.status,
    priority: row.priority,
    isOverdue: deadlineUi.isOverdue,
  };
}

export async function loadCalendarRange<Client>({
  supabase,
  userId,
  range,
}: {
  supabase: Client;
  userId: string;
  range: CalendarRangeQuery;
}): Promise<LoadCalendarRangeResult> {
  const client = supabase as LoadCalendarRangeSupabaseLikeClient;

  // Project deadlines: active (non-archived, non-deleted) projects only,
  // per docs/TEXT2TASK_WORK_CALENDAR_MAPPING.md section 6 / the locked
  // architecture decisions for this milestone. Done projects WITH a
  // deadline are still included (a future UI can de-emphasize them) -- the
  // gte/lte range comparison against deadline_date already excludes
  // no-deadline rows on its own (NULL compared to anything is never true
  // in SQL), so no separate `not null` filter is needed.
  const { data: projectRows, error: projectsError } = await client
    .from("projects")
    .select(PROJECT_DEADLINE_SELECT)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or("is_archived.eq.false,is_archived.is.null")
    .gte("deadline_date", range.start)
    .lte("deadline_date", range.end);

  if (projectsError) {
    return { ok: false, status: 500, error: "Could not load project deadlines." };
  }

  const { data: eventRows, error: eventsError } = await client
    .from("calendar_events")
    .select(CALENDAR_EVENT_SELECT)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("event_date", range.start)
    .lte("event_date", range.end);

  if (eventsError) {
    return { ok: false, status: 500, error: "Could not load calendar events." };
  }

  const projectItems = ((projectRows ?? []) as ProjectDeadlineRow[])
    .map(normalizeProjectDeadlineRow)
    .filter((item): item is ProjectDeadlineCalendarItem => item !== null);

  const eventItems = ((eventRows ?? []) as CalendarEventRelationRow[])
    .map(normalizeCalendarEventRow)
    .filter((item): item is NonNullable<ReturnType<typeof normalizeCalendarEventRow>> => item !== null);

  return {
    ok: true,
    items: [...projectItems, ...eventItems],
  };
}
