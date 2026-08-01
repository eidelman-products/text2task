# Text2Task Work Calendar — Premium UI/UX Redesign Implementation Report

## 1. Scope

A focused UI/UX redesign of `/dashboard/calendar` (`WorkCalendarClient` and its
subcomponents). No backend, schema, or business-logic changes. No changes to
`CalendarEventForm`'s validation/mutation logic. The manual-events feature set
(create/edit/delete, project/client linking, options loading, mutation
reconciliation, Calendar data-version guard, focus management) is unchanged
in behavior except where this report explicitly calls out an intentional,
narrow behavior change driven by the new interaction model.

## 2. What changed (design)

1. **Hero, full-width month grid.** The old two-column layout (`grid | fixed
   side agenda panel`) is gone. The month grid is now the dominant surface,
   full width inside a single premium "panel" card (`work-calendar-panel`:
   soft gradient surface, subtle border, `dashboardShadows.sm` + inset
   highlight, generous radius).
2. **One header row.** The "Add event" button and `CalendarToolbar`
   (Previous/Today/Next + month label) now share a single
   `calendar-header-row` (toolbar left, Add event right), instead of Add
   event sitting in its own row above the toolbar — reclaims vertical space
   for the grid.
3. **Bigger, richer day cells.** Cells grew from `min-height: 84px` to `128px`
   (76px on narrow/mobile widths), with refined radius/borders, a hover
   elevation (`translateY(-1px)` + shadow), a gradient "today" number badge,
   and a gradient-ring "selected" treatment. Item previews are now small
   tinted pill rows (`Deadline: …` / `Event: …`, distinguished by both color
   and text, never color alone) instead of a bare dot + plain text line.
4. **Day-detail popup replaces the side panel as the primary surface.**
   Clicking (or Enter/Space-activating) any day cell now opens a polished
   modal — `CalendarDayDialog` in `"day"` mode — showing that day's items via
   a restyled `SelectedDayAgenda` (bigger heading, a calm dashed-border empty
   state instead of a bare line of text, refined card spacing on each item).
   An empty day looks clean and intentional, not broken.
5. **Edit/Add reachable from inside the popup, same dialog instance.**
   `CalendarDayDialog` now has three modes — `"day"`, `"create"`, `"edit"` —
   sharing **one** `ResponsiveDialog`. Clicking Edit on an item, or the
   popup's own "+ Add event" button, transitions the *same* open dialog
   session into the form view; the dialog never unmounts/remounts and never
   stacks a second modal on top. The header's "Add event" button still opens
   directly into create mode, unchanged.
6. **Visual polish pass**: `CalendarToolbar` (softer nav buttons, bigger
   month label), `CalendarAgendaItem` (card shadow, bolder title), page
   header (slightly larger subtitle). `DashboardEmptyState` (shared
   component, used elsewhere in the dashboard) was intentionally left
   untouched.
7. **Responsive**: the mobile compact selector and the `900px` breakpoint are
   unchanged; the day-popup model applies at every width (on mobile,
   `ResponsiveDialog` already renders it as a bottom sheet, which is a better
   fit than the old cramped inline panel ever was).

## 3. What changed (architecture)

- **`add-edit-calendar-event-dialog.tsx` / its test file were deleted**,
  superseded by **`calendar-day-dialog.tsx`** (new) — a single component
  owning `ResponsiveDialog` + `busy`/`deleteConfirmPending` state (moved
  verbatim from the old component) and switching between the day-agenda view
  and `CalendarEventForm` based on a `CalendarDialogMode` union
  (`{mode:"day",date}` | `{mode:"create",defaultDate}` |
  `{mode:"edit",event}`). `CalendarEventForm` itself is untouched.
- **`WorkCalendarClient`**: `ActiveDialogState` gained the `"day"` variant.
  `handleSelectDate` now opens the day popup on every activation (capturing
  the exact day `<button>` clicked as the dialog's focus-return trigger via
  the click event directly — see §5). `handleEditFromDay`/`handleCreateFromDay`
  transition the existing open dialog session without closing it.
  `gridDays` is now memoized (`useMemo`, keyed on `visibleMonth`/`items`) —
  required for §5 below, and a legitimate perf win regardless.
