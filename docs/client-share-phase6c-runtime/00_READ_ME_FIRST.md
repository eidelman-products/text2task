# Client Share Link — Phase 6C Atomic Apply + Conversion Closure — Runtime Package

**Status: RUNTIME VERIFIED — PASS.** Five runtime attempts on the main closure suite failed on disposable-harness gaps (privileges, schema, a fault-injection identity bug, a fixture-construction bug, then two link-lifecycle/project-pairing fixture bugs), all corrected in turn; **attempt #6 (re-run after all five corrections) passed: `total_tests=79`, `passed_tests=79`, `failed_tests=0`, `status=PHASE_6C_CLOSURE_RUNTIME_PASS`, `failed_test_details=(no failures)`.** The dedicated real-COMMIT capability test (`02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql`) also passed: `inside_transaction_matches=true`, `cleared_after_commit=true`, `status=PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS`. **80 total executed runtime assertions/evidence points** (79 main-suite `PASS` rows + 1 dedicated real-COMMIT `PASS`). Both required results are now recorded — see `04_CAPTURE_RESULTS.md`. Claude has not run any SQL in this package — every attempt recorded below was run by the user. This PASS does **not** authorize a full production build, a commit, a push, Phase 6D, or any Production action — see "What PASS means and does not mean" below.

## Runtime attempt history

**Attempt #1**: stages A and B (as they existed then) succeeded — `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql` reported `PHASE_6C_BASE_TABLE_EXTENSION_READY`; stage C's `02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql` reported `PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS`. Stage D's main suite **failed before producing any test results**:

```
ERROR: 42501: permission denied for table projects
HINT: GRANT UPDATE ON public.projects TO authenticated;
CONTEXT: select project.* ... for update of project
         (inside public.apply_project_update_transaction)
```

Root cause: the Phase 6A fixture's own hand-authored `projects`/`tasks`/`clients` stand-ins granted `authenticated` SELECT only — sufficient for Phase 6A/6B, insufficient for Phase 6C's own first real, fully-successful Apply. Not a Phase 6C migration or application-code defect. **Corrected** by `01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql` (adds the evidenced `authenticated` INSERT/UPDATE/DELETE grants — no DELETE on `clients`, none evidenced — plus matching RLS policies). Kept as a separate file so the already-run file 01 (whose own idempotency guard blocks a second run) never needed a reset.

**Attempt #2** (after 01B applied — `01B` itself reported `PHASE_6C_MUTATION_PRIVILEGES_READY`): stage D's main suite got further (past the privilege check) and **again failed before producing any test results**, during the very first `SUCCESS` section's own Apply call:

```
ERROR: 42703: column task.is_archived does not exist
CONTEXT: PL/pgSQL function public.reconcile_project_completion(uuid,uuid,timestamptz)
         line 11 at SQL statement
         called from public.apply_project_update_transaction(...) at PERFORM
```

Root cause: a **second, independent** disposable-fixture gap — this time schema, not privileges. `reconcile_project_completion` (unmodified, from `202607270001`, called by `apply_project_update_transaction` whenever any item is accepted) reads `task.is_archived`. The Phase 6A fixture's `projects` stand-in has an `is_archived` column; its `tasks` stand-in never did, and `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql`'s own original column audit added `archived_at` to `tasks` but missed `is_archived` itself — an oversight in that file, now corrected. **An exhaustive re-audit was performed this time** (every `task.`/`project.`/`v_project.`/`client.` reference in `202607270001`, plus that file's own bare-column `INSERT INTO tasks (...)` list, plus every column Phase 6C's own runtime file 03 inserts) to confirm `is_archived` is the *only* remaining gap — not merely patch this one column and risk a third failed attempt. **Corrected** by `01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql` (adds `tasks.is_archived boolean null`, plus a comprehensive final verification checking the *complete* required column set across `tasks`/`projects`/`clients`, not just this one column).

