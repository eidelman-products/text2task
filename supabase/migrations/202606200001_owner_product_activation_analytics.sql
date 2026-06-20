-- Text2Task Owner Product Activation Analytics
-- Migration: 202606200001_owner_product_activation_analytics.sql
--
-- Read-only owner analytics RPC for exact product activation reporting.

create index if not exists projects_user_id_created_at_idx
  on public.projects(user_id, created_at);

create index if not exists users_created_at_desc_idx
  on public.users(created_at desc);

create or replace function public.get_owner_product_activation_analytics()
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
      min(project_row.created_at) as first_project_saved_at
    from public.projects as project_row
    where project_row.user_id is not null
    group by project_row.user_id
  ),
  summary as (
    select
      (select count(*)::bigint from public.users) as total_users,
      (select count(*)::bigint from public.projects) as total_projects,
      (
        select count(*)::bigint
        from public.users as app_user
        where exists (
          select 1
          from project_stats as project_stat
          where project_stat.user_id = app_user.id
        )
      ) as activated_users
  ),
  recent_users as (
    select
      app_user.id as user_id,
      app_user.created_at as signup_at,
      coalesce(project_stat.project_count, 0)::bigint as project_count,
      project_stat.first_project_saved_at
    from public.users as app_user
    left join project_stats as project_stat
      on project_stat.user_id = app_user.id
    order by app_user.created_at desc nulls last, app_user.id desc
    limit 25
  )
  select jsonb_build_object(
    'summary',
    jsonb_build_object(
      'total_users', summary.total_users,
      'total_projects', summary.total_projects,
      'activated_users', summary.activated_users,
      'not_activated_users', greatest(summary.total_users - summary.activated_users, 0)
    ),
    'recent_users',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', recent_user.user_id,
            'signup_at', recent_user.signup_at,
            'project_count', recent_user.project_count,
            'first_project_saved_at', recent_user.first_project_saved_at
          )
          order by recent_user.signup_at desc nulls last, recent_user.user_id desc
        )
        from recent_users as recent_user
      ),
      '[]'::jsonb
    )
  )
  from summary;
$$;

revoke all on function public.get_owner_product_activation_analytics()
  from public;
revoke all on function public.get_owner_product_activation_analytics()
  from anon;
revoke all on function public.get_owner_product_activation_analytics()
  from authenticated;

grant execute on function public.get_owner_product_activation_analytics()
  to service_role;

comment on function public.get_owner_product_activation_analytics() is
  'Owner analytics only. Read-only exact product activation summary and newest-user project aggregates. All historical project rows count toward activation, including archived and soft-deleted projects. Returns no private project, task, client, message, file, resource, email, or token content.';
