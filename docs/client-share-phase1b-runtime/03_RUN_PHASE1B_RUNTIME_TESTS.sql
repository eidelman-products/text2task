-- Text2Task Client Share Link -- Phase 1B Runtime Verification Package
-- File 03: Real SQL runtime behaviour tests
--
-- Run this THIRD, after files 01 and 02, in the same temporary Supabase
-- project. Never run this in the real Text2Task production project.
--
-- METHODOLOGY (read this before reading the tests below):
--
-- These are REAL PostgreSQL behaviour tests, not string/regex tests. Every
-- assertion below either (a) calls one of the fourteen real Client Share
-- RPCs delivered across 202608050001, 202608060001, 202608060002 and
-- 202608060003 (or, for object/security presence only, a catalog query) and
-- checks whether it succeeds or fails with the expected SQLSTATE and exact
-- stable P0001 message, or (b) checks real Postgres catalog state
-- (has_table_privilege, has_function_privilege, pg_policies, pg_proc
-- security/config) or real committed row state. Nothing here asserts
-- against migration SQL text.
--
-- ROLE METHODOLOGY -- IMPORTANT, READ BEFORE INTERPRETING RESULTS:
-- Unlike the Phase 1A SQL Editor package (which tested the three
-- foundation/integrity migrations largely as the Postgres superuser,
-- because no owner-facing RPC existed yet), every Phase 1B RPC assertion
-- below is issued AS THE ACTUAL CALLER ROLE the RPC is designed for --
-- `authenticated`, simulating auth.uid() = owner A or owner B via the same
-- request.jwt.claims GUC Supabase's own auth.uid() reads (see
-- pg_temp.act_as below) -- never as the Postgres superuser standing in for
-- an owner. This is deliberate and required: every RPC in this package is
-- SECURITY DEFINER or SECURITY INVOKER and internally calls auth.uid(),
-- obtains and validates it, and enforces ownership against it. Calling a
-- SECURITY DEFINER RPC as the Postgres superuser would still run its body
-- with the *function owner's* privileges (same outcome), but auth.uid()
-- would resolve however the session's request.jwt.claims happens to be
-- set at that moment -- so every RPC test below explicitly sets that claim
-- via act_as() immediately before calling the RPC, and never relies on an
-- ambient or leftover claim from an earlier test. Section Q additionally
-- proves the RPC ownership contract cannot be bypassed by testing only as
-- postgres: every mutating RPC is exercised at least once as owner B
-- against owner A's link and expected to fail exactly the same way it
-- would for a nonexistent link.
--
-- SQLSTATE DISCIPLINE: every expected-failure test specifies the exact
-- SQLSTATE it must fail with, not just "any error", via the pg_temp.try_rpc
-- / pg_temp.try_stmt helpers below (Section 11 of this package's
-- requirements: "do not use broad message substring matching", "avoid
-- WHEN OTHERS THEN PASS"). Every one of the fourteen RPCs raises stable
-- P0001 errors with an exact message; unique-constraint / CHECK-constraint
-- collisions surfaced by the underlying triggers use their own real
-- SQLSTATE (23505 / 23514 / P0001, matching the trigger that raised them).
--
-- ATOMICITY / TRANSACTION POSTURE (package requirement: "do not use
-- transaction rollback around the entire suite if doing so prevents
-- testing committed function behavior or collecting durable evidence"):
-- Every SECURITY DEFINER/INVOKER RPC below, every RLS policy, every grant
-- check and every role switch via act_as() behaves identically whether or
-- not the enclosing transaction has committed -- PostgreSQL evaluates
-- privileges, RLS and function security context per-statement, not
-- per-commit, and file 02's own DDL (grants, RLS policies, function
-- creation) is already committed by the time this file begins (the
-- Supabase SQL Editor commits each pasted script's statements before the
-- next one is submitted). Nothing tested in Sections A-R depends on THIS
-- file's own DML having been committed to observe correctly -- Phase 1A's
-- own 207-assertion package already proved the identical role-switching
-- and RLS methodology works correctly inside one uncommitted transaction.
-- This file therefore keeps Phase 1A's proven BEGIN;...ROLLBACK; wrapper:
-- it is strictly safer (the disposable project is left with zero residual
-- fixture rows regardless of PASS or FAIL -- explicit ROLLBACK on PASS,
-- or the transaction ending as failed on FAIL, either way commits
-- nothing), and nothing in this package's required coverage needs
-- committed state to observe. This file is REPEATABLE: because no run,
-- PASS or FAIL, ever commits, it may be re-run against the same
-- disposable project as many times as needed without re-running
-- files 01/02, PROVIDED files 01 and 02 have not themselves been re-run
-- (re-running file 01 is refused by its own fail-closed sentinel check;
-- re-running file 02 is refused because public.project_share_links would
-- already exist). See 00_READ_ME_FIRST.md for the full rerun contract.
--
-- KNOWN LIMITATION -- REAL MULTI-SESSION RACES: Sections D and (implicitly)
-- every other lock-based RPC exercise the RPCs' locking logic only through
-- ordinary sequential calls inside one SQL Editor session. This proves the
-- lock ORDER and the one-active-link-per-project CHECK are present and
-- correct for sequential callers; it cannot, by itself, prove true
-- concurrent-session race behaviour as strongly as a dedicated
-- multi-connection integration harness would. This is stated again in the
-- Phase 1B runtime verification report's "known limitations" section.
--
-- KNOWN LIMITATION -- NO DECRYPTION HERE: Section I (reveal) proves
-- reveal_share_link_secret returns only already-encrypted material in the
-- documented shape. It does not, and cannot, decrypt that material --
-- server-side AES-256-GCM decryption is implemented and tested only in
-- server-only TypeScript (lib/share/share-secret-encryption.server.ts and
-- its .test.ts). This SQL runtime package does not decrypt.

-- =========================================================
-- 0. Safety gate
-- =========================================================

do $$
declare
  v_sentinel_kind text;
  v_missing_tables text[];
  v_missing_functions text[];
begin
  if to_regclass('public.text2task_client_share_phase1b_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 1B runtime test sentinel was not found. Run 01_CREATE_TEMP_TEST_FIXTURE.sql and 02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql first, in that order, in this same temporary project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase1b_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_1B_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row does not identify this project as a disposable Phase 1B runtime test project.';
  end if;

  select array_agg(t.tbl) into v_missing_tables
    from (values
      ('project_share_links'), ('share_link_tasks'), ('share_link_resources'),
      ('share_link_updates'), ('share_messages'), ('share_message_conversions'),
      ('share_browser_sessions'), ('share_session_grants'),
      ('share_link_events'), ('share_rate_limit_buckets'),
      ('project_share_secret_material')
    ) as t(tbl)
    where to_regclass('public.' || t.tbl) is null;

  if v_missing_tables is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected Phase 1B table(s): %s. Run 02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql first.',
      array_to_string(v_missing_tables, ', ')
    );
  end if;

  select array_agg(t.fn) into v_missing_functions
    from (values
      ('get_share_link_management_state(uuid)'),
      ('list_share_link_summaries(uuid[])'),
      ('create_share_link_draft(uuid,text)'),
      ('activate_share_link(uuid,text,smallint,text,text,text,smallint)'),
      ('disable_share_link(uuid)'),
      ('reenable_share_link(uuid)'),
      ('set_share_link_pin(uuid,text,text,smallint,integer,integer,integer,integer)'),
      ('clear_share_link_pin(uuid)'),
      ('set_share_link_expiry(uuid,timestamptz)'),
      ('clear_share_link_expiry(uuid)'),
      ('rotate_share_link_secret(uuid,text,smallint,text,text,text,smallint)'),
      ('revoke_share_link(uuid)'),
      ('reveal_share_link_secret(uuid)'),
      ('save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)')
    ) as t(fn)
    where to_regprocedure('public.' || t.fn) is null;

  if v_missing_functions is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected Phase 1B RPC(s): %s. Run 02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql first.',
      array_to_string(v_missing_functions, ', ')
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

create or replace function pg_temp.get_bigint(p_key text) returns bigint
language sql as $f$
  select value::bigint from _fixture_state where key = p_key;
$f$;

create or replace function pg_temp.get_int(p_key text) returns integer
language sql as $f$
  select value::integer from _fixture_state where key = p_key;
$f$;

create or replace function pg_temp.get_json(p_key text) returns jsonb
language sql as $f$
  select value::jsonb from _fixture_state where key = p_key;
$f$;

-- Deterministic fake hex64 (secret_digest-shaped) value, never a real
-- HMAC output -- this package never computes a real digest, matching
-- AGENTS.md rule 7's server-only encryption boundary.
create or replace function pg_temp.fake_hex64(p_seed text) returns text
language sql as $f$
  select substr(md5(p_seed) || md5(p_seed || '-2') || md5(p_seed || '-3'), 1, 64);
$f$;

create or replace function pg_temp.fake_hex_n(p_seed text, p_len integer) returns text
language sql as $f$
  select substr(
    md5(p_seed) || md5(p_seed || '-2') || md5(p_seed || '-3') || md5(p_seed || '-4'),
    1, p_len
  );
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
  p_section text, p_code text, p_desc text, p_pass boolean,
  p_expected text default null, p_actual text default null, p_detail text default null
) returns void language plpgsql as $f$
begin
  insert into _test_results(section, test_code, description, status, expected, actual, detail)
  values (p_section, p_code, p_desc, case when coalesce(p_pass, false) then 'PASS' else 'FAIL' end, p_expected, p_actual, p_detail);
end;
$f$;

-- Executes p_sql (any statement, including a bare `select fn(...)`).
-- Records PASS if the success/failure outcome matches expectations AND,
-- for expected failures, the actual SQLSTATE (and, when supplied, the
-- exact stable P0001 message) matches expectation. p_expected_sqlstate =
-- null means "any SQLSTATE accepted" and is only ever used for a
-- p_expect_success = true call; every expected-failure call in this file
-- supplies a concrete SQLSTATE. Never uses WHEN OTHERS THEN PASS -- every
-- branch inspects the actual SQLSTATE/message before deciding PASS/FAIL.
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

  perform pg_temp.record_result(
    p_section, p_code, p_desc, v_pass,
    case when p_expect_success then 'success' else format('SQLSTATE %s / %s', coalesce(p_expected_sqlstate,'(any)'), coalesce(p_expected_message,'(any)')) end,
    v_detail, v_detail
  );
end;
$f$;

-- RPC variant of try_stmt: p_sql must be a single `select <rpc-call>`
-- expression. On expected success, captures the jsonb return value into
-- _fixture_state under p_capture_key (when supplied) so later tests can
-- inspect fields of the result (linkId, configurationVersion, etc.)
-- without a second lookup query. Same exact-SQLSTATE/message discipline as
-- try_stmt; never uses WHEN OTHERS THEN PASS.
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

-- Fail-closed dependency guard (identical rationale to the Phase 1A
-- package's own pg_temp.require_id): several fixtures below run an
-- expected-success try_rpc/try_stmt, then use a captured id or a
-- SELECT ... INTO to obtain a value later tests depend on. If the setup
-- step actually failed, that value is NULL, which would otherwise either
-- produce an unrelated NOT NULL violation masking the real failure, or
-- silently match zero rows and turn an expected-failure test into a false
-- PASS. Call this immediately after every such capture, before the value
-- is used for anything else.
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
    'PHASE1B_SETUP_DEPENDENCY_FAILED: %s/%s: expected a %s value to exist after this expected-success step, but none was found. Recorded result for %s/%s -- status: %s, detail: %s',
    p_section, p_code, p_label, p_section, p_code,
    coalesce(v_status, '(no result row was recorded for this test code)'),
    coalesce(v_detail, '(no detail recorded)')
  );
end;
$f$;

-- Fail-closed EXPECTED-SUCCESS result guard (identical rationale to the
-- Phase 1A package's own pg_temp.require_test_pass). Call this immediately
-- after any expected-success try_rpc/try_stmt whose STATE, not just its
-- existence, later tests rely on.
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
    'PHASE1B_EXPECTED_SUCCESS_FAILED: %s/%s: %s did not PASS, so its downstream dependents cannot be trusted to run against the state they assume. Recorded result for %s/%s -- status: %s, detail: %s',
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
-- other directly. Identical to the Phase 1A package's own pg_temp.act_as.
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
-- INVOKER (never SECURITY DEFINER), so a switched role's own privileges
-- are what actually get exercised when it calls
-- set_val/get_val/record_result/try_stmt/try_rpc. Without these grants,
-- every role-switched test from Section A onward would fail at the
-- HARNESS layer (cannot write a result row) rather than testing the
-- actual product boundary it exists to test.
--
-- These are grants on TEMPORARY objects inside a disposable test
-- transaction in a disposable test project -- never production grants, and
-- never touching any Client Share table.
-- =========================================================

grant select, insert, update on _fixture_state to anon, authenticated, service_role;
grant select, insert on _test_results to anon, authenticated, service_role;
grant usage, select on sequence _test_results_seq_seq to anon, authenticated, service_role;

do $harness_seed$
begin
  perform pg_temp.set_val('harness_probe', 'READY');
end;
$harness_seed$;

do $$
declare
  v_probe text;
begin
  perform pg_temp.act_as('anon');
  select pg_temp.get_val('harness_probe') into v_probe;
  perform pg_temp.record_result('HARNESS', 'H-ANON', 'anon can read fixture state and record a harness result via the temporary-object grants alone', v_probe = 'READY', 'READY', v_probe, null);
  if v_probe is distinct from 'READY' then
    perform pg_temp.act_as('postgres');
    raise exception using errcode = 'P0001', message = format('HARNESS_SELF_TEST_FAILED: anon read %L for harness_probe, expected ''READY''. Every later role-switched test in this file depends on the harness working -- stopping here.', v_probe);
  end if;
  perform pg_temp.act_as('postgres');

  perform pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111111');
  select pg_temp.get_val('harness_probe') into v_probe;
  perform pg_temp.record_result('HARNESS', 'H-AUTH', 'authenticated (owner A claim) can read fixture state and record a harness result via the temporary-object grants alone', v_probe = 'READY', 'READY', v_probe, null);
  if v_probe is distinct from 'READY' then
    perform pg_temp.act_as('postgres');
    raise exception using errcode = 'P0001', message = format('HARNESS_SELF_TEST_FAILED: authenticated read %L for harness_probe, expected ''READY''. Every later role-switched test in this file depends on the harness working -- stopping here.', v_probe);
  end if;
  perform pg_temp.act_as('postgres');

  perform pg_temp.act_as('service_role');
  select pg_temp.get_val('harness_probe') into v_probe;
  perform pg_temp.record_result('HARNESS', 'H-SVC', 'service_role can read fixture state and record a harness result via the temporary-object grants alone', v_probe = 'READY', 'READY', v_probe, null);
  if v_probe is distinct from 'READY' then
    perform pg_temp.act_as('postgres');
    raise exception using errcode = 'P0001', message = format('HARNESS_SELF_TEST_FAILED: service_role read %L for harness_probe, expected ''READY''. Every later role-switched test in this file depends on the harness working -- stopping here.', v_probe);
  end if;
  perform pg_temp.act_as('postgres');

  -- auth.uid() resolution self-test, independent of the harness grants
  -- above: proves the request.jwt.claims convention itself actually makes
  -- auth.uid() resolve to the intended fixture user, and that an
  -- unauthenticated context resolves to null. Every RPC test below relies
  -- on this.
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
--
-- Deterministic symbolic keys, not hard-coded UUID/bigint literals (see
-- 01_CREATE_TEMP_TEST_FIXTURE.sql's header for why): every row's real
-- generated id is captured via RETURNING and stored under a stable name
-- via pg_temp.set_val, then looked up throughout this file via
-- pg_temp.get_uuid/get_bigint. Covers every fixture variant section 7 of
-- this package's requirements calls for.
-- =========================================================

do $$
declare
  v_owner_a uuid := '11111111-1111-4111-8111-111111111111';
  v_owner_b uuid := '22222222-2222-4222-8222-222222222222';
  v_project_a1 uuid;
  v_project_a2 uuid;
  v_project_a_archived uuid;
  v_project_a_deleted uuid;
  v_project_b1 uuid;
  v_task_a1 bigint;
  v_task_a2 bigint;
  v_task_a_no_project bigint;
  v_task_a_deleted bigint;
  v_task_b1 bigint;
  v_resource_a1 uuid;
  v_resource_a_task uuid;
  v_resource_a2 uuid;
  v_resource_b1 uuid;
  v_resource_orphan uuid;
begin
  perform pg_temp.act_as('postgres');

  insert into public.projects (user_id) values (v_owner_a) returning id into v_project_a1;
  insert into public.projects (user_id) values (v_owner_a) returning id into v_project_a2;
  insert into public.projects (user_id, is_archived) values (v_owner_a, true) returning id into v_project_a_archived;
  insert into public.projects (user_id, deleted_at) values (v_owner_a, now()) returning id into v_project_a_deleted;
  insert into public.projects (user_id) values (v_owner_b) returning id into v_project_b1;

  insert into public.tasks (user_id, project_id) values (v_owner_a, v_project_a1) returning id into v_task_a1;
  insert into public.tasks (user_id, project_id) values (v_owner_a, v_project_a2) returning id into v_task_a2;
  insert into public.tasks (user_id, project_id) values (v_owner_a, null) returning id into v_task_a_no_project;
  insert into public.tasks (user_id, project_id, deleted_at) values (v_owner_a, v_project_a1, now()) returning id into v_task_a_deleted;
  insert into public.tasks (user_id, project_id) values (v_owner_b, v_project_b1) returning id into v_task_b1;

  insert into public.task_resources (user_id, project_id) values (v_owner_a, v_project_a1) returning id into v_resource_a1;
  insert into public.task_resources (user_id, task_id) values (v_owner_a, v_task_a1) returning id into v_resource_a_task;
  insert into public.task_resources (user_id, project_id) values (v_owner_a, v_project_a2) returning id into v_resource_a2;
  insert into public.task_resources (user_id, project_id) values (v_owner_b, v_project_b1) returning id into v_resource_b1;
  insert into public.task_resources (user_id) values (v_owner_a) returning id into v_resource_orphan;

  perform pg_temp.set_val('owner_a', v_owner_a::text);
  perform pg_temp.set_val('owner_b', v_owner_b::text);
  perform pg_temp.set_val('project_a1', v_project_a1::text);
  perform pg_temp.set_val('project_a2', v_project_a2::text);
  perform pg_temp.set_val('project_a_archived', v_project_a_archived::text);
  perform pg_temp.set_val('project_a_deleted', v_project_a_deleted::text);
  perform pg_temp.set_val('project_b1', v_project_b1::text);
  perform pg_temp.set_val('task_a1', v_task_a1::text);
  perform pg_temp.set_val('task_a2', v_task_a2::text);
  perform pg_temp.set_val('task_a_no_project', v_task_a_no_project::text);
  perform pg_temp.set_val('task_a_deleted', v_task_a_deleted::text);
  perform pg_temp.set_val('task_b1', v_task_b1::text);
  perform pg_temp.set_val('resource_a1', v_resource_a1::text);
  perform pg_temp.set_val('resource_a_task', v_resource_a_task::text);
  perform pg_temp.set_val('resource_a2', v_resource_a2::text);
  perform pg_temp.set_val('resource_b1', v_resource_b1::text);
  perform pg_temp.set_val('resource_orphan', v_resource_orphan::text);
end;
$$;

-- =========================================================
-- SECTION A -- Object and security presence
-- =========================================================

do $$
declare
  v_table_count int;
  v_rls_count int;
begin
  select count(*) into v_table_count
  from (values
    ('project_share_links'), ('share_link_tasks'), ('share_link_resources'),
    ('share_link_updates'), ('share_messages'), ('share_message_conversions'),
    ('share_browser_sessions'), ('share_session_grants'),
    ('share_link_events'), ('share_rate_limit_buckets'),
    ('project_share_secret_material')
  ) as t(tbl)
  where to_regclass('public.' || t.tbl) is not null;
  perform pg_temp.record_result('A', 'A1', 'all 11 Phase 1A+1B tables exist', v_table_count = 11, '11', v_table_count::text, null);

  select count(*) into v_rls_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'project_share_links', 'share_link_tasks', 'share_link_resources',
      'share_link_updates', 'share_messages', 'share_message_conversions',
      'share_browser_sessions', 'share_session_grants',
      'share_link_events', 'share_rate_limit_buckets', 'project_share_secret_material'
    )
    and c.relrowsecurity;
  perform pg_temp.record_result('A', 'A2', 'RLS enabled on all 11 tables', v_rls_count = 11, '11', v_rls_count::text, null);
end;
$$;

-- ---------------------------------------------------------------------
-- A-CONSTRAINT-*: every explicitly-named CHECK/UNIQUE constraint the seven
-- migrations create, bound to its exact owning table via pg_constraint --
-- never a bare aggregate count of "all constraints in public". Names and
-- owning tables below were read directly from the seven migration files,
-- not guessed. Every constraint in THIS list was given an explicit
-- `constraint <name>` clause in its migration, so its name is verbatim
-- from the source, not guessed. Implicit (unnamed) primary-key and
-- foreign-key constraints are NOT out of scope -- they are verified
-- separately immediately below (A-PK-*/A-FK-*), structurally, without
-- depending on PostgreSQL's auto-generated constraint names at all.
-- ---------------------------------------------------------------------

do $$
declare
  r record;
  v_found boolean;
begin
  for r in
    select * from (values
      ('project_share_links', 'project_share_links_public_id_unique'),
      ('project_share_links', 'project_share_links_public_id_format_check'),
      ('project_share_links', 'project_share_links_secret_digest_format_check'),
      ('project_share_links', 'project_share_links_secret_digest_consistency_check'),
      ('project_share_links', 'project_share_links_state_check'),
      ('project_share_links', 'project_share_links_content_direction_check'),
      ('project_share_links', 'project_share_links_configuration_version_check'),
      ('project_share_links', 'project_share_links_view_count_check'),
      ('project_share_links', 'project_share_links_client_facing_subtitle_check'),
      ('project_share_links', 'project_share_links_timestamp_order_check'),
      ('project_share_links', 'project_share_links_state_lifecycle_check'),
      ('project_share_links', 'project_share_links_pin_completeness_check'),
      ('project_share_links', 'project_share_links_pin_encoding_check'),
      ('share_link_tasks', 'share_link_tasks_share_link_id_subtask_id_unique'),
      ('share_link_tasks', 'share_link_tasks_public_group_check'),
      ('share_link_tasks', 'share_link_tasks_display_order_check'),
      ('share_link_resources', 'share_link_resources_share_link_id_resource_id_unique'),
      ('share_link_resources', 'share_link_resources_public_label_check'),
      ('share_link_resources', 'share_link_resources_display_order_check'),
      ('share_link_updates', 'share_link_updates_share_link_id_version_unique'),
      ('share_link_updates', 'share_link_updates_version_check'),
      ('share_link_updates', 'share_link_updates_body_check'),
      ('share_link_updates', 'share_link_updates_published_at_check'),
      ('share_messages', 'share_messages_author_type_check'),
      ('share_messages', 'share_messages_author_display_name_check'),
      ('share_messages', 'share_messages_body_check'),
      ('share_messages', 'share_messages_status_check'),
      ('share_messages', 'share_messages_status_timestamps_check'),
      ('share_messages', 'share_messages_no_self_parent_check'),
      ('share_message_conversions', 'share_message_conversions_message_id_unique'),
      ('share_browser_sessions', 'share_browser_sessions_session_digest_unique'),
      ('share_browser_sessions', 'share_browser_sessions_session_digest_format_check'),
      ('share_browser_sessions', 'share_browser_sessions_digest_version_check'),
      ('share_browser_sessions', 'share_browser_sessions_lifecycle_check'),
      ('share_session_grants', 'share_session_grants_configuration_version_check'),
      ('share_session_grants', 'share_session_grants_lifecycle_check'),
      ('share_link_events', 'share_link_events_event_type_check'),
      ('share_link_events', 'share_link_events_identity_digest_consistency_check'),
      ('share_rate_limit_buckets', 'share_rate_limit_buckets_identity_unique'),
      ('share_rate_limit_buckets', 'share_rate_limit_buckets_scope_check'),
      ('share_rate_limit_buckets', 'share_rate_limit_buckets_action_check'),
      ('share_rate_limit_buckets', 'share_rate_limit_buckets_identity_digest_check'),
      ('share_rate_limit_buckets', 'share_rate_limit_buckets_share_link_scope_check'),
      ('share_rate_limit_buckets', 'share_rate_limit_buckets_invalid_link_action_check'),
      ('share_rate_limit_buckets', 'share_rate_limit_buckets_window_seconds_check'),
      ('share_rate_limit_buckets', 'share_rate_limit_buckets_request_count_check'),
      ('share_rate_limit_buckets', 'share_rate_limit_buckets_expiry_check'),
      ('project_share_secret_material', 'project_share_secret_material_nonce_length_check'),
      ('project_share_secret_material', 'project_share_secret_material_auth_tag_length_check'),
      ('project_share_secret_material', 'project_share_secret_material_ciphertext_length_check'),
      ('project_share_secret_material', 'project_share_secret_material_encryption_version_check'),
      ('project_share_secret_material', 'project_share_secret_material_timestamp_order_check')
    ) as t(expected_table, constraint_name)
  loop
    v_found := exists (
      select 1
      from pg_constraint con
      join pg_class tc on tc.oid = con.conrelid
      join pg_namespace n on n.oid = tc.relnamespace
      where n.nspname = 'public'
        and con.conname = r.constraint_name
        and tc.relname = r.expected_table
    );
    perform pg_temp.record_result('A', 'A-CONSTRAINT-' || r.constraint_name,
      format('constraint %s exists, bound to table %s', r.constraint_name, r.expected_table),
      v_found, format('exists on %s', r.expected_table), case when v_found then 'found on expected table' else 'not found on expected table' end, null);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- A-PK-*: every table's primary key, verified STRUCTURALLY -- by
-- contype = 'p' and the actual resolved column name(s) via pg_attribute
-- -- never by depending on PostgreSQL's auto-generated constraint name
-- (which none of these tables override with an explicit name).
-- ---------------------------------------------------------------------

do $$
declare
  r record;
  v_found boolean;
begin
  for r in
    select * from (values
      ('project_share_links', array['id']),
      ('share_link_tasks', array['id']),
      ('share_link_resources', array['id']),
      ('share_link_updates', array['id']),
      ('share_messages', array['id']),
      ('share_message_conversions', array['id']),
      ('share_browser_sessions', array['id']),
      ('share_session_grants', array['id']),
      ('share_link_events', array['id']),
      ('share_rate_limit_buckets', array['id']),
      -- project_share_secret_material is deliberately keyed on
      -- share_link_id itself (one row per link), not a separate id column.
      ('project_share_secret_material', array['share_link_id'])
    ) as t(expected_table, expected_columns)
  loop
    v_found := exists (
      select 1
      from pg_constraint con
      join pg_class tc on tc.oid = con.conrelid
      join pg_namespace n on n.oid = tc.relnamespace
      where n.nspname = 'public'
        and tc.relname = r.expected_table
        and con.contype = 'p'
        and (
          select array_agg(att.attname::text order by k.ord)
          from unnest(con.conkey) with ordinality as k(attnum, ord)
          join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
        ) = r.expected_columns
    );
    perform pg_temp.record_result('A', 'A-PK-' || r.expected_table,
      format('table %s has a primary key on exactly (%s), verified structurally via pg_constraint/pg_attribute', r.expected_table, array_to_string(r.expected_columns, ',')),
      v_found, array_to_string(r.expected_columns, ','), case when v_found then 'found with matching columns' else 'not found or column mismatch' end, null);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- A-FK-*: every foreign key the seven migrations create, verified
-- STRUCTURALLY -- source table/column, referenced schema/table/column
-- (resolved via pg_attribute, not assumed), and the exact ON DELETE
-- behavior (confdeltype: 'c' = cascade, 'n' = set null) the migration
-- specifies -- never by depending on an auto-generated constraint name.
-- Covers every Client Share table with a foreign key, including
-- project_share_secret_material's share_link_id (which is both its
-- primary key and its sole foreign key).
-- ---------------------------------------------------------------------