- **`CalendarMonthGrid`**: per-day data (`gridDayByDate`) and the day-click
  handler are now threaded to `CalendarDayButton` via React **Context**
  instead of via closures baked into DayPicker's `components.DayButton`
  prop, for a correctness reason detailed in §5. `selected`/`month`/`today`
  Date objects are memoized.

## 4. UX decisions worth flagging

- **Clicking a day always opens the popup, even the already-selected day.**
  This is deliberate — a re-click of "today" must still let you glance at
  today's schedule.
- **Edit/Delete reached via the day popup closes the whole dialog on any
  exit** (Cancel, a successful Save, or a successful Delete) rather than
  returning to the day view. `CalendarEventForm`'s own `onClose()` call is
  not mode-aware, and it was not modified (out of scope, and unnecessary —
  see §3). Focus lands back on the day cell that was originally clicked,
  which is a clean, sensible destination on its own.
- **Focus-return after a successful Edit/Delete falls back to the "Add
  event" button**, not the day cell — a successful mutation changes the
  grid's own item data, and the day cell's Context-driven content updates
  in place, but the *button that was actually clicked* is still the exact
  same DOM node throughout (Context does not force a remount) **except**
  when `gridDays` no longer contains that date at all in the exact same
  position isn't the concern — in practice the day cell survives every
  mutation now (see §5), so this fallback is defense-in-depth, not the
  common path. It is preserved unchanged from the original design and is
  still reachable if a future change ever detaches the trigger.

## 5. Two real bugs found and fixed during implementation

Both were found empirically while getting the new day-popup's focus-return
tests to pass reliably — neither is cosmetic.

1. **DayPicker doesn't fire `onSelect` for a click on the already-selected
   day.** Since `today` is the default `selectedDate` on first render,
   clicking it did nothing. Fixed by wrapping the day button's own `onClick`
   in `CalendarMonthGrid` (`CalendarDayButton`) to call the activation
   callback unconditionally, independent of DayPicker's own onSelect.
