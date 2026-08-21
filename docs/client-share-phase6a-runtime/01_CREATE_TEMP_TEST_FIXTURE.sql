-- Text2Task Client Share Link -- Phase 6A Runtime Verification Package
-- File 01: Temporary test fixture
--
-- TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION
--
-- Run this FIRST, in a brand-new, empty, temporary Supabase project
-- created SOLELY for Phase 6A runtime verification. Never run this in
-- the real Text2Task production project, and never run this in the
-- existing Phase 3/1B/1C/2B/rate-limit disposable project used for
-- earlier Client Share evidence -- that project already has Client Share
-- (and, depending on which package last ran there, other) schema
-- applied, which would collide with the empty-project check below.
--
-- Unlike every prior Client Share runtime package, this file does NOT
-- create public.project_updates or public.project_timeline_events as
-- hand-authored stand-ins. Phase 6A's own migration alters
-- public.project_updates' real source_type CHECK constraint and adds a
-- real cross-table integrity trigger to it, so this package needs the
-- REAL public.project_updates (with its real source_type/status CHECK
-- constraints, RLS and grants) created by the authoritative
-- 202605250001_project_update_engine.sql migration -- applied verbatim
-- by File 02, not approximated here. public.projects, public.tasks,
-- public.clients and public.task_resources genuinely predate this
-- repository's migration history (no migration creates them anywhere),
-- so they are hand-authored minimal stand-ins here, exactly as every
-- prior Client Share runtime package has done.
--
-- Deterministic identity namespace (matching every prior Client Share
-- runtime package's own convention exactly):
--   Owner A (auth.users.id): 11111111-1111-4111-8111-111111111111
--   Owner B (auth.users.id): 22222222-2222-4222-8222-222222222222

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
        ('public.project_timeline_events'),
        ('public.project_share_links'),
        ('public.share_messages')
    ) as candidate(qualified_name)
    where to_regclass(candidate.qualified_name) is not null;

  if v_existing is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. This project already has %s table(s) that look like a real or non-empty Text2Task project: %s. This script only runs in a brand-new, EMPTY, temporary Supabase project.',
      array_length(v_existing, 1),
      array_to_string(v_existing, ', ')
    );
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.text2task_client_share_phase6a_runtime_sentinel') is not null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 6A runtime test sentinel already exists in this project. Create a brand-new temporary Supabase project instead of reusing this one.';
  end if;
end;
$$;

create table public.text2task_client_share_phase6a_runtime_sentinel (
  id boolean primary key default true,
  project_kind text not null default 'DISPOSABLE_PHASE_6A_RUNTIME_TEST_PROJECT',
  fixture_version integer not null default 1,
  created_at timestamptz not null default now(),

  constraint text2task_client_share_phase6a_runtime_sentinel_singleton_check
    check (id)
);

comment on table public.text2task_client_share_phase6a_runtime_sentinel is
  'TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION. Proves this Supabase project is a disposable Phase 6A runtime-verification test project, dedicated to Phase 6A and not reused from any earlier Client Share package.';

insert into public.text2task_client_share_phase6a_runtime_sentinel default values;

-- =========================================================
-- Minimal stand-ins for the pre-migration-history base tables. Same
-- column shape every prior Client Share runtime package has already
-- proven sufficient to exercise the full Client Share migration chain
-- (docs/client-share-phase3-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql).
-- public.project_updates and public.project_timeline_events are
-- deliberately NOT created here -- see this file's own header comment.
-- =========================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now()
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
-- Two owners, matching every prior Client Share runtime package's own
-- deterministic identity convention exactly.
-- =========================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token, email_change_token_new,
  email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'phase6a-runtime-fixture-owner-a@example.invalid',
  'phase6a-runtime-fixture-not-a-real-credential',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false, '', '', '', ''
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token, email_change_token_new,
  email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-4222-8222-222222222222',
  'authenticated',
  'authenticated',
  'phase6a-runtime-fixture-owner-b@example.invalid',
  'phase6a-runtime-fixture-not-a-real-credential',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false, '', '', '', ''
);

select 'READY'::text as fixture_status;
