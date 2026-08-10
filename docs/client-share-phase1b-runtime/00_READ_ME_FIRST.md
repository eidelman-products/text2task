# Client Share Link — Phase 1B Runtime Verification Package

> **READ THIS FIRST**
>
> - Run this package **only** inside a brand-new, empty, **temporary**
>   Supabase project created solely for this test.
> - **Never** run any file in this package against the real Text2Task
>   production project, under any circumstance.
> - Run the files **in order**: `01`, then `02`, then `03`. Do not skip a
>   file. Do not run `03` before `01`/`02` have both succeeded in the same
>   project — it will refuse to run and tell you why.
> - **Do not edit the generated SQL** (`02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql`)
>   while copying it into the SQL Editor. It is mechanically generated,
>   verbatim, from the seven authoritative migration files under
>   `supabase/migrations/`. If you need a change, change the migration and
>   regenerate the package (`scripts/client-share/build-phase1b-runtime-package.ps1`) —
>   never hand-edit the generated file.
> - **Stop immediately** if any file produces an unexpected error, and
>   report the exact error text rather than continuing or improvising a
>   fix inside the SQL Editor.
> - **Save the entire output** of file `03` (every result row, the summary
>   row, and the final `runtime_status`) into `04_CAPTURE_RESULTS.md` or
>   paste it back into your conversation with the agent that produced this
>   package — either is fine, but do not discard it.
> - Delete the disposable Supabase project once you are done reviewing the
>   results. Nothing in this package requires you to keep it.

## Current status

**Runtime verification has already been completed successfully.** A fresh
disposable Supabase project ran this exact package (files 01, 02, 03) and
file 03 reported `total_tests = 520, passed_tests = 520, failed_tests = 0,
runtime_status = PHASE_1B_RUNTIME_PASS`, reaching its PASS-path final
`rollback;`. See
`../TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_RUNTIME_VERIFICATION_REPORT.md`
(status `PHASE_1B_RUNTIME_VERIFIED_PASS`) and `04_CAPTURE_RESULTS.md`
(Run 2) for the full record, including the earlier 518-assertion/8-failure
run that found and led to correcting four independent defects before this
520/520 result was obtained.

**This does not mean Production has been touched or that Production
application is authorized.** Every run described above was against a
disposable, temporary Supabase project, never the Text2Task production
project. `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` remains the
authoritative statement of that separate restriction, unaffected by this
runtime PASS — read it before considering any further step.

The step-by-step instructions below remain accurate for anyone who needs
to rerun this package in the future (for example, after a genuine further
change to one of the seven migrations or to file 03 itself).

## What this package proves (and does not prove)

This package runtime-verifies, against a real disposable PostgreSQL
database, the exact behavior of:

- The three Phase 1A foundation/integrity migrations
  (`202608030003`, `202608030004`, `202608030005`) — already
  runtime-verified once before by the separate, existing
  `docs/client-share-phase1a-sql-editor/` package. This package re-applies
  them (they are prerequisites the Phase 1B RPCs depend on) but does not
  re-run that package's own 207-assertion suite against them a second
  time.
- Every one of the fourteen Phase 1B owner-facing RPCs delivered across
  `202608050001`, `202608060001`, `202608060002` and `202608060003`:
  object/security presence, owner read RPCs, draft creation, activation
  and the one-active-link rule, disable/re-enable, PIN set/clear, expiry
  set/clear, secret rotation, reveal, revoke, configuration save
  (settings, tasks, Resources, update publication), atomic rollback of
  combined configuration-save failures, the configuration-version /
  session-grant staleness contract, tenant isolation, and a final
  safe-output inspection pass. See sections A through R in
  `03_RUN_PHASE1B_RUNTIME_TESTS.sql` for the full, itemized list.

This package does **not** prove:

