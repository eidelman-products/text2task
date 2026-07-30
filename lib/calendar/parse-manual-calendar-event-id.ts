/**
 * Fail-closed parser for a `ManualCalendarEventItem["id"]`
 * (lib/calendar/calendar-types.ts) into the bare UUID the write API
 * (`PATCH`/`DELETE /api/calendar/events/[id]`) expects.
 *
 * A manual event's id is always the exact string `event:<uuid>` -- never
 * `project:<uuid>` (that's a `ProjectDeadlineCalendarItem`), never a
 * differently-cased or malformed variant. This is the ONLY place in the
 * codebase permitted to turn one into the other; nowhere else may use
 * `.replace("event:", "")`/`.slice(6)`/other unvalidated string
 * manipulation to derive the UUID a PATCH/DELETE request needs.
 */

const MANUAL_EVENT_ID_PATTERN =
  /^event:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Returns the bare UUID for a valid `event:<uuid>` id, or `null` for
 * anything else -- missing/wrong prefix, wrong casing, whitespace variants,
 * a malformed/truncated UUID, an empty string, or extra prefix/suffix
 * content. Never throws.
 */
export function parseManualCalendarEventId(itemId: string): string | null {
  if (typeof itemId !== "string") return null;
  if (!MANUAL_EVENT_ID_PATTERN.test(itemId)) return null;

  return itemId.slice("event:".length);
}
