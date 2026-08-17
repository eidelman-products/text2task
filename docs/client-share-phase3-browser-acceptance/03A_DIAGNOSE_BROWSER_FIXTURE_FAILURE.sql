-- Text2Task Client Share Link -- Phase 3 Browser Acceptance Fixture
-- Package
-- File 03A: Diagnose a browser fixture verification failure (READ-ONLY,
-- DIAGNOSTIC ONLY)
--
-- DISPOSABLE TEST PROJECT ONLY
-- PRODUCTION APPLICATION NOT AUTHORIZED
--
-- Run this ONLY after 03_BROWSER_FIXTURE_VERIFICATION.sql has reported a
-- FAIL (or if you need to re-inspect a prior FAIL without losing the
-- detail). Never run this in the real Text2Task production project.
--
-- WHY THIS FILE EXISTS: an earlier revision of File 03 ended with
-- `raise exception` on any failed check. Pasted into the Supabase SQL
-- Editor, the whole file is sent as one multi-statement query, which
-- Postgres runs as a single implicit transaction even with no explicit
-- BEGIN/COMMIT -- so that `raise exception` aborted the entire batch,
-- rolling back the `create temporary table` itself (DDL is transactional
-- too) along with every row already inserted into it. The result: the
-- FAIL-only table File 03 had already produced became unrecoverable, and
-- a follow-up `select * from browser_fixture_checks` in a later, separate
-- query failed with `42P01: relation "browser_fixture_checks" does not
-- exist`, because that table never actually survived to be committed.
-- File 03 itself has since been corrected to never raise an exception
-- (see its own header comment and 04_CAPTURE_RESULTS.md, Run 1, for the
-- full incident record) -- this file exists as a standalone, independent
-- diagnostic that reproduces the exact same 16 checks with additional
-- expected/actual detail, for re-inspecting a failure without depending
-- on File 03's own temporary table having survived anything.
--
-- This file performs NO INSERT, UPDATE, or DELETE against any persistent
-- table -- identical read-only posture to File 03. It creates only a
-- session-scoped temporary table and a session-scoped pg_temp function,
-- and it NEVER raises an exception at any point, so every result set it
-- produces remains visible and queryable regardless of outcome. Safe to
-- re-run as many times as needed.
--
-- Every PASS condition below is byte-for-byte identical to File 03's own
-- 16 checks -- this file changes nothing about what counts as pass or
-- fail, only how much detail is returned and how the script ends.

-- =========================================================
-- Safety gate (identical to File 03)
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
-- Note: this is the ONLY place this file can ever raise an exception --
-- refusing to run at all against a project that is not the disposable
-- fixture project. Once past this gate, no statement below ever raises.

create temporary table browser_fixture_diagnostics (
  seq integer generated always as identity,
  section text not null,
  check_name text not null,
  status text not null,
  expected text null,
  actual text null,
  detail text null
);

create or replace function pg_temp.record_diagnostic(
  p_section text,
  p_check_name text,
  p_passed boolean,
  p_expected text default null,
  p_actual text default null,
  p_detail text default null
) returns void
language plpgsql
as $$
begin
  insert into browser_fixture_diagnostics (section, check_name, status, expected, actual, detail)
  values (p_section, p_check_name, case when p_passed then 'PASS' else 'FAIL' end, p_expected, p_actual, p_detail);
end;
$$;

-- =========================================================
-- Section A: public.users
-- =========================================================

do $$
declare
  v_users_table_exists boolean;
  v_users_column_count integer;
