-- Text2Task Work Calendar -- custom Project/Client names on Manual Events
-- Migration: 202607310001_calendar_events_custom_names.sql
-- Created: 2026-07-31
--
-- Purpose:
-- A Manual Event's Project/Client may refer to an entity that does not
-- (yet) exist in Text2Task as a real projects/clients row. Adds two
-- nullable text columns to public.calendar_events so a user can enter a
-- free-text Project/Client name instead of linking an existing row --
-- never both at once for the same relationship, and never stored in
-- notes or by fabricating a fake projects/clients row.
--
-- This migration adds columns + constraints to the existing
-- calendar_events table (created in 202607290001_calendar_events.sql), and
-- redefines that same migration's enforce_calendar_event_relationship_integrity()
-- trigger function (via create or replace function, not a second trigger)
-- so it also normalizes the two new custom-name columns. It does not touch
-- project_id/client_id's own FK/index/RLS definitions, and does not touch
-- projects/clients themselves.
--
-- Mutual-exclusivity is enforced here at the database layer (CHECK
-- constraints, which REJECT a contradictory write) as the backstop for the
-- application layer's own guarantee (lib/calendar/calendar-link-validation.server.ts,
-- updated alongside this migration) that a request is never assembled with
-- both an id and a custom name for the same relationship in the first
-- place -- matching this feature's existing "enforced twice" convention
-- for project/client relationship rules.

alter table public.calendar_events
  add column if not exists custom_project_name text null,
  add column if not exists custom_client_name text null;

comment on column public.calendar_events.custom_project_name is
  'Free-text Project name for an event whose Project does not exist as a real projects row. Always null when project_id is set (calendar_events_project_exclusivity_check) -- see calendar-link-validation.server.ts for the single source of truth on how these two are kept mutually exclusive.';

comment on column public.calendar_events.custom_client_name is
  'Free-text Client name for an event whose Client does not exist as a real clients row. Always null when client_id is set (calendar_events_client_exclusivity_check), and always null whenever project_id is set (a linked project''s own client always wins, exactly as client_id already does) -- see calendar-link-validation.server.ts.';

-- =========================================================
-- Mutual-exclusivity + length/blank constraints
--
-- Length mirrors calendar_events_title_check's own 240-character limit
-- (lib/calendar/calendar-schemas.ts's CUSTOM_ENTITY_NAME_MAX_LENGTH is the
-- single JS-side source of truth for this same number -- this check is the
-- database-level mirror of that constant, not a second independent limit).
-- A non-null value must also be non-blank once trimmed: the application
-- layer already normalizes a blank/whitespace-only custom name to `null`
-- before it ever reaches a write, so an empty-but-non-null value here would
-- indicate a real bug upstream, not a valid "no custom name" state.
-- =========================================================

alter table public.calendar_events
  add constraint calendar_events_project_exclusivity_check
    check (project_id is null or custom_project_name is null);

alter table public.calendar_events
  add constraint calendar_events_client_exclusivity_check
    check (client_id is null or custom_client_name is null);

alter table public.calendar_events
  add constraint calendar_events_custom_project_name_check
    check (
      custom_project_name is null
      or (char_length(trim(custom_project_name)) >= 1 and char_length(custom_project_name) <= 240)
    );

alter table public.calendar_events
  add constraint calendar_events_custom_client_name_check
    check (
      custom_client_name is null
      or (char_length(trim(custom_client_name)) >= 1 and char_length(custom_client_name) <= 240)
    );

-- =========================================================
-- Relationship-integrity trigger update
--
-- enforce_calendar_event_relationship_integrity (202607290001) already
-- forces client_id to a linked project's own client_id whenever the
-- relationship changes. This redefinition adds the two custom-name columns
-- to that exact same normalization, under the exact same
-- `v_relationship_changed` guard (only re-derived when project_id/client_id
-- actually changes on this write -- an unrelated field-only update leaves
-- both custom names exactly as they were, matching the surrounding
-- function's own established behavior): when a project is linked,
-- custom_project_name and custom_client_name are both forced to null
-- (a linked project's client is always derived, never custom); the CHECK
-- constraints above are the hard backstop if this ever somehow disagreed.
-- =========================================================

create or replace function public.enforce_calendar_event_relationship_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_project_user_id uuid;
  v_project_client_id uuid;
  v_project_deleted_at timestamptz;
  v_client_user_id uuid;
  v_relationship_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_relationship_changed := true;
  else
    v_relationship_changed :=
      new.project_id is distinct from old.project_id
      or new.client_id is distinct from old.client_id;
  end if;

  if not v_relationship_changed then
    return new;
  end if;

  if new.project_id is not null then
    select project.user_id, project.client_id, project.deleted_at
      into v_project_user_id, v_project_client_id, v_project_deleted_at
      from public.projects as project
      where project.id = new.project_id;

    if v_project_user_id is null then
      raise exception using errcode = 'P0001', message = 'CALENDAR_EVENT_PROJECT_NOT_FOUND';
    end if;

    if v_project_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'CALENDAR_EVENT_PROJECT_NOT_OWNED';
    end if;

    if v_project_deleted_at is not null then
      raise exception using errcode = 'P0001', message = 'CALENDAR_EVENT_PROJECT_DELETED';
    end if;

    -- Locked normalization rule: a linked project's client always wins.
    new.client_id := v_project_client_id;
    -- A linked project/client is never paired with a custom name.
    new.custom_project_name := null;
    new.custom_client_name := null;
  end if;

  if new.client_id is not null then
    select client.user_id
      into v_client_user_id
      from public.clients as client
      where client.id = new.client_id;

    if v_client_user_id is null then
      raise exception using errcode = 'P0001', message = 'CALENDAR_EVENT_CLIENT_NOT_FOUND';
    end if;

    if v_client_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'CALENDAR_EVENT_CLIENT_NOT_OWNED';
    end if;

    new.custom_client_name := null;
  end if;

  return new;
end;
$$;
