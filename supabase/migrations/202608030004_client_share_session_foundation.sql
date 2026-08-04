-- Text2Task Client Share Link -- Browser Session, Grant, Event and
-- Rate-Limit Foundation
-- Migration: 202608030004_client_share_session_foundation.sql
-- Created: 2026-08-03
--
-- Purpose:
-- Phase 1A database foundation for everything the anonymous side of the
-- Client Share Link feature needs, none of which is owner-facing. Four
-- tables, all SERVICE-ROLE-ONLY:
--   share_browser_sessions   opaque server-managed browser identities
--   share_session_grants     one grant per (browser session, share link)
--   share_link_events        content-free operational/security audit
--   share_rate_limit_buckets database-atomic rate-limit accounting
--
-- Why sessions and grants are two tables, not one:
-- A single browser must be able to hold access to several independent
-- share links at once. Opening a second shared project must not invalidate
-- access to the first, and disabling, rotating or revoking ONE link must
-- invalidate only that link's grant while leaving unrelated grants in the
-- same browser session untouched. Folding the link into the session row
-- would make both of those impossible: it would force one session row per
-- link (so a second link replaces the first) or one link per session (same
-- outcome). One session with N grants is the only shape that satisfies the
-- locked requirement, and it is what this migration creates.
--
-- Security posture for all four tables (identical to
-- public.authenticated_product_events and the homepage-demo tables):
-- RLS is enabled and NO user-facing policy is defined at all. Combined
-- with the revokes at the bottom of this file that is default-deny for
-- every role, including service_role. Positive service_role grants are
-- deliberately withheld until
-- 202608030005_client_share_integrity_and_security.sql has installed the
-- required integrity trigger on share_session_grants. No anon grant
-- appears anywhere in this migration, no authenticated policy exists on
-- any of these tables, and none of them is exposed through a view.
-- Anonymous clients never query these tables -- a narrowly scoped
-- server-side operation does, after it has verified a browser session and
-- a per-link grant.
--
-- Privacy: no raw browser cookie secret, no raw IP address, no user agent
-- string, no project/task title, no comment body, no client name, no file
-- name, no Resource label, no share secret, no PIN, no public URL, no
-- signed URL and no storage path is stored anywhere in this migration.
-- Identities appear only as versioned keyed digests.
--
-- Non-goals: this migration creates, alters, drops or re-grants no
-- existing production object. public.projects, public.tasks,
-- public.clients, public.users, public.task_resources and storage.* are
-- not touched at all; public.project_share_links is referenced by foreign
-- key only and is not modified.
--
-- Schema-drift posture (fail closed): no `create table if not exists`, no
-- `add column if not exists` and no `create index if not exists` for any
-- new object here. If a Client Share object already exists unexpectedly
-- this migration fails loudly rather than adopting it.
--
-- Transaction posture: no explicit begin;/commit;, matching every existing
-- tracked migration -- see the header of
-- 202608030003_client_share_owner_foundation.sql for the full reasoning.
--
-- Sequencing: this migration must be applied after
-- 202608030003_client_share_owner_foundation.sql (which creates
-- public.project_share_links and public.set_client_share_updated_at) and
-- before 202608030005_client_share_integrity_and_security.sql.

-- =========================================================
-- 1. public.share_browser_sessions
--
-- One row per opaque server-managed browser identity. The browser holds
-- only a random cookie secret; this table holds only a keyed digest of it,
-- so a database leak alone does not yield a usable cookie value.
-- =========================================================

create table public.share_browser_sessions (
  id uuid primary key default gen_random_uuid(),

  session_digest text not null,
  digest_version smallint not null,

  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz null,

  constraint share_browser_sessions_session_digest_unique
    unique (session_digest),

  constraint share_browser_sessions_session_digest_format_check
    check (session_digest ~ '^[0-9a-f]{64}$'),

  constraint share_browser_sessions_digest_version_check
    check (digest_version > 0),

  constraint share_browser_sessions_lifecycle_check
    check (
      expires_at > created_at
      and last_seen_at >= created_at
      and (revoked_at is null or revoked_at >= created_at)
    )
);

