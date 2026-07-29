"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dateOnlyToLocalDate, todayDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import {
  addMonthsClamped,
  getNextMonthDate,
  getPreviousMonthDate,
} from "@/lib/calendar/calendar-month-navigation";
import { getCalendarGridRange } from "@/lib/calendar/calendar-grid";
import { buildCalendarGridDays } from "@/lib/calendar/calendar-item-grouping";
import {
  isCalendarAbortError,
  loadCalendarRangeClient,
  type LoadCalendarRangeClientResult,
} from "@/lib/calendar/load-calendar-range.client";
import type { CalendarItem } from "@/lib/calendar/calendar-types";
import { CalendarToolbar } from "./calendar-toolbar";
import { CalendarMonthGrid } from "./calendar-month-grid";
import { CalendarCompactSelector } from "./calendar-compact-selector";
import { SelectedDayAgenda } from "./selected-day-agenda";
import { DashboardEmptyState } from "../ui/empty-state";
import { dashboardBreakpoints, dashboardColors, dashboardRadii, dashboardSpacing, dashboardTypography } from "../ui/tokens";

/*
  Top-level read-only Work Calendar client. Owns all navigation/loading
  state; every presentational piece below it (CalendarToolbar,
  CalendarMonthGrid, CalendarCompactSelector, SelectedDayAgenda) is a pure
  props-in-JSX-out component with no fetching or independent derivation of
  its own -- this is the single place that state, so desktop and mobile
  render trees always agree.

  State model: `selectedDate` is the ONLY canonical piece of navigation
  state. The visible month is never tracked separately -- every grid/range
  helper in lib/calendar only reads the year/month of the DateOnly it's
  given, so `selectedDate` itself doubles as "the visible month anchor".
  This is what makes Previous/Next (which move both the month and the
  clamped selected day together), Today-in-the-current-month (which must
  not refetch), and clicking an outside-month day (which must shift the
  view) all fall out correctly without a second state variable to keep in
  sync.
*/

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: CalendarItem[] };

const EMPTY_ITEMS: CalendarItem[] = [];

