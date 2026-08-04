# Text2Task Client Share Link — Phase 1A SQL Editor Verification Package Report

## 1. Verdict

Complete, including ten subsequent correction passes (see sections 17,
20, 21, 22, 23, 24, 25, 26, 27, and 28). A
self-contained, browser/copy-paste-only SQL Editor verification package
was created for the three approved, reviewed Phase 1A Client
Share Link migrations. As of this correction, `git status` still reports
all three migration files (and their colocated tests) as untracked, not
committed -- "approved" refers to their having passed static
SQL-contract review and this package's own repeated static self-audits,
not to git history.

**Status update (section 23): SQL execution has now actually occurred.**
As of the fifth correction pass, the package's first real run against a
disposable, non-production Supabase project has taken place. Files 01
and 02 both succeeded. File 03 did not complete -- it hit a masking
secondary error, now fixed (a fail-closed dependency guard was missing).
Runtime PASS has still **not** been achieved; that remains the outcome of
a future run. No production credential was used, no Text2Task production
project was accessed, and, **through section 23**, no existing Phase 1A
file (migrations, migration tests, files 01 or 02) had been modified by
this or any correction pass -- only this package's own
`03_RUN_PHASE1A_RUNTIME_TESTS.sql`, `04_CAPTURE_RESULTS.md`, and this
report. **This no longer holds as of section 25** -- see that section's
status update below and section 3 for what changed.

**Status update (section 24): a second real run has now occurred.** The
prior pass's `require_id` guard worked exactly as designed and exposed
L1's real recorded failure: `SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED`,
proving `link_e1` was not actually PIN-protected at L1 despite E18 being
the step intended to make it so. The sixth correction pass adds a new,
more general fail-closed guard (`pg_temp.require_test_pass`), applies it
immediately after E18 (plus a direct state check of `link_e1`'s PIN
columns) so the next run stops right there and exposes E18's own real
outcome instead of surfacing three sections later at L1, and audits every
other expected-success state dependency in the file the same way. Runtime
PASS has still **not** been achieved, and the underlying reason
`link_e1` was not PIN-protected at L1 is still unknown -- that remains
the outcome of a future run (Run 3). No production credential was used,
no Text2Task production project was accessed, and no existing Phase 1A
file (migrations, migration tests, files 01 or 02) was modified by this
or any correction pass, through section 24.

**Status update (section 25): a third real run has now occurred, and it
exposed a real migration defect (not a harness defect).** The E18 guard
added in the sixth correction pass worked exactly as designed and
exposed the true root cause: `project_share_links_pin_encoding_check` in
migration 003 used the regex bound `{32,512}`, which exceeds
PostgreSQL's regex engine's supported repetition-count range of 0-255,
so the CHECK expression itself raised SQLSTATE 2201B
(`invalid regular expression: invalid repetition count(s)`) for any
non-null `pin_hash` -- meaning E18 could never have persisted a PIN,
in this disposable project or in production, until this constraint was
fixed. The seventh correction pass fixes that constraint directly in
`202608030003_client_share_owner_foundation.sql` (an explicit
`char_length(...) between ...` clause replaces the invalid regex bound,
preserving the exact intended semantics), adds regression tests, and
regenerates file 02 and `MANIFEST.md` from the corrected migration. This
is the **first** correction pass in this package's history to modify a
migration file, its colocated test file, file 02, or `MANIFEST.md` --
every prior pass touched only this package's own
`03_RUN_PHASE1A_RUNTIME_TESTS.sql`, `04_CAPTURE_RESULTS.md`, and this
report. **Through section 26**, runtime PASS had still not been achieved,
and the fix had not yet been verified at runtime -- that remained the
outcome of a future run (Run 4) against a clean disposable database,
since the existing disposable project's applied schema still carried the
old, invalid constraint. No production credential was used and no
Text2Task production project was accessed. **This no longer holds as of
section 27** -- Run 4 has since completed and passed; see that section.

**Status update (section 27): Runtime Run 4 has now occurred, and it
passed.** The ninth correction pass is documentation-only -- no SQL,
migration, migration test, hash, or package script was changed. The user
executed files 01, the regenerated file 02 (corrected migration 003),
and 03, in that order, against a fresh, clean disposable Supabase
project (`text2task-phase1a-temp-test-v2`, not the project Runs 1-3
used). File 01 succeeded; file 02's structural verification returned
`found = true` for all 10 tables, 9 functions, and 13 triggers; file 03
completed with `runtime_status = PASS` and `total_tests = 207,
passed_tests = 207, failed_tests = 0` -- the first successful
clean-database runtime execution of this package. The transaction rolled
back as designed; no fixture rows persisted; production was never
accessed. **This confirms the seventh correction pass's migration 003
fix at runtime.** It does **not**, by itself, authorize applying these
migrations to the Text2Task production project -- production application
remains a separate, explicit decision and step (see
`05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`). See section 27 for the
full record, including the confirmed, mechanical explanation of why 207
is exactly the correct assertion-call-site count (144 `try_stmt` + 63
independent `record_result` calls, excluding the one `record_result`
call internal to `try_stmt`'s own implementation) -- the earlier
unqualified figure of "208" was a naive grep total, not a valid
assertion-call-site count.

## 2. Package purpose

The three Phase 1A migrations
(`202608030003_client_share_owner_foundation.sql`,
`202608030004_client_share_session_foundation.sql`,
`202608030005_client_share_integrity_and_security.sql`) have static
SQL-contract tests (342 passing assertions across the three colocated
`.test.ts` files as of the seventh correction pass, section 25; 336 as
originally validated), but static text inspection cannot prove runtime
database behavior — RLS, grants, triggers, and cascades. This package lets
a non-developer apply the exact same migrations to a disposable, empty
Supabase project and run real behavioral tests against them, entirely
through the Supabase Dashboard's SQL Editor, with no terminal, Docker, or
Supabase CLI required.

## 3. Exact files created

1. `docs/client-share-phase1a-sql-editor/00_READ_ME_FIRST.md`
2. `docs/client-share-phase1a-sql-editor/01_CREATE_TEMP_TEST_FIXTURE.sql`
3. `docs/client-share-phase1a-sql-editor/02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql` (mechanically generated)
4. `docs/client-share-phase1a-sql-editor/03_RUN_PHASE1A_RUNTIME_TESTS.sql`
5. `docs/client-share-phase1a-sql-editor/04_CAPTURE_RESULTS.md`
6. `docs/client-share-phase1a-sql-editor/05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`
7. `docs/client-share-phase1a-sql-editor/MANIFEST.md`
8. `scripts/client-share/build-phase1a-sql-editor-package.ps1`
9. `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1A_SQL_EDITOR_PACKAGE_REPORT.md` (this file)

Nine files, matching the task's strict allowlist exactly, were created
during initial package construction. No other file was created or
modified **at that time**.

**This is no longer the complete picture as of section 25.** The
confirmed runtime defect exposed by Runtime Run 3 (SQLSTATE 2201B, an
invalid regex repetition bound in
`project_share_links_pin_encoding_check`) later required the seventh
correction pass to intentionally modify:

- `supabase/migrations/202608030003_client_share_owner_foundation.sql`
  (the migration itself -- the fix)
- `supabase/migrations/202608030003_client_share_owner_foundation.test.ts`
  (its colocated test -- new regression coverage)
- `docs/client-share-phase1a-sql-editor/02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql`
  (regenerated from the corrected migration, via the unmodified
  generator)
- `docs/client-share-phase1a-sql-editor/MANIFEST.md`
- `docs/client-share-phase1a-sql-editor/04_CAPTURE_RESULTS.md`
- this report

No file outside this list, and no file outside the original nine plus
these six, was modified. In particular,
`supabase/migrations/202608030004_client_share_session_foundation.sql`,
`supabase/migrations/202608030005_client_share_integrity_and_security.sql`,
their colocated test files, and
`docs/client-share-phase1a-sql-editor/03_RUN_PHASE1A_RUNTIME_TESTS.sql`
remained unchanged throughout the seventh correction pass (verified by
byte-identical SHA-256 hashes -- see section 25). No unauthorized file
was modified at any point in this package's history.

## 4. Why Docker/local Supabase is not used

The task's own instructions rule out Docker, a local Supabase instance,
and the Supabase CLI, in favor of a real, hosted, disposable Supabase
project reachable from a browser with zero local tooling. This keeps the
verification path usable by a non-developer and avoids depending on
Docker Desktop, CLI installation, or local Postgres version drift from
what Supabase actually runs in production. The tradeoff, stated plainly:
this package cannot be run unattended or in CI — it requires a human to
create a temporary project and paste three files in order.

## 5. Safety-sentinel design

`01_CREATE_TEMP_TEST_FIXTURE.sql` creates
`public.text2task_client_share_phase1a_test_sentinel`, a single-row table
(enforced by a `check (id)` on a `boolean primary key default true`
column) whose `project_kind` column reads
`'DISPOSABLE_PHASE_1A_SQL_EDITOR_TEST_PROJECT'`. Files 02 and 03 both
begin with a `do $$ ... $$` block that raises a P0001 exception and
refuses to proceed unless this sentinel exists and its `project_kind`
matches exactly. File 02's preamble additionally refuses to run if
`public.project_share_links` already exists, so it can never silently
"adopt" or overwrite a table it did not create. File 01 itself refuses to
run at all if any of the six real base-schema table names
(`projects`, `tasks`, `clients`, `task_resources`, `project_updates`,
`project_timeline_events`) already exist under `public`, which is the
first line of defense against ever running this in a populated project.

## 6. Fixture schema and limitations

`01_CREATE_TEMP_TEST_FIXTURE.sql` creates minimal, test-only versions of
the six existing tables the Client Share migrations reference by foreign
key, using the verified production identifier types from
`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_0_MAPPING_2026-08-03.md`'s
addendum (`projects`/`clients`/`task_resources`/`project_updates`/
`project_timeline_events` = `uuid`, `tasks` = `bigint`). It also inserts
two deterministic `auth.users` test identities (Owner A
`11111111-1111-4111-8111-111111111111`, Owner B
`22222222-2222-4222-8222-222222222222`) using a placeholder, never-used
`encrypted_password` value, since file 03 simulates identity entirely
through the `request.jwt.claims` setting Supabase's own `auth.uid()`
reads — no real login ever happens.

**Explicit limitation:** this fixture is deliberately minimal, not a full
copy of the production schema. It does not reproduce the real
`task_resources` dual/overlapping `resource_type` CHECK constraint
conflict (documented as out of scope for Phase 1A in both the Phase 0
addendum and the Phase 1A database foundation report), any RLS policy
beyond a single owner-SELECT policy needed for completeness, or any column
the Client Share migrations do not reference. Passing tests against this
fixture proves the migrations behave correctly against a *schema shaped
like* the real one in the ways that matter to these triggers; it does not
independently re-verify the live production schema itself (that
verification already happened separately and is recorded in the Phase 0
mapping addendum).

## 7. How file 02 is mechanically generated

`scripts/client-share/build-phase1a-sql-editor-package.ps1` reads the
three source migrations from `supabase/migrations/` with
`Get-Content -LiteralPath ... -Raw`, normalizes line endings to LF in
memory only (the source files on disk are never written to), and
concatenates a safety preamble, each migration verbatim with `BEGIN/END`
comment markers, and a final structural verification query into
`docs/client-share-phase1a-sql-editor/02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql`.
Before writing, the script resolves the output path and refuses to run if
it does not resolve to exactly
`docs/client-share-phase1a-sql-editor/02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql`.
After writing, it mechanically re-verifies that each source's `BEGIN`
marker appears in the output exactly once, and that the three markers
appear in ascending order (003, then 004, then 005), raising a terminating
error otherwise.

## 8. Source and bundle hashes

**As originally generated, before the seventh correction pass.** Computed
by the generator (SHA-256 of LF-normalized content):

| File | SHA-256 |
|---|---|
| `202608030003_client_share_owner_foundation.sql` | `17dfd9579ba13eaf627396ec01bc093064357a2d1c19e2575c88c2e075d881d5` |
| `202608030004_client_share_session_foundation.sql` | `e0cfff71635e32968ee21b7470dafc8075b6ca5b271aaab352af26705a70cdb9` |
| `202608030005_client_share_integrity_and_security.sql` | `1574b6ea45218219751e70fbbbe32ac8636e090f6955631449829a4ac1edc12d` |
| `02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql` (generated) | `17194644800977f1c71debe20284b96d448a3144e30a246bec6b96d976c18b4d` |

**These values are no longer current for migration 003 or file 02.**
The seventh correction pass (section 25) fixed a confirmed regex defect
in migration 003 and regenerated file 02, changing both hashes; 004 and
005 stayed byte-identical, so their hashes above remain current. For the
current, authoritative hash of every file (both old and new, side by
side), see `docs/client-share-phase1a-sql-editor/MANIFEST.md`, which is
kept up to date -- not this table, which is left exactly as originally
recorded for historical reference. Reproducible by re-running the
generator.

## 9. Runtime-test section inventory (`03_RUN_PHASE1A_RUNTIME_TESTS.sql`)

Updated by the section 21 correction pass to match the actual current
file. Every expected-failure assertion specifies an exact expected
SQLSTATE (P0001 for stable trigger errors, 42501 for permission-denied,
23505 for unique-constraint violations, 23514 for CHECK-constraint
violations) in addition to, where applicable, the exact stable trigger
message — see `try_stmt`'s 7-argument signature in section 10.

| Section | Covers | Test codes (approx. count) |
|---|---|---|
| HARNESS | Preliminary self-test: each switched role can use the temporary harness itself (`_fixture_state`/`_test_results`) before any product-boundary test relies on it | 3 |
| A | Table/RLS/function/trigger existence | 5 |
| B | Anonymous role denial (all SQLSTATE 42501) | 6 |
| C | Authenticated role + RLS row isolation | 12 |
| D | Service-role column-minimal privileges | 22 |
| E | `project_share_links` integrity (ownership, immutability, state machine, PIN encoding, version-bump requirement) | 25 |
| F | `share_link_tasks` integrity | 7 |
| G | `share_link_resources` integrity (real cross-owner case, separate nonexistent-resource case) | 8 |
| H | `share_link_updates` integrity (publication order corrected; full field-immutability set H4-H4g) | 12 |
| I | `share_messages` integrity (client vs. owner authorship, lifecycle, threading, real hidden-parent case, column-grant vs. trigger-level boundary, disabled/expired/deleted-project links) | 25 |
| J | `share_message_conversions` integrity + traceability (owner-authored-message-rejected case, target_task_id SET NULL case) | 11 |
| K | `share_browser_sessions` integrity (full lifecycle: format, immutability, revocation) | 14 |
| L | `share_session_grants` integrity (multi-link, revocation isolation, PIN-required/unexpected, revoked/expired session, disabled/expired/revoked link, deleted project, expiry-exceeds-link, future version, full identity-field immutability) | 30 |
| M | Cascade behavior on delete (link, session, task, resource) | 11 |
| N | No automatic product/CRM/timeline mutation (message insert and conversion insert) | 7 |
| O | Rate-limit bucket schema behavior | 9 |

**Exact mechanical count and its confirmed reconciliation with Run 4:**
`03_RUN_PHASE1A_RUNTIME_TESTS.sql` contains **144** direct
`perform pg_temp.try_stmt(...)` call sites. A plain textual grep for
`perform pg_temp.record_result(...)` finds **64** occurrences -- but
exactly **one** of those 64 is not an independent assertion call site:
it is the single `perform pg_temp.record_result(p_section, p_code,
p_desc, v_pass, v_detail);` line inside `try_stmt`'s own function body
(the mechanism by which each of the 144 `try_stmt` calls records its own
outcome, not a separate assertion). Excluding that one helper-internal
line leaves **63** independent `record_result` assertion call sites.
**144 + 63 = 207**, which is the exact, fully explained total of
independent assertion call sites in this file -- not an approximation
and not merely a static count. **Runtime Run 4 (see section 27) executed
this file against a clean disposable Supabase project, after the
migration 003 fix, and produced exactly 207 result rows**
(`total_tests = 207, passed_tests = 207, failed_tests = 0,
runtime_status = PASS`), matching this reconciled count exactly. There is
no unexplained difference, no mutually-exclusive-branch hypothesis
needed, and no missing or non-executed assertion. **An earlier,
unqualified figure of "208" (144 + 64, without excluding the one
helper-internal `record_result` line) was a naive grep total, not a
valid assertion-call-site count, and should be read as superseded by this
144 + 63 = 207 reconciliation everywhere in this report.** The
per-section table above is a coverage breakdown for orientation only;
its per-section subtotals do not sum to exactly 207 due to a small
number of multi-line calls that a simple same-line grep undercounts, and
because the table's own counts were not re-derived from this
reconciliation -- re-verify with
`grep -oE "'[A-Z]+', '[A-Za-z0-9-]+'" ... | sort | uniq -c` for an exact
per-section breakdown if needed. Everything is a real executed statement
or a real catalog check; nothing asserts against migration SQL text.

**Honesty note on coverage:** this is a first-pass, carefully self-reviewed
implementation, not a literal, exhaustive enumeration of every single
bullet in the originating task's runtime-test-matrix specification (which
listed over 25 top-level items, several with further sub-bullets). Every
lettered section (A-O) has genuine, real coverage of its most
security-critical assertions (ownership mismatch, cross-project rejection,
immutability, monotonicity, cascade correctness, no-automatic-mutation);
a smaller number of narrower edge cases from the original spec (for
example, every individual PIN-field-completeness variant, or literal
concurrent-request atomic-increment behavior for rate-limit buckets,
which the report's own scope note says cannot be verified because no
increment operation exists yet) were not separately automated. This is
stated plainly rather than claimed as complete, per the task's own
fail-closed instruction not to claim more verification than actually
happened.

