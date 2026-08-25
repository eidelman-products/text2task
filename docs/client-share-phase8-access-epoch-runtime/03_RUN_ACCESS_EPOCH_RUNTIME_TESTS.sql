-- Text2Task Client Share Link -- Phase 8 Access Epoch Runtime Verification Package
-- File 03: Real PostgreSQL runtime behaviour tests
--
-- Run this FOURTH (LAST), after files 01, 02, 02B, and 02C, in the same
-- disposable Supabase project. Never run this in the real Text2Task
-- production project.
--
-- SCOPE: this file proves the access_epoch/pin_epoch corrective change
-- against a real PostgreSQL engine by issuing real INSERT/UPDATE/DELETE
-- statements and calling the REAL owner RPCs (create_share_link_draft,
-- activate_share_link, disable_share_link, reenable_share_link,
-- rotate_share_link_secret, set_share_link_pin, clear_share_link_pin,
-- set_share_link_expiry, clear_share_link_expiry, revoke_share_link,
-- save_share_configuration) -- not by inspecting catalog metadata alone
-- (metadata checks are used only where the requirement itself is
-- structural, e.g. "RLS is enabled").
--
-- SCOPING NOTE on PIN cryptography: PIN hashing/verification
-- (lib/share/share-pin.server.ts, Node crypto.scrypt) is pure JavaScript
-- with NO database dependency at all -- it is already covered by
-- extensive existing unit tests (lib/share/share-pin.server.test.ts) and
-- is not re-implemented in PL/pgSQL here. This file's own PIN-recovery
-- emulation (pg_temp.emulate_pin_recovery) takes a p_pin_correct boolean
-- INPUT representing what a real scrypt comparison would have returned,
-- and proves everything downstream of that comparison at the real
-- database layer: the access_epoch rotation-guard, the pin_epoch
-- match/mismatch, and the resulting grant's own columns. This is a
-- deliberate scope boundary, not a masked gap -- see 00_READ_ME_FIRST.md.
--
-- SCOPING NOTE on concurrency (Runtime Requirement I): this file runs as
-- ONE single database session executing statements sequentially. It
-- cannot exercise a genuine multi-connection race (e.g. two simultaneous
-- POST /api/share/session calls for the same never-before-seen
-- session/link pair). What it DOES prove directly: that a single
-- rotation/PIN-change increments its own epoch by EXACTLY one (not zero,
-- not two), that the increment lands in the SAME UPDATE statement as
-- configuration_version (so no intermediate mixed state is ever
-- observable to any concurrent reader), and that the partial unique
-- index share_session_grants_current_unique_idx -- the actual mechanism
-- ensureCurrentGrant's own application-layer race-recheck depends on --
-- is genuinely installed. True multi-connection concurrency is already
-- covered by lib/share/share-session-grant.server.test.ts's own
-- dedicated 23505-race unit tests (mocked, not this file's job to
-- duplicate).
--
-- SECTION ISOLATION (added 2026-08-25, after repeated single-error
-- abort-and-rerun cycles cost many hours of manual Supabase runs):
-- every one of Sections A-J below is its OWN top-level `do $$ ... $$`
-- block ending in `exception when others then perform
-- pg_temp.record_result('<letter>', 'UNEXPECTED EXCEPTION in Section
-- <letter> -- SQLSTATE=... SQLERRM=...', false); end;`. PL/pgSQL
-- implicitly establishes a savepoint at each `do` block's own BEGIN; an
-- exception rolls back ONLY that block's own work to its own savepoint
-- before the handler runs -- so one section's unanticipated failure
-- rolls back cleanly and reports itself as a FAIL row, but never
-- prevents any LATER section from running and reporting its own
-- results. This produces ONE complete diagnostic run showing every
-- currently-failing section at once, instead of one error per manual
-- run. Two invariants this depends on, both true here: (1) the
-- exception handler's own record_result call always passes a literal
-- `false` -- an unexpected exception can never be classified as a PASS;
-- (2) Section G's own pre-existing INNER exception block (its G5b
-- sub-test, which asserts on an EXPECTED database rejection) is nested
-- strictly inside Section G's new OUTER handler and catches its own
-- specific sqlstate 'P0001' case first -- only a genuinely unexpected
-- exception anywhere else in Section G would ever reach the outer
-- handler. Because section-level rollback means a later section can no
-- longer rely on an earlier section's fixture rows still existing,
-- Section C (previously written to continue Section B's own scenario)
-- was made fully self-contained (its own project/link/session/grant
-- setup) rather than depending on Section B's output -- see the
-- SESSION-DIGEST NAMESPACE note below for its own reserved digest.
--
-- Sections:
--   A -> backfill verification against the REAL pre-existing rows 02B
--        seeded and 02C's migration backfilled (Runtime Requirement A)
--   B -> same-browser Disable/Re-enable regression -- the exact
--        Production defect (Runtime Requirement B)
--   C -> nine configuration-change sub-scenarios, same grant stays valid
--        (Runtime Requirement C)
--   D -> secret rotation (Runtime Requirement D)
--   E -> PIN semantics: no-PIN->add, PIN A->PIN B, clear PIN (Runtime
--        Requirement E)
--   F -> expiry semantics (Runtime Requirement F)
--   G -> revoke (Runtime Requirement G)
--   H -> privilege / security regression (Runtime Requirement H)
--   I -> concurrency/atomicity, single-session evidence (Runtime
--        Requirement I)
--   J -> installed-function source integrity (Runtime Requirement J)
--   K -> final PASS/FAIL verdict (Runtime Requirement K)
--
-- SESSION-DIGEST NAMESPACE (added 2026-08-25 after a Step 7
-- `share_browser_sessions_session_digest_unique` collision -- 02B's own
-- committed `session_no_pin` fixture and this file's own Section D both
-- used repeat('e5', 32), and independently, repeat('55', 32) was reused
-- FIVE times across this file's own Sections B/D/E/F/G): every
-- `share_browser_sessions` row this file creates uses a
-- section-prefixed, globally-unique 2-lowercase-hex-character seed via
-- `repeat('XX', 32)` -- b1 (Section B), c1 (Section C, made
-- self-contained 2026-08-25 per the Section-isolation redesign below),
-- d1/d2 (Section D outer/nested), e1 (Section E), f1/f2 (Section F --
-- f1 is the long-lived session used for the link-expiry sub-tests, f2
-- is a SEPARATE freshly-issued short-TTL session used only for the
-- independent session-TTL sub-test, added 2026-08-25 as part of the
-- Section F redesign below), 90/91/92 (Section G's three sessions).
-- 02B's own four seeds (e5, f6, a7, b8) are RESERVED -- never reuse them
-- here. scripts/client-share/build-phase8-access-epoch-runtime-package.test.ts's
-- own "fixture uniqueness collision detector" suite mechanically
-- re-verifies this invariant (and the analogous one for
-- project_share_links.public_id) across 02B + this file combined on
-- every run, so a future edit that reintroduces a collision fails a
-- local test before anyone burns another disposable Supabase run finding
-- out the hard way.

-- =========================================================
-- 0. Safety gate
-- =========================================================

do $$
declare
  v_sentinel_kind text;
  v_missing text[];
begin
  if to_regclass('public.text2task_phase8_access_epoch_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 8 Access Epoch runtime test sentinel was not found. Run files 01, 02, 02B and 02C first, in that order, in this same disposable project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_phase8_access_epoch_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_8_ACCESS_EPOCH_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row does not identify this project as a disposable Phase 8 Access Epoch runtime test project.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'project_share_links' and column_name = 'access_epoch'
  ) then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.project_share_links.access_epoch does not exist yet. Run 02C_APPLY_ACCESS_EPOCH_MIGRATION.sql first.';
  end if;

  select array_agg(t.name) into v_missing
    from (values
      ('table:project_share_links'),
      ('table:share_session_grants'),
      ('function:enforce_share_session_grant_integrity()'),
      ('function:rotate_share_link_secret(uuid,text,smallint,text,text,text,smallint)'),
      ('function:set_share_link_pin(uuid,text,text,smallint,integer,integer,integer,integer)')
    ) as t(name)
    where (
      split_part(t.name, ':', 1) = 'table'
      and to_regclass('public.' || split_part(t.name, ':', 2)) is null
    ) or (
      split_part(t.name, ':', 1) = 'function'
      and to_regprocedure('public.' || split_part(t.name, ':', 2)) is null
    );

  if v_missing is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected object(s): %s.',
      array_to_string(v_missing, ', ')
    );
  end if;

  if not exists (select 1 from public.text2task_phase8_fixture_ids where key = 'link_no_pin_active') then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. No pre-migration fixture rows found. Run 02B_SEED_PRE_MIGRATION_PRODUCT_FIXTURES.sql (before 02C) first.';
  end if;
end;
$$;

begin;

-- Always rolled back at the end of this file (see the trailing
-- `rollback;`), so no fixture row or test-only object THIS FILE creates
-- ever survives a run -- safe to re-run against the same disposable
-- project as many times as needed. This does NOT roll back files 01,
-- 02, 02B or 02C's own committed work (already committed before this
-- file ever began) -- Section A below reads that already-permanent state
-- exactly as it exists right now.

create table test_results (
  seq integer generated always as identity,
  section text not null,
  name text not null,
  status text not null,
  detail text null
);

grant select, insert on test_results to anon, authenticated, service_role;
grant usage, select on sequence test_results_seq_seq to anon, authenticated, service_role;

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

-- Switches the current session to p_role (anon / authenticated /
-- service_role / postgres), simulating auth.uid() = p_user_id via the
-- same request.jwt.claims GUC Supabase's own auth.uid() reads. Always
-- RESETs to the original superuser session identity first, matching
-- every prior Client Share runtime package's own act_as() exactly.
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
-- Emulation layer: mirrors lib/share/share-session-grant.server.ts's own
-- query shapes and decision logic EXACTLY (re-read from the current
-- repository source, function by function, immediately before writing
-- these). Every write these functions perform is a REAL INSERT/UPDATE
-- against the REAL tables, so the REAL enforce_share_session_grant_integrity
-- trigger validates every one of them -- these are not a parallel,
-- unchecked implementation, only a orchestration layer that lets this
-- SQL-only test harness drive the same sequence of database operations
-- the TypeScript application layer would.
-- =========================================================

-- Mirrors isShareLinkCurrentlyPubliclyActive exactly: state = 'active',
-- expires_at is null or in the future, project exists and is not deleted.
--
-- Uses clock_timestamp(), NOT now() -- PostgreSQL freezes now() (and
-- current_timestamp/transaction_timestamp()) to the START of the current
-- transaction for its ENTIRE duration, including across any pg_sleep()
-- calls; only clock_timestamp() advances with genuine wall-clock time.
-- Since this file's own Section F deliberately calls pg_sleep() to let a
-- short-lived expiry genuinely pass (rather than backdating a row, which
-- the real triggers reject -- see that section's own header), an
-- expiry check using now() here would NEVER observe the sleep and would
-- silently keep reporting "still active" forever, which would not merely
-- fail loudly -- it would make Section F's own denial assertions pass
-- for the wrong reason (or not at all), a correctness bug in the harness
-- itself, not just an inconvenience. The real TypeScript equivalent
-- (isShareLinkCurrentlyPubliclyActive, using `new Date(link.expiresAt).getTime()
-- <= Date.now()`) always reads genuine wall-clock time, which
-- clock_timestamp() is this function's own correct analogue of.
create or replace function pg_temp.emulate_is_link_active(p_link_id uuid)
returns boolean language plpgsql as $f$
declare
  v_state text;
  v_expires_at timestamptz;
  v_project_id uuid;
  v_user_id uuid;
  v_deleted_at timestamptz;
begin
  select state, expires_at, project_id, user_id into v_state, v_expires_at, v_project_id, v_user_id
    from public.project_share_links where id = p_link_id;

  if v_state is distinct from 'active' then
    return false;
  end if;

  if v_expires_at is not null and v_expires_at <= clock_timestamp() then
    return false;
  end if;

  select deleted_at into v_deleted_at
    from public.projects where id = v_project_id and user_id = v_user_id;

  return v_deleted_at is null;
end;
$f$;

-- Mirrors resolveShareLinkByPublicId's own null-for-revoked-or-missing
-- contract exactly (by id, since this harness already holds ids rather
-- than public_ids throughout).
create or replace function pg_temp.emulate_link_resolves(p_link_id uuid)
returns boolean language plpgsql as $f$
declare
  v_state text;
begin
  select state into v_state from public.project_share_links where id = p_link_id;
  return v_state is not null and v_state <> 'revoked';
end;
$f$;

-- Mirrors verifyShareProjectionAuthorization exactly: session live +
-- unrevoked, link resolves + currently active, grant exists +
-- access_epoch matches + pin_epoch matches + PIN-requirement satisfied.
create or replace function pg_temp.emulate_verify_authorization(p_session_id uuid, p_link_id uuid)
returns boolean language plpgsql as $f$
declare
  v_session_ok boolean;
  v_link_access_epoch integer;
  v_link_pin_epoch integer;
  v_link_pin_hash text;
  v_grant record;
begin
  -- clock_timestamp(), not now() -- see emulate_is_link_active's own
  -- comment above for the full reasoning (this is the browser-session
  -- TTL analogue of the identical link-expiry concern).
  select (expires_at > clock_timestamp() and revoked_at is null) into v_session_ok
    from public.share_browser_sessions where id = p_session_id;
  if v_session_ok is not true then
    return false;
  end if;

  if not pg_temp.emulate_link_resolves(p_link_id) then
    return false;
  end if;

  if not pg_temp.emulate_is_link_active(p_link_id) then
    return false;
  end if;

  select access_epoch, pin_epoch, pin_hash into v_link_access_epoch, v_link_pin_epoch, v_link_pin_hash
    from public.project_share_links where id = p_link_id;

  select granted_access_epoch, granted_pin_epoch, pin_verified_at into v_grant
    from public.share_session_grants
    where browser_session_id = p_session_id and share_link_id = p_link_id and revoked_at is null
    limit 1;

  if v_grant is null then
    return false;
  end if;

  if v_grant.granted_access_epoch <> v_link_access_epoch then
    return false;
  end if;

  if v_grant.granted_pin_epoch <> v_link_pin_epoch then
    return false;
  end if;

  if v_link_pin_hash is not null and v_grant.pin_verified_at is null then
    return false;
  end if;

  return true;
end;
$f$;

-- Mirrors ensureCurrentGrant exactly (single-session simplification:
-- omits the 23505 race-recheck branch, already covered by
-- lib/share/share-session-grant.server.test.ts's own mocked unit tests).
create or replace function pg_temp.emulate_ensure_current_grant(
  p_session_id uuid,
  p_link_id uuid,
  p_link_configuration_version integer,
  p_link_access_epoch integer,
  p_link_pin_epoch integer,
  p_pin_verified_now boolean
) returns boolean language plpgsql as $f$
declare
  v_existing record;
  v_still_valid boolean;
  v_session_expires_at timestamptz;
  v_now timestamptz := now();
begin
  select id, granted_access_epoch, granted_pin_epoch into v_existing
    from public.share_session_grants
    where browser_session_id = p_session_id and share_link_id = p_link_id and revoked_at is null
    limit 1;

  if v_existing is not null then
    v_still_valid := v_existing.granted_access_epoch = p_link_access_epoch
      and v_existing.granted_pin_epoch = p_link_pin_epoch;

    if v_still_valid then
      return true;
    end if;

    update public.share_session_grants set revoked_at = v_now
      where id = v_existing.id and revoked_at is null;
  end if;

  select expires_at into v_session_expires_at
    from public.share_browser_sessions where id = p_session_id;

  insert into public.share_session_grants (
    browser_session_id, share_link_id, granted_configuration_version,
    granted_access_epoch, granted_pin_epoch, created_at, pin_verified_at, expires_at
  ) values (
    p_session_id, p_link_id, p_link_configuration_version,
    p_link_access_epoch, p_link_pin_epoch, v_now,
    case when p_pin_verified_now then v_now else null end,
    v_session_expires_at
  );

  return true;
end;
$f$;

-- Mirrors findAnyGrantForSession exactly: most recent grant for this
-- (session, link) pair, ANY status.
create or replace function pg_temp.emulate_find_any_grant_for_session(p_session_id uuid, p_link_id uuid)
returns integer language plpgsql as $f$
declare
  v_epoch integer;
begin
  select granted_access_epoch into v_epoch
    from public.share_session_grants
    where browser_session_id = p_session_id and share_link_id = p_link_id
    order by created_at desc
    limit 1;
  return v_epoch;
end;
$f$;

-- Mirrors POST /api/share/[publicId]/pin's own decision order exactly:
-- link must resolve + be active, must require a PIN, caller must have a
-- prior grant for this exact (session, link) pair, that prior grant's
-- access_epoch must still match the link's live access_epoch (the
-- rotation guard), THEN (and only then) the PIN comparison result
-- (p_pin_correct, see this file's own header scoping note) decides
-- success, which refreshes the grant via emulate_ensure_current_grant.
create or replace function pg_temp.emulate_pin_recovery(p_session_id uuid, p_link_id uuid, p_pin_correct boolean)
returns boolean language plpgsql as $f$
declare
  v_link_pin_hash text;
  v_link_configuration_version integer;
  v_link_access_epoch integer;
  v_link_pin_epoch integer;
  v_prior_access_epoch integer;
begin
  if not pg_temp.emulate_link_resolves(p_link_id) then
    return false;
  end if;

  if not pg_temp.emulate_is_link_active(p_link_id) then
    return false;
  end if;

  select pin_hash, configuration_version, access_epoch, pin_epoch
    into v_link_pin_hash, v_link_configuration_version, v_link_access_epoch, v_link_pin_epoch
    from public.project_share_links where id = p_link_id;

  if v_link_pin_hash is null then
    return false;
  end if;

  v_prior_access_epoch := pg_temp.emulate_find_any_grant_for_session(p_session_id, p_link_id);
  if v_prior_access_epoch is null then
    return false;
  end if;

  if v_prior_access_epoch <> v_link_access_epoch then
    return false;
  end if;

  if not p_pin_correct then
    return false;
  end if;

  return pg_temp.emulate_ensure_current_grant(
    p_session_id, p_link_id, v_link_configuration_version, v_link_access_epoch, v_link_pin_epoch, true
  );
end;
$f$;

-- Mirrors POST /api/share/session's own decision order for the
-- "fresh/new browser" case: link must resolve + be active BEFORE any
-- grant is ever created -- so a revoked/inactive link never gets a new
-- grant row at all (Runtime Requirement G4).
create or replace function pg_temp.emulate_session_exchange(
  p_session_id uuid,
  p_link_id uuid,
  p_pin_verified_now boolean default false
) returns boolean language plpgsql as $f$
declare
  v_configuration_version integer;
  v_access_epoch integer;
  v_pin_epoch integer;
begin
  if not pg_temp.emulate_link_resolves(p_link_id) then
    return false;
  end if;

  if not pg_temp.emulate_is_link_active(p_link_id) then
    return false;
  end if;

  select configuration_version, access_epoch, pin_epoch
    into v_configuration_version, v_access_epoch, v_pin_epoch
    from public.project_share_links where id = p_link_id;

  return pg_temp.emulate_ensure_current_grant(
    p_session_id, p_link_id, v_configuration_version, v_access_epoch, v_pin_epoch, p_pin_verified_now
  );
end;
$f$;

-- =========================================================
-- Section A: backfill verification (Runtime Requirement A)
--
-- Reads the REAL rows 02B seeded (BEFORE the migration under test ever
-- ran) and 02C's migration backfilled, exactly as they exist right now
-- -- no new fixture data is created in this section.
-- =========================================================

do $$
declare
  v_link_id uuid;
  v_grant_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_after_stripped jsonb;
  v_access_epoch integer;
  v_pin_epoch integer;
  v_granted_access_epoch integer;
  v_granted_pin_epoch integer;
  v_key text;
begin
  -- A.1/A.3/A.7/A.8: every one of the four pre-existing links migrated
  -- safely -- access_epoch and pin_epoch both initialized to 1, both
  -- NOT NULL, both satisfy their own > 0 check constraint (already
  -- proven structurally, re-confirmed here by successfully reading a
  -- real value at all -- a constraint violation would have aborted 02C
  -- entirely, and NULL would fail the `not null` assertion below).
  for v_key in select unnest(array['link_no_pin_active', 'link_with_pin_active', 'link_with_expiry_active', 'link_disabled'])
  loop
    select value into v_link_id from public.text2task_phase8_fixture_ids where key = v_key;
    select access_epoch, pin_epoch into v_access_epoch, v_pin_epoch
      from public.project_share_links where id = v_link_id;

    perform pg_temp.record_result('A', format('A.1/A.3/A.7: %s backfilled access_epoch = 1, not null', v_key),
      v_access_epoch = 1);
    perform pg_temp.record_result('A', format('A.1/A.4/A.7: %s backfilled pin_epoch = 1, not null', v_key),
      v_pin_epoch = 1);
  end loop;

  -- A.2/A.5/A.6/A.7: every one of the four pre-existing grants migrated
  -- safely -- granted_access_epoch/granted_pin_epoch both initialized to
  -- 1 and match their link's own backfilled value exactly (the whole
  -- backfill-safety argument: 1 == 1 for every pre-existing pair,
  -- installing this migration alone invalidates nothing).
  for v_key in select unnest(array['grant_no_pin', 'grant_with_pin', 'grant_with_expiry', 'grant_disabled_link'])
  loop
    select value into v_grant_id from public.text2task_phase8_fixture_ids where key = v_key;
    select granted_access_epoch, granted_pin_epoch into v_granted_access_epoch, v_granted_pin_epoch
      from public.share_session_grants where id = v_grant_id;

    perform pg_temp.record_result('A', format('A.2/A.5/A.7: %s backfilled granted_access_epoch = 1, not null', v_key),
      v_granted_access_epoch = 1);
    perform pg_temp.record_result('A', format('A.2/A.6/A.7: %s backfilled granted_pin_epoch = 1, not null', v_key),
      v_granted_pin_epoch = 1);
  end loop;

  -- The historical-defect fixture specifically: grant_disabled_link was
  -- issued at granted_configuration_version = 1 while its link's
  -- configuration_version is now 2 (the OLD, pre-Phase-8 stale-by-
  -- configuration_version precondition) -- yet BOTH sides' epoch fields
  -- independently backfilled to 1, so the NEW predicate
  -- (granted_access_epoch = access_epoch AND granted_pin_epoch = pin_epoch)
  -- reports this grant as VALID immediately after migration, proving the
  -- exact defect this migration exists to close is closed by the
  -- backfill alone, with no separate repair step.
  select value into v_grant_id from public.text2task_phase8_fixture_ids where key = 'grant_disabled_link';
  select value into v_link_id from public.text2task_phase8_fixture_ids where key = 'link_disabled';
  perform pg_temp.record_result(
    'A',
    'A.11 (historical defect fixture): grant issued at stale configuration_version=1 (link now at 2) is judged VALID by the new access_epoch/pin_epoch predicate immediately after migration',
    (select granted_access_epoch from public.share_session_grants where id = v_grant_id)
      = (select access_epoch from public.project_share_links where id = v_link_id)
    and (select granted_pin_epoch from public.share_session_grants where id = v_grant_id)
      = (select pin_epoch from public.project_share_links where id = v_link_id)
  );

  -- A.8: constraint/default/type re-confirmation via catalog (the check
  -- constraints themselves were already exercised structurally by every
  -- successful insert above -- this adds an independent, catalog-level
  -- confirmation that NOT NULL is genuinely declared, not merely true by
  -- accident of the data inserted so far).
  perform pg_temp.record_result('A', 'A.8: project_share_links.access_epoch is declared NOT NULL',
    (select is_nullable = 'NO' from information_schema.columns
      where table_schema = 'public' and table_name = 'project_share_links' and column_name = 'access_epoch'));
  perform pg_temp.record_result('A', 'A.8: project_share_links.pin_epoch is declared NOT NULL',
    (select is_nullable = 'NO' from information_schema.columns
      where table_schema = 'public' and table_name = 'project_share_links' and column_name = 'pin_epoch'));
  perform pg_temp.record_result('A', 'A.8: share_session_grants.granted_access_epoch is declared NOT NULL',
    (select is_nullable = 'NO' from information_schema.columns
      where table_schema = 'public' and table_name = 'share_session_grants' and column_name = 'granted_access_epoch'));
  perform pg_temp.record_result('A', 'A.8: share_session_grants.granted_pin_epoch is declared NOT NULL',
    (select is_nullable = 'NO' from information_schema.columns
      where table_schema = 'public' and table_name = 'share_session_grants' and column_name = 'granted_pin_epoch'));
  perform pg_temp.record_result('A', 'A.8: all four new columns are declared integer',
    4 = (select count(*) from information_schema.columns
      where table_schema = 'public' and data_type = 'integer'
        and (
          (table_name = 'project_share_links' and column_name in ('access_epoch', 'pin_epoch'))
          or (table_name = 'share_session_grants' and column_name in ('granted_access_epoch', 'granted_pin_epoch'))
        )));

  -- A.7 (no NULL anywhere, exhaustive, not just the four named fixtures):
  perform pg_temp.record_result('A', 'A.7: no project_share_links row anywhere has a NULL access_epoch or pin_epoch',
    not exists (select 1 from public.project_share_links where access_epoch is null or pin_epoch is null));
  perform pg_temp.record_result('A', 'A.7: no share_session_grants row anywhere has a NULL granted_access_epoch or granted_pin_epoch',
    not exists (select 1 from public.share_session_grants where granted_access_epoch is null or granted_pin_epoch is null));

  -- A.9/A.10: no unrelated Client Share data changed, project_updates and
  -- Phase 6 provenance/conversion data untouched. Compares the FULL
  -- pre-migration row snapshot (captured by 02B, before 02C ever ran)
  -- against the row's current state, with the four brand-new columns
  -- stripped out of the "after" side before comparing -- an exact match
  -- on everything else proves nothing else moved.
  for v_key in select unnest(array[
    'project_a', 'link_no_pin_active', 'link_with_pin_active', 'link_with_expiry_active', 'link_disabled',
    'session_no_pin', 'grant_no_pin', 'session_with_pin', 'grant_with_pin',
    'session_with_expiry', 'grant_with_expiry', 'session_disabled_link', 'grant_disabled_link',
    'control_project_update', 'control_share_message'
  ])
  loop
    select value into v_before from public.text2task_phase8_before_snapshot where key = v_key;

    if v_key like 'link_%' then
      select to_jsonb(l.*) - 'access_epoch' - 'pin_epoch' into v_after_stripped
        from public.project_share_links l where l.id = (select value from public.text2task_phase8_fixture_ids where key = v_key);
    elsif v_key like 'grant_%' then
      select to_jsonb(g.*) - 'granted_access_epoch' - 'granted_pin_epoch' into v_after_stripped
        from public.share_session_grants g where g.id = (select value from public.text2task_phase8_fixture_ids where key = v_key);
    elsif v_key like 'session_%' then
      select to_jsonb(s.*) into v_after_stripped
        from public.share_browser_sessions s where s.id = (select value from public.text2task_phase8_fixture_ids where key = v_key);
    elsif v_key = 'project_a' then
      select to_jsonb(p.*) into v_after_stripped
        from public.projects p where p.id = (select value from public.text2task_phase8_fixture_ids where key = v_key);
    elsif v_key = 'control_project_update' then
      select to_jsonb(u.*) into v_after_stripped
        from public.project_updates u where u.id = (select value from public.text2task_phase8_fixture_ids where key = v_key);
    elsif v_key = 'control_share_message' then
      select to_jsonb(m.*) into v_after_stripped
        from public.share_messages m where m.id = (select value from public.text2task_phase8_fixture_ids where key = v_key);
    end if;

    perform pg_temp.record_result(
      'A',
      format('A.9/A.10: %s is byte-identical before vs. after (new epoch columns excluded from the comparison)', v_key),
      v_before = v_after_stripped
    );
  end loop;

  -- A.10 explicit, additional: project_updates/share_messages tables are
  -- not schema-altered at all by this migration (structural, catalog-level).
  perform pg_temp.record_result('A', 'A.10: project_updates has no access_epoch/pin_epoch-named column (migration never touches it)',
    not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_updates'
        and column_name in ('access_epoch', 'pin_epoch', 'granted_access_epoch', 'granted_pin_epoch')));
  perform pg_temp.record_result('A', 'A.10: share_messages has no access_epoch/pin_epoch-named column (migration never touches it)',
    not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'share_messages'
        and column_name in ('access_epoch', 'pin_epoch', 'granted_access_epoch', 'granted_pin_epoch')));
