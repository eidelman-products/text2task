"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { compareDateOnly, dateOnlyToLocalDate, todayDateOnly, type DateOnly } from "@/lib/tasks/date-only";
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
import { useTrackProductView } from "@/lib/activity/use-track-product-view.client";
import {
  loadCalendarOptionsClient,
  type LoadCalendarOptionsClientResult,
} from "@/lib/calendar/load-calendar-options.client";
import type {
  CalendarClientOption,
  CalendarItem,
  CalendarProjectOption,
  CalendarRangeQuery,
  ManualCalendarEventItem,
} from "@/lib/calendar/calendar-types";
import { CalendarToolbar } from "./calendar-toolbar";
import { CalendarMonthGrid } from "./calendar-month-grid";
import { CalendarCompactSelector } from "./calendar-compact-selector";
import { CalendarDayDialog, type CalendarDialogMode } from "./calendar-day-dialog";
import { DashboardEmptyState } from "../ui/empty-state";
import { dashboardBreakpoints, dashboardColors, dashboardRadii, dashboardShadows, dashboardSpacing, dashboardTypography } from "../ui/tokens";

/*
  Top-level Work Calendar client. Owns all navigation/loading state, the
  day-detail/Add/Edit dialog's open/close lifecycle and options loading, and
  the mutation-reconciliation logic that splices a create/update/delete
  result directly into the currently-held Calendar range -- none of that
  lives in CalendarDayDialog/CalendarEventForm, which only ever perform the
  POST/PATCH/DELETE request itself and hand back a normalized result via
  onSaved/onDeleted.

  UI redesign (premium hero calendar): the month grid is now the dominant,
  full-width surface -- there is no permanent side "agenda" panel. Clicking
  (or Enter/Space-activating) a day opens a single polished popup
  (CalendarDayDialog, "day" mode) showing that day's items; Add/Edit are
  reached either directly (the header's own Add event button) or from
  inside that popup, on the SAME dialog instance (see CalendarDayDialog's
  own doc comment for why that matters for focus-return correctness).

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

type ActiveDialogState =
  | { mode: "day"; date: DateOnly }
  | { mode: "create"; defaultDate: DateOnly }
  | { mode: "edit"; event: ManualCalendarEventItem }
  | null;

const EMPTY_ITEMS: CalendarItem[] = [];
const EMPTY_PROJECT_OPTIONS: CalendarProjectOption[] = [];
const EMPTY_CLIENT_OPTIONS: CalendarClientOption[] = [];
const OPTIONS_LOAD_ERROR = "Could not load project and client options.";

function computeMonthDelta(from: DateOnly, to: DateOnly): number {
  const a = dateOnlyToLocalDate(from);
  const b = dateOnlyToLocalDate(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** The exact (includeProjectId, includeClientId) cache/request key. */
function optionsKeyFor(includeProjectId: string | null, includeClientId: string | null): string {
  return `${includeProjectId ?? ""}|${includeClientId ?? ""}`;
}

function isDateWithinRange(date: DateOnly, range: CalendarRangeQuery): boolean {
  return compareDateOnly(date, range.start) >= 0 && compareDateOnly(date, range.end) <= 0;
}

/**
 * The single upsert rule for a successful create/update: remove any
 * existing item with the same id, then re-insert the API's own complete,
 * normalized item only if its date belongs to the CURRENT range -- never
 * merged with a prior local copy, never re-deriving projectTitle/clientName.
 * Project Deadline items are untouched, since their ids (`project:<uuid>`)
 * never collide with a Manual Event's (`event:<uuid>`).
 */
function upsertManualEventItem(
  items: readonly CalendarItem[],
  item: ManualCalendarEventItem,
  range: CalendarRangeQuery
): CalendarItem[] {
  const withoutExisting = items.filter((existing) => existing.id !== item.id);
  return isDateWithinRange(item.date, range) ? [...withoutExisting, item] : withoutExisting;
}

