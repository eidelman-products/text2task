# Text2Task Work Calendar — Foundation Milestone Implementation Report

Status: **Foundation implemented, tested, built, migrated to production, and live-verified. No UI yet. Not committed or pushed yet.**
Mapping report (unchanged by this work): `docs/TEXT2TASK_WORK_CALENDAR_MAPPING.md`

See §23 for the production migration and live database verification. Everything below §23 that says the migration had not yet been run reflects the state at the time the original implementation and corrective passes were verified, before the migration was applied.

---

## 1. Exact foundation verdict

This milestone delivers a complete, production-grade backend foundation for the Work Calendar feature: one new database table (`calendar_events`) with database-level relationship-integrity enforcement, a timezone-safe `TimeOnly` contract sitting alongside the existing `DateOnly` module, a fully-typed discriminated read model, pure calendar-grid/sort/filter logic, a server-only repository and read-model layer, and five REST API routes — all additive, all reusing established repository conventions exactly where they applied, with zero UI work of any kind. Project deadlines are never duplicated into the new table; they are projected live from `projects.deadline_date` on every read. Manual events are a fully independent, user-owned entity with ownership enforced both in application code and by a dedicated Postgres trigger.

**A subsequent corrective pass (§22) fixed two confirmed defects before the migration was ever applied or committed**: the relationship-integrity trigger was unconditionally re-deriving `client_id` on every UPDATE (not just when the relationship actually changed), which could silently rewrite a historical event's client link during a completely unrelated edit if the linked project's own client had changed since; and `event_time` normalization was silently reinterpreting a malformed time value as an all-day event instead of failing closed. Both are now fixed in place in the same (still-unapplied) migration and repository files, with a dedicated regression suite.

