# Text2Task — Deadline Date Picker: Production Implementation Map

Status: **Mapping only. No application code was modified.**
Date of mapping: 2026-07-28
Scope: Replace free-text editable deadline fields with a modern, reusable calendar date picker, without introducing timezone bugs, duplicated implementations, or regressions to existing save/loading/error behavior.

---

## 1. Executive verdict

Text2Task's deadline UX is currently a **free-text input** (`type="text"`, natural-language, e.g. "May 15, 2026") in **four independent, duplicated implementations**, each parsed server-side by a shared but **untested and timezone-unsafe** natural-language parser (`lib/tasks/parse-deadline.ts`). There is no native `<input type="date">` anywhere in the codebase today, and no calendar/date-picker UI library is installed.

The correct long-term architecture is:

1. A new **`DateOnly`** value contract (`string` in strict `YYYY-MM-DD` form, or `null`) formalized once, with pure, tested utilities for parsing/formatting/validating it — **never** routed through `Date.toISOString()`, `new Date("YYYY-MM-DD")`, or any timezone-sensitive conversion.
2. A new, headless, dependency-free **`Calendar`** primitive and a **`DateField`** (popover-triggering input) built on the existing in-repo design-system token layer (`app/components/dashboard/ui/tokens.ts`, which already reserves `dashboardZIndex.popover`), following the existing `createPortal` + `useHasMounted` + manual-Escape-listener modal convention already used four times in this codebase.
3. A single reusable **`DeadlineField`** component (persistence-agnostic, calling an injected `onCommit(value: string | null)`) that replaces all four duplicated free-text deadline editors, integrated first into the primary Task CRM project-deadline field (`project-meta-editor.tsx`), then everywhere else.

**No dependency is strictly required** (React 19 + the existing Popover primitive to be built is sufficient), but a small, well-maintained library (`react-day-picker` + `date-fns`, or Radix Popover + a hand-rolled calendar grid) would reduce the accessibility/keyboard-navigation risk considerably. This is a product/engineering decision documented as Open Question 1.

**No database migration is required.** `deadline_date` is already a Postgres `date` column (confirmed via `::date` casts throughout every RPC that writes it); it already stores exactly one calendar day, with no time-of-day or timezone component, and is fully compatible with a `YYYY-MM-DD` date picker as-is.

**A concrete, currently-live timezone bug was found** in `lib/tasks/parse-deadline.ts` (see §6) and a second, narrower one in `lib/project-updates/v2/project-update-judge.server.ts` (AI Judge / Client Updates comparison logic). Both predate this task and are out of scope to fix here, but the new architecture must not repeat this pattern, and fixing the first one is effectively a prerequisite for a trustworthy date picker (see Phase A).

---

## 2. Current repository state (Step 1)

| Item | Value |
|---|---|
| Current branch | `main` |
| `git status --short` | *(empty — clean)* |
| Working tree clean? | Yes |
| Framework | Next.js `16.1.6` (App Router) |
| React | `19.2.3` / `react-dom 19.2.3` |
| Package manager | npm (`package-lock.json` present; no yarn/pnpm/bun lockfile) |
| TypeScript | `^5`, `strict: true`, `moduleResolution: "bundler"`, path alias `@/*` → repo root |
| Lint | ESLint `^9` flat config (`eslint.config.mjs`) + `eslint-config-next` |
| Test runner | Vitest `^4.1.10`, `environment: "node"` (no jsdom), `include: ["**/*.test.ts"]` only — **no `.tsx` component tests run in CI today** |
| Styling | Tailwind CSS 4 is installed but the dashboard area does **not** use Tailwind classes — it uses inline `style={{...}}` objects (`CSSProperties`) driven by a hand-rolled token system |
| Existing component/design-system directory | Yes: `app/components/dashboard/ui/` (`tokens.ts`, `button.tsx`, `card.tsx`, `badge.tsx`, `empty-state.tsx`, `styles.ts`, `shell.ts`, `dashboard-theme.css`) |

No dirty state existed, so nothing needed to be preserved before mapping.

---

## 3. Complete file/surface inventory (Step 2)

### 3.1 Editable deadline surfaces — **four independent, duplicated implementations today**

| # | File | Component/Function | Editable? | Project or subtask | Current control | Value type in/out | Save mechanism | Validation | Loading/error | Shared or duplicated |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `app/components/dashboard/tasks/project-meta-editor.tsx:169-220` | `EditableMetaTextField` (`variant="deadline"`), rendered from `ProjectMetaEditor` (L81-91) | Editable | **Project** deadline (Task CRM main dashboard, desktop expanded row) | `<input type="text">`, draft state + `onBlur` commit + Enter-to-blur (`onEnterBlur`) | `string` in/out (free text) | `updateProjectField(projectId, "deadline", value)` → `dashboard-client.tsx` → `POST /api/projects/update` | None client-side; server parses via `parseDeadline` | Optimistic update + rollback in `dashboard-client.tsx`; no local error display in the field itself, only a toast | Duplicated — own `EditableMetaTextField` |
| 2 | `app/components/dashboard/extract/ai-project-review-panel.tsx:143-155` + `project-preview-presentation.tsx`'s `ProjectPreviewMetricInput` | Deadline field in `AiProjectReviewPanel` | Editable | **Project** deadline (Extract text/image review, pre-save) | `<input>`-based `ProjectPreviewMetricInput`, shows a computed "Date: MM/DD/YY" helper line via `formatDeadline` | `string` in/out | `onChange(item.originalIndex, "deadline", value)` → `extract-workspace.tsx`'s `updatePreviewItem` (local state only until "Save") | None; free text | No per-field error; save errors surface as a page-level toast in `extract-workspace.tsx` | Duplicated — own `ProjectPreviewMetricInput` |
| 3 | `app/components/dashboard/tasks/project-updates/project-update-review-card.tsx:379-397` | Suggested-deadline editor for a `deadline_change` update item | Editable | **Project** deadline suggestion (Client Updates / Project Updates review) | Inline editable text field, edits `deadline_text` | `string` in/out | `onUpdate("deadline_text", value)` → local edited-item state, applied later via `/api/project-updates/apply` | None; free text | Handled by the parent Project Update apply flow (separate loading/error state) | Duplicated — a third independent input implementation |
| 4 | `app/homepage-demo/review/HomepageDemoReviewPanel.tsx` (draft state `deadlineText`/`deadlineDate`, L25-100) | Homepage demo (pre-signup) deadline editor | Editable | Project-equivalent (pre-account demo flow) | Free-text input, own local draft/format logic | `string` in/out | Local demo-claim flow, separate from the authenticated dashboard entirely | None; free text | Separate save/claim flow (`lib/homepage-demo/*`) | Duplicated — a fourth, fully separate surface |

**No subtask has its own independently editable deadline anywhere in the current UI.** `TaskProjectSubtask` (the type backing individual subtask rows) carries `deadline`/`deadline_date`/`deadline_original_text` fields, but neither `desktop-tasks-table.tsx`'s subtask rows nor `mobile-task-card.tsx`'s `MobileSubtaskRow` (L426-531) render an editable deadline control for a subtask — only title (`task`) and `status` are editable per subtask. This means **"subtask deadline integration" (Phase D) is new UI, not a conversion of existing UI** — a distinction worth calling out explicitly since the task instructions assume subtask deadlines are already editable somewhere.

### 3.2 Display-only deadline surfaces

