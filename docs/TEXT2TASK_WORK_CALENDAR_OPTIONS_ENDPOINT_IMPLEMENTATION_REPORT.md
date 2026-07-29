# Text2Task Work Calendar — Options Endpoint (Phase B) Implementation Report

Status: **Phase B only, per `docs/TEXT2TASK_WORK_CALENDAR_MANUAL_EVENTS_MAPPING.md` sections 5/9/10/20/21/23/26/28.** No UI, dialog, mutation, migration, or database schema work was performed. Nothing was committed or pushed.

---

## 1. Repository state before implementation

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD before this work | `3a353c1` — "Map Work Calendar manual events" |
| Previous commit | `888294c` — "Add read-only Work Calendar month view" |
| `git status --short` before starting | *(empty — clean)* |

The mapping commit (`3a353c1`) was present and the working tree was clean before any file was touched, satisfying the required precondition.

---

## 2. Files created / modified

**New files**
- `app/api/calendar/options/route.ts` — `GET /api/calendar/options` handler.
- `app/api/calendar/options/route.test.ts` — 25 focused tests.
- `lib/calendar/load-calendar-options.server.ts` — server-side options loader.
- `docs/TEXT2TASK_WORK_CALENDAR_OPTIONS_ENDPOINT_IMPLEMENTATION_REPORT.md` — this report.

**Modified files**
- `lib/calendar/calendar-types.ts` — additive only: `CalendarProjectOption`, `CalendarClientOption`, `CalendarOptionsResult`. No existing type's shape was touched (confirmed via `git diff --stat`: 38 insertions, 0 deletions).

**No other file was created, modified, or deleted.** No file outside the permitted list was found to be genuinely unavoidable.

---

## 3. Endpoint contract

```
GET /api/calendar/options?includeProjectId=<uuid>&includeClientId=<uuid>
```