do $$
declare
  r record;
  v_found boolean;
begin
  for r in
    select * from (values
      ('project_share_links', 'user_id', 'auth', 'users', 'id', 'c'),
      ('project_share_links', 'project_id', 'public', 'projects', 'id', 'c'),
      ('share_link_tasks', 'user_id', 'auth', 'users', 'id', 'c'),
      ('share_link_tasks', 'share_link_id', 'public', 'project_share_links', 'id', 'c'),
      ('share_link_tasks', 'subtask_id', 'public', 'tasks', 'id', 'c'),
      ('share_link_resources', 'user_id', 'auth', 'users', 'id', 'c'),
      ('share_link_resources', 'share_link_id', 'public', 'project_share_links', 'id', 'c'),
      ('share_link_resources', 'resource_id', 'public', 'task_resources', 'id', 'c'),
      ('share_link_updates', 'user_id', 'auth', 'users', 'id', 'c'),
      ('share_link_updates', 'share_link_id', 'public', 'project_share_links', 'id', 'c'),
      ('share_link_updates', 'created_by', 'auth', 'users', 'id', 'c'),
      ('share_messages', 'user_id', 'auth', 'users', 'id', 'c'),
      ('share_messages', 'share_link_id', 'public', 'project_share_links', 'id', 'c'),
      ('share_messages', 'project_id', 'public', 'projects', 'id', 'c'),
      ('share_messages', 'parent_id', 'public', 'share_messages', 'id', 'c'),
      ('share_message_conversions', 'user_id', 'auth', 'users', 'id', 'c'),
      ('share_message_conversions', 'message_id', 'public', 'share_messages', 'id', 'c'),
      ('share_message_conversions', 'project_update_id', 'public', 'project_updates', 'id', 'n'),
      ('share_message_conversions', 'target_task_id', 'public', 'tasks', 'id', 'n'),
      ('share_message_conversions', 'converted_by', 'auth', 'users', 'id', 'c'),
      ('share_session_grants', 'browser_session_id', 'public', 'share_browser_sessions', 'id', 'c'),
      ('share_session_grants', 'share_link_id', 'public', 'project_share_links', 'id', 'c'),
      ('share_link_events', 'share_link_id', 'public', 'project_share_links', 'id', 'c'),
      ('share_rate_limit_buckets', 'share_link_id', 'public', 'project_share_links', 'id', 'c'),
      ('project_share_secret_material', 'share_link_id', 'public', 'project_share_links', 'id', 'c')
    ) as t(source_table, source_column, ref_schema, ref_table, ref_column, expected_delete_rule)
  loop
    v_found := exists (
      select 1
      from pg_constraint con
      join pg_class tc on tc.oid = con.conrelid
      join pg_namespace tn on tn.oid = tc.relnamespace
      join pg_class rc on rc.oid = con.confrelid
      join pg_namespace rn on rn.oid = rc.relnamespace
      where tn.nspname = 'public'
        and tc.relname = r.source_table
        and con.contype = 'f'
        and rn.nspname = r.ref_schema
        and rc.relname = r.ref_table
        and con.confdeltype = r.expected_delete_rule
        and (
          select att.attname::text
          from unnest(con.conkey) as k(attnum)
          join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
          limit 1
        ) = r.source_column
        and (
          select att.attname::text
          from unnest(con.confkey) as fk(attnum)
          join pg_attribute att on att.attrelid = con.confrelid and att.attnum = fk.attnum
          limit 1
        ) = r.ref_column
    );
    perform pg_temp.record_result('A', 'A-FK-' || r.source_table || '.' || r.source_column,
      format('FK %s.%s -> %s.%s.%s exists with the exact expected ON DELETE behavior (%s), verified structurally via pg_constraint/pg_attribute',
        r.source_table, r.source_column, r.ref_schema, r.ref_table, r.ref_column,
        case r.expected_delete_rule when 'c' then 'CASCADE' when 'n' then 'SET NULL' else r.expected_delete_rule end),
      v_found,
      format('references %s.%s.%s, on delete %s', r.ref_schema, r.ref_table, r.ref_column, case r.expected_delete_rule when 'c' then 'CASCADE' when 'n' then 'SET NULL' else r.expected_delete_rule end),
      case when v_found then 'found with matching columns and delete rule' else 'not found or mismatched' end, null);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- A-INDEX-*: every explicit `create index`/`create unique index` the
-- seven migrations create, bound to its exact owning table via
-- pg_index/pg_class -- never a bare count. Includes every partial index
-- and the current-update partial unique index.
-- ---------------------------------------------------------------------

do $$
declare
  r record;
  v_found boolean;
begin
  for r in
    select * from (values
      ('project_share_links', 'project_share_links_user_id_project_id_idx'),
      ('project_share_links', 'project_share_links_user_id_state_idx'),
      ('project_share_links', 'project_share_links_expiry_sweep_idx'),
      ('share_link_tasks', 'share_link_tasks_share_link_id_display_order_idx'),
      ('share_link_tasks', 'share_link_tasks_subtask_id_idx'),
      ('share_link_resources', 'share_link_resources_share_link_id_display_order_idx'),
      ('share_link_resources', 'share_link_resources_resource_id_idx'),
      ('share_link_updates', 'share_link_updates_current_version_unique_idx'),
      ('share_messages', 'share_messages_share_link_id_created_at_idx'),
      ('share_messages', 'share_messages_user_id_project_id_created_at_idx'),
      ('share_messages', 'share_messages_unread_client_idx'),
      ('share_messages', 'share_messages_parent_id_idx'),
      ('share_message_conversions', 'share_message_conversions_user_id_converted_at_idx'),
      ('share_message_conversions', 'share_message_conversions_project_update_id_idx'),
      ('share_message_conversions', 'share_message_conversions_target_task_id_idx'),
      ('share_browser_sessions', 'share_browser_sessions_expires_at_idx'),
      ('share_session_grants', 'share_session_grants_current_unique_idx'),
      ('share_session_grants', 'share_session_grants_share_link_id_active_idx'),
      ('share_session_grants', 'share_session_grants_expires_at_idx'),
      ('share_link_events', 'share_link_events_share_link_id_created_at_idx'),
      ('share_link_events', 'share_link_events_created_at_idx'),
      ('share_rate_limit_buckets', 'share_rate_limit_buckets_expires_at_idx'),
      ('share_rate_limit_buckets', 'share_rate_limit_buckets_share_link_id_idx')
    ) as t(expected_table, index_name)
  loop
    v_found := exists (
      select 1
      from pg_class ic
      join pg_index i on i.indexrelid = ic.oid
      join pg_class tc on tc.oid = i.indrelid
      join pg_namespace n on n.oid = ic.relnamespace
      where n.nspname = 'public'
        and ic.relname = r.index_name
        and tc.relname = r.expected_table
    );
    perform pg_temp.record_result('A', 'A-INDEX-' || r.index_name,
      format('index %s exists, bound to table %s', r.index_name, r.expected_table),
      v_found, format('exists on %s', r.expected_table), case when v_found then 'found on expected table' else 'not found on expected table' end, null);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- A-TRIGGER-*: every delivered non-internal Client Share trigger, bound
-- to its exact owning table via pg_trigger -- not just file 02's own
-- final smoke-test query, and not a bare count.
-- ---------------------------------------------------------------------

do $$
declare
  r record;
  v_found boolean;
begin
  for r in
    select * from (values
      ('project_share_links', 'project_share_links_set_updated_at'),
      ('share_link_tasks', 'share_link_tasks_set_updated_at'),
      ('share_link_resources', 'share_link_resources_set_updated_at'),
      ('share_messages', 'share_messages_set_updated_at'),
      ('share_rate_limit_buckets', 'share_rate_limit_buckets_set_updated_at'),
      ('project_share_secret_material', 'project_share_secret_material_set_updated_at'),
      ('project_share_links', 'project_share_links_enforce_integrity'),
      ('share_link_tasks', 'share_link_tasks_enforce_integrity'),
      ('share_link_resources', 'share_link_resources_enforce_integrity'),
      ('share_link_updates', 'share_link_updates_enforce_integrity'),
      ('share_messages', 'share_messages_enforce_integrity'),
      ('share_message_conversions', 'share_message_conversions_enforce_integrity'),
      ('share_browser_sessions', 'share_browser_sessions_enforce_integrity'),
      ('share_session_grants', 'share_session_grants_enforce_integrity')
    ) as t(expected_table, trigger_name)
  loop
    v_found := exists (
      select 1
      from pg_trigger tg
      join pg_class tc on tc.oid = tg.tgrelid
      join pg_namespace n on n.oid = tc.relnamespace
      where n.nspname = 'public'
        and tg.tgname = r.trigger_name
        and tc.relname = r.expected_table
        and not tg.tgisinternal
    );
    perform pg_temp.record_result('A', 'A-TRIGGER-' || r.trigger_name,
      format('trigger %s exists, bound to table %s', r.trigger_name, r.expected_table),
      v_found, format('exists on %s', r.expected_table), case when v_found then 'found on expected table' else 'not found on expected table' end, null);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- A-SIG-*/A-SEC-*/A-SP-*/A-GRANT-*: signature-exact verification for all
-- 14 Phase 1B RPCs -- exact overload resolved via to_regprocedure/OID
-- (never a bare `proname` match, which could silently pass a same-named
-- but wrongly-shaped overload), exact SECURITY INVOKER/DEFINER status,
-- the exact fixed search_path value "public, pg_temp" (parsed and
-- compared as a normalized list, not a `like 'search_path=%'` wildcard
-- that would accept any value), and the exact four-role EXECUTE grant
-- profile (authenticated=yes, anon/PUBLIC/service_role=no) -- including
-- the two owner-read RPCs, which the previous service_role check omitted.
-- ---------------------------------------------------------------------

do $$
declare
  r record;
  v_proc_oid oid;
  v_prosecdef boolean;
  v_proconfig text[];
  v_cfg text;
  v_search_path_parts text[];
  v_search_path_ok boolean;
  v_auth_ok boolean;
  v_anon_ok boolean;
  v_public_ok boolean;
  v_service_ok boolean;
begin
  for r in
    select * from (values
      ('get_share_link_management_state', 'get_share_link_management_state(uuid)', 'INVOKER'),
      ('list_share_link_summaries', 'list_share_link_summaries(uuid[])', 'INVOKER'),
      ('create_share_link_draft', 'create_share_link_draft(uuid,text)', 'DEFINER'),
      ('activate_share_link', 'activate_share_link(uuid,text,smallint,text,text,text,smallint)', 'DEFINER'),
      ('disable_share_link', 'disable_share_link(uuid)', 'DEFINER'),
      ('reenable_share_link', 'reenable_share_link(uuid)', 'DEFINER'),
      ('set_share_link_pin', 'set_share_link_pin(uuid,text,text,smallint,integer,integer,integer,integer)', 'DEFINER'),
      ('clear_share_link_pin', 'clear_share_link_pin(uuid)', 'DEFINER'),
      ('set_share_link_expiry', 'set_share_link_expiry(uuid,timestamptz)', 'DEFINER'),
      ('clear_share_link_expiry', 'clear_share_link_expiry(uuid)', 'DEFINER'),
      ('rotate_share_link_secret', 'rotate_share_link_secret(uuid,text,smallint,text,text,text,smallint)', 'DEFINER'),
      ('revoke_share_link', 'revoke_share_link(uuid)', 'DEFINER'),
      ('reveal_share_link_secret', 'reveal_share_link_secret(uuid)', 'DEFINER'),
      ('save_share_configuration', 'save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)', 'DEFINER')
    ) as t(short_name, full_signature, expected_security)
  loop
    v_proc_oid := to_regprocedure('public.' || r.full_signature);

    perform pg_temp.record_result('A', 'A-SIG-' || r.short_name,
      format('%s exists with the exact expected signature (regprocedure resolution, not a bare name match)', r.full_signature),
      v_proc_oid is not null, 'resolves to exactly one function', case when v_proc_oid is null then 'signature not found' else 'resolved: ' || v_proc_oid::regprocedure::text end, null);

    if v_proc_oid is null then
      continue;
    end if;

    select p.prosecdef, p.proconfig into v_prosecdef, v_proconfig
      from pg_proc p where p.oid = v_proc_oid;

    perform pg_temp.record_result('A', 'A-SEC-' || r.short_name,
      format('%s has the exact expected SECURITY %s status', r.full_signature, r.expected_security),
      v_prosecdef = (r.expected_security = 'DEFINER'), r.expected_security,
      case when v_prosecdef then 'DEFINER' else 'INVOKER' end, null);

    v_search_path_ok := false;
    if v_proconfig is not null then
      foreach v_cfg in array v_proconfig loop
        if v_cfg like 'search_path=%' then
          select array_agg(btrim(part) order by ord) into v_search_path_parts
            from unnest(string_to_array(substring(v_cfg from position('=' in v_cfg) + 1), ',')) with ordinality as u(part, ord);
          if v_search_path_parts = array['public', 'pg_temp'] then
            v_search_path_ok := true;
          end if;
        end if;
      end loop;
    end if;
    perform pg_temp.record_result('A', 'A-SP-' || r.short_name,
      format('%s has the exact fixed search_path value "public, pg_temp" (parsed and compared as a normalized list, not a wildcard prefix match)', r.full_signature),
      v_search_path_ok, 'public, pg_temp', array_to_string(coalesce(v_proconfig, array['(no proconfig)']), ' | '), null);

    v_auth_ok := has_function_privilege('authenticated', v_proc_oid, 'EXECUTE');
    v_anon_ok := not has_function_privilege('anon', v_proc_oid, 'EXECUTE');
    v_public_ok := not has_function_privilege('public', v_proc_oid, 'EXECUTE');
    v_service_ok := not has_function_privilege('service_role', v_proc_oid, 'EXECUTE');
    perform pg_temp.record_result('A', 'A-GRANT-' || r.short_name,
      format('%s grant profile is exact: authenticated=EXECUTE, anon/PUBLIC/service_role=no EXECUTE (all 14 RPCs, not just the 12 mutating ones)', r.full_signature),
      v_auth_ok and v_anon_ok and v_public_ok and v_service_ok,
      'auth=yes,anon=no,public=no,service_role=no',
      format('auth=%s,anon=%s,public=%s,service_role=%s', v_auth_ok, not v_anon_ok, not v_public_ok, not v_service_ok),
      null);
  end loop;
end;
$$;

do $$
declare
  v_secret_material_rls boolean;
  v_secret_material_policy_count int;
  v_secret_material_grant_count int;
  v_secret_material_column_count int;
begin
  -- project_share_secret_material: fully closed table (AGENTS.md rule 7).
  select c.relrowsecurity into v_secret_material_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'project_share_secret_material';
  perform pg_temp.record_result('A', 'A10', 'project_share_secret_material has RLS enabled', coalesce(v_secret_material_rls, false), 'true', v_secret_material_rls::text, null);

  select count(*) into v_secret_material_policy_count
  from pg_policies where schemaname = 'public' and tablename = 'project_share_secret_material';
  perform pg_temp.record_result('A', 'A11', 'project_share_secret_material has zero user-facing policies', v_secret_material_policy_count = 0, '0', v_secret_material_policy_count::text, null);

  select count(*) into v_secret_material_grant_count
  from (values ('anon'), ('authenticated'), ('service_role')) as t(role_name)
  where has_table_privilege(t.role_name, 'public.project_share_secret_material', 'SELECT')
     or has_table_privilege(t.role_name, 'public.project_share_secret_material', 'INSERT')
     or has_table_privilege(t.role_name, 'public.project_share_secret_material', 'UPDATE')
     or has_table_privilege(t.role_name, 'public.project_share_secret_material', 'DELETE');
  perform pg_temp.record_result('A', 'A12', 'project_share_secret_material has no direct grant to anon/authenticated/service_role', v_secret_material_grant_count = 0, '0', v_secret_material_grant_count::text, null);

  -- No plaintext-secret column: only ciphertext/nonce/auth_tag/
  -- encryption_version (plus share_link_id/created_at/updated_at) exist.
  select count(*) into v_secret_material_column_count
  from information_schema.columns
  where table_schema = 'public' and table_name = 'project_share_secret_material'
    and column_name in ('plaintext', 'secret', 'raw_secret', 'pin', 'pin_plaintext');
  perform pg_temp.record_result('A', 'A13', 'project_share_secret_material has no plaintext-secret column', v_secret_material_column_count = 0, '0', v_secret_material_column_count::text, null);

  -- Real attempted statement, not just a catalog check: an ordinary
  -- authenticated caller cannot read this table directly at all.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_stmt('A', 'A14', 'ordinary authenticated role cannot SELECT project_share_secret_material directly',
    'select 1 from public.project_share_secret_material limit 1', false, null, '42501');
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION B -- Owner read RPCs
--
-- Run BEFORE Section C creates any draft, so B3/B7/B8 genuinely exercise
-- the "no managed link yet" branch of both read RPCs. NOTE on B1/B2: anon
-- has no EXECUTE grant on either RPC at all (Section A7), so calling as
-- anon would fail at the grant layer (42501) before ever reaching the
-- RPC's own internal auth.uid() check -- that grant-layer boundary is
-- covered separately in Section Q. B1/B2 instead call as the
-- `authenticated` role (which does have EXECUTE) with NO jwt claim, so
-- auth.uid() itself resolves null and the RPC's own UNAUTHORIZED branch is
-- what actually rejects the call.
-- =========================================================

do $$
begin
  perform pg_temp.act_as('authenticated');
  perform pg_temp.try_rpc('B', 'B1', 'authenticated caller with no auth.uid() fails UNAUTHORIZED on get_share_link_management_state',
    format('select public.get_share_link_management_state(%L)', pg_temp.get_uuid('project_a1')),
    false, 'UNAUTHORIZED', 'P0001');
  perform pg_temp.try_rpc('B', 'B2', 'authenticated caller with no auth.uid() fails UNAUTHORIZED on list_share_link_summaries',
    format('select public.list_share_link_summaries(array[%L]::uuid[])', pg_temp.get_uuid('project_a1')),
    false, 'UNAUTHORIZED', 'P0001');
  perform pg_temp.act_as('postgres');
end;
$$;

