-- Text2Task Work Calendar -- Manual Events
-- Migration: 202607290001_calendar_events.sql
-- Created: 2026-07-29
--
-- Purpose:
-- Foundation for the Work Calendar feature (see
-- docs/TEXT2TASK_WORK_CALENDAR_MAPPING.md). Adds exactly one new table,
-- calendar_events, for user-created "manual events" only.
--
-- Project deadlines are NOT stored here and are NEVER copied into this
-- table. They remain authoritative in projects.deadline_date and are
-- projected into the Calendar read model at query time by application
-- code (lib/calendar/load-calendar-range.server.ts). This migration does
-- not touch projects.deadline_date, projects.status, or any other
-- project/task/client column -- the only project-table change here is an
-- additive index (see the bottom of this file), never a column or data
-- change.
--
-- Relationship-integrity rule (locked, enforced identically here and in
-- lib/calendar/calendar-link-validation.server.ts):
-- when project_id is supplied AND the relationship is actually changing
-- (an insert, or an update that changes project_id/client_id), client_id
-- is always normalized to that project's current client_id (or null if the
-- project has none), regardless of what client_id was supplied in the same
-- write. This is a silent normalization, not a rejection. An update that
-- does not touch project_id/client_id never re-derives or re-validates the
-- relationship at all -- a project's client changing later must never
-- silently rewrite a historical event during an unrelated edit. See
-- enforce_calendar_event_relationship_integrity below, which is the
-- single source of truth for this rule at the database layer.
--
-- RLS on calendar_events.user_id alone cannot express "the project/client
-- this event links to belongs to the same user" -- that is a cross-table
-- concern RLS structurally cannot enforce for this table (the repo's own
-- convention never has RLS policies join to a parent table, confirmed
-- across every existing RLS-bearing table). This migration therefore adds
-- a dedicated trigger-based ownership check as the database-level
-- backstop, in addition to (never instead of) explicit server-side
-- validation.

-- =========================================================
-- 1. calendar_events
-- =========================================================

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  event_date date not null,
  event_time time without time zone null,
  notes text null,

  project_id uuid null references public.projects(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint calendar_events_title_check
    check (char_length(trim(title)) >= 1 and char_length(title) <= 240),

  -- The application contract for event_time is strict minute-precision
  -- HH:MM (lib/calendar/time-only.ts) -- this enforces that at the database
  -- layer too: null (all-day) is allowed, otherwise the seconds component
  -- (including any fractional part) must be exactly zero. extract(second
  -- from event_time) returns the fractional seconds too, so this rejects
  -- both a nonzero whole-second value and a nonzero fractional one.
  constraint calendar_events_event_time_minute_precision_check
    check (event_time is null or extract(second from event_time) = 0)
);

comment on table public.calendar_events is
  'Manual Work Calendar events created directly by a user. Project deadlines are never stored here -- they remain authoritative in projects.deadline_date and are merged in at query time.';

comment on column public.calendar_events.event_time is
  'Nullable. Null means an all-day event. Canonical application value is a strict HH:MM 24-hour string (see lib/calendar/time-only.ts) -- never a Date object, never UTC-converted. calendar_events_event_time_minute_precision_check enforces zero seconds at the database layer.';

comment on column public.calendar_events.client_id is
  'Kept consistent with project_id by enforce_calendar_event_relationship_integrity below, but only when the relationship itself changes (insert, or project_id/client_id actually differ from the current row): when project_id is set on such a change, client_id is normalized to that project''s current client_id, never independently supplied. An update that does not touch project_id/client_id leaves an existing client_id exactly as-is, even if the linked project''s own client has since changed.';

-- =========================================================
-- 2. Indexes
--
-- The user_id/event_date composite is the primary month-range query
-- shape (lib/calendar/load-calendar-range.server.ts). project_id/client_id
-- are standard partial FK-column indexes. All three exclude soft-deleted
-- rows, since every real query does too.
-- =========================================================

create index if not exists calendar_events_user_id_event_date_idx
  on public.calendar_events(user_id, event_date)
  where deleted_at is null;

create index if not exists calendar_events_project_id_idx
  on public.calendar_events(project_id)
  where project_id is not null and deleted_at is null;

create index if not exists calendar_events_client_id_idx
  on public.calendar_events(client_id)
  where client_id is not null and deleted_at is null;

-- =========================================================
-- 3. updated_at trigger
-- =========================================================

create or replace function public.set_calendar_events_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendar_events_set_updated_at
  on public.calendar_events;

create trigger calendar_events_set_updated_at
before update on public.calendar_events
for each row
execute function public.set_calendar_events_updated_at();

-- =========================================================
-- 4. Relationship integrity enforcement (database-level backstop)
--
-- Only runs its validation/normalization when the relationship itself is
-- actually changing: on INSERT, or when project_id or client_id differs
-- from the row's current persisted value. An update that touches only
-- title/event_date/event_time/notes (or a soft-delete, which only sets
-- deleted_at) leaves project_id/client_id completely untouched, preserving
-- the event's existing client_id exactly even if the linked project's own
-- client has changed since -- a later change to a project's client must
-- never silently rewrite a historical event's relationship. This is not
-- merely an optimization: unconditionally re-deriving client_id on every
-- update (the original version of this function) would silently rewrite
-- an event's client link on a completely unrelated edit, which is exactly
-- the hidden cross-entity synchronization this feature must not have.
--
-- Safe no-op when project_id and client_id are both null. Never modifies
-- user_id. Runs security invoker (matching every other function in this
-- repository that touches projects/tasks/clients) so ownership is checked
-- explicitly via user_id comparison rather than relied upon implicitly --
-- this works correctly whether or not RLS is also active on
-- projects/clients.
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
  end if;

  return new;
end;
$$;

drop trigger if exists calendar_events_enforce_relationship_integrity
  on public.calendar_events;

create trigger calendar_events_enforce_relationship_integrity
before insert or update on public.calendar_events
for each row
execute function public.enforce_calendar_event_relationship_integrity();

-- =========================================================
-- 5. Row Level Security
--
-- Exactly the repository's established 4-policy-per-table shape: one
-- policy per operation, single-column ownership check, never a join. This
-- protects the calendar_events row itself; it is not sufficient on its
-- own to protect linked project_id/client_id ownership -- see section 4
-- above and lib/calendar/calendar-link-validation.server.ts for that.
-- =========================================================

alter table public.calendar_events enable row level security;

drop policy if exists "Users can view own calendar events"
  on public.calendar_events;

create policy "Users can view own calendar events"
  on public.calendar_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own calendar events"
  on public.calendar_events;

create policy "Users can insert own calendar events"
  on public.calendar_events
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own calendar events"
  on public.calendar_events;

create policy "Users can update own calendar events"
  on public.calendar_events
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own calendar events"
  on public.calendar_events;

create policy "Users can delete own calendar events"
  on public.calendar_events
  for delete
  using (auth.uid() = user_id);

-- =========================================================
-- 6. Supporting index on projects for the Calendar's month-range query
--
-- No tracked migration creates projects.deadline_date, so no equivalent
-- index could be confirmed present or absent from tracked history alone
-- (see docs/TEXT2TASK_WORK_CALENDAR_MAPPING.md section 7 / section 19).
-- `create index if not exists` is safe to run either way: a no-op if an
-- identically-named index already exists, and merely additional (never
-- incorrect) if a differently-named equivalent already exists in the
-- untracked base schema. This does not alter any projects column or row.
-- =========================================================

create index if not exists projects_user_id_deadline_date_idx
  on public.projects(user_id, deadline_date)
  where deleted_at is null;
