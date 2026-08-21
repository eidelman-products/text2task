# Client Share Link — Phase 6A Runtime Verification Package

> **READ THIS FIRST**
>
> - Run this package **only** inside a brand-new, empty, **temporary**
>   Supabase project created solely for Phase 6A. A project already used
>   for the Phase 1B, Phase 1C, Phase 2B, Phase 3 rate-limit, or Phase 3
>   application packages is **NOT reusable here** — create a fresh one.
>   Those projects already have Client Share (and, in some cases, other)
>   schema applied, which will trip File 01's own empty-project check.
> - **Never** run any file in this package against the real Text2Task
>   production project, under any circumstance.
> - Run the files **in order**: `01`, then `02`, then `03`. Do not skip a
>   file.
> - **Do not edit the generated SQL**
>   (`02_APPLY_CLIENT_SHARE_THROUGH_PHASE6A.sql`) while copying it into
>   the SQL Editor. It is mechanically generated, verbatim, from the
>   fourteen authoritative migration files under `supabase/migrations/`.
>   If you need a change, change the migration and regenerate the package
>   (`scripts/client-share/build-phase6a-runtime-package.ps1`) — never
>   hand-edit the generated file.
> - **Stop immediately** if any file produces an unexpected error, and
>   report the exact error text rather than continuing or improvising a
>   fix inside the SQL Editor.
> - **Save the entire output** of file `03` — see `04_CAPTURE_RESULTS.md`
>   — and return it before any full build, commit, or Phase 6B work
>   begins.
> - Delete the disposable Supabase project once you are done reviewing
>   the results.

## Why this package exists

Phase 6A (`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6A_IMPLEMENTATION_REPORT_2026-08-21.md`)
added one migration,
`supabase/migrations/202608210001_client_share_project_update_provenance.sql`,
giving `public.project_updates` a durable `source_share_message_id`
column, a coupling CHECK against `source_type`, a partial unique index,
and a new cross-table integrity + immutability trigger. That work was
verified with 31/31 static, source-level tests
(`202608210001_client_share_project_update_provenance.test.ts`) plus a
clean `tsc --noEmit` and a 249/249 regression pass — but static tests can
only inspect the migration's *text*, never prove that PostgreSQL actually
enforces it. This package closes that gap: it applies the real migration
chain to a real, disposable PostgreSQL database and issues real
INSERT/UPDATE/DELETE statements, as the real roles (`postgres`,
`service_role`, `authenticated`, `anon`) that would actually touch these
tables, and checks the real outcomes.

## Why this package spans two features

Unlike every prior Client Share runtime package, File 02's migration
bundle is not Client-Share-only. Phase 6A's own migration alters
`public.project_updates`, a table owned by the (older, unrelated)
Project Update Engine feature — so the *real* `project_updates` table,
with its real `source_type`/`status` CHECK constraints, RLS and grants
(from `202605250001_project_update_engine.sql` and
`202606150001_project_update_apply_hardening.sql`), has to exist before
Phase 6A's `ALTER TABLE`/trigger statements mean anything. Every prior
package's own `01_CREATE_TEMP_TEST_FIXTURE.sql` created `project_updates`
as a hand-authored minimal stand-in (it didn't need to be real, since no
prior Client Share migration ever touched its constraints) — this
package's File 01 deliberately does **not** do that; see that file's own
header comment.

## What this package proves (and does not prove)

Twelve sections (A–L, `03_RUN_PHASE6A_RUNTIME_TESTS.sql`) against a real
disposable PostgreSQL database:

1. **A** — the column, FK, delete action, partial unique index, widened
   CHECK, coupling CHECK and trigger are all actually installed as
   declared (catalog-level, but every other section below proves
   *behavior*, not just presence).
2. **B** — every existing normal Client Update source type
   (text/image/email/manual) with `source_share_message_id = NULL`
   still inserts successfully — zero regression for the feature Phase 6A
   extends.
3. **C** — a valid `client_share` provenance insert succeeds.
4. **D** — every coupling-CHECK violation (`client_share` + null id;
   each of the four other source types + a non-null id) is rejected.
5. **E** — cross-table integrity: a nonexistent message id (FK
   violation), a cross-tenant message, a cross-project message, and an
   owner-authored message are all rejected with their specific
   `PROJECT_UPDATE_SOURCE_MESSAGE_*` error codes; a genuinely valid
   client-authored, same-owner, same-project message is accepted.
6. **F** — structural idempotency: a second row for an already-used
   source message is rejected (`unique_violation`); exactly one row ever
   references it; the original row is untouched.
7. **G** — provenance immutability in every direction (message A →
   message B; id → NULL; `client_share` → each other source type; a
   pre-existing normal row → `client_share`), while unrelated legitimate
   field updates (`status`, `ai_summary`) on both normal and
   `client_share` rows continue to succeed.
