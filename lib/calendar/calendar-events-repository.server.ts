import { parseDateOnly } from "@/lib/tasks/date-only";
import { normalizeDatabaseTimeOnly } from "@/lib/calendar/time-only";
import { normalizeEmbeddedRelation } from "@/lib/supabase/joined-row";
import { validateCalendarEventLinks } from "@/lib/calendar/calendar-link-validation.server";
import type {
  CreateCalendarEventInput,
  ManualCalendarEventItem,
  UpdateCalendarEventInput,
} from "@/lib/calendar/calendar-types";

/**
 * Minimal structural shape of the Supabase/Postgrest query chain this
 * repository actually calls, covering both the real Supabase client and
 * small test fakes -- matching the established pattern in
 * lib/tasks/load-dashboard-tasks.server.ts and lib/supabase/query-builder-like.ts.
 * This repo's real Supabase client has no `Database` schema generic, so its
 * `.eq()`/`.update()` etc. carry a very deep inferred type; comparing that
 * directly against any interface that also declares those members overflows
 * TypeScript's structural-assignability depth limit. Every exported
 * function below therefore accepts `supabase` through an unconstrained
 * generic parameter and narrows it with one `as` assertion at the point of
 * use, rather than typing the parameter as this interface directly.
 */
type CalendarQueryResult = {
  data: Record<string, unknown>[] | null;
  error: unknown;
};

type CalendarSingleResult = {
  data: Record<string, unknown> | null;
  error: unknown;
};

interface CalendarFilterChain extends PromiseLike<CalendarQueryResult> {
  eq(column: string, value: unknown): this;
  is(column: string, value: unknown): this;
  select(columns: string): this;
  single(): PromiseLike<CalendarSingleResult>;
}

export type CalendarSupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => CalendarFilterChain;
    insert: (row: Record<string, unknown>) => CalendarFilterChain;
    update: (row: Record<string, unknown>) => CalendarFilterChain;
  };
};

export type CalendarEventRepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export const CALENDAR_EVENT_SELECT = `
  id,
  title,
  event_date,
  event_time,
  notes,
  project_id,
  custom_project_name,
  client_id,
  custom_client_name,
  deleted_at,
  projects:projects ( id, title ),
  clients:clients ( id, name )
`;

type ProjectRelationRow = { id: string; title: string | null };
type ClientRelationRow = { id: string; name: string | null };

export type CalendarEventRelationRow = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  notes: string | null;
  project_id: string | null;
  custom_project_name: string | null;
  client_id: string | null;
  custom_client_name: string | null;
  projects?: ProjectRelationRow | ProjectRelationRow[] | null;
  clients?: ClientRelationRow | ClientRelationRow[] | null;
};

/**
 * Turns one raw `calendar_events` row (with its embedded project/client
 * relations) into the normalized `ManualCalendarEventItem` shape returned
 * to callers. Returns `null` (the whole row is rejected/omitted) for a row
 * whose `event_date` doesn't parse as a valid `DateOnly`, or whose
 * `event_time` is present but doesn't normalize to a valid `TimeOnly` --
 * both should be unreachable given the columns are `date not null` /
 * constrained to minute precision and every write path goes through the
 * same validated types, but a raw database row is never trusted blindly
 * (matches the fail-safe convention already established in
 * lib/project-updates/v2/project-update-facts.server.ts). A malformed
 * `event_time` is deliberately NOT reinterpreted as an all-day event --
 * that would silently change what the row means; rejecting the whole row
 * is the safe failure mode.
 */
export function normalizeCalendarEventRow(
  row: CalendarEventRelationRow
): ManualCalendarEventItem | null {
  const date = parseDateOnly(row.event_date);
  if (!date) return null;

  let time: ManualCalendarEventItem["time"] = null;

  if (row.event_time !== null) {
    const normalizedTime = normalizeDatabaseTimeOnly(row.event_time);
    if (!normalizedTime) return null;
    time = normalizedTime;
  }

  const project = normalizeEmbeddedRelation(row.projects);
  const client = normalizeEmbeddedRelation(row.clients);

  return {
    kind: "manual_event",
    id: `event:${row.id}`,
    date,
    time,
    title: row.title,
    notes: row.notes,
    projectId: row.project_id,
    customProjectName: row.custom_project_name,
    projectTitle: project?.title ?? row.custom_project_name ?? null,
    clientId: row.client_id,
    customClientName: row.custom_client_name,
    clientName: client?.name ?? row.custom_client_name ?? null,
  };
}

function toSingleErrorResult<T>(
  status: number,
  error: string
): CalendarEventRepositoryResult<T> {
  return { ok: false, status, error };
}

export async function createCalendarEvent<Client>({
  supabase,
  userId,
  input,
}: {
  supabase: Client;
  userId: string;
  input: CreateCalendarEventInput;
}): Promise<CalendarEventRepositoryResult<ManualCalendarEventItem>> {
  const client = supabase as CalendarSupabaseLikeClient;

  const linkResult = await validateCalendarEventLinks({
    supabase,
    userId,
    projectId: input.projectId,
    customProjectName: input.customProjectName,
    clientId: input.clientId,
    customClientName: input.customClientName,
  });

  if (!linkResult.ok) {
    return linkResult;
  }

  const { data, error } = await client
    .from("calendar_events")
    .insert({
      user_id: userId,
      title: input.title,
      event_date: input.eventDate,
      event_time: input.eventTime,
      notes: input.notes,
      project_id: linkResult.projectId,
      custom_project_name: linkResult.customProjectName,
      client_id: linkResult.clientId,
      custom_client_name: linkResult.customClientName,
    })
    .select(CALENDAR_EVENT_SELECT)
    .single();

  if (error || !data) {
    return toSingleErrorResult(500, "Could not create the calendar event.");
  }

  const normalized = normalizeCalendarEventRow(data as CalendarEventRelationRow);

  if (!normalized) {
    return toSingleErrorResult(
      500,
      "The saved event could not be read back correctly."
    );
  }

  return { ok: true, data: normalized };
}

