import { parseDateOnly } from "@/lib/tasks/date-only";
import { parseTimeOnly } from "@/lib/calendar/time-only";
import type { CalendarItem, CalendarRangeQuery } from "@/lib/calendar/calendar-types";

/**
 * Client-side fetch + response validation for `GET /api/calendar`.
 *
 * The API route already returns a well-typed `CalendarItem[]`, but the
 * client must never trust arbitrary JSON as that type -- a network
 * intermediary, an old cached response, or a future server change could all
 * hand this function something malformed. Every item is individually
 * narrowed field-by-field; a malformed item is dropped (fail-closed) rather
 * than causing the whole request to fail or an invalid value to render.
 */

export type LoadCalendarRangeClientResult =
  | { ok: true; items: CalendarItem[] }
  | { ok: false; error: string };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function narrowProjectDeadlineItem(raw: Record<string, unknown>): CalendarItem | null {
  const date = parseDateOnly(raw.date);
  if (!date) return null;
  if (!isNonEmptyString(raw.id)) return null;
  if (!isNonEmptyString(raw.projectId)) return null;
  if (!isNonEmptyString(raw.title)) return null;
  if (!isNullableString(raw.clientName)) return null;
  if (!isNullableString(raw.status)) return null;
  if (!isNullableString(raw.priority)) return null;
  if (typeof raw.isOverdue !== "boolean") return null;

  return {
    kind: "project_deadline",
    id: raw.id,
    date,
    projectId: raw.projectId,
    title: raw.title,
    clientName: raw.clientName,
    status: raw.status,
    priority: raw.priority,
    isOverdue: raw.isOverdue,
  };
}

function narrowManualEventItem(raw: Record<string, unknown>): CalendarItem | null {
  const date = parseDateOnly(raw.date);
  if (!date) return null;
  if (!isNonEmptyString(raw.id)) return null;
  if (!isNonEmptyString(raw.title)) return null;
  if (!isNullableString(raw.notes)) return null;
  if (!isNullableString(raw.projectId)) return null;
  if (!isNullableString(raw.projectTitle)) return null;
  if (!isNullableString(raw.clientId)) return null;
  if (!isNullableString(raw.clientName)) return null;

  // A null time is a valid all-day event; a non-null time must parse as a
  // real TimeOnly -- an invalid non-null time rejects the whole item rather
  // than silently coercing it to all-day.
  let time = null;
  if (raw.time !== null) {
    const parsedTime = parseTimeOnly(raw.time);
    if (!parsedTime) return null;
    time = parsedTime;
  }

  return {
    kind: "manual_event",
    id: raw.id,
    date,
    time,
    title: raw.title,
    notes: raw.notes,
    projectId: raw.projectId,
    projectTitle: raw.projectTitle,
    clientId: raw.clientId,
    clientName: raw.clientName,
  };
}

function narrowCalendarItem(value: unknown): CalendarItem | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (raw.kind === "project_deadline") return narrowProjectDeadlineItem(raw);
  if (raw.kind === "manual_event") return narrowManualEventItem(raw);
  return null;
}

/**
 * True for an expected request cancellation (navigating away, superseding
 * one month's request with another, or an explicit unmount). Checks both
 * `DOMException` (the spec-correct shape real browser/Node fetch rejects
 * with) and a plain `Error` with the same `name` (a narrow fallback for
 * fetch polyfills/test environments that don't throw a real `DOMException`
 * instance) -- the same two-branch check this codebase already established
 * in `HomepageLiveDemoClient.tsx`'s own `isAbortError`, reused here for
 * consistency rather than re-derived narrower.
 */
export function isCalendarAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException || error instanceof Error) && error.name === "AbortError"
  );
}

/**
 * Fetches and validates one bounded range of calendar items.
 *
 * `signal` must be an `AbortController`'s signal owned by the caller so
 * navigating away mid-request can cancel it. An expected cancellation
 * resolves to `null` -- it is never thrown/rejected past this function's own
 * boundary. This is a deliberate design choice: converting "the request was
 * cancelled" into a normal resolved value (rather than a rejection the
 * caller must remember to catch-and-ignore) means an aborted request can
 * never surface as an unhandled promise rejection, regardless of how many
 * async layers or promise-chain links sit between here and the caller.
 * Genuine failures (network, malformed response, parse errors) still
 * resolve to `{ ok: false, error }`, entering the normal error UI.
 */
export async function loadCalendarRangeClient(
  range: CalendarRangeQuery,
  signal: AbortSignal
): Promise<LoadCalendarRangeClientResult | null> {
  const params = new URLSearchParams({ start: range.start, end: range.end });

  let response: Response;
  try {
    response = await fetch(`/api/calendar?${params.toString()}`, {
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (isCalendarAbortError(error)) return null;
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (isCalendarAbortError(error)) return null;
    return { ok: false, error: "The server returned an unreadable response." };
  }

  if (!response.ok) {
    const error =
      typeof body === "object" && body !== null && isNonEmptyString((body as Record<string, unknown>).error)
        ? (body as Record<string, unknown>).error
        : "Could not load calendar items.";
    return { ok: false, error: error as string };
  }

  if (
    typeof body !== "object" ||
    body === null ||
    (body as Record<string, unknown>).success !== true ||
    !Array.isArray((body as Record<string, unknown>).items)
  ) {
    return { ok: false, error: "The server returned an unexpected response." };
  }

  const items: CalendarItem[] = [];
  for (const rawItem of (body as Record<string, unknown>).items as unknown[]) {
    const item = narrowCalendarItem(rawItem);
    if (item) items.push(item);
  }

  return { ok: true, items };
}