**Attempt #3** (after 01C applied — reported `PHASE_6C_RECONCILIATION_COLUMNS_READY`): stage D's main suite got further still (past both prior errors, through the entire `SUCCESS` and `REJECT_ONLY` sections) and **again failed before producing any test results**, inside the `ATOMIC_FAILURE` section's own test-only pre-insert:

```
ERROR: P0001: SHARE_CONVERSION_ACTOR_NOT_AUTHENTICATED
CONTEXT: PL/pgSQL function enforce_share_message_conversion_integrity() line 33 at RAISE
SQL statement: insert into public.share_message_conversions (user_id, message_id, converted_by)
               values (v_owner_a, v_msg, v_owner_a)
```

Root cause: a **runtime-harness fault-injection bug**, not a disposable-fixture privilege/schema gap and not a Production defect. `ATOMIC_FAILURE`'s own test-only pre-insert (deliberately forcing a later unique-constraint violation) ran immediately after `new_analyzed_priority_change()`'s own helper had already reset the session back to `role=postgres` with `request.jwt.claims='{}'` — meaning `auth.uid()` was `NULL` at the moment of the pre-insert, and the REAL, unmodified `enforce_share_message_conversion_integrity()` trigger correctly rejected it (its own `auth.uid() = new.converted_by` check cannot pass against a null actor). The trigger did exactly what it should; the test-only fixture code simply never established the actor context that trigger expects. **Corrected**: the pre-insert now runs under `pg_temp.act_as('postgres', v_owner_a)` — stays on `role=postgres` (needed since `authenticated` has no direct INSERT grant on this table) while setting `auth.uid() = v_owner_a` via the `request.jwt.claims` GUC, so the real trigger is genuinely *satisfied*, never bypassed, disabled, or weakened. A full audit of the whole package found this is the *only* direct `share_message_conversions` write anywhere in it.

**While fixing this, a second, latent bug was found and corrected in the same review**: both `ATOMIC_FAILURE` and `ATOMIC_FAILURE_MESSAGE_UPDATE` captured their "before" project priority/priority_source from the *shared* `project_a`, which the earlier `SUCCESS` section had already mutated to `priority='High'`/`priority_source='user'` — making their own rollback assertions structurally unable to prove anything (a `High -> High` no-op attempt "restoring" to `High` proves nothing about rollback; a `priority_source is not user` assertion would fail even when rollback works correctly, since it was already `'user'` from the unrelated earlier test). **Corrected**: both sections now use their own dedicated, freshly-created project (deterministic `priority='Medium'`, `priority_source='ai'` baseline), capture the true pre-Apply values, attempt an observably-different `High`/`user` mutation, and assert *exact* restoration (`IS NOT DISTINCT FROM` the captured baseline) after the forced failure — plus a new `AF0`/`AFM0` assertion confirming the baseline itself really was `Medium`/`ai` before the attempt. `AF1` was also strengthened to assert the exact `SQLSTATE 23505` and the exact `share_message_conversions_message_id_unique` constraint name (via `GET STACKED DIAGNOSTICS ... constraint_name`), not merely "some error was raised."

**Attempt #4** (after attempt #3's fixes applied): the main suite got substantially further — past `SUCCESS`, `REJECT_ONLY`, `ATOMIC_FAILURE`, `ATOMIC_FAILURE_MESSAGE_UPDATE` (including its own test-only trigger's clean create-then-drop), all `CAP` sub-tests, `APPLYING`, `APPLIED_EXISTING`, `TERMINALITY`, and `IDEMPOTENCY` — and **again failed before producing any test results**, inside `PROVENANCE`'s own `P3` sub-test:

```
ERROR: 42501: permission denied for table share_messages
HINT: GRANT INSERT ON public.share_messages TO authenticated
CONTEXT: insert into public.share_messages (...) values (..., 'owner', ...) returning id
```

