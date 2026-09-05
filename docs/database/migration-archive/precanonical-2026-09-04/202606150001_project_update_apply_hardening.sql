-- Text2Task Project Update Apply Hardening
-- Migration: 202606150001_project_update_apply_hardening.sql
-- Created: 2026-06-15
--
-- Adds an explicit in-progress state and operational fields so apply attempts
-- can be atomically claimed, inspected, and recovered without automatically
-- retrying a potentially partially-applied update.

alter table public.project_updates
  add column if not exists apply_started_at timestamptz null,
  add column if not exists apply_attempt_id uuid null,
  add column if not exists apply_failed_at timestamptz null,
  add column if not exists apply_error_code text null;

alter table public.project_updates
  drop constraint if exists project_updates_status_check;

alter table public.project_updates
  add constraint project_updates_status_check
  check (
    status in (
      'draft',
      'analyzed',
      'reviewed',
      'applying',
      'applied',
      'ignored',
      'failed'
    )
  ) not valid;

alter table public.project_updates
  validate constraint project_updates_status_check;

comment on column public.project_updates.apply_started_at is
  'Timestamp when the latest apply attempt atomically claimed this update.';

comment on column public.project_updates.apply_attempt_id is
  'Operational identifier for the latest claimed apply attempt.';

comment on column public.project_updates.apply_failed_at is
  'Timestamp when the latest claimed apply attempt was marked failed.';

comment on column public.project_updates.apply_error_code is
  'Safe operational failure code for inspecting a failed apply attempt.';
