-- Text2Task Client Share Link -- Phase 3 Application Runtime Verification
-- Package
-- File 01: Temporary test fixture
--
-- TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION
--
-- Run this FIRST, in a brand-new, empty, temporary Supabase project only.
-- Never run this in the real Text2Task production project.
--
-- Adapted from docs/client-share-phase3-rate-limit-runtime/01_CREATE_TEMP_
-- TEST_FIXTURE.sql (renamed sentinel, same minimal base schema -- Phase 3
-- application code added no new migration, so no new fixture-table
-- dependency exists either). This package additionally creates two real
-- share links (one without a PIN, one with a PIN) directly as fixture
-- rows in file 03's own transaction -- not here -- so file 01 itself
-- stays identical in shape to its sibling packages' own file 01.
--
-- Deterministic identity namespace:
--   Owner A (auth.users.id): 11111111-1111-4111-8111-111111111111

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
      'REFUSING TO RUN. This project already has %s table(s) that look like a real or non-empty Text2Task project: %s. This script only runs in a brand-new, EMPTY, temporary Supabase project.',
      array_length(v_existing, 1),
      array_to_string(v_existing, ', ')
    );
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.text2task_client_share_phase3_application_runtime_sentinel') is not null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 3 application runtime test sentinel already exists in this project. Create a brand-new temporary Supabase project instead of reusing this one.';
  end if;
end;
$$;

create table public.text2task_client_share_phase3_application_runtime_sentinel (
  id boolean primary key default true,
  project_kind text not null default 'DISPOSABLE_PHASE_3_APPLICATION_RUNTIME_TEST_PROJECT',
  fixture_version integer not null default 1,
  created_at timestamptz not null default now(),

  constraint text2task_client_share_phase3_application_runtime_sentinel_singleton_check
    check (id)
);

comment on table public.text2task_client_share_phase3_application_runtime_sentinel is
  'TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION. Proves this Supabase project is a disposable Phase 3 application runtime-verification test project.';

insert into public.text2task_client_share_phase3_application_runtime_sentinel default values;

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

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.project_timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now()
);

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

revoke all on table
  public.projects, public.tasks, public.clients, public.task_resources,
  public.project_updates, public.project_timeline_events
from public, anon, authenticated, service_role;

grant select on table
  public.projects, public.tasks, public.clients, public.task_resources,
  public.project_updates, public.project_timeline_events
to authenticated;

grant select on table
  public.projects, public.tasks, public.clients, public.task_resources,
  public.project_updates, public.project_timeline_events
to service_role;

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
  'phase3-application-runtime-fixture-owner-a@example.invalid',
  'phase3-application-runtime-fixture-not-a-real-credential',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false, '', '', '', ''
);

select 'READY'::text as fixture_status;
