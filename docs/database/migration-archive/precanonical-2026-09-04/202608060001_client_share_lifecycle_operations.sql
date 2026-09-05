-- Text2Task Client Share Link -- Phase 1B.2 Owner Lifecycle Operations
-- Migration: 202608060001_client_share_lifecycle_operations.sql
-- Created: 2026-08-06
--
-- Purpose:
-- Phase 1B.2 of the Client Share Link feature (see
-- docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_MAPPING_2026-08-05.md, sections
-- 4.7, 8.0 and 10, and AGENTS.md's amended rule 7). This migration adds:
--
--   1. public.project_share_secret_material -- a new, fully closed table
--      storing an AES-256-GCM-encrypted copy of the raw share secret, so an
--      authenticated owner can repeatedly re-copy an already-active link's
--      URL. No role is granted anything on this table; it is reachable
--      only through the SECURITY DEFINER RPCs below.
--
--   2. Four owner-authenticated SECURITY DEFINER RPCs implementing the
--      lifecycle state machine draft -> active -> disabled -> active:
--        public.create_share_link_draft
--        public.activate_share_link
--        public.disable_share_link
--        public.reenable_share_link
--
-- Deliberately NOT in this migration (deferred to later Phase 1B slices):
--   - PIN set/replace/clear/verification, expiry set/replace/clear, secret
--     rotation, a reveal/re-copy endpoint (Phase 1B.3).
--   - save_share_configuration / task or Resource mappings / client-facing
--     update publication (Phase 1B.4).
--   - Any public /share route, browser session or grant (Phase 3).
--   - expired -> active re-activation (explicitly Phase 1B.3's to add).
--
-- Every RPC below obtains and validates auth.uid() itself, accepts no
-- user_id parameter, uses set search_path = public, pg_temp, contains no
-- dynamic SQL, and is revoked from public/anon/service_role and granted
-- execute only to authenticated -- matching AGENTS.md rule 12's narrow
-- SECURITY DEFINER carve-out exactly. No table grant (INSERT/UPDATE/DELETE)
-- is added anywhere in this migration: every mutation below is reachable
-- only through these four functions' owner-implicit privileges.
--
-- Race safety: activate_share_link and reenable_share_link both use the
-- identical two-level lock order (owning projects row FOR UPDATE, then the
-- target project_share_links row FOR UPDATE) before checking "is any other
-- link for this project already active", so two concurrent
-- activate/re-enable calls for two different links of the same project
-- serialize against each other and the V1 one-active-link-per-project rule
-- cannot be raced. This mirrors the mapping report's section 10 design
-- exactly. No schema-level partial unique index is added for this rule --
-- Addendum A requires the schema to remain capable of multiple links per
-- project; the rule is enforced only at this RPC layer, exactly as
-- 202608030003 already documents.
--
-- Every existing trigger installed by 202608030005
-- (enforce_project_share_link_integrity in particular) remains the
-- unconditional second line of defense underneath every UPDATE/INSERT
-- below -- monotonic configuration_version, immutable activated_at,
-- terminal revoked state and the state-transition matrix are enforced
-- there regardless of any bug in this migration's own RPC preconditions.
--
-- Non-goals, stated explicitly:
--   - Does not modify 202608030003, 202608030004, 202608030005 or
--     202608050001 in any way. The one exception is a NEW `comment on
--     column public.project_share_links.secret_digest` statement below,
--     which supersedes (without editing) that column's existing comment
--     from 202608030003 -- COMMENT ON is idempotent metadata, not a table
--     definition change, and this is the mechanism the Phase 1B mapping
--     report's section 15 prescribes for exactly this situation.
--   - Does not add, alter or drop any RLS policy, table grant, trigger,
--     state constraint, index or column on any existing Client Share
--     table.
--   - Does not create a schema-level one-active-link-per-project unique
--     index (see above).
--   - Stores no plaintext secret anywhere. Encryption and decryption
--     happen only in server-only TypeScript
--     (lib/share/share-secret-encryption.server.ts); this migration only
--     ever moves already-encrypted bytes.
--
-- Schema-drift posture (fail closed): no `if not exists` anywhere in this
-- migration. Transaction posture: no explicit begin;/commit;, matching
-- every existing tracked migration -- see 202608030003's header for the
-- full reasoning.

-- =========================================================
-- 1. public.project_share_secret_material
-- =========================================================

create table public.project_share_secret_material (
  share_link_id uuid primary key
    references public.project_share_links(id) on delete cascade,

  ciphertext bytea not null,
  nonce bytea not null,
  auth_tag bytea not null,
  encryption_version smallint not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_share_secret_material_nonce_length_check
    check (octet_length(nonce) = 12),

  constraint project_share_secret_material_auth_tag_length_check
    check (octet_length(auth_tag) = 16),

  -- A V1 raw share secret is exactly 43 base64url ASCII characters
  -- (lib/share/share-secret.server.ts's generateRawShareSecret). AES-GCM
  -- is a stream cipher over the plaintext -- it adds no padding -- so the
  -- ciphertext is always exactly as many bytes as the plaintext: 43. A
  -- broader "non-empty" rule would let a caller invoking this RPC
  -- directly store an arbitrarily large bytea value; this constraint
  -- closes that off at the schema level, not merely in the RPC.
  constraint project_share_secret_material_ciphertext_length_check
    check (octet_length(ciphertext) = 43),

  -- Exactly 1 for this V1 implementation. A future key-rotation scheme
  -- introduces a new version rather than silently reusing this one; see
  -- the table comment below.
  constraint project_share_secret_material_encryption_version_check
    check (encryption_version = 1),

  constraint project_share_secret_material_timestamp_order_check
    check (updated_at >= created_at)
);

comment on table public.project_share_secret_material is
  'Fully closed table storing only AES-256-GCM encrypted share-secret material, one row per share link. This is NOT a public verification source: public.project_share_links.secret_digest remains the sole one-way value every access decision compares against. Plaintext never enters PostgreSQL -- encryption and decryption happen only in server-only TypeScript (lib/share/share-secret-encryption.server.ts). No role -- public, anon, authenticated or service_role -- is granted any privilege on this table; it is reachable only through the narrowly scoped SECURITY DEFINER RPCs in this migration, which read/write it using their owner''s implicit table-owner privileges, never a granted one. RLS is enabled with no policy, as belt-and-suspenders even though no role holds a grant regardless.';

comment on column public.project_share_secret_material.share_link_id is
  'The share link this encrypted material belongs to, and the AES-GCM additional authenticated data (AAD) bound on every encrypt/decrypt call -- a ciphertext/nonce/auth_tag triple copied onto a different link''s row fails authentication instead of silently decrypting into the wrong link''s secret.';

comment on column public.project_share_secret_material.ciphertext is
  'AES-256-GCM ciphertext of the raw 43-character base64url share secret. AES-GCM adds no padding, so this is always exactly 43 bytes for the V1 secret shape (project_share_secret_material_ciphertext_length_check). Never plaintext, never stored anywhere else.';

comment on column public.project_share_secret_material.nonce is
  'The 12-byte AES-GCM initialization vector, freshly random for every encryption -- never reused.';

comment on column public.project_share_secret_material.auth_tag is
  'The 16-byte AES-GCM authentication tag, stored separately from ciphertext so a future key-rotation/re-encryption job can act on it independently.';

comment on column public.project_share_secret_material.encryption_version is
  'Version of the encryption key/scheme used to produce ciphertext/nonce/auth_tag. Exactly 1 for this V1 implementation; a future stronger scheme or key rotation requires a new version introduced by a reviewed migration, matching the repository''s pin_hash_version precedent.';

-- Supersedes (without editing) 202608030003's original comment on this
-- column, per the Phase 1B mapping report section 15: secret_digest
-- remains the one-way, non-reversible verification value; the new,
-- separately stored encrypted copy above is never consulted for access
-- decisions and never substitutes for this digest.
comment on column public.project_share_links.secret_digest is
  'Lowercase hex keyed HMAC-SHA256 digest of the share secret -- remains the one-way, non-reversible verification value: every access decision compares against THIS digest alone, never against any encrypted material. Nullable only in the pre-generation ''draft'' state (project_share_links_secret_digest_consistency_check). Since 202608060001, a separately stored, owner-recoverable copy of the same secret is also kept, AES-256-GCM encrypted, in the fully closed public.project_share_secret_material table, so the owner can repeatedly re-copy an already-active link -- that encrypted material is never used as, and can never substitute for, the public verification value, which remains this digest alone.';

alter table public.project_share_secret_material enable row level security;

-- No policy of any kind is defined on this table -- default-deny for every
-- role, matching public.share_browser_sessions et al.

revoke all on table public.project_share_secret_material from public;
revoke all on table public.project_share_secret_material from anon;
revoke all on table public.project_share_secret_material from authenticated;
revoke all privileges
  on table public.project_share_secret_material
  from service_role;

-- Deliberately NO positive grant to any role, ever. The four RPCs below
-- read/write this table using their SECURITY DEFINER owner's implicit
-- table-owner privileges, which require no grant at all.

-- updated_at maintenance reuses the existing shared Client Share trigger
-- helper (202608030003's public.set_client_share_updated_at) rather than
-- defining a near-identical new one -- its actual behavior was read in
-- full before this migration was written: SECURITY INVOKER, an explicit
-- search_path, and it only ever sets new.updated_at = now(). PostgreSQL
-- checks EXECUTE on a trigger function only when the trigger is CREATED
-- (by this migration, run with full owner privileges), never when it
-- fires, so this table needs no new grant on that shared function either.
drop trigger if exists project_share_secret_material_set_updated_at
  on public.project_share_secret_material;

create trigger project_share_secret_material_set_updated_at
before update on public.project_share_secret_material
for each row
execute function public.set_client_share_updated_at();

-- =========================================================
-- 2. public.create_share_link_draft(p_project_id uuid, p_public_id text)
-- =========================================================

create or replace function public.create_share_link_draft(
  p_project_id uuid,
  p_public_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_user_id uuid;
  v_project_deleted_at timestamptz;
  v_project_is_archived boolean;
  v_link_id uuid;
  v_public_id text;
  v_state text;
  v_created_at timestamptz;
  v_constraint_name text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_project_id is null then
    raise exception using errcode = 'P0001', message = 'PROJECT_NOT_FOUND';
  end if;

  -- The table's own project_share_links_public_id_format_check remains
  -- deliberately future-compatible at 16-64 characters (202608030003).
  -- This RPC's own input validation is intentionally narrower: the V1
  -- server-side generator (lib/share/share-public-id.server.ts) always
  -- produces exactly randomBytes(18).toString("base64url") -- 24
  -- characters -- so this closes the RPC's accepted input to exactly
  -- that shape, preventing a direct caller from bypassing the V1
  -- lifecycle operation's intended candidate shape. This does not make
  -- public_id a secret and does not alter the table's own constraint.
  if p_public_id is null or p_public_id !~ '^[A-Za-z0-9_-]{24}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_PUBLIC_ID';
  end if;

  -- Ordinary ownership-verification lock -- multiple simultaneous drafts
  -- for the same project are always allowed (a draft is never active, so
  -- it can never violate the one-active-link rule), so no cross-link lock
  -- is needed here, only ownership verification.
  select project.user_id, project.deleted_at, project.is_archived
    into v_project_user_id, v_project_deleted_at, v_project_is_archived
    from public.projects as project
    where project.id = p_project_id
    for update;

  if v_project_user_id is null
    or v_project_user_id <> v_user_id
    or v_project_deleted_at is not null
  then
    raise exception using errcode = 'P0001', message = 'PROJECT_NOT_FOUND';
  end if;

  if v_project_is_archived then
    raise exception using errcode = 'P0001', message = 'PROJECT_ARCHIVED';
  end if;

  begin
    insert into public.project_share_links (
      user_id,
      project_id,
      public_id
    ) values (
      v_user_id,
      p_project_id,
      p_public_id
    )
    returning id, public_id, state, created_at
      into v_link_id, v_public_id, v_state, v_created_at;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name = 'project_share_links_public_id_unique' then
        raise exception using errcode = 'P0001', message = 'PUBLIC_ID_COLLISION';
      end if;

      raise;
  end;

  -- Content-free audit event only: share_link_id and a closed event_type,
  -- nothing else. identity_digest/identity_digest_version stay null.
  insert into public.share_link_events (share_link_id, event_type)
  values (v_link_id, 'link_created');

  return jsonb_build_object(
    'linkId', v_link_id,
    'publicId', v_public_id,
    'state', v_state,
    'createdAt', v_created_at
  );
end;
$$;

comment on function public.create_share_link_draft(uuid, text) is
  'Phase 1B.2: creates a draft share link for one owned, non-deleted, non-archived project. SECURITY DEFINER; obtains auth.uid() internally; never accepts user_id or a secret. Multiple drafts per project are always allowed. On a public_id unique-constraint collision (identified by exact constraint name, never by message substring), raises PUBLIC_ID_COLLISION so the TypeScript caller can retry with a fresh candidate -- this function itself never loops. Writes one link_created event in the same transaction. Returns only linkId, publicId, state, createdAt.';

revoke all on function public.create_share_link_draft(uuid, text) from public;
revoke all on function public.create_share_link_draft(uuid, text) from anon;
revoke all on function public.create_share_link_draft(uuid, text)
  from service_role;
grant execute on function public.create_share_link_draft(uuid, text)
  to authenticated;

-- =========================================================
-- 3. public.activate_share_link(...)
-- =========================================================

create or replace function public.activate_share_link(
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
  v_link_user_id uuid;
  v_locked_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_public_id text;
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

  -- Input validation before any mutation. No plaintext-secret parameter
  -- exists at all -- only an already-computed digest and already-encrypted
  -- material cross this boundary.
  if p_secret_digest is null or p_secret_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_SECRET_DIGEST';
  end if;

  if p_secret_digest_version is null or p_secret_digest_version <> 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_SECRET_DIGEST_VERSION';
  end if;

  -- A V1 raw share secret is exactly 43 base64url ASCII characters, and
  -- AES-GCM adds no padding, so the ciphertext is always exactly 43
  -- bytes -- 86 lowercase hex characters. This matches
  -- project_share_secret_material_ciphertext_length_check exactly, so a
  -- caller invoking this RPC directly cannot store a shorter, longer, or
  -- differently-encoded ciphertext than the table itself will accept.
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

  -- Race-safe lock order (identical to reenable_share_link below):
  -- 1. Identify the immutable project_id from the owned link (a plain
  --    read; project_id can never change on an existing link, so reading
  --    it before any lock is safe).
  select link.project_id, link.user_id
    into v_project_id, v_link_user_id
    from public.project_share_links as link
    where link.id = p_link_id;

  if v_project_id is null or v_link_user_id <> v_user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- 2. Lock the owning projects row FIRST -- a stable, single lock target
  --    per project, so two concurrent activate/re-enable calls for two
  --    DIFFERENT links of the SAME project serialize here before either
  --    reaches its own link row.
  select project.id, project.deleted_at
    into v_locked_project_id, v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id
    for update;

  if v_locked_project_id is null or v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- 3. Only then lock the specific target link row.
  select link.state, link.public_id, link.configuration_version
    into v_link_state, v_link_public_id, v_link_configuration_version
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_link_state <> 'draft' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_DRAFT';
  end if;

  -- 4. With the project lock held, this check is race-safe: no concurrent
  --    activate/re-enable for this project can be mid-flight unobserved.
  if exists (
    select 1
      from public.project_share_links as other_link
      where other_link.project_id = v_project_id
        and other_link.id <> p_link_id
        and other_link.state = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_ANOTHER_LINK_ACTIVE';
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  update public.project_share_links
    set
      state = 'active',
      secret_digest = p_secret_digest,
      secret_digest_version = p_secret_digest_version,
      activated_at = v_now,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  insert into public.project_share_secret_material (
    share_link_id,
    ciphertext,
    nonce,
    auth_tag,
    encryption_version
  ) values (
    p_link_id,
    decode(p_ciphertext_hex, 'hex'),
    decode(p_nonce_hex, 'hex'),
    decode(p_auth_tag_hex, 'hex'),
    p_encryption_version
  );

  insert into public.share_link_events (share_link_id, event_type)
  values (p_link_id, 'link_activated');

  return jsonb_build_object(
    'linkId', p_link_id,
    'publicId', v_link_public_id,
    'state', 'active',
    'configurationVersion', v_new_configuration_version,
    'activatedAt', v_now
  );
end;
$$;

comment on function public.activate_share_link(uuid, text, smallint, text, text, text, smallint) is
  'Phase 1B.2: activates an owned draft share link, atomically setting secret_digest/secret_digest_version/activated_at, inserting the matching project_share_secret_material row, and bumping configuration_version exactly once -- all in one transaction. SECURITY DEFINER; obtains auth.uid() internally; accepts no plaintext secret, only an already-computed digest and already-encrypted material. Uses the project-then-link two-level lock so the V1 one-active-link-per-project rule is race-safe across different links of the same project. Never returns the digest, ciphertext, nonce, auth tag, encryption version, user id or project id.';

revoke all on function public.activate_share_link(uuid, text, smallint, text, text, text, smallint)
  from public;
revoke all on function public.activate_share_link(uuid, text, smallint, text, text, text, smallint)
  from anon;
revoke all on function public.activate_share_link(uuid, text, smallint, text, text, text, smallint)
  from service_role;
grant execute on function public.activate_share_link(uuid, text, smallint, text, text, text, smallint)
  to authenticated;

-- =========================================================
-- 4. public.disable_share_link(p_link_id uuid)
-- =========================================================

create or replace function public.disable_share_link(p_link_id uuid)
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

  -- Single-level lock: disabling can only ever REMOVE the one active link
  -- for a project, never create a second one, so no project-level lock or
  -- one-active-link check is needed here.
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

  if v_link_state <> 'active' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_ACTIVE';
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  update public.project_share_links
    set
      state = 'disabled',
      disabled_at = v_now,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  -- Secret material is never deleted or changed by disabling -- a
  -- disabled link's owner must still be able to re-enable it later with
  -- the same secret.
  insert into public.share_link_events (share_link_id, event_type)
  values (p_link_id, 'link_disabled');

  return jsonb_build_object(
    'linkId', p_link_id,
    'state', 'disabled',
    'configurationVersion', v_new_configuration_version,
    'disabledAt', v_now
  );
end;
$$;

comment on function public.disable_share_link(uuid) is
  'Phase 1B.2: disables an owned active share link, setting disabled_at and bumping configuration_version exactly once. SECURITY DEFINER; obtains auth.uid() internally. Never deletes or changes project_share_secret_material. Writes one link_disabled event in the same transaction. Returns only linkId, state, configurationVersion, disabledAt.';

revoke all on function public.disable_share_link(uuid) from public;
revoke all on function public.disable_share_link(uuid) from anon;
revoke all on function public.disable_share_link(uuid) from service_role;
grant execute on function public.disable_share_link(uuid) to authenticated;

-- =========================================================
-- 5. public.reenable_share_link(p_link_id uuid)
--
-- Supports ONLY disabled -> active in Phase 1B.2. expired -> active is
-- explicitly Phase 1B.3's to add (expiry management does not exist yet).
-- =========================================================

create or replace function public.reenable_share_link(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_link_user_id uuid;
  v_locked_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_secret_digest text;
  v_link_configuration_version integer;
  v_link_activated_at timestamptz;
  v_link_disabled_at timestamptz;
  v_secret_material_exists boolean;
  v_new_configuration_version integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- Race-safe lock order, identical to activate_share_link above.
  -- 1. Identify the immutable project_id from the owned link.
  select link.project_id, link.user_id
    into v_project_id, v_link_user_id
    from public.project_share_links as link
    where link.id = p_link_id;

  if v_project_id is null or v_link_user_id <> v_user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- 2. Lock the owning projects row first.
  select project.id, project.deleted_at
    into v_locked_project_id, v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id
    for update;

  if v_locked_project_id is null or v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- 3. Only then lock the specific target link row.
  select
      link.state, link.secret_digest, link.configuration_version,
      link.activated_at, link.disabled_at
    into
      v_link_state, v_link_secret_digest, v_link_configuration_version,
      v_link_activated_at, v_link_disabled_at
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_link_state <> 'disabled' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_DISABLED';
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

  -- 4. With the project lock held, this check is race-safe.
  if exists (
    select 1
      from public.project_share_links as other_link
      where other_link.project_id = v_project_id
        and other_link.id <> p_link_id
        and other_link.state = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_ANOTHER_LINK_ACTIVE';
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  -- activated_at and disabled_at are deliberately absent from this SET
  -- clause: enforce_project_share_link_integrity makes activated_at
  -- immutable once set, and disabled_at must never be cleared, so both
  -- stay exactly as they already are.
  update public.project_share_links
    set
      state = 'active',
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  -- No distinct "re-enabled" event code exists in the closed
  -- share_link_events vocabulary (a documented, deferred gap) -- reuse
  -- link_activated, exactly as the Phase 1B mapping report specifies.
  insert into public.share_link_events (share_link_id, event_type)
  values (p_link_id, 'link_activated');

  return jsonb_build_object(
    'linkId', p_link_id,
    'state', 'active',
    'configurationVersion', v_new_configuration_version,
    'activatedAt', v_link_activated_at,
    'disabledAt', v_link_disabled_at
  );
end;
$$;

comment on function public.reenable_share_link(uuid) is
  'Phase 1B.2: re-enables an owned disabled share link back to active (disabled -> active only; expired -> active is Phase 1B.3''s to add), bumping configuration_version exactly once. SECURITY DEFINER; obtains auth.uid() internally. Uses the identical project-then-link two-level lock as activate_share_link so the one-active-link-per-project rule is race-safe. Requires secret_digest and project_share_secret_material to already exist. Never changes activated_at or clears disabled_at, and never replaces the secret or encrypted material. Writes one link_activated event (no distinct re-enable code exists). Returns only linkId, state, configurationVersion, activatedAt, disabledAt.';

revoke all on function public.reenable_share_link(uuid) from public;
revoke all on function public.reenable_share_link(uuid) from anon;
revoke all on function public.reenable_share_link(uuid) from service_role;
grant execute on function public.reenable_share_link(uuid) to authenticated;
