import type { CalendarItem } from "@/lib/calendar/calendar-types";
import type { TimeOnly } from "@/lib/calendar/time-only";

/**
 * Deterministic within-day ordering for calendar items:
 *
 *   1. All-day items first -- every `ProjectDeadlineCalendarItem` (deadlines
 *      have no time-of-day concept at all) plus any `ManualCalendarEventItem`
 *      with `time === null`.
 *   2. Timed `ManualCalendarEventItem`s next, ascending by `time`.
 *   3. Within either group, items that are otherwise unordered (all-day vs.
 *      all-day, or same-time timed vs. timed) fall back to a fixed tiebreak:
 *      `title` (case-sensitive, matching this repo's plain string ordering
 *      elsewhere, e.g. `compareDateOnly`), then `id` as a final tiebreak so
 *      the result is fully deterministic even for two items with an
 *      identical title.
 *
 * Product only mandates step 1 and 2; step 3 exists purely so repeated sorts
 * of the same input are byte-for-byte identical (testable, and required for
 * a stable calendar UI that shouldn't reshuffle items on every re-render).
 */
function isAllDay(item: CalendarItem): boolean {
  return item.kind === "project_deadline" || item.time === null;
}

function timeOf(item: CalendarItem): TimeOnly | null {
  return item.kind === "manual_event" ? item.time : null;
}

function compareByTitleThenId(a: CalendarItem, b: CalendarItem): number {
  if (a.title !== b.title) return a.title < b.title ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function compareCalendarItemsForDay(a: CalendarItem, b: CalendarItem): number {
  const aAllDay = isAllDay(a);
  const bAllDay = isAllDay(b);

  if (aAllDay !== bAllDay) return aAllDay ? -1 : 1;

  if (!aAllDay) {
    const aTime = timeOf(a);
    const bTime = timeOf(b);

    // `!aAllDay` guarantees both `a` and `b` are `ManualCalendarEventItem`s
    // with a non-null `time` here, per `isAllDay`'s definition above.
    if (aTime !== null && bTime !== null && aTime !== bTime) {
      // `TimeOnly` is always zero-padded `HH:MM`, so `<`/`>` on the string
      // is equivalent to numeric time-of-day comparison; the comparison is
      // still spelled out explicitly (rather than leaning on
      // `Array.prototype.sort`'s default coercion-to-string behavior, which
      // would be correct here only by accident) so the ordering is provably
      // intentional and safe to rely on.
      return aTime < bTime ? -1 : 1;
    }
  }

  return compareByTitleThenId(a, b);
}

/**
 * Sorts `items` (assumed to already all fall on the same calendar day) into
 * the deterministic display order documented above. Pure: does not mutate
 * `items`, and produces identical output for identical input on every call.
 */
export function sortCalendarItemsForDay(items: readonly CalendarItem[]): CalendarItem[] {
  return [...items].sort(compareCalendarItemsForDay);
}
