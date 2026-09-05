-- Text2Task Homepage Demo Maintenance Recovery
-- Migration: 202606300001_homepage_demo_maintenance_recovery.sql
-- Created: 2026-06-30
--
-- Service-role-only maintenance RPCs for bounded stale-processing recovery
-- and claimed-safe retention cleanup. These functions return aggregate counts
-- only and never return tokens, hashes, identities, client input, draft JSON,
-- provider output, or row identifiers.

create or replace function public.recover_stale_homepage_demo_processing(
  p_limit integer default 1000
)
returns table (
  recovered_attempts integer,
  failed_attempts integer,
  expired_trials integer,
  failed_trials integer,
  expired_capacities integer,
  released_cost_reservations integer,
  finalized_cost_reservations integer,
  expired_or_released_entitlements integer,
  conflicts_skipped integer
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_limit integer := coalesce(p_limit, 1000);
  v_candidate record;
  v_attempt public.homepage_demo_admission_attempts%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_capacity public.homepage_demo_capacity_reservations%rowtype;
  v_cost public.homepage_demo_cost_reservations%rowtype;
  v_hour_bucket public.homepage_demo_cost_buckets%rowtype;
  v_day_bucket public.homepage_demo_cost_buckets%rowtype;
  v_provider_started boolean;
  v_expected_trial_status text;
  v_row_count integer;
  v_entitlement_count integer;
  v_reserved_entitlement_count integer;
  v_session_entitlement_count integer;
  v_device_entitlement_count integer;
  v_candidate_entitlements integer;
  v_candidate_expired_trial integer;
  v_candidate_failed_trial integer;
  v_candidate_released_cost integer;
  v_candidate_finalized_cost integer;
  v_exception_message text;
begin
  if v_limit <= 0 then
    v_limit := 1000;
  end if;

  if v_limit > 1000 then
    v_limit := 1000;
  end if;

  recovered_attempts := 0;
  failed_attempts := 0;
  expired_trials := 0;
  failed_trials := 0;
  expired_capacities := 0;
  released_cost_reservations := 0;
  finalized_cost_reservations := 0;
  expired_or_released_entitlements := 0;
  conflicts_skipped := 0;

  for v_candidate in
    select
      attempt.id as attempt_id,
      capacity.id as capacity_id
    from public.homepage_demo_admission_attempts as attempt
    join public.homepage_demo_capacity_reservations as capacity
      on capacity.attempt_id = attempt.id
    where attempt.status in ('admitted', 'processing')
      and capacity.status = 'active'
      and capacity.lease_expires_at <= v_now
    order by
      capacity.lease_expires_at asc,
      attempt.created_at asc,
      attempt.id asc
    limit v_limit
    for update of attempt, capacity skip locked
  loop
    begin
      v_candidate_entitlements := 0;
      v_candidate_expired_trial := 0;
      v_candidate_failed_trial := 0;
      v_candidate_released_cost := 0;
      v_candidate_finalized_cost := 0;

      select attempt.*
      into v_attempt
      from public.homepage_demo_admission_attempts as attempt
      where attempt.id = v_candidate.attempt_id
      for update of attempt;

      if not found
        or v_attempt.status not in ('admitted', 'processing')
        or v_attempt.trial_id is null
        or v_attempt.decision_code is not null
        or v_attempt.review_ready_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      select trial.*
      into v_trial
      from public.homepage_demo_trials as trial
      where trial.id = v_attempt.trial_id
      for update of trial skip locked;

      if not found
        or v_trial.status = 'claimed'
        or v_trial.claimed_by_user_id is not null
        or v_trial.claimed_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      select capacity.*
      into v_capacity
      from public.homepage_demo_capacity_reservations as capacity
      where capacity.id = v_candidate.capacity_id
        and capacity.attempt_id = v_attempt.id
      for update of capacity skip locked;

      if not found
        or v_capacity.status <> 'active'
        or v_capacity.lease_expires_at > v_now
        or v_capacity.workload_type <> v_attempt.input_type
        or v_capacity.reserved_units <> 1
        or v_capacity.released_at is not null
        or v_capacity.expired_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      select cost.*
      into v_cost
      from public.homepage_demo_cost_reservations as cost
      where cost.attempt_id = v_attempt.id
      for update of cost skip locked;

      if not found
        or v_cost.status <> 'reserved'
        or v_cost.reserved_units <= 0
        or v_cost.reserved_units <> v_attempt.estimated_cost_units
        or v_cost.finalized_units is not null
        or v_cost.finalized_at is not null
        or v_cost.released_at is not null
        or v_cost.expired_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      select bucket.*
      into v_hour_bucket
      from public.homepage_demo_cost_buckets as bucket
      where bucket.id = v_cost.hour_bucket_id
        and bucket.window_kind = 'hour'
      for update of bucket skip locked;

      if not found then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      select bucket.*
      into v_day_bucket
      from public.homepage_demo_cost_buckets as bucket
      where bucket.id = v_cost.day_bucket_id
        and bucket.window_kind = 'day'
      for update of bucket skip locked;

      if not found then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      if v_hour_bucket.reserved_units < v_cost.reserved_units
        or v_day_bucket.reserved_units < v_cost.reserved_units then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      select
        count(*)::integer,
        count(*) filter (where locked_entitlements.status = 'reserved')::integer,
        count(*) filter (where locked_entitlements.scope = 'session')::integer,
        count(*) filter (where locked_entitlements.scope = 'device')::integer
      into
        v_entitlement_count,
        v_reserved_entitlement_count,
        v_session_entitlement_count,
        v_device_entitlement_count
      from (
        select entitlement.status, entitlement.scope
        from public.homepage_demo_trial_entitlements as entitlement
        where entitlement.attempt_id = v_attempt.id
        order by entitlement.scope asc, entitlement.id asc
        for update of entitlement skip locked
      ) as locked_entitlements;

      if v_entitlement_count <> 2
        or v_reserved_entitlement_count <> 2
        or v_session_entitlement_count <> 1
        or v_device_entitlement_count <> 1 then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
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
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      if (v_attempt.status = 'admitted' and v_provider_started)
        or (v_attempt.status = 'processing' and not v_provider_started)
        or v_attempt.provider_call_completed_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      v_expected_trial_status :=
        case v_attempt.status
          when 'admitted' then 'queued'
          when 'processing' then 'processing'
        end;

      if v_trial.status <> v_expected_trial_status
        or v_trial.risk_state <> 'allowed' then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      if v_provider_started then
        update public.homepage_demo_cost_buckets as bucket
        set
          reserved_units = bucket.reserved_units - v_cost.reserved_units,
          spent_units = bucket.spent_units + v_cost.reserved_units
        where bucket.id = v_cost.hour_bucket_id
          and bucket.window_kind = 'hour'
          and bucket.reserved_units >= v_cost.reserved_units;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        update public.homepage_demo_cost_buckets as bucket
        set
          reserved_units = bucket.reserved_units - v_cost.reserved_units,
          spent_units = bucket.spent_units + v_cost.reserved_units
        where bucket.id = v_cost.day_bucket_id
          and bucket.window_kind = 'day'
          and bucket.reserved_units >= v_cost.reserved_units;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
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
          and cost.expired_at is null;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        v_candidate_finalized_cost := 1;
      else
        update public.homepage_demo_cost_buckets as bucket
        set reserved_units = bucket.reserved_units - v_cost.reserved_units
        where bucket.id = v_cost.hour_bucket_id
          and bucket.window_kind = 'hour'
          and bucket.reserved_units >= v_cost.reserved_units;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        update public.homepage_demo_cost_buckets as bucket
        set reserved_units = bucket.reserved_units - v_cost.reserved_units
        where bucket.id = v_cost.day_bucket_id
          and bucket.window_kind = 'day'
          and bucket.reserved_units >= v_cost.reserved_units;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
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
          and cost.expired_at is null;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        v_candidate_released_cost := 1;
      end if;

      update public.homepage_demo_capacity_reservations as capacity
      set
        status = 'expired',
        released_at = null,
        expired_at = v_now
      where capacity.id = v_capacity.id
        and capacity.status = 'active'
        and capacity.lease_expires_at <= v_now
        and capacity.released_at is null
        and capacity.expired_at is null;

      get diagnostics v_row_count = row_count;

      if v_row_count <> 1 then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      update public.homepage_demo_trial_entitlements as entitlement
      set
        status = 'expired',
        trial_id = null,
        consumed_at = null,
        released_at = null
      where entitlement.attempt_id = v_attempt.id
        and entitlement.status = 'reserved'
        and entitlement.trial_id is null
        and entitlement.consumed_at is null
        and entitlement.released_at is null;

      get diagnostics v_candidate_entitlements = row_count;

      if v_candidate_entitlements <> 2 then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      if v_provider_started then
        update public.homepage_demo_admission_attempts as attempt
        set
          status = 'failed',
          decision_code = 'processing_lease_expired',
          provider_call_completed_at = v_now
        where attempt.id = v_attempt.id
          and attempt.status = 'processing'
          and attempt.decision_code is null
          and attempt.provider_call_started_at is not null
          and attempt.provider_call_completed_at is null
          and attempt.review_ready_at is null;
      else
        update public.homepage_demo_admission_attempts as attempt
        set
          status = 'failed',
          decision_code = 'processing_lease_expired'
        where attempt.id = v_attempt.id
          and attempt.status = 'admitted'
          and attempt.decision_code is null
          and attempt.provider_call_started_at is null
          and attempt.provider_call_completed_at is null
          and attempt.review_ready_at is null;
      end if;

      get diagnostics v_row_count = row_count;

      if v_row_count <> 1 then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      if v_trial.expires_at <= v_now then
        update public.homepage_demo_trials as trial
        set
          status = 'expired',
          failure_code = null
        where trial.id = v_trial.id
          and trial.status = v_expected_trial_status
          and trial.claimed_by_user_id is null
          and trial.claimed_at is null;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        v_candidate_expired_trial := 1;
      else
        update public.homepage_demo_trials as trial
        set
          status = 'failed',
          failure_code = 'processing_lease_expired'
        where trial.id = v_trial.id
          and trial.status = v_expected_trial_status
          and trial.claimed_by_user_id is null
          and trial.claimed_at is null;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        v_candidate_failed_trial := 1;
      end if;

      recovered_attempts := recovered_attempts + 1;
      failed_attempts := failed_attempts + 1;
      expired_trials := expired_trials + v_candidate_expired_trial;
      failed_trials := failed_trials + v_candidate_failed_trial;
      expired_capacities := expired_capacities + 1;
      released_cost_reservations :=
        released_cost_reservations + v_candidate_released_cost;
      finalized_cost_reservations :=
        finalized_cost_reservations + v_candidate_finalized_cost;
      expired_or_released_entitlements :=
        expired_or_released_entitlements + v_candidate_entitlements;
    exception
      when raise_exception then
        get stacked diagnostics v_exception_message = message_text;

        if v_exception_message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT' then
          conflicts_skipped := conflicts_skipped + 1;
        else
          raise;
        end if;
    end;
  end loop;

  return next;
end;
$$;

create or replace function public.purge_homepage_demo_retention(
  p_limit integer default 1000
)
returns table (
  purged_trials integer,
  deleted_entitlements integer,
  deleted_attempts integer,
  deleted_rate_buckets integer,
  deleted_capacity_reservations integer,
  deleted_cost_reservations integer,
  deleted_cost_buckets integer
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_limit integer := coalesce(p_limit, 1000);
begin
  if v_limit <= 0 then
    v_limit := 1000;
  end if;

  if v_limit > 1000 then
    v_limit := 1000;
  end if;

  purged_trials := 0;
  deleted_entitlements := 0;
  deleted_attempts := 0;
  deleted_rate_buckets := 0;
  deleted_capacity_reservations := 0;
  deleted_cost_reservations := 0;
  deleted_cost_buckets := 0;

  -- p_limit is applied independently to each cleanup category.
  with selected_trials as (
    select trial.id
    from public.homepage_demo_trials as trial
    where trial.expires_at <= v_now
      and trial.status <> 'claimed'
      and trial.claimed_by_user_id is null
      and trial.claimed_at is null
      and not exists (
        select 1
        from public.homepage_demo_admission_attempts as attempt
        where attempt.trial_id = trial.id
          and attempt.status in ('admitted', 'processing')
      )
    order by trial.expires_at asc, trial.id asc
    limit v_limit
    for update of trial skip locked
  ),
  deleted_trials as (
    delete from public.homepage_demo_trials as trial
    using selected_trials
    where trial.id = selected_trials.id
    returning trial.id
  )
  select count(*)::integer
  into purged_trials
  from deleted_trials;

  with selected_entitlements as (
    select entitlement.id
    from public.homepage_demo_trial_entitlements as entitlement
    where entitlement.status in ('released', 'expired')
      and entitlement.expires_at <= v_now
      and not exists (
        select 1
        from public.homepage_demo_admission_attempts as attempt
        where attempt.id = entitlement.attempt_id
          and attempt.status in ('admitted', 'processing')
      )
      and not exists (
        select 1
        from public.homepage_demo_trials as trial
        where trial.id = entitlement.trial_id
          and (
            trial.expires_at > v_now
            or trial.status = 'claimed'
            or trial.claimed_by_user_id is not null
            or trial.claimed_at is not null
          )
      )
    order by entitlement.expires_at asc, entitlement.id asc
    limit v_limit
    for update of entitlement skip locked
  ),
  deleted_terminal_entitlements as (
    delete from public.homepage_demo_trial_entitlements as entitlement
    using selected_entitlements
    where entitlement.id = selected_entitlements.id
    returning entitlement.id
  )
  select count(*)::integer
  into deleted_entitlements
  from deleted_terminal_entitlements;

  with selected_capacity_reservations as (
    select capacity.id
    from public.homepage_demo_capacity_reservations as capacity
    where capacity.status in ('released', 'expired')
      and capacity.retention_expires_at <= v_now
      and not exists (
        select 1
        from public.homepage_demo_admission_attempts as attempt
        where attempt.id = capacity.attempt_id
          and attempt.status in ('admitted', 'processing')
      )
    order by capacity.retention_expires_at asc, capacity.id asc
    limit v_limit
    for update of capacity skip locked
  ),
  deleted_terminal_capacity as (
    delete from public.homepage_demo_capacity_reservations as capacity
    using selected_capacity_reservations
    where capacity.id = selected_capacity_reservations.id
    returning capacity.id
  )
  select count(*)::integer
  into deleted_capacity_reservations
  from deleted_terminal_capacity;

  with selected_cost_reservations as (
    select cost.id
    from public.homepage_demo_cost_reservations as cost
    where cost.status in ('finalized', 'released', 'expired')
      and cost.retention_expires_at <= v_now
      and not exists (
        select 1
        from public.homepage_demo_admission_attempts as attempt
        where attempt.id = cost.attempt_id
          and attempt.status in ('admitted', 'processing')
      )
    order by cost.retention_expires_at asc, cost.id asc
    limit v_limit
    for update of cost skip locked
  ),
  deleted_terminal_costs as (
    delete from public.homepage_demo_cost_reservations as cost
    using selected_cost_reservations
    where cost.id = selected_cost_reservations.id
    returning cost.id
  )
  select count(*)::integer
  into deleted_cost_reservations
  from deleted_terminal_costs;

  with selected_rate_buckets as (
    select bucket.id
    from public.homepage_demo_rate_limit_buckets as bucket
    where bucket.expires_at <= v_now
    order by bucket.expires_at asc, bucket.id asc
    limit v_limit
    for update of bucket skip locked
  ),
  deleted_rates as (
    delete from public.homepage_demo_rate_limit_buckets as bucket
    using selected_rate_buckets
    where bucket.id = selected_rate_buckets.id
    returning bucket.id
  )
  select count(*)::integer
  into deleted_rate_buckets
  from deleted_rates;

  with selected_attempts as (
    select attempt.id
    from public.homepage_demo_admission_attempts as attempt
    where attempt.status in (
        'review_ready',
        'failed',
        'blocked',
        'rejected',
        'released',
        'expired'
      )
      and attempt.retention_expires_at <= v_now
      and not exists (
        select 1
        from public.homepage_demo_capacity_reservations as capacity
        where capacity.attempt_id = attempt.id
      )
      and not exists (
        select 1
        from public.homepage_demo_cost_reservations as cost
        where cost.attempt_id = attempt.id
          and cost.status = 'reserved'
      )
      and not exists (
        select 1
        from public.homepage_demo_trial_entitlements as entitlement
        where entitlement.attempt_id = attempt.id
          and entitlement.status in ('reserved', 'consumed')
      )
      and not exists (
        select 1
        from public.homepage_demo_trials as trial
        where trial.id = attempt.trial_id
          and (
            trial.expires_at > v_now
            or trial.status = 'claimed'
            or trial.claimed_by_user_id is not null
            or trial.claimed_at is not null
          )
      )
    order by attempt.retention_expires_at asc, attempt.id asc
    limit v_limit
    for update of attempt skip locked
  ),
  deleted_terminal_attempts as (
    delete from public.homepage_demo_admission_attempts as attempt
    using selected_attempts
    where attempt.id = selected_attempts.id
    returning attempt.id
  )
  select count(*)::integer
  into deleted_attempts
  from deleted_terminal_attempts;

  with selected_cost_buckets as (
    select bucket.id
    from public.homepage_demo_cost_buckets as bucket
    where bucket.expires_at <= v_now
      and bucket.reserved_units = 0
      and not exists (
        select 1
        from public.homepage_demo_cost_reservations as cost
        where cost.hour_bucket_id = bucket.id
          or cost.day_bucket_id = bucket.id
      )
    order by bucket.expires_at asc, bucket.id asc
    limit v_limit
    for update of bucket skip locked
  ),
  deleted_cost_bucket_rows as (
    delete from public.homepage_demo_cost_buckets as bucket
    using selected_cost_buckets
    where bucket.id = selected_cost_buckets.id
    returning bucket.id
  )
  select count(*)::integer
  into deleted_cost_buckets
  from deleted_cost_bucket_rows;

  return next;
end;
$$;

create or replace function public.run_homepage_demo_maintenance(
  p_limit integer default 1000
)
returns table (
  lock_acquired boolean,
  recovered_attempts integer,
  failed_attempts integer,
  expired_trials integer,
  failed_trials integer,
  expired_capacities integer,
  released_cost_reservations integer,
  finalized_cost_reservations integer,
  expired_or_released_entitlements integer,
  conflicts_skipped integer,
  purged_trials integer,
  deleted_entitlements integer,
  deleted_attempts integer,
  deleted_rate_buckets integer,
  deleted_capacity_reservations integer,
  deleted_cost_reservations integer,
  deleted_cost_buckets integer
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_limit integer := coalesce(p_limit, 1000);
  v_lock_key bigint := 250630001501;
begin
  if v_limit <= 0 then
    v_limit := 1000;
  end if;

  if v_limit > 1000 then
    v_limit := 1000;
  end if;

  lock_acquired := pg_try_advisory_xact_lock(v_lock_key);

  recovered_attempts := 0;
  failed_attempts := 0;
  expired_trials := 0;
  failed_trials := 0;
  expired_capacities := 0;
  released_cost_reservations := 0;
  finalized_cost_reservations := 0;
  expired_or_released_entitlements := 0;
  conflicts_skipped := 0;
  purged_trials := 0;
  deleted_entitlements := 0;
  deleted_attempts := 0;
  deleted_rate_buckets := 0;
  deleted_capacity_reservations := 0;
  deleted_cost_reservations := 0;
  deleted_cost_buckets := 0;

  if not lock_acquired then
    return next;
    return;
  end if;

  select
    recovery.recovered_attempts,
    recovery.failed_attempts,
    recovery.expired_trials,
    recovery.failed_trials,
    recovery.expired_capacities,
    recovery.released_cost_reservations,
    recovery.finalized_cost_reservations,
    recovery.expired_or_released_entitlements,
    recovery.conflicts_skipped
  into
    recovered_attempts,
    failed_attempts,
    expired_trials,
    failed_trials,
    expired_capacities,
    released_cost_reservations,
    finalized_cost_reservations,
    expired_or_released_entitlements,
    conflicts_skipped
  from public.recover_stale_homepage_demo_processing(v_limit) as recovery;

  select
    retention.purged_trials,
    retention.deleted_entitlements,
    retention.deleted_attempts,
    retention.deleted_rate_buckets,
    retention.deleted_capacity_reservations,
    retention.deleted_cost_reservations,
    retention.deleted_cost_buckets
  into
    purged_trials,
    deleted_entitlements,
    deleted_attempts,
    deleted_rate_buckets,
    deleted_capacity_reservations,
    deleted_cost_reservations,
    deleted_cost_buckets
  from public.purge_homepage_demo_retention(v_limit) as retention;

  return next;
end;
$$;

revoke all on function public.recover_stale_homepage_demo_processing(integer)
  from public;
revoke all on function public.recover_stale_homepage_demo_processing(integer)
  from anon;
revoke all on function public.recover_stale_homepage_demo_processing(integer)
  from authenticated;
grant execute on function public.recover_stale_homepage_demo_processing(integer)
  to service_role;

revoke all on function public.purge_homepage_demo_retention(integer)
  from public;
revoke all on function public.purge_homepage_demo_retention(integer)
  from anon;
revoke all on function public.purge_homepage_demo_retention(integer)
  from authenticated;
grant execute on function public.purge_homepage_demo_retention(integer)
  to service_role;

revoke all on function public.run_homepage_demo_maintenance(integer)
  from public;
revoke all on function public.run_homepage_demo_maintenance(integer)
  from anon;
revoke all on function public.run_homepage_demo_maintenance(integer)
  from authenticated;
grant execute on function public.run_homepage_demo_maintenance(integer)
  to service_role;

comment on function public.recover_stale_homepage_demo_processing(integer) is
  'Server-only bounded Homepage Demo stale-processing recovery. Returns aggregate counts only, uses service-role execution, and never returns tokens, hashes, identities, client input, draft JSON, provider output, or row identifiers.';

comment on function public.purge_homepage_demo_retention(integer) is
  'Server-only bounded Homepage Demo claimed-safe retention cleanup. Physical trial purge explicitly excludes claimed trials and supersedes the legacy purge_expired_homepage_demo_trials(integer) function for future maintenance use. Returns aggregate counts only and permits no browser execution.';

comment on function public.run_homepage_demo_maintenance(integer) is
  'Server-only bounded Homepage Demo maintenance runner. Uses a transaction-level advisory lock, recovers stale processing before claimed-safe retention cleanup, returns aggregate counts only, and permits no browser execution.';
