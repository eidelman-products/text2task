# Text2Task Client Share — Phase 6C
## Atomic Apply + Conversion Closure — Implementation Report
## 2026-08-23

**Status: `PHASE_6C_COMPLETE`** (see §28). Disposable-project runtime verification passed (`PHASE_6C_CLOSURE_RUNTIME_PASS`, 79/79, 0 failed — main closure suite, attempt #6; `PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS` — real-COMMIT capability test; §27), targeted regression (51 files / 1820 tests) and the full production build both passed, and the work is committed at `0958167`. Production itself remains untouched — no push, deploy, or Production SQL has been authorized or performed.

**Starting checkpoint**: `main @ 0b10e61` ("Complete Client Share Phase 6B message analysis flow"). The working tree already carried one uncommitted, pre-existing file before this implementation turn began: `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6C_AUDIT_AND_PLAN_2026-08-23.md` (the accepted plan, itself already corrected twice — once for a standalone-helper security blocker, once for source-provenance accuracy in its own drift-protection strategy — before this implementation turn was authorized).

---

## 1. Migration slot

`supabase/migrations/202608230002_client_share_apply_conversion_closure.sql` — the plan document had proposed `202608240001`, but `202608230002` was free at implementation time (the next `20260823NNNN` slot after `202608230001`), so it was used instead per the plan's own explicit instruction to prefer the actual free slot over the placeholder date. No collision was found.

---

## 2. Files created

- `scripts/client-share/build-phase6c-apply-conversion-closure-migration.ps1` — the deterministic migration generator.
- `supabase/migrations/202608230002_client_share_apply_conversion_closure.sql` — the generated migration (not hand-edited).
- `supabase/migrations/202608230002_client_share_apply_conversion_closure.test.ts` — its static test suite (55 tests).
- `docs/client-share-phase6c-runtime/00_READ_ME_FIRST.md`
- `docs/client-share-phase6c-runtime/01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql`
- `docs/client-share-phase6c-runtime/02_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql`
- `docs/client-share-phase6c-runtime/MANIFEST.md`
- This report.

## 3. Files modified

- `app/api/project-updates/apply/route.ts` — removed the Phase 6B client_share `409 project_update_source_not_appliable` rejection block. The route now claims and calls the RPC uniformly for every source type.
- `app/api/project-updates/apply/route.test.ts` — replaced the retired Phase 6B guard-placement tests with their Phase 6C inverse (client_share reaches the same claim step as text/image; byte-identical behavior under identical status/config; no second Apply route).
- `app/components/dashboard/tasks/project-updates/project-update-shell.tsx` — removed the `isClientShareResult` exclusion from `canApply`; it now depends only on `hasSelectedApplyableItems(form)`, exactly like text/image.
- `app/components/dashboard/tasks/project-updates/project-update-shell.test.tsx` — replaced the retired Phase 6B UI-suppression tests with their inverse (client_share now shows "Save N changes"; the review card and dialog render identically across source types).
- `app/components/dashboard/tasks/share-link/client-communication-history-modal.tsx` — added `canChangeLifecycleStatus` (hides Mark reviewed/Resolve/Dismiss once `status === "converted"`); Reply is explicitly left ungated, per the locked product decision.
- `app/components/dashboard/tasks/share-link/client-communication-history-modal.test.tsx` — added tests proving converted hides the three lifecycle buttons, still shows Reply, and that a non-converted message is unaffected (direct regression).

No new route, no new modal, no new database table or column — matching the plan's own explicit constraints.

---

## 4. Generator result, determinism, and hashes

`scripts/client-share/build-phase6c-apply-conversion-closure-migration.ps1` was run twice against unchanged sources (once to generate, once after deleting the output to prove reproducibility). Both runs produced byte-identical output:

```
202608230002_client_share_apply_conversion_closure.sql (generated) : 36f9209b2e17cad19a8aa8c5a279fb74d2de880a790df3fd67a9eecba4d6db65
```

Per-function reconstruction proofs (each independent — a pass for one is never treated as evidence for another):

| Function | Source migration (full-file SHA-256) | Original extracted body (SHA-256) | Reconstruction proof |
|---|---|---|---|
| `apply_project_update_transaction` | `202607270001` = `8d22bc16c851ea7f53b2c4e7af92443317043df377bf48073b171e98a5dbed9a` | `2e8b45e905052b89807665621317e7bb60e27f69e8550927293363daeab67684` | PASSED |
| `set_share_message_status` | `202608190001` = `62dd3ff05590608d8891ca89531c525314c79b44978ae73064e9e602be720351` | `4efe7f29214c8009d340047fb077ec29893b817ef4ebec3bcd0ec55069bcdf00` | PASSED |
| `enforce_project_update_client_share_apply_boundary` | `202608230001` = `3cad162f4af710c97f0cc05d58ff9d3e1735fba64fa7b60ce3e7054c0c2bf9e7` | `b84c6a7e2b1eb236b503d2977ac74e7542243178411e88d0946aa4973fd95388` | PASSED |

`finalize_share_message_conversion` has no historical source (new in Phase 6C) — it was authored directly in the generator as a deterministic template.

The generator's own structural self-checks also passed before writing: no `DROP TRIGGER` statement anywhere in the output; no `DROP FUNCTION` targeting the boundary function; the capability GUC name (`text2task.client_share_apply_update_id`) appears in all three expected places (the RPC's own `set_config` call, the boundary trigger's check, the helper's check).

---

## 5. Exact authoritative source used for each preserved function

Per the plan's own source-provenance correction (§13):

- `apply_project_update_transaction` ← `supabase/migrations/202607270001_project_completion_reconciliation.sql`, and only that file.
- `set_share_message_status` ← `supabase/migrations/202608190001_client_share_message_owner_rpcs.sql`, and only that file — **never** `202607270001`, which has never defined it.
- `enforce_project_update_client_share_apply_boundary` ← `supabase/migrations/202608230001_client_share_apply_boundary.sql`, and only that file.
- `finalize_share_message_conversion` — new, no historical source, template-authored.

---

## 6. Phase 6C helper security contract implemented

`finalize_share_message_conversion(p_message_id uuid, p_project_update_id uuid)` — `SECURITY DEFINER`, `plpgsql`, locked `search_path = public, pg_temp`, `EXECUTE` revoked from `public`/`anon`/`service_role`, granted only to `authenticated`.

Check order, exactly as the corrected plan requires:
1. `auth.uid()` null-check (`UNAUTHORIZED`).
2. **Capability check first, before any other validation or write** — `current_setting('text2task.client_share_apply_update_id', true) is distinct from p_project_update_id::text` → `SHARE_CONVERSION_APPLY_CONTEXT_REQUIRED`. Fails closed on missing or mismatched.
3. Lock `project_updates` `FOR UPDATE`; require owned, `status='applied'`, `source_type='client_share'`, `source_share_message_id = p_message_id`.
4. Lock `share_messages` `FOR UPDATE` (after `project_updates` — the binding lock order); require owned, project match, `author_type='client'`, `status <> 'converted'`.
5. Insert one `share_message_conversions` row (`target_task_id` always `null`); update `share_messages.status='converted'`, `reviewed_at = coalesce(reviewed_at, now())`; `resolved_at` never referenced.

