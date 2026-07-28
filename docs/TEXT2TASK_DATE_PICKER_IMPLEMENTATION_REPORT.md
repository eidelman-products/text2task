# Text2Task — Deadline Date Picker: Implementation Report

Status: **Implemented across all four dependency-aware tracks (three converted, one correctly found to need no conversion). Not committed. Not pushed.**
Primary evidence source: `docs/TEXT2TASK_DATE_PICKER_MAPPING.md` (preserved unchanged throughout this work).

---

## 1. Exact implementation verdict

All locked engineering decisions were implemented. The three genuinely-editable free-text deadline surfaces identified in the mapping report (Main Task CRM, Extract Review, Project Updates Review) were converted to a single shared, reusable, persistence-agnostic `DeadlineField`/`DateField` component built on `@daypicker/react` + `@floating-ui/react`. The two confirmed, live timezone bugs (`lib/tasks/parse-deadline.ts`'s `.toISOString()` day-shift, and the equivalent bug in the AI Judge's deadline comparison) were fixed at the root, plus one additional bug discovered and fixed during integration (`lib/tasks/get-deadline-ui.ts`'s `new Date(dateOnlyString)`) and two more discovered and fixed during Extract Review integration (subtask deadlines silently ignoring the picker; "Clear" not actually clearing due to a `??`/`null` handling gap in the import RPC's payload builder).

**One deviation from the plan, with full justification:** the fourth surface named in the task (Homepage Demo Review) turned out to have **no editable deadline field at all** in the current codebase — the mapping report's finding here was stale (the flow was simplified to read-only in a later commit, `b255679`). No conversion was made or fabricated; see §4 and §15 for full detail.

---

## 2. Dependency changes

`package.json`:
```diff
 dependencies:
+  "@daypicker/react": "^10.0.1"
+  "@floating-ui/react": "^0.27.20"

 devDependencies:
+  "@testing-library/jest-dom": "^7.0.0"
+  "@testing-library/react": "^16.3.2"
+  "@testing-library/user-event": "^14.6.1"
+  "jsdom": "^29.1.1"
```
`package-lock.json` updated accordingly (916 lines added, transitive tree resolved).

**`date-fns` was confirmed NOT added as a direct dependency**, per the locked constraint. Verified three ways: (1) `package.json` diff contains no `date-fns` entry; (2) `npm ls date-fns` shows it only three levels deep as a transitive dependency of `@daypicker/react → react-day-picker@10.0.1 → date-fns@4.4.0`; (3) `grep` across every `.ts`/`.tsx` file in `app/`/`lib/` for `from "date-fns"` returns zero matches — no application code imports it, directly or otherwise.

---

## 3. Timezone root-cause fixes (all confirmed, verified independently at final integration)

