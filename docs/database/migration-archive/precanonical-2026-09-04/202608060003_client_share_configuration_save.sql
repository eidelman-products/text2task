-- Text2Task Client Share Link -- Phase 1B.4 Configuration Save
-- Migration: 202608060003_client_share_configuration_save.sql
-- Created: 2026-08-06
--
-- Purpose:
-- Phase 1B.4 of the Client Share Link feature (see
-- docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_MAPPING_2026-08-05.md section
-- 5, row "D+K+L+M"). This migration adds exactly one owner-authenticated
-- SECURITY DEFINER RPC:
--
--   public.save_share_configuration(
--     p_link_id uuid,
--     p_settings jsonb,
--     p_tasks jsonb,
--     p_resources jsonb,
--     p_publish_update jsonb
--   ) returns jsonb
--
-- covering, atomically, in one PostgreSQL transaction:
--   D -- owner-visible share settings (comments_enabled,
--        client_facing_subtitle, content_direction)
--   K -- the selected shared-task set (public.share_link_tasks)
--   L -- the selected shared-Resource set (public.share_link_resources)
--   M -- an optional new published client-facing update
--        (public.share_link_updates)
--
-- This single RPC replaces any idea of separate replace_share_link_tasks,
-- replace_share_link_resources, publish_share_link_update or
-- update_share_link_settings functions -- none of those are created here
-- or anywhere else. AGENTS.md rule 19 requires curated-content changes
-- and configuration_version changes to be one transaction; a sequence of
-- independently-committing RPCs could leave a partially-applied
-- configuration if one step failed mid-sequence, which is exactly what
-- this single-function design prevents by construction (a PL/pgSQL
-- function body is one transaction).
--
-- Deliberately NOT in this migration (Phase 1B.5 or later, or already
-- delivered elsewhere):
--   - UI/dashboard components, preview, public /share pages, the public
--     projection, client sessions.
--   - PIN, expiry, lifecycle (draft/activate/disable/re-enable), secret
--     rotation or reveal operations -- all already delivered by
--     202608060001 and 202608060002.
--   - Comments/owner replies, feedback conversion, rate limiting, email
--     or notifications, analytics, feature flags.
--   - Any share_link_events row for a configuration save or update
--     publication -- the closed share_link_events vocabulary has no entry
--     for this operation, and none is added.
--   - Any DML against share_browser_sessions or share_session_grants --
--     this RPC only ever touches project_share_links, share_link_tasks,
--     share_link_resources and share_link_updates.
--
-- Security posture (matches every Phase 1B write RPC so far, AGENTS.md
-- rule 12): language plpgsql; security definer; explicit
-- set search_path = public, pg_temp; auth.uid() obtained and null-checked
-- internally; no caller-supplied user_id or project_id; no generic
-- table/column/value parameter; no dynamic SQL anywhere in this file;
-- revoked from public/anon/service_role; granted execute only to
-- authenticated; COMMENT ON FUNCTION included. No table grant, RLS
-- policy, trigger or constraint is added, altered or dropped anywhere in
-- this migration -- table-level privileges, RLS and the existing
-- enforce_share_link_task_integrity / enforce_share_link_resource_integrity
-- / enforce_share_link_update_integrity / enforce_project_share_link_integrity
-- triggers (202608030005) remain exactly as delivered and continue to
-- fire unconditionally as the second, independent line of defense behind
-- this RPC's own prevalidation -- this RPC never weakens, bypasses or
-- replaces any of them.
--
-- Zod is not the database security boundary: every JSON group this RPC
-- accepts is independently validated here -- type, exact object keys,
-- string/boolean/integer bounds, closed vocabularies, canonical decimal
-- subtask-id strings cast to bigint only after regex validation, and
-- UUID-shaped resource ids -- before any write happens, matching every
-- other Phase 1B write RPC's own defense-in-depth posture.
--
-- Ownership and locking follow the exact project-then-link two-level
-- order activate_share_link/reenable_share_link (202608060001) already
-- established: resolve the link's immutable project_id with a plain read,
-- lock the owning, non-deleted, non-archived project row FOR UPDATE
-- first, then lock the specific target link row FOR UPDATE. This RPC
-- never changes public_id, secret_digest, secret material, PIN material,
-- expiry, activated_at, disabled_at, rotated_at, revoked_at, view_count,
-- last_viewed_at, or the link's own lifecycle state.
--
-- configuration_version increases by exactly one only when a supplied
-- settings field genuinely changes (IS DISTINCT FROM against the current
-- row) -- task, Resource and update-publication changes never touch it,
-- matching the Phase 1A trigger's own v_access_changed column list
-- exactly (comments_enabled, client_facing_subtitle, content_direction
-- are in that list; share_link_tasks/resources/updates are separate
-- tables the trigger never inspects).
--
-- Schema-drift posture (fail closed): no `if not exists` anywhere in this
-- migration. Transaction posture: no explicit begin;/commit;, matching
-- every existing tracked migration.