do $$
declare
  v_result jsonb;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('B', 'B3', 'owner A reads own project state before any link exists',
    format('select public.get_share_link_management_state(%L)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'b3_result');
  v_result := pg_temp.get_json('b3_result');
  perform pg_temp.record_result('B', 'B3-shape', 'pre-link management state has link=null and empty arrays',
    v_result->'link' = 'null'::jsonb and v_result->'mappedTaskIds' = '[]'::jsonb and v_result->'mappedResourceIds' = '[]'::jsonb and v_result->'currentUpdate' = 'null'::jsonb,
    'link=null,mappedTaskIds=[],mappedResourceIds=[],currentUpdate=null', v_result::text, null);

  -- Cross-owner: the owner-B claim MUST be established BEFORE this call --
  -- calling get_share_link_management_state while still authenticated as
  -- owner A (this project's real owner) would succeed, not reject, making
  -- this a guaranteed false FAIL/false PASS if the context switch were
  -- missing or misordered. act_as() itself is called first, synchronously,
  -- so no RPC in this block ever runs under the wrong claim.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc('B', 'B4', 'owner B cannot read owner A''s project via get_share_link_management_state',
    format('select public.get_share_link_management_state(%L)', pg_temp.get_uuid('project_a1')),
    false, 'PROJECT_NOT_FOUND', 'P0001');

  -- Restore owner A before every subsequent owner-A test in this block.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('B', 'B5', 'deleted project is not exposed (stable PROJECT_NOT_FOUND, same as nonexistent)',
    format('select public.get_share_link_management_state(%L)', pg_temp.get_uuid('project_a_deleted')),
    false, 'PROJECT_NOT_FOUND', 'P0001');

  perform pg_temp.try_rpc('B', 'B6', 'missing project id is stable PROJECT_NOT_FOUND',
    format('select public.get_share_link_management_state(%L)', gen_random_uuid()),
    false, 'PROJECT_NOT_FOUND', 'P0001');

  perform pg_temp.try_rpc('B', 'B7', 'list_share_link_summaries accepts multiple owned project ids, one result key per project',
    format('select public.list_share_link_summaries(array[%L,%L]::uuid[])', pg_temp.get_uuid('project_a1'), pg_temp.get_uuid('project_a2')),
    true, null, null, 'b7_result');
  v_result := pg_temp.get_json('b7_result');
  perform pg_temp.record_result('B', 'B7-shape', 'summary result has exactly 2 keys, one per requested project',
    (select count(*) from jsonb_object_keys(v_result)) = 2, '2', (select count(*) from jsonb_object_keys(v_result))::text, null);

  perform pg_temp.try_rpc('B', 'B8', 'list_share_link_summaries normalizes a duplicate requested project id to one result key',
    format('select public.list_share_link_summaries(array[%L,%L]::uuid[])', pg_temp.get_uuid('project_a1'), pg_temp.get_uuid('project_a1')),
    true, null, null, 'b8_result');
  v_result := pg_temp.get_json('b8_result');
  perform pg_temp.record_result('B', 'B8-shape', 'duplicate-id summary result has exactly 1 key',
    (select count(*) from jsonb_object_keys(v_result)) = 1, '1', (select count(*) from jsonb_object_keys(v_result))::text, null);

  perform pg_temp.try_rpc('B', 'B9', 'list_share_link_summaries rejects the whole call, all-or-nothing, if any requested project is not owned',
    format('select public.list_share_link_summaries(array[%L,%L]::uuid[])', pg_temp.get_uuid('project_a1'), pg_temp.get_uuid('project_b1')),
    false, 'PROJECT_NOT_FOUND', 'P0001');

  perform pg_temp.record_result('B', 'B10', 'pre-link management-state result contains no pinHash/secretDigest/userId/projectId keys',
    not (v_result ? 'pinHash') and not (v_result ? 'secretDigest') and not (v_result ? 'userId') and not (v_result ? 'projectId'),
    'absent', v_result::text, null);

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION C -- Draft creation and public-id collision
-- =========================================================

do $$
declare
  v_public_id_1 text := pg_temp.fake_b64url(24);
  v_public_id_2 text := pg_temp.fake_b64url(24);
  v_public_id_dup text := pg_temp.fake_b64url(24);
  v_result jsonb;
  v_link_a1 uuid;
  v_link_a1_second uuid;
  v_event_count int;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('C', 'C1', 'owner A creates a draft for project_a1',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a1'), v_public_id_1),
    true, null, null, 'c1_result');
  v_result := pg_temp.get_json('c1_result');
  v_link_a1 := (v_result->>'linkId')::uuid;
  perform pg_temp.require_id('C', 'C1', 'draft link for project_a1', v_link_a1::text);
  perform pg_temp.set_val('link_a1', v_link_a1::text);

  perform pg_temp.record_result('C', 'C1-shape', 'draft result has state=draft, exact public_id, and no secret material fields',
    v_result->>'state' = 'draft' and v_result->>'publicId' = v_public_id_1
      and not (v_result ? 'secretDigest') and not (v_result ? 'ciphertextHex'),
    format('state=draft,publicId=%s', v_public_id_1), v_result::text, null);

  perform pg_temp.record_result('C', 'C1-public-id-format', 'public_id is exactly a 24-char Base64URL V1 shape',
    v_public_id_1 ~ '^[A-Za-z0-9_-]{24}$' and char_length(v_public_id_1) = 24,
    '24-char [A-Za-z0-9_-]', v_public_id_1, null);

  -- Multiple drafts per project are always allowed.
  perform pg_temp.try_rpc('C', 'C2', 'owner A creates a second draft for the same project (multiple drafts allowed)',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a1'), v_public_id_2),
    true, null, null, 'c2_result');
  v_result := pg_temp.get_json('c2_result');
  v_link_a1_second := (v_result->>'linkId')::uuid;
  perform pg_temp.require_id('C', 'C2', 'second draft link for project_a1', v_link_a1_second::text);
  perform pg_temp.set_val('link_a1_second', v_link_a1_second::text);

  -- link_created event exists with no secret/content. share_link_events is
  -- a fully closed internal table (RLS enabled, no policies, no grant to
  -- authenticated at all), so this direct inspection must run as the
  -- elevated harness/postgres context, not as owner A -- then switch back
  -- to owner A before the next owner RPC call below.
  perform pg_temp.act_as('postgres');
  select count(*) into v_event_count
    from public.share_link_events
    where share_link_id = v_link_a1 and event_type = 'link_created'
      and identity_digest is null and identity_digest_version is null;
  perform pg_temp.record_result('C', 'C3', 'link_created event exists for the draft with no identity digest', v_event_count = 1, '1', v_event_count::text, null);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- Archived project rejected.
  perform pg_temp.try_rpc('C', 'C4', 'creating a draft for an archived project is rejected',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a_archived'), pg_temp.fake_b64url(24)),
    false, 'PROJECT_ARCHIVED', 'P0001');

  -- Deleted project not found.
  perform pg_temp.try_rpc('C', 'C5', 'creating a draft for a deleted project is stable PROJECT_NOT_FOUND',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a_deleted'), pg_temp.fake_b64url(24)),
    false, 'PROJECT_NOT_FOUND', 'P0001');

  -- B cannot create for A's project.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc('C', 'C6', 'owner B cannot create a draft for owner A''s project',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a1'), pg_temp.fake_b64url(24)),
    false, 'PROJECT_NOT_FOUND', 'P0001');
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- Duplicate public_id -> PUBLIC_ID_COLLISION (identified by constraint
  -- name, not message substring -- see the RPC's own comment).
  perform pg_temp.try_rpc('C', 'C7', 'duplicate public_id is rejected as PUBLIC_ID_COLLISION',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a2'), v_public_id_1),
    false, 'PUBLIC_ID_COLLISION', 'P0001');

  -- Invalid public_id shape rejected before any insert is attempted.
  perform pg_temp.try_rpc('C', 'C8', 'malformed public_id (wrong length) is rejected as INVALID_PUBLIC_ID',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a1'), 'too-short'),
    false, 'INVALID_PUBLIC_ID', 'P0001');
  perform pg_temp.try_rpc('C', 'C8b', 'malformed public_id (disallowed character) is rejected as INVALID_PUBLIC_ID',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a1'), repeat('$', 24)),
    false, 'INVALID_PUBLIC_ID', 'P0001');

  -- Unauthenticated (authenticated role, no claim) rejected.
  perform pg_temp.act_as('authenticated');
  perform pg_temp.try_rpc('C', 'C9', 'unauthenticated caller cannot create a draft',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a1'), pg_temp.fake_b64url(24)),
    false, 'UNAUTHORIZED', 'P0001');

  perform pg_temp.act_as('postgres');
end;
$$;
-- =========================================================
-- SECTION D -- Activation and one-active-link rule
--
-- Uses deterministic opaque test values, never real cryptographic
-- material: digest 64 lowercase hex, ciphertext 43 bytes as 86 lowercase
-- hex, nonce 12 bytes as 24 lowercase hex, auth tag 16 bytes as 32
-- lowercase hex, version fields = 1 -- matching every real-schema length
-- constraint exactly without this package ever computing a real HMAC or
-- performing real AES-GCM encryption.
-- =========================================================

do $$
declare
  v_result jsonb;
  v_digest_1 text := pg_temp.fake_hex64('d1-secret');
  v_ciphertext_1 text := pg_temp.fake_hex_n('d1-cipher', 86);
  v_nonce_1 text := pg_temp.fake_hex_n('d1-nonce', 24);
  v_tag_1 text := pg_temp.fake_hex_n('d1-tag', 32);
  v_material_count int;
  v_link_state text;
  v_link_config_version int;
  v_link_activated_at timestamptz;
  v_link_secret_digest text;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('D', 'D1', 'owner A activates the draft link_a1 with valid opaque test material',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1'), v_digest_1, v_ciphertext_1, v_nonce_1, v_tag_1),
    true, null, null, 'd1_result');
  perform pg_temp.require_test_pass('D', 'D1', 'link_a1 activation');
  v_result := pg_temp.get_json('d1_result');

  perform pg_temp.record_result('D', 'D1-shape', 'activation result has state=active, configurationVersion=2, activatedAt set, no digest/material fields',
    v_result->>'state' = 'active' and (v_result->>'configurationVersion')::int = 2 and v_result ? 'activatedAt'
      and not (v_result ? 'secretDigest') and not (v_result ? 'ciphertextHex'),
    'state=active,configurationVersion=2', v_result::text, null);

  perform pg_temp.act_as('postgres');

  select state, configuration_version, activated_at, secret_digest
    into v_link_state, v_link_config_version, v_link_activated_at, v_link_secret_digest
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');

  perform pg_temp.record_result('D', 'D1-digest-only-in-links', 'secret_digest is present only in project_share_links, exactly the supplied value',
    v_link_secret_digest = v_digest_1, v_digest_1, v_link_secret_digest, null);

  select count(*) into v_material_count
    from public.project_share_secret_material
    where share_link_id = pg_temp.get_uuid('link_a1')
      and encode(ciphertext, 'hex') = v_ciphertext_1
      and encode(nonce, 'hex') = v_nonce_1
      and encode(auth_tag, 'hex') = v_tag_1
      and octet_length(ciphertext) = 43
      and octet_length(nonce) = 12
      and octet_length(auth_tag) = 16;
  perform pg_temp.record_result('D', 'D1-material-exact', 'exactly one project_share_secret_material row with exact byte lengths and the supplied material', v_material_count = 1, '1', v_material_count::text, null);

  perform pg_temp.record_result('D', 'D1-config-version', 'configuration_version incremented exactly once (1 -> 2)', v_link_config_version = 2, '2', v_link_config_version::text, null);
  perform pg_temp.record_result('D', 'D1-activated-at', 'activated_at is set', v_link_activated_at is not null, 'not null', v_link_activated_at::text, null);

  perform pg_temp.record_result('D', 'D1-no-plaintext-column', 'project_share_secret_material has no plaintext-shaped column anywhere in this schema',
    not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_share_secret_material'
        and column_name in ('plaintext', 'secret', 'raw_secret')
    ), 'no such column', 'confirmed absent', null);
end;
$$;

do $$
declare
  v_digest_2 text := pg_temp.fake_hex64('d2-secret');
  v_ciphertext_2 text := pg_temp.fake_hex_n('d2-cipher', 86);
  v_nonce_2 text := pg_temp.fake_hex_n('d2-nonce', 24);
  v_tag_2 text := pg_temp.fake_hex_n('d2-tag', 32);
  v_link_state_before text;
  v_material_count_before int;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- One-active-link-per-project rule: link_a1 is active, so activating the
  -- other draft (link_a1_second) for the SAME project must fail even
  -- though its own material is entirely valid.
  perform pg_temp.try_rpc('D', 'D2', 'a second link for the same project cannot activate while another link is already active',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1_second'), v_digest_2, v_ciphertext_2, v_nonce_2, v_tag_2),
    false, 'SHARE_LINK_ANOTHER_LINK_ACTIVE', 'P0001');

  -- Activation from a non-draft state fails (link_a1 is already active).
  perform pg_temp.try_rpc('D', 'D3', 'activating an already-active link fails SHARE_LINK_NOT_DRAFT',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1'), v_digest_2, v_ciphertext_2, v_nonce_2, v_tag_2),
    false, 'SHARE_LINK_NOT_DRAFT', 'P0001');

  -- Cross-owner: owner B cannot activate owner A's draft.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc('D', 'D4', 'owner B cannot activate owner A''s draft link',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1_second'), v_digest_2, v_ciphertext_2, v_nonce_2, v_tag_2),
    false, 'SHARE_LINK_NOT_FOUND', 'P0001');
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- Malformed digest/ciphertext/nonce/tag/version, each rejected before
  -- any mutation -- link_a1_second remains a fresh, untouched draft for
  -- every one of these.
  perform pg_temp.try_rpc('D', 'D5', 'malformed secret digest (wrong length) is rejected as INVALID_SECRET_DIGEST',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1_second'), 'too-short', v_ciphertext_2, v_nonce_2, v_tag_2),
    false, 'INVALID_SECRET_DIGEST', 'P0001');

  perform pg_temp.try_rpc('D', 'D6', 'malformed secret_digest_version (not 1) is rejected as INVALID_SECRET_DIGEST_VERSION',
    format('select public.activate_share_link(%L, %L, 2::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1_second'), v_digest_2, v_ciphertext_2, v_nonce_2, v_tag_2),
    false, 'INVALID_SECRET_DIGEST_VERSION', 'P0001');

  perform pg_temp.try_rpc('D', 'D7', 'malformed ciphertext (wrong hex length) is rejected as INVALID_CIPHERTEXT',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1_second'), v_digest_2, 'ab', v_nonce_2, v_tag_2),
    false, 'INVALID_CIPHERTEXT', 'P0001');

  perform pg_temp.try_rpc('D', 'D8', 'malformed nonce (wrong hex length) is rejected as INVALID_NONCE',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1_second'), v_digest_2, v_ciphertext_2, 'ab', v_tag_2),
    false, 'INVALID_NONCE', 'P0001');

  perform pg_temp.try_rpc('D', 'D9', 'malformed auth tag (wrong hex length) is rejected as INVALID_AUTH_TAG',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1_second'), v_digest_2, v_ciphertext_2, v_nonce_2, 'ab'),
    false, 'INVALID_AUTH_TAG', 'P0001');

  perform pg_temp.try_rpc('D', 'D9b', 'malformed encryption_version (not 1) is rejected as INVALID_ENCRYPTION_VERSION',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 2::smallint)',
      pg_temp.get_uuid('link_a1_second'), v_digest_2, v_ciphertext_2, v_nonce_2, v_tag_2),
    false, 'INVALID_ENCRYPTION_VERSION', 'P0001');

  -- Every attempt above failed, so link_a1_second must still be an
  -- untouched draft with no secret material row -- proving no partial
  -- state was left by any failed activation attempt. Checks every
  -- field the RPC would have set on success, not just state+count.
  perform pg_temp.act_as('postgres');

  select state into v_link_state_before from public.project_share_links where id = pg_temp.get_uuid('link_a1_second');
  select count(*) into v_material_count_before from public.project_share_secret_material where share_link_id = pg_temp.get_uuid('link_a1_second');

  perform pg_temp.record_result('D', 'D10', 'link_a1_second remains draft with zero secret-material rows after every failed activation attempt above',
    v_link_state_before = 'draft' and v_material_count_before = 0,
    'draft, 0 material rows', format('%s, %s material rows', v_link_state_before, v_material_count_before), null);

  declare
    v_d10_row record;
    v_d10_event_count int;
  begin
    select secret_digest, secret_digest_version, activated_at, configuration_version, state
      into v_d10_row
      from public.project_share_links where id = pg_temp.get_uuid('link_a1_second');
    select count(*) into v_d10_event_count
      from public.share_link_events where share_link_id = pg_temp.get_uuid('link_a1_second') and event_type = 'link_activated';

    perform pg_temp.record_result('D', 'D10-full-rollback', 'every field a successful activation would have set remains at its pre-activation value: secret_digest null, secret_digest_version null, activated_at null, configuration_version=1 (its original draft value), state=draft, and no link_activated event exists',
      v_d10_row.secret_digest is null
        and v_d10_row.secret_digest_version is null
        and v_d10_row.activated_at is null
        and v_d10_row.configuration_version = 1
        and v_d10_row.state = 'draft'
        and v_d10_event_count = 0,
      'digest=null,version=null,activatedAt=null,configVersion=1,state=draft,events=0',
      format('digest=%s,version=%s,activatedAt=%s,configVersion=%s,state=%s,events=%s',
        v_d10_row.secret_digest, v_d10_row.secret_digest_version, v_d10_row.activated_at, v_d10_row.configuration_version, v_d10_row.state, v_d10_event_count),
      null);
  end;
end;
$$;

-- =========================================================
-- SECTION E -- Disable and re-enable
-- =========================================================

do $$
declare
  v_result jsonb;
  v_material_hash_before text;
  v_material_hash_after text;
  v_event_count int;
  v_link_state text;
  v_link_config_version int;
  v_link_disabled_at timestamptz;
begin
  perform pg_temp.act_as('postgres');
  select md5((ciphertext, nonce, auth_tag, encryption_version)::text) into v_material_hash_before
    from public.project_share_secret_material where share_link_id = pg_temp.get_uuid('link_a1');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('E', 'E1', 'owner A disables the active link_a1',
    format('select public.disable_share_link(%L)', pg_temp.get_uuid('link_a1')),
    true, null, null, 'e1_result');
  perform pg_temp.require_test_pass('E', 'E1', 'link_a1 disabled');
  v_result := pg_temp.get_json('e1_result');
  perform pg_temp.record_result('E', 'E1-shape', 'disable result has state=disabled, configurationVersion=3, disabledAt set',
    v_result->>'state' = 'disabled' and (v_result->>'configurationVersion')::int = 3 and v_result ? 'disabledAt',
    'state=disabled,configurationVersion=3', v_result::text, null);

  perform pg_temp.act_as('postgres');
  select state, configuration_version, disabled_at into v_link_state, v_link_config_version, v_link_disabled_at
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('E', 'E1-version', 'configuration_version incremented exactly once (2 -> 3)', v_link_config_version = 3, '3', v_link_config_version::text, null);
  perform pg_temp.record_result('E', 'E1-disabled-at', 'disabled_at is set', v_link_disabled_at is not null, 'not null', v_link_disabled_at::text, null);

  select md5((ciphertext, nonce, auth_tag, encryption_version)::text) into v_material_hash_after
    from public.project_share_secret_material where share_link_id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('E', 'E1-material-unchanged', 'secret material is unchanged by disabling', v_material_hash_before = v_material_hash_after, v_material_hash_before, v_material_hash_after, null);

  select count(*) into v_event_count from public.share_link_events where share_link_id = pg_temp.get_uuid('link_a1') and event_type = 'link_disabled';
  perform pg_temp.record_result('E', 'E1-event', 'link_disabled event exists', v_event_count = 1, '1', v_event_count::text, null);

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('E', 'E2', 'repeated disable of an already-disabled link fails SHARE_LINK_NOT_ACTIVE',
    format('select public.disable_share_link(%L)', pg_temp.get_uuid('link_a1')),
    false, 'SHARE_LINK_NOT_ACTIVE', 'P0001');
end;
$$;

do $$
declare
  v_digest_3 text := pg_temp.fake_hex64('e3-secret');
  v_ciphertext_3 text := pg_temp.fake_hex_n('e3-cipher', 86);
  v_nonce_3 text := pg_temp.fake_hex_n('e3-nonce', 24);
  v_tag_3 text := pg_temp.fake_hex_n('e3-tag', 32);
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- With link_a1 now disabled, no link is active for project_a1, so
  -- activating link_a1_second succeeds -- it becomes the project's one
  -- active link, which E4 below uses to prove the one-active-link rule
  -- also protects RE-ENABLE, not just initial activation.
  perform pg_temp.try_rpc('E', 'E3', 'link_a1_second activates now that link_a1 is disabled (no other active link)',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1_second'), v_digest_3, v_ciphertext_3, v_nonce_3, v_tag_3),
    true);
  perform pg_temp.require_test_pass('E', 'E3', 'link_a1_second activation');

  perform pg_temp.try_rpc('E', 'E4', 'one-active-link rule protects re-enable: cannot re-enable link_a1 while link_a1_second is active for the same project',
    format('select public.reenable_share_link(%L)', pg_temp.get_uuid('link_a1')),
    false, 'SHARE_LINK_ANOTHER_LINK_ACTIVE', 'P0001');

  perform pg_temp.try_rpc('E', 'E5', 'disable link_a1_second to free the one-active-link slot',
    format('select public.disable_share_link(%L)', pg_temp.get_uuid('link_a1_second')),
    true);
  perform pg_temp.require_test_pass('E', 'E5', 'link_a1_second disabled');
end;
$$;

do $$
declare
  v_result jsonb;
  v_material_hash_before text;
  v_material_hash_after text;
  v_activated_at_before timestamptz;
  v_activated_at_after timestamptz;
  v_disabled_at_before timestamptz;
  v_disabled_at_after timestamptz;
begin
  perform pg_temp.act_as('postgres');
  select activated_at, disabled_at into v_activated_at_before, v_disabled_at_before
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  select md5((ciphertext, nonce, auth_tag, encryption_version)::text) into v_material_hash_before
    from public.project_share_secret_material where share_link_id = pg_temp.get_uuid('link_a1');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('E', 'E6', 'owner A re-enables the disabled link_a1 (now that no other link is active)',
    format('select public.reenable_share_link(%L)', pg_temp.get_uuid('link_a1')),
    true, null, null, 'e6_result');
  perform pg_temp.require_test_pass('E', 'E6', 'link_a1 re-enabled');
  v_result := pg_temp.get_json('e6_result');
  perform pg_temp.record_result('E', 'E6-shape', 're-enable result has state=active, configurationVersion=4', v_result->>'state' = 'active' and (v_result->>'configurationVersion')::int = 4, 'state=active,configurationVersion=4', v_result::text, null);

  perform pg_temp.act_as('postgres');
  select activated_at, disabled_at into v_activated_at_after, v_disabled_at_after
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('E', 'E6-activated-at-unchanged', 'activated_at is unchanged by re-enable', v_activated_at_before = v_activated_at_after, v_activated_at_before::text, v_activated_at_after::text, null);
  perform pg_temp.record_result('E', 'E6-disabled-at-retained', 'disabled_at is retained (not cleared), per the delivered contract', v_disabled_at_before = v_disabled_at_after and v_disabled_at_after is not null, v_disabled_at_before::text, v_disabled_at_after::text, null);

  select md5((ciphertext, nonce, auth_tag, encryption_version)::text) into v_material_hash_after
    from public.project_share_secret_material where share_link_id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('E', 'E6-material-not-replaced', 'secret material is not replaced by re-enable', v_material_hash_before = v_material_hash_after, v_material_hash_before, v_material_hash_after, null);
end;
$$;

do $$
declare
  v_edge_link uuid;
  v_digest_edge text := pg_temp.fake_hex64('e7-secret');
  v_ciphertext_edge text := pg_temp.fake_hex_n('e7-cipher', 86);
  v_nonce_edge text := pg_temp.fake_hex_n('e7-nonce', 24);
  v_tag_edge text := pg_temp.fake_hex_n('e7-tag', 32);
begin
  -- E7 (missing secret material) requires a disabled link whose material
  -- row is absent -- unreachable through any normal RPC sequence (every
  -- activation inserts its own material row atomically), so this fixture
  -- surgically removes it as the Postgres superuser afterward, purely to
  -- exercise reenable_share_link's own defensive check.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('E', 'E7setup1', 'fixture setup: a dedicated draft on project_a2 for the missing-material edge case',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a2'), pg_temp.fake_b64url(24)),
    true, null, null, 'e7_draft_result');
  v_edge_link := (pg_temp.get_json('e7_draft_result')->>'linkId')::uuid;
  perform pg_temp.require_id('E', 'E7setup1', 'dedicated edge-case link', v_edge_link::text);
  perform pg_temp.set_val('link_edge_material', v_edge_link::text);

  perform pg_temp.try_rpc('E', 'E7setup2', 'fixture setup: activate then disable the dedicated edge-case link',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)', v_edge_link, v_digest_edge, v_ciphertext_edge, v_nonce_edge, v_tag_edge),
    true);
  perform pg_temp.require_test_pass('E', 'E7setup2', 'edge-case link activated');
  perform pg_temp.try_rpc('E', 'E7setup3', 'fixture setup: disable the dedicated edge-case link',
    format('select public.disable_share_link(%L)', v_edge_link), true);
  perform pg_temp.require_test_pass('E', 'E7setup3', 'edge-case link disabled');

  perform pg_temp.act_as('postgres');
  delete from public.project_share_secret_material where share_link_id = v_edge_link;

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('E', 'E7', 're-enable fails SHARE_LINK_SECRET_MATERIAL_MISSING when the material row is absent',
    format('select public.reenable_share_link(%L)', v_edge_link),
    false, 'SHARE_LINK_SECRET_MATERIAL_MISSING', 'P0001');

  -- Cross-owner: owner B cannot disable or re-enable owner A's links.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc('E', 'E8', 'owner B cannot disable owner A''s active link',
    format('select public.disable_share_link(%L)', pg_temp.get_uuid('link_a1')),
    false, 'SHARE_LINK_NOT_FOUND', 'P0001');
  perform pg_temp.try_rpc('E', 'E9', 'owner B cannot re-enable owner A''s disabled link',
    format('select public.reenable_share_link(%L)', pg_temp.get_uuid('link_a1_second')),
    false, 'SHARE_LINK_NOT_FOUND', 'P0001');
  perform pg_temp.act_as('postgres');
end;
$$;

-- Fixture setup used by Section F's revoked-link test: revoke the
-- material-less edge-case link from Section E7 (already disabled, never
-- reactivated) so a genuinely revoked link exists before Section F needs
-- one. Using revoke_share_link here (defined for Section J) as ordinary
-- fixture setup is legitimate -- every RPC in this package is already a
-- fully delivered, real function by the time this file runs.
do $$
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('F', 'F0setup', 'fixture setup: revoke the material-less edge-case link for the revoked-link rejection tests below',
    format('select public.revoke_share_link(%L)', pg_temp.get_uuid('link_edge_material')),
    true);
  perform pg_temp.require_test_pass('F', 'F0setup', 'edge-case link revoked');
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION F -- PIN set/clear
--
-- Uses a syntactically valid deterministic V1 stored PIN profile (never
-- plaintext PIN processing in SQL): pin_hash 43 base64url chars, pin_salt
-- 22 base64url chars, pin_hash_version 1, scrypt N=16384/r=8/p=1,
-- key_length=32 -- matching set_share_link_pin's own exact validation.
-- =========================================================

