# Production Application — Not Authorized

Read this even if every test in this package passed.

## PHASE 6A RUNTIME VERIFICATION DOES NOT AUTHORIZE PRODUCTION APPLICATION.

No Phase 6 migration may be applied to Production from this package, or
as a result of this package's existence, or as a result of a
`PHASE_6A_RUNTIME_PASS` result.

## What passing these tests would prove

A `PHASE_6A_RUNTIME_PASS` result from `03_RUN_PHASE6A_RUNTIME_TESTS.sql`
would confirm that, against a clean disposable PostgreSQL database with
the Project Update Engine's own schema-defining migrations, the full
Client Share migration chain, and Phase 6A's own new migration all
applied exactly as committed:

- `202605250001_project_update_engine.sql`
- `202606150001_project_update_apply_hardening.sql`
- `202608030003_client_share_owner_foundation.sql`
- `202608030004_client_share_session_foundation.sql`
- `202608030005_client_share_integrity_and_security.sql`
- `202608050001_client_share_owner_reads.sql`
- `202608060001_client_share_lifecycle_operations.sql`
- `202608060002_client_share_access_operations.sql`
- `202608060003_client_share_configuration_save.sql`
- `202608110001_client_share_publication_intent.sql`
- `202608110002_client_share_management_mapping_metadata.sql`
- `202608130001_client_share_rate_limit_increment.sql`
- `202608190001_client_share_message_owner_rpcs.sql`
- `202608210001_client_share_project_update_provenance.sql`

`public.project_updates.source_share_message_id` behaves exactly as
Phase 6A's own migration and implementation report claim: the coupling
CHECK, the partial unique index, the `ON DELETE RESTRICT` FK, and the
combined cross-table-integrity/immutability trigger all actually enforce
their invariants against a real PostgreSQL engine, under the real roles
(`postgres`, `service_role`, `authenticated`, `anon`) that would ever
touch these tables — not merely that the migration's SQL *text* looks
correct (that was already proven statically, 31/31, before this package
existed).

## What this package is, and is not

This package exists solely to runtime-verify **Phase 6A's own new
database contract**. It does not implement, verify, or authorize
anything about Phase 6B (the server-authorized analyze route), Phase 6C
(atomic Apply + conversion closure), or Phase 6D (full lifecycle
acceptance) — none of that code exists yet. It does not re-prove the
rest of the Client Share surface, which the existing
`docs/client-share-phase1b-runtime/`, `docs/client-share-phase1c-runtime/`,
`docs/client-share-phase2b-mapping-read-runtime/`,
`docs/client-share-phase3-rate-limit-runtime/`, and
`docs/client-share-phase3-runtime/` packages already did.

## What passing these tests does NOT prove or authorize

- The disposable test fixture (`01_CREATE_TEMP_TEST_FIXTURE.sql`) is a
  deliberately minimal stand-in for `public.projects`/`public.tasks`/
  `public.clients`/`public.task_resources` — the four tables that predate
  this repository's migration history. It does not, and is not intended
  to, match the real production schema in every column, constraint,
  trigger, or default those tables actually carry in Production.
- Passing this package does **not** authorize applying
  `202608210001_client_share_project_update_provenance.sql` — or any of
  the thirteen other migrations listed above — to the real Text2Task
  production project. Whether and when to apply this migration to
  Production remains a separate, explicit, later decision, requiring its
  own authorization.
- It does not prove or authorize enabling
  `TEXT2TASK_CLIENT_SHARE_ENABLED` in Production. That remains a
  separate, explicit, later decision, and is unrelated to Phase 6A in
  any case (Phase 6A adds no owner-facing behavior of any kind).
- It does not authorize starting Phase 6B, 6C, or 6D implementation. Each
  requires its own separate, explicit authorization per
  `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6_ACCEPTED_PLAN_2026-08-21.md`.
- It does not replace `npx tsc --noEmit` (already run, clean), the
  31/31 static test pass (already run), the 249/249 regression pass
  (already run), `npm run build` (not run — user-owned action), staging,
  or any deploy step.
- A successfully *generated* package (file `02` mechanically assembled
  and hash-verified) is not by itself runtime proof of anything — only
  an actual run of file `03`, captured in `04_CAPTURE_RESULTS.md`, is.

## Hard rules

- The Production Text2Task project must never receive file `01` or file
  `03` from this package.
- The existing Phase 1B/1C/2B/3 disposable Supabase project(s), already
  used for earlier Client Share evidence, must never receive any file
  from this package either — Phase 6A requires its own brand-new,
  dedicated disposable project (see `00_READ_ME_FIRST.md`).
- Only the fourteen original, committed migration files under
  `supabase/migrations/` are ever candidates for Production application —
  and only exactly as written, never as edited copies, and never as the
  generated bundle in file `02` (which exists solely for temporary-project
  SQL Editor convenience).
- No Production access, no build, no deploy, no `git add`/commit/push,
  and no feature-flag change was performed by this package or by the
  agent that produced it.
