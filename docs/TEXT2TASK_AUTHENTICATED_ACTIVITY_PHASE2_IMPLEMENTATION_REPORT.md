# Text2Task Authenticated Activity — Phase 2 Implementation Report

## 1. Exact verdict

Phase 2 (the server-only product-event logger and its `POST /api/activity/product-event` endpoint, with tests) is complete, verified, and inert in production. The endpoint exists in the build but is called from no existing page, modal, or component. No migration was applied. Nothing was pushed. The full repository test suite (1248/1248, up from Phase 1's 1186 by exactly the 62 new tests this phase adds) and the production build both pass.

## 2. Repository state before implementation

```
git branch --show-current                 -> main
git log --oneline -3                       -> 7232b4e Add authenticated activity data foundation
                                               c08f450 Add Work Calendar SEO page
                                               55307bc Complete Work Calendar feature
git status --short                         -> (clean)
git status -sb                             -> ## main...origin/main [ahead 1]
git diff --check                           -> clean (exit 0)
```
Commit `7232b4e` (Phase 1) was confirmed present as `HEAD`, the working tree was clean, and `main` was one commit ahead of `origin/main` (Phase 1 itself, not yet pushed) before any Phase 2 work began.

## 3. Phase 1 commit verification

Confirmed via `git log --oneline -3` (above) and by reading the five source-of-truth files in full before making any change: the mapping document, the Phase 1 implementation report, `lib/activity/product-event-contracts.ts`, and both Phase 1 migrations. Phase 1's public contract (`PRODUCT_EVENT_NAMES`, `PRODUCT_ENTITY_TYPES`, `PRODUCT_EVENT_ENTITY_TYPE`, `validateProductEventInput`, `ValidatedProductEvent`, `ProductEventValidationResult`) was reused exactly as-is — **no Phase 1 file was modified**, and no schema defect was found in it.

## 4. Files created

- `lib/activity/log-product-event.server.ts`
- `lib/activity/log-product-event.server.test.ts`
- `app/api/activity/product-event/route.ts`
- `app/api/activity/product-event/route.test.ts`
- `docs/TEXT2TASK_AUTHENTICATED_ACTIVITY_PHASE2_IMPLEMENTATION_REPORT.md` (this document)

## 5. Files modified

`package.json`, `package-lock.json`, `vitest.config.ts` — **not originally planned, but a necessary infrastructure fix discovered while implementing this phase's own required tests**. See §14 ("Deviations") for the full root-cause explanation: roughly 30 existing files across this repository already write `import "server-only";`, but the literal `server-only` npm package had never actually been installed (`node_modules/server-only` did not exist), and no prior test in the repository's history had ever caused Node to actually resolve that bare import — every existing test either mocked away the file that contained it, or never touched such a file at all. This phase's own tests are the first in the repository to directly execute the real source of a `"server-only"`-tagged module (`lib/activity/log-product-event.server.ts` itself, plus its import of `lib/supabase/admin.ts`), which surfaced the gap immediately. Fixed by installing the real package (`package.json`/`package-lock.json`, one line) and adding one `resolve.alias` entry in `vitest.config.ts` mapping `"server-only"` to the package's own no-op `empty.js` variant — exactly mirroring what Next.js's own webpack configuration already does for server-side bundles (the package's default `index.js` always throws; Next aliases it to `empty.js` specifically when building server code, and Vitest has no equivalent bundle-target awareness without this alias). This is a correct, minimal, root-cause fix to a pre-existing repository gap, not a workaround — and it incidentally unblocks testing for any of the other ~30 already-existing `"server-only"`-tagged files too, none of which this phase touched.

No existing owner-analytics UI file was modified. No Phase 1 migration was modified.

## 6. Final API request contract

```
POST /api/activity/product-event
Content-Type: application/json

{
  "event": {
    "eventName": "dashboard_viewed",
    "route": "/dashboard",
    "entityType": null,
    "entityId": null
  },
  "navigationId": "22222222-2222-4222-8222-222222222222"
}
```

- The outer envelope is validated with a `zod` `.strict()` schema requiring exactly two keys: `event` (must be a plain object) and `navigationId` (must be a string). Any third top-level key — `userId`, `email`, `createdAt`, `idempotencyKey`, `metadata`, or anything else — fails the whole request with 400.
- `event`'s own deep shape (event name allowlist, route format, entity type/id consistency) is validated by Phase 1's `validateProductEventInput()`, called from inside the server logger, not re-implemented at the route layer — see §8 for why.
- `navigationId`'s UUID format is also validated inside the server logger, for the same reason.
- The request must never contain `userId`: the authenticated user id is always resolved server-side from the real session (§7) and is not, and cannot be, part of this contract.

