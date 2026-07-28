import {
  compareDateOnly,
  dateOnlyToLocalDate,
  localDateToDateOnly,
  type DateOnly,
} from "@/lib/tasks/date-only";
import type { CalendarRangeQuery } from "@/lib/calendar/calendar-types";

/**
 * Month-view calendar grid math for Work Calendar.
 *
 * Week-start convention: **Sunday-start** (`Date.prototype.getDay()`'s own
 * 0 = Sunday indexing lines up directly with grid-column math below, and
 * Sunday-start is the more common US convention; this app has no stated
 * locale preference otherwise, so this is an explicit, documented choice
 * rather than an accidental one). If Monday-start is ever needed, only the
 * weekday-offset arithmetic below needs to change.
 *
 * A month grid always shows whole weeks, so it pads the real days of the
 * month with trailing days from the previous month (to fill the first row)
 * and leading days from the next month (to fill the last row). Depending on
 * which weekday the 1st falls on and how many days the month has, that
 * padding adds up to a 4, 5, or 6 row grid -- there is no fixed row count.
 * All boundary calculation therefore goes through real weekday math
 * (`Date#getDay()`), never a hardcoded "always 6 rows" assumption.
 */

/**
 * Every `Date` built in this module is constructed from split numeric
 * year/month/day components and anchored at local noon, matching the only
 * sanctioned `Date` construction pattern in `lib/tasks/date-only.ts` -- never
 * from a parsed string, never read back via UTC getters.
 */
function localNoon(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 12, 0, 0, 0);
}

/**
 * Computes the `{ start, end }` bounds of the visible month grid for the
 * month containing `anyDayInMonth` (any day of that month may be passed --
 * only its year/month are used). This is deliberately separate from
 * `getCalendarGridDays` so a server-side range query (see
 * `CalendarRangeQuery` in calendar-types.ts) can get the bounds it needs
 * without materializing every intermediate day.
 */
export function getCalendarGridRange(anyDayInMonth: DateOnly): CalendarRangeQuery {
  const anchor = dateOnlyToLocalDate(anyDayInMonth);
  const year = anchor.getFullYear();
  const month = anchor.getMonth(); // 0-11

  const firstOfMonth = localNoon(year, month, 1);
  const firstWeekday = firstOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
  const gridStart = localNoon(year, month, 1 - firstWeekday);

  // Day 0 of "next month" is the last real day of the target month -- a
  // standard, DST-safe way to get month length via `Date`'s own normalization
  // (still numeric-only construction, never a parsed string).
  const lastOfMonth = localNoon(year, month + 1, 0);
  const lastWeekday = lastOfMonth.getDay();
  const trailingDays = 6 - lastWeekday;
  const gridEnd = localNoon(year, month, lastOfMonth.getDate() + trailingDays);

  return {
    start: localDateToDateOnly(gridStart),
    end: localDateToDateOnly(gridEnd),
  };
}

/**
 * Materializes every `DateOnly` visible in the month grid for the month
 * containing `anyDayInMonth`, in chronological order (leading days from the
 * previous month, then the month's own days, then trailing days from the
 * next month). Always a multiple of 7 in length (28/35/42, depending on the
 * month's weekday alignment).
 */
export function getCalendarGridDays(anyDayInMonth: DateOnly): DateOnly[] {
  const { start, end } = getCalendarGridRange(anyDayInMonth);

  const days: DateOnly[] = [];
  let current = start;

  while (compareDateOnly(current, end) <= 0) {
    days.push(current);

    const currentDate = dateOnlyToLocalDate(current);
    current = localDateToDateOnly(
      localNoon(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
    );
  }

  return days;
}