| File | Bug | Fix |
|---|---|---|
| `lib/tasks/parse-deadline.ts` | All 25 return sites in `parseDeadlineCore` did `<Date>.toISOString()` on a local-time-constructed `Date`, shifting the calendar day for UTC+13/+14 timezones. `ParseDeadlineResult.deadlineDate` was a full ISO datetime string. | Every site now returns `localDateToDateOnly(<Date>)` (reads local getters, never UTC). `ParseDeadlineResult.deadlineDate` is now `DateOnly \| null`, exported. Natural-language resolution logic itself is unchanged — only the serialization of the resolved date changed. |
| `lib/tasks/format-deadline.ts` | `tryParseIsoLike` did `new Date(value)` on whatever it received, including bare `YYYY-MM-DD` strings — parsed as UTC midnight, then read via local getters, shifting the day for any timezone west of UTC. | Now tries `parseDateOnly(value)` first (safe path via `dateOnlyToLocalDate`); falls back to `new Date(value)` only for genuinely non-date-only input (e.g. a full ISO datetime with an explicit time/zone, which is legitimately safe to parse that way). `MM/DD/YY` output format and all existing slash-date/natural-language fallback chains unchanged (out of scope per the locked decisions — only the timezone bug was fixed, not the display-format policy). |
| `lib/project-updates/v2/project-update-judge.server.ts` | `normalizeDeadlineDateKey`'s fallback branch did `new Date(raw).toISOString().slice(0, 10)` — the exact forbidden pattern — to build an AI-Judge deadline-comparison key. | Now tries `parseDateOnly(raw)` first (already-canonical case), then `parseDeadline(raw).deadlineDate` (natural-language fallback, now itself safe per the fix above), else `""`. Nothing else in this large file was touched. |
| `lib/tasks/get-deadline-ui.ts` | `tryParseDate` did `new Date(value)` on `resolvedDeadlineDate` (always a bare date-only string, either from the DB `deadline_date` column or from `parseDeadline`'s result) — same UTC-midnight-then-local-getters shift, affecting every urgency/tone badge (overdue/due-today/due-tomorrow/due-soon) across the dashboard. Discovered by Track A during its consumer audit (out of its ownership), fixed by the lead at the Wave 1 integration barrier, before any Wave 2 track began building on top of it. | `tryParseDate` now routes through `parseDateOnly` + `dateOnlyToLocalDate` exclusively — no `new Date(string)` call remains in this file for a date value. Added `lib/tasks/get-deadline-ui.test.ts` (7 new tests: due-today/overdue/due-tomorrow classification, malformed-input fail-safe, text-derived deadline resolution, missing-deadline handling, Done-task override). |
| `app/components/dashboard/extract-workspace.tsx` (subtask save path) | Discovered by Track D during Extract Review integration: `import-persistence.server.ts` (server file, not owned by any track) always re-derives each **subtask's own** `deadline_date` by re-parsing that subtask's `deadline_text` — it never trusts a client-supplied subtask-level `deadline_date` the way it does for the project-level payload. A picker commit deliberately leaves `deadline_original_text` untouched (AI provenance preservation), so subtasks would silently keep sending stale extracted text and get a persisted date that diverges from what the user just picked. | Added `buildSaveSubtaskDeadlineText`, which prefers the canonical per-subtask `deadline_date` (with `""` as an explicit-clear sentinel, distinct from `null`/"never resolved") when building the save payload — without ever mutating `deadline`/`deadline_original_text` in component state. |
| `app/components/dashboard/extract-workspace.tsx` (clear-project-deadline path) | Discovered by Track D: `import-persistence.server.ts` computes `deadline_date: suppliedDeadlineDate ?? <re-parsed from deadline_text>`. Since `??` only triggers on `null`/`undefined`, sending an explicit `null` while `deadline_text` still held old raw text would silently resurrect a date instead of clearing it. | Added a `deadlineExplicitlyCleared` check that also empties the project-level `deadline_text` in the save payload when every item's `deadline_date` was explicitly cleared, so the server's own re-derivation has nothing to resurrect from. |

**No other unsafe pattern was found or introduced anywhere in the mapped deadline paths** — see §7 for the full sweep methodology and results.

---

## 4. Deviation: Homepage Demo Review had no editable deadline field to convert

Per the mapping report §3.1 finding #4, `app/homepage-demo/review/HomepageDemoReviewPanel.tsx` was believed to contain "a free-text input, own local draft/format logic" deadline editor. Track F traced the actual current code (this file, its only caller `HomepageDemoReviewClient.tsx`, and the downstream claim/save flow) and found:

- The panel is **read-only** today — `formatDeadline(draft.deadlineText, draft.deadlineDate)` renders static text via `ProjectPreviewMetricText`; there is no `onChange`/setter/draft-mutation path anywhere in the file.
- The claim step (`HomepageDemoClaimContinuationClient.tsx`) POSTs an empty body to `/api/homepage-demo/claim/save`; **no field values are ever sent from the client** — the server re-derives the saved project entirely from its own stored draft.
- This matches a later product simplification (commit `b255679`, "match public review inner design") that the mapping report's investigation session predated or missed.

Building an editable deadline picker into this flow would require adding a new mechanism for the anonymous, pre-signup claim/save request to accept and persist client-supplied field values — a security-relevant architecture change (currently, an anonymous actor cannot inject arbitrary values into the save path at all) explicitly outside this track's ownership and outside the scope of a UI component swap. Per the non-negotiable rule against weakening claim validation/save authority, **no change was made to this surface.** This is flagged as Open Item 1 in §15 for product/security follow-up if a homepage-demo picker is genuinely wanted.

Zero files were modified in `app/homepage-demo/**`. Verification (`tsc`, `vitest`, `eslint`) was run against the unmodified files to confirm no baseline regressions from the other three parallel tracks.

---

## 5. Files created

**Date-only foundation:**
- `lib/tasks/date-only.ts` — the `DateOnly` branded/opaque type and its factory functions.
- `lib/tasks/date-only.test.ts`

**Shared UI:**
- `app/components/dashboard/ui/calendar/calendar.tsx`
- `app/components/dashboard/ui/calendar/date-field.tsx`
- `app/components/dashboard/ui/calendar/date-field.test.tsx`
- `app/components/dashboard/ui/calendar/date-picker-popover.tsx`
- `app/components/dashboard/tasks/deadline-field.tsx`
- `app/components/dashboard/tasks/deadline-field.test.tsx`

**Test infra:**
- `vitest.setup.ts`

**New/dedicated test files for existing logic:**
- `lib/tasks/parse-deadline.test.ts`
- `lib/tasks/format-deadline.test.ts`
- `lib/tasks/get-deadline-ui.test.ts`
- `lib/project-updates/v2/project-update-judge-deadline.server.test.ts`

**Integration tests for converted surfaces:**
- `app/components/dashboard/tasks/project-meta-editor.test.tsx`
- `app/components/dashboard/extract/ai-project-review-panel.test.tsx`
- `app/components/dashboard/tasks/project-updates/project-update-review-card.test.tsx`
- Additions to `app/components/dashboard/extract-workspace.test.ts`

No `month-year-select.tsx` was built as a separate file — `@daypicker/react` v10's own `captionLayout="dropdown"` already provides real native month/year `<select>` jump-navigation, satisfying "efficient month/year selection, including dates far in the future or past" without a bespoke component (documented deviation from the mapping report's tentative file list, made because the installed package's real API already covers this need).

---

## 6. Files modified

- `lib/tasks/parse-deadline.ts` — return-value serialization fix (§3), natural-language resolution logic unchanged.
- `lib/tasks/format-deadline.ts` — `tryParseIsoLike` timezone fix (§3).
- `lib/tasks/get-deadline-ui.ts` — `tryParseDate` timezone fix (§3).
- `lib/project-updates/v2/project-update-judge.server.ts` — `normalizeDeadlineDateKey` fix (§3), nothing else in the file touched.
- `app/components/dashboard/tasks/project-meta-editor.tsx` — deadline field converted to `DeadlineField`; the unsafe `formatDeadlineDisplay` function removed entirely (dead code once nothing calls it); Amount field, Priority/Status selects untouched.
- `app/components/dashboard/extract/ai-project-review-panel.tsx` — deadline field converted to `DeadlineField`, committing through the `"deadline_date"` field name (confirmed already safely handled by `updatePreviewItem`'s existing generic fallback — zero changes needed there). Budget/Priority/Client/Contact fields untouched.
- `app/components/dashboard/extract-workspace.tsx` — the two subtask/clear bugs from §3 fixed in the save-payload builder; `updatePreviewItem` itself needed no changes (confirmed by direct investigation, not assumed).
- `app/components/dashboard/tasks/project-updates/project-update-review-card.tsx` — deadline_change item's "Suggested deadline" editor converted to `DeadlineField`; "Current deadline" read-only display updated to prefer canonical formatting while still falling back to raw provenance text when it doesn't resolve to a real date. No other item type touched.
- `vitest.config.ts` — `include` extended to `**/*.test.tsx`; `setupFiles: ["./vitest.setup.ts"]` added; `environment: "node"` kept as the default (unchanged).
- `package.json` / `package-lock.json` — §2.

---

## 7. Unsafe-pattern sweep (final lead integration)

Every changed/new non-test file was grepped for `new Date(`, `toISOString()`, `Date.parse(`, `type="date"`, `eslint-disable`, `@ts-ignore`, `as any`, and duplicated deadline-editor patterns, and every match was individually inspected (not just counted):

- **Every remaining `new Date(...)` call site** either (a) takes numeric year/month/day arguments (the one permitted pattern), (b) clones an existing `Date` via `.getTime()`, (c) takes no arguments (current instant), or (d) is explicitly guarded to only receive a string that is already confirmed NOT to be a bare date-only value (the `isoDateTimePattern`-gated branch in `parse-deadline.ts`, and the `parseDateOnly`-first-then-fallback branch in `format-deadline.ts`). No unguarded `new Date(dateOnlyString)` remains anywhere in the mapped deadline paths.
- **Zero** `eslint-disable`, `@ts-ignore`, or `as any` casts across every file touched by this implementation (one comment in `vitest.setup.ts` explicitly documents that such a cast was *not* needed — that's the only match the grep produced, and it's inside a comment confirming compliance, not a violation).
- **Zero** `type="date"` anywhere new.
- **One shared editable-deadline implementation confirmed**: `DeadlineField` is now the only component rendering an editable deadline across the three real surfaces (`project-meta-editor.tsx`, `ai-project-review-panel.tsx`, `project-update-review-card.tsx`); the old `variant="deadline"` free-text pattern and its `"May 15, 2026"` placeholder no longer exist anywhere in the codebase.
- **No new subtask deadline UI**: confirmed `mobile-task-card.tsx` and `desktop-tasks-table.tsx` (the subtask-row files) were not touched by any track.
- **CSV/clipboard unchanged**: confirmed `dashboard-client.tsx` (CSV export) and `dashboard-helpers.ts` (clipboard copy text) were not touched by any track.

I did not remove or alter any unrelated, legitimate timestamp usage elsewhere in the repository (e.g. `created_at`/`updated_at`/`completed_at` handling in `dashboard-client.tsx`, `analytics/*`, `homepage-demo/*` outside the deadline field) — every match outside the deadline-specific files was inspected and left untouched, consistent with the instruction to limit changes strictly to the deadline/date-only scope.

---

## 8. Behavior implemented — Desktop

- Compact popover anchored to the field trigger via `@floating-ui/react`'s `useFloating` + `autoUpdate` + `flip`/`shift` middleware — collision-aware positioning that re-anchors continuously on scroll/resize (chosen over force-closing on resize, per the mapping report framing "closing is simpler, not mandatory").
- Clearly distinct visual states for selected date, today, hover, and keyboard focus (via `@daypicker/react`'s day-cell states, styled with the existing `dashboardColors`/`dashboardRadii` tokens).
- Month navigation plus `captionLayout="dropdown"` native `<select>`-based month/year jump for efficient far-future/far-past navigation.
- Today and Clear actions in the popover footer, styled via the existing `DashboardButton` component.
- Closes immediately after a valid day/Today/Clear selection.
- Escape and click-outside cancel without committing (verified by dedicated tests asserting the commit callback is never called on these paths).
- Focus returns to the triggering element on every close path (built explicitly via a trigger ref, since no existing modal in this codebase did this before).

## 9. Behavior implemented — Mobile

- One responsive component (`DatePickerPopover`) switches presentation strategy at `dashboardBreakpoints.mobile` (900px) rather than maintaining a second calendar implementation: below that width it renders as an accessible bottom sheet (same `Calendar` inside, same `createPortal`/`useHasMounted` machinery, different positioning/chrome).
- Scroll locking while the sheet is open.
- Minimum 44×44px day-cell touch targets on the sheet presentation.
- The trigger is a real `<button>`, not a text `<input>`, so no virtual keyboard opens for a picker-only field — a strict improvement over the old free-text field's mobile behavior.
- Focus restoration on close, same mechanism as desktop.

## 10. Tests added (summary — see §5 for the file list)

Approximately 100+ new test cases across pure-logic (`.test.ts`, Vitest `node` environment — unchanged default) and component-level (`.test.tsx`, jsdom via a per-file `// @vitest-environment jsdom` docblock, `@testing-library/react` + `user-event` + `jest-dom`) tests, covering: `DateOnly` validation (leap years, invalid calendar dates, round-trip stability), `parseDeadline`'s full natural-language grammar re-verified against the new `DateOnly` return shape, `format-deadline`'s timezone-safe date-only path, `get-deadline-ui`'s urgency classification, the AI Judge's deadline-comparison normalization, and — for every converted surface — opening the picker, correct initial display, day selection/commit, month navigation, year jump, Today, Clear, Escape-without-commit, click-outside-without-commit, focus return, disabled/loading states, full keyboard-only selection, accessible labels, exactly-once commit assertions, and AI-provenance-text preservation across a picker commit.

---

## 11. Exact test/typecheck/lint results (run by the lead, at final integration, on the fully-merged tree — not just individual track self-reports)

**`npx vitest run`:**
```
Test Files  28 passed (28)
     Tests  332 passed (332)
```

**`npx tsc --noEmit`:** clean, zero errors, whole repository.

**`npx eslint` on every changed/new file** (all 26 files across all tracks, listed explicitly): clean, zero errors, zero warnings, zero suppressions.

**`npm run lint`** (full repository): 0 problems, 0 errors, 0 warnings, exit code 0.

**`git diff --check`:** exit 0 (only harmless CRLF line-ending conversion warnings on Windows, no real whitespace errors).

**`git diff --stat`:**
```
 app/components/dashboard/extract-workspace.test.ts | 138 ++++
 app/components/dashboard/extract-workspace.tsx     |  77 +-
 .../dashboard/extract/ai-project-review-panel.tsx  |  37 +-
 .../dashboard/tasks/project-meta-editor.tsx        |  53 +-
 .../project-updates/project-update-review-card.tsx |  53 +-
 .../v2/project-update-judge.server.ts              |  26 +-
 lib/tasks/format-deadline.ts                       |  15 +
 lib/tasks/get-deadline-ui.ts                       |  16 +-
 lib/tasks/parse-deadline.ts                        |  56 +-
 package-lock.json                                  | 916 +++++++++++++++++++++
 package.json                                       |   6 +
 vitest.config.ts                                   |   9 +-
 12 files changed, 1299 insertions(+), 103 deletions(-)
```
(This `--stat` covers modified tracked files only; new untracked files are listed in §5 and in `git status --short` below.)

**`git status --short`:**
```
 M app/components/dashboard/extract-workspace.test.ts
 M app/components/dashboard/extract-workspace.tsx
 M app/components/dashboard/extract/ai-project-review-panel.tsx
 M app/components/dashboard/tasks/project-meta-editor.tsx
 M app/components/dashboard/tasks/project-updates/project-update-review-card.tsx
 M lib/project-updates/v2/project-update-judge.server.ts
 M lib/tasks/format-deadline.ts
 M lib/tasks/get-deadline-ui.ts
 M lib/tasks/parse-deadline.ts
 M package-lock.json
 M package.json
 M vitest.config.ts
?? app/components/dashboard/extract/ai-project-review-panel.test.tsx
?? app/components/dashboard/tasks/deadline-field.test.tsx
?? app/components/dashboard/tasks/deadline-field.tsx
?? app/components/dashboard/tasks/project-meta-editor.test.tsx
?? app/components/dashboard/tasks/project-updates/project-update-review-card.test.tsx
?? app/components/dashboard/ui/calendar/
?? docs/
?? lib/project-updates/v2/project-update-judge-deadline.server.test.ts
?? lib/tasks/date-only.test.ts
?? lib/tasks/date-only.ts
?? lib/tasks/format-deadline.test.ts
?? lib/tasks/get-deadline-ui.test.ts
?? lib/tasks/parse-deadline.test.ts
?? vitest.setup.ts
```
`docs/` contains exactly two files: the original, unmodified `TEXT2TASK_DATE_PICKER_MAPPING.md` and this new report.

Full repository `npm run lint` reported **zero** unrelated pre-existing debt of any kind (the repository was already at a clean 0/0/0 lint baseline before this work began, per the prior session's completed cleanup) — there was nothing to separate out or avoid fixing.

`npm run build` was **not** run, per the explicit instruction that the user runs the final production build.

---

## 12. Unresolved issues

1. **Homepage Demo Review has no editable deadline to convert** (§4) — not a defect in this implementation, but a genuine gap between the original task's four-surface premise and current reality. Needs a product decision, not more engineering, if a picker is wanted there (§15, Open Item 1).
2. ~~`DeadlineField`'s internal label is hardcoded to `"Deadline"`~~ — **Resolved.** See §12a.
3. No End-to-End (Playwright/Cypress) tests were added — none existed before, and adding a framework was outside this task's locked scope (the mapping report listed this as an open product question; it remains open).
4. Manual browser/screen-reader QA (the checklist in the mapping report §12) has not been performed as part of this implementation session — only automated tests and static verification were run. This should be done before the user's own production build/deploy.

---

## 12a. Follow-up: `DeadlineField` label configurability (resolved)

`DeadlineFieldProps` now includes an optional `label?: string`, defaulting to `"Deadline"`. It is passed straight through to the underlying `DateField`'s (already-required) `label` prop, which drives both the visible `<label>` element and the popover's `aria-label` (`` `Choose ${label.toLowerCase()} date` ``) — so a custom label is correctly exposed to assistive technology on both the trigger and the dialog, not just visually.

`app/components/dashboard/tasks/project-updates/project-update-review-card.tsx` now passes `label="Suggested deadline"` to its `DeadlineField`, so it reads correctly next to the adjacent "Current deadline" read-only comparison. Main Task CRM (`project-meta-editor.tsx`) and Extract Review (`ai-project-review-panel.tsx`) were left on the default `"Deadline"` — neither has product copy requiring a different label.

Confirmed no duplicated outer label was introduced: none of the three integration sites wrap `DeadlineField` in an additional `<label>`/heading repeating the field's own name (verified by direct inspection at integration time, and by a dedicated test asserting exactly one visible occurrence of the label text per rendered field).

**Files changed in this follow-up:**
- `app/components/dashboard/tasks/deadline-field.tsx` — added `label?: string` (default `"Deadline"`) to `DeadlineFieldProps`, threaded through to `DateField`.
- `app/components/dashboard/tasks/deadline-field.test.tsx` — 5 new tests: default label, custom label rendering, custom label exposed to assistive technology on both trigger and popover dialog, no duplicated outer label, commit behavior unchanged with a custom label.
- `app/components/dashboard/tasks/project-updates/project-update-review-card.tsx` — now passes `label="Suggested deadline"`.
- `app/components/dashboard/tasks/project-updates/project-update-review-card.test.tsx` — updated every existing assertion that queried the field by its old default accessible name (`"Deadline"`) to the new one (`"Suggested deadline"`), and added a dedicated test confirming the custom label renders (and the default does not) with no duplication.

**Verification (this follow-up only):**
- `npx vitest run` → 28 test files, **338 tests passed** (332 baseline + 6 new: 5 in `deadline-field.test.tsx`, 1 in `project-update-review-card.test.tsx`).
- `npx tsc --noEmit` → clean.
- `npx eslint` on the 4 files listed above → clean, zero suppressions.
- `npm run lint` (full repo) → 0 problems, 0 errors, 0 warnings, exit 0.
- `git diff --check` → exit 0 (only pre-existing CRLF warnings).

No dependency was added. No new component was created (`label` is a prop on the existing `DeadlineField`, not a new component). No suppression or unsafe cast was used.

---

## 13. Explicit confirmation

- **Nothing was committed.** `git status --short` above shows only working-tree modifications and untracked new files — no commits were created during this session.
- **Nothing was pushed.**
- **No git branch was created or switched** — all work occurred on the pre-existing `main` working tree.
- **No database migration was run or required.**
- **No production data was modified.**
- **`npm run build` was not run.**
- **`docs/TEXT2TASK_DATE_PICKER_MAPPING.md` was not modified** — confirmed byte-for-byte unchanged (it is the only other file in `docs/`, and no track had ownership of it).

---

## 14. Open items requiring product/engineering follow-up (not blocking, not part of this task's scope)

1. **Homepage Demo Review deadline editing** (§4, §12.1) — if wanted, requires a hardened claim/save payload contract change (server-side), reviewed separately for the security implications of accepting client-supplied values on an anonymous, pre-signup endpoint.
2. ~~`DeadlineField` label configurability~~ — resolved, see §12a.
3. The mapping report's remaining open questions (dependency choice — now resolved by the lock; CSV/clipboard format policy — explicitly out of scope for this task and left unchanged; internationalization; E2E framework adoption) are unchanged and still open, as they were explicitly not part of this implementation's locked scope.

---

## 15. Assumptions made during implementation

- The Postgres/server timezone assumptions documented in the mapping report (§16 there) still apply unchanged; this implementation does not touch any database or server-runtime configuration.
- `@daypicker/react`'s real v10 API (inspected directly from the installed package by Track B, not assumed from memory of older `react-day-picker` versions) was treated as authoritative over any prior assumption in the mapping report about needing a bespoke month/year selector.
- Where a Wave 2 track's investigation contradicted a specific line-level claim in the mapping report (e.g. Homepage Demo Review's actual current editability), the live code was treated as authoritative and the discrepancy was reported precisely rather than silently reconciled.