## 10. Confirmation: real SQL behavior tests, not regex tests

Every `03_RUN_PHASE1A_RUNTIME_TESTS.sql` assertion is either (a) a real
`INSERT`/`UPDATE`/`DELETE` executed via dynamic SQL inside a
`pg_temp.try_stmt(...)` helper that compares the actual success/failure
outcome and, where applicable, the actual raised P0001 message text
against expectation, or (b) a real Postgres catalog/privilege check
(`has_table_privilege`, `has_column_privilege`, `pg_policies`,
`pg_trigger`, row-count queries executed under a real RLS-scoped role via
`SET LOCAL ROLE` and a simulated `request.jwt.claims`). No assertion
inspects migration SQL text.

## 11. Confirmation: no SQL was executed BY THIS AGENT, in any correction pass, including this one

Every correction pass on this package's files -- `03_RUN_PHASE1A_RUNTIME_TESTS.sql`,
`01`, `02`, and, as of the seventh correction pass (section 25),
migration `202608030003_client_share_owner_foundation.sql` and its
colocated `.test.ts` file -- across the whole history of this package
including the present (eighth, documentation-only) pass, was authored
and statically self-audited only -- this agent has never run SQL against
any database, never used the Supabase CLI, and never accessed a Supabase
project. The only executable steps any correction pass has performed are
running the PowerShell generator (file concatenation and SHA-256 hashing
only) and the repository's own Vitest suite for the (now, as of section
25, one intentionally modified plus two unmodified) `.test.ts` files, per
each task's own "Allowed Validation" list. Authoring or editing SQL text
in a file is not executing it; this confirmation is about the latter and
remains true without exception across every pass.

**This is separate from, and does not contradict, section 23**: the
package's first real SQL execution happened, but it was performed by the
**user**, manually, by pasting files 01/02/03 into the Supabase SQL
Editor of a disposable, non-production temporary project -- not by this
agent, and not through any tool this agent has access to. Every prior
version of this section claimed "no SQL was executed" in an unqualified,
package-wide sense; that was accurate through the fourth correction pass
and is now corrected here, since the user's own Run 1 (section 23) means
the package as a whole has, in fact, now been executed once.

## 12. Confirmation: no Supabase project was accessed or linked BY THIS AGENT

No `supabase` CLI command was run by this agent, in this or any prior
correction pass. No network request to any Supabase project, hosted or
local, was made by this agent. No project reference or project URL
appears anywhere in this package's own files. The user's Run 1 (section
23) accessed a real, disposable, non-production Supabase project
(`text2task-phase1a-temp-test`) directly through the Supabase Dashboard's
SQL Editor -- outside this agent's own tool access, and never the
Text2Task production project.

## 13. Confirmation: no production credential was used

No API key, service-role key, anon key, database password, or connection
string appears anywhere in this package. `01_CREATE_TEMP_TEST_FIXTURE.sql`
contains one placeholder literal string
(`'phase1a-fixture-not-a-real-credential'`) used only as a throwaway
`auth.users.encrypted_password` filler value in a disposable test project
— it is not, and is not derived from, any real credential, and no login
is ever attempted against it.

## 14. Confirmation: migrations remain unapplied

No migration was applied to any database by this task, including the
temporary-project workflow this package prepares — that application only
happens later, manually, by the user, in their own temporary Supabase
project.

## 15. Confirmation: existing Phase 1A files were not modified (at the time of this section; see the note below)

`git diff --name-status` (below, section 18) shows zero changes to any of
the nine pre-existing Phase 1A files (`AGENTS.md`, the two Phase 0/1A
report `.md` files, or any of the three migration `.sql`/`.test.ts`
pairs). All nine remain exactly as they were found at the start of this
task.

**This no longer holds without qualification as of section 25.** A
confirmed runtime defect (SQLSTATE 2201B, an invalid regex repetition
bound) required the seventh correction pass to intentionally modify one
of these nine pre-existing files,
`supabase/migrations/202608030003_client_share_owner_foundation.sql`,
and its colocated
`supabase/migrations/202608030003_client_share_owner_foundation.test.ts`.
`AGENTS.md`, both Phase 0/1A report `.md` files, and migrations 004 and
005 with their tests remain unmodified to this day -- see section 3 and
section 25 for the complete, current picture of what changed and why.

## 16. Exact validation performed

- Ran `scripts/client-share/build-phase1a-sql-editor-package.ps1` once;
  it printed source/bundle SHA-256 hashes and confirmed 003/004/005 each
  appear exactly once, in order, in the generated bundle.
- Ran `npx vitest run` targeted at exactly the three existing Phase 1A
  migration test files: **3 test files passed, 336 tests passed** (no
  regression from the previously reported state).
- Grepped the generated `02_...sql` for each migration's `BEGIN` marker
  count (1, 1, 1) confirming no duplication.
- Grepped `01_...sql` for its `REFUSING TO RUN` safety messages (2 present:
  the base-schema check and the sentinel-reuse check).
- Grepped `02_...sql` and `03_...sql` for references to the sentinel table
  name, confirming both gate on it.
- Grepped `03_...sql` for a top-level `begin;` and `rollback;`, confirming
  both are present and the script is wrapped correctly.
- Grepped every `.sql`/`.md` package file for `psql` meta-commands
  (`\i`, `\set`, `\connect`) and for credential/project-reference patterns
  (service-role keys, anon keys, `*.supabase.co` project hosts) — none
  found (one benign `supabase.com` marketing-site link in the human
  instructions).
- Ran `git diff --name-status`, `git diff --stat`, `git status --short`,
  and `git status -sb` — see section 18.
- Self-reviewed `03_RUN_PHASE1A_RUNTIME_TESTS.sql` line by line after
  first draft and found and fixed six real defects before finalizing:
  an invalid leftover PL/pgSQL type declaration; three tests that tried
  to run two SQL statements in a single `EXECUTE` call (which Postgres
  rejects — fixed by wrapping each in a nested `DO` block, which does
  support multiple statements); one dead placeholder test that asserted
  nothing meaningful (removed); one mislabeled assertion whose
  description contradicted its expected outcome (relabeled as fixture
  setup); an incorrect role model in the `share_message_conversions`
  section that would have failed at the grant layer rather than testing
  trigger logic (switched from simulating `authenticated` to running as
  the Postgres superuser with simulated `auth.uid()`, matching the
  Postgres-superuser methodology already documented in the file's own
  header for the other integrity sections, plus one wrong foreign-key
  reference in that same section); and a state-lifecycle sequencing bug
  where three tests permanently revoked the shared "main" test link
  (`link_e1`), which every later section also relied on being active —
  fixed by giving the revoke/disable/re-enable sequence its own dedicated
  link. **This file was not, and could not be, executed against a live
  Postgres/Supabase instance during this task** (per the task's own
  "Not allowed" list — no Supabase CLI, no database connection). It is a
  carefully authored and self-audited artifact; the user's first real run
  in a temporary Supabase project, per `00_READ_ME_FIRST.md`, is the
  actual validation step, and any further issue it surfaces should be
  reported back rather than silently patched around.

## 17. Correction pass (narrowly scoped, 2026-08-04)

A second review of `03_RUN_PHASE1A_RUNTIME_TESTS.sql` found ten further
defects beyond the six already listed in section 16 above. All ten are
now fixed. Files 01, 02, the generator, and both migrations/tests were
**not** touched. Only `03_RUN_PHASE1A_RUNTIME_TESTS.sql` and this report
were modified.

1. **Section O had a `declare` embedded partway through the block's
   statement list**, wrapping the final cascade sub-test in its own
   nested block. While PostgreSQL's own documentation shows nested
   `declare/begin/end` blocks as valid syntax, the safer, unambiguous fix
   was taken: the two variables were hoisted into Section O's top-level
   `declare` section and the nested block was flattened away entirely, so
   there is no longer any question about it.
2. **J6 called `pg_temp.try_stmt(...)` with a boolean expression
   (`not exists (...)`) as the `p_sql` argument**, which expects `text`.
   This is a real type mismatch that PostgreSQL would reject at parse
   time, aborting that entire `do $$ ... $$` block before any of its
   tests could run. Fixed by switching to `pg_temp.record_result(...)`,
   whose `p_pass` parameter is `boolean` — J6 is a state assertion (did a
   conversion row appear or not), not a statement to execute.
3. **H5 inserted a second `is_current = true` row for the same share
   link while the first row still had `is_current = true`**, which
   collides with the partial unique index
   `share_link_updates_current_version_unique_idx` and would have made
   the "succeeds" assertion fail for the wrong reason. Fixed by
   reordering to retire the old current row first, then insert the new
   one, in a single nested `DO` block. H6 (attempting to make version 1
   current again) now correctly expects SQLSTATE 23505.
4. **Grants for the PIN-protected `link_e1` were missing
   `pin_verified_at`.** E18 deliberately gives `link_e1` a PIN for the
   rest of the script, but L1, L9, and L10 (and Section M's `M9` browser
   session cascade fixture) all created grants for `link_e1` without
   supplying `pin_verified_at`, which
   `enforce_share_session_grant_integrity()` requires whenever the link
   has a PIN — every one of those inserts would have failed with
   `SHARE_GRANT_PIN_VERIFICATION_REQUIRED` instead of succeeding as
   intended. Fixed by adding `pin_verified_at = now()` to all four. Two
   new tests were also added: `L1b` proves a grant for `link_e1` without
   `pin_verified_at` is rejected with exactly that message, and `L4b`
   proves a grant for the non-PIN `other_link` WITH an (unexpected)
   `pin_verified_at` is rejected with `SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED`.
