-- Text2Task Client Share Link -- Phase 3 Browser Acceptance Fixture
-- Package
-- File 01: Extend the disposable app schema
--
-- DISPOSABLE TEST PROJECT ONLY
-- PRODUCTION APPLICATION NOT AUTHORIZED
--
-- Run this ONLY in the SAME disposable Supabase project already used by
-- docs/client-share-phase3-runtime/ (01_CREATE_TEMP_TEST_FIXTURE.sql and
-- 02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_APPLICATION.sql must already be
-- applied there). Never run this in the real Text2Task production
-- project. This file does not touch, re-run, or modify either of those
-- two files -- it only ADDS to the schema they already created.
--
-- PURPOSE: the runtime package's own fixture (01_CREATE_TEMP_TEST_FIXTURE.sql)
-- deliberately created only the bare minimum projects/tasks/clients/
-- task_resources shape SQL File 03's own integrity-trigger tests needed
-- (id/user_id/project_id/deleted_at). That shape is not sufficient to run
-- the REAL Text2Task dashboard, login bootstrap, or the Phase 3 public
-- projection reader, all of which select/insert additional columns by
-- exact name. This file adds exactly those columns -- and nothing else --
-- based on direct inspection of the actual application code:
--   - app/api/tasks/route.ts (project/task/client creation + the exact
--     select lists used after insert)
--   - lib/tasks/load-dashboard-tasks.server.ts (the dashboard's own task/
--     project/client read query)
--   - lib/supabase/ensureUser.ts (the public.users login-bootstrap table)
--   - lib/share/client-share-projection.server.ts's
--     buildPublicClientShareProjection (the exact projects/tasks/
--     task_resources columns the Phase 3 public projection selects)
--   - app/components/dashboard/resources/resource-api.ts's
--     isFileResource/isLinkResource/isNoteResource (the exact Resource
--     classification the projection depends on)
--
-- This file does NOT recreate the full Production Text2Task schema.
-- No billing/subscription table, no analytics/product-activity table, no
-- calendar table, and no column beyond the ones the traced code paths
-- actually select or insert are added. Column TYPES are deliberately
-- permissive (mostly nullable text) rather than an exact match of
-- Production's own types -- this is a disposable read/write
-- compatibility shim for browser acceptance, not a schema clone.
--
-- SEQUENCING: run this SECOND in this new package, after confirming
-- Files 01+02 of docs/client-share-phase3-runtime/ are already applied,
-- and BEFORE creating any disposable Supabase Auth user. This file does
-- NOT require the future owner Auth user to exist -- it only creates
-- schema, never data tied to a specific auth.users row.

-- =========================================================
-- Safety gate
-- =========================================================

do $$
declare
  v_sentinel_kind text;
