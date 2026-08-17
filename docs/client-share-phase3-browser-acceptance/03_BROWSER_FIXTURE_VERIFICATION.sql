-- Text2Task Client Share Link -- Phase 3 Browser Acceptance Fixture
-- Package
-- File 03: Browser fixture verification (READ-ONLY)
--
-- DISPOSABLE TEST PROJECT ONLY
-- PRODUCTION APPLICATION NOT AUTHORIZED
--
-- Run this FOURTH, after Files 01 and 02 of this package. Never run this
-- in the real Text2Task production project.
--
-- This file performs NO INSERT, UPDATE, or DELETE against any persistent
-- table -- every check below is a SELECT, an information_schema lookup,
-- or a privilege check. The only objects it creates are a session-scoped
-- temporary table and a session-scoped pg_temp function, neither of
-- which touches or survives outside this one connection. Safe to re-run
-- as many times as needed.
--
-- Produces a PASS/FAIL row per check, a totals row, a FAIL-only row set,
-- and a final queryable verdict row reading `browser_fixture_status =
-- READY` only when every check passes, or `NOT_READY` otherwise.
--
-- IMPORTANT: this file deliberately never raises an exception. An
-- earlier revision ended with `raise exception` on any failed check --
-- correct in intent (make a failure unmissable), but it had a harmful
-- side effect: pasted into the Supabase SQL Editor, this entire file is
-- sent as one multi-statement query, which Postgres executes as a single
-- implicit transaction even with no explicit BEGIN/COMMIT in the script
-- itself. A `raise exception` anywhere in that batch aborts the whole
-- transaction, which rolls back everything since the start of the
-- script -- including the `create temporary table` a few statements
-- above, since DDL is transactional too. The result: the FAIL-only table
-- this file had already produced became unrecoverable, and any follow-up
-- `select ... from browser_fixture_checks` in a later, separate query
-- failed with `42P01: relation "browser_fixture_checks" does not exist`,
-- because the table had never actually survived to be committed. This
-- file now reports failure only through its own result rows -- a FAIL
-- status, a nonzero failed_checks count, and a NOT_READY verdict row --
-- never through an exception, so every result set it produces remains
-- queryable regardless of outcome. See
-- docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md,
-- Run 1, for the exact incident this correction fixes.

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
end;
$$;

create temporary table browser_fixture_checks (
  seq integer generated always as identity,
  section text not null,
  name text not null,
  status text not null,
  detail text null
);

create or replace function pg_temp.record_check(
  p_section text,
  p_name text,
  p_passed boolean,
  p_detail text default null
) returns void
language plpgsql
as $$
begin
  insert into browser_fixture_checks (section, name, status, detail)
  values (p_section, p_name, case when p_passed then 'PASS' else 'FAIL' end, p_detail);
end;
$$;

-- =========================================================
-- Section A: public.users
-- =========================================================

do $$
begin
  perform pg_temp.record_check(
    'A', 'A1: public.users table exists',
    to_regclass('public.users') is not null
  );

  perform pg_temp.record_check(
    'A', 'A2: public.users has the exact columns ensureUser.ts requires',
    (
      select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'users'
        and column_name in ('id', 'email', 'plan', 'extract_count', 'subscription_status')
    ) = 5
  );
end;
$$;

-- =========================================================
-- Section B: projects / tasks / clients / task_resources column closure
-- =========================================================

do $$
declare
  v_projects_expected constant text[] := array[
    'id', 'user_id', 'client_id', 'client_name', 'contact_name', 'title',
    'summary', 'amount', 'amount_value', 'currency_code', 'deadline_text',
    'deadline_date', 'priority', 'priority_source', 'status', 'source',
    'raw_input', 'created_at', 'updated_at', 'completed_at', 'is_archived',
    'archived_at', 'deleted_at'
  ];
  v_tasks_expected constant text[] := array[
    'id', 'user_id', 'client_id', 'client_name', 'contact_name', 'project_id',
    'subtask_order', 'task_title', 'amount', 'amount_value', 'currency_code',
    'deadline_text', 'deadline_date', 'priority', 'status', 'source',
    'raw_input', 'is_archived', 'archived_at', 'completed_at', 'deleted_at',
    'created_at'
  ];
  v_clients_expected constant text[] := array[
    'id', 'user_id', 'name', 'contact_name', 'phone', 'email', 'notes', 'created_at'
  ];
  v_task_resources_expected constant text[] := array[
    'id', 'user_id', 'project_id', 'task_id', 'resource_type', 'title',
    'url', 'storage_path', 'file_name', 'mime_type', 'size_bytes', 'notes',
    'created_at'
  ];
  v_found_count integer;
