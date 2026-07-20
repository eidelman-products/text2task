-- Text2Task User Activity Write RPCs
-- Migration: 202607210002_user_activity_write_rpcs.sql
--
-- Atomic, additive-only activity writes. Both functions are called ONLY
-- after the corresponding core action (a successful extraction, or a
-- dashboard mount) has already completed / already rendered. Neither
-- function is ever part of a core request/response critical path, and
-- neither touches public.users.extract_count or any Free-plan quota field.

create or replace function public.record_successful_extraction(
  p_user_id uuid
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.users
  set
    successful_extract_count = successful_extract_count + 1,
    last_extract_at = now()
  where id = p_user_id;
$$;

revoke all on function public.record_successful_extraction(uuid) from public;
revoke all on function public.record_successful_extraction(uuid) from anon;
revoke all on function public.record_successful_extraction(uuid) from authenticated;

grant execute on function public.record_successful_extraction(uuid) to service_role;

comment on function public.record_successful_extraction(uuid) is
  'Owner-analytics only. Atomically increments successful_extract_count and sets last_extract_at for the given user, for any plan. Must only be called after an extraction has already succeeded and its response has already been prepared (see the after() callbacks in app/api/extract/route.ts and app/api/extract-image/route.ts) -- never inside the extraction critical path, and never as a substitute for public.users.extract_count, which continues to exclusively drive Free-plan quota enforcement.';

create or replace function public.record_dashboard_visit(
  p_user_id uuid
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.users
  set last_dashboard_seen_at = now()
  where id = p_user_id
    and (
      last_dashboard_seen_at is null
      or last_dashboard_seen_at < now() - interval '4 hours'
    );
$$;

revoke all on function public.record_dashboard_visit(uuid) from public;
revoke all on function public.record_dashboard_visit(uuid) from anon;
revoke all on function public.record_dashboard_visit(uuid) from authenticated;

grant execute on function public.record_dashboard_visit(uuid) to service_role;

comment on function public.record_dashboard_visit(uuid) is
  'Owner-analytics only. Records a dashboard visit at most once per 4-hour window per user; the WHERE clause makes this self-rate-limiting and safe to call on every dashboard mount. Must never block or affect dashboard rendering -- called fire-and-forget from app/api/activity/dashboard-visit/route.ts, a Route Handler invoked only after the client has already mounted.';
