-- Text2Task Client Share Link -- Phase 2B Mapping-Read Corrective
-- Foundation Runtime Verification Package
-- File 03: Real SQL runtime behaviour tests
--
-- Run this THIRD, after files 01 and 02, in the same temporary Supabase
-- project. Never run this in the real Text2Task production project.
--
-- METHODOLOGY: identical to the Phase 1B/1C runtime packages' own file 03
-- (read either of those files' own header first if you have not already)
-- -- real PostgreSQL behaviour tests, exact-SQLSTATE/message discipline
-- via pg_temp.try_stmt/try_rpc, role-switched RPC calls via
-- pg_temp.act_as, a BEGIN;...ROLLBACK; wrapper so no fixture row or
-- test-only helper object ever survives a run regardless of PASS or FAIL,
-- and the same final-guard FAILS=[...] embedded report on failure.
--
-- SCOPE: this file is deliberately NOT a third full re-verification of
-- every Phase 1B/1C behaviour -- the existing docs/client-share-phase1b-
-- runtime/ (520/520 PASS) and docs/client-share-phase1c-runtime/
-- (47/47 PASS) packages already proved those. This file proves ONLY the
-- Phase 2B corrective foundation's own delta: that
-- get_share_link_management_state now returns complete, exact, non-
-- renumbered persisted per-item task/Resource mapping metadata, that a
-- partial edit through save_share_configuration never loses an untouched
-- sibling's metadata, and that every existing security/lifecycle/grant
-- invariant this migration deliberately did not change is still intact.
--
-- Sections map directly to the 14 required checks from the corrective-
-- foundation task:
--   1  -> Section C  (persisted task mapping metadata returned exactly)
--   2  -> Section D  (persisted Resource mapping metadata returned exactly)
--   3  -> Sections C/D (displayOrder not normalized on read: 8/4 stay 8/4,
--                        9/2 stay 9/2)
--   4  -> Section E  (partial edit preserves the untouched sibling exactly)
--   5  -> Section F  (exact-set replacement still works)
--   6  -> Section G  (empty-set clearing still works)
--   7  -> Section H  (omitted group still leaves the mapping unchanged)
--   8  -> Section I  (cross-tenant management read denied/fails closed)
--   9  -> Section J  (revoked-link management behavior remains correct)
--   10 -> Section K  (anon cannot execute the management RPC)
--   11 -> Section L  (authenticated grant posture unchanged)
--   12 -> Section M  (no secret/PIN material in the management result)
--   13 -> Section C  (Phase 1C publication fields still return correctly)
--   14 -> Section C  (latest current update behavior remains intact)

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
  if to_regclass('public.text2task_client_share_phase2b_mapping_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 2B mapping-read runtime test sentinel was not found. Run 01_CREATE_TEMP_TEST_FIXTURE.sql and 02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql first, in that order, in this same temporary project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase2b_mapping_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_2B_MAPPING_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row does not identify this project as a disposable Phase 2B mapping-read runtime test project.';
  end if;

  select array_agg(t.tbl) into v_missing_tables
    from (values
      ('project_share_links'), ('share_link_tasks'), ('share_link_resources'),
      ('share_link_updates')
    ) as t(tbl)
    where to_regclass('public.' || t.tbl) is null;

  if v_missing_tables is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected table(s): %s. Run 02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql first.',
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
      'REFUSING TO RUN. Missing expected Phase 1C column(s) on project_share_links: %s. Run 02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql first.',
      array_to_string(v_missing_columns, ', ')
    );
  end if;

  select array_agg(t.fn) into v_missing_functions
    from (values
      ('get_share_link_management_state(uuid)'),
      ('create_share_link_draft(uuid,text)'),
      ('revoke_share_link(uuid)'),
      ('save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)')
    ) as t(fn)
    where to_regprocedure('public.' || t.fn) is null;

  if v_missing_functions is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected RPC(s): %s. Run 02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql first.',
      array_to_string(v_missing_functions, ', ')
    );
  end if;
end;
$$;

begin;