| File | What it shows | Value read | Notes |
|---|---|---|---|
| `app/components/dashboard/tasks/mobile-task-card.tsx:233-235` | Project deadline metric (`MobileMetric`) | `project.deadline` (formatted string) | Read-only summary card |
| `app/components/dashboard/tasks/mobile-task-card.tsx:710-730` `getDeadlineState` | Overdue/urgency coloring | `project.deadline_date \|\| project.deadline` → `new Date(...)`, local `.setHours(0,0,0,0)` comparison against `new Date()` | Timezone-safe in the narrow sense that both sides use the *same* browser's local midnight, but see §6 for why the *input* to this may already be shifted |
| `app/components/dashboard/tasks/desktop-tasks-table.tsx:767-791` `getDeadlineState` | Same urgency logic, desktop table row | Same pattern | Duplicated logic (not just duplicated UI) — same function name/body exists independently in both files |
| `lib/tasks/get-deadline-ui.ts` | Central urgency/tone/badge computation (`overdue`, `due today`, `due tomorrow`, `due soon`, `on track`) | `deadlineText`/`deadlineDate`/`status` | Used by dashboard overview widgets; the one place urgency computation is *actually* centralized — `desktop-tasks-table.tsx`/`mobile-task-card.tsx`'s local `getDeadlineState` duplicate a simpler version of this instead of reusing it |
| `app/components/dashboard/overview-v3/dashboard-priority-work-utils.ts` | "Priority work" widget deadline sorting/labels | `deadline_date`/`deadline` | Dashboard overview |
| `app/components/dashboard/overview-v3/dashboard-overview-utils.ts` | Overview aggregates | `deadline_date`/`deadline` | Dashboard overview |
| `lib/tasks/get-dashboard-alerts.ts` | "Due soon" alert banner grouping (overdue/dueToday/dueTomorrow/dueSoon) | `deadline_date`/`deadline` via `getDeadlineUi` | Feeds `buildUrgentPreviewTasks` in `dashboard-helpers.ts` |
| `app/components/dashboard/tasks/use-task-derived-data.ts:150-220` | Sort options `deadline-asc`/`deadline-desc` | `group.deadline_date \|\| group.deadline` | Task filters/sorting |
| `app/components/dashboard-client.tsx:732` `exportVisibleTasksToCsv` | CSV export "Deadline" column | `task.deadline` (the **formatted MM/DD/YY display string**, not the canonical `deadline_date`) | See §10 — CSV currently exports a locale-ambiguous, already-formatted string, not ISO |
| `app/components/dashboard/dashboard-helpers.ts:156-168` `buildTaskCopyText` | "Copy task" clipboard text | `task.deadline` | Same formatted-string source as CSV |
| `app/components/dashboard/tasks/task-utils.ts:167` | Grouping/labeling by created day (not deadline) | `task.created_at.slice(0, 10)` | Not a deadline field, but the **same risk class** — UTC-naive slicing of a timestamp; noted for completeness |

### 3.3 Server / API / persistence layer

| File | Role |
|---|---|
| `app/api/tasks/update/route.ts` (L4, 397-400) | Single task field update; `field: "deadline"` → `parseDeadline(deadlineText)` → writes `deadline_text` + `deadline_date` |
| `app/api/tasks/route.ts` (L3, 317, 344, 458, 619, 684-705, 990, 1039) | Task/project creation (manual single task, and "create project with subtasks") — multiple independent call sites of `parseDeadline` |
| `app/api/projects/update/route.ts` (L4, 217-220) | Project field update; same `parseDeadline` pattern |
| `app/api/project-updates/apply/route.ts` + `supabase/migrations/*_transactional_project_update_apply.sql` | Client Updates "apply" — writes `deadline_date` via `nullif(v_updates->>'deadline_date', '')::date` inside the transactional RPC |
| `lib/projects/import-persistence.server.ts` | Extraction/import persistence RPC payload building — same `::date` cast pattern downstream |
| `lib/project-updates/project-update-apply.server.ts`, `project-update-field-normalizers.ts` | Builds the apply-payload for `deadline_change` items before calling the RPC |
| `lib/project-updates/v2/project-update-judge.server.ts:884-898` `normalizeDeadlineDateKey` | AI Judge compares suggested vs. current deadline text; **contains the second `toISOString().slice(0, 10)` risk site** (see §6) |
| `lib/project-updates/project-update-analysis.server.ts`, `project-update-context.server.ts`, `project-update-post-process.server.ts`, `project-update-image-mapper.server.ts` | Client Updates analysis pipeline; pass `deadline_text`/`deadline_date` through without independent date construction |
| `lib/extraction/text-extraction.server.ts`, `lib/extraction/image-extraction.server.ts`, `lib/extraction/schemas.ts` | AI extraction; schema only ever produces `deadline_text: z.string()` — **the LLM never outputs a `deadline_date` directly**; it is always derived by `parseDeadline` afterward |
| `lib/task-suggestions/task-suggestion.server.ts`, `lib/task-suggestions/schemas.ts`, `app/api/tasks/suggest/route.ts`, `app/api/tasks/suggest-batch/route.ts` | AI "suggest subtasks" flow; same `deadline_text`-only schema pattern |
| `lib/homepage-demo/review-payload.server.ts`, `lib/homepage-demo/claim-save-repository.server.ts` | Homepage demo (pre-signup) persistence — parallel but separate from the authenticated app's persistence path |

### 3.4 Core date utilities (the real foundation)

| File | Purpose | Timezone-safe? |
|---|---|---|
| `lib/tasks/parse-deadline.ts` | Free-text → `{ deadlineDate: string \| null, matched: boolean }` | **No** — see §6, this is the primary risk |
| `lib/tasks/format-deadline.ts` | `deadlineText`/`deadlineDate` → `"MM/DD/YY"` display string | Yes in practice — uses `date.getFullYear()/getMonth()/getDate()` local component getters, never `.toISOString()` |
| `lib/tasks/get-deadline-ui.ts` | Urgency tone/label/color computation | Yes in practice — same local-getter pattern, `differenceInCalendarDays` compares two local-midnight instants |

### 3.5 Type contracts