comment on table public.share_browser_sessions is
  'Opaque server-managed browser session identities for the anonymous Client Share surface. Service-role only: RLS is enabled with no policies at all, and nothing is granted to anon or authenticated. Holds no raw cookie secret, no raw IP, no user agent, and no content of any kind. A session is only an identity -- what it may actually see is decided entirely by its rows in public.share_session_grants.';

comment on column public.share_browser_sessions.session_digest is
  'Lowercase hex keyed digest of the browser''s cookie secret. The raw cookie secret is NEVER stored, so this column cannot be reversed into a working cookie value. Unique, because it is the lookup key for every session resolution.';

comment on column public.share_browser_sessions.digest_version is
  'Version of the keyed digest scheme, so the server key can be rotated without invalidating every live browser session simultaneously.';

comment on column public.share_browser_sessions.revoked_at is
  'Set when a session is deliberately invalidated. Retained rather than deleted so revocation stays auditable; every read path must treat a revoked session as unusable regardless of expires_at.';

-- Expired/revoked browser-session cleanup sweep. Lookup by session_digest
-- is already served by the unique constraint above, so no second index for
-- it is created here.
create index share_browser_sessions_expires_at_idx
  on public.share_browser_sessions (expires_at);

-- =========================================================
-- 2. public.share_session_grants
--
-- One row per (browser session, share link) pair: what this browser is
-- currently allowed to see, and under which configuration version it was
-- granted. Historical revoked grants are preserved. At most one current
-- non-revoked grant may exist for a browser session/link pair, enforced
-- by a partial unique index below rather than a permanent full-pair unique
-- constraint. Deleting a browser session cascades all of its grants;
-- deleting a share link cascades only that link's grants, in every browser
-- session, and touches no other link's grants.
-- =========================================================

create table public.share_session_grants (
  id uuid primary key default gen_random_uuid(),

  browser_session_id uuid not null
    references public.share_browser_sessions(id) on delete cascade,
  share_link_id uuid not null
    references public.project_share_links(id) on delete cascade,

  granted_configuration_version integer not null,
  pin_verified_at timestamptz null,

  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,

  constraint share_session_grants_configuration_version_check
    check (granted_configuration_version > 0),

  constraint share_session_grants_lifecycle_check
    check (
      expires_at > created_at
      and (revoked_at is null or revoked_at >= created_at)
      and (pin_verified_at is null or pin_verified_at >= created_at)
    )
);

comment on table public.share_session_grants is
  'Per-link access grants belonging to one browser session. One browser session may hold grants for many independent share links simultaneously, so opening a second shared project never invalidates access to the first, and disabling/rotating/revoking one link invalidates only that link''s grants. Historical revoked grants are preserved: share_session_grants_current_unique_idx permits at most one non-revoked grant per browser session/link while allowing a future exchange transaction to revoke a stale current grant and insert its replacement atomically. Service-role only: RLS enabled with no policies; all positive access is withheld until 202608030005 installs the integrity trigger and final grants.';

comment on column public.share_session_grants.granted_configuration_version is
  'The project_share_links.configuration_version this grant was issued against. A rotation or configuration change bumps that version, which makes every previously issued grant detectably stale WITHOUT deleting it, so the invalidation is auditable. A read path must compare this against the link''s current configuration_version, never assume it still matches.';

comment on column public.share_session_grants.pin_verified_at is
  'When the PIN for this link was successfully verified in this browser session. Null means "not verified" -- never "no PIN required"; whether a PIN is required is a property of the link, not of the grant.';

comment on column public.share_session_grants.expires_at is
  'Must not exceed the owning browser session''s own expires_at -- enforced by enforce_share_session_grant_integrity (202608030005), because a foreign key cannot express a comparison between two rows.';