-- =========================================================
-- 1. Assertion infrastructure (identical to the Phase 1B/1C packages'
--    own harness -- see either file's own comment for the full rationale
--    of each helper).
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
    'PHASE2B_EXPECTED_SUCCESS_FAILED: %s/%s: %s did not PASS, so its downstream dependents cannot be trusted to run against the state they assume. Recorded result for %s/%s -- status: %s, detail: %s',
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
--     Phase 1B/1C packages -- see either file's own comment).
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
-- 2. Shared fixture data (created as the Postgres superuser). Two tasks
--    and two Resources, all under project A1, so the exact-metadata and
--    partial-edit sections below have two real siblings to compare.
-- =========================================================

do $$
declare
  v_owner_a uuid := '11111111-1111-4111-8111-111111111111';
  v_owner_b uuid := '22222222-2222-4222-8222-222222222222';
  v_project_a1 uuid;
  v_project_b1 uuid;
  v_task_a1 bigint;
  v_task_a2 bigint;
  v_resource_a1 uuid;
  v_resource_a2 uuid;
begin
  perform pg_temp.act_as('postgres');

  insert into public.projects (user_id) values (v_owner_a) returning id into v_project_a1;
  insert into public.projects (user_id) values (v_owner_b) returning id into v_project_b1;

  insert into public.tasks (user_id, project_id) values (v_owner_a, v_project_a1) returning id into v_task_a1;
  insert into public.tasks (user_id, project_id) values (v_owner_a, v_project_a1) returning id into v_task_a2;
  insert into public.task_resources (user_id, project_id) values (v_owner_a, v_project_a1) returning id into v_resource_a1;
  insert into public.task_resources (user_id, project_id) values (v_owner_a, v_project_a1) returning id into v_resource_a2;

  perform pg_temp.set_val('owner_a', v_owner_a::text);
  perform pg_temp.set_val('owner_b', v_owner_b::text);
  perform pg_temp.set_val('project_a1', v_project_a1::text);
  perform pg_temp.set_val('project_b1', v_project_b1::text);
  perform pg_temp.set_val('task_a1', v_task_a1::text);
  perform pg_temp.set_val('task_a2', v_task_a2::text);
  perform pg_temp.set_val('resource_a1', v_resource_a1::text);
  perform pg_temp.set_val('resource_a2', v_resource_a2::text);
end;
$$;

-- =========================================================
-- SECTION A -- Owner A creates a draft on project A1.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'A', 'A1', 'owner A creates a draft on project A1 with a valid deterministic 24-character V1 public id',
    format('select public.create_share_link_draft(%L::uuid, %L::text)', pg_temp.get_uuid('project_a1'), 'phase2bMapReadA1Link0001'),
    true, null, null, 'link_a1'
  );
  perform pg_temp.require_test_pass('A', 'A1', 'draft creation on project A1');
  perform pg_temp.set_val('link_a1_id', (pg_temp.get_val('link_a1')::jsonb->>'linkId'));
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION B -- One atomic save persists: two publication-intent flags
-- (item 13 setup), two tasks with distinct out-of-sequence displayOrder
-- values (8 and 4), two Resources with distinct out-of-sequence
-- displayOrder values (9 and 2), and a first published update (item 14
-- setup).
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'B', 'B1', 'owner A saves settings + two tasks + two resources + a publish update in one atomic call',
    format(
      'select public.save_share_configuration(%L::uuid, %L::jsonb, %L::jsonb, %L::jsonb, %L::jsonb)',
      pg_temp.get_val('link_a1_id'),
      '{"titleVisible": true, "statusVisible": false, "targetDateVisible": true}',
      format(
        '[{"subtaskId": "%s", "publicGroup": "waiting_for_feedback", "waitingForClientFeedback": true, "displayOrder": 8}, {"subtaskId": "%s", "publicGroup": "completed", "waitingForClientFeedback": false, "displayOrder": 4}]',
        pg_temp.get_val('task_a1'), pg_temp.get_val('task_a2')
      ),
      format(
        '[{"resourceId": "%s", "publicLabel": "Final logo", "canDownload": false, "displayOrder": 9}, {"resourceId": "%s", "publicLabel": "Other", "canDownload": true, "displayOrder": 2}]',
        pg_temp.get_val('resource_a1'), pg_temp.get_val('resource_a2')
      ),
      '{"body": "Phase 2B mapping-read runtime check v1"}'
    ),
    true, null, null, 'save_b1'
  );
  perform pg_temp.require_test_pass('B', 'B1', 'combined settings+tasks+resources+publishUpdate save');
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION C -- ITEMS 1, 3, 13, 14: the management-state read returns
-- complete, exact task mapping metadata (never bare ids), displayOrder
-- exactly as persisted (8 and 4, not renumbered), the Phase 1C
-- publication flags, and the current update body/version/publishedAt.
-- =========================================================