The existing, unmodified `enforce_share_message_conversion_integrity()` trigger independently re-validates the INSERT — a third layer.

---

## 7. Exact GUC/capability implementation

Name: `text2task.client_share_apply_update_id`. Set via `perform set_config('text2task.client_share_apply_update_id', p_update_id::text, true);` — always `is_local = true`, never a boolean/global flag, always the row-bound `p_update_id::text`.

**Placement inside `apply_project_update_transaction`**: gated `if v_update.source_share_message_id is not null then ... end if;`, inserted **immediately before** the existing, unmodified step-14 `UPDATE project_updates SET status='applied', ...` statement — i.e., late, after auth/ownership validation, apply-attempt validation, every lock, payload validation, edited-item writes, every accepted work mutation, every timeline write, and the item status updates. Never near the top of the function. Never set for any non-`client_share` row.

---

## 8. Exact trigger semantics after Phase 6C

`enforce_project_update_client_share_apply_boundary()` — **`CREATE OR REPLACE`d in place; the trigger `project_updates_enforce_client_share_apply_boundary` itself was never dropped and was not redeclared.**

- `client_share` + `status='applying'`: **no longer blocked**, unconditionally.
- `client_share` + `status='applied'`, `TG_OP='INSERT'`: blocked unless the capability matches `NEW.id::text`.
- `client_share` + `status='applied'`, `TG_OP='UPDATE'`, `OLD.status IS DISTINCT FROM 'applied'` (an *entering* transition): blocked unless the capability matches `NEW.id::text`.
- `client_share` + `status='applied'`, `TG_OP='UPDATE'`, `OLD.status = 'applied'` (already applied, staying applied): **not gated at all** — the capability is never even consulted for this case, since the `OLD.status IS DISTINCT FROM 'applied'` condition is false and the `TG_OP='INSERT'` branch cannot apply to an UPDATE.
- TG_OP-safe by construction: `OLD` is referenced only inside the `elsif tg_op = 'UPDATE' and old.status is distinct from 'applied'` branch — never evaluated during an INSERT invocation.

---

## 9. Apply RPC insertion points

Two, at two different points in the existing 17-step transaction order, both gated on `v_update.source_share_message_id is not null` (a complete no-op for text/image/email/manual):

1. The capability `set_config` call, immediately before the existing step-14 applied-status `UPDATE`.
2. The closure block (`perform public.finalize_share_message_conversion(v_update.source_share_message_id, p_update_id);`), immediately before the existing final `return jsonb_build_object(...)` — i.e., strictly after accepted work mutations, timeline inserts, item status updates, the applied-status write, priority provenance, and `reconcile_project_completion`. No exception-swallowing wraps this call — a helper failure propagates and aborts the whole transaction exactly like every other `raise exception` already in this function.

---

## 10. Terminality implementation

`set_share_message_status` — its existing `SELECT ... FOR UPDATE` now also loads `message.status` into a new `v_existing_status` variable; immediately after the existing ownership/deleted-project checks and before any status-specific branch, `if v_existing_status = 'converted' then raise ... SHARE_MESSAGE_STATUS_TERMINAL; end if;`. `resolved_at`/`reviewed_at` semantics for `new`/`reviewed`/`resolved`/`dismissed` are byte-for-byte unchanged. Signature, security mode, and grants unchanged.

---

## 11. API/UI changes

- `POST /api/project-updates/apply` — the Phase 6B 409 rejection block removed; every source type now flows through `claimProjectUpdateForApply` → `apply_project_update_transaction` uniformly.
- `ProjectUpdateModalV2` (`project-update-shell.tsx`) — `canApply` no longer excludes `client_share`; "Save N changes" now shows for client_share exactly like text/image.
- `ClientCommunicationHistoryModal` — a converted message now hides Mark reviewed/Resolve/Dismiss (`set_share_message_status` itself is the actual enforcement point; this is UX convenience). Reply remains available whenever the existing, independent `canReply` conditions are true — the locked product decision (converted does not stop communication) was not touched.
- No `conversionId`/`convertedAt`/`converted` metadata was added to the Apply JSON response — the existing contract is preserved exactly, per the plan's own default.

---

## 12. Focused test counts

**Terminology note** (clarified after the second read-only audit — see §21): three distinct figures exist and must not be conflated.

- **115 — Phase 6C newly-focused tests**: the 4 files this implementation actually wrote or modified this session.

  | File | Tests |
  |---|---|
  | `supabase/migrations/202608230002_client_share_apply_conversion_closure.test.ts` | 55 passed |
  | `app/api/project-updates/apply/route.test.ts` | 5 passed |
  | `app/components/dashboard/tasks/project-updates/project-update-shell.test.tsx` | 5 passed |
  | `app/components/dashboard/tasks/share-link/client-communication-history-modal.test.tsx` | 50 passed |

- **178 — combined sanity-check subset**: an initial `vitest run` across those same 4 files **plus** the two pre-existing Phase 6A/6B migration test files (`202608210001_client_share_project_update_provenance.test.ts` + `202608230001_client_share_apply_boundary.test.ts`, contributing 63 tests **not written this session**). This was a quick regression spot-check, not a distinct or larger "focused" figure — **178 must never be presented as "new Phase 6C focused tests."**
- **1820 — full targeted regression** (§13 below): the complete 51-file sweep, which subsumes both smaller figures above.

## 13. Full targeted regression counts

```
npx vitest run app/api/share-links app/components/dashboard/tasks/share-link \
  app/api/project-updates app/components/dashboard/tasks/project-updates \
  supabase/migrations/202608*

Test Files  51 passed (51)
     Tests  1820 passed (1820)
```

Covers: every Client Share API/component test (share-links routes, share-link components including the modal above), every project-updates API/component test (including the Apply route above), and every Phase 6A/6B/6C migration static test (`202608210001`, `202608230001`, `202608230002`). No failures, no skips.

## 14. `npx tsc --noEmit`

Clean — no output, no errors.

## 15. `git diff --check`

Clean — only pre-existing line-ending (`LF` → `CRLF`) informational warnings on files this repository's own `.gitattributes`/config already normalizes; no whitespace errors reported. Exit code 0.

## 16. `git status --short`

```
 M app/api/project-updates/apply/route.test.ts
 M app/api/project-updates/apply/route.ts
 M app/components/dashboard/tasks/project-updates/project-update-shell.test.tsx
 M app/components/dashboard/tasks/project-updates/project-update-shell.tsx
 M app/components/dashboard/tasks/share-link/client-communication-history-modal.test.tsx
 M app/components/dashboard/tasks/share-link/client-communication-history-modal.tsx
?? docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6C_AUDIT_AND_PLAN_2026-08-23.md
?? docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6C_IMPLEMENTATION_REPORT_2026-08-23.md
?? docs/client-share-phase6c-runtime/
?? scripts/client-share/build-phase6c-apply-conversion-closure-migration.ps1
?? supabase/migrations/202608230002_client_share_apply_conversion_closure.sql
?? supabase/migrations/202608230002_client_share_apply_conversion_closure.test.ts
```

Nothing staged. Nothing committed.

## 17. Phase 6C runtime package files created