| File | Types |
|---|---|
| `app/components/dashboard/tasks/task-types.ts` | `TaskRow`, `ProjectEntity`, `TaskProjectSubtask`, `TaskProjectGroup` — the de facto canonical client-side shapes |
| `lib/extraction/schemas.ts` | Zod schema for AI extraction output — `deadline_text: z.string()` only |
| `app/components/dashboard/dashboard-helpers.ts` / `app/components/dashboard/extract-workspace.tsx` | `normalizeTaskFromApi`, `mapSavedTaskToRow`, `mapSavedProject`, `mapTaskToPreview` — client-side raw-API-row → `TaskRow`/`PreviewItem` normalizers (already `unknown`-narrowed, no `any`, from a prior session's work) |

### 3.6 Existing tests touching dates

| File | What it tests |
|---|---|
| `app/components/dashboard/editable-preview-list.test.ts` (L83-84) | Asserts `deadlineDate?.slice(0, 10)` equals a specific date after building preview groups — a **symptom test**, not a direct unit test of the parsing/formatting logic |
| `lib/tasks/project-duplicate-detection.test.ts` | Uses `deadline_text`/`deadline_date` as fixture data for duplicate-matching, not date-logic assertions |
| `lib/project-updates/project-update-apply.server.test.ts`, `lib/project-updates/v2/project-update-judge.server.test.ts`, `lib/project-updates/v2/project-update-subtask-reference.server.test.ts` | Use deadline fields as fixture data within broader Project Update flow tests |

**`lib/tasks/parse-deadline.ts` and `lib/tasks/format-deadline.ts` — the two files that do all real date math and are the primary timezone-risk surface — have zero dedicated test files.**

---

## 4. Data-flow diagrams (Step 3, text form)

### 4.1 Manually typed deadline (current free-text flow)

```
User types "May 15, 2026" in EditableMetaTextField
  -> draft state (React useState, client component)
  -> onBlur -> updateProjectField(projectId, "deadline", "May 15, 2026")
  -> dashboard-client.tsx: optimistic local update (draft string only, no date parsing client-side)
  -> POST /api/projects/update  { projectId, field: "deadline", value: "May 15, 2026" }
  -> app/api/projects/update/route.ts:
       deadline_text = "May 15, 2026"
       { deadlineDate } = parseDeadline(deadline_text)   <-- SERVER-SIDE, Node runtime local time
       updateData.deadline_date = deadlineDate            <-- full ISO datetime string, e.g. "2026-05-15T12:00:00.000Z"
  -> Supabase update: deadline_text (text column), deadline_date (cast ::date somewhere downstream / by Postgres's own type coercion on UPDATE)
  -> DB row: deadline_text = "May 15, 2026", deadline_date = 2026-05-15 (date column)
  -> API response: project row including deadline_text, deadline_date
  -> Client: normalizeTaskFromApi/mapSavedProject -> TaskRow.project.deadline_date (string, "YYYY-MM-DD" as returned by Postgres for a date column)
  -> Display: formatDeadline(deadline_text, deadline_date) -> "05/15/26"
```

### 4.2 AI-extracted deadline (Extract text/image flow)

```
Raw pasted text or uploaded image
  -> /api/extract or /api/extract-image (OpenAI call)
  -> lib/extraction/schemas.ts: TextExtractedTaskSchema -> { deadline_text: string, ... }  (LLM never emits a date value, only text)
  -> Client (extract-workspace.tsx): mapTaskToPreview(task, source)
       originalDeadlineText = pickString(record.deadline_text)
       parsedDeadline = parseDeadline(originalDeadlineText)   <-- CLIENT-SIDE, browser local time
       preview.deadline_date = parsedDeadline.deadlineDate     <-- ISO datetime string, browser-local-noon-derived
  -> User reviews/edits in AiProjectReviewPanel (free text, same parseDeadline path re-run on every edit via helper text)
  -> Save: buildProjectPayload -> deadline_date: buildSaveDeadlineDate(group.deadlineDate)
       buildSaveDeadlineDate: if value already matches /^\d{4}-\d{2}-\d{2}$/, returns it UNCHANGED (safe)
                               else new Date(value) -> formatDateOnly(parsed) using LOCAL getters (safe, symmetric with the browser that produced the value)
  -> POST /api/projects/import -> transactional RPC -> ::date cast -> DB
```

**Risk note:** the symmetry between "browser-local-noon-then-toISOString" (write) and "new Date(that ISO string)-then-local-getters" (re-read in the same browser session) only holds if it is the *same browser/timezone* throughout. It also silently degrades: if any intermediate step ever does `.slice(0, 10)` on the shifted ISO string instead of re-parsing with local getters, the shift becomes permanent. This currently does **not** happen in the save path, but it does happen in the AI Judge comparison path (§4.4) and in the test assertion in `editable-preview-list.test.ts`.

### 4.3 Editing an existing deadline

Same as §4.1 — there is no different code path for "edit" vs "first set." The field always starts from `formatDeadlineDisplay(project.deadline_date, ...)` (project-meta-editor.tsx L149-167), which safely rebuilds a `YYYY-MM-DD` string from **local** date components of `new Date(deadline_date)` — this is timezone-safe as long as `deadline_date` itself, as returned by Postgres for a `date` column via the Supabase client, does not carry a spurious time-of-day. Supabase/PostgREST returns `date` columns as plain `"YYYY-MM-DD"` strings (no time, no `Z`), so `new Date("2026-05-15")` is parsed by the JS engine as **UTC midnight**, and reading `.getFullYear()/.getMonth()/.getDate()` on that **can shift by one day for any browser west of UTC** (e.g., a US-based browser). This is a **second, independent day-shift risk**, separate from the `parse-deadline.ts` one, and it currently affects every read of an already-saved date-only value through `new Date(dateOnlyString)` followed by local getters. It is currently latent because the specific call site (`formatDeadlineDisplay`) is only used to populate the initial *edit* draft value, and a user re-typing/re-confirming the same date would silently "correct" it back — but it is a real, demonstrable bug for **display** of an existing deadline in a browser with a negative UTC offset, and must not be carried into the new picker.

### 4.4 AI Judge deadline comparison (Client Updates)

```
Suggested deadline text (from an AI-analyzed client message) vs. current project deadline_text
  -> lib/project-updates/v2/project-update-judge.server.ts: normalizeDeadlineDateKey(value)
       if value starts with /^\d{4}-\d{2}-\d{2}/, use that substring directly (safe)
       else: new Date(raw).toISOString().slice(0, 10)   <-- UNSAFE: server-local-time Date, sliced as UTC date
  -> compares normalized keys to decide "is this suggestion actually a change?"
```

This affects only the **AI's own judgment** of whether to surface a "no meaningful change" vs. a real suggested change — not the final persisted `deadline_date` value (the actual write still goes through the same `parseDeadline`/`::date` path as everything else). Its blast radius is "Client Updates may occasionally propose a deadline change that is a false positive/negative right at a day boundary in certain server timezones," not silent data corruption.

### 4.5 Clearing a deadline

`EditableMetaTextField`'s `onCommit` fires with an empty string when the user blurs an emptied field. `commitProjectField` trims and compares; an empty string is a legitimate "next value" (not special-cased as "no change"). Server-side, `parseDeadline("")` returns `{ deadlineDate: null, matched: false }` immediately (L694: `if (!deadlineText || !deadlineText.trim())`). `deadline_text` is written as `""`, `deadline_date` as `null`. This path is already correct and safe — a `null` clears the DB `date` column cleanly via `nullif(..., '')::date` in every RPC. The new picker's "Clear" action must produce the same `{ text: "", date: null }` pair (or a `null` sentinel understood the same way by the reused save mechanism).

### 4.6 CSV export

`exportVisibleTasksToCsv` (dashboard-client.tsx) reads `task.deadline` — the already-formatted `"MM/DD/YY"` **display** string — not `deadline_date`. This is a policy point, not a bug: it means CSV currently mirrors whatever is on screen, at the cost of being locale-ambiguous (`05/06/26` is May 6 to a US reader and June 5 to almost everyone else). See §10 and Open Question 4.

### Authoritative source of truth

**`deadline_date` (the Postgres `date` column) is the authoritative source of truth for "when is this due," whenever it is non-null.** `deadline_text` is the authoritative source of truth for "what the user/AI originally said" (free-text provenance, useful for re-parsing and for values `parseDeadline` could not resolve to a date). `deadline_original_text` exists **only as a client-side TypeScript field** (never persisted — see §5) and should not be treated as a third source of truth.

---

## 5. Database and type contracts (Step 4)

- **No generated Supabase types exist in this repository** (`grep` for `database.types.ts`/`supabase.types.ts` — no matches). Both `lib/supabase/admin.ts` and `lib/supabase/server.ts` call `createClient`/`createServerClient` **without** a `Database` generic. There is no compile-time-enforced schema contract anywhere in the app layer; `TaskRow`/`ProjectEntity` in `task-types.ts` are hand-maintained and are the closest thing to a contract.
- **The base `tasks`/`projects` table definitions predate the tracked `supabase/migrations/` history** — no `CREATE TABLE`/`ALTER TABLE ... ADD COLUMN deadline_*` statement exists in any migration file. The column types below are inferred from consistent, repeated usage across every migration that touches these columns, not from a single authoritative `CREATE TABLE` statement in this repo.
- **`deadline_date` is a Postgres `date` column** (evidenced by `nullif(v_task_payload->>'deadline_date', '')::date` and the equivalent for `deadline_text` used identically across `202606150005`, `202606150006`, `202606150008`, `202606160001`, `202606160002`, `202607020004/5` migrations — always cast `::date`, never `::timestamp`/`::timestamptz`). It is nullable in every write path (`nullif(...)::date` yields `NULL` for an empty string).
- **`deadline_text` is a plain text/varchar column**, always written as a raw string, never cast.
- **`deadline_original_text` is not a database column at all.** It exists only in `TaskRow`/`PreviewItem` (client TypeScript types) and is derived client-side (`normalizeTaskFromApi`, `mapSavedTaskToRow`) as a display-fallback duplicate of `deadline_text`. This is intentional-looking (it lets the UI show what the user actually typed even after `deadline_text` gets normalized), but it is not part of the persistence contract and a date-picker implementation should not treat it as one.
- **Project and subtask (task) deadlines use the identical column contract** — same `deadline_text`/`deadline_date` pair on both `projects` and `tasks` tables, same nullability, same `::date` cast pattern in every RPC that touches either table.
- **No migration is required** for the date picker itself. The `date` column already stores exactly a calendar day with no time-of-day component; a picker that always sends a strict `YYYY-MM-DD` string (or `null`) is fully compatible with the existing schema as-is.
- **Existing production values are compatible**, with one caveat: because `deadline_date` has historically been populated via `parseDeadline(...).toISOString()` → `::date` cast rather than a direct `YYYY-MM-DD` string, and because Postgres's `::date` cast on a `timestamptz`-shaped input string is influenced by the database session's `timezone` setting, it is possible (not confirmed, see Open Question 2) that a small number of historical rows were written one day off from the date the user actually intended, in edge-case timezones. This does not require a migration to *support* the new picker — the column already only ever holds a clean date — but it does mean a small number of existing values could visually look "off by one" to affected historical users once they see them rendered in a precise calendar UI instead of a vague `MM/DD/YY` string. This is a data-quality question, not a schema question, and is listed as Open Question 2.
- **No malformed non-date values are expected in `deadline_date`** — every write path passes through `::date` casting inside the same-transaction RPCs, which would have raised a Postgres error on genuinely invalid input rather than storing garbage. `deadline_text`, being free text, may of course contain anything (including values that never successfully parsed into a `deadline_date`), which is expected and by design.

---

## 6. Date and timezone risks (Step 3 / Step 6, explicit)

### Risk 1 — `lib/tasks/parse-deadline.ts`: local-noon construction + `.toISOString()` (Confirmed, live)

Every successful branch of `parseDeadlineCore` (18 call sites, L387–L682) returns `deadlineDate: <Date>.toISOString()`, where `<Date>` was built via JS `Date` constructor/setter calls that operate in **whatever timezone the executing JS engine is in** (the end user's browser when called client-side in `extract-workspace.tsx`/`editable-preview-list.tsx`; the server's Node.js process timezone when called server-side in every `app/api/**` route that handles a deadline). `buildLocalDate` deliberately anchors to **noon** local time specifically to dodge DST-boundary and midnight-rounding issues — but noon-local, converted to UTC via `.toISOString()`, shifts to the **previous UTC calendar day** for any timezone at UTC+13 or later (Tonga, Samoa, Kiribati/Line Islands, several Pacific nations), and can land exactly on the boundary for UTC-12. This is a genuine, reproducible off-by-one-day bug for real users in those zones, on both the client-side (Extract flow, browser timezone) and server-side (any Next.js deployment not pinned to UTC) call sites.

### Risk 2 — Reading an existing `date`-column value via `new Date(dateOnlyString)` + local getters (Confirmed, live)

`formatDeadlineDisplay` in `project-meta-editor.tsx` (L149-167) does `new Date(deadline_date)` where `deadline_date` is a bare `"YYYY-MM-DD"` string as returned by PostgREST for a `date` column. Per the ECMAScript spec, a bare date-only ISO string is parsed as **UTC midnight**, so reading `.getFullYear()/.getMonth()/.getDate()` (local getters) on it shifts the *displayed* date back by one day for any browser west of UTC (essentially all of the Americas). This is currently only used to seed the editable-field draft value, but it is a real, easily reproducible display bug and is exactly the class of bug the new picker's "currently selected date" display must never repeat.

### Risk 3 — `lib/project-updates/v2/project-update-judge.server.ts:897` — `parsed.toISOString().slice(0, 10)` (Confirmed, live, narrower blast radius)

Used only to build a comparison key for the AI Judge's "is this a meaningful deadline change?" decision (§4.4). Same local-time-construction-then-UTC-slice pattern as Risk 1, but the JS `Date` here is built via `new Date(raw)` on arbitrary AI-analysis text, not via the noon-anchored `buildLocalDate` helper, so its exact shift behavior depends on what the source string looks like. Confirmed present via direct code read; not confirmed to have caused a real misjudgment in production, since it would require the analyzed text to be a non-`YYYY-MM-...`-prefixed value that also lands within a few hours of a UTC day boundary in the server's local time.

### Risk 4 — CSV export and clipboard copy use the **formatted display string**, not canonical `deadline_date`

Not a day-shift bug per se, but a related, cross-cutting concern the new architecture should resolve deliberately rather than by accident: `exportVisibleTasksToCsv` and `buildTaskCopyText` both read `task.deadline` (already `MM/DD/YY`-formatted). See §10, Open Question 4.

### Confirmed **not** a risk

- `lib/tasks/format-deadline.ts` and `lib/tasks/get-deadline-ui.ts` consistently use **local Date component getters** (`getFullYear()/getMonth()/getDate()`), never `.toISOString()`, and are internally symmetric — display and urgency-tone computation do not introduce their own day shifts (they may *inherit* an already-shifted value from Risk 1/2, but do not add a new shift).
- `buildSaveDeadlineDate` in `extract-workspace.tsx` correctly special-cases an already-canonical `YYYY-MM-DD` input by returning it unchanged, and otherwise re-derives via local getters rather than `.toISOString()` — this is the **one existing piece of code that already implements the correct pattern**, and is a useful reference for the new shared utility.
- No evidence was found of `new Date("YYYY-MM-DD")` being used for anything other than display/re-formatting of an already-computed value (i.e., no evidence it currently corrupts a *persisted* value); the persisted value's own construction (Risk 1) is the primary concern.
- No locale-dependent parsing (`Date.parse` with ambiguous locale strings, `toLocaleDateString` before persistence) was found anywhere in the write path.

---

## 7. Existing UI/dependency inventory (Step 5)

### Installed today (relevant excerpt of `package.json`)

Dependencies: `next 16.1.6`, `react`/`react-dom 19.2.3`, `zod ^4`, `sonner` (toasts), `framer-motion`, `recharts`, `@supabase/ssr`, `@supabase/supabase-js`, `openai`, `bullmq`, `ioredis`.
Dev dependencies: `typescript ^5`, `eslint ^9` + `eslint-config-next`, `tailwindcss ^4`, `vitest ^4.1.10`, `@types/*`.

**Not installed, anywhere:** Radix UI (any package), shadcn/ui (no `components.json`), React Aria / `react-aria-components`, Headless UI, `date-fns` (or any date-math library), `react-day-picker` / `react-datepicker` / any calendar package, `@floating-ui/*` / `popper.js` (no positioning-engine library).

### Already in production, reusable as-is

- **`app/components/dashboard/ui/tokens.ts`** — `dashboardColors`, `dashboardSpacing`, `dashboardRadii`, `dashboardShadows`, `dashboardTypography`, `dashboardZIndex` (which **already reserves `popover: 1200`**, above `header`/`sticky` and below `overlay`/`modal`/`toast` — strong evidence a popover-style UI was anticipated), `dashboardBreakpoints` (`mobile: 900`), `dashboardTransitions`.
- **`app/components/dashboard/ui/styles.ts`** — `focusRing` (a ready-made visible-focus style), `visuallyHidden` (screen-reader-only helper), `truncate`, `surfaceBase`.
- **`app/components/dashboard/ui/button.tsx`** (`DashboardButton`) — variant/size system directly reusable for "Today"/"Clear" actions inside the picker.
- **Portal + SSR-safety convention**, used identically in four existing modals (`resource-manager-modal.tsx`, `resource-note-editor-modal.tsx`, `project-update-history-modal.tsx`, `project-update-shell.tsx`): `createPortal(content, document.body)` gated by `useHasMounted()` (`app/components/dashboard/use-has-mounted.ts`, `useSyncExternalStore`-based, SSR-safe).
- **Escape-to-close + click-outside convention** (`project-update-shell.tsx` L85-90, 142-152): a `useEffect` keydown listener checking `event.key === "Escape"`, plus an overlay `onMouseDown` handler with `event.stopPropagation()` on the inner panel — directly adaptable for a popover (though a popover typically should **not** dim/overlay the whole page the way these modals do).
- **Enter-to-commit convention** (`onEnterBlur`/`handleEnterBlur` in `tasks-view.tsx` L280-286) — `Enter` blurs the field to trigger the existing `onBlur`-commit pattern. **No existing Escape-to-cancel behavior exists anywhere in the current editable-field system** — this is new behavior to design, not reuse.

### Gaps that must be built new (no existing reusable implementation)

- No focus-trap utility.
- No "return focus to the trigger element on close" pattern anywhere in the codebase (checked all four `createPortal` modals — none restore focus).
- No positioning/collision-detection engine (viewport-edge-aware popover placement) — every existing "popover-like" UI in this codebase is actually a full-screen dimmed modal, not an anchored, viewport-aware popover. This is a **new problem for Text2Task**, not a reused pattern.
- No calendar grid, month/year navigation, or keyboard grid-navigation (arrow keys moving across days) anywhere in the codebase.

### Is native `<input type="date">` used anywhere, intentionally?

**No.** Confirmed via search — there is no `type="date"` input anywhere in the codebase. The current free-text approach is not "instead of" a native date input that's being replaced; it was a deliberate choice to accept natural language ("next Friday", "end of month") for AI-extraction ergonomics, parsed server-side. This has real product value (typing "next Friday" is faster than clicking through a calendar for a fast-moving freelancer workflow) — see Open Question 3 on whether manual natural-language typing should be preserved alongside the new picker, or the picker should become the only manual-entry mechanism.

---

## 8. Recommended production architecture (Step 7)

### Component boundary

```
lib/tasks/date-only.ts                (Phase A — pure utilities, no React)
  isValidDateOnly(value): value is DateOnly
  todayDateOnly(): DateOnly
  compareDateOnly(a, b): number
  parseDateOnlyInput(raw, policy): DateOnly | null      (see §10 — replaces ad hoc typed-date parsing)
  formatDateOnlyForDisplay(value, locale?): string       (e.g. "Jan 20, 2027")
  formatDateOnlyForA11y(value, locale?): string           (full unambiguous label for aria-live/aria-label)

app/components/dashboard/ui/calendar/
  Calendar.tsx        — headless-ish calendar grid: month view, day/keyboard nav, Today/selected/hover state. No persistence knowledge. No text input. Pure `value`/`month`/`onSelect`/`onMonthChange` props.
  MonthYearSelect.tsx — compact month/year navigation (dropdowns or fast-jump), reused by Calendar.
  DatePickerPopover.tsx — positions Calendar relative to an anchor element, owns open/close, Escape, click-outside, focus trap, focus return; uses existing createPortal + useHasMounted + dashboardZIndex.popover.
  DateField.tsx       — a text-like field (shows the formatted value, e.g. "Jan 20, 2027") that opens DatePickerPopover on click/focus/Enter/Space. Controlled: `value: DateOnly | null`, `onChange(next: DateOnly | null)`. Knows nothing about tasks/projects/Supabase.

app/components/dashboard/tasks/deadline-field.tsx        (Phase B/C — the actual product-facing component)
  DeadlineField: wraps DateField with Text2Task's existing draft-value + onBlur/onCommit-style contract
  (so it is a drop-in replacement for EditableMetaTextField's deadline variant), still persistence-agnostic —
  it calls a passed-in onCommit(next: DateOnly | null), never fetch() and never imports Supabase types.
```

This mirrors the separation the repo already establishes elsewhere (e.g. `dashboard-helpers.ts`'s pure normalizers vs. `dashboard-client.tsx`'s fetch/save orchestration): **UI primitives are pure and reusable; persistence orchestration stays in the existing page/component-level `updateProjectField`/`updateTaskField` functions**, unchanged in shape (`(id, field, value) => Promise<void>`).

### Value type

- **Canonical value: `string | null`, strictly `/^\d{4}-\d{2}-\d{2}$/` when non-null.** A branded type alias (`type DateOnly = string`, validated at the boundary by `isValidDateOnly`) rather than a raw `string`, to make "this is specifically a canonical date-only value, not any string" explicit at the type level without runtime cost.
- The component **never** touches `deadline_text` directly — that remains an orchestration-layer concern (the existing "field: deadline" commit path already derives/keeps `deadline_text` server-side via `parseDeadline`; see Open Question 3 for whether that continues once a picker exists).

### Controlled vs. uncontrolled

**Controlled.** `DeadlineField`/`DateField` take `value: DateOnly | null` and call `onChange`/`onCommit` — matching the existing `updateProjectField`/`updateTaskField` contract exactly (`(id, field, value: string) => void`), and matching how `EditableMetaTextField` already receives `defaultValue` + resyncs via a `useEffect` when the prop changes (project-meta-editor.tsx L191-193) after a server round-trip.

### Draft vs. persisted value, save timing, cancellation

Preserve the exact existing model: a local draft value inside the field, committed only on an explicit action — for a picker, "explicit action" means **clicking a day, clicking Today, or clicking Clear**, not every keystroke/hover. This is a meaningfully different (and simpler, safer) trigger than the current text field's `onBlur`, and actually reduces "accidental save" risk since there is no ambiguous partial-text state to commit. Cancellation = closing the popover via Escape or click-outside **without** having clicked a day/Today/Clear — the draft is discarded and the field reverts to its last-committed `value` prop, with no network call.

### Optimistic update / error rollback interaction

**No change** to `dashboard-client.tsx`'s existing pattern: `updateProjectField`/`updateTaskField` already do optimistic local state update → `fetch` → rollback-to-`previousTasks`-on-failure → toast. `DeadlineField` only needs to call the existing `onCommit` at the moment of selection; it does not need its own loading/error UI beyond respecting a `disabled`/`loading` prop threaded from the existing `savingTaskIds`/`isDeleting` state already tracked per row.

### Clearing

`DateField` renders a "Clear" action inside the popover (only when the field is optional, i.e., always for deadlines, which are nullable) that calls `onChange(null)` and closes. This maps directly to the existing empty-string-commit path (§4.5) — the orchestration layer's existing "empty string → `deadline_date: null`" handling needs no change, only the field needs to call `onCommit("")` or `onCommit(null)` (whichever the adapter layer expects) instead of relying on an emptied text input.

### Today

A "Today" quick-action in the popover footer, computed via `todayDateOnly()` using the **user's browser** local calendar day (`new Date()` + local getters — never `.toISOString()`), consistent with how "due today" is already computed in `get-deadline-ui.ts`.

### Month/year selection for far-future/past dates

A compact `MonthYearSelect` (two dropdowns, or a click-to-expand year grid) rather than requiring N clicks of a "next month" arrow — necessary given the product explicitly calls out "dates far in the future or past" (e.g., a multi-year project deadline). No existing in-repo pattern for this; to be designed fresh, styled with the existing `dashboardColors`/`dashboardRadii` tokens.

### Mobile behavior

Given `dashboardBreakpoints.mobile = 900` already exists as the app's mobile threshold, and given the existing modal convention already renders full-screen-ish overlays on small viewports (see `mobile-task-card.tsx`'s already-mobile-specific layout components), the recommendation is: **below the mobile breakpoint, `DatePickerPopover` renders as a bottom sheet (still via the same `createPortal`) instead of an anchored popover**, to avoid viewport-collision complexity and to give touch targets adequate room. This reuses the portal/Escape/click-outside machinery but swaps the *positioning* strategy only — not a second component.

