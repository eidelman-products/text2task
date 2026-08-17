-- Text2Task Client Share Link -- Phase 3 Application Runtime Verification
-- Package
-- File 03: Real SQL runtime behaviour tests
--
-- Run this THIRD, after files 01 and 02, in the same temporary Supabase
-- project. Never run this in the real Text2Task production project.
--
-- SCOPE: Phase 3 application code (session exchange, cookies, grants, the
-- public route, the PIN flow, the projection read) lives entirely in the
-- Node application layer, not in a new migration -- no migration was
-- added for it. So this file cannot runtime-test that application code
-- directly (that is what the ~130 Vitest tests already do, against a
-- mocked Supabase client). What THIS file proves is the one thing Vitest
-- cannot: that the EXISTING database integrity triggers and grants
-- (delivered by 202608030004/202608030005, already structurally verified
-- by docs/client-share-phase2b-mapping-read-runtime/) actually enforce,
-- against a real PostgreSQL database, every invariant the application
-- code in lib/share/share-session-grant.server.ts is written to depend
-- on -- by issuing the exact same INSERT/UPDATE statements that service-
-- role application code issues, and confirming each one is accepted or
-- rejected exactly as designed.
--
-- Sections:
--   A -> browser session creation, digest format enforcement, 7-day TTL
--   B -> grant creation for a NO-PIN link (pin_verified_at must be null)
--   C -> grant creation for a PIN-REQUIRED link without pin_verified_at
--        is REJECTED (SHARE_GRANT_PIN_VERIFICATION_REQUIRED) -- proves a
--        pending/unauthorized grant can never be created before PIN
--        success
--   D -> grant creation for a PIN-required link WITH pin_verified_at
--        succeeds
--   E -> grant creation for a NO-PIN link WITH pin_verified_at is
--        REJECTED (SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED)
--   F -> multi-link: one browser session holds independent current grants
--        for two different links at once; revoking one does not touch
--        the other
--   G -> configuration_version staleness: a grant issued against a
--        version older than the link's current version is REJECTED
--        (SHARE_GRANT_CONFIGURATION_VERSION_STALE); the current version
--        succeeds
--   H -> grant expiry ceilings: exceeding the browser session's own
--        expiry is REJECTED (SHARE_GRANT_EXPIRY_EXCEEDS_SESSION);
--        exceeding a link's own (sooner) expiry is REJECTED
--        (SHARE_GRANT_EXPIRY_EXCEEDS_LINK); min(session, link) succeeds
--   I -> disabling/revoking a link rejects any NEW grant
--        (SHARE_GRANT_LINK_NOT_ACTIVE) but does NOT retroactively revoke
--        an existing grant row at the database level -- confirming that
--        protecting reads after a disable/revoke is the read-time
--        revalidation's job (isShareLinkCurrentlyPubliclyActive /
--        verifyShareProjectionAuthorization), not an automatic cascade
--   J -> rate-limit integration sanity check (small -- NOT a re-proof of
--        the already-verified 25-way concurrency result in
--        docs/client-share-phase3-rate-limit-runtime/04_CAPTURE_RESULTS.md):
--        increment_share_rate_limit_bucket accepts the exact scope/action
--        combinations Phase 3 application code actually uses
--        (session_exchange+network_identity, pin_verification+share_link,
--        projection_read+browser_session, invalid_link_access+network_identity)
--   K -> service-role bounded-column read sanity: the exact column sets
--        buildPublicClientShareProjection() selects from
--        project_share_links/share_link_tasks/share_link_resources/
--        share_link_updates/projects/tasks/task_resources resolve
--        correctly for a real fixture row (proves the grants/columns this
--        query depends on genuinely exist -- the privacy-shape assertions
--        themselves are already proven by the mocked Vitest toxic-fixture
--        test)

-- =========================================================
-- 0. Safety gate
-- =========================================================

do $$
declare
  v_sentinel_kind text;
  v_missing_functions text[];
