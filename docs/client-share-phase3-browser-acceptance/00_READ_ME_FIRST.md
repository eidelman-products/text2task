# Client Share Link — Phase 3 Browser Acceptance Fixture Package

> **READ THIS FIRST**
>
> - This package extends the **same** disposable Supabase project already
>   used by `docs/client-share-phase3-runtime/` — it does not create a
>   new project, and it does not modify, re-run, or repurpose that
>   package's own `01_CREATE_TEMP_TEST_FIXTURE.sql`,
>   `02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_APPLICATION.sql`, or
>   `03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql` in any way.
> - **Never** run any file in this package against the real Text2Task
>   production project, under any circumstance.
> - Every executable SQL file fails closed unless the runtime package's
>   own sentinel table is present with the expected value — this is the
>   only trust boundary these scripts have, since SQL cannot securely
>   infer the Supabase dashboard project name from inside a query.
> - Run the files **in this exact order** — see "Complete execution
>   order" below. Do not skip a step, and do not sign in to the Preview
>   before the order says to.
> - **Stop immediately** if any file produces an unexpected error, and
>   report the exact error text rather than continuing or improvising a
>   fix inside the SQL Editor.

## Why this package exists

`docs/client-share-phase3-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql` was
built for one purpose only: giving that package's own File 03 enough
`projects`/`tasks`/`clients`/`task_resources` shape to satisfy the Client
Share integrity triggers' FK/RLS requirements. It was never meant to run
the real Text2Task dashboard, and it can't — direct inspection of the
actual application code (`app/api/tasks/route.ts`,
`lib/tasks/load-dashboard-tasks.server.ts`, `lib/supabase/ensureUser.ts`)
found: no `public.users` table at all (blocking login/signup bootstrap),
and `projects`/`tasks`/`clients`/`task_resources` missing most of the
columns those real code paths select or insert by exact name — including,
critically, the exact `title`/`status`/`deadline_date`/`task_title`/
`url`/`storage_path`/`file_name`/`resource_type` columns
`buildPublicClientShareProjection` itself selects, meaning even the
**public** Phase 3 projection endpoint would fail against the fixture as
it stood.

This package closes exactly those gaps — nothing more. It does not
attempt to recreate billing, subscriptions, calendar, or analytics
tables; none of those are on the path to reaching the Client Share panel
(confirmed by tracing the actual dashboard entrypoint and the Client
Share summary/draft routes, neither of which reads anything beyond
`projects.id`/`user_id`/`deleted_at`).

## Why owner Client Share operations still can't be pre-seeded here

`activate_share_link`, `disable_share_link`, `reenable_share_link`,
`rotate_share_link_secret`, `set_share_link_pin`/`clear_share_link_pin`,
and `save_share_configuration` are all `SECURITY DEFINER` and read
`auth.uid()` internally — they reject any call made without a genuine
authenticated Supabase Auth session. This is exactly the coverage gap the
runtime package's own File 03 documents that it could not close (it had
to reproduce these RPCs' invariants via direct SQL instead of calling
them). This package deliberately does **not** pre-seed any
`project_share_links` row or later lifecycle state — those must be
created for real, through the Preview, signed in as the disposable owner,
using the actual Client Share UI/API. That is the entire point of doing
browser acceptance at all.

## Why the disposable owner must be created through the Supabase dashboard, not `/login` signup

The app's own self-service signup (`/api/auth/signup`) calls
`ensureUser`, which reads/writes `public.users`, the moment email
confirmation completes. Using the disposable Supabase project's own
**Authentication → Users → "Add user"** dashboard action instead creates
the `auth.users` row directly, confirmed, without ever attempting to
send a confirmation email — so the deterministic, obviously-synthetic
address `phase3-browser-owner@example.invalid` (RFC 2606 reserves the
`.invalid` TLD specifically so it can never resolve to a real mailbox)
never becomes a deliverability problem. File 02 of this package then
resolves that user by email and fails closed if it finds zero or more
than one match — it never asks you to paste a UUID.

## What this package proves (and does not prove)

Proves, once actually run and signed into a Preview: that a real signup/
login bootstrap, a real project/task/resource creation path (or at
least a compatible one), and — most importantly — the real,
`auth.uid()`-gated Client Share lifecycle RPCs all work correctly when
driven by a genuine authenticated browser session against this disposable
project.

Does **not** prove: anything about the exact shape of a real Production
`projects`/`tasks`/`clients` row (this fixture's column *types* are
deliberately permissive, not a Production clone — see File 01's own
comments); anything about billing, calendar, or analytics, none of which
are touched; and it does not itself constitute browser/webview acceptance
— that remains a separate, manual pass using
`docs/client-share-phase3-runtime/PHASE3_BROWSER_WEBVIEW_CHECKLIST.md`
once this fixture is `READY` and a Preview is deployed.

