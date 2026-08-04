-- Text2Task Client Share Link -- Phase 1A SQL Editor Package
-- File 03: Real SQL runtime behaviour tests
--
-- Run this THIRD, after files 01 and 02, in the same temporary Supabase
-- project. Never run this in the real Text2Task production project.
--
-- METHODOLOGY (read this before reading the tests below):
--
-- These are REAL PostgreSQL behaviour tests, not string/regex tests.
-- Every assertion below either (a) executes a real INSERT/UPDATE/DELETE
-- statement and checks whether it succeeds or fails with the expected
-- SQLSTATE and, where applicable, the exact stable P0001 message, or
-- (b) checks real Postgres catalog state (has_table_privilege,
-- has_column_privilege, pg_policies, row counts under a real
-- RLS-scoped role). Nothing here asserts against migration SQL text.
--
-- SQLSTATE DISCIPLINE: every expected-failure test specifies the exact
-- SQLSTATE it must fail with, not just "any error". Stable trigger
-- errors require SQLSTATE P0001 plus the exact message; permission
-- lockouts require 42501; unique-constraint violations require 23505;
-- CHECK-constraint violations require 23514. This prevents an unrelated
-- failure from producing a false PASS.
--
-- ROLE METHODOLOGY -- IMPORTANT, READ BEFORE INTERPRETING RESULTS:
-- Phase 1A intentionally grants NO direct INSERT/UPDATE/DELETE table
-- privilege to `authenticated` on any of the six owner-facing tables, and
-- grants `service_role` only a narrow, column-restricted subset (see
-- 202608030005_client_share_integrity_and_security.sql, section 9, and
-- AGENTS.md rule 18). That lockdown is itself real product design, not an
-- oversight: every owner mutation that affects a product invariant is
-- meant to go through a future, transactional Phase 1B RPC. Sections B, C
-- and D below test that lockdown directly, as the anon/authenticated/
-- service_role roles, and EXPECT most direct table writes to fail with
-- "permission denied" (SQLSTATE 42501) at the grant layer.
--
-- Sections E through L, which test the cross-table RELATIONSHIP INTEGRITY
-- triggers themselves (ownership mismatch, cross-project mismatch,
-- immutability, monotonicity, cascades), are run as the Postgres
-- superuser -- the same role a pasted SQL Editor script runs as by
-- default -- because that is the only role in Phase 1A that currently has
-- table privileges on every table involved. BEFORE triggers fire
-- regardless of caller role or RLS bypass, so this is a faithful,
-- unweakened test of the integrity RULES themselves. It does NOT, and
-- cannot yet, prove that a future Phase 1B owner-facing RPC works
-- end-to-end, because that RPC does not exist yet. This distinction is
-- stated again in the Phase 1A SQL Editor package report.
--
-- PIN NOTE: E18 deliberately makes link_e1 PIN-protected for the rest of
-- this script. Every later VALID (successful) grant issued for link_e1
-- therefore supplies a non-null pin_verified_at; other_link stays the
-- non-PIN comparison link throughout.
--
-- Everything below runs inside one transaction and ends with ROLLBACK.
-- No row created by this file survives a successful or failed run.

-- =========================================================
-- 0. Safety gate
-- =========================================================

do $$
declare
  v_sentinel_kind text;
  v_missing_tables text[];
  v_missing_triggers text[];
begin
  if to_regclass('public.text2task_client_share_phase1a_test_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 1A test sentinel was not found. Run 01_CREATE_TEMP_TEST_FIXTURE.sql and 02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql first, in that order, in this same temporary project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase1a_test_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_1A_SQL_EDITOR_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row does not identify this project as a disposable Phase 1A test project.';
  end if;

  select array_agg(t.tbl) into v_missing_tables
    from (values
      ('project_share_links'), ('share_link_tasks'), ('share_link_resources'),
      ('share_link_updates'), ('share_messages'), ('share_message_conversions'),
      ('share_browser_sessions'), ('share_session_grants'),
      ('share_link_events'), ('share_rate_limit_buckets')
    ) as t(tbl)
    where to_regclass('public.' || t.tbl) is null;

  if v_missing_tables is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected Phase 1A table(s): %s. Run 02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql first.',
      array_to_string(v_missing_tables, ', ')
    );
  end if;

  select array_agg(t.trg) into v_missing_triggers
    from (values
      ('project_share_links_enforce_integrity'), ('share_link_tasks_enforce_integrity'),
      ('share_link_resources_enforce_integrity'), ('share_link_updates_enforce_integrity'),
      ('share_messages_enforce_integrity'), ('share_message_conversions_enforce_integrity'),
      ('share_browser_sessions_enforce_integrity'), ('share_session_grants_enforce_integrity')
    ) as t(trg)
    where not exists (
      select 1 from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and tg.tgname = t.trg and not tg.tgisinternal
    );

  if v_missing_triggers is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected Phase 1A trigger(s): %s. Run 02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql first.',
      array_to_string(v_missing_triggers, ', ')
    );
  end if;
end;
$$;

begin;

-- =========================================================
-- 1. Assertion infrastructure
-- =========================================================

create temporary table _test_results (
  seq serial primary key,
  section text not null,
  test_code text not null,
  description text not null,
  status text not null,
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

create or replace function pg_temp.get_bigint(p_key text) returns bigint
language sql as $f$
  select value::bigint from _fixture_state where key = p_key;
$f$;

create or replace function pg_temp.fake_hex64(p_seed text) returns text
language sql as $f$
  select substr(md5(p_seed) || md5(p_seed || '-2') || md5(p_seed || '-3'), 1, 64);
$f$;

create or replace function pg_temp.fake_b64url(p_len integer) returns text
language sql as $f$
  select string_agg(
    substr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
           (floor(random() * 64))::int + 1, 1),
    ''
  )
  from generate_series(1, p_len);
$f$;

create or replace function pg_temp.record_result(
  p_section text, p_code text, p_desc text, p_pass boolean, p_detail text default null
) returns void language plpgsql as $f$
begin
  insert into _test_results(section, test_code, description, status, detail)
  values (p_section, p_code, p_desc, case when coalesce(p_pass, false) then 'PASS' else 'FAIL' end, p_detail);
end;
$f$;

-- Executes p_sql. Records PASS if the success/failure outcome matches
-- expectations AND, for expected failures, the actual SQLSTATE (and,
-- when supplied, the exact stable P0001 message) matches expectation.
-- p_expected_sqlstate = null means "any SQLSTATE accepted" and should
-- only ever be used for a p_expect_success = true call; every
-- expected-failure call in this file supplies a concrete SQLSTATE.
create or replace function pg_temp.try_stmt(
  p_section text,
  p_code text,
  p_desc text,
  p_sql text,
  p_expect_success boolean,
  p_expected_message text default null,
  p_expected_sqlstate text default null
) returns void language plpgsql as $f$
declare
  v_pass boolean;
  v_detail text;
  v_errmsg text;
  v_sqlstate text;
begin
  begin
    execute p_sql;
    if p_expect_success then
      v_pass := true;
      v_detail := 'succeeded as expected';
    else
      v_pass := false;
      v_detail := 'expected failure but the statement succeeded';
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

  perform pg_temp.record_result(p_section, p_code, p_desc, v_pass, v_detail);
end;
$f$;

-- Fail-closed dependency guard. Several fixtures below run an
-- expected-success try_stmt, then a separate SELECT ... INTO to capture
-- the row's generated id, then persist that id (via set_val, for
-- cross-block reuse, or as a local variable for same-block reuse by
-- later tests). If the try_stmt step actually failed for any reason,
-- that SELECT finds nothing and the id variable is NULL. Left
-- unguarded, a NULL id either (a) gets handed to set_val, whose
-- _fixture_state.value column is NOT NULL, producing an unrelated
-- 23502 constraint-violation error that completely masks the real
-- failure, or (b) gets used in a later `where id = <null>` clause,
-- which matches zero rows and lets an UPDATE "succeed" as a silent
-- no-op -- turning an expected-failure test into a false PASS instead
-- of surfacing the real problem. Call this immediately after every such
-- SELECT ... INTO, before the id is used for anything else. On failure
-- it raises with the ACTUAL recorded result (status and detail) of the
-- setup step that should have produced the row, not a generic message.
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
    'PHASE1A_SETUP_DEPENDENCY_FAILED: %s/%s: expected a %s row to exist after this expected-success step, but none was found. Recorded result for %s/%s -- status: %s, detail: %s',
    p_section, p_code, p_label, p_section, p_code,
    coalesce(v_status, '(no result row was recorded for this test code)'),
    coalesce(v_detail, '(no detail recorded)')
  );
end;
$f$;

-- Fail-closed EXPECTED-SUCCESS result guard. require_id (above) only
-- catches a missing GENERATED ID -- it says nothing about an
-- expected-success UPDATE that ran, changed nothing meaningful (or
-- changed the wrong thing), and still recorded FAIL, where no later
-- step ever does a SELECT ... INTO against it at all (state-only
-- setups such as activating a link, advancing a timestamp, or
-- publishing a second version). Call this immediately after any
-- expected-success try_stmt whose STATE, not just its existence, later
-- tests rely on. It does not change try_stmt's own semantics or
-- reinterpret its result in any way -- it only reads the exact PASS/FAIL
-- already recorded and stops the script if it was not PASS, so a
-- downstream test cannot silently run against a fixture that was never
-- actually put into the state its own description claims.
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
    'PHASE1A_EXPECTED_SUCCESS_FAILED: %s/%s: %s did not PASS, so its downstream dependents cannot be trusted to run against the state they assume. Recorded result for %s/%s -- status: %s, detail: %s',
    p_section, p_code, p_label, p_section, p_code,
    coalesce(v_status, '(no result row was recorded for this test code)'),
    coalesce(v_detail, '(no detail recorded)')
  );
end;
$f$;

-- Switches the current session to p_role (anon / authenticated /
-- service_role / postgres), simulating auth.uid() = p_user_id via the
-- same request.jwt.claims GUC Supabase's own auth.uid() reads. Always
-- RESETs to the original superuser session identity first, since
-- non-superuser roles are not guaranteed to be able to SET ROLE to each
-- other directly.
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
-- 1b. Harness privileges for switched roles
--
-- PostgreSQL permission checks use current_user AFTER SET ROLE. anon,
-- authenticated and service_role do not automatically own or receive
-- privileges on temporary objects created by the Postgres superuser
-- session, and every pg_temp.* helper above is deliberately SECURITY
-- INVOKER (never SECURITY DEFINER -- see the comment below), so a
-- switched role's own privileges are what actually get exercised when
-- it calls set_val/get_val/record_result/try_stmt. Without these
-- grants, every role-switched test in Sections B/C/D onward would fail
-- at the HARNESS layer (cannot write a result row) rather than testing
-- the actual product boundary it exists to test.
--
-- These are grants on TEMPORARY objects inside a disposable test
-- transaction in a disposable test project -- never production grants,
-- and never touching any Client Share table.
-- =========================================================

grant select, insert, update on _fixture_state to anon, authenticated, service_role;
grant select, insert on _test_results to anon, authenticated, service_role;
grant usage, select on sequence _test_results_seq_seq to anon, authenticated, service_role;

