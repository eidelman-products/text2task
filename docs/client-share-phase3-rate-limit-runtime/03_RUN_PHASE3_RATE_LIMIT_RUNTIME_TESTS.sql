-- Text2Task Client Share Link -- Phase 3 Rate-Limit Foundation Runtime
-- Verification Package
-- File 03: Real SQL runtime behaviour tests
--
-- Run this THIRD, after files 01 and 02, in the same temporary Supabase
-- project. Never run this in the real Text2Task production project.
--
-- SCOPE: this file proves ONLY public.increment_share_rate_limit_bucket's
-- own runtime behaviour (the ten SQL/runtime requirements from the Phase
-- 3 rate-limit foundation task). It is deliberately NOT a re-verification
-- of the entire Client Share surface -- docs/client-share-phase1b-runtime/
-- (520/520 PASS), docs/client-share-phase1c-runtime/ (47/47 PASS) and
-- docs/client-share-phase2b-mapping-read-runtime/ (46/46 PASS) already
-- proved that. TRUE CONCURRENCY (simultaneous overlapping calls from
-- separate connections) cannot be proven from a single SQL Editor
-- connection executing statements sequentially -- that is what
-- 06_concurrency_runner.mjs is for for; this file proves everything else:
-- correctness of a single call, sequential accumulation, bucket-key
-- isolation, validation, and window/expiry determinism.
--
-- Sections map directly to the ten required checks:
--   1  -> Section A (function exists, with the exact expected signature)
--   2  -> Section B (grants: service_role only, not anon/authenticated)
--   3  -> Section C (first call creates count = 1)
--   4  -> Section D (sequential same-bucket calls return 2, 3, ...)
--   5  -> Section E (a distinct action creates a distinct bucket)
--   6  -> Section F (a distinct identity creates a distinct bucket)
--   7  -> Section G (null/non-null share-link scoping matches the
--                     existing share_link_key generated-column design)
--   8  -> Section H (unsupported window_seconds is rejected)
--   9  -> Section I (window expiry is deterministic: window_start +
--                     window_seconds exactly)
--   10 -> Section J (a new logical window creates a new bucket row rather
--                     than accumulating into the prior one)
-- Plus Section K: input validation (scope/action/identity-digest format/
-- share-link-scope-requires-link/invalid-link-action-forbids-link), which
-- the task also requires ("fail closed") even though it is not one of the
-- ten numbered items.

-- =========================================================
-- 0. Safety gate
-- =========================================================

do $$
declare
  v_sentinel_kind text;
  v_missing_functions text[];
begin
  if to_regclass('public.text2task_client_share_phase3_rate_limit_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 3 rate-limit runtime test sentinel was not found. Run 01_CREATE_TEMP_TEST_FIXTURE.sql and 02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_RATE_LIMIT.sql first, in that order, in this same temporary project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase3_rate_limit_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_3_RATE_LIMIT_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row does not identify this project as a disposable Phase 3 rate-limit runtime test project.';
  end if;

  select array_agg(t.fn) into v_missing_functions
    from (values
      ('increment_share_rate_limit_bucket(text,text,text,smallint,uuid,integer)'),
      ('create_share_link_draft(uuid,text)')
    ) as t(fn)
    where to_regprocedure('public.' || t.fn) is null;

  if v_missing_functions is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected RPC(s): %s. Run 02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_RATE_LIMIT.sql first.',
      array_to_string(v_missing_functions, ', ')
    );
  end if;
end;
$$;

begin;

-- Always rolled back at the end of this file (see the trailing
-- `rollback;`), so no fixture row or test-only object this file creates
-- ever survives a run -- safe to re-run against the same disposable
-- project as many times as needed.

create temporary table test_results (
  seq integer generated always as identity,
  section text not null,
  name text not null,
  status text not null,
  detail text null
);

create or replace function pg_temp.record_result(
  p_section text,
  p_name text,
  p_passed boolean,
  p_detail text default null
) returns void
language plpgsql
as $$
begin
  insert into test_results (section, name, status, detail)
  values (p_section, p_name, case when p_passed then 'PASS' else 'FAIL' end, p_detail);
end;
$$;

-- =========================================================
-- Shared fixture: one project and one project_share_links row, created
-- directly as this session's role (bypasses RLS/owner RPCs entirely,
-- matching every prior Client Share runtime package's own fixture-row
-- convention) -- needed only for Section G's scope = 'share_link' case.
-- =========================================================

