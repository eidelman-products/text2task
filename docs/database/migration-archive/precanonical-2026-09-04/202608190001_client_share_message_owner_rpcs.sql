-- Text2Task Client Share Link -- Phase 5A: owner-write RPCs for
-- public.share_messages
--
-- Two narrow, single-purpose SECURITY DEFINER functions, matching this
-- feature's own established owner-mutation convention exactly (see
-- 202608060001_client_share_lifecycle_operations.sql and
-- 202608060002_client_share_access_operations.sql's
-- set_share_link_pin/clear_share_link_pin/set_share_link_expiry/
-- clear_share_link_expiry/rotate_share_link_secret/revoke_share_link/
-- reveal_share_link_secret) -- NOT a broad authenticated INSERT/UPDATE
-- grant on share_messages, which 202608030003's own migration comment
-- already stated was deliberately withheld pending exactly this kind of
-- narrow RPC.
--
-- Both functions:
--   - are SECURITY DEFINER, plpgsql, with an explicit locked
--     search_path (set search_path = public, pg_temp), matching every
--     sibling owner-mutation RPC in this feature exactly.
--   - obtain and null-check auth.uid() internally (UNAUTHORIZED if
--     null) -- never accept a p_user_id parameter.
--   - are owner-scoped: every row read/written is additionally
--     filtered by the resolved owner's own auth.uid(), never trusted
--     from a client-supplied id alone.
--   - fail closed: a nonexistent, other-owner, or (for the reply RPC)
--     deleted-project target returns the same generic not-found
--     message a real one would have to a different owner, matching
--     this feature's existing no-enumeration-oracle posture on every
--     sibling RPC.
--   - never depend on service_role -- these are owner-authenticated
--     actions only, executed through the RLS-bound authenticated
--     client, exactly like every sibling RPC.
--   - grant EXECUTE to `authenticated` only; revoked from public, anon
--     and service_role.
--   - write to no table other than public.share_messages. Neither
--     function references public.share_message_conversions,
--     public.project_updates, public.project_timeline_events,
--     public.tasks, public.projects (beyond a read), or any CRM table.
--     public.share_message_conversions remains exactly as delivered in
--     202608030003 -- untouched, Phase 6-only.
--   - never accept or write status = 'converted'. That value exists in
--     share_messages_status_check (202608030003) for Phase 6's own
--     future conversion-marking use; Phase 5 code (this migration
--     included) has no path to it at all.
--
-- The existing enforce_share_message_integrity trigger
-- (202608030005) remains the unconditional second line of defense
-- under every insert/update either function performs -- both
-- functions' own checks below are fail-fast/defense-in-depth on top of
-- it, not a replacement for it, matching this feature's established
-- two-layer posture (application/RPC check, then trigger) exactly.

-- =========================================================
-- 1. public.send_share_message_reply
--
-- Owner-authored reply to an existing message on one of the owner's own
-- share links. The parent message must already exist, belong to the
-- same owner, and belong to the SAME share link supplied -- this is
-- deliberately re-verified here even though
-- enforce_share_message_integrity re-checks it again at insert time,
-- exactly like every sibling RPC re-verifies what its own trigger will
-- also re-check.
-- =========================================================

