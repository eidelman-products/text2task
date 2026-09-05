-- Text2Task Client Share Link -- Cross-Table Integrity and Privilege
-- Hardening
-- Migration: 202608030005_client_share_integrity_and_security.sql
-- Created: 2026-08-03
--
-- Purpose:
-- Phase 1A database-level relationship integrity for the Client Share
-- Link feature. Row Level Security on a Client Share row can only ever
-- express "this row's user_id is me". It structurally cannot express "the
-- project, task, Resource, Client Update or parent message this row points
-- at belongs to the same owner and the same project" -- no RLS policy
-- anywhere in this repository joins to a parent table, and none should
-- start. Application-level checks alone are also insufficient: they are
-- re-derived at every call site, and the service role bypasses RLS
-- entirely.
--
-- This migration therefore adds one narrowly scoped trigger per Client
-- Share table that carries a cross-table relationship, following the
-- pattern established by
-- public.enforce_calendar_event_relationship_integrity() in
-- 202607290001_calendar_events.sql exactly: language plpgsql, SECURITY
-- INVOKER, an explicit `set search_path = public, pg_temp`, and stable
-- SCREAMING_SNAKE_CASE messages raised with errcode P0001 so TypeScript
-- can match them the way app/api/projects/update/route.ts already matches
-- existing database error codes.
--
-- Deliberate behavioural rules, all of which differ from the calendar
-- precedent and are the safer choice here:
--   - NOTHING is silently repaired or normalised. The calendar trigger
--     normalises client_id to the linked project's client. These triggers
--     never rewrite an input value; a mismatched user_id/project_id pair
--     is REJECTED, never quietly corrected, because quietly correcting it
--     would hide invalid caller input on a surface whose whole purpose is
--     deciding what a third party may see.
--   - No cross-tenant fallback of any kind exists. Every check compares
--     against the row's own user_id and the share link's own project_id.
--   - The conversion traceability trigger is INSERT-only, so FK-driven
--     ON DELETE SET NULL maintenance can still clear optional target
--     references without user-facing UPDATE capability.
--   - No trigger here analyses a message, creates a project update,
--     creates a task, changes a project or task status, mutates any CRM
--     row, or writes to public.project_timeline_events. There is
--     deliberately no automatic message-to-CRM path anywhere in this
--     migration set.
--
-- SECURITY DEFINER is NOT used anywhere in this migration. Every function
-- is SECURITY INVOKER, matching all but one function in the entire
-- existing schema. Under an owner-authenticated caller, RLS on
-- public.projects / public.tasks / public.task_resources means a
-- cross-account id simply resolves to "not found" rather than "not owned";
-- both outcomes reject the write, which is the required behaviour. Under
-- the service role, RLS is bypassed and the explicit ownership comparisons
-- below are what actually enforce the boundary -- which is precisely why
-- they are written as explicit comparisons rather than relying on RLS.
--
-- Non-goals: this migration creates, alters, drops or re-grants no
-- existing production object. public.projects, public.tasks,
-- public.clients, public.task_resources, public.project_updates and
-- storage.* are read inside function bodies only, never modified. The two
-- overlapping public.task_resources resource_type CHECK constraints are
-- deliberately left exactly as they are.
--
-- Schema-drift posture (fail closed): this migration creates no table, no
-- column and no index. `create or replace function` and `drop trigger if
-- exists` are used only where the full intended definition is supplied
-- immediately below in this file.
--
-- Transaction posture: no explicit begin;/commit;, matching every existing
-- tracked migration -- see the header of
-- 202608030003_client_share_owner_foundation.sql for the full reasoning.
--
-- Sequencing: apply after 202608030003_client_share_owner_foundation.sql
-- and 202608030004_client_share_session_foundation.sql, both of which must
-- already have created every table referenced here.

-- =========================================================
-- 1. public.project_share_links
--
-- A link may only ever be attached to a project the link's own user_id
-- owns, and a link's owner may never be reassigned. The project's owner is
-- deliberately NOT copied into new.user_id: copying it would silently
-- accept -- and then hide -- a caller that supplied the wrong user_id.
-- =========================================================

