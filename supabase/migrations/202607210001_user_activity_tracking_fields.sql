-- Text2Task User Activity Tracking Fields
-- Migration: 202607210001_user_activity_tracking_fields.sql
--
-- Additive columns for the owner-only "Users & Product Activity" admin view.
--
-- Deliberately separate from public.users.extract_count, which continues to
-- exclusively drive Free-plan quota enforcement unchanged (see
-- app/api/extract/route.ts and app/api/extract-image/route.ts). These new
-- columns are written only after a core action has already completed
-- successfully, via a deferred (next/server after()) fail-open path -- never
-- inside the extraction or dashboard critical response path.

alter table if exists public.users
  add column if not exists successful_extract_count integer not null default 0,
  add column if not exists last_extract_at timestamptz,
  add column if not exists last_dashboard_seen_at timestamptz;

create index if not exists users_last_extract_at_idx
  on public.users(last_extract_at desc nulls last);

create index if not exists users_last_dashboard_seen_at_idx
  on public.users(last_dashboard_seen_at desc nulls last);

comment on column public.users.successful_extract_count is
  'Owner-analytics only. Counts successful text+image extractions for ALL plans (Free and Pro). Written via public.record_successful_extraction() after the extraction response has already been sent. Never used for Free-plan quota enforcement -- that remains driven exclusively by public.users.extract_count, which this column does not modify, rename, or replace.';

comment on column public.users.last_extract_at is
  'Owner-analytics only. Timestamp of the most recent successful extraction (text or image), for any plan. Written via public.record_successful_extraction() after the response has already been sent.';

comment on column public.users.last_dashboard_seen_at is
  'Owner-analytics only. Timestamp of the most recent dashboard visit, rate-limited to at most once per 4-hour window. Written by public.record_dashboard_visit(), called fire-and-forget from app/api/activity/dashboard-visit/route.ts after the client has already mounted.';
