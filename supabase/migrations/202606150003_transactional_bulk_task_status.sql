-- Text2Task Transactional Bulk Task Status
-- Migration: 202606150003_transactional_bulk_task_status.sql
-- Created: 2026-06-15
--
-- Phase 3C.1:
-- Atomically update selected owned tasks to Done or In Progress and reconcile
-- project completion for Done updates.

create or replace function public.apply_task_bulk_status_transaction(
  p_task_ids bigint[],
  p_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_task_ids bigint[];
  v_task_id bigint;
  v_requested_task_count integer := 0;
  v_locked_task_count integer := 0;
  v_project_ids uuid[] := array[]::uuid[];
  v_locked_project_ids uuid[] := array[]::uuid[];
  v_project_id uuid;
  v_affected_task_ids bigint[] := array[]::bigint[];
  v_completed_candidate_project_ids uuid[] := array[]::uuid[];
  v_completed_project_ids uuid[] := array[]::uuid[];
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'UNAUTHORIZED';
  end if;

  if p_status is null or p_status not in ('Done', 'In Progress') then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_STATUS';
  end if;

  if p_task_ids is null or cardinality(p_task_ids) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_TASK_IDS';
  end if;

  if cardinality(p_task_ids) > 500 then
    raise exception using
      errcode = 'P0001',
      message = 'TOO_MANY_TASKS';
  end if;

  if exists (
    select 1
    from unnest(p_task_ids) as requested(task_id)
    where requested.task_id is null
      or requested.task_id <= 0
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_TASK_IDS';
  end if;

  select array_agg(distinct requested.task_id order by requested.task_id)
  into v_task_ids
  from unnest(p_task_ids) as requested(task_id);

  -- Prevalidate ownership before taking project locks. The selected task rows
  -- are locked and revalidated again before any mutation.
  select
    count(*)::integer,
    coalesce(
      array_agg(distinct task.project_id order by task.project_id)
        filter (where task.project_id is not null),
      array[]::uuid[]
    )
  into v_requested_task_count, v_project_ids
  from public.tasks as task
  where task.id = any(v_task_ids)
    and task.user_id = v_user_id
    and task.deleted_at is null;

  if v_requested_task_count <> cardinality(v_task_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'TARGET_VALIDATION_FAILED';
  end if;

  -- Match the project-first lock order used by transactional project actions.
  -- Deleted or otherwise unavailable projects are intentionally skipped,
  -- preserving the existing task-update behavior.
  for v_project_id in
    select project.id
    from public.projects as project
    where project.id = any(v_project_ids)
      and project.user_id = v_user_id
      and project.deleted_at is null
    order by project.id
    for update of project
  loop
    null;
  end loop;

  -- Stabilize active task state for project completion calculation before
  -- locking any remaining selected standalone or archived tasks.
  if cardinality(v_project_ids) > 0 then
    for v_task_id in
      select task.id
      from public.tasks as task
      where task.project_id = any(v_project_ids)
        and task.user_id = v_user_id
        and (task.is_archived = false or task.is_archived is null)
        and task.deleted_at is null
      order by task.id
      for update of task
    loop
      null;
    end loop;
  end if;

  -- Lock every selected task in deterministic order and revalidate that all
  -- requested targets are still owned and available before mutation.
  for v_task_id in
    select task.id
    from public.tasks as task
    where task.id = any(v_task_ids)
      and task.user_id = v_user_id
      and task.deleted_at is null
    order by task.id
    for update of task
  loop
    v_locked_task_count := v_locked_task_count + 1;
  end loop;

  if v_locked_task_count <> cardinality(v_task_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'TARGET_VALIDATION_FAILED';
  end if;

  select coalesce(
    array_agg(distinct task.project_id order by task.project_id)
      filter (where task.project_id is not null),
    array[]::uuid[]
  )
  into v_locked_project_ids
  from public.tasks as task
  where task.id = any(v_task_ids)
    and task.user_id = v_user_id
    and task.deleted_at is null;

  if v_locked_project_ids is distinct from v_project_ids then
    raise exception using
      errcode = 'P0001',
      message = 'CONCURRENT_MODIFICATION';
  end if;

  with updated_tasks as (
    update public.tasks as task
    set
      status = p_status,
      updated_at = v_now,
      completed_at = case
        when p_status = 'Done' and task.completed_at is null then v_now
        else task.completed_at
      end
    where task.id = any(v_task_ids)
      and task.user_id = v_user_id
      and task.deleted_at is null
    returning task.id
  )
  select coalesce(
    array_agg(updated_tasks.id order by updated_tasks.id),
    array[]::bigint[]
  )
  into v_affected_task_ids
  from updated_tasks;

  if cardinality(v_affected_task_ids) <> cardinality(v_task_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'TASK_UPDATE_FAILED';
  end if;

  if p_status = 'Done' and cardinality(v_project_ids) > 0 then
    select coalesce(
      array_agg(completed_project.project_id order by completed_project.project_id),
      array[]::uuid[]
    )
    into v_completed_candidate_project_ids
    from (
      select task.project_id
      from public.tasks as task
      join public.projects as project
        on project.id = task.project_id
       and project.user_id = v_user_id
       and project.deleted_at is null
      where task.project_id = any(v_project_ids)
        and task.user_id = v_user_id
        and (task.is_archived = false or task.is_archived is null)
        and task.deleted_at is null
      group by task.project_id
      having count(*) > 0
        and bool_and(lower(btrim(coalesce(task.status::text, ''))) = 'done')
    ) as completed_project;

    if cardinality(v_completed_candidate_project_ids) > 0 then
      with updated_projects as (
        update public.projects as project
        set
          status = 'Done',
          priority = 'Low',
          updated_at = v_now,
          completed_at = coalesce(project.completed_at, v_now)
        where project.id = any(v_completed_candidate_project_ids)
          and project.user_id = v_user_id
          and project.deleted_at is null
        returning project.id
      )
      select coalesce(
        array_agg(updated_projects.id order by updated_projects.id),
        array[]::uuid[]
      )
      into v_completed_project_ids
      from updated_projects;

      if cardinality(v_completed_project_ids) <>
        cardinality(v_completed_candidate_project_ids) then
        raise exception using
          errcode = 'P0001',
          message = 'PROJECT_UPDATE_FAILED';
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'status', p_status,
    'affectedTaskIds', to_jsonb(v_affected_task_ids),
    'affectedProjectIds', to_jsonb(v_project_ids),
    'completedProjectIds', to_jsonb(v_completed_project_ids)
  );
end;
$$;

revoke all on function public.apply_task_bulk_status_transaction(bigint[], text)
  from public;

revoke all on function public.apply_task_bulk_status_transaction(bigint[], text)
  from anon;

grant execute on function public.apply_task_bulk_status_transaction(bigint[], text)
  to authenticated;

comment on function public.apply_task_bulk_status_transaction(bigint[], text) is
  'Atomically updates selected owned tasks to Done or In Progress and completes qualifying related projects.';
