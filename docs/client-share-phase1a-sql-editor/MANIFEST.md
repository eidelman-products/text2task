# Client Share Link — Phase 1A SQL Editor Package Manifest

Generated: 2026-08-04
Regenerated: 2026-08-04 (correction pass -- migration 003's
`project_share_links_pin_encoding_check` fixed; see the package report's
section 25)
Runtime-verified: 2026-08-05 (Runtime Run 4 -- `runtime_status = PASS`,
207/207, against a clean disposable database; see the package report's
section 27 and `04_CAPTURE_RESULTS.md`'s Run 4 record)
Repository HEAD at generation time: `93d6a8374dff1c53735b6962826a0fd1d14144e8`
Branch: `main`

## Package files

| File | Purpose |
|---|---|
| `00_READ_ME_FIRST.md` | Non-developer step-by-step instructions. |
| `01_CREATE_TEMP_TEST_FIXTURE.sql` | Fail-closed safety check, sentinel, minimal test-only base schema, two deterministic auth.users test identities. Hand-written. |
| `02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql` | Mechanically generated bundle: safety preamble + the three current Phase 1A source migrations, copied verbatim at generation time and in order + a structural verification query. |
| `03_RUN_PHASE1A_RUNTIME_TESTS.sql` | Real PostgreSQL behavior tests (permissions, RLS, constraints, triggers, cascades) inside `BEGIN; ... ROLLBACK;`. Hand-written. |
| `04_CAPTURE_RESULTS.md` | Result-recording template. |
| `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` | Explains why passing this package does not authorize production application. |
| `MANIFEST.md` | This file. |
| `../../scripts/client-share/build-phase1a-sql-editor-package.ps1` | The generator that produced file 02. Outside this directory because it is a script, not a package artifact, per the task's file allowlist. |
| `../TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1A_SQL_EDITOR_PACKAGE_REPORT.md` | The task's implementation report. Outside this directory for the same reason. |

## Source migration hashes (SHA-256 of file contents, LF-normalized)

| File | SHA-256 |
|---|---|
| `supabase/migrations/202608030003_client_share_owner_foundation.sql` | `05a3d2c91f99022131982816fee445598a32e22b99000557aff1d52ef967cc52` (changed -- PIN encoding CHECK fixed) |
| `supabase/migrations/202608030004_client_share_session_foundation.sql` | `e0cfff71635e32968ee21b7470dafc8075b6ca5b271aaab352af26705a70cdb9` (unchanged) |
| `supabase/migrations/202608030005_client_share_integrity_and_security.sql` | `1574b6ea45218219751e70fbbbe32ac8636e090f6955631449829a4ac1edc12d` (unchanged) |

Prior (pre-correction) hash of migration 003, for reference:
`17dfd9579ba13eaf627396ec01bc093064357a2d1c19e2575c88c2e075d881d5`. That
version contained the invalid `{32,512}` regex repetition bound in
`project_share_links_pin_encoding_check`; see the package report's
section 25.

## Generated bundle hash

| File | SHA-256 |
|---|---|
| `docs/client-share-phase1a-sql-editor/02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql` | `b8680b0f967fb5f04b4a5ed38295cf1dc0ca87a893e28c6a97faad3952a3f96d` (changed -- regenerated from the corrected migration 003) |

Prior (pre-correction) hash of file 02, for reference:
`17194644800977f1c71debe20284b96d448a3144e30a246bec6b96d976c18b4d`.

To reproduce or re-verify these hashes, run:

```
powershell -File scripts/client-share/build-phase1a-sql-editor-package.ps1
```

The generator recomputes and prints all four hashes on every run, and
mechanically verifies (raising an error if not true) that each of the
three source migrations appears in the generated bundle **exactly once**
and in the order 003, then 004, then 005.

## Confirmations

- **The generator itself is read-only and did not modify any source
  migration.** It only reads the three source files (`Get-Content
  -LiteralPath ... -Raw`) and normalizes line endings in an in-memory
  copy used to build the bundle; it never writes to any file under
  `supabase/migrations/`. This remains true across every run of the
  generator, including the one that regenerated this bundle from the
  corrected migration 003 (see the next point).
- **Migration 003 was intentionally modified by hand during the seventh
  correction pass**, to fix a confirmed runtime defect:
  `project_share_links_pin_encoding_check` used the regex bound
  `{32,512}`, which exceeds PostgreSQL's regex engine's supported
  repetition-count range of 0-255 and raised SQLSTATE 2201B for any
  non-null `pin_hash` (proven by Runtime Run 3 -- see the package
  report's section 25 and `04_CAPTURE_RESULTS.md`'s Run 3 record). The
  fix replaced the invalid regex bound with an explicit
  `char_length(...) between ...` clause. The generator was then run
  once, unmodified, to regenerate file 02 from the corrected migration.
  **Migrations 004 and 005 remained byte-identical and unchanged**
  throughout -- their hashes above are identical before and after this
  correction. Both the old (pre-correction) and new (current) hashes of
  migration 003 and file 02 are recorded together in the "Source
  migration hashes" and "Generated bundle hash" sections above, so the
  change is fully auditable from this file alone.
- File 02 contains migration 003, then 004, then 005, each exactly once,
  verified mechanically by the generator script itself (`Order
  verification passed: 003, then 004, then 005, each exactly once.`,
  printed on every run) and re-checked independently during package
  validation (see the package report).
- **SQL execution history:** file 01 and the pre-fix version of file 02
  were each executed once manually by the user in the disposable,
  non-production Supabase project (`text2task-phase1a-temp-test`).
  File 03 was executed three times against that same project as Runtime
  Runs 1-3, with corrected runtime-harness versions used between those
  runs. Files 01 and 02 were not rerun during Runs 2 or 3. Production
  was never accessed.

  All execution was performed directly by the user through the Supabase
  Dashboard SQL Editor, not by this agent or through any tool available
  to this agent.

  **Runtime Run 4 (2026-08-05) then executed the regenerated file 02
  (containing the corrected migration 003), together with files 01 and
  03, against a fresh, clean disposable project
  (`text2task-phase1a-temp-test-v2`) -- not the project Runs 1-3 used.**
  File 01 succeeded (`fixture_status = READY`); file 02's structural
  verification returned `found = true` for all 10 tables, 9 functions,
  and 13 triggers; file 03 completed with `runtime_status = PASS`
  (`total_tests = 207, passed_tests = 207, failed_tests = 0`). File 03's
  transaction ended in `ROLLBACK` as designed, so no fixture rows
  persisted. Production was never accessed. This confirms the migration
  003 fix at runtime, against a real, clean PostgreSQL database, for the
  first time. **This does not, by itself, authorize applying these
  migrations to the Text2Task production project** -- production
  application remains a separate, explicit decision and step (see
  `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`). No production
  credential or project reference appears anywhere in this package.