create or replace function public.enforce_project_share_link_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_project_user_id uuid;
  v_access_changed boolean;
  v_digest_changed boolean;
  v_secret_changed boolean;
  v_rotation_timestamp_changed boolean;
  v_state_transition_allowed boolean;
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_OWNER_MISMATCH';
    end if;

    if new.project_id is distinct from old.project_id then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_PROJECT_IMMUTABLE';
    end if;

    if new.public_id is distinct from old.public_id then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_PUBLIC_ID_IMMUTABLE';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_CREATED_AT_IMMUTABLE';
    end if;

    if old.activated_at is not null
      and new.activated_at is distinct from old.activated_at then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_ACTIVATED_AT_IMMUTABLE';
    end if;

    if old.state <> 'draft' and new.state = 'draft' then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_DRAFT_STATE_IRREVERSIBLE';
    end if;

    if old.disabled_at is not null
      and (
        new.disabled_at is null
        or new.disabled_at < old.disabled_at
      ) then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_DISABLED_AT_DECREASE';
    end if;

    if old.rotated_at is not null
      and (
        new.rotated_at is null
        or new.rotated_at < old.rotated_at
      ) then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_ROTATED_AT_DECREASE';
    end if;

    if new.configuration_version < old.configuration_version then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_CONFIGURATION_VERSION_DECREASE';
    end if;

    if new.view_count < old.view_count then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_VIEW_COUNT_DECREASE';
    end if;

    if old.last_viewed_at is not null
      and (
        new.last_viewed_at is null
        or new.last_viewed_at < old.last_viewed_at
      ) then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_LAST_VIEWED_AT_DECREASE';
    end if;

    if old.revoked_at is not null
      and (
        new.revoked_at is null
        or new.revoked_at < old.revoked_at
      ) then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_REVOCATION_IRREVERSIBLE';
    end if;

    if old.state = 'revoked' and new.state <> 'revoked' then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_REVOKED_STATE_TERMINAL';
    end if;

    if new.state is distinct from old.state then
      v_state_transition_allowed :=
        (old.state = 'draft' and new.state in ('active', 'revoked'))
        or (old.state = 'active' and new.state in ('disabled', 'expired', 'revoked'))
        or (old.state = 'disabled' and new.state in ('active', 'expired', 'revoked'))
        or (old.state = 'expired' and new.state in ('active', 'revoked'));

      if not v_state_transition_allowed then
        raise exception using errcode = 'P0001', message = 'SHARE_LINK_STATE_TRANSITION_INVALID';
      end if;

      if old.state = 'expired'
        and new.state = 'active'
        and new.configuration_version <= old.configuration_version then
        raise exception using errcode = 'P0001', message = 'SHARE_LINK_VERSION_NOT_INCREMENTED';
      end if;
    end if;

    v_access_changed :=
      new.secret_digest is distinct from old.secret_digest
      or new.secret_digest_version is distinct from old.secret_digest_version
      or new.state is distinct from old.state
      or new.expires_at is distinct from old.expires_at
      or new.pin_hash is distinct from old.pin_hash
      or new.pin_salt is distinct from old.pin_salt
      or new.pin_hash_version is distinct from old.pin_hash_version
      or new.pin_scrypt_n is distinct from old.pin_scrypt_n
      or new.pin_scrypt_r is distinct from old.pin_scrypt_r
      or new.pin_scrypt_p is distinct from old.pin_scrypt_p
      or new.pin_key_length is distinct from old.pin_key_length
      or new.comments_enabled is distinct from old.comments_enabled
      or new.client_facing_subtitle is distinct from old.client_facing_subtitle
      or new.content_direction is distinct from old.content_direction;

    if v_access_changed and new.configuration_version <= old.configuration_version then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_VERSION_NOT_INCREMENTED';
    end if;

    v_digest_changed := new.secret_digest is distinct from old.secret_digest;
    v_secret_changed :=
      v_digest_changed
      or new.secret_digest_version is distinct from old.secret_digest_version;
    v_rotation_timestamp_changed := new.rotated_at is distinct from old.rotated_at;

    if new.secret_digest_version is distinct from old.secret_digest_version
      and not v_digest_changed then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_ROTATION_REQUIRES_SECRET_CHANGE';
    end if;

    if old.secret_digest is not null and v_secret_changed then
      if new.rotated_at is null
        or new.rotated_at is not distinct from old.rotated_at
        or (
          old.rotated_at is not null
          and new.rotated_at <= old.rotated_at
        ) then
        raise exception using errcode = 'P0001', message = 'SHARE_LINK_ROTATION_TIMESTAMP_REQUIRED';
      end if;
    end if;

    if v_rotation_timestamp_changed then
      if new.rotated_at is null
        or (
          old.rotated_at is not null
          and new.rotated_at <= old.rotated_at
        ) then
        raise exception using errcode = 'P0001', message = 'SHARE_LINK_ROTATION_TIMESTAMP_REQUIRED';
      end if;

      if not v_digest_changed then
        raise exception using errcode = 'P0001', message = 'SHARE_LINK_ROTATION_REQUIRES_SECRET_CHANGE';
      end if;

      if new.configuration_version <= old.configuration_version then
        raise exception using errcode = 'P0001', message = 'SHARE_LINK_VERSION_NOT_INCREMENTED';
      end if;
    end if;
  end if;

  select project.user_id
    into v_project_user_id
    from public.projects as project
    where project.id = new.project_id;

  if v_project_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_PROJECT_NOT_FOUND';
  end if;

  if v_project_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_PROJECT_NOT_OWNED';
  end if;

  return new;
end;
$$;