Root cause: a **runtime-harness fixture-construction bug**, not a fixture privilege gap to be granted around and not a Production defect. `P3` needs an owner-authored fixture message to prove the author-type provenance invariant, and used a raw `insert into public.share_messages (...)` as `authenticated` to build it — but `authenticated` genuinely has **no** direct INSERT grant on `share_messages` in this repository's real schema; every owner-authored write goes through the existing `SECURITY DEFINER` RPC `public.send_share_message_reply` (`202608190001_client_share_message_owner_rpcs.sql`). **The permission denial is the real `share_messages` privilege boundary working exactly as designed — it must not be granted around.** `Corrected`: `P3` now creates its owner-authored fixture message by calling the real `send_share_message_reply(v_link_active, v_msg, 'An owner-authored note.')` as `authenticated`, extracting `messageId` from its `jsonb` result, with a fail-closed fixture-validity check (raises if the RPC's own contract shape ever changes) rather than a raw INSERT. `send_share_message_reply(uuid,uuid,text)` was added to the main suite's own startup safety gate (already installed by stage A step 2's Phase 6A bundle — this is defense-in-depth, not a new prerequisite step). A full audit of the remainder of the file (`HISTORY`, `COMPLETION_RECONCILIATION`, `REGRESSION`) found no other raw `share_messages` write and no other latent grant/baseline issue — those three sections were left untouched.

**Attempt #5** (after attempt #4's fix applied): the main suite got further still — past `SUCCESS`, `REJECT_ONLY`, `ATOMIC_FAILURE`, `ATOMIC_FAILURE_MESSAGE_UPDATE`, all `CAP` sub-tests, `APPLYING`, `APPLIED_EXISTING`, `TERMINALITY`, `IDEMPOTENCY`, and the entire `PROVENANCE` section — and **again failed before producing any test results**, inside the `HISTORY` section's own client-message fixture setup:

```
ERROR: P0001: SHARE_MESSAGE_CLIENT_LINK_NOT_ACTIVE
CONTEXT: PL/pgSQL function enforce_share_message_integrity() at RAISE
         called from pg_temp.new_client_message(uuid,uuid,uuid,text)
```

Root cause: a **runtime-harness fixture-construction bug**, not a Production defect — confirmed by direct read of `enforce_share_message_integrity()` (`202608030005_client_share_integrity_and_security.sql`), whose `author_type='client'` branch unconditionally requires `link.state = 'active'` at INSERT time. `HISTORY` had used the `link_revoked` fixture — a link created **already** `state='revoked'` at fixture-setup time — to author a brand-new client message. That INSERT could never have succeeded, on any attempt, regardless of anything else in the file; it was never actually a test of "a retained message survives its link being revoked," since no message was ever retained from a time when the link was genuinely active. **Corrected**: `HISTORY` now uses its own dedicated project/link (created `state='active'`), sends the client message and reserves the `client_share` `project_update` while the link is genuinely active, and only *then* revokes the link — through the real, unmodified owner RPC `public.revoke_share_link` (`202608060002_client_share_access_operations.sql`, already installed by stage A step 2) — before running the real Apply RPC against the now-retained message/update. A new `H0` assertion confirms the RPC actually revoked the link before Apply is attempted; a new `H2` confirms a conversion row exists.

