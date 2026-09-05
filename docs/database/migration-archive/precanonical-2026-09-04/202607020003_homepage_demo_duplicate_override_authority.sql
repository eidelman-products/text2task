-- Text2Task Homepage Demo Duplicate Override Authority
-- Migration: 202607020003_homepage_demo_duplicate_override_authority.sql
-- Created: 2026-07-02
--
-- Service-role-only duplicate override authority for authenticated Homepage
-- Demo claim saves. Raw authority tokens are never stored; authority is bound
-- to the claim, authenticated user, request hash, and database-computed import
-- payload hash. Save-anyway authority consumption and claim save are atomic.

create extension if not exists "pgcrypto";

create table if not exists public.homepage_demo_duplicate_override_authorities (
  id uuid primary key default gen_random_uuid(),

  claim_id uuid not null
    references public.homepage_demo_claims(id)
    on delete cascade,

  authenticated_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  authority_token_hash text not null,
  request_hash text not null,
  import_groups_hash text not null,

  status text not null default 'pending',
  expires_at timestamptz not null,
  consumed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint homepage_demo_duplicate_override_authorities_token_hash_check
    check (authority_token_hash ~ '^[0-9a-f]{64}$'),

  constraint homepage_demo_duplicate_override_authorities_request_hash_check
    check (request_hash ~ '^[0-9a-f]{64}$'),

  constraint homepage_demo_duplicate_override_authorities_import_hash_check
    check (import_groups_hash ~ '^[0-9a-f]{64}$'),

  constraint homepage_demo_duplicate_override_authorities_status_check
    check (status in ('pending', 'consumed', 'expired', 'cancelled')),

  constraint homepage_demo_duplicate_override_authorities_consumed_at_check
    check (
      (status = 'consumed' and consumed_at is not null)
      or (status <> 'consumed' and consumed_at is null)
    ),

  constraint homepage_demo_duplicate_override_authorities_expires_check
    check (expires_at > created_at),

  constraint homepage_demo_duplicate_override_authorities_token_hash_unique
    unique (authority_token_hash)
);

create unique index if not exists
  homepage_demo_duplicate_override_authorities_one_pending_per_claim_idx
  on public.homepage_demo_duplicate_override_authorities(claim_id)
  where status = 'pending';

create index if not exists
  homepage_demo_duplicate_override_authorities_status_expires_at_idx
  on public.homepage_demo_duplicate_override_authorities(status, expires_at);

create index if not exists
  homepage_demo_duplicate_override_authorities_claim_status_expires_idx
  on public.homepage_demo_duplicate_override_authorities(
    claim_id,
    status,
    expires_at
  );

drop trigger if exists set_homepage_demo_duplicate_override_authorities_updated_at
  on public.homepage_demo_duplicate_override_authorities;

create trigger set_homepage_demo_duplicate_override_authorities_updated_at
  before update on public.homepage_demo_duplicate_override_authorities
  for each row
  execute function public.set_homepage_demo_updated_at();

alter table public.homepage_demo_duplicate_override_authorities
  enable row level security;

revoke all privileges
on table public.homepage_demo_duplicate_override_authorities
from public, anon, authenticated;

revoke all privileges
on table public.homepage_demo_duplicate_override_authorities
from service_role;

grant select, insert, update
on table public.homepage_demo_duplicate_override_authorities
to service_role;

