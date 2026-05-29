-- Text2Task Customer Stories / Public User Feedback
-- Migration: 202605280002_customer_stories.sql
-- Created: 2026-05-28
--
-- Purpose:
-- Let authenticated Text2Task users submit real feedback/customer stories.
-- Feedback is stored privately first and only appears publicly on the landing page
-- after the user grants public permission and the site owner/admin approves it.
--
-- Product rule:
-- Do not hardcode testimonials/reviews in the landing page.
-- Public landing page can only show approved customer stories from this table.

create extension if not exists "pgcrypto";

-- =========================================================
-- 1. customer_stories
-- Real user-submitted feedback/customer stories.
--
-- Lifecycle:
-- - Authenticated user submits feedback.
-- - Row is created with is_approved = false.
-- - Owner/admin reviews manually in Supabase for V1.
-- - Only rows with public_permission = true and is_approved = true
--   can be shown on the public landing page.
-- =========================================================

create table if not exists public.customer_stories (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  display_name text not null,
  role_or_business_type text null,
  rating integer null,
  feedback_text text not null,

  public_permission boolean not null default false,

  is_approved boolean not null default false,
  is_featured boolean not null default false,
  approved_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customer_stories_rating_check
    check (rating is null or (rating >= 1 and rating <= 5)),

  constraint customer_stories_display_name_length_check
    check (char_length(trim(display_name)) >= 2 and char_length(display_name) <= 80),

  constraint customer_stories_role_length_check
    check (role_or_business_type is null or char_length(role_or_business_type) <= 120),

  constraint customer_stories_feedback_text_length_check
    check (char_length(trim(feedback_text)) >= 20 and char_length(feedback_text) <= 1200)
);

create index if not exists customer_stories_user_id_idx
  on public.customer_stories(user_id);

create index if not exists customer_stories_public_approved_idx
  on public.customer_stories(is_approved, public_permission, is_featured, created_at desc);

create index if not exists customer_stories_created_at_idx
  on public.customer_stories(created_at desc);

create index if not exists customer_stories_approved_at_idx
  on public.customer_stories(approved_at desc)
  where is_approved = true;


-- =========================================================
-- 2. updated_at trigger
-- Keeps updated_at accurate for future admin/manual edits.
-- =========================================================

create or replace function public.set_customer_stories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  if new.is_approved = true and old.is_approved = false and new.approved_at is null then
    new.approved_at = now();
  end if;

  if new.is_approved = false then
    new.approved_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists customer_stories_set_updated_at
  on public.customer_stories;

create trigger customer_stories_set_updated_at
before update on public.customer_stories
for each row
execute function public.set_customer_stories_updated_at();


-- =========================================================
-- 3. Row Level Security
-- V1 rules:
-- - Authenticated users can insert their own feedback only.
-- - Authenticated users can view their own feedback.
-- - Public visitors can view only approved + public_permission stories.
-- - No broad client update policy in V1, to prevent users approving themselves.
-- - Approval is manual in Supabase for V1.
-- =========================================================

alter table public.customer_stories enable row level security;


drop policy if exists "Users can view own customer stories"
  on public.customer_stories;

create policy "Users can view own customer stories"
  on public.customer_stories
  for select
  using (auth.uid() = user_id);


drop policy if exists "Public can view approved customer stories"
  on public.customer_stories;

create policy "Public can view approved customer stories"
  on public.customer_stories
  for select
  using (
    public_permission = true
    and is_approved = true
  );


drop policy if exists "Users can insert own customer stories"
  on public.customer_stories;

create policy "Users can insert own customer stories"
  on public.customer_stories
  for insert
  with check (
    auth.uid() = user_id
    and is_approved = false
    and is_featured = false
    and approved_at is null
  );


drop policy if exists "Users can delete own unapproved customer stories"
  on public.customer_stories;

create policy "Users can delete own unapproved customer stories"
  on public.customer_stories
  for delete
  using (
    auth.uid() = user_id
    and is_approved = false
  );


-- =========================================================
-- 4. Documentation comments
-- =========================================================

comment on table public.customer_stories is
  'Real user-submitted Text2Task customer stories/feedback. Public landing page may show only approved stories with public_permission=true.';

comment on column public.customer_stories.user_id is
  'Authenticated Supabase user who submitted the feedback. Never trust client-sent user_id in API routes.';

comment on column public.customer_stories.display_name is
  'Public display name chosen by the user, shown only after approval.';

comment on column public.customer_stories.role_or_business_type is
  'Optional public context such as Freelancer, Web designer, Agency owner, Virtual assistant.';

comment on column public.customer_stories.rating is
  'Optional 1-5 rating. May be hidden in UI if the landing section should feel more like stories than star reviews.';

comment on column public.customer_stories.feedback_text is
  'The user-submitted feedback/customer story text.';

comment on column public.customer_stories.public_permission is
  'User permission allowing Text2Task to display this feedback publicly after approval.';

comment on column public.customer_stories.is_approved is
  'Manual owner/admin approval flag. Users cannot approve themselves from the client.';

comment on column public.customer_stories.is_featured is
  'Optional manual flag for prioritizing stories on the landing page.';

comment on column public.customer_stories.approved_at is
  'Timestamp set when a story is approved.';