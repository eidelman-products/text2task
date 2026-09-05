-- Text2Task Client Share Link -- Phase 1B.3 Owner Access Operations
-- Migration: 202608060002_client_share_access_operations.sql
-- Created: 2026-08-06
--
-- Purpose:
-- Phase 1B.3 of the Client Share Link feature (see
-- docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_MAPPING_2026-08-05.md sections
-- 5, 8 and 8.1). This migration adds seven owner-authenticated SECURITY
-- DEFINER RPCs on top of Phase 1B.2's lifecycle state machine and
-- project_share_secret_material table:
--   public.set_share_link_pin        public.clear_share_link_pin
--   public.set_share_link_expiry     public.clear_share_link_expiry
--   public.rotate_share_link_secret  public.revoke_share_link
--   public.reveal_share_link_secret
--
-- Deliberately NOT in this migration (Phase 1B.4 or later):
--   - save_share_configuration, settings/comments/subtitle publication,
--     task mappings, resource mappings, client-facing update publication.
--   - Any public /share route, anonymous secret verification, PIN
--     verification endpoint, browser-session or session-grant creation.
--   - Encryption-key rotation/backfill (project_share_secret_material's
--     encryption_version column exists to make that possible later; no
--     job that performs it is added here).
--
-- Session-invalidation / configuration_version contract (read before
-- editing any function below):
-- Phase 1B.3 never inserts, updates or deletes a row in
-- public.share_browser_sessions or public.share_session_grants -- the
-- migration test for this file proves that directly against every one of
-- the seven functions' bodies. The only invalidation mechanism these RPCs
-- participate in is project_share_links.configuration_version, exactly
-- as 202608030003's own column comment already documents: a future
-- Phase 3 public/session-resolution layer stores
-- share_session_grants.granted_configuration_version at grant-issue time,
-- and must compare it against the *live*
-- project_share_links.configuration_version on every subsequent read,
-- rejecting a grant whose stored version no longer matches. Every genuine
-- (non-no-op) PIN set/replace/clear, expiry set/clear, and secret
-- rotation below increases configuration_version exactly once, which is
-- what will make a prior grant detectably stale once that future
-- comparison exists; revoke does the same. A no-op clear (no PIN
-- present, expiry already null) deliberately leaves
-- configuration_version untouched, since nothing access-sensitive
-- changed. reveal_share_link_secret never changes
-- configuration_version at all -- disclosing an already-valid secret
-- again is not a new grant of access. This migration does not implement,
-- and does not need to implement, the Phase 3 comparison itself.
--
-- Every RPC below obtains and validates auth.uid() itself, accepts no
-- user_id or project_id parameter, uses set search_path = public,
-- pg_temp, contains no dynamic SQL, verifies ownership and project
-- deletion state without any separate route-level SELECT, and is revoked
-- from public/anon/service_role and granted execute only to
-- authenticated -- matching AGENTS.md rule 12 and the exact posture
-- 202608060001 already established. No table grant (INSERT/UPDATE/
-- DELETE) is added anywhere in this migration.
--
-- Every existing trigger installed by 202608030005
-- (enforce_project_share_link_integrity in particular) remains the
-- unconditional second line of defense underneath every UPDATE below.
--
-- Non-goals, stated explicitly:
--   - Does not modify 202608030003, 202608030004, 202608030005,
--     202608050001 or 202608060001 in any way.
--   - Does not add, alter or drop any RLS policy, table grant, trigger,
--     state constraint, index or column on any existing table.
--   - Does not create a schema-level one-active-link-per-project index
--     (unrelated to this migration; no function here changes that
--     invariant).
--   - Stores no plaintext secret or PIN anywhere. reveal_share_link_secret
--     returns only already-encrypted material; decryption happens only
--     in server-only TypeScript (lib/share/share-secret-encryption.server.ts).
--
-- Schema-drift posture (fail closed): no `if not exists` anywhere in this
-- migration. Transaction posture: no explicit begin;/commit;, matching
-- every existing tracked migration.

