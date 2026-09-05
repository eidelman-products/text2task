# Text2Task Live Demo → Account Conversion System

**Milestone: Live Demo -> Account Conversion, Phases 0A through 2D**

- Date: 2026-09-03
- Status: Implemented, locally verified through final closeout polish, **not committed, not pushed, not deployed**
- Companion file: `Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.docx` (the formatted, distributable version — this Markdown file is the editable source)

### How to use this document

This file is self-contained and does not assume access to prior chat history. If you are resuming this work in a future session, read this document first — it tells you exactly what was implemented, what was verified, what remains uncommitted in the working tree, and what the next approved phase is.

---

## 1. Approved Architecture Summary

A prior read-only architecture audit established the long-term design for a Live Demo → Account Conversion measurement system. Key locked conclusions carried into this milestone:

- The existing anonymous Live Demo → authenticated "claim" mechanism (trials, drafts, claims, duplicate-detection, idempotent save) is valuable, already-shipped production infrastructure — it was **not** redesigned in this milestone, only tested.
- The canonical future funnel identifier will be the existing `t2t_anon_id` cookie (reused, not replaced) — **not implemented yet**, deferred to Phase 1A.
- The first implementation milestone was explicitly scoped as: **Phase 0A** (regression coverage for the claim/demo lifecycle) + **Phase 0B** (wire the already-allowlisted `login_success` event into the password-login path).
- Later phases (anonymous_id enrichment, `demo_review_viewed`, `demo_account_cta_clicked`, `demo_claim_saved`, owner-flagged metadata, admin funnel UI, claim TTL redesign, any UX/CRO change) are explicitly **out of scope** for this milestone and were not touched.

---

## 2. Scope of This Implementation

**Phase 0A — Production regression coverage**, covering:
- `app/api/homepage-demo/claim/prepare/route.ts`
- `app/api/homepage-demo/claim/save/route.ts`
- `app/api/homepage-demo/claim/save-anyway/route.ts`
- `app/api/homepage-demo/extract/route.ts`
- `app/api/homepage-demo/review/route.ts`
- Auth-intent continuity across `app/api/auth/login/route.ts`, `app/auth/oauth/callback/route.ts`, `app/api/auth/signup/route.ts`, `app/auth/confirm/route.ts`

**Phase 0B — `login_success` telemetry**, covering:
- `app/api/auth/login/route.ts` (the only production-code file changed in this entire milestone)

---

## 3. Exact Files Inspected (before writing any test)

Re-validated against current HEAD (`ba60696`) before editing — full content read, not assumed from any prior audit:

- `app/api/homepage-demo/claim/prepare/route.ts`
- `app/api/homepage-demo/claim/save/route.ts`
- `app/api/homepage-demo/claim/save-anyway/route.ts`
- `app/api/homepage-demo/extract/route.ts`
- `app/api/homepage-demo/review/route.ts`
- `lib/homepage-demo/errors.ts`
- Exported signatures of every `lib/homepage-demo/*.server.ts` module these five routes import (`identity.server.ts`, `claim-identity.server.ts`, `claim-request.server.ts`, `claim-repository.server.ts`, `claim-save-repository.server.ts`, `claim-save-request.server.ts`, `claim-duplicate-override-identity.server.ts`, `claim-duplicate-override-repository.server.ts`, `public-extract-request.server.ts`, `public-extract-identity.server.ts`, `public-review-identity.server.ts`, `public-review-request.server.ts`, `orchestration.server.ts`, `review-repository.server.ts`, `review-payload.server.ts`) and `lib/projects/import-persistence.server.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/login/route.test.ts` (pre-existing, from the earlier Owner Traffic Exclusion milestone)
- `app/auth/oauth/callback/route.ts` and its pre-existing test file
- `app/api/auth/signup/route.ts` (had zero prior test coverage)
- `app/auth/confirm/route.ts` (had zero prior test coverage)
- `lib/analytics/internal-events.server.ts` and `lib/analytics/signup-attribution.server.ts` (to confirm the existing idempotency-key convention before choosing one for `login_success`)

**Confirmed no code drift since the architecture audit:** `git log -1` and `git status` both showed the working tree exactly as the audit last saw it before this milestone began.

---

## 4. Exact Files Changed

| File | Added/Modified | Why |
|---|---|---|
| `app/api/auth/login/route.ts` | Modified | The only production-code change in this milestone — wires `login_success` (Phase 0B) |
| `app/api/auth/login/route.test.ts` | Modified (extended) | Added demo-intent continuity tests (0A.6) and `login_success` tests (0B) to the existing file rather than duplicating its owner-exclusion coverage |
| `app/auth/oauth/callback/route.test.ts` | Modified (extended) | Added demo-intent continuity tests (0A.6) to the existing file |
| `app/api/homepage-demo/claim/prepare/route.test.ts` | New | First coverage for this route (0A.1) |
| `app/api/homepage-demo/claim/save/route.test.ts` | New | First coverage for this route (0A.2) — the most production-critical, previously-untested path |
| `app/api/homepage-demo/claim/save-anyway/route.test.ts` | New | First coverage for this route (0A.3) |
| `app/api/homepage-demo/extract/route.test.ts` | New | First coverage for this route (0A.4) |
| `app/api/homepage-demo/review/route.test.ts` | New | First coverage for this route (0A.5) |
| `app/api/auth/signup/route.test.ts` | New | First coverage for this route; demo-intent continuity (0A.6) |
| `app/auth/confirm/route.test.ts` | New | First coverage for this route; demo-intent continuity (0A.6) |

**No other file was touched.** `app/page.tsx`, all `lib/homepage-demo/*.server.ts` implementation files, all Supabase migrations/RPCs, `app/globals.css`, and every file explicitly listed as out-of-scope were confirmed untouched by `git status`.

---

## 5. New Tests Added

| File | Tests | Focus |
|---|---|---|
| `app/api/homepage-demo/claim/prepare/route.test.ts` | 11 | Valid preparation, cookie issuance, invalid identity, expired trial, already-claimed, already-authenticated visitor, fail-safe error handling |
| `app/api/homepage-demo/claim/save/route.test.ts` | 17 | Unauthenticated rejection, valid authenticated save, idempotent already-claimed, duplicate detection (no import, override cookie issued), invalid/expired claim, RPC/DB failure (no false success), repeated/replayed request, authorization invariant (server-derived user id only) |
| `app/api/homepage-demo/claim/save-anyway/route.test.ts` | 13 | Valid override, invalid/missing/malformed override token, expired override, override bound to wrong claim, unauthenticated rejection, repeated request idempotency, RPC/import failure |
| `app/api/homepage-demo/extract/route.test.ts` | 16 | Successful extraction + analytics, Turnstile failure (both blocked and unblocked), rate limiting, admission rejections, extraction/model failure, persistence failure, existing analytics-event contract preserved unchanged |
| `app/api/homepage-demo/review/route.test.ts` | 10 | review_ready, review_not_ready (pending), review_expired, review_unavailable, invalid token, malformed request, fail-safe error handling |
| `app/api/auth/signup/route.test.ts` | 13 | Demo-intent continuity (destination + `/auth/confirm` redirect construction), existing validation/error behavior, `ensureUser`/`signup_success` firing rules |
| `app/auth/confirm/route.test.ts` | 8 | Demo-intent continuity (continuation redirect, retry-redirect intent preservation), existing failure-redirect behavior |
| **Total new tests** | **88** | Across 7 new test files |

---

## 6. Existing Tests Extended

| File | Tests before | Tests after | New tests added | What was added |
|---|---|---|---|---|
| `app/api/auth/login/route.test.ts` | 11 | 20 | 9 | 4 demo-intent-continuity tests (0A.6) + 5 more `login_success` tests (0B, beyond the count already reflected above) |
| `app/auth/oauth/callback/route.test.ts` | 7 | 13 | 6 | Demo-intent-continuity tests (0A.6) |

No good existing coverage was duplicated — the pre-existing owner-exclusion and baseline-redirect tests in both files were left untouched and are cited in this document (§4, §13) as already protecting invariants 0A.6.1 and 0A.6.7, rather than re-written.

---

## 7. Production-Code Changes

**Exactly one production file changed: `app/api/auth/login/route.ts`.**

Added:
- A `scheduleLoginSuccessAnalytics(userId: string)` function, following the exact `after()` + `logAnalyticsEventSafe()` + try/catch-swallow pattern already established elsewhere in this codebase (`lib/analytics/signup-attribution.server.ts`, `app/api/homepage-demo/extract/route.ts`).
- One call site: `scheduleLoginSuccessAnalytics(data.user.id)`, placed immediately after `ensureUser(...)` succeeds and before the response/redirect is built — i.e., strictly on the successful-login path, after the point where `data.user` is confirmed to exist.

No refactor was needed to make this testable — the existing `after()` + best-effort-analytics pattern already used in this codebase for `homepage_demo_extract_*` and `signup_success` was directly reusable without any structural change to the route.

---

## 8. `login_success` Implementation Details

- **Exact successful trigger:** fires only after `supabase.auth.signInWithPassword(...)` returns a non-error result with a real `data.user`, and only after `ensureUser(...)` has completed. It does **not** fire for invalid credentials, for the "email not confirmed" branch, or for the malformed-email-format early-return branch.
- **Trusted user identification:** `userId` is always `data.user.id` — the id Supabase itself returned for the authenticated session. The route never reads any `user_id`/`userId` field from the submitted form data; a test explicitly proves that a form field named `user_id`/`userId` submitted by the client is ignored.
- **Idempotency strategy:** `login_success:{userId}:{10-second time bucket}` — see §9 for the full rationale.
- **Failure behavior:** the entire scheduling call is wrapped in nested `try/catch` blocks (one around scheduling, one inside the `after()` callback around the actual `logAnalyticsEventSafe` call) — an analytics failure can never surface as a login failure. A test proves login still succeeds and redirects correctly even when `logAnalyticsEventSafe` itself rejects.
- **Demo-intent impact:** none — the call site sits before the demo-intent-vs-normal destination branch, and a test proves the demo-intent continuation redirect (`/homepage-demo/claim/continue`) still fires correctly alongside the new analytics call.
- **Normal-login impact:** none beyond the one new analytics row — the redirect destination, owner-exclusion-cookie behavior, and all existing response semantics are unchanged, each directly re-verified by tests in the same file.

---

## 9. Idempotency Decision

Before implementing the architecture-audit's suggested short time-bucket, the existing analytics idempotency convention was inspected directly (`lib/analytics/signup-attribution.server.ts`): `signup_success`/`signup_attribution_captured` both use `idempotencyKey = "{eventName}:{userId}"` — a **global, once-ever-per-user** key. This is correct for signup (happens exactly once in a user's lifetime) but was confirmed **unsuitable for login**, which legitimately recurs many times.

**Chosen strategy:** `login_success:{userId}:{Math.floor(Date.now() / 10000)}` — a 10-second time bucket.

- **Why this and not something else:** it directly satisfies both stated invariants — a genuine accidental duplicate (e.g. a fast double-submit of the login form before the button disables) lands in the same 10-second bucket and collapses to one row via the pre-existing partial-unique-index on `analytics_events.idempotency_key`; two genuinely separate login sessions, even the same user logging in twice in one sitting, will almost always fall in different buckets and both remain observable. This is the simplest option that satisfies the stated invariant without adding any new infrastructure — no new table, no new column, reuses the exact idempotency mechanism (`analytics_events_idempotency_key_unique_idx`) already in production for every other deduplicated event in this codebase.
- Tests directly verify both halves: two calls within the same 10-second window produce the identical key; two calls 15 seconds apart produce different keys.

---

## 10. Security Invariants Verified

All explicitly re-confirmed after implementation, not merely assumed:

- **Claim token validation:** unchanged — no route's cookie-reading/hash-comparison logic was touched; every claim/save/save-anyway test confirms rejection paths (missing cookie, missing auth, invalid override) behave exactly as before.
- **No raw token exposure:** confirmed — the new `login_success` event carries only `eventName`, `userId`, `idempotencyKey`; no claim/public/session/device token, raw or hashed, is included. No test asserts on or constructs a raw token being sent anywhere new.
- **No demo content in analytics:** confirmed — the existing `homepage_demo_extract_*` analytics contract (no text, no extracted content, `userId`/`anonymousId` both null) was explicitly re-verified unchanged by a dedicated test (`extract/route.test.ts`, "existing operational analytics fires with no identifier and no raw text").
- **No authentication bypass:** confirmed — every claim/save and claim/save-anyway unauthenticated-request test still returns 401 before any project data is touched.
- **No rate-limiting change:** confirmed — no test or code change touches the admission RPC, Turnstile verification, or any rate-limit table; the extract-route tests mock the orchestration boundary but never alter its contract.
- **No duplicate-detection weakening:** confirmed — the duplicate-detected (409) and override-authority paths are directly tested and behave exactly per the pre-existing contract.
- **No idempotency weakening:** confirmed — `login_success`'s new idempotency key reuses, rather than bypasses, the existing partial-unique-index mechanism; claim/save's own DB-level idempotency (`already_claimed` outcome) is untouched and directly tested.
- **RLS unchanged:** confirmed — no migration was written, no table/policy touched.
- **No broadened service-role exposure:** confirmed — `logAnalyticsEventSafe` already ran server-side with `supabaseAdmin` before this milestone; this call site adds one more caller of an already-existing, already-service-role-scoped function.
- **Analytics never authoritative for access control:** confirmed by construction — `login_success` is a pure side effect of an already-completed, already-authorized login; it cannot influence whether the login itself succeeds or what destination is chosen.
- **No client-supplied user_id:** confirmed and directly tested (§8) — a form field literally named `user_id`/`userId` submitted by the client is proven to have no effect on the logged event.
- **Billing unaffected:** confirmed — `getDestinationForProPurchaseIntent`/pro-purchase-intent cookie logic is untouched, and the new analytics call sits entirely outside that branch.

---

## 11. Test Commands Run

1. Per-file targeted runs during development (each confirmed green before moving to the next file):
   `npx vitest run app/api/homepage-demo/claim/prepare/route.test.ts`
   `npx vitest run app/api/homepage-demo/claim/save/route.test.ts`
   `npx vitest run app/api/homepage-demo/claim/save-anyway/route.test.ts`
   `npx vitest run app/api/homepage-demo/extract/route.test.ts`
   `npx vitest run app/api/homepage-demo/review/route.test.ts`
   `npx vitest run app/api/auth/login/route.test.ts`
   `npx vitest run app/auth/oauth/callback/route.test.ts`
   `npx vitest run app/api/auth/signup/route.test.ts`
   `npx vitest run app/auth/confirm/route.test.ts`
2. Combined related-area run: `npx vitest run app/api/homepage-demo app/api/auth app/auth/oauth app/auth/confirm app/admin/analytics`
3. TypeScript: `npx tsc --noEmit`
4. Lint (changed/new files only): `npx eslint <the 10 changed/new files>`
5. Production build: `npm run build`
6. Full repository suite: `npm test` (`vitest run`)

---

## 12. Exact Test Results

| Command | Result |
|---|---|
| `claim/prepare/route.test.ts` | 11/11 passed |
| `claim/save/route.test.ts` | 17/17 passed |
| `claim/save-anyway/route.test.ts` | 13/13 passed |
| `extract/route.test.ts` | 16/16 passed |
| `review/route.test.ts` | 10/10 passed |
| `login/route.test.ts` | 20/20 passed (11 pre-existing + 9 new) |
| `oauth/callback/route.test.ts` | 13/13 passed (7 pre-existing + 6 new) |
| `signup/route.test.ts` | 13/13 passed |
| `confirm/route.test.ts` | 8/8 passed |
| Combined related-area run | 14 test files, 145 tests, all passed |
| `npx tsc --noEmit` | Clean, zero errors |
| `eslint` on all 10 changed/new files | Clean, zero warnings/errors |
| `npm run build` | Succeeded — full route table generated, no errors |
| Full suite (`npm test`) | **207 test files, 5,315 tests, all passed** |

**Passed: 5,315 / Failed: 0 / Skipped: 0 / Total: 5,315** (full suite). No test was skipped anywhere in this milestone.

---

## 13. Pre-Existing Failures

**None.** The full suite ran clean end-to-end, including the previously-observed intermittent flaky test (`app/share/[publicId]/share-view.client.test.tsx`, a timing-sensitive assertion noted in an earlier SEO-phase audit) — it passed cleanly in this run and is unrelated to any file touched in this milestone.

---

## 14. Discovered Issues — Not Fixed

**NONE** meeting the "evidence-backed, discovered during this milestone" bar. No new production bug was found in any adjacent, out-of-scope area while inspecting these files. (For the avoidance of doubt: the previously-documented architectural gaps — no `anonymous_id` on demo events, no `demo_review_viewed`/`demo_account_cta_clicked`/`demo_claim_saved` events, the claim-TTL continuity risk for slow email confirmation — are **known, already-documented findings from the prior architecture audit**, not new discoveries from this implementation pass, and are correctly deferred to their already-planned future phases rather than listed here as new issues.)

---

## 15. Database / Supabase Status

**Unchanged.** No migration created. No table, column, RLS policy, or RPC modified. No Supabase project setting touched. Every test in this milestone mocks the Supabase client boundary (`@/lib/supabase/server`, `@/lib/supabase/admin` indirectly via `@/lib/homepage-demo/*` module mocks) rather than touching a real database.

---

## 16. Environment / Vercel Status

**Unchanged.** No environment variable added, removed, or modified. No `vercel.json` or Vercel project configuration touched. No `next.config.ts` change.

---

## 17. Git Status

**No commit was created. No push was performed.** Working tree contains exactly:

```
 M app/api/auth/login/route.test.ts
 M app/api/auth/login/route.ts
 M app/auth/oauth/callback/route.test.ts
?? app/api/auth/signup/route.test.ts
?? app/api/homepage-demo/claim/prepare/route.test.ts
?? app/api/homepage-demo/claim/save-anyway/route.test.ts
?? app/api/homepage-demo/claim/save/route.test.ts
?? app/api/homepage-demo/extract/route.test.ts
?? app/api/homepage-demo/review/route.test.ts
?? app/auth/confirm/route.test.ts
```

Branch: `main`. HEAD before and after this milestone: `ba60696` (unchanged — no commit was made). Nothing staged. These verified, related changes are intended to be batched into a meaningful milestone commit later, per the user's stated Git workflow for this project.

---

## 18. Continuation Point

If this conversation is lost, a future session should:
1. Read this document in full.
2. Run `git status` and confirm the 10 files above are still the only ones modified/untracked (if the working tree differs, treat any additional changes as separate work and do not discard them).
3. Confirm the tests in §12 still pass (re-run `npm test`) before proceeding, to guard against any drift since this document was written.
4. Await explicit instruction before beginning Phase 1A (see below) — this milestone intentionally stops here.

---

## 19. Next Approved Milestone (as recorded at the end of Phase 0A + 0B — superseded, see §21)

> **Status: COMPLETE — see §21.** This section is preserved unchanged as decision history. At the time it was written, Phase 1A had not begun; it has since been implemented, verified, and documented in §21 below. Read §21 for the current, authoritative state of Phase 1A, and §22 for what's next (Phase 1B, not started).

**Phase 1A — Enrich the existing homepage-demo operational events with the existing `t2t_anon_id` / `anonymous_id` architecture.**

Specifically (per the approved architecture, not yet implemented): read the existing `t2t_anon_id` cookie inside `app/api/homepage-demo/extract/route.ts` and stamp its value onto the `anonymous_id` field of the three existing `homepage_demo_extract_attempt` / `_succeeded` / `_failed` events (currently always `null`), enabling a future join between anonymous demo activity and later signup/login events that already carry the same `anonymous_id`.

---

## 20. Milestone Result (Phase 0A + 0B, as recorded at the time)

**PASS.** Both Phase 0A (production regression coverage for the Live Demo/claim lifecycle and auth-intent continuity) and Phase 0B (`login_success` telemetry, wired via the existing analytics architecture with a deliberately-chosen short-window idempotency strategy) are implemented, fully verified (build, typecheck, lint, and a clean 5,315-test full suite run), and left entirely uncommitted in the working tree, exactly as instructed.

---

## 21. PHASE 1A — ANONYMOUS FUNNEL IDENTITY ENRICHMENT (2026-09-03)

> **Status: COMPLETE.** Implemented, verified, and left uncommitted in the working tree alongside the still-uncommitted Phase 0A + 0B changes, exactly as instructed. Nothing staged, committed, pushed, or deployed.

### 21.1 Approved Goal

