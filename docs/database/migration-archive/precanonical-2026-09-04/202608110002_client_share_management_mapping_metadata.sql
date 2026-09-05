-- Text2Task Client Share Link -- Phase 2B Corrective Foundation
-- Migration: 202608110002_client_share_management_mapping_metadata.sql
-- Created: 2026-08-11
--
-- Purpose:
-- Phase 2B's owner content-configuration editor (share-link-
-- configuration-editor.tsx) must be able to reopen an already-saved
-- share link and edit it losslessly. A read-only acceptance trace found
-- that public.get_share_link_management_state (delivered 202608050001,
-- extended 202608110001) returns only bare id arrays for the owner's
-- curated task/Resource mappings:
--
--   mappedTaskIds:     string[]   (share_link_tasks.subtask_id only)
--   mappedResourceIds: string[]   (share_link_resources.resource_id only)
--
-- None of the following persisted, owner-authored per-item metadata was
-- ever returned by any authenticated read path:
--
--   share_link_tasks.public_group
--   share_link_tasks.waiting_for_client_feedback
--   share_link_tasks.display_order
--   share_link_resources.public_label
--   share_link_resources.can_download
--   share_link_resources.display_order
--
-- Because public.save_share_configuration's task/resource groups are a
-- deterministic FULL-SET replacement (never a per-item patch), the owner
-- editor could not reconstruct an untouched sibling item's true metadata
-- when resubmitting the set after editing just one other item -- it had
-- to guess/default that data, which then overwrote the real persisted
-- values on save. This migration closes that gap at its root: the read
-- contract itself, not the editor.
--
-- Root correction:
-- Extend the EXISTING public.get_share_link_management_state(uuid)
-- function in place (same signature, same SECURITY INVOKER posture,
-- `create or replace function`, no DROP+recreate needed since the return
-- type stays `jsonb`). No new RPC, no new route, no new table.
--
-- The management response's `mappedTaskIds`/`mappedResourceIds` bare-id
-- arrays are REPLACED (not supplemented) by structured arrays carrying
-- the complete persisted per-item mapping metadata:
--
--   mappedTasks: [{ subtaskId, publicGroup, waitingForClientFeedback,
--                    displayOrder }, ...]
--   mappedResources: [{ resourceId, publicLabel, canDownload,
--                        displayOrder }, ...]
--
-- The bare-id arrays are deliberately NOT kept alongside the structured
-- arrays as a second durable source of truth: Client Share is still
-- feature-gated off (TEXT2TASK_CLIENT_SHARE_ENABLED), no Client Share
-- migration has ever been applied to Production, and no real user
-- depends on the prior response shape, so every current application
-- consumer (lib/share/share-contracts.ts, the Phase 2B configuration
-- editor, and their tests) is migrated to the structured arrays in the
-- same repository change that ships this migration. Ids needed for
-- counts/selection are derived from the structured arrays in application
-- code (`mappedTasks.map(t => t.subtaskId)`), never re-fetched.
--
-- Ordering: identical to the prior version -- `order by display_order,
-- <id>` for each mapping table. Persisted display_order values are
-- returned exactly as stored (e.g. 8 and 4 stay 8 and 4); this migration
-- performs no renumbering or normalization on read.
--
-- Deliberately NOT in this migration:
--   - No change to public.save_share_configuration. Its exact-set /
--     omitted-means-unchanged / empty-clears-mapping semantics, its
--     configuration_version change-detection group, and every other
--     write behavior are untouched.
--   - No change to public.list_share_link_summaries (it has never
--     returned per-item task/Resource mapping data and still does not).
--   - No new table, column, index, trigger, policy or grant beyond the
--     `create or replace function` + defense-in-depth grant re-assertion
--     this feature's every prior RPC migration already performs.
--   - No full subtask record, full Resource record, project data or any
--     other private content -- only the four owner-authored mapping
--     columns per item, exactly as already exposed (in aggregate, as
--     bare ids) by the version of this function this migration replaces.
--   - No change to public_id, secret_digest, secret material, PIN
--     material, expiry, activated_at, disabled_at, rotated_at,
--     revoked_at, view_count, last_viewed_at, link lifecycle state,
--     share_link_events, share_browser_sessions or share_session_grants.
--
-- Security posture (matches every Phase 1B/1C RPC migration in this
-- feature): exact prior signature, SECURITY INVOKER, explicit
-- `set search_path = public, pg_temp`, auth.uid()-internal ownership
-- resolution, no user_id or project_id expansion, identical deterministic
-- one-link V1 management selection (`state <> 'revoked'`, active-first,
-- then most recently updated). Grants are re-asserted explicitly below
-- for defense in depth even though `create or replace function` with an
-- unchanged signature preserves the existing ACL.
--
-- Transaction posture: no explicit begin;/commit;, matching every
-- existing tracked migration. Historical migrations
-- (202608050001, 202608110001 and every prior Client Share migration)
-- are not modified.