## 7. Authentication flow

```ts
const supabase = await createClient();          // lib/supabase/server.ts — the same
const { data: { user }, error } =                // helper requireDashboardUser() and
  await supabase.auth.getUser();                 // every authenticated API route (e.g.
if (error || !user?.id) { return 401; }          // app/api/calendar/events/route.ts) uses
```
This reads the real Supabase session from request cookies via the established, already-proven server helper — never a client-supplied id, never `localStorage`, never a trusted-email shortcut, never a profile id. An anonymous or expired/invalid session always resolves to `401` before the server logger is ever called, so **zero writes are possible without a real authenticated session**.

Auth is checked **before** the request body is read or parsed (right after the cheap, header-only content-type check), so no JSON-parsing or validation work is ever spent on behalf of a caller who turns out to be unauthenticated — a deliberate cheapest-rejection-first ordering, not an accident.

The route never accepts, decodes, or echoes any user id from the client, and never queries "does user X exist" for an arbitrary caller-supplied id — it only ever asks "who is the caller of *this* request." There is structurally no way for a caller to probe an arbitrary user id's existence through this endpoint.

## 8. Server logger design

`lib/activity/log-product-event.server.ts`, `"server-only"`-guarded, exports exactly one function: `logProductEventSafe({ userId, navigationId, event })`.

- `userId` is a **trusted** argument — the caller (the route) must have already resolved it from a real session. The logger still defensively re-validates its UUID shape (defense in depth), but never reads a `userId` from anywhere else.
- `navigationId` and `event` are both still treated as **fully untrusted**, independent of whatever the HTTP-layer caller already validated — the logger re-validates both itself, so it stays safe to call from any future trusted caller (e.g. a Phase-3 server action) directly, without relying on this one route having already done the work. This mirrors this repository's own established "enforce the same invariant at every layer" convention (already used for Calendar Project/Client relationship rules).
- Event validation is fully delegated to Phase 1's `validateProductEventInput()` — this module never re-implements or duplicates that logic.
- The insert row contains exactly six columns: `user_id`, `event_name`, `route`, `entity_type`, `entity_id`, `idempotency_key`. Nothing else is ever passed to `.insert()`.
- The insert is raced against a 1250ms timeout, matching `lib/analytics/internal-events.server.ts`'s own established value and pattern exactly (`Promise.race` against a `setTimeout`), so a hung database call can never hang the caller.
- Every expected failure mode (invalid input, a duplicate, a database error, a timeout, an unexpected thrown exception) resolves to a typed result — the function **never throws**.
- Diagnostic logging: `console.warn` for expected/soft failures (duplicate detection isn't even logged — it's success), `console.error` only for a genuinely unexpected caught exception, both including a per-call `crypto.randomUUID()` correlation id, event name, route, and entity type — **never** the request body, `userId`, `navigationId`, or `entityId`.

## 9. Idempotency design

```ts
createHash("sha256")
  .update("text2task.authenticated_product_events.idempotency_key.v1")
  .update("\0").update(userId)
  .update("\0").update(navigationId)
  .update("\0").update(eventName)
  .update("\0").update(route)
  .update("\0").update(entityType ?? "")
  .update("\0").update(entityId ?? "")
  .digest("hex");
```
A domain-separated, null-byte-joined hash chain — mirroring `lib/homepage-demo/tokens.server.ts`'s own `hashHomepageDemoToken()` pattern exactly (an already-proven, already-reviewed approach in this exact codebase for deriving a safe deterministic hash from several string inputs, avoiding any field-boundary ambiguity that naive string concatenation could risk).

This is deterministic per **logical event** (the same six inputs always produce the same key) and computed entirely server-side from the server's own trusted `userId` plus the client-supplied-but-now-validated `navigationId`/event fields — never from a client-supplied timestamp or a time bucket. This directly satisfies the requirement that a retry of the exact same logical event collapses to one row, while a genuinely later, deliberate view (a different `navigationId`) always produces a different key and is never suppressed — something a pure time-bucket approach cannot guarantee (a bucket boundary could split one logical retry into two rows, or merge two genuinely distinct later views into one, depending on timing).

Tested exhaustively in `log-product-event.server.test.ts`: deterministic for identical input; a retried delivery produces the same key; a different `navigationId`/`userId`/event name/route/entity each independently produces a different key.

## 10. Duplicate handling

