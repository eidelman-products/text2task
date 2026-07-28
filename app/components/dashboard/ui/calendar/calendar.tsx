"use client";

import type { Matcher } from "@daypicker/react";
import { DayPicker } from "@daypicker/react";

import {
  dateOnlyToLocalDate,
  localDateToDateOnly,
  todayDateOnly,
  type DateOnly,
} from "@/lib/tasks/date-only";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../tokens";

/*
  Thin wrapper around @daypicker/react (react-day-picker v10)'s <DayPicker />.

  DayPicker v10's own single-select mode already provides:
    - a `role="grid"` month grid with `role="gridcell"` days and full
      roving-tabindex arrow-key/Home/End/PageUp/PageDown navigation
      (verified by inspecting node_modules/react-day-picker/dist/esm/DayPicker.js)
    - `autoFocus`, which focuses the selected day's cell (or today's, if
      nothing is selected) on mount -- this satisfies the "focus entry"
      requirement without any custom ref plumbing
    - a built-in visually-hidden `aria-live="polite"` status region that
      announces the month/year caption on every navigation, whether or not
      `captionLayout="dropdown"` is used
    - `captionLayout="dropdown"` renders real native <select> month/year
      dropdowns, which is by itself an efficient far-future/far-past jump
      control -- so no bespoke month/year-select component is built here
      (see the ownership doc comment at the bottom of this file)

  This component's own public boundary is `DateOnly | null` only -- DayPicker's
  `Date`-based selection API never leaks out. Conversions happen only via
  `dateOnlyToLocalDate`/`localDateToDateOnly` from lib/tasks/date-only.ts,
  never via string round-tripping or `.toISOString()`.

  No DayPicker stylesheet is imported anywhere (not even scoped) -- every
  visual is driven by this repo's `dashboardColors`/`dashboardRadii`/etc.
  token system, either via DayPicker's `styles` prop (static per-element
  CSSProperties) or the scoped `<style>` tag below (only for :hover/
  :focus-visible/data-attribute states inline styles cannot express, mirroring
  the existing `project-header-editor.tsx` convention).
*/

export type CalendarProps = {
  value: DateOnly | null;
  onSelect: (next: DateOnly | null) => void;
  minDate?: DateOnly;
  maxDate?: DateOnly;
  autoFocus?: boolean;
  id?: string;
  "aria-label"?: string;
};

export function Calendar({
  value,
  onSelect,
  minDate,
  maxDate,
  autoFocus = true,
  id,
  "aria-label": ariaLabel,
}: CalendarProps) {
  const today = dateOnlyToLocalDate(todayDateOnly());
  const selected = value ? dateOnlyToLocalDate(value) : undefined;
  const defaultMonth = selected ?? today;

  const startMonth = minDate
    ? firstOfMonth(dateOnlyToLocalDate(minDate))
    : firstOfMonth(addYears(today, -10));

  const endMonth = maxDate
    ? firstOfMonth(dateOnlyToLocalDate(maxDate))
    : firstOfMonth(addYears(today, 20));

  const disabledMatchers: Matcher[] = [];
  if (minDate) {
    disabledMatchers.push({ before: dateOnlyToLocalDate(minDate) });
  }
  if (maxDate) {
    disabledMatchers.push({ after: dateOnlyToLocalDate(maxDate) });
  }

  return (
    <div className="t2t-cal-root" id={id}>
      <style>{calendarCss}</style>

      <DayPicker
        mode="single"
        selected={selected}
        onSelect={(day) => onSelect(day ? localDateToDateOnly(day) : null)}
        defaultMonth={defaultMonth}
        today={today}
        startMonth={startMonth}
        endMonth={endMonth}
        captionLayout="dropdown"
        showOutsideDays
        autoFocus={autoFocus}
        disabled={disabledMatchers.length ? disabledMatchers : undefined}
        aria-label={ariaLabel}
        classNames={{
          day: "t2t-cal-day",
          day_button: "t2t-cal-day-button",
          button_previous: "t2t-cal-nav-btn",
          button_next: "t2t-cal-nav-btn",
          dropdown: "t2t-cal-dropdown",
          chevron: "t2t-cal-chevron",
        }}
        styles={{
          root: {
            margin: 0,
            fontFamily: dashboardTypography.fontFamily,
            color: dashboardColors.text.primary,
          },
          months: { display: "flex" },
          month: { display: "flex", flexDirection: "column", gap: dashboardSpacing[2] },
          month_caption: {
            display: "flex",
            alignItems: "center",
            height: 36,
          },
          dropdowns: {
            display: "flex",
            alignItems: "center",
            gap: dashboardSpacing[2],
          },
          nav: {
            display: "flex",
            alignItems: "center",
            gap: dashboardSpacing[1],
          },
          month_grid: {
            borderCollapse: "collapse",
            marginTop: dashboardSpacing[2],
          },
          weekdays: { display: "table-row" },
          weekday: {
            color: dashboardColors.text.muted,
            fontSize: dashboardTypography.size.xs,
            fontWeight: dashboardTypography.weight.black,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            paddingBottom: dashboardSpacing[2],
          },
          week: { display: "table-row" },
          day: {
            textAlign: "center",
            padding: 2,
          },
        }}
      />
    </div>
  );
}

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date.getTime());
  next.setFullYear(date.getFullYear() + years);
  return next;
}