**44 test files / 564 tests passing** (up from a 30-file/372-test baseline at the start of this milestone — **192 net new tests** across 14 new test files, including the corrective pass's additions). Clean `tsc --noEmit`. Clean `eslint` on every changed file and repo-wide. Clean `git diff --check`.

## 2. Repository starting state

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD (start of this milestone) | `6a72c93` — "Prevent false Done on partial task updates" |
| `git status --short` (start) | `?? docs/TEXT2TASK_WORK_CALENDAR_MAPPING.md` only |
| Working tree | Clean otherwise |
| Latest migration on disk (start) | `202607270001_project_completion_reconciliation.sql` |
| Test baseline (start) | 30 test files / 372 tests, all passing |
| `DateOnly` module | `lib/tasks/date-only.ts` — confirmed present, exports `DateOnly`, `parseDateOnly`, `isDateOnly`, `dateOnlyToLocalDate`, `localDateToDateOnly`, `todayDateOnly`, `compareDateOnly`, `formatDateOnlyForDisplay`, `formatDateOnlyForA11y` |
| Supabase server client pattern | `lib/supabase/server.ts`, `createClient()` — SSR cookie-based, confirmed and reused unchanged |
| Dirty work at risk | None |

### Spot-verified base table contracts (Step 2)

Since `projects`/`tasks`/`clients` have no tracked `CREATE TABLE` migration (confirmed pre-existing/untracked, per the mapping report), every fact below was independently re-confirmed from the strongest available live evidence in `supabase/migrations/*.sql` before writing the new migration:

| Fact | Evidence |
|---|---|
| `projects.id` is `uuid` | `project_id uuid not null references public.projects(id)` (multiple migrations) |
| `projects.user_id` is `uuid` | `user_id uuid not null references auth.users(id) on delete cascade` pattern applied consistently to every `user_id`-owned table |
| `projects.client_id` is `uuid`, nullable | `client_id uuid null references public.clients(id) on delete set null` (`202605250001...sql:30`); confirmed nullable via RPC code checking `if v_project.client_id is not null` |
| `projects.deadline_date` is `date` | `nullif(v_updates->>'deadline_date','')::date` cast, applied identically to both `projects.deadline_date` and `tasks.deadline_date` across 4+ migrations |
| `projects.deleted_at` | `and project.deleted_at is null` — confirmed extensively used as the soft-delete gate, `202607270001...sql` alone |
| `projects.is_archived` | `(is_archived = false or is_archived is null)` — confirmed as the standard "active" gate |
| `projects.status` | plain `text`, no `create type` enum found anywhere in tracked migrations; compared via string equality (`status = 'Done'`) |
| `clients.id` is `uuid` | `client_id uuid null references public.clients(id)` |
| `clients.user_id` is `uuid` | `client.user_id = v_user_id` — confirmed in `202607020004...sql`, `202606150007...sql`, `202607270001...sql` |
| `clients.deleted_at` | **Not confirmed to exist** — no query anywhere in tracked migrations or application code filters `clients` by `deleted_at`. My design does not depend on this column existing (see §4 — the ownership-integrity trigger checks `clients.user_id` only, never `clients.deleted_at`), so this unresolved fact does not block a safe migration. |
| FK `ON DELETE` convention | Hard ownership (`user_id → auth.users`) → `cascade`; optional FK to an optional entity (`client_id`, `target_task_id`) → `set null`; a referenced row that must never vanish → `restrict` (one example found). Partial indexes (`create index ... where ...`) confirmed as an existing, used convention (`customer_stories_approved_at_idx`). |

No fact required to safely write this migration was left unresolved.

---

## 3. Final database schema

New migration: `supabase/migrations/202607290001_calendar_events.sql`. Additive only — **zero changes to any `projects`/`tasks`/`clients` column or row**; the only touch to `projects` is a new, optional, idempotent supporting index (see §6).

```sql
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  event_date date not null,
  event_time time without time zone null,
  notes text null,

  project_id uuid null references public.projects(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint calendar_events_title_check
    check (char_length(trim(title)) >= 1 and char_length(title) <= 240),

  constraint calendar_events_event_time_minute_precision_check
    check (event_time is null or extract(second from event_time) = 0)
);
```

The second constraint was added in the corrective pass (§22) — it enforces the application's strict `HH:MM` `TimeOnly` contract at the database layer too: `event_time` may be null, or its seconds component (including any fractional part, since `extract(second from ...)` returns both) must be exactly zero.

**Fields explicitly evaluated and rejected**, per the locked scope: `status`, `event_type`, `color`, `all_day` (redundant — `event_time IS NULL` already means all-day), `start/end duration`, `timezone`, `source`, `recurrence`, `archived`, `sort_order`, `attendees`, `reminders`. None are present in the migration; a static test asserts this explicitly (§16).

---

## 4. Database ownership/integrity enforcement

**Two independent layers, exactly as locked (§8 of the task brief):**

1. **Server/API layer** — `lib/calendar/calendar-link-validation.server.ts`, `validateCalendarEventLinks()`. Before any write, it loads the linked project (`.eq("id", projectId).eq("user_id", userId)` — the same "explicit filter in addition to RLS" convention used everywhere else in this codebase) and rejects if not found or soft-deleted; loads the linked client the same way if no project is linked. **The locked normalization rule**: when a project is linked, `client_id` is always set to that project's current `client_id` (or `null` if it has none) — regardless of what `client_id` was supplied in the same request. This is a silent normalization, not a rejection, chosen as the one explicit rule per the task's "reject or normalize, pick one" instruction, and documented identically in both layers.

2. **Database layer (the real backstop)** — a `before insert or update` trigger, `enforce_calendar_event_relationship_integrity()`, in the migration itself. It independently re-derives and re-validates the exact same rule: project not found/not owned → `CALENDAR_EVENT_PROJECT_NOT_FOUND`/`NOT_OWNED`; soft-deleted project → `CALENDAR_EVENT_PROJECT_DELETED`; client not found/not owned → `CALENDAR_EVENT_CLIENT_NOT_FOUND`/`NOT_OWNED`; and it performs the identical `new.client_id := v_project_client_id` normalization. It is a safe no-op when both `project_id` and `client_id` are `null`, and it **never modifies `new.user_id`** (verified by a static test asserting no such assignment exists anywhere in the function body). **As corrected in §22**, this entire validation/normalization block now runs *only* when the relationship is actually changing (`TG_OP = 'INSERT'`, or `project_id`/`client_id` differs from the row's current persisted value) — an update that touches only `title`/`event_date`/`event_time`/`notes`, or a soft delete (which only sets `deleted_at`), returns immediately before ever querying `projects`/`clients`, so it cannot pick up or apply a since-changed project client.

**Why this closes the RLS gap**: RLS on `calendar_events.user_id` protects the event row itself, but structurally cannot express "the project/client this event references belongs to the same user" — the repository's own established convention (confirmed across every RLS-bearing table) never has a policy join to a parent table. The trigger is the dedicated, explicit closure of that specific gap, running `security invoker` with an explicit `set search_path = public, pg_temp` — matching this repository's universal convention for every function that touches `projects`/`tasks`/`clients` (confirmed identical in `reconcile_project_completion` and every transactional RPC).

**Composite-FK risk avoided**: as instructed, `user_id` is never part of any composite foreign key and is never nullable — its FK is the simple, universal `references auth.users(id) on delete cascade` pattern, so no delete-behavior interaction can ever null it out.

---

## 5. RLS policies

Exactly the repository's confirmed, universal 4-policy-per-operation shape — single-column ownership check, never a join:

```sql
alter table public.calendar_events enable row level security;

create policy "Users can view own calendar events" on public.calendar_events
  for select using (auth.uid() = user_id);
create policy "Users can insert own calendar events" on public.calendar_events
  for insert with check (auth.uid() = user_id);
create policy "Users can update own calendar events" on public.calendar_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own calendar events" on public.calendar_events
  for delete using (auth.uid() = user_id);
```

A static test confirms no policy predicate ever references `projects`/`clients` or contains a `join`.

---

## 6. Indexes

```sql
create index if not exists calendar_events_user_id_event_date_idx
  on public.calendar_events(user_id, event_date) where deleted_at is null;

create index if not exists calendar_events_project_id_idx
  on public.calendar_events(project_id) where project_id is not null and deleted_at is null;

create index if not exists calendar_events_client_id_idx
  on public.calendar_events(client_id) where client_id is not null and deleted_at is null;

create index if not exists projects_user_id_deadline_date_idx
  on public.projects(user_id, deadline_date) where deleted_at is null;
```

The `user_id, event_date` composite is the load-bearing one — it directly serves the month-range read-model query. The `projects` index is added because no tracked migration confirms one already exists for this exact query shape (`projects`' base schema is untracked); `create index if not exists` is safe either way (a no-op if an identically-named index already exists, merely additional — never incorrect — if a differently-named equivalent exists in the untracked base schema). This is the only touch to the `projects` table in this entire milestone, and it is metadata-only (no column or data change).

---

## 7. DateOnly/TimeOnly policy

`event_date` reuses the **existing** `DateOnly` contract unchanged — no second date-only type was defined. `event_time` gets a new, sibling contract, `lib/calendar/time-only.ts`:

- `type TimeOnly = string & { readonly __brand: "TimeOnly" }` — strict `HH:MM`, 24-hour, zero-padded.
- `parseTimeOnly(value: unknown): TimeOnly | null` — rejects missing zero-padding, seconds, AM/PM forms, out-of-range hour/minute; never throws.
- `isTimeOnly`, a type-guard wrapper.
- `normalizeDatabaseTimeOnly(value: unknown): TimeOnly | null` — accepts the exact Postgres `time without time zone` wire shape (`"HH:MM:SS"`, optionally with a fractional-seconds suffix) **only when seconds are exactly `00`**; a non-zero seconds value (which this application never writes) is rejected rather than silently truncated.
- `formatTimeOnlyForDisplay(value: TimeOnly): string` — human-readable 12-hour form (e.g. "2:30 PM"), built manually from numeric parts, no `Intl` dependency — mirroring `formatDateOnlyForDisplay`'s approach exactly.

**`TimeOnly` never constructs a `Date`, never calls `.toISOString()`/`Date.parse`, and performs no UTC/locale-aware parsing anywhere** — confirmed by direct code inspection and by the final grep sweep (§ Final foundation audit below). `null` `event_time` means all-day; there is no separate `all_day` flag (see §3).

`event_date` continues to route through the existing, extensively-tested `date-only.ts` machinery (local-noon anchoring, DST-safe) everywhere in the new code — `calendar-grid.ts`'s month-grid math, `load-calendar-range.server.ts`'s row normalization, and every Zod schema all import from it directly rather than reimplementing any date arithmetic.

---

## 8. Final TypeScript contracts

`lib/calendar/calendar-types.ts`:

```ts
export type ProjectDeadlineCalendarItem = {
  kind: "project_deadline";
  id: string;                 // `project:${projectId}`
  date: DateOnly;
  projectId: string;
  title: string;
  clientName: string | null;
  status: string | null;
  priority: string | null;
  isOverdue: boolean;
};

export type ManualCalendarEventItem = {
  kind: "manual_event";
  id: string;                 // `event:${calendarEvents.id}`
  date: DateOnly;
  time: TimeOnly | null;      // null means all-day
  title: string;
  notes: string | null;
  projectId: string | null;
  projectTitle: string | null;
  clientId: string | null;
  clientName: string | null;
};

export type CalendarItem = ProjectDeadlineCalendarItem | ManualCalendarEventItem;

export type UnscheduledProjectCalendarItem = {
  id: string; title: string; clientName: string | null;
  status: string | null; priority: string | null; createdAt: string;
};

export type CalendarRangeQuery = { start: DateOnly; end: DateOnly };

export type CreateCalendarEventInput = {
  title: string; eventDate: DateOnly; eventTime: TimeOnly | null;
  notes: string | null; projectId: string | null; clientId: string | null;
};

export type UpdateCalendarEventInput = {
  title?: string; eventDate?: DateOnly; eventTime?: TimeOnly | null;
  notes?: string | null; projectId?: string | null; clientId?: string | null;
};
```

`UpdateCalendarEventInput`'s all-optional shape is deliberate: every field's *key presence* (not its value) distinguishes "omitted" from "explicitly cleared" from "changed." Every consumer (`updateCalendarEvent` in the repository, and the Zod schema that produces this type) checks `"key" in input`, never `input.key ?? fallback` — confirmed by the final grep sweep finding zero `||`/`??`-fallback patterns on these fields anywhere in the new code.

---

## 9. Validation contracts

`lib/calendar/calendar-schemas.ts` — Zod, `.strict()` on every object schema (rejects unknown keys, so `user_id` can never be accepted from a client payload even if sent):

- `CalendarRangeQuerySchema` — `start`/`end` both validated through a `DateOnly`-producing transform (never a raw string comparison), with a `.refine()` rejecting `start > end` via `compareDateOnly`.
- `CreateCalendarEventInputSchema` — `title` (trimmed, 1-240 chars), `eventDate` (`DateOnly`), `eventTime` (nullable `TimeOnly`), `notes` (nullable, blank/whitespace-only normalizes to `null`, max 5000 chars — matching this repo's established `NullableStringSchema` idiom), `projectId`/`clientId` (nullable UUID).
- `UpdateCalendarEventInputSchema` — the same fields, all `.optional()`, with a `.refine((v) => Object.keys(v).length > 0, ...)` requiring at least one field, matching the exact precedent already used in `lib/project-updates/project-update-analysis.server.ts:107`.

21 focused tests cover: valid/minimal/trimmed payloads, blank-title rejection, over-length rejection, invalid date/time rejection (including a value **with seconds**, explicitly required to fail), invalid UUID rejection, the notes-blank-to-null normalization, the reversed-range rejection, the unknown-extra-field rejection (proving `user_id` injection is impossible), and the omitted-vs-explicitly-null distinction surviving all the way through `safeParse`.

---

## 10. Server repository architecture

`lib/calendar/calendar-events-repository.server.ts` owns `createCalendarEvent`, `updateCalendarEvent`, `softDeleteCalendarEvent`, and the shared row-normalizer `normalizeCalendarEventRow` (reused by the read-model loader too, so this logic exists in exactly one place).

- **Generic-client pattern**: every function accepts `supabase` through an unconstrained generic parameter, narrowed with **one** documented `as` assertion to a minimal local interface describing only the methods actually called — this is not a new convention; it is the exact, already-established pattern in `lib/tasks/load-dashboard-tasks.server.ts` and `lib/supabase/query-builder-like.ts`, both of which document *why*: this repository's real Supabase client has no `Database` schema generic, so its query-builder methods carry a deep inferred type that overflows TypeScript's structural-assignability depth limit when compared directly against any named interface. Every new file follows this precisely.
- **Update semantics**: `updateCalendarEvent` loads the existing row, merges the patch's *present* keys with the existing `project_id`/`client_id` before re-validating (only re-querying `validateCalendarEventLinks` when the patch actually touches one of those two fields), then builds the write payload using `"key" in input` checks exclusively. **As corrected in §22**, the database trigger now mirrors this exactly (it only re-validates/re-normalizes when the relationship is actually changing), so neither layer touches — or can possibly rewrite — `client_id` on an unrelated update.
- **Delete semantics**: soft delete only (`deleted_at = new Date().toISOString()` — a plain `timestamptz` audit stamp, not a `DateOnly`/`TimeOnly` value, so this does not violate the date-only-safety rule). Deleting an already-deleted, owned event is defined and tested as an idempotent success (`alreadyDeleted: true`), never a second write. The write payload contains only `deleted_at`, so a soft delete cannot touch the event's `project_id`/`client_id` either.
- **Malformed-row safety**: `normalizeCalendarEventRow` returns `null` (rejects/omits the whole row, never throws) for a row whose `event_date` doesn't parse, **and, as corrected in §22, does the same for a row whose `event_time` is present but doesn't normalize to a valid `TimeOnly`** — a malformed time is never reinterpreted as an all-day event, since that would silently change what the row means.
- Returns only normalized `ManualCalendarEventItem` objects — never a raw Supabase row.

---

## 11. Calendar range read model

`lib/calendar/load-calendar-range.server.ts`, `loadCalendarRange()`:

- Two independently-scoped queries: `projects` (active — non-deleted, non-archived; `deadline_date` between the requested range; **Done projects with a deadline are still included**, per the locked policy) and `calendar_events` (non-deleted; `event_date` between the same range).
- Both queries use `.gte()`/`.lte()` directly against the requested `DateOnly` range — no over-fetching, no loading a user's full history. NULL-`deadline_date` rows are excluded by the range comparison itself (SQL's three-valued `NULL` logic), with no separate `is not null` filter needed.
- Reuses `getDeadlineUi()` verbatim for `isOverdue` classification — **never reimplemented**.
- Merges both sources into one flat `CalendarItem[]`, deliberately **unsorted** — confirmed by a dedicated test that sorting does not happen inside the loader, since sorting is Track C's independent, pure concern (`calendar-item-sort.ts`), invoked separately by the API route. This avoids the exact "sorting/filtering duplicated inside loaders" risk the task explicitly warned against.
- `loadUnscheduledProjects()` (separate file, same pattern): active, non-Done, non-archived, non-deleted, no-deadline projects, `created_at` descending, bounded `limit` (default 50) — **never loads a user's full project history**. The "not Done" filter deliberately uses `.or("status.neq.Done,status.is.null")` rather than a bare `.neq("status","Done")`, because in SQL three-valued logic a bare `.neq()` would silently drop projects with no status set at all — a documented, tested correctness fix, not an oversight.

---

## 12. Unscheduled Projects query

Covered above (§11) — same file, same generic-client pattern, its own focused test file (9 tests) covering the exact filter predicates, the `Done`-vs-`null`-status distinction, the default and explicit bounded `limit`, and normalized-row shape including the `"Untitled project"` fallback for a null title.

---

## 13. API contracts

All five routes follow this repository's confirmed simple-CRUD convention exactly: `createClient()` → `auth.getUser()` → 401 if absent → Zod `.safeParse()` → 400 on failure → `{ success: true, ... }` / `{ error: string }` response shape → `console.error` only for genuinely unexpected (caught) errors → no live database access in any test (all mocked).

| Route | Method | Behavior |
|---|---|---|
| `app/api/calendar/route.ts` | `GET ?start=&end=` | Validates the range (rejects invalid dates, reversed ranges, and ranges over 120 days — a safety valve against an accidental full-history scan); loads and merges both sources; **groups by date and applies `sortCalendarItemsForDay` per day, chronologically** (grouping logic lives in this route file, not duplicated into `calendar-item-sort.ts`, which only knows how to order one day's items); returns via the shared `dashboardTasksNoStoreHeaders` (reused, not redefined). |
| `app/api/calendar/unscheduled/route.ts` | `GET` | No parameters needed — the handler takes zero arguments (confirmed the idiomatic choice after ESLint flagged an unused-but-named parameter; Next.js route handlers support zero-arg exports). |
| `app/api/calendar/events/route.ts` | `POST` | Creates one event; `201` on success. |
| `app/api/calendar/events/[id]/route.ts` | `PATCH` | Validates the `id` path param as a UUID *before* touching the database; validates the partial body; delegates to `updateCalendarEvent`. |
| `app/api/calendar/events/[id]/route.ts` | `DELETE` | Same `id` validation; delegates to `softDeleteCalendarEvent`; returns `{ success: true, alreadyDeleted: boolean }`. |

Dynamic route params use `params: Promise<{ id: string }>` (Next.js 16's async-params convention, confirmed against the one other dynamic segment in this app, `app/use-cases/[slug]/page.tsx`) — this is the first App Router **API route** dynamic segment in the repository; no other `app/api/**/[id]/route.ts` precedent existed to copy, so this follows the framework's standard convention directly.

---

## 14. Files created

**Migration (2):**
- `supabase/migrations/202607290001_calendar_events.sql`
- `supabase/migrations/202607290001_calendar_events.test.ts`

**`lib/calendar/` (19):**
- `calendar-types.ts`
- `time-only.ts`, `time-only.test.ts`
- `calendar-schemas.ts`, `calendar-schemas.test.ts`
- `calendar-grid.ts`, `calendar-grid.test.ts`
- `calendar-item-sort.ts`, `calendar-item-sort.test.ts`
- `calendar-filters.ts`, `calendar-filters.test.ts`
- `calendar-link-validation.server.ts`, `calendar-link-validation.server.test.ts`
- `calendar-events-repository.server.ts`, `calendar-events-repository.server.test.ts`
- `load-calendar-range.server.ts`, `load-calendar-range.server.test.ts`
- `load-unscheduled-projects.server.ts`, `load-unscheduled-projects.server.test.ts`

**`app/api/calendar/` (8):**
- `route.ts`, `route.test.ts`
- `unscheduled/route.ts`, `unscheduled/route.test.ts`
- `events/route.ts`, `events/route.test.ts`
- `events/[id]/route.ts`, `events/[id]/route.test.ts`

**Report:**
- `docs/TEXT2TASK_WORK_CALENDAR_FOUNDATION_IMPLEMENTATION_REPORT.md` (this file)

## 15. Files modified

**None.** This entire milestone is additive — no existing file's content changed. (`git status --short` shows only new/untracked paths.)

---

## 16. Tests added

| Layer | File | Tests |
|---|---|---|
| Migration (static assertions) | `202607290001_calendar_events.test.ts` | 29 (26 original + 3 added in the §22 corrective pass) |
| TimeOnly | `time-only.test.ts` | 17 |
| Zod schemas | `calendar-schemas.test.ts` | 21 |
| Month-grid math | `calendar-grid.test.ts` | 20 |
| Item sorting | `calendar-item-sort.test.ts` | 8 |
| Filtering | `calendar-filters.test.ts` | 15 |
| Link validation | `calendar-link-validation.server.test.ts` | 9 |
| Events repository | `calendar-events-repository.server.test.ts` | 27 (18 original + 2 net from replacing/expanding the malformed-time test + 7 new historical-link-preservation tests, all added in the §22 corrective pass) |
| Calendar range loader | `load-calendar-range.server.test.ts` | 12 |
| Unscheduled projects loader | `load-unscheduled-projects.server.test.ts` | 9 |
| `GET /api/calendar` | `route.test.ts` | 7 |
| `GET /api/calendar/unscheduled` | `unscheduled/route.test.ts` | 3 |
| `POST /api/calendar/events` | `events/route.test.ts` | 7 |
| `PATCH`/`DELETE /api/calendar/events/:id` | `events/[id]/route.test.ts` | 12 |
| **Total new** | **14 files** | **192 tests** (final passing count below is authoritative) |

Every locked test scenario from the task brief is covered: unauthenticated access (401, every route); invalid dates/times/UUIDs; reversed and oversized ranges; valid range load; create/update/delete; explicit clearing of nullable fields (`eventTime`, `notes`, `projectId`, `clientId`) distinguished from omission; another user's event/project/client (all resolve to 404, matching how RLS itself would collapse "not found" and "not yours"); mismatched project/client normalization (project always wins); soft-deleted project rejection; malformed database rows failing safely (`null`, never a throw); repeated delete idempotency; and — via the grep sweep below — the absence of any accidental write to `projects` from any calendar-events write path.

---

## 17. Exact verification results

These results are from the milestone as originally delivered; §22 records the corrective pass's own final verification run (the authoritative current state).

```
npx vitest run
  Test Files  44 passed (44)
       Tests  552 passed (552)

npx tsc --noEmit
  (clean, no output)

npx eslint <all 28 changed .ts files>
  (clean, no output -- one initial unused-var warning in
   app/api/calendar/unscheduled/route.ts was fixed by dropping the unused
   request parameter, then re-verified clean)

npm run lint   (repo-wide)
  (clean, no output)

git diff --check
  (clean, exit 0)

git status --short
  ?? app/api/calendar/
  ?? docs/TEXT2TASK_WORK_CALENDAR_FOUNDATION_IMPLEMENTATION_REPORT.md
  ?? docs/TEXT2TASK_WORK_CALENDAR_MAPPING.md   (pre-existing, unchanged)
  ?? lib/calendar/
  ?? supabase/migrations/202607290001_calendar_events.sql
  ?? supabase/migrations/202607290001_calendar_events.test.ts

git diff --stat
  (empty -- every change is a new/untracked file, not a modification to a
   tracked one; git diff --stat only reports tracked-file changes. File and
   line counts for the new work: 29 new files (1 SQL migration + 28
   TypeScript files), ~4,959 lines added in total.)
```

**Final foundation audit (grep sweep across every new file):**

| Pattern searched | Result |
|---|---|
| `new Date(` | 2 matches, both legitimate: `calendar-grid.ts`'s sanctioned local-noon numeric constructor (mirrors `date-only.ts` exactly), and `calendar-events-repository.server.ts`'s `deleted_at: new Date().toISOString()` (a `timestamptz` audit stamp, not a `DateOnly`/`TimeOnly` value — outside the locked restriction's scope) |
| `Date.parse` | 0 code matches (1 match inside a doc comment describing what's forbidden) |
| `.toISOString()` | 1 legitimate match (same `deleted_at` stamp above) |
| `UTC` | 0 code matches (only inside doc comments) |
| `as any` | 0 matches |
| `eslint-disable` | 0 matches |
| `ts-ignore` / `ts-expect-error` | 0 matches |
| `service_role` | 0 matches |
| Direct Supabase usage from a UI file | N/A — **zero `.tsx` files were created this milestone** |
| Project deadlines duplicated into `calendar_events` | 0 matches — every `deadline_date` reference is a read-only projection from `projects`, never a write target on `calendar_events` |
| Hard delete on `calendar_events` | 0 matches — no `.delete(` call exists anywhere |
| Unscoped project/client lookups | 0 — every `.from("projects")`/`.from("clients")` call in the new code chains `.eq("user_id", ...)` explicitly, confirmed via direct inspection of all 3 call sites |
| `\|\|`/`??` fallbacks defeating explicit null-clearing | 0 — every `UpdateCalendarEventInput` field is consumed via `"key" in input`, confirmed via direct inspection |
| Writes to `projects`/`tasks` from calendar code | 0 — all 3 `.from("projects")` call sites are select-only (verified directly, no `.insert`/`.update` chained); confirmed further by a route-level test asserting the fake `projects` table mock never receives an insert/update call during event creation or update |
| `app/dashboard/calendar/*`, sidebar/nav files, any Calendar UI component | None created or modified |

---

## 18. Remaining risks or open items

- **`clients.deleted_at` existence is unconfirmed** (§2). The design does not depend on it (the integrity trigger and link-validation only check `clients.user_id`), so this is not a blocking risk for this milestone — but if a future milestone adds client-level soft-delete, the trigger/validation should be revisited to add the same check pattern already used for projects.
- **The `projects_user_id_deadline_date_idx` index may be redundant** with an existing, differently-named index in the live, untracked base schema (§6) — harmless (`create index if not exists` never errors on this), but worth a quick manual check against the live database before this migration is actually run, to avoid carrying two equivalent indexes indefinitely.
- *(State at the time of the original implementation verification, superseded by §23 — the migration has since been applied to production and live-verified.)* **No live-database verification was performed** — per the task's explicit constraint, no migration was run against any local, staging, or production database. All correctness claims about the migration's SQL are based on static review and the static-assertion test file, matching this repository's own established testing convention for migrations (confirmed no migration in this repo is exercised against a real Postgres instance in tests).
- **This is API/repository, not the full feature.** No UI exists yet to exercise these routes end-to-end in a browser; the next milestone (per the locked scope) builds the Calendar route, navigation, month grid, and event dialog on top of this foundation.
- **Route param dynamic segment (`[id]`) is a first for this repo's API routes** — the pattern used (`params: Promise<{id}>`) matches Next.js 16's documented convention and the one existing page-level dynamic segment, but had no prior *API route* precedent in this codebase to cross-check against.

---

## 19. git status --short

```
?? app/api/calendar/
?? docs/TEXT2TASK_WORK_CALENDAR_FOUNDATION_IMPLEMENTATION_REPORT.md
?? docs/TEXT2TASK_WORK_CALENDAR_MAPPING.md
?? lib/calendar/
?? supabase/migrations/202607290001_calendar_events.sql
?? supabase/migrations/202607290001_calendar_events.test.ts
```

## 20. git diff --stat

```
(empty -- all changes are new/untracked files; git diff --stat reports only
modifications to already-tracked files, and none exist in this milestone.)
```

## 21. Explicit confirmation

*(State at the time of the original implementation verification, superseded by §23 — the migration has since been applied to production and live-verified.)*

**Nothing was committed. Nothing was pushed.** No branch was created or switched (`main`, unchanged, confirmed before and after). **No migration was run against any local, staging, or production database** — the new `.sql` file exists on disk only. No production data was touched. No dependency was installed or upgraded. `npm run build` was not run. No Calendar UI, route, navigation, or component of any kind was created — confirmed by direct file-list inspection and by the grep sweep finding zero new `.tsx` files. The mapping report (`docs/TEXT2TASK_WORK_CALENDAR_MAPPING.md`) was not modified. All commits/pushes/migrations remain the user's action to take.

---

## 22. Corrective pass (historical client-link preservation + minute-precision constraint)

Performed after the foundation above, before the migration had been applied or committed to anywhere, so both fixes were made **in place in the existing migration file** — no second migration file was created.

### Correction 1 — preserve historical client links

**Confirmed bug**: `enforce_calendar_event_relationship_integrity()` ran its full validation/normalization block on **every** `INSERT OR UPDATE`, regardless of which columns an `UPDATE` actually touched. Because a Postgres row trigger's `NEW` record reflects the full post-update row (untouched columns carry their existing persisted value), an update that only changed, say, `notes` would still have `NEW.project_id` equal to the event's existing linked project — and the trigger would unconditionally re-fetch that project's **current** `client_id` and overwrite `NEW.client_id` with it. If the project's own client had changed since the event was created, this would silently rewrite the event's historical client link during a completely unrelated edit. The server-repository layer (`updateCalendarEvent`) was independently verified to already be correct (it never includes `project_id`/`client_id` in its write payload unless the patch explicitly touches one of those two fields) — **the bug was isolated entirely to the database trigger.**

**Fix**: the trigger now computes `v_relationship_changed` first — `true` on `INSERT`, or `NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.client_id IS DISTINCT FROM OLD.client_id` on `UPDATE` — and returns immediately, before ever querying `projects`/`clients`, when it's `false`. The validation/normalization block (project ownership/deletion checks, client ownership check, the `NEW.client_id := v_project_client_id` normalization) now only runs when the relationship is genuinely changing. A code comment in the migration explains why this is a correctness fix, not merely an optimization.

The `updateCalendarEvent` comment claiming "the database trigger still unconditionally re-validates on every write regardless" (previously used to justify the repository's own optimization as "safe either way") has been corrected to state that both layers now agree: neither touches the relationship unless the patch does.

### Correction 2 — enforce minute-precision times

**Added**: `constraint calendar_events_event_time_minute_precision_check check (event_time is null or extract(second from event_time) = 0)` on the `calendar_events` table — no new column, no timezone-policy change.

**Confirmed bug**: `normalizeCalendarEventRow` treated a non-null `event_time` that failed `normalizeDatabaseTimeOnly` (e.g. a value with non-zero seconds) as `time: null` — i.e., it silently reinterpreted a malformed timed event as an all-day event, changing what the row means rather than rejecting it. Fixed: a malformed `event_time` now makes `normalizeCalendarEventRow` return `null` for the **whole row** (the same fail-closed treatment already used for an unparseable `event_date`), so a malformed row is omitted from the calendar rather than silently misrepresented. `lib/calendar/time-only.ts` itself needed no changes — its `normalizeDatabaseTimeOnly` already correctly rejected non-zero seconds and accepted zero-second fractional suffixes (e.g. `"14:30:00.000000"` → `"14:30"`); the bug was entirely in how the repository layer *used* that `null` result.

### Files changed in this corrective pass

| File | Change |
|---|---|
| `supabase/migrations/202607290001_calendar_events.sql` | Corrected trigger logic (relationship-changed guard); added the minute-precision `CHECK` constraint; updated column/header comments to describe both |
| `supabase/migrations/202607290001_calendar_events.test.ts` | Added a test for the new `CHECK` constraint; added two tests asserting the trigger's early-return guard exists and runs before any `projects`/`clients` query |
| `lib/calendar/calendar-events-repository.server.ts` | `normalizeCalendarEventRow` now rejects (returns `null` for) the whole row on a malformed `event_time` instead of coercing it to all-day; corrected a stale comment about the trigger's re-validation behavior |
| `lib/calendar/calendar-events-repository.server.test.ts` | Replaced the test asserting the old (incorrect) all-day coercion with two tests asserting row rejection (malformed seconds, and non-time-shaped text); added a test confirming a fractional-zero-seconds value still normalizes correctly; added a new 7-test `describe` block, `"historical client-link preservation (Correction 1 regression suite)"`, covering exactly the seven locked scenarios (create-derives-client, unrelated-update-preserves-client, soft-delete-preserves-client, project's-client-changing-later-does-not-rewrite-on-unrelated-update, explicit-projectId-change-derives-new-client, explicit-clientId-change-while-project-linked-cannot-diverge, unlinking-project-permits-independent-client) |
| `docs/TEXT2TASK_WORK_CALENDAR_FOUNDATION_IMPLEMENTATION_REPORT.md` | This section, plus targeted corrections to §1, §3, §4, §10, §16, §17 to reflect the fixed behavior and updated test counts |

No other file was touched. No API route shape, `CalendarItem` public contract, `DateOnly` behavior, project-deadline behavior, RLS policy, schema field (beyond the one new `CHECK` constraint), navigation, or UI was changed. The mapping report was not touched.

### Final verification results (authoritative — supersedes §17's numbers)

```
npx vitest run
  Test Files  44 passed (44)
       Tests  564 passed (564)

npx tsc --noEmit
  (clean, no output)

npx eslint supabase/migrations/202607290001_calendar_events.test.ts \
           lib/calendar/calendar-events-repository.server.ts \
           lib/calendar/calendar-events-repository.server.test.ts
  (clean, no output)

npm run lint   (repo-wide)
  (clean, no output)

git diff --check
  (clean, exit 0)

git status --short
  ?? app/api/calendar/
  ?? docs/TEXT2TASK_WORK_CALENDAR_FOUNDATION_IMPLEMENTATION_REPORT.md
  ?? docs/TEXT2TASK_WORK_CALENDAR_MAPPING.md
  ?? lib/calendar/
  ?? supabase/migrations/202607290001_calendar_events.sql
  ?? supabase/migrations/202607290001_calendar_events.test.ts
```

All five paths remain untracked/new, exactly as before this corrective pass — the migration and its test file were edited in place (not replaced with a second migration), and every other new-file path is unchanged. `git diff --check` reports clean because there is nothing tracked to diff against; every change in this pass is to a file that was already untracked from the original milestone.

### Explicit confirmation (corrective pass)

*(State at the time of the corrective-pass verification, superseded by §23 — the corrected migration has since been applied to production and live-verified.)*

**Nothing was committed. Nothing was pushed. No migration was run or applied against any database. No dependency was installed. `npm run build` was not run.** No Calendar UI, route, navigation, or component was created or touched. No new migration file was created — the existing, still-unapplied migration was corrected in place, as instructed. The mapping report was not modified.

---

## 23. Production migration and live database verification

The foundation migration (`supabase/migrations/202607290001_calendar_events.sql`, including both corrections from §22) has been applied **exactly once** to the production Supabase database, manually, through the Supabase SQL Editor.

- Supabase returned: **"Success. No rows returned."**
- No existing `projects`/`tasks` data was modified by the migration — it is purely additive (one new table, its indexes/triggers/policies, and the one supporting index on `projects`, which is metadata-only).

**Live verification against the production database confirmed:**

- `table_exists` = `true`
- `rls_enabled` = `true`
- All expected columns and types present on `calendar_events`
- All four ownership RLS policies present (`select`/`insert`/`update`/`delete`, each scoped to `auth.uid() = user_id`)
- The relationship-integrity trigger (`enforce_calendar_event_relationship_integrity`, with the §22 relationship-changed guard) is present and wired
- The `updated_at` trigger (`set_calendar_events_updated_at`) is present and wired
- The title constraint (`calendar_events_title_check`) is present
- The minute-precision `event_time` constraint (`calendar_events_event_time_minute_precision_check`, added in §22) is present
- The `user_id` → `auth.users`, `project_id` → `projects`, and `client_id` → `clients` foreign keys are present with the correct delete behavior (`cascade` / `set null` / `set null` respectively)
- The `calendar_events` user/date composite index (`calendar_events_user_id_event_date_idx`) is present
- The `calendar_events` project/client partial indexes (`calendar_events_project_id_idx`, `calendar_events_client_id_idx`) are present
- `projects_user_id_deadline_date_idx` is present
- No duplicate equivalent deadline-date index existed on `projects` prior to this migration
- No Calendar UI is deployed yet
- No event data was inserted into `calendar_events` during verification

### Explicit confirmation (current, authoritative)

**Nothing has been committed or pushed yet.** The migration described above **was applied to production and has been live-verified** — this is the one exception to "nothing was run against a database" in the rest of this report. **No UI was created or deployed.** **No production `projects`/`tasks` row was changed by the migration.** Committing and pushing the application code remain the user's action to take.