The insert is attempted once, unconditionally. If Postgres rejects it with error code `23505` (unique violation, against Phase 1's `authenticated_product_events_idempotency_key_unique_idx` partial unique index), the logger returns `{ status: "duplicate" }` — treated identically to a fresh success by the route (both map to `204`). This exact detection mechanism (`error?.code === "23505"`) is copied verbatim from `lib/analytics/internal-events.server.ts`'s own `isDuplicateIdempotencyKeyError()`, which is already proven correct against this exact Supabase/PostgREST error-shape behavior in production for `analytics_events`' own unique partial index — not re-derived or assumed. No query-then-insert race exists anywhere: it is always exactly one atomic insert, with the unique-conflict outcome handled after the fact, per the task's own explicit preference.

## 11. Request-size protection

`MAX_BODY_CHARS = 4096` (4 KB), within the recommended 2–4 KB range. Enforced twice: (1) a cheap `content-length`-header precheck before any body is read at all (`isOversizedByContentLength`), rejecting obviously-oversized requests with `413` before doing any I/O; (2) a backstop check on the actual read text's length, in case `content-length` was absent or understated. Measured in UTF-16 code units via `.length`, matching this repository's own established convention (`app/api/analytics/event/route.ts`'s `MAX_BODY_CHARS`) rather than a precise byte count — for the ASCII-only JSON this endpoint accepts, the two are effectively identical.

## 12. Content-type handling

`Content-Type: application/json` is required; the media-type is compared after splitting off and discarding any `;`-delimited parameter, so `application/json; charset=utf-8` (and any other parameter) is accepted exactly as the task's own requirement specifies, while `text/plain` or any other media type is rejected with `415` before any body work happens.

## 13. Status-code behavior

| Status | Meaning |
|---|---|
| 204 | Event recorded, or safely treated as a duplicate — no response body |
| 400 | Malformed envelope (unknown top-level key, wrong shape) or a validation rejection from the server logger (unknown event, malformed route, external URL, malformed UUID, impossible date, missing/mismatched entity, malformed `navigationId`) |
| 401 | No valid authenticated session |
| 413 | Request body too large |
| 415 | Content-Type is not `application/json` |
| 500 | A genuinely unexpected exception at the route layer itself (e.g. the auth client throwing) |
| 503 | The server logger completed but reported `{ status: "failed" }` — an isolated storage-layer failure, not a caller error |

**500 vs. 503 reasoning:** the task's own instructions explicitly allow either for "isolated analytics storage failure," so a deliberate split was chosen for clarity: `503` (Service Unavailable) is used specifically when the logger itself ran to completion and reported that the *database write* failed (timeout, a genuine non-duplicate Postgres error) — communicating "this specific downstream dependency is temporarily unavailable, the request itself was fine." `500` is reserved for a genuinely unexpected exception at the *route* layer (something the route's own `try/catch` had to catch that wasn't an anticipated logger outcome at all) — communicating a real, unexpected server bug rather than an isolated, known-to-be-flaky dependency. Every error response body is `{ "error": "<short generic string>" }` only — verified by a dedicated test asserting the serialized response never contains the words "supabase," "postgres," "service_role," or "stack," regardless of what the underlying error actually said.

Only `POST` is exported — no `GET`, `PUT`, `PATCH`, or `DELETE` handler exists in the file at all, so Next.js's own routing returns `405` for every other method automatically; verified by asserting the module exports nothing else.

## 14. Supabase insert behavior

A single `supabaseAdmin.from("authenticated_product_events").insert(row)` call — the **only** Supabase call anywhere in the logger's source (verified by a dedicated test that regex-scans the file for every `.from(...)` call and asserts there is exactly one, targeting exactly this table, plus asserts there is no `.rpc(...)` call at all). `supabaseAdmin` (`lib/supabase/admin.ts`) is the same pre-existing, `"server-only"`-guarded, service-role singleton already used by `lib/analytics/internal-events.server.ts` and `app/api/activity/dashboard-visit/route.ts` — no new Supabase client was created.

## 15. Analytics-isolation review

- Reads/writes **only** `public.authenticated_product_events` (Phase 1). Never `public.analytics_events`, never `public.projects`/`public.tasks`/any other product-domain table, never either owner-report RPC, never `record_dashboard_visit()` — all confirmed by dedicated source-scanning tests in both new test files (not just manual review).
- The tracking call is designed to be fire-and-forget from any future caller: it never throws, and its own internal work (validation, hashing, the timeout-raced insert) never touches product data or a product transaction.
- Nothing about anonymous `page_view` tracking, marketing-consent gating, `last_dashboard_seen_at`, Product Activation, or the existing Users & Activity/Overview admin pages was touched in any way.

## 16. Security review

| Requirement | Status |
|---|---|
| No client-supplied user id accepted anywhere | ✅ Not part of the request contract at all (§6); auth always resolved server-side (§7) |
| No service-role secret exposed to the browser | ✅ `supabaseAdmin` only ever used inside the `"server-only"` logger; the route itself never imports it directly (verified by a dedicated source-scan test) |
| Strict, unknown-key-rejecting request validation | ✅ `.strict()` at the envelope layer, `.strict()` again (from Phase 1) at the event layer |
| No unsafe casts | ✅ `zod`'s `safeParse` narrows `unknown` without a cast anywhere in either new file; confirmed by direct review |
| No lint suppressions | ✅ None added |
| Unexpected errors not hidden by an over-broad catch | ✅ The outer `catch` in both the route and the logger still logs (via `console.error`/`console.warn`) with a correlation id before returning a safe typed result — nothing is silently swallowed without a trace |
| No sensitive content logged or stored | ✅ No free-text/metadata column exists in the target table (Phase 1); logs only ever include event name, route, entity type, and a correlation id |
| Response bodies never leak internals | ✅ §13's dedicated test |

## 17. Rate and abuse review

A repository-wide search (`grep -rli "rate.?limit\|ratelimit\|throttle\|quota"` across `lib/` and `app/api/`) found **no existing shared, production-proven rate limiter anywhere in this codebase** — the only Redis-adjacent dependency (`ioredis`) is used exclusively by the extraction job queue (`bullmq`), not for request throttling. Per the task's own explicit fallback instructions, **no new limiter was invented** for this phase (an in-memory/module-level counter would be unreliable across Vercel's serverless instances and was explicitly excluded; a new paid dependency was explicitly excluded).

**Current mitigations against authenticated-event flooding, all already in place:** every write requires a genuine authenticated session (§7); the event-name/entity-type allowlist and strict schema reject anything malformed instantly and cheaply (§6); the payload is capped at 4 KB (§11); the idempotency key collapses any repeated *identical* logical event to one row (§9–10) regardless of how many times it's retried; storage is append-only and RLS-locked to `service_role` only (Phase 1) with no way for a caller to read anything back.

**Residual risk:** a single authenticated user (or a compromised/malicious session) could still send a rapid burst of *genuinely distinct* logical events (different `navigationId`/route/entity each time) with no per-user request-rate ceiling in this phase — each one is cheap (a handful of small columns, one indexed insert) but there is currently no hard cap on *how many* such distinct rows one user could generate per minute.

**Safest later hardening option:** a shared, distributed rate limiter backed by the Redis instance this repository already depends on via `ioredis` (e.g., a fixed-window or sliding-window counter keyed on `userId`, incremented on each request, checked before calling the logger) — this would be genuinely reliable across serverless instances (unlike an in-memory counter) and would not require a new paid dependency, since the Redis connection infrastructure already exists in this codebase for the job queue. This is explicitly **not** implemented in this phase, per the task's own instruction not to invent an unreliable limiter merely to claim rate limiting exists.

## 18. Tests added

- `lib/activity/log-product-event.server.test.ts` — **28 tests**: happy-path insert payload shape (bare event, exact 6 columns, route normalization, project/calendar-event/calendar-day entity, no-entity case); the `user_id` trust boundary; every trusted-only-field-in-payload rejection (`createdAt`, `idempotencyKey`, `metadata`, arbitrary free-form content); invalid-payload-never-writes (unknown event, malformed user id, malformed/missing `navigationId`); idempotency-key determinism (identical input, a retried delivery, and independently varying `navigationId`/`userId`/event name/route/entity each producing a different key); duplicate-conflict handling (`23505` → duplicate), genuine-failure handling, and thrown-exception handling (never throws); table/RPC isolation (only ever targets `authenticated_product_events`, no `.rpc()` call exists at all).
- `app/api/activity/product-event/route.test.ts` — **34 tests**: success (204 for recorded and duplicate); authentication (401 for anonymous and expired/invalid sessions); malformed request bodies (invalid JSON, non-object JSON, unknown top-level key, top-level `userId`/`email`/`createdAt`/`idempotencyKey`/`metadata`, non-string/missing `navigationId`, missing `event`); every logger-delegated rejection reason mapped to 400 (unknown event, malformed route, external URL, malformed project/calendar-event UUID, impossible calendar date, missing entity, mismatched entity, malformed `navigationId`); content-type (415 for wrong type, charset-suffix accepted) and size (413 for oversized); isolated storage failure (generic 503/500, no internal details leaked); method/architectural isolation (only `POST` exported; no direct reference to `analytics_events`/`supabaseAdmin`/the service-role env var/product-domain tables in the route's own source); and two repository-wide static scans confirming no existing application source file (anywhere under `app/`, excluding this feature's own two files) yet references `/api/activity/product-event` or imports `log-product-event.server`.

**62 new tests, all passing.**

## 19. Commands run

```
git branch --show-current / git log --oneline -3 / git status --short / git status -sb / git diff --check
npx vitest run lib/activity/log-product-event.server.test.ts app/api/activity/product-event/route.test.ts --reporter=verbose
npm install server-only
npx vitest run lib/activity/log-product-event.server.test.ts app/api/activity/product-event/route.test.ts \
  lib/activity/product-event-contracts.test.ts \
  supabase/migrations/202608030001_authenticated_product_events.test.ts \
  supabase/migrations/202608030002_owner_authenticated_activity_report_rpc.test.ts --reporter=verbose
npx tsc --noEmit
npx eslint lib/activity/log-product-event.server.ts lib/activity/log-product-event.server.test.ts \
  app/api/activity/product-event/route.ts app/api/activity/product-event/route.test.ts vitest.config.ts
npx eslint .
git diff --check
npx vitest run --reporter=verbose        (full repository suite)
npm run build                             (production build)
git status --short / git status -sb / git diff --stat / git diff / git diff --check
```

## 20. Exact test, lint, type-check, and build results

- Targeted Phase 1 + Phase 2 tests together: **155/155 passed** (5 test files: the two Phase 1 migration tests, `product-event-contracts.test.ts`, and both new Phase 2 test files).
- `npx tsc --noEmit`: clean, no output.
- `npx eslint` (targeted, then full-repo `npx eslint .`): clean, no output, both times.
- `git diff --check`: clean (only benign LF→CRLF notices on `vitest.config.ts`).
- Full repository suite: **`npx vitest run` → 85 test files passed, 1248 tests passed, 0 failed** (up from Phase 1's 83 files / 1186 tests by exactly this phase's 2 new files / 62 new tests).
- Production build: **`npm run build` → succeeded (exit 0)**. Directly verified on disk (not just the captured console log, which was truncated at the top and appeared to omit early-alphabetical routes) that `.next/server/app/api/activity/product-event/route.js` was compiled, identically in structure to the pre-existing `.next/server/app/api/activity/dashboard-visit/route.js`. No existing user-facing route was added, removed, or changed type (static/dynamic) as a result of this phase.

## 21. Confirmation that no existing product page calls the endpoint

Confirmed two ways: (1) manual review — this phase touched no file under `app/dashboard/`, `app/components/dashboard/`, or any other UI surface; (2) automated — `route.test.ts`'s own "repository-wide isolation" tests recursively scan every `.ts`/`.tsx` file under `app/` (excluding the route's own two files) for the literal strings `/api/activity/product-event` and `log-product-event.server`, asserting zero matches. Both passed.

