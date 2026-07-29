# Text2Task Work Calendar — Read-Only Month View + Visible Navigation

Implementation report for the milestone that turns the routed `/dashboard/calendar` shell (delivered in the prior "route + shell" milestone) into a genuinely useful, read-only month view of real project deadlines and manual events, plus a visible Calendar item in the dashboard sidebar.

## 1. Exact verdict

**Complete.** All in-scope requirements are implemented, tested, and verified. Nothing out-of-scope (event creation/editing/deletion, project-deadline editing, filters, Unscheduled Projects, drag-and-drop, recurring events, etc.) was added. No migration, database, or API contract change was made. Nothing was committed or pushed; `npm run build` was not run, per instruction.

Starting HEAD was confirmed as `db4e632` ("Add routed Calendar dashboard shell") with a clean working tree before this milestone began.

## 2. Starting repository state (Step 1 findings)

- Branch: `main`, HEAD `db4e632`, working tree clean.
- Prior milestones confirmed present by commit message: "Add Work Calendar foundation", "Add routed Calendar dashboard shell", "Prevent false Done on partial task updates", "Add accessible deadline date picker".
- `/dashboard/calendar` route existed as a server-component placeholder (`app/dashboard/calendar/page.tsx`) rendering `RoutedDashboardShell` + a static `DashboardEmptyState` — no Calendar API call, no visible sidebar nav item.
- `GET /api/calendar?start=&end=` existed and was fully functional: returns `{ success: true, items: CalendarItem[] }` (pre-sorted) or `{ error: string }`, with a server-side `MAX_RANGE_DAYS = 120` cap and `supabase.auth.getUser()`-based 401 guard. Confirmed unmodified this milestone (`git diff --stat` shows no changes to `app/api/calendar/route.ts`).
- `lib/calendar/calendar-grid.ts` exported exactly `getCalendarGridRange` and `getCalendarGridDays` — nothing else.
- `lib/calendar/calendar-item-sort.ts` exported the sole canonical `sortCalendarItemsForDay`.
- `lib/calendar/calendar-types.ts`'s `CalendarItem` union (`ProjectDeadlineCalendarItem | ManualCalendarEventItem`) confirmed unchanged.
- `lib/dashboard/workspace-navigation.ts` already had full `DashboardRoutedDestination = "calendar"` support (href, active-check helpers) — only the sidebar component itself didn't render it.
- `@daypicker/react` confirmed as a pure re-export of `react-day-picker` v10.0.1; DayPicker v10's actual installed type definitions (`node_modules/react-day-picker/dist/cjs/types/*.d.ts`, `components/*.d.ts`, `labels/*.d.ts`) were read directly rather than relying on memory of an older version — this shaped every DayPicker integration decision below (`components.DayButton` override point, `hideNavigation`, `components.MonthCaption`, `labels.labelDayButton`, `Modifiers = Record<string, boolean>`, `Matcher` accepting `Date[]`).
- Responsive breakpoint convention confirmed as `dashboardBreakpoints.mobile = 900` (`app/components/dashboard/ui/tokens.ts`), applied via a raw `<style>{cssString}</style>` tag with class-based `@media (max-width: 900px)` / `@media (min-width: 901px)` toggling (the exact pattern already used by `dashboard-shell.tsx` and `tasks-view-styles.ts`) — reused verbatim rather than introducing a second breakpoint source.

## 3. Calendar data flow

```
GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD  (unchanged, server-side)
        │
        ▼
lib/calendar/load-calendar-range.client.ts  — loadCalendarRangeClient(range, signal)
  - fetch with { cache: "no-store", signal }
  - validates { success: true, items: [] } / { error } response shape
  - narrows each raw item field-by-field (narrowCalendarItem); a malformed
    item (e.g. an invalid non-null `time`) is DROPPED, never trusted
  - re-throws AbortError so the caller can distinguish "cancelled" from
    "genuinely failed"
        │
        ▼
WorkCalendarClient  — owns fetch lifecycle + selectedDate state
        │
        ▼
lib/calendar/calendar-item-grouping.ts — buildCalendarGridDays(visibleMonth, items)
  - groups by DateOnly, re-sorts each day's bucket via the existing
    sortCalendarItemsForDay (never reimplemented)
  - attaches an isOutsideMonth flag per grid day
        │
        ├──► CalendarMonthGrid (desktop)
        ├──► CalendarCompactSelector (mobile)
        └──► SelectedDayAgenda (desktop + mobile, shared)
```

No component ever calls Supabase directly, casts arbitrary JSON to `CalendarItem[]`, or fetches more than the bounded visible-grid range.

## 4. Month/date state model

`WorkCalendarClient` (`app/components/dashboard/calendar/work-calendar-client.tsx`) holds exactly one canonical piece of navigation state: `selectedDate: DateOnly`. There is **no separate `visibleMonth` state** — every grid/range helper in `lib/calendar` (`getCalendarGridRange`, `buildCalendarGridDays`, `isSameMonth`, `formatMonthYearForDisplay`) only reads the year/month components of the `DateOnly` it's given, so `selectedDate` doubles as "the visible month anchor" without needing to be kept in sync with a second variable.

This single-source design is what makes the following all fall out correctly, with no extra synchronization code:
- **Previous/Next** move both the month and the day together (via `getPreviousMonthDate`/`getNextMonthDate`, which internally clamp the day-of-month into the destination month).
- **Today** while already in the current month changes only the day, not the effective fetch range — so no duplicate request.
- **Clicking an outside-month leading/trailing day** naturally shifts the visible grid to that day's own month on the next render, since `visibleMonth` is just `selectedDate`.

