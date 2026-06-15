-- Text2Task Transactional Project Client Identity Update
-- Migration: 202606150007_transactional_project_client_identity.sql
-- Created: 2026-06-15
--
-- Phase 3E.2:
-- Atomically updates an owned project's client/contact identity, its linked
-- client row when present, and compatibility fields on related task rows.

create or replace function public.update_project_client_identity_transaction(
  p_project_id uuid,
  p_field text,
  p_value text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_project public.projects%rowtype;
  v_updated_project public.projects%rowtype;
  v_client public.clients%rowtype;
  v_client_json jsonb := 'null'::jsonb;
  v_affected_count integer := 0;
  v_expected_task_count integer := 0;
  v_task_id bigint;
  v_value text;
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'UNAUTHORIZED';
  end if;

  if p_project_id is null
    or p_field is null
    or p_field not in ('client_name', 'contact_name') then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_REQUEST';
  end if;

  v_value := case
    when p_field = 'client_name' then btrim(coalesce(p_value, ''))
    else nullif(btrim(coalesce(p_value, '')), '')
  end;

  if p_field = 'client_name' and v_value = '' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CLIENT_NAME';
  end if;

  select project.*
  into v_project
  from public.projects as project
  where project.id = p_project_id
    and project.user_id = v_user_id
    and project.deleted_at is null
  for update of project;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_NOT_FOUND';
  end if;

  if v_project.client_id is not null then
    if p_field = 'client_name' then
      update public.clients as client
      set name = v_value
      where client.id = v_project.client_id
        and client.user_id = v_user_id
      returning client.* into v_client;
    else
      update public.clients as client
      set contact_name = v_value
      where client.id = v_project.client_id
        and client.user_id = v_user_id
      returning client.* into v_client;
    end if;

    get diagnostics v_affected_count = row_count;

    if v_affected_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'CLIENT_UPDATE_FAILED';
    end if;

    v_client_json := jsonb_build_object(
      'id', v_client.id,
      'name', v_client.name,
      'contact_name', v_client.contact_name,
      'phone', v_client.phone,
      'email', v_client.email,
      'notes', v_client.notes,
      'created_at', v_client.created_at
    );
  end if;

  if p_field = 'client_name' then
    update public.projects as project
    set
      client_name = v_value,
      updated_at = v_now
    where project.id = v_project.id
      and project.user_id = v_user_id
      and project.deleted_at is null
    returning project.* into v_updated_project;
  else
    update public.projects as project
    set
      contact_name = v_value,
      updated_at = v_now
    where project.id = v_project.id
      and project.user_id = v_user_id
      and project.deleted_at is null
    returning project.* into v_updated_project;
  end if;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_UPDATE_FAILED';
  end if;

  for v_task_id in
    select task.id
    from public.tasks as task
    where task.project_id = v_project.id
      and task.user_id = v_user_id
      and task.deleted_at is null
    order by task.id
    for update of task
  loop
    v_expected_task_count := v_expected_task_count + 1;
  end loop;

  if p_field = 'client_name' then
    update public.tasks as task
    set
      client_name = v_value,
      updated_at = v_now
    where task.project_id = v_project.id
      and task.user_id = v_user_id
      and task.deleted_at is null;
  else
    update public.tasks as task
    set
      contact_name = v_value,
      updated_at = v_now
    where task.project_id = v_project.id
      and task.user_id = v_user_id
      and task.deleted_at is null;
  end if;

  get diagnostics v_affected_count = row_count;

  if v_affected_count <> v_expected_task_count then
    raise exception using
      errcode = 'P0001',
      message = 'TASK_SYNC_FAILED';
  end if;

  return to_jsonb(v_updated_project) || jsonb_build_object(
    'client', v_client_json
  );
end;
$$;

revoke all on function public.update_project_client_identity_transaction(uuid, text, text)
  from public;

revoke all on function public.update_project_client_identity_transaction(uuid, text, text)
  from anon;

grant execute on function public.update_project_client_identity_transaction(uuid, text, text)
  to authenticated;

comment on function public.update_project_client_identity_transaction(uuid, text, text) is
  'Atomically updates an owned project client/contact identity, linked client, and related task compatibility fields.';