-- Seed a dedicated harness probe value, independent of section 2's
-- (shared product fixture data's) owner_a key. The original draft of
-- this self-test read 'owner_a' before section 2 had run, so
-- get_val('owner_a') always returned NULL and every self-test recorded
-- FAIL unconditionally -- a bug in the self-test itself, not in the
-- grants. harness_probe exists solely for this preliminary check.
-- PERFORM is a PL/pgSQL-only statement and is invalid at SQL top level,
-- so it is wrapped in its own minimal DO block here rather than issued
-- directly.
do $harness_seed$
begin
  perform pg_temp.set_val('harness_probe', 'READY');
end;
$harness_seed$;

-- Preliminary self-test: each switched role can read fixture state and
-- record a harness result through the helpers alone, with NO grant on
-- any product table (Sections B/C/D below independently and
-- exhaustively prove the exact real product-table privilege boundary
-- for each of these roles). If the harness grants are wrong, the
-- record_result call inside this block already aborts loudly on its
-- own (an uncaught permission-denied exception, since there is no
-- exception handler here) before ever reaching the explicit check
-- below. The explicit check catches the OTHER failure mode: the insert
-- succeeding (so a FAIL row gets recorded) but the read returning
-- something other than the seeded probe value -- a boolean FAIL row
-- alone is not "abort loudly", so this raises P0001 immediately in
-- that case too.
do $$
declare
  v_probe text;
begin
  perform pg_temp.act_as('anon');
  select pg_temp.get_val('harness_probe') into v_probe;
  perform pg_temp.record_result('HARNESS', 'H-ANON', 'anon can read fixture state and record a harness result via the temporary-object grants alone', v_probe = 'READY', format('read %L, expected %L', v_probe, 'READY'));
  if v_probe is distinct from 'READY' then
    perform pg_temp.act_as('postgres');
    raise exception using errcode = 'P0001', message = format('HARNESS_SELF_TEST_FAILED: anon read %L for harness_probe, expected ''READY''. Every later role-switched test in this file depends on the harness working -- stopping here.', v_probe);
  end if;
  perform pg_temp.act_as('postgres');

  perform pg_temp.act_as('authenticated');
  select pg_temp.get_val('harness_probe') into v_probe;
  perform pg_temp.record_result('HARNESS', 'H-AUTH', 'authenticated can read fixture state and record a harness result via the temporary-object grants alone', v_probe = 'READY', format('read %L, expected %L', v_probe, 'READY'));
  if v_probe is distinct from 'READY' then
    perform pg_temp.act_as('postgres');
    raise exception using errcode = 'P0001', message = format('HARNESS_SELF_TEST_FAILED: authenticated read %L for harness_probe, expected ''READY''. Every later role-switched test in this file depends on the harness working -- stopping here.', v_probe);
  end if;
  perform pg_temp.act_as('postgres');

  perform pg_temp.act_as('service_role');
  select pg_temp.get_val('harness_probe') into v_probe;
  perform pg_temp.record_result('HARNESS', 'H-SVC', 'service_role can read fixture state and record a harness result via the temporary-object grants alone', v_probe = 'READY', format('read %L, expected %L', v_probe, 'READY'));
  if v_probe is distinct from 'READY' then
    perform pg_temp.act_as('postgres');
    raise exception using errcode = 'P0001', message = format('HARNESS_SELF_TEST_FAILED: service_role read %L for harness_probe, expected ''READY''. Every later role-switched test in this file depends on the harness working -- stopping here.', v_probe);
  end if;
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
  v_task_a_no_project bigint;
  v_task_a_deleted bigint;
  v_task_b1 bigint;
  v_resource_a1 uuid;
begin
  perform pg_temp.act_as('postgres');

  insert into public.projects (user_id) values (v_owner_a) returning id into v_project_a1;
  insert into public.projects (user_id) values (v_owner_a) returning id into v_project_a2;
  insert into public.projects (user_id) values (v_owner_b) returning id into v_project_b1;

  insert into public.tasks (user_id, project_id) values (v_owner_a, v_project_a1) returning id into v_task_a1;
  insert into public.tasks (user_id, project_id) values (v_owner_a, v_project_a2) returning id into v_task_a2;
  insert into public.tasks (user_id, project_id) values (v_owner_a, null) returning id into v_task_a_no_project;
  insert into public.tasks (user_id, project_id, deleted_at) values (v_owner_a, v_project_a1, now()) returning id into v_task_a_deleted;
  insert into public.tasks (user_id, project_id) values (v_owner_b, v_project_b1) returning id into v_task_b1;

  insert into public.task_resources (user_id, project_id) values (v_owner_a, v_project_a1) returning id into v_resource_a1;

  perform pg_temp.set_val('owner_a', v_owner_a::text);
  perform pg_temp.set_val('owner_b', v_owner_b::text);
  perform pg_temp.set_val('project_a1', v_project_a1::text);
  perform pg_temp.set_val('project_a2', v_project_a2::text);
  perform pg_temp.set_val('project_b1', v_project_b1::text);
  perform pg_temp.set_val('task_a1', v_task_a1::text);
  perform pg_temp.set_val('task_a2', v_task_a2::text);
  perform pg_temp.set_val('task_a_no_project', v_task_a_no_project::text);
  perform pg_temp.set_val('task_a_deleted', v_task_a_deleted::text);
  perform pg_temp.set_val('task_b1', v_task_b1::text);
  perform pg_temp.set_val('resource_a1', v_resource_a1::text);
end;
$$;

-- =========================================================
-- SECTION A -- Migration objects
-- =========================================================

do $$
declare
  v_table_count int;
  v_rls_count int;
  v_function_count int;
  v_trigger_count int;
begin
  select count(*) into v_table_count
  from (values
    ('project_share_links'), ('share_link_tasks'), ('share_link_resources'),
    ('share_link_updates'), ('share_messages'), ('share_message_conversions'),
    ('share_browser_sessions'), ('share_session_grants'),
    ('share_link_events'), ('share_rate_limit_buckets')
  ) as t(tbl)
  where to_regclass('public.' || t.tbl) is not null;
  perform pg_temp.record_result('A', 'A1', 'all 10 Phase 1A tables exist', v_table_count = 10, format('found %s of 10', v_table_count));

  select count(*) into v_rls_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'project_share_links', 'share_link_tasks', 'share_link_resources',
      'share_link_updates', 'share_messages', 'share_message_conversions',
      'share_browser_sessions', 'share_session_grants',
      'share_link_events', 'share_rate_limit_buckets'
    )
    and c.relrowsecurity;
  perform pg_temp.record_result('A', 'A2', 'RLS enabled on all 10 tables', v_rls_count = 10, format('RLS enabled on %s of 10', v_rls_count));

  select count(*) into v_function_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'set_client_share_updated_at', 'enforce_project_share_link_integrity',
      'enforce_share_link_task_integrity', 'enforce_share_link_resource_integrity',
      'enforce_share_link_update_integrity', 'enforce_share_message_integrity',
      'enforce_share_message_conversion_integrity', 'enforce_share_browser_session_integrity',
      'enforce_share_session_grant_integrity'
    );
  perform pg_temp.record_result('A', 'A3', 'all 9 Phase 1A functions exist', v_function_count = 9, format('found %s of 9', v_function_count));

  select count(*) into v_trigger_count
  from pg_trigger tg
  join pg_class c on c.oid = tg.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not tg.tgisinternal
    and c.relname in (
      'project_share_links', 'share_link_tasks', 'share_link_resources',
      'share_link_updates', 'share_messages', 'share_message_conversions',
      'share_browser_sessions', 'share_session_grants', 'share_rate_limit_buckets'
    );
  perform pg_temp.record_result('A', 'A4', 'all 13 Phase 1A triggers exist', v_trigger_count = 13, format('found %s of 13', v_trigger_count));

  perform pg_temp.record_result(
    'A', 'A5', 'share_link_events has no updated_at trigger (append-only)',
    not exists (
      select 1 from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
      where c.relname = 'share_link_events' and not tg.tgisinternal
    ),
    null
  );
end;
$$;

-- =========================================================
-- SECTION B -- Anonymous role
-- =========================================================

do $$
begin
  perform pg_temp.act_as('anon');

  perform pg_temp.try_stmt('B', 'B1', 'anon cannot select project_share_links',
    'select 1 from public.project_share_links limit 1', false, null, '42501');
  perform pg_temp.try_stmt('B', 'B2', 'anon cannot insert project_share_links',
    format('insert into public.project_share_links (user_id, project_id, public_id) values (%L, %L, %L)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'anon-attempt-' || pg_temp.fake_hex64('anon1')),
    false, null, '42501');
  perform pg_temp.try_stmt('B', 'B3', 'anon cannot select share_browser_sessions (service-role-only)',
    'select 1 from public.share_browser_sessions limit 1', false, null, '42501');
  perform pg_temp.try_stmt('B', 'B4', 'anon cannot insert share_messages',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body) values (%L, gen_random_uuid(), %L, ''client'', ''hi'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1')),
    false, null, '42501');
  perform pg_temp.try_stmt('B', 'B5', 'anon cannot select share_rate_limit_buckets',
    'select 1 from public.share_rate_limit_buckets limit 1', false, null, '42501');

  perform pg_temp.record_result('B', 'B6', 'anon has no EXECUTE on enforce_project_share_link_integrity',
    not has_function_privilege('anon', 'public.enforce_project_share_link_integrity()', 'EXECUTE'), null);

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION C -- Authenticated role and RLS
-- =========================================================

do $$
declare
  v_select_policy_count int;
  v_write_policy_count int;
begin
  select count(*) into v_select_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'project_share_links', 'share_link_tasks', 'share_link_resources',
      'share_link_updates', 'share_messages', 'share_message_conversions'
    )
    and cmd = 'SELECT';
  perform pg_temp.record_result('C', 'C1', 'exactly six authenticated SELECT policies exist', v_select_policy_count = 6, format('found %s', v_select_policy_count));

  select count(*) into v_write_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'project_share_links', 'share_link_tasks', 'share_link_resources',
      'share_link_updates', 'share_messages', 'share_message_conversions'
    )
    and cmd in ('INSERT', 'UPDATE', 'DELETE');
  perform pg_temp.record_result('C', 'C2', 'no authenticated INSERT/UPDATE/DELETE policy exists', v_write_policy_count = 0, format('found %s', v_write_policy_count));

  perform pg_temp.record_result('C', 'C3', 'authenticated has SELECT on project_share_links',
    has_table_privilege('authenticated', 'public.project_share_links', 'SELECT'), null);
  perform pg_temp.record_result('C', 'C4', 'authenticated has no INSERT on project_share_links',
    not has_table_privilege('authenticated', 'public.project_share_links', 'INSERT'), null);
  perform pg_temp.record_result('C', 'C5', 'authenticated has no UPDATE on project_share_links',
    not has_table_privilege('authenticated', 'public.project_share_links', 'UPDATE'), null);
  perform pg_temp.record_result('C', 'C6', 'authenticated has no DELETE on project_share_links',
    not has_table_privilege('authenticated', 'public.project_share_links', 'DELETE'), null);
  perform pg_temp.record_result('C', 'C7', 'authenticated has no privilege on share_browser_sessions (service-only)',
    not (
      has_table_privilege('authenticated', 'public.share_browser_sessions', 'SELECT')
      or has_table_privilege('authenticated', 'public.share_browser_sessions', 'INSERT')
    ), null);
  perform pg_temp.record_result('C', 'C8', 'authenticated has no privilege on share_session_grants (service-only)',
    not (
      has_table_privilege('authenticated', 'public.share_session_grants', 'SELECT')
      or has_table_privilege('authenticated', 'public.share_session_grants', 'INSERT')
    ), null);
end;
$$;

-- One project_share_links row per owner, created as postgres (see file
-- header for why), then read back under each owner's RLS-scoped identity
-- to prove row-level isolation.
do $$
declare
  v_link_a uuid;
  v_link_b uuid;
begin
  perform pg_temp.act_as('postgres');

  insert into public.project_share_links (user_id, project_id, public_id, state, secret_digest, secret_digest_version, activated_at)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'rls-owner-a-link-0001', 'active', pg_temp.fake_hex64('rls-a'), 1, now())
  returning id into v_link_a;

  insert into public.project_share_links (user_id, project_id, public_id, state, secret_digest, secret_digest_version, activated_at)
  values (pg_temp.get_uuid('owner_b'), pg_temp.get_uuid('project_b1'), 'rls-owner-b-link-0001', 'active', pg_temp.fake_hex64('rls-b'), 1, now())
  returning id into v_link_b;

  perform pg_temp.set_val('link_a_rls', v_link_a::text);
  perform pg_temp.set_val('link_b_rls', v_link_b::text);

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.record_result('C', 'C9', 'owner A sees own row via RLS',
    exists (select 1 from public.project_share_links where id = v_link_a), null);
  perform pg_temp.record_result('C', 'C10', 'owner A cannot see owner B row via RLS',
    not exists (select 1 from public.project_share_links where id = v_link_b), null);

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.record_result('C', 'C11', 'owner B sees own row via RLS',
    exists (select 1 from public.project_share_links where id = v_link_b), null);
  perform pg_temp.record_result('C', 'C12', 'owner B cannot see owner A row via RLS',
    not exists (select 1 from public.project_share_links where id = v_link_a), null);

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION D -- Service-role privileges
-- =========================================================

do $$
begin
  perform pg_temp.record_result('D', 'D1', 'service_role has SELECT on project_share_links',
    has_table_privilege('service_role', 'public.project_share_links', 'SELECT'), null);
  perform pg_temp.record_result('D', 'D2', 'service_role can UPDATE view_count',
    has_column_privilege('service_role', 'public.project_share_links', 'view_count', 'UPDATE'), null);
  perform pg_temp.record_result('D', 'D3', 'service_role can UPDATE last_viewed_at',
    has_column_privilege('service_role', 'public.project_share_links', 'last_viewed_at', 'UPDATE'), null);
  perform pg_temp.record_result('D', 'D4', 'service_role cannot UPDATE state',
    not has_column_privilege('service_role', 'public.project_share_links', 'state', 'UPDATE'), null);
  perform pg_temp.record_result('D', 'D5', 'service_role cannot UPDATE user_id (ownership)',
    not has_column_privilege('service_role', 'public.project_share_links', 'user_id', 'UPDATE'), null);
  perform pg_temp.record_result('D', 'D6', 'service_role cannot UPDATE secret_digest',
    not has_column_privilege('service_role', 'public.project_share_links', 'secret_digest', 'UPDATE'), null);
  perform pg_temp.record_result('D', 'D7', 'service_role cannot UPDATE pin_hash',
    not has_column_privilege('service_role', 'public.project_share_links', 'pin_hash', 'UPDATE'), null);
  perform pg_temp.record_result('D', 'D8', 'service_role cannot UPDATE expires_at',
    not has_column_privilege('service_role', 'public.project_share_links', 'expires_at', 'UPDATE'), null);
  perform pg_temp.record_result('D', 'D9', 'service_role cannot UPDATE configuration_version',
    not has_column_privilege('service_role', 'public.project_share_links', 'configuration_version', 'UPDATE'), null);
  perform pg_temp.record_result('D', 'D10', 'service_role has no direct INSERT on project_share_links',
    not has_table_privilege('service_role', 'public.project_share_links', 'INSERT'), null);
  perform pg_temp.record_result('D', 'D11', 'service_role has no INSERT on share_link_tasks',
    not has_table_privilege('service_role', 'public.share_link_tasks', 'INSERT'), null);
  perform pg_temp.record_result('D', 'D12', 'service_role has no INSERT on share_link_resources',
    not has_table_privilege('service_role', 'public.share_link_resources', 'INSERT'), null);
  perform pg_temp.record_result('D', 'D13', 'service_role can INSERT share_messages body column',
    has_column_privilege('service_role', 'public.share_messages', 'body', 'INSERT'), null);
  perform pg_temp.record_result('D', 'D14', 'service_role cannot INSERT share_messages.status (owner-review lifecycle)',
    not has_column_privilege('service_role', 'public.share_messages', 'status', 'INSERT'), null);
  perform pg_temp.record_result('D', 'D15', 'service_role cannot INSERT share_messages.reviewed_at',
    not has_column_privilege('service_role', 'public.share_messages', 'reviewed_at', 'INSERT'), null);
  perform pg_temp.record_result('D', 'D16', 'service_role cannot INSERT share_messages.resolved_at',
    not has_column_privilege('service_role', 'public.share_messages', 'resolved_at', 'INSERT'), null);
  perform pg_temp.record_result('D', 'D17', 'service_role has full CRUD on share_browser_sessions',
    has_table_privilege('service_role', 'public.share_browser_sessions', 'SELECT')
    and has_table_privilege('service_role', 'public.share_browser_sessions', 'INSERT')
    and has_table_privilege('service_role', 'public.share_browser_sessions', 'UPDATE')
    and has_table_privilege('service_role', 'public.share_browser_sessions', 'DELETE'), null);
  perform pg_temp.record_result('D', 'D18', 'service_role has full CRUD on share_session_grants',
    has_table_privilege('service_role', 'public.share_session_grants', 'SELECT')
    and has_table_privilege('service_role', 'public.share_session_grants', 'INSERT')
    and has_table_privilege('service_role', 'public.share_session_grants', 'UPDATE')
    and has_table_privilege('service_role', 'public.share_session_grants', 'DELETE'), null);
  perform pg_temp.record_result('D', 'D19', 'service_role has SELECT/INSERT/DELETE (no UPDATE) on share_link_events',
    has_table_privilege('service_role', 'public.share_link_events', 'SELECT')
    and has_table_privilege('service_role', 'public.share_link_events', 'INSERT')
    and has_table_privilege('service_role', 'public.share_link_events', 'DELETE')
    and not has_table_privilege('service_role', 'public.share_link_events', 'UPDATE'), null);
  perform pg_temp.record_result('D', 'D20', 'service_role has full CRUD on share_rate_limit_buckets',
    has_table_privilege('service_role', 'public.share_rate_limit_buckets', 'SELECT')
    and has_table_privilege('service_role', 'public.share_rate_limit_buckets', 'INSERT')
    and has_table_privilege('service_role', 'public.share_rate_limit_buckets', 'UPDATE')
    and has_table_privilege('service_role', 'public.share_rate_limit_buckets', 'DELETE'), null);

  -- Real attempted statements, not just catalog checks.
  perform pg_temp.act_as('service_role');
  perform pg_temp.try_stmt('D', 'D21', 'service_role real UPDATE of state column is rejected at grant layer',
    format('update public.project_share_links set state = %L where id = %L', 'disabled', pg_temp.get_uuid('link_a_rls')),
    false, null, '42501');
  perform pg_temp.try_stmt('D', 'D22', 'service_role real UPDATE of view_count succeeds at grant+trigger layer',
    format('update public.project_share_links set view_count = view_count + 1 where id = %L', pg_temp.get_uuid('link_a_rls')),
    true);
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION E -- project_share_links integrity (as postgres; see header)
-- =========================================================

