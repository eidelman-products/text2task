-- Text2Task Client Share Link -- Phase 6C Atomic Apply + Conversion Closure
-- Runtime Verification Package -- File 02
--
-- SOLE PURPOSE: prove the transaction-local capability GUC
-- (text2task.client_share_apply_update_id) does not survive a REAL
-- COMMIT -- the one property the main closure suite
-- (03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql) cannot itself prove, because
-- it deliberately never issues a real COMMIT (it always ends with
-- ROLLBACK, matching this whole package family's established "nothing
-- survives a run" safety discipline). An earlier version of this package
-- hardcoded a `true` PASS for this exact property inside the main suite
-- without ever executing a real COMMIT -- a second, final read-only
-- implementation-acceptance audit correctly flagged this as undocumented
-- and unproven. This file replaces that hardcoded claim with a real,
-- minimal, isolated test.
--
-- This file performs a REAL, ACTUAL COMMIT. It is the only file in this
-- entire Client Share runtime-package family that does. It is
-- deliberately isolated into its own tiny, single-purpose file rather
-- than folded into the main suite, so the main suite's own safety
-- discipline (nothing it creates ever survives a run) is never put at
-- risk by this one necessary exception.
--
-- NO APPLICATION DATA IS TOUCHED. No table is created, read, or written
-- (besides one session-local TEMP table used only to carry this file's
-- own precondition result across the COMMIT boundary -- plpgsql cannot
-- persist a variable across a real COMMIT any other way, since COMMIT is
-- not available inside a DO block/plpgsql function body at all; the
-- temp table is dropped again before this file ends, and would in any
-- case never be visible to any other session or role even if it were
-- not). This file only calls the built-in set_config/current_setting on
-- one custom GUC name -- it proves a generic PostgreSQL guarantee
-- (documented behavior of set_config(..., is_local=true): the value is
-- local to the transaction that set it and is discarded once that
-- transaction ends, whether by COMMIT or ROLLBACK) using the EXACT name
-- and mechanism Phase 6C's own migration uses, rather than merely citing
-- the Postgres documentation.
--
-- This file does not technically require the Phase 6C migration to be
-- installed (it never calls apply_project_update_transaction,
-- finalize_share_message_conversion, or the boundary trigger -- it tests
-- only the underlying Postgres/session mechanism those objects all rely
-- on), but it is still gated on the Phase 6A sentinel below, so it can
-- never be run against an unverified or wrong project by mistake, and
-- its own place in the run order (after migration application, before
-- the main closure suite) is kept simple and consistent -- see
-- 00_READ_ME_FIRST.md for the full sequence.
--
-- IMPORTANT: the post-COMMIT expected value is "not equal to the prior
-- test UUID" -- NOT necessarily NULL. Exact custom-GUC behavior after a
-- COMMIT can differ across Postgres/pooler configurations (NULL, empty
-- string, or some other reverted value); the actual security-relevant
-- invariant this file proves is strictly:
--   POST-COMMIT VALUE != THE PRIOR project_update id
-- which is exactly what the `is distinct from` comparison below checks
-- -- never a bare IS NULL check.
--
-- Never run this in the real Text2Task production project (even though
-- it touches no application data, it is scoped exclusively to this
-- package's own disposable-project workflow, and its safety gate below
-- refuses to run anywhere the Phase 6A sentinel is absent).

do $$
begin
  if to_regclass('public.text2task_client_share_phase6a_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 6A runtime test sentinel was not found. Run the Phase 6A runtime package first, and only ever inside a disposable Supabase project.';
  end if;
end;
$$;

-- Session-scoped TEMP table used ONLY to carry the pre-COMMIT precondition
-- result across the real COMMIT below. Dropped at the end of this file
-- (and would be dropped automatically at session end regardless, and is
-- never visible to any other session/role even while it exists) -- this
-- is not persistent application data.
create temporary table phase6c_capability_commit_scope_result (
  inside_transaction_matches boolean not null,
  cleared_after_commit boolean null
);

begin;

-- Deterministic, recognizable, test-only value -- never a real
-- project_update id, and never inserted into any application table by
-- this file. Any fixed, syntactically valid uuid literal would prove the
-- same property; this one is chosen only to be visually distinct from
-- every fixture id used elsewhere in this package.
select set_config(
  'text2task.client_share_apply_update_id',
  'c6c6c6c6-c6c6-4c6c-8c6c-c6c6c6c6c6c6',
  true
);

insert into phase6c_capability_commit_scope_result (inside_transaction_matches)
values (
  current_setting('text2task.client_share_apply_update_id', true)
    is not distinct from 'c6c6c6c6-c6c6-4c6c-8c6c-c6c6c6c6c6c6'
);

commit;

-- A real COMMIT has now occurred. Everything from here on runs in a NEW,
-- separate implicit transaction (standard Postgres/SQL-client behavior
-- once an explicit BEGIN/COMMIT pair has closed) -- exactly the scenario
-- this file exists to prove something about: does the capability value
-- set inside the now-closed transaction remain visible here?

update phase6c_capability_commit_scope_result
set cleared_after_commit = (
  current_setting('text2task.client_share_apply_update_id', true)
    is distinct from 'c6c6c6c6-c6c6-4c6c-8c6c-c6c6c6c6c6c6'
);

-- =========================================================
-- FINAL VERIFICATION (one row, one result set)
-- =========================================================

select
  inside_transaction_matches,
  cleared_after_commit,
  case
    when inside_transaction_matches and cleared_after_commit
      then 'PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS'
    else 'PHASE_6C_CAPABILITY_COMMIT_SCOPE_FAIL'
  end as status
from phase6c_capability_commit_scope_result;

drop table phase6c_capability_commit_scope_result;
