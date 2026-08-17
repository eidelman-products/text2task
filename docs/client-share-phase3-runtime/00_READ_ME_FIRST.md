# Client Share Link — Phase 3 Application Runtime Verification Package

> **READ THIS FIRST**
>
> - Run this package **only** inside a brand-new, empty, **temporary**
>   Supabase project created solely for this test. A project already used
>   for the Phase 1B, Phase 1C, Phase 2B, or Phase 3 rate-limit-foundation
>   packages is NOT reusable here — create a fresh one.
> - **Never** run any file in this package against the real Text2Task
>   production project, under any circumstance.
> - Run the files **in order**: `01`, then `02`, then `03`. Do not skip a
>   file.
> - **Do not edit the generated SQL**
>   (`02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_APPLICATION.sql`) while copying
>   it into the SQL Editor. It is mechanically generated, verbatim, from
>   the ten authoritative migration files under `supabase/migrations/`.
>   If you need a change, change the migration and regenerate the package
>   (`scripts/client-share/build-phase3-application-runtime-package.ps1`)
>   — never hand-edit the generated file.
> - **Stop immediately** if any file produces an unexpected error, and
>   report the exact error text rather than continuing or improvising a
>   fix inside the SQL Editor.
> - **Save the entire output** of file `03` into `04_CAPTURE_RESULTS.md`,
>   or paste it back into your conversation with the agent that produced
>   this package — either is fine, but do not discard it.
> - Delete the disposable Supabase project once you are done reviewing
>   the results.

## Why this package exists

Phase 3 application implementation (session exchange, the browser-session
cookie, the public `/share/<publicId>#<secret>` route, the PIN flow, and
the clean-URL projection read) is entirely Node application code under
`lib/share/*.server.ts` and `app/api/share/**` — no new migration was
added or is needed for it. That application code was written to depend on
specific behaviour of the EXISTING `share_browser_sessions`/
`share_session_grants` tables and their integrity triggers (delivered by
`202608030004_client_share_session_foundation.sql` and
`202608030005_client_share_integrity_and_security.sql`), and on the
existing `increment_share_rate_limit_bucket` RPC
(`202608130001_client_share_rate_limit_increment.sql`). Those objects
were already structurally verified by
`docs/client-share-phase2b-mapping-read-runtime/` and (for the RPC)
runtime-verified end-to-end by
`docs/client-share-phase3-rate-limit-runtime/`, but never specifically
exercised through the exact insert/update sequences the new Phase 3
application code actually issues. This package closes that gap by issuing
those exact sequences directly in SQL and confirming each is accepted or
rejected exactly as the application code assumes.

## Current status

**Prepared, not yet run.** This package has been written and the
generator has been run locally to produce file 02 and `MANIFEST.md`
(both mechanically assembled and hash-verified), but no file in this
package has been executed against any Supabase project. See
`04_CAPTURE_RESULTS.md` for the (currently empty) results template.

**This package existing does not mean Production has been touched, does
not mean Production application of any migration is (newly) authorized,
and does not mean the `TEXT2TASK_CLIENT_SHARE_ENABLED` feature flag has
been enabled anywhere.** Read
`05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` before considering any
further step, regardless of the eventual result.

## What this package proves (and does not prove)

This package runtime-verifies, against a real disposable PostgreSQL
database, the session/grant integrity invariants and rate-limit/
projection read paths the Phase 3 application code depends on:

1. Browser session creation succeeds with a well-formed digest; a
   malformed digest is rejected; `expires_at` matches the locked 7-day
   TTL.
2. A grant for a link that does not require a PIN is accepted with
   `pin_verified_at` left null.
3. A grant for a PIN-required link WITHOUT `pin_verified_at` is rejected
   — proving no pending/unauthorized grant can ever be created before PIN
   success.
4. A grant for a PIN-required link WITH `pin_verified_at` populated at
   insert time is accepted.
5. A grant for a link that does NOT require a PIN, but WITH
   `pin_verified_at` set anyway, is rejected.
6. One browser session holds independent current grants for two
   different links at once; revoking one grant does not touch the other
   (multi-link independence).
7. A grant issued against a stale `configuration_version` is rejected; a
   grant issued against the current version is accepted.
8. A grant expiry beyond the browser session's own expiry is rejected; a
   grant expiry beyond a sooner link expiry is rejected; a grant expiry
   set to `min(session expiry, link expiry)` — the locked product formula
   — is accepted.
9. Disabling a link rejects any NEW grant, but does not retroactively
   revoke an already-existing grant row at the database level — proving
   that protecting reads after a disable/revoke is the read-time
   revalidation's responsibility (already covered by the Vitest suite for
   `verifyShareProjectionAuthorization`), not an automatic database
   cascade.