begin
  select count(*) into v_found_count
    from information_schema.columns
    where table_schema = 'public' and table_name = 'projects'
      and column_name = any (v_projects_expected);
  perform pg_temp.record_check(
    'B', 'B1: projects has every column the real dashboard/projection code selects or inserts',
    v_found_count = array_length(v_projects_expected, 1),
    format('%s of %s expected columns found', v_found_count, array_length(v_projects_expected, 1))
  );

  select count(*) into v_found_count
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks'
      and column_name = any (v_tasks_expected);
  perform pg_temp.record_check(
    'B', 'B2: tasks has every column the real dashboard/projection code selects or inserts',
    v_found_count = array_length(v_tasks_expected, 1),
    format('%s of %s expected columns found', v_found_count, array_length(v_tasks_expected, 1))
  );

  select count(*) into v_found_count
    from information_schema.columns
    where table_schema = 'public' and table_name = 'clients'
      and column_name = any (v_clients_expected);
  perform pg_temp.record_check(
    'B', 'B3: clients has every column the real dashboard code selects or inserts',
    v_found_count = array_length(v_clients_expected, 1),
    format('%s of %s expected columns found', v_found_count, array_length(v_clients_expected, 1))
  );

  select count(*) into v_found_count
    from information_schema.columns
    where table_schema = 'public' and table_name = 'task_resources'
      and column_name = any (v_task_resources_expected);
  perform pg_temp.record_check(
    'B', 'B4: task_resources has every column the real dashboard/projection code selects or inserts',
    v_found_count = array_length(v_task_resources_expected, 1),
    format('%s of %s expected columns found', v_found_count, array_length(v_task_resources_expected, 1))
  );
end;
$$;

-- =========================================================
-- Section C: seeded owner/project/task/resource content
-- =========================================================

do $$
declare
  v_deterministic_email constant text := 'phase3-browser-owner@example.invalid';
  v_project_id constant uuid := '33333333-3333-4333-8333-333333333333';
  v_resource_id constant uuid := '44444444-4444-4444-8444-444444444444';
  v_owner_id uuid;
  v_task_id bigint;
  v_task_user_id uuid;
  v_task_project_id uuid;
  v_resource_user_id uuid;
  v_resource_project_id uuid;
  v_resource_task_id bigint;
  v_resource_type text;
  v_resource_url text;
  v_resource_storage_path text;
  v_resource_file_name text;
begin
  select id into v_owner_id from public.users where email = v_deterministic_email;
  perform pg_temp.record_check(
    'C', 'C1: the disposable owner row exists in public.users',
    v_owner_id is not null
  );

  perform pg_temp.record_check(
    'C', 'C2: the seeded fixture project exists, owned by the disposable owner',
    exists (
      select 1 from public.projects
      where id = v_project_id and user_id = v_owner_id and deleted_at is null
    )
  );

  select task.id, task.user_id, task.project_id
    into v_task_id, v_task_user_id, v_task_project_id
    from public.tasks as task
    where task.project_id = v_project_id
      and task.task_title = 'Phase 3 browser fixture task'
    limit 1;
  perform pg_temp.record_check(
    'C', 'C3: the seeded fixture task exists, owned by the disposable owner, scoped to the fixture project',
    v_task_id is not null and v_task_user_id = v_owner_id and v_task_project_id = v_project_id
  );

  select
      resource.user_id, resource.project_id, resource.task_id,
      resource.resource_type, resource.url, resource.storage_path, resource.file_name
    into
      v_resource_user_id, v_resource_project_id, v_resource_task_id,
      v_resource_type, v_resource_url, v_resource_storage_path, v_resource_file_name
    from public.task_resources as resource
    where resource.id = v_resource_id;
  perform pg_temp.record_check(
    'C', 'C4: the seeded fixture resource exists, owned by the disposable owner, scoped to the fixture project/task',
    v_resource_user_id = v_owner_id
      and v_resource_project_id = v_project_id
      and v_resource_task_id = v_task_id
  );

  perform pg_temp.record_check(
    'C', 'C5: the seeded fixture resource classifies as a LINK resource under resource-api.ts''s own rules (resource_type <> ''note'', no storage_path, no file_name, url present)',
    coalesce(v_resource_type, '') <> 'note'
      and v_resource_storage_path is null
      and v_resource_file_name is null
      and v_resource_url is not null
  );
end;
$$;

-- =========================================================
-- Section D: expected authenticated grants/policies, no anon access
-- =========================================================

