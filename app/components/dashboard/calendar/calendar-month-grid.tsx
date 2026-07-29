"use client";

import type { ButtonHTMLAttributes } from "react";
import type { CalendarDay, Modifiers } from "@daypicker/react";
import { DayPicker } from "@daypicker/react";
import { dateOnlyToLocalDate, localDateToDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import {
  buildCalendarDayAccessibleLabel,
  type CalendarGridDay,
} from "@/lib/calendar/calendar-item-grouping";
import type { CalendarItem } from "@/lib/calendar/calendar-types";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../ui/tokens";

/*
  Desktop month grid for the Work Calendar. Built directly on DayPicker
  (not the shared single-date `Calendar` primitive -- that component is
  tuned for single-value date-field pickers with dropdown month/year
  navigation, a different job than a read-only item-preview grid whose
  month nav is fully owned by CalendarToolbar).

  DayPicker's own `role="grid"`/`role="gridcell"` markup and roving-tabindex
  keyboard navigation (arrow keys, Home/End, PageUp/PageDown) are preserved
  as-is -- only the DayButton's *content* is overridden (per DayPicker's own
  guidance: override DayButton, not Day, for content-only changes), and only
  the MonthCaption/Nav are hidden since CalendarToolbar already renders the
  single visible Previous/Today/Next + month/year control for this page.
*/

const MAX_VISIBLE_ITEMS_PER_DAY = 3;

export type CalendarMonthGridProps = {
  visibleMonth: DateOnly;
  selectedDate: DateOnly;
  today: DateOnly;
  gridDays: CalendarGridDay[];
  onSelectDate: (date: DateOnly) => void;
  onMonthChange: (next: DateOnly) => void;
};

export function CalendarMonthGrid({
  visibleMonth,
  selectedDate,
  today,
  gridDays,
  onSelectDate,
  onMonthChange,
}: CalendarMonthGridProps) {
  const gridDayByDate = new Map(gridDays.map((day) => [day.date, day]));

  return (
    <div className="calendar-month-grid-root" role="region" aria-label="Month calendar">
      <style>{gridCss}</style>

      <DayPicker
        mode="single"
        selected={dateOnlyToLocalDate(selectedDate)}
        onSelect={(day) => {
          if (day) onSelectDate(localDateToDateOnly(day));
        }}
        month={dateOnlyToLocalDate(visibleMonth)}
        onMonthChange={(next) => onMonthChange(localDateToDateOnly(next))}
        today={dateOnlyToLocalDate(today)}
        hideNavigation
        showOutsideDays
        components={{
          MonthCaption: () => <></>,
          DayButton: (props) => (
            <CalendarDayButton {...props} gridDayByDate={gridDayByDate} />
          ),
        }}
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
        classNames={{
          weekdays: "calendar-grid-weekdays",
          weekday: "calendar-grid-weekday",
          week: "calendar-grid-week",
          day: "calendar-grid-day",
          day_button: "calendar-grid-day-button",
        }}
        styles={{
          root: {
            margin: 0,
            width: "100%",
            fontFamily: dashboardTypography.fontFamily,
            color: dashboardColors.text.primary,
          },
          months: { display: "block", width: "100%" },
          month: { display: "block", width: "100%" },
          month_grid: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
        }}
      />
    </div>
  );
}

type CalendarDayButtonProps = {
  day: CalendarDay;
  modifiers: Modifiers;
  gridDayByDate: Map<DateOnly, CalendarGridDay>;
} & ButtonHTMLAttributes<HTMLButtonElement>;

function CalendarDayButton({ day, modifiers, gridDayByDate, ...buttonProps }: CalendarDayButtonProps) {
  const dateOnly = localDateToDateOnly(day.date);
  const gridDay = gridDayByDate.get(dateOnly);
  const items = gridDay?.items ?? [];
  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS_PER_DAY);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <button {...buttonProps} type="button">
      <span className="calendar-day-number">{day.date.getDate()}</span>

      {visibleItems.length > 0 ? (
        <span className="calendar-day-previews">
          {visibleItems.map((item) => (
            <CalendarDayPreviewChip key={item.id} item={item} />
          ))}
          {hiddenCount > 0 ? (
            <span className="calendar-day-preview-more">+{hiddenCount} more</span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

function CalendarDayPreviewChip({ item }: { item: CalendarItem }) {
  const kindLabel = item.kind === "project_deadline" ? "Deadline" : "Event";

  return (
    <span className={`calendar-day-preview calendar-day-preview--${item.kind}`}>
      <span aria-hidden="true" className="calendar-day-preview-dot" />
      <span className="calendar-day-preview-text">
        {kindLabel}: {item.title}
      </span>
    </span>
  );
}

const gridCss = `
  .calendar-month-grid-root {
    width: 100%;
  }

  .calendar-grid-weekdays {
    display: table-row;
  }

  .calendar-grid-weekday {
    color: ${dashboardColors.text.muted};
    font-size: ${dashboardTypography.size.xs}px;
    font-weight: ${dashboardTypography.weight.black};
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding-bottom: ${dashboardSpacing[2]}px;
    text-align: center;
  }

  .calendar-grid-week {
    display: table-row;
  }

  .calendar-grid-day {
    display: table-cell;
    vertical-align: top;
    padding: 3px;
    width: 14.2857%;
  }

  .calendar-grid-day-button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    min-height: 84px;
    padding: 6px;
    border-radius: ${dashboardRadii.md}px;
    border: 1px solid ${dashboardColors.border.subtle};
    background: ${dashboardColors.background.surface};
    color: inherit;
    font-family: ${dashboardTypography.fontFamily};
    cursor: pointer;
    text-align: left;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .calendar-grid-day-button:hover {
    background: ${dashboardColors.background.surfaceMuted};
  }

  .calendar-grid-day-button:focus-visible {
    outline: 3px solid ${dashboardColors.border.focus};
    outline-offset: 2px;
  }

  .calendar-day-number {
    font-size: ${dashboardTypography.size.sm}px;
    font-weight: ${dashboardTypography.weight.bold};
    color: ${dashboardColors.text.secondary};
  }

  .calendar-grid-day[data-today="true"] .calendar-day-number {
    color: ${dashboardColors.primary[700]};
  }

  .calendar-grid-day[data-today="true"] .calendar-grid-day-button {
    border-color: ${dashboardColors.primary[500]};
  }

  .calendar-grid-day[data-selected="true"] .calendar-grid-day-button {
    border-color: ${dashboardColors.primary[600]};
    background: ${dashboardColors.primary[50]};
  }

  .calendar-grid-day[data-outside="true"] .calendar-day-number,
  .calendar-grid-day[data-outside="true"] .calendar-day-preview-text {
    color: ${dashboardColors.text.subtle};
  }

  .calendar-day-previews {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
  }

  .calendar-day-preview {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .calendar-day-preview-dot {
    width: 6px;
    height: 6px;
    border-radius: ${dashboardRadii.full}px;
    flex-shrink: 0;
  }

  .calendar-day-preview--project_deadline .calendar-day-preview-dot {
    background: ${dashboardColors.primary[600]};
  }

  .calendar-day-preview--manual_event .calendar-day-preview-dot {
    background: ${dashboardColors.accent.purple};
  }

  .calendar-day-preview-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: ${dashboardTypography.size.xs}px;
    font-weight: ${dashboardTypography.weight.medium};
    color: ${dashboardColors.text.secondary};
  }

  .calendar-day-preview-more {
    font-size: ${dashboardTypography.size.xs}px;
    font-weight: ${dashboardTypography.weight.bold};
    color: ${dashboardColors.text.muted};
  }
`;