comment on column public.share_session_grants.revoked_at is
  'Set when this specific link''s access is withdrawn from this browser session. Retained rather than deleted so revocation stays auditable, and can never be cleared again (enforce_share_session_grant_integrity). A revoked grant must never be treated as active by any read path.';

-- At most one CURRENT grant for this browser session/link pair, while
-- preserving revoked historical rows. A future exchange transaction must
-- lock the existing current grant for the browser session/link, mark it
-- revoked/superseded when it is stale or expired, insert the replacement
-- grant, and commit atomically. An expired-but-not-yet-revoked row still
-- occupies this partial key by design, because expiry alone is not audit
-- revocation.
create unique index share_session_grants_current_unique_idx
  on public.share_session_grants (browser_session_id, share_link_id)
  where revoked_at is null;

-- "Every grant for this link", used by disable/rotate/revoke to withdraw
-- exactly one link's access across all browser sessions, and by the
-- share_link_id FK's cascade. Partial on the live rows those operations
-- actually touch.
create index share_session_grants_share_link_id_active_idx
  on public.share_session_grants (share_link_id)
  where revoked_at is null;

-- Expired-grant cleanup sweep. Current grant lookup by
-- (browser_session_id, share_link_id) is served by the partial unique
-- index above.
create index share_session_grants_expires_at_idx
  on public.share_session_grants (expires_at);

-- =========================================================
-- 3. public.share_link_events
--
-- Content-free operational and security audit trail. Deliberately has no
-- general-purpose metadata JSONB escape hatch: there is no concrete,
-- reviewed requirement for one, and its presence would be a standing
-- invitation to record exactly the content this table exists to keep out.
-- This follows public.authenticated_product_events, which omits a metadata
-- column for the same reason.
-- =========================================================

create table public.share_link_events (
  id uuid primary key default gen_random_uuid(),

  share_link_id uuid not null
    references public.project_share_links(id) on delete cascade,

  event_type text not null,

  identity_digest text null,
  identity_digest_version smallint null,

  created_at timestamptz not null default now(),

  constraint share_link_events_event_type_check
    check (
      event_type in (
        'link_created',
        'link_activated',
        'link_viewed',
        'session_exchanged',
        'pin_failed',
        'comment_submitted',
        'owner_replied',
        'link_disabled',
        'link_rotated',
        'link_expired',
        'link_revoked',
        'shared_resource_opened',
        'rate_limit_triggered'
      )
    ),

  constraint share_link_events_identity_digest_consistency_check
    check (
      (identity_digest is null and identity_digest_version is null)
      or (
        identity_digest is not null
        and identity_digest ~ '^[0-9a-f]{64}$'
        and identity_digest_version is not null
        and identity_digest_version > 0
      )
    )
);

comment on table public.share_link_events is
  'Content-free operational and security audit events for one share link. Records THAT something happened, to WHICH link, and WHEN -- never a project title, task title, comment body, client name, file name, Resource label, share secret, PIN, public URL, signed URL, storage path, raw IP or user agent string. There is deliberately no metadata/jsonb column, so that discipline is structural rather than conventional. Append-only and service-role only: RLS enabled with no policies, nothing granted to anon or authenticated.';

comment on column public.share_link_events.event_type is
  'Closed vocabulary enforced by share_link_events_event_type_check. Adding a value is a deliberate, reviewable migration -- exactly the property that keeps content-free auditing from drifting into content logging.';

comment on column public.share_link_events.identity_digest is
  'Optional lowercase hex keyed HMAC digest of a network identity, mirroring lib/homepage-demo/identity.server.ts. A raw IP address is NEVER stored, and the digest is only ever written together with its version.';

-- Primary audit read: one link's event stream, newest first.
create index share_link_events_share_link_id_created_at_idx
  on public.share_link_events (share_link_id, created_at desc);

