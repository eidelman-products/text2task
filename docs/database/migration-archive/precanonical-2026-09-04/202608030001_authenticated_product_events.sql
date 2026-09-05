-- Text2Task Authenticated Product Events
-- Migration: 202608030001_authenticated_product_events.sql
--
-- Purpose:
-- Minimal, append-only log of deliberate authenticated "viewed this product
-- surface" events (Dashboard/Extract/Tasks/Calendar views, project-detail
-- expansion, Resources/History/Add Client Update openings, calendar
-- day/event views). Fills the gap documented in
-- docs/TEXT2TASK_MINIMAL_AUTHENTICATED_ACTIVITY_MAPPING.md: the existing
-- public.page_view events (via public.analytics_events) never carry an
-- authenticated user_id and are gated by marketing-analytics consent, so
-- they cannot answer "did this specific authenticated user return."
--
-- This is deliberately a NEW, SEPARATE table, not an extension of
-- public.analytics_events -- see the mapping document's section 10 for the
-- full justification. In short: analytics_events' own Overview traffic
-- queries (app/admin/analytics/page.tsx) select every row in their time
-- window with no event_name filter, so inserting these (comparatively
-- high-frequency, authenticated-only) events into that same table would
-- silently inflate "tracked events" marketing counters. This migration
-- does not modify public.analytics_events, its columns, its indexes, its
-- constraints, its RLS/grants, or any of its existing read paths in any
-- way.
--
-- Scope discipline: this table only ever records THAT a user viewed a
-- surface, WHICH surface, and WHEN -- never any client message, task text,
-- project title, client/contact name, email content, budget, note, file
-- name, screenshot, or other private/free-form content. There is
-- deliberately no metadata/jsonb column and no free-text content column,
-- enforcing that discipline structurally rather than by convention alone.
--
-- This migration is inert until the application commits that contain the
-- tracking endpoint and instrumentation are pushed and deployed to the
-- production application. The repository now contains that endpoint and
-- instrumentation, but production application code will not write here
-- merely because this migration has been applied manually.