### Locale behavior

See §10 in full. Short version: canonical storage/comparison is always `YYYY-MM-DD`; the calendar UI always shows **English month names** in the first release (matches the product requirement's "Jan 20, 2027" example and the existing `formatDeadline`'s English-only output); full i18n of month names is out of scope for the first release (Open Question 5).

### Display format for the first release

**"Jan 20, 2027"** (unambiguous, matches the product requirement's explicit example) for the field's resting/display state, **not** raw `YYYY-MM-DD` — but the picker's own internal value and every persisted/API value remains strict `YYYY-MM-DD`. This is a deliberate split from the *current* `format-deadline.ts` output (`"05/15/26"`), which is itself ambiguous (see Open Question 4 on whether `format-deadline.ts` should be updated to match, given it feeds CSV/clipboard too).

### Avoiding duplicated project/subtask implementations

Because `DeadlineField` takes `value`/`onChange` and knows nothing about "project" vs. "task," the **same component** serves `ProjectMetaEditor` (project deadline), any future subtask deadline UI, `AiProjectReviewPanel` (Extract review), and `ProjectUpdateReviewCard` (Client Updates) — eliminating three of the four currently-duplicated free-text implementations identified in §3.1 (the homepage-demo surface is a separate, pre-signup codebase area and is explicitly out of scope for the phased plan below unless product wants it included).

---

## 9. Proposed component API (Step 7, concrete)

```ts
// lib/tasks/date-only.ts
export type DateOnly = string; // validated YYYY-MM-DD

export function isValidDateOnly(value: unknown): value is DateOnly;
export function todayDateOnly(): DateOnly;
export function compareDateOnly(a: DateOnly, b: DateOnly): number;
export function formatDateOnlyForDisplay(value: DateOnly, locale?: string): string; // "Jan 20, 2027"
export function formatDateOnlyForA11y(value: DateOnly, locale?: string): string;    // "January 20, 2027"

// app/components/dashboard/ui/calendar/date-field.tsx
export type DateFieldProps = {
  value: DateOnly | null;
  onChange: (next: DateOnly | null) => void;
  disabled?: boolean;
  loading?: boolean;
  clearable?: boolean;          // default true (deadlines are nullable)
  placeholder?: string;         // e.g. "Set a deadline"
  label: string;                // required, for a11y — never icon-only
  minDate?: DateOnly;
  maxDate?: DateOnly;
  todayLabel?: string;          // default "Today"
  clearLabel?: string;          // default "Clear"
  id?: string;
  "aria-describedby"?: string;
};

// app/components/dashboard/tasks/deadline-field.tsx
export type DeadlineFieldProps = {
  value: DateOnly | null;
  onCommit: (next: DateOnly | null) => void; // matches existing (id, field, value) orchestration one level up
  disabled?: boolean;
  loading?: boolean;
};
```

`DeadlineField` deliberately does **not** accept `projectId`/`taskId`/a Supabase client — the caller (e.g. `ProjectMetaEditor`) keeps calling `updateProjectField(projectId, "deadline", nextValueOrEmptyString)` from its own `onCommit` callback, exactly as it already does today.

---

## 10. Locale and date-only policy (Step 8)

| Concern | Current state | Recommended policy |
|---|---|---|
| Canonical storage | `deadline_date`: Postgres `date`, always `YYYY-MM-DD` | **Unchanged — keep.** |
| Form/component value | Free string, natural language | New picker: strict `DateOnly` (`YYYY-MM-DD \| null`) only; manual typing (if retained, Open Question 3) must go through one explicit, tested parser with a documented, non-ambiguous grammar — not silently accept `01/02/2027`. |
| Visible formatting | `format-deadline.ts` → `MM/DD/YY` (ambiguous: `05/06/26`) | New picker field display: `"Jan 20, 2027"` (unambiguous month name). `format-deadline.ts` itself is out of scope to change in this mapping (used by CSV/clipboard/other surfaces) — see Open Question 4. |
| Month names | English only, everywhere | Keep English-only for the first release; matches the product requirement's own example and every existing surface. Full i18n is Open Question 5. |
| User locale | Not read/used anywhere in date logic today (no `toLocaleDateString`, no `Intl.DateTimeFormat` found in the deadline surfaces) | First release: no locale switching. If added later, it must only affect **display formatting**, never the canonical `YYYY-MM-DD` value or the comparison logic. |
| Ambiguous manual input | `format-deadline.ts`'s `tryParseSlashDate` already special-cases DD/MM/YYYY vs. MM/DD/YY **inconsistently** (tries DD/MM/YYYY first, only for 4-digit years; falls back to MM/DD for 2-or-4-digit years) — this is itself a latent ambiguity bug worth flagging, not fixing here | If manual typing is retained (Open Question 3), the **only** accepted typed formats should be the picker's own canonical `YYYY-MM-DD` and possibly the field's own display format when unambiguous (e.g. "Jan 20 2027"); slash-separated numeric dates should not be silently guessed. |
| Accessibility labels | None specific to dates exist today | Use `formatDateOnlyForA11y` (full month name + 4-digit year) for every `aria-label`/`aria-live` announcement — never the ambiguous `MM/DD/YY`. |
| CSV export | Exports `task.deadline` (`MM/DD/YY`, already locale-ambiguous today) | Recommend switching CSV's Deadline column to canonical `YYYY-MM-DD` for unambiguous re-import/spreadsheet sorting — **product decision, not assumed here** (Open Question 4). |

**Distinguishing the three concepts** (already true today, formalize going forward):

1. **Canonical machine value** — `deadline_date`, `YYYY-MM-DD`, DB + API + new picker's value.
2. **Localized visible label** — computed only for display, never stored, never compared.
3. **Raw AI-extracted/typed text** — `deadline_text`, intentionally preserved (a real DB column, unlike `deadline_original_text`), useful provenance and re-parse input; the new picker does not need to write to it directly (the existing orchestration layer already derives it), but any surface that still allows free-text natural-language entry alongside the picker must keep writing it exactly as today.

---

## 11. Accessibility and responsive policy (Step 6, consolidated)

### Desktop

- Popover anchored to the `DateField` trigger; must reposition/flip on viewport-edge collision (new capability, no existing engine — see Open Question 1).
- Must render inside a scrolling container correctly (the Task CRM table rows scroll horizontally/vertically); anchor positioning must account for scroll offset, not just initial layout.
- `z-index: dashboardZIndex.popover` (already reserved at `1200`).
- Closes on: valid day selection, Today, Clear, Escape, click-outside (reuse the existing `useEffect`-keydown + overlay-`stopPropagation` pattern from `project-update-shell.tsx`, adapted for a non-dimming popover).

### Mobile

- Below `dashboardBreakpoints.mobile` (900px): bottom-sheet presentation (see §8) to avoid limited-viewport collision math and to give touch targets room.
- Touch targets: minimum 44×44px per day cell (current text-input `minHeight: 34` in `project-meta-editor.tsx`'s `inputStyle` is already below typical touch-target guidance — the picker's day cells must not repeat this).
- Virtual keyboard: because the new field is trigger-based (not a raw text input by default), the virtual keyboard should not appear at all when opening the picker — a meaningful UX improvement over the current free-text field on mobile, and it removes an entire class of virtual-keyboard-covers-the-input problems.
- Scroll locking while the sheet/popover is open (existing modals do not currently lock body scroll — checked all four `createPortal` modals — so this is a new capability to add, not reuse, if the mobile presentation is sheet-style and full-height).
- Orientation change: bottom sheet should reflow height-safely; anchored desktop popover should re-anchor or close (closing is simpler and safer than re-anchoring mid-gesture).

### Accessibility

- `DateField` trigger: a real `<button>` or a text-like element with `role="button"`, never a bare `<div onClick>`; explicit visible `<label>` (the repo already labels every field visibly — `metaLabelStyle` in `project-meta-editor.tsx` — continue this).
- Popover: `role="dialog"` with a descriptive `aria-label` (e.g. `"Choose deadline date"`), matching the existing `project-update-shell.tsx` convention (`role="dialog" aria-modal="true" aria-label="..."`) — though `aria-modal` should likely be `false`/omitted for a non-page-dimming popover, since true modal semantics trap all page interaction, which is not appropriate for a small inline calendar.
- Calendar grid: `role="grid"`/`role="gridcell"` (or the simpler, well-supported `<table role="grid">` day-cell pattern) with arrow-key navigation between days, Home/End for week start/end, PageUp/PageDown for month navigation — standard patterns, none currently implemented anywhere in this repo.
- Focus entry: on open, focus moves to the selected date's cell (or today's cell if nothing selected yet).
- Focus return: on close (any method), focus returns to the `DateField` trigger — **new behavior; no existing modal in this codebase currently does this,** so it must be built and tested explicitly, not assumed to "just work."
- Screen-reader announcements: an `aria-live="polite"` region (using the existing `visuallyHidden` style from `ui/styles.ts`) announcing the current month/year on navigation and the selected date on commit, using `formatDateOnlyForA11y` (never the ambiguous `MM/DD/YY`).
- Disabled/read-only/loading: `DateField` must respect the same `disabled` semantics `EditableMetaTextField` already has (`!canEditProject` in `project-meta-editor.tsx`), and additionally must not open the popover at all while a save is in flight for that field (`savingTaskIds[id]`/equivalent), to prevent overlapping commits.
- No mouse-only interaction: every action (day select, Today, Clear, month/year change, close) must have a keyboard equivalent — a hard requirement given none of this exists today to fall back on.