`docs/client-share-phase6c-runtime/00_READ_ME_FIRST.md`, `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql`, `02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql`, `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql`, `MANIFEST.md`. Corrected after a second, final read-only implementation-acceptance audit found three runtime-coverage gaps (§21) — **no defect was found in the migration, application code, or security design itself**; every gap was in the prepared-but-not-yet-run test harness's own completeness:

- `02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql` (new) — the CAP-G "capability disappears after a real COMMIT" property, previously a hardcoded/undocumented `true` assertion inside the main suite, is now a small, dedicated, isolated file that performs a REAL `BEGIN`/`COMMIT` (the only file in this whole package family that does), touches no application data, and reports its own separate one-row `PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS`/`FAIL` result.
- `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` (renamed from `02_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql`, corrected) — the always-`BEGIN`/`ROLLBACK` main suite. Its former hardcoded CAP-G assertion was removed entirely (it is now an informational comment only, not counted in the file's own `total_tests`/`passed_tests`/`failed_tests`). Two new sections were added: `ATOMIC_FAILURE_MESSAGE_UPDATE` — a genuine forced failure at the actual `share_messages.status='converted'` UPDATE step (not the earlier conversion INSERT), injected via a test-only `BEFORE UPDATE` trigger created and dropped entirely inside the same always-rolled-back transaction, proving the work mutation, timeline event, item/update status writes, and the already-committed conversion INSERT all roll back when the failure occurs strictly *after* them; and `COMPLETION_RECONCILIATION` — a real Apply (`update_subtask`, finishing a project's one remaining active task) that actually exercises the unmodified, `202607270001`-authoritative `reconcile_project_completion`, confirming `projects.status` becomes `'Done'` in the same transaction as a real client_share conversion.

The full test matrix (file `03`) now covers SUCCESS, REJECT_ONLY, ATOMIC_FAILURE, ATOMIC_FAILURE_MESSAGE_UPDATE, CAP (A–H, closing the exact standalone-helper attack the security audit found), APPLYING (I–J), APPLIED_EXISTING (K), TERMINALITY, IDEMPOTENCY, PROVENANCE, HISTORY, COMPLETION_RECONCILIATION, and REGRESSION — plus file `02`'s own separate real-COMMIT test. **Still prepared, not executed to completion** (three attempts so far, all on harness-only issues, all corrected — see §§22–24). Expected runtime row count for file `03`, computed by walking each section's actual branching (a `begin ... exception when others` pair collapses to one row at runtime, not two; the `TERMINALITY` loop's 4 iterations each produce one row): **75 rows** (updated by §24's `AF0`/`AFM0` additions — was 73 before that correction), all expected `PASS`, plus file `02`'s own separate 1-row result — 76 total pieces of evidence across both files once run. This count is a careful manual computation, not itself runtime-verified — the only way to confirm it exactly is to actually run both files.

`01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql` (unchanged by this correction) extends the Phase 6A fixture's minimal `projects`/`tasks`/`clients` stand-ins with most of the columns a full, successful Apply reads or writes — evidence for every added column is cited directly in that file's own header (usage in `apply_project_update_transaction`/`reconcile_project_completion`/the Apply route's own SELECT lists; no CHECK constraint was invented since no authoritative source for one exists in this repository). **This claim of completeness was subsequently disproven by real runtime evidence — see §23 (runtime attempt #2): `tasks.is_archived` was missing, corrected by the new `01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql`, not by this file.**

## 18. Exact manual runtime sequence for the user

See `docs/client-share-phase6c-runtime/00_READ_ME_FIRST.md` for the full, current sequence, now explicitly grouped into four stages:

- **A. Schema/prerequisite preparation** — Phase 6A's own 01+02, the Phase 6B boundary migration pasted verbatim, the Phase 6B RPC-prerequisite package.
- **B. Phase 6C migration application** — this migration (`202608230002`) pasted verbatim, then this package's own base-table extension (`01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql`), then `01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql` (attempt #1's correction), then `01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql` (attempt #2's correction — see §23).
- **C. Real COMMIT-scope capability test** — `02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql`, run once, its own one-row result recorded separately.
- **D. Main always-ROLLBACK Phase 6C closure suite** — `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql`.

Full Phase 6C runtime acceptance requires recording **both** stage C's and stage D's results — neither alone is sufficient.

## 19. Explicit confirmations

- **No Production SQL was run.**
- **No disposable-project SQL was run by Claude** — the runtime package (including the two new/corrected files added in §21) was prepared only; every file in it is written but unexecuted.
- **No full Next.js build was run.**
- **No git stage, commit, push, or deploy occurred.**
- **Phase 6D was not started** — no file, code, or design work for it exists anywhere in this session.
- **Phase 6C runtime PASS is still not claimed** — neither `PHASE_6C_CLOSURE_RUNTIME_PASS` (file `03`) nor `PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS` (file `02`) has been reported by the user. This report records only that both files are now prepared and, per this section's own confirmations, unexecuted.

## 20. Status (superseded — see §27)

```
READY_FOR_RUNTIME
```

Not `PHASE_6C_COMPLETE`. Outstanding before that status may be claimed: the user's own disposable-project runtime verification — **both** `docs/client-share-phase6c-runtime/02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql` and `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` must be run and their results recorded — the user's own full production build, and final review/commit. None of these is implied by anything in this report, including §21 below.

**This status is superseded by §27**: both required runtime results are now recorded and both passed. Current status is `RUNTIME_VERIFIED_READY_FOR_BUILD`, still not `PHASE_6C_COMPLETE`.

---

## 21. Second read-only implementation-acceptance audit and runtime-harness corrections

A second, final read-only implementation-acceptance audit (subsequent to the first, which is summarized in §§1–20 above) independently re-verified the migration's source provenance, capability placement, trigger semantics, helper security contract, atomicity, and app-layer diff — **finding no defect in the migration, the application code, or the security design**. It found exactly three gaps, all confined to the *prepared, not-yet-run* runtime test harness's own completeness relative to what the accepted plan's own runtime matrix required:

1. **CAP-G** (capability disappears after a real `COMMIT`) was a hardcoded `true` assertion inside the main suite, never backed by an actual `COMMIT` — the main suite deliberately only ever used `ROLLBACK`, so this specific property had never been executed.
2. **No forced failure existed at the actual `share_messages.status='converted'` UPDATE step** — only the earlier conversion-INSERT failure path (via a pre-existing unique-constraint violation) had been exercised. A pre-converted message, the obvious-looking alternative, would have failed at the helper's own earlier `status <> 'converted'` precondition check instead, proving nothing about the later UPDATE step specifically.
3. **`reconcile_project_completion` was never actually exercised at runtime** — the function was named only in a prerequisite-check comment, never called through a real Apply case that would complete a project.

**Corrections made this turn** (documentation/runtime-harness only — no migration, generator, application code, Phase 6A/6B migration, or production function was modified):

- `docs/client-share-phase6c-runtime/02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql` (new) — see §17.
- `docs/client-share-phase6c-runtime/03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` (renamed from `02_...`, corrected) — see §17.
- `docs/client-share-phase6c-runtime/00_READ_ME_FIRST.md` and `MANIFEST.md` — updated to the new four-stage (A/B/C/D) sequence and current file hashes.
- This report — §§12/13 (test-count terminology), §17 (file list and coverage), §18 (four-stage sequence), §19/20 (explicit non-claim of runtime PASS).

**At the time of this correction, runtime had not yet been run.** `git diff --check` is clean; only the `docs/client-share-phase6c-runtime/` package (untracked) and this report changed as a result of this correction — no file listed under "Production migration unchanged" / "application code unchanged" in this report's own confirmations was touched. (See §22 below for what happened on the user's first actual attempt, recorded after this section.)

