-- Text2Task Homepage Demo Trial Lifecycle
-- Migration: 202606270004_homepage_demo_trial_lifecycle.sql
-- Created: 2026-06-27
--
-- Service-role-only lifecycle RPCs for future homepage live demo trials.
-- These functions accept token hashes only, never raw browser-visible tokens,
-- and never return token hashes, draft JSON, customer input, or model output.

create or replace function public.create_homepage_demo_trial(
  p_public_token_hash text,
  p_session_token_hash text,
  p_idempotency_key_hash text,
  p_input_type text,
  p_expires_at timestamptz
)
returns table (
  trial_id uuid,
  status text,
  risk_state text,
  expires_at timestamptz,
  created boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
begin
  if p_public_token_hash is null
    or p_public_token_hash !~ '^[0-9a-f]{64}$'
    or p_session_token_hash is null
    or p_session_token_hash !~ '^[0-9a-f]{64}$'
    or p_idempotency_key_hash is null
    or p_idempotency_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_TOKEN_HASH';
  end if;

  if p_input_type is null or p_input_type not in ('text', 'image') then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_INPUT_TYPE';
  end if;

  if p_expires_at is null or p_expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_EXPIRY';
  end if;

  begin
    insert into public.homepage_demo_trials (
      public_token_hash,
      session_token_hash,
      idempotency_key_hash,
      input_type,
      status,
      risk_state,
      expires_at
    )
    values (
      p_public_token_hash,
      p_session_token_hash,
      p_idempotency_key_hash,
      p_input_type,
      'created',
      'not_evaluated',
      p_expires_at
    )
    on conflict (idempotency_key_hash) do nothing
    returning * into v_trial;
  exception
    when unique_violation then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_TOKEN_HASH_COLLISION';
  end;

  if v_trial.id is not null then
    return query
      select
        v_trial.id,
        v_trial.status,
        v_trial.risk_state,
        v_trial.expires_at,
        true;
    return;
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.idempotency_key_hash = p_idempotency_key_hash
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_IDEMPOTENCY_CONFLICT';
  end if;

  if v_trial.public_token_hash <> p_public_token_hash
    or v_trial.session_token_hash <> p_session_token_hash
    or v_trial.input_type <> p_input_type then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_IDEMPOTENCY_CONFLICT';
  end if;

  return query
    select
      v_trial.id,
      v_trial.status,
      v_trial.risk_state,
      v_trial.expires_at,
      false;
end;
$$;

create or replace function public.advance_homepage_demo_trial(
  p_trial_id uuid,
  p_expected_status text,
  p_next_status text,
  p_next_risk_state text default null
)
returns table (
  trial_id uuid,
  status text,
  risk_state text,
  expires_at timestamptz,
  changed boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
  v_next_risk_state text;
begin
  if p_trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_TRIAL_ID';
  end if;

  if not (
    (p_expected_status = 'created' and p_next_status = 'validating')
    or (p_expected_status = 'validating' and p_next_status = 'queued')
    or (p_expected_status = 'queued' and p_next_status = 'processing')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_TRANSITION';
  end if;

  if p_next_risk_state is not null
    and p_next_risk_state not in (
      'not_evaluated',
      'allowed',
      'challenge_required'
    ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_RISK_STATE';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = p_trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_NOT_FOUND';
  end if;

  if v_trial.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_EXPIRED';
  end if;

  if v_trial.status <> p_expected_status then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRANSITION_CONFLICT';
  end if;

  if v_trial.status not in ('created', 'validating', 'queued') then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TERMINAL_STATE';
  end if;

  if v_trial.risk_state = 'blocked' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_RISK_BLOCKED';
  end if;

  v_next_risk_state := coalesce(p_next_risk_state, v_trial.risk_state);

  if p_next_status = 'processing' and v_next_risk_state <> 'allowed' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_RISK_NOT_ALLOWED';
  end if;

  update public.homepage_demo_trials as trial
  set
    status = p_next_status,
    risk_state = v_next_risk_state
  where trial.id = v_trial.id
  returning trial.* into v_trial;

  return query
    select
      v_trial.id,
      v_trial.status,
      v_trial.risk_state,
      v_trial.expires_at,
      true;
end;
$$;

create or replace function public.complete_homepage_demo_trial(
  p_trial_id uuid,
  p_normalized_result jsonb,
  p_schema_version text,
  p_engine_version text
)
returns table (
  trial_id uuid,
  draft_id uuid,
  trial_status text,
  draft_status text,
  expires_at timestamptz,
  created boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_schema_version text := btrim(coalesce(p_schema_version, ''));
  v_engine_version text := btrim(coalesce(p_engine_version, ''));
begin
  if p_trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_TRIAL_ID';
  end if;

  if p_normalized_result is null
    or jsonb_typeof(p_normalized_result) <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_RESULT';
  end if;

  if char_length(v_schema_version) not between 1 and 80
    or v_schema_version !~ '^[A-Za-z0-9_.:-]+$'
    or char_length(v_engine_version) not between 1 and 80
    or v_engine_version !~ '^[A-Za-z0-9_.:-]+$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_VERSION';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = p_trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_NOT_FOUND';
  end if;

  if v_trial.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_EXPIRED';
  end if;

  if v_trial.status = 'review_ready' then
    select draft.*
    into v_draft
    from public.homepage_demo_drafts as draft
    where draft.trial_id = v_trial.id
    for update of draft;

    if found
      and v_draft.status = 'ready'
      and v_draft.schema_version = v_schema_version
      and v_draft.engine_version = v_engine_version
      and v_draft.normalized_result = p_normalized_result
      and v_draft.edited_result is null
      and v_draft.expires_at = v_trial.expires_at then
      return query
        select
          v_trial.id,
          v_draft.id,
          v_trial.status,
          v_draft.status,
          v_trial.expires_at,
          false;
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_COMPLETION_CONFLICT';
  end if;

  if v_trial.status <> 'processing' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_COMPLETION_INVALID_STATE';
  end if;

  if v_trial.risk_state <> 'allowed' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_RISK_NOT_ALLOWED';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.trial_id = v_trial.id
  for update of draft;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_DRAFT_CONFLICT';
  end if;

  insert into public.homepage_demo_drafts (
    trial_id,
    status,
    schema_version,
    engine_version,
    normalized_result,
    edited_result,
    expires_at
  )
  values (
    v_trial.id,
    'ready',
    v_schema_version,
    v_engine_version,
    p_normalized_result,
    null,
    v_trial.expires_at
  )
  returning * into v_draft;

  update public.homepage_demo_trials as trial
  set status = 'review_ready'
  where trial.id = v_trial.id
  returning trial.* into v_trial;

  return query
    select
      v_trial.id,
      v_draft.id,
      v_trial.status,
      v_draft.status,
      v_trial.expires_at,
      true;
end;
$$;

create or replace function public.fail_homepage_demo_trial(
  p_trial_id uuid,
  p_expected_status text,
  p_failure_code text
)
returns table (
  trial_id uuid,
  status text,
  risk_state text,
  expires_at timestamptz,
  changed boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
  v_failure_code text := btrim(coalesce(p_failure_code, ''));
begin
  if p_trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_TRIAL_ID';
  end if;

  if p_expected_status not in (
    'created',
    'validating',
    'queued',
    'processing'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_EXPECTED_STATUS';
  end if;

  if char_length(v_failure_code) = 0
    or char_length(v_failure_code) > 80
    or v_failure_code !~ '^[a-z0-9_:-]+$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_FAILURE_CODE';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = p_trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_NOT_FOUND';
  end if;

  if v_trial.status = 'failed' then
    if v_trial.failure_code = v_failure_code then
      return query
        select
          v_trial.id,
          v_trial.status,
          v_trial.risk_state,
          v_trial.expires_at,
          false;
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_FAILURE_CONFLICT';
  end if;

  if v_trial.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_EXPIRED';
  end if;

  if v_trial.status <> p_expected_status then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_FAILURE_CONFLICT';
  end if;

  update public.homepage_demo_trials as trial
  set
    status = 'failed',
    failure_code = v_failure_code
  where trial.id = v_trial.id
  returning trial.* into v_trial;

  return query
    select
      v_trial.id,
      v_trial.status,
      v_trial.risk_state,
      v_trial.expires_at,
      true;
end;
$$;

create or replace function public.block_homepage_demo_trial(
  p_trial_id uuid,
  p_expected_status text,
  p_block_code text
)
returns table (
  trial_id uuid,
  status text,
  risk_state text,
  expires_at timestamptz,
  changed boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
  v_block_code text := btrim(coalesce(p_block_code, ''));
begin
  if p_trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_TRIAL_ID';
  end if;

  if p_expected_status not in ('created', 'validating') then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_EXPECTED_STATUS';
  end if;

  if char_length(v_block_code) = 0
    or char_length(v_block_code) > 80
    or v_block_code !~ '^[a-z0-9_:-]+$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_BLOCK_CODE';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = p_trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_NOT_FOUND';
  end if;

  if v_trial.status = 'blocked' then
    if v_trial.risk_state = 'blocked'
      and v_trial.failure_code = v_block_code then
      return query
        select
          v_trial.id,
          v_trial.status,
          v_trial.risk_state,
          v_trial.expires_at,
          false;
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_BLOCK_CONFLICT';
  end if;

  if v_trial.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_EXPIRED';
  end if;

  if v_trial.status <> p_expected_status then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_BLOCK_CONFLICT';
  end if;

  update public.homepage_demo_trials as trial
  set
    status = 'blocked',
    risk_state = 'blocked',
    failure_code = v_block_code
  where trial.id = v_trial.id
  returning trial.* into v_trial;

  return query
    select
      v_trial.id,
      v_trial.status,
      v_trial.risk_state,
      v_trial.expires_at,
      true;
end;
$$;

create or replace function public.purge_expired_homepage_demo_trials(
  p_limit integer default 250
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_limit integer := coalesce(p_limit, 250);
  v_deleted_count integer := 0;
begin
  if v_limit <= 0 then
    v_limit := 250;
  end if;

  if v_limit > 1000 then
    v_limit := 1000;
  end if;

  with expired_trials as (
    select trial.id
    from public.homepage_demo_trials as trial
    where trial.expires_at <= v_now
    order by trial.expires_at asc, trial.id asc
    limit v_limit
    for update of trial skip locked
  ),
  deleted_trials as (
    delete from public.homepage_demo_trials as trial
    using expired_trials
    where trial.id = expired_trials.id
    returning trial.id
  )
  select count(*)::integer
  into v_deleted_count
  from deleted_trials;

  return v_deleted_count;
end;
$$;

revoke all on function public.create_homepage_demo_trial(
  text,
  text,
  text,
  text,
  timestamptz
) from public;
revoke all on function public.create_homepage_demo_trial(
  text,
  text,
  text,
  text,
  timestamptz
) from anon;
revoke all on function public.create_homepage_demo_trial(
  text,
  text,
  text,
  text,
  timestamptz
) from authenticated;
grant execute on function public.create_homepage_demo_trial(
  text,
  text,
  text,
  text,
  timestamptz
) to service_role;

revoke all on function public.advance_homepage_demo_trial(
  uuid,
  text,
  text,
  text
) from public;
revoke all on function public.advance_homepage_demo_trial(
  uuid,
  text,
  text,
  text
) from anon;
revoke all on function public.advance_homepage_demo_trial(
  uuid,
  text,
  text,
  text
) from authenticated;
grant execute on function public.advance_homepage_demo_trial(
  uuid,
  text,
  text,
  text
) to service_role;

revoke all on function public.complete_homepage_demo_trial(
  uuid,
  jsonb,
  text,
  text
) from public;
revoke all on function public.complete_homepage_demo_trial(
  uuid,
  jsonb,
  text,
  text
) from anon;
revoke all on function public.complete_homepage_demo_trial(
  uuid,
  jsonb,
  text,
  text
) from authenticated;
grant execute on function public.complete_homepage_demo_trial(
  uuid,
  jsonb,
  text,
  text
) to service_role;

revoke all on function public.fail_homepage_demo_trial(
  uuid,
  text,
  text
) from public;
revoke all on function public.fail_homepage_demo_trial(
  uuid,
  text,
  text
) from anon;
revoke all on function public.fail_homepage_demo_trial(
  uuid,
  text,
  text
) from authenticated;
grant execute on function public.fail_homepage_demo_trial(
  uuid,
  text,
  text
) to service_role;

revoke all on function public.block_homepage_demo_trial(
  uuid,
  text,
  text
) from public;
revoke all on function public.block_homepage_demo_trial(
  uuid,
  text,
  text
) from anon;
revoke all on function public.block_homepage_demo_trial(
  uuid,
  text,
  text
) from authenticated;
grant execute on function public.block_homepage_demo_trial(
  uuid,
  text,
  text
) to service_role;

revoke all on function public.purge_expired_homepage_demo_trials(integer)
  from public;
revoke all on function public.purge_expired_homepage_demo_trials(integer)
  from anon;
revoke all on function public.purge_expired_homepage_demo_trials(integer)
  from authenticated;
grant execute on function public.purge_expired_homepage_demo_trials(integer)
  to service_role;
