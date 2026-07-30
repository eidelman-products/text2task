# Text2Task Work Calendar — Manual Events Phase C Implementation Report

## 1. Verified starting repository state

```
git branch --show-current   → main
git rev-parse --short HEAD  → cd172c8
git status --short          → (empty — clean)
git log -4 --oneline        → cd172c8 Add responsive dialog infrastructure
                               7a4de8e Add Calendar options endpoint
                               89ffbc3 Make DateField test month-boundary safe
                               3a353c1 Map Work Calendar manual events
```

Matched the expected state exactly (branch `main`, HEAD `cd172c8`, clean tree) — proceeded directly to implementation, no mapping pass performed.

---

## 2. Files created

| File | Purpose | Tests |
|---|---|---|
| `lib/calendar/parse-manual-calendar-event-id.ts` | Fail-closed `event:<uuid>` → bare UUID parser | 15 |
| `lib/calendar/mutate-calendar-event.client.ts` | Pure POST/PATCH/DELETE network boundary | 17 |
| `app/components/dashboard/calendar/calendar-event-date-field.tsx` | Thin `DateField` adapter | 7 |
| `app/components/dashboard/calendar/calendar-event-time-field.tsx` | Native `<input type="time">` ↔ `TimeOnly` adapter | 7 |
| `app/components/dashboard/calendar/calendar-event-project-field.tsx` | Native `<select>` Project picker | 8 |
| `app/components/dashboard/calendar/calendar-event-client-field.tsx` | Native `<select>` Client picker, locked/unlocked | 9 |
| `app/components/dashboard/calendar/calendar-event-form.tsx` | Field state, validation, request-body assembly, mutation calls, Delete flow | 31 |
| `app/components/dashboard/calendar/add-edit-calendar-event-dialog.tsx` | Composes `ResponsiveDialog` + `CalendarEventForm` | 14 |
| `docs/TEXT2TASK_WORK_CALENDAR_PHASE_C_IMPLEMENTATION_REPORT.md` | This report | — |

**New tests: 108**, across the 8 test files paired with the files above — not chasing an arbitrary exact count, per this task's own instruction.

## 3. File modified

| File | Change |
|---|---|
| `lib/calendar/load-calendar-range.client.ts` | One additive export, `narrowManualCalendarEventItem(value: unknown): ManualCalendarEventItem \| null` — a thin wrapper around the existing, unmodified private `narrowManualEventItem` helper, typed for a single-item POST/PATCH response body instead of a `GET` `items` array. No existing export's behavior changed; no existing test file touched (the wrapper is exercised end-to-end via `mutate-calendar-event.client.test.ts`). |

**No other application or test file was created or modified.** In particular, `WorkCalendarClient`, the Add Event button, `SelectedDayAgenda`, `CalendarAgendaItem`, `calendarDataVersionRef`, mutation reconciliation, Calendar month fetching, `page.tsx`, `CalendarToolbar`, `CalendarMonthGrid`, `CalendarCompactSelector`, every API/route handler, all Supabase repository code, all migrations, `ResponsiveDialog`, `DatePickerPopover`, `DateField`, `tokens.ts`, and every other existing modal remain byte-for-byte untouched — confirmed by `git status --short` (§8). Every new component here is production-inert until a future Phase D wires it into `WorkCalendarClient`.

---

## 4. Final component props

**`CalendarEventDateField`**: `value: DateOnly | null`, `onChange`, `disabled?`, `invalid?`, `"aria-describedby"?`. Thin, controlled `DateField` adapter (label `"Date"`); no date parsing of its own.

**`CalendarEventTimeField`**: `value: TimeOnly | null`, `onChange`, `disabled?`, `invalid?`, `"aria-describedby"?`, `id?`. Native `<input type="time">`, no `step` attribute (never emits seconds).

**`CalendarEventProjectField`**: `value: string | null`, `onChange`, `options: CalendarProjectOption[]`, `disabled?`, `invalid?`, `"aria-describedby"?`, `id?`. Native `<select>`; `"No project"` default option; archived options rendered `"{title} (Archived)"`; no network knowledge.

**`CalendarEventClientField`**: `value`, `onChange`, `options: CalendarClientOption[]`, `locked: boolean`, `lockedClientName: string | null`, `disabled?`, `invalid?`, `"aria-describedby"?`, `id?`. When `locked`, renders one disabled option showing `lockedClientName ?? "No client"`, ignoring `value`/`options` for rendering; otherwise a normal independently-editable select.

