-- Text2Task Project Update Engine / Client Updates
-- Migration: 202605250001_project_update_engine.sql
-- Created: 2026-05-25
--
-- Purpose:
-- When an existing client sends a follow-up message, Text2Task should not
-- create a new project by mistake. Instead, it should analyze the message
-- against the existing project, create a Suggested Update Plan, let the user
-- approve/reject each item, apply approved changes, and keep a full audit trail.
--
-- Core tables:
-- 1. project_updates
-- 2. project_update_items
-- 3. project_timeline_events

create extension if not exists "pgcrypto";

-- =========================================================
-- 1. project_updates
-- One client update message connected to an existing project.
-- Stores the original message, AI analysis metadata, review/apply lifecycle,
-- and actor timestamps.
-- =========================================================

create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid null references public.clients(id) on delete set null,

  source_type text not null default 'text',
  raw_input text not null,

  ai_summary jsonb null,
  status text not null default 'draft',

  created_by uuid null references auth.users(id) on delete set null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  applied_by uuid null references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  analyzed_at timestamptz null,
  reviewed_at timestamptz null,
  applied_at timestamptz null,
  ignored_at timestamptz null,

  constraint project_updates_source_type_check
    check (source_type in ('text', 'image', 'email', 'manual')),

  constraint project_updates_status_check
    check (status in ('draft', 'analyzed', 'reviewed', 'applied', 'ignored', 'failed'))
);

create index if not exists project_updates_user_id_idx
  on public.project_updates(user_id);

create index if not exists project_updates_project_id_idx
  on public.project_updates(project_id);

create index if not exists project_updates_client_id_idx
  on public.project_updates(client_id);

create index if not exists project_updates_status_idx
  on public.project_updates(status);

create index if not exists project_updates_created_at_idx
  on public.project_updates(created_at desc);


-- =========================================================
-- 2. project_update_items
-- Each AI-suggested change inside a client update.
--
-- Examples:
-- - Add a new subtask
-- - Update an existing subtask
-- - Change deadline
-- - Change budget
-- - Change priority/status
-- - Update client details
-- - Add project/client note
-- - Warn about duplicate/no-action
--
-- Stores old_value/new_value so the user has proof of what changed.
-- =========================================================

create table if not exists public.project_update_items (
  id uuid primary key default gen_random_uuid(),

  project_update_id uuid not null references public.project_updates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  target_task_id bigint null references public.tasks(id) on delete set null,

  type text not null,
  title text not null,
  description text null,

  target_field text null,
  old_value jsonb null,
  new_value jsonb null,

  confidence numeric(5, 4) null,
  status text not null default 'suggested',

  ai_reason text null,
  user_note text null,

  created_at timestamptz not null default now(),
  accepted_at timestamptz null,
  rejected_at timestamptz null,
  applied_at timestamptz null,

  accepted_by uuid null references auth.users(id) on delete set null,
  rejected_by uuid null references auth.users(id) on delete set null,
  applied_by uuid null references auth.users(id) on delete set null,

  constraint project_update_items_type_check
    check (
      type in (
        'new_subtask',
        'update_subtask',
        'deadline_change',
        'budget_change',
        'priority_change',
        'status_change',
        'client_detail_change',
        'project_note',
        'client_note',
        'duplicate_warning',
        'no_action'
      )
    ),

  constraint project_update_items_status_check
    check (
      status in (
        'suggested',
        'accepted',
        'rejected',
        'applied',
        'skipped',
        'failed'
      )
    ),

  constraint project_update_items_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists project_update_items_update_id_idx
  on public.project_update_items(project_update_id);

create index if not exists project_update_items_user_id_idx
  on public.project_update_items(user_id);

create index if not exists project_update_items_project_id_idx
  on public.project_update_items(project_id);

create index if not exists project_update_items_target_task_id_idx
  on public.project_update_items(target_task_id);

create index if not exists project_update_items_status_idx
  on public.project_update_items(status);

create index if not exists project_update_items_type_idx
  on public.project_update_items(type);

create index if not exists project_update_items_created_at_idx
  on public.project_update_items(created_at desc);


-- =========================================================
-- 3. project_timeline_events
-- User-readable timeline / audit feed inside a project.
--
-- This table is intentionally broader than AI updates.
-- Later it can also store manual edits, resource changes, archive/restore,
-- status changes, and other project history events.
-- =========================================================

create table if not exists public.project_timeline_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  event_type text not null,
  event_title text not null,
  event_summary text null,

  source_update_id uuid null references public.project_updates(id) on delete set null,
  source_item_id uuid null references public.project_update_items(id) on delete set null,
  target_task_id bigint null references public.tasks(id) on delete set null,

  target_field text null,
  old_value jsonb null,
  new_value jsonb null,

  actor_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  metadata jsonb null,

  constraint project_timeline_events_event_type_check
    check (
      event_type in (
        'client_update_received',
        'ai_update_analyzed',
        'update_item_accepted',
        'update_item_rejected',
        'update_applied',
        'subtask_added',
        'subtask_updated',
        'deadline_updated',
        'budget_updated',
        'priority_updated',
        'status_updated',
        'client_details_updated',
        'note_added',
        'resource_added',
        'manual_edit',
        'archive',
        'restore'
      )
    )
);