**While fixing this, per the explicit instruction to exhaustively re-audit rather than patch only the reported symptom, a second, independent, not-yet-triggered latent bug was found and corrected in the same pass**: `COMPLETION_RECONCILIATION` created its client message with `project_id = v_completion_project` but authored it through the *shared* `link_active` fixture, whose own `project_id` is `project_a` — a guaranteed `SHARE_MESSAGE_PROJECT_MISMATCH` (the trigger's `new.project_id = link.project_id` check) on the very next attempt, once `HISTORY` was no longer blocking execution first. **Corrected**: `COMPLETION_RECONCILIATION` now creates its own dedicated link tied to `v_completion_project`, with a new `CR0B` assertion confirming the link's `project_id` matches before it is used. A full mechanical audit of every remaining `pg_temp.new_client_message(...)` call site in the file (16 total) found no further instance of this bug class — every other call site already uses either `link_active`+`project_a` (a genuinely matching, always-active pair) or its own already-dedicated link (`ATOMIC_FAILURE`, `ATOMIC_FAILURE_MESSAGE_UPDATE`, `PROVENANCE/P4`'s nested block).

**Two smaller, related corrections were made in the same pass**: (1) the `REGRESSION` section's own `REG-NOTE` row — previously a hardcoded `record_result(..., true)` asserting nothing about runtime behavior — was converted to a plain SQL comment, no longer counted toward `total_tests`; (2) a real, minimal image-source (`source_type='image'`) Apply regression (`REG3`/`REG4`) was added, using the exact same unchanged Apply path as the existing text regression, since the accepted plan calls for both text and image Apply regression coverage and only text existed. The startup safety gate was also strengthened: `revoke_share_link(uuid)` was added to its RPC-existence check (needed by `HISTORY`'s new revocation step), a durable check that `public.tasks.is_archived` exists was added, and a durable check that `01B`'s own `authenticated` grants are actually present was added (probing live privilege state directly, since `01B` itself has no sentinel row of its own).

**Attempt #6** (after attempt #5's fixes applied — `HISTORY`'s message-then-revoke lifecycle rewrite, `COMPLETION_RECONCILIATION`'s dedicated project-matched link, the fake `REGRESSION`/`REG-NOTE` row removed, the image-source Apply regression added, and the startup safety gate strengthened): the user re-ran the main closure suite in full. **Result: `PHASE_6C_CLOSURE_RUNTIME_PASS`** —

```
total_tests    = 79
passed_tests   = 79
failed_tests   = 0
status         = PHASE_6C_CLOSURE_RUNTIME_PASS
failed_test_details = (no failures)
```

`total_tests=79` matches the mechanically recomputed expected count from attempt #5's correction exactly (75 after attempt #4, +2 `HISTORY` `H0`/`H2`, +1 `COMPLETION_RECONCILIATION` `CR0B`, +1 net `REGRESSION`). Every section — `SUCCESS` through the new image `REGRESSION` coverage — ran to completion and reached the trailing `rollback;`, so no artifact from this run persists either, consistent with every prior attempt's own safety discipline.

**None of the five failed attempts was a Phase 6C production migration or application-code acceptance failure** — all five were disposable-harness/fixture-construction issues (privileges, schema, a fault-injection identity bug, a fixture-construction bug, then two link-lifecycle/project-pairing fixture bugs). All five are now corrected, and attempt #6 is the real, passing runtime evidence for the corrected package. See each corrected file's own header/inline comments for full evidence trails.

**Re-run safety, all six attempts**: no persistent artifacts remain from any of the five failures or from the passing sixth run. Every object the main suite creates lives strictly inside its own `begin;` / `rollback;` block; all five failures occurred inside that same open transaction and were discarded automatically on abort, and attempt #6's own success ran the block through to its own explicit trailing `rollback;` — by design, nothing the main suite creates is ever meant to survive a run, pass or fail. As an extra, automatic safety net on any future re-run: the main suite's own `create table test_results` (no `if not exists`) would itself fail loudly on a stale re-run if anything had somehow survived.

## What this package proves

That `supabase/migrations/202608230002_client_share_apply_conversion_closure.sql` behaves correctly against a real PostgreSQL engine, as the real `authenticated` role a genuine owner session would use — not by static inspection alone. In particular, it proves the **specific attack** the Phase 6C security audit found (a raw UPDATE forging `project_updates.status='applied'` followed by a standalone call to `finalize_share_message_conversion`) is closed by the corrected, row-bound transaction-capability design — and that the capability genuinely does not survive a real COMMIT, that a failure at either atomicity-critical write (the conversion INSERT *or* the message UPDATE) rolls back everything, and that Phase 6C did not regress the pre-existing, unmodified `reconcile_project_completion` behavior.

## Manual sequence — four clearly separated stages

### A. Schema / prerequisite preparation
1. `docs/client-share-phase6a-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql` — brand-new, empty, disposable Supabase project only.
2. `docs/client-share-phase6a-runtime/02_APPLY_CLIENT_SHARE_THROUGH_PHASE6A.sql`
3. The exact, unmodified contents of `supabase/migrations/202608230001_client_share_apply_boundary.sql`, pasted and run verbatim (not duplicated into any package).
4. `docs/client-share-phase6b-runtime/00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql` — installs the real, current `apply_project_update_transaction` / `reconcile_project_completion` / `apply_task_bulk_status_transaction` from `202607270001` (the Phase 6A bundle deliberately excludes it — Phase 6A's own runtime tests never called it).

### B. Phase 6C migration application
5. The exact, unmodified contents of `supabase/migrations/202608230002_client_share_apply_conversion_closure.sql`, pasted and run verbatim.
6. `docs/client-share-phase6c-runtime/01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql` — extends the Phase 6A fixture's minimal `projects`/`tasks`/`clients` stand-ins with columns a full, successful Apply reads or writes. **Proven, by runtime attempt #2, to have been incomplete on its own** (missing `tasks.is_archived`) — steps 7 and 8 below are both required in addition to this one, not merely recommended. **Already run successfully in the project that produced all four attempts above — do not re-run there** (its idempotency guard will refuse).
7. `docs/client-share-phase6c-runtime/01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql` — grants the `authenticated` mutation privileges (and matching RLS policies) step 6 did not. **Already run successfully — do not re-run there** (harmless if re-run, but unnecessary).
8. `docs/client-share-phase6c-runtime/01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql` — **new, required**. Adds `tasks.is_archived`, plus a comprehensive final verification of every column steps 6 and 8 together are supposed to provide. See "Runtime attempt history" above for the full root-cause trace.

### C. Real COMMIT-scope capability test (its own, separate, one-row result)
9. `docs/client-share-phase6c-runtime/02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql` — the ONLY file in this package that issues a real `COMMIT`. Touches no application data. **Run and PASSED**: `inside_transaction_matches=true`, `cleared_after_commit=true`, `status=PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS`. Re-running it again is harmless but not required. Recorded **separately** from the main suite's own result — see `04_CAPTURE_RESULTS.md`.

### D. Main always-ROLLBACK Phase 6C closure suite
10. `docs/client-share-phase6c-runtime/03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` — the full test matrix. Wrapped in `begin;` / `rollback;` — nothing it creates survives a run, pass or fail. Corrected after attempt #3 (actor context, baseline isolation), attempt #4 (`PROVENANCE/P3`'s owner-authored fixture message now uses the real `send_share_message_reply` RPC instead of an unreachable raw INSERT), and attempt #5 (`HISTORY`'s message-then-revoke lifecycle rewritten onto a dedicated link + the real `revoke_share_link` RPC; `COMPLETION_RECONCILIATION` given its own dedicated, project-matched link; the fake `REGRESSION`/`REG-NOTE` row removed; a real image-source Apply regression added) — see "Runtime attempt history" above. **Run to completion on attempt #6 and PASSED**: `total_tests=79`, `passed_tests=79`, `failed_tests=0`, `status=PHASE_6C_CLOSURE_RUNTIME_PASS`, `failed_test_details=(no failures)` — see `04_CAPTURE_RESULTS.md`.

Never run any of this against the real Text2Task production project.

## What "PASS" means and does not mean

- Step 10's `PHASE_6C_CLOSURE_RUNTIME_PASS` (now achieved, attempt #6) verifies everything **that file itself tests** — it does **not**, on its own, verify the real-COMMIT capability-scope property (step 9's own job) or, of course, authorize Phase 6D, a full production build, a commit, a push, or any Production action.
- Full Phase 6C runtime acceptance requires **both** step 9's `PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS` **and** step 10's `PHASE_6C_CLOSURE_RUNTIME_PASS` — **both are now recorded** (80 total executed runtime assertions/evidence points: 79 main-suite `PASS` rows + 1 dedicated real-COMMIT `PASS`). See `04_CAPTURE_RESULTS.md` for the full record.
- Step 10's `total_tests`/`passed_tests`/`failed_tests`/`status`/`failed_test_details` columns are fully self-diagnosing.
- **This PASS moves the package's own status to `RUNTIME_VERIFIED_READY_FOR_BUILD`, not `PHASE_6C_COMPLETE`.** `PHASE_6C_COMPLETE` additionally requires the user's own full production build to pass, a final diff/status review, and a commit — none of which has happened yet.

## If a test fails

This section remains for any *future* re-run (e.g. after any later change to the migration, the harness, or a schema drift in the disposable project) — it does not describe the current state, which is a clean `PHASE_6C_CLOSURE_RUNTIME_PASS` on attempt #6. Do not treat a future failure as evidence the Phase 6C migration itself is wrong without first checking whether it is actually a harness-only defect — exactly the discipline that correctly diagnosed all five attempts before the pass (two disposable-fixture gaps, a runtime-harness fault-injection identity bug, a fixture-construction bug that tried to bypass a real privilege boundary instead of using the real owner RPC, then a link-lifecycle fixture bug plus a latent link/project-pairing bug found by the same audit — none of them a migration or application-code defect). Record the exact FAIL rows before making any change, and correct the harness (this package) rather than the migration unless the evidence genuinely implicates the migration's own behavior; and never grant a privilege, or model a link/message in a state the real trigger would never allow, to make a fixture-construction bug disappear if the real application code already has a legitimate, narrower path (an RPC) for that same action. If a new issue surfaces on a future run, re-audit mechanically against the authoritative RPC/trigger source and this file's own fixture-construction logic (as attempts #2–#5's corrections did) rather than patching the single reported symptom and hoping.

## Files in this package

| File | Purpose |
|---|---|
| `00_READ_ME_FIRST.md` | This file. |
| `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql` | Extends the Phase 6A fixture's `projects`/`tasks`/`clients` stand-ins with most columns a full successful Apply needs (proven incomplete on its own by attempt #2 — see `01C`). |
| `01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql` | Grants the `authenticated` mutation privileges (INSERT/UPDATE/DELETE as evidenced) and matching RLS policies file 01 did not. |
| `01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql` | New — adds `tasks.is_archived` (the one column attempt #2 found missing) plus a comprehensive final column-completeness check across all three fixture tables. |
| `02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql` | The one dedicated, real-COMMIT test proving the capability GUC does not survive a commit. |
| `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` | The full always-ROLLBACK runtime test matrix (SUCCESS, REJECT_ONLY, ATOMIC_FAILURE, ATOMIC_FAILURE_MESSAGE_UPDATE, CAP A–H, APPLYING I–J, APPLIED_EXISTING K, TERMINALITY, IDEMPOTENCY, PROVENANCE, HISTORY, COMPLETION_RECONCILIATION, REGRESSION). |
| `MANIFEST.md` | File inventory and SHA-256 hashes. |
| `04_CAPTURE_RESULTS.md` | The recorded, final runtime evidence — both step 9's and step 10's actual results, plus the full six-attempt run log for step 10. |

`04_CAPTURE_RESULTS.md` now exists and is filled in — both step 9 and step 10 have been actually run and their real results recorded there, following the same convention as the Phase 6A/6B packages' own capture-results files. It reflects only what was actually run; no step's property is claimed verified beyond what its own recorded result actually shows.
