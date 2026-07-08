-- Text2Task Project Update priority provenance
-- Migration: 202607020005_project_update_priority_provenance.sql
-- Created: 2026-07-02
--
-- Replaces the Project Update apply RPC with the preserved transactional apply
-- body plus same-transaction user priority provenance for accepted
-- project-level priority_change items. No private helper is exposed.
create or replace function public.apply_project_update_transaction(
  p_update_id uuid,
  p_apply_attempt_id uuid,
  p_accepted_item_ids uuid[],
  p_rejected_item_ids uuid[],
  p_edited_items jsonb,
  p_apply_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_update public.project_updates%rowtype;
  v_final_update public.project_updates%rowtype;
  v_project public.projects%rowtype;
  v_client public.clients%rowtype;
  v_item public.project_update_items%rowtype;
  v_event public.project_timeline_events%rowtype;
  v_payload_item jsonb;
  v_edited_item jsonb;
  v_mutation jsonb;
  v_updates jsonb;
  v_project_client_updates jsonb;
  v_client_updates jsonb;
  v_task_client_updates jsonb;
  v_event_payload jsonb;
  v_task_payload jsonb;
  v_accepted_ids uuid[];
  v_rejected_ids uuid[];
  v_all_ids uuid[];
  v_item_id uuid;
  v_task_id bigint;
  v_next_subtask_order integer;
  v_expected_count integer := 0;
  v_affected_count integer := 0;
  v_created_timeline_events jsonb := '[]'::jsonb;
  v_applied_items jsonb := '[]'::jsonb;
  v_rejected_items jsonb := '[]'::jsonb;
  v_has_priority_change boolean := false;
  v_event_new_value jsonb;
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'UNAUTHORIZED';
  end if;

  if p_update_id is null or p_apply_attempt_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_APPLY_ATTEMPT';
  end if;

  if p_edited_items is null or jsonb_typeof(p_edited_items) <> 'array'
    or p_apply_payload is null or jsonb_typeof(p_apply_payload) <> 'array' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_APPLY_PAYLOAD';
  end if;

  select coalesce(
    array_agg(distinct requested.item_id order by requested.item_id),
    array[]::uuid[]
  )
  into v_accepted_ids
  from unnest(coalesce(p_accepted_item_ids, array[]::uuid[]))
    as requested(item_id)
  where requested.item_id is not null;

  select coalesce(
    array_agg(distinct requested.item_id order by requested.item_id),
    array[]::uuid[]
  )
  into v_rejected_ids
  from unnest(coalesce(p_rejected_item_ids, array[]::uuid[]))
    as requested(item_id)
  where requested.item_id is not null;

  if cardinality(v_accepted_ids) + cardinality(v_rejected_ids) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEM_SELECTION';
  end if;

  if cardinality(v_accepted_ids) + cardinality(v_rejected_ids) > 500 then
    raise exception using
      errcode = 'P0001',
      message = 'TOO_MANY_UPDATE_ITEMS';
  end if;

  if exists (
    select 1
    from unnest(v_accepted_ids) as accepted(item_id)
    where accepted.item_id = any(v_rejected_ids)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ITEM_SELECTION_CONFLICT';
  end if;

  select array_agg(selected.item_id order by selected.item_id)
  into v_all_ids
  from (
    select unnest(v_accepted_ids) as item_id
    union all
    select unnest(v_rejected_ids) as item_id
  ) as selected;

  select update_row.*
  into v_update
  from public.project_updates as update_row
  where update_row.id = p_update_id
    and update_row.user_id = v_user_id
  for update of update_row;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_UPDATE_NOT_FOUND';
  end if;

  if v_update.status <> 'applying'
    or v_update.apply_attempt_id is distinct from p_apply_attempt_id then
    raise exception using
      errcode = 'P0001',
      message = 'APPLY_ATTEMPT_MISMATCH';
  end if;

  select project.*
  into v_project
  from public.projects as project
  where project.id = v_update.project_id
    and project.user_id = v_user_id
    and project.deleted_at is null
  for update of project;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_NOT_FOUND';
  end if;

  if v_project.client_id is not null then
    select client.*
    into v_client
    from public.clients as client
    where client.id = v_project.client_id
      and client.user_id = v_user_id
    for update of client;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'CLIENT_NOT_FOUND';
    end if;
  end if;

  -- Stabilize task targets and subtask ordering before any mutation.
  for v_task_id in
    select task.id
    from public.tasks as task
    where task.project_id = v_project.id
      and task.user_id = v_user_id
      and task.deleted_at is null
    order by task.id
    for update of task
  loop
    null;
  end loop;

  v_expected_count := 0;

  for v_item_id in
    select item.id
    from public.project_update_items as item
    where item.id = any(v_all_ids)
      and item.project_update_id = v_update.id
      and item.project_id = v_project.id
      and item.user_id = v_user_id
      and item.status in ('suggested', 'accepted', 'rejected')
    order by item.id
    for update of item
  loop
    v_expected_count := v_expected_count + 1;
  end loop;

  if v_expected_count <> cardinality(v_all_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'ITEM_VALIDATION_FAILED';
  end if;

  if jsonb_array_length(p_apply_payload) <> cardinality(v_accepted_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'APPLY_PAYLOAD_ITEM_MISMATCH';
  end if;

  select count(distinct (payload.value->>'itemId')::uuid)::integer
  into v_expected_count
  from jsonb_array_elements(p_apply_payload) as payload(value)
  where jsonb_typeof(payload.value) = 'object'
    and payload.value ? 'itemId'
    and (payload.value->>'itemId')::uuid = any(v_accepted_ids);

  if v_expected_count <> cardinality(v_accepted_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'APPLY_PAYLOAD_ITEM_MISMATCH';
  end if;

  if jsonb_array_length(p_edited_items) > cardinality(v_accepted_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_EDITED_ITEMS';
  end if;

  if exists (
    select 1
    from public.project_timeline_events as event
    where event.source_update_id = v_update.id
      and event.source_item_id = any(v_accepted_ids)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'TIMELINE_EVENT_ALREADY_EXISTS';
  end if;

  for v_edited_item in
    select edited.value
    from jsonb_array_elements(p_edited_items) as edited(value)
  loop
    if jsonb_typeof(v_edited_item) <> 'object'
      or not (v_edited_item ? 'itemId')
      or not (v_edited_item ? 'newValue')
      or jsonb_typeof(v_edited_item->'newValue') <> 'object' then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_EDITED_ITEMS';
    end if;

    v_item_id := (v_edited_item->>'itemId')::uuid;

    if not (v_item_id = any(v_accepted_ids)) then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_EDITED_ITEMS';
    end if;

    update public.project_update_items as item
    set new_value = v_edited_item->'newValue'
    where item.id = v_item_id
      and item.project_update_id = v_update.id
      and item.project_id = v_project.id
      and item.user_id = v_user_id
      and item.status in ('suggested', 'accepted', 'rejected');

    get diagnostics v_affected_count = row_count;

    if v_affected_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'EDITED_ITEM_UPDATE_FAILED';
    end if;
  end loop;

  for v_payload_item in
    select payload.value
    from jsonb_array_elements(p_apply_payload) with ordinality
      as payload(value, item_order)
    order by payload.item_order
  loop
    if jsonb_typeof(v_payload_item) <> 'object'
      or not (v_payload_item ? 'itemId')
      or not (v_payload_item ? 'itemType')
      or jsonb_typeof(v_payload_item->'mutation') <> 'object'
      or jsonb_typeof(v_payload_item->'event') <> 'object' then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_APPLY_PAYLOAD';
    end if;

    v_item_id := (v_payload_item->>'itemId')::uuid;

    select item.*
    into v_item
    from public.project_update_items as item
    where item.id = v_item_id
      and item.project_update_id = v_update.id
      and item.project_id = v_project.id
      and item.user_id = v_user_id
      and item.status in ('suggested', 'accepted', 'rejected')
    for update of item;

    if not found
      or not (v_item.id = any(v_accepted_ids))
      or v_item.type is distinct from v_payload_item->>'itemType'
      or coalesce(v_item.new_value, 'null'::jsonb)
        is distinct from coalesce(v_payload_item->'newValue', 'null'::jsonb) then
      raise exception using
        errcode = 'P0001',
        message = 'APPLY_PAYLOAD_ITEM_MISMATCH';
    end if;

    if v_item.target_task_id is not null
      and not exists (
        select 1
        from public.tasks as task
        where task.id = v_item.target_task_id
          and task.project_id = v_project.id
          and task.user_id = v_user_id
          and task.deleted_at is null
      ) then
      raise exception using
        errcode = 'P0001',
        message = 'TARGET_TASK_VALIDATION_FAILED';
    end if;

    v_mutation := v_payload_item->'mutation';
    v_event_payload := v_payload_item->'event';
    v_task_id := null;
    v_event_new_value := v_item.new_value;
    v_project_client_updates := '{}'::jsonb;
    v_client_updates := '{}'::jsonb;
    v_task_client_updates := '{}'::jsonb;

    if v_item.type = 'new_subtask' then
      if v_mutation->>'kind' is distinct from 'new_subtask'
        or jsonb_typeof(v_mutation->'task') <> 'object' then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_NEW_SUBTASK_PAYLOAD';
      end if;

      v_task_payload := v_mutation->'task';

      if nullif(btrim(v_task_payload->>'task_title'), '') is null
        or (
          v_task_payload - array[
            'client_name',
            'contact_name',
            'task_title',
            'amount',
            'amount_value',
            'currency_code',
            'deadline_text',
            'deadline_date',
            'priority',
            'status'
          ]
        ) <> '{}'::jsonb then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_NEW_SUBTASK_PAYLOAD';
      end if;

      select coalesce(max(task.subtask_order), 0) + 1
      into v_next_subtask_order
      from public.tasks as task
      where task.project_id = v_project.id
        and task.user_id = v_user_id
        and task.deleted_at is null;

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
        deleted_at,
        updated_at
      )
      values (
        v_user_id,
        v_task_payload->>'client_name',
        nullif(v_task_payload->>'contact_name', ''),
        v_project.client_id,
        v_project.id,
        v_next_subtask_order,
        v_task_payload->>'task_title',
        nullif(v_task_payload->>'amount', ''),
        nullif(v_task_payload->>'amount_value', '')::numeric,
        nullif(v_task_payload->>'currency_code', ''),
        nullif(v_task_payload->>'deadline_text', ''),
        nullif(v_task_payload->>'deadline_date', '')::date,
        coalesce(nullif(v_task_payload->>'priority', ''), 'Medium'),
        coalesce(nullif(v_task_payload->>'status', ''), 'New'),
        'client_update',
        v_update.raw_input,
        false,
        null,
        case
          when lower(btrim(coalesce(v_task_payload->>'status', ''))) = 'done'
            then v_now
          else null
        end,
        null,
        v_now
      )
      returning id into v_task_id;

      v_event_new_value := jsonb_build_object(
        'task_id', v_task_id,
        'task_title', v_task_payload->>'task_title',
        'subtask_order', v_next_subtask_order
      );
    elsif v_item.type = 'update_subtask' then
      if v_mutation->>'kind' is distinct from 'update_subtask'
        or jsonb_typeof(v_mutation->'updates') <> 'object'
        or (v_mutation->>'taskId')::bigint is distinct from v_item.target_task_id then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_SUBTASK_UPDATE_PAYLOAD';
      end if;

      v_updates := v_mutation->'updates';

      if v_updates = '{}'::jsonb
        or (
          v_updates - array[
            'task_title',
            'amount',
            'amount_value',
            'currency_code',
            'deadline_text',
            'deadline_date',
            'priority',
            'status'
          ]
        ) <> '{}'::jsonb then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_SUBTASK_UPDATE_PAYLOAD';
      end if;

      update public.tasks as task
      set
        task_title = case when v_updates ? 'task_title'
          then v_updates->>'task_title' else task.task_title end,
        amount = case when v_updates ? 'amount'
          then v_updates->>'amount' else task.amount end,
        amount_value = case when v_updates ? 'amount_value'
          then nullif(v_updates->>'amount_value', '')::numeric else task.amount_value end,
        currency_code = case when v_updates ? 'currency_code'
          then v_updates->>'currency_code' else task.currency_code end,
        deadline_text = case when v_updates ? 'deadline_text'
          then v_updates->>'deadline_text' else task.deadline_text end,
        deadline_date = case when v_updates ? 'deadline_date'
          then nullif(v_updates->>'deadline_date', '')::date else task.deadline_date end,
        priority = case when v_updates ? 'priority'
          then v_updates->>'priority' else task.priority end,
        status = case when v_updates ? 'status'
          then v_updates->>'status' else task.status end,
        completed_at = case
          when v_updates ? 'status' then
            case
              when lower(btrim(coalesce(v_updates->>'status', ''))) = 'done'
                then v_now
              else null
            end
          else task.completed_at
        end,
        updated_at = v_now
      where task.id = v_item.target_task_id
        and task.project_id = v_project.id
        and task.user_id = v_user_id
        and task.deleted_at is null
      returning task.id into v_task_id;

      if not found then
        raise exception using
          errcode = 'P0001',
          message = 'SUBTASK_UPDATE_FAILED';
      end if;
    elsif v_item.type in (
      'deadline_change',
      'budget_change',
      'priority_change',
      'status_change'
    ) then
      if v_mutation->>'kind' is distinct from 'project_field'
        or jsonb_typeof(v_mutation->'updates') <> 'object' then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_PROJECT_UPDATE_PAYLOAD';
      end if;

      v_updates := v_mutation->'updates';

      if v_updates = '{}'::jsonb
        or (
          v_item.type = 'deadline_change'
          and (v_updates - array['deadline_text', 'deadline_date']) <> '{}'::jsonb
        )
        or (
          v_item.type = 'budget_change'
          and (v_updates - array['amount', 'amount_value', 'currency_code']) <> '{}'::jsonb
        )
        or (
          v_item.type = 'priority_change'
          and (
            (v_updates - array['priority']) <> '{}'::jsonb
            or coalesce(v_updates->>'priority', '') not in (
              'Low',
              'Medium',
              'High'
            )
          )
        )
        or (
          v_item.type = 'status_change'
          and (v_updates - array['status']) <> '{}'::jsonb
        ) then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_PROJECT_UPDATE_PAYLOAD';
      end if;

      update public.projects as project
      set
        deadline_text = case when v_updates ? 'deadline_text'
          then v_updates->>'deadline_text' else project.deadline_text end,
        deadline_date = case when v_updates ? 'deadline_date'
          then nullif(v_updates->>'deadline_date', '')::date else project.deadline_date end,
        amount = case when v_updates ? 'amount'
          then v_updates->>'amount' else project.amount end,
        amount_value = case when v_updates ? 'amount_value'
          then nullif(v_updates->>'amount_value', '')::numeric else project.amount_value end,
        currency_code = case when v_updates ? 'currency_code'
          then v_updates->>'currency_code' else project.currency_code end,
        priority = case when v_updates ? 'priority'
          then v_updates->>'priority' else project.priority end,
        status = case when v_updates ? 'status'
          then v_updates->>'status' else project.status end,
        updated_at = v_now
      where project.id = v_project.id
        and project.user_id = v_user_id
        and project.deleted_at is null;

      get diagnostics v_affected_count = row_count;

      if v_affected_count <> 1 then
        raise exception using
          errcode = 'P0001',
          message = 'PROJECT_UPDATE_FAILED';
      end if;

      if v_item.type = 'priority_change' then
        v_has_priority_change := true;
      end if;
    elsif v_item.type = 'client_detail_change' then
      v_project_client_updates := coalesce(v_mutation #> '{projectUpdates}', '{}'::jsonb);
      v_client_updates := coalesce(v_mutation #> '{clientUpdates}', '{}'::jsonb);
      v_task_client_updates := coalesce(v_mutation #> '{taskUpdates}', '{}'::jsonb);

      if v_mutation->>'kind' is distinct from 'client_detail'
        or jsonb_typeof(v_project_client_updates) <> 'object'
        or jsonb_typeof(v_client_updates) <> 'object'
        or jsonb_typeof(v_task_client_updates) <> 'object' then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_CLIENT_UPDATE_PAYLOAD';
      end if;

      if (
          v_project_client_updates - array['client_name', 'contact_name']
        ) <> '{}'::jsonb
        or (
          v_client_updates - array[
            'name',
            'contact_name',
            'phone',
            'email',
            'notes'
          ]
        ) <> '{}'::jsonb
        or (
          v_task_client_updates - array['client_name', 'contact_name']
        ) <> '{}'::jsonb then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_CLIENT_UPDATE_PAYLOAD';
      end if;

      if v_project_client_updates <> '{}'::jsonb then
        v_updates := v_project_client_updates;

        update public.projects as project
        set
          client_name = case when v_updates ? 'client_name'
            then v_updates->>'client_name' else project.client_name end,
          contact_name = case when v_updates ? 'contact_name'
            then v_updates->>'contact_name' else project.contact_name end,
          updated_at = v_now
        where project.id = v_project.id
          and project.user_id = v_user_id
          and project.deleted_at is null;

        get diagnostics v_affected_count = row_count;

        if v_affected_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'PROJECT_CLIENT_UPDATE_FAILED';
        end if;
      end if;

      if v_project.client_id is not null
        and v_client_updates <> '{}'::jsonb then
        v_updates := v_client_updates;

        update public.clients as client
        set
          name = case when v_updates ? 'name'
            then v_updates->>'name' else client.name end,
          contact_name = case when v_updates ? 'contact_name'
            then v_updates->>'contact_name' else client.contact_name end,
          phone = case when v_updates ? 'phone'
            then v_updates->>'phone' else client.phone end,
          email = case when v_updates ? 'email'
            then v_updates->>'email' else client.email end,
          notes = case when v_updates ? 'notes'
            then v_updates->>'notes' else client.notes end
        where client.id = v_project.client_id
          and client.user_id = v_user_id;

        get diagnostics v_affected_count = row_count;

        if v_affected_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'CLIENT_UPDATE_FAILED';
        end if;
      end if;

      if v_task_client_updates <> '{}'::jsonb then
        v_updates := v_task_client_updates;

        select count(*)::integer
        into v_expected_count
        from public.tasks as task
        where task.project_id = v_project.id
          and task.user_id = v_user_id
          and task.deleted_at is null;

        update public.tasks as task
        set
          client_name = case when v_updates ? 'client_name'
            then v_updates->>'client_name' else task.client_name end,
          contact_name = case when v_updates ? 'contact_name'
            then v_updates->>'contact_name' else task.contact_name end,
          updated_at = v_now
        where task.project_id = v_project.id
          and task.user_id = v_user_id
          and task.deleted_at is null;

        get diagnostics v_affected_count = row_count;

        if v_affected_count <> v_expected_count then
          raise exception using
            errcode = 'P0001',
            message = 'TASK_CLIENT_SYNC_FAILED';
        end if;
      end if;
    elsif v_item.type in (
      'project_note',
      'client_note',
      'duplicate_warning',
      'no_action'
    ) then
      if v_mutation->>'kind' is distinct from 'timeline_only' then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_TIMELINE_ONLY_PAYLOAD';
      end if;
    else
      raise exception using
        errcode = 'P0001',
        message = 'UNSUPPORTED_UPDATE_ITEM';
    end if;

    insert into public.project_timeline_events (
      user_id,
      project_id,
      event_type,
      event_title,
      event_summary,
      source_update_id,
      source_item_id,
      target_task_id,
      target_field,
      old_value,
      new_value,
      actor_user_id,
      metadata,
      created_at
    )
    values (
      v_user_id,
      v_project.id,
      v_event_payload->>'eventType',
      v_event_payload->>'title',
      nullif(v_event_payload->>'summary', ''),
      v_update.id,
      v_item.id,
      case
        when v_item.type in ('new_subtask', 'update_subtask') then v_task_id
        when v_item.type in (
          'project_note',
          'client_note',
          'duplicate_warning',
          'no_action'
        ) then v_item.target_task_id
        else null
      end,
      nullif(v_event_payload->>'targetField', ''),
      v_item.old_value,
      v_event_new_value,
      v_user_id,
      case
        when v_event_payload ? 'metadata'
          and jsonb_typeof(v_event_payload->'metadata') = 'object'
        then v_event_payload->'metadata'
        else null
      end,
      v_now
    )
    returning * into v_event;

    v_created_timeline_events :=
      v_created_timeline_events || jsonb_build_array(to_jsonb(v_event));
  end loop;

  if cardinality(v_accepted_ids) > 0 then
    update public.project_update_items as item
    set
      status = 'applied',
      accepted_at = v_now,
      applied_at = v_now,
      accepted_by = v_user_id,
      applied_by = v_user_id
    where item.id = any(v_accepted_ids)
      and item.project_update_id = v_update.id
      and item.project_id = v_project.id
      and item.user_id = v_user_id
      and item.status in ('suggested', 'accepted', 'rejected');

    get diagnostics v_affected_count = row_count;

    if v_affected_count <> cardinality(v_accepted_ids) then
      raise exception using
        errcode = 'P0001',
        message = 'MARK_APPLIED_ITEMS_FAILED';
    end if;
  end if;

  if cardinality(v_rejected_ids) > 0 then
    update public.project_update_items as item
    set
      status = 'rejected',
      rejected_at = v_now,
      rejected_by = v_user_id
    where item.id = any(v_rejected_ids)
      and item.project_update_id = v_update.id
      and item.project_id = v_project.id
      and item.user_id = v_user_id
      and item.status in ('suggested', 'accepted', 'rejected');

    get diagnostics v_affected_count = row_count;

    if v_affected_count <> cardinality(v_rejected_ids) then
      raise exception using
        errcode = 'P0001',
        message = 'MARK_REJECTED_ITEMS_FAILED';
    end if;
  end if;

  update public.project_updates as update_row
  set
    status = 'applied',
    reviewed_by = v_user_id,
    applied_by = v_user_id,
    reviewed_at = v_now,
    applied_at = v_now,
    apply_failed_at = null,
    apply_error_code = null
  where update_row.id = v_update.id
    and update_row.user_id = v_user_id
    and update_row.status = 'applying'
    and update_row.apply_attempt_id = p_apply_attempt_id
  returning update_row.* into v_final_update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'MARK_UPDATE_APPLIED_FAILED';
  end if;

  if v_has_priority_change then
    update public.projects as project
    set
      priority_source = 'user',
      updated_at = v_now
    where project.id = v_project.id
      and project.user_id = v_user_id
      and project.deleted_at is null;

    get diagnostics v_affected_count = row_count;

    if v_affected_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'PROJECT_PRIORITY_PROVENANCE_UPDATE_FAILED';
    end if;
  end if;

  if cardinality(v_accepted_ids) > 0 then
    select coalesce(
      jsonb_agg(to_jsonb(item) order by item.created_at, item.id),
      '[]'::jsonb
    )
    into v_applied_items
    from public.project_update_items as item
    where item.id = any(v_accepted_ids)
      and item.project_update_id = v_update.id
      and item.user_id = v_user_id;
  end if;

  if cardinality(v_rejected_ids) > 0 then
    select coalesce(
      jsonb_agg(to_jsonb(item) order by item.created_at, item.id),
      '[]'::jsonb
    )
    into v_rejected_items
    from public.project_update_items as item
    where item.id = any(v_rejected_ids)
      and item.project_update_id = v_update.id
      and item.user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'update', to_jsonb(v_final_update),
    'appliedItems', v_applied_items,
    'rejectedItems', v_rejected_items,
    'timelineEvents', v_created_timeline_events
  );
end;
$$;

revoke all on function public.apply_project_update_transaction(
  uuid,
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb
) from public;

revoke all on function public.apply_project_update_transaction(
  uuid,
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb
) from anon;

grant execute on function public.apply_project_update_transaction(
  uuid,
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb
) to authenticated;

comment on function public.apply_project_update_transaction(
  uuid,
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb
) is
  'Atomically applies one claimed Project Update review, commits item, mutation, timeline, and lifecycle writes, and records user priority provenance for accepted project-level priority changes.';
