-- Text2Task Homepage Demo Trials
-- Migration: 202606270002_homepage_demo_trials.sql
-- Created: 2026-06-27
--
-- Private, service-role-only persistence foundation for future anonymous
-- homepage live demo trials and temporary review drafts.
--
-- Security/data-minimization rules:
-- - Store only token hashes, never raw browser-visible tokens.
-- - Store operational trial metadata only in homepage_demo_trials.
-- - Do not store pasted text, OCR text, image bytes, base64, prompts,
--   raw model output, IP addresses, user agents, fingerprints, analytics
--   payloads, or client/customer content in the trial table.
-- - Draft JSON is temporary, server-controlled, expires hard, and is never
--   directly readable or writable by browser database clients.

create extension if not exists "pgcrypto";

create table if not exists public.homepage_demo_trials (
  id uuid primary key default gen_random_uuid(),

  public_token_hash text not null,
  session_token_hash text not null,
  idempotency_key_hash text not null,

  input_type text not null,
  status text not null default 'created',
  risk_state text not null default 'not_evaluated',
  failure_code text null,

  expires_at timestamptz not null,

  claimed_by_user_id uuid null references auth.users(id) on delete cascade,
  claimed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint homepage_demo_trials_public_token_hash_format_check
    check (public_token_hash ~ '^[0-9a-f]{64}$'),

  constraint homepage_demo_trials_session_token_hash_format_check
    check (session_token_hash ~ '^[0-9a-f]{64}$'),

  constraint homepage_demo_trials_idempotency_key_hash_format_check
    check (idempotency_key_hash ~ '^[0-9a-f]{64}$'),

  constraint homepage_demo_trials_input_type_check
    check (input_type in ('text', 'image')),

  constraint homepage_demo_trials_status_check
    check (
      status in (
        'created',
        'validating',
        'queued',
        'processing',
        'review_ready',
        'failed',
        'blocked',
        'claimed',
        'expired'
      )
    ),

  constraint homepage_demo_trials_risk_state_check
    check (
      risk_state in (
        'not_evaluated',
        'allowed',
        'challenge_required',
        'blocked'
      )
    ),

  constraint homepage_demo_trials_failure_code_check
    check (
      failure_code is null
      or (
        char_length(failure_code) <= 80
        and failure_code ~ '^[a-z0-9_:-]+$'
        and status in ('failed', 'blocked')
      )
    ),

  constraint homepage_demo_trials_expires_after_created_check
    check (expires_at > created_at),

  constraint homepage_demo_trials_claim_metadata_check
    check (
      (
        status = 'claimed'
        and claimed_by_user_id is not null
        and claimed_at is not null
      )
      or (
        status <> 'claimed'
        and claimed_by_user_id is null
        and claimed_at is null
      )
    )
);

create unique index if not exists homepage_demo_trials_public_token_hash_unique_idx
  on public.homepage_demo_trials(public_token_hash);

create unique index if not exists homepage_demo_trials_session_token_hash_unique_idx
  on public.homepage_demo_trials(session_token_hash);

create unique index if not exists homepage_demo_trials_idempotency_key_hash_unique_idx
  on public.homepage_demo_trials(idempotency_key_hash);

create index if not exists homepage_demo_trials_status_idx
  on public.homepage_demo_trials(status);

create index if not exists homepage_demo_trials_expires_at_idx
  on public.homepage_demo_trials(expires_at);

create index if not exists homepage_demo_trials_status_expires_at_idx
  on public.homepage_demo_trials(status, expires_at);

create table if not exists public.homepage_demo_drafts (
  id uuid primary key default gen_random_uuid(),

  trial_id uuid not null references public.homepage_demo_trials(id) on delete cascade,

  status text not null default 'pending',
  schema_version text not null,
  engine_version text not null,

  normalized_result jsonb null,
  edited_result jsonb null,

  expires_at timestamptz not null,

  claimed_by_user_id uuid null references auth.users(id) on delete cascade,
  claimed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint homepage_demo_drafts_status_check
    check (status in ('pending', 'ready', 'claimed', 'expired')),

  constraint homepage_demo_drafts_schema_version_check
    check (
      char_length(btrim(schema_version)) between 1 and 80
      and schema_version ~ '^[A-Za-z0-9_.:-]+$'
    ),

  constraint homepage_demo_drafts_engine_version_check
    check (
      char_length(btrim(engine_version)) between 1 and 80
      and engine_version ~ '^[A-Za-z0-9_.:-]+$'
    ),

  constraint homepage_demo_drafts_normalized_result_object_check
    check (
      normalized_result is null
      or jsonb_typeof(normalized_result) = 'object'
    ),

  constraint homepage_demo_drafts_edited_result_object_check
    check (
      edited_result is null
      or jsonb_typeof(edited_result) = 'object'
    ),

  constraint homepage_demo_drafts_ready_result_check
    check (
      status not in ('ready', 'claimed')
      or normalized_result is not null
    ),

  constraint homepage_demo_drafts_expires_after_created_check
    check (expires_at > created_at),

  constraint homepage_demo_drafts_claim_metadata_check
    check (
      (
        status = 'claimed'
        and claimed_by_user_id is not null
        and claimed_at is not null
      )
      or (
        status <> 'claimed'
        and claimed_by_user_id is null
        and claimed_at is null
      )
    )
);