---

## 12. Test matrix (Step 9)

### Pure unit tests (`*.test.ts`, Vitest, `node` environment — matches existing convention, no jsdom needed)

- `lib/tasks/date-only.ts`: `isValidDateOnly` (valid/invalid formats, leap-year Feb 29 valid/invalid, out-of-range month/day), `compareDateOnly`, `todayDateOnly` (mockable clock), `formatDateOnlyForDisplay`/`formatDateOnlyForA11y` (fixed known dates), no-timezone-shift round-trip test (`parse -> format -> parse` stable across simulated `TZ` env values if feasible in Node, or at minimum across explicit UTC-anchored fixtures).
- Regression tests for **existing** `parse-deadline.ts`/`format-deadline.ts` (currently untested — recommended regardless of the picker, since the picker's correctness depends on not silently inheriting Risk 1/2 from §6): leap year, month boundaries (Jan 31 → Feb), year boundaries (Dec 31 → Jan 1), far-future (year 2099+), far-past (if allowed), and explicit **no-day-shift** assertions for `buildLocalDate`/`formatDeadline` given fixed UTC-offset scenarios.
- CSV/clipboard formatting, if changed per Open Question 4.

### Component tests

**Not currently possible without adding jsdom + a component-testing library** — `vitest.config.ts` is `environment: "node"`, `include: ["**/*.test.ts"]` only, and no `@testing-library/react`/jsdom is installed. This repo's established pattern (seen repeatedly in prior sessions' work) is to **extract pure logic into a sibling `.ts` module and test that directly**, rather than render components. Recommendation: follow the same pattern — keep `Calendar`'s date-grid-generation logic (which days appear in a given month view, including leading/trailing days) as a pure, exported, testable function separate from the JSX, and test *that* as a unit test. True DOM-interaction tests (click a day, press Escape, tab order) genuinely need either (a) adding `jsdom` + `@testing-library/react` as a new dev dependency (a real, explicit decision — Open Question 6), or (b) End-to-end tests instead.

