-- Text2Task Transactional Project Import
-- Migration: 202606150005_transactional_project_import.sql
-- Created: 2026-06-15
--
-- Phase 3D.2A/3D.2B:
-- Atomically creates clients, projects, tasks, and DB-only imported resources,
-- then commits the matching Project Import idempotency attempt with the exact
-- public success response.

create or replace function public.import_projects_transaction(
  p_attempt_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_groups jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_attempt public.project_import_attempts%rowtype;
  v_group jsonb;
  v_task_payload jsonb;
  v_resource_payload jsonb;
  v_client_input public.clients%rowtype;
  v_client public.clients%rowtype;
  v_project_input public.projects%rowtype;
  v_project public.projects%rowtype;
  v_task_input public.tasks%rowtype;
  v_task public.tasks%rowtype;
  v_resource_input public.task_resources%rowtype;
  v_client_json jsonb;
  v_project_context_json jsonb;
  v_created_projects jsonb := '[]'::jsonb;
  v_created_tasks jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'UNAUTHORIZED';
  end if;

  if p_attempt_id is null
    or p_idempotency_key is null
    or nullif(btrim(p_request_hash), '') is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ATTEMPT';
  end if;

  if p_groups is null
    or jsonb_typeof(p_groups) <> 'array'
    or jsonb_array_length(p_groups) = 0
    or jsonb_array_length(p_groups) > 50 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_GROUPS';
  end if;

  -- Serialize imports for one user so deterministic client matching does not
  -- race another keyed import for the same account.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select attempt.*
  into v_attempt
  from public.project_import_attempts as attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = v_user_id
  for update of attempt;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'ATTEMPT_NOT_FOUND';
  end if;

  if v_attempt.idempotency_key <> p_idempotency_key
    or v_attempt.request_hash <> p_request_hash then
    raise exception using
      errcode = 'P0001',
      message = 'ATTEMPT_CONFLICT';
  end if;

  if v_attempt.status <> 'started' or v_attempt.error_code is not null then
    raise exception using
      errcode = 'P0001',
      message = 'ATTEMPT_NOT_READY';
  end if;

  for v_group in
    select group_value
    from jsonb_array_elements(p_groups) with ordinality
      as requested(group_value, group_order)
    order by group_order
  loop
    if jsonb_typeof(v_group) <> 'object'
      or jsonb_typeof(v_group->'project') <> 'object'
      or jsonb_typeof(v_group->'client') <> 'object'
      or jsonb_typeof(v_group->'tasks') <> 'array'
      or jsonb_array_length(v_group->'tasks') = 0
      or jsonb_array_length(v_group->'tasks') > 200 then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_GROUPS';
    end if;

    v_client_input := jsonb_populate_record(
      null::public.clients,
      v_group->'client'
    );
    v_project_input := jsonb_populate_record(
      null::public.projects,
      v_group->'project'
    );
    v_client := null;

    if nullif(btrim(v_client_input.name), '') is not null then
      select client.*
      into v_client
      from public.clients as client
      where client.user_id = v_user_id
        and client.name ilike v_client_input.name
      order by client.created_at asc nulls last, client.id asc
      limit 1
      for update of client;

      if found then
        if coalesce(v_client_input.contact_name, v_client.contact_name)
            is distinct from v_client.contact_name
          or coalesce(v_client_input.phone, v_client.phone)
            is distinct from v_client.phone
          or coalesce(v_client_input.email, v_client.email)
            is distinct from v_client.email
          or coalesce(v_client_input.notes, v_client.notes)
            is distinct from v_client.notes then
          update public.clients as client
          set
            contact_name = coalesce(
              v_client_input.contact_name,
              client.contact_name
            ),
            phone = coalesce(v_client_input.phone, client.phone),
            email = coalesce(v_client_input.email, client.email),
            notes = coalesce(v_client_input.notes, client.notes)
          where client.id = v_client.id
            and client.user_id = v_user_id
          returning client.* into v_client;

          if not found then
            raise exception using
              errcode = 'P0001',
              message = 'CLIENT_UPDATE_FAILED';
          end if;
        end if;
      else
        insert into public.clients (
          user_id,
          name,
          contact_name,
          phone,
          email,
          notes
        )
        values (
          v_user_id,
          v_client_input.name,
          v_client_input.contact_name,
          v_client_input.phone,
          v_client_input.email,
          v_client_input.notes
        )
        returning * into v_client;
      end if;
    end if;

    if nullif(btrim(v_project_input.title), '') is null then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_PROJECT';
    end if;

    insert into public.projects (
      user_id,
      client_id,
      client_name,
      contact_name,
      title,
      summary,
      amount,
      amount_value,
      currency_code,
      deadline_text,
      deadline_date,
      priority,
      status,
      source,
      raw_input,
      is_archived,
      archived_at,
      completed_at,
      deleted_at
    )
    values (
      v_user_id,
      v_client.id,
      v_project_input.client_name,
      v_project_input.contact_name,
      v_project_input.title,
      v_project_input.summary,
      v_project_input.amount,
      v_project_input.amount_value,
      v_project_input.currency_code,
      v_project_input.deadline_text,
      v_project_input.deadline_date,
      v_project_input.priority,
      v_project_input.status,
      v_project_input.source,
      v_project_input.raw_input,
      false,
      null,
      case
        when lower(btrim(coalesce(v_project_input.status::text, ''))) = 'done'
          then v_now
        else null
      end,
      null
    )
    returning * into v_project;

    v_created_projects := v_created_projects || jsonb_build_array(
      to_jsonb(v_project)
    );

    if v_client.id is null then
      v_client_json := 'null'::jsonb;
    else
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

    v_project_context_json := jsonb_build_object(
      'id', v_project.id,
      'client_id', v_project.client_id,
      'client_name', v_project.client_name,
      'contact_name', v_project.contact_name,
      'title', v_project.title,
      'summary', v_project.summary,
      'amount', v_project.amount,
      'amount_value', v_project.amount_value,
      'currency_code', v_project.currency_code,
      'deadline_text', v_project.deadline_text,
      'deadline_date', v_project.deadline_date,
      'priority', v_project.priority,
      'status', v_project.status,
      'source', v_project.source,
      'raw_input', v_project.raw_input,
      'created_at', v_project.created_at,
      'updated_at', v_project.updated_at,
      'completed_at', v_project.completed_at,
      'is_archived', v_project.is_archived,
      'archived_at', v_project.archived_at,
      'deleted_at', v_project.deleted_at
    );

    for v_task_payload in
      select task_value
      from jsonb_array_elements(v_group->'tasks') with ordinality
        as requested(task_value, task_order)
      order by task_order
    loop
      if jsonb_typeof(v_task_payload) <> 'object'
        or jsonb_typeof(v_task_payload->'resources') <> 'array' then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_TASKS';
      end if;

      v_task_input := jsonb_populate_record(
        null::public.tasks,
        v_task_payload
      );

      if nullif(btrim(v_task_input.task_title), '') is null then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_TASKS';
      end if;

      insert into public.tasks (
        user_id,
        client_name,
        contact_name,
        client_id,
        project_id,
        subtask_order,
        task_title,
        amount,
        amount_value,
        currency_code,
        deadline_text,
        deadline_date,
        priority,
        status,
        source,
        raw_input,
        is_archived,
        archived_at,
        completed_at,
        deleted_at
      )
      values (
        v_user_id,
        v_task_input.client_name,
        v_task_input.contact_name,
        v_client.id,
        v_project.id,
        v_task_input.subtask_order,
        v_task_input.task_title,
        v_task_input.amount,
        v_task_input.amount_value,
        v_task_input.currency_code,
        v_task_input.deadline_text,
        v_task_input.deadline_date,
        v_task_input.priority,
        v_task_input.status,
        v_task_input.source,
        v_task_input.raw_input,
        false,
        null,
        case
          when lower(btrim(coalesce(v_task_input.status::text, ''))) = 'done'
            then v_now
          else null
        end,
        null
      )
      returning * into v_task;

      v_created_tasks := v_created_tasks || jsonb_build_array(
        to_jsonb(v_task) || jsonb_build_object(
          'client', v_client_json,
          'project', v_project_context_json
        )
      );

      for v_resource_payload in
        select resource_value
        from jsonb_array_elements(v_task_payload->'resources') with ordinality
          as requested(resource_value, resource_order)
        order by resource_order
      loop
        if jsonb_typeof(v_resource_payload) <> 'object' then
          raise exception using
            errcode = 'P0001',
            message = 'INVALID_RESOURCES';
        end if;

        v_resource_input := jsonb_populate_record(
          null::public.task_resources,
          v_resource_payload
        );

        insert into public.task_resources (
          user_id,
          project_id,
          task_id,
          resource_type,
          title,
          url,
          storage_path,
          file_name,
          mime_type,
          size_bytes,
          notes
        )
        values (
          v_user_id,
          v_project.id,
          v_task.id,
          v_resource_input.resource_type,
          v_resource_input.title,
          v_resource_input.url,
          null,
          null,
          null,
          null,
          v_resource_input.notes
        );
      end loop;
    end loop;
  end loop;

  v_result := jsonb_build_object(
    'ok', true,
    'createdProjects', v_created_projects,
    'createdTasks', v_created_tasks,
    'duplicates', '[]'::jsonb,
    'failedGroups', '[]'::jsonb
  );

  update public.project_import_attempts as attempt
  set
    status = 'committed',
    result_json = v_result,
    completed_at = v_now,
    failed_at = null,
    error_code = null
  where attempt.id = v_attempt.id
    and attempt.user_id = v_user_id
    and attempt.status = 'started'
    and attempt.error_code is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'ATTEMPT_COMMIT_FAILED';
  end if;

  return v_result;
end;
$$;

revoke all on function public.import_projects_transaction(uuid, uuid, text, jsonb)
  from public;

revoke all on function public.import_projects_transaction(uuid, uuid, text, jsonb)
  from anon;

grant execute on function public.import_projects_transaction(uuid, uuid, text, jsonb)
  to authenticated;

comment on function public.import_projects_transaction(uuid, uuid, text, jsonb) is
  'Atomically imports normalized client/project/task/resource groups and commits the matching Project Import idempotency attempt.';
