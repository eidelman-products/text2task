-- Text2Task Client Share Link -- Phase 3 Browser Acceptance Fixture
-- Package
-- File 01A: Incremental patch -- add public.tasks.is_archived
--
-- DISPOSABLE TEST PROJECT ONLY
-- PRODUCTION APPLICATION NOT AUTHORIZED
--
-- Run this ONLY in the same disposable Supabase project where this
-- package's own 01_EXTEND_DISPOSABLE_APP_SCHEMA.sql and
-- 02_SEED_DISPOSABLE_OWNER_CONTENT.sql have ALREADY been run
-- successfully. Never run this in the real Text2Task production
-- project.
--
-- WHY THIS FILE EXISTS: 03_BROWSER_FIXTURE_VERIFICATION.sql's check B2
-- failed (16 total, 15 passed, 1 failed) because
-- 01_EXTEND_DISPOSABLE_APP_SCHEMA.sql never added an `is_archived`
-- column to `public.tasks` -- confirmed both statically (comparing File
-- 01's ALTER list against File 03's own expected-column array) and by a
-- direct read-only probe against the disposable database
-- (`tasks_is_archived_exists = false`). The real application code
-- (`app/api/tasks/route.ts`) explicitly sets `is_archived: false` on
-- every task it creates, so this is a genuine gap, not only a
-- verification-script issue -- a real task creation through the actual
-- dashboard against this fixture would have failed the same way.
--
-- Because File 01 has already run successfully and File 02 has already
-- seeded persistent owner/project/task/resource content, this file is a
-- SEPARATE, MINIMAL, IDEMPOTENT PATCH -- it does not re-run File 01, does
-- not touch any other column, and does not recreate, delete, or reset
-- any seeded row. File 01 itself has also been corrected for future
-- clean setups (see its own updated comment for this column), but that
-- corrected version is never re-applied to an already-extended project --
-- this file is what closes the gap for the project that already exists.
--
-- CANONICAL CONTRACT FOR tasks.is_archived (see this file's own repo
-- inspection, and 04_CAPTURE_RESULTS.md for the full record): no
-- committed migration in supabase/migrations/ defines
-- public.tasks (the core app schema predates this repository's migration
-- history entirely, which is exactly why the disposable fixture needed
-- to invent tasks/projects/clients/task_resources in the first place).
-- The best available evidence is: every real write path
-- (app/api/tasks/route.ts, three separate insert sites) always supplies
-- `is_archived: false` explicitly, never relying on a default; several
-- migrations' own read queries (e.g.
-- 202607270001_project_completion_reconciliation.sql) defensively treat
-- `is_archived is null` as equivalent to `false` ("not archived"),
-- consistent with an older/looser historical column that may not have
-- always carried a NOT NULL constraint; and the sibling column
-- `projects.is_archived` already present in THIS SAME disposable fixture
-- (from docs/client-share-phase3-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql)
-- is `boolean not null default false`. `not null default false` is
-- therefore the best-supported choice here: it satisfies every actual
-- observed write, is trivially compatible with the null-tolerant read
-- pattern (a NOT NULL DEFAULT column is simply never null), and matches
-- the sibling column already in this exact fixture -- while this comment
-- explicitly discloses that Production's true nullability could not be
-- confirmed from any file in this repository.

-- =========================================================
-- Safety gate
-- =========================================================

do $$
declare
  v_sentinel_kind text;
begin
  if to_regclass('public.text2task_client_share_phase3_application_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. DISPOSABLE TEST PROJECT ONLY. PRODUCTION APPLICATION NOT AUTHORIZED. The Phase 3 application runtime test sentinel was not found.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase3_application_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_3_APPLICATION_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. DISPOSABLE TEST PROJECT ONLY. PRODUCTION APPLICATION NOT AUTHORIZED. The sentinel row does not identify this project as the disposable Phase 3 application runtime test project.';
  end if;

  if to_regclass('public.tasks') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.tasks was not found. Run docs/client-share-phase3-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql first.';
  end if;

  if to_regclass('public.users') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.users was not found. Run this package''s own 01_EXTEND_DISPOSABLE_APP_SCHEMA.sql first -- this patch assumes that schema extension already ran.';
  end if;
end;
$$;

-- =========================================================
-- The patch itself: additive only, idempotent, no data loss.
--
-- `ADD COLUMN IF NOT EXISTS` makes this file safe to re-run even if it
-- has already been applied. Adding a NOT NULL column with a constant
-- DEFAULT to a table that already has rows (the already-seeded fixture
-- task) does not rewrite or lock the table in the way older PostgreSQL
-- versions once required -- the existing row(s) read the new column's
-- default value (`false`) without any explicit UPDATE, exactly the
-- correct value for a fixture task that has never been archived. No
-- DROP, no DELETE, no TRUNCATE, and no Client Share table of any kind is
-- touched by this file.
-- =========================================================

alter table public.tasks
  add column if not exists is_archived boolean not null default false;

select 'DISPOSABLE_TASKS_IS_ARCHIVED_PATCHED'::text as patch_status;
