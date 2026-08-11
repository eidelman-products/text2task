-- Text2Task Client Share Link -- Phase 1C Runtime Verification Package
-- File 03: Real SQL runtime behaviour tests
--
-- Run this THIRD, after files 01 and 02, in the same temporary Supabase
-- project. Never run this in the real Text2Task production project.
--
-- METHODOLOGY: identical to the Phase 1B runtime package's file 03 (read
-- that file's own header before this one if you have not already) --
-- real PostgreSQL behaviour tests, exact-SQLSTATE/message discipline via
-- pg_temp.try_stmt/try_rpc, role-switched RPC calls via pg_temp.act_as,
-- a BEGIN;...ROLLBACK; wrapper so no fixture row or test-only helper
-- object ever survives a run regardless of PASS or FAIL, and the same
-- final-guard FAILS=[...] embedded report on failure.
--
-- SCOPE: this file is deliberately NOT a second full re-verification of
-- every Phase 1B behaviour -- the existing
-- docs/client-share-phase1b-runtime/ package already proved that
-- (520/520 PASS). This file proves Phase 1C's own delta (the three new
-- publication-intent columns, the two extended RPCs, and the
-- configuration_version contract as it applies to the six-field settings
-- group) plus a light regression pass confirming the pre-existing
-- task/Resource/update-publication behaviour this package necessarily
-- re-exercises still works when combined with the new fields in the same
-- atomic call.

-- =========================================================
-- 0. Safety gate
-- =========================================================

do $$
declare
  v_sentinel_kind text;
  v_missing_tables text[];
  v_missing_functions text[];
  v_missing_columns text[];
begin
  if to_regclass('public.text2task_client_share_phase1c_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 1C runtime test sentinel was not found. Run 01_CREATE_TEMP_TEST_FIXTURE.sql and 02_APPLY_CLIENT_SHARE_THROUGH_PHASE1C.sql first, in that order, in this same temporary project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase1c_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_1C_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row does not identify this project as a disposable Phase 1C runtime test project.';
  end if;

  select array_agg(t.tbl) into v_missing_tables
    from (values
      ('project_share_links'), ('share_link_tasks'), ('share_link_resources'),
      ('share_link_updates')
    ) as t(tbl)
    where to_regclass('public.' || t.tbl) is null;

  if v_missing_tables is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected table(s): %s. Run 02_APPLY_CLIENT_SHARE_THROUGH_PHASE1C.sql first.',
      array_to_string(v_missing_tables, ', ')
    );
  end if;

  select array_agg(t.col) into v_missing_columns
    from (values
      ('title_visible'), ('status_visible'), ('target_date_visible')
    ) as t(col)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'project_share_links'
        and c.column_name = t.col
    );

  if v_missing_columns is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected Phase 1C column(s) on project_share_links: %s. Run 02_APPLY_CLIENT_SHARE_THROUGH_PHASE1C.sql first.',
      array_to_string(v_missing_columns, ', ')
    );
  end if;

  select array_agg(t.fn) into v_missing_functions
    from (values
      ('get_share_link_management_state(uuid)'),
      ('create_share_link_draft(uuid,text)'),
      ('activate_share_link(uuid,text,smallint,text,text,text,smallint)'),
      ('revoke_share_link(uuid)'),
      ('save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)')
    ) as t(fn)
    where to_regprocedure('public.' || t.fn) is null;

  if v_missing_functions is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected RPC(s): %s. Run 02_APPLY_CLIENT_SHARE_THROUGH_PHASE1C.sql first.',
      array_to_string(v_missing_functions, ', ')
    );
  end if;
end;
$$;

begin;

-- =========================================================
-- 1. Assertion infrastructure (identical to the Phase 1B package's own
--    harness -- see that file for the full rationale of each helper).
-- =========================================================

create temporary table _test_results (
  seq serial primary key,
  section text not null,
  test_code text not null,
  description text not null,
  status text not null,
  expected text,
  actual text,
  detail text
);

create temporary table _fixture_state (
  key text primary key,
  value text not null
);