comment on function public.enforce_project_share_link_integrity() is
  'Rejects a share link whose project_id is not owned by the link''s own user_id; rejects owner, project, public_id and created_at reassignment; enforces monotonic configuration_version, view_count, last_viewed_at and revoked_at; makes revoked state terminal; and requires security/access changes to increase configuration_version. Never copies or silently repairs caller input.';

drop trigger if exists project_share_links_enforce_integrity
  on public.project_share_links;

create trigger project_share_links_enforce_integrity
before insert or update on public.project_share_links
for each row
execute function public.enforce_project_share_link_integrity();

-- =========================================================
-- 2. public.share_link_tasks
--
-- Every mapping must satisfy all of: the mapping's user_id equals the
-- share link's user_id; the referenced task belongs to that same user; the
-- task belongs to the SAME project as the share link; the task actually
-- has a project. A cross-account subtask id and a same-owner but
-- cross-project subtask id are both rejected, with distinct stable codes.
--
-- A soft-deleted task is rejected at mapping time as well. That is not a
-- substitute for read-time filtering: this repository soft-deletes tasks,
-- so a task deleted AFTER it was mapped still needs
-- `tasks.deleted_at is null` (and an archived check) in every public read.
-- Deleted/archived state is never copied into the mapping -- this table
-- has no column that could hold it.
-- =========================================================

create or replace function public.enforce_share_link_task_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_link_user_id uuid;
  v_link_project_id uuid;
  v_task_user_id uuid;
  v_task_project_id uuid;
  v_task_deleted_at timestamptz;
  v_relationship_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_relationship_changed := true;
  else
    v_relationship_changed :=
      new.user_id is distinct from old.user_id
      or new.share_link_id is distinct from old.share_link_id
      or new.subtask_id is distinct from old.subtask_id;
  end if;

  if not v_relationship_changed then
    return new;
  end if;

  select link.user_id, link.project_id
    into v_link_user_id, v_link_project_id
    from public.project_share_links as link
    where link.id = new.share_link_id;

  if v_link_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_LINK_NOT_FOUND';
  end if;

  if v_link_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_OWNER_MISMATCH';
  end if;

  select task.user_id, task.project_id, task.deleted_at
    into v_task_user_id, v_task_project_id, v_task_deleted_at
    from public.tasks as task
    where task.id = new.subtask_id;

  if v_task_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_NOT_FOUND';
  end if;

  if v_task_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_NOT_OWNED';
  end if;

  if v_task_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_DELETED';
  end if;

  if v_task_project_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_WITHOUT_PROJECT';
  end if;

  if v_task_project_id <> v_link_project_id then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_PROJECT_MISMATCH';
  end if;

  return new;
end;
$$;

comment on function public.enforce_share_link_task_integrity() is
  'Rejects any share-link task mapping whose owner does not match the link''s owner, whose task is not owned by that same user, whose task has no project, whose task belongs to a different project than the link, or whose task is soft-deleted. Cross-account and same-owner-cross-project subtask ids are rejected with distinct stable codes.';

drop trigger if exists share_link_tasks_enforce_integrity
  on public.share_link_tasks;

create trigger share_link_tasks_enforce_integrity
before insert or update on public.share_link_tasks
for each row
execute function public.enforce_share_link_task_integrity();

-- =========================================================
-- 3. public.share_link_resources
--
-- public.task_resources rows may hang off a project directly, off a task,
-- or off both. All three cases must resolve to the SAME project as the
-- share link:
--   - a direct project Resource is allowed only when
--     resource.project_id equals link.project_id;
--   - a task Resource is allowed only when its task belongs to the same
--     owner AND that task's project_id equals link.project_id;
--   - when both project_id and task_id are populated they must not
--     contradict each other;
--   - a Resource with neither cannot be proven to belong to the link's
--     project at all and is rejected rather than assumed safe.
-- =========================================================

create or replace function public.enforce_share_link_resource_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_link_user_id uuid;
  v_link_project_id uuid;
  v_resource_user_id uuid;
  v_resource_project_id uuid;
  v_resource_task_id bigint;
  v_task_user_id uuid;
  v_task_project_id uuid;
  v_relationship_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_relationship_changed := true;
  else
    v_relationship_changed :=
      new.user_id is distinct from old.user_id
      or new.share_link_id is distinct from old.share_link_id
      or new.resource_id is distinct from old.resource_id;
  end if;

  if not v_relationship_changed then
    return new;
  end if;

  select link.user_id, link.project_id
    into v_link_user_id, v_link_project_id
    from public.project_share_links as link
    where link.id = new.share_link_id;

  if v_link_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_LINK_NOT_FOUND';
  end if;

  if v_link_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_OWNER_MISMATCH';
  end if;

  select resource.user_id, resource.project_id, resource.task_id
    into v_resource_user_id, v_resource_project_id, v_resource_task_id
    from public.task_resources as resource
    where resource.id = new.resource_id;

  if v_resource_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_NOT_FOUND';
  end if;

  if v_resource_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_NOT_OWNED';
  end if;

  if v_resource_project_id is null and v_resource_task_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_RELATIONSHIP_INVALID';
  end if;

  if v_resource_project_id is not null
    and v_resource_project_id <> v_link_project_id then
    raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_PROJECT_MISMATCH';
  end if;

  if v_resource_task_id is not null then
    select task.user_id, task.project_id
      into v_task_user_id, v_task_project_id
      from public.tasks as task
      where task.id = v_resource_task_id;

    if v_task_user_id is null then
      raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_RELATIONSHIP_INVALID';
    end if;

    if v_task_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_NOT_OWNED';
    end if;

    if v_task_project_id is null
      or v_task_project_id <> v_link_project_id then
      raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_TASK_PROJECT_MISMATCH';
    end if;

    if v_resource_project_id is not null
      and v_resource_project_id <> v_task_project_id then
      raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_RELATIONSHIP_INVALID';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_share_link_resource_integrity() is
  'Rejects any share-link Resource mapping whose owner does not match the link''s owner, whose Resource is not owned by that same user, whose Resource belongs to a different project than the link, whose task-attached Resource hangs off a task in a different project, whose project_id and task_id contradict each other, or which can be attributed to no project at all. Cross-account and same-owner-cross-project Resource ids are rejected.';