5. **Section M's cascade-link setup UPDATE changed `state` and
   `comments_enabled` without bumping `configuration_version`**, which
   `enforce_project_share_link_integrity()` requires for any
   access-affecting change — this plain, unguarded statement would have
   raised `SHARE_LINK_VERSION_NOT_INCREMENTED` and aborted the entire
   Section M block before any M1-M8 assertion ran. Fixed by adding the
   version bump to that UPDATE. Separately, **the cascade block's
   client-authored message fixture was inserted as the Postgres
   superuser**, but `enforce_share_message_integrity()` requires
   `current_role = 'service_role'` for `author_type = 'client'` — this
   would also have aborted the block. Fixed by switching to
   `service_role` for that one statement only, then returning to
   `postgres` for the rest of the cascade setup.
6. **I10 did not test hidden-parent rejection at all** — it inserted an
   unauthenticated owner-authored message with no `parent_id`, so it
   only re-tested the same owner-authentication rule I6/I7 already cover,
   under a misleading description. Replaced with a real sequence: (a) as
   `postgres` with `auth.uid()` simulated to owner A, insert a hidden
   (`is_visible_to_client = false`) owner-authored message as the actual
   parent; (b) as `service_role`, attempt a client reply against that
   parent. This correctly fails with `SHARE_MESSAGE_CLIENT_PARENT_NOT_VISIBLE`
   — **not** `SHARE_MESSAGE_PARENT_NOT_VISIBLE_TO_CLIENT` as an earlier
   draft of the correction instructions named it. The actual message, as
   raised by `enforce_share_message_integrity()` in
   `202608030005_client_share_integrity_and_security.sql`, was used
   instead of the requested name, since migrations are not modified and
   the test must match real trigger behavior, not an invented string.
7. **G3 used `gen_random_uuid()` as the `resource_id`**, so it tested "a
   resource that does not exist at all" (`SHARE_RESOURCE_NOT_FOUND`)
   while being labeled a cross-owner test. Fixed by creating a real
   `task_resources` row owned by owner B and attempting to share it
   through owner A's link, which correctly fails with
   `SHARE_RESOURCE_NOT_OWNED`. The original nonexistent-resource case was
   kept as a separate, correctly labeled test (`G3b`).
8. **`try_stmt` validated only success/failure and an optional message,
   never the SQLSTATE**, so an assertion could PASS on an unrelated
   error. Extended the function to a 7th, optional
   `p_expected_sqlstate` parameter, captured via
   `get stacked diagnostics ... returned_sqlstate`. Every
   expected-failure call site across the whole file (100 `try_stmt`
   calls) was reviewed and given the correct SQLSTATE for its failure
   mechanism: P0001 for stable trigger errors (with the exact message),
   42501 for grant-layer permission denials, 23505 for unique-constraint
   violations, and 23514 for CHECK-constraint violations. Two tests (E9,
   E10) were also corrected to expect the SQLSTATE that the code path
   they actually exercise produces, rather than the one their original
   description implied — E9 is rejected by the trigger's own
   view-count-decrease check (P0001) before the `view_count >= 0` CHECK
   is ever reached, since BEFORE triggers run before CHECK constraints;
   E10 now bumps `configuration_version` so it clears the trigger's
   version-bump gate and reaches the real boundary its description
   claims to test, the secret-digest consistency CHECK (23514).
9. **The conversion `ON DELETE SET NULL` coverage tested only
   `project_update_id`.** Added `J9`/`J10`: a valid conversion referencing
   `target_task_id`, followed by deleting that task and confirming
   `target_task_id` becomes null while the conversion row survives. Added
   `J8setup`/`J8`: an owner-authored message is created, then a
   conversion attempt against it is confirmed to fail with
   `SHARE_CONVERSION_MESSAGE_NOT_CLIENT_AUTHORED` — conversions require a
   client-authored source.
10. **Static self-audit performed after all fixes** (see the grep-based
    checks recorded in this session): confirmed no `try_stmt` call passes
    a boolean where `p_sql` (text) is expected; confirmed H5 disables the
    old current row before inserting the new one; confirmed every valid
    (successful) grant for the PIN-protected `link_e1` supplies
    `pin_verified_at`; confirmed Section M's cascade-link activation
    bumps `configuration_version`; confirmed the cascade block's
    client-authored message insert runs under `service_role`; confirmed
    Section O has no mid-block `declare`; confirmed the file still opens
    with `begin;` (line 118) and closes with `rollback;` (line 1641);
    confirmed the final result counts are `select count(*) ... from
    _test_results` against real accumulated rows, not a hardcoded number.

**This file still was not, and could not be, executed against a live
Postgres/Supabase instance during this correction task** — SQL execution
was explicitly disallowed. It remains a carefully authored and
self-audited artifact, now corrected twice on review; the user's first
real run in a temporary Supabase project is still the actual validation
step, and this report does not claim the runtime SQL has passed.

## 18. Final git verification

```
$ git diff --check
(no output -- clean)

$ git diff --stat
(no output -- no tracked file changed)

$ git diff --name-status
(no output -- no tracked file changed)

$ git status --short
?? AGENTS.md
?? docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_0_MAPPING_2026-08-03.md
?? docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1A_DATABASE_FOUNDATION_REPORT.md
?? docs/client-share-phase1a-sql-editor/
?? scripts/client-share/
?? supabase/migrations/202608030003_client_share_owner_foundation.sql
?? supabase/migrations/202608030003_client_share_owner_foundation.test.ts
?? supabase/migrations/202608030004_client_share_session_foundation.sql
?? supabase/migrations/202608030004_client_share_session_foundation.test.ts
?? supabase/migrations/202608030005_client_share_integrity_and_security.sql
?? supabase/migrations/202608030005_client_share_integrity_and_security.test.ts

$ git status -sb
## main...origin/main
(same untracked files as above)
```

The six pre-existing untracked files (`AGENTS.md`, the two report `.md`
files, and the three migration `.sql`/`.test.ts` pairs) are exactly as
they were found at the start of this task — this task's own instructions
explicitly forbade modifying them, and none were touched. The only
additions are `docs/client-share-phase1a-sql-editor/` (7 files) and
`scripts/client-share/` (1 file), plus this report. Nothing was staged or
committed, per the task's instructions.

## 19. Remaining next step

The user creates a brand-new, temporary Supabase project and runs files
01, 02, and 03 manually in the SQL Editor, in that order, following
`docs/client-share-phase1a-sql-editor/00_READ_ME_FIRST.md`, with ChatGPT
or Claude guidance available throughout. Results should be recorded in
`04_CAPTURE_RESULTS.md` or pasted back into the conversation. Per
`05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`, passing this package does
not by itself authorize applying anything to the real Text2Task
production database — that remains a separate, explicit decision, still
gated on the pre-Phase-1B decisions (D1-D6) already recorded in the Phase
0 mapping addendum.

## 20. Second correction pass -- final runtime-harness correction (2026-08-04)

The final review before the first real Supabase execution found the
test HARNESS itself was broken for every role-switched test, plus nine
further scope gaps. All ten are now fixed in
`03_RUN_PHASE1A_RUNTIME_TESTS.sql`; `01_CREATE_TEMP_TEST_FIXTURE.sql`
also received one explicit fixture-privilege fix. Files 02, the
generator, both migrations, and their tests were **not** touched.

**Temporary-harness privilege solution:** every `pg_temp.*` helper
(`set_val`, `get_val`, `get_uuid`, `get_bigint`, `record_result`,
`try_stmt`, `act_as`) is deliberately `SECURITY INVOKER` (unchanged,
never made `SECURITY DEFINER` -- doing so would make every attempted
statement inside `try_stmt` run as the function owner instead of the
role actually being tested, invalidating every permission test in the
file). Because they are invoker-rights, a role reached via `SET ROLE`
needs its own real privileges on `_test_results` and `_fixture_state` to
use them at all. Added immediately after those two temporary tables and
the helper functions are created: `grant select, insert, update on
_fixture_state to anon, authenticated, service_role;`, `grant select,
insert on _test_results to anon, authenticated, service_role;`, and
`grant usage, select on sequence _test_results_seq_seq to anon,
authenticated, service_role;` -- exactly the "transparent acceptable
implementation" specified, on temporary objects inside a disposable test
transaction only. Three preliminary self-tests (`HARNESS`/`H-ANON`,
`H-AUTH`, `H-SVC`) prove each role can read fixture state and record a
result through the helpers alone, deliberately with no exception
handler, so a harness regression aborts loudly instead of producing
false results downstream.

**Fixture-privilege solution:** `01_CREATE_TEMP_TEST_FIXTURE.sql`'s six
fixture tables now explicitly `revoke all ... from public, anon,
authenticated, service_role` followed by `grant select ... to
authenticated` and `grant select ... to service_role`, rather than
silently relying on this particular Supabase project's default
privileges for new public-schema tables. `postgres` remains the table
owner and sole source of fixture DML; no INSERT/UPDATE/DELETE is granted
to any of the three roles.

**Other corrections made:**

- **other_link activation** (Section I) now bumps `configuration_version`
  in the same UPDATE and is wrapped in `try_stmt` as `I11setup` with an
  expected-success assertion, so a future sequencing regression becomes a
  named FAIL instead of silently aborting the script.
- **I3/I4 corrected, I4c added:** service_role's real INSERT grant on
  `share_messages` excludes `status`, `reviewed_at` and `resolved_at`
  entirely (migration 005 section 9), so naming any of them now correctly
  expects SQLSTATE 42501 (a column-grant rejection), not a P0001 trigger
  message. A second, new set of tests (`I3trigger`/`I4trigger`/
  `I4ctrigger`) temporarily widens the INSERT grant for those three
  columns inside this test transaction only, proves the trigger's own
  defensive checks (`SHARE_MESSAGE_CLIENT_STATUS_INVALID`,
  `SHARE_MESSAGE_CLIENT_REVIEWED_AT_FORBIDDEN`,
  `SHARE_MESSAGE_CLIENT_RESOLVED_AT_FORBIDDEN`), then reverts the grant
  and `I4restore` confirms the reverted privilege state directly via
  `has_column_privilege`.
- **High-risk message tests added** (`I14`-`I16`): a client comment on a
  disabled link, an expired-by-timestamp link, and a link whose project is
  soft-deleted, each on its own dedicated link/project so `link_e1` and
  `other_link` are never disabled, expired, or attached to a deleted
  project.
- **Browser-session lifecycle completed** (`K7`-`K13`, on a dedicated
  session so `session_1` stays live for Section L): invalid digest format
  (23514), `digest_version`/`created_at`/`expires_at` immutability,
  `last_seen_at` cannot be cleared to null (same message as decreasing
  it), and `revoked_at` cannot move further backwards than an existing
  revocation. **Note:** the real migration has only one message covering
  both "clear revoked_at" and "move revoked_at backwards" --
  `SHARE_SESSION_REVOCATION_IRREVERSIBLE`. There is no
  `SHARE_SESSION_REVOCATION_IMMUTABLE` message anywhere in
  `202608030005_client_share_integrity_and_security.sql`; the real
  message was used for both K6 and the new K13 rather than inventing the
  one named in the correction request.
- **Per-link grant coverage completed** (`L11`-`L23`, each on dedicated
  sessions/links/projects): revoked session, expired session, disabled
  link, expired-by-timestamp link, revoked link (same
  `SHARE_GRANT_LINK_NOT_ACTIVE` message as disabled, since the trigger
  only checks `state <> 'active'`), soft-deleted linked project, grant
  expiry exceeding link expiry, and a future (not just stale)
  `configuration_version` (same `SHARE_GRANT_CONFIGURATION_VERSION_STALE`
  message, since the trigger checks strict inequality). Five immutability
  tests (`L19`-`L23`) cover `browser_session_id`, `share_link_id`,
  `pin_verified_at`, `created_at` and `expires_at`, reusing `grant_1` (now
  persisted via `pg_temp.set_val('grant_1_id', ...)`, which the original
  file never did).
- **Published-update immutability completed** (`H4b`-`H4g`): `share_link_id`,
  `user_id`, `version`, `published_at`, `created_by` and `created_at` all
  confirmed immutable, each producing the same `SHARE_UPDATE_IMMUTABLE`
  message as the existing body test, matching the trigger's single
  combined condition.
- **No-automatic-mutation extended to conversions** (`N5`/`N6`): a fresh,
  dedicated project/link/message and a project_update created *before* the
  snapshot (deliberately, since the conversion trigger must not create or
  mutate it, not that it never existed), then a valid conversion is
  inserted and every core table's row count is confirmed unchanged.

**Static self-audit performed** (see the grep-based checks run this
session): confirmed `try_stmt` is still declared with no `security
definer` anywhere in the file; confirmed no expected-failure `try_stmt`
call ends bare (`false);` with neither a message nor a SQLSTATE);
confirmed all 8 nested `do $body$ ... end $body$;` sub-blocks are
correctly closed; confirmed `grant_1_id` is set once and read once with
matching key names; confirmed the file still opens with `begin;` (line
118) and closes with `rollback;` (line 2165); confirmed file 02's SHA-256
(`17194644800977f1c71debe20284b96d448a3144e30a246bec6b96d976c18b4d`) is
byte-identical to the hash recorded in `MANIFEST.md` before this task
began.

