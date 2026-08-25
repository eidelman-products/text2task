-- Text2Task Client Share Link -- Access Epoch Grant-Invalidation Correction
-- Migration: 202608250001_client_share_access_epoch.sql
-- Created: 2026-08-25
--
-- ROOT CAUSE (Production smoke-test finding, Phase 8 rollout):
-- project_share_links.configuration_version was, since Phase 1B, used as
-- BOTH (a) a presentation/owner-editor freshness signal AND (b) the sole
-- predicate share_session_grants staleness is checked against at public
-- read time. Every owner mutation that touches configuration_version --
-- including purely presentational ones (disable, re-enable, clear PIN,
-- set/clear expiry, and save_share_configuration's settings sub-block:
-- comments/subtitle/direction/title/status/target-date visibility) --
-- therefore permanently stranded any already-authorized browser session:
-- its share_session_grants row became stale relative to the new
-- configuration_version, and no route can repair a grant without the raw
-- share secret, which is deliberately never retained client-side past its
-- first use. A returning browser holding the same, unchanged, still-valid
-- URL had no way to recover -- reproduced directly: disable, denied;
-- re-enable; SAME browser, SAME URL, still denied; only a brand-new
-- browser (still holding the URL fragment) could recover.
--
-- FIX: separate presentation freshness from security-grant invalidation
-- into two independent mechanisms:
--   1. configuration_version: UNCHANGED. Every existing bump site (Phase
--      1B/2B) is left exactly as it was. It continues to serve owner-
--      editor/multi-tab freshness exactly as today. This migration adds
--      no bump site and removes no existing bump site.
--   2. access_epoch / pin_epoch (new): the ONLY two operations that must
--      force an already-authorized browser to re-authenticate are secret
--      rotation (the primary leaked-link remediation) and a genuine PIN
--      credential change (an existing grant's own pin_verified_at can
--      already be non-null from an OLD PIN, so only a fresh version
--      comparison, not the PIN-required check alone, can force
--      revalidation against a NEW PIN value). Disable, re-enable, clear
--      PIN, set/clear expiry and ordinary settings changes are NOT
--      security credential changes -- none of them may bump either field.
--
-- WHY TWO SEPARATE FIELDS, NOT ONE SHARED "access_epoch" (a deliberate,
-- security-motivated refinement of the originally-approved single-epoch
-- design -- documented in full in
-- docs/TEXT2TASK_CLIENT_SHARE_LINK_ACCESS_EPOCH_IMPLEMENTATION_REPORT_2026-08-25.md):
-- A PIN credential change MUST have a legitimate, secret-free recovery
-- path (an already-authorized browser must be able to re-verify with just
-- the new PIN) -- otherwise the fix would trade one permanent-lockout bug
-- for another. But secret rotation MUST NOT have any such path -- "the
-- old secret must remain unusable" specifically means no OTHER mechanism
-- may substitute for proving fresh knowledge of the new secret either. If
-- rotation and PIN changes shared one counter, the PIN-only recovery path
-- this migration adds would ALSO silently recover a pre-rotation
-- browser's access via nothing more than the (unchanged) PIN -- exactly
-- the bypass rotation exists to prevent. Splitting into access_epoch
-- (rotation-only, never recoverable without the raw secret) and pin_epoch
-- (PIN-only, recoverable via PIN re-verification alone, and only ever
-- reachable when access_epoch still matches -- i.e. no rotation
-- happened) closes both requirements simultaneously without conflating
-- them.
--
-- SCOPE, kept narrow as required:
--   - Adds project_share_links.access_epoch, project_share_links.pin_epoch
--     (both integer not null default 1, matching configuration_version's
--     existing column style and > 0 check convention).
--   - Adds share_session_grants.granted_access_epoch,
--     share_session_grants.granted_pin_epoch (same style).
--   - CREATE OR REPLACEs exactly three functions, each reproduced in full
--     from its current live definition with only the stated addition/
--     removal -- no other line changed:
--       * enforce_share_session_grant_integrity() -- adds immutability +
--         insert-time staleness checks for both new grant columns;
--         REMOVES the SHARE_GRANT_EXPIRY_EXCEEDS_LINK check (see the
--         expiry-handling note below); everything else unchanged.
--       * rotate_share_link_secret(...) -- adds `access_epoch =
--         access_epoch + 1` to its existing UPDATE; the existing
--         configuration_version bump is untouched.
--       * set_share_link_pin(...) -- adds `pin_epoch = pin_epoch + 1` to
--         its existing UPDATE; the existing configuration_version bump is
--         untouched.
--   - Does NOT edit 202608060001, 202608060002, 202608060003, 202608110001
--     or any other already-applied migration.
--   - Does NOT touch disable_share_link, reenable_share_link,
--     clear_share_link_pin, set_share_link_expiry, clear_share_link_expiry,
--     revoke_share_link, save_share_configuration, or any task/resource/
--     update sub-operation -- none of them ever needed to bump either new
--     field, so none of them needs to change at all. Their EXISTING
--     configuration_version bumps are untouched and remain harmless (no
--     longer the security predicate, still the presentation-freshness
--     one).
--
-- EXPIRY STALENESS (separate defect, closed here, DB-side only):
-- share_session_grants.expires_at was historically computed as
-- min(browser-session-expiry, link-expiry) AT GRANT-CREATION TIME (see
-- 202608030004's own original design comment) and is immutable once
-- inserted (enforce_share_session_grant_integrity's own
-- SHARE_GRANT_EXPIRY_IMMUTABLE rule, unchanged here). If an owner
-- lengthens or clears a link's expiry after a grant already exists, that
-- grant's own frozen ceiling could never be extended -- and, because it
-- is a genuinely separate row-level snapshot, no per-row backfill could
-- retroactively fix an already-issued grant's already-immutable value
-- either. The correct fix, proven from the architecture and implemented
-- in the paired application-layer change
-- (lib/share/share-session-grant.server.ts, this same corrective change
-- set): stop baking link expiry into the durable grant expiry at all.
-- Link expiry is ALREADY independently, live-re-checked on every read via
-- isShareLinkCurrentlyPubliclyActive's own comparison against
-- project_share_links.expires_at -- it needs no grant-level snapshot to
-- be enforced correctly, and shortening a link's expiry already takes
-- effect immediately through that live check regardless of any grant
-- field. Browser-session TTL remains fully, independently enforced via
-- share_browser_sessions.expires_at (resolveBrowserSessionFromCookie),
-- exactly as intentionally designed, and is now the SOLE source for a
-- grant's own expires_at going forward. This migration therefore removes
-- the SHARE_GRANT_EXPIRY_EXCEEDS_LINK trigger check (which would
-- otherwise reject a session-TTL-only grant.expires_at whenever it
-- exceeds a shorter link expiry) -- SHARE_GRANT_EXPIRY_EXCEEDS_SESSION and
-- SHARE_GRANT_LINK_EXPIRED (link itself must not already be expired at
-- grant-creation time) are both fully preserved. The application-layer
-- change additionally stops comparing grant.expires_at at public
-- authorization-read time at all (redundant with the two independently-
-- enforced live checks above, and the one field that could never be
-- un-stuck for a pre-existing grant) -- see that file's own comment for
-- the full argument.
--
-- BACKFILL SAFETY: both new columns on both tables use a constant
-- `not null default 1` -- Postgres applies this as a metadata-only
-- operation with no table rewrite (identical pattern already used by
-- 202608110001's title_visible/status_visible/target_date_visible
-- addition). Because access_epoch/pin_epoch are BRAND NEW fields with no
-- prior history to reconcile, defaulting every existing link AND every
-- existing grant uniformly to 1 is the only backfill needed and is
-- provably correct: every pre-existing grant's snapshot (1) trivially
-- matches its link's current value (also 1) immediately after this
-- migration applies, so installing this migration alone invalidates
-- nothing. A row only becomes stale the next time its link is genuinely
-- rotated or has its PIN genuinely changed, exactly as intended. This is
-- safe whether Production currently holds zero or non-zero Client Share
-- rows.
--
-- NON-GOALS: does not touch project_updates, share_messages,
-- share_message_conversions, or any Phase 6 Apply/conversion object --
-- entirely orthogonal subsystem, confirmed untouched by this migration's
-- own static test. Does not change any RLS policy or any table-level
-- GRANT/REVOKE (function-level EXECUTE grants below only re-declare the
-- exact same posture the current live definitions already have -- no
-- privilege is broadened). Does not add any public/anonymous-callable
-- function that accepts a raw share secret -- the new PIN-recovery
-- capability this migration's paired application-layer change adds
-- (POST /api/share/[publicId]/pin) authorizes purely via the existing
-- ensureCurrentGrant()/verifyShareProjectionAuthorization() TypeScript
-- functions and the existing project_share_links.pin_hash comparison,
-- with no new database function of its own.

-- =========================================================
-- 1. New columns
-- =========================================================

alter table public.project_share_links
  add column access_epoch integer not null default 1,
  add column pin_epoch integer not null default 1;

alter table public.project_share_links
  add constraint project_share_links_access_epoch_check
  check (access_epoch > 0);

alter table public.project_share_links
  add constraint project_share_links_pin_epoch_check
  check (pin_epoch > 0);

comment on column public.project_share_links.access_epoch is
  'Security-credential generation counter, bumped by exactly one Client Share operation: rotate_share_link_secret. Never bumped by disable, re-enable, PIN clear, expiry changes, or ordinary settings changes -- unlike configuration_version (unchanged, presentation-freshness only), a mismatch here can NEVER be recovered without a fresh secret-based exchange. Compared against share_session_grants.granted_access_epoch at public read time by verifyShareProjectionAuthorization (lib/share/share-session-grant.server.ts).';

comment on column public.project_share_links.pin_epoch is
  'PIN-credential generation counter, bumped by exactly one Client Share operation: set_share_link_pin (covers both first-add and value-change -- the RPC does not distinguish the two, so every call bumps it; a grant''s own pin_verified_at can already be non-null from an OLD PIN, so the PIN-required check alone cannot force revalidation against a NEW value). Never bumped by clear_share_link_pin (removing a PIN only loosens the requirement; an existing grant remains safely usable). A mismatch here IS recoverable, by design, via POST /api/share/[publicId]/pin (PIN re-verification only, no raw secret) -- but only when access_epoch still matches (see that route''s own doc comment for why this ordering is security-required).';

alter table public.share_session_grants
  add column granted_access_epoch integer not null default 1,
  add column granted_pin_epoch integer not null default 1;

alter table public.share_session_grants
  add constraint share_session_grants_access_epoch_check
  check (granted_access_epoch > 0);

alter table public.share_session_grants
  add constraint share_session_grants_pin_epoch_check
  check (granted_pin_epoch > 0);

comment on column public.share_session_grants.granted_access_epoch is
  'Snapshot of project_share_links.access_epoch at the moment this grant was issued/refreshed. Immutable after insert (enforce_share_session_grant_integrity). A mismatch against the link''s live access_epoch means the link''s secret has been rotated since this grant was issued -- unrecoverable without a fresh secret-based exchange.';

comment on column public.share_session_grants.granted_pin_epoch is
  'Snapshot of project_share_links.pin_epoch at the moment this grant was issued/refreshed. Immutable after insert (enforce_share_session_grant_integrity). A mismatch against the link''s live pin_epoch means the link''s PIN has been added/changed since this grant was issued -- recoverable via POST /api/share/[publicId]/pin (PIN re-verification only), provided granted_access_epoch still matches.';

-- =========================================================
-- 2. enforce_share_session_grant_integrity() -- reproduced in full from
-- its current live definition (202608030005_client_share_integrity_and_security.sql),
-- with exactly the additions/removal described in this migration's own
-- header above. Every other line is byte-identical to the live version.
-- =========================================================

create or replace function public.enforce_share_session_grant_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_session_expires_at timestamptz;
  v_session_revoked_at timestamptz;
  v_link_state text;
  v_link_expires_at timestamptz;
  v_link_configuration_version integer;
  v_link_access_epoch integer;
  v_link_pin_epoch integer;
  v_link_requires_pin boolean;
  v_project_id uuid;
  v_project_deleted_at timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.browser_session_id is distinct from old.browser_session_id then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_SESSION_IMMUTABLE';
    end if;

    if new.share_link_id is distinct from old.share_link_id then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_LINK_IMMUTABLE';
    end if;

    if new.granted_configuration_version is distinct from old.granted_configuration_version then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_CONFIGURATION_VERSION_IMMUTABLE';
    end if;

    if new.granted_access_epoch is distinct from old.granted_access_epoch then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_ACCESS_EPOCH_IMMUTABLE';
    end if;

    if new.granted_pin_epoch is distinct from old.granted_pin_epoch then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_EPOCH_IMMUTABLE';
    end if;

    if new.pin_verified_at is distinct from old.pin_verified_at then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_VERIFICATION_IMMUTABLE';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_CREATED_AT_IMMUTABLE';
    end if;

    if new.expires_at is distinct from old.expires_at then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_EXPIRY_IMMUTABLE';
    end if;

    if old.revoked_at is not null then
      if new.revoked_at is null then
        raise exception using errcode = 'P0001', message = 'SHARE_GRANT_REVOCATION_IRREVERSIBLE';
      end if;

      if new.revoked_at is distinct from old.revoked_at then
        raise exception using errcode = 'P0001', message = 'SHARE_GRANT_REVOCATION_IMMUTABLE';
      end if;
    end if;

    return new;
  end if;

  select browser_session.expires_at, browser_session.revoked_at
    into v_session_expires_at, v_session_revoked_at
    from public.share_browser_sessions as browser_session
    where browser_session.id = new.browser_session_id;

  if v_session_expires_at is null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_SESSION_NOT_FOUND';
  end if;

  if v_session_revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_SESSION_REVOKED';
  end if;

  if v_session_expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_SESSION_EXPIRED';
  end if;

  select
      link.state,
      link.expires_at,
      link.configuration_version,
      link.access_epoch,
      link.pin_epoch,
      link.pin_hash is not null,
      project.id,
      project.deleted_at
    into
      v_link_state,
      v_link_expires_at,
      v_link_configuration_version,
      v_link_access_epoch,
      v_link_pin_epoch,
      v_link_requires_pin,
      v_project_id,
      v_project_deleted_at
    from public.project_share_links as link
    left join public.projects as project
      on project.id = link.project_id
    where link.id = new.share_link_id;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_LINK_NOT_FOUND';
  end if;

  if v_project_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PROJECT_NOT_FOUND';
  end if;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PROJECT_DELETED';
  end if;

  if v_link_state <> 'active' then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_LINK_NOT_ACTIVE';
  end if;

  if v_link_expires_at is not null and v_link_expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_LINK_EXPIRED';
  end if;

  if new.granted_configuration_version <> v_link_configuration_version then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_CONFIGURATION_VERSION_STALE';
  end if;

  if new.granted_access_epoch <> v_link_access_epoch then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_ACCESS_EPOCH_STALE';
  end if;

  if new.granted_pin_epoch <> v_link_pin_epoch then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_EPOCH_STALE';
  end if;

  if new.expires_at > v_session_expires_at then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_EXPIRY_EXCEEDS_SESSION';
  end if;

  -- SHARE_GRANT_EXPIRY_EXCEEDS_LINK (comparing new.expires_at against
  -- v_link_expires_at) is deliberately REMOVED here -- see this
  -- migration's own header "EXPIRY STALENESS" section. Grant expiry is
  -- now derived purely from browser-session expiry
  -- (lib/share/share-session-grant.server.ts's computeGrantExpiresAt);
  -- the link's own expiry remains fully, independently enforced by the
  -- SHARE_GRANT_LINK_EXPIRED check above (at grant-creation time) and by
  -- isShareLinkCurrentlyPubliclyActive's live check on every read.

  if v_link_requires_pin and new.pin_verified_at is null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_VERIFICATION_REQUIRED';
  end if;

  if not v_link_requires_pin and new.pin_verified_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED';
  end if;

  return new;
end;
$$;

comment on function public.enforce_share_session_grant_integrity() is
  'On insert, rejects a per-link grant unless the browser session exists, is live and unrevoked; the share link exists, is active and unexpired; the linked project exists and is not deleted; the granted configuration version, access epoch and pin epoch all exactly match the link''s live values; grant expiry fits within the session''s own expiry; and PIN verification presence matches the link PIN requirement. On update, keeps grant identity, configuration version, access epoch, pin epoch, PIN verification, creation and expiry immutable and permits only initial revocation. Corrected 202608250001: added access_epoch/pin_epoch staleness+immutability checks; removed the grant-expiry-vs-link-expiry ceiling (grant expiry is session-TTL-only going forward; link expiry remains independently, live-enforced elsewhere).';

revoke all on function public.enforce_share_session_grant_integrity()
  from public;
revoke all on function public.enforce_share_session_grant_integrity()
  from anon;
revoke all on function public.enforce_share_session_grant_integrity()
  from authenticated;
revoke all on function public.enforce_share_session_grant_integrity()
  from service_role;

-- =========================================================
-- 3. rotate_share_link_secret -- reproduced in full from its current live
-- definition (202608060002_client_share_access_operations.sql), with
-- exactly one addition: `access_epoch = access_epoch + 1` in the existing
-- UPDATE. Every other line, including the existing configuration_version
-- bump, is byte-identical to the live version.
-- =========================================================

create or replace function public.rotate_share_link_secret(
  p_link_id uuid,
  p_secret_digest text,
  p_secret_digest_version smallint,
  p_ciphertext_hex text,
  p_nonce_hex text,
  p_auth_tag_hex text,
  p_encryption_version smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_public_id text;
  v_link_configuration_version integer;
  v_link_secret_digest text;
  v_link_rotated_at timestamptz;
  v_new_configuration_version integer;
  v_rotation_timestamp timestamptz;
  v_updated_link_count integer;
  v_updated_material_count integer;
  v_secret_material_exists boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- No plaintext-secret parameter exists at all. Validation matches
  -- activate_share_link (202608060001) exactly.
  if p_secret_digest is null or p_secret_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_SECRET_DIGEST';
  end if;

  if p_secret_digest_version is null or p_secret_digest_version <> 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_SECRET_DIGEST_VERSION';
  end if;

  if p_ciphertext_hex is null or p_ciphertext_hex !~ '^[0-9a-f]{86}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_CIPHERTEXT';
  end if;

  if p_nonce_hex is null or p_nonce_hex !~ '^[0-9a-f]{24}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_NONCE';
  end if;

  if p_auth_tag_hex is null or p_auth_tag_hex !~ '^[0-9a-f]{32}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_AUTH_TAG';
  end if;

  if p_encryption_version is null or p_encryption_version <> 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_ENCRYPTION_VERSION';
  end if;

  select
      link.state, link.public_id, link.configuration_version,
      link.secret_digest, link.project_id, link.rotated_at
    into
      v_link_state, v_link_public_id, v_link_configuration_version,
      v_link_secret_digest, v_project_id, v_link_rotated_at
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- Rotation is supported only for active and disabled links. draft has
  -- no secret to rotate (caught by the secret_digest check below
  -- regardless); revoked is terminal; expired -> rotate is not part of
  -- this phase's supported behavior.
  if v_link_state not in ('active', 'disabled') then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_STATE_CONFLICT';
  end if;

  if v_link_secret_digest is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_SECRET_MATERIAL_MISSING';
  end if;

  select exists (
      select 1
        from public.project_share_secret_material as material
        where material.share_link_id = p_link_id
    )
    into v_secret_material_exists;

  if not v_secret_material_exists then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_SECRET_MATERIAL_MISSING';
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  -- rotated_at must represent the actual moment of THIS rotation and must
  -- be strictly greater than the row's own previous rotated_at --
  -- enforce_project_share_link_integrity (202608030005) requires exactly
  -- that whenever a secret genuinely changes on a link that already had
  -- one. now()/transaction_timestamp() is fixed for the entire enclosing
  -- transaction and is therefore NOT safe here: two rotations of the same
  -- link inside one transaction (a legitimate sequence -- nothing in this
  -- RPC or its callers forbids it) would otherwise compute the identical
  -- timestamp and the second rotation would fail its own integrity check.
  -- clock_timestamp() is real wall-clock time that advances on every call
  -- regardless of transaction boundaries, but even that is not by itself
  -- guaranteed to differ from the previous rotation at very high call
  -- rates or on platforms with coarse clock resolution, so the result is
  -- additionally floored to strictly exceed the previous rotated_at.
  v_rotation_timestamp := clock_timestamp();
  if v_link_rotated_at is not null and v_rotation_timestamp <= v_link_rotated_at then
    v_rotation_timestamp := v_link_rotated_at + interval '1 microsecond';
  end if;

  -- state, public_id, activated_at, disabled_at and expires_at are
  -- deliberately absent from this SET clause -- rotation replaces only
  -- the secret material, never the link's own lifecycle state or
  -- identity. access_epoch (new, 202608250001) IS bumped here -- this is
  -- the one and only place it is bumped: rotation is the sole operation
  -- that must force every previously-authorized browser to prove fresh
  -- knowledge of the secret again, with no PIN-only or any other recovery
  -- path.
  update public.project_share_links
    set
      secret_digest = p_secret_digest,
      secret_digest_version = p_secret_digest_version,
      rotated_at = v_rotation_timestamp,
      configuration_version = v_new_configuration_version,
      access_epoch = access_epoch + 1
    where id = p_link_id
      and user_id = v_user_id;

  get diagnostics v_updated_link_count = row_count;

  if v_updated_link_count <> 1 then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  update public.project_share_secret_material
    set
      ciphertext = decode(p_ciphertext_hex, 'hex'),
      nonce = decode(p_nonce_hex, 'hex'),
      auth_tag = decode(p_auth_tag_hex, 'hex'),
      encryption_version = p_encryption_version
    where share_link_id = p_link_id;

  get diagnostics v_updated_material_count = row_count;

  if v_updated_material_count <> 1 then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_SECRET_MATERIAL_MISSING';
  end if;

  insert into public.share_link_events (share_link_id, event_type)
  values (p_link_id, 'link_rotated');

  return jsonb_build_object(
    'linkId', p_link_id,
    'publicId', v_link_public_id,
    'state', v_link_state,
    'configurationVersion', v_new_configuration_version,
    'rotatedAt', v_rotation_timestamp
  );
end;
$$;

comment on function public.rotate_share_link_secret(uuid, text, smallint, text, text, text, smallint) is
  'Phase 1B.3: atomically replaces an owned active/disabled share link''s secret_digest and its project_share_secret_material row, bumping configuration_version exactly once -- all in one transaction (the Phase 3 grant-invalidation mechanism this migration''s header describes: rotation is the primary way a leaked link becomes unusable). SECURITY DEFINER; obtains auth.uid() internally; accepts no plaintext secret, only an already-computed digest and already-encrypted material, matching activate_share_link''s validation exactly. Verifies both UPDATE statements affect exactly one row. Preserves state, public_id, activated_at, disabled_at and expires_at. rotated_at is computed from clock_timestamp() (real wall-clock time, not the transaction-fixed now()) and is floored to strictly exceed the row''s own previous rotated_at, so consecutive rotations of the same link -- even within one transaction or one clock tick -- always produce a strictly increasing value, satisfying enforce_project_share_link_integrity''s own requirement. Writes one link_rotated event containing no identity digest, content or secret material. Never returns the digest, ciphertext, nonce, auth tag, encryption version or any owner/project identifier. Corrected 202608250001: also bumps access_epoch exactly once -- the sole, unrecoverable-without-a-fresh-exchange invalidation of every previously-authorized browser session for this link.';

revoke all on function public.rotate_share_link_secret(uuid, text, smallint, text, text, text, smallint)
  from public;
revoke all on function public.rotate_share_link_secret(uuid, text, smallint, text, text, text, smallint)
  from anon;
revoke all on function public.rotate_share_link_secret(uuid, text, smallint, text, text, text, smallint)
  from service_role;
grant execute on function public.rotate_share_link_secret(uuid, text, smallint, text, text, text, smallint)
  to authenticated;

-- =========================================================
-- 4. set_share_link_pin -- reproduced in full from its current live
-- definition (202608060002_client_share_access_operations.sql), with
-- exactly one addition: `pin_epoch = pin_epoch + 1` in the existing
-- UPDATE. Every other line, including the existing configuration_version
-- bump, is byte-identical to the live version.
-- =========================================================

create or replace function public.set_share_link_pin(
  p_link_id uuid,
  p_pin_hash text,
  p_pin_salt text,
  p_pin_hash_version smallint,
  p_pin_scrypt_n integer,
  p_pin_scrypt_r integer,
  p_pin_scrypt_p integer,
  p_pin_key_length integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_configuration_version integer;
  v_new_configuration_version integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- No plaintext PIN parameter exists at all -- only an already-hashed
  -- V1 scrypt profile crosses this boundary. Every field is validated
  -- against the exact V1 profile before any mutation is attempted.
  if p_pin_hash is null or p_pin_hash !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  if p_pin_salt is null or p_pin_salt !~ '^[A-Za-z0-9_-]{22}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  if p_pin_hash_version is null or p_pin_hash_version <> 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  if p_pin_scrypt_n is null or p_pin_scrypt_n <> 16384 then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  if p_pin_scrypt_r is null or p_pin_scrypt_r <> 8 then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  if p_pin_scrypt_p is null or p_pin_scrypt_p <> 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  if p_pin_key_length is null or p_pin_key_length <> 32 then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  select link.state, link.configuration_version, link.project_id
    into v_link_state, v_link_configuration_version, v_project_id
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_link_state = 'revoked' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_REVOKED';
  end if;

  -- Every other schema-supported lifecycle state (draft, active,
  -- disabled, expired) may configure a PIN -- nothing in the delivered
  -- schema restricts PIN columns by state.
  v_new_configuration_version := v_link_configuration_version + 1;

  -- pin_epoch (new, 202608250001) is bumped unconditionally here, exactly
  -- like configuration_version -- this single RPC serves both "add a PIN
  -- where none existed" and "change an existing PIN to a new value", and
  -- only the latter case strictly needs the bump (an existing grant's own
  -- pin_verified_at can already be non-null from the OLD PIN, so the
  -- PIN-required check alone would not force revalidation against a NEW
  -- value) -- but since one RPC covers both, bumping unconditionally is
  -- the only safe choice (harmless no-op for the first-add case, where
  -- the existing pin_verified_at-is-null check already denies stale
  -- grants regardless).
  update public.project_share_links
    set
      pin_hash = p_pin_hash,
      pin_salt = p_pin_salt,
      pin_hash_version = p_pin_hash_version,
      pin_scrypt_n = p_pin_scrypt_n,
      pin_scrypt_r = p_pin_scrypt_r,
      pin_scrypt_p = p_pin_scrypt_p,
      pin_key_length = p_pin_key_length,
      configuration_version = v_new_configuration_version,
      pin_epoch = pin_epoch + 1
    where id = p_link_id
      and user_id = v_user_id;

  -- No event: the closed share_link_events vocabulary has no PIN event.
  -- No session/grant write: invalidation is entirely through
  -- configuration_version/pin_epoch (see this migration's header).

  return jsonb_build_object(
    'linkId', p_link_id,
    'hasPin', true,
    'state', v_link_state,
    'configurationVersion', v_new_configuration_version,
    'updatedAt', v_now
  );
end;
$$;

comment on function public.set_share_link_pin(uuid, text, text, smallint, integer, integer, integer, integer) is
  'Phase 1B.3: sets/replaces the PIN on an owned, non-revoked, non-deleted-project share link, given an already-hashed V1 scrypt profile (never a plaintext PIN). SECURITY DEFINER; obtains auth.uid() internally. Sets all seven PIN columns in one UPDATE and bumps configuration_version exactly once. No event is written (no PIN event exists in the closed vocabulary) and no session/grant row is touched. Never returns pin_hash, pin_salt, profile values, user id or project id. Corrected 202608250001: also bumps pin_epoch exactly once -- the mechanism that forces an already-authorized browser to re-verify against the NEW PIN value, recoverable via POST /api/share/[publicId]/pin (PIN re-verification only, no raw secret needed) provided the link''s secret was not also rotated since that browser''s grant was issued.';

revoke all on function public.set_share_link_pin(uuid, text, text, smallint, integer, integer, integer, integer)
  from public;
revoke all on function public.set_share_link_pin(uuid, text, text, smallint, integer, integer, integer, integer)
  from anon;
revoke all on function public.set_share_link_pin(uuid, text, text, smallint, integer, integer, integer, integer)
  from service_role;
grant execute on function public.set_share_link_pin(uuid, text, text, smallint, integer, integer, integer, integer)
  to authenticated;
