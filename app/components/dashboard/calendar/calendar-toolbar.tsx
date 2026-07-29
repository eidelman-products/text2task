"use client";

import type { CSSProperties, JSX } from "react";
import type { DateOnly } from "@/lib/tasks/date-only";
import {
  formatMonthYearForDisplay,
  getNextMonthDate,
  getPreviousMonthDate,
} from "@/lib/calendar/calendar-month-navigation";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../ui/tokens";

/**
 * Read-only Work Calendar toolbar: Previous/Today/Next navigation plus the
 * visible month + year label. Purely presentational -- all navigation state
 * lives in the caller (`WorkCalendarClient`, owned by a different track);
 * this component only renders buttons and calls the provided callbacks.
 */
export type CalendarToolbarProps = {
  visibleMonth: DateOnly;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
};

export function CalendarToolbar({
  visibleMonth,
  onPrevious,
  onNext,
  onToday,
}: CalendarToolbarProps): JSX.Element {
  const previousMonthLabel = formatMonthYearForDisplay(getPreviousMonthDate(visibleMonth));
  const nextMonthLabel = formatMonthYearForDisplay(getNextMonthDate(visibleMonth));
  const currentMonthLabel = formatMonthYearForDisplay(visibleMonth);

  return (
    <div style={toolbarShellStyle}>
      <style>{toolbarCss}</style>

      <div style={navGroupStyle}>
        <button
          type="button"
          onClick={onPrevious}
          aria-label={`Previous month, ${previousMonthLabel}`}
          className="t2t-calendar-toolbar-nav-btn"
          style={navButtonStyle}
        >
          <span aria-hidden="true">‹</span>
        </button>

        <button
          type="button"
          onClick={onToday}
          aria-label="Go to today"
          className="t2t-calendar-toolbar-today-btn"
          style={todayButtonStyle}
        >
          Today
        </button>

        <button
          type="button"
          onClick={onNext}
          aria-label={`Next month, ${nextMonthLabel}`}
          className="t2t-calendar-toolbar-nav-btn"
          style={navButtonStyle}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div aria-live="polite" style={monthLabelStyle}>
        {currentMonthLabel}
      </div>
    </div>
  );
}

const toolbarShellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: dashboardSpacing[4],
  flexWrap: "wrap",
  fontFamily: dashboardTypography.fontFamily,
};

const navGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: dashboardSpacing[2],
};

const navButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 44,
  height: 44,
  minWidth: 44,
  minHeight: 44,
  borderRadius: dashboardRadii.sm,
  border: `1px solid ${dashboardColors.border.subtle}`,
  background: dashboardColors.background.surface,
  color: dashboardColors.text.secondary,
  fontSize: dashboardTypography.size.lg,
  cursor: "pointer",
};

const todayButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 44,
  minHeight: 44,
  padding: `0 ${dashboardSpacing[4]}px`,
  borderRadius: dashboardRadii.sm,
  border: `1px solid ${dashboardColors.border.subtle}`,
  background: dashboardColors.background.surface,
  color: dashboardColors.text.secondary,
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.semibold,
  cursor: "pointer",
};

const monthLabelStyle: CSSProperties = {
  fontSize: dashboardTypography.size.lg,
  fontWeight: dashboardTypography.weight.bold,
  color: dashboardColors.text.primary,
};

const toolbarCss = `
  .t2t-calendar-toolbar-nav-btn,
  .t2t-calendar-toolbar-today-btn {
    transition: background 120ms ease, border-color 120ms ease;
  }

  .t2t-calendar-toolbar-nav-btn:hover,
  .t2t-calendar-toolbar-today-btn:hover {
    background: ${dashboardColors.background.surfaceMuted};
    border-color: ${dashboardColors.border.default};
  }

  .t2t-calendar-toolbar-nav-btn:focus-visible,
  .t2t-calendar-toolbar-today-btn:focus-visible {
    outline: 3px solid ${dashboardColors.border.focus};
    outline-offset: 2px;
  }
`;
