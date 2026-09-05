-- Text2Task Homepage Demo Processing Accounting RPCs
-- Migration: 202606290001_homepage_demo_processing_accounting_rpc.sql
-- Created: 2026-06-29
--
-- Server-only processing lifecycle and accounting transitions for admitted
-- homepage demo attempts. This migration does not enable the demo, add public
-- routes, add browser privileges, or perform extraction/provider work.

create or replace function public.start_homepage_demo_processing(
  p_attempt_id uuid,
  p_capacity_lease_token_hash text
)
returns table (
  decision text,
  attempt_id uuid,
  trial_id uuid,
  attempt_status text,
  trial_status text,
  provider_call_started_at timestamptz,
  lease_expires_at timestamptz,
  idempotent boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_hash_pattern constant text := '^[0-9a-f]{64}$';
  v_now timestamptz := pg_catalog.now();
  v_attempt public.homepage_demo_admission_attempts%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_capacity public.homepage_demo_capacity_reservations%rowtype;
  v_cost public.homepage_demo_cost_reservations%rowtype;
  v_hour_bucket public.homepage_demo_cost_buckets%rowtype;
  v_day_bucket public.homepage_demo_cost_buckets%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_entitlement_count integer;
  v_reserved_entitlement_count integer;
  v_consumed_entitlement_count integer;
  v_released_entitlement_count integer;
  v_expired_entitlement_count integer;
  v_session_entitlement_count integer;
  v_device_entitlement_count integer;
  v_transition_trial_id uuid;
  v_transition_status text;
  v_transition_risk_state text;
  v_transition_expires_at timestamptz;
  v_transition_changed boolean;
  v_updated_count integer;
  v_exception_message text;
begin
  if p_attempt_id is null
    or p_capacity_lease_token_hash is null
    or p_capacity_lease_token_hash !~ v_hash_pattern then
    raise exception using
      errcode = '22023',
      message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
  end if;

  select attempt.*
  into v_attempt
  from public.homepage_demo_admission_attempts as attempt
  where attempt.id = p_attempt_id
  for update of attempt;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND';
  end if;

  if v_attempt.trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_attempt.trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select capacity.*
  into v_capacity
  from public.homepage_demo_capacity_reservations as capacity
  where capacity.attempt_id = v_attempt.id
  for update of capacity;

  if not found or v_capacity.lease_token_hash <> p_capacity_lease_token_hash then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID';
  end if;

  if v_capacity.status = 'expired'
    or (
      v_capacity.status = 'active'
      and v_capacity.lease_expires_at <= v_now
    ) then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_LEASE_EXPIRED';
  end if;

  if v_capacity.status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_attempt.input_type not in ('text', 'image')
    or v_attempt.estimated_cost_units <= 0
    or v_capacity.workload_type <> v_attempt.input_type
    or v_capacity.reserved_units <> 1
    or v_capacity.released_at is not null
    or v_capacity.expired_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select cost.*
  into v_cost
  from public.homepage_demo_cost_reservations as cost
  where cost.attempt_id = v_attempt.id
  for update of cost;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_cost.status <> 'reserved'
    or v_cost.reserved_units <= 0
    or v_cost.reserved_units <> v_attempt.estimated_cost_units
    or v_cost.finalized_units is not null
    or v_cost.finalized_at is not null
    or v_cost.released_at is not null
    or v_cost.expired_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select bucket.*
  into v_hour_bucket
  from public.homepage_demo_cost_buckets as bucket
  where bucket.id = v_cost.hour_bucket_id
    and bucket.window_kind = 'hour'
  for update of bucket;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select bucket.*
  into v_day_bucket
  from public.homepage_demo_cost_buckets as bucket
  where bucket.id = v_cost.day_bucket_id
    and bucket.window_kind = 'day'
  for update of bucket;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_hour_bucket.reserved_units < v_cost.reserved_units
    or v_day_bucket.reserved_units < v_cost.reserved_units then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select
    count(*)::integer,
    count(*) filter (where locked_entitlements.status = 'reserved')::integer,
    count(*) filter (where locked_entitlements.status = 'consumed')::integer,
    count(*) filter (where locked_entitlements.status = 'released')::integer,
    count(*) filter (where locked_entitlements.status = 'expired')::integer,
    count(*) filter (where locked_entitlements.scope = 'session')::integer,
    count(*) filter (where locked_entitlements.scope = 'device')::integer
  into
    v_entitlement_count,
    v_reserved_entitlement_count,
    v_consumed_entitlement_count,
    v_released_entitlement_count,
    v_expired_entitlement_count,
    v_session_entitlement_count,
    v_device_entitlement_count
  from (
    select entitlement.status, entitlement.scope
    from public.homepage_demo_trial_entitlements as entitlement
    where entitlement.attempt_id = v_attempt.id
    order by entitlement.scope
    for update of entitlement
  ) as locked_entitlements;

  if v_entitlement_count <> 2
    or v_reserved_entitlement_count <> 2
    or v_consumed_entitlement_count <> 0
    or v_released_entitlement_count <> 0
    or v_expired_entitlement_count <> 0
    or v_session_entitlement_count <> 1
    or v_device_entitlement_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.trial_id = v_trial.id
  for update of draft;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_attempt.status = 'processing' then
    if v_trial.status <> 'processing'
      or v_trial.risk_state <> 'allowed'
      or v_attempt.provider_call_started_at is null
      or v_attempt.provider_call_completed_at is not null
      or v_attempt.review_ready_at is not null
      or v_cost.status <> 'reserved'
      or v_cost.provider_call_started_at is null
      or v_cost.provider_call_started_at <> v_attempt.provider_call_started_at then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    return query
      select
        'processing'::text,
        v_attempt.id,
        v_trial.id,
        v_attempt.status,
        v_trial.status,
        v_attempt.provider_call_started_at,
        v_capacity.lease_expires_at,
        true;
    return;
  end if;

  if v_attempt.status <> 'admitted'
    or v_attempt.provider_call_started_at is not null
    or v_attempt.provider_call_completed_at is not null
    or v_attempt.review_ready_at is not null
    or v_trial.status <> 'queued'
    or v_trial.risk_state <> 'allowed'
    or v_cost.status <> 'reserved'
    or v_cost.provider_call_started_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select advanced.trial_id,
    advanced.status,
    advanced.risk_state,
    advanced.expires_at,
    advanced.changed
  into
    v_transition_trial_id,
    v_transition_status,
    v_transition_risk_state,
    v_transition_expires_at,
    v_transition_changed
  from public.advance_homepage_demo_trial(
    v_trial.id,
    'queued',
    'processing',
    'allowed'
  ) as advanced;

  if v_transition_changed is not true
    or v_transition_trial_id <> v_trial.id
    or v_transition_status <> 'processing'
    or v_transition_risk_state <> 'allowed' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_admission_attempts as attempt
  set
    status = 'processing',
    provider_call_started_at = v_now
  where attempt.id = v_attempt.id
    and attempt.status = 'admitted'
    and attempt.provider_call_started_at is null
  returning attempt.* into v_attempt;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_cost_reservations as cost
  set provider_call_started_at = v_now
  where cost.id = v_cost.id
    and cost.status = 'reserved'
    and cost.provider_call_started_at is null
  returning cost.* into v_cost;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  v_trial.status := v_transition_status;

  return query
    select
      'processing'::text,
      v_attempt.id,
      v_trial.id,
      v_attempt.status,
      v_trial.status,
      v_attempt.provider_call_started_at,
      v_capacity.lease_expires_at,
      false;
exception
  when others then
    get stacked diagnostics v_exception_message = message_text;

    if v_exception_message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT' then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND',
      'HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID',
      'HOMEPAGE_DEMO_PROCESSING_LEASE_EXPIRED',
      'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT',
      'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT',
      'HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE'
    ) then
      raise exception using
        errcode = 'P0001',
        message = v_exception_message;
    end if;

    if v_exception_message in (
      'INVALID_HOMEPAGE_DEMO_TRIAL_ID',
      'INVALID_HOMEPAGE_DEMO_TRANSITION',
      'INVALID_HOMEPAGE_DEMO_RISK_STATE',
      'HOMEPAGE_DEMO_TRIAL_NOT_FOUND',
      'HOMEPAGE_DEMO_TRIAL_EXPIRED',
      'HOMEPAGE_DEMO_TRANSITION_CONFLICT',
      'HOMEPAGE_DEMO_TERMINAL_STATE',
      'HOMEPAGE_DEMO_RISK_BLOCKED',
      'HOMEPAGE_DEMO_RISK_NOT_ALLOWED'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE';
end;
$$;

create or replace function public.complete_homepage_demo_processing(
  p_attempt_id uuid,
  p_capacity_lease_token_hash text,
  p_normalized_result jsonb,
  p_schema_version text,
  p_engine_version text
)
returns table (
  decision text,
  attempt_id uuid,
  trial_id uuid,
  draft_id uuid,
  attempt_status text,
  trial_status text,
  draft_status text,
  provider_call_started_at timestamptz,
  provider_call_completed_at timestamptz,
  review_ready_at timestamptz,
  idempotent boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_hash_pattern constant text := '^[0-9a-f]{64}$';
  v_safe_identifier_pattern constant text := '^[A-Za-z0-9_.:-]+$';
  v_now timestamptz := pg_catalog.now();
  v_schema_version text := btrim(coalesce(p_schema_version, ''));
  v_engine_version text := btrim(coalesce(p_engine_version, ''));
  v_attempt public.homepage_demo_admission_attempts%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_capacity public.homepage_demo_capacity_reservations%rowtype;
  v_cost public.homepage_demo_cost_reservations%rowtype;
  v_hour_bucket public.homepage_demo_cost_buckets%rowtype;
  v_day_bucket public.homepage_demo_cost_buckets%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_entitlement_count integer;
  v_reserved_entitlement_count integer;
  v_consumed_entitlement_count integer;
  v_released_entitlement_count integer;
  v_expired_entitlement_count integer;
  v_session_entitlement_count integer;
  v_device_entitlement_count integer;
  v_completed_trial_id uuid;
  v_completed_draft_id uuid;
  v_completed_trial_status text;
  v_completed_draft_status text;
  v_completed_expires_at timestamptz;
  v_completed_created boolean;
  v_updated_count integer;
  v_exception_message text;
begin
  if p_attempt_id is null
    or p_capacity_lease_token_hash is null
    or p_capacity_lease_token_hash !~ v_hash_pattern
    or p_normalized_result is null
    or jsonb_typeof(p_normalized_result) <> 'object'
    or char_length(v_schema_version) not between 1 and 80
    or v_schema_version !~ v_safe_identifier_pattern
    or char_length(v_engine_version) not between 1 and 80
    or v_engine_version !~ v_safe_identifier_pattern then
    raise exception using
      errcode = '22023',
      message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
  end if;

  select attempt.*
  into v_attempt
  from public.homepage_demo_admission_attempts as attempt
  where attempt.id = p_attempt_id
  for update of attempt;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND';
  end if;

  if v_attempt.trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_attempt.trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select capacity.*
  into v_capacity
  from public.homepage_demo_capacity_reservations as capacity
  where capacity.attempt_id = v_attempt.id
  for update of capacity;

  if not found or v_capacity.lease_token_hash <> p_capacity_lease_token_hash then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID';
  end if;

  if v_attempt.input_type not in ('text', 'image')
    or v_attempt.estimated_cost_units <= 0
    or v_capacity.workload_type <> v_attempt.input_type
    or v_capacity.reserved_units <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select cost.*
  into v_cost
  from public.homepage_demo_cost_reservations as cost
  where cost.attempt_id = v_attempt.id
  for update of cost;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_cost.reserved_units <= 0
    or v_cost.reserved_units <> v_attempt.estimated_cost_units then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select bucket.*
  into v_hour_bucket
  from public.homepage_demo_cost_buckets as bucket
  where bucket.id = v_cost.hour_bucket_id
    and bucket.window_kind = 'hour'
  for update of bucket;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select bucket.*
  into v_day_bucket
  from public.homepage_demo_cost_buckets as bucket
  where bucket.id = v_cost.day_bucket_id
    and bucket.window_kind = 'day'
  for update of bucket;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select
    count(*)::integer,
    count(*) filter (where locked_entitlements.status = 'reserved')::integer,
    count(*) filter (where locked_entitlements.status = 'consumed')::integer,
    count(*) filter (where locked_entitlements.status = 'released')::integer,
    count(*) filter (where locked_entitlements.status = 'expired')::integer,
    count(*) filter (where locked_entitlements.scope = 'session')::integer,
    count(*) filter (where locked_entitlements.scope = 'device')::integer
  into
    v_entitlement_count,
    v_reserved_entitlement_count,
    v_consumed_entitlement_count,
    v_released_entitlement_count,
    v_expired_entitlement_count,
    v_session_entitlement_count,
    v_device_entitlement_count
  from (
    select entitlement.status, entitlement.scope
    from public.homepage_demo_trial_entitlements as entitlement
    where entitlement.attempt_id = v_attempt.id
    order by entitlement.scope
    for update of entitlement
  ) as locked_entitlements;

  if v_entitlement_count <> 2
    or v_session_entitlement_count <> 1
    or v_device_entitlement_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_attempt.status = 'review_ready' then
    if v_trial.status <> 'review_ready'
      or v_attempt.provider_call_started_at is null
      or v_cost.provider_call_started_at is null
      or v_cost.provider_call_started_at is distinct from v_attempt.provider_call_started_at
      or v_attempt.provider_call_completed_at is null
      or v_attempt.review_ready_at is null
      or v_capacity.status <> 'released'
      or v_capacity.released_at is null
      or v_capacity.expired_at is not null
      or v_cost.status <> 'finalized'
      or v_cost.finalized_units is null
      or v_cost.finalized_units is distinct from v_cost.reserved_units
      or v_cost.finalized_at is null
      or v_cost.released_at is not null
      or v_cost.expired_at is not null
      or v_consumed_entitlement_count <> 2
      or v_reserved_entitlement_count <> 0
      or v_released_entitlement_count <> 0
      or v_expired_entitlement_count <> 0 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT';
    end if;

    select completed.trial_id,
      completed.draft_id,
      completed.trial_status,
      completed.draft_status,
      completed.expires_at,
      completed.created
    into
      v_completed_trial_id,
      v_completed_draft_id,
      v_completed_trial_status,
      v_completed_draft_status,
      v_completed_expires_at,
      v_completed_created
    from public.complete_homepage_demo_trial(
      v_trial.id,
      p_normalized_result,
      v_schema_version,
      v_engine_version
    ) as completed;

    select draft.*
    into v_draft
    from public.homepage_demo_drafts as draft
    where draft.id = v_completed_draft_id
      and draft.trial_id = v_trial.id
    for update of draft;

    if not found
      or v_draft.id is distinct from v_completed_draft_id
      or v_draft.trial_id is distinct from v_trial.id
      or v_draft.status is distinct from 'ready'
      or v_draft.normalized_result is null
      or v_completed_trial_id is distinct from v_trial.id
      or v_completed_draft_id is distinct from v_draft.id
      or v_completed_trial_status is distinct from 'review_ready'
      or v_completed_draft_status is distinct from 'ready'
      or v_completed_created is distinct from false then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT';
    end if;

    return query
      select
        'review_ready'::text,
        v_attempt.id,
        v_trial.id,
        v_draft.id,
        v_attempt.status,
        v_trial.status,
        v_draft.status,
        v_attempt.provider_call_started_at,
        v_attempt.provider_call_completed_at,
        v_attempt.review_ready_at,
        true;
    return;
  end if;

  if v_capacity.status = 'expired'
    or (
      v_capacity.status = 'active'
      and v_capacity.lease_expires_at <= v_now
    ) then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_LEASE_EXPIRED';
  end if;

  if v_capacity.status <> 'active'
    or v_attempt.status <> 'processing'
    or v_trial.status <> 'processing'
    or v_trial.risk_state <> 'allowed'
    or v_capacity.released_at is not null
    or v_capacity.expired_at is not null
    or v_attempt.provider_call_started_at is null
    or v_attempt.provider_call_completed_at is not null
    or v_attempt.review_ready_at is not null
    or v_cost.status <> 'reserved'
    or v_cost.provider_call_started_at is null
    or v_cost.provider_call_started_at <> v_attempt.provider_call_started_at
    or v_cost.finalized_units is not null
    or v_cost.finalized_at is not null
    or v_cost.released_at is not null
    or v_cost.expired_at is not null
    or v_hour_bucket.reserved_units < v_cost.reserved_units
    or v_day_bucket.reserved_units < v_cost.reserved_units
    or v_reserved_entitlement_count <> 2
    or v_consumed_entitlement_count <> 0
    or v_released_entitlement_count <> 0
    or v_expired_entitlement_count <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.trial_id = v_trial.id
  for update of draft;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT';
  end if;

  select completed.trial_id,
    completed.draft_id,
    completed.trial_status,
    completed.draft_status,
    completed.expires_at,
    completed.created
  into
    v_completed_trial_id,
    v_completed_draft_id,
    v_completed_trial_status,
    v_completed_draft_status,
    v_completed_expires_at,
    v_completed_created
  from public.complete_homepage_demo_trial(
    v_trial.id,
    p_normalized_result,
    v_schema_version,
    v_engine_version
  ) as completed;

  if v_completed_trial_id <> v_trial.id
    or v_completed_trial_status <> 'review_ready'
    or v_completed_draft_status <> 'ready'
    or v_completed_created is not true then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.id = v_completed_draft_id
    and draft.trial_id = v_trial.id
  for update of draft;

  if not found
    or v_draft.status <> 'ready'
    or v_draft.normalized_result is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT';
  end if;

  update public.homepage_demo_admission_attempts as attempt
  set
    status = 'review_ready',
    provider_call_completed_at = v_now,
    review_ready_at = v_now
  where attempt.id = v_attempt.id
    and attempt.status = 'processing'
    and attempt.provider_call_started_at is not null
    and attempt.provider_call_completed_at is null
    and attempt.review_ready_at is null
  returning attempt.* into v_attempt;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_trial_entitlements as entitlement
  set
    status = 'consumed',
    trial_id = v_trial.id,
    consumed_at = v_now,
    released_at = null
  where entitlement.attempt_id = v_attempt.id
    and entitlement.status = 'reserved';

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_capacity_reservations as capacity
  set
    status = 'released',
    released_at = v_now,
    expired_at = null
  where capacity.id = v_capacity.id
    and capacity.status = 'active'
  returning capacity.* into v_capacity;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_cost_buckets as bucket
  set
    reserved_units = bucket.reserved_units - v_cost.reserved_units,
    spent_units = bucket.spent_units + v_cost.reserved_units
  where bucket.id = v_cost.hour_bucket_id
    and bucket.window_kind = 'hour'
    and bucket.reserved_units >= v_cost.reserved_units;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_cost_buckets as bucket
  set
    reserved_units = bucket.reserved_units - v_cost.reserved_units,
    spent_units = bucket.spent_units + v_cost.reserved_units
  where bucket.id = v_cost.day_bucket_id
    and bucket.window_kind = 'day'
    and bucket.reserved_units >= v_cost.reserved_units;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_cost_reservations as cost
  set
    status = 'finalized',
    finalized_units = cost.reserved_units,
    finalized_at = v_now,
    released_at = null,
    expired_at = null
  where cost.id = v_cost.id
    and cost.status = 'reserved'
    and cost.finalized_units is null
    and cost.finalized_at is null
    and cost.released_at is null
    and cost.expired_at is null
  returning cost.* into v_cost;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  v_trial.status := v_completed_trial_status;

  return query
    select
      'review_ready'::text,
      v_attempt.id,
      v_trial.id,
      v_draft.id,
      v_attempt.status,
      v_trial.status,
      v_draft.status,
      v_attempt.provider_call_started_at,
      v_attempt.provider_call_completed_at,
      v_attempt.review_ready_at,
      false;
exception
  when others then
    get stacked diagnostics v_exception_message = message_text;

    if v_exception_message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT' then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND',
      'HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID',
      'HOMEPAGE_DEMO_PROCESSING_LEASE_EXPIRED',
      'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT',
      'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT',
      'HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE'
    ) then
      raise exception using
        errcode = 'P0001',
        message = v_exception_message;
    end if;

    if v_exception_message in (
      'INVALID_HOMEPAGE_DEMO_TRIAL_ID',
      'INVALID_HOMEPAGE_DEMO_RESULT',
      'INVALID_HOMEPAGE_DEMO_VERSION'
    ) then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_COMPLETION_CONFLICT',
      'HOMEPAGE_DEMO_DRAFT_CONFLICT'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_TRIAL_NOT_FOUND',
      'HOMEPAGE_DEMO_TRIAL_EXPIRED',
      'HOMEPAGE_DEMO_COMPLETION_INVALID_STATE',
      'HOMEPAGE_DEMO_RISK_NOT_ALLOWED'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE';
end;
$$;

create or replace function public.fail_homepage_demo_processing(
  p_attempt_id uuid,
  p_capacity_lease_token_hash text,
  p_failure_code text
)
returns table (
  decision text,
  attempt_id uuid,
  trial_id uuid,
  attempt_status text,
  trial_status text,
  provider_call_started_at timestamptz,
  provider_call_completed_at timestamptz,
  lease_expires_at timestamptz,
  idempotent boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_hash_pattern constant text := '^[0-9a-f]{64}$';
  v_failure_code_pattern constant text := '^[a-z0-9_:-]{1,80}$';
  v_now timestamptz := pg_catalog.now();
  v_failure_code text := btrim(coalesce(p_failure_code, ''));
  v_attempt public.homepage_demo_admission_attempts%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_capacity public.homepage_demo_capacity_reservations%rowtype;
  v_cost public.homepage_demo_cost_reservations%rowtype;
  v_hour_bucket public.homepage_demo_cost_buckets%rowtype;
  v_day_bucket public.homepage_demo_cost_buckets%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_entitlement_count integer;
  v_reserved_entitlement_count integer;
  v_consumed_entitlement_count integer;
  v_released_entitlement_count integer;
  v_expired_entitlement_count integer;
  v_session_entitlement_count integer;
  v_device_entitlement_count integer;
  v_failed_trial_id uuid;
  v_failed_status text;
  v_failed_risk_state text;
  v_failed_expires_at timestamptz;
  v_failed_changed boolean;
  v_provider_started boolean;
  v_expected_trial_status text;
  v_updated_count integer;
  v_exception_message text;
begin
  if p_attempt_id is null
    or p_capacity_lease_token_hash is null
    or p_capacity_lease_token_hash !~ v_hash_pattern
    or v_failure_code !~ v_failure_code_pattern then
    raise exception using
      errcode = '22023',
      message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
  end if;

  select attempt.*
  into v_attempt
  from public.homepage_demo_admission_attempts as attempt
  where attempt.id = p_attempt_id
  for update of attempt;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND';
  end if;

  if v_attempt.trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_attempt.trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select capacity.*
  into v_capacity
  from public.homepage_demo_capacity_reservations as capacity
  where capacity.attempt_id = v_attempt.id
  for update of capacity;

  if not found or v_capacity.lease_token_hash <> p_capacity_lease_token_hash then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID';
  end if;

  if v_attempt.input_type not in ('text', 'image')
    or v_attempt.estimated_cost_units <= 0
    or v_capacity.workload_type <> v_attempt.input_type
    or v_capacity.reserved_units <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select cost.*
  into v_cost
  from public.homepage_demo_cost_reservations as cost
  where cost.attempt_id = v_attempt.id
  for update of cost;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_cost.reserved_units <= 0
    or v_cost.reserved_units <> v_attempt.estimated_cost_units then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select bucket.*
  into v_hour_bucket
  from public.homepage_demo_cost_buckets as bucket
  where bucket.id = v_cost.hour_bucket_id
    and bucket.window_kind = 'hour'
  for update of bucket;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select bucket.*
  into v_day_bucket
  from public.homepage_demo_cost_buckets as bucket
  where bucket.id = v_cost.day_bucket_id
    and bucket.window_kind = 'day'
  for update of bucket;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select
    count(*)::integer,
    count(*) filter (where locked_entitlements.status = 'reserved')::integer,
    count(*) filter (where locked_entitlements.status = 'consumed')::integer,
    count(*) filter (where locked_entitlements.status = 'released')::integer,
    count(*) filter (where locked_entitlements.status = 'expired')::integer,
    count(*) filter (where locked_entitlements.scope = 'session')::integer,
    count(*) filter (where locked_entitlements.scope = 'device')::integer
  into
    v_entitlement_count,
    v_reserved_entitlement_count,
    v_consumed_entitlement_count,
    v_released_entitlement_count,
    v_expired_entitlement_count,
    v_session_entitlement_count,
    v_device_entitlement_count
  from (
    select entitlement.status, entitlement.scope
    from public.homepage_demo_trial_entitlements as entitlement
    where entitlement.attempt_id = v_attempt.id
    order by entitlement.scope
    for update of entitlement
  ) as locked_entitlements;

  if v_entitlement_count <> 2
    or v_session_entitlement_count <> 1
    or v_device_entitlement_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.trial_id = v_trial.id
  for update of draft;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_attempt.provider_call_started_at is null
    and v_cost.provider_call_started_at is null then
    v_provider_started := false;
  elsif v_attempt.provider_call_started_at is not null
    and v_cost.provider_call_started_at is not null
    and v_attempt.provider_call_started_at = v_cost.provider_call_started_at then
    v_provider_started := true;
  else
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_attempt.status = 'failed' then
    if v_trial.status <> 'failed'
      or v_attempt.decision_code is distinct from v_failure_code
      or v_trial.failure_code is distinct from v_failure_code
      or v_capacity.status <> 'released'
      or v_capacity.released_at is null
      or v_capacity.expired_at is not null
      or v_released_entitlement_count <> 2
      or v_reserved_entitlement_count <> 0
      or v_consumed_entitlement_count <> 0
      or v_expired_entitlement_count <> 0 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    if v_provider_started then
      if v_attempt.provider_call_completed_at is null
        or v_cost.status <> 'finalized'
        or v_cost.finalized_units is null
        or v_cost.finalized_units is distinct from v_cost.reserved_units
        or v_cost.finalized_at is null
        or v_cost.released_at is not null
        or v_cost.expired_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
      end if;
    else
      if v_attempt.provider_call_completed_at is not null
        or v_cost.status <> 'released'
        or v_cost.finalized_units is not null
        or v_cost.finalized_at is not null
        or v_cost.released_at is null
        or v_cost.expired_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
      end if;
    end if;

    return query
      select
        'failed'::text,
        v_attempt.id,
        v_trial.id,
        v_attempt.status,
        v_trial.status,
        v_attempt.provider_call_started_at,
        v_attempt.provider_call_completed_at,
        v_capacity.lease_expires_at,
        true;
    return;
  end if;

  if v_attempt.status = 'review_ready'
    or v_trial.status = 'review_ready' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_capacity.status <> 'active'
    or v_cost.status <> 'reserved'
    or v_capacity.released_at is not null
    or v_capacity.expired_at is not null
    or v_cost.finalized_units is not null
    or v_cost.finalized_at is not null
    or v_cost.released_at is not null
    or v_cost.expired_at is not null
    or v_hour_bucket.reserved_units < v_cost.reserved_units
    or v_day_bucket.reserved_units < v_cost.reserved_units
    or v_reserved_entitlement_count <> 2
    or v_consumed_entitlement_count <> 0
    or v_released_entitlement_count <> 0
    or v_expired_entitlement_count <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_provider_started then
    if v_attempt.status <> 'processing'
      or v_trial.status <> 'processing'
      or v_trial.risk_state <> 'allowed'
      or v_cost.provider_call_started_at is null
      or v_attempt.provider_call_completed_at is not null
      or v_attempt.review_ready_at is not null then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    v_expected_trial_status := 'processing';
  else
    if v_attempt.status <> 'admitted'
      or v_trial.status <> 'queued'
      or v_trial.risk_state <> 'allowed'
      or v_cost.provider_call_started_at is not null
      or v_attempt.provider_call_completed_at is not null
      or v_attempt.review_ready_at is not null then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    v_expected_trial_status := 'queued';
  end if;

  select failed.trial_id,
    failed.status,
    failed.risk_state,
    failed.expires_at,
    failed.changed
  into
    v_failed_trial_id,
    v_failed_status,
    v_failed_risk_state,
    v_failed_expires_at,
    v_failed_changed
  from public.fail_homepage_demo_trial(
    v_trial.id,
    v_expected_trial_status,
    v_failure_code
  ) as failed;

  if v_failed_trial_id <> v_trial.id
    or v_failed_status <> 'failed'
    or v_failed_changed is not true then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_provider_started then
    update public.homepage_demo_admission_attempts as attempt
    set
      status = 'failed',
      decision_code = v_failure_code,
      provider_call_completed_at = v_now
    where attempt.id = v_attempt.id
      and attempt.status = 'processing'
      and attempt.provider_call_started_at is not null
      and attempt.provider_call_completed_at is null
      and attempt.review_ready_at is null
    returning attempt.* into v_attempt;
  else
    update public.homepage_demo_admission_attempts as attempt
    set
      status = 'failed',
      decision_code = v_failure_code
    where attempt.id = v_attempt.id
      and attempt.status = 'admitted'
      and attempt.provider_call_started_at is null
      and attempt.provider_call_completed_at is null
      and attempt.review_ready_at is null
    returning attempt.* into v_attempt;
  end if;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_trial_entitlements as entitlement
  set
    status = 'released',
    trial_id = null,
    consumed_at = null,
    released_at = v_now
  where entitlement.attempt_id = v_attempt.id
    and entitlement.status = 'reserved';

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_capacity_reservations as capacity
  set
    status = 'released',
    released_at = v_now,
    expired_at = null
  where capacity.id = v_capacity.id
    and capacity.status = 'active'
  returning capacity.* into v_capacity;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_provider_started then
    update public.homepage_demo_cost_buckets as bucket
    set
      reserved_units = bucket.reserved_units - v_cost.reserved_units,
      spent_units = bucket.spent_units + v_cost.reserved_units
    where bucket.id = v_cost.hour_bucket_id
      and bucket.window_kind = 'hour'
      and bucket.reserved_units >= v_cost.reserved_units;

    get diagnostics v_updated_count = row_count;

    if v_updated_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    update public.homepage_demo_cost_buckets as bucket
    set
      reserved_units = bucket.reserved_units - v_cost.reserved_units,
      spent_units = bucket.spent_units + v_cost.reserved_units
    where bucket.id = v_cost.day_bucket_id
      and bucket.window_kind = 'day'
      and bucket.reserved_units >= v_cost.reserved_units;

    get diagnostics v_updated_count = row_count;

    if v_updated_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    update public.homepage_demo_cost_reservations as cost
    set
      status = 'finalized',
      finalized_units = cost.reserved_units,
      finalized_at = v_now,
      released_at = null,
      expired_at = null
    where cost.id = v_cost.id
      and cost.status = 'reserved'
      and cost.finalized_units is null
      and cost.finalized_at is null
      and cost.released_at is null
      and cost.expired_at is null
    returning cost.* into v_cost;
  else
    update public.homepage_demo_cost_buckets as bucket
    set reserved_units = bucket.reserved_units - v_cost.reserved_units
    where bucket.id = v_cost.hour_bucket_id
      and bucket.window_kind = 'hour'
      and bucket.reserved_units >= v_cost.reserved_units;

    get diagnostics v_updated_count = row_count;

    if v_updated_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    update public.homepage_demo_cost_buckets as bucket
    set reserved_units = bucket.reserved_units - v_cost.reserved_units
    where bucket.id = v_cost.day_bucket_id
      and bucket.window_kind = 'day'
      and bucket.reserved_units >= v_cost.reserved_units;

    get diagnostics v_updated_count = row_count;

    if v_updated_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    update public.homepage_demo_cost_reservations as cost
    set
      status = 'released',
      finalized_units = null,
      finalized_at = null,
      released_at = v_now,
      expired_at = null
    where cost.id = v_cost.id
      and cost.status = 'reserved'
      and cost.finalized_units is null
      and cost.finalized_at is null
      and cost.released_at is null
      and cost.expired_at is null
    returning cost.* into v_cost;
  end if;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  v_trial.status := v_failed_status;

  return query
    select
      'failed'::text,
      v_attempt.id,
      v_trial.id,
      v_attempt.status,
      v_trial.status,
      v_attempt.provider_call_started_at,
      v_attempt.provider_call_completed_at,
      v_capacity.lease_expires_at,
      false;
exception
  when others then
    get stacked diagnostics v_exception_message = message_text;

    if v_exception_message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT' then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND',
      'HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID',
      'HOMEPAGE_DEMO_PROCESSING_LEASE_EXPIRED',
      'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT',
      'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT',
      'HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE'
    ) then
      raise exception using
        errcode = 'P0001',
        message = v_exception_message;
    end if;

    if v_exception_message in (
      'INVALID_HOMEPAGE_DEMO_TRIAL_ID',
      'INVALID_HOMEPAGE_DEMO_EXPECTED_STATUS',
      'INVALID_HOMEPAGE_DEMO_FAILURE_CODE'
    ) then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_TRIAL_NOT_FOUND',
      'HOMEPAGE_DEMO_TRIAL_EXPIRED',
      'HOMEPAGE_DEMO_FAILURE_CONFLICT'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE';
end;
$$;

revoke all on function public.start_homepage_demo_processing(uuid, text)
from public;
revoke all on function public.start_homepage_demo_processing(uuid, text)
from anon;
revoke all on function public.start_homepage_demo_processing(uuid, text)
from authenticated;
grant execute on function public.start_homepage_demo_processing(uuid, text)
to service_role;

revoke all on function public.complete_homepage_demo_processing(
  uuid,
  text,
  jsonb,
  text,
  text
) from public;
revoke all on function public.complete_homepage_demo_processing(
  uuid,
  text,
  jsonb,
  text,
  text
) from anon;
revoke all on function public.complete_homepage_demo_processing(
  uuid,
  text,
  jsonb,
  text,
  text
) from authenticated;
grant execute on function public.complete_homepage_demo_processing(
  uuid,
  text,
  jsonb,
  text,
  text
) to service_role;

revoke all on function public.fail_homepage_demo_processing(uuid, text, text)
from public;
revoke all on function public.fail_homepage_demo_processing(uuid, text, text)
from anon;
revoke all on function public.fail_homepage_demo_processing(uuid, text, text)
from authenticated;
grant execute on function public.fail_homepage_demo_processing(uuid, text, text)
to service_role;