---

## 22. Runtime attempt #1 — result and correction

The user ran the corrected package. Results:

| Step | File | Result |
|---|---|---|
| B (base columns) | `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql` | **PASS** — `PHASE_6C_BASE_TABLE_EXTENSION_READY` |
| C (real-COMMIT capability test) | `02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql` | **PASS** — `inside_transaction_matches=true`, `cleared_after_commit=true`, `PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS` |
| D (main closure suite) | `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` | **FAILED BEFORE PRODUCING TEST RESULTS** — `SQLSTATE 42501: permission denied for table projects`, inside `apply_project_update_transaction`'s own `select project.* ... for update of project` |

**This is not a Phase 6C migration or application-code acceptance failure.** It is a disposable-fixture/prerequisite gap: the Phase 6A fixture's own hand-authored `projects`/`tasks`/`clients` stand-in tables granted `authenticated` SELECT only, correct and sufficient for Phase 6A/6B (which never mutated these tables as `authenticated`) but insufficient for Phase 6C's runtime, which is the first to require a real, fully successful Apply — and `apply_project_update_transaction` (`SECURITY INVOKER`, unmodified by Phase 6C) genuinely performs `SELECT ... FOR UPDATE`/`UPDATE`/`INSERT` against these tables as `authenticated`, exactly like a real owner session.

A repository-wide evidence trace (every app-code call site that reads/writes `projects`/`tasks`/`clients` via the ordinary session-bound client, never `service_role`) confirmed the exact evidenced privilege surface: `projects` and `tasks` need INSERT/UPDATE/DELETE; `clients` needs INSERT/UPDATE only (no DELETE is evidenced anywhere in the repository for `clients`). PostgreSQL's `SELECT ... FOR UPDATE` locking clause requires UPDATE privilege in addition to SELECT — standard Postgres behavior, not Supabase-specific, and Supabase's own error hint (naming only `projects`) was incomplete, since the identical gap exists for `clients` and `tasks` later in the same function.