const calendarCss = `
  .t2t-cal-day-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    border-radius: ${dashboardRadii.md}px;
    border: 2px solid transparent;
    background: transparent;
    color: inherit;
    font-family: ${dashboardTypography.fontFamily};
    font-size: ${dashboardTypography.size.sm}px;
    font-weight: ${dashboardTypography.weight.medium};
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }

  .t2t-cal-day-button:disabled {
    cursor: not-allowed;
  }

  .t2t-cal-day-button:hover:not(:disabled) {
    background: ${dashboardColors.primary[50]};
  }

  .t2t-cal-day-button:focus-visible {
    outline: 3px solid ${dashboardColors.border.focus};
    outline-offset: 2px;
  }

  .t2t-cal-day[data-today="true"] .t2t-cal-day-button {
    border-color: ${dashboardColors.primary[500]};
    font-weight: ${dashboardTypography.weight.bold};
  }

  .t2t-cal-day[data-selected="true"] .t2t-cal-day-button {
    background: linear-gradient(135deg, ${dashboardColors.primary[600]} 0%, ${dashboardColors.primary[500]} 100%);
    border-color: transparent;
    color: ${dashboardColors.text.inverse};
  }

  .t2t-cal-day[data-selected="true"][data-today="true"] .t2t-cal-day-button {
    border-color: ${dashboardColors.text.inverse};
  }

  .t2t-cal-day[data-outside="true"] .t2t-cal-day-button {
    color: ${dashboardColors.text.subtle};
  }

  .t2t-cal-day[data-disabled="true"] .t2t-cal-day-button {
    color: ${dashboardColors.text.subtle};
    opacity: 0.42;
  }

  .t2t-cal-nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: ${dashboardRadii.sm}px;
    border: 1px solid ${dashboardColors.border.subtle};
    background: ${dashboardColors.background.surface};
    color: ${dashboardColors.text.secondary};
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .t2t-cal-nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .t2t-cal-nav-btn:hover:not(:disabled) {
    background: ${dashboardColors.background.surfaceMuted};
    border-color: ${dashboardColors.border.default};
  }

  .t2t-cal-nav-btn:focus-visible {
    outline: 3px solid ${dashboardColors.border.focus};
    outline-offset: 2px;
  }

  .t2t-cal-chevron {
    fill: currentColor;
  }

  .t2t-cal-dropdown {
    border: 1px solid ${dashboardColors.border.default};
    border-radius: ${dashboardRadii.sm}px;
    background: ${dashboardColors.background.surface};
    color: ${dashboardColors.text.primary};
    font-family: ${dashboardTypography.fontFamily};
    font-size: ${dashboardTypography.size.sm}px;
    font-weight: ${dashboardTypography.weight.medium};
    padding: 4px 22px 4px 8px;
    cursor: pointer;
  }

  .t2t-cal-dropdown:focus-visible {
    outline: 3px solid ${dashboardColors.border.focus};
    outline-offset: 2px;
  }
`;

/*
  Ownership note (per docs/TEXT2TASK_DATE_PICKER_MAPPING.md §8/§9): a separate
  `month-year-select.tsx` was NOT created. DayPicker v10's own
  `captionLayout="dropdown"` renders real native <select> elements for month
  and year (verified in node_modules/react-day-picker/dist/esm/DayPicker.js),
  which already satisfies the "efficient navigation to dates far in the future
  or past" requirement without a bespoke component. `startMonth`/`endMonth`
  above are computed from `minDate`/`maxDate` when supplied, else default to
  10 years back / 20 years forward from today, comfortably covering
  multi-year-out deadlines.
*/
