-- Text2Task Client Share Link -- Phase 8 Access Epoch Runtime Verification Package
-- File 01B: Grant authenticated mutation privileges on the base-table
-- fixture (projects/tasks/task_resources), matching REAL Production's
-- own evidenced privilege surface
--
-- TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION
--
-- Run this at any point AFTER 01_PREPARE_RUNTIME_FIXTURES.sql has
-- already succeeded in this disposable project, and BEFORE
-- 03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql. For a BRAND-NEW project, the
-- natural place is immediately after File 01, before File 02 (order
-- relative to 02/02B/02C does not actually matter -- this file only
-- touches the pre-existing base-table stand-ins from File 01, never
-- anything Files 02/02B/02C create). For a project that has ALREADY
-- progressed through Steps 01-02C successfully (i.e. it hit the Step 7
-- `permission denied for table projects` failure this file exists to
-- fix), run this file NOW, then retry
-- 03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql -- no need to redo any earlier
-- step. Never run this in the real Text2Task production project.
--
-- WHY THIS IS A SEPARATE FILE, NOT AN EDIT TO 01:
--
-- File 01 has its own idempotency guard (a
-- text2task_phase8_access_epoch_runtime_sentinel row) that refuses to
-- run a second time in a project where it has already succeeded once.
-- The finding this file corrects was discovered AFTER a real disposable
-- project had already run File 01 successfully -- editing File 01 in
-- place would have forced that project to be discarded and rebuilt from
-- scratch just to pick up the fix. This file is purely additive instead:
-- safe to run once, standalone, in any project where File 01 has already
-- succeeded, with no reset required -- exactly the same discipline
-- docs/client-share-phase6c-runtime/01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql
-- already established for this identical class of gap.
--
-- ROOT CAUSE (traced directly from the real Step 7 failure, not
-- assumed): 03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql's own Section B (and
-- D/E/F/G/I, and Section C's task/resource-mapping sub-tests) correctly
-- model a real owner session -- `perform pg_temp.act_as('authenticated',
-- v_owner);` sets request.jwt.claims so auth.uid() resolves to the
-- fixture owner, then performs a raw `insert into public.projects
-- (user_id) values (v_owner)`, exactly mirroring how the real
-- application actually creates a project row. That INSERT failed with
-- `42501: permission denied for table projects` because File 01's own
-- base-table stand-in (copied from
-- docs/client-share-phase6a-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql's
-- own convention) granted `authenticated` SELECT ONLY on
-- projects/tasks/clients/task_resources.
--
-- DO NOT TRUST THE SUPABASE ERROR HINT ALONE: Supabase's own error
-- message suggests only `GRANT INSERT ON public.projects TO
-- authenticated`. Blindly applying only that would (a) still be
-- incomplete -- every owner RPC this package calls (activate_share_link,
-- disable_share_link, reenable_share_link, save_share_configuration, and
-- every other lifecycle/access-operation RPC) locks the OWNING PROJECT
-- row via `select ... from public.projects ... for update` as part of
-- its own ownership verification, and PostgreSQL's `FOR UPDATE` locking
-- clause requires UPDATE privilege on the table, not merely SELECT --
-- every one of those RPC calls would still fail, one step later, on the
-- exact same class of error -- and (b) would risk being applied
-- unreflectively, without confirming this is genuinely how the real
-- application behaves rather than a Supabase-suggested shortcut. Neither
-- is acceptable per this engagement's own standing instruction not to
-- weaken security or grant privileges the real schema does not
-- genuinely have.
--
-- EVIDENCE THIS MATCHES REAL PRODUCTION, NOT AN INVENTED PRIVILEGE:
-- mechanically traced from the real application source in this same
-- repository (not from Supabase's hint, not assumed):
--   - lib/projects/import-persistence.server.ts's createProjectGroup()
--     performs `supabase.from("projects").insert(...)` using the
--     ordinary session-bound `createClient()` client (lib/supabase/server.ts,
--     which connects to Postgres as the `authenticated` role, RLS-bound)
--     -- NOT the admin/service_role client. app/api/projects/import/route.ts's
--     own comment confirms this is a live, intentionally-retained
--     "compatibility fallback" path, not dead code.
--   - app/api/projects/update/route.ts and
--     app/api/projects/bulk-action/route.ts likewise mutate `projects`
--     (field edits; status/archive/soft-delete via is_archived/deleted_at)
--     through the same session-bound client.
--   - app/api/tasks/route.ts, app/api/tasks/update/route.ts and
--     app/api/tasks/bulk-status/route.ts mutate `tasks` the same way
--     (app/api/tasks/delete/route.ts's own "delete" action is itself
--     only ever a soft-delete UPDATE of deleted_at/is_archived, never a
--     real SQL DELETE, on the code paths this package's own tests
--     exercise).
--   - This package's own task/resource-mapping sub-tests
--     (03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql, Section C7/C8) create a
--     `public.task_resources` row the same way, mirroring
--     app/api/task-resources/**'s own use of the session-bound client.
--   - Two EARLIER, independent Client Share runtime packages already
--     discovered and fixed this identical gap for their own purposes:
--     docs/client-share-phase3-browser-acceptance/01_EXTEND_DISPOSABLE_APP_SCHEMA.sql
--     ("the real dashboard INSERTs/UPDATEs projects, tasks, and clients
--     as the authenticated owner (never through service-role)") and
--     docs/client-share-phase6c-runtime/01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql
--     (the fullest, most rigorously-cited version, including the exact
--     FOR-UPDATE-requires-UPDATE-privilege reasoning this file's own
--     header repeats). This file's own grant set is deliberately scoped
--     to exactly what THIS package's own tests exercise (see below),
--     not copy-pasted wholesale from either prior package.
--
-- SCOPE, deliberately narrower than phase6c's own (more complete)
-- evidence base -- because this package never touches public.clients at
-- all (no fixture, no test, no RPC call in this package's own Sections
-- A-J reads or writes it), no grant or policy is added for it here;
-- File 01's own existing SELECT-only grant/policy on public.clients is
-- untouched. public.projects and public.tasks get INSERT + UPDATE +
-- DELETE (matching phase6c's own fully-evidenced citation for both
-- verbs including DELETE, via lib/projects/import-persistence.server.ts's
-- rollbackCreatedProjects). public.task_resources gets INSERT + UPDATE
-- only (matching phase3's own scope; no DELETE evidenced anywhere for
-- it, and this package never deletes one). No anon grant of any kind is
-- added anywhere in this file, and no grant is added to
-- project_share_links/share_session_grants or any other Client-Share-
-- owned table -- Section H's own existing least-privilege assertions
-- about those tables remain fully meaningful and untouched.
--
-- RLS FIDELITY: a GRANT alone does not bypass Row Level Security -- File
-- 01 already enables RLS on all four base-table stand-ins with only a
-- SELECT policy. This file adds INSERT/UPDATE/DELETE policies using the
-- EXACT SAME `auth.uid() = user_id` ownership predicate File 01's own
-- existing SELECT policy already uses on these same tables -- the
-- identical pattern every real, migration-sourced table in this
-- repository uses for its own RLS policies. No new or different RLS
-- shape is invented.
--
-- Policies are created via DROP POLICY IF EXISTS + CREATE POLICY (safe
-- to re-run this file more than once in the same project). GRANT
-- statements are naturally idempotent.

do $$
declare
  v_sentinel_kind text;
begin
  if to_regclass('public.text2task_phase8_access_epoch_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 8 Access Epoch runtime test sentinel was not found. Run 01_PREPARE_RUNTIME_FIXTURES.sql first, in this same disposable project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_phase8_access_epoch_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_8_ACCESS_EPOCH_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row does not identify this project as a disposable Phase 8 Access Epoch runtime test project.';
  end if;

  if to_regclass('public.projects') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.projects does not exist yet. Run 01_PREPARE_RUNTIME_FIXTURES.sql first.';
  end if;
end;
$$;

-- =========================================================
-- Grants -- the evidenced authenticated privilege surface only (see the
-- header comment above for the exact citations behind every verb).
-- =========================================================

grant insert, update, delete on table public.projects to authenticated;
grant insert, update, delete on table public.tasks to authenticated;
grant insert, update on table public.task_resources to authenticated;
-- public.clients: deliberately untouched -- this package never writes
-- to it (see header). It keeps File 01's original SELECT-only grant.

-- =========================================================
-- RLS policies -- same auth.uid() = user_id ownership predicate as File
-- 01's own existing SELECT policy on these same tables.
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

drop policy if exists "Fixture owner insert" on public.task_resources;
create policy "Fixture owner insert" on public.task_resources
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Fixture owner update" on public.task_resources;
create policy "Fixture owner update" on public.task_resources
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- public.task_resources: no delete policy -- matches the withheld
-- DELETE grant above.

-- =========================================================
-- FINAL VERIFICATION (not part of any migration)
--
-- Confirms every grant and policy above actually took effect, and that
-- NOTHING BEYOND the evidenced set was accidentally added (no anon
-- grant, no clients mutation grant, no privilege on any Client-Share-
-- owned table) -- fails loudly here rather than surfacing later as a
-- confusing mid-test error or, worse, silently over-granting.
-- =========================================================

do $$
declare
  v_missing_grants text[];
  v_missing_policies text[];
  v_unexpected_grants text[];
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
        ('task_resources.INSERT', 'task_resources', 'INSERT'),
        ('task_resources.UPDATE', 'task_resources', 'UPDATE')
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
        ('task_resources.INSERT-policy', 'task_resources', 'Fixture owner insert'),
        ('task_resources.UPDATE-policy', 'task_resources', 'Fixture owner update')
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

  -- Negative check: no privilege was accidentally added beyond the
  -- evidenced set -- anon still has nothing, clients/task_resources
  -- still hold no DELETE, and no Client-Share-owned table's own grant
  -- posture was touched by this file at all.
  select array_agg(unexpected.description order by unexpected.description)
    into v_unexpected_grants
    from (
      values
        ('anon has projects.INSERT', 'anon', 'projects', 'INSERT'),
        ('anon has projects.UPDATE', 'anon', 'projects', 'UPDATE'),
        ('anon has projects.DELETE', 'anon', 'projects', 'DELETE'),
        ('anon has tasks.INSERT', 'anon', 'tasks', 'INSERT'),
        ('anon has task_resources.INSERT', 'anon', 'task_resources', 'INSERT'),
        ('authenticated has clients.INSERT', 'authenticated', 'clients', 'INSERT'),
        ('authenticated has clients.UPDATE', 'authenticated', 'clients', 'UPDATE'),
        ('authenticated has clients.DELETE', 'authenticated', 'clients', 'DELETE'),
        ('authenticated has task_resources.DELETE', 'authenticated', 'task_resources', 'DELETE')
    ) as unexpected(description, role_name, table_name, privilege)
    where has_table_privilege(unexpected.role_name, 'public.' || unexpected.table_name, unexpected.privilege);

  if v_unexpected_grants is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO CONTINUE. Unexpected/over-broad grant(s) detected -- this file must never introduce these: %s.',
      array_to_string(v_unexpected_grants, ', ')
    );
  end if;
end;
$$;

select 'PHASE_8_MUTATION_PRIVILEGES_READY'::text as fixture_status;