**Correction**: `docs/client-share-phase6c-runtime/01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql` (new) — adds exactly the evidenced grants plus matching RLS policies (same `auth.uid() = user_id` predicate the fixture's own existing SELECT policy already uses). Kept as a separate, additive file rather than an edit to `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql`, because that file's own idempotency guard (a sentinel table) would otherwise force the user to manually reset a disposable project that had already run it successfully. `00_READ_ME_FIRST.md` and `MANIFEST.md` updated accordingly (the sequence is now nine steps across the same four stages).

**Re-run safety**: traced directly from the failed run's own structure — every object the main suite creates lives strictly inside its own `begin;` ... (would-be) `rollback;` block, and the failure occurred inside that same open transaction. An aborted, uncommitted transaction is discarded automatically the moment its connection closes, regardless of whether the trailing `rollback;` statement text was ever reached — so **no persistent artifacts remain**, and it is safe to re-run the (corrected) sequence with no manual cleanup.

**No Production SQL was affected. No Phase 6C migration, generator, or application code was modified by this correction** — only the disposable runtime package. Runtime PASS is still not claimed for the main closure suite (stage D); it failed before producing results on this attempt.

---

## 23. Runtime attempt #2 — a second, independent disposable-fixture gap, and its correction

After attempt #1's grant/policy correction (`01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql`) was applied and itself reported `PHASE_6C_MUTATION_PRIVILEGES_READY`, the user re-ran the main closure suite. It got further — past the privilege error — and **again failed before producing any test results**, this time during the very first `SUCCESS` section's own Apply call:

```
ERROR: 42703: column task.is_archived does not exist
CONTEXT: PL/pgSQL function public.reconcile_project_completion(uuid,uuid,timestamptz)
         line 11 at SQL statement
         called from public.apply_project_update_transaction(...) at PERFORM
```

**This is a second, independent disposable-fixture schema gap — not the same issue recurring, and not a Phase 6C migration or application-code defect.** `reconcile_project_completion` (unmodified, `202607270001`, called by `apply_project_update_transaction` whenever any item is accepted) reads `task.is_archived`. The Phase 6A fixture's own hand-authored `projects` stand-in carries an `is_archived` column; its `tasks` stand-in never did, and `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql`'s own original column audit (§17 above) added `archived_at` to `tasks` but missed `is_archived` itself — a genuine oversight in that file's own audit, not evidence of a deeper problem, but real enough that **§17's earlier claim that file 01 provides "every column a full, successful Apply actually reads or writes" was incorrect and is retracted** (see the correction inline in §17 above).

**Full re-audit performed, not a single-column patch**: every `task.`/`project.`/`v_project.`/`client.` reference in `202607270001_project_completion_reconciliation.sql` was mechanically re-extracted via repository grep (not memory), cross-referenced against that same file's own bare-column `INSERT INTO tasks (...)` list (which uses unqualified column names for `is_archived`/`archived_at`/`source`/`raw_input`/`deleted_at`/`updated_at` — easy to miss with an alias-only search) and against every column Phase 6C's own runtime file 03 inserts into `tasks`/`projects`/`clients` in its own fixture setup. The complete union, cross-checked against the current fixture (Phase 6A's original columns + `01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql`'s own additions), found **exactly one** remaining gap: `public.tasks.is_archived`. No second or third gap was found on `tasks`, `projects`, or `clients`.

**Type/nullability evidence**: `reconcile_project_completion`'s own `WHERE` clause, `(task.is_archived = false or task.is_archived is null)`, proves the column is `boolean` (compared against the literal `false`) and — because it treats `NULL` as an explicit, alternative valid state rather than purely defensive code — that it is genuinely **nullable** in real production data, unlike `projects.is_archived`, which the Phase 6A fixture already models as `NOT NULL DEFAULT false`. Modeled as `boolean null`, matching this evidence exactly rather than assuming the stricter `projects` shape.

**Correction**: `docs/client-share-phase6c-runtime/01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql` (new) — adds `tasks.is_archived boolean null`, plus a **comprehensive final verification block** checking the complete cumulative required column set across all three fixture tables (not merely the one column this file adds), so that a third gap — if one exists — fails loudly and statically the next time this file is run, rather than resurfacing as a third runtime error. Kept as a separate file from both `01` and `01B`, for the same reason as `01B`: `01`'s own idempotency guard blocks a second run in a project where it already succeeded, and this project already has.

**Re-run safety**: identical reasoning to attempt #1 (§22) — the failure occurred inside the same still-open `begin;` transaction in the main suite, before its own `ATOMIC_FAILURE_MESSAGE_UPDATE` section (and therefore before its test-only trigger was ever created) and before every later section. An aborted, uncommitted transaction is discarded automatically when its connection closes, regardless of whether the trailing `rollback;` text was reached. No manual cleanup is required before the next attempt.

**No Production SQL was affected. No Phase 6C migration, generator, or application code was modified by this correction** — only the disposable runtime package. Runtime PASS is still not claimed for the main closure suite; it has now failed on two separate, independent disposable-fixture gaps (privileges, then schema), both diagnosed and corrected, neither implicating the migration or application code.

---

## 24. Runtime attempt #3 — a runtime-harness fault-injection bug (not a fixture gap), plus a latent baseline bug found in the same review

After `01C`'s correction was applied and itself reported `PHASE_6C_RECONCILIATION_COLUMNS_READY`, the user re-ran the main closure suite. It got substantially further this time — past both prior errors, through the entire `SUCCESS` and `REJECT_ONLY` sections — and **again failed before producing any test results**, inside the `ATOMIC_FAILURE` section's own test-only pre-insert:

```
ERROR: P0001: SHARE_CONVERSION_ACTOR_NOT_AUTHENTICATED
CONTEXT: PL/pgSQL function enforce_share_message_conversion_integrity() line 33 at RAISE
SQL statement: insert into public.share_message_conversions (user_id, message_id, converted_by)
               values (v_owner_a, v_msg, v_owner_a)
```

**This is a runtime-harness fault-injection bug, not a disposable-fixture privilege/schema gap, and not a Production defect.** `ATOMIC_FAILURE`'s own test-only pre-insert (deliberately forcing a later `share_message_conversions_message_id_unique` violation) executed immediately after `pg_temp.new_analyzed_priority_change()`'s own helper had already reset the session to `role=postgres` with `request.jwt.claims='{}'` — so `auth.uid()` was `NULL` at the exact moment of the pre-insert. The real, unmodified `enforce_share_message_conversion_integrity()` trigger's own `auth.uid() = new.converted_by` check correctly rejected a null actor — the trigger did precisely what it is supposed to do; the fixture code simply never established the actor context that check requires.

**Fix**: the pre-insert now runs wrapped in `perform pg_temp.act_as('postgres', v_owner_a);` ... `perform pg_temp.act_as('postgres');` — staying on `role=postgres` (required, since `authenticated` has no direct INSERT grant on `share_message_conversions`; all real writes normally happen only inside the `SECURITY DEFINER` helper) while setting `auth.uid() = v_owner_a` via the `request.jwt.claims` GUC, so the real trigger's own check is genuinely **satisfied**, never bypassed, disabled (no `DISABLE TRIGGER`, no `session_replication_role`), or weakened. A full audit of the entire runtime package confirmed this is the *only* direct `share_message_conversions` write anywhere in it — no second occurrence of this bug exists.

**A second, latent bug was found and corrected in the same review** (not itself the cause of attempt #3's failure, but discovered while fixing it): both `ATOMIC_FAILURE` and `ATOMIC_FAILURE_MESSAGE_UPDATE` captured their "before" project `priority`/`priority_source` from the *shared* `project_a`, which the earlier `SUCCESS` section had already mutated to `priority='High'`, `priority_source='user'`. This made both sections' own rollback proofs structurally unsound: (1) attempting another `priority_change` to `'High'` against an already-`'High'` project is a no-op — "still equals `v_priority_before`" would have been trivially true whether or not rollback actually worked; (2) asserting `priority_source is distinct from 'user'` would have **failed even when rollback was working correctly**, since `priority_source` was already `'user'` from the unrelated, already-committed `SUCCESS` section.

**Fix**: both sections now create their own dedicated, freshly-created project with a deterministic baseline (`priority='Medium'`, `priority_source='ai'`), capture the true pre-Apply values into `v_priority_before`/`v_priority_source_before`, attempt an observably-different mutation (`Medium → High`, `ai → user`), and assert **exact** restoration via `IS NOT DISTINCT FROM` against the captured baseline — not a hardcoded literal. A new `AF0`/`AFM0` assertion confirms the baseline itself really was `Medium`/`ai` before the attempted mutation, proving the test's own precondition rather than assuming it.

**`AF1` was also strengthened**, per explicit request: it now asserts the exact `SQLSTATE 23505` **and** the exact `share_message_conversions_message_id_unique` constraint name (via `GET STACKED DIAGNOSTICS ... constraint_name`), not merely that "some exception was raised."

**Updated expected runtime count**: two assertions were added (`AF0`, `AFM0`); none were removed. `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql`'s expected `total_tests` is now **75** (previously 73), all expected `PASS`, plus `02`'s own separate 1-row result.

**Re-run safety**: identical reasoning to attempts #1/#2 (§§22–23) — the failure occurred inside the same still-open `begin;` transaction, after `SUCCESS` and `REJECT_ONLY` had both already run (their own mutations still fully uncommitted) and before `ATOMIC_FAILURE_MESSAGE_UPDATE`'s own test-only trigger was ever created. An aborted, uncommitted transaction is discarded automatically when its connection closes, regardless of whether the trailing `rollback;` text was reached. No manual cleanup is required.

**No Production SQL was affected. `enforce_share_message_conversion_integrity()` was not modified, weakened, or disabled — it is confirmed working correctly.** No Phase 6C migration, generator, or application code was touched by this correction — only the disposable runtime package's own test-only fixture logic. Runtime PASS is still not claimed for the main closure suite; it has now failed on three separate, independent issues (privileges, schema, then a harness fault-injection bug), all diagnosed and corrected, none implicating the migration or application code.

---

## 25. Runtime attempt #4 — a fixture-construction bug that tried to bypass a real privilege boundary, corrected by using the real owner RPC

After attempt #3's fixes, the user re-ran the main closure suite. It got substantially further — past `SUCCESS`, `REJECT_ONLY`, `ATOMIC_FAILURE`, `ATOMIC_FAILURE_MESSAGE_UPDATE` (including a clean create-then-drop of its own test-only trigger), every `CAP` sub-test, `APPLYING`, `APPLIED_EXISTING`, `TERMINALITY`, and `IDEMPOTENCY` — and **again failed before producing any test results**, inside `PROVENANCE`'s own `P3` sub-test:

```
ERROR: 42501: permission denied for table share_messages
HINT: GRANT INSERT ON public.share_messages TO authenticated
CONTEXT: insert into public.share_messages (...) values (..., 'owner', 'An owner-authored note.', true) returning id
```

**This is a runtime-harness fixture-construction bug — not a fixture privilege gap to grant around, and not a Production defect.** `P3` needs a fixture message with `author_type='owner'` to prove the client-share provenance trigger's own author-type invariant, and the original fixture code built it with a raw `insert into public.share_messages (...)` as `authenticated`. But `authenticated` genuinely has **no** direct INSERT grant on `share_messages` anywhere in this repository's real schema (confirmed by direct grant inspection earlier this engagement: `202608030005_client_share_integrity_and_security.sql` grants `authenticated` `SELECT` only) — every owner-authored write is required to go through the existing `SECURITY DEFINER` RPC `public.send_share_message_reply` (`202608190001_client_share_message_owner_rpcs.sql`). **The `42501` denial is that real privilege boundary working exactly as designed.** Granting `authenticated` INSERT on `share_messages` to make this test pass would have been a genuine, incorrect widening of Production-shaped privilege in the disposable fixture — explicitly not done.

**Fix**: `P3` now creates its owner-authored fixture message through the real path:

```sql
select public.send_share_message_reply(v_link_active, v_msg, 'An owner-authored note.')
  into v_reply_result;
v_owner_msg := (v_reply_result->>'messageId')::uuid;
```

called as `authenticated`/`v_owner_a` (matching `send_share_message_reply`'s own `auth.uid()`-derived actor model), using the PROVENANCE section's own existing client-authored `v_msg` as the required parent message (that RPC's own signature is `(p_share_link_id uuid, p_parent_message_id uuid, p_body text) returns jsonb`, confirmed by direct read of `202608190001`, not memory). A fail-closed fixture-validity check (`RAISE` if `messageId` is null, or if the resulting row doesn't match the expected owner/project/link/author_type/body shape) follows immediately — this is test setup, not a new counted Phase 6C invariant, so per the smaller of the two options offered, it raises rather than adding a new `test_results` row (§ "expected count," below). `P3`'s own `raw_input` for the subsequent `project_updates` INSERT attempt is set to the exact same literal used as the reply's own body, isolating the author-type invariant from any possibility of an incidental body-mismatch failure. `P3`'s expected error was also confirmed exact (not a generic `P0001`) by direct read of `202608210001_client_share_project_update_provenance.sql`: `PROJECT_UPDATE_SOURCE_MESSAGE_NOT_CLIENT_AUTHORED`.

`send_share_message_reply(uuid,uuid,text)` was added to the main suite's own startup safety-gate function list — defense-in-depth, not a new prerequisite step, since it is already installed by stage A step 2 (the Phase 6A bundle applies `202608190001` verbatim).

**Audit of the remainder of the file**: `HISTORY`, `COMPLETION_RECONCILIATION`, and `REGRESSION` were reviewed in full for the same class of issue (raw operations under a role lacking the real grant, missing `auth.uid()` context, a direct write where the product uses an RPC, cross-section fixture assumptions, wrong type/id shape, status-baseline contamination). **No further issue was found.** Both `HISTORY` and `REGRESSION` reuse the shared, already-mutated `project_a`, but neither asserts anything about `priority`'s own *value* (only `status`/existence-style checks), so the baseline-contamination class of bug that affected `ATOMIC_FAILURE`/`ATOMIC_FAILURE_MESSAGE_UPDATE` (§24) does not apply to them. `COMPLETION_RECONCILIATION` already uses its own dedicated project. No other raw `share_messages` write exists anywhere in the package (confirmed by a full-file grep — the sole remaining occurrence is `pg_temp.new_client_message`'s own `service_role` path, which is correct and already established). These three sections were left untouched.

**Expected runtime count**: unchanged at **75** — the fixture-validity check added is a fail-closed `RAISE`, not a `record_result` call, so `PROVENANCE`'s own source-call-site count (and therefore the file's total) is identical to §24's revision.

**Re-run safety**: identical reasoning to attempts #1–#3 (§§22–24) — the failure occurred inside the same still-open `begin;` transaction. Attempt #4 in particular ran every section from `SUCCESS` through `IDEMPOTENCY` to completion (including `ATOMIC_FAILURE_MESSAGE_UPDATE`'s own test-only trigger being cleanly created and dropped again well before `CAP` began), all of it still fully uncommitted when `PROVENANCE/P3` failed. An aborted, uncommitted transaction is discarded automatically when its connection closes, regardless of whether the trailing `rollback;` text was reached. No manual cleanup is required.

**No Production SQL was affected. `share_messages`' grants/RLS and `send_share_message_reply` were not modified, weakened, or bypassed — both are confirmed working correctly.** No Phase 6C migration, generator, or application code was touched by this correction — only the disposable runtime package's own test-only fixture logic. Runtime PASS is still not claimed for the main closure suite; it has now failed on four separate, independent issues (privileges, schema, a harness fault-injection bug, then a fixture-construction bug), all diagnosed and corrected, none implicating the migration or application code, and none resolved by broadening any grant.

---

## 26. Runtime attempt #5 — a link-lifecycle fixture bug, plus a latent link/project-pairing bug found by the same exhaustive audit

After attempt #4's fix, the user re-ran the main closure suite. It got further still — past `SUCCESS`, `REJECT_ONLY`, `ATOMIC_FAILURE`, `ATOMIC_FAILURE_MESSAGE_UPDATE`, every `CAP` sub-test, `APPLYING`, `APPLIED_EXISTING`, `TERMINALITY`, `IDEMPOTENCY`, and the entire `PROVENANCE` section — and **again failed before producing any test results**, inside the `HISTORY` section's own client-message fixture setup:

```
ERROR: P0001: SHARE_MESSAGE_CLIENT_LINK_NOT_ACTIVE
CONTEXT: PL/pgSQL function enforce_share_message_integrity() at RAISE
         called from pg_temp.new_client_message(uuid,uuid,uuid,text)
```

**Step 1 — confirming this was not a stale file.** The on-disk file was hashed before any investigation: `sha256sum docs/client-share-phase6c-runtime/03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` returned `169114d828af25c30faa411e69749fea0044118b268536f1724be2826477cb0f`, 1709 lines — byte-identical to exactly what attempt #4's correction (§25) left. **The user ran the current, corrected file; this is a genuinely new, previously-undiscovered bug, not a stale-file artifact.**

**Root cause.** Direct read of `enforce_share_message_integrity()` (`202608030005_client_share_integrity_and_security.sql`, INSERT branch, lines ~616–665) confirms its `author_type='client'` branch unconditionally requires, among other checks, `link.state = 'active'` (raising `SHARE_MESSAGE_CLIENT_LINK_NOT_ACTIVE` otherwise) before any client-authored `share_messages` row can be inserted. `HISTORY`'s prior form used `fixture_ids`' `link_revoked` — a link created **already** `state='revoked'` at fixture-setup time (never modeled as "active, then later revoked") — as the link for a brand-new client message. That INSERT could never have succeeded on any attempt, regardless of anything else in the file. **This is a runtime-harness fixture-construction bug, not a Production defect** — the trigger did exactly what it should; the fixture simply never modeled the real lifecycle the section's own name (`HISTORY`) implies.

The deeper issue: the section's own intended product invariant is that **a client message retained from a time when its link was genuinely active remains eligible for conversion/Apply after the link is later revoked** — not that a client can send a brand-new message to an already-revoked link (which must, and structurally does, remain rejected; proving that rejection is a distinct invariant, not this section's job).

