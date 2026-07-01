-- Text2Task Homepage Demo Claim Model
-- Migration: 202607020001_homepage_demo_claim_model.sql
-- Created: 2026-07-02
--
-- Service-role-only claim authority for turning a temporary Homepage Demo
-- review draft into one authenticated project save. Stores operational IDs
-- and token hashes only; never raw tokens, client messages, extracted project
-- content, task content, email addresses, or personal data.

create extension if not exists "pgcrypto";

alter table public.homepage_demo_trials
  add constraint homepage_demo_trials_id_public_session_unique
  unique (id, public_token_hash, session_token_hash);

alter table public.homepage_demo_drafts
  add constraint homepage_demo_drafts_id_trial_id_unique
  unique (id, trial_id);

create table if not exists public.homepage_demo_claims (
  id uuid primary key default gen_random_uuid(),

  trial_id uuid null,
  draft_id uuid null,

  claim_token_hash text not null,
  public_token_hash text not null,
  session_token_hash text not null,

  status text not null default 'pending',
  expires_at timestamptz not null,

  claimed_by_user_id uuid null references auth.users(id) on delete set null,
  saved_project_id uuid null references public.projects(id) on delete set null,
  claimed_at timestamptz null,

  import_idempotency_key uuid not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint homepage_demo_claims_claim_token_hash_format_check
    check (claim_token_hash ~ '^[0-9a-f]{64}$'),

  constraint homepage_demo_claims_public_token_hash_format_check
    check (public_token_hash ~ '^[0-9a-f]{64}$'),

  constraint homepage_demo_claims_session_token_hash_format_check
    check (session_token_hash ~ '^[0-9a-f]{64}$'),

  constraint homepage_demo_claims_status_check
    check (status in ('pending', 'claimed', 'expired', 'cancelled')),

  constraint homepage_demo_claims_expires_after_created_check
    check (expires_at > created_at),

  constraint homepage_demo_claims_claimed_at_check
    check (claimed_at is null or claimed_at >= created_at),

  constraint homepage_demo_claims_lifecycle_metadata_check
    check (
      (
        status = 'pending'
        and claimed_by_user_id is null
        and saved_project_id is null
        and claimed_at is null
      )
      or (
        status = 'claimed'
        and claimed_at is not null
      )
      or (
        status in ('expired', 'cancelled')
        and claimed_by_user_id is null
        and saved_project_id is null
        and claimed_at is null
      )
    ),

  constraint homepage_demo_claims_claim_token_hash_unique
    unique (claim_token_hash),

  constraint homepage_demo_claims_import_idempotency_key_unique
    unique (import_idempotency_key),

  constraint homepage_demo_claims_trial_id_unique
    unique (trial_id),

  constraint homepage_demo_claims_draft_id_unique
    unique (draft_id),

  constraint homepage_demo_claims_trial_binding_fk
    foreign key (trial_id, public_token_hash, session_token_hash)
    references public.homepage_demo_trials(
      id,
      public_token_hash,
      session_token_hash
    )
    on delete set null (trial_id),

  constraint homepage_demo_claims_draft_trial_fk
    foreign key (draft_id, trial_id)
    references public.homepage_demo_drafts(id, trial_id)
    on delete set null (draft_id)
);

create index if not exists homepage_demo_claims_status_expires_at_idx
  on public.homepage_demo_claims(status, expires_at);

create index if not exists homepage_demo_claims_claimed_user_idx
  on public.homepage_demo_claims(claimed_by_user_id, claimed_at)
  where claimed_by_user_id is not null;

create index if not exists homepage_demo_claims_saved_project_idx
  on public.homepage_demo_claims(saved_project_id)
  where saved_project_id is not null;

drop trigger if exists set_homepage_demo_claims_updated_at
  on public.homepage_demo_claims;

create trigger set_homepage_demo_claims_updated_at
  before update on public.homepage_demo_claims
  for each row
  execute function public.set_homepage_demo_updated_at();

alter table public.homepage_demo_claims enable row level security;

revoke all privileges
on table public.homepage_demo_claims
from public, anon, authenticated;

revoke all privileges
on table public.homepage_demo_claims
from service_role;

grant select, insert, update, delete
on table public.homepage_demo_claims
to service_role;

comment on table public.homepage_demo_claims is
  'Private service-role-only Homepage Demo claim records. Stores one-time claim state, token hashes, linked trial/draft IDs, authenticated user ID, and saved project ID only; never raw tokens, client messages, extracted project content, task content, email addresses, or personal data. Temporary trial/draft links and deleted user/project links may be nulled without making a consumed claim reusable.';

comment on column public.homepage_demo_claims.trial_id is
  'Linked Homepage Demo trial while the temporary trial still exists. Set null if temporary trial data is later purged.';

comment on column public.homepage_demo_claims.draft_id is
  'Linked Homepage Demo draft while the temporary draft still exists. Set null if temporary draft data is later purged.';

comment on column public.homepage_demo_claims.claim_token_hash is
  'SHA-256 hash of the opaque one-time claim token. Raw claim tokens are never stored.';

comment on column public.homepage_demo_claims.public_token_hash is
  'SHA-256 hash copied from the linked anonymous Homepage Demo trial public token hash for server-side claim binding. Raw public tokens are never stored.';

comment on column public.homepage_demo_claims.session_token_hash is
  'SHA-256 hash copied from the linked anonymous Homepage Demo trial session token hash for server-side claim binding. Raw session tokens are never stored.';

comment on column public.homepage_demo_claims.status is
  'Claim lifecycle state: pending, claimed, expired, or cancelled. Only pending claims are eligible for future claim/save processing.';

comment on column public.homepage_demo_claims.import_idempotency_key is
  'Server-generated UUID reserved for the authenticated project import transaction so committed claim saves can be replayed safely.';

comment on column public.homepage_demo_claims.claimed_by_user_id is
  'Authenticated user who successfully claimed the temporary Homepage Demo draft. May be set null by account deletion without making the claim reusable.';

comment on column public.homepage_demo_claims.saved_project_id is
  'Authenticated project created by the future transactional claim/save flow. May be set null by project deletion without making the claim reusable.';
