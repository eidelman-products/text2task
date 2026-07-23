-- Text2Task Project Update needs_review item type
-- Migration: 202607230001_project_update_needs_review_type.sql
-- Created: 2026-07-23
--
-- Adds "needs_review" to the set of allowed public.project_update_items.type
-- values. This is a genuinely new outcome: the resolver/judge can now decide
-- that a client update plausibly relates to existing work but cannot safely
-- auto-select a target, and that decision must be stored and displayed as
-- its own state rather than collapsed into "duplicate_warning".
--
-- This migration is additive only. It does not touch any existing row, and
-- it deliberately does NOT backfill or reclassify historical
-- "duplicate_warning" rows to "needs_review" -- there is no reliable way to
-- know, after the fact, which historical duplicate_warning decisions would
-- have been needs_review under the corrected resolver/judge behavior, and
-- guessing would fabricate history. Historical duplicate_warning rows keep
-- their original stored type and are displayed per that original type.
--
-- Safe sequence for changing a CHECK constraint without ever leaving the
-- table without an equivalent constraint in place:
--   1. Add a new constraint with the full allowed set (old values +
--      needs_review) as NOT VALID, so it is enforced for all new/updated
--      rows immediately but does not require scanning existing rows yet.
--   2. VALIDATE it against all existing rows. Every existing row already
--      satisfies this constraint (it is a superset of the old one), so this
--      step is expected to succeed; if it does not, the migration fails
--      loudly here rather than silently proceeding without validation.
--   3. Drop the old constraint.
--   4. Rename the validated new constraint to the original constraint name,
--      so the canonical name public.project_update_items_type_check keeps
--      pointing at the (now updated) allowed set.
alter table public.project_update_items
  add constraint project_update_items_type_check_new
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
      'no_action',
      'needs_review'
    )
  ) not valid;

alter table public.project_update_items
  validate constraint project_update_items_type_check_new;

alter table public.project_update_items
  drop constraint project_update_items_type_check;

alter table public.project_update_items
  rename constraint project_update_items_type_check_new to project_update_items_type_check;