**`CalendarEventForm`**: `(CalendarEventFormMode)` — `{mode: "create", defaultDate}` or `{mode: "edit", event}` — plus `headingId`, `titleInputRef?`, `onSaved`, `onDeleted`, `onClose`, `projectOptions`, `clientOptions`, `projectsTruncated`, `clientsTruncated`, `optionsLoading`, `optionsError`, `onRetryOptions`, `busy`, `onBusyChange`, `deleteConfirmPending`, `onDeleteConfirmPendingChange`. `busy`/`deleteConfirmPending` are **fully controlled** — this component never owns either.

**`AddEditCalendarEventDialog`**: `(CalendarEventFormMode)` plus `open`, `triggerRef`, `onClose`, `onSaved`, `onDeleted`, `projectOptions`, `clientOptions`, `projectsTruncated`, `clientsTruncated`, `optionsLoading`, `optionsError`, `onRetryOptions`. Owns `busy`/`deleteConfirmPending` state and the Title-input ref; composes exactly `ResponsiveDialog > CalendarEventForm`.

---

## 5. Request-body assembly

**Create** always sends exactly `{title, eventDate, eventTime, notes, projectId, clientId}` — never `date`/`time`. Blank Notes → `null`; empty Time → `null`.

**Edit** sends only genuinely-dirty keys, computed by independent per-field comparison against values captured once at mount:
- `title`: included only if `title.trim() !== initialTitle`.
- `eventDate`: included only if the current date differs from initial (never sent as `date`).
- `eventTime`: included (possibly `null`) only if it differs from initial.
- `notes`: included (possibly `null`, via the same trim/blank→null normalization) only if it differs from initial.
- **If the assembled patch has zero keys** (nothing anywhere genuinely changed), **no request is sent at all** — `onClose()` is called directly. This is required, not optional: `UpdateCalendarEventInputSchema`'s own `.refine(Object.keys(value).length > 0)` would reject a truly empty PATCH server-side, and inventing a fake field to avoid that was explicitly disallowed.

---

## 6. Project/Client relationship — four scenarios

Implemented via `deriveRelationshipPatch(initial, current)` using exactly two independent value-comparison flags, `projectChanged`/`clientChanged` — never a combined flag, never falsy coercion:

1. **Create, project selected**: Client immediately previews that option's `clientName` and locks (`CalendarProjectOption.clientId`/`clientName`, no round-trip).
2. **Edit, `projectChanged === false`** (including clear-then-reselect-the-original): PATCH omits both `projectId` and `clientId` entirely.
3. **Edit, `projectChanged === true`, new value non-null**: Client re-locks to the newly-selected project's own client; PATCH includes `projectId` only, never a client-derived `clientId`.
4. **Edit, `projectChanged === true`, new value `null`** (project cleared): Client unlocks and **retains** its current value (never resets to empty); PATCH includes `projectId: null`, plus `clientId` only if `clientChanged === true`.

Selecting a project always resets the effective client state to that project's own current client (`handleProjectIdChange`), discarding any client value chosen while Client was briefly unlocked — this is what makes case 9 below correct with zero special-casing. Reselecting the currently-selected project is an explicit no-op guard, independent of whether the native `<select>` would have fired `onChange` at all.

All nine required relationship tests pass (`calendar-event-form.test.tsx`, `"Project/Client relationship rules"`), including: create auto-lock; clear-unlocks-and-retains; untouched-edit omits both keys; genuinely-different-project sends `projectId` only; same-project reselect is a no-op; clear-then-reselect-original omits both; clear-project-untouched-client sends `projectId: null` only; clear-project-then-change-client sends both keys; clear/change-client/select-different-project sends `projectId` only (the intervening client change is discarded).

---

## 7. Explicit-null vs. omitted-key behavior

Verified directly via inspected `fetch` call bodies (never inferred from rendered UI alone): a cleared Time sends `eventTime: null` (present, not omitted); cleared Notes sends `notes: null`; an unchanged Title/Date/Time/Notes field is each independently absent from the patch; a changed Date is sent as `eventDate` (never `date`); a changed Title is sent as `title`. No `value || fallback`/`value ?? fallback` collapse is used anywhere in the diff logic.

