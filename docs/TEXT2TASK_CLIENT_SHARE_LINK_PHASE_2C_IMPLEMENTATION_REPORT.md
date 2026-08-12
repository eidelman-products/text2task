# Text2Task Client Share Link — Phase 2C Implementation Report

## Phase 2C — Owner Access Controls + Share Channels

**Status: PHASE 2C — COMPLETE.** Not staged, not committed, not pushed,
not deployed. No migration created — this phase is pure application/UI
work over the already runtime-verified Phase 1B.3 access-operation RPCs.
`TEXT2TASK_CLIENT_SHARE_ENABLED` remains disabled. Production not
accessed, not modified, not enabled at any point.

**Phase 2C final acceptance: PASS.** Static/targeted tests 2139/2139
PASS; TypeScript 0 errors; a dedicated browser-safety acceptance review
(§6a) found and corrected two real defects (Native Share hydration
safety, WhatsApp popup-handle/reentrancy correctness) before this phase
could be accepted; user-run full production Build PASS (Next.js 16.1.6
compilation with Turbopack PASS in 27.1s, TypeScript during Build PASS
in 22.5s, static generation 89/89 PASS, final page optimization
succeeded, no Build errors). Full detail in §9 below.

**Ready to be committed as its own checkpoint — the only remaining Phase
2C action is the user's Git checkpoint commit. Phase 2D does not begin
until that commit exists.**

---

## 1. Scope Implemented

Extends the existing `ShareLinkPanel` (no new top-level modal) with:

1. **PIN** — Add / Change / Remove, over the existing `hasPin`-only read
   contract (an existing plaintext PIN is never retrievable).
2. **Expiry** — Set / Replace / Clear, with correct local-to-UTC
   timezone conversion and client-side future-only validation.
3. **Secret rotation** — explicit two-step confirmation with an
   invalidation warning, reusing the existing rotate RPC/route
   unchanged.
4. **Share channels** — existing Copy Link preserved; new Native Share
   (`navigator.share`, feature-detected) and WhatsApp (plain `wa.me`
   prefilled link, no API/OAuth/phone number).

All five groups are owner-authenticated UI only. No public route,
anonymous session, PIN verification endpoint, or projection of any kind
was added — none of that exists anywhere in the diff.

---

## 2. Exact APIs Reused (no new endpoint, no folding into save_share_configuration)

| Operation | Route | Repository function | RPC |
|---|---|---|---|
| Set/replace PIN | `PUT /api/share-links/[id]/pin` | `setShareLinkPin` | `set_share_link_pin` |
| Clear PIN | `DELETE /api/share-links/[id]/pin` | `clearShareLinkPin` | `clear_share_link_pin` |
| Set/replace expiry | `PUT /api/share-links/[id]/expiry` | `setShareLinkExpiry` | `set_share_link_expiry` |
| Clear expiry | `DELETE /api/share-links/[id]/expiry` | `clearShareLinkExpiry` | `clear_share_link_expiry` |
| Rotate secret | `POST /api/share-links/[id]/rotate` | `rotateShareLinkSecret` | `rotate_share_link_secret` |
| Reveal (Copy/Share/WhatsApp) | `POST /api/share-links/[id]/reveal` | `revealShareLinkSecret` | `reveal_share_link_secret` |

