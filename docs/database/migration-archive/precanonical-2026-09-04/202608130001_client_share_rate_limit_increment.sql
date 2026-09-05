-- Text2Task Client Share Link -- Rate-Limit Bucket Atomic Increment
-- Migration: 202608130001_client_share_rate_limit_increment.sql
-- Created: 2026-08-13
--
-- Purpose:
-- public.share_rate_limit_buckets (202608030004_client_share_session_
-- foundation.sql) was created with an explicit design assumption,
-- documented in that migration's own header, that enforcement would
-- later use "an atomic upsert and increment against the unique bucket
-- key ... never in application memory". No such atomic operation has
-- ever existed. This migration adds exactly one narrowly scoped
-- SECURITY DEFINER function, public.increment_share_rate_limit_bucket,
-- that performs that single atomic upsert-and-increment statement and
-- nothing else.
--
-- Why this cannot be done from application code (see the accompanying
-- blocker report for the full reasoning): a client-side "SELECT
-- request_count, then UPDATE to request_count + 1" is two separate
-- PostgREST round trips with no lock held between them. Concurrent
-- requests -- exactly the burst scenario rate limiting exists to survive
-- -- can both read the same count and both write count + 1, permanently
-- losing an increment and letting the true attempt count silently exceed
-- the configured limit. Only a single atomic
-- `INSERT ... ON CONFLICT ... DO UPDATE SET request_count = request_count
-- + 1` statement, which Postgres serializes via a row lock on the
-- conflicting row, is race-safe. This repository already has an
-- established precedent for exactly this shape of problem: see
-- 202606280004_homepage_demo_admission_rpc.sql's own
-- `request_count = bucket.request_count + 1` upsert pattern (for the
-- unrelated homepage-demo-admission tables) -- this migration follows
-- that same established atomic-upsert idiom for
-- public.share_rate_limit_buckets specifically.
--
-- Deliberately NOT in this migration:
--   - No rate-limit THRESHOLD/policy decision of any kind (requests per
--     minute, PIN attempts per window, lockout UX). This function returns
--     only the atomically incremented count and window metadata; the
--     caller compares that count against its own server-side limit. No
--     product threshold has been decided and none is invented here.
--   - No new table, column, index, trigger or CHECK constraint. This
--     migration adds exactly one function and its grants; every existing
--     constraint on public.share_rate_limit_buckets (scope/action
--     vocabularies, window_seconds bounds, the share_link_key generated
--     column, the identity_digest format, request_count >= 0, the
--     expires_at floor) is reused unchanged, never re-declared, never
--     weakened.
--   - No change to public.share_browser_sessions, public.share_session_
--     grants, public.share_link_events, public.project_share_links or any
--     other existing Client Share table, function, trigger or grant.
--   - No public route, no session exchange, no PIN flow, no projection
--     read. Phase 3 application implementation remains paused; this is
--     foundation-only.
--   - No `authenticated` execute grant. Unlike every existing Client
--     Share SECURITY DEFINER RPC (which are all authenticated-owner
--     operations gated on auth.uid()), this is the anonymous/public
--     surface's own operation -- callable only by trusted server code
--     already holding the service-role key, never directly by an owner's
--     browser session or by an anonymous visitor's browser. Execute is
--     granted only to service_role.
--
-- Security posture: SECURITY DEFINER (required -- service_role is
-- deliberately not given a broad, arithmetic-capable UPDATE grant on this
-- table per AGENTS.md rule 21's column-minimal posture; the atomic
-- increment expression itself can only live inside a function body
-- regardless of INVOKER/DEFINER choice, since PostgREST cannot express
-- `column = column + 1` through any grant-only configuration), explicit
-- `set search_path = public, pg_temp`, no dynamic SQL anywhere in the
-- function body, every table reference fully qualified with `public.`,
-- revoked from public/anon/authenticated/service_role and then granted
-- execute only to service_role -- the same revoke-then-grant belt-and-
-- suspenders pattern every existing Client Share RPC migration in this
-- feature already uses.
--
-- Input validation: every parameter is validated against the closed
-- vocabularies and formats public.share_rate_limit_buckets' own CHECK
-- constraints already define (202608030004) -- never a second, redeclared
-- vocabulary that could silently drift from the table's own. An
-- unsupported scope, action or window_seconds, a malformed
-- identity_digest, a share_link scope missing its link, or an
-- invalid_link_access attempt naming a link are all rejected with a
-- stable P0001 message before any write is attempted, exactly mirroring
-- share_rate_limit_buckets_scope_check /
-- share_rate_limit_buckets_action_check /
-- share_rate_limit_buckets_window_seconds_check /
-- share_rate_limit_buckets_identity_digest_check /
-- share_rate_limit_buckets_share_link_scope_check /
-- share_rate_limit_buckets_invalid_link_action_check.
--
-- window_start / expires_at: computed entirely inside this function from
-- the transaction's own `now()`, never accepted from the caller. now() is
-- used rather than clock_timestamp() or statement_timestamp() because
-- this function performs exactly one INSERT statement, so window_start
-- and expires_at must be derived from the SAME instant for internal
-- consistency, and each RPC invocation is its own independent call (its
-- own transaction), so now() (the transaction start time) already
-- reflects real wall-clock time at call time -- there is no multi-
-- statement staleness risk within this function for clock_timestamp() to
-- solve. The fixed-window floor (`floor(epoch(now()) / window_seconds) *
-- window_seconds`) is what makes concurrent calls landing in the same
-- logical window deterministically compute the identical window_start
-- and therefore collide on the same unique bucket key -- which is exactly
-- what lets the ON CONFLICT clause serialize them correctly.
--
-- Return contract: intentionally small and operational-only --
-- requestCount, windowStart, windowSeconds, expiresAt. Never returns the
-- caller's identity digest, the share link id, or the bucket's own
-- internal id, none of which the caller needs back (the caller already
-- has all three; it supplied them). No `allowed` boolean is returned:
-- no rate-limit threshold has been decided in this task, so no threshold
-- comparison belongs in this foundation. The calling application code
-- compares the returned atomic requestCount against its own server-side
-- limit.
--
-- Schema-drift posture (fail closed): no `create or replace function` is
-- used for anything except this migration's own new function (there is
-- nothing to replace -- this name has never existed before). No `if not
-- exists` of any kind appears anywhere in this migration.
--
-- Transaction posture: no explicit begin;/commit;, matching every
-- existing tracked migration -- see 202608030003_client_share_owner_
-- foundation.sql's header for the full reasoning.
--
-- Sequencing: additive only. Applies after every existing Client Share
-- migration (202608030003 through 202608110002); modifies none of them.