**This file still was not, and could not be, executed against a live
Postgres/Supabase instance during this task** -- SQL execution was
explicitly disallowed. It is now a more extensively self-audited
artifact than either prior pass, but this report does not claim the
runtime SQL has passed. The user's first real run in a temporary
Supabase project remains the actual validation step.

## 21. Third correction pass -- final static correction before first real execution (2026-08-04)

A final review before the first real Supabase execution found four
further defects, all now fixed in `03_RUN_PHASE1A_RUNTIME_TESTS.sql`.
Files 01, 02, the generator, both migrations, and their tests were **not**
touched by this pass.

**1. Harness self-test order.** `HARNESS`/`H-ANON`, `H-AUTH` and `H-SVC`
read `get_val('owner_a')` before section 2 (shared product fixture data)
had run, so `owner_a` was never in `_fixture_state` yet and all three
preliminary self-tests recorded FAIL unconditionally -- a bug in the
self-test itself, not in the temporary-object grants. Fixed by seeding a
dedicated `harness_probe` key (`perform pg_temp.set_val('harness_probe',
'READY');`) immediately before the self-test block, independent of any
later product fixture, and having all three self-tests read
`harness_probe` and require it to equal exactly `'READY'`. Each self-test
now also explicitly `raise`s a P0001
`HARNESS_SELF_TEST_FAILED` exception if the probe value is wrong, so a
harness regression stops the script immediately rather than merely
recording a boolean FAIL row that a hurried reader could scroll past.
`try_stmt`/`record_result`/etc. remain `SECURITY INVOKER` (unchanged);
the temporary-object grants themselves were already correct and were not
touched.

**2. Section L role sequencing.** In L11-L18, the direct `INSERT`s that
created four dedicated fixture links (`v_link_disabled_g`,
`v_link_expired_g`, `v_link_revoked_g`, `v_link_short_expiry_g`) executed
while `current_role` was still `service_role`, left over from the
preceding grant-rejection test -- directly contradicting the production
boundary D10 already proves (`service_role` has no `INSERT` on
`public.project_share_links`). A full role-flow audit of L11-L23 found
these were the only four affected statements (the fifth,
`v_link_deleted_project_g`, and every `share_browser_sessions` /
`share_session_grants` statement, were already correctly sequenced).
Fixed by inserting `perform pg_temp.act_as('postgres');` immediately
before each of the four INSERTs, so every owner-facing fixture
create/configure step runs as `postgres` and `service_role` is used only
for the service-owned session/grant rows and the one statement actually
under test in each pair.

**3. Deterministic expiry.** The whole runtime script is one transaction,
so PostgreSQL's `now()` is fixed for its entire duration -- `now() +
interval '1 second'` and `created_at + interval '1 second'` never
actually elapse, so I15, L12 and L14's "expired" fixtures were not
actually expired by the time the dependent statement ran; they only
happened to still pass because the CHECK constraints were satisfied, not
because the intended EXPIRED code path was reached. Fixed by backdating
`created_at` (and, for sessions, `last_seen_at`) to `now() - interval '2
days'` at INSERT time, then setting `expires_at = now() - interval '1
day'` (and, for links, `activated_at = now() - interval '36 hours'`) at
activation time -- genuinely in the past relative to the transaction's
fixed `now()`, while still satisfying
`project_share_links_timestamp_order_check` and
`share_browser_sessions_lifecycle_check` (both only require the
timestamp to be after `created_at`, which backdating preserves). No
`pg_sleep` and no `clock_timestamp()`-based timing race was used, per the
task's own constraint.

**4. No-op immutability tests.** For the same "`now()` is fixed for the
transaction" reason, H4e (`published_at = now()`), H4g (`created_at =
now()`), K9 (`created_at = now()`), L21 (`pin_verified_at = now()`) and
L22 (`created_at = now()`) were writing back the exact value each column
already held (all originally defaulted to `now()` within the same
transaction), making the UPDATE a genuine no-op that the trigger's `is
distinct from` check does not flag -- these expected-failure tests could
pass or fail for the wrong reason depending on exact timing, rather than
reliably exercising the intended immutability rule. Fixed by offsetting
each by a provably distinct interval relative to its own current stored
value (`published_at + interval '1 second'`, `created_at - interval '1
second'`, `pin_verified_at + interval '1 second'`, etc.), each still
expecting the exact same migration P0001 message as before. Every other
immutable-timestamp test in the file was audited for the same pattern;
none of the others (K10, K3, L23, L5, H4b-H4d/H4f, E5-E8, and the
identity-field tests in L19-L20) had this problem, because each already
used a value structurally different from the column's original value
(a different UUID, a different interval offset already present, a
different literal), not `now()` against a `now()`-defaulted column.

**Report corrections (issue 5).** Removed the "already-committed" claims
in section 1 and section 11: `git status` still reports all three
migration files and their colocated tests as untracked, and this report
now says so explicitly rather than implying they were committed. Section
9's inventory was rewritten to match the actual current test codes
(HARNESS, A-O) rather than the pre-correction inventory, with an exact
mechanical count as understood at the time: 144 `try_stmt` call sites +
64 `record_result` call sites, unchanged from immediately before this
pass since no test call sites were added or removed, only corrected in
place. [This section's "= 208 result rows total" figure was a naive sum
that did not exclude `try_stmt`'s own internal `record_result` call --
see section 27 for the confirmed 144 + 63 = 207 reconciliation; it was
never a valid assertion-call-site total.] This report continues to make
no claim that the runtime SQL has passed -- it still has not been
executed.

**Static self-audit performed** (see the grep-based checks run this
session): confirmed `harness_probe` is seeded before H-ANON/H-AUTH/H-SVC
and that all three read it (not `owner_a`); confirmed a failed harness
probe raises P0001 rather than merely recording FAIL; confirmed no
`project_share_links` or `projects` fixture INSERT executes under
`service_role` anywhere in L11-L23; confirmed I15/L12/L14 each use a
deterministically backdated fixture with no reliance on elapsed wall-clock
time; confirmed H4e/H4g/K9/L21/L22 each write a provably distinct value;
confirmed every expected-failure `try_stmt` call still supplies an exact
SQLSTATE (no `false);` calls with neither a message nor a SQLSTATE);
confirmed the file still opens with `begin;` and closes with `rollback;`;
confirmed `01_CREATE_TEMP_TEST_FIXTURE.sql` and
`02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql` are untouched (file 02's SHA-256
still matches `MANIFEST.md`); confirmed all three migration files and
their tests remain byte-for-byte unchanged from the start of this task.

**This file still was not, and could not be, executed against a live
Postgres/Supabase instance during this task** -- SQL execution was
explicitly disallowed throughout every correction pass. The user's first
real run in a temporary Supabase project remains the actual, and only,
validation step.

## 22. Fourth correction pass -- invalid top-level PERFORM (2026-08-04)

The harness-probe seed line added in the second correction pass
(`perform pg_temp.set_val('harness_probe', 'READY');`) was issued
directly at SQL top level, outside any `DO` block or function body.
`PERFORM` is a PL/pgSQL-only statement and is invalid there -- it would
have stopped file 03 with a syntax error before the harness self-tests
ever ran, before any product-boundary test, and before the transaction
could even reach `ROLLBACK`. A complete top-level-statement scan of the
file (`grep -n "^perform "`) found exactly this one instance and no
others.

Fixed by wrapping it in its own minimal `DO` block, `do $harness_seed$
begin perform pg_temp.set_val('harness_probe', 'READY'); end;
$harness_seed$;`, in the same position: after the temporary harness
grants, before `H-ANON`/`H-AUTH`/`H-SVC`, inside the existing explicit
transaction, and independent of the later `owner_a` product fixture. No
other top-level `PERFORM` was introduced in its place.

**Static validation performed:** re-scanned the full file for
`^perform ` -- zero matches remain, confirming every `PERFORM` is now
inside a `DO` block or function body. Confirmed `harness_probe` is
seeded before all three harness self-tests read it. Confirmed the
assertion count is unchanged: 144 `try_stmt` call sites + 64
`record_result` call sites (this pass only wrapped one existing
statement in a `DO` block; no test call site was added, removed, or
altered). [The "= 208 result rows" figure here was a naive sum that did
not exclude `try_stmt`'s own internal `record_result` call -- see
section 27 for the confirmed 144 + 63 = 207 reconciliation.] Confirmed
the file still opens with `begin;` and
closes with `rollback;`. Confirmed `01_CREATE_TEMP_TEST_FIXTURE.sql` and
`02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql` are untouched (02's SHA-256 still
matches `MANIFEST.md`; 01 was not edited in this pass). No migration or
migration test was changed.

**This report still does not claim the runtime SQL has passed.** At the
time this section was written, it had not yet been executed even once.
**This is now historical: see section 23 for the first real execution
and its outcome.**

## 23. First real runtime execution and its correction pass (2026-08-04)

### What happened

The user performed the package's **first real execution**, in a
disposable, non-production Supabase project: organization "Text2Task
Temp Tests — FREE", project `text2task-phase1a-temp-test`.

- **File 01 succeeded**: `fixture_status = READY`.
- **File 02 succeeded**: the final structural verification query returned
  `found = true` for all 10 tables, all 9 functions, and all 13 triggers.
- **File 03 did not complete.** The exact observed error:

  ```
  ERROR: 23502: null value in column "value" of relation "_fixture_state"
  violates not-null constraint
  DETAIL: Failing row contains (grant_1_id, null).
  CONTEXT: SQL function "set_val" statement 1
  SQL statement "SELECT pg_temp.set_val('grant_1_id', v_grant_1::text)"
  PL/pgSQL function inline_code_block line 23 at PERFORM
  ```

- No final `total_tests`/`passed_tests`/`failed_tests` result table was
  ever produced. The test transaction did not commit -- it cannot; the
  script is designed to always end in `ROLLBACK`, and this run aborted
  before ever reaching that line, so it rolled back implicitly when the
  session ended.
- **Production was never accessed.** Only the disposable temporary
  project above was touched.
- **Runtime PASS remains NOT achieved.** This correction pass does not
  change that -- it only removes the specific defect that prevented the
  script from telling us why L1 failed.

### Root-cause analysis: the visible error is secondary

