# Text2Task Work Calendar — Responsive Dialog + Nested Overlay Infrastructure (Phase A) Implementation Report

Status: **Implemented.** This report documents the real code produced from `docs/TEXT2TASK_WORK_CALENDAR_RESPONSIVE_DIALOG_MAPPING.md` after its final corrective pass (the four corrections below), plus one narrowly scoped post-implementation correction (§2). No Manual Event form, no `AddEditCalendarEventDialog`, no Work Calendar mutation UI, and no migration of any of the other eight existing modals was implemented — all remain explicitly out of scope, per the mapping's own §5.

---

## 1. Four corrections applied to the mapping document

Applied to `docs/TEXT2TASK_WORK_CALENDAR_RESPONSIVE_DIALOG_MAPPING.md`, preserving its 24 top-level sections:

1. **§7** — the portal structure is one `createPortal` call rendering three direct siblings (backdrop, panel, nested-overlay host) via a `Fragment`, not backdrop-wraps-panel. No `document.createElement`/`appendChild`/`removeChild` anywhere.
2. **§11** — `focus-trap.ts` gained `matchesFocusableSelector`; `ResponsiveDialog`'s `initialFocusRef` validity check (`isUsableInitialFocusTarget`) uses it instead of an ad-hoc `:disabled` check, plus a separate `aria-disabled="true"` attribute read. No unsafe casts anywhere in the check.
3. **§8** — the nested-overlay registry is `activeNestedOverlayIdsRef: useRef<Set<string>>` only; no `useReducer`, `forceUpdate`, or version counter, since no rendered JSX depends on the registry's contents.
4. **§19** — the exact file list below was locked in and implemented as specified; no private scroll-lock counts or registry `Set` were exposed for test convenience.

---

## 2. Post-implementation correction: backdrop defense-in-depth

An earlier version of this report and the corresponding code stated that `ResponsiveDialog`'s backdrop `mousedown` handler checked only `busy`, relying entirely on native hit-testing to keep a backdrop click from closing the outer dialog while a nested overlay is open. That deviated from the locked Phase A contract, which requires the nested-overlay registry to be checked as defense in depth, not omitted.

**Corrected handler contract** (`app/components/dashboard/ui/responsive-dialog.tsx`, `handleBackdropMouseDown`):

1. Ignore the event unless `event.target === event.currentTarget`.
2. Return when `busy`.
3. Read `activeNestedOverlayIdsRef.current.size` synchronously at event time.
4. Return when the Set is non-empty.
5. Otherwise call `onRequestClose()`.

No React state, version counter, or new context field was added — the fix reads the same internal `useRef<Set<string>>` the Escape/Tab handlers already read.

**Test added** (`app/components/dashboard/ui/responsive-dialog.test.tsx`, "checks the nested-overlay registry as defense in depth on a direct backdrop mousedown"): a test-only `TestNestedOverlayConsumer` component registers/unregisters through the existing public `useNestedOverlayHost()`/`registerNestedOverlay`/`unregisterNestedOverlay` functions (never reaching into the internal Set). It proves: a direct `mousedown` dispatched on the backdrop element does **not** call `onRequestClose` while the nested overlay is registered, and the identical dispatch **does** call it exactly once after the nested overlay unregisters (unmounts). This is additive to, not a duplicate of, the existing native-hit-testing-oriented outside-click tests.

---

## 3. Files created

| File | Purpose | Tests |
|---|---|---|
| `app/components/dashboard/ui/focus-trap.ts` | `FOCUSABLE_SELECTOR`, `getFocusableElements`, `matchesFocusableSelector` — extracted verbatim from `DatePickerPopover`'s prior file-local logic | `focus-trap.test.ts` — 10 tests |
| `app/components/dashboard/ui/use-is-mobile.ts` | `useIsMobile` — extracted verbatim from `DatePickerPopover`'s prior file-local hook | covered indirectly via both consumers' own suites, per the mapping's own §19 |
| `app/components/dashboard/ui/document-scroll-lock.ts` | `acquireDocumentScrollLock` — new, module-level, reference-counted shared scroll lock | `document-scroll-lock.test.ts` — 6 tests |
| `app/components/dashboard/ui/responsive-dialog.tsx` | `ResponsiveDialog`, `useNestedOverlayHost`, `NestedOverlayContextValue` (three fields: `hostElement`, `registerNestedOverlay`, `unregisterNestedOverlay`) | `responsive-dialog.test.tsx` — 31 tests |
| `app/components/dashboard/ui/calendar/date-picker-popover-nested.test.tsx` | Dedicated, exclusive home for every nested-integration behavior (`ResponsiveDialog` + `DateField`/`DatePickerPopover` together) | 20 tests |
| `docs/TEXT2TASK_WORK_CALENDAR_RESPONSIVE_DIALOG_IMPLEMENTATION_REPORT.md` | This report | — |

## 4. Files modified

