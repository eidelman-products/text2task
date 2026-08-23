# Client Share Link — Phase 6B DB Apply Boundary Runtime Verification Package

> **READ THIS FIRST**
>
> - **RUNTIME-VERIFIED.** Final run:
>   `prerequisite_status = PHASE_6B_APPLY_PREREQUISITE_READY`, then
>   `status = PHASE_6B_BOUNDARY_RUNTIME_PASS` — **29/29 tests passed, 0
>   failed**, `failed_test_details = (no failures)`. Full detail in
>   `02_CAPTURE_RESULTS.md`. This does **not** authorize Phase 6C, a full
>   build, a commit, a push, or any Production action.
> - Two earlier attempts were diagnosed and fixed along the way, neither
>   one evidence against the Phase 6B boundary migration itself (both are
>   preserved below and in `02_CAPTURE_RESULTS.md` for the record):
>   1. **Boundary suite attempt #1**: `PHASE_6B_BOUNDARY_RUNTIME_FAIL`,
>      25/27 passed. Both failures (`I1`, `K5`) — root cause: the real
>      `apply_project_update_transaction` RPC was never installed in the
>      disposable project (Phase 6A's own package deliberately excludes
>      it). See "Run 1: what went wrong" below.
>   2. **Prerequisite-package attempt #1** (installing the fix for #1):
>      **FAILED** with `ERROR 42703: column project.status does not
>      exist`. Root cause: the source migration's own trailing "one-time
>      historical backfill" statement — a plain top-level `UPDATE`, not
>      part of any function — was being bundled verbatim and executes
>      immediately, referencing a column the disposable fixture's minimal
>      `projects` stand-in does not carry. It has nothing to do with the
>      three functions this package actually needs. See "Prerequisite
>      attempt #1: what went wrong" below. **Fixed**: the generator now
>      omits that one statement (and only that one) from the bundle.
> - This package is deliberately small: it extends the **existing**
>   Phase 6A disposable runtime approach (`docs/client-share-phase6a-runtime/`)
>   rather than inventing a new one. It does **not** re-provision a fresh
>   Supabase project or re-bundle the fourteen Phase 6A source migrations.
>   Run it in the **same** disposable Supabase project the Phase 6A
>   package already used.
> - **Never** run any file here against the real Text2Task production
>   project.
> - Run in this exact order:
>   1. `docs/client-share-phase6a-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql`
>      (skip if that project already has it applied)
>   2. `docs/client-share-phase6a-runtime/02_APPLY_CLIENT_SHARE_THROUGH_PHASE6A.sql`
>      (skip if already applied)
>   3. The exact, unmodified contents of
>      `supabase/migrations/202608230001_client_share_apply_boundary.sql`
>      — paste and run it directly from that real migration file. This
>      package intentionally does **not** duplicate it as a separate
>      "apply" step file — the migration is small and self-contained, and
>      pointing at the real file avoids creating a second, driftable copy
>      for zero benefit. **The user has already applied this in the
>      current disposable project — do not reapply unless you rebuilt the
>      project from scratch.**
>   4. `00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql` (this
>      package's own file, **new** — this is the actual fix for Run 1's
>      two failures). Order relative to step 3 does not matter (see that
>      file's own header for why).
>   5. `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql` (this package's own
>      file, updated since Run 1 — see "What changed since Run 1" below)
> - **Stop immediately** if any step produces an unexpected error, and
>   report the exact error text rather than continuing or improvising a
>   fix inside the SQL Editor.
> - **Save the entire output** of file `01` — see `02_CAPTURE_RESULTS.md`
>   — and return it before any full build, commit, or Phase 6C work
>   begins. The final result row now includes a `failed_test_details`
>   column listing every FAIL's section/name/detail inline, since
>   Supabase's SQL Editor only displays the LAST statement's result set —
>   you no longer need to scroll up or re-run a separate query to see
>   what failed.
> - Delete the disposable Supabase project once you are done reviewing
>   the results (or keep it if you expect to extend this exact chain
>   further before Phase 6C).

## Run 1: what went wrong (and why it is not a boundary-migration finding)

The user ran `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql` against the
disposable project with only the Phase 6A package + `202608230001`
applied (steps 1–3 above, no step 4 — because step 4 did not exist yet
at that point). Result: `total_tests=27, passed_tests=25, failed_tests=2,
status=PHASE_6B_BOUNDARY_RUNTIME_FAIL`.

Both FAILs shared one root cause:

- **I1** (direct RPC precondition): `sqlstate=42883 sqlerrm=function
  public.apply_project_update_transaction(uuid, uuid, uuid[], uuid[],
  jsonb, jsonb) does not exist`.
- **K5** (RPC grant verification): `detail=NULL` (the grant query itself
  found nothing to report on, because the function was not installed).

**Root cause**: the Phase 6A disposable package
(`docs/client-share-phase6a-runtime/02_APPLY_CLIENT_SHARE_THROUGH_PHASE6A.sql`)
**deliberately excludes** every migration that only redefines
`apply_project_update_transaction` — that generator's own header comment
says so explicitly, because Phase 6A's own runtime tests never called
that RPC. Phase 6B's Sections I and K5 are the first runtime tests in
this whole migration-package family to actually call it, and nothing had
ever installed it in this disposable project. **This says nothing about
whether the Phase 6B boundary migration (`202608230001`) itself works —
it says the RPC it was being tested against was never present.** See
`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6B_IMPLEMENTATION_REPORT_2026-08-21.md`
for the full dependency trace.

## Prerequisite attempt #1: what went wrong (and why it is not a boundary-migration finding either)

The user ran the first version of
`00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql` against the
same disposable project (`202608230001` already successfully applied
beforehand). It failed:

```
ERROR 42703: column project.status does not exist
LINE: and project.status is distinct from 'Done'
```

**Exact object**: not any of the three functions. The failing statement
is `202607270001_project_completion_reconciliation.sql`'s own trailing
"One-time historical backfill" statement — a plain, standalone
`WITH eligible_projects AS (...) UPDATE public.projects ...`, the last
statement in that migration file, entirely outside any
`CREATE FUNCTION` body.

**Why it was validated immediately, while the three functions' own
identical-looking column references (e.g. `reconcile_project_completion`
also sets `status = 'Done'`) were not**: PL/pgSQL function bodies are
lazily compiled — Postgres stores them as text and does not resolve
their embedded SQL statements' column references against the live
catalog until the function is actually *called*, regardless of the
`check_function_bodies` setting (that setting only affects whether
`CREATE FUNCTION` runs `plpgsql_compile()` as a syntax pre-check; it does
not perform full semantic column-existence validation of embedded DML,
which is why forward-referencing a not-yet-created table/column inside a
function body is a completely ordinary, safe pattern). The backfill
statement is not inside any function — it is an ordinary top-level DML
statement, and Postgres parses and validates those against the live
schema immediately, the moment it runs. Since the Phase 6A disposable
fixture's `projects` stand-in only has
`id, user_id, deleted_at, is_archived, created_at` (by design — see
`docs/client-share-phase6a-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql`'s own
header), `project.status` does not exist there, and the statement fails.

**`SET LOCAL check_function_bodies = off` would NOT have fixed this** —
that setting is irrelevant to a top-level statement that isn't a function
body at all. It was investigated and explicitly ruled out for this
specific error (though it remains a legitimate, safe general PostgreSQL
technique for the unrelated "forward reference inside a function body"
problem it was designed for).

**Is this a finding about the Phase 6B boundary migration?** No — this
statement doesn't define any function, trigger, or grant; it is
unrelated to `apply_project_update_transaction`'s callable behavior. It
is a one-time PRODUCTION data fixup for projects that were already fully
completed by their subtasks before this migration first shipped — by its
own header comment, it is naturally idempotent and a no-op against any
project with no matching historical data, which describes every
disposable test project, including this one, by construction. Omitting
it from this runtime-only bundle changes nothing Phase 6B's own tests
exercise.

**Could the three functions have partially installed anyway?** Very
likely yes, though not confirmed with certainty (Supabase's SQL Editor
multi-statement execution/commit semantics for a script with no explicit
`BEGIN`/`COMMIT` were not assumed either way). It does not matter: every
statement in the corrected package (`CREATE OR REPLACE FUNCTION`,
`REVOKE ALL`, `GRANT EXECUTE`) is idempotent by construction, so re-running
the corrected file is safe and correct regardless of whether the prior
failed attempt left the functions already installed or rolled everything
back together.

**Fix**: the generator
(`scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1`)
now truncates the embedded bundle at that statement's own marker
comment, verified two ways: it throws if the marker ever goes missing
(the source migration's shape changed), and it independently re-reads
the real migration file from disk to confirm the embedded content is
genuinely a verbatim prefix of it — never a hand-edited substitute. The
three `CREATE OR REPLACE FUNCTION` statements themselves remain 100%
verbatim, character-for-character.

## What changed across both correction rounds

- **File 4, `00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql`**
  (new in round 1, corrected in round 2) — installs the real, current
  `apply_project_update_transaction` (plus its two sibling functions)
  from the one authoritative migration that actually needs applying, now
  truncated at its own trailing backfill statement (see "Prerequisite
  attempt #1" above). See that file's own header, and its generator's
  header comment, for the full "why only one migration, not all five
  historical ones" dependency analysis. Its own final result set is now
  a single row (`apply_rpc_exists`, `authenticated_execute`,
  `prerequisite_status`) instead of a multi-row table to interpret.
- **`01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql`**:
  - Its own safety gate now explicitly checks for the real RPC and fails
    with a clear, actionable message (naming file `00`) instead of
    letting Section I hit a raw `42883` deep into the run.
  - **K5** now checks the **exact six-argument signature**'s grant via
    `has_function_privilege(..., '...::regprocedure, 'EXECUTE')`, not a
    name-only match, so it cannot be satisfied by an unrelated
    same-named overload.
  - **Section I** gained two more assertions (**I5**: the `projects` row
    itself is byte-for-byte unmutated, compared by full row equality;
    **I6**: zero new `clients` rows) — the original I2/I3 already proved
    zero `project_timeline_events`/`tasks` mutation; these close the
    remaining "no project/client mutation" claim explicitly.
  - The final result set is now a single, self-diagnosing row (see
    above) instead of three separate statements.

## Why this package exists

The Phase 6B DB-boundary design audit established that the application
layer alone (the new guard in `app/api/project-updates/apply/route.ts`)
is not a complete boundary: `apply_project_update_transaction` is
`SECURITY INVOKER` with `EXECUTE` granted to `authenticated`, called by
the app using that same role's session client, and
`public.project_updates` carries an unrestricted
`auth.uid() = user_id` RLS policy with no column-level restriction. An
authenticated owner could, in principle, reach PostgREST directly and
attempt to place their own `client_share` row into `status = 'applying'`
or `'applied'` — either by a raw `UPDATE`, or, more subtly, by a raw
`INSERT` that fabricates a fully-formed row already at that status from
its very first moment of existence (which an UPDATE-only transition
guard would never see at all).

`supabase/migrations/202608230001_client_share_apply_boundary.sql` closes
this with one small, dedicated `BEFORE INSERT OR UPDATE` trigger,
`enforce_project_update_client_share_apply_boundary()`, that inspects
only `NEW` (never `OLD`, never `TG_OP`) and rejects any row where
`source_type = 'client_share'` and `status IN ('applying', 'applied')` —
so INSERT and UPDATE are guarded identically. This package proves that,
for real, against a real PostgreSQL engine, as the real `authenticated`
role.

Static, source-level proof already exists
(`supabase/migrations/202608230001_client_share_apply_boundary.test.ts`,
26/26 passing) — but static tests can only inspect the migration's
*text*, never prove PostgreSQL actually enforces it. This is that proof.

## What this package proves (and does not prove)

Eleven sections (A–K, `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql`)
against a real disposable PostgreSQL database, as the real `authenticated`
role:

1. **A** — a direct authenticated `UPDATE` attempting
   `analyzed → applying` (with a self-chosen `apply_attempt_id`) is
   rejected with the exact `PROJECT_UPDATE_SOURCE_NOT_APPLIABLE` error;
   the row stays `analyzed`; `apply_attempt_id` stays unchanged.
2. **B** — the same attack from `reviewed → applying` is rejected.
3. **C** (**mandatory** — this is the case a naive UPDATE-only guard
   would miss) — a direct `INSERT` of an otherwise **completely valid**
   client_share row (real unclaimed client-authored source message,
   `raw_input` exactly equal to its body, correct ownership/project) that
   tries to be born already at `status = 'applying'` is rejected, and no
   row is persisted at all.
4. **D** — the same direct-INSERT bypass at `status = 'applied'`.
5. **E** — normal client_share states (`draft`, `analyzed`) still insert
   and transition successfully; Phase 6A's own content-integrity trigger
   still independently rejects a body mismatch, proving this new
   migration did not replace or shadow it.
6. **F** — a `text` update's `analyzed → applying` Apply claim is
   completely unaffected.
7. **G** — the same for `image`.
8. **H** — normal `text`/`image` `applying → applied` remains allowed.
9. **I** — a direct call to `apply_project_update_transaction` against
   the client_share row (still `analyzed`, because Section A's own
   `applying` transition was rejected) fails with the RPC's own
   pre-existing `APPLY_ATTEMPT_MISMATCH`, with zero
   `project_timeline_events`/`tasks`/`clients` rows created and the
   `projects` row itself completely unmutated (full row equality).
10. **J** — an explicit, whole-database summary assertion: no
    `client_share` row anywhere in this run is in `applying`/`applied`.
11. **K** — trigger installation, `SECURITY INVOKER`, `search_path`, zero
    `EXECUTE` grants on the new function, and confirmation that
    `apply_project_update_transaction`'s own grant and
    `enforce_project_update_source_provenance` (Phase 6A) are both
    unmodified.

Ending in section **L**: a single PASS/FAIL verdict —
`PHASE_6B_BOUNDARY_RUNTIME_PASS (N / N tests passed)` or
`PHASE_6B_BOUNDARY_RUNTIME_FAIL`.

This package does **not** re-prove the rest of Phase 6A's own contract —
`docs/client-share-phase6a-runtime/` already did that, and this file's
own safety gate requires that package's sentinel to already be present.
It also does **not** prove anything about Phase 6C — no
`share_message_conversions` write, no `status = 'converted'` behavior,
no atomic Apply-and-convert logic exists yet to test.

## Step by step (corrected sequence, starting from the user's CURRENT disposable-project state)

Given the user has already applied steps 1–3 (Phase 6A's `01`+`02`, and
`202608230001`) in the existing disposable project:

1. Open that same project's SQL Editor (no need to recreate the project —
   nothing about either failure so far requires starting over).
2. Paste and run `00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql`
   in full (the corrected version — no longer includes the trailing
   backfill statement that caused the `42703` failure). Expect exactly
   one result row: `apply_rpc_exists = true`, `authenticated_execute =
   true`, `prerequisite_status = PHASE_6B_APPLY_PREREQUISITE_READY`.
3. Paste and run `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql` in full.
   Expect two scroll-back result tables (full results, FAIL-only — empty
   on success) followed by one final row reading
   `status = PHASE_6B_BOUNDARY_RUNTIME_PASS` with `failed_test_details =
   (no failures)`.
4. Save the complete output — see `02_CAPTURE_RESULTS.md`, "Final run (corrected package)" (already completed: `PHASE_6B_BOUNDARY_RUNTIME_PASS`, 29/29).
5. **Do not go further** (no Production application, no full build, no
   Phase 6C work) without returning these results first.
6. Delete the disposable Supabase project when done, or keep it if you
   expect to extend this same chain again before Phase 6C.

(For a brand-new disposable project, run the full original 1–5 sequence
listed at the top of this file instead.)

## What each file is

| File | What it is |
|---|---|
| `00_READ_ME_FIRST.md` | This file. |
| `00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql` | **Generated** by `scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1`, from the one authoritative migration (`202607270001_project_completion_reconciliation.sql`) that installs the real, current `apply_project_update_transaction`. Do not hand-edit — edit the source migration and re-run the generator. |
| `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql` | Hand-authored. Real PostgreSQL runtime behavior tests, sections A–L above. Fully self-contained (redefines its own `test_results`/`fixture_ids`/`record_result`/`act_as` scratch objects, matching the Phase 6A runtime package's own convention exactly, since `pg_temp` objects are session-scoped and do not carry over from an earlier file/session). Always rolls back — safe to re-run against the same disposable project. |
| `02_CAPTURE_RESULTS.md` | Record of what actually happened running this package: two diagnosed-and-fixed attempts, then the final clean run — `PHASE_6B_APPLY_PREREQUISITE_READY` + `PHASE_6B_BOUNDARY_RUNTIME_PASS` (29/29, 0 failed). |
| `MANIFEST.md` | File inventory and SHA-256 hashes. |
| `../../scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1` | The generator that produces file `00` and regenerates `MANIFEST.md`. Read-only against `supabase/migrations/`; never runs SQL; never connects to Supabase. |

This package deliberately has no `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`
of its own — the Phase 6A package's own file of that name already states
the governing rule for this entire migration chain, and nothing about
this package changes it: no migration in this repository is authorized
for Production application by virtue of a passing disposable-project
runtime result.
