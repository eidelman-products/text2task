import { normalizeEmbeddedRelation } from "@/lib/supabase/joined-row";
import type {
  CalendarClientOption,
  CalendarOptionsResult,
  CalendarProjectOption,
} from "@/lib/calendar/calendar-types";

/**
 * Server-side loader for `GET /api/calendar/options`
 * (docs/TEXT2TASK_WORK_CALENDAR_MANUAL_EVENTS_MAPPING.md section 10) -- the
 * Project/Client picker option source for the Add/Edit Manual Event form.
 * No UI queries Supabase directly; this is the only place these two lists
 * are read for that picker.
 *
 * Matches the generic-client pattern already established in
 * lib/calendar/load-unscheduled-projects.server.ts /
 * lib/calendar/calendar-link-validation.server.ts: the real Supabase client
 * has no `Database` schema generic, so its query-builder methods carry a
 * very deep inferred type that overflows TypeScript's structural-
 * assignability depth limit when compared directly against a named
 * interface. `supabase` is accepted through an unconstrained generic and
 * narrowed with one `as` assertion at the point of use.
 */
type CalendarOptionsListResult = {
  data: Record<string, unknown>[] | null;
  error: unknown;
};

type CalendarOptionsSingleResult = {
  data: Record<string, unknown> | null;
  error: unknown;
};

interface CalendarOptionsFilterChain extends PromiseLike<CalendarOptionsListResult> {
  eq(column: string, value: unknown): this;
  is(column: string, value: unknown): this;
  or(filters: string): this;
  order(column: string, options?: { ascending?: boolean }): this;
  limit(count: number): this;
  single(): PromiseLike<CalendarOptionsSingleResult>;
}

type LoadCalendarOptionsSupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => CalendarOptionsFilterChain;
  };
};

export type LoadCalendarOptionsResult =
  | { ok: true; data: CalendarOptionsResult }
  | { ok: false; status: number; error: string };

/**
 * The endpoint's locked per-type cap
 * (docs/TEXT2TASK_WORK_CALENDAR_MANUAL_EVENTS_MAPPING.md section 3, Locked
 * decision 9) -- a deliberate, explicit product decision, not inherited
 * from lib/calendar/load-unscheduled-projects.server.ts's unrelated,
 * much-smaller `DEFAULT_UNSCHEDULED_PROJECT_LIMIT`.
 */
export const OPTIONS_LIMIT = 200;

const PROJECT_OPTION_SELECT = `
  id,
  title,
  is_archived,
  client_id,
  clients ( id, name )
`;

const CLIENT_OPTION_SELECT = `
  id,
  name
`;

type ClientRelationRow = { id: string; name: string | null };

type ProjectOptionRow = {
  id: string;
  title: string | null;
  is_archived: boolean | null;
  client_id: string | null;
  clients?: ClientRelationRow | ClientRelationRow[] | null;
};

type ClientOptionRow = {
  id: string;
  name: string | null;
};

/**
 * `is_archived` is only ever `true`/`false`/`null` in practice (matches the
 * same nullable-boolean convention already relied on by the
 * `is_archived.eq.false,is_archived.is.null` OR-filter used elsewhere in
 * this feature) -- `null`/anything-not-`true` normalizes to "not archived",
 * never the reverse, so a row can never be silently reported as archived
 * when it isn't.
 */
function normalizeProjectOptionRow(row: ProjectOptionRow): CalendarProjectOption {
  const client = normalizeEmbeddedRelation(row.clients);

  return {
    id: row.id,
    title: row.title ?? "Untitled project",
    clientId: row.client_id,
    clientName: client?.name ?? null,
    isArchived: row.is_archived === true,
  };
}

/**
 * Unlike a project's title (which already has an established
 * "Untitled project" display fallback elsewhere in this codebase for a
 * missing value), `CalendarClientOption.name` is a required, non-nullable
 * string with no such precedent -- fabricating a placeholder name for a
 * row whose real name is missing would present invented data as if it were
 * real in a picker the user trusts to link the correct client, so a
 * nameless row is rejected (omitted) rather than given a made-up label.
 */
function normalizeClientOptionRow(row: ClientOptionRow): CalendarClientOption | null {
  if (!row.name || row.name.trim().length === 0) return null;

  return { id: row.id, name: row.name };
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "PGRST116"
  );
}

async function loadIncludedProjectOption({
  client,
  userId,
  includeProjectId,
}: {
  client: LoadCalendarOptionsSupabaseLikeClient;
  userId: string;
  includeProjectId: string;
}): Promise<{ ok: true; option: CalendarProjectOption | null } | { ok: false; status: number; error: string }> {
  const { data, error } = await client
    .from("projects")
    .select(PROJECT_OPTION_SELECT)
    .eq("id", includeProjectId)
    .eq("user_id", userId)
    // Excludes a genuinely soft-deleted project, but deliberately does NOT
    // filter on is_archived: an event may already be linked to an archived
    // project (validateCalendarEventLinks only checks deleted_at, never
    // is_archived, docs/...MANUAL_EVENTS_MAPPING.md section 5's confirmed
    // security-posture finding), so an archived-but-linked project must
    // still be returned here, with its real isArchived value, so the
    // edit-mode picker can display and keep it selectable.
    .is("deleted_at", null)
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      // Ownership/existence failure -- owned-but-deleted, foreign, or
      // nonexistent all resolve identically here: silently omitted, never
      // surfaced as a distinguishable error (avoids leaking whether a
      // foreign id exists).
      return { ok: true, option: null };
    }

    return { ok: false, status: 500, error: "Could not load the linked project." };
  }

  if (!data) {
    return { ok: true, option: null };
  }

  return { ok: true, option: normalizeProjectOptionRow(data as ProjectOptionRow) };
}

