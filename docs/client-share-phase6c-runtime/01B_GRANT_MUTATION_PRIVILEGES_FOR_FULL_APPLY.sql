-- Text2Task Client Share Link -- Phase 6C Runtime Verification Package
-- File 01B: Grant authenticated mutation privileges on the base-table
-- fixture (projects/tasks/clients), for a FULL successful Apply
--
-- TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION
--
-- Run this THIRD, immediately after
-- docs/client-share-phase6c-runtime/01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql
-- has already been applied in this disposable project (that file's own
-- column-extension work is unaffected by, and a strict prerequisite for,
-- this one). Never run this in the real Text2Task production project.
--
-- WHY THIS IS A SEPARATE FILE, NOT AN EDIT TO 01:
--
-- 01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql has its own idempotency guard
-- (a `text2task_client_share_phase6c_runtime_sentinel` row) that refuses
-- to run a second time in a project where it has already succeeded once.
-- The finding this file corrects was discovered AFTER a real disposable
-- project had already run file 01 successfully -- editing file 01 in
-- place would have forced that project to manually drop its own sentinel
-- and re-run the whole file before picking up the fix. This file is
-- purely additive instead: it can run once, standalone, in any project
-- where file 01 has already succeeded, with no reset required.
--
-- ROOT CAUSE (runtime attempt #1's actual finding, traced directly, not
-- assumed): the FIRST real execution of
-- 03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql failed with
--
--   ERROR: 42501: permission denied for table projects
--   CONTEXT: select project.* from public.projects as project
--            where project.id = v_update.project_id ...
--            for update of project
--            (inside public.apply_project_update_transaction)
--
-- apply_project_update_transaction is SECURITY INVOKER and genuinely
-- performs real SELECT ... FOR UPDATE / UPDATE / INSERT statements
-- against public.projects/public.tasks/public.clients AS the
-- `authenticated` role, exactly like a real owner session would (this is
-- the correct, intended behavior -- Phase 6B's own DB-boundary audit
-- already established that the database transaction itself, not
-- Next.js, is the real security boundary here). The Phase 6A fixture's
-- own docs/client-share-phase6a-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql
-- deliberately granted `authenticated` only SELECT on its hand-authored
-- projects/tasks/clients/task_resources stand-ins -- correct and
-- sufficient for Phase 6A/6B, which never mutated these tables as
-- authenticated (Phase 6B's own runtime tests only ever reached
-- apply_project_update_transaction's very first precondition check,
-- APPLY_ATTEMPT_MISMATCH, before touching projects/tasks/clients at
-- all). Phase 6C's runtime matrix is the first to require a REAL,
-- FULLY SUCCESSFUL Apply, which is the first time this gap is reached.
--
-- This is a DISPOSABLE FIXTURE / PREREQUISITE gap, not a defect in the
-- Phase 6C migration, the Apply RPC, or the application code -- nothing
-- about apply_project_update_transaction changed or needs to change; the
-- fixture simply never modeled a privilege level the RPC has always
-- required for real work.
--
-- DO NOT TRUST THE SUPABASE ERROR HINT ALONE: Supabase's own error
-- message suggests only `GRANT UPDATE ON public.projects TO
-- authenticated`. That is necessary but incomplete for two independent
-- reasons, both addressed below:
--   1. PostgreSQL's `SELECT ... FOR UPDATE` locking clause requires the
--      querying role to hold UPDATE privilege on the table, IN ADDITION
--      TO SELECT -- not SELECT alone. This is standard, documented
--      PostgreSQL behavior (the row-locking clauses FOR UPDATE/FOR NO
--      KEY UPDATE require UPDATE privilege; FOR SHARE/FOR KEY SHARE
--      require at least UPDATE, DELETE, or SELECT) -- it is not specific
--      to Supabase or to this RPC.
--   2. The SAME `SELECT ... FOR UPDATE` locking pattern is used later in
--      the SAME function against public.clients (if the project has a
--      client_id) and public.tasks (to stabilize task ordering before
--      any mutation) -- both would fail the identical way, immediately
--      after `projects` is fixed, if only `projects` were corrected.
--      apply_project_update_transaction also performs real UPDATE
--      statements against projects/tasks/clients (project-field
--      changes, client-detail changes, subtask updates) and a real
--      INSERT against tasks (new_subtask items) -- none of which were
--      granted either.
--
-- EVIDENCE for the exact grant set below: a repository-wide trace of
-- every app/api/**/lib/** call site that reads or writes
-- projects/tasks/clients via the ordinary session-bound createClient()
-- client (never the admin/service_role client -- confirmed no route
-- writes these three tables via service_role on behalf of a
-- browser-initiated request, which is itself part of the evidence that
-- the disposable fixture must model `authenticated`, not
-- `postgres`/`service_role`, and that this runtime package's own Apply
-- calls must keep running as `authenticated` -- never elevated to
-- bypass this gap -- or the whole exercise would stop proving the real
-- SECURITY INVOKER-under-authenticated behavior it exists to verify):
--
--   public.projects -- SELECT (e.g. app/api/projects/update/route.ts),
--     INSERT (app/api/tasks/route.ts's inline project creation;
--     lib/projects/import-persistence.server.ts's createProjectGroup),
--     UPDATE (app/api/projects/update/route.ts;
--     app/api/projects/bulk-action/route.ts -- status/archive/soft-delete
--     via is_archived/deleted_at columns, never a real DELETE there),
--     and one real SQL DELETE
--     (lib/projects/import-persistence.server.ts's
--     rollbackCreatedProjects, invoked from
--     app/api/projects/import/route.ts using the ordinary session
--     client) -- so DELETE is evidenced and included below.
--
--   public.tasks -- SELECT/INSERT/UPDATE (app/api/tasks/route.ts,
--     app/api/tasks/update/route.ts, app/api/tasks/bulk-status/route.ts;
--     app/api/tasks/delete/route.ts's own "delete" action is itself only
--     ever a soft-delete UPDATE of deleted_at/is_archived, never a real
--     DELETE), and the SAME real SQL DELETE rollback path as projects
--     (rollbackCreatedProjects) -- so DELETE is evidenced and included
--     below.
--
--   public.clients -- SELECT/INSERT/UPDATE (app/api/tasks/route.ts,
--     app/api/tasks/update/route.ts,
--     lib/projects/import-persistence.server.ts) -- NO real or soft
--     DELETE was found anywhere in the repository for clients -- DELETE
--     is deliberately NOT granted below; inventing it would exceed the
--     evidenced privilege surface.
--
-- RLS FIDELITY: a GRANT alone does not bypass Row Level Security -- once
-- RLS is enabled (the Phase 6A fixture already enables it on all four of
-- its hand-authored tables), a role additionally needs a PASSING POLICY
-- for the specific command being attempted, or the operation is denied
-- regardless of the grant. The Phase 6A fixture's own existing policy on
-- these tables is SELECT-only ("Fixture owner select" ... for select to
-- authenticated using (auth.uid() = user_id)). This file adds
-- INSERT/UPDATE/DELETE policies using the EXACT SAME `auth.uid() =
-- user_id` ownership predicate the fixture's own existing SELECT policy
-- already uses -- the identical pattern every real, migration-sourced
-- table in this repository uses for its own RLS policies (project_updates,
-- project_update_items, etc., confirmed by direct migration reads
-- earlier in this engagement). No new or different RLS shape is
-- invented; this is the same pattern, extended to the same tables for
-- the additional commands now evidenced above. These disposable policies
-- remain a deliberate SIMPLIFICATION relative to whatever the real
-- production policies for projects/tasks/clients actually contain (which
-- cannot be confirmed -- no migration defines them, exactly as file 01's
-- own header already documents for these same three tables' columns) --
-- sufficient to prove the Apply RPC's SECURITY INVOKER-under-authenticated
-- mechanics correctly, not a claim of exact production RLS parity.
--
-- Policies are created via DROP POLICY IF EXISTS + CREATE POLICY (this
-- file's own idempotency discipline, matching this whole engagement's
-- established DROP-then-CREATE convention for non-idempotent DDL) --
-- safe to re-run this file more than once in the same project. GRANT
-- statements are naturally idempotent (granting an already-held
-- privilege is a harmless no-op).

do $$
begin
  if to_regclass('public.text2task_client_share_phase6c_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 6C base-table extension sentinel was not found. Run docs/client-share-phase6c-runtime/01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql first.';
  end if;
end;
$$;

-- =========================================================
-- Grants -- the evidenced authenticated privilege surface only (see the
-- header comment above for the exact citations behind every verb).
-- =========================================================

grant insert, update, delete on table public.projects to authenticated;
grant insert, update, delete on table public.tasks to authenticated;
grant insert, update on table public.clients to authenticated;
-- clients: no DELETE grant -- not evidenced anywhere in the repository.

-- =========================================================
-- RLS policies -- same auth.uid() = user_id ownership predicate as the
-- Phase 6A fixture's own existing SELECT policy on these tables.
-- =========================================================

drop policy if exists "Fixture owner insert" on public.projects;
create policy "Fixture owner insert" on public.projects
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Fixture owner update" on public.projects;
create policy "Fixture owner update" on public.projects
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Fixture owner delete" on public.projects;
create policy "Fixture owner delete" on public.projects
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Fixture owner insert" on public.tasks;
create policy "Fixture owner insert" on public.tasks
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Fixture owner update" on public.tasks;
create policy "Fixture owner update" on public.tasks
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Fixture owner delete" on public.tasks;
create policy "Fixture owner delete" on public.tasks
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Fixture owner insert" on public.clients;
create policy "Fixture owner insert" on public.clients
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Fixture owner update" on public.clients;
create policy "Fixture owner update" on public.clients
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- clients: no delete policy -- matches the withheld DELETE grant above.

-- =========================================================
-- FINAL VERIFICATION (not part of any migration)
--
-- Confirms every grant and policy above actually took effect -- fails
-- loudly here rather than surfacing later as a confusing mid-Apply
-- error, matching file 01's own column-verification discipline.
-- =========================================================

do $$
declare
  v_missing_grants text[];
  v_missing_policies text[];
begin
  select array_agg(expected.description order by expected.description)
    into v_missing_grants
    from (
      values
        ('projects.INSERT', 'projects', 'INSERT'),
        ('projects.UPDATE', 'projects', 'UPDATE'),
        ('projects.DELETE', 'projects', 'DELETE'),
        ('tasks.INSERT', 'tasks', 'INSERT'),
        ('tasks.UPDATE', 'tasks', 'UPDATE'),
        ('tasks.DELETE', 'tasks', 'DELETE'),
        ('clients.INSERT', 'clients', 'INSERT'),
        ('clients.UPDATE', 'clients', 'UPDATE')
    ) as expected(description, table_name, privilege)
    where not has_table_privilege('authenticated', 'public.' || expected.table_name, expected.privilege);

  if v_missing_grants is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO CONTINUE. Expected authenticated grant(s) still missing: %s.',
      array_to_string(v_missing_grants, ', ')
    );
  end if;

  select array_agg(expected.description order by expected.description)
    into v_missing_policies
    from (
      values
        ('projects.INSERT-policy', 'projects', 'Fixture owner insert'),
        ('projects.UPDATE-policy', 'projects', 'Fixture owner update'),
        ('projects.DELETE-policy', 'projects', 'Fixture owner delete'),
        ('tasks.INSERT-policy', 'tasks', 'Fixture owner insert'),
        ('tasks.UPDATE-policy', 'tasks', 'Fixture owner update'),
        ('tasks.DELETE-policy', 'tasks', 'Fixture owner delete'),
        ('clients.INSERT-policy', 'clients', 'Fixture owner insert'),
        ('clients.UPDATE-policy', 'clients', 'Fixture owner update')
    ) as expected(description, table_name, policy_name)
    where not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = expected.table_name
        and p.policyname = expected.policy_name
    );

  if v_missing_policies is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO CONTINUE. Expected RLS polic(y/ies) still missing: %s.',
      array_to_string(v_missing_policies, ', ')
    );
  end if;
end;
$$;

select 'PHASE_6C_MUTATION_PRIVILEGES_READY'::text as fixture_status;