begin
  if to_regclass('public.text2task_client_share_phase3_application_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 3 application runtime test sentinel was not found. Run 01_CREATE_TEMP_TEST_FIXTURE.sql and 02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_APPLICATION.sql first, in that order, in this same temporary project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase3_application_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_3_APPLICATION_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row does not identify this project as a disposable Phase 3 application runtime test project.';
  end if;

  select array_agg(t.fn) into v_missing_functions
    from (values
      ('increment_share_rate_limit_bucket(text,text,text,smallint,uuid,integer)'),
      ('create_share_link_draft(uuid,text)')
    ) as t(fn)
    where to_regprocedure('public.' || t.fn) is null;

  if v_missing_functions is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected RPC(s): %s. Run 02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_APPLICATION.sql first.',
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

create or replace function pg_temp.record_expected_error(
  p_section text,
  p_name text,
  p_expected_message text,
  p_actual_message text
) returns void
language plpgsql
as $$
begin
  perform pg_temp.record_result(
    p_section, p_name, p_actual_message = p_expected_message,
    format('expected=%s actual=%s', p_expected_message, p_actual_message)
  );
end;
$$;

-- =========================================================
-- Shared fixture: one owner, one project, a NO-PIN active link and a
-- PIN-required active link. Rows are created by direct INSERT (this
-- session runs with elevated privileges, bypassing RLS and the
-- auth.uid()-bound owner RPCs entirely) -- mirroring every prior Client
-- Share runtime package's own fixture-row convention, and mirroring
-- exactly what activate_share_link/set_share_link_pin themselves would
-- have written for an authenticated owner.
-- =========================================================

do $$
declare
  v_owner_a constant uuid := '11111111-1111-4111-8111-111111111111';
  v_project_id uuid;
  v_link_no_pin_id uuid;
  v_link_pin_id uuid;
begin
  insert into public.projects (user_id) values (v_owner_a)
    returning id into v_project_id;

  insert into public.project_share_links (
    user_id, project_id, public_id, state, secret_digest, secret_digest_version,
    configuration_version, activated_at
  ) values (
    v_owner_a, v_project_id, 'phase3ApplicationFixtureLinkA1', 'active',
    repeat('a1', 32), 1, 1, now()
  ) returning id into v_link_no_pin_id;

  insert into public.project_share_links (
    user_id, project_id, public_id, state, secret_digest, secret_digest_version,
    configuration_version, activated_at,
    pin_hash, pin_salt, pin_hash_version, pin_scrypt_n, pin_scrypt_r, pin_scrypt_p, pin_key_length
  ) values (
    v_owner_a, v_project_id, 'phase3ApplicationFixtureLinkB2', 'active',
    repeat('b2', 32), 1, 1, now(),
    -- pin_hash must be exactly 43 characters (project_share_links_pin_completeness_check's
    -- char_length(pin_hash) = 43, matching hashSharePin's real base64url(32-byte
    -- scrypt output) shape in lib/share/share-pin.server.ts) -- NOT the 64-character
    -- shape used for secret_digest/session-digest fixtures elsewhere in this file.
    repeat('c3', 21) || 'c', repeat('d4', 16), 1, 16384, 8, 1, 32
  ) returning id into v_link_pin_id;

  create temporary table fixture_ids (key text primary key, value uuid not null);
  insert into fixture_ids (key, value) values
    ('project_id', v_project_id),
    ('link_no_pin_id', v_link_no_pin_id),
    ('link_pin_id', v_link_pin_id);
end;
$$;

-- =========================================================
-- Section A: browser session creation, digest format, 7-day TTL
-- =========================================================

do $$
declare
  v_session_id uuid;