do $$
declare
  v_task_a1_obj jsonb;
  v_task_a2_obj jsonb;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'C', 'C1', 'management-state read for project A1 after the combined save',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_b'
  );
  perform pg_temp.require_test_pass('C', 'C1', 'management-state read');

  select item into v_task_a1_obj
    from jsonb_array_elements(pg_temp.get_val('mgmt_a1_b')::jsonb->'mappedTasks') as item
    where item->>'subtaskId' = pg_temp.get_val('task_a1');
  select item into v_task_a2_obj
    from jsonb_array_elements(pg_temp.get_val('mgmt_a1_b')::jsonb->'mappedTasks') as item
    where item->>'subtaskId' = pg_temp.get_val('task_a2');

  perform pg_temp.record_result(
    'C', 'C2-TASK-A1', 'Task A1''s mapped entry carries its exact persisted publicGroup/waitingForClientFeedback/displayOrder (item 1, item 3: 8 stays 8)',
    v_task_a1_obj = jsonb_build_object(
      'subtaskId', pg_temp.get_val('task_a1'),
      'publicGroup', 'waiting_for_feedback',
      'waitingForClientFeedback', true,
      'displayOrder', 8
    ),
    'subtaskId/publicGroup=waiting_for_feedback/waitingForClientFeedback=true/displayOrder=8',
    v_task_a1_obj::text,
    null
  );
  perform pg_temp.record_result(
    'C', 'C2-TASK-A2', 'Task A2''s mapped entry carries its exact persisted publicGroup/waitingForClientFeedback/displayOrder (item 1, item 3: 4 stays 4)',
    v_task_a2_obj = jsonb_build_object(
      'subtaskId', pg_temp.get_val('task_a2'),
      'publicGroup', 'completed',
      'waitingForClientFeedback', false,
      'displayOrder', 4
    ),
    'subtaskId/publicGroup=completed/waitingForClientFeedback=false/displayOrder=4',
    v_task_a2_obj::text,
    null
  );
  perform pg_temp.record_result(
    'C', 'C3', 'mappedTasks contains exactly two entries -- no extra, no missing',
    jsonb_array_length(pg_temp.get_val('mgmt_a1_b')::jsonb->'mappedTasks') = 2,
    '2',
    jsonb_array_length(pg_temp.get_val('mgmt_a1_b')::jsonb->'mappedTasks')::text,
    null
  );

  perform pg_temp.record_result(
    'C', 'C4-FLAGS', 'titleVisible/statusVisible/targetDateVisible read back exactly as saved (item 13)',
    (pg_temp.get_val('mgmt_a1_b')::jsonb->'link'->>'titleVisible') = 'true'
      and (pg_temp.get_val('mgmt_a1_b')::jsonb->'link'->>'statusVisible') = 'false'
      and (pg_temp.get_val('mgmt_a1_b')::jsonb->'link'->>'targetDateVisible') = 'true',
    'true/false/true',
    format('%s/%s/%s',
      pg_temp.get_val('mgmt_a1_b')::jsonb->'link'->>'titleVisible',
      pg_temp.get_val('mgmt_a1_b')::jsonb->'link'->>'statusVisible',
      pg_temp.get_val('mgmt_a1_b')::jsonb->'link'->>'targetDateVisible'
    ),
    null
  );

  perform pg_temp.record_result(
    'C', 'C5-UPDATE', 'currentUpdate carries the exact published body, version 1, and a real publishedAt (item 14)',
    (pg_temp.get_val('mgmt_a1_b')::jsonb->'currentUpdate'->>'body') = 'Phase 2B mapping-read runtime check v1'
      and (pg_temp.get_val('mgmt_a1_b')::jsonb->'currentUpdate'->>'version') = '1'
      and (pg_temp.get_val('mgmt_a1_b')::jsonb->'currentUpdate'->>'publishedAt') is not null,
    'body=Phase 2B mapping-read runtime check v1, version=1, publishedAt=(non-null)',
    (pg_temp.get_val('mgmt_a1_b')::jsonb->'currentUpdate')::text,
    null
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION D -- ITEMS 2, 3: the management-state read returns complete,
-- exact Resource mapping metadata, displayOrder exactly as persisted (9
-- and 2, not renumbered).
-- =========================================================

do $$
declare
  v_resource_a1_obj jsonb;
  v_resource_a2_obj jsonb;
begin
  select item into v_resource_a1_obj
    from jsonb_array_elements(pg_temp.get_val('mgmt_a1_b')::jsonb->'mappedResources') as item
    where item->>'resourceId' = pg_temp.get_val('resource_a1');
  select item into v_resource_a2_obj
    from jsonb_array_elements(pg_temp.get_val('mgmt_a1_b')::jsonb->'mappedResources') as item
    where item->>'resourceId' = pg_temp.get_val('resource_a2');

  perform pg_temp.record_result(
    'D', 'D1-RESOURCE-A1', 'Resource A1''s mapped entry carries its exact persisted publicLabel/canDownload(false)/displayOrder (item 2, item 3: 9 stays 9)',
    v_resource_a1_obj = jsonb_build_object(
      'resourceId', pg_temp.get_val('resource_a1'),
      'publicLabel', 'Final logo',
      'canDownload', false,
      'displayOrder', 9
    ),
    'resourceId/publicLabel=Final logo/canDownload=false/displayOrder=9',
    v_resource_a1_obj::text,
    null
  );
  perform pg_temp.record_result(
    'D', 'D2-RESOURCE-A2', 'Resource A2''s mapped entry carries its exact persisted publicLabel/canDownload(true)/displayOrder (item 2, item 3: 2 stays 2)',
    v_resource_a2_obj = jsonb_build_object(
      'resourceId', pg_temp.get_val('resource_a2'),
      'publicLabel', 'Other',
      'canDownload', true,
      'displayOrder', 2
    ),
    'resourceId/publicLabel=Other/canDownload=true/displayOrder=2',
    v_resource_a2_obj::text,
    null
  );
  perform pg_temp.record_result(
    'D', 'D3', 'mappedResources contains exactly two entries -- no extra, no missing',
    jsonb_array_length(pg_temp.get_val('mgmt_a1_b')::jsonb->'mappedResources') = 2,
    '2',
    jsonb_array_length(pg_temp.get_val('mgmt_a1_b')::jsonb->'mappedResources')::text,
    null
  );
end;
$$;

-- =========================================================
-- SECTION E -- ITEM 4: resubmitting the full task set after changing
-- ONLY Task A2's publicGroup (exactly what the corrected owner editor
-- now does, reading Task A1's real metadata from Section C's read and
-- resubmitting it verbatim) must not lose or alter Task A1's metadata.
-- Same proof repeated for Resources, changing only Resource A2's label.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'E', 'E1', 'owner A resubmits the full task set, changing ONLY Task A2''s publicGroup, reusing Task A1''s exact metadata read back in Section C',
    format(
      'select public.save_share_configuration(%L::uuid, null, %L::jsonb, null, null)',
      pg_temp.get_val('link_a1_id'),
      format(
        '[{"subtaskId": "%s", "publicGroup": "waiting_for_feedback", "waitingForClientFeedback": true, "displayOrder": 8}, {"subtaskId": "%s", "publicGroup": "in_progress", "waitingForClientFeedback": false, "displayOrder": 4}]',
        pg_temp.get_val('task_a1'), pg_temp.get_val('task_a2')
      )
    ),
    true, null, null, 'save_e1'
  );
  perform pg_temp.require_test_pass('E', 'E1', 'partial-edit task resave');

  perform pg_temp.try_rpc(
    'E', 'E2', 'management-state read after the partial task edit',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_e'
  );
  perform pg_temp.record_result(
    'E', 'E3-TASK-A1-UNCHANGED', 'Task A1 (never touched by this save) is exactly unchanged: publicGroup=waiting_for_feedback, waitingForClientFeedback=true, displayOrder=8',
    (
      select item = jsonb_build_object(
          'subtaskId', pg_temp.get_val('task_a1'),
          'publicGroup', 'waiting_for_feedback',
          'waitingForClientFeedback', true,
          'displayOrder', 8
        )
      from jsonb_array_elements(pg_temp.get_val('mgmt_a1_e')::jsonb->'mappedTasks') as item
      where item->>'subtaskId' = pg_temp.get_val('task_a1')
    ),
    'unchanged',
    (
      select item::text
      from jsonb_array_elements(pg_temp.get_val('mgmt_a1_e')::jsonb->'mappedTasks') as item
      where item->>'subtaskId' = pg_temp.get_val('task_a1')
    ),
    null
  );
  perform pg_temp.record_result(
    'E', 'E4-TASK-A2-CHANGED', 'Task A2''s publicGroup is now in_progress as intentionally edited',
    (
      select item->>'publicGroup' = 'in_progress'
      from jsonb_array_elements(pg_temp.get_val('mgmt_a1_e')::jsonb->'mappedTasks') as item
      where item->>'subtaskId' = pg_temp.get_val('task_a2')
    ),
    'in_progress',
    (
      select item->>'publicGroup'
      from jsonb_array_elements(pg_temp.get_val('mgmt_a1_e')::jsonb->'mappedTasks') as item
      where item->>'subtaskId' = pg_temp.get_val('task_a2')
    ),
    null
  );

  perform pg_temp.try_rpc(
    'E', 'E5', 'owner A resubmits the full resource set, changing ONLY Resource A2''s publicLabel, reusing Resource A1''s exact metadata read back in Section D',
    format(
      'select public.save_share_configuration(%L::uuid, null, null, %L::jsonb, null)',
      pg_temp.get_val('link_a1_id'),
      format(
        '[{"resourceId": "%s", "publicLabel": "Final logo", "canDownload": false, "displayOrder": 9}, {"resourceId": "%s", "publicLabel": "Other (updated)", "canDownload": true, "displayOrder": 2}]',
        pg_temp.get_val('resource_a1'), pg_temp.get_val('resource_a2')
      )
    ),
    true, null, null, 'save_e5'
  );
  perform pg_temp.require_test_pass('E', 'E5', 'partial-edit resource resave');

  perform pg_temp.try_rpc(
    'E', 'E6', 'management-state read after the partial resource edit',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_e2'
  );
  perform pg_temp.record_result(
    'E', 'E7-RESOURCE-A1-UNCHANGED', 'Resource A1 (never touched by this save) is exactly unchanged: publicLabel=Final logo, canDownload=false, displayOrder=9',
    (
      select item = jsonb_build_object(
          'resourceId', pg_temp.get_val('resource_a1'),
          'publicLabel', 'Final logo',
          'canDownload', false,
          'displayOrder', 9
        )
      from jsonb_array_elements(pg_temp.get_val('mgmt_a1_e2')::jsonb->'mappedResources') as item
      where item->>'resourceId' = pg_temp.get_val('resource_a1')
    ),
    'unchanged',
    (
      select item::text
      from jsonb_array_elements(pg_temp.get_val('mgmt_a1_e2')::jsonb->'mappedResources') as item
      where item->>'resourceId' = pg_temp.get_val('resource_a1')
    ),
    null
  );
  perform pg_temp.record_result(
    'E', 'E8-RESOURCE-A2-CHANGED', 'Resource A2''s publicLabel is now "Other (updated)" as intentionally edited, canDownload=true preserved',
    (
      select item->>'publicLabel' = 'Other (updated)' and (item->>'canDownload')::boolean = true
      from jsonb_array_elements(pg_temp.get_val('mgmt_a1_e2')::jsonb->'mappedResources') as item
      where item->>'resourceId' = pg_temp.get_val('resource_a2')
    ),
    'publicLabel=Other (updated), canDownload=true',
    (
      select item::text
      from jsonb_array_elements(pg_temp.get_val('mgmt_a1_e2')::jsonb->'mappedResources') as item
      where item->>'resourceId' = pg_temp.get_val('resource_a2')
    ),
    null
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION F -- ITEM 5: exact-set replacement still works -- submitting a
-- tasks array that DROPS Task A2 removes it from the mapping.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'F', 'F1', 'owner A resubmits the task set containing ONLY Task A1 -- an exact-set replacement',
    format(
      'select public.save_share_configuration(%L::uuid, null, %L::jsonb, null, null)',
      pg_temp.get_val('link_a1_id'),
      format(
        '[{"subtaskId": "%s", "publicGroup": "waiting_for_feedback", "waitingForClientFeedback": true, "displayOrder": 8}]',
        pg_temp.get_val('task_a1')
      )
    ),
    true, null, null, 'save_f1'
  );
  perform pg_temp.require_test_pass('F', 'F1', 'exact-set task replacement');

  perform pg_temp.try_rpc(
    'F', 'F2', 'management-state read confirms Task A2 was removed by the exact-set replacement',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_f'
  );
  perform pg_temp.record_result(
    'F', 'F3', 'mappedTasks now contains exactly one entry (Task A1 only)',
    jsonb_array_length(pg_temp.get_val('mgmt_a1_f')::jsonb->'mappedTasks') = 1
      and (pg_temp.get_val('mgmt_a1_f')::jsonb->'mappedTasks'->0->>'subtaskId') = pg_temp.get_val('task_a1'),
    format('[{"subtaskId":"%s"}]', pg_temp.get_val('task_a1')),
    (pg_temp.get_val('mgmt_a1_f')::jsonb->'mappedTasks')::text,
    null
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION G -- ITEM 6: submitting an empty tasks array clears the
-- mapping entirely.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'G', 'G1', 'owner A submits an empty tasks array',
    format('select public.save_share_configuration(%L::uuid, null, %L::jsonb, null, null)', pg_temp.get_val('link_a1_id'), '[]'),
    true, null, null, 'save_g1'
  );
  perform pg_temp.require_test_pass('G', 'G1', 'empty-set task clear');

  perform pg_temp.try_rpc(
    'G', 'G2', 'management-state read confirms mappedTasks is now empty',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_g'
  );
  perform pg_temp.record_result(
    'G', 'G3', 'mappedTasks is an empty array after the empty-set clear',
    jsonb_array_length(pg_temp.get_val('mgmt_a1_g')::jsonb->'mappedTasks') = 0,
    '0',
    jsonb_array_length(pg_temp.get_val('mgmt_a1_g')::jsonb->'mappedTasks')::text,
    null
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION H -- ITEM 7: omitting the resources group entirely (null)
-- leaves the existing Resource mapping unchanged -- re-verified after
-- Section G's task-only clear proves the two groups are independent.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'H', 'H1', 'owner A saves settings only, omitting tasks and resources entirely (both null)',
    format('select public.save_share_configuration(%L::uuid, %L::jsonb, null, null, null)', pg_temp.get_val('link_a1_id'), '{"commentsEnabled": false}'),
    true, null, null, 'save_h1'
  );
  perform pg_temp.require_test_pass('H', 'H1', 'settings-only save with omitted tasks/resources');

  perform pg_temp.try_rpc(
    'H', 'H2', 'management-state read confirms mappedResources is unchanged from Section E (Resource A1 + Resource A2)',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_h'
  );
  perform pg_temp.record_result(
    'H', 'H3', 'mappedResources still contains exactly the two Resources from Section E, unchanged',
    jsonb_array_length(pg_temp.get_val('mgmt_a1_h')::jsonb->'mappedResources') = 2
      and (
        select item = jsonb_build_object('resourceId', pg_temp.get_val('resource_a1'), 'publicLabel', 'Final logo', 'canDownload', false, 'displayOrder', 9)
        from jsonb_array_elements(pg_temp.get_val('mgmt_a1_h')::jsonb->'mappedResources') as item
        where item->>'resourceId' = pg_temp.get_val('resource_a1')
      ),
    '2 entries, Resource A1 unchanged',
    (pg_temp.get_val('mgmt_a1_h')::jsonb->'mappedResources')::text,
    null
  );
  perform pg_temp.record_result(
    'H', 'H4', 'mappedTasks is still empty (Section G''s clear is independent of this settings-only save)',
    jsonb_array_length(pg_temp.get_val('mgmt_a1_h')::jsonb->'mappedTasks') = 0,
    '0',
    jsonb_array_length(pg_temp.get_val('mgmt_a1_h')::jsonb->'mappedTasks')::text,
    null
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION I -- ITEM 8: cross-tenant management read remains denied.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc(
    'I', 'I1', 'owner B cannot read owner A''s management state for project A1',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    false, 'PROJECT_NOT_FOUND', 'P0001'
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION J -- ITEM 9: revoked-link management behavior remains correct
-- -- a revoked link reads back as link=null with empty mapping arrays.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc(
    'J', 'J1', 'owner A revokes link A1',
    format('select public.revoke_share_link(%L::uuid)', pg_temp.get_val('link_a1_id')),
    true, null, null, 'revoke_j1'
  );
  perform pg_temp.require_test_pass('J', 'J1', 'revoke link A1');

  perform pg_temp.try_rpc(
    'J', 'J2', 'management-state read for project A1 after revocation',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'mgmt_a1_j'
  );
  perform pg_temp.record_result(
    'J', 'J3', 'link is null and both mapping arrays are empty after revocation',
    (pg_temp.get_val('mgmt_a1_j')::jsonb->'link') = 'null'::jsonb
      and jsonb_array_length(pg_temp.get_val('mgmt_a1_j')::jsonb->'mappedTasks') = 0
      and jsonb_array_length(pg_temp.get_val('mgmt_a1_j')::jsonb->'mappedResources') = 0,
    'link=null, mappedTasks=[], mappedResources=[]',
    pg_temp.get_val('mgmt_a1_j'),
    null
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION K -- ITEM 10: anon cannot execute the management RPC at all.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('anon');
  perform pg_temp.try_rpc(
    'K', 'K1', 'anon cannot execute get_share_link_management_state at all',
    format('select public.get_share_link_management_state(%L::uuid)', pg_temp.get_uuid('project_a1')),
    false, null, '42501'
  );
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION L -- ITEM 11: authenticated grant posture is unchanged --
-- authenticated has EXECUTE, anon and service_role do not.
-- =========================================================

do $$
begin
  perform pg_temp.record_result(
    'L', 'L1-GRANT-AUTH', 'authenticated has EXECUTE on get_share_link_management_state',
    has_function_privilege('authenticated', 'public.get_share_link_management_state(uuid)', 'EXECUTE'),
    'true', has_function_privilege('authenticated', 'public.get_share_link_management_state(uuid)', 'EXECUTE')::text, null
  );
  perform pg_temp.record_result(
    'L', 'L2-GRANT-ANON', 'anon does NOT have EXECUTE on get_share_link_management_state',
    not has_function_privilege('anon', 'public.get_share_link_management_state(uuid)', 'EXECUTE'),
    'false', has_function_privilege('anon', 'public.get_share_link_management_state(uuid)', 'EXECUTE')::text, null
  );
  perform pg_temp.record_result(
    'L', 'L3-GRANT-SVC', 'service_role does NOT have EXECUTE on get_share_link_management_state',
    not has_function_privilege('service_role', 'public.get_share_link_management_state(uuid)', 'EXECUTE'),
    'false', has_function_privilege('service_role', 'public.get_share_link_management_state(uuid)', 'EXECUTE')::text, null
  );
  perform pg_temp.record_result(
    'L', 'L4-SECURITY-MODE', 'get_share_link_management_state is still SECURITY INVOKER, not DEFINER',
    (select not p.prosecdef from pg_proc p where p.oid = 'public.get_share_link_management_state(uuid)'::regprocedure),
    'false',
    (select p.prosecdef::text from pg_proc p where p.oid = 'public.get_share_link_management_state(uuid)'::regprocedure),
    null
  );
end;
$$;

-- =========================================================
-- SECTION M -- ITEM 12: no secret/PIN material appears anywhere in the
-- management result -- the managed link object's key set is exactly the
-- known-safe allowlist, and the mapping item objects contain only their
-- four documented fields.
-- =========================================================

do $$
declare
  v_link_keys text[];
  v_expected_link_keys text[] := array[
    'id','publicId','state','expiresAt','hasPin','commentsEnabled',
    'clientFacingSubtitle','contentDirection','titleVisible','statusVisible',
    'targetDateVisible','configurationVersion','createdAt','activatedAt',
    'disabledAt','rotatedAt','lastViewedAt','viewCount'
  ];
  v_task_keys text[];
  v_resource_keys text[];
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  select array_agg(k order by k) into v_link_keys
    from jsonb_object_keys(pg_temp.get_val('mgmt_a1_b')::jsonb->'link') as k;

  perform pg_temp.record_result(
    'M', 'M1-LINK-KEYS', 'the managed link object exposes exactly the known-safe allowlisted keys -- no secret_digest, pin_hash, pin_salt, user_id or project_id',
    v_link_keys = (select array_agg(k order by k) from unnest(v_expected_link_keys) as k),
    array_to_string((select array_agg(k order by k) from unnest(v_expected_link_keys) as k), ','),
    array_to_string(v_link_keys, ','),
    null
  );

  select array_agg(k order by k) into v_task_keys
    from jsonb_object_keys(pg_temp.get_val('mgmt_a1_b')::jsonb->'mappedTasks'->0) as k;
  perform pg_temp.record_result(
    'M', 'M2-TASK-KEYS', 'each mapped task object exposes exactly subtaskId/publicGroup/waitingForClientFeedback/displayOrder',
    v_task_keys = array['displayOrder','publicGroup','subtaskId','waitingForClientFeedback'],
    'displayOrder,publicGroup,subtaskId,waitingForClientFeedback',
    array_to_string(v_task_keys, ','),
    null
  );

  select array_agg(k order by k) into v_resource_keys
    from jsonb_object_keys(pg_temp.get_val('mgmt_a1_b')::jsonb->'mappedResources'->0) as k;
  perform pg_temp.record_result(
    'M', 'M3-RESOURCE-KEYS', 'each mapped resource object exposes exactly resourceId/publicLabel/canDownload/displayOrder -- no storage_path, file_name, url, mime_type, size_bytes or notes',
    v_resource_keys = array['canDownload','displayOrder','publicLabel','resourceId'],
    'canDownload,displayOrder,publicLabel,resourceId',
    array_to_string(v_resource_keys, ','),
    null
  );

  perform pg_temp.record_result(
    'M', 'M4-NO-SECRET-TEXT', 'the raw management-state result text never contains a secret/digest/pin substring',
    pg_temp.get_val('mgmt_a1_b') !~* '(secret|digest|pin_hash|pin_salt)',
    'no match',
    case when pg_temp.get_val('mgmt_a1_b') ~* '(secret|digest|pin_hash|pin_salt)' then 'matched a forbidden substring' else 'no match' end,
    null
  );
  perform pg_temp.act_as('postgres');
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
    when count(*) filter (where status = 'FAIL') = 0 then 'PHASE_2B_MAPPING_RUNTIME_PASS'
    else 'PHASE_2B_MAPPING_RUNTIME_FAIL'
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

-- Fail loudly at the very end if anything failed -- see the Phase 1B/1C
-- packages' own file 03 headers for the full rationale of this pattern
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
      'PHASE_2B_MAPPING_RUNTIME_FAIL: %s of %s tests failed. FAILS=[%s]',
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
