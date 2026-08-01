"use client";

import { createContext, useContext, useMemo, type ButtonHTMLAttributes, type MouseEvent as ReactMouseEvent } from "react";
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
  dashboardShadows,
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
  /**
   * `triggerElement` (the exact day `<button>` clicked/activated) is passed
   * alongside the date so a caller opening a trigger-focus-managed popup on
   * selection (WorkCalendarClient's day-detail dialog) can capture it
   * directly from the event, the same reliable pattern already used for
   * Edit -- never inferred from `document.activeElement`, which is only
   * reliably the clicked button in a real browser's own click sequence and
   * is a needless indirection when the element is already in hand.
   * Optional and unused by existing callers/tests, which only ever assert
   * the single-argument `(date) => void` shape.
   */
  onSelectDate: (date: DateOnly, triggerElement?: HTMLElement) => void;
  onMonthChange: (next: DateOnly) => void;
};

/**
 * Carries the per-render-changing pieces (`gridDayByDate`, `onActivate`)
 * that `CalendarDayButton` needs, via Context rather than props/closure.
 * DayPicker's `components.DayButton` must be a component whose IDENTITY
 * never changes across renders -- passing it a fresh arrow function (or
 * even a memoized one whose dependencies legitimately change whenever the
 * calendar's own item data changes, e.g. right after a create/edit/delete)
 * makes DayPicker treat it as "a different day-button component" and tear
 * down + rebuild every day cell's DOM node, including whichever one a
 * caller may have captured as a focus-return trigger a moment earlier
 * (CalendarDayDialog's day-detail popup does exactly this). Context sidesteps
 * this entirely: `dayPickerComponents` below is a true module-level
 * constant, and `CalendarDayButton` simply re-renders in place (via normal
 * React reconciliation, never unmount/remount) when the context value
 * changes.
 */
const CalendarDayButtonContext = createContext<{
  gridDayByDate: Map<DateOnly, CalendarGridDay>;
  onActivate: (date: DateOnly, triggerElement: HTMLElement) => void;
} | null>(null);

function MonthCaptionHidden() {
  return <></>;
}

const dayPickerComponents = {
  MonthCaption: MonthCaptionHidden,
  DayButton: CalendarDayButton,
};

export function CalendarMonthGrid({
  visibleMonth,
  selectedDate,
  today,
  gridDays,
  onSelectDate,
  onMonthChange,
}: CalendarMonthGridProps) {
  // Memoized on `gridDays`' own identity (the caller -- WorkCalendarClient --
  // now memoizes that array too) so this Map stays referentially stable
  // across renders where the underlying calendar data hasn't changed.
  const gridDayByDate = useMemo(() => new Map(gridDays.map((day) => [day.date, day])), [gridDays]);

  const contextValue = useMemo(
    () => ({ gridDayByDate, onActivate: onSelectDate }),
    [gridDayByDate, onSelectDate]
  );

  // DayPicker's `selected`/`month`/`today` props are plain `Date` objects,
  // and it treats a new object identity (not just a changed value) as a
  // reason to rebuild its internal day-button DOM nodes -- `dateOnlyToLocalDate`
  // otherwise allocates a fresh `Date` on every single render (even ones
  // wholly unrelated to the calendar itself, e.g. the Add/Edit dialog's own
  // options-loading state settling), which was silently tearing down and
  // recreating every day button on each such render. That was invisible
  // before this redesign (nothing ever captured a day button as a focus-
  // return trigger), but breaks CalendarDayDialog's captured-trigger
  // focus-return: by the time the dialog closes, the originally-clicked
  // button may already be a detached, stale DOM node. Memoizing on the
  // underlying DateOnly *string* keeps the same Date object identity across
  // renders where the value hasn't actually changed.
  const selectedLocalDate = useMemo(() => dateOnlyToLocalDate(selectedDate), [selectedDate]);
  const visibleMonthLocalDate = useMemo(() => dateOnlyToLocalDate(visibleMonth), [visibleMonth]);
  const todayLocalDate = useMemo(() => dateOnlyToLocalDate(today), [today]);

  const dayPickerLabels = useMemo(
    () => ({
      labelDayButton: (date: Date, modifiers: Modifiers) => {
        const dateOnly = localDateToDateOnly(date);
        const gridDay = gridDayByDate.get(dateOnly);
        return buildCalendarDayAccessibleLabel({
          date: dateOnly,
          isToday: Boolean(modifiers.today),
          isSelected: Boolean(modifiers.selected),
          itemCount: gridDay?.items.length ?? 0,
        });
      },
    }),
    [gridDayByDate]
  );

  return (
    <div className="calendar-month-grid-root" role="region" aria-label="Month calendar">
      <style>{gridCss}</style>

      <CalendarDayButtonContext.Provider value={contextValue}>
        <DayPicker
          mode="single"
          selected={selectedLocalDate}
          onSelect={(day) => {
            if (day) onSelectDate(localDateToDateOnly(day));
          }}
          month={visibleMonthLocalDate}
          onMonthChange={(next) => onMonthChange(localDateToDateOnly(next))}
          today={todayLocalDate}
          hideNavigation
          showOutsideDays
          components={dayPickerComponents}
          labels={dayPickerLabels}
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
      </CalendarDayButtonContext.Provider>
    </div>
  );
}