do $$
declare
  v_owner_a constant uuid := '11111111-1111-4111-8111-111111111111';
  v_project_id uuid;
  v_link_id uuid;
begin
  insert into public.projects (user_id) values (v_owner_a)
    returning id into v_project_id;

  insert into public.project_share_links (user_id, project_id, public_id)
    values (v_owner_a, v_project_id, 'phase3RateLimitFixtureLink0001')
    returning id into v_link_id;

  create temporary table fixture_ids (key text primary key, value uuid not null);
  insert into fixture_ids (key, value) values ('project_id', v_project_id), ('link_id', v_link_id);
end;
$$;

-- =========================================================
-- Section A: function exists with the exact expected signature
-- =========================================================

do $$
begin
  perform pg_temp.record_result(
    'A', 'A1: function exists with the exact expected signature',
    to_regprocedure('public.increment_share_rate_limit_bucket(text,text,text,smallint,uuid,integer)') is not null
  );
end;
$$;

-- =========================================================
-- Section B: grants -- service_role only
-- =========================================================

do $$
declare
  v_service_role_can_execute boolean;
  v_anon_can_execute boolean;
  v_authenticated_can_execute boolean;
begin
  select has_function_privilege(
      'service_role',
      'public.increment_share_rate_limit_bucket(text,text,text,smallint,uuid,integer)',
      'execute'
    )
    into v_service_role_can_execute;

  select has_function_privilege(
      'anon',
      'public.increment_share_rate_limit_bucket(text,text,text,smallint,uuid,integer)',
      'execute'
    )
    into v_anon_can_execute;

  select has_function_privilege(
      'authenticated',
      'public.increment_share_rate_limit_bucket(text,text,text,smallint,uuid,integer)',
      'execute'
    )
    into v_authenticated_can_execute;

  perform pg_temp.record_result(
    'B', 'B1: service_role can execute', v_service_role_can_execute
  );
  perform pg_temp.record_result(
    'B', 'B2: anon cannot execute', not v_anon_can_execute
  );
  perform pg_temp.record_result(
    'B', 'B3: authenticated cannot execute', not v_authenticated_can_execute
  );
end;
$$;

-- =========================================================
-- Section C: first call creates count = 1
-- =========================================================

do $$
declare
  v_identity constant text := repeat('a1', 32);
  v_result jsonb;
begin
  select public.increment_share_rate_limit_bucket(
      'network_identity', 'session_exchange', v_identity, 1::smallint, null::uuid, 60
    )
    into v_result;

  perform pg_temp.record_result(
    'C', 'C1: first call for a fresh bucket returns requestCount = 1',
    (v_result->>'requestCount')::integer = 1,
    v_result::text
  );

  perform pg_temp.record_result(
    'C', 'C2: return shape has exactly requestCount/windowStart/windowSeconds/expiresAt',
    (
      select array_agg(key order by key) = array['expiresAt', 'requestCount', 'windowSeconds', 'windowStart']
      from jsonb_object_keys(v_result) as key
    ),
    v_result::text
  );
end;
$$;

-- =========================================================
-- Section D: sequential same-bucket calls return 2, 3, ...
-- =========================================================

do $$
declare
  v_identity constant text := repeat('d1', 32);
  v_r1 jsonb;
  v_r2 jsonb;
  v_r3 jsonb;
begin
  select public.increment_share_rate_limit_bucket('network_identity', 'pin_verification', v_identity, 1::smallint, null::uuid, 60) into v_r1;
  select public.increment_share_rate_limit_bucket('network_identity', 'pin_verification', v_identity, 1::smallint, null::uuid, 60) into v_r2;
  select public.increment_share_rate_limit_bucket('network_identity', 'pin_verification', v_identity, 1::smallint, null::uuid, 60) into v_r3;

  perform pg_temp.record_result(
    'D', 'D1: three sequential calls to the identical bucket return 1, 2, 3',
    (v_r1->>'requestCount')::integer = 1
      and (v_r2->>'requestCount')::integer = 2
      and (v_r3->>'requestCount')::integer = 3,
    format('r1=%s r2=%s r3=%s', v_r1->>'requestCount', v_r2->>'requestCount', v_r3->>'requestCount')
  );

  perform pg_temp.record_result(
    'D', 'D2: all three calls report the identical windowStart (same logical window)',
    (v_r1->>'windowStart') = (v_r2->>'windowStart') and (v_r2->>'windowStart') = (v_r3->>'windowStart'),
    format('w1=%s w2=%s w3=%s', v_r1->>'windowStart', v_r2->>'windowStart', v_r3->>'windowStart')
  );
