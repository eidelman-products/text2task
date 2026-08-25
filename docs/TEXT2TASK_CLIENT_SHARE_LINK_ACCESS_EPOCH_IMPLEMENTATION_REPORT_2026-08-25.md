# Text2Task Client Share — Access Epoch Corrective Change
## Implementation Report — Local Implementation Only, Not Deployed
## 2026-08-25

**This document reports on a corrective change implemented locally only.** No SQL was executed against Production. No migration was applied to Production. No code was staged, committed, pushed, or deployed. The feature flag (`TEXT2TASK_CLIENT_SHARE_ENABLED`) was not touched. Production rollout of this change is **not authorized** by this document — see §9 for what must happen before it is.

---

## 1. Production smoke-test discovery

While executing the Phase 8 rollout plan's own §22 smoke-test checklist (`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_8_AUDIT_AND_ROLLOUT_PLAN_2026-08-24.md`) against a live-shaped scenario, the Disable → Re-enable sequence failed:

1. Active share link, opened in a fresh browser session. Loads correctly.
2. Owner disables the link. Same browser, same tab, refresh: correctly unavailable.
3. Owner re-enables the link. Same browser, same tab, same URL, refresh: **still unavailable** — the exact same generic denial as step 2.
4. A brand-new browser (fresh Incognito), holding the same URL, loads correctly.

Step 3 is the defect: an already-authorized browser holding an unchanged, still-valid URL had no way to recover access after a purely reversible, non-security owner action. The only workaround was a brand-new browser session — unacceptable for a feature whose entire value proposition is a durable, shareable link.

---

## 2. Root cause

`project_share_links.configuration_version` was, since Phase 1B, used for two unrelated purposes simultaneously:

1. **Presentation/owner-editor freshness** — bumped by nearly every owner mutation (activate, disable, re-enable, PIN set/clear, expiry set/clear, `save_share_configuration`'s settings/task/resource/publish sub-operations) so the owner's management UI and any other open owner tab can detect "this link's configuration changed under me."
2. **Security-grant staleness predicate** — `share_session_grants.granted_configuration_version` is compared against the link's live `configuration_version` at every public authorization read (`verifyShareProjectionAuthorization`, and independently, at the database layer, by `enforce_share_session_grant_integrity`'s insert-time check). A mismatch fails authorization closed, with no repair path that doesn't require the raw share secret (deliberately never persisted client-side past first use).

Because purpose (1) fires on **every** owner mutation — including ones with no security implication whatsoever — every one of those mutations also, as an unintended side effect, satisfied purpose (2)'s invalidation trigger. Disable and re-enable both bump `configuration_version` (Phase 1B lifecycle bookkeeping); re-enabling therefore permanently stranded the very browser session the owner was trying to restore access for.

