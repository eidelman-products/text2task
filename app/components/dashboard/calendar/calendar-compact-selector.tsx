"use client";

import { dateOnlyToLocalDate, localDateToDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import {
  buildCalendarDayAccessibleLabel,
  type CalendarGridDay,
} from "@/lib/calendar/calendar-item-grouping";
import { Calendar } from "../ui/calendar/calendar";
import { dashboardColors } from "../ui/tokens";

/**
 * Mobile compact month/date selector for the Work Calendar. Reuses the
 * existing single-date `Calendar` primitive (the same one DeadlineField
 * uses) rather than forking it.
 *
 * `CalendarToolbar` (rendered once, above both the desktop grid and this
 * compact selector) already owns the page's single visible Previous/Today/
 * Next control and month/year label -- so this passes `hideNavigation` and
 * `hideCaption` (both additive, opt-in props on `Calendar`; every other
 * caller, e.g. DateField/DeadlineField, leaves them at their default
 * `false` and is completely unaffected) to suppress DayPicker's own
 * Previous/Next buttons and dropdown month/year caption here, so exactly
 * one set of navigation controls is ever visible at once.
 *
 * `gridDays` is the exact same derived shape `CalendarMonthGrid` (desktop)
 * consumes -- built once by the caller via
 * `lib/calendar/calendar-item-grouping.ts`'s `buildCalendarGridDays` -- so
 * both the "has items" dot indicator and its accessible day label
 * (`buildCalendarDayAccessibleLabel`) come from the same single derivation
 * path as desktop, never a second independent one.
 *
 * Responsive sizing: `Calendar`'s own day-button CSS (`.t2t-cal-day-button`)
 * is a fixed 44px, sized for the roomier DateField/DeadlineField picker
 * popovers -- inside this narrower sidebar column that fixed width doesn't
 * fit 7 columns on small phones. Rather than changing that shared rule
 * (which would also resize DateField/DeadlineField), a MORE SPECIFIC
 * selector scoped under this component's own `.calendar-compact-selector`
 * wrapper class overrides sizing to be container-relative (each of the 7
 * columns takes an equal share of the available width, capped at 44px on
 * roomier viewports) -- CSS specificity wins without touching or forking
 * the shared primitive.
 */
export type CalendarCompactSelectorProps = {
  selectedDate: DateOnly;
  visibleMonth: DateOnly;
  gridDays: CalendarGridDay[];
  onSelectDate: (date: DateOnly) => void;
  onMonthChange: (next: DateOnly) => void;
};

export function CalendarCompactSelector({
  selectedDate,
  visibleMonth,
  gridDays,
  onSelectDate,
  onMonthChange,
}: CalendarCompactSelectorProps) {
  const gridDayByDate = new Map(gridDays.map((day) => [day.date, day]));
  const hasItemsDates = gridDays
    .filter((day) => day.items.length > 0)
    .map((day) => dateOnlyToLocalDate(day.date));

  return (
    <div className="calendar-compact-selector">
      <style>{compactSelectorCss}</style>

      <Calendar
        value={selectedDate}
        onSelect={(next) => {
          if (next) onSelectDate(next);
        }}
        month={visibleMonth}
        onMonthChange={onMonthChange}
        modifiers={{ hasItems: hasItemsDates }}
        modifiersClassNames={{ hasItems: "t2t-cal-day-has-items" }}
        labels={{
          labelDayButton: (date, modifiers) => {
            const dateOnly = localDateToDateOnly(date);
            const gridDay = gridDayByDate.get(dateOnly);
            return buildCalendarDayAccessibleLabel({
              date: dateOnly,
              isToday: Boolean(modifiers.today),
              isSelected: Boolean(modifiers.selected),
              itemCount: gridDay?.items.length ?? 0,
            });
          },
        }}
        autoFocus={false}
        hideNavigation
        hideCaption
        aria-label="Select a day"
      />
    </div>
  );
}

const compactSelectorCss = `
  .calendar-compact-selector {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .calendar-compact-selector .t2t-cal-root {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow-x: hidden;
  }

  .calendar-compact-selector .t2t-cal-grid {
    width: 100%;
    min-width: 0;
    table-layout: fixed;
  }

  .calendar-compact-selector .t2t-cal-day {
    width: 14.2857%;
    min-width: 0;
    padding: 2px;
  }

  .calendar-compact-selector .t2t-cal-day-button {
    box-sizing: border-box;
    width: 100%;
    height: auto;
    min-width: 0;
    min-height: 0;
    max-width: 44px;
    max-height: 44px;
    aspect-ratio: 1 / 1;
    margin: 0 auto;
    padding: 0;
  }

  .t2t-cal-day-has-items .t2t-cal-day-button {
    position: relative;
  }

  .t2t-cal-day-has-items .t2t-cal-day-button::after {
    content: "";
    position: absolute;
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
    width: 5px;
    height: 5px;
    border-radius: 999px;
    background: ${dashboardColors.primary[500]};
  }

  .t2t-cal-day[data-selected="true"].t2t-cal-day-has-items .t2t-cal-day-button::after {
    background: ${dashboardColors.text.inverse};
  }
`;
