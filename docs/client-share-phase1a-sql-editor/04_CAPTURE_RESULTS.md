# Client Share Link — Phase 1A SQL Editor Results

Fill this in as you go, or paste the raw SQL Editor output directly back
into your ChatGPT/Claude conversation instead — either is fine.

## Run log

| Run | Date | Project | File 01 | File 02 | File 03 | Outcome |
|---|---|---|---|---|---|---|
| 1 | 2026-08-04 (reported) | `text2task-phase1a-temp-test` (org: Text2Task Temp Tests — FREE) | Succeeded (`fixture_status = READY`) | Succeeded (10 tables / 9 functions / 13 triggers all `found = true`) | **Did not complete** | See "Run 1" record below. Runtime PASS/FAIL was **not achieved** — no final result table was produced and the test transaction did not commit (it cannot; the script ends in `ROLLBACK`, and this run aborted before reaching it). |
| 2 | 2026-08-04 (reported) | same `text2task-phase1a-temp-test` project (files 01/02 **not** rerun; only file 03 rerun, after the `require_id` correction) | Not rerun this run — see Run 1's result, unchanged | Not rerun this run — see Run 1's result, unchanged | **Did not complete** | See "Run 2" record below. The new fail-closed `require_id` guard worked and exposed L1's real recorded result: `status: FAIL`, `detail: expected success, got SQLSTATE P0001: SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED`. Runtime PASS/FAIL was **still not achieved**. |
| 3 | 2026-08-04 (reported) | same `text2task-phase1a-temp-test` project, running the OLD (pre-correction) package (files 01/02 **not** rerun; only file 03 rerun, now carrying the `require_test_pass`/E18 guard) | Not rerun this run — see Run 1's result, unchanged | Not rerun this run — see Run 1's result, unchanged (**this project's applied migration 003 still has the old, invalid `{32,512}` constraint** -- see Notes) | **Did not complete** | See "Run 3" record below. The new fail-closed E18 guard worked and exposed the actual source defect: `status: FAIL`, `detail: expected success, got SQLSTATE 2201B: invalid regular expression: invalid repetition count(s)`. Root cause confirmed and migration 003 corrected in this pass (not yet re-verified at runtime). Runtime PASS/FAIL was **still not achieved**. |
| 4 | 2026-08-05 (reported) | **fresh, clean** `text2task-phase1a-temp-test-v2` project -- files 01, the **regenerated** file 02 (corrected migration 003), and 03 all run in order for the first time against this clean database | Succeeded (`fixture_status = READY`) | Succeeded (10 tables / 9 functions / 13 triggers all `found = true`) | **Completed: `runtime_status = PASS`** | See "Run 4" record below. **`total_tests = 207, passed_tests = 207, failed_tests = 0`.** Phase 1A's first successful clean-database runtime validation. The transaction rolled back as designed; no fixture rows persisted; production was never accessed. This does not, by itself, authorize production application (see `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`). |

This was the **first real execution** of this package against an actual,
disposable Supabase project. It was not simulated and it did not touch
the Text2Task production project. **As of Run 4, the package has
achieved a full PASS against a clean disposable database.**

---

## Run 1 — 2026-08-04

Date run: 2026-08-04

Temporary Supabase project name: `text2task-phase1a-temp-test`
(organization: "Text2Task Temp Tests — FREE"). Confirmed **not** the
Text2Task production project.

### Result from file 01 (`01_CREATE_TEMP_TEST_FIXTURE.sql`)

- Status: ☑ Succeeded (`fixture_status = READY`)
- Exact error message (if any): none.

### Result from file 02 (`02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql`)

- Status: ☑ Succeeded
- Final verification table: all rows returned `found = true` — 10 tables,
  9 functions, 13 triggers, matching the exact expected set.
- Exact error message (if any): none.

### Complete result from file 03 (`03_RUN_PHASE1A_RUNTIME_TESTS.sql`)

- Status: ☑ Errored before completing (not "raised an exception" in the
  file's own controlled sense -- see below -- and not `runtime_status =
  PASS`)
- Total tests / Passed / Failed: **not available.** The script aborted
  before reaching the final result table, so no `total_tests` /
  `passed_tests` / `failed_tests` summary was ever produced.
- Full result table: not available for the same reason.
- Exact error message observed:

  ```
  ERROR: 23502: null value in column "value" of relation "_fixture_state"
  violates not-null constraint
  DETAIL: Failing row contains (grant_1_id, null).
  CONTEXT: SQL function "set_val" statement 1
  SQL statement "SELECT pg_temp.set_val('grant_1_id', v_grant_1::text)"
  PL/pgSQL function inline_code_block line 23 at PERFORM
  ```

- Interpretation (see the package report's correction-pass section for
  the full analysis): this is a **secondary** error, not the real one.
  L1 ("valid grant for a live session and active, PIN-protected link at
  the exact current version succeeds") is an expected-success test.
  `try_stmt` itself already caught and recorded L1's real outcome
  correctly. The bug was in the unguarded code immediately after L1: a
  `SELECT ... INTO v_grant_1` that assumed the insert had succeeded, then
  handed a NULL `v_grant_1` straight to `pg_temp.set_val('grant_1_id',
  ...)`, whose `_fixture_state.value` column is `NOT NULL`. That produced
  this masking 23502 error instead of surfacing L1's actual recorded
  SQLSTATE and message. **The actual reason L1's insert did not create a
  row is still unknown** and will only be known once a fail-closed guard
  (now added -- see the report) exposes L1's real recorded `status` and
  `detail` on the next run.

- Screenshot filename (if any): (none provided in this session)

---

## Run 2 — 2026-08-04

Date run: 2026-08-04

Temporary Supabase project name: same `text2task-phase1a-temp-test`
project as Run 1 (organization: "Text2Task Temp Tests — FREE").
Confirmed **not** the Text2Task production project.

Files 01 and 02 were **not rerun** for this run -- only file 03 (after
the `require_id` correction from the prior pass) was rerun against the
project's already-established state from Run 1. That is a legitimate
way to iterate on file 03 alone: file 03 runs entirely inside its own
`BEGIN; ... ROLLBACK;`, so nothing it did in Run 1 persisted, and the
files 01/02 baseline (fixture + applied migrations) was untouched and
still valid.

### Result from file 01

- Status: not rerun this run. Unchanged from Run 1 (☑ Succeeded,
  `fixture_status = READY`).

### Result from file 02

- Status: not rerun this run. Unchanged from Run 1 (☑ Succeeded, all 10
  tables / 9 functions / 13 triggers `found = true`).

### Complete result from file 03

- Status: ☑ Errored before completing (stopped cleanly on the new
  fail-closed `require_id` guard immediately after L1 -- not a raw,
  unguarded PostgreSQL error the way Run 1's was)

- Total tests / Passed / Failed: **not available.** The script stopped
  at the guard immediately after L1, before reaching the final result
  table, so no `total_tests` / `passed_tests` / `failed_tests` summary
  row was ever produced.

- Full result table: not available for the same reason. (The individual
  A-K section results, and L1's own recorded row inside `_test_results`,
  existed in-session at the moment of the stop, but the script never
  reached the point where it prints the full table -- only the guard's
  own exception message, below, was surfaced.)

- Exact error message observed:

  ```
  ERROR: P0001: PHASE1A_SETUP_DEPENDENCY_FAILED: L/L1: expected a share_session_grants row for session_1/link_e1 row to exist after this expected-success step, but none was found. Recorded result for L/L1 -- status: FAIL, detail: expected success, got SQLSTATE P0001: SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED
  ```

- Interpretation (see the package report's section 24 for the full
  analysis): the `require_id` guard did exactly what it was built to
  do -- it stopped the script immediately at L1 instead of letting a
  NULL id cascade into a secondary, masking error the way Run 1's did,
  and it surfaced L1's real, previously-hidden recorded outcome:

  - L1 ("valid grant for a live session and active, PIN-protected link
    at the exact current version succeeds") is an expected-success test
    that supplies a non-null `pin_verified_at`.
  - It actually failed with SQLSTATE P0001,
    `SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED`, raised by
    `enforce_share_session_grant_integrity()` in
    `202608030005_client_share_integrity_and_security.sql` whenever the
    trigger computes `v_link_requires_pin = false` (i.e.
    `link.pin_hash is null`) for a grant that supplies a non-null
    `pin_verified_at`.
  - This proves `link_e1.pin_hash` was actually NULL at the moment L1
    ran, even though E18 ("PIN v1 profile with correct parameters
    succeeds") is the step in Section E specifically intended to make
    `link_e1` PIN-protected before Section L runs.
  - **This does not yet prove *why* -- only that E18's intended
    persisted state (a PIN-protected `link_e1`) was not actually in
    place by the time L1 ran.** It is consistent with E18 itself having
    failed (and Run 2's harness not yet checking for that, since this
    was the first run after only the `require_id` fix, not yet the
    `require_test_pass` fix), or with some other still-unidentified gap
    between E18 and L1. The prior harness had no guard immediately after
    E18, so if E18 had failed, nothing would have stopped the script
    there or reported it -- it would have silently continued and only
    surfaced, indirectly, three sections later at L1.
  - The correction made in this pass (see the package report's section
    24) adds exactly that missing guard: an immediate, fail-closed
    `pg_temp.require_test_pass('E', 'E18', ...)` PASS check plus a
    direct state verification of `link_e1`'s PIN columns, both placed
    immediately after E18 and before any later section. **The actual
    reason `link_e1` was not PIN-protected at L1 is still unknown** and
    will only be known once this new guard exposes E18's real recorded
    SQLSTATE/message (if E18 itself failed) or confirms E18 passed but
    the state check itself fails (if the failure is somewhere else
    entirely) on the next real runtime execution (Run 3).
  - Do not treat Run 2 as evidence that the migrations are broken. It
    proves only that `link_e1` was not PIN-protected at L1 -- it does
    not yet identify why.

- Screenshot filename (if any): (none provided in this session)

---

## Run 3 — 2026-08-04

Date run: 2026-08-04

Temporary Supabase project name: same `text2task-phase1a-temp-test`
project as Runs 1 and 2 (organization: "Text2Task Temp Tests — FREE").
Confirmed **not** the Text2Task production project.

Files 01 and 02 were **not rerun** for this run -- only file 03 (now
carrying the `require_test_pass` guard and the E18 double-guard from the
prior correction pass) was rerun against the project's already-
established state from Run 1. **Important:** this means Run 3 exercised
file 03 against the OLD (pre-correction) applied migration 003 --
the one still containing the invalid `{32,512}` PIN-encoding constraint
-- because files 01/02 were not reapplied in this project after the fix
made in this pass. The disposable project's schema was not, and could
not have been, affected by this correction pass, since this pass
executed no SQL and accessed no Supabase project.

### Result from file 01

- Status: not rerun this run. Unchanged from Run 1 (☑ Succeeded,
  `fixture_status = READY`).

### Result from file 02

- Status: not rerun this run. Unchanged from Run 1 (☑ Succeeded, all 10
  tables / 9 functions / 13 triggers `found = true`). **This applied
  copy of migration 003 still has the old, invalid
  `project_share_links_pin_encoding_check` -- it predates this
  correction pass's fix and was not reapplied.**

### Complete result from file 03

- Status: ☑ Errored before completing (stopped cleanly on the new
  fail-closed `require_test_pass('E', 'E18', ...)` guard immediately
  after E18 -- exactly as designed, and three sections earlier than
  Run 2's stop at L1)

- Total tests / Passed / Failed: **not available.** The script stopped
  at the guard immediately after E18, before reaching the final result
  table, so no `total_tests` / `passed_tests` / `failed_tests` summary
  row was ever produced.

- Full result table: not available for the same reason.

- Exact error message observed:

  ```
  ERROR: P0001: PHASE1A_EXPECTED_SUCCESS_FAILED: E/E18: PIN setup for link_e1 did not PASS, so its downstream dependents cannot be trusted to run against the state they assume. Recorded result for E/E18 -- status: FAIL, detail: expected success, got SQLSTATE 2201B: invalid regular expression: invalid repetition count(s)
  ```

- Interpretation (see the package report's section 25 for the full
  analysis): the E18 guard did exactly what it was built to do -- it
  stopped the script immediately at E18 instead of letting the failure
  cascade silently through to L1 three sections later the way Run 2's
  did, and it surfaced E18's real, previously-hidden recorded outcome.

  **Confirmed root cause:** `project_share_links_pin_encoding_check` (in
  the version of migration 003 applied to this disposable project during
  Run 1/2's file 02 execution) used the regex bound `pin_hash ~
  '^[A-Za-z0-9_-]{32,512}$'`. PostgreSQL's regex engine only supports
  repetition-count bounds from 0 through 255 -- `512` is out of range, so
  the CHECK expression itself cannot be evaluated for ANY non-null
  `pin_hash`, and PostgreSQL raises SQLSTATE 2201B ("invalid regular
  expression: invalid repetition count(s)") the instant a row with a
  non-null `pin_hash` is checked against it, regardless of what that
  value actually is.

  This explains the complete runtime chain across all three runs:
  1. E18 attempted to set `link_e1`'s PIN profile (a non-null
     `pin_hash`).
  2. `project_share_links_pin_encoding_check` evaluated the invalid
     `{32,512}` regex.
  3. E18's `UPDATE` failed with SQLSTATE 2201B.
  4. `link_e1` remained non-PIN (`pin_hash` stayed `NULL`).
  5. Run 2's script continued unguarded past E18 and later reached L1,
     which supplied a non-null `pin_verified_at` for a link the trigger
     now (correctly) computed as not requiring one, producing
     `SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED`.
  6. Run 3's new E18 guard correctly stopped immediately at E18 and
     exposed the real cause instead of the L1 symptom.

  **This is a real migration defect, not a harness defect.** The fix
  applied in this pass (see the package report's section 25) replaces
  the invalid regex-bound length check with an explicit
  `char_length(...) between ...` clause, preserving the exact intended
  semantics (32-512 chars for `pin_hash`, 16-128 for `pin_salt`, Base64url
  character set only) without relying on a regex repetition bound above
  255.

  **This has not yet been re-verified at runtime.** No SQL was executed
  and no Supabase project was accessed during this correction pass. The
  next real validation step is regenerating a **fresh** disposable
  Supabase project and running files 01, 02 (now carrying the corrected
  migration 003), and 03 against it -- re-running only file 03 against
  the OLD project (as Run 2 and Run 3 both did) would exercise the OLD,
  still-broken applied schema and prove nothing about the fix.

- Screenshot filename (if any): (none provided in this session)

---

## Run 4 — 2026-08-05

Date run: 2026-08-05

Temporary Supabase project name: `text2task-phase1a-temp-test-v2`
(a fresh, clean disposable project -- **not** the same project Runs 1-3
used, and confirmed **not** the Text2Task production project). This run
used the **regenerated** `02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql`, rebuilt
from the corrected migration 003 (the seventh correction pass's fix to
`project_share_links_pin_encoding_check`).

Execution order: 01_CREATE_TEMP_TEST_FIXTURE.sql, then the corrected
02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql, then
03_RUN_PHASE1A_RUNTIME_TESTS.sql -- run against a clean database for the
first time, exactly as the prior pass's notes required.

### Result from file 01

- Status: ☑ Succeeded (`fixture_status = READY`)
- Exact error message (if any): none.

### Result from file 02 (regenerated, corrected migration 003)

- Status: ☑ Succeeded
- Final verification table: all rows returned `found = true` -- 10
  tables, 9 functions, 13 triggers, matching the exact expected set.
- Exact error message (if any): none.

### Complete result from file 03

- Status: ☑ `runtime_status = PASS`

- Total tests / Passed / Failed:
  - total_tests: **207**
  - passed_tests: **207**
  - failed_tests: **0**

- Full result table: not individually re-transcribed row-by-row into
  this document; the reported summary (`total_tests = 207, passed_tests
  = 207, failed_tests = 0, runtime_status = PASS`) is the authoritative
  result. **This is exactly the expected count, not an unexplained
  figure.** `03_RUN_PHASE1A_RUNTIME_TESTS.sql` contains 144 direct
  `perform pg_temp.try_stmt(...)` call sites and 64 textual occurrences
  of `perform pg_temp.record_result(...)`; of those 64, exactly 1 (the
  line inside `try_stmt`'s own function body, where it records its own
  outcome) is not an independent assertion -- it is the mechanism by
  which each of the 144 `try_stmt` calls records its result. That leaves
  144 + 63 = **207** independent assertion call sites, which is exactly
  what Run 4 produced. A prior naive grep-based count of 208 (144 +
  64, without excluding that one helper-internal line) was not an
  accurate assertion-call-site total -- see the package report's section
  27 for the full reconciliation.

- Exact error message (if the script raised or errored before the
  summary row appeared): none -- the script ran to completion and
  reached its own final result query.

- Screenshot filename (if any): (none provided in this session)

As with every prior run, the script's own transaction ended in
`ROLLBACK` (file 03 always ends this way by design), so none of the
fixture rows it created persisted in `text2task-phase1a-temp-test-v2`.
Production was never accessed.

**This is Phase 1A's first successful clean-database runtime
validation.** It confirms the migration 003 fix works as intended and
that every other guarded expected-success dependency in the file also
held. **It does not, by itself, authorize applying these migrations to
the Text2Task production project** -- production application is a
separate, explicit decision and step that this result does not make on
its own (see `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`).

---

## Notes

Anything unexpected, confusing, or worth flagging before this goes back
for review:

- Run 1 confirms files 01 and 02 (pre-correction) are correct and
  complete AS APPLIED, but Run 3 later proved migration 003 itself
  contained a real defect that files 01/02's own structural verification
  (table/function/trigger existence only) could not have caught -- see
  below.
- Run 1's own error was secondary/masking (a NULL id handed to
  `set_val`), not L1's real outcome -- see Run 1's record above.
- Run 2, after the `require_id` correction, exposed L1's real recorded
  outcome: `SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED`, proving
  `link_e1.pin_hash` was NULL at L1. Run 2 did not yet identify why.
- Run 3, after the `require_test_pass`/E18 guard correction, exposed the
  real underlying cause: SQLSTATE 2201B, "invalid regular expression:
  invalid repetition count(s)", raised by
  `project_share_links_pin_encoding_check`'s invalid `{32,512}` regex
  bound. **This is a confirmed real migration defect**, not a test
  harness defect -- PostgreSQL's regex engine does not support
  repetition bounds above 255, so that constraint could never have
  accepted any non-null `pin_hash`, in this project or in production.
- Migration 003 was corrected after Run 3 (explicit
  `char_length(...) between ...` bounds instead of an out-of-range regex
  bound; see the package report's section 25) and file 02 /
  `MANIFEST.md` were regenerated/updated accordingly. **This fix has
  since been verified at runtime by Run 4** (below), which passed
  cleanly against a brand-new disposable database. The Run 3 transaction
  rolled back, as it always does, and did not itself exercise the fix
  (it ran against the old, unfixed project) -- Run 4 is what actually
  verified the fix. Production was never accessed, in any run.
- The disposable Supabase project used for Runs 1-3
  (`text2task-phase1a-temp-test`) still has the OLD, invalid constraint
  applied (files 01/02 were never rerun there after the fix) -- that
  project was never used again after Run 3. **Run 4 used a separate,
  fresh, clean disposable project** (`text2task-phase1a-temp-test-v2`),
  exactly as this note previously required, and passed: `total_tests =
  207, passed_tests = 207, failed_tests = 0, runtime_status = PASS`.
- **Runtime PASS has now been achieved** (Run 4, 2026-08-05), against a
  clean disposable database, after the migration 003 fix. This is
  Phase 1A's first successful clean-database runtime validation. It does
  **not**, by itself, authorize applying these migrations to the
  Text2Task production project -- production application remains a
  separate, explicit decision and step
  (`05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`).
- The real, runtime-executed result count is **207** (`total_tests` from
  Run 4), and this is now a fully explained, exact match, not an
  approximation. `03_RUN_PHASE1A_RUNTIME_TESTS.sql` contains 144 direct
  `try_stmt` call sites and 64 textual `record_result(` occurrences; one
  of those 64 (inside `try_stmt`'s own function body) is the helper's
  internal mechanism for recording its own outcome, not a separate,
  independent assertion. Excluding it leaves 63 independent
  `record_result` assertion call sites, and 144 + 63 = **207** -- exactly
  Run 4's `total_tests`. There is no unexplained difference, no
  mutually-exclusive-branch hypothesis needed, and no missing or
  non-executed assertion. An earlier naive grep of "208" (144 try_stmt +
  64 record_result, without excluding the one helper-internal line) was
  not a valid assertion-call-site total; it is superseded by this
  reconciliation for every purpose.
