-- Text2Task Client Share Link -- Phase 6B DB Apply Boundary
-- Migration: 202608230001_client_share_apply_boundary.sql
-- Created: 2026-08-23
--
-- Purpose:
-- Phase 6B is Analyze + existing Client Update review ONLY. There is no
-- legitimate way for a public.project_updates row with
-- source_type = 'client_share' to reach status 'applying' or 'applied'
-- during Phase 6B -- Apply-for-client_share, and the atomic
-- share_message_conversions/share_messages.status='converted' closure
-- that must accompany it, are Phase 6C's own future, separately
-- authorized work.
--
-- The application layer (app/api/project-updates/apply/route.ts) already
-- rejects a client_share update before ever calling
-- claimProjectUpdateForApply or apply_project_update_transaction. But a
-- read-only design audit established that this alone is not a complete
-- boundary:
--
--   - apply_project_update_transaction is SECURITY INVOKER with EXECUTE
--     granted to `authenticated`, and is called by the application using
--     the SAME authenticated-role session client the browser itself
--     could use -- revoking that grant would also break the existing,
--     unrelated text/image Apply path (the route has no other, more
--     privileged pathway to this RPC), and moving the route to a
--     service_role client would require rewriting the RPC's own
--     auth.uid()-based ownership model (a fundamentally larger, riskier
--     change, and an unnecessary broadening of credential authority this
--     codebase otherwise reserves exclusively for the public/anonymous
--     Client Share surface -- see lib/supabase/admin.ts).
--   - public.project_updates carries a plain
--     "for update using (auth.uid() = user_id) with check (auth.uid() =
--     user_id)" RLS policy with no column-level restriction
--     (202605250001_project_update_engine.sql). An authenticated owner
--     can therefore, in principle, reach PostgREST directly (bypassing
--     this application's own Next.js route and guard entirely) and
--     attempt to place their own client_share row into status='applying'
--     or 'applied' via a raw UPDATE -- or, critically, via a raw INSERT
--     that fabricates a fully-formed client_share row already at
--     status='applying'/'applied' from its very first moment of
--     existence, which an UPDATE-only transition guard would never see
--     at all (there is no OLD row for an INSERT).
--
-- This migration closes that gap with one small, dedicated, ADDITIVE
-- trigger -- deliberately kept separate from, and never modifying,
-- enforce_project_update_source_provenance() (202608210001), which
-- governs source-identity integrity/immutability only, not Apply
-- lifecycle eligibility. Conflating the two concerns inside one function
-- would make that function's own documented single purpose misleading;
-- keeping them separate also means Phase 6C can later remove or narrow
-- ONLY this guard (a small, self-contained diff) without touching Phase
-- 6A's own provenance trigger, or the 875-line
-- apply_project_update_transaction RPC, at all.
--
-- The guard inspects ONLY NEW -- it never reads OLD, and never branches
-- on TG_OP -- so it applies identically to INSERT and UPDATE alike. A
-- direct INSERT that tries to fabricate an already-applying/applied
-- client_share row is rejected exactly the same way a direct UPDATE
-- attempting the same transition is. Both 'applying' AND 'applied' are
-- prohibited: 'applying' because there is no legitimate in-flight Apply
-- attempt for client_share yet, and 'applied' because a direct write
-- must never be able to fabricate an already-completed client_share
-- Apply lifecycle state outright (skipping 'applying' entirely does not
-- make it safe).
--
-- This migration does NOT alter apply_project_update_transaction, its
-- grants, enforce_project_update_source_provenance(), any table's
-- columns, or any table's own grants. It adds exactly one new function
-- and one new trigger. Nothing in this migration writes to
-- share_message_conversions or sets share_messages.status.
--
-- No data backfill: Phase 6B (the only code path that can ever write
-- source_type='client_share' at all) is still uncommitted in the working
-- tree as of this migration and has never written status='applying' or
-- 'applied' for any row -- there is no existing production data this
-- guard could conflict with.

create or replace function public.enforce_project_update_client_share_apply_boundary()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.source_type = 'client_share'
    and new.status in ('applying', 'applied') then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE';
  end if;

  return new;
end;
$$;

comment on function public.enforce_project_update_client_share_apply_boundary() is
  'Phase 6B DB apply boundary (temporary, until Phase 6C atomic conversion closure): rejects any INSERT or UPDATE that would leave a project_updates row with source_type=''client_share'' in status ''applying'' or ''applied''. Inspects only NEW -- never OLD, never TG_OP -- so a direct INSERT that fabricates an already-applying/applied client_share row is rejected exactly like a direct UPDATE attempting the same transition; this guard cannot be bypassed by choosing INSERT over UPDATE. Kept deliberately separate from enforce_project_update_source_provenance() (202608210001), which governs source-identity integrity/immutability only. Writes to no table; performs no analysis; never references share_message_conversions or sets share_messages.status. Phase 6C will remove or narrow this guard, in its own migration, when it introduces the atomic Apply-and-convert transaction for client_share.';

drop trigger if exists project_updates_enforce_client_share_apply_boundary
  on public.project_updates;

create trigger project_updates_enforce_client_share_apply_boundary
before insert or update on public.project_updates
for each row
execute function public.enforce_project_update_client_share_apply_boundary();

revoke all on function public.enforce_project_update_client_share_apply_boundary()
  from public;
revoke all on function public.enforce_project_update_client_share_apply_boundary()
  from anon;
revoke all on function public.enforce_project_update_client_share_apply_boundary()
  from authenticated;
revoke all on function public.enforce_project_update_client_share_apply_boundary()
  from service_role;
