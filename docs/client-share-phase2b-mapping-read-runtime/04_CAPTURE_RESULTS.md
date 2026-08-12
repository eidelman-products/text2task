# Client Share Link — Phase 2B Mapping-Read Corrective Foundation Runtime Results

**Phase 2B mapping-read runtime verification is COMPLETE: Run 1 below is
the final, authoritative result — `total_tests = 46, passed_tests = 46,
failed_tests = 0, runtime_status = PHASE_2B_MAPPING_RUNTIME_PASS`.**
Production was never accessed, and Production application remains NOT
AUTHORIZED regardless of this result — see
`05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.

## Run log

| Run | Date | Project | File 01 | File 02 | File 03 | Outcome |
|---|---|---|---|---|---|---|
| 1 | 2026-08-12 | `text2task-phase2b-runtime-temp` (disposable) | Succeeded | Succeeded | Failed at A/A1 (harness defect), corrected, re-run | `PHASE_2B_MAPPING_RUNTIME_PASS` — 46 total, 46 pass, 0 fail |

## Run 1 — 2026-08-12 (current, authoritative)

Disposable Supabase project `text2task-phase2b-runtime-temp`, created
solely for this Phase 2B corrective-foundation runtime verification.
Confirmed **not** the Text2Task production project.

Executed as the `postgres` role in the Supabase SQL Editor, in order:
file 01, then file 02, then file 03 (first attempt failed on a harness
defect, corrected, then re-run to completion — see "Harness defect and
correction" below).

### Result from file 01 (`01_CREATE_TEMP_TEST_FIXTURE.sql`)

- Status: ☑ Succeeded ☐ Errored (`fixture_status = READY`)

### Result from file 02 (`02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql`)

- Status: ☑ Succeeded ☐ Errored
- Final verification table: all rows `found = true`? ☑ Yes ☐ No — every
  Client Share table, trigger, and RPC row returned `found = true`,
  including `get_share_link_management_state(uuid)`,
  `save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)`,
  `title_visible`, `status_visible`, `target_date_visible`.

### Complete result from file 03 (`03_RUN_PHASE2B_MAPPING_READ_RUNTIME_TESTS.sql`)

**First attempt (pre-correction): FAILED at test A/A1.**

- Error: `PHASE2B_EXPECTED_SUCCESS_FAILED: A/A1: draft creation on
  project A1 did not PASS ... status = FAIL, detail = expected success,
  got SQLSTATE P0001: INVALID_PUBLIC_ID`.
- Root cause: a runtime-harness-only defect, not a product or migration
  defect — see "Harness defect and correction" below.
- No fixture row or test-only helper object survived this failed attempt:
  the failure raised out of the file's own `begin;`-opened transaction
  before reaching any `commit;` (this script never issues one), so
  nothing from this attempt was persisted.

**Second attempt (post-correction): PASS.**

- Status: ☑ `runtime_status = PHASE_2B_MAPPING_RUNTIME_PASS` ☐ `PHASE_2B_MAPPING_RUNTIME_FAIL` ☐ Errored before completing

- Total tests / Passed / Failed:
  - total_tests: 46
  - passed_tests: 46
  - failed_tests: 0

- Isolated FAIL-row evidence: none — the FAIL-only table was empty. No
  runtime failure occurred on the corrected run.

- Did the script reach its PASS path and execute the explicit trailing
  `rollback;`? ☑ Yes — no fixture row or test-only helper object this
  file created was committed or survives. Files 01/02's own committed
  schema/grants/RLS/sentinel are untouched by that rollback; only what
  file 03's own transaction did (its shared fixture data and every
  Section A–M action) was undone.

- Full result table: not individually transcribed here (46 PASS rows);
  the summary row above is the authoritative outcome.

- Screenshot filename (if any): _(none recorded)_

### Harness defect and correction

Before the corrected run, the first attempt at file 03 failed
immediately at Section A (`A1`, draft creation) with `SQLSTATE P0001:
INVALID_PUBLIC_ID`. Read-only inspection traced this to a **test-harness
defect, not a product or migration defect**:

- `create_share_link_draft(uuid,text)`
  (`202608060001_client_share_lifecycle_operations.sql`) requires
  `p_public_id` to match `^[A-Za-z0-9_-]{24}$` — exactly 24 characters.
- Section A1's original literal, `phase2bMappingRuntimeA1Lnk1`, was
  mechanically verified to be **27 characters**, failing that check.
- **Fix**: the literal was corrected to `phase2bMapReadA1Link0001` —
  mechanically verified to be exactly 24 characters and to match the
  required regex. This is the exact same class of defect (and fix
  pattern) as the Phase 1C runtime harness's own B1 correction
  (`docs/client-share-phase1c-runtime/`) — `create_share_link_draft`
  itself was not touched, and no product/migration validation was
  weakened.
- No other public-id literal exists anywhere else in file 03 (audited
  and confirmed — `create_share_link_draft` is called exactly once).

**File 02 / migration-hash consistency, mechanically verified**: after
correcting file 03 and regenerating the package
(`build-phase2b-mapping-read-runtime-package.ps1`),
`02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql` hashed to the exact same
value as before the correction
(`90528cbfb690b99e4a6ceab64bf04a59dd18aea4ddf66a425906f4a83739dd55`), and
all nine source-migration hashes were unchanged — because file 02 is
built only from the nine migrations, never from file 03, and none of the
migrations were touched. Only `MANIFEST.md` and file 03 itself changed
hash. The disposable project did not need to be recreated: files 01 and
02 had already committed their effects outside file 03's own
transaction, and the failed first attempt at file 03 left nothing
committed (see above), so the corrected file 03 was simply re-run in the
same disposable project to produce the final `PHASE_2B_MAPPING_RUNTIME_PASS`
result recorded above.

## Notes

- No Production project was touched at any point. Production application
  of `202608110002_client_share_management_mapping_metadata.sql` (or any
  Client Share migration) remains a separate, explicit, later decision —
  this result does not authorize it.
- If this package is ever rerun again in the future (for example, after
  a genuine subsequent change to migration `202608110002` or to file 03
  itself), add a new `Run 2` section above following the same structure,
  and update the summary line at the top of this file to point at
  whichever run is then current and authoritative.
