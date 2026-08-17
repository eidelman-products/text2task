# Text2Task Client Share Link — Phase 3 Application Implementation Report

**Status:**

**SQL runtime: COMPLETE — 28/28 PASS.**

**Browser acceptance: COMPLETE — PASS.** SQL runtime 28/28, browser fixture 16/16 `READY`, and four real browser defects (#1 resource publicLabel reopen timing, #2 `SHARE_UPDATE_*` save-configuration mapping gap, #3 activation missing Preview encryption key, #4 correct-PIN grant-insert timestamp ordering) plus a lower-severity analytics-banner finding and a final owner-side PIN-disable UX gap were each found, root-caused, fixed, and — critically — **each fix was independently confirmed by a subsequent real-browser retest**, not merely by code review or unit tests. A fresh Vercel Preview containing every fix (through item 40, the PIN-disable UX gap) was then given a final, comprehensive real-browser acceptance pass covering the full owner flow, the full anonymous public flow, the full PIN enable/disable lifecycle, and privacy/analytics isolation — see item 41 for the complete final checklist. All prior real-browser defect history (items 35–40) is preserved below, unrewritten.

**Build: last full `npm run build` predates items 36–40 (Objective B redesign through the PIN-disable UX fix); application code has changed materially since. Running a fresh full Build and creating a checkpoint commit is the explicit next user step (see item 41) — not performed this turn, per this turn's own no-Build/no-commit constraint.**

*(Historical note, preserved as originally written: at the time this
paragraph was written, Phase 3 browser acceptance had not yet started.
That is no longer the current status — see item 41 for the final,
COMPLETE/PASS browser acceptance record. This paragraph's own factual
content, below, about that specific Build run remains accurate and
unchanged.)*

This is not a claim that Phase 3 is fully complete and verified end-to-end.
All application code, targeted tests, and TypeScript compile cleanly. The
user's own `npm run build` (Next.js 16.1.6, compiled successfully,
TypeScript clean, 89/89 static pages, with `/share/[publicId]`,
`/api/share/session`, and `/api/share/[publicId]/projection` present in
route output) remains valid, current acceptance evidence — application
code and migrations are unchanged since that Build. The disposable-project
SQL runtime-verification package has been run to completion against a
real disposable Supabase project
(`text2task-phase3-application-runtime-temp`): file 01 `READY`, file 02
all-structural-`found=true`, and file 03's final run reported
`runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS` (28/28 tests passed, 0
failed) — see `docs/client-share-phase3-runtime/04_CAPTURE_RESULTS.md`,
Run 8, for the authoritative record. Seven earlier file-03 attempts
(Runs 1–7) each surfaced a harness-only defect in that SQL test file
itself — never in a migration, RPC, trigger, or application code — each
diagnosed and corrected in this repository; that full history is also
preserved in `04_CAPTURE_RESULTS.md`.

A separate disposable-only fixture package,
`docs/client-share-phase3-browser-acceptance/`, extends the same
disposable Supabase project with exactly the `public.users` table and
`projects`/`tasks`/`clients`/`task_resources` columns the real dashboard
and the Phase 3 public
projection actually require (neither of which the SQL runtime package's
own minimal fixture provided), so that browser acceptance can be
performed through a real authenticated owner session rather than
pre-seeded SQL. Real Client Share lifecycle operations (activate/PIN/map/
publish/disable/rotate/revoke) are deliberately left for the actual
Preview/browser pass, not seeded by this package. This package's own
File 01 (schema extension) and File 02 (seed) have both been run
successfully against the disposable project; File 03 (verification)
reported 15 of 16 checks passing on its first run — the one failure's
detail was temporarily unrecoverable due to a harness-only
result-visibility defect in File 03 itself (a trailing `raise exception`
rolled back its own results table), since corrected, alongside a new
standalone diagnostic file (`03A_DIAGNOSE_BROWSER_FIXTURE_FAILURE.sql`).
A read-only probe run directly against the disposable database then
**confirmed** the cause: `public.tasks` was missing an `is_archived`
column that the real `app/api/tasks/route.ts` task-insert path also
explicitly sets on every task it creates. Two corrections were prepared
in response — `01_EXTEND_DISPOSABLE_APP_SCHEMA.sql` itself corrected for
any future brand-new disposable project, and a new minimal, idempotent,
additive-only patch, `01A_PATCH_TASKS_IS_ARCHIVED.sql`, for the
already-extended disposable project this run actually used. **The patch
has since been run successfully**
(`patch_status = DISPOSABLE_TASKS_IS_ARCHIVED_PATCHED`), and both the
`03A_DIAGNOSE_BROWSER_FIXTURE_FAILURE.sql` diagnostic and the corrected
`03_BROWSER_FIXTURE_VERIFICATION.sql` itself — run by the user as the
authoritative final check — now report **`browser_fixture_status =
READY`, 16/16, 0 failed**; the `is_archived` patch was the only fixture-
schema gap found across both verification runs. See
`docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md`,
Runs 1–2, for the full record. **Disposable browser fixture preparation
is complete, and the disposable Supabase environment is now ready for
Vercel Preview browser acceptance** — this is not the same as Phase 3 browser/webview
acceptance itself, which still requires a real Vercel Preview
deployment, real sign-in as the disposable owner, and the full manual
`PHASE3_BROWSER_WEBVIEW_CHECKLIST.md` pass, none of which have occurred
yet. The browser/webview
acceptance checklist (`docs/client-share-phase3-runtime/PHASE3_BROWSER_WEBVIEW_CHECKLIST.md`)
and final commit remain outstanding, user-owned steps — SQL/database
runtime acceptance and a prepared fixture package do not by themselves
constitute full Phase 3 acceptance.

## 1–2. Files created / modified

### New library modules (`lib/share/`)

| File | Purpose |
|---|---|
| `lib/share/share-identity.server.ts` | Keyed network-identity digest (`session_exchange`/`invalid_link_access` rate-limit identity) and unkeyed per-link identity digest (`pin_verification` rate-limit identity). |
| `lib/share/share-browser-session.server.ts` | Raw session secret generation, keyed HMAC digest, 7-day TTL constant, cookie policy (name/path/flags). |
| `lib/share/share-rate-limit.server.ts` | The exact locked V1 policy table and `checkShareRateLimit`, wrapping `increment_share_rate_limit_bucket`. |
| `lib/share/share-public-request.server.ts` | Public-request hardening (Content-Type, body-size bound, Origin/Sec-Fetch-Site checks), modeled on the Homepage Demo precedent. |
| `lib/share/share-session-grant.server.ts` | Link resolution, browser-session resolve/create, grant creation (`ensureCurrentGrant`), and the full read-time authorization gate (`verifyShareProjectionAuthorization`). |

### Modified library module

| File | Change |
|---|---|
| `lib/share/client-share-projection.server.ts` | Extracted a pure `assembleClientProjection` core from the existing owner-path builder; added `buildPublicClientShareProjection`, a new service-role read path for the public route. No change to owner-path behavior. |
| `lib/share/share-contracts.ts` | Exported the previously-internal `rawShareSecretSchema` so the client component can validate the fragment shape with the same canonical schema the server uses. |

### New API routes

| File | Purpose |
|---|---|
| `app/api/share/session/route.ts` | `POST` — the fragment/secret/PIN exchange endpoint. |
| `app/api/share/[publicId]/projection/route.ts` | `GET` — the clean-URL, cookie-only projection read endpoint. |

### New public route

| File | Purpose |
|---|---|
| `app/share/[publicId]/page.tsx` | Data-free server shell. |
| `app/share/[publicId]/share-view.client.tsx` | Client state machine: fragment handling, exchange, PIN UI, projection render. |

### Modified cross-cutting wiring

| File | Change |
|---|---|
| `proxy.ts` | Added `SHARE_PUBLIC_PAGE_HEADERS` and a route branch that sets them on `/share` and `/share/**`. |
| `lib/analytics/analytics-paths.ts` | Added `/share` and `/share/**` to the existing `shouldSkipAnalyticsPath` exclusion list. |
| `app/robots.ts` | Added `/share` and `/share/` to the existing central `disallow` array. |

### New tests

`lib/share/share-identity.server.test.ts` (9), `lib/share/share-browser-session.server.test.ts` (17), `lib/share/share-rate-limit.server.test.ts` (11), `lib/share/share-public-request.server.test.ts` (16), `lib/share/share-session-grant.server.test.ts` (40), `app/api/share/session/route.test.ts` (18), `app/api/share/[publicId]/projection/route.test.ts` (14), `app/share/[publicId]/share-view.client.test.tsx` (14), `lib/analytics/analytics-paths.test.ts` (8) — 147 tests across 9 new files — plus 10 new tests appended to the existing `lib/share/client-share-projection.server.test.ts` (43 → 53). **157 net new tests this phase.**

### Runtime/manual acceptance package (prepared, not executed)

`docs/client-share-phase3-runtime/{00_READ_ME_FIRST.md, 01_CREATE_TEMP_TEST_FIXTURE.sql, 02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_APPLICATION.sql (generated), 03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql, 04_CAPTURE_RESULTS.md, 05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md, PHASE3_BROWSER_WEBVIEW_CHECKLIST.md, MANIFEST.md (generated)}` and `scripts/client-share/build-phase3-application-runtime-package.ps1`.

## 3. Public route architecture

`GET /share/[publicId]` is a Next.js Server Component (`app/share/[publicId]/page.tsx`) that reads only the route's `publicId` param and renders `<ShareView publicId={publicId} />` — a `"use client"` component. The server component performs no Supabase call, no cookie read, no fragment read (fragments are never sent to any server by any browser), and no data fetch of any kind for the initial render.

## 4. Data-free SSR shell proof

`page.tsx`'s only output is the client component shell plus `export const metadata = { robots: { index: false, follow: false, noarchive: true } }` and `export const dynamic = "force-dynamic"`. It contains no project title, client name/contact, task/resource data, update body, or any internal identifier (project/link/owner UUID) in its server-rendered output — verified by direct inspection: the file has no import of any Supabase client, projection builder, or data-fetching helper.

## 5. Fragment lifecycle

On mount (and on `publicId` change), `share-view.client.tsx`'s effect: reads `window.location.hash` → if non-empty, extracts the candidate secret → **scrubs the URL first** via `window.history.replaceState` (before any validation or network call) → **then** validates the candidate's shape via the canonical, now-exported `rawShareSecretSchema` (never a hand-rolled regex) → on a valid shape, stores it in `secretRef` and calls the exchange; on an invalid shape, moves directly to the `unavailable` state with **no network call at all**. If no fragment is present, it calls the projection endpoint directly (the returning-visitor / clean-refresh path).

## 6. Secret non-persistence proof

The secret is held only in `secretRef = useRef<string | null>(null)` — never React state, never a DOM attribute, never `localStorage`/`sessionStorage`/`IndexedDB`, never a browser-readable cookie. `clearSecret()` runs on: successful authorization, any terminal/rate-limited outcome, component unmount, and `publicId` change. The one exception, matching the task's own allowance: a wrong-PIN response (`PIN_INCORRECT`) does **not** clear the ref, so the user can retry without reopening the original link. A dedicated test (`share-view.client.test.tsx`, "the secret never appears anywhere in the rendered DOM") asserts `container.innerHTML` never contains the raw secret.

## 7. Session exchange behavior

`POST /api/share/session` accepts `{publicId, secret, pin?}` (Zod `.strict()`), consumes `session_exchange` (10/300s, scope `network_identity`) **before** any secret/PIN cryptographic work, then validates publicId shape, resolves the link, and compares the provided secret's digest against the stored `secret_digest` using `timingSafeEqual` (never `===`). Unknown publicId, invalid secret, and disabled/revoked/expired link, and deleted project all return the **identical** generic `{ok:false, code:"UNAVAILABLE"}` at HTTP 404, additionally consuming `invalid_link_access` (20/300s, scope `network_identity`) — no enumeration oracle.

## 8. PIN behavior (all four cases)

- **No PIN required, valid secret:** browser session created/reused, current-link grant created (`pin_verified_at` null), `{ok:true, status:"authorized"}`.
- **PIN required, no PIN supplied:** **no session, no grant created at all** — returns only `{ok:true, status:"pin_required"}`. This matches the DB integrity trigger's own hard requirement (`enforce_share_session_grant_integrity` rejects a PIN-required grant with `pin_verified_at IS NULL`), so there is no path by which a "pending unauthorized" grant could ever exist.
- **PIN required, correct PIN:** `pin_verification` (5/300s, scope `share_link`) is consumed **before** the expensive scrypt verification; on success, the grant is inserted **with `pin_verified_at` populated at INSERT time**, `{ok:true, status:"authorized"}`.
- **PIN required, wrong PIN:** `pin_verification` is still consumed; no grant is created; response is the distinct `{ok:false, code:"PIN_INCORRECT"}` at HTTP 401 (judged safe — the caller already proved knowledge of the secret at this point, so this is not cross-link enumeration).

## 9. Exact PIN retry / rate-limit behavior

`pin_verification` limit is 5 per 300s, scoped per share-link (an unkeyed SHA-256 hash of the link id, independent of attacker IP/device). Attempts 1–5 within the window are evaluated normally (correct or incorrect PIN); attempt 6 within the same 300-second window returns HTTP 429 with a generic message and a `Retry-After` derived from the RPC's own `expiresAt`, before any PIN verification is attempted. No permanent lockout — the window resets after 300 seconds, per the locked V1 policy. Plaintext PIN is never stored (only the existing scrypt V1 hash/salt/params are compared) and never logged (`logShareRouteError` logs only `{stage, category}`).

## 10. Browser-session cookie configuration

Name `t2t_client_share_session`; `HttpOnly: true`; `Secure: isProductionRuntime()` (true only when `NODE_ENV === "production"`); `SameSite: "lax"`; `Path: "/api/share"` (narrowest path covering both public API routes — the page itself never reads this cookie); **no `Domain` set**; not `__Host-`-prefixed (which would require `Path=/`, broader than the chosen narrow path). Reused when the existing cookie resolves to a live, unrevoked, unexpired session; only minted fresh otherwise.

## 11. Exact 7-day TTL implementation