async function loadIncludedClientOption({
  client,
  userId,
  includeClientId,
}: {
  client: LoadCalendarOptionsSupabaseLikeClient;
  userId: string;
  includeClientId: string;
}): Promise<{ ok: true; option: CalendarClientOption | null } | { ok: false; status: number; error: string }> {
  const { data, error } = await client
    .from("clients")
    .select(CLIENT_OPTION_SELECT)
    .eq("id", includeClientId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      return { ok: true, option: null };
    }

    return { ok: false, status: 500, error: "Could not load the linked client." };
  }

  if (!data) {
    return { ok: true, option: null };
  }

  const option = normalizeClientOptionRow(data as ClientOptionRow);

  return { ok: true, option };
}

/**
 * Loads the Project/Client picker options for the Add/Edit Manual Event
 * form. `includeProjectId`/`includeClientId` must already be
 * syntactically-validated UUIDs by the caller (the route handler) -- this
 * function only enforces ownership, never format.
 */
export async function loadCalendarOptions<Client>({
  supabase,
  userId,
  includeProjectId,
  includeClientId,
}: {
  supabase: Client;
  userId: string;
  includeProjectId: string | null;
  includeClientId: string | null;
}): Promise<LoadCalendarOptionsResult> {
  const client = supabase as LoadCalendarOptionsSupabaseLikeClient;

  // Requests OPTIONS_LIMIT + 1 rows so the truncation flag can be computed
  // from whether that (OPTIONS_LIMIT + 1)th row actually came back, rather
  // than from a separate, more expensive exact-COUNT query -- locked in
  // docs/TEXT2TASK_WORK_CALENDAR_MANUAL_EVENTS_MAPPING.md section 10.
  const { data: projectRows, error: projectsError } = await client
    .from("projects")
    .select(PROJECT_OPTION_SELECT)
    .eq("user_id", userId)
    .is("deleted_at", null)
    // Archived projects are excluded from *new* choices here (a UI
    // courtesy) -- an is_archived value of `null` is treated as "not
    // archived", matching the identical OR-filter convention already used
    // for this exact column in load-unscheduled-projects.server.ts /
    // load-calendar-range.server.ts (a bare `.eq("is_archived", false)`
    // would silently exclude legacy NULL rows under SQL's three-valued
    // logic).
    .or("is_archived.eq.false,is_archived.is.null")
    .order("title", { ascending: true })
    .limit(OPTIONS_LIMIT + 1);

  if (projectsError) {
    return { ok: false, status: 500, error: "Could not load project options." };
  }

  const { data: clientRows, error: clientsError } = await client
    .from("clients")
    .select(CLIENT_OPTION_SELECT)
    .eq("user_id", userId)
    // No `deleted_at`/`is_archived` filter here: no such column is known to
    // exist on `clients` anywhere in this codebase's current schema or
    // conventions (confirmed by a dedicated research pass,
    // docs/TEXT2TASK_WORK_CALENDAR_MANUAL_EVENTS_MAPPING.md section 10) --
    // inventing one would be exactly the kind of unsafe assumption this
    // implementation must avoid.
    .order("name", { ascending: true })
    .limit(OPTIONS_LIMIT + 1);

  if (clientsError) {
    return { ok: false, status: 500, error: "Could not load client options." };
  }

  const projectRowsRaw = (projectRows ?? []) as ProjectOptionRow[];
  const projectsTruncated = projectRowsRaw.length > OPTIONS_LIMIT;
  const projects = projectRowsRaw.slice(0, OPTIONS_LIMIT).map(normalizeProjectOptionRow);

  const clientRowsRaw = (clientRows ?? []) as ClientOptionRow[];
  const clientsTruncated = clientRowsRaw.length > OPTIONS_LIMIT;
  const clients = clientRowsRaw
    .slice(0, OPTIONS_LIMIT)
    .map(normalizeClientOptionRow)
    .filter((option): option is CalendarClientOption => option !== null);

  if (includeProjectId !== null) {
    const included = await loadIncludedProjectOption({ client, userId, includeProjectId });

    if (!included.ok) {
      return included;
    }

    // Appended only after the normal result was already sliced to
    // OPTIONS_LIMIT, and never alters `projectsTruncated` -- that flag
    // describes only whether the *normal* query was cut down, not whether
    // an included value happened to be added on top of an already-full
    // page.
    if (included.option && !projects.some((project) => project.id === included.option!.id)) {
      projects.push(included.option);
    }
  }

  if (includeClientId !== null) {
    const included = await loadIncludedClientOption({ client, userId, includeClientId });

    if (!included.ok) {
      return included;
    }

    if (included.option && !clients.some((clientOption) => clientOption.id === included.option!.id)) {
      clients.push(included.option);
    }
  }

  return {
    ok: true,
    data: { projects, clients, projectsTruncated, clientsTruncated },
  };
}
