-- Text2Task Client Share Link -- Phase 6C Runtime Verification Package
-- File 01C: Extend the remaining reconciliation column
-- (public.tasks.is_archived) for a FULL successful Apply, plus a
-- comprehensive final dependency check
--
-- TEST-ONLY RUNTIME FIXTURE -- NOT A PRODUCTION MIGRATION
--
-- Run this AFTER 01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql and
-- 01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql have already been
-- applied in this disposable project. Never run this in the real
-- Text2Task production project.
--
-- WHY THIS IS A SEPARATE FILE, NOT AN EDIT TO 01:
--
-- Same reason as 01B: 01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql has its
-- own idempotency guard (a sentinel row) that refuses a second run in a
-- project where it already succeeded. This finding was discovered AFTER
-- that project had already run file 01 successfully -- this file is
-- purely additive, runnable once, standalone, with no reset required.
--
-- ROOT CAUSE (runtime attempt #2's actual finding): the SECOND real
-- execution of 03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql (after 01B's
-- grant/policy correction let it proceed past attempt #1's privilege
-- error) failed with
--
--   ERROR: 42703: column task.is_archived does not exist
--   CONTEXT: PL/pgSQL function public.reconcile_project_completion(
--            uuid,uuid,timestamptz) line 11 at SQL statement
--            called from public.apply_project_update_transaction(...)
--            at PERFORM
--
-- This is a genuine, second, INDEPENDENT disposable-fixture schema gap
-- from attempt #1's privilege gap -- not the same issue recurring, and
-- not a Phase 6C migration/application-code defect.
-- apply_project_update_transaction (unmodified by Phase 6C, from
-- 202607270001) calls reconcile_project_completion whenever any item was
-- accepted; that function's own body reads:
--
--   where task.project_id = p_project_id
--     and task.user_id = p_user_id
--     and (task.is_archived = false or task.is_archived is null)
--     and task.deleted_at is null
--
-- The Phase 6A fixture's own hand-authored public.tasks stand-in
-- (docs/client-share-phase6a-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql)
-- never carried an is_archived column at all -- it exists on that same
-- fixture's public.projects stand-in
-- (`is_archived boolean not null default false`), which is easy to
-- conflate with tasks needing the identical column, but the two are
-- independent tables with independently-defined columns; tasks' own
-- is_archived was never added, by either the Phase 6A fixture or Phase
-- 6C's own 01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql (which added
-- `archived_at` to tasks, a DIFFERENT column, but not `is_archived`
-- itself -- a genuine oversight in that file's own original column
-- audit, now corrected here).
--
-- EXHAUSTIVE RE-AUDIT (per the explicit instruction not to stop at this
-- one column): every `task.<column>`, `project.<column>`,
-- `v_project.<column>`, and `client.<column>` reference in
-- supabase/migrations/202607270001_project_completion_reconciliation.sql
-- was mechanically extracted (via repository grep, not memory), plus the
-- full explicit column list of that file's own `insert into
-- public.tasks (...)` statement (which uses bare column names, not a
-- `task.` prefix, for is_archived/archived_at/source/raw_input/
-- deleted_at/updated_at -- easy to miss with a naive alias-only search),
-- plus every column Phase 6C's own runtime file 03 inserts into
-- tasks/projects/clients in its own fixture setup. Cross-referencing the
-- complete union of all three sources against the current fixture
-- (Phase 6A's original columns + 01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql's
-- own additions) found exactly ONE remaining gap: public.tasks.is_archived.
-- No second or third missing column was found on tasks, projects, or
-- clients. The comprehensive final verification block below checks the
-- COMPLETE required column set for all three tables (not merely the one
-- column this file adds), specifically so a third missing column would
-- be caught here, statically, rather than at a later runtime attempt.
--
-- EVIDENCE for type/nullability: `(task.is_archived = false or
-- task.is_archived is null)` in reconcile_project_completion's own WHERE
-- clause proves both that the column is boolean (compared against the
-- literal `false`) AND that it is expected to be NULLABLE in real
-- production data (the function explicitly treats NULL as an alternative
-- valid state alongside `false`, not merely defensive/redundant code) --
-- unlike projects.is_archived, which the Phase 6A fixture already models
-- as `not null default false`. Modeled below as `boolean null`, matching
-- this evidence exactly -- not copying the stricter projects.is_archived
-- shape, since that would be a claim beyond what this specific column's
-- own evidenced usage supports. apply_project_update_transaction's own
-- `insert into public.tasks (..., is_archived, ...)` statement always
-- supplies the literal `false` explicitly for a new task it creates, so
-- no default value is required for that code path either.

do $$
begin
  if to_regclass('public.text2task_client_share_phase6c_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 6C base-table extension sentinel was not found. Run docs/client-share-phase6c-runtime/01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql first.';
  end if;
end;
$$;

-- =========================================================
-- The one missing column, added idempotently.
-- =========================================================

alter table public.tasks
  add column if not exists is_archived boolean null;

-- =========================================================
-- COMPREHENSIVE FINAL VERIFICATION (not part of any migration)
--
-- Checks the COMPLETE required column set for tasks/projects/clients --
-- everything Phase 6A's original fixture, 01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql,
-- and this file were each supposed to have already provided -- in one
-- place, so any gap (not only is_archived) fails loudly here rather than
-- resurfacing as a confusing mid-Apply runtime error on a future
-- attempt. This is the exhaustive re-audit described in this file's own
-- header, encoded as an executable check.
-- =========================================================

do $$
declare
  v_missing text[];
begin
  select array_agg(expected.qualified_column order by expected.qualified_column)
    into v_missing
    from (
      values
        -- public.tasks -- Phase 6A original + 01_EXTEND + 01C (this file)
        ('public.tasks', 'id'), ('public.tasks', 'user_id'),
        ('public.tasks', 'project_id'), ('public.tasks', 'deleted_at'),
        ('public.tasks', 'client_id'), ('public.tasks', 'client_name'),
        ('public.tasks', 'contact_name'), ('public.tasks', 'subtask_order'),
        ('public.tasks', 'task_title'), ('public.tasks', 'amount'),
        ('public.tasks', 'amount_value'), ('public.tasks', 'currency_code'),
        ('public.tasks', 'deadline_text'), ('public.tasks', 'deadline_date'),
        ('public.tasks', 'priority'), ('public.tasks', 'status'),
        ('public.tasks', 'source'), ('public.tasks', 'raw_input'),
        ('public.tasks', 'completed_at'), ('public.tasks', 'archived_at'),
        ('public.tasks', 'updated_at'), ('public.tasks', 'is_archived'),
        -- public.projects -- Phase 6A original + 01_EXTEND
        ('public.projects', 'id'), ('public.projects', 'user_id'),
        ('public.projects', 'deleted_at'), ('public.projects', 'is_archived'),
        ('public.projects', 'title'), ('public.projects', 'summary'),
        ('public.projects', 'client_id'), ('public.projects', 'client_name'),
        ('public.projects', 'contact_name'), ('public.projects', 'amount'),
        ('public.projects', 'amount_value'), ('public.projects', 'currency_code'),
        ('public.projects', 'deadline_text'), ('public.projects', 'deadline_date'),
        ('public.projects', 'priority'), ('public.projects', 'priority_source'),
        ('public.projects', 'status'), ('public.projects', 'source'),
        ('public.projects', 'raw_input'), ('public.projects', 'completed_at'),
        ('public.projects', 'archived_at'), ('public.projects', 'updated_at'),
        -- public.clients -- Phase 6A original + 01_EXTEND
        ('public.clients', 'id'), ('public.clients', 'user_id'),
        ('public.clients', 'project_id'), ('public.clients', 'name'),
        ('public.clients', 'contact_name'), ('public.clients', 'phone'),
        ('public.clients', 'email'), ('public.clients', 'notes')
    ) as expected(qualified_table, qualified_column)
    where not exists (
      select 1
      from information_schema.columns as col
      where col.table_schema = 'public'
        and col.table_name = split_part(expected.qualified_table, '.', 2)
        and col.column_name = expected.qualified_column
    );

  if v_missing is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO CONTINUE. Expected column(s) still missing after 01 + 01C: %s. This is the comprehensive cumulative check -- if it still fails, a new gap exists beyond both prior findings and must be re-audited against the authoritative RPC source, not patched blindly.',
      array_to_string(v_missing, ', ')
    );
  end if;
end;
$$;

select 'PHASE_6C_RECONCILIATION_COLUMNS_READY'::text as fixture_status;