### Integration tests

- `updateProjectField`/`updateTaskField` orchestration: commit → optimistic update → success (existing pattern, already partially covered implicitly by existing dashboard-client tests if any exist — confirm during Phase C) and → failure → rollback, using the *new* `DateOnly | null` value shape instead of a free-text string.
- Save path integration: a committed `DateOnly` value reaches `/api/projects/update`/`/api/tasks/update` unchanged and round-trips through `parseDeadline`/`::date` without shifting (this is where a regression in Risk 1 would first become visible).

### End-to-end tests

No E2E framework (Playwright/Cypress) was found installed in this repository. If E2E coverage is desired for opening the picker, navigating months/years, selecting a day, Today, Clear, Escape, click-outside, and keyboard navigation, adding one is a separate, explicit decision (Open Question 7) — not assumed available.

### Manual QA (explicit checklist for the phase that implements this)

- Desktop Chrome/Firefox/Safari, mobile Safari (iOS) and Chrome (Android): open/close, day selection, Today, Clear, Escape, click-outside, month/year jump to a date >5 years out and >5 years in the past, leap-year Feb 29 selectable, keyboard-only full flow (no mouse), screen reader pass (VoiceOver + one Windows screen reader) announcing month changes and selection, viewport-edge collision (open the field near the right/bottom edge of the window), existing save/loading/error toasts still fire correctly, existing production project with a previously-saved deadline displays the *correct* day (cross-check against the raw DB value, specifically to catch Risk 2 regressions), orientation change on mobile mid-interaction.