do $$
declare
  v_link_e1 uuid;
  v_link_lifecycle uuid;
  v_pub text := 'e-valid-link-' || substr(pg_temp.fake_hex64('e1'), 1, 20);
begin
  perform pg_temp.try_stmt('E', 'E1', 'valid owner/project link succeeds',
    format('insert into public.project_share_links (user_id, project_id, public_id) values (%L, %L, %L)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), v_pub),
    true);

  select id into v_link_e1 from public.project_share_links where public_id = v_pub;
  perform pg_temp.require_id('E', 'E1', 'project_share_links row for the main test link', v_link_e1::text);
  perform pg_temp.set_val('link_e1', v_link_e1::text);

  perform pg_temp.try_stmt('E', 'E2', 'cross-owner project rejected',
    format('insert into public.project_share_links (user_id, project_id, public_id) values (%L, %L, %L)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_b1'), 'e-cross-owner-' || substr(pg_temp.fake_hex64('e2'), 1, 15)),
    false, 'SHARE_LINK_PROJECT_NOT_OWNED', 'P0001');

  perform pg_temp.try_stmt('E', 'E3', 'nonexistent project rejected',
    format('insert into public.project_share_links (user_id, project_id, public_id) values (%L, gen_random_uuid(), %L)',
      pg_temp.get_uuid('owner_a'), 'e-noproj-' || substr(pg_temp.fake_hex64('e3'), 1, 15)),
    false, 'SHARE_LINK_PROJECT_NOT_FOUND', 'P0001');

  perform pg_temp.try_stmt('E', 'E4', 'a second link for the same project is structurally allowed',
    format('insert into public.project_share_links (user_id, project_id, public_id) values (%L, %L, %L)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'e-second-link-' || substr(pg_temp.fake_hex64('e4'), 1, 15)),
    true);

  perform pg_temp.try_stmt('E', 'E5', 'owner_id cannot be reassigned',
    format('update public.project_share_links set user_id = %L where id = %L', pg_temp.get_uuid('owner_b'), v_link_e1),
    false, 'SHARE_LINK_OWNER_MISMATCH', 'P0001');

  perform pg_temp.try_stmt('E', 'E6', 'project_id is immutable',
    format('update public.project_share_links set project_id = %L where id = %L', pg_temp.get_uuid('project_a2'), v_link_e1),
    false, 'SHARE_LINK_PROJECT_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('E', 'E7', 'public_id is immutable',
    format('update public.project_share_links set public_id = %L where id = %L', 'e-renamed', v_link_e1),
    false, 'SHARE_LINK_PUBLIC_ID_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('E', 'E8', 'configuration_version cannot decrease',
    format('update public.project_share_links set configuration_version = 0 where id = %L', v_link_e1),
    false, 'SHARE_LINK_CONFIGURATION_VERSION_DECREASE', 'P0001');

  -- The trigger's own view_count-decrease check fires before the
  -- view_count >= 0 CHECK constraint would ever be reached (BEFORE
  -- triggers run before constraints), so this is a P0001 trigger
  -- rejection, not a 23514 CHECK violation.
  perform pg_temp.try_stmt('E', 'E9', 'view_count cannot decrease',
    format($u$update public.project_share_links set view_count = -1 where id = %L$u$, v_link_e1),
    false, 'SHARE_LINK_VIEW_COUNT_DECREASE', 'P0001');

  -- Wrapped in a DO block: a bare EXECUTE only accepts one SQL command,
  -- so a two-statement test sequence must be one dynamic DO block, not
  -- two statements joined by ';' in a single EXECUTE string.
  perform pg_temp.try_stmt('E', 'E9b', 'view_count can only increase, never decrease from a positive value',
    format(
      'do $body$ begin update public.project_share_links set view_count = 5 where id = %L; update public.project_share_links set view_count = 2 where id = %L; end $body$;',
      v_link_e1, v_link_e1
    ),
    false, 'SHARE_LINK_VIEW_COUNT_DECREASE', 'P0001');

  -- Bumping configuration_version here (unlike the earlier draft of this
  -- test) lets the update clear the trigger's own version-bump gate and
  -- reach the REAL boundary under test: the secret_digest consistency
  -- CHECK constraint, since no secret was ever set for this link.
  perform pg_temp.try_stmt('E', 'E10', 'draft to active without a secret is rejected by the secret-digest consistency CHECK constraint',
    format('update public.project_share_links set state = ''active'', activated_at = now(), configuration_version = configuration_version + 1 where id = %L', v_link_e1),
    false, null, '23514');

  perform pg_temp.try_stmt('E', 'E11', 'draft to active WITH secret + version bump succeeds',
    format(
      'update public.project_share_links set state = ''active'', activated_at = now(), secret_digest = %L, secret_digest_version = 1, configuration_version = configuration_version + 1 where id = %L',
      pg_temp.fake_hex64('e11'), v_link_e1
    ),
    true);
  perform pg_temp.require_test_pass('E', 'E11', 'link_e1 activation (draft to active with secret)');

  perform pg_temp.try_stmt('E', 'E12', 'active cannot return to draft',
    format('update public.project_share_links set state = ''draft'' where id = %L', v_link_e1),
    false, 'SHARE_LINK_DRAFT_STATE_IRREVERSIBLE', 'P0001');

  -- E13-E17 deliberately drive a link all the way to 'revoked' (a
  -- terminal state). That must NOT be v_link_e1, which every later
  -- section (F onward) reuses as a stable, still-active link for task,
  -- resource, update and message mapping tests. A dedicated
  -- v_link_lifecycle link absorbs the state-transition sequence instead.
  perform pg_temp.try_stmt('E', 'E13pre', 'fixture setup: a dedicated link for the disable/re-enable/revoke sequence',
    format(
      'insert into public.project_share_links (user_id, project_id, public_id, state, secret_digest, secret_digest_version, activated_at) values (%L, %L, %L, ''active'', %L, 1, now())',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'e-lifecycle-' || substr(pg_temp.fake_hex64('elifecycle'), 1, 15), pg_temp.fake_hex64('elifecycle-secret')
    ),
    true);

  select id into v_link_lifecycle from public.project_share_links
  where public_id like 'e-lifecycle-%' order by created_at desc limit 1;
  perform pg_temp.require_id('E', 'E13pre', 'project_share_links row for the lifecycle-sequence link', v_link_lifecycle::text);

  -- Every state change is part of v_access_changed in the trigger, so
  -- every state-changing update below must also bump
  -- configuration_version, exactly like a real security/access change.
  perform pg_temp.try_stmt('E', 'E13', 'active to disabled is an allowed transition',
    format('update public.project_share_links set state = ''disabled'', disabled_at = now(), configuration_version = configuration_version + 1 where id = %L', v_link_lifecycle),
    true);
  perform pg_temp.require_test_pass('E', 'E13', 'lifecycle link disabled');

  perform pg_temp.try_stmt('E', 'E14', 'disabled to active is an allowed transition (re-enable)',
    format('update public.project_share_links set state = ''active'', configuration_version = configuration_version + 1 where id = %L', v_link_lifecycle),
    true);
  perform pg_temp.require_test_pass('E', 'E14', 'lifecycle link re-enabled');

  perform pg_temp.try_stmt('E', 'E15', 'active to revoked is an allowed transition',
    format('update public.project_share_links set state = ''revoked'', revoked_at = now(), configuration_version = configuration_version + 1 where id = %L', v_link_lifecycle),
    true);
  perform pg_temp.require_test_pass('E', 'E15', 'lifecycle link revoked (required for E16/E17 to test the terminal state correctly)');

  perform pg_temp.try_stmt('E', 'E16', 'revoked is terminal -- cannot move to any other state',
    format('update public.project_share_links set state = ''active'', configuration_version = configuration_version + 1 where id = %L', v_link_lifecycle),
    false, 'SHARE_LINK_REVOKED_STATE_TERMINAL', 'P0001');

  perform pg_temp.try_stmt('E', 'E17', 'revoked_at cannot be cleared once set',
    format('update public.project_share_links set revoked_at = null where id = %L', v_link_lifecycle),
    false, 'SHARE_LINK_REVOCATION_IRREVERSIBLE', 'P0001');

  -- PIN encoding profile v1: N=16384, r=8, p=1, key_length=32, hash length 43.
  -- From here on, link_e1 is PIN-protected for the rest of the script.
  perform pg_temp.try_stmt('E', 'E18', 'PIN v1 profile with correct parameters succeeds',
    format(
      'update public.project_share_links set pin_hash = %L, pin_salt = %L, pin_hash_version = 1, pin_scrypt_n = 16384, pin_scrypt_r = 8, pin_scrypt_p = 1, pin_key_length = 32, configuration_version = configuration_version + 1 where id = %L',
      pg_temp.fake_b64url(43), pg_temp.fake_b64url(32), v_link_e1
    ),
    true);

  -- STOP IMMEDIATELY if E18 did not PASS. Every test from here through
  -- the end of the file assumes link_e1 is PIN-protected (see the PIN
  -- NOTE in this file's header), so a silent failure here is exactly
  -- what produced Run 2's masked SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED
  -- at L1: link_e1.pin_hash was null because this step never actually
  -- persisted the PIN, and nothing before this correction pass checked.
  perform pg_temp.require_test_pass('E', 'E18', 'PIN setup for link_e1');

  -- Direct state verification, independent of try_stmt's own PASS/FAIL
  -- bookkeeping: prove the row itself now has exactly the intended PIN
  -- v1 profile, not just that some UPDATE somewhere returned success.
  if not exists (
    select 1 from public.project_share_links
    where id = v_link_e1
      and pin_hash is not null
      and char_length(pin_hash) = 43
      and pin_salt is not null
      and char_length(pin_salt) = 32
      and pin_hash_version = 1
      and pin_scrypt_n = 16384
      and pin_scrypt_r = 8
      and pin_scrypt_p = 1
      and pin_key_length = 32
  ) then
    raise exception using errcode = 'P0001', message = format(
      'PHASE1A_EXPECTED_STATE_MISSING: E/E18: link_e1 (id %s) does not have the exact expected PIN v1 profile (pin_hash 43 chars, pin_salt 32 chars, pin_hash_version 1, pin_scrypt_n 16384, pin_scrypt_r 8, pin_scrypt_p 1, pin_key_length 32) even though E18 was recorded as PASS. Actual PIN columns: %s',
      v_link_e1,
      (
        select row_to_json(pin_state)
        from (
          select pin_hash, pin_salt, pin_hash_version, pin_scrypt_n, pin_scrypt_r, pin_scrypt_p, pin_key_length
          from public.project_share_links
          where id = v_link_e1
        ) pin_state
      )
    );
  end if;

  perform pg_temp.try_stmt('E', 'E19', 'PIN with a non-profile N value is rejected',
    format(
      'update public.project_share_links set pin_hash = %L, pin_salt = %L, pin_hash_version = 1, pin_scrypt_n = 8192, pin_scrypt_r = 8, pin_scrypt_p = 1, pin_key_length = 32, configuration_version = configuration_version + 1 where id = %L',
      pg_temp.fake_b64url(43), pg_temp.fake_b64url(32), v_link_e1
    ),
    false, null, '23514');

  perform pg_temp.try_stmt('E', 'E20', 'PIN hash of the wrong length (not 43 chars) is rejected',
    format(
      'update public.project_share_links set pin_hash = %L, pin_salt = %L, pin_hash_version = 1, pin_scrypt_n = 16384, pin_scrypt_r = 8, pin_scrypt_p = 1, pin_key_length = 32, configuration_version = configuration_version + 1 where id = %L',
      pg_temp.fake_b64url(20), pg_temp.fake_b64url(32), v_link_e1
    ),
    false, null, '23514');

  perform pg_temp.try_stmt('E', 'E21', 'partial PIN fields (only pin_hash set) is rejected by the completeness CHECK',
    format($u$insert into public.project_share_links (user_id, project_id, public_id, pin_hash) values (%L, %L, %L, %L)$u$,
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'e-partial-pin-' || substr(pg_temp.fake_hex64('e21'), 1, 12), pg_temp.fake_b64url(43)),
    false, null, '23514');

  perform pg_temp.try_stmt('E', 'E22', 'client_facing_subtitle or content_direction change requires a version bump',
    format(
      'update public.project_share_links set client_facing_subtitle = %L where id = %L',
      'no version bump here', v_link_e1
    ),
    false, 'SHARE_LINK_VERSION_NOT_INCREMENTED', 'P0001');

  perform pg_temp.try_stmt('E', 'E23', 'client_facing_subtitle change WITH a version bump succeeds',
    format(
      'update public.project_share_links set client_facing_subtitle = %L, configuration_version = configuration_version + 1 where id = %L',
      'with a version bump', v_link_e1
    ),
    true);
  -- No later test reads client_facing_subtitle or depends on this exact
  -- configuration_version value, but the guard is added anyway for
  -- audit consistency and because a silent E23 failure would otherwise
  -- go unnoticed until some future addition to this file relies on it.
  perform pg_temp.require_test_pass('E', 'E23', 'link_e1 subtitle change with version bump');
end;
$$;

-- =========================================================
-- SECTION F -- share_link_tasks
-- =========================================================

do $$
begin
  perform pg_temp.try_stmt('F', 'F1', 'valid same-owner/same-project task mapping succeeds',
    format('insert into public.share_link_tasks (user_id, share_link_id, subtask_id, public_group) values (%L, %L, %L, ''in_progress'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_bigint('task_a1')),
    true);

  perform pg_temp.try_stmt('F', 'F2', 'cross-owner task id rejected',
    format('insert into public.share_link_tasks (user_id, share_link_id, subtask_id, public_group) values (%L, %L, %L, ''in_progress'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_bigint('task_b1')),
    false, 'SHARE_TASK_NOT_OWNED', 'P0001');

  perform pg_temp.try_stmt('F', 'F3', 'same-owner but cross-project task id rejected',
    format('insert into public.share_link_tasks (user_id, share_link_id, subtask_id, public_group) values (%L, %L, %L, ''in_progress'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_bigint('task_a2')),
    false, 'SHARE_TASK_PROJECT_MISMATCH', 'P0001');

  perform pg_temp.try_stmt('F', 'F4', 'task with null project_id cannot be shared',
    format('insert into public.share_link_tasks (user_id, share_link_id, subtask_id, public_group) values (%L, %L, %L, ''in_progress'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_bigint('task_a_no_project')),
    false, 'SHARE_TASK_WITHOUT_PROJECT', 'P0001');

  perform pg_temp.try_stmt('F', 'F5', 'soft-deleted task is rejected at mapping time',
    format('insert into public.share_link_tasks (user_id, share_link_id, subtask_id, public_group) values (%L, %L, %L, ''in_progress'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_bigint('task_a_deleted')),
    false, 'SHARE_TASK_DELETED', 'P0001');

  perform pg_temp.try_stmt('F', 'F6', 'nonexistent task id rejected',
    format('insert into public.share_link_tasks (user_id, share_link_id, subtask_id, public_group) values (%L, %L, 999999999, ''in_progress'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1')),
    false, 'SHARE_TASK_NOT_FOUND', 'P0001');

  perform pg_temp.try_stmt('F', 'F7', 'duplicate (share_link_id, subtask_id) mapping rejected',
    format('insert into public.share_link_tasks (user_id, share_link_id, subtask_id, public_group) values (%L, %L, %L, ''completed'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_bigint('task_a1')),
    false, null, '23505');
end;
$$;

-- =========================================================
-- SECTION G -- share_link_resources
-- =========================================================

do $$
declare
  v_task_resource uuid;
  v_resource_b1 uuid;
begin
  insert into public.task_resources (user_id, project_id, task_id)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), pg_temp.get_bigint('task_a1'))
  returning id into v_task_resource;
  perform pg_temp.set_val('resource_a_task', v_task_resource::text);

  perform pg_temp.try_stmt('G', 'G1', 'direct project-attached resource succeeds',
    format('insert into public.share_link_resources (user_id, share_link_id, resource_id, public_label) values (%L, %L, %L, ''Doc'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('resource_a1')),
    true);

  perform pg_temp.try_stmt('G', 'G2', 'task-attached resource in the same project succeeds',
    format('insert into public.share_link_resources (user_id, share_link_id, resource_id, public_label) values (%L, %L, %L, ''Doc 2'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), v_task_resource),
    true);

  -- A real resource owned by a different user (not a nonexistent id) --
  -- this is what makes it a genuine cross-owner test.
  insert into public.task_resources (user_id, project_id) values (pg_temp.get_uuid('owner_b'), pg_temp.get_uuid('project_b1'))
  returning id into v_resource_b1;

  perform pg_temp.try_stmt('G', 'G3', 'cross-owner resource rejected (a real resource owned by a different user)',
    format('insert into public.share_link_resources (user_id, share_link_id, resource_id, public_label) values (%L, %L, %L, ''Doc'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), v_resource_b1),
    false, 'SHARE_RESOURCE_NOT_OWNED', 'P0001');

  perform pg_temp.try_stmt('G', 'G3b', 'nonexistent resource id rejected',
    format('insert into public.share_link_resources (user_id, share_link_id, resource_id, public_label) values (%L, %L, gen_random_uuid(), ''Doc'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1')),
    false, 'SHARE_RESOURCE_NOT_FOUND', 'P0001');

  -- Fixture setup only (not a Client Share assertion): task_resources
  -- itself allows an orphan row with neither project_id nor task_id.
  -- G5 below is the real assertion -- that such a row cannot be shared.
  perform pg_temp.try_stmt('G', 'G4', 'fixture setup: create an orphan resource with no project_id and no task_id',
    format('insert into public.task_resources (user_id) values (%L)', pg_temp.get_uuid('owner_a')),
    true);
end;
$$;

do $$
declare
  v_orphan_resource uuid;
  v_resource_other_project uuid;
begin
  select id into v_orphan_resource from public.task_resources
  where user_id = pg_temp.get_uuid('owner_a') and project_id is null and task_id is null
  order by created_at desc limit 1;

  perform pg_temp.try_stmt('G', 'G5', 'resource attributable to no project (no project_id, no task_id) rejected',
    format('insert into public.share_link_resources (user_id, share_link_id, resource_id, public_label) values (%L, %L, %L, ''Doc'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), v_orphan_resource),
    false, 'SHARE_RESOURCE_RELATIONSHIP_INVALID', 'P0001');

  insert into public.task_resources (user_id, project_id) values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a2'))
  returning id into v_resource_other_project;

  perform pg_temp.try_stmt('G', 'G6', 'same-owner but cross-project resource rejected',
    format('insert into public.share_link_resources (user_id, share_link_id, resource_id, public_label) values (%L, %L, %L, ''Doc'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), v_resource_other_project),
    false, 'SHARE_RESOURCE_PROJECT_MISMATCH', 'P0001');

  perform pg_temp.try_stmt('G', 'G7', 'duplicate (share_link_id, resource_id) mapping rejected',
    format('insert into public.share_link_resources (user_id, share_link_id, resource_id, public_label) values (%L, %L, %L, ''Dup'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('resource_a1')),
    false, null, '23505');