**Fix.** `HISTORY` now models the real lifecycle explicitly, on its own dedicated project/link, independent of every other section:
1. create a project and a link with `state='active'`
2. `pg_temp.new_client_message(...)` — the client message is authored while the link is genuinely active
3. `pg_temp.new_analyzed_priority_change(...)` — the `client_share` `project_update`/item are reserved while the source is still fully valid
4. **only then**, `select public.revoke_share_link(v_history_link) into v_revoke_result;` (called as `authenticated`/`v_owner_a`) — the real, unmodified owner RPC (`202608060002_client_share_access_operations.sql`, `SECURITY DEFINER`, already installed by stage A step 2's Phase 6A bundle; no new prerequisite file needed), never a privileged direct `UPDATE` of the link row, so the real state-machine trigger on `project_share_links` remains fully in effect for this transition too
5. a new `H0` assertion confirms `v_revoke_result is not null and v_link_state_after_revoke = 'revoked'` — the link is genuinely revoked before Apply is attempted
6. the real Apply RPC (`pg_temp.run_full_apply`) is then run against the retained message/update; `H1` (renamed/rewritten from the old, structurally-unreachable single assertion) confirms success/applied/converted; a new `H2` confirms a `share_message_conversions` row exists

**Step 4 of the user's instructions — full link-lifecycle audit.** Every `pg_temp.new_client_message(...)` call site in the file (16 total, enumerated by direct grep, not memory) was checked for: link id, project id, whether the link's own project matches the message's project, the link's `state` at call time, and whether the call is meant to model a real client submission or a deliberate rejection test. Result: **14 of 16 were already correct** (12 use `link_active`+`project_a`, a pair that is genuinely `active` and genuinely matched for the entire file; `ATOMIC_FAILURE`, `ATOMIC_FAILURE_MESSAGE_UPDATE`, and `PROVENANCE/P4`'s nested block each already use their own dedicated, correctly-paired, active link). **2 of 16 were bugs**: `HISTORY` (the reported one, above) and one more found by this same exhaustive pass:

**Step 5 — `COMPLETION_RECONCILIATION` audit and correction.** This section created its client message with `project_id = v_completion_project` (a project dedicated to this section) but authored it through `link_active` — a link whose own `project_id` is `project_a`. `enforce_share_message_integrity()`'s own `new.project_id = link.project_id` check (`SHARE_MESSAGE_PROJECT_MISMATCH`) would have rejected this on the very next attempt, independent of and unrelated to the `HISTORY` bug — a second, latent, not-yet-triggered defect, found only because the user's instructions required an exhaustive audit rather than a fix scoped to the one reported symptom. **Fix**: `COMPLETION_RECONCILIATION` now creates its own dedicated link tied to `v_completion_project` (mirroring the `v_af_link`/`v_afm_link` pattern already used elsewhere in the file), with a new `CR0B` assertion confirming `project_share_links.project_id = v_completion_project` before the link is used to author the message.

**Step 6 — mechanical audit of every remaining statement, HISTORY through the final ROLLBACK**, for: wrong project/link pairing, inactive link at message-creation time, wrong role/`auth.uid()`, missing table privilege, a direct write where the product uses an RPC, bigint/uuid mismatch, cross-section state contamination, stale capability, completion-precondition mismatch, hardcoded PASS rows, and assertions not actually proving their claimed behavior. Result: no further defect of any of these classes was found in `REGRESSION` or in the final `Results`/aggregation block (the `total_tests`/`passed_tests`/`failed_tests` SELECT is computed dynamically via `count(*) ... from test_results`, not hardcoded, so it requires no code change — only a re-documentation of the new expected value, below).

**Step 7 — fake/hardcoded PASS audit.** A mechanical sweep of every `record_result(...)` call in the file found exactly one illegitimate hardcoded-`true` row: `REGRESSION`'s own `REG-NOTE`, whose condition was the bare literal `true` with no runtime check behind it (a purely informational note about the existence of the separate Phase 6A/6B suites). **Fix**: converted to a plain SQL comment, no longer counted toward `total_tests`. One additional `true` condition was found and confirmed **legitimate**, left unchanged: `APPLIED_EXISTING`'s `K1`, whose `true` sits in the success branch of a real `begin ... exception when others ... end` block wrapping a real `UPDATE public.project_updates set client_id = client_id where id = v_update_id;` — the `true` there asserts "this real statement did not raise," which is a genuine runtime condition, not a hardcoded stub (its own paired exception-branch `false` proves the two branches are mutually exclusive and both wired to a real outcome).

**Step 8 — image regression coverage.** The accepted plan calls for both text and image Apply regression coverage; only `REG1`/`REG2` (`source_type='text'`) existed. Added `REG3`/`REG4` (`source_type='image'`) to `REGRESSION`, using the exact same, unmodified `pg_temp.run_full_apply` path as the text regression — no analyzer call is fabricated; only the `project_updates.source_type` column differs, which is exactly what a regression needs to isolate. `REG3` asserts Apply success + a timeline event; `REG4` asserts no `share_message_conversions` row was created (the closure block remains a no-op for non-`client_share` sources).

**Step 9 — safety-gate strengthening.** `revoke_share_link(uuid)` was added to the startup safety gate's RPC-existence check (needed by `HISTORY`'s new revocation step; already installed by stage A step 2, checked here as defense-in-depth). Two further durable checks were added: `public.tasks.is_archived` actually exists (`information_schema.columns`), and `01B`'s own `authenticated` grants on `projects`/`tasks`/`clients` are actually present (`has_table_privilege`, mirroring `01B`'s own final-verification logic directly, since `01B` has no sentinel row of its own to check instead).

