-- Text2Task Client Share Link -- Phase 1B.1 Owner-Facing Read RPCs
-- Migration: 202608050001_client_share_owner_reads.sql
-- Created: 2026-08-05
--
-- Purpose:
-- Phase 1B.1 of the Client Share Link feature (see
-- docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_MAPPING_2026-08-05.md). This
-- migration adds exactly two read-only, SECURITY INVOKER RPCs so an
-- authenticated project owner can read their own share-link management
-- state without any route ever running a raw table SELECT against
-- public.project_share_links, public.share_link_tasks,
-- public.share_link_resources or public.share_link_updates:
--
--   public.get_share_link_management_state(p_project_id uuid)
--     Returns the single V1-managed share link for one owned project (or
--     null if none exists), its mapped task/resource ids and its current
--     published update, using only the safe owner-management field
--     allowlist.
--
--   public.list_share_link_summaries(p_project_ids uuid[])
--     Returns one summary entry per requested project id (1-100), for a
--     dashboard list view, again restricted to a safe summary field
--     allowlist.
--
-- Both functions run SECURITY INVOKER with a locked search_path, obtain
-- auth.uid() internally, and rely entirely on the SELECT grant and RLS
-- policies public.project_share_links, public.share_link_tasks,
-- public.share_link_resources and public.share_link_updates already have
-- from 202608030005_client_share_integrity_and_security.sql. No new grant,
-- policy, trigger, constraint, table, column, index or extension is added
-- or modified by this migration.
--
-- Deliberately NOT in this migration (deferred to later Phase 1B steps):
--   - Any SECURITY DEFINER RPC.
--   - Any mutation (create/rotate/disable/revoke/configure) RPC or route.
--   - Any public/anonymous preview route or RPC.
--   - Any secret, PIN, encryption, public-id generation or lifecycle code.
--   - Any client-message / unread-count logic (list_share_link_summaries's
--     unreadCount stays null in this phase).
--
-- Both functions raise a stable P0001 UNAUTHORIZED when auth.uid() is
-- null, and a stable P0001 PROJECT_NOT_FOUND whenever the caller is not
-- the owner of a requested project (including when the project does not
-- exist, or is soft-deleted) -- the same error either way, so a caller can
-- never distinguish "does not exist" from "exists, owned by someone else".

-- ---------------------------------------------------------------------
-- public.get_share_link_management_state(p_project_id uuid)
-- ---------------------------------------------------------------------

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
  v_configuration_version integer;
  v_created_at timestamptz;
  v_activated_at timestamptz;
  v_disabled_at timestamptz;
  v_rotated_at timestamptz;
  v_last_viewed_at timestamptz;
  v_view_count integer;
  v_task_ids jsonb;
  v_resource_ids jsonb;
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
      link.configuration_version, link.created_at, link.activated_at,
      link.disabled_at, link.rotated_at, link.last_viewed_at, link.view_count
    into
      v_link_id, v_public_id, v_state, v_expires_at, v_pin_hash,
      v_comments_enabled, v_client_facing_subtitle, v_content_direction,
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
      'mappedTaskIds', '[]'::jsonb,
      'mappedResourceIds', '[]'::jsonb,
      'currentUpdate', null
    );
  end if;

  -- subtask_id is bigint; cast to text so it is never round-tripped as a
  -- JSON number, which could silently lose precision for large ids.
  select coalesce(
      jsonb_agg(task.subtask_id::text order by task.display_order, task.subtask_id),
      '[]'::jsonb
    )
    into v_task_ids
    from public.share_link_tasks as task
    where task.share_link_id = v_link_id
      and task.user_id = v_user_id;

  select coalesce(
      jsonb_agg(resource.resource_id order by resource.display_order, resource.resource_id),
      '[]'::jsonb
    )
    into v_resource_ids
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
      'configurationVersion', v_configuration_version,
      'createdAt', v_created_at,
      'activatedAt', v_activated_at,
      'disabledAt', v_disabled_at,
      'rotatedAt', v_rotated_at,
      'lastViewedAt', v_last_viewed_at,
      'viewCount', v_view_count
    ),
    'mappedTaskIds', v_task_ids,
    'mappedResourceIds', v_resource_ids,
    'currentUpdate', v_current_update
  );
end;
$$;

comment on function public.get_share_link_management_state(uuid) is
  'Phase 1B.1: read-only owner management state for the single V1-managed '
  'share link on one owned, non-deleted project. SECURITY INVOKER, relies '
  'on existing RLS. Never returns secret_digest, pin_hash/pin_salt, PIN '
  'scrypt parameters, user_id, project_id, created_by or any internal '
  'mapping-table row id. Does not mutate view_count or last_viewed_at.';