create or replace function public.send_share_message_reply(
  p_share_link_id uuid,
  p_parent_message_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_link_user_id uuid;
  v_link_project_id uuid;
  v_project_deleted_at timestamptz;
  v_parent_share_link_id uuid;
  v_parent_user_id uuid;
  v_trimmed_body text;
  v_new_id uuid;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_share_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select link.user_id, link.project_id
    into v_link_user_id, v_link_project_id
    from public.project_share_links as link
    where link.id = p_share_link_id and link.user_id = v_user_id;

  if v_link_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_link_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if p_parent_message_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PARENT_NOT_FOUND';
  end if;

  select message.share_link_id, message.user_id
    into v_parent_share_link_id, v_parent_user_id
    from public.share_messages as message
    where message.id = p_parent_message_id
      and message.user_id = v_user_id;

  if v_parent_share_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PARENT_NOT_FOUND';
  end if;

  if v_parent_share_link_id <> p_share_link_id then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PARENT_LINK_MISMATCH';
  end if;

  -- Mirrors share_messages_body_check exactly (btrim length 1-4000) so
  -- an invalid body is rejected here, fail-fast, before the insert ever
  -- reaches that constraint.
  v_trimmed_body := btrim(coalesce(p_body, ''));

  if char_length(v_trimmed_body) < 1 then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_BODY_EMPTY';
  end if;

  if char_length(p_body) > 4000 then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_BODY_TOO_LONG';
  end if;

  -- author_type is always 'owner' and is_visible_to_client is always
  -- true -- neither is a caller-supplied parameter, so an owner reply
  -- can never be inserted any other way through this function.
  -- status='reviewed'/reviewed_at=now(): the owner's own reply does not
  -- need further owner review (they just wrote it), so 'new' would
  -- misrepresent it; share_messages_unread_client_idx only ever counts
  -- author_type='client' rows regardless, so this choice has no effect
  -- on the unread counter either way.
  insert into public.share_messages (
    user_id, share_link_id, project_id,
    author_type, author_display_name, body, parent_id,
    is_visible_to_client, status, reviewed_at
  ) values (
    v_user_id, p_share_link_id, v_link_project_id,
    'owner', null, p_body, p_parent_message_id,
    true, 'reviewed', v_now
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'messageId', v_new_id,
    'shareLinkId', p_share_link_id,
    'parentId', p_parent_message_id,
    'authorType', 'owner',
    'createdAt', v_now
  );
end;
$$;

comment on function public.send_share_message_reply(uuid, uuid, text) is
  'Phase 5A: inserts one owner-authored reply to an existing, owned parent message on the owner''s own share link. SECURITY DEFINER; obtains and null-checks auth.uid() internally; owner-scoped on every read; project soft-delete checked. author_type is always ''owner'', is_visible_to_client is always true, status is always ''reviewed'' -- none are caller-supplied. Writes exactly one public.share_messages row and nothing else: no project_updates, no project_timeline_events, no task/project/CRM mutation, no share_message_conversions row (Phase 6-only, untouched). The existing enforce_share_message_integrity trigger independently re-verifies every invariant this function also checks.';

revoke all on function public.send_share_message_reply(uuid, uuid, text) from public;
revoke all on function public.send_share_message_reply(uuid, uuid, text) from anon;
revoke all on function public.send_share_message_reply(uuid, uuid, text) from service_role;
grant execute on function public.send_share_message_reply(uuid, uuid, text) to authenticated;

-- =========================================================
-- 2. public.set_share_message_status
--
-- Owner-only workflow-state transition for one of the owner's own
-- messages (either author_type -- status is documented as "Owner-side
-- review state only", not specific to which side authored the row).
-- Never accepts 'converted' -- that value is reserved exclusively for
-- Phase 6's own future conversion-marking code, which does not exist
-- yet and is not created by this migration.
--
-- Timestamp semantics, chosen to satisfy share_messages_status_timestamps_check
-- in every case ((reviewed_at is null or reviewed_at >= created_at) and
-- (resolved_at is null or resolved_at >= created_at) and (status = 'new'
-- or reviewed_at is not null) and (status <> 'resolved' or resolved_at
-- is not null)):
--   new       -> reviewed_at = null,                       resolved_at = null
--   reviewed  -> reviewed_at = now(),                       resolved_at = null
--   resolved  -> reviewed_at = existing value or now(),     resolved_at = now()
--   dismissed -> reviewed_at = now(),                       resolved_at = null
-- =========================================================

create or replace function public.set_share_message_status(
  p_message_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_message_user_id uuid;
  v_message_project_id uuid;
  v_project_deleted_at timestamptz;
  v_existing_reviewed_at timestamptz;
  v_reviewed_at timestamptz;
  v_resolved_at timestamptz;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  -- Phase 5 target statuses only. 'converted' is deliberately absent --
  -- Phase 6 owns that transition, through its own future code, not this
  -- function.
  if p_status is null or p_status not in ('new', 'reviewed', 'resolved', 'dismissed') then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_STATUS_INVALID';
  end if;

  if p_message_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_NOT_FOUND';
  end if;

  select message.user_id, message.project_id, message.reviewed_at
    into v_message_user_id, v_message_project_id, v_existing_reviewed_at
    from public.share_messages as message
    where message.id = p_message_id and message.user_id = v_user_id
    for update;

  if v_message_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_message_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_NOT_FOUND';
  end if;

  if p_status = 'new' then
    v_reviewed_at := null;
    v_resolved_at := null;
  elsif p_status = 'reviewed' then
    v_reviewed_at := v_now;
    v_resolved_at := null;
  elsif p_status = 'resolved' then
    v_reviewed_at := coalesce(v_existing_reviewed_at, v_now);
    v_resolved_at := v_now;
  else
    -- dismissed
    v_reviewed_at := v_now;
    v_resolved_at := null;
  end if;

  -- Only the review/visibility lifecycle columns are ever touched here
  -- (status, reviewed_at, resolved_at) -- body, author_type,
  -- author_display_name, parent_id, share_link_id, project_id, user_id
  -- and created_at are never referenced on the left-hand side of this
  -- UPDATE at all, matching enforce_share_message_integrity's own
  -- UPDATE-immutability check exactly (that trigger independently
  -- re-verifies this too).
  update public.share_messages
    set
      status = p_status,
      reviewed_at = v_reviewed_at,
      resolved_at = v_resolved_at
    where id = p_message_id and user_id = v_user_id;

  return jsonb_build_object(
    'messageId', p_message_id,
    'status', p_status,
    'reviewedAt', v_reviewed_at,
    'resolvedAt', v_resolved_at
  );
end;
$$;

comment on function public.set_share_message_status(uuid, text) is
  'Phase 5A: owner-only workflow-state transition (new/reviewed/resolved/dismissed only -- converted is exclusively Phase 6''s, never accepted here) for one owned message. SECURITY DEFINER; obtains and null-checks auth.uid() internally; owner-scoped; project soft-delete checked; row locked FOR UPDATE. Updates only status/reviewed_at/resolved_at -- never body, author_type, author_display_name, parent_id, share_link_id, project_id, user_id or created_at. Writes to no other table.';

revoke all on function public.set_share_message_status(uuid, text) from public;
revoke all on function public.set_share_message_status(uuid, text) from anon;
revoke all on function public.set_share_message_status(uuid, text) from service_role;
grant execute on function public.set_share_message_status(uuid, text) to authenticated;
