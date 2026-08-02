-- Text2Task Owner Authenticated Activity Report RPCs
-- Migration: 202608030002_owner_authenticated_activity_report_rpc.sql
--
-- Two read-only owner analytics RPCs over public.authenticated_product_events
-- (202608030001_authenticated_product_events.sql), for the owner-only
-- Users & Activity admin sub-route (/admin/analytics/users) and its planned
-- per-user timeline detail route. Mirrors the structure and safety
-- conventions of the existing get_owner_user_activity_report() and
-- get_owner_product_activation_analytics() functions exactly (language sql,
-- stable, security invoker, set search_path = public, revoke-then-grant to
-- service_role only).
--
-- Neither function is wired into any UI or application code by this
-- migration -- that is a later phase.
--
-- Argument choice for get_owner_authenticated_activity_summary:
-- p_user_ids uuid[] was chosen over a no-argument bounded report. The
-- existing Users & Activity page (app/admin/analytics/users/page.tsx)
-- already computes one bounded, deduplicated, unioned set of user ids by
-- merging supabaseAdmin.auth.admin.listUsers() (up to 5000 Auth accounts)
-- with get_owner_user_activity_report() (up to 2000 profiles) before any
-- per-user enrichment happens. Passing that exact same id set into this
-- third RPC keeps every source scoped to the SAME bounded set
-- deterministically. A no-argument "top N" report would instead apply its
-- own independent ordering/limit (e.g. "most authenticated views") that
-- could surface a DIFFERENT subset of users than the other two sources'
-- own "top N by signup/profile date" ordering, silently breaking the
-- merge's completeness for whichever user happened to fall outside
-- whichever independently-chosen top-N window. Scoping by the caller's
-- already-known id list also avoids aggregating rows for users who will
-- not even appear in the final merged/rendered table. The array is still
-- defensively capped server-side (see scoped_ids below) regardless of what
-- the (service-role-only) caller supplies.

create or replace function public.get_owner_authenticated_activity_summary(
  p_user_ids uuid[]
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with scoped_ids as (
    select distinct scoped_id.value as user_id
    from unnest(p_user_ids[1:2000]) as scoped_id(value)
    where scoped_id.value is not null
  ),
  scoped_events as (
    select
      event_row.id,
      event_row.user_id,
      event_row.event_name,
      event_row.route,
      event_row.created_at,
      (event_row.created_at at time zone 'Asia/Jerusalem')::date as israel_date
    from public.authenticated_product_events as event_row
    where event_row.user_id in (select scoped_id.user_id from scoped_ids as scoped_id)
  ),
  latest_event as (
    select distinct on (scoped_event.user_id)
      scoped_event.user_id,
      scoped_event.created_at as last_seen_at,
      scoped_event.route as last_viewed_route,
      scoped_event.event_name as last_event_name
    from scoped_events as scoped_event
    order by
      scoped_event.user_id,
      scoped_event.created_at desc,
      scoped_event.id desc
  ),
  activity_summary as (
    select
      scoped_event.user_id,
      count(*)::bigint as total_authenticated_views,
      count(distinct scoped_event.israel_date)::bigint as distinct_active_days
    from scoped_events as scoped_event
    group by scoped_event.user_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', summary_row.user_id,
        'last_seen_at', latest_row.last_seen_at,
        'last_viewed_route', latest_row.last_viewed_route,
        'last_event_name', latest_row.last_event_name,
        'total_authenticated_views', summary_row.total_authenticated_views,
        'distinct_active_days', summary_row.distinct_active_days,
        'is_returning', summary_row.distinct_active_days > 1
      )
      order by latest_row.last_seen_at desc nulls last, summary_row.user_id desc
    ),
    '[]'::jsonb
  )
  from activity_summary as summary_row
  join latest_event as latest_row on latest_row.user_id = summary_row.user_id;
$$;

revoke all on function public.get_owner_authenticated_activity_summary(uuid[]) from public;
revoke all on function public.get_owner_authenticated_activity_summary(uuid[]) from anon;
revoke all on function public.get_owner_authenticated_activity_summary(uuid[]) from authenticated;

grant execute on function public.get_owner_authenticated_activity_summary(uuid[])
  to service_role;

comment on function public.get_owner_authenticated_activity_summary(uuid[]) is
  'Owner-analytics only. Per-user authenticated-view summary (last_seen_at, last_viewed_route, last_event_name, total_authenticated_views, distinct_active_days, is_returning) for the given, server-capped (max 2000) set of user ids, read from public.authenticated_product_events. distinct_active_days is bucketed by Asia/Jerusalem calendar date, matching this repository''s existing owner-analytics timezone convention (lib/analytics/owner-analytics-window.ts, and the "Times shown in Israel time" convention already used by /admin/analytics/users). is_returning := distinct_active_days > 1. Returns no client message, task text, project title, client/contact name, email content, or other private/free-form content, because none is stored in the source table. Not yet called from any application code.';

create or replace function public.get_owner_user_activity_timeline(
  p_user_id uuid,
  p_limit int default 200
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with timeline_rows as (
    select
      event_row.id,
      event_row.created_at,
      event_row.event_name,
      event_row.route,
      event_row.entity_type,
      event_row.entity_id
    from public.authenticated_product_events as event_row
    where event_row.user_id = p_user_id
    order by event_row.created_at desc, event_row.id desc
    limit least(greatest(p_limit, 0), 500)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'created_at', timeline_row.created_at,
        'event_name', timeline_row.event_name,
        'route', timeline_row.route,
        'entity_type', timeline_row.entity_type,
        'entity_id', timeline_row.entity_id
      )
      order by timeline_row.created_at desc, timeline_row.id desc
    ),
    '[]'::jsonb
  )
  from timeline_rows as timeline_row;
$$;

revoke all on function public.get_owner_user_activity_timeline(uuid, int) from public;
revoke all on function public.get_owner_user_activity_timeline(uuid, int) from anon;
revoke all on function public.get_owner_user_activity_timeline(uuid, int) from authenticated;

grant execute on function public.get_owner_user_activity_timeline(uuid, int)
  to service_role;

comment on function public.get_owner_user_activity_timeline(uuid, int) is
  'Owner-analytics only. Ordered (newest first, deterministic id desc tiebreak) authenticated-view timeline for one user from public.authenticated_product_events -- created_at, event_name, route, entity_type, entity_id only. p_limit defaults to 200 and is clamped server-side to a hard ceiling of 500 regardless of the requested value. Returns no client message, task text, project title, client/contact name, email content, or other private/free-form content, because none is stored in the source table. Not yet called from any application code.';
