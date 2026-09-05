-- Text2Task Homepage Demo Admission RPCs
-- Migration: 202606280004_homepage_demo_admission_rpc.sql
-- Created: 2026-06-28
--
-- Server-only admission and challenge-failure accounting for the future
-- homepage live demo. This migration does not enable the demo and does not
-- expose browser-accessible table privileges or public routes.

create or replace function public.admit_homepage_demo_trial(
  p_public_token_hash text,
  p_session_token_hash text,
  p_device_token_hash text,
  p_ip_identity_digest text,
  p_idempotency_key_hash text,
  p_capacity_lease_token_hash text,
  p_input_type text
)
returns table (
  decision text,
  attempt_id uuid,
  trial_id uuid,
  trial_status text,
  trial_expires_at timestamptz,
  lease_expires_at timestamptz,
  idempotent boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_hash_pattern constant text := '^[0-9a-f]{64}$';
  v_ip_digest_pattern constant text := '^v[1-9][0-9]*:[0-9a-f]{64}$';
  v_now timestamptz := pg_catalog.now();
  v_hour_window timestamptz := pg_catalog.date_trunc('hour', v_now, 'UTC');
  v_day_window timestamptz := pg_catalog.date_trunc('day', v_now, 'UTC');
  v_config public.homepage_demo_admission_config%rowtype;
  v_attempt public.homepage_demo_admission_attempts%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_trial_found boolean := false;
  v_existing_lease_expires_at timestamptz;
  v_requested_units integer;
  v_session_count integer;
  v_device_count integer;
  v_ip_hour_count integer;
  v_ip_day_count integer;
  v_rejection_decision text;
  v_rejected_attempt_id uuid;
  v_active_global_units integer;
  v_active_workload_units integer;
  v_hour_bucket_id uuid;
  v_day_bucket_id uuid;
  v_hour_reserved_units integer;
  v_hour_spent_units integer;
  v_day_reserved_units integer;
  v_day_spent_units integer;
  v_trial_id uuid;
  v_trial_status text;
  v_trial_risk_state text;
  v_trial_expires_at timestamptz;
  v_trial_created boolean;
  v_transition_changed boolean;
  v_attempt_id uuid;
  v_lease_expires_at timestamptz;
  v_constraint_name text;
  v_exception_message text;
begin
  if p_public_token_hash is null
    or p_public_token_hash !~ v_hash_pattern
    or p_session_token_hash is null
    or p_session_token_hash !~ v_hash_pattern
    or p_device_token_hash is null
    or p_device_token_hash !~ v_hash_pattern
    or p_idempotency_key_hash is null
    or p_idempotency_key_hash !~ v_hash_pattern
    or p_capacity_lease_token_hash is null
    or p_capacity_lease_token_hash !~ v_hash_pattern
    or p_ip_identity_digest is null
    or p_ip_identity_digest !~ v_ip_digest_pattern
    or p_input_type is null
    or p_input_type not in ('text', 'image') then
    raise exception using
      errcode = '22023',
      message = 'HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT';
  end if;

  select config.*
  into v_config
  from public.homepage_demo_admission_config as config
  where config.id = 1
  for update of config;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_ADMISSION_CONFIG_MISSING';
  end if;

  if not v_config.admission_enabled then
    return query
      select
        'demo_disabled'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::timestamptz,
        null::timestamptz,
        false;
    return;
  end if;

  if (p_input_type = 'text' and not v_config.text_enabled)
    or (p_input_type = 'image' and not v_config.image_enabled) then
    return query
      select
        'workload_disabled'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::timestamptz,
        null::timestamptz,
        false;
    return;
  end if;

  v_requested_units := case
    when p_input_type = 'text' then v_config.text_cost_units
    else v_config.image_cost_units
  end;

  select attempt.*
  into v_attempt
  from public.homepage_demo_admission_attempts as attempt
  where attempt.idempotency_key_hash = p_idempotency_key_hash
  for update of attempt;

  if found then
    if v_attempt.session_token_hash <> p_session_token_hash
      or v_attempt.device_token_hash <> p_device_token_hash
      or v_attempt.ip_identity_digest <> p_ip_identity_digest
      or v_attempt.input_type <> p_input_type then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_IDEMPOTENCY_CONFLICT';
    end if;

    v_trial_found := false;
    if v_attempt.trial_id is not null then
      select trial.*
      into v_trial
      from public.homepage_demo_trials as trial
      where trial.id = v_attempt.trial_id;

      v_trial_found := found;

      if v_trial_found and v_trial.public_token_hash <> p_public_token_hash then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_ADMISSION_IDEMPOTENCY_CONFLICT';
      end if;
    end if;

    v_existing_lease_expires_at := null;
    select capacity.lease_expires_at
    into v_existing_lease_expires_at
    from public.homepage_demo_capacity_reservations as capacity
    where capacity.attempt_id = v_attempt.id
      and capacity.status = 'active'
    order by capacity.created_at desc
    limit 1;

    if v_attempt.status in ('admitted', 'processing') then
      return query
        select
          'admitted'::text,
          v_attempt.id,
          case when v_trial_found then v_trial.id else null::uuid end,
          case when v_trial_found then v_trial.status else null::text end,
          case when v_trial_found then v_trial.expires_at else null::timestamptz end,
          v_existing_lease_expires_at,
          true;
      return;
    end if;

    if v_attempt.status = 'review_ready' then
      return query
        select
          'review_ready'::text,
          v_attempt.id,
          case when v_trial_found then v_trial.id else null::uuid end,
          case when v_trial_found then v_trial.status else null::text end,
          case when v_trial_found then v_trial.expires_at else null::timestamptz end,
          null::timestamptz,
          true;
      return;
    end if;

    if v_attempt.status = 'rejected' then
      if v_attempt.decision_code is null
        or v_attempt.decision_code not in (
          'rate_limited',
          'trial_already_used',
          'capacity_unavailable',
          'budget_unavailable'
        ) then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
      end if;

      return query
        select
          v_attempt.decision_code,
          v_attempt.id,
          null::uuid,
          null::text,
          null::timestamptz,
          null::timestamptz,
          true;
      return;
    end if;

    if v_attempt.status = 'failed' then
      return query
        select
          'processing_failed'::text,
          v_attempt.id,
          case when v_trial_found then v_trial.id else null::uuid end,
          case when v_trial_found then v_trial.status else null::text end,
          case when v_trial_found then v_trial.expires_at else null::timestamptz end,
          null::timestamptz,
          true;
      return;
    end if;

    if v_attempt.status = 'blocked' then
      return query
        select
          'trial_unavailable'::text,
          v_attempt.id,
          case when v_trial_found then v_trial.id else null::uuid end,
          case when v_trial_found then v_trial.status else null::text end,
          case when v_trial_found then v_trial.expires_at else null::timestamptz end,
          null::timestamptz,
          true;
      return;
    end if;

    return query
      select
        'expired'::text,
        v_attempt.id,
        case when v_trial_found then v_trial.id else null::uuid end,
        case when v_trial_found then v_trial.status else null::text end,
        case when v_trial_found then v_trial.expires_at else null::timestamptz end,
        null::timestamptz,
        true;
    return;
  end if;

  insert into public.homepage_demo_rate_limit_buckets as bucket (
    scope,
    action,
    identity_digest,
    window_start,
    window_seconds,
    request_count,
    expires_at
  )
  values (
    'session',
    'admission',
    p_session_token_hash,
    v_hour_window,
    3600,
    1,
    v_hour_window + interval '1 hour' + (v_config.rate_bucket_retention_seconds * interval '1 second')
  )
  on conflict (scope, action, identity_digest, window_start, window_seconds)
  do update set
    request_count = bucket.request_count + 1,
    expires_at = greatest(bucket.expires_at, excluded.expires_at)
  returning bucket.request_count into v_session_count;

  insert into public.homepage_demo_rate_limit_buckets as bucket (
    scope,
    action,
    identity_digest,
    window_start,
    window_seconds,
    request_count,
    expires_at
  )
  values (
    'device',
    'admission',
    p_device_token_hash,
    v_day_window,
    86400,
    1,
    v_day_window + interval '1 day' + (v_config.rate_bucket_retention_seconds * interval '1 second')
  )
  on conflict (scope, action, identity_digest, window_start, window_seconds)
  do update set
    request_count = bucket.request_count + 1,
    expires_at = greatest(bucket.expires_at, excluded.expires_at)
  returning bucket.request_count into v_device_count;

  insert into public.homepage_demo_rate_limit_buckets as bucket (
    scope,
    action,
    identity_digest,
    window_start,
    window_seconds,
    request_count,
    expires_at
  )
  values (
    'ip',
    'admission',
    p_ip_identity_digest,
    v_hour_window,
    3600,
    1,
    v_hour_window + interval '1 hour' + (v_config.rate_bucket_retention_seconds * interval '1 second')
  )
  on conflict (scope, action, identity_digest, window_start, window_seconds)
  do update set
    request_count = bucket.request_count + 1,
    expires_at = greatest(bucket.expires_at, excluded.expires_at)
  returning bucket.request_count into v_ip_hour_count;

  insert into public.homepage_demo_rate_limit_buckets as bucket (
    scope,
    action,
    identity_digest,
    window_start,
    window_seconds,
    request_count,
    expires_at
  )
  values (
    'ip',
    'admission',
    p_ip_identity_digest,
    v_day_window,
    86400,
    1,
    v_day_window + interval '1 day' + (v_config.rate_bucket_retention_seconds * interval '1 second')
  )
  on conflict (scope, action, identity_digest, window_start, window_seconds)
  do update set
    request_count = bucket.request_count + 1,
    expires_at = greatest(bucket.expires_at, excluded.expires_at)
  returning bucket.request_count into v_ip_day_count;

  if v_session_count > v_config.session_attempt_limit
    or v_device_count > v_config.device_attempt_limit
    or v_ip_hour_count > v_config.ip_hour_attempt_limit
    or v_ip_day_count > v_config.ip_day_attempt_limit then
    v_rejection_decision := 'rate_limited';
  end if;

  update public.homepage_demo_trial_entitlements as entitlement
  set
    status = 'expired',
    trial_id = null,
    consumed_at = null,
    released_at = null
  where (
      (
        entitlement.scope = 'session'
        and entitlement.identity_digest = p_session_token_hash
      )
      or (
        entitlement.scope = 'device'
        and entitlement.identity_digest = p_device_token_hash
      )
    )
    and entitlement.status = 'reserved'
    and (
      entitlement.reservation_expires_at <= v_now
      or entitlement.expires_at <= v_now
    );

  update public.homepage_demo_trial_entitlements as entitlement
  set
    status = 'expired',
    trial_id = null,
    consumed_at = null,
    released_at = null
  where (
      (
        entitlement.scope = 'session'
        and entitlement.identity_digest = p_session_token_hash
      )
      or (
        entitlement.scope = 'device'
        and entitlement.identity_digest = p_device_token_hash
      )
    )
    and entitlement.status = 'consumed'
    and entitlement.expires_at <= v_now;

  if v_rejection_decision is null then
    perform 1
    from public.homepage_demo_trial_entitlements as entitlement
    where (
        (
          entitlement.scope = 'session'
          and entitlement.identity_digest = p_session_token_hash
        )
        or (
          entitlement.scope = 'device'
          and entitlement.identity_digest = p_device_token_hash
        )
      )
      and entitlement.status in ('reserved', 'consumed')
    order by entitlement.created_at
    limit 1
    for update of entitlement;

    if found then
      v_rejection_decision := 'trial_already_used';
    end if;
  end if;

  if v_rejection_decision is null then
    select coalesce(sum(capacity.reserved_units), 0)::integer
    into v_active_global_units
    from public.homepage_demo_capacity_reservations as capacity
    where capacity.status = 'active'
      and capacity.lease_expires_at > v_now;

    select coalesce(sum(capacity.reserved_units), 0)::integer
    into v_active_workload_units
    from public.homepage_demo_capacity_reservations as capacity
    where capacity.status = 'active'
      and capacity.workload_type = p_input_type
      and capacity.lease_expires_at > v_now;

    if v_active_global_units + 1 > v_config.global_concurrency_limit
      or (
        p_input_type = 'text'
        and v_active_workload_units + 1 > v_config.text_concurrency_limit
      )
      or (
        p_input_type = 'image'
        and v_active_workload_units + 1 > v_config.image_concurrency_limit
      ) then
      v_rejection_decision := 'capacity_unavailable';
    end if;
  end if;

  if v_rejection_decision is null then
    insert into public.homepage_demo_cost_buckets as bucket (
      window_kind,
      window_start,
      window_seconds,
      reserved_units,
      spent_units,
      expires_at
    )
    values (
      'hour',
      v_hour_window,
      3600,
      0,
      0,
      v_hour_window + interval '1 hour' + (v_config.cost_accounting_retention_seconds * interval '1 second')
    )
    on conflict (window_kind, window_start)
    do update set
      expires_at = greatest(bucket.expires_at, excluded.expires_at)
    returning
      bucket.id,
      bucket.reserved_units,
      bucket.spent_units
    into
      v_hour_bucket_id,
      v_hour_reserved_units,
      v_hour_spent_units;

    insert into public.homepage_demo_cost_buckets as bucket (
      window_kind,
      window_start,
      window_seconds,
      reserved_units,
      spent_units,
      expires_at
    )
    values (
      'day',
      v_day_window,
      86400,
      0,
      0,
      v_day_window + interval '1 day' + (v_config.cost_accounting_retention_seconds * interval '1 second')
    )
    on conflict (window_kind, window_start)
    do update set
      expires_at = greatest(bucket.expires_at, excluded.expires_at)
    returning
      bucket.id,
      bucket.reserved_units,
      bucket.spent_units
    into
      v_day_bucket_id,
      v_day_reserved_units,
      v_day_spent_units;

    if v_hour_reserved_units + v_hour_spent_units + v_requested_units > v_config.hourly_budget_units
      or v_day_reserved_units + v_day_spent_units + v_requested_units > v_config.daily_budget_units then
      v_rejection_decision := 'budget_unavailable';
    end if;
  end if;

  if v_rejection_decision is not null then
    insert into public.homepage_demo_admission_attempts (
      idempotency_key_hash,
      trial_id,
      session_token_hash,
      device_token_hash,
      ip_identity_digest,
      input_type,
      status,
      decision_code,
      estimated_cost_units,
      retention_expires_at
    )
    values (
      p_idempotency_key_hash,
      null,
      p_session_token_hash,
      p_device_token_hash,
      p_ip_identity_digest,
      p_input_type,
      'rejected',
      v_rejection_decision,
      v_requested_units,
      v_now + (v_config.admission_attempt_retention_seconds * interval '1 second')
    )
    returning id into v_rejected_attempt_id;

    return query
      select
        v_rejection_decision,
        v_rejected_attempt_id,
        null::uuid,
        null::text,
        null::timestamptz,
        null::timestamptz,
        false;
    return;
  end if;

  v_lease_expires_at := v_now + (v_config.processing_lease_seconds * interval '1 second');

  begin
    select created_trial.trial_id,
      created_trial.status,
      created_trial.risk_state,
      created_trial.expires_at,
      created_trial.created
    into
      v_trial_id,
      v_trial_status,
      v_trial_risk_state,
      v_trial_expires_at,
      v_trial_created
    from public.create_homepage_demo_trial(
      p_public_token_hash,
      p_session_token_hash,
      p_idempotency_key_hash,
      p_input_type,
      v_now + (v_config.trial_ttl_seconds * interval '1 second')
    ) as created_trial;

    if not v_trial_created then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
    end if;

    select validating_trial.trial_id,
      validating_trial.status,
      validating_trial.risk_state,
      validating_trial.expires_at,
      validating_trial.changed
    into
      v_trial_id,
      v_trial_status,
      v_trial_risk_state,
      v_trial_expires_at,
      v_transition_changed
    from public.advance_homepage_demo_trial(
      v_trial_id,
      'created',
      'validating',
      'allowed'
    ) as validating_trial;

    if not v_transition_changed then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
    end if;

    select queued_trial.trial_id,
      queued_trial.status,
      queued_trial.risk_state,
      queued_trial.expires_at,
      queued_trial.changed
    into
      v_trial_id,
      v_trial_status,
      v_trial_risk_state,
      v_trial_expires_at,
      v_transition_changed
    from public.advance_homepage_demo_trial(
      v_trial_id,
      'validating',
      'queued',
      'allowed'
    ) as queued_trial;

    if not v_transition_changed
      or v_trial_status <> 'queued'
      or v_trial_risk_state <> 'allowed' then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
    end if;

    insert into public.homepage_demo_admission_attempts (
      idempotency_key_hash,
      trial_id,
      session_token_hash,
      device_token_hash,
      ip_identity_digest,
      input_type,
      status,
      decision_code,
      estimated_cost_units,
      retention_expires_at
    )
    values (
      p_idempotency_key_hash,
      v_trial_id,
      p_session_token_hash,
      p_device_token_hash,
      p_ip_identity_digest,
      p_input_type,
      'admitted',
      null,
      v_requested_units,
      v_now + (v_config.admission_attempt_retention_seconds * interval '1 second')
    )
    returning id into v_attempt_id;

    insert into public.homepage_demo_trial_entitlements (
      attempt_id,
      trial_id,
      scope,
      identity_digest,
      status,
      reservation_expires_at,
      expires_at
    )
    values
      (
        v_attempt_id,
        null,
        'session',
        p_session_token_hash,
        'reserved',
        v_lease_expires_at,
        v_now + (v_config.session_entitlement_seconds * interval '1 second')
      ),
      (
        v_attempt_id,
        null,
        'device',
        p_device_token_hash,
        'reserved',
        v_lease_expires_at,
        v_now + (v_config.device_entitlement_seconds * interval '1 second')
      );

    insert into public.homepage_demo_capacity_reservations (
      attempt_id,
      workload_type,
      lease_token_hash,
      reserved_units,
      status,
      lease_expires_at,
      retention_expires_at
    )
    values (
      v_attempt_id,
      p_input_type,
      p_capacity_lease_token_hash,
      1,
      'active',
      v_lease_expires_at,
      v_now + (v_config.capacity_reservation_retention_seconds * interval '1 second')
    );

    update public.homepage_demo_cost_buckets as bucket
    set reserved_units = bucket.reserved_units + v_requested_units
    where bucket.id = v_hour_bucket_id
      and bucket.window_kind = 'hour';

    update public.homepage_demo_cost_buckets as bucket
    set reserved_units = bucket.reserved_units + v_requested_units
    where bucket.id = v_day_bucket_id
      and bucket.window_kind = 'day';

    insert into public.homepage_demo_cost_reservations (
      attempt_id,
      hour_bucket_id,
      hour_bucket_kind,
      day_bucket_id,
      day_bucket_kind,
      reserved_units,
      finalized_units,
      status,
      provider_call_started_at,
      finalized_at,
      released_at,
      expired_at,
      retention_expires_at
    )
    values (
      v_attempt_id,
      v_hour_bucket_id,
      'hour',
      v_day_bucket_id,
      'day',
      v_requested_units,
      null,
      'reserved',
      null,
      null,
      null,
      null,
      v_now + (v_config.cost_accounting_retention_seconds * interval '1 second')
    );
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name = 'homepage_demo_capacity_reservations_lease_unique' then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_ADMISSION_TOKEN_COLLISION';
      end if;

      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
    when check_violation or foreign_key_violation or not_null_violation then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
    when raise_exception then
      get stacked diagnostics v_exception_message = message_text;

      if v_exception_message = 'HOMEPAGE_DEMO_TOKEN_HASH_COLLISION' then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_ADMISSION_TOKEN_COLLISION';
      end if;

      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
    when others then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_REPOSITORY_UNAVAILABLE';
  end;

  return query
    select
      'admitted'::text,
      v_attempt_id,
      v_trial_id,
      v_trial_status,
      v_trial_expires_at,
      v_lease_expires_at,
      false;
exception
  when others then
    get stacked diagnostics v_exception_message = message_text;

    if v_exception_message = 'HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT' then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_ADMISSION_CONFIG_MISSING',
      'HOMEPAGE_DEMO_ADMISSION_IDEMPOTENCY_CONFLICT',
      'HOMEPAGE_DEMO_ADMISSION_TOKEN_COLLISION',
      'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT',
      'HOMEPAGE_DEMO_ADMISSION_REPOSITORY_UNAVAILABLE'
    ) then
      raise exception using
        errcode = 'P0001',
        message = v_exception_message;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_ADMISSION_REPOSITORY_UNAVAILABLE';