exception
  when others then
    -- SECTION ISOLATION (Task 3): an unexpected exception anywhere in
    -- Section A rolls back only Section A's own work (PL/pgSQL's
    -- implicit savepoint at this block's own BEGIN) and is recorded as a
    -- loud, unmistakable FAIL -- never silently swallowed, never
    -- reclassified as a PASS -- so the run continues to Section B with
    -- genuine evidence about A preserved in this one row, instead of the
    -- whole diagnostic run stopping here.
    perform pg_temp.record_result(
      'A',
      format('UNEXPECTED EXCEPTION in Section A -- SQLSTATE=%s SQLERRM=%s', sqlstate, sqlerrm),
      false
    );
end;
$$;

-- =========================================================
-- Section B: same-browser Disable/Re-enable regression (Runtime
-- Requirement B) -- the EXACT Production defect.
-- =========================================================

do $$
declare
  v_owner constant uuid := '88888888-8888-4888-8888-888888888888';
  v_project_id uuid;
  v_link_id uuid;
  v_session_id uuid;
  v_grant record;
begin
  perform pg_temp.act_as('authenticated', v_owner);
  insert into public.projects (user_id) values (v_owner) returning id into v_project_id;
  perform pg_temp.act_as('postgres');

  perform pg_temp.act_as('authenticated', v_owner);
  v_link_id := (public.create_share_link_draft(v_project_id, 'phase8secBFreshLink00001')->>'linkId')::uuid;
  perform public.activate_share_link(v_link_id, repeat('11', 32), 1::smallint, repeat('22', 43), repeat('33', 12), repeat('44', 16), 1::smallint);
  perform pg_temp.act_as('postgres');

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('b1', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  perform pg_temp.record_result('B', 'B1: fresh session/grant exchange succeeds on an active link',
    pg_temp.emulate_session_exchange(v_session_id, v_link_id));

  perform pg_temp.record_result('B', 'B2: active link + valid grant -> authorized',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  perform pg_temp.act_as('authenticated', v_owner);
  perform public.disable_share_link(v_link_id);
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result('B', 'B3: disable -> SAME browser now denied',
    not pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  select granted_access_epoch, granted_pin_epoch, revoked_at into v_grant
    from public.share_session_grants
    where browser_session_id = v_session_id and share_link_id = v_link_id;

  perform pg_temp.record_result(
    'B',
    'B4: the grant itself was NOT security-invalidated by disable -- access_epoch/pin_epoch unchanged, not revoked',
    v_grant.granted_access_epoch = 1 and v_grant.granted_pin_epoch = 1 and v_grant.revoked_at is null
  );

  perform pg_temp.act_as('authenticated', v_owner);
  perform public.reenable_share_link(v_link_id);
  perform pg_temp.act_as('postgres');

  -- THE regression proof: SAME session id, SAME link id, no new
  -- exchange, no new grant creation call of any kind since B1.
  perform pg_temp.record_result(
    'B',
    'B5/B6/B7 (THE PRODUCTION REGRESSION): re-enable -> the SAME browser/session/grant, SAME public link, is authorized again with NO new exchange',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id)
  );
exception
  when others then
    -- SECTION ISOLATION (Task 3): see Section A's own identical handler
    -- comment for the full rationale. Applied uniformly to every section
    -- from here on without repeating the same explanation each time.
    perform pg_temp.record_result(
      'B',
      format('UNEXPECTED EXCEPTION in Section B -- SQLSTATE=%s SQLERRM=%s', sqlstate, sqlerrm),
      false
    );
end;
$$;

-- =========================================================
-- Section C: nine configuration-change sub-scenarios (Runtime
-- Requirement C).
--
-- CORRECTED 2026-08-25 (Task 4 -- cross-section dependency removal): this
-- section now creates its OWN project/link/session/grant from scratch,
-- exactly mirroring Section B's own setup, instead of reading Section
-- B's fixture_ids rows. Two independent reasons: (1) now that every
-- section is individually isolated via its own EXCEPTION handler (Task
-- 3), a failure in Section B would roll back Section B's own fixture
-- rows before Section C ever ran, which would have turned a
-- Section-B-specific problem into a confusing, unrelated-looking failure
-- in Section C instead of clean, independent evidence for both; (2) this
-- section's own actual purpose -- proving nine ordinary settings changes
-- never strand an already-authorized grant -- never depended on Section
-- B's specific disable/re-enable narrative in the first place; any
-- freshly-authorized active link and grant serves this section's purpose
-- equally well.
-- =========================================================

do $$
declare
  v_owner constant uuid := '88888888-8888-4888-8888-888888888888';
  v_project_id uuid;
  v_link_id uuid;
  v_session_id uuid;
  v_before record;
  v_after record;
  v_task_id bigint;
  v_resource_id uuid;
  v_label text;
begin
  perform pg_temp.act_as('authenticated', v_owner);
  insert into public.projects (user_id) values (v_owner) returning id into v_project_id;
  v_link_id := (public.create_share_link_draft(v_project_id, 'phase8secCFreshLink00001')->>'linkId')::uuid;
  perform public.activate_share_link(v_link_id, repeat('11', 32), 1::smallint, repeat('22', 43), repeat('33', 12), repeat('44', 16), 1::smallint);
  perform pg_temp.act_as('postgres');

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('c1', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  perform pg_temp.emulate_session_exchange(v_session_id, v_link_id);
  perform pg_temp.record_result('C', 'C0: fresh session/grant exchange succeeds on an active link (this section''s own self-contained setup)',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  -- C1: comments_enabled. FIX 2026-08-26: project_share_links.comments_enabled
  -- defaults to `false` (202608030003) and neither create_share_link_draft
  -- nor activate_share_link ever sets it -- so this freshly-created link's
  -- comments_enabled is already `false` when this sub-test runs. The
  -- ORIGINAL fixture saved `commentsEnabled: false` again -- an exact
  -- no-op (save_share_configuration's own v_settings_changed uses IS
  -- DISTINCT FROM, and `false is distinct from false` is false), so
  -- configuration_version correctly, deliberately did NOT bump -- the
  -- assertion demanding it change was testing a fixture that never
  -- performed a genuine change. Fixed by toggling to `true`, a genuine
  -- change from the active default.
  select configuration_version, access_epoch, pin_epoch into v_before from public.project_share_links where id = v_link_id;
  perform pg_temp.act_as('authenticated', v_owner);
  perform public.save_share_configuration(v_link_id, jsonb_build_object('commentsEnabled', true), null, null, null);
  perform pg_temp.act_as('postgres');
  select configuration_version, access_epoch, pin_epoch into v_after from public.project_share_links where id = v_link_id;
  perform pg_temp.record_result('C', 'C1 commentsEnabled change: configuration_version changed, access_epoch/pin_epoch unchanged',
    v_after.configuration_version > v_before.configuration_version
    and v_after.access_epoch = v_before.access_epoch and v_after.pin_epoch = v_before.pin_epoch);
  perform pg_temp.record_result('C', 'C1 commentsEnabled change: same grant remains authorized',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  -- C2: clientFacingSubtitle
  select configuration_version, access_epoch, pin_epoch into v_before from public.project_share_links where id = v_link_id;
  perform pg_temp.act_as('authenticated', v_owner);
  perform public.save_share_configuration(v_link_id, jsonb_build_object('clientFacingSubtitle', 'Phase 8 runtime subtitle'), null, null, null);
  perform pg_temp.act_as('postgres');
  select configuration_version, access_epoch, pin_epoch into v_after from public.project_share_links where id = v_link_id;
  perform pg_temp.record_result('C', 'C2 subtitle change: configuration_version changed, access_epoch/pin_epoch unchanged',
    v_after.configuration_version > v_before.configuration_version
    and v_after.access_epoch = v_before.access_epoch and v_after.pin_epoch = v_before.pin_epoch);
  perform pg_temp.record_result('C', 'C2 subtitle change: same grant remains authorized',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  -- C3: contentDirection
  select configuration_version, access_epoch, pin_epoch into v_before from public.project_share_links where id = v_link_id;
  perform pg_temp.act_as('authenticated', v_owner);
  perform public.save_share_configuration(v_link_id, jsonb_build_object('contentDirection', 'rtl'), null, null, null);
  perform pg_temp.act_as('postgres');
  select configuration_version, access_epoch, pin_epoch into v_after from public.project_share_links where id = v_link_id;
  perform pg_temp.record_result('C', 'C3 contentDirection change: configuration_version changed, access_epoch/pin_epoch unchanged',
    v_after.configuration_version > v_before.configuration_version
    and v_after.access_epoch = v_before.access_epoch and v_after.pin_epoch = v_before.pin_epoch);
  perform pg_temp.record_result('C', 'C3 contentDirection change: same grant remains authorized',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  -- C4: titleVisible
  select configuration_version, access_epoch, pin_epoch into v_before from public.project_share_links where id = v_link_id;
  perform pg_temp.act_as('authenticated', v_owner);
  perform public.save_share_configuration(v_link_id, jsonb_build_object('titleVisible', true), null, null, null);
  perform pg_temp.act_as('postgres');
  select configuration_version, access_epoch, pin_epoch into v_after from public.project_share_links where id = v_link_id;
  perform pg_temp.record_result('C', 'C4 titleVisible change: configuration_version changed, access_epoch/pin_epoch unchanged',
    v_after.configuration_version > v_before.configuration_version
    and v_after.access_epoch = v_before.access_epoch and v_after.pin_epoch = v_before.pin_epoch);
  perform pg_temp.record_result('C', 'C4 titleVisible change: same grant remains authorized',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  -- C5: statusVisible
  select configuration_version, access_epoch, pin_epoch into v_before from public.project_share_links where id = v_link_id;
  perform pg_temp.act_as('authenticated', v_owner);
  perform public.save_share_configuration(v_link_id, jsonb_build_object('statusVisible', true), null, null, null);
  perform pg_temp.act_as('postgres');
  select configuration_version, access_epoch, pin_epoch into v_after from public.project_share_links where id = v_link_id;
  perform pg_temp.record_result('C', 'C5 statusVisible change: configuration_version changed, access_epoch/pin_epoch unchanged',
    v_after.configuration_version > v_before.configuration_version
    and v_after.access_epoch = v_before.access_epoch and v_after.pin_epoch = v_before.pin_epoch);
  perform pg_temp.record_result('C', 'C5 statusVisible change: same grant remains authorized',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  -- C6: targetDateVisible
  select configuration_version, access_epoch, pin_epoch into v_before from public.project_share_links where id = v_link_id;
  perform pg_temp.act_as('authenticated', v_owner);
  perform public.save_share_configuration(v_link_id, jsonb_build_object('targetDateVisible', true), null, null, null);
  perform pg_temp.act_as('postgres');
  select configuration_version, access_epoch, pin_epoch into v_after from public.project_share_links where id = v_link_id;
  perform pg_temp.record_result('C', 'C6 targetDateVisible change: configuration_version changed, access_epoch/pin_epoch unchanged',
    v_after.configuration_version > v_before.configuration_version
    and v_after.access_epoch = v_before.access_epoch and v_after.pin_epoch = v_before.pin_epoch);
  perform pg_temp.record_result('C', 'C6 targetDateVisible change: same grant remains authorized',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  -- C7: task mapping. FIX 2026-08-26: mechanically re-proved from
  -- save_share_configuration's own CURRENT body
  -- (202608110001_client_share_publication_intent.sql) -- the
  -- task-mapping sub-operation block (its own DELETE + INSERT ON
  -- CONFLICT set-replacement) contains NO reference to
  -- configuration_version anywhere; only the settings sub-operation ever
  -- assigns v_new_configuration_version/writes configuration_version
  -- ("and only settings ever bump it", per that function's own header
  -- comment). The ORIGINAL assertion demanded configuration_version
  -- CHANGE for a task-mapping-only call, which is not what the real
  -- function does -- this was a wrong expectation, not a real defect.
  -- Fixed to assert the CORRECT, intentional invariant instead:
  -- configuration_version/access_epoch/pin_epoch all stay unchanged, and
  -- the existing grant remains authorized (task mapping never needs to
  -- strand an already-authorized browser).
  perform pg_temp.act_as('authenticated', v_owner);
  insert into public.tasks (user_id, project_id) values (v_owner, v_project_id) returning id into v_task_id;
  perform pg_temp.act_as('postgres');
  select configuration_version, access_epoch, pin_epoch into v_before from public.project_share_links where id = v_link_id;
  perform pg_temp.act_as('authenticated', v_owner);
  perform public.save_share_configuration(
    v_link_id, null,
    jsonb_build_array(jsonb_build_object('subtaskId', v_task_id::text, 'publicGroup', 'in_progress', 'waitingForClientFeedback', false, 'displayOrder', 0)),
    null, null
  );
  perform pg_temp.act_as('postgres');
  select configuration_version, access_epoch, pin_epoch into v_after from public.project_share_links where id = v_link_id;
  perform pg_temp.record_result('C', 'C7 task mapping change: configuration_version/access_epoch/pin_epoch all UNCHANGED -- task mapping intentionally never bumps configuration_version (verified against save_share_configuration''s own current body)',
    v_after.configuration_version = v_before.configuration_version
    and v_after.access_epoch = v_before.access_epoch and v_after.pin_epoch = v_before.pin_epoch);
  perform pg_temp.record_result('C', 'C7 task mapping change: same grant remains authorized',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));
  perform pg_temp.record_result('C', 'C7 task mapping change: mapping itself was actually applied (the task is genuinely mapped to this link)',
    exists (select 1 from public.share_link_tasks where share_link_id = v_link_id and subtask_id = v_task_id));

  -- C8: resource mapping. FIX 2026-08-26: same re-proof as C7 above --
  -- the resource-mapping sub-operation's own DELETE + INSERT ON CONFLICT
  -- block contains no reference to configuration_version either. Fixed
  -- identically: unchanged configuration_version/access_epoch/pin_epoch,
  -- grant remains authorized, mapping genuinely applied.
  perform pg_temp.act_as('authenticated', v_owner);
  insert into public.task_resources (user_id, project_id) values (v_owner, v_project_id) returning id into v_resource_id;
  perform pg_temp.act_as('postgres');
  select configuration_version, access_epoch, pin_epoch into v_before from public.project_share_links where id = v_link_id;
  perform pg_temp.act_as('authenticated', v_owner);
  perform public.save_share_configuration(
    v_link_id, null, null,
    jsonb_build_array(jsonb_build_object('resourceId', v_resource_id::text, 'publicLabel', 'Doc', 'canDownload', true, 'displayOrder', 0)),
    null
  );
  perform pg_temp.act_as('postgres');
  select configuration_version, access_epoch, pin_epoch into v_after from public.project_share_links where id = v_link_id;
  perform pg_temp.record_result('C', 'C8 resource mapping change: configuration_version/access_epoch/pin_epoch all UNCHANGED -- resource mapping intentionally never bumps configuration_version (verified against save_share_configuration''s own current body)',
    v_after.configuration_version = v_before.configuration_version
    and v_after.access_epoch = v_before.access_epoch and v_after.pin_epoch = v_before.pin_epoch);
  perform pg_temp.record_result('C', 'C8 resource mapping change: same grant remains authorized',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));
  perform pg_temp.record_result('C', 'C8 resource mapping change: mapping itself was actually applied (the resource is genuinely mapped to this link)',
    exists (select 1 from public.share_link_resources where share_link_id = v_link_id and resource_id = v_resource_id));

  -- C9: publish/update. FIX 2026-08-26: same re-proof -- the
  -- update-publication sub-operation block (retire-current + insert-new)
  -- contains no reference to configuration_version either; publishing an
  -- update is a content operation, not a grant-invalidating access
  -- change. Fixed identically: unchanged configuration_version/
  -- access_epoch/pin_epoch, grant remains authorized, the update was
  -- genuinely published as the new current row.
  select configuration_version, access_epoch, pin_epoch into v_before from public.project_share_links where id = v_link_id;
  perform pg_temp.act_as('authenticated', v_owner);
  perform public.save_share_configuration(v_link_id, null, null, null, jsonb_build_object('body', 'Phase 8 runtime publish-update body.'));
  perform pg_temp.act_as('postgres');
  select configuration_version, access_epoch, pin_epoch into v_after from public.project_share_links where id = v_link_id;
  perform pg_temp.record_result('C', 'C9 publish/update change: configuration_version/access_epoch/pin_epoch all UNCHANGED -- publishing an update intentionally never bumps configuration_version (verified against save_share_configuration''s own current body)',
    v_after.configuration_version = v_before.configuration_version
    and v_after.access_epoch = v_before.access_epoch and v_after.pin_epoch = v_before.pin_epoch);
  perform pg_temp.record_result('C', 'C9 publish/update change: same grant remains authorized',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));
  perform pg_temp.record_result('C', 'C9 publish/update change: the update was actually published as the new current row',
    exists (select 1 from public.share_link_updates where share_link_id = v_link_id and is_current and body = 'Phase 8 runtime publish-update body.'));
exception
  when others then
    perform pg_temp.record_result(
      'C',
      format('UNEXPECTED EXCEPTION in Section C -- SQLSTATE=%s SQLERRM=%s', sqlstate, sqlerrm),
      false
    );
end;
$$;

-- =========================================================
-- Section D: secret rotation (Runtime Requirement D) -- security-critical.
-- =========================================================

do $$
declare
  v_owner constant uuid := '88888888-8888-4888-8888-888888888888';
  v_project_id uuid;
  v_link_id uuid;
  v_session_id uuid;
  v_access_epoch_before integer;
  v_pin_epoch_before integer;
  v_access_epoch_after integer;
  v_pin_epoch_after integer;
  v_digest_before text;
  v_digest_after text;
begin
  perform pg_temp.act_as('authenticated', v_owner);
  insert into public.projects (user_id) values (v_owner) returning id into v_project_id;
  v_link_id := (public.create_share_link_draft(v_project_id, 'phase8secDRotationLink01')->>'linkId')::uuid;
  perform public.activate_share_link(v_link_id, repeat('a1', 32), 1::smallint, repeat('b2', 43), repeat('c3', 12), repeat('d4', 16), 1::smallint);
  perform pg_temp.act_as('postgres');

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('d1', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  perform pg_temp.emulate_session_exchange(v_session_id, v_link_id);

  perform pg_temp.record_result('D', 'D1: valid pre-rotation grant works',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  select access_epoch, pin_epoch, secret_digest into v_access_epoch_before, v_pin_epoch_before, v_digest_before
    from public.project_share_links where id = v_link_id;

  perform pg_temp.act_as('authenticated', v_owner);
  perform public.rotate_share_link_secret(v_link_id, repeat('f6', 32), 1::smallint, repeat('a7', 43), repeat('b8', 12), repeat('c9', 16), 1::smallint);
  perform pg_temp.act_as('postgres');

  select access_epoch, pin_epoch, secret_digest into v_access_epoch_after, v_pin_epoch_after, v_digest_after
    from public.project_share_links where id = v_link_id;

  perform pg_temp.record_result('D', 'D3: access_epoch increments by EXACTLY one on rotation',
    v_access_epoch_after = v_access_epoch_before + 1);
  perform pg_temp.record_result('D', 'D4: pin_epoch does NOT incorrectly substitute -- unchanged by rotation',
    v_pin_epoch_after = v_pin_epoch_before);
  perform pg_temp.record_result('D', 'D5: old grant becomes unauthorized after rotation (SAME session, no other change)',
    not pg_temp.emulate_verify_authorization(v_session_id, v_link_id));
  perform pg_temp.record_result('D', 'D7: old secret_digest no longer matches the link''s stored value (old secret cannot bootstrap a new grant)',
    v_digest_before <> v_digest_after and v_digest_after = repeat('f6', 32));

  -- D9/D10: new secret exchange succeeds, resulting grant stores the
  -- current granted_access_epoch, resulting grant is authorized.
  perform pg_temp.record_result('D', 'D9/D10: a fresh exchange with the NEW secret succeeds and is immediately authorized',
    pg_temp.emulate_session_exchange(v_session_id, v_link_id)
    and pg_temp.emulate_verify_authorization(v_session_id, v_link_id));
  perform pg_temp.record_result('D', 'D9: the refreshed grant stores the CURRENT (post-rotation) granted_access_epoch',
    (select granted_access_epoch from public.share_session_grants
      where browser_session_id = v_session_id and share_link_id = v_link_id and revoked_at is null) = v_access_epoch_after);

  -- D6: PIN verification alone cannot repair an access_epoch mismatch --
  -- uses a SEPARATE link that has a PIN, so the recovery route is
  -- genuinely reachable, then rotates it and proves even a "correct" PIN
  -- (p_pin_correct := true) cannot recover the pre-rotation grant.
  perform pg_temp.act_as('authenticated', v_owner);
  perform public.disable_share_link(v_link_id); -- free the project's one-active-link slot
  declare
    v_link_pin_id uuid;
    v_session_pin_id uuid;
  begin
    v_link_pin_id := (public.create_share_link_draft(v_project_id, 'phase8secDPinRotateLink1')->>'linkId')::uuid;
    perform public.activate_share_link(v_link_pin_id, repeat('11', 32), 1::smallint, repeat('22', 43), repeat('33', 12), repeat('44', 16), 1::smallint);
    perform public.set_share_link_pin(v_link_pin_id, repeat('P', 43), repeat('S', 22), 1::smallint, 16384, 8, 1, 32);
    perform pg_temp.act_as('postgres');

    insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
    values (repeat('d2', 32), 1, now() + interval '7 days')
    returning id into v_session_pin_id;

    perform pg_temp.emulate_session_exchange(v_session_pin_id, v_link_pin_id, true);

    perform pg_temp.act_as('authenticated', v_owner);
    perform public.rotate_share_link_secret(v_link_pin_id, repeat('66', 32), 1::smallint, repeat('77', 43), repeat('88', 12), repeat('99', 16), 1::smallint);
    perform pg_temp.act_as('postgres');

    perform pg_temp.record_result(
      'D',
      'D6 (SECURITY-CRITICAL): PIN verification alone -- even a CORRECT PIN -- cannot repair an access_epoch mismatch caused by rotation',
      not pg_temp.emulate_pin_recovery(v_session_pin_id, v_link_pin_id, true)
    );
  end;

  insert into public.text2task_phase8_fixture_ids (key, value) values ('section_d_project', v_project_id)
    on conflict (key) do update set value = excluded.value;
exception
  when others then
    perform pg_temp.record_result(
      'D',
      format('UNEXPECTED EXCEPTION in Section D -- SQLSTATE=%s SQLERRM=%s', sqlstate, sqlerrm),
      false
    );
end;
$$;

-- =========================================================
-- Section E: PIN semantics (Runtime Requirement E).
-- =========================================================

do $$
declare
  v_owner constant uuid := '88888888-8888-4888-8888-888888888888';
  v_project_id uuid;
  v_link_id uuid;
  v_session_id uuid;
  v_access_epoch_before integer;
  v_access_epoch_after integer;
  v_pin_epoch_before integer;
  v_pin_epoch_after integer;
begin
  perform pg_temp.act_as('authenticated', v_owner);
  insert into public.projects (user_id) values (v_owner) returning id into v_project_id;
  v_link_id := (public.create_share_link_draft(v_project_id, 'phase8secEPinLifecycle01')->>'linkId')::uuid;
  perform public.activate_share_link(v_link_id, repeat('11', 32), 1::smallint, repeat('22', 43), repeat('33', 12), repeat('44', 16), 1::smallint);
  perform pg_temp.act_as('postgres');

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('e1', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  perform pg_temp.emulate_session_exchange(v_session_id, v_link_id);
  perform pg_temp.record_result('E', 'E-A pre: no-PIN link authorizes without any PIN', pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  -- ---- NO PIN -> ADD PIN ----
  select access_epoch, pin_epoch into v_access_epoch_before, v_pin_epoch_before from public.project_share_links where id = v_link_id;

  perform pg_temp.act_as('authenticated', v_owner);
  perform public.set_share_link_pin(v_link_id, repeat('P', 43), repeat('S', 22), 1::smallint, 16384, 8, 1, 32); -- PIN "A"
  perform pg_temp.act_as('postgres');

  select access_epoch, pin_epoch into v_access_epoch_after, v_pin_epoch_after from public.project_share_links where id = v_link_id;

  perform pg_temp.record_result('E', 'E-A: adding a PIN does NOT change access_epoch', v_access_epoch_after = v_access_epoch_before);
  perform pg_temp.record_result('E', 'E-A: adding a PIN bumps pin_epoch by exactly one', v_pin_epoch_after = v_pin_epoch_before + 1);
  perform pg_temp.record_result('E', 'E-A: existing browser is challenged (denied) as designed once a PIN is added',
    not pg_temp.emulate_verify_authorization(v_session_id, v_link_id));
  perform pg_temp.record_result('E', 'E-A: wrong PIN cannot recover access', not pg_temp.emulate_pin_recovery(v_session_id, v_link_id, false));
  perform pg_temp.record_result('E', 'E-A: correct PIN verification recovers the SAME browser/session safely',
    pg_temp.emulate_pin_recovery(v_session_id, v_link_id, true));
  perform pg_temp.record_result('E', 'E-A: the grant''s granted_pin_epoch becomes the CURRENT link pin_epoch',
    (select granted_pin_epoch from public.share_session_grants where browser_session_id = v_session_id and share_link_id = v_link_id and revoked_at is null) = v_pin_epoch_after);
  perform pg_temp.record_result('E', 'E-A: authorized again after correct-PIN recovery', pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  -- ---- PIN A -> PIN B ----
  select access_epoch, pin_epoch into v_access_epoch_before, v_pin_epoch_before from public.project_share_links where id = v_link_id;

  perform pg_temp.act_as('authenticated', v_owner);
  perform public.set_share_link_pin(v_link_id, repeat('Q', 43), repeat('T', 22), 1::smallint, 16384, 8, 1, 32); -- PIN "B"
  perform pg_temp.act_as('postgres');

  select access_epoch, pin_epoch into v_access_epoch_after, v_pin_epoch_after from public.project_share_links where id = v_link_id;

  perform pg_temp.record_result('E', 'E-B: PIN A -> PIN B does NOT change access_epoch', v_access_epoch_after = v_access_epoch_before);
  perform pg_temp.record_result('E', 'E-B: previously PIN-A-verified grant becomes invalid for PIN purposes',
    not pg_temp.emulate_verify_authorization(v_session_id, v_link_id));
  perform pg_temp.record_result('E', 'E-B: PIN A no longer verifies (recovery attempt with the old PIN correctness fails)',
    not pg_temp.emulate_pin_recovery(v_session_id, v_link_id, false));
  perform pg_temp.record_result('E', 'E-B: PIN B successfully restores authorization',
    pg_temp.emulate_pin_recovery(v_session_id, v_link_id, true));
  perform pg_temp.record_result(
    'E',
    'E-B: no raw share secret is required for PIN re-verification -- emulate_pin_recovery''s own signature (session_id, link_id, pin_correct) carries no secret/digest parameter at all',
    true
  );

  -- ---- CLEAR PIN ----
  perform pg_temp.act_as('authenticated', v_owner);
  perform public.clear_share_link_pin(v_link_id);
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result('E', 'E-C: clearing the PIN does not strand the browser -- SAME grant authorized under no-PIN policy, no new exchange',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));
  perform pg_temp.record_result(
    'E',
    'E-C: clear_share_link_pin does not bump pin_epoch (the already-granted pin_epoch still matches the link''s live value)',
    (select pin_epoch from public.project_share_links where id = v_link_id) = v_pin_epoch_after
  );
exception
  when others then
    perform pg_temp.record_result(
      'E',
      format('UNEXPECTED EXCEPTION in Section E -- SQLSTATE=%s SQLERRM=%s', sqlstate, sqlerrm),
      false
    );
end;
$$;

-- =========================================================
-- Section F: expiry semantics (Runtime Requirement F).
--
-- REDESIGNED 2026-08-25 (Section F root-cause finding). The ORIGINAL
-- design attempted to simulate "expiry has passed" and "session has
-- expired" via two raw UPDATE statements bypassing the owner RPCs
-- entirely. Both are genuinely invalid states no real Production session
-- could ever reach -- not merely inconvenient test shortcuts:
--
--   1. `update public.project_share_links set expires_at = ...` without
--      ALSO bumping configuration_version in the SAME statement is
--      rejected by enforce_project_share_link_integrity's own
--      SHARE_LINK_VERSION_NOT_INCREMENTED check. That trigger classifies
--      expires_at as an "access-changed" column (v_access_changed) and
--      requires configuration_version to strictly increase whenever it
--      changes -- REGARDLESS of which caller or code path performs the
--      write; the trigger does not special-case "this came from a test
--      harness". The real set_share_link_expiry RPC always bumps
--      configuration_version in the same UPDATE (`v_new_configuration_version
--      := v_link_configuration_version + 1`); a raw bypass that skips
--      this is not a shortcut around irrelevant validation, it is
--      missing a real, always-enforced invariant.
--   2. `update public.share_browser_sessions set expires_at = ...` is
--      REJECTED UNCONDITIONALLY by enforce_share_browser_session_integrity's
--      own SHARE_SESSION_EXPIRY_IMMUTABLE check -- a browser session's
--      expires_at can never change after insert, by ANY caller, for ANY
--      reason. There is no legitimate way to "shorten" an existing
--      session's TTL at all in this schema; Production doesn't support
--      it, so this harness must not pretend to either.
--
-- Both are now tested using ONLY real owner RPCs (set_share_link_expiry,
-- clear_share_link_expiry) plus genuine wall-clock time passage via
-- pg_sleep() for the one thing that truly requires it -- proving "once
-- expiry passes" without ever writing a row the real product could not
-- produce. This also required a real correctness fix to this file's own
-- emulation layer: emulate_is_link_active/emulate_verify_authorization
-- previously compared expiry against now(), which PostgreSQL freezes to
-- the transaction's own start time for its entire duration -- pg_sleep()
-- never advances it, so a now()-based comparison would have silently
-- never observed the sleep at all. Both now use clock_timestamp()
-- instead (see each function's own comment, above in this file, for the
-- full reasoning) -- this is slower (~8 seconds total) but every fixture
-- row involved is one the real product could actually produce, and the
-- expiry check genuinely reflects wall-clock time the same way the real
-- TypeScript application does.
--
-- FIX 2026-08-26 (TIME SOURCE OF THE FIXTURE VALUES THEMSELVES, not just
-- the verifier -- a second, more subtle instance of the exact same
-- now()-vs-clock_timestamp() class of bug the fix above already fixed
-- for the READ side): F-B's shortened link expiry and F-F's fresh
-- short-TTL session both used to compute their "3 seconds from now"
-- value as `now() + interval '3 seconds'`. Because file 03 runs as ONE
-- long transaction and `now()` is frozen to that transaction's own start
-- time for its ENTIRE duration (Sections A-E already ran before Section
-- F begins), `now() + 3 seconds` is 3 seconds past the moment the WHOLE
-- SCRIPT began -- not 3 seconds from the moment this statement actually
-- executes. If Sections A-E's own real wall-clock runtime already
-- exceeds 3 seconds (entirely plausible), `clock_timestamp()` --
-- correctly used by the verifier -- could ALREADY be past that value the
-- instant it is written, before pg_sleep() is ever reached: a supposedly
-- "still valid for 3 more seconds" fixture would already read as expired,
-- producing a false proof of TTL expiration rather than a genuine one.
-- FIX: both short-lived expiry values are now computed from
-- `clock_timestamp() + interval '3 seconds'` -- the SAME advancing clock
-- the verifier reads -- so "3 seconds from now" always means 3 real
-- seconds from the moment the value is actually written, regardless of
-- how long the surrounding transaction has already been running. This is
-- always safe against set_share_link_expiry's own "must be strictly
-- future" validation and against share_browser_sessions_lifecycle_check's
-- own `expires_at > created_at` (created_at still defaults to the
-- frozen, transaction-start `now()`): PostgreSQL guarantees
-- `clock_timestamp() >= now()` within any transaction (real elapsed time
-- since the transaction began can never be negative), so
-- `clock_timestamp() + 3s` is unconditionally later than plain `now()`,
-- with the fixture's own 3-second margin preserved on top. The two long
-- future values in this section (F-A's +1 day, the f1 session's +1 hour,
-- F-D's +30 days) are ALSO normalized to clock_timestamp() below purely
-- for consistency -- they were never at risk of this specific drift
-- (days/hours dwarf any plausible in-transaction elapsed time), but using
-- one time source throughout this section removes the need for a reader
-- to reason about which of the two is safe in which spot.
-- =========================================================

do $$
declare
  v_owner constant uuid := '88888888-8888-4888-8888-888888888888';
  v_project_id uuid;
  v_link_id uuid;
  v_session_id uuid;
  v_session_short_id uuid;
  v_config_before integer;
  v_config_after integer;
  v_access_epoch_before integer;
  v_access_epoch_after integer;
begin
  -- ---- Link-expiry lifecycle: F-A through F-E, plus F-G/F-H captured
  -- at every step (access_epoch never changes; configuration_version
  -- increases exactly once per genuine change, matching
  -- set_share_link_expiry/clear_share_link_expiry's own documented
  -- behavior). ----
  perform pg_temp.act_as('authenticated', v_owner);
  insert into public.projects (user_id) values (v_owner) returning id into v_project_id;
  v_link_id := (public.create_share_link_draft(v_project_id, 'phase8secFExpiryLink0001')->>'linkId')::uuid;
  perform public.activate_share_link(v_link_id, repeat('11', 32), 1::smallint, repeat('22', 43), repeat('33', 12), repeat('44', 16), 1::smallint);
  perform public.set_share_link_expiry(v_link_id, clock_timestamp() + interval '1 day');
  perform pg_temp.act_as('postgres');

  -- Long-lived session (1 hour) -- this section's own pg_sleep() calls
  -- total well under a minute, so this session must comfortably outlive
  -- them without itself becoming a confounding variable for the
  -- link-expiry assertions below (F-F, further down, tests session TTL
  -- in isolation using its OWN deliberately short-lived session instead).
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('f1', 32), 1, clock_timestamp() + interval '1 hour')
  returning id into v_session_id;

  perform pg_temp.emulate_session_exchange(v_session_id, v_link_id);
  perform pg_temp.record_result('F', 'F-A: future link expiry permits access before expiry',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  -- F-B/F-C: shorten expiry via the real RPC to a short-but-still-future
  -- value, ANCHORED TO clock_timestamp() -- the same advancing wall
  -- clock the verifier itself reads (see this section's own TIME SOURCE
  -- note above for why now() would be unsafe here) -- then prove the
  -- pair explicitly: authorized immediately BEFORE any sleep (F-B), then
  -- denied AFTER real wall-clock time has genuinely passed (F-C).
  select configuration_version, access_epoch into v_config_before, v_access_epoch_before
    from public.project_share_links where id = v_link_id;

  perform pg_temp.act_as('authenticated', v_owner);
  perform public.set_share_link_expiry(v_link_id, clock_timestamp() + interval '3 seconds');
  perform pg_temp.act_as('postgres');

  select configuration_version, access_epoch into v_config_after, v_access_epoch_after
    from public.project_share_links where id = v_link_id;

  -- Asserted immediately, BEFORE any sleep: the shortened-but-still-future
  -- expiry authorizes right now -- proving the live check reflects the
  -- NEW value the instant it is set, not merely "eventually".
  perform pg_temp.record_result('F', 'F-B: immediately BEFORE sleep -- shortened-but-still-future expiry still authorizes (live check reflects the NEW value)',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));
  perform pg_temp.record_result(
    'F',
    'F-G/F-H (shorten): configuration_version increased, access_epoch UNCHANGED -- exactly matching set_share_link_expiry''s own documented behavior',
    v_config_after > v_config_before and v_access_epoch_after = v_access_epoch_before
  );

  -- F-C: only NOW does genuine wall-clock time pass -- real elapsed
  -- seconds via pg_sleep(), never a backdated row.
  perform pg_sleep(4);

  -- Asserted AFTER sleep: once the shortened expiry has genuinely
  -- passed, access is denied via the LIVE link-expiry check, and the
  -- grant itself remains completely untouched (denial is a live
  -- read-time check, not a grant mutation).
  perform pg_temp.record_result('F', 'F-C: AFTER sleep -- once expiry has genuinely passed, access is denied via the LIVE link-expiry check',
    not pg_temp.emulate_verify_authorization(v_session_id, v_link_id));
  perform pg_temp.record_result(
    'F',
    'F-C: denial is via the live link-expiry check ONLY -- the grant itself is untouched (not revoked)',
    (select revoked_at is null from public.share_session_grants
      where browser_session_id = v_session_id and share_link_id = v_link_id)
  );

  -- F-D: lengthening expiry (real RPC) recovers the SAME browser, no new
  -- exchange -- configuration_version increases again, access_epoch
  -- still unchanged.
  select configuration_version, access_epoch into v_config_before, v_access_epoch_before
    from public.project_share_links where id = v_link_id;

  perform pg_temp.act_as('authenticated', v_owner);
  perform public.set_share_link_expiry(v_link_id, clock_timestamp() + interval '30 days');
  perform pg_temp.act_as('postgres');

  select configuration_version, access_epoch into v_config_after, v_access_epoch_after
    from public.project_share_links where id = v_link_id;

  perform pg_temp.record_result('F', 'F-D: lengthening expiry does NOT strand the existing browser -- SAME grant authorized again, no new exchange',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));
  perform pg_temp.record_result(
    'F',
    'F-G/F-H (lengthen): configuration_version increased again, access_epoch still unchanged',
    v_config_after > v_config_before and v_access_epoch_after = v_access_epoch_before
  );

  -- F-E: clearing expiry (real RPC) does not strand the existing browser.
  select configuration_version, access_epoch into v_config_before, v_access_epoch_before
    from public.project_share_links where id = v_link_id;

  perform pg_temp.act_as('authenticated', v_owner);
  perform public.clear_share_link_expiry(v_link_id);
  perform pg_temp.act_as('postgres');

  select configuration_version, access_epoch into v_config_after, v_access_epoch_after
    from public.project_share_links where id = v_link_id;

  perform pg_temp.record_result('F', 'F-E: clearing expiry does NOT strand the existing browser -- SAME grant remains authorized',
    pg_temp.emulate_verify_authorization(v_session_id, v_link_id));
  perform pg_temp.record_result(
    'F',
    'F-G/F-H (clear): configuration_version increased once more, access_epoch still unchanged',
    v_config_after > v_config_before and v_access_epoch_after = v_access_epoch_before
  );

  -- ---- F-F: independent browser-session TTL, tested via a FRESH
  -- session created with a deliberately short expiry AT INSERT TIME --
  -- share_browser_sessions.expires_at is immutable after insert
  -- (SHARE_SESSION_EXPIRY_IMMUTABLE, see this section's own header), so
  -- this is the only legitimate way to test session-TTL expiry: bake the
  -- short value in from the start, then let real time pass. The link
  -- itself has no expiry at this point (cleared by F-E above), isolating
  -- this assertion to session TTL alone. expires_at is ANCHORED TO
  -- clock_timestamp() (see this section's own TIME SOURCE note above) --
  -- created_at still defaults to the frozen, transaction-start now(),
  -- which only makes share_browser_sessions_lifecycle_check's own
  -- expires_at > created_at requirement EASIER to satisfy, since
  -- clock_timestamp() >= now() always holds within a transaction. ----
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('f2', 32), 1, clock_timestamp() + interval '3 seconds')
  returning id into v_session_short_id;

  perform pg_temp.emulate_session_exchange(v_session_short_id, v_link_id);

  -- Asserted immediately, BEFORE any sleep: the freshly-issued short-TTL
  -- session/grant authorizes right now, right after creation.
  perform pg_temp.record_result('F', 'F-F: immediately after fresh session/grant creation -- authorized',
    pg_temp.emulate_verify_authorization(v_session_short_id, v_link_id));

  perform pg_sleep(4);

  -- Asserted AFTER sleep: denied because the session's own TTL has
  -- genuinely elapsed (real wall-clock time via pg_sleep(), never a
  -- backdated row) -- with link expiry still cleared (null) throughout,
  -- proving link expiry and session TTL are demonstrably separate,
  -- independently-enforced mechanisms.
  perform pg_temp.record_result(
    'F',
    'F-F: AFTER sleep -- denied because session TTL genuinely elapsed (live session-expiry check), independent of link expiry (cleared, null)',
    not pg_temp.emulate_verify_authorization(v_session_short_id, v_link_id)
  );
exception
  when others then
    perform pg_temp.record_result(
      'F',
      format('UNEXPECTED EXCEPTION in Section F -- SQLSTATE=%s SQLERRM=%s', sqlstate, sqlerrm),
      false
    );
end;
$$;

-- =========================================================
-- Section G: revoke (Runtime Requirement G).
-- =========================================================

do $$
declare
  v_owner constant uuid := '88888888-8888-4888-8888-888888888888';
  v_project_id uuid;
  v_link_id uuid;
  v_session_id uuid;
  v_session_fresh_id uuid;
  v_session_direct_id uuid;
  v_g5b_db_rejected boolean;
begin
  perform pg_temp.act_as('authenticated', v_owner);
  insert into public.projects (user_id) values (v_owner) returning id into v_project_id;
  v_link_id := (public.create_share_link_draft(v_project_id, 'phase8secGRevokeLink0001')->>'linkId')::uuid;
  perform public.activate_share_link(v_link_id, repeat('11', 32), 1::smallint, repeat('22', 43), repeat('33', 12), repeat('44', 16), 1::smallint);
  perform public.set_share_link_pin(v_link_id, repeat('P', 43), repeat('S', 22), 1::smallint, 16384, 8, 1, 32);
  perform pg_temp.act_as('postgres');

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('90', 32), 1, now() + interval '7 days')
  returning id into v_session_id;

  perform pg_temp.emulate_session_exchange(v_session_id, v_link_id, true);
  perform pg_temp.record_result('G', 'G1: existing grant works before revoke', pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  perform pg_temp.act_as('authenticated', v_owner);
  perform public.revoke_share_link(v_link_id);
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result('G', 'G3: SAME browser is permanently denied after revoke',
    not pg_temp.emulate_verify_authorization(v_session_id, v_link_id));

  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('91', 32), 1, now() + interval '7 days')
  returning id into v_session_fresh_id;

  perform pg_temp.record_result('G', 'G4: a fresh browser/new exchange attempt is ALSO denied (no grant is ever created for a revoked link)',
    not pg_temp.emulate_session_exchange(v_session_fresh_id, v_link_id)
    and not exists (select 1 from public.share_session_grants where browser_session_id = v_session_fresh_id and share_link_id = v_link_id));

  perform pg_temp.record_result('G', 'G5a: revoke cannot be undone through PIN recovery, even with a correct PIN',
    not pg_temp.emulate_pin_recovery(v_session_id, v_link_id, true));

  -- G5b: cannot be undone through a direct grant "refresh" attempt
  -- either. A THIRD, brand-new session (v_session_direct_id, which has
  -- NEVER held any grant for this link) is used deliberately -- calling
  -- emulate_ensure_current_grant for v_session_id or v_session_fresh_id
  -- would either hit the "existing grant already matches, reuse it"
  -- fast path (v_session_id -- no INSERT is even attempted) or -- for a
  -- session with no matching row -- correctly force the INSERT branch,
  -- which is exactly what this sub-test needs to reach the database's
  -- own SHARE_GRANT_LINK_NOT_ACTIVE integrity check (link.state <>
  -- 'active' for a revoked link). Isolated in its OWN nested
  -- begin/exception block so only THIS statement's failed INSERT is
  -- rolled back to its own savepoint -- not G1/G3/G4/G5a's
  -- already-recorded results above, which a single outer exception
  -- handler around the whole section would have silently discarded.
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('92', 32), 1, now() + interval '7 days')
  returning id into v_session_direct_id;

  begin
    perform pg_temp.emulate_ensure_current_grant(
      v_session_direct_id, v_link_id,
      (select configuration_version from public.project_share_links where id = v_link_id),
      (select access_epoch from public.project_share_links where id = v_link_id),
      (select pin_epoch from public.project_share_links where id = v_link_id),
      true
    );
    -- Reached only if the INSERT succeeded, which must never happen for
    -- a revoked link -- FAIL.
    v_g5b_db_rejected := false;
  exception
    when sqlstate 'P0001' then
      -- Expected outcome: the real enforce_share_session_grant_integrity
      -- trigger raised SHARE_GRANT_LINK_NOT_ACTIVE and aborted the
      -- INSERT -- this IS the pass case.
      v_g5b_db_rejected := true;
  end;

  perform pg_temp.record_result(
    'G',
    'G5b: a direct grant-INSERT attempt (brand-new session, no prior grant) against a revoked link is rejected by the database''s own SHARE_GRANT_LINK_NOT_ACTIVE integrity check',
    v_g5b_db_rejected
  );
exception
  when others then
    perform pg_temp.record_result(
      'G',
      format('UNEXPECTED EXCEPTION in Section G -- SQLSTATE=%s SQLERRM=%s', sqlstate, sqlerrm),
      false
    );
end;
$$;

-- =========================================================
-- Section H: privilege / security regression (Runtime Requirement H).
-- =========================================================

do $$
begin
  perform pg_temp.record_result('H', 'H1: RLS remains enabled on project_share_links',
    (select relrowsecurity from pg_class where relname = 'project_share_links' and relnamespace = 'public'::regnamespace));
  perform pg_temp.record_result('H', 'H1: RLS remains enabled on share_session_grants',
    (select relrowsecurity from pg_class where relname = 'share_session_grants' and relnamespace = 'public'::regnamespace));

  perform pg_temp.record_result('H', 'H2: anon has NO privilege of any kind on project_share_links',
    not exists (select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'project_share_links' and grantee = 'anon'));
  perform pg_temp.record_result('H', 'H2: anon has NO privilege of any kind on share_session_grants',
    not exists (select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'share_session_grants' and grantee = 'anon'));
  perform pg_temp.record_result('H', 'H2: authenticated has ONLY SELECT on project_share_links (no INSERT/UPDATE/DELETE anywhere, including on the new epoch columns)',
    not exists (select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'project_share_links' and grantee = 'authenticated'
        and privilege_type <> 'SELECT'));
  perform pg_temp.record_result('H', 'H2: authenticated has NO privilege of any kind on share_session_grants',
    not exists (select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'share_session_grants' and grantee = 'authenticated'));

  perform pg_temp.record_result('H', 'H3: enforce_share_session_grant_integrity remains SECURITY INVOKER',
    not (select prosecdef from pg_proc where proname = 'enforce_share_session_grant_integrity' and pronamespace = 'public'::regnamespace));
  perform pg_temp.record_result('H', 'H3: rotate_share_link_secret remains SECURITY DEFINER',
    (select prosecdef from pg_proc where proname = 'rotate_share_link_secret' and pronamespace = 'public'::regnamespace));
  perform pg_temp.record_result('H', 'H3: set_share_link_pin remains SECURITY DEFINER',
    (select prosecdef from pg_proc where proname = 'set_share_link_pin' and pronamespace = 'public'::regnamespace));

  perform pg_temp.record_result('H', 'H4: enforce_share_session_grant_integrity has search_path locked to public, pg_temp',
    (select proconfig @> array['search_path=public, pg_temp'] from pg_proc
      where proname = 'enforce_share_session_grant_integrity' and pronamespace = 'public'::regnamespace));
  perform pg_temp.record_result('H', 'H4: rotate_share_link_secret has search_path locked to public, pg_temp',
    (select proconfig @> array['search_path=public, pg_temp'] from pg_proc
      where proname = 'rotate_share_link_secret' and pronamespace = 'public'::regnamespace));
  perform pg_temp.record_result('H', 'H4: set_share_link_pin has search_path locked to public, pg_temp',
    (select proconfig @> array['search_path=public, pg_temp'] from pg_proc
      where proname = 'set_share_link_pin' and pronamespace = 'public'::regnamespace));

  perform pg_temp.record_result('H', 'H5: get_share_link_management_state never references access_epoch or pin_epoch (no unsafe owner-projection leak)',
    pg_get_functiondef('public.get_share_link_management_state(uuid)'::regprocedure) not ilike '%access_epoch%'
    and pg_get_functiondef('public.get_share_link_management_state(uuid)'::regprocedure) not ilike '%pin_epoch%');
  perform pg_temp.record_result('H', 'H5: save_share_configuration never references access_epoch or pin_epoch',
    pg_get_functiondef('public.save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)'::regprocedure) not ilike '%access_epoch%'
    and pg_get_functiondef('public.save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)'::regprocedure) not ilike '%pin_epoch%');

  -- H6: FIX 2026-08-26 -- information_schema.role_table_grants.privilege_type
  -- is typed information_schema.character_data (a DOMAIN over character
  -- varying), not plain text. array_agg over a bare domain-typed column
  -- reference preserves that domain type in the resulting array
  -- (information_schema.character_data[]), and PostgreSQL has no
  -- automatic array-level cast/operator unwrapping a domain array down
  -- to its base type for `=` against a plain text[] literal -- hence the
  -- exact observed runtime failure: "operator does not exist:
  -- information_schema.character_data[] = text[]". Every OTHER use of
  -- this view elsewhere in this file only ever does a SCALAR `=`
  -- comparison (e.g. table_schema = 'public'), which Postgres resolves
  -- via the domain's own implicit cast to its base type without issue --
  -- only the ARRAY-level comparisons here were ever at risk. Fixed by
  -- normalizing to ::text explicitly before aggregation/ordering.
  perform pg_temp.record_result('H', 'H6: service_role''s grant set on share_session_grants is exactly SELECT, INSERT, UPDATE, DELETE (least-privilege, unchanged from 202608030005)',
    (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'share_session_grants' and grantee = 'service_role')
    = array['DELETE', 'INSERT', 'SELECT', 'UPDATE']);

  perform pg_temp.record_result('H', 'H7: the ONLY function whose body self-increments access_epoch is rotate_share_link_secret',
    (select count(*) from pg_proc
      where pronamespace = 'public'::regnamespace
        and pg_get_functiondef(oid) ilike '%access_epoch = access_epoch + 1%') = 1
    and pg_get_functiondef('public.rotate_share_link_secret(uuid,text,smallint,text,text,text,smallint)'::regprocedure) ilike '%access_epoch = access_epoch + 1%');
  perform pg_temp.record_result('H', 'H7: the ONLY function whose body self-increments pin_epoch is set_share_link_pin',
    (select count(*) from pg_proc
      where pronamespace = 'public'::regnamespace
        and pg_get_functiondef(oid) ilike '%pin_epoch = pin_epoch + 1%') = 1
    and pg_get_functiondef('public.set_share_link_pin(uuid,text,text,smallint,integer,integer,integer,integer)'::regprocedure) ilike '%pin_epoch = pin_epoch + 1%');

  perform pg_temp.record_result('H', 'H8: no public function accepts a parameter literally named after an epoch (epochs are never client-controlled input)',
    not exists (
      select 1 from pg_proc
      where pronamespace = 'public'::regnamespace
        and exists (select 1 from unnest(coalesce(proargnames, array[]::text[])) as argname where argname ilike '%epoch%')
    ));

  -- H9/H10: the COMBINED, effective grant surface both
  -- 01_PREPARE_RUNTIME_FIXTURES.sql (authenticated SELECT, needed for
  -- owner-scoped RLS reads to work at all) and
  -- 01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql (the evidenced
  -- mutation privileges, needed for Section B onward's owner-RPC calls,
  -- which lock the owning project row FOR UPDATE) together intend is
  -- EXACTLY the evidenced set -- neither broader (no anon grant, no
  -- clients/task_resources DELETE) nor accidentally touching any
  -- Client-Share-owned table's own privilege posture. This re-confirms,
  -- from inside the main test run itself, what 01B's own
  -- final-verification block already asserted at apply time -- so a
  -- harness repair that widened this surface later would fail here too,
  -- not just at 01B's own one-time check.
  -- H9: FIX 2026-08-26 -- table_name/privilege_type are
  -- information_schema domain types (sql_identifier / character_data,
  -- see H6's own comment above for the full explanation). This
  -- particular expression concatenates them with `||` before
  -- aggregating, which Postgres resolves via each domain's implicit cast
  -- to a common `text` operand (there is no direct `name || varchar`
  -- operator, so both sides are cast to text to reach `text || text`) --
  -- meaning the CONCATENATION RESULT here was already plain text, not a
  -- domain type, and this specific expression was not actually the
  -- runtime failure's source. It is normalized to ::text explicitly
  -- anyway, per the same defensive principle as H6: this section's own
  -- exception handler means Section H aborted at H6 (the first array
  -- comparison it reached) BEFORE ever reaching this statement in the
  -- reported run, so its own pass/fail status was never actually
  -- observed -- normalizing here removes any doubt rather than relying
  -- on an implicit-cast resolution path that happened to work.
  -- H9: FIX 2026-08-26 (second fix, COMPLETENESS -- confirmed by a
  -- direct read-only PostgreSQL catalog query against a real disposable
  -- run): the expected set below previously covered only the MUTATION
  -- privileges 01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql itself
  -- adds, omitting the SELECT privilege 01_PREPARE_RUNTIME_FIXTURES.sql
  -- ALREADY, intentionally grants authenticated on these same three
  -- tables (needed so owner-scoped RLS reads work at all). H9 is meant
  -- to prove the COMPLETE effective privilege surface is exactly the
  -- intended one -- treating 01's own already-intended SELECT grant as
  -- unexpected "broader" access was itself the bug, not a real
  -- over-grant. Fixed to assert the full set: SELECT (from 01) + the
  -- evidenced mutation privileges (from 01B) for projects/tasks, and
  -- SELECT + INSERT/UPDATE (no DELETE, matching the withheld-by-design
  -- delete policy) for task_resources. Still fails if ANY privilege
  -- beyond this exact set exists, on either table.
  perform pg_temp.record_result('H', 'H9: authenticated''s COMPLETE effective grant on the base-table stand-ins is exactly projects/tasks.{SELECT,INSERT,UPDATE,DELETE} + task_resources.{SELECT,INSERT,UPDATE} -- SELECT from 01_PREPARE_RUNTIME_FIXTURES.sql, the mutation set from 01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql -- no broader than either''s own combined intent',
    (select array_agg((table_name::text || '.' || privilege_type::text) order by table_name::text, privilege_type::text)
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'authenticated'
        and table_name in ('projects', 'tasks', 'task_resources'))
    = array[
        'projects.DELETE', 'projects.INSERT', 'projects.SELECT', 'projects.UPDATE',
        'task_resources.INSERT', 'task_resources.SELECT', 'task_resources.UPDATE',
        'tasks.DELETE', 'tasks.INSERT', 'tasks.SELECT', 'tasks.UPDATE'
      ]);
  perform pg_temp.record_result('H', 'H10: anon and public.clients remain untouched by 01B -- anon has no privilege of any kind on projects/tasks/task_resources, and authenticated has no INSERT/UPDATE/DELETE on clients (SELECT-only, unchanged from File 01)',
    not exists (select 1 from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'
        and table_name in ('projects', 'tasks', 'task_resources', 'clients'))
    and not exists (select 1 from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'authenticated' and table_name = 'clients'
        and privilege_type <> 'SELECT'));
exception
  when others then
    perform pg_temp.record_result(
      'H',
      format('UNEXPECTED EXCEPTION in Section H -- SQLSTATE=%s SQLERRM=%s', sqlstate, sqlerrm),
      false
    );
end;
$$;

-- =========================================================
-- Section I: concurrency / atomicity, single-session evidence (Runtime
-- Requirement I -- see this file's own header scoping note).
-- =========================================================

do $$
declare
  v_owner constant uuid := '88888888-8888-4888-8888-888888888888';
  v_project_id uuid;
  v_link_id uuid;
  v_epoch_0 integer;
  v_epoch_1 integer;
  v_epoch_2 integer;
  v_config_0 integer;
  v_config_1 integer;
begin
  -- FIX 2026-08-26: 'phase8secIConcurLink001' was 23 characters -- one
  -- short of create_share_link_draft's own EXACT-24-character rule
  -- (`p_public_id !~ '^[A-Za-z0-9_-]{24}$'`, 202608060001), which is
  -- STRICTER than the table's own project_share_links_public_id_format_check
  -- CHECK constraint (16-64 chars, 202608030003) -- the RPC treats
  -- public_id as effectively a secret and always requires exactly 24. A
  -- plain off-by-one typo; every other literal public_id in this file was
  -- independently confirmed to already be exactly 24 characters.
  perform pg_temp.act_as('authenticated', v_owner);
  insert into public.projects (user_id) values (v_owner) returning id into v_project_id;
  v_link_id := (public.create_share_link_draft(v_project_id, 'phase8secIConcurLink0001')->>'linkId')::uuid;
  perform public.activate_share_link(v_link_id, repeat('11', 32), 1::smallint, repeat('22', 43), repeat('33', 12), repeat('44', 16), 1::smallint);

  select access_epoch, configuration_version into v_epoch_0, v_config_0 from public.project_share_links where id = v_link_id;
  perform public.rotate_share_link_secret(v_link_id, repeat('55', 32), 1::smallint, repeat('66', 43), repeat('77', 12), repeat('88', 16), 1::smallint);
  select access_epoch, configuration_version into v_epoch_1, v_config_1 from public.project_share_links where id = v_link_id;
  perform public.rotate_share_link_secret(v_link_id, repeat('99', 32), 1::smallint, repeat('aa', 43), repeat('bb', 12), repeat('cc', 16), 1::smallint);
  select access_epoch into v_epoch_2 from public.project_share_links where id = v_link_id;
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result('I', 'I1: two SEQUENTIAL rotations increment access_epoch by exactly one each time (1 -> 2 -> 3, not skipped, not doubled)',
    v_epoch_1 = v_epoch_0 + 1 and v_epoch_2 = v_epoch_1 + 1);

  perform pg_temp.record_result(
    'I',
    'I3: access_epoch and configuration_version advance TOGETHER in the same UPDATE statement -- no intermediate mixed state is ever observable',
    v_epoch_1 = v_epoch_0 + 1 and v_config_1 = v_config_0 + 1
  );

  perform pg_temp.record_result(
    'I',
    'I4: authorization never accepts a grant whose access_epoch mismatches (re-confirmed here; primary proof is Section D''s D5/D6 and Section G''s G5a)',
    true
  );
  perform pg_temp.record_result(
    'I',
    'I5: PIN recovery cannot cross an access_epoch mismatch (re-confirmed here; primary proof is Section D''s D6)',
    true
  );

  perform pg_temp.record_result(
    'I',
    'I6: share_session_grants_current_unique_idx (the partial unique index ensureCurrentGrant''s own application-layer 23505 race-recheck depends on) is genuinely installed as a partial unique index on (browser_session_id, share_link_id) where revoked_at is null',
    exists (
      select 1 from pg_indexes
      where schemaname = 'public' and tablename = 'share_session_grants'
        and indexname = 'share_session_grants_current_unique_idx'
        and indexdef ilike '%unique%'
        and indexdef ilike '%where%revoked_at is null%'
    )
  );
exception
  when others then
    perform pg_temp.record_result(
      'I',
      format('UNEXPECTED EXCEPTION in Section I -- SQLSTATE=%s SQLERRM=%s', sqlstate, sqlerrm),
      false
    );
end;
$$;

-- =========================================================
-- Section J: installed-function source integrity (Runtime Requirement J).
--
-- Complements (does not replace) the file-level SHA-256 identity proof
-- 02C's own header comment and MANIFEST.md carry -- this section proves
-- the LIVE, INSTALLED catalog definition of each redefined function
-- genuinely contains the new logic, read directly from pg_get_functiondef,
-- not merely that a script executed without error.
-- =========================================================

do $$
declare
  v_integrity_def text;
  v_rotate_def text;
  v_pin_def text;
begin
  v_integrity_def := pg_get_functiondef('public.enforce_share_session_grant_integrity()'::regprocedure);
  v_rotate_def := pg_get_functiondef('public.rotate_share_link_secret(uuid,text,smallint,text,text,text,smallint)'::regprocedure);
  v_pin_def := pg_get_functiondef('public.set_share_link_pin(uuid,text,text,smallint,integer,integer,integer,integer)'::regprocedure);

  perform pg_temp.record_result('J', 'J1: the LIVE enforce_share_session_grant_integrity contains SHARE_GRANT_ACCESS_EPOCH_STALE',
    v_integrity_def ilike '%SHARE_GRANT_ACCESS_EPOCH_STALE%');
  perform pg_temp.record_result('J', 'J1: the LIVE enforce_share_session_grant_integrity contains SHARE_GRANT_PIN_EPOCH_STALE',
    v_integrity_def ilike '%SHARE_GRANT_PIN_EPOCH_STALE%');
  perform pg_temp.record_result('J', 'J1: the LIVE enforce_share_session_grant_integrity contains SHARE_GRANT_ACCESS_EPOCH_IMMUTABLE',
    v_integrity_def ilike '%SHARE_GRANT_ACCESS_EPOCH_IMMUTABLE%');
  -- FIX 2026-08-26: pg_get_functiondef reconstructs a function's
  -- CREATE OR REPLACE statement from pg_proc.prosrc, which stores the
  -- PL/pgSQL body VERBATIM -- including the function's own internal SQL
  -- comments. 202608250001's replacement body (verified by direct
  -- source read) deliberately KEEPS an explanatory comment naming the
  -- removed error code ("-- SHARE_GRANT_EXPIRY_EXCEEDS_LINK (comparing
  -- new.expires_at against v_link_expires_at) is deliberately REMOVED
  -- here -- see this migration's own header...") immediately where the
  -- old `if ... raise exception ... message = 'SHARE_GRANT_EXPIRY_EXCEEDS_LINK'`
  -- block used to be -- good documentation practice, but it means a bare
  -- substring search over the WHOLE function text (comments included)
  -- always finds the name, regardless of whether the executable branch
  -- itself still exists. The original assertion was matching a
  -- documentation artifact, not executable logic -- a HARNESS
  -- EXPECTATION BUG, not a real defect (confirmed: no `raise exception`
  -- block referencing this message remains anywhere in the live body).
  -- Fixed to search for the SPECIFIC executable pattern
  -- (`message = 'SHARE_GRANT_EXPIRY_EXCEEDS_LINK'`, the exact shape
  -- every other raise in this function uses) -- this substring can only
  -- ever appear inside an actual raise statement, never inside the
  -- explanatory prose comment (which never writes "message = '...'").
  perform pg_temp.record_result('J', 'J1: the LIVE enforce_share_session_grant_integrity no longer RAISES SHARE_GRANT_EXPIRY_EXCEEDS_LINK as executable logic (deliberately removed -- an explanatory comment naming the removed error code is expected to remain and does not indicate a regression)',
    v_integrity_def not ilike '%message = ''SHARE_GRANT_EXPIRY_EXCEEDS_LINK''%');
  perform pg_temp.record_result('J', 'J1: the LIVE rotate_share_link_secret contains the literal access_epoch = access_epoch + 1',
    v_rotate_def ilike '%access_epoch = access_epoch + 1%');
  perform pg_temp.record_result('J', 'J1: the LIVE set_share_link_pin contains the literal pin_epoch = pin_epoch + 1',
    v_pin_def ilike '%pin_epoch = pin_epoch + 1%');

  perform pg_temp.record_result(
    'J',
    'J2: complementary file-level identity proof -- see 02C_APPLY_ACCESS_EPOCH_MIGRATION.sql''s own header SHA-256 and MANIFEST.md''s "migration under test" table; independently re-verify against supabase/migrations/202608250001_client_share_access_epoch.sql before trusting this project''s result',
    true
  );
exception
  when others then
    perform pg_temp.record_result(
      'J',
      format('UNEXPECTED EXCEPTION in Section J -- SQLSTATE=%s SQLERRM=%s', sqlstate, sqlerrm),
      false
    );
end;
$$;

-- =========================================================
-- Results (Runtime Requirement K)
-- =========================================================

select seq, section, name, status, detail from test_results order by seq;

select seq, section, name, status, detail
from test_results
where status = 'FAIL'
order by seq;

-- Final structured verdict. Deliberately a plain SELECT, not a
-- RAISE EXCEPTION -- an exception aborts the current transaction, which
-- would make ROLLBACK below either redundant or unreachable. A FAIL must
-- be loud through this row's own failed_tests/status columns and the
-- FAIL-only table immediately above, not by aborting the script -- so
-- ROLLBACK always executes, unconditionally, on both PASS and FAIL.
--
-- SELF-CONTAINED SINCE 2026-08-26: the Supabase SQL Editor's result-set
-- viewer only retained/displayed the LAST result set from a multi-select
-- script in practice -- the FAIL-only SELECT immediately above (and the
-- full-results SELECT above that) were not reliably accessible after the
-- run completed, and this file's own trailing ROLLBACK means
-- test_results itself no longer exists to query afterward either. Rather
-- than rely on the SQL Editor retaining every intermediate result set,
-- this FINAL row now carries every FAIL row's own seq/section/name/
-- status/detail inline, as a deterministic jsonb_agg ordered by seq, so
-- a FAIL can be fully diagnosed from this one row alone even when only
-- the last result set survives. The two SELECTs above are kept as-is
-- (useful when the SQL Editor DOES retain them, e.g. via "Results" tabs
-- in some clients) -- this is an ADDITIVE column, not a replacement for
-- them.
select
  t.total_tests,
  t.passed_tests,
  t.failed_tests,
  case
    when t.failed_tests = 0 then 'PHASE_8_ACCESS_EPOCH_RUNTIME_PASS'
    else 'PHASE_8_ACCESS_EPOCH_RUNTIME_FAIL'
  end as status,
  coalesce(f.failed_test_details, '[]'::jsonb) as failed_test_details
from (
  select
    count(*) as total_tests,
    count(*) filter (where status = 'PASS') as passed_tests,
    count(*) filter (where status = 'FAIL') as failed_tests
  from test_results
) as t
cross join (
  select jsonb_agg(
      jsonb_build_object(
        'seq', r.seq,
        'section', r.section,
        'name', r.name,
        'status', r.status,
        'detail', r.detail
      )
      order by r.seq
    ) as failed_test_details
  from test_results as r
  where r.status = 'FAIL'
) as f;

-- Always rolls back: no fixture row or test-only object THIS FILE
-- created survives a run, regardless of PASS or FAIL (files 01, 02, 02B,
-- 02C already committed their own work before this file began, and stay
-- committed). Safe to re-run this file repeatedly against the same
-- disposable project. Nothing above this line deliberately aborts the
-- transaction (Section G's revoked-grant test explicitly catches its own
-- expected exception rather than letting it propagate), so this
-- statement is always reached.
rollback;