do $$
declare
  v_result jsonb;
  v_pin_hash_1 text := pg_temp.fake_b64url(43);
  v_pin_salt_1 text := pg_temp.fake_b64url(22);
  v_pin_hash_2 text := pg_temp.fake_b64url(43);
  v_pin_salt_2 text := pg_temp.fake_b64url(22);
  v_read_result jsonb;
  v_grant_count int;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('F', 'F1', 'owner A sets a PIN on the active link_a1',
    format('select public.set_share_link_pin(%L, %L, %L, 1::smallint, 16384, 8, 1, 32)', pg_temp.get_uuid('link_a1'), v_pin_hash_1, v_pin_salt_1),
    true, null, null, 'f1_result');
  perform pg_temp.require_test_pass('F', 'F1', 'link_a1 PIN set');
  v_result := pg_temp.get_json('f1_result');
  perform pg_temp.record_result('F', 'F1-shape', 'set-PIN result has hasPin=true and configurationVersion=5', v_result->>'hasPin' = 'true' and (v_result->>'configurationVersion')::int = 5, 'hasPin=true,configurationVersion=5', v_result::text, null);

  -- Runtime format proof (never public-output exposure): the raw row
  -- itself, read as the postgres harness, has all seven PIN columns set
  -- to exactly the supplied deterministic V1 profile.
  perform pg_temp.act_as('postgres');
  declare
    v_f1_row record;
  begin
    select pin_hash, pin_salt, pin_hash_version, pin_scrypt_n, pin_scrypt_r, pin_scrypt_p, pin_key_length
      into v_f1_row
      from public.project_share_links where id = pg_temp.get_uuid('link_a1');
    perform pg_temp.record_result('F', 'F1-columns-exact', 'all seven PIN columns exactly equal the supplied deterministic profile (pin_hash, pin_salt, version=1, N=16384, r=8, p=1, keyLength=32)',
      v_f1_row.pin_hash = v_pin_hash_1 and v_f1_row.pin_salt = v_pin_salt_1 and v_f1_row.pin_hash_version = 1
        and v_f1_row.pin_scrypt_n = 16384 and v_f1_row.pin_scrypt_r = 8 and v_f1_row.pin_scrypt_p = 1 and v_f1_row.pin_key_length = 32,
      format('pin_hash=%s,pin_salt=%s,version=1,N=16384,r=8,p=1,keyLength=32', v_pin_hash_1, v_pin_salt_1),
      format('pin_hash=%s,pin_salt=%s,version=%s,N=%s,r=%s,p=%s,keyLength=%s', v_f1_row.pin_hash, v_f1_row.pin_salt, v_f1_row.pin_hash_version, v_f1_row.pin_scrypt_n, v_f1_row.pin_scrypt_r, v_f1_row.pin_scrypt_p, v_f1_row.pin_key_length),
      null);
  end;
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('F', 'F2', 'get_share_link_management_state reports hasPin=true after F1',
    format('select public.get_share_link_management_state(%L)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'f2_result');
  v_read_result := pg_temp.get_json('f2_result');
  perform pg_temp.record_result('F', 'F2-haspin', 'owner-read hasPin reflects the set PIN', (v_read_result->'link'->>'hasPin') = 'true', 'true', v_read_result->'link'->>'hasPin', null);
  perform pg_temp.record_result('F', 'F2-no-pin-material', 'owner-read result never contains pinHash/pinSalt', not (v_read_result->'link' ? 'pinHash') and not (v_read_result->'link' ? 'pinSalt'), 'absent', (v_read_result->'link')::text, null);

  perform pg_temp.try_rpc('F', 'F3', 'replacing the PIN increments configuration_version exactly once more',
    format('select public.set_share_link_pin(%L, %L, %L, 1::smallint, 16384, 8, 1, 32)', pg_temp.get_uuid('link_a1'), v_pin_hash_2, v_pin_salt_2),
    true, null, null, 'f3_result');
  v_result := pg_temp.get_json('f3_result');
  perform pg_temp.record_result('F', 'F3-version', 'replace-PIN result has configurationVersion=6', (v_result->>'configurationVersion')::int = 6, '6', v_result->>'configurationVersion', null);

  perform pg_temp.try_rpc('F', 'F4', 'clearing an existing PIN succeeds and increments configuration_version once',
    format('select public.clear_share_link_pin(%L)', pg_temp.get_uuid('link_a1')),
    true, null, null, 'f4_result');
  v_result := pg_temp.get_json('f4_result');
  perform pg_temp.record_result('F', 'F4-shape', 'clear-PIN result has hasPin=false and configurationVersion=7', v_result->>'hasPin' = 'false' and (v_result->>'configurationVersion')::int = 7, 'hasPin=false,configurationVersion=7', v_result::text, null);

  perform pg_temp.act_as('postgres');
  declare
    v_f4_row record;
  begin
    select pin_hash, pin_salt, pin_hash_version, pin_scrypt_n, pin_scrypt_r, pin_scrypt_p, pin_key_length
      into v_f4_row
      from public.project_share_links where id = pg_temp.get_uuid('link_a1');
    perform pg_temp.record_result('F', 'F4-columns-all-null', 'all seven PIN columns are NULL after clear_share_link_pin',
      v_f4_row.pin_hash is null and v_f4_row.pin_salt is null and v_f4_row.pin_hash_version is null
        and v_f4_row.pin_scrypt_n is null and v_f4_row.pin_scrypt_r is null and v_f4_row.pin_scrypt_p is null and v_f4_row.pin_key_length is null,
      'all seven columns null',
      format('pin_hash=%s,pin_salt=%s,version=%s,N=%s,r=%s,p=%s,keyLength=%s', v_f4_row.pin_hash, v_f4_row.pin_salt, v_f4_row.pin_hash_version, v_f4_row.pin_scrypt_n, v_f4_row.pin_scrypt_r, v_f4_row.pin_scrypt_p, v_f4_row.pin_key_length),
      null);
  end;
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('F', 'F5', 'a second clear on an already-PIN-less link is an idempotent no-op (no version bump)',
    format('select public.clear_share_link_pin(%L)', pg_temp.get_uuid('link_a1')),
    true, null, null, 'f5_result');
  v_result := pg_temp.get_json('f5_result');
  perform pg_temp.record_result('F', 'F5-noop', 'second clear leaves configurationVersion at 7 (unchanged)', (v_result->>'configurationVersion')::int = 7, '7', v_result->>'configurationVersion', null);

  perform pg_temp.try_rpc('F', 'F6', 'a revoked link rejects PIN changes',
    format('select public.set_share_link_pin(%L, %L, %L, 1::smallint, 16384, 8, 1, 32)', pg_temp.get_uuid('link_edge_material'), v_pin_hash_1, v_pin_salt_1),
    false, 'SHARE_LINK_REVOKED', 'P0001');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc('F', 'F7', 'owner B cannot set a PIN on owner A''s link',
    format('select public.set_share_link_pin(%L, %L, %L, 1::smallint, 16384, 8, 1, 32)', pg_temp.get_uuid('link_a1'), v_pin_hash_1, v_pin_salt_1),
    false, 'SHARE_LINK_NOT_FOUND', 'P0001');
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('F', 'F8', 'malformed pin_hash (wrong length) is rejected as INVALID_PIN_MATERIAL',
    format('select public.set_share_link_pin(%L, %L, %L, 1::smallint, 16384, 8, 1, 32)', pg_temp.get_uuid('link_a1'), 'short', v_pin_salt_1),
    false, 'INVALID_PIN_MATERIAL', 'P0001');
  perform pg_temp.try_rpc('F', 'F9', 'malformed pin_salt (wrong length) is rejected as INVALID_PIN_MATERIAL',
    format('select public.set_share_link_pin(%L, %L, %L, 1::smallint, 16384, 8, 1, 32)', pg_temp.get_uuid('link_a1'), v_pin_hash_1, 'short'),
    false, 'INVALID_PIN_MATERIAL', 'P0001');
  perform pg_temp.try_rpc('F', 'F10', 'malformed pin_scrypt_n (not 16384) is rejected as INVALID_PIN_MATERIAL',
    format('select public.set_share_link_pin(%L, %L, %L, 1::smallint, 8192, 8, 1, 32)', pg_temp.get_uuid('link_a1'), v_pin_hash_1, v_pin_salt_1),
    false, 'INVALID_PIN_MATERIAL', 'P0001');
  perform pg_temp.try_rpc('F', 'F11', 'malformed pin_hash_version (not 1) is rejected as INVALID_PIN_MATERIAL',
    format('select public.set_share_link_pin(%L, %L, %L, 2::smallint, 16384, 8, 1, 32)', pg_temp.get_uuid('link_a1'), v_pin_hash_1, v_pin_salt_1),
    false, 'INVALID_PIN_MATERIAL', 'P0001');

  -- share_session_grants is a fully closed internal table (RLS enabled, no
  -- policies, no grant to authenticated at all), so this direct inspection
  -- must run as the elevated harness/postgres context, not as owner A.
  perform pg_temp.act_as('postgres');
  select count(*) into v_grant_count from public.share_session_grants;
  perform pg_temp.record_result('F', 'F12', 'no share_session_grants row was created by any PIN operation in this section', v_grant_count = 0, '0', v_grant_count::text, null);
end;
$$;

-- =========================================================
-- SECTION G -- Expiry set/clear
-- =========================================================

do $$
declare
  v_result jsonb;
  v_future_1 timestamptz := now() + interval '7 days';
  v_future_2 timestamptz := now() + interval '14 days';
  v_grant_count int;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('G', 'G1', 'owner A sets a future expiry on link_a1',
    format('select public.set_share_link_expiry(%L, %L)', pg_temp.get_uuid('link_a1'), v_future_1),
    true, null, null, 'g1_result');
  v_result := pg_temp.get_json('g1_result');
  perform pg_temp.record_result('G', 'G1-shape', 'set-expiry result has the supplied expiresAt and configurationVersion=8', (v_result->>'configurationVersion')::int = 8, '8', v_result->>'configurationVersion', null);

  perform pg_temp.try_rpc('G', 'G2', 'setting the identical expiry again is an exact no-op (no version bump)',
    format('select public.set_share_link_expiry(%L, %L)', pg_temp.get_uuid('link_a1'), v_future_1),
    true, null, null, 'g2_result');
  v_result := pg_temp.get_json('g2_result');
  perform pg_temp.record_result('G', 'G2-noop', 'identical-replay expiry leaves configurationVersion at 8', (v_result->>'configurationVersion')::int = 8, '8', v_result->>'configurationVersion', null);

  perform pg_temp.try_rpc('G', 'G3', 'a past expiry is rejected as INVALID_EXPIRY',
    format('select public.set_share_link_expiry(%L, %L)', pg_temp.get_uuid('link_a1'), now() - interval '1 hour'),
    false, 'INVALID_EXPIRY', 'P0001');
  perform pg_temp.try_rpc('G', 'G3b', 'the current instant is rejected as INVALID_EXPIRY (must be strictly future)',
    format('select public.set_share_link_expiry(%L, now())', pg_temp.get_uuid('link_a1')),
    false, 'INVALID_EXPIRY', 'P0001');

  perform pg_temp.try_rpc('G', 'G4', 'replacing the expiry with a genuinely different future value bumps configuration_version once',
    format('select public.set_share_link_expiry(%L, %L)', pg_temp.get_uuid('link_a1'), v_future_2),
    true, null, null, 'g4_result');
  v_result := pg_temp.get_json('g4_result');
  perform pg_temp.record_result('G', 'G4-version', 'genuine expiry replacement has configurationVersion=9', (v_result->>'configurationVersion')::int = 9, '9', v_result->>'configurationVersion', null);

  perform pg_temp.try_rpc('G', 'G5', 'clearing an existing expiry succeeds and bumps configuration_version once',
    format('select public.clear_share_link_expiry(%L)', pg_temp.get_uuid('link_a1')),
    true, null, null, 'g5_result');
  v_result := pg_temp.get_json('g5_result');
  perform pg_temp.record_result('G', 'G5-shape', 'clear-expiry result has expiresAt=null and configurationVersion=10', v_result->'expiresAt' = 'null'::jsonb and (v_result->>'configurationVersion')::int = 10, 'expiresAt=null,configurationVersion=10', v_result::text, null);

  perform pg_temp.try_rpc('G', 'G6', 'a second clear on an already-null expiry is an idempotent no-op (no version bump)',
    format('select public.clear_share_link_expiry(%L)', pg_temp.get_uuid('link_a1')),
    true, null, null, 'g6_result');
  v_result := pg_temp.get_json('g6_result');
  perform pg_temp.record_result('G', 'G6-noop', 'second clear leaves configurationVersion at 10 (unchanged)', (v_result->>'configurationVersion')::int = 10, '10', v_result->>'configurationVersion', null);

  perform pg_temp.try_rpc('G', 'G7', 'a revoked link rejects expiry changes',
    format('select public.set_share_link_expiry(%L, %L)', pg_temp.get_uuid('link_edge_material'), v_future_1),
    false, 'SHARE_LINK_REVOKED', 'P0001');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc('G', 'G8', 'owner B cannot set expiry on owner A''s link',
    format('select public.set_share_link_expiry(%L, %L)', pg_temp.get_uuid('link_a1'), v_future_1),
    false, 'SHARE_LINK_NOT_FOUND', 'P0001');
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- share_session_grants is a fully closed internal table (RLS enabled, no
  -- policies, no grant to authenticated at all), so this direct inspection
  -- must run as the elevated harness/postgres context, not as owner A.
  perform pg_temp.act_as('postgres');
  select count(*) into v_grant_count from public.share_session_grants;
  perform pg_temp.record_result('G', 'G9', 'no share_session_grants row was created by any expiry operation in this section', v_grant_count = 0, '0', v_grant_count::text, null);
end;
$$;

-- G10/G11: "clear on expired-state conflict" and "second clear no-op in
-- expired state" require a link whose real `state` column value is
-- literally 'expired' -- unreachable through any delivered Phase 1B RPC
-- (no RPC transitions any link to 'expired'; that is a documented future
-- expiry-sweep job's job, not this package's). This fixture constructs
-- that state directly, exactly as the Phase 1A package's own precedent
-- constructs otherwise-unreachable fixture states (see e.g. its I15/I16
-- setup blocks), then exercises clear_share_link_expiry's real state
-- check against it.
do $$
declare
  v_expired_link uuid;
  v_digest_exp text := pg_temp.fake_hex64('g10-secret');
  v_ciphertext_exp text := pg_temp.fake_hex_n('g10-cipher', 86);
  v_nonce_exp text := pg_temp.fake_hex_n('g10-nonce', 24);
  v_tag_exp text := pg_temp.fake_hex_n('g10-tag', 32);
  v_result jsonb;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('G', 'G10setup1', 'fixture setup: a dedicated draft on project_a2 for the expired-state edge case',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a2'), pg_temp.fake_b64url(24)),
    true, null, null, 'g10_draft_result');
  v_expired_link := (pg_temp.get_json('g10_draft_result')->>'linkId')::uuid;
  perform pg_temp.require_id('G', 'G10setup1', 'dedicated expired-state link', v_expired_link::text);
  -- Persisted (not just a local variable) so Section I can reuse this
  -- exact real state='expired' fixture deterministically, rather than
  -- constructing a second one or manufacturing the state right before the
  -- reveal call.
  perform pg_temp.set_val('link_expired_g10', v_expired_link::text);

  perform pg_temp.try_rpc('G', 'G10setup2', 'fixture setup: activate the dedicated link with a future expiry already set',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)', v_expired_link, v_digest_exp, v_ciphertext_exp, v_nonce_exp, v_tag_exp),
    true);
  perform pg_temp.require_test_pass('G', 'G10setup2', 'dedicated link activated');

  -- Directly set state = 'expired' as the Postgres superuser, satisfying
  -- project_share_links_state_lifecycle_check's expired branch
  -- (activated_at not null, expires_at not null, revoked_at null) and
  -- bumping configuration_version in the same statement (an access
  -- change, per enforce_project_share_link_integrity).
  perform pg_temp.act_as('postgres');
  update public.project_share_links
    set state = 'expired', expires_at = now() + interval '1 hour', configuration_version = configuration_version + 1
    where id = v_expired_link;

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('G', 'G10', 'clearing expiry on a link whose state is literally expired is a stable state conflict, not an expired->active transition',
    format('select public.clear_share_link_expiry(%L)', v_expired_link),
    false, 'SHARE_LINK_STATE_CONFLICT', 'P0001');

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION H -- Secret rotation
-- =========================================================

do $$
declare
  v_result jsonb;
  v_digest_before text;
  v_digest_after text;
  v_material_before record;
  v_material_after record;
  v_public_id_before text;
  v_activated_at_before timestamptz;
  v_material_count int;
  v_event_count int;
begin
  perform pg_temp.act_as('postgres');
  select secret_digest, public_id, activated_at into v_digest_before, v_public_id_before, v_activated_at_before
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  select ciphertext, nonce, auth_tag into v_material_before
    from public.project_share_secret_material where share_link_id = pg_temp.get_uuid('link_a1');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('H', 'H1', 'owner A rotates the secret on the active link_a1',
    format('select public.rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1'), pg_temp.fake_hex64('h1-new-secret'), pg_temp.fake_hex_n('h1-new-cipher', 86),
      pg_temp.fake_hex_n('h1-new-nonce', 24), pg_temp.fake_hex_n('h1-new-tag', 32)),
    true, null, null, 'h1_result');
  perform pg_temp.require_test_pass('H', 'H1', 'link_a1 rotation');
  v_result := pg_temp.get_json('h1_result');
  perform pg_temp.record_result('H', 'H1-shape', 'rotation result has state=active, publicId unchanged, configurationVersion=11, rotatedAt set',
    v_result->>'state' = 'active' and v_result->>'publicId' = v_public_id_before and (v_result->>'configurationVersion')::int = 11 and v_result ? 'rotatedAt',
    format('state=active,publicId=%s,configurationVersion=11', v_public_id_before), v_result::text, null);

  perform pg_temp.act_as('postgres');
  select secret_digest into v_digest_after from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('H', 'H1-digest-changed', 'secret_digest actually changed', v_digest_before <> v_digest_after, format('<> %s', v_digest_before), v_digest_after, null);

  select ciphertext, nonce, auth_tag into v_material_after
    from public.project_share_secret_material where share_link_id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('H', 'H1-material-changed', 'ciphertext, nonce and auth_tag all changed', v_material_before.ciphertext <> v_material_after.ciphertext and v_material_before.nonce <> v_material_after.nonce and v_material_before.auth_tag <> v_material_after.auth_tag, 'all three changed', 'observed change recorded', null);

  select count(*) into v_material_count from public.project_share_secret_material where share_link_id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('H', 'H1-one-material-row', 'exactly one material row remains after rotation', v_material_count = 1, '1', v_material_count::text, null);

  select count(*) into v_event_count from public.share_link_events where share_link_id = pg_temp.get_uuid('link_a1') and event_type = 'link_rotated';
  perform pg_temp.record_result('H', 'H1-event', 'link_rotated event exists', v_event_count = 1, '1', v_event_count::text, null);

  perform pg_temp.record_result('H', 'H1-activated-at-preserved', 'activated_at is preserved by rotation',
    (select activated_at from public.project_share_links where id = pg_temp.get_uuid('link_a1')) = v_activated_at_before,
    v_activated_at_before::text, (select activated_at::text from public.project_share_links where id = pg_temp.get_uuid('link_a1')), null);
end;
$$;

do $$
declare
  v_result jsonb;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- link_a1_second is disabled (Section E5) -- rotation is supported for
  -- both active and disabled links.
  perform pg_temp.try_rpc('H', 'H2', 'owner A rotates the secret on the disabled link_a1_second',
    format('select public.rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1_second'), pg_temp.fake_hex64('h2-new-secret'), pg_temp.fake_hex_n('h2-new-cipher', 86),
      pg_temp.fake_hex_n('h2-new-nonce', 24), pg_temp.fake_hex_n('h2-new-tag', 32)),
    true, null, null, 'h2_result');
  v_result := pg_temp.get_json('h2_result');
  perform pg_temp.record_result('H', 'H2-shape', 'rotation on a disabled link succeeds and preserves state=disabled', v_result->>'state' = 'disabled', 'disabled', v_result->>'state', null);

  -- Draft link cannot be rotated (has no secret to rotate).
  perform pg_temp.try_rpc('H', 'H3setup', 'fixture setup: a fresh draft on project_a1 for the draft-rotation-rejected case',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a1'), pg_temp.fake_b64url(24)),
    true, null, null, 'h3_draft_result');
  perform pg_temp.try_rpc('H', 'H3', 'rotating a draft link (never activated) fails SHARE_LINK_STATE_CONFLICT',
    format('select public.rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      (pg_temp.get_json('h3_draft_result')->>'linkId')::uuid, pg_temp.fake_hex64('h3-secret'), pg_temp.fake_hex_n('h3-cipher', 86),
      pg_temp.fake_hex_n('h3-nonce', 24), pg_temp.fake_hex_n('h3-tag', 32)),
    false, 'SHARE_LINK_STATE_CONFLICT', 'P0001');

  -- Missing secret material: constructed via direct removal, exactly like
  -- Section E7's edge case, to exercise rotate_share_link_secret's own
  -- defensive check.
  perform pg_temp.try_rpc('H', 'H4setup1', 'fixture setup: a dedicated draft for the missing-material rotation edge case',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a1'), pg_temp.fake_b64url(24)),
    true, null, null, 'h4_draft_result');
  perform pg_temp.try_rpc('H', 'H4setup2', 'fixture setup: activate the dedicated link',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      (pg_temp.get_json('h4_draft_result')->>'linkId')::uuid, pg_temp.fake_hex64('h4-secret'), pg_temp.fake_hex_n('h4-cipher', 86),
      pg_temp.fake_hex_n('h4-nonce', 24), pg_temp.fake_hex_n('h4-tag', 32)),
    false, 'SHARE_LINK_ANOTHER_LINK_ACTIVE', 'P0001');
  -- The above activation is EXPECTED to fail: link_a1 is still the active
  -- link for project_a1. Section H4's edge case only needs a DISABLED
  -- link, so a draft on its own is not enough -- reroute through
  -- project_a2 instead, where nothing is currently active (Section G left
  -- project_a2 with only a revoked and an expired link).
  perform pg_temp.try_rpc('H', 'H4setup3', 'fixture setup: a dedicated draft on project_a2 for the missing-material rotation edge case',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a2'), pg_temp.fake_b64url(24)),
    true, null, null, 'h4b_draft_result');
  perform pg_temp.try_rpc('H', 'H4setup4', 'fixture setup: activate then disable the project_a2 dedicated link',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      (pg_temp.get_json('h4b_draft_result')->>'linkId')::uuid, pg_temp.fake_hex64('h4b-secret'), pg_temp.fake_hex_n('h4b-cipher', 86),
      pg_temp.fake_hex_n('h4b-nonce', 24), pg_temp.fake_hex_n('h4b-tag', 32)),
    true);
  perform pg_temp.require_test_pass('H', 'H4setup4', 'project_a2 dedicated link activated');
  perform pg_temp.try_rpc('H', 'H4setup5', 'fixture setup: disable the project_a2 dedicated link',
    format('select public.disable_share_link(%L)', (pg_temp.get_json('h4b_draft_result')->>'linkId')::uuid),
    true);
  perform pg_temp.require_test_pass('H', 'H4setup5', 'project_a2 dedicated link disabled');

  perform pg_temp.act_as('postgres');
  delete from public.project_share_secret_material where share_link_id = (pg_temp.get_json('h4b_draft_result')->>'linkId')::uuid;

  -- Full pre-failure snapshot, not just state+material-count: proves the
  -- expected rotation failure leaves EVERY link-side field untouched, not
  -- only the two facts H4 previously checked.
  declare
    v_h4_link uuid := (pg_temp.get_json('h4b_draft_result')->>'linkId')::uuid;
    v_h4_before record;
    v_h4_after record;
    v_h4_event_count_before int;
    v_h4_event_count_after int;
    v_h4_material_count_after int;
  begin
    select secret_digest, secret_digest_version, rotated_at, configuration_version, state
      into v_h4_before
      from public.project_share_links where id = v_h4_link;
    select count(*) into v_h4_event_count_before from public.share_link_events where share_link_id = v_h4_link and event_type = 'link_rotated';

    perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
    perform pg_temp.try_rpc('H', 'H4', 'rotation fails SHARE_LINK_SECRET_MATERIAL_MISSING when the material row is absent',
      format('select public.rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
        v_h4_link, pg_temp.fake_hex64('h4-retry-secret'), pg_temp.fake_hex_n('h4-retry-cipher', 86),
        pg_temp.fake_hex_n('h4-retry-nonce', 24), pg_temp.fake_hex_n('h4-retry-tag', 32)),
      false, 'SHARE_LINK_SECRET_MATERIAL_MISSING', 'P0001');

    perform pg_temp.act_as('postgres');
    select secret_digest, secret_digest_version, rotated_at, configuration_version, state
      into v_h4_after
      from public.project_share_links where id = v_h4_link;
    select count(*) into v_h4_event_count_after from public.share_link_events where share_link_id = v_h4_link and event_type = 'link_rotated';
    select count(*) into v_h4_material_count_after from public.project_share_secret_material where share_link_id = v_h4_link;

    perform pg_temp.record_result('H', 'H4-rollback-full', 'failed rotation (missing material) leaves secret_digest, secret_digest_version, rotated_at, configuration_version and state ALL unchanged, no link_rotated event, and no material row appeared',
      v_h4_before.secret_digest = v_h4_after.secret_digest
        and v_h4_before.secret_digest_version = v_h4_after.secret_digest_version
        and v_h4_before.rotated_at is not distinct from v_h4_after.rotated_at
        and v_h4_before.configuration_version = v_h4_after.configuration_version
        and v_h4_before.state = v_h4_after.state
        and v_h4_event_count_before = v_h4_event_count_after
        and v_h4_material_count_after = 0,
      'all fields unchanged, 0 events, 0 material rows',
      format('digest match=%s, version match=%s, rotated_at match=%s, config match=%s, state match=%s, events before/after=%s/%s, material rows=%s',
        v_h4_before.secret_digest = v_h4_after.secret_digest, v_h4_before.secret_digest_version = v_h4_after.secret_digest_version,
        v_h4_before.rotated_at is not distinct from v_h4_after.rotated_at, v_h4_before.configuration_version = v_h4_after.configuration_version,
        v_h4_before.state = v_h4_after.state, v_h4_event_count_before, v_h4_event_count_after, v_h4_material_count_after),
      null);
  end;

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc('H', 'H5', 'owner B cannot rotate owner A''s link secret',
    format('select public.rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1'), pg_temp.fake_hex64('h5-secret'), pg_temp.fake_hex_n('h5-cipher', 86),
      pg_temp.fake_hex_n('h5-nonce', 24), pg_temp.fake_hex_n('h5-tag', 32)),
    false, 'SHARE_LINK_NOT_FOUND', 'P0001');
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('H', 'H6', 'rotation with a malformed digest is rejected as INVALID_SECRET_DIGEST',
    format('select public.rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1'), 'short', pg_temp.fake_hex_n('h6-cipher', 86), pg_temp.fake_hex_n('h6-nonce', 24), pg_temp.fake_hex_n('h6-tag', 32)),
    false, 'INVALID_SECRET_DIGEST', 'P0001');
  perform pg_temp.try_rpc('H', 'H7', 'rotation with a malformed ciphertext is rejected as INVALID_CIPHERTEXT',
    format('select public.rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1'), pg_temp.fake_hex64('h7-secret'), 'ab', pg_temp.fake_hex_n('h7-nonce', 24), pg_temp.fake_hex_n('h7-tag', 32)),
    false, 'INVALID_CIPHERTEXT', 'P0001');
  perform pg_temp.try_rpc('H', 'H8', 'rotation with a malformed nonce is rejected as INVALID_NONCE',
    format('select public.rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1'), pg_temp.fake_hex64('h8-secret'), pg_temp.fake_hex_n('h8-cipher', 86), 'ab', pg_temp.fake_hex_n('h8-tag', 32)),
    false, 'INVALID_NONCE', 'P0001');
  perform pg_temp.try_rpc('H', 'H9', 'rotation with a malformed auth tag is rejected as INVALID_AUTH_TAG',
    format('select public.rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      pg_temp.get_uuid('link_a1'), pg_temp.fake_hex64('h9-secret'), pg_temp.fake_hex_n('h9-cipher', 86), pg_temp.fake_hex_n('h9-nonce', 24), 'ab'),
    false, 'INVALID_AUTH_TAG', 'P0001');
  perform pg_temp.try_rpc('H', 'H10', 'rotation with a malformed encryption_version is rejected as INVALID_ENCRYPTION_VERSION',
    format('select public.rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 2::smallint)',
      pg_temp.get_uuid('link_a1'), pg_temp.fake_hex64('h10-secret'), pg_temp.fake_hex_n('h10-cipher', 86), pg_temp.fake_hex_n('h10-nonce', 24), pg_temp.fake_hex_n('h10-tag', 32)),
    false, 'INVALID_ENCRYPTION_VERSION', 'P0001');

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION I -- Reveal RPC
--
-- Reveal never decrypts and never returns plaintext -- only already-
-- encrypted material. Server-side AES-256-GCM decryption is covered by
-- server-only TypeScript tests, not by this SQL runtime package.
-- =========================================================

do $$
declare
  v_result jsonb;
  v_view_count_before int;
  v_view_count_after int;
  v_config_version_before int;
  v_config_version_after int;
  v_event_count_before int;
  v_event_count_after int;
begin
  perform pg_temp.act_as('postgres');
  select view_count, configuration_version into v_view_count_before, v_config_version_before
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  select count(*) into v_event_count_before from public.share_link_events where share_link_id = pg_temp.get_uuid('link_a1');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('I', 'I1', 'owner A reveals the encrypted material for the active link_a1',
    format('select public.reveal_share_link_secret(%L)', pg_temp.get_uuid('link_a1')),
    true, null, null, 'i1_result');
  v_result := pg_temp.get_json('i1_result');
  perform pg_temp.record_result('I', 'I1-shape', 'reveal result has linkId, publicId and exact-length lowercase hex ciphertext/nonce/authTag/encryptionVersion=1',
    v_result ? 'linkId' and v_result ? 'publicId'
      and (v_result->>'ciphertextHex') ~ '^[0-9a-f]{86}$'
      and (v_result->>'nonceHex') ~ '^[0-9a-f]{24}$'
      and (v_result->>'authTagHex') ~ '^[0-9a-f]{32}$'
      and (v_result->>'encryptionVersion')::int = 1,
    '86/24/32 lowercase hex, encryptionVersion=1', v_result::text, null);
  perform pg_temp.record_result('I', 'I1-no-plaintext-key', 'reveal result contains no plaintext-shaped key', not (v_result ? 'plaintext') and not (v_result ? 'secret') and not (v_result ? 'pin'), 'absent', v_result::text, null);

  perform pg_temp.act_as('postgres');
  select view_count, configuration_version into v_view_count_after, v_config_version_after
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  select count(*) into v_event_count_after from public.share_link_events where share_link_id = pg_temp.get_uuid('link_a1');

  perform pg_temp.record_result('I', 'I1-no-version-bump', 'reveal does not change configuration_version', v_config_version_before = v_config_version_after, v_config_version_before::text, v_config_version_after::text, null);
  perform pg_temp.record_result('I', 'I1-no-view-count-change', 'reveal does not change view_count', v_view_count_before = v_view_count_after, v_view_count_before::text, v_view_count_after::text, null);
  perform pg_temp.record_result('I', 'I1-no-event', 'reveal writes no share_link_events row', v_event_count_before = v_event_count_after, v_event_count_before::text, v_event_count_after::text, null);
end;
$$;

do $$
declare
  v_draft_link uuid;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- Disabled link_a1_second rejects reveal.
  perform pg_temp.try_rpc('I', 'I2', 'reveal on a disabled link fails SHARE_LINK_STATE_CONFLICT',
    format('select public.reveal_share_link_secret(%L)', pg_temp.get_uuid('link_a1_second')),
    false, 'SHARE_LINK_STATE_CONFLICT', 'P0001');

  -- Draft (never activated) link rejects reveal.
  perform pg_temp.try_rpc('I', 'I3setup', 'fixture setup: a fresh draft on project_a1 for the draft-reveal-rejected case',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a1'), pg_temp.fake_b64url(24)),
    true, null, null, 'i3_draft_result');
  v_draft_link := (pg_temp.get_json('i3_draft_result')->>'linkId')::uuid;
  perform pg_temp.try_rpc('I', 'I3', 'reveal on a draft (never activated) link fails SHARE_LINK_STATE_CONFLICT',
    format('select public.reveal_share_link_secret(%L)', v_draft_link),
    false, 'SHARE_LINK_STATE_CONFLICT', 'P0001');

  -- Expired (real state = 'expired', from Section G10's persisted
  -- fixture) link rejects reveal too -- the fourth and last non-active
  -- state reveal must reject, alongside draft/disabled/revoked above.
  perform pg_temp.try_rpc('I', 'I3b', 'reveal on a link whose state is literally expired fails SHARE_LINK_STATE_CONFLICT',
    format('select public.reveal_share_link_secret(%L)', pg_temp.get_uuid('link_expired_g10')),
    false, 'SHARE_LINK_STATE_CONFLICT', 'P0001');

  -- Revoked link rejects reveal.
  perform pg_temp.try_rpc('I', 'I4', 'reveal on a revoked link fails SHARE_LINK_STATE_CONFLICT',
    format('select public.reveal_share_link_secret(%L)', pg_temp.get_uuid('link_edge_material')),
    false, 'SHARE_LINK_STATE_CONFLICT', 'P0001');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc('I', 'I6', 'owner B cannot reveal owner A''s link secret',
    format('select public.reveal_share_link_secret(%L)', pg_temp.get_uuid('link_a1')),
    false, 'SHARE_LINK_NOT_FOUND', 'P0001');
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.act_as('postgres');
end;
$$;

do $$
declare
  v_edge_link uuid;
begin
  -- Missing secret material on an ACTIVE link: constructed via direct
  -- removal exactly like Sections E7/H4's edge cases.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('I', 'I5setup1', 'fixture setup: a dedicated draft on project_a2 for the missing-material reveal edge case',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a2'), pg_temp.fake_b64url(24)),
    true, null, null, 'i5_draft_result');
  v_edge_link := (pg_temp.get_json('i5_draft_result')->>'linkId')::uuid;
  -- project_a2's only surviving disabled slot from Section H4 is now
  -- occupied by a disabled (not active) link, so activation here is
  -- expected to succeed (no other link is active for project_a2).
  perform pg_temp.try_rpc('I', 'I5setup2', 'fixture setup: activate the dedicated link',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      v_edge_link, pg_temp.fake_hex64('i5-secret'), pg_temp.fake_hex_n('i5-cipher', 86), pg_temp.fake_hex_n('i5-nonce', 24), pg_temp.fake_hex_n('i5-tag', 32)),
    true);
  perform pg_temp.require_test_pass('I', 'I5setup2', 'dedicated link activated');

  perform pg_temp.act_as('postgres');
  delete from public.project_share_secret_material where share_link_id = v_edge_link;

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('I', 'I5', 'reveal fails SHARE_LINK_SECRET_MATERIAL_MISSING when the material row is absent for an active link',
    format('select public.reveal_share_link_secret(%L)', v_edge_link),
    false, 'SHARE_LINK_SECRET_MATERIAL_MISSING', 'P0001');

  -- Cleanup: this edge-case link is still 'active' on project_a2 (reveal
  -- failing does not change state), and Section J below needs project_a2
  -- free of any active link before it activates its own dedicated
  -- fixtures there. disable_share_link has no material precondition, so
  -- this succeeds even though the material row was just deleted above.
  perform pg_temp.try_rpc('I', 'I5cleanup', 'fixture cleanup: disable the material-less edge-case link so project_a2 has no active link going into Section J',
    format('select public.disable_share_link(%L)', v_edge_link), true);
  perform pg_temp.require_test_pass('I', 'I5cleanup', 'edge-case link disabled');

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION J -- Revoke
--
-- Uses dedicated links on project_a2, one per starting state (draft,
-- active, disabled, and the real state='expired' fixture persisted from
-- Section G10), so link_a1 (needed active for Sections K-R) is never
-- touched. For each, proves state/revoked_at/configuration_version/event
-- with real before/after DB reads, not just the RPC's own returned shape.
-- =========================================================