begin
  v_users_table_exists := to_regclass('public.users') is not null;
  perform pg_temp.record_diagnostic(
    'A', 'A1: public.users table exists',
    v_users_table_exists,
    'true', v_users_table_exists::text
  );

  select count(*) into v_users_column_count
    from information_schema.columns
    where table_schema = 'public' and table_name = 'users'
      and column_name in ('id', 'email', 'plan', 'extract_count', 'subscription_status');
  perform pg_temp.record_diagnostic(
    'A', 'A2: public.users has the exact columns ensureUser.ts requires',
    v_users_column_count = 5,
    '5', v_users_column_count::text
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
  v_found_columns text[];
  v_missing_columns text[];
begin
  select array_agg(column_name order by column_name) into v_found_columns
    from information_schema.columns
    where table_schema = 'public' and table_name = 'projects'
      and column_name = any (v_projects_expected);
  v_found_count := coalesce(array_length(v_found_columns, 1), 0);
  select array_agg(c) into v_missing_columns
    from unnest(v_projects_expected) as c
    where c <> all (coalesce(v_found_columns, array[]::text[]));
  perform pg_temp.record_diagnostic(
    'B', 'B1: projects has every column the real dashboard/projection code selects or inserts',
    v_found_count = array_length(v_projects_expected, 1),
    array_length(v_projects_expected, 1)::text, v_found_count::text,
    case when v_missing_columns is not null then 'missing: ' || array_to_string(v_missing_columns, ', ') else null end
  );

  select array_agg(column_name order by column_name) into v_found_columns
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks'
      and column_name = any (v_tasks_expected);
  v_found_count := coalesce(array_length(v_found_columns, 1), 0);
  select array_agg(c) into v_missing_columns
    from unnest(v_tasks_expected) as c
    where c <> all (coalesce(v_found_columns, array[]::text[]));
  perform pg_temp.record_diagnostic(
    'B', 'B2: tasks has every column the real dashboard/projection code selects or inserts',
    v_found_count = array_length(v_tasks_expected, 1),
    array_length(v_tasks_expected, 1)::text, v_found_count::text,
    case when v_missing_columns is not null then 'missing: ' || array_to_string(v_missing_columns, ', ') else null end
  );

  select array_agg(column_name order by column_name) into v_found_columns
    from information_schema.columns
    where table_schema = 'public' and table_name = 'clients'
      and column_name = any (v_clients_expected);
  v_found_count := coalesce(array_length(v_found_columns, 1), 0);
  select array_agg(c) into v_missing_columns
    from unnest(v_clients_expected) as c
    where c <> all (coalesce(v_found_columns, array[]::text[]));
  perform pg_temp.record_diagnostic(
    'B', 'B3: clients has every column the real dashboard code selects or inserts',
    v_found_count = array_length(v_clients_expected, 1),
    array_length(v_clients_expected, 1)::text, v_found_count::text,
    case when v_missing_columns is not null then 'missing: ' || array_to_string(v_missing_columns, ', ') else null end
  );

  select array_agg(column_name order by column_name) into v_found_columns
    from information_schema.columns
    where table_schema = 'public' and table_name = 'task_resources'
      and column_name = any (v_task_resources_expected);
  v_found_count := coalesce(array_length(v_found_columns, 1), 0);
  select array_agg(c) into v_missing_columns
    from unnest(v_task_resources_expected) as c
    where c <> all (coalesce(v_found_columns, array[]::text[]));
  perform pg_temp.record_diagnostic(
    'B', 'B4: task_resources has every column the real dashboard/projection code selects or inserts',
    v_found_count = array_length(v_task_resources_expected, 1),
    array_length(v_task_resources_expected, 1)::text, v_found_count::text,
    case when v_missing_columns is not null then 'missing: ' || array_to_string(v_missing_columns, ', ') else null end
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
  perform pg_temp.record_diagnostic(
    'C', 'C1: the disposable owner row exists in public.users',
    v_owner_id is not null,
    'a matching public.users row', coalesce(v_owner_id::text, 'not found')
  );

  perform pg_temp.record_diagnostic(
    'C', 'C2: the seeded fixture project exists, owned by the disposable owner',
    exists (
      select 1 from public.projects
      where id = v_project_id and user_id = v_owner_id and deleted_at is null
    ),
    format('projects row id=%s user_id=%s deleted_at=null', v_project_id, coalesce(v_owner_id::text, 'null')),
    (select coalesce(
      (select format('found, user_id=%s, deleted_at=%s', p.user_id, coalesce(p.deleted_at::text, 'null'))
       from public.projects p where p.id = v_project_id),
      'not found'
    ))
  );

  select task.id, task.user_id, task.project_id
    into v_task_id, v_task_user_id, v_task_project_id
    from public.tasks as task
    where task.project_id = v_project_id
      and task.task_title = 'Phase 3 browser fixture task'
    limit 1;
  perform pg_temp.record_diagnostic(
    'C', 'C3: the seeded fixture task exists, owned by the disposable owner, scoped to the fixture project',
    v_task_id is not null and v_task_user_id = v_owner_id and v_task_project_id = v_project_id,
    format('a tasks row for project_id=%s with matching user_id', v_project_id),
    case when v_task_id is null then 'not found'
      else format('id=%s user_id=%s project_id=%s', v_task_id, v_task_user_id, v_task_project_id)
    end
  );

  select
      resource.user_id, resource.project_id, resource.task_id,
      resource.resource_type, resource.url, resource.storage_path, resource.file_name
    into
      v_resource_user_id, v_resource_project_id, v_resource_task_id,
      v_resource_type, v_resource_url, v_resource_storage_path, v_resource_file_name
    from public.task_resources as resource
    where resource.id = v_resource_id;
  perform pg_temp.record_diagnostic(
    'C', 'C4: the seeded fixture resource exists, owned by the disposable owner, scoped to the fixture project/task',
    v_resource_user_id = v_owner_id
      and v_resource_project_id = v_project_id
      and v_resource_task_id = v_task_id,
    format('task_resources row id=%s with matching user_id/project_id/task_id', v_resource_id),
    case when v_resource_user_id is null then 'not found'
      else format('user_id=%s project_id=%s task_id=%s', v_resource_user_id, v_resource_project_id, v_resource_task_id)
    end
  );

  perform pg_temp.record_diagnostic(
    'C', 'C5: the seeded fixture resource classifies as a LINK resource under resource-api.ts''s own rules (resource_type <> ''note'', no storage_path, no file_name, url present)',
    coalesce(v_resource_type, '') <> 'note'
      and v_resource_storage_path is null
      and v_resource_file_name is null
      and v_resource_url is not null,
    'resource_type<>note, storage_path=null, file_name=null, url is not null',
    format('resource_type=%s storage_path=%s file_name=%s url=%s',
      coalesce(v_resource_type, 'null'), coalesce(v_resource_storage_path, 'null'),
      coalesce(v_resource_file_name, 'null'), coalesce(v_resource_url, 'null'))
  );
end;
$$;

-- =========================================================
-- Section D: expected authenticated grants/policies, no anon access
-- =========================================================

do $$
begin
  perform pg_temp.record_diagnostic(
    'D', 'D1: authenticated may INSERT/UPDATE its own projects/tasks/clients/task_resources rows',
    has_table_privilege('authenticated', 'public.projects', 'INSERT')
      and has_table_privilege('authenticated', 'public.projects', 'UPDATE')
      and has_table_privilege('authenticated', 'public.tasks', 'INSERT')
      and has_table_privilege('authenticated', 'public.tasks', 'UPDATE')
      and has_table_privilege('authenticated', 'public.clients', 'INSERT')
      and has_table_privilege('authenticated', 'public.clients', 'UPDATE')
      and has_table_privilege('authenticated', 'public.task_resources', 'INSERT')
      and has_table_privilege('authenticated', 'public.task_resources', 'UPDATE'),
    'INSERT and UPDATE on all four tables',
    format('projects(ins=%s,upd=%s) tasks(ins=%s,upd=%s) clients(ins=%s,upd=%s) task_resources(ins=%s,upd=%s)',
      has_table_privilege('authenticated', 'public.projects', 'INSERT'), has_table_privilege('authenticated', 'public.projects', 'UPDATE'),
      has_table_privilege('authenticated', 'public.tasks', 'INSERT'), has_table_privilege('authenticated', 'public.tasks', 'UPDATE'),
      has_table_privilege('authenticated', 'public.clients', 'INSERT'), has_table_privilege('authenticated', 'public.clients', 'UPDATE'),
      has_table_privilege('authenticated', 'public.task_resources', 'INSERT'), has_table_privilege('authenticated', 'public.task_resources', 'UPDATE'))
  );

  perform pg_temp.record_diagnostic(
    'D', 'D2: authenticated has SELECT-only (no write) on public.users',
    has_table_privilege('authenticated', 'public.users', 'SELECT')
      and not has_table_privilege('authenticated', 'public.users', 'INSERT')
      and not has_table_privilege('authenticated', 'public.users', 'UPDATE'),
    'select=true, insert=false, update=false',
    format('select=%s insert=%s update=%s',
      has_table_privilege('authenticated', 'public.users', 'SELECT'),
      has_table_privilege('authenticated', 'public.users', 'INSERT'),
      has_table_privilege('authenticated', 'public.users', 'UPDATE'))
  );

  perform pg_temp.record_diagnostic(
    'D', 'D3: anon has no privilege at all on any of these four core app tables',
    not has_table_privilege('anon', 'public.projects', 'SELECT')
      and not has_table_privilege('anon', 'public.tasks', 'SELECT')
      and not has_table_privilege('anon', 'public.clients', 'SELECT')
      and not has_table_privilege('anon', 'public.task_resources', 'SELECT')
      and not has_table_privilege('anon', 'public.users', 'SELECT'),
    'no SELECT privilege for anon on any of the five tables',
    format('projects=%s tasks=%s clients=%s task_resources=%s users=%s',
      has_table_privilege('anon', 'public.projects', 'SELECT'),
      has_table_privilege('anon', 'public.tasks', 'SELECT'),
      has_table_privilege('anon', 'public.clients', 'SELECT'),
      has_table_privilege('anon', 'public.task_resources', 'SELECT'),
      has_table_privilege('anon', 'public.users', 'SELECT'))
  );

  perform pg_temp.record_diagnostic(
    'D', 'D4: RLS is enabled on every extended core app table',
    (select relrowsecurity from pg_class where oid = 'public.projects'::regclass)
      and (select relrowsecurity from pg_class where oid = 'public.tasks'::regclass)
      and (select relrowsecurity from pg_class where oid = 'public.clients'::regclass)
      and (select relrowsecurity from pg_class where oid = 'public.task_resources'::regclass)
      and (select relrowsecurity from pg_class where oid = 'public.users'::regclass),
    'relrowsecurity=true on all five tables',
    format('projects=%s tasks=%s clients=%s task_resources=%s users=%s',
      (select relrowsecurity from pg_class where oid = 'public.projects'::regclass),
      (select relrowsecurity from pg_class where oid = 'public.tasks'::regclass),
      (select relrowsecurity from pg_class where oid = 'public.clients'::regclass),
      (select relrowsecurity from pg_class where oid = 'public.task_resources'::regclass),
      (select relrowsecurity from pg_class where oid = 'public.users'::regclass))
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

  perform pg_temp.record_diagnostic(
    'E', 'E1: every Client Share RPC this browser-acceptance pass depends on still exists, unmodified by this package',
    v_missing is null,
    '0 missing RPCs',
    case when v_missing is null then '0 missing' else array_to_string(v_missing, ', ') end
  );
end;
$$;

-- =========================================================
-- Results -- three result sets, then a plain verdict row. Nothing below
-- this point can ever raise an exception.
-- =========================================================

select seq, section, check_name, status, expected, actual, detail
from browser_fixture_diagnostics
order by seq;

select
  count(*) as total_checks,
  count(*) filter (where status = 'PASS') as passed_checks,
  count(*) filter (where status = 'FAIL') as failed_checks
from browser_fixture_diagnostics;

select seq, section, check_name, status, expected, actual, detail
from browser_fixture_diagnostics
where status = 'FAIL'
order by seq;

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
  from browser_fixture_diagnostics
) as totals;