function removeManualEventItem(items: readonly CalendarItem[], itemId: string): CalendarItem[] {
  return items.filter((existing) => existing.id !== itemId);
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

  useTrackProductView({
    eventName: "calendar_viewed",
    route: "/dashboard/calendar",
  });

  const [completedResult, setCompletedResult] = useState<{
    key: string;
    result: LoadCalendarRangeClientResult;
  } | null>(null);

  const requestIdRef = useRef(0);

  // Monotonic, never reset, never React state. Every mutation success
  // increments this BEFORE reconciling; every in-flight GET captures it at
  // issue time, so a GET that resolves after a mutation committed is
  // unambiguously stale even when its own requestId/requestKey are still
  // otherwise current.
  const calendarDataVersionRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const capturedDataVersion = calendarDataVersionRef.current;
    const controller = new AbortController();
    let cancelled = false;

    function handleSettled(result: LoadCalendarRangeClientResult | null) {
      if (cancelled || requestIdRef.current !== requestId) return;
      if (calendarDataVersionRef.current !== capturedDataVersion) return;
      // `null` means the request was cancelled (superseded or unmounted) --
      // an entirely expected outcome, never an error, never surfaced.
      if (result === null) return;
      setCompletedResult({ key: requestKey, result });
    }

    function handleUnexpectedRejection(error: unknown) {
      if (cancelled || requestIdRef.current !== requestId) return;
      if (calendarDataVersionRef.current !== capturedDataVersion) return;
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
  // Memoized so this array's identity stays stable across renders where
  // `visibleMonth`/`items` themselves haven't changed (e.g. opening/closing
  // the day-detail dialog, options loading settling) -- CalendarMonthGrid
  // depends on this staying stable to avoid rebuilding its own `DayButton`
  // override (see its own comment) and, with it, every day button's DOM
  // node; an unmemoized new array every render was silently doing exactly
  // that, invisible before this redesign since nothing previously captured
  // a day button as a focus-return trigger.
  const gridDays = useMemo(() => buildCalendarGridDays(visibleMonth, items), [visibleMonth, items]);
  const selectedDayItems = gridDays.find((day) => day.date === selectedDate)?.items ?? EMPTY_ITEMS;

  // ---------------------------------------------------------------------
  // Day-detail / Add/Edit dialog: open state, trigger-focus ownership.
  // ---------------------------------------------------------------------

  const [activeDialog, setActiveDialog] = useState<ActiveDialogState>(null);

  // A stable ref object (never recreated) -- ResponsiveDialog's own
  // triggerRef. Only `.current` is ever mutated, never stored in React
  // state, per the "don't store DOM elements in state" rule.
  const dialogTriggerRef: RefObject<HTMLElement | null> = useRef(null);
  const addEventButtonRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // Set only by a successful mutation (handleSaved/handleDeleted), never by
  // an ordinary Cancel/Escape/backdrop close -- this is what makes the
  // extra Add-event/heading fallback below apply ONLY after a mutation,
  // never on a normal dismissal where the trigger is still connected and
  // ResponsiveDialog's own focus-return already handles it correctly.
  const pendingFocusFallbackRef = useRef(false);

  function handleOpenCreate() {
    dialogTriggerRef.current = addEventButtonRef.current;
    setActiveDialog({ mode: "create", defaultDate: selectedDate });
  }

  function handleDialogClose() {
    setActiveDialog(null);
  }

  // handleSaved/handleDeleted (below) are passed as onSaved/onDeleted into
  // CalendarDayDialog -> CalendarEventForm, whose own async submit handler
  // is a closure created fresh on ITS OWN render and captures whichever
  // onSaved/onDeleted reference was current props AT THAT MOMENT -- once
  // that async handler is actually running (awaiting the POST/PATCH/DELETE
  // response), a LATER WorkCalendarClient render creating a NEW handleSaved
  // function does not retroactively reach it. If handleSaved itself closed
  // over loadState/gridRange/requestKey the way a plain function
  // declaration would, a mutation that resolves after the user has
  // navigated to a different month would reconcile against the WRONG
  // (stale, pre-navigation) range/key -- and since completedResult is a
  // single {key, result} slot, that stale write would clobber the CURRENT
  // month's own already-correct state. This ref is kept current via a
  // layout effect (never written during render itself, per
  // react-hooks/refs) -- a standard "always read the latest value" pattern
  // (see React's own useEffectEvent/"latest ref" idiom) -- so the STABLE
  // callbacks below (useCallback with an empty dependency array, so their
  // own identity never changes and no stale closure of THEM can exist)
  // always read the range/state actually current at the moment they run,
  // regardless of which render's props reference reached them. A layout
  // effect (not a passive one) is used so the ref is guaranteed updated
  // before paint/before any subsequent user interaction, even though in
  // practice these callbacks are only ever invoked well after a network
  // round trip.
  const reconciliationStateRef = useRef({ loadState, gridRange, requestKey });
  useLayoutEffect(() => {
    reconciliationStateRef.current = { loadState, gridRange, requestKey };
  });

  // Stable identity (empty deps) -- clicking/activating a day always opens
  // the day-detail popup (the redesign's whole point: the popup is the
  // primary detail surface, not a permanently-visible side panel).
  // `triggerElement` (when supplied -- CalendarMonthGrid's own day button,
  // via its onActivate callback) is captured directly, the same reliable
  // pattern already used for Edit -- never inferred from
  // `document.activeElement`, which proved fragile here (DayPicker's own
  // internal click handling can itself move focus in ways that make the
  // "currently focused element" an unreliable proxy for "the element that
  // was clicked" by the time this callback runs). The mobile compact
  // selector has no per-button click hook (it uses the shared `Calendar`
  // primitive unmodified) and so falls back to `document.activeElement`
  // -- a known, narrower limitation, not exercised by any test here since
  // jsdom's default viewport never shows that selector.
  const handleSelectDate = useCallback((date: DateOnly, triggerElement?: HTMLElement) => {
    setSelectedDate(date);
    const active = triggerElement ?? document.activeElement;
    dialogTriggerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
    setActiveDialog({ mode: "day", date });
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

  // Transitions the SAME open dialog session from "day" mode into
  // "edit"/"create" mode -- `activeDialog` goes from one non-null value to
  // another, so `open` (== activeDialog !== null) never toggles false, and
  // CalendarDayDialog's single ResponsiveDialog instance never
  // unmounts/remounts. The originally-captured trigger (the day cell) is
  // deliberately left untouched, so closing from here (Cancel, a
  // successful Save, or a successful Delete -- CalendarEventForm's own
  // onClose is not mode-aware) returns focus to that day cell.
  const handleEditFromDay = useCallback((item: ManualCalendarEventItem) => {
    setActiveDialog({ mode: "edit", event: item });
  }, []);

  const handleCreateFromDay = useCallback((date: DateOnly) => {
    setActiveDialog({ mode: "create", defaultDate: date });
  }, []);

  // Runs once, after the dialog has actually closed and ResponsiveDialog's
  // own focus-return has already had its chance to run (a passive effect
  // commits after the layout effect that performs that return). If nothing
  // meaningful ended up focused -- the signature of a detached captured
  // trigger, e.g. after Delete, or an Edit that moved the event off the
  // selected day/current range -- fall back to the Add Event button, then
  // the SelectedDayAgenda heading.
  useEffect(() => {
    if (activeDialog !== null) return;
    if (!pendingFocusFallbackRef.current) return;
    pendingFocusFallbackRef.current = false;

    const active = document.activeElement;
    if (active !== null && active !== document.body) return;

    if (addEventButtonRef.current?.isConnected) {
      addEventButtonRef.current.focus();
    } else if (headingRef.current?.isConnected) {
      headingRef.current.focus();
    }
  }, [activeDialog]);

  // ---------------------------------------------------------------------
  // Calendar options (GET /api/calendar/options): lazy load, exact-key
  // cache, Retry-bypasses-cache, safe cancellation.
  // ---------------------------------------------------------------------

  const optionsCacheRef = useRef(new Map<string, LoadCalendarOptionsClientResult & { ok: true }>());
  const [completedOptions, setCompletedOptions] = useState<{
    key: string;
    result: LoadCalendarOptionsClientResult;
  } | null>(null);
  const [optionsRetryNonce, setOptionsRetryNonce] = useState(0);

  const currentIncludeProjectId = activeDialog?.mode === "edit" ? activeDialog.event.projectId : null;
  const currentIncludeClientId = activeDialog?.mode === "edit" ? activeDialog.event.clientId : null;
  // "day" mode (the day-detail popup) never renders CalendarEventForm, so it
  // has no use for project/client options -- only "create"/"edit" do.
  // Without this check, simply opening a day's popup would kick off an
  // unnecessary options request every time.
  const isFormDialogOpen = activeDialog !== null && activeDialog.mode !== "day";
  const currentOptionsKey = isFormDialogOpen
    ? optionsKeyFor(currentIncludeProjectId, currentIncludeClientId)
    : null;

  useEffect(() => {
    if (currentOptionsKey === null) return;

    const cached = optionsCacheRef.current.get(currentOptionsKey);
    if (cached) {
      setCompletedOptions({ key: currentOptionsKey, result: cached });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    loadCalendarOptionsClient({
      includeProjectId: currentIncludeProjectId,
      includeClientId: currentIncludeClientId,
      signal: controller.signal,
    }).then(
      (outcome) => {
        if (cancelled) return;
        if (outcome === null) return; // expected cancellation
        if (outcome.ok) optionsCacheRef.current.set(currentOptionsKey, outcome);
        setCompletedOptions({ key: currentOptionsKey, result: outcome });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (isCalendarAbortError(error)) return;
        setCompletedOptions({ key: currentOptionsKey, result: { ok: false, error: OPTIONS_LOAD_ERROR } });
      }
    );

    return () => {
      cancelled = true;
      controller.abort();
    };
    // optionsRetryNonce is intentionally a dependency with no other use in
    // the body: bumping it re-runs this effect for the SAME key, and since
    // a cache entry only ever exists after a SUCCESS, a retry (only ever
    // offered from the error state) always finds no cache entry and
    // performs a genuine fresh request.
  }, [currentOptionsKey, currentIncludeProjectId, currentIncludeClientId, optionsRetryNonce]);

  const handleRetryOptions = useCallback(() => {
    setOptionsRetryNonce((n) => n + 1);
  }, []);

  const optionsLoadState =
    currentOptionsKey === null
      ? null
      : completedOptions?.key !== currentOptionsKey
        ? ({ status: "loading" } as const)
        : completedOptions.result.ok
          ? ({ status: "ready", result: completedOptions.result.result } as const)
          : ({ status: "error", message: completedOptions.result.error } as const);

  const optionsLoading = optionsLoadState?.status === "loading";
  const optionsError = optionsLoadState?.status === "error" ? optionsLoadState.message : null;
  const projectOptions =
    optionsLoadState?.status === "ready" ? optionsLoadState.result.projects : EMPTY_PROJECT_OPTIONS;
  const clientOptions =
    optionsLoadState?.status === "ready" ? optionsLoadState.result.clients : EMPTY_CLIENT_OPTIONS;
  const projectsTruncated =
    optionsLoadState?.status === "ready" ? optionsLoadState.result.projectsTruncated : false;
  const clientsTruncated =
    optionsLoadState?.status === "ready" ? optionsLoadState.result.clientsTruncated : false;

  // ---------------------------------------------------------------------
  // Mutation success: increment-before-reconcile, against the CURRENT
  // range -- never the range/selectedDate captured when the dialog opened.
  // ---------------------------------------------------------------------

  // Stable identity (empty deps) -- see the reconciliationStateRef comment
  // above for why this must not be a plain function declaration recreated
  // (and closed over stale render-local consts) on every render.
  const handleSaved = useCallback((item: ManualCalendarEventItem) => {
    calendarDataVersionRef.current += 1;

    const current = reconciliationStateRef.current;
    if (current.loadState.status === "ready") {
      setCompletedResult({
        key: current.requestKey,
        result: {
          ok: true,
          items: upsertManualEventItem(current.loadState.items, item, current.gridRange),
        },
      });
    } else {
      // No current successful range to splice into -- the narrow fallback:
      // trigger one fresh load for the current visible range via the
      // existing retry/request-key mechanism, never a full page reload and
      // never the default strategy for every mutation.
      setRetryNonce((n) => n + 1);
    }

    pendingFocusFallbackRef.current = true;
  }, []);

  const handleDeleted = useCallback((itemId: string) => {
    calendarDataVersionRef.current += 1;

    const current = reconciliationStateRef.current;
    if (current.loadState.status === "ready") {
      setCompletedResult({
        key: current.requestKey,
        result: { ok: true, items: removeManualEventItem(current.loadState.items, itemId) },
      });
    } else {
      setRetryNonce((n) => n + 1);
    }

    pendingFocusFallbackRef.current = true;
  }, []);

  const dialogModeProps: CalendarDialogMode =
    activeDialog === null ? { mode: "create", defaultDate: selectedDate } : activeDialog;

  return (
    <div className="work-calendar-root">
      <style>{responsiveCss}</style>

      <div className="work-calendar-panel">
        <div className="calendar-header-row">
          <CalendarToolbar
            visibleMonth={visibleMonth}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onToday={handleToday}
          />

          <button
            ref={addEventButtonRef}
            type="button"
            className="calendar-add-event-button"
            onClick={handleOpenCreate}
          >
            Add event
          </button>
        </div>

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

            {/* Defensive, last-resort focus-fallback target (see the effect
                above): visually hidden, never part of the normal Tab order,
                but always present so a detached-trigger mutation always has
                somewhere sane to send focus even if Add event itself is
                momentarily unavailable. */}
            <h2 ref={headingRef} tabIndex={-1} className="calendar-focus-fallback-heading">
              Work Calendar
            </h2>
          </div>
        )}
      </div>

      <CalendarDayDialog
        {...dialogModeProps}
        open={activeDialog !== null}
        triggerRef={dialogTriggerRef}
        items={selectedDayItems}
        onClose={handleDialogClose}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        onEditFromDay={handleEditFromDay}
        onCreateFromDay={handleCreateFromDay}
        projectOptions={projectOptions}
        clientOptions={clientOptions}
        projectsTruncated={projectsTruncated}
        clientsTruncated={clientsTruncated}
        optionsLoading={optionsLoading}
        optionsError={optionsError}
        onRetryOptions={handleRetryOptions}
      />
    </div>
  );
}

const responsiveCss = `
  .work-calendar-root {
    display: grid;
    gap: ${dashboardSpacing[5]}px;
    min-width: 0;
    max-width: 100%;
  }

  .work-calendar-panel {
    display: grid;
    gap: ${dashboardSpacing[6]}px;
    min-width: 0;
    max-width: 100%;
    padding: ${dashboardSpacing[6]}px;
    border-radius: ${dashboardRadii["3xl"]}px;
    border: 1px solid ${dashboardColors.border.subtle};
    background: linear-gradient(160deg, rgba(37, 99, 235, 0.05) 0%, rgba(255,255,255,0.98) 38%, rgba(255,255,255,0.98) 66%, rgba(124, 58, 237, 0.05) 100%);
    box-shadow: ${dashboardShadows.sm}, ${dashboardShadows.inset};
  }

  .calendar-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${dashboardSpacing[4]}px;
    flex-wrap: wrap;
    border-bottom: 1px solid rgba(79, 70, 229, 0.14);
  }

  .calendar-add-event-button {
    min-height: 44px;
    padding: 0 22px;
    border-radius: ${dashboardRadii.lg}px;
    border: none;
    background: linear-gradient(135deg, ${dashboardColors.primary[600]} 0%, ${dashboardColors.primary[500]} 100%);
    box-shadow: ${dashboardShadows.primary};
    color: ${dashboardColors.text.inverse};
    font-family: ${dashboardTypography.fontFamily};
    font-size: ${dashboardTypography.size.sm}px;
    font-weight: ${dashboardTypography.weight.bold};
    cursor: pointer;
    transition: transform 140ms ease, box-shadow 140ms ease;
  }

  .calendar-add-event-button:hover {
    transform: translateY(-1px);
  }

  .calendar-add-event-button:focus-visible {
    outline: 3px solid ${dashboardColors.border.focus};
    outline-offset: 2px;
  }

  .work-calendar-body {
    display: grid;
    min-width: 0;
  }

  .calendar-desktop-grid,
  .calendar-mobile-selector {
    min-width: 0;
    max-width: 100%;
  }

  .calendar-desktop-grid {
    display: block;
  }

  .calendar-mobile-selector {
    display: none;
  }

  .calendar-focus-fallback-heading {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
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

  @media (max-width: ${dashboardBreakpoints.mobile}px) {
    .work-calendar-panel {
      padding: ${dashboardSpacing[4]}px;
    }

    .calendar-desktop-grid {
      display: none !important;
    }

    .calendar-mobile-selector {
      display: block !important;
    }
  }
`;