end;
$$;

-- =========================================================
-- SECTION H -- share_link_updates
-- =========================================================

do $$
declare
  v_update_id uuid;
begin
  perform pg_temp.try_stmt('H', 'H1', 'valid publication succeeds',
    format('insert into public.share_link_updates (user_id, share_link_id, body, version, created_by, is_current) values (%L, %L, %L, 1, %L, true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), 'Project kicked off.', pg_temp.get_uuid('owner_a')),
    true);

  select id into v_update_id from public.share_link_updates
  where share_link_id = pg_temp.get_uuid('link_e1') and version = 1;
  perform pg_temp.require_id('H', 'H1', 'share_link_updates row for version 1', v_update_id::text);

  perform pg_temp.try_stmt('H', 'H2', 'wrong owner (user_id != link owner) rejected',
    format('insert into public.share_link_updates (user_id, share_link_id, body, version, created_by, is_current) values (%L, %L, %L, 2, %L, false)',
      pg_temp.get_uuid('owner_b'), pg_temp.get_uuid('link_e1'), 'x', pg_temp.get_uuid('owner_b')),
    false, 'SHARE_UPDATE_OWNER_MISMATCH', 'P0001');

  perform pg_temp.try_stmt('H', 'H3', 'wrong created_by (not equal to owner) rejected',
    format('insert into public.share_link_updates (user_id, share_link_id, body, version, created_by, is_current) values (%L, %L, %L, 2, %L, false)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), 'x', pg_temp.get_uuid('owner_b')),
    false, 'SHARE_UPDATE_CREATED_BY_MISMATCH', 'P0001');

  perform pg_temp.try_stmt('H', 'H4', 'published body is immutable',
    format('update public.share_link_updates set body = %L where id = %L', 'edited', v_update_id),
    false, 'SHARE_UPDATE_IMMUTABLE', 'P0001');

  -- The trigger checks share_link_id/user_id/body/version/published_at/
  -- created_by/created_at together as one combined condition, so every
  -- one of them fails with the SAME message as H4 above.
  perform pg_temp.try_stmt('H', 'H4b', 'published share_link_id is immutable',
    format('update public.share_link_updates set share_link_id = %L where id = %L', pg_temp.get_uuid('link_a_rls'), v_update_id),
    false, 'SHARE_UPDATE_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('H', 'H4c', 'published user_id is immutable',
    format('update public.share_link_updates set user_id = %L where id = %L', pg_temp.get_uuid('owner_b'), v_update_id),
    false, 'SHARE_UPDATE_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('H', 'H4d', 'published version is immutable',
    format('update public.share_link_updates set version = 99 where id = %L', v_update_id),
    false, 'SHARE_UPDATE_IMMUTABLE', 'P0001');

  -- now() is fixed for the whole transaction, so `= now()` here would
  -- write back the same value published_at already has (defaulted to
  -- now() at H1's insert) -- a true no-op the trigger's `is distinct
  -- from` check would not catch. Offsetting by an interval guarantees a
  -- provably distinct value.
  perform pg_temp.try_stmt('H', 'H4e', 'published_at is immutable',
    format('update public.share_link_updates set published_at = published_at + interval ''1 second'' where id = %L', v_update_id),
    false, 'SHARE_UPDATE_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('H', 'H4f', 'created_by is immutable',
    format('update public.share_link_updates set created_by = %L where id = %L', pg_temp.get_uuid('owner_b'), v_update_id),
    false, 'SHARE_UPDATE_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('H', 'H4g', 'created_at is immutable',
    format('update public.share_link_updates set created_at = created_at - interval ''1 second'' where id = %L', v_update_id),
    false, 'SHARE_UPDATE_IMMUTABLE', 'P0001');

  -- Correct publication order: retire the old current row FIRST, then
  -- insert the new current row. Doing it the other way around collides
  -- with share_link_updates_current_version_unique_idx, since that
  -- partial unique index permits only one is_current = true row per
  -- share_link_id at any instant.
  perform pg_temp.try_stmt('H', 'H5', 'publishing version 2: version 1 is retired first, then version 2 becomes current',
    format(
      'do $body$ begin update public.share_link_updates set is_current = false where id = %L; insert into public.share_link_updates (user_id, share_link_id, body, version, created_by, is_current) values (%L, %L, %L, 2, %L, true); end $body$;',
      v_update_id, pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), 'Second update.', pg_temp.get_uuid('owner_a')
    ),
    true);
  -- H6 depends on version 2 genuinely being current now; without this
  -- guard, an H5 failure would leave H6 testing an unrelated scenario.
  perform pg_temp.require_test_pass('H', 'H5', 'version 2 published and now current');

  perform pg_temp.try_stmt('H', 'H6', 'at most one current version per link -- making version 1 current again while version 2 is current is rejected',
    format(
      'update public.share_link_updates set is_current = true where id = %L',
      v_update_id
    ),
    false, null, '23505');
end;
$$;

-- =========================================================
-- SECTION I -- share_messages
-- =========================================================

do $$
declare
  v_client_msg uuid;
  v_hidden_msg uuid;
begin
  -- comments_enabled defaults to false; a client comment must be rejected
  -- until the owner opts in.
  perform pg_temp.act_as('service_role');
  perform pg_temp.try_stmt('I', 'I1', 'client comment rejected while comments_enabled = false',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client) values (%L, %L, %L, ''client'', ''hi'', true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    false, 'SHARE_MESSAGE_CLIENT_COMMENTS_DISABLED', 'P0001');
  perform pg_temp.act_as('postgres');

  update public.project_share_links
    set comments_enabled = true, configuration_version = configuration_version + 1
    where id = pg_temp.get_uuid('link_e1');

  perform pg_temp.act_as('service_role');
  perform pg_temp.try_stmt('I', 'I2', 'client comment succeeds once comments_enabled = true and link is active',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client) values (%L, %L, %L, ''client'', ''Looks great!'', true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    true);

  select id into v_client_msg from public.share_messages
  where share_link_id = pg_temp.get_uuid('link_e1') and author_type = 'client' order by created_at desc limit 1;
  perform pg_temp.require_id('I', 'I2', 'share_messages row for the client comment', v_client_msg::text);
  perform pg_temp.set_val('client_msg_1', v_client_msg::text);

  -- I3/I4/I4c: production boundary. service_role's real INSERT grant on
  -- share_messages (202608030005 section 9) is column-restricted and
  -- excludes status, reviewed_at and resolved_at entirely. Naming any of
  -- them therefore fails at the column-GRANT layer (42501) before the
  -- trigger's own defensive checks are ever reached -- these three tests
  -- prove that grant boundary, not the trigger.
  perform pg_temp.try_stmt('I', 'I3', 'service_role cannot INSERT an explicit status column (column-grant rejection, not a trigger rejection)',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, status, is_visible_to_client) values (%L, %L, %L, ''client'', ''x'', ''reviewed'', true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    false, null, '42501');

  perform pg_temp.try_stmt('I', 'I4', 'service_role cannot INSERT an explicit reviewed_at column (column-grant rejection, not a trigger rejection)',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, reviewed_at, is_visible_to_client) values (%L, %L, %L, ''client'', ''x'', now(), true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    false, null, '42501');

  perform pg_temp.try_stmt('I', 'I4c', 'service_role cannot INSERT an explicit resolved_at column (column-grant rejection, not a trigger rejection)',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, resolved_at, is_visible_to_client) values (%L, %L, %L, ''client'', ''x'', now(), true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    false, null, '42501');

  -- Now test the TRIGGER's own defensive checks for these same three
  -- columns, independent of the grant boundary above. The column grant is
  -- temporarily widened for service_role, inside this test transaction
  -- only -- the migration itself is never touched -- so the insert can
  -- reach the trigger body, and is then fully reverted and the reverted
  -- state is confirmed.
  perform pg_temp.act_as('postgres');
  grant insert (status, reviewed_at, resolved_at) on public.share_messages to service_role;

  perform pg_temp.act_as('service_role');
  perform pg_temp.try_stmt('I', 'I3trigger', 'with the column grant temporarily widened, the trigger itself still rejects an explicit client status',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, status, is_visible_to_client) values (%L, %L, %L, ''client'', ''x'', ''reviewed'', true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    false, 'SHARE_MESSAGE_CLIENT_STATUS_INVALID', 'P0001');

  perform pg_temp.try_stmt('I', 'I4trigger', 'with the column grant temporarily widened, the trigger itself still rejects an explicit client reviewed_at',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, reviewed_at, is_visible_to_client) values (%L, %L, %L, ''client'', ''x'', now(), true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    false, 'SHARE_MESSAGE_CLIENT_REVIEWED_AT_FORBIDDEN', 'P0001');

  perform pg_temp.try_stmt('I', 'I4ctrigger', 'with the column grant temporarily widened, the trigger itself still rejects an explicit client resolved_at',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, resolved_at, is_visible_to_client) values (%L, %L, %L, ''client'', ''x'', now(), true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    false, 'SHARE_MESSAGE_CLIENT_RESOLVED_AT_FORBIDDEN', 'P0001');

  perform pg_temp.act_as('postgres');
  revoke insert (status, reviewed_at, resolved_at) on public.share_messages from service_role;

  perform pg_temp.record_result('I', 'I4restore', 'the temporary column-grant widening was fully reverted -- service_role no longer has INSERT on status/reviewed_at/resolved_at',
    not (
      has_column_privilege('service_role', 'public.share_messages', 'status', 'INSERT')
      or has_column_privilege('service_role', 'public.share_messages', 'reviewed_at', 'INSERT')
      or has_column_privilege('service_role', 'public.share_messages', 'resolved_at', 'INSERT')
    ),
    null
  );

  perform pg_temp.act_as('service_role');
  perform pg_temp.try_stmt('I', 'I5', 'client message with is_visible_to_client = false is rejected',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client) values (%L, %L, %L, ''client'', ''x'', false)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    false, 'SHARE_MESSAGE_CLIENT_VISIBILITY_INVALID', 'P0001');

  perform pg_temp.try_stmt('I', 'I6', 'owner-authored message via service_role without matching auth.uid() rejected',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client) values (%L, %L, %L, ''owner'', ''reply'', true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    false, 'SHARE_MESSAGE_OWNER_AUTHOR_NOT_AUTHENTICATED', 'P0001');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_stmt('I', 'I7', 'authenticated cannot insert into share_messages directly (grant layer, no owner INSERT grant in Phase 1A)',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client) values (%L, %L, %L, ''owner'', ''reply'', true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    false, null, '42501');
  perform pg_temp.act_as('postgres');

  perform pg_temp.try_stmt('I', 'I8', 'immutable body cannot change after insert',
    format('update public.share_messages set body = %L where id = %L', 'edited', v_client_msg),
    false, 'SHARE_MESSAGE_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('I', 'I9', 'review lifecycle (status, reviewed_at) CAN change after insert',
    format('update public.share_messages set status = ''reviewed'', reviewed_at = now() where id = %L', v_client_msg),
    true);

  -- Real hidden-parent test: (1) create an owner-authored, hidden
  -- (is_visible_to_client = false) message as the actual parent, then
  -- (2) attempt a CLIENT reply against that hidden parent. The rejection
  -- must come from the parent-visibility rule, not from the unrelated
  -- owner-authentication rule I6/I7 already cover.
  perform pg_temp.act_as('postgres', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_stmt('I', 'I10setup', 'fixture setup: a hidden (is_visible_to_client = false) owner-authored message to act as a parent',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client) values (%L, %L, %L, ''owner'', ''internal note'', false)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    true);

  select id into v_hidden_msg from public.share_messages
  where share_link_id = pg_temp.get_uuid('link_e1') and author_type = 'owner' and is_visible_to_client = false
  order by created_at desc limit 1;
  perform pg_temp.require_id('I', 'I10setup', 'share_messages row for the hidden owner note', v_hidden_msg::text);
  perform pg_temp.set_val('hidden_msg_1', v_hidden_msg::text);

  perform pg_temp.act_as('service_role');
  perform pg_temp.try_stmt('I', 'I10', 'a client reply whose parent message is hidden from the client is rejected',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, parent_id, is_visible_to_client) values (%L, %L, %L, ''client'', ''trying to reply'', %L, true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1'), v_hidden_msg),
    false, 'SHARE_MESSAGE_CLIENT_PARENT_NOT_VISIBLE', 'P0001');

  perform pg_temp.act_as('postgres');
end;
$$;

-- I12/I13 (parent from a different share link; a correctly-authenticated
-- owner reply) are implemented as their own block immediately below,
-- since they need a second share link and a client-authored message on
-- it as fixtures.

do $$
declare
  v_other_link uuid;
  v_parent_on_other_link uuid;
begin
  insert into public.project_share_links (user_id, project_id, public_id)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'i-other-link-' || substr(pg_temp.fake_hex64('iother'), 1, 15))
  returning id into v_other_link;
  perform pg_temp.set_val('other_link', v_other_link::text);

  -- state and comments_enabled both changing is an access change, so this
  -- update must also bump configuration_version or the trigger rejects it
  -- with SHARE_LINK_VERSION_NOT_INCREMENTED. Wrapped in try_stmt with an
  -- expected-success assertion, so a future sequencing regression here
  -- becomes a named FAIL instead of silently aborting the rest of the
  -- script.
  perform pg_temp.try_stmt('I', 'I11setup', 'fixture setup: activating other_link (state + comments_enabled + secret, with a version bump) succeeds',
    format(
      'update public.project_share_links set comments_enabled = true, state = ''active'', secret_digest = %L, secret_digest_version = 1, activated_at = now(), configuration_version = configuration_version + 1 where id = %L',
      pg_temp.fake_hex64('iother-secret'), v_other_link
    ),
    true);
  perform pg_temp.require_test_pass('I', 'I11setup', 'other_link activation');

  perform pg_temp.act_as('service_role');
  insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client)
  values (pg_temp.get_uuid('owner_a'), v_other_link, pg_temp.get_uuid('project_a1'), 'client', 'on the other link', true)
  returning id into v_parent_on_other_link;

  perform pg_temp.try_stmt('I', 'I12', 'a reply whose parent belongs to a DIFFERENT share link is rejected',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, parent_id, is_visible_to_client) values (%L, %L, %L, ''client'', ''reply'', %L, true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1'), v_parent_on_other_link),
    false, 'SHARE_MESSAGE_PARENT_LINK_MISMATCH', 'P0001');

  -- Positive path: an owner-authored reply, correctly authenticated as
  -- that owner, succeeds. Run as the Postgres superuser with auth.uid()
  -- simulated to owner_a (see the note above SECTION J for why: no
  -- direct owner-facing INSERT grant exists yet on share_messages in
  -- Phase 1A, so this tests the trigger's own authentication rule
  -- without being defeated by the separate, intentional grant lockdown).
  perform pg_temp.act_as('postgres', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_stmt('I', 'I13', 'a correctly-authenticated owner reply succeeds',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, parent_id, is_visible_to_client) values (%L, %L, %L, ''owner'', ''Thanks for the note!'', %L, true)',
      pg_temp.get_uuid('owner_a'), v_other_link, pg_temp.get_uuid('project_a1'), v_parent_on_other_link),
    true);

  perform pg_temp.act_as('postgres');