drop trigger if exists share_link_resources_enforce_integrity
  on public.share_link_resources;

create trigger share_link_resources_enforce_integrity
before insert or update on public.share_link_resources
for each row
execute function public.enforce_share_link_resource_integrity();

-- =========================================================
-- 4. public.share_link_updates
--
-- The owner must match the share link's owner, created_by must be that
-- same owner, and a published version is immutable
-- afterwards: only is_current may ever change. version > 0 is already a
-- CHECK constraint on the table and is deliberately not re-implemented
-- here -- a constraint is the right tool for a single-column invariant,
-- and duplicating it in a trigger would create two places to change it.
-- =========================================================

create or replace function public.enforce_share_link_update_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_link_user_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.share_link_id is distinct from old.share_link_id
      or new.user_id is distinct from old.user_id
      or new.body is distinct from old.body
      or new.version is distinct from old.version
      or new.published_at is distinct from old.published_at
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'SHARE_UPDATE_IMMUTABLE';
    end if;

    return new;
  end if;

  select link.user_id
    into v_link_user_id
    from public.project_share_links as link
    where link.id = new.share_link_id;

  if v_link_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_UPDATE_LINK_NOT_FOUND';
  end if;

  if v_link_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_UPDATE_OWNER_MISMATCH';
  end if;

  if new.created_by <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_UPDATE_CREATED_BY_MISMATCH';
  end if;

  return new;
end;
$$;

comment on function public.enforce_share_link_update_integrity() is
  'Rejects a published client-facing update whose owner does not match the share link''s owner or whose created_by is a different user, and makes a published version immutable afterwards -- only is_current may change, so the current-version pointer can move without ever rewriting published history.';

drop trigger if exists share_link_updates_enforce_integrity
  on public.share_link_updates;

create trigger share_link_updates_enforce_integrity
before insert or update on public.share_link_updates
for each row
execute function public.enforce_share_link_update_integrity();

-- =========================================================
-- 5. public.share_messages
--
-- The owner must match the share link's owner; the denormalised project_id
-- must match the link's project; a parent message must belong to the SAME
-- share link and the same owner; an owner-authored message must actually
-- be written by that authenticated owner; and a client-authored message
-- must be written through the service_role public path to an active,
-- unexpired, comments-enabled link on a live project. Browser-session and
-- per-link grant validation remains in the public server operation
-- because share_messages deliberately stores no browser-session id.
--
-- The message body, author identity and thread position are immutable
-- after insert: the original communication record must survive review and
-- conversion unchanged. Only the review/visibility lifecycle
-- (is_visible_to_client, status, reviewed_at, resolved_at, updated_at) may
-- change.
--
-- This function writes to nothing. It contains no insert, update or delete
-- against any table, and specifically none against
-- public.project_timeline_events, public.projects, public.tasks,
-- public.clients, public.task_resources or public.project_updates.
-- =========================================================

create or replace function public.enforce_share_message_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_link_user_id uuid;
  v_link_project_id uuid;
  v_link_state text;
  v_link_comments_enabled boolean;
  v_link_expires_at timestamptz;
  v_project_id uuid;
  v_project_deleted_at timestamptz;
  v_parent_share_link_id uuid;
  v_parent_user_id uuid;
  v_parent_is_visible_to_client boolean;