## 22. Confirmation that no migration was applied

Both Phase 1 `.sql` files remain exactly as committed in `7232b4e`; neither was modified, and no `supabase db push`/`migration up`/equivalent command was run against any environment during this phase.

## 23. Confirmation that nothing was pushed or deployed

No `git push` was run. No deployment or build-and-deploy pipeline was triggered. The only git operations performed were local commits.

## 24. Git status

Pre-commit, `git status --short` contained exactly the 8 files this phase is responsible for (4 new feature files, `package.json`, `package-lock.json`, `vitest.config.ts`, and this report) and nothing else. Post-commit status, the exact commit hash, and confirmation that `main` is now two commits ahead of `origin/main` (Phase 1 + Phase 2, neither pushed) are reported in the final chat response, per this phase's own git rules.

## 25. Exact recommended Phase 3 scope

Per the mapping document's own §22 rollout plan and this phase's "next step" framing: **instrument the four top-level authenticated routes only** — `dashboard_viewed` and `extract_viewed`/`tasks_viewed` (tab-switch events) inside `app/components/dashboard-client.tsx`, and `calendar_viewed` inside `app/components/dashboard/calendar/work-calendar-client.tsx` — each firing the new endpoint from a `useEffect` keyed on a primitive value (`userId` for mount-based events, the specific `activeNav` value for tab switches), mirroring the exact existing `dashboard-visit` `useEffect` pattern already in `dashboard-client.tsx`. Phase 3 should **not** yet touch the six deliberate-surface-opening events (project details, Resources, History, Add Client Update, calendar day/event) — those remain Phase 4, per the mapping document's own phase breakdown — and should **not** yet extend the owner analytics UI (Phase 5).
