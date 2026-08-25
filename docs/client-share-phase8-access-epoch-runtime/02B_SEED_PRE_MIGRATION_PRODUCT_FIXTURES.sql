-- Text2Task Client Share Link -- Phase 8 Access Epoch Runtime Verification Package
-- File 02B: Seed REAL, pre-existing product rows BEFORE the access_epoch
-- migration is ever applied (hand-authored)
--
-- Run this THIRD, after 01_PREPARE_RUNTIME_FIXTURES.sql and
-- 02_APPLY_OR_VERIFY_PREREQUISITES.sql, in the same disposable Supabase
-- project. Never run this in the real Text2Task production project.
--
-- PURPOSE (Runtime Requirement A): every claim about "existing rows
-- migrate safely" is only genuine evidence if real rows exist in the
-- table BEFORE the migration under test (File 02C) runs. This file
-- creates that pre-existing state using ONLY the pre-202608250001 schema
-- shape (project_share_links/share_session_grants have no
-- access_epoch/pin_epoch/granted_access_epoch/granted_pin_epoch columns
-- yet at this point -- File 02's own footer check already confirmed
-- that). Every insert below goes through the REAL, currently-installed
-- integrity triggers (enforce_share_session_grant_integrity and its
-- siblings), so a fixture row that would not itself be valid under
-- today's live rules is rejected by the real engine, not merely assumed
-- valid.
--
-- Fixture set (four links, covering every combination Runtime
-- Requirement A.11 asks for -- no PIN, with PIN, with expiry, and both
-- active/disabled):
--   link_no_pin_active      -- active, no PIN, no expiry
--   link_with_pin_active    -- active, full PIN material, no expiry
--   link_with_expiry_active -- active, no PIN, future expiry
--   link_disabled           -- disabled; its own grant was issued back
--                              when configuration_version was still 1,
--                              and disabling later bumped it to 2 --
--                              this is the EXACT historical Production
--                              precondition the Phase 8 defect exploited
--                              (a grant stale by the OLD
--                              configuration_version predicate, which
--                              this migration proves is no longer the
--                              authorization predicate at all)
--
-- Each active link additionally gets one real share_browser_sessions row
-- and one real share_session_grants row, so File 03's Section A can
-- prove EXISTING GRANTS (not just existing links) migrate safely and
-- receive matching granted_access_epoch/granted_pin_epoch.
--
-- Two control rows (one public.project_updates, one public.share_messages)
-- are also seeded, completely unrelated to any Client Share access-control
-- object, so File 03's Section A can independently prove Runtime
-- Requirements A.9/A.10: no unrelated Client Share data changes, and
-- project_updates / Phase 6 provenance data is untouched by this
-- migration.
--
-- Every fixture object's id is recorded into
-- public.text2task_phase8_fixture_ids, and every fixture object's FULL
-- pre-migration row (as JSONB) is recorded into
-- public.text2task_phase8_before_snapshot -- both tables created by File
-- 01, both persistent (not pg_temp), both read back by File 03's Section
-- A after File 02C has applied the migration under test.
--
-- This file commits (explicit begin/commit, no rollback) -- these rows
-- must genuinely persist in the table so File 02C's ALTER TABLE
-- statements run against real, committed pre-existing data, not data
-- that would vanish before the migration ever sees it.

begin;

do $$
declare
  v_sentinel_kind text;
begin
  if to_regclass('public.text2task_phase8_access_epoch_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 8 Access Epoch runtime test sentinel was not found. Run 01_PREPARE_RUNTIME_FIXTURES.sql and 02_APPLY_OR_VERIFY_PREREQUISITES.sql first, in that order, in this same disposable project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_phase8_access_epoch_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_8_ACCESS_EPOCH_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row does not identify this project as a disposable Phase 8 Access Epoch runtime test project.';
  end if;

  if to_regclass('public.project_share_links') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.project_share_links does not exist yet. Run 02_APPLY_OR_VERIFY_PREREQUISITES.sql first.';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'project_share_links'
      and column_name = 'access_epoch'
  ) then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.project_share_links.access_epoch already exists -- the migration under test appears to already be applied. This file must run BEFORE 02C, against the pre-migration schema, to prove genuine backfill.';
  end if;

  if exists (select 1 from public.text2task_phase8_fixture_ids where key = 'project_a') then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. Fixture rows already exist (text2task_phase8_fixture_ids has a project_a row). This file is meant to run exactly once. Provision a fresh disposable project to re-run the whole package from scratch.';
  end if;
end;
$$;