`SHARE_BROWSER_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60 = 604800`, used both for the DB row's `expires_at` (`now() + 604800s`) and the cookie's `maxAge`. Verified by a dedicated unit test asserting the exact numeric constant.

## 12. Grant expiry behavior

Every grant's `expires_at` is computed as `min(browserSessionExpiresAt, linkExpiresAt ?? +Infinity)` in application code before insert, and independently re-enforced by the DB trigger (`SHARE_GRANT_EXPIRY_EXCEEDS_SESSION` / `SHARE_GRANT_EXPIRY_EXCEEDS_LINK`), so the 7-day session TTL never extends a link's own, independently-authoritative `expires_at`.

## 13. Multi-link session behavior

Grants are keyed `(browser_session_id, share_link_id)`. `ensureCurrentGrant` only ever touches the row for the specific link being authorized; opening project B never revokes or reads project A's grant row. Verified in both `share-session-grant.server.test.ts` (unit) and the prepared SQL runtime package's Section F (integration-shaped).

## 14. `configuration_version` invalidation

`ensureCurrentGrant` reuses an existing current grant only when `granted_configuration_version === link.configurationVersion` **exactly**; any mismatch is treated as stale, the old grant row is marked `revoked_at = now()`, and a fresh grant is inserted at the link's current version. A grant is never auto-upgraded — the DB trigger independently rejects an insert at a stale version (`SHARE_GRANT_CONFIGURATION_VERSION_STALE`), so rotation/reconfiguration reliably forces reauthorization through the valid bearer link.

## 15. Public projection authorization