---

## 8. Manual Event id parser

`parseManualCalendarEventId(itemId: string): string | null` — a single anchored regex, `^event:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, requiring the exact lowercase `event:` prefix and a syntactically valid, lowercase-hex UUID with no leading/trailing/interior whitespace and no extra prefix/suffix content. Returns `null` (never throws) for every fail-closed case in the required list, including a runtime type guard (`typeof itemId !== "string"`) for defense against a caller that violates the TypeScript signature at runtime. It is the **only** place in the new code that derives a bare UUID from an item id — no `.replace`/`.slice` string manipulation exists anywhere else.

---

## 9. Mutation-client contract

`lib/calendar/mutate-calendar-event.client.ts` owns exactly: route construction (`POST /api/calendar/events`, `PATCH`/`DELETE /api/calendar/events/[uuid]`), `parseManualCalendarEventId`-based UUID resolution for PATCH/DELETE (fails closed **before** `fetch` is ever called), the `fetch` calls themselves, JSON/HTTP failure handling, and response-shape validation via the additive `narrowManualCalendarEventItem` export. It has no React imports, no refs, no knowledge of Calendar ranges/state/`calendarDataVersionRef`, and no Supabase imports (confirmed by direct reading of the file — its only imports are `calendar-types`, `load-calendar-range.client`, and `parse-manual-calendar-event-id`).

Error messages: below HTTP 500, the server's own `{error}` string is surfaced as-is (these are already deliberately user-facing per the existing route handlers, e.g. `"Linked project not found."`). At 500+, a single fixed generic message is used regardless of the response body, since the existing route handlers' own 500 fallback can leak a raw exception message (`error instanceof Error ? error.message : ...`) that must never reach the user. Both `{success: true, alreadyDeleted: false}` and `{success: true, alreadyDeleted: true}` are treated as equally successful delete results.

---

## 10. Delete-confirm ownership

`AddEditCalendarEventDialog` owns `deleteConfirmPending` (plain `useState`, no imperative ref) so its own `ResponsiveDialog.onRequestClose` handler can see it: when `true`, Escape/backdrop dismissal steps back to the unconfirmed state instead of closing; otherwise it calls `onClose()`. `CalendarEventForm` renders and drives the Delete UI entirely through this controlled prop and its paired change-callback — it never reaches into `ResponsiveDialog` directly and never opens a second overlay. `busy` follows the identical controlled-prop pattern (owned by the dialog, driven by the form via `onBusyChange`) so `ResponsiveDialog`'s own `busy` prop always reflects real in-flight create/update/delete state, never the synchronous confirm step.

---

## 11. ResponsiveDialog / DatePicker integration

`AddEditCalendarEventDialog` passes the Title `<input>`'s ref as `ResponsiveDialog`'s `initialFocusRef`, and `aria-labelledby` pointing at `CalendarEventForm`'s own `<h2 id={headingId}>` heading (`"Add event"` / `"Edit event"`). `CalendarEventDateField` requires zero new wiring for nesting — `DatePickerPopover` (via `DateField`) already consumes `ResponsiveDialog`'s `NestedOverlayContext` automatically whenever rendered inside one (Phase A). Verified directly: the popover portals into the nested-overlay host (not a descendant of the dialog panel); one Escape closes only the popover; a second Escape then closes the dialog; focus returns to the Date trigger after the popover closes.

---

## 12. Accessibility

Visible `"Add event"`/`"Edit event"` heading, wired via `aria-labelledby`; Title receives initial focus on open; every field has a real `<label>`; inline errors carry `aria-describedby` (and, where the underlying control supports it, `aria-invalid`) — see the one documented, unavoidable exception below; mutation errors and field errors both render inside `role="alert"` regions; Delete confirmation changes the control's own accessible text (`"Delete"` → `"Confirm delete"` / `"Cancel delete"`), not merely its visual style; no nested interactive controls; native `<select>`s throughout (no custom combobox); every Project/Client/Save/Delete/Cancel control is at least 44px tall; no animation.

**One documented limitation**: `DateField` (Phase A/pre-existing, not modifiable in this phase) accepts `aria-describedby` but not `aria-invalid` on its internal trigger button, and `aria-invalid` is not a valid attribute on `role="group"` either (confirmed by a real `jsx-a11y/role-supports-aria-props` lint failure when first attempted). `CalendarEventDateField` therefore forwards `aria-describedby` (a real, working association) and exposes `invalid` only as a plain `data-invalid` attribute for optional caller-side styling — it does not claim `aria-invalid` support it cannot actually provide without modifying `DateField`.

---

## 13. Test results

```
Targeted (8 new/changed test files): 108 passed / 108
npx vitest run (full suite):          927 passed / 927   (baseline before this phase: 819; net +108)
```

Regression suites re-run and passing, unmodified: `responsive-dialog.test.tsx`, `date-picker-popover-nested.test.tsx` (both part of the full run above, confirming Phase C introduced no regression against Phase A's nested-overlay contract), `date-field.test.tsx` (18/18), the Calendar options route tests, and every other existing calendar API/route/schema test.

---

## 14. TypeScript / ESLint / lint results

```
npx tsc --noEmit                                              → clean, no output
npx eslint <every new file + load-calendar-range.client.ts>   → clean, no output
  (one intermediate react-hooks/set-state-in-effect error and one
  jsx-a11y/role-supports-aria-props warning were found and fixed during
  this pass -- see §12 above and the render-time state-adjustment note
  below; final state is clean, no suppression comment used anywhere)
