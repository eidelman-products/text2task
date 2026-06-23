-- Text2Task Billing Checkout Attempts
-- Migration: 202606230001_billing_checkout_attempts.sql
-- Created: 2026-06-23
--
-- Private, service-role-only checkout-attempt coordination for durable Pro
-- signup-to-checkout continuation. This table stores operational attempt
-- state only. It must never store prices, product IDs, API keys,
-- entitlement state, card data, provider secrets, or raw provider errors.

create extension if not exists "pgcrypto";

create table if not exists public.billing_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent text not null,
  status text not null,
  creem_request_id text not null,
  checkout_url text null,
  lease_token uuid null,
  lease_expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  error_code text null,
  constraint billing_checkout_attempts_intent_check
    check (intent in ('upgrade_pro')),
  constraint billing_checkout_attempts_status_check
    check (
      status in (
        'creating',
        'checkout_created',
        'failed',
        'expired',
        'completed'
      )
    ),
  constraint billing_checkout_attempts_creem_request_id_unique
    unique (creem_request_id)
);

create index if not exists billing_checkout_attempts_user_intent_status_expires_idx
  on public.billing_checkout_attempts(user_id, intent, status, expires_at desc);

create index if not exists billing_checkout_attempts_expires_at_idx
  on public.billing_checkout_attempts(expires_at);

alter table public.billing_checkout_attempts enable row level security;

revoke all on table public.billing_checkout_attempts from public;
revoke all on table public.billing_checkout_attempts from anon;
revoke all on table public.billing_checkout_attempts from authenticated;

grant select, insert, update on table public.billing_checkout_attempts
  to service_role;

comment on table public.billing_checkout_attempts is
  'Private service-role-only coordination records for idempotent Pro checkout creation. Stores operational attempt state only; no prices, product IDs, card data, provider secrets, raw provider responses, or entitlement state.';

comment on column public.billing_checkout_attempts.user_id is
  'Authenticated Supabase user that owns this checkout attempt.';

comment on column public.billing_checkout_attempts.intent is
  'Fixed server-validated purchase intent. The only allowed value is upgrade_pro.';

comment on column public.billing_checkout_attempts.status is
  'Operational checkout creation status: creating, checkout_created, failed, expired, or completed.';

comment on column public.billing_checkout_attempts.creem_request_id is
  'Stable unique request identifier sent to Creem for one checkout attempt. Local idempotency does not rely on provider-side guarantees.';

comment on column public.billing_checkout_attempts.checkout_url is
  'Creem-hosted checkout URL returned after successful checkout creation.';

comment on column public.billing_checkout_attempts.lease_token is
  'Worker lease token that authorizes exactly one in-flight checkout creation finalization or failure update.';

comment on column public.billing_checkout_attempts.lease_expires_at is
  'Short lease deadline after which another server worker may reclaim the same creating attempt while preserving its Creem request id.';

comment on column public.billing_checkout_attempts.expires_at is
  'Attempt expiration deadline. Expired attempts are not reused for checkout redirects.';

comment on column public.billing_checkout_attempts.error_code is
  'Bounded safe internal error code only. Never store provider response bodies, secrets, or raw error payloads.';

create or replace function public.claim_billing_checkout_attempt(
  p_user_id uuid,
  p_intent text,
  p_ttl_seconds integer default 1800,
  p_lease_seconds integer default 120
)
returns table (
  attempt_id uuid,
  creem_request_id text,
  checkout_url text,
  status text,
  lease_token uuid,
  should_create_checkout boolean,
  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_attempt public.billing_checkout_attempts%rowtype;
  v_lease_token uuid;
begin
  if p_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_USER_ID';
  end if;

  if p_intent is null or p_intent <> 'upgrade_pro' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_BILLING_INTENT';
  end if;

  if p_ttl_seconds is null
    or p_ttl_seconds < 60
    or p_ttl_seconds > 3600 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CHECKOUT_ATTEMPT_TTL';
  end if;

  if p_lease_seconds is null
    or p_lease_seconds < 15
    or p_lease_seconds > 600
    or p_lease_seconds > p_ttl_seconds then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CHECKOUT_ATTEMPT_LEASE';
  end if;

  -- Serialize checkout-attempt claiming per user and intent so two callback,
  -- refresh, or duplicate-tab requests cannot both receive permission to
  -- create a provider checkout.
  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_intent, 0)
  );

  update public.billing_checkout_attempts as attempt
  set
    status = 'expired',
    updated_at = v_now,
    lease_token = null,
    lease_expires_at = null
  where attempt.user_id = p_user_id
    and attempt.intent = p_intent
    and attempt.status in ('creating', 'checkout_created')
    and attempt.expires_at <= v_now;

  select attempt.*
  into v_attempt
  from public.billing_checkout_attempts as attempt
  where attempt.user_id = p_user_id
    and attempt.intent = p_intent
    and attempt.status = 'checkout_created'
    and nullif(btrim(attempt.checkout_url), '') is not null
    and attempt.expires_at > v_now
  order by attempt.created_at desc, attempt.id desc
  limit 1;

  if found then
    return query
      select
        v_attempt.id,
        v_attempt.creem_request_id,
        v_attempt.checkout_url,
        v_attempt.status,
        null::uuid,
        false,
        v_attempt.expires_at;
    return;
  end if;

  select attempt.*
  into v_attempt
  from public.billing_checkout_attempts as attempt
  where attempt.user_id = p_user_id
    and attempt.intent = p_intent
    and attempt.status = 'creating'
    and attempt.expires_at > v_now
    and attempt.lease_token is not null
    and attempt.lease_expires_at > v_now
  order by attempt.updated_at desc, attempt.id desc
  limit 1;

  if found then
    return query
      select
        v_attempt.id,
        v_attempt.creem_request_id,
        v_attempt.checkout_url,
        v_attempt.status,
        v_attempt.lease_token,
        false,
        v_attempt.expires_at;
    return;
  end if;

  select attempt.*
  into v_attempt
  from public.billing_checkout_attempts as attempt
  where attempt.user_id = p_user_id
    and attempt.intent = p_intent
    and attempt.status = 'creating'
    and attempt.expires_at > v_now
    and (
      attempt.lease_token is null
      or attempt.lease_expires_at is null
      or attempt.lease_expires_at <= v_now
    )
  order by attempt.created_at asc, attempt.id asc
  limit 1
  for update of attempt;

  if found then
    v_lease_token := gen_random_uuid();

    update public.billing_checkout_attempts as attempt
    set
      lease_token = v_lease_token,
      lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
      updated_at = v_now
    where attempt.id = v_attempt.id
    returning attempt.* into v_attempt;

    return query
      select
        v_attempt.id,
        v_attempt.creem_request_id,
        v_attempt.checkout_url,
        v_attempt.status,
        v_attempt.lease_token,
        true,
        v_attempt.expires_at;
    return;
  end if;

  v_lease_token := gen_random_uuid();

  insert into public.billing_checkout_attempts (
    user_id,
    intent,
    status,
    creem_request_id,
    lease_token,
    lease_expires_at,
    expires_at
  )
  values (
    p_user_id,
    p_intent,
    'creating',
    'billing-' || gen_random_uuid()::text,
    v_lease_token,
    v_now + make_interval(secs => p_lease_seconds),
    v_now + make_interval(secs => p_ttl_seconds)
  )
  returning * into v_attempt;

  return query
    select
      v_attempt.id,
      v_attempt.creem_request_id,
      v_attempt.checkout_url,
      v_attempt.status,
      v_attempt.lease_token,
      true,
      v_attempt.expires_at;