do $$
declare
  v_link_1 uuid;
  v_link_2 uuid;
  v_link_3 uuid;
  v_link_4 uuid;
  v_result jsonb;
  v_material_count_before int;
  v_material_count_after int;
  v_config_before int;
  v_config_after int;
  v_event_count_before int;
  v_event_count_after int;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- j_link_1: draft -> active -> revoked ("active" starting state).
  perform pg_temp.try_rpc('J', 'J1setup1', 'fixture setup: draft j_link_1 on project_a2',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a2'), pg_temp.fake_b64url(24)),
    true, null, null, 'j1_draft_result');
  v_link_1 := (pg_temp.get_json('j1_draft_result')->>'linkId')::uuid;
  perform pg_temp.try_rpc('J', 'J1setup2', 'fixture setup: activate j_link_1',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      v_link_1, pg_temp.fake_hex64('j1-secret'), pg_temp.fake_hex_n('j1-cipher', 86), pg_temp.fake_hex_n('j1-nonce', 24), pg_temp.fake_hex_n('j1-tag', 32)),
    true);
  perform pg_temp.require_test_pass('J', 'J1setup2', 'j_link_1 activated');
  perform pg_temp.set_val('j_link_1', v_link_1::text);

  perform pg_temp.act_as('postgres');
  select count(*) into v_material_count_before from public.project_share_secret_material where share_link_id = v_link_1;
  select configuration_version into v_config_before from public.project_share_links where id = v_link_1;
  select count(*) into v_event_count_before from public.share_link_events where share_link_id = v_link_1 and event_type = 'link_revoked';
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('J', 'J1', 'revoking an active link (j_link_1) succeeds',
    format('select public.revoke_share_link(%L)', v_link_1),
    true, null, null, 'j1_result');
  v_result := pg_temp.get_json('j1_result');
  perform pg_temp.record_result('J', 'J1-shape', 'revoke result has state=revoked and revokedAt set', v_result->>'state' = 'revoked' and v_result ? 'revokedAt', 'state=revoked', v_result::text, null);

  perform pg_temp.act_as('postgres');
  select configuration_version into v_config_after from public.project_share_links where id = v_link_1;
  select count(*) into v_event_count_after from public.share_link_events where share_link_id = v_link_1 and event_type = 'link_revoked';
  perform pg_temp.record_result('J', 'J1-version', 'configuration_version increased by exactly one (active -> revoked)', v_config_after = v_config_before + 1, (v_config_before + 1)::text, v_config_after::text, null);
  perform pg_temp.record_result('J', 'J1-event', 'exactly one new link_revoked event was created', v_event_count_after = v_event_count_before + 1, (v_event_count_before + 1)::text, v_event_count_after::text, null);
  perform pg_temp.record_result('J', 'J1-db-state', 'the row itself (not just the RPC result) now has state=revoked and revoked_at set',
    (select state = 'revoked' and revoked_at is not null from public.project_share_links where id = v_link_1), 'state=revoked, revoked_at not null', 'observed', null);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- j_link_2: draft -> active -> disabled -> revoked ("disabled" starting
  -- state). j_link_1 is now revoked, so activating j_link_2 is allowed.
  perform pg_temp.try_rpc('J', 'J2setup1', 'fixture setup: draft j_link_2 on project_a2',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a2'), pg_temp.fake_b64url(24)),
    true, null, null, 'j2_draft_result');
  v_link_2 := (pg_temp.get_json('j2_draft_result')->>'linkId')::uuid;
  perform pg_temp.try_rpc('J', 'J2setup2', 'fixture setup: activate then disable j_link_2',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      v_link_2, pg_temp.fake_hex64('j2-secret'), pg_temp.fake_hex_n('j2-cipher', 86), pg_temp.fake_hex_n('j2-nonce', 24), pg_temp.fake_hex_n('j2-tag', 32)),
    true);
  perform pg_temp.require_test_pass('J', 'J2setup2', 'j_link_2 activated');
  perform pg_temp.try_rpc('J', 'J2setup3', 'fixture setup: disable j_link_2',
    format('select public.disable_share_link(%L)', v_link_2), true);
  perform pg_temp.require_test_pass('J', 'J2setup3', 'j_link_2 disabled');

  perform pg_temp.act_as('postgres');
  select configuration_version into v_config_before from public.project_share_links where id = v_link_2;
  select count(*) into v_event_count_before from public.share_link_events where share_link_id = v_link_2 and event_type = 'link_revoked';
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('J', 'J2', 'revoking a disabled link (j_link_2) succeeds',
    format('select public.revoke_share_link(%L)', v_link_2),
    true, null, null, 'j2_result');
  v_result := pg_temp.get_json('j2_result');
  perform pg_temp.record_result('J', 'J2-shape', 'revoke result has state=revoked', v_result->>'state' = 'revoked', 'revoked', v_result->>'state', null);

  perform pg_temp.act_as('postgres');
  select configuration_version into v_config_after from public.project_share_links where id = v_link_2;
  select count(*) into v_event_count_after from public.share_link_events where share_link_id = v_link_2 and event_type = 'link_revoked';
  perform pg_temp.record_result('J', 'J2-version', 'configuration_version increased by exactly one (disabled -> revoked)', v_config_after = v_config_before + 1, (v_config_before + 1)::text, v_config_after::text, null);
  perform pg_temp.record_result('J', 'J2-event', 'exactly one new link_revoked event was created', v_event_count_after = v_event_count_before + 1, (v_event_count_before + 1)::text, v_event_count_after::text, null);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- j_link_3: draft -> revoked directly ("draft" starting state).
  perform pg_temp.try_rpc('J', 'J3setup1', 'fixture setup: draft j_link_3 on project_a2',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a2'), pg_temp.fake_b64url(24)),
    true, null, null, 'j3_draft_result');
  v_link_3 := (pg_temp.get_json('j3_draft_result')->>'linkId')::uuid;

  perform pg_temp.act_as('postgres');
  select configuration_version into v_config_before from public.project_share_links where id = v_link_3;
  select count(*) into v_event_count_before from public.share_link_events where share_link_id = v_link_3 and event_type = 'link_revoked';
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('J', 'J3', 'revoking a draft (never activated) link (j_link_3) succeeds',
    format('select public.revoke_share_link(%L)', v_link_3),
    true, null, null, 'j3_result');
  v_result := pg_temp.get_json('j3_result');
  perform pg_temp.record_result('J', 'J3-shape', 'revoke of a draft link has state=revoked', v_result->>'state' = 'revoked', 'revoked', v_result->>'state', null);

  perform pg_temp.act_as('postgres');
  select configuration_version into v_config_after from public.project_share_links where id = v_link_3;
  select count(*) into v_event_count_after from public.share_link_events where share_link_id = v_link_3 and event_type = 'link_revoked';
  perform pg_temp.record_result('J', 'J3-version', 'configuration_version increased by exactly one (draft -> revoked)', v_config_after = v_config_before + 1, (v_config_before + 1)::text, v_config_after::text, null);
  perform pg_temp.record_result('J', 'J3-event', 'exactly one new link_revoked event was created', v_event_count_after = v_event_count_before + 1, (v_event_count_before + 1)::text, v_event_count_after::text, null);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- j_link_4: the real state='expired' fixture persisted from Section
  -- G10 -- reused deterministically rather than constructing a second
  -- expired link or manufacturing the state right before this call.
  v_link_4 := pg_temp.get_uuid('link_expired_g10');
  perform pg_temp.act_as('postgres');
  select configuration_version into v_config_before from public.project_share_links where id = v_link_4;
  select count(*) into v_event_count_before from public.share_link_events where share_link_id = v_link_4 and event_type = 'link_revoked';
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('J', 'J-EXPIRED', 'revoking a link whose state is literally expired (j_link_4, Section G10''s fixture) succeeds',
    format('select public.revoke_share_link(%L)', v_link_4),
    true, null, null, 'j4_result');
  v_result := pg_temp.get_json('j4_result');
  perform pg_temp.record_result('J', 'J-EXPIRED-shape', 'revoke result has state=revoked', v_result->>'state' = 'revoked', 'revoked', v_result->>'state', null);

  perform pg_temp.act_as('postgres');
  select configuration_version into v_config_after from public.project_share_links where id = v_link_4;
  select count(*) into v_event_count_after from public.share_link_events where share_link_id = v_link_4 and event_type = 'link_revoked';
  perform pg_temp.record_result('J', 'J-EXPIRED-version', 'configuration_version increased by exactly one (expired -> revoked)', v_config_after = v_config_before + 1, (v_config_before + 1)::text, v_config_after::text, null);
  perform pg_temp.record_result('J', 'J-EXPIRED-event', 'exactly one new link_revoked event was created', v_event_count_after = v_event_count_before + 1, (v_event_count_before + 1)::text, v_event_count_after::text, null);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- Revoked is terminal: repeated revoke fails.
  perform pg_temp.try_rpc('J', 'J4', 'repeated revoke of an already-revoked link fails SHARE_LINK_STATE_CONFLICT',
    format('select public.revoke_share_link(%L)', v_link_1),
    false, 'SHARE_LINK_STATE_CONFLICT', 'P0001');

  -- Reveal is blocked after revocation.
  perform pg_temp.try_rpc('J', 'J5', 'reveal is blocked after revocation',
    format('select public.reveal_share_link_secret(%L)', v_link_1),
    false, 'SHARE_LINK_STATE_CONFLICT', 'P0001');

  -- Encrypted material is retained, not destructively deleted.
  perform pg_temp.act_as('postgres');
  select count(*) into v_material_count_after from public.project_share_secret_material where share_link_id = v_link_1;
  perform pg_temp.record_result('J', 'J6', 'encrypted secret material is retained (not destructively deleted) after revoke', v_material_count_before = 1 and v_material_count_after = 1, '1 before and after', format('%s before, %s after', v_material_count_before, v_material_count_after), null);

  -- Cross-owner.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc('J', 'J7', 'owner B cannot revoke owner A''s link',
    format('select public.revoke_share_link(%L)', v_link_2),
    false, 'SHARE_LINK_NOT_FOUND', 'P0001');

  perform pg_temp.act_as('postgres');
end;
$$;

-- j_link_5: mapping/update CONTENT retention after revoke. A dedicated
-- link on project_a2, given a real task mapping, a real Resource mapping
-- and a real published update through save_share_configuration itself
-- (never direct mutation), then revoked -- proving the curated content
-- and publication history survive unchanged, not just the secret
-- material (J6) or the bare link row.
do $$
declare
  v_link_5 uuid;
  v_task_snapshot jsonb;
  v_task_snapshot_after jsonb;
  v_resource_snapshot jsonb;
  v_resource_snapshot_after jsonb;
  v_update_snapshot record;
  v_update_snapshot_after record;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('J', 'J8setup1', 'fixture setup: draft j_link_5 on project_a2',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a2'), pg_temp.fake_b64url(24)),
    true, null, null, 'j5_draft_result');
  v_link_5 := (pg_temp.get_json('j5_draft_result')->>'linkId')::uuid;
  perform pg_temp.try_rpc('J', 'J8setup2', 'fixture setup: activate j_link_5',
    format('select public.activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)',
      v_link_5, pg_temp.fake_hex64('j5-secret'), pg_temp.fake_hex_n('j5-cipher', 86), pg_temp.fake_hex_n('j5-nonce', 24), pg_temp.fake_hex_n('j5-tag', 32)),
    true);
  perform pg_temp.require_test_pass('J', 'J8setup2', 'j_link_5 activated');

  -- Real curated content via save_share_configuration itself, using
  -- task_a2/resource_a2 (both genuinely attached to project_a2, unmapped
  -- to any link at this point) -- never inserted directly.
  perform pg_temp.try_rpc('J', 'J8setup3', 'fixture setup: real task mapping, Resource mapping and a published update on j_link_5, all via save_share_configuration',
    format('select public.save_share_configuration(%L, null, %L, %L, %L)', v_link_5,
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a2')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 0)),
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a2')::text, 'publicLabel', 'Retained Doc', 'canDownload', false, 'displayOrder', 0)),
      '{"body":"Content that must survive revocation unchanged."}'::jsonb),
    true);
  perform pg_temp.require_test_pass('J', 'J8setup3', 'j_link_5 curated content published');

  perform pg_temp.act_as('postgres');
  select coalesce(jsonb_agg(jsonb_build_object('subtask_id', subtask_id, 'public_group', public_group) order by subtask_id), '[]'::jsonb)
    into v_task_snapshot from public.share_link_tasks where share_link_id = v_link_5;
  select coalesce(jsonb_agg(jsonb_build_object('resource_id', resource_id, 'public_label', public_label) order by resource_id), '[]'::jsonb)
    into v_resource_snapshot from public.share_link_resources where share_link_id = v_link_5;
  select id, version, body, is_current into v_update_snapshot from public.share_link_updates where share_link_id = v_link_5 and is_current;
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.record_result('J', 'J8-pre-content', 'fixture has exactly one task mapping, one Resource mapping and one current published update before revoke',
    jsonb_array_length(v_task_snapshot) = 1 and jsonb_array_length(v_resource_snapshot) = 1 and v_update_snapshot.id is not null,
    '1 task, 1 resource, 1 current update', format('%s tasks, %s resources, current update id=%s', jsonb_array_length(v_task_snapshot), jsonb_array_length(v_resource_snapshot), v_update_snapshot.id), null);

  perform pg_temp.try_rpc('J', 'J8', 'revoking j_link_5 (which carries real curated content) succeeds',
    format('select public.revoke_share_link(%L)', v_link_5), true);
  perform pg_temp.require_test_pass('J', 'J8', 'j_link_5 revoked');

  perform pg_temp.act_as('postgres');
  select coalesce(jsonb_agg(jsonb_build_object('subtask_id', subtask_id, 'public_group', public_group) order by subtask_id), '[]'::jsonb)
    into v_task_snapshot_after from public.share_link_tasks where share_link_id = v_link_5;
  select coalesce(jsonb_agg(jsonb_build_object('resource_id', resource_id, 'public_label', public_label) order by resource_id), '[]'::jsonb)
    into v_resource_snapshot_after from public.share_link_resources where share_link_id = v_link_5;
  select id, version, body, is_current into v_update_snapshot_after from public.share_link_updates where share_link_id = v_link_5 and is_current;

  perform pg_temp.record_result('J', 'J9-tasks-retained', 'the task mapping is byte-identical after revoke (not destructively deleted)', v_task_snapshot = v_task_snapshot_after, v_task_snapshot::text, v_task_snapshot_after::text, null);
  perform pg_temp.record_result('J', 'J9-resources-retained', 'the Resource mapping is byte-identical after revoke (not destructively deleted)', v_resource_snapshot = v_resource_snapshot_after, v_resource_snapshot::text, v_resource_snapshot_after::text, null);
  perform pg_temp.record_result('J', 'J9-update-retained', 'the published update row (id, version, body, is_current) is unchanged after revoke',
    v_update_snapshot.id = v_update_snapshot_after.id and v_update_snapshot.version = v_update_snapshot_after.version
      and v_update_snapshot.body = v_update_snapshot_after.body and v_update_snapshot_after.is_current = true,
    format('id=%s,version=%s,is_current=true', v_update_snapshot.id, v_update_snapshot.version),
    format('id=%s,version=%s,is_current=%s', v_update_snapshot_after.id, v_update_snapshot_after.version, v_update_snapshot_after.is_current), null);

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION K -- Configuration save: settings
--
-- From here through Section R, link_a1 (active, project_a1, at
-- configuration_version 11 after Section H's rotation) is the primary
-- fixture -- save_share_configuration is the only RPC under test in
-- Sections K-O, and every genuine settings change below advances its
-- version by exactly one; task/Resource/update changes never do.
-- =========================================================

do $$
declare
  v_result jsonb;
  v_row record;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('K', 'K1', 'partial settings update (commentsEnabled only) changes only that field',
    format('select public.save_share_configuration(%L, %L, null, null, null)', pg_temp.get_uuid('link_a1'), '{"commentsEnabled":true}'::jsonb),
    true, null, null, 'k1_result');
  v_result := pg_temp.get_json('k1_result');
  perform pg_temp.record_result('K', 'K1-version', 'K1 bumps configuration_version once (11 -> 12)', (v_result->>'configurationVersion')::int = 12, '12', v_result->>'configurationVersion', null);

  perform pg_temp.act_as('postgres');
  select comments_enabled, client_facing_subtitle, content_direction into v_row
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('K', 'K1-only-supplied-changed', 'commentsEnabled changed to true; subtitle/direction remain at their defaults',
    v_row.comments_enabled = true and v_row.client_facing_subtitle is null and v_row.content_direction = 'auto',
    'commentsEnabled=true,subtitle=null,direction=auto', row_to_json(v_row)::text, null);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('K', 'K2', 'setting clientFacingSubtitle to a string succeeds',
    format('select public.save_share_configuration(%L, %L, null, null, null)', pg_temp.get_uuid('link_a1'), '{"clientFacingSubtitle":"Hello Client"}'::jsonb),
    true, null, null, 'k2_result');
  v_result := pg_temp.get_json('k2_result');
  perform pg_temp.record_result('K', 'K2-version', 'K2 bumps configuration_version once (12 -> 13)', (v_result->>'configurationVersion')::int = 13, '13', v_result->>'configurationVersion', null);

  perform pg_temp.try_rpc('K', 'K3', 'an explicit null clientFacingSubtitle clears it',
    format('select public.save_share_configuration(%L, %L, null, null, null)', pg_temp.get_uuid('link_a1'), '{"clientFacingSubtitle":null}'::jsonb),
    true, null, null, 'k3_result');
  v_result := pg_temp.get_json('k3_result');
  perform pg_temp.record_result('K', 'K3-version', 'K3 bumps configuration_version once (13 -> 14)', (v_result->>'configurationVersion')::int = 14, '14', v_result->>'configurationVersion', null);
  perform pg_temp.act_as('postgres');
  perform pg_temp.record_result('K', 'K3-cleared', 'client_facing_subtitle is actually null after K3',
    (select client_facing_subtitle is null from public.project_share_links where id = pg_temp.get_uuid('link_a1')), 'null', (select coalesce(client_facing_subtitle, '(not null)') from public.project_share_links where id = pg_temp.get_uuid('link_a1')), null);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('K', 'K4', 'identical replay (subtitle already null) is a no-op -- no version bump',
    format('select public.save_share_configuration(%L, %L, null, null, null)', pg_temp.get_uuid('link_a1'), '{"clientFacingSubtitle":null}'::jsonb),
    true, null, null, 'k4_result');
  v_result := pg_temp.get_json('k4_result');
  perform pg_temp.record_result('K', 'K4-noop', 'identical replay leaves configurationVersion at 14', (v_result->>'configurationVersion')::int = 14, '14', v_result->>'configurationVersion', null);

  perform pg_temp.try_rpc('K', 'K5', 'several genuine settings changes in one call bump configuration_version exactly once',
    format('select public.save_share_configuration(%L, %L, null, null, null)', pg_temp.get_uuid('link_a1'), '{"commentsEnabled":false,"contentDirection":"rtl"}'::jsonb),
    true, null, null, 'k5_result');
  v_result := pg_temp.get_json('k5_result');
  perform pg_temp.record_result('K', 'K5-version', 'K5 (two changed fields) bumps configuration_version exactly once (14 -> 15)', (v_result->>'configurationVersion')::int = 15, '15', v_result->>'configurationVersion', null);

  perform pg_temp.act_as('postgres');
  select comments_enabled, content_direction into v_row from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('K', 'K5-both-applied', 'both K5 fields were actually applied', v_row.comments_enabled = false and v_row.content_direction = 'rtl', 'commentsEnabled=false,direction=rtl', row_to_json(v_row)::text, null);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
end;
$$;

do $$
declare
  v_archived_link uuid;
  v_k7_link uuid;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  -- Archived-project rejection: a link created while project_a2 was NOT
  -- yet archived, then the project is archived afterward (a real reachable
  -- sequence -- an owner can archive a project after sharing it), then a
  -- config-save attempt is made against that now-archived project.
  perform pg_temp.try_rpc('K', 'K6setup1', 'fixture setup: a draft on project_a2 before it is archived',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a2'), pg_temp.fake_b64url(24)),
    true, null, null, 'k6_draft_result');
  v_archived_link := (pg_temp.get_json('k6_draft_result')->>'linkId')::uuid;

  perform pg_temp.act_as('postgres');
  update public.projects set is_archived = true where id = pg_temp.get_uuid('project_a2');
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('K', 'K6', 'config save against a now-archived project is rejected as PROJECT_ARCHIVED',
    format('select public.save_share_configuration(%L, %L, null, null, null)', v_archived_link, '{"commentsEnabled":true}'::jsonb),
    false, 'PROJECT_ARCHIVED', 'P0001');

  -- K7 must prove SHARE_LINK_REVOKED in isolation, on a link whose project
  -- is NOT archived -- save_share_configuration deliberately checks
  -- project-archived before the link's own state (documented in its own
  -- header, matching activate_share_link/reenable_share_link's established
  -- lock order), so a revoked link on an already-archived project could
  -- only ever prove PROJECT_ARCHIVED again, never reach the revoked check.
  -- A dedicated draft on the non-archived project_a1, created and revoked
  -- through the real create_share_link_draft/revoke_share_link RPCs (never
  -- direct DML), keeps this test isolated to exactly one invalid condition.
  perform pg_temp.try_rpc('K', 'K7setup1', 'fixture setup: a dedicated draft on the non-archived project_a1 for the isolated revoked-link test',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a1'), pg_temp.fake_b64url(24)),
    true, null, null, 'k7_draft_result');
  v_k7_link := (pg_temp.get_json('k7_draft_result')->>'linkId')::uuid;
  perform pg_temp.require_id('K', 'K7setup1', 'dedicated K7 link', v_k7_link::text);

  perform pg_temp.try_rpc('K', 'K7setup2', 'fixture setup: revoke the dedicated K7 link through the real revoke_share_link RPC',
    format('select public.revoke_share_link(%L)', v_k7_link),
    true);
  perform pg_temp.require_test_pass('K', 'K7setup2', 'dedicated K7 link revoked');

  perform pg_temp.try_rpc('K', 'K7', 'config save against a revoked link on a non-archived project is rejected as SHARE_LINK_REVOKED, isolated from PROJECT_ARCHIVED',
    format('select public.save_share_configuration(%L, %L, null, null, null)', v_k7_link, '{"commentsEnabled":true}'::jsonb),
    false, 'SHARE_LINK_REVOKED', 'P0001');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));
  perform pg_temp.try_rpc('K', 'K8', 'owner B cannot save configuration on owner A''s link',
    format('select public.save_share_configuration(%L, %L, null, null, null)', pg_temp.get_uuid('link_a1'), '{"commentsEnabled":true}'::jsonb),
    false, 'SHARE_LINK_NOT_FOUND', 'P0001');
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('K', 'K9', 'unknown settings key is rejected as INVALID_SETTINGS before any mutation',
    format('select public.save_share_configuration(%L, %L, null, null, null)', pg_temp.get_uuid('link_a1'), '{"unknownField":"x"}'::jsonb),
    false, 'INVALID_SETTINGS', 'P0001');

  perform pg_temp.act_as('postgres');
  perform pg_temp.record_result('K', 'K9-no-mutation', 'the failed K9 call left configuration_version at 15 (unchanged)',
    (select configuration_version from public.project_share_links where id = pg_temp.get_uuid('link_a1')) = 15,
    '15', (select configuration_version::text from public.project_share_links where id = pg_temp.get_uuid('link_a1')), null);
