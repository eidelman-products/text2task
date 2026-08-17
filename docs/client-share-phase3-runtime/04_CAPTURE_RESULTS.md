# Client Share Link — Phase 3 Application Runtime Results

**SQL RUNTIME ACCEPTANCE COMPLETE — `PHASE_3_APPLICATION_RUNTIME_PASS`
(28/28, 0 failed).** Files 01 and 02 both succeeded once against a real
disposable Supabase project (`text2task-phase3-application-runtime-temp`)
and were never re-run. File 03 errored seven times across Runs 1–7, each
time on a harness-only defect in this SQL package itself (never the
migrations, RPCs, or integrity triggers), each corrected in this
repository and recorded below. Run 8, using the fully-corrected file,
reached its own trailing `rollback;` and reported
`total_tests = 28, passed_tests = 28, failed_tests = 0` —
`runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS`. No fixture row or
test-only object from any run survives in the disposable project. No
Production Supabase project was ever accessed, in any run. **This
completes SQL/database runtime acceptance for Phase 3. Browser/webview
acceptance (`PHASE3_BROWSER_WEBVIEW_CHECKLIST.md`), `npm run build`, and
final commit remain separate, still-pending steps — see the "Remaining
acceptance" note at the end of this file.**

## Run log

| Run | Project | File 01 | File 02 | File 03 | Outcome |
|---|---|---|---|---|---|
| 1 | `text2task-phase3-application-runtime-temp` (disposable) | Succeeded | Succeeded | Errored before the test summary — harness-only PIN fixture data defect (`project_share_links_pin_completeness_check`), corrected | Correction applied |
| 2 | `text2task-phase3-application-runtime-temp` (disposable, same project; 01/02 not re-run) | N/A — not re-run | N/A — not re-run | Errored before the test summary — harness-only SQL syntax defect (`42601`, `insert` used as an inline expression), corrected | Correction applied |
| 3 | `text2task-phase3-application-runtime-temp` (disposable, same project; 01/02 not re-run) | N/A — not re-run | N/A — not re-run | Errored before the test summary — harness-only lifecycle-invariant omission (`P0001 SHARE_LINK_VERSION_NOT_INCREMENTED`, a direct disable/re-enable `UPDATE` that omitted the required `configuration_version` increment the real `disable_share_link` RPC always performs), corrected | Correction applied |
| 4 | `text2task-phase3-application-runtime-temp` (disposable, same project; 01/02 not re-run) | N/A — not re-run | N/A — not re-run | Errored before the test summary — harness-only lifecycle-invariant mismatch (`P0001 SHARE_LINK_DISABLED_AT_DECREASE`, the restore-to-active `UPDATE` incorrectly cleared `disabled_at` to null, which the real `reenable_share_link` RPC never does), corrected | Correction applied |
| 5 | `text2task-phase3-application-runtime-temp` (disposable, same project; 01/02 not re-run) | N/A — not re-run | N/A — not re-run | Errored before the test summary — harness-only type-resolution defect (`42883`, `increment_share_rate_limit_bucket`'s fourth argument passed as a bare integer literal instead of `smallint`, at all five call sites in Section J), corrected | Correction applied |
| 6 | `text2task-phase3-application-runtime-temp` (disposable, same project; 01/02 not re-run) | N/A — not re-run | N/A — not re-run | Errored before the test summary — harness-only fixture defect (`23502`, a `share_link_resources` INSERT in Section K omitted `public_label`, `NOT NULL` with no default since the original schema), corrected | Correction applied |
| 7 | `text2task-phase3-application-runtime-temp` (disposable, same project; 01/02 not re-run) | N/A — not re-run | N/A — not re-run | Errored before the test summary — harness-only fixture defect (`23502`, a `share_link_updates` INSERT in Section K omitted `version` — and would separately have omitted `created_by` — both `NOT NULL` with no default since the original schema), corrected | Correction applied |
| 8 | `text2task-phase3-application-runtime-temp` (disposable, same project; 01/02 not re-run) | N/A — not re-run | N/A — not re-run | **`runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS` — 28/28 tests passed, 0 failed** | **PASS — SQL runtime acceptance complete** |

## Run 1 — current

Disposable Supabase project `text2task-phase3-application-runtime-temp`,
created solely for this Phase 3 application runtime verification.
Confirmed **not** the Text2Task production project.

### Result from file 01 (`01_CREATE_TEMP_TEST_FIXTURE.sql`)

- Status: ☑ Succeeded ☐ Errored
- `fixture_status` value: `READY`

### Result from file 02 (`02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_APPLICATION.sql`)

- Status: ☑ Succeeded ☐ Errored
- Final verification table: all rows `found = true`? ☑ Yes ☐ No

### Result from file 03 (`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql`)

**One harness-only defect was found in the shared fixture setup, before
any test assertion ran. The migration and its constraints were never
changed — they correctly rejected a malformed harness-constructed row.**

- Status: ☐ `runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS` ☑ Errored before completing (fixture setup, before the test summary) ☐ FAIL
- Exact error: `ERROR: 23514: new row for relation "project_share_links" violates check constraint "project_share_links_pin_completeness_check"`, raised while inserting the shared fixture row for the PIN-protected test link `phase3ApplicationFixtureLinkB2`.
- Root cause: the fixture's `pin_hash` value (`repeat('c3', 32)`, 64 characters) did not satisfy `project_share_links_pin_completeness_check`'s requirement that a non-null `pin_hash` be **exactly 43 characters** (`char_length(pin_hash) = 43`, matching the real V1 profile's `base64url(32-byte scrypt output)` shape produced by `hashSharePin` in `lib/share/share-pin.server.ts`). The harness had copied the 64-hex-character shape used elsewhere in the same file for `secret_digest`/session-digest fixtures, which is the wrong shape for this column. `pin_salt` (32 characters) was not implicated — it satisfied every constraint that actually governs it (`project_share_links_pin_completeness_check`'s `is not null`, and `project_share_links_pin_encoding_check`'s `between 16 and 128`).
- Correction: `pin_hash`'s fixture value changed to `repeat('c3', 21) || 'c'` (exactly 43 characters, same allowed character set). No other PIN-protected `project_share_links` row exists anywhere else in file 03 — confirmed by a full-file grep for `pin_hash`/`pin_salt`, which returned only this one INSERT's column list and values.
- Total tests / Passed / Failed: **not reached — the run errored during shared fixture setup, before any `pg_temp.record_result` call executed.**
- Reached its own trailing `rollback;`? Not applicable — the error aborts the open transaction automatically; the user's own standalone `ROLLBACK;` (per the runtime-safety instructions already followed) returns the disposable database to a clean state before any retry.

**Next step at the time: retry file 03 (with the correction above already
in the repository copy of the file — re-copy it into the SQL Editor
before retrying) after the standalone `ROLLBACK;`. File 01 and file 02 do
not need to be re-run — the sentinel, schema, and structural verification
they establish were untouched by this failure and remain valid for this
same disposable project.** (Superseded by Run 2 below — the retry hit a
second, unrelated harness defect before reaching the test summary.)

## Run 2 — current

Same disposable Supabase project as Run 1,
`text2task-phase3-application-runtime-temp`. File 01 and file 02 were
**not** re-run (not required — see Run 1's next-step note above); the
user ran a standalone `ROLLBACK;` after Run 1's error, then re-copied the
Run-1-corrected `03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql` fresh from
the repository and ran it.

### Result from file 03 (`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql`), second attempt

**One harness-only SQL syntax defect was found, before any test assertion
ran. The migration/schema was never implicated — this was a pure
PostgreSQL parse-time failure in the runtime harness file itself.**

- Status: ☐ `runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS` ☑ Errored before completing (parse/syntax error, before the test summary) ☐ FAIL
- Exact error: `ERROR: 42601: syntax error at or near "into"`, reported at the `insert into public.share_session_grants (` statement then beginning at line 491.
- Root cause: two of the file's assertions (Section G2 and Section H3) nested a bare `insert into ... returning true` directly inside `perform pg_temp.record_result(...)`'s argument list, e.g. `perform pg_temp.record_result('G', 'G2: ...', (insert into public.share_session_grants (...) values (...) returning true));`. `INSERT` is a PostgreSQL *statement*, not a value expression — it cannot legally appear inside parentheses as an argument the way a `SELECT`/`EXISTS` subquery can. The parser accepted the outer `insert into public.share_session_grants (` as the start of a new top-level statement (consistent with the reported line number and the `(` immediately preceding it), then failed on the earlier-than-expected `into` keyword inside the already-open, differently-shaped grammar context. Section F's `v_grant_a_id`/`v_grant_b_id` assertions a few lines above, and the rest of the file's `select ... from ...`/`exists (...)` boolean subqueries, are syntactically valid by contrast — only these two `insert ... returning true` sites were malformed.
- Correction: both sites (Section G2, originally at line 491; Section H3, originally at line 584) were rewritten to run the `INSERT ... RETURNING id INTO <new declared variable>` as its own statement — exactly the same idiom already used by Section B, D, and F's grant-creation assertions earlier in the same file — and the subsequent `perform pg_temp.record_result(...)` call now asserts `<variable> is not null` instead of embedding the `INSERT` inline. `v_grant_g2_id` and `v_grant_h3_id` were added to each block's own `declare` section. The intended test semantics (G2: a grant issued against the link's current `configuration_version` is accepted; H3: a grant expiry set to `min(session expiry, link expiry)` is accepted) are unchanged — both still assert that the corresponding INSERT succeeds and produces a row, exactly as originally intended.
- A full-file check for the same pattern (`grep "returning true"`) found exactly these two occurrences, both now corrected; no other statement in the file embeds an `INSERT`/`UPDATE`/`DELETE` inside an expression position.
- Total tests / Passed / Failed: **not reached — the run errored at parse time, before execution of any statement, including the safety-gate and fixture setup.**
- Reached its own trailing `rollback;`? Not applicable — a parse error prevents the script from executing at all; the user's own standalone `ROLLBACK;` (already performed after Run 1, and to be repeated after this attempt per the runtime-safety instructions) returns the disposable database to a clean state before any retry.

**Next step at the time: retry file 03 (with both corrections above
already in the repository copy of the file — re-copy it fresh into the
SQL Editor before retrying) after another standalone `ROLLBACK;`. File 01
and file 02 still do not need to be re-run.** (Superseded by Run 3 below
— the retry reached runtime execution but hit a third, unrelated harness
defect before reaching the test summary.)

## Run 3 — current

Same disposable Supabase project as Runs 1–2,
`text2task-phase3-application-runtime-temp`. File 01 and file 02 were
**not** re-run (still not required). The user ran a standalone
`ROLLBACK;` after Run 2's error, then re-copied the Run-1-and-Run-2-
corrected `03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql` fresh from the
repository and ran it. This attempt reached actual runtime execution
(past the safety gate and the shared fixture setup) before failing.

### Result from file 03 (`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql`), third attempt

**One harness-only lifecycle-invariant omission was found in Section I's
disable/re-enable simulation. `enforce_project_share_link_integrity()`
correctly rejected an UPDATE that changed `state` without also
incrementing `configuration_version` — this is the trigger working
exactly as designed, not a defect in the migration/trigger.**

- Status: ☐ `runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS` ☑ Errored before completing (Section I, before the test summary) ☐ FAIL
- Exact error: `ERROR: P0001: SHARE_LINK_VERSION_NOT_INCREMENTED`, raised inside `enforce_project_share_link_integrity()` (`202608030005_client_share_integrity_and_security.sql`), triggered by `update public.project_share_links set state = 'disabled', disabled_at = now() where id = v_link_id` in Section I.
- Root cause: the trigger's `v_access_changed` check treats ANY `state` change (along with `secret_digest`/`expires_at`/PIN fields/`comments_enabled`/`client_facing_subtitle`/`content_direction`) as access-affecting, requiring `new.configuration_version > old.configuration_version` in the same UPDATE — matching exactly what the real `disable_share_link(uuid)` RPC does (`202608060001_client_share_lifecycle_operations.sql`: `v_new_configuration_version := v_link_configuration_version + 1;` alongside `state`/`disabled_at`). The harness's direct UPDATE reproduced `state`/`disabled_at` but omitted the required version increment. The RPC itself could not be called directly from this raw service-role SQL Editor session (it is `SECURITY DEFINER` and reads `auth.uid()`, which is null outside an authenticated Supabase Auth session) — consistent with why every other lifecycle mutation in this file (e.g. Section G's rotation simulation) already reproduces the RPC's invariant directly rather than calling the RPC.
- Correction: both direct `project_share_links` state-changing UPDATEs in Section I — the disable (`state='disabled'`) and the end-of-section restore (`state='active'`) — now also set `configuration_version = configuration_version + 1`, reproducing the complete production invariant `disable_share_link`/`reenable_share_link` themselves enforce. The restore statement was corrected pre-emptively in the same pass (it has the identical defect and would have failed on the very next run otherwise).
- Full-file lifecycle-mutation scan (see below) found no other occurrence of this pattern.
- Total tests / Passed / Failed: **not reached — the run errored inside Section I, after Sections A–H's assertions had already executed (their results are not preserved anywhere by this rolled-back run; only the error itself was observed).**
- Reached its own trailing `rollback;`? Not applicable — the raised exception aborts the open transaction automatically; the user's own standalone `ROLLBACK;` returns the disposable database to a clean state before any retry.

### Full File 03 lifecycle-write scan (performed as part of this correction)

Every direct `INSERT`/`UPDATE`/`DELETE` against `project_share_links`,
`share_session_grants`, and `share_browser_sessions` in the file was
re-inspected for the same class of integrity-trigger omission:

- No `DELETE` statement exists anywhere in the file.
- `share_browser_sessions`: INSERT-only, no UPDATE — the digest/expiry
  immutability rules in `enforce_share_browser_session_integrity()` only
  fire on UPDATE, so none of these are affected.
- `share_session_grants`: one UPDATE (Section F, `set revoked_at = now()`
  on a previously-unrevoked row) — legal under
  `enforce_share_session_grant_integrity()` (revocation is a one-way
  null→timestamp transition on an otherwise-untouched row); all other
  writes are INSERTs, already covered by Runs 1–2's corrections and by
  the negative tests below.
- `project_share_links`: four direct writes total —
  1. Section G's `configuration_version = configuration_version + 1`
     alone (no other column touched) — compliant; `v_access_changed`
     does not include `configuration_version` itself, so no other bump
     is required.
  2. Section I's disable UPDATE — **the Run 3 defect, now corrected.**
  3. Section I's restore UPDATE — **the latent twin of the same defect,
     found and corrected pre-emptively in this same pass.**
  4. (Fixture-creation INSERTs, three of them, unaffected — the
     trigger's comparison logic only runs on UPDATE.)

No other latent lifecycle-mutation defect was found.

### Negative tests deliberately preserved (not defects)

Three existing `begin ... exception when others then ...` blocks
intentionally perform an invalid direct write specifically to prove the
integrity trigger rejects it, and were left completely unchanged:

- Section C1: a grant INSERT for a PIN-required link without
  `pin_verified_at` — asserts `SHARE_GRANT_PIN_VERIFICATION_REQUIRED`.
- Section E1: a grant INSERT for a NO-PIN link WITH `pin_verified_at` set
  — asserts `SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED`.
- Section G1: a grant INSERT against a stale `configuration_version` —
  asserts `SHARE_GRANT_CONFIGURATION_VERSION_STALE`.
- Section H1/H2: grant INSERTs exceeding the session's/link's own expiry
  — assert `SHARE_GRANT_EXPIRY_EXCEEDS_SESSION`/`SHARE_GRANT_EXPIRY_EXCEEDS_LINK`.
- Section I2: a grant INSERT for a disabled link — asserts
  `SHARE_GRANT_LINK_NOT_ACTIVE`.

None of these were the failing statement in any of the runs to date, and
none were altered — each is wrapped in its own `exception when others`
block specifically because the write is *expected* to fail, unlike
Section I's disable/restore UPDATEs, which were expected to *succeed* as
setup for the assertions that follow them.

**Next step at the time: retry file 03 (with all three corrections then
in the repository copy of the file — re-copy it fresh into the SQL
Editor before retrying) after another standalone `ROLLBACK;`. File 01
and file 02 still do not need to be re-run.** (Superseded by Run 4 below
— the retry progressed further into Section I but hit a fourth,
related-but-distinct harness defect before reaching the test summary.)

## Run 4 — current

Same disposable Supabase project as Runs 1–3,
`text2task-phase3-application-runtime-temp`. File 01 and file 02 were
**not** re-run (still not required). The user ran a standalone
`ROLLBACK;` after Run 3's error, then re-copied the Run-1/2/3-corrected
`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql` fresh from the repository
and ran it. This attempt progressed further than Run 3 — past the
disable `UPDATE` that Run 3 had fixed — before failing on the very next
statement in the same section.

### Result from file 03 (`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql`), fourth attempt

**One harness-only lifecycle-invariant mismatch was found in Section I's
restore-to-active statement. `enforce_project_share_link_integrity()`
correctly rejected an UPDATE that cleared `disabled_at` back to null —
this is the trigger enforcing a real, deliberate product rule (a
re-enabled link keeps its `disabled_at` as permanent historical
metadata), not a defect in the migration/trigger.**

- Status: ☐ `runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS` ☑ Errored before completing (Section I's restore statement, before the test summary) ☐ FAIL
- Exact error: `ERROR: P0001: SHARE_LINK_DISABLED_AT_DECREASE`, raised inside `enforce_project_share_link_integrity()`, triggered by the Section I restore statement: `update public.project_share_links set state = 'active', disabled_at = null, configuration_version = configuration_version + 1 where id = v_link_id`.
- Root cause: the trigger's monotonic rule for `disabled_at` (`old.disabled_at is not null and (new.disabled_at is null or new.disabled_at < old.disabled_at)` → reject) forbids ever clearing `disabled_at` back to null once it has been set, or moving it earlier — only leaving it unchanged or moving it later is permitted. The Run 3 correction had set `disabled_at = now()` on disable (correctly), so by the time the restore statement ran, `old.disabled_at` was non-null — and the harness's `disabled_at = null` in the restore statement violated the rule. The real `reenable_share_link(uuid)` RPC (`202608060001_client_share_lifecycle_operations.sql`) never touches `disabled_at` at all — its own inline comment states this explicitly: "activated_at and disabled_at are deliberately absent from this SET clause... disabled_at must never be cleared, so both stay exactly as they already are." `configuration_version` was correctly incremented in this same statement (that part of the Run 3 fix was correct and is unchanged).
- Correction: removed `disabled_at = null` from the Section I restore `UPDATE`'s `SET` clause entirely, so it now sets only `state = 'active', configuration_version = configuration_version + 1` — reproducing `reenable_share_link`'s own `SET` clause exactly. No assertion in the file reads `disabled_at`'s value after this restore (confirmed by a full-file grep), so leaving it at its disable-time timestamp does not affect any later section's semantics.
- A complete monotonic-lifecycle-field scan (see below) found no other occurrence of this pattern.
- Total tests / Passed / Failed: **not reached — the run errored partway through Section I's setup, after Sections A–H's assertions had already executed and after I1/I2's assertions had already executed successfully (their results are not preserved anywhere by this rolled-back run; only the error itself was observed).**
- Reached its own trailing `rollback;`? Not applicable — the raised exception aborts the open transaction automatically; the user's own standalone `ROLLBACK;` returns the disposable database to a clean state before any retry.

### Complete monotonic-lifecycle-field scan (performed as part of this correction)

The full `enforce_project_share_link_integrity()` function was re-read in
its entirety and every one-way/monotonic field rule enumerated:

| Field | Rule |
|---|---|
| `activated_at` | Immutable once non-null (cannot change at all, not even to a later value) |
| `disabled_at` | Monotonic once non-null: cannot become null, cannot decrease; CAN increase to a later timestamp |
| `rotated_at` | Monotonic once non-null: cannot become null, cannot decrease |
| `revoked_at` | Monotonic once non-null: cannot become null, cannot decrease; `state = 'revoked'` is additionally fully terminal (no transition out) |
| `last_viewed_at` | Monotonic once non-null: cannot become null, cannot decrease |
| `view_count` | Cannot decrease (no monotonic-null rule — starts at a non-null default) |
| `configuration_version` | Cannot decrease; must strictly increase whenever any access-affecting field (`secret_digest`, `secret_digest_version`, `state`, `expires_at`, any PIN field, `comments_enabled`, `client_facing_subtitle`, `content_direction`) changes, or on an `expired→active` state transition, or whenever `rotated_at` changes |
| PIN fields (`pin_hash`/`pin_salt`/`pin_hash_version`/`pin_scrypt_*`/`pin_key_length`) | No individual monotonic rule, but participate in `v_access_changed` (configuration_version bump required) and in `project_share_links_pin_completeness_check` (all-or-nothing, exact V1 shape) |
| `secret_digest`/`secret_digest_version` | No individual monotonic rule, but a change requires `rotated_at` to strictly increase in the same statement, and participates in `v_access_changed` |

Every direct write in File 03 against `project_share_links` was checked
against this complete table:

- Two fixture-creation `INSERT`s (shared fixture) and one scratch-project
  `INSERT` (Section H) — unaffected; none of these monotonic rules apply
  to `INSERT` (they all compare `old.*` to `new.*`, and `old` does not
  exist on insert).
- Section G's `configuration_version`-only `UPDATE` — touches no
  monotonic field, compliant.
- Section I's disable `UPDATE` (`state='disabled', disabled_at=now(),
  configuration_version+1`) — `disabled_at` goes null→timestamp, which is
  explicitly allowed; compliant (this was the Run 3 fix, unaffected by
  Run 4).
- Section I's restore `UPDATE` — **the Run 4 defect, now corrected** (see
  above). No other field in this statement violates any monotonic rule.

No additional latent positive-path defect was found beyond the one just
corrected. `share_session_grants`' and `share_browser_sessions`' own
writes were re-confirmed unchanged from the Run 3 scan (one compliant
`share_session_grants` revoke; no `share_browser_sessions` `UPDATE` at
all).

### Section I full sequence re-confirmed against the canonical lifecycle contract

active link → valid existing grant → disable (state+disabled_at+version
bump, matching `disable_share_link`) → existing grant row confirmed
unchanged in the DB (I1) → new grant creation confirmed rejected while
disabled (I2) → restore-to-active (state+version bump only, matching
`reenable_share_link`, disabled_at left untouched) — every step now
reproduces the real RPC's own writes exactly, and no step violates any
integrity-trigger rule.

**Next step at the time: retry file 03 (with all four corrections then in
the repository copy of the file — re-copy it fresh into the SQL Editor
before retrying) after another standalone `ROLLBACK;`. File 01 and file
02 still do not need to be re-run.** (Superseded by Run 5 below — the
retry progressed all the way through Section I this time, but hit a
fifth, unrelated harness defect in Section J before reaching the test
summary.)

## Run 5 — current

Same disposable Supabase project as Runs 1–4,
`text2task-phase3-application-runtime-temp`. File 01 and file 02 were
**not** re-run (still not required). The user ran a standalone
`ROLLBACK;` after Run 4's error, then re-copied the Run-1/2/3/4-corrected
`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql` fresh from the repository
and ran it. This attempt progressed further than any prior run — past
the entirety of Sections A–I — before failing in Section J.

### Result from file 03 (`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql`), fifth attempt

**One harness-only PostgreSQL function-overload type-resolution defect
was found in Section J's rate-limit sanity-check calls — the identical
class of defect already found and fixed once before, in
`docs/client-share-phase3-rate-limit-runtime/04_CAPTURE_RESULTS.md`'s own
Run 1. The RPC itself was never implicated; it correctly failed to
resolve a call whose argument types did not match its declared
signature.**

- Status: ☐ `runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS` ☑ Errored before completing (Section J, before the test summary) ☐ FAIL
- Exact error: `ERROR: 42883: function public.increment_share_rate_limit_bucket(unknown, unknown, text, integer, uuid, integer) does not exist` / `HINT: No function matches the given name and argument types. You might need to add explicit type casts.`, raised on the first `select public.increment_share_rate_limit_bucket('network_identity', 'session_exchange', repeat('8f', 32), 1, null::uuid, 300)` call in Section J.
- Root cause: the fourth positional argument (`p_identity_digest_version smallint`) was passed as a bare integer literal (`1`) at all five real call sites in Section J. PostgreSQL's function-argument overload resolution only implicitly **widens** `smallint → integer`, never **narrows** a bare `integer`-typed literal back down to `smallint`, so the call fails to resolve to the one real function (`increment_share_rate_limit_bucket(text,text,text,smallint,uuid,integer)`, confirmed present by the file's own safety gate) before the RPC body is ever entered. `p_share_link_id uuid` was already correctly cast (`null::uuid`) or supplied as an already-`uuid`-typed variable (`v_link_id`) at every call site — not implicated.
- Correction: all five real call sites now cast the literal explicitly as `1::smallint` — the exact same fix already applied once before, in `docs/client-share-phase3-rate-limit-runtime/03_RUN_PHASE3_RATE_LIMIT_RUNTIME_TESTS.sql`, for the identical class of defect. A comment was added above Section J explaining the cast requirement so a future edit to this section does not reintroduce it.
- A complete static scan of the remaining file (see below) found no other bare-literal type-resolution risk, no untyped `null`, no remaining inline-`INSERT`-as-expression pattern, and no lifecycle-monotonicity violation.
- Total tests / Passed / Failed: **not reached — the run errored on Section J's first RPC call, after Sections A–I's assertions had already executed successfully (their results are not preserved anywhere by this rolled-back run; only the error itself was observed).**
- Reached its own trailing `rollback;`? Not applicable — the error aborts the open transaction automatically; the user's own standalone `ROLLBACK;` returns the disposable database to a clean state before any retry.

### Complete static scan (performed as part of this correction)

- **Function calls with `smallint` parameters**: `increment_share_rate_limit_bucket` is the only such function actually *called* anywhere in the file (the `create_share_link_draft(uuid,text)` reference in the safety gate is only an existence-check string, never invoked) — all five call sites now cast explicitly.
- **Bare integer literals into table columns** (e.g. `digest_version`, `secret_digest_version`, `pin_hash_version`, all `smallint` columns): unaffected — a literal assigned directly to a known-typed `INSERT`/`UPDATE` target column is coerced by ordinary assignment-cast rules, a different (and permissive) resolution path from function-overload matching. No defect here.
- **Untyped `NULL` into `uuid`/`timestamptz`/`smallint` parameters**: none found — every `null` in the file is already written `null::uuid`; no bare `null` literal appears anywhere.
- **Malformed synthetic digest lengths/formats**: re-checked all `repeat('xx', 32)`-style identity digests used in Section J (`'8f'`, `'90'`, `'a1'`, `'b2'`) — all 64 lowercase-hex characters, matching `share_rate_limit_buckets_identity_digest_check`.
- **Positive-path writes violating integrity triggers**: none found beyond the ones already corrected in Runs 3–4 (re-confirmed unchanged and still compliant).
- **`INSERT`/`UPDATE` embedded as an expression**: none found — Run 2's fix is intact; only the explanatory comment mentioning the old pattern remains, not the pattern itself.
- **Lifecycle timestamp monotonicity**: none found — Runs 3–4's fixes re-confirmed unchanged and still compliant.

No additional latent positive-path defect was found beyond the one just corrected.

### Intentional negative tests (unaffected, unchanged)

Section J contains no negative test — all four of its assertions
(J1–J4) are positive-path (each expects the RPC call to succeed with a
specific `requestCount`). The pre-existing negative tests from Sections
C, E, G, H, and I (see Run 3's record above) were not touched by this
correction.

**Next step at the time: retry file 03 (with all five corrections then in
the repository copy of the file — re-copy it fresh into the SQL Editor
before retrying) after another standalone `ROLLBACK;`. File 01 and file
02 still do not need to be re-run.** (Superseded by Run 6 below — the
retry progressed through Sections A–J this time, reaching Section K,
before hitting a sixth, unrelated harness defect.)

## Run 6 — current

Same disposable Supabase project as Runs 1–5,
`text2task-phase3-application-runtime-temp`. File 01 and file 02 were
**not** re-run (still not required). The user ran a standalone
`ROLLBACK;` after Run 5's error, then re-copied the Run-1/2/3/4/5-
corrected `03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql` fresh from the
repository and ran it. This attempt progressed further than any prior
run — all the way through Section J — before failing in Section K.

### Result from file 03 (`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql`), sixth attempt

**One harness-only fixture defect was found in Section K's
`share_link_resources` setup INSERT — a `NOT NULL` column with no
default was simply omitted. This column has been `NOT NULL` since
`202608030003_client_share_owner_foundation.sql`, the very first Client
Share migration; it is not a Phase 2B-introduced requirement, and the
table/constraint were never implicated.**

- Status: ☐ `runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS` ☑ Errored before completing (Section K, before the test summary) ☐ FAIL
- Exact error: `ERROR: 23502: null value in column "public_label" of relation "share_link_resources" violates not-null constraint`, raised by `insert into public.share_link_resources (share_link_id, user_id, resource_id, can_download) values (v_link_id, '...', v_resource_id, true)` — `public_label` was never supplied.
- Root cause: `share_link_resources.public_label` is `text not null` with **no default**, additionally constrained by `share_link_resources_public_label_check` (trimmed length between 1 and 120). It has carried this exact shape since the table's original definition. The canonical production write path, `save_share_configuration(...)` (`202608060003_client_share_configuration_save.sql`), always requires the caller to supply `publicLabel` per resource item as owner-authored client-facing text (`v_resource_item->>'publicLabel'`, validated against the identical length bound before insert) — it is never derived from `task_resources`' own fields (the column's own comment: *"Owner-authored client-facing label. Deliberately a separate column and never task_resources.notes, which is an internal field."*). The harness's Section K fixture simply omitted this required column.
- Correction: added `public_label` to the INSERT's column list and supplied a deterministic, clearly-synthetic placeholder value, `'Runtime fixture resource label'` (23 characters, well within the 1–120 bound) — never derived from any private `task_resources` field (no `storage_path`, `file_name`, `notes`, or internal title), matching the same "owner-authored, never internal content" rule the real column enforces.
- A complete scan of every direct write to `share_link_resources` and `share_link_tasks` in the file (see below) found no other occurrence of this pattern.
- Total tests / Passed / Failed: **not reached — the run errored on Section K's second setup INSERT, after Sections A–J's assertions had already executed successfully (their results are not preserved anywhere by this rolled-back run; only the error itself was observed).**
- Reached its own trailing `rollback;`? Not applicable — the error aborts the open transaction automatically; the user's own standalone `ROLLBACK;` returns the disposable database to a clean state before any retry.

### Full `share_link_resources` / `share_link_tasks` fixture scan (performed as part of this correction)

Exactly one direct write to each table exists in the entire file, both in
Section K, both positive-path setup (no negative test touches either
table):

- `share_link_tasks` INSERT (`share_link_id, user_id, subtask_id,
  public_group`): complete against the current schema —
  `waiting_for_client_feedback` and `display_order` both have defaults
  (`false`, `0`) and were correctly left unsupplied; every `NOT NULL`
  column without a default (`share_link_id`, `user_id`, `subtask_id`,
  `public_group`) is supplied. No defect.
- `share_link_resources` INSERT: **the Run 6 defect, now corrected**
  (`public_label` added). `display_order` has a default (`0`) and
  remains correctly unsupplied; `can_download` was already supplied.

No additional latent positive-path fixture defect was found in either
table.

### Privacy-safety confirmation

The added `public_label` value (`'Runtime fixture resource label'`) is a
generic, obviously-synthetic placeholder string — it contains no
`storage_path`, no signed URL, no private note content, and no internal
Resource title. It does not touch, weaken, or bypass any Phase 2D
projection rule (`assembleClientProjection` in
`lib/share/client-share-projection.server.ts` is unrelated to this
harness file and was not read or modified as part of this correction).

**Next step at the time: retry file 03 (with all six corrections then in
the repository copy of the file — re-copy it fresh into the SQL Editor
before retrying) after another standalone `ROLLBACK;`. File 01 and file
02 still do not need to be re-run.** (Superseded by Run 7 below — the
retry progressed all the way through Sections A–J and into the second
setup INSERT of Section K before hitting a seventh, unrelated harness
defect.)

## Run 7 — current

Same disposable Supabase project as Runs 1–6,
`text2task-phase3-application-runtime-temp`. File 01 and file 02 were
**not** re-run (still not required). The user ran a standalone
`ROLLBACK;` after Run 6's error, then re-copied the Run-1/2/3/4/5/6-
corrected `03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql` fresh from the
repository and ran it. This attempt progressed further than any prior
run — past the `share_link_resources` fixture INSERT Run 6 had fixed —
before failing on the very next setup statement in the same section.

### Result from file 03 (`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql`), seventh attempt

**One harness-only fixture defect was found in Section K's
`share_link_updates` setup INSERT — two `NOT NULL` columns with no
default were omitted (only one triggered the immediate error;
`created_by` would have failed identically on the very next attempt).
Both have been `NOT NULL` since `202608030003_client_share_owner_foundation.sql`,
the very first Client Share migration; the table/constraints/trigger
were never implicated.**

- Status: ☐ `runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS` ☑ Errored before completing (Section K, before the test summary) ☐ FAIL
- Exact error: `ERROR: 23502: null value in column "version" of relation "share_link_updates" violates not-null constraint`, raised by `insert into public.share_link_updates (share_link_id, user_id, body, is_current) values (v_link_id, '...', 'Latest update body', true)` — `version` was never supplied (and neither was `created_by`, which would have failed the same way once `version` was fixed).
- Root cause: `share_link_updates.version integer not null` (no default, `share_link_updates_version_check: version > 0`, `share_link_updates_share_link_id_version_unique`) and `share_link_updates.created_by uuid not null references auth.users(id)` (no default) have both carried this exact shape since the table's original definition. The canonical production write path, `save_share_configuration`'s update-publication block (`202608060003_client_share_configuration_save.sql:696-730`), always computes `version` as `coalesce(max(version), 0) + 1` scoped to the link before inserting, and always sets `created_by = v_user_id` (the same user publishing the update) — `enforce_share_link_update_integrity` additionally rejects any insert where `created_by <> user_id` (`SHARE_UPDATE_CREATED_BY_MISMATCH`). The harness's Section K fixture omitted both columns.
- Correction: added `version` and `created_by` to the INSERT's column list. Because this is the first (and only) `share_link_updates` row this fixture ever creates for `link_no_pin_id`, the canonical formula (`coalesce(max(version), 0) + 1` over zero existing rows) evaluates to exactly `1` — not an invented number, the same value the real RPC would compute for this exact scenario. `created_by` was set to the same owner UUID (`11111111-1111-4111-8111-111111111111`) already used everywhere else in the fixture for `user_id`, satisfying the trigger's equality requirement.
- A complete scan of every direct write to `share_link_updates`, and a broader scan of `share_link_tasks`/`share_link_resources`/`share_link_updates`/`share_messages`/`share_message_conversions` (see below), found no other occurrence of this pattern.
- Total tests / Passed / Failed: **not reached — the run errored on Section K's third setup INSERT, after Sections A–J's assertions had already executed successfully (their results are not preserved anywhere by this rolled-back run; only the error itself was observed).**
- Reached its own trailing `rollback;`? Not applicable — the error aborts the open transaction automatically; the user's own standalone `ROLLBACK;` returns the disposable database to a clean state before any retry.

### Full `share_link_updates` fixture scan (performed as part of this correction)

Exactly one direct write to `share_link_updates` exists in the entire
file (Section K) — now corrected. `body` (safe synthetic text, within
the 1–5000-trimmed-character bound), `is_current = true` (the only row
for this link, so the partial unique index
`share_link_updates_current_version_unique_idx` is trivially satisfied),
and `share_link_id`/`user_id` ownership are all already correct and
unaffected by this fix.

### Broader public-content fixture scan (`share_link_tasks`, `share_link_resources`, `share_link_updates`, `share_messages`, `share_message_conversions`)

- `share_link_tasks`: one INSERT (Section K), already confirmed complete
  in Run 6's record — unchanged.
- `share_link_resources`: one INSERT (Section K), corrected in Run 6 —
  unchanged by this pass, re-confirmed still complete.
- `share_link_updates`: one INSERT (Section K) — **the Run 7 defect, now
  corrected** (see above).
- `share_messages` / `share_message_conversions`: **no direct write of
  any kind exists anywhere in the file** — confirmed by a full-file
  grep. This matches the file's own documented scope (Phase 3 only;
  comments/messages are explicitly Phase 4/5/6, out of scope) — no new
  Phase 5/6 behavior was added or needed.

No additional latent positive-path defect was found beyond the one just
corrected.

### Projection/privacy-safety confirmation

The corrected fixture row's `body` (`'Latest update body'`, unchanged
from before this fix) remains a generic synthetic string — no private
timeline content, no internal ID exposed through it. `version`,
`created_by`, and `is_current` are internal bookkeeping columns that
`buildPublicClientShareProjection` never selects at all (it selects only
`body, published_at` from `share_link_updates`, scoped to `is_current =
true`) — confirmed by re-reading `lib/share/client-share-projection.server.ts`'s
existing `buildPublicClientShareProjection` query, which was not modified
as part of this correction. Latest/current-update semantics (K4's
assertion) are unaffected.

**Next step at the time: retry file 03 (with all seven corrections then
in the repository copy of the file — re-copy it fresh into the SQL
Editor before retrying) after another standalone `ROLLBACK;`. File 01
and file 02 still do not need to be re-run.** (Superseded by Run 8 below
— the retry with all seven corrections in place ran to completion and
passed.)

## Run 8 — current, authoritative final SQL runtime result

Same disposable Supabase project as Runs 1–7,
`text2task-phase3-application-runtime-temp`. File 01 and file 02 were
**not** re-run (still not required — neither was ever implicated by any
of the seven prior errors). The user ran a standalone `ROLLBACK;` after
Run 7's error, then re-copied the fully Run-1–7-corrected
`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql` fresh from the repository
and ran it once.

### Result from file 03 (`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql`), eighth attempt — PASS

- Status: ☑ `runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS` ☐ FAIL ☐ Errored before completing
- Total tests / Passed / Failed: **28 / 28 / 0**
- Isolated FAIL-row evidence: none — the FAIL-only table was empty.
- Reached its own trailing `rollback;`? ☑ Yes — no fixture row or
  test-only object this file created (the shared project/link fixtures,
  every session/grant/rate-limit-bucket row produced by Sections A–K)
  survives; files 01/02's own committed schema/grants/RLS/sentinel are
  untouched by that rollback, and remain valid for any future re-run of
  this same disposable project.

This is the authoritative, final SQL runtime result for this package.
Runs 1–7 above remain the permanent record of the seven harness-only
defects found and corrected along the way — none of them were a
migration, RPC, trigger, or application-code defect; each was the SQL
harness file (`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql`) itself
being corrected to match the already-correct production contract.

## Notes

- **SQL/database runtime acceptance for Phase 3 is COMPLETE** — Run 8
  above is the authoritative `PHASE_3_APPLICATION_RUNTIME_PASS` result.
- No Production project was touched by any file in this package, in any
  of the eight runs.
- Production application of the ten migrations listed in
  `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` remains a separate,
  already-settled matter this package does not reopen or re-authorize.
- Enabling `TEXT2TASK_CLIENT_SHARE_ENABLED` in Production remains a
  separate, explicit, later decision — this package does not authorize it
  regardless of this PASS result.
- **Remaining acceptance (not covered by this package, still pending):**
  the browser/webview acceptance checklist
  (`PHASE3_BROWSER_WEBVIEW_CHECKLIST.md`) has not been executed; `npm run
  build` has not been run; no final Phase 3 commit has been made. Do not
  treat Phase 3 as fully accepted until those remaining items are also
  complete.
- If this package is ever run again (for example, after a genuine
  subsequent change to file 03 itself), add a new "Run 9" section above
  following the same structure, and update the summary line at the top of
  this file to point at whichever run is then current and authoritative.
