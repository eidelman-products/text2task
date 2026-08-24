# Text2Task Client Share — Phase 7
## Hardening — Mapping / Audit, then Implementation Slices 7A + 7B + 7C + 7D — Status: `PHASE_7_COMPLETE`
## 2026-08-24 (audit) / 2026-08-24 (7A: header hardening) / 2026-08-24 (7B: abuse/session/resource hardening) / 2026-08-24 (7C: identity/owner-lifecycle/live-invalidation) / 2026-08-24 (7D: owner-configuration closure, mobile/RTL/accessibility, proxy test closure, final reconciliation) / 2026-08-24 (0E: user's full production build recorded, Phase 7 closed)

**Sections 1–25 below are the original, unmodified read-only mapping/audit — no application code, migration, generator, or SQL was written or run to produce them.** Section 0 records the Phase 7A header-hardening slice; §0B records the subsequent Phase 7B abuse/session/resource-hardening slice; §0C records the subsequent Phase 7C identity/owner-lifecycle/live-invalidation slice; §0D records the subsequent Phase 7D product-hardening closure slice, including the final gap-reconciliation matrix (§0D.8) that accounts for every item this document ever found; §0E, immediately after it, records the user's own full production build (PASS) and closes Phase 7 as `PHASE_7_COMPLETE`. No known Client Share V1 product gap remains open — see §0D.8 for the item-by-item evidence and §0E for the build record that satisfies the one remaining precondition for closure. Phase 8 (Production rollout / feature-flag mapping-audit) has not started.

---

## 0. Implementation record — minimal accepted slice (this turn)

**What was implemented**: exactly the three items from §20 below, nothing more.

1. `X-Robots-Tag: noindex, nofollow, noarchive` added to the shared `NO_STORE_HEADERS` constant in all four public API route files (`app/api/share/session/route.ts`, `app/api/share/[publicId]/projection/route.ts`, `app/api/share/[publicId]/messages/route.ts`, `app/api/share/[publicId]/resources/[fileRef]/route.ts`), plus `lib/share/share-file-response.server.ts`'s `SHARE_FILE_RESPONSE_SECURITY_HEADERS` (the file-streaming success path, which does not go through any route's own `jsonResponse()` helper). Present on every success and every error branch in each file, since all of them share one constant.
2. `frame-ancestors 'none'` added to the file-serving route's existing `Content-Security-Policy` (now `"sandbox; frame-ancestors 'none'"`, in `share-file-response.server.ts`), mirroring the public page's own CSP exactly. No other CSP directive was touched; `script-src` remains deliberately out of scope (§17 item 4, §20).
3. A conservative `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()` added to `proxy.ts`'s `SHARE_PUBLIC_PAGE_HEADERS` (the page) and to the same five files/constants as item 1 (the API routes and the file-streaming response). Verified via repository-wide grep that none of camera/mediaDevices/geolocation/clipboard/fullscreen/payment APIs are used anywhere under `app/share/`, so denying all six is safe and breaks nothing.
4. Tests extended in `app/api/share/session/route.test.ts`, `app/api/share/[publicId]/projection/route.test.ts`, `app/api/share/[publicId]/messages/route.test.ts` (both POST and GET), `app/api/share/[publicId]/resources/[fileRef]/route.test.ts`, and `lib/share/share-file-response.server.test.ts` — new assertions on the actual `Response` headers (not source-scanning), covering both success and representative failure/rate-limited branches. Two **pre-existing** tests asserting the old literal `Content-Security-Policy: "sandbox"` value were also updated to the new value (`lib/share/share-file-response.server.test.ts` and `lib/share/share-streamed-delivery.spike.test.ts`) — without this, they would have failed against the new, intentional CSP change.

**What was explicitly NOT touched**, per this turn's own scope boundary — all still exactly as the audit found them: cross-tab/stale-page behavior, projection polling, focus/visibility revalidation, the cleanup sweep, secret-guessing bucket scope, malformed-request rate-limit design, file-bandwidth quota, `authorDisplayName` anti-impersonation, Disable/Revoke/Re-enable owner UI, mobile polish, RTL changes, accessibility partials, the Phase 6D optional UX findings, and the feature flag. No `fileRef`/HMAC logic, authorization, MIME resolution, `Content-Disposition`, storage access, or session/grant check was altered. No migration, no DB function, no business logic changed.

**Verification performed this turn**: targeted route/unit tests for every changed file (all passing), the full `app/api/share` + `lib/share` + `app/share` regression suite (1702/1702 passing, 43/43 files), and `npx tsc --noEmit` (clean). The user's own full production build has not been run — that remains the user's own action, per this whole engagement's standing discipline.

**This is not yet `PHASE_7_COMPLETE`** — that requires the user's own full build and explicit sign-off, which have not happened. Sections 1–25 below remain the original audit text, describing the state *before* this implementation; §17 and §20 in particular should be read as "here is what the audit found and proposed," now satisfied by §0 above for the three header items specifically.

---

## 0B. Implementation record — Phase 7B (abuse / session / resource hardening)

Resolves the remaining concrete audit findings in five categories: stale rate-limit/session cleanup, secret-guessing rate-limit scoping, malformed-request abuse accounting, public file/resource repeated-fetch abuse, and the reserved-but-unused `file_access` rate-limit scope. Explicitly did **not** address `authorDisplayName` spoofing, Disable/Revoke/Re-enable UI, stale-open-tab revalidation, mobile, RTL, accessibility, `proxy.ts` test scaffolding, the feature flag, or Production rollout — those remain later Phase 7 slices, unchanged.

**No migration was needed for any of this.** Every fix uses schema/action/scope values the original 202608030004 migration already defined (`file_access` was already a valid `action` in the CHECK constraint; `share_link` was already a valid `scope`; `service_role` already held `select/insert/update/delete` on all three ephemeral-state tables since 202608030005). Confirmed by direct migration read before writing any code, not assumed.

### 1. Cleanup / storage-growth

**Findings** (from direct schema inspection, `supabase/migrations/202608030004_client_share_session_foundation.sql`): `share_rate_limit_buckets`, `share_session_grants`, and `share_browser_sessions` each have an `expires_at` column and an index explicitly commented as being "for a future cleanup sweep" — none existed. Rows are created continuously (every session exchange, every rate-limit window) and never deleted, only ever excluded from active queries by `expires_at`/`revoked_at` predicates — pure indefinite storage growth, not a correctness issue (every read path already independently re-validates expiry live, so a stale row is never mistakenly treated as valid). `share_link_events` (the actual audit trail) was deliberately left untouched — its own retention policy is a separate, still-open product decision per the original master handoff, not something this slice should decide by side effect.

**Implementation**: new module `lib/share/share-state-cleanup.server.ts`, exporting `maybeScheduleShareStateCleanup()`. Design:
- **Never touches `revoked_at`** — only ever deletes rows whose own `expires_at` is more than 24 hours in the past. A revoked-but-not-yet-expired row is deliberately retained, matching the schema's own column comments ("Retained rather than deleted so revocation stays auditable"). Because a grant's `expires_at` can never exceed its parent session's `expires_at` (enforced by `enforce_share_session_grant_integrity`), sweeping sessions by `expires_at` alone can never orphan a still-valid grant — proved, not assumed, and directly unit-tested.
- **Bounded**: each table's sweep is a capped `SELECT ... LIMIT 200` feeding a targeted `DELETE ... WHERE id IN (...)` — never an unbounded `DELETE ... WHERE expires_at < X` that could lock an arbitrarily large row set.
- **No cron/scheduled infrastructure**: triggered probabilistically (2% chance, ~1-in-50 calls) from the existing session-exchange route, scheduled via `next/server`'s `after()` — the same, already-established repository pattern used by `app/api/activity/dashboard-visit/route.ts` and `lib/analytics/signup-attribution.server.ts` for "run after the response is sent, never block or fail the response."
- **Fails safely**: every failure mode (select error, delete error, scheduling error) is caught and logged (`console.warn`), never thrown. The session route additionally wraps the scheduling call in its own try/catch, so even a defect in the cleanup module's own internal guarantee could never fail the triggering request.
- **No privilege broadened**: uses the existing `supabaseAdmin` (`service_role`) client only, against grants `service_role` already holds.

**Tests**: `lib/share/share-state-cleanup.server.test.ts` (new, 10 tests) — probabilistic scheduling (hits/misses/never-throws), sweeps all three tables filtered by `expires_at` only, cutoff is genuinely in the past (grace period, not "now"), deletes exactly the stale rows a select returned and nothing when none are stale, one table's failure doesn't stop the others, never throws out of the scheduled callback. `app/api/share/session/route.test.ts` — two new tests confirming the route schedules cleanup on every invocation and that a thrown scheduling error still leaves the response at `200`.

### 2. Secret-guessing rate limit

**Before**: `session_exchange` was rate-limited only by `network_identity` scope (10/300s). An attacker rotating network identity/browser could keep guessing one specific link's secret indefinitely — the same class of gap `pin_verification` already closed via its own `share_link`-scoped bucket, but never applied to the secret itself.

**After**: a second, layered check inside `POST /api/share/session`, positioned after the link is resolved/confirmed-active/confirmed-to-have-a-secret but *before* the constant-time comparison, so it fires uniformly on every attempt — correct or wrong — revealing nothing extra about link existence beyond what the existing generic-denial pattern already reveals.

