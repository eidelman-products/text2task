-- Text2Task Client Share Link -- Phase 2B Mapping-Read Corrective
-- Foundation Runtime Verification Package
-- File 01: Temporary test fixture
--
-- TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION
--
-- Run this FIRST, in a brand-new, empty, temporary Supabase project only.
-- Never run this in the real Text2Task production project.
--
-- What this file does:
--   1. Refuses to run at all if this project already looks like a real or
--      non-empty Text2Task project (fail-closed safety check).
--   2. Creates a permanent sentinel table proving this is a disposable
--      Phase 2B mapping-read runtime-verification test project, which
--      files 02 and 03 both require before they will run anything else.
--   3. Creates the smallest coherent test-only versions of the six existing
--      Text2Task tables the Client Share Link migrations reference by
--      foreign key or by trigger-body SELECT: projects, tasks, clients,
--      task_resources, project_updates, project_timeline_events.
--   4. Creates two deterministic auth.users test identities (Owner A,
--      Owner B) used throughout file 03.
--
-- Relationship to the Phase 1C runtime package
-- (docs/client-share-phase1c-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql): this
-- file is byte-for-byte identical except for its sentinel table name and
-- project_kind value, deliberately renamed so packages can never be
-- confused with each other -- a project set up for Phase 1C is not
-- silently accepted as a valid Phase 2B baseline, and vice versa. Every
-- other table, column, RLS policy and grant below is unchanged: the Phase
-- 2B corrective migration adds no new fixture-table dependency (it
-- extends get_share_link_management_state's own RETURN shape only, using
-- exactly the same share_link_tasks/share_link_resources columns Phase
-- 1B/1C already read).
--
-- This file copies NO production data and NO production schema definition
-- beyond the handful of columns the Client Share migrations actually
-- reference, and creates only the minimum needed to exercise the real
-- foreign keys and cross-table integrity triggers in
-- 202608030003_client_share_owner_foundation.sql,
-- 202608030004_client_share_session_foundation.sql,
-- 202608030005_client_share_integrity_and_security.sql, and the owner-
-- authenticated RPCs delivered through Phase 1B, Phase 1C and this Phase
-- 2B correction.
--
-- Deterministic identity namespace (documented here and in
-- 00_READ_ME_FIRST.md):
--   Owner A (auth.users.id): 11111111-1111-4111-8111-111111111111
--   Owner B (auth.users.id): 22222222-2222-4222-8222-222222222222
-- These two identities are the only FIXED UUID literals this fixture
-- creates. Every project, task and Resource fixture ROW is created inside
-- file 03's own transaction, exactly like the Phase 1C precedent, and
-- referenced there by a stable symbolic key rather than by a second layer
-- of hard-coded literals.

-- =========================================================
-- 0. Fail-closed safety check
--
-- Aborts BEFORE creating anything if any of the six real Text2Task
-- business tables already exist in this database. A brand-new Supabase
-- project has none of these, so this check only ever fires as a safety
-- net against running this file somewhere it must never run.
-- =========================================================

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
        ('public.project_timeline_events')
    ) as candidate(qualified_name)
    where to_regclass(candidate.qualified_name) is not null;

  if v_existing is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. This project already has %s table(s) that look like a real or non-empty Text2Task project: %s. This script only runs in a brand-new, EMPTY, temporary Supabase project. Stop now -- do not continue in this project -- and re-run this file only inside a fresh temporary project created for this test.',
      array_length(v_existing, 1),
      array_to_string(v_existing, ', ')
    );
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.text2task_client_share_phase2b_mapping_runtime_sentinel') is not null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 2B mapping-read runtime test sentinel already exists in this project, which means file 01 has already been run here. Re-running it would not be a clean baseline. If you intend to start over, create a brand-new temporary Supabase project instead of reusing this one.';
  end if;
end;
$$;

-- =========================================================
-- 1. Sentinel
--
-- A permanent, single-row marker proving this project is a disposable
-- Phase 2B mapping-read runtime-verification test project. Files 02 and
-- 03 both refuse to run unless this row exists. Deliberately a DIFFERENT
-- table name from the Phase 1B/1C packages' own sentinels, so no package
-- can ever be confused with another.
-- =========================================================

create table public.text2task_client_share_phase2b_mapping_runtime_sentinel (
  id boolean primary key default true,
  project_kind text not null default 'DISPOSABLE_PHASE_2B_MAPPING_RUNTIME_TEST_PROJECT',
  fixture_version integer not null default 1,
  created_at timestamptz not null default now(),

  constraint text2task_client_share_phase2b_mapping_runtime_sentinel_singleton_check
    check (id)
);