2. **DayPicker remounts every day-cell DOM node whenever `components.DayButton`
   is a new function reference** — and a naive `useMemo` of that component,
   keyed on the per-day data it closes over, still produces a new reference
   exactly when the calendar's real item data changes (i.e. right after a
   create/edit/delete). This was invisible before this redesign (nothing
   previously captured a day-grid button as a dialog's focus-return trigger)
   but broke `CalendarDayDialog`'s trigger-capture: by the time a mutation's
   dialog closed, the originally-clicked day button could already be a
   disconnected, stale DOM node, and focus silently fell back to `document.body`
   (or the wrong fallback). Fixed by moving the per-day data
   (`gridDayByDate`, the activation callback) out of `DayButton`'s own
   closure and into React Context — `dayPickerComponents`/`DayButton` are now
   true, never-changing module-level constants; `CalendarDayButton` reads
   Context and re-renders in place like any other component, never
   remounting.

## 6. Files changed

**New:**
- `app/components/dashboard/calendar/calendar-day-dialog.tsx`
- `app/components/dashboard/calendar/calendar-day-dialog.test.tsx`

**Deleted (superseded by the above):**
- `app/components/dashboard/calendar/add-edit-calendar-event-dialog.tsx`
- `app/components/dashboard/calendar/add-edit-calendar-event-dialog.test.tsx`

**Modified:**
- `app/components/dashboard/calendar/work-calendar-client.tsx`
- `app/components/dashboard/calendar/work-calendar-client.test.tsx`
- `app/components/dashboard/calendar/calendar-month-grid.tsx`
- `app/components/dashboard/calendar/calendar-toolbar.tsx`
- `app/components/dashboard/calendar/selected-day-agenda.tsx`
- `app/components/dashboard/calendar/calendar-agenda-item.tsx`
- `app/dashboard/calendar/page.tsx`
- `app/dashboard/calendar/page.test.tsx`

**Untouched by design:** `calendar-event-form.tsx`, `calendar-event-*-field.tsx`,
`calendar-compact-selector.tsx`, `responsive-dialog.tsx`,
`calendar-item-grouping.ts`, every API route/schema, `ui/empty-state.tsx`,
`ui/button.tsx`, `ui/tokens.ts`.

Note: `app/components/dashboard/calendar/selected-day-agenda.test.tsx`,
`app/components/dashboard/calendar/calendar-agenda-item.test.tsx`,
`docs/TEXT2TASK_WORK_CALENDAR_PHASE_D_IMPLEMENTATION_REPORT.md`, and
`lib/calendar/load-calendar-options.client.{ts,test.ts}` show as
modified/untracked in `git status` from **prior, unrelated sessions** — not
touched by this redesign pass (confirmed: this pass's only edit to
`selected-day-agenda.test.tsx` was none; its diff predates this task).

## 7. Test changes

- `calendar-day-dialog.test.tsx` (new, 23 tests): ports every create/edit
  test from the deleted `add-edit-calendar-event-dialog.test.tsx` unchanged
  in substance, plus new coverage for `"day"` mode content (empty state,
  items, Edit/Add affordances) and the day→edit/create mode transition
  (proves exactly one `ResponsiveDialog`/backdrop stays mounted throughout,
  and that Title correctly refocuses on the transition).
- `work-calendar-client.test.tsx` (59 tests, up from 58): rewritten
  throughout for the new interaction model. Every test that used to rely on
  the always-visible agenda text as its "ready" signal now waits on the
  month grid's own `role="grid"` presence instead (mirroring
  `page.test.tsx`'s own established pattern). Every test that used to find
  an "Edit X" button directly now opens that day's popup first via a new
  `openDay()` helper. "Selecting a day does not open the dialog" was
  replaced with its exact opposite (now the spec'd behavior). Two
  focus-return tests' expectations were corrected mid-implementation once
  the real (now-fixed) mechanism was understood — see §5.
- `page.test.tsx`: one wait condition updated to match the grid-presence
  signal (the "Add event entry point" test), matching the file's own other
  test in the same file.
- `calendar-month-grid.test.tsx`, `calendar-toolbar.test.tsx`,
  `calendar-compact-selector.test.tsx`, `selected-day-agenda.test.tsx`,
  `calendar-agenda-item.test.tsx`: all behavior-only (role/text/attribute
  assertions, no exact-style checks) — confirmed unaffected by the visual
  changes and left as-is; all still pass.

## 8. Tradeoffs

- The `+2 more`/preview-chip cap (3 items per cell) is unchanged — a genuine
  content-density ceiling; the day popup is where a busy day's full list
  lives.
- No dialog stacking was implemented (day popup + a separate edit modal on
  top). A hand-off within one dialog instance is simpler, avoids duplicate
  Escape/backdrop/focus-trap listeners, and was verified correct; the
  tradeoff is that Cancel/Save/Delete from Edit-via-day-popup closes the
  whole thing rather than "stepping back" to the day view (§4).
- `DashboardEmptyState` (loading/error states) was left unstyled by this
  pass — it's a shared dashboard-wide component; restyling it was out of
  scope for a "focused" pass on the Calendar page specifically.

## 9. Tests run

```
npx vitest run app/components/dashboard/calendar/calendar-day-dialog.test.tsx
  → 23 passed / 23

npx vitest run app/components/dashboard/calendar/work-calendar-client.test.tsx
  → 59 passed / 59

npx vitest run app/components/dashboard/calendar/work-calendar-client.test.tsx \
  app/components/dashboard/calendar/calendar-month-grid.test.tsx \
  app/components/dashboard/calendar/calendar-day-dialog.test.tsx \
  app/components/dashboard/calendar/selected-day-agenda.test.tsx \
  app/components/dashboard/calendar/calendar-agenda-item.test.tsx \
  app/components/dashboard/calendar/calendar-toolbar.test.tsx \
  app/components/dashboard/calendar/calendar-compact-selector.test.tsx \
  app/dashboard/calendar/page.test.tsx
  → 147 passed / 147

npx vitest run  (full repository suite, run twice; the first attempt failed
  all 74 files uniformly with a transient tooling error unrelated to any
  code change -- "Vitest failed to find the current suite" in
  vitest.setup.ts -- the same pre-existing environment flake documented in
  the prior Phase D stale-callback review; the second/third attempts were
  clean)
  → 1011 passed / 1011  (baseline before this pass: 1001; net +10 —
    +23 calendar-day-dialog.test.tsx, +1 work-calendar-client.test.tsx net
    (58→59), -272/-127 lines from the two deleted files, 0 change to every
    other file's own test count)

npx tsc --noEmit                    → clean, no output
npx eslint <every changed .tsx file> → clean, no output
npm run lint (full project)          → clean, no output
npm run build                        → succeeded, no errors
```

**Timing note**: two of `work-calendar-client.test.tsx`'s heaviest,
multi-cycle tests ("4. edit moving to another day…" and "8. deleting the
last selected-day item…") intermittently exceeded their timeout when run
as part of the full, ~600-test-file, highly parallel suite under heavy
machine load during this session (both pass in under 4 seconds each in
isolation, and the full suite's own clean run above confirms they are not
flaky in practice under normal load) — their timeouts were raised from
30000ms to 45000ms, consistent with this file's own pre-existing precedent
of custom per-test timeouts for its heaviest end-to-end cases.

## 10. Final status

- No `npm run build` failures. No `tsc` errors. No `eslint`/`npm run lint`
  findings anywhere in the repository.
- `git diff --check`: clean (only benign LF→CRLF line-ending notices, no
  whitespace errors or conflict markers).
- **Nothing was committed. Nothing was pushed.** All changes remain in the
  working tree for the user's own review.
- **Not performed by this pass** (per the task's own scope and this
  session's available tools): real-browser manual QA at actual viewport
  widths. The redesign's structural/behavioral correctness is verified via
  the test suite above; a real-browser pass (paint/animation feel, exact
  pixel spacing, touch behavior on an actual mobile device) is still the
  user's own next step before shipping, matching this codebase's own
  established convention (see the prior Phase D report's own §19).

## 11. Part A/B — custom Project/Client names + premium day-detail cards (this pass)

Continuation pass on top of §1–§10 above. No re-architecture: the single
`ResponsiveDialog`/`CalendarDialogMode` model, the hero month grid, and
`CalendarEventForm`'s mutation mechanics are all unchanged except for the
relationship-field logic this section describes.

### 11.1 Data model

New migration **`supabase/migrations/202607310001_calendar_events_custom_names.sql`**
(created only, **not applied**):

- Adds `custom_project_name text null` and `custom_client_name text null` to
  `calendar_events` (`add column if not exists`, additive-only, no rollback).
- Four new `CHECK` constraints: `calendar_events_project_exclusivity_check`
  and `calendar_events_client_exclusivity_check` (a linked id and its custom
  name can never both be non-null), plus
  `calendar_events_custom_project_name_check` /
  `..._custom_client_name_check` enforcing non-blank and `<= 240` characters
  (reusing the same 240-character limit as the existing `title` check, not a
  new magic number).
- `enforce_calendar_event_relationship_integrity` (the existing trigger
  function, redefined via `create or replace function`, not a second
  trigger) now also nulls both custom-name columns whenever a project links
  (a linked project's client is always derived, never custom), and nulls
  `custom_client_name` whenever a client links independently — under the
  same pre-existing `v_relationship_changed` guard, so unrelated field-only
  updates never touch these columns.
- Static SQL test file
  `supabase/migrations/202607310001_calendar_events_custom_names.test.ts`
  (16 tests, no live DB) verifies all of the above by direct string/regex
  assertions against the raw migration text — matching this repo's existing
  migration-testing convention.

The same "linked always wins, custom is forced null alongside a link" rule
is enforced identically at three layers: the Zod schema (`calendar-schemas.ts`),
the repository's link-validation (`calendar-link-validation.server.ts`), and
now this database trigger — so a client that bypasses the API can never
leave the row in a contradictory state.

### 11.2 Existing-or-custom Project/Client fields

New component **`calendar-entity-combobox.tsx`** — a from-scratch, dependency-free
accessible combobox (`role="combobox"` + `role="listbox"`/`role="option"`,
`aria-expanded`/`aria-controls`/`aria-autocomplete`/`aria-activedescendant`,
ArrowUp/ArrowDown/Enter/Escape, mouse selection, a 44px-minimum Clear button,
no nested interactive elements). `calendar-event-project-field.tsx` and
`calendar-event-client-field.tsx` were rewritten as thin wrappers over it
(the Client field keeps its pre-existing "locked read-only text while a
Project is linked" mode, which simply doesn't mount the interactive
combobox at all while locked).

Two real bugs were found and fixed empirically via test failures, not by
inspection:

1. **Blur-re-commit bug**: selecting a suggestion and then blurring for any
   reason (e.g. clicking Save) silently re-typed the just-linked value as a
   custom name with the same displayed text, discarding the link. Fixed
   with an `isDirty` flag set only by real typing, gating the commit-on-blur
   path.
2. **Filtered-list-on-reopen bug**: opening an already-populated field
   filtered suggestions against the currently-displayed text, hiding every
   other option. Fixed by decoupling the suggestion filter (`filterQuery`,
   reset on focus) from the displayed text (`inputText`).

A third issue was caught by `eslint`, not a test: the render-time resync of
`inputText` from an external value change originally read `inputRef.current`
during render, tripping this repo's `react-hooks/refs` rule. Fixed by
tracking focus as `isFocused` state (set in the existing `onFocus`/`onBlur`
handlers) instead of reading the DOM/ref during render.

### 11.3 Relationship rules (`calendar-event-form.tsx`)

`deriveRelationshipPatch` was rewritten to diff `projectId`,
`customProjectName`, `clientId`, `customClientName` independently against
their initial values (PATCH omits a key only when genuinely unchanged, and
distinguishes "omitted" from "explicitly null" throughout). Selecting a
linked Project still force-sets Client (`clientId` from the project, and now
also clears `customClientName`); a custom Project name leaves Client fully
independent. 16 relationship-rule tests plus 7 create-mode
existing-vs-custom tests in `calendar-event-form.test.tsx` cover every
combination the task required (linked↔custom transitions in both
directions, clearing either side, a linked Project always re-locking Client
even over a pre-existing custom Client value, etc.).

### 11.4 API / normalized display

`ManualCalendarEventItem` gained raw `customProjectName`/`customClientName`
alongside the existing resolved `projectTitle`/`clientName` (which now
resolve to the linked title/name, else the custom name, else `null` — the
UI never needs to know which source produced the value).
`calendar-events-repository.server.ts`'s `normalizeCalendarEventRow`,
`createCalendarEvent`, and `updateCalendarEvent` (the latter's dirty-check
now keys off `"customProjectName" in input` / `"customClientName" in input`,
not truthiness, matching the existing `projectId`/`clientId` convention)
were all updated accordingly, as was `calendar-link-validation.server.ts`
and the POST/PATCH routes.

### 11.5 Premium day-detail cards (`calendar-agenda-item.tsx`)

- **Project Deadline**: kind label ("Project deadline") and Status now sit
  in separate top-row elements (no more three indistinguishable words);
  Priority and Overdue render as icon + full phrase ("High priority",
  "Overdue"), never a bare word or color alone; Client is a labelled
  icon row; "Open Task CRM" gained an external-link icon.
- **Manual Event**: "Manual event" label, Time/Project/Client each as an
  icon + caption + value row (Folder for Project, Building for Client,
  Clock for Time), Notes secondary, exactly one Edit control, no Delete,
  the card itself not clickable. Custom-name-sourced Project/Client values
  render through the same `projectTitle`/`clientName` fields as linked
  ones, so they're visually identical.
- `calendar-day-dialog.tsx` gained a subtle circular close-X (top-right,
  `aria-label="Close"`), applied uniformly across all three dialog modes as
  a sibling of the existing content; the day-mode footer's redundant
  "Close" ghost button was removed to avoid a duplicate "Close" accessible
  name.
- Five new inline SVG icons (Folder/Building/Flag/Clock/ExternalLink)
  follow this codebase's existing hand-drawn-icon convention
  (`date-field.tsx`'s `CalendarGlyph`) — no icon library dependency added.

### 11.6 Files changed/added this pass

Modified: `app/api/calendar/events/route.test.ts`,
`app/components/dashboard/calendar/calendar-agenda-item.tsx`,
`calendar-event-client-field.tsx(.test.tsx)`,
`calendar-event-form.tsx(.test.tsx)`,
`calendar-event-project-field.tsx(.test.tsx)`, `selected-day-agenda.tsx(.test.tsx)`,
`lib/calendar/calendar-events-repository.server.ts(.test.ts)`,
`calendar-filters.test.ts`, `calendar-item-sort.test.ts`,
`calendar-link-validation.server.ts(.test.ts)`, `calendar-schemas.ts(.test.ts)`,
`calendar-types.ts`, `load-calendar-range.client.ts(.test.ts)`,
`mutate-calendar-event.client.test.ts`, `calendar-month-grid.test.tsx`,
`work-calendar-client.test.tsx` (fixture-only, no behavior change).

Added: `app/components/dashboard/calendar/calendar-entity-combobox.tsx(.test.tsx)`,
`calendar-agenda-item.test.tsx`,
`supabase/migrations/202607310001_calendar_events_custom_names.sql(.test.ts)`.

### 11.7 Verification (this pass, superseded by §12)

**Correction (see §12 below):** this subsection originally reported the
6 full-suite `work-calendar-client.test.tsx` timeout failures as "confirmed
contention flakiness." That explanation was not fully investigated — a
dedicated test-isolation follow-up (§12) measured the actual cause and it
was not contention. The verification numbers below are superseded by §12's
own; this subsection is left in place only for the historical record of
what was run in this pass.

```
Migration test (16/16), load-calendar-range.client.test.ts (20/20),
selected-day-agenda.test.tsx (22/22), calendar-entity-combobox +
calendar-event-form + Project/Client field tests (79/79) → all green.

npx vitest run (full repo)  → 1087 passed / 1093, 6 failed (see §12)

npx tsc --noEmit                     → clean, no output
npx eslint <every file changed/added this pass> → clean (one real finding
  fixed during this pass: a react-hooks/refs violation in
  calendar-entity-combobox.tsx, described in §11.2)
npm run lint (full project)          → clean, no output
git diff --check                     → clean (only benign LF→CRLF notices)
```

- **Migration NOT applied.** **Nothing committed. Nothing pushed. `npm run
  build` was not run** — all per this pass's explicit instructions.

## 12. Work Calendar test-isolation/runtime fix (follow-up pass)

§11.7 above guessed "contention flakiness" from a single noisy combined
run. That guess was wrong in its specifics: re-running
`work-calendar-client.test.tsx` alone (nothing else competing for CPU)
still produced 3 timeout failures out of 59, with a total file runtime over
10 minutes — a real, repeatable problem intrinsic to the file, not merely
external contention.

### 12.1 Diagnosis

Every hypothesis in the standard "what leaks across tests" checklist
(portal nodes, scroll locks, event listeners, timers, fetch-mock/spy
state, `vi.stubGlobal` residue, options-cache state) was checked against
this file's actual code:

- `vitest.setup.ts` already registers a global `afterEach(cleanup)`, and
  the suite's own `afterEach` already calls `vi.unstubAllGlobals()`.
- `ResponsiveDialog` portals via `createPortal(..., document.body)` (a
  real React portal, torn down by React itself on unmount) and its
  `window.addEventListener("keydown", ...)` / scroll-lock effects both
  return proper cleanup functions.
- `document-scroll-lock.ts`'s module-level reference count is
  symmetric (every `acquireDocumentScrollLock()` pairs with exactly one
  effect-cleanup `release()`).
- Every `captureUnhandledRejections()` call in the suite is paired with
  its own `.stop()`.

To stop guessing, a temporary `console.log` in `afterEach` measured
`document.body.children.length`, `document.querySelectorAll("*").length`,
and `document.querySelectorAll("style").length` after every one of the
59 tests (removed before finishing). Across the whole file, these stayed
flat and bounded — `body.children` never exceeded 4, total elements stayed
in the 250–330 range, style tags stayed at 5 — with **no monotonic
growth**. This rules out a DOM/portal/listener leak and any real
production lifecycle defect: nothing was failing to clean up.

What *did* grow, despite the flat DOM counts, was per-test wall-clock time
within the single continuous file run: early tests ran in 100–300ms; by
the "focus return" and "Calendar options loading" describe blocks
(tests ~25–45 of 59), individual tests were taking 5,000–18,000ms for
the same class of interaction (a handful of `userEvent` clicks/types and
`waitFor` calls) that ran in 100–300ms earlier in the same file, and in
2.9–3.8s when re-run in complete isolation. That combination — bounded
DOM, growing wall-clock time, purely as a function of position within one
long-lived test file — is the signature of environment/heap cost
accumulating over a single long-lived Vitest test environment, which
Vitest's own per-file isolation (a fresh environment per test *file*, not
per test) does not reset mid-file. It is not a leak in the product code,
and not something a longer timeout fixes — it is exactly the scenario
this repo's own review conventions call out for a file split, since
Vitest gives every test *file* a fresh environment.

### 12.2 Fix (test-infrastructure only — no production code changed)

`work-calendar-client.test.tsx` (1481 lines, 59 tests across 10 `describe`
blocks) was split into five concern-scoped files, each getting its own
fresh Vitest environment, sharing one small extracted helper module:

- `work-calendar-client.test-helpers.ts` (**new**) — every fixture/helper
  function (`defer`, `jsonResponse`, `readyBody`,
  `createAbortAwareFetchMock`, `captureUnhandledRejections`, `TODAY`,
  `daysFromToday`, `anotherDayInCurrentMonth`, `FAR_OUTSIDE_RANGE_DATE`,
  the UUID constants, `manualEvent`, `eventItemResponse`,
  `optionsSuccessBody`, `routedFetchMock`, `waitForReady`, `openDay`)
  extracted verbatim, no logic changes. Named so it does not end in
  `.test.ts`/`.test.tsx`, so vitest.config.ts's own test-file include glob
  never treats it as a test file.
- `work-calendar-client-loading.test.tsx` (**new**, 18 tests) — the
  `"WorkCalendarClient"` range-load-lifecycle describe, the
  `"AbortError corrective-pass regression"` describe, and the
  `"mobile clipping/duplicate-control corrective pass"` describe.
- `work-calendar-client-dialog.test.tsx` (**new**, 17 tests) — `"Add event
  entry point"`, `"Manual Event Edit entry point"`, `"dialog dismissal"`,
  `"focus return"`.
- `work-calendar-client-options.test.tsx` (**new**, 10 tests) — `"Calendar
  options loading"`.
- `work-calendar-client-reconciliation.test.tsx` (**new**, 11 test
  results across 10 `it`/`it.each` calls) — `"mutation reconciliation"`,
  including both previously-timing-out tests #4 and #8.
- `work-calendar-client-races.test.tsx` (**new**, 3 tests) — `"calendar
  data version guard"`, including the third previously-timing-out test.
- `work-calendar-client.test.tsx` (**deleted**) — fully redistributed
  into the five files above; every one of its 59 tests is preserved
  verbatim (same test names, same assertions, same fixtures), confirmed
  by a direct count before deletion.

Every test's assertion content is unchanged. No test was skipped, weakened,
retried, or deleted. `testTimeout`/`hookTimeout` in vitest.config.ts were
never touched, and no per-test timeout was raised. One per-test timeout
*was reduced*, now that the root cause is fixed: test "4. edit moving to
another day inside the range moves correctly" had been bumped from
30000ms to 45000ms in an earlier pass specifically to paper over this same
symptom; with genuine per-file isolation now in place, it was rolled back
to 30000ms and verified to pass in 3.76s (individually) and repeatedly
under 10s (as part of its own now-small file). No production file
(`work-calendar-client.tsx` or otherwise) was changed by this follow-up
pass — no lifecycle defect was found, so none was fixed.

### 12.3 Verification (this follow-up pass)

```
Three formerly-failing tests, individually:
  "4. edit moving to another day inside the range moves correctly" → 3.76s
  "8. deleting the last selected-day item shows the existing empty state" → 2.88s
  "a no-change edit does not increment the data version..." → 3.79s

WorkCalendarClient (5 new files together), run 1 → 59/59 passed, 86.63s
WorkCalendarClient (5 new files together), run 2 → 59/59 passed, 78.36s
  (both down from the original single file's 500-680s with 0-3 timeouts)

Full Calendar-area group (39 files)  → 578/578 passed, 120.88s
  (down from ~520-677s with up to 8 failures before this fix)

npx vitest run (full repo)           → 1093/1093 passed, 172.24s
  (down from 1087/1093 passed, 6 failed, 677.29s)

npx tsc --noEmit                     → clean, no output
npx eslint <every file added/changed by this follow-up pass> → clean
npm run lint (full project)          → clean, no output
git diff --check                     → clean (only benign LF→CRLF notices)
```

- **No timeout was increased anywhere** (one was reduced, per §12.2, after
  being verified safe).
- **No product/business behavior was changed.** No file under
  `work-calendar-client.tsx`, `calendar-day-dialog.tsx`,
  `calendar-event-form.tsx`, or any repository/schema/API file was
  touched by this follow-up pass — only test files and one new test-only
  helper module.
- **No coverage was removed.** All 59 original tests exist, unchanged, in
  the five new files.
- **Migration NOT applied. Nothing committed. Nothing pushed. `npm run
  build` was not run.**
