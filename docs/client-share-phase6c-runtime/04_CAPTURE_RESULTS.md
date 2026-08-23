# Client Share Link — Phase 6C Runtime Results

**Status: RUN — PASS.** Both required runtime results for this package are now recorded: the dedicated real-COMMIT capability test (step 9) and the main always-ROLLBACK closure suite (step 10). This is the completed, filled-in version of this file — not a template.

Both results were run by the user, in the same disposable Supabase project used throughout this package's development, against the same, unmodified `supabase/migrations/202608230002_client_share_apply_conversion_closure.sql` (hash `36f9209b2e17cad19a8aa8c5a279fb74d2de880a790df3fd67a9eecba4d6db65`, confirmed unchanged throughout).

## Result from step 9 (`02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql`)

- Status: ☑ Succeeded
- `inside_transaction_matches`: `true`
- `cleared_after_commit`: `true`
- `status`: `PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS`

This is the sole evidence for the property that the row-bound `text2task.client_share_apply_update_id` capability GUC does not survive a real `COMMIT` — the main suite (step 10) deliberately never commits, so this file is the only real-COMMIT proof in the whole package.

## Result from step 10 (`03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql`) — run log, all six attempts

| Attempt | Outcome | Failure point | Root cause | Correction |
|---|---|---|---|---|
| 1 | FAILED BEFORE TEST AGGREGATION | first real Apply, inside `apply_project_update_transaction` | `42501 permission denied for table projects` — disposable fixture never granted `authenticated` INSERT/UPDATE/DELETE on `projects`/`tasks`/`clients` | `01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql` |
| 2 | FAILED BEFORE TEST AGGREGATION | `SUCCESS` section's Apply, inside `reconcile_project_completion` | `42703 column task.is_archived does not exist` — a second, independent fixture schema gap | `01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql` |
| 3 | FAILED BEFORE TEST AGGREGATION | `ATOMIC_FAILURE`'s own fault-injection pre-insert | `P0001 SHARE_CONVERSION_ACTOR_NOT_AUTHENTICATED` — pre-insert ran with `auth.uid()` null; real trigger correctly rejected it | actor context fixed (`pg_temp.act_as('postgres', v_owner_a)`); latent `ATOMIC_FAILURE`/`ATOMIC_FAILURE_MESSAGE_UPDATE` baseline-contamination bug fixed in the same pass (dedicated projects, exact-restoration assertions) |
| 4 | FAILED BEFORE TEST AGGREGATION | `PROVENANCE/P3`'s owner-authored fixture message | `42501 permission denied for table share_messages` — fixture used a raw `authenticated` INSERT; `authenticated` has no such grant in the real schema | `P3` now calls the real `send_share_message_reply` RPC instead |
| 5 | FAILED BEFORE TEST AGGREGATION | `HISTORY`'s client-message fixture setup | `P0001 SHARE_MESSAGE_CLIENT_LINK_NOT_ACTIVE` — `HISTORY` tried to author a message on a link already `state='revoked'` at fixture-setup time | `HISTORY` rewritten onto its own dedicated project/link: message authored while active, THEN revoked via the real `revoke_share_link` RPC, THEN Apply; latent `COMPLETION_RECONCILIATION` link/project-mismatch bug fixed in the same audit pass; fake `REGRESSION`/`REG-NOTE` row removed; image-source Apply regression (`REG3`/`REG4`) added |
| **6** | **PASS** | — | — | — |

### Attempt #6 — final result

```
total_tests         = 79
passed_tests         = 79
failed_tests         = 0
status               = PHASE_6C_CLOSURE_RUNTIME_PASS
failed_test_details  = (no failures)
```

`total_tests=79` matches the mechanically recomputed expected count exactly (75 after attempt #4's correction, +2 for `HISTORY`'s new `H0`/`H2`, +1 for `COMPLETION_RECONCILIATION`'s new `CR0B`, +1 net for `REGRESSION` — the fake `REG-NOTE` row removed, `REG3`/`REG4` image-regression assertions added). Every section (`SUCCESS`, `REJECT_ONLY`, `ATOMIC_FAILURE`, `ATOMIC_FAILURE_MESSAGE_UPDATE`, `CAP` A–H, `APPLYING` I–J, `APPLIED_EXISTING` K, `TERMINALITY`, `IDEMPOTENCY`, `PROVENANCE`, `HISTORY`, `COMPLETION_RECONCILIATION`, `REGRESSION` including the new image coverage) ran to completion and the file reached its own trailing `rollback;` — no artifact from this run persists, by the same always-rollback discipline as every prior (failed) attempt.

CAP-G is, as designed, not part of this count — it is an informational comment pointing to step 9's own separate result, never inserted into `test_results` (see `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql`'s own CAP-G comment).

## Combined evidence total

**80 executed runtime assertions/evidence points**: 79 main-suite `PASS` rows (step 10) + 1 dedicated real-COMMIT `PASS` (step 9).

## Notes

- **Phase 6C is now runtime-verified**: both `PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS` (step 9) and `PHASE_6C_CLOSURE_RUNTIME_PASS` (step 10, 79/79) are recorded, with 0 failures across both.
- **This does not mean `PHASE_6C_COMPLETE`.** Outstanding before that status may be claimed: the user's own full production build must pass, a final `git diff`/`git status` review must be done, and the work must be committed. None of that has happened yet — see `00_READ_ME_FIRST.md`'s own status line and the implementation report's status section.
- None of the five failed attempts implicated the Phase 6C production migration, its generator, or any application code — all five were disposable-harness/fixture-construction defects in this runtime package itself, each diagnosed to its exact root cause and corrected without broadening any grant, disabling any trigger/RLS policy, or modeling an application state the real code would never allow. See `00_READ_ME_FIRST.md`'s own "Runtime attempt history" section and the implementation report's §§22–26 for the full evidence trail behind each correction.
- If this package is ever re-run again (e.g. after a future, unrelated change to the migration or the disposable project's own schema), add a new "Attempt #7" row to the table above rather than overwriting this record — this file's own history is meant to be cumulative, matching the Phase 6A/6B packages' own convention.
- No Production project may be touched by any file in this package, regardless of outcome.