export async function updateCalendarEvent<Client>({
  supabase,
  userId,
  eventId,
  input,
}: {
  supabase: Client;
  userId: string;
  eventId: string;
  input: UpdateCalendarEventInput;
}): Promise<CalendarEventRepositoryResult<ManualCalendarEventItem>> {
  const client = supabase as CalendarSupabaseLikeClient;

  const { data: existingRaw, error: loadError } = await client
    .from("calendar_events")
    .select("id, project_id, custom_project_name, client_id, custom_client_name, deleted_at")
    .eq("id", eventId)
    .eq("user_id", userId)
    .single();

  if (loadError || !existingRaw) {
    return toSingleErrorResult(404, "Calendar event not found.");
  }

  const existing = existingRaw as {
    id: string;
    project_id: string | null;
    custom_project_name: string | null;
    client_id: string | null;
    custom_client_name: string | null;
    deleted_at: string | null;
  };

  if (existing.deleted_at !== null) {
    return toSingleErrorResult(404, "Calendar event not found.");
  }

  // Only re-validate/re-derive the relationship fields when the patch
  // actually touches at least one of the four -- fields left untouched keep
  // their already-valid existing value, and the write payload below never
  // includes any of the four columns at all in that case. The database
  // trigger (enforce_calendar_event_relationship_integrity) mirrors this
  // exactly: it only re-validates/re-normalizes when project_id or
  // client_id is actually changing, so an update that never sets those
  // columns leaves the row's relationship (including both custom names)
  // untouched at both layers -- neither layer will silently rewrite
  // client_id just because the linked project's own client changed since
  // this event was created.
  let projectIdForWrite = existing.project_id;
  let customProjectNameForWrite = existing.custom_project_name;
  let clientIdForWrite = existing.client_id;
  let customClientNameForWrite = existing.custom_client_name;

  const touchesRelationship =
    "projectId" in input ||
    "customProjectName" in input ||
    "clientId" in input ||
    "customClientName" in input;

  if (touchesRelationship) {
    const nextProjectId = "projectId" in input ? input.projectId! : existing.project_id;
    const nextCustomProjectName =
      "customProjectName" in input ? input.customProjectName! : existing.custom_project_name;
    const nextClientId = "clientId" in input ? input.clientId! : existing.client_id;
    const nextCustomClientName =
      "customClientName" in input ? input.customClientName! : existing.custom_client_name;

    const linkResult = await validateCalendarEventLinks({
      supabase,
      userId,
      projectId: nextProjectId,
      customProjectName: nextCustomProjectName,
      clientId: nextClientId,
      customClientName: nextCustomClientName,
    });

    if (!linkResult.ok) {
      return linkResult;
    }

    projectIdForWrite = linkResult.projectId;
    customProjectNameForWrite = linkResult.customProjectName;
    clientIdForWrite = linkResult.clientId;
    customClientNameForWrite = linkResult.customClientName;
  }

  const updates: Record<string, unknown> = {};

  if ("title" in input) updates.title = input.title;
  if ("eventDate" in input) updates.event_date = input.eventDate;
  if ("eventTime" in input) updates.event_time = input.eventTime;
  if ("notes" in input) updates.notes = input.notes;
  if (touchesRelationship) {
    updates.project_id = projectIdForWrite;
    updates.custom_project_name = customProjectNameForWrite;
    updates.client_id = clientIdForWrite;
    updates.custom_client_name = customClientNameForWrite;
  }

  const { data, error } = await client
    .from("calendar_events")
    .update(updates)
    .eq("id", eventId)
    .eq("user_id", userId)
    .select(CALENDAR_EVENT_SELECT)
    .single();

  if (error || !data) {
    return toSingleErrorResult(500, "Could not update the calendar event.");
  }

  const normalized = normalizeCalendarEventRow(data as CalendarEventRelationRow);

  if (!normalized) {
    return toSingleErrorResult(
      500,
      "The updated event could not be read back correctly."
    );
  }

  return { ok: true, data: normalized };
}

export type SoftDeleteCalendarEventResult = CalendarEventRepositoryResult<{
  id: string;
  alreadyDeleted: boolean;
}>;

export async function softDeleteCalendarEvent<Client>({
  supabase,
  userId,
  eventId,
}: {
  supabase: Client;
  userId: string;
  eventId: string;
}): Promise<SoftDeleteCalendarEventResult> {
  const client = supabase as CalendarSupabaseLikeClient;

  const { data: existingRaw, error: loadError } = await client
    .from("calendar_events")
    .select("id, deleted_at")
    .eq("id", eventId)
    .eq("user_id", userId)
    .single();

  if (loadError || !existingRaw) {
    return toSingleErrorResult(404, "Calendar event not found.");
  }

  const existing = existingRaw as { id: string; deleted_at: string | null };

  if (existing.deleted_at !== null) {
    // Idempotent: deleting an already-deleted, owned event is a successful
    // no-op, not an error -- a retried DELETE request must not fail.
    return { ok: true, data: { id: existing.id, alreadyDeleted: true } };
  }

  const { error: updateError } = await client
    .from("calendar_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("user_id", userId);

  if (updateError) {
    return toSingleErrorResult(500, "Could not delete the calendar event.");
  }

  return { ok: true, data: { id: existing.id, alreadyDeleted: false } };
}
