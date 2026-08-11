# Client Share Link — Phase 1C Runtime Verification Package

> **READ THIS FIRST**
>
> - Run this package **only** inside a brand-new, empty, **temporary**
>   Supabase project created solely for this test. A project already used
>   for the Phase 1A or Phase 1B packages is NOT reusable here — create a
>   fresh one.
> - **Never** run any file in this package against the real Text2Task
>   production project, under any circumstance.
> - Run the files **in order**: `01`, then `02`, then `03`. Do not skip a
>   file.
> - **Do not edit the generated SQL**
>   (`02_APPLY_CLIENT_SHARE_THROUGH_PHASE1C.sql`) while copying it into
>   the SQL Editor. It is mechanically generated, verbatim, from the
>   eight authoritative migration files under `supabase/migrations/`. If
>   you need a change, change the migration and regenerate the package
>   (`scripts/client-share/build-phase1c-runtime-package.ps1`) — never
>   hand-edit the generated file.
> - **Stop immediately** if any file produces an unexpected error, and
>   report the exact error text rather than continuing or improvising a
>   fix inside the SQL Editor.
> - **Save the entire output** of file `03` into `04_CAPTURE_RESULTS.md`
>   or paste it back into your conversation with the agent that produced
>   this package — either is fine, but do not discard it.
> - Delete the disposable Supabase project once you are done reviewing
>   the results.

## Current status

**Not yet run.** This package has been generated and statically verified
(all `.test.ts` static tests pass, `npx tsc --noEmit` passes) but has not
yet been executed against a real disposable PostgreSQL database. See
`04_CAPTURE_RESULTS.md` for the template to record the real run.

**This package existing does not mean Production has been touched or
that Production application is authorized.** Read
`05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` before considering any
further step, regardless of the eventual result.

## What this package proves (and does not prove)

This package runtime-verifies, against a real disposable PostgreSQL
database, the exact behavior of Phase 1C on top of the already
Phase-1B-runtime-verified foundation:

- The three new `project_share_links` columns —
  `title_visible`, `status_visible`, `target_date_visible` — exist with
  the correct type, `NOT NULL` constraint and `DEFAULT false`, and every
  pre-existing row (created before this migration) defaults to
  private/off.
- The extended `get_share_link_management_state` RPC returns all three
  flags as real booleans, always, for both a freshly created draft and
  an already-active link.
- The extended `save_share_configuration` RPC accepts all three flags
  inside its existing `p_settings` group, persists them atomically with
  the rest of that group, and correctly bumps (or does not bump)
  `configuration_version` per the exact same `IS DISTINCT FROM`
  contract the pre-existing settings fields already have.
- Atomic rollback: if any other part of one `save_share_configuration`
  call fails, no publication-intent change from that same call persists
  either.
- Cross-tenant isolation and anon denial for the extended RPCs, matching
  the Phase 1B precedent exactly.
- That the pre-existing task/Resource/update-publication behavior this
  package re-exercises (as a regression check) still works unchanged.

This package does **not** re-prove the entire Phase 1B surface — the
existing `docs/client-share-phase1b-runtime/` package already did that
(520/520 PASS). This package's file 03 is deliberately scoped to Phase
1C's own delta plus a light regression pass, not a second full
re-verification of every Phase 1B behavior.

This package does **not** prove:

- Anything about a public, anonymous `/share/**` route — none exists yet.
- Anything about Phase 2 UI — no UI reads or writes these flags yet.
- That these migrations are authorized for Production application. See
  `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.
- Anything by itself, until you actually run it and it reports
  `PHASE_1C_RUNTIME_PASS`.

## Step by step

1. Create a brand-new, empty, temporary Supabase project.
2. Open that project's SQL Editor.
3. Paste and run `01_CREATE_TEMP_TEST_FIXTURE.sql` in full. Expect a
   single result row: `fixture_status = READY`.
4. Paste and run `02_APPLY_CLIENT_SHARE_THROUGH_PHASE1C.sql` in full.
   Expect a final verification table where every row shows
   `found = true`.
5. Paste and run `03_RUN_PHASE1C_RUNTIME_TESTS.sql` in full. Expect a
   result table, a summary row, and — if anything failed — an isolated
   table of FAIL rows only, followed by `runtime_status =
   PHASE_1C_RUNTIME_PASS`.
6. Save the complete output — see `04_CAPTURE_RESULTS.md`.
7. **Do not go further** (no Production application, no Phase 2B work)
   without an explicit, separate decision. Read
   `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` first regardless of the
   outcome.
8. Delete the disposable Supabase project.

## What each file is

| File | What it is |
|---|---|
| `00_READ_ME_FIRST.md` | This file. |
| `01_CREATE_TEMP_TEST_FIXTURE.sql` | Hand-authored. Same fail-closed safety check, sentinel and minimal base schema as the Phase 1B package, renamed to a Phase-1C-specific sentinel so the two packages can never be confused. |
| `02_APPLY_CLIENT_SHARE_THROUGH_PHASE1C.sql` | Mechanically generated from the eight authoritative migration files, verbatim, in order, with a safety preamble and a final structural verification query. Do not hand-edit. |
| `03_RUN_PHASE1C_RUNTIME_TESTS.sql` | Hand-authored. Real PostgreSQL runtime behavior tests for Phase 1C's delta plus a Phase 1B regression pass, ending in a PASS/FAIL verdict. Always rolls back — safe to re-run against the same disposable project. |
| `04_CAPTURE_RESULTS.md` | Template for recording what actually happened when you ran this package. |
| `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` | Read this even if everything passed. |
| `MANIFEST.md` | Mechanically generated: full file inventory and SHA-256 hashes. |
| `../TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1C_IMPLEMENTATION_REPORT.md` | The full narrative report for this phase. |
| `../../scripts/client-share/build-phase1c-runtime-package.ps1` | The generator that produces file `02` and `MANIFEST.md`. Read-only against `supabase/migrations/`; never runs SQL; never connects to Supabase. |