-- Retention purge across all links ("delete events older than N days"),
-- which the composite index above cannot serve because its leading column
-- is share_link_id.
create index share_link_events_created_at_idx
  on public.share_link_events (created_at);

-- =========================================================
-- 4. public.share_rate_limit_buckets
--
-- Database-atomic rate-limit accounting for the future public surface:
-- session exchange, PIN verification, projection reads, comment
-- submission, file access, and repeated invalid-link access. Enforcement
-- happens inside a future server operation performing an atomic upsert and
-- increment against the unique bucket key below -- never in application
-- memory, which cannot survive multiple serverless instances.
--
-- The nullable share-link portion of the bucket key, handled deliberately:
-- share_link_id must be nullable, because an invalid-link attempt by
-- definition has no link to attribute. A unique constraint over a nullable
-- column would silently permit unlimited duplicate logical buckets, since
-- SQL treats NULLs as distinct -- so every attacker request would create a
-- brand-new bucket and the limit would never trigger. That failure mode
-- would be invisible until abused. This table therefore derives a STORED
-- generated scope key, share_link_key, which is share_link_id's text form
-- or the literal '-' when there is no link, and the unique constraint uses
-- that key instead of the nullable column. `nulls not distinct` was
-- rejected in favour of the generated key because the generated key is
-- explicit, self-documenting, and does not depend on the Postgres version
-- of the target database.
-- =========================================================

create table public.share_rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),

  scope text not null,
  action text not null,

  identity_digest text not null,
  identity_digest_version smallint not null,

  share_link_id uuid null
    references public.project_share_links(id) on delete cascade,
  share_link_key text not null
    generated always as (coalesce(share_link_id::text, '-')) stored,

  window_start timestamptz not null,
  window_seconds integer not null,
  request_count integer not null default 0,
  expires_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint share_rate_limit_buckets_identity_unique
    unique (
      scope,
      action,
      identity_digest,
      share_link_key,
      window_start,
      window_seconds
    ),

  constraint share_rate_limit_buckets_scope_check
    check (scope in ('browser_session', 'network_identity', 'share_link')),

  constraint share_rate_limit_buckets_action_check
    check (
      action in (
        'session_exchange',
        'pin_verification',
        'projection_read',
        'comment_submission',
        'file_access',
        'invalid_link_access'
      )
    ),

  constraint share_rate_limit_buckets_identity_digest_check
    check (
      identity_digest ~ '^[0-9a-f]{64}$'
      and identity_digest_version > 0
    ),

  -- A share_link-scoped bucket must name its link; an invalid-link attempt
  -- must NOT, because attributing it to a link would require knowing a link
  -- the caller has not proven it may reference.
  constraint share_rate_limit_buckets_share_link_scope_check
    check (scope <> 'share_link' or share_link_id is not null),

  constraint share_rate_limit_buckets_invalid_link_action_check
    check (action <> 'invalid_link_access' or share_link_id is null),

  -- Bounded permitted window durations: one minute, five minutes, one hour,
  -- one day. An unbounded window_seconds would let a single mis-specified
  -- caller create an effectively permanent bucket.
  constraint share_rate_limit_buckets_window_seconds_check
    check (window_seconds in (60, 300, 3600, 86400)),

  constraint share_rate_limit_buckets_request_count_check
    check (request_count >= 0),

  constraint share_rate_limit_buckets_expiry_check
    check (
      expires_at >= window_start + (window_seconds * interval '1 second')
    )
);

comment on table public.share_rate_limit_buckets is
  'Database-atomic rate-limit accounting for the future anonymous Client Share surface. Service-role only: RLS enabled with no policies, nothing granted to anon or authenticated. Stores no raw IP address and no content -- identities appear only as versioned keyed digests.';

