# Text2Task Client Share Link — Phase 1B Runtime Verification Report

**Status: `PHASE_1B_RUNTIME_VERIFIED_PASS`**

This status is exact and deliberate: real SQL, executed by the user in a
disposable Supabase project (`text2task-client-share-runtime-temp`), has
now proven this package's own runtime claims. This report distinguishes
two real runs, in order:

### A. Historical first complete runtime (superseded, kept for record)

A real run of this package (files 01, 02, 03), against a disposable
Supabase project, executed all 518 runtime assertions to completion:
**510 PASS, 8 FAIL** (`runtime_status = PHASE_1B_RUNTIME_FAIL`). Root-cause
analysis of all 8 failures (captured in `04_CAPTURE_RESULTS.md`'s Run 1)
found four independent causes:

- Two genuine **product/schema defects**, corrected in
  `supabase/migrations/202608030003_client_share_owner_foundation.sql`
  (`project_share_links_secret_digest_consistency_check` did not allow a
  never-activated draft to reach `state = 'revoked'`, even though
  `revoke_share_link` and `enforce_project_share_link_integrity`'s own
  state-transition matrix already both supported that transition) and
  `supabase/migrations/202608060002_client_share_access_operations.sql`
  (`rotate_share_link_secret` derived `rotated_at` from the
  transaction-fixed `now()`, so two real rotations of the same link inside
  one transaction could compute an identical timestamp and fail the
  strictly-monotonic `rotated_at` requirement `enforce_project_share_link_integrity`
  enforces).
- Two genuine **runtime-harness defects**, corrected in
  `docs/client-share-phase1b-runtime/03_RUN_PHASE1B_RUNTIME_TESTS.sql`
  (Section K's `K7` accidentally targeted a link whose project Section K's
  own `K6` had just archived, so it could only ever observe
  `PROJECT_ARCHIVED`, never `SHARE_LINK_REVOKED`; Section O's
  `O1-unchanged` compared two row snapshots with a plain `=`, which is
  NULL-sensitive and produced a false FAIL against a genuinely-unchanged
  row containing a `NULL` field).
- Four **cascade failures** (`J3-shape`, `J3-version`, `J3-event`, `P5`)
  that resolved automatically once their respective root cause was fixed.

This historical result is preserved deliberately, not erased: it is the
evidence that runtime execution (not static text inspection) is what found
and proved these four defects, and it documents exactly what was corrected
and why.

### B. Final fresh-project retest (current, authoritative)

After all four root causes above were corrected, a **fresh** disposable
Supabase project (`text2task-client-share-runtime-temp` — not the project
that produced the 8-failure result, whose live schema and RPC bodies still
reflected the pre-correction migrations) was built from scratch and this
exact package was run against it in order:

1. `01_CREATE_TEMP_TEST_FIXTURE.sql` — PASS, `fixture_status = READY`.
2. `02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql` — PASS, every
   expected function/table/trigger structural verification returned
   `found = true` (the corrected `202608030003` and `202608060002`
   content, freshly regenerated into this file, applied cleanly).
3. `03_RUN_PHASE1B_RUNTIME_TESTS.sql` — **PASS**:

   ```
   total_tests    = 520
   passed_tests   = 520
   failed_tests   = 0
   runtime_status = PHASE_1B_RUNTIME_PASS
   ```

   All three steps were run as the `postgres` role in the Supabase SQL
   Editor. The script reached its PASS path and executed the explicit
   trailing `rollback;` — no fixture row or test-only helper object this
   file created was committed or survives; files 01/02's own committed
   schema/grants/RLS/sentinel are untouched by that rollback, only what
   file 03's own transaction did. See `04_CAPTURE_RESULTS.md`'s Run 2 for
   the full captured evidence.

This 520/520/0 result is the current, authoritative runtime verification
outcome for Phase 1B. It supersedes the historical 518/510/8 result, which
remains above as record of what was found and fixed, not as a currently
outstanding failure.

**Whitespace-only source cleanup, byte-exact reconfirmation.** After the
520/520/0 result above, a `git diff --check` commit-gate pass found one
defect: a stray extra blank line at the end of file
`03_RUN_PHASE1B_RUNTIME_TESTS.sql`, unrelated to any runtime behavior. That
line was removed, `git diff --check` then passed cleanly, and the cleaned
file was rerun as-is against the same disposable Supabase project. It
again produced the identical result:

```
total_tests    = 520
passed_tests   = 520
failed_tests   = 0
runtime_status = PHASE_1B_RUNTIME_PASS
```

This was a source-formatting correction, not a product or runtime defect,
and is not counted or listed as a separate historical failure run. Its
purpose here is narrower and load-bearing: it confirms the exact file 03
now tracked in this repository -- byte-identical to the one whose SHA-256
is recorded in `MANIFEST.md` -- is itself the file that was runtime-verified,
not merely a near-identical predecessor differing only in trailing
whitespace.

### What this status does and does not mean

This status means Phase 1B's fourteen RPCs, their constraints, triggers,
grants, RLS posture, and the four corrected defects above, have all been
proven against a real, disposable PostgreSQL database. It does **not**
mean any of this has reached Production. Explicitly:

- **No Client Share migration has ever been applied to Production.** Every
  execution described in this report, in both runs, was against a
  disposable, temporary Supabase project created solely for this
  verification, never the production project.
- **Production application remains NOT AUTHORIZED** by this report or this
  package. See
  `docs/client-share-phase1b-runtime/05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`,
  which remains the authoritative statement of that restriction and is
  unaffected by this runtime PASS.
- **This runtime PASS does not itself authorize Production
  deployment/application.** It is evidence that the corrected
  implementation behaves as intended in an isolated database; deciding to
  apply these migrations to Production is a separate, deliberate action
  this report does not take and does not request.

## Purpose

Phase 1B of the Client Share Link feature delivered fourteen new
SECURITY DEFINER/INVOKER RPCs (plus the `project_share_secret_material`
table) across four migrations
(`202608050001`, `202608060001`, `202608060002`, `202608060003`), on top
of the three Phase 1A foundation/integrity migrations
(`202608030003`, `202608030004`, `202608030005`), each already covered by
their own colocated static `.test.ts` migration tests. Static tests
inspect migration SQL text; they cannot observe real PostgreSQL runtime
behavior (actual trigger firing, actual RLS filtering, actual grant
enforcement, actual transactional atomicity). This package closes that
gap: a complete, deterministic SQL Editor package that runtime-verifies
every one of the fourteen Phase 1B RPCs against a real, disposable
PostgreSQL database, intended to run only in a temporary Supabase
project, never in Production.

## Scope

In scope (see `03_RUN_PHASE1B_RUNTIME_TESTS.sql` sections A–R):

- Object and security presence for all 11 Client Share tables (existence,
  RLS), every explicitly-named constraint and explicit index created by
  the seven migrations (each bound to its exact owning table via
  `pg_constraint`/`pg_index`, never a bare aggregate count), every
  implicit primary key and foreign key the migrations create (verified
  STRUCTURALLY via `pg_constraint`/`pg_attribute` — exact owning table,
  exact column(s), exact referenced table/column, and exact `ON DELETE`
  behavior — never by depending on PostgreSQL's auto-generated constraint
  names, and never treated as out of scope), every delivered non-internal
  trigger (bound to its exact owning table via `pg_trigger`), and all 14
  Phase 1B RPCs verified signature-exact via `to_regprocedure`/OID (exact
  SECURITY INVOKER/DEFINER status, the exact fixed `search_path` value
  `public, pg_temp` parsed and compared as a normalized list rather than a
  wildcard prefix match, and the exact four-role EXECUTE grant profile —
  authenticated=yes, anon/PUBLIC/service_role=no — for all 14 RPCs,
  including the two owner-read ones).
- Owner-facing read RPCs (`get_share_link_management_state`,
  `list_share_link_summaries`).
- Draft creation and public-id collision handling.
- Activation and the one-active-link-per-project rule.
- Disable and re-enable.
- PIN set/clear.
- Expiry set/clear.
- Secret rotation.
- The reveal RPC.
- Revoke.
- Configuration save: settings, tasks, Resources, update publication.
- Configuration-save atomic rollback across five combined-failure
  scenarios, including a true post-retirement failure injected mid-RPC.
- The configuration-version / session-grant staleness contract.
- Tenant isolation and direct-access boundaries.
- A final safe-output inspection pass across captured RPC results.

Out of scope, deliberately:

- Re-running Phase 1A's own already-existing 207-assertion package
  (`docs/client-share-phase1a-sql-editor/`) — this package applies those
  three migrations as a prerequisite but does not duplicate their own
  test coverage.
- Any public, anonymous `/share/**` route, session exchange, PIN
  verification endpoint, or the public projection — none of that exists
  yet (Phase 3).
- UI/dashboard components.
- Production migration application (see
  `docs/client-share-phase1b-runtime/05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`).

## Authoritative migrations

Applied by file 02, in this exact order, verbatim and unmodified:

1. `202608030003_client_share_owner_foundation.sql`
2. `202608030004_client_share_session_foundation.sql`
3. `202608030005_client_share_integrity_and_security.sql`
4. `202608050001_client_share_owner_reads.sql`
5. `202608060001_client_share_lifecycle_operations.sql`
6. `202608060002_client_share_access_operations.sql`
7. `202608060003_client_share_configuration_save.sql`

Source and generated-output SHA-256 hashes are recorded in
`docs/client-share-phase1b-runtime/MANIFEST.md`.

## Package files

Ten approved files in total, across three locations: this report itself
(`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_RUNTIME_VERIFICATION_REPORT.md`,
1 file), the seven-file package under `docs/client-share-phase1b-runtime/`
(`00_READ_ME_FIRST.md` through `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`
plus `MANIFEST.md`), and two files under `scripts/client-share/`
(`build-phase1b-runtime-package.ps1` and its static test,
`build-phase1b-runtime-package.test.ts`) — see the package directory's own
`00_READ_ME_FIRST.md` for the full file-by-file description and
step-by-step run instructions.

## Fixture model

`01_CREATE_TEMP_TEST_FIXTURE.sql` creates a minimal, fail-closed stand-in
schema (`projects` with `is_archived` added relative to the Phase 1A
fixture, `tasks`, `clients`, `task_resources`, `project_updates`,
`project_timeline_events`) plus two deterministic `auth.users` identities
(Owner A `11111111-1111-4111-8111-111111111111`, Owner B
`22222222-2222-4222-8222-222222222222`). Actual project/task/Resource
fixture rows are created inside file 03's own transaction (its own
Section 2), captured via `RETURNING` and referenced throughout by stable
symbolic keys (`pg_temp.get_uuid('project_a1')`, etc.) rather than a
second layer of hard-coded literals — `public.tasks.id` is a bigint
`generated always as identity` column that does not accept an explicit
inserted value, which rules out literal task-id fixtures entirely. The
fixture covers: an active project, a second active project, an archived
project, a soft-deleted project and a cross-owner project for Owner B; a
valid task in the primary project, a valid task in the second project, a
task with no project, a soft-deleted task, and a cross-owner task; a
direct-project Resource, a task-derived Resource, a Resource in the
second project, a cross-owner Resource, and an orphan Resource with
neither a project nor a task.