type CalendarDayButtonProps = {
  day: CalendarDay;
  modifiers: Modifiers;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Fires on every real activation (click, or Enter/Space on a focused day
 * button -- both dispatch a native click), regardless of whether the date
 * was already selected. DayPicker's own `onSelect` prop (wired at the
 * DayPicker level) only fires when its internal notion of the selected day
 * actually CHANGES -- clicking the already-selected day (e.g. today, the
 * default on first render) is a no-op from DayPicker's own perspective and
 * never reaches `onSelect` at all. Since "click a day" must always open the
 * day-detail popup (this redesign's whole point), `handleClick` below wraps
 * the button's own onClick instead of relying on `onSelect`, so
 * re-activating the currently-selected day still opens it.
 */
function CalendarDayButton({ day, modifiers, ...buttonProps }: CalendarDayButtonProps) {
  const context = useContext(CalendarDayButtonContext);
  const dateOnly = localDateToDateOnly(day.date);
  const gridDay = context?.gridDayByDate.get(dateOnly);
  const items = gridDay?.items ?? [];
  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS_PER_DAY);
  const hiddenCount = items.length - visibleItems.length;

  function handleClick(clickEvent: ReactMouseEvent<HTMLButtonElement>) {
    buttonProps.onClick?.(clickEvent);
    context?.onActivate(dateOnly, clickEvent.currentTarget);
  }

  return (
    <button {...buttonProps} onClick={handleClick} type="button">
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
    letter-spacing: 0.08em;
    padding-bottom: ${dashboardSpacing[3]}px;
    text-align: center;
  }

  .calendar-grid-week {
    display: table-row;
  }

  .calendar-grid-day {
    display: table-cell;
    vertical-align: top;
    padding: 4px;
    width: 14.2857%;
  }

  .calendar-grid-day-button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: 100%;
    min-height: 128px;
    padding: 10px;
    border-radius: ${dashboardRadii.lg}px;
    border: 1px solid ${dashboardColors.border.subtle};
    background: ${dashboardColors.background.surface};
    color: inherit;
    font-family: ${dashboardTypography.fontFamily};
    cursor: pointer;
    text-align: left;
    transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
  }

  .calendar-grid-day-button:hover {
    background: linear-gradient(165deg, rgba(37, 99, 235, 0.07) 0%, rgba(124, 58, 237, 0.05) 100%);
    border-color: rgba(99, 102, 241, 0.35);
    box-shadow: 0 6px 16px rgba(79, 70, 229, 0.14);
    transform: translateY(-1px);
  }

  .calendar-grid-day-button:focus-visible {
    outline: 3px solid ${dashboardColors.border.focus};
    outline-offset: 2px;
  }

  .calendar-day-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 26px;
    padding: 0 6px;
    border-radius: ${dashboardRadii.full}px;
    font-size: ${dashboardTypography.size.sm}px;
    font-weight: ${dashboardTypography.weight.bold};
    color: ${dashboardColors.text.secondary};
  }

  .calendar-grid-day[data-today="true"] .calendar-day-number {
    color: ${dashboardColors.primary[700]};
    background: ${dashboardColors.primary[50]};
  }

  .calendar-grid-day[data-today="true"] .calendar-grid-day-button {
    border-color: ${dashboardColors.primary[500]};
    background: linear-gradient(165deg, ${dashboardColors.primary[50]} 0%, ${dashboardColors.background.surface} 72%);
  }

  .calendar-grid-day[data-selected="true"] .calendar-grid-day-button {
    border-color: transparent;
    background: linear-gradient(165deg, ${dashboardColors.primary[50]} 0%, ${dashboardColors.background.surface} 78%);
    box-shadow: 0 0 0 2px ${dashboardColors.primary[500]} inset, ${dashboardShadows.sm};
  }

  .calendar-grid-day[data-selected="true"] .calendar-day-number {
    color: ${dashboardColors.text.inverse};
    background: linear-gradient(135deg, ${dashboardColors.primary[600]} 0%, ${dashboardColors.primary[500]} 100%);
  }

  .calendar-grid-day[data-outside="true"] .calendar-grid-day-button {
    background: ${dashboardColors.background.surfaceSoft};
  }

  .calendar-grid-day[data-outside="true"] .calendar-day-number,
  .calendar-grid-day[data-outside="true"] .calendar-day-preview-text {
    color: ${dashboardColors.text.muted};
  }

  .calendar-day-previews {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
  }

  .calendar-day-preview {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    padding: 3px 6px;
    border-radius: ${dashboardRadii.sm}px;
  }

  .calendar-day-preview--project_deadline {
    background: rgba(124, 58, 237, 0.14);
  }

  .calendar-day-preview--manual_event {
    background: rgba(37, 99, 235, 0.13);
  }

  .calendar-day-preview-dot {
    width: 6px;
    height: 6px;
    border-radius: ${dashboardRadii.full}px;
    flex-shrink: 0;
  }

  .calendar-day-preview--project_deadline .calendar-day-preview-dot {
    background: ${dashboardColors.accent.purple};
  }

  .calendar-day-preview--manual_event .calendar-day-preview-dot {
    background: ${dashboardColors.primary[600]};
  }

  .calendar-day-preview-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: ${dashboardTypography.size.xs}px;
    font-weight: ${dashboardTypography.weight.semibold};
    color: ${dashboardColors.text.secondary};
  }

  .calendar-day-preview-more {
    padding: 2px 6px;
    font-size: ${dashboardTypography.size.xs}px;
    font-weight: ${dashboardTypography.weight.bold};
    color: ${dashboardColors.text.muted};
  }

  @media (max-width: 700px) {
    .calendar-grid-day-button {
      min-height: 76px;
      padding: 6px;
      gap: 3px;
    }
  }
`;
