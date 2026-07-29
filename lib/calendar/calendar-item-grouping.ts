import {
  dateOnlyToLocalDate,
  formatDateOnlyForA11y,
  type DateOnly,
} from "@/lib/tasks/date-only";
import { getCalendarGridDays } from "@/lib/calendar/calendar-grid";
import { sortCalendarItemsForDay } from "@/lib/calendar/calendar-item-sort";
import type { CalendarItem } from "@/lib/calendar/calendar-types";

/**
 * Per-day derivation for the Work Calendar UI: grouping a flat, already
 * range-bounded `CalendarItem[]` by day, and building the grid/agenda
 * shapes both the desktop month grid and the mobile compact selector
 * consume. Pure -- no React, no fetching -- so both render trees can share
 * one derivation path instead of each recomputing (or worse,
 * re-deriving-differently) the same grouping.
 */

/**
 * Groups `items` by their `date`, sorting each day's bucket with the
 * existing deterministic `sortCalendarItemsForDay` -- never reimplemented
 * here. The API route already returns items in overall sorted order, but
 * grouping re-sorts each bucket independently so the result is correct
 * regardless of the input array's order (defensive, not merely trusting
 * upstream ordering to hold forever).
 */
export function groupCalendarItemsByDate(
  items: readonly CalendarItem[]
): Map<DateOnly, CalendarItem[]> {
  const byDate = new Map<DateOnly, CalendarItem[]>();

  for (const item of items) {
    const bucket = byDate.get(item.date);
    if (bucket) {
      bucket.push(item);
    } else {
      byDate.set(item.date, [item]);
    }
  }

  for (const [date, bucket] of byDate) {
    byDate.set(date, sortCalendarItemsForDay(bucket));
  }

  return byDate;
}

/** Items for one day, or an empty array when the day has none. */
export function getCalendarItemsForDate(
  byDate: ReadonlyMap<DateOnly, CalendarItem[]>,
  date: DateOnly
): CalendarItem[] {
  return byDate.get(date) ?? [];
}

export type CalendarGridDay = {
  date: DateOnly;
  items: CalendarItem[];
  /** True for a leading/trailing day belonging to an adjacent month. */
  isOutsideMonth: boolean;
};

/**
 * Builds the full visible grid (leading days + the month's own days +
 * trailing days, via the existing `getCalendarGridDays`) with each day's
 * already-sorted items attached, and whether it belongs to an adjacent
 * month. This is the single shape the desktop month grid renders from.
 */
export function buildCalendarGridDays(
  visibleMonth: DateOnly,
  items: readonly CalendarItem[]
): CalendarGridDay[] {
  const days = getCalendarGridDays(visibleMonth);
  const byDate = groupCalendarItemsByDate(items);

  const anchor = dateOnlyToLocalDate(visibleMonth);
  const visibleYear = anchor.getFullYear();
  const visibleMonthIndex = anchor.getMonth();

  return days.map((date) => {
    const dayDate = dateOnlyToLocalDate(date);

    return {
      date,
      items: getCalendarItemsForDate(byDate, date),
      isOutsideMonth:
        dayDate.getFullYear() !== visibleYear || dayDate.getMonth() !== visibleMonthIndex,
    };
  });
}

/**
 * Builds the accessible name for one calendar day control (desktop day
 * button or mobile compact-selector day), combining the unambiguous full
 * date, today/selected state, and a scheduled-item count -- so item count
 * is conveyed programmatically, not only via a visual dot/chip.
 */
export function buildCalendarDayAccessibleLabel({
  date,
  isToday,
  isSelected,
  itemCount,
}: {
  date: DateOnly;
  isToday: boolean;
  isSelected: boolean;
  itemCount: number;
}): string {
  const parts = [formatDateOnlyForA11y(date)];

  if (isToday) parts.push("Today");
  if (isSelected) parts.push("Selected");

  if (itemCount === 1) {
    parts.push("1 item scheduled");
  } else if (itemCount > 1) {
    parts.push(`${itemCount} items scheduled`);
  }

  return parts.join(", ");
}