end;
$$;

-- =========================================================
-- Section E: a distinct action creates a distinct bucket
-- =========================================================

do $$
declare
  v_identity constant text := repeat('e1', 32);
  v_r_exchange jsonb;
  v_r_pin jsonb;
begin
  perform public.increment_share_rate_limit_bucket('network_identity', 'session_exchange', v_identity, 1::smallint, null::uuid, 300);
  select public.increment_share_rate_limit_bucket('network_identity', 'session_exchange', v_identity, 1::smallint, null::uuid, 300) into v_r_exchange;
  select public.increment_share_rate_limit_bucket('network_identity', 'pin_verification', v_identity, 1::smallint, null::uuid, 300) into v_r_pin;

  perform pg_temp.record_result(
    'E', 'E1: same identity, different action -> independent bucket (pin bucket starts at 1 while exchange bucket is already at 2)',
    (v_r_exchange->>'requestCount')::integer = 2 and (v_r_pin->>'requestCount')::integer = 1,
    format('exchange=%s pin=%s', v_r_exchange->>'requestCount', v_r_pin->>'requestCount')
  );
end;
$$;

-- =========================================================
-- Section F: a distinct identity creates a distinct bucket
-- =========================================================

do $$
declare
  v_identity_1 constant text := repeat('f1', 32);
  v_identity_2 constant text := repeat('f2', 32);
  v_r1 jsonb;
  v_r2 jsonb;
begin
  perform public.increment_share_rate_limit_bucket('network_identity', 'projection_read', v_identity_1, 1::smallint, null::uuid, 300);
  select public.increment_share_rate_limit_bucket('network_identity', 'projection_read', v_identity_1, 1::smallint, null::uuid, 300) into v_r1;
  select public.increment_share_rate_limit_bucket('network_identity', 'projection_read', v_identity_2, 1::smallint, null::uuid, 300) into v_r2;

  perform pg_temp.record_result(
    'F', 'F1: same scope/action, different identity -> independent bucket',
    (v_r1->>'requestCount')::integer = 2 and (v_r2->>'requestCount')::integer = 1,
    format('identity1=%s identity2=%s', v_r1->>'requestCount', v_r2->>'requestCount')
  );
end;
$$;

-- =========================================================
-- Section G: null/non-null share-link scoping matches the existing
-- share_link_key generated-column design exactly (coalesce(share_link_id
-- ::text, '-')) -- a null-scoped bucket and a real-link-scoped bucket for
-- an otherwise identical scope/action/identity/window must be
-- independent, and two DIFFERENT links must also be independent.
-- =========================================================

do $$
declare
  -- Deterministic, clearly-synthetic, VALID per
  -- share_rate_limit_buckets_identity_digest_check (^[0-9a-f]{64}$):
  -- 'g' is not a hex digit, so the section-letter-derived tag this file
  -- used everywhere else ('a1'/'d1'/'e1'/'f1' -- all within a-f) breaks
  -- for every section beyond F. Sections G-K use a numeric-only two-digit
  -- tag instead, which can never collide with the hex alphabet again.
  v_identity constant text := repeat('07', 32);
  v_link_id uuid;
  v_r_no_link jsonb;
  v_r_link jsonb;
  v_r_link_second_project uuid;
  v_link_2_id uuid;
  v_r_link_2 jsonb;
begin
  select value into v_link_id from fixture_ids where key = 'link_id';

  select public.increment_share_rate_limit_bucket('network_identity', 'invalid_link_access', v_identity, 1::smallint, null::uuid, 300) into v_r_no_link;
  select public.increment_share_rate_limit_bucket('share_link', 'projection_read', v_identity, 1::smallint, v_link_id, 300) into v_r_link;

  perform pg_temp.record_result(
    'G', 'G1: a null-share_link bucket and a real-link-scoped bucket for the same identity are independent (both read back as requestCount = 1)',
    (v_r_no_link->>'requestCount')::integer = 1 and (v_r_link->>'requestCount')::integer = 1,
    format('no_link=%s link=%s', v_r_no_link->>'requestCount', v_r_link->>'requestCount')
  );

  -- A second distinct share link must be an independent bucket too --
  -- proves share_link_key is derived from the ACTUAL link id, not merely
  -- from "link present vs. absent".
  select value into v_r_link_second_project from fixture_ids where key = 'project_id';
  insert into public.project_share_links (user_id, project_id, public_id)
    values ('11111111-1111-4111-8111-111111111111', v_r_link_second_project, 'phase3RateLimitFixtureLink0002')
    returning id into v_link_2_id;

  select public.increment_share_rate_limit_bucket('share_link', 'projection_read', v_identity, 1::smallint, v_link_2_id, 300) into v_r_link_2;

  perform pg_temp.record_result(
    'G', 'G2: two distinct share links for the same identity/action/window are independent buckets',
    (v_r_link_2->>'requestCount')::integer = 1,
    v_r_link_2::text
  );

  -- The "scope = share_link requires a non-null share_link_id" rejection
  -- itself is asserted in Section K (K5), where the exception-catching
  -- pattern this file uses for every other validation check lives -- it
  -- is not repeated here to avoid two different assertion styles for the
  -- same behaviour.