create or replace function public.save_share_configuration(
  p_link_id uuid,
  p_settings jsonb,
  p_tasks jsonb,
  p_resources jsonb,
  p_publish_update jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();

  v_project_id uuid;
  v_link_user_id uuid;
  v_locked_project_id uuid;
  v_project_deleted_at timestamptz;
  v_project_is_archived boolean;

  v_link_state text;
  v_link_configuration_version integer;
  v_new_configuration_version integer;
  v_old_comments_enabled boolean;
  v_old_client_facing_subtitle text;
  v_old_content_direction text;

  v_has_comments_enabled boolean := false;
  v_comments_enabled boolean;
  v_has_client_facing_subtitle boolean := false;
  v_client_facing_subtitle text;
  v_has_content_direction boolean := false;
  v_content_direction text;
  v_settings_changed boolean := false;

  v_task_item jsonb;
  v_task_id bigint;
  v_task_ids bigint[] := array[]::bigint[];
  v_task_public_groups text[] := array[]::text[];
  v_task_waiting_flags boolean[] := array[]::boolean[];
  v_task_display_orders integer[] := array[]::integer[];
  v_result_task_ids jsonb;

  v_resource_item jsonb;
  v_resource_id uuid;
  v_resource_label text;
  v_resource_ids uuid[] := array[]::uuid[];
  v_resource_labels text[] := array[]::text[];
  v_resource_can_download_flags boolean[] := array[]::boolean[];
  v_resource_display_orders integer[] := array[]::integer[];
  v_result_resource_ids jsonb;

  v_publish_body text;
  v_next_version integer;
  v_publish_inserted_count integer;
  v_current_update_version integer;
  v_current_update_published_at timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- =======================================================
  -- Shape/type/bounds validation for every supplied group.
  -- Pure JSON parsing, no database dependency, so it happens before any
  -- lock or write -- "validate all supplied groups before applying any
  -- write whenever practical".
  -- =======================================================

  -- ---------------- settings ----------------
  if p_settings is not null then
    if jsonb_typeof(p_settings) <> 'object' then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
    end if;

    if (p_settings - 'commentsEnabled' - 'clientFacingSubtitle' - 'contentDirection')
      <> '{}'::jsonb then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
    end if;

    if p_settings = '{}'::jsonb then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
    end if;

    v_has_comments_enabled := p_settings ? 'commentsEnabled';
    if v_has_comments_enabled then
      if jsonb_typeof(p_settings->'commentsEnabled') <> 'boolean' then
        raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
      end if;
      v_comments_enabled := (p_settings->>'commentsEnabled')::boolean;
    end if;

    v_has_client_facing_subtitle := p_settings ? 'clientFacingSubtitle';
    if v_has_client_facing_subtitle then
      if jsonb_typeof(p_settings->'clientFacingSubtitle') = 'null' then
        v_client_facing_subtitle := null;
      elsif jsonb_typeof(p_settings->'clientFacingSubtitle') = 'string' then
        v_client_facing_subtitle := p_settings->>'clientFacingSubtitle';

        -- Matches project_share_links_client_facing_subtitle_check
        -- exactly (202608030003): btrim length >= 1, raw length <= 200.
        -- The value is stored exactly as submitted, never trimmed.
        if char_length(v_client_facing_subtitle) > 200
          or char_length(btrim(v_client_facing_subtitle)) < 1 then
          raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
        end if;
      else
        raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
      end if;
    end if;

    v_has_content_direction := p_settings ? 'contentDirection';
    if v_has_content_direction then
      if jsonb_typeof(p_settings->'contentDirection') <> 'string'
        or (p_settings->>'contentDirection') not in ('auto', 'ltr', 'rtl') then
        raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
      end if;
      v_content_direction := p_settings->>'contentDirection';
    end if;
  end if;

  -- ---------------- tasks ----------------
  if p_tasks is not null then
    if jsonb_typeof(p_tasks) <> 'array' then
      raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
    end if;

    if jsonb_array_length(p_tasks) > 500 then
      raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
    end if;

    for v_task_item in select * from jsonb_array_elements(p_tasks) loop
      if jsonb_typeof(v_task_item) <> 'object' then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      if (
        v_task_item
          - 'subtaskId' - 'publicGroup'
          - 'waitingForClientFeedback' - 'displayOrder'
      ) <> '{}'::jsonb then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      if not (
        v_task_item ? 'subtaskId'
        and v_task_item ? 'publicGroup'
        and v_task_item ? 'waitingForClientFeedback'
        and v_task_item ? 'displayOrder'
      ) then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      -- Canonical positive decimal string (/^[1-9][0-9]*$/), matching
      -- lib/share/share-contracts.ts's canonicalSubtaskIdSchema exactly.
      -- Cast to bigint only after this regex passes.
      if jsonb_typeof(v_task_item->'subtaskId') <> 'string'
        or (v_task_item->>'subtaskId') !~ '^[1-9][0-9]*$' then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      begin
        v_task_id := (v_task_item->>'subtaskId')::bigint;
      exception
        when others then
          raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end;

      if v_task_id = any(v_task_ids) then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      if jsonb_typeof(v_task_item->'publicGroup') <> 'string'
        or (v_task_item->>'publicGroup') not in (
          'in_progress', 'waiting_for_feedback', 'completed', 'coming_up'
        ) then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      if jsonb_typeof(v_task_item->'waitingForClientFeedback') <> 'boolean' then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      -- Non-negative integer only, bounded to the delivered integer
      -- column's own accepted range (2147483647). The regex on the JSON
      -- number's own text representation rejects a fractional value (a
      -- decimal point is not a digit), a negative value (a leading '-'
      -- is not a digit), and exponent notation, all in one check. The
      -- upper-bound comparison casts through `numeric` -- which never
      -- overflows for a pure-digit string, unlike `bigint` -- so an
      -- oversized digit string a direct RPC caller supplies is rejected
      -- with this stable P0001 error rather than raising a native
      -- 22003 numeric-value-out-of-range error that would escape
      -- uncaught. Only after this bound is proven does the value ever
      -- reach an `::integer` cast.
      if jsonb_typeof(v_task_item->'displayOrder') <> 'number'
        or (v_task_item->>'displayOrder') !~ '^[0-9]+$'
        or (v_task_item->>'displayOrder')::numeric > 2147483647 then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      v_task_ids := array_append(v_task_ids, v_task_id);
      v_task_public_groups :=
        array_append(v_task_public_groups, v_task_item->>'publicGroup');
      v_task_waiting_flags := array_append(
        v_task_waiting_flags,
        (v_task_item->>'waitingForClientFeedback')::boolean
      );
      v_task_display_orders := array_append(
        v_task_display_orders,
        (v_task_item->>'displayOrder')::integer
      );
    end loop;
  end if;

  -- ---------------- resources ----------------
  if p_resources is not null then
    if jsonb_typeof(p_resources) <> 'array' then
      raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
    end if;

    if jsonb_array_length(p_resources) > 500 then
      raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
    end if;

    for v_resource_item in select * from jsonb_array_elements(p_resources) loop
      if jsonb_typeof(v_resource_item) <> 'object' then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      if (
        v_resource_item
          - 'resourceId' - 'publicLabel' - 'canDownload' - 'displayOrder'
      ) <> '{}'::jsonb then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      if not (
        v_resource_item ? 'resourceId'
        and v_resource_item ? 'publicLabel'
        and v_resource_item ? 'canDownload'
        and v_resource_item ? 'displayOrder'
      ) then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      if jsonb_typeof(v_resource_item->'resourceId') <> 'string'
        or (v_resource_item->>'resourceId') !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      begin
        v_resource_id := lower(v_resource_item->>'resourceId')::uuid;
      exception
        when others then
          raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end;

      if v_resource_id = any(v_resource_ids) then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      if jsonb_typeof(v_resource_item->'publicLabel') <> 'string' then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      v_resource_label := v_resource_item->>'publicLabel';

      -- Matches share_link_resources_public_label_check exactly
      -- (202608030003): btrim length >= 1, raw length <= 120. Stored
      -- exactly as submitted, never trimmed.
      if char_length(v_resource_label) > 120
        or char_length(btrim(v_resource_label)) < 1 then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      if jsonb_typeof(v_resource_item->'canDownload') <> 'boolean' then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      -- Same overflow-safe numeric bound as the task displayOrder check
      -- above -- see its comment for the full reasoning.
      if jsonb_typeof(v_resource_item->'displayOrder') <> 'number'
        or (v_resource_item->>'displayOrder') !~ '^[0-9]+$'
        or (v_resource_item->>'displayOrder')::numeric > 2147483647 then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      v_resource_ids := array_append(v_resource_ids, v_resource_id);
      v_resource_labels := array_append(v_resource_labels, v_resource_label);
      v_resource_can_download_flags := array_append(
        v_resource_can_download_flags,
        (v_resource_item->>'canDownload')::boolean
      );
      v_resource_display_orders := array_append(
        v_resource_display_orders,
        (v_resource_item->>'displayOrder')::integer
      );
    end loop;
  end if;

  -- ---------------- publishUpdate ----------------
  if p_publish_update is not null then
    if jsonb_typeof(p_publish_update) <> 'object' then
      raise exception using errcode = 'P0001', message = 'INVALID_PUBLISH_UPDATE';
    end if;

    if (p_publish_update - 'body') <> '{}'::jsonb then
      raise exception using errcode = 'P0001', message = 'INVALID_PUBLISH_UPDATE';
    end if;

    if not (p_publish_update ? 'body') then
      raise exception using errcode = 'P0001', message = 'INVALID_PUBLISH_UPDATE';
    end if;

    if jsonb_typeof(p_publish_update->'body') <> 'string' then
      raise exception using errcode = 'P0001', message = 'INVALID_PUBLISH_UPDATE';
    end if;

    v_publish_body := p_publish_update->>'body';

    -- Matches share_link_updates_body_check exactly (202608030003):
    -- btrim length >= 1, raw length <= 5000. Stored exactly as
    -- submitted, never trimmed.
    if char_length(v_publish_body) > 5000
      or char_length(btrim(v_publish_body)) < 1 then
      raise exception using errcode = 'P0001', message = 'INVALID_PUBLISH_UPDATE';
    end if;
  end if;

  -- At least one group must be supplied. Defense in depth: the route's
  -- own Zod schema already enforces this at the HTTP boundary.
  if p_settings is null
    and p_tasks is null
    and p_resources is null
    and p_publish_update is null
  then
    raise exception using errcode = 'P0001', message = 'INVALID_CONFIGURATION';
  end if;

  -- =======================================================
  -- Ownership resolution and locking. Exact project-then-link order
  -- activate_share_link/reenable_share_link (202608060001) established:
  -- 1. Resolve the link's immutable project_id with a plain read.
  -- 2. Lock the owning project row FOR UPDATE first.
  -- 3. Lock the target link row FOR UPDATE.
  -- 4. Re-evaluate state only after both locks are held.
  -- =======================================================

  select link.project_id, link.user_id
    into v_project_id, v_link_user_id
    from public.project_share_links as link
    where link.id = p_link_id;

  if v_project_id is null or v_link_user_id <> v_user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.id, project.deleted_at, project.is_archived
    into v_locked_project_id, v_project_deleted_at, v_project_is_archived
    from public.projects as project
    where project.id = v_project_id
    for update;

  if v_locked_project_id is null or v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_project_is_archived then
    raise exception using errcode = 'P0001', message = 'PROJECT_ARCHIVED';
  end if;

  select
      link.state,
      link.configuration_version,
      link.comments_enabled,
      link.client_facing_subtitle,
      link.content_direction
    into
      v_link_state,
      v_link_configuration_version,
      v_old_comments_enabled,
      v_old_client_facing_subtitle,
      v_old_content_direction
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_link_state = 'revoked' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_REVOKED';
  end if;

  v_new_configuration_version := v_link_configuration_version;

  -- =======================================================
  -- Settings sub-operation. Only supplied fields change; omitted fields
  -- keep their current value via the CASE/self-reference below.
  -- configuration_version increases exactly once, only for a genuine
  -- change (IS DISTINCT FROM), and only settings ever bump it.
  -- =======================================================

  v_settings_changed :=
    p_settings is not null
    and (
      (v_has_comments_enabled
        and v_comments_enabled is distinct from v_old_comments_enabled)
      or (v_has_client_facing_subtitle
        and v_client_facing_subtitle is distinct from v_old_client_facing_subtitle)
      or (v_has_content_direction
        and v_content_direction is distinct from v_old_content_direction)
    );

  if v_settings_changed then
    v_new_configuration_version := v_link_configuration_version + 1;

    update public.project_share_links
      set
        comments_enabled = case
          when v_has_comments_enabled then v_comments_enabled
          else comments_enabled
        end,
        client_facing_subtitle = case
          when v_has_client_facing_subtitle then v_client_facing_subtitle
          else client_facing_subtitle
        end,
        content_direction = case
          when v_has_content_direction then v_content_direction
          else content_direction
        end,
        configuration_version = v_new_configuration_version
      where id = p_link_id and user_id = v_user_id;
  end if;

  -- =======================================================
  -- Task-mapping sub-operation. Prevalidates every submitted task against
  -- the same owner/project-attribution rule
  -- enforce_share_link_task_integrity independently re-enforces as an
  -- unconditional second line of defense, then performs a deterministic
  -- set replacement: delete rows absent from the submitted set, then
  -- insert-or-update-on-conflict the submitted set. An empty array
  -- clears the mapping (the delete's own predicate is unconditionally
  -- true for every existing row when v_task_ids is empty).
  -- =======================================================

  if p_tasks is not null then
    if cardinality(v_task_ids) > 0 and exists (
      select 1
        from unnest(v_task_ids) as requested_id
        left join public.tasks as task
          on task.id = requested_id
        where task.id is null
          or task.user_id <> v_user_id
          or task.deleted_at is not null
          or task.project_id is distinct from v_project_id
    ) then
      raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
    end if;

    delete from public.share_link_tasks
      where share_link_id = p_link_id
        and user_id = v_user_id
        and not (subtask_id = any(v_task_ids));

    insert into public.share_link_tasks (
      user_id,
      share_link_id,
      subtask_id,
      public_group,
      waiting_for_client_feedback,
      display_order
    )
    select
      v_user_id,
      p_link_id,
      t.subtask_id,
      t.public_group,
      t.waiting_for_client_feedback,
      t.display_order
    from unnest(
      v_task_ids, v_task_public_groups, v_task_waiting_flags, v_task_display_orders
    ) as t(subtask_id, public_group, waiting_for_client_feedback, display_order)
    on conflict (share_link_id, subtask_id) do update
      set
        public_group = excluded.public_group,
        waiting_for_client_feedback = excluded.waiting_for_client_feedback,
        display_order = excluded.display_order;

    if (
      select count(*)
        from public.share_link_tasks
        where share_link_id = p_link_id and user_id = v_user_id
    ) <> cardinality(v_task_ids) then
      raise exception using errcode = 'P0001', message = 'TASK_SET_VERIFICATION_FAILED';
    end if;
  end if;

  -- =======================================================
  -- Resource-mapping sub-operation. Mirrors enforce_share_link_resource_
  -- integrity's own project-attribution rule (direct project_id match,
  -- or task_id-derived project match, with contradiction rejected and
  -- neither present rejected) as an independent prevalidation, then the
  -- same deterministic set-replacement pattern as tasks.
  -- =======================================================

  if p_resources is not null then
    if cardinality(v_resource_ids) > 0 and exists (
      select 1
        from unnest(v_resource_ids) as requested_id
        left join public.task_resources as resource
          on resource.id = requested_id
        left join public.tasks as resource_task
          on resource_task.id = resource.task_id
        where resource.id is null
          or resource.user_id <> v_user_id
          or (resource.project_id is null and resource.task_id is null)
          or (
            resource.project_id is not null
            and resource.project_id <> v_project_id
          )
          or (
            resource.task_id is not null
            and (
              resource_task.id is null
              or resource_task.user_id <> v_user_id
              or resource_task.project_id is distinct from v_project_id
              or (
                resource.project_id is not null
                and resource.project_id <> resource_task.project_id
              )
            )
          )
    ) then
      raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
    end if;

    delete from public.share_link_resources
      where share_link_id = p_link_id
        and user_id = v_user_id
        and not (resource_id = any(v_resource_ids));

    insert into public.share_link_resources (
      user_id,
      share_link_id,
      resource_id,
      public_label,
      can_download,
      display_order
    )
    select
      v_user_id,
      p_link_id,
      r.resource_id,
      r.public_label,
      r.can_download,
      r.display_order
    from unnest(
      v_resource_ids,
      v_resource_labels,
      v_resource_can_download_flags,
      v_resource_display_orders
    ) as r(resource_id, public_label, can_download, display_order)
    on conflict (share_link_id, resource_id) do update
      set
        public_label = excluded.public_label,
        can_download = excluded.can_download,
        display_order = excluded.display_order;

    if (
      select count(*)
        from public.share_link_resources
        where share_link_id = p_link_id and user_id = v_user_id
    ) <> cardinality(v_resource_ids) then
      raise exception using errcode = 'P0001', message = 'RESOURCE_SET_VERIFICATION_FAILED';
    end if;
  end if;

  -- =======================================================
  -- Update-publication sub-operation. Mandatory order: retire the
  -- existing current row(s) BEFORE inserting the new one, because
  -- share_link_updates_current_version_unique_idx (a partial unique
  -- index on share_link_id where is_current) rejects two simultaneous
  -- current rows for the same link. Never edits an existing published
  -- row's immutable body/version/published_at -- only is_current changes
  -- on the retired row, matching enforce_share_link_update_integrity's
  -- own allowance exactly.
  -- =======================================================

  if p_publish_update is not null then
    update public.share_link_updates
      set is_current = false
      where share_link_id = p_link_id
        and is_current;

    select coalesce(max(version), 0) + 1
      into v_next_version
      from public.share_link_updates
      where share_link_id = p_link_id;

    insert into public.share_link_updates (
      user_id,
      share_link_id,
      body,
      version,
      published_at,
      created_by,
      is_current
    ) values (
      v_user_id,
      p_link_id,
      v_publish_body,
      v_next_version,
      v_now,
      v_user_id,
      true
    );

    get diagnostics v_publish_inserted_count = row_count;

    if v_publish_inserted_count <> 1 then
      raise exception using errcode = 'P0001', message = 'PUBLISH_UPDATE_INSERT_FAILED';
    end if;
  end if;

  -- =======================================================
  -- Final committed state. currentUpdate always reflects the row that is
  -- current after every sub-operation above, whether or not this call
  -- itself published one.
  -- =======================================================

  v_current_update_version := null;
  v_current_update_published_at := null;

  select update_row.version, update_row.published_at
    into v_current_update_version, v_current_update_published_at
    from public.share_link_updates as update_row
    where update_row.share_link_id = p_link_id
      and update_row.is_current;

  select coalesce(
      jsonb_agg(
        final_task.subtask_id::text
        order by final_task.display_order, final_task.subtask_id
      ),
      '[]'::jsonb
    )
    into v_result_task_ids
    from public.share_link_tasks as final_task
    where final_task.share_link_id = p_link_id
      and final_task.user_id = v_user_id;

  select coalesce(
      jsonb_agg(
        final_resource.resource_id::text
        order by final_resource.display_order, final_resource.resource_id
      ),
      '[]'::jsonb
    )
    into v_result_resource_ids
    from public.share_link_resources as final_resource
    where final_resource.share_link_id = p_link_id
      and final_resource.user_id = v_user_id;

  return jsonb_build_object(
    'linkId', p_link_id,
    'configurationVersion', v_new_configuration_version,
    'taskIds', v_result_task_ids,
    'resourceIds', v_result_resource_ids,
    'currentUpdate', case
      when v_current_update_version is null then null
      else jsonb_build_object(
        'version', v_current_update_version,
        'publishedAt', v_current_update_published_at
      )
    end
  );
