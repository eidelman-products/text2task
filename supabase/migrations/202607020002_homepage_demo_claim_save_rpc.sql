-- Text2Task Homepage Demo Claim Save RPC
-- Migration: 202607020002_homepage_demo_claim_save_rpc.sql
-- Created: 2026-07-02
--
-- Service-role-only transactional claim/save flow for turning one prepared
-- Homepage Demo Review draft into one authenticated project import. The RPC
-- accepts token hashes and trusted server-generated import metadata only; it
-- never returns draft JSON, client/project content, raw tokens, token hashes,
-- email addresses, or provider data.

create or replace function public.claim_homepage_demo_project(
  p_claim_token_hash text,
  p_authenticated_user_id uuid,
  p_request_hash text,
  p_import_groups jsonb,
  p_duplicate_check_passed boolean
)
returns table (
  outcome text,
  saved_project_id uuid,
  created boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_claim public.homepage_demo_claims%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_attempt public.project_import_attempts%rowtype;
  v_effective_result jsonb;
  v_task jsonb;
  v_import_result jsonb;
  v_saved_project_id_text text;
  v_saved_project_id uuid;
  v_created boolean := false;
begin
  if p_claim_token_hash is null
    or p_claim_token_hash !~ '^[0-9a-f]{64}$'
    or p_authenticated_user_id is null
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_import_groups is null
    or jsonb_typeof(p_import_groups) is distinct from 'array' then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  if jsonb_array_length(p_import_groups) <> 1 then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  if not exists (
    select 1
    from auth.users as app_user
    where app_user.id = p_authenticated_user_id
  ) then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  select claim.*
  into v_claim
  from public.homepage_demo_claims as claim
  where claim.claim_token_hash = p_claim_token_hash
  for update of claim;

  if not found then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_claim.status = 'claimed' then
    if v_claim.claimed_by_user_id is distinct from p_authenticated_user_id
      or v_claim.saved_project_id is null
      or v_claim.claimed_at is null then
      return query
        select
          'invalid_claim'::text,
          null::uuid,
          false;
      return;
    end if;

    return query
      select
        'already_claimed'::text,
        v_claim.saved_project_id,
        false;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query
      select
        'expired'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_claim.status <> 'pending' then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_claim.expires_at <= v_now then
    update public.homepage_demo_claims as claim
    set status = 'expired'
    where claim.id = v_claim.id
      and claim.status = 'pending';

    return query
      select
        'expired'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_claim.trial_id is null
    or v_claim.draft_id is null then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_claim.trial_id
  for update of trial;

  if not found then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.id = v_claim.draft_id
    and draft.trial_id = v_claim.trial_id
  for update of draft;

  if not found then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_trial.expires_at <= v_now
    or v_draft.expires_at <= v_now then
    update public.homepage_demo_claims as claim
    set status = 'expired'
    where claim.id = v_claim.id
      and claim.status = 'pending';

    return query
      select
        'expired'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_trial.public_token_hash is distinct from v_claim.public_token_hash
    or v_trial.session_token_hash is distinct from v_claim.session_token_hash
    or v_draft.trial_id is distinct from v_trial.id
    or v_trial.input_type is distinct from 'text'
    or v_trial.status is distinct from 'review_ready'
    or v_trial.risk_state is distinct from 'allowed'
    or v_trial.claimed_by_user_id is not null
    or v_trial.claimed_at is not null
    or v_draft.status is distinct from 'ready'
    or v_draft.claimed_by_user_id is not null
    or v_draft.claimed_at is not null
    or v_draft.normalized_result is null then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  v_effective_result := coalesce(v_draft.edited_result, v_draft.normalized_result);

  if v_effective_result is null
    or jsonb_typeof(v_effective_result) is distinct from 'object' then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  if jsonb_typeof(v_effective_result->'tasks') is distinct from 'array' then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  if jsonb_array_length(v_effective_result->'tasks') = 0 then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  for v_task in
    select task_value
    from jsonb_array_elements(v_effective_result->'tasks') as tasks(task_value)
  loop
    if jsonb_typeof(v_task) is distinct from 'object'
      or v_task->>'source' is distinct from 'text'
      or jsonb_typeof(v_task->'client_name') is distinct from 'string'
      or jsonb_typeof(v_task->'contact_name') is distinct from 'string'
      or jsonb_typeof(v_task->'client_phone') is distinct from 'string'
      or jsonb_typeof(v_task->'client_email') is distinct from 'string'
      or jsonb_typeof(v_task->'client_notes') is distinct from 'string'
      or jsonb_typeof(v_task->'task_title') is distinct from 'string'
      or nullif(btrim(v_task->>'task_title'), '') is null
      or jsonb_typeof(v_task->'amount') is distinct from 'string'
      or jsonb_typeof(v_task->'deadline_text') is distinct from 'string'
      or v_task->>'priority' not in ('low', 'medium', 'high')
      or v_task->>'priority' is null
      or jsonb_typeof(v_task->'raw_input') is distinct from 'string' then
      return query
        select
          'draft_unavailable'::text,
          null::uuid,
          false;
      return;
    end if;
  end loop;

  -- The future server route must pass true only after its duplicate preflight
  -- has found no blocker or after an explicit trusted save-anyway decision.
  if p_duplicate_check_passed is distinct from true then
    return query
      select
        'duplicate_detected'::text,
        null::uuid,
        false;
    return;
  end if;

  -- p_request_hash and p_import_groups must be generated by the trusted
  -- server route from the locked Homepage Demo draft, never forwarded from
  -- browser-provided project/client/task payloads.
  insert into public.project_import_attempts (
    user_id,
    idempotency_key,
    request_hash,
    status,
    payload_json,
    last_seen_at
  )
  values (
    p_authenticated_user_id,
    v_claim.import_idempotency_key,
    p_request_hash,
    'started',
    p_import_groups,
    v_now
  )
  on conflict on constraint project_import_attempts_user_key_unique
  do nothing
  returning *
  into v_attempt;

  if v_attempt.id is null then
    select attempt.*
    into v_attempt
    from public.project_import_attempts as attempt
    where attempt.user_id = p_authenticated_user_id
      and attempt.idempotency_key = v_claim.import_idempotency_key
    for update of attempt;

    if not found
      or v_attempt.request_hash is distinct from p_request_hash
      or v_attempt.payload_json is distinct from p_import_groups then
      return query
        select
          'invalid_claim'::text,
          null::uuid,
          false;
      return;
    end if;
  end if;

  if v_attempt.status = 'committed' then
    if v_attempt.result_json is null
      or jsonb_typeof(v_attempt.result_json) <> 'object' then
      return query
        select
          'invalid_claim'::text,
          null::uuid,
          false;
      return;
    end if;

    v_import_result := v_attempt.result_json;
  elsif v_attempt.status = 'started'
    and v_attempt.error_code is null then
    v_import_result := public.import_projects_transaction(
      v_attempt.id,
      v_claim.import_idempotency_key,
      p_request_hash,
      p_import_groups
    );
    v_created := true;
  else
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  v_saved_project_id_text := nullif(
    v_import_result #>> '{createdProjects,0,id}',
    ''
  );

  if v_saved_project_id_text is null
    or v_saved_project_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_CLAIM_SAVE_RESULT_INVALID';
  end if;

  v_saved_project_id := v_saved_project_id_text::uuid;

  update public.homepage_demo_claims as claim
  set
    status = 'claimed',
    claimed_by_user_id = p_authenticated_user_id,
    saved_project_id = v_saved_project_id,
    claimed_at = v_now
  where claim.id = v_claim.id
    and claim.status = 'pending'
    and claim.claimed_by_user_id is null
    and claim.saved_project_id is null
    and claim.claimed_at is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_CLAIM_SAVE_CONFLICT';
  end if;

  update public.homepage_demo_trials as trial
  set
    status = 'claimed',
    claimed_by_user_id = p_authenticated_user_id,
    claimed_at = v_now
  where trial.id = v_trial.id
    and trial.status = 'review_ready'
    and trial.risk_state = 'allowed'
    and trial.claimed_by_user_id is null
    and trial.claimed_at is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_CLAIM_SAVE_CONFLICT';
  end if;

  update public.homepage_demo_drafts as draft
  set
    status = 'claimed',
    claimed_by_user_id = p_authenticated_user_id,
    claimed_at = v_now
  where draft.id = v_draft.id
    and draft.trial_id = v_trial.id
    and draft.status = 'ready'
    and draft.claimed_by_user_id is null
    and draft.claimed_at is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_CLAIM_SAVE_CONFLICT';
  end if;

  return query
    select
      'saved'::text,
      v_saved_project_id,
      v_created;
end;
$$;

revoke all on function public.claim_homepage_demo_project(
  text,
  uuid,
  text,
  jsonb,
  boolean
) from public;

revoke all on function public.claim_homepage_demo_project(
  text,
  uuid,
  text,
  jsonb,
  boolean
) from anon;

revoke all on function public.claim_homepage_demo_project(
  text,
  uuid,
  text,
  jsonb,
  boolean
) from authenticated;

grant execute on function public.claim_homepage_demo_project(
  text,
  uuid,
  text,
  jsonb,
  boolean
) to service_role;

comment on function public.claim_homepage_demo_project(
  text,
  uuid,
  text,
  jsonb,
  boolean
) is
  'Service-role-only atomic Homepage Demo claim/save RPC. Reuses import_projects_transaction with the claim reserved idempotency key and returns only a safe outcome code, saved project ID, and created/replayed flag.';