end;
$$;

-- =========================================================
-- Section H: unsupported window_seconds is rejected
-- =========================================================

do $$
declare
  v_identity constant text := repeat('08', 32);
  v_rejected boolean := false;
begin
  begin
    perform public.increment_share_rate_limit_bucket('network_identity', 'session_exchange', v_identity, 1::smallint, null::uuid, 45);
  exception
    when sqlstate 'P0001' then
      if sqlerrm = 'INVALID_RATE_LIMIT_WINDOW' then
        v_rejected := true;
      end if;
  end;

  perform pg_temp.record_result(
    'H', 'H1: window_seconds = 45 (not in {60,300,3600,86400}) is rejected with INVALID_RATE_LIMIT_WINDOW',
    v_rejected
  );
end;
$$;

-- =========================================================
-- Section I: window expiry is deterministic (expires_at = window_start +
-- window_seconds exactly)
-- =========================================================

do $$
declare
  v_identity constant text := repeat('09', 32);
  v_result jsonb;
  v_window_start timestamptz;
  v_expires_at timestamptz;
begin
  select public.increment_share_rate_limit_bucket('network_identity', 'file_access', v_identity, 1::smallint, null::uuid, 3600) into v_result;
  v_window_start := (v_result->>'windowStart')::timestamptz;
  v_expires_at := (v_result->>'expiresAt')::timestamptz;

  perform pg_temp.record_result(
    'I', 'I1: expiresAt equals windowStart + windowSeconds exactly',
    v_expires_at = v_window_start + interval '3600 seconds',
    format('windowStart=%s expiresAt=%s', v_window_start, v_expires_at)
  );

  perform pg_temp.record_result(
    'I', 'I2: windowStart is floored to a clean window_seconds boundary (epoch seconds mod window_seconds = 0)',
    mod(extract(epoch from v_window_start)::bigint, 3600) = 0,
    v_window_start::text
  );
end;
$$;

-- =========================================================
-- Section J: a new logical window creates a new bucket rather than
-- accumulating into the prior one.
--
-- Uses the smallest available window (60s) and the underlying table
-- directly to INSERT a synthetic PRIOR-window row for the same bucket
-- identity, proving the RPC starts a fresh row (count = 1) for the
-- CURRENT window rather than colliding with that older, already-expired
-- window's row.
-- =========================================================

do $$
declare
  v_identity constant text := repeat('0a', 32);
  v_prior_window_start timestamptz := to_timestamp(floor(extract(epoch from now()) / 60) * 60) - interval '120 seconds';
  v_result jsonb;
begin
  insert into public.share_rate_limit_buckets (
    scope, action, identity_digest, identity_digest_version, share_link_id,
    window_start, window_seconds, request_count, expires_at
  ) values (
    'network_identity', 'comment_submission', v_identity, 1, null,
    v_prior_window_start, 60, 7, v_prior_window_start + interval '60 seconds'
  );

  select public.increment_share_rate_limit_bucket('network_identity', 'comment_submission', v_identity, 1::smallint, null::uuid, 60) into v_result;

  perform pg_temp.record_result(
    'J', 'J1: a call in a NEW logical window starts a fresh bucket (count = 1), never accumulating onto an older window''s row (which was seeded at 7)',
    (v_result->>'requestCount')::integer = 1,
    v_result::text
  );

  perform pg_temp.record_result(
    'J', 'J2: the older seeded row (count = 7) is untouched -- two distinct rows now exist for this identity/action',
    (
      select count(*) from public.share_rate_limit_buckets
      where identity_digest = v_identity and action = 'comment_submission'
    ) = 2,
    null
  );
end;
$$;