- Real multi-connection concurrent-session race behavior (see the runtime
  verification report's "known limitations").
- Server-side AES-256-GCM decryption of the revealed encrypted material —
  that is covered by `lib/share/share-secret-encryption.server.ts`'s own
  TypeScript tests, not by SQL.
- Anything about a public, anonymous `/share/**` route — none exists yet.
- That these migrations are authorized for Production application. See
  `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.
- Anything by itself, until you actually run it and it reports
  `PHASE_1B_RUNTIME_PASS`. A successfully *generated* package is not
  runtime proof of anything.

## Step by step

1. Create a brand-new, empty, temporary Supabase project. Do not reuse an
   existing project, including one used by the Phase 1A SQL Editor
   package.
2. Open that project's SQL Editor.
3. Paste and run `01_CREATE_TEMP_TEST_FIXTURE.sql` in full. Expect a
   single result row: `fixture_status = READY`.
4. Paste and run `02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql` in
   full. Expect a final verification table where every row shows
   `found = true` (11 tables, 9 trigger functions + 14 RPC functions, 14
   triggers). This is a fast structural smoke check only — file `03`'s own
   Section A is the authoritative runtime check for constraints, indexes,
   and exact-signature RPC security.
5. Paste and run `03_RUN_PHASE1B_RUNTIME_TESTS.sql` in full. Expect a
   result table (columns `test_number`, `section`, `test_name`,
   `description`, `status`, `expected`, `actual`, `details`), a summary
   row, and — if anything failed — an isolated table of FAIL rows only,
   followed by: `runtime_status = PHASE_1B_RUNTIME_PASS`. If any test
   failed, the script's final guard raises a `P0001` exception naming
   exactly how many of how many tests failed — the full result table and
   summary are still returned before that exception, so nothing is
   hidden. Treat **any** error the SQL Editor reports while running this
   file (that guard's own error, or any earlier unexpected error) as a
   FAIL requiring the visible result/error to be captured — do not assume
   a later `rollback;` statement is what "did the cleanup" on a FAIL run;
   PostgreSQL discards an aborted transaction's uncommitted work the
   moment it aborts, regardless of whether that statement is ever reached.
6. Save the complete output (or paste it back to the agent) — see
   `04_CAPTURE_RESULTS.md`.
7. **Do not go further** (no Production application, no Phase 2 work)
   without an explicit, separate decision. Read
   `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` first regardless of the
   outcome.
8. Delete the disposable Supabase project.

## What each file is

| File | What it is |
|---|---|
| `00_READ_ME_FIRST.md` | This file. |
| `01_CREATE_TEMP_TEST_FIXTURE.sql` | Hand-authored. Fail-closed safety check, sentinel, minimal base schema (`projects`/`tasks`/`clients`/`task_resources`/`project_updates`/`project_timeline_events`), two deterministic `auth.users` test identities. |
| `02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql` | Mechanically generated from the seven authoritative migration files, verbatim, in order, with a safety preamble and a final structural verification query. Do not hand-edit. |
| `03_RUN_PHASE1B_RUNTIME_TESTS.sql` | Hand-authored. Real PostgreSQL runtime behavior tests, sections A–R, ending in a PASS/FAIL verdict. Always rolls back — safe to re-run against the same disposable project. |
| `04_CAPTURE_RESULTS.md` | Template for recording what actually happened when you ran this package. |
| `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` | Read this even if everything passed. |
| `MANIFEST.md` | Mechanically generated from current package file contents: full ten-file inventory (origin + SHA-256 for every file except itself), and the seven source migration hashes. Regenerated by the same script as file `02`. |
| `../TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_RUNTIME_VERIFICATION_REPORT.md` | The full narrative report: purpose, scope, fixture model, security model, known limitations, current status. |
| `../../scripts/client-share/build-phase1b-runtime-package.ps1` | The generator that produces BOTH file `02` and `MANIFEST.md` from the seven source migrations and the other package files. Read-only against `supabase/migrations/`; never runs SQL; never connects to Supabase; never embeds a wall-clock timestamp. |
| `../../scripts/client-share/build-phase1b-runtime-package.test.ts` | Static structural tests for this package and its generator — never executes SQL or requires a database connection. |