**Step 10 — attempt #5 safety.** The failure occurred inside a bare, top-level `perform pg_temp.new_client_message(...)` call inside `HISTORY`'s own `do $$ ... $$` block — not wrapped in any `begin ... exception` handler in the test code itself — so the raised exception propagated out of that block and aborted the whole, still-open outer `begin;` transaction from stage D (line 187 of the file). No `COMMIT` was ever reached. `HISTORY` runs well after `ATOMIC_FAILURE_MESSAGE_UPDATE`'s own test-only trigger is created and explicitly dropped (§ "ATOMIC_FAILURE_MESSAGE_UPDATE... AFM10" confirms the drop, and that section completed successfully before `CAP` began, well before `HISTORY` was ever reached) — so no test-only trigger was left attached to `public.share_messages` at the point of failure. An aborted, uncommitted transaction is discarded automatically by PostgreSQL the moment its connection closes or a `rollback;`/`ROLLBACK` is issued, regardless of whether the file's own trailing `rollback;` statement text was ever reached. **No manual cleanup is required. `03_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql` is safe to rerun.**

**Updated expected runtime count.** Mechanically recomputed (not assumed) by extracting every `record_result(...)` call site and collapsing each `begin ... exception when others ...` success/exception pair to the single runtime row that actually fires, and multiplying `TERMINALITY`'s 4-iteration `foreach` accordingly: **79** (up from 75) — `HISTORY` net +2 (was 1 counted assertion, now `H0`/`H1`/`H2` = 3), `COMPLETION_RECONCILIATION` net +1 (was `CR0`–`CR5` = 6, now + `CR0B` = 7), `REGRESSION` net +1 (`REG-NOTE`'s fake row removed, `REG3`/`REG4` added: 3 → 4). `CAP-G` remains excluded from this count (informational-only, never inserted into `test_results` — unchanged from every prior attempt).

**Static verification performed (no SQL executed).** Confirmed by source inspection only: every `pg_temp.new_client_message(...)` call site now creates its message on a link that is `state='active'` and whose own `project_id` matches the message's `project_id`, with zero exceptions; `HISTORY`'s statement order is create-active-link → client-message → project_update/item reservation → `revoke_share_link` → verify-revoked → real Apply; `COMPLETION_RECONCILIATION` now uses a link dedicated to, and verified matching, its own completion project; no raw `authenticated` `INSERT INTO share_messages` exists anywhere in the file (the only two message-authoring paths are `pg_temp.new_client_message`'s `service_role` INSERT and `public.send_share_message_reply`'s owner RPC, both already established as correct); no trigger disable, `session_replication_role` change, or RLS bypass exists anywhere in the file; no counted fake/hardcoded PASS row remains; both text (`REG1`/`REG2`) and image (`REG3`/`REG4`) Apply regressions exist; `total_tests` was mechanically recomputed to 79; `git diff --check` was run against the changed file and reported no whitespace/conflict-marker issues; a fresh `sha256sum` of `supabase/migrations/202608230002_client_share_apply_conversion_closure.sql` reconfirmed `36f9209b2e17cad19a8aa8c5a279fb74d2de880a790df3fd67a9eecba4d6db65`, unchanged.