-- =========================================================
-- public.increment_share_rate_limit_bucket(...)
-- =========================================================

create or replace function public.increment_share_rate_limit_bucket(
  p_scope text,
  p_action text,
  p_identity_digest text,
  p_identity_digest_version smallint,
  p_share_link_id uuid,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_expires_at timestamptz;
  v_request_count integer;
begin
  -- Every check below mirrors an EXISTING CHECK constraint on
  -- public.share_rate_limit_buckets (202608030004) exactly, so this
  -- function can never accept a value the table itself would reject --
  -- it only ever fails closed earlier, with a stable, callable-specific
  -- message, before any write is attempted.

  if p_scope is null
    or p_scope not in ('browser_session', 'network_identity', 'share_link')
  then
    raise exception using errcode = 'P0001', message = 'INVALID_RATE_LIMIT_SCOPE';
  end if;

  if p_action is null
    or p_action not in (
      'session_exchange',
      'pin_verification',
      'projection_read',
      'comment_submission',
      'file_access',
      'invalid_link_access'
    )
  then
    raise exception using errcode = 'P0001', message = 'INVALID_RATE_LIMIT_ACTION';
  end if;

  if p_window_seconds is null or p_window_seconds not in (60, 300, 3600, 86400) then
    raise exception using errcode = 'P0001', message = 'INVALID_RATE_LIMIT_WINDOW';
  end if;

  if p_identity_digest is null or p_identity_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_RATE_LIMIT_IDENTITY_DIGEST';
  end if;

  if p_identity_digest_version is null or p_identity_digest_version <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_RATE_LIMIT_IDENTITY_DIGEST_VERSION';
  end if;

  -- Mirrors share_rate_limit_buckets_share_link_scope_check: a
  -- share_link-scoped bucket must name its link.
  if p_scope = 'share_link' and p_share_link_id is null then
    raise exception using errcode = 'P0001', message = 'RATE_LIMIT_SHARE_LINK_SCOPE_REQUIRES_LINK';
  end if;

  -- Mirrors share_rate_limit_buckets_invalid_link_action_check: an
  -- invalid-link attempt must never be attributed to a link -- attributing
  -- it would require knowing a link the caller has not proven it may
  -- reference.
  if p_action = 'invalid_link_access' and p_share_link_id is not null then
    raise exception using errcode = 'P0001', message = 'RATE_LIMIT_INVALID_LINK_ACTION_FORBIDS_LINK';
  end if;

  -- Deterministic fixed-window boundary, computed here only -- never
  -- accepted from the caller. See this migration's header for why now()
  -- (not clock_timestamp()/statement_timestamp()) is the correct choice
  -- for this single-statement function.
  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_expires_at := v_window_start + (p_window_seconds * interval '1 second');

  -- The one atomic statement this function exists to provide. Postgres
  -- takes a row lock on the conflicting row before applying the DO
  -- UPDATE branch, so concurrent callers targeting the same bucket
  -- (identical scope/action/identity_digest/share_link_key/window_start/
  -- window_seconds) serialize here and no increment is ever lost. Uses
  -- the table's own existing named unique constraint as the conflict
  -- target, never a re-derived column list, so this statement can never
  -- silently drift from the table's real bucket identity.
  insert into public.share_rate_limit_buckets (
    scope,
    action,
    identity_digest,
    identity_digest_version,
    share_link_id,
    window_start,
    window_seconds,
    request_count,
    expires_at
  ) values (
    p_scope,
    p_action,
    p_identity_digest,
    p_identity_digest_version,
    p_share_link_id,
    v_window_start,
    p_window_seconds,
    1,
    v_expires_at
  )
  on conflict on constraint share_rate_limit_buckets_identity_unique
  do update set
    request_count = public.share_rate_limit_buckets.request_count + 1,
    updated_at = now()
  returning public.share_rate_limit_buckets.request_count
    into v_request_count;

  -- Deliberately small: no identity digest, no share_link_id, no internal
  -- bucket id, and no `allowed` boolean -- no rate-limit threshold has
  -- been decided in this task (see this migration's header). The caller
  -- already has every input it supplied; it only needs the atomically
  -- resolved count and window metadata back.
  return jsonb_build_object(
    'requestCount', v_request_count,
    'windowStart', v_window_start,
    'windowSeconds', p_window_seconds,
    'expiresAt', v_expires_at
  );
end;
$$;

comment on function public.increment_share_rate_limit_bucket(text, text, text, smallint, uuid, integer) is
  'Atomically upserts-and-increments the public.share_rate_limit_buckets row for one (scope, action, identity_digest, share_link_key, window_start, window_seconds) bucket, in a single INSERT ... ON CONFLICT ... DO UPDATE SET request_count = request_count + 1 statement -- Postgres row-locks the conflicting row for the duration, so concurrent callers never lose an increment. SECURITY DEFINER; service_role-only (this is the anonymous/public Client Share surface''s own operation, unlike every other Client Share SECURITY DEFINER RPC, which is authenticated-owner-only). window_start/expires_at are computed here from a deterministic fixed-window floor of now(), never accepted from the caller. Every input is validated against public.share_rate_limit_buckets'' own existing CHECK-constraint vocabularies before any write. Returns only requestCount/windowStart/windowSeconds/expiresAt -- never the identity digest, the share link id, the bucket''s own id, or an `allowed` verdict (no rate-limit threshold has been decided; the caller compares requestCount against its own server-side limit).';

revoke all on function public.increment_share_rate_limit_bucket(text, text, text, smallint, uuid, integer)
  from public;
revoke all on function public.increment_share_rate_limit_bucket(text, text, text, smallint, uuid, integer)
  from anon;
revoke all on function public.increment_share_rate_limit_bucket(text, text, text, smallint, uuid, integer)
  from authenticated;
revoke all on function public.increment_share_rate_limit_bucket(text, text, text, smallint, uuid, integer)
  from service_role;
grant execute on function public.increment_share_rate_limit_bucket(text, text, text, smallint, uuid, integer)
  to service_role;
