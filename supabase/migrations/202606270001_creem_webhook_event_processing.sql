-- Text2Task Creem Webhook Event Processing
-- Migration: 202606270001_creem_webhook_event_processing.sql
-- Created: 2026-06-27
--
-- Durable, service-role-only Creem webhook ledger and entitlement processor.
-- Stores bounded normalized operational fields only. It never stores raw
-- webhook payloads, signatures, secrets, email addresses, card data, or full
-- metadata objects.

create extension if not exists "pgcrypto";

alter table if exists public.users
  add column if not exists billing_last_state_updated_at timestamptz,
  add column if not exists billing_last_event_created_at timestamptz,
  add column if not exists billing_last_event_id text,
  add column if not exists billing_last_event_type text,
  add column if not exists billing_last_action text;

-- Apply only after running the duplicate preflight queries supplied with this
-- migration. The indexes intentionally fail closed if existing production data
-- already maps one Creem identifier to more than one Text2Task user.
create unique index if not exists users_creem_subscription_id_unique_idx
  on public.users (btrim(creem_subscription_id))
  where creem_subscription_id is not null
    and btrim(creem_subscription_id) <> '';

create unique index if not exists users_creem_customer_id_unique_idx
  on public.users (btrim(creem_customer_id))
  where creem_customer_id is not null
    and btrim(creem_customer_id) <> '';

create table if not exists public.creem_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null,
  event_type text not null,
  webhook_action text not null,
  provider_event_created_at timestamptz not null,
  provider_state_updated_at timestamptz not null,
  object_id text null,
  checkout_id text null,
  creem_request_id text null,
  subscription_id text null,
  customer_id text null,
  product_id text null,
  environment text null,
  internal_user_id_candidate uuid null,
  normalized_subscription_status text null,
  cancel_at_period_end boolean null,
  current_period_start_at timestamptz null,
  current_period_end_at timestamptz null,
  refund_amount numeric null,
  amount_paid numeric null,
  refunded_amount numeric null,
  refund_currency text null,
  transaction_currency text null,
  resolved_user_id uuid null references auth.users(id) on delete set null,
  processing_status text not null default 'received',
  reason_code text not null,
  attempt_count integer not null default 1,
  received_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  processed_at timestamptz null,
  review_decision text null,
  reviewed_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint creem_webhook_events_provider_event_id_unique
    unique (provider_event_id),
  constraint creem_webhook_events_processing_status_check
    check (
      processing_status in (
        'received',
        'processing',
        'processed',
        'ignored',
        'stale',
        'duplicate',
        'pending_unmatched',
        'pending_conflict',
        'pending_review',
        'failed_retryable'
      )
    ),
  constraint creem_webhook_events_action_check
    check (
      webhook_action in (
        'ignore',
        'sync_checkout',
        'sync_subscription',
        'grant_pro',
        'trial_pro',
        'past_due',
        'scheduled_cancel',
        'downgrade_free',
        'refund_downgrade',
        'dispute_downgrade',
        'pending_review'
      )
    ),
  constraint creem_webhook_events_review_decision_check
    check (
      review_decision is null
      or review_decision in ('keep_access', 'revoke_access', 'close_no_action')
    ),
  constraint creem_webhook_events_attempt_count_check
    check (attempt_count > 0),
  constraint creem_webhook_events_refund_amount_check
    check (refund_amount is null or refund_amount >= 0),
  constraint creem_webhook_events_amount_paid_check
    check (amount_paid is null or amount_paid >= 0),
  constraint creem_webhook_events_refunded_amount_check
    check (refunded_amount is null or refunded_amount >= 0)
);

create index if not exists creem_webhook_events_status_received_idx
  on public.creem_webhook_events(processing_status, received_at desc);

create index if not exists creem_webhook_events_subscription_id_idx
  on public.creem_webhook_events(subscription_id)
  where subscription_id is not null;

create index if not exists creem_webhook_events_customer_id_idx
  on public.creem_webhook_events(customer_id)
  where customer_id is not null;

create index if not exists creem_webhook_events_creem_request_id_idx
  on public.creem_webhook_events(creem_request_id)
  where creem_request_id is not null;

alter table public.creem_webhook_events enable row level security;

revoke all on table public.creem_webhook_events from public;
revoke all on table public.creem_webhook_events from anon;
revoke all on table public.creem_webhook_events from authenticated;

grant select, insert, update on table public.creem_webhook_events
  to service_role;

comment on table public.creem_webhook_events is
  'Private service-role-only Creem webhook ledger. Stores bounded normalized fields for idempotency, ordering, retries, reconciliation, and manual refund review; never raw payloads, secrets, signatures, email, card data, or full metadata.';

comment on column public.creem_webhook_events.provider_event_id is
  'Unique Creem webhook event id from the signed top-level event envelope.';

comment on column public.creem_webhook_events.provider_event_created_at is
  'Top-level provider event creation timestamp.';