begin
  if tg_op = 'UPDATE' then
    if new.share_link_id is distinct from old.share_link_id
      or new.user_id is distinct from old.user_id
      or new.project_id is distinct from old.project_id
      or new.parent_id is distinct from old.parent_id
      or new.author_type is distinct from old.author_type
      or new.author_display_name is distinct from old.author_display_name
      or new.body is distinct from old.body
      or new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_IMMUTABLE';
    end if;

    return new;
  end if;

  select
      link.user_id,
      link.project_id,
      link.state,
      link.comments_enabled,
      link.expires_at,
      project.id,
      project.deleted_at
    into
      v_link_user_id,
      v_link_project_id,
      v_link_state,
      v_link_comments_enabled,
      v_link_expires_at,
      v_project_id,
      v_project_deleted_at
    from public.project_share_links as link
    left join public.projects as project
      on project.id = link.project_id
    where link.id = new.share_link_id;

  if v_link_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_LINK_NOT_FOUND';
  end if;

  if v_link_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_OWNER_MISMATCH';
  end if;

  if new.project_id <> v_link_project_id then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PROJECT_MISMATCH';
  end if;

  if new.author_type = 'owner' then
    if auth.uid() is distinct from new.user_id then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_OWNER_AUTHOR_NOT_AUTHENTICATED';
    end if;
  elsif new.author_type = 'client' then
    if current_role <> 'service_role' then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_AUTHOR_REQUIRES_SERVICE_ROLE';
    end if;

    if v_link_state <> 'active' then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_LINK_NOT_ACTIVE';
    end if;

    if not v_link_comments_enabled then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_COMMENTS_DISABLED';
    end if;

    if v_link_expires_at is not null and v_link_expires_at <= now() then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_LINK_EXPIRED';
    end if;

    if v_project_id is null then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_PROJECT_NOT_FOUND';
    end if;

    if v_project_deleted_at is not null then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_PROJECT_DELETED';
    end if;

    if new.status <> 'new' then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_STATUS_INVALID';
    end if;

    if new.reviewed_at is not null then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_REVIEWED_AT_FORBIDDEN';
    end if;

    if new.resolved_at is not null then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_RESOLVED_AT_FORBIDDEN';
    end if;

    if new.is_visible_to_client is not true then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_VISIBILITY_INVALID';
    end if;
  else
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_AUTHOR_TYPE_INVALID';
  end if;

  if new.parent_id is not null then
    select parent.share_link_id, parent.user_id, parent.is_visible_to_client
      into v_parent_share_link_id, v_parent_user_id, v_parent_is_visible_to_client
      from public.share_messages as parent
      where parent.id = new.parent_id;

    if v_parent_share_link_id is null then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PARENT_NOT_FOUND';
    end if;

    if v_parent_share_link_id <> new.share_link_id then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PARENT_LINK_MISMATCH';
    end if;

    if v_parent_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PARENT_OWNER_MISMATCH';
    end if;

    if new.author_type = 'client'
      and v_parent_is_visible_to_client is not true then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_PARENT_NOT_VISIBLE';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_share_message_integrity() is
  'Rejects a share message whose owner or project does not match its share link, whose parent belongs to a different link or owner, whose author_type = ''owner'' was not written by that authenticated owner, or whose author_type = ''client'' was not written through service_role as a fresh visible client message with no owner-review state on an active, unexpired, comments-enabled link whose project exists and is not soft-deleted. Client replies may reference only client-visible parent messages. Writes to no table: no CRM mutation and no public.project_timeline_events row is ever produced by a client comment or an owner reply.';

drop trigger if exists share_messages_enforce_integrity
  on public.share_messages;

create trigger share_messages_enforce_integrity
before insert or update on public.share_messages
for each row
execute function public.enforce_share_message_integrity();

-- =========================================================
-- 6. public.share_message_conversions
--
-- Traceability only, written after the fact. The converting actor must be
-- the authenticated owner of the message, and any referenced Client Update
-- or task must belong to that same owner AND to the same project as the
-- share link the message came from (the message's project_id is itself
-- enforced equal to the link's project by enforce_share_message_integrity
-- above, so comparing against it is equivalent to comparing against the
-- link and avoids a second lookup).
--
-- This function performs no conversion. It creates nothing, analyses
-- nothing and changes no project, task or status. Its trigger is INSERT
-- only: authenticated owners have no UPDATE grant or policy on conversion
-- rows, and FK-driven ON DELETE SET NULL cleanup of optional targets must
-- remain possible.
-- =========================================================

create or replace function public.enforce_share_message_conversion_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_message_user_id uuid;
  v_message_project_id uuid;
  v_message_author_type text;
  v_update_user_id uuid;
  v_update_project_id uuid;
  v_task_user_id uuid;
  v_task_project_id uuid;