npm run lint (full project)                                    → clean, no output
```

`AddEditCalendarEventDialog`'s defensive busy/`deleteConfirmPending` reset-on-reopen uses React's own documented render-time state-adjustment pattern (`if (open !== wasOpen) { setWasOpen(open); ...}` during render, not inside `useEffect`) specifically to avoid the `react-hooks/set-state-in-effect` rule — not a suppression, a different, equally correct implementation.

---

## 15. Remaining Phase D work (not touched by this phase)

Per the manual events mapping's own §26 phased plan: wiring `calendarDataVersionRef` into `WorkCalendarClient`'s GET path and every mutation path; the standalone Add Event trigger; the explicit Edit control on `ManualEventRow`; mutation reconciliation (splice-or-refetch) into live Calendar state; and the options-loading hook/cache that actually calls `GET /api/calendar/options` and feeds `projectOptions`/`clientOptions`/`optionsLoading`/`optionsError` into `AddEditCalendarEventDialog`. None of this phase's new components import or reference any of that — they remain fully production-inert until Phase D wires them in.

---

## 16. Exact final git status

```
$ git status --short
 M lib/calendar/load-calendar-range.client.ts
?? app/components/dashboard/calendar/add-edit-calendar-event-dialog.test.tsx
?? app/components/dashboard/calendar/add-edit-calendar-event-dialog.tsx
?? app/components/dashboard/calendar/calendar-event-client-field.test.tsx
?? app/components/dashboard/calendar/calendar-event-client-field.tsx
?? app/components/dashboard/calendar/calendar-event-date-field.test.tsx
?? app/components/dashboard/calendar/calendar-event-date-field.tsx
?? app/components/dashboard/calendar/calendar-event-form.test.tsx
?? app/components/dashboard/calendar/calendar-event-form.tsx
?? app/components/dashboard/calendar/calendar-event-project-field.test.tsx
?? app/components/dashboard/calendar/calendar-event-project-field.tsx
?? app/components/dashboard/calendar/calendar-event-time-field.test.tsx
?? app/components/dashboard/calendar/calendar-event-time-field.tsx
?? lib/calendar/mutate-calendar-event.client.test.ts
?? lib/calendar/mutate-calendar-event.client.ts
?? lib/calendar/parse-manual-calendar-event-id.test.ts
?? lib/calendar/parse-manual-calendar-event-id.ts

$ git diff --stat
 lib/calendar/load-calendar-range.client.ts | 22 +++++++++++++++++++++-
 1 file changed, 21 insertions(+), 1 deletion(-)

$ git diff --check
warning: in the working copy of 'lib/calendar/load-calendar-range.client.ts',
LF will be replaced by CRLF the next time Git touches it   (benign; not a
whitespace-error or conflict-marker finding)
```

Matches the exact locked file plan precisely — nothing else was created, modified, or deleted.

---

## 17. Confirmation

No `npm run build` was run. Nothing was committed. Nothing was pushed. Build, manual QA, commit, push, and deployment verification remain the user's own steps.
