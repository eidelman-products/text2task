-- Text2Task Homepage Demo Claim Auth Continuation
-- Migration: 202609030001_homepage_demo_claim_auth_continuation.sql
-- Created: 2026-09-03
--
-- Additive, service-role-only pending-auth continuation for Homepage Demo
-- claims. This preserves a selected claim through legitimate email/OAuth/
-- password authentication without globally extending anonymous review access.

alter table public.homepage_demo_claims
  add column if not exists auth_continuation_token_hash text null,
  add column if not exists auth_continuation_started_at timestamptz null,
  add column if not exists auth_continuation_expires_at timestamptz null,
  add column if not exists auth_continuation_consumed_at timestamptz null;

alter table public.homepage_demo_claims
  drop constraint if exists homepage_demo_claims_auth_continuation_token_hash_check,
  add constraint homepage_demo_claims_auth_continuation_token_hash_check
    check (
      auth_continuation_token_hash is null
      or auth_continuation_token_hash ~ '^[0-9a-f]{64}$'
    );

alter table public.homepage_demo_claims
  drop constraint if exists homepage_demo_claims_auth_continuation_lifecycle_check,
  add constraint homepage_demo_claims_auth_continuation_lifecycle_check
    check (
      (
        auth_continuation_token_hash is null
        and auth_continuation_started_at is null
        and auth_continuation_expires_at is null
        and auth_continuation_consumed_at is null
      )
      or (
        auth_continuation_token_hash is not null
        and auth_continuation_started_at is not null
        and auth_continuation_expires_at is not null
        and auth_continuation_started_at < expires_at
        and auth_continuation_expires_at > auth_continuation_started_at
        and (
          auth_continuation_consumed_at is null
          or (
            status = 'claimed'
            and auth_continuation_consumed_at >= auth_continuation_started_at
          )
        )
      )
    );

create unique index if not exists
  homepage_demo_claims_auth_continuation_token_hash_unique_idx
  on public.homepage_demo_claims(auth_continuation_token_hash)
  where auth_continuation_token_hash is not null;

create index if not exists
  homepage_demo_claims_pending_auth_continuation_expiry_idx
  on public.homepage_demo_claims(status, auth_continuation_expires_at)
  where auth_continuation_token_hash is not null
    and auth_continuation_consumed_at is null;

revoke all privileges
on table public.homepage_demo_claims
from public, anon, authenticated;

grant select, insert, update, delete
on table public.homepage_demo_claims
to service_role;