Populate the existing, currently-always-`null` `anonymous_id` field on the three existing homepage-demo operational events (`homepage_demo_extract_attempt`, `homepage_demo_extract_succeeded`, `homepage_demo_extract_failed`) using Text2Task's existing `t2t_anon_id` first-party analytics identity — and nothing else. No new event, no new identifier, no new table, no owner-filtering, no consent redesign.

### 21.2 Implementation Summary

Before writing any code, the exact current implementations of `lib/analytics/request-attribution.server.ts`, `app/api/analytics/event/route.ts`, `lib/analytics/internal-events.server.ts`, `app/api/homepage-demo/bootstrap/route.ts`, and `app/api/homepage-demo/extract/route.ts` were read in full (re-validated against current HEAD, not assumed from the Phase 0 audit).

**Key finding that shaped the implementation:** `readAnonymousIdCookie(request)` (exported from `lib/analytics/request-attribution.server.ts`) is **already used today, in production**, as a direct, unconditional fallback inside `app/api/analytics/event/route.ts` (line: `... ?? readAnonymousIdCookie(request)`), completely outside of that file's own consent-gated `readRequestAttribution()` orchestration function. This is the exact existing precedent for reading `t2t_anon_id` directly, without also pulling in UTM/referrer/attribution data we don't want, and without introducing a new consent-gating decision this phase was explicitly told not to make.

**Implementation:** `app/api/homepage-demo/extract/route.ts` now calls `readAnonymousIdCookie(request)` once, at the very top of `POST` (before the `try` block, so it's available to both the success path and the catch-block's failure-analytics calls), and threads the resulting value through the existing `scheduleHomepageDemoExtractAttempt` → `scheduleHomepageDemoExtractOrchestrationOutcome` / `scheduleHomepageDemoExtractFailure` → `scheduleHomepageDemoExtractAnalytics` call chain, replacing the hardcoded `anonymousId: null` in the final `logAnalyticsEventSafe(...)` call with the real value (or `null`, unchanged, if the cookie is absent).

### 21.3 Exact Identity Reused

- **Cookie name:** `t2t_anon_id` (`ANONYMOUS_COOKIE` in `lib/analytics/request-attribution.server.ts`).
- **Set by:** `app/components/analytics/attribution-capture.tsx`, client-side, on any page load — a random opaque token (`generateRandomId()`, `crypto.randomUUID()` with a fallback), stored in both `localStorage` and this cookie.
- **Cookie attributes (unchanged, not touched by this phase):** `Max-Age` 180 days, `Path=/`, `SameSite=Lax`, `Secure` on HTTPS.
- **Validation applied when read:** `clampAnalyticsText` — must be a string, trimmed, clamped to 120 characters. No format/UUID regex is enforced — this matches the existing, lenient, site-wide convention already applied identically to `page_view`, `signup_attribution_captured`, and `signup_success`; Phase 1A does not introduce stricter validation than the rest of the codebase already uses for this same field.
- **Missing-cookie behavior:** `readAnonymousIdCookie` returns `null` if the cookie is absent, non-string, or empty after trimming — the route passes this `null` straight through, exactly reproducing the pre-Phase-1A behavior for that case.

### 21.4 Why a New Funnel Identifier Was NOT Created

The approved architecture already concluded `t2t_anon_id` should be reused rather than inventing a second identity, and this implementation pass found no technical obstacle to that plan — `readAnonymousIdCookie` is a pure, dependency-free, already-exported function with an existing direct-fallback precedent in production code. No new cookie, table, column, or identifier scheme was introduced. This phase did not need to escalate or stop for architectural reconsideration.

### 21.5 Files Changed

| File | Change | Reason |
|---|---|---|
| `app/api/homepage-demo/extract/route.ts` | Modified | Reads `t2t_anon_id` once via the existing `readAnonymousIdCookie` helper; threads it through the existing analytics-scheduling call chain; replaces the hardcoded `anonymousId: null` |
| `app/api/homepage-demo/extract/route.test.ts` | Modified (extended) | 10 new Phase 1A tests added to the existing Phase 0A file |
| `docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md` / `.docx` | Modified | This section |