**No Production SQL was affected. `enforce_share_message_integrity()` and `revoke_share_link` were not modified, weakened, or bypassed — both are confirmed working correctly.** No Phase 6C migration, generator, or application code was touched by this correction — only the disposable runtime package's own test-only fixture logic. Runtime PASS is still not claimed for the main closure suite; it has now failed on five separate, independent issues (privileges, schema, a harness fault-injection bug, a fixture-construction bug, then a link-lifecycle fixture bug plus a latent link/project-pairing bug found by the same exhaustive audit), all diagnosed and corrected, none implicating the migration or application code, and none resolved by broadening any grant, disabling any trigger, or modeling an impossible link/message state.

---

## 27. Runtime attempt #6 — PASS. Both required runtime results now recorded.

After attempt #5's fixes (§26), the user re-ran the main closure suite in full. **Result: `PHASE_6C_CLOSURE_RUNTIME_PASS`**:

```
total_tests         = 79
passed_tests         = 79
failed_tests         = 0
status               = PHASE_6C_CLOSURE_RUNTIME_PASS
failed_test_details  = (no failures)
```

`total_tests=79` matches §26's mechanically recomputed expected count exactly — no discrepancy, no silent test-count drift. Every section ran to completion, in order: `SUCCESS`, `REJECT_ONLY`, `ATOMIC_FAILURE`, `ATOMIC_FAILURE_MESSAGE_UPDATE` (including its own test-only trigger's clean create-then-drop), every `CAP` sub-test (A–H, with `CAP-G` correctly excluded as an informational pointer, never inserted into `test_results`), `APPLYING`, `APPLIED_EXISTING`, `TERMINALITY`, `IDEMPOTENCY`, `PROVENANCE`, the corrected `HISTORY` (message-then-revoke lifecycle, `H0`/`H1`/`H2` all passing), the corrected `COMPLETION_RECONCILIATION` (dedicated project-matched link, `CR0`–`CR5` plus the new `CR0B` all passing), and `REGRESSION` (both the original text coverage `REG1`/`REG2` and the new image coverage `REG3`/`REG4`, all passing). The file reached its own trailing `rollback;` — by this whole package's own established discipline, nothing it creates is meant to survive any run, pass or fail, so no artifact persists from this run either.

The dedicated real-COMMIT capability test, `docs/client-share-phase6c-runtime/02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql`, was also run (or re-confirmed run) and **passed**:

```
inside_transaction_matches = true
cleared_after_commit       = true
status                      = PHASE_6C_CAPABILITY_COMMIT_SCOPE_PASS
```

**Both required runtime results (§18/§20's own outstanding items) are now recorded.** Combined: **80 total executed runtime assertions/evidence points** — 79 main-suite `PASS` rows (step 10) + 1 dedicated real-COMMIT `PASS` (step 9), 0 failures across both. Full details, including the complete six-attempt run log for the main suite, are recorded in `docs/client-share-phase6c-runtime/04_CAPTURE_RESULTS.md` (new this turn).

**Documentation updated this turn** (no code, migration, generator, or application changes): `docs/client-share-phase6c-runtime/00_READ_ME_FIRST.md` (status line, "Runtime attempt history" §attempt #6, manual-sequence steps 9/10, "What PASS means" section, files table), `docs/client-share-phase6c-runtime/MANIFEST.md` (revision note, file table + new `04_CAPTURE_RESULTS.md` entry and hash, confirmations section), `docs/client-share-phase6c-runtime/04_CAPTURE_RESULTS.md` (new — the filled-in results/run-log file, following the same convention as the Phase 6A/6B packages' own capture-results files), and this report (top status line, §20 marked superseded, this §27).

**Verification performed this turn (no SQL executed)**: `git diff --check` — clean, no whitespace/conflict-marker issues in any file touched. `git status -sb` — the same pre-existing `M` application files (from the original Phase 6C implementation turn, untouched again this turn) and `??` untracked docs/migration/generator files, plus the two newly-added docs files (`04_CAPTURE_RESULTS.md` and this report's own prior edits, both already untracked/uncommitted from earlier turns). Fresh `sha256sum` of `supabase/migrations/202608230002_client_share_apply_conversion_closure.sql` reconfirmed `36f9209b2e17cad19a8aa8c5a279fb74d2de880a790df3fd67a9eecba4d6db65`, unchanged.

**Explicit confirmations**: no application code was modified. No Phase 6C migration was modified (hash-verified unchanged). No generator was modified. No Phase 6A/6B migration was modified. No grant, policy, or RLS rule was broadened. No trigger was disabled or bypassed. No SQL was run by Claude this turn — every result recorded above was run by the user and reported back. No full production build was run. No `git add`/commit/push/deploy occurred. Phase 6D has not started.

**Status: `RUNTIME_VERIFIED_READY_FOR_BUILD`.** Not `PHASE_6C_COMPLETE` — that still requires the user's own full production build to pass, a final `git diff`/`git status` review, and a commit.

---

## 28. Full production build, targeted regression, and commit — Phase 6C now complete

Subsequent to §27, the user performed the three remaining outstanding items entirely on their own (none of them run by Claude, consistent with every prior turn's own restrictions):

- **Targeted regression**: 51 files / 1820 tests, reported PASS.
- **TypeScript** (`npx tsc --noEmit` or equivalent): reported PASS.
- **Full production build**: Next.js 16.1.6 / Turbopack, reported "Compiled successfully," TypeScript PASS, static generation 90/90, reported PASS overall.
- **Final `git diff --check`**: reported clean.
- **Commit**: Phase 6C committed at `0958167` ("Complete Client Share Phase 6C atomic conversion closure"), on top of `0b10e61` (Phase 6B). Working tree reported clean immediately after the commit.

These results were reported by the user, not independently re-run by Claude this session — consistent with this whole engagement's discipline that the user alone performs the full build, staging, and commits. A later session (the Phase 6D audit turn) independently confirmed via `git log`/`git status`/`git rev-parse HEAD` that `HEAD` is genuinely `0958167` and the working tree is clean, corroborating the commit claim structurally, though the build/regression/TypeScript results themselves rely on the user's own report (they are not independently re-executed evidence).

**All three items §20/§27 identified as outstanding for `PHASE_6C_COMPLETE` are now satisfied**: full production build PASS, final `git diff`/`git status` review clean, and the work is committed.

**Status: `PHASE_6C_COMPLETE`.**

Production is still untouched by the Phase 6C rollout — no push, deploy, or Production SQL has been authorized or performed. See `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6D_AUDIT_AND_PLAN_2026-08-24.md` for the subsequent Phase 6D audit (mapping/audit only, no implementation) and the current recommendation on whether any further Phase 6D implementation slice is required before a Production rollout decision.
