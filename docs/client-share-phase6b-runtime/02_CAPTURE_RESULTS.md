# Client Share Link — Phase 6B DB Apply Boundary Runtime Results

**Status: RUNTIME-VERIFIED. `PHASE_6B_APPLY_PREREQUISITE_READY` + `PHASE_6B_BOUNDARY_RUNTIME_PASS` (29/29, 0 failed).** Two earlier attempts (boundary suite #1: FAIL 25/27; prerequisite package #1: failed to load) were both fully diagnosed as harness-only defects, corrected, and superseded by this clean run — see below for all three records.

The Phase 6B DB apply boundary (`supabase/migrations/202608230001_client_share_apply_boundary.sql`)
is now runtime-verified against a real disposable PostgreSQL database, as
the real `authenticated` role, including the mandatory Section C
direct-INSERT-at-`applying` bypass. This does **not** authorize Phase 6C,
a full build, a commit, a push, or any Production action — see the
Notes section below.

## Run log

| Attempt | Project | Prerequisite file 00 | File 01 | Outcome |
|---|---|---|---|---|
| Boundary suite #1 | user's disposable project | not yet created | 27 tests | FAIL (2/27) — root cause: real RPC not installed |
| Prerequisite package #1 | *(same project)* | errored (42703) | not reached | FAILED TO LOAD — root cause: unrelated trailing backfill statement |
| Final run (corrected package) | *(same project)* | `PHASE_6B_APPLY_PREREQUISITE_READY` | 29 tests | **`PHASE_6B_BOUNDARY_RUNTIME_PASS` (29/29, 0 failed)** |

## Boundary suite attempt #1 (FAIL — root cause identified, not a boundary-migration defect)

Disposable Supabase project: the same one already used for the Phase 6A
runtime package. Steps run: Phase 6A `01`+`02`, then
`supabase/migrations/202608230001_client_share_apply_boundary.sql`
(succeeded), then `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql` (as it
existed **before** either harness correction — no prerequisite file `00`
existed yet at this point).

### Result from file 01 (pre-correction version)

- Status: `PHASE_6B_BOUNDARY_RUNTIME_FAIL`
- Total tests / Passed / Failed: `27 / 25 / 2`
- FAIL rows, exactly as returned:

  ```
  seq=17  section=I
  name=I1: direct apply_project_update_transaction against the (still analyzed)
       client_share row fails with APPLY_ATTEMPT_MISMATCH
  detail=sqlstate=42883 sqlerrm=function public.apply_project_update_transaction(
       uuid, uuid, uuid[], uuid[], jsonb, jsonb
     ) does not exist

  seq=26  section=K
  name=K5: apply_project_update_transaction still has its own unchanged EXECUTE
       grant to authenticated (this migration did not touch it)
  detail=NULL
  ```

- Root cause (confirmed by direct inspection of
  `scripts/client-share/build-phase6a-runtime-package.ps1`'s own source
  file list and header comment): the Phase 6A disposable package
  deliberately never installs `apply_project_update_transaction` — Phase
  6A's own runtime tests never called it, so its five defining migrations
  (`202606150008`, `202606160001`, `202606160002`, `202607020005`,
  `202607270001`) were correctly out of scope for that package. Phase
  6B's Sections I and K5 are the first tests in this whole package family
  to call the RPC directly, and nothing had ever installed it here.
- **No evidence of a boundary-migration failure.** Every other section
  (A–H, J, K1–K4, K6 — 25/27) passed, including the mandatory Section C
  (direct-INSERT-at-`applying` bypass) and the UPDATE-attack Sections A/B.
  The two failures are both explained entirely by a missing prerequisite,
  not by the trigger misbehaving.
- Reached its own trailing `rollback;`: Yes (both failures were caught
  and recorded as FAIL rows via the `exception when others` blocks around
  each attempt, not an unhandled abort).

### Correction applied in response

- New file: `00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql`
  (generated), installing the real, current
  `apply_project_update_transaction` from
  `supabase/migrations/202607270001_project_completion_reconciliation.sql`
  alone. `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql` updated: safety gate
  checks for the real RPC explicitly; **K5** rewritten to check the exact
  six-argument signature's grant; **Section I** gained **I5**/**I6**
  (projects/clients unmutated); final result set consolidated into one
  self-diagnosing row.
- **No change was made to** `supabase/migrations/202608230001_client_share_apply_boundary.sql`,
  its trigger/function semantics, any Phase 6B application code, the
  Apply route/UI guard, or the Phase 6A provenance migration.

## Prerequisite package attempt #1 (FAILED TO LOAD — root cause identified, not a boundary-migration defect)

Same disposable project, `202608230001` already applied successfully.
Ran the first version of
`00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql` (produced by
the correction above).

### Result

- Status: **Errored**
- Exact error:

  ```
  ERROR 42703: column project.status does not exist
  LINE: and project.status is distinct from 'Done'
  ```

- **Exact object**: none of the three functions
  (`apply_project_update_transaction`, `reconcile_project_completion`,
  `apply_task_bulk_status_transaction`) — the failure is
  `202607270001_project_completion_reconciliation.sql`'s own trailing
  "One-time historical backfill" statement, a standalone top-level
  `WITH ... UPDATE public.projects ...`, entirely outside any
  `CREATE FUNCTION` body.
- **Why validated immediately**: PL/pgSQL function bodies are lazily
  compiled (their embedded SQL's column references are not resolved
  against the live catalog until the function is actually called,
  regardless of `check_function_bodies`); the backfill statement is an
  ordinary top-level DML statement, validated the moment it runs.
  `project.status` does not exist on the Phase 6A disposable fixture's
  intentionally minimal `projects` stand-in.
- **`check_function_bodies = off` investigated and explicitly ruled
  out**: it only affects `CREATE FUNCTION`'s own body pre-check; it has
  no effect on a top-level statement that is not a function body at all.
  It would not have fixed this error.
- **No evidence of a boundary-migration failure.** The backfill statement
  defines no function, trigger, or grant, and is unrelated to
  `apply_project_update_transaction`'s callable contract. It is a
  one-time PRODUCTION data fixup, naturally a no-op against any project
  with no matching historical data (true of every disposable test
  project by construction) — safe and correct to omit from this
  runtime-only bundle entirely.
- Whether the three `CREATE OR REPLACE FUNCTION` statements (which ran
  *before* the failing statement, in file order) survived this failed
  attempt was not assumed either way — not confirmed with certainty, and
  not load-bearing: every statement in the corrected package is
  idempotent by construction (`CREATE OR REPLACE`, `REVOKE ALL`,
  `GRANT EXECUTE`), so re-running it is safe and correct regardless.

### Correction applied in response

- `scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1`
  now truncates the embedded bundle at the backfill statement's own
  marker comment — verified two ways: throws if the marker ever goes
  missing, and independently re-reads the real migration file from disk
  to confirm the embedded content is genuinely a verbatim prefix of it.
  The three `CREATE OR REPLACE FUNCTION` statements remain 100%
  verbatim, character-for-character — no hand-written substitute RPC.
- `00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql` regenerated;
  its own final result set simplified to one row:
  `apply_rpc_exists`, `authenticated_execute`, `prerequisite_status`
  (uses `to_regprocedure()`, not a throwing `::regprocedure` cast, so it
  always returns a clean diagnostic row even if the RPC turns out still
  not to be installed, rather than erroring out again).
- **No change was made to** `supabase/migrations/202608230001_client_share_apply_boundary.sql`,
  its trigger/function semantics, any Phase 6B application code, the
  Apply route/UI guard, or the Phase 6A provenance migration.

## Final run (corrected package) — `PHASE_6B_BOUNDARY_RUNTIME_PASS`

Disposable Supabase project: the same one used for both prior attempts
(no rebuild was needed — see `00_READ_ME_FIRST.md`'s corrected
step-by-step sequence). Sequence run: the corrected
`00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql`, then the
corrected `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql` — `202608230001`
was not reapplied (not needed; already installed from the first pass).

### Result from file 00 (`00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql`, corrected version)

- Status: **Succeeded**
- Result row:

  ```
  apply_rpc_exists      = true
  authenticated_execute = true
  prerequisite_status   = PHASE_6B_APPLY_PREREQUISITE_READY
  ```

### Result from file 01 (`01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql`, corrected version)

- Status: **`status = PHASE_6B_BOUNDARY_RUNTIME_PASS`**
- Total tests / Passed / Failed: **`29 / 29 / 0`**
- Final result row:

  ```
  total_tests          = 29
  passed_tests          = 29
  failed_tests           = 0
  status                 = PHASE_6B_BOUNDARY_RUNTIME_PASS
  failed_test_details    = (no failures)
  ```

- Reached its own trailing `rollback;`: Yes — clean run, no exceptions
  aborted the transaction.
- All 29 tests passed, across every section: **A** (UPDATE attack,
  analyzed→applying, rejected), **B** (UPDATE attack,
  reviewed→applying, rejected), **C** — **the mandatory direct-INSERT-
  at-`applying` bypass, rejected**, **D** (direct-INSERT-at-`applied`
  bypass, rejected), **E** (normal draft/analyzed client_share states
  still work; Phase 6A content-integrity trigger still independently
  active), **F**/**G** (text/image Apply claims completely unaffected),
  **H** (normal text/image applying→applied remains allowed), **I**
  (direct RPC call against the still-`analyzed` client_share row fails
  with the RPC's own `APPLY_ATTEMPT_MISMATCH`, zero
  tasks/timeline/clients rows created, `projects` row byte-for-byte
  unmutated), **J** (whole-database summary: no client_share row
  anywhere ended up in applying/applied), **K1–K6** (trigger
  installation, `SECURITY INVOKER`, `search_path`, zero `EXECUTE`
  grants on the new function, exact-signature `authenticated` grant on
  the real RPC confirmed, Phase 6A's provenance trigger confirmed
  untouched).

## Notes

- **The Phase 6B DB apply boundary is now runtime-verified**: both the
  prerequisite package (`PHASE_6B_APPLY_PREREQUISITE_READY`) and the
  boundary suite (`PHASE_6B_BOUNDARY_RUNTIME_PASS`, 29/29, 0 failed)
  passed cleanly in the final run above.
- Section C (the direct-INSERT-at-`applying` bypass) — the single most
  important result in this file, the specific gap an UPDATE-only
  transition guard would have missed — passed in every attempt,
  including this final clean run.
- If a further correction is ever needed (a harness-only defect, as
  opposed to a genuine finding about a migration itself), add a new
  attempt section following the same structure — do not overwrite the
  records above.
- No Production project was touched by any file in this package, at any
  point.
- **A PASS result verifies this migration's own database contract
  only.** It does not authorize Phase 6C, a full build, a commit, a
  push, or any Production action — those each require their own
  separate authorization.
