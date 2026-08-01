import { isCalendarAbortError } from "@/lib/calendar/load-calendar-range.client";
import type {
  CalendarClientOption,
  CalendarOptionsResult,
  CalendarProjectOption,
} from "@/lib/calendar/calendar-types";

/**
 * Client-side fetch + response validation for `GET /api/calendar/options`.
 *
 * A pure network boundary -- no React imports, no Calendar/dialog state, no
 * refs, no Supabase imports. It knows only this one route, defensively
 * narrows the full response shape (never trusting arbitrary JSON), and
 * treats an expected request cancellation as a resolved `null`, exactly
 * mirroring `loadCalendarRangeClient`'s own convention (reusing its
 * `isCalendarAbortError` check rather than re-deriving it).
 */

export type LoadCalendarOptionsClientParams = {
  includeProjectId?: string | null;
  includeClientId?: string | null;
  signal?: AbortSignal;
};

export type LoadCalendarOptionsClientResult =
  | { ok: true; result: CalendarOptionsResult }
  | { ok: false; error: string };

const GENERIC_ERROR = "Could not load project and client options.";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function narrowProjectOption(value: unknown): CalendarProjectOption | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (!isNonEmptyString(raw.id)) return null;
  if (!isNonEmptyString(raw.title)) return null;
  if (!isNullableString(raw.clientId)) return null;
  if (!isNullableString(raw.clientName)) return null;
  if (typeof raw.isArchived !== "boolean") return null;

  return {
    id: raw.id,
    title: raw.title,
    clientId: raw.clientId,
    clientName: raw.clientName,
    isArchived: raw.isArchived,
  };
}

function narrowClientOption(value: unknown): CalendarClientOption | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (!isNonEmptyString(raw.id)) return null;
  if (!isNonEmptyString(raw.name)) return null;

  return { id: raw.id, name: raw.name };
}

/**
 * Narrows a full `{success, projects, clients, projectsTruncated,
 * clientsTruncated}` response. Unlike `GET /api/calendar`'s per-item
 * drop-on-malformed convention, a single malformed project/client entry
 * here rejects the WHOLE response (fail closed) rather than silently
 * shipping a partial options list -- this is a small, bounded, server-
 * controlled response where a malformed entry indicates a real contract
 * violation, not a normal "one bad row among many" case. Both truncation
 * flags are required booleans; truncation is never inferred from array
 * length alone.
 */
function narrowCalendarOptionsResult(value: unknown): CalendarOptionsResult | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (raw.success !== true) return null;
  if (!Array.isArray(raw.projects)) return null;
  if (!Array.isArray(raw.clients)) return null;
  if (typeof raw.projectsTruncated !== "boolean") return null;
  if (typeof raw.clientsTruncated !== "boolean") return null;

  const projects: CalendarProjectOption[] = [];
  for (const rawProject of raw.projects) {
    const project = narrowProjectOption(rawProject);
    if (!project) return null;
    projects.push(project);
  }

  const clients: CalendarClientOption[] = [];
  for (const rawClient of raw.clients) {
    const client = narrowClientOption(rawClient);
    if (!client) return null;
    clients.push(client);
  }

  return {
    projects,
    clients,
    projectsTruncated: raw.projectsTruncated,
    clientsTruncated: raw.clientsTruncated,
  };
}

/**
 * Fetches and validates the Calendar options list. `signal` is optional --
 * pass an `AbortController`'s signal to allow cancellation. An expected
 * cancellation resolves to `null` (never thrown/rejected past this
 * function's own boundary), exactly like `loadCalendarRangeClient`. Genuine
 * failures (network, malformed response, HTTP failure) resolve to
 * `{ok: false, error}` with one stable, generic user-facing message -- the
 * server's own error text (which can include a raw exception message at
 * 500) is never surfaced.
 */
export async function loadCalendarOptionsClient({
  includeProjectId,
  includeClientId,
  signal,
}: LoadCalendarOptionsClientParams): Promise<LoadCalendarOptionsClientResult | null> {
  const params = new URLSearchParams();
  if (includeProjectId) params.set("includeProjectId", includeProjectId);
  if (includeClientId) params.set("includeClientId", includeClientId);
  const query = params.toString();
  const url = query.length > 0 ? `/api/calendar/options?${query}` : "/api/calendar/options";

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal });
  } catch (error) {
    if (isCalendarAbortError(error)) return null;
    return { ok: false, error: GENERIC_ERROR };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (isCalendarAbortError(error)) return null;
    return { ok: false, error: GENERIC_ERROR };
  }

  if (!response.ok) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const result = narrowCalendarOptionsResult(body);
  if (!result) {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true, result };
}