- Both query parameters are optional. When present, each is validated with `z.string().uuid()` (Zod's own built-in UUID validator — not a hand-rolled regex, so no validation logic is duplicated). A syntactically malformed value for either parameter returns a generic `400 {error}` **before any Supabase query is issued for that value** (confirmed by test 2/3: `callLog` is empty on the malformed-UUID path).
- Auth: identical convention to every other Calendar route — `supabase.auth.getUser()`, `401 {error: "Unauthorized"}` on failure. Per this codebase's established ordering (matching `GET /api/calendar` and `POST /api/calendar/events`), query-shape validation runs before the auth check.
- Success: `200 {success: true, projects: CalendarProjectOption[], clients: CalendarClientOption[], projectsTruncated: boolean, clientsTruncated: boolean}`, with `dashboardTasksNoStoreHeaders` (the same shared constant every other Calendar route already reuses).
- Failure: `{error: string}` at `400`/`401`/`500`, matching the exact shape and status-code conventions of every other Calendar route.

---

## 4. Query fields and filters

### Projects (normal query)
```sql
select id, title, is_archived, client_id, clients ( id, name )
from projects
where user_id = :userId
  and deleted_at is null
  and (is_archived = false or is_archived is null)
order by title asc
limit 201  -- OPTIONS_LIMIT + 1
```
- Scoped to `user_id` (test 4).
- Excludes soft-deleted projects via `.is("deleted_at", null)` (test 5).
- Excludes archived projects via `.or("is_archived.eq.false,is_archived.is.null")` (test 6) — the OR form, not a bare `.eq("is_archived", false)`, is required because SQL's three-valued logic makes `NULL = false` evaluate to `NULL`/not-true, which would silently drop any legacy row with no `is_archived` value set. This is the exact, already-established pattern reused verbatim from `lib/calendar/load-unscheduled-projects.server.ts` and `lib/calendar/load-calendar-range.server.ts` — not a new convention invented for this endpoint.
- Not filtered by deadline, task/subtask data, or completion/`Done` status — confirmed by direct code reading that `is_archived` is a genuinely separate boolean column from `status`, with no evidence anywhere in the repository that "archived" and "Done" are ever treated as synonyms.
- Orders by `title` ascending (test 7) — a small, deliberate deviation from every other project query in this codebase (which order by `created_at desc`), justified in the mapping (§10/§11) because this is the first project list a user scans alphabetically by name rather than browses chronologically.
- Selects only the columns `CalendarProjectOption` needs, plus the embedded `clients ( id, name )` relation (mirroring the exact join syntax already used in `app/api/projects/update/route.ts`'s `reloadProject`, not the `clients:clients(...)` alias form used by `CALENDAR_EVENT_SELECT`, since that alias exists in `calendar_events` for reasons specific to that table).

### Clients (normal query)
```sql
select id, name
from clients
where user_id = :userId
order by name asc
limit 201  -- OPTIONS_LIMIT + 1
```
- Scoped to `user_id` (test 4).
- **No `deleted_at`/`is_archived` filter** — a dedicated research pass (recorded in the mapping, §10) confirmed no such column is exercised anywhere in this codebase's current schema or query conventions. Inventing one would have been exactly the kind of unsafe, unverified assumption this task explicitly forbids.
- Orders by `name` ascending (test 8).

### Active / archived / deleted behavior, precisely
- A **normal** project row is active: not soft-deleted, not archived.
- An **included** (`includeProjectId`) project is allowed to be archived — the same-session single-row lookup (`loadIncludedProjectOption`) filters `deleted_at IS NULL` but never `is_archived`, because `validateCalendarEventLinks` (the existing write-path guard, confirmed by direct code reading of `lib/calendar/calendar-link-validation.server.ts`) also never rejects an archived project — an event can already be linked to one today, so the options endpoint must still return it, with its real `isArchived` value, so an edit-mode picker stays correct.
- A genuinely soft-deleted project is never returned, in either the normal query or the included lookup.
- Clients have no archived/deleted concept in this codebase today, so none is applied anywhere.

---

## 5. `OPTIONS_LIMIT + 1` truncation mechanism

`OPTIONS_LIMIT = 200` is a single exported constant in `lib/calendar/load-calendar-options.server.ts`. Both normal queries request `OPTIONS_LIMIT + 1` (201) rows in one query — no second, separate exact-`COUNT` query is ever issued (confirmed by test 21, which asserts the mock's `.count()` method — deliberately present and observable, not merely absent — is never invoked).

```ts
const projectRowsRaw = (projectRows ?? []) as ProjectOptionRow[];
const projectsTruncated = projectRowsRaw.length > OPTIONS_LIMIT;
const projects = projectRowsRaw.slice(0, OPTIONS_LIMIT).map(normalizeProjectOptionRow);
```

- `projectsTruncated`/`clientsTruncated` are computed from the **raw returned row count**, before any application-level filtering (e.g. a client row with a missing name, §6) — so the flag always reflects genuine database volume, never an artifact of this endpoint's own defensive normalization.
- The normal array is always sliced to exactly `OPTIONS_LIMIT` (200) before normalization, so the 201st row (when present) is only ever used to compute the boolean — it is never shipped to the client as a 200th-plus "normal" option (tests 11/12/13a/13b).

---

## 6. Included-value (`includeProjectId`/`includeClientId`) ownership behavior

Each included id, when supplied and syntactically valid, triggers one **separate, single-row, ownership-validated** lookup (`.eq("id", ...).eq("user_id", userId)...single()`) — issued only **after** the normal query has already been run and sliced to 200:

- **Owned, in-window** (already present in the sliced normal 200): the included lookup still runs, but the result is de-duplicated by `id` before appending — never a duplicate entry (test 14).
- **Owned, archived, or outside the normal 200-row window**: appended once, with its real field values (test 15/16).
- **Foreign or nonexistent** (fails the `user_id` ownership check, or the row doesn't exist): the Supabase `.single()` error carries `code: "PGRST116"` (this repository's own existing convention for "no matching row," reused verbatim from `app/api/projects/update/route.ts` and `app/api/tasks/update/route.ts`) — `isNotFoundError()` recognizes exactly this code and the value is **silently omitted**, with **no distinguishable status code or message** ever returned to the caller, so a request can never learn whether a given id exists at all (tests 17/18) — satisfying the "never leak whether a foreign id exists" requirement.
- **A genuine database/connection error** on that same single-row lookup (any error **without** the `PGRST116` code) is explicitly **not** treated as "not found" — it produces a controlled `500 {error}` instead of being silently swallowed (test 20b). This distinction — not-found vs. real error — is the one piece of this endpoint with no exact precedent elsewhere in the codebase (the existing `validateCalendarEventLinks` collapses both into a single `404`, which is correct for *that* write-path use case but was explicitly wrong to reuse here, since a silent-omission read path must never conflate "the id doesn't belong to you" with "the database is unreachable").
- **Included values never alter `projectsTruncated`/`clientsTruncated`** (test 19) — those flags describe only the normal query's own result.
- The true maximum response size is therefore 200 per type normally, and at most 201 per type in the one edge case where the normal set is already truncated to 200 and a separately-included linked value also falls outside it.

---

## 7. Normalization strategy

- `normalizeProjectOptionRow` / `normalizeClientOptionRow` are small, explicit, typed functions — no `as any`, no `@ts-ignore`, no ESLint suppression anywhere in either new file (confirmed by `npx eslint` below).
- The one `as ProjectOptionRow[]` / `as ClientOptionRow[]` cast per query result is the exact same pattern already used throughout this codebase's calendar repository layer (`lib/calendar/load-calendar-range.server.ts`, `lib/calendar/load-unscheduled-projects.server.ts`) — a single, narrow, typed structural cast from `Record<string, unknown>[]` to a locally-declared row type, not `any` and not a blanket unsafe cast of the whole client.
- The project→client embedded relation is normalized via the existing, shared `normalizeEmbeddedRelation` helper (`lib/supabase/joined-row.ts`) — reused as-is, not reimplemented, since Supabase reports a to-one embed as either a bare object or a single-element array depending on inferred cardinality.
- A project row with a missing `title` falls back to `"Untitled project"` — reusing the exact, already-established convention for this exact column (`load-unscheduled-projects.server.ts`, `load-calendar-range.server.ts`), not a new invented fallback.
- A client row with a missing/blank `name`, by contrast, is **rejected outright** (filtered out of the result), not given a fabricated placeholder — `CalendarClientOption.name` is a required, non-nullable string with no established "Untitled client" precedent anywhere in this codebase, and inventing one would present fake data as real inside a picker the user trusts to link the correct client. This is the one place normalization actively omits a row rather than defaulting a field, satisfying "malformed rows must not be silently converted into misleading options."
- `isArchived` normalizes via `row.is_archived === true` — only an explicit `true` ever reports as archived; `false`, `null`, and `undefined` all normalize to "not archived," matching the same nullable-boolean convention already relied on by the `is_archived.eq.false,is_archived.is.null` filter used elsewhere in this feature.

---

## 8. Error behavior

- Both normal queries (`projects`, `clients`) fail the **entire** request on any error — there is no partially-successful response; a `projects` query error returns `500` immediately, before the `clients` query is even attempted (test 20a).
- An included-lookup error is distinguished from "not found" as described in §6, and also fails the whole request rather than silently omitting the value (test 20b).
- All error responses use this codebase's exact existing shape (`{error: string}`) and status-code conventions (`400`/`401`/`404`-never-used-here-since-omission-replaces-it/`500`).
- The route's outer `try`/`catch` mirrors every other Calendar route exactly (`console.error` + a generic `500` fallback for anything unexpected).

---

## 9. Security review

- **Ownership**: every `projects`/`clients` lookup — normal and included — is explicitly `.eq("user_id", userId)`-scoped, never relying on RLS alone, matching the universal repository convention (confirmed present in every one of the four existing files read for this implementation).
- **No existence leakage**: a foreign/nonexistent included id produces the exact same response shape as an id that was never supplied at all — no status-code, message, or timing-observable difference is introduced by this implementation (no artificial delay was added or removed; the single-row query cost is the same whether the row exists and belongs to another user or doesn't exist at all).
- **No unbounded query**: both normal queries are capped at `OPTIONS_LIMIT + 1` (201) rows; both included lookups are single-row (`.single()`).
- **No new write path**: this endpoint only reads (`select`); it never inserts, updates, or deletes.
- **No client-side Supabase access**: this is a server-only route (`app/api/.../route.ts` + a `.server.ts` repository module); no browser code was added or touched.
- **No duplicated validation logic**: UUID format validation reuses Zod's own `.uuid()` validator (the same library and idiom already used by `lib/calendar/calendar-schemas.ts`'s `UuidSchema`), not a hand-rolled regex; the not-found-vs-error distinction reuses this codebase's own existing `PGRST116` convention (`app/api/projects/update/route.ts`, `app/api/tasks/update/route.ts`), not a new one invented for this endpoint.

---

## 10. Test coverage

`app/api/calendar/options/route.test.ts` — **25 tests, all passing**, covering the full 23-point required list (two concepts — the 200/201 client-side truncation pair, and the not-found-vs-real-error distinction on included lookups — were each given two focused `it()` blocks rather than one, for clarity; nothing in the list was left uncovered):

1. Unauthenticated → 401.
2. Malformed `includeProjectId` → 400, zero queries issued.
3. Malformed `includeClientId` → 400, zero queries issued.
4. Both project and client queries are `user_id`-scoped.
5. Normal projects exclude soft-deleted rows.
6. Normal projects exclude archived rows.
7. Projects ordered by `title` ascending.
8. Clients ordered by `name` ascending.
9. Project option shape: `id`/`title`/`clientId`/`clientName`/`isArchived`.
10. A project with no client returns `null` client fields.
11. Exactly 200 normal projects → 200 returned, `projectsTruncated: false`.
12. Exactly 201 normal projects → query `.limit(201)`, 200 returned, `projectsTruncated: true`.
13. Equivalent 200/201 pair for clients.
14. An owned, already-listed included project is not duplicated.
15. An owned, archived included project is appended with `isArchived: true`.
16. An owned included project outside the first 200 is appended.
17. A foreign/nonexistent `includeProjectId` is silently omitted.
18. A foreign/nonexistent `includeClientId` is silently omitted.
19. An appended included value never changes the truncation flags.
20. A genuine database error — both on the normal query and on an included lookup — returns a controlled 500, never a silent omission.
21. No exact-count query is ever issued (asserted against an observable, callable mock method, not mere absence).
22. The success response carries the exact `dashboardTasksNoStoreHeaders`.
23. Existing Calendar types/APIs remain unchanged — verified by (a) `git diff --stat` showing `calendar-types.ts` as purely additive (38 insertions, 0 deletions) and (b) the complete pre-existing test suite run unmodified in §11 below.

---

## 11. Verification results

| Command | Result |
|---|---|
| `npx vitest run app/api/calendar/options/route.test.ts` | **25/25 passed** |
| `npx vitest run` (full suite) | **751/752 passed**, 1 pre-existing failure — see note below |
| `npx tsc --noEmit` | Clean, zero errors |
| `npx eslint app/api/calendar/options/route.ts app/api/calendar/options/route.test.ts lib/calendar/load-calendar-options.server.ts lib/calendar/calendar-types.ts` | Clean, zero warnings/errors |
| `npm run lint` (full project) | Clean, zero warnings/errors |
| `git diff --check` | Clean (only a benign LF→CRLF line-ending notice, not a whitespace violation) |
| `git status --short` | `M lib/calendar/calendar-types.ts`, `?? app/api/calendar/options/`, `?? lib/calendar/load-calendar-options.server.ts` — nothing else |
| `git diff --stat` | `lib/calendar/calendar-types.ts \| 38 ++++...` — 1 file changed, 38 insertions(+), 0 deletions(-) |

**Pre-existing, unrelated failure (as originally observed during this Phase B verification pass)**: `app/components/dashboard/ui/calendar/date-field.test.tsx` → `"selecting a different day commits exactly once and closes the popover"` failed with `Error: No calendar day cell found for 2026-08-02`. This file was not created, modified, or touched by this implementation in any way (confirmed by `git status --short` above — it does not appear). Re-running it in isolation reproduced the identical failure, confirming it was not order-dependent or caused by this work. The test computed a target date via `offsetFromToday(3)`; with today's date near the end of a month, that landed in the following month, and the test's `getDayCellButton` helper looked for the day cell in the currently-displayed month grid without first navigating forward — a pre-existing, date-dependent test defect unrelated to the Work Calendar options endpoint. Fixing it was out of Phase B's own scope (no unrelated refactor); it was addressed in a separate, subsequent, test-only corrective pass — see the **Final verification addendum (§13)** below for that pass and its result.

---

## 12. Explicit confirmations

- **No UI, dialog, mutation, migration, or database work was performed.** `ResponsiveDialog`, the nested-overlay infrastructure, the Manual Event form, the Add Event button, Edit/Delete UI, client-side options caching, `mutate-calendar-event.client.ts`, `calendarDataVersionRef`/mutation reconciliation, the existing `POST`/`PATCH`/`DELETE` Manual Event routes, and `WorkCalendarClient` were all left completely untouched — confirmed by `git status --short` in §11 listing only the three Phase B files plus this report.
- **No database migration or schema change was made or proposed.** `supabase/migrations/` was not touched.
- **Nothing was committed or pushed.** No `git commit`, `git push`, or `npm run build` was run at any point during this implementation.

---

## 13. Final verification addendum

This section is additive documentation only, added after §§1–12 were originally written; it does not alter the historical record above of what the original Phase B verification pass found.

- The original Phase B full-suite run, recorded in §11, reported **751/752** passing because of a **pre-existing, date-dependent failure** in `app/components/dashboard/ui/calendar/date-field.test.tsx` — a file this Phase B implementation never created, modified, or touched.
- That failure was a **test defect, not an application defect or a Phase B defect**: the test derived its target date via a fixed `+3-day` offset from the real current date, which crosses into the next month whenever "today" falls near month-end, while `DateField`'s underlying `Calendar` (opened with `value={null}`) still displays the current month's grid.
- This unrelated test defect was subsequently corrected in a **separate, test-only pass**, scoped to exactly one file: `app/components/dashboard/ui/calendar/date-field.test.tsx`. The correction added a small local helper that instead chooses a genuinely different date **guaranteed to remain inside the currently displayed month** (day 1 of the current month, or day 2 when today already is day 1) — deterministic across every day of the month, every month/year boundary, every leap year, and every local timezone, using the same local, noon-anchored `Date` arithmetic convention already established elsewhere in that file (never UTC/`.toISOString()`).
- **No Phase B implementation file was modified by that correction.** `app/api/calendar/options/route.ts`, `app/api/calendar/options/route.test.ts`, `lib/calendar/load-calendar-options.server.ts`, and `lib/calendar/calendar-types.ts` were all confirmed unchanged by that pass (verified via `git status --short` at the time, which listed only `app/components/dashboard/ui/calendar/date-field.test.tsx` as modified, alongside this Phase B work that was already present as pending/untracked changes).
- Following that correction:
  - The targeted DateField suite now passes **18/18**.
  - The full repository suite now passes **752/752**.
  - `npx tsc --noEmit`, the targeted `npx eslint` run against the corrected file, the full `npm run lint`, and `git diff --check` all remain clean.
- The DateField test correction **will be committed separately from Phase B** — it is a distinct, unrelated fix living in a different file, not part of this endpoint's implementation, and is not bundled into any Phase B commit.
- As of this addendum, **nothing has been committed or pushed yet** — Phase B and the DateField correction both remain uncommitted, exactly as left by their respective implementation passes.

Read together, §11's original **751/752** figure and this section's current **752/752** figure describe the same repository at two different points in time: the moment Phase B's own verification first ran (which is when the pre-existing, unrelated failure was first observed and documented), and the moment after the separate corrective pass resolved it. Phase B itself was correct and complete at 751/752 — the one failure was never attributable to this endpoint's implementation.