comment on column public.share_rate_limit_buckets.share_link_key is
  'STORED generated bucket-key component: share_link_id::text, or the literal ''-'' when there is no link (an invalid-link attempt). It exists solely so the unique bucket identity below can never be defeated by SQL''s NULL-is-distinct rule, which would otherwise let every invalid-link request mint a fresh bucket and silently disable the limit. Never written directly.';

comment on column public.share_rate_limit_buckets.scope is
  'Closed vocabulary: browser_session, network_identity, share_link. Combining a link-scoped bucket with an identity-scoped bucket is the intended enforcement shape, so neither alone is sufficient to pass.';

comment on column public.share_rate_limit_buckets.action is
  'Closed vocabulary: session_exchange, pin_verification, projection_read, comment_submission, file_access, invalid_link_access.';

comment on column public.share_rate_limit_buckets.identity_digest is
  'Lowercase hex keyed HMAC digest of the browser session, network identity or link-scoped identity being limited. A raw IP address is NEVER stored.';

-- Expired-bucket purge. The unique constraint above already serves the
-- atomic upsert/increment lookup, so no second index for it is created.
create index share_rate_limit_buckets_expires_at_idx
  on public.share_rate_limit_buckets (expires_at);

-- Supports the share_link_id FK's cascade when a share link row is
-- deleted; the unique constraint's index leads with scope and cannot serve
-- it.
create index share_rate_limit_buckets_share_link_id_idx
  on public.share_rate_limit_buckets (share_link_id)
  where share_link_id is not null;

-- request_count is genuinely mutable (every increment rewrites the row),
-- so this table gets the shared Client Share updated_at trigger created in
-- 202608030003. The other three tables in this migration are append-only
-- apart from explicit lifecycle timestamps and deliberately have no
-- updated_at column at all.
drop trigger if exists share_rate_limit_buckets_set_updated_at
  on public.share_rate_limit_buckets;

create trigger share_rate_limit_buckets_set_updated_at
before update on public.share_rate_limit_buckets
for each row
execute function public.set_client_share_updated_at();

-- =========================================================
-- 5. Row Level Security -- service-role-only model
--
-- RLS is enabled on all four tables and NO policy of any kind is created.
-- With the grants below that is default-deny for public, anon and
-- authenticated: an authenticated application user cannot read even a row
-- that ultimately concerns their own share link through PostgREST, and an
-- anonymous caller cannot reach these tables at all.
-- =========================================================

alter table public.share_browser_sessions enable row level security;
alter table public.share_session_grants enable row level security;
alter table public.share_link_events enable row level security;
alter table public.share_rate_limit_buckets enable row level security;

-- =========================================================
-- 6. Grants -- least privilege, service_role only
--
-- Supabase's default privileges grant broad table access to anon and
-- authenticated for every new public-schema table, so these revokes are
-- load-bearing. Nothing here is granted to anon or authenticated, and this
-- migration intentionally issues NO positive service_role table grant.
-- Positive service_role grants are issued only by 202608030005 after the
-- share_session_grants integrity trigger exists, so migration 004 can
-- commit safely on its own.
-- =========================================================

revoke all on table public.share_browser_sessions from public;
revoke all on table public.share_browser_sessions from anon;
revoke all on table public.share_browser_sessions from authenticated;
revoke all privileges
  on table public.share_browser_sessions
  from service_role;

revoke all on table public.share_session_grants from public;
revoke all on table public.share_session_grants from anon;
revoke all on table public.share_session_grants from authenticated;
revoke all privileges
  on table public.share_session_grants
  from service_role;

revoke all on table public.share_link_events from public;
revoke all on table public.share_link_events from anon;
revoke all on table public.share_link_events from authenticated;
revoke all privileges
  on table public.share_link_events
  from service_role;

revoke all on table public.share_rate_limit_buckets from public;
revoke all on table public.share_rate_limit_buckets from anon;
revoke all on table public.share_rate_limit_buckets from authenticated;
revoke all privileges
  on table public.share_rate_limit_buckets
  from service_role;