L1 ("valid grant for a live session and active, PIN-protected link at the
exact current version succeeds") is an **expected-success** test. Its
`pg_temp.try_stmt(...)` call already executed the grant `INSERT`, caught
whatever happened, and recorded the real outcome in `_test_results` --
that machinery worked correctly. The bug was in the code immediately
after it, which the file had never guarded:

```sql
select id into v_grant_1 from public.share_session_grants
where browser_session_id = ... and share_link_id = ...;
perform pg_temp.set_val('grant_1_id', v_grant_1::text);
```

If L1's `INSERT` did not actually create a row (for whatever reason), this
`SELECT` finds nothing, `v_grant_1` is `NULL`, and handing `NULL` to
`set_val` -- whose `_fixture_state.value` column is `NOT NULL` -- produces
this unrelated 23502 error, completely masking L1's real recorded
SQLSTATE and message. **The actual reason L1's insert did not create a
row is still unknown.** This pass does not modify the migrations or
change L1's expectation, per the task's own explicit instruction; it only
makes the next run capable of exposing the truth safely instead of
crashing on a symptom.

### 1. Fix: L1's fail-closed guard

A new helper, `pg_temp.require_id(p_section, p_code, p_label,
p_id_text)`, was added to the assertion-infrastructure section (right
after `try_stmt`'s definition). If `p_id_text` is `NULL`, it looks up the
most recent `_test_results` row for that exact `(section, test_code)`
pair and raises:

```
PHASE1A_SETUP_DEPENDENCY_FAILED: <section>/<code>: expected a <label> row
to exist after this expected-success step, but none was found. Recorded
result for <section>/<code> -- status: <status>, detail: <detail>
```

Applied to L1 immediately after its `SELECT ... INTO v_grant_1`, before
`set_val`:

```sql
select id into v_grant_1 from public.share_session_grants
where browser_session_id = pg_temp.get_uuid('session_1') and share_link_id = pg_temp.get_uuid('link_e1');
perform pg_temp.require_id('L', 'L1', 'share_session_grants row for session_1/link_e1', v_grant_1::text);
perform pg_temp.set_val('grant_1_id', v_grant_1::text);
```

No placeholder UUID was inserted. `_fixture_state.value` was not made
nullable. L1 was not skipped, weakened, or changed from expected success
to expected failure. No trigger, constraint, grant, or RLS policy was
touched.

### 2. Audit: every other dependency-producing setup

A full scan of the file for the same three-step shape (expected-success
`try_stmt` → `SELECT ... INTO` a generated id → that id relied on by
later tests, either via `set_val` for cross-block reuse or as a local
variable reused later in the same block) found **ten further instances**.
Every one now has the same `require_id` guard, using the exact section
and test code of the step that should have produced the row:

| Guarded step | Row it depends on | Reused via |
|---|---|---|
| E1 | `project_share_links` (main test link, `link_e1`) | `set_val` |
| E13pre | `project_share_links` (lifecycle-sequence link) | local var, E13-E17 |
| H1 | `share_link_updates` (version 1) | local var, H2/H4-H6 |
| I2 | `share_messages` (the client comment) | `set_val` (`client_msg_1`) |
| I10setup | `share_messages` (hidden owner note) | `set_val` (`hidden_msg_1`) |
| J8setup | `share_messages` (owner-authored message) | local var, J8 |
| J9 | `share_message_conversions` (client_msg_2's conversion) | local var, J10 |
| K1 | `share_browser_sessions` (session-1) | `set_val` (`session_1`) |
| K8setup | `share_browser_sessions` (session-lifecycle) | local var, K8-K13 |
| L4 | `share_session_grants` (session_1/other_link) | `set_val` (`grant_2`) |

The `set_val`-based ones (E1, I2, I10setup, K1, L4 -- plus L1 itself)
would have crashed with the same masking 23502 error as L1 did. The
local-variable-only ones (E13pre, H1, J8setup, J9, K8setup) would not
have crashed, but a `NULL` id used in a later `where id = <null>` clause
matches zero rows, which lets an `UPDATE` "succeed" as a silent no-op --
turning several downstream expected-*failure* tests into false PASSes
instead of surfacing the real problem. This is the "misleading downstream
failures" case the task asked this audit to also cover, not only the
literal crash case. E1's guard replaces the previous `coalesce(...,
'')` fallback (which silently converted a NULL id into an empty string
that would later fail a UUID cast anyway, just less diagnostically) with
a proper, informative fail-closed guard.

No guard was added to genuinely direct, unconditional inserts (not
wrapped in `try_stmt`) -- for example the fixture-building `INSERT ...
RETURNING id INTO` statements throughout Section M's cascade setup, or
`other_link`'s own creation in Section I. A failure in a direct,
unwrapped `INSERT` already propagates immediately and unmasked (there is
no intervening `try_stmt` catching it to create the "second, unrelated
error" failure mode this task is about), so no guard was needed there.

### 3. Static hypotheses for L1's failure (not yet confirmed)

L1 was not changed from expected success. These are hypotheses only,
offered because the task asked for them; none has been acted on, and
none will be until the next run's `require_id` output confirms the real
SQLSTATE and message.

Two facts narrow the hypothesis space usefully. First, `K1` (which
inserts into `share_browser_sessions`, a table with RLS enabled and
*zero* policies, relying entirely on `service_role`'s `BYPASSRLS`
attribute) evidently succeeded -- Run 1's crash trace points at
`grant_1_id`, not `session_1`, and `session_1` is set via the exact same
crash-prone pattern earlier in the file. Second, `I2` (which inserts into
`share_messages` while `service_role` reads `project_share_links`,
`RLS`-scoped `to authenticated` only, through the trigger body) also
evidently succeeded, for the same reason. Together these confirm
`service_role` does have working `BYPASSRLS` in this temporary project,
and that whatever is wrong is **specific to the grant insert's own
checks**, not a general RLS/role misconfiguration -- ruling out the most
obvious alternative explanation.

Given that, ranked by plausibility:

1. **`SHARE_GRANT_CONFIGURATION_VERSION_STALE`.** L1's
   `granted_configuration_version` is computed by a live subquery
   (`select configuration_version from project_share_links where id =
   ...`) intended to always self-match whatever the trigger itself reads.
   This is the single most complex, computed value in the statement (every
   other check is either a fixed literal or a value carried over from an
   earlier, already-verified test), which makes it the most likely place
   for a subtle mismatch neither this static review nor the original
   design caught.
2. **`SHARE_GRANT_LINK_NOT_ACTIVE` or `SHARE_GRANT_LINK_EXPIRED`.** `link_e1`
   passes through many state transitions and version bumps across
   Sections E, I, and I14-I16 before L1 runs. This analysis traced every
   one and found `link_e1` should still be `state = 'active'` with
   `expires_at` still `NULL` at L1's point, but a tracing error in a
   ~2,200-line file being read statically, not executed, cannot be ruled
   out with full confidence.
3. **A `NOT NULL` violation on `granted_configuration_version` itself**,
   if the live subquery unexpectedly returned zero rows for `link_e1` (for
   example, if `pg_temp.get_uuid('link_e1')` had drifted from the row
   `E1` actually created) -- considered least likely, since `link_e1` is
   now itself guarded by `require_id` and nothing else in the file writes
   to that fixture-state key.

No migration, trigger, constraint, or grant was changed based on any of
these hypotheses. They exist only to give the next run's exposed detail
something to be checked against.

### 4. `04_CAPTURE_RESULTS.md` and this report updated honestly

`04_CAPTURE_RESULTS.md` now records Run 1 in full (files 01/02 succeeded,
file 03's exact error, the secondary-error interpretation, and that no
result table was produced), and has a "Run 2 — pending" section ready for
the next attempt. Every prior unqualified "no SQL was executed" claim in
this report (sections 1 and 11) has been corrected to reflect that the
user's Run 1 did execute real SQL, while making clear that remains
distinct from this **agent** ever executing SQL directly, which has still
never happened in any correction pass, including this one.

### 5. Static self-audit performed

Confirmed `pg_temp.require_id(...)` appears at exactly 11 call sites
(L1, L4, K1, K8setup, I2, I10setup, E1, E13pre, H1, J8setup, J9).
Confirmed the assertion count is unchanged -- 144 `try_stmt` call sites
+ 64 `record_result` call sites -- since `require_id` only raises on
failure and never itself calls `try_stmt` or `record_result` on the
success path. [The "= 208 result rows" figure previously stated here was
a naive sum that did not exclude `try_stmt`'s own internal
`record_result` call -- see section 27 for the confirmed 144 + 63 = 207
reconciliation.] Confirmed no new top-level `PERFORM`
was introduced. Confirmed the file still opens with `begin;` and closes
with `rollback;`. Confirmed `01_CREATE_TEMP_TEST_FIXTURE.sql` and
`02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql` are untouched (02's SHA-256 still
matches `MANIFEST.md`). Confirmed all three migration files and their
tests remain unchanged.

**No SQL was executed by this agent during this correction pass.** The
next real validation step is the user re-running files 01, 02, and 03 in
the same or a fresh temporary Supabase project, and reporting back
whatever `PHASE1A_SETUP_DEPENDENCY_FAILED` detail (or, if every guarded
step now succeeds, the actual final result table) it produces.

## 24. Second real runtime execution and its correction pass (2026-08-04)

### What happened

The user performed the package's **second real execution**. Files 01 and
02 were **not rerun** -- only file 03 was rerun (carrying the previous
pass's `require_id` fix) against the same disposable, non-production
Supabase project (`text2task-phase1a-temp-test`) that files 01 and 02 had
already been successfully applied to in the first execution. That is a
legitimate way to iterate on file 03 alone, since it runs entirely inside
its own `BEGIN; ... ROLLBACK;` and left no residue from Run 1.

The new `require_id` guard worked exactly as designed. File 03 stopped
cleanly immediately after L1, instead of crashing on the masking 23502
`set_val` error the way Run 1 did, with:

```
PHASE1A_SETUP_DEPENDENCY_FAILED: L/L1: expected a share_session_grants
row for session_1/link_e1 row to exist after this expected-success step,
but none was found. Recorded result for L/L1 -- status: FAIL, detail:
expected success, got SQLSTATE P0001: SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED
```

- **Production was never accessed.** Only the disposable temporary
  project above was touched.
- **Runtime PASS remains NOT achieved.**
- **This does not mean the migrations failed.** It means `link_e1` was
  not in the PIN-protected state the test script's own later sections
  assume -- see the interpretation below.

### Interpretation: what Run 2 proves and what it does not

`SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED` is raised by
`enforce_share_session_grant_integrity()`
(`202608030005_client_share_integrity_and_security.sql`) on `INSERT`
whenever it computes `v_link_requires_pin = false` (i.e. `link.pin_hash
is null` for the referenced link) for a grant row that supplies a
non-null `pin_verified_at`. L1 supplies `pin_verified_at = now()`
because L1's own description assumes `link_e1` is already PIN-protected
by that point in the script. This chain of deduction is airtight given
the recorded evidence:

1. L1 supplied a non-null `pin_verified_at`.
2. The trigger raised `SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED`, which
   only fires when `not v_link_requires_pin`.
3. Therefore `v_link_requires_pin` was `false`, i.e. `link_e1.pin_hash
   was null` at the moment L1 ran.
4. E18 ("PIN v1 profile with correct parameters succeeds") is the one
   step in Section E specifically intended to make `link_e1`
   PIN-protected before Section L runs.
5. Therefore E18's intended persisted state was not actually in place by
   L1 -- **either E18 itself did not succeed, or it succeeded but its
   effect did not persist, or (least likely, see the static analysis
   below) something between E18 and L1 reset it.**

What this does **not** prove: it does not identify *why*. The previous
harness had no guard immediately after E18 -- if E18 had failed, nothing
would have stopped the script there or reported it; the script would
have silently continued for three more sections and only surfaced the
problem indirectly, and confusingly, at L1. That gap is exactly what this
pass closes.

### 1. Fix: the new `pg_temp.require_test_pass` guard

`require_id` (added in the prior pass) only catches a missing
**generated id** -- it says nothing about an expected-success `UPDATE`
that ran, left an existing row in the wrong state, and still recorded
`FAIL`, where no later step ever does a fresh `SELECT ... INTO` against
it at all (state-only setups such as activating a link, advancing a
timestamp, revoking a session, or publishing a second version). This is
precisely the shape of the actual problem this pass is responding to: E18
is an `UPDATE` against an *existing* row (`link_e1`, created back in E1),
not an `INSERT` that produces a new id, so `require_id` was structurally
incapable of guarding it.

A new helper, `pg_temp.require_test_pass(p_section, p_code, p_label)`,
was added to the assertion-infrastructure section immediately after
`require_id`'s definition:

```sql
create or replace function pg_temp.require_test_pass(
  p_section text, p_code text, p_label text
) returns void language plpgsql as $f$
declare
  v_status text;
  v_detail text;
begin
  select status, detail into v_status, v_detail
  from _test_results
  where section = p_section and test_code = p_code
  order by seq desc
  limit 1;

  if v_status is not distinct from 'PASS' then
    return;
  end if;

  raise exception using errcode = 'P0001', message = format(
    'PHASE1A_EXPECTED_SUCCESS_FAILED: %s/%s: %s did not PASS, so its downstream dependents cannot be trusted to run against the state they assume. Recorded result for %s/%s -- status: %s, detail: %s',
    p_section, p_code, p_label, p_section, p_code,
    coalesce(v_status, '(no result row was recorded for this test code)'),
    coalesce(v_detail, '(no detail recorded)')
  );
end;
$f$;
```

It reads the newest matching `_test_results` row for `(p_section,
p_code)` and raises a `P0001` with the stable prefix
`PHASE1A_EXPECTED_SUCCESS_FAILED: <section>/<code>:` if no row exists or
its status is anything other than exactly `PASS`, including the original
recorded status and detail in the message. It does not touch, wrap, or
reinterpret `try_stmt` in any way -- it only ever reads what `try_stmt`
already recorded, after the fact.

### 2. The E18 double-guard

Placed immediately after E18's `try_stmt` call and before E19's:

```sql
perform pg_temp.require_test_pass('E', 'E18', 'PIN setup for link_e1');

if not exists (
  select 1 from public.project_share_links
  where id = v_link_e1
    and pin_hash is not null
    and char_length(pin_hash) = 43
    and pin_salt is not null
    and char_length(pin_salt) = 32
    and pin_hash_version = 1
    and pin_scrypt_n = 16384
    and pin_scrypt_r = 8
    and pin_scrypt_p = 1
    and pin_key_length = 32
) then
  raise exception using errcode = 'P0001', message = format(
    'PHASE1A_EXPECTED_STATE_MISSING: E/E18: link_e1 (id %s) does not have the exact expected PIN v1 profile (pin_hash 43 chars, pin_salt 32 chars, pin_hash_version 1, pin_scrypt_n 16384, pin_scrypt_r 8, pin_scrypt_p 1, pin_key_length 32) even though E18 was recorded as PASS. Actual PIN columns: %s',
    v_link_e1,
    (
      select row_to_json(pin_state)
      from (
        select pin_hash, pin_salt, pin_hash_version, pin_scrypt_n, pin_scrypt_r, pin_scrypt_p, pin_key_length
        from public.project_share_links
        where id = v_link_e1
      ) pin_state
    )
  );
end if;
```

Two independent checks, deliberately layered:

1. **`require_test_pass('E', 'E18', ...)`** -- did the `try_stmt` itself
   record `PASS`? If not, the script stops here with E18's own real
   recorded SQLSTATE and message, exactly as the earlier `require_id` fix
   did for L1 -- but now three sections earlier, at the true point of
   failure.
2. **The direct state check** -- even if `try_stmt` recorded `PASS`
   (meaning the `UPDATE` executed without raising), this independently
   re-reads `link_e1`'s actual row and confirms all eight PIN columns
   hold exactly the intended v1 profile. If E18 somehow recorded `PASS`
   without the row actually reflecting it (for example, an `UPDATE`
   whose `WHERE` clause matched zero rows still returns success with no
   exception), this check catches that case, which `require_test_pass`
   alone cannot.

Both checks together mean the next run's `PHASE1A_EXPECTED_SUCCESS_FAILED:
E/E18: ...` or `PHASE1A_EXPECTED_STATE_MISSING: E/E18: ...` message, if
either fires, is now the direct, unmasked evidence this whole
investigation has been trying to reach -- not a downstream symptom three
sections later.

### 3. Full audit: every other expected-success state dependency

The user's own audit pattern -- an expected-success `try_stmt`, a later
test that assumes the state change persisted, and no immediate PASS/state
guard in between -- was applied to the entire file. Every site on the
user's minimum list, plus E18 itself, now has a `require_test_pass` guard
placed immediately after its `try_stmt` and before the next dependent
step:

| Guarded step | What its dependents assume |
|---|---|
| E11 | `link_e1` is `active` with a secret (E12 assumes draft-irreversibility from this exact state; F onward assumes `link_e1` is a stable active link) |
| E13 | the dedicated lifecycle link is `disabled` (E14 assumes re-enabling from disabled) |
| E14 | the lifecycle link is `active` again (E15 assumes revoking from active) |
| E15 | the lifecycle link is `revoked` (E16/E17 assume the terminal state) |
| E18 | `link_e1` is PIN-protected with the exact v1 profile (every test from here through the end of the file; the special double-guard, above) |
| E23 | `link_e1`'s subtitle change persisted with a version bump (added for audit completeness; no later test in the file currently reads this specific state, but the shape matches the audit pattern) |
| H5 | version 2 of the share-link update is published and current (H6 assumes this) |
| I11setup | `other_link` is activated (the dependent role-switch/read test assumes this) |
| I14setup | the dedicated disabled-link fixture is actually disabled |
| I15setup | the dedicated already-expired-link fixture is actually expired |
| I16setup | the dedicated link-with-soft-deleted-project fixture is actually in that state |
| K4 | `session_1`'s `last_seen_at` was actually advanced |
| K12 | the session-lifecycle fixture is actually `revoked` |
| L6 | `grant_1` is actually revoked (L8/L9 assume this) |
| L9 | the replacement current grant for session_1/link_e1 actually exists and is current (L10 assumes this) |
| L13setup | the dedicated disabled-link fixture for the grant-rejection test is actually disabled |
| L14setup | the dedicated already-expired-by-timestamp link fixture is actually expired |
| L15setup | the dedicated activated-then-revoked link fixture is actually revoked |
| L16setup | the dedicated link-with-soft-deleted-project fixture is actually in that state |
| L17setup | the dedicated link with a one-hour link-level expiry is actually active with that expiry |
| N5setup | the dedicated link for the conversion no-mutation check is actually activated |

That is 21 `require_test_pass` call sites in total, confirmed by grep
against the file (the same count as the number of rows in the table
above). No guard was added after any intentionally expected-*failure*
test (E10, E12, E16, E17, E19-E22, and the many analogous rejection tests
throughout F-N), since those are correctly recorded as `PASS` precisely
*because* they failed as expected -- adding a `require_test_pass` there
would be nonsensical, not a safety improvement. No expected production
boundary (CHECK constraint, trigger branch, RLS policy, or grant) was
weakened, loosened, or bypassed anywhere in this audit.

### 4. Static E18 analysis (evidence only -- no migration change)

Per the task's explicit instruction, this analysis is offered as
background and is **not** the basis for any migration change; only Run
3's actual exposed SQLSTATE/message (from the new guards above) is
treated as evidence of a real defect.

**Exact E18 SQL** (from `03_RUN_PHASE1A_RUNTIME_TESTS.sql`):

```sql
update public.project_share_links
set pin_hash = <fake_b64url(43)>,
    pin_salt = <fake_b64url(32)>,
    pin_hash_version = 1,
    pin_scrypt_n = 16384,
    pin_scrypt_r = 8,
    pin_scrypt_p = 1,
    pin_key_length = 32,
    configuration_version = configuration_version + 1
where id = v_link_e1;
```

`pg_temp.fake_b64url(p_len)` (defined earlier in the file) always returns
exactly `p_len` characters, each drawn from
`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_` via
`generate_series(1, p_len)` and `string_agg` -- it cannot return `NULL`,
empty, or a string of the wrong length for any `p_len >= 1`.

**Relevant `project_share_links` PIN constraints**
(`202608030003_client_share_owner_foundation.sql`):

```sql
constraint project_share_links_pin_completeness_check
  check (
    ( pin_hash is null and pin_salt is null and pin_hash_version is null
      and pin_scrypt_n is null and pin_scrypt_r is null
      and pin_scrypt_p is null and pin_key_length is null )
    or
    ( pin_hash is not null and pin_salt is not null
      and pin_hash_version = 1
      and pin_hash ~ '^[A-Za-z0-9_-]+$'
      and char_length(pin_hash) = 43
      and pin_scrypt_n = 16384 and pin_scrypt_r = 8
      and pin_scrypt_p = 1 and pin_key_length = 32 )
  ),
constraint project_share_links_pin_encoding_check
  check (
    (pin_hash is null or pin_hash ~ '^[A-Za-z0-9_-]{32,512}$')
    and (pin_salt is null or pin_salt ~ '^[A-Za-z0-9_-]{16,128}$')
  )
```

There is no other constraint (unique, exclusion, or otherwise) on any PIN
column in migration 003.

**Relevant `enforce_project_share_link_integrity()` trigger branches**
(`202608030005_client_share_integrity_and_security.sql`, `UPDATE`
branch): owner/project/public_id/created_at immutability (none of these
change in E18's `UPDATE`); `activated_at` immutability-once-set (E18
doesn't touch it); draft-irreversibility and the state-transition matrix
(E18 doesn't change `state`, so neither branch evaluates); `disabled_at`
/ `rotated_at` / `revoked_at` monotonicity (all remain `NULL` on
`link_e1` at this point, untouched by E18); `configuration_version` /
`view_count` / `last_viewed_at` monotonicity (E18 increments
`configuration_version` by exactly 1, which satisfies the decrease check;
`view_count`/`last_viewed_at` untouched); and `v_access_changed`, which
explicitly includes all seven PIN columns and requires
`configuration_version` to strictly increase in the same statement
whenever any of them change -- which E18 does.

**Are the values statically valid?** Yes. `fake_b64url(43)` and
`fake_b64url(32)` are always the correct lengths from the correct
character set, satisfying both CHECK constraints; `pin_hash_version = 1`,
`pin_scrypt_n = 16384`, `pin_scrypt_r = 8`, `pin_scrypt_p = 1`,
`pin_key_length = 32` are exactly the completeness check's required
literals; and the `configuration_version = configuration_version + 1`
clause satisfies `v_access_changed`'s version-bump requirement. No CHECK
constraint or trigger branch in either migration was found, by this
static read, that E18's exact statement would violate. E1-E18 (and
therefore E18 itself) run entirely under the `postgres` superuser role
(the last `act_as` call before Section E is `act_as('postgres')`, and
Section E performs no role switch of its own before E18), which bypasses
RLS and all grants entirely, ruling out a permission-layer (`42501`)
explanation. `v_link_e1` (the PL/pgSQL variable used by E18's `WHERE`
clause) and `pg_temp.get_uuid('link_e1')` (what L1 later resolves the
same link through) are set from the exact same value exactly once, at
E1, and `project_share_links.id` is never reassigned anywhere in the
file or by any trigger -- ruling out an id-drift/wrong-row explanation
between E18 and L1. `try_stmt`'s success path (`execute p_sql;` followed
directly by recording `PASS`, with no intervening savepoint or
sub-transaction) does not roll back or discard a statement that actually
succeeded, ruling out a harness-swallows-its-own-success explanation.

**Conclusion:** this static read finds no defect in E18's SQL, in the
relevant CHECK constraints, or in the relevant trigger branches, and
rules out the permission-layer, id-drift, and harness-rollback
explanations considered above. **This is not a claim that the migrations
are correct at runtime, only that no defect is visible from static
reading alone.** The actual reason `link_e1` was not PIN-protected at L1
remains unknown and requires Run 3's exposed evidence from the guards
added in this pass.

### 5. `04_CAPTURE_RESULTS.md` updated honestly

`04_CAPTURE_RESULTS.md` now records: the Run 1 entry (unchanged); a full
Run 2 entry (files 01/02 not rerun, unchanged from Run 1; file 03's exact
`PHASE1A_SETUP_DEPENDENCY_FAILED: L/L1: ...` stop message; the
interpretation above, including the explicit statement that this does not
yet identify *why* `link_e1` was not PIN-protected); and a fresh "Run 3 —
pending" template describing the specific new stop messages
(`PHASE1A_EXPECTED_SUCCESS_FAILED: E/E18: ...` or
`PHASE1A_EXPECTED_STATE_MISSING: E/E18: ...`, or any of the other 19
guarded steps) Run 3 may now produce. The notes section explicitly states
that neither Run 1 nor Run 2 is evidence the migrations are broken.

### 6. Static self-audit performed

- `pg_temp.require_test_pass(...)` call sites: **21**, matching the audit
  table above exactly (E11, E13, E14, E15, E18, E23, H5, I11setup,
  I14setup, I15setup, I16setup, K4, K12, L6, L9, L13setup, L14setup,
  L15setup, L16setup, L17setup, N5setup).
- `pg_temp.require_id(...)` call sites: unchanged at **11** (this pass
  added no new `require_id` calls -- E18's dependency is a state check
  on an existing row, not a missing generated id).
- Assertion count unchanged: 144 `try_stmt` call sites + 64
  `record_result` call sites -- neither `require_test_pass` nor the E18
  state check calls `try_stmt` or `record_result` on their success path,
  so this count is untouched by this pass. [The "= 208 result rows"
  figure previously stated here was a naive sum that did not exclude
  `try_stmt`'s own internal `record_result` call -- see section 27 for
  the confirmed 144 + 63 = 207 reconciliation.]
- No new top-level `PERFORM` was introduced.
- The file still opens with `begin;` and closes with `rollback;`.
- `01_CREATE_TEMP_TEST_FIXTURE.sql` and
  `02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql` are byte-for-byte unchanged;
  file 02's SHA-256 still matches `MANIFEST.md`
  (`17194644800977f1c71debe20284b96d448a3144e30a246bec6b96d976c18b4d`).
- All three migration files
  (`202608030003_client_share_owner_foundation.sql`,
  `202608030004_client_share_session_foundation.sql`,
  `202608030005_client_share_integrity_and_security.sql`) and their
  colocated `.test.ts` files remain unchanged.

**No SQL was executed by this agent during this correction pass, and no
Supabase project was accessed by this agent.** The next real validation
step is the user re-running file 03 (files 01/02 do not need to be
rerun) in the same or a fresh temporary Supabase project, and reporting
back whatever `PHASE1A_EXPECTED_SUCCESS_FAILED` or
`PHASE1A_EXPECTED_STATE_MISSING` detail (or, if every guarded step now
succeeds, the actual final result table) it produces.

## 25. Third real runtime execution: a real migration defect found and fixed (2026-08-04)

### What happened

The user performed the package's **third real execution**. Files 01 and
02 were **not rerun** -- only file 03 (carrying the prior pass's E18
guard) was rerun against the same disposable, non-production Supabase
project (`text2task-phase1a-temp-test`) that files 01 and 02 had already
been applied to. The new E18 guard worked exactly as designed and
stopped the script cleanly, immediately after E18, exposing the exact
underlying migration defect:

```
PHASE1A_EXPECTED_SUCCESS_FAILED: E/E18: PIN setup for link_e1 did not
PASS, so its downstream dependents cannot be trusted to run against the
state they assume. Recorded result for E/E18 -- status: FAIL, detail:
expected success, got SQLSTATE 2201B: invalid regular expression:
invalid repetition count(s)
```

- **Production was never accessed.** Only the disposable temporary
  project above was touched.
- **Runtime PASS remains NOT achieved.**
- **This is a real migration defect, not a harness defect.** Unlike
  Run 2's `SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED` (a downstream
  symptom three sections removed from its cause), SQLSTATE 2201B is
  PostgreSQL's own regex-engine error, raised directly by the CHECK
  constraint's expression evaluation itself -- there is no harness logic
  between E18's `UPDATE` and this error.

### Root cause: an out-of-range regex repetition bound

`project_share_links_pin_encoding_check`, as it existed in migration 003
before this pass, read:

```sql
constraint project_share_links_pin_encoding_check
  check (
    (pin_hash is null or pin_hash ~ '^[A-Za-z0-9_-]{32,512}$')
    and (pin_salt is null or pin_salt ~ '^[A-Za-z0-9_-]{16,128}$')
  )
```

PostgreSQL's regex engine (POSIX ARE, the same engine `~` uses) only
supports repetition-count bounds in the range 0 through 255. `{16,128}`
is within range and evaluates fine; `{32,512}` is not -- its upper bound,
512, exceeds 255, so the expression cannot be compiled at evaluation
time and PostgreSQL raises SQLSTATE 2201B, `invalid regular expression:
invalid repetition count(s)`, for **any** row where `pin_hash is not
null`, regardless of what value it actually holds. A `pin_hash` of
exactly 43 valid Base64url characters (E18's own value, and the exact
length `project_share_links_pin_completeness_check` separately requires
for the v1 profile) fails identically to an invalid one, because the
constraint's expression itself cannot be evaluated -- this was never a
case of a value being rejected as too long or too short.

This explains the complete runtime chain across all three runs:

1. E18 attempted to set `link_e1`'s PIN profile, including a non-null,
   43-character `pin_hash`.
2. `project_share_links_pin_encoding_check` evaluated the invalid
   `{32,512}` regex against it.
3. E18's `UPDATE` failed with SQLSTATE 2201B.
4. `link_e1` remained non-PIN (`pin_hash` stayed `NULL`, since the
   `UPDATE` never committed).
5. Run 2's script had no guard immediately after E18, so it continued
   silently for three more sections and reached L1, which supplied a
   non-null `pin_verified_at` for a link the trigger correctly computed
   as not requiring one (because `pin_hash` was still `NULL`), producing
   the downstream symptom `SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED`.
6. Run 3's new E18 guard (added in the sixth correction pass, section 24)
   correctly stopped immediately at E18 and exposed the real cause
   instead of the L1 symptom three sections later.

Every static hypothesis considered in the sixth correction pass's
section 24 static analysis was, in hindsight, checked against the wrong
layer: that analysis verified the *values* E18 supplies against both PIN
CHECK constraints' *logic*, and correctly found the values valid and the
completeness-check logic sound, but did not separately verify that the
encoding check's own *regex bound* was mechanically within PostgreSQL's
supported range -- an evaluation-time engine limit, not a logical
condition on the data. That is precisely the class of defect this task's
explicit instruction not to guess, and to require the actual runtime
SQLSTATE as evidence, exists to catch.

### 1. Fix: `project_share_links_pin_encoding_check` in migration 003

Replaced with an explicit `char_length(...) between ...` clause for the
length bound, keeping the anchored character-set regex unbounded so it
only restricts the character set:

```sql
constraint project_share_links_pin_encoding_check
  check (
    (
      pin_hash is null
      or (
        char_length(pin_hash) between 32 and 512
        and pin_hash ~ '^[A-Za-z0-9_-]+$'
      )
    )
    and (
      pin_salt is null
      or (
        char_length(pin_salt) between 16 and 128
        and pin_salt ~ '^[A-Za-z0-9_-]+$'
      )
    )
  )
```

This preserves the exact intended semantics: `NULL` remains allowed
(consistency with `project_share_links_pin_completeness_check`, which is
unchanged); a non-null `pin_hash` must be 32-512 Base64url characters
inclusive; a non-null `pin_salt` must be 16-128 Base64url characters
inclusive; the character set is unchanged
(`A-Z`, `a-z`, `0-9`, `_`, `-`); the regex remains anchored (`^...+$`,
which also still rejects an empty string, since `+` requires at least
one character -- `NULL` is the only way to skip the check, exactly as
before). The maximum `pin_hash` length was not reduced from 512, and no
regex was left unanchored. `project_share_links_pin_completeness_check`
and the PIN scrypt-profile constraints (`pin_hash_version = 1`,
`pin_scrypt_n = 16384`, `pin_scrypt_r = 8`, `pin_scrypt_p = 1`,
`pin_key_length = 32`) were not touched. Migrations 004 and 005 were not
touched. No other constraint, trigger, RLS policy, or grant in migration
003 was touched.

### 2. Regression tests added to `202608030003_client_share_owner_foundation.test.ts`

A new describe block, `"202608030003 - PIN encoding CHECK constraint
uses explicit char_length bounds, not an invalid regex repetition
count"`, adds six tests:

- confirms the constraint contains `char_length(pin_hash) between 32 and
  512`;
- confirms the constraint contains `char_length(pin_salt) between 16 and
  128`;
- confirms both PIN columns still use the exact anchored Base64url
  regex `^[A-Za-z0-9_-]+$`, extracted and compared from the constraint's
  own text rather than assumed;
- confirms neither regex was left unanchored or changed to permit an
  empty string;
- confirms the executable migration text (comments and `comment on ...`
  bodies stripped, matching this test file's existing `executable`
  convention) no longer contains the literal invalid bound `{32,512}`
  anywhere;
- a **generic** regression guard, not specific to the PIN columns: scans
  all executable SQL for every `{m}`, `{m,}`, and `{m,n}` regex
  repetition form, validates every numeric bound found, and fails with
  the exact offending bound named if any value exceeds 255 -- so a
  future regex bound introduced anywhere else in this migration that
  repeats the same class of mistake is caught automatically, not only
  the specific PIN columns fixed here.

No existing test was removed. No existing test's expected text needed to
change, because no prior test asserted the exact text of
`project_share_links_pin_encoding_check` -- the completeness-check tests
(which do assert exact text) target a different constraint and were
untouched.

### 3. File 02 and `MANIFEST.md` regenerated

The existing generator,
`scripts/client-share/build-phase1a-sql-editor-package.ps1`, was run
exactly once, unmodified (no proven generator defect exists; none of
this pass's findings implicate the generator itself, which only
concatenates the three source migrations verbatim and adds a safety
preamble/verification footer neither of which touches PIN logic).
Output:

```
Read source migration: 202608030003_client_share_owner_foundation.sql  sha256=05a3d2c91f99022131982816fee445598a32e22b99000557aff1d52ef967cc52
Read source migration: 202608030004_client_share_session_foundation.sql  sha256=e0cfff71635e32968ee21b7470dafc8075b6ca5b271aaab352af26705a70cdb9
Read source migration: 202608030005_client_share_integrity_and_security.sql  sha256=1574b6ea45218219751e70fbbbe32ac8636e090f6955631449829a4ac1edc12d
Order verification passed: 003, then 004, then 005, each exactly once.
Wrote generated bundle to: docs/client-share-phase1a-sql-editor/02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql
Generated bundle sha256=b8680b0f967fb5f04b4a5ed38295cf1dc0ca87a893e28c6a97faad3952a3f96d
```

Mechanically verified after regeneration:

- migration 003's begin-marker (`-- ===== BEGIN
  202608030003_client_share_owner_foundation.sql ...`) appears in file 02
  exactly once;
- migration 004's and migration 005's begin-markers each appear exactly
  once;
- the three appear in order 003 → 004 → 005 (the generator's own
  built-in position check, which throws on failure, passed, and this was
  independently re-checked by counting occurrences directly against the
  regenerated file);
- the corrected constraint text (`char_length(pin_hash) between 32 and
  512`, `char_length(pin_salt) between 16 and 128`) appears in file 02;
- the invalid `{32,512}` string still appears **once** in file 02 --
  inside this pass's own explanatory `--` comment in migration 003's
  source (which documents the old, broken bound for future readers), not
  in any executable CHECK constraint. It appears zero times outside a
  comment;
- migration 004's hash (`e0cfff71635e...`) and migration 005's hash
  (`1574b6ea4521...`) are byte-identical to their pre-correction values,
  confirming neither was touched;
- `03_RUN_PHASE1A_RUNTIME_TESTS.sql`'s hash is unchanged from before this
  pass, confirming it was not touched (not regenerated by the generator,
  which only ever writes file 02);
- `01_CREATE_TEMP_TEST_FIXTURE.sql`'s hash is unchanged, confirming it
  was not touched.

File 02 was never hand-patched independently of the generator -- the
generator was run and its output used as-is. `MANIFEST.md` was then
updated by hand with the generator's printed hashes (the generator
itself only writes file 02 and prints hashes to the console; it does not
write `MANIFEST.md`), retaining the prior hashes inline for reference so
the change is auditable.

### 4. `04_CAPTURE_RESULTS.md` and this report updated honestly

`04_CAPTURE_RESULTS.md` now records: the Run 1 and Run 2 entries
(unchanged); a full Run 3 entry (files 01/02 not rerun -- explicitly
noting this means Run 3 exercised file 03 against the OLD, still-broken
applied migration 003, since the fix made in this pass could not and did
not touch the already-provisioned disposable project); the confirmed
root cause and the full six-step chain reproduced above; an explicit
statement that this is a real migration defect, not a harness defect;
and a fresh "Run 4 — pending" template that explicitly calls out that
the next run must use the regenerated package against a **clean**
disposable database, not a bare rerun of file 03 against the existing
project (which would still be exercising the old, broken constraint and
would prove nothing about the fix). The notes section states plainly:
**do not claim the corrected migration has passed runtime validation
yet** -- it has not been run.

### 5. Targeted Vitest result

```
Test Files  3 passed (3)
     Tests  342 passed (342)
```

(336 previously passing assertions, unchanged, plus the 6 new regression
tests described above.)

### 6. Static self-audit performed

- `char_length(pin_hash) between 32 and 512` and `char_length(pin_salt)
  between 16 and 128` are present in migration 003 and in the
  regenerated file 02.
- The invalid `{32,512}` bound is absent from every executable statement
  in migration 003 and in file 02 (present exactly once in each, inside
  a `--` comment only).
- No regex repetition bound anywhere in migration 003's executable SQL
  exceeds 255 (verified both by the new generic Vitest guard and by
  direct inspection).
- `project_share_links_pin_completeness_check` and the PIN scrypt-profile
  literal checks (`pin_hash_version = 1`, `pin_scrypt_n = 16384`,
  `pin_scrypt_r = 8`, `pin_scrypt_p = 1`, `pin_key_length = 32`) are
  byte-identical to before this pass.
- `03_RUN_PHASE1A_RUNTIME_TESTS.sql` (file 03) is unchanged --
  byte-for-byte identical hash to before this pass.
- `01_CREATE_TEMP_TEST_FIXTURE.sql` (file 01) is unchanged.
- `202608030004_client_share_session_foundation.sql` and
  `202608030005_client_share_integrity_and_security.sql` (migrations 004
  and 005) are unchanged -- byte-identical hashes to before this pass.
- `202608030004...test.ts` and `202608030005...test.ts` (their colocated
  tests) were not touched.
- `MANIFEST.md`'s recorded hashes match the actual current files
  (verified directly against `sha256sum` output for migration 003, file
  02, file 03, and file 01).

**No SQL was executed by this agent during this correction pass, and no
Supabase project was accessed by this agent.** At the time this section
was written, the next real validation step was the user applying the
regenerated package to a clean disposable Supabase project. **This is now
historical: see section 27 for Runtime Run 4, which did exactly that and
passed** (`runtime_status = PASS`, 207/207, `text2task-phase1a-temp-test-v2`).

## 26. Eighth pass -- documentation-accuracy correction, no code/SQL change (2026-08-04)

Sections 1-25 accurately recorded the facts as they stood when each was
written, but several of them stated current-state claims in an
unqualified, package-wide way that section 25's intentional migration
edit then made stale without any of those sections being revisited. This
pass is a **documentation-accuracy correction only**: it changes no SQL,
migration, migration test, hash, or package script -- only prose in
`MANIFEST.md` and this report, correcting statements that had drifted out
of sync with section 25's own facts (which were themselves accurate and
unchanged).

**Corrected in `MANIFEST.md`:**
- The "three source migration files were not modified" confirmation was
  replaced with a precise statement: the generator itself is read-only
  and never modified any source migration; migration 003 was
  *intentionally* modified by hand in the seventh correction pass to fix
  the confirmed PIN regex defect; migrations 004 and 005 remained
  byte-identical; both old and new hashes for migration 003 and file 02
  are recorded together in the same file for auditability. No recorded
  SHA-256 value was altered.
- The unqualified "No SQL in this package was executed against any
  database" statement was replaced with an accurate account: earlier
  versions of files 01/02/03 were executed manually by the user in the
  disposable, non-production Supabase project during Runtime Runs 1-3;
  production was never accessed; at the time this section was written,
  the newly regenerated file 02 (containing the corrected migration 003)
  had not yet been executed, and runtime validation of the corrected
  package remained pending Run 4 in a clean disposable database. **This
  is now historical: Run 4 has since happened and passed -- see section
  27, and `MANIFEST.md`'s own text has been updated accordingly.** None
  of this was ever written to imply that this agent executed SQL -- it
  never has, in any pass including this one.

**Corrected in this report:**
- **Section 3** ("Exact files created") now distinguishes the nine files
  created during initial package construction from the six files
  (migration 003, its test, file 02, `MANIFEST.md`,
  `04_CAPTURE_RESULTS.md`, this report) intentionally modified in the
  seventh correction pass, and states plainly that migrations 004/005
  and file 03 remained unchanged throughout that pass.
- **Section 1**'s section-23 status paragraph now explicitly notes it
  held only "through section 23" and points forward to section 25's
  supersession, matching the scoping already present on the section-24
  paragraph.
- **Section 8**'s hash table is now explicitly labeled "as originally
  generated, before the seventh correction pass," with a note that its
  migration-003/file-02 values are no longer current and that
  `MANIFEST.md` is the authoritative, kept-up-to-date source -- the
  table's recorded values themselves were left untouched, exactly as
  originally generated.
- **Section 11**'s "no SQL was executed BY THIS AGENT" confirmation was
  updated to cover every pass through this one (rather than stopping at
  "this fifth pass"), to list migration 003 and its test among the files
  a correction pass has authored, and to state explicitly that authoring
  or editing SQL text is not executing it -- the underlying confirmation
  (this agent has never executed SQL) was, and remains, true without
  exception.
- **Section 15** ("existing Phase 1A files were not modified") now notes
  it held only at the time it was written and points to section 25's
  intentional modification of migration 003 and its test, while
  confirming `AGENTS.md`, both Phase 0/1A report files, and migrations
  004/005 with their tests remain unmodified to this day.

**Full consistency audit performed:** both documents were searched for
every unqualified current-state claim containing "no SQL was executed,"
"no migration was modified," "no other file was modified," "all
migrations remained unchanged," and "the package has never been run" (or
close paraphrases). Every instance found was one of: (a) a
section-scoped historical record of what was confirmed *during that
specific pass* (e.g., section 23's and 24's own static self-audits,
section 16's "Exact validation performed" list, section 24's self-audit
paragraph) -- left untouched, since these describe what was true when
that section was written and are already scoped by their own section
context, not a claim about current overall state; or (b) one of the five
corrections listed above. No historical fact, date, or SHA-256 value
anywhere in either document was rewritten or altered.

**Files read in full for this pass:** `MANIFEST.md`, this report,
`04_CAPTURE_RESULTS.md`, migration 003, and migration 003's test file.
**Files modified in this pass:** `MANIFEST.md` and this report only.
**No SQL was executed, no Supabase project was accessed, no migration
was applied, and no file other than these two was changed, during this
documentation-accuracy correction.**

## 27. Runtime Run 4: clean-database PASS, and the 207-vs-208 reconciliation (2026-08-05)

### What happened

The user performed **Runtime Run 4**, the package's fourth real
execution, in a **fresh, clean** disposable Supabase project
(`text2task-phase1a-temp-test-v2` -- deliberately not the
`text2task-phase1a-temp-test` project Runs 1-3 used, whose applied schema
still carried the old, invalid PIN-encoding constraint). Execution order:
`01_CREATE_TEMP_TEST_FIXTURE.sql`, then the **regenerated**
`02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql` (containing the seventh correction
pass's fix to `project_share_links_pin_encoding_check`), then
`03_RUN_PHASE1A_RUNTIME_TESTS.sql`.

- **File 01:** succeeded, `fixture_status = READY`.
- **File 02:** succeeded; the structural verification query returned
  `found = true` for all 10 tables, all 9 functions, and all 13
  triggers.
- **File 03:** completed and reached its own final result query --
  `total_tests = 207, passed_tests = 207, failed_tests = 0,
  runtime_status = PASS`.
- The script's transaction ended in `ROLLBACK`, as it always does by
  design, so none of file 03's fixture rows persisted in
  `text2task-phase1a-temp-test-v2`.
- **Production was never accessed.**

**This is Phase 1A's first successful clean-database runtime
validation**, and the first real-runtime confirmation that the seventh
correction pass's migration 003 fix works: `link_e1` was able to become
PIN-protected (E18), every other guarded expected-success dependency
audited in the sixth correction pass held, and the script ran through to
completion for the first time in this package's history.

This pass itself is **documentation-only**: it records Run 4's results
in `04_CAPTURE_RESULTS.md` and this report. No SQL, migration, migration
test, hash, or package script was changed. No SQL was executed and no
Supabase project was accessed by this agent.

### The 207 reconciliation (confirmed, mechanical -- not an open question)

An earlier version of this report described the difference between a
naive "208" grep total and Run 4's actual 207 result rows as an
unexplained one-row gap, and offered a mutually-exclusive-branch
hypothesis as an unconfirmed guess. **That was wrong. The explanation is
exact, mechanical, and fully confirmed by directly reading
`03_RUN_PHASE1A_RUNTIME_TESTS.sql`:**

- `03_RUN_PHASE1A_RUNTIME_TESTS.sql` contains **144** direct
  `perform pg_temp.try_stmt(...)` call sites.
- A plain textual grep for `perform pg_temp.record_result(...)` finds
  **64** occurrences.
- Exactly **one** of those 64 is not an independent assertion: it is the
  line `perform pg_temp.record_result(p_section, p_code, p_desc, v_pass,
  v_detail);` inside `pg_temp.try_stmt`'s own function body (defined
  starting a few lines above it in the file's assertion-infrastructure
  section) -- the mechanism by which each of the 144 `try_stmt` calls
  records its own outcome, not a separate, independently-authored
  assertion.
- Excluding that one helper-internal line: **63** independent
  `record_result` assertion call sites remain.
- **144 (`try_stmt`) + 63 (independent `record_result`) = 207** -- the
  exact, fully explained total of independent assertion call sites this
  file's source defines.

**Run 4's `total_tests = 207` matches this reconciled count exactly.**
There is no unexplained difference, no mutually-exclusive-branch
hypothesis needed, and no missing or non-executed assertion -- 207
passed and 0 failed, and 207 is precisely the number of independent
assertions the file's own text defines.

**"208" was never a valid assertion-call-site total.** It was a naive
grep sum (144 + 64) that failed to exclude the one helper-internal
`record_result` call inside `try_stmt`'s own implementation. Every place
in this package's documentation that described "208" as an assertion
total, a call-site total, or anything a real execution should be
expected to produce is corrected by this reconciliation (see section 9,
corrected directly). **207, not 208, is the correct figure for both the
static assertion-call-site count and the real runtime result count --
they are now known to be the same number for the same reason.**

### Static vs. real validation, side by side

- **Static SQL-contract tests (Vitest):** 342 passing assertions across
  the three migrations' colocated `.test.ts` files (336 originally, plus
  6 regression tests added by the seventh correction pass). These prove
  properties of the migration *text* -- schema shape, constraint
  wording, grant statements -- without ever connecting to a database.
  Unaffected by, and unrelated to, Run 4; last actually executed during
  the seventh correction pass (section 25).
- **Real PostgreSQL runtime tests (`03_RUN_PHASE1A_RUNTIME_TESTS.sql`,
  Run 4):** 207 real assertions executed against an actual, live,
  disposable PostgreSQL/Supabase database -- real `INSERT`/`UPDATE`/
  `DELETE` statements, real RLS, real triggers, real grants, real
  cascades -- 207 passed, 0 failed, `runtime_status = PASS`.

These are two different kinds of evidence and neither substitutes for
the other: the static suite proves the migration text has the shape and
wording it claims to; Run 4 proves that shape actually behaves correctly
against a real, live PostgreSQL database. Phase 1A now has both.

### Production application is a separate decision

**Runtime Run 4's PASS does not, by itself, authorize applying these
migrations to the Text2Task production project.** Passing this package's
static and runtime tests demonstrates the migrations behave as designed
against a disposable, empty, test-only database shaped like production
in the ways that matter to these triggers (see section 6's stated
fixture limitations) -- it does not itself constitute the separate,
explicit production-application decision and step described in
`05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`, which this pass leaves
entirely unchanged and still governing.

### `04_CAPTURE_RESULTS.md` and `MANIFEST.md` updated

`04_CAPTURE_RESULTS.md`'s Run log table now has a fourth row recording
Run 4's PASS, and the "Run 4 — pending" template section has been
replaced with the actual, filled result record described above. Its
Notes section now states plainly that runtime PASS has been achieved
and explains, mechanically, why 207 (not 208) is the correct assertion
count, and repeats the production-application caveat.

`MANIFEST.md`'s header now carries a "Runtime-verified: 2026-08-05"
line, and its "SQL execution history" confirmation has been extended
with Run 4's actual outcome, replacing the "has not yet been executed" /
"remains pending" language that was accurate when written but is now
superseded.

### Consistency audit performed for this pass

Both `04_CAPTURE_RESULTS.md` and this report were searched for the
literal terms `"208"`, `"Run 4 — pending"`, `"runtime PASS"` combined
with `"not achieved"`, and `"has not yet been executed"`. Every
current-state instance found (sections 1, 9, and 25's closing paragraph
in this report; the Run 4 template and Notes section in
`04_CAPTURE_RESULTS.md`) was corrected above. Instances left untouched
are section-scoped historical self-audit records from sections 16, 21,
22, 23, and 24 -- each describing what was confirmed *during that
specific pass*, before Run 4 (in most cases, before any real execution
at all) -- consistent with the same standard applied in the eighth
pass's own audit (section 26). No historical fact, date, or SHA-256
value anywhere in either document was rewritten or altered.

**No SQL was executed, no Supabase project was accessed, no migration
was applied, and no file outside `04_CAPTURE_RESULTS.md`,
`MANIFEST.md`, and this report was changed, during this pass.**

## 28. The 207 count fully explained: mechanical reconciliation, no open question (2026-08-05)

### What was wrong

Section 27, as written immediately after Runtime Run 4, correctly
reported the 207 result -- but incorrectly characterized the gap between
that real figure and an earlier "208" total as an **unexplained**
one-row difference, and offered an unconfirmed
mutually-exclusive-branch hypothesis as a possible (but not verified)
explanation. Section 9 likewise described "208" as an accurate static
assertion-call-site total, distinct from but not incompatible with the
runtime figure. Both were incorrect: "208" was never a valid
assertion-call-site count at all, static or otherwise, and the gap has a
confirmed, purely mechanical explanation, not merely a plausible one.

### The confirmed, mechanical explanation

Independently re-verified against the current
`03_RUN_PHASE1A_RUNTIME_TESTS.sql` for this pass:

```
$ grep -c "perform pg_temp.try_stmt(" 03_RUN_PHASE1A_RUNTIME_TESTS.sql
144
$ grep -c "perform pg_temp.record_result(" 03_RUN_PHASE1A_RUNTIME_TESTS.sql
64
```

Of those 64 `record_result` occurrences, exactly one is not an
independent, separately-authored assertion. It is this line, inside
`pg_temp.try_stmt`'s own function body (the file's
assertion-infrastructure section, where `try_stmt` is defined
immediately after `record_result`):

```sql
  perform pg_temp.record_result(p_section, p_code, p_desc, v_pass, v_detail);
```

This is the exact mechanism by which every one of the 144 `try_stmt`
calls records its own outcome -- it fires once per `try_stmt` call, as
part of `try_stmt`'s own implementation, and was never meant to be
counted as a 145th-through-208th separate assertion the way the other 63
`record_result` calls (used directly by non-`try_stmt` assertions, such
as catalog/privilege checks) are.

Excluding that one line: **63** independent `record_result` call sites
remain. **144 (`try_stmt`) + 63 (independent `record_result`) = 207.**
This is an exact, mechanical count of the file's own independent
assertion call sites -- not an approximation, not a static count distinct
from a runtime count, and not in need of any branch-reachability
hypothesis. Runtime Run 4's `total_tests = 207` is exactly this number,
because it is the same 207 assertions, executed.

### What this corrects

- **Section 9** no longer describes "208" as an accurate static
  assertion-call-site total or as a distinct-but-valid figure alongside
  the runtime count. It now states the confirmed 144 + 63 = 207
  reconciliation directly, as the count of independent assertion call
  sites this file's source defines.
- **Section 27**'s "The 207-vs-208 reconciliation" subsection was
  rewritten: the unconfirmed mutually-exclusive-branch hypothesis and
  the "this package does not have a confirmed explanation" language were
  removed and replaced with the confirmed mechanical explanation above.
  Section 1's section-27 status paragraph was corrected to match.
- **Sections 21-24's own historical self-audit passages** (each of
  which had separately recorded "144 + 64 = 208 result rows" as their
  own assertion-count confirmation at the time) were annotated in place
  -- their historical record of "144 `try_stmt` + 64 `record_result`"
  call-site counts is accurate and left untouched, but each now carries
  an explicit note that the "= 208 result rows" arithmetic was a naive
  sum that did not exclude `try_stmt`'s internal `record_result` call,
  pointing to this section for the confirmed 207 reconciliation. None of
  these passages ever claimed a runtime result -- they were static
  self-audits performed before any real execution (sections 21-22) or
  between real executions (23-24), so no runtime claim in them needed
  correcting, only the "208" arithmetic label.
- **`04_CAPTURE_RESULTS.md`**'s Run 4 result description and Notes
  section were rewritten to state the same confirmed 144 + 63 = 207
  reconciliation, replacing language that called the 207 figure merely
  "the real, executed-at-runtime result count" as if 208 were an
  equally-valid alternate static figure.

### Historical scope note

Per this task's own instruction, "208" remains written in this report
only in two shapes: (a) inside the mechanical count derivation itself
(144 + 64, before excluding the one helper-internal line), which is
correct arithmetic on the way to the real 207 total, not a claim that
208 is valid; and (b) inside historical self-audit passages (sections
21-24), each now explicitly annotated as a naive count that has since
been corrected. No occurrence of "208" anywhere in this report or in
`04_CAPTURE_RESULTS.md` now presents it as a valid assertion total, an
accurate call-site count, or a plausible runtime figure.

### Validation performed for this pass

- Re-ran `grep -c "perform pg_temp.try_stmt("` and
  `grep -c "perform pg_temp.record_result("` directly against the
  current `03_RUN_PHASE1A_RUNTIME_TESTS.sql`: 144 and 64, matching the
  figures used throughout this report.
- Located and read the one helper-internal `record_result` call inside
  `try_stmt`'s function body directly in the file (immediately before
  the function's closing `end; $f$;`), confirming it is the only
  `record_result` occurrence inside any function *definition* in the
  assertion-infrastructure section -- every other occurrence is a
  top-level assertion call site in sections HARNESS through O.
- Confirmed 144 + 63 = 207, matching Runtime Run 4's `total_tests`
  exactly.
- Searched this report and `04_CAPTURE_RESULTS.md` for `"unexplained"`,
  `"mutually-exclusive"`, `"one-row difference"`, `"208 remains"`, and
  `"208 call sites"`: every remaining instance is either part of this
  section's own corrected explanation (stating there is *no* unexplained
  difference and *no* mutually-exclusive-branch hypothesis needed) or an
  annotated historical reference per the scope note above.

**Facts left unchanged, per this task's explicit instruction:** Runtime
Run 4 -- 207 total, 207 passed, 0 failed, `runtime_status = PASS`;
static Vitest -- 342/342 PASS; file 01 `READY`; file 02 -- 10 tables, 9
functions, 13 triggers, all `found = true`; the Run 4 transaction rolled
back; production was never accessed; production application remains a
separate, unauthorized decision. Only the explanation of *why* the count
is 207 changed -- from "unexplained, one plausible guess offered" to
"confirmed and mechanical." No SHA-256 value, hash, migration, migration
test, script, or SQL file was touched. No SQL was executed and no
Supabase project was accessed during this pass.