begin
  select message.user_id, message.project_id, message.author_type
    into v_message_user_id, v_message_project_id, v_message_author_type
    from public.share_messages as message
    where message.id = new.message_id;

  if v_message_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_MESSAGE_NOT_FOUND';
  end if;

  if v_message_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_OWNER_MISMATCH';
  end if;

  if v_message_author_type <> 'client' then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_MESSAGE_NOT_CLIENT_AUTHORED';
  end if;

  if new.converted_by <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_ACTOR_MISMATCH';
  end if;

  if auth.uid() is distinct from new.converted_by then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_ACTOR_NOT_AUTHENTICATED';
  end if;

  if new.project_update_id is not null then
    select project_update.user_id, project_update.project_id
      into v_update_user_id, v_update_project_id
      from public.project_updates as project_update
      where project_update.id = new.project_update_id;

    if v_update_user_id is null then
      raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_NOT_FOUND';
    end if;

    if v_update_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_NOT_OWNED';
    end if;

    if v_update_project_id <> v_message_project_id then
      raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_PROJECT_MISMATCH';
    end if;
  end if;

  if new.target_task_id is not null then
    select task.user_id, task.project_id
      into v_task_user_id, v_task_project_id
      from public.tasks as task
      where task.id = new.target_task_id;

    if v_task_user_id is null then
      raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_TASK_NOT_FOUND';
    end if;

    if v_task_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_TASK_NOT_OWNED';
    end if;

    if v_task_project_id is null
      or v_task_project_id <> v_message_project_id then
      raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_TASK_PROJECT_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_share_message_conversion_integrity() is
  'Rejects a conversion record whose owner does not match the converted message, whose message was not client-authored, whose converted_by is anyone other than the authenticated owner, or whose referenced Client Update or task belongs to another owner or another project. Performs no conversion itself: nothing here analyses a message, creates a project update, creates a task, changes any message status, or changes any project/task status.';

drop trigger if exists share_message_conversions_enforce_integrity
  on public.share_message_conversions;

create trigger share_message_conversions_enforce_integrity
before insert on public.share_message_conversions
for each row
execute function public.enforce_share_message_conversion_integrity();

-- =========================================================
-- 7. public.share_browser_sessions
--
-- Browser-session identity is immutable after insertion. Public paths may
-- advance last_seen_at and may revoke a session, but they may never rotate
-- a digest in place, extend expiry, clear revocation or move lifecycle
-- timestamps backwards.
-- =========================================================

create or replace function public.enforce_share_browser_session_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if new.session_digest is distinct from old.session_digest then
      raise exception using errcode = 'P0001', message = 'SHARE_SESSION_DIGEST_IMMUTABLE';
    end if;

    if new.digest_version is distinct from old.digest_version then
      raise exception using errcode = 'P0001', message = 'SHARE_SESSION_DIGEST_VERSION_IMMUTABLE';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'SHARE_SESSION_CREATED_AT_IMMUTABLE';
    end if;

    if new.expires_at is distinct from old.expires_at then
      raise exception using errcode = 'P0001', message = 'SHARE_SESSION_EXPIRY_IMMUTABLE';
    end if;

    if new.last_seen_at is null
      or new.last_seen_at < old.last_seen_at then
      raise exception using errcode = 'P0001', message = 'SHARE_SESSION_LAST_SEEN_AT_DECREASE';
    end if;

    if old.revoked_at is not null
      and (
        new.revoked_at is null
        or new.revoked_at < old.revoked_at
      ) then
      raise exception using errcode = 'P0001', message = 'SHARE_SESSION_REVOCATION_IRREVERSIBLE';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_share_browser_session_integrity() is
  'Rejects browser-session identity or expiry changes after insert, keeps last_seen_at monotonic, and makes revocation irreversible. A revoked session can never become usable again by clearing or backdating revoked_at.';

drop trigger if exists share_browser_sessions_enforce_integrity
  on public.share_browser_sessions;

create trigger share_browser_sessions_enforce_integrity
before insert or update on public.share_browser_sessions
for each row
execute function public.enforce_share_browser_session_integrity();

-- =========================================================
-- 8. public.share_session_grants
--
-- A grant must reference an existing browser session and an existing share
-- link (foreign keys guarantee existence, but the session's own expiry has
-- to be read to compare against), a grant may never outlive the browser
-- session that owns it, and a revoked grant may never be un-revoked: it
-- stays auditable and can never be silently promoted back to active.
-- =========================================================