10. The exact rate-limit scope/action combinations Phase 3 application
    code calls (`session_exchange`+`network_identity`,
    `pin_verification`+`share_link`, `projection_read`+`browser_session`,
    `invalid_link_access`+`network_identity`) are all accepted by the
    existing constraints and RPC.
11. The exact bounded column set `buildPublicClientShareProjection()`
    selects from `project_share_links`/`share_link_tasks`/
    `share_link_resources`/`share_link_updates`/`projects`/`tasks`/
    `task_resources` resolves correctly for a real fixture row.

This package does **not** re-prove the entire Client Share surface — the
existing `docs/client-share-phase1b-runtime/` (520/520 PASS),
`docs/client-share-phase1c-runtime/` (47/47 PASS),
`docs/client-share-phase2b-mapping-read-runtime/` (46/46 PASS) and
`docs/client-share-phase3-rate-limit-runtime/` (23/23 PASS + N=25
concurrency PASS) packages already did that for the owner-facing surface,
the mapping-read surface, and the atomic rate-limit counter's own
correctness/concurrency. This package's file 03 is deliberately scoped to
what is new in Phase 3.

This package does **not** prove:

- Anything about the actual HTTP behaviour of `POST /api/share/session`
  or `GET /api/share/[publicId]/projection`, the public page's fragment
  handling, the PIN UI, security headers, or analytics isolation — those
  are proven by the ~130 targeted Vitest tests already passing in the
  repository (`lib/share/*.test.ts`, `app/api/share/**/*.test.ts`,
  `app/share/**/*.test.tsx`), not by this SQL package.
- True browser/webview behaviour (fragment scrubbing, cookie handling
  across Chrome/Edge/Safari/WhatsApp/Instagram in-app browsers) — see
  `PHASE3_BROWSER_WEBVIEW_CHECKLIST.md` for that, a separate manual
  acceptance step this package does not perform.
- That any migration is newly authorized for Production application, or
  that the feature flag is authorized to be enabled. See
  `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.
- Anything by itself, until you actually run it and it reports
  `runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS`.

## Step by step

1. Create a brand-new, empty, temporary Supabase project.
2. Open that project's SQL Editor.
3. Paste and run `01_CREATE_TEMP_TEST_FIXTURE.sql` in full. Expect a
   single result row: `fixture_status = READY`.
4. Paste and run `02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_APPLICATION.sql`
   in full. Expect a final verification table where every row shows
   `found = true`.
5. Paste and run `03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql` in full.
   Expect a result table, a summary row, and — if anything failed — an
   isolated table of FAIL rows only, followed by a notice reading
   `runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS (N / N tests
   passed)`.
6. Save the complete output — see `04_CAPTURE_RESULTS.md`.
7. **Do not go further** (no Production application, no feature-flag
   change, no deploy) without an explicit, separate decision. Read
   `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` first regardless of the
   outcome.
8. Delete the disposable Supabase project.
9. Separately, when ready for real browser/webview acceptance, follow
   `PHASE3_BROWSER_WEBVIEW_CHECKLIST.md` against an actual running
   environment — that is a different, manual step this package does not
   perform.

## What each file is

| File | What it is |
|---|---|
| `00_READ_ME_FIRST.md` | This file. |
| `01_CREATE_TEMP_TEST_FIXTURE.sql` | Hand-authored. Same fail-closed safety check, sentinel and minimal base schema as the prior Client Share runtime packages, renamed to a Phase-3-application-specific sentinel so no package can ever be confused with another. |
| `02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_APPLICATION.sql` | Mechanically generated from the same ten authoritative migration files the Phase 3 rate-limit-foundation package used (no new migration exists for Phase 3 application code), verbatim, in order, with a safety preamble and a final structural verification query. Do not hand-edit. |
| `03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql` | Hand-authored. Real PostgreSQL runtime behaviour tests for the session/grant integrity invariants, rate-limit scope/action combinations, and public-projection column set the new Phase 3 application code depends on (the eleven items listed above), ending in a PASS/FAIL verdict. Always rolls back — safe to re-run against the same disposable project. |
| `04_CAPTURE_RESULTS.md` | Template for recording what actually happened when you run this package. Currently unfilled — not yet run. |
| `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` | Read this even if everything passes. |
| `PHASE3_BROWSER_WEBVIEW_CHECKLIST.md` | Separate manual acceptance checklist for real desktop/mobile browsers and in-app webviews — not SQL, not run automatically. |
| `MANIFEST.md` | Mechanically generated: full file inventory and SHA-256 hashes. |
| `../../scripts/client-share/build-phase3-application-runtime-package.ps1` | The generator that produces file `02` and `MANIFEST.md`. Read-only against `supabase/migrations/`; never runs SQL; never connects to Supabase. |
