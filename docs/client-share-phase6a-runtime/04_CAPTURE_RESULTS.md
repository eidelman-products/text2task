# Client Share Link — Phase 6A Runtime Results

**Status: NOT YET RUN.** This package (files 01–03, `MANIFEST.md`, and
the generator that produced file 02) has been prepared and mechanically
verified (file 02 and `MANIFEST.md` are hash-consistent), but no file in
it has been executed against any Supabase project — disposable or
Production. This is a template to fill in once you do run it.

Return the completed version of this file (or paste the equivalent
results directly back into the conversation) before any full build,
commit, or Phase 6B work begins.

## Run log

| Run | Project | File 01 | File 02 | File 03 | Outcome |
|---|---|---|---|---|---|
| 1 | *(disposable project name here)* | *(pending)* | *(pending)* | *(pending)* | *(pending)* |

## Run 1

Disposable Supabase project: `___________________`. Confirmed **not**
the Text2Task production project, and **not** the existing Phase
1B/1C/2B/3 disposable project used for earlier Client Share evidence.

### Result from file 01 (`01_CREATE_TEMP_TEST_FIXTURE.sql`)

- Status: ☐ Succeeded ☐ Errored
- `fixture_status` value: `_______`

### Result from file 02 (`02_APPLY_CLIENT_SHARE_THROUGH_PHASE6A.sql`)

- Status: ☐ Succeeded ☐ Errored
- Final verification table: all rows `found = true`? ☐ Yes ☐ No
- If any row shows `found = false`, list it here: `_______`

### Result from file 03 (`03_RUN_PHASE6A_RUNTIME_TESTS.sql`)

- Status: ☐ `runtime_status = PHASE_6A_RUNTIME_PASS` ☐ `PHASE_6A_RUNTIME_FAIL` ☐ Errored before completing
- Total tests / Passed / Failed: `___ / ___ / ___`
- If `PHASE_6A_RUNTIME_FAIL` or any FAIL rows: paste the full FAIL-only
  table here, exactly as returned, including every `section`, `name`,
  `status`, and `detail` value:

  ```
  (paste FAIL rows here)
  ```

- If the run errored before reaching the summary (a raw PostgreSQL
  error, not a recorded FAIL row): paste the exact error text, and note
  which section/statement it occurred in, here:

  ```
  (paste exact error text here)
  ```

- Reached its own trailing `rollback;`? ☐ Yes ☐ No — not applicable if
  it errored before completing (an unhandled exception aborts the
  transaction automatically; run a standalone `ROLLBACK;` before
  retrying).

## Notes

- **Do not treat Phase 6A as runtime-verified until a run above reports
  `runtime_status = PHASE_6A_RUNTIME_PASS` with 0 failed.**
- If file 03 needs a correction (a harness-only defect, as opposed to a
  genuine finding about the migration itself), add a new "Run 2" section
  above following the same structure — do not overwrite Run 1's record.
- No Production project may be touched by any file in this package,
  regardless of outcome.
- A PASS result verifies Phase 6A's own database contract only. It does
  not authorize Phase 6B, a full build, a commit, a push, or any
  Production action — see `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.