revoke all on function public.get_share_link_management_state(uuid) from public;
revoke all on function public.get_share_link_management_state(uuid) from anon;
grant execute on function public.get_share_link_management_state(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- public.list_share_link_summaries(p_project_ids uuid[])
-- ---------------------------------------------------------------------

create or replace function public.list_share_link_summaries(p_project_ids uuid[])
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_ids uuid[];
  v_owned_project_count integer;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_project_ids is null or cardinality(p_project_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_PROJECT_IDS';
  end if;

  if cardinality(p_project_ids) > 100 then
    raise exception using errcode = 'P0001', message = 'TOO_MANY_PROJECT_IDS';
  end if;

  if exists (
    select 1
      from unnest(p_project_ids) as requested(project_id)
      where requested.project_id is null
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_PROJECT_IDS';
  end if;

  -- Normalize (dedupe) the requested ids into a stable, deterministic order.
  select array_agg(distinct requested.project_id order by requested.project_id)
    into v_project_ids
    from unnest(p_project_ids) as requested(project_id);

  select count(*)
    into v_owned_project_count
    from public.projects as project
    where project.id = any (v_project_ids)
      and project.user_id = v_user_id
      and project.deleted_at is null;

  -- Reject the whole call rather than silently returning partial
  -- cross-tenant results if any requested project is not owned.
  if v_owned_project_count <> cardinality(v_project_ids) then
    raise exception using errcode = 'P0001', message = 'PROJECT_NOT_FOUND';
  end if;

  -- Set-based summary build: one managed link per requested project
  -- (DISTINCT ON, same active-first / most-recently-updated tiebreak as
  -- get_share_link_management_state), then grouped task/resource counts
  -- for exactly those selected links, then a single aggregate covering
  -- every requested project -- no per-project loop or per-project query.
  with requested_projects as (
    select requested.project_id
      from unnest(v_project_ids) as requested(project_id)
  ),
  managed_links as (
    select distinct on (link.project_id)
        link.project_id,
        link.id as link_id,
        link.state,
        link.expires_at,
        link.pin_hash,
        link.created_at,
        link.last_viewed_at,
        link.view_count
      from public.project_share_links as link
      where link.project_id = any (v_project_ids)
        and link.user_id = v_user_id
        and link.state <> 'revoked'
      order by
        link.project_id,
        (link.state = 'active') desc,
        link.updated_at desc,
        link.created_at desc,
        link.id desc
  ),
  task_counts as (
    select task.share_link_id, count(*) as task_count
      from public.share_link_tasks as task
      where task.share_link_id in (select managed_links.link_id from managed_links)
        and task.user_id = v_user_id
      group by task.share_link_id
  ),
  resource_counts as (
    select resource.share_link_id, count(*) as resource_count
      from public.share_link_resources as resource
      where resource.share_link_id in (select managed_links.link_id from managed_links)
        and resource.user_id = v_user_id
      group by resource.share_link_id
  )
  select jsonb_object_agg(
      requested_projects.project_id::text,
      jsonb_build_object(
        'projectId', requested_projects.project_id,
        'linkId', managed_links.link_id,
        'state', managed_links.state,
        'expiresAt', managed_links.expires_at,
        'hasPin', managed_links.pin_hash is not null,
        'createdAt', managed_links.created_at,
        'lastViewedAt', managed_links.last_viewed_at,
        'viewCount', coalesce(managed_links.view_count, 0),
        'taskCount', coalesce(task_counts.task_count, 0),
        'resourceCount', coalesce(resource_counts.resource_count, 0),
        'unreadCount', null
      )
    )
    into v_result
    from requested_projects
    left join managed_links
      on managed_links.project_id = requested_projects.project_id
    left join task_counts
      on task_counts.share_link_id = managed_links.link_id
    left join resource_counts
      on resource_counts.share_link_id = managed_links.link_id;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

comment on function public.list_share_link_summaries(uuid[]) is
  'Phase 1B.1: read-only per-project share-link summaries (1-100 owned, '
  'non-deleted projects), keyed by project id. SECURITY INVOKER, relies on '
  'existing RLS. Rejects the whole call with PROJECT_NOT_FOUND if any '
  'requested project is not owned -- never returns partial cross-tenant '
  'results. unreadCount is always null in Phase 1B.1.';

revoke all on function public.list_share_link_summaries(uuid[]) from public;
revoke all on function public.list_share_link_summaries(uuid[]) from anon;
grant execute on function public.list_share_link_summaries(uuid[]) to authenticated;