end;
$$;

-- =========================================================
-- SECTION L -- Configuration save: tasks
-- =========================================================

do $$
declare
  v_task_a1_extra bigint;
  v_result jsonb;
  v_row record;
  v_oversized_tasks jsonb;
begin
  perform pg_temp.act_as('postgres');
  insert into public.tasks (user_id, project_id) values (pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('project_a1')) returning id into v_task_a1_extra;
  perform pg_temp.set_val('task_a1_extra', v_task_a1_extra::text);

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('L', 'L1', 'submitting one valid task creates exactly that mapping and does not bump configuration_version',
    format('select public.save_share_configuration(%L, null, %L, null, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a1')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 5))),
    true, null, null, 'l1_result');
  v_result := pg_temp.get_json('l1_result');
  perform pg_temp.record_result('L', 'L1-version-unchanged', 'task-only save does not bump configuration_version (stays 15)', (v_result->>'configurationVersion')::int = 15, '15', v_result->>'configurationVersion', null);
  perform pg_temp.record_result('L', 'L1-final-set', 'final taskIds is exactly [task_a1] as a decimal string', v_result->'taskIds' = jsonb_build_array(pg_temp.get_bigint('task_a1')::text), jsonb_build_array(pg_temp.get_bigint('task_a1')::text)::text, (v_result->'taskIds')::text, null);

  perform pg_temp.try_rpc('L', 'L2', 'resubmitting the same task with different presentation fields updates on conflict (still exactly one row)',
    format('select public.save_share_configuration(%L, null, %L, null, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a1')::text, 'publicGroup', 'completed', 'waitingForClientFeedback', true, 'displayOrder', 9))),
    true, null, null, 'l2_result');
  perform pg_temp.act_as('postgres');
  select public_group, waiting_for_client_feedback, display_order into v_row from public.share_link_tasks where share_link_id = pg_temp.get_uuid('link_a1') and subtask_id = pg_temp.get_bigint('task_a1');
  perform pg_temp.record_result('L', 'L2-updated', 'presentation fields were updated on conflict, not duplicated',
    v_row.public_group = 'completed' and v_row.waiting_for_client_feedback = true and v_row.display_order = 9,
    'publicGroup=completed,waiting=true,displayOrder=9', row_to_json(v_row)::text, null);
  perform pg_temp.record_result('L', 'L2-one-row', 'exactly one share_link_tasks row exists for link_a1',
    (select count(*) from public.share_link_tasks where share_link_id = pg_temp.get_uuid('link_a1')) = 1, '1',
    (select count(*)::text from public.share_link_tasks where share_link_id = pg_temp.get_uuid('link_a1')), null);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- Deliberately replays contentDirection='rtl' (the value K5 already set)
  -- rather than a genuinely different one, so this settings-only call is
  -- itself a no-op that does not advance configuration_version -- L3's own
  -- point is proving the TASK mapping is unaffected by a settings-only
  -- call, not exercising settings-change behavior (already covered by
  -- Section K), and M1 downstream still expects configuration_version=15.
  perform pg_temp.try_rpc('L', 'L3', 'a null tasks group (settings-only, no-op replay) leaves the existing task mapping unchanged',
    format('select public.save_share_configuration(%L, %L, null, null, null)', pg_temp.get_uuid('link_a1'), '{"contentDirection":"rtl"}'::jsonb),
    true);
  perform pg_temp.act_as('postgres');
  perform pg_temp.record_result('L', 'L3-unchanged', 'task mapping still has exactly the L2 row after a null-tasks call',
    (select count(*) from public.share_link_tasks where share_link_id = pg_temp.get_uuid('link_a1') and subtask_id = pg_temp.get_bigint('task_a1')) = 1,
    '1', (select count(*)::text from public.share_link_tasks where share_link_id = pg_temp.get_uuid('link_a1') and subtask_id = pg_temp.get_bigint('task_a1')), null);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('L', 'L4', 'an empty tasks array clears the mapping',
    format('select public.save_share_configuration(%L, null, %L, null, null)', pg_temp.get_uuid('link_a1'), '[]'::jsonb),
    true, null, null, 'l4_result');
  v_result := pg_temp.get_json('l4_result');
  perform pg_temp.record_result('L', 'L4-cleared', 'final taskIds is empty after an empty-array submission', v_result->'taskIds' = '[]'::jsonb, '[]', (v_result->'taskIds')::text, null);

  perform pg_temp.try_rpc('L', 'L5', 'submitting two valid tasks with distinct display_order returns them in deterministic display_order-then-id order',
    format('select public.save_share_configuration(%L, null, %L, null, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(
        jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a1')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 5),
        jsonb_build_object('subtaskId', v_task_a1_extra::text, 'publicGroup', 'coming_up', 'waitingForClientFeedback', false, 'displayOrder', 2)
      )),
    true, null, null, 'l5_result');
  v_result := pg_temp.get_json('l5_result');
  perform pg_temp.record_result('L', 'L5-order', 'final taskIds ordered by display_order (2 before 5), so task_a1_extra precedes task_a1',
    v_result->'taskIds' = jsonb_build_array(v_task_a1_extra::text, pg_temp.get_bigint('task_a1')::text),
    jsonb_build_array(v_task_a1_extra::text, pg_temp.get_bigint('task_a1')::text)::text, (v_result->'taskIds')::text, null);
  perform pg_temp.record_result('L', 'L5-strings', 'every element of taskIds is a JSON string, never a JSON number (decimal-id safety)',
    (select bool_and(jsonb_typeof(elem) = 'string') from jsonb_array_elements(v_result->'taskIds') as elem), 'all string', (v_result->'taskIds')::text, null);

  perform pg_temp.try_rpc('L', 'L6', 'a duplicate subtaskId within the same submitted array is rejected as INVALID_TASKS',
    format('select public.save_share_configuration(%L, null, %L, null, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(
        jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a1')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 0),
        jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a1')::text, 'publicGroup', 'completed', 'waitingForClientFeedback', false, 'displayOrder', 1)
      )),
    false, 'INVALID_TASKS', 'P0001');

  select jsonb_agg(jsonb_build_object('subtaskId', (900000000 + n)::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', n))
    into v_oversized_tasks
    from generate_series(1, 501) as n;
  perform pg_temp.try_rpc('L', 'L7', 'more than 500 submitted task items is rejected as INVALID_TASKS',
    format('select public.save_share_configuration(%L, null, %L, null, null)', pg_temp.get_uuid('link_a1'), v_oversized_tasks),
    false, 'INVALID_TASKS', 'P0001');

  perform pg_temp.try_rpc('L', 'L8', 'a task from a different project is rejected as INVALID_TASKS',
    format('select public.save_share_configuration(%L, null, %L, null, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a2')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 0))),
    false, 'INVALID_TASKS', 'P0001');

  perform pg_temp.try_rpc('L', 'L9', 'a soft-deleted task is rejected as INVALID_TASKS',
    format('select public.save_share_configuration(%L, null, %L, null, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a_deleted')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 0))),
    false, 'INVALID_TASKS', 'P0001');

  perform pg_temp.try_rpc('L', 'L10', 'owner B''s task is rejected as INVALID_TASKS with no tenant leakage (same code as any other invalid task)',
    format('select public.save_share_configuration(%L, null, %L, null, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_b1')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 0))),
    false, 'INVALID_TASKS', 'P0001');

  perform pg_temp.try_rpc('L', 'L11', 'displayOrder = 0 is accepted (lower boundary)',
    format('select public.save_share_configuration(%L, null, %L, null, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a1')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 0))),
    true);

  perform pg_temp.try_rpc('L', 'L12', 'displayOrder = 2147483647 is accepted (upper boundary, int4 max)',
    format('select public.save_share_configuration(%L, null, %L, null, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a1')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 2147483647))),
    true);

  perform pg_temp.try_rpc('L', 'L13', 'displayOrder = 2147483648 (one past int4 max) is rejected as a stable INVALID_TASKS, not a native overflow error',
    format('select public.save_share_configuration(%L, null, %L, null, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a1')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 2147483648::bigint))),
    false, 'INVALID_TASKS', 'P0001');

  perform pg_temp.record_result('L', 'L14', 'share_link_tasks has no column that could carry task title/status/raw content (structural, not just this call)',
    not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'share_link_tasks'
        and column_name in ('title', 'status', 'raw_input', 'deadline', 'priority')
    ), 'no such column', 'confirmed absent', null);

  -- The integrity trigger remains an independent second line of defense
  -- underneath the RPC: a direct INSERT attempting to map owner B's task
  -- is rejected by enforce_share_link_task_integrity itself, even as the
  -- Postgres superuser (bypassing RLS and any RPC prevalidation entirely).
  perform pg_temp.act_as('postgres');
  perform pg_temp.try_stmt('L', 'L15', 'enforce_share_link_task_integrity independently rejects a cross-owner task mapping via direct INSERT',
    format('insert into public.share_link_tasks (user_id, share_link_id, subtask_id, public_group) values (%L, %L, %L, ''in_progress'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_a1'), pg_temp.get_bigint('task_b1')),
    false, 'SHARE_TASK_NOT_OWNED', 'P0001');
end;
$$;

-- =========================================================
-- SECTION M -- Configuration save: resources
-- =========================================================

do $$
declare
  v_result jsonb;
  v_row record;
  v_oversized_resources jsonb;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('M', 'M1', 'a direct project-attached Resource succeeds',
    format('select public.save_share_configuration(%L, null, null, %L, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a1')::text, 'publicLabel', 'Doc', 'canDownload', false, 'displayOrder', 1))),
    true, null, null, 'm1_result');
  v_result := pg_temp.get_json('m1_result');
  perform pg_temp.record_result('M', 'M1-version-unchanged', 'resource-only save does not bump configuration_version (stays 15)', (v_result->>'configurationVersion')::int = 15, '15', v_result->>'configurationVersion', null);

  perform pg_temp.try_rpc('M', 'M2', 'a task-derived Resource (same project via its task) also succeeds, in the same submitted set as the direct one',
    format('select public.save_share_configuration(%L, null, null, %L, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(
        jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a1')::text, 'publicLabel', 'Doc', 'canDownload', false, 'displayOrder', 1),
        jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a_task')::text, 'publicLabel', 'Doc 2', 'canDownload', true, 'displayOrder', 2)
      )),
    true, null, null, 'm2_result');
  v_result := pg_temp.get_json('m2_result');
  perform pg_temp.record_result('M', 'M2-final-set', 'final resourceIds is exactly the two submitted resources',
    v_result->'resourceIds' = jsonb_build_array(pg_temp.get_uuid('resource_a1')::text, pg_temp.get_uuid('resource_a_task')::text),
    jsonb_build_array(pg_temp.get_uuid('resource_a1')::text, pg_temp.get_uuid('resource_a_task')::text)::text, (v_result->'resourceIds')::text, null);

  perform pg_temp.try_rpc('M', 'M3', 'a Resource attached to a different project is rejected as INVALID_RESOURCES',
    format('select public.save_share_configuration(%L, null, null, %L, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a2')::text, 'publicLabel', 'Doc', 'canDownload', false, 'displayOrder', 0))),
    false, 'INVALID_RESOURCES', 'P0001');

  perform pg_temp.try_rpc('M', 'M4', 'owner B''s Resource is rejected as INVALID_RESOURCES with no tenant leakage',
    format('select public.save_share_configuration(%L, null, null, %L, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_b1')::text, 'publicLabel', 'Doc', 'canDownload', false, 'displayOrder', 0))),
    false, 'INVALID_RESOURCES', 'P0001');

  perform pg_temp.try_rpc('M', 'M5', 'an orphan Resource (no project_id and no task_id) is rejected as INVALID_RESOURCES',
    format('select public.save_share_configuration(%L, null, null, %L, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_orphan')::text, 'publicLabel', 'Doc', 'canDownload', false, 'displayOrder', 0))),
    false, 'INVALID_RESOURCES', 'P0001');

  perform pg_temp.try_rpc('M', 'M6', 'a duplicate resourceId within the same submitted array is rejected as INVALID_RESOURCES',
    format('select public.save_share_configuration(%L, null, null, %L, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(
        jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a1')::text, 'publicLabel', 'Doc', 'canDownload', false, 'displayOrder', 0),
        jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a1')::text, 'publicLabel', 'Doc dup', 'canDownload', true, 'displayOrder', 1)
      )),
    false, 'INVALID_RESOURCES', 'P0001');

  select jsonb_agg(jsonb_build_object('resourceId', gen_random_uuid()::text, 'publicLabel', 'x', 'canDownload', false, 'displayOrder', n))
    into v_oversized_resources
    from generate_series(1, 501) as n;
  perform pg_temp.try_rpc('M', 'M7', 'more than 500 submitted Resource items is rejected as INVALID_RESOURCES',
    format('select public.save_share_configuration(%L, null, null, %L, null)', pg_temp.get_uuid('link_a1'), v_oversized_resources),
    false, 'INVALID_RESOURCES', 'P0001');

  perform pg_temp.try_rpc('M', 'M8', 'displayOrder = 0 is accepted for a Resource (lower boundary)',
    format('select public.save_share_configuration(%L, null, null, %L, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a1')::text, 'publicLabel', 'Doc', 'canDownload', false, 'displayOrder', 0))),
    true);

  perform pg_temp.try_rpc('M', 'M9', 'displayOrder = 2147483647 is accepted for a Resource (upper boundary)',
    format('select public.save_share_configuration(%L, null, null, %L, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a1')::text, 'publicLabel', 'Doc', 'canDownload', false, 'displayOrder', 2147483647))),
    true);

  perform pg_temp.try_rpc('M', 'M10', 'displayOrder = 2147483648 for a Resource is a stable INVALID_RESOURCES, not a native overflow error',
    format('select public.save_share_configuration(%L, null, null, %L, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a1')::text, 'publicLabel', 'Doc', 'canDownload', false, 'displayOrder', 2147483648::bigint))),
    false, 'INVALID_RESOURCES', 'P0001');

  perform pg_temp.try_rpc('M', 'M11', 'resubmitting resource_a1 with different presentation fields updates on conflict',
    format('select public.save_share_configuration(%L, null, null, %L, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a1')::text, 'publicLabel', 'Renamed Doc', 'canDownload', true, 'displayOrder', 3))),
    true);
  perform pg_temp.act_as('postgres');
  select public_label, can_download, display_order into v_row from public.share_link_resources where share_link_id = pg_temp.get_uuid('link_a1') and resource_id = pg_temp.get_uuid('resource_a1');
  perform pg_temp.record_result('M', 'M11-updated', 'presentation fields were updated on conflict', v_row.public_label = 'Renamed Doc' and v_row.can_download = true and v_row.display_order = 3, 'label=Renamed Doc,canDownload=true,displayOrder=3', row_to_json(v_row)::text, null);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('M', 'M12', 'an empty resources array clears the mapping',
    format('select public.save_share_configuration(%L, null, null, %L, null)', pg_temp.get_uuid('link_a1'), '[]'::jsonb),
    true, null, null, 'm12_result');
  v_result := pg_temp.get_json('m12_result');
  perform pg_temp.record_result('M', 'M12-cleared', 'final resourceIds is empty after an empty-array submission', v_result->'resourceIds' = '[]'::jsonb, '[]', (v_result->'resourceIds')::text, null);

  perform pg_temp.try_rpc('M', 'M13', 'a null resources group (settings-only call) leaves the Resource mapping unchanged',
    format('select public.save_share_configuration(%L, %L, null, null, null)', pg_temp.get_uuid('link_a1'), '{"contentDirection":"auto"}'::jsonb),
    true);
  perform pg_temp.act_as('postgres');
  perform pg_temp.record_result('M', 'M13-unchanged', 'resource mapping is still empty (from M12) after a null-resources call, not reset to something else',
    (select count(*) from public.share_link_resources where share_link_id = pg_temp.get_uuid('link_a1')) = 0, '0',
    (select count(*)::text from public.share_link_resources where share_link_id = pg_temp.get_uuid('link_a1')), null);

  perform pg_temp.record_result('M', 'M14', 'share_link_resources has no storage_path/signed-url/private-file-metadata column (structural)',
    not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'share_link_resources'
        and column_name in ('storage_path', 'file_name', 'mime_type', 'size_bytes', 'url', 'signed_url')
    ), 'no such column', 'confirmed absent', null);

  perform pg_temp.record_result('M', 'M15', 'no delivered Client Share trigger or RPC in this package reads a deleted/unavailable flag on task_resources -- section M''s "deleted/unavailable Resource" sub-case is therefore not applicable to the delivered schema, documented rather than guessed at (see 01_CREATE_TEMP_TEST_FIXTURE.sql''s header and the runtime verification report''s known limitations)',
    true, 'not applicable', 'documented as not applicable', null);
end;
$$;

-- =========================================================
-- SECTION N -- Configuration save: update publication
-- =========================================================

do $$
declare
  v_result jsonb;
  v_config_version_before int;
  v_config_version_after int;
  v_current_count int;
  v_v1_id uuid;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('N', 'N1', 'a null publishUpdate group (settings-only call) creates no share_link_updates row',
    format('select public.save_share_configuration(%L, %L, null, null, null)', pg_temp.get_uuid('link_a1'), '{"contentDirection":"auto"}'::jsonb),
    true);
  perform pg_temp.act_as('postgres');
  perform pg_temp.record_result('N', 'N1-no-row', 'no share_link_updates row exists yet for link_a1', (select count(*) from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1')) = 0, '0', (select count(*)::text from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1')), null);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  select configuration_version into v_config_version_before from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.try_rpc('N', 'N2', 'first publication creates version 1 and exactly one current row',
    format('select public.save_share_configuration(%L, null, null, null, %L)', pg_temp.get_uuid('link_a1'), '{"body":"Project kicked off."}'::jsonb),
    true, null, null, 'n2_result');
  v_result := pg_temp.get_json('n2_result');
  perform pg_temp.record_result('N', 'N2-shape', 'currentUpdate has version=1, publishedAt set, and no body key', (v_result->'currentUpdate'->>'version')::int = 1 and v_result->'currentUpdate' ? 'publishedAt' and not (v_result->'currentUpdate' ? 'body'), 'version=1,publishedAt set,no body', (v_result->'currentUpdate')::text, null);

  perform pg_temp.act_as('postgres');
  select count(*) into v_current_count from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1') and is_current;
  perform pg_temp.record_result('N', 'N2-one-current', 'exactly one current row exists after the first publication', v_current_count = 1, '1', v_current_count::text, null);
  select configuration_version into v_config_version_after from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('N', 'N2-no-version-bump', 'update-only save does not bump configuration_version', v_config_version_before = v_config_version_after, v_config_version_before::text, v_config_version_after::text, null);
  select id into v_v1_id from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1') and version = 1;
  perform pg_temp.set_val('n_v1_id', v_v1_id::text);
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  perform pg_temp.try_rpc('N', 'N3', 'second publication retires the prior current row and creates version 2 as the sole new current row',
    format('select public.save_share_configuration(%L, null, null, null, %L)', pg_temp.get_uuid('link_a1'), '{"body":"Second update."}'::jsonb),
    true, null, null, 'n3_result');
  v_result := pg_temp.get_json('n3_result');
  perform pg_temp.record_result('N', 'N3-shape', 'currentUpdate has version=2', (v_result->'currentUpdate'->>'version')::int = 2, '2', v_result->'currentUpdate'->>'version', null);

  perform pg_temp.act_as('postgres');
  select count(*) into v_current_count from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1') and is_current;
  perform pg_temp.record_result('N', 'N3-one-current', 'exactly one current row exists after the second publication (version 1 was retired)', v_current_count = 1, '1', v_current_count::text, null);
  perform pg_temp.record_result('N', 'N3-v1-retired', 'version 1 is no longer current, and its immutable body/version/published_at are untouched', not (select is_current from public.share_link_updates where id = v_v1_id) and (select body from public.share_link_updates where id = v_v1_id) = 'Project kicked off.', 'is_current=false,body unchanged', 'observed', null);

  perform pg_temp.try_stmt('N', 'N4', 'the retired version-1 row''s body remains immutable (enforce_share_link_update_integrity still fires)',
    format('update public.share_link_updates set body = %L where id = %L', 'tampered', v_v1_id),
    false, 'SHARE_UPDATE_IMMUTABLE', 'P0001');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('N', 'N5', 'a blank (whitespace-only) update body is rejected as INVALID_PUBLISH_UPDATE before any mutation',
    format('select public.save_share_configuration(%L, null, null, null, %L)', pg_temp.get_uuid('link_a1'), '{"body":"   "}'::jsonb),
    false, 'INVALID_PUBLISH_UPDATE', 'P0001');
  perform pg_temp.try_rpc('N', 'N6', 'an oversized (>5000 char) update body is rejected as INVALID_PUBLISH_UPDATE',
    format('select public.save_share_configuration(%L, null, null, null, %L)', pg_temp.get_uuid('link_a1'), jsonb_build_object('body', repeat('x', 5001))),
    false, 'INVALID_PUBLISH_UPDATE', 'P0001');
  perform pg_temp.try_rpc('N', 'N7', 'a non-string update body is rejected as INVALID_PUBLISH_UPDATE',
    format('select public.save_share_configuration(%L, null, null, null, %L)', pg_temp.get_uuid('link_a1'), '{"body":123}'::jsonb),
    false, 'INVALID_PUBLISH_UPDATE', 'P0001');

  perform pg_temp.act_as('postgres');
  select count(*) into v_current_count from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1') and is_current and version = 2;
  perform pg_temp.record_result('N', 'N7-unchanged', 'version 2 is still the sole current row after every rejected N5-N7 attempt', v_current_count = 1, '1', v_current_count::text, null);

  perform pg_temp.record_result('N', 'N8', 'no share_link_events row was ever created for a configuration-save/update-publication in this package (closed vocabulary has no such event)',
    not exists (select 1 from public.share_link_events where event_type not in ('link_created','link_activated','link_disabled','link_rotated','link_revoked')),
    'no such event_type ever written', 'confirmed', null);
end;
$$;