end;
$$;

create or replace function public.record_homepage_demo_challenge_failure(
  p_ip_identity_digest text
)
returns table (
  decision text,
  blocked boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_ip_digest_pattern constant text := '^v[1-9][0-9]*:[0-9a-f]{64}$';
  v_now timestamptz := pg_catalog.now();
  v_hour_window timestamptz := pg_catalog.date_trunc('hour', v_now, 'UTC');
  v_config public.homepage_demo_admission_config%rowtype;
  v_challenge_count integer;
  v_exception_message text;
begin
  if p_ip_identity_digest is null
    or p_ip_identity_digest !~ v_ip_digest_pattern then
    raise exception using
      errcode = '22023',
      message = 'HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT';
  end if;

  select config.*
  into v_config
  from public.homepage_demo_admission_config as config
  where config.id = 1
  for update of config;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_ADMISSION_CONFIG_MISSING';
  end if;

  if not v_config.admission_enabled then
    return query
      select
        'demo_disabled'::text,
        false;
    return;
  end if;

  if not v_config.challenge_required then
    return query
      select
        'challenge_not_required'::text,
        false;
    return;
  end if;

  insert into public.homepage_demo_rate_limit_buckets as bucket (
    scope,
    action,
    identity_digest,
    window_start,
    window_seconds,
    request_count,
    expires_at
  )
  values (
    'ip',
    'challenge_failure',
    p_ip_identity_digest,
    v_hour_window,
    3600,
    1,
    v_hour_window + interval '1 hour' + (v_config.rate_bucket_retention_seconds * interval '1 second')
  )
  on conflict (scope, action, identity_digest, window_start, window_seconds)
  do update set
    request_count = bucket.request_count + 1,
    expires_at = greatest(bucket.expires_at, excluded.expires_at)
  returning bucket.request_count into v_challenge_count;

  if v_challenge_count > v_config.challenge_failure_limit then
    return query
      select
        'rate_limited'::text,
        true;
    return;
  end if;

  return query
    select
      'challenge_failed'::text,
      false;
exception
  when others then
    get stacked diagnostics v_exception_message = message_text;

    if v_exception_message = 'HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT' then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_ADMISSION_CONFIG_MISSING',
      'HOMEPAGE_DEMO_ADMISSION_REPOSITORY_UNAVAILABLE'
    ) then
      raise exception using
        errcode = 'P0001',
        message = v_exception_message;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_ADMISSION_REPOSITORY_UNAVAILABLE';
end;
$$;

revoke all on function public.admit_homepage_demo_trial(
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;
revoke all on function public.admit_homepage_demo_trial(
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from anon;
revoke all on function public.admit_homepage_demo_trial(
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from authenticated;
grant execute on function public.admit_homepage_demo_trial(
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;

revoke all on function public.record_homepage_demo_challenge_failure(text)
from public;
revoke all on function public.record_homepage_demo_challenge_failure(text)
from anon;
revoke all on function public.record_homepage_demo_challenge_failure(text)
from authenticated;
grant execute on function public.record_homepage_demo_challenge_failure(text)
to service_role;