**No other file was touched.** No new helper module was created — `readAnonymousIdCookie` already existed and was directly reusable, so no "genuinely necessary" tiny helper (per this phase's own instructions) was warranted.

### 21.6 Event Contract Before / After

| Event | `anonymous_id` before | `anonymous_id` after |
|---|---|---|
| `homepage_demo_extract_attempt` | always `null` | `t2t_anon_id` cookie value if present, else `null` (unchanged fallback) |
| `homepage_demo_extract_succeeded` | always `null` | same |
| `homepage_demo_extract_failed` | always `null` | same |

Event names, HTTP response codes/bodies, `userId` (still always `null` — unrelated to this phase), `pagePath`, and every existing `metadata` field are byte-for-byte unchanged — verified directly by a dedicated test asserting no metadata field regressed and the extraction response contract is untouched.

### 21.7 Test Coverage

10 new tests added to `app/api/homepage-demo/extract/route.test.ts` (Phase 0A's file, extended rather than duplicated):

1. `t2t_anon_id` cookie present → `homepage_demo_extract_attempt` receives that exact value.
2. Successful extraction → `_succeeded` receives the same value.
3. Failed extraction → `_failed` receives the same value.
4. All events fired within one request carry the identical `anonymousId` (single cookie read, threaded consistently).
5. Missing cookie → demo still returns its normal success response; all logged events show `anonymousId: null` (the exact pre-Phase-1A behavior).
6. A request with literally no cookie header at all still completes end-to-end (defensive proof nothing about the new code path can block extraction).
7. An oversized cookie value is clamped to 120 characters, never rejected — proving the existing lenient site-wide convention is followed, not a stricter one invented for this route.
8. Analytics logging failure (`logAnalyticsEventSafe` rejecting) still leaves the extraction response fully correct, with enrichment in place.
9. No existing event name or metadata field regressed — only `anonymousId` changed from the prior contract; a dedicated assertion confirms no pasted text or extracted content ever appears in logged metadata.
10. The identity-resolution call used for rate-limit/session/device admission (`resolveHomepageDemoPublicExtractIdentity`) is asserted to receive no `anonymousId`-shaped argument and to never contain the analytics identifier anywhere in its input — direct proof the two identity systems remain uncoupled.

Deliberately **not mocked**: `readAnonymousIdCookie` itself — it is a pure, dependency-free function, so these tests set a real `t2t_anon_id` cookie via the existing `buildRequest(cookies)` test helper and exercise the real implementation, rather than asserting against a mocked assumption.

### 21.8 Exact Test Results

- Targeted: `npx vitest run app/api/homepage-demo/extract/route.test.ts` → **26/26 passed** (16 pre-existing Phase 0A tests + 10 new Phase 1A tests).
- Related-area: `npx vitest run app/api/homepage-demo app/api/analytics app/api/auth app/auth lib/analytics app/admin/analytics` → **19 test files, 216 tests, all passed.**
- Full suite: `npm test` → **207 test files, 5,325 tests, all passed** (exactly +10 over the Phase 0A/0B baseline of 5,315 — matching the 10 new tests in this one extended file; no new test file was created, so the file count is unchanged at 207).
- `npx tsc --noEmit`: clean, zero errors.
- `eslint` on both changed files: clean, zero warnings.
- `npm run build`: succeeded, full route table generated, no errors.

**Passed: 5,325 / Failed: 0 / Skipped: 0.** No pre-existing failure surfaced.

### 21.9 Privacy Verification

Explicitly confirmed absent from analytics, by direct code inspection and by the test in item 9 of §21.7:

- Pasted demo text — absent (never was, unrelated code path; not touched by this phase).
- Extracted task text / project title / client name / email / phone / notes — absent (same).
- Raw public token, raw claim token, raw session token, raw device token — absent; none of these values are ever passed to `logAnalyticsEventSafe`.
- Session/device token **hashes** — also absent; only the analytics-purpose `t2t_anon_id` value is added, never any value derived from `resolveHomepageDemoPublicExtractIdentity`'s output.

The only new data point stored is the existing, already-in-production-use, purpose-built opaque analytics identifier — no new category of information is captured.

### 21.10 Security / Identity Separation

Explicitly preserved, verified by test (§21.7 item 10):

- The demo's rate-limiting/abuse identities (`session_token_hash`, `device_token_hash`, the public token, the claim token) are **never read, referenced, or influenced** by this change — `readAnonymousIdCookie` and `resolveHomepageDemoPublicExtractIdentity` are called independently, with no data flow between them.
- `anonymous_id` is not, and cannot become, authoritative for admission, rate limiting, trial lookup, review access, claim access, authentication, or authorization — it flows only into `logAnalyticsEventSafe`, a write-only analytics sink.
- No raw or hashed security token is ever placed into `anonymous_id` or into any analytics metadata field.

### 21.11 Owner Exclusion — Known Limitation (unchanged, not addressed this phase)

As explicitly scoped, Phase 1A does **not** add `owner_flagged` metadata, owner-exclusion filtering, or any business/operational split for these events. The pre-existing limitation documented in the original architecture audit stands exactly as before: the general owner-analytics-exclusion cookie mechanism (`t2t_owner_analytics_excluded`) is still not checked anywhere in the homepage-demo route tree, so if the site owner personally runs the Live Demo, that activity is still fully counted in these operational events — now additionally carrying whatever `t2t_anon_id` value that owner's browser happens to have. This is an unchanged, already-documented, explicitly-deferred limitation, not a new issue introduced by this phase.

### 21.12 Consent Treatment (unchanged, not redesigned this phase)

These three events continue to fire unconditionally, exactly as before — regardless of the analytics-cookie consent banner's state — matching their existing, explicit "operational telemetry, counted server-side even without analytics-cookie consent" classification (stated in the admin analytics page's own copy). Phase 1A adds a value to an existing field on an already-unconditional event; it does not change when or whether the event fires, and does not introduce any new consent decision.

### 21.13 Database / Supabase Status

**Unchanged.** No migration created. No table, column, index, RLS policy, or RPC modified. The existing `analytics_events.anonymous_id` column (already nullable, already in production use for every other event type) is the only thing written to — exactly as the approved architecture expected, with no blocker encountered.

### 21.14 Backward Compatibility

- Historical rows with `anonymous_id = null` remain exactly as they are — untouched, unqueried for modification, valid as-is.
- No backfill was attempted or considered — the architecture audit's own principle ("historical rows cannot be accurately reconstructed, don't try") was followed.
- No migration was needed or created.
- Existing admin analytics (`buildLiveDemoPeriodStats`, the raw attempt/succeeded/failed counts shown today) continues to work unchanged — it does not read `anonymous_id` at all, so this enrichment has zero effect on the currently-displayed numbers.
- Normal page-view analytics, signup analytics, and Phase 0B's `login_success` are entirely untouched — none of those code paths were modified in this phase.
- The claim flow (`claim/prepare`, `claim/save`, `claim/save-anyway`) was not touched.
- Auth-intent continuity (Phase 0A) was not touched.
- Existing users are unaffected — this is a server-side-only analytics enrichment with no user-facing behavior change of any kind.

### 21.15 Discovered Issues — Not Fixed

**NONE** newly discovered in this pass. (§21.11's owner-exclusion gap is a carried-forward, already-documented limitation from the original architecture audit, explicitly out of scope for this phase — not a new finding.)

### 21.16 Git Status After Phase 1A

```
 M app/api/auth/login/route.test.ts                    <- Phase 0A/0B, untouched this phase
 M app/api/auth/login/route.ts                          <- Phase 0B, untouched this phase
 M app/auth/oauth/callback/route.test.ts                <- Phase 0A, untouched this phase
 M app/api/homepage-demo/extract/route.ts                <- THIS PHASE (1A)
 M app/api/homepage-demo/extract/route.test.ts           <- THIS PHASE (1A, extended)
?? app/api/auth/signup/route.test.ts                    <- Phase 0A, untouched this phase
?? app/api/homepage-demo/claim/prepare/route.test.ts     <- Phase 0A, untouched this phase
?? app/api/homepage-demo/claim/save-anyway/route.test.ts <- Phase 0A, untouched this phase
?? app/api/homepage-demo/claim/save/route.test.ts        <- Phase 0A, untouched this phase
?? app/api/homepage-demo/review/route.test.ts            <- Phase 0A, untouched this phase
?? app/auth/confirm/route.test.ts                        <- Phase 0A, untouched this phase
?? docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.docx  <- cumulative
?? docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md    <- cumulative
```

Branch: `main`. HEAD: `ba60696` (unchanged since before Phase 0A — no commit has been made across any phase of this milestone so far). Nothing staged. All prior Phase 0A/0B files were confirmed present and unmodified before this phase began, and remain so now.

### 21.17 Continuation Point

If this conversation is lost, a future session should:
1. Read this document in full, specifically this §21 for the current state.
2. Run `git status` and confirm the exact 12 files in §21.16 are still the only ones modified/untracked.
3. Re-run `npm test` to confirm the full 5,325-test suite still passes before proceeding.
4. Await explicit instruction before beginning Phase 1B — this milestone intentionally stops here.

---

## 22. Next Approved Milestone (as recorded at the end of Phase 1A — superseded, see §23)

> **Status: COMPLETE — see §23.** Preserved unchanged as decision history.

**PHASE 1B — REVIEW + ACCOUNT CTA TELEMETRY**

Per the approved architecture, its expected scope was: a server-authoritative `demo_review_viewed` event fired from `app/api/homepage-demo/review/route.ts` on first `review_ready` response per draft, and a client-fired `demo_account_cta_clicked` event from the review page's "Start for free"/"Log in" buttons.

---

## 23. PHASE 1B — REVIEW + ACCOUNT CTA TELEMETRY (2026-09-03)

> **Status: COMPLETE.** Implemented, verified, and left uncommitted in the working tree alongside the still-uncommitted Phase 0A + 0B + 1A changes, exactly as instructed. Nothing staged, committed, pushed, or deployed.

### 23.1 Scope

Implement exactly two conversion events — `demo_review_viewed` (server-authoritative) and `demo_account_cta_clicked` (client, best-effort) — measuring the existing review and CTA behavior without changing any UX, copy, navigation, or claim-preparation sequencing.

### 23.2 Architecture Used

Both events reuse existing infrastructure rather than introducing anything new:

- **Identity:** the same `t2t_anon_id` → `anonymous_id` convention established in Phase 1A (`readAnonymousIdCookie`), read independently in the review route.
- **Server event storage:** the existing `analytics_events` table via `logAnalyticsEventSafe`, the same `after()` + try/catch-swallow fail-safe pattern used throughout this project.
- **Client event transport:** the existing `/api/analytics/event` route — the same pipeline `page_view` already uses, inheriting its existing consent gating and owner-exclusion behavior automatically, with no new client analytics mechanism introduced.

**Two small, explicitly-justified adjustments to existing architecture were required** (both anticipated and pre-authorized by this phase's own instructions):
1. `ALLOWED_EVENT_NAMES` in `lib/analytics/internal-events.server.ts` (the server-side canonical allowlist) — added both `demo_review_viewed` and `demo_account_cta_clicked`, since `logAnalyticsEventSafe` rejects any unlisted event name regardless of transport.
2. `ALLOWED_BROWSER_EVENTS` in `app/api/analytics/event/route.ts` (the separate, narrower, client-facing allowlist — confirmed by direct inspection to previously contain only `"page_view"`) — added `demo_account_cta_clicked` only. `demo_review_viewed` was deliberately **not** added here, since it is fired directly from server code and never passes through this client-facing route at all — exactly the "server vs. client allowlists are not the same system, add each event only where it's actually emitted" distinction this phase's instructions called for.

Additionally, `app/api/analytics/event/route.ts` previously hardcoded `metadata: { source: "browser" }` unconditionally, with no path for a client to supply any structured field. A minimal, strictly-validated addition (`getEventMetadata`) now accepts a `cta` field **only** for `demo_account_cta_clicked`, validated against a closed enum (`start_free` | `log_in`) — any other or missing value is silently dropped, never stored as free text, and `page_view`'s metadata shape is completely unchanged.

### 23.3 Exact `demo_review_viewed` Milestone Semantics

**Trigger:** fires only when `app/api/homepage-demo/review/route.ts`'s `POST` handler successfully obtains a real, ready draft from `getHomepageDemoReviewDraft(...)` — i.e., only on the actual `review_ready` / HTTP 200 path. Every other outcome (`review_not_ready`, `review_expired`, `review_unavailable`, malformed request, identity error) throws or short-circuits **before** reaching the event-scheduling call, so none of them can ever produce this event — confirmed directly by the route's own control flow, not assumed.

**Authoritative emitter:** the server (`app/api/homepage-demo/review/route.ts`) — the client cannot fabricate this milestone; it is a direct consequence of the server actually returning a genuine ready result.

**Identity:** `t2t_anon_id` read via `readAnonymousIdCookie(request)`, at the very top of `POST` (before the `try` block), matching the Phase 1A convention exactly. `null` if the cookie is absent — the review response is completely unaffected either way.

**Idempotency:** `demo_review_viewed:${draft.draftId}` — `draftId` is a stable, internal, server-only UUID (from `HomepageDemoReviewDraft`, `lib/homepage-demo/review-repository.server.ts`), never exposed to the client (the client only ever sees the separately-hashed public token in the URL fragment), and unique per trial by the database's own schema (`homepage_demo_drafts.trial_id` is a unique foreign key). Reusing the existing `analytics_events.idempotency_key` partial unique index means polling, refreshing, or reopening the review all safely collapse to exactly one row per draft — verified directly by test (repeated requests for the same draft produce the identical key; a different draft produces a different key).

**Pending/expired behavior:** no event, confirmed by dedicated tests for `review_not_ready`, `review_expired`, `review_unavailable`, and a malformed request.

**Analytics-failure behavior:** wrapped in the same nested try/catch + `after()` pattern as every other operational event in this codebase — a `logAnalyticsEventSafe` rejection cannot alter the review response, directly tested.

### 23.4 Exact `demo_account_cta_clicked` Semantics

**Trigger:** fires from inside `prepareClaimAndNavigate(destination)` in `HomepageDemoReviewClient.tsx`, placed immediately after the function's own existing guards (`authPreparationInFlightRef.current` in-flight check, `publicToken === null` check) pass — meaning it can only ever fire for a genuinely valid, ready, not-already-in-flight CTA activation. This function is itself only reachable from the two buttons rendered exclusively when `state.status === "review_ready"`.

**CTA values:** a closed 2-value enum, `start_free` (mapped from the existing `"signup"` destination) and `log_in` (mapped from `"login"`) — no free text is ever sent.

**Client analytics pipeline used:** the existing `/api/analytics/event` route (§23.2) — not `lib/analytics/events.ts` (confirmed, on inspection, to be a wholly separate, Google-Ads-`gtag`-only conversion pixel with no `analytics_events`/`anonymous_id` concept at all, and therefore unusable for a funnel event that must eventually join with `demo_review_viewed` via a shared `anonymous_id`).

**Consent behavior:** inherited automatically and unmodified — this event flows through the exact same consent-gated pipeline `page_view` already uses (the beacon is only ever fired by client code that itself only runs post-consent, per this codebase's existing, untouched consent architecture). No unconditional server-side mirror was created to inflate counts, per this phase's explicit instruction; if analytics consent is not granted, this specific click signal is honestly absent, and the review's own success/failure — not to mention `demo_review_viewed` and (in a future phase) `demo_claim_saved` — remain available as stronger, server-authoritative signals.

**Owner exclusion:** inherited automatically and unmodified — `hasOwnerAnalyticsExclusionCookie` is already checked inside `/api/analytics/event/route.ts` for every event that route handles, `demo_account_cta_clicked` included, with zero new code. No `owner_flagged` metadata or filtering was added, per this phase's explicit scope limit — `demo_review_viewed` (a different route entirely) still carries the same known, already-documented limitation from Phase 1A: owner activity on the homepage-demo route tree is not excluded from that specific event.

**Navigation/failure behavior:** the analytics call is fire-and-forget (`void fetch(...).catch(() => {})`, never awaited), issued with `keepalive: true` so the beacon survives the page navigation that follows almost immediately, and placed concurrently with (not sequentially before) the claim/prepare request — it adds no latency and cannot block or delay claim preparation, signup, or login. Directly tested: an analytics fetch that rejects outright still results in the exact same successful navigation as the passing case.

**Fallback CTA decision:** the review screen's separate fallback "Start for free" link (rendered only when `state.status === "review_unavailable"` or `"review_expired"`, a plain `<Link href="/signup">` with no `intent` query param and no `onClick` handler at all — confirmed by direct inspection) is **deliberately excluded** from this event. It represents a semantically different action (a generic signup with nothing left to claim, not an activation from a valid ready result) and was already excluded from the claim-intent flow itself before this phase — extending the same reasoning to analytics keeps the funnel definition honest: `demo_account_cta_clicked` means "activated from a genuinely ready review," never anything else. Directly tested: clicking this fallback link produces zero analytics calls.

### 23.5 Production Behavior Changes

**Exactly two new observable side effects, both purely additive:**
1. A genuine `review_ready` response now also schedules one `demo_review_viewed` analytics row (fail-safe, does not affect the response itself).
2. Clicking "Start for free" or "Log in" on a ready review now also fires one best-effort `demo_account_cta_clicked` beacon (fail-safe, does not affect navigation).

**Explicitly confirmed unchanged:** UI copy, visual design, button labels, CTA destinations (`/signup?intent=homepage-demo-claim`, `/login?intent=homepage-demo-claim`), claim-preparation request/response handling, the fallback-CTA rendering and behavior, polling/backoff timing, and every other existing code path in both files — verified directly by tests asserting the exact pre-existing destinations and behaviors still hold.

### 23.6 Files Changed in Phase 1B

| File | Added/Modified | Purpose |
|---|---|---|
| `lib/analytics/internal-events.server.ts` | Modified | Added `demo_review_viewed`, `demo_account_cta_clicked` to the server-side canonical event allowlist |
| `app/api/analytics/event/route.ts` | Modified | Added `demo_account_cta_clicked` to the client-facing browser-event allowlist; added strictly-enum-validated `cta` metadata support for that one event only |
| `app/api/homepage-demo/review/route.ts` | Modified | Fires `demo_review_viewed` on the genuine `review_ready` success path only |
| `app/api/homepage-demo/review/route.test.ts` | Modified (extended) | 13 new Phase 1B tests added to the existing Phase 0A file |
| `app/homepage-demo/review/HomepageDemoReviewClient.tsx` | Modified | Fires `demo_account_cta_clicked` from `prepareClaimAndNavigate`, mapping destination → CTA enum |
| `app/homepage-demo/review/HomepageDemoReviewClient.test.tsx` | New | First test coverage for this component — 10 tests |
| `docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md` / `.docx` | Modified | This section |

**No other file was touched.** `app/admin/analytics/page.tsx` was not modified — confirmed by `git status`. `app/api/homepage-demo/claim/save/route.ts` and every other claim-flow file were not touched — `demo_claim_saved` remains entirely unimplemented, correctly deferred to Phase 1C.

### 23.7 Event Contract

| Event | Emitter | `anonymous_id` | `user_id` | Metadata | Idempotency | Consent behavior |
|---|---|---|---|---|---|---|
| `demo_review_viewed` | Server (`review/route.ts`) | `t2t_anon_id` value or `null` | always `null` | none | `demo_review_viewed:{draftId}` | Operational — fires unconditionally, matching the existing `homepage_demo_extract_*` classification |
| `demo_account_cta_clicked` | Client (`HomepageDemoReviewClient.tsx`) | resolved server-side from `t2t_anon_id`, same as `page_view` | always `null` | `{ source: "browser", cta: "start_free" \| "log_in" }` | none (best-effort; a genuine double-click is acceptable noise, and the existing double-submit guard already prevents it in practice) | Product analytics — subject to the existing consent-gated client pipeline, unchanged |

### 23.8 Privacy / Security

| Check | Result |
|---|---|
| Review token (public token) never enters analytics | PASS — verified by test; `pagePath` is a hardcoded route constant on both the server (`/api/homepage-demo/review`) and client (`/homepage-demo/review`) side, never `window.location.href`/`.hash` |
| URL hash never enters analytics | PASS — the client fragment is stripped via `removeReviewFragment()` long before any CTA click is possible (the button only renders once `state.status === "review_ready"`, which requires the fragment to have already been consumed); the analytics beacon additionally never reads `window.location` at all |
| Claim/public token never enters analytics | PASS |
| User-generated demo result (draft title, client fields, etc.) never enters analytics | PASS — verified by test asserting the analytics request body contains exactly `{event_name, page_path, cta}` and nothing else |
| Analytics cannot authorize review access | PASS — `demo_review_viewed` is a pure side effect of an already-successful, already-authorized response; it has no read/write path back into the review/claim system |
| Analytics cannot authorize claim access | PASS — same reasoning; `demo_account_cta_clicked` fires independently of, and has no effect on, `claim/prepare`'s own request |
| CTA analytics cannot block navigation | PASS — fire-and-forget, never awaited, `keepalive: true`; verified by test that a rejecting analytics fetch still results in identical navigation |
| Analytics failure cannot break review | PASS — verified by test |
| Idempotency key cannot expose internal bearer data | PASS — `draftId` is an internal database UUID, never transmitted to any client at any point, structurally distinct from the public/session/claim tokens |
| No RLS/service-role expansion | PASS — no new table, no new grant; `logAnalyticsEventSafe` already ran server-side with `supabaseAdmin` before this phase |

### 23.9 Backward Compatibility

Live Demo extraction (Phase 1A, untouched), review content/polling (untouched apart from the one additive analytics call), claim preparation (untouched), signup/login destinations (unchanged, directly tested), auth intent (untouched), claim save (not touched — deferred to Phase 1C), normal auth (untouched), all existing analytics events (`homepage_demo_extract_*`, `login_success`, `signup_success`, `page_view` — all unchanged in shape or behavior), old analytics rows (unaffected, no migration), admin analytics (`app/admin/analytics/page.tsx`, confirmed untouched by `git status`), rate limiting and Turnstile (not touched — this phase never enters the extract/admission code path at all), and the database schema (no migration, no RLS/RPC change).

### 23.10 Test Results

- Targeted: `npx vitest run app/api/homepage-demo/review/route.test.ts` → **23/23 passed** (10 pre-existing + 13 new). `npx vitest run app/homepage-demo/review/HomepageDemoReviewClient.test.tsx` → **10/10 passed** (new file).
- Related-area: `npx vitest run app/api/homepage-demo app/homepage-demo app/api/analytics app/api/auth app/auth lib/analytics app/admin/analytics` → **20 test files, 239 tests, all passed.**
- Full suite: `npm test` → **208 test files, 5,348 tests, all passed** (+23 over the Phase 1A baseline of 5,325, exactly matching the 13 + 10 new tests; +1 file, matching the one new test file).
- `npx tsc --noEmit`: clean (one type error surfaced during development — an implicit-`any` index signature in the new test file's mock headers object — fixed immediately, re-verified clean).
- `eslint` on all 6 changed/new files: clean.
- `npm run build`: succeeded, full route table generated, no errors.

**Passed: 5,348 / Failed: 0 / Skipped: 0.** No pre-existing failure surfaced.

### 23.11 Discovered Issues — Not Fixed

**NONE** newly discovered in production code. One environment-level testing quirk was found and worked around (not a product issue): in this project's vitest/jsdom test environment, `TextEncoder.prototype.encode()`'s return value fails `instanceof Uint8Array` checks against the realm's own `Uint8Array` binding, despite `constructor.name` and `Object.prototype.toString` both correctly reporting `"Uint8Array"` — confirmed empirically via isolated diagnostic tests. This only affects test-double construction (the new `HomepageDemoReviewClient.test.tsx`'s mock `Response` bodies) and has zero relationship to any production code path; the test file works around it by constructing mock byte payloads via plain `Uint8Array.from(text, charCodeAt)` instead of `TextEncoder`, which is unaffected. Documented here for future test authors in this codebase who may hit the same quirk.

(The pre-existing, already-documented owner-exclusion limitation for homepage-demo events, carried forward from Phase 1A, is not repeated here as a new finding — see §21.11.)

### 23.12 Git Status After Phase 1B

```
 M app/api/analytics/event/route.ts                     <- THIS PHASE (1B)
 M app/api/auth/login/route.test.ts                     <- Phase 0A/0B, untouched this phase
 M app/api/auth/login/route.ts                           <- Phase 0B, untouched this phase
 M app/api/homepage-demo/extract/route.ts                <- Phase 1A, untouched this phase
 M app/api/homepage-demo/review/route.ts                 <- THIS PHASE (1B)
 M app/auth/oauth/callback/route.test.ts                 <- Phase 0A, untouched this phase
 M app/homepage-demo/review/HomepageDemoReviewClient.tsx <- THIS PHASE (1B)
 M lib/analytics/internal-events.server.ts               <- THIS PHASE (1B)
?? app/api/auth/signup/route.test.ts                     <- Phase 0A, untouched this phase
?? app/api/homepage-demo/claim/prepare/route.test.ts     <- Phase 0A, untouched this phase
?? app/api/homepage-demo/claim/save-anyway/route.test.ts <- Phase 0A, untouched this phase
?? app/api/homepage-demo/claim/save/route.test.ts        <- Phase 0A, untouched this phase
?? app/api/homepage-demo/extract/route.test.ts           <- Phase 1A (extended this phase's own test run only for verification; content unchanged since Phase 1A)
?? app/api/homepage-demo/review/route.test.ts            <- THIS PHASE (1B, extended)
?? app/auth/confirm/route.test.ts                        <- Phase 0A, untouched this phase
?? app/homepage-demo/review/HomepageDemoReviewClient.test.tsx  <- THIS PHASE (1B, new)
?? docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.docx  <- cumulative
?? docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md   <- cumulative
```

Branch: `main`. HEAD: `ba60696` (unchanged since before Phase 0A — no commit has been made across any phase of this milestone so far). Nothing staged.

### 23.13 Continuation Point

If this conversation is lost, a future session should:
1. Read this document in full, specifically this §23 for the current state.
2. Run `git status` and confirm the exact 16 files in §23.12 are still the only ones modified/untracked.
3. Re-run `npm test` to confirm the full 5,348-test suite still passes before proceeding.
4. Await explicit instruction before beginning Phase 1C — this milestone intentionally stops here.

---

## 24. Next Approved Milestone (superseded — see §25/§26)

**PHASE 1C — CLAIM SAVED TELEMETRY**

~~**NOT STARTED.**~~ Superseded by §25 below — Phase 1C is now complete. This section is preserved for history; do not treat it as current.

---

## 25. PHASE 1C — CLAIM SAVED TELEMETRY (2026-09-03)

### 25.1 Scope

Implement exactly one new server-authoritative event, `demo_claim_saved`, as the final conversion milestone of the Live Demo funnel: "the authoritative server-side claim lifecycle confirms that this demo has successfully become a saved authenticated account asset." Emitted only from the two existing claim-completion routes (`claim/save`, `claim/save-anyway`) on a genuine successful outcome. Zero changes to claim security, duplicate detection, importer semantics, TTLs, consent design, or UX/copy/navigation. Zero DB/Supabase/RLS/RPC/migration changes.

### 25.2 Re-traced Authoritative Claim Path

Read both route implementations, their shared repository helpers (`lib/homepage-demo/claim-save-repository.server.ts`, `lib/homepage-demo/claim-duplicate-override-repository.server.ts`), and the actual RPC SQL (`supabase/migrations/202607020002_homepage_demo_claim_save_rpc.sql`, `supabase/migrations/202607020003_homepage_demo_duplicate_override_authority.sql`) rather than assuming outcome names from prior reports. Confirmed real outcome set:

- `claim_homepage_demo_project` RPC (used by `claim/save`): `saved`, `already_claimed`, `duplicate_detected`, `expired`, `invalid_claim`, `draft_unavailable`.
- `claim_homepage_demo_project_with_duplicate_override` RPC (used by `claim/save-anyway`): the same set plus `duplicate_authority_unavailable`, `duplicate_authority_expired`. Internally it delegates to the RPC above in one transaction (SQL lines 590–602 of the second migration) after validating the override authority, so both routes converge on the exact same underlying claim row and the exact same `saved`/`already_claimed` decision logic.
- A **third** genuine success path exists in `claim/save` itself: when a duplicate is detected, `prepareHomepageDemoDuplicateOverride` (the "prepare" RPC) can itself report `already_claimed` (someone else — or the same request, racing — already completed the claim between the duplicate check and the prepare call). This is mapped in `mapDuplicateOverridePreparationResult` and also now schedules the milestone.

### 25.3 Event Semantics (Part 2/3/4 of the request)

`demo_claim_saved` belongs only to states where the claim is genuinely, successfully completed:

| Outcome | Route/path | Emits `demo_claim_saved`? |
|---|---|---|
| `saved` (first save) | `claim/save`, `claim/save-anyway` | **Yes** |
| `already_claimed` (RPC-level idempotent replay) | `claim/save`, `claim/save-anyway` | **Yes** — see §25.4 |
| `already_claimed` (via duplicate-override "prepare" RPC) | `claim/save` only | **Yes** — see §25.4 |
| `duplicate_detected` | `claim/save`, `claim/save-anyway` | **No** — not a completed conversion, only an override prompt |
| `expired`, `invalid_claim`, `draft_unavailable`, `duplicate_authority_unavailable`, `duplicate_authority_expired` | either route | **No** |
| Unauthenticated (401), malformed request | either route | **No** |
| RPC/repository failure (thrown error) | either route | **No** |

### 25.4 First Save vs. Already-Claimed Replay — Safety Verification

The RPC SQL was read directly (not assumed) to verify Part 3's safety requirement. In `claim_homepage_demo_project` (lines 92–110 of the migration):

```sql
if v_claim.status = 'claimed' then
  if v_claim.claimed_by_user_id is distinct from p_authenticated_user_id
    or v_claim.saved_project_id is null
    or v_claim.claimed_at is null then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;
  return query select 'already_claimed'::text, v_claim.saved_project_id, false;
  return;
end if;
```

`already_claimed` is **only** returned when the claim's `claimed_by_user_id` exactly matches the *current* request's authenticated user (row-locked via `for update`). Any other case — a different user, or a claim that was never actually completed — is reported as `invalid_claim` instead, which this phase's tests confirm never emits the event. The same guarantee holds verbatim inside `claim_homepage_demo_project_with_duplicate_override` (lines 466–484 of the second migration), which contains an identical check before ever consuming an override authority. **Conclusion: `already_claimed` unambiguously represents the same authenticated actor re-confirming their own already-completed claim and can never represent a cross-user or invalid state.** It is therefore safe — and was implemented — to treat it as eligible for the same idempotent milestone as a first save, using the same idempotency key, so that an analytics failure on the original successful request can be self-healed by a later idempotent replay.

### 25.5 Save-Anyway Path

A successful save-anyway (`saved` or `already_claimed` outcome from `claim_homepage_demo_project_with_duplicate_override`) also emits the milestone, using the identical `demo_claim_saved:{claimId}` idempotency namespace as the normal save route for the same underlying claim (see §25.6) — a normal save and a save-anyway retry for the same claim can never produce two milestone rows.

### 25.6 Authoritative Emitter and Idempotency Design

**Emission point:** server-side only, inside `mapClaimSaveResult`/`mapClaimSaveAnywayResult`/`mapDuplicateOverridePreparationResult` in each route, immediately after the RPC/repository call has already returned a confirmed successful outcome and immediately before constructing the success response. Never before authentication, claim validation, duplicate resolution, or RPC/import success.

**Idempotency key:** `demo_claim_saved:{claimId}`, where `claimId` is the claim row's own internal database `id` (UUID) — not any token or token hash. This value was not previously returned by `loadHomepageDemoClaimSaveSource`; `lib/homepage-demo/claim-save-repository.server.ts`'s `HomepageDemoClaimSaveSource` type was widened (both `"pending"` and `"rpc_replay"` variants) to surface `claimId: claim.id`, which the function already fetches internally via `loadClaimByHash` — no new query, no RPC/migration change. Because both `claim/save` and `claim/save-anyway` call the same `loadHomepageDemoClaimSaveSource({ claimTokenHash })` for the same claim cookie, both routes resolve to the identical `claimId` for the same underlying claim, guaranteeing the cross-route idempotency invariant required by Part 15. Reuses the existing `analytics_events.idempotency_key` partial unique index — no migration.

**Why safe:** `claim.id` is a stable, internal, server-only UUID — never exposed to the client, never derived from the claim/public/session/duplicate-override bearer tokens (those are only ever handled as their own SHA-256 hashes, and even those hashes are never used here).

### 25.7 User Identity

`userId` is always the trusted, server-verified `user.id` from `supabase.auth.getUser()` — the exact same value already used as `authenticatedUserId` for the RPC call itself. No request body/query field can influence it; tests explicitly prove a client-supplied `user_id` in the JSON body is ignored.

### 25.8 Anonymous Funnel Identity

`anonymousId` reuses `readAnonymousIdCookie(request)` (same `t2t_anon_id` architecture as Phases 1A/1B). Read at the very top of each route (before the try block), consistent with the Phase 1B convention. Absent cookie → `anonymousId: null`; the claim still saves normally — confirmed by test.

### 25.9 Metadata Decision (Part 9)

Deliberately minimal: `{ duplicate_override: boolean }` only — `false` for the normal `claim/save` route (including its `already_claimed`-via-prepare-RPC branch, since no override authority was ever consumed there), `true` for every success reported by `claim/save-anyway`. No `outcome` (`created` vs. `already_claimed`) field was added: the milestone is deliberately defined to mean "successfully saved" as a single collapsed fact, and distinguishing outcome in metadata would invite future downstream code to re-fragment the very count this idempotent design exists to protect. No user content, no tokens, no free text.

### 25.10 Event Allowlist

`demo_claim_saved` added to `ALLOWED_EVENT_NAMES` in `lib/analytics/internal-events.server.ts` only. **Not** added to `ALLOWED_BROWSER_EVENTS` in `app/api/analytics/event/route.ts` — the browser cannot submit this event; it is server-authoritative only.

### 25.11 Failure Safety

Every call site wraps scheduling and the `after()`-deferred `logAnalyticsEventSafe` call in nested try/catch, matching the Phase 1B pattern exactly. Verified by test: an analytics-layer rejection never changes the claim response body or status code.

### 25.12 Owner Exclusion / Consent (Parts 17–18)

Not implemented, per explicit instruction. `demo_claim_saved` is emitted for all successful claims regardless of whether the claiming account is later determined to be an internal/owner account — deferred to Phase 1D, same limitation already documented for Phases 1A/1B. Consent is not applicable to this specific event in the way it is for `demo_account_cta_clicked`: this is a server-authoritative operational/product-analytics fact recorded the same way `login_success`/`signup_success` already are, with no client mirror and no new legal claim made.

### 25.13 Production Behavior Change

Exactly one new, purely additive side effect: a genuine successful claim (first save, idempotent replay, or save-anyway) now also logs one `demo_claim_saved` row. **Claim cookie behavior, authentication checks, claim ownership, duplicate detection, save-anyway semantics, the importer, project/task results, response bodies (except the documented additive analytics side effect, which produces no response-shape change), status codes, redirect behavior, auth intent, signup, login, Google OAuth, email confirmation, and billing are all explicitly unchanged** — confirmed by the full existing Phase 0A/1A/1B test suites continuing to pass unmodified in content.

### 25.14 Files Changed in Phase 1C

| File | Added/Modified | Purpose |
|---|---|---|
| `lib/analytics/internal-events.server.ts` | Modified | Server allowlist: `demo_claim_saved` |
| `lib/homepage-demo/claim-save-repository.server.ts` | Modified | Surface `claimId` (claim row's internal id) on `HomepageDemoClaimSaveSource` |
| `app/api/homepage-demo/claim/save/route.ts` | Modified | Fires `demo_claim_saved` on saved / already_claimed (both branches) |
| `app/api/homepage-demo/claim/save/route.test.ts` | Modified (extended) | +21 tests |
| `app/api/homepage-demo/claim/save-anyway/route.ts` | Modified | Fires `demo_claim_saved` on saved / already_claimed |
| `app/api/homepage-demo/claim/save-anyway/route.test.ts` | Modified (extended) | +13 tests |
| `docs/...Master_Handoff...md` / `.docx` | Modified | This §25/§26 |

No other file touched — `app/admin/analytics/page.tsx`, TTL logic, consent code, and both RPC/migration SQL files were read but not modified.

### 25.15 Event Contract

| | `demo_claim_saved` |
|---|---|
| Emitter | Server only (`claim/save`, `claim/save-anyway`) |
| anonymous_id | `t2t_anon_id` cookie value, or `null` |
| user_id | Trusted authenticated `user.id`, never client-supplied |
| metadata | `{ duplicate_override: boolean }` |
| Idempotency | `demo_claim_saved:{claimId}` — shared across save and save-anyway for the same claim |
| Consent behavior | Not a client event; no consent gate applies (matches `login_success`/`signup_success` convention) |
| Owner behavior | Not filtered — recorded for all successful claims, deferred to Phase 1D |

### 25.16 Privacy / Security

| Check | Result |
|---|---|
| No pasted demo text / extracted tasks / project title / client PII in event | PASS |
| No raw or hashed claim/public/session/duplicate-override token in event | PASS |
| No URL hash, authorization header, or arbitrary cookie value in event | PASS |
| Analytics cannot influence claim ownership, RPC outcome, or response | PASS |
| Analytics cannot block the claim response (failure-injected test) | PASS |
| Idempotency key exposes no bearer material (internal DB UUID only) | PASS |
| No RLS/service-role/migration change | PASS |

### 25.17 Backward Compatibility

Explicitly confirmed unchanged by test and manual re-trace: claim cookie behavior, authentication checks, claim ownership rules, duplicate detection, save-anyway semantics, the importer, project/task results, response bodies/status codes, redirect behavior, auth intent, signup, login, Google OAuth, email confirmation, billing, trial/claim/TTL lifecycle.

### 25.18 Test Results

- **Targeted:** `npx vitest run app/api/homepage-demo/claim/save/route.test.ts` → 38/38 passed (17 original + 21 new). `npx vitest run app/api/homepage-demo/claim/save-anyway/route.test.ts` → 26/26 passed (13 original + 13 new).
- **Related:** `npx vitest run app/api/homepage-demo app/homepage-demo app/api/analytics app/api/auth app/auth lib/analytics app/admin/analytics lib/homepage-demo` → 20 files, 273 tests, all passed.
- **Full:** `npm test` → **208 test files, 5,382 tests, all passed** (+34 over the 5,348 Phase 1B baseline).
- **Typecheck:** `npx tsc --noEmit` → clean.
- **Lint:** `npx eslint` on all 6 changed/new files → clean.
- **Build:** `npm run build` → succeeded.

Passed: 5,382 / Failed: 0 / Skipped: 0.

### 25.19 Database / Infrastructure

Supabase: **NO** · Migration: **NO** · RLS: **NO** · RPC: **NO** (both RPC SQL files were read for verification only, not modified) · Environment: **NO** · Vercel: **NO**

### 25.20 Discovered Issues — Not Fixed

**NONE.** No new issues were found during this phase's re-trace of the claim/save and claim/save-anyway routes. The already-documented, still-deferred limitations (owner-exclusion coverage gap from Phase 1A; the email-confirmation TTL continuity concern) remain unchanged and out of scope, per explicit instruction.

### 25.21 Current Funnel Coverage (Part R)

| Stage | Event | Emitter | Phase |
|---|---|---|---|
| Demo Extract Attempt | `homepage_demo_extract_attempt` | Server | Pre-existing, enriched with `anonymous_id` in 1A |
| Demo Extract Success | `homepage_demo_extract_succeeded` | Server | Pre-existing, enriched with `anonymous_id` in 1A |
| Review Viewed | `demo_review_viewed` | Server | 1B |
| Account CTA Clicked | `demo_account_cta_clicked` | Client (best-effort, consent-gated) | 1B |
| Auth Completed | `login_success` / `signup_success` | Server | 0B / pre-existing |
| **Claim Saved** | **`demo_claim_saved`** | **Server** | **1C (this phase)** |

The full first-party, server-authoritative-where-it-matters funnel from anonymous demo input through to a saved authenticated account asset is now observable end to end.

### 25.22 Full Worktree Snapshot (end of Phase 1C)

Branch: `main`. HEAD: `ba60696` (unchanged since before Phase 0A — no commit has been made across any phase of this milestone). Nothing staged.

```
 M app/api/analytics/event/route.ts                      <- Phase 1B, untouched this phase
 M app/api/auth/login/route.test.ts                       <- Phase 0B, untouched this phase
 M app/api/auth/login/route.ts                             <- Phase 0B, untouched this phase
 M app/api/homepage-demo/claim/save-anyway/route.ts       <- THIS PHASE (1C)
 M app/api/homepage-demo/claim/save/route.ts               <- THIS PHASE (1C)
 M app/api/homepage-demo/extract/route.ts                 <- Phase 1A, untouched this phase
 M app/api/homepage-demo/review/route.ts                   <- Phase 1B, untouched this phase
 M app/auth/oauth/callback/route.test.ts                   <- Phase 0A, untouched this phase
 M app/homepage-demo/review/HomepageDemoReviewClient.tsx   <- Phase 1B, untouched this phase
 M lib/analytics/internal-events.server.ts                 <- THIS PHASE (1C, extended; also touched 1B)
 M lib/homepage-demo/claim-save-repository.server.ts       <- THIS PHASE (1C, new modification)
?? app/api/auth/signup/route.test.ts                       <- Phase 0A, untouched this phase
?? app/api/homepage-demo/claim/prepare/route.test.ts       <- Phase 0A, untouched this phase
?? app/api/homepage-demo/claim/save-anyway/route.test.ts   <- THIS PHASE (1C, extended; created Phase 0A)
?? app/api/homepage-demo/claim/save/route.test.ts          <- THIS PHASE (1C, extended; created Phase 0A)
?? app/api/homepage-demo/extract/route.test.ts             <- Phase 1A, untouched this phase
?? app/api/homepage-demo/review/route.test.ts               <- Phase 1B, untouched this phase
?? app/auth/confirm/route.test.ts                           <- Phase 0A, untouched this phase
?? app/homepage-demo/review/HomepageDemoReviewClient.test.tsx  <- Phase 1B, untouched this phase
?? docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.docx  <- cumulative
?? docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md   <- cumulative
```

### 25.23 Continuation Point

If this conversation is lost, a future session should:
1. Read this document in full, specifically this §25 for the current state.
2. Run `git status` and confirm the exact 17 files in §25.22 are still the only ones modified/untracked.
3. Re-run `npm test` to confirm the full 5,382-test suite still passes before proceeding.
4. Await explicit instruction before beginning Phase 1D — this milestone intentionally stops here.

---

## 26. Next Approved Milestone (superseded — see §27/§28)

**PHASE 1D — BUSINESS FUNNEL CLASSIFICATION, OWNER EXCLUSION + ADMIN FUNNEL ARCHITECTURE/IMPLEMENTATION**

~~**NOT STARTED.**~~ Superseded by §27 below — Phase 1D is now complete. This section is preserved for history; do not treat it as current.

---

## 27. PHASE 1D — BUSINESS FUNNEL CLASSIFICATION, OWNER EXCLUSION + ADMIN FUNNEL (2026-09-03)

### 27.1 Scope

Two tightly related deliverables: (1) a clear, tested separation between **operational health** telemetry (all Live Demo traffic, owner included) and **business conversion** analytics (identifiable owner traffic excluded), with a server-derived `owner_flagged` tag on the relevant events; (2) a production Admin "Live Demo Conversion" view built only from metrics the current architecture can honestly support, replacing no existing functionality and adding no new database objects.

### 27.2 Re-audit Findings (Part 1)

- `lib/analytics/owner-exclusion.server.ts` (`t2t_owner_analytics_excluded`, exact value `"1"`, httpOnly, 180-day, set only from a server-verified owner login in `app/api/auth/login/route.ts` / `app/auth/oauth/callback/route.ts`) is the one existing owner-trust mechanism. Reused as-is; no second owner cookie was introduced.
- `app/api/analytics/event/route.ts` already uses this cookie to **suppress ingestion entirely** for the browser-fired events (`page_view`, `demo_account_cta_clicked`) — an owner browser's CTA clicks are never stored at all, not merely filtered at read time. This is pre-existing behavior, confirmed by re-reading the route, and was deliberately left unchanged (see §27.5).
- `login_success` (`app/api/auth/login/route.ts`) had neither `anonymous_id` nor any demo-intent signal — the one genuine attribution gap identified for Part 9/10. `signup_success` (`lib/analytics/signup-attribution.server.ts`) already carries `anonymous_id` via `readRequestAttribution`, so no change was made there.
- `homepage_demo_trials` (`supabase/migrations/202606270002_homepage_demo_trials.sql`) has a plain `created_at` column and no owner concept; a `count: "exact", head: true` query against it is exact at any volume and exposes no hashes (no rows are ever returned in `head: true` mode). `homepage_demo_admission_attempts` was reviewed but not surfaced as a metric — it is a lower-level per-request throttling ledger with no additional business-reporting value beyond what `homepage_demo_trials` and the existing funnel events already provide.
- The existing `app/admin/analytics/page.tsx` "Live Demo usage" section already used a bounded-row query (`LIVE_DEMO_ROWS_LIMIT = 5000`) with no truncation signal to the reader — identified as the Part 17 risk and addressed by labeling, not by a query-architecture rewrite (see §27.10).

### 27.3 Two Data Planes (Part 2)

The SAME stored events participate in both planes — no duplicate event stream was created:

| | Operational Health | Business Conversion |
|---|---|---|
| Purpose | "Is the Live Demo system working?" | "How are real prospects converting?" |
| Owner traffic | Included | Excluded (identifiable owner only) |
| Source events | `homepage_demo_extract_attempt/succeeded/failed` (unfiltered) | `homepage_demo_extract_attempt/succeeded` + `demo_review_viewed` + `demo_account_cta_clicked` + `demo_claim_saved`, owner-excluded |
| Admin section | "Live Demo Health" | "Live Demo Conversion" + "Conversion breakdown" |

### 27.4 Owner Classification Design (Part 3)

Server-authoritative events remain **stored regardless of owner status** — only tagged. Each event-emitting route computes `const ownerFlagged = hasOwnerAnalyticsExclusionCookie(request);` once (identical convention to `anonymousId`) and merges `owner_flagged: boolean` into its existing metadata. No ingestion suppression was added to any server-authoritative route.

**Tagged events** (Part 4): `homepage_demo_extract_attempt`, `homepage_demo_extract_succeeded`, `homepage_demo_extract_failed` (`app/api/homepage-demo/extract/route.ts`), `demo_review_viewed` (`app/api/homepage-demo/review/route.ts`), `demo_claim_saved` (`app/api/homepage-demo/claim/save/route.ts` and `claim/save-anyway/route.ts`, on every success path including the duplicate-override-prepare `already_claimed` branch).

**`demo_account_cta_clicked` was deliberately NOT given `owner_flagged` metadata.** Its actual, unchanged behavior: when the owner-exclusion cookie is present, `/api/analytics/event` returns 204 without ever calling `logAnalyticsEventSafe` — the row is never created, so there is nothing to tag. This asymmetry is intentional and documented, not "fixed" into false symmetry, per the explicit instruction not to casually change global client owner-exclusion semantics. Proven by test (`app/api/analytics/event/route.test.ts`, "demo_account_cta_clicked owner exclusion").

### 27.5 Owner Exclusion Across a Funnel (Part 5)

Implemented as a pure, in-memory, **window-scoped** aggregation rule in `lib/analytics/live-demo-funnel.ts` — no backfill, no mutation of stored rows:

1. `buildKnownOwnerAnonymousIds(rows)` collects every non-null `anonymous_id` that carries `metadata.owner_flagged === true` on ANY row in the currently-loaded dataset.
2. `excludeKnownOwnerRows(rows, ownerAnonymousIds)` drops a row if it is itself flagged, OR if its `anonymous_id` is in that set — propagating exclusion backward to earlier funnel stages (e.g. an owner's `homepage_demo_extract_succeeded` from before they logged in is excluded once their later `demo_claim_saved` reveals the same anonymous_id as owner).
3. A `null` `anonymous_id` never participates in propagation in either direction (it cannot be correlated to anything) — only a row that is itself directly flagged is excluded.

**Documented, un-solved limitation (exactly as instructed not to solve):** owner testing in a fresh/incognito browser that never reaches a verified owner login is never flagged and is not excluded from business metrics — no IP filtering, User-Agent, or fingerprinting was added or considered. This is stated directly in the Admin UI ("Fresh/incognito owner testing that never reaches a verified login cannot be reliably excluded.").

### 27.6 Historical Data (Part 6)

No backfill was performed or considered. The Admin UI carries a fixed, concise note: *"Owner filtering applies to traffic identifiable by the current production exclusion mechanism (a verified owner login sets a trusted browser cookie); older or unidentified activity may remain in historical totals."*

### 27.7 Metric Definitions (Part 7)

| Metric | Unit | Unique? | Null-identity treatment |
|---|---|---|---|
| Demo attempts / successful demos | Raw event occurrences | No | n/a |
| Review reached / claims saved | Raw event occurrences (already idempotent per draft/claim from Phases 1B/1C) | No | n/a |
| Correlated / uncorrelated demos, review reached | Distinct non-null `anonymous_id` vs. count of null-`anonymous_id` rows | Anonymous browser context, not a person | Null values are NEVER grouped into one browser — each null-`anonymous_id` row is counted individually as uncorrelated |
| Unique demo trials | Exact DB count of `homepage_demo_trials` rows in window | Trial record, not a person | n/a |
| Authenticated users (with claim saved) | Distinct trusted `user_id` among `demo_claim_saved` rows | Real authenticated account | n/a |

The wording "unique people" is never used anywhere on the page (asserted by test).

### 27.8 CTA Consent Treatment (Part 8)

`lib/analytics/live-demo-funnel.ts`'s `buildLiveDemoConversionCounts` **never computes any rate using `observedCtaClicks` as numerator or denominator** — structurally, the returned type has no such field, locked by a dedicated unit test. Rates are computed only among the three server-authoritative milestones (attempts, successful demos → review reached, successful demos → claims saved). Observed CTA clicks are shown as a bare count, explicitly labeled "observed... client-fired, best-effort, and depend on analytics consent" in the section description. Verified end-to-end by an Admin UI test with 0 CTA clicks and 1 claim saved: the claims-saved rate correctly shows 100% (against successful demos), never an undefined/Infinity value from a zero CTA denominator.

### 27.9 Auth Attribution (Part 9/10)

`signup_success` already carries `anonymous_id` (pre-existing) and needed no change. `login_success` had neither `anonymous_id` nor any demo-signal — the one identified, narrow, justified enrichment:

```ts
scheduleLoginSuccessAnalytics(
  data.user.id,
  readAnonymousIdCookie(request),         // already-existing first-party cookie
  homepageDemoClaimIntent !== null        // already-existing, already-parsed closed intent
);
```

Both values were already present in trusted request context for other purposes (the redirect-destination logic) before this phase; no schema change, no auth-behavior change, no new funnel identifier. `metadata: { demo_intent: boolean }` and `anonymousId` were added to the existing `login_success` event only. Covered by 5 new tests. **The Admin funnel deliberately does NOT include a first-class "Auth completed" stage** — `login_success`/`signup_success` correlation to a specific demo journey remains best-effort (shared `anonymous_id`/intent, not a hard join), and Part 11 designates only attempts → successful demos → review reached → claims saved as the authoritative/observed funnel actually rendered; auth completion is available in the existing "Tracked traffic" and "login_success" analytics but was not built into a new dedicated funnel stage this phase, to avoid overstating certainty. This is a deliberate scope decision, not an oversight.

### 27.10 The Authoritative Funnel (Part 11)

| Stage | Status | Why |
|---|---|---|
| Demo attempts | Authoritative | Server-recorded on every request |
| Successful demos | Authoritative | Server-recorded, gated on real extraction success |
| Review reached | Authoritative | Server-authoritative, idempotent per draft (Phase 1B) |
| Claims saved | Authoritative | Server-authoritative, idempotent per claim (Phase 1C) |
| Observed CTA clicks | Supplemental/observed | Client, best-effort, consent-gated |

### 27.11 Query Architecture / Scale (Part 17)

- **Unique demo trials**: exact `count: "exact", head: true` query — no rows transferred, no truncation risk at any volume.
- **Operational Health totals** (`liveDemoRows`): unchanged pre-existing bounded-row query (`LIVE_DEMO_ROWS_LIMIT = 5000`); now labeled with a truncation note when `rows.length >= limit` (`isPossiblyTruncated`), which it was not before.
- **Business Conversion / breakdown** (`liveDemoFunnelSupplementRows`, new `LIVE_DEMO_FUNNEL_SUPPLEMENT_ROWS_LIMIT = 5000`): requires row-level `anonymous_id`/`owner_flagged` data for the propagation rule in §27.5, so it cannot be reduced to a DB-side exact count without new DB objects. Uses the same bounded-row + truncation-label pattern.
- **`homepage_demo_extract_attempt`/`succeeded` rows are NOT re-queried** for the business section — the already-loaded `liveDemoRows` are reused and merged with the new supplement rows in-memory, avoiding a duplicate query for the same event data.

**DATABASE AGGREGATION CHANGE RECOMMENDED (not implemented):** if Live Demo volume routinely exceeds ~5,000 relevant events within a 30-day window, both the Health and Conversion sections would benefit from a dedicated read-side SQL view or RPC performing exact, DB-side aggregation (counts, distinct `anonymous_id`, owner exclusion) instead of bounded-row application aggregation. Proposed change: an additive, read-only view/function; no existing table/RLS change. Rollback risk: low (drop view/function, revert to current application aggregation). **Not implemented — requires separate approval.**

### 27.12 Admin UI (Part 13)

Three sections, in this order: **Live Demo Conversion** (period cards: successful demos, attempts, review reached + rate, observed CTA clicks, claims saved + rate, correlated/uncorrelated) → **Conversion breakdown** (start_free vs. log_in CTA counts, normal-save vs. save-anyway counts, unique demo trials, owner-exclusion/historical note, truncation note if applicable) → **Live Demo Health** (renamed from "Live Demo usage"; unchanged attempts/succeeded/failed period stats, failure-stage table, recent-events table; description now explicitly states it includes owner/admin traffic; truncation note added).

### 27.13 Owner Metadata Validation (Part 19)

`owner_flagged` is computed server-side only, from the httpOnly cookie, on every tagged route — never accepted from client input. `/api/analytics/event/route.ts`'s `getEventMetadata` still only ever returns `{source: "browser"}` or `{source: "browser", cta}}` — it does not read any other client body field into metadata, so a client cannot inject `owner_flagged` even by attempting to. Proven by test: a request body containing `owner_flagged: false` produces metadata with no such key at all. A parallel test proves a claim/save request body containing `owner_flagged: true` is ignored (the route never reads owner status from the body in the first place — only from the cookie).

### 27.14 Production Behavior Change

Purely additive: five existing server events now also carry `owner_flagged` metadata; `login_success` now also carries `anonymousId` and `metadata.demo_intent`; the Admin page has a new "Live Demo Conversion" + "Conversion breakdown" section and a renamed "Live Demo Health" section. No public UX, copy, navigation, TTL, claim security, duplicate detection, or importer semantics changed anywhere.

### 27.15 Files Changed in Phase 1D

| File | Added/Modified | Purpose |
|---|---|---|
| `lib/analytics/live-demo-funnel.ts` | Added | Pure business-funnel aggregation + owner-exclusion propagation |
| `lib/analytics/live-demo-funnel.test.ts` | Added | 19 unit tests |
| `app/api/homepage-demo/extract/route.ts` | Modified | `owner_flagged` on all 3 events |
| `app/api/homepage-demo/extract/route.test.ts` | Modified (extended) | +5 tests |
| `app/api/homepage-demo/review/route.ts` | Modified | `owner_flagged` on `demo_review_viewed` |
| `app/api/homepage-demo/review/route.test.ts` | Modified (extended) | +2 tests |
| `app/api/homepage-demo/claim/save/route.ts` | Modified | `owner_flagged` on `demo_claim_saved` (all success paths) |
| `app/api/homepage-demo/claim/save/route.test.ts` | Modified (extended) | +4 tests |
| `app/api/homepage-demo/claim/save-anyway/route.ts` | Modified | `owner_flagged` on `demo_claim_saved` |
| `app/api/homepage-demo/claim/save-anyway/route.test.ts` | Modified (extended) | +2 tests |
| `app/api/auth/login/route.ts` | Modified | `anonymousId` + `metadata.demo_intent` on `login_success` |
| `app/api/auth/login/route.test.ts` | Modified (extended) | +5 tests |
| `app/api/analytics/event/route.ts` | Modified | No behavior change; audited/confirmed only (see §27.4) — file otherwise untouched from Phase 1B |
| `app/api/analytics/event/route.test.ts` | Modified (extended) | +2 tests |
| `app/admin/analytics/page.tsx` | Modified | New Conversion/breakdown sections, renamed Health section, new queries |
| `app/admin/analytics/page.test.tsx` | Modified (extended) | +14 tests |
| `docs/...Master_Handoff...md` / `.docx` | Modified | This §27/§28 |

*(Note: `app/api/analytics/event/route.ts` is listed as "Modified" in `git status` only because it was already modified in Phase 1B; Phase 1D made no further edits to it — confirmed by re-reading the file, which is unchanged from the Phase 1B version.)*

### 27.16 Test Results

- **Targeted (owner classification + aggregation):** `lib/analytics/live-demo-funnel.test.ts` → 19/19.
- **Targeted (route enrichment):** extract 5/5 new (58/58 total), review 2/2 new, claim/save 4/4 new (38/38 total unaffected + new), claim/save-anyway 2/2 new, login 5/5 new, analytics event 2/2 new.
- **Admin:** `app/admin/analytics/page.test.tsx` → 21/21 (7 original + 14 new).
- **Related:** `npx vitest run app/api/homepage-demo app/homepage-demo app/api/analytics app/api/auth app/auth lib/analytics app/admin/analytics lib/homepage-demo` → 21 files, 326 tests, all passed.
- **Full:** `npm test` → **209 test files, 5,435 tests, all passed** (+53 over the 5,382 Phase 1C baseline; +1 new test file).
- **Typecheck:** `npx tsc --noEmit` → clean.
- **Lint:** clean on all 15 changed/new files.
- **Build:** `npm run build` → succeeded.

Passed: 5,435 / Failed: 0 / Skipped: 0.

### 27.17 Security / Privacy (Part 20)

| Check | Result |
|---|---|
| No raw anonymous cookie value exposed in Admin UI | PASS |
| No session/device/claim/draft hash exposed | PASS |
| No user email exposed beyond pre-existing authorized views | PASS |
| No demo text / extracted project/task data exposed | PASS |
| No bearer/public token or URL hash exposed | PASS |
| `owner_flagged` is server-derived only, never client-trusted | PASS |
| Admin conversion analytics remain aggregate (no user-level tracking UI added) | PASS |
| `homepage_demo_trials` count query returns no rows/hashes (head:true) | PASS |

### 27.18 Database / Infrastructure

Supabase: **NO** · Migration: **NO** · View: **NO** · RPC: **NO** · RLS: **NO** · Environment: **NO** · Vercel: **NO**. (See §27.11 for the reported-but-not-implemented future DB aggregation recommendation.)

### 27.19 Discovered Issues — Not Fixed

**NONE new.** The Phase 1A owner-exclusion coverage gap and the deferred email-confirmation TTL continuity issue remain unchanged, out of scope, and undisturbed.

### 27.20 Manual Scenario Verification (Part 28)

All five scenarios are directly covered by executed, passing tests (not merely reasoned about):

- **A (full real-visitor funnel)** — Admin test "counts successful demos, review reached, observed CTA clicks, and claims saved for a real (non-owner) visitor journey."
- **B (consent refused, no CTA event, claim still saved)** — Admin test "CTA consent-gap scenario," confirming a sane 100% claims-saved rate with 0 CTA clicks, no Infinity/NaN.
- **C (known owner, business excludes, health includes)** — Admin test "excludes an owner-flagged claim... but keeps the matching extract success in operational Health."
- **D (missing anonymous_id never becomes one unique visitor)** — Admin test "never groups null anonymous_id rows into one correlated browser" + `live-demo-funnel.test.ts` equivalent.
- **E (claim-saved analytics replay, still one conversion)** — inherited directly from Phase 1C's idempotency guarantee (one stored row per claim regardless of replay) plus `live-demo-funnel.test.ts`'s explicit test that aggregation counts stored rows as-is.

### 27.21 Full Worktree Snapshot (end of Phase 1D)

Branch: `main`. HEAD: `ba60696` (unchanged since before Phase 0A — no commit has been made across any phase of this milestone). Nothing staged.

```
 M app/admin/analytics/page.test.tsx                       <- THIS PHASE (1D)
 M app/admin/analytics/page.tsx                             <- THIS PHASE (1D)
 M app/api/analytics/event/route.test.ts                    <- THIS PHASE (1D, extended)
 M app/api/analytics/event/route.ts                         <- Phase 1B, untouched this phase (see §27.15 note)
 M app/api/auth/login/route.test.ts                         <- THIS PHASE (1D, extended; also Phase 0B)
 M app/api/auth/login/route.ts                               <- THIS PHASE (1D, extended; also Phase 0B)
 M app/api/homepage-demo/claim/save-anyway/route.ts         <- THIS PHASE (1D, extended; also Phase 1C)
 M app/api/homepage-demo/claim/save/route.ts                 <- THIS PHASE (1D, extended; also Phase 1C)
 M app/api/homepage-demo/extract/route.ts                    <- THIS PHASE (1D, extended; also Phase 1A)
 M app/api/homepage-demo/review/route.ts                     <- THIS PHASE (1D, extended; also Phase 1B)
 M app/auth/oauth/callback/route.test.ts                     <- Phase 0A, untouched this phase
 M app/homepage-demo/review/HomepageDemoReviewClient.tsx     <- Phase 1B, untouched this phase
 M lib/analytics/internal-events.server.ts                   <- Phase 1B/1C, untouched this phase
 M lib/homepage-demo/claim-save-repository.server.ts         <- Phase 1C, untouched this phase
?? app/api/auth/signup/route.test.ts                         <- Phase 0A, untouched this phase
?? app/api/homepage-demo/claim/prepare/route.test.ts         <- Phase 0A, untouched this phase
?? app/api/homepage-demo/claim/save-anyway/route.test.ts     <- THIS PHASE (1D, extended; created Phase 0A)
?? app/api/homepage-demo/claim/save/route.test.ts            <- THIS PHASE (1D, extended; created Phase 0A)
?? app/api/homepage-demo/extract/route.test.ts               <- THIS PHASE (1D, extended; created Phase 0A)
?? app/api/homepage-demo/review/route.test.ts                <- THIS PHASE (1D, extended; created Phase 0A)
?? app/auth/confirm/route.test.ts                             <- Phase 0A, untouched this phase
?? app/homepage-demo/review/HomepageDemoReviewClient.test.tsx <- Phase 1B, untouched this phase
?? docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.docx  <- cumulative
?? docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md   <- cumulative
?? lib/analytics/live-demo-funnel.test.ts                     <- THIS PHASE (1D, new)
?? lib/analytics/live-demo-funnel.ts                           <- THIS PHASE (1D, new)
```

### 27.22 Continuation Point

If this conversation is lost, a future session should:
1. Read this document in full, specifically this §27 for the current state.
2. Run `git status` and confirm the exact 26 files in §27.21 are still the only ones modified/untracked.
3. Re-run `npm test` to confirm the full 5,435-test suite still passes before proceeding.
4. Await explicit instruction before beginning Phase 2 — this milestone intentionally stops here.
5. If asked to improve funnel accuracy at higher traffic volume, read §27.11 first — a DB view/RPC was recommended but deliberately not built.

---

## 28. Next Approved Milestone (current)

**PHASE 2 — CONVERSION UX + CLAIM CONTINUITY DESIGN/IMPLEMENTATION**

**NOT STARTED.** No code for it exists yet. It requires its own explicit go-ahead per this project's standing workflow.

---

## 29. PHASE 2A — CONVERSION UX + CLAIM CONTINUITY FINAL DESIGN

Date: 2026-09-03.

Scope: **READ-ONLY DESIGN / MAPPING ONLY.** No production UX, tests, Supabase schema, RLS, RPC, environment, Vercel, staging, commit, push, or deploy changes were made in this phase. The only files intentionally updated are this Markdown handoff and its `.docx` mirror.

### 29.1 Phase 2A Result

**PASS.** Current implementation was revalidated from the working tree, the conversion UX decision was made, the claim-continuity lifecycle was designed, and the next implementation split is defined.

### 29.2 Verified Current User Journey

Current user-visible flow:

1. Homepage Live Demo form displays: **"Try it with a client message"** and explains that the user can paste a request and see an organized project draft before creating an account.
2. Input label is **"Client message"** with helper copy: **"Paste from email, WhatsApp, notes, or a project brief."**
3. Primary submit button moves from **"Preview my project"** to **"Creating preview..."** and then **"✓ Done"**.
4. Extraction status steps are:
   - **"Preparing a private preview"**
   - **"Checking the browser challenge"**
   - **"Creating your project preview"**
   - **"Opening the review"**
5. Desktop-capable browsers pre-open `/homepage-demo/review` in a named window only when the viewport/pointer query indicates a desktop-like device. The final review URL is later loaded into that window as `/homepage-demo/review#{publicToken}`.
6. If the window fails to open, or no prepared window is available, the current tab navigates to `/homepage-demo/review#{publicToken}`.
7. Mobile does not pre-open a separate review window because the media query requires at least 900px width, hover, and fine pointer. Mobile therefore uses current-tab navigation.
8. The review route reads the public token from `window.location.hash`, immediately removes the fragment with `history.replaceState`, and POSTs the token to `/api/homepage-demo/review` with `referrerPolicy: "no-referrer"`.
9. The review page says **"Review your project draft"** with supporting copy **"Check the project and tasks prepared from your message before creating an account."**
10. The ready-state notice says **"Temporary preview"** and **"This preview has not been saved to an account."**
11. Current review CTAs are **"Start for free"** and **"Log in"**, plus **"Back to homepage"**.
12. CTA activation calls `/api/homepage-demo/claim/prepare`; on success the user is sent to `/signup?intent=homepage-demo-claim` or `/login?intent=homepage-demo-claim`.
13. Successful signup/login/OAuth with the demo intent redirects to `/homepage-demo/claim/continue`, which attempts `/api/homepage-demo/claim/save` and then redirects to `/dashboard` on `saved` or same-user `already_claimed`.
14. If the claim expires or cannot be found, the continuation page shows a non-enumerating failure and offers a return path to the homepage. Duplicate detection offers **"Save anyway"** or **"Go to dashboard"**.

### 29.3 Verified Free Plan Truth

Free plan facts verified from code and product copy:

- Free allowance is **30 total AI extracts**.
- Free users can use text and image extraction until the 30-extract total is exhausted.
- Free users can review, edit, save projects/tasks to the CRM workspace, use client updates/history, resource attachments, deadlines, priorities, budgets, status tracking, and Work Calendar.
- No credit card is required for the Free signup path.
- CSV export is Pro-only per terms/product surfaces and must not be implied as a Free benefit.
- Pro has unlimited AI extracts; Free does not renew automatically.

### 29.4 UX Problems — Verified Facts

- The result is valuable but the CTA currently reads like a generic account signup rather than preserving the user's just-created project.
- Desktop and mobile have different result-opening behavior: desktop attempts a separate named window, while mobile uses the current tab.
- Popup blockers or focus rules can collapse the desktop flow into current-tab navigation, making behavior less predictable.
- The homepage button ending on **"✓ Done"** is not itself the conversion moment; the real conversion moment is on the review page after the user sees the structured project.
- Claim continuity is currently time-fragile for email confirmation because the anonymous trial/draft default is 15 minutes and the claim cookie is capped at 20 minutes and further bounded by trial/draft expiry.

### 29.5 Result Presentation Architecture Decision

Recommended production architecture: **Option B — navigate the same tab to the dedicated review page.**

Evaluation:

| Option | Decision | Reason |
|---|---|---|
| A. Keep separate review page/tab | Reject as default | Keeps the secure review route, but preserves popup/focus inconsistency and desktop/mobile divergence. |
| B. Same-tab review page | **Recommend** | Lowest-friction reliable behavior, no popup dependency, consistent mobile/desktop mental model, keeps noindex/noanalytics review isolation, compatible with current hash-token cleanup and claim architecture. |
| C. Inline homepage result | Reject | The homepage is a marketing/analytics surface; rendering sensitive extracted content inline raises analytics/replay/SEO and state-complexity concerns. |
| D. Inline summary + full review route | Defer | Could work later, but adds another content surface and token/data lifecycle without solving claim continuity. |
| E. Other | Not needed | Existing route is already a strong security boundary; the main change should be navigation behavior and conversion copy. |

Same-tab navigation should continue to use `/homepage-demo/review#{publicToken}` and immediate fragment cleanup. Bearer material must not move to query params.

### 29.6 Final Recommended Conversion Copy

Use project-centric language because the actual demo output and save/import path are project-centric with tasks/subtasks inside the project.

- Headline: **"Your project is ready"**
- Supporting copy: **"Save this project to your free Text2Task workspace and keep working with its tasks, client details, deadline, budget, and notes."**
- Primary CTA: **"Save project free"**
- Secondary CTA: **"Already have an account? Log in"**
- Free-plan microcopy: **"30 total AI extracts included. No credit card required."**

Do not say **"Save these tasks"** as the primary message, because it understates the extracted project/client/resource context. Do not mention CSV export in Free-plan copy.

### 29.7 Token / URL Security Decision

Current token behavior is sound and should be preserved:

- Review bearer token lives in `window.location.hash`, not the query string.
- The hash is not sent to the server in the HTTP request line.
- The client removes the hash from browser-visible URL state immediately after reading it.
- Review fetches use `no-referrer`, `no-store`, and same-origin credentials.
- The review route is `noindex`/`nofollow`/`nocache`, and the centralized analytics path exclusion skips `/homepage-demo/review`.
- CTA analytics uses a hardcoded safe `page_path` and must never include token-bearing URLs.

Same-tab navigation does not weaken these properties as long as the fragment is retained and immediately cleaned.

### 29.8 Current Claim Lifecycle

Current lifecycle:

```text
anonymous homepage demo
-> bootstrap creates public/idempotency tokens and anonymous session/device cookies
-> extract creates a trial and draft
-> draft becomes review_ready
-> review reads public token from URL hash and validates session authority
-> CTA calls claim/prepare
-> server creates pending claim authority and sets httpOnly claim cookie
-> signup/login/OAuth authenticates user with intent=homepage-demo-claim
-> /homepage-demo/claim/continue calls claim/save
-> service-role RPC imports project/tasks for authenticated user
-> claim/trial/draft become claimed
```

Current TTLs:

- Trial TTL default: **900 seconds / 15 minutes**.
- Trial TTL configured bounds: **5 to 60 minutes**.
- Draft expiry follows the trial expiry.
- Claim cookie max age: **20 minutes**, but actual claim authority is bounded by trial and draft expiry.
- Duplicate override authority: **5 minutes**, bounded by the related authority expiry.
- Signup continuation config exists as `signupContinuationTtlSeconds`; default **3600 seconds / 60 minutes**, configured bounds **15 minutes to 2 hours**.
- `signupContinuationTtlSeconds` is currently exported from config but not used by the claim/auth lifecycle.

### 29.9 Real User Scenarios

| Scenario | Today | Work survives today? | Desired long-term behavior | Security implication |
|---|---|---:|---|---|
| A. Demo -> Start Free -> immediate email/password auth | Works if auth completes before trial/draft/claim expiry. | Usually yes | Seamless save and dashboard redirect. | Authenticated user only; no client-chosen user id. |
| B. Confirmation email after 2 minutes | Works in same browser if cookies remain. | Usually yes | Seamless continuation after confirmation. | No claim token in email URL. |
| C. Confirmation after 20-30 minutes | Usually expires because trial/draft default is 15 minutes and claim is bounded by them. | Usually no | Pending-auth continuation preserves it within configured window. | Requires server-side continuation, not blanket anonymous TTL. |
| D. Confirmation after about 1 hour | Expires today. | No | Save if still within configured continuation TTL; otherwise clean expired recovery. | Do not promise exact visible timer unless implemented. |
| E. Google OAuth quick | Works if provider returns before expiry and cookies return. | Usually yes | Seamless save. | Reuse `intent=homepage-demo-claim`. |
| F. Google OAuth delayed | Can expire beyond the anonymous window. | Maybe/no | Pending-auth continuation preserves it within configured window. | No parallel OAuth state machine. |
| G. Browser closed after signup, user returns later | Depends on persistent cookies and short expiry; likely expires after delay. | Fragile | Same browser/profile can continue within pending-auth TTL; after TTL show recovery. | Cross-device is not supported without a new proof mechanism. |
| H. Auth in another tab | Same browser cookies usually allow it if not expired. | Yes if quick | Same browser tabs continue within pending-auth TTL. | Cookie-bound authority remains same-browser. |
| I. Continue from another device | No claim/session cookies, so unavailable. | No | Safe failure and new-demo/dashboard recovery. | Supporting this would require email-visible bearer material or another proof design; do not add for Phase 2. |
| J. Existing user chooses Log in | Works if login completes before expiry. | Usually yes | Login-start continuation preserves it for the same configured window. | Solution must not be signup-only. |
| K. Auth fails once, then succeeds | Works only if still within short expiry. | Fragile | Failed auth does not consume continuation; retry can still save within TTL. | Rate limits and auth controls stay in existing auth layer. |
| L. Duplicate project detected | Duplicate modal path works; save-anyway uses bounded override authority. | Yes if authority active | Keep duplicate flow unchanged, with override still one-time and short-lived. | Prevent replay and accidental duplicates. |

### 29.10 Claim Continuity Design

Do **not** solve this by globally increasing anonymous trial TTL.

Recommended lifecycle:

```text
anonymous demo
-> short-lived review authority
-> user clicks Save project free / Log in
-> claim/prepare creates short pre-auth claim authority
-> signup/login/OAuth begins with demo intent
-> server creates or refreshes bounded pending-auth continuation
-> continuation extends only the selected pending claim/trial/draft to signupContinuationTtlSeconds
-> authentication completes
-> continuation route saves for the authenticated user
-> terminal state becomes claimed, expired, invalid, or cancelled
```

Important properties:

- Before auth starts, keep the current short anonymous TTL behavior.
- Once auth starts, extend only the specific claim path the user intentionally began saving.
- Final ownership is assigned only after Supabase authentication succeeds.
- Browser cookies remain httpOnly and SameSite Lax.
- No sensitive claim token is placed in signup, login, OAuth, or email confirmation URLs.
- Same-browser and same-profile continuity is supported; another-device continuity is intentionally not supported in this phase.

### 29.11 Claim State Model

Authority layers:

1. **Pre-auth authority:** public review token plus anonymous session identity, then httpOnly claim cookie after claim preparation.
2. **Signup-begun authority:** claim cookie plus a new/rotated server-side pending-auth continuation token cookie, stored only as a hash.
3. **Authenticated ownership:** Supabase authenticated user id supplied server-side after real auth; the client never chooses `claimed_by_user_id`.
4. **Terminal state:** claimed, expired, invalid, or cancelled. Claimed replay succeeds only for the same authenticated user and same saved project.

Implementation should require both the claim cookie and continuation cookie for saves that rely on the extended pending-auth window. This avoids turning the longer continuation TTL into a longer generic anonymous bearer capability.

### 29.12 Data-Model Decision

Recommended: **reuse and extend `homepage_demo_claims` with narrowly scoped pending-auth continuation columns.**

Migration required: **YES, design only. No SQL executed in Phase 2A.**

Why this option:

- `homepage_demo_claims` is already the one-to-one bridge among trial, draft, claim token, and eventual authenticated save.
- It already has RLS enabled and no direct `anon`/`authenticated` grants.
- It already stores hashes and state, not raw tokens or raw content.
- It already participates in idempotency and replay protection.
- A dedicated second table would add relationship integrity and cleanup complexity without a clear Phase 2 benefit.

Likely additive columns:

- `auth_continuation_token_hash`
- `auth_continuation_started_at`
- `auth_continuation_expires_at`
- `auth_continuation_consumed_at`
- optional `auth_continuation_flow`
- optional HMAC-normalized `auth_continuation_email_hash` for email-signup observability/binding, never raw email

The implementation phase must decide exact column names and constraints in migration review. It must include static migration tests for grants, RLS posture, constraints, indexes, and absence of `anon` access.

### 29.13 TTL / Expiry Policy

Policy:

- Anonymous demo review remains short-lived: default 15 minutes.
- Claim preparation remains short-lived before auth begins.
- Pending-auth continuation uses existing `signupContinuationTtlSeconds`: default 60 minutes, bounded 15 minutes to 2 hours.
- Extending a pending-auth continuation must atomically extend the selected claim, trial, and draft expiry as needed, or the save RPC will continue to fail when the underlying draft expires.
- Extension happens only after a deliberate account CTA/auth start, not for every review view.
- Duplicate override remains 5 minutes and one-time.
- Cleanup and maintenance RPCs must respect the extended pending-auth expiry. Both the legacy `purge_expired_homepage_demo_trials` surface and the newer claimed-safe `purge_homepage_demo_retention` path must be reviewed before implementation.

Do not expose exact expiry promises in user copy unless a visible timer and tested grace behavior are added.

### 29.14 Email Confirmation Continuity

Design:

1. User clicks **"Save project free"**.
2. `/api/homepage-demo/claim/prepare` sets the existing claim cookie.
3. Email signup route receives `intent=homepage-demo-claim`.
4. Before or during signup initiation, server validates the claim cookie and creates/refeshes a pending-auth continuation cookie and hash-backed claim fields.
5. Supabase email confirmation redirect remains intent-based: `/auth/confirm?intent=homepage-demo-claim`.
6. No claim/public token is placed in the email URL.
7. After confirmation, the authenticated browser is redirected to `/homepage-demo/claim/continue`.
8. Claim save verifies authenticated user, claim cookie, continuation cookie, hashes, status, expiry, and draft/trial integrity before import.

If the email is opened on another device/browser without the cookies, the system should fail closed with a generic unavailable/expired recovery path.

### 29.15 Google OAuth Continuity

Design:

- Reuse existing `intent=homepage-demo-claim`.
- `/api/auth/google?intent=homepage-demo-claim` should validate existing claim authority and create/refresh the pending-auth continuation before redirecting to Google.
- OAuth callback keeps its current role: exchange code, ensure user, preserve owner analytics handling, then redirect to `/homepage-demo/claim/continue`.
- Do not create a parallel OAuth continuation identifier.
- Do not put claim bearer material in the OAuth callback query string.

### 29.16 Existing-User Login Continuity

Design:

- `/login?intent=homepage-demo-claim` should use the same pending-auth continuation lifecycle as signup.
- Password login success redirects to `/homepage-demo/claim/continue`.
- Failed login does not consume continuation.
- Existing non-demo login behavior must remain unchanged when the intent is absent.

### 29.17 Security Model

Required invariants:

- Raw public, claim, session, and continuation tokens are never persisted.
- Browser never receives or chooses `claimed_by_user_id`.
- Server verifies Supabase auth before save.
- Save RPC/import remains idempotent.
- Claimed replay can only succeed for the same authenticated user and same saved project.
- Pending-auth extension is bounded and claim-specific.
- Expired terminal state is monotonic; do not resurrect unrelated expired drafts.
- Another browser/device cannot claim without the cookie-bound authority.
- Analytics remains observation only and never controls eligibility.
- Public failures remain non-enumerating.

### 29.18 Failure / Recovery UX

Recommended outcomes:

| Failure | User-facing outcome | Recovery |
|---|---|---|
| Expired claim | **"This preview expired."** | Primary: create a new preview. Secondary: go to dashboard/login if authenticated. |
| Failed confirmation | Keep check-email/login recovery with demo intent preserved. | Resend confirmation while continuation is still valid. |
| Expired confirmation | Auth layer shows confirmation recovery; claim layer may show expired if continuation elapsed. | New preview or normal workspace login. |
| Invalid claim | Generic **"We couldn't find this preview."** | New preview; no existence disclosure. |
| Duplicate detected | Keep duplicate screen. | **"Save anyway"** or **"Go to dashboard"**. |
| Claim already saved | Redirect to dashboard. | Optional future toast/status; no duplicate import. |
| Temporary server failure | Retryable error. | **"Try again"**. |
| Analytics failure | Silent. | Continue business flow. |
| Popup/navigation failure | Eliminated by same-tab design. | If old behavior retained during rollout, current-tab fallback remains required. |

### 29.19 Ideal End-to-End UX

Recommended future journey:

```text
Homepage
-> Live Demo input
-> same-tab review page
-> "Your project is ready"
-> "Save project free" / "Already have an account? Log in"
-> claim prepared
-> signup/login/OAuth
-> pending-auth continuation preserves project
-> claim save imports project/tasks
-> dashboard opens with saved project available
```

Major screens:

| Screen | Headline | Supporting copy | Primary CTA | Secondary CTA | Data that survives |
|---|---|---|---|---|---|
| Homepage demo | Current homepage demo heading can remain initially. | Current input helper can remain. | Preview my project | Existing homepage actions | Input only until extraction starts. |
| Review ready | Your project is ready | Save this project to your free Text2Task workspace and keep working with its tasks, client details, deadline, budget, and notes. | Save project free | Already have an account? Log in | Sanitized project preview, draft id via server, claimable authority. |
| Signup | Existing signup page with demo-aware microcopy. | Project is ready to save after account creation. | Continue with Google / Create my workspace | Log in | Pending-auth continuation cookie/hash. |
| Check email | Current demo-aware check-email copy. | Confirm email to continue saving it. | Resend confirmation | Log in / Sign up | Pending-auth continuation in same browser. |
| Claim continuation | Saving your project... | Saving prepared project to workspace. | Retry if needed | Dashboard/homepage recovery on terminal states | Project import idempotency and duplicate authority if needed. |
| Dashboard | Existing dashboard. | Existing workspace UI. | Existing workspace actions | N/A | Saved project/tasks/client/resource projection. |

### 29.20 Mobile + Accessibility

Mobile:

- Same-tab review is the recommended mobile and desktop behavior.
- Avoid popup/new-tab logic as the primary result presentation.
- Review page should keep CTAs visible after enough context to understand the project, with no overlap and full-width touch targets on narrow screens.
- Returning from email app or OAuth should land directly in claim continuation and then dashboard when successful.

Accessibility:

- Preserve semantic buttons for CTAs.
- Keep loading buttons disabled with clear text.
- Use live/status announcements for extraction, review loading, claim saving, and retryable errors.
- Move focus to final success/error states as the review client already does.
- If any new-tab behavior remains temporarily, it needs explicit announcement text; the recommended same-tab architecture avoids that requirement.

### 29.21 Analytics Impact

Prefer **no new analytics events**.

Existing semantics remain valid:

- `homepage_demo_extract_attempt`: unchanged.
- `homepage_demo_extract_succeeded`: unchanged.
- `demo_review_viewed`: remains server-authoritative when a ready draft is genuinely fetched.
- `demo_account_cta_clicked`: remains best-effort/consent-sensitive and should use safe hardcoded paths only.
- `signup_success`: unchanged except demo-intent attribution remains useful.
- `login_success`: unchanged, with demo intent metadata still relevant.
- `demo_claim_saved`: remains authoritative conversion event with claim-level idempotency.

Same-tab review does not require Admin metric redesign. The review page remains excluded from analytics scripts, and CTA telemetry remains supplemental.

### 29.22 Admin Impact

No conceptual Admin redesign is required.

- Denominator definitions stay the same.
- Owner exclusion stays server-derived and event/query based.
- CTA clicks remain observed, not authoritative.
- Review-reached semantics remain server-authoritative.
- Claim conversion remains `demo_claim_saved`.
- Admin copy may later mention that review now opens in the same tab, but that is optional and not a Phase 2A implementation item.

### 29.23 Test Strategy

P0 tests:

- Same-tab extraction success navigates to `/homepage-demo/review#{token}` and does not rely on `window.open`.
- Review token hash is consumed from fragment and removed from visible URL.
- CTA copy and claim-prepare routing for signup/login.
- Immediate signup saves claim.
- Email confirmation delayed past anonymous trial TTL but within continuation TTL saves claim.
- Email confirmation after continuation expiry fails closed.
- Google OAuth quick and delayed continuation.
- Existing-user login continuation.
- Failed auth retry does not consume continuation.
- Duplicate detection and save-anyway still work.
- Replay of saved claim remains idempotent and same-user only.
- Another device/no-cookie continuation fails closed.
- Malformed/missing continuation token fails closed.
- Normal signup, login, and Google OAuth without demo intent are unchanged.
- Free/Pro extract and CSV behavior remain unchanged.
- Static migration tests for RLS, grants, constraints, indexes, no `anon` grants, safe RPC grants.

P1 tests:

- Mobile/narrow review CTA layout.
- Check-email resend preserves demo intent and continuation where applicable.
- Temporary server failures remain retryable.
- Admin funnel aggregation remains unchanged after same-tab flow.
- Maintenance cleanup does not purge active pending-auth continuations.

P2 tests:

- Visual polish snapshots for final copy.
- Optional copy tests for expired/unavailable states.
- Optional owner-exclusion regression around changed navigation.

### 29.24 Migration / Rollout Design

If implemented, use a no-big-bang rollout:

1. Additive migration for pending-auth continuation fields/constraints/indexes/RPC changes.
2. Static migration tests.
3. Backward-compatible server code that accepts current short claims and new pending-auth continuation.
4. Auth route updates for signup, login, Google OAuth, and confirmation continuation.
5. Claim save route/RPC verification for continuation token when relying on extended expiry.
6. Maintenance cleanup alignment for extended pending-auth expiry.
7. UX copy and same-tab navigation after backend continuity is safe.
8. Admin verification using existing Phase 1D metrics.
9. Rollback path: disable new continuation creation while preserving old short-claim save behavior; additive columns can remain inert.

### 29.25 Recommended Implementation Split

Recommended order changes the expected Phase 2B/2C split for safety:

- **Phase 2B: Claim Continuity Foundation.** Additive DB/RPC/server/auth work, tests, and maintenance alignment. Keep public UX mostly unchanged except unavoidable continuation behavior.
- **Phase 2C: Conversion UX Implementation.** Same-tab review navigation, final conversion copy, CTA polish, mobile/accessibility polish, focused tests.
- **Phase 2D: Production verification / Admin wording only if needed.** Confirm funnel metrics, owner exclusion, and no analytics leakage after rollout.

Reason: stronger conversion copy should not send more users into an auth path that is still fragile for slower email confirmation.

### 29.26 Files Likely To Change Later

Likely UX files:

- `app/components/landing/HomepageLiveDemoClient.tsx`
- `app/homepage-demo/review/page.tsx`
- `app/homepage-demo/review/HomepageDemoReviewClient.tsx`
- `app/homepage-demo/review/HomepageDemoReviewPanel.tsx`
- `app/homepage-demo/review/homepage-demo-review.module.css`
- signup/login/check-email surfaces only for demo-aware copy polish if needed

Likely continuity files:

- `lib/homepage-demo/config.server.ts`
- `lib/homepage-demo/claim-identity.server.ts`
- new `lib/homepage-demo/claim-continuation-identity.server.ts` or equivalent
- `lib/homepage-demo/claim-repository.server.ts`
- `lib/homepage-demo/claim-save-repository.server.ts`
- `app/api/homepage-demo/claim/prepare/route.ts`
- `app/api/homepage-demo/claim/save/route.ts`
- `app/api/auth/signup/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/google/route.ts`
- `app/auth/oauth/callback/route.ts`
- `app/auth/confirm/route.ts`
- `app/check-email/page.tsx`
- Supabase additive migration and colocated migration tests

Likely test files:

- existing homepage demo review/client tests
- existing claim prepare/save/save-anyway route tests
- auth signup/login/google/confirm tests
- new or existing migration static tests
- focused maintenance cleanup tests

### 29.27 What Not To Build

Do not add:

- external workflow/state-machine product
- Redis or queue infrastructure for this lifecycle
- fingerprinting
- new analytics provider
- external auth service
- Supabase auth redesign
- homepage demo rewrite
- public inline result rendering on the marketing homepage
- another-device continuation without a separate proof and threat model
- unnecessary new database tables unless migration review proves `homepage_demo_claims` cannot safely carry the continuation state

### 29.28 Phase 2A Worktree / Operations Status

- Production implementation: **NO**
- Tests changed: **NO**
- Supabase changed: **NO**
- Migration created: **NO**
- RLS/RPC changed: **NO**
- Environment changed: **NO**
- Vercel changed: **NO**
- Staged: **NO**
- Commit: **NO**
- Push: **NO**
- Deploy: **NO**

Intentional documentation updates:

- `docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md`
- `docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.docx`

### 29.29 Exact Next Phase

**Next phase: Phase 2B — Claim Continuity Foundation.**

Do not implement Phase 2B until explicitly requested.

---

## 30. PHASE 2B — CLAIM CONTINUITY FOUNDATION

Date: 2026-09-03.

Scope: backend/database lifecycle only. No public conversion copy, same-tab review navigation, homepage redesign, pricing copy, Admin redesign, analytics events, staging, commit, push, production Supabase execution, or deploy occurred.

### 30.1 Result

**PASS.** Phase 2B implements a bounded pending-auth continuation foundation for Homepage Demo claims.

### 30.2 Repository State At Start

- Branch: `main`.
- HEAD: `c0606ba`.
- Pre-existing changes before Phase 2B: Phase 2A handoff docs were modified; `.claude/` was untracked and unrelated.
- The recurring Git warning about `C:\Users\Home/.config/git/ignore` permission was observed and not touched.
- Phase 2A was confirmed design-only.

### 30.3 Final Claim Continuity Architecture

The implemented lifecycle is:

```text
anonymous demo
-> review CTA calls claim/prepare
-> short claim cookie is created/reused
-> pending-auth continuation is created/reused on the same claim
-> user completes email confirmation, Google OAuth, or password login
-> claim continuation page calls claim/save
-> save accepts either original short claim authority or valid continuation authority
-> project/tasks are imported once for the authenticated user
-> claim/trial/draft become terminal claimed, or fail closed as expired/invalid
```

The continuation is a separate httpOnly SameSite Lax cookie and token purpose. The raw short claim cookie was not made long-lived.

### 30.4 Database Design

Migration file created in source only:

- `supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.sql`

Table extended:

- `public.homepage_demo_claims`

Columns added:

- `auth_continuation_token_hash text null`
- `auth_continuation_started_at timestamptz null`
- `auth_continuation_expires_at timestamptz null`
- `auth_continuation_consumed_at timestamptz null`

Constraints/indexes added:

- token hash format check for 64-character SHA-256 hex hashes
- lifecycle check requiring all continuation fields to be null together, or token/start/expiry to be present together
- lifecycle check requiring `auth_continuation_started_at < expires_at`, proving continuation began while the short claim was still valid
- lifecycle check requiring consumed continuations to be claimed
- partial unique index on `auth_continuation_token_hash`
- partial status/expiry index for pending unconsumed continuations

Backward compatibility:

- additive nullable columns only
- no column drops/renames/destructive rewrites
- old claim/save RPCs remain in source
- new application code calls v2 RPCs
- existing rows remain valid with null continuation fields

Privileges/RLS:

- `homepage_demo_claims` remains RLS-enabled from prior migrations
- no direct `public`, `anon`, or `authenticated` grants added
- service-role-only function/table posture preserved

### 30.5 RPC / Source DB Changes

New RPCs in migration source:

- `prepare_homepage_demo_claim_auth_continuation`
- `claim_homepage_demo_project_v2`
- `prepare_homepage_demo_duplicate_override_v2`
- `claim_homepage_demo_project_with_duplicate_override_v2`

Maintenance functions redefined in migration source:

- `purge_expired_homepage_demo_trials`
- `purge_homepage_demo_retention`

Production Supabase was not changed.

### 30.6 Continuation Start Trigger

Exact trigger: successful `/api/homepage-demo/claim/prepare` for a valid review CTA flow.

It does not start when:

- the demo succeeds
- the review page loads
- the CTA is merely visible

The route starts/reuses continuation only after a valid claim is prepared or reused for the selected review draft.

### 30.7 TTL Rule

Config reused:

- `HOMEPAGE_DEMO_CONFIG.signupContinuationTtlSeconds`
- default: **3600 seconds / 60 minutes**
- min: **900 seconds / 15 minutes**
- max: **7200 seconds / 2 hours**
- env override: `TEXT2TASK_HOMEPAGE_DEMO_SIGNUP_CONTINUATION_TTL_SECONDS`

Rule:

```text
auth_continuation_expires_at =
first_valid_continuation_start + signupContinuationTtlSeconds
```

Retries do not slide the expiry. If the same valid continuation cookie is present, the RPC returns `continuation_reused` with the original expiry. If a different/missing continuation token appears while an active continuation exists, the RPC returns `continuation_in_progress` and does not issue a replacement cookie.

### 30.8 Claim Validity Rule

Claim save now proceeds when either:

1. the original short claim cookie authority is still valid, or
2. a valid unconsumed pending-auth continuation token matches the claim and has not expired.

An expired claim without a valid continuation still fails closed. A continuation is valid only if its recorded start is earlier than the original short claim expiry.

### 30.9 Email Confirmation

No auth route code change was required. Existing email signup/confirmation intent plumbing remains intact:

- signup carries `intent=homepage-demo-claim`
- email redirect points to `/auth/confirm?intent=homepage-demo-claim`
- no raw claim/continuation token is added to email-visible URLs
- after confirmation, `/homepage-demo/claim/continue` can save with the continuation cookie even if the short claim cookie and original trial/draft expiries have elapsed

Normal signup without demo intent remains unchanged.

### 30.10 Google OAuth

No parallel OAuth state system was added. Existing OAuth intent plumbing remains intact:

- Google start uses `intent=homepage-demo-claim`
- callback redirects to `/homepage-demo/claim/continue`
- no claim/continuation bearer material enters OAuth query strings
- OAuth failure/cancel preserves retry intent and does not consume the continuation

Normal Google OAuth without demo intent remains unchanged.

### 30.11 Existing User Login

Password login continues to preserve `intent=homepage-demo-claim` and redirects to claim continuation after success.

Failed password login does not consume continuation. Normal login without demo intent remains unchanged.

### 30.12 Ownership / Anti-Hijacking

Final ownership remains assigned only inside the authenticated claim-save RPC path. The client never supplies `claimed_by_user_id`.

Protections:

- raw continuation token is never stored
- continuation token has a distinct token-purpose hash domain
- one continuation token hash is unique
- another authenticated user cannot replay a claimed row as their own
- claimed replay succeeds only for the same authenticated user and saved project
- consumed continuation cannot be reused to change ownership
- duplicate override remains claim/user/request/import-payload bound

### 30.13 Retention / Maintenance

Continuation does not extend public review access. Instead, retention cleanup now skips trial/draft source data that has an active pending unconsumed continuation.

Updated cleanup behavior in migration source:

- expired anonymous trials without active continuation remain eligible for cleanup
- active pending continuations preserve required source rows until continuation expiry
- expired pending continuations are marked/eligible for cleanup
- claimed retention behavior remains claimed-safe
- both legacy and current retention function surfaces were updated in source

### 30.14 Idempotency

Preserved:

- repeated claim prepare reuses or returns in-progress
- repeated claim save stays idempotent through claim/import keys
- already-claimed replay remains same-user only
- save-anyway still consumes duplicate override atomically
- `demo_claim_saved` keeps the same claim-level idempotency key

### 30.15 Analytics / Admin Impact

No new analytics events were added.

Semantics unchanged:

- `homepage_demo_extract_attempt`
- `homepage_demo_extract_succeeded`
- `demo_review_viewed`
- `demo_account_cta_clicked`
- `signup_success`
- `login_success`
- `demo_claim_saved`

Admin Live Demo Conversion UI was not modified.

### 30.16 Production Behavior Changes

Changed backend behavior:

- `/api/homepage-demo/claim/prepare` now creates/reuses a bounded pending-auth continuation cookie after valid claim preparation.
- `/api/homepage-demo/claim/save` can load/save via continuation authority when the short claim cookie is gone.
- `/api/homepage-demo/claim/save-anyway` can do the same for duplicate override saves.
- Successful saves clear the continuation cookie along with the short claim and duplicate override cookies.

Not changed:

- public review copy/layout/navigation
- homepage demo result presentation
- signup/login public copy
- analytics event names
- Admin UI
- production Supabase
- environment
- deployment

### 30.17 Files Changed

| File | Added/Modified | Purpose |
|---|---|---|
| `app/api/homepage-demo/claim/prepare/route.ts` | Modified | Starts/reuses pending-auth continuation after valid claim prepare. |
| `app/api/homepage-demo/claim/prepare/route.test.ts` | Modified | Covers continuation cookie creation/reuse and bounded TTL handoff. |
| `app/api/homepage-demo/claim/save/route.ts` | Modified | Accepts claim cookie or continuation cookie; clears continuation on success. |
| `app/api/homepage-demo/claim/save/route.test.ts` | Modified | Covers continuation-only save after short claim cookie loss. |
| `app/api/homepage-demo/claim/save-anyway/route.ts` | Modified | Carries continuation authority through duplicate override save. |
| `app/api/homepage-demo/claim/save-anyway/route.test.ts` | Modified | Covers continuation-only save-anyway path. |
| `lib/homepage-demo/claim-continuation-identity.server.ts` | Added | Creates, hashes, reads, sets, and clears continuation cookie authority. |
| `lib/homepage-demo/claim-repository.server.ts` | Modified | Adds repository wrapper for continuation-start RPC. |
| `lib/homepage-demo/claim-repository.server.test.ts` | Added | Covers continuation RPC contract, reuse, and TTL validation. |
| `lib/homepage-demo/claim-save-repository.server.ts` | Modified | Loads sources by claim or continuation authority and calls claim v2 RPC. |
| `lib/homepage-demo/claim-save-repository.server.test.ts` | Added | Covers continuation source loading and v2 RPC call shape. |
| `lib/homepage-demo/claim-duplicate-override-repository.server.ts` | Modified | Calls duplicate override v2 RPCs with continuation authority. |
| `lib/homepage-demo/types.ts` | Modified | Adds `homepage-demo-claim-continuation` token purpose. |
| `supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.sql` | Added | Additive schema/RPC/maintenance source migration. |
| `supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.test.ts` | Added | Static migration security/lifecycle/retention tests. |
| `docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md` | Modified | Appends Phase 2B implementation record. |
| `docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.docx` | Modified | Mirrors Phase 2B implementation record. |

### 30.18 Migration Review

**PASS.**

Reviewed properties:

- additive only
- nullable/default-safe
- no destructive DDL
- no direct browser-role grants
- service-role-only function execution
- RLS posture preserved
- old RPCs retained for rollout compatibility
- continuation token hashes only
- no raw tokens in SQL schema
- no email/OAuth/query-string bearer material
- retention protects active continuations only
- static migration tests added and passing

### 30.19 Validation Results

Targeted Phase 2B tests:

```text
npm.cmd test -- lib/homepage-demo/claim-repository.server.test.ts lib/homepage-demo/claim-save-repository.server.test.ts supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.test.ts app/api/homepage-demo/claim/prepare/route.test.ts app/api/homepage-demo/claim/save/route.test.ts app/api/homepage-demo/claim/save-anyway/route.test.ts
Test Files: 6 passed
Tests: 102 passed
```

Related homepage-demo/auth/analytics/Admin tests:

```text
npm.cmd test -- app/api/homepage-demo app/homepage-demo lib/analytics/live-demo-funnel.test.ts app/admin/analytics/page.test.tsx app/api/analytics/event/route.test.ts app/api/auth/signup/route.test.ts app/api/auth/login/route.test.ts app/auth/confirm/route.test.ts app/auth/oauth/callback/route.test.ts supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.test.ts
Test Files: 14 passed
Tests: 288 passed
```

Full repository tests:

```text
npm.cmd test
Test Files: 212 passed
Tests: 5456 passed
Failed: 0
Skipped: 0
```

Typecheck:

```text
npx.cmd tsc --noEmit
PASS
```

Lint:

```text
npx.cmd eslint <Phase 2B changed/new source and test files>
PASS
```

Full lint was also run:

```text
npm.cmd run lint
FAIL due to unrelated pre-existing app/components/dashboard/tasks/share-link/share-link-channels.tsx react-hooks/set-state-in-effect error, plus unrelated warnings.
```

Build:

```text
npm.cmd run build
PASS after rerun with network permission for Google Fonts.
```

The first sandboxed build failed only because Next could not fetch Google Fonts (`Inter`, `DM Sans`) from `fonts.googleapis.com` under restricted network.

### 30.20 Security / Privacy

| Check | Result |
|---|---|
| Raw continuation token persisted | PASS — no |
| Continuation token in email URL | PASS — no |
| Continuation token in OAuth URL | PASS — no |
| Continuation token in analytics | PASS — no |
| Bearer token moved to query string | PASS — no |
| Client can choose user id | PASS — no |
| Client can choose expiry | PASS — no |
| Anonymous claim cookie made long-lived | PASS — no |
| Expired claim without continuation resurrected | PASS — no |
| Continuation can slide forever by retry | PASS — no |
| RLS weakened | PASS — no |
| Browser role direct grants added | PASS — no |
| Duplicate bypass introduced | PASS — no |
| `demo_claim_saved` duplicated by replay | PASS — no |

### 30.21 Database / Infrastructure

| Item | Status |
|---|---|
| Migration source created | YES |
| Production Supabase changed | NO |
| RLS changed in source | NO |
| RPC changed in source | YES — new v2/continuation RPCs and retention redefinitions |
| Production RPC changed | NO |
| Environment changed | NO |
| Vercel changed | NO |
| Deployed | NO |

### 30.22 Discovered Issues — Not Fixed

- Full-repo lint currently fails on unrelated `app/components/dashboard/tasks/share-link/share-link-channels.tsx` with `react-hooks/set-state-in-effect`, plus unrelated warnings. Phase 2B changed-file lint passes.
- Git continues to warn that `C:\Users\Home/.config/git/ignore` cannot be accessed. This was observed before and remains unrelated.

### 30.23 Cumulative Worktree Snapshot

Phase 2B modified:

```text
M  app/api/homepage-demo/claim/prepare/route.test.ts
M  app/api/homepage-demo/claim/prepare/route.ts
M  app/api/homepage-demo/claim/save-anyway/route.test.ts
M  app/api/homepage-demo/claim/save-anyway/route.ts
M  app/api/homepage-demo/claim/save/route.test.ts
M  app/api/homepage-demo/claim/save/route.ts
M  lib/homepage-demo/claim-duplicate-override-repository.server.ts
M  lib/homepage-demo/claim-repository.server.ts
M  lib/homepage-demo/claim-save-repository.server.ts
M  lib/homepage-demo/types.ts
?? lib/homepage-demo/claim-continuation-identity.server.ts
?? lib/homepage-demo/claim-repository.server.test.ts
?? lib/homepage-demo/claim-save-repository.server.test.ts
?? supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.sql
?? supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.test.ts
```

Handoff files modified:

```text
M  docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md
M  docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.docx
```

Unrelated/untracked:

```text
?? .claude/
```

### 30.24 Git Operations

- Staged: **NO**
- Commit: **NO**
- Push: **NO**
- Deploy: **NO**

### 30.25 Go / No-Go For Phase 2C

**YES — backend is sufficiently safe to begin Phase 2C after human review of the migration/source diff.**

Phase 2C must not begin automatically.

### 30.26 Exact Continuation Point

Next milestone:

**PHASE 2C — CONVERSION UX IMPLEMENTATION**

**NOT STARTED.**

Phase 2C should implement the approved Phase 2A public UX changes: same-tab review navigation, final conversion copy, CTA hierarchy, and mobile/accessibility polish. Do not begin it without explicit instruction.

---

## 31. Phase 2C -- Conversion UX Implementation

**Status: PASS.**

Phase 2C implemented the approved user-facing Live Demo conversion experience without changing the Phase 2B backend security model, without adding a migration, and without applying production Supabase changes.

### 31.1 Final User Journey

1. Visitor submits the homepage Live Demo.
2. Extraction succeeds.
3. The same browser tab navigates to `/homepage-demo/review#{publicToken}`.
4. The review page immediately removes the fragment from browser history before calling the review API.
5. The user sees the extracted project, tasks, client details, budget/deadline/priority fields, and temporary-preview notice.
6. The primary conversion action is **Save project free**.
7. The returning-user action is **Already have an account? Log in**.
8. Both account actions still call claim/prepare first, establishing or reusing the Phase 2B pending-auth continuation.
9. Signup/login intent is preserved through `/signup?intent=homepage-demo-claim` or `/login?intent=homepage-demo-claim`.
10. Final authenticated save still ends in authoritative `demo_claim_saved` behavior.

### 31.2 Same-Tab Navigation

Implemented in `app/components/landing/HomepageLiveDemoClient.tsx`.

Removed:

- desktop `window.open(...)`
- named review window target
- desktop media-query handoff
- popup-specific prepared-window replacement/focus logic
- obsolete post-navigation `done` state

Current successful extraction behavior:

```text
window.location.assign("/homepage-demo/review#" + publicToken)
```

This is identical on desktop and mobile. The public review bearer remains in the URL fragment and is never moved into the query string or pathname.

### 31.3 Final Review Copy

Implemented in `app/homepage-demo/review/page.tsx` and `app/homepage-demo/review/HomepageDemoReviewClient.tsx`.

Headline:

```text
Your project is ready
```

Supporting copy:

```text
Save this project to your free Text2Task workspace and keep working with its tasks, client details, deadline, budget, and notes.
```

Primary CTA:

```text
Save project free
```

Secondary CTA:

```text
Already have an account? Log in
```

Microcopy:

```text
30 total AI extracts included. No credit card required.
```

Temporary-preview copy:

```text
This is a temporary preview. Save it to your workspace to keep the project and tasks.
```

### 31.4 Copy Truthfulness

Revalidated from current source before shipping:

- `app/api/extract/route.ts` sets `FREE_EXTRACT_LIMIT = 30`.
- `app/api/extract-image/route.ts` sets `FREE_EXTRACT_LIMIT = 30`.
- `app/terms/page.tsx` states Free users are limited to 30 total AI extracts.
- `app/signup/page.tsx` says users can start free with 30 AI extracts.
- Signup UI requires name/email/password, not card details.
- Payment card collection is tied to billing/Pro checkout flows, not free account creation.

The supporting copy is capability copy. Review payload fields for client details, deadline, budget, notes, and tasks are optional and displayed as present or `Not specified`; the copy does not claim every extraction contains every optional field.

### 31.5 CTA Behavior

Primary CTA:

```text
Save project free
-> POST /api/homepage-demo/claim/prepare
-> /signup?intent=homepage-demo-claim
```

Secondary CTA:

```text
Already have an account? Log in
-> POST /api/homepage-demo/claim/prepare
-> /login?intent=homepage-demo-claim
```

Phase 2C did not bypass claim/prepare, did not duplicate continuation logic in the browser, and did not add client-side TTL logic.

### 31.6 Analytics Semantics

Preserved:

- `demo_review_viewed`
- `demo_account_cta_clicked`
- `demo_claim_saved`

Deliberate Phase 2C decision:

- Visible CTA label changed from `Start for free` to `Save project free`.
- Analytics enum remains `start_free` for the signup/account-creation conversion path.
- Returning-user enum remains `log_in`.

This avoids fragmenting the existing Phase 1B/Admin conversion funnel.

Analytics request remains low-cardinality and token-free:

```text
event_name
cta
page_path = /homepage-demo/review
```

No review token, draft title, task content, user-generated text, hash fragment, query-string bearer, or pathname bearer is sent in CTA analytics metadata.

### 31.7 Non-Ready / Failure States

Expired/unavailable review states remain semantically separate from valid save-ready reviews.

They do not show **Save project free**.

The fallback generic signup link remains **Start for free** and is not counted as `demo_account_cta_clicked`.

Claim-prepare failure still keeps the user on the review page and shows the existing retry-oriented safe message:

```text
We couldn't prepare your project. Please try again.
```

Analytics beacon failure still does not block claim prepare or navigation.

### 31.8 Mobile / Desktop / Accessibility

Mobile:

- same-tab navigation
- no popup dependency
- full-width stacked CTAs under the existing `max-width: 720px` CSS
- long secondary CTA centered and allowed to wrap
- no horizontal overflow introduced by Phase 2C styles

Desktop:

- same-tab navigation
- browser Back returns naturally to the homepage/session history
- no second tab/window opens
- extracted result remains visible with conversion actions in the preview panel

Accessibility:

- one clear H1 on the page: `Your project is ready`
- conversion CTAs remain real `<button>` elements because they perform claim/prepare before navigation
- fallback/recovery navigation remains real links
- visible focus styles remain on logo/actions
- disabled/loading state remains on CTAs during claim preparation
- error/status messages keep `role="alert"` / `role="status"` where already present
- no nested interactive controls added

### 31.9 Token / Privacy Security

Verified:

- review token remains after `#`
- no query-string token
- no pathname token
- no analytics token
- CTA analytics uses static `/homepage-demo/review` page path
- review page continues immediate fragment cleanup with `history.replaceState`
- review/claim fetches keep no-referrer/no-store/same-origin conventions
- no console logging added
- no SEO/sitemap change made
- review route noindex/nofollow/nocache/noimageindex metadata preserved

### 31.10 Claim Continuity Integration

Phase 2C uses Phase 2B exactly as intended:

- `Save project free` and `Already have an account? Log in` call the existing client `prepareClaimAndNavigate(...)` path.
- `prepareClaimAndNavigate(...)` posts to `/api/homepage-demo/claim/prepare`.
- Phase 2B continuation cookie/RPC behavior remains server-owned.
- Signup/login intent remains `homepage-demo-claim`.
- Save/save-anyway continuation-aware backend remains unchanged.

### 31.11 Files Changed By Phase 2C

| File | Status | Purpose |
|---|---|---|
| `app/components/landing/HomepageLiveDemoClient.tsx` | Modified | Removes desktop popup/named-window handoff and uses same-tab review fragment navigation. |
| `app/components/landing/HomepageLiveDemoClient.test.tsx` | Added | Covers same-tab desktop/mobile navigation, no popup, hash token transport, failed extraction, invalid token, no double navigation, and loading behavior. |
| `app/homepage-demo/review/page.tsx` | Modified | Updates primary H1/supporting copy and metadata copy while preserving noindex posture. |
| `app/homepage-demo/review/page.test.tsx` | Added | Covers primary H1/supporting copy and noindex metadata. |
| `app/homepage-demo/review/HomepageDemoReviewClient.tsx` | Modified | Updates temporary-preview copy, primary/secondary CTA labels, and free-plan microcopy while preserving claim prepare. |
| `app/homepage-demo/review/HomepageDemoReviewClient.test.tsx` | Modified | Covers Phase 2C copy, visible extracted result, CTA behavior, analytics enum preservation, token-free analytics, and fallback non-counting behavior. |
| `app/homepage-demo/review/homepage-demo-review.module.css` | Modified | Adds microcopy styling and centers/wraps CTA text for mobile/desktop robustness. |
| `docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md` | Modified | Appends Phase 2C implementation record. |
| `docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.docx` | Modified | Mirrors Phase 2C implementation record. |

### 31.12 Validation Results

Focused Phase 2C UX tests:

```text
npm.cmd test -- app/components/landing/HomepageLiveDemoClient.test.tsx app/homepage-demo/review/HomepageDemoReviewClient.test.tsx app/homepage-demo/review/page.test.tsx
Test Files: 3 passed
Tests: 21 passed
```

Targeted Phase 2C/Phase 2B/Admin/auth/analytics tests:

```text
npm.cmd test -- app/components/landing/HomepageLiveDemoClient.test.tsx app/homepage-demo/review app/api/homepage-demo/claim/prepare/route.test.ts lib/homepage-demo/claim-repository.server.test.ts lib/homepage-demo/claim-save-repository.server.test.ts supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.test.ts lib/analytics/live-demo-funnel.test.ts app/admin/analytics/page.test.tsx app/api/auth/signup/route.test.ts app/api/auth/login/route.test.ts app/auth/confirm/route.test.ts app/auth/oauth/callback/route.test.ts
Test Files: 13 passed
Tests: 150 passed
```

All homepage-demo slice:

```text
npm.cmd test -- app/api/homepage-demo app/homepage-demo lib/homepage-demo supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.test.ts
Test Files: 10 passed
Tests: 171 passed
```

Full repository tests:

```text
npm.cmd test
Test Files: 214 passed
Tests: 5467 passed
Failed: 0
Skipped: 0
```

TypeScript:

```text
npx.cmd tsc --noEmit
PASS
```

Changed-file lint:

```text
npx.cmd eslint app/components/landing/HomepageLiveDemoClient.tsx app/components/landing/HomepageLiveDemoClient.test.tsx app/homepage-demo/review/page.tsx app/homepage-demo/review/page.test.tsx app/homepage-demo/review/HomepageDemoReviewClient.tsx app/homepage-demo/review/HomepageDemoReviewClient.test.tsx
PASS
```

Full-project lint:

```text
npm.cmd run lint
FAIL -- unrelated pre-existing app/components/dashboard/tasks/share-link/share-link-channels.tsx react-hooks/set-state-in-effect error remains, plus unrelated warnings.
```

Production build:

```text
npm.cmd run build
PASS with network-enabled execution for Google Fonts.
```

Note: Vitest still prints jsdom's known `Not implemented: navigation to another Document` message during link-click navigation tests, but all affected test commands exited successfully.

### 31.13 Database / Infrastructure

| Item | Status |
|---|---|
| Phase 2B migration source exists | YES |
| New Phase 2C migration | NO |
| Production Supabase changed | NO |
| Environment changed | NO |
| Vercel changed | NO |
| Production deploy | NO |

Read-only migration sanity check for `supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.sql`:

- additive `homepage_demo_claims` nullable columns remain present
- no destructive schema DDL found
- existing rows remain valid under nullable/default-safe additions
- v2 RPCs required by current source remain present
- direct browser grants were not widened
- retention deletes are existing maintenance-path behavior and continue to protect active pending continuations

The migration was not applied.

### 31.14 Discovered Issues -- Not Fixed

- Full-repo lint still fails on unrelated `app/components/dashboard/tasks/share-link/share-link-channels.tsx` with `react-hooks/set-state-in-effect`.
- Full-repo lint also reports unrelated warnings in project-update/share tests and share-link configuration/access-control files.
- Git continues to warn that `C:\Users\Home/.config/git/ignore` cannot be accessed due permission denial.
- Unrelated untracked `.claude/` remains untouched.

### 31.15 Production Behavior Changes

Public UX behavior changed only for the Live Demo conversion flow:

- desktop no longer opens a popup/new named review window
- desktop and mobile now navigate same-tab to the review hash URL
- ready review copy and CTA hierarchy now emphasize saving generated work

No database behavior, billing behavior, pricing, Free limit, Admin funnel semantics, analytics event names, continuation TTL, SEO initiative, dashboard behavior, or duplicate detection behavior was changed by Phase 2C.

### 31.16 Required Eventual Production Rollout Order

Do not deploy app code that depends on Phase 2B/2C before the database source migration is verified and applied.

Required order:

1. Verify final migration source.
2. Apply `202609030001_homepage_demo_claim_auth_continuation.sql` to production Supabase.
3. Verify new columns and v2 RPCs/schema in production.
4. Only then push/deploy application code that depends on those v2 RPCs.
5. Verify Live Demo -> review -> signup/login -> claim continuation in production.
6. Verify duplicate handling.
7. Verify Admin analytics after production traffic.

Migration-before-app is mandatory because current Phase 2B source calls v2 RPCs introduced by the migration.

### 31.17 Full Worktree Snapshot

Branch/HEAD at pre-flight:

```text
Branch: main
HEAD: c0606ba
```

Phase 2B backend/migration files present in worktree:

```text
M  app/api/homepage-demo/claim/prepare/route.test.ts
M  app/api/homepage-demo/claim/prepare/route.ts
M  app/api/homepage-demo/claim/save-anyway/route.test.ts
M  app/api/homepage-demo/claim/save-anyway/route.ts
M  app/api/homepage-demo/claim/save/route.test.ts
M  app/api/homepage-demo/claim/save/route.ts
M  lib/homepage-demo/claim-duplicate-override-repository.server.ts
M  lib/homepage-demo/claim-repository.server.ts
M  lib/homepage-demo/claim-save-repository.server.ts
M  lib/homepage-demo/types.ts
?? lib/homepage-demo/claim-continuation-identity.server.ts
?? lib/homepage-demo/claim-repository.server.test.ts
?? lib/homepage-demo/claim-save-repository.server.test.ts
?? supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.sql
?? supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.test.ts
```

Phase 2C UX files:

```text
M  app/components/landing/HomepageLiveDemoClient.tsx
M  app/homepage-demo/review/HomepageDemoReviewClient.test.tsx
M  app/homepage-demo/review/HomepageDemoReviewClient.tsx
M  app/homepage-demo/review/homepage-demo-review.module.css
M  app/homepage-demo/review/page.tsx
?? app/components/landing/HomepageLiveDemoClient.test.tsx
?? app/homepage-demo/review/page.test.tsx
```

Handoff files:

```text
M  docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md
M  docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.docx
```

Unrelated existing/untracked:

```text
?? .claude/
```

No files were staged.

### 31.18 Git Operations

- Staged: **NO**
- Commit: **NO**
- Push: **NO**
- Deploy: **NO**
- Production migration applied: **NO**

### 31.19 Go / No-Go For Phase 2D

**YES -- Phase 2C implementation is ready for final production-readiness verification.**

### 31.20 Exact Next Step

Next milestone:

**PHASE 2D -- FINAL PRODUCTION READINESS VERIFICATION**

**NOT STARTED.**

Do not begin Phase 2D automatically. Do not apply production migration, stage, commit, push, or deploy.

## 32. Phase 2D -- Final Production Readiness Verification

Date: 2026-09-04

Status: **POST-GOVERNANCE FINAL PRE-COMMIT VALIDATION STAGE**

The Live Demo source implementation is internally consistent and validated. The former database-governance blocker is closed by the dedicated local governance commit `1ed7f1f` (`Canonicalize Supabase migration baseline and governance`). Production migration history is now aligned to the canonical lineage:

```text
20260615222035
202609040001
```

The historical `202609030001_homepage_demo_claim_auth_continuation.sql` migration is archive/provenance only. Its required production schema effects are represented by the active canonical production closure, `202609040001_canonical_production_closure.sql`.

### 32.1 Final Architecture Status

The completed flow is:

1. Anonymous visitor runs the Live Demo.
2. Successful extraction writes the demo trial/draft state and navigates same-tab to `/homepage-demo/review#<public-review-token>`.
3. The review page loads the server-built review projection and removes the hash token from browser history.
4. The review page records `demo_review_viewed` server-side and offers `Save project free` plus `Already have an account? Log in`.
5. Clicking either account CTA prepares a claim and starts/reuses a bounded pending-auth continuation.
6. Signup, email confirmation, login, or OAuth carries only `intent=homepage-demo-claim`; no claim bearer is placed in email/OAuth URLs.
7. `/homepage-demo/claim/continue` requires an authenticated user and calls the save route.
8. The save route uses the claim cookie or continuation cookie, calls the v2 service-role RPC, preserves duplicate detection/override, clears bearer cookies on success, and redirects to the dashboard.
9. Admin analytics keeps Business Conversion separate from Operational Health.

### 32.2 Migration To Source Contract

Result: **PASS**

Verified RPCs and source call sites agree on names, argument names, return columns, nullable values, and outcome strings:

- `prepare_homepage_demo_claim_auth_continuation(p_claim_token_hash, p_existing_continuation_token_hash, p_candidate_continuation_token_hash, p_continuation_ttl_seconds) returns (outcome, set_cookie, expires_at)`
- `claim_homepage_demo_project_v2(p_claim_token_hash, p_auth_continuation_token_hash, p_authenticated_user_id, p_request_hash, p_import_groups, p_duplicate_check_passed) returns (outcome, saved_project_id, created)`
- `prepare_homepage_demo_duplicate_override_v2(p_claim_token_hash, p_auth_continuation_token_hash, p_authenticated_user_id, p_existing_authority_token_hash, p_candidate_authority_token_hash, p_request_hash, p_import_groups) returns (outcome, set_cookie, expires_at)`
- `claim_homepage_demo_project_with_duplicate_override_v2(p_claim_token_hash, p_auth_continuation_token_hash, p_authenticated_user_id, p_authority_token_hash, p_request_hash, p_import_groups) returns (outcome, saved_project_id, created)`

Source schemas accept the SQL outcomes:

- continuation prepare: `continuation_prepared`, `continuation_reused`, `continuation_in_progress`, `already_claimed`, `expired`, `invalid_claim`
- normal claim save: `saved`, `already_claimed`, `duplicate_detected`, `expired`, `invalid_claim`, `draft_unavailable`
- duplicate override prepare: `authority_prepared`, `authority_reused`, `authority_in_progress`, `already_claimed`, `expired`, `invalid_claim`
- duplicate override claim: `saved`, `already_claimed`, `expired`, `invalid_claim`, `draft_unavailable`, `duplicate_authority_unavailable`, `duplicate_authority_expired`, `duplicate_detected`

No source/migration drift was found.

### 32.3 Migration Safety

Result: **PASS**

The migration is additive and service-role-only:

- adds nullable continuation columns to `homepage_demo_claims`
- adds lifecycle/hash constraints compatible with old rows where continuation fields are all null
- adds partial indexes for continuation token lookup and active pending-continuation cleanup
- creates/replaces service-role-only v2 RPCs
- redefines cleanup RPCs to protect only active pending continuations
- revokes function execution from `public`, `anon`, and `authenticated`
- grants new v2 RPC execution to `service_role` only
- does not store raw continuation tokens
- does not grant browser-facing access
- does not use `security definer`
- no `drop table`, `drop column`, `rename`, or `truncate` was found

Changed/created database objects:

- columns: `homepage_demo_claims.auth_continuation_token_hash`, `auth_continuation_started_at`, `auth_continuation_expires_at`, `auth_continuation_consumed_at`
- constraints: `homepage_demo_claims_auth_continuation_token_hash_check`, `homepage_demo_claims_auth_continuation_lifecycle_check`
- indexes: `homepage_demo_claims_auth_continuation_token_hash_unique_idx`, `homepage_demo_claims_pending_auth_continuation_expiry_idx`
- functions: `prepare_homepage_demo_claim_auth_continuation`, `claim_homepage_demo_project_v2`, `prepare_homepage_demo_duplicate_override_v2`, `claim_homepage_demo_project_with_duplicate_override_v2`
- maintenance functions redefined: `purge_expired_homepage_demo_trials(integer)`, `purge_homepage_demo_retention(integer)`

### 32.4 Canonical Migration Status

Result: **PASS**

Post-governance active canonical migrations:

```text
supabase/migrations/20260615222035_remote_schema.sql
supabase/migrations/202609040001_canonical_production_closure.sql
```

The former standalone Live Demo continuation migration is no longer an active migration:

```text
docs/database/migration-archive/precanonical-2026-09-04/202609030001_homepage_demo_claim_auth_continuation.sql
docs/database/migration-archive/precanonical-2026-09-04/tests/202609030001_homepage_demo_claim_auth_continuation.test.ts
```

Governance recovery verified:

- canonical rebuild parity
- `APPLICATION_DRIFT = 0`
- security gates PASS
- cron VERIFIED
- migration-history reconciliation complete
- `db push --dry-run` reported `Remote database is up to date`

### 32.5 Deployment Compatibility Matrix

| State | Classification | Notes |
| --- | --- | --- |
| Old DB + Old App | Safe | Current production state. |
| New DB + Old App | Safe | Migration is additive; old app can keep using existing paths while nullable columns and new RPCs sit unused. |
| New DB + New App | Safe | Final intended state after migration verification and app deployment. |
| Old DB + New App | Unsafe / not allowed | New app depends on v2 RPCs and continuation columns introduced by the migration. |

The safe rollout path is: Old DB + Old App -> New DB + Old App -> New DB + New App.

### 32.6 Rollback Model

If the app deployment fails or must be reverted after the migration is applied, roll back the application to the previous production version and leave the additive DB migration in place. `New DB + Old App` is safe, so a destructive database rollback is not required and should be avoided.

If the migration fails before app deployment, do not deploy the app. Resolve the migration failure while production remains in Old DB + Old App.

If the new app is deployed accidentally before the migration, treat it as an incident and roll back the app immediately; Old DB + New App is not supported.

### 32.7 Claim Continuity Security

Result: **PASS**

- continuation starts only after a valid claim prepare path
- first continuation start fixes the expiry window
- retry/reuse does not slide the expiry indefinitely
- server/RPC controls expiry
- raw continuation token is only in an HttpOnly cookie; only the hash is persisted
- final save requires authenticated Supabase user
- client cannot choose `authenticated_user_id`
- SQL validates user/claim ownership and prevents cross-user stealing
- already-claimed replay is idempotent
- duplicate detection and save-anyway authority remain scoped to the claim/user/request
- expired continuation fails closed
- never-started continuation cannot resurrect an expired demo
- analytics never grants authority

### 32.8 Auth Flow Verification

Email confirmation: **PASS**

- `intent=homepage-demo-claim` survives signup and `/auth/confirm`
- email confirmation redirects to `/homepage-demo/claim/continue`
- no claim bearer token travels in the email URL
- delayed confirmation inside continuation TTL can save
- expired continuation fails closed
- normal non-demo confirmation remains unchanged

Google OAuth: **PASS**

- intent is preserved through OAuth callback
- no claim bearer token is placed in OAuth callback/query state by this flow
- cancelled or failed OAuth redirects preserve retry intent without consuming the continuation
- successful OAuth uses authenticated user and continuation cookie
- normal non-demo OAuth remains unchanged

Existing user login: **PASS**

- login CTA prepares continuation before leaving the review page
- failed login does not consume continuation
- retry within TTL works
- successful login uses authenticated user server-side
- normal login destination remains unchanged when no demo intent is present

### 32.9 Same-Tab UX And Copy Truth

Result: **PASS**

Desktop and mobile Live Demo success both use same-tab navigation to `/homepage-demo/review#<public-review-token>`. No executable `window.open`, named review window, popup fallback, or desktop/mobile handoff remains in the Live Demo success path. Remaining popup/window-open code is unrelated dashboard/share-link behavior.

Current production copy is truthful:

- `Your project is ready`
- `Save project free`
- `Already have an account? Log in`
- `30 total AI extracts included. No credit card required.`

The 30-extract Free plan statement matches existing Terms/signup copy. No pricing, billing, card requirement, SEO, or Free-plan logic was changed.

### 32.10 Analytics And Admin Funnel

Result: **PASS**

Event semantics remain:

- `homepage_demo_extract_attempt`
- `homepage_demo_extract_succeeded`
- `demo_review_viewed`
- `demo_account_cta_clicked`
- `signup_success`
- `login_success`
- `demo_claim_saved`

Same-tab navigation does not add a new event. `Save project free` still emits CTA metadata `start_free`; `Already have an account? Log in` emits `log_in`. `demo_claim_saved` is server-authoritative and scheduled only for `saved` / authorized `already_claimed` outcomes with claim-id idempotency. Claim continuation does not inflate saves.

Admin still separates:

- Business Conversion: attempts, successful demos, review reached, observed CTA clicks, claims saved
- Operational Health: attempts, succeeded, failed, error/failure stages

Owner business exclusion, owner health inclusion, best-effort CTA labeling, null anonymous-id handling, and no CTA-denominator rate remain intact.

### 32.11 Retention And Cookies

Result: **PASS**

Retention behavior:

- ordinary expired demos keep cleanup behavior
- active pending continuation protects source rows
- expired/consumed continuation no longer protects rows
- claimed data follows existing claimed retention behavior
- no unbounded retention was introduced

Cookie inventory:

- analytics anonymous id: client/browser analytics correlation only, not authority
- owner exclusion: `t2t_owner_analytics_excluded=1`, HttpOnly, SameSite lax, path `/`, secure in production, 180-day max age; analytics-only
- demo session: production `__Host-t2t_homepage_demo_session`, HttpOnly, SameSite lax, path `/`, secure in production, 1-hour max age
- demo device: production `__Host-t2t_homepage_demo_device`, HttpOnly, SameSite lax, path `/`, secure in production, 30-day max age
- claim: production `__Host-t2t_homepage_demo_claim`, HttpOnly, SameSite lax, path `/`, secure in production, bounded by claim/trial/draft expiry
- continuation: production `__Host-t2t_homepage_demo_claim_continuation`, HttpOnly, SameSite lax, path `/`, secure in production, max age derived from server/RPC expiry

Protected bearer material does not depend on JavaScript-readable storage.

### 32.12 Race / Retry Safety

Result: **PASS**

- repeated CTA clicks: client state and server continuation reuse/in-progress handling prevent unsafe duplication
- two claim/prepare requests: one continuation wins; same token can be reused; competing token gets in-progress
- two auth callback hits: continuation remains reusable until consumed/expired
- page refresh on claim continuation: save is idempotent and already-claimed replay is safe
- two claim/save requests: SQL returns one saved project, then already-claimed/idempotent outcome
- normal save racing save-anyway: duplicate authority and claim ownership checks keep outcomes deterministic
- continuation expiring during auth: save fails closed as expired/unavailable
- duplicate detected then override: override authority is scoped and expires; save-anyway remains authorization-safe

No P0 uncovered correctness gap was found, so no additional Phase 2D code/test changes were made.

### 32.13 Final Validation

Fresh Phase 2D validation results:

```text
Phase 2B continuation tests:
npm.cmd test -- lib/homepage-demo/claim-repository.server.test.ts lib/homepage-demo/claim-save-repository.server.test.ts supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.test.ts app/api/homepage-demo/claim/prepare/route.test.ts app/api/homepage-demo/claim/save/route.test.ts app/api/homepage-demo/claim/save-anyway/route.test.ts
PASS -- 6 files, 102 tests

Phase 2C UX tests:
npm.cmd test -- app/components/landing/HomepageLiveDemoClient.test.tsx app/homepage-demo/review/HomepageDemoReviewClient.test.tsx app/homepage-demo/review/page.test.tsx
PASS -- 3 files, 21 tests

Homepage Demo slice:
npm.cmd test -- app/api/homepage-demo app/homepage-demo lib/homepage-demo supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.test.ts
PASS -- 10 files, 171 tests

Auth intent:
npm.cmd test -- app/api/auth/signup/route.test.ts app/auth/confirm/route.test.ts app/api/auth/login/route.test.ts app/auth/oauth/callback/route.test.ts
PASS -- 4 files, 59 tests

Analytics/Admin/Migration:
npm.cmd test -- lib/analytics/live-demo-funnel.test.ts app/admin/analytics/page.test.tsx app/api/analytics/event/route.test.ts supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.test.ts
PASS -- 4 files, 79 tests

Full repository:
npm.cmd test
PASS -- 214 files, 5467 tests

TypeScript:
npx.cmd tsc --noEmit
PASS

Changed-file lint:
npx.cmd eslint <Phase 2B/2C changed TS/TSX files and migration static test>
PASS

Full lint:
npm.cmd run lint
FAIL -- unrelated pre-existing share-link-channels.tsx react-hooks/set-state-in-effect plus unrelated warnings

Production build:
npm.cmd run build
PASS -- Next.js 16.1.6 / Turbopack production build

Whitespace:
git diff --check
PASS -- only CRLF normalization warnings
```

Vitest/jsdom printed the expected `Not implemented: navigation to another Document` message during navigation tests; all assertions passed.

### 32.14 Release Blockers And Non-Blockers

Blockers before the dedicated Live Demo commit:

- final local validation must pass after this closeout update
- the Live Demo commit must remain separate from the already completed governance commit

Non-blockers:

- full-repo lint previously had an unrelated pre-existing `app/components/dashboard/tasks/share-link/share-link-channels.tsx` `react-hooks/set-state-in-effect` error
- Git may warn about inaccessible `C:\Users\Home/.config/git/ignore`
- jsdom navigation limitation messages may appear in tests but do not fail assertions
- CRLF normalization warnings may appear in `git diff --check`

No production database, staging database, environment, Vercel, Git staging, commit, push, or deployment change was made by this handoff update.

### 32.15 Current Production Database And Governance Status

The database-governance blocker is **CLOSED**.

Production migration history is aligned to the canonical lineage:

```text
20260615222035
202609040001
```

The historical migration:

```text
202609030001_homepage_demo_claim_auth_continuation.sql
```

is archive/provenance only and is not an active canonical migration. Its required production schema effects are represented by:

```text
supabase/migrations/202609040001_canonical_production_closure.sql
```

Governance recovery evidence:

- canonical rebuild parity verified
- `APPLICATION_DRIFT = 0`
- security gates PASS
- cron VERIFIED
- migration-history reconciliation complete
- post-repair `db push --dry-run` returned `Remote database is up to date`

Dedicated local governance commit:

```text
1ed7f1f Canonicalize Supabase migration baseline and governance
```

### 32.16 Exact Production Smoke Test After App Deployment

1. Anonymous homepage demo succeeds and navigates same-tab to review.
2. Review page shows the generated project/tasks and Phase 2C copy.
3. `Save project free` -> signup -> project saved to dashboard.
4. `Already have an account? Log in` -> login -> project saved to dashboard.
5. Google OAuth signup/login preserves the claim and saves.
6. Email confirmation preserves the claim and saves.
7. Delayed auth where original demo TTL has expired but continuation TTL remains valid still saves.
8. Expired continuation fails closed safely.
9. Duplicate project flow shows duplicate handling and save-anyway remains intact.
10. Admin Business Conversion shows appropriate events with owner-identifiable traffic excluded.
11. Admin Live Demo Health still includes owner/admin operational traffic.
12. Normal signup/login not originating from Demo still follows normal destinations.

Owner production testing:

- Prefer an owner-recognized browser where verified owner login has set the owner exclusion cookie.
- Fresh/incognito owner tests may appear as real business traffic until a verified owner signal exists.
- Do not add a special bypass for testing.

### 32.17 Current Commit Boundary

Live Demo application work remains uncommitted and must be kept as a separate commit boundary from `1ed7f1f`.

Include in the Live Demo conversion commit:

```text
app/api/homepage-demo/claim/prepare/route.test.ts
app/api/homepage-demo/claim/prepare/route.ts
app/api/homepage-demo/claim/save-anyway/route.test.ts
app/api/homepage-demo/claim/save-anyway/route.ts
app/api/homepage-demo/claim/save/route.test.ts
app/api/homepage-demo/claim/save/route.ts
app/components/landing/HomepageLiveDemoClient.tsx
app/components/landing/HomepageLiveDemoClient.test.tsx
app/homepage-demo/claim/continue/HomepageDemoClaimContinuationClient.test.tsx
app/homepage-demo/review/HomepageDemoReviewClient.test.tsx
app/homepage-demo/review/HomepageDemoReviewClient.tsx
app/homepage-demo/review/homepage-demo-review.module.css
app/homepage-demo/review/page.test.tsx
app/homepage-demo/review/page.tsx
docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.docx
docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md
lib/homepage-demo/claim-continuation-identity.server.ts
lib/homepage-demo/claim-duplicate-override-repository.server.ts
lib/homepage-demo/claim-repository.server.test.ts
lib/homepage-demo/claim-repository.server.ts
lib/homepage-demo/claim-save-repository.server.test.ts
lib/homepage-demo/claim-save-repository.server.ts
lib/homepage-demo/types.ts
```

Do not include:

```text
supabase/.temp/
supabase/config.toml
any Supabase project-ref/link/cache metadata
any database password, access token, connection URI, or production credential
the archived 202609030001 migration or its archived test
already committed migration-governance files
```

Recommended Live Demo commit message:

```text
Implement homepage demo claim continuation and conversion UX
```

### 32.18 Push / Deploy Order

No production application rollout has happened yet.

After this closeout:

1. Run final local validation.
2. Create the dedicated Live Demo commit.
3. Do not push until explicitly approved.
4. Run production deployment and smoke checks only after push/release approval.
5. If the new app deployment misbehaves, roll back the app; the canonical database state should remain in place.

### 32.19 Current Phase Status

```text
Phase 0A: COMPLETE
Phase 0B: COMPLETE
Phase 1A: COMPLETE
Phase 1B: COMPLETE
Phase 1C: COMPLETE
Phase 1D: COMPLETE
Phase 2A: COMPLETE
Phase 2B: COMPLETE
Phase 2C: COMPLETE
Phase 2D: final rollout/pre-commit validation stage
```

### 32.20 Claim Continuation Status

Claim continuation is implemented with:

- server-created continuation authority
- purpose-scoped token/hash
- HttpOnly SameSite=Lax cookie
- production `__Host-` cookie naming
- bounded TTL
- hash-only DB persistence
- successful post-auth save
- duplicate override compatibility

### 32.21 Review UX Status

Review UX currently includes:

- same-tab navigation
- fragment token
- `Your project is ready`
- `Save project free`
- `Already have an account? Log in`
- `30 total AI extracts included. No credit card required.`

### 32.22 Analytics Status

Analytics currently includes:

- anonymous_id continuity
- `demo_review_viewed`
- `demo_account_cta_clicked`
- `demo_claim_saved`
- `login_success`
- owner exclusion for the business funnel
- operational health still includes owner/admin traffic where intended

### 32.23 Git / Production Operations

- Staged: **NO**
- Commit: **NO**
- Push: **NO**
- Deploy: **NO**
- Production application rollout: **NO**
- Production database changed by this closeout: **NO**
- Staging database changed by this closeout: **NO**

### 32.24 Final Next Step

**Run final local validation, then prepare the dedicated Live Demo conversion commit. Do not push until explicitly approved.**
