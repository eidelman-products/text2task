import type {
  CreateCalendarEventInput,
  ManualCalendarEventItem,
  UpdateCalendarEventInput,
} from "@/lib/calendar/calendar-types";
import { narrowManualCalendarEventItem } from "@/lib/calendar/load-calendar-range.client";
import { parseManualCalendarEventId } from "@/lib/calendar/parse-manual-calendar-event-id";

/**
 * Pure client network boundary for Manual Event mutations -- POST/PATCH/
 * DELETE against the existing, unchanged write API. Owns exactly: route
 * construction, `parseManualCalendarEventId` use for PATCH/DELETE, `fetch`,
 * JSON/HTTP failure handling, response-shape validation, and normalized
 * success/error results.
 *
 * No React imports, no refs, no Calendar ranges, no Calendar state, no
 * `calendarDataVersionRef`, no reconciliation logic, no Supabase imports --
 * a caller (Phase D's `WorkCalendarClient`, not built in this phase) is
 * responsible for everything downstream of a settled result here.
 */

export type MutateCalendarEventResult =
  | { ok: true; item: ManualCalendarEventItem }
  | { ok: false; error: string };

export type DeleteCalendarEventResult =
  | { ok: true; alreadyDeleted: boolean }
  | { ok: false; error: string };

const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";
const UNEXPECTED_RESPONSE_ERROR = "The server returned an unexpected response.";
const SERVER_ERROR = "Something went wrong while saving. Please try again.";
const GENERIC_REQUEST_ERROR = "The request could not be completed.";
const INVALID_ID_ERROR = "This calendar event's id is invalid.";

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readBodyError(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>).error;
  return typeof value === "string" ? value : null;
}

/**
 * Derives a safe, user-facing error message for a non-2xx response. Below
 * 500, the server's own `error` string is already a deliberately-designed,
 * user-facing message (confirmed by direct reading of every Manual Event
 * route handler, e.g. "Linked project not found.") -- safe to surface
 * as-is. At 500, those same route handlers fall back to
 * `error instanceof Error ? error.message : ...`, which can leak a raw
 * exception message -- never surfaced to the user; one fixed generic
 * message is used instead, regardless of what the body actually contains.
 */
function safeErrorForResponse(status: number, body: unknown): string {
  if (status >= 500) return SERVER_ERROR;
  return readBodyError(body) ?? GENERIC_REQUEST_ERROR;
}

async function performEventWriteRequest(
  url: string,
  method: "POST" | "PATCH",
  body: unknown
): Promise<MutateCalendarEventResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  const parsedBody = await readJsonBody(response);

  if (!response.ok) {
    return { ok: false, error: safeErrorForResponse(response.status, parsedBody) };
  }

  if (
    typeof parsedBody !== "object" ||
    parsedBody === null ||
    (parsedBody as Record<string, unknown>).success !== true
  ) {
    return { ok: false, error: UNEXPECTED_RESPONSE_ERROR };
  }

  const item = narrowManualCalendarEventItem((parsedBody as Record<string, unknown>).item);
  if (!item) {
    return { ok: false, error: UNEXPECTED_RESPONSE_ERROR };
  }

  return { ok: true, item };
}

/** `POST /api/calendar/events` -- create a new Manual Event. */
export async function createCalendarEventClient(
  input: CreateCalendarEventInput
): Promise<MutateCalendarEventResult> {
  return performEventWriteRequest("/api/calendar/events", "POST", input);
}

/**
 * `PATCH /api/calendar/events/[uuid]` -- update an existing Manual Event.
 * `itemId` is the item's full `event:<uuid>` id; resolved to the bare UUID
 * via `parseManualCalendarEventId`, which fails closed (no request sent)
 * for a malformed id.
 */
export async function updateCalendarEventClient(
  itemId: string,
  input: UpdateCalendarEventInput
): Promise<MutateCalendarEventResult> {
  const eventUuid = parseManualCalendarEventId(itemId);
  if (!eventUuid) {
    return { ok: false, error: INVALID_ID_ERROR };
  }

  return performEventWriteRequest(`/api/calendar/events/${eventUuid}`, "PATCH", input);
}

/**
 * `DELETE /api/calendar/events/[uuid]`. Both `{alreadyDeleted: false}`
 * (this call performed the soft-delete) and `{alreadyDeleted: true}`
 * (already soft-deleted, e.g. by another tab) are successful results --
 * the caller must not treat one as more "successful" than the other.
 */
export async function deleteCalendarEventClient(
  itemId: string
): Promise<DeleteCalendarEventResult> {
  const eventUuid = parseManualCalendarEventId(itemId);
  if (!eventUuid) {
    return { ok: false, error: INVALID_ID_ERROR };
  }

  let response: Response;
  try {
    response = await fetch(`/api/calendar/events/${eventUuid}`, { method: "DELETE" });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  const parsedBody = await readJsonBody(response);

  if (!response.ok) {
    return { ok: false, error: safeErrorForResponse(response.status, parsedBody) };
  }

  if (
    typeof parsedBody !== "object" ||
    parsedBody === null ||
    (parsedBody as Record<string, unknown>).success !== true ||
    typeof (parsedBody as Record<string, unknown>).alreadyDeleted !== "boolean"
  ) {
    return { ok: false, error: UNEXPECTED_RESPONSE_ERROR };
  }

  return {
    ok: true,
    alreadyDeleted: (parsedBody as Record<string, unknown>).alreadyDeleted as boolean,
  };
}