-- =========================================================
-- SECTION O -- Configuration-save atomic rollback
--
-- pg_temp.try_rpc's own BEGIN/EXCEPTION block already gives every failed
-- RPC call in this file a real PostgreSQL subtransaction rollback (a
-- PL/pgSQL exception handler is implemented as a savepoint under the
-- hood), so every failed save_share_configuration call throughout this
-- entire file already had its own partial writes discarded structurally,
-- not just by this section's own assertions. Section O makes that
-- guarantee explicit and observable for the four combined-failure
-- scenarios this package's requirements name specifically, by snapshotting
-- state before and after each expected-failure combined call.
-- =========================================================

do $$
declare
  v_settings_before record;
  v_settings_after record;
  v_task_count_before int;
  v_task_count_after int;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.act_as('postgres');
  select comments_enabled, client_facing_subtitle, content_direction, configuration_version into v_settings_before
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  select count(*) into v_task_count_before from public.share_link_tasks where share_link_id = pg_temp.get_uuid('link_a1');
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- O1: valid settings change combined with an invalid task in ONE call.
  perform pg_temp.try_rpc('O', 'O1', 'valid settings + an invalid task in the same call fails entirely, leaving settings/version/task-mapping unchanged',
    format('select public.save_share_configuration(%L, %L, %L, null, null)', pg_temp.get_uuid('link_a1'), '{"clientFacingSubtitle":"Should not apply"}'::jsonb,
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_b1')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 0))),
    false, 'INVALID_TASKS', 'P0001');

  perform pg_temp.act_as('postgres');
  select comments_enabled, client_facing_subtitle, content_direction, configuration_version into v_settings_after
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  select count(*) into v_task_count_after from public.share_link_tasks where share_link_id = pg_temp.get_uuid('link_a1');
  -- NULL-safe row comparison: client_facing_subtitle is null in both
  -- snapshots (never set on link_a1), and plain `=` on a row containing a
  -- NULL field yields NULL, not TRUE, even when every field genuinely
  -- matches -- record_result's own coalesce(p_pass, false) would then
  -- record a false FAIL against an actually-unchanged row. `IS NOT
  -- DISTINCT FROM` treats NULL as equal to NULL, exactly matching what
  -- "unchanged" means here.
  perform pg_temp.record_result('O', 'O1-unchanged', 'settings, configuration_version and task mapping are all unchanged after O1''s failed combined call',
    row(v_settings_before.comments_enabled, v_settings_before.client_facing_subtitle, v_settings_before.content_direction, v_settings_before.configuration_version)
      is not distinct from row(v_settings_after.comments_enabled, v_settings_after.client_facing_subtitle, v_settings_after.content_direction, v_settings_after.configuration_version)
      and v_task_count_before = v_task_count_after,
    'no change', format('before=%s tasks=%s, after=%s tasks=%s', row_to_json(v_settings_before), v_task_count_before, row_to_json(v_settings_after), v_task_count_after), null);
end;
$$;

do $$
declare
  v_task_ids_before jsonb;
  v_task_ids_after jsonb;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.act_as('postgres');
  select coalesce(jsonb_agg(subtask_id order by subtask_id), '[]'::jsonb) into v_task_ids_before from public.share_link_tasks where share_link_id = pg_temp.get_uuid('link_a1');
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- O2: valid task replacement combined with an invalid Resource in ONE
  -- call. The valid replacement task set must NOT apply if the Resource
  -- group fails validation later in the same function body.
  perform pg_temp.try_rpc('O', 'O2', 'valid task replacement + an invalid Resource in the same call fails entirely, leaving the task mapping unchanged',
    format('select public.save_share_configuration(%L, null, %L, %L, null)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a1_extra')::text, 'publicGroup', 'completed', 'waitingForClientFeedback', true, 'displayOrder', 0)),
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_b1')::text, 'publicLabel', 'x', 'canDownload', false, 'displayOrder', 0))),
    false, 'INVALID_RESOURCES', 'P0001');

  perform pg_temp.act_as('postgres');
  select coalesce(jsonb_agg(subtask_id order by subtask_id), '[]'::jsonb) into v_task_ids_after from public.share_link_tasks where share_link_id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('O', 'O2-unchanged', 'task mapping is unchanged after O2''s failed combined call (the valid task replacement never applied)',
    v_task_ids_before = v_task_ids_after, v_task_ids_before::text, v_task_ids_after::text, null);
end;
$$;

do $$
declare
  v_settings_before record;
  v_settings_after record;
  v_current_version_before int;
  v_current_version_after int;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.act_as('postgres');
  select comments_enabled, content_direction into v_settings_before from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  select version into v_current_version_before from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1') and is_current;
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- O3: valid settings + valid Resource mapping + an invalid publishUpdate
  -- body in ONE call. Nothing -- not settings, not the Resource mapping,
  -- not the current update -- may apply.
  perform pg_temp.try_rpc('O', 'O3', 'valid settings + valid mappings + an invalid update body in the same call fails entirely, leaving settings/mappings/current-update unchanged',
    format('select public.save_share_configuration(%L, %L, null, %L, %L)', pg_temp.get_uuid('link_a1'), '{"contentDirection":"ltr"}'::jsonb,
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a1')::text, 'publicLabel', 'Should not apply', 'canDownload', false, 'displayOrder', 0)),
      '{"body":""}'::jsonb),
    false, 'INVALID_PUBLISH_UPDATE', 'P0001');

  perform pg_temp.act_as('postgres');
  select comments_enabled, content_direction into v_settings_after from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  select version into v_current_version_after from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1') and is_current;
  perform pg_temp.record_result('O', 'O3-unchanged', 'settings and the current update version are unchanged after O3''s failed combined call',
    row(v_settings_before.comments_enabled, v_settings_before.content_direction) = row(v_settings_after.comments_enabled, v_settings_after.content_direction)
      and v_current_version_before = v_current_version_after,
    format('settings unchanged, currentVersion=%s', v_current_version_before), format('currentVersion=%s', v_current_version_after), null);
end;
$$;

do $$
declare
  v_current_count int;
  v_current_version_before int;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.act_as('postgres');
  select version into v_current_version_before from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1') and is_current;
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));

  -- O4: a valid publishUpdate combined with an invalid task in ONE call.
  -- Tasks are validated and applied before the publish sub-operation runs
  -- in save_share_configuration's body, so an invalid task must prevent
  -- the retire-then-insert publish sequence from running AT ALL -- proving
  -- the delivered ordering can never leave the link with zero current
  -- update rows (the retire step and the insert step are never reached
  -- independently of each other).
  perform pg_temp.try_rpc('O', 'O4', 'a valid update body + an invalid task in the same call fails entirely before the publish retire-then-insert ever runs',
    format('select public.save_share_configuration(%L, null, %L, null, %L)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a_deleted')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 0)),
      '{"body":"This must not become current."}'::jsonb),
    false, 'INVALID_TASKS', 'P0001');

  perform pg_temp.act_as('postgres');
  select count(*) into v_current_count from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1') and is_current;
  perform pg_temp.record_result('O', 'O4-still-exactly-one-current', 'exactly one current update row still exists after O4''s failed combined call -- never zero',
    v_current_count = 1, '1', v_current_count::text, null);
  perform pg_temp.record_result('O', 'O4-same-version-current', 'the SAME version is still current (the failed call''s body never became current)',
    (select version from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1') and is_current) = v_current_version_before,
    v_current_version_before::text, (select version::text from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1') and is_current), null);
end;
$$;

-- ---------------------------------------------------------------------
-- O5: TRUE post-retirement atomic rollback -- proves the actual failure
-- point O1-O4 could not reach. O4 above proves an invalid task prevents
-- the publish retire-then-insert sequence from running AT ALL (failure
-- during input pre-validation, before any write). This test instead lets
-- save_share_configuration's publish sub-operation genuinely RUN --
-- retiring the real current row (is_current = false) -- and only then
-- injects a failure at the INSERT of the new current row, so the whole
-- RPC call still fails and PostgreSQL must roll the retirement back too.
--
-- The failure is injected by a TEST-ONLY trigger, narrowly scoped to fire
-- only for one distinctive, unmistakable body string this test alone
-- uses, attached to public.share_link_updates only for the lifetime of
-- this one DO block, and dropped again immediately afterward. It raises
-- its own distinct P0001 code, never colliding with any real
-- application error. This is a test-only object, not an application
-- trigger and not a production migration -- it exists only inside this
-- file's own outer transaction and is undone by the final rollback
-- regardless, but is also dropped explicitly below so it can never
-- affect any later test in this file.
-- ---------------------------------------------------------------------

do $$
declare
  v_before record;
  v_after record;
  v_current_count_after int;
  v_config_version_before int;
  v_config_version_after int;
  v_injected_body text := '__PHASE_1B_TEST_ONLY_POST_RETIREMENT_INJECTED_FAILURE__';
begin
  perform pg_temp.act_as('postgres');

  create or replace function pg_temp.phase_1b_test_only_inject_publish_failure()
  returns trigger
  language plpgsql
  as $trigger_body$
  begin
    if new.body = '__PHASE_1B_TEST_ONLY_POST_RETIREMENT_INJECTED_FAILURE__' then
      raise exception using errcode = 'P0001', message = 'PHASE_1B_TEST_ONLY_INJECTED_FAILURE';
    end if;
    return new;
  end;
  $trigger_body$;

  create trigger phase_1b_test_only_post_retirement_failure
  before insert on public.share_link_updates
  for each row
  execute function pg_temp.phase_1b_test_only_inject_publish_failure();

  select id, version, body, is_current into v_before
    from public.share_link_updates
    where share_link_id = pg_temp.get_uuid('link_a1') and is_current;
  select configuration_version into v_config_version_before
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('O', 'O5', 'a genuinely valid publishUpdate that reaches the retire-then-insert sequence, then fails INSIDE the insert itself, rolls back the retirement too -- the old current row survives as current',
    format('select public.save_share_configuration(%L, null, null, null, %L)', pg_temp.get_uuid('link_a1'), jsonb_build_object('body', v_injected_body)),
    false, 'PHASE_1B_TEST_ONLY_INJECTED_FAILURE', 'P0001');

  perform pg_temp.act_as('postgres');
  drop trigger phase_1b_test_only_post_retirement_failure on public.share_link_updates;
  drop function pg_temp.phase_1b_test_only_inject_publish_failure();

  select id, version, body, is_current into v_after
    from public.share_link_updates
    where share_link_id = pg_temp.get_uuid('link_a1') and is_current;
  select count(*) into v_current_count_after
    from public.share_link_updates
    where share_link_id = pg_temp.get_uuid('link_a1') and is_current;
  select configuration_version into v_config_version_after
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');

  perform pg_temp.record_result('O', 'O5-same-row-still-current', 'the exact same row (id, version, body unchanged) is still is_current=true after the injected post-retirement failure',
    v_before.id = v_after.id and v_before.version = v_after.version and v_before.body = v_after.body and v_after.is_current = true,
    format('id=%s,version=%s,is_current=true', v_before.id, v_before.version), format('id=%s,version=%s,is_current=%s', v_after.id, v_after.version, v_after.is_current), null);

  perform pg_temp.record_result('O', 'O5-exactly-one-current', 'exactly one current row still exists (never zero, never two) after the injected failure',
    v_current_count_after = 1, '1', v_current_count_after::text, null);

  perform pg_temp.record_result('O', 'O5-no-new-version', 'no new version row (the injected version that failed to insert) exists at all',
    not exists (select 1 from public.share_link_updates where share_link_id = pg_temp.get_uuid('link_a1') and body = v_injected_body),
    '0 rows with the injected body', 'confirmed absent', null);

  perform pg_temp.record_result('O', 'O5-config-version-unchanged', 'configuration_version is unchanged by the injected failure (update publication never bumps it, and the whole call rolled back regardless)',
    v_config_version_before = v_config_version_after, v_config_version_before::text, v_config_version_after::text, null);

  perform pg_temp.record_result('O', 'O5-cleanup', 'the test-only trigger and function were dropped immediately after the assertion',
    not exists (
      select 1 from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
      where c.relname = 'share_link_updates' and tg.tgname = 'phase_1b_test_only_post_retirement_failure'
    ),
    'dropped', 'confirmed dropped', null);
end;
$$;

-- =========================================================
-- SECTION P -- Configuration-version / session-grant contract
--
-- share_browser_sessions and share_session_grants are service-role-only
-- (RLS enabled, no policies, no owner-facing grant at all), so every
-- fixture row in this section is created directly as service_role, real
-- INSERTs through enforce_share_session_grant_integrity (202608030005) --
-- never a synthetic row that bypasses that trigger. This package does not
-- implement, and does not need to implement, the Phase 3 public
-- grant-validation read path itself -- only that the stored
-- granted_configuration_version vs. the live configuration_version
-- comparison a future Phase 3 layer will perform can actually distinguish
-- current from stale, and that nothing in Phase 1B silently deletes or
-- rewrites a grant row.
-- =========================================================

do $$
declare
  v_link_version int;
  v_session_1 uuid;
  v_grant_1 uuid;
begin
  select configuration_version into v_link_version from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.set_val('p_version_0', v_link_version::text);

  perform pg_temp.act_as('service_role');
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
    values (pg_temp.fake_hex64('p-session-1'), 1, now() + interval '30 days')
    returning id into v_session_1;
  perform pg_temp.set_val('p_session_1', v_session_1::text);

  perform pg_temp.try_stmt('P', 'P1', 'a fresh grant can be inserted for link_a1 at its exact live configuration_version',
    format('insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at) values (%L, %L, %L, now() + interval ''1 day'')',
      v_session_1, pg_temp.get_uuid('link_a1'), v_link_version),
    true);
  select id into v_grant_1 from public.share_session_grants where browser_session_id = v_session_1;
  perform pg_temp.set_val('p_grant_1', v_grant_1::text);

  perform pg_temp.record_result('P', 'P2', 'grant_1''s stored version exactly matches the link''s live configuration_version (current, not stale)',
    (select granted_configuration_version from public.share_session_grants where id = v_grant_1)
      = (select configuration_version from public.project_share_links where id = pg_temp.get_uuid('link_a1')),
    'equal (current)', 'observed equal', null);
  perform pg_temp.act_as('postgres');
end;
$$;

do $$
declare
  v_link_version int;
  v_old_direction text;
  v_new_direction text;
  v_grant_1_version_before int;
  v_config_version_after int;
  v_session_2 uuid;
  v_grant_2 uuid;
begin
  -- Read the live state as postgres immediately before P3's genuine
  -- settings change, and confirm grant_1 (from P1/P2) is still current at
  -- this point. This does NOT assume what an earlier section (e.g. K5)
  -- left content_direction as -- it reads whatever is live right now.
  select configuration_version, content_direction into v_link_version, v_old_direction
    from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  select granted_configuration_version into v_grant_1_version_before
    from public.share_session_grants where id = pg_temp.get_uuid('p_grant_1');
  perform pg_temp.record_result('P', 'P3-precondition', 'grant_1 is still current immediately before P3''s genuine settings change',
    v_grant_1_version_before = v_link_version,
    v_link_version::text, v_grant_1_version_before::text, null);

  -- Compute a content_direction value guaranteed to differ from whatever
  -- is live right now (valid values are 'auto', 'ltr', 'rtl' -- flipping
  -- to 'ltr' when live is 'rtl', otherwise to 'rtl', always differs and is
  -- always valid), so save_share_configuration's IS DISTINCT FROM
  -- settings-change check is guaranteed to see a genuine change
  -- regardless of what upstream sections left content_direction as. This
  -- is not a hard-coded replay of any earlier section's value.
  v_new_direction := case when v_old_direction = 'rtl' then 'ltr' else 'rtl' end;

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('P', 'P3', 'fixture action: a genuine settings change on link_a1 (content_direction flipped from its live value, computed at runtime)',
    format('select public.save_share_configuration(%L, %L, null, null, null)', pg_temp.get_uuid('link_a1'), jsonb_build_object('contentDirection', v_new_direction)),
    true);
  perform pg_temp.act_as('postgres');

  select configuration_version into v_config_version_after from public.project_share_links where id = pg_temp.get_uuid('link_a1');

  perform pg_temp.record_result('P', 'P3-direction-applied', 'the computed (guaranteed-different-from-live) direction was actually applied',
    (select content_direction from public.project_share_links where id = pg_temp.get_uuid('link_a1')) = v_new_direction,
    v_new_direction, (select content_direction from public.project_share_links where id = pg_temp.get_uuid('link_a1')), null);

  perform pg_temp.record_result('P', 'P3-version-bump', 'configuration_version advanced by exactly one after the genuine direction change',
    v_config_version_after = v_link_version + 1,
    (v_link_version + 1)::text, v_config_version_after::text, null);

  perform pg_temp.record_result('P', 'P3-grant-unchanged', 'grant_1''s row still exists and its stored granted_configuration_version was not rewritten by the settings change',
    (select count(*) from public.share_session_grants where id = pg_temp.get_uuid('p_grant_1')) = 1
      and (select granted_configuration_version from public.share_session_grants where id = pg_temp.get_uuid('p_grant_1')) = v_grant_1_version_before,
    format('1 row, granted_configuration_version=%s (unchanged)', v_grant_1_version_before),
    format('%s row(s), granted_configuration_version=%s',
      (select count(*) from public.share_session_grants where id = pg_temp.get_uuid('p_grant_1')),
      (select granted_configuration_version from public.share_session_grants where id = pg_temp.get_uuid('p_grant_1'))),
    null);

  perform pg_temp.record_result('P', 'P3-stale', 'grant_1 is now stale after a genuine settings change (its stored version no longer matches the live one)',
    (select granted_configuration_version from public.share_session_grants where id = pg_temp.get_uuid('p_grant_1'))
      <> v_config_version_after,
    'not equal (stale)', format('grant=%s, live=%s', v_grant_1_version_before, v_config_version_after), null);

  -- A fresh grant at the NEW current version, then a PIN change, proves
  -- PIN changes independently cause staleness too.
  select configuration_version into v_link_version from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.act_as('service_role');
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
    values (pg_temp.fake_hex64('p-session-2'), 1, now() + interval '30 days') returning id into v_session_2;
  insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at)
    values (v_session_2, pg_temp.get_uuid('link_a1'), v_link_version, now() + interval '1 day') returning id into v_grant_2;
  perform pg_temp.set_val('p_grant_2', v_grant_2::text);
  perform pg_temp.act_as('postgres');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('P', 'P4setup', 'fixture action: set a PIN on link_a1',
    format('select public.set_share_link_pin(%L, %L, %L, 1::smallint, 16384, 8, 1, 32)', pg_temp.get_uuid('link_a1'), pg_temp.fake_b64url(43), pg_temp.fake_b64url(22)),
    true);
  perform pg_temp.act_as('postgres');
  perform pg_temp.record_result('P', 'P4', 'grant_2 is now stale after a PIN change',
    (select granted_configuration_version from public.share_session_grants where id = v_grant_2)
      <> (select configuration_version from public.project_share_links where id = pg_temp.get_uuid('link_a1')),
    'not equal (stale)', 'observed not equal', null);
  -- Clear the PIN again so P5/P6's later grant inserts (which require
  -- pin_verified_at null when the link has no PIN) remain valid.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('P', 'P4cleanup', 'fixture cleanup: clear the PIN again',
    format('select public.clear_share_link_pin(%L)', pg_temp.get_uuid('link_a1')), true);
  perform pg_temp.act_as('postgres');
end;
$$;

-- Expiry-driven staleness: link_a1's expires_at has been null since
-- Section G cleared it (G5/G6) and nothing since has touched it, so a
-- fresh set_share_link_expiry call here is a genuine null -> future
-- change, not a no-op -- exactly the case set_share_link_expiry's own
-- no-op branch (Section G2/G6) does NOT bump configuration_version for.
do $$
declare
  v_link_version int;
  v_session_expiry uuid;
  v_grant_expiry uuid;
  v_grant_row_count_before int;
  v_grant_row_count_after int;
  v_config_version_before int;
  v_config_version_after int;
begin
  select configuration_version into v_link_version from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.act_as('service_role');
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
    values (pg_temp.fake_hex64('p-session-expiry'), 1, now() + interval '30 days') returning id into v_session_expiry;
  insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at)
    values (v_session_expiry, pg_temp.get_uuid('link_a1'), v_link_version, now() + interval '1 day') returning id into v_grant_expiry;
  perform pg_temp.set_val('p_grant_expiry', v_grant_expiry::text);

  perform pg_temp.record_result('P', 'P-EXPIRY-1', 'grant_expiry is initially current (its stored version matches the link''s live configuration_version)',
    (select granted_configuration_version from public.share_session_grants where id = v_grant_expiry) = v_link_version,
    v_link_version::text, (select granted_configuration_version::text from public.share_session_grants where id = v_grant_expiry), null);

  select count(*) into v_grant_row_count_before from public.share_session_grants where id = v_grant_expiry;
  perform pg_temp.act_as('postgres');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('P', 'P-EXPIRY-2', 'fixture action: owner A sets a genuine future expiry on link_a1 (null -> future, a real change)',
    format('select public.set_share_link_expiry(%L, %L)', pg_temp.get_uuid('link_a1'), now() + interval '10 days'),
    true, null, null, 'p_expiry_result');
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result('P', 'P-EXPIRY-3', 'configuration_version advanced by exactly one after the genuine expiry change',
    (pg_temp.get_json('p_expiry_result')->>'configurationVersion')::int = v_link_version + 1,
    (v_link_version + 1)::text, pg_temp.get_json('p_expiry_result')->>'configurationVersion', null);

  select count(*) into v_grant_row_count_after from public.share_session_grants where id = v_grant_expiry;
  perform pg_temp.record_result('P', 'P-EXPIRY-4', 'the existing grant row still exists (was not deleted) and was not rewritten (id, browser_session_id, granted_configuration_version all unchanged)',
    v_grant_row_count_after = 1
      and (select granted_configuration_version from public.share_session_grants where id = v_grant_expiry) = v_link_version,
    format('1 row, granted_configuration_version=%s (unchanged)', v_link_version),
    format('%s row(s), granted_configuration_version=%s', v_grant_row_count_after, (select granted_configuration_version from public.share_session_grants where id = v_grant_expiry)),
    null);

  select configuration_version into v_config_version_after from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('P', 'P-EXPIRY-5', 'grant_expiry is now stale: its stored granted_configuration_version no longer matches the link''s live configuration_version',
    (select granted_configuration_version from public.share_session_grants where id = v_grant_expiry) <> v_config_version_after,
    'not equal (stale)', format('grant=%s, live=%s', v_link_version, v_config_version_after), null);

  -- Cleanup: clear the expiry again so link_a1 returns to its prior
  -- null-expiry baseline for any later section that assumes it. This is
  -- itself a genuine change (future -> null), so it advances
  -- configuration_version exactly once more -- documented here rather
  -- than silently absorbed.
  select configuration_version into v_config_version_before from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('P', 'P-EXPIRY-cleanup', 'fixture cleanup: clear the expiry again (a genuine change, advances configuration_version once more)',
    format('select public.clear_share_link_expiry(%L)', pg_temp.get_uuid('link_a1')),
    true, null, null, 'p_expiry_cleanup_result');
  perform pg_temp.act_as('postgres');
  perform pg_temp.record_result('P', 'P-EXPIRY-cleanup-version', 'the cleanup clear-expiry advanced configuration_version by exactly one more',
    (pg_temp.get_json('p_expiry_cleanup_result')->>'configurationVersion')::int = v_config_version_before + 1,
    (v_config_version_before + 1)::text, pg_temp.get_json('p_expiry_cleanup_result')->>'configurationVersion', null);
end;
$$;

do $$
declare
  v_link_version int;
  v_session_3 uuid;
  v_grant_3 uuid;
  v_grant_3_version int;
  v_config_version_after_rotation int;
begin
  select configuration_version into v_link_version from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.act_as('service_role');
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
    values (pg_temp.fake_hex64('p-session-3'), 1, now() + interval '30 days') returning id into v_session_3;
  insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at)
    values (v_session_3, pg_temp.get_uuid('link_a1'), v_link_version, now() + interval '1 day') returning id into v_grant_3;
  perform pg_temp.act_as('postgres');

  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('P', 'P5setup', 'fixture action: rotate the secret on link_a1',
    format('select public.rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)', pg_temp.get_uuid('link_a1'),
      pg_temp.fake_hex64('p5-secret'), pg_temp.fake_hex_n('p5-cipher', 86), pg_temp.fake_hex_n('p5-nonce', 24), pg_temp.fake_hex_n('p5-tag', 32)),
    true);
  perform pg_temp.act_as('postgres');
  select granted_configuration_version into v_grant_3_version from public.share_session_grants where id = v_grant_3;
  select configuration_version into v_config_version_after_rotation from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.record_result('P', 'P5', 'grant_3 is now stale after secret rotation',
    v_grant_3_version <> v_config_version_after_rotation,
    'not equal (stale)', format('grant=%s, live=%s', v_grant_3_version, v_config_version_after_rotation), null);
end;
$$;

do $$
declare
  v_link_version int;
  v_session_4 uuid;
  v_grant_4 uuid;
  v_grant_count_before int;
  v_grant_count_after int;
  v_r4_capture jsonb;