comment on table public.text2task_client_share_phase2b_mapping_runtime_sentinel is
  'TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION. Proves this Supabase project is a disposable Phase 2B mapping-read runtime-verification test project, never the real Text2Task production project. Files 02 and 03 refuse to run unless this row exists.';

insert into public.text2task_client_share_phase2b_mapping_runtime_sentinel default values;

-- =========================================================
-- 2. Minimal test-only Text2Task base schema
--
-- Only the columns the Client Share migrations (003-005, 050001,
-- 060001-3, 202608110001, 202608110002) actually reference by foreign
-- key, by trigger-body SELECT, or by RPC-body SELECT. Verified production
-- identifier types are preserved: projects/clients/task_resources/
-- project_updates/project_timeline_events use uuid ids; tasks uses a
-- bigint identity id, matching public.tasks.id in the real schema.
-- =========================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.projects is
  'TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION. Minimal stand-in for public.projects, containing only the columns the Client Share integrity triggers and RPCs read.';

create table public.tasks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);

comment on table public.tasks is
  'TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION. Minimal stand-in for public.tasks. id is bigint generated always as identity, matching the real production tasks.id type -- it never accepts an explicit inserted value, which is why fixture task rows are created inside file 03''s own transaction and captured via RETURNING rather than hard-coded as literals here.';

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.clients is
  'TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION. Not referenced by any Client Share migration in this package; created only for base-schema completeness.';

create table public.task_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  task_id bigint null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.task_resources is
  'TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION. Minimal stand-in for public.task_resources, containing only the columns enforce_share_link_resource_integrity() and save_share_configuration() read.';

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.project_updates is
  'TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION. Minimal stand-in for public.project_updates, containing only the columns enforce_share_message_conversion_integrity() reads. Not touched by any Phase 1B/1C/2B RPC in this package.';

create table public.project_timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.project_timeline_events is
  'TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION. Not referenced by any Client Share migration in this package; created only so this package could positively prove no row is ever written here.';

-- =========================================================
-- 3. Minimal RLS so the SECURITY INVOKER integrity triggers, and the
--    SECURITY INVOKER owner-read RPCs, can resolve ownership under an
--    authenticated caller identity.
-- =========================================================

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.clients enable row level security;
alter table public.task_resources enable row level security;
alter table public.project_updates enable row level security;
alter table public.project_timeline_events enable row level security;

create policy "Fixture owner select" on public.projects
  for select to authenticated using (auth.uid() = user_id);

create policy "Fixture owner select" on public.tasks
  for select to authenticated using (auth.uid() = user_id);

create policy "Fixture owner select" on public.clients
  for select to authenticated using (auth.uid() = user_id);

create policy "Fixture owner select" on public.task_resources
  for select to authenticated using (auth.uid() = user_id);

create policy "Fixture owner select" on public.project_updates
  for select to authenticated using (auth.uid() = user_id);

create policy "Fixture owner select" on public.project_timeline_events
  for select to authenticated using (auth.uid() = user_id);

-- =========================================================
-- 3b. Deterministic fixture-table privileges
-- =========================================================

revoke all on table
  public.projects,
  public.tasks,
  public.clients,
  public.task_resources,
  public.project_updates,
  public.project_timeline_events
from public, anon, authenticated, service_role;

grant select on table
  public.projects,
  public.tasks,
  public.clients,
  public.task_resources,
  public.project_updates,
  public.project_timeline_events
to authenticated;

grant select on table
  public.projects,
  public.tasks,
  public.clients,
  public.task_resources,
  public.project_updates,
  public.project_timeline_events
to service_role;

-- All fixture DML (INSERT/UPDATE/DELETE) is performed by this file and by
-- file 03 as the Postgres superuser session role, which owns these tables
-- and bypasses RLS entirely. No INSERT, UPDATE or DELETE privilege is
-- granted to anon, authenticated or service_role on any fixture table.

-- =========================================================
-- 4. Two deterministic auth.users test identities
--
-- Owner A: 11111111-1111-4111-8111-111111111111
-- Owner B: 22222222-2222-4222-8222-222222222222
-- =========================================================

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'phase2b-mapping-runtime-fixture-owner-a@example.invalid',
    'phase2b-mapping-runtime-fixture-not-a-real-credential',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'phase2b-mapping-runtime-fixture-owner-b@example.invalid',
    'phase2b-mapping-runtime-fixture-not-a-real-credential',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    '',
    '',
    '',
    ''
  );

-- If the insert above fails with a column-does-not-exist or
-- not-null-violation error, this Supabase project's auth.users schema
-- differs from the version this fixture was written against. Stop and
-- report the exact error rather than editing this file -- do not modify
-- the SQL while copying it, per 00_READ_ME_FIRST.md.

-- =========================================================
-- 5. Result
-- =========================================================

select 'READY'::text as fixture_status;