| File | Change |
|---|---|
| `app/components/dashboard/ui/calendar/date-picker-popover.tsx` | Replaced the file-local `FOCUSABLE_SELECTOR`/query and `useIsMobile` with the new shared modules; added `useNestedOverlayHost()`, a stable `useId()` registration id, a `useLayoutEffect`-timed nested registration + capture-phase Escape listener, a conditional portal target (standalone → `document.body` unchanged; nested-but-not-yet-hosted → renders `null` and waits; nested-and-hosted → portals into the host), and a nested-only branch onto `acquireDocumentScrollLock()` for the mobile scroll lock. Standalone behavior is unchanged — no prop, export, or JSX-structure change. |
| `docs/TEXT2TASK_WORK_CALENDAR_RESPONSIVE_DIALOG_MAPPING.md` | The four corrections in §1 above (the mapping document's own final corrective pass, applied before implementation began). |

**"No other file was touched" means**: no application or test file beyond the exact files listed in §3/§4 above was created or modified — specifically, `tokens.ts`, `date-field.tsx`, `date-field.test.tsx`, and all eight other existing modals remain untouched, and this correction pass (§2) touched only `responsive-dialog.tsx`, `responsive-dialog.test.tsx`, and this report.

---

## 5. Test results

- **New tests**: 67 (10 + 6 + 31 + 20), across the four new test files in §3 — not chasing the mapping's own earlier, non-binding estimate of 56 (§17's own Correction 4: "do not chase an arbitrary exact test count").
- **Regression guard**: `date-field.test.tsx`'s full, completely unmodified 18-test suite re-run and passing against the updated `date-picker-popover.tsx` — proving standalone behavior is unaffected by the nested-integration change.
- **Full suite**: `npx vitest run` → **819 passed / 819** (previous Phase B baseline: 752; net +67, matching the new-test count above, zero regressions elsewhere).

---

## 6. Verification commands run (this correction pass)

```
npx vitest run app/components/dashboard/ui/responsive-dialog.test.tsx
  → 31 passed / 31

npx vitest run app/components/dashboard/ui/calendar/date-picker-popover-nested.test.tsx
  → 20 passed / 20 (unmodified file, re-run against the corrected primitive)

npx vitest run
  → 64 test files passed, 819 tests passed

npx tsc --noEmit
  → clean, no output

npx eslint app/components/dashboard/ui/responsive-dialog.tsx app/components/dashboard/ui/responsive-dialog.test.tsx
  → clean, no output

npm run lint
  → clean, no output

git diff --check
  → only a benign LF→CRLF line-ending notice on the modified, tracked file
    (date-picker-popover.tsx); no whitespace-error or conflict-marker output

git status --short
  → 1 modified (date-picker-popover.tsx) + 8 untracked new files, exactly
    matching §3/§4 above; nothing else changed

git diff --stat
  → date-picker-popover.tsx | 110 ++++++++++++++-------  (1 file changed,
    72 insertions(+), 38 deletions(-)) — responsive-dialog.tsx and
    responsive-dialog.test.tsx are untracked (new) files, so their content
    does not appear in `git diff`; their changes were verified directly via
    Read/Edit and the vitest/eslint/tsc runs above
```

`npm run build` was **not** run. Nothing was committed or pushed. Build, real-browser manual QA, commit, and push remain the user's own steps.

---

## 7. Notable implementation decisions (all within the mapping's locked design)

- **Presentation styling**: since the mapping's §13/§15 fixed the branching model (desktop centered / mobile bottom sheet) but left exact dimensions to implementation, the desktop panel centers via `position: fixed; top/left: 50%; transform: translate(-50%, -50%)` (a standalone fixed panel, since it has no wrapping flex parent — panel and backdrop are siblings, §7) with `maxWidth: 560`, and the mobile panel is bottom-anchored (`left/right/bottom: 0`) — both modeled directly on `DatePickerPopover`'s own proven style-object split, per §15.
- **Backdrop click handler**: checks `busy`, then the nested-overlay registry (`activeNestedOverlayIdsRef.current.size`), then calls `onRequestClose` — see §2 for the correction history. Native hit-testing remains the primary real-browser mechanism (per §10 outcomes 2/3: a nested popover's own full-viewport overlay physically intercepts a click before it reaches the outer backdrop); the registry check is defense in depth for cases hit-testing alone doesn't cover (e.g. jsdom, which performs no real hit-testing, or any future caller that dispatches directly).
- **Outer Tab-trap ordering during nested-overlay-open**: `ResponsiveDialog`'s own Tab handler and `DatePickerPopover`'s own (pre-existing, unconditional) Tab handler are both bubble-phase `window` listeners; correctness does not depend on their relative order, since `ResponsiveDialog`'s handler unconditionally no-ops whenever `activeNestedOverlayIdsRef.current.size > 0`, regardless of which listener runs first for a given keypress.

No implementation blocker or failing test surfaced during this pass; no further design revision to the mapping was necessary.