create table if not exists public.authenticated_product_events (
  id uuid primary key default gen_random_uuid(),

  -- Always resolved server-side from the authenticated Supabase session --
  -- see lib/activity/product-event-contracts.ts's ValidatedProductEvent,
  -- which has no user-identity field at all, so a user_id can only ever
  -- reach this table from trusted server code, never from client input.
  user_id uuid not null references auth.users(id) on delete cascade,

  event_name text not null,
  route text not null,

  entity_type text null,
  entity_id text null,

  -- Server-computed deterministic retry key; never accepted from client
  -- input. The server hashes the authenticated user_id, validated
  -- navigationId, event_name, normalized route, normalized entity_type,
  -- and normalized entity_id. Exact retries collide on the unique partial
  -- index below; later deliberate openings use a different navigationId.
  idempotency_key text null,

  created_at timestamptz not null default now(),

  constraint authenticated_product_events_route_length_check
    check (char_length(route) <= 300),

  constraint authenticated_product_events_entity_type_check
    check (
      entity_type is null
      or entity_type in ('project', 'calendar_event', 'calendar_day')
    ),

  constraint authenticated_product_events_entity_id_length_check
    check (entity_id is null or char_length(entity_id) <= 64),

  -- entity_type/entity_id consistency, enforced as a single DB-level
  -- backstop mirroring lib/activity/product-event-contracts.ts's own
  -- validation exactly (matching this repository's established
  -- "enforced at every layer" convention for relationship invariants):
  --   - both null (a non-entity event, e.g. dashboard_viewed) -- allowed;
  --   - entity_type = 'calendar_day' requires entity_id to match a strict
  --     YYYY-MM-DD shape -- never a UUID, never free text. Full
  --     impossible-date validation is performed by the server contract
  --     before insertion;
  --   - entity_type in ('project', 'calendar_event') requires entity_id to
  --     be a well-formed UUID -- never a date, never free text.
  -- Any other combination (an entity_type with a null/malformed entity_id,
  -- or an entity_id with a null entity_type) is rejected by the database
  -- even if the application layer's own validation were ever bypassed.
  constraint authenticated_product_events_entity_consistency_check
    check (
      (entity_type is null and entity_id is null)
      or (
        entity_type = 'calendar_day'
        and entity_id ~ '^\d{4}-\d{2}-\d{2}$'
      )
      or (
        entity_type in ('project', 'calendar_event')
        and entity_id is not null
        and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
    )
);

-- Primary access pattern: one user's own timeline, newest first.
create index if not exists authenticated_product_events_user_id_created_at_idx
  on public.authenticated_product_events (user_id, created_at desc);

-- Admin-side filtering/aggregation by event type.
create index if not exists authenticated_product_events_event_name_idx
  on public.authenticated_product_events (event_name);

-- Dedup mechanism: the client supplies a validated navigationId UUID, the
-- server resolves user_id from the authenticated session, and the server
-- computes idempotency_key as a deterministic SHA-256 hash of user_id,
-- navigationId, event_name, normalized route, normalized entity_type, and
-- normalized entity_id. Exact retries collapse into one row through the
-- unique partial index; later deliberate openings receive a different
-- navigationId and therefore a different key.
create unique index if not exists authenticated_product_events_idempotency_key_unique_idx
  on public.authenticated_product_events (idempotency_key)
  where idempotency_key is not null;

alter table public.authenticated_product_events enable row level security;

-- No user-facing RLS policies are defined, by design. Combined with the
-- grants below (service_role only), this is default-deny for every other
-- role -- an authenticated application user can never read even their own
-- rows through PostgREST. Every read goes through an owner-only RPC (see
-- 202608030002_owner_authenticated_activity_report_rpc.sql), and every
-- write goes through trusted server code using the service-role client,
-- mirroring public.analytics_events' own exact security posture.
revoke all on table public.authenticated_product_events from public;
revoke all on table public.authenticated_product_events from anon;
revoke all on table public.authenticated_product_events from authenticated;
revoke all privileges
on table public.authenticated_product_events
from service_role;

grant select, insert on table public.authenticated_product_events
  to service_role;

comment on table public.authenticated_product_events is
  'Owner-analytics only. Append-only log of deliberate authenticated "viewed this product surface" events. Deliberately separate from public.analytics_events -- never shares that table''s traffic queries or dedupe mechanism. Service role only; never store client messages, task text, project titles, client/contact names, email content, budgets, notes, file names, screenshots, or other private/free-form content.';

comment on column public.authenticated_product_events.user_id is
  'Always resolved server-side from the authenticated Supabase session -- never accepted from client input. on delete cascade: this table holds authenticated-only rows, so a deleted account''s view history is deleted with it (unlike analytics_events, which uses on delete set null to preserve anonymous-attributable marketing rows).';

comment on column public.authenticated_product_events.event_name is
  'Validated against the allowlist in lib/activity/product-event-contracts.ts. No DB-level enum, matching analytics_events'' own convention, so adding a new event name never requires a migration.';

comment on column public.authenticated_product_events.entity_type is
  'One of project, calendar_event, calendar_day, or null for events with no associated entity (e.g. dashboard_viewed).';

comment on column public.authenticated_product_events.entity_id is
  'A UUID string when entity_type is project or calendar_event, or a strict YYYY-MM-DD shape when entity_type is calendar_day. Full impossible-date validation is performed server-side before insert; the database constraint backstops the storage shape -- never trusted as-is.';

comment on column public.authenticated_product_events.idempotency_key is
  'Server-computed deterministic SHA-256 retry key over user_id, validated navigationId, event_name, normalized route, normalized entity_type, and normalized entity_id -- never accepted from client input. Exact retries collide on the unique partial index above; later deliberate openings receive a different navigationId.';
