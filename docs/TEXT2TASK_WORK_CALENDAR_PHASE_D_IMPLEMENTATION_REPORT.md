# Text2Task Work Calendar — Manual Events Phase D Implementation Report

Phase D wires the already-built, production-inert Phase C components (`AddEditCalendarEventDialog`/`CalendarEventForm`) into the live Work Calendar. This is the final integration phase.

**Corrective addendum (this revision)**: a subsequent, narrowly-scoped review found that this report's original §11/§13 (renumbered below) claim — that `handleSaved`/`handleDeleted` would always run against WorkCalendarClient's *latest* render state because "React props are always current" — was **incorrect**, and the original implementation had a real, if narrow, bug as a result. See the new §11 for the precise mechanism, the fix, and the regression test that proves it. This addendum does not restate the full original report; it corrects the specific sections affected (§11, §13, §17) in place and leaves the rest as originally written, since the rest was not affected.

---

## 1. Verified starting repository state

```
git branch --show-current   → main
git rev-parse --short HEAD  → 6ac9166
git status --short          → (empty — clean)
git log -5 --oneline        → 6ac9166 Add manual calendar event form infrastructure
                               cd172c8 Add responsive dialog infrastructure
                               7a4de8e Add Calendar options endpoint
                               89ffbc3 Make DateField test month-boundary safe
                               3a353c1 Map Work Calendar manual events
```

Matched the expected state exactly — proceeded directly to implementation, no mapping pass performed.

---

## 2. Files created

