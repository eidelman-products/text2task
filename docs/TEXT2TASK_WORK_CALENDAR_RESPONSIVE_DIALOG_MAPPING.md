# Text2Task Work Calendar — Responsive Dialog + Nested Overlay Infrastructure (Phase A) Mapping

Status: **Mapping only.** No application code, tests, dependencies, configuration, APIs, database files, or migrations were modified. The only new file created by this task is this report.

---

## 1. Executive verdict

Phase A is buildable as a small, self-contained, generic dialog primitive plus a narrow, opt-in integration path on the one existing overlay it must coordinate with (`DatePickerPopover`). Nothing about the current repository blocks this.

**The primitive itself (`ResponsiveDialog`) can be built with zero production consumer in Phase A.** No existing code needs it yet — the Add/Edit Manual Event form (Phase C) is the first real consumer, and Phase A's own test suite is sufficient to prove the primitive correct in isolation. Building a throwaway demo route or a visible "test harness page" is unnecessary and explicitly rejected (§18): a `.test.tsx` file rendering `ResponsiveDialog` directly with React Testing Library is the correct, zero-footprint harness. **Manual QA is not, however, entirely deferred to Phase C** — this report's own earlier draft over-deferred it. `ResponsiveDialog`'s own new chrome genuinely has no production consumer yet and its manual QA correctly waits for Phase C, but Phase A's own refactor of `date-picker-popover.tsx` (§16) and the extraction of `use-is-mobile.ts`/`focus-trap.ts` out of it (§11/§13) touch **existing, already-shipped, production-reachable** `DateField`/`DeadlineField` project-deadline-editing UI — that surface gets a real manual regression pass now, as part of Phase A itself, with no temporary route or harness needed since it's already reachable in production today (§18). This is the smallest correct approach: automated tests plus one real, already-shippable regression pass, avoiding both an unused demo UI and a false claim that nothing needs eyes-on verification until Phase C.

**The nested-overlay coordination problem has three genuinely separate sub-problems, each with a different, deterministic mechanism — not one shared trick:**
1. **Escape** is a *race between two independent `window`-level listeners* with no DOM-tree relationship to exploit. The deterministic fix is **event-phase separation**: the nested (innermost) listener registers in the **capture phase** and calls `stopPropagation()`; the outer dialog's listener stays in the default **bubble phase**, unchanged. Capture always fires before bubble for the same event, by W3C DOM Events spec — this is a browser guarantee, not a React effect-ordering assumption. A defense-in-depth check against the nested-overlay context's active state is layered on top, not relied on alone.
2. **Outside-click** is *not* a race at all once the DOM/z-index structure is correct: `onMouseDown` is a native pointer-hit-testing event, and only the topmost element at a given screen point ever receives it. Once the nested-overlay host's stacking context is genuinely above the outer dialog's, a click anywhere on screen while the nested popover is open is physically intercepted by the popover's own full-viewport overlay first — the outer dialog's backdrop handler is never even reached. No JS coordination is required for this specific interaction beyond correct stacking.
3. **Focus** is coordinated two ways, neither dependent on incidental effect-ordering: initial focus on open follows an explicit, deterministic three-step order the primitive executes itself (`initialFocusRef` → first focusable descendant → the panel itself, §11) rather than passively waiting to see what a child happened to focus first; nested-overlay trap suspension reads the same ref-backed registry (§8) Escape's defense-in-depth check uses, always fresh at event time. Both share one small, genuinely shared pure helper (`getFocusableElements`) — not a shared stateful hook, since the two components' surrounding wiring differs enough that forcing one would be the "cosmetic reuse" this task explicitly forbids.

**`z-index` alone would in fact break rendering, not just event handling**, confirmed directly from `tokens.ts`: `dashboardZIndex.popover` (1200, what `DatePickerPopover` uses today) is *lower* than `dashboardZIndex.modal` (3100, the natural default for `ResponsiveDialog`'s own panel). Nesting the popover inside a modal-tier dialog with unmodified z-index values would render it **behind** the dialog, not just create dismissal ambiguity. The fix does not require a new global token: the nested-overlay **host** element (owned entirely by `ResponsiveDialog`, not `DatePickerPopover`) establishes its own stacking context at `zIndex + 100` relative to whatever `zIndex` prop the dialog was given — everything portaled into that host inherits a correctly-elevated position for free, and `DatePickerPopover`'s own internal z-index styling needs **zero changes**.

**Recommended new files**: `responsive-dialog.tsx` (+ its own `NestedOverlayContext`, co-located, not a separate file), `responsive-dialog.test.tsx`, `use-is-mobile.ts` (extracted — genuinely justified, not speculative, §13), `document-scroll-lock.ts` (the shared, reference-counted scroll-lock utility, §12) with its own `document-scroll-lock.test.ts`, a tiny shared pure helper for focusable-element discovery (§11), and one dedicated nested-integration test file (§17/§19 — not folded into `date-field.test.tsx`, which stays completely unmodified). **Recommended modified files**: `date-picker-popover.tsx` (a real, scoped integration change — register/unregister via `useLayoutEffect` and a stable `useId()`, conditional portal target, conditional capture-phase Escape, the nested-only shared-scroll-lock branch, focusable-helper reuse) only. **No other file** — not `tokens.ts`, not `date-field.test.tsx`, not any of the other eight existing modals, not any Manual Event / `WorkCalendarClient` file.

Realistic estimate: **~2–2.5 engineer-days** — see §23 for the exact breakdown.

---

## 2. Verified repository state

```
$ git branch --show-current
main

$ git rev-parse --short HEAD
7a4de8e

$ git status --short
(empty)

$ git log -4 --oneline
7a4de8e Add Calendar options endpoint
89ffbc3 Make DateField test month-boundary safe
3a353c1 Map Work Calendar manual events
888294c Add read-only Work Calendar month view
```

- Branch is `main` — matches the required precondition.
- HEAD is `7a4de8e` — matches the expected Phase B commit exactly.
- Working tree is clean — matches the required precondition.
- No stop condition triggered; proceeding with the mapping.

**Files relevant to this mapping, confirmed unchanged since the approved manual events mapping** (`3a353c1`), via `git log -1 -- <file>` on each — every last-touched commit predates `3a353c1`:

| File | Last touched |
|---|---|
| `app/components/dashboard/ui/calendar/date-picker-popover.tsx` | `79c8899` (foundation milestone) |
| `app/components/dashboard/ui/calendar/date-field.tsx` | `79c8899` |
| `app/components/dashboard/ui/tokens.ts` | `13246ca` |
| `app/components/dashboard/use-has-mounted.ts` | `0ced00f` |
| `app/components/dashboard/tasks/project-updates/project-update-shell.tsx` | `0ced00f` |
| `app/components/dashboard/tasks/project-updates/project-update-history-modal.tsx` | `0ced00f` |
| `app/components/dashboard/resources/resource-manager-modal.tsx` | `2925692` |
| `app/components/dashboard/resources/resource-note-editor-modal.tsx` | `0ced00f` |
| `app/components/dashboard/duplicate-project-modal.tsx` | `1ad5484` |
| `app/components/dashboard/tasks/task-delete-modals.tsx` | `57fd2bb` |
| `app/components/upgrade-modal.tsx` | `bc25bbe` |
| `app/dashboard/profile/page.tsx` | `30454bd` |

**Exception**: `app/components/dashboard/ui/calendar/date-field.test.tsx` was touched by `89ffbc3` (a test-only, date-math-determinism fix unrelated to overlay behavior — it changed which target date a test clicks, not any dismissal/focus/portal logic). Its current content was read in full for this mapping (§4) and confirms no structural change to what's being tested.

Every fact below about the nine existing overlay implementations was re-confirmed against **current** code this session (targeted reads plus `grep` spot-checks for `createPortal`, `useHasMounted`, `Escape`/`keydown`, `aria-modal`/`role="dialog"`, `onMouseDown`, and `overflow = "hidden"` across all nine files) — not assumed from the prior report.

---

## 3. Current overlay inventory

Nine independent dialog/modal/popover implementations exist; `@floating-ui/react@^0.27.20` (confirmed in `package.json`) is used in exactly one of them.

| # | Component | Portal | Mount-gate | Focus trap | Focus return | Escape | Outside-click | Scroll lock | Mobile | `aria-modal` |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `DatePickerPopover` | `document.body` | `useHasMounted()` | **Yes** | **Yes** | Yes (ungated) | `onMouseDown` + target-check | `body` only, mobile-only | True bottom sheet | Deliberately absent |
| 2 | `ProjectUpdateModalV2`/shell | Yes | `useHasMounted()` | No | No | Yes, gated `!isBusy` | `onMouseDown` + target-check | `body`+`documentElement` | CSS reflow, stays centered | `true` |
| 3 | `ProjectUpdateHistoryModal` | Yes | `useState`+`useEffect` | No | No | **No** | Not `onMouseDown` (confirmed absent in this grep) | `body` only | CSS reflow | `true` |
| 4 | `ResourceManagerModal` | Yes | `useState`+`useEffect` | No | No | Yes, gated `!isBusy` | `onMouseDown` + target-check | `body`+`documentElement` | CSS → full-screen | `true` (×2 — has its own inline nested confirm) |
| 5 | `ResourceNoteEditorModal` | Yes | `useHasMounted()` | No | No | Yes, gated `!isSaving` | `onMouseDown` + target-check | None (relies on parent) | CSS → full-screen | `true` |
| 6 | `DuplicateProjectModal` | **No** | N/A | No | No | **No** | None | None | None | `true` |
| 7 | `TaskDeleteModals` (3 variants) | **No** | N/A | No | No | **No** | Not `onMouseDown` | None | None | `true` |
| 8 | `UpgradeModal` | **No** | N/A | No | No | **No** | None | None | None | **Absent entirely** |
| 9 | Profile feedback modal (inline) | **No** (full page) | N/A | No | No | Yes, gated `!isSubmittingFeedback` | `onMouseDown` + target-check | `body`+`documentElement` | CSS reflow | `true` |

This table matches the approved manual events mapping's own §6 inventory exactly — confirming, per the git-log evidence in §2, that nothing has drifted. **`DatePickerPopover` remains the only implementation with a real focus trap, real focus return, and a real centered-popover→bottom-sheet transformation** — it is the correct, and only, reference implementation for `ResponsiveDialog`'s core behavior. The other eight are read-only context for this mapping; **none of them is touched, migrated, or referenced by any code change in Phase A.**

---

## 4. Current DatePickerPopover behavior

Read in full this session (`app/components/dashboard/ui/calendar/date-picker-popover.tsx`, 262 lines) and `date-field.tsx` (226 lines), the component that supplies it `children`.

- **Mount-gate**: `useHasMounted()` (`useSyncExternalStore`-based, SSR-safe — confirmed by direct read of `use-has-mounted.ts`) plus `!open` — `if (!isMounted || !open) return null;`. The component **fully unmounts** (returns `null`) when closed; nothing about it persists across an open/close cycle except whatever the caller (`DateField`) keeps in its own state.
- **Positioning**: `@floating-ui/react`'s `useFloating` with `placement: "bottom-start"` and `offset(8) + flip({padding:8}) + shift({padding:8})` middleware, `whileElementsMounted: autoUpdate`. `refs.setReference(triggerRef.current)` runs in an effect keyed on `[refs, triggerRef, open]`.
- **Escape**: one `window.addEventListener("keydown", handler)` (default bubble phase, no `capture` option), registered only while `open`, calling `onRequestClose()` on `event.key === "Escape"` — **never gated on anything** (no `busy`/`isSaving` concept exists on this component at all today).
- **Outside-click**: `onMouseDown` on the overlay `<div>` (the outermost portaled element), checking `event.target === event.currentTarget`; the inner panel `<div>` calls `event.stopPropagation()` on its own `onMouseDown` as a second layer of protection. `event.preventDefault()` is called specifically to stop the browser's default mousedown-to-`<body>` focus shift from racing the component's own focus-return effect (documented inline, lines 152–163).
- **Focus containment**: a hand-rolled `keydown`-based Tab/Shift+Tab cycler (lines 118–146). Critically, it **re-queries `panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR)` fresh on every Tab keypress** — not a memoized/stale list — so it already correctly self-adapts if a focusable descendant becomes disabled or is removed between keypresses, with no extra work needed to satisfy that requirement for the ported logic.
  ```ts
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  ```
- **Focus return**: a `wasOpenRef`-based transition effect — when `open` flips `true → false` on any path, `triggerRef.current?.focus()` runs. The `?.` means a detached/null trigger is a **silent no-op**, not a crash, but also **no fallback target** — focus simply stays wherever the browser last put it (typically nowhere specific, or `document.body`).
- **Scroll lock**: **mobile-only** (`if (!open || !isMobile) return;`), locks **only** `document.body.style.overflow`, capturing and restoring the previous value. Desktop never locks scroll — matches the component's own doc comment: "deliberately does NOT dim the whole page on desktop (a popover should not behave like a full modal)."
- **`useIsMobile`**: file-local (lines 202–220), `window.matchMedia(\`(max-width: ${dashboardBreakpoints.mobile - 1}px)\`)`, initial state `false`, corrected via a `change`-listener effect on mount (confirmed: `handleChange()` is called once synchronously inside the effect, then subscribed for further changes) — this is the **only** `useIsMobile`/`matchMedia` implementation anywhere in `app/components/dashboard/` (confirmed via a repo-wide grep this session; zero other matches).
- **`aria-modal`**: **deliberately absent** — confirmed both in code and in the component's own doc comment, a considered decision (a bottom-sheet/anchored-popover is not a full page-blocking modal in this component's own model).
- **Consumer (`DateField`)**: passes `Calendar` (the `DayPicker` wrapper) plus a Today/Clear footer row as `children`; owns its own `isOpen` state, its own `commit`/`closePicker` split (Escape/outside-click never call `onChange`, only a real selection/Today/Clear does), and its own visually-hidden `aria-live` announcement region. `Calendar`'s `defaultMonth = selected ?? today` (confirmed in `calendar.tsx:111`) — this is the exact mechanism the `89ffbc3` test fix (§2) had to account for.

