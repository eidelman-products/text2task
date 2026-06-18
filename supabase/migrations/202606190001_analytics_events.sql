-- Text2Task Internal Analytics Events
-- Migration: 202606190001_analytics_events.sql
-- Created: 2026-06-19
--
-- Purpose:
-- Private, owner-only product analytics for operational visibility.
-- This table is internal analytics only and must never store raw client
-- messages, screenshots, task text, project summaries, resource content,
-- passwords, tokens, or other sensitive/private customer data.

create extension if not exists "pgcrypto";

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),

  event_name text not null,
  occurred_at timestamptz not null default now(),

  user_id uuid null references auth.users(id) on delete set null,
  anonymous_id text null,

  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  utm_content text null,
  referrer text null,
  landing_page text null,
  page_path text null,
  country_code text null,

  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text null,

  created_at timestamptz not null default now(),

  constraint analytics_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists analytics_events_occurred_at_idx
  on public.analytics_events(occurred_at desc);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events(event_name);

create index if not exists analytics_events_user_id_idx
  on public.analytics_events(user_id);

create index if not exists analytics_events_anonymous_id_idx
  on public.analytics_events(anonymous_id);

create index if not exists analytics_events_utm_source_idx
  on public.analytics_events(utm_source);

create index if not exists analytics_events_utm_campaign_idx
  on public.analytics_events(utm_campaign);

create index if not exists analytics_events_country_code_idx
  on public.analytics_events(country_code);

create unique index if not exists analytics_events_idempotency_key_unique_idx
  on public.analytics_events(idempotency_key)
  where idempotency_key is not null;

alter table public.analytics_events enable row level security;

revoke all on table public.analytics_events from public;
revoke all on table public.analytics_events from anon;
revoke all on table public.analytics_events from authenticated;

grant select, insert on table public.analytics_events
  to service_role;

comment on table public.analytics_events is
  'Private internal analytics events for Text2Task owner-only reporting. Service role only; do not store sensitive customer content.';

comment on column public.analytics_events.metadata is
  'Sanitized operational metadata only. Never store raw messages, screenshots, task text, summaries, resources, passwords, tokens, or private client data.';

comment on column public.analytics_events.idempotency_key is
  'Optional event-level dedupe key for safely logging successful product actions without duplicate analytics rows.';