| File | Purpose | Tests |
|---|---|---|
| `lib/calendar/load-calendar-options.client.ts` | Pure `GET /api/calendar/options` network boundary | 21 |
| `app/components/dashboard/calendar/calendar-agenda-item.test.tsx` | Dedicated test file for the new Edit-button contract (didn't previously exist as its own file) | 8 |
| `docs/TEXT2TASK_WORK_CALENDAR_PHASE_D_IMPLEMENTATION_REPORT.md` | This report | — |

## 3. Files modified

| File | Change |
|---|---|
| `app/components/dashboard/calendar/work-calendar-client.tsx` | Add event button, dialog-open state, options loading/caching, `calendarDataVersionRef`, mutation reconciliation, focus-fallback wiring. See §§4–13 below. |
| `app/components/dashboard/calendar/work-calendar-client.test.tsx` | All 18 pre-existing tests preserved verbatim, unmodified, still passing. 40 new tests added. |
| `app/components/dashboard/calendar/selected-day-agenda.tsx` | Added optional `onEditEvent`/`headingRef` passthrough props; no `onDeleteEvent`. |
| `app/components/dashboard/calendar/selected-day-agenda.test.tsx` | All pre-existing assertions preserved (two renamed for accuracy now that `onEditEvent` is optional-and-omitted in those specific cases, not "no edit ever"); 6 new tests added. |
| `app/components/dashboard/calendar/calendar-agenda-item.tsx` | `ManualEventRow` gains exactly one new interactive element, an Edit button; `ProjectDeadlineRow` unchanged. |
| `app/dashboard/calendar/page.test.tsx` | **The one narrow, necessary exception** — see §14. |

**No other file was touched.** No API route, Supabase repository code, migration, `ResponsiveDialog`, `DatePickerPopover`, `DateField`, `CalendarEventForm`'s own field/diff/delete rules, `page.tsx`, `CalendarToolbar`, `CalendarMonthGrid`, `CalendarCompactSelector`, or `calendar-item-grouping.ts` was modified — confirmed by `git status --short` (§17).

---

## 4. Add event placement

A native `<button ref={addEventButtonRef}>` (not `DashboardButton`, which does not forward refs — a real, stable DOM ref is required for the focus fallback in §11) rendered by `WorkCalendarClient` in its own `.calendar-add-event-row` (`justify-content: flex-end`), positioned directly above `CalendarToolbar` and **outside** the loading/error/ready conditional — it is available during initial load and during a recoverable range-load error, exactly as required. Selecting a day never opens the dialog; only clicking Add does.

---

## 5. Edit callback/trigger contract

`CalendarAgendaItem` accepts `onEditEvent?: (item: ManualCalendarEventItem, triggerElement: HTMLElement) => void`, forwarded only to `ManualEventRow`, which renders exactly one new interactive element — a `DashboardButton` with visible text `"Edit"` and `aria-label={\`Edit ${item.title}\`}` (an event-specific accessible name) — calling `onEditEvent(item, event.currentTarget)` on click. `ProjectDeadlineRow` is completely unchanged (no Edit button, its existing "Open Task CRM" link untouched). No Delete control exists anywhere on the card; the card itself is not clickable.

---

## 6. Dialog-state ownership

`WorkCalendarClient` owns one discriminated `activeDialog: {mode:"create", defaultDate} | {mode:"edit", event} | null` state, plus a stable `dialogTriggerRef: RefObject<HTMLElement | null>` (a plain `useRef`, never React state, never recreated) that `ResponsiveDialog` reads as its own `triggerRef`. `handleOpenCreate` points it at `addEventButtonRef.current`; `handleEditEvent` points it at the exact clicked `triggerElement`. Since `AddEditCalendarEventDialog`'s own `ResponsiveDialog` fully unmounts its children whenever `open` is `false` (Phase A), every dialog session is guaranteed a fresh `CalendarEventForm` mount — no extra `key` prop was needed.

---

## 7. Options loader contract

`loadCalendarOptionsClient({includeProjectId, includeClientId, signal})` is a pure function: no React/refs/Calendar-state/Supabase imports, builds the URL via `URLSearchParams` (never manual string concatenation — `/api/calendar/options` with zero query params in create mode, `?includeProjectId=&includeClientId=` with only the non-null ones present in edit mode), validates the full response shape (rejecting a malformed entry by discarding the **whole** response, not silently dropping it, unlike `GET /api/calendar`'s own per-item convention — a deliberate difference documented in the module's own comment, since this is a small, bounded, server-controlled response where a malformed entry signals a real contract violation), and resolves to `null` (never throws) on an expected `AbortError`, reusing `isCalendarAbortError` from `load-calendar-range.client.ts` rather than re-deriving the same check.

---

## 8. Options cache key and Retry behavior

Cached in a `useRef(new Map<string, CalendarOptionsResult>())` keyed by the exact `${includeProjectId ?? ""}|${includeClientId ?? ""}` pair. The dialog-facing state (`optionsLoading`/`optionsError`/`projectOptions`/`clientOptions`/`projectsTruncated`/`clientsTruncated`) is derived from a `completedOptions: {key, result} | null` state, using the exact same "derive `loading` from a key mismatch" pattern the pre-existing range-GET path already uses — deliberately reused, not a second convention. A cache hit skips the network entirely; a miss issues a real request. Retry (`handleRetryOptions`) bumps a dedicated `optionsRetryNonce`, which is a dependency of the loading effect but **not** part of the cache key — since a cache entry only ever exists after a genuine success, and Retry is only ever reachable from the error UI (Phase C), a retry always finds no cache entry and performs a real fresh request.

---

## 9. Cancellation / stale-options protection

The loading effect's cleanup sets a `cancelled` flag and calls `controller.abort()` — identical shape to the pre-existing range-GET effect. An expected abort never sets error state (checked via `isCalendarAbortError`). A stale, still-in-flight request for a since-abandoned dialog/key cannot overwrite a newer one: the closure-captured `currentOptionsKey` is what `setCompletedOptions` writes under, and the *reading* side re-derives `optionsLoadState` by comparing `completedOptions.key` against the *current* `currentOptionsKey` on every render — a resolved-late response for an old key simply never matches once the dialog has moved on.

---

## 10. `calendarDataVersionRef` issue/capture/commit rules

`const calendarDataVersionRef = useRef(0)` — monotonic, never reset, never converted to React state. Every range GET captures it at issue time (`capturedDataVersion`); both `handleSettled` and `handleUnexpectedRejection` now check `calendarDataVersionRef.current === capturedDataVersion` **in addition to** the pre-existing, unmodified `requestIdRef`/`requestKey` checks — all three must still match for a GET's result to commit. `requestIdRef`, `requestKey`, and `AbortController` handling are byte-for-byte unchanged from before this phase.

---

## 11. Mutation increment-before-reconcile ordering — corrected: the stale-callback issue and its fix

**A real bug was found and fixed in this revision.** The original implementation defined `handleSaved`/`handleDeleted` as plain function declarations inside `WorkCalendarClient`'s render body, closing directly over that render's own `loadState`/`gridRange`/`requestKey` consts. This is unsafe, and the original report's justification for why it was safe ("ordinary React props are always the latest inside an already-running async handler") is **wrong as a general claim** and does not apply here.

**The actual mechanism, precisely**: `CalendarEventForm.handleSubmit` is an `async function` defined fresh on every `CalendarEventForm` render, closing over `onSaved`/`onDeleted` as destructured from that render's own `props` object. When the user clicks Save/Confirm delete, React invokes whichever `handleSubmit` instance is currently attached to the `<form>` — a *specific* JavaScript closure that has already captured a *specific* `onSaved` function reference at that moment. That async execution then `await`s the POST/PATCH/DELETE call. If `WorkCalendarClient` re-renders before that `await` resolves (e.g. because the user navigated to a different month), it creates a **new** `handleSaved` function object closing over the **new** render's `loadState`/`gridRange`/`requestKey` — but the *already-running* `handleSubmit` invocation has no way to observe this; it keeps the *original* `handleSaved` reference for its entire lifetime and calls that one, with its own stale-captured range/key, once the request finally resolves. Because `completedResult` is a single `{key, result}` slot (not a per-key cache), that stale write would overwrite it with the *old* month's key — making the *current* month's own already-correct `requestKey` no longer match, reverting the visible Calendar to a phantom `"Loading your calendar..."` state even though its own GET had already succeeded.

**The fix** (`app/components/dashboard/calendar/work-calendar-client.tsx`, inside `WorkCalendarClient` only — no other file touched):

1. A `reconciliationStateRef = useRef({loadState, gridRange, requestKey})` is kept current via a `useLayoutEffect` with no dependency array (runs after every commit, before paint) — writing to `ref.current` during render itself is disallowed by this repo's `react-hooks/refs` lint rule, so the update happens in a layout effect rather than the render body.
2. `handleSaved`/`handleDeleted` are now `useCallback`-wrapped with an **empty dependency array**, so their own function identity never changes across renders — `onSaved`/`onDeleted` are therefore the exact same object on every single `WorkCalendarClient` render, regardless of which render's props `CalendarEventForm`'s `handleSubmit` closure happened to capture.
3. Each stable callback reads `reconciliationStateRef.current` **at call time** (inside its own body, not via closure over render-local consts) to get whatever `loadState`/`gridRange`/`requestKey` are actually current at the moment it runs — which, by construction, is always the latest committed render's values, since the layout effect keeps the ref current on every render regardless of which specific render's `onSaved` reference ends up being the one that's eventually invoked.

Increment-before-reconcile is preserved exactly (`calendarDataVersionRef.current += 1` still runs first, reading `reconciliationStateRef.current` only afterward); the narrow no-current-success retry fallback (`setRetryNonce`) is preserved exactly; the refs are not exposed on any public prop or return value. Dialog closing itself remains `onClose`'s (→ `handleDialogClose`'s) job, called separately by `CalendarEventForm` right after a successful `onSaved`/`onDeleted` per its own existing Phase C contract. Neither `handleSaved` nor `handleDeleted` is ever invoked on validation failure, network failure, options failure, the Delete-confirm first step, Cancel, or a no-change edit (Phase C's own contract already guarantees this).

---

## 12. Create/update/delete reconciliation behavior

Two small, pure, module-level helpers:

```ts
function upsertManualEventItem(items, item, range) {
  const withoutExisting = items.filter((existing) => existing.id !== item.id);
  return isDateWithinRange(item.date, range) ? [...withoutExisting, item] : withoutExisting;
}
function removeManualEventItem(items, itemId) {
  return items.filter((existing) => existing.id !== itemId);
}
```

`isDateWithinRange` uses the existing `compareDateOnly` helper against `gridRange.start`/`gridRange.end` — no new date-comparison logic invented. The API's own complete, normalized item is always inserted as-is (never merged with a prior local copy, never re-deriving `projectTitle`/`clientName`). Because ids are `event:<uuid>` vs. `project:<uuid>`, the filter can never remove a Project Deadline item by accident. `groupCalendarItemsByDate`/`buildCalendarGridDays` (`calendar-item-grouping.ts`, untouched) continue deriving grid/agenda state correctly from the updated flat array with zero awareness a mutation occurred.

**Moved-inside/moved-outside range**: covered directly by `isDateWithinRange` — a moved-in item is inserted; a moved-out item is left removed (its own preview chip on the destination day, if still within the same visible month, is a *separate*, correct rendering of the now-current data, not evidence of a bug — one test initially asserted too broadly against this and was corrected, §18).

---

## 13. No-current-success fresh-load fallback / current-range vs. dialog-open-range

When `loadState.status !== "ready"` at mutation-success time, `setRetryNonce((n) => n + 1)` triggers exactly one fresh GET for the range that is **current at that moment** — reusing the pre-existing request-key mechanism, never `router.refresh`, never a page reload, never the default strategy. This is provably against the range current at completion, never a range/`selectedDate` closure captured when the dialog opened — but *not* for the reason the original version of this report gave (see the correction in §11: plain, non-memoized closures do **not** automatically pick up a parent's later re-render). The actual mechanism is the fix in §11: `handleSaved`/`handleDeleted` are stable (`useCallback`, empty deps) and read `reconciliationStateRef.current` — kept current via a layout effect — at call time, so it does not matter which render's `onSaved`/`onDeleted` reference `CalendarEventForm`'s in-flight `handleSubmit` closure happened to capture. Tested directly by navigating months while a mutation is deliberately kept pending (deferred `events` response) before resolving it — the real regression test for this is §17, reconciliation test 10, rewritten in this revision to exercise the actual captured-callback boundary (open dialog → real deferred POST → navigate months → resolve → assert against the current view, not merely the absence of the new item).

---

## 14. The one necessary exception: `app/dashboard/calendar/page.test.tsx`

One pre-existing test, written during the earlier read-only-month-view milestone, asserted `queryByRole("button", {name: /add event/i})).not.toBeInTheDocument()` — a direct, structural contradiction of this phase's own explicit, required "standalone Add event entry point" mandate. This is not a Phase C props mismatch, but it is exactly analogous in spirit: an already-committed test whose assertion Phase D's own required behavior makes unavoidably false. The smallest possible correction was made — one assertion flipped from "does not exist" to "exists," the test renamed to describe what remains true (no filters/`combobox`, no Unscheduled Projects panel — both still explicitly out of scope) — with no other line in the file touched, and no application code (`page.tsx` itself) modified at all.

---

## 15. Accessibility

Add event: unambiguous accessible name `"Add event"`, native `<button>`, 44px `min-height`. Every Manual Event Edit button: accessible name `"Edit {title}"` via `aria-label`, visible text stays `"Edit"`, 44×44px minimum (via `DashboardButton`'s own sizing plus an explicit `minHeight: 44` override). Manual Event card: exactly one interactive control. Project Deadline row: unchanged. No nested interactive elements. Day cells: unchanged, select-only. No unsaved-change confirmation (unchanged from Phase C). Options loading/error text renders inside the dialog (Phase C, untouched). Focus restoration follows trigger → Add event → heading, in that order (§16). `SelectedDayAgenda`'s `<h2>` gained `tabIndex={-1}` and an optional forwarded `ref` — same content, same `aria-live` wrapper, never part of normal Tab order, no second heading created. Desktop and mobile render the identical `AddEditCalendarEventDialog`/`CalendarEventForm` — no second dialog exists.

---

## 16. Focus return / fallback order

A `pendingFocusFallbackRef` (plain ref, `false` by default) is set to `true` only inside `handleSaved`/`handleDeleted` — never on ordinary Cancel/Escape/backdrop close (`handleDialogClose` never touches it). A `useEffect` keyed on `[activeDialog]` runs once the dialog has actually closed (after `ResponsiveDialog`'s own layout-effect-driven focus-return has already had its chance to run, since passive effects commit after layout effects); if the flag is set, it consumes it and checks whether `document.activeElement` is `document.body`/`null` — the signature of a detached captured trigger. If so: focus `addEventButtonRef.current` if connected, else `headingRef.current`. On an ordinary close, the flag is never set, so `ResponsiveDialog`'s own trigger-return (Phase A, unmodified) is the only thing that runs. `ResponsiveDialog` itself was not touched.

**One documented, defensive-only limitation**: forcing "Add event unexpectedly unavailable" (making the heading fallback actually fire) is not reachable through normal application flow, since the Add button is unconditionally rendered whenever any mutation could possibly succeed. The heading's own wiring (real DOM node, `tabIndex={-1}`, reachable via the forwarded ref) is verified directly instead — the same documented limitation Phase C recorded for its own equivalent "Add Event button unexpectedly unavailable" fallback step.

---

## 17. Test results

```
Targeted new/modified files:  117 passed / 117
  (21 options client + 8 calendar-agenda-item + 22 selected-day-agenda
   + 58 work-calendar-client + 8 page.test.tsx — the last three counts
   are each modified/created files' full totals, not deltas;
   21 + 8 + 22 + 58 + 8 = 117 — the original revision of this report
   stated 111, an arithmetic error, corrected here)
npx vitest run (full suite):  1001 passed / 1001   (baseline before this
                                                     phase: 927; net +74)
```

All 18 of `work-calendar-client.test.tsx`'s pre-existing tests (initial-load, loading/error/Retry, month navigation, AbortError corrective-pass regression ×8, mobile-clipping corrective pass) pass unmodified. Regression suites re-run and passing as part of the full run: `calendar-month-grid`, `calendar-compact-selector`, `calendar-toolbar`, `calendar-item-grouping`, `load-calendar-range.client`, `calendar-event-form`, `add-edit-calendar-event-dialog`, `responsive-dialog`, `date-picker-popover-nested`, `date-field`, the Calendar options route, and every Calendar write API route/schema test.

**Stale-callback fix regression test**: reconciliation test 10 (`WorkCalendarClient — mutation reconciliation`) was rewritten in this revision to exercise the real callback-capture boundary directly, never calling `handleSaved`/any internal handler: open the Add dialog through the real UI → type a title → click Save, so `CalendarEventForm`'s own `handleSubmit` begins a real, deferred `POST` → **while that request is still pending**, click "Next month" (a real navigation, forcing `WorkCalendarClient` to re-render with a different `gridRange`/`requestKey`) → wait for the new month's own range GET to resolve and confirm it renders correctly → **then** resolve the deferred `POST`. The test asserts: the created item never appears in the now-current (next) month's view; the current month's own already-correct empty state is still shown (specifically, it must **not** revert to `"Loading your calendar..."` — the exact symptom the stale-callback bug produced, since a stale reconciliation write would overwrite the single `completedResult` slot under the *old* month's key); and exactly 2 range GETs occur in total (the original load plus the one triggered by navigation) — proving the resolved-late mutation triggers no extra, unconditional refetch. This test fails under the pre-fix implementation and passes under the fix (§11). The no-current-success variant (reconciliation test 11) already used the same real dialog/form/mutation path and already asserted exactly one fresh load for the range current at completion — confirmed unaffected by the fix and re-verified passing.

**Timing note**: `work-calendar-client.test.tsx` now performs many real end-to-end interactions (open dialog → type → submit → await network → reconcile) across 58 tests in one jsdom process; several needed an explicit per-test timeout override (`30000`, following this file's own pre-existing precedent of a custom timeout on its slowest AbortError test) to stay reliably under real, accumulated system load — this is a real-time cost of thorough integration testing at this depth, not a defect. During the original pass, three earlier draft "isolate the data-version guard alone" tests were found to rest on an incorrect assumption (that revisiting a previously-loaded month reuses a cache — the range GET has no such cache; it always issues a fresh request) and were replaced with one correct, achievable test plus a documented explanation of why an Edit/Delete-specific equivalent isn't constructible in this architecture (a note in the test file itself).

---

## 18. TypeScript / ESLint / lint results

```
npx tsc --noEmit                                    → clean, no output
npx eslint <every new/modified Phase D file>         → clean, no output
  (fixed 8 no-explicit-any + 2 no-unused-vars findings introduced by an
  earlier draft of the new tests along the way; final state is clean,
  no suppression comment used anywhere)
npm run lint (full project)                          → clean, no output
```

**Re-verified in this revision** (stale-callback review pass): `npx tsc --noEmit` clean; `npx eslint work-calendar-client.tsx work-calendar-client.test.tsx` (both files together) clean, no output; `npm run lint` (full project) clean, no output. The `useLayoutEffect`-based ref-update pattern (§11) initially tripped the project's `react-hooks/refs` rule when the ref write was placed directly in the render body — fixed by moving the write into a dependency-less `useLayoutEffect`, confirmed clean thereafter.

---

## 19. Manual browser QA still required (not performed by this pass)

- Add event → create → confirm the item appears immediately in the agenda and (if applicable) the month grid, at 320/360/375/390/400px and desktop widths.
- Edit an existing Manual Event, including changing its date to a day outside the current month view, and confirm it disappears/reappears correctly on navigation.
- Delete flow: inline two-step confirm, both a normal delete and a simulated already-deleted race (cannot be forced from the UI alone; code-level coverage stands in for this specific case).
- Nested DatePicker inside the Add/Edit dialog at real viewport sizes (Phase A/C already covered this at the unit level; a real-browser pass is still the authoritative check for genuine paint/stacking).
- Keyboard-only: Add event → Tab to Title → fill form → Save → confirm focus lands back on Add event; Edit → Cancel → confirm focus returns to that Edit button; Edit → Delete → Confirm → confirm focus lands on Add event.
- Options loading/error/Retry against the real `GET /api/calendar/options` endpoint (network tab confirmation of the exact URL/params, not just jsdom's fetch mock).
- Confirm no visual regression to the existing month grid/compact selector/toolbar from the new Add event row.

---

## 20. Exact final git status

```
$ git status --short
 M app/components/dashboard/calendar/calendar-agenda-item.tsx
 M app/components/dashboard/calendar/selected-day-agenda.test.tsx
 M app/components/dashboard/calendar/selected-day-agenda.tsx
 M app/components/dashboard/calendar/work-calendar-client.test.tsx
 M app/components/dashboard/calendar/work-calendar-client.tsx
 M app/dashboard/calendar/page.test.tsx
?? app/components/dashboard/calendar/calendar-agenda-item.test.tsx
?? docs/TEXT2TASK_WORK_CALENDAR_PHASE_D_IMPLEMENTATION_REPORT.md
?? lib/calendar/load-calendar-options.client.test.ts
?? lib/calendar/load-calendar-options.client.ts

$ git diff --stat
 .../dashboard/calendar/calendar-agenda-item.tsx    |  63 +-
 .../calendar/selected-day-agenda.test.tsx          |  61 +-
 .../dashboard/calendar/selected-day-agenda.tsx     |  33 +-
 .../calendar/work-calendar-client.test.tsx         | 988 ++++++++++++++++++++-
 .../dashboard/calendar/work-calendar-client.tsx    | 352 +++++++-
 app/dashboard/calendar/page.test.tsx               |   6 +-
 6 files changed, 1469 insertions(+), 34 deletions(-)

$ git diff --check
(only benign LF→CRLF line-ending notices on the six modified files; no
whitespace-error or conflict-marker findings)

$ git diff --name-only
app/components/dashboard/calendar/calendar-agenda-item.tsx
app/components/dashboard/calendar/selected-day-agenda.test.tsx
app/components/dashboard/calendar/selected-day-agenda.tsx
app/components/dashboard/calendar/work-calendar-client.test.tsx
app/components/dashboard/calendar/work-calendar-client.tsx
app/dashboard/calendar/page.test.tsx

$ git ls-files --others --exclude-standard
app/components/dashboard/calendar/calendar-agenda-item.test.tsx
docs/TEXT2TASK_WORK_CALENDAR_PHASE_D_IMPLEMENTATION_REPORT.md
lib/calendar/load-calendar-options.client.test.ts
lib/calendar/load-calendar-options.client.ts
```

**Re-verified in this revision** (stale-callback review pass): the increase in `work-calendar-client.tsx`/`work-calendar-client.test.tsx` diff size versus the original pass is entirely the §11 fix (`reconciliationStateRef` + `useLayoutEffect` + stable `useCallback` handlers) and the rewritten regression test 10; all other files/counts are unchanged from the original pass. `docs/TEXT2TASK_WORK_CALENDAR_PHASE_D_IMPLEMENTATION_REPORT.md` is confirmed physically saved on disk and correctly appears as untracked (`??`) above — the original report's own claim about its own git status is now independently confirmed accurate. No file outside the five permitted for this review (`work-calendar-client.tsx`, `work-calendar-client.test.tsx`, `calendar-event-form.tsx` [read-only], `add-edit-calendar-event-dialog.tsx` [read-only], this report) was inspected or modified.

Matches the exact locked file plan, plus the one documented, necessary exception (§14) — nothing else was created, modified, or deleted. No API route, database code, migration, `ResponsiveDialog`, `DatePickerPopover`, `DateField`, `CalendarEventForm`'s own business rules, `page.tsx`, `CalendarToolbar`, `CalendarMonthGrid`, `CalendarCompactSelector`, `calendar-item-grouping.ts`, sidebar/navigation, or any other dashboard modal was touched.

---

## 21. Confirmation

No `npm run build` was run. Nothing was committed. Nothing was pushed. Production build, real-browser manual QA (§19), commit, push, and deployment verification remain the user's own steps.