end;
$$;

-- I14-I16: high-risk client-message rejection paths, each on its OWN
-- dedicated link (and, for I16, its own project) so link_e1 and
-- other_link are never disabled, expired or attached to a deleted
-- project. Every client-authored insert runs as service_role; every
-- setup state/access change bumps configuration_version in the same
-- statement.
do $$
declare
  v_disabled_link uuid;
  v_expired_link uuid;
  v_deleted_project uuid;
  v_deleted_project_link uuid;
begin
  perform pg_temp.act_as('postgres');

  insert into public.project_share_links (user_id, project_id, public_id)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'i-disabled-link-' || substr(pg_temp.fake_hex64('idisabled'), 1, 15))
  returning id into v_disabled_link;

  perform pg_temp.try_stmt('I', 'I14setup', 'fixture setup: activate then disable a dedicated link (each state change bumps configuration_version)',
    format(
      'do $body$ begin update public.project_share_links set state = ''active'', secret_digest = %L, secret_digest_version = 1, activated_at = now(), comments_enabled = true, configuration_version = configuration_version + 1 where id = %L; update public.project_share_links set state = ''disabled'', disabled_at = now(), configuration_version = configuration_version + 1 where id = %L; end $body$;',
      pg_temp.fake_hex64('idisabled-secret'), v_disabled_link, v_disabled_link
    ),
    true);
  perform pg_temp.require_test_pass('I', 'I14setup', 'dedicated disabled-link fixture');

  perform pg_temp.act_as('service_role');
  perform pg_temp.try_stmt('I', 'I14', 'a client comment on a DISABLED link is rejected',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client) values (%L, %L, %L, ''client'', ''hi'', true)',
      pg_temp.get_uuid('owner_a'), v_disabled_link, pg_temp.get_uuid('project_a1')),
    false, 'SHARE_MESSAGE_CLIENT_LINK_NOT_ACTIVE', 'P0001');
  perform pg_temp.act_as('postgres');

  -- Deterministically already-expired link. The whole script runs in one
  -- transaction, so now() is fixed throughout -- `created_at + interval
  -- '1 second'` never actually elapses and does NOT create an expired
  -- object. Backdating created_at lets expires_at be genuinely earlier
  -- than the transaction's fixed now() while still satisfying
  -- project_share_links_timestamp_order_check (activated_at/expires_at
  -- >= / > created_at).
  insert into public.project_share_links (user_id, project_id, public_id, created_at, updated_at)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'i-expired-link-' || substr(pg_temp.fake_hex64('iexpired'), 1, 15), now() - interval '2 days', now() - interval '2 days')
  returning id into v_expired_link;

  perform pg_temp.try_stmt('I', 'I15setup', 'fixture setup: activate a dedicated link that is already expired by timestamp (backdated created_at, activated_at and expires_at)',
    format(
      'update public.project_share_links set state = ''active'', secret_digest = %L, secret_digest_version = 1, activated_at = now() - interval ''36 hours'', expires_at = now() - interval ''1 day'', comments_enabled = true, configuration_version = configuration_version + 1 where id = %L',
      pg_temp.fake_hex64('iexpired-secret'), v_expired_link
    ),
    true);
  perform pg_temp.require_test_pass('I', 'I15setup', 'dedicated already-expired-link fixture');

  perform pg_temp.act_as('service_role');
  perform pg_temp.try_stmt('I', 'I15', 'a client comment on an EXPIRED (by timestamp) link is rejected',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client) values (%L, %L, %L, ''client'', ''hi'', true)',
      pg_temp.get_uuid('owner_a'), v_expired_link, pg_temp.get_uuid('project_a1')),
    false, 'SHARE_MESSAGE_CLIENT_LINK_EXPIRED', 'P0001');
  perform pg_temp.act_as('postgres');

  -- Soft-deleted linked project: a fresh, otherwise-unused project so
  -- project_a1 (used throughout every other section) is never touched.
  insert into public.projects (user_id) values (pg_temp.get_uuid('owner_a')) returning id into v_deleted_project;

  insert into public.project_share_links (user_id, project_id, public_id)
  values (pg_temp.get_uuid('owner_a'), v_deleted_project, 'i-deleted-project-link-' || substr(pg_temp.fake_hex64('ideletedproj'), 1, 10))
  returning id into v_deleted_project_link;

  perform pg_temp.try_stmt('I', 'I16setup', 'fixture setup: activate a link, then soft-delete its own dedicated project',
    format(
      'do $body$ begin update public.project_share_links set state = ''active'', secret_digest = %L, secret_digest_version = 1, activated_at = now(), comments_enabled = true, configuration_version = configuration_version + 1 where id = %L; update public.projects set deleted_at = now() where id = %L; end $body$;',
      pg_temp.fake_hex64('ideletedproj-secret'), v_deleted_project_link, v_deleted_project
    ),
    true);
  perform pg_temp.require_test_pass('I', 'I16setup', 'dedicated link with soft-deleted project fixture');

  perform pg_temp.act_as('service_role');
  perform pg_temp.try_stmt('I', 'I16', 'a client comment on a link whose linked project is soft-deleted is rejected',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client) values (%L, %L, %L, ''client'', ''hi'', true)',
      pg_temp.get_uuid('owner_a'), v_deleted_project_link, v_deleted_project),
    false, 'SHARE_MESSAGE_CLIENT_PROJECT_DELETED', 'P0001');
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION J -- share_message_conversions
-- =========================================================