8. **H** — the *existing, unmodified* `share_messages` integrity layer
   (Phase 5) still protects the referenced source message: no
   application-reachable role (`authenticated`, `service_role`) holds
   any UPDATE privilege on `share_messages` at all (the real, primary
   guarantee), and even a privileged bypass attempt changing
   `user_id`/`project_id`/`author_type` is independently rejected by
   `enforce_share_message_integrity`.
9. **I** — a hard `DELETE` of a *referenced* message fails
   (`on delete restrict`), leaving both rows intact; a hard `DELETE` of
   an *unreferenced* message succeeds — proving the restriction is
   scoped, not a blanket lock.
10. **J** — a real authenticated-owner execution context (not just
    `postgres`) can create a valid `client_share` provenance row
    end-to-end (proving the trigger's `SECURITY INVOKER` lookup actually
    resolves under real RLS, not superuser bypass) and a normal update;
    cannot use another tenant's message; `anon` cannot write to
    `project_updates` at all.
11. **K** — `share_message_conversions` remains completely
    write-inaccessible (no grant to `authenticated` or `anon`, no
    conversion-helper RPC of any name exists), and the new trigger
    function itself has no `EXECUTE` grant to any role.
12. **L** — a single PASS/FAIL verdict: `runtime_status =
    PHASE_6A_RUNTIME_PASS (N / N tests passed)`, or a loud
    `PHASE_6A_RUNTIME_FAIL` exception naming exactly how many of how many
    failed.

This package does **not** re-prove the rest of the Client Share surface
— the existing `docs/client-share-phase1b-runtime/`,
`docs/client-share-phase1c-runtime/`,
`docs/client-share-phase2b-mapping-read-runtime/`,
`docs/client-share-phase3-rate-limit-runtime/` and
`docs/client-share-phase3-runtime/` packages already did that. This
package's File 03 is deliberately scoped to what is new in Phase 6A.

This package does **not** prove:

- Anything about Phase 6B/6C/6D — no convert route, no owner-facing UI,
  no `apply_project_update_transaction` change, no
  `status = 'converted'` behavior exists yet to test. Phase 6B is **not
  authorized** by this package's existence or result.
- That any migration is newly authorized for Production application. See
  `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.
- Anything by itself, until you actually run it and it reports
  `runtime_status = PHASE_6A_RUNTIME_PASS`.

## Step by step

1. Create a brand-new, empty, temporary Supabase project (not the
   existing Phase 1B/1C/2B/3 disposable project, not Production).
2. Open that project's SQL Editor.
3. Paste and run `01_CREATE_TEMP_TEST_FIXTURE.sql` in full. Expect a
   single result row: `fixture_status = READY`.
4. Paste and run `02_APPLY_CLIENT_SHARE_THROUGH_PHASE6A.sql` in full.
   Expect a final verification table where every row shows `found =
   true`.
5. Paste and run `03_RUN_PHASE6A_RUNTIME_TESTS.sql` in full. Expect a
   result table, a summary row, and — if anything failed — an isolated
   table of FAIL rows only, followed by a notice reading `runtime_status
   = PHASE_6A_RUNTIME_PASS (N / N tests passed)`. A failure raises a
   loud `PHASE_6A_RUNTIME_FAIL` exception instead of hiding anything.
6. Save the complete output — see `04_CAPTURE_RESULTS.md`.
7. **Do not go further** (no Production application, no full build, no
   Phase 6B work) without returning these results first. Read
   `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` regardless of the
   outcome.
8. Delete the disposable Supabase project.

## What each file is

| File | What it is |
|---|---|
| `00_READ_ME_FIRST.md` | This file. |
| `01_CREATE_TEMP_TEST_FIXTURE.sql` | Hand-authored. Same fail-closed safety check and sentinel pattern as every prior Client Share runtime package, renamed to a Phase-6A-specific sentinel. Creates minimal stand-ins only for the genuinely pre-migration-history tables (`projects`, `tasks`, `clients`, `task_resources`) plus both fixture owners — deliberately does *not* stand in `project_updates`/`project_timeline_events`, which File 02 creates for real. |
| `02_APPLY_CLIENT_SHARE_THROUGH_PHASE6A.sql` | Mechanically generated from fourteen authoritative migration files (the Project Update Engine's own schema-defining migrations, then the full Client Share chain, then Phase 6A's own migration), verbatim, in order, with a safety preamble and a final structural verification query. Do not hand-edit. |
| `03_RUN_PHASE6A_RUNTIME_TESTS.sql` | Hand-authored. Real PostgreSQL runtime behavior tests, sections A–L above, ending in a PASS/FAIL verdict. Always rolls back — safe to re-run against the same disposable project. |
| `04_CAPTURE_RESULTS.md` | Template for recording what actually happened when you run this package. Currently unfilled — not yet run. |
| `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` | Read this even if everything passes. |
| `MANIFEST.md` | Mechanically generated: full file inventory and SHA-256 hashes. |
| `../../scripts/client-share/build-phase6a-runtime-package.ps1` | The generator that produces file `02` and `MANIFEST.md`. Read-only against `supabase/migrations/`; never runs SQL; never connects to Supabase. |