function computeMonthDelta(from: DateOnly, to: DateOnly): number {
  const a = dateOnlyToLocalDate(from);
  const b = dateOnlyToLocalDate(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function WorkCalendarClient() {
  const [selectedDate, setSelectedDate] = useState<DateOnly>(() => todayDateOnly());
  const [retryNonce, setRetryNonce] = useState(0);

  const today = todayDateOnly();
  const visibleMonth = selectedDate;
  const gridRange = getCalendarGridRange(visibleMonth);

  // The request in flight/most recently completed is identified by this key
  // (range bounds + retry nonce). Deriving "is this the current request's
  // result" from a key comparison -- rather than an explicit "loading"
  // setState at the top of the effect -- means the effect only ever calls
  // setState from its async .then/.catch callbacks, never synchronously in
  // the effect body itself.
  const requestKey = `${gridRange.start}|${gridRange.end}|${retryNonce}`;

  const [completedResult, setCompletedResult] = useState<{
    key: string;
    result: LoadCalendarRangeClientResult;
  } | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    let cancelled = false;

    function handleSettled(result: LoadCalendarRangeClientResult | null) {
      if (cancelled || requestIdRef.current !== requestId) return;
      // `null` means the request was cancelled (superseded or unmounted) --
      // an entirely expected outcome, never an error, never surfaced.
      if (result === null) return;
      setCompletedResult({ key: requestKey, result });
    }

    function handleUnexpectedRejection(error: unknown) {
      if (cancelled || requestIdRef.current !== requestId) return;
      // loadCalendarRangeClient resolves (never rejects) for an expected
      // cancellation, so this branch is a defensive backstop for a
      // genuinely unexpected thrown value -- but it still checks for an
      // abort shape rather than assuming one can never reach here.
      if (isCalendarAbortError(error)) return;
      setCompletedResult({
        key: requestKey,
        result: { ok: false, error: "Could not load calendar items. Please try again." },
      });
    }

    loadCalendarRangeClient({ start: gridRange.start, end: gridRange.end }, controller.signal).then(
      handleSettled,
      handleUnexpectedRejection
    );

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey, gridRange.start, gridRange.end]);

  const loadState: LoadState =
    completedResult?.key !== requestKey
      ? { status: "loading" }
      : completedResult.result.ok
        ? { status: "ready", items: completedResult.result.items }
        : { status: "error", message: completedResult.result.error };

  const items = loadState.status === "ready" ? loadState.items : EMPTY_ITEMS;
  const gridDays = buildCalendarGridDays(visibleMonth, items);
  const selectedDayItems = gridDays.find((day) => day.date === selectedDate)?.items ?? EMPTY_ITEMS;

  const handleSelectDate = useCallback((date: DateOnly) => {
    setSelectedDate(date);
  }, []);

  const handlePrevious = useCallback(() => {
    setSelectedDate((current) => getPreviousMonthDate(current));
  }, []);

  const handleNext = useCallback(() => {
    setSelectedDate((current) => getNextMonthDate(current));
  }, []);

  const handleToday = useCallback(() => {
    setSelectedDate(todayDateOnly());
  }, []);

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
  }, []);

  const handleMonthChangeFromPicker = useCallback((next: DateOnly) => {
    setSelectedDate((current) => {
      const delta = computeMonthDelta(current, next);
      if (delta === 0) return current;
      return addMonthsClamped(current, delta);
    });
  }, []);

  return (
    <div className="work-calendar-root">
      <style>{responsiveCss}</style>

      <CalendarToolbar
        visibleMonth={visibleMonth}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
      />

      {loadState.status === "loading" ? (
        <DashboardEmptyState
          title="Loading your calendar..."
          description="Fetching project deadlines and scheduled events for this month."
        />
      ) : loadState.status === "error" ? (
        <DashboardEmptyState
          tone="danger"
          title="Could not load your calendar"
          description={loadState.message}
          action={
            <button type="button" onClick={handleRetry} className="calendar-retry-button">
              Retry
            </button>
          }
        />
      ) : (
        <div className="work-calendar-body">
          <div className="calendar-desktop-grid">
            <CalendarMonthGrid
              visibleMonth={visibleMonth}
              selectedDate={selectedDate}
              today={today}
              gridDays={gridDays}
              onSelectDate={handleSelectDate}
              onMonthChange={handleMonthChangeFromPicker}
            />
          </div>

          <div className="calendar-mobile-selector">
            <CalendarCompactSelector
              selectedDate={selectedDate}
              visibleMonth={visibleMonth}
              gridDays={gridDays}
              onSelectDate={handleSelectDate}
              onMonthChange={handleMonthChangeFromPicker}
            />
          </div>

          <div className="calendar-agenda-column">
            <SelectedDayAgenda date={selectedDate} items={selectedDayItems} />
          </div>
        </div>
      )}
    </div>
  );
}

const responsiveCss = `
  .work-calendar-root {
    display: grid;
    gap: ${dashboardSpacing[6]}px;
    min-width: 0;
    max-width: 100%;
  }

  .work-calendar-body {
    display: grid;
    gap: ${dashboardSpacing[6]}px;
    align-items: start;
    /* Grid items default to min-width: auto, which refuses to shrink below
       their content's intrinsic width -- for a wide fixed-content child
       (the compact calendar's day grid) that forces the whole row to
       overflow horizontally instead of the child shrinking to fit. min-width:
       0 on every column here (and on each column's own root wrapper below)
       is what actually lets them shrink to the track's real width. */
    min-width: 0;
  }

  .calendar-desktop-grid,
  .calendar-mobile-selector,
  .calendar-agenda-column {
    min-width: 0;
    max-width: 100%;
  }

  .calendar-desktop-grid {
    display: block;
  }

  .calendar-mobile-selector {
    display: none;
  }

  .calendar-retry-button {
    min-height: 40px;
    padding: 0 18px;
    border-radius: ${dashboardRadii.sm}px;
    border: none;
    background: ${dashboardColors.status.red};
    color: ${dashboardColors.text.inverse};
    font-family: ${dashboardTypography.fontFamily};
    font-size: ${dashboardTypography.size.sm}px;
    font-weight: ${dashboardTypography.weight.bold};
    cursor: pointer;
  }

  .calendar-retry-button:focus-visible {
    outline: 3px solid ${dashboardColors.border.focus};
    outline-offset: 2px;
  }

  @media (min-width: ${dashboardBreakpoints.mobile + 1}px) {
    .work-calendar-body {
      grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    }
  }

  @media (max-width: ${dashboardBreakpoints.mobile}px) {
    .calendar-desktop-grid {
      display: none !important;
    }

    .calendar-mobile-selector {
      display: block !important;
    }

    .work-calendar-body {
      grid-template-columns: 1fr;
    }
  }
`;
