-- Text2Task Client Share Link -- Phase 6A: Durable Client Update Source
-- Provenance Foundation
-- Migration: 202608210001_client_share_project_update_provenance.sql
-- Created: 2026-08-21
--
-- Purpose:
-- Adds the durable database foundation a future, separately-authorized
-- Phase 6B owner-triggered "analyze this client message as a Client
-- Update" action will need to truthfully and idempotently identify its
-- source share_messages row. This migration is schema/data-model
-- foundation ONLY:
--   - no owner-facing UI
--   - no convert API route
--   - no change to apply_project_update_transaction
--   - no write path of any kind to public.share_message_conversions
--   - no status = 'converted' behaviour anywhere
--   - no widening of the public POST /api/project-updates/analyze
--     request contract
--   - no widening of the analyzer's own actionable input types
--     (ProjectUpdateV2AnalyzerInput / CreateProjectUpdateInput) -- those
--     stay 'text' | 'image' through this migration; widening them without
--     also wiring the paired source_share_message_id parameter would let
--     a TypeScript-valid call construct a database-invalid row, which is
--     exactly what the coupling constraint below exists to prevent
--   - no find/resume/retry/concurrent-request operational idempotency --
--     this migration provides only the structural guarantee that one
--     source share message can back at most one public.project_updates
--     row; the operational algorithm that exercises this guarantee
--     requires the authenticated conversion route that does not exist
--     yet
--
-- 1. public.project_updates.source_share_message_id
--
-- Nullable FK to public.share_messages(id), ON DELETE RESTRICT --
-- deliberately not SET NULL and not CASCADE. SET NULL was rejected: it
-- would leave source_type = 'client_share' with
-- source_share_message_id = NULL, exactly the invalid state the coupling
-- constraint below exists to reject -- an unresolvable contradiction
-- between two required invariants, not a real option. CASCADE was also
-- rejected: it would destroy the public.project_updates row itself (a
-- permanent professional record, possibly already applied, with real
-- tasks and timeline events attached) merely because the share message
-- it originated from was deleted. RESTRICT makes a hard delete of a
-- referenced share_messages row fail outright while any
-- public.project_updates row still points at it, preserving truthful
-- provenance rather than silently corrupting or destroying it. This
-- introduces zero risk to any currently-executing code path: no
-- application code anywhere in this repository hard-deletes
-- public.projects, public.tasks, public.project_share_links, or
-- public.share_messages -- every "delete" action in this codebase is a
-- soft-delete (deleted_at = now()), never a real SQL DELETE, on every
-- one of these tables.
--
-- A partial unique index on (source_share_message_id) where it is not
-- null is the structural guarantee that one share message can back at
-- most one public.project_updates row, ever -- proven by the database,
-- not by React/button-state gating.
--
-- 2. Provenance coupling
--
-- source_type = 'client_share' if and only if
-- source_share_message_id is not null. Both invalid states -- a
-- 'client_share' row with no source message id, and a non-'client_share'
-- row with a source message id -- are rejected at the database layer by
-- an explicit CHECK constraint, not left to application convention.
-- Every existing project_updates row (source_type in
-- 'text'/'image'/'email'/'manual', source_share_message_id null) already
-- satisfies this constraint and is completely unaffected.
--
-- 3. Cross-table integrity and provenance immutability
--
-- One combined before insert or update trigger, following the pattern
-- established by public.enforce_share_message_conversion_integrity()
-- (202608030005_client_share_integrity_and_security.sql) exactly:
-- language plpgsql, SECURITY INVOKER, an explicit
-- set search_path = public, pg_temp, and stable SCREAMING_SNAKE_CASE
-- messages raised with errcode P0001. SECURITY DEFINER is deliberately
-- NOT used: under an owner-authenticated caller, RLS on
-- public.share_messages (auth.uid() = user_id) already means a
-- cross-account source_share_message_id simply resolves to "not found"
-- rather than "not owned" -- both outcomes reject the write, which is
-- the required behaviour, exactly as this feature's own migration
-- comments have explained for every sibling integrity trigger. No new
-- table privilege or EXECUTE grant is introduced for this trigger.
--
-- On insert, for any non-null source_share_message_id, the referenced
-- share_messages row must exist, have author_type = 'client', the same
-- user_id, and the same project_id as the new public.project_updates
-- row -- fail closed on every mismatch, matching this feature's
-- established no-silent-repair posture (a mismatch is rejected, never
-- quietly corrected).
--
-- Content integrity (added after initial acceptance review, still
-- Phase 6A -- not deferred to 6B): proving the referenced message
-- belongs to the same owner/project/author is not sufficient by itself
-- -- without also proving the ROW'S OWN raw_input actually equals that
-- message's body, an authenticated owner could legitimately reference a
-- real share_messages id while supplying unrelated, browser-controlled
-- text as raw_input, producing a durable source_type = 'client_share'
-- row whose "source" is not truthfully what the client wrote. This
-- directly conflicts with the locked Phase 6 rule that the authoritative
-- Client Share source is only ever the immutable share_messages.body,
-- loaded server-side -- never anything the browser supplies. So, for any
-- non-null source_share_message_id, this trigger additionally requires
-- new.raw_input is not distinct from the referenced message's body --
-- exact equality, no trim/case-fold/hash/other reinterpretation -- and
-- fails closed with PROJECT_UPDATE_SOURCE_MESSAGE_BODY_MISMATCH
-- otherwise. Phase 6B's own future route satisfies this trivially by
-- construction (it loads the message body itself and persists exactly
-- that value; it never accepts a caller-supplied rawInput for this
-- path), so this is a database-level backstop, not a new constraint 6B
-- has to work around.
--
-- On update, once a public.project_updates row exists, its source
-- identity is immutable: any change to source_type or
-- source_share_message_id -- in either direction -- is rejected. This
-- covers, uniformly, message A -> message B, 'client_share' -> any other
-- source_type, a non-null source id -> NULL, and a pre-existing normal
-- row being retroactively turned into a 'client_share' one. The same
-- immutability additionally covers raw_input, but ONLY for a row whose
-- old.source_share_message_id was already non-null -- a client_share
-- row's raw_input can never drift away from the message body Layer 1
-- above already proved it equals at insert time (the message body
-- itself is separately immutable, enforced by the existing, unmodified
-- enforce_share_message_integrity trigger), while an ordinary
-- text/image/email/manual update's raw_input remains exactly as free to
-- change as it always was -- this rule is deliberately NOT broadened to
-- every project_updates row, only to client_share-sourced ones. No
-- caller is exempt, including any future retry/resume mechanism: that
-- mechanism may only update *result* state (ai_summary, status, items,
-- timestamps), never source identity or (for a client_share row) content.
-- This guard is necessary here, unlike on public.share_messages, because
-- public.project_updates carries a plain, unrestricted
-- "for update using (auth.uid() = user_id) with check (auth.uid() =
-- user_id)" RLS policy with no column-level restriction and no explicit
-- table grant of any kind (202605250001_project_update_engine.sql),
-- relying on Supabase's default broad authenticated grant -- unlike
-- every Client Share table, which explicitly revokes that default grant
-- and re-grants narrowly. Without this trigger, any authenticated
-- owner's own generic update call against their own row could change
-- any of these columns once populated; with it, the database itself is
-- the only authority over source identity and content, not UI or API
-- convention. This was verified as non-breaking: neither
-- public.markProjectUpdateAsAnalyzed nor
-- public.apply_project_update_transaction (the only two existing
-- writers of a public.project_updates row after creation) ever sets
-- source_type, source_share_message_id, or raw_input.
--
-- 4. project_updates_source_type_check
--
-- Widened to additionally accept 'client_share', preserving every
-- existing value ('text', 'image', 'email', 'manual') unchanged.

