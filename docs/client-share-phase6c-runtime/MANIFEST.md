# Client Share Link — Phase 6C Atomic Apply + Conversion Closure — Runtime Package Manifest

Every file in this package is hand-authored (no generator was warranted for this small a package — the Phase 6C *migration itself* has its own dedicated, mechanical generator, `scripts/client-share/build-phase6c-apply-conversion-closure-migration.ps1`, which this package's own prerequisite step 5 applies verbatim from its real location rather than duplicating). Hashes below are computed directly from the files as written; re-verify with `sha256sum <file>` (or PowerShell's `Get-FileHash -Algorithm SHA256`) at any time.

**Revision note (runtime attempts #1–#6)**: six real disposable-project runs of the main closure suite. Attempts #1–#5 all failed before the main suite produced results, none a Phase 6C migration or application-code defect; **attempt #6, after all five corrections, PASSED** (`total_tests=79`, `passed_tests=79`, `failed_tests=0`, `status=PHASE_6C_CLOSURE_RUNTIME_PASS`). The dedicated real-COMMIT capability test (`02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql`) also passed (`status=PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS`) — full results for both in `04_CAPTURE_RESULTS.md`.
- **#1**: `42501 permission denied for table projects` (missing `authenticated` grants/RLS policies) → corrected by `01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql`.
- **#2**: `42703 column task.is_archived does not exist` (a second, independent schema gap — `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql`'s own original column audit missed this one column on `tasks`) → corrected by `01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql`.
- **#3**: `P0001 SHARE_CONVERSION_ACTOR_NOT_AUTHENTICATED` — a **runtime-harness fault-injection bug**, not a fixture privilege/schema gap: `ATOMIC_FAILURE`'s own test-only pre-insert into `share_message_conversions` never established `auth.uid()` before writing, so the real, unmodified `enforce_share_message_conversion_integrity()` trigger correctly rejected it → corrected **in place** inside `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` itself. The same review also found and fixed a latent baseline bug in the same two sections (shared `project_a` state contamination from the earlier `SUCCESS` section, defeating the rollback proof).
- **#4**: `42501 permission denied for table share_messages` — a **runtime-harness fixture-construction bug**, not a privilege gap to grant around: `PROVENANCE/P3` needed an owner-authored fixture message and used a raw `authenticated` INSERT, but `authenticated` genuinely has no direct INSERT grant on `share_messages` in the real schema — every owner write goes through the existing `SECURITY DEFINER` RPC `send_share_message_reply`. **This denial is the real privilege boundary working correctly.** → corrected **in place** inside `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` (P3 now calls the real RPC), with a fail-closed fixture-validity check and the RPC added to the suite's own startup safety gate.
- **#5**: `P0001 SHARE_MESSAGE_CLIENT_LINK_NOT_ACTIVE` — a **runtime-harness fixture-construction bug**, not a Production defect: `HISTORY` tried to author a brand-new client message on `link_revoked`, a link created already-`revoked` at fixture-setup time — `enforce_share_message_integrity()`'s own `author_type='client'` branch unconditionally requires `link.state='active'` at INSERT time, so that INSERT could never have succeeded. → corrected **in place**: `HISTORY` now sends its client message and reserves its `project_update` on a dedicated, genuinely-active link, THEN revokes that link through the real owner RPC `public.revoke_share_link`, THEN runs the real Apply RPC — proving the real invariant ("a message retained from an active link survives the link later being revoked"), not the impossible one. The same audit pass (performed exhaustively across all 16 `pg_temp.new_client_message` call sites, per explicit instruction not to stop at the one reported symptom) found and fixed a second, independent, not-yet-triggered latent bug: `COMPLETION_RECONCILIATION` authored its message through the shared `link_active` (belonging to `project_a`) while the message's own `project_id` was a different, dedicated completion project — a guaranteed `SHARE_MESSAGE_PROJECT_MISMATCH` on the very next attempt. Corrected with its own dedicated, project-matched link. The same pass also removed one fake hardcoded-`true` `REGRESSION`/`REG-NOTE` row (converted to a comment) and added a real image-source (`source_type='image'`) Apply regression, since only text coverage existed.

The `01B`/`01C` correction files are separate, additive files rather than edits to `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql`, specifically so the already-run file 01 (whose own idempotency guard blocks a second run) never needs to be reset. Attempts #3, #4, and #5's corrections required no new numbered file — all are entirely internal to `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql`. See `00_READ_ME_FIRST.md`'s own "Runtime attempt history" section and `04_CAPTURE_RESULTS.md` for the full root-cause trace and evidence for all six attempts.

## Package files

| # | File | Origin | SHA-256 |
|---|---|---|---|
| 1 | `00_READ_ME_FIRST.md` | hand-authored | `e7307926d81f73068e9141f36b0a6c75dfc4e0ce74a58ac8d6124e38fb03ff35` |
| 2 | `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql` | hand-authored (unchanged since attempt #1's revision; proven incomplete on its own by attempt #2 — see file 4) | `49a9596e363e4a01478ed39e6f4a91f744d0a26b0d3923e29e22f0949a3c9a77` |
| 3 | `01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql` | hand-authored (attempt #1 correction; already run successfully) | `f11e83812ea6c7102cc9e932b37eb93a625a8ed06f230162a48c760494c1b82d` |
| 4 | `01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql` | hand-authored (attempt #2 correction; already run successfully) | `aac5a4e4535936676d0fce9153e5b844e9f188a6052366ce7bdc46aed5bea54f` |
| 5 | `02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql` | hand-authored (unchanged; already run successfully) | `7d29ef0e2dc6887b4b48d07813c7228682b143cb909a1c941d86721dd2efa779` |
| 6 | `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` | hand-authored (corrected — attempts #3, #4, and #5's fixes, in place; run to completion and PASSED on attempt #6) | `41ee854d7b32d33f29805744659977641abfbbf34c3eca9be9a95b12ee176f99` |
| 7 | `04_CAPTURE_RESULTS.md` | hand-authored (new — the recorded, final results for steps 9 and 10) | `b608508f9fa9a3a4b1c4b7f54aaabcf738418b58d745f78a965fa94a99423804` |
| 8 | `MANIFEST.md` | hand-authored (this file) | *(intentionally not embedded — self-referential fixed point)* |

**Note on files 2/3/4's unchanged hashes**: `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql`, `01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql`, and `01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql` were not touched in this revision — all three already ran successfully in the user's disposable project and must not be re-run there.

## Migration this package exercises

Applied by run-order step 5 (see `00_READ_ME_FIRST.md`), pasted verbatim from its own real location — never duplicated into this package.

| Migration | SHA-256 (full file) |
|---|---|
| `supabase/migrations/202608230002_client_share_apply_conversion_closure.sql` | `36f9209b2e17cad19a8aa8c5a279fb74d2de880a790df3fd67a9eecba4d6db65` |

Its own three reconstructed-from-source functions, and their individual authoritative sources, are hashed and verified independently in that migration's own static test file (`supabase/migrations/202608230002_client_share_apply_conversion_closure.test.ts`), not repeated here.

## Prerequisite migrations this package assumes (applied directly from their own real locations, per run-order steps 3 and 4)

| Migration / package file | Role |
|---|---|
| `supabase/migrations/202608230001_client_share_apply_boundary.sql` | Phase 6B boundary trigger (narrowed in place by step 5, never dropped) |
| `docs/client-share-phase6b-runtime/00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql` | Installs the real, current `apply_project_update_transaction` from `202607270001` |

## To reproduce or re-verify these hashes

```
sha256sum docs/client-share-phase6c-runtime/00_READ_ME_FIRST.md
sha256sum docs/client-share-phase6c-runtime/01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql
sha256sum docs/client-share-phase6c-runtime/01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql
sha256sum docs/client-share-phase6c-runtime/01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql
sha256sum docs/client-share-phase6c-runtime/02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql
sha256sum docs/client-share-phase6c-runtime/03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql
sha256sum docs/client-share-phase6c-runtime/04_CAPTURE_RESULTS.md
```

## Confirmations

- Nothing in this package has been executed by Claude. Running SQL, even against a disposable project, remains a user-owned action. Six real attempts of the main suite (recorded in `00_READ_ME_FIRST.md` and `04_CAPTURE_RESULTS.md`) were run by the user; the first five failed and were each corrected in turn, and the sixth **passed** (`total_tests=79`, `passed_tests=79`, `failed_tests=0`).
- No Production project URL, project reference, credential, or environment value appears anywhere in this package.
- `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql`, `01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql`, `01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql`, and `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` are all additive/self-contained — none modifies any file under `docs/client-share-phase6a-runtime/` or `docs/client-share-phase6b-runtime/`, and none modifies the Phase 6C production migration, its generator, or any application code. In particular, attempt #3's fix does not modify `enforce_share_message_conversion_integrity()`, attempt #4's fix does not modify `share_messages`' grants/RLS or `send_share_message_reply`, and attempt #5's fix does not modify `enforce_share_message_integrity()` or `revoke_share_link` — all are production, unmodified; every fix corrects only the test-only fixture code to use the real, existing, correct paths.
- `01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql`'s `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is naturally idempotent; its final verification block checks the complete cumulative required column set (not merely the one column it adds) across `tasks`/`projects`/`clients`.
- `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` is wrapped in `begin;` / `rollback;` — nothing it creates survives a run, pass or fail (all five failures occurred inside that same open transaction and were discarded on abort; attempt #6's own PASS ran the block through to its own explicit trailing `rollback;`). It issues no real `COMMIT` anywhere. Its confirmed `total_tests` on the passing attempt #6 run was **79**, matching the mechanically recomputed expected count exactly (75 after attempt #4's correction, +2 for `HISTORY`'s new `H0`/`H2`, +1 for `COMPLETION_RECONCILIATION`'s new `CR0B`, +1 net for `REGRESSION` -- the fake `REG-NOTE` row removed, `REG3`/`REG4` image-regression assertions added).
- `02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql` is the sole exception: it issues one real `COMMIT`, touches no application table, and is gated on the Phase 6A sentinel exactly like every other file in this package. Run successfully, `status=PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS`.
- CAP-G's result lives **only** in `02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql`'s own one-row result — `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` does not insert any row for it into its own `test_results` table. Both results are now recorded in `04_CAPTURE_RESULTS.md`.
