import { dateOnlyToLocalDate, localDateToDateOnly, type DateOnly } from "@/lib/tasks/date-only";

/**
 * Month-to-month navigation for the Work Calendar's selected date, safe
 * across every month-length/leap-year combination.
 *
 * All `Date` construction here is numeric-only and anchored at local noon,
 * matching the one sanctioned pattern in lib/tasks/date-only.ts (never a
 * parsed string, never UTC) -- this module is a thin, DateOnly-safe
 * wrapper around JS `Date`'s own month-overflow normalization, the same
 * technique lib/calendar/calendar-grid.ts already uses for grid math.
 */
function localNoon(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 12, 0, 0, 0);
}

/** The number of real days in the month containing `year`/`monthIndex` (0-11). */
function daysInMonth(year: number, monthIndex: number): number {
  // Day 0 of "next month" is the last real day of "this month" -- JS Date's
  // own numeric-only normalization, not string parsing.
  return localNoon(year, monthIndex + 1, 0).getDate();
}

/**
 * Moves `date` by `monthDelta` whole months (negative for backward,
 * positive for forward), preserving its day-of-month when the destination
 * month has that many days, and clamping to the destination month's last
 * real day otherwise (e.g. Jan 31 + 1 month -> Feb 28, or Feb 29 in a leap
 * year). `monthDelta` of any magnitude is safe (not just +/-1).
 */
export function addMonthsClamped(date: DateOnly, monthDelta: number): DateOnly {
  const anchor = dateOnlyToLocalDate(date);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();

  const targetFirst = localNoon(year, month + monthDelta, 1);
  const targetYear = targetFirst.getFullYear();
  const targetMonth = targetFirst.getMonth();

  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));

  return localDateToDateOnly(localNoon(targetYear, targetMonth, clampedDay));
}

/** Convenience wrapper: `addMonthsClamped(date, -1)`. */
export function getPreviousMonthDate(date: DateOnly): DateOnly {
  return addMonthsClamped(date, -1);
}

/** Convenience wrapper: `addMonthsClamped(date, 1)`. */
export function getNextMonthDate(date: DateOnly): DateOnly {
  return addMonthsClamped(date, 1);
}

/**
 * True when `a` and `b` fall in the same calendar month and year (ignoring
 * day-of-month). Used to decide whether moving the selected date actually
 * changes the visible month (and therefore whether a new range needs to be
 * fetched) -- e.g. clicking "Today" while already viewing the current
 * month must not look like a month change.
 */
export function isSameMonth(a: DateOnly, b: DateOnly): boolean {
  const dateA = dateOnlyToLocalDate(a);
  const dateB = dateOnlyToLocalDate(b);
  return dateA.getFullYear() === dateB.getFullYear() && dateA.getMonth() === dateB.getMonth();
}

const MONTH_NAMES_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Full month + year label for the Calendar toolbar/header, e.g. "July 2026".
 * Built manually from the same numeric parts every other DateOnly formatter
 * uses -- no `Intl`/locale dependency, matching
 * `formatDateOnlyForDisplay`/`formatDateOnlyForA11y`'s approach.
 */
export function formatMonthYearForDisplay(date: DateOnly): string {
  const anchor = dateOnlyToLocalDate(date);
  return `${MONTH_NAMES_FULL[anchor.getMonth()]} ${anchor.getFullYear()}`;
}