## Current disposable project state (as of Browser Fixture Run 2 — READY)

The disposable project `text2task-phase3-application-runtime-temp`
already has, **persisted, do not redo, verified `browser_fixture_status
= READY` (16/16)**:

1. `docs/client-share-phase3-runtime/`'s own Files 01 and 02 — applied.
2. This package's `01_EXTEND_DISPOSABLE_APP_SCHEMA.sql` — applied
   (`DISPOSABLE_APP_SCHEMA_EXTENDED`).
3. The disposable Auth user, `phase3-browser-owner@example.invalid` —
   created via the Supabase dashboard.
4. This package's `02_SEED_DISPOSABLE_OWNER_CONTENT.sql` — applied
   (`DISPOSABLE_OWNER_CONTENT_SEEDED`).
5. `01A_PATCH_TASKS_IS_ARCHIVED.sql` — applied
   (`DISPOSABLE_TASKS_IS_ARCHIVED_PATCHED`), closing the one gap Run 1's
   verification found (`tasks.is_archived` missing).
6. `03_BROWSER_FIXTURE_VERIFICATION.sql` — re-run after the patch,
   reported **`browser_fixture_status = READY`, 16/16, 0 failed**. See
   `04_CAPTURE_RESULTS.md`, Runs 1–2, for the full incident record,
   including a harness-only result-visibility defect in File 03 itself
   that was corrected along the way.

**Browser fixture preparation is complete for this project. Do not
repeat any of steps 1–6 above.**

**Exact next step**: proceed directly to Preview ENV / Vercel below —
this is disposable-database preparation only; it does not itself
constitute Phase 3 browser/webview acceptance, which still requires a
real Preview deployment, real sign-in, and the full manual
`PHASE3_BROWSER_WEBVIEW_CHECKLIST.md` pass.

## Execution order for a brand-new disposable project

If this package is ever run against a *different*, fresh disposable
project (not the one above), `01_EXTEND_DISPOSABLE_APP_SCHEMA.sql` has
already been corrected to include `tasks.is_archived` from the start, so
File 01A is not needed in that case:

1. Confirm `docs/client-share-phase3-runtime/`'s own Files 01 and 02 are
   already applied in the disposable project.
2. Run this package's `01_EXTEND_DISPOSABLE_APP_SCHEMA.sql`. Expect a
   single result row: `schema_extension_status = DISPOSABLE_APP_SCHEMA_EXTENDED`.
3. Create the disposable Auth user in the Supabase dashboard —
   **Authentication → Users → "Add user"**, email
   `phase3-browser-owner@example.invalid`, "Auto Confirm User" enabled.
   Do **not** sign in anywhere yet.
4. Run this package's `02_SEED_DISPOSABLE_OWNER_CONTENT.sql`. Expect a
   single result row: `seed_status = DISPOSABLE_OWNER_CONTENT_SEEDED`,
   plus a `NOTICE` line echoing the resolved owner/project/task/resource
   ids.
5. Run this package's `03_BROWSER_FIXTURE_VERIFICATION.sql` (read-only).
   Expect four result sets: all checks, totals, FAIL-only (empty if
   everything passed), and a final verdict row reading
   `browser_fixture_status = READY` (or `NOT_READY`, with the exact
   `failed_checks` count, if not). This file never raises an exception,
   so all four result sets remain visible and queryable no matter the
   outcome. If it reports `NOT_READY`, run `03A_DIAGNOSE_BROWSER_FIXTURE_FAILURE.sql`
   next — it reproduces the same checks with explicit expected/actual
   detail per row, for pinpointing exactly which check failed and why.
6. **Only after `READY`**, configure the Vercel Preview environment
   variables (see "Preview ENV" below) — Preview-scoped only, never
   Production.
7. Deploy the Preview (CLI, against the current uncommitted tree — no
   `git push` required).
8. Sign in normally through the Preview, as the disposable owner, using
   the same email — the `public.users`/project/task/resource rows
   already exist by this point, so `ensureUser` resolves the existing row
   instead of trying to bootstrap a new one against a fresh account.
9. From there, use the real Client Share UI to create/activate/PIN/map/
   publish/disable/rotate/revoke against the seeded project, and work
   through `PHASE3_BROWSER_WEBVIEW_CHECKLIST.md`.

## What each file is

