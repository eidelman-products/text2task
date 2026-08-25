-- Text2Task Client Share Link -- Phase 8 Access Epoch Runtime Verification Package
-- File 01: Sentinel + base-table stand-ins + shared tracking tables
-- (hand-authored)
--
-- TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION
--
-- Run this FIRST, in a brand-new, empty, disposable Supabase project
-- created SOLELY for this Phase 8 Access Epoch runtime verification.
-- Never run this in the real Text2Task production project, and never run
-- this in any OTHER existing Client Share disposable project (Phase 3,
-- 1B, 1C, 2B, rate-limit, 6A, 6B, 6C) -- those already have schema
-- applied, which would collide with the empty-project check below.
--
-- public.projects, public.tasks, public.clients and public.task_resources
-- genuinely predate this repository's migration history (no migration in
-- supabase/migrations/ creates them anywhere) -- they are hand-authored
-- minimal stand-ins here, exactly matching the shape and convention every
-- prior Client Share runtime package has already used and proven
-- sufficient (see docs/client-share-phase6a-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql,
-- the closest precedent). public.project_updates, public.project_updates
-- itself and every real Client Share table are deliberately NOT
-- approximated here -- they are created for real by the authoritative
-- migrations File 02 applies verbatim.
--
-- Deterministic identity namespace for this package (distinct from every
-- other Client Share runtime package's own namespace purely for hygiene
-- -- collision does not actually matter, since each package targets its
-- own separate disposable project):
--   Owner (auth.users.id): 88888888-8888-4888-8888-888888888888
--
-- This file commits (no wrapping transaction, no rollback) -- the
-- sentinel, the base-table stand-ins, and the two Phase-8-specific
-- tracking tables are meant to persist across every subsequent file in
-- this package, unlike file 03's own internal begin/rollback block for
-- its behavioral (Section B onward) tests.

do $$
declare
  v_existing text[];
begin
  select array_agg(candidate.qualified_name order by candidate.qualified_name)
    into v_existing
    from (
      values
        ('public.projects'),
        ('public.tasks'),
        ('public.clients'),
        ('public.task_resources'),
        ('public.project_updates'),
        ('public.project_share_links'),
        ('public.share_messages')
    ) as candidate(qualified_name)
    where to_regclass(candidate.qualified_name) is not null;

  if v_existing is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. This project already has %s table(s) that look like a real or non-empty Text2Task project: %s. This script only runs in a brand-new, EMPTY, disposable Supabase project.',
      array_length(v_existing, 1),
      array_to_string(v_existing, ', ')
    );
  end if;

  if to_regclass('public.text2task_phase8_access_epoch_runtime_sentinel') is not null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. A Phase 8 Access Epoch runtime sentinel already exists in this project. Create a brand-new disposable Supabase project instead of reusing this one.';
  end if;
end;
$$;

create table public.text2task_phase8_access_epoch_runtime_sentinel (
  id boolean primary key default true,
  project_kind text not null default 'DISPOSABLE_PHASE_8_ACCESS_EPOCH_RUNTIME_TEST_PROJECT',
  created_at timestamptz not null default now(),

  constraint text2task_phase8_runtime_sentinel_singleton_check check (id)
);

comment on table public.text2task_phase8_access_epoch_runtime_sentinel is
  'TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION. Proves this Supabase project is a disposable Phase 8 Access Epoch runtime-verification test project.';

insert into public.text2task_phase8_access_epoch_runtime_sentinel default values;