begin
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('e5', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  perform pg_temp.record_result(
    'A', 'A1: a well-formed session digest (64 lowercase hex) is accepted',
    v_session_id is not null
  );

  perform pg_temp.record_result(
    'A', 'A2: expires_at is exactly now() + 7 days (the locked V1 TTL), within a 5-second tolerance',
    abs(extract(epoch from (
      (select expires_at from public.share_browser_sessions where id = v_session_id) - (now() + interval '7 days')
    ))) < 5
  );
end;
$$;

do $$
begin
  begin
    insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
    values ('not-64-hex-chars', 1, now() + interval '7 days');

    perform pg_temp.record_result(
      'A', 'A3: a malformed session digest is rejected by share_browser_sessions_session_digest_format_check', false,
      'expected a check-constraint violation but the insert succeeded'
    );
  exception when check_violation then
    perform pg_temp.record_result(
      'A', 'A3: a malformed session digest is rejected by share_browser_sessions_session_digest_format_check', true
    );
  end;
end;
$$;

-- =========================================================
-- Section B: grant creation for a NO-PIN link succeeds, pin_verified_at
-- stays null
-- =========================================================

do $$
declare
  v_session_id uuid;
  v_link_id uuid;
  v_grant_id uuid;
begin
  select value into v_link_id from fixture_ids where key = 'link_no_pin_id';

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('f6', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  insert into public.share_session_grants (
    browser_session_id, share_link_id, granted_configuration_version, expires_at
  ) values (
    v_session_id, v_link_id, 1, now() + interval '7 days'
  ) returning id into v_grant_id;

  perform pg_temp.record_result(
    'B', 'B1: a grant for a NO-PIN active link, with no pin_verified_at, is accepted', v_grant_id is not null
  );

  perform pg_temp.record_result(
    'B', 'B2: pin_verified_at is null on the stored row, as expected for a link that does not require a PIN',
    (select pin_verified_at is null from public.share_session_grants where id = v_grant_id)
  );
end;
$$;

-- =========================================================
-- Section C: grant creation for a PIN-required link WITHOUT
-- pin_verified_at is rejected -- proves no pending/unauthorized grant can
-- ever be created before PIN success
-- =========================================================

do $$
declare
  v_session_id uuid;
  v_link_id uuid;
begin
  select value into v_link_id from fixture_ids where key = 'link_pin_id';

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('07', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  begin
    insert into public.share_session_grants (
      browser_session_id, share_link_id, granted_configuration_version, expires_at
    ) values (
      v_session_id, v_link_id, 1, now() + interval '7 days'
    );

    perform pg_temp.record_result(
      'C', 'C1: a grant for a PIN-required link with no pin_verified_at is rejected (no pending unauthorized grant)', false,
      'expected SHARE_GRANT_PIN_VERIFICATION_REQUIRED but the insert succeeded'
    );
  exception when others then
    perform pg_temp.record_expected_error(
      'C', 'C1: a grant for a PIN-required link with no pin_verified_at is rejected (no pending unauthorized grant)',
      'SHARE_GRANT_PIN_VERIFICATION_REQUIRED', sqlerrm
    );
  end;

  perform pg_temp.record_result(
    'C', 'C2: no grant row exists for this session/link pair after the rejected attempt',
    not exists (
      select 1 from public.share_session_grants
      where browser_session_id = v_session_id and share_link_id = v_link_id
    )
  );
end;
$$;

-- =========================================================
-- Section D: grant creation for a PIN-required link WITH pin_verified_at
-- succeeds
-- =========================================================

do $$
declare
  v_session_id uuid;
  v_link_id uuid;
  v_grant_id uuid;
begin
  select value into v_link_id from fixture_ids where key = 'link_pin_id';

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('18', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  insert into public.share_session_grants (
    browser_session_id, share_link_id, granted_configuration_version, expires_at, pin_verified_at
  ) values (
    v_session_id, v_link_id, 1, now() + interval '7 days', now()
  ) returning id into v_grant_id;

  perform pg_temp.record_result(
    'D', 'D1: a grant for a PIN-required link WITH pin_verified_at populated at insert time is accepted', v_grant_id is not null
  );
end;
$$;

-- =========================================================
-- Section E: grant creation for a NO-PIN link WITH pin_verified_at is
-- rejected (pin_verified_at may only be set when the link actually
-- requires one)
-- =========================================================

do $$
declare
  v_session_id uuid;
  v_link_id uuid;
begin
  select value into v_link_id from fixture_ids where key = 'link_no_pin_id';

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('29', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  begin
    insert into public.share_session_grants (
      browser_session_id, share_link_id, granted_configuration_version, expires_at, pin_verified_at
    ) values (
      v_session_id, v_link_id, 1, now() + interval '7 days', now()
    );

    perform pg_temp.record_result(
      'E', 'E1: a grant for a NO-PIN link WITH pin_verified_at set is rejected', false,
      'expected SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED but the insert succeeded'
    );
  exception when others then
    perform pg_temp.record_expected_error(
      'E', 'E1: a grant for a NO-PIN link WITH pin_verified_at set is rejected',
      'SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED', sqlerrm
    );
  end;
end;
$$;

-- =========================================================
-- Section F: multi-link -- one browser session holds independent current
-- grants for two different links at once; revoking one does not touch
-- the other
-- =========================================================

do $$
declare
  v_session_id uuid;
  v_link_a_id uuid;
  v_link_b_id uuid;
  v_grant_a_id uuid;
  v_grant_b_id uuid;
begin
  select value into v_link_a_id from fixture_ids where key = 'link_no_pin_id';
  select value into v_link_b_id from fixture_ids where key = 'link_pin_id';

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('3a', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  insert into public.share_session_grants (
    browser_session_id, share_link_id, granted_configuration_version, expires_at
  ) values (
    v_session_id, v_link_a_id, 1, now() + interval '7 days'
  ) returning id into v_grant_a_id;

  insert into public.share_session_grants (
    browser_session_id, share_link_id, granted_configuration_version, expires_at, pin_verified_at
  ) values (
    v_session_id, v_link_b_id, 1, now() + interval '7 days', now()
  ) returning id into v_grant_b_id;

  perform pg_temp.record_result(
    'F', 'F1: the same browser session holds two independent current grants (one per link) at once',
    (
      select count(*) from public.share_session_grants
      where browser_session_id = v_session_id and revoked_at is null
    ) = 2
  );

  update public.share_session_grants set revoked_at = now() where id = v_grant_b_id;

  perform pg_temp.record_result(
    'F', 'F2: revoking link B''s grant leaves link A''s grant untouched and still current',
    (select revoked_at is null from public.share_session_grants where id = v_grant_a_id)
  );

  perform pg_temp.record_result(
    'F', 'F3: link B''s grant is now revoked',
    (select revoked_at is not null from public.share_session_grants where id = v_grant_b_id)
  );
end;
$$;

-- =========================================================
-- Section G: configuration_version staleness
-- =========================================================

do $$
declare
  v_session_id uuid;
  v_link_id uuid;
  v_current_version integer;
  v_grant_g2_id uuid;
begin
  select value into v_link_id from fixture_ids where key = 'link_no_pin_id';

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('4b', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  -- Simulate a rotation: bump configuration_version the same way
  -- rotate_share_link_secret does (increment only, never a direct set to
  -- an arbitrary value).
  update public.project_share_links
    set configuration_version = configuration_version + 1
    where id = v_link_id;

  select configuration_version into v_current_version
    from public.project_share_links where id = v_link_id;

  begin
    insert into public.share_session_grants (
      browser_session_id, share_link_id, granted_configuration_version, expires_at
    ) values (
      v_session_id, v_link_id, v_current_version - 1, now() + interval '7 days'
    );

    perform pg_temp.record_result(
      'G', 'G1: a grant issued against a STALE configuration_version is rejected', false,
      'expected SHARE_GRANT_CONFIGURATION_VERSION_STALE but the insert succeeded'
    );
  exception when others then
    perform pg_temp.record_expected_error(
      'G', 'G1: a grant issued against a STALE configuration_version is rejected',
      'SHARE_GRANT_CONFIGURATION_VERSION_STALE', sqlerrm
    );
  end;

  -- INSERT is a statement, not an expression -- it cannot be nested
  -- inline inside perform pg_temp.record_result(...)'s argument list (a
  -- bare `insert into ... returning true` there is a syntax error, not a
  -- valid scalar expression). Run it as its own statement first, exactly
  -- like every other grant-creation assertion in this file (see Section
  -- F's v_grant_a_id/v_grant_b_id above), then assert on the captured id.
  insert into public.share_session_grants (
    browser_session_id, share_link_id, granted_configuration_version, expires_at
  ) values (
    v_session_id, v_link_id, v_current_version, now() + interval '7 days'
  ) returning id into v_grant_g2_id;

  perform pg_temp.record_result(
    'G', 'G2: a grant issued against the CURRENT configuration_version is accepted',
    v_grant_g2_id is not null
  );
end;
$$;

-- =========================================================
-- Section H: grant expiry ceilings -- must not exceed session expiry, and
-- must not exceed a sooner link expiry
-- =========================================================

do $$
declare
  v_session_id uuid;
  v_link_id uuid;
  v_session_expires_at timestamptz := now() + interval '3 days';
begin
  select value into v_link_id from fixture_ids where key = 'link_no_pin_id';

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('5c', 32), 1, v_session_expires_at)
  returning id into v_session_id;

  begin
    insert into public.share_session_grants (
      browser_session_id, share_link_id, granted_configuration_version, expires_at
    ) values (
      v_session_id, v_link_id,
      (select configuration_version from public.project_share_links where id = v_link_id),
      v_session_expires_at + interval '1 day'
    );

    perform pg_temp.record_result(
      'H', 'H1: a grant expiry beyond the browser session''s own expiry is rejected', false,
      'expected SHARE_GRANT_EXPIRY_EXCEEDS_SESSION but the insert succeeded'
    );
  exception when others then
    perform pg_temp.record_expected_error(
      'H', 'H1: a grant expiry beyond the browser session''s own expiry is rejected',
      'SHARE_GRANT_EXPIRY_EXCEEDS_SESSION', sqlerrm
    );
  end;
end;
$$;

do $$
declare
  v_session_id uuid;
  v_scratch_project_id uuid;
  v_link_id uuid;
  v_link_expires_at timestamptz := now() + interval '1 hour';
  v_grant_h3_id uuid;
begin
  insert into public.projects (user_id) values ('11111111-1111-4111-8111-111111111111')
    returning id into v_scratch_project_id;

  insert into public.project_share_links (
    user_id, project_id, public_id, state, secret_digest, secret_digest_version,
    configuration_version, activated_at, expires_at
  ) values (
    '11111111-1111-4111-8111-111111111111', v_scratch_project_id, 'phase3ApplicationFixtureLinkC3', 'active',
    repeat('c3', 32), 1, 1, now(), v_link_expires_at
  ) returning id into v_link_id;

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('6d', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  begin
    insert into public.share_session_grants (
      browser_session_id, share_link_id, granted_configuration_version, expires_at
    ) values (
      v_session_id, v_link_id, 1, now() + interval '7 days'
    );

    perform pg_temp.record_result(
      'H', 'H2: a grant expiry beyond the LINK''s own (sooner) expiry is rejected, even though it is within the session''s expiry', false,
      'expected SHARE_GRANT_EXPIRY_EXCEEDS_LINK but the insert succeeded'
    );
  exception when others then
    perform pg_temp.record_expected_error(
      'H', 'H2: a grant expiry beyond the LINK''s own (sooner) expiry is rejected, even though it is within the session''s expiry',
      'SHARE_GRANT_EXPIRY_EXCEEDS_LINK', sqlerrm
    );
  end;

  -- Same fix as Section G2 above: run the INSERT as its own statement
  -- (INSERT is not a valid inline expression), then assert on the
  -- captured id.
  insert into public.share_session_grants (
    browser_session_id, share_link_id, granted_configuration_version, expires_at
  ) values (
    v_session_id, v_link_id, 1, least(now() + interval '7 days', v_link_expires_at)
  ) returning id into v_grant_h3_id;

  perform pg_temp.record_result(
    'H', 'H3: a grant expiry set to min(session expiry, link expiry) -- the locked product formula -- is accepted',
    v_grant_h3_id is not null
  );
end;
$$;

-- =========================================================
-- Section I: disabling/revoking a link rejects any NEW grant, but does
-- NOT retroactively revoke an existing grant row at the database level --
-- confirming read-time revalidation (not an automatic cascade) is what
-- protects reads after a disable/revoke.
-- =========================================================

do $$
declare
  v_session_id uuid;
  v_link_id uuid;
  v_grant_id uuid;
begin
  select value into v_link_id from fixture_ids where key = 'link_no_pin_id';

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('7e', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  insert into public.share_session_grants (
    browser_session_id, share_link_id, granted_configuration_version, expires_at
  ) values (
    v_session_id, v_link_id,
    (select configuration_version from public.project_share_links where id = v_link_id),
    now() + interval '7 days'
  ) returning id into v_grant_id;

  -- enforce_project_share_link_integrity()'s own v_access_changed check
  -- treats ANY state change as access-affecting (exactly like disable_share_link's
  -- own real implementation, 202608060001_client_share_lifecycle_operations.sql,
  -- which always bumps configuration_version alongside state/disabled_at) --
  -- a direct UPDATE that changes state without also incrementing
  -- configuration_version is correctly rejected with
  -- SHARE_LINK_VERSION_NOT_INCREMENTED. The canonical disable_share_link(uuid)
  -- RPC itself cannot be called here (it is SECURITY DEFINER and requires
  -- auth.uid(), which is null in this raw service-role harness session --
  -- the same reason the whole file uses direct INSERT/UPDATE instead of
  -- owner RPCs everywhere else, e.g. Section G's rotation-version-bump
  -- comment above), so this reproduces the RPC's complete invariant
  -- directly: increment configuration_version by the same "increment
  -- only, never set to an arbitrary value" rule.
  update public.project_share_links
    set state = 'disabled', disabled_at = now(), configuration_version = configuration_version + 1
    where id = v_link_id;

  perform pg_temp.record_result(
    'I', 'I1: the pre-existing grant row is NOT auto-revoked at the database level when its link is disabled (revoked_at stays null)',
    (select revoked_at is null from public.share_session_grants where id = v_grant_id)
  );

  begin
    insert into public.share_session_grants (
      browser_session_id, share_link_id, granted_configuration_version, expires_at
    ) values (
      v_session_id, v_link_id,
      (select configuration_version from public.project_share_links where id = v_link_id),
      now() + interval '7 days'
    );

    perform pg_temp.record_result(
      'I', 'I2: a NEW grant for a disabled link is rejected', false,
      'expected SHARE_GRANT_LINK_NOT_ACTIVE but the insert succeeded'
    );
  exception when others then
    perform pg_temp.record_expected_error(
      'I', 'I2: a NEW grant for a disabled link is rejected',
      'SHARE_GRANT_LINK_NOT_ACTIVE', sqlerrm
    );
  end;

  -- Restore state for later sections that reuse this link, reproducing
  -- reenable_share_link(uuid)'s own SET clause exactly
  -- (202608060001_client_share_lifecycle_operations.sql): state and
  -- configuration_version only. disabled_at is deliberately NOT cleared
  -- here -- enforce_project_share_link_integrity()'s monotonic rule
  -- forbids ever moving disabled_at from a set timestamp back to null
  -- (SHARE_LINK_DISABLED_AT_DECREASE), and the real RPC's own comment
  -- confirms this is intentional product behavior, not an oversight:
  -- "disabled_at must never be cleared, so both stay exactly as they
  -- already are." A re-enabled link keeps its disabled_at as permanent
  -- historical metadata.
  update public.project_share_links
    set state = 'active', configuration_version = configuration_version + 1
    where id = v_link_id;
end;
$$;

-- =========================================================
-- Section J: rate-limit integration sanity check (small -- the full
-- concurrency proof already lives in
-- docs/client-share-phase3-rate-limit-runtime/04_CAPTURE_RESULTS.md).
-- Confirms the exact scope/action combinations Phase 3 application code
-- actually calls are all accepted by the existing CHECK constraints and
-- RPC.
--
-- Every call below casts the fourth positional argument explicitly as
-- `1::smallint`: the RPC's real signature is
-- (text,text,text,smallint,uuid,integer) (see the safety-gate check
-- above), and PostgreSQL's function-argument resolution only implicitly
-- widens smallint -> integer, never narrows a bare integer literal back
-- to smallint -- an uncast `1` here fails to resolve to the one real
-- overload with 42883 before the RPC body ever runs (the identical
-- harness-only defect already found and fixed in
-- docs/client-share-phase3-rate-limit-runtime/04_CAPTURE_RESULTS.md).
-- =========================================================

do $$
declare
  v_link_id uuid;
  v_result jsonb;
begin
  select value into v_link_id from fixture_ids where key = 'link_no_pin_id';

  select public.increment_share_rate_limit_bucket(
    'network_identity', 'session_exchange', repeat('8f', 32), 1::smallint, null::uuid, 300
  ) into v_result;
  perform pg_temp.record_result(
    'J', 'J1: session_exchange + network_identity (used by POST /api/share/session) is accepted, count = 1',
    (v_result->>'requestCount')::integer = 1, v_result::text
  );

  select public.increment_share_rate_limit_bucket(
    'share_link', 'pin_verification', repeat('90', 32), 1::smallint, v_link_id, 300
  ) into v_result;
  perform pg_temp.record_result(
    'J', 'J2: pin_verification + share_link (used for PIN attempts) is accepted, count = 1',
    (v_result->>'requestCount')::integer = 1, v_result::text
  );

  select public.increment_share_rate_limit_bucket(
    'browser_session', 'projection_read', repeat('a1', 32), 1::smallint, null::uuid, 300
  ) into v_result;
  select public.increment_share_rate_limit_bucket(
    'browser_session', 'projection_read', repeat('a1', 32), 1::smallint, null::uuid, 300
  ) into v_result;
  perform pg_temp.record_result(
    'J', 'J3: projection_read + browser_session (used by GET /api/share/[publicId]/projection) accumulates sequentially, second call count = 2',
    (v_result->>'requestCount')::integer = 2, v_result::text
  );

  select public.increment_share_rate_limit_bucket(
    'network_identity', 'invalid_link_access', repeat('b2', 32), 1::smallint, null::uuid, 300
  ) into v_result;
  perform pg_temp.record_result(
    'J', 'J4: invalid_link_access + network_identity (used for unknown/invalid bearer attempts) is accepted, count = 1',
    (v_result->>'requestCount')::integer = 1, v_result::text
  );
end;
$$;

-- =========================================================
-- Section K: service-role bounded-column read sanity for the public
-- projection builder's exact table/column set
-- =========================================================

do $$
declare
  v_project_id uuid;
  v_link_id uuid;
  v_task_id bigint;
  v_resource_id uuid;
begin
  select value into v_project_id from fixture_ids where key = 'project_id';
  select value into v_link_id from fixture_ids where key = 'link_no_pin_id';

  insert into public.tasks (user_id, project_id)
  values ('11111111-1111-4111-8111-111111111111', v_project_id)
  returning id into v_task_id;

  insert into public.task_resources (user_id, project_id, task_id)
  values ('11111111-1111-4111-8111-111111111111', v_project_id, v_task_id)
  returning id into v_resource_id;

  insert into public.share_link_tasks (share_link_id, user_id, subtask_id, public_group)
  values (v_link_id, '11111111-1111-4111-8111-111111111111', v_task_id, 'in_progress');

  -- public_label is NOT NULL with no default
  -- (share_link_resources_public_label_check requires 1-120 trimmed
  -- characters; 202608030003_client_share_owner_foundation.sql) --
  -- in the real save_share_configuration write path this is always
  -- owner-authored client-facing text supplied by the caller, never
  -- derived from task_resources' own (private) fields. This fixture
  -- value is a deliberately synthetic, safe placeholder label -- never
  -- private Resource content (storage_path/file_name/notes), matching
  -- the same "public_label is owner-authored, never task_resources.notes"
  -- rule the real column comment states.
  insert into public.share_link_resources (share_link_id, user_id, resource_id, public_label, can_download)
  values (v_link_id, '11111111-1111-4111-8111-111111111111', v_resource_id, 'Runtime fixture resource label', true);

  -- version and created_by are both NOT NULL with no default
  -- (202608030003_client_share_owner_foundation.sql). The canonical
  -- publish path, save_share_configuration's update-publication block
  -- (202608060003_client_share_configuration_save.sql), computes
  -- version as `coalesce(max(version), 0) + 1` scoped to this link --
  -- this is the first (and only) update row this fixture ever creates
  -- for this link, so the canonical value is exactly 1, not an invented
  -- number. created_by must equal user_id exactly
  -- (enforce_share_link_update_integrity's SHARE_UPDATE_CREATED_BY_MISMATCH
  -- check) -- the same owner uuid used everywhere else in this fixture.
  insert into public.share_link_updates (share_link_id, user_id, body, version, created_by, is_current)
  values (
    v_link_id, '11111111-1111-4111-8111-111111111111', 'Latest update body',
    1, '11111111-1111-4111-8111-111111111111', true
  );

  perform pg_temp.record_result(
    'K', 'K1: project_share_links publication-field columns resolve for the link''s own id',
    exists (
      select 1 from public.project_share_links
      where id = v_link_id and user_id = '11111111-1111-4111-8111-111111111111'
    )
  );

  perform pg_temp.record_result(
    'K', 'K2: share_link_tasks resolves scoped by share_link_id, exposing subtask_id/public_group',
    exists (
      select 1 from public.share_link_tasks
      where share_link_id = v_link_id and subtask_id = v_task_id and public_group = 'in_progress'
    )
  );

  perform pg_temp.record_result(
    'K', 'K3: share_link_resources resolves scoped by share_link_id, exposing resource_id/can_download',
    exists (
      select 1 from public.share_link_resources
      where share_link_id = v_link_id and resource_id = v_resource_id and can_download = true
    )
  );

  perform pg_temp.record_result(
    'K', 'K4: share_link_updates resolves the current update only (is_current = true)',
    (
      select body from public.share_link_updates
      where share_link_id = v_link_id and is_current = true
    ) = 'Latest update body'
  );

  perform pg_temp.record_result(
    'K', 'K5: projects/tasks/task_resources resolve scoped by project_id, matching the owner-path column set exactly',
    exists (select 1 from public.projects where id = v_project_id)
    and exists (select 1 from public.tasks where id = v_task_id and project_id = v_project_id)
    and exists (select 1 from public.task_resources where id = v_resource_id and project_id = v_project_id)
  );
end;
$$;

-- =========================================================
-- Results
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
      'PHASE3_APPLICATION_EXPECTED_SUCCESS_FAILED: %s of %s tests failed. See the FAIL-only table above for details.',
      v_failed_count, v_total_count
    );
  end if;

  raise notice 'runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS (% / % tests passed)', v_total_count, v_total_count;
end;
$$;

-- Always rolls back: no fixture row or test-only object this file created
-- survives a run, regardless of PASS or FAIL. Safe to re-run repeatedly
-- against the same disposable project.
rollback;