Every one of these routes, repository functions, RPCs and their Zod
contracts already existed (delivered in `202608060002_client_share_access_operations.sql`
and Phase 1B.3's application layer) and were used exactly as written —
inspected before use, not assumed. This phase added five new thin client
wrappers in `share-link-client.ts` (mirroring the existing
`activateShareLink`/`disableShareLink` pattern exactly: `PUT`/`DELETE`
with the existing request schema, or a bare `POST`) and corresponding
`useShareLink` actions. No new route file, no new RPC, no schema change
in `lib/share/share-contracts.ts` (all request/response schemas —
`setSharePinRequestSchema`, `setShareLinkExpiryRequestSchema`,
`setSharePinResponseSchema`, `clearSharePinResponseSchema`,
`setShareLinkExpiryResponseSchema`, `clearShareLinkExpiryResponseSchema`,
`rotateShareLinkSecretResponseSchema` — already existed from Phase 1B.3
and are reused verbatim as both the client-side validation surface and
the response parser).

---

## 3. PIN UX and the No-Plaintext-Read Rule

**File**: `app/components/dashboard/tasks/share-link/share-link-access-controls.tsx`

The management-state read exposes only `hasPin: boolean` — by design, an
existing PIN can never be retrieved or displayed, and this component
never attempts to. `hasPin=false` renders "Add PIN"; `hasPin=true`
renders a "PIN protected" badge with "Change PIN" and "Remove PIN".

- **Validation**: reuses the exported `setSharePinRequestSchema` from
  `lib/share/share-contracts.ts` — the exact same schema the `PUT` route
  parses the request body through (currently 4-6 ASCII decimal digits,
  matching `lib/share/share-pin.server.ts`'s `PIN_PATTERN`, verified from
  the actual server-only helper before use). An invalid PIN is rejected
  client-side and the API is never called.
- **No duplicated hashing**: `share-pin.server.ts`'s `hashSharePin` is
  `"server-only"` and was never imported into this client component —
  the existing repository/RPC path (`setShareLinkPin` →
  `set_share_link_pin`) remains the sole place a PIN is ever hashed.
- **Non-retention**: the PIN input is cleared (value reset to `""`, form
  closed) the instant Save/Change is submitted — before the request even
  resolves, not merely "after success" — and is also cleared on Cancel
  and on any authoritative state refresh (open, or a successful
  set/clear, via a `useEffect` keyed on `link.id`/`link.configurationVersion`,
  mirroring the Phase 2B editor's own reset pattern). The PIN never
  appears anywhere else in the DOM.
- **Remove PIN confirmation**: reuses the existing two-step
  `ConfirmableActionButton` pattern (extracted to a new shared file,
  `share-link-confirmable-button.tsx`, so Phase 2A's Disable/Revoke and
  Phase 2C's Remove PIN/Rotate all share one implementation instead of a
  second modal/confirmation system) — first click arms, second confirms.

---

## 4. Expiry UX and Timezone Handling

**Files**: `share-link-datetime.ts` (+ `.test.ts`), `share-link-access-controls.tsx`

Repository inspection found no existing datetime-local ↔ UTC-ISO
conversion helper, and confirmed `lib/tasks/date-only.ts`'s `DateOnly`
must **not** be reused — it is explicitly calendar-day-only and its own
module bans `.toISOString()`/UTC round-tripping, which would silently
drop the time-of-day an owner picks. A new, narrowly-scoped module was
written instead:

- `utcIsoFromLocalDateTimeInput(value)` — parses a native
  `<input type="datetime-local">` value and builds the UTC ISO timestamp
  via `new Date(year, month-1, day, hour, minute)` (the multi-argument
  constructor interprets its arguments as **local** time per the JS
  spec) followed by `.toISOString()` — a correct, deterministic
  local-to-UTC conversion using the browser's real timezone offset, never
  a naive string concatenation. Returns `null` (never silently corrects)
  for empty, malformed, or calendar-invalid input (e.g. month 13 — Date's
  own rollover behavior is explicitly checked against and rejected).
- `localDateTimeInputFromUtcIso(iso)` — the inverse, for prefilling
  "Change expiry".
- `formatShareLinkExpiryForDisplay(iso)` — human-readable local display
  via `Intl.DateTimeFormat`.

**Client-side validation, server remains authoritative**: before calling
the API, the component checks the converted timestamp is strictly in the
future (`Date.now()` comparison) and re-validates it through the
existing exported `setShareLinkExpiryRequestSchema`. A past or malformed
value never reaches the API and is never silently corrected — only a
plain inline error is shown, and the owner's own typed value is left
untouched for them to fix.

**Timezone testing**: `share-link-datetime.test.ts` never hardcodes an
expected UTC string (that would only be correct in whichever timezone
happened to run the suite) — every expectation is derived through the
exact same `new Date(y, m, d, h, min)` local-time constructor the
implementation itself uses, so the assertions are correct in every
timezone, including UTC (the common CI default). 17 tests, including a
December 31/January 1 local-boundary case and a full round-trip proof.

**Backend restriction respected, not bypassed**: `clear_share_link_expiry`
rejects `state = 'expired'` with `SHARE_LINK_STATE_CONFLICT` (a real,
inspected constraint — `project_share_links_state_lifecycle_check`
requires an expired link to keep a non-null `expires_at`). "Remove
expiry" is not rendered at all while `link.state === "expired"` — Set/
Change expiry remains available in every non-revoked state, matching
`set_share_link_expiry`'s own lack of a state restriction.

---

## 5. Rotation Confirmation and Secret Handling

**Files**: `use-share-link.ts`, `share-link-channels.tsx`

Rotation only renders for `state ∈ {active, disabled}`, matching
`rotate_share_link_secret`'s own restriction exactly (inspected from
`202608060002_client_share_access_operations.sql`: draft has no secret
to rotate, revoked is terminal, expired is unsupported). First click
arms a `ConfirmableActionButton` carrying an explicit warning line —
*"Rotating the link will immediately invalidate the previously shared
client link. Anyone using the old link will lose access."* — and only
the second, explicit "Confirm rotate" click calls the hook's `rotate()`
action. No new cryptography was written: `rotateShareLinkSecretRequest`
(existing) calls the existing `rotate_share_link_secret` RPC via the
existing repository function, which itself performs the existing
secret-generation/digest/AES-256-GCM encryption path in
`share-secret.server.ts`/`share-secret-encryption.server.ts` — untouched.

**Secret non-persistence proof**: `rotateShareLinkSecretRequest`'s
resolved promise includes a freshly generated plaintext `secret` field
(mirroring `activateShareLink`'s response shape) — the hook's `rotate`
action `await`s the call and never reads that field, so it is discarded
the instant the promise resolves, never assigned to any state. Verified
by a dedicated test (`use-share-link.test.ts`) that serializes the
entire hook state to JSON after a successful rotation and asserts the
generated secret string is not a substring anywhere in it. If the owner
needs the rotated link, Copy/Share/WhatsApp perform their own fresh
`reveal_share_link_secret` call afterward — rotation's own response
secret is never reused for that.

Rotation never changes PIN, expiry, or content/configuration (its own
`UPDATE` statement, inspected, touches only `secret_digest`,
`secret_digest_version`, `rotated_at`, `configuration_version`) and never
silently re-activates a disabled link (its own `SET` clause has no
`state` column at all).

---

## 6. Copy / Native Share / WhatsApp

**File**: `use-share-link.ts` (`revealEphemeralShareUrl`, `copyLink`, `nativeShare`, `whatsapp`), `share-link-channels.tsx`

A single internal helper, `revealEphemeralShareUrl(linkId)`, reveals the
secret and builds `${origin}/share/${publicId}#${secret}` entirely
within its own function scope and returns it to its immediate caller —
never assigned to any component or hook state. Copy Link (unchanged
behavior, now refactored through this shared helper), Native Share and
WhatsApp all use it, so the reveal + URL-construction logic exists in
exactly one place rather than being duplicated three times.

**Copy Link**: unchanged from Phase 2A — still writes to the clipboard
inside the same closure and discards the URL immediately.

**Native Share**: capability is determined by hydration-safe post-mount
detection, not by reading `navigator.share` in the render body.
`nativeShareSupported` starts as `useState(false)` — deterministically
`false` on every server render and every first client render — and is
only updated by a mount-only `useEffect` (no new dependency). When
unsupported, the component shows *"Native sharing is not available in
this browser. Use Copy link instead."* instead of a button, so the
action is never even invocable in that case (the hook action itself also
fails closed defensively if called anyway). The share payload is a fixed
neutral title/text plus the ephemeral URL — no amount, priority, client
contact information, raw input, internal notes or timeline data. A user
dismissing the native share sheet rejects with `DOMException` named
`"AbortError"`, which is caught and swallowed as a benign no-op — it
never sets `actionError`, so cancelling is never displayed as an
application failure (verified by a dedicated test distinguishing
AbortError from a real share failure). See §6a for why the render-time
version of this check was a real hydration-safety defect and how it was
corrected.

**WhatsApp**: a plain `https://wa.me/?text=<encoded message>` link — no
API integration, no OAuth, no phone number. Popup-blocking safety: the
channel component's `onClick` handler calls `window.open("about:blank",
"_blank")` **synchronously** (deliberately without the `noopener`
window feature — see §6a), still inside the click's own user-gesture
context, *before* the async reveal begins, then severs the opener
relationship by setting `popup.opener = null` directly on the returned
reference. The hook's `whatsapp(popup)` action only ever navigates that
already-open window (`popup.location.href = waUrl`) once reveal
resolves, never calling `window.open` itself after an `await`. If reveal
fails, or if the navigation attempt itself throws, the pre-opened blank
window is explicitly closed rather than left as an orphan tab (both
paths verified by dedicated tests). If no popup handle was supplied
(e.g. the caller's own `window.open` was itself blocked), it falls back
to a direct post-reveal `window.open` as the best remaining option. The
`wa.me` URL (which embeds the secure share URL in its encoded message)
is never logged. A component-local synchronous reentrancy guard prevents
a rapid second click from ever creating a second popup context — see
§6a.

---

## 6a. Browser-Safety Acceptance Review (2026-08-12)

A narrow, dedicated acceptance review of Native Share and WhatsApp found
and corrected two real browser-safety defects in the initial Phase 2C
implementation before this phase could be accepted. No backend, RPC,
migration, or Phase 2B code was touched.

1. **Native Share — hydration safety.** The initial implementation
   computed `nativeShareSupported` directly in the render body
   (`typeof navigator !== "undefined" && typeof navigator.share ===
   "function"`). While `ShareLinkPanel` currently only mounts this tree
   post-interaction (never during actual SSR/hydration), that safety was
   incidental to a sibling's gating, not intrinsic to this component.
   **Fix**: capability detection moved to hydration-safe post-mount
   detection — `useState(false)` + a mount-only `useEffect`, so every
   server render and every first client render is unconditionally
   `false`, and the real capability is only applied after mount.
   **Proof**: two new tests using real React APIs (`renderToString` +
   `hydrateRoot` with a `console.error` spy) prove that hydrating
   server-rendered HTML in a simulated browser that *does* support
   `navigator.share` produces **zero React hydration-mismatch
   warnings**, and that the UI correctly updates to show the Share
   button only after the mount effect flushes.

2. **WhatsApp — popup handle correctness.** The initial implementation
   pre-opened the popup via `window.open("", "_blank",
   "noopener,noreferrer")`. Verified actual browser semantics: passing
   the `noopener` feature makes Chromium/Firefox/WebKit **always return
   `null`** from `window.open` — the returned handle the code depended
   on for post-reveal navigation was silently always `null`, so every
   WhatsApp share silently fell through to the post-await fallback
   `window.open` call, exactly the gesture-loss/popup-blocking failure
   mode the pre-open strategy existed to prevent. **Fix**: the pre-open
   call no longer passes `noopener`; the opener relationship is instead
   severed by setting `popup.opener = null` directly on the returned
   reference, which does not affect the parent page's own ability to
   hold and later navigate that reference. Navigation failures (not only
   reveal failures) now also close the pre-opened popup rather than
   leaving an orphan tab.

3. **WhatsApp — reentrancy timing.** Tracing the exact click flow found
   that `window.open` was called synchronously in the component's click
   handler *before* `onWhatsApp` (and therefore before the hook's own
   `actionInFlightRef` guard) was ever invoked — a rapid second click
   could create a second popup context even though the hook would
   correctly block the second reveal/navigation. **Fix**: added a
   component-local synchronous ref guard (`whatsappInFlightRef`),
   checked and set at the very top of the click handler — mirroring the
   hook's own established ref-guard pattern — released once the
   surrounding action completes. A new test fires two synchronous clicks
   (via `fireEvent`, not `userEvent`, to avoid its built-in inter-event
   delay) and proves exactly one popup and one `onWhatsApp` call result.

**Final browser-safety targeted suite result: 2139/2139 PASS** (up from
2134 before this review — 5 new regression tests: 2 hydration-safety
tests, 1 opener-severance test, 1 rapid-double-click test, and 1
navigation-failure-closes-popup test).

---

## 7. Lifecycle / State Restriction Matrix (inspected, not inferred)

| Operation | Allowed states | Source |
|---|---|---|
| Set/replace/clear PIN | draft, active, disabled, expired (not revoked) | `set_share_link_pin`/`clear_share_link_pin`, no state check beyond `state = 'revoked'` |
| Set/replace expiry | draft, active, disabled, expired (not revoked) | `set_share_link_expiry`, no other state restriction |
| Clear expiry | draft, active, disabled (not expired, not revoked) | `clear_share_link_expiry` explicitly rejects `state = 'expired'` with `SHARE_LINK_STATE_CONFLICT` |
| Rotate secret | active, disabled only | `rotate_share_link_secret` explicitly rejects any other state with `SHARE_LINK_STATE_CONFLICT` |
| Reveal (Copy/Share/WhatsApp) | active only | `reveal_share_link_secret` explicitly rejects any other state with `SHARE_LINK_STATE_CONFLICT` |
| Revoked link | management read structurally excludes it (`link: null`) | unchanged from Phase 1B/1C |

The UI renders from this exact matrix — Copy/Native Share/WhatsApp and
Rotate never render (not merely "disabled") outside their permitted
states, and Remove Expiry never renders for `expired`. No second
client-side lifecycle state machine was invented; every restriction
above is enforced by the existing backend and merely *reflected* in the
UI, never bypassed or duplicated.

---

## 8. UI Structure

`ShareLinkPanel` now renders, for a managed link, in order: `LinkStateView`
(Status badge + Activate/Disable/Re-enable/Revoke, unchanged except Copy
Link moved out — see below), the new `ShareLinkAccessControls` (PIN +
Expiry, an "Access" section), the new `ShareLinkChannels` (Copy/Native
Share/WhatsApp/Rotate, a "Link" section), then the existing Phase 2B
`ShareLinkConfigurationEditor` (Content) — all inside the same existing
`ResponsiveDialog`. No second top-level modal was created. Copy Link was
relocated from `LinkStateView` into `ShareLinkChannels` alongside the new
channels it now shares a state-gating rule with (`state === "active"`) —
verified this does not break any existing Phase 2A test, since all of
them query by accessible role/name rather than DOM position.

---

## 9. Test Results

**New/updated test files** (final totals per file, after the §6a
browser-safety review):
- `share-link-datetime.test.ts` (new) — 17 tests
- `share-link-access-controls.test.tsx` (new) — 14 tests
- `share-link-channels.test.tsx` (new) — 18 tests (includes the §6a
  hydration-safety, opener-severance and rapid-double-click regression
  tests)
- `share-link-client.test.ts` — 17 tests total (PIN/expiry/rotate
  wrappers added)
- `use-share-link.test.ts` — 34 tests total (PIN/expiry/rotate/Native
  Share/WhatsApp actions, reentrancy, secret non-persistence, AbortError
  handling, popup-blocking safety, and the §6a navigation-failure
  regression test)
- `share-link-panel.test.tsx` — 29 tests total (wiring, regression)

**Targeted run** (`app/components/dashboard/tasks/share-link/`,
`app/api/share-links/[id]/{pin,expiry,rotate,reveal}`, `lib/share/`,
`supabase/migrations/`): **2139 / 2139 passed, 0 failed**, across 41 test
files.

**`npx tsc --noEmit -p tsconfig.json` across the full repository: 0
errors.**

**User-run full production Build: PASS.** `npm run build`, Next.js
16.1.6 (Turbopack):

- Compiled successfully in 27.1s.
- TypeScript finished successfully in 22.5s.
- Page data collection succeeded.
- Static generation succeeded: 89/89 pages.
- Final page optimization succeeded.
- No Build errors.

---

## 10. Production State

- No migration created or modified in this phase.
- No Client Share migration (Phase 1A through 2B's `202608110002`) has
  been applied to Production.
- `TEXT2TASK_CLIENT_SHARE_ENABLED`: unchanged — still disabled.
- This agent never ran SQL and never accessed, created or deleted any
  Supabase project or Production resource at any point in Phase 2C.

---

## 11. Scope Boundary Confirmation

Not implemented in this task, per the accepted Phase 2C scope and the
explicit stop conditions: Preview (mock or real), any project-data
serialization into a client-facing mock, a share-projection builder, the
public `/share/[publicId]` route, `/api/share/session`, anonymous
cookies/sessions, secret verification for public users, PIN verification
for public users, WhatsApp Business API/account integration, analytics
around secret-bearing actions, and any Production configuration change.
Those remain Phase 2D/Phase 3 and later.

**Phase 2C has passed static review, the dedicated browser-safety
acceptance review, and the full production Build. Phase 2D is next, and
untouched. The only remaining Phase 2C action is the user's Git
checkpoint commit — Phase 2D does not begin until that commit exists.**