---

## 5. Phase A scope and exclusions

**In scope**, matching the six items enumerated in the task and the approved mapping's own §7/§18/§26 Phase A description:

1. `ResponsiveDialog` — the shared portal/backdrop/panel primitive.
2. `use-is-mobile.ts` — extracted (justified below, §13; not speculative — it kills a real, exact duplication that would otherwise exist between two files).
3. The nested-overlay context + host, co-located in `responsive-dialog.tsx`.
4. An **optional**, context-gated integration path in `DatePickerPopover` — opt-in, zero behavior change for every existing standalone caller.
5. Focus, Escape, outside-click, scroll-lock, and focus-return behavior on the primitive itself.
6. Focused automated tests for the primitive plus a `DatePickerPopover` regression/integration addition.

**Explicitly out of scope for Phase A** (reproduced from the task, all confirmed absent from this mapping's file plan in §19): `CalendarEventForm`, `AddEditCalendarEventDialog`, the Add Event button, Edit/Delete UI, Project/Client fields, options loading/caching, Manual Event mutation helpers, `WorkCalendarClient` mutation reconciliation, `calendarDataVersionRef`, any API/database work, and migration of any of the other eight existing modals onto `ResponsiveDialog`.

**Does Phase A need a production consumer?** No. Determined and justified in §1: the primitive is fully provable via `responsive-dialog.test.tsx` rendering it directly (React Testing Library needs no real page route), and `DatePickerPopover`'s own updated test file proves the nested-integration contract in isolation, using a small test-only wrapper component that renders `ResponsiveDialog` + `DatePickerPopover` together — not a new production route. This is the smallest correct approach: it fully exercises every Phase A behavior without shipping a single line of unused production UI, and avoids the risk of a throwaway demo route accidentally leaking into a real navigation path or being mistaken for a real feature.

---

## 6. Recommended ResponsiveDialog API

```ts
type ResponsiveDialogAccessibleName =
  | { "aria-labelledby": string; "aria-label"?: never }
  | { "aria-label": string; "aria-labelledby"?: never };

type ResponsiveDialogBaseProps = {
  /** Whether the dialog is open. When `false`, the component renders `null` — no
   *  DOM node is kept around, matching DatePickerPopover's existing convention. */
  open: boolean;

  /** Called on every dismissal path this primitive recognizes (Escape,
   *  backdrop click, close button — the last one only if the caller renders
   *  one, since chrome is caller-authored, see below). Never called while a
   *  nested overlay is registered active, and never called while `busy`.
   *  Plain `() => void` — no "reason" argument (justified below). */
  onRequestClose: () => void;

  /** The element focus should return to when the dialog closes, if it is
   *  still connected to the document at that moment. Mirrors
   *  DatePickerPopover's existing `triggerRef` prop exactly — same name,
   *  same shape, same optional-chained "detached is a silent no-op" default
   *  behavior. Governs focus **return only** — see `initialFocusRef` below
   *  for where focus goes *on open*; the two are deliberately independent
   *  props, since the element that opened the dialog is very often not the
   *  element that should first receive focus inside it. See §11 for the
   *  full focus contract and why a richer return-fallback *chain* is
   *  deliberately NOT built into the primitive itself. */
  triggerRef: RefObject<HTMLElement | null>;

  /** Optional: the element that should receive focus first when the dialog
   *  opens, if it is connected, not disabled, and actually contained inside
   *  the panel at that moment. See §11 for the full three-step deterministic
   *  focus-order contract and why this is no longer treated as unnecessary —
   *  the approved manual events mapping already requires the future form's
   *  Title field to receive initial focus, which is a concrete, current
   *  Phase A-adjacent requirement, not a speculative one. */
  initialFocusRef?: RefObject<HTMLElement | null>;

  /** Suppresses Escape, backdrop-click, and (if the caller renders one)
   *  close-button dismissal while true — mirrors the `!isBusy`/`!isSaving`
   *  gating already present in 5 of the 9 existing implementations (§3).
   *  Reserved for genuine in-flight async work (a save/delete request);
   *  see below for why it must not be overloaded for synchronous local UI
   *  sub-states like a delete-confirm step. Default `false`. */
  busy?: boolean;

  /** Opt-out of the scroll lock (§12). Default `true`. */
  lockScroll?: boolean;

  /** Base stacking value for this dialog's own backdrop/panel. Default
   *  `dashboardZIndex.modal`. The nested-overlay host (§7/§15) stacks at
   *  `zIndex + 100`, computed from whatever value is actually in effect —
   *  never a second, independent prop to keep in sync by hand. */
  zIndex?: number;

  /** Optional passthrough, unchanged semantics from any standard dialog. */
  "aria-describedby"?: string;

  children: ReactNode;
};

export type ResponsiveDialogProps = ResponsiveDialogBaseProps & ResponsiveDialogAccessibleName;
```

**Accessible name is now a compile-time contract, not a runtime-only warning.** `ResponsiveDialogAccessibleName` is a real discriminated union: passing neither `aria-labelledby` nor `aria-label`, or passing both, is a **TypeScript error** at the call site, not something only caught by a `console.error` a developer might miss in a noisy console. A dev-only runtime assertion may still be layered in as defense-in-depth (e.g. against a caller that bypasses the type via `as`), but it is no longer the *primary* mechanism — the type system is. This matches the task's explicit correction away from relying on a runtime-only warning.

**`initialFocusRef` is now part of the API — added, not omitted.** The earlier conclusion that no concrete need existed was wrong: the approved manual events mapping already specifies that the future Add/Edit Manual Event form must focus its Title field first in create mode (§9 of that mapping, "Focus first in create mode"). That is a real, already-locked, current requirement this primitive must be able to satisfy — not a speculative one. See §11 for the full three-step deterministic order this prop participates in.

**No `defaultDate`/desktop-vs-mobile presentation config prop.** Presentation branching is entirely internal (§13) — the caller has no reason to override it, and `DatePickerPopover` sets no such precedent either.

**Answers to the specific clarifying questions**:
- **Remains mounted when closed, or returns `null`?** Returns `null` — identical to `DatePickerPopover`. Each open is therefore a fresh mount of `children`; no internal state persists across an open/close cycle unless the caller persists it externally (Phase C's form will receive `defaultDate`/`event` props each time, exactly as `DatePickerPopover`'s own consumer, `DateField`, already receives `value` fresh each render).
- **When is focus moved into the dialog?** On open, via one explicit, deterministic three-step check (§11) — `initialFocusRef` first if usable, then the first focusable descendant, then the panel itself. This is no longer left to "whatever a child's own effect happened to focus first" — see §11 for why that framing was replaced.
- **What happens if the requested initial-focus target does not exist (or is disabled, or detached, or outside the panel)?** The primitive falls through to the next step of the same three-step order (§11) — never a crash, never a focus jump to nowhere, and never a silent attempt to focus an element that isn't actually usable.
- **What happens when the trigger is detached before close?** `triggerRef.current?.focus()` is only attempted if `triggerRef.current` is both non-null **and** `.isConnected` (a standard DOM property, no new dependency). If either check fails, the primitive does nothing further — no crash, no silent-but-wrong focus jump. See §11 for why the richer multi-step *return* fallback chain belongs to the Phase C consumer, not this primitive.
- **Does focus-return fallback belong in the primitive or the Calendar consumer?** The Calendar consumer (Phase C) — this answer is unchanged and applies only to focus **return on close**, not initial focus **on open** (now handled deterministically by the primitive itself, above). The *correct* return-fallback target differs by which action closed the dialog (Save/Cancel → the Edit button, which persists; Delete → the Edit button is gone, so the Add Event button, then the agenda heading, per the manual events mapping's own Correction 4) — that is Calendar-domain knowledge the primitive must not embed.
- **How do repeated open/close cycles behave?** Each open is an independent, fresh mount (see "remains mounted" above) — no shared, cross-cycle state exists inside the primitive to accumulate or leak.
- **How does `busy` affect Escape/backdrop/close-button/focus?** Escape and backdrop-click are both no-ops while `busy` (checked first, before any nested-overlay check). A caller-rendered close button is expected to independently respect `busy` in its own `disabled` state (chrome is caller-authored, see §5/old-mapping precedent, reaffirmed below) — the primitive has no close button of its own to gate. Focus containment and the panel's own initial-focus behavior are unaffected by `busy` — a busy dialog still needs to be keyboard-navigable (e.g. to see a disabled Save button's state), it just can't be *dismissed*.
- **Does `onRequestClose` need a `reason`?** **No — this conclusion is unchanged, but the earlier justification for it was wrong and is corrected here.** `onRequestClose` stays a plain `() => void`. The earlier draft of this mapping recommended the future caller misuse `busy` (a prop reserved for genuine in-flight async work) plus a *separate, form-level* Escape listener to implement the delete-confirm-steps-back-first behavior — that recommendation is withdrawn. The correct pattern needs no second listener and no `busy` misuse at all: the future caller's own `onRequestClose` implementation simply checks its own local delete-confirm state first — *"if delete confirmation is active, leave confirmation mode instead of closing; otherwise, actually close the dialog"* — and passes that single function as `onRequestClose`. Because **both** Escape and backdrop-click call the exact same `onRequestClose` callback, this one small `if` at the call site handles both dismissal channels uniformly, with zero additional wiring and zero Calendar-specific knowledge leaking into the primitive. `busy` remains reserved exclusively for real in-flight save/delete requests, not repurposed to gate a synchronous local UI sub-state a plain conditional already handles correctly at the call site.

---

## 7. Portal DOM structure

**One `createPortal(..., document.body)` call, one real React tree, no manual DOM APIs.** An earlier draft of this mapping described the host as a sibling in the portal tree in this section, but then described it as being created via `document.createElement`/`appendChild`/`removeChild` in §8 — a real contradiction between two DOM-construction strategies. That is corrected here: there is exactly **one** mechanism, and it is plain React rendering, matching how every other element in this same tree (the backdrop, the panel) is already produced.

**Correction 1 — three direct portal-root siblings, not backdrop-wraps-panel.** An earlier draft of this section nested the panel *inside* the backdrop, arguing that un-nesting them risked regressing the outside-click mechanism. That argument is withdrawn: it had the risk backwards. With panel and backdrop as genuine siblings — under both the DOM and the React tree, since all three are returned from the same `ResponsiveDialog` component in one `Fragment` — there is no ancestor/descendant relationship between them at all, so a click on the panel can never reach the backdrop's own `onMouseDown` handler by any propagation path, DOM or React-synthetic. This is *more* robust than the nested version, not less, and it is now the locked architecture:

```tsx
return createPortal(
  <NestedOverlayContext.Provider value={contextValue}>
    <>
      <div data-responsive-dialog-backdrop onMouseDown={handleBackdropMouseDown}
           style={{ position: "fixed", inset: 0, zIndex }} />

      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1}
           {...accessibleNameProps}
           style={{ position: "fixed", zIndex, ...presentationStyle /* centered (desktop) or bottom-anchored (mobile), §13 */ }}>
        {children}
      </div>

      <div ref={setHostElement} data-responsive-dialog-nested-host
           style={{ position: "fixed", zIndex: zIndex + 100, pointerEvents: "auto" }} />
    </>
  </NestedOverlayContext.Provider>,
  document.body
);
```

```
document.body
└── (portal root — one Fragment, THREE DIRECT SIBLINGS, all real React elements —
      no element contains either of the other two)
    ├── <div data-responsive-dialog-backdrop>    position:fixed; inset:0; z-index: zIndex;
    │                                             full viewport; no children
    ├── <div role="dialog" aria-modal="true"      position:fixed; z-index: zIndex; centered
    │        tabIndex={-1} ...>{children}</div>   (desktop) or bottom-anchored (mobile, §13);
    │                                             paints above the backdrop by DOM order at
    │                                             equal z-index (both same stacking context)
    └── <div ref={setHostElement}                 position:fixed; z-index: zIndex + 100;
             data-responsive-dialog-nested-host /> pointer-events: auto; ZERO size (no
                                                    inset/width/height of its own)
```

**Backdrop click handling is now structurally simpler, not more complex.** Because the backdrop has **no children at all** (panel is a sibling, not nested inside it), any `mousedown` that reaches the backdrop's own handler is *necessarily* a direct hit on the backdrop element itself — a click on the panel simply never dispatches to the backdrop's listener in the first place, by ordinary DOM hit-testing (the panel, painted above the backdrop for its own screen area, is what actually receives that click). The `event.target === event.currentTarget` guard is kept anyway, both as cheap defense-in-depth and for consistency with this codebase's established convention (§3/§10), but it is now trivially always `true` whenever the handler fires at all. The panel itself needs **no `stopPropagation()` of its own** — an earlier draft's justification for one (stopping bubbling to an ancestor backdrop) no longer applies, since the backdrop is not an ancestor.

**Why the host doesn't need its own `inset: 0`**: `position: fixed` descendants position relative to the *viewport* (the initial containing block), not their immediate parent's box, unless an ancestor sets `transform`/`filter`/`will-change: transform`/etc. — merely giving the host `position: fixed` does **not** turn it into a containing block for its own `position: fixed` children. `DatePickerPopover`'s own overlay (`position: fixed; inset: 0`), once portaled into the host, still correctly covers the full viewport regardless of the host's own minimal footprint. The host is therefore a **zero-size** anchor node (no `inset`, no `width`/`height` set on itself) — it does not need `inset: 0` itself.

**The nested-host pointer-events contract, corrected.** An earlier draft of this mapping claimed the host is styled `pointer-events: none` and relied on "a `pointer-events: auto` descendant re-enables interaction under a `none` ancestor" to explain why `DatePickerPopover`'s own content stayed interactive once portaled in. That framing is withdrawn — it invited exactly the wrong mental model (a full-screen invisible `pointer-events: none` hit-target that something else has to "punch through"). The corrected, locked contract:
- The host is styled `pointer-events: auto`, explicitly — **not** `none`.
- The host is **not** a full-screen invisible hit target at all — it has **zero dimensions** of its own (no `inset: 0`, no explicit `width`/`height`), so there is nothing at any screen coordinate for it to intercept in the first place, regardless of its `pointer-events` value. Emptiness, not a `pointer-events: none` trick, is what makes an empty host harmless.
- `DatePickerPopover`'s own overlay/panel elements, once portaled inside, remain explicitly interactive on their own terms (they already set no `pointer-events` override today, so they default to `auto`, matching every other interactive element in this codebase) — this is stated directly, not derived by reasoning about inheritance across a `none`/`auto` boundary that no longer exists in this design.
- This report does **not** rely on, and no future implementation should rely on, inherited/default `pointer-events` behavior to "re-enable" interaction beneath a `pointer-events: none` ancestor — the host is simply never `none` in the first place, and its own zero size is the only property doing the "don't intercept unrelated clicks while empty" work.

**Nested-but-not-yet-hosted behavior** (the DOM-side half of Correction 2, §8): if a nested overlay is asked to open before `hostElement` has been set by the callback ref (a brief window on the very first render or two), it must render `null` and wait — it must **not** temporarily fall back to portaling into `document.body`. Falling back, even briefly, would put its content outside the sibling-host structure this whole section exists to guarantee, defeating the stacking/clipping contract for exactly the frames it matters least to get wrong silently. A genuinely **standalone** `DatePickerPopover` (no `ResponsiveDialog` ancestor at all, i.e. `useNestedOverlayHost()` returns `null` rather than a context value whose `hostElement` happens to be `null`) is a completely different case and continues to portal directly to `document.body` immediately, exactly as today — the "wait" behavior applies only when nested-but-not-yet-hosted, never when not nested at all.

**Element ownership table**:

| Concern | Owner |
|---|---|
| `role="dialog"` | The panel |
| `aria-modal="true"` | The panel |
| Backdrop `onMouseDown` handler | The backdrop `<div>` |
| Focus-trap boundary | The panel (`panelRef`) |
| Nested portal target | The host `<div>` (exposed via context, §8) |
| Test selector for the panel | `getByRole("dialog", { name: ... })` — never a class name or z-index-dependent selector |
| Test selector for the host | A stable `data-testid="rd-nested-overlay-host"` (or equivalent), since it has no accessible role of its own (it is not itself a dialog — it is a plain container) |

---

## 8. Nested overlay context contract

**Public context is minimal — three fields, nothing speculative.** An earlier draft of this mapping exposed `hasActiveNestedOverlay`/`activeNestedOverlayId` on the public context value, on the reasoning that they were "genuinely useful for debugging." That reasoning is withdrawn: no Phase A consumer — not `DatePickerPopover`, not any test that isn't itself standing in for `ResponsiveDialog`'s own internals — actually needs to read them, and `ResponsiveDialog`'s own Escape/backdrop/focus-trap handlers already read the backing ref directly rather than through the context (below), so those two fields were pure surface area with no real caller. The corrected, locked public shape:

```ts
type NestedOverlayContextValue = {
  /** The DOM node a nested overlay should portal into — a real,
   *  React-rendered `<div>` inside ResponsiveDialog's own portal tree (§7),
   *  captured via a callback ref, never a manually document.createElement'd
   *  node. Null only until that ref callback has actually fired (the first
   *  render or two) -- see §7 for the exact "wait, don't fall back" contract
   *  a nested overlay must follow while this is still null. */
  hostElement: HTMLElement | null;

  registerNestedOverlay: (id: string) => void;
  unregisterNestedOverlay: (id: string) => void;
};

const NestedOverlayContext = createContext<NestedOverlayContextValue | null>(null);

export function useNestedOverlayHost(): NestedOverlayContextValue | null {
  return useContext(NestedOverlayContext);
}
```

`DatePickerPopover` needs nothing more than this: `hostElement` to know where (and whether) to portal, plus the two registration functions. It never reads an "is anything else active" value — that question only matters to `ResponsiveDialog`'s own internal dismissal/focus-trap logic, which is exactly why it stays internal.

**Registration is ref-backed and synchronous, owned entirely inside `ResponsiveDialog`, not exposed — and carries no render-triggering machinery, because nothing rendered depends on it.** A `useState<Set<...>>` implementation (an earlier draft of this mapping) is provably wrong for this specific use: `ResponsiveDialog`'s own Escape/backdrop/focus-trap handlers need to read the *current* active-overlay state **at native event time**, and a value derived from React state is only guaranteed current as of the *last completed render* — inside a raw `window` `keydown`/`mousedown` handler (not a React synthetic event queued through React's own batching), that can be a stale closure. A ref sidesteps this entirely, because `ref.current` is always read fresh at the moment of access, with no render/commit cycle in between. **Correction (final pass): a `useReducer`/`forceUpdate` version counter was added in an earlier draft purely to "trigger a re-render when the registry changes" — that render was never actually consumed by any rendered JSX, so the counter was pure unused ceremony and is removed:**