create or replace function public.prepare_homepage_demo_duplicate_override(
  p_claim_token_hash text,
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
security definer
set search_path = pg_catalog
as $$
declare
  v_now timestamptz;
  v_claim public.homepage_demo_claims%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_authority public.homepage_demo_duplicate_override_authorities%rowtype;
  v_import_groups_hash text;
  v_authority_expires_at timestamptz;
begin
  if p_claim_token_hash is null
    or p_claim_token_hash !~ '^[0-9a-f]{64}$'
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
    return query
      select
        'invalid_claim'::text,
        false,
        null::timestamptz;
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
        false,
        null::timestamptz;
    return;
  end if;

  v_import_groups_hash :=
    encode(sha256(convert_to(p_import_groups::text, 'UTF8')), 'hex');

  select claim.*
  into v_claim
  from public.homepage_demo_claims as claim
  where claim.claim_token_hash = p_claim_token_hash
  for update of claim;

  if not found then
    return query
      select
        'invalid_claim'::text,
        false,
        null::timestamptz;
    return;
  end if;

  v_now := clock_timestamp();

  if v_claim.status = 'claimed' then
    if v_claim.claimed_by_user_id is not distinct from p_authenticated_user_id
      and v_claim.saved_project_id is not null
      and v_claim.claimed_at is not null then
      return query
        select
          'already_claimed'::text,
          false,
          null::timestamptz;
      return;
    end if;

    return query
      select
        'invalid_claim'::text,
        false,
        null::timestamptz;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query
      select
        'expired'::text,
        false,
        null::timestamptz;
    return;
  end if;

  if v_claim.status <> 'pending'
    or v_claim.trial_id is null
    or v_claim.draft_id is null then
    return query
      select
        'invalid_claim'::text,
        false,
        null::timestamptz;
    return;
  end if;

  if v_claim.expires_at <= v_now then
    return query
      select
        'expired'::text,
        false,
        null::timestamptz;
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
        'invalid_claim'::text,
        false,
        null::timestamptz;
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
        'invalid_claim'::text,
        false,
        null::timestamptz;
    return;
  end if;

  v_now := clock_timestamp();

  if v_trial.expires_at <= v_now
    or v_draft.expires_at <= v_now then
    return query
      select
        'expired'::text,
        false,
        null::timestamptz;
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
        'invalid_claim'::text,
        false,
        null::timestamptz;
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
    v_now := clock_timestamp();

    if v_claim.expires_at <= v_now then
      return query
        select
          'expired'::text,
          false,
          null::timestamptz;
      return;
    end if;

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
      and v_authority.authority_token_hash is not distinct from p_existing_authority_token_hash then
      return query
        select
          'authority_reused'::text,
          false,
          v_authority.expires_at;
      return;
    else
      return query
        select
          'authority_in_progress'::text,
          false,
          null::timestamptz;
      return;
    end if;
  end if;

  v_now := clock_timestamp();

  v_authority_expires_at :=
    least(v_claim.expires_at, v_now + interval '5 minutes');

  if v_authority_expires_at <= v_now then
    return query
      select
        'expired'::text,
        false,
        null::timestamptz;
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
    select
      'authority_prepared'::text,
      true,
      v_authority_expires_at;
end;
$$;

create or replace function public.claim_homepage_demo_project_with_duplicate_override(
  p_claim_token_hash text,
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
security definer
set search_path = pg_catalog
as $$
declare
  v_now timestamptz;
  v_claim public.homepage_demo_claims%rowtype;
  v_authority public.homepage_demo_duplicate_override_authorities%rowtype;
  v_import_groups_hash text;
  v_save_outcome text;
  v_saved_project_id uuid;
  v_created boolean;
  v_row_count integer;
begin
  if p_claim_token_hash is null
    or p_claim_token_hash !~ '^[0-9a-f]{64}$'
    or p_authenticated_user_id is null
    or p_authority_token_hash is null
    or p_authority_token_hash !~ '^[0-9a-f]{64}$'
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_import_groups is null
    or jsonb_typeof(p_import_groups) is distinct from 'array'
    or jsonb_array_length(p_import_groups) <> 1 then
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

  v_import_groups_hash :=
    encode(sha256(convert_to(p_import_groups::text, 'UTF8')), 'hex');

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

  v_now := clock_timestamp();

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

  select authority.*
  into v_authority
  from public.homepage_demo_duplicate_override_authorities as authority
  where authority.authority_token_hash = p_authority_token_hash
  for update of authority;

  if not found then
    return query
      select
        'duplicate_authority_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  v_now := clock_timestamp();

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
      select
        'duplicate_authority_expired'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_authority.status = 'expired' then
    return query
      select
        'duplicate_authority_expired'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_authority.claim_id is distinct from v_claim.id
    or v_authority.authenticated_user_id is distinct from p_authenticated_user_id
    or v_authority.status is distinct from 'pending'
    or v_authority.consumed_at is not null
    or v_authority.request_hash is distinct from p_request_hash
    or v_authority.import_groups_hash is distinct from v_import_groups_hash then
    return query
      select
        'duplicate_authority_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  select save_result.outcome,
         save_result.saved_project_id,
         save_result.created
  into v_save_outcome,
       v_saved_project_id,
       v_created
  from public.claim_homepage_demo_project(
    p_claim_token_hash,
    p_authenticated_user_id,
    p_request_hash,
    p_import_groups,
    true
  ) as save_result;

  if not found then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
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

  return query
    select
      v_save_outcome,
      v_saved_project_id,
      v_created;
end;
$$;

revoke all on function public.prepare_homepage_demo_duplicate_override(
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) from public;

revoke all on function public.prepare_homepage_demo_duplicate_override(
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) from anon;

revoke all on function public.prepare_homepage_demo_duplicate_override(
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) from authenticated;

grant execute on function public.prepare_homepage_demo_duplicate_override(
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) to service_role;

revoke all on function public.claim_homepage_demo_project_with_duplicate_override(
  text,
  uuid,
  text,
  text,
  jsonb
) from public;

revoke all on function public.claim_homepage_demo_project_with_duplicate_override(
  text,
  uuid,
  text,
  text,
  jsonb
) from anon;

revoke all on function public.claim_homepage_demo_project_with_duplicate_override(
  text,
  uuid,
  text,
  text,
  jsonb
) from authenticated;

grant execute on function public.claim_homepage_demo_project_with_duplicate_override(
  text,
  uuid,
  text,
  text,
  jsonb
) to service_role;

comment on table public.homepage_demo_duplicate_override_authorities is
  'Private service-role-only Homepage Demo duplicate override authorities. Stores token hashes and claim/user/request/import-payload binding only; never raw authority tokens, claim tokens, duplicate project IDs, draft JSON, import payloads, or client/project/task content.';

comment on column public.homepage_demo_duplicate_override_authorities.authority_token_hash is
  'SHA-256 hash of the short-lived opaque duplicate override authority token. Raw authority tokens are never stored.';

comment on column public.homepage_demo_duplicate_override_authorities.request_hash is
  'Canonical request hash generated by trusted server code from the stored Homepage Demo draft.';

comment on column public.homepage_demo_duplicate_override_authorities.import_groups_hash is
  'Database-computed SHA-256 hash of the trusted transactional import groups JSONB text representation.';

comment on function public.prepare_homepage_demo_duplicate_override(
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) is
  'Service-role-only RPC that prepares or safely reuses a short-lived Homepage Demo duplicate override authority after trusted duplicate preflight. Returns only a safe outcome, cookie instruction, and expiry.';

comment on function public.claim_homepage_demo_project_with_duplicate_override(
  text,
  uuid,
  text,
  text,
  jsonb
) is
  'Service-role-only atomic Homepage Demo save-anyway RPC. Validates duplicate override authority and reuses claim_homepage_demo_project in one transaction, returning only a safe outcome code, saved project ID, and created/replayed flag.';