alter table public.project_updates
  add column if not exists source_share_message_id uuid null;

alter table public.project_updates
  add constraint project_updates_source_share_message_id_fkey
  foreign key (source_share_message_id)
  references public.share_messages(id)
  on delete restrict
  not valid;

alter table public.project_updates
  validate constraint project_updates_source_share_message_id_fkey;

create unique index if not exists project_updates_source_share_message_id_key
  on public.project_updates (source_share_message_id)
  where source_share_message_id is not null;

alter table public.project_updates
  drop constraint if exists project_updates_source_type_check;

alter table public.project_updates
  add constraint project_updates_source_type_check
  check (source_type in ('text', 'image', 'email', 'manual', 'client_share'))
  not valid;

alter table public.project_updates
  validate constraint project_updates_source_type_check;

alter table public.project_updates
  add constraint project_updates_source_provenance_coupling_check
  check ((source_type = 'client_share') = (source_share_message_id is not null))
  not valid;

alter table public.project_updates
  validate constraint project_updates_source_provenance_coupling_check;

comment on column public.project_updates.source_share_message_id is
  'Phase 6A: nullable durable pointer to the public.share_messages row this Client Update was created from, when source_type = ''client_share''. NULL for every text/image/email/manual update. ON DELETE RESTRICT so a hard delete of the referenced message can never silently corrupt or erase this provenance. Coupled to source_type by project_updates_source_provenance_coupling_check, unique (when not null) by project_updates_source_share_message_id_key so one share message can back at most one project_updates row, and immutable after row creation by enforce_project_update_source_provenance -- see this migration''s own header comment for the full rationale. Phase 6A does not write this column from any code path; it exists so Phase 6B can, once a separately-authorized owner-triggered conversion route exists.';

