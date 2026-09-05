-- Text2Task Owner User Activity Report
-- Migration: 202607210003_owner_user_activity_report_rpc.sql
--
-- Read-only owner analytics RPC for the "Users & Activity" admin sub-route
-- (/admin/analytics/users). Mirrors the structure and safety conventions of
-- the existing get_owner_product_activation_analytics() function.
--
-- This function reads only public.users and public.projects. It does NOT
-- read auth.users -- email, signup date, email-verification status,
-- authentication provider, and last sign-in are merged in application code
-- from supabase.auth.admin.listUsers(), which is Supabase's officially
-- supported mechanism for reading auth-schema fields without requiring a
-- database-level cross-schema grant.
--
-- p_limit is a safety cap (default 2000), not a UI page size -- the owner
-- sub-route paginates, sorts, and filters the already-bounded merged result
-- in application code, since public.users alone cannot represent Auth
-- accounts that have no profile row yet.

create or replace function public.get_owner_user_activity_report(
  p_limit int default 2000
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with project_stats as (
    select
      project_row.user_id,
      count(*)::bigint as project_count,
      min(project_row.created_at) as first_project_at,
      max(project_row.created_at) as last_project_at
    from public.projects as project_row
    where project_row.user_id is not null
    group by project_row.user_id
  ),
  report_rows as (
    select
      app_user.id,
      app_user.plan,
      app_user.subscription_status,
      app_user.extract_count,
      app_user.successful_extract_count,
      app_user.last_extract_at,
      app_user.last_dashboard_seen_at,
      app_user.created_at as profile_created_at,
      coalesce(project_stat.project_count, 0)::bigint as project_count,
      project_stat.first_project_at,
      project_stat.last_project_at
    from public.users as app_user
    left join project_stats as project_stat
      on project_stat.user_id = app_user.id
    order by app_user.created_at desc nulls last, app_user.id desc
    limit least(greatest(p_limit, 0), 2000)
  )
  select jsonb_build_object(
    'total_profiles', (select count(*)::bigint from public.users),
    'rows',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', report_row.id,
            'plan', report_row.plan,
            'subscription_status', report_row.subscription_status,
            'extract_count', report_row.extract_count,
            'successful_extract_count', report_row.successful_extract_count,
            'last_extract_at', report_row.last_extract_at,
            'last_dashboard_seen_at', report_row.last_dashboard_seen_at,
            'profile_created_at', report_row.profile_created_at,
            'project_count', report_row.project_count,
            'first_project_at', report_row.first_project_at,
            'last_project_at', report_row.last_project_at
          )
          order by report_row.profile_created_at desc nulls last, report_row.id desc
        )
        from report_rows as report_row
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.get_owner_user_activity_report(int) from public;
revoke all on function public.get_owner_user_activity_report(int) from anon;
revoke all on function public.get_owner_user_activity_report(int) from authenticated;

grant execute on function public.get_owner_user_activity_report(int) to service_role;

comment on function public.get_owner_user_activity_report(int) is
  'Owner analytics only. Read-only per-user activity aggregate (plan, subscription status, extraction/dashboard activity, project counts and timestamps) for the owner-only Users & Activity admin view. Does not read auth.users -- email, signup date, verification status, provider, and last sign-in are merged in application code from supabase.auth.admin.listUsers(). Returns no private project, task, client, message, file, resource, email, or token content.';