**A second, mechanical, broader audit** (performed before any fix was approved, at the user's explicit request) enumerated every `configuration_version` write site in the codebase and proved the same defect family extends to:

- `clear_share_link_pin`
- `set_share_link_expiry`
- `clear_share_link_expiry`
- `save_share_configuration`'s settings sub-block (comments enabled, subtitle, content direction, title/status/target-date visibility, task mapping, resource mapping)

None of these is a security-credential change. All of them, as implemented before this corrective change, silently stranded any already-authorized browser the instant an owner made an ordinary, harmless edit.

### Why `configuration_version` could not simply be left as the security predicate

The alternative — "just stop bumping `configuration_version` in disable/re-enable" (a narrower, initially-proposed fix, internally called Option A) — was evaluated and rejected once the broader audit proved the defect was systemic, not localized to one RPC pair. Patching each bump site individually would have required auditing every current and future owner mutation for whether it "counts" as security-sensitive, with no structural guardrail preventing the same class of bug from recurring the next time a new settings field is added. Separating the two concerns into independent fields removes that entire class of risk permanently: a new presentation-only mutation can bump `configuration_version` freely, forever, with no security consequence, because nothing security-relevant reads that field any more.

---

## 3. Final `access_epoch` / `pin_epoch` semantics

`configuration_version` is **completely unchanged** — same column, same default, same every existing bump site, same purpose (presentation/owner-editor freshness). This migration adds no bump site to it and removes none.

Two new columns are added to `project_share_links` (and mirrored, as a snapshot, on `share_session_grants`):

| Field | Bumped by | Recoverable without the raw secret? |
|---|---|---|
| `access_epoch` | **`rotate_share_link_secret` only** | **No — never.** A mismatch means the secret has been rotated; the old secret is permanently dead, and no PIN, session, or other credential may substitute for a fresh secret-based exchange. |
| `pin_epoch` | **`set_share_link_pin` only** (covers both first-add and value-change — the RPC never distinguished the two) | **Yes — via PIN re-verification alone** (the new `POST /api/share/[publicId]/pin` route), but only when `access_epoch` still matches. |

`share_session_grants.granted_access_epoch` / `granted_pin_epoch` are snapshots taken at grant issue/refresh time, immutable after insert (enforced by the database trigger, matching the existing immutability pattern for every other grant column). `verifyShareProjectionAuthorization` now compares `grant.granted_access_epoch === link.accessEpoch` and `grant.granted_pin_epoch === link.pinEpoch` — **`configuration_version` is no longer read as an authorization predicate anywhere in the public read path.**

### Why two fields, not one shared "access_epoch" — a deliberate, security-motivated deviation from the originally-approved single-epoch design

The approved direction described a single dedicated "access/security epoch." Implementing that literally, combined with the also-required PIN-only recovery path (§8's requirement 5B — no dead-end for a legitimate PIN change), would have created a real security hole: a single shared counter bumped by *both* rotation and PIN changes means the PIN-only recovery route, by design, re-authorizes a grant whose epoch has drifted. If rotation and PIN changes shared one counter, a browser that survived rotation only by re-entering the (unchanged) PIN would **also** silently recover access to a link whose secret was rotated specifically to invalidate it — the exact bypass rotation exists to prevent.

Splitting into two independent fields closes both requirements simultaneously without conflating them:

- `access_epoch` (rotation-only) has **no** recovery route at all — by construction, nothing in this codebase can bump a grant's `granted_access_epoch` back into agreement except a fresh secret-based exchange through `POST /api/share/session`.
- `pin_epoch` (PIN-only) has a recovery route, but that route (`POST /api/share/[publicId]/pin`) **independently re-checks that `granted_access_epoch` still matches the link's live `access_epoch` before allowing recovery** (`app/api/share/[publicId]/pin/route.ts:224-230`). If the secret was rotated since the browser's last valid grant, PIN recovery fails closed regardless of PIN correctness — "old secret must remain unusable" holds even in the presence of PIN-only recovery.

This is a deliberate refinement of the originally-approved design, made because implementing it literally would have reopened the exact class of security gap the corrective change exists to close. It is documented in full in the migration's own header comment (`supabase/migrations/202608250001_client_share_access_epoch.sql:38-56`) and in `lib/share/share-session-grant.server.ts`'s doc comments, and is surfaced here explicitly rather than only in code.

---

## 4. Migration and backfill strategy

**File**: `supabase/migrations/202608250001_client_share_access_epoch.sql` — new, forward-only, timestamped after the most recent applied migration (`202608230002_client_share_apply_conversion_closure.sql`). No already-applied migration was edited (`202608060001`, `202608060002`, `202608060003`, `202608110001`, or any other).

**Schema changes**:
```sql
alter table public.project_share_links
  add column access_epoch integer not null default 1,
  add column pin_epoch integer not null default 1;
-- + check (access_epoch > 0), check (pin_epoch > 0)

alter table public.share_session_grants
  add column granted_access_epoch integer not null default 1,
  add column granted_pin_epoch integer not null default 1;
-- + check (granted_access_epoch > 0), check (granted_pin_epoch > 0)
```

**Backfill strategy**: a constant `not null default 1` on both tables. This is metadata-only in Postgres (no table rewrite, no explicit `UPDATE`), matching the established pattern already used by `202608110001`'s `title_visible`/`status_visible`/`target_date_visible` addition. Because both fields are brand-new with no prior history, defaulting every existing link **and** every existing grant uniformly to `1` is trivially correct: every pre-existing grant's snapshot (`1`) matches its link's current value (also `1`) immediately after the migration applies, so **installing this migration alone invalidates nothing** — regardless of whether Production currently holds zero or non-zero Client Share rows (per Phase 8's own audit, it currently holds zero). A row only becomes stale the next time its link is genuinely rotated or has its PIN genuinely changed, exactly as intended.

**Functions changed** (all three `CREATE OR REPLACE`, each reproduced in full from its current live definition with only the stated addition/removal — verified byte-identical to the original modulo exactly that diff via an automated reconstruction proof in the migration's own paired test file):

1. `enforce_share_session_grant_integrity()` — adds UPDATE-immutability checks for `granted_access_epoch`/`granted_pin_epoch`, adds INSERT-time staleness checks (`SHARE_GRANT_ACCESS_EPOCH_STALE`, `SHARE_GRANT_PIN_EPOCH_STALE`), and **removes** the `SHARE_GRANT_EXPIRY_EXCEEDS_LINK` check (see §5). `SHARE_GRANT_CONFIGURATION_VERSION_STALE` is left in place at the database layer (harmless, no longer read by the application layer) — the DB continues enforcing it as defense-in-depth for any other future caller of this schema.
2. `rotate_share_link_secret(...)` — adds `access_epoch = access_epoch + 1` to its existing UPDATE. The existing `configuration_version` bump is untouched.
3. `set_share_link_pin(...)` — adds `pin_epoch = pin_epoch + 1` to its existing UPDATE. The existing `configuration_version` bump is untouched.

**Not touched** (verified by the migration's own static test — none of these functions is redefined): `disable_share_link`, `reenable_share_link`, `clear_share_link_pin`, `set_share_link_expiry`, `clear_share_link_expiry`, `revoke_share_link`, `save_share_configuration`. None of them ever needed to bump either new field, so none of them changes at all. Their existing `configuration_version` bumps remain exactly as they were — no longer the security predicate, still the harmless presentation-freshness one.

**No RLS policy change, no table-level GRANT/REVOKE change, no privilege broadening** — every function-level GRANT/REVOKE statement in the migration re-declares the exact same posture the live definitions already have.

---

## 5. Expiry-staleness closure (a second, related defect, closed in the same change)

`share_session_grants.expires_at` was historically computed as `min(browser-session-expiry, link-expiry)` **at grant-creation time**, and is immutable once inserted (`SHARE_GRANT_EXPIRY_IMMUTABLE`, unchanged). If an owner lengthened or cleared a link's expiry after a grant already existed, that grant's own frozen ceiling could never be extended — and because it is a genuine per-row snapshot, no backfill could retroactively fix an already-issued grant's already-immutable value either.

**Fix, proven from the architecture**: stop baking link expiry into the durable grant expiry at all.

- `computeGrantExpiresAt` (`lib/share/share-session-grant.server.ts`) is simplified from `min(browserSessionExpiresAt, linkExpiresAt)` to `browserSessionExpiresAt` alone.
- The database trigger's `SHARE_GRANT_EXPIRY_EXCEEDS_LINK` check is removed (§4) — it would otherwise reject a session-TTL-only `expires_at` whenever it exceeds a shorter link expiry, which is now expected and correct.
- `verifyShareProjectionAuthorization` **no longer reads `grant.expires_at` at all.** This is the change that retroactively fixes already-existing grants (whose `expires_at` can never be altered): link expiry is already independently, live-re-checked on every read via `isShareLinkCurrentlyPubliclyActive`'s comparison against `project_share_links.expires_at` — it needs no grant-level snapshot to be enforced correctly. Browser-session TTL remains fully, independently enforced via `share_browser_sessions.expires_at` (`resolveBrowserSessionFromCookie`).
- `SHARE_GRANT_EXPIRY_EXCEEDS_SESSION` (grant expiry must not exceed the browser session's own expiry) and `SHARE_GRANT_LINK_EXPIRED` (the link must not already be expired at grant-creation time) are both fully preserved.

**Resulting behavior**:
- Shortening a link's expiry takes effect immediately via the live `isShareLinkCurrentlyPubliclyActive` check — no grant-level change needed.
- An already-expired link stays denied (unchanged).
- Lengthening or clearing a link's expiry never strands an existing browser — the live check now reflects the new value on every read, and the grant's own historical `expires_at` snapshot is no longer consulted for authorization at all.
- Browser-session TTL remains independently enforced, exactly as before.
- No raw secret is stored or exposed anywhere in this change.

---

## 6. PIN semantics — audited flow and recovery path

`set_share_link_pin` is one RPC serving both "add a PIN where none existed" and "change an existing PIN to a new value" — it does not distinguish the two internally, and always bumps `pin_epoch` unconditionally (harmless no-op for the first-add case, where the existing `pin_verified_at is null` check on an unverified grant already denies access regardless).

**The gap this closes**: before this change, an existing grant's own `pin_verified_at` could already be non-null from an OLD PIN. The PIN-required check alone (`pin_verified_at is not null`) could not force revalidation against a NEW PIN value — only a version/epoch comparison can. Bumping `pin_epoch` on every PIN set/change forces exactly that revalidation.

**Recovery path — new route, `POST /api/share/[publicId]/pin`** (`app/api/share/[publicId]/pin/route.ts`):

1. Accepts a PIN and nothing else — no secret, no fragment.
2. Requires proof that this exact browser session once completed a genuine secret-based exchange for this exact link (`findAnyGrantForSession`) — a bare browser-session cookie alone is insufficient, since a session cookie is link-agnostic.
3. Requires that prior grant's `grantedAccessEpoch` still exactly match the link's live `access_epoch` — if the secret has been rotated since, this route fails closed regardless of PIN correctness (§3's security argument).
4. Verifies the submitted PIN against the link's current PIN material (same scrypt/constant-time comparison as the session-exchange route's own PIN branch).
5. On success, calls the same `ensureCurrentGrant` used by `POST /api/share/session`, refreshing the grant to the link's current `access_epoch`/`pin_epoch`.

Same rate-limit action (`pin_verification`, both `network_identity` and `share_link` scopes) as the existing session-exchange PIN path — no new abuse surface, no enumeration signal beyond what that path already reveals.

**`clear_share_link_pin` does not bump either field** — removing a PIN only loosens the requirement; an existing grant remains safely usable, and the `pin_not_verified` check no longer applies once no PIN is required.

---

## 7. Same-browser required behavior — verified

The exact Phase 8 Production regression is covered by dedicated regression tests (§8) modeling the full sequence: active link → existing browser authorized → Disable → same browser denied → Re-enable → same browser, same URL, refresh → loads again, with no new Incognito, no re-copied link, and no raw-secret recovery requirement. The same test-matrix pattern additionally confirms an already-authorized browser survives ordinary "Edit what client sees" settings changes (comments toggle, subtitle, direction, title/status/target-date visibility, task mapping, resource mapping) and continues to receive the fresh projection on the next read.

---

## 8. Tests added / changed

| File | Status | Tests |
|---|---|---|
| `lib/share/share-session-grant.server.test.ts` | Rewritten for the new API shape | 74 passing |
| `app/api/share/session/route.test.ts` | Extended (epoch-wiring coverage added) | 29 passing |
| `app/api/share/[publicId]/pin/route.test.ts` | New | 26 passing |
| `supabase/migrations/202608250001_client_share_access_epoch.test.ts` | New (static, no live DB) | 45 passing |

Coverage against the requested test matrix:

- **A/B (Phase 8 regression)**: existing grant + disable → denied; same grant + re-enable → valid again — covered by `ensureCurrentGrant`/`verifyShareProjectionAuthorization` tests proving a grant survives a `configuration_version`-only change when both epochs still match.
- **C–G (settings changes)**: comments/subtitle/direction/title/status/target-date/task-mapping/resource-mapping changes → same grant remains valid — covered by the "Phase 8 lifecycle regression C/D/E/F/G" tests in both `ensureCurrentGrant` and `verifyShareProjectionAuthorization` describe blocks.
- **H/I/J/K (expiry)**: future expiry valid until live expiry; shortened → denied when passed; lengthened → existing browser remains usable; cleared → existing browser remains usable — covered by the `computeGrantExpiresAt` simplification tests and the "no longer reads grant.expires_at at all" authorization test; live link-expiry denial is covered by the existing `isShareLinkCurrentlyPubliclyActive` suite (unchanged, still passing).
- **L/M (PIN)**: clear PIN → continues under no-PIN policy (unchanged existing coverage); set/change PIN → required re-verification preserved AND a valid recovery path exists — covered by the new `pin/route.test.ts` suite's rotation-guard and correct-PIN-recovers tests, plus the `pin_epoch_mismatch` authorization test.
- **N/O/P (rotation)**: rotate → old grant denied, old secret rejected, new secret succeeds — covered by the `access_epoch_mismatch` tests in both the `ensureCurrentGrant` and `verifyShareProjectionAuthorization` suites, and the PIN route's own rotation-guard test (`SECURITY: generic unavailable when the prior grant's accessEpoch no longer matches...`).
- **Q (revoke)**: terminal denial — unaffected by this change (revoke uses `state`, not either epoch); existing coverage in `isShareLinkCurrentlyPubliclyActive`/`resolveShareLinkByPublicId` suites, unchanged and still passing.
- **No enumeration oracle**: dedicated test in `pin/route.test.ts` proves unknown-link, non-active-link, no-PIN-link, no-prior-grant, and rotated-epoch all produce byte-identical generic 404 responses.

**Existing-data safety**: the migration's own static test suite includes explicit assertions that no backfilling `UPDATE` statement exists (the constant `DEFAULT` clause is the entire backfill), that no new table is created, that `project_updates`/`share_messages`/`share_message_conversions` are untouched, and that no already-applied migration file was modified (cross-checked directly against the historical source files).

---

## 9. Test results

```
TSC_RESULT:                CLEAN — npx tsc --noEmit, zero errors project-wide

TARGETED_UNIT_TESTS:
  lib/share/share-session-grant.server.test.ts        74 passed / 74
  app/api/share/session/route.test.ts                 29 passed / 29
  app/api/share/[publicId]/pin/route.test.ts           26 passed / 26
  supabase/migrations/202608250001_client_share_access_epoch.test.ts   45 passed / 45

FULL_CLIENT_SHARE_REGRESSION_SUITE:
  npx vitest run app/api/share lib/share supabase/migrations
  2904 passed / 2904 (65 files)
  (one file, lib/share/share-streamed-delivery.spike.test.ts, initially
  timed out under concurrent load from a second, simultaneously-running
  full-repo test invocation; re-run in isolation immediately after,
  passed cleanly, 3/3 — confirmed a load-induced flake in a pre-existing,
  untouched "spike" test file, not a regression from this change)

BUILD_RESULT:               CLEAN — npm run build (Next.js 16.1.6/Turbopack)
                             Compiled successfully; TypeScript check passed;
                             90/90 static pages generated; new route
                             /api/share/[publicId]/pin present in the route
                             manifest alongside all existing Client Share
                             routes.

RUNTIME_RESULTS (disposable Supabase):
  RUNTIME VERIFICATION ACCEPTED (2026-08-26). A disposable Supabase
  runtime-verification package (`docs/client-share-phase8-access-epoch-
  runtime/`) was built, executed across a sequence of runs (each fixing a
  harness-only defect the previous run's own evidence identified), and
  reached a final SCRIPTED result of 138/139 PASS. The one remaining
  failure (H9, an authenticated-privilege-surface assertion) was
  mechanically classified as a harness expectation bug — not a defect in
  the migration, trigger, or RPC — and independently confirmed correct at
  the database level by a direct, read-only PostgreSQL catalog query
  against the same disposable project. Zero implementation or migration
  defects were found. See §10 (updated) and
  `docs/client-share-phase8-access-epoch-runtime/04_CAPTURE_RESULTS.md`
  for the full disposition, evidence, and an explicit note that this
  acceptance is NOT based on an unclaimed clean re-run.
```

---

## 10. Disposable Supabase runtime verification (2026-08-26 — ACCEPTED)

**Update 2026-08-26: this gap is now closed.** A disposable Supabase runtime-verification package was built at `docs/client-share-phase8-access-epoch-runtime/`, matching the established Phase 6-era convention this section originally flagged as missing. It was executed against a real, disposable, non-Production Postgres/Supabase instance across a sequence of runs; each run's own evidence (a specific FAIL row's `detail`, or a raw PostgreSQL error) was mechanically diagnosed against the actual repository source (trigger bodies, RPC bodies, real CHECK constraints) before the harness was corrected — the corrective migration itself was never modified in response to any of these findings, because every one was proven to be a defect in the test harness, not in the migration.

The final SCRIPTED run reported `total_tests=139, passed_tests=138, failed_tests=1, status=PHASE_8_ACCESS_EPOCH_RUNTIME_FAIL`. The sole failure (`H9`, a Section H privilege-surface assertion) was classified `HARNESS_EXPECTATION_BUG`: the assertion compared the authenticated role's COMPLETE effective privilege grant against an INCOMPLETE expected set (only the mutation privileges `01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql` adds, omitting the `SELECT` privilege `01_PREPARE_RUNTIME_FIXTURES.sql` separately and intentionally already grants), so it flagged the already-intended `SELECT` grant as unexpected "broader" access. This was independently confirmed — not merely inferred — by a direct, read-only PostgreSQL catalog query against the same disposable project, which returned exactly the intended surface (`projects`/`tasks`: `SELECT,INSERT,UPDATE,DELETE`; `task_resources`: `SELECT,INSERT,UPDATE`; `clients`: `SELECT` only; no `anon` grant anywhere). `H9`'s own assertion has been corrected to require this complete union, with static regression coverage added so it cannot silently narrow back to the mutation-only shape.

This runtime effort proved, against a real PostgreSQL engine, every claim §10 originally listed as unproven: `SHARE_GRANT_ACCESS_EPOCH_STALE`/`SHARE_GRANT_PIN_EPOCH_STALE` fire correctly on real stale grant attempts; the new epoch columns' constraints reject non-positive values; the metadata-only `ADD COLUMN ... DEFAULT` backfill is safe against real pre-existing rows (Section A, using genuinely pre-migration-seeded fixtures); the trigger's checks fire in the documented order against real rows. It additionally proved, against the real database, that the exact original Production defect — same-browser Disable → Re-enable stranding — is genuinely fixed (Runtime Requirement B), not merely fixed in the unit-test mocks. Full evidence, the direct catalog-query text and result, and the complete list of security-critical behaviors independently confirmed PASS are in `docs/client-share-phase8-access-epoch-runtime/04_CAPTURE_RESULTS.md`.

No Production project was touched at any point during this runtime verification effort.

---

## 11. Security review

- **Rotation invalidates old grants**: unchanged, strengthened — `access_epoch` is now the sole, unrecoverable-without-a-fresh-exchange invalidation mechanism for rotation, bumped exactly once per rotation, in the same UPDATE as the existing `configuration_version` bump.
- **Old rotated secret cannot bootstrap new access**: unchanged — `rotate_share_link_secret` never touches `secret_digest`'s validation path for old callers; a stale digest still fails the existing comparison in `POST /api/share/session`.
- **Revoked link is terminal**: unaffected by this change — revocation uses `project_share_links.state`, never either epoch.
- **Disabled link denied while disabled, expired link denied while expired**: both are live, read-time checks (`isShareLinkCurrentlyPubliclyActive`) independent of either epoch — unaffected, still enforced on every read.
- **PIN credential changes cannot silently retain authorization that should have been challenged**: `pin_epoch` forces exactly this revalidation on every PIN set/change, closing a gap that existed before this change (an already-verified grant's `pin_verified_at` alone could not detect a changed PIN value).
- **No PIN-only bypass of rotation**: the two-field split (§3) plus the PIN-recovery route's explicit `grantedAccessEpoch !== link.accessEpoch` guard (`app/api/share/[publicId]/pin/route.ts:228-230`) closes this by construction — verified by a dedicated test.
- **No direct anonymous project/task/resource DB reads**: unaffected — this change touches only `project_share_links`/`share_session_grants` schema and the authorization predicate; no RLS policy, no table grant, was changed.
- **No relaxation of RLS or grants**: verified by the migration's own static test — every GRANT/REVOKE statement re-declares the existing posture; no `CREATE POLICY`/`ALTER POLICY`/`DROP POLICY`/row-level-security toggle appears anywhere in the migration.
- **No plaintext share secret is stored or exposed**: unaffected — no new column or parameter in this change is capable of carrying a plaintext secret or plaintext PIN (verified structurally in the migration's static test); the new PIN-recovery route accepts a PIN over HTTPS exactly like the existing session-exchange route's PIN branch, hashes/compares it the same way, and never persists or logs it.
- **No enumeration oracle**: verified by a dedicated test — every failure branch of the new PIN-recovery route (unknown link, inactive link, no-PIN link, no prior grant, rotated epoch, wrong PIN handled separately with its own distinct-but-still-generic `PIN_INCORRECT` code matching the existing session-exchange route's own precedent) returns the identical generic denial shape.
- **Phase 6 conversion security untouched**: this change does not redefine, reference, or depend on `apply_project_update_transaction`, `finalize_share_message_conversion`, `set_share_message_status`, or the apply-boundary trigger — confirmed by the migration's own static test asserting `project_updates`/`share_messages`/`share_message_conversions` are never mentioned.

---

## 12. Production rollout steps for this corrective migration

**Not authorized to execute by this document.** Sequenced for when the user chooses to proceed, and intended to slot into the existing Phase 8 rollout plan as an additional chain step (see the ROLLOUT STATUS UPDATE banner and §25 amendment in `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_8_AUDIT_AND_ROLLOUT_PLAN_2026-08-24.md`):

1. Treat `202608250001_client_share_access_epoch.sql` as chain position 18, applied strictly after position 17 (`202608230002_client_share_apply_conversion_closure.sql`) — it depends on `share_session_grants`/`project_share_links` (positions 2, 4) and reproduces functions defined at positions 3 (`202608030005`) and 9 (`202608060002`), all strictly earlier.
2. Because Production currently holds zero Client Share rows (per Phase 8's own §8/§9 audit, not yet independently re-confirmed at the time of this migration), the backfill-safety argument in §4 above applies with no caveats; if that has changed by the time this is applied, re-verify the same "every existing grant's snapshot trivially matches its link's current value" argument against the then-current row counts before proceeding.
3. Apply the migration; confirm success before any subsequent step.
4. **Done (see §10):** the disposable Supabase runtime-verification package proving the new trigger checks, constraints, and the corrected epoch semantics has been built and executed, reaching 138/139 PASS with the one remaining row independently confirmed correct via a direct read-only catalog query — RUNTIME VERIFICATION ACCEPTED. (The PIN-recovery route's own live HTTP behavior is not itself exercised by this SQL-level package — that remains covered by its own dedicated unit tests, §8 — the runtime package proves the underlying database contract those unit tests mock.)
5. Deploy the paired application-layer changes (`lib/share/share-session-grant.server.ts`, `app/api/share/session/route.ts`, `app/api/share/[publicId]/pin/route.ts`) — with the feature flag still off, per the existing Phase 8 rollout order.
6. Re-run the exact Phase 8 Production smoke-test regression that discovered this defect: active link → existing browser authorized → Disable → same browser denied → Re-enable → same browser, same URL, refresh → loads again. This specific scenario passing is the acceptance criterion for un-pausing the rollout.
7. Re-run the remainder of the Phase 8 §22 smoke-test checklist (rotate, PIN set/change/clear, expiry set/clear/lengthen, settings changes) to confirm the broader defect family is also closed in the live environment, not just the ones explicitly re-tested in step 6.
8. Only once steps 6–7 pass does the existing Phase 8 rollout order (§20 of that document) resume from wherever it was paused.

---

## 13. Summary

```
IMPLEMENTATION_STATUS: COMPLETE (local only — not staged, committed, pushed, or deployed)

FILES_CHANGED:
  supabase/migrations/202608250001_client_share_access_epoch.sql          (new)
  supabase/migrations/202608250001_client_share_access_epoch.test.ts      (new)
  app/api/share/[publicId]/pin/route.ts                                   (new)
  app/api/share/[publicId]/pin/route.test.ts                              (new)
  lib/share/share-session-grant.server.ts                                 (modified)
  lib/share/share-session-grant.server.test.ts                            (rewritten)
  app/api/share/session/route.ts                                         (modified — ensureCurrentGrant call site)
  app/api/share/session/route.test.ts                                    (extended)
  docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_8_AUDIT_AND_ROLLOUT_PLAN_2026-08-24.md   (amended — PAUSED status)
  docs/TEXT2TASK_CLIENT_SHARE_LINK_ACCESS_EPOCH_IMPLEMENTATION_REPORT_2026-08-25.md  (new — this document)

MIGRATION_NAME: 202608250001_client_share_access_epoch.sql

SCHEMA_CHANGES:
  project_share_links.access_epoch    integer not null default 1, check (> 0)
  project_share_links.pin_epoch       integer not null default 1, check (> 0)
  share_session_grants.granted_access_epoch   integer not null default 1, check (> 0)
  share_session_grants.granted_pin_epoch      integer not null default 1, check (> 0)

BACKFILL_STRATEGY: constant DEFAULT 1 on both tables, metadata-only (no
  table rewrite, no explicit UPDATE) — every pre-existing row's snapshot
  trivially matches its link's current value immediately after the
  migration applies; safe for zero or non-zero existing rows.

ACCESS_EPOCH_SEMANTICS: access_epoch bumped only by rotate_share_link_secret;
  never recoverable without a fresh secret-based exchange. pin_epoch bumped
  only by set_share_link_pin; recoverable via PIN-only re-verification,
  gated on access_epoch still matching. configuration_version unchanged,
  no longer read as an authorization predicate.

PIN_RECOVERY_SEMANTICS: POST /api/share/[publicId]/pin — requires proof of
  a prior genuine grant for this (session, link) pair, requires
  grantedAccessEpoch === link's live access_epoch (rotation guard), then
  verifies the PIN and refreshes the grant via the existing ensureCurrentGrant.

EXPIRY_SEMANTICS: grant expires_at derived purely from browser-session
  expiry going forward (link expiry no longer baked in); link expiry is
  enforced live on every read (unchanged mechanism); grant.expires_at is
  no longer read at authorization time at all, retroactively fixing
  already-existing grants without any backfill.

FUNCTIONS_CHANGED: enforce_share_session_grant_integrity(),
  rotate_share_link_secret(...), set_share_link_pin(...) — each CREATE OR
  REPLACE, reproduced in full from its live definition with only the
  documented addition/removal.

TESTS_ADDED: 174 new/updated tests across 4 files (see §8).

TEST_RESULTS: 2904 / 2904 passing across the full Client Share suite
  (app/api/share, lib/share, supabase/migrations); one unrelated,
  untouched "spike" test file flaked under concurrent load and passed
  cleanly in isolation immediately after (see §9).

RUNTIME_RESULTS: RUNTIME VERIFICATION ACCEPTED (2026-08-26) — final
  scripted run: 138/139 PASS; sole failure (H9) independently confirmed
  a harness expectation bug via a direct read-only catalog query, not a
  real defect; zero implementation/migration defects found (see §10).

TSC_RESULT: CLEAN — npx tsc --noEmit, zero errors project-wide.

BUILD_RESULT: CLEAN — npm run build, Next.js 16.1.6/Turbopack, 90/90
  static pages, new /api/share/[publicId]/pin route present in the
  manifest.

SECURITY_REVIEW: See §11 — every previously-required security invariant
  re-verified intact; one new invariant added (PIN-only recovery cannot
  bypass rotation, verified by a dedicated test).

PRODUCTION_ROLLOUT_STEPS: See §12. Not executed. Disposable-runtime
  verification (step 4) is now DONE — RUNTIME VERIFICATION ACCEPTED.
  Remaining: adding this migration as chain position 18 in the existing
  Phase 8 plan, applying it, deploying the paired application-layer
  changes, and a Production re-run of the exact Disable→Re-enable
  regression scenario as the acceptance criterion for un-pausing rollout.

GIT_STATUS: All changes are local, unstaged/untracked working-tree
  modifications. Nothing committed, staged, pushed, or deployed. Feature
  flag untouched.
```

**STOP.** No further action was taken beyond what is reported above. The next action is the user's own decision.