begin
  if to_regclass('public.text2task_client_share_phase3_application_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. DISPOSABLE TEST PROJECT ONLY. PRODUCTION APPLICATION NOT AUTHORIZED. The Phase 3 application runtime test sentinel (from docs/client-share-phase3-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql) was not found. Run that package''s files 01 and 02 in this same disposable Supabase project first.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase3_application_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_3_APPLICATION_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. DISPOSABLE TEST PROJECT ONLY. PRODUCTION APPLICATION NOT AUTHORIZED. The sentinel row does not identify this project as the disposable Phase 3 application runtime test project. SQL cannot securely infer the Supabase dashboard project name, so this check is the only trust boundary -- never bypass it.';
  end if;

  if to_regclass('public.project_share_links') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. Client Share migrations (docs/client-share-phase3-runtime/02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_APPLICATION.sql) were not found in this project. Apply that file first.';
  end if;

  if to_regclass('public.users') is not null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.users already exists in this project. This script only extends a fixture where its target objects do not yet exist, so it never silently alters an unknown existing structure. If this package''s schema extension genuinely needs to change, drop the disposable project and start over from docs/client-share-phase3-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql rather than re-running this file against a partially-extended project.';
  end if;
end;
$$;

-- =========================================================
-- 1. public.users -- the login/dashboard bootstrap table
--    (lib/supabase/ensureUser.ts's own USER_SELECT column list, verbatim)
--
-- Only ever read/written through the service-role client
-- (lib/supabase/ensureUser.ts uses supabaseAdmin exclusively) -- the
-- browser/RLS-bound client never queries this table directly anywhere in
-- the traced code, so `authenticated` needs SELECT only, as defense in
-- depth, never INSERT/UPDATE.
-- =========================================================

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text not null default 'free',
  extract_count integer not null default 0,
  subscription_status text not null default 'free',
  created_at timestamptz not null default now(),

  constraint users_email_unique unique (email)
);

comment on table public.users is
  'DISPOSABLE FIXTURE ONLY. Minimal login/dashboard bootstrap table matching lib/supabase/ensureUser.ts''s exact column contract (id, email, plan, extract_count, subscription_status). Never a copy of any Production users data.';

alter table public.users enable row level security;

create policy "Fixture owner select" on public.users
  for select to authenticated using (auth.uid() = id);

revoke all on table public.users from public, anon, authenticated, service_role;
grant select on table public.users to authenticated;
grant select, insert, update on table public.users to service_role;

-- =========================================================
-- 2. public.clients -- widen to the real dashboard's exact column set
--    (app/api/tasks/route.ts's upsertClientForUser select/insert lists)
-- =========================================================

alter table public.clients
  add column name text not null default '',
  add column contact_name text null,
  add column phone text null,
  add column email text null,
  add column notes text null;

alter table public.clients alter column name drop default;

-- =========================================================
-- 3. public.projects -- widen to the real dashboard's exact column set
--    (app/api/tasks/route.ts's createProjectWithSubtasks insert list and
--    the projects(...) embedded select in both app/api/tasks/route.ts and
--    lib/tasks/load-dashboard-tasks.server.ts's dashboardTaskSelect, plus
--    buildPublicClientShareProjection's own title/status/deadline_date
--    read)
-- =========================================================

alter table public.projects
  add column client_id uuid null references public.clients(id) on delete set null,
  add column client_name text null,
  add column contact_name text null,
  add column title text null,
  add column summary text null,
  add column amount text null,
  add column amount_value numeric null,
  add column currency_code text null,
  add column deadline_text text null,
  add column deadline_date text null,
  add column priority text null,
  add column priority_source text null,
  add column status text null,
  add column source text null,
  add column raw_input text null,
  add column updated_at timestamptz not null default now(),
  add column completed_at timestamptz null,
  add column archived_at timestamptz null;

comment on column public.projects.deadline_date is
  'DISPOSABLE FIXTURE ONLY: kept as text, not date, deliberately -- this column''s exact Production type does not affect anything read/written by the traced Phase 3 browser-acceptance code paths, which only ever pass it through as an opaque value (lib/tasks/parse-deadline.ts''s own output, and buildPublicClientShareProjection''s pass-through read). Using text avoids an unnecessary type-compatibility risk in a fixture never intended to match Production''s schema exactly.';

-- =========================================================
-- 4. public.tasks -- widen to the real dashboard's exact column set
--    (app/api/tasks/route.ts's task insert list, dashboardTaskSelect's
--    `*`, and buildPublicClientShareProjection's own task_title read)
--
--    is_archived: no committed migration in supabase/migrations/ defines
--    public.tasks itself (the core app schema predates this repository's
--    migration history entirely). Best available evidence:
--    app/api/tasks/route.ts's task insert always supplies
--    `is_archived: false` explicitly (never relying on a default);
--    several migrations' own read queries (e.g.
--    202607270001_project_completion_reconciliation.sql) defensively
--    treat `is_archived is null` as equivalent to `false`; and the
--    sibling `projects.is_archived` column (already present from
--    docs/client-share-phase3-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql) is
--    `boolean not null default false`. `not null default false` is used
--    here for the same reason -- it satisfies every actual observed
--    write and is trivially compatible with null-tolerant reads, while
--    Production's true nullability could not be confirmed from any file
--    in this repository.
-- =========================================================

alter table public.tasks
  add column client_id uuid null references public.clients(id) on delete set null,
  add column client_name text null,
  add column contact_name text null,
  add column subtask_order integer null,
  add column task_title text null,
  add column amount text null,
  add column amount_value numeric null,
  add column currency_code text null,
  add column deadline_text text null,
  add column deadline_date text null,
  add column priority text null,
  add column status text null,
  add column source text null,
  add column raw_input text null,
  add column is_archived boolean not null default false,
  add column archived_at timestamptz null,
  add column completed_at timestamptz null;

-- =========================================================
-- 5. public.task_resources -- widen to the real dashboard's exact
--    column set (app/api/tasks/route.ts's TaskResourceInsertRow shape,
--    and buildPublicClientShareProjection's own
--    url/storage_path/file_name/resource_type read, and
--    resource-api.ts's isFileResource/isLinkResource/isNoteResource
--    classification, which this fixture's seed step in File 02 must
--    satisfy for a LINK resource specifically)
-- =========================================================

alter table public.task_resources
  add column resource_type text null,
  add column title text null,
  add column url text null,
  add column storage_path text null,
  add column file_name text null,
  add column mime_type text null,
  add column size_bytes bigint null,
  add column notes text null;

-- =========================================================
-- 6. Authenticated write access -- the current runtime-package fixture
--    granted SELECT only. The real dashboard INSERTs/UPDATEs projects,
--    tasks, and clients as the authenticated owner (never through
--    service-role), so this package adds exactly that -- owner-scoped,
--    never using(true)/with check(true), and never granted to anon.
-- =========================================================

create policy "Fixture owner insert" on public.projects
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Fixture owner update" on public.projects
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Fixture owner insert" on public.tasks
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Fixture owner update" on public.tasks
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Fixture owner insert" on public.clients
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Fixture owner update" on public.clients
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Fixture owner insert" on public.task_resources
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Fixture owner update" on public.task_resources
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant insert, update on table public.projects to authenticated;
grant insert, update on table public.tasks to authenticated;
grant insert, update on table public.clients to authenticated;
grant insert, update on table public.task_resources to authenticated;

-- No anon grant of any kind is added anywhere in this file. Public Client
-- Share access continues to use only the service-role server path
-- (lib/share/*.server.ts), exactly as the runtime package's own migrations
-- already established -- this file does not change that in any way.

select 'DISPOSABLE_APP_SCHEMA_EXTENDED'::text as schema_extension_status;
