# Client Share Link — Phase 1B Runtime Results

**Phase 1B runtime verification is COMPLETE: Run 2 below is the final,
authoritative result — `total_tests = 520, passed_tests = 520,
failed_tests = 0, runtime_status = PHASE_1B_RUNTIME_PASS`.** Run 1 is kept
below as historical record of the first complete runtime execution (518
tests, 8 failures) and the four root causes it exposed, all now corrected.
Production was never accessed in either run, and Production application
remains NOT AUTHORIZED regardless of this result — see
`05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.

## Run log

| Run | Date | Project | File 01 | File 02 | File 03 | Outcome |
|---|---|---|---|---|---|---|
| 1 | 2026-08-09 | (first disposable project) | Succeeded | Succeeded | Completed | `PHASE_1B_RUNTIME_FAIL` — 518 total, 510 pass, 8 fail |
| 2 | 2026-08-10 | `text2task-client-share-runtime-temp` (fresh) | Succeeded | Succeeded | Completed | `PHASE_1B_RUNTIME_PASS` — 520 total, 520 pass, 0 fail |

## Run 2 — 2026-08-10 (current, authoritative)

Temporary Supabase project name: `text2task-client-share-runtime-temp`.
Confirmed **not** the Text2Task production project, and a **different,
freshly-created** project from the one used in Run 1 — required because
Run 1's corrections changed the authoritative migration contents
(`202608030003`, `202608060002`), and Run 1's own project already had the
old, pre-correction schema/RPC bodies baked into its live database
objects.

Executed as the `postgres` role in the Supabase SQL Editor, in order:
file 01, then file 02 (regenerated from the corrected migrations), then
file 03 (corrected for the K7 fixture isolation and the O1 NULL-safe
comparison).

### Result from file 01 (`01_CREATE_TEMP_TEST_FIXTURE.sql`)

- Status: ☑ Succeeded (`fixture_status = READY`)  ☐ Errored

### Result from file 02 (`02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql`)

- Status: ☑ Succeeded  ☐ Errored
- Final verification table: all rows `found = true`? ☑ Yes  ☐ No (list which)

### Complete result from file 03 (`03_RUN_PHASE1B_RUNTIME_TESTS.sql`)

- Status: ☑ `runtime_status = PHASE_1B_RUNTIME_PASS`  ☐ `PHASE_1B_RUNTIME_FAIL`  ☐ Errored before completing

- Total tests / Passed / Failed:
  - total_tests: 520
  - passed_tests: 520
  - failed_tests: 0

- The script reached its PASS path and executed the explicit trailing
  `rollback;` — no fixture row or test-only helper object this file
  created was committed or survives. Files 01/02's own committed
  schema/grants/RLS/sentinel are untouched by that rollback; only what
  file 03's own transaction did (its shared fixture data and every
  Section A-R action) was undone.

- Full result table: not individually transcribed here (520 PASS rows);
  the summary row above is the authoritative outcome. Paste the full
  table here if a durable per-row record is ever needed.

- Screenshot filename (if any): _(none recorded)_

**Whitespace-only source cleanup, byte-exact reconfirmation.** After the
520/520/0 result above, a `git diff --check` commit-gate pass found one
defect: a stray extra blank line at the end of file 03, unrelated to
runtime behavior. That line was removed, `git diff --check` then passed
cleanly, and the cleaned file 03 was rerun as-is against the same
disposable Supabase project (`text2task-client-share-runtime-temp`). It
again produced the identical `total_tests = 520, passed_tests = 520,
failed_tests = 0, runtime_status = PHASE_1B_RUNTIME_PASS` result. This was
a source-formatting correction, not a product/runtime defect, and is not
listed as a separate historical failure run — its purpose is to confirm
the file 03 now tracked in the repository (SHA-256 recorded in
`MANIFEST.md`) is itself, byte-for-byte, the file that was runtime
verified.

This Run 2 result is what changed this package's status to
`PHASE_1B_RUNTIME_VERIFIED_PASS` in
`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_RUNTIME_VERIFICATION_REPORT.md`.

## Run 1 — 2026-08-09 (historical, superseded)

Kept as the record of the first complete runtime execution and the four
root causes it found — not a currently outstanding failure. All four are
corrected in the migrations/harness that Run 2 above verified.

Temporary Supabase project name: the first disposable project used for
this package (superseded — do not reuse; its live schema/RPC bodies still
reflect the pre-correction migrations). Confirmed **not** the Text2Task
production project.

### Result from file 01 (`01_CREATE_TEMP_TEST_FIXTURE.sql`)

- Status: ☑ Succeeded (`fixture_status = READY`)  ☐ Errored

### Result from file 02 (`02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql`)

- Status: ☑ Succeeded  ☐ Errored
- Final verification table: all rows `found = true`? ☑ Yes  ☐ No (list which)

### Complete result from file 03 (`03_RUN_PHASE1B_RUNTIME_TESTS.sql`)

- Status: ☐ `runtime_status = PHASE_1B_RUNTIME_PASS`  ☑ `PHASE_1B_RUNTIME_FAIL`  ☐ Errored before completing

- Total tests / Passed / Failed:
  - total_tests: 518
  - passed_tests: 510
  - failed_tests: 8

- Isolated FAIL-row evidence (all 8), as captured from the final guard's
  embedded `FAILS=[...]` report:

  | test_number | section | test_name | expected | actual (summary) |
  |---|---|---|---|---|
  | 353 | J | J3 | success | SQLSTATE 23514, `project_share_links_secret_digest_consistency_check` violated |
  | 354 | J | J3-shape | revoked | (empty — cascaded from J3's failed RPC call) |
  | 355 | J | J3-version | 2 | 1 (cascaded — no mutation persisted) |
  | 356 | J | J3-event | 1 | 0 (cascaded — no mutation persisted) |
  | 388 | K | K7 | SQLSTATE P0001 / `SHARE_LINK_REVOKED` | SQLSTATE P0001 / `PROJECT_ARCHIVED` (fixture reused K6's already-archived project) |
  | 452 | O | O1-unchanged | no change | before/after snapshots were actually identical, but NULL-sensitive `=` on a NULL field made the boolean evaluate NULL, recorded as FAIL |
  | 484 | P | P5setup | success | SQLSTATE P0001, `SHARE_LINK_ROTATION_TIMESTAMP_REQUIRED` (second same-transaction rotation computed an identical `now()`) |
  | 485 | P | P5 | not equal (stale) | observed not equal — false, cascaded from P5setup's failed rotation never bumping `configuration_version` |

- Root-cause classification (full analysis in the runtime verification
  report and in this session's history):
  - **Product defects (2)**: J3 — `project_share_links_secret_digest_consistency_check`
    did not allow a never-activated draft to reach `state = 'revoked'`.
    P5setup — `rotate_share_link_secret` derived `rotated_at` from the
    transaction-fixed `now()`, so two rotations of the same link inside
    one transaction could collide.
  - **Harness defects (2)**: K7 — accidentally reused a link whose
    project K6 had just archived, so it could only prove
    `PROJECT_ARCHIVED`, never `SHARE_LINK_REVOKED`. O1-unchanged — plain
    `row(...) = row(...)` is NULL-sensitive.
  - **Cascade failures (4)**: J3-shape, J3-version, J3-event, P5 — all
    resolved automatically once their respective root cause was fixed.

- Corrections applied (all verified by Run 2 above):
  - `supabase/migrations/202608030003_client_share_owner_foundation.sql`
    — widened the digest-consistency constraint to also allow a
    never-activated revoked link.
  - `supabase/migrations/202608060002_client_share_access_operations.sql`
    — `rotate_share_link_secret` now computes a strictly monotonic
    `rotated_at` via `clock_timestamp()` floored to `previous + 1
    microsecond`.
  - `docs/client-share-phase1b-runtime/03_RUN_PHASE1B_RUNTIME_TESTS.sql`
    — K7 now uses an isolated, non-archived, dedicated revoked-link
    fixture; O1-unchanged now uses `IS NOT DISTINCT FROM`.

On a PASS run, the script's own final `rollback;` statement is reached and
executed. On a FAIL run, the final guard's raised exception puts the open
transaction into a failed/aborted state before that statement is ever
reached — it is `ROLLBACK` (or the connection closing) that ends the
transaction and discards its uncommitted work, not the exception itself
and not this file reaching any particular line. Either way, no fixture
row created by this file is ever committed or persists in the disposable
project. Production was never accessed in any run.

## Notes

Anything unexpected, confusing, or worth flagging before this goes back
for review:

- Two runtime attempts against Run 1's project failed before reaching any
  product assertion at all, due to PostgreSQL parser/type-resolution
  defects in the harness itself (`name[] = text[]` in a structural
  primary-key check; an ambiguous `attnum` reference in a structural
  foreign-key check). Both were fixed before Run 1's own 518-assertion
  result above was obtained; they are not part of the 8 failures listed.
- If this package is ever rerun again in the future (for example, after a
  genuine subsequent change to any of the seven authoritative migrations
  or to file 03 itself), add a new `Run 3` section above following the
  same structure, and update the summary line at the top of this file to
  point at whichever run is then current and authoritative.