create or replace function public.enforce_project_update_source_provenance()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_message_user_id uuid;
  v_message_project_id uuid;
  v_message_author_type text;
  v_message_body text;
begin
  if TG_OP = 'UPDATE' then
    if new.source_type is distinct from old.source_type
      or new.source_share_message_id is distinct from old.source_share_message_id
      or (
        old.source_share_message_id is not null
        and new.raw_input is distinct from old.raw_input
      ) then
      raise exception using errcode = 'P0001', message = 'PROJECT_UPDATE_SOURCE_PROVENANCE_IMMUTABLE';
    end if;
  end if;

  if new.source_share_message_id is not null then
    select message.user_id, message.project_id, message.author_type, message.body
      into v_message_user_id, v_message_project_id, v_message_author_type, v_message_body
      from public.share_messages as message
      where message.id = new.source_share_message_id;

    if v_message_user_id is null then
      raise exception using errcode = 'P0001', message = 'PROJECT_UPDATE_SOURCE_MESSAGE_NOT_FOUND';
    end if;

    if v_message_author_type <> 'client' then
      raise exception using errcode = 'P0001', message = 'PROJECT_UPDATE_SOURCE_MESSAGE_NOT_CLIENT_AUTHORED';
    end if;

    if v_message_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'PROJECT_UPDATE_SOURCE_MESSAGE_OWNER_MISMATCH';
    end if;

    if v_message_project_id <> new.project_id then
      raise exception using errcode = 'P0001', message = 'PROJECT_UPDATE_SOURCE_MESSAGE_PROJECT_MISMATCH';
    end if;

    if new.raw_input is distinct from v_message_body then
      raise exception using errcode = 'P0001', message = 'PROJECT_UPDATE_SOURCE_MESSAGE_BODY_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_project_update_source_provenance() is
  'Phase 6A: rejects an insert whose non-null source_share_message_id does not resolve to an existing, client-authored share_messages row owned by the same user and belonging to the same project as the new public.project_updates row, or whose raw_input is not exactly equal to that message''s body (no trim/case-fold/hash/other reinterpretation). Rejects any update that changes source_type or source_share_message_id on an existing row in either direction, and rejects any update that changes raw_input on a row whose source_share_message_id was already non-null. SECURITY INVOKER: under an owner-authenticated caller, RLS on public.share_messages already confines the lookup to that owner''s own rows. Writes to no table: performs no analysis, creates no project update, creates no task, changes no project/task/message status, and never references public.share_message_conversions or public.project_timeline_events.';

drop trigger if exists project_updates_enforce_source_provenance
  on public.project_updates;

create trigger project_updates_enforce_source_provenance
before insert or update on public.project_updates
for each row
execute function public.enforce_project_update_source_provenance();

revoke all on function public.enforce_project_update_source_provenance()
  from public;
revoke all on function public.enforce_project_update_source_provenance()
  from anon;
revoke all on function public.enforce_project_update_source_provenance()
  from authenticated;
revoke all on function public.enforce_project_update_source_provenance()
  from service_role;
