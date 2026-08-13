# Client Share Link — Phase 3 Rate-Limit Foundation Runtime Verification Package

> **READ THIS FIRST**
>
> - Run this package **only** inside a brand-new, empty, **temporary**
>   Supabase project created solely for this test. A project already used
>   for the Phase 1B, Phase 1C or Phase 2B packages is NOT reusable here —
>   create a fresh one.
> - **Never** run any file in this package against the real Text2Task
>   production project, under any circumstance.
> - Run the files **in order**: `01`, then `02`, then `03`, then (only if
>   you want to prove true concurrency) `06_concurrency_runner.mjs`. Do
>   not skip a file.
> - **Do not edit the generated SQL**
>   (`02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_RATE_LIMIT.sql`) while copying
>   it into the SQL Editor. It is mechanically generated, verbatim, from
>   the ten authoritative migration files under `supabase/migrations/`.
>   If you need a change, change the migration and regenerate the package
>   (`scripts/client-share/build-phase3-rate-limit-runtime-package.ps1`)
>   — never hand-edit the generated file.
> - **Stop immediately** if any file produces an unexpected error, and
>   report the exact error text rather than continuing or improvising a
>   fix inside the SQL Editor.
> - **Save the entire output** of file `03` (and of the concurrency
>   runner, if you run it) into `04_CAPTURE_RESULTS.md`, or paste it back
>   into your conversation with the agent that produced this package —
>   either is fine, but do not discard it.
> - Delete the disposable Supabase project once you are done reviewing
>   the results.

## Why this package exists

`public.share_rate_limit_buckets` (delivered by
`202608030004_client_share_session_foundation.sql`) was created with an
explicit design assumption, stated in that migration's own header, that
enforcement would later use "an atomic upsert and increment against the
unique bucket key ... never in application memory." No such operation has
ever existed. Migration `202608130001_client_share_rate_limit_increment.sql`
adds exactly one function,
`public.increment_share_rate_limit_bucket(...)`, that performs that
single atomic `INSERT ... ON CONFLICT ... DO UPDATE SET request_count =
request_count + 1` statement and nothing else — no rate-limit threshold,
no session/grant/PIN/projection application code, no other table change.

## Current status

**Runtime verified.** This package has been generated, statically verified
(all `.test.ts` static tests pass, `npx tsc --noEmit` passes), and has now
been executed end-to-end against a real disposable Supabase project —
`03_RUN_PHASE3_RATE_LIMIT_RUNTIME_TESTS.sql` reports 23/23 PASS
(`runtime_status = PHASE_3_RATE_LIMIT_RUNTIME_PASS`), and
`06_concurrency_runner.mjs` has been run (N = 25, `CONCURRENCY_RESULT:
PASS`, no lost increment). See `04_CAPTURE_RESULTS.md`, Run 1, for the
full authoritative record, including the two harness-only defects found
and corrected along the way (the migration/RPC itself was never changed).

**This package existing does not mean Production has been touched or
that Production application is authorized, and it does not mean Phase 3
application implementation (session exchange, cookies, grants, the
public route, the PIN flow, the projection read, security headers,
analytics isolation) has resumed.** Read
`05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` before considering any
further step, regardless of the eventual result.

## What this package proves (and does not prove)

This package runtime-verifies, against a real disposable PostgreSQL
database, exactly `increment_share_rate_limit_bucket`'s own behaviour:

1. The function exists with the exact expected signature.
2. Grants are `service_role`-only — `anon` and `authenticated` cannot
   execute it.
3. The first call for a fresh bucket returns `requestCount = 1`.
4. Sequential calls to the identical bucket return `2`, `3`, ... in order.
5. A distinct `action` produces an independent bucket.
6. A distinct identity produces an independent bucket.
7. Null-vs-non-null `share_link_id` scoping, and two distinct share
   links, each produce independent buckets — matching
   `share_link_key`'s existing generated-column design exactly.
8. An unsupported `window_seconds` value is rejected before any write.
9. `expiresAt` is deterministically `windowStart + windowSeconds`, and
   `windowStart` itself falls on a clean window boundary.
10. A call in a new logical window starts a fresh bucket row rather than
    accumulating onto an older, already-expired window's row.
11. Every other input-validation rule (unsupported `scope`, malformed
    `identity_digest`, non-positive `identity_digest_version`, `scope =
    share_link` without a link, `action = invalid_link_access` with a
    link) fails closed with a stable `P0001` code.