```ts
// Entirely internal to ResponsiveDialog — never part of NestedOverlayContextValue.
// No useReducer, no forceUpdate, no version counter: nothing rendered depends
// on this Set's contents, only event handlers reading it at call time, so
// there is nothing for a re-render to accomplish here.
const activeNestedOverlayIdsRef = useRef<Set<string>>(new Set());

const registerNestedOverlay = useCallback((id: string) => {
  activeNestedOverlayIdsRef.current.add(id); // Set#add is already idempotent
}, []);

const unregisterNestedOverlay = useCallback((id: string) => {
  activeNestedOverlayIdsRef.current.delete(id); // Set#delete is already idempotent
}, []);
```

`ResponsiveDialog`'s own Escape/backdrop/focus-trap handlers (§9/§10/§11) read `activeNestedOverlayIdsRef.current.size > 0` **directly**, inside the handler body, at the moment the event fires — never through the public context, never a closure-captured boolean. The raw Set is never exposed anywhere, public or otherwise, outside this one component. If a future consumer genuinely needs rendered JSX to react to registry changes, the render-triggering counter can be reintroduced additively at that point — not speculatively now.

**How this is tested without widening the public API for test convenience** (the methodology, not a new prop): tests that need to prove registry behavior (idempotency, Strict Mode double-invoke safety, "no stuck registration") do so through **observable dialog behavior** — e.g. "the outer dialog's Escape now closes it directly on the next press" is proof a registration was actually released, without ever reading a registry value directly — or, where genuinely necessary, through a small **test-only** nested consumer component defined inside the test file itself (rendered as the context's child, deliberately not part of the production `DatePickerPopover` integration) that calls `registerNestedOverlay`/`unregisterNestedOverlay` directly and exposes what it observed via its own rendered DOM output for assertions. Neither approach requires adding anything to `NestedOverlayContextValue` itself.

**Registration id: a stable `useId()` value, not an ad-hoc string.** `DatePickerPopover` generates its own nested-overlay registration id via React's `useId()` hook — stable across re-renders for the lifetime of one mounted instance, unique per instance, and requiring no manual uniqueness scheme of its own. See §9 for the exact conditions under which registration is (and is not) attempted, and §16 for the full `useLayoutEffect`-based timing contract this participates in.

**Idempotency, mapped explicitly**:
- **Duplicate register calls** (same id twice, e.g. under Strict Mode's dev-only double-invoke): `Set#add` is itself idempotent — adding an id already present leaves the Set's contents unchanged. No render occurs either way, since nothing rendered reads this ref.
- **Duplicate unregister calls**: `Set#delete` is itself idempotent — deleting an already-absent id is a safe no-op, returning `false` but never throwing.
- **Component unmount while open**: the registering component's own effect cleanup (always returned unconditionally from its registration effect) calls `unregisterNestedOverlay(id)` — React guarantees effect cleanups run on unmount, including abrupt unmounts, so this requires no extra plumbing beyond "the registration effect always returns a cleanup."
- **Host not available during the first render**: `hostElement` genuinely can be `null` for the first render or two, until the callback ref that sets it actually fires (§7's real-React-div-plus-callback-ref design, not a manually-created-and-appended node) — this is expected, not defended against with a fallback value. See §7 for the exact "a nested overlay must wait, never silently fall back to `document.body`, while nested-but-not-yet-hosted" contract this produces, and §9/§16 for why registration itself must also wait for the same condition, not just the portal target.
- **Callback-ref timing**: `setHostElement` (the `useState` setter) is passed directly as the host `<div>`'s `ref` — React calls it with the real node on mount and with `null` on unmount, exactly the signature a `useState` setter already has; no extra ref-callback wrapper is needed.
- **Rapid open/close**: register/unregister are driven entirely by the nested popover's own `open` prop transitions via its own effect, so React's normal cleanup-before-next-effect sequencing already serializes register→unregister→register... correctly; `Set#add`/`Set#delete`'s own natural idempotency covers any residual double-fire, with no render-batching concern at all since these calls never trigger a render in the first place.
- **More than one nested overlay** (even though Phase A's own MVP only ever nests one `DatePickerPopover` at a time): fully supported by the `Set<string>` internal model — a second, differently-`id`'d nested overlay would register alongside the first with no conflict; `activeNestedOverlayIdsRef.current.size > 0` (the actual gate every Phase A consumer needs) remains correct regardless of count.

**Location**: co-located inside `responsive-dialog.tsx`, not a separate `nested-overlay-context.tsx` file. It is tightly coupled to, and owned by, `ResponsiveDialog` specifically — no second primitive exists (or is planned) that would need this exact shape, so a separate module would be premature file-splitting with no present benefit. `DatePickerPopover` imports only the exported `useNestedOverlayHost` hook and the `NestedOverlayContextValue` type from `responsive-dialog.tsx`; `responsive-dialog.tsx` imports nothing from `date-picker-popover.tsx`. The dependency is strictly one-directional — no circular import risk.

---

## 9. Escape ownership

**The current `DatePickerPopover` Escape listener is a bare, ungated `window.addEventListener("keydown", handler)` in the default bubble phase** (§4). If `ResponsiveDialog`'s own Escape listener were registered the same naive way, the two listeners would race with **genuinely undefined relative ordering** from the DOM spec's point of view when both are same-target, same-phase listeners added by independent, unrelated effects — exactly the vague "the nested handler fires first" claim this task explicitly rejects.

**Deterministic mechanism: event-phase separation, not effect-registration order.**

A native `KeyboardEvent` dispatched anywhere in the document travels through three phases relative to any listener registered on `window`: **capture** (top-down, `window` first), **target**, then **bubble** (bottom-up, `window` last). This is a W3C DOM Events spec guarantee, independent of React, independent of component mount order, independent of which effect happened to run first.

- **`ResponsiveDialog`'s own Escape listener stays exactly as `DatePickerPopover`'s is today**: `window.addEventListener("keydown", handler)`, default bubble phase, no changes to its own registration.
- **`DatePickerPopover`, only when `useNestedOverlayHost()` returns non-null** (i.e., only when actually nested — every standalone caller is completely unaffected), registers its Escape listener with `{ capture: true }` instead, and calls `event.stopPropagation()` immediately after handling the key:
  ```ts
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onRequestClose();
    },
    { capture: true }
  );
  ```
  Because this fires during the **capture** phase — strictly before the bubble phase where `ResponsiveDialog`'s own listener lives — and calls `stopPropagation()`, the event never reaches `ResponsiveDialog`'s bubble-phase listener for that same keypress, **regardless of which component's effect happened to register first**. This is the one piece of Phase A that must not be implemented as "the nested one probably fires first" — it is implemented as a hard phase guarantee instead.
- **This capture-phase listener, and the matching `registerNestedOverlay` call, are both established in the same `useLayoutEffect` — before paint, not after** (Correction 2, detailed fully in §16). This closes a real gap: without this, there would be a brief window, after the nested popover's DOM has committed but before a later `useEffect` runs, where the popover is visibly on screen and interactive but **not yet registered** — meaning `ResponsiveDialog` would still believe no nested overlay is active, and the outer dialog's own Escape/backdrop/focus-trap suppression would not yet be in effect. `useLayoutEffect` runs synchronously after DOM mutations but before the browser paints, so registration and capture-phase Escape ownership are both active by the time anything is actually visible to the user.
- **`ResponsiveDialog`'s own Escape handler follows one explicit, ordered contract** (Correction 3, applies identically to the Tab/Shift+Tab handler in §11):
  1. Ignore the event if it isn't the key this handler cares about (`event.key !== "Escape"` → return).
  2. If `event.defaultPrevented` is already `true`, return — something else (a nested overlay's own capture-phase handler, or any other code) has already claimed this event, and the outer dialog must not additionally act on it. This restores the approved manual events mapping's own requirement that the primitive's keyboard handlers respect an already-`defaultPrevented` event, corrected back in here after an earlier draft of this mapping omitted it.
  3. If `busy`, return.
  4. Read `activeNestedOverlayIdsRef.current.size` **at this exact moment** (§8 — read directly off the ref, never a value captured in the handler's closure from the render that registered it). If greater than `0`, return.
  5. Only if all of the above pass: call `onRequestClose()`.
  The `defaultPrevented` check (step 2) is genuine defense-in-depth, layered on top of — not a replacement for — the capture/`stopPropagation` phase separation above; the ref check (step 4) remains the primary defense-in-depth mechanism for the specific nested-DatePicker case, with `defaultPrevented` catching the more general case of *any* other code that may have already handled the key. Neither is the *primary* race-free guarantee for the nested-DatePicker case specifically — that guarantee is still the capture/`stopPropagation` phase separation above.

**Resulting sequence, concretely**:
1. Nested `DatePickerPopover` is open (`activeNestedOverlayIdsRef.current` contains its id from an earlier registration).
2. User presses Escape. The capture-phase listener (`DatePickerPopover`'s, since nested) fires first by spec, calls `stopPropagation()`, closes the popover.
3. The popover's own close-transition effect (§4's `wasOpenRef` mechanism, unchanged) returns focus to the `DateField` trigger and, via its registration effect's cleanup, calls `unregisterNestedOverlay(id)`.
4. `ResponsiveDialog`'s bubble-phase listener never fires for this keypress (stopped in capture) — the outer dialog stays open. **One Escape closed only the nested picker.**
5. A **second**, later Escape keypress: the popover is already closed and unmounted, so **no capture-phase listener exists anymore** for it — this keypress reaches only `ResponsiveDialog`'s bubble-phase listener, which finds `activeNestedOverlayIdsRef.current.size === 0` and closes the outer dialog normally. **The next Escape closes the outer dialog.**

**Delete-confirm-state Escape is explicitly not addressed here** — per the task's own instruction, that is a Phase C concern. It requires no special handling from this primitive at all: the future `CalendarEventForm`'s own `onRequestClose` implementation checks its own local delete-confirm state first (§6's corrected guidance — a plain conditional, no `busy` misuse, no second listener), so an Escape press during delete-confirm mode reaches this same primitive's normal Escape path, calls that same conditional `onRequestClose`, and the *caller* decides whether that means "step back" or "actually close." Nothing above embeds any delete-specific knowledge into the generic primitive.

---

## 10. Outside-click ownership

**The current `DatePickerPopover` outside-click implementation** (§4): `onMouseDown` on its own full-viewport overlay (`position: fixed; inset: 0`), checking `event.target === event.currentTarget`, with the inner panel calling `event.stopPropagation()` on its own `onMouseDown` as a second layer.

Unlike Escape, **outside-click via native pointer events is not a race once stacking is correct** — a `mousedown` is dispatched to exactly one topmost element at the clicked screen coordinate (standard browser hit-testing), so there is no "which listener fires first" question at all; there is only "which element did the browser decide was actually clicked."

**Why the sibling host prevents backdrop misclassification**: `ResponsiveDialog`'s own backdrop handler's `event.target === event.currentTarget` check only ever evaluates `true` for a click landing *directly* on the backdrop `<div>` itself. A click anywhere inside `DatePickerPopover`'s own subtree — portaled into the sibling nested-overlay host, a structurally different DOM branch entirely — can never set `event.target` to the outer backdrop element, no matter how React's synthetic-event tree-bubbling (which follows the *React* component tree across portals, not the physical DOM tree) might otherwise propagate the event upward through `ResponsiveDialog`'s own ancestor handlers. The strict-identity check, not a `.contains()`-based "is this outside my panel" check, is what makes this safe — and it is already this codebase's established convention (5 of 9 existing modals use it, §3), not a new pattern introduced here.

**All six required pointer outcomes, mapped**:

1. **Click inside the DatePicker → nothing closes.** The panel's own `stopPropagation()` (existing, unchanged) prevents the click from ever reaching even *its own* overlay's `onMouseDown` check.
2. **Click outside DatePicker but inside the dialog panel (e.g. a future form field) → DatePicker closes; outer dialog remains open.** Once the nested host's stacking context genuinely exceeds the outer dialog's (§15), `DatePickerPopover`'s own full-viewport overlay is the topmost element at *every* screen coordinate while it's open — including coordinates that visually sit over the dialog panel's own content. The click is captured by the popover's overlay (`target === currentTarget` there evaluates `true`), closing only the popover; the dialog panel underneath never receives the click at all (standard "dismiss the topmost layer first" behavior, identical to any modal-over-page interaction).
3. **Click on the outer backdrop while the DatePicker is open → only the DatePicker closes first**, for consistency with Escape's two-stage behavior (§9). This falls out of the same mechanism as outcome 2 with no extra code: the popover's own full-viewport transparent overlay physically sits on top of the *entire* viewport, including whatever visually looks like "the outer backdrop" — so the browser's hit-test resolves to the popover's overlay, not `ResponsiveDialog`'s backdrop, and only the popover closes. A second, later click (now that the popover is gone) is needed to close the outer dialog — deliberately symmetric with the two-Escape-presses behavior in §9, for a consistent, predictable dismissal model across both dismissal channels.
4. **Click on the outer backdrop when no nested overlay is open → outer dialog closes.** No popover overlay exists to intercept the click; `ResponsiveDialog`'s own backdrop directly receives it, `target === currentTarget` is `true`, `onRequestClose` fires (subject to `busy`, outcome 5).
5. **Click while `busy` → no outer close.** `ResponsiveDialog`'s backdrop handler checks `busy` before calling `onRequestClose`, exactly mirroring the `!isBusy` gate already present in `ProjectUpdateModalV2`/`ResourceManagerModal`/`ResourceNoteEditorModal`/the profile modal (§3) — not a new pattern.
6. **`onMouseDown` remains the chosen convention** — reaffirmed, not reconsidered. It is the majority existing convention (5 of 9), it is what `DatePickerPopover` itself already uses and is directly integrating with, and `onMouseDown` (rather than `onClick`) is what correctly distinguishes "pointer-down-inside, pointer-up-outside" (a drag/text-selection gesture that shouldn't dismiss the dialog) from a genuine outside click — `onClick` fires on *pointer-up* regardless of where the corresponding *pointer-down* landed, which is the exact defect present in the two minority-convention modals (`ProjectUpdateHistoryModal`, `TaskDeleteModals`, §3) that this primitive must not repeat.

---

## 11. Focus management

**Current `DatePickerPopover` focus trap and return, in detail** (§4): a fresh-query-per-keypress Tab/Shift+Tab cycler over `FOCUSABLE_SELECTOR`, and a `wasOpenRef`-based focus-return-on-close effect with no fallback beyond optional chaining.

**`ResponsiveDialog`'s own behavior, fully specified**:

- **Initial focus on open — an explicit, deterministic three-step order, not an implicit "wait and see what a child happened to focus."** An earlier draft of this mapping made the primitive's own initial-focus behavior depend on React's child-before-parent effect-commit ordering — checking, after the fact, whether *something* already had focus and only acting if nothing did. That is replaced here with a contract the primitive owns and executes itself, deterministically, every time:
  1. If `initialFocusRef?.current` is a **usable target** — see the exact validity check below — focus it.
  2. Otherwise, if `getFocusableElements(panelRef.current)` (§8's shared helper — reused here, not reimplemented) returns at least one element — focus the first one.
  3. Otherwise — focus the panel itself (`tabIndex={-1}`).
  This runs in a single `useLayoutEffect` (not `useEffect`) keyed on `open`, so the correct element is focused **before the browser paints**, avoiding a visible flash of default/no focus followed by a jump. `useLayoutEffect` is safe here specifically because `ResponsiveDialog` (like `DatePickerPopover` before it) only ever renders its real content after `useHasMounted()` is `true` — i.e., strictly post-hydration, client-side-only — so there is no SSR mismatch risk of the kind `useLayoutEffect` normally warns about for components that also render on the server.
  A caller's own child *may still* independently focus something itself (nothing prevents it) — but the primitive's own contract no longer *depends* on that happening in any particular order to behave correctly; steps 1–3 above are self-contained and produce a correct result regardless of what any child does or doesn't do on its own.
  **The exact `initialFocusRef` validity check (Correction 2, final pass), reusing the shared selector rather than a looser ad-hoc check, with no unsafe cast**:
  ```ts
  // app/components/dashboard/ui/focus-trap.ts — new export alongside FOCUSABLE_SELECTOR/getFocusableElements
  export function matchesFocusableSelector(element: HTMLElement): boolean {
    return element.matches(FOCUSABLE_SELECTOR);
  }
  ```
  ```ts
  function isUsableInitialFocusTarget(el: HTMLElement, panel: HTMLElement): boolean {
    if (!el.isConnected) return false;
    if (!panel.contains(el)) return false;
    // Reuses the exact same FOCUSABLE_SELECTOR getFocusableElements (§8) is
    // built on -- not a separate, narrower ":disabled"-only check. This
    // alone already excludes native-disabled controls (the selector's own
    // `:not([disabled])` clauses) AND anything that isn't genuinely
    // focusable in the first place -- a plain `<div>` with no `tabindex`
    // does not match FOCUSABLE_SELECTOR at all, and `tabindex="-1"` is
    // explicitly excluded by the selector's own
    // `[tabindex]:not([tabindex="-1"])` clause -- so neither is ever a
    // valid initial-focus target, with no separate case needed for either.
    if (!matchesFocusableSelector(el)) return false;
    // `aria-disabled="true"` is an AT-only signal the DOM's own `:disabled`
    // pseudo-class does not capture (the element remains genuinely
    // focusable at the platform level) -- checked separately for exactly
    // that reason, via a plain attribute read, no cast of any kind.
    if (el.getAttribute("aria-disabled") === "true") return false;
    return true;
  }
  ```
  A target is usable only if it is non-null, `.isConnected`, contained by the panel, matches `FOCUSABLE_SELECTOR` (the same shared selector `getFocusableElements` already uses — not a looser or ad-hoc check), and is not `aria-disabled="true"`. If `initialFocusRef.current` fails any part of this, step 1 is skipped entirely and the order falls through to step 2 — never a crash, never an attempt to `.focus()` something unusable.
- **Tab / Shift+Tab cycling**: the same algorithm as `DatePickerPopover`'s existing one — re-query focusables fresh on every Tab keypress (already correctly self-adapting to elements becoming disabled/removed, §4) — but the **selector string and the query call itself** are extracted into one small, genuinely shared, pure helper (not a shared stateful hook — see below). The handler follows the same ordered contract as Escape's (§9, Correction 3): ignore non-Tab keys; return early if `event.defaultPrevented` is already `true` (so a nested overlay's own keyboard handling, if it ever calls `preventDefault()`, is never double-processed here); `busy` does not gate Tab-cycling (a busy dialog must remain keyboard-navigable, §6); read `activeNestedOverlayIdsRef.current.size` at event time and no-op if greater than `0` (§9/§11's nested-suspension behavior, unchanged); only then compute and apply the wrap-around.
  ```ts
  // app/components/dashboard/ui/focus-trap.ts
  export const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  export function getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }
  ```
  This is extracted because it is **copy-identical** logic (the exact selector string, the exact query call) that would otherwise exist twice with two independently-maintained copies — a genuine DRY violation, not a "looks similar" cosmetic case. The surrounding keydown-listener wiring (which `ref` to query, when to attach/detach, first/last-element branching on `shiftKey`) is **not** further abstracted into a shared hook: `DatePickerPopover`'s wiring is tied to its own `panelRef`/`open` lifecycle and `ResponsiveDialog`'s is tied to its own — forcing a single shared hook over two call sites with different surrounding state would be exactly the "cosmetic reuse" the task warns against, for marginal benefit over the ~15 lines each site already has.
- **No focusable descendants**: with the panel itself as the guaranteed step-3 fallback (above), Tab/Shift+Tab always have at least one real element (the panel, `tabIndex={-1}`) to reason about — pressing Tab with zero *interactive* descendants simply leaves focus on the panel (no crash, no infinite loop, since `getFocusableElements` returning an empty array is checked before attempting any first/last-element access).
- **Focus containment when an element becomes disabled or unmounts**: covered for free by the fresh-per-keypress query (inherited from `DatePickerPopover`'s existing, already-correct design) — no additional work required.
- **Focus return — a cleanup-based, captured-trigger contract, corrected to also cover a raw unmount.** An earlier draft of this mapping claimed a raw component unmount "needs no focus-return handling," reasoning that unmounting a focus-holding component already moves focus to `document.body` on its own and that no current precedent special-cases it. That reasoning missed a real caller shape this primitive must support: `ResponsiveDialog` is a client-rendered React component, and a caller is free to render it conditionally (`{isOpen && <ResponsiveDialog ...>}`) rather than always rendering it with `open` toggling — in that shape, closing *is* an unmount, not an `open: true → false` transition, and the focus-return behavior must be identical either way from the user's point of view. The corrected contract:
  1. **On open**, one effect captures `triggerRef.current` into an internal ref (e.g. `capturedTriggerRef.current = triggerRef.current`) — the *originating* trigger for this specific open session.
  2. **That same open-effect's cleanup** — which React runs on *either* `open` transitioning to `false` *or* the component unmounting, with no difference in mechanism between the two — attempts `capturedTriggerRef.current?.focus()`, but only if that captured element is still `.isConnected`. A detached captured trigger is a safe no-op, exactly as before.
  3. **Never `triggerRef.current` read fresh at close/unmount time** — only the value captured in step 1. If a caller reassigns what `triggerRef.current` points to while the dialog is still open (unusual, but not prevented), focus return still targets the *original* element that opened this session, not whatever the ref happens to point to now — the captured value is the one and only source of truth for this session's return target.
  4. The capture/attempt pairing is inherently idempotent per open session (one capture per open, one attempted focus per corresponding cleanup) — there is no separate "release" step to double-call.
  Richer, Calendar-domain-specific fallback *chains* (Add Event button, then the agenda heading, per the manual events mapping's own Correction 4) remain the Phase C consumer's responsibility, unchanged from §6 — this section only corrects *which* element the primitive itself attempts, and *when*, not what happens after a failed attempt.
- **Trigger-detached handling**: covered by the `.isConnected` check on the *captured* trigger, above — unchanged in spirit from the earlier draft, just now checked against the right value.
- **Component unmount**: no longer treated as needing no handling — see the corrected cleanup-based contract above, which applies identically whether the close path is `open` flipping to `false` or the component being unmounted outright.
- **Nested overlay opening**: the moment `DatePickerPopover`'s own registration effect calls `registerNestedOverlay(id)`, `ResponsiveDialog`'s focus trap's keydown handler — reading `activeNestedOverlayIdsRef.current.size > 0` directly at event time (§8, the same ref-based check §9's Escape handler uses) — no-ops while true; it does not attempt to re-capture focus the nested popover's own `autoFocus` (via `DayPicker`) has intentionally moved to its own internal day-cell.
- **Nested overlay active**: the outer trap stays suspended for the whole duration (same ref read, evaluated fresh on every Tab keypress — always current, never stale, never a closure-captured value).
- **Nested overlay closing and returning focus to the DateField trigger**: unchanged, existing `DatePickerPopover` behavior (`wasOpenRef` effect, §4) — the *nested* popover's own trigger is the Date field's own button, a completely independent `triggerRef` from `ResponsiveDialog`'s own (the Add/Edit button that opened the outer dialog, a Phase C concern). Both focus-return mechanisms are already independent and do not need new coordination.
- **Outer trap resuming afterward without stealing focus**: once `unregisterNestedOverlay` fires (via the popover's own cleanup) and `activeNestedOverlayIdsRef.current.size` returns to `0`, the outer trap's keydown handler simply stops early-returning — it does **not** proactively re-focus anything on that transition (it only acts in response to an actual subsequent Tab keypress), so it never yanks focus away from wherever the nested popover's own focus-return effect just placed it (the Date field trigger, which is itself inside the outer panel, so the outer trap's `contains()`-based reasoning, if any, remains consistent).
- **`keydown`-manual-cycling vs. `focusin`-containment vs. both**: **`keydown`-based manual cycling only**, matching `DatePickerPopover`'s own proven approach exactly — not lifted-and-modified, lifted **verbatim** in algorithm shape (same selector, same first/last/shiftKey branching), only the selector/query portion factored out per above. A `focusin`-based containment layer is not added: no current implementation in this codebase uses one, it would be new, untested surface area, and the `keydown` approach already correctly handles every scenario enumerated above.

---

## 12. Scroll-lock policy

**Existing scroll-lock implementations, confirmed this session**: `DatePickerPopover` locks `document.body.style.overflow` only, mobile-only, capturing/restoring the previous value. Four of the other eight modals lock both `document.body` and `document.documentElement`; one (`ResourceNoteEditorModal`) locks neither (relies on its parent, `ResourceManagerModal`, already having locked).

**Correction: independent capture-and-restore effects are not safe for arbitrary closing order — they are only safe under strict LIFO nesting.** An earlier draft of this mapping proved the two-layer (outer `ResponsiveDialog` + nested `DatePickerPopover`) case safe and generalized that proof to "any number of instances, any order" — that generalization is wrong. Concretely: if two independent `ResponsiveDialog` instances were ever both open at once (not a Phase A scenario today, but a case Phase A's own design must not silently break for a future caller) and they closed in a different order than they opened — e.g. dialog A opens (locks, capturing the true original value), dialog B opens (locks, capturing "hidden" from A), and then **A closes first** (not B) — A's own naive cleanup would restore `overflow` back to the *true original* value while B is still open and still needs it locked, incorrectly unlocking the page out from under a dialog that's still on screen. The two-layer `ResponsiveDialog`+`DatePickerPopover` case in Phase A itself remains safe (reasoned through below) specifically because it is constrained to a single, guaranteed LIFO order — but Phase A's own primitive must not silently assume every future nesting/multiplicity scenario will share that same constraint.

**Locked design: a small, shared, reference-counted utility**, used by `ResponsiveDialog` itself (not by `DatePickerPopover`, see the documented distinction below):

```ts
// app/components/dashboard/ui/document-scroll-lock.ts
let lockCount = 0;
let originalBodyOverflow: string | null = null;
let originalHtmlOverflow: string | null = null;

/** Acquire the shared document scroll lock. The very first acquire (count
 *  0 → 1) captures the real, pre-lock inline overflow values and sets both
 *  to "hidden"; every subsequent acquire only increments the count without
 *  touching or re-capturing anything. Returns a release function that is
 *  itself idempotent — calling it more than once is a safe no-op after the
 *  first call — and only actually restores the originally-captured values
 *  once the count returns to zero, regardless of the order acquires are
 *  released in. */
export function acquireDocumentScrollLock(): () => void {
  if (lockCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  lockCount += 1;

  let released = false;
  return function release() {
    if (released) return;
    released = true;
    lockCount -= 1;
    if (lockCount === 0) {
      document.body.style.overflow = originalBodyOverflow ?? "";
      document.documentElement.style.overflow = originalHtmlOverflow ?? "";
      originalBodyOverflow = null;
      originalHtmlOverflow = null;
    }
  };
}
```

`ResponsiveDialog` calls this from one effect: `useEffect(() => { if (!open || lockScroll === false) return; return acquireDocumentScrollLock(); }, [open, lockScroll])` — the effect's own cleanup *is* the returned `release` function, so React's normal cleanup-before-next-effect/on-unmount semantics drive acquire/release exactly like every other effect in this codebase, with the reference-counting itself living in the module-level utility rather than in `ResponsiveDialog`'s own state.

- **One lock**: count goes 0→1 on acquire, captures real originals, sets `"hidden"`; release takes it 1→0, restores the captured originals.
- **Two (nested) locks**: second acquire is 1→2, does **not** re-capture (the module-level `originalBodyOverflow`/`originalHtmlOverflow` already hold the *true* pre-any-lock values from the first acquire) and does not touch the DOM (already `"hidden"`).
- **Out-of-order release**: whichever of the two `release()`s is called first takes the count 2→1 and does nothing to the DOM (count is still non-zero); the second brings it 1→0 and performs the actual restore — correct regardless of which of the two dialogs happened to close first, closing exactly the gap the naive per-component approach had.
- **Duplicate release**: the `released` flag makes every `release()` call idempotent — a component that (incorrectly) called its own cleanup twice, or under Strict Mode's double-invoke, cannot double-decrement the shared count.
- **Strict Mode**: dev-only mount→cleanup→remount doubles each individual component's own acquire/release pair, but since each pair is itself idempotent and correctly balanced (one acquire, one matching release per effect run), the shared count returns to the same value it would have without Strict Mode.
- **Unmount while open**: covered by the same effect-cleanup mechanism as a normal close — no special case.

**Correction: a *nested* `DatePickerPopover` must also use the shared utility — its own local capture/restore is not always safe while nested, even though the previous draft's reasoning about user-interaction LIFO was correct as far as it went.** The gap: §9/§10's Escape/outside-click design guarantees LIFO order only for *user-interaction-driven* dismissal (Escape presses, backdrop clicks) — it says nothing about the outer `ResponsiveDialog` being closed **programmatically** (the caller sets `open={false}` directly, e.g. in response to a successful save that doesn't route through Escape/backdrop at all), **unmounted because of navigation** (the user navigates away from the page entirely while the nested picker is still open), or **removed by a parent** for any other reason outside this primitive's own control. None of those paths go through §9/§10's own suspended-while-nested-active handlers at all — they bypass this primitive's dismissal logic entirely — so the "the nested popover always closes first" guarantee those sections establish does **not** extend to them. If the outer dialog's own local capture/restore effect ran first (capturing the true original values) and the *nested* popover's own **separate, independent** local capture/restore effect ran second (capturing "hidden" from the outer lock), and then the outer dialog closes via one of these non-Escape/non-backdrop paths while the nested popover is still mounted and open, the outer's own cleanup would restore the true original value — incorrectly unlocking the page while the still-open nested popover still needs it locked, and the nested popover's own later cleanup would then have nothing correct left to restore *to*, potentially leaving the page **permanently locked** after the nested popover finally does close (since its own captured "original" was already-wrong "hidden," now stale). This is exactly the general failure mode §12's own opening correction describes — it was wrong to treat `DatePickerPopover`'s nesting as safely excluded from it.

**Locked architecture**:
- **Standalone `DatePickerPopover`** (no `ResponsiveDialog` ancestor) keeps its current, completely unmodified mobile-only local `document.body.style.overflow` capture/restore behavior — zero change, exactly as §16 already establishes for every other standalone behavior.
- **Nested `DatePickerPopover`** (rendered inside a `ResponsiveDialog`, `useNestedOverlayHost() !== null`) uses `acquireDocumentScrollLock()` for its own mobile-only lock, in place of its previous local capture/restore, specifically when nested. This is a real, small code change to `DatePickerPopover` (§16) — not the "zero modification" an earlier draft claimed.
- **`ResponsiveDialog`** also uses `acquireDocumentScrollLock()` (unchanged from earlier in this section).
- Because **both** the outer dialog and a nested, mobile-presented `DatePicker` now acquire references from the **same shared, reference-counted utility**, their releases are safe in **either order**, regardless of *why* either one closed (user interaction, programmatic `open={false}`, unmount from navigation, or parent removal) — the utility's own count-based restore-only-at-zero logic (already proven correct for out-of-order release, above) is what actually closes this gap, not any ordering assumption about *how* either side comes to close.
- **`lockScroll={false}` on `ResponsiveDialog` does not prevent a nested, mobile-presented `DatePicker` from acquiring its own lock.** The two are independent acquisitions against the same shared utility; a caller that opts the outer dialog out of scroll locking (for whatever reason) does not thereby also disable the nested picker's own, separately-justified mobile scroll-lock need — `DatePickerPopover`'s own mobile behavior is preserved regardless of the outer dialog's `lockScroll` setting.
- **No nested `DatePickerPopover` code path uses an independent, local, body-only capture/restore lock anymore** — only the standalone path does.

**Multiple `ResponsiveDialog` instances** (not expected this milestone, but now genuinely, provably supported rather than merely "the same reasoning generalizes"): each instance calls `acquireDocumentScrollLock()` independently; the shared reference count and single captured-original-value pair make the result correct for any nesting depth and **any closing order**, which is exactly the property the earlier per-component approach lacked — and the same property that now also makes the nested-`DatePickerPopover` case correct regardless of *how* the outer dialog comes to close.

**Cleanup under unmount and Strict Mode**: covered above for `ResponsiveDialog` — the utility's own idempotent `release()` plus React's guaranteed effect-cleanup timing are sufficient; no additional plumbing is needed beyond returning `acquireDocumentScrollLock()`'s own return value as each acquiring effect's cleanup. The same applies identically to `DatePickerPopover`'s own nested-mode acquisition — it is the exact same effect-cleanup mechanism, just triggered by that component's own `open`/nested-mode conditions instead of `ResponsiveDialog`'s.

---

## 13. Responsive behavior

**Extract a shared `useIsMobile` hook — genuinely justified, not speculative.** Confirmed via a repo-wide grep this session: `matchMedia`/`useIsMobile` exists in **exactly one** file today, `date-picker-popover.tsx`. Building `ResponsiveDialog` with its own second, independent copy of the identical ~15-line hook (same breakpoint token, same `matchMedia` query shape, same mount-effect-plus-listener pattern) would create the exact kind of duplication this codebase's own conventions elsewhere consistently avoid — this is the first genuine second consumer, which is precisely when extraction is warranted (not before).

```ts
// app/components/dashboard/ui/use-is-mobile.ts
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${dashboardBreakpoints.mobile - 1}px)`);
    function handleChange() {
      setIsMobile(query.matches);
    }
    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}
```

Lifted verbatim from `DatePickerPopover`'s current implementation (lines 202–220) — no behavior change. `date-picker-popover.tsx` is updated to import this instead of keeping its own file-local copy; this is a small, scoped, directly-in-the-loop change (not "migrating an unrelated modal" — `DatePickerPopover` is the one component Phase A is already integrating with).

- **SSR/hydration**: `useState(false)` as the initial value (matches server-rendered default), corrected in an effect after mount — identical, unchanged approach to today's; already SSR-safe since `window`/`matchMedia` are never touched during render, only inside `useEffect`.
- **Initial `matchMedia` value**: `handleChange()` is called synchronously once inside the effect (not deferred), so the correct value is set on the very first client-side commit after mount, before the user can interact with anything.
- **Viewport changes while open**: the `change` event listener on the `MediaQueryList` handles live viewport/breakpoint crossing (e.g. rotating a tablet, resizing a desktop browser window) — unchanged from today's proven behavior.
- **Listener cleanup**: `query.removeEventListener("change", handleChange)` in the effect's cleanup — unchanged.
- **jsdom**: `window.matchMedia` is already exercised by the existing `DatePickerPopover`/`DateField` test suite (confirmed: `date-field.test.tsx`'s "[Work Calendar mobile corrective pass]" test and the rest of the suite already pass under jsdom today, §2's verified-clean state) — no new jsdom polyfill/setup is required for `ResponsiveDialog` to reuse the identical mechanism.
- **The single 900px `dashboardBreakpoints.mobile` token** is reused as-is — no new breakpoint value is introduced anywhere in Phase A.
- **Desktop centered modal / mobile bottom sheet / internal scrolling**: `ResponsiveDialog` branches its own **container** styling only (max-width + centered vs. full-width + bottom-anchored + `overflow-y: auto` on the panel) — directly modeled on `DatePickerPopover`'s own proven `desktopOverlayStyle`/`desktopPanelStyle` vs. `sheetOverlayStyle`/`sheetPanelStyle` split, the only existing reference for this exact transformation in this codebase.
- **Sticky action-row support for a future Phase C consumer**: `ResponsiveDialog` exposes **no** dedicated "footer"/"action row" prop or slot. Per the manual events mapping's own already-settled design (reaffirmed here, not revisited) and per direct evidence from every existing modal in §3 (all of them render their own header/body/footer entirely as caller-supplied JSX, with zero shared chrome component existing anywhere in this codebase to draw on) — **`ResponsiveDialog` must not own the future form's header/footer layout.** Nothing in the current repository justifies otherwise. A Phase C consumer wanting a sticky action row implements it with plain CSS inside its own `children` (e.g. `position: sticky; bottom: 0` on its own footer element, which works correctly inside the panel's own `overflow-y: auto` scroll container with zero primitive involvement) — this is a well-understood, standard CSS technique that needs no dedicated API surface.

---

## 14. ARIA and accessibility

- **`role="dialog"`**: on the panel (§7) — matches the majority existing convention (7 of 9 modals; `UpgradeModal` is the sole, already-known-deficient exception, §3).
- **`aria-modal`**: `"true"` on the panel, unconditionally (`ResponsiveDialog` is always a true modal, unlike `DatePickerPopover`, §12) — matches 7 of 9 existing modals.
- **`aria-labelledby` vs `aria-label`**: the caller must supply **exactly one**, enforced by the `ResponsiveDialogAccessibleName` discriminated union at compile time (§6, corrected from an earlier draft that left this as a doc-comment-only preference backed by nothing but a runtime warning) — passing neither, or both, is a TypeScript error, not merely a console message a developer could miss. `aria-labelledby` is the preferred *choice between the two* (pointing at the caller's own visible heading id), since several existing modals use `aria-label` despite having a perfectly good visible heading to point to instead — that specific preference remains a documented convention, not something the type system itself can express (the union only enforces "exactly one," not "prefer this one").
- **`aria-describedby`**: optional passthrough, unchanged semantics.
- **Screen-reader behavior while the nested DatePicker is open**: unchanged from `DatePickerPopover`'s current, already-shipped, already-tested behavior — its own `role="dialog"` (with **no** `aria-modal`, a deliberate, existing, unchanged design decision, §4) continues to announce as a dialog without claiming full-page modality, exactly as it does standalone today. Nothing about being nested changes its own ARIA surface.
- **Should the nested DatePicker gain `aria-modal` now that it's inside a real modal?** No — no current evidence justifies changing this deliberate, already-shipped decision, and doing so is outside Phase A's actual requirement (the task is coordination, not a redesign of `DatePickerPopover`'s own accessibility model).
- **Background page content `inert`/`aria-hidden`**: **not added.** Confirmed absent from all nine existing modal implementations (no `inert`/`aria-hidden` attribute found in any of them this session) — `ResponsiveDialog` matches this exact, pre-existing, accepted gap rather than introducing new, untested surface area beyond what any current dialog in this codebase does. `aria-modal="true"` plus a correctly-functioning focus trap is the accepted baseline here today; adding `inert` now, with no existing precedent and no current bug report driving it, would be speculative scope growth for this milestone.
- **44px touch targets**: `ResponsiveDialog` itself renders no interactive elements of its own (no built-in close button — chrome remains 100% caller-authored, reaffirming the existing mapping's own explicit boundary, §6) — this requirement falls entirely on caller-supplied content, exactly as it already does for every other existing modal's own buttons (e.g. `.t2t-cal-day-button`'s already-established 44×44px sizing in `calendar.tsx`).
- **Reduced-motion / animation**: **no open/close animation is added.** `DatePickerPopover` has none today (confirmed: no `transition`/`animation` CSS property anywhere in its style objects) — matching this keeps mount/unmount fully synchronous, simpler to reason about, and simpler to test (no need to wait for/mock a transition-end event in either component's test suite). Adding purely-cosmetic animation now would directly contradict the task's own explicit instruction not to add it if it complicates correctness or testing.

---

## 15. CSS and z-index

**Existing tokens** (`tokens.ts`, confirmed unchanged, §2):
```
base: 1, sticky: 100, header: 1000, popover: 1200, overlay: 3000, modal: 3100, toast: 4000
```

**A concrete, provable bug would exist without addressing z-index — this is not merely an event-coordination nicety.** `DatePickerPopover` currently renders at `dashboardZIndex.popover` (1200). `ResponsiveDialog`'s natural default is `dashboardZIndex.modal` (3100) — **higher** than `popover`. Nesting the popover inside the dialog with **no z-index change at all** would render the popover **visually behind** the dialog panel (1200 < 3100) — not just create a dismissal-ordering ambiguity, but make the calendar grid literally invisible/unusable when opened from inside the dialog.

**No new global token is required.** `ResponsiveDialog` accepts `zIndex?: number` (default `dashboardZIndex.modal`, §6) for its own backdrop/panel. The nested-overlay **host** (owned by `ResponsiveDialog`, not `DatePickerPopover`) stacks at **`zIndex + 100`** — computed relative to whatever `zIndex` is actually in effect for *that* dialog instance, rather than a second, independent global constant that could silently drift out of sync with a caller-customized `zIndex`. `tokens.ts` is **not modified**.

**`DatePickerPopover`'s own internal z-index styling needs zero changes.** Because the host establishes its own stacking context (via `position: fixed` plus its own z-index, §7) as a sibling of — and stacked above — the outer dialog's backdrop/panel, everything portaled *into* the host (including `DatePickerPopover`'s own `desktopOverlayStyle`/`sheetOverlayStyle`, both still using `dashboardZIndex.popover` internally) inherits a correctly-elevated position automatically: a descendant's z-index only ever competes against *siblings within the same stacking context*, and the host's own elevated stacking context already places its entire subtree above the outer dialog, regardless of the smaller absolute z-index numbers used internally within that subtree.

**Stacking order, top to bottom**: nested-overlay host subtree (`zIndex + 100`) → dialog panel (`zIndex`, same context as backdrop) → dialog backdrop (`zIndex`) → rest of the page.

- **Desktop width/max-width**: matches `DatePickerPopover`'s own `desktopPanelStyle` precedent (`minWidth: 300`) as a starting point — `ResponsiveDialog`'s own panel additionally needs a `maxWidth` (e.g. `560px`, a reasonable form-dialog width with no existing precedent to contradict, since no current modal in this codebase is a *form* dialog of this shape) and horizontal auto-centering.
- **Mobile width/max-height**: matches `DatePickerPopover`'s own `sheetPanelStyle` precedent exactly (`width: "100%"`, `maxHeight: "calc(100vh - 48px)"`, `overflowY: "auto"`, top corners rounded).
- **Safe-area inset handling**: no existing modal in this codebase currently accounts for `env(safe-area-inset-*)` (confirmed absent from every style object read this session) — **not added** for the same reason `inert` isn't (§14): no precedent, no current evidence of a real device issue driving it, and adding it now would be scope growth beyond what any other dialog in this codebase does today. Flagged in §22 as a known, pre-existing, accepted gap, not a Phase A regression.
- **Overflow ownership**: the panel owns its own `overflow-y: auto` (mobile) / natural sizing (desktop); the backdrop and host both stay `overflow: visible` (they're viewport-sized anchor/dimming layers, not scroll containers).
- **Border-radius**: mobile — top corners only (matches `DatePickerPopover`'s `sheetPanelStyle`); desktop — all corners (matches its `desktopPanelStyle`).
- **`pointer-events`**: the backdrop is fully interactive (`auto`, default) to catch outside-clicks; the nested-overlay host is explicitly `pointer-events: auto` (corrected from an earlier draft's `none`, §7) — it is harmless while empty not because of its `pointer-events` value but because it has **zero dimensions** (no `inset`/`width`/`height` of its own), so there is nothing for the browser to hit-test against at any screen coordinate regardless of that value; `DatePickerPopover`'s own portaled content is explicitly interactive on its own terms once present, not by virtue of any `none`-to-`auto` inheritance override.

**Z-index is reaffirmed as supplementary, not primary**, for the *event/focus* coordination problems (§9/§10/§11) — those are solved by event-phase separation, native hit-testing, and React effect ordering respectively, none of which depend on z-index at all. Z-index here is solving a **separate, real, purely visual** problem (paint order / stacking), which happens to also need a correct value for the *outside-click* mechanism in §10 to work (since that mechanism depends on the popover's overlay being the topmost element at every screen coordinate) — but it is not, on its own, a substitute for the Escape/focus mechanisms described elsewhere.

---

## 16. Existing DatePicker compatibility

**Standalone (non-nested) behavior is provably unaffected.** Every new code path in `DatePickerPopover` is gated behind `useNestedOverlayHost() !== null` — a context read that returns `null` for every existing caller today, since none of them render inside a `ResponsiveDialog` ancestor (which doesn't exist in production code until Phase C). Concretely, for a standalone caller:
- `hostElement` lookup is skipped entirely; the component portals to `document.body`, exactly as today (§4) — the literal same line of code, unconditionally reached when the context itself is `null` (not merely when `hostElement` is `null` — that "not-yet-hosted" case is a genuinely *nested* state, §7, and behaves differently: it renders nothing and waits, it does not fall back to `document.body`).
- The Escape listener registers in the default bubble phase, exactly as today — the `{ capture: true }` branch is only taken when nested.
- `registerNestedOverlay`/`unregisterNestedOverlay` are never called (there is no context value to call them on).
- The scroll lock stays exactly the component's own existing local mobile-only capture/restore (§12, Correction 1) — the shared-utility branch is only taken when nested.
- Every other behavior — outside-click, focus trap, focus return, `useIsMobile` (now sourced from the shared hook, §13, but behaviorally identical) — is completely untouched by this change.

**The regression proof is a real, executable test** (§17): `date-field.test.tsx`'s **entire existing suite is re-run completely unmodified** against the updated `date-picker-popover.tsx` as a direct regression guard — the actual pre-existing 18-test suite (§2) passing exactly as it does today, not a new assertion written to *claim* compatibility. `date-field.test.tsx` itself is **not** in the modified-file list (§19) at all — it is read-only regression evidence. All of this milestone's own new nested-integration test cases live in one dedicated new file (§17/§19), never mixed into `date-field.test.tsx`.

**Exact diff scope on `date-picker-popover.tsx`**: replace the file-local `useIsMobile` with an import from the new shared hook (§13); replace the two hardcoded `FOCUSABLE_SELECTOR`/query lines with the shared helper import (§11); add one `useNestedOverlayHost()` call; branch the portal target and mount condition — `nestedOverlay === null` → portal to `document.body` immediately (standalone, unchanged); `nestedOverlay !== null && nestedOverlay.hostElement === null` → render `null` and wait (nested but not yet hosted, §7); `nestedOverlay !== null && nestedOverlay.hostElement !== null` → portal into `nestedOverlay.hostElement`; generate a stable registration id via `useId()` (Correction 2); move Escape-listener setup and `registerNestedOverlay` registration into one `useLayoutEffect`, gated on `open && nestedOverlay !== null && nestedOverlay.hostElement !== null`, with its cleanup removing the capture-phase listener and calling `unregisterNestedOverlay` with the same id (Correction 2, §9/§16); branch the Escape listener's `capture` option and add the nested-mode-only `stopPropagation()` call; branch the mobile scroll-lock effect between the existing local capture/restore (standalone) and `acquireDocumentScrollLock()` (nested, Correction 1, §12). No existing prop, export, or JSX structure changes.

---

## 17. Automated test matrix

**One unambiguous total: 56 new automated tests**, across three files, numbered continuously below (1–56) — plus the existing, completely unmodified 18-test `date-field.test.tsx` suite, re-run as a regression guard (not counted in the 56, since it is not a new test; stated once, here, and not double-counted anywhere else in this report).

**`responsive-dialog.test.tsx` (new) — 29 tests**

| # | Case | jsdom-provable? |
|---|---|---|
| 1 | Portal mounts into `document.body` on open; unmounts (`null`) on close | Yes |
| 2 | Correct accessible dialog name via `getByRole("dialog", { name })`, for both `aria-labelledby` and `aria-label` | Yes |
| 3 | `initialFocusRef` pointing at a valid, connected, in-panel, non-disabled element receives focus on open | Yes |
| 4 | `initialFocusRef.current` detached (not connected) → falls through to the first focusable descendant | Yes |
| 5 | `initialFocusRef.current` pointing outside the panel entirely → falls through to the first focusable descendant | Yes |
| 6 | `initialFocusRef.current` matching `:disabled` → falls through to the first focusable descendant | Yes |
| 7 | `initialFocusRef.current` with `aria-disabled="true"` (but not `:disabled`) → falls through to the first focusable descendant (Correction 6 — proves the check is not merely a `.disabled` property read) | Yes |
| 8 | No `initialFocusRef` supplied, but the panel has focusable descendants → the first one is focused | Yes |
| 9 | No `initialFocusRef` and no focusable descendants at all → the panel itself (`tabIndex={-1}`) is focused | Yes |
| 10 | Tab from the last focusable element wraps to the first | Yes |
| 11 | Shift+Tab from the first focusable element wraps to the last | Yes |
| 12 | Escape closes (not busy) | Yes |
| 13 | Escape does nothing while `busy` | Yes |
| 14 | Escape does nothing when the event's `defaultPrevented` is already `true` (Correction 3) | Yes |
| 15 | Backdrop click closes (not busy) | Yes |
| 16 | Backdrop click does nothing while `busy` | Yes |
| 17 | Click inside the panel never closes | Yes |
| 18 | Tab is not processed by the outer focus trap when the event's `defaultPrevented` is already `true` (Correction 3) | Yes |
| 19 | Scroll lock sets `body`+`documentElement` overflow to `hidden` on open, via `acquireDocumentScrollLock()` | Yes |
| 20 | Scroll lock restores the pre-open values on close | Yes |
| 21 | Focus returns to the trigger *captured at open time* when the dialog closes via `open` transitioning to `false` (Correction 4) | Yes |
| 22 | Focus return is a safe no-op when the captured trigger is detached before close (no throw) | Yes |
| 23 | Focus still returns to the *originally-captured* trigger even if `triggerRef.current` is reassigned to point at a different element while the dialog remains open (Correction 4 — proves the primitive uses the captured value, never a live re-read) | Yes |
| 24 | Focus returns to the captured trigger when the component is conditionally **unmounted** while still `open`, not only when `open` flips to `false` (Correction 4) | Yes |
| 25 | Desktop branch renders the centered-modal container shape (assert via DOM structure/class, not computed-style z-index numbers) | Yes |
| 26 | Mobile branch renders the bottom-sheet container shape, under a mocked `matchMedia` | Yes |
| 27 | The nested-overlay host renders with zero explicit size (no `inset`/`width`/`height`) and `pointer-events: auto` — asserted directly against its style, not inferred (§7) | Yes |
| 28 | Cleanup on unmount while open (scroll lock restored via the shared utility, listeners removed — assert no lingering `document.body.style.overflow: "hidden"` after unmount) | Yes |
| 29 | No duplicate scroll-lock/listener side effects under React Strict Mode's double-invoke (render inside `<StrictMode>`, assert final state matches non-Strict-Mode render) | Yes, partially — Strict Mode's double-invoke behavior is real and testable in jsdom, but does **not** substitute for confirming there's no *visible* double-flicker in a real browser (§18) |

**`document-scroll-lock.test.ts` (new, pure unit tests against the shared utility, §12) — 6 tests**

| # | Case | jsdom-provable? |
|---|---|---|
| 30 | A single `acquireDocumentScrollLock()`/`release()` pair locks then restores both `body` and `documentElement` overflow | Yes |
| 31 | Two nested acquires: only the first sets `"hidden"` and captures originals; the second is a no-op against the DOM | Yes |
| 32 | Out-of-order release: releasing the *first* acquire while the second is still held does not restore the DOM; only releasing both (in either order) restores it | Yes |
| 33 | Duplicate `release()` calls on the same acquire are idempotent — a second call is a no-op, does not double-decrement the shared count, and does not affect an unrelated still-held lock | Yes |
| 34 | Restoration returns the *actual* pre-lock inline value when one was already set (e.g. `document.body.style.overflow = "auto"` before acquiring) — not a hardcoded `""` | Yes |
| 35 | React Strict Mode's mount→cleanup→remount double-invoke of an acquiring effect leaves the shared count exactly where a single, non-Strict-Mode mount would | Yes |

**`date-picker-popover-nested.test.tsx` (new, dedicated nested-integration file — the one, exclusive location for these cases; `date-field.test.tsx` itself is never modified, only re-run unmodified as a separate regression guard, above) — 21 tests, using a small test-only wrapper that renders `ResponsiveDialog` + `DateField` together (not a new production component); registry-internal claims (Correction 5) are proven through observable dialog behavior — e.g. "the outer dialog's Escape now closes it directly" — or a small test-only nested-consumer component defined in this file, never through a widened production context API**

| # | Case | jsdom-provable? |
|---|---|---|
| 36 | The nested-overlay host is a DOM **sibling** of the panel — asserted via `host.parentElement === panel.parentElement` (or equivalent), never a descendant of the panel | Yes |
| 37 | No popover content renders anywhere (including directly in `document.body`) and no registration occurs while nested but the host is not yet available; both the content and the registration appear together once the host is set (Correction 2 — merges the "wait, don't fall back" DOM proof with the "no registration before host availability" proof, since both are driven by the identical guard condition) | Yes |
| 38 | The nested registration id, generated via `useId()`, remains stable across re-renders of `DatePickerPopover` while it stays open (Correction 2) | Yes |
| 39 | Exactly one registration occurs, established via `useLayoutEffect` (before paint) once `open && hostElement !== null` — asserted with no intermediate frame where the popover's content is present in the DOM but the outer dialog's Escape/backdrop still behave as if nothing were nested (Correction 2) | Yes |
| 40 | `DatePickerPopover` portals into the host once available, when `NestedOverlayContext` is present | Yes |
| 41 | One Escape closes only the nested `DatePickerPopover`; the outer dialog stays open | Yes |
| 42 | A second, subsequent Escape then closes the outer dialog | Yes |
| 43 | Click outside the DatePicker but inside the dialog panel closes only the DatePicker | Yes |
| 44 | Click inside the DatePicker never closes the outer dialog | Yes |
| 45 | Click on the outer backdrop while the DatePicker is open closes only the DatePicker (not both) | Yes |
| 46 | The outer focus trap does not steal focus from the DatePicker's own internal day-cell navigation (keyboard flow test, mirroring `date-field.test.tsx`'s existing "full keyboard-only selection flow" case, §4, now nested) | Yes |
| 47 | Closing the nested DatePicker returns focus to the Date field's own trigger, and the outer trap resumes normal Tab-cycling afterward without further intervention | Yes |
| 48 | Cleanup on **close** unregisters the nested overlay's id — no stuck "active" registration; the outer dialog's Escape closes it directly on the very next press | Yes |
| 49 | Cleanup on **unmount** (not merely a close driven by `open`) also unregisters the nested overlay's id, via the same `useLayoutEffect` cleanup (Correction 2) | Yes |
| 50 | No duplicate registration under Strict Mode (assert exactly one active id is registered, not a double-counted artifact, when rendered inside `<StrictMode>`) | Yes |
| 51 | Scroll lock remains active (body `overflow: hidden`, via the shared `acquireDocumentScrollLock()` utility) through the entire nested-open period and is not prematurely restored when only the nested popover closes — only cleared once the *outer* dialog itself also releases | Yes |
| 52 | A nested, mobile-presented `DatePickerPopover` acquires its own **second** reference on the shared scroll-lock utility (not an independent local capture/restore) — confirmed by observing the shared lock's own effective reference count reach 2 while both the outer dialog and the nested popover hold it simultaneously (Correction 1) | Yes |
| 53 | A **programmatic** close of the outer `ResponsiveDialog` (`open` set to `false` directly, not via Escape/backdrop) while the nested popover is still open and still holding its own shared-lock reference does not prematurely unlock the document — the page remains locked until the popover's own reference is also released (Correction 1) | Yes |
| 54 | An outer-dialog **unmount** (simulating navigation away) while the nested popover is still open behaves identically to outcome 53 — the document does not become permanently locked once the popover eventually closes/unmounts afterward, nor does it unlock too early (Correction 1) | Yes |
| 55 | Releasing the outer dialog's and the nested popover's shared-lock references in either order converges to the same fully-unlocked end state — cleanup order does not matter (Correction 1) | Yes |
| 56 | Standalone `DatePickerPopover` (no `ResponsiveDialog` ancestor) continues to use its own existing local mobile-only capture/restore lock, completely unaffected by the shared utility introduced for the nested case (Correction 1) | Yes |

**What jsdom cannot prove, deferred to manual QA (§18)**: true visual stacking/paint order (jsdom performs no real layout/paint — this is the same, already-accepted limitation `calendar-compact-selector.test.tsx`'s own tests explicitly document, §2's corrective-pass history), real viewport-resize-across-breakpoint behavior, real mobile browser virtual-keyboard interaction, and any subjective "does this look right / is anything visibly clipped" judgment. **Brittle z-index computed-style assertions are deliberately not used anywhere in this matrix** as a stand-in for these — DOM-structure assertions (sibling relationships, ancestor-chain checks, explicit zero-size/`pointer-events` style checks) and behavioral assertions (what actually closes/focuses/scrolls) are used instead, exactly per the task's own instruction.

---

## 18. Manual QA plan

**Correction: not everything defers to Phase C.** An earlier draft of this mapping deferred essentially the entire manual QA burden to Phase C, on the reasoning that Phase A ships no visible feature of its own. That reasoning is only half right — it's true for `ResponsiveDialog`'s own new chrome (no production consumer exists yet), but Phase A's own refactor genuinely touches an **existing, already-shipped, production-reachable surface**: `date-picker-popover.tsx` is modified (§16), and `use-is-mobile.ts`/`focus-trap.ts` are extracted out of it (§13/§11) — both are real changes to code the current `DateField`/`DeadlineField` (project-deadline editing) feature already depends on in production today. A regression pass on *that* real surface is due **now**, as part of Phase A itself, not deferred alongside the genuinely-not-yet-shippable `ResponsiveDialog` chrome. No temporary production route or committed harness is needed for this — `DateField`/`DeadlineField` are already reachable through the existing project-deadline UI.

**Phase A manual QA — performed now, as part of this milestone**:
- Locate an existing, real `DateField`/`DeadlineField` usage in the current dashboard (project-deadline editing) and exercise it directly — no scratch harness, no throwaway route.
- Desktop: open the picker, select a date, Clear, Today, Escape (closes without committing), click outside (closes without committing), confirm focus returns to the trigger after every close path.
- Mobile: confirm the bottom-sheet presentation still renders correctly, and that closing it restores normal page scrolling.
- Confirm no behavior regression specifically attributable to the `useIsMobile`/`focus-trap.ts` extraction (§11/§13) — the picker should look and behave identically to before this milestone, since both extractions are verbatim lifts with zero intended behavior change; this pass is what actually confirms that claim against real browser behavior, not just jsdom.

**Deferred to Phase C** (unchanged from the reasoning in the earlier draft, still valid for this specific part): `ResponsiveDialog`'s own new chrome, nested-DatePicker visual stacking, bottom-sheet-inside-bottom-sheet interaction, and the full 320/360/375/390/400px Manual Event form QA — none of these have a real production consumer until `AddEditCalendarEventDialog` exists. Performing this pass now would require building a throwaway harness that mostly re-verifies the same primitive behavior a real Phase C pass will already cover, for the cost of building and discarding scratch code — still not a good trade, and still avoided by **not** shipping a temporary production route or a committed test harness for it. If desired, an even earlier, informal look at `ResponsiveDialog`'s own chrome can be done via a local, never-committed scratch file (mounting `ResponsiveDialog` wrapping a `DateField` and discarding the file afterward), covering:

**Desktop**:
- Keyboard-only: open, Tab through content, Shift+Tab, close via Escape, reopen.
- `initialFocusRef` behavior: confirm the intended target actually receives focus first when supplied.
- Nested DatePicker: open it from inside the dialog, verify it paints above the dialog panel, interact with day-cell keyboard navigation.
- Escape sequence: press Escape once (only the DatePicker closes), press again (dialog closes).
- Backdrop sequence: click backdrop once while DatePicker open (only DatePicker closes), click again (dialog closes).
- Focus return: confirm focus lands back on the element that opened the dialog after every close path.
- Page scroll lock: confirm the page behind the dialog does not scroll with the mouse wheel while open.
- Resize the browser window across the 900px breakpoint while the dialog is open; confirm it switches presentation live, with no broken layout mid-transition.

**Mobile widths — 320, 360, 375, 390, 400**:
- Bottom-sheet placement (anchored to the bottom edge, not floating mid-screen).
- No clipping of any content, including the nested DatePicker.
- Internal scrolling works when content exceeds the sheet's max height.
- DatePicker renders visibly above the sheet, not behind or clipped by it.
- The native page does not scroll behind the open sheet.
- Virtual-keyboard interaction (if any text input is present in the test harness) does not break the sheet's layout or push it off-screen unrecoverably.
- Closing the nested DatePicker does not also close the sheet.
- Closing the sheet restores normal page scrolling immediately.

This informal early look is optional and non-binding — the real, required pass on this content is Phase C's own, against the actual production consumer.

---

## 19. Exact anticipated file list

**New**

| File | Why | Exports | Depends on | Tests | Risk |
|---|---|---|---|---|---|
| `app/components/dashboard/ui/responsive-dialog.tsx` | The primitive itself, plus its co-located, minimal `NestedOverlayContext`/`useNestedOverlayHost` (§8, Correction 5) | `ResponsiveDialog`, `ResponsiveDialogProps`, `useNestedOverlayHost`, `NestedOverlayContextValue` (three fields only: `hostElement`, `registerNestedOverlay`, `unregisterNestedOverlay`) | `use-has-mounted.ts`, `use-is-mobile.ts` (new), `focus-trap.ts` (new), `document-scroll-lock.ts` (new), `tokens.ts` | `responsive-dialog.test.tsx` | Medium — new surface area, but each behavior mirrors an already-proven `DatePickerPopover` mechanism |
| `app/components/dashboard/ui/responsive-dialog.test.tsx` | Tests 1–29, §17 | — | Testing Library, `vitest` | — | Low |
| `app/components/dashboard/ui/use-is-mobile.ts` | Extracted, justified in §13 | `useIsMobile` | `tokens.ts` | Covered indirectly via both consumers' own suites | Low — verbatim lift, zero behavior change |
| `app/components/dashboard/ui/focus-trap.ts` | Extracted, justified in §11 | `FOCUSABLE_SELECTOR`, `getFocusableElements` | none | `focus-trap.test.ts` — small dedicated pure-function tests (trivial, cheap, and it's now shared) | Low — verbatim lift, zero behavior change |
| `app/components/dashboard/ui/document-scroll-lock.ts` | The shared, reference-counted scroll-lock utility (§12, Correction 3) — a genuinely new mechanism, not an extraction of existing code | `acquireDocumentScrollLock` | none | `document-scroll-lock.test.ts` — tests 30–35, §17 | Medium — new, non-trivial state-machine logic (reference counting, idempotent release), though small and fully unit-testable in isolation from React entirely |
| `app/components/dashboard/ui/calendar/date-picker-popover-nested.test.tsx` | The one, exclusive location for every nested-integration test case (§16/§17, Correction 7 — replaces an earlier draft's ambiguous "update `date-field.test.tsx`, or a new file" framing) | — | Testing Library, `vitest`, `responsive-dialog.tsx`, `date-picker-popover.tsx`, `date-field.tsx` | Tests 36–56, §17 | Low — additive test-only file |

**Modified**

| File | Why | Risk |
|---|---|---|
| `app/components/dashboard/ui/calendar/date-picker-popover.tsx` | Optional nested-integration path (§9/§10/§12/§16) — `useId()`-based registration, `useLayoutEffect`-timed registration + capture-phase Escape setup, conditional portal target, the nested-only shared-scroll-lock branch — a real, scoped change, not a rewrite | Medium — the highest-value regression target in Phase A; fully mitigated by re-running its existing 18-test suite unmodified (§16/§17) |

**Explicitly not modified**: `tokens.ts` (no new token needed, §15), `date-field.test.tsx` (re-run only, never edited — its own 18 tests are the standalone-regression proof, §16, and are not counted among this milestone's 56 new tests, §17), any of the other eight existing modals (§3), any Manual Event / `WorkCalendarClient` file (§5), `calendar.tsx`, `date-field.tsx` (its own contract — `value`/`onChange`/etc. — is untouched; it doesn't even need to know nesting exists, since `DatePickerPopover` is what changes, one layer below it).

---

## 20. Implementation sequence

- **A1. Shared primitives** — `use-is-mobile.ts`, `focus-trap.ts`, and `document-scroll-lock.ts` (§12, Correction 3 — the one genuinely new, not-merely-extracted primitive in this step), each independently testable in isolation before anything else depends on them.
- **A2. `ResponsiveDialog` base** — portal, mount-gate, backdrop/panel/host structure (§7), `aria-modal`/`role="dialog"`, the compile-time accessible-name union (§6/§14), the `defaultPrevented`-aware, ref-read-gated Escape and Tab/Shift+Tab handler contract (§9/§11, Correction 3), the deterministic three-step initial-focus order with the no-unsafe-cast `:disabled`/`aria-disabled` validity check (§11, Corrections 4/6), the captured-trigger-based focus-return contract covering both `open`-driven close and raw unmount (§11, Correction 4), scroll lock via A1's shared utility, desktop/mobile branching (using A1's hook), `busy` gating. Fully testable and correct **standalone**, with no nested-overlay concept yet.
- **A3. Nested host/context** — the host `<div>` + callback ref (§7/§8, real React rendering only, no manual DOM APIs), the minimal three-field `NestedOverlayContext` (§8, Correction 5), the ref-backed `registerNestedOverlay`/`unregisterNestedOverlay` registry (kept entirely internal, never exposed beyond the three public fields), and the outer dialog's own ref-read-gated suspension of Escape/outside-click/focus-trap. Still no real nested consumer yet — testable via a minimal test-only fake nested overlay in `responsive-dialog.test.tsx` itself (§8's testing-methodology note).
- **A4. `DatePickerPopover` integration** — the opt-in portal-target branch (including the "wait, don't fall back to `document.body`" case while nested-but-not-yet-hosted, §7), a stable `useId()`-derived registration id, moving registration + capture-phase Escape setup into one `useLayoutEffect` so both are active before paint (§9/§16, Correction 2), and the nested-only branch onto the shared `acquireDocumentScrollLock()` utility for the mobile scroll lock, leaving the standalone path's own local capture/restore untouched (§12/§16, Correction 1). This is where §9's real mechanism gets exercised against a real overlay for the first time.
- **A5. Focused tests and standalone regression** — the full matrix in §17 (56 new cases across `responsive-dialog.test.tsx`, `document-scroll-lock.test.ts`, and the dedicated new `date-picker-popover-nested.test.tsx`), plus re-running `date-field.test.tsx`'s entire existing 18-test suite completely unmodified as the compatibility proof (not counted among the 56).
- **A6. Typecheck/lint/full-suite, plus the Phase-A-now portion of manual QA** — `npx tsc --noEmit`, targeted `eslint` on every new/modified file, `npm run lint`, `npx vitest run` (full suite, confirming zero regressions anywhere else in the 752-test baseline established after Phase B), **and** the "Phase A manual QA now" pass on the real, existing `DateField`/`DeadlineField` production surface (§18, Correction 7 — this is a real regression check on shipped functionality this milestone's own refactor touches, and it is run now, not deferred). `npm run build` and the `ResponsiveDialog`-chrome-specific manual QA remain deferred (§18) and are the user's own step.

**Commit grouping**: A1–A5 are tightly interdependent (A2 needs A1, A3 needs A2, A4 needs A3, A5 proves all of the above together) and should land as **one Phase A commit** — splitting them would leave intermediate commits in states that don't fully make sense on their own (e.g. a `ResponsiveDialog` with a nested-overlay context but no real consumer of it yet is not independently useful or testable-to-completion). The one place a **separate commit could genuinely be justified** is A1 alone (`use-is-mobile.ts`/`focus-trap.ts` extraction), since it is a small, self-contained, zero-behavior-change refactor of existing code that stands on its own — but bundling it with the rest into one commit is also perfectly reasonable and arguably simpler to review as a single coherent unit. This report does not mandate a split; the user, who owns all commits, can decide based on review-size preference.

---

## 21. Architecture diagram

```
document.body
└── ResponsiveDialog portal root (ONE createPortal call, real React elements only —
      no document.createElement/appendChild anywhere, §7)
      ├── backdrop  (position:fixed; inset:0; z-index: zIndex; onMouseDown outside-click)
      │     └── panel  (role="dialog"; aria-modal="true"; compile-time-enforced
      │           aria-labelledby XOR aria-label, §6/§14; tabIndex={-1}; focus-trap
      │           boundary; z-index: zIndex)
      │           └── {children}  ← caller-authored chrome (Phase C: CalendarEventForm)
      │                 └── CalendarEventDateField (Phase C)
      │                       └── DateField (unchanged contract)
      │                             └── DatePickerPopover (nested mode)
      │                                   ├── useId() → stable registration id (§8/§9)
      │                                   ├── useNestedOverlayHost() → non-null (nested)
      │                                   ├── hostElement null → renders null, no registration
      │                                   │     yet, waits (§7/§9, Correction 2)
      │                                   ├── hostElement set → ONE useLayoutEffect, before
      │                                   │     paint, both: registerNestedOverlay(id) AND
      │                                   │     attach {capture:true} Escape listener
      │                                   │     (Correction 2) → then portals into hostElement
      │                                   ├── Escape: {capture:true} + stopPropagation()
      │                                   ├── cleanup (close OR unmount): remove capture
      │                                   │     listener + unregisterNestedOverlay(id)
      │                                   └── mobile scroll lock: acquireDocumentScrollLock()
      │                                         (Correction 1 — NOT the local capture/restore
      │                                         standalone mode uses)
      │
      └── nested-overlay host  (<div ref={setHostElement}>, position:fixed;
            z-index: zIndex + 100; pointer-events:auto; ZERO explicit size — nothing to
            hit-test while empty, §7; DOM SIBLING of backdrop+panel, never inside panel's
            scroll region)
            └── (DatePickerPopover's own overlay/panel render here when nested)

NestedOverlayContext, provided by ResponsiveDialog, consumed by DatePickerPopover — a
minimal, three-field public shape (§8, Correction 5):
  { hostElement, registerNestedOverlay, unregisterNestedOverlay }
  (ResponsiveDialog's own activeNestedOverlayIdsRef: MutableRefObject<Set<string>> stays
  entirely INTERNAL, never on the public context — read directly at event time by
  ResponsiveDialog's own Escape/backdrop/focus-trap handlers only)

Scroll lock: ResponsiveDialog AND a nested DatePickerPopover both call the shared,
reference-counted acquireDocumentScrollLock() (§12,
app/components/dashboard/ui/document-scroll-lock.ts) — correct for any number of
ResponsiveDialog instances, and for the outer dialog and a nested DatePicker, releasing in
any order, including a programmatic close or an unmount-from-navigation that bypasses the
Escape/backdrop LIFO guarantee entirely (Correction 1). Only STANDALONE DatePickerPopover
keeps its own existing, unmodified, local mobile-only capture/restore lock.

Standalone DatePickerPopover (every existing caller today, and Phase A's own regression
suite): useNestedOverlayHost() → null → portals to document.body immediately, exactly as
today, Escape stays bubble-phase exactly as today, own local scroll lock exactly as today
— zero behavior change.
```

---

## 22. Risks and stop conditions

- **Highest-risk existing regression**: `DatePickerPopover`'s standalone behavior breaking for its current, only production caller (`DateField`, used today for project deadlines). Mitigated by making every new code path — including the nested-only scroll-lock branch (§12, Correction 1) and the `useId()`/`useLayoutEffect`-based registration timing (§9, Correction 2) — strictly conditional on `useNestedOverlayHost() !== null` (a condition that is `null` for every existing caller) and by treating the current 18-test `date-field.test.tsx` suite passing completely unmodified as a hard gate, not optional (§16/§17).
- **Focus-trap and focus-return race risk**: closed by the explicit, deterministic three-step initial-focus order with its no-unsafe-cast disabled-state check (§11, Correction 6), the captured-trigger-at-open focus-return contract that covers both `open`-driven close and raw unmount identically (§11, Correction 4), the `defaultPrevented`-aware handler ordering (§11, Correction 3), and the ref-backed internal registry read at event time for trap-suspension (§8) — none of these depend on effect timing, render-order assumptions, or which element `triggerRef.current` happens to point to by the time cleanup runs.
- **Escape-listener-ordering risk**: this is the risk the task most explicitly flagged, and it is fully closed by the capture/bubble phase-separation design in §9 — not "probably fine," but a hard browser-spec guarantee, now additionally required to run before paint via `useLayoutEffect` (§9, Correction 2) so there is no visible-but-unregistered window either. The residual risk is purely one of *implementation correctness* (did the code actually register `{capture:true}`, call `stopPropagation()`, and set up the `useLayoutEffect` correctly), not of the *design* being unsound — fully covered by tests 41/42 in §17.
- **Nested portal clipping risk**: closed by the sibling-host DOM structure (§7) plus the stacking-context reasoning in §15 — both are provable from CSS semantics, not assumed. Residual risk is limited to real-browser rendering quirks that jsdom cannot surface — covered by manual QA (§18) if/when performed.
- **Scroll-lock cleanup/ordering risk**: an earlier draft of this mapping under-scoped this risk twice over — first claiming the naive per-component capture/restore pattern generalized safely to any nesting/closing order for `ResponsiveDialog` instances generally (§12), then separately claiming `DatePickerPopover`'s own nested-mode local lock remained safe on the strength of a user-interaction LIFO guarantee that does not actually cover programmatic closes or unmounts from navigation (§12, Correction 1). Both are now closed by the same shared, reference-counted `acquireDocumentScrollLock()` utility — used by `ResponsiveDialog` **and** by a nested `DatePickerPopover`'s own mobile lock — which is correct for any acquire/release order by construction, regardless of *why* either side comes to close.
- **Hydration/`matchMedia` risk**: none new — `useIsMobile` is a verbatim lift of already-shipped, already-SSR-safe code (§13), and `ResponsiveDialog` itself gates all portal rendering behind `useHasMounted()` exactly like `DatePickerPopover` does today. `useLayoutEffect`'s own usual SSR-mismatch risk (§11, §16) does not apply here for the same reason — this content never renders on the server at all.
- **Is the public API surface (both props and context) too general or too narrow?** Evaluated deliberately at each decision point, and revised more than once during this mapping process — evidence this is genuinely requirement-driven, not a fixed bias in either direction: `initialFocusRef` was initially rejected for lack of concrete need, then correctly reinstated once the approved manual events mapping's own already-locked Title-field-first-focus requirement was recognized as exactly that concrete need (§6/§11); conversely, `NestedOverlayContextValue`'s `hasActiveNestedOverlay`/`activeNestedOverlayId` fields were initially added on a "might be useful for debugging" basis and then correctly removed once no actual Phase A consumer was found to need them (§8, Correction 5) — the registry itself stayed, only its *public exposure* was trimmed. An `onRequestClose(reason)` parameter remains explicitly **not** added, since the delete-confirm-state case it was originally proposed for turned out to need no such parameter at all once the caller-side conditional pattern was worked out correctly (§6).
- **Exact findings that would require stopping before implementation**: none were found. Repository state matches the required precondition exactly (§2); no existing overlay's current code has drifted from what the approved manual events mapping already documented (§2/§3); no structural blocker (e.g. a missing dependency, a conflicting existing `ResponsiveDialog`-named export, a broken build) was discovered. **This mapping does not recommend stopping** — Phase A is ready to implement as scoped.

---

## 23. Realistic time estimate

**~2–2.5 engineer-days** — unchanged as the headline figure from the prior pass's own upward revision (from an original ~1.5–2 day draft), and matching §1 exactly (Correction 7). This pass's own six corrections (nested-scroll-lock integration, pre-paint registration timing, the `defaultPrevented` handler contract, captured-trigger focus return, a minimized public context, and the no-unsafe-cast disabled-state check) are real, non-zero additional work, but land within this same estimate's existing contingency margin rather than pushing it further out — the breakdown below is rebalanced across phases to reflect where that work actually falls, not simply appended on top.

- **A1 (shared primitives)**: ~2–3 hours — `use-is-mobile.ts`/`focus-trap.ts` remain small, mechanical, low-risk extractions (~1 hour combined); `document-scroll-lock.ts` (§12) is the one genuinely new primitive in this step and costs more like ~1–2 hours on its own once its dedicated tests (§17, 6 cases) are included, since reference-counting/idempotent-release logic is exactly the kind of small-but-easy-to-get-subtly-wrong code that warrants careful test coverage.
- **A2 (`ResponsiveDialog` base)**: ~5.5–7.5 hours — the bulk of new surface area; portal/mount-gate/responsive branching still have a directly-provable, already-shipped reference implementation to port from, but the three-step initial-focus order with its no-unsafe-cast `:disabled`/`aria-disabled` check (§11, Correction 6), the `defaultPrevented`-aware Escape/Tab handler ordering (§11, Correction 3), the captured-trigger focus-return contract covering both close and raw unmount (§11, Correction 4), and the compile-time accessible-name union (§6/§14) are all real, if individually small, new logic rather than ports.
- **A3 (nested context) + A4 (`DatePickerPopover` integration)**: ~4–5.5 hours — the conceptually hardest part (the capture-phase Escape mechanism, §9, needed real, careful reasoning in this mapping precisely because it's easy to get subtly wrong) plus the minimized, internally-ref-backed registry (§8, Correction 5), the real-React-div-plus-callback-ref host (§7/§8), the `useId()`+`useLayoutEffect` pre-paint registration timing (§9, Correction 2), and the nested-only branch onto the shared scroll-lock utility (§12, Correction 1) — all now fully specified with no remaining open design questions.
- **A5 (tests)**: ~6.5–8.5 hours — the matrix in §17 grew to 56 cases across three files (from an earlier draft's 44 across two, itself already up from an original 32) to cover this pass's own six corrections in addition to the prior pass's; still mechanically derivable from the specification above, and the standalone-regression case (re-running the existing suite unmodified) costs nothing extra to write.
- **A6 (verification, including the Phase-A-now manual QA pass)**: ~1.5–2.5 hours — `tsc`/`eslint`/`lint`/full-suite (~30–60 minutes, all fast, automated) plus the "Phase A manual QA now" pass on the real, existing `DateField`/`DeadlineField` production surface (§18 — roughly ~1–1.5 hours for the desktop + mobile-bottom-sheet checklist, since this is a real regression pass on shipped functionality, not a throwaway-harness exercise).

This does **not** include Phase C's own manual QA pass on `ResponsiveDialog`'s actual chrome/nested-stacking/full-mobile-form flow (§18, still deliberately deferred — only the DateField/DeadlineField regression pass is pulled into Phase A itself) or any time for the eight other existing modals (explicitly untouched, §3/§5/§19).

---

## 24. Explicit confirmation

This was a documentation-only, read-only mapping pass. `docs/TEXT2TASK_WORK_CALENDAR_RESPONSIVE_DIALOG_MAPPING.md` is the only file created. No application code, test file, dependency, configuration file, API route, database file, or migration was created, modified, or deleted. No existing modal (the eight others enumerated in §3) was touched, migrated, or referenced by any proposed code change. Nothing was staged, committed, or pushed. No test suite or build was run as part of *implementing* anything (the `git`/`grep` commands run in §2 and the final checks below are read-only verification of the mapping's own preconditions and output, not an implementation step).