create or replace function public.enforce_share_session_grant_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_session_expires_at timestamptz;
  v_session_revoked_at timestamptz;
  v_link_state text;
  v_link_expires_at timestamptz;
  v_link_configuration_version integer;
  v_link_requires_pin boolean;
  v_project_id uuid;
  v_project_deleted_at timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.browser_session_id is distinct from old.browser_session_id then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_SESSION_IMMUTABLE';
    end if;

    if new.share_link_id is distinct from old.share_link_id then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_LINK_IMMUTABLE';
    end if;

    if new.granted_configuration_version is distinct from old.granted_configuration_version then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_CONFIGURATION_VERSION_IMMUTABLE';
    end if;

    if new.pin_verified_at is distinct from old.pin_verified_at then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_VERIFICATION_IMMUTABLE';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_CREATED_AT_IMMUTABLE';
    end if;

    if new.expires_at is distinct from old.expires_at then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_EXPIRY_IMMUTABLE';
    end if;

    if old.revoked_at is not null then
      if new.revoked_at is null then
        raise exception using errcode = 'P0001', message = 'SHARE_GRANT_REVOCATION_IRREVERSIBLE';
      end if;

      if new.revoked_at is distinct from old.revoked_at then
        raise exception using errcode = 'P0001', message = 'SHARE_GRANT_REVOCATION_IMMUTABLE';
      end if;
    end if;

    return new;
  end if;

  select browser_session.expires_at, browser_session.revoked_at
    into v_session_expires_at, v_session_revoked_at
    from public.share_browser_sessions as browser_session
    where browser_session.id = new.browser_session_id;

  if v_session_expires_at is null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_SESSION_NOT_FOUND';
  end if;

  if v_session_revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_SESSION_REVOKED';
  end if;

  if v_session_expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_SESSION_EXPIRED';
  end if;

  select
      link.state,
      link.expires_at,
      link.configuration_version,
      link.pin_hash is not null,
      project.id,
      project.deleted_at
    into
      v_link_state,
      v_link_expires_at,
      v_link_configuration_version,
      v_link_requires_pin,
      v_project_id,
      v_project_deleted_at
    from public.project_share_links as link
    left join public.projects as project
      on project.id = link.project_id
    where link.id = new.share_link_id;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_LINK_NOT_FOUND';
  end if;

  if v_project_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PROJECT_NOT_FOUND';
  end if;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PROJECT_DELETED';
  end if;

  if v_link_state <> 'active' then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_LINK_NOT_ACTIVE';
  end if;

  if v_link_expires_at is not null and v_link_expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_LINK_EXPIRED';
  end if;

  if new.granted_configuration_version <> v_link_configuration_version then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_CONFIGURATION_VERSION_STALE';
  end if;

  if new.expires_at > v_session_expires_at then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_EXPIRY_EXCEEDS_SESSION';
  end if;

  if v_link_expires_at is not null and new.expires_at > v_link_expires_at then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_EXPIRY_EXCEEDS_LINK';
  end if;

  if v_link_requires_pin and new.pin_verified_at is null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_VERIFICATION_REQUIRED';
  end if;

  if not v_link_requires_pin and new.pin_verified_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED';
  end if;

  return new;
end;
$$;

comment on function public.enforce_share_session_grant_integrity() is
  'On insert, rejects a per-link grant unless the browser session exists, is live and unrevoked; the share link exists, is active and unexpired; the linked project exists and is not deleted; the granted configuration version exactly matches the link; grant expiry fits within both session and link expiry; and PIN verification presence matches the link PIN requirement. On update, keeps grant identity, version, PIN verification, creation and expiry immutable and permits only initial revocation.';

drop trigger if exists share_session_grants_enforce_integrity
  on public.share_session_grants;

create trigger share_session_grants_enforce_integrity
before insert or update on public.share_session_grants
for each row
execute function public.enforce_share_session_grant_integrity();

-- =========================================================
-- 8. Function privilege hardening
--
-- These are trigger functions: PostgreSQL checks EXECUTE only when the
-- trigger is created, never when it fires, so revoking EXECUTE from every
-- caller role does not weaken enforcement -- it only removes the ability
-- to invoke them directly as ordinary functions. This mirrors
-- public.set_homepage_demo_updated_at()'s existing treatment in
-- 202606270002_homepage_demo_trials.sql:249-257.
--
-- Nothing here is granted to anon, authenticated or service_role. Any
-- future maintenance operation gets its own narrowly scoped function and
-- migration rather than speculative direct EXECUTE on these trigger
-- functions.
-- =========================================================

revoke all on function public.enforce_project_share_link_integrity()
  from public;
revoke all on function public.enforce_project_share_link_integrity()
  from anon;
revoke all on function public.enforce_project_share_link_integrity()
  from authenticated;
revoke all on function public.enforce_project_share_link_integrity()
  from service_role;

revoke all on function public.enforce_share_link_task_integrity()
  from public;
revoke all on function public.enforce_share_link_task_integrity()
  from anon;
revoke all on function public.enforce_share_link_task_integrity()
  from authenticated;
revoke all on function public.enforce_share_link_task_integrity()
  from service_role;

revoke all on function public.enforce_share_link_resource_integrity()
  from public;
revoke all on function public.enforce_share_link_resource_integrity()
  from anon;
revoke all on function public.enforce_share_link_resource_integrity()
  from authenticated;
revoke all on function public.enforce_share_link_resource_integrity()
  from service_role;

revoke all on function public.enforce_share_link_update_integrity()
  from public;
revoke all on function public.enforce_share_link_update_integrity()
  from anon;
revoke all on function public.enforce_share_link_update_integrity()
  from authenticated;
revoke all on function public.enforce_share_link_update_integrity()
  from service_role;

revoke all on function public.enforce_share_message_integrity()
  from public;
revoke all on function public.enforce_share_message_integrity()
  from anon;
revoke all on function public.enforce_share_message_integrity()
  from authenticated;
revoke all on function public.enforce_share_message_integrity()
  from service_role;

revoke all on function public.enforce_share_message_conversion_integrity()
  from public;