`GET /api/share/[publicId]/projection` accepts **no bearer secret in any form** (no query/header/body parameter). Authorization is derived solely from the `t2t_client_share_session` cookie, and **every** read fully revalidates: session digest match/not-expired/not-revoked, grant same-session/same-link/not-expired/not-revoked/exact-configuration-version-match, link active/not-disabled/not-revoked/not-expired, project not deleted, and (if currently required) a valid `pin_verified_at`. The cookie is never trusted alone. `projection_read` (120/300s, scope `browser_session`, keyed by the session's own digest) is consumed before authorization is even checked. Every failure branch (missing cookie, forged cookie, expired session, revoked grant, stale version, unavailable link, deleted project) returns the same generic `{ok:false, code:"UNAVAILABLE"}` at HTTP 401.

## 16. Phase 2D projection reuse

No `PublicClientProjectProjection` or `PublicClientProjectView` was created. `buildPublicClientShareProjection` and the existing owner-path `buildClientShareProjection` both call the same extracted `assembleClientProjection` pure core, so every privacy rule (no `select("*")`, no raw project/resource/subtask serialization, safe status/URL mapping) is enforced identically on both paths — proven by re-running all 43 pre-existing owner-path tests unchanged, plus a second mandatory toxic/private-field fixture test on the new public/service-role path. `app/share/[publicId]/share-view.client.tsx` renders the ready state via the exact, unmodified `ClientProjectView` component from Phase 2D.

## 17. The four rate-limit policies (exact)

| Action | Limit | Window | Scope | Identity |
|---|---|---|---|---|
| `session_exchange` | 10 | 300s | `network_identity` | keyed HMAC digest of client IP |
| `pin_verification` | 5 | 300s | `share_link` | unkeyed SHA-256 digest of the link id |
| `projection_read` | 120 | 300s | `browser_session` | the session's own digest |
| `invalid_link_access` | 20 | 300s | `network_identity` | keyed HMAC digest of client IP |

All four are drawn only from the already-authorized `scope`/`action` vocabulary in `share_rate_limit_buckets`'s existing CHECK constraints — no new scope or action value was invented.

## 18. Atomic RPC reuse

Every rate-limit check calls `public.increment_share_rate_limit_bucket` exclusively — no in-memory counter, no separate SELECT-then-UPDATE. `checkShareRateLimit` fails closed (`allowed:false`) on any RPC error or malformed response, so an unreachable limiter is never treated as "unlimited."

## 19. Generic failure / enumeration posture

Unknown publicId and invalid secret return the identical response; disabled/revoked/expired-link and deleted-project failures are likewise indistinguishable from each other and from "unknown publicId" at the session-exchange endpoint. The projection endpoint's every internal-check failure collapses to the same generic `UNAVAILABLE`. No response ever includes a DB id, configuration version, or internal lifecycle reason.

## 20. Public security headers

`proxy.ts` sets, on every `/share` and `/share/**` page request: `Cache-Control: private, no-store`, `Pragma: no-cache`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Robots-Tag: noindex, nofollow, noarchive`, `Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'none'`. Both API routes set the same `Cache-Control`/`Pragma`/`Referrer-Policy`/`X-Content-Type-Options` headers directly on every response branch, including errors and 429s. `script-src`/`style-src` CSP hardening is deliberately deferred, per the task's own instruction, to a later full-hardening phase.

## 21. noindex / sitemap behavior

`page.tsx` sets per-page `metadata.robots = { index: false, follow: false, noarchive: true }`; `proxy.ts` additionally sets `X-Robots-Tag`; `app/robots.ts`'s central `disallow` array now includes `/share` and `/share/`. The route was never added to `app/sitemap.ts` (no change needed — it never listed dynamic share links).

## 22. Third-party analytics isolation

`lib/analytics/analytics-paths.ts`'s `shouldSkipAnalyticsPath` now also returns `true` for `/share` and any `/share/**` path, so `MicrosoftClarity`, `GoogleAdsTag`, `AttributionCapture`, and `ConsentAwareVercelAnalytics` — each already gated on this single function — never inject their scripts on the public route. A new regression test file confirms `/admin` and `/homepage-demo/review` remain excluded and ordinary marketing/dashboard paths remain un-excluded.

## 23. Phase 4/5/6 exclusions confirmed

No signed file URL, no file download/open endpoint, no Storage authorization, and no file access token were implemented — the projection exposes only the safe metadata Phase 2D already defines. No client comment submission, owner reply, feedback resolution, or Client Communication History UI exists anywhere in this change. `commentsEnabled` is projected and may be displayed, exactly as already defined — no submission UI.

## 24. Targeted test result

`npx vitest run lib/share app/api/share app/share app/components/dashboard/tasks/share-link lib/analytics app/api/share-links supabase/migrations` → **55 test files passed, 2422 tests passed**, 0 failed. This includes all 157 net-new Phase 3 tests plus every pre-existing Phase 0–2D and rate-limit-foundation test, with zero regressions.

## 25. TypeScript result

`npx tsc --noEmit -p tsconfig.json` → exit code 0, no errors.

## 26. `git diff --check`

Exit code 0 — no whitespace errors. (Line-ending advisory warnings from Git's own CRLF autocrlf setting appeared for the pre-existing-file modifications; these are not whitespace errors and `git diff --check` reported none.)

## 27. `git status --short`

```
 M app/robots.ts
 M lib/analytics/analytics-paths.ts
 M lib/share/client-share-projection.server.test.ts
 M lib/share/client-share-projection.server.ts
 M lib/share/share-contracts.ts
 M proxy.ts
?? app/api/share/
?? app/share/
?? docs/client-share-phase3-runtime/
?? lib/analytics/analytics-paths.test.ts
?? lib/share/share-browser-session.server.test.ts
?? lib/share/share-browser-session.server.ts
?? lib/share/share-identity.server.test.ts
?? lib/share/share-identity.server.ts
?? lib/share/share-public-request.server.test.ts
?? lib/share/share-public-request.server.ts
?? lib/share/share-rate-limit.server.test.ts
?? lib/share/share-rate-limit.server.ts
?? lib/share/share-session-grant.server.test.ts
?? lib/share/share-session-grant.server.ts
?? scripts/client-share/build-phase3-application-runtime-package.ps1
```
(Plus this report file itself, added after this listing was captured.) `git diff --stat` for the six modified files: `801 insertions(+), 84 deletions(-)`. Full diffs of every modified file, and the complete text of every new file, were inspected directly for secret/PIN/session-credential/private-projection leakage — none found; a repo-wide grep for `console.log`/`console.debug`/`console.info` across every new Phase 3 file returned no matches (only sanitized `console.error("share_public_route_error", {stage, category})` calls exist).

## 28. Migration status

**No migration was added, modified, or applied during this application phase.** All Phase 3 application code operates against the ten already-authorized, already-applied Client Share migrations through 202608130001. This determination rests on the existing service-role grants already present on `share_browser_sessions`, `share_session_grants`, `project_share_links`, `share_link_tasks`, `share_link_resources`, and `share_link_updates` (from `202608030005_client_share_integrity_and_security.sql`), plus the default, never-revoked service-role access to `projects`/`tasks`/`task_resources`.

## 29. Runtime package files prepared

`docs/client-share-phase3-runtime/` contains `00_READ_ME_FIRST.md`, `01_CREATE_TEMP_TEST_FIXTURE.sql`, `02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_APPLICATION.sql` (mechanically generated, hash-verified), `03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql` (11 sections, session/grant integrity invariants, rate-limit scope sanity, projection column sanity), `04_CAPTURE_RESULTS.md`, `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`, and `MANIFEST.md` (generated). The generator, `scripts/client-share/build-phase3-application-runtime-package.ps1`, was run locally (`PACKAGE_VERIFICATION_STATUS: PASS`) — this only writes local files and never touches Supabase. The user ran files 01 and 02 against a disposable Supabase project (both succeeded, once — never re-run, since neither was ever implicated by any file-03 error). File 03 errored seven times on seven separate harness-only defects before its final, passing run: Run 1, a PIN fixture column with the wrong length for `project_share_links_pin_completeness_check`; Run 2, a PostgreSQL `42601` syntax error from an `INSERT` nested as an inline expression inside two assertion calls; Run 3, a `P0001 SHARE_LINK_VERSION_NOT_INCREMENTED` rejection of a direct disable/re-enable `UPDATE` that omitted the `configuration_version` increment the real `disable_share_link`/`reenable_share_link` RPCs always perform; Run 4, a `P0001 SHARE_LINK_DISABLED_AT_DECREASE` rejection of the same restore statement incorrectly clearing `disabled_at` to null, which the real `reenable_share_link` RPC deliberately never does; Run 5, a PostgreSQL `42883` function-overload resolution failure from `increment_share_rate_limit_bucket`'s fourth argument being passed as a bare integer literal instead of `smallint` at all five call sites in the rate-limit sanity-check section; Run 6, a PostgreSQL `23502` NOT NULL violation from a `share_link_resources` fixture INSERT omitting `public_label`; Run 7, a PostgreSQL `23502` NOT NULL violation from a `share_link_updates` fixture INSERT omitting `version` (and, latently, `created_by`) — all three omitted columns NOT NULL with no default since the original schema. All seven were corrected in the repository copy of file 03 — see `04_CAPTURE_RESULTS.md`, Runs 1–7, for the full record. The migration/trigger/RPC/table surface itself was never implicated or changed by any of the seven — in Runs 3 and 4 the trigger correctly rejected two harness mutations that did not reproduce the real RPCs' exact lifecycle behavior, in Run 5 the RPC correctly failed to resolve a mistyped call, and in Runs 6 and 7 two tables correctly rejected incomplete fixture rows.

**Run 8, using the fully-corrected file, is the authoritative final SQL runtime result: `runtime_status = PHASE_3_APPLICATION_RUNTIME_PASS`, `total_tests = 28, passed_tests = 28, failed_tests = 0`, reached its own trailing `rollback;` cleanly** — see `04_CAPTURE_RESULTS.md`, Run 8. This completes SQL/database runtime acceptance for the Phase 3 application layer. It does not by itself complete Phase 3 acceptance overall: browser/webview acceptance (`PHASE3_BROWSER_WEBVIEW_CHECKLIST.md`) has not been executed, `npm run build` has not been run, and no final commit has been made.

## 30. Browser/webview checklist prepared

`docs/client-share-phase3-runtime/PHASE3_BROWSER_WEBVIEW_CHECKLIST.md` covers Desktop (Chrome, Edge) and Mobile (normal browser, WhatsApp in-app browser, Instagram in-app browser, iOS Safari, Android Chrome/WebView) against the 16 required manual proof points (fragment present initially, server never receives it, prompt scrub, project load, clean-refresh, PIN success/failure/rate-limit, disabled/revoked/rotated/expired-link loss of access, no secret in navigation, no third-party tracking requests, no stale cache after revocation, multi-link grants). Not executed — a per-row Pass/Fail/N/A table is provided for manual completion.

## 31. Confirmation: no SQL/Supabase/Production access

No SQL statement was executed against any Supabase project (disposable or Production) during this phase. The only PowerShell execution performed was the local, read-only-against-migrations bundle/manifest generator.

## 32. Confirmation: feature flag remains disabled

`TEXT2TASK_CLIENT_SHARE_ENABLED` was not enabled anywhere. Every new server code path (`lib/share/share-availability.server.ts`'s `assertClientShareEnabled`, used by both new API routes) fails closed before any Client Share DB work when the flag is off, matching the existing Phase 0–2D convention.

## 33. Confirmation: no Build/stage/commit/push/deploy

`npm run build` was not run. No file was staged (`git add`), committed, pushed, or deployed during this phase.

## 34. Confirmation: Phase 4/5/6 not started

No signed-URL/file-access, client-comment/feedback, or Client Communication History code exists anywhere in this change, per item 23 above.

## 35. Real browser defect found during Vercel Preview acceptance, root-caused and fixed

**This section records a genuine application defect found through real browser
testing against the Vercel Preview deployment described in
`docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md`. It does
not revise, retract, or supersede any prior SQL runtime (28/28,
`PHASE_3_APPLICATION_RUNTIME_PASS`) or browser fixture (16/16, `READY`)
result recorded there or in `docs/client-share-phase3-runtime/04_CAPTURE_RESULTS.md`
— those results stand as-is. This is a new, later finding from the first
real owner-UI session against that already-verified environment.**

### Symptom (as reported)

Owner created a draft link, configured project visibility/share settings, a
task, and a Resource (public label initially defaulted to the resource's own
title), clicked "Save configuration" (no success feedback shown, a
separately-tracked known gap — see item below), then closed and reopened the
panel. On reopen: project visibility, share settings, and the task selection
(including its public group) all correctly reflected the persisted save. The
Resource's own selection/label state did not — clicking "Save configuration"
again then failed with the generic `"That action could not be completed."`
message.

### Investigation

Every layer of the actual persistence chain was read and independently
verified correct:

- `save_share_configuration` (current definition, `202608110001_client_share_publication_intent.sql`,
  lines 863–941): the resource sub-operation does a deterministic
  delete-then-upsert against `share_link_resources`, storing `public_label`
  exactly as submitted, then verifies the resulting row count against the
  submitted set (`RESOURCE_SET_VERIFICATION_FAILED` on mismatch). No bug.
- `share_link_resources_public_label_check` (`202608030003_client_share_owner_foundation.sql`,
  line 464): a real DB CHECK constraint (`char_length(btrim(public_label)) >= 1`)
  makes a blank persisted label structurally impossible. Confirmed present.
- `get_share_link_management_state` (`202608110002_client_share_management_mapping_metadata.sql`,
  lines 206–225): selects `resource.public_label` directly into
  `mappedResources` with no transformation. No bug.
- `mappedShareLinkResourceSchema` (`lib/share/share-contracts.ts`): uses the
  same strict, non-blank `publicLabelSchema` on the read side — a genuinely
  blank label from the RPC would fail the *entire* management-state parse
  (visible as a load error on the whole panel), which does not match the
  reported symptom (every other field reloaded correctly).
- `saveShareConfiguration`/`getShareLinkManagementState` (`lib/share/share-links-repository.server.ts`):
  both are thin, correct RPC-call-plus-schema-parse wrappers.

With every server-side layer proven correct, the defect is entirely
client-side, in `share-link-configuration-editor.tsx`.

### Root cause (confirmed)

`ShareLinkPanel` mounts `ShareLinkConfigurationEditor` as soon as
`state.project && state.data` becomes true (`share-link-panel.tsx`) — i.e.
as soon as the management-state read (which carries the correct, freshly
persisted `mappedResources`) resolves. It does **not** wait for the
separately-fetched project Resources list (`state.resources`, loaded by an
independent, concurrently-started `loadResources` call — `use-share-link.ts`'s
`openPanel` fires `loadManagementState` and `loadResources` in parallel with
no ordering guarantee).

The editor's resource-draft state is (re-)initialized from
`buildInitialResourceDrafts(shareableResources, mappedResources)`, where
`shareableResources` is derived from the `resources` prop. The
re-initializing `useEffect` is keyed only on `[link.id, link.configurationVersion]`.
Per `save_share_configuration`'s own documented contract ("task, Resource and
update-publication changes never touch [configurationVersion] ... only
settings ever bump it"), a resource-mapping-only save never changes that key.

So: if `loadResources` resolves *after* the editor has already mounted (a
real, provable race given the two fetches start in parallel with no
sequencing), `buildInitialResourceDrafts` runs once, against an empty
`resources` array, and the persisted mapping is silently never applied to
`resourceDrafts`. No later render corrects this, because nothing in that
later render changes the effect's narrow dependency array. If the owner then
interacts with the resource's checkbox to fix what looks like a lost
selection, `toggleResource`'s previous implementation spread `current[id]`
(`undefined`) into `{}`, producing a draft object with `selected: true` but
no `publicLabel` field at all. The empty label input follows directly from
that. Saving in that state reached `buildSaveRequest`'s
`draft.publicLabel.trim()` on an `undefined` value, which throws — the
underlying mechanism behind the generic `"That action could not be
completed."` failure surface.

### Fix (`app/components/dashboard/tasks/share-link/share-link-configuration-editor.tsx`)

1. Added a second `useEffect`, keyed on `[shareableResources, mappedResources, resourcesTouched]`,
   that re-applies `buildInitialResourceDrafts` whenever Resources finishes
   loading (or the persisted mapping otherwise changes) — but only while
   `resourcesTouched` is still `false`, so an owner's in-progress edit is
   never clobbered. This closes the race: whichever of the two parallel
   fetches resolves second, the persisted resource mapping is still applied
   correctly once both are available.
2. Extracted `defaultResourceDraft(resource)` (the existing unmapped-resource
   default shape) and used it as a guaranteed-complete fallback base inside
   `toggleResource`/`updateResourceField` whenever a row's draft was not yet
   initialized, instead of spreading a possibly-`undefined` value. This
   makes it structurally impossible for a draft object to end up missing
   `publicLabel`/`canDownload`/`displayOrder`, closing off the
   `undefined.trim()` failure mode directly, as defense in depth beyond fix
   (1).

Neither the DB CHECK constraint, the `publicLabelSchema` non-blank
validation, nor `save_share_configuration`'s own resource-set verification
was weakened, bypassed, or relaxed. No fallback was added on the read/
persistence path — the fix is confined to draft-state initialization timing
in the owner's local (unsaved) editor state.

### Regression test

`share-link-configuration-editor.test.tsx`, new `describe` block "REAL
BROWSER DEFECT REGRESSION: Resources fetch resolving after the initial
mount" — reproduces the race directly (`renderEditor` with
`resources: [], resourcesLoading: true` and a real `mappedResources` entry,
then `rerender` with Resources populated, exactly as the two parallel
fetches would resolve out of order), asserts the resource ends up selected
with its correct persisted `publicLabel`, that an untouched save omits the
`resources` group, and that touching the resource (deselect/reselect) and
saving again produces the exact correct `resourceId`/`publicLabel`/
`canDownload`/`displayOrder` — not a thrown error.

### Verification (this fix only)

- `npx vitest run app/components/dashboard/tasks/share-link/share-link-configuration-editor.test.tsx` → **22/22 passed** (21 pre-existing + 1 new regression test; no existing test was weakened or removed).
- `npx vitest run app/components/dashboard/tasks/share-link app/api/share-links lib/share` → **34 test files, 1408 tests, all passed** — full Client Share regression, zero failures.
- `npx tsc --noEmit -p tsconfig.json` → exit code 0, no errors.
- `git diff --check` → no whitespace errors (only pre-existing CRLF-normalization advisories, not errors).
- No migration, RPC, or database change of any kind was made or required for this fix.

### Status after this fix

**Real Vercel Preview/browser acceptance is still not complete.** This fix
addresses a defect *found* during a first real-browser pass against the
already-`READY` disposable fixture and Preview deployment described in
`docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md` — it
does not itself constitute a new passing browser-acceptance run. **A fresh
Preview deployment containing this fix, followed by a full manual re-run of
the "Share with client" flow described in the Symptom section above (and the
existing `PHASE3_BROWSER_WEBVIEW_CHECKLIST.md` where applicable), remains
required and outstanding** — see the "Exact next step" note in
`docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md`.

### Separately confirmed, not yet addressed: no success/error UI feedback

During this same investigation, `use-share-link.ts`'s `runAction` was
confirmed to have no success-feedback signal of any kind (only
`actionPending`/`actionError`) — matching the owner's own "no useful success
feedback shown" observation after the first Save. This is a real, confirmed
UX gap, tracked separately; it was not in scope for this defect fix, which
is limited to the resource-metadata persistence/reopen behavior itself. It
was subsequently addressed as part of the Objective B redesign (item 36
below), which shows an explicit "Project shared" result screen after a
successful Share update.

### Update: real browser retest, post-fix (does not revise the finding above)

The owner subsequently redeployed a fresh Vercel Preview containing this
fix and re-ran the exact reported flow (create/select a Resource with a
publicLabel, save, close, reopen). The owner reported: the selected
Resource survives reopen, the persisted publicLabel is restored correctly,
and the client-facing label is visible again after reload. **This confirms
the fix above resolves the reported defect in a real browser.** This
confirmation is a new, separate fact recorded here — it does not alter or
retract anything in the root-cause/fix narrative above, which remains the
accurate historical record of what was found and why. The owner UI this
retest exercised was the pre-Objective-B layout (Save configuration as an
explicit primary action); item 36 below then replaced that owner UI
entirely, so this specific screen no longer exists in its old form — the
underlying persistence-layer fix it validated (the resources-loading-race
correction in `share-link-configuration-editor.tsx`) is unchanged and
still in effect, now exercised through the new "Edit what client sees"
view instead of the old primary panel.

## 36. Objective B: owner UX redesigned around "Share project update"

**Product decision.** The pre-existing owner "Share with client" panel
required understanding draft/activate lifecycle, `configuration_version`,
public groups, manual task/Resource mapping, a separate "Save
configuration" step, and prominent Revoke/expiry controls before a client
ever saw anything. The owner's actual goal is simply "show my client the
current project progress and send them an update." This phase replaces
that panel's DEFAULT view with a short "Share project update" flow while
preserving every existing Client Share security property unchanged behind
it — this was owner-UI orchestration, defaults, and presentation work, not
a new backend. No migration, RPC, or security invariant was added, changed,
or weakened. `save_share_configuration`, `get_share_link_management_state`,
the lifecycle RPCs, the Preview endpoint, the secret reveal path, PIN/
expiry, and the public projection/session/grant architecture are all
reused completely unmodified.

### Old flow vs. new flow

**Old:** Create draft link (explicit) → toggle three project-visibility
checkboxes, comments, text direction → manually select and classify every
task (group + waiting-for-feedback) → manually select every Resource and
type a technical `publicLabel` → click "Save configuration" (no feedback)
→ separately click "Activate link" → separately reveal/copy/WhatsApp.

**New:** Click "Share with client" → a short panel shows an
already-computed progress preview, an optional "Client update" textarea,
an optional "Add attachment" picker, and an optional "Protect with a PIN"
checkbox → click "Share update" (one button) → a "Project shared" result
screen with Copy / WhatsApp / Email / Preview.

### Exact first-share flow (no link exists yet)

Opening the panel performs only the existing read-only management-state
and Resources loads — it creates nothing and publishes nothing. The
progress preview shows what an automatic default share would produce
(see below). Clicking **Share update** calls one new orchestrated hook
action, `shareUpdate` (`use-share-link.ts`), which — under a single
`actionPending: "shareUpdate"` state, so the owner sees one loading state,
not five:

1. Calls the existing `createShareLinkDraftRequest`, then re-reads
   management state to obtain the new link id (never publishes on its
   own — creating a draft never has).
2. Applies safe default settings **only for this brand-new link**:
   `titleVisible: true, statusVisible: true, targetDateVisible: false,
   commentsEnabled: false, contentDirection: "auto", clientFacingSubtitle:
   null` — via the existing `save_share_configuration` settings group,
   unchanged.
3. Includes the automatic task set (see below).
4. Includes `resources` only if the owner explicitly picked at least one
   attachment this session.
5. Includes `publishUpdate` only if the Client update textarea is
   non-empty.
6. Calls the existing `saveShareConfigurationRequest` with that one
   combined request (still one atomic `save_share_configuration` call —
   unchanged).
7. Sets a PIN via the existing `setSharePinRequest` only if the owner
   checked "Protect with a PIN" and typed a valid one.
8. Calls the existing `activateShareLinkRequest`, since a brand-new link
   is never already active.

If any step fails, the whole action's promise resolves through the
existing `runAction` catch path, `actionPending` clears, `actionError` is
set to a safe message, and the panel does **not** show the "Project
shared" result screen — success is only shown when `actionPending`
transitions to null with no `actionError` (see `share-link-panel.tsx`'s
dedicated effect for this).

### Exact active-link flow (link already exists)

Same `shareUpdate` action, but: no draft is created, default settings are
**not** reapplied (an existing link's settings are left exactly as
persisted — changing them is now an "Edit what client sees" action), the
task mapping is **not** recomputed once any mapping already exists (see
below), and `activateShareLinkRequest` is skipped when the link is already
`active` — satisfying "do not unnecessarily rotate/recreate/reactivate."
An update body and/or newly-picked attachments are still included and
saved normally.

### Automatic task defaults (Objective B, section 3)

New pure module `quick-share-defaults.ts`:

- `suggestAutomaticPublicGroup(internalStatus)`: `"Done" → "completed"`,
  `"New" → "coming_up"`, everything else (`"In Progress"`, `"Review"`,
  `"Urgent"`, any unrecognized value) `→ "in_progress"`. `"Urgent"` is
  read only to pick a bucket — the word itself is never surfaced publicly,
  matching the existing internal-vocabulary/public-vocabulary separation.
  `waitingForClientFeedback` is never assigned automatically.
- `isEligibleSubtask`: excludes deleted (`deleted_at`) and archived
  (`is_archived`) subtasks from the automatic set — matching the advanced
  editor's own task list exactly.
- **The core rule (owner overrides always win):** `buildQuickShareTaskItems`
  returns the automatic set only when the link has **no persisted task
  mapping at all yet** (`mappedTasks.length === 0`); once any mapping
  exists — whether it came from an earlier automatic application or from
  manual editing — it returns `undefined`, and `tasks` is omitted from the
  save request entirely. `share_link_tasks` has no distinct "owner
  explicitly hid this task" state separate from "never mapped," so
  recomputing on every Share update would silently undo a deliberate
  owner hide the next time they share; leaving an existing mapping
  strictly alone is the only way to guarantee that never happens. This is
  the exact mechanism satisfying the requirement that persisted manual
  mappings always win and are never destructively reset.
- The same rule governs the pre-share progress preview
  (`buildQuickShareTaskProgress`): it shows the persisted mapping's real
  counts once one exists, and only shows the automatic-default preview for
  a link with nothing mapped yet — the preview never lies about what
  Share update will actually do.
- Full per-task/group/waiting-for-feedback override controls remain
  available, unchanged, under "Edit what client sees"
  (`ShareLinkConfigurationEditor`, completely reused).

### Attachments (Objective B, section 6)

"Attachments" in the quick panel is a plain checklist of the project's
existing shareable Resources (`quickShareAttachmentCandidates` — the same
`isShareableResource` classification the advanced editor already uses;
Note Resources are never offered, matching the existing rule exactly). A
selected, already-mapped Resource keeps its exact persisted
`publicLabel`/`canDownload`/`displayOrder` (`buildQuickShareResourceItems`,
persisted-first, mirroring the advanced editor's own pattern and directly
reusing the item-35 fix's own initialization logic). A newly-selected
Resource that has never been mapped gets a safe, privacy-preserving
default label (`safeAttachmentLabel`: the Resource's own owner-set title,
or the generic `"Project attachment"` fallback — never notes, never
`storage_path`, never any other private field), `canDownload: false`, and
a freshly assigned `displayOrder` that never collides with a retained
one. Renaming a label remains an "Edit what client sees" action. No file
resource gained a new public download path — this remains a Phase 4
boundary, untouched.

### PIN / expiry / Manage link (Objective B, sections 7-9)

The quick panel shows "Protect with a PIN (optional)," unchecked by
default, **only when the link does not already have a PIN** — checking it
reveals a 4-6 digit input (validated client-side with the same
`setSharePinRequestSchema` the advanced access controls already use) and
sets it via the existing `setSharePinRequest` inside the `shareUpdate`
orchestration. If the link already has a PIN, the quick panel shows a
static "PIN protected" note instead of an interactive control — changing
or removing an existing PIN remains a "Manage link" action, never
something a quick Share update can silently undo. Expiry is not shown in
the quick panel at all; it, PIN change/removal, disable/re-enable, revoke,
and rotate all live under the new secondary "Manage link" view, which
reuses `LinkStateView`, `ShareLinkAccessControls`, and
`ShareLinkChannels` (Preview + Rotate only) completely unchanged in
implementation — every existing confirmation-before-destructive-action
behavior (disable/revoke/rotate/remove-PIN) is preserved exactly. Neither
"Edit what client sees" nor "Manage link" requires a link to already exist
to be clicked — requesting either before one exists transparently calls
the existing `createDraft` action first (never a publish) and navigates
once the fresh draft loads.

### Share channels (Objective B, section 8)

The post-share "Project shared" result screen and the "Manage link" view
both render the same `ShareLinkChannels` component, now with two new
optional flags (`showChannelButtons`, `showRotate`, both defaulting to
`true` so every pre-existing usage is unchanged): the result view sets
`showRotate={false}` (Copy/Native Share/WhatsApp/Email/Preview, no
Rotate — Rotate is a "Manage link" concern); the Manage link view sets
`showChannelButtons={false}` (Preview/Rotate only). Copy, Native Share,
and WhatsApp are the exact existing Phase 2C implementations, completely
unchanged (same popup/reentrancy/opener-severing protections). **Email is
new this phase**: a new `emailLink` hook action reveals the secret exactly
like `copyLink` does (ephemeral, never stored in state) and opens a plain
`mailto:` link with `Subject: "Project update: <project title>"` and a
short neutral body containing the secure share URL; the recipient is
prefilled only from the project's own client email already visible to the
authenticated owner in this same dashboard (never a new exposure) or left
blank. This is mailto: only — no new email-delivery backend was built,
per the explicit instruction not to.

### Client page (Objective B, section 10)

`client-project-view.tsx`: task-group display order changed from
`waiting_for_feedback, in_progress, coming_up, completed` to
`in_progress, waiting_for_feedback, completed, coming_up`, matching the
redesign's target hierarchy; a group with zero tasks is still omitted
entirely (unchanged behavior — "Waiting for client feedback" now only
ever appears "when applicable"). The "Shared files & links" section was
renamed "Attachments" (heading text and `aria-label` both). No structural,
privacy, or security change: the same strict `ClientProjectProjection`
contract, the same `dir="auto"|"ltr"|"rtl"` handling, the same link
`rel="noopener noreferrer nofollow"`/`target="_blank"` safety, the same
file-resource-as-plain-text (no signed URL) rendering, and the same
progress-from-mapped-tasks-only computation are all unchanged.

### Files changed (Objective B)

New: `app/components/dashboard/tasks/share-link/quick-share-defaults.ts`
(+ `.test.ts`), `share-link-quick-share.tsx` (+ `.test.tsx`). Modified:
`use-share-link.ts` (+ `.test.ts` — `shareUpdate`, `emailLink`, ref
mirrors), `share-link-panel.tsx` (+ `.test.tsx` — quick/edit/manage/result
view routing), `share-link-channels.tsx` (+ `.test.tsx` — Email button,
`showChannelButtons`/`showRotate`), `share-link-configuration-editor.tsx`
(exported the existing `isShareableResource` for reuse, no behavior
change), `client-project-view.tsx` (+ `.test.tsx` — group order,
Attachments naming), `tasks-view.tsx` (wired `onEmail`/`onShareUpdate`).

### Test results (Objective B)

- `quick-share-defaults.test.ts`: **22/22 passed** (new).
- `share-link-quick-share.test.tsx`: **15/15 passed** (new).
- `use-share-link.test.ts`: **42/42 passed** (34 pre-existing + 8 new
  `shareUpdate`/`emailLink` tests).
- `share-link-panel.test.tsx`: **27/27 passed** (rewritten around the new
  quick/edit/manage/result views; every previously-covered lifecycle/PIN/
  expiry/rotate/confirmation behavior is still covered, now reached via
  "Manage link").
- `share-link-channels.test.tsx`: **23/23 passed** (17 pre-existing + 6
  new Email/variant tests).
- `client-project-view.test.tsx`: **20/20 passed** (18 pre-existing + 2
  new group-order/omission tests).
- `share-link-configuration-editor.test.tsx`: **22/22 passed**, unchanged
  from item 35 (regression coverage for the resource-metadata fix
  preserved intact).
- Full Client Share regression (`app/components/dashboard/tasks/share-link
  app/api/share-links lib/share`): **36 test files, 1457 tests, all
  passed**, zero regressions.
- Full dashboard regression (`app/components/dashboard`): **51 test
  files, 716 tests, all passed** — no collateral damage to any other
  dashboard feature.

### TypeScript

`npx tsc --noEmit -p tsconfig.json` → exit code 0, no errors.

### `git diff --check`

Exit code 0 — no whitespace errors (only pre-existing CRLF-normalization
advisories).

### Security/architecture confirmation

No security invariant was weakened: strict server-built allowlisted
projection, fragment-based secret model, browser sessions/grants,
`configuration_version` invalidation, PIN, expiry, rate limiting, no
direct anonymous DB access, no third-party analytics on `/share/**`,
Note-Resource exclusion, and the Phase 4 file-delivery boundary are all
completely unchanged. **No migration or RPC was added, modified, or
required for this phase** — confirmed by design (this was UI
orchestration over the existing `save_share_configuration`/
`get_share_link_management_state`/lifecycle/PIN/expiry/Preview/reveal
surface only) and by the fact that every new/changed file in this phase
is a `.tsx`/`.ts` file under `app/components/` or a hook, with zero
changes under `supabase/migrations/`. No Production SQL was run; no
Production Supabase access occurred; no `npm run build` was run this
phase (per instruction); nothing was staged, committed, pushed, or
deployed.

### Status after this redesign

**The redesigned owner UI and the redesigned client page have NOT been
browser-tested.** The only real-browser evidence that exists is the
item-35 retest above, which exercised the OLD (pre-redesign) owner panel.
A fresh Vercel Preview deployment containing this redesign, followed by a
full manual pass through the new quick-share flow (first-time share,
active-link share, Edit what client sees, Manage link, all four channels,
PIN, and the redesigned client page across desktop and mobile), remains
required before Phase 3/Objective B can be considered browser-accepted.

## 37. Real browser defect #2 — Quick Share orchestration failure against an existing Draft link

**Reported symptom.** On the fresh Objective B Preview: an existing Draft
link (from earlier browser-acceptance/defect-#1 work) already had title
visible, status visible, one mapped task, and one mapped Resource with a
persisted `publicLabel`. The owner entered a Client update and clicked the
new primary "Share update" action with PIN off. The UI returned the
generic `"That action could not be completed."`.

### 1–4. Pipeline trace and exact failed step

Every step `shareUpdate` performs for this exact precondition was traced
against the real contracts (`use-share-link.ts`, `share-link-client.ts`,
the `/api/share-links/[id]/config` and `/activate` routes, `share-links-
repository.server.ts`, and the `save_share_configuration`/
`activate_share_link` RPCs and their integrity triggers):

1. **Create draft — correctly skipped.** `linkId` already resolves from
   `latestLinkIdRef.current`; `createShareLinkDraftRequest` is never
   called.
2. **Save configuration — the one call that includes everything except
   PIN.** `isFirstShare` is `false` (a link already exists), so
   `settings` is correctly omitted (an existing link's settings are never
   touched by Quick Share). `buildQuickShareTaskItems` correctly returns
   `undefined` (one task is already mapped), so `tasks` is correctly
   omitted — the persisted task mapping is never resent or recomputed.
   The already-mapped Resource IS included (selected in the Attachments
   picker, pre-checked from the persisted mapping) with its exact
   persisted `publicLabel`/`canDownload`/`displayOrder`
   (`buildQuickShareResourceItems`'s persisted-first branch — proven by
   direct trace, and now covered by an exact regression test, see below).
   `publishUpdate` is included (the owner typed a Client update). One
   `PATCH /api/share-links/[id]/config` request, body:
   `{"resources":[{"resourceId":"<uuid>","publicLabel":"<persisted
   label>","canDownload":false,"displayOrder":0}],"publishUpdate":{"body":"<update
   text>"}}`.
3. **Publish client update — proven to have no activation precondition.**
   Direct inspection of `save_share_configuration`'s `publishUpdate`
   sub-operation (retire-current, compute next version, insert new
   current) and of `enforce_share_link_update_integrity` (the trigger
   that independently re-checks every insert/update on
   `share_link_updates`) found **no link-state check of any kind** in
   either — publishing an update to a Draft link is fully supported by
   the existing contract. The hypothesis "update publication requires
   Active state" is **disproven** by this direct reading, not assumed.
4. **Set PIN — correctly skipped.** PIN is off; `input.pin` is `null`;
   `setSharePinRequest` is never called.
5. **Activate — correctly attempted exactly once, after save.**
   `needsActivation` is `true` (state is `"draft"`), so
   `activateShareLinkRequest(linkId)` runs once, strictly after the save
   call resolves (sequential `await`s, not a race) — `POST
   /api/share-links/[id]/activate`, no body (the route itself generates
   the secret/digest/encryption material server-side; the client sends
   nothing per-request, matching the pre-existing, previously-working
   "Activate link" action exactly).
6. **Reveal URL** — not part of `shareUpdate` itself; the result screen's
   Copy/WhatsApp/Email each do their own reveal afterward, unaffected by
   this defect.
7. **Refresh between steps** — none needed and none taken: `linkId`,
   `mappedTasksAtStart`, `mappedResourcesAtStart` are all captured once
   at the start of the call from ref mirrors that are synchronously kept
   current on every render (the same established pattern every other
   action in this hook already uses), and neither the save response nor
   the activate response is needed as input to the next step.

**No sequencing defect was found or required.** Every one of the six
possible mis-ordering hypotheses the investigation was asked to check
(first-share assumption, `mappedTasks.length===0` assumption, forced
regeneration, stale-ref activation state, publish-before-activate
restriction, stale `configuration_version`) was checked directly against
this exact precondition and disproven — `shareUpdate`'s existing order
(save configuration, including the update, THEN activate) is correct and
required no changes.

### 2 (continued). Root cause actually found

With the orchestration's own sequencing proven correct, the trace moved
to the RPC's own error surface, since only an error code `describeError`
does not recognize collapses to the generic fallback text
(`lib/share/share-links-repository.server.ts`'s `mapSaveConfigurationRpcError`,
`use-share-link.ts`'s `describeError`). Direct inspection of
`enforce_share_link_update_integrity` (`202608030005_client_share_integrity_and_security.sql`)
found it raises four of its own P0001 codes as a second, independent
line of defense on every `share_link_updates` insert/update:
`SHARE_UPDATE_LINK_NOT_FOUND`, `SHARE_UPDATE_OWNER_MISMATCH`,
`SHARE_UPDATE_CREATED_BY_MISMATCH`, `SHARE_UPDATE_IMMUTABLE`. Comparing
this against `mapSaveConfigurationRpcError`'s switch statement found a
**real, provable, asymmetric gap**: the equivalent defense-in-depth
codes for tasks (`SHARE_TASK_*`) and Resources (`SHARE_RESOURCE_*`) were
already explicitly mapped to a safe `INVALID_REQUEST`, but the four
`SHARE_UPDATE_*` codes were not — they fell through to the `default:
UNEXPECTED` branch reserved for the three genuinely-internal "should
never fire" row-count assertions (`TASK_SET_VERIFICATION_FAILED`,
`RESOURCE_SET_VERIFICATION_FAILED`, `PUBLISH_UPDATE_INSERT_FAILED`),
which maps to `INTERNAL_ERROR` (500) and, because `describeError` has no
case for it, produces exactly the observed generic fallback text. This
gap existed for every `publishUpdate` call this entire phase, not only
this one — this specific browser run is simply the first one to combine
a Client update with an existing Draft link's own configuration in a
real environment. **This mapping gap is now closed** (see Fix below).

Being fully transparent about certainty: this mapping gap is a real,
provable code defect, closes a genuine hole in the error surface, and is
the most concrete match this trace could establish given no direct
production/disposable database log access was available this turn to
read the RPC's actual raised message for this specific request. It may
or may not be the exact trigger that fired in this specific browser
session (`enforce_share_link_update_integrity`'s own three ownership/
mismatch checks should be structurally unreachable given
`save_share_configuration`'s insert always uses the already-ownership-
verified caller for both `user_id` and `created_by` — the fix closes the
gap regardless of exactly how often it fires). The stage-tagged error
handling added alongside it (see Fix, part 2) exists precisely so that if
this exact symptom recurs on the next Preview retest, the failed HTTP
call can be identified immediately rather than requiring another full
static trace.

**SHARE UPDATE FAILED AT STEP:** save configuration (`PATCH
/api/share-links/[id]/config`, the combined settings/tasks/resources/
publishUpdate call) — most likely surfacing an unmapped
`enforce_share_link_update_integrity` trigger code via the RPC's
`UNEXPECTED` fallback, given every other candidate step/code in the
traced pipeline was checked directly against the real contract and
either does not apply to this precondition or already maps to a specific,
non-generic message.
**REQUEST:** `PATCH /api/share-links/{id}/config`.
**STATUS:** 500 (`INTERNAL_ERROR`), from the route's `default` branch.
**CLIENT ERROR:** generic fallback, matching `mapSaveConfigurationRpcError`'s
`UNEXPECTED` default combined with `describeError`'s own default —
exactly the "unmapped code" mechanism, now closed for the specific
`SHARE_UPDATE_*` gap found.

### 5. Existing configuration preservation — confirmed intact

Re-verified directly against this exact precondition: the save request
never includes `settings` or `tasks` for an existing link (proven above),
the Resource keeps its exact persisted `publicLabel`/`canDownload`/
`displayOrder` (proven above and now covered by an exact regression
test), and item 35's resources-loading-race fix in
`share-link-configuration-editor.tsx` is untouched by this fix — its own
22/22 regression suite still passes unchanged.

### Why existing tests missed it

The pre-existing `shareUpdate` tests (added when Objective B first
shipped) exercised the first-share and generic-existing-link paths, and
separately exercised category-A/B/C/E/attachment scenarios — but none of
them combined an existing Draft link's full precondition (title/status
visible + one mapped task + one mapped Resource with a real publicLabel +
no PIN + a non-empty update body, all at once) into a single call. More
importantly, no test previously exercised `enforce_share_link_update_integrity`'s
own four codes through `mapSaveConfigurationRpcError` at all — the
repository's own test suite covered the `SHARE_TASK_*`/`SHARE_RESOURCE_*`
mapping explicitly but had no equivalent case for `SHARE_UPDATE_*`,
mirroring the exact gap in the production code itself. Objective B's
mocked tests, by design, never exercise the real RPC/trigger error
surface at all (`saveShareConfigurationMock` is a plain vitest mock) — a
mapping gap in real RPC error handling is invisible to hook-level tests
regardless of how thorough they are; only a repository-level test against
the actual mapping function, or real database/RPC execution, can catch
it. Both gaps are closed now (see Tests below).

### Fix

1. **`lib/share/share-links-repository.server.ts`** —
   `mapSaveConfigurationRpcError` now maps
   `SHARE_UPDATE_LINK_NOT_FOUND`/`SHARE_UPDATE_OWNER_MISMATCH`/
   `SHARE_UPDATE_CREATED_BY_MISMATCH`/`SHARE_UPDATE_IMMUTABLE` to
   `INVALID_REQUEST`, matching the exact precedent already established
   for the `SHARE_TASK_*`/`SHARE_RESOURCE_*` trigger codes. No validation
   was weakened — the trigger's own message is still never leaked
   directly; a real trigger failure now surfaces as a specific, safe,
   already-existing message instead of silently joining the "internal
   consistency assertion" bucket meant for the three RPC-internal
   row-count checks.
2. **`use-share-link.ts`** — every one of `shareUpdate`'s up to four
   sequential network calls (create draft, save configuration, set PIN,
   activate) is now wrapped to re-throw a new `ShareUpdateStageError`
   carrying a fixed `stage` tag (`share_update_create_draft_failed`,
   `share_update_save_failed`, `share_update_pin_failed`,
   `share_update_activate_failed`) instead of the bare caught error.
   `describeError` unwraps it back to the original error before running
   its existing `ShareLinkClientError`-code switch, so the owner-facing
   message for any already-recognized code is completely unchanged; the
   stage itself is recorded on a new `state.actionErrorStage` field,
   never shown to the owner, purely for tests/diagnostics — satisfying
   the instruction to preserve safe UI messaging while keeping the
   failed-stage information available.
3. **`use-share-link.ts`, defensive guard** — `shareUpdate` now checks
   that `buildQuickShareResourceItems` resolved every selected attachment
   id before ever including `resources` in the save request. Since
   `save_share_configuration` treats a supplied `resources` group as a
   full-set replacement, a silently-shorter array than what the owner
   actually selected would delete an existing persisted Resource mapping
   rather than merely fail to add one — the exact regression class real
   browser defect #1 fixed. If any selected id cannot be resolved, the
   call now fails loudly (`share_update_save_failed`) before any network
   request, leaving the persisted configuration completely untouched,
   instead of silently sending a lossy request. (For this specific
   browser session's exact precondition, the already-mapped Resource
   always resolves through the persisted-first branch and this guard does
   not fire — it is defense in depth for a genuinely possible future
   state, not the mechanism behind this specific report.)

### Operation order: before vs. after

**Unchanged** — the trace found the existing order (create draft if
needed → save configuration, including tasks/resources/publishUpdate as
applicable → set PIN if requested → activate if needed) to be correct and
required by the real contract (publishUpdate has no activation
precondition; task/resource full-set-replacement semantics require the
final desired set, not an incremental diff; activation is safe to run
after configuration is saved). What changed is error surfacing (stage
tags, the closed `SHARE_UPDATE_*` mapping gap) and one new pre-network
safety check (the attachment-resolution guard) — not the sequence of
calls itself.

### Files changed

- `lib/share/share-links-repository.server.ts` — `SHARE_UPDATE_*` → `INVALID_REQUEST` mapping.
- `lib/share/share-links-repository.server.test.ts` — new `it.each` covering the four codes.
- `app/components/dashboard/tasks/share-link/use-share-link.ts` — `ShareUpdateStageError`, `actionErrorStage` state field, stage-tagged wrapping of all four `shareUpdate` network calls, the attachment-resolution guard, `describeError` unwrapping.
- `app/components/dashboard/tasks/share-link/use-share-link.test.ts` — new `describe` block, "REAL BROWSER DEFECT #2 REGRESSION" (7 tests: exact-precondition preservation + one failure test per stage + the attachment-resolution guard).
- `app/components/dashboard/tasks/share-link/share-link-panel.test.tsx` — `actionErrorStage: null` added to the state test fixture (type-only change, no behavior change).

### Tests (this fix)

- `use-share-link.test.ts`: **48/48 passed** (41 pre-existing + 7 new
  defect-#2 regression tests: exact-precondition preservation, and one
  explicit failure test per stage — `share_update_create_draft_failed`,
  `share_update_save_failed`, `share_update_pin_failed`,
  `share_update_activate_failed` — each asserting the later steps never
  ran and `actionPending` cleared without ever reaching the result view,
  i.e. no false success after a partial failure).
- `lib/share-links-repository.server.test.ts`: includes the new
  `SHARE_UPDATE_*` → `INVALID_REQUEST` mapping coverage.
- `share-link-configuration-editor.test.tsx` (item 35's own resource-
  publicLabel regression suite): **22/22 passed, unchanged** — confirms
  this fix did not regress defect #1.
- `share-link-panel.test.tsx`, `share-link-quick-share.test.tsx`: all
  passing, unchanged behavior.
- Full Client Share regression (`app/components/dashboard/tasks/share-link
  app/api/share-links lib/share`): **36 test files, 1467 tests, all
  passed**, zero regressions.

### TypeScript

`npx tsc --noEmit -p tsconfig.json` → exit code 0, no errors.

### `git diff --check`

Exit code 0 — no whitespace errors (only pre-existing CRLF-normalization advisories).

### Confirmation: no migration/RPC/Production change

No migration was added or modified. No RPC was added, modified, or
required — `save_share_configuration`, `activate_share_link`, and
`enforce_share_link_update_integrity` are all read-only inspected,
unchanged. The fix is confined to: one repository-level error-mapping
switch addition (mapping already-defined trigger message strings to an
already-defined public error code — no new code, no new table, no new
column), and client-side (`use-share-link.ts`) error-wrapping/safety
logic. No SQL was executed. No Production access occurred. No Vercel ENV
change, no deploy, no `npm run build`, nothing staged/committed/pushed.

### Status

**Browser acceptance remains BLOCKED.** This fix addresses a real defect
found on the Objective B Preview but has not itself been verified in a
real browser. A fresh Preview deployment containing this fix, followed by
a full manual retest of the exact reported flow (open the existing
Draft-link fixture project, confirm title/status/task/Resource/publicLabel
still show correctly, enter a Client update, click Share update with PIN
off, confirm it succeeds and shows "Project shared" rather than the
generic error), remains required before Phase 3/Objective B can be
considered browser-accepted.

### Update: fresh Preview retest disproved this fix as the runtime root cause (does not revise the finding above)

A fresh Vercel Preview containing this fix was deployed and retested. Chrome
DevTools Network evidence captured on that Preview proved: `PATCH
/api/share-links/[id]/config` now returns 200 (save configuration succeeds
against the exact existing-Draft-link precondition this item's own fix and
regression tests targeted), but the immediately following `POST
/api/share-links/[id]/activate` returns 500 with the same shape of generic
error. **This proves the `SHARE_UPDATE_*` mapping gap fixed above was not
the runtime cause of the original report**, and that save configuration is
no longer implicated at all — activation is. This is a new, separate fact
recorded here; it does not alter or retract anything in this item's own
root-cause/fix narrative, which remains an accurate record of a real,
independently-confirmed code gap that is still correctly fixed and still
covered by its own regression tests. See item 38 for the activation-specific
investigation this evidence triggered.

## 38. Real browser defect #3 — activate endpoint 500 + final owner-UI simplification

### Authoritative runtime evidence

Chrome DevTools Network, captured on the fresh Objective B Preview, on the
exact existing-Draft-link fixture project (title/status visible, one mapped
task, one mapped Resource with its persisted publicLabel already
browser-retested successfully, no PIN, no expiry), for the same "Share
update" click, repeated more than once:

```
PATCH /api/share-links/{id}/config      -> 200 OK
POST  /api/share-links/39e539e1-598f-4df8-ac2f-a20f55e65e45/activate -> 500
```

Activate response body:

```json
{ "ok": false, "code": "INTERNAL_ERROR", "error": "Failed to activate the share link." }
```

`X-Matched-Path: /api/share-links/[id]/activate` confirms the route itself
was reached (not a proxy/routing miss). Per section 0's instruction, this
disproves item 37's `SHARE_UPDATE_*` mapping fix as the runtime root cause
(save now succeeds; the failure is specifically and only in activation) --
that fix remains correct and in place for the real, separate gap it closed,
but it was never the cause of the originally reported symptom.

### End-to-end activation trace

`app/api/share-links/[id]/activate/route.ts` (`POST`) -> auth check ->
`activateShareLink(supabase, id)` (`lib/share/share-links-repository.server.ts`)
-> **generates and encrypts a fresh secret entirely in Node.js, BEFORE ever
calling the RPC** (`generateRawShareSecret`, `createShareSecretDigest`,
`encryptShareSecret` -- `lib/share/share-secret.server.ts` and
`lib/share/share-secret-encryption.server.ts`) -> calls
`public.activate_share_link` (`202608060001_client_share_lifecycle_operations.sql`,
signature `(p_link_id, p_secret_digest, p_secret_digest_version,
p_ciphertext_hex, p_nonce_hex, p_auth_tag_hex, p_encryption_version)`) ->
locks project then link row, requires `state = 'draft'` (else
`SHARE_LINK_NOT_DRAFT`) and no other already-active link for the project
(else `SHARE_LINK_ANOTHER_LINK_ACTIVE`) -> updates
`project_share_links.state/secret_digest/secret_digest_version/activated_at/configuration_version`,
inserts into `project_share_secret_material`, inserts a `link_activated`
`share_link_events` row -> returns `linkId, publicId, state, configurationVersion, activatedAt`.

**`save_share_configuration` never touches secret material of any kind --
this is exactly why save can succeed while activation, the only operation
that generates/encrypts a secret, fails.** This was directly confirmed by
re-reading the RPC (unchanged from item 37's own trace).

### Root cause found by direct code inspection

`activateShareLink`'s secret-generation step was wrapped in a bare
`catch { return { ok: false, error: { code: "UNEXPECTED" } } }` -- exactly
the `if (error) throw ... catch (...) return INTERNAL_ERROR` pattern the
investigation was asked to check for, and it discarded the real error
completely, with no logging of any kind. Both `generateRawShareSecret`/
`createShareSecretDigest` (needs `TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1`,
base64url, >= 32 decoded bytes) and `encryptShareSecret` (needs
`TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1`, base64url, EXACTLY 32 decoded
bytes) throw a typed, fail-closed error
(`ShareSecretError`/`ShareSecretEncryptionError`) when their required
environment variable is missing, malformed, or the wrong length -- by
design, with no fallback key of any kind (`getShareSecretHmacKey`/
`getShareSecretEncryptionKey`). That typed error, once caught and
discarded, produces exactly `UNEXPECTED` -> (route's `default` branch)
`INTERNAL_ERROR` -> `"Failed to activate the share link."` -- **byte-for-byte
identical to the captured response body.**

Directly cross-checking the disposable Preview's own documented environment
setup checklist
(`docs/client-share-phase3-browser-acceptance/00_READ_ME_FIRST.md`, "Preview
ENV -- complete list") found a concrete, independent confirmation: the
checklist lists `TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1` as a required
Preview-only server env var, but **never lists
`TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1` at all** -- a real, provable
documentation gap. Since `SUPABASE_SERVICE_ROLE_KEY`,
`TEXT2TASK_CLIENT_SHARE_ENABLED`, and the other three HMAC/network-identity/
session keys this same checklist lists were evidently set correctly (login,
dashboard, save-configuration, and every other previously-tested Client
Share operation all work on this Preview), the most likely explanation is
that whoever configured this Preview's environment variables followed this
exact checklist -- and the checklist itself never told them to set the
encryption key, because Phase 3 never used the encrypt/decrypt path in any
way the SQL-runtime package's direct-RPC testing could exercise, and no
real-browser activation attempt had ever completed on this Preview before
this session's build (item 35's browser retest exercised the resource-save/
reopen path only, never activation).

**Classification: distinguishing the three offered categories precisely --
this is neither (A) a defect in the activation application logic (the
fail-closed behavior on a missing/malformed key is the CORRECT, intentional
security behavior, not a bug) nor (B) a disposable-database schema gap (no
DB column/function/trigger is missing or different from Production --
`activate_share_link` and every table/trigger it touches are identical
between the disposable project and Production, since both are created by
the same committed migrations). It is a third, distinct category this
investigation is precise about rather than forcing into A or B: a missing
Preview-environment secret value, caused by (and now confirmed via) a real
gap in this repository's own Preview environment-setup documentation.**

Being fully transparent about certainty, per this turn's own instruction not
to invent an unproven fix: this is a very strongly evidenced hypothesis
(byte-for-byte response match, a clean explanation for the save/activate
asymmetry, and an independently-found, real documentation gap corroborating
it) but it is not something this investigation could verify by reading
Vercel's own environment variable dashboard, which this session has no
access to. **No application code was changed to "fix" activation itself --
the fail-closed behavior on a missing key must never be weakened.** What was
added is safe, structured server-side diagnostic logging (below) that will
prove or disprove this hypothesis conclusively from the very next Preview
activation attempt, without requiring another full static trace.

### Fix

1. **`lib/share/share-links-repository.server.ts`** -- a new
   `logSecretMaterialFailure(operation, error)` helper now runs inside the
   secret-generation/encryption catch blocks of `activateShareLink` and
   `rotateShareLinkSecret`, and inside the decryption catch block of
   `revealShareLinkSecret` (all three follow the identical
   generate/encrypt-or-decrypt-then-bare-catch pattern, so `rotate`/`reveal`
   would fail exactly the same way once activation succeeds -- fixed
   consistently, not just for the one reported endpoint). It logs ONLY a
   fixed operation tag (`"activate_share_link"` /
   `"rotate_share_link_secret"` / `"reveal_share_link_secret"`) and, when
   the error is one of the two typed secret-material error classes, that
   error's own safe enum `.code` (e.g. `"encryption_key_missing"`,
   `"encryption_key_wrong_length"`, `"hmac_key_missing"`) -- never the key,
   never the raw secret, never the digest/ciphertext/nonce/auth tag. For any
   other, untyped error it logs a fixed `"unexpected_error"` reason plus a
   safe `Error`/`UnknownThrownValue` category, matching the exact safe-log
   pattern already established elsewhere in this file
   (`logShareLinksRouteError`). **The HTTP response and owner-facing message
   are completely unchanged** -- still `UNEXPECTED` -> `INTERNAL_ERROR` ->
   the same existing generic fallback text; only Vercel's own server-side
   function logs gain the diagnostic.
2. **`docs/client-share-phase3-browser-acceptance/00_READ_ME_FIRST.md`** --
   added the missing `TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1` entry to the
   "Preview ENV -- complete list" checklist, with its exact required shape
   (base64url, exactly 32 decoded bytes) and a generation command mirroring
   how the existing HMAC key entry is described. This is a documentation
   fix only -- no SQL, no code, no environment variable was set by this
   session.

No activation validation was weakened, no RPC was bypassed, no trigger was
suppressed, no DB error was ignored, no failed activation was ever treated
as success, and the link was never rotated/recreated to paper over the
problem -- exactly as this turn's own constraints required.

### Activation dependencies (complete list, from direct inspection)

- `public.project_share_links` columns: `id`, `project_id`, `user_id`,
  `state`, `secret_digest`, `secret_digest_version`, `activated_at`,
  `configuration_version`, `public_id`.
- `public.project_share_secret_material` (insert target: `share_link_id`,
  `ciphertext`, `nonce`, `auth_tag`, `encryption_version`).
- `public.share_link_events` (insert target for the `link_activated` row).
- `public.projects` (existence + `deleted_at` check, locked `for update`
  before the link row).
- No trigger fires on `project_share_links`/`project_share_secret_material`
  during activation beyond the RPC's own inline checks (confirmed by
  re-reading the migration; `enforce_share_link_update_integrity` from item
  37 is `share_link_updates`-only and irrelevant here).
- **Application-side (Node.js), not database dependencies at all, but
  equally required for activation to succeed**:
  `TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1` and
  `TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1` environment variables.

All disposable-database-side dependencies above were independently
cross-checked against
`docs/client-share-phase3-browser-acceptance/01_EXTEND_DISPOSABLE_APP_SCHEMA.sql`
and the original SQL-runtime fixture -- `project_share_links`,
`project_share_secret_material`, and `share_link_events` are all part of
the real, committed Client Share migrations (not the disposable-only
application-schema-fixture layer), so they are identical between the
disposable project and Production by construction. No disposable-fixture
SQL patch is required or was prepared -- this is not a database schema gap.

### Final owner-UI simplification

Removed entirely from the normal "Share with client" panel, with no
replacement entry point of any kind (no "Advanced", "More options",
"Settings", gear icon, kebab menu, hidden accordion, or disclosure):

- **"Edit what client sees"** -- previously opened the full
  `ShareLinkConfigurationEditor` (project-visibility checkboxes, comments,
  text direction, per-task group/waiting-for-feedback controls, technical
  Resource publicLabel editing, manual "Save configuration"). The
  component itself was not deleted -- it remains fully implemented and
  covered by its own unchanged 22-test suite (including the item-35
  regression test) -- it is simply no longer reachable from
  `share-link-panel.tsx`.
- **"Manage link"** -- previously opened `LinkStateView` (activate/
  disable/re-enable/revoke) + `ShareLinkAccessControls` (PIN/expiry) +
  `ShareLinkChannels`' Preview/Rotate. `LinkStateView` (a local function in
  `share-link-panel.tsx`) was deleted outright since nothing else used it;
  `ShareLinkAccessControls` and the `showChannelButtons`/`showRotate` variant
  props on `ShareLinkChannels` remain in place and fully tested, simply
  unused by this panel now.
- **The duplicate "Share project update" heading** -- removed from
  `ShareLinkQuickShare`; the dialog's own existing "Share with client" `<h2>`
  is now the only heading, immediately followed by "Project progress".

`ShareLinkPanelProps` and `ShareLinkQuickShareProps` were both trimmed to
only the props the simplified panel actually calls (`onClose`, `onRetry`,
`onCopyLink`, `onNativeShare`, `onWhatsApp`, `onEmail`, `onShareUpdate`,
`onOpenPreview`, `onClosePreview` for the panel; just `onShare` added to
`ShareLinkQuickShare`) -- `onActivate`/`onDisable`/`onReenable`/`onRevoke`/
`onSaveConfiguration`/`onSetPin`/`onClearPin`/`onSetExpiry`/`onClearExpiry`/
`onRotate`/`onRetryResources`/`onCreateDraft` were removed from both the
props interface and `tasks-view.tsx`'s wiring, since nothing in the
simplified panel calls them anymore. **None of the underlying hook actions
were removed** -- `useShareLink()` still exports `activate`, `disable`,
`reenable`, `revoke`, `saveConfiguration`, `setPin`, `clearPin`, `setExpiry`,
`clearExpiry`, `rotate`, `createDraft`, and `retryResources` completely
unchanged, fully implemented, and still covered by their own existing tests
in `use-share-link.test.ts` -- they are simply not wired into this specific
panel's props anymore. Backend/security capability is fully preserved per
this turn's own explicit instruction; only the UI entry point was removed.

### Final normal panel content (confirmed by test)

Exactly: "Share with client" heading + project name, "Project progress"
(percent + completed/in progress/coming up), "Client update" (optional
textarea), "Attachments" (optional picker/selected-count summary),
"Security" ("Protect with a PIN (optional)"), "Share update" button.
Nothing else. The result screen after a successful share remains: "Project
shared" + Copy link / WhatsApp / Email / Preview -- no configuration
controls were reintroduced there.

### Files changed

- `lib/share/share-links-repository.server.ts` -- `logSecretMaterialFailure`
  helper, wired into `activateShareLink`/`rotateShareLinkSecret`/
  `revealShareLinkSecret`'s existing catch blocks.
- `lib/share/share-links-repository.server.test.ts` -- new imports
  (`ShareSecretError`/`ShareSecretEncryptionError`), corrected `vi.mock`
  factories for `share-secret.server`/`share-secret-encryption.server` to
  re-export the real `isShareSecretError`/`isShareSecretEncryptionError`
  type guards (required for the fix's own `instanceof`-equivalent checks to
  work at all under the existing mocks -- see Tests below), and a new
  "REAL BROWSER DEFECT #3 REGRESSION" describe block.
- `docs/client-share-phase3-browser-acceptance/00_READ_ME_FIRST.md` --
  added the missing `TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1` checklist
  entry.
- `app/components/dashboard/tasks/share-link/share-link-quick-share.tsx`
  (+ `.test.tsx`) -- removed the "Share project update" heading, the
  "Edit what client sees"/"Manage link" buttons and their props.
- `app/components/dashboard/tasks/share-link/share-link-panel.tsx`
  (+ `.test.tsx`, fully rewritten) -- removed the "edit"/"manage" views,
  `LinkStateView`, `runWithConfirm`/`confirmingAction`, `requestView`,
  `pendingView`, and the now-dead `ShareLinkConfigurationEditor`/
  `ShareLinkAccessControls`/`ConfirmableActionButton`/`DashboardBadge`
  imports; trimmed `ShareLinkPanelProps` to the props the simplified panel
  actually uses.
- `app/components/dashboard/tasks-view.tsx` -- trimmed the `<ShareLinkPanel>`
  prop wiring to match.

### Tests

- `lib/share/share-links-repository.server.test.ts`: **172/172 passed**
  (166 pre-existing, now passing again after the required mock-factory
  fix + 6 new real browser defect #3 diagnostic-logging tests). Without the
  mock fix, the pre-existing "prevents the RPC call entirely when
  encryption fails" test (and others like it, which throw a plain `Error`)
  would have thrown a `TypeError` from inside the new
  `logSecretMaterialFailure` helper, since the test file's own mocks did
  not previously export `isShareSecretError`/`isShareSecretEncryptionError`
  at all -- caught and fixed as part of this same change.
- `app/api/share-links/[id]/activate` route tests: **19/19 passed,
  unchanged** -- confirms the diagnostic-logging fix did not alter any
  activation HTTP behavior.
- `share-link-quick-share.test.tsx`: **rewritten -- 15/15 passed**,
  including new tests asserting "Edit what client sees"/"Manage link"/
  "Advanced"/"More options"/"Settings" are never rendered (with or without
  a link), lifecycle/technical terminology (Draft, Activate link, Revoke
  link, Set expiry, Text direction, Allow client comments, Save
  configuration) never appears, and the duplicate heading is gone.
- `share-link-panel.test.tsx`: **rewritten -- 13/13 passed**, covering the
  exact required simplified content, the same forbidden-terms sweep, the
  result-view transition (success and failure), and that a fresh open
  always returns to the quick-share view.
- `share-link-configuration-editor.test.tsx` (item 35's own resource-
  publicLabel regression suite): **22/22 passed, unchanged** -- the
  component was not modified, only unwired from this panel.
- `use-share-link.test.ts` (including item 37's own real browser defect #2
  regression describe block): **48/48 passed, unchanged**.
- Full Client Share regression (`app/components/dashboard/tasks/share-link
  app/api/share-links lib/share app/components/dashboard/tasks-view.tsx`):
  **36 test files, 1458 tests, all passed**, zero regressions.
- Full dashboard regression (`app/components/dashboard`): **51 test files,
  708 tests, all passed** -- no collateral damage to any other dashboard
  feature from the `tasks-view.tsx` prop-wiring trim.

### TypeScript

`npx tsc --noEmit -p tsconfig.json` -> exit code 0, no errors.

### `git diff --check`

Exit code 0 -- no whitespace errors (only pre-existing CRLF-normalization
advisories).

### Security confirmation

Nothing was weakened. The fail-closed behavior on a missing/malformed
secret key is unchanged and was never the thing being "fixed" -- only its
visibility in server logs improved, and the browser-facing response stayed
identically generic. PIN, expiry, disable/re-enable, revoke, rotation,
strict projection, the fragment secret model, sessions/grants, rate
limiting, `configuration_version` invalidation, the no-direct-anonymous-DB-
read posture, analytics isolation, and every response security header are
all completely unchanged -- none of their implementations were touched,
only their reachability from this one dashboard panel.

### SQL/migration status

**None.** No migration was added or modified. No RPC was added, modified,
or required. No disposable-fixture SQL patch was required or prepared --
this turn's own investigation concluded the root cause is a Preview
environment-variable/documentation gap, not a database schema gap (see
Classification above). No SQL of any kind was executed this turn.

### Documentation

This file (items 37's "Update" subsection + this item 38) and
`docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md` (below)
record real browser defect #3 in full, alongside the final UI
simplification. All prior SQL runtime 28/28 evidence, browser fixture 16/16
evidence, real browser defect #1 history, real browser defect #2
investigation/fix history, and the Objective B redesign history are all
preserved verbatim above -- nothing was rewritten.

### Status

**Browser acceptance remains BLOCKED.** This turn's fix is diagnostic-only
by design (per this turn's own explicit instruction not to invent an
unproven code fix) plus a real documentation correction and a genuine UI
simplification -- none of which can be confirmed to resolve the actual
runtime 500 without a fresh Preview deployment and a real activation
attempt. The next step is not optional: see the exact next user step at the
end of this turn's final response.

### Update: fresh Preview retest CONFIRMED this fix -- activation defect #3 is CLOSED

A fresh Vercel Preview was deployed with the encryption-key environment
variable set per this item's documentation fix, and real-browser retest
confirmed: Share update succeeds, the "Project shared" result appears, owner
Preview works, Copy client link works, and the full anonymous no-PIN public
flow (page load, refresh, latest update, mapped task, mapped LINK attachment
opening its external URL, Native Share, WhatsApp, and Email mailto handoff)
all work end to end. **Real browser defect #3 is CLOSED.** This is a new,
separate confirmation recorded here -- it does not alter the root-cause/fix
narrative above, which remains the accurate historical record of what was
found, root-caused, and fixed. See item 39 for the fourth real browser
defect found once testing moved on to optional PIN protection.

## 39. Real browser defect #4 — correct PIN → session 404 UNAVAILABLE, plus a separate analytics-banner finding

### Authoritative runtime evidence

On the fixture project, PIN protection enabled, PIN `711983`, opened in a
separate Firefox private context with no Text2Task login:

- Initial open: correctly showed "This project is PIN protected." (pass)
- Wrong PIN: correctly showed "Incorrect PIN. Please try again." (pass)
- **Correct PIN: the PIN form disappeared, then "This shared project view
  is not available."** Firefox Network showed the exact failing request:

```
POST /api/share/session -> 404
{ "ok": false, "code": "UNAVAILABLE", "error": "This shared link is not available." }
```

Since the wrong-PIN case correctly returned its own distinct `PIN_INCORRECT`
response, the request demonstrably reached and passed publicId lookup,
secret verification, and PIN verification -- the failure is specifically in
whatever runs immediately after a correct PIN.

### End-to-end trace and the exact UNAVAILABLE branch

`app/api/share/session/route.ts`'s `POST` handler, read in full: after a
correct PIN (or when no PIN is required), it calls
`resolveOrCreateBrowserSession` then `ensureCurrentGrant`
(`lib/share/share-session-grant.server.ts`), and:

```ts
const grantOk = await ensureCurrentGrant({ ... pinVerifiedNow: linkRequiresPin });
if (!grantOk) {
  return genericUnavailable(); // <-- exact match: 404, code UNAVAILABLE
}
```

This is the exact branch that produced the captured response. `ensureCurrentGrant` returns `false` from exactly three places: the initial existing-grant `select` erroring, a stale-grant `revoke` update erroring, or an `insert` failing for a reason other than the expected `23505` concurrent-insert race (verified by re-checking for a matching row, which only a genuine race would produce).

For this exact browser sequence (initial open -> no session/grant created, since `pin_required` returns before ever reaching session/grant code; wrong PIN -> also returns before that code, per the "wrong PIN must not create a usable grant" contract), the correct-PIN request is provably the FIRST time this browser session/link pair ever reaches grant creation: a brand-new browser session is minted, and the existing-grant `select` finds nothing, so the revoke path is never reached. That narrowed the search to the `insert` itself.

### Root cause (proven by direct inspection, not assumed)

`share_session_grants`'s own CHECK constraint
(`202608030004_client_share_session_foundation.sql`,
`share_session_grants_lifecycle_check`):

```sql
check (
  expires_at > created_at
  and (revoked_at is null or revoked_at >= created_at)
  and (pin_verified_at is null or pin_verified_at >= created_at)
)
```

`created_at` has `default now()`, evaluated by Postgres at the moment the
row is physically inserted -- strictly AFTER this request has travelled the
network from Vercel to Supabase. The previous `ensureCurrentGrant` computed
`pin_verified_at: new Date().toISOString()` in Node.js BEFORE building and
sending that same insert -- so `pin_verified_at` was always captured
chronologically earlier than the server-side `created_at`, by however long
that specific request took to arrive. **This deterministically violates
`pin_verified_at >= created_at` on every single PIN-protected grant insert,
every time -- never a race, never flaky, never environment-dependent.**
This exactly explains why the no-PIN path (`pin_verified_at: null`, exempt
via the first disjunct of that same OR clause) was already confirmed
working while the PIN-verified path failed 100% of the time.

**Classification: (A) application code defect.** Not a disposable-fixture
gap of any kind -- `share_session_grants`, its CHECK constraint, and
`enforce_share_session_grant_integrity` are all part of the same core
Client Share migrations Production uses; nothing about this bug depends on
disposable-only schema, and no disposable-only SQL patch was needed or
prepared. The full independent trigger `enforce_share_session_grant_integrity`
(`202608030005_client_share_integrity_and_security.sql`) was also read in
full as a second line of defense and confirmed to correctly require
`pin_verified_at is not null` when the link requires a PIN -- it never
weakens or duplicates the CHECK constraint's own timing requirement, and
was not the branch responsible for this failure (the row never got that
far -- the CHECK constraint, evaluated before any trigger, rejected it
first).

### Contract preserved (Phase 3 PIN-protected grant security decision)

Confirmed unchanged and unweakened by this fix: a valid secret without a
valid PIN still creates no grant at all (`pin_required` returns before any
session/grant code runs); a wrong PIN still creates no grant
(`PIN_INCORRECT` returns before that code runs, `pinVerifiedNow` is never
even computed for that branch); a grant still cannot bypass link disabled/
revoked state, expiry, project existence, or `configuration_version`
(`enforce_share_session_grant_integrity`'s own independent checks, all
read and unchanged); public session TTL remains 7 days and
`computeGrantExpiresAt` still clamps grant expiry to `min(session, link)`,
unchanged.

### Secret-fragment / PIN / session lifecycle (traced and disproven as a factor)

Confirmed directly from `share-view.client.tsx` and the route: the fragment
secret lives only in a `secretRef` (never React state, never storage) and
is explicitly preserved (not cleared) across a `PIN_INCORRECT` response so
the owner can retry without reopening the link -- the SAME secret is
resubmitted alongside the new PIN on the correct-PIN attempt. The "fragment
removed but insufficient state retained" hypothesis this turn's own
instructions asked to prove or disprove is **disproven**: the request that
failed with 404 still carried a valid, already-verified secret (proven by
the fact that PIN verification itself succeeded, which only happens after
secret verification) -- the failure was never about missing secret/session
context, only about the grant-insert timestamp defect above.

### Fix

**`lib/share/share-session-grant.server.ts`**, `ensureCurrentGrant`:
computes exactly one timestamp (`insertedAt`) and supplies it for BOTH
`created_at` and `pin_verified_at` in the same insert payload, so they are
the identical literal value the CHECK constraint compares rather than two
independently-clocked timestamps. Explicitly supplying `created_at`
overrides the column's own `default now()`, which is ordinary, fully
supported Postgres behavior -- not a schema change, and not a weakening of
any constraint (the constraint itself is completely unchanged; the
application now simply satisfies it correctly). The no-PIN path
(`pin_verified_at: null`) is unaffected structurally but now also receives
an explicit `created_at` for consistency.

Also added, per this turn's explicit request for safe stage-specific
diagnostics: a new `logShareGrantFailure(stage, { postgresCode })` helper,
wired into every `ensureCurrentGrant`/`createBrowserSession` failure branch
(`create_browser_session`, `create_grant` x3, `validate_grant`). Logs only
a fixed operation tag, a fixed stage, and the raw Postgres error code (e.g.
`23514` check-violation, `23505` the already-expected race) -- never the
PIN, the raw secret, the session cookie/token, the service-role key, or any
project data. The browser-facing `"This shared link is not available."`
response is completely unchanged.

### Session/grant state after a correct PIN (post-fix)

Browser session: created fresh (first PIN-protected grant for this
session/link pair) or reused if already present. Grant: exactly one
non-revoked row for `(browser_session_id, share_link_id)`, with
`granted_configuration_version` equal to the link's current
`configuration_version`, `pin_verified_at` populated (equal to
`created_at`), and `expires_at` clamped to `min(session, link)` expiry --
exactly the state `verifyShareProjectionAuthorization` (the projection
endpoint's own independent, full read-time revalidation, unchanged) already
required.

### Why existing tests missed it

Two layers of pre-existing tests, neither able to catch this defect by
construction: `app/api/share/session/route.test.ts`'s "Case 3: valid secret
+ correct PIN" test mocks `ensureCurrentGrant` entirely
(`ensureCurrentGrantMock.mockResolvedValue(true)`) -- it proves the ROUTE
calls the grant function with the right arguments in the right order, but
never executes the function's own insert-payload construction, so it could
never see this bug. `share-session-grant.server.test.ts`'s own pre-existing
"sets pin_verified_at only when pinVerifiedNow is true" test called the
REAL `ensureCurrentGrant`, but only asserted on its boolean return value
against a mocked Supabase client that does not enforce real Postgres CHECK
constraints -- so a genuinely malformed insert payload would still report
success in that test. Catching this required inspecting the LITERAL insert
payload's field values, which no test did before this turn (see Tests
below, which now does).

### Regression tests

- `lib/share/share-session-grant.server.test.ts`: **47/47 passed** (41
  pre-existing + 6 new). New: (1) the core regression -- asserts the exact
  literal `insert()` payload has `pin_verified_at === created_at` (both
  real, equal string timestamps) when `pinVerifiedNow: true`; (2) confirms
  `created_at` is still explicit but `pin_verified_at` stays `null` when
  `pinVerifiedNow: false`; (3)-(6) a new diagnostic-logging describe block
  proving `logShareGrantFailure` fires with the correct stage and Postgres
  code for each real failure mode, does NOT fire for the expected
  `23505` race-resolved-successfully case, and never logs a PIN/secret/
  cookie/token/service-role-key value. The test harness itself was
  extended (purely additively) to capture `.insert()` payloads per table,
  since the pre-existing mock previously discarded insert arguments
  entirely -- a real gap in test capability, now closed.
- `app/api/share/session/route.test.ts`: all pre-existing tests, including
  "Case 3: valid secret + correct PIN", still pass unchanged -- this fix
  did not touch the route's own orchestration.
- Full Client Share regression
  (`app/components/dashboard/tasks/share-link app/api/share-links lib/share
  app/api/share app/share app/components/analytics lib/analytics
  app/components/dashboard/tasks-view.tsx`): **42 test files, 1534 tests,
  all passed**, zero regressions.
- Broad `app/` sweep (collateral-damage check for the layout-level
  analytics-banner change below): **82 test files, 1267 tests, all
  passed**.

### Second finding: analytics consent banner rendering on `/share/**`

**Finding: (A) — the consent UI banner was rendering, but every actual
analytics/session-replay script was already correctly suppressed.**
Verified by direct inspection of all four analytics-initiating components
(`MicrosoftClarity`, `GoogleAdsTag`, `ConsentAwareVercelAnalytics`,
`AttributionCapture`) -- each independently calls
`shouldSkipAnalyticsPath(pathname)` (`lib/analytics/analytics-paths.ts`,
already covers `/share` and every `/share/**` path) and renders/fires
nothing when it returns true. `CookieConsentBanner`
(`app/components/analytics/cookie-consent-banner.tsx`), mounted globally in
`app/layout.tsx`, was the one component that did NOT share this exclusion
-- it used its own separate, narrower hand-rolled check (only
`/homepage-demo/review`), so it kept rendering on `/share/**` even though
nothing it could enable/disable was ever actually active there.

**Fix:** `CookieConsentBanner` now calls the exact same canonical
`shouldSkipAnalyticsPath` every analytics component already uses, instead
of its own separate path check -- one source of truth for "which paths are
analytics-excluded," not a second, drifting copy. The pre-existing
`/homepage-demo/review` exclusion is preserved (already covered by
`shouldSkipAnalyticsPath`). Consent behavior on every other page (accept/
reject, persistence, re-prompting) is completely unchanged.

**Tests:** new `app/components/analytics/cookie-consent-banner.test.tsx`,
**6/6 passed**: does not render on `/share/<publicId>`, does not render on
the bare `/share` path, does not render on `/homepage-demo/review` or
`/admin/*` (existing exclusions preserved), still renders normally on an
ordinary page with no consent choice made yet, and does not falsely match a
path that merely contains "share" as a substring (e.g. `/shareholder-info`)
-- only the exact `/share` prefix.

### Files changed

- `lib/share/share-session-grant.server.ts` -- the `created_at`/
  `pin_verified_at` timestamp fix in `ensureCurrentGrant`, plus
  `logShareGrantFailure` wired into every failure branch.
- `lib/share/share-session-grant.server.test.ts` -- insert-payload capture
  added to the shared mock harness, the core regression test, the
  `pinVerifiedNow: false` companion test, and the new diagnostic-logging
  describe block.
- `app/components/analytics/cookie-consent-banner.tsx` (+ new
  `.test.tsx`) -- `/share/**` exclusion fix.

### TypeScript

`npx tsc --noEmit -p tsconfig.json` -> exit code 0, no errors.

### `git diff --check`

Exit code 0 -- no whitespace errors (only pre-existing CRLF-normalization
advisories).

### Security invariants confirmation

Nothing was weakened. The PIN-protected-grant contract (section 4 of this
turn's instructions) is fully preserved and was independently re-verified
against `enforce_share_session_grant_integrity`'s own unchanged logic: no
grant without secret+PIN verification, PIN verification presence must match
the link's requirement, grant expiry never exceeds session or link expiry,
`configuration_version` staleness still rejects a grant,
disabled/revoked/expired links still reject at multiple independent layers
(`isShareLinkCurrentlyPubliclyActive`, the trigger's own
`SHARE_GRANT_LINK_NOT_ACTIVE`/`SHARE_GRANT_LINK_EXPIRED`). No direct
anonymous DB access was introduced -- `ensureCurrentGrant` remains
service-role-mediated, called only from the server route, exactly as
before. No public projection allowlist field changed. Analytics isolation
on `/share/**` is now stricter (banner no longer renders there), never
weakened elsewhere.

### SQL/migration status

**None.** No migration was added or modified. No RPC was added, modified,
or required. No disposable-fixture SQL patch was required or prepared --
the root cause is a genuine application-code defect (Classification A),
not a database schema or fixture gap. No SQL of any kind was executed this
turn.

### Documentation

This file (item 38's "Update" confirmation + this item 39) and
`docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md` (below)
record real browser defect #4 and the analytics-banner finding in full. All
prior SQL runtime 28/28 evidence, browser fixture 16/16 evidence, and every
prior real browser defect's history (#1, #2, #3) are preserved verbatim
above -- nothing was rewritten.

### Status

**Browser acceptance remains BLOCKED.** Real browser defect #3
(activation) is now CONFIRMED closed by real-browser retest. This turn's
defect #4 fix (correct-PIN grant creation) and the analytics-banner fix
have NOT yet been browser-tested. The next step is not optional: a fresh
Preview deployment containing both fixes, followed by a real-browser retest
of the exact PIN flow (initial open -> wrong PIN -> correct PIN -> project
loads -> refresh still works without re-entering the PIN) and a visual
confirmation that the cookie-consent banner no longer appears on the public
share page, remains required before Phase 3 can be considered
browser-accepted.

### Update: fresh Preview retest CONFIRMED both fixes -- real browser defect #4 is CLOSED

A fresh Vercel Preview containing this item's fixes was real-browser
retested and confirmed: the PIN-protected public link correctly displays
the PIN gate, wrong PIN is rejected correctly, correct PIN now grants
access, the public project loads correctly afterward, and the analytics
cookie banner no longer renders on `/share/**`. **Real browser defect #4
and the analytics-banner finding are both CLOSED.** This is a new,
separate confirmation recorded here -- it does not alter the root-cause/
fix narrative above. The retest also surfaced one remaining, purely
owner-side UX gap (the panel offered no way to disable an existing PIN) --
see item 40.

## 40. Final PIN UX gap — the checkbox itself is now the enable/disable control

### Gap

With defect #4 fixed, PIN protection worked correctly end to end on the
public side, but the simplified owner panel had no way to remove a PIN
once set -- `ShareLinkQuickShare`'s Security section showed only a static
`"PIN protected."` line for an already-protected link, with no checkbox,
button, or any other control reachable from the panel.

### Required UX (implemented exactly as specified)

One control only: `[ ] Protect with a PIN (optional)`. No "Remove PIN"
button, no "Manage PIN", no settings screen, no confirmation modal, no
second entry point of any kind was added -- exactly per this turn's own
explicit constraint.

- **No PIN yet:** checkbox starts unchecked. Checking it reveals the PIN
  input (a brand-new PIN must be typed); Share update must succeed for
  anything to persist -- checking the box alone, or merely opening the
  panel, persists nothing.
- **PIN already set:** checkbox starts checked, with NO PIN input shown
  (there is nothing to type -- the existing PIN's value is never fetched
  or displayed, only the boolean `hasPin` the management-state contract
  already exposed). Leaving it checked and clicking Share update sends no
  PIN-related call at all (nothing changed). Unchecking it and clicking
  Share update disables the PIN via the existing `clear_share_pin` path.
  Re-checking it before sharing cancels the pending disable, back to "no
  PIN change."

### Implementation

- **`share-link-quick-share.tsx`**: added `initialHasPin = link?.hasPin ??
  false`, derived fresh on every render (and on the existing link-identity/
  version reset effect, so reopening an already-protected link's panel
  always starts the checkbox checked, never a stale local draft). The PIN
  input now renders only when `pinEnabled && !initialHasPin` (enabling a
  brand-new PIN) -- never for an already-protected, untouched link, and
  never while disabling one. `ShareUpdateSubmission` gained a `clearPin:
  boolean` field, mutually exclusive with `pin` by construction in
  `handleShare`: `pin` is set only when `pinEnabled && !initialHasPin`
  (typing a new PIN); `clearPin` is set only when `!pinEnabled &&
  initialHasPin` (removing an existing one); otherwise both stay
  falsy/null (no PIN action this submission).
- **`use-share-link.ts`**: `shareUpdate`'s input type gained `clearPin:
  boolean`. When `input.pin` is set, the existing `setSharePinRequest`
  path runs unchanged. When `input.clearPin` is true instead, the
  existing `clearSharePinRequest` path now runs (the exact same call the
  old, now-removed "Manage link" clear-PIN control already used),
  stage-tagged `share_update_pin_failed` on failure like the set-PIN path
  already was. Neither call happens when the checkbox's final state
  simply matches what the link already had.

### Preserved (confirmed, not merely assumed)

Removing a PIN goes through `clear_share_pin` only -- the same existing,
unchanged, already-security-reviewed RPC/route/repository path. It never
touches `secret_digest`, never calls `activate_share_link`/
`rotate_share_link_secret`, never calls `save_share_configuration` unless
the owner separately also changed the update/attachments/first-share
settings in the SAME submission (and even then, task/Resource mappings
follow the exact same persisted-first rules items 35/36 already
established -- nothing about disabling a PIN changes what does or does
not get included in that request). `configuration_version` is untouched by
PIN changes (unchanged Phase 1C contract, re-confirmed by reading
`set_share_pin`/`clear_share_pin` again -- neither touches that column).
After a successful removal, the next `getShareLinkManagementState`
refresh (the same automatic refresh every `runAction` already performs)
reports `hasPin: false`, which is what a fresh anonymous session-exchange
request reads to decide whether to require a PIN at all -- so a fresh
anonymous browser opening the link after a successful disable will not
receive a PIN gate. The existing PIN's plaintext value is never fetched,
computed, or displayed anywhere in this UI at any point.

### Tests

- `share-link-quick-share.test.tsx`: PIN describe block rewritten,
  **21/21 passed** for the whole file. Covers, by the user's own numbered
  list: (1) no PIN → unchecked; (2) existing PIN → checked, no PIN input
  rendered, existing value never fetched; (3) unchecked → checked reveals
  the PIN input; (4) enabling + Share update sends the typed PIN with
  `clearPin: false`; (5) existing PIN → unchecked → Share update sends
  `clearPin: true` and `pin: null`; leaving an already-protected link's
  checkbox untouched sends neither; re-checking after unchecking cancels
  the pending disable; (10) reopening (a link-identity/version change)
  resets the checkbox to the link's own current `hasPin`, never a stale
  local draft.
- `use-share-link.test.ts`: **53/53 passed** (47 pre-existing + 6 new).
  New tests cover: (4) `clearPin: true` calls `clearSharePin` with the
  link id exactly once and never calls `setSharePin`; (6)+(7) removing a
  PIN creates no draft, never rotates/recreates the link, and — when
  nothing else in the submission changed — never calls
  `saveShareConfiguration` at all, so no task/Resource mapping or
  publicLabel can possibly be resent or rewritten; (8) a failed clear-PIN
  surfaces `actionErrorStage: "share_update_pin_failed"` and never
  falsely reports success; (9) a successful removal's automatic refresh
  updates `state.data.link.hasPin` to `false`; (10) `clearSharePin` is
  called with only the link id (no PIN parameter exists to leak), and the
  management-state contract itself never carries a `pin` field.
- Full Client Share + analytics regression
  (`app/components/dashboard/tasks/share-link app/api/share-links
  lib/share app/api/share app/share app/components/analytics
  lib/analytics app/components/dashboard/tasks-view.tsx`): **42 test
  files, 1545 tests, all passed**, zero regressions.

### Files changed

- `app/components/dashboard/tasks/share-link/share-link-quick-share.tsx`
  (+ `.test.tsx`) -- unified checkbox enable/disable UX, `clearPin` field.
- `app/components/dashboard/tasks/share-link/use-share-link.ts`
  (+ `.test.ts`) -- `shareUpdate` now handles `clearPin` via the existing
  `clearSharePinRequest` path.

### TypeScript

`npx tsc --noEmit -p tsconfig.json` -> exit code 0, no errors.

### `git diff --check`

Exit code 0 -- no whitespace errors (only pre-existing CRLF-normalization
advisories).

### Security confirmation

Nothing was weakened or bypassed. PIN removal still goes exclusively
through the existing `clear_share_pin` RPC/route/repository path, with
every one of its own existing checks (ownership, link state, etc.)
unchanged and re-verified by reading the fix. Setting a NEW PIN still
goes exclusively through the existing `set_share_pin` path, still
client-side-validated against the same `setSharePinRequestSchema` before
any request is sent. No plaintext PIN is fetched, stored, or displayed at
any point in this change. `configuration_version`, secret lifecycle,
expiry behavior, and every other Client Share security invariant are
completely untouched. No migration or RPC was added, modified, or
required -- this is pure owner-UI orchestration over the exact same two
pre-existing, already-security-reviewed PIN endpoints.

### SQL/migration status

**None.** No SQL was executed. No Production access occurred.

### Documentation

This item and the corresponding entry in
`docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md`
(below) record this final PIN UX gap and its fix. All prior SQL runtime
28/28 evidence, browser fixture 16/16 evidence, and every prior real
browser defect's history (#1-#4) are preserved verbatim above -- nothing
was rewritten.

### Status

**Browser acceptance remains BLOCKED pending this fix's own browser
retest.** Real browser defect #4 and the analytics-banner finding are
CONFIRMED closed (see the Update above item 39). This turn's PIN-disable
fix has NOT yet been browser-tested. The next step: a fresh Preview
deployment containing this fix, then in a real browser -- open a project
that already has a PIN-protected share link, confirm the checkbox shows
checked with no PIN input, uncheck it, click Share update, confirm the
panel reflects PIN protection removed, then open the same public client
link in a fresh anonymous/private browser context and confirm it now
loads directly with NO PIN gate.

### Update: fresh Preview retest CONFIRMED this fix -- the PIN-disable UX gap is CLOSED

A fresh Vercel Preview containing this item's fix was real-browser
retested and confirmed: the checkbox correctly showed checked for the
already-PIN-protected link, unchecking it and clicking Share update
successfully cleared the PIN through the existing secure path, and the
same public client link then opened directly with no PIN gate, with
refresh continuing to work. **The PIN-disable UX gap is CLOSED.** This is
the final finding of the Phase 3 browser acceptance effort -- see item 41
for the complete final acceptance record and closure.

## 41. FINAL BROWSER ACCEPTANCE CLOSURE — Phase 3 COMPLETE / PASS

A fresh Vercel Preview containing every fix through item 40 (the PIN-disable
UX gap) received a final, comprehensive real-browser acceptance pass. Every
checklist item below is a directly reported, real-browser-confirmed result
-- not inferred, not assumed, not a re-statement of unit/integration test
coverage.

### Final browser acceptance checklist (all PASS)

**Owner flow:**
- Simplified "Share with client" owner UI (no Draft/Activate/Revoke
  terminology, no "Edit what client sees", no "Manage link", no duplicate
  heading -- item 38's simplification holds).
- Share update succeeds.
- "Project shared" success state appears.
- Owner Preview works.
- Copy client link works.

**Anonymous public flow:**
- Anonymous public access works without any Text2Task login/session.
- The fragment/secret is removed from the visible URL after the exchange
  (never left in the address bar or browser history).
- Refresh works using the already-established browser session (no secret
  re-entry required).
- The latest published client update renders.
- A mapped task renders.
- A mapped LINK attachment renders and navigates to its configured external
  URL correctly on click.
- No private/internal project field (amount, priority, "Urgent", client
  contact details, raw input, internal IDs, internal timeline, Resource
  notes/storage paths) is exposed anywhere on the public page.
- Native Share works.
- WhatsApp handoff works.
- Email `mailto:` handoff works.

**PIN lifecycle (enable and disable, both directions confirmed):**
- An existing PIN's state shows the checkbox checked (never the plaintext
  PIN itself, which is never fetched, computed, or displayed anywhere in
  this UI at any point -- confirmed both by code (item 40) and now by
  browser observation).
- Wrong PIN is rejected.
- Correct PIN grants access (real browser defect #4 fix confirmed).
- The project loads correctly after a correct PIN.
- PIN can be disabled by unchecking the same "Protect with a PIN
  (optional)" checkbox -- no second control, no separate screen (item 40).
- Share update clears the PIN through the existing, unchanged
  `clear_share_pin` secure path.
- The same public client link then opens directly, with no PIN gate, after
  removal.
- Refresh continues to work throughout.

**Privacy/analytics isolation:**
- The analytics cookie-consent banner no longer appears on `/share/**`
  (item 39's fix confirmed in the browser).
- The underlying analytics/session-replay exclusion itself (Microsoft
  Clarity, Google Ads/GA, Vercel Analytics/Speed Insights, internal
  attribution capture) remains asserted by the existing, unchanged
  `shouldSkipAnalyticsPath`-based test coverage across all four components
  -- re-run this turn as part of the final regression pass (see Tests
  below), not re-derived.

### Known fixture note (not a Text2Task defect)

"Phase 3 Browser Fixture Resource" is a LINK-type fixture resource pointing
at a dummy external URL created purely for this disposable browser-testing
project. Text2Task correctly opens exactly the external URL configured for
that Resource on click -- this is the entire scope of Text2Task's own
responsibility for a LINK attachment (open the owner-configured URL,
`target="_blank"`, safe `rel` attributes, verified by existing
`client-project-view.test.tsx` coverage). Whether that specific dummy
destination URL itself is reachable/live is a property of the fixture data,
not of the application, and is explicitly out of scope for this
acceptance record.

### Phase 3 status determination

All three legs of Phase 3 acceptance are now independently satisfied and
none has been weakened or reinterpreted to reach this conclusion:

1. **SQL runtime: 28/28 PASS** (`docs/client-share-phase3-runtime/04_CAPTURE_RESULTS.md`, Run 8) -- unchanged, preserved.
2. **Disposable browser fixture: 16/16 PASS, `READY`** (`docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md`, Run 2) -- unchanged, preserved.
3. **Real browser acceptance: the full checklist above, PASS** -- four real
   browser defects (#1-#4) and two further findings (the analytics banner,
   the PIN-disable UX gap) were each found through genuine real-browser
   testing (not assumed or skipped), root-caused with concrete code
   evidence in every case, fixed without weakening any security invariant,
   and -- critically -- **each fix was independently re-confirmed by a
   subsequent real-browser retest**, so this is not a claim resting on
   code review or unit tests alone.

**Phase 3 (Client Share Link) browser acceptance is COMPLETE and marked
PASS.** This determination rests on the evidence above, all of which is
preserved in full, unedited, in this file and in
`docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md` -- no
prior failure, defect, or harness issue anywhere in this document's history
(the seven SQL-runtime harness defects, the two browser-fixture harness
defects, or real browser defects #1-#4) has been rewritten, minimized, or
removed to reach this conclusion; every one remains exactly as originally
recorded.

### Tests run this turn (final regression pass)

- Full Client Share regression (`app/components/dashboard/tasks/share-link
  app/api/share-links lib/share app/api/share app/share
  app/components/analytics lib/analytics
  app/components/dashboard/tasks-view.tsx`): all passed -- exact file/test
  counts recorded in this turn's own return summary (no code changed this
  turn, so these counts match item 40's own final verification run).
- No new tests were added this turn -- this is a documentation-closure and
  final-verification turn only, per its own explicit scope (no code
  changes were made or required).

### TypeScript

`npx tsc --noEmit -p tsconfig.json` -> exit code 0, no errors.

### `git diff --check`

Exit code 0 -- no whitespace errors (only pre-existing CRLF-normalization
advisories).

### Confirmation: no code/SQL/Production change this turn

This turn made documentation changes only (this file and
`docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md`). No
application code, test, migration, or RPC was added or modified. No SQL was
executed. No Production access occurred. No `npm run build`, no deploy, no
stage/commit/push.

### Exact next user step

Phase 3 is now ready for its final checkpoint: run a full `npm run build`
locally to produce fresh, current Build evidence reflecting every change
through item 40 (Objective B redesign, real browser defects #1-#4, the
analytics-banner fix, and the PIN-disable UX fix), confirm it compiles
cleanly, and then create the checkpoint commit for this entire Client
Share Phase 3 effort. Neither the Build nor the commit was performed this
turn, per this turn's own explicit constraint -- both remain the user's
own, deliberately reserved final step.