create index if not exists project_timeline_events_user_id_idx
  on public.project_timeline_events(user_id);

create index if not exists project_timeline_events_project_id_idx
  on public.project_timeline_events(project_id);

create index if not exists project_timeline_events_source_update_id_idx
  on public.project_timeline_events(source_update_id);

create index if not exists project_timeline_events_source_item_id_idx
  on public.project_timeline_events(source_item_id);

create index if not exists project_timeline_events_target_task_id_idx
  on public.project_timeline_events(target_task_id);

create index if not exists project_timeline_events_created_at_idx
  on public.project_timeline_events(created_at desc);


-- =========================================================
-- 4. Row Level Security
-- Every user can only access their own update/audit/timeline data.
-- =========================================================

alter table public.project_updates enable row level security;
alter table public.project_update_items enable row level security;
alter table public.project_timeline_events enable row level security;


-- project_updates policies

drop policy if exists "Users can view own project updates" on public.project_updates;
create policy "Users can view own project updates"
  on public.project_updates
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own project updates" on public.project_updates;
create policy "Users can insert own project updates"
  on public.project_updates
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own project updates" on public.project_updates;
create policy "Users can update own project updates"
  on public.project_updates
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own project updates" on public.project_updates;
create policy "Users can delete own project updates"
  on public.project_updates
  for delete
  using (auth.uid() = user_id);


-- project_update_items policies

drop policy if exists "Users can view own project update items" on public.project_update_items;
create policy "Users can view own project update items"
  on public.project_update_items
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own project update items" on public.project_update_items;
create policy "Users can insert own project update items"
  on public.project_update_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own project update items" on public.project_update_items;
create policy "Users can update own project update items"
  on public.project_update_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own project update items" on public.project_update_items;
create policy "Users can delete own project update items"
  on public.project_update_items
  for delete
  using (auth.uid() = user_id);


-- project_timeline_events policies

drop policy if exists "Users can view own project timeline events" on public.project_timeline_events;
create policy "Users can view own project timeline events"
  on public.project_timeline_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own project timeline events" on public.project_timeline_events;
create policy "Users can insert own project timeline events"
  on public.project_timeline_events
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own project timeline events" on public.project_timeline_events;
create policy "Users can update own project timeline events"
  on public.project_timeline_events
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own project timeline events" on public.project_timeline_events;
create policy "Users can delete own project timeline events"
  on public.project_timeline_events
  for delete
  using (auth.uid() = user_id);


-- =========================================================
-- 5. Documentation comments
-- =========================================================

comment on table public.project_updates is
  'Client update events connected to existing projects. Stores raw client messages, AI summary, lifecycle status, and review/apply timestamps.';

comment on table public.project_update_items is
  'Individual AI-suggested update items inside a client update. Stores old/new values, approval state, confidence, and audit timestamps.';

comment on table public.project_timeline_events is
  'Readable project timeline and audit trail events shown inside Project Update History.';