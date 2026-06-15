-- Text2Task Transactional Project Bulk Actions
-- Migration: 202606150002_transactional_project_bulk_actions.sql
-- Created: 2026-06-15
--
-- Phase 3B.1:
-- Atomically archive, restore, or soft-delete project targets and all related
-- tasks. Legacy task-group targets remain on the existing route until Phase
-- 3B.2.

create or replace function public.apply_project_bulk_action_transaction(
  p_action text,
  p_project_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_project_ids uuid[];
  v_project_id uuid;
  v_owned_project_count integer := 0;
  v_affected_project_ids uuid[] := array[]::uuid[];
  v_affected_task_ids bigint[] := array[]::bigint[];
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'UNAUTHORIZED';
  end if;

  if p_action is null or p_action not in ('archive', 'restore', 'soft_delete') then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ACTION';
  end if;

  if p_project_ids is null or cardinality(p_project_ids) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_PROJECT_IDS';
  end if;

  if cardinality(p_project_ids) > 100 then
    raise exception using
      errcode = 'P0001',
      message = 'TOO_MANY_PROJECTS';
  end if;

  if exists (
    select 1
    from unnest(p_project_ids) as requested(project_id)
    where requested.project_id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_PROJECT_IDS';
  end if;

  select array_agg(distinct requested.project_id order by requested.project_id)
  into v_project_ids
  from unnest(p_project_ids) as requested(project_id);

  -- Lock owned project rows in a deterministic order before any mutation.
  for v_project_id in
    select project.id
    from public.projects as project
    where project.id = any(v_project_ids)
      and project.user_id = v_user_id
    order by project.id
    for update of project
  loop
    v_owned_project_count := v_owned_project_count + 1;
  end loop;

  if v_owned_project_count <> cardinality(v_project_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'TARGET_VALIDATION_FAILED';
  end if;

  with updated_projects as (
    update public.projects as project
    set
      is_archived = case
        when p_action = 'restore' then false
        else true
      end,
      archived_at = case
        when p_action = 'restore' then null
        else v_now
      end,
      deleted_at = case
        when p_action = 'soft_delete' then v_now
        else project.deleted_at
      end
    where project.id = any(v_project_ids)
      and project.user_id = v_user_id
    returning project.id
  )
  select coalesce(
    array_agg(updated_projects.id order by updated_projects.id),
    array[]::uuid[]
  )
  into v_affected_project_ids
  from updated_projects;

  if cardinality(v_affected_project_ids) <> cardinality(v_project_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_UPDATE_FAILED';
  end if;

  with updated_tasks as (
    update public.tasks as task
    set
      is_archived = case
        when p_action = 'restore' then false
        else true
      end,
      archived_at = case
        when p_action = 'restore' then null
        else v_now
      end,
      deleted_at = case
        when p_action = 'soft_delete' then v_now
        else task.deleted_at
      end
    where task.project_id = any(v_project_ids)
      and task.user_id = v_user_id
      and (p_action = 'soft_delete' or task.deleted_at is null)
    returning task.id
  )
  select coalesce(
    array_agg(updated_tasks.id order by updated_tasks.id),
    array[]::bigint[]
  )
  into v_affected_task_ids
  from updated_tasks;

  return jsonb_build_object(
    'action', p_action,
    'affectedProjectIds', to_jsonb(v_affected_project_ids),
    'affectedTaskIds', to_jsonb(v_affected_task_ids)
  );
end;
$$;

revoke all on function public.apply_project_bulk_action_transaction(text, uuid[])
  from public;

revoke all on function public.apply_project_bulk_action_transaction(text, uuid[])
  from anon;

grant execute on function public.apply_project_bulk_action_transaction(text, uuid[])
  to authenticated;

comment on function public.apply_project_bulk_action_transaction(text, uuid[]) is
  'Atomically archives, restores, or soft-deletes owned projects and their related tasks. Project targets only; legacy task groups are handled separately until Phase 3B.2.';
