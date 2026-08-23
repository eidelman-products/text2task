-- Text2Task Client Share Link -- Phase 6C Runtime Verification Package
-- File 01: Extend base-table fixture columns for a FULL successful Apply
--
-- TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION
--
-- Run this SECOND, after the Phase 6A package's own 01 (fixture) + 02
-- (real Client Share migrations) have already been applied in this
-- disposable project, and after the Phase 6B boundary migration
-- (supabase/migrations/202608230001_client_share_apply_boundary.sql) has
-- already been applied. Never run this in the real Text2Task production
-- project. Never run this against the Phase 6A/6B package's own files --
-- this is an ADDITIVE extension in a NEW file; neither
-- docs/client-share-phase6a-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql nor
-- any Phase 6B package file is modified by this one.
--
-- WHY THIS FILE EXISTS (the actual dependency gap, traced directly, not
-- assumed):
--
-- Phase 6B's own runtime package only ever needed
-- apply_project_update_transaction's very FIRST precondition check
-- (APPLY_ATTEMPT_MISMATCH) to fire -- it never reached any statement that
-- touches public.projects/public.tasks/public.clients beyond their
-- id/user_id/deleted_at/is_archived columns, which the Phase 6A fixture's
-- minimal stand-ins already carry. Phase 6C's own runtime matrix requires
-- a REAL, FULLY SUCCESSFUL Apply to complete end-to-end -- accepted work
-- mutation, timeline event, item/update status writes, the row-bound
-- capability, and the conversion closure -- which means every column the
-- authoritative apply_project_update_transaction and
-- reconcile_project_completion (both in
-- supabase/migrations/202607270001_project_completion_reconciliation.sql)
-- actually read or write on these three tables must exist here, or the
-- transaction fails with an ordinary Postgres "column does not exist"
-- error long before Phase 6C's own new logic is ever reached.
--
-- SOURCE OF EVIDENCE FOR EVERY COLUMN ADDED BELOW: this repository has NO
-- CREATE TABLE migration for public.projects, public.tasks, or
-- public.clients anywhere in its history (confirmed by repository-wide
-- grep, and already noted by the Phase 6A fixture's own header comment)
-- -- exactly like the Phase 6A/6B fixture's own existing minimal columns,
-- there is no authoritative migration source for these tables' real
-- production shape to reconstruct from. Every column below is therefore
-- DIRECTLY DERIVED from actual usage, not guessed or invented:
--   - every column apply_project_update_transaction itself reads or
--     writes on projects/tasks/clients (traced by direct read of
--     202607270001_project_completion_reconciliation.sql)
--   - every column reconcile_project_completion itself reads or writes
--   - every column app/api/project-updates/apply/route.ts's own explicit
--     SELECT column lists name (loadProjectUpdateForApply,
--     reloadProjectAfterApply) -- the same route this whole feature calls
-- No column below is invented beyond this evidence. Types are chosen from
-- the SAME evidence (an explicit `::numeric`/`::date` cast in the RPC
-- proves a numeric/date column; a string literal comparison proves text).
-- No CHECK constraint is added for any status/priority column -- the
-- exact real production CHECK values are not evidenced anywhere in this
-- repository, and inventing one here would risk being MORE restrictive
-- than production, silently masking a real bug. Every added column is
-- nullable with no default beyond what is directly evidenced (e.g.
-- is_archived already defaults false in the Phase 6A fixture) -- this
-- keeps the fixture permissive, matching its own established minimal-
-- stand-in philosophy, not a claim of exact production parity.
--
-- If Phase 6C runtime evidence (once the user actually executes this
-- package) reveals that any of these inferred columns/types is wrong,
-- correct THIS file and re-run -- do not weaken
-- apply_project_update_transaction or reconcile_project_completion (both
-- untouched, authoritative, migration-sourced) to fit an inaccurate
-- fixture guess.
--
-- REVISION NOTE (runtime attempt #1 finding): the columns added by this
-- file were sufficient, but the first real disposable-project run of
-- 03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql failed with
-- `42501 permission denied for table projects` -- a separate,
-- privilege-only gap (missing `authenticated` INSERT/UPDATE/DELETE
-- grants and RLS policies on these same three tables, not a column gap).
-- This file's own idempotency guard (the phase6c_runtime_sentinel table)
-- already exists in any disposable project where this file has already
-- run once, so the correction for that finding is a SEPARATE, additive
-- file -- 01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql -- rather than
-- an edit to this one, so a project that has already run this exact file
-- successfully never needs to reset anything to pick up the fix. See
-- that file's own header for the full root-cause trace and evidence.

do $$
begin
  if to_regclass('public.text2task_client_share_phase6a_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 6A runtime fixture sentinel was not found. Run docs/client-share-phase6a-runtime''s own 01+02 in this disposable project first.';
  end if;

  if to_regprocedure('public.apply_project_update_transaction(uuid,uuid,uuid[],uuid[],jsonb,jsonb)') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. apply_project_update_transaction was not found. Apply supabase/migrations/202608230002_client_share_apply_conversion_closure.sql (and its own prerequisite chain -- see this package''s 00_READ_ME_FIRST.md) in this project first.';
  end if;

  if to_regclass('public.text2task_client_share_phase6c_runtime_sentinel') is not null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. This extension has already been applied in this project (the Phase 6C runtime sentinel already exists). Re-running would attempt to add already-existing columns.';
  end if;
end;
$$;

create table public.text2task_client_share_phase6c_runtime_sentinel (
  id boolean primary key default true,
  project_kind text not null default 'DISPOSABLE_PHASE_6C_RUNTIME_TEST_PROJECT',
  fixture_version integer not null default 1,
  created_at timestamptz not null default now(),

  constraint text2task_client_share_phase6c_runtime_sentinel_singleton_check
    check (id)
);

comment on table public.text2task_client_share_phase6c_runtime_sentinel is
  'TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION. Proves this Supabase project has had the Phase 6C base-table column extension applied on top of the Phase 6A fixture.';

insert into public.text2task_client_share_phase6c_runtime_sentinel default values;

-- =========================================================
-- public.projects -- columns read/written by
-- apply_project_update_transaction, reconcile_project_completion, and
-- the Apply route's own explicit SELECT lists.
-- =========================================================

alter table public.projects
  add column if not exists title text null,
  add column if not exists summary text null,
  add column if not exists client_id uuid null references public.clients(id) on delete set null,
  add column if not exists client_name text null,
  add column if not exists contact_name text null,
  add column if not exists amount text null,
  add column if not exists amount_value numeric null,
  add column if not exists currency_code text null,
  add column if not exists deadline_text text null,
  add column if not exists deadline_date date null,
  add column if not exists priority text null,
  add column if not exists priority_source text null,
  add column if not exists status text null,
  add column if not exists source text null,
  add column if not exists raw_input text null,
  add column if not exists completed_at timestamptz null,
  add column if not exists archived_at timestamptz null,
  add column if not exists updated_at timestamptz null;

-- =========================================================
-- public.tasks -- columns read/written by
-- apply_project_update_transaction (new_subtask INSERT, update_subtask
-- UPDATE, client_detail_change UPDATE) and reconcile_project_completion.
-- =========================================================

alter table public.tasks
  add column if not exists client_id uuid null references public.clients(id) on delete set null,
  add column if not exists client_name text null,
  add column if not exists contact_name text null,
  add column if not exists subtask_order integer null,
  add column if not exists task_title text null,
  add column if not exists amount text null,
  add column if not exists amount_value numeric null,
  add column if not exists currency_code text null,
  add column if not exists deadline_text text null,
  add column if not exists deadline_date date null,
  add column if not exists priority text null,
  add column if not exists status text null,
  add column if not exists source text null,
  add column if not exists raw_input text null,
  add column if not exists completed_at timestamptz null,
  add column if not exists archived_at timestamptz null,
  add column if not exists updated_at timestamptz null;

-- =========================================================
-- public.clients -- columns read/written by
-- apply_project_update_transaction's client_detail_change branch.
-- =========================================================

alter table public.clients
  add column if not exists name text null,
  add column if not exists contact_name text null,
  add column if not exists phone text null,
  add column if not exists email text null,
  add column if not exists notes text null;

-- =========================================================
-- FINAL VERIFICATION (generated -- not part of any migration)
--
-- Confirms every column this file was supposed to add now exists, on the
-- correct table, so a typo in the ALTER TABLE list above fails loudly
-- here rather than surfacing later as a confusing mid-Apply error.
-- =========================================================

do $$
declare
  v_missing text[];
begin
  select array_agg(expected.qualified_column order by expected.qualified_column)
    into v_missing
    from (
      values
        ('public.projects', 'title'), ('public.projects', 'summary'),
        ('public.projects', 'client_id'), ('public.projects', 'client_name'),
        ('public.projects', 'contact_name'), ('public.projects', 'amount'),
        ('public.projects', 'amount_value'), ('public.projects', 'currency_code'),
        ('public.projects', 'deadline_text'), ('public.projects', 'deadline_date'),
        ('public.projects', 'priority'), ('public.projects', 'priority_source'),
        ('public.projects', 'status'), ('public.projects', 'source'),
        ('public.projects', 'raw_input'), ('public.projects', 'completed_at'),
        ('public.projects', 'archived_at'), ('public.projects', 'updated_at'),
        ('public.tasks', 'client_id'), ('public.tasks', 'client_name'),
        ('public.tasks', 'contact_name'), ('public.tasks', 'subtask_order'),
        ('public.tasks', 'task_title'), ('public.tasks', 'amount'),
        ('public.tasks', 'amount_value'), ('public.tasks', 'currency_code'),
        ('public.tasks', 'deadline_text'), ('public.tasks', 'deadline_date'),
        ('public.tasks', 'priority'), ('public.tasks', 'status'),
        ('public.tasks', 'source'), ('public.tasks', 'raw_input'),
        ('public.tasks', 'completed_at'), ('public.tasks', 'archived_at'),
        ('public.tasks', 'updated_at'),
        ('public.clients', 'name'), ('public.clients', 'contact_name'),
        ('public.clients', 'phone'), ('public.clients', 'email'),
        ('public.clients', 'notes')
    ) as expected(qualified_table, qualified_column)
    where not exists (
      select 1
      from information_schema.columns as col
      where col.table_schema = 'public'
        and col.table_name = split_part(expected.qualified_table, '.', 2)
        and col.column_name = expected.qualified_column
    );

  if v_missing is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO CONTINUE. Expected column(s) still missing after the ALTER TABLE statements above: %s.',
      array_to_string(v_missing, ', ')
    );
  end if;
end;
$$;

select 'PHASE_6C_BASE_TABLE_EXTENSION_READY'::text as fixture_status;