create or replace function public.prepare_homepage_demo_claim_auth_continuation(
  p_claim_token_hash text,
  p_existing_continuation_token_hash text,
  p_candidate_continuation_token_hash text,
  p_continuation_ttl_seconds integer
)
returns table (
  outcome text,
  set_cookie boolean,
  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_claim public.homepage_demo_claims%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_expires_at timestamptz;
begin
  if p_claim_token_hash is null
    or p_claim_token_hash !~ '^[0-9a-f]{64}$'
    or p_candidate_continuation_token_hash is null
    or p_candidate_continuation_token_hash !~ '^[0-9a-f]{64}$'
    or (
      p_existing_continuation_token_hash is not null
      and p_existing_continuation_token_hash !~ '^[0-9a-f]{64}$'
    )
    or p_continuation_ttl_seconds is null
    or p_continuation_ttl_seconds < 900
    or p_continuation_ttl_seconds > 7200 then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  select claim.*
  into v_claim
  from public.homepage_demo_claims as claim
  where claim.claim_token_hash = p_claim_token_hash
  for update of claim;

  if not found then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.status = 'claimed' then
    return query select 'already_claimed'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.status <> 'pending'
    or v_claim.trial_id is null
    or v_claim.draft_id is null then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.auth_continuation_token_hash is not null then
    if v_claim.auth_continuation_expires_at > v_now
      and v_claim.auth_continuation_consumed_at is null then
      if p_existing_continuation_token_hash is not null
        and v_claim.auth_continuation_token_hash
          is not distinct from p_existing_continuation_token_hash then
        return query
          select
            'continuation_reused'::text,
            false,
            v_claim.auth_continuation_expires_at;
        return;
      end if;

      return query
        select 'continuation_in_progress'::text, false, null::timestamptz;
      return;
    end if;

    if v_claim.expires_at <= v_now then
      update public.homepage_demo_claims as claim
      set status = 'expired'
      where claim.id = v_claim.id
        and claim.status = 'pending'
        and claim.auth_continuation_consumed_at is null;

      return query select 'expired'::text, false, null::timestamptz;
      return;
    end if;

    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.expires_at <= v_now then
    update public.homepage_demo_claims as claim
    set status = 'expired'
    where claim.id = v_claim.id
      and claim.status = 'pending';

    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_claim.trial_id
  for update of trial;

  if not found then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.id = v_claim.draft_id
    and draft.trial_id = v_claim.trial_id
  for update of draft;

  if not found then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  v_now := clock_timestamp();

  if v_trial.expires_at <= v_now
    or v_draft.expires_at <= v_now then
    update public.homepage_demo_claims as claim
    set status = 'expired'
    where claim.id = v_claim.id
      and claim.status = 'pending';

    return query select 'expired'::text, false, null::timestamptz;
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
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  v_expires_at :=
    v_now + (p_continuation_ttl_seconds * interval '1 second');

  update public.homepage_demo_claims as claim
  set
    auth_continuation_token_hash = p_candidate_continuation_token_hash,
    auth_continuation_started_at = v_now,
    auth_continuation_expires_at = v_expires_at,
    auth_continuation_consumed_at = null
  where claim.id = v_claim.id
    and claim.status = 'pending'
    and claim.claim_token_hash = p_claim_token_hash
    and claim.expires_at > v_now
    and claim.auth_continuation_token_hash is null
    and claim.auth_continuation_started_at is null
    and claim.auth_continuation_expires_at is null
    and claim.auth_continuation_consumed_at is null;

  if not found then
    return query
      select 'continuation_in_progress'::text, false, null::timestamptz;
    return;
  end if;

  return query
    select 'continuation_prepared'::text, true, v_expires_at;
end;
$$;

create or replace function public.claim_homepage_demo_project_v2(
  p_claim_token_hash text,
  p_auth_continuation_token_hash text,
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
  v_now timestamptz := clock_timestamp();
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
  v_has_claim_authority boolean := false;
  v_has_continuation_authority boolean := false;
begin
  if (
      p_claim_token_hash is null
      and p_auth_continuation_token_hash is null
    )
    or (
      p_claim_token_hash is not null
      and p_claim_token_hash !~ '^[0-9a-f]{64}$'
    )
    or (
      p_auth_continuation_token_hash is not null
      and p_auth_continuation_token_hash !~ '^[0-9a-f]{64}$'
    ) then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if p_authenticated_user_id is null
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_import_groups is null
    or jsonb_typeof(p_import_groups) is distinct from 'array'
    or jsonb_array_length(p_import_groups) <> 1 then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if not exists (
    select 1
    from auth.users as app_user
    where app_user.id = p_authenticated_user_id
  ) then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if p_claim_token_hash is not null then
    select claim.*
    into v_claim
    from public.homepage_demo_claims as claim
    where claim.claim_token_hash = p_claim_token_hash
    for update of claim;
  else
    select claim.*
    into v_claim
    from public.homepage_demo_claims as claim
    where claim.auth_continuation_token_hash = p_auth_continuation_token_hash
    for update of claim;
  end if;

  if not found then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if v_claim.status = 'claimed' then
    if v_claim.claimed_by_user_id is distinct from p_authenticated_user_id
      or v_claim.saved_project_id is null
      or v_claim.claimed_at is null then
      return query select 'invalid_claim'::text, null::uuid, false;
      return;
    end if;

    return query
      select 'already_claimed'::text, v_claim.saved_project_id, false;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query select 'expired'::text, null::uuid, false;
    return;
  end if;

  if v_claim.status <> 'pending' then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  v_has_claim_authority :=
    p_claim_token_hash is not null
    and v_claim.claim_token_hash is not distinct from p_claim_token_hash
    and v_claim.expires_at > v_now;

  v_has_continuation_authority :=
    p_auth_continuation_token_hash is not null
    and v_claim.auth_continuation_token_hash
      is not distinct from p_auth_continuation_token_hash
    and v_claim.auth_continuation_started_at is not null
    and v_claim.auth_continuation_started_at < v_claim.expires_at
    and v_claim.auth_continuation_expires_at > v_now
    and v_claim.auth_continuation_consumed_at is null;

  if not v_has_claim_authority and not v_has_continuation_authority then
    if v_claim.expires_at <= v_now then
      update public.homepage_demo_claims as claim
      set status = 'expired'
      where claim.id = v_claim.id
        and claim.status = 'pending';
    end if;

    return query select 'expired'::text, null::uuid, false;
    return;
  end if;

  if v_claim.trial_id is null
    or v_claim.draft_id is null then
    return query select 'draft_unavailable'::text, null::uuid, false;
    return;
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_claim.trial_id
  for update of trial;

  if not found then
    return query select 'draft_unavailable'::text, null::uuid, false;
    return;
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.id = v_claim.draft_id
    and draft.trial_id = v_claim.trial_id
  for update of draft;

  if not found then
    return query select 'draft_unavailable'::text, null::uuid, false;
    return;
  end if;

  v_now := clock_timestamp();

  if (v_trial.expires_at <= v_now or v_draft.expires_at <= v_now)
    and not v_has_continuation_authority then
    update public.homepage_demo_claims as claim
    set status = 'expired'
    where claim.id = v_claim.id
      and claim.status = 'pending';

    return query select 'expired'::text, null::uuid, false;
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
    return query select 'draft_unavailable'::text, null::uuid, false;
    return;
  end if;

  v_effective_result := coalesce(v_draft.edited_result, v_draft.normalized_result);

  if v_effective_result is null
    or jsonb_typeof(v_effective_result) is distinct from 'object'
    or jsonb_typeof(v_effective_result->'tasks') is distinct from 'array'
    or jsonb_array_length(v_effective_result->'tasks') = 0 then
    return query select 'draft_unavailable'::text, null::uuid, false;
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
      return query select 'draft_unavailable'::text, null::uuid, false;
      return;
    end if;
  end loop;

  if p_duplicate_check_passed is distinct from true then
    return query select 'duplicate_detected'::text, null::uuid, false;
    return;
  end if;

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
      return query select 'invalid_claim'::text, null::uuid, false;
      return;
    end if;
  end if;

  if v_attempt.status = 'committed' then
    if v_attempt.result_json is null
      or jsonb_typeof(v_attempt.result_json) <> 'object' then
      return query select 'invalid_claim'::text, null::uuid, false;
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
    return query select 'invalid_claim'::text, null::uuid, false;
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
    claimed_at = v_now,
    auth_continuation_consumed_at =
      case
        when claim.auth_continuation_token_hash is null then null
        else v_now
      end
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

  return query select 'saved'::text, v_saved_project_id, v_created;
end;
$$;

create or replace function public.prepare_homepage_demo_duplicate_override_v2(
  p_claim_token_hash text,
  p_auth_continuation_token_hash text,
  p_authenticated_user_id uuid,
  p_existing_authority_token_hash text default null,
  p_candidate_authority_token_hash text default null,
  p_request_hash text default null,
  p_import_groups jsonb default null
)
returns table (
  outcome text,
  set_cookie boolean,
  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_claim public.homepage_demo_claims%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_authority public.homepage_demo_duplicate_override_authorities%rowtype;
  v_import_groups_hash text;
  v_authority_expires_at timestamptz;
  v_effective_claim_expires_at timestamptz;
  v_has_claim_authority boolean := false;
  v_has_continuation_authority boolean := false;
begin
  if (
      p_claim_token_hash is null
      and p_auth_continuation_token_hash is null
    )
    or (
      p_claim_token_hash is not null
      and p_claim_token_hash !~ '^[0-9a-f]{64}$'
    )
    or (
      p_auth_continuation_token_hash is not null
      and p_auth_continuation_token_hash !~ '^[0-9a-f]{64}$'
    )
    or p_authenticated_user_id is null
    or (
      p_existing_authority_token_hash is not null
      and p_existing_authority_token_hash !~ '^[0-9a-f]{64}$'
    )
    or p_candidate_authority_token_hash is null
    or p_candidate_authority_token_hash !~ '^[0-9a-f]{64}$'
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_import_groups is null
    or jsonb_typeof(p_import_groups) is distinct from 'array'
    or jsonb_array_length(p_import_groups) <> 1 then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  if not exists (
    select 1
    from auth.users as app_user
    where app_user.id = p_authenticated_user_id
  ) then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  v_import_groups_hash :=
    encode(sha256(convert_to(p_import_groups::text, 'UTF8')), 'hex');

  if p_claim_token_hash is not null then
    select claim.*
    into v_claim
    from public.homepage_demo_claims as claim
    where claim.claim_token_hash = p_claim_token_hash
    for update of claim;
  else
    select claim.*
    into v_claim
    from public.homepage_demo_claims as claim
    where claim.auth_continuation_token_hash = p_auth_continuation_token_hash
    for update of claim;
  end if;

  if not found then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.status = 'claimed' then
    if v_claim.claimed_by_user_id is not distinct from p_authenticated_user_id
      and v_claim.saved_project_id is not null
      and v_claim.claimed_at is not null then
      return query select 'already_claimed'::text, false, null::timestamptz;
      return;
    end if;

    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.status <> 'pending'
    or v_claim.trial_id is null
    or v_claim.draft_id is null then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  v_has_claim_authority :=
    p_claim_token_hash is not null
    and v_claim.claim_token_hash is not distinct from p_claim_token_hash
    and v_claim.expires_at > v_now;

  v_has_continuation_authority :=
    p_auth_continuation_token_hash is not null
    and v_claim.auth_continuation_token_hash
      is not distinct from p_auth_continuation_token_hash
    and v_claim.auth_continuation_started_at is not null
    and v_claim.auth_continuation_started_at < v_claim.expires_at
    and v_claim.auth_continuation_expires_at > v_now
    and v_claim.auth_continuation_consumed_at is null;

  if not v_has_claim_authority and not v_has_continuation_authority then
    if v_claim.expires_at <= v_now then
      update public.homepage_demo_claims as claim
      set status = 'expired'
      where claim.id = v_claim.id
        and claim.status = 'pending';
    end if;

    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  v_effective_claim_expires_at :=
    case
      when v_has_continuation_authority then v_claim.auth_continuation_expires_at
      else v_claim.expires_at
    end;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_claim.trial_id
  for update of trial;

  if not found then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.id = v_claim.draft_id
    and draft.trial_id = v_claim.trial_id
  for update of draft;

  if not found then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  v_now := clock_timestamp();

  if (v_trial.expires_at <= v_now or v_draft.expires_at <= v_now)
    and not v_has_continuation_authority then
    return query select 'expired'::text, false, null::timestamptz;
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
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  select authority.*
  into v_authority
  from public.homepage_demo_duplicate_override_authorities as authority
  where authority.claim_id = v_claim.id
    and authority.status = 'pending'
  order by authority.created_at asc, authority.id asc
  limit 1
  for update of authority;

  if found then
    if v_authority.expires_at <= v_now then
      update public.homepage_demo_duplicate_override_authorities as authority
      set
        status = 'expired',
        updated_at = v_now
      where authority.id = v_authority.id
        and authority.status = 'pending'
        and authority.consumed_at is null;
    elsif v_authority.authenticated_user_id is not distinct from p_authenticated_user_id
      and v_authority.request_hash is not distinct from p_request_hash
      and v_authority.import_groups_hash is not distinct from v_import_groups_hash
      and p_existing_authority_token_hash is not null
      and v_authority.authority_token_hash
        is not distinct from p_existing_authority_token_hash then
      return query
        select 'authority_reused'::text, false, v_authority.expires_at;
      return;
    else
      return query
        select 'authority_in_progress'::text, false, null::timestamptz;
      return;
    end if;
  end if;

  v_now := clock_timestamp();

  v_authority_expires_at :=
    least(v_effective_claim_expires_at, v_now + interval '5 minutes');

  if v_authority_expires_at <= v_now then
    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  insert into public.homepage_demo_duplicate_override_authorities (
    claim_id,
    authenticated_user_id,
    authority_token_hash,
    request_hash,
    import_groups_hash,
    status,
    expires_at,
    consumed_at,
    created_at,
    updated_at
  )
  values (
    v_claim.id,
    p_authenticated_user_id,
    p_candidate_authority_token_hash,
    p_request_hash,
    v_import_groups_hash,
    'pending',
    v_authority_expires_at,
    null,
    v_now,
    v_now
  );

  return query
    select 'authority_prepared'::text, true, v_authority_expires_at;
end;
$$;

create or replace function public.claim_homepage_demo_project_with_duplicate_override_v2(
  p_claim_token_hash text,
  p_auth_continuation_token_hash text,
  p_authenticated_user_id uuid,
  p_authority_token_hash text,
  p_request_hash text,
  p_import_groups jsonb
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
  v_now timestamptz := clock_timestamp();
  v_claim public.homepage_demo_claims%rowtype;
  v_authority public.homepage_demo_duplicate_override_authorities%rowtype;
  v_import_groups_hash text;
  v_save_outcome text;
  v_saved_project_id uuid;
  v_created boolean;
  v_row_count integer;
begin
  if (
      p_claim_token_hash is null
      and p_auth_continuation_token_hash is null
    )
    or (
      p_claim_token_hash is not null
      and p_claim_token_hash !~ '^[0-9a-f]{64}$'
    )
    or (
      p_auth_continuation_token_hash is not null
      and p_auth_continuation_token_hash !~ '^[0-9a-f]{64}$'
    )
    or p_authenticated_user_id is null
    or p_authority_token_hash is null
    or p_authority_token_hash !~ '^[0-9a-f]{64}$'
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_import_groups is null
    or jsonb_typeof(p_import_groups) is distinct from 'array'
    or jsonb_array_length(p_import_groups) <> 1 then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if not exists (
    select 1
    from auth.users as app_user
    where app_user.id = p_authenticated_user_id
  ) then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  v_import_groups_hash :=
    encode(sha256(convert_to(p_import_groups::text, 'UTF8')), 'hex');

  if p_claim_token_hash is not null then
    select claim.*
    into v_claim
    from public.homepage_demo_claims as claim
    where claim.claim_token_hash = p_claim_token_hash
    for update of claim;
  else
    select claim.*
    into v_claim
    from public.homepage_demo_claims as claim
    where claim.auth_continuation_token_hash = p_auth_continuation_token_hash
    for update of claim;
  end if;

  if not found then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if v_claim.status = 'claimed' then
    if v_claim.claimed_by_user_id is distinct from p_authenticated_user_id
      or v_claim.saved_project_id is null
      or v_claim.claimed_at is null then
      return query select 'invalid_claim'::text, null::uuid, false;
      return;
    end if;

    return query
      select 'already_claimed'::text, v_claim.saved_project_id, false;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query select 'expired'::text, null::uuid, false;
    return;
  end if;

  if v_claim.status <> 'pending' then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  select authority.*
  into v_authority
  from public.homepage_demo_duplicate_override_authorities as authority
  where authority.authority_token_hash = p_authority_token_hash
  for update of authority;

  if not found then
    return query
      select 'duplicate_authority_unavailable'::text, null::uuid, false;
    return;
  end if;

  v_now := clock_timestamp();

  if v_authority.status = 'pending'
    and v_authority.expires_at <= v_now then
    update public.homepage_demo_duplicate_override_authorities as authority
    set
      status = 'expired',
      updated_at = v_now
    where authority.id = v_authority.id
      and authority.status = 'pending'
      and authority.consumed_at is null;

    return query
      select 'duplicate_authority_expired'::text, null::uuid, false;
    return;
  end if;

  if v_authority.status = 'expired' then
    return query
      select 'duplicate_authority_expired'::text, null::uuid, false;
    return;
  end if;

  if v_authority.claim_id is distinct from v_claim.id
    or v_authority.authenticated_user_id is distinct from p_authenticated_user_id
    or v_authority.status is distinct from 'pending'
    or v_authority.consumed_at is not null
    or v_authority.request_hash is distinct from p_request_hash
    or v_authority.import_groups_hash is distinct from v_import_groups_hash then
    return query
      select 'duplicate_authority_unavailable'::text, null::uuid, false;
    return;
  end if;

  select save_result.outcome,
         save_result.saved_project_id,
         save_result.created
  into v_save_outcome,
       v_saved_project_id,
       v_created
  from public.claim_homepage_demo_project_v2(
    p_claim_token_hash,
    p_auth_continuation_token_hash,
    p_authenticated_user_id,
    p_request_hash,
    p_import_groups,
    true
  ) as save_result;

  if not found then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if v_save_outcome = 'saved' then
    v_now := clock_timestamp();

    update public.homepage_demo_duplicate_override_authorities as authority
    set
      status = 'consumed',
      consumed_at = v_now,
      updated_at = v_now
    where authority.id = v_authority.id
      and authority.authority_token_hash = p_authority_token_hash
      and authority.claim_id = v_claim.id
      and authority.authenticated_user_id = p_authenticated_user_id
      and authority.status = 'pending'
      and authority.consumed_at is null
      and authority.expires_at > v_now
      and authority.request_hash = p_request_hash
      and authority.import_groups_hash = v_import_groups_hash;

    get diagnostics v_row_count = row_count;

    if v_row_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_DUPLICATE_OVERRIDE_CONFLICT';
    end if;
  end if;

  return query select v_save_outcome, v_saved_project_id, v_created;
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
      and not exists (
        select 1
        from public.homepage_demo_claims as claim
        where claim.trial_id = trial.id
          and claim.status = 'pending'
          and claim.auth_continuation_token_hash is not null
          and claim.auth_continuation_expires_at > v_now
          and claim.auth_continuation_consumed_at is null
      )
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

  update public.homepage_demo_claims as claim
  set status = 'expired'
  where claim.status = 'pending'
    and claim.expires_at <= v_now
    and (
      claim.auth_continuation_expires_at is null
      or claim.auth_continuation_expires_at <= v_now
      or claim.auth_continuation_consumed_at is not null
    );

  with selected_trials as (
    select trial.id
    from public.homepage_demo_trials as trial
    where trial.expires_at <= v_now
      and trial.status <> 'claimed'
      and trial.claimed_by_user_id is null
      and trial.claimed_at is null
      and not exists (
        select 1
        from public.homepage_demo_claims as claim
        where claim.trial_id = trial.id
          and claim.status = 'pending'
          and claim.auth_continuation_token_hash is not null
          and claim.auth_continuation_expires_at > v_now
          and claim.auth_continuation_consumed_at is null
      )
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
            or exists (
              select 1
              from public.homepage_demo_claims as claim
              where claim.trial_id = trial.id
                and claim.status = 'pending'
                and claim.auth_continuation_token_hash is not null
                and claim.auth_continuation_expires_at > v_now
                and claim.auth_continuation_consumed_at is null
            )
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
  deleted_capacity as (
    delete from public.homepage_demo_capacity_reservations as capacity
    using selected_capacity_reservations
    where capacity.id = selected_capacity_reservations.id
    returning capacity.id
  )
  select count(*)::integer
  into deleted_capacity_reservations
  from deleted_capacity;

  with selected_cost_reservations as (
    select cost.id
    from public.homepage_demo_cost_reservations as cost
    where cost.status in ('released', 'expired')
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
  deleted_cost_reservation_rows as (
    delete from public.homepage_demo_cost_reservations as cost
    using selected_cost_reservations
    where cost.id = selected_cost_reservations.id
    returning cost.id
  )
  select count(*)::integer
  into deleted_cost_reservations
  from deleted_cost_reservation_rows;

  with selected_attempts as (
    select attempt.id
    from public.homepage_demo_admission_attempts as attempt
    where attempt.status in ('failed', 'blocked', 'rejected', 'released', 'expired')
      and attempt.retention_expires_at <= v_now
      and not exists (
        select 1
        from public.homepage_demo_trials as trial
        where trial.id = attempt.trial_id
          and (
            trial.expires_at > v_now
            or trial.status = 'claimed'
            or trial.claimed_by_user_id is not null
            or trial.claimed_at is not null
            or exists (
              select 1
              from public.homepage_demo_claims as claim
              where claim.trial_id = trial.id
                and claim.status = 'pending'
                and claim.auth_continuation_token_hash is not null
                and claim.auth_continuation_expires_at > v_now
                and claim.auth_continuation_consumed_at is null
            )
          )
      )
    order by attempt.retention_expires_at asc, attempt.id asc
    limit v_limit
    for update of attempt skip locked
  ),
  deleted_attempt_rows as (
    delete from public.homepage_demo_admission_attempts as attempt
    using selected_attempts
    where attempt.id = selected_attempts.id
    returning attempt.id
  )
  select count(*)::integer
  into deleted_attempts
  from deleted_attempt_rows;

  with selected_rate_buckets as (
    select bucket.id
    from public.homepage_demo_rate_limit_buckets as bucket
    where bucket.expires_at <= v_now
    order by bucket.expires_at asc, bucket.id asc
    limit v_limit
    for update of bucket skip locked
  ),
  deleted_rate_bucket_rows as (
    delete from public.homepage_demo_rate_limit_buckets as bucket
    using selected_rate_buckets
    where bucket.id = selected_rate_buckets.id
    returning bucket.id
  )
  select count(*)::integer
  into deleted_rate_buckets
  from deleted_rate_bucket_rows;

  with selected_cost_buckets as (
    select bucket.id
    from public.homepage_demo_cost_buckets as bucket
    where bucket.expires_at <= v_now
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

revoke all on function public.prepare_homepage_demo_claim_auth_continuation(
  text,
  text,
  text,
  integer
) from public;
revoke all on function public.prepare_homepage_demo_claim_auth_continuation(
  text,
  text,
  text,
  integer
) from anon;
revoke all on function public.prepare_homepage_demo_claim_auth_continuation(
  text,
  text,
  text,
  integer
) from authenticated;
grant execute on function public.prepare_homepage_demo_claim_auth_continuation(
  text,
  text,
  text,
  integer
) to service_role;

revoke all on function public.claim_homepage_demo_project_v2(
  text,
  text,
  uuid,
  text,
  jsonb,
  boolean
) from public;
revoke all on function public.claim_homepage_demo_project_v2(
  text,
  text,
  uuid,
  text,
  jsonb,
  boolean
) from anon;
revoke all on function public.claim_homepage_demo_project_v2(
  text,
  text,
  uuid,
  text,
  jsonb,
  boolean
) from authenticated;
grant execute on function public.claim_homepage_demo_project_v2(
  text,
  text,
  uuid,
  text,
  jsonb,
  boolean
) to service_role;

revoke all on function public.prepare_homepage_demo_duplicate_override_v2(
  text,
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) from public;
revoke all on function public.prepare_homepage_demo_duplicate_override_v2(
  text,
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) from anon;
revoke all on function public.prepare_homepage_demo_duplicate_override_v2(
  text,
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) from authenticated;
grant execute on function public.prepare_homepage_demo_duplicate_override_v2(
  text,
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) to service_role;

revoke all on function public.claim_homepage_demo_project_with_duplicate_override_v2(
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) from public;
revoke all on function public.claim_homepage_demo_project_with_duplicate_override_v2(
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) from anon;
revoke all on function public.claim_homepage_demo_project_with_duplicate_override_v2(
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) from authenticated;
grant execute on function public.claim_homepage_demo_project_with_duplicate_override_v2(
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) to service_role;

revoke all on function public.purge_expired_homepage_demo_trials(integer)
  from public;
revoke all on function public.purge_expired_homepage_demo_trials(integer)
  from anon;
revoke all on function public.purge_expired_homepage_demo_trials(integer)
  from authenticated;
grant execute on function public.purge_expired_homepage_demo_trials(integer)
  to service_role;

revoke all on function public.purge_homepage_demo_retention(integer)
  from public;
revoke all on function public.purge_homepage_demo_retention(integer)
  from anon;
revoke all on function public.purge_homepage_demo_retention(integer)
  from authenticated;
grant execute on function public.purge_homepage_demo_retention(integer)
  to service_role;

comment on column public.homepage_demo_claims.auth_continuation_token_hash is
  'SHA-256 hash of the bounded pending-auth continuation token. Raw continuation tokens are never stored and never placed in email, OAuth, analytics, or query-string URLs.';

comment on column public.homepage_demo_claims.auth_continuation_started_at is
  'Server timestamp when a valid short-lived claim first began a real auth flow. This is the fixed start for the bounded continuation window and is never slid by retries.';

comment on column public.homepage_demo_claims.auth_continuation_expires_at is
  'Server-computed pending-auth continuation expiry. It may outlive the anonymous claim expiry but only for this selected pending claim.';

comment on column public.homepage_demo_claims.auth_continuation_consumed_at is
  'Set when the continuation-bearing claim is successfully saved. Consumed continuations cannot claim again or change ownership.';

comment on function public.prepare_homepage_demo_claim_auth_continuation(
  text,
  text,
  text,
  integer
) is
  'Service-role-only RPC that starts or reuses a bounded Homepage Demo pending-auth continuation for an already valid pending claim. The first valid start fixes expiry; retries cannot slide the window.';

comment on function public.claim_homepage_demo_project_v2(
  text,
  text,
  uuid,
  text,
  jsonb,
  boolean
) is
  'Service-role-only Homepage Demo claim/save RPC with pending-auth continuation support. Allows save with either the original short claim authority or a valid non-expired continuation token hash.';

comment on function public.prepare_homepage_demo_duplicate_override_v2(
  text,
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) is
  'Service-role-only duplicate override preparation RPC with pending-auth continuation support. Authority remains claim/user/request/payload-bound and expires in at most five minutes.';

comment on function public.claim_homepage_demo_project_with_duplicate_override_v2(
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) is
  'Service-role-only save-anyway RPC with pending-auth continuation support. Validates duplicate override authority before atomically reusing claim_homepage_demo_project_v2.';

comment on function public.purge_homepage_demo_retention(integer) is
  'Server-only bounded Homepage Demo claimed-safe retention cleanup. Physical purge excludes active pending-auth continuations while preserving existing aggregate-only service-role behavior.';