12. **True concurrency** (via `06_concurrency_runner.mjs`, run
    separately): N simultaneous overlapping RPC calls against the
    identical bucket never lose an increment — the final persisted
    `request_count` equals exactly N.

This package does **not** re-prove the entire Client Share surface — the
existing `docs/client-share-phase1b-runtime/` (520/520 PASS),
`docs/client-share-phase1c-runtime/` (47/47 PASS) and
`docs/client-share-phase2b-mapping-read-runtime/` (46/46 PASS) packages
already did that for the owner-facing surface. This package's file 03 is
deliberately scoped to this one new function.

This package does **not** prove:

- Anything about a public, anonymous `/share/**` route, session exchange,
  cookies, grants, the PIN flow, or the projection read — none of that
  exists yet. Phase 3 application implementation remains paused.
- Any rate-limit THRESHOLD (requests per minute, PIN attempts per
  window, etc.) — no such policy has been decided, and none is invented
  or tested here. This function returns only the atomically incremented
  count; comparing it against a limit is future application-code work.
- That this migration is authorized for Production application. See
  `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.
- Anything by itself, until you actually run it and it reports
  `runtime_status = PHASE_3_RATE_LIMIT_RUNTIME_PASS`.

## Step by step

1. Create a brand-new, empty, temporary Supabase project.
2. Open that project's SQL Editor.
3. Paste and run `01_CREATE_TEMP_TEST_FIXTURE.sql` in full. Expect a
   single result row: `fixture_status = READY`.
4. Paste and run `02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_RATE_LIMIT.sql` in
   full. Expect a final verification table where every row shows
   `found = true`.
5. Paste and run `03_RUN_PHASE3_RATE_LIMIT_RUNTIME_TESTS.sql` in full.
   Expect a result table, a summary row, and — if anything failed — an
   isolated table of FAIL rows only, followed by a notice reading
   `runtime_status = PHASE_3_RATE_LIMIT_RUNTIME_PASS (N / N tests
   passed)`.
6. (Optional but strongly recommended before relying on this function
   under real concurrent traffic) Run the concurrency runner — see its
   own header comment in `06_concurrency_runner.mjs` for exact
   environment variables and the exact command. It requires the
   disposable project's URL and `service_role` key supplied via
   environment variables only, never hard-coded.
7. Save the complete output — see `04_CAPTURE_RESULTS.md`.
8. **Do not go further** (no Production application, no resumed Phase 3
   application work) without an explicit, separate decision. Read
   `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` first regardless of the
   outcome.
9. Delete the disposable Supabase project.

## What each file is

| File | What it is |
|---|---|
| `00_READ_ME_FIRST.md` | This file. |
| `01_CREATE_TEMP_TEST_FIXTURE.sql` | Hand-authored. Same fail-closed safety check, sentinel and minimal base schema as the prior Client Share runtime packages, renamed to a Phase-3-rate-limit-specific sentinel so no package can ever be confused with another. |
| `02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_RATE_LIMIT.sql` | Mechanically generated from the ten authoritative migration files, verbatim, in order, with a safety preamble and a final structural verification query. Do not hand-edit. |
| `03_RUN_PHASE3_RATE_LIMIT_RUNTIME_TESTS.sql` | Hand-authored. Real PostgreSQL runtime behaviour tests for `increment_share_rate_limit_bucket` (the twelve items listed above, items 1–11), ending in a PASS/FAIL verdict. Always rolls back — safe to re-run against the same disposable project. |
| `06_concurrency_runner.mjs` | Hand-authored, plain Node.js (no new dependency). True-concurrency proof (item 12 above) — N simultaneous overlapping RPC calls against one identical bucket, proving no increment is lost. Reads its Supabase URL/key from environment variables only; never run automatically, and never contains a credential in source. |
| `04_CAPTURE_RESULTS.md` | Template for recording what actually happened when you ran this package. |
| `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` | Read this even if everything passed. |
| `MANIFEST.md` | Mechanically generated: full file inventory and SHA-256 hashes. |
| `../../scripts/client-share/build-phase3-rate-limit-runtime-package.ps1` | The generator that produces file `02` and `MANIFEST.md`. Read-only against `supabase/migrations/`; never runs SQL; never connects to Supabase. |
