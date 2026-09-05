-- Text2Task Homepage Demo Review Access
-- Migration: 202606280001_homepage_demo_review_access.sql
-- Created: 2026-06-28
--
-- Service-role-only temporary Review draft access for future homepage demo
-- routes. These functions accept token hashes only, never raw tokens, and
-- never return token hashes or claim identifiers.

create or replace function public.get_homepage_demo_review_draft(
  p_public_token_hash text,
  p_session_token_hash text
)
returns table (
  trial_id uuid,
  draft_id uuid,
  input_type text,
  trial_status text,
  draft_status text,
  normalized_result jsonb,
  edited_result jsonb,
  expires_at timestamptz,
  draft_updated_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
begin
  if p_public_token_hash is null
    or p_public_token_hash !~ '^[0-9a-f]{64}$'
    or p_session_token_hash is null
    or p_session_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_ACCESS_HASH';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.public_token_hash = p_public_token_hash
    and trial.session_token_hash = p_session_token_hash;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_trial.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_EXPIRED';
  end if;

  if v_trial.claimed_by_user_id is not null
    or v_trial.claimed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_trial.status <> 'review_ready'
    or v_trial.risk_state <> 'allowed' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_NOT_READY';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.trial_id = v_trial.id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_draft.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_EXPIRED';
  end if;

  if v_draft.claimed_by_user_id is not null
    or v_draft.claimed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_draft.status <> 'ready' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_NOT_READY';
  end if;

  return query
    select
      v_trial.id,
      v_draft.id,
      v_trial.input_type,
      v_trial.status,
      v_draft.status,
      v_draft.normalized_result,
      v_draft.edited_result,
      least(v_trial.expires_at, v_draft.expires_at),
      v_draft.updated_at;
end;
$$;

create or replace function public.update_homepage_demo_review_draft(
  p_public_token_hash text,
  p_session_token_hash text,
  p_edited_result jsonb,
  p_expected_updated_at timestamptz
)
returns table (
  trial_id uuid,
  draft_id uuid,
  draft_status text,
  expires_at timestamptz,
  draft_updated_at timestamptz,
  changed boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
begin
  if p_public_token_hash is null
    or p_public_token_hash !~ '^[0-9a-f]{64}$'
    or p_session_token_hash is null
    or p_session_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_ACCESS_HASH';
  end if;

  if p_edited_result is null
    or jsonb_typeof(p_edited_result) <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_EDITED_RESULT';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.public_token_hash = p_public_token_hash
    and trial.session_token_hash = p_session_token_hash
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_trial.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_EXPIRED';
  end if;

  if v_trial.claimed_by_user_id is not null
    or v_trial.claimed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_trial.status <> 'review_ready'
    or v_trial.risk_state <> 'allowed' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_NOT_READY';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.trial_id = v_trial.id
  for update of draft;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_draft.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_EXPIRED';
  end if;

  if v_draft.claimed_by_user_id is not null
    or v_draft.claimed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_draft.status <> 'ready' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_NOT_READY';
  end if;

  if v_draft.edited_result is not distinct from p_edited_result then
    return query
      select
        v_trial.id,
        v_draft.id,
        v_draft.status,
        least(v_trial.expires_at, v_draft.expires_at),
        v_draft.updated_at,
        false;
    return;
  end if;

  if p_expected_updated_at is null
    or p_expected_updated_at is distinct from v_draft.updated_at then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_EDIT_CONFLICT';
  end if;

  update public.homepage_demo_drafts as draft
  set edited_result = p_edited_result
  where draft.id = v_draft.id
  returning draft.* into v_draft;

  return query
    select
      v_trial.id,
      v_draft.id,
      v_draft.status,
      least(v_trial.expires_at, v_draft.expires_at),
      v_draft.updated_at,
      true;
end;
$$;

revoke all on function public.get_homepage_demo_review_draft(text, text)
  from public;
revoke all on function public.get_homepage_demo_review_draft(text, text)
  from anon;
revoke all on function public.get_homepage_demo_review_draft(text, text)
  from authenticated;
grant execute on function public.get_homepage_demo_review_draft(text, text)
  to service_role;

revoke all on function public.update_homepage_demo_review_draft(
  text,
  text,
  jsonb,
  timestamptz
) from public;
revoke all on function public.update_homepage_demo_review_draft(
  text,
  text,
  jsonb,
  timestamptz
) from anon;
revoke all on function public.update_homepage_demo_review_draft(
  text,
  text,
  jsonb,
  timestamptz
) from authenticated;
grant execute on function public.update_homepage_demo_review_draft(
  text,
  text,
  jsonb,
  timestamptz
) to service_role;