-- =========================================================
-- Section K: input validation fails closed, mirroring the table's own
-- constraint vocabulary exactly
-- =========================================================

do $$
declare
  v_identity constant text := repeat('0b', 32);
  v_link_id uuid;
  v_rejected boolean;
begin
  select value into v_link_id from fixture_ids where key = 'link_id';

  v_rejected := false;
  begin
    perform public.increment_share_rate_limit_bucket('not_a_real_scope', 'session_exchange', v_identity, 1::smallint, null::uuid, 60);
  exception when sqlstate 'P0001' then
    if sqlerrm = 'INVALID_RATE_LIMIT_SCOPE' then v_rejected := true; end if;
  end;
  perform pg_temp.record_result('K', 'K1: unsupported scope rejected', v_rejected);

  v_rejected := false;
  begin
    perform public.increment_share_rate_limit_bucket('network_identity', 'not_a_real_action', v_identity, 1::smallint, null::uuid, 60);
  exception when sqlstate 'P0001' then
    if sqlerrm = 'INVALID_RATE_LIMIT_ACTION' then v_rejected := true; end if;
  end;
  perform pg_temp.record_result('K', 'K2: unsupported action rejected', v_rejected);

  v_rejected := false;
  begin
    perform public.increment_share_rate_limit_bucket('network_identity', 'session_exchange', 'not-a-valid-hex-digest', 1::smallint, null::uuid, 60);
  exception when sqlstate 'P0001' then
    if sqlerrm = 'INVALID_RATE_LIMIT_IDENTITY_DIGEST' then v_rejected := true; end if;
  end;
  perform pg_temp.record_result('K', 'K3: malformed identity_digest rejected', v_rejected);

  v_rejected := false;
  begin
    perform public.increment_share_rate_limit_bucket('network_identity', 'session_exchange', v_identity, 0::smallint, null::uuid, 60);
  exception when sqlstate 'P0001' then
    if sqlerrm = 'INVALID_RATE_LIMIT_IDENTITY_DIGEST_VERSION' then v_rejected := true; end if;
  end;
  perform pg_temp.record_result('K', 'K4: non-positive identity_digest_version rejected', v_rejected);

  v_rejected := false;
  begin
    perform public.increment_share_rate_limit_bucket('share_link', 'projection_read', v_identity, 1::smallint, null::uuid, 60);
  exception when sqlstate 'P0001' then
    if sqlerrm = 'RATE_LIMIT_SHARE_LINK_SCOPE_REQUIRES_LINK' then v_rejected := true; end if;
  end;
  perform pg_temp.record_result('K', 'K5: scope = share_link with a null share_link_id rejected', v_rejected);

  v_rejected := false;
  begin
    perform public.increment_share_rate_limit_bucket('network_identity', 'invalid_link_access', v_identity, 1::smallint, v_link_id, 60);
  exception when sqlstate 'P0001' then
    if sqlerrm = 'RATE_LIMIT_INVALID_LINK_ACTION_FORBIDS_LINK' then v_rejected := true; end if;
  end;
  perform pg_temp.record_result('K', 'K6: action = invalid_link_access with a non-null share_link_id rejected', v_rejected);
end;
$$;

-- =========================================================
-- Final report
-- =========================================================

select seq, section, name, status, detail from test_results order by seq;

select
  count(*) as total_tests,
  count(*) filter (where status = 'PASS') as passed_tests,
  count(*) filter (where status = 'FAIL') as failed_tests
from test_results;

select seq, section, name, status, detail
from test_results
where status = 'FAIL'
order by seq;

do $$
declare
  v_failed_count integer;
  v_total_count integer;
begin
  select count(*) filter (where status = 'FAIL'), count(*)
    into v_failed_count, v_total_count
    from test_results;

  if v_failed_count > 0 then
    raise exception using errcode = 'P0001', message = format(
      'PHASE3_RATE_LIMIT_EXPECTED_SUCCESS_FAILED: %s of %s tests failed. See the FAIL-only table above for details.',
      v_failed_count, v_total_count
    );
  end if;

  raise notice 'runtime_status = PHASE_3_RATE_LIMIT_RUNTIME_PASS (% / % tests passed)', v_total_count, v_total_count;
end;
$$;

-- Always rolls back: no fixture row or test-only object this file created
-- (the shared project/project_share_links rows, the synthetic prior-
-- window bucket row, or any bucket row this file's calls produced)
-- survives a run, regardless of PASS or FAIL. Safe to re-run repeatedly
-- against the same disposable project.
rollback;