-- =========================================================
-- One project, owned by the fixture owner from File 01.
-- =========================================================

do $$
declare
  v_owner constant uuid := '88888888-8888-4888-8888-888888888888';
  v_project_id uuid;
begin
  insert into public.projects (user_id) values (v_owner) returning id into v_project_id;

  insert into public.text2task_phase8_fixture_ids (key, value) values ('project_a', v_project_id);
  insert into public.text2task_phase8_before_snapshot (key, value)
    select 'project_a', to_jsonb(p.*) from public.projects p where p.id = v_project_id;
end;
$$;

-- =========================================================
-- Four links, covering no-PIN / with-PIN / with-expiry / disabled.
-- =========================================================

do $$
declare
  v_owner constant uuid := '88888888-8888-4888-8888-888888888888';
  v_project_id uuid;
  v_link_no_pin uuid;
  v_link_with_pin uuid;
  v_link_with_expiry uuid;
  v_link_disabled uuid;
begin
  select value into v_project_id from public.text2task_phase8_fixture_ids where key = 'project_a';

  -- Every timestamp below is computed against `now()`, which Postgres
  -- freezes to this transaction's own start time for the entire
  -- transaction (this whole file is one `begin;`...`commit;`) -- so
  -- every relative offset stays internally consistent regardless of how
  -- long the file actually takes to run.
  --
  -- CORRECTED 2026-08-25 (Phase 8 disposable-run Step 4 failure): every
  -- link below now sets created_at EXPLICITLY, strictly before
  -- activated_at/disabled_at -- the original fixture relied on
  -- created_at's own `default now()`, which is evaluated at INSERT time
  -- (i.e. "right now", not 2-5 days ago), while activated_at/disabled_at
  -- were backdated -- violating project_share_links_timestamp_order_check
  -- (`activated_at >= created_at`, `disabled_at >= created_at`) on every
  -- single row, not just the first one the engine happened to report.

  -- link_no_pin_active: active, no PIN, no expiry, configuration_version = 1
  insert into public.project_share_links (
    user_id, project_id, public_id, state,
    secret_digest, secret_digest_version,
    comments_enabled, configuration_version, created_at, activated_at
  ) values (
    v_owner, v_project_id, 'phase8aeNoPinActiveLink001', 'active',
    repeat('a1', 32), 1,
    true, 1, now() - interval '3 days', now() - interval '2 days'
  ) returning id into v_link_no_pin;

  -- link_with_pin_active: active, full valid V1 PIN material, no expiry,
  -- configuration_version = 1. Pin material values are structurally
  -- valid-shaped (regex-conformant) fixture data, not a real derived
  -- scrypt hash of any real PIN -- this package proves DATABASE-level
  -- epoch semantics, not PIN cryptography (see 00_READ_ME_FIRST.md's own
  -- scoping note).
  insert into public.project_share_links (
    user_id, project_id, public_id, state,
    secret_digest, secret_digest_version,
    pin_hash, pin_salt, pin_hash_version, pin_scrypt_n, pin_scrypt_r, pin_scrypt_p, pin_key_length,
    comments_enabled, configuration_version, created_at, activated_at
  ) values (
    v_owner, v_project_id, 'phase8aeWithPinActiveLink01', 'active',
    repeat('b2', 32), 1,
    repeat('P', 43), repeat('S', 22), 1, 16384, 8, 1, 32,
    true, 1, now() - interval '3 days', now() - interval '2 days'
  ) returning id into v_link_with_pin;

  -- link_with_expiry_active: active, no PIN, future expiry, configuration_version = 1
  insert into public.project_share_links (
    user_id, project_id, public_id, state,
    secret_digest, secret_digest_version,
    comments_enabled, configuration_version, created_at, activated_at, expires_at
  ) values (
    v_owner, v_project_id, 'phase8aeExpiryActiveLink001', 'active',
    repeat('c3', 32), 1,
    true, 1, now() - interval '3 days', now() - interval '2 days', now() + interval '7 days'
  ) returning id into v_link_with_expiry;

  -- link_disabled: EXACT historical Production precondition -- activated
  -- at configuration_version 1, then disabled, which (per the real,
  -- unchanged disable_share_link RPC) bumps configuration_version to 2.
  -- Its own grant (inserted below) is issued against configuration_version
  -- 1 -- i.e. it is ALREADY stale by the OLD (pre-Phase-8) predicate. This
  -- is deliberate: File 03 proves the NEW access_epoch/pin_epoch predicate
  -- does not treat this as stale (both still backfill to 1 on both sides),
  -- closing the exact defect this migration exists to fix.
  --
  -- CORRECTED 2026-08-25: this link is now inserted as 'active' (not
  -- 'disabled') and transitioned to 'disabled' by a SEPARATE update
  -- further below, AFTER its grant is created. The original design
  -- inserted it already-'disabled' and tried to fake a pre-disable grant
  -- by temporarily UPDATE-patching configuration_version down to 1 and
  -- back up to 2 around the grant insert -- that was doubly broken: (a)
  -- enforce_share_session_grant_integrity's own SHARE_GRANT_LINK_NOT_ACTIVE
  -- check would have rejected a grant insert against a link whose state
  -- is already 'disabled', regardless of configuration_version, and (b)
  -- enforce_project_share_link_integrity's own
  -- SHARE_LINK_CONFIGURATION_VERSION_DECREASE check would independently
  -- have rejected the "patch back down to 1" update. Both are found by
  -- this same audit pass, before either could cause its own sequential
  -- Step 4 failure. The corrected sequence -- insert active, grant while
  -- active, THEN disable -- is also simply what really happened in
  -- Production and requires no bypass of any kind.
  insert into public.project_share_links (
    user_id, project_id, public_id, state,
    secret_digest, secret_digest_version,
    comments_enabled, configuration_version, created_at, activated_at
  ) values (
    v_owner, v_project_id, 'phase8aeDisabledLink0000001', 'active',
    repeat('d4', 32), 1,
    true, 1, now() - interval '6 days', now() - interval '5 days'
  ) returning id into v_link_disabled;

  insert into public.text2task_phase8_fixture_ids (key, value) values
    ('link_no_pin_active', v_link_no_pin),
    ('link_with_pin_active', v_link_with_pin),
    ('link_with_expiry_active', v_link_with_expiry),
    ('link_disabled', v_link_disabled);

  -- link_disabled's OWN snapshot is deliberately NOT captured here -- at
  -- this point it is still 'active' (state='disabled' is not set until
  -- the grant-fixture block below, AFTER its grant is created -- see that
  -- block's own comment), and text2task_phase8_before_snapshot's key
  -- column is a primary key (one row per key, not per event), so this
  -- object gets exactly one snapshot insert, captured at the end of the
  -- next block once it genuinely reflects the FINAL pre-02C state
  -- (state = 'disabled', configuration_version = 2) -- what File 02C will
  -- actually see.
  insert into public.text2task_phase8_before_snapshot (key, value)
    select 'link_no_pin_active', to_jsonb(l.*) from public.project_share_links l where l.id = v_link_no_pin
    union all
    select 'link_with_pin_active', to_jsonb(l.*) from public.project_share_links l where l.id = v_link_with_pin
    union all
    select 'link_with_expiry_active', to_jsonb(l.*) from public.project_share_links l where l.id = v_link_with_expiry;
end;
$$;

-- =========================================================
-- One real browser session + one real grant per link. All four links are
-- still 'active' at the point each grant below is created -- link_disabled
-- is transitioned to 'disabled' only at the end of its own block, AFTER
-- its grant already exists, exactly reproducing the real order of events
-- (grant issued while active, THEN the owner disables the link).
-- =========================================================

do $$
declare
  v_link_no_pin uuid;
  v_link_with_pin uuid;
  v_link_with_expiry uuid;
  v_link_disabled uuid;
  v_session_no_pin uuid;
  v_session_with_pin uuid;
  v_session_with_expiry uuid;
  v_session_disabled_link uuid;
  v_grant_no_pin uuid;
  v_grant_with_pin uuid;
  v_grant_with_expiry uuid;
  v_grant_disabled_link uuid;
  -- link_disabled itself is created at now()-6d, activated at now()-5d,
  -- and (later in this block) disabled at now()-1d -- this grant's own
  -- created_at sits strictly between activation and disable (a visitor
  -- could only have exchanged the secret for a grant after the link was
  -- actually active), not merely somewhere that happens to satisfy the
  -- CHECK constraints.
  v_grant_disabled_link_created_at timestamptz := now() - interval '4 days';
begin
  select value into v_link_no_pin from public.text2task_phase8_fixture_ids where key = 'link_no_pin_active';
  select value into v_link_with_pin from public.text2task_phase8_fixture_ids where key = 'link_with_pin_active';
  select value into v_link_with_expiry from public.text2task_phase8_fixture_ids where key = 'link_with_expiry_active';
  select value into v_link_disabled from public.text2task_phase8_fixture_ids where key = 'link_disabled';

  -- Session + grant for link_no_pin_active.
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('e5', 32), 1, now() + interval '7 days')
  returning id into v_session_no_pin;

  insert into public.share_session_grants (
    browser_session_id, share_link_id, granted_configuration_version,
    pin_verified_at, expires_at
  ) values (
    v_session_no_pin, v_link_no_pin, 1,
    null, now() + interval '7 days'
  ) returning id into v_grant_no_pin;

  -- Session + grant for link_with_pin_active (PIN already verified in
  -- this browser session, matching a genuinely-authorized returning
  -- visitor).
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('f6', 32), 1, now() + interval '7 days')
  returning id into v_session_with_pin;

  insert into public.share_session_grants (
    browser_session_id, share_link_id, granted_configuration_version,
    pin_verified_at, created_at, expires_at
  ) values (
    v_session_with_pin, v_link_with_pin, 1,
    now() - interval '1 day', now() - interval '2 days', now() + interval '7 days'
  ) returning id into v_grant_with_pin;

  -- Session + grant for link_with_expiry_active. Grant expires_at is
  -- deliberately well under both the session's own expiry and the link's
  -- own expiry, satisfying the OLD (still live at this point)
  -- SHARE_GRANT_EXPIRY_EXCEEDS_LINK check -- this row is later used by
  -- File 03's Section F to prove the migration's expiry-staleness
  -- closure without needing this specific grant to already violate the
  -- old rule.
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('a7', 32), 1, now() + interval '7 days')
  returning id into v_session_with_expiry;

  insert into public.share_session_grants (
    browser_session_id, share_link_id, granted_configuration_version,
    pin_verified_at, expires_at
  ) values (
    v_session_with_expiry, v_link_with_expiry, 1,
    null, now() + interval '3 days'
  ) returning id into v_grant_with_expiry;

  -- Session + grant for link_disabled -- THE historical-defect fixture.
  -- link_disabled is STILL 'active' at configuration_version 1 at this
  -- point in the file (see the corrected insert above) -- so this grant
  -- is created the same way every other grant in this file is, against a
  -- genuinely active link, and passes
  -- enforce_share_session_grant_integrity's own SHARE_GRANT_LINK_NOT_ACTIVE
  -- and SHARE_GRANT_CONFIGURATION_VERSION_STALE checks honestly, with no
  -- bypass of any kind.
  insert into public.share_browser_sessions (session_digest, digest_version, expires_at)
  values (repeat('b8', 32), 1, now() + interval '7 days')
  returning id into v_session_disabled_link;

  insert into public.share_session_grants (
    browser_session_id, share_link_id, granted_configuration_version,
    pin_verified_at, created_at, expires_at
  ) values (
    v_session_disabled_link, v_link_disabled, 1,
    null, v_grant_disabled_link_created_at, now() + interval '7 days'
  ) returning id into v_grant_disabled_link;

  -- NOW disable the link -- exactly what disable_share_link itself does
  -- (state -> 'disabled', configuration_version incremented, disabled_at
  -- stamped), except performed as a raw UPDATE here since disable_share_link
  -- itself requires a real authenticated owner JWT context this file
  -- deliberately does not set up (every other RPC-shaped mutation in this
  -- package is likewise done via direct DML in fixture-seeding files,
  -- reserving actual RPC calls for File 03's own behavioral tests). This
  -- single UPDATE is what enforce_project_share_link_integrity's own
  -- state-transition rule (active -> disabled, allowed) and
  -- version-bump-on-access-change rule (configuration_version must
  -- increase whenever state changes) both require, and is exactly what
  -- makes the grant just inserted (granted_configuration_version = 1)
  -- stale-by-the-OLD-predicate relative to the link's new
  -- configuration_version = 2 -- the precise historical Production
  -- precondition this fixture exists to reproduce.
  update public.project_share_links
    set state = 'disabled', configuration_version = 2, disabled_at = now() - interval '1 day'
    where id = v_link_disabled;

  insert into public.text2task_phase8_fixture_ids (key, value) values
    ('session_no_pin', v_session_no_pin),
    ('grant_no_pin', v_grant_no_pin),
    ('session_with_pin', v_session_with_pin),
    ('grant_with_pin', v_grant_with_pin),
    ('session_with_expiry', v_session_with_expiry),
    ('grant_with_expiry', v_grant_with_expiry),
    ('session_disabled_link', v_session_disabled_link),
    ('grant_disabled_link', v_grant_disabled_link);

  -- Snapshots captured LAST, after the configuration_version 2 restore
  -- above, so the "before" state genuinely reflects what File 02C will
  -- see (link_disabled at configuration_version 2, its grant still at
  -- granted_configuration_version 1).
  insert into public.text2task_phase8_before_snapshot (key, value)
    select 'session_no_pin', to_jsonb(s.*) from public.share_browser_sessions s where s.id = v_session_no_pin
    union all
    select 'grant_no_pin', to_jsonb(g.*) from public.share_session_grants g where g.id = v_grant_no_pin
    union all
    select 'session_with_pin', to_jsonb(s.*) from public.share_browser_sessions s where s.id = v_session_with_pin
    union all
    select 'grant_with_pin', to_jsonb(g.*) from public.share_session_grants g where g.id = v_grant_with_pin
    union all
    select 'session_with_expiry', to_jsonb(s.*) from public.share_browser_sessions s where s.id = v_session_with_expiry
    union all
    select 'grant_with_expiry', to_jsonb(g.*) from public.share_session_grants g where g.id = v_grant_with_expiry
    union all
    select 'session_disabled_link', to_jsonb(s.*) from public.share_browser_sessions s where s.id = v_session_disabled_link
    union all
    select 'grant_disabled_link', to_jsonb(g.*) from public.share_session_grants g where g.id = v_grant_disabled_link
    union all
    select 'link_disabled', to_jsonb(l.*) from public.project_share_links l where l.id = v_link_disabled;
  -- link_disabled's snapshot is captured exactly once, here, AFTER the
  -- configuration_version 2 restore two statements above -- this is its
  -- only insert into text2task_phase8_before_snapshot (key is a primary
  -- key; there is no earlier row for this key to conflict with), so it
  -- correctly reflects the FINAL pre-02C state File 02C will actually see.
end;
$$;

-- =========================================================
-- Two control rows, completely unrelated to any Client Share
-- access-control object -- prove Runtime Requirements A.9/A.10.
-- =========================================================

do $$
declare
  v_owner constant uuid := '88888888-8888-4888-8888-888888888888';
  v_project_id uuid;
  v_link_no_pin uuid;
  v_update_id uuid;
  v_message_id uuid;
begin
  select value into v_project_id from public.text2task_phase8_fixture_ids where key = 'project_a';
  select value into v_link_no_pin from public.text2task_phase8_fixture_ids where key = 'link_no_pin_active';

  -- Ordinary, entirely unrelated Project Update Engine row -- proves this
  -- migration (which touches only project_share_links/share_session_grants)
  -- leaves project_updates completely untouched.
  insert into public.project_updates (user_id, project_id, source_type, raw_input, status)
  values (
    v_owner, v_project_id, 'text',
    'Unrelated control row for Phase 8 access-epoch runtime verification -- must remain byte-identical after the migration under test applies.',
    'draft'
  ) returning id into v_update_id;

  -- Client-authored share_messages row -- Phase 6-adjacent, but
  -- completely untouched by this migration (which never mentions
  -- share_messages at all, per its own static test). enforce_share_message_integrity
  -- requires current_role = 'service_role' for author_type = 'client',
  -- matching the real public message-submission path exactly.
  execute 'set local role service_role';
  insert into public.share_messages (user_id, share_link_id, project_id, author_type, body)
  values (
    v_owner, v_link_no_pin, v_project_id, 'client',
    'Unrelated control message for Phase 8 access-epoch runtime verification.'
  ) returning id into v_message_id;
  execute 'reset role';

  insert into public.text2task_phase8_fixture_ids (key, value) values
    ('control_project_update', v_update_id),
    ('control_share_message', v_message_id);

  insert into public.text2task_phase8_before_snapshot (key, value)
    select 'control_project_update', to_jsonb(u.*) from public.project_updates u where u.id = v_update_id
    union all
    select 'control_share_message', to_jsonb(m.*) from public.share_messages m where m.id = v_message_id;
end;
$$;

-- =========================================================
-- Final verification
-- =========================================================

select key, value from public.text2task_phase8_fixture_ids order by key;

select
  (select count(*) from public.text2task_phase8_fixture_ids) as fixture_object_count,
  (select count(*) from public.text2task_phase8_before_snapshot) as snapshot_row_count,
  case
    when (select count(*) from public.text2task_phase8_fixture_ids) = 15
      and (select count(*) from public.text2task_phase8_before_snapshot) = 15
    then 'FILE_02B_SEED_PRE_MIGRATION_PRODUCT_FIXTURES_COMPLETE'
    else 'FILE_02B_UNEXPECTED_ROW_COUNT -- DO NOT PROCEED TO 02C'
  end as status;

commit;