create or replace function pg_temp.set_val(p_key text, p_value text) returns void
language sql as $f$
  insert into _fixture_state(key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
$f$;

create or replace function pg_temp.get_val(p_key text) returns text
language sql as $f$
  select value from _fixture_state where key = p_key;
$f$;

create or replace function pg_temp.get_uuid(p_key text) returns uuid
language sql as $f$
  select value::uuid from _fixture_state where key = p_key;
$f$;

create or replace function pg_temp.record_result(
  p_section text, p_code text, p_desc text, p_pass boolean,
  p_expected text default null, p_actual text default null, p_detail text default null
) returns void language plpgsql as $f$
begin
  insert into _test_results(section, test_code, description, status, expected, actual, detail)
  values (p_section, p_code, p_desc, case when coalesce(p_pass, false) then 'PASS' else 'FAIL' end, p_expected, p_actual, p_detail);
end;
$f$;

create or replace function pg_temp.try_rpc(
  p_section text,
  p_code text,
  p_desc text,
  p_sql text,
  p_expect_success boolean,
  p_expected_message text default null,
  p_expected_sqlstate text default null,
  p_capture_key text default null
) returns void language plpgsql as $f$
declare
  v_pass boolean;
  v_detail text;
  v_errmsg text;
  v_sqlstate text;
  v_result jsonb;
begin
  begin
    execute p_sql into v_result;
    if p_expect_success then
      v_pass := true;
      v_detail := format('succeeded as expected, result=%s', v_result::text);
      if p_capture_key is not null then
        perform pg_temp.set_val(p_capture_key, v_result::text);
      end if;
    else
      v_pass := false;
      v_detail := format('expected failure but the RPC succeeded, result=%s', v_result::text);
    end if;
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_errmsg = message_text;
    if p_expect_success then
      v_pass := false;
      v_detail := format('expected success, got SQLSTATE %s: %s', v_sqlstate, v_errmsg);
    else
      v_pass := true;
      if p_expected_sqlstate is not null and v_sqlstate is distinct from p_expected_sqlstate then
        v_pass := false;
      end if;
      if p_expected_message is not null and v_errmsg is distinct from p_expected_message then
        v_pass := false;
      end if;
      if v_pass then
        v_detail := format('failed as expected: SQLSTATE %s, message %s', v_sqlstate, v_errmsg);
      else
        v_detail := format(
          'expected SQLSTATE %s / message %s, got SQLSTATE %s / message %s',
          coalesce(p_expected_sqlstate, '(any)'), coalesce(p_expected_message, '(any)'),
          v_sqlstate, v_errmsg
        );
      end if;
    end if;
  end;

  perform pg_temp.record_result(
    p_section, p_code, p_desc, v_pass,
    case when p_expect_success then 'success' else format('SQLSTATE %s / %s', coalesce(p_expected_sqlstate,'(any)'), coalesce(p_expected_message,'(any)')) end,
    v_detail, v_detail
  );
end;
$f$;

create or replace function pg_temp.require_id(
  p_section text, p_code text, p_label text, p_id_text text
) returns void language plpgsql as $f$
declare
  v_status text;
  v_detail text;
begin
  if p_id_text is not null then
    return;
  end if;

  select status, detail into v_status, v_detail
  from _test_results
  where section = p_section and test_code = p_code
  order by seq desc
  limit 1;

  raise exception using errcode = 'P0001', message = format(
    'PHASE1C_SETUP_DEPENDENCY_FAILED: %s/%s: expected a %s value to exist after this expected-success step, but none was found. Recorded result for %s/%s -- status: %s, detail: %s',
    p_section, p_code, p_label, p_section, p_code,
    coalesce(v_status, '(no result row was recorded for this test code)'),
    coalesce(v_detail, '(no detail recorded)')
  );
end;
$f$;

create or replace function pg_temp.require_test_pass(
  p_section text, p_code text, p_label text
) returns void language plpgsql as $f$
declare
  v_status text;
  v_detail text;
begin
  select status, detail into v_status, v_detail
  from _test_results
  where section = p_section and test_code = p_code
  order by seq desc
  limit 1;

  if v_status is not distinct from 'PASS' then
    return;
  end if;

  raise exception using errcode = 'P0001', message = format(
    'PHASE1C_EXPECTED_SUCCESS_FAILED: %s/%s: %s did not PASS, so its downstream dependents cannot be trusted to run against the state they assume. Recorded result for %s/%s -- status: %s, detail: %s',
    p_section, p_code, p_label, p_section, p_code,
    coalesce(v_status, '(no result row was recorded for this test code)'),
    coalesce(v_detail, '(no detail recorded)')
  );
end;
$f$;

create or replace function pg_temp.act_as(p_role text, p_user_id uuid default null)
returns void language plpgsql as $f$
begin
  reset role;
  if p_user_id is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', p_role)::text, true);
  else
    perform set_config('request.jwt.claims', '{}', true);
  end if;
  if p_role <> 'postgres' then
    execute format('set local role %I', p_role);
  end if;
end;
$f$;

-- =========================================================
-- 1b. Harness privileges for switched roles (identical rationale to the
--     Phase 1B package -- see that file's own comment).
-- =========================================================

grant select, insert, update on _fixture_state to anon, authenticated, service_role;
grant select, insert on _test_results to anon, authenticated, service_role;
grant usage, select on sequence _test_results_seq_seq to anon, authenticated, service_role;

do $$
declare
  v_probe text;
begin
  perform pg_temp.set_val('harness_probe', 'READY');

  perform pg_temp.act_as('anon');
  select pg_temp.get_val('harness_probe') into v_probe;
  perform pg_temp.record_result('HARNESS', 'H-ANON', 'anon can read fixture state via the temporary-object grants alone', v_probe = 'READY', 'READY', v_probe, null);
  if v_probe is distinct from 'READY' then
    perform pg_temp.act_as('postgres');
    raise exception using errcode = 'P0001', message = 'HARNESS_SELF_TEST_FAILED: anon harness probe did not read back READY.';
  end if;
  perform pg_temp.act_as('postgres');

  perform pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111111');
  perform pg_temp.record_result('HARNESS', 'H-UID-A', 'auth.uid() resolves to owner A under an owner-A claim', auth.uid() = '11111111-1111-4111-8111-111111111111'::uuid, '11111111-1111-4111-8111-111111111111', auth.uid()::text, null);
  perform pg_temp.act_as('authenticated', '22222222-2222-4222-8222-222222222222');
  perform pg_temp.record_result('HARNESS', 'H-UID-B', 'auth.uid() resolves to owner B under an owner-B claim', auth.uid() = '22222222-2222-4222-8222-222222222222'::uuid, '22222222-2222-4222-8222-222222222222', auth.uid()::text, null);
  perform pg_temp.act_as('anon');
  perform pg_temp.record_result('HARNESS', 'H-UID-ANON', 'auth.uid() resolves to null under anon with no claim', auth.uid() is null, 'null', auth.uid()::text, null);
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- 2. Shared fixture data (created as the Postgres superuser)
-- =========================================================

do $$
declare
  v_owner_a uuid := '11111111-1111-4111-8111-111111111111';
  v_owner_b uuid := '22222222-2222-4222-8222-222222222222';
  v_project_a1 uuid;
  v_project_a2 uuid;
  v_project_b1 uuid;
  v_task_a1 bigint;
  v_task_a2 bigint;
  v_resource_a1 uuid;
begin
  perform pg_temp.act_as('postgres');

  insert into public.projects (user_id) values (v_owner_a) returning id into v_project_a1;
  insert into public.projects (user_id) values (v_owner_a) returning id into v_project_a2;
  insert into public.projects (user_id) values (v_owner_b) returning id into v_project_b1;

  insert into public.tasks (user_id, project_id) values (v_owner_a, v_project_a1) returning id into v_task_a1;
  -- Owned by owner A, but attached to project A2 -- NOT project A1. Used
  -- only by Section G's atomic-rollback test: a task object referencing
  -- this id is syntactically/shape valid (so it passes save_share_
  -- configuration's initial JSON validation), but belongs to the wrong
  -- project for link A1, so it is rejected only by the LATER owner/
  -- project-attribution check -- the one that runs after the settings
  -- UPDATE has already executed inside the same function invocation.
  insert into public.tasks (user_id, project_id) values (v_owner_a, v_project_a2) returning id into v_task_a2;
  insert into public.task_resources (user_id, project_id) values (v_owner_a, v_project_a1) returning id into v_resource_a1;

  perform pg_temp.set_val('owner_a', v_owner_a::text);
  perform pg_temp.set_val('owner_b', v_owner_b::text);
  perform pg_temp.set_val('project_a1', v_project_a1::text);
  perform pg_temp.set_val('project_a2', v_project_a2::text);
  perform pg_temp.set_val('project_b1', v_project_b1::text);
  perform pg_temp.set_val('task_a1', v_task_a1::text);
  perform pg_temp.set_val('task_a2', v_task_a2::text);
  perform pg_temp.set_val('resource_a1', v_resource_a1::text);
end;
$$;

-- =========================================================
-- SECTION A -- Schema: three new columns, correct default/nullability
-- =========================================================

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('title_visible'), ('status_visible'), ('target_date_visible')
    ) as t(col)
  loop
    perform pg_temp.record_result(
      'A', 'A-COL-' || r.col,
      format('project_share_links.%s is boolean, NOT NULL, DEFAULT false', r.col),
      exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'project_share_links'
          and c.column_name = r.col
          and c.data_type = 'boolean'
          and c.is_nullable = 'NO'
          and c.column_default = 'false'
      ),
      'data_type=boolean, is_nullable=NO, column_default=false',
      (
        select format('data_type=%s, is_nullable=%s, column_default=%s', c.data_type, c.is_nullable, c.column_default)
        from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = 'project_share_links' and c.column_name = r.col
      ),
      null
    );
  end loop;
end;
$$;

-- =========================================================
-- SECTION B -- Fresh draft defaults to private/off on all three flags,
-- and the management-state read returns them as real booleans.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'B', 'B1', 'owner A creates a draft on project A1 with a valid deterministic 24-character V1 public id',
    format('select public.create_share_link_draft(%L::uuid, %L::text)', pg_temp.get_uuid('project_a1'), 'phase1cRuntimeA1Link0001'),
    true, null, null, 'link_a1'
  );
  perform pg_temp.require_test_pass('B', 'B1', 'draft creation on project A1');
  perform pg_temp.set_val('link_a1_id', (pg_temp.get_val('link_a1')::jsonb->>'linkId'));
  perform pg_temp.require_id('B', 'B1', 'link_a1_id', pg_temp.get_val('link_a1_id'));

  perform pg_temp.try_rpc(
    'B', 'B2', 'management-state read for project A1 returns all three flags as false',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_initial'
  );
  perform pg_temp.record_result(
    'B', 'B2-VALUES', 'initial titleVisible/statusVisible/targetDateVisible are all false',
    (pg_temp.get_val('mgmt_a1_initial')::jsonb->'link'->>'titleVisible') = 'false'
      and (pg_temp.get_val('mgmt_a1_initial')::jsonb->'link'->>'statusVisible') = 'false'
      and (pg_temp.get_val('mgmt_a1_initial')::jsonb->'link'->>'targetDateVisible') = 'false',
    'false/false/false',
    format('%s/%s/%s',
      pg_temp.get_val('mgmt_a1_initial')::jsonb->'link'->>'titleVisible',
      pg_temp.get_val('mgmt_a1_initial')::jsonb->'link'->>'statusVisible',
      pg_temp.get_val('mgmt_a1_initial')::jsonb->'link'->>'targetDateVisible'
    ),
    null
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION C -- Owner sets all three flags true in one call; persists,
-- reads back correctly, and configuration_version bumps by exactly one.
-- =========================================================

do $$
declare
  v_version_before integer;
  v_version_after integer;
begin
  v_version_before := (pg_temp.get_val('mgmt_a1_initial')::jsonb->'link'->>'configurationVersion')::integer;

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'C', 'C1', 'owner A sets titleVisible/statusVisible/targetDateVisible all true',
    format(
      'select public.save_share_configuration(%L::uuid, %L::jsonb, null, null, null)',
      pg_temp.get_val('link_a1_id'),
      '{"titleVisible": true, "statusVisible": true, "targetDateVisible": true}'
    ),
    true, null, null, 'save_c1'
  );
  perform pg_temp.require_test_pass('C', 'C1', 'set all three true');

  v_version_after := (pg_temp.get_val('save_c1')::jsonb->>'configurationVersion')::integer;
  perform pg_temp.record_result(
    'C', 'C2', 'configurationVersion increased by exactly one for this genuine multi-field change',
    v_version_after = v_version_before + 1,
    (v_version_before + 1)::text, v_version_after::text, null
  );

  perform pg_temp.try_rpc(
    'C', 'C3', 'management-state read confirms all three flags now true',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_after_c'
  );
  perform pg_temp.record_result(
    'C', 'C3-VALUES', 'titleVisible/statusVisible/targetDateVisible all true after save',
    (pg_temp.get_val('mgmt_a1_after_c')::jsonb->'link'->>'titleVisible') = 'true'
      and (pg_temp.get_val('mgmt_a1_after_c')::jsonb->'link'->>'statusVisible') = 'true'
      and (pg_temp.get_val('mgmt_a1_after_c')::jsonb->'link'->>'targetDateVisible') = 'true',
    'true/true/true',
    format('%s/%s/%s',
      pg_temp.get_val('mgmt_a1_after_c')::jsonb->'link'->>'titleVisible',
      pg_temp.get_val('mgmt_a1_after_c')::jsonb->'link'->>'statusVisible',
      pg_temp.get_val('mgmt_a1_after_c')::jsonb->'link'->>'targetDateVisible'
    ),
    null
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION D -- Identical re-save does not spuriously bump
-- configuration_version again.
-- =========================================================

do $$
declare
  v_version_before integer;
  v_version_after integer;
begin
  v_version_before := (pg_temp.get_val('save_c1')::jsonb->>'configurationVersion')::integer;

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'D', 'D1', 'owner A re-saves the identical true/true/true values',
    format(
      'select public.save_share_configuration(%L::uuid, %L::jsonb, null, null, null)',
      pg_temp.get_val('link_a1_id'),
      '{"titleVisible": true, "statusVisible": true, "targetDateVisible": true}'
    ),
    true, null, null, 'save_d1'
  );
  perform pg_temp.require_test_pass('D', 'D1', 'identical re-save');

  v_version_after := (pg_temp.get_val('save_d1')::jsonb->>'configurationVersion')::integer;
  perform pg_temp.record_result(
    'D', 'D2', 'configurationVersion is unchanged by an identical re-save (no genuine change)',
    v_version_after = v_version_before,
    v_version_before::text, v_version_after::text, null
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION E -- Turning each value off persists and bumps the version
-- exactly once for that genuine change.
-- =========================================================

do $$
declare
  v_version_before integer;
  v_version_after integer;
begin
  v_version_before := (pg_temp.get_val('save_d1')::jsonb->>'configurationVersion')::integer;

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'E', 'E1', 'owner A turns titleVisible off, leaving the other two true',
    format(
      'select public.save_share_configuration(%L::uuid, %L::jsonb, null, null, null)',
      pg_temp.get_val('link_a1_id'),
      '{"titleVisible": false}'
    ),
    true, null, null, 'save_e1'
  );
  perform pg_temp.require_test_pass('E', 'E1', 'turn titleVisible off');

  v_version_after := (pg_temp.get_val('save_e1')::jsonb->>'configurationVersion')::integer;
  perform pg_temp.record_result(
    'E', 'E2', 'configurationVersion increased by exactly one for the titleVisible-off change',
    v_version_after = v_version_before + 1,
    (v_version_before + 1)::text, v_version_after::text, null
  );

  perform pg_temp.try_rpc(
    'E', 'E3', 'management-state read confirms titleVisible false, others still true',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_after_e'
  );
  perform pg_temp.record_result(
    'E', 'E3-VALUES', 'titleVisible=false, statusVisible=true, targetDateVisible=true',
    (pg_temp.get_val('mgmt_a1_after_e')::jsonb->'link'->>'titleVisible') = 'false'
      and (pg_temp.get_val('mgmt_a1_after_e')::jsonb->'link'->>'statusVisible') = 'true'
      and (pg_temp.get_val('mgmt_a1_after_e')::jsonb->'link'->>'targetDateVisible') = 'true',
    'false/true/true',
    format('%s/%s/%s',
      pg_temp.get_val('mgmt_a1_after_e')::jsonb->'link'->>'titleVisible',
      pg_temp.get_val('mgmt_a1_after_e')::jsonb->'link'->>'statusVisible',
      pg_temp.get_val('mgmt_a1_after_e')::jsonb->'link'->>'targetDateVisible'
    ),
    null
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION F -- Non-boolean publication-intent values are rejected with
-- INVALID_SETTINGS, matching every other settings field's own validation.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'F', 'F1', 'a string titleVisible is rejected with INVALID_SETTINGS',
    format(
      'select public.save_share_configuration(%L::uuid, %L::jsonb, null, null, null)',
      pg_temp.get_val('link_a1_id'),
      '{"titleVisible": "true"}'
    ),
    false, 'INVALID_SETTINGS', 'P0001'
  );

  perform pg_temp.try_rpc(
    'F', 'F2', 'an unknown settings key is still rejected with INVALID_SETTINGS (allowlist unchanged)',
    format(
      'select public.save_share_configuration(%L::uuid, %L::jsonb, null, null, null)',
      pg_temp.get_val('link_a1_id'),
      '{"titleVisible": true, "somethingElse": 1}'
    ),
    false, 'INVALID_SETTINGS', 'P0001'
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION G -- POST-WRITE atomic rollback: a genuine publication-intent
-- change is actually applied by save_share_configuration's settings
-- UPDATE (step 4 of its internal ordering: validate shapes -> lock
-- project/link -> compute+apply the settings UPDATE, bumping
-- configuration_version -> validate task ownership/project-attribution
-- -> replace task mappings), and ONLY THEN does a later sub-operation in
-- the SAME call fail. This proves the already-applied settings UPDATE is
-- rolled back together with the rest of the function's work when the
-- call fails as a whole -- a stronger claim than "invalid input causes
-- no mutation", which a shape-validation failure (rejected before step 4
-- ever runs) would not prove by itself.
--
-- task_a2 (fixture: owner A, but attached to project A2, not project A1)
-- is deliberately used here: a task item referencing it is completely
-- syntactically/shape valid, so it passes save_share_configuration's
-- initial JSON validation and is only rejected by the LATER owner/
-- project-attribution check inside the task sub-operation -- i.e. AFTER
-- the settings UPDATE above it has already executed within the same
-- function invocation.
-- =========================================================