-- NOTE ON ROLE: share_message_conversions grants only SELECT to
-- authenticated in Phase 1A (202608030005 section 9) -- there is no
-- direct owner-facing INSERT grant yet, matching every other owner-facing
-- table. These tests therefore run as the Postgres superuser (see this
-- file's header), but still simulate auth.uid() = the acting owner via
-- act_as('postgres', <uuid>), because
-- enforce_share_message_conversion_integrity() itself checks
-- `auth.uid() is distinct from new.converted_by` regardless of caller
-- role. This tests the trigger's authentication requirement faithfully
-- without being defeated by the (correct, intentional) grant-layer
-- lockdown that a real 'authenticated' insert would hit first.

do $$
declare
  v_update_id uuid;
begin
  perform pg_temp.act_as('postgres', pg_temp.get_uuid('owner_a'));
  insert into public.project_updates (user_id, project_id) values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'))
  returning id into v_update_id;
  perform pg_temp.set_val('project_update_1', v_update_id::text);

  perform pg_temp.try_stmt('J', 'J1', 'valid conversion from a client-authored message succeeds (as the authenticated owner)',
    format('insert into public.share_message_conversions (user_id, message_id, project_update_id, converted_by) values (%L, %L, %L, %L)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('client_msg_1'), v_update_id, pg_temp.get_uuid('owner_a')),
    true);

  perform pg_temp.try_stmt('J', 'J2', 'duplicate conversion for the same message is rejected',
    format('insert into public.share_message_conversions (user_id, message_id, converted_by) values (%L, %L, %L)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('client_msg_1'), pg_temp.get_uuid('owner_a')),
    false, null, '23505');

  perform pg_temp.act_as('postgres', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_stmt('J', 'J3', 'converting another owner''s message is rejected',
    format('insert into public.share_message_conversions (user_id, message_id, converted_by) values (%L, %L, %L)',
      pg_temp.get_uuid('owner_b'), pg_temp.get_uuid('client_msg_1'), pg_temp.get_uuid('owner_b')),
    false, 'SHARE_CONVERSION_OWNER_MISMATCH', 'P0001');

  perform pg_temp.act_as('postgres');
end;
$$;

do $$
declare
  v_client_msg_2 uuid;
  v_cross_owner_update uuid;
begin
  perform pg_temp.act_as('service_role');
  insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('other_link'), pg_temp.get_uuid('project_a1'), 'client', 'second message', true)
  returning id into v_client_msg_2;
  perform pg_temp.set_val('client_msg_2', v_client_msg_2::text);

  perform pg_temp.act_as('postgres', pg_temp.get_uuid('owner_b'));
  insert into public.project_updates (user_id, project_id) values (pg_temp.get_uuid('owner_b'), pg_temp.get_uuid('project_b1'))
  returning id into v_cross_owner_update;

  perform pg_temp.act_as('postgres', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_stmt('J', 'J4', 'conversion referencing another owner''s project_update rejected',
    format('insert into public.share_message_conversions (user_id, message_id, project_update_id, converted_by) values (%L, %L, %L, %L)',
      pg_temp.get_uuid('owner_a'), v_client_msg_2, v_cross_owner_update, pg_temp.get_uuid('owner_a')),
    false, 'SHARE_CONVERSION_UPDATE_NOT_OWNED', 'P0001');

  perform pg_temp.try_stmt('J', 'J5', 'conversion referencing another owner''s task rejected',
    format('insert into public.share_message_conversions (user_id, message_id, target_task_id, converted_by) values (%L, %L, %L, %L)',
      pg_temp.get_uuid('owner_a'), v_client_msg_2, pg_temp.get_bigint('task_b1'), pg_temp.get_uuid('owner_a')),
    false, 'SHARE_CONVERSION_TASK_NOT_OWNED', 'P0001');

  -- J6 is a state assertion (did a row appear or not), not an executable
  -- SQL statement to attempt -- it must use record_result, not try_stmt.
  -- try_stmt's p_sql parameter is text; passing a boolean expression to
  -- it is a type error that would abort this entire block at parse time.
  perform pg_temp.record_result('J', 'J6', 'inserting a message never automatically creates a conversion row',
    not exists (
      select 1 from public.share_message_conversions where message_id = v_client_msg_2
    ),
    null
  );

  perform pg_temp.act_as('postgres');
end;
$$;

do $$
declare
  v_update_id uuid := pg_temp.get_uuid('project_update_1');
  v_conversion_id uuid;
begin
  select id into v_conversion_id from public.share_message_conversions where message_id = pg_temp.get_uuid('client_msg_1');

  delete from public.project_updates where id = v_update_id;

  perform pg_temp.record_result('J', 'J7', 'deleting the referenced project_update SETs NULL on the conversion, row survives',
    exists (
      select 1 from public.share_message_conversions
      where id = v_conversion_id and project_update_id is null
    ),
    null
  );
end;
$$;

do $$
declare
  v_owner_authored_msg uuid;
begin
  perform pg_temp.act_as('postgres', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_stmt('J', 'J8setup', 'fixture setup: an owner-authored message to attempt (and fail) converting',
    format('insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client) values (%L, %L, %L, ''owner'', ''owner note, not client feedback'', true)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('project_a1')),
    true);

  select id into v_owner_authored_msg from public.share_messages
  where share_link_id = pg_temp.get_uuid('link_e1') and author_type = 'owner' and body = 'owner note, not client feedback'
  order by created_at desc limit 1;
  perform pg_temp.require_id('J', 'J8setup', 'share_messages row for the owner-authored message', v_owner_authored_msg::text);

  perform pg_temp.try_stmt('J', 'J8', 'an owner-authored message cannot be converted -- conversions require a client-authored source',
    format('insert into public.share_message_conversions (user_id, message_id, converted_by) values (%L, %L, %L)',
      pg_temp.get_uuid('owner_a'), v_owner_authored_msg, pg_temp.get_uuid('owner_a')),
    false, 'SHARE_CONVERSION_MESSAGE_NOT_CLIENT_AUTHORED', 'P0001');

  perform pg_temp.act_as('postgres');
end;
$$;

do $$
declare
  v_task_for_conversion bigint;
  v_conversion2_id uuid;
begin
  perform pg_temp.act_as('postgres');
  insert into public.tasks (user_id, project_id) values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'))
  returning id into v_task_for_conversion;

  perform pg_temp.act_as('postgres', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_stmt('J', 'J9', 'a valid conversion referencing target_task_id succeeds',
    format('insert into public.share_message_conversions (user_id, message_id, target_task_id, converted_by) values (%L, %L, %L, %L)',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('client_msg_2'), v_task_for_conversion, pg_temp.get_uuid('owner_a')),
    true);

  select id into v_conversion2_id from public.share_message_conversions where message_id = pg_temp.get_uuid('client_msg_2');
  perform pg_temp.require_id('J', 'J9', 'share_message_conversions row for client_msg_2', v_conversion2_id::text);

  perform pg_temp.act_as('postgres');
  delete from public.tasks where id = v_task_for_conversion;

  perform pg_temp.record_result('J', 'J10', 'deleting the referenced task SETs NULL on the conversion''s target_task_id, row survives',
    exists (
      select 1 from public.share_message_conversions
      where id = v_conversion2_id and target_task_id is null
    ),
    null
  );
end;
$$;

-- =========================================================
-- SECTION K -- share_browser_sessions
-- =========================================================

do $$
declare
  v_session_id uuid;
begin
  perform pg_temp.act_as('service_role');

  perform pg_temp.try_stmt('K', 'K1', 'valid browser session succeeds',
    format('insert into public.share_browser_sessions (session_digest, digest_version, expires_at) values (%L, 1, now() + interval ''30 days'')',
      pg_temp.fake_hex64('session-1')),
    true);

  select id into v_session_id from public.share_browser_sessions where session_digest = pg_temp.fake_hex64('session-1');
  perform pg_temp.require_id('K', 'K1', 'share_browser_sessions row for session-1', v_session_id::text);
  perform pg_temp.set_val('session_1', v_session_id::text);

  perform pg_temp.try_stmt('K', 'K2', 'duplicate session_digest rejected (unique constraint)',
    format('insert into public.share_browser_sessions (session_digest, digest_version, expires_at) values (%L, 1, now() + interval ''30 days'')',
      pg_temp.fake_hex64('session-1')),
    false, null, '23505');

  perform pg_temp.try_stmt('K', 'K3', 'session_digest is immutable',
    format('update public.share_browser_sessions set session_digest = %L where id = %L', pg_temp.fake_hex64('session-1-changed'), v_session_id),
    false, 'SHARE_SESSION_DIGEST_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('K', 'K4', 'last_seen_at may advance',
    format('update public.share_browser_sessions set last_seen_at = now() + interval ''1 minute'' where id = %L', v_session_id),
    true);
  perform pg_temp.require_test_pass('K', 'K4', 'session_1 last_seen_at advanced');

  perform pg_temp.try_stmt('K', 'K5', 'last_seen_at cannot move backwards',
    format('update public.share_browser_sessions set last_seen_at = now() - interval ''1 hour'' where id = %L', v_session_id),
    false, 'SHARE_SESSION_LAST_SEEN_AT_DECREASE', 'P0001');

  perform pg_temp.try_stmt('K', 'K6', 'revocation is monotonic -- once revoked, cannot be un-revoked',
    format(
      'do $body$ begin update public.share_browser_sessions set revoked_at = now() where id = %L; update public.share_browser_sessions set revoked_at = null where id = %L; end $body$;',
      v_session_id, v_session_id
    ),
    false, 'SHARE_SESSION_REVOCATION_IRREVERSIBLE', 'P0001');

  perform pg_temp.act_as('postgres');
end;
$$;

-- K7-K13: further lifecycle coverage, on a DEDICATED session so
-- session_1 (v_session_id above) stays live and unrevoked for the
-- valid-grant tests in Section L.
do $$
declare
  v_session_lifecycle uuid;
begin
  perform pg_temp.act_as('service_role');

  perform pg_temp.try_stmt('K', 'K7', 'a session_digest that is not 64 lowercase hex characters is rejected by the format CHECK constraint',
    'insert into public.share_browser_sessions (session_digest, digest_version, expires_at) values (''not-a-valid-hex-digest'', 1, now() + interval ''30 days'')',
    false, null, '23514');

  perform pg_temp.try_stmt('K', 'K8setup', 'fixture setup: a dedicated session for the remaining immutability tests',
    format('insert into public.share_browser_sessions (session_digest, digest_version, expires_at) values (%L, 1, now() + interval ''30 days'')',
      pg_temp.fake_hex64('session-lifecycle')),
    true);

  select id into v_session_lifecycle from public.share_browser_sessions
  where session_digest = pg_temp.fake_hex64('session-lifecycle');
  perform pg_temp.require_id('K', 'K8setup', 'share_browser_sessions row for session-lifecycle', v_session_lifecycle::text);

  perform pg_temp.try_stmt('K', 'K8', 'digest_version is immutable',
    format('update public.share_browser_sessions set digest_version = 2 where id = %L', v_session_lifecycle),
    false, 'SHARE_SESSION_DIGEST_VERSION_IMMUTABLE', 'P0001');

  -- now() is fixed for the whole transaction, so `= now()` would write
  -- back the same value created_at already has -- a no-op the trigger's
  -- `is distinct from` check would not catch. Offsetting guarantees a
  -- provably distinct value.
  perform pg_temp.try_stmt('K', 'K9', 'created_at is immutable',
    format('update public.share_browser_sessions set created_at = created_at - interval ''1 second'' where id = %L', v_session_lifecycle),
    false, 'SHARE_SESSION_CREATED_AT_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('K', 'K10', 'expires_at is immutable',
    format('update public.share_browser_sessions set expires_at = now() + interval ''60 days'' where id = %L', v_session_lifecycle),
    false, 'SHARE_SESSION_EXPIRY_IMMUTABLE', 'P0001');

  -- Clearing last_seen_at (setting it to null) hits the SAME trigger
  -- check, and therefore the same message, as moving it backwards --
  -- the condition is `new.last_seen_at is null or new.last_seen_at <
  -- old.last_seen_at`.
  perform pg_temp.try_stmt('K', 'K11', 'last_seen_at cannot be cleared to null',
    format('update public.share_browser_sessions set last_seen_at = null where id = %L', v_session_lifecycle),
    false, 'SHARE_SESSION_LAST_SEEN_AT_DECREASE', 'P0001');

  -- Revoke, then attempt to move revoked_at further back than the
  -- original revocation timestamp (a distinct scenario from K6's
  -- "clear it back to null" case, but the SAME underlying trigger check
  -- and therefore the same message: SHARE_SESSION_REVOCATION_IRREVERSIBLE.
  -- There is no separate "SHARE_SESSION_REVOCATION_IMMUTABLE" message
  -- anywhere in 202608030005_client_share_integrity_and_security.sql;
  -- using the real message here rather than inventing one.
  perform pg_temp.try_stmt('K', 'K12', 'revoking a dedicated session succeeds',
    format('update public.share_browser_sessions set revoked_at = now() where id = %L', v_session_lifecycle),
    true);
  -- K13 specifically requires revoked_at to already be non-null: if K12
  -- had failed, K13's attempt would be the FIRST revocation rather than
  -- a backward move, and would unexpectedly succeed instead of testing
  -- irreversibility.
  perform pg_temp.require_test_pass('K', 'K12', 'session-lifecycle revoked');

  perform pg_temp.try_stmt('K', 'K13', 'revoked_at cannot move further backwards than the original revocation timestamp',
    format('update public.share_browser_sessions set revoked_at = (select revoked_at from public.share_browser_sessions where id = %L) - interval ''1 hour'' where id = %L', v_session_lifecycle, v_session_lifecycle),
    false, 'SHARE_SESSION_REVOCATION_IRREVERSIBLE', 'P0001');

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION L -- share_session_grants
-- =========================================================

do $$
declare
  v_session_2 uuid;
  v_grant_1 uuid;
  v_grant_2 uuid;
begin
  perform pg_temp.act_as('service_role');

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (pg_temp.fake_hex64('session-2'), 1, now() + interval '30 days')
  returning id into v_session_2;
  perform pg_temp.set_val('session_2', v_session_2::text);

  -- link_e1 is PIN-protected since E18, so every VALID grant for it from
  -- here on supplies pin_verified_at.
  perform pg_temp.try_stmt('L', 'L1', 'valid grant for a live session and active, PIN-protected link at the exact current version succeeds',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, pin_verified_at, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now(), now() + interval ''1 day'')',
      pg_temp.get_uuid('session_1'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('link_e1')),
    true);

  select id into v_grant_1 from public.share_session_grants
  where browser_session_id = pg_temp.get_uuid('session_1') and share_link_id = pg_temp.get_uuid('link_e1');
  perform pg_temp.require_id('L', 'L1', 'share_session_grants row for session_1/link_e1', v_grant_1::text);
  perform pg_temp.set_val('grant_1_id', v_grant_1::text);

  perform pg_temp.try_stmt('L', 'L1b', 'a grant for the PIN-protected link_e1 WITHOUT pin_verified_at is rejected',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now() + interval ''1 day'')',
      pg_temp.get_uuid('session_2'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('link_e1')),
    false, 'SHARE_GRANT_PIN_VERIFICATION_REQUIRED', 'P0001');

  perform pg_temp.try_stmt('L', 'L2', 'stale configuration_version is rejected',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, 1, now() + interval ''1 day'')',
      pg_temp.get_uuid('session_2'), pg_temp.get_uuid('link_e1')),
    false, 'SHARE_GRANT_CONFIGURATION_VERSION_STALE', 'P0001');

  perform pg_temp.try_stmt('L', 'L3', 'grant expiry exceeding the browser session''s own expiry is rejected',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now() + interval ''90 days'')',
      pg_temp.get_uuid('session_2'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('link_e1')),
    false, 'SHARE_GRANT_EXPIRY_EXCEEDS_SESSION', 'P0001');

  perform pg_temp.try_stmt('L', 'L4', 'one browser session can hold a grant for a SECOND, independent, non-PIN link',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now() + interval ''1 day'')',
      pg_temp.get_uuid('session_1'), pg_temp.get_uuid('other_link'), pg_temp.get_uuid('other_link')),
    true);

  select id into v_grant_2 from public.share_session_grants
  where browser_session_id = pg_temp.get_uuid('session_1') and share_link_id = pg_temp.get_uuid('other_link');
  perform pg_temp.require_id('L', 'L4', 'share_session_grants row for session_1/other_link', v_grant_2::text);
  perform pg_temp.set_val('grant_2', v_grant_2::text);

  perform pg_temp.try_stmt('L', 'L4b', 'a grant for the non-PIN other_link WITH an unexpected pin_verified_at is rejected',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, pin_verified_at, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now(), now() + interval ''1 day'')',
      pg_temp.get_uuid('session_2'), pg_temp.get_uuid('other_link'), pg_temp.get_uuid('other_link')),
    false, 'SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED', 'P0001');

  perform pg_temp.try_stmt('L', 'L5', 'grant identity fields are immutable',
    format('update public.share_session_grants set granted_configuration_version = 999 where id = %L', v_grant_1),
    false, 'SHARE_GRANT_CONFIGURATION_VERSION_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('L', 'L6', 'revoking grant 1 succeeds',
    format('update public.share_session_grants set revoked_at = now() where id = %L', v_grant_1),
    true);
  -- L8 and L9 both assume grant_1 is genuinely revoked now.
  perform pg_temp.require_test_pass('L', 'L6', 'grant_1 revoked');

  perform pg_temp.record_result('L', 'L7', 'revoking one link''s grant leaves the OTHER grant in the same session untouched',
    exists (select 1 from public.share_session_grants where id = v_grant_2 and revoked_at is null),
    null
  );

  perform pg_temp.try_stmt('L', 'L8', 'a revoked grant cannot be un-revoked',
    format('update public.share_session_grants set revoked_at = null where id = %L', v_grant_1),
    false, 'SHARE_GRANT_REVOCATION_IRREVERSIBLE', 'P0001');

  perform pg_temp.try_stmt('L', 'L9', 'a replacement current grant for the PIN-protected link_e1 can be inserted after the previous one is revoked',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, pin_verified_at, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now(), now() + interval ''1 day'')',
      pg_temp.get_uuid('session_1'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('link_e1')),
    true);
  -- L10 assumes L9's replacement grant genuinely exists and is current.
  perform pg_temp.require_test_pass('L', 'L9', 'replacement current grant inserted for session_1/link_e1');

  perform pg_temp.try_stmt('L', 'L10', 'a second CURRENT (non-revoked) grant for the same session/link pair is rejected by the partial unique index',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, pin_verified_at, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now(), now() + interval ''1 day'')',
      pg_temp.get_uuid('session_1'), pg_temp.get_uuid('link_e1'), pg_temp.get_uuid('link_e1')),
    false, null, '23505');

  perform pg_temp.act_as('postgres');
end;
$$;

-- L11-L18: remaining grant-rejection boundaries, each on its OWN
-- dedicated session/link/project so session_1, session_2, link_e1 and
-- other_link are never revoked, expired, disabled or attached to a
-- deleted project by this block.
--
-- ROLE DISCIPLINE: service_role has no INSERT on public.project_share_links
-- or public.projects (proved directly in Section D, D10-D12). Every
-- direct INSERT into either table below runs as postgres; service_role
-- is used only for the service-owned share_browser_sessions/
-- share_session_grants rows and for the one statement under test in
-- each pair (the grant attempt itself).
do $$
declare
  v_session_revoked uuid;
  v_session_expired uuid;
  v_link_disabled_g uuid;
  v_link_expired_g uuid;
  v_link_revoked_g uuid;
  v_project_deleted_g uuid;
  v_link_deleted_project_g uuid;
  v_link_short_expiry_g uuid;