do $$
begin
  perform pg_temp.record_check(
    'D', 'D1: authenticated may INSERT/UPDATE its own projects/tasks/clients/task_resources rows',
    has_table_privilege('authenticated', 'public.projects', 'INSERT')
      and has_table_privilege('authenticated', 'public.projects', 'UPDATE')
      and has_table_privilege('authenticated', 'public.tasks', 'INSERT')
      and has_table_privilege('authenticated', 'public.tasks', 'UPDATE')
      and has_table_privilege('authenticated', 'public.clients', 'INSERT')
      and has_table_privilege('authenticated', 'public.clients', 'UPDATE')
      and has_table_privilege('authenticated', 'public.task_resources', 'INSERT')
      and has_table_privilege('authenticated', 'public.task_resources', 'UPDATE')
  );

  perform pg_temp.record_check(
    'D', 'D2: authenticated has SELECT-only (no write) on public.users',
    has_table_privilege('authenticated', 'public.users', 'SELECT')
      and not has_table_privilege('authenticated', 'public.users', 'INSERT')
      and not has_table_privilege('authenticated', 'public.users', 'UPDATE')
  );

  perform pg_temp.record_check(
    'D', 'D3: anon has no privilege at all on any of these four core app tables',
    not has_table_privilege('anon', 'public.projects', 'SELECT')
      and not has_table_privilege('anon', 'public.tasks', 'SELECT')
      and not has_table_privilege('anon', 'public.clients', 'SELECT')
      and not has_table_privilege('anon', 'public.task_resources', 'SELECT')
      and not has_table_privilege('anon', 'public.users', 'SELECT')
  );

  perform pg_temp.record_check(
    'D', 'D4: RLS is enabled on every extended core app table',
    (select relrowsecurity from pg_class where oid = 'public.projects'::regclass)
      and (select relrowsecurity from pg_class where oid = 'public.tasks'::regclass)
      and (select relrowsecurity from pg_class where oid = 'public.clients'::regclass)
      and (select relrowsecurity from pg_class where oid = 'public.task_resources'::regclass)
      and (select relrowsecurity from pg_class where oid = 'public.users'::regclass)
  );
end;
$$;

-- =========================================================
-- Section E: Client Share RPCs still present (unmodified by this package)
-- =========================================================

do $$
declare
  v_missing text[];
begin
  select array_agg(t.fn) into v_missing
    from (values
      ('create_share_link_draft(uuid,text)'),
      ('activate_share_link(uuid,text,smallint,text,text,text,smallint)'),
      ('disable_share_link(uuid)'),
      ('reenable_share_link(uuid)'),
      ('rotate_share_link_secret(uuid,text,smallint,text,text,text,smallint)'),
      ('set_share_link_pin(uuid,text,text,smallint,integer,integer,integer,integer)'),
      ('clear_share_link_pin(uuid)'),
      ('revoke_share_link(uuid)'),
      ('save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)'),
      ('get_share_link_management_state(uuid)'),
      ('list_share_link_summaries(uuid[])'),
      ('increment_share_rate_limit_bucket(text,text,text,smallint,uuid,integer)')
    ) as t(fn)
    where to_regprocedure('public.' || t.fn) is null;

  perform pg_temp.record_check(
    'E', 'E1: every Client Share RPC this browser-acceptance pass depends on still exists, unmodified by this package',
    v_missing is null,
    case when v_missing is not null then array_to_string(v_missing, ', ') else null end
  );
end;
$$;

-- =========================================================
-- Results
-- =========================================================

select seq, section, name, status, detail from browser_fixture_checks order by seq;

select
  count(*) as total_checks,
  count(*) filter (where status = 'PASS') as passed_checks,
  count(*) filter (where status = 'FAIL') as failed_checks
from browser_fixture_checks;

select seq, section, name, status, detail
from browser_fixture_checks
where status = 'FAIL'
order by seq;

-- Final verdict as a plain, always-returned result row -- never an
-- exception, so this row (and the three result sets above it) remain
-- visible and queryable regardless of outcome. READY only when every
-- check passed; NOT_READY otherwise -- a failure is never reported as
-- READY, and failed_checks/total_checks make the exact scope of any
-- failure unambiguous without needing to re-run anything.
select
  case when failed_checks = 0 then 'READY' else 'NOT_READY' end as browser_fixture_status,
  total_checks,
  passed_checks,
  failed_checks
from (
  select
    count(*) as total_checks,
    count(*) filter (where status = 'PASS') as passed_checks,
    count(*) filter (where status = 'FAIL') as failed_checks
  from browser_fixture_checks
) as totals;
