# Client Share Link — Phase 2B Mapping-Read Corrective Foundation Runtime Verification Package

> **READ THIS FIRST**
>
> - Run this package **only** inside a brand-new, empty, **temporary**
>   Supabase project created solely for this test. A project already used
>   for the Phase 1B or Phase 1C packages is NOT reusable here — create a
>   fresh one.
> - **Never** run any file in this package against the real Text2Task
>   production project, under any circumstance.
> - Run the files **in order**: `01`, then `02`, then `03`. Do not skip a
>   file.
> - **Do not edit the generated SQL**
>   (`02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql`) while copying it into
>   the SQL Editor. It is mechanically generated, verbatim, from the nine
>   authoritative migration files under `supabase/migrations/`. If you
>   need a change, change the migration and regenerate the package
>   (`scripts/client-share/build-phase2b-mapping-read-runtime-package.ps1`)
>   — never hand-edit the generated file.
> - **Stop immediately** if any file produces an unexpected error, and
>   report the exact error text rather than continuing or improvising a
>   fix inside the SQL Editor.
> - **Save the entire output** of file `03` into `04_CAPTURE_RESULTS.md`
>   or paste it back into your conversation with the agent that produced
>   this package — either is fine, but do not discard it.
> - Delete the disposable Supabase project once you are done reviewing
>   the results.

## Why this package exists

A read-only acceptance trace of the Phase 2B owner content-configuration
editor found that `get_share_link_management_state` (delivered
202608050001, extended 202608110001) returned only bare id arrays
(`mappedTaskIds`/`mappedResourceIds`) for the owner's curated task/
Resource mappings — never the persisted per-item metadata
(`public_group`, `waiting_for_client_feedback`, `display_order` for each
task; `public_label`, `can_download`, `display_order` for each Resource).
Because `save_share_configuration`'s task/Resource groups are a
deterministic full-set replacement, the editor could not reopen an
already-saved configuration losslessly: editing one item risked
silently overwriting an untouched sibling's real metadata with a guess.

Migration `202608110002_client_share_management_mapping_metadata.sql`
corrects this by extending `get_share_link_management_state` in place to
return `mappedTasks`/`mappedResources` — structured arrays carrying the
complete persisted per-item metadata — replacing the prior bare-id
arrays entirely. No new RPC, no new route, no new table, no change to
`save_share_configuration`.

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
database, exactly the Phase 2B corrective foundation's own delta on top
of the already Phase-1B/1C-runtime-verified foundation:

1. Persisted task mapping metadata is returned exactly.
2. Persisted Resource mapping metadata is returned exactly.
3. `displayOrder` is not normalized on read (out-of-sequence persisted
   values like 8/4 and 9/2 are returned exactly, never renumbered).
4. Updating one sibling through `save_share_configuration` never loses
   or alters an untouched sibling's metadata when the corrected read-
   then-resubmit flow is used.
5. Exact-set replacement semantics still work.
6. Empty-set clearing still works.
7. An omitted group still leaves that mapping unchanged.
8. Cross-tenant management read remains denied.
9. Revoked-link management behavior remains correct.
10. `anon` cannot execute the management RPC.
11. The authenticated-only grant posture is unchanged.
12. No secret/PIN material appears anywhere in the management result,
    and every mapping item exposes only its four documented fields.
13. The Phase 1C publication-intent flags still return correctly.
14. The latest current-update behavior remains intact.

This package does **not** re-prove the entire Phase 1B/1C surface — the
existing `docs/client-share-phase1b-runtime/` (520/520 PASS) and
`docs/client-share-phase1c-runtime/` (47/47 PASS) packages already did
that. This package's file 03 is deliberately scoped to this corrective
migration's own delta, not a third full re-verification of every prior
behavior.

This package does **not** prove:

- Anything about a public, anonymous `/share/**` route — none exists yet.
- Anything about the Phase 2B owner editor UI itself — that is covered by
  this repository's Vitest/React Testing Library suite, not by SQL.
- That this migration is authorized for Production application. See
  `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.
- Anything by itself, until you actually run it and it reports
  `PHASE_2B_MAPPING_RUNTIME_PASS`.

## Step by step

1. Create a brand-new, empty, temporary Supabase project.
2. Open that project's SQL Editor.
3. Paste and run `01_CREATE_TEMP_TEST_FIXTURE.sql` in full. Expect a
   single result row: `fixture_status = READY`.
4. Paste and run `02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql` in full.
   Expect a final verification table where every row shows
   `found = true`.
5. Paste and run `03_RUN_PHASE2B_MAPPING_READ_RUNTIME_TESTS.sql` in full.
   Expect a result table, a summary row, and — if anything failed — an
   isolated table of FAIL rows only, followed by `runtime_status =
   PHASE_2B_MAPPING_RUNTIME_PASS`.
6. Save the complete output — see `04_CAPTURE_RESULTS.md`.
7. **Do not go further** (no Production application, no Phase 2C work)
   without an explicit, separate decision. Read
   `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` first regardless of the
   outcome.
8. Delete the disposable Supabase project.

## What each file is

| File | What it is |
|---|---|
| `00_READ_ME_FIRST.md` | This file. |
| `01_CREATE_TEMP_TEST_FIXTURE.sql` | Hand-authored. Same fail-closed safety check, sentinel and minimal base schema as the Phase 1B/1C packages, renamed to a Phase-2B-mapping-specific sentinel so no package can ever be confused with another. |
| `02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql` | Mechanically generated from the nine authoritative migration files, verbatim, in order, with a safety preamble and a final structural verification query. Do not hand-edit. |
| `03_RUN_PHASE2B_MAPPING_READ_RUNTIME_TESTS.sql` | Hand-authored. Real PostgreSQL runtime behavior tests for this corrective migration's own delta (the 14 items listed above), ending in a PASS/FAIL verdict. Always rolls back — safe to re-run against the same disposable project. |
| `04_CAPTURE_RESULTS.md` | Template for recording what actually happened when you ran this package. |
| `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` | Read this even if everything passed. |
| `MANIFEST.md` | Mechanically generated: full file inventory and SHA-256 hashes. |
| `../../scripts/client-share/build-phase2b-mapping-read-runtime-package.ps1` | The generator that produces file `02` and `MANIFEST.md`. Read-only against `supabase/migrations/`; never runs SQL; never connects to Supabase. |