-- =========================================================
-- Minimal stand-ins for the pre-migration-history base tables.
--
-- CORRECTED 2026-08-25 (Phase 8 disposable-run Step 3 failure): the
-- column set below was originally copied verbatim from
-- docs/client-share-phase6a-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql,
-- whose own claim ("proven sufficient to exercise the full Client Share
-- migration chain") was true ONLY for the chains that package actually
-- exercised -- none of which included a top-level, non-deferred DML
-- statement against public.projects/public.tasks/public.clients outside
-- a function body. This package's prerequisite chain uniquely includes
-- 202607270001_project_completion_reconciliation.sql, whose own "one-time
-- historical backfill" is a plain top-level `with ... update
-- public.projects ...` statement (not inside any CREATE FUNCTION body),
-- so it executes IMMEDIATELY when 02_APPLY_OR_VERIFY_PREREQUISITES.sql is
-- applied -- unlike a PL/pgSQL function body (which Postgres compiles and
-- semantically checks only on first CALL, not at CREATE time), a
-- top-level statement is checked and executed right away. That statement
-- failed with `column project.status does not exist` because the
-- original stand-in never defined it.
--
-- Fix: every public.projects/public.tasks/public.clients column
-- genuinely referenced anywhere in this package's full 17-migration
-- prerequisite chain (both column reads/writes qualified by a table
-- alias, AND the previously-missed UPDATE-SET-target and
-- INSERT-column-list forms, which are never alias-qualified) is now
-- present below -- mechanically re-audited across every one of the 17
-- files, not just the one column the failure message named. See this
-- package's own audit record in the conversation/response that produced
-- this correction for the full per-file dependency matrix. Types are
-- inferred conservatively from actual usage (explicit `::type` casts,
-- direct assignment from a known-typed expression) -- never invented --
-- and everything new is nullable with no CHECK constraint, since no
-- migration in this chain requires anything stronger to apply cleanly,
-- and this stand-in's job is column-existence/type-compatibility, not a
-- faithful full reproduction of Production's real constraints.
-- =========================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid null,
  deleted_at timestamptz null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Required by 202607270001/202608230002 (reconcile_project_completion's
  -- own top-level historical backfill UPDATE, and apply_project_update_transaction's
  -- client-detail mutation SET clauses):
  status text null,
  priority text null,
  priority_source text null,
  completed_at timestamptz null,
  client_name text null,
  contact_name text null,
  amount text null,
  amount_value numeric null,
  currency_code text null,
  deadline_text text null,
  deadline_date date null
);

create table public.tasks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  client_id uuid null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Required by 202607270001/202608230002 (reconcile_project_completion's
  -- own active-subtask-completion query, and apply_project_update_transaction's
  -- create_subtask/update_subtask mutation paths):
  is_archived boolean not null default false,
  archived_at timestamptz null,
  status text null,
  priority text null,
  completed_at timestamptz null,
  client_name text null,
  contact_name text null,
  amount text null,
  amount_value numeric null,
  currency_code text null,
  deadline_text text null,
  deadline_date date null,
  task_title text null,
  subtask_order integer null,
  source text null,
  raw_input text null
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Required by 202607270001/202608230002 (the client-detail mutation
  -- sub-block's own UPDATE SET clause, joined via projects.client_id ->
  -- clients.id, not clients.project_id -> projects.id -- the project_id
  -- column above is retained unmodified from the original phase6a-derived
  -- stand-in for continuity, but is not itself exercised by this chain):
  name text null,
  contact_name text null,
  email text null,
  phone text null,
  notes text null
);

create table public.task_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  task_id bigint null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.clients enable row level security;
alter table public.task_resources enable row level security;

create policy "Fixture owner select" on public.projects
  for select to authenticated using (auth.uid() = user_id);
create policy "Fixture owner select" on public.tasks
  for select to authenticated using (auth.uid() = user_id);
create policy "Fixture owner select" on public.clients
  for select to authenticated using (auth.uid() = user_id);
create policy "Fixture owner select" on public.task_resources
  for select to authenticated using (auth.uid() = user_id);

revoke all on table
  public.projects, public.tasks, public.clients, public.task_resources
from public, anon, authenticated, service_role;

grant select on table
  public.projects, public.tasks, public.clients, public.task_resources
to authenticated;

grant select on table
  public.projects, public.tasks, public.clients, public.task_resources
to service_role;

-- =========================================================
-- One owner, matching every prior Client Share runtime package's own
-- deterministic-identity convention.
-- =========================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token, email_change_token_new,
  email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '88888888-8888-4888-8888-888888888888',
  'authenticated',
  'authenticated',
  'phase8-access-epoch-runtime-fixture-owner@example.invalid',
  'phase8-access-epoch-runtime-fixture-not-a-real-credential',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false, '', '', '', ''
);

-- =========================================================
-- Two PERSISTENT (not pg_temp) tracking tables that survive across files
-- 01 through 03 in this same disposable project:
--   - text2task_phase8_fixture_ids   (key -> uuid, one row per named
--     fixture object created in file 02B, so later files can look up
--     "the no-PIN link's id" etc. without hand-copying values)
--   - text2task_phase8_before_snapshot (key -> jsonb, one row per fixture
--     object's FULL pre-migration column state, captured in file 02B
--     BEFORE 02C applies the access_epoch migration -- file 03's
--     Section A compares this snapshot against the post-migration state
--     to prove nothing unrelated changed)
-- =========================================================

create table public.text2task_phase8_fixture_ids (
  key text primary key,
  value uuid not null
);

create table public.text2task_phase8_before_snapshot (
  key text primary key,
  value jsonb not null
);

-- =========================================================
-- Final verification
-- =========================================================

select
  (select project_kind from public.text2task_phase8_access_epoch_runtime_sentinel) as sentinel_kind,
  (select count(*) from auth.users where id = '88888888-8888-4888-8888-888888888888') as owner_row_count,
  (select count(*) from public.text2task_phase8_fixture_ids) as fixture_ids_row_count,
  (select count(*) from public.text2task_phase8_before_snapshot) as before_snapshot_row_count,
  'FILE_01_PREPARE_RUNTIME_FIXTURES_COMPLETE' as status;