end;
$$;

comment on function public.save_share_configuration(uuid, jsonb, jsonb, jsonb, jsonb) is
  'Phase 1B.4: the single atomic owner-side configuration-save operation, combining settings (comments_enabled, client_facing_subtitle, content_direction), the share_link_tasks set, the share_link_resources set and an optional new published share_link_updates version -- all inside one PostgreSQL transaction that commits or rolls back completely. SECURITY DEFINER; obtains and null-checks auth.uid() internally; accepts no user_id or project_id. Locks the owning project row FOR UPDATE, then the target link row FOR UPDATE (the same order as activate_share_link/reenable_share_link, 202608060001), and rejects a deleted or archived project and a revoked link. Every supplied JSON group is independently validated against its exact shape (type, exact keys, string/boolean/integer bounds, closed vocabularies, canonical decimal subtask-id strings cast to bigint only after regex validation, UUID resource ids) before any write. Tasks and Resources are prevalidated against the same owner/project-attribution rules enforce_share_link_task_integrity/enforce_share_link_resource_integrity independently re-enforce as an unconditional second line of defense -- neither trigger is weakened, bypassed or replaced. configuration_version increases exactly once, only when a supplied settings field genuinely changed (IS DISTINCT FROM); task, Resource and update-publication changes never bump it. A supplied tasks/resources array performs a deterministic set replacement (delete-absent, insert-or-update-on-conflict) so the final mapping equals exactly the submitted set; an empty array clears the mapping; a null group leaves the existing mapping untouched. A supplied publishUpdate retires the existing current update row before inserting exactly one new immutable current version, matching the mandatory retire-then-insert order share_link_updates_current_version_unique_idx requires. Never touches public_id, secret_digest, secret material, PIN material, expiry, activated_at, disabled_at, rotated_at, revoked_at, view_count, last_viewed_at, link lifecycle state, share_link_events, share_browser_sessions or share_session_grants. Returns only linkId, configurationVersion, the final taskIds (ordered by display_order then subtask_id), the final resourceIds (ordered by display_order then resource_id), and the final currentUpdate (version and publishedAt only, never the body).';

revoke all on function public.save_share_configuration(uuid, jsonb, jsonb, jsonb, jsonb)
  from public;
revoke all on function public.save_share_configuration(uuid, jsonb, jsonb, jsonb, jsonb)
  from anon;
revoke all on function public.save_share_configuration(uuid, jsonb, jsonb, jsonb, jsonb)
  from service_role;
grant execute on function public.save_share_configuration(uuid, jsonb, jsonb, jsonb, jsonb)
  to authenticated;