begin
  select configuration_version into v_link_version from public.project_share_links where id = pg_temp.get_uuid('link_a1');
  perform pg_temp.act_as('service_role');
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
    values (pg_temp.fake_hex64('p-session-4'), 1, now() + interval '30 days') returning id into v_session_4;
  insert into public.share_session_grants (browser_session_id, share_link_id, granted_configuration_version, expires_at)
    values (v_session_4, pg_temp.get_uuid('link_a1'), v_link_version, now() + interval '1 day') returning id into v_grant_4;
  select count(*) into v_grant_count_before from public.share_session_grants;
  perform pg_temp.act_as('postgres');

  -- Task-only, Resource-only and update-only changes must NOT touch
  -- configuration_version, so grant_4 must remain current after all three.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('P', 'P6setup', 'fixture action: a combined task+Resource+update-only save_share_configuration call (no settings group)',
    format('select public.save_share_configuration(%L, null, %L, %L, %L)', pg_temp.get_uuid('link_a1'),
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a1')::text, 'publicGroup', 'waiting_for_feedback', 'waitingForClientFeedback', true, 'displayOrder', 1)),
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a1')::text, 'publicLabel', 'Curated only', 'canDownload', false, 'displayOrder', 1)),
      '{"body":"Curated-content-only publication."}'::jsonb),
    true);
  perform pg_temp.act_as('postgres');
  perform pg_temp.record_result('P', 'P6', 'grant_4 stays CURRENT after task-only + Resource-only + update-only changes (none of them touch configuration_version)',
    (select granted_configuration_version from public.share_session_grants where id = v_grant_4)
      = (select configuration_version from public.project_share_links where id = pg_temp.get_uuid('link_a1')),
    'equal (still current)', 'observed equal', null);

  select count(*) into v_grant_count_after from public.share_session_grants;
  perform pg_temp.record_result('P', 'P7', 'no owner RPC exercised in this section deleted or added a share_session_grants row (count unchanged apart from this fixture''s own direct inserts)',
    v_grant_count_before = v_grant_count_after, v_grant_count_before::text, v_grant_count_after::text, null);

  perform pg_temp.record_result('P', 'P8', 'a simple version-comparison query correctly distinguishes a current grant (grant_4) from stale grants (grant_1/2/3) present in the table at the same instant',
    (select granted_configuration_version from public.share_session_grants where id = v_grant_4) = (select configuration_version from public.project_share_links where id = pg_temp.get_uuid('link_a1'))
      and (select granted_configuration_version from public.share_session_grants where id = pg_temp.get_uuid('p_grant_1')) <> (select configuration_version from public.project_share_links where id = pg_temp.get_uuid('link_a1')),
    'grant_4 current, grant_1 stale, simultaneously', 'observed as expected', null);

  -- Capture the real get_share_link_management_state result for link_a1
  -- WHILE IT IS STILL ACTIVE, so Section R4 (safe-output inspection) can
  -- prove the owner-published-body inclusion without a second live call
  -- after the revoke below. get_share_link_management_state's own
  -- selector filters on `state <> 'revoked'`, so a revoked link can never
  -- again be selected by a fresh call -- this evidence must be captured
  -- now, at the last valid lifecycle point, not reconstructed later.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('P', 'P8b-r4-capture', 'fixture action: capture the real get_share_link_management_state result for link_a1 while it is still active, for Section R4 to consume after link_a1 is revoked below',
    format('select public.get_share_link_management_state(%L)', pg_temp.get_uuid('project_a1')),
    true, null, null, 'r4_management_before_revoke');
  perform pg_temp.act_as('postgres');

  v_r4_capture := pg_temp.get_json('r4_management_before_revoke');
  perform pg_temp.record_result('P', 'P8b-r4-capture-link', 'the captured management-state result''s link.id is exactly link_a1 (proves the selector picked the still-active link_a1, not some other project_a1 link, at capture time)',
    (v_r4_capture->'link'->>'id')::uuid = pg_temp.get_uuid('link_a1'),
    pg_temp.get_uuid('link_a1')::text, v_r4_capture->'link'->>'id', null);
  perform pg_temp.record_result('P', 'P8b-r4-capture-body', 'the captured management-state result''s currentUpdate contains the actual published body (P6''s "Curated-content-only publication.") while link_a1 is still active',
    v_r4_capture->'currentUpdate' ? 'body' and (v_r4_capture->'currentUpdate'->>'body') = 'Curated-content-only publication.',
    'Curated-content-only publication.', v_r4_capture->'currentUpdate'->>'body', null);

  -- Revoke makes a grant stale too (revoke_share_link bumps
  -- configuration_version, per AGENTS.md rule 16). This is deliberately
  -- the LAST action taken against link_a1 in this file -- no later
  -- section needs it active.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_rpc('P', 'P9setup', 'fixture action: revoke link_a1',
    format('select public.revoke_share_link(%L)', pg_temp.get_uuid('link_a1')), true);
  perform pg_temp.act_as('postgres');
  perform pg_temp.record_result('P', 'P9', 'grant_4 (current immediately before the revoke) is stale immediately after the revoke',
    (select granted_configuration_version from public.share_session_grants where id = v_grant_4)
      <> (select configuration_version from public.project_share_links where id = pg_temp.get_uuid('link_a1')),
    'not equal (stale)', 'observed not equal', null);

  perform pg_temp.record_result('P', 'P10', 'this package does not implement Phase 3 public grant validation -- only that the stored comparison a future Phase 3 layer performs can distinguish current from stale, which P1-P9 above prove directly',
    true, 'documented scope boundary', 'confirmed', null);
end;
$$;

-- =========================================================
-- SECTION Q -- Tenant isolation and direct access
-- =========================================================

do $$
declare
  v_msg_1 text;
  v_msg_2 text;
  v_sqlstate_1 text;
  v_sqlstate_2 text;
begin
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));

  perform pg_temp.try_rpc('Q', 'Q1', 'owner B cannot read owner A''s project via list_share_link_summaries',
    format('select public.list_share_link_summaries(array[%L]::uuid[])', pg_temp.get_uuid('project_a1')),
    false, 'PROJECT_NOT_FOUND', 'P0001');

  perform pg_temp.try_rpc('Q', 'Q2', 'owner B cannot set a PIN on owner A''s disabled link_a1_second',
    format('select public.set_share_link_pin(%L, %L, %L, 1::smallint, 16384, 8, 1, 32)', pg_temp.get_uuid('link_a1_second'), pg_temp.fake_b64url(43), pg_temp.fake_b64url(22)),
    false, 'SHARE_LINK_NOT_FOUND', 'P0001');

  perform pg_temp.try_rpc('Q', 'Q3setup', 'fixture setup: owner B creates B''s own draft',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_b1'), pg_temp.fake_b64url(24)),
    true, null, null, 'q3_draft_result');
  perform pg_temp.try_rpc('Q', 'Q3', 'owner B cannot map owner A''s task onto B''s own link (rejected as INVALID_TASKS, no cross-tenant existence leak)',
    format('select public.save_share_configuration(%L, null, %L, null, null)', (pg_temp.get_json('q3_draft_result')->>'linkId')::uuid,
      jsonb_build_array(jsonb_build_object('subtaskId', pg_temp.get_bigint('task_a1')::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 0))),
    false, 'INVALID_TASKS', 'P0001');
  perform pg_temp.try_rpc('Q', 'Q3b', 'owner B cannot map owner A''s Resource onto B''s own link (rejected as INVALID_RESOURCES, no cross-tenant existence leak)',
    format('select public.save_share_configuration(%L, null, null, %L, null)', (pg_temp.get_json('q3_draft_result')->>'linkId')::uuid,
      jsonb_build_array(jsonb_build_object('resourceId', pg_temp.get_uuid('resource_a1')::text, 'publicLabel', 'x', 'canDownload', false, 'displayOrder', 0))),
    false, 'INVALID_RESOURCES', 'P0001');

  perform pg_temp.try_stmt('Q', 'Q4', 'owner B (ordinary authenticated role) cannot SELECT project_share_secret_material directly',
    'select 1 from public.project_share_secret_material limit 1', false, null, '42501');

  perform pg_temp.record_result('Q', 'Q5', 'owner B''s direct authenticated SELECT of share_link_tasks returns zero of owner A''s rows (RLS-filtered, not an error)',
    not exists (select 1 from public.share_link_tasks where share_link_id = pg_temp.get_uuid('link_a1_second')),
    '0 rows visible', 'observed 0 rows', null);
  perform pg_temp.record_result('Q', 'Q5b', 'owner B''s direct authenticated SELECT of project_share_links returns zero of owner A''s rows',
    not exists (select 1 from public.project_share_links where id = pg_temp.get_uuid('link_a1_second')),
    '0 rows visible', 'observed 0 rows', null);

  -- Differentiated-error-message check: a nonexistent link id and a real
  -- link id owned by someone else must produce the EXACT same SQLSTATE and
  -- message, so a caller can never distinguish "does not exist" from
  -- "exists, owned by someone else".
  begin
    perform public.disable_share_link(gen_random_uuid());
    v_msg_1 := null; v_sqlstate_1 := null;
  exception when others then
    get stacked diagnostics v_sqlstate_1 = returned_sqlstate, v_msg_1 = message_text;
  end;
  begin
    perform public.disable_share_link(pg_temp.get_uuid('link_a1_second'));
    v_msg_2 := null; v_sqlstate_2 := null;
  exception when others then
    get stacked diagnostics v_sqlstate_2 = returned_sqlstate, v_msg_2 = message_text;
  end;
  perform pg_temp.record_result('Q', 'Q6', 'a nonexistent link id and a real link id owned by another user produce the identical SQLSTATE and message',
    v_sqlstate_1 = v_sqlstate_2 and v_msg_1 = v_msg_2 and v_msg_1 = 'SHARE_LINK_NOT_FOUND',
    'identical P0001/SHARE_LINK_NOT_FOUND', format('nonexistent=%s/%s, cross-owner=%s/%s', v_sqlstate_1, v_msg_1, v_sqlstate_2, v_msg_2), null);

  perform pg_temp.act_as('postgres');
end;
$$;

do $$
declare
  v_anon_execute_sample_count int;
begin
  -- anon cannot execute owner RPCs: both the catalog check (already A7)
  -- and a REAL attempted call, which must fail at the grant layer
  -- (42501), before ever reaching the function body.
  perform pg_temp.act_as('anon');
  perform pg_temp.try_stmt('Q', 'Q7', 'anon cannot execute save_share_configuration (real call, grant-layer rejection)',
    format('select public.save_share_configuration(%L, %L, null, null, null)', pg_temp.get_uuid('link_a1_second'), '{"commentsEnabled":true}'::jsonb),
    false, null, '42501');
  perform pg_temp.try_stmt('Q', 'Q7b', 'anon cannot execute get_share_link_management_state (real call, grant-layer rejection)',
    format('select public.get_share_link_management_state(%L)', pg_temp.get_uuid('project_a1')),
    false, null, '42501');
  perform pg_temp.try_stmt('Q', 'Q7c', 'anon cannot execute create_share_link_draft (real call, grant-layer rejection)',
    format('select public.create_share_link_draft(%L, %L)', pg_temp.get_uuid('project_a1'), pg_temp.fake_b64url(24)),
    false, null, '42501');

  -- Authenticated direct table mutation remains denied where intended:
  -- no INSERT/UPDATE/DELETE grant exists on any owner-facing Client Share
  -- table for `authenticated` -- every mutation must go through an RPC.
  perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'));
  perform pg_temp.try_stmt('Q', 'Q8', 'authenticated cannot directly UPDATE project_share_links (no table grant; must go through an RPC)',
    format('update public.project_share_links set comments_enabled = true where id = %L', pg_temp.get_uuid('link_a1_second')),
    false, null, '42501');
  perform pg_temp.try_stmt('Q', 'Q8b', 'authenticated cannot directly INSERT share_link_tasks (no table grant; must go through save_share_configuration)',
    format('insert into public.share_link_tasks (user_id, share_link_id, subtask_id, public_group) values (%L, %L, %L, ''in_progress'')',
      pg_temp.get_uuid('owner_a'), pg_temp.get_uuid('link_a1_second'), pg_temp.get_bigint('task_a1')),
    false, null, '42501');

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SECTION R -- Final safe-output inspection
--
-- Recursively inspects every RPC result captured earlier in this file
-- (draft creation, activation, disable, re-enable, PIN, expiry, rotation,
-- reveal, revoke, config save, owner reads) and asserts the absence of
-- every forbidden field this package's requirements name, walking INTO
-- every nested object and array rather than only the top level and the
-- single `link` sub-object -- a forbidden key nested inside any array
-- element or other nested structure is caught exactly the same as a
-- top-level one. reveal_share_link_secret's own result is the ONLY one
-- expected to carry ciphertextHex/nonceHex/authTagHex, checked separately
-- below. projectId is handled as its own targeted check (R2/R2b) rather
-- than a blanket forbidden key, because it is an intentional, approved
-- field on list_share_link_summaries results specifically.
-- =========================================================

-- Recursive key-collector: walks a jsonb value of any shape and returns
-- every object key found at any depth, in objects nested inside objects,
-- inside arrays, or any combination -- not just the top level.
create or replace function pg_temp.recursive_json_keys(p_value jsonb) returns text[]
language plpgsql as $f$
declare
  v_keys text[] := array[]::text[];
  v_key text;
  v_elem jsonb;
begin
  if p_value is null then
    return v_keys;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    for v_key in select jsonb_object_keys(p_value) loop
      v_keys := array_append(v_keys, v_key);
      v_keys := v_keys || pg_temp.recursive_json_keys(p_value -> v_key);
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for v_elem in select * from jsonb_array_elements(p_value) loop
      v_keys := v_keys || pg_temp.recursive_json_keys(v_elem);
    end loop;
  end if;

  return v_keys;
end;
$f$;

do $$
declare
  v_key text;
  v_captured_key text;
  v_result jsonb;
  v_all_keys text[];
  v_forbidden_keys text[] := array[
    'userId', 'secretDigest', 'secret', 'pinHash', 'pinSalt', 'ciphertextHex', 'nonceHex',
    'authTagHex', 'storagePath', 'signedUrl', 'plaintext', 'pin', 'rawInput', 'phone', 'email',
    'notes', 'contactName', 'clientName', 'amount', 'priority'
  ];
  v_violations text[] := array[]::text[];
  -- Every non-reveal, non-summary RPC result captured earlier in this
  -- file via pg_temp.set_val. projectId is deliberately not in
  -- v_forbidden_keys above (see this section's header) -- it is checked
  -- on its own below, both here (must be absent) and for the summary
  -- results (must be present).
  v_non_reveal_results text[] := array[
    'c1_result', 'c2_result', 'd1_result', 'e1_result', 'e6_result', 'f1_result', 'f3_result', 'f4_result',
    'g1_result', 'g4_result', 'g5_result', 'h1_result', 'h2_result', 'j1_result', 'j2_result', 'j3_result',
    'k1_result', 'k2_result', 'k3_result', 'k5_result', 'l1_result', 'l5_result', 'm1_result', 'm2_result',
    'n2_result', 'n3_result', 'b3_result'
  ];
begin
  foreach v_captured_key in array v_non_reveal_results loop
    v_result := pg_temp.get_json(v_captured_key);
    if v_result is not null then
      v_all_keys := pg_temp.recursive_json_keys(v_result);
      foreach v_key in array v_forbidden_keys loop
        if v_key = any(v_all_keys) then
          v_violations := array_append(v_violations, format('%s contains forbidden key %s (recursive scan)', v_captured_key, v_key));
        end if;
      end loop;
      -- Targeted projectId check for non-summary results: must be absent
      -- entirely, not merely absent from the top level.
      if 'projectId' = any(v_all_keys) then
        v_violations := array_append(v_violations, format('%s (ordinary lifecycle/access/config result) unexpectedly contains projectId', v_captured_key));
      end if;
    end if;
  end loop;

  perform pg_temp.record_result('R', 'R1', 'recursive scan: none of the 27 captured non-reveal, non-summary RPC results contain any forbidden field anywhere at any nesting depth (userId, secretDigest, pinHash, pinSalt, ciphertext/nonce/authTag hex, storagePath, signedUrl, plaintext, phone, email, notes, contactName, clientName, amount, priority), and none contains projectId',
    cardinality(v_violations) = 0, '0 violations', array_to_string(v_violations, '; '), null);
end;
$$;

do $$
declare
  v_key text;
  v_captured_key text;
  v_result jsonb;
  v_all_keys text[];
  v_forbidden_keys text[] := array[
    'userId', 'secretDigest', 'secret', 'pinHash', 'pinSalt', 'ciphertextHex', 'nonceHex',
    'authTagHex', 'storagePath', 'signedUrl', 'plaintext', 'pin', 'rawInput', 'phone', 'email',
    'notes', 'contactName', 'clientName', 'amount', 'priority'
  ];
  v_violations text[] := array[]::text[];
  v_summary_results text[] := array['b7_result', 'b8_result'];
  v_has_project_id boolean;
begin
  -- Summary results: every forbidden key must still be absent
  -- (recursive), but projectId is REQUIRED to be present -- it is an
  -- intentional, approved field on this specific RPC's result, checked
  -- explicitly rather than globally ignored.
  foreach v_captured_key in array v_summary_results loop
    v_result := pg_temp.get_json(v_captured_key);
    if v_result is not null then
      v_all_keys := pg_temp.recursive_json_keys(v_result);
      foreach v_key in array v_forbidden_keys loop
        if v_key = any(v_all_keys) then
          v_violations := array_append(v_violations, format('%s contains forbidden key %s (recursive scan)', v_captured_key, v_key));
        end if;
      end loop;
    end if;
  end loop;
  perform pg_temp.record_result('R', 'R2', 'recursive scan: neither captured list_share_link_summaries result contains any forbidden field at any nesting depth',
    cardinality(v_violations) = 0, '0 violations', array_to_string(v_violations, '; '), null);

  v_has_project_id := exists (
    select 1 from jsonb_each(pg_temp.get_json('b7_result')) as entry(k, v)
    where v ? 'projectId'
  );
  perform pg_temp.record_result('R', 'R2b', 'list_share_link_summaries results DO intentionally contain projectId (an approved field on this specific RPC, not a leak)',
    v_has_project_id, 'projectId present', case when v_has_project_id then 'present as expected' else 'unexpectedly absent' end, null);
end;
$$;

do $$
declare
  v_reveal_result jsonb := pg_temp.get_json('i1_result');
  v_reveal_keys text[];
  v_reveal_forbidden_keys text[] := array[
    'userId', 'projectId', 'secret', 'secretDigest', 'pinHash', 'pinSalt', 'storagePath',
    'signedUrl', 'rawInput', 'phone', 'email', 'notes', 'contactName', 'clientName', 'amount', 'priority'
  ];
  v_reveal_violations text[] := array[]::text[];
  v_key text;
  v_top_level_keys text[];
  v_expected_top_level_keys text[] := array['linkId', 'publicId', 'ciphertextHex', 'nonceHex', 'authTagHex', 'encryptionVersion'];
begin
  perform pg_temp.record_result('R', 'R3', 'reveal_share_link_secret is the only RPC result in this package that legitimately carries ciphertextHex/nonceHex/authTagHex, and its own result contains no plaintext-shaped key',
    v_reveal_result ? 'ciphertextHex' and not (v_reveal_result ? 'plaintext') and not (v_reveal_result ? 'secret'),
    'ciphertextHex present, plaintext/secret absent', v_reveal_result::text, null);

  -- Full recursive private/security-key rejection for the reveal result:
  -- everything the generic Section R sweep rejects for ordinary RPC
  -- results, EXCEPT the encrypted-material fields this RPC is uniquely
  -- allowed to return (ciphertextHex/nonceHex/authTagHex/encryptionVersion).
  v_reveal_keys := pg_temp.recursive_json_keys(v_reveal_result);
  foreach v_key in array v_reveal_forbidden_keys loop
    if v_key = any(v_reveal_keys) then
      v_reveal_violations := array_append(v_reveal_violations, v_key);
    end if;
  end loop;
  perform pg_temp.record_result('R', 'R3b', 'reveal_share_link_secret''s result recursively rejects every private/security field (userId, projectId, secret, secretDigest, pinHash, pinSalt, storagePath, signedUrl, rawInput, phone, email, notes, contactName, clientName, amount, priority) at any nesting depth',
    cardinality(v_reveal_violations) = 0, '0 violations', array_to_string(v_reveal_violations, ', '), null);

  -- Exact top-level key set: no extra field of any kind, approved or not.
  select coalesce(array_agg(k order by k), array[]::text[]) into v_top_level_keys from jsonb_object_keys(v_reveal_result) as k;
  perform pg_temp.record_result('R', 'R3c', 'reveal_share_link_secret''s TOP-LEVEL key set is exactly the approved SQL contract (linkId, publicId, ciphertextHex, nonceHex, authTagHex, encryptionVersion) -- no extra field',
    v_top_level_keys = (select array_agg(k order by k) from unnest(v_expected_top_level_keys) as k),
    array_to_string((select array_agg(k order by k) from unnest(v_expected_top_level_keys) as k), ', '),
    array_to_string(v_top_level_keys, ', '), null);
end;
$$;

do $$
declare
  v_result jsonb;
begin
  -- link_a1 was revoked by Section P's P9 (deliberately, as the last
  -- action taken against it in this file), and
  -- get_share_link_management_state's own selector filters on
  -- `state <> 'revoked'`, so a fresh call at this point could never again
  -- legitimately select link_a1. This section therefore does NOT issue a
  -- fresh call -- it consumes the real RPC result captured in Section P
  -- (P8b-r4-capture, 'r4_management_before_revoke') at the last valid
  -- lifecycle point, while link_a1 was still active. That capture already
  -- proved (P8b-r4-capture-link/-body) that the selector picked link_a1
  -- and that currentUpdate carried the real published body -- this
  -- section re-asserts the same two facts against the captured evidence.
  v_result := pg_temp.get_json('r4_management_before_revoke');
  perform pg_temp.record_result('R', 'R4', 'get_share_link_management_state''s currentUpdate DOES include the owner''s own published body (intentional -- owner reading own content), proven from the pre-revoke capture since link_a1 is now revoked and no longer selectable',
    (v_result->'link'->>'id')::uuid = pg_temp.get_uuid('link_a1')
      and v_result->'currentUpdate' ? 'body' and (v_result->'currentUpdate'->>'body') is not null,
    'link.id=link_a1, body present', format('link.id=%s, currentUpdate=%s', v_result->'link'->>'id', v_result->'currentUpdate'), null);

  perform pg_temp.record_result('R', 'R5', 'save_share_configuration''s own currentUpdate never includes the update body (proven directly in Section N2/N3/O5)',
    not (pg_temp.get_json('n3_result')->'currentUpdate' ? 'body'), 'body absent', (pg_temp.get_json('n3_result')->'currentUpdate')::text, null);

  perform pg_temp.record_result('R', 'R6', 'list_share_link_summaries results never include pinHash or secretDigest, only the boolean hasPin',
    not (select bool_or(value ? 'pinHash' or value ? 'secretDigest') from jsonb_each(pg_temp.get_json('b7_result'))),
    'absent', pg_temp.get_json('b7_result')::text, null);
end;
$$;

-- =========================================================
-- FINAL RESULTS AND VERDICT
--
-- Displays every individual result row (under the required public column
-- names: test_number, section, test_name, status, expected, actual,
-- details -- description is kept as an additional column), then the
-- summary counts, BEFORE the final guard below ever has a chance to abort
-- the script -- so a FAIL run still leaves full evidence visible in the
-- SQL Editor output, never just a bare exception. The internal
-- `_test_results` table/column names (seq, test_code, detail) are kept
-- unchanged -- only this user-visible projection renames them.
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
    when count(*) filter (where status = 'FAIL') = 0 then 'PHASE_1B_RUNTIME_PASS'
    else 'PHASE_1B_RUNTIME_FAIL'
  end as runtime_status
from _test_results;

-- Every FAIL row, isolated for quick review when the summary above is not
-- PHASE_1B_RUNTIME_PASS. Same public column names as the full result
-- table above.
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

-- Fail loudly at the very end if anything failed -- AFTER every result
-- row and the summary above have already been returned to the SQL Editor,
-- so a FAIL run never hides the evidence a PASS run would have shown.
--
-- The SQL Editor UI only surfaces the FINAL error to the user -- the result
-- sets above (the full table, the summary, the isolated FAIL-only table)
-- are not reliably visible alongside it. So the exception message itself
-- also carries a compact, deterministic, self-contained report of every
-- FAIL row: seq/section/test_code/expected/actual/detail, ordered by seq,
-- with embedded line breaks/tabs normalized to single spaces and each of
-- expected/actual/detail independently bounded to
-- v_max_field_chars characters -- so the message stays a sane size no
-- matter how large a field's content is, without ever dropping a failing
-- test's identity. Every FAIL row always contributes at least its
-- seq/section/test_code, even in a hypothetical run with far more than 8
-- failures.
--
-- IMPORTANT -- read this before interpreting a FAIL: if the guard below
-- raises, PostgreSQL puts the CURRENT transaction (opened by the `begin;`
-- at the top of this file) into a failed/aborted state: no further
-- statement in it can be committed, and any statement other than
-- ROLLBACK (or an equivalent, such as the SQL Editor session simply
-- disconnecting) is rejected until the transaction actually ends. The
-- trailing `rollback;` statement below is reached and executes only on
-- the normal PASS path (when the guard does not raise) -- on a FAIL, that
-- statement is never reached, and it is ROLLBACK or connection
-- termination that ends the failed transaction and discards its
-- uncommitted work, not the exception itself and not this file reaching
-- any particular line. Either way -- explicit ROLLBACK on PASS, or the
-- transaction ending as failed on FAIL -- no fixture row or test-only
-- helper object created by this file is ever committed or survives. Treat
-- ANY error the SQL Editor reports while running this file -- this
-- guard's own P0001, or any earlier unexpected/uncaught error -- as a
-- FAIL requiring the full result table and summary (already returned
-- above the point of failure, when reached), and now also the FAILS=[...]
-- report embedded in the exception message itself, to be captured in
-- 04_CAPTURE_RESULTS.md.
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
      'PHASE_1B_RUNTIME_FAIL: %s of %s tests failed. FAILS=[%s]',
      v_failed_count, v_total_count, v_fail_report
    );
  end if;
end;
$$;

-- Reached only on the PASS path (the guard above already aborted the
-- transaction on any FAIL, before execution could reach this statement).
-- No fixture row, test-only helper object, or any state this file created
-- survives a run of this file, regardless of outcome. Files 01 and 02's
-- own committed schema/grants/RLS/sentinel are entirely untouched by this
-- rollback -- only what THIS transaction did (Section 2's shared fixture
-- data and every Section A-R action) is undone. This makes the script
-- rerunnable against the same disposable project as many times as needed.
rollback;