comment on column public.creem_webhook_events.provider_state_updated_at is
  'State-effective timestamp used for entitlement ordering, preferring object.updated_at for lifecycle events.';

comment on column public.creem_webhook_events.internal_user_id_candidate is
  'Strictly validated UUID from Text2Task-owned metadata.user_id only. It remains a candidate and is checked against every other trusted identifier.';

create or replace function public.process_creem_webhook_event(
  p_provider_event_id text,
  p_event_type text,
  p_provider_event_created_at timestamptz,
  p_provider_state_updated_at timestamptz,
  p_object_id text,
  p_checkout_id text,
  p_subscription_id text,
  p_customer_id text,
  p_product_id text,
  p_environment text,
  p_creem_request_id text,
  p_internal_user_id_candidate uuid,
  p_action text,
  p_subscription_status text,
  p_cancel_at_period_end boolean,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_refund_amount numeric,
  p_amount_paid numeric,
  p_refunded_amount numeric,
  p_refund_currency text,
  p_transaction_currency text,
  p_reason_code text
)
returns table (
  result_processing_status text,
  result_reason_code text,
  result_resolved_user_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_event public.creem_webhook_events%rowtype;
  v_previous_event public.creem_webhook_events%rowtype;
  v_user public.users%rowtype;
  v_provider_event_id text := left(nullif(btrim(coalesce(p_provider_event_id, '')), ''), 180);
  v_event_type text := left(nullif(btrim(coalesce(p_event_type, '')), ''), 120);
  v_action text := left(nullif(btrim(coalesce(p_action, '')), ''), 80);
  v_reason_code text := left(
    nullif(btrim(coalesce(p_reason_code, 'creem_webhook_processed')), ''),
    120
  );
  v_object_id text := left(nullif(btrim(coalesce(p_object_id, '')), ''), 240);
  v_checkout_id text := left(nullif(btrim(coalesce(p_checkout_id, '')), ''), 240);
  v_subscription_id text := left(nullif(btrim(coalesce(p_subscription_id, '')), ''), 240);
  v_customer_id text := left(nullif(btrim(coalesce(p_customer_id, '')), ''), 240);
  v_product_id text := left(nullif(btrim(coalesce(p_product_id, '')), ''), 240);
  v_environment text := left(nullif(btrim(coalesce(p_environment, '')), ''), 80);
  v_creem_request_id text := left(nullif(btrim(coalesce(p_creem_request_id, '')), ''), 240);
  v_subscription_status text := left(nullif(btrim(coalesce(p_subscription_status, '')), ''), 120);
  v_refund_currency text := upper(left(nullif(btrim(coalesce(p_refund_currency, '')), ''), 12));
  v_transaction_currency text := upper(left(nullif(btrim(coalesce(p_transaction_currency, '')), ''), 12));
  v_provider_event_created_at timestamptz := p_provider_event_created_at;
  v_provider_state_updated_at timestamptz := coalesce(
    p_provider_state_updated_at,
    p_provider_event_created_at
  );
  v_cancel_at_period_end boolean := p_cancel_at_period_end;
  v_current_period_start timestamptz := p_current_period_start;
  v_current_period_end timestamptz := p_current_period_end;
  v_refund_amount numeric := p_refund_amount;
  v_amount_paid numeric := p_amount_paid;
  v_refunded_amount numeric := p_refunded_amount;
  v_internal_user_id_candidate uuid := p_internal_user_id_candidate;
  v_candidate_user_id uuid;
  v_resolved_user_id uuid;
  v_match_count bigint;
  v_has_conflict boolean := false;
  v_is_state_action boolean := false;
  v_is_terminal_action boolean := false;
  v_subscription_mismatch boolean := false;
  v_customer_mismatch boolean := false;
  v_same_effect boolean := false;
begin
  if v_provider_event_id is null
    or v_event_type is null
    or v_action is null
    or v_reason_code is null
    or v_provider_event_created_at is null
    or v_provider_state_updated_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CREEM_WEBHOOK_EVENT';
  end if;

  if v_action not in (
    'ignore',
    'sync_checkout',
    'sync_subscription',
    'grant_pro',
    'trial_pro',
    'past_due',
    'scheduled_cancel',
    'downgrade_free',
    'refund_downgrade',
    'dispute_downgrade',
    'pending_review'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CREEM_WEBHOOK_ACTION';
  end if;

  if v_refund_amount is not null and v_refund_amount < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_CREEM_REFUND_AMOUNT';
  end if;

  if v_amount_paid is not null and v_amount_paid < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_CREEM_AMOUNT_PAID';
  end if;

  if v_refunded_amount is not null and v_refunded_amount < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_CREEM_REFUNDED_AMOUNT';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_provider_event_id, 0));

  select event_row.*
  into v_event
  from public.creem_webhook_events as event_row
  where event_row.provider_event_id = v_provider_event_id
  for update of event_row;

  if found then
    update public.creem_webhook_events as event_row
    set
      attempt_count = event_row.attempt_count + 1,
      last_attempt_at = v_now,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    if v_event.processing_status in (
      'processed',
      'ignored',
      'stale',
      'duplicate'
    ) then
      result_processing_status := 'duplicate';
      result_reason_code := 'creem_webhook_duplicate';
      result_resolved_user_id := v_event.resolved_user_id;
      return next;
      return;
    end if;

    -- Once a manual review decision exists, only the dedicated review RPC may
    -- re-evaluate it. Generic provider redelivery/reprocessing cannot erase or
    -- bypass an operator decision.
    if v_event.review_decision is not null then
      result_processing_status := v_event.processing_status;
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := v_event.resolved_user_id;
      return next;
      return;
    end if;

    -- Pending/retryable rows are reprocessed from their original normalized
    -- ledger values. A redelivery cannot replace trusted normalized data.
    v_event_type := v_event.event_type;
    v_action := v_event.webhook_action;
    v_reason_code := v_event.reason_code;
    v_object_id := v_event.object_id;
    v_checkout_id := v_event.checkout_id;
    v_subscription_id := v_event.subscription_id;
    v_customer_id := v_event.customer_id;
    v_product_id := v_event.product_id;
    v_environment := v_event.environment;
    v_creem_request_id := v_event.creem_request_id;
    v_internal_user_id_candidate := v_event.internal_user_id_candidate;
    v_subscription_status := v_event.normalized_subscription_status;
    v_cancel_at_period_end := v_event.cancel_at_period_end;
    v_current_period_start := v_event.current_period_start_at;
    v_current_period_end := v_event.current_period_end_at;
    v_refund_amount := v_event.refund_amount;
    v_amount_paid := v_event.amount_paid;
    v_refunded_amount := v_event.refunded_amount;
    v_refund_currency := v_event.refund_currency;
    v_transaction_currency := v_event.transaction_currency;
    v_provider_event_created_at := v_event.provider_event_created_at;
    v_provider_state_updated_at := v_event.provider_state_updated_at;
  else
    insert into public.creem_webhook_events (
      provider_event_id,
      event_type,
      webhook_action,
      provider_event_created_at,
      provider_state_updated_at,
      object_id,
      checkout_id,
      creem_request_id,
      subscription_id,
      customer_id,
      product_id,
      environment,
      internal_user_id_candidate,
      normalized_subscription_status,
      cancel_at_period_end,
      current_period_start_at,
      current_period_end_at,
      refund_amount,
      amount_paid,
      refunded_amount,
      refund_currency,
      transaction_currency,
      processing_status,
      reason_code,
      received_at,
      last_attempt_at,
      updated_at
    )
    values (
      v_provider_event_id,
      v_event_type,
      v_action,
      v_provider_event_created_at,
      v_provider_state_updated_at,
      v_object_id,
      v_checkout_id,
      v_creem_request_id,
      v_subscription_id,
      v_customer_id,
      v_product_id,
      v_environment,
      v_internal_user_id_candidate,
      v_subscription_status,
      v_cancel_at_period_end,
      v_current_period_start,
      v_current_period_end,
      v_refund_amount,
      v_amount_paid,
      v_refunded_amount,
      v_refund_currency,
      v_transaction_currency,
      'received',
      v_reason_code,
      v_now,
      v_now,
      v_now
    )
    returning * into v_event;
  end if;

  update public.creem_webhook_events as event_row
  set
    processing_status = 'processing',
    last_attempt_at = v_now,
    updated_at = v_now
  where event_row.id = v_event.id
  returning event_row.* into v_event;

  if v_action = 'ignore' then
    update public.creem_webhook_events as event_row
    set
      processing_status = 'ignored',
      reason_code = v_reason_code,
      processed_at = v_now,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := 'ignored';
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := null;
    return next;
    return;
  end if;

  -- Event-specific trusted-user resolution. Every trusted identifier that is
  -- present acts as a consistency check. Any disagreement fails closed.
  if v_action = 'sync_checkout' then
    if v_creem_request_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.billing_checkout_attempts as attempt
        join public.users as user_profile
          on user_profile.id = attempt.user_id
        where attempt.creem_request_id = v_creem_request_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        v_resolved_user_id := v_candidate_user_id;
      end if;
    end if;

    if v_internal_user_id_candidate is not null then
      select user_profile.id
      into v_candidate_user_id
      from public.users as user_profile
      where user_profile.id = v_internal_user_id_candidate;

      if found then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;

    if v_subscription_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.users as user_profile
        where nullif(btrim(user_profile.creem_subscription_id), '') = v_subscription_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;

    if v_customer_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.users as user_profile
        where nullif(btrim(user_profile.creem_customer_id), '') = v_customer_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;
  elsif v_action in (
    'sync_subscription',
    'grant_pro',
    'trial_pro',
    'past_due',
    'scheduled_cancel',
    'downgrade_free'
  ) then
    if v_subscription_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.users as user_profile
        where nullif(btrim(user_profile.creem_subscription_id), '') = v_subscription_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        v_resolved_user_id := v_candidate_user_id;
      end if;
    end if;

    if v_internal_user_id_candidate is not null then
      select user_profile.id
      into v_candidate_user_id
      from public.users as user_profile
      where user_profile.id = v_internal_user_id_candidate;

      if found then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;

    if v_customer_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.users as user_profile
        where nullif(btrim(user_profile.creem_customer_id), '') = v_customer_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;

    if v_creem_request_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.billing_checkout_attempts as attempt
        join public.users as user_profile
          on user_profile.id = attempt.user_id
        where attempt.creem_request_id = v_creem_request_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;
  elsif v_action in (
    'refund_downgrade',
    'dispute_downgrade',
    'pending_review'
  ) then
    if v_subscription_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.users as user_profile
        where nullif(btrim(user_profile.creem_subscription_id), '') = v_subscription_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        v_resolved_user_id := v_candidate_user_id;
      end if;
    end if;

    if v_creem_request_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.billing_checkout_attempts as attempt
        join public.users as user_profile
          on user_profile.id = attempt.user_id
        where attempt.creem_request_id = v_creem_request_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;

    if v_internal_user_id_candidate is not null then
      select user_profile.id
      into v_candidate_user_id
      from public.users as user_profile
      where user_profile.id = v_internal_user_id_candidate;

      if found then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;

    if v_customer_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.users as user_profile
        where nullif(btrim(user_profile.creem_customer_id), '') = v_customer_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;
  end if;

  if v_has_conflict then
    update public.creem_webhook_events as event_row
    set
      processing_status = 'pending_conflict',
      reason_code = 'creem_webhook_pending_conflict',
      resolved_user_id = null,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := 'pending_conflict';
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := null;
    return next;
    return;
  end if;

  if v_resolved_user_id is null then
    if v_action = 'sync_checkout' then
      update public.creem_webhook_events as event_row
      set
        processing_status = 'ignored',
        reason_code = 'creem_webhook_ignored_unmatched_checkout',
        resolved_user_id = null,
        processed_at = v_now,
        updated_at = v_now
      where event_row.id = v_event.id
      returning event_row.* into v_event;

      result_processing_status := 'ignored';
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := null;
      return next;
      return;
    end if;

    update public.creem_webhook_events as event_row
    set
      processing_status = 'pending_unmatched',
      reason_code = 'creem_webhook_unmatched_user',
      resolved_user_id = null,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := 'pending_unmatched';
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := null;
    return next;
    return;
  end if;

  select user_profile.*
  into v_user
  from public.users as user_profile
  where user_profile.id = v_resolved_user_id
  for update of user_profile;

  if not found then
    if v_action = 'sync_checkout' then
      update public.creem_webhook_events as event_row
      set
        processing_status = 'ignored',
        reason_code = 'creem_webhook_ignored_unmatched_checkout',
        resolved_user_id = null,
        processed_at = v_now,
        updated_at = v_now
      where event_row.id = v_event.id
      returning event_row.* into v_event;

      result_processing_status := 'ignored';
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := null;
      return next;
      return;
    end if;

    update public.creem_webhook_events as event_row
    set
      processing_status = 'pending_unmatched',
      reason_code = 'creem_webhook_unmatched_user',
      resolved_user_id = null,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := 'pending_unmatched';
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := null;
    return next;
    return;
  end if;

  if v_action = 'pending_review' then
    update public.creem_webhook_events as event_row
    set
      processing_status = 'pending_review',
      reason_code = 'creem_webhook_pending_review',
      resolved_user_id = v_resolved_user_id,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := 'pending_review';
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := v_resolved_user_id;
    return next;
    return;
  end if;

  v_is_state_action := v_action <> 'sync_checkout';
  v_is_terminal_action := v_action in (
    'downgrade_free',
    'refund_downgrade',
    'dispute_downgrade'
  );

  if v_is_state_action
    and v_user.billing_last_state_updated_at is not null
    and v_user.billing_last_event_created_at is not null then
    if v_user.billing_last_state_updated_at > v_provider_state_updated_at
      or (
        v_user.billing_last_state_updated_at = v_provider_state_updated_at
        and v_user.billing_last_event_created_at > v_provider_event_created_at
      ) then
      update public.creem_webhook_events as event_row
      set
        processing_status = 'stale',
        reason_code = 'creem_webhook_stale',
        resolved_user_id = v_resolved_user_id,
        processed_at = v_now,
        updated_at = v_now
      where event_row.id = v_event.id
      returning event_row.* into v_event;

      result_processing_status := 'stale';
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := v_resolved_user_id;
      return next;
      return;
    end if;

    if v_user.billing_last_state_updated_at = v_provider_state_updated_at
      and v_user.billing_last_event_created_at = v_provider_event_created_at
      and nullif(btrim(coalesce(v_user.billing_last_event_id, '')), '') is not null
      and v_user.billing_last_event_id <> v_provider_event_id then
      select previous_event.*
      into v_previous_event
      from public.creem_webhook_events as previous_event
      where previous_event.provider_event_id = v_user.billing_last_event_id;

      if found then
        v_same_effect :=
          v_previous_event.webhook_action = v_action
          and v_previous_event.normalized_subscription_status
            is not distinct from v_subscription_status
          and v_previous_event.cancel_at_period_end
            is not distinct from v_cancel_at_period_end
          and v_previous_event.current_period_end_at
            is not distinct from v_current_period_end
          and v_previous_event.subscription_id
            is not distinct from v_subscription_id
          and v_previous_event.customer_id
            is not distinct from v_customer_id;
      else
        v_same_effect := false;
      end if;

      if v_same_effect then
        update public.creem_webhook_events as event_row
        set
          processing_status = 'duplicate',
          reason_code = 'creem_webhook_duplicate',
          resolved_user_id = v_resolved_user_id,
          processed_at = v_now,
          updated_at = v_now
        where event_row.id = v_event.id
        returning event_row.* into v_event;

        result_processing_status := 'duplicate';
        result_reason_code := v_event.reason_code;
        result_resolved_user_id := v_resolved_user_id;
        return next;
        return;
      end if;

      update public.creem_webhook_events as event_row
      set
        processing_status = 'pending_conflict',
        reason_code = 'creem_webhook_equal_timestamp_conflict',
        resolved_user_id = v_resolved_user_id,
        updated_at = v_now
      where event_row.id = v_event.id
      returning event_row.* into v_event;

      result_processing_status := 'pending_conflict';
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := v_resolved_user_id;
      return next;
      return;
    end if;
  end if;

  v_customer_mismatch :=
    v_customer_id is not null
    and nullif(btrim(coalesce(v_user.creem_customer_id, '')), '') is not null
    and btrim(v_user.creem_customer_id) <> v_customer_id;

  v_subscription_mismatch :=
    v_subscription_id is not null
    and nullif(btrim(coalesce(v_user.creem_subscription_id, '')), '') is not null
    and btrim(v_user.creem_subscription_id) <> v_subscription_id;

  -- Customer identity is never silently replaced. A subscription id may be
  -- replaced only by a strictly ordered, non-terminal subscription lifecycle
  -- event. Unordered checkout and terminal/refund/dispute events fail closed.
  if v_customer_mismatch
    or (
      v_subscription_mismatch
      and (
        v_action = 'sync_checkout'
        or v_is_terminal_action
      )
    ) then
    update public.creem_webhook_events as event_row
    set
      processing_status = 'pending_conflict',
      reason_code = 'creem_webhook_provider_id_conflict',
      resolved_user_id = v_resolved_user_id,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := 'pending_conflict';
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := v_resolved_user_id;
    return next;
    return;
  end if;

  if v_action = 'sync_checkout' then
    update public.users as user_profile
    set
      creem_customer_id = case
        when nullif(btrim(coalesce(user_profile.creem_customer_id, '')), '') is null
          then coalesce(v_customer_id, user_profile.creem_customer_id)
        else user_profile.creem_customer_id
      end,
      creem_subscription_id = case
        when nullif(btrim(coalesce(user_profile.creem_subscription_id, '')), '') is null
          then coalesce(v_subscription_id, user_profile.creem_subscription_id)
        else user_profile.creem_subscription_id
      end,
      billing_updated_at = v_now
    where user_profile.id = v_resolved_user_id;

    if v_creem_request_id is not null then
      update public.billing_checkout_attempts as attempt
      set
        status = 'completed',
        completed_at = coalesce(attempt.completed_at, v_now),
        updated_at = v_now,
        lease_token = null,
        lease_expires_at = null
      where attempt.creem_request_id = v_creem_request_id
        and attempt.user_id = v_resolved_user_id
        and attempt.status in ('creating', 'checkout_created');
    end if;
  elsif v_action = 'sync_subscription' then
    update public.users as user_profile
    set
      creem_customer_id = coalesce(v_customer_id, user_profile.creem_customer_id),
      creem_subscription_id = coalesce(v_subscription_id, user_profile.creem_subscription_id),
      subscription_status = case
        when user_profile.plan = 'pro' then
          coalesce(v_subscription_status, user_profile.subscription_status)
        when lower(coalesce(v_subscription_status, '')) = 'active' then
          'active_sync_only'
        else
          coalesce(v_subscription_status, user_profile.subscription_status)
      end,
      cancel_at_period_end = case
        when lower(coalesce(v_subscription_status, '')) = 'active' then false
        else coalesce(v_cancel_at_period_end, user_profile.cancel_at_period_end)
      end,
      pro_current_period_end = coalesce(v_current_period_end, user_profile.pro_current_period_end),
      billing_updated_at = v_now,
      billing_last_state_updated_at = v_provider_state_updated_at,
      billing_last_event_created_at = v_provider_event_created_at,
      billing_last_event_id = v_provider_event_id,
      billing_last_event_type = v_event_type,
      billing_last_action = v_action
    where user_profile.id = v_resolved_user_id;
  elsif v_action in ('grant_pro', 'trial_pro') then
    update public.users as user_profile
    set
      plan = 'pro',
      creem_customer_id = coalesce(v_customer_id, user_profile.creem_customer_id),
      creem_subscription_id = coalesce(v_subscription_id, user_profile.creem_subscription_id),
      subscription_status = coalesce(
        v_subscription_status,
        case when v_action = 'trial_pro' then 'trialing' else 'paid' end
      ),
      cancel_at_period_end = false,
      pro_started_at = coalesce(user_profile.pro_started_at, v_now),
      pro_current_period_end = coalesce(v_current_period_end, user_profile.pro_current_period_end),
      billing_updated_at = v_now,
      billing_last_state_updated_at = v_provider_state_updated_at,
      billing_last_event_created_at = v_provider_event_created_at,
      billing_last_event_id = v_provider_event_id,
      billing_last_event_type = v_event_type,
      billing_last_action = v_action
    where user_profile.id = v_resolved_user_id;
  elsif v_action = 'past_due' then
    update public.users as user_profile
    set
      creem_customer_id = coalesce(v_customer_id, user_profile.creem_customer_id),
      creem_subscription_id = coalesce(v_subscription_id, user_profile.creem_subscription_id),
      subscription_status = coalesce(v_subscription_status, 'past_due'),
      cancel_at_period_end = coalesce(v_cancel_at_period_end, user_profile.cancel_at_period_end),
      pro_current_period_end = coalesce(user_profile.pro_current_period_end, v_current_period_end),
      billing_updated_at = v_now,
      billing_last_state_updated_at = v_provider_state_updated_at,
      billing_last_event_created_at = v_provider_event_created_at,
      billing_last_event_id = v_provider_event_id,
      billing_last_event_type = v_event_type,
      billing_last_action = v_action
    where user_profile.id = v_resolved_user_id;
  elsif v_action = 'scheduled_cancel' then
    update public.users as user_profile
    set
      creem_customer_id = coalesce(v_customer_id, user_profile.creem_customer_id),
      creem_subscription_id = coalesce(v_subscription_id, user_profile.creem_subscription_id),
      subscription_status = 'scheduled_cancel',
      cancel_at_period_end = true,
      pro_current_period_end = coalesce(v_current_period_end, user_profile.pro_current_period_end),
      billing_updated_at = v_now,
      billing_last_state_updated_at = v_provider_state_updated_at,
      billing_last_event_created_at = v_provider_event_created_at,
      billing_last_event_id = v_provider_event_id,
      billing_last_event_type = v_event_type,
      billing_last_action = v_action
    where user_profile.id = v_resolved_user_id;
  elsif v_action in (
    'downgrade_free',
    'refund_downgrade',
    'dispute_downgrade'
  ) then
    update public.users as user_profile
    set
      plan = 'free',
      creem_customer_id = coalesce(v_customer_id, user_profile.creem_customer_id),
      creem_subscription_id = coalesce(v_subscription_id, user_profile.creem_subscription_id),
      subscription_status = coalesce(
        v_subscription_status,
        case
          when v_action = 'refund_downgrade' then 'refunded'
          when v_action = 'dispute_downgrade' then 'disputed'
          else 'canceled'
        end
      ),
      cancel_at_period_end = false,
      pro_current_period_end = coalesce(v_current_period_end, user_profile.pro_current_period_end),
      billing_updated_at = v_now,
      billing_last_state_updated_at = v_provider_state_updated_at,
      billing_last_event_created_at = v_provider_event_created_at,
      billing_last_event_id = v_provider_event_id,
      billing_last_event_type = v_event_type,
      billing_last_action = v_action
    where user_profile.id = v_resolved_user_id;
  end if;

  update public.creem_webhook_events as event_row
  set
    processing_status = 'processed',
    reason_code = case
      when v_action = 'sync_checkout' then 'creem_webhook_checkout_synced'
      else 'creem_webhook_processed'
    end,
    resolved_user_id = v_resolved_user_id,
    processed_at = v_now,
    updated_at = v_now
  where event_row.id = v_event.id
  returning event_row.* into v_event;

  result_processing_status := 'processed';
  result_reason_code := v_event.reason_code;
  result_resolved_user_id := v_resolved_user_id;
  return next;
end;
$$;

revoke all on function public.process_creem_webhook_event(
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  timestamptz,
  timestamptz,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text
) from public;
revoke all on function public.process_creem_webhook_event(
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  timestamptz,
  timestamptz,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text
) from anon;
revoke all on function public.process_creem_webhook_event(
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  timestamptz,
  timestamptz,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text
) from authenticated;

grant execute on function public.process_creem_webhook_event(
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  timestamptz,
  timestamptz,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text
) to service_role;

comment on function public.process_creem_webhook_event(
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  timestamptz,
  timestamptz,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text
) is
  'Service-role-only atomic Creem webhook processor. Resolves users through trusted identifiers, records retryable pending states, prevents stale/equal-time overwrites, and mutates entitlements in the same transaction as ledger processing. Function owner must be a privileged migration owner with access to public.users, auth.users, and private billing tables.';

create or replace function public.reprocess_creem_webhook_event(
  p_provider_event_id text
)
returns table (
  result_processing_status text,
  result_reason_code text,
  result_resolved_user_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider_event_id text := left(nullif(btrim(coalesce(p_provider_event_id, '')), ''), 180);
  v_event public.creem_webhook_events%rowtype;
begin
  if v_provider_event_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CREEM_WEBHOOK_EVENT_ID';
  end if;

  select event_row.*
  into v_event
  from public.creem_webhook_events as event_row
  where event_row.provider_event_id = v_provider_event_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CREEM_WEBHOOK_EVENT_NOT_FOUND';
  end if;

  return query
    select
      processed.result_processing_status,
      processed.result_reason_code,
      processed.result_resolved_user_id
    from public.process_creem_webhook_event(
      v_event.provider_event_id,
      v_event.event_type,
      v_event.provider_event_created_at,
      v_event.provider_state_updated_at,
      v_event.object_id,
      v_event.checkout_id,
      v_event.subscription_id,
      v_event.customer_id,
      v_event.product_id,
      v_event.environment,
      v_event.creem_request_id,
      v_event.internal_user_id_candidate,
      v_event.webhook_action,
      v_event.normalized_subscription_status,
      v_event.cancel_at_period_end,
      v_event.current_period_start_at,
      v_event.current_period_end_at,
      v_event.refund_amount,
      v_event.amount_paid,
      v_event.refunded_amount,
      v_event.refund_currency,
      v_event.transaction_currency,
      v_event.reason_code
    ) as processed;
end;
$$;

revoke all on function public.reprocess_creem_webhook_event(text) from public;
revoke all on function public.reprocess_creem_webhook_event(text) from anon;
revoke all on function public.reprocess_creem_webhook_event(text) from authenticated;

grant execute on function public.reprocess_creem_webhook_event(text)
  to service_role;

comment on function public.reprocess_creem_webhook_event(text) is
  'Service-role-only reconciliation helper. Replays one stored normalized Creem webhook event through the same trusted resolution, idempotency, ordering, and entitlement path without accepting a caller-supplied user id.';

create or replace function public.resolve_creem_webhook_review(
  p_provider_event_id text,
  p_decision text
)
returns table (
  result_processing_status text,
  result_reason_code text,
  result_resolved_user_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_provider_event_id text := left(nullif(btrim(coalesce(p_provider_event_id, '')), ''), 180);
  v_decision text := left(nullif(btrim(coalesce(p_decision, '')), ''), 40);
  v_event public.creem_webhook_events%rowtype;
  v_user public.users%rowtype;
  v_customer_mismatch boolean := false;
  v_subscription_mismatch boolean := false;
begin
  if v_provider_event_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_CREEM_WEBHOOK_EVENT_ID';
  end if;

  if v_decision not in ('keep_access', 'revoke_access', 'close_no_action') then
    raise exception using errcode = 'P0001', message = 'INVALID_CREEM_REVIEW_DECISION';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_provider_event_id, 0));

  select event_row.*
  into v_event
  from public.creem_webhook_events as event_row
  where event_row.provider_event_id = v_provider_event_id
  for update of event_row;

  if not found then
    raise exception using errcode = 'P0001', message = 'CREEM_WEBHOOK_EVENT_NOT_FOUND';
  end if;

  if v_event.review_decision is not null then
    if v_event.review_decision <> v_decision then
      raise exception using errcode = 'P0001', message = 'CREEM_WEBHOOK_REVIEW_ALREADY_RESOLVED';
    end if;

    if v_event.processing_status in ('processed', 'stale') then
      result_processing_status := v_event.processing_status;
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := v_event.resolved_user_id;
      return next;
      return;
    end if;

    if v_event.processing_status <> 'pending_conflict' then
      raise exception using errcode = 'P0001', message = 'CREEM_WEBHOOK_REVIEW_INVALID_STATE';
    end if;
  elsif v_event.processing_status <> 'pending_review' then
    raise exception using errcode = 'P0001', message = 'CREEM_WEBHOOK_EVENT_NOT_PENDING_REVIEW';
  end if;

  if v_event.resolved_user_id is null then
    raise exception using errcode = 'P0001', message = 'CREEM_WEBHOOK_REVIEW_USER_UNRESOLVED';
  end if;

  select user_profile.*
  into v_user
  from public.users as user_profile
  where user_profile.id = v_event.resolved_user_id
  for update of user_profile;

  if not found then
    raise exception using errcode = 'P0001', message = 'CREEM_WEBHOOK_REVIEW_USER_NOT_FOUND';
  end if;

  if v_decision in ('keep_access', 'close_no_action') then
    update public.creem_webhook_events as event_row
    set
      processing_status = 'processed',
      reason_code = case
        when v_decision = 'keep_access' then 'creem_webhook_review_keep_access'
        else 'creem_webhook_review_closed_no_action'
      end,
      review_decision = v_decision,
      reviewed_at = v_now,
      processed_at = coalesce(event_row.processed_at, v_now),
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := v_event.processing_status;
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := v_event.resolved_user_id;
    return next;
    return;
  end if;

  if v_user.billing_last_state_updated_at is not null
    and v_user.billing_last_event_created_at is not null then
    if v_user.billing_last_state_updated_at > v_event.provider_state_updated_at
      or (
        v_user.billing_last_state_updated_at = v_event.provider_state_updated_at
        and v_user.billing_last_event_created_at > v_event.provider_event_created_at
      ) then
      update public.creem_webhook_events as event_row
      set
        processing_status = 'stale',
        reason_code = 'creem_webhook_review_stale',
        review_decision = v_decision,
        reviewed_at = v_now,
        processed_at = v_now,
        updated_at = v_now
      where event_row.id = v_event.id
      returning event_row.* into v_event;

      result_processing_status := v_event.processing_status;
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := v_event.resolved_user_id;
      return next;
      return;
    end if;

    if v_user.billing_last_state_updated_at = v_event.provider_state_updated_at
      and v_user.billing_last_event_created_at = v_event.provider_event_created_at
      and nullif(btrim(coalesce(v_user.billing_last_event_id, '')), '') is not null
      and v_user.billing_last_event_id <> v_event.provider_event_id then
      update public.creem_webhook_events as event_row
      set
        processing_status = 'pending_conflict',
        reason_code = 'creem_webhook_equal_timestamp_conflict',
        review_decision = v_decision,
        reviewed_at = v_now,
        updated_at = v_now
      where event_row.id = v_event.id
      returning event_row.* into v_event;

      result_processing_status := v_event.processing_status;
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := v_event.resolved_user_id;
      return next;
      return;
    end if;
  end if;

  v_customer_mismatch :=
    v_event.customer_id is not null
    and nullif(btrim(coalesce(v_user.creem_customer_id, '')), '') is not null
    and btrim(v_user.creem_customer_id) <> v_event.customer_id;

  v_subscription_mismatch :=
    v_event.subscription_id is not null
    and nullif(btrim(coalesce(v_user.creem_subscription_id, '')), '') is not null
    and btrim(v_user.creem_subscription_id) <> v_event.subscription_id;

  if v_customer_mismatch or v_subscription_mismatch then
    update public.creem_webhook_events as event_row
    set
      processing_status = 'pending_conflict',
      reason_code = 'creem_webhook_provider_id_conflict',
      review_decision = v_decision,
      reviewed_at = v_now,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := v_event.processing_status;
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := v_event.resolved_user_id;
    return next;
    return;
  end if;

  update public.users as user_profile
  set
    plan = 'free',
    creem_customer_id = coalesce(v_event.customer_id, user_profile.creem_customer_id),
    creem_subscription_id = coalesce(v_event.subscription_id, user_profile.creem_subscription_id),
    subscription_status = 'refunded',
    cancel_at_period_end = false,
    billing_updated_at = v_now,
    billing_last_state_updated_at = v_event.provider_state_updated_at,
    billing_last_event_created_at = v_event.provider_event_created_at,
    billing_last_event_id = v_event.provider_event_id,
    billing_last_event_type = v_event.event_type,
    billing_last_action = 'refund_downgrade'
  where user_profile.id = v_event.resolved_user_id;

  update public.creem_webhook_events as event_row
  set
    processing_status = 'processed',
    reason_code = 'creem_webhook_review_revoke_access',
    webhook_action = 'refund_downgrade',
    normalized_subscription_status = 'refunded',
    review_decision = v_decision,
    reviewed_at = v_now,
    processed_at = v_now,
    updated_at = v_now
  where event_row.id = v_event.id
  returning event_row.* into v_event;

  result_processing_status := v_event.processing_status;
  result_reason_code := v_event.reason_code;
  result_resolved_user_id := v_event.resolved_user_id;
  return next;
end;
$$;

revoke all on function public.resolve_creem_webhook_review(text, text) from public;
revoke all on function public.resolve_creem_webhook_review(text, text) from anon;
revoke all on function public.resolve_creem_webhook_review(text, text) from authenticated;

grant execute on function public.resolve_creem_webhook_review(text, text)
  to service_role;

comment on function public.resolve_creem_webhook_review(text, text) is
  'Service-role-only manual resolution for pending Creem refund review. Accepts only a provider event id and a bounded decision, uses the ledger-resolved user, respects ordering and provider-id consistency, and is idempotent for repeated identical decisions.';