begin
  perform pg_temp.act_as('service_role');

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (pg_temp.fake_hex64('l-session-revoked'), 1, now() + interval '30 days')
  returning id into v_session_revoked;
  update public.share_browser_sessions set revoked_at = now() where id = v_session_revoked;

  perform pg_temp.try_stmt('L', 'L11', 'a grant against a revoked browser session is rejected',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now() + interval ''1 day'')',
      v_session_revoked, pg_temp.get_uuid('other_link'), pg_temp.get_uuid('other_link')),
    false, 'SHARE_GRANT_SESSION_REVOKED', 'P0001');

  -- Deterministically already-expired session: the whole script runs in
  -- one transaction, so now() is fixed throughout -- `now() + interval
  -- '1 second'` never actually elapses. Backdating created_at/
  -- last_seen_at/expires_at makes expires_at genuinely earlier than the
  -- transaction's fixed now() while still satisfying
  -- share_browser_sessions_lifecycle_check (expires_at > created_at,
  -- last_seen_at >= created_at).
  insert into public.share_browser_sessions (session_digest, digest_version, created_at, last_seen_at, expires_at)
  values (pg_temp.fake_hex64('l-session-expired'), 1, now() - interval '2 days', now() - interval '2 days', now() - interval '1 day')
  returning id into v_session_expired;

  perform pg_temp.try_stmt('L', 'L12', 'a grant against an expired browser session is rejected',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now() + interval ''1 day'')',
      v_session_expired, pg_temp.get_uuid('other_link'), pg_temp.get_uuid('other_link')),
    false, 'SHARE_GRANT_SESSION_EXPIRED', 'P0001');

  perform pg_temp.act_as('postgres');
  insert into public.project_share_links (user_id, project_id, public_id)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'l-disabled-link-' || substr(pg_temp.fake_hex64('ldisabled'), 1, 15))
  returning id into v_link_disabled_g;

  perform pg_temp.try_stmt('L', 'L13setup', 'fixture setup: activate then disable a dedicated link',
    format(
      'do $body$ begin update public.project_share_links set state = ''active'', secret_digest = %L, secret_digest_version = 1, activated_at = now(), configuration_version = configuration_version + 1 where id = %L; update public.project_share_links set state = ''disabled'', disabled_at = now(), configuration_version = configuration_version + 1 where id = %L; end $body$;',
      pg_temp.fake_hex64('ldisabled-secret'), v_link_disabled_g, v_link_disabled_g
    ),
    true);
  perform pg_temp.require_test_pass('L', 'L13setup', 'dedicated disabled-link fixture for the grant-rejection test');
  perform pg_temp.act_as('service_role');

  perform pg_temp.try_stmt('L', 'L13', 'a grant against a disabled link is rejected',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now() + interval ''1 day'')',
      pg_temp.get_uuid('session_2'), v_link_disabled_g, v_link_disabled_g),
    false, 'SHARE_GRANT_LINK_NOT_ACTIVE', 'P0001');

  -- Deterministically already-expired link, backdating created_at so
  -- expires_at can genuinely fall before the transaction's fixed now()
  -- while still satisfying project_share_links_timestamp_order_check
  -- (activated_at/expires_at >= / > created_at).
  perform pg_temp.act_as('postgres');
  insert into public.project_share_links (user_id, project_id, public_id, created_at, updated_at)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'l-expired-link-' || substr(pg_temp.fake_hex64('lexpired'), 1, 15), now() - interval '2 days', now() - interval '2 days')
  returning id into v_link_expired_g;

  perform pg_temp.try_stmt('L', 'L14setup', 'fixture setup: activate a dedicated link that is already expired by timestamp (backdated created_at, activated_at and expires_at)',
    format(
      'update public.project_share_links set state = ''active'', secret_digest = %L, secret_digest_version = 1, activated_at = now() - interval ''36 hours'', expires_at = now() - interval ''1 day'', configuration_version = configuration_version + 1 where id = %L',
      pg_temp.fake_hex64('lexpired-secret'), v_link_expired_g
    ),
    true);
  perform pg_temp.require_test_pass('L', 'L14setup', 'dedicated already-expired-by-timestamp link fixture');
  perform pg_temp.act_as('service_role');

  perform pg_temp.try_stmt('L', 'L14', 'a grant against an expired (by timestamp) link is rejected',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now() + interval ''1 day'')',
      pg_temp.get_uuid('session_2'), v_link_expired_g, v_link_expired_g),
    false, 'SHARE_GRANT_LINK_EXPIRED', 'P0001');

  perform pg_temp.act_as('postgres');
  insert into public.project_share_links (user_id, project_id, public_id)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'l-revoked-link-' || substr(pg_temp.fake_hex64('lrevoked'), 1, 15))
  returning id into v_link_revoked_g;

  perform pg_temp.try_stmt('L', 'L15setup', 'fixture setup: activate then revoke a dedicated link',
    format(
      'do $body$ begin update public.project_share_links set state = ''active'', secret_digest = %L, secret_digest_version = 1, activated_at = now(), configuration_version = configuration_version + 1 where id = %L; update public.project_share_links set state = ''revoked'', revoked_at = now(), configuration_version = configuration_version + 1 where id = %L; end $body$;',
      pg_temp.fake_hex64('lrevoked-secret'), v_link_revoked_g, v_link_revoked_g
    ),
    true);
  perform pg_temp.require_test_pass('L', 'L15setup', 'dedicated activated-then-revoked link fixture');
  perform pg_temp.act_as('service_role');

  -- A revoked link's state (`revoked`) is also `<> 'active'`, so the
  -- trigger raises the SAME message as the disabled-link case (L13) --
  -- there is no separate "link revoked" grant message in
  -- 202608030005_client_share_integrity_and_security.sql.
  perform pg_temp.try_stmt('L', 'L15', 'a grant against a revoked link is rejected',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now() + interval ''1 day'')',
      pg_temp.get_uuid('session_2'), v_link_revoked_g, v_link_revoked_g),
    false, 'SHARE_GRANT_LINK_NOT_ACTIVE', 'P0001');

  perform pg_temp.act_as('postgres');
  insert into public.projects (user_id) values (pg_temp.get_uuid('owner_a')) returning id into v_project_deleted_g;
  insert into public.project_share_links (user_id, project_id, public_id)
  values (pg_temp.get_uuid('owner_a'), v_project_deleted_g, 'l-deleted-project-link-' || substr(pg_temp.fake_hex64('ldeletedproj'), 1, 10))
  returning id into v_link_deleted_project_g;

  perform pg_temp.try_stmt('L', 'L16setup', 'fixture setup: activate a link, then soft-delete its own dedicated project',
    format(
      'do $body$ begin update public.project_share_links set state = ''active'', secret_digest = %L, secret_digest_version = 1, activated_at = now(), configuration_version = configuration_version + 1 where id = %L; update public.projects set deleted_at = now() where id = %L; end $body$;',
      pg_temp.fake_hex64('ldeletedproj-secret'), v_link_deleted_project_g, v_project_deleted_g
    ),
    true);
  perform pg_temp.require_test_pass('L', 'L16setup', 'dedicated link-with-soft-deleted-project fixture');
  perform pg_temp.act_as('service_role');

  perform pg_temp.try_stmt('L', 'L16', 'a grant against a link whose project is soft-deleted is rejected',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now() + interval ''1 day'')',
      pg_temp.get_uuid('session_2'), v_link_deleted_project_g, v_link_deleted_project_g),
    false, 'SHARE_GRANT_PROJECT_DELETED', 'P0001');

  perform pg_temp.act_as('postgres');
  insert into public.project_share_links (user_id, project_id, public_id)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'l-short-expiry-link-' || substr(pg_temp.fake_hex64('lshortexp'), 1, 10))
  returning id into v_link_short_expiry_g;

  perform pg_temp.try_stmt('L', 'L17setup', 'fixture setup: activate a dedicated link with a link-level expiry one hour out',
    format(
      'update public.project_share_links set state = ''active'', secret_digest = %L, secret_digest_version = 1, activated_at = now(), expires_at = now() + interval ''1 hour'', configuration_version = configuration_version + 1 where id = %L',
      pg_temp.fake_hex64('lshortexp-secret'), v_link_short_expiry_g
    ),
    true);
  perform pg_temp.require_test_pass('L', 'L17setup', 'dedicated link with a link-level expiry one hour out');
  perform pg_temp.act_as('service_role');

  perform pg_temp.try_stmt('L', 'L17', 'a grant whose own expiry exceeds the link''s own expiry is rejected',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L), now() + interval ''2 hours'')',
      pg_temp.get_uuid('session_2'), v_link_short_expiry_g, v_link_short_expiry_g),
    false, 'SHARE_GRANT_EXPIRY_EXCEEDS_LINK', 'P0001');

  -- The trigger checks strict inequality (<>) against the link's actual
  -- configuration_version, so a FUTURE version is rejected with the same
  -- "stale" message as a lower one -- there is no separate "version too
  -- high" message.
  perform pg_temp.try_stmt('L', 'L18', 'a FUTURE (higher than actual) configuration_version is rejected, not only a lower/stale one',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, (select configuration_version from public.project_share_links where id = %L) + 1000, now() + interval ''1 day'')',
      pg_temp.get_uuid('session_2'), pg_temp.get_uuid('other_link'), pg_temp.get_uuid('other_link')),
    false, 'SHARE_GRANT_CONFIGURATION_VERSION_STALE', 'P0001');

  perform pg_temp.act_as('postgres');
end;
$$;

-- L19-L23: grant identity-field immutability, reusing grant_1 from the
-- block above (identity checks in the trigger fire unconditionally on
-- every UPDATE, before any revocation-specific logic, so this remains
-- valid even though grant_1 was already revoked in L6/L8).
do $$
declare
  v_grant_1 uuid := pg_temp.get_uuid('grant_1_id');
begin
  perform pg_temp.act_as('service_role');

  perform pg_temp.try_stmt('L', 'L19', 'grant browser_session_id is immutable',
    format('update public.share_session_grants set browser_session_id = %L where id = %L', pg_temp.get_uuid('session_2'), v_grant_1),
    false, 'SHARE_GRANT_SESSION_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('L', 'L20', 'grant share_link_id is immutable',
    format('update public.share_session_grants set share_link_id = %L where id = %L', pg_temp.get_uuid('other_link'), v_grant_1),
    false, 'SHARE_GRANT_LINK_IMMUTABLE', 'P0001');

  -- The whole script runs in one transaction, so now() never changes --
  -- `set pin_verified_at = now()` would write back the SAME value grant_1
  -- already has (also set to now() at L1's insert), making the update a
  -- true no-op that the trigger's `is distinct from` check would not
  -- flag, and this expected-failure test would then incorrectly PASS
  -- only because the statement happened to succeed as a no-op rather
  -- than because immutability was actually exercised. Offsetting by an
  -- interval guarantees a provably distinct value.
  perform pg_temp.try_stmt('L', 'L21', 'grant pin_verified_at is immutable',
    format('update public.share_session_grants set pin_verified_at = pin_verified_at + interval ''1 second'' where id = %L', v_grant_1),
    false, 'SHARE_GRANT_PIN_VERIFICATION_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('L', 'L22', 'grant created_at is immutable',
    format('update public.share_session_grants set created_at = created_at - interval ''1 second'' where id = %L', v_grant_1),
    false, 'SHARE_GRANT_CREATED_AT_IMMUTABLE', 'P0001');

  perform pg_temp.try_stmt('L', 'L23', 'grant expires_at is immutable',
    format('update public.share_session_grants set expires_at = now() + interval ''2 days'' where id = %L', v_grant_1),
    false, 'SHARE_GRANT_EXPIRY_IMMUTABLE', 'P0001');

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION M -- Cascades
-- =========================================================

do $$
declare
  v_cascade_link uuid;
  v_cascade_task_map uuid;
  v_cascade_resource_map uuid;
  v_cascade_update uuid;
  v_cascade_msg uuid;
  v_cascade_session uuid;
  v_cascade_grant uuid;
  v_cascade_event uuid;
  v_cascade_bucket uuid;
begin
  insert into public.project_share_links (user_id, project_id, public_id)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'm-cascade-link-' || substr(pg_temp.fake_hex64('mcascade'), 1, 15))
  returning id into v_cascade_link;

  -- comments_enabled and state both changing means v_access_changed is
  -- true, so this UPDATE must also bump configuration_version or the
  -- trigger rejects it with SHARE_LINK_VERSION_NOT_INCREMENTED.
  update public.project_share_links set comments_enabled = true, state = 'active',
    secret_digest = pg_temp.fake_hex64('mcascade-secret'), secret_digest_version = 1, activated_at = now(),
    configuration_version = configuration_version + 1
    where id = v_cascade_link;

  insert into public.share_link_tasks (user_id, share_link_id, subtask_id, public_group)
  values (pg_temp.get_uuid('owner_a'), v_cascade_link, pg_temp.get_bigint('task_a1'), 'in_progress')
  returning id into v_cascade_task_map;

  insert into public.share_link_resources (user_id, share_link_id, resource_id, public_label)
  values (pg_temp.get_uuid('owner_a'), v_cascade_link, pg_temp.get_uuid('resource_a1'), 'Doc')
  returning id into v_cascade_resource_map;

  insert into public.share_link_updates (user_id, share_link_id, body, version, created_by, is_current)
  values (pg_temp.get_uuid('owner_a'), v_cascade_link, 'hello', 1, pg_temp.get_uuid('owner_a'), true)
  returning id into v_cascade_update;

  -- A client-authored message must be inserted as service_role -- the
  -- trigger rejects author_type = 'client' unless current_role =
  -- 'service_role'. Switch only for this one statement, then return to
  -- postgres for the rest of the cascade setup.
  perform pg_temp.act_as('service_role');
  insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client)
  values (pg_temp.get_uuid('owner_a'), v_cascade_link, pg_temp.get_uuid('project_a1'), 'client', 'hi', true)
  returning id into v_cascade_msg;
  perform pg_temp.act_as('postgres');

  insert into public.share_link_events (share_link_id, event_type)
  values (v_cascade_link, 'link_created')
  returning id into v_cascade_event;

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (pg_temp.fake_hex64('m-session'), 1, now() + interval '30 days')
  returning id into v_cascade_session;

  insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at)
  values (v_cascade_session, v_cascade_link, (select configuration_version from public.project_share_links where id = v_cascade_link), now() + interval '1 day')
  returning id into v_cascade_grant;

  insert into public.share_rate_limit_buckets (scope, action, identity_digest, identity_digest_version, share_link_id, window_start, window_seconds, expires_at)
  values ('share_link', 'projection_read', pg_temp.fake_hex64('m-bucket'), 1, v_cascade_link, now(), 60, now() + interval '60 seconds')
  returning id into v_cascade_bucket;

  delete from public.project_share_links where id = v_cascade_link;

  perform pg_temp.record_result('M', 'M1', 'deleting a share link cascades its task mapping',
    not exists (select 1 from public.share_link_tasks where id = v_cascade_task_map), null);
  perform pg_temp.record_result('M', 'M2', 'deleting a share link cascades its resource mapping',
    not exists (select 1 from public.share_link_resources where id = v_cascade_resource_map), null);
  perform pg_temp.record_result('M', 'M3', 'deleting a share link cascades its published updates',
    not exists (select 1 from public.share_link_updates where id = v_cascade_update), null);
  perform pg_temp.record_result('M', 'M4', 'deleting a share link cascades its messages',
    not exists (select 1 from public.share_messages where id = v_cascade_msg), null);
  perform pg_temp.record_result('M', 'M5', 'deleting a share link cascades its events',
    not exists (select 1 from public.share_link_events where id = v_cascade_event), null);
  perform pg_temp.record_result('M', 'M6', 'deleting a share link cascades its session grants',
    not exists (select 1 from public.share_session_grants where id = v_cascade_grant), null);
  perform pg_temp.record_result('M', 'M7', 'deleting a share link cascades its linked rate-limit buckets',
    not exists (select 1 from public.share_rate_limit_buckets where id = v_cascade_bucket), null);
  perform pg_temp.record_result('M', 'M8', 'deleting one link does not affect a different, unrelated link',
    exists (select 1 from public.project_share_links where id = pg_temp.get_uuid('link_e1')), null);