revoke all on function public.enforce_share_message_conversion_integrity()
  from anon;
revoke all on function public.enforce_share_message_conversion_integrity()
  from authenticated;
revoke all on function public.enforce_share_message_conversion_integrity()
  from service_role;

revoke all on function public.enforce_share_browser_session_integrity()
  from public;
revoke all on function public.enforce_share_browser_session_integrity()
  from anon;
revoke all on function public.enforce_share_browser_session_integrity()
  from authenticated;
revoke all on function public.enforce_share_browser_session_integrity()
  from service_role;

revoke all on function public.enforce_share_session_grant_integrity()
  from public;
revoke all on function public.enforce_share_session_grant_integrity()
  from anon;
revoke all on function public.enforce_share_session_grant_integrity()
  from authenticated;
revoke all on function public.enforce_share_session_grant_integrity()
  from service_role;

-- =========================================================
-- 9. Final table grants -- after every integrity trigger exists
--
-- Migrations 003 and 004 leave every new table revoked from every role.
-- Only now, after every cross-table integrity trigger above has been
-- created, does the feature become readable through authenticated owner
-- RLS and reachable through column-minimal service-role public paths.
-- The revokes are repeated here so this final activation section is
-- self-auditing and idempotently narrows any accidental prior broad grant.
-- Nothing is granted to anon or public. Authenticated users receive no
-- direct INSERT, UPDATE or DELETE table privilege in Phase 1A: every
-- future owner mutation that affects product invariants must go through a
-- transactional Phase 1B owner operation that locks project_share_links,
-- performs the mutation and increments configuration_version exactly once.
-- =========================================================

revoke all on table public.project_share_links from public;
revoke all on table public.project_share_links from anon;
revoke all on table public.project_share_links from authenticated;
revoke all privileges on table public.project_share_links from service_role;

revoke all on table public.share_link_tasks from public;
revoke all on table public.share_link_tasks from anon;
revoke all on table public.share_link_tasks from authenticated;
revoke all privileges on table public.share_link_tasks from service_role;

revoke all on table public.share_link_resources from public;
revoke all on table public.share_link_resources from anon;
revoke all on table public.share_link_resources from authenticated;
revoke all privileges on table public.share_link_resources from service_role;

revoke all on table public.share_link_updates from public;
revoke all on table public.share_link_updates from anon;
revoke all on table public.share_link_updates from authenticated;
revoke all privileges on table public.share_link_updates from service_role;

revoke all on table public.share_messages from public;
revoke all on table public.share_messages from anon;
revoke all on table public.share_messages from authenticated;
revoke all privileges on table public.share_messages from service_role;

revoke all on table public.share_message_conversions from public;
revoke all on table public.share_message_conversions from anon;
revoke all on table public.share_message_conversions from authenticated;
revoke all privileges
  on table public.share_message_conversions
  from service_role;

revoke all on table public.share_browser_sessions from public;
revoke all on table public.share_browser_sessions from anon;
revoke all on table public.share_browser_sessions from authenticated;
revoke all privileges
  on table public.share_browser_sessions
  from service_role;

revoke all on table public.share_session_grants from public;
revoke all on table public.share_session_grants from anon;
revoke all on table public.share_session_grants from authenticated;
revoke all privileges
  on table public.share_session_grants
  from service_role;

revoke all on table public.share_link_events from public;
revoke all on table public.share_link_events from anon;
revoke all on table public.share_link_events from authenticated;
revoke all privileges
  on table public.share_link_events
  from service_role;

revoke all on table public.share_rate_limit_buckets from public;
revoke all on table public.share_rate_limit_buckets from anon;
revoke all on table public.share_rate_limit_buckets from authenticated;
revoke all privileges
  on table public.share_rate_limit_buckets
  from service_role;

grant select on table public.project_share_links
  to authenticated;
grant select on table public.share_link_tasks
  to authenticated;
grant select on table public.share_link_resources
  to authenticated;
grant select on table public.share_link_updates
  to authenticated;
grant select on table public.share_messages
  to authenticated;
grant select on table public.share_message_conversions
  to authenticated;

grant select on table public.project_share_links
  to service_role;
grant update (view_count, last_viewed_at)
  on table public.project_share_links
  to service_role;
grant select on table public.share_link_tasks
  to service_role;
grant select on table public.share_link_resources
  to service_role;
grant select on table public.share_link_updates
  to service_role;
grant select on table public.share_messages
  to service_role;
grant insert (
  user_id,
  share_link_id,
  project_id,
  author_type,
  author_display_name,
  body,
  parent_id,
  is_visible_to_client
)
  on table public.share_messages
  to service_role;

grant select, insert, update, delete on table public.share_browser_sessions
  to service_role;
grant select, insert, update, delete on table public.share_session_grants
  to service_role;
grant select, insert, delete on table public.share_link_events
  to service_role;
grant select, insert, update, delete on table public.share_rate_limit_buckets
  to service_role;