create or replace function public.get_share_link_management_state(p_project_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_owner uuid;
  v_project_deleted_at timestamptz;
  v_link_id uuid;
  v_public_id text;
  v_state text;
  v_expires_at timestamptz;
  v_pin_hash text;
  v_comments_enabled boolean;
  v_client_facing_subtitle text;
  v_content_direction text;
  v_title_visible boolean;
  v_status_visible boolean;
  v_target_date_visible boolean;
  v_configuration_version integer;
  v_created_at timestamptz;
  v_activated_at timestamptz;
  v_disabled_at timestamptz;
  v_rotated_at timestamptz;
  v_last_viewed_at timestamptz;
  v_view_count integer;
  v_mapped_tasks jsonb;
  v_mapped_resources jsonb;
  v_current_update jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_project_id is null then
    raise exception using errcode = 'P0001', message = 'PROJECT_NOT_FOUND';
  end if;

  select project.user_id, project.deleted_at
    into v_project_owner, v_project_deleted_at
    from public.projects as project
    where project.id = p_project_id;

  if v_project_owner is null
    or v_project_owner <> v_user_id
    or v_project_deleted_at is not null
  then
    raise exception using errcode = 'P0001', message = 'PROJECT_NOT_FOUND';
  end if;

  -- Deterministic V1 managed-link selection: prefer the active link;
  -- otherwise the most recently updated non-revoked link.
  select
      link.id, link.public_id, link.state, link.expires_at, link.pin_hash,
      link.comments_enabled, link.client_facing_subtitle, link.content_direction,
      link.title_visible, link.status_visible, link.target_date_visible,
      link.configuration_version, link.created_at, link.activated_at,
      link.disabled_at, link.rotated_at, link.last_viewed_at, link.view_count
    into
      v_link_id, v_public_id, v_state, v_expires_at, v_pin_hash,
      v_comments_enabled, v_client_facing_subtitle, v_content_direction,
      v_title_visible, v_status_visible, v_target_date_visible,
      v_configuration_version, v_created_at, v_activated_at,
      v_disabled_at, v_rotated_at, v_last_viewed_at, v_view_count
    from public.project_share_links as link
    where link.project_id = p_project_id
      and link.user_id = v_user_id
      and link.state <> 'revoked'
    order by
      (link.state = 'active') desc,
      link.updated_at desc,
      link.created_at desc,
      link.id desc
    limit 1;

  if v_link_id is null then
    return jsonb_build_object(
      'link', null,
      'mappedTasks', '[]'::jsonb,
      'mappedResources', '[]'::jsonb,
      'currentUpdate', null
    );
  end if;

  -- subtask_id is bigint; cast to text so it is never round-tripped as a
  -- JSON number, which could silently lose precision for large ids.
  -- public_group/waiting_for_client_feedback/display_order are the
  -- owner's own persisted per-item mapping metadata -- never a copy of
  -- the task's internal title, status, deadline, amount or priority.
  select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'subtaskId', task.subtask_id::text,
          'publicGroup', task.public_group,
          'waitingForClientFeedback', task.waiting_for_client_feedback,
          'displayOrder', task.display_order
        )
        order by task.display_order, task.subtask_id
      ),
      '[]'::jsonb
    )
    into v_mapped_tasks
    from public.share_link_tasks as task
    where task.share_link_id = v_link_id
      and task.user_id = v_user_id;

  -- public_label/can_download/display_order are the owner's own
  -- persisted per-item mapping metadata -- never a copy of the
  -- Resource's storage_path, file_name, url, mime_type, size_bytes or
  -- notes.
  select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'resourceId', resource.resource_id,
          'publicLabel', resource.public_label,
          'canDownload', resource.can_download,
          'displayOrder', resource.display_order
        )
        order by resource.display_order, resource.resource_id
      ),
      '[]'::jsonb
    )
    into v_mapped_resources
    from public.share_link_resources as resource
    where resource.share_link_id = v_link_id
      and resource.user_id = v_user_id;

  select jsonb_build_object('body', upd.body, 'version', upd.version, 'publishedAt', upd.published_at)
    into v_current_update
    from public.share_link_updates as upd
    where upd.share_link_id = v_link_id
      and upd.user_id = v_user_id
      and upd.is_current
    limit 1;

  return jsonb_build_object(
    'link', jsonb_build_object(
      'id', v_link_id,
      'publicId', v_public_id,
      'state', v_state,
      'expiresAt', v_expires_at,
      'hasPin', v_pin_hash is not null,
      'commentsEnabled', v_comments_enabled,
      'clientFacingSubtitle', v_client_facing_subtitle,
      'contentDirection', v_content_direction,
      'titleVisible', v_title_visible,
      'statusVisible', v_status_visible,
      'targetDateVisible', v_target_date_visible,
      'configurationVersion', v_configuration_version,
      'createdAt', v_created_at,
      'activatedAt', v_activated_at,
      'disabledAt', v_disabled_at,
      'rotatedAt', v_rotated_at,
      'lastViewedAt', v_last_viewed_at,
      'viewCount', v_view_count
    ),
    'mappedTasks', v_mapped_tasks,
    'mappedResources', v_mapped_resources,
    'currentUpdate', v_current_update
  );
end;
$$;

comment on function public.get_share_link_management_state(uuid) is
  'Phase 1B.1, extended by Phase 1C, corrected by Phase 2B: read-only owner management state for the single V1-managed share link on one owned, non-deleted project. SECURITY INVOKER, relies on existing RLS. mappedTasks/mappedResources now return the complete persisted per-item mapping metadata (publicGroup/waitingForClientFeedback/displayOrder for each task; publicLabel/canDownload/displayOrder for each Resource), ordered by display_order then id exactly as stored -- never renumbered on read. Replaces the prior mappedTaskIds/mappedResourceIds bare-id arrays entirely (not supplemented) since no consumer of this feature-gated-off RPC depended on the prior shape. Never returns secret_digest, pin_hash/pin_salt, PIN scrypt parameters, user_id, project_id, created_by, storage_path, file_name, url, mime_type, size_bytes, task_resources.notes or any internal mapping-table row id. Does not mutate view_count or last_viewed_at.';

revoke all on function public.get_share_link_management_state(uuid) from public;
revoke all on function public.get_share_link_management_state(uuid) from anon;
revoke all on function public.get_share_link_management_state(uuid) from service_role;
grant execute on function public.get_share_link_management_state(uuid) to authenticated;