create unique index if not exists homepage_demo_drafts_trial_id_unique_idx
  on public.homepage_demo_drafts(trial_id);

create index if not exists homepage_demo_drafts_status_idx
  on public.homepage_demo_drafts(status);

create index if not exists homepage_demo_drafts_expires_at_idx
  on public.homepage_demo_drafts(expires_at);

create index if not exists homepage_demo_drafts_status_expires_at_idx
  on public.homepage_demo_drafts(status, expires_at);

create or replace function public.set_homepage_demo_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists homepage_demo_trials_set_updated_at
  on public.homepage_demo_trials;

create trigger homepage_demo_trials_set_updated_at
before update on public.homepage_demo_trials
for each row
execute function public.set_homepage_demo_updated_at();

drop trigger if exists homepage_demo_drafts_set_updated_at
  on public.homepage_demo_drafts;

create trigger homepage_demo_drafts_set_updated_at
before update on public.homepage_demo_drafts
for each row
execute function public.set_homepage_demo_updated_at();

alter table public.homepage_demo_trials enable row level security;
alter table public.homepage_demo_drafts enable row level security;

revoke all on table public.homepage_demo_trials from public;
revoke all on table public.homepage_demo_trials from anon;
revoke all on table public.homepage_demo_trials from authenticated;

revoke all on table public.homepage_demo_drafts from public;
revoke all on table public.homepage_demo_drafts from anon;
revoke all on table public.homepage_demo_drafts from authenticated;

grant select, insert, update, delete on table public.homepage_demo_trials
  to service_role;

grant select, insert, update, delete on table public.homepage_demo_drafts
  to service_role;

revoke all on function public.set_homepage_demo_updated_at()
  from public;
revoke all on function public.set_homepage_demo_updated_at()
  from anon;
revoke all on function public.set_homepage_demo_updated_at()
  from authenticated;

grant execute on function public.set_homepage_demo_updated_at()
  to service_role;

comment on table public.homepage_demo_trials is
  'Private service-role-only anonymous homepage demo trial records. Stores operational metadata and token hashes only; never raw tokens, prompts, raw input, image bytes, OCR text, model output, IPs, user agents, fingerprints, analytics payloads, or customer content.';

comment on table public.homepage_demo_drafts is
  'Private service-role-only temporary homepage demo review drafts. Draft JSON is server-controlled, expires hard, and is never directly readable or writable by browser database clients.';

comment on column public.homepage_demo_trials.public_token_hash is
  'SHA-256 hash of the opaque public review token with homepage-demo-public purpose separation. Raw token is never stored.';

comment on column public.homepage_demo_trials.session_token_hash is
  'SHA-256 hash of the opaque anonymous session token with homepage-demo-session purpose separation. Raw token is never stored.';

comment on column public.homepage_demo_trials.idempotency_key_hash is
  'SHA-256 hash of the opaque creation idempotency key with homepage-demo-idempotency purpose separation. Raw key is never stored.';

comment on column public.homepage_demo_trials.input_type is
  'Input class requested by the future gateway: text or image only.';

comment on column public.homepage_demo_trials.status is
  'Explicit trial lifecycle state: created, validating, queued, processing, review_ready, failed, blocked, claimed, or expired.';

comment on column public.homepage_demo_trials.risk_state is
  'Safe operational abuse-review state only: not_evaluated, allowed, challenge_required, or blocked.';

comment on column public.homepage_demo_trials.failure_code is
  'Bounded sanitized internal category only. Never store provider errors, user content, prompts, or raw model output.';

comment on column public.homepage_demo_trials.expires_at is
  'Hard expiration deadline for the anonymous trial.';

comment on column public.homepage_demo_drafts.trial_id is
  'One-to-one service-controlled draft for a homepage demo trial.';

comment on column public.homepage_demo_drafts.schema_version is
  'Server-owned normalized-result schema version identifier.';

comment on column public.homepage_demo_drafts.engine_version is
  'Server-owned extraction engine version identifier.';

comment on column public.homepage_demo_drafts.normalized_result is
  'Temporary normalized review result JSON object. Nullable while pending; never directly exposed through database client roles.';

comment on column public.homepage_demo_drafts.edited_result is
  'Temporary future Review-page edited result JSON object. Never directly exposed through database client roles.';

comment on column public.homepage_demo_drafts.expires_at is
  'Hard expiration deadline for the temporary draft.';