do $$
declare
  v_flags_before text;
  v_flags_after text;
  v_version_before integer;
  v_version_after integer;
begin
  select format('%s/%s/%s',
      pg_temp.get_val('mgmt_a1_after_e')::jsonb->'link'->>'titleVisible',
      pg_temp.get_val('mgmt_a1_after_e')::jsonb->'link'->>'statusVisible',
      pg_temp.get_val('mgmt_a1_after_e')::jsonb->'link'->>'targetDateVisible'
    ) into v_flags_before;
  v_version_before := (pg_temp.get_val('mgmt_a1_after_e')::jsonb->'link'->>'configurationVersion')::integer;

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'G', 'G1', 'a call combining a valid titleVisible flip (applied by the settings UPDATE) with a syntactically valid but wrong-project task (task_a2, rejected only by the LATER task-ownership check) fails the whole call',
    format(
      'select public.save_share_configuration(%L::uuid, %L::jsonb, %L::jsonb, null, null)',
      pg_temp.get_val('link_a1_id'),
      '{"titleVisible": true}',
      format('[{"subtaskId": "%s", "publicGroup": "in_progress", "waitingForClientFeedback": false, "displayOrder": 0}]', pg_temp.get_val('task_a2'))
    ),
    false, 'INVALID_TASKS', 'P0001'
  );

  perform pg_temp.try_rpc(
    'G', 'G2', 'management-state read after the failed post-write call shows the flags UNCHANGED (the already-applied settings UPDATE was rolled back)',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_after_g'
  );
  select format('%s/%s/%s',
      pg_temp.get_val('mgmt_a1_after_g')::jsonb->'link'->>'titleVisible',
      pg_temp.get_val('mgmt_a1_after_g')::jsonb->'link'->>'statusVisible',
      pg_temp.get_val('mgmt_a1_after_g')::jsonb->'link'->>'targetDateVisible'
    ) into v_flags_after;
  v_version_after := (pg_temp.get_val('mgmt_a1_after_g')::jsonb->'link'->>'configurationVersion')::integer;

  perform pg_temp.record_result(
    'G', 'G3', 'publication-intent flags after the failed post-write call equal the flags before it (settings-UPDATE rollback proven)',
    v_flags_after = v_flags_before,
    v_flags_before, v_flags_after, null
  );
  perform pg_temp.record_result(
    'G', 'G4', 'configurationVersion after the failed post-write call equals the version before it (the version bump from step 4 was also rolled back, not just the visible flags)',
    v_version_after = v_version_before,
    v_version_before::text, v_version_after::text, null
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION H -- Cross-tenant: owner B cannot alter owner A's flags.
-- =========================================================

do $$
declare
  v_flags_before text;
  v_flags_after text;
begin
  select format('%s/%s/%s',
      pg_temp.get_val('mgmt_a1_after_g')::jsonb->'link'->>'titleVisible',
      pg_temp.get_val('mgmt_a1_after_g')::jsonb->'link'->>'statusVisible',
      pg_temp.get_val('mgmt_a1_after_g')::jsonb->'link'->>'targetDateVisible'
    ) into v_flags_before;

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc(
    'H', 'H1', 'owner B cannot save configuration on owner A''s link',
    format(
      'select public.save_share_configuration(%L::uuid, %L::jsonb, null, null, null)',
      pg_temp.get_val('link_a1_id'),
      '{"titleVisible": false}'
    ),
    false, 'SHARE_LINK_NOT_FOUND', 'P0001'
  );

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'H', 'H2', 'owner A reads back unchanged flags after owner B''s rejected attempt',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_after_h'
  );
  select format('%s/%s/%s',
      pg_temp.get_val('mgmt_a1_after_h')::jsonb->'link'->>'titleVisible',
      pg_temp.get_val('mgmt_a1_after_h')::jsonb->'link'->>'statusVisible',
      pg_temp.get_val('mgmt_a1_after_h')::jsonb->'link'->>'targetDateVisible'
    ) into v_flags_after;
  perform pg_temp.record_result(
    'H', 'H3', 'flags unchanged after the cross-tenant attempt',
    v_flags_after = v_flags_before,
    v_flags_before, v_flags_after, null
  );

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc(
    'H', 'H4', 'owner B cannot even read owner A''s management state for project A1',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    false, 'PROJECT_NOT_FOUND', 'P0001'
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION I -- Direct anon access remains denied for both extended RPCs.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('anon');
  perform pg_temp.try_rpc(
    'I', 'I1', 'anon cannot execute get_share_link_management_state at all',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    false, null, '42501'
  );
  perform pg_temp.try_rpc(
    'I', 'I2', 'anon cannot execute save_share_configuration at all',
    format(
      'select public.save_share_configuration(%L::uuid, %L::jsonb, null, null, null)',
      pg_temp.get_val('link_a1_id'),
      '{"titleVisible": true}'
    ),
    false, null, '42501'
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION J -- Regression: task/Resource/update-publication configuration
-- still works correctly when combined with the new publication-intent
-- flags in the same atomic call.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'J', 'J1', 'one call sets a publication-intent flag, a task, a Resource and publishes an update together',
    format(
      'select public.save_share_configuration(%L::uuid, %L::jsonb, %L::jsonb, %L::jsonb, %L::jsonb)',
      pg_temp.get_val('link_a1_id'),
      '{"targetDateVisible": true}',
      format('[{"subtaskId": "%s", "publicGroup": "in_progress", "waitingForClientFeedback": false, "displayOrder": 0}]', pg_temp.get_val('task_a1')),
      format('[{"resourceId": "%s", "publicLabel": "Design file", "canDownload": false, "displayOrder": 0}]', pg_temp.get_val('resource_a1')),
      '{"body": "Phase 1C regression check update"}'
    ),
    true, null, null, 'save_j1'
  );
  perform pg_temp.require_test_pass('J', 'J1', 'combined settings+tasks+resources+publishUpdate save');

  perform pg_temp.record_result(
    'J', 'J2', 'the combined call''s taskIds contains the mapped task',
    (pg_temp.get_val('save_j1')::jsonb->'taskIds') ? pg_temp.get_val('task_a1'),
    pg_temp.get_val('task_a1'),
    (pg_temp.get_val('save_j1')::jsonb->'taskIds')::text,
    null
  );
  perform pg_temp.record_result(
    'J', 'J3', 'the combined call''s resourceIds contains the mapped Resource',
    (pg_temp.get_val('save_j1')::jsonb->'resourceIds') ? pg_temp.get_val('resource_a1'),
    pg_temp.get_val('resource_a1'),
    (pg_temp.get_val('save_j1')::jsonb->'resourceIds')::text,
    null
  );
  perform pg_temp.record_result(
    'J', 'J4', 'the combined call published a current update at version 1',
    (pg_temp.get_val('save_j1')::jsonb->'currentUpdate'->>'version') = '1',
    '1',
    pg_temp.get_val('save_j1')::jsonb->'currentUpdate'->>'version',
    null
  );

  perform pg_temp.try_rpc(
    'J', 'J5', 'management-state read confirms targetDateVisible true and the mapped task/resource',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_after_j'
  );
  perform pg_temp.record_result(
    'J', 'J6', 'targetDateVisible is true after the combined save',
    (pg_temp.get_val('mgmt_a1_after_j')::jsonb->'link'->>'targetDateVisible') = 'true',
    'true',
    pg_temp.get_val('mgmt_a1_after_j')::jsonb->'link'->>'targetDateVisible',
    null
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION K -- A revoked link still rejects a publication-intent-only
-- save with SHARE_LINK_REVOKED, matching every other settings field.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'K', 'K1', 'owner A revokes the link (never activated -- draft-to-revoked is allowed)',
    format('select public.revoke_share_link(%L::uuid)', pg_temp.get_val('link_a1_id')),
    true, null, null, 'revoke_k1'
  );
  perform pg_temp.require_test_pass('K', 'K1', 'revoke link A1');

  perform pg_temp.try_rpc(
    'K', 'K2', 'a publication-intent-only save on the now-revoked link fails with SHARE_LINK_REVOKED',
    format(
      'select public.save_share_configuration(%L::uuid, %L::jsonb, null, null, null)',
      pg_temp.get_val('link_a1_id'),
      '{"titleVisible": false}'
    ),
    false, 'SHARE_LINK_REVOKED', 'P0001'
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION M -- Object/security posture of the two extended RPCs is
-- unchanged: same security mode, search_path, and grant model.
-- =========================================================

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('get_share_link_management_state(uuid)', false),
      ('save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)', true)
    ) as t(sig, expect_definer)
  loop
    perform pg_temp.record_result(
      'M', 'M-SECDEF-' || r.sig,
      format('%s has the expected SECURITY mode (definer=%s)', r.sig, r.expect_definer),
      (select p.prosecdef from pg_proc p where p.oid = ('public.' || r.sig)::regprocedure) = r.expect_definer,
      r.expect_definer::text,
      (select p.prosecdef::text from pg_proc p where p.oid = ('public.' || r.sig)::regprocedure),
      null
    );
  end loop;

  perform pg_temp.record_result(
    'M', 'M-GRANT-READ-AUTH', 'authenticated has EXECUTE on get_share_link_management_state',
    has_function_privilege('authenticated', 'public.get_share_link_management_state(uuid)', 'EXECUTE'),
    'true', has_function_privilege('authenticated', 'public.get_share_link_management_state(uuid)', 'EXECUTE')::text, null
  );
  perform pg_temp.record_result(
    'M', 'M-GRANT-READ-ANON', 'anon does NOT have EXECUTE on get_share_link_management_state',
    not has_function_privilege('anon', 'public.get_share_link_management_state(uuid)', 'EXECUTE'),
    'false', has_function_privilege('anon', 'public.get_share_link_management_state(uuid)', 'EXECUTE')::text, null
  );
  perform pg_temp.record_result(
    'M', 'M-GRANT-SAVE-AUTH', 'authenticated has EXECUTE on save_share_configuration',
    has_function_privilege('authenticated', 'public.save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE'),
    'true', has_function_privilege('authenticated', 'public.save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE')::text, null
  );
  perform pg_temp.record_result(
    'M', 'M-GRANT-SAVE-ANON', 'anon does NOT have EXECUTE on save_share_configuration',
    not has_function_privilege('anon', 'public.save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE'),
    'false', has_function_privilege('anon', 'public.save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE')::text, null
  );
  perform pg_temp.record_result(
    'M', 'M-GRANT-SAVE-SVC', 'service_role does NOT have EXECUTE on save_share_configuration',
    not has_function_privilege('service_role', 'public.save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE'),
    'false', has_function_privilege('service_role', 'public.save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE')::text, null
  );
end;
$$;

-- =========================================================
-- FINAL RESULTS AND VERDICT
-- =========================================================

select
  seq as test_number,
  section,
  test_code as test_name,
  description,
  status,
  expected,
  actual,
  detail as details
from _test_results
order by seq;

select
  count(*) as total_tests,
  count(*) filter (where status = 'PASS') as passed_tests,
  count(*) filter (where status = 'FAIL') as failed_tests,
  case
    when count(*) filter (where status = 'FAIL') = 0 then 'PHASE_1C_RUNTIME_PASS'
    else 'PHASE_1C_RUNTIME_FAIL'
  end as runtime_status
from _test_results;

select
  seq as test_number,
  section,
  test_code as test_name,
  description,
  status,
  expected,
  actual,
  detail as details
from _test_results
where status = 'FAIL'
order by seq;

-- Fail loudly at the very end if anything failed -- see the Phase 1B
-- package's own file 03 header for the full rationale of this pattern
-- (embedded FAILS=[...] report, transaction-abort semantics, why the
-- trailing rollback; below is reached only on PASS).
do $$
declare
  v_failed_count int;
  v_total_count int;
  v_max_field_chars constant int := 400;
  v_fail_report text;
begin
  select count(*) filter (where status = 'FAIL'), count(*) into v_failed_count, v_total_count from _test_results;
  if v_failed_count > 0 then
    select string_agg(
        format(
          '#%s|section=%s|test=%s|expected=%s|actual=%s|details=%s',
          seq,
          section,
          test_code,
          left(regexp_replace(coalesce(expected, ''), '[\r\n\t]+', ' ', 'g'), v_max_field_chars),
          left(regexp_replace(coalesce(actual, ''), '[\r\n\t]+', ' ', 'g'), v_max_field_chars),
          left(regexp_replace(coalesce(detail, ''), '[\r\n\t]+', ' ', 'g'), v_max_field_chars)
        ),
        ';' order by seq
      )
      into v_fail_report
      from _test_results
      where status = 'FAIL';
    raise exception using errcode = 'P0001', message = format(
      'PHASE_1C_RUNTIME_FAIL: %s of %s tests failed. FAILS=[%s]',
      v_failed_count, v_total_count, v_fail_report
    );
  end if;
end;
$$;

-- Reached only on the PASS path. No fixture row or test-only helper
-- object created by this file survives a run of this file, regardless of
-- outcome. Files 01 and 02's own committed schema/grants/RLS/sentinel are
-- entirely untouched by this rollback.
rollback;