end;
$$;

revoke all on function public.claim_billing_checkout_attempt(uuid, text, integer, integer)
  from public;
revoke all on function public.claim_billing_checkout_attempt(uuid, text, integer, integer)
  from anon;
revoke all on function public.claim_billing_checkout_attempt(uuid, text, integer, integer)
  from authenticated;

grant execute on function public.claim_billing_checkout_attempt(uuid, text, integer, integer)
  to service_role;

comment on function public.claim_billing_checkout_attempt(uuid, text, integer, integer) is
  'Service-role-only atomic claim for a Pro checkout attempt. Serializes per user and intent, reuses unexpired checkout URLs, respects valid leases, reclaims expired leases with the same Creem request id, or creates one new leased attempt.';

create or replace function public.complete_billing_checkout_creation(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_checkout_url text
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_checkout_url text := btrim(coalesce(p_checkout_url, ''));
  v_updated_id uuid;
begin
  if p_attempt_id is null or p_lease_token is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CHECKOUT_ATTEMPT_LEASE';
  end if;

  if v_checkout_url !~* '^https://[^[:space:]]+$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CHECKOUT_URL';
  end if;

  update public.billing_checkout_attempts as attempt
  set
    status = 'checkout_created',
    checkout_url = v_checkout_url,
    updated_at = now(),
    lease_token = null,
    lease_expires_at = null
  where attempt.id = p_attempt_id
    and attempt.status = 'creating'
    and attempt.lease_token = p_lease_token
    and attempt.lease_expires_at > now()
    and attempt.expires_at > now()
  returning attempt.id into v_updated_id;

  return v_updated_id is not null;
end;
$$;

revoke all on function public.complete_billing_checkout_creation(uuid, uuid, text)
  from public;
revoke all on function public.complete_billing_checkout_creation(uuid, uuid, text)
  from anon;
revoke all on function public.complete_billing_checkout_creation(uuid, uuid, text)
  from authenticated;

grant execute on function public.complete_billing_checkout_creation(uuid, uuid, text)
  to service_role;

comment on function public.complete_billing_checkout_creation(uuid, uuid, text) is
  'Service-role-only finalization for a leased checkout creation attempt. Only the current valid lease may store a non-empty HTTPS checkout URL.';

create or replace function public.fail_billing_checkout_creation(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_error_code text;
  v_updated_id uuid;
begin
  if p_attempt_id is null or p_lease_token is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CHECKOUT_ATTEMPT_LEASE';
  end if;

  v_error_code := left(
    regexp_replace(
      lower(btrim(coalesce(p_error_code, 'checkout_creation_failed'))),
      '[^a-z0-9_:-]',
      '_',
      'g'
    ),
    80
  );

  if nullif(v_error_code, '') is null then
    v_error_code := 'checkout_creation_failed';
  end if;

  update public.billing_checkout_attempts as attempt
  set
    status = 'failed',
    error_code = v_error_code,
    failed_at = now(),
    updated_at = now(),
    lease_token = null,
    lease_expires_at = null
  where attempt.id = p_attempt_id
    and attempt.status = 'creating'
    and attempt.lease_token = p_lease_token
    and attempt.lease_expires_at > now()
    and attempt.expires_at > now()
  returning attempt.id into v_updated_id;

  return v_updated_id is not null;
end;
$$;

revoke all on function public.fail_billing_checkout_creation(uuid, uuid, text)
  from public;
revoke all on function public.fail_billing_checkout_creation(uuid, uuid, text)
  from anon;
revoke all on function public.fail_billing_checkout_creation(uuid, uuid, text)
  from authenticated;

grant execute on function public.fail_billing_checkout_creation(uuid, uuid, text)
  to service_role;

comment on function public.fail_billing_checkout_creation(uuid, uuid, text) is
  'Service-role-only failure marker for a leased checkout creation attempt. Stores only a bounded safe internal error code and never provider payloads or secrets.';