-- =========================================================
-- 1. public.set_share_link_pin
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

  update public.project_share_links
    set
      pin_hash = p_pin_hash,
      pin_salt = p_pin_salt,
      pin_hash_version = p_pin_hash_version,
      pin_scrypt_n = p_pin_scrypt_n,
      pin_scrypt_r = p_pin_scrypt_r,
      pin_scrypt_p = p_pin_scrypt_p,
      pin_key_length = p_pin_key_length,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  -- No event: the closed share_link_events vocabulary has no PIN event.
  -- No session/grant write: invalidation is entirely through
  -- configuration_version (see this migration's header).

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
  'Phase 1B.3: sets/replaces the PIN on an owned, non-revoked, non-deleted-project share link, given an already-hashed V1 scrypt profile (never a plaintext PIN). SECURITY DEFINER; obtains auth.uid() internally. Sets all seven PIN columns in one UPDATE and bumps configuration_version exactly once -- this is the mechanism (see this migration''s header) that makes any Phase 3 grant issued under the old configuration stale once that future layer compares granted_configuration_version against the live value. No event is written (no PIN event exists in the closed vocabulary) and no session/grant row is touched. Never returns pin_hash, pin_salt, profile values, user id or project id.';

revoke all on function public.set_share_link_pin(uuid, text, text, smallint, integer, integer, integer, integer)
  from public;
revoke all on function public.set_share_link_pin(uuid, text, text, smallint, integer, integer, integer, integer)
  from anon;
revoke all on function public.set_share_link_pin(uuid, text, text, smallint, integer, integer, integer, integer)
  from service_role;
grant execute on function public.set_share_link_pin(uuid, text, text, smallint, integer, integer, integer, integer)
  to authenticated;

-- =========================================================
-- 2. public.clear_share_link_pin
-- =========================================================

create or replace function public.clear_share_link_pin(p_link_id uuid)
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
  v_link_has_pin boolean;
  v_link_updated_at timestamptz;
  v_new_configuration_version integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select
      link.state, link.configuration_version, link.project_id,
      link.pin_hash is not null, link.updated_at
    into
      v_link_state, v_link_configuration_version, v_project_id,
      v_link_has_pin, v_link_updated_at
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

  if not v_link_has_pin then
    -- Idempotent no-op: nothing access-sensitive changes, so
    -- configuration_version must not increase.
    return jsonb_build_object(
      'linkId', p_link_id,
      'hasPin', false,
      'state', v_link_state,
      'configurationVersion', v_link_configuration_version,
      'updatedAt', v_link_updated_at
    );
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  update public.project_share_links
    set
      pin_hash = null,
      pin_salt = null,
      pin_hash_version = null,
      pin_scrypt_n = null,
      pin_scrypt_r = null,
      pin_scrypt_p = null,
      pin_key_length = null,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  return jsonb_build_object(
    'linkId', p_link_id,
    'hasPin', false,
    'state', v_link_state,
    'configurationVersion', v_new_configuration_version,
    'updatedAt', v_now
  );
end;
$$;

comment on function public.clear_share_link_pin(uuid) is
  'Phase 1B.3: clears the PIN (all seven columns to null in one UPDATE) on an owned, non-revoked, non-deleted-project share link. SECURITY DEFINER; obtains auth.uid() internally. Bumps configuration_version exactly once only when a PIN genuinely existed (the same Phase 3 grant-invalidation mechanism this migration''s header describes) -- an already-PIN-less link is an idempotent no-op that leaves configuration_version untouched. No event, no session/grant write.';

revoke all on function public.clear_share_link_pin(uuid) from public;
revoke all on function public.clear_share_link_pin(uuid) from anon;
revoke all on function public.clear_share_link_pin(uuid) from service_role;
grant execute on function public.clear_share_link_pin(uuid) to authenticated;

-- =========================================================
-- 3. public.set_share_link_expiry
-- =========================================================

create or replace function public.set_share_link_expiry(
  p_link_id uuid,
  p_expires_at timestamptz
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
  v_link_expires_at timestamptz;
  v_link_updated_at timestamptz;
  v_new_configuration_version integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if p_expires_at is null then
    raise exception using errcode = 'P0001', message = 'INVALID_EXPIRY';
  end if;

  -- Strictly in the future relative to the transaction timestamp. This
  -- also transitively satisfies the delivered
  -- project_share_links_timestamp_order_check
  -- (expires_at is null or expires_at > created_at), since created_at is
  -- always at or before the current transaction's now().
  if p_expires_at <= v_now then
    raise exception using errcode = 'P0001', message = 'INVALID_EXPIRY';
  end if;

  select
      link.state, link.configuration_version, link.project_id,
      link.expires_at, link.updated_at
    into
      v_link_state, v_link_configuration_version, v_project_id,
      v_link_expires_at, v_link_updated_at
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

  -- Nothing in the delivered schema restricts SETTING expires_at by
  -- state (unlike clearing it while state = 'expired' -- see
  -- clear_share_link_expiry below) -- draft, active, disabled and
  -- expired may all have their expiry set or replaced. No state
  -- transition is invented or performed here.
  if v_link_expires_at is not null and v_link_expires_at = p_expires_at then
    -- Exact no-op: configuration_version must not increase.
    return jsonb_build_object(
      'linkId', p_link_id,
      'state', v_link_state,
      'expiresAt', v_link_expires_at,
      'configurationVersion', v_link_configuration_version,
      'updatedAt', v_link_updated_at
    );
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  update public.project_share_links
    set
      expires_at = p_expires_at,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  return jsonb_build_object(
    'linkId', p_link_id,
    'state', v_link_state,
    'expiresAt', p_expires_at,
    'configurationVersion', v_new_configuration_version,
    'updatedAt', v_now
  );
end;
$$;

comment on function public.set_share_link_expiry(uuid, timestamptz) is
  'Phase 1B.3: sets/replaces expires_at (strictly future) on an owned, non-revoked, non-deleted-project share link. SECURITY DEFINER; obtains auth.uid() internally. Never changes state, never auto-marks a link expired, never auto-reactivates one. Bumps configuration_version exactly once only when the value genuinely changes (the Phase 3 grant-invalidation mechanism this migration''s header describes) -- an exact no-op leaves it untouched. No event, no session/grant write.';

revoke all on function public.set_share_link_expiry(uuid, timestamptz) from public;
revoke all on function public.set_share_link_expiry(uuid, timestamptz) from anon;
revoke all on function public.set_share_link_expiry(uuid, timestamptz) from service_role;
grant execute on function public.set_share_link_expiry(uuid, timestamptz) to authenticated;

-- =========================================================
-- 4. public.clear_share_link_expiry
-- =========================================================

create or replace function public.clear_share_link_expiry(p_link_id uuid)
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
  v_link_expires_at timestamptz;
  v_link_updated_at timestamptz;
  v_new_configuration_version integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select
      link.state, link.configuration_version, link.project_id,
      link.expires_at, link.updated_at
    into
      v_link_state, v_link_configuration_version, v_project_id,
      v_link_expires_at, v_link_updated_at
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

  -- project_share_links_state_lifecycle_check requires expires_at to
  -- remain non-null while state = 'expired'. Clearing it here would
  -- either violate that constraint outright or require inventing a
  -- state transition this function does not perform, so this is a
  -- stable state conflict and no mutation happens.
  if v_link_state = 'expired' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_STATE_CONFLICT';
  end if;

  if v_link_expires_at is null then
    -- Idempotent no-op: configuration_version must not increase.
    return jsonb_build_object(
      'linkId', p_link_id,
      'state', v_link_state,
      'expiresAt', null,
      'configurationVersion', v_link_configuration_version,
      'updatedAt', v_link_updated_at
    );
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  update public.project_share_links
    set
      expires_at = null,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  return jsonb_build_object(
    'linkId', p_link_id,
    'state', v_link_state,
    'expiresAt', null,
    'configurationVersion', v_new_configuration_version,
    'updatedAt', v_now
  );
end;
$$;

comment on function public.clear_share_link_expiry(uuid) is
  'Phase 1B.3: clears expires_at on an owned, non-revoked, non-deleted-project share link, for every state except expired (project_share_links_state_lifecycle_check requires an expired link to keep a non-null expires_at, so this returns SHARE_LINK_STATE_CONFLICT and makes no mutation for that state rather than inventing an expired -> active transition). SECURITY DEFINER; obtains auth.uid() internally. Bumps configuration_version exactly once only when expiry was actually present (the Phase 3 grant-invalidation mechanism this migration''s header describes); an already-null expiry is an idempotent no-op. No event, no session/grant write.';

revoke all on function public.clear_share_link_expiry(uuid) from public;
revoke all on function public.clear_share_link_expiry(uuid) from anon;
revoke all on function public.clear_share_link_expiry(uuid) from service_role;
grant execute on function public.clear_share_link_expiry(uuid) to authenticated;

-- =========================================================
-- 5. public.rotate_share_link_secret
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
  -- identity.
  update public.project_share_links
    set
      secret_digest = p_secret_digest,
      secret_digest_version = p_secret_digest_version,
      rotated_at = v_rotation_timestamp,
      configuration_version = v_new_configuration_version
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
  'Phase 1B.3: atomically replaces an owned active/disabled share link''s secret_digest and its project_share_secret_material row, bumping configuration_version exactly once -- all in one transaction (the Phase 3 grant-invalidation mechanism this migration''s header describes: rotation is the primary way a leaked link becomes unusable). SECURITY DEFINER; obtains auth.uid() internally; accepts no plaintext secret, only an already-computed digest and already-encrypted material, matching activate_share_link''s validation exactly. Verifies both UPDATE statements affect exactly one row. Preserves state, public_id, activated_at, disabled_at and expires_at. rotated_at is computed from clock_timestamp() (real wall-clock time, not the transaction-fixed now()) and is floored to strictly exceed the row''s own previous rotated_at, so consecutive rotations of the same link -- even within one transaction or one clock tick -- always produce a strictly increasing value, satisfying enforce_project_share_link_integrity''s own requirement. Writes one link_rotated event containing no identity digest, content or secret material. Never returns the digest, ciphertext, nonce, auth tag, encryption version or any owner/project identifier.';

revoke all on function public.rotate_share_link_secret(uuid, text, smallint, text, text, text, smallint)
  from public;
revoke all on function public.rotate_share_link_secret(uuid, text, smallint, text, text, text, smallint)
  from anon;
revoke all on function public.rotate_share_link_secret(uuid, text, smallint, text, text, text, smallint)
  from service_role;
grant execute on function public.rotate_share_link_secret(uuid, text, smallint, text, text, text, smallint)
  to authenticated;

-- =========================================================
-- 6. public.revoke_share_link
-- =========================================================

create or replace function public.revoke_share_link(p_link_id uuid)
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

  -- Revoked is terminal (enforce_project_share_link_integrity already
  -- makes this unconditional); an already-revoked link returns a stable
  -- state conflict rather than silently replaying the mutation.
  if v_link_state = 'revoked' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_STATE_CONFLICT';
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  update public.project_share_links
    set
      state = 'revoked',
      revoked_at = v_now,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  -- Encrypted secret material is deliberately left in place, not
  -- deleted -- a revoked link's secret is already unusable
  -- (reveal_share_link_secret only allows state = 'active'), so no
  -- destructive cleanup is invented here.
  insert into public.share_link_events (share_link_id, event_type)
  values (p_link_id, 'link_revoked');

  return jsonb_build_object(
    'linkId', p_link_id,
    'state', 'revoked',
    'configurationVersion', v_new_configuration_version,
    'revokedAt', v_now
  );
end;
$$;

comment on function public.revoke_share_link(uuid) is
  'Phase 1B.3: permanently revokes an owned, non-deleted-project share link (terminal; already-revoked returns SHARE_LINK_STATE_CONFLICT rather than replaying the mutation), bumping configuration_version exactly once (the Phase 3 grant-invalidation mechanism this migration''s header describes). SECURITY DEFINER; obtains auth.uid() internally. Never modifies or deletes project/task/resource/update content, never touches session/grant tables, and never deletes encrypted secret material -- a revoked link''s secret becomes unreachable through reveal_share_link_secret (state = active only) without any destructive cleanup. Writes one link_revoked event. Returns only linkId, state, configurationVersion, revokedAt.';

revoke all on function public.revoke_share_link(uuid) from public;
revoke all on function public.revoke_share_link(uuid) from anon;
revoke all on function public.revoke_share_link(uuid) from service_role;
grant execute on function public.revoke_share_link(uuid) to authenticated;

-- =========================================================
-- 7. public.reveal_share_link_secret
-- =========================================================

create or replace function public.reveal_share_link_secret(p_link_id uuid)
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
  v_link_secret_digest text;
  v_link_secret_digest_version smallint;
  v_material_ciphertext bytea;
  v_material_nonce bytea;
  v_material_auth_tag bytea;
  v_material_encryption_version smallint;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- Pure read: no row lock. The link's state can only move away from
  -- 'active' concurrently (disable/rotate-in-place/revoke), never
  -- toward it as a side effect of another operation racing this one, so
  -- an unlocked read here cannot observe a torn write across the two
  -- tables queried below -- each of those UPDATEs (activate_share_link,
  -- rotate_share_link_secret) commits both of its own table changes in
  -- one transaction already.
  select
      link.state, link.public_id, link.secret_digest,
      link.secret_digest_version, link.project_id
    into
      v_link_state, v_link_public_id, v_link_secret_digest,
      v_link_secret_digest_version, v_project_id
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id;

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

  -- Draft, disabled, expired and revoked must not reveal the secret.
  if v_link_state <> 'active' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_STATE_CONFLICT';
  end if;

  if v_link_secret_digest is null or v_link_secret_digest_version <> 1 then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_SECRET_MATERIAL_MISSING';
  end if;

  select material.ciphertext, material.nonce, material.auth_tag, material.encryption_version
    into v_material_ciphertext, v_material_nonce, v_material_auth_tag, v_material_encryption_version
    from public.project_share_secret_material as material
    where material.share_link_id = p_link_id;

  if v_material_ciphertext is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_SECRET_MATERIAL_MISSING';
  end if;

  -- Never decrypts, never returns plaintext -- only already-encrypted
  -- material, lowercase hex, to the authenticated server caller.
  -- Decryption happens only in server-only TypeScript
  -- (lib/share/share-secret-encryption.server.ts). Does not touch
  -- configuration_version, view counters, events, sessions or grants:
  -- disclosing an already-valid secret again is not a new access grant.
  return jsonb_build_object(
    'linkId', p_link_id,
    'publicId', v_link_public_id,
    'ciphertextHex', encode(v_material_ciphertext, 'hex'),
    'nonceHex', encode(v_material_nonce, 'hex'),
    'authTagHex', encode(v_material_auth_tag, 'hex'),
    'encryptionVersion', v_material_encryption_version
  );
end;
$$;

comment on function public.reveal_share_link_secret(uuid) is
  'Phase 1B.3: reads (never decrypts, never returns plaintext) the encrypted secret material for an owned, active, non-deleted-project share link. SECURITY DEFINER; obtains auth.uid() internally. Draft, disabled, expired and revoked links never reveal. Requires secret_digest, secret_digest_version = 1 and exactly one project_share_secret_material row to exist. Returns only linkId, publicId, ciphertextHex, nonceHex, authTagHex, encryptionVersion (lowercase, exact-length hex) to the authenticated server caller -- decryption happens only in server-only TypeScript. Does not mutate configuration_version, view counters, events, sessions or grants: this is a pure, repeatable read of already-valid material, not a new grant of access.';

revoke all on function public.reveal_share_link_secret(uuid) from public;
revoke all on function public.reveal_share_link_secret(uuid) from anon;
revoke all on function public.reveal_share_link_secret(uuid) from service_role;
grant execute on function public.reveal_share_link_secret(uuid) to authenticated;