end;
$$;

do $$
declare
  v_session_3 uuid;
  v_grant_x uuid;
  v_grant_y uuid;
begin
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (pg_temp.fake_hex64('m-session-delete'), 1, now() + interval '30 days')
  returning id into v_session_3;

  -- link_e1 is PIN-protected; this grant must supply pin_verified_at.
  insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, pin_verified_at, expires_at)
  values (v_session_3, pg_temp.get_uuid('link_e1'), (select configuration_version from public.project_share_links where id = pg_temp.get_uuid('link_e1')), now(), now() + interval '1 day')
  returning id into v_grant_x;

  insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at)
  values (v_session_3, pg_temp.get_uuid('other_link'), (select configuration_version from public.project_share_links where id = pg_temp.get_uuid('other_link')), now() + interval '1 day')
  returning id into v_grant_y;

  delete from public.share_browser_sessions where id = v_session_3;

  perform pg_temp.record_result('M', 'M9', 'deleting a browser session cascades ALL of its grants',
    not exists (select 1 from public.share_session_grants where id in (v_grant_x, v_grant_y)), null);
end;
$$;

do $$
declare
  v_task_map uuid;
  v_resource_map uuid;
  v_temp_task bigint;
  v_temp_resource uuid;
begin
  insert into public.tasks (user_id, project_id) values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1')) returning id into v_temp_task;
  insert into public.share_link_tasks (user_id, share_link_id, subtask_id, public_group)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), v_temp_task, 'in_progress')
  returning id into v_task_map;
  delete from public.tasks where id = v_temp_task;
  perform pg_temp.record_result('M', 'M10', 'deleting a task cascades its share mapping',
    not exists (select 1 from public.share_link_tasks where id = v_task_map), null);

  insert into public.task_resources (user_id, project_id) values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1')) returning id into v_temp_resource;
  insert into public.share_link_resources (user_id, share_link_id, resource_id, public_label)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_e1'), v_temp_resource, 'temp')
  returning id into v_resource_map;
  delete from public.task_resources where id = v_temp_resource;
  perform pg_temp.record_result('M', 'M11', 'deleting a resource cascades its share mapping',
    not exists (select 1 from public.share_link_resources where id = v_resource_map), null);
end;
$$;

-- =========================================================
-- SECTION N -- No automatic product mutation
-- =========================================================

do $$
declare
  v_projects_before bigint;
  v_tasks_before bigint;
  v_clients_before bigint;
  v_resources_before bigint;
  v_updates_before bigint;
  v_timeline_before bigint;
begin
  select count(*) into v_projects_before from public.projects;
  select count(*) into v_tasks_before from public.tasks;
  select count(*) into v_clients_before from public.clients;
  select count(*) into v_resources_before from public.task_resources;
  select count(*) into v_updates_before from public.project_updates;
  select count(*) into v_timeline_before from public.project_timeline_events;

  perform pg_temp.act_as('service_role');
  insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('other_link'), pg_temp.get_uuid('project_a1'), 'client', 'no mutation check', true);
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result('N', 'N1', 'inserting a client message changes no projects/tasks/clients/resources/updates/timeline row',
    (select count(*) from public.projects) = v_projects_before
    and (select count(*) from public.tasks) = v_tasks_before
    and (select count(*) from public.clients) = v_clients_before
    and (select count(*) from public.task_resources) = v_resources_before
    and (select count(*) from public.project_updates) = v_updates_before
    and (select count(*) from public.project_timeline_events) = v_timeline_before,
    null
  );

  perform pg_temp.record_result('N', 'N2', 'share_messages has no foreign key to project_timeline_events',
    not exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
      where tc.table_name = 'share_messages' and tc.constraint_type = 'FOREIGN KEY'
        and ccu.table_name = 'project_timeline_events'
    ),
    null
  );

  perform pg_temp.record_result('N', 'N3', 'no trigger on share_messages writes to project_timeline_events (proc source contains no INSERT into it)',
    (select prosrc from pg_proc where proname = 'enforce_share_message_integrity') !~* 'insert\s+into\s+public\.project_timeline_events',
    null
  );

  perform pg_temp.record_result('N', 'N4', 'no trigger function in this migration set writes to public.projects, public.tasks or public.clients',
    not exists (
      select 1 from pg_proc
      where proname in (
        'enforce_project_share_link_integrity', 'enforce_share_link_task_integrity',
        'enforce_share_link_resource_integrity', 'enforce_share_link_update_integrity',
        'enforce_share_message_integrity', 'enforce_share_message_conversion_integrity',
        'enforce_share_browser_session_integrity', 'enforce_share_session_grant_integrity'
      )
      and prosrc ~* '(insert\s+into|update|delete\s+from)\s+public\.(projects|tasks|clients)\b'
    ),
    null
  );
end;
$$;

-- N5/N6: the same no-automatic-mutation proof, but around a
-- share_message_conversions insert rather than a share_messages insert,
-- on its own dedicated project/link/message so it never touches
-- project_a1, link_e1 or other_link's own state.
do $$
declare
  v_n_project uuid;
  v_n_link uuid;
  v_n_msg uuid;
  v_n_update uuid;
  v_projects_before2 bigint;
  v_tasks_before2 bigint;
  v_clients_before2 bigint;
  v_resources_before2 bigint;
  v_updates_before2 bigint;
  v_timeline_before2 bigint;
begin
  perform pg_temp.act_as('postgres');

  insert into public.projects (user_id) values (pg_temp.get_uuid('owner_a')) returning id into v_n_project;

  insert into public.project_share_links (user_id, project_id, public_id)
  values (pg_temp.get_uuid('owner_a'), v_n_project, 'n-conversion-link-' || substr(pg_temp.fake_hex64('nconv'), 1, 12))
  returning id into v_n_link;

  perform pg_temp.try_stmt('N', 'N5setup', 'fixture setup: activate a dedicated link for the conversion no-mutation check',
    format(
      'update public.project_share_links set state = ''active'', secret_digest = %L, secret_digest_version = 1, activated_at = now(), comments_enabled = true, configuration_version = configuration_version + 1 where id = %L',
      pg_temp.fake_hex64('nconv-secret'), v_n_link
    ),
    true);
  perform pg_temp.require_test_pass('N', 'N5setup', 'dedicated link activation for the conversion no-mutation check');

  perform pg_temp.act_as('service_role');
  insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client)
  values (pg_temp.get_uuid('owner_a'), v_n_link, v_n_project, 'client', 'please add a footer link', true)
  returning id into v_n_msg;
  perform pg_temp.act_as('postgres');

  -- Creating the project_update fixture BEFORE the snapshot is
  -- acceptable and deliberate: the conversion trigger itself must not
  -- create or mutate it, which is exactly what N6 below proves.
  perform pg_temp.act_as('postgres', pg_temp.get_uuid('owner_a'));
  insert into public.project_updates (user_id, project_id) values (pg_temp.get_uuid('owner_a'), v_n_project) returning id into v_n_update;

  select count(*) into v_projects_before2 from public.projects;
  select count(*) into v_tasks_before2 from public.tasks;
  select count(*) into v_clients_before2 from public.clients;
  select count(*) into v_resources_before2 from public.task_resources;
  select count(*) into v_updates_before2 from public.project_updates;
  select count(*) into v_timeline_before2 from public.project_timeline_events;

  perform pg_temp.try_stmt('N', 'N5', 'a valid conversion trace (as the authenticated owner) succeeds',
    format('insert into public.share_message_conversions (user_id, message_id, project_update_id, converted_by) values (%L, %L, %L, %L)',
      pg_temp.get_uuid('owner_a'), v_n_msg, v_n_update, pg_temp.get_uuid('owner_a')),
    true);

  perform pg_temp.record_result('N', 'N6', 'the conversion trigger creates and mutates no project/task/client/resource/project_update/timeline row',
    (select count(*) from public.projects) = v_projects_before2
    and (select count(*) from public.tasks) = v_tasks_before2
    and (select count(*) from public.clients) = v_clients_before2
    and (select count(*) from public.task_resources) = v_resources_before2
    and (select count(*) from public.project_updates) = v_updates_before2
    and (select count(*) from public.project_timeline_events) = v_timeline_before2,
    null
  );

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION O -- Rate-limit bucket schema behaviour
-- =========================================================

do $$
declare
  v_bucket_link uuid;
  v_bucket_id uuid;
begin
  perform pg_temp.act_as('service_role');

  perform pg_temp.try_stmt('O', 'O1', 'bucket with a real share_link_id succeeds',
    format('insert into public.share_rate_limit_buckets (scope, action, identity_digest, identity_digest_version, share_link_id, window_start, window_seconds, expires_at) values (''share_link'', ''projection_read'', %L, 1, %L, now(), 60, now() + interval ''60 seconds'')',
      pg_temp.fake_hex64('o1'), pg_temp.get_uuid('link_e1')),
    true);

  perform pg_temp.try_stmt('O', 'O2', 'bucket with a null share_link_id (invalid-link attempt) succeeds',
    format('insert into public.share_rate_limit_buckets (scope, action, identity_digest, identity_digest_version, window_start, window_seconds, expires_at) values (''network_identity'', ''invalid_link_access'', %L, 1, now(), 60, now() + interval ''60 seconds'')',
      pg_temp.fake_hex64('o2')),
    true);

  perform pg_temp.try_stmt('O', 'O3', 'a second bucket with the SAME null-link identity+scope+window is rejected (generated share_link_key defeats the NULL-distinct trap)',
    format('insert into public.share_rate_limit_buckets (scope, action, identity_digest, identity_digest_version, window_start, window_seconds, expires_at) values (''network_identity'', ''invalid_link_access'', %L, 1, (select window_start from public.share_rate_limit_buckets where identity_digest = %L), 60, now() + interval ''60 seconds'')',
      pg_temp.fake_hex64('o2'), pg_temp.fake_hex64('o2')),
    false, null, '23505');

  perform pg_temp.try_stmt('O', 'O4', 'negative request_count rejected',
    format('insert into public.share_rate_limit_buckets (scope, action, identity_digest, identity_digest_version, request_count, window_start, window_seconds, expires_at) values (''browser_session'', ''pin_verification'', %L, 1, -1, now(), 60, now() + interval ''60 seconds'')',
      pg_temp.fake_hex64('o4')),
    false, null, '23514');

  perform pg_temp.try_stmt('O', 'O5', 'unsupported window_seconds value rejected',
    format('insert into public.share_rate_limit_buckets (scope, action, identity_digest, identity_digest_version, window_start, window_seconds, expires_at) values (''browser_session'', ''pin_verification'', %L, 1, now(), 42, now() + interval ''60 seconds'')',
      pg_temp.fake_hex64('o5')),
    false, null, '23514');

  perform pg_temp.try_stmt('O', 'O6', 'invalid_link_access action naming a share_link_id is rejected',
    format('insert into public.share_rate_limit_buckets (scope, action, identity_digest, identity_digest_version, share_link_id, window_start, window_seconds, expires_at) values (''network_identity'', ''invalid_link_access'', %L, 1, %L, now(), 60, now() + interval ''60 seconds'')',
      pg_temp.fake_hex64('o6'), pg_temp.get_uuid('link_e1')),
    false, null, '23514');

  perform pg_temp.try_stmt('O', 'O7', 'share_link scope without a share_link_id is rejected',
    format('insert into public.share_rate_limit_buckets (scope, action, identity_digest, identity_digest_version, window_start, window_seconds, expires_at) values (''share_link'', ''projection_read'', %L, 1, now(), 60, now() + interval ''60 seconds'')',
      pg_temp.fake_hex64('o7')),
    false, null, '23514');

  perform pg_temp.try_stmt('O', 'O8', 'expires_at earlier than window end is rejected',
    format('insert into public.share_rate_limit_buckets (scope, action, identity_digest, identity_digest_version, window_start, window_seconds, expires_at) values (''browser_session'', ''pin_verification'', %L, 1, now(), 3600, now() + interval ''5 seconds'')',
      pg_temp.fake_hex64('o8')),
    false, null, '23514');

  perform pg_temp.act_as('postgres');

  insert into public.project_share_links (user_id, project_id, public_id)
  values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1'), 'o-bucket-link-' || substr(pg_temp.fake_hex64('obucket'), 1, 15))
  returning id into v_bucket_link;

  insert into public.share_rate_limit_buckets (scope, action, identity_digest, identity_digest_version, share_link_id, window_start, window_seconds, expires_at)
  values ('share_link', 'projection_read', pg_temp.fake_hex64('o-cascade'), 1, v_bucket_link, now(), 60, now() + interval '60 seconds')
  returning id into v_bucket_id;

  delete from public.project_share_links where id = v_bucket_link;

  perform pg_temp.record_result('O', 'O9', 'deleting a share link cascades its own rate-limit buckets',
    not exists (select 1 from public.share_rate_limit_buckets where id = v_bucket_id), null);
end;
$$;

-- =========================================================
-- FINAL RESULTS
-- =========================================================

select seq, section, test_code, description, status, detail
from _test_results
order by seq;

do $$
declare
  v_failed int;
  v_total int;
begin
  select count(*), count(*) filter (where status = 'FAIL') into v_total, v_failed from _test_results;
  if v_failed > 0 then
    raise exception using errcode = 'P0001', message = format(
      'PHASE1A_RUNTIME_TESTS_FAILED: %s of %s tests failed. Scroll up to the result rows above (status = FAIL) for exact detail. This transaction will still roll back cleanly.',
      v_failed, v_total
    );
  end if;
end;
$$;

select
  count(*) as total_tests,
  count(*) filter (where status = 'PASS') as passed_tests,
  count(*) filter (where status = 'FAIL') as failed_tests,
  'PASS'::text as runtime_status
from _test_results;

rollback;
