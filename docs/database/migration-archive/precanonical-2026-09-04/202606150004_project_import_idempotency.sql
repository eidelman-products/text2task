-- Text2Task Project Import Idempotency
-- Migration: 202606150004_project_import_idempotency.sql
-- Created: 2026-06-15
--
-- Phase 3D.1:
-- Records Project Import attempts so committed imports can be replayed safely
-- and concurrent or failed attempts cannot automatically rerun writes.

create table if not exists public.project_import_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  request_hash text not null,
  status text not null default 'started',
  result_json jsonb null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  failed_at timestamptz null,
  error_code text null,
  constraint project_import_attempts_user_key_unique
    unique (user_id, idempotency_key),
  constraint project_import_attempts_status_check
    check (status in ('started', 'committed', 'failed'))
);

create index if not exists project_import_attempts_user_status_idx
  on public.project_import_attempts(user_id, status);

create index if not exists project_import_attempts_created_at_idx
  on public.project_import_attempts(created_at desc);

alter table public.project_import_attempts enable row level security;

drop policy if exists "Users can view own project import attempts"
  on public.project_import_attempts;
create policy "Users can view own project import attempts"
  on public.project_import_attempts
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own project import attempts"
  on public.project_import_attempts;
create policy "Users can insert own project import attempts"
  on public.project_import_attempts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own project import attempts"
  on public.project_import_attempts;
create policy "Users can update own project import attempts"
  on public.project_import_attempts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on table public.project_import_attempts from public;
revoke all on table public.project_import_attempts from anon;

grant select, insert, update on table public.project_import_attempts
  to authenticated;

comment on table public.project_import_attempts is
  'Operational idempotency records for Project Import / Extract Save to CRM.';

comment on column public.project_import_attempts.idempotency_key is
  'Client-generated UUID reused for one import flow, including duplicate override retries.';

comment on column public.project_import_attempts.request_hash is
  'SHA-256 hash of canonical normalized project data, excluding duplicate override decisions.';

comment on column public.project_import_attempts.result_json is
  'Stored successful import response returned for safe replay after commit.';

comment on column public.project_import_attempts.error_code is
  'Safe operational failure code, or AWAITING_DUPLICATE_OVERRIDE while the same attempt may be safely resumed for duplicate review.';