- **Scope**: `share_link` (schema-existing value, no migration).
- **Key derivation**: `createShareLinkRateLimitIdentityDigest(link.id)` — the same, already-existing, non-secret, deterministic per-link hash function `pin_verification` already uses. Never the raw secret or PIN.
- **Action**: `session_exchange` (reused, not a new action value — the schema's own scope/action design already permits combining an existing action with a second scope).
- **Limit/window**: 10/300s (shares `session_exchange`'s existing policy entry — no new numeric decision needed).
- **Failure**: `429 RATE_LIMITED` with `Retry-After`, identical shape to every other rate-limit exhaustion in this route.
- **Global protection preserved**: the pre-existing `network_identity`-scoped bucket is untouched; this is additive, layered defense, not a replacement.
- **Defense-in-depth acknowledged, not depended on**: the raw share secret is 256 bits of entropy (`lib/share/share-secret.server.ts`), making online guessing infeasible regardless of rate limit — this fix closes a real mechanism gap without claiming the secret itself was ever weak.

**Tests**: `app/api/share/session/route.test.ts` — 4 new tests: the bucket is consumed with the correct link id before the comparison; exhaustion returns 429 and never reaches the comparison; a *correct* guess still consumes the bucket exactly once (proving no enumeration signal); a different link uses a distinct identity (not incorrectly coupled).

### 3. Malformed-request abuse accounting

**Before**: in `POST /api/share/session`, every malformed-input rejection (bad Origin/Sec-Fetch-Site, invalid JSON, wrong content type, oversized body, schema-invalid publicId/secret/pin) returned before the `session_exchange` bucket was ever touched — a free, unmetered flood path. In `POST /api/share/[publicId]/messages`, the existing `comment_submission` bucket is `browser_session`-scoped, which *requires* an already-valid cookie to compute — so a request with no cookie, an invalid cookie, a malformed publicId, or a bad Origin header bypassed it entirely.

**After**:
- **Session route**: the existing `network_identity`-scoped `session_exchange` check was moved to be the very first thing the handler does, before origin validation, body parsing, or any format/schema check. It only needs `request.headers`, so nothing about a (possibly malformed) body needs to be read first. No new bucket, no new action — a pure reordering of an existing check.
- **Messages route**: a new, *additional* `network_identity`-scoped check (reusing the existing `comment_submission` action, mirroring the session route's own layered pattern) was added as the very first check, before origin validation. The existing `browser_session`-scoped check later in the flow is unchanged and still fires once a cookie is confirmed valid — a legitimate request now consumes one unit from each of two generous buckets.
- **Validation semantics unchanged**: no request-shape check was removed, loosened, or reordered relative to each other — only the rate-limit gate itself moved earlier.
- **No existence leakage**: the early gate's own response (`429`) is identical regardless of why a request would otherwise have failed, so it reveals nothing about publicId/link validity.
- Added `isShareIdentityError` handling to the messages route's catch block (it previously had none, since it never called anything that could throw `ShareIdentityError` before this change) — maps to `503 TEMPORARILY_UNAVAILABLE`, matching the session route's own existing behavior, not a bare `500`.

**Tests**: `app/api/share/session/route.test.ts` — 2 existing tests updated to assert the new (intentional) ordering instead of the old one, plus a new test proving the rate limiter still fails closed even when the origin is also invalid. `app/api/share/[publicId]/messages/route.test.ts` — 3 existing tests updated to the new ordering, plus 5 new tests: malformed-body failures still consume the early bucket; repeated malformed bodies exhaust the gate and fail closed with `429` *before the body is ever read*; a well-formed request still succeeds normally; the new `ShareIdentityError` → `503` mapping.

### 4. File / resource abuse

**Findings**: the file-delivery route reused the `projection_read` bucket/scope even though the schema's own `action` CHECK constraint already reserved a dedicated `file_access` value that no route had ever used — confirmed by direct migration read, not assumed. No aggregate byte/bandwidth cap existed; each file fetch only cost one unit of a shared, general-purpose read budget.

**Implementation**:
- Added `"file_access"` to `ShareRateLimitAction` and `RATE_LIMIT_POLICY` in `lib/share/share-rate-limit.server.ts` — a dedicated `browser_session`-scoped bucket, **60/300s**, deliberately tighter than `projection_read`'s 120/300s since a file fetch is materially more expensive to serve than a small JSON read, while still comfortably covering a legitimate visitor opening every attached file on a normal project once.
- `app/api/share/[publicId]/resources/[fileRef]/route.ts` now calls `checkShareRateLimit` with `action: "file_access"` instead of `"projection_read"` — the file route no longer shares its budget with the projection route, and vice versa.
- **Aggregate byte/bandwidth quota — SATISFIED BY EQUIVALENT CONTROL, not implemented as a separate subsystem.** Rationale, stated precisely per the task's own instruction: every file ever streamable through this route is already capped at 10MB at upload time (`MAX_FILE_SIZE_BYTES` in `app/api/task-resources/upload-and-create/route.ts`, confirmed by direct read). Combined with the new 60/300s `file_access` request-rate limiter, worst-case aggregate egress per browser-session identity per 5-minute window is now bounded to a calculable ceiling (60 × 10MB = 600MB) without reading or buffering any file to count bytes — which the existing zero-copy streaming architecture (`buildStreamedFileResponse`, a true pass-through `ReadableStream`) deliberately avoids for good reason and this slice does not disturb. A dedicated byte-counting subsystem would be disproportionate to the concrete risk this closes and was not built.
- No concurrency-control mechanism was added — none was found to already exist in the surrounding architecture to wire, and inventing one was out of this slice's own stated boundary ("if already supported").

**Tests**: `app/api/share/[publicId]/resources/[fileRef]/route.test.ts` — the existing rate-limit describe block updated (renamed, action assertion changed from `projection_read` to `file_access`); `lib/share/share-rate-limit.server.test.ts` — `file_access` (and the previously-untested `comment_submission`) added to the parametrized locked-policy test table.

### 5. Failure semantics — re-verified, not assumed

Every new check above was built to preserve the existing privacy/fail-closed contract, checked explicitly rather than assumed: no account/project/link existence leakage (every new 429 is the same generic shape as every existing one); no raw SQL/RPC error text ever reaches a response; no response distinguishes "a secret was almost valid" from any other failure; no secret or PIN is ever placed in a rate-limit key or a log line (only `createShareLinkRateLimitIdentityDigest`'s own deterministic, non-secret hash, and `createShareNetworkIdentityDigest`'s own keyed-HMAC network identity, exactly the same primitives already used elsewhere in this feature); no code path treats limiter storage failure as "allow" (`checkShareRateLimit` already failed closed before this slice, and nothing here changed that).

### Regression / verification performed this turn

- Targeted tests for every changed file: all passing (session 28/28, messages 67/67, file resource 47/47, rate-limit unit 13/13, cleanup unit 10/10).
- Full `app/api/share` + `lib/share` + `app/share` regression suite: **1726/1726 passing, 44/44 files** (up from Phase 7A's 1702/1702, 43/43 — net +24 tests, +1 file).
- `npx tsc --noEmit`: clean.
- No SQL run. No full production build run (remains the user's own action). No disposable-DB runtime was needed — every fix is application-layer, using schema/grants that already exist.

### Remaining known Phase 7 gaps after 7B

Unchanged from the original audit, still explicitly deferred: `authorDisplayName` anti-impersonation (§9, item B4 of the file/message hardening findings), Disable/Revoke/Re-enable owner UI (§4/§11), stale-open-tab revalidation on the public page (§10), mobile/RTL/accessibility polish (§12–14), `proxy.ts` test scaffolding (noted as a gap at the end of the Phase 7A record), the feature flag, and Production rollout. None of these was touched, weakened, or silently resolved by this slice.

**Not yet `PHASE_7_COMPLETE`** — the user's own full build and explicit sign-off across all 7A/7B work are still outstanding, and further Phase 7 slices (if authorized) remain open.

---

## 0C. Implementation record — Phase 7C (identity / owner lifecycle / live invalidation)

Closes exactly three areas from §17's remaining list: item 9 (`authorDisplayName` anti-impersonation), item 15 (Disable/Revoke/Re-enable owner UI), and item 10 (client-side stale-tab revalidation). Explicitly did **not** touch mobile (item 11–12), RTL (item 13), accessibility (item 14), or `proxy.ts` test scaffolding — those remain deferred to Phase 7D.

### 0C.1 — Phase 7B cleanup predicate sanity gate (read-only)

Re-verified `lib/share/share-state-cleanup.server.ts`'s "older than 24 hours after expiry" predicate by manual date arithmetic, not just re-reading the code: `cutoffIso = now - 24h`, filter `.lt("expires_at", cutoffIso)`. A row expired 1 hour ago (`expires_at = now - 1h`) is correctly **not** selected, since `now - 1h` is not less than `now - 24h`. A row expired 25 hours ago **is** correctly selected. Bounded (`LIMIT 200`), non-blocking on failure (try/catch + `console.warn`, never throws). **No defect found — no change made.**

### 0C.2 — `authorDisplayName` identity/anti-impersonation

**Trust model, before**: `author_type` (`'client' | 'owner'`) is server-set and cannot be forged (locked at three independent layers, confirmed during the original audit). `authorDisplayName` is fully client-suppliable free text with no anti-spoofing control. Before this slice, the UI rendered it with no visual distinction from a trusted identity — a client typing `"Owner"` or `"Project Owner"` would render as if it were the trusted role label itself.

**Trust model, after — unchanged mechanism, changed rendering**: `author_type` remains the sole authoritative signal for role. `authorDisplayName` is now always rendered as a visually-subordinate secondary label attached to (never replacing) the fixed role word — `"Client · <name>"` on the owner side (`client-communication-history-modal.tsx`) and `"Client · <name>"` / `"Project team"` on the public side (`public-messages-section.tsx`). The name span uses regular font-weight and muted color against the trusted-role label's existing bold/dark styling, so a spoofed name like `"Owner"` renders as `Client · Owner` — structurally unable to visually read as the trusted role itself. No reserved-word blacklist was used as the (sole) defense; the structural "role label always first, name always subordinate" pattern is the actual control. No owner private profile information is involved or leaked.

**Display-name input hardening**: new `sanitizeDisplayNameText()` in `lib/share/share-public-message.server.ts`, applied only to `authorDisplayName` (message-body sanitization is unchanged): collapses embedded newlines/tabs to single spaces, strips exactly nine Unicode bidi-formatting control codepoints (U+202A–U+202E, U+2066–U+2069 — LRE/RLE/PDF/LRO/RLO/LRI/RLI/FSI/PDI; implemented via `String.fromCharCode`, matching the existing `CONTROL_CHARACTER_PATTERN` convention in `share-file-response.server.ts`, not literal invisible characters in source), collapses resulting double-spaces, applies NFC Unicode normalization. Verified via direct Node execution that ordinary Hebrew/Arabic text is completely unaffected — only the nine formatting-control codepoints are targeted, never normal RTL letters. Existing trim/max-length/empty/HTML-safety handling (already correct pre-7C, since names render as plain JSX text children, never `dangerouslySetInnerHTML`) is unchanged.

### 0C.3 — Owner lifecycle contract reconstruction and closure (Disable/Re-enable/Revoke)

**Contract evidence**: the cached historical master handoff (`v5-extracted.txt`, Phase 2A section "13.4 Management lifecycle supported in Phase 2A") states the intended contract explicitly: *"Active → copy/reveal link, disable or revoke. Disabled → re-enable or revoke according to server contract... No PIN, expiry or rotation controls were added to the UI in Phase 2A even though the backend operations already exist."* The live `share-link-panel.tsx`'s own header comment independently confirms a **later** UX-simplification turn deliberately reduced the panel to two states while explicitly noting *"this does NOT delete any backend capability: activate/disable/re-enable/revoke/rotate/PIN/expiry... remain fully implemented... they are simply not wired into this panel's props anymore."* Conclusion: Disable/Revoke/Re-enable (and Rotate, also found unreachable via direct trace, contradicting the audit's earlier, less precise claim that Rotate was reachable) were part of the accepted Phase 2A contract and were incidentally dropped by a later simplification, not intentionally omitted from V1. This slice restores them. PIN/Expiry/manual-mapping UI remain explicitly out of scope — not reopened.

**UI changes**: `ShareLinkChannels` gained `onDisable`, `onReenable`, `confirmingRevoke`, `onRequestRevoke`, `onCancelRevokeConfirm`, and a `showLifecycleControls` prop (default `true`); a new "Manage link" block renders Disable (active only), Re-enable (disabled only), and a two-step-confirm Revoke (active or disabled) using the existing `ConfirmableActionButton`/`DashboardButton` primitives — no new component. `ShareLinkPanel` gained `onRotate`/`onDisable`/`onReenable`/`onRevoke` props, wired straight through to `useShareLink()`'s pre-existing, already-tested `rotate`/`disable`/`reenable`/`revoke` actions (previously implemented in the hook but never invoked from any production JSX). `showRotate` now also defaults to `true` (was hardcoded `false`). `tasks-view.tsx` wires all four to the corresponding `shareLink.*()` hook calls.

**Revoke confirmation semantics**: `ConfirmableActionButton`'s existing two-step pattern (`variant="danger"`, explicit `warning` string: *"Revoking this link permanently ends this share and cannot be undone. Anyone using it will immediately lose access. You'll need to create a new link to share with this client again."*) — wording deliberately distinct from Disable's plain, non-warned button, and from Rotate's own separate warning about invalidating the old secret while the share remains usable. Re-enable is structurally absent once a link is revoked (server-side, revoked rows are excluded from management reads entirely, so `link` becomes `null` and no lifecycle controls render at all). Double-submit is prevented by the pre-existing `actionInFlightRef` guard inside `useShareLink()`, unchanged. Every action re-fetches authoritative state after completion via the hook's existing `loadManagementState()` call — no optimistic terminal-state fabrication.

**Bug found and fixed via testing** (not merely a test-authoring issue): after a successful Revoke, `link` becomes `null` but the panel's `view` state previously stayed at `"result"`, so the heading kept reading "Project shared" even though the body correctly fell back to the QuickShare form. Fixed with (1) the heading condition changed to require both `view === "result"` and a non-null `link`, and (2) a render-time guard that resets `view` to `"quick"` when `view === "result"` and `link === null` once fresh (non-null) state has loaded.

### 0C.4 — Stale open tab / live public invalidation

**Design**: no WebSockets/SSE. The existing `GET /api/share/[publicId]/projection` endpoint (already the authoritative source) is reused as-is — no new endpoint. `app/share/[publicId]/share-view.client.tsx` adds a `revalidateProjection()` callback, triggered by (A) `visibilitychange`/`focus` listeners (both gated on `document.visibilityState === "visible"`) and (B) a `window.setInterval` at a fixed period, also gated on visibility at fire time — both wired via one `useEffect` scoped to `state.status === "ready"`, whose own cleanup function removes both listeners and clears the interval on status change or unmount.

**Chosen interval — 60 seconds, verified against the actual rate-limit policy, not assumed**: `projection_read` is `browser_session`-scoped at 120 requests / 300 seconds (`lib/share/share-rate-limit.server.ts`, unchanged by this slice). A 60-second poll consumes at most 5 of those 120 units in any given 300-second window, leaving the budget comfortably available for the page's own normal traffic (initial load, message-section activity, manual refresh) — verified by reading the live policy table, not by blindly adopting the number suggested in the task brief.

**Success behavior**: on a successful response, the entire projection is replaced wholesale (`setState` swaps in the fresh `data`, only if still in the `"ready"` state — a stale in-flight response arriving after the component left `"ready"` is discarded) — no merge/patch, no new cache layer. Mapping changes (newly-unshared/newly-shared tasks or resources) are reflected automatically since the whole projection is replaced identically to how the initial mount fetch already renders it — no special-case handling was written or needed (verified by a dedicated test).

**Access-loss (fail-closed) behavior**: on a non-200/non-`ok` response (revoke, disable, expiry, config-version mismatch from PIN change or rotation, stale grant), the code does not attempt a parallel re-exchange — the raw secret is already cleared from memory immediately after the first successful exchange and is structurally never retained, so no PIN/secret is available to retry with. Instead it falls back to one call to the existing, already-defined `fetchProjection()` (the same cookie-only call a returning visitor's page load already makes), which itself already fails closed to the `"unavailable"` state on any failure — this is the same mechanism the pre-existing initial-load path already uses, not a new one, so no parallel session mechanism was invented and no exchange/projection retry loop is possible (there is nothing left to loop with once the secret is gone). Once `"unavailable"`, the previously-rendered projection is fully cleared, not left behind an error banner.

**Message-section behavior after access loss**: `PublicMessagesSection` is only ever rendered inside the `"ready"` branch of `ShareView`'s render switch — once the state transitions away from `"ready"` to `"unavailable"` on a failed revalidation, the component unmounts on its own, satisfying "no stale Send control against hidden content" with no additional code.

**Race/concurrency protections**: a single `revalidationInFlightRef` boolean fully serializes every revalidation attempt (interval, focus, and visibilitychange can never overlap each other), and the triggering `useEffect` itself is gated on `state.status === "ready"`, so no revalidation can ever race the initial mount fetch. The success handler's `setState` is itself conditioned on `current.status === "ready"`, discarding a response that resolves after the component has already left the ready state (including after unmount, combined with the existing `isMountedRef` guard already used elsewhere in this file).

### 0C.5 — Files changed

- `lib/share/share-public-message.server.ts` — `sanitizeDisplayNameText()`, wired into `validateAuthorDisplayName`.
- `lib/share/share-public-message.server.test.ts` — 5 new tests (bidi-stripping, Hebrew/Arabic preservation, newline/tab collapsing, ordinary-whitespace preservation, emoji preservation).
- `app/components/dashboard/tasks/share-link/client-communication-history-modal.tsx` — "Client · name" rendering, `cardAuthorNameStyle`.
- `app/components/dashboard/tasks/share-link/client-communication-history-modal.test.tsx` — 2 existing tests updated to non-exact text matching, 1 new spoofed-name test.
- `app/components/dashboard/tasks/share-link/public-messages-section.tsx` — same "Client · name" pattern, `messageAuthorNameStyle`.
- `app/components/dashboard/tasks/share-link/public-messages-section.test.tsx` — 1 new spoofed-name test.
- `app/components/dashboard/tasks/share-link/share-link-channels.tsx` — Disable/Re-enable/Revoke UI, `showLifecycleControls` prop.
- `app/components/dashboard/tasks/share-link/share-link-channels.test.tsx` — updated default/required props for new callbacks.
- `app/components/dashboard/tasks/share-link/share-link-panel.tsx` — `onRotate`/`onDisable`/`onReenable`/`onRevoke` props, confirm-state management, view-reset-after-revoke fix.
- `app/components/dashboard/tasks/share-link/share-link-panel.test.tsx` — new describe block, 11 new tests; 1 existing test rewritten to assert the new (correct) presence of Rotate/Disable/Revoke.
- `app/components/dashboard/tasks-view.tsx` — wires the four new `ShareLinkPanel` props to `useShareLink()`.
- `app/share/[publicId]/share-view.client.tsx` — `revalidateProjection()`, focus/visibility/interval wiring, `REVALIDATION_INTERVAL_MS` export.
- `app/share/[publicId]/share-view.client.test.tsx` — new describe block, 13 new tests.

No new files, no new endpoints, no migration.

### 0C.6 — Tests / verification performed this turn

- Targeted suites for every changed file all passing individually during development.
- `app/share/[publicId]/share-view.client.test.tsx`: **30/30 passing** (17 pre-existing + 13 new Phase 7C revalidation tests).
- `npx tsc --noEmit`: **clean**.
- Full `lib/share` + `app/api/share` + `app/share` regression: **1744/1744 passing, 44/44 files**.
- Full share-link dashboard component suite (`app/components/dashboard/tasks/share-link/**` + `tasks-view.test.tsx`): **364/364 passing, 13/13 files**.
- This also serves as the Phase 7B regression re-check required by this turn's own §19: session/projection/messages/resource-file/rate-limiter/cleanup tests are all included in the 1744-test run above and all pass unchanged — the new revalidation polling does not consume abuse budgets at a rate that interferes with normal usage (see the 60-second-interval rate-limit arithmetic in §0C.4).
- No SQL run, no migration, no full production build, no stage/commit/push/deploy.

### 0C.7 — Remaining known Phase 7 gaps after 7C (deferred to Phase 7D)

Unchanged, still explicitly deferred: mobile touch-target sizing and long-token overflow guards (§17 items 11–12), RTL chrome/per-item `dir` gaps (§17 item 13), accessibility heading/live-region gaps (§17 item 14), `proxy.ts` test scaffolding, the feature flag, and Production rollout. PIN/Expiry/manual-mapping UI remain unreachable through the same panel simplification as before — this was traced during 0C.3 but intentionally left out of this turn's scope (not part of the three areas authorized this turn).

**Not yet `PHASE_7_COMPLETE`** — the user's own full build and explicit sign-off across all 7A/7B/7C work are still outstanding, and Phase 7D (if authorized) remains open.

---

## 0D. Implementation record — Phase 7D (final product-hardening closure)

Closes every remaining evidenced Client Share V1 product gap: owner-configuration reachability (PIN/Expiry/task-and-Resource mapping/visibility controls), the two concrete mobile findings, the RTL/per-item-direction findings, the accessibility findings, and `proxy.ts` test coverage. Feature-flag enablement and Production rollout remain explicitly out of scope (Phase 8).

### 0D.1 — Phase 7C sanity check (read-only)

Re-read `share-view.client.tsx` directly (not from memory) and confirmed all six items hold, no redesign performed:
- The 60s `setInterval` is cleared in the revalidation effect's own cleanup, which runs on unmount and on every `state.status` change.
- Both the interval callback and the focus/visibilitychange handler check `document.visibilityState === "visible"` before calling `revalidateProjection()` — a hidden tab never polls.
- `revalidationInFlightRef` fully serializes every revalidation attempt; the triggering effect is itself gated on `state.status === "ready"`, so no revalidation can race the initial mount fetch either.
- On access loss, `revalidateProjection()` falls back to the existing `fetchProjection()`, which fails closed to `"unavailable"` — the stale projection is fully replaced, not left behind an error banner.
- `PublicMessagesSection` is only ever rendered in the `"ready"` switch branch, so it unmounts automatically once access is lost.
- `sanitizeDisplayNameText()` (Phase 7C) was re-verified to strip only the nine bidi-formatting codepoints, never ordinary Hebrew/Arabic letters.
- Disable/Re-enable/Revoke/Rotate all route through `useShareLink()`'s pre-existing `disable`/`reenable`/`revoke`/`rotate` actions — no new RPC or client wrapper was added.

### 0D.2 — Final owner-configuration contract audit

Traced every one of the five owner controls to its component, hook action, route/RPC, and rendered reachability, cross-checked against the cached historical master handoff (Phase 2A/2B/2C sections). Historical evidence: *"Optional PIN and optional expiry are included in V1, not deferred to hardening"* (locked product decision) and *"Phase 2B — owner content configuration — COMPLETE... Project publication controls use titleVisible, statusVisible and targetDateVisible... Task mappings support selected IDs, public group, waiting-for-client-feedback and display order. Resource mappings support publicLabel, canDownload and display order"* / *"Phase 2C — Access controls and sharing channels — COMPLETE... PIN/expiry/channel UX"* — both historically marked COMPLETE. Direct repo trace (a repo-wide grep, not assumption) showed `ShareLinkAccessControls` and `ShareLinkConfigurationEditor` — both fully built and independently unit-tested — were imported by **no rendered parent anywhere under `app/`**, only by their own test files: the same later "no advanced/settings/kebab-menu escape hatch" simplification that Phase 7C found had dropped Rotate/Disable/Revoke had *also* silently dropped these five controls. This is a real, evidenced V1 gap, not a still-open product question.

| Control | Component/hook/route | Reachable before 7D | Classification before 7D |
|---|---|---|---|
| A. PIN | `ShareLinkAccessControls` / `useShareLink().setPin,clearPin` / existing PIN RPCs | Partial — set/clear only via `ShareLinkQuickShare`'s own checkbox (two submissions needed to change an existing PIN's value) | PARTIAL |
| B. Expiry | `ShareLinkAccessControls` / `useShareLink().setExpiry,clearExpiry` | Not reachable anywhere | GAP |
| C. Task mapping | `ShareLinkConfigurationEditor` / `useShareLink().saveConfiguration` | Only the one-time automatic grouping on first share; no way to ever revisit/edit a mapping once it exists | GAP |
| D. Resource mapping | `ShareLinkConfigurationEditor` / `useShareLink().saveConfiguration` | Selection only, via `ShareLinkQuickShare`'s attachment picker; per-resource `publicLabel`/`canDownload` never editable | PARTIAL |
| E. Visibility controls (title/status/target date, plus `clientFacingSubtitle`/`contentDirection`) | `ShareLinkConfigurationEditor` / `useShareLink().saveConfiguration` | Fixed to safe defaults on first share only (`titleVisible:true, statusVisible:true, targetDateVisible:false`); never editable again | GAP |

### 0D.3 — Owner-configuration closure

Wired the two already-existing, already-tested components straight into `ShareLinkPanel`'s existing "Project shared" result view — no new RPC, no new API route, no second configuration subsystem, per this turn's own explicit constraint. `ShareLinkPanel` gained a `manageView: "channels" | "config" | "access"` local state (default `"channels"`, reset on close exactly like `confirmingRotate`/`confirmingRevoke`) and two new secondary entry buttons ("Edit what client sees", "Manage access") alongside the existing `ShareLinkChannels` lifecycle controls. Selecting either swaps in `ShareLinkConfigurationEditor` or `ShareLinkAccessControls` respectively, each with a "Back to share options" button returning to `"channels"`. New `ShareLinkPanelProps`: `onSaveConfiguration`, `onSetPin`, `onClearPin`, `onSetExpiry`, `onClearExpiry`, `onRetryResources` — all wired in `tasks-view.tsx` to the corresponding pre-existing `useShareLink()` actions.

Requirements satisfied, all via existing, already-established mechanisms:
- **Authoritative server state / no optimistic fabrication**: both components already exclusively used `link`/`mappedTasks`/`mappedResources` from the authoritative management-state read, and `useShareLink()`'s `runAction` already re-fetches that state after every mutation — untouched.
- **Loading/busy/double-submit**: `disabled={busy}` (i.e. `state.actionPending !== null`) plus `runAction`'s own `actionInFlightRef` reentrancy guard — the same mechanism every other action in this panel already relies on, not a new one.
- **Error handling**: each component's own existing inline error paragraphs (now also `role="alert"`, see §0D.6) plus the panel's own existing generic `actionError` banner.
- **State-specific action availability**: `ShareLinkAccessControls` already gated "Remove expiry" on `expiresAt !== null && state !== "expired"`; nothing needed changing there. The new entry buttons themselves are reachable only from the "Project shared" result view (i.e. only for a non-revoked link), matching `ShareLinkConfigurationEditor`/`ShareLinkAccessControls`' own existing accepted-state scope.
- **Coherent copy / existing visual conventions**: reused `SectionHeading`, `DashboardButton`, `ConfirmableActionButton`, `stack`/`row` layout helpers already used throughout this component family — no new visual language introduced.
- **Clearing an existing PIN**: reused the exact two-step confirm pattern Phase 7C established for Revoke (`confirmingClearPin` state, `handleClearPinClick`, reset on the `actionPending: "clearPin"` → `null` transition) — `ShareLinkAccessControls` already exposed `confirmingClearPin`/`onRequestClearPin`/`onCancelClearPinConfirm` as props; only the panel-level state and reset wiring were new.

Net result: PIN is now fully PASS (set/change/remove all reachable in one action each); Expiry, task mapping, resource mapping (label/canDownload), and all five visibility/settings controls are now IMPLEMENTED.

### 0D.4 — Mobile hardening (concrete findings only)

Closed both concrete findings from the original audit's §12 (no unrelated redesign):
- **Touch targets** (`client-communication-history-modal.tsx`): the hand-rolled compact action buttons (Mark reviewed/Resolve/Dismiss/Reply/Analyze, `~20-22px` effective height) gained `minHeight: 36` plus `display:inline-flex; alignItems:center; justifyContent:center` (a practical middle ground toward the 44px guideline that avoids visually bloating a row that packs several of these side by side); the reply form's Submit/Cancel buttons gained `minHeight: 40`; the Refresh button gained `minHeight: 36`. `DashboardButton`-based controls (Rotate/Disable/Revoke/PIN/Expiry/Save actions) were left untouched — already PASS per the original audit (34-48px).
- **Long-unbroken-string overflow** (`client-project-view.tsx`, `share-link-configuration-editor.tsx`): task titles, resource labels (both `link`- and `file`-kind), and the configuration editor's own task/Resource row titles now carry `overflowWrap:"anywhere"`/`wordBreak:"break-word"`/`minWidth:0`, matching the guard message bodies already had. `taskItemStyle`/`resourceFileRowStyle` gained `flexWrap:"wrap"` so a long title/label drops to its own line instead of forcing horizontal overflow; the file row's Open/Download action gained `flexShrink:0` so it never gets squeezed illegibly narrow.

### 0D.5 — RTL / per-item direction

**Architecture, unchanged**: the existing `contentDirection` (`"auto"|"ltr"|"rtl"`, owner-configurable per link, now reachable via `ShareLinkConfigurationEditor`'s own already-built "Text direction" select — see §0D.3) remains the single top-level direction control, applied via `dir={projection.contentDirection}` on `ClientProjectView`'s and `PublicMessagesSection`'s own root elements — never forced app-shell-wide. No new language-detection subsystem was built; this turn only extended the EXISTING `dir="auto"` convention to more per-item elements.

**Per-item fixes**: task titles and resource labels (`client-project-view.tsx`) and the configuration editor's own task/Resource row titles (`share-link-configuration-editor.tsx`) now carry `dir="auto"`, matching the treatment message bodies/reply text/display names already had (Phase 7C). Section-label headings (structural chrome, e.g. "Progress"/"Tasks") deliberately do NOT get `dir="auto"` — per this turn's own instruction not to apply RTL direction to structural/status labels merely because surrounding content is RTL.

**Top-level page chrome**: `share-view.client.tsx`'s loading/PIN/error/rate-limited states previously had no `dir` attribute at all (the exact gap the original audit flagged) — now `dir="auto"` on each container, consistent with the codebase's own "never omit `dir`" rule even though this specific text is currently always hardcoded English.

**PIN/numeric values**: unaffected by any change here — the PIN input itself already used `inputMode="numeric"`, not affected by direction at all.

### 0D.6 — Bidi safety regression (re-verified, not assumed)

Re-confirmed via the existing, unchanged `sanitizeDisplayNameText()` (Phase 7C) that a client-supplied name combining bidi-control characters with strings like "Owner"/"Project Owner"/"Support" still renders as `Client · <stripped name>` — the trusted role label ("Client"/"You"/"Project team") remains the fixed, structurally-first, visually-bold element in every case, and the new heading/dir/overflow changes in this turn touch none of the identity-rendering logic itself (only the section labels one level up). Ordinary Hebrew/Arabic letters remain completely untouched — nothing in `BIDI_FORMATTING_CHARACTER_PATTERN` changed this turn.

### 0D.7 — Accessibility closure

- **Semantic headings**: `ClientProjectView`'s four section labels (Progress/Latest update/Tasks/Attachments) and `PublicMessagesSection`'s "Messages" label were promoted from styled `<span>` to real `<h2>` elements (page title remains the only `<h1>`, in the `"ready"` state). `share-view.client.tsx`'s top-level loading/PIN/unavailable/rate-limited states each gained an `<h1>` (previously no heading existed in any of these states) — `messageStyle` gained `margin:0; fontWeight:400` so the new heading matches its previous plain-text appearance exactly.
- **Live regions**: loading states get `role="status"` + `aria-live="polite"` (share-view.client.tsx's `ShareViewMessage`, the Communication History modal's own `StatePanel` and unread-count toolbar text); genuinely blocking outcomes (`unavailable`, `rate_limited`, a message-history load error) get `role="alert"` (assertive) instead. Deliberately NOT applied to the `"ready"` state or to a successful background revalidation — a silent, no-disruption refresh must stay silent, matching this turn's own explicit "do not announce large portions of the page repeatedly during the 60s background refresh" instruction.
- **Form/error accessibility**: `ShareLinkAccessControls`' PIN and expiry inline error paragraphs, and `ShareLinkConfigurationEditor`'s Resources-load error paragraph, all gained `role="alert"` (previously plain, unannounced `<p>` elements) — every other form/label/button/modal item audited (PIN input `aria-label`, display-name input `<label>`, message/reply textareas, icon-only Close button, `ConfirmableActionButton`'s confirm/cancel pair, `ResponsiveDialog`'s focus-trap/Escape/focus-restoration) was already correct per the original audit's own PASS finding and was left unchanged — no existing accessible modal primitive was replaced.

### 0D.8 — Final Phase 7 gap-reconciliation matrix

Every item from the original audit's §17 "Confirmed gaps," plus the owner-configuration gap discovered in §0D.2 above, accounted for:

| # | Finding | Original classification | Final disposition | Evidence |
|---|---|---|---|---|
| 1 | `X-Robots-Tag` missing on `/api/share/**` routes | GAP | IMPLEMENTED | §0 (Phase 7A) |
| 2 | File route CSP lacks `frame-ancestors` | GAP | IMPLEMENTED | §0 (Phase 7A) |
| 3 | `Permissions-Policy` absent everywhere | GAP | IMPLEMENTED | §0 (Phase 7A); proven end-to-end this turn by `proxy.test.ts` (§0D.9) |
| 4 | `script-src` unrestricted (page CSP) | Deliberately deferred (app-wide nonce rewrite, named explicitly as later, separate work) | INTENTIONALLY_NOT_IN_V1_CONTRACT | Never part of the Client Share feature's own accepted scope — an app-wide Next.js script-injection initiative, not a Client Share gap |
| 5 | No cleanup/expiry sweep for sessions/grants/rate-limit buckets | GAP (storage growth only) | IMPLEMENTED | §0B.1 (Phase 7B), re-verified read-only this turn (§0D.1) |
| 6 | Malformed-request-volume flooding uncounted | GAP | IMPLEMENTED | §0B.3 (Phase 7B) |
| 7 | File-fetch aggregate byte/bandwidth uncapped | GAP | SATISFIED_BY_EQUIVALENT_CONTROL | §0B.4 (Phase 7B) — 10MB upload cap × 60/300s `file_access` limit is a calculable, bounded ceiling without a byte-counting subsystem |
| 8 | Secret-guessing has no per-link rate-limit scope | GAP (mitigated by 256-bit entropy) | IMPLEMENTED | §0B.2 (Phase 7B) |
| 9 | `authorDisplayName` fully spoofable, no anti-impersonation control | GAP/PARTIAL | IMPLEMENTED | §0C.2 (Phase 7C) |
| 10 | Client-side stale-tab window after revoke/disable/expire/PIN-change/rotation/unmap | GAP (bounded, no new data exposure) | IMPLEMENTED | §0C.4 (Phase 7C) |
| 11 | Small touch targets in Communication History modal | PARTIAL | IMPLEMENTED | §0D.4 |
| 12 | Task/resource text not guarded against overflow | PARTIAL | IMPLEMENTED | §0D.4 |
| 13 | RTL: top-level chrome no `dir`; task/resource labels lack per-item `dir="auto"` | PARTIAL | IMPLEMENTED | §0D.5 |
| 14 | Accessibility: non-heading section labels; missing `aria-live`/`role="status"` | PARTIAL | IMPLEMENTED | §0D.7 |
| 15 | Disable/Revoke/Re-enable have no reachable owner UI | Flagged as a product-decision item, not asserted as a bug | IMPLEMENTED | §0C.3 (Phase 7C) — confirmed part of the accepted Phase 2A contract |
| 16 *(new, found this turn)* | PIN/Expiry/task-mapping/Resource-mapping/visibility-controls UI unreachable despite historical Phase 2B/2C COMPLETE status | Not identified by the original audit | IMPLEMENTED | §0D.2–§0D.3 |
| — | `proxy.ts` had no dedicated test coverage for its own page-level header policy | Noted as a gap at the end of the Phase 7A record | IMPLEMENTED | §0D.9 |
| — | Feature-flag enablement | Out of Phase 7 scope | PHASE_8_OPERATIONAL | Explicitly named out of scope by this turn's own instructions |
| — | Production rollout | Out of Phase 7 scope | PHASE_8_OPERATIONAL | Explicitly named out of scope by this turn's own instructions |

**No remaining Client Share V1 product gap is open as of this table.** Every row is IMPLEMENTED, SATISFIED_BY_EQUIVALENT_CONTROL, INTENTIONALLY_NOT_IN_V1_CONTRACT, or PHASE_8_OPERATIONAL — none is a vague "optional later" item.

**Exact row/category count (mechanically recounted, not estimated)**: the table above has **19 total rows** — **16 numbered findings** (the original audit's 15-item §17 list, rows 1–15, plus the one further item Phase 7D itself discovered, row 16) plus **3 additional non-numbered rows** (`proxy.ts` test-coverage closure, feature-flag enablement, Production rollout). Disposition breakdown across all 19 rows:

| Disposition | Count | Rows |
|---|---|---|
| IMPLEMENTED | 15 | 1, 2, 3, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, and the `proxy.ts` row |
| SATISFIED_BY_EQUIVALENT_CONTROL | 1 | 7 |
| INTENTIONALLY_NOT_IN_V1_CONTRACT | 1 | 4 |
| PHASE_8_OPERATIONAL | 2 | feature-flag enablement, Production rollout |
| **Total** | **19** | |

Within just the 16 numbered findings: 14 IMPLEMENTED + 1 SATISFIED_BY_EQUIVALENT_CONTROL (row 7) + 1 INTENTIONALLY_NOT_IN_V1_CONTRACT (row 4) = 16. (A prior turn's chat-only summary stated this breakdown as "13 IMPLEMENTED + 1 + 1 = 15" — an arithmetic slip in that prose recap, undercounting IMPLEMENTED by one; the table itself, and the "16" finding count, were correct throughout. No document content changed as a result of this correction — only this reconciling note was added.)

### 0D.9 — `proxy.ts` test closure

Per this turn's own preferred order, inspected first: `SHARE_PUBLIC_PAGE_HEADERS` was already a pure, static array with no Supabase/request dependency; the only untested logic was the inline `pathname === "/share" || pathname.startsWith("/share/")` branch condition. Performed the narrow extraction the brief explicitly allows (option B) — no behavior change: exported the existing `SHARE_PUBLIC_PAGE_HEADERS` constant as-is, and extracted the branch condition into a new exported pure function, `isClientSharePagePath(pathname): boolean`, which `proxy()` now calls instead of the inline condition. No elaborate Next.js/Supabase middleware emulation framework was built.

New `proxy.test.ts` (15 tests, three layers):
1. `isClientSharePagePath` asserted directly against `/share`, `/share/<id>`, `/shared` (must NOT match), `/dashboard`, `/`, and the `/api/share/**` surface (must NOT match — that surface sets its own headers per-route, confirmed already covered by each route's own Phase 7A tests).
2. `SHARE_PUBLIC_PAGE_HEADERS`' exact values asserted directly (Permissions-Policy, X-Robots-Tag, Referrer-Policy, Cache-Control, X-Content-Type-Options, CSP).
3. The real `proxy()` function invoked with a real `NextRequest` for `/share`, `/share/[publicId]` (asserting every header on the real `Response` object), `/api/homepage-demo/review`, and `/homepage-demo/review` (both representative non-share, early-return routes, proving none of the Client Share page's own headers leak onto them). Both share and non-share branches return before `proxy()` constructs its Supabase client, so no Supabase mocking or env vars were needed for any of these tests.

### 0D.10 — Verification performed this turn

- Targeted new-file suite: `proxy.test.ts` 15/15 passing.
- Full share-link component suite + public share-view suite (`app/components/dashboard/tasks/share-link/**` + `app/share/[publicId]/share-view.client.test.tsx`): **412/412 passing, 14/14 files** (up from Phase 7C's 30/30 in the one revalidation file alone — this run also re-confirms every Phase 7C test unaffected by this turn's rendering changes).
- Full Client Share regression (`lib/share` + `app/api/share` + `app/share` + `app/components/dashboard/tasks/share-link` + `proxy.test.ts`): **2141/2141 passing, 58/58 files.** This single run doubles as the required Phase 7A/7B/7C regression re-check (session/projection/messages/resource-file/rate-limiter/cleanup/identity/lifecycle/revalidation tests are all included and all pass unchanged).
- `npx tsc --noEmit`: clean, run twice (after the owner-configuration wiring, and again after the mobile/RTL/a11y/proxy changes).
- `git diff --check`: clean (only benign LF→CRLF conversion notices on Windows, no whitespace-error markers, exit code 0).
- No SQL run, no migration, no full production build, no stage/commit/push/deploy, no feature-flag change, Phase 8 not started.

### 0D.11 — Security/privacy regression

None found. Owner-configuration closure reuses existing, already-privacy-reviewed RPCs and management-state reads with no new data exposure (the same `link`/`mappedTasks`/`mappedResources`/`resources` fields `ShareLinkPanel` already held). The heading/`dir`/`role`/`aria-live` additions are presentation-only — no new field is read from or written to any contract, no new endpoint was created, and the public projection's 15-item privacy denylist (§6 above) is untouched by anything in this turn. `proxy.test.ts` introduces no new runtime code path — it only tests the exact code `proxy()` already ran.

### 0D.12 — Remaining Phase 8 operational items

Feature-flag enablement and Production rollout are the only items left, both explicitly out of this document's scope per every phase's own standing instruction. No Client Share V1 product gap remains open.

---

## 0E. Final documentation closure — user's full production build recorded, Phase 7 closed

This is a documentation-only turn: no product code, test, or migration file was modified to produce this section; no SQL was run; no new build was triggered by this turn (the build below is the user's own, run outside this session); no stage/commit/push/deploy occurred; the feature flag was not touched; Phase 8 was not started.

### 0E.1 — Final Phase 7 gap-matrix reconciliation (mechanical recount)

Re-opened and mechanically recounted §0D.8's table, in response to a numerical inconsistency flagged in a prior turn's own chat-only summary (that summary said "13 IMPLEMENTED + 1 SATISFIED_BY_EQUIVALENT_CONTROL + 1 INTENTIONALLY_NOT_IN_V1_CONTRACT = 16," which sums to 15, not 16). Result: the table itself, and its "16" numbered-finding count, were already correct — the error was confined to that one chat response's prose arithmetic (13 instead of 14 IMPLEMENTED among the 16 numbered rows), never to this document. §0D.8 now carries an explicit, mechanically-verifiable reconciliation note and disposition-count table (added this turn) so the exact counts never again need to be re-derived from memory:

- **19 total rows** in the §0D.8 matrix: 16 numbered findings (rows 1–15 from the original audit's §17 list, plus row 16, the owner-configuration-reachability gap Phase 7D itself discovered) + 3 additional non-numbered rows (`proxy.ts` test-coverage closure, feature-flag enablement, Production rollout).
- **Disposition counts across all 19 rows**: IMPLEMENTED = 15, SATISFIED_BY_EQUIVALENT_CONTROL = 1, INTENTIONALLY_NOT_IN_V1_CONTRACT = 1, PHASE_8_OPERATIONAL = 2. (15 + 1 + 1 + 2 = 19, verified.)
- **Within the 16 numbered findings alone**: 14 IMPLEMENTED + 1 SATISFIED_BY_EQUIVALENT_CONTROL (row 7) + 1 INTENTIONALLY_NOT_IN_V1_CONTRACT (row 4) = 16, verified.
- No row was added, removed, or reclassified by this recount — every disposition in §0D.8 was already correct; only the missing explicit count/reconciliation note was added.

**Conclusion: no real unresolved V1 product-hardening gap exists in the matrix.** This is the basis for closing Phase 7 below.

### 0E.2 — User's full production build (recorded, not run by this session)

| Item | Result |
|---|---|
| Build tool | Next.js 16.1.6 (Turbopack) |
| Compile | PASS — "Compiled successfully in 34.6s" |
| TypeScript | PASS — "Finished TypeScript in 25.0s" |
| Page-data collection | PASS — "Collecting page data using 3 workers in 1596.9ms" |
| Static generation | PASS — 90/90 pages — "Generating static pages using 3 workers (90/90) in 2.7s" |
| Page-optimization finalization | PASS — "Finalizing page optimization in 10.2ms" |
| Overall build result | **PASS** |

**Critical Client Share routes confirmed present in the build output**: `/share/[publicId]`, `/api/share/session`, `/api/share/[publicId]/projection`, `/api/share/[publicId]/messages`, `/api/share/[publicId]/resources/[fileRef]`.

**Prior Phase 7 verification, carried forward unchanged from §0D.10** (not re-run this turn, per this turn's own explicit "do not run another full build" / "do not modify tests" boundary): broad Client Share regression **2141/2141 passing, 58/58 files**; `npx tsc --noEmit` clean; `git diff --check` clean; no migration required for any of 7A/7B/7C/7D.

### 0E.3 — Phase 7 final status

With §0E.1's reconciliation confirming no real unresolved V1 gap remains, and §0E.2 recording that the user's own full production build has now passed (the one precondition §0D itself named as still outstanding), Phase 7 status changes from `PHASE_7_IMPLEMENTED_READY_FOR_USER_BUILD` to:

**`PHASE_7_COMPLETE`**

This covers Phase 7A (header hardening), 7B (abuse/session/resource hardening), 7C (identity/owner-lifecycle/live-invalidation), and 7D (owner-configuration closure, mobile/RTL/accessibility, `proxy.ts` test closure, final reconciliation) together. **Phase 8 (Production rollout / feature-flag enablement) has not started** — see §0E.5.

### 0E.4 — Git checkpoint (read-only this turn)

| | |
|---|---|
| HEAD | `027629a` — unchanged from every prior Phase 7 checkpoint |
| Branch vs. remote | `main...origin/main [ahead 18]` |
| Working tree | 7A/7B/7C/7D changes present, **not staged, not committed** |
| This turn's own changes | Documentation only: this file, and `docs/Text2Task_CLIENT_SHARE_LINK_FULL_HANDOFF_2026-08-24_v7.docx` |

No `git add`, `git commit`, `git push`, or any destructive git operation was performed this turn. Staging/committing the full 7A–7D + documentation change set remains the user's own next action, separate from this documentation-closure turn.

### 0E.5 — Next authorized step: Phase 8 mapping/audit (not implementation)

Per this turn's own explicit instruction, the next authorized development activity is **Phase 8 — mapping/audit first**, not immediate Production rollout or feature-flag enablement. Phase 8's own audit should inspect: the complete regression/security closure this document already establishes; the Production migration chain (none was required by any Client Share Phase 7 work, but Phase 8 must independently verify the full chain up to that point); deployment ordering; feature-flag rollout mechanics; monitoring; rollback/recovery; and final Production verification. **No Phase 8 implementation or rollout is authorized by this document.**

---

## 1. Executive summary

Phase 7's original mandate ("Hardening") was audited category-by-category against the live repository, not assumed. The result differs meaningfully from Phase 6D's clean closure: **most of the original Phase 7 concern list is already fully satisfied** by work delivered in Phases 1–6 (rate limiting is a real, DB-atomic, fail-closed mechanism covering every public route; PIN/secret handling uses scrypt/HMAC/AES-GCM correctly; every server-side authorization re-check on revoke/disable/expiry/PIN-change/rotation/mapping-change was traced and confirmed correct; the public projection's privacy denylist is completely clean — no field on the 15-item denylist leaks anywhere; error/failure handling fails closed and enumeration-safe on every path checked) — **but a handful of small, concrete, evidenced gaps also exist**, unlike Phase 6D where essentially nothing remained. This document does not force a `NOT_REQUIRED` conclusion to match the prior phase's pattern; the evidence here genuinely supports a small, well-scoped implementation slice.

The single most notable non-security finding: **the owner-facing UI never wires up Disable/Revoke/Re-enable** — only Rotate, PIN set/clear, and Expiry set/clear are reachable through the live `ShareLinkPanel`. This is not asserted as a bug — Rotate already provides an equivalent emergency-invalidation capability (a new secret immediately invalidates the old one) — but it is a genuine discrepancy from what a "Hardening" audit should surface, and it changes the practical severity of several revocation-edge scenarios below (they are currently unreachable through the production UI, not merely theoretical-but-safe).

**Status: `PHASE_7_DESIGN_READY_NOT_IMPLEMENTED`.** A small, low-risk, purely additive slice (three response-header additions) is ready to propose; everything else is either a legitimate, undecided product question (Disable/Revoke UI) or lower-priority polish appropriate to defer. Nothing found blocks Production schema rollout or app deploy on its own.

---

## 2. Current checkpoint

| | |
|---|---|
| Repository | `c:\Users\Home\projects\inboxshaper` |
| Branch | `main` |
| HEAD | `027629a` — "Document Client Share Phase 6 closure and Phase 7 handoff" |
| Branch vs. remote | `main...origin/main [ahead 18]` |
| Working tree | Clean |
| Recent commits | `027629a` → `0958167` (Phase 6C) → `0b10e61` (Phase 6B) → `70f2858` (Phase 6A) → `8142245` (Phase 5) |

Production is untouched. No SQL, build, stage, commit, push, deploy, or feature-flag change occurred to produce this document — this entire audit is four parallel read-only research passes plus this synthesis.

---

## 3. Original Phase 7 contract

Reconstructed from `docs/Text2Task_CLIENT_SHARE_LINK_FULL_HANDOFF_2026-08-24_v6.docx` (the "20 August" update layer's own roadmap table, carried forward and expanded in the "24 August" layer) and the user's own Phase 7 kickoff instructions, which explicitly named: rate limiting, abuse controls, security headers, noindex/no-store/privacy, cache/revocation edge cases, lifecycle hardening, mobile, RTL, accessibility, and (per this turn's more detailed brief) session/PIN/rotation security, file/resource hardening, public-message hardening, public data-leak re-verification, and error/failure-behavior audit. The v6 handoff's own explicit instruction — *"do not assume every item... is actually missing — verify against the live repository first, since several items were already pulled forward during Phases 1–6"* — is exactly what this audit did.

---

## 4. Public endpoint inventory

The complete anonymous/public Client Share surface, confirmed by direct enumeration (five handlers, no others exist under `app/api/share/**`):

| Route | File | Purpose |
|---|---|---|
| `GET /share/[publicId]` | `app/share/[publicId]/page.tsx` + `share-view.client.tsx` | Public page |
| `POST /api/share/session` | `app/api/share/session/route.ts` | Secret/PIN → session+grant exchange |
| `GET /api/share/[publicId]/projection` | `app/api/share/[publicId]/projection/route.ts` | Public project view |
| `GET/POST /api/share/[publicId]/messages` | `app/api/share/[publicId]/messages/route.ts` | Client message read/submit |
| `GET /api/share/[publicId]/resources/[fileRef]` | `app/api/share/[publicId]/resources/[fileRef]/route.ts` | Secure file streaming |

---

## 5. Rate-limit / abuse audit

Mechanism: `public.share_rate_limit_buckets` (fixed-window, DB-atomic `INSERT ... ON CONFLICT ... DO UPDATE` via `increment_share_rate_limit_bucket`, `supabase/migrations/202608130001_client_share_rate_limit_increment.sql:217-243`), a `share_link_key` generated column specifically preventing NULL-based uniqueness bypass (`202608030004...sql:307-310`), consumed exclusively through `checkShareRateLimit` (`lib/share/share-rate-limit.server.ts:107-145`), which fails closed on any RPC error (`:121-131`).

| Policy | Scope | Limit/window | File:line |
|---|---|---|---|
| `session_exchange` | network identity | 10/300s | `share-rate-limit.server.ts:38-55` |
| `pin_verification` | **share_link** (not caller) | 5/300s | same |
| `projection_read` | browser session | 120/300s | same |
| `invalid_link_access` | network identity | 20/300s | same |
| `comment_submission` | browser session | 10/300s | same |

| Abuse scenario | Determination |
|---|---|
| Secret guessing | **PARTIAL** — only network-identity scoped, no per-link secondary cap (unlike PIN); mitigated by 256-bit secret entropy (`share-secret.server.ts:16-18`), making the gap low-practical-risk |
| PIN guessing | **PASS** — 5/300s, per-link scoped, constant-time compare |
| Session/grant creation spam | **PASS** |
| Message submission spam | **PASS** — dedicated bucket, checked before validation |
| Resource/file fetch abuse | **PARTIAL** — reuses `projection_read` bucket rather than the `file_access` action value the DB schema already reserves but no route uses (`202608030004...sql:333-343`) |
| Malformed request flooding | **GAP** — request-shape validation happens before the rate-limit check on every write route, so no DB counter ever throttles pure malformed-payload volume (bounded only by a 4–20KB hard byte cap, not a request-count limit) |

---

## 6. Header / privacy / cache audit

| Header | Page | API routes | File route |
|---|---|---|---|
| noindex/noarchive | **PASS** (`metadata.robots`, `page.tsx:21-23`; `X-Robots-Tag` via `proxy.ts:36,69-76`; `robots.ts:24-26`) | **GAP** — `proxy.ts`'s pathname branch only matches `/share` and `/share/*`, not `/api/share/*`; no route sets `X-Robots-Tag` itself | same GAP |
| Referrer-Policy: no-referrer | PASS (`proxy.ts:34`) | **PASS** — every route's `NO_STORE_HEADERS` block | PASS (`share-file-response.server.ts:209`) |
| Cache-Control: no-store | PASS | **PASS** — every success and every catch-block error | PASS, including the streamed-file path specifically |
| CSP | `frame-ancestors 'none'; object-src 'none'; base-uri 'none'` only — `script-src` deliberately unrestricted, per the code's own comment (`proxy.ts:24-29`) naming this as work for "the later, already-planned full hardening phase" | none (JSON only) | `Content-Security-Policy: sandbox` (no `frame-ancestors`) |
| X-Content-Type-Options: nosniff | PASS | PASS | PASS |
| frame-ancestors / X-Frame-Options | PASS via CSP | n/a | **GAP** — relies only on indirect protection (`Sec-Fetch-Site` rejection + `SameSite=Lax` cookie scoping), no header-level guarantee |
| Permissions-Policy | **GAP** — absent everywhere (zero matches repo-wide) | | |

**Analytics exclusion — PASS.** Every tracking component (`GoogleAdsTag`, `MicrosoftClarity`, `AttributionCapture`, `ConsentAwareVercelAnalytics`) independently self-gates on `shouldSkipAnalyticsPath()` (`app/components/analytics/analytics-paths.ts:7-17`) before mounting any script tag for any `/share`-prefixed path — confirmed this is a real, enforced mechanism, not a documentation claim.

**Public data-leak denylist — full PASS, all 15 items checked.** Traced the actual response-building code (`assembleClientProjection`, `client-share-projection.server.ts:216-314`; `listPublicShareMessages`, `share-public-message.server.ts:278-300`) against every item on the denylist: internal UUIDs, `user_id`, CRM ids, `raw_input`, amount, priority/Urgent, private client contact fields, internal timeline, storage paths, signed URLs, PIN/secret material, unmapped tasks/resources, Note resources, conversion metadata, and internal apply metadata. **None leak anywhere** — each is either never queried by the projection builder or explicitly excluded by a `.strict()` Zod schema with no matching field. `share_message_conversions`/the Analyze route live entirely under the *authenticated owner* `/api/share-links/**` surface, unreachable from the anonymous `/api/share/**` surface at all.

---

## 7. Session / PIN / rotation / secret audit

- **Raw PIN**: never stored — only `pin_hash`/`pin_salt`/scrypt parameters, CHECK-constrained to a pinned profile (`N=16384, r=8, p=1`, `202608030003...sql:250-272`). **PASS.**
- **Raw secret**: **not** digest-only in practice. A public one-way HMAC digest (`secret_digest`) exists for verification, but a separate table, `project_share_secret_material`, stores an AES-256-GCM **encrypted, recoverable** copy of the raw secret (deliberate, documented decision so owners can re-copy an active link's URL — `202608060001...sql:70-72,85-121`), closed to every role except via `SECURITY DEFINER` RPCs. **Record precisely, not as a gap**: this is a materially different risk profile than "irreversibly hashed" and should be understood as such, not silently assumed away.
- **Constant-time comparison**: `timingSafeEqual` used correctly for both secret and PIN, appropriately (these are in-process Node comparisons, not DB predicates). **PASS.**
- **Six invalidation transitions** (revoke, disable, natural expiry, PIN add/change, secret rotation, expiry change) — **all PASS**, all enforced by the same unifying mechanism: every public read re-derives authorization from scratch via `verifyShareProjectionAuthorization` (`share-session-grant.server.ts:583-646`), including an exact `configuration_version` match check (`:632-635`) that every mutating RPC bumps on genuine change.
- **Cross-link session isolation**: **PASS** — grants are scoped `(browser_session_id, share_link_id)` both in the application query and a DB unique index + integrity trigger.
- **Cleanup/expiry sweep**: **GAP** — no `pg_cron`-style sweep exists for `share_browser_sessions`/`share_session_grants`/`share_rate_limit_buckets`, despite indexes explicitly commented as being for a future sweep, and despite this exact pattern already existing elsewhere in the repo for an unrelated feature (`202606300002_homepage_demo_maintenance_cron.sql`). Operational/storage-growth only — access control is independently correct regardless (every check is live, not sweep-dependent).

---

## 8. Resource / file hardening audit

`app/api/share/[publicId]/resources/[fileRef]/route.ts` + `lib/share/share-file-ref.server.ts` + `share-file-response.server.ts` — **PASS on every item checked**: fileRef is a genuinely opaque, per-`(shareLinkId, resourceId)` HMAC with no decodable path/id (`share-file-ref.server.ts:103-117`); tamper/mismatch fails closed via `timingSafeEqual` scan (no literal single-byte-flip test exists, but the mechanism structurally covers it — flag as PARTIAL on explicit test coverage only, not on behavior); cross-link and cross-resource replay both blocked and tested; an unmapped/removed resource is denied on the very next request (no caching); a revoked/disabled/expired link blocks file fetches too (authorization runs before fileRef resolution); Content-Disposition/Content-Type/Cache-Control headers are all correct and never leak `file_name`/`storage_path`; no path traversal is possible (resolution is always DB-mediated by ID, never raw string concatenation).

**One real GAP**: no aggregate byte/bandwidth cap on repeated file fetches — the 120/300s `projection_read`-shared limit bounds request *count*, not egress *volume*; a client could still fetch the same large file up to 120 times in 5 minutes.

---

## 9. Public-message hardening audit

`app/api/share/[publicId]/messages/route.ts` + `share-public-message.server.ts` — **PASS on nearly every item**: 4000-codepoint server-side length limit (Unicode-codepoint-correct, not UTF-16), independently DB-CHECK-enforced too; empty/whitespace rejected; HTML-like content is stored verbatim but rendered everywhere as a plain JSX text child (confirmed zero `dangerouslySetInnerHTML` anywhere in the feature tree) so it is never executable in the owner UI; link/session/comments-enabled state is re-verified at submission time both at the route layer and independently by a DB trigger; rate-limited (10/300s, dedicated bucket); Unicode/RTL/emoji correctly counted and preserved.

**One real GAP/PARTIAL**: `authorDisplayName` is fully client-suppliable free text with zero anti-spoofing control — `author_type` cannot be forged (locked to `'client'` at three independent layers), but the *display name* shown to the owner can be anything the client types, with no documented, explicit decision found treating this as an accepted risk (as opposed to `author_type` forgery, which is explicitly and repeatedly guarded against).

**Factual, not a defect**: no idempotency protection exists on message submission (a replayed identical request creates a second row) — bounded only by the rate limit, not prevented outright.

---

## 10. Revocation / cache-edge audit

The client (`share-view.client.tsx`) fetches the projection **exactly once per mount** — no polling, no focus-revalidation, no push channel. Every one of the six scenarios below was traced to the actual code, not assumed:

| Scenario | Server-side (next request) | Client-side (already-open tab) |
|---|---|---|
| A. Revoke while page open | **PASS** — fails on next request | **GAP** — stale content remains visible until reload/next action; but see note below |
| B. Disable while page open | **PASS** | **GAP**, same caveat |
| C. Natural expiry while page open | **PASS** | **GAP** |
| D. PIN added while old grant exists | **PASS** — config-version mismatch forces re-exchange | **GAP** |
| E. Secret/link rotation | **PASS** | **GAP** |
| F. Resource/mapping unmapped after page load | **PASS** — always re-read live, no caching | **GAP** |

**Important reframing, not present in the raw scenario list**: per section 11 below, **Disable and Revoke have no reachable owner-facing UI button at all** — only Rotate, PIN, and Expiry are wired. So scenarios A and B are currently *unreachable in production*, not merely theoretical-but-safe; scenarios C–F remain live and reachable. In every case, the practical exposure is bounded: the stale tab can only continue displaying data it *already* fetched before the transition — it cannot fetch anything new, since every subsequent network call is independently re-authorized and correctly denied. This is the same architectural pattern (fetch-once, no live sync) already found and accepted as an optional, non-blocking finding on the *owner* side during the Phase 6D audit — this turn confirms the identical pattern also exists on the *public client* side.

---

## 11. Owner lifecycle audit

**Headline finding**: `ShareLinkPanel` (the sole production consumer, `tasks-view.tsx:828`) only renders `ShareLinkQuickShare` + `ShareLinkChannels` with `showRotate={false}`-style wiring; `ShareLinkPanelProps` has no `onDisable`/`onReenable`/`onRevoke` prop at all (`share-link-panel.tsx:47-73,294-309`). `useShareLink()`'s `disable`/`reenable`/`revoke` actions (`use-share-link.ts:445-467`) exist, are fully unit-tested (`use-share-link.test.ts:366,383,404`), and are never invoked from any production JSX. `ShareLinkAccessControls` (PIN/expiry) and the full configuration editor are likewise imported nowhere outside their own tests. The panel's own code comment documents this as an intentional simplification: *"no advanced/settings/kebab-menu escape hatch of any kind"* (`share-link-panel.tsx:23-45`).

**This is presented as a finding requiring an explicit product decision, not asserted as a bug.** Rotate already provides an equivalent emergency-invalidation capability (a new secret immediately invalidates the old one, with an explicit confirmation warning to that effect — `share-link-channels.tsx:90-91,225-236`). It is plausible this is a deliberate "one kill-switch button, not three" simplification for V1. It is equally plausible Disable/Revoke were meant to ship and simply never got wired. This audit cannot determine intent from code alone and does not guess.

**Everything that IS wired (Rotate, PIN set/clear, Expiry set/clear) is solidly engineered — PASS on all four owner-lifecycle checks**: double-submit is prevented by a synchronous ref guard checked *before* any state update (`use-share-link.ts:395-396`), not merely a React-state disabled flag; destructive actions (Rotate, Remove PIN) use a genuine two-step confirm/cancel component with an explicit warning string, not a single click; every mutation re-fetches authoritative server state on success rather than applying an optimistic local update, guarding against a stale response from a switched session; and the same single in-flight guard structurally prevents any two mutations from racing on one panel instance.

---

## 12. Mobile audit

**Mostly PASS.** No fixed-pixel-width overflow risk found anywhere in the public or owner share components (`width:"100%"` + `maxWidth` pattern throughout); modal sizing correctly adapts (bottom-sheet on mobile, viewport-clamped centered panel on desktop, both internally scrolling); PIN form and loading/error states render sensibly at any width; no stray fixed/sticky elements found.

Two **PARTIAL** findings: (1) message bodies are explicitly hardened against long-unbroken-token overflow (`overflowWrap:"anywhere"`), but task titles and resource labels in `client-project-view.tsx` are not given the same guard; (2) several hand-rolled action buttons in the Communication History modal (Mark reviewed/Resolve/Dismiss/Analyze/Reply, `client-communication-history-modal.tsx:559-578`) use `padding:"4px 8px"` (≈20-22px effective height), well under the ~44px touch-target guideline, in visible contrast to the codebase's own `DashboardButton` sizing (34-48px) and its own explicitly-sized icon-only Close button (36×36px) elsewhere in the same file tree.

---

## 13. RTL audit

**PASS on the content that matters most (message bodies), PARTIAL on chrome and item-level granularity.** `dir={contentDirection}` is correctly applied to the page root and the Messages section, with an explicit code comment enforcing the "never omit `dir`" principle; per-field `dir="auto"` is additionally applied to client message bodies and the owner reply textarea. However, the public page's own top-level chrome states (loading, PIN form, error, rate-limited) never receive any `dir` attribute at all — low-impact today since that text is hardcoded English, but inconsistent with the codebase's own stated rule. Task titles and resource labels do not get their own per-item `dir="auto"` the way message bodies do, so a project explicitly configured `ltr` with an occasional RTL-language task title relies on the container's single direction rather than per-item detection. No hardcoded `left`/`right` CSS (instead of logical `start`/`end`) was found inside any component actually rendered under `dir={contentDirection}` — the four `left`/`right` hits found are all in owner-only, always-English dashboard chrome unaffected by a project's content direction.

---

## 14. Accessibility audit

**Strong on interaction mechanics, PARTIAL on semantics and live-region coverage.** The shared `ResponsiveDialog` primitive has extensive, dedicated test coverage for accessible naming, focus trapping, initial-focus resolution, Escape handling, and focus restoration to the triggering element — genuinely robust, not assumed. Every interactive element checked across the share-link component set is a real `<button>`/`<a>`/`<input>`/`<textarea>`, never a `<div onClick>`. Status is always conveyed as visible text, never color-only. Form fields have correctly paired labels.

Two **PARTIAL** findings: (1) `ClientProjectView`'s section labels ("Progress," "Tasks," "Attachments," etc.) are styled `<span>` elements rather than heading elements (though each section does carry `aria-label`, partially offsetting this for landmark navigation), and the public page's top-level loading/PIN/error states have no heading element at all; (2) those same top-level page states, plus the Communication History modal's own loading/toolbar text, have no `role="status"`/`role="alert"`/`aria-live` — a screen-reader user gets no announcement when the page moves through loading → PIN-required → ready/error, in contrast to the good `role="status"`/`role="alert"` coverage already present on validation errors, send confirmations, and reply/analyze errors elsewhere in the same components.

---

## 15. Failure-behavior audit

**Full PASS across all ten scenarios checked** (invalid secret, revoked/disabled/expired link, wrong PIN, rate-limit exhaustion, tampered fileRef, unmapped resource, malformed body, unhandled internal error). Every public route wraps its full body in try/catch; the shared authorization gate returns a uniform `null` for every distinct failure reason, logging only a fixed, low-cardinality, non-identifying stage tag server-side, never in the response. Wrong secret and nonexistent link are genuinely indistinguishable. Wrong PIN is the one intentionally-distinguishable outcome, and only ever reachable *after* the secret itself has already verified — it leaks no information to an attacker who lacks the secret. Unhandled exceptions always collapse to a fixed generic 500 body with no stack trace, SQL text, or internal identifier. `Cache-Control: private, no-store` is maintained on every error response, not just success responses.

---

## 16. Test coverage matrix

| Area | PASS coverage | GAP in coverage |
|---|---|---|
| Rate limiting | Route-level 429 tests for all 5 routes; dedicated policy unit tests; static migration test for the RPC | No live-Postgres concurrency test in CI (an external verification report is referenced but not tracked as an automated test) |
| Session/PIN/secret | Extensive — hashing, constant-time compare, all 6 invalidation transitions, cross-link isolation | No cleanup-sweep test (none exists to test, since no sweep exists) |
| File/resource | 600+ line route test file + dedicated fileRef unit tests, covering nearly every scenario above | No literal single-byte-flip tamper test (mechanism is covered, exact test scenario is not) |
| Public messages | 280+ line unit test file + 930+ line route test file | No idempotency/replay test (matches the factual absence of the feature itself) |
| Headers/privacy/errors | Strong indirect coverage via route tests' header assertions | No dedicated `X-Robots-Tag`/`Permissions-Policy` test (matches the gaps found) |
| Owner lifecycle (Rotate/PIN/Expiry) | `use-share-link.test.ts` covers double-submit, confirm, re-fetch, race prevention | Disable/Revoke/Re-enable tested only at the hook level, never at a component/integration level reachable through real UI (since no UI reaches them) |
| Mobile/RTL | No dedicated visual/viewport tests found (expected — this is typically manual/visual QA territory, not unit-testable) | n/a |
| Accessibility | `responsive-dialog.test.tsx` has real, explicit a11y assertions | `client-communication-history-modal.test.tsx` has zero aria-/role-/focus-/keyboard-specific assertions of its own |

---

## 17. Confirmed gaps

Ranked by concreteness and ease of remediation, not asserted severity:

1. `X-Robots-Tag` missing on every route under `app/api/share/**` (page already has it via three layers; API routes have none).
2. File-serving route's CSP lacks `frame-ancestors` (page has it; file route only has `sandbox`).
3. `Permissions-Policy` absent everywhere.
4. `script-src` unrestricted in the page's CSP — explicitly, deliberately deferred per the code's own comment, naming this exact phase.
5. No cleanup/expiry sweep job for sessions/grants/rate-limit buckets (storage growth only, not an access-control issue).
6. Malformed-request-volume flooding has no dedicated counter (bounded only by a byte-size cap).
7. File-fetch aggregate byte/bandwidth volume is uncapped (bounded only by request count).
8. Secret-guessing has no per-link rate-limit scope (mitigated by 256-bit entropy).
9. `authorDisplayName` is fully spoofable with no anti-impersonation control.
10. Client-side stale-tab window after revoke/disable/expire/PIN-change/rotation/unmap (bounded — no new data exposure).
11. Small touch targets on several Communication History modal action buttons.
12. Task/resource text not guarded against long-unbroken-token overflow (message bodies are).
13. RTL: top-level page chrome has no `dir`; task/resource labels lack per-item `dir="auto"`.
14. Accessibility: some page/modal sections use non-heading elements for section labels; several loading/error state transitions lack `aria-live`/`role="status"`.
15. **Disable/Revoke/Re-enable have no reachable owner-facing UI** — flagged separately as a product-decision item, not a security/hardening gap per se (Rotate provides equivalent invalidation capability).

---

## 18. Already-satisfied requirements

- Rate-limiting mechanism itself: real, DB-atomic, fail-closed, covers all five public routes.
- PIN hashing (scrypt, correct parameters, never raw).
- Constant-time secret/PIN comparison.
- All six link-state invalidation transitions correctly force re-authorization on the very next request, with no exceptions found.
- Cross-link session/grant isolation.
- Complete public data-leak denylist (15/15 items) — nothing leaks.
- Analytics/tracking exclusion on the public surface (real, enforced, not just documented).
- `noindex`/`Referrer-Policy`/`Cache-Control: no-store`/`nosniff` on the public page and (except the one gap) API routes.
- File/resource security: opaque fileRef, tamper-resistant, cross-link/cross-resource replay blocked, revoked-link-blocks-files, no path traversal, correct headers.
- Public message validation: length limits, empty rejection, safe (non-executable) rendering, live re-authorization at submission.
- Fail-closed, enumeration-safe, non-leaking error handling on every failure scenario checked.
- Mobile responsive layout fundamentals (fluid widths, adaptive modal sizing).
- RTL for the highest-traffic content (message bodies, reply text).
- Accessibility interaction mechanics (real focusable elements, dialog focus trap/restoration, Escape handling, text-not-color-only status).
- Owner-lifecycle engineering quality for every action that IS wired (double-submit prevention, confirmation on destructive actions, authoritative re-fetch, race prevention).

---

## 19. Optional / deferred findings

All of items 5–14 in section 17 are classified **OPTIONAL** — real, evidenced, worth doing, but none blocks Production schema rollout, app deploy, or feature-flag enablement on its own, and none was found to have a concrete exploited-in-practice risk profile (secret entropy neutralizes most of the guessing/replay-adjacent concerns; the stale-tab window exposes no new data; the a11y/mobile/RTL items are UX-quality, not security). Item 15 (Disable/Revoke UI) is explicitly **DEFERRED PENDING A PRODUCT DECISION** — this document does not recommend a resolution.

---

## 20. Exact Phase 7 proposed scope

**The smallest coherent slice, if any implementation is authorized**: three purely additive, low-risk response-header changes, no behavior change, no new grant/RLS/schema surface:

1. Add `X-Robots-Tag: noindex, nofollow, noarchive` to the shared header-building helper used by all five `app/api/share/**` routes (mirrors the page's own existing three-layer protection).
2. Add `frame-ancestors 'none'` to the file-serving route's existing `Content-Security-Policy: sandbox` header (mirrors the page's own CSP; one string change).
3. Add a conservative `Permissions-Policy` header (e.g. disabling camera/microphone/geolocation) consistently across the page and API routes.

This is items 1–3 from section 17 only. Items 4 (CSP `script-src`) and 15 (Disable/Revoke UI) are explicitly **excluded from "smallest slice"** — the former is an application-wide initiative disproportionate to a Client-Share-scoped slice, and the latter requires a product decision this document does not make. Items 5–14 are optional polish, appropriately deferred.

---

## 21. Acceptance criteria

For the three-item slice in section 20, if authorized: each route's response headers include the new header with the exact specified value, verified by a new or extended route-level header-assertion test per route (matching the existing test pattern already used for `Referrer-Policy`/`Cache-Control`/`nosniff` in each route's own test file) — REQUIRED if this slice is implemented. No other acceptance criteria apply, since no other item is proposed for implementation.

---

## 22. Implementation order

Not applicable this turn — no implementation is authorized. If the section 20 slice is separately authorized: header changes only, one route file at a time, each followed by its own test update — no ordering dependency exists between the three header additions.

---

## 23. Verification plan

Not applicable this turn. For any future authorized slice: targeted route tests only (matching section 21), then the user's own full build, per this whole engagement's established discipline. No new disposable-runtime SQL package is needed — these are pure application-layer header changes with no database surface.

---

## 24. Production-readiness implications

None of the confirmed gaps blocks Production schema rollout or app deploy. For feature-flag enablement (public launch) specifically:

- Items 1–3 (section 20): recommended to close before public launch as low-cost, zero-risk good practice — not a hard blocker.
- Item 4 (CSP `script-src`): recommended as a separate, deliberately-scoped future initiative, not a launch blocker given `object-src`/`frame-ancestors`/`base-uri` already close the more exploitable vectors for this specific feature, and given third-party script injection is already independently mitigated by the analytics-exclusion mechanism.
- Item 15 (Disable/Revoke UI): does **not** block launch — Rotate already provides an operational "kill switch" equivalent in effect. Recommend the user make an explicit decision (ship as-is, or add the buttons) before or shortly after launch, not as a rollout gate.
- Items 5–14: none identified as launch-blocking; all are appropriate for a future, lower-priority pass.

---

## 25. STOP boundary

This document is mapping/audit output only. No application code, test implementation, migration, generator, or SQL was written or executed to produce it. No Phase 7 implementation is authorized. No Production action, feature-flag change, or Phase 8 work is authorized. The next action is the user's own decision: authorize the small section 20 slice, make the Disable/Revoke UI product decision, defer some or all of the optional items, or proceed toward a separate Phase 8 rollout planning turn once satisfied with Phase 7's disposition.

**STOP.**