| File | What it is |
|---|---|
| `00_READ_ME_FIRST.md` | This file. |
| `01_EXTEND_DISPOSABLE_APP_SCHEMA.sql` | Hand-authored. Schema only — adds `public.users`, widens `projects`/`tasks`/`clients`/`task_resources` with exactly the columns the real dashboard and Phase 3 projection code select/insert, adds minimal owner-scoped write grants/RLS. Never requires the owner Auth user to exist. Corrected after Browser Fixture Run 1 to include `tasks.is_archived` from the start — the corrected version is only for a *brand-new* disposable project; the already-extended project uses File 01A instead (see "Current disposable project state" above). |
| `01A_PATCH_TASKS_IS_ARCHIVED.sql` | Hand-authored. Minimal, idempotent, additive-only patch for the already-extended disposable project: adds the one column File 01's original run was missing (`tasks.is_archived`), confirmed by Browser Fixture Run 1's B2 failure. No other column, no data loss, no Client Share table touched. |
| `02_SEED_DISPOSABLE_OWNER_CONTENT.sql` | Hand-authored. Data only — resolves the disposable owner by deterministic email, seeds one client/project/task/safe-link-resource. Deliberately creates no Client Share row of any kind. Idempotent — safe to re-run. |
| `03_BROWSER_FIXTURE_VERIFICATION.sql` | Hand-authored, read-only. 16 structured PASS/FAIL checks (2+4+5+4+1 across Sections A–E) proving schema closure, seed presence, ownership alignment, grants, and RPC presence, ending in a queryable `browser_fixture_status` verdict row. Never raises an exception, so its result sets always remain visible — see the file's own header for the incident that made this necessary. |
| `03A_DIAGNOSE_BROWSER_FIXTURE_FAILURE.sql` | Hand-authored, read-only, diagnostic-only. Reproduces File 03's exact 16 checks with additional expected/actual detail per row, for pinpointing a specific failure. Never raises an exception. Run only after File 03 reports `NOT_READY`. |
| `04_CAPTURE_RESULTS.md` | Template for recording what actually happened when this package is run. |
| `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` | Read this even if everything passes. |
| `MANIFEST.md` | Mechanically generated: full file inventory and SHA-256 hashes. |
| `../../scripts/client-share/build-phase3-browser-acceptance-package.ps1` | The generator that produces `MANIFEST.md`. Read-only against this package's own files; never runs SQL; never connects to Supabase. |

## Preview ENV — complete list (values never recorded here)

**Browser-public** (`NEXT_PUBLIC_`-prefixed, safe to expose to the client bundle):
- `NEXT_PUBLIC_SUPABASE_URL` — disposable project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — disposable project's RLS-bound key, used by every login/dashboard/authenticated request (`lib/supabase/client.ts`, `lib/supabase/server.ts`, `proxy.ts`).

**Server-only** (never `NEXT_PUBLIC_`-prefixed, never sent to the browser):
- `SUPABASE_SERVICE_ROLE_KEY` — disposable project's service-role credential (`lib/supabase/admin.ts`, `lib/supabase/ensureUser.ts`, both Phase 3 public API routes).
- `TEXT2TASK_CLIENT_SHARE_ENABLED=true` — Preview-scoped only; Production's own value must not be touched.
- `TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1` — freshly generated, disposable value; never the real Production key (no cross-environment dependency requires reusing it). Base64url-encoded, must decode to at least 32 bytes (`lib/share/share-secret.server.ts`'s `getShareSecretHmacKey`).
- `TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1` — **was missing from this list; this is real browser defect #3's root cause.** A separate, freshly generated, disposable value (never reused from `TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1` or any other key — see `lib/share/share-secret-encryption.server.ts`'s own header comment for why). Base64url-encoded, must decode to EXACTLY 32 bytes (AES-256 needs exactly 32, not merely "at least" 32 — `getShareSecretEncryptionKey`). Required by `activate_share_link`, `rotate_share_link_secret`, and `reveal_share_link_secret`'s owner-side repository functions (`lib/share/share-links-repository.server.ts`) to generate/encrypt/decrypt the share secret before ever calling the RPC — `save_share_configuration` never touches secret material, which is exactly why a save can succeed while activation fails on a deployment missing this specific key. Generate a fresh disposable value the same way `TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1` was generated, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`, and set it in the Preview environment only.
- `TEXT2TASK_SHARE_NETWORK_IDENTITY_HMAC_KEY_V1` — freshly generated, disposable value.
- `TEXT2TASK_SHARE_SESSION_HMAC_KEY_V1` — freshly generated, disposable value.
- `VERCEL` — platform-generated automatically by Vercel infrastructure; never set manually. Required for `POST /api/share/session`'s network-identity check to resolve at all — this is why local-only testing cannot complete the exchange flow (see the Phase 3 browser-acceptance preparation audit for the full trace).

No value for any of the above is recorded anywhere in this package.