## Authenticated SQL Editor claim simulation

Every RPC assertion is issued **as the actual caller role** the RPC is
designed for (`authenticated`, simulating `auth.uid()` via the same
`request.jwt.claims` GUC Supabase's own `auth.uid()` reads), never as the
Postgres superuser standing in for an owner — this is the key
methodological difference from the Phase 1A package, which tested
trigger behavior largely as the superuser because no owner-facing RPC
existed yet at that time. `pg_temp.act_as(role, user_id)` resets to the
superuser identity first, then sets the claim and switches role; a
preliminary harness self-test (`H-UID-A`/`H-UID-B`/`H-UID-ANON`) proves
`auth.uid()` actually resolves to the intended identity, or to `null`,
before any RPC test relies on it.

## Runtime result format

Every check produces exactly one row in a temporary `_test_results`
table (internal columns: `seq, section, test_code, description, status
(PASS/FAIL), expected, actual, detail`). The script's user-visible
`SELECT` output renames these to the required public column names:
`test_number, section, test_name, description, status, expected, actual,
details`. The script ends by displaying the full result table (public
names), an isolated FAIL-rows-only query (same public names), and a
summary row (`total_tests, passed_tests, failed_tests, runtime_status`),
all **before** a final guard raises a `P0001` exception if any test
failed — so a FAIL run never hides the evidence a PASS run would show.
On a PASS run the script's explicit final `rollback;` statement is
reached and executed. On a FAIL run, the guard's raised exception puts
the open transaction into a failed/aborted state before that statement
is ever reached — no further statement in it can be committed, and it is
`ROLLBACK` (or the connection simply closing) that actually ends the
transaction and discards its uncommitted work, not the exception itself
and not any particular line being reached. Either way — explicit
`ROLLBACK` on PASS, or the transaction ending as failed on FAIL — no
fixture row or test-only helper object is ever committed or survives, but
a FAIL run should never be described as "the script rolled back" as if
that trailing statement itself executed. Either way, the script is safe
to re-run against the same disposable project as many times as needed
(provided files 01/02 are not re-run).

Total runtime checks: the source file contains several hundred individual
assertion call sites (`try_rpc` RPC-call assertions, `try_stmt`
direct-statement assertions, and `record_result` state/shape assertions,
including one row per expected constraint/index/trigger/RPC-signature
check in Section A and per harness self-test). Some of these are static
call sites; others are loops that emit one row per catalog object or per
RPC (for example, Section A's constraint/index/trigger/signature loops).
Because of that, a source-level call-site count is **not** the
authoritative check count — the authoritative, exact figure is whatever
`total_tests` the script itself reports when actually run. This report
deliberately does not assert a precise pre-execution number.

## Sections A–R coverage

See `03_RUN_PHASE1B_RUNTIME_TESTS.sql`'s own section headers for the
complete, itemized list — Object/security presence (A), owner read RPCs
(B), draft creation and collision (C), activation and one-active-link
(D), disable/re-enable (E), PIN set/clear (F), expiry set/clear (G),
secret rotation (H), reveal (I), revoke (J), configuration save —
settings/tasks/Resources/update publication (K/L/M/N), atomic rollback
(O), configuration-version/session-grant contract (P), tenant isolation
(Q), and final safe-output inspection (R).

## Expected-error capture design

`pg_temp.try_stmt` and `pg_temp.try_rpc` both require an exact expected
`SQLSTATE` for every expected-failure assertion (never `null` for a
failure case) and, for every stable `P0001` error, the exact expected
message string — never a substring match, never a broad
`WHEN OTHERS THEN PASS`. An unexpected `SQLSTATE`/message combination is
recorded as a FAIL with both the expected and actual values, never
silently treated as a pass.

## Atomic rollback tests (Section O)

Five scenarios, each snapshotting relevant state before and after an
expected-failure combined `save_share_configuration` call: (1) valid
settings + an invalid task; (2) valid task replacement + an invalid
Resource; (3) valid settings/mappings + an invalid update body; (4) a
valid update body + an invalid task, proving the retire-then-insert
publish sequence can never run partially when the failure is in
pre-validation (tasks are validated and applied before the publish
sub-operation in the RPC's own body, so an invalid task prevents the
publish step from running at all); (5) a **true post-retirement**
failure: a narrowly-scoped, distinctively-named test-only `BEFORE INSERT`
trigger is attached to `public.share_link_updates` for the lifetime of
one test only, configured to raise only for one unmistakable test-only
body string, so a genuinely valid `publishUpdate` call reaches and
executes the real retire step (`is_current = false` on the old row)
before the injected failure fires on the new row's `INSERT` — proving the
whole RPC call, including the already-executed retirement, rolls back
together. The trigger and its function are dropped again immediately
after the assertion. Every `try_rpc` call already gets a real PostgreSQL
subtransaction rollback structurally (a PL/pgSQL exception handler is
implemented as a savepoint), so these assertions make an already-
structural guarantee observable, not just theoretical — scenario (5)
specifically exercises the failure point the other four cannot reach.

## Tenant isolation tests (Section Q)

Owner B cannot read Owner A's project via either read RPC, cannot mutate
Owner A's link, cannot map Owner A's task/Resource onto Owner B's own
link (rejected generically, no cross-tenant existence leak), cannot
directly `SELECT` `project_share_secret_material`, and a nonexistent link
id vs. a real link id owned by someone else produce the byte-identical
`SQLSTATE`/message. `anon` cannot execute any owner RPC (both a catalog
check and real attempted calls, rejected at the grant layer). Ordinary
`authenticated` direct table mutation remains denied on every owner-facing
Client Share table.

## Session-grant / configuration-version tests (Section P)

Real `share_browser_sessions`/`share_session_grants` fixture rows are
inserted directly as `service_role` (the only role with any grant on
those tables), through the real `enforce_share_session_grant_integrity`
trigger, never as synthetic rows that bypass it. A genuine settings
change, a PIN change, a genuine `set_share_link_expiry` change (null to a
transaction-relative future timestamp — never a direct mutation of the
grant to manufacture staleness), and a secret rotation each independently
make a grant created at the pre-change version detectably stale — for the
expiry case specifically, the existing grant row is additionally proven
to still exist and to be unrewritten (its own id and stored
`granted_configuration_version` unchanged) before the live link version
is compared against it. A combined task-only + Resource-only + update-only
save leaves a grant current (configuration_version untouched); revocation
also makes a grant stale. No owner RPC exercised in this section deletes
or rewrites any grant row. This package does not implement, and does not
need to implement, the future Phase 3 public grant-validation read path
itself.

## Safe-output inspection (Section R)

Every RPC result captured earlier in the file is inspected via a
**recursive** JSON key walk (a `pg_temp.recursive_json_keys` helper that
descends into every nested object and array, not just the top level and
the single `link` sub-object) for the absence of `userId`, `secretDigest`,
`secret`, `pinHash`, `pinSalt`, `ciphertextHex`/`nonceHex`/`authTagHex`
(outside the reveal RPC's own result), `storagePath`, `signedUrl`,
`plaintext`, `pin`, `rawInput`, `phone`, `email`, `notes`, `contactName`,
`clientName`, `amount` and `priority`. `projectId` is handled as its own
targeted check rather than a blanket forbidden key: ordinary lifecycle/
access/config-save results are asserted to never contain it (recursively),
while `list_share_link_summaries` results are asserted to intentionally
contain it (an approved field on that specific RPC, not a leak).
`reveal_share_link_secret`'s own result is confirmed to be the only one
carrying encrypted-material fields; it is separately, recursively checked
against the full private/security forbidden-key list (everything the
generic sweep rejects, minus the encrypted-material fields it alone is
allowed to carry), and its TOP-LEVEL key set is confirmed to be exactly
the approved six-field SQL contract (`linkId`, `publicId`, `ciphertextHex`,
`nonceHex`, `authTagHex`, `encryptionVersion`) with no extra field of any
kind.
`get_share_link_management_state` is confirmed, via a fresh live call made
after real publications exist, to intentionally include the owner's own
current update body (an approved exception — the owner reading their own
content); `save_share_configuration`'s own `currentUpdate` is confirmed to
never include it.

## Additional runtime rigor

- **Section B (owner reads)**: the owner-B claim is established via
  `act_as()` *before* the cross-owner `get_share_link_management_state`
  call it tests, not after — a corrected ordering bug fixed during review
  (the earlier ordering would have called the RPC while still
  authenticated as owner A, guaranteeing a false result against a correct
  database).
- **Section I (reveal)**: all four non-active states that must reject
  reveal are covered — draft, disabled, revoked, and now **expired**
  (reusing Section G10's real `state = 'expired'` fixture, persisted
  specifically for this reuse, rather than constructing a second one or
  manufacturing the state immediately before the call).
- **Section J (revoke)**: every supported source state — draft, active,
  disabled, and now **expired** (reusing the same G10 fixture) — is proven
  to transition to revoked, each with a real before/after check that
  `configuration_version` increased by exactly one and exactly one new
  `link_revoked` event was created (not just the RPC's own returned
  shape). A dedicated link carrying a real task mapping, a real Resource
  mapping and a real published update — all created through
  `save_share_configuration` itself, never by direct mutation — is
  revoked and its curated content and publication history are proven
  byte-identical afterward, alongside the existing encrypted-material
  retention proof.
- **Section H (rotation)**: the missing-material rotation failure (H4) now
  proves full rollback — `secret_digest`, `secret_digest_version`,
  `rotated_at`, `configuration_version` and `state` are all snapshotted
  before and after and proven unchanged, no `link_rotated` event exists,
  and no material row unexpectedly appeared — not just the error code and
  a material-row count.
- **Section D (activation)**: the failed-activation rollback proof (D10)
  now checks every field a successful activation would have set —
  `secret_digest`, `secret_digest_version`, `activated_at`,
  `configuration_version` (at its exact pre-activation value), `state`,
  and the absence of any `link_activated` event — not just state and a
  material-row count.
- **Section F (PIN)**: after `set_share_link_pin` succeeds, the raw row is
  read directly (never through public RPC output) and all seven PIN
  columns are proven to exactly equal the supplied deterministic V1
  profile; after `clear_share_link_pin` succeeds, all seven columns are
  proven NULL. This is runtime format proof, independent of the existing
  checks that PIN material never appears in RPC output or events.

## Known limitations

- **Concurrent-session races**: every lock-order/one-active-link
  assertion is exercised through ordinary sequential calls inside one SQL
  Editor session. This proves the lock order and the business rule are
  present and correct for sequential callers; it cannot, by itself, prove
  true concurrent-multi-connection race behavior as strongly as a
  dedicated multi-connection integration harness would.
- **No decryption performed**: this package proves `reveal_share_link_secret`
  returns only already-encrypted material in the documented shape. It
  never decrypts. Server-side AES-256-GCM decryption is implemented and
  tested only in `lib/share/share-secret-encryption.server.ts` and its own
  TypeScript tests.
- **No public anonymous flow exists yet**: Phase 3 (public `/share/**`
  routes, session exchange, PIN verification endpoint, public projection)
  is not implemented, so nothing about it is or could be tested here.
- **No deleted/unavailable Resource sub-case is simulated**: the delivered
  `public.task_resources` contract that `enforce_share_link_resource_integrity`
  and `save_share_configuration` actually read has no deleted/unavailable/
  soft-delete column at all — neither the trigger nor the RPC ever
  consults one. Section M's fixture and tests therefore deliberately do
  not invent one; the "deleted/unavailable Resource" runtime sub-case this
  package's requirements name is documented here as not applicable to the
  schema actually delivered, rather than simulated against a guessed
  column that does not exist. `01_CREATE_TEMP_TEST_FIXTURE.sql`'s own
  header carries the same statement.
- **Production application is not authorized** by this package or this
  report — see
  `docs/client-share-phase1b-runtime/05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.
- **Successful static package generation is not runtime proof**: a
  passing `build-phase1b-runtime-package.test.ts` run (structural
  inspection of the package's source files) proves the package is
  well-formed. It does not execute any SQL and proves nothing about
  actual database behavior.
- **Final approval was gated on the user's captured SQL result, and that
  gate has now been satisfied**: this report's status is
  `PHASE_1B_RUNTIME_VERIFIED_PASS`, recorded after the user ran file 03
  against a fresh disposable Supabase project (built from file 01 and the
  regenerated file 02 embedding the corrected migration content) and it
  returned `total_tests = 520, passed_tests = 520, failed_tests = 0,
  runtime_status = PHASE_1B_RUNTIME_PASS`, captured in
  `docs/client-share-phase1b-runtime/04_CAPTURE_RESULTS.md`. This does not
  authorize Production application -- see
  `docs/client-share-phase1b-runtime/05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.