---

## 13. Phased implementation plan (Step 10 — plan only, not executed)

### Phase A — Shared date-only utilities and contracts

- New files: `lib/tasks/date-only.ts` (+ `lib/tasks/date-only.test.ts`).
- No existing files modified in this phase if scoped strictly to new utilities; **however**, fixing Risk 1/2 (§6) properly likely belongs here too, since the picker's correctness depends on them — if so, modified files would include `lib/tasks/parse-deadline.ts`, `lib/tasks/format-deadline.ts`, and their (currently nonexistent) new test files. This should be an explicit, separate decision/commit from "add new utilities," since it changes existing, currently-shipping behavior.
- Risks: none for the new-utilities-only sub-phase (purely additive). The Risk-1/2 fix sub-phase carries real risk (changes what gets persisted/displayed for existing flows) and should get its own careful review, ideally as its own follow-up task, not bundled into "add a date picker."
- Verification: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`.
- Isolatable commit: Yes, cleanly, especially if the Risk-1/2 fix is deferred to its own follow-up task.

### Phase B — Reusable calendar/date field primitives

- New files: `app/components/dashboard/ui/calendar/calendar.tsx`, `date-grid.ts` (pure grid-generation logic, unit-tested per §12), `month-year-select.tsx`, `date-picker-popover.tsx`, `date-field.tsx`, plus `.test.ts` for the pure grid logic.
- No product surface wired up yet — this phase should be independently reviewable/mergeable as "infrastructure with no user-visible change."
- Risks: accessibility correctness (focus trap, focus return, keyboard grid nav) is genuinely hard to get right and has zero existing in-repo reference implementation — budget real review time here.
- Verification: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, manual keyboard/screen-reader pass on a throwaway harness page.
- Isolatable commit: Yes.

### Phase C — First controlled integration: primary Task CRM project deadline field

- New file: `app/components/dashboard/tasks/deadline-field.tsx`.
- Modified files (best estimate): `app/components/dashboard/tasks/project-meta-editor.tsx` (swap `EditableMetaTextField`'s deadline variant for `DeadlineField`), possibly `app/components/dashboard/tasks/task-types.ts` if `ProjectEntity.deadline_date`'s type needs tightening to the new `DateOnly` alias.
- Risks: this is the highest-visibility surface (the one in the product requirement's screenshot); optimistic-update/rollback wiring must be verified not to regress; must confirm `updateProjectField`'s existing `(id, field, value: string)` contract still fits (`DateOnly` is a `string`, so no signature change should be needed) or make a deliberate, documented decision to change it to accept `string | null` directly instead of relying on `""`-means-clear.
- Verification: full suite (`npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`) + manual QA checklist (§12) focused specifically on this surface, plus explicit before/after screenshots for product sign-off.
- Isolatable commit: Yes, and should be its own PR/commit separate from Phase D/E so it can be rolled back independently if an issue surfaces in production.

### Phase D — Subtask deadline integration

- **This is net-new UI, not a conversion** (§3.1 — no subtask deadline is currently editable anywhere).
- Likely new/modified files: `app/components/dashboard/tasks/mobile-task-card.tsx` (`MobileSubtaskRow`), `app/components/dashboard/tasks/desktop-tasks-table.tsx` (subtask row rendering), possibly a new shared subtask-row deadline slot component if desktop/mobile diverge enough to need one.
- Risks: needs explicit product confirmation this is even wanted before building (see Open Question 8) — it is a scope expansion beyond "replace the existing field," not a pure refactor.
- Verification/commit isolation: same shape as Phase C.

### Phase E — Remaining creation, extraction, review, and modal surfaces

- Modified files (best estimate): `app/components/dashboard/extract/ai-project-review-panel.tsx` + `app/components/dashboard/extract/project-preview-presentation.tsx` (Extract review), `app/components/dashboard/tasks/project-updates/project-update-review-card.tsx` (Client Updates review). Homepage-demo (`app/homepage-demo/review/HomepageDemoReviewPanel.tsx`) explicitly **excluded unless product opts in** (Open Question 9) — it is a separate pre-signup codebase area with its own persistence path.
- Risks: each surface has its own save-timing/optimistic-update model (Extract review saves in a batch at the end; Client Updates review has an "apply" step; these are not identical to the Task CRM's per-field autosave) — `DeadlineField`'s `onCommit` contract must be verified to fit each, not assumed identical.
- Verification/commit isolation: recommend one commit per surface, not one combined commit, given the differing save models.

### Phase F — Tests, browser QA, mobile QA, lint, type-check, build, release verification

- Finalize/expand the test matrix from §12 across all integrated surfaces.
- Full command set: `npx vitest run`, `npx tsc --noEmit`, `npx eslint <changed files>`, `npm run lint`, `npm run build`, `git diff --check`, plus the full manual QA checklist (§12) run once end-to-end across every integrated surface, not just Phase-by-phase.
- Rollback consideration: because each prior phase is its own isolated commit touching a distinct surface, rollback can be scoped to a single phase (e.g., revert Phase D without touching Phase C) if a regression is found post-release — this is the primary reason the phased, per-surface commit structure is recommended over one large change.

**No phase should leave a permanently-duplicated deadline-editing implementation behind.** Phase E is scoped explicitly to close out the three remaining duplicated free-text implementations identified in §3.1; if Phase E is deferred, that should be a tracked, deliberate decision (Open Question 10), not a silent abandonment leaving mixed old/new UI indefinitely.

---

## 14. Exact anticipated file list

**New files:**
- `lib/tasks/date-only.ts`, `lib/tasks/date-only.test.ts`
- `app/components/dashboard/ui/calendar/calendar.tsx`
- `app/components/dashboard/ui/calendar/date-grid.ts`, `date-grid.test.ts`
- `app/components/dashboard/ui/calendar/month-year-select.tsx`
- `app/components/dashboard/ui/calendar/date-picker-popover.tsx`
- `app/components/dashboard/ui/calendar/date-field.tsx`
- `app/components/dashboard/tasks/deadline-field.tsx`

**Likely modified files (by phase):**
- Phase A (conditional): `lib/tasks/parse-deadline.ts`, `lib/tasks/format-deadline.ts`
- Phase C: `app/components/dashboard/tasks/project-meta-editor.tsx`, possibly `app/components/dashboard/tasks/task-types.ts`
- Phase D: `app/components/dashboard/tasks/mobile-task-card.tsx`, `app/components/dashboard/tasks/desktop-tasks-table.tsx`
- Phase E: `app/components/dashboard/extract/ai-project-review-panel.tsx`, `app/components/dashboard/extract/project-preview-presentation.tsx`, `app/components/dashboard/tasks/project-updates/project-update-review-card.tsx`

**Not expected to require changes:** any file under `app/api/**`, any file under `supabase/migrations/**`, `lib/extraction/**`, `lib/task-suggestions/**` (these only ever produce/consume `deadline_text`, unaffected by a UI-layer change to how a date gets *entered*).

---

## 15. Open questions requiring product approval

1. **Dependency decision:** build the calendar/positioning logic fully in-house (zero new dependencies, more engineering time, full control matching the existing hand-rolled design system) vs. adopt a small library (`react-day-picker` + `date-fns`, or a headless positioning engine like `@floating-ui/react`) to de-risk accessibility/collision-detection correctness. Both are viable; this mapping does not assume an answer.
2. **Historical data quality:** should we run a one-time audit query comparing `deadline_text` against `deadline_date` for rows where the two appear inconsistent (a heuristic for "may have been shifted by Risk 1/2 historically")? This is a data question, not a schema migration, and is optional.
3. **Manual typing:** should the new `DateField` also accept typed keyboard input (e.g. typing `"2027-01-20"` directly instead of always clicking through the calendar), or become click/tap-only with the calendar as the sole entry mechanism? Natural-language typing ("next Friday") is a real, currently-used product feature (AI extraction ergonomics) — should it be preserved as a *separate* input mode alongside the picker, or retired for the fields converted to the new picker?
4. **CSV/clipboard format:** should `format-deadline.ts`'s output (and therefore CSV export and "copy task" text) move from ambiguous `MM/DD/YY` to unambiguous `YYYY-MM-DD` or `"Jan 20, 2027"` to match the new picker's display convention? This affects existing exports/integrations users may already depend on.
5. **Internationalization:** is English-only month naming acceptable for the foreseeable future, or should locale-aware month names be scoped into an early phase given Text2Task explicitly serves international users?
6. **Test infrastructure:** is adding `jsdom` + `@testing-library/react` (or equivalent) acceptable to enable true component-level interaction tests for the picker, given the current test setup cannot render `.tsx` components at all? Without it, picker interaction correctness relies entirely on manual QA and pure-logic unit tests.
7. **End-to-end coverage:** is investing in an E2E framework (e.g. Playwright) in scope for this feature, given none exists today?
8. **Subtask deadlines:** confirm this is genuinely wanted as new UI (Phase D), since no subtask deadline is editable anywhere today — is this an assumed requirement from the task prompt, or should it be validated with users first?
9. **Homepage demo surface:** should the pre-signup homepage-demo review flow (`HomepageDemoReviewPanel.tsx`) also get the new picker, or is it acceptable for it to remain on free text indefinitely as a lower-priority, separate surface?
10. **Phase E timing:** if Phase E (closing out the remaining duplicated implementations) is not done in the same release cycle as Phase C, is it acceptable to temporarily have both the old free-text pattern and the new picker live simultaneously on different surfaces, and is there a tracked commitment to complete Phase E rather than let it linger?

---

## 16. Explicit assumptions made during this mapping

- The Postgres session/database timezone for this Supabase project is UTC (the near-universal default for hosted Supabase projects) — **not directly confirmed** via any file in this repository (no `SET timezone` statement or project-level timezone config was found in `supabase/migrations/`). If it is not UTC, Risk 1/2 in §6 are worse than described, since an additional conversion layer would apply at the `::date` cast step.
- The Next.js API routes' Node.js server runtime executes in UTC in production (standard for Vercel and most container platforms) — also not directly confirmed from repository files (no `TZ` environment variable setting found in this repo; it would be set at the hosting-platform level, outside this repository).
- "The primary Task CRM project deadline field shown in the screenshot" (Phase C target, per the task instructions) is interpreted as `project-meta-editor.tsx`'s `EditableMetaTextField` (`variant="deadline"`), based on it being the only surface matching "editable deadline field displaying a value like `2027-01-20`" in the main dashboard Task CRM area. No screenshot was available to this mapping session to confirm directly.
- `deadline_date`'s underlying Postgres column type (`date`) is inferred from consistent `::date` casting across every migration that writes it, since no `CREATE TABLE`/`ALTER TABLE ADD COLUMN` statement for it exists in the tracked migration history (the base schema predates tracked migrations).
- The homepage-demo review flow is treated as an explicitly separate, lower-priority surface based on it living in a distinct top-level route (`app/homepage-demo/`) with its own persistence layer (`lib/homepage-demo/`), not because product intent was confirmed either way.

---

## 17. Confirmation: no production code was modified

This session performed **read-only investigation** (Grep/Glob/Read tool calls) plus creation of this single new Markdown file. No `.ts`/`.tsx`/`.sql`/config/dependency file was created, edited, or deleted. No migration was run. No dependency was installed or upgraded. Nothing was committed or pushed.