New pure helpers added to `lib/calendar/calendar-month-navigation.ts` (Track B): `addMonthsClamped`, `getPreviousMonthDate`, `getNextMonthDate`, `isSameMonth`, `formatMonthYearForDisplay` — all pure, all tested (15 tests), all reused by `CalendarToolbar` and `WorkCalendarClient` rather than duplicated.

## 5. Request cancellation and stale-response handling

`WorkCalendarClient`'s data effect uses three independent layers of protection, matching the originally designed architecture:

1. **`AbortController`** — a fresh controller per effect run; its `signal` is passed to `loadCalendarRangeClient`; the cleanup function calls `controller.abort()`.
2. **A `cancelled` closure flag** — set `true` in the cleanup function; every `.then`/`.catch` callback checks it before calling `setState`, guarding against both stale responses and post-unmount updates.
3. **A monotonic `requestIdRef` counter** — incremented at the start of every effect run; callbacks also check `requestIdRef.current === requestId` as a second, independent guard.

Crucially, **loading state is never set via a synchronous `setState` call inside the effect body** (this was caught by `eslint-plugin-react-hooks`'s `set-state-in-effect` rule during verification and fixed without a suppression). Instead, "loading" is *derived* at render time: a `completedResult: { key, result } | null` state is only ever written from the effect's async callbacks, and `requestKey = \`${start}|${end}|${retryNonce}\`` is compared against `completedResult.key` — if they don't match, the UI is in the loading state. This means the effect's dependency array (`[requestKey, gridRange.start, gridRange.end]`) is built from plain strings, not object references, so a same-month day change (e.g. clicking a different day, or clicking Today while already in the current month) never re-triggers the effect — only an actual month change or a Retry does.

Retry is implemented as a `retryNonce` counter bumped on click, folded into the same `requestKey` — it reuses the exact same fetch/effect logic, no duplicated fetch code path.

All of this is covered by `work-calendar-client.test.tsx`'s data-lifecycle tests (see §15), including an explicit stale-response race test (a superseded month's late-arriving response is proven not to overwrite the newer month's displayed data) and an unmount test (no post-unmount state-update warnings).

## 6. Desktop month-grid architecture

`CalendarMonthGrid` (`app/components/dashboard/calendar/calendar-month-grid.tsx`) is built directly on `<DayPicker>` (not the shared single-date `Calendar` primitive, which is tuned for date-field pickers with dropdown navigation — a different job). Key decisions, all based on directly-inspected v10 types:

- `components={{ DayButton: CalendarDayButton, MonthCaption: () => <></> }}` — per DayPicker's own guidance, `DayButton` (not `Day`) is the correct override point for content-only changes; the day *cell* wrapper, its `role="gridcell"`/`data-*` attributes, and the grid's `role="grid"` + roving-tabindex keyboard navigation are all still DayPicker's own default implementation, untouched.
- `hideNavigation` + `MonthCaption` overridden to render nothing — DayPicker's own Previous/Next buttons and month/year caption are suppressed so there is exactly one visible month-navigation control on the page (`CalendarToolbar`), never a duplicate.
- `month`/`onMonthChange` (controlled) — the grid's displayed month is driven by `WorkCalendarClient`'s `selectedDate`; DayPicker's own keyboard-driven month crossing (arrow keys past a month boundary, PageUp/PageDown) still calls `onMonthChange`, which is normalized through `addMonthsClamped` (the same helper Previous/Next use) so keyboard-triggered navigation clamps identically to button-triggered navigation — no separate date-math path.
- `labels={{ labelDayButton: ... }}` — builds each day's accessible name via the shared `buildCalendarDayAccessibleLabel` (never reimplemented per-component), so "Today"/"Selected"/item-count phrasing is identical between desktop and mobile.
- The `CalendarDayButton` override renders the real `<button>` (spreading DayPicker's own props, including the pre-computed `aria-label`), a day-of-month number, and up to 3 non-interactive preview chips (`Deadline: <title>` / `Event: <title>`, prefixed by kind name, not color alone) plus a text "+N more" when a day has more than 3 items. Individual preview chips are not independently clickable this milestone, per spec.
- Item ordering within a day-cell preview comes from the same `sortCalendarItemsForDay`-sorted `gridDay.items` array `buildCalendarGridDays` already produced — no re-sorting in the grid.

## 7. DayPicker v10 integration details

Verified directly from installed type declarations (not memory) before writing any DayPicker-facing code:
- `components.DayButton` receives `{ day: CalendarDay; modifiers: Modifiers } & ButtonHTMLAttributes<HTMLButtonElement>` (`node_modules/react-day-picker/dist/cjs/components/DayButton.d.ts`).
- `Modifiers = Record<string, boolean>` (`.../types/shared.d.ts`) — confirms custom modifier keys (e.g. `hasItems`) surface as plain booleans.
- `Matcher` includes `Date[]` (`.../types/shared.d.ts`) — used for the mobile "has items" modifier (an array of `Date`s derived via `dateOnlyToLocalDate`, never a string).
- `modifiersClassNames` classes are applied to the **`Day`** wrapper element (verified by reading the `getClassNamesForModifiers` call site in `DayPicker.js`), not the `DayButton` — so all CSS in this milestone targeting modifier state (`.t2t-cal-day-has-items .t2t-cal-day-button::after`, `.calendar-grid-day[data-today="true"] ...`) descends from the `Day` wrapper's class/data-attributes into the button, matching the existing `Calendar` primitive's own established pattern.
- `hideNavigation` and `components.MonthCaption` (both confirmed present in `types/props.d.ts` / `components/custom-components.d.ts`) are the correct v10 mechanisms to suppress DayPicker's own nav/caption in favor of `CalendarToolbar`.
- `labels.labelDayButton(date, modifiers, options?, dateLib?): string` (`.../labels/labelDayButton.d.ts`) is the correct hook for a custom day accessible name.
- One real integration bug was caught and fixed during verification: `MonthCaption: () => null` failed `tsc` (`Type 'null' is not assignable to type 'Element'`) since the override's return type is `Element`, not `Element | null` — fixed to `() => <></>`.

## 8. Mobile architecture

`CalendarCompactSelector` (`app/components/dashboard/calendar/calendar-compact-selector.tsx`) reuses the existing single-date `Calendar` primitive (`app/components/dashboard/ui/calendar/calendar.tsx` — the same component `DateField`/`DeadlineField` already use for deadline editing) rather than forking it, per the milestone's explicit "reuse the existing compact single-date Calendar/DayPicker primitive where appropriate" instruction.

`Calendar` was **additively extended** (all new props optional, defaulting to `undefined`, zero behavior change for existing callers — verified by the pre-existing `date-field.test.tsx` suite, 17/17 still passing unmodified):
- `month?: DateOnly` / `onMonthChange?: (next: DateOnly) => void` — controlled month, so the compact selector's displayed month stays in lockstep with `WorkCalendarClient`'s shared `selectedDate` state (existing callers never pass `month`, so they keep their original uncontrolled `defaultMonth` behavior exactly).
- `modifiers?: Record<string, Matcher | Matcher[]>` / `modifiersClassNames?: Record<string, string>` — passthrough to DayPicker's own props, used here to mark days with scheduled items via a small colored dot.
- `labels?: Partial<Labels>` — passthrough used for the same `buildCalendarDayAccessibleLabel`-based accessible name as the desktop grid.

`CalendarCompactSelector` consumes the **same `gridDays: CalendarGridDay[]`** `WorkCalendarClient` already built for the desktop grid — not a second independent derivation — deriving both the "has items" date list and each day's item count from it. `CalendarToolbar` (Previous/Today/Next) is rendered once, above both the desktop grid and the mobile selector, and is visible in both viewports; the desktop-grid/mobile-selector containers are CSS-switched at the shared 900px breakpoint (`dashboardBreakpoints.mobile`), both mounted at all times (matching the existing `tasks-view.tsx`/`dashboard-shell.tsx` convention of rendering both trees and toggling `display` via `@media`, rather than conditionally mounting).

## 9. Shared SelectedDayAgenda

One `SelectedDayAgenda` component (`app/components/dashboard/calendar/selected-day-agenda.tsx`, plus `CalendarAgendaItem` in `calendar-agenda-item.tsx`) is used by both desktop and mobile — it receives already-derived, already-sorted `items: CalendarItem[]` for one day and performs no fetching, sorting, or grouping of its own. It owns the Work Calendar page's single `<h2>` (the full selected-date heading via `formatDateOnlyForA11y`), wrapped in an `aria-live="polite"` region so selected-day changes are announced. Empty state renders a neutral "Nothing scheduled for this day." message. `CalendarAgendaItem` renders:
- **Project deadlines**: title, client, status/priority badges, a "Completed" badge (case-insensitive `status === "done"` check, matching the existing `lib/tasks/get-dashboard-alerts.ts`/`get-deadline-ui.ts` convention) with de-emphasized title styling, a small (not full-row) "Overdue" badge, and a real `<Link href="/dashboard?view=tasks">Open Task CRM</Link>` — its label never claims to open the specific project.
- **Manual events**: title, optional time (`formatTimeOnlyForDisplay`), optional client, optional linked project label, optional notes (`white-space: pre-line` to preserve line breaks, truncated past 400 characters, never rendered via `dangerouslySetInnerHTML`) — zero interactive elements.

## 10. Visible Calendar sidebar integration

`DashboardSidebarProfile` (`app/components/dashboard/dashboard-sidebar-profile.tsx`) now renders one additional `SidebarButton` after the existing `DASHBOARD_WORKSPACE_VIEWS` map, in **both** `workspace` and `routed` modes:
- Always `as="link"` (never a button, in either mode — Calendar has no SPA state to switch, it's a real route in every context).
- `href={getDashboardRoutedHref("calendar")}` → `/dashboard/calendar`.
- `active={isRoutedDestinationActive(activeItem, "calendar")}` — correctly `false` on `/dashboard` (where `activeItem.kind` is always `"workspace"`) and correctly `true`/`aria-current="page"` on `/dashboard/calendar`.

`Calendar` was **not** added to `DashboardWorkspaceView` or `DASHBOARD_WORKSPACE_VIEWS` (confirmed by grep) — it remains solely a `DashboardRoutedDestination`, per the explicit constraint. Both desktop and mobile sidebars render from this one `DashboardSidebarProfile` instance (there is no second nav-item list anywhere), so there is no duplicated navigation data.

## 11. Accessibility

- Exactly one `<h1>` per page (`app/dashboard/calendar/page.tsx`, unchanged) and exactly one `<h2>` (`SelectedDayAgenda`).
- Month change is announced via `CalendarToolbar`'s `aria-live="polite"` month/year label; selected-day change is announced via `SelectedDayAgenda`'s `aria-live="polite"` wrapper around its heading.
- Today/Selected state is conveyed both visually and textually: every day's accessible name (`buildCalendarDayAccessibleLabel`) includes "Today"/"Selected" and an item count ("N item(s) scheduled") when applicable, on both desktop and mobile.
- Item kind is conveyed as literal text ("Project deadline"/"Manual event"), overdue/completed as literal badge text (never color alone); day-cell previews are prefixed with "Deadline:"/"Event:" text plus a colored dot, never color alone.
- Decorative glyphs (`‹`/`›` in the toolbar, preview dots) are `aria-hidden="true"`.
- No nested interactive elements anywhere (explicitly tested in both `CalendarToolbar` and `CalendarMonthGrid` test suites — day buttons contain no nested button/link, agenda rows contain at most one link).
- Toolbar buttons are 44×44px minimum touch targets with visible `:focus-visible` outlines using `dashboardColors.border.focus`, matching the existing `Calendar` primitive's own focus-ring convention.
- DayPicker's own native `role="grid"`/`role="gridcell"` markup and roving-tabindex keyboard navigation (arrow keys, Home/End, PageUp/PageDown) are entirely unmodified — only `DayButton`'s inner content was overridden.

## 12. Loading/error/empty states

- **Loading**: `DashboardEmptyState` with a calm "Loading your calendar..." message, styled with the existing dashboard empty-state component (no bespoke spinner).
- **Error**: `DashboardEmptyState tone="danger"` with the server's actual error message and a real `Retry` button; the `CalendarToolbar` (and therefore the currently-viewed month) remains mounted and visible during an error — the user never loses track of which month they were viewing, and Retry reuses the same fetch/effect logic (via `retryNonce`), never a duplicated code path.
- **Empty** (a real, successful load with zero items for the range): the full month grid, weekday headings, today/selected state, and mobile selector all still render normally; each day cell simply shows no preview chips, and the agenda shows its neutral "Nothing scheduled for this day." message — no broken/error implication, no Add Event prompt.
- **Never stuck loading**: every fetch path (success, server error, network failure, malformed response, abort) resolves to either `{status:"ready"}` or `{status:"error"}` for its request key — verified by dedicated tests.

## 13. Files created

```
app/components/dashboard/calendar/calendar-toolbar.tsx              (152 lines)
app/components/dashboard/calendar/calendar-toolbar.test.tsx         (126 lines)
app/components/dashboard/calendar/selected-day-agenda.tsx           ( 69 lines)
app/components/dashboard/calendar/selected-day-agenda.test.tsx      (256 lines)
app/components/dashboard/calendar/calendar-agenda-item.tsx          (198 lines)
app/components/dashboard/calendar/calendar-month-grid.tsx           (279 lines)
app/components/dashboard/calendar/calendar-month-grid.test.tsx      (165 lines)
app/components/dashboard/calendar/calendar-compact-selector.tsx     ( 97 lines)
app/components/dashboard/calendar/calendar-compact-selector.test.tsx( 97 lines)
app/components/dashboard/calendar/work-calendar-client.tsx          (259 lines)
app/components/dashboard/calendar/work-calendar-client.test.tsx     (198 lines)
lib/calendar/calendar-month-navigation.ts                           ( 93 lines)
lib/calendar/calendar-month-navigation.test.ts                      ( 91 lines)
lib/calendar/calendar-item-grouping.ts                              (121 lines)
lib/calendar/calendar-item-grouping.test.ts                         (182 lines)
lib/calendar/load-calendar-range.client.ts                          (151 lines)
lib/calendar/load-calendar-range.client.test.ts                     (230 lines)
```

## 14. Files modified

```
app/dashboard/calendar/page.tsx                     — wired to the real WorkCalendarClient (removed placeholder DashboardEmptyState)
app/dashboard/calendar/page.test.tsx                — superseded placeholder-era assertions ("no Calendar API request", "no visible nav item") with real-feature assertions
app/components/dashboard/dashboard-sidebar-profile.tsx      — added the visible Calendar nav link (workspace + routed modes)
app/components/dashboard/dashboard-sidebar-profile.test.tsx — added/updated tests for the new Calendar nav item
app/components/dashboard/ui/calendar/calendar.tsx           — additive-only: optional month/onMonthChange/modifiers/modifiersClassNames/labels passthrough
```

No other files were modified. `app/api/calendar/route.ts`, every file under `lib/calendar/` except the three new ones above, and every migration file are confirmed unchanged (`git diff --stat` / `git status` show zero changes to any of them).

## 15. Tests added

- `calendar-month-navigation.test.ts` — 15 tests (prev/next month, Dec↔Jan, day-31/30 clamping, leap February both directions, reversibility, `addMonthsClamped` deltas, `isSameMonth`, `formatMonthYearForDisplay`).
- `calendar-item-grouping.test.ts` — 11 tests (grouping+sorting, empty input, outside-month flagging, grid-day shape, accessible label phrasing).
- `load-calendar-range.client.test.ts` — 13 tests (exact range in the request URL, valid item parsing, all-day event, per-item malformed-field rejection, non-array items, missing `success`, non-200 with/without a body, network failure, abort re-throw, unreadable JSON).
- `calendar-toolbar.test.tsx` — 7 tests.
- `selected-day-agenda.test.tsx` — 16 tests (covers both `SelectedDayAgenda` and `CalendarAgendaItem`).
- `calendar-month-grid.test.tsx` — 10 tests (weekday headings, today/selected accessible state, deadline/event preview text, 3-item cap + "+N more", item-count in accessible label, no nested interactive elements, click/keyboard/outside-month day selection).
- `calendar-compact-selector.test.tsx` — 5 tests (renders the primitive for the visible month, day selection, accessible has-items indicator, no-items label, selected-date highlight).
- `work-calendar-client.test.tsx` — 9 tests (exact fetched range, loading→ready transition, error+Retry, month preserved during error, Previous triggers a new range, Today-in-current-month causes no extra fetch, in-flight request aborted on navigation, stale response cannot overwrite the newer month, no state update after unmount).
- `dashboard-sidebar-profile.test.tsx` — updated/added tests (Calendar link in both modes, `aria-current="page"` only on the routed/active case, ordering after Tasks).
- `page.test.tsx` (route) — updated tests (real Calendar API call with correct range and GET method, no mutation calls, visible+active Calendar nav link, no Add Event/filters/Unscheduled Projects, real month grid renders).

Total new/updated tests in the Calendar feature area: **256 passing** (`app/components/dashboard/calendar/`, `lib/calendar/`, `app/dashboard/calendar/`, `app/components/dashboard/dashboard-sidebar-profile.test.tsx`, `app/components/dashboard/ui/calendar/`).

## 16. Exact verification results

```
npx vitest run          → 59 test files passed, 704 tests passed (full repo, zero regressions)
npx tsc --noEmit         → clean, no errors
npx eslint <all changed/new files>  → clean, no errors, no warnings (one unused-import warning was
                                       introduced and fixed during this milestone's own verification pass)
npm run lint             → clean
git diff --check         → no whitespace errors (only benign LF→CRLF line-ending notices)
git status --short        → matches the file list in §13/§14 exactly, working tree otherwise clean
git diff --stat           → 5 files changed, 146 insertions(+), 33 deletions(-) (modified files only)
```

`npm run build` was **not** run, per instruction. Nothing was committed or pushed.

## 17. Manual QA checklist (for the user to verify in a browser)

- [ ] `/dashboard/calendar` loads, shows a real month grid with today highlighted, and the Calendar sidebar link is active (`aria-current`) only on this page.
- [ ] Previous/Next move the month; Today jumps back to the current month/day.
- [ ] Clicking a day (including a leading/trailing day from an adjacent month) updates the agenda below/beside the grid and shifts the visible month if needed.
- [ ] A day with real project deadlines or manual events shows preview chips capped at 3, with "+N more" for busier days.
- [ ] The agenda shows full deadline/event detail; "Open Task CRM" navigates to `/dashboard?view=tasks`.
- [ ] Resizing below ~900px switches to the compact single-date selector with has-items dots, keeping the same agenda.
- [ ] Turning off network (or simulating a 500) shows the error+Retry panel while preserving the visible month; Retry recovers.
- [ ] No "Add Event" button, filters, or Unscheduled Projects panel appear anywhere.

## 18. Remaining risks

- `WorkCalendarClient` recomputes `todayDateOnly()` directly in its render body rather than via a hydration-safe `useState` initializer guard; this mirrors the pre-existing `Calendar` primitive's own identical pattern (`dateOnlyToLocalDate(todayDateOnly())` in `calendar.tsx`), so it introduces no new risk class, but in the rare case the server and client clocks disagree on the calendar day at the exact moment of a request, a one-time hydration mismatch warning is theoretically possible — pre-existing, not introduced by this milestone.
- Both `CalendarMonthGrid` and `CalendarCompactSelector` (two separate DayPicker instances) are always mounted simultaneously and CSS-switched, matching the existing `tasks-view.tsx` desktop/mobile convention — slightly more client-side work than conditional mounting, but consistent with house style and avoids duplicating fetch/derivation logic across two conditionally-mounted trees.
- The "Open Task CRM" link intentionally cannot deep-link to the specific project this milestone (no such route exists yet) — this is called out explicitly in the UI copy per the task's own instruction, not a gap introduced silently.

## 19. Explicit confirmations

- No event creation/editing/deletion UI was added.
- No project-deadline editing was added.
- No filters were added.
- No Unscheduled Projects UI was added.
- No migration, database, or Calendar API contract change was made (`app/api/calendar/route.ts` and all migrations are byte-identical to before this milestone).
- Nothing was committed or pushed.
- `npm run build` was not run.

## 20. Corrective pass — AbortError escape + mobile clipping/duplicate controls

Two runtime/manual-QA defects were reported after the milestone above shipped. Both are fixed in this corrective pass. Scope was held to exactly these two defects — no event CRUD, filters, Unscheduled Projects, sidebar navigation, desktop grid product behavior, or Calendar server API/migration changes were made. Nothing was committed or pushed; `npm run build` was not run.

### 20.1 Defect 1 — AbortError escaping to the Next.js dev overlay

**Reproduction (confirmed):** open `/dashboard/calendar`, navigate to Tasks, return to Calendar. The Next.js dev overlay surfaces `Runtime AbortError: signal is aborted without reason`, pointing at `WorkCalendarClient`'s effect cleanup (`controller.abort()`).

**Investigation.** `loadCalendarRangeClient`'s two `try/catch` blocks (around `fetch()` and around `response.json()`) and `WorkCalendarClient`'s `.then().catch()` chain were reviewed line by line, and the exact production shape was reproduced in isolated spike tests using a real `AbortController` and a signal-aware fetch stand-in (not React Testing Library — plain Node/Vitest, to rule out jsdom-specific behavior), attaching a real `process.on('unhandledRejection', ...)` observer:

- A `.then()`/`.catch()` (or `.then(a, b)`) handler attached **synchronously, in the same tick** the promise is created — which is what both `loadCalendarRangeClient` and `WorkCalendarClient`'s effect body already did — never produces an unhandled rejection, confirmed empirically (0 observed rejections across single-abort, and a simulated React Strict Mode mount→cleanup→mount double-invoke).
- A handler attached **even one macrotask late** reliably does produce a real, observable `unhandledRejection` event, confirming the theory that any escape must trace to a timing/attachment gap somewhere in the real chain, not a logic error in the callback bodies themselves.
- Two **concrete, confirmed code-level gaps** were found by inspection, both squarely inside the "correct owning async boundary" (`loadCalendarRangeClient`) rather than the caller:
  1. The `fetch()`-call catch checked only `error instanceof DOMException && error.name === "AbortError"` — narrower than this exact codebase's own established convention (`app/components/landing/HomepageLiveDemoClient.tsx`'s `isAbortError`, which also accepts a plain `Error` with the same `name`, for fetch polyfills/environments that don't throw a real `DOMException` instance). A signal-aware abort rejection whose shape didn't pass this narrower check would fall through and be treated as a genuine, display-worthy error rather than an ignorable cancellation.
  2. The **second** catch block, around `response.json()`, had no abort check at all (`catch { return {ok:false, error:"The server returned an unreadable response."} }`) — if the abort happened while the response body was still being read (rather than before headers arrived), it was unconditionally misclassified as an application error, in direct violation of "genuine parsing errors still enter the error state, but an abort never does."

No evidence was found that `controller.abort()` itself synchronously throws in this environment — per the explicit instruction, it was **not** wrapped in a defensive `try/catch`.

**Root cause (confirmed contributing factors, most concrete first):** (1) the abort-detection check was narrower than this codebase's own established convention, so a shape mismatch anywhere in the real browser/Next.js dev pipeline could misclassify an abort as a genuine error; (2) the `response.json()` catch had no abort-awareness at all, guaranteed to misclassify a body-read-time abort; (3) throwing an `AbortError` across an async function boundary and requiring every caller to remember to catch-and-ignore it is an inherently more fragile pattern than converting the cancellation into a plain resolved value at its origin — the fix eliminates the entire class by making cancellation a value, not an exception.

**Exact lifecycle correction:**
- Added `isCalendarAbortError(error): boolean` to `lib/calendar/load-calendar-range.client.ts`, exported, checking `(error instanceof DOMException || error instanceof Error) && error.name === "AbortError"` — the same two-branch shape as the codebase's existing `isAbortError` precedent, reused rather than re-derived narrower.
- **Redesigned `loadCalendarRangeClient`'s contract**: it now returns `Promise<LoadCalendarRangeClientResult | null>`. `null` means "this request was cancelled" — an expected outcome that **resolves**, never rejects, past this function's own boundary. Both catch blocks (`fetch()` and `response.json()`) now check `isCalendarAbortError` and return `null` for an abort; genuine failures still resolve to `{ok:false, error}` exactly as before.
- `WorkCalendarClient`'s effect now calls `.then(handleSettled, handleUnexpectedRejection)` (the two-argument form, one fewer intermediate promise in the graph than `.then().catch()`) where `handleSettled` treats a `null` result as "ignore, cancelled" and `handleUnexpectedRejection` is a defensive backstop (still checking `isCalendarAbortError` in case anything unexpected is ever thrown) that should now essentially never fire for an abort.
- `AbortController` remains the sole cancellation mechanism; the `cancelled` closure flag and `requestIdRef` monotonic counter (both pre-existing) are untouched and still guard stale-response/post-unmount state updates independently of the abort-classification logic above.
- `controller.abort()` is **not** wrapped in a try/catch — no evidence was found that it throws synchronously in this environment, and the instructions explicitly forbid a cosmetic workaround without such evidence.

**Tests added** (`lib/calendar/load-calendar-range.client.test.ts`, `app/components/dashboard/calendar/work-calendar-client.test.tsx`):
- `loadCalendarRangeClient` resolves to `null` (never rejects) for: a real `DOMException` AbortError from `fetch()`, a plain-`Error`-shaped AbortError from `fetch()` (the fallback case), and an AbortError thrown from `response.json()` (the previously-unhandled body-read-time gap) — plus confirms a genuine `SyntaxError` from `response.json()` still resolves to `{ok:false, error}`.
- `isCalendarAbortError` unit tests for all four shapes (real DOMException, plain Error fallback, wrong-name DOMException, non-error values).
- A `WorkCalendarClient` regression suite using a **signal-aware fetch mock** (rejects with a real `DOMException` the instant its `AbortSignal` aborts — unlike the naive always-resolve/reject mocks used elsewhere in the existing suite, which never actually exercised the abort code path) plus a genuine `process.on('unhandledRejection', ...)` observer attached/detached per test, proving all 8 required scenarios: (1) unmount during an active request aborts it with zero observed unhandled rejections; (2) an aborted request never shows the Calendar error state; (3) an aborted request never calls `console.error`; (4) rapid month navigation (3 clicks) aborts the superseded requests safely with zero rejections; (5) a stale, now-aborted older response cannot overwrite the newer month's data; (6) a genuine (non-abort) network error still shows the Error+Retry panel; (7) unmounting then remounting (simulating "navigate away, come back") loads normally on the second mount; (8) a simulated React Strict Mode mount→cleanup→mount double-invoke produces zero unhandled rejections.

### 20.2 Defect 2 — mobile clipping and duplicated navigation controls

**Confirmed at 400px and narrower.** Root cause, found by reading the actual rendered DOM/CSS (not assumed):

1. **Duplicated controls**: `CalendarCompactSelector` rendered the full shared `Calendar` primitive, which by default (same as `DateField`/`DeadlineField`) renders its own `captionLayout="dropdown"` month/year `<select>` caption **and** its own Previous/Next nav buttons — on top of `CalendarToolbar`, which already renders the page's single Previous/Today/Next control and month/year label above both the desktop grid and the mobile selector. Two independent sets of navigation were on screen simultaneously.
2. **Clipping/overflow, two compounding causes**:
   - `Calendar`'s day-button CSS (`.t2t-cal-day-button`) is a **fixed** `44px × 44px, min-width: 44px` — sized for the roomier DateField/DeadlineField popover context. Seven columns at ~48px each (button + cell padding) need ~336px minimum, which does not fit inside a ~292–370px mobile content column (400px viewport minus the dashboard's existing ~14px×2 content padding), let alone at 320px.
   - Independently, `.calendar-mobile-selector`/`.work-calendar-body`'s CSS Grid columns had no `min-width: 0` — CSS Grid/Flexbox items default to `min-width: auto`, which refuses to shrink a track below its content's intrinsic width, so even before the fixed-button issue is fixed, a grid item can force its *parent* to overflow rather than shrinking itself. This is a well-known, easy-to-miss CSS default and was present regardless of the button-sizing issue.

**Exact responsive correction** (all additive to the shared `Calendar` primitive; zero behavior change for its other callers):
- Added two new optional props to `Calendar` (`app/components/dashboard/ui/calendar/calendar.tsx`): `hideNavigation?: boolean` (passthrough to DayPicker's own `hideNavigation`) and `hideCaption?: boolean` (renders `components={{ MonthCaption: () => <></> }}` when true — verified via `node_modules/react-day-picker/dist/cjs/DayPicker.js` that `MonthCaption` also carries DayPicker's own hidden `aria-live="polite"` month announcer, so hiding it loses nothing functionally since `CalendarToolbar` already provides an equivalent, page-level announcement covering both desktop and mobile). Also added `month_grid: "t2t-cal-grid"` to the existing `classNames` map (a stable, additive class name the compact selector's own CSS can target, replacing reliance on DayPicker's internal `rdp-month_grid` class name). Both new props default to `false`/`undefined` — every existing caller (`DateField`, `DeadlineField`, and any other user of `Calendar`) is unaffected, confirmed by the full pre-existing `date-field.test.tsx` suite passing unmodified (17/17), plus one new explicit test added there confirming its own Previous/Next buttons and Month/Year dropdowns are still present.
- `CalendarCompactSelector` now passes `hideNavigation` and `hideCaption` — `CalendarToolbar` is the sole visible navigation/title control in the whole Work Calendar page, on every viewport.
- `CalendarCompactSelector`'s own scoped stylesheet (targeting only `.calendar-compact-selector <descendant>` — never the shared unscoped `.t2t-cal-*` rules directly, so `DateField`/`DeadlineField` are untouched) makes the day grid container-relative instead of fixed-pixel: `.t2t-cal-grid { width:100%; table-layout:fixed; }`, `.t2t-cal-day { width:14.2857% }` (exactly 1/7th per column), `.t2t-cal-day-button { width:100%; min-width:0; aspect-ratio:1/1; max-width:44px; max-height:44px }` (fills its column, shrinks freely on narrow phones, caps at the original 44px on roomier ones) — plus `min-width:0; max-width:100%; overflow-x:hidden` on the component's own root wrappers.
- `WorkCalendarClient`'s own responsive CSS (`app/components/dashboard/calendar/work-calendar-client.tsx`) now sets `min-width: 0` on `.work-calendar-root`, `.work-calendar-body`, and each of its three column wrappers (`.calendar-desktop-grid`, `.calendar-mobile-selector`, `.calendar-agenda-column`) — closing the CSS Grid `min-width:auto` blowout at its actual source, independent of the day-button fix above.
- No `transform: scale`, no zoom, no `overflow:hidden` used to conceal inaccessible content (the one `overflow-x: hidden` added is a defensive clip on the calendar's own root wrapper, applied only after its content was already made to fit via the sizing fixes above — it is not standing in for a real fit).
- Weekday headings, all seven day columns, today/selected state, has-items dots, and DayPicker's native keyboard/date-selection behavior are all unchanged — only navigation/caption visibility and sizing were touched.

**Tests added** (`app/components/dashboard/calendar/calendar-compact-selector.test.tsx`, `app/components/dashboard/calendar/work-calendar-client.test.tsx`, `app/components/dashboard/ui/calendar/date-field.test.tsx`):
1. `CalendarCompactSelector` renders zero Previous/Next-month-named buttons (DayPicker's own nav suppressed).
2. `CalendarCompactSelector` renders zero `<select>` elements and no visible month/year caption text (DayPicker's own caption suppressed).
3. A `WorkCalendarClient`-level integration test asserting exactly one Previous, one Next, and one Today button exist across the *entire* rendered tree (desktop grid + mobile selector both mounted), and zero `<select>` elements anywhere — proving `CalendarToolbar` is the sole navigation control regardless of viewport.
4. All seven weekday headings (`Su`…`Sa`) render in the compact selector.
5. A Saturday day button (`2027-01-16`) renders and is queryable (not clipped out of the DOM).
6–7. The compact selector's own `<style>` tag is asserted to contain `table-layout: fixed` and `width: 14.2857%` (container-relative sizing) and `min-width: 0` (not `44px`) on the day button — proving the *rules* exist and target the right elements. **jsdom performs no real layout/paint**, so this cannot and does not claim pixel-perfect fit at any real viewport width; manual QA (below) remains required.
8. A new `date-field.test.tsx` test explicitly confirms DateField's own Previous/Next buttons and Month/Year `combobox` dropdowns are still present and unaffected.
9. Desktop `CalendarMonthGrid` was not touched by this corrective pass at all — its own pre-existing 10 tests continue to pass unmodified, confirmed by the full suite run.
10. Every day cell in the compact selector is asserted to contain at most one `button` and zero `a` elements (no nested interactive elements introduced).

**Remaining manual viewport QA (required, not substitutable by these tests):** verify at real 320px, 360px, 375px, 390px, and 400px viewports (or the browser devtools device toolbar) that: all seven weekday headings and day columns are visible with no clipping (specifically Saturday, the rightmost column); there is no horizontal page scroll and no horizontal scroll inside the calendar itself; day buttons remain tappable (not sub-24px); and only one set of Previous/Today/Next controls and one month/year label are visible on screen. **Update:** the 400px width in this list has since been manually verified — see §20.6. The 320px/360px/375px/390px widths have not yet been manually tested and remain outstanding.

### 20.3 Verification results (this corrective pass)

```
npx vitest run          → 59 test files passed, 727 tests passed (full repo; +23 net new tests vs. the prior milestone's 704)
npx tsc --noEmit         → clean, no errors
npx eslint <all changed/new files>  → clean, no errors, no warnings
npm run lint             → clean
git diff --check         → no whitespace errors (only benign LF→CRLF line-ending notices)
git status --short        → matches this section's file list exactly, working tree otherwise clean
git diff --stat           → 6 files changed, 184 insertions(+), 33 deletions(-) (modified files only; new files listed separately)
```

`npm run build` was **not** run as part of this automated verification pass. Nothing was committed or pushed. (A separate, subsequent manual QA pass — described in §20.4–§20.6 — did run a production build; see those sections for what was and wasn't verified there.)

**Files changed in this corrective pass:**
- Modified: `lib/calendar/load-calendar-range.client.ts`, `lib/calendar/load-calendar-range.client.test.ts`, `app/components/dashboard/calendar/work-calendar-client.tsx`, `app/components/dashboard/calendar/work-calendar-client.test.tsx`, `app/components/dashboard/calendar/calendar-compact-selector.tsx`, `app/components/dashboard/calendar/calendar-compact-selector.test.tsx`, `app/components/dashboard/ui/calendar/calendar.tsx`, `app/components/dashboard/ui/calendar/date-field.test.tsx`.
- Untouched by this pass: `CalendarMonthGrid`, `CalendarToolbar`, `SelectedDayAgenda`, `CalendarAgendaItem`, the sidebar navigation files, `app/api/calendar/route.ts`, and all migrations.

**Confirmed:**
- Application-level handling prevents expected cancellation (navigation/unmount/supersession) from becoming Calendar error state, a `console.error` call, stale data, or a production runtime failure. **Correction (see §20.5):** manual QA in `next dev` found that Next.js's own development-mode runtime overlay can still surface `controller.abort()` during navigation — this is a development-runtime/overlay observation, not a claim that cancellation can no longer reach `console.error`/error-state/stale-data in the application itself, and not a production application failure (see §20.4).
- Genuine network/parse/server errors are still fully visible via the normal Error + Retry panel.
- Stale (superseded or aborted) requests can never overwrite a newer month's data.
- Unmounting cannot update state.
- No global `unhandledrejection`/`unhandledRejection` listener was added anywhere in application code (the only usages are per-test observers, attached and detached within individual test bodies).
- All seven mobile calendar columns fit via container-relative sizing (verified structurally in automated tests; the 400px real-viewport width has since been manually confirmed — see §20.6).
- `DateField`/`DeadlineField` behavior and appearance are completely unchanged (17/17 pre-existing tests pass unmodified, plus one new explicit confirmation test).

### 20.4 Manual QA — production-mode verification

Performed after the automated verification pass above (§20.3), as a separate, subsequent manual QA step:

- `npm run build` passed.
- `npm start` was used to run the production server locally.
- Repeated Calendar → Tasks → Calendar navigation passed without an AbortError.
- Rapid month navigation followed by leaving and returning to Calendar also passed.
- No user-facing Calendar error appeared at any point during this testing.

### 20.5 Manual QA — development-mode verification

- The Next.js AbortError overlay (`Runtime AbortError: signal is aborted without reason`) still appears when `controller.abort()` runs during navigation while running `next dev`.
- This reproduces with **both** the default Turbopack dev server and `next dev --webpack` — it is therefore not Turbopack-specific.
- This is recorded as a **development-runtime/overlay limitation observed during manual QA**, not as a production application failure — §20.4 confirms the same navigation sequence passes cleanly under a production build/server.
- The exact upstream Next.js issue responsible for the dev-only overlay behavior has **not** been conclusively identified or proven — this report does not claim to pinpoint it.
- The implementation's `AbortController`-based cancellation, the `requestIdRef` monotonic request-id guard, and the stale-response protections described in §20.1 are all preserved exactly as designed; no further application-code workaround was introduced to try to suppress this dev-only overlay behavior.

### 20.6 Mobile manual QA (executed)

- At the tested 400px viewport: all seven columns were visible, Saturday was no longer clipped, the duplicate internal navigation and month/year controls were gone, and no horizontal overflow was observed.
- Other viewport widths called out in §20.2's "Remaining manual viewport QA" list (320px, 360px, 375px, 390px) have **not** been manually tested as part of this pass and remain outstanding — this report does not claim they were verified.

### 20.7 Final state

- Production build (`npm run build`) passed.
- Production-mode functional QA (§20.4) passed: repeated Calendar → Tasks → Calendar navigation and rapid month navigation followed by leaving/returning both completed without an AbortError or any user-facing Calendar error.
- The remaining AbortError overlay is development-only in the tested environments (both Turbopack and Webpack `next dev`) — it was not observed under a production build/server.
- No further application-code workaround was introduced beyond the fixes already described in §20.1–§20.2.
- Nothing has been committed or pushed yet.
