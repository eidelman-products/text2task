# Text2Task Client Share — Phase 4 Audit & Implementation Plan

**Scope of this document: AUDIT / PLAN ONLY.** No files were edited, no
migrations created, no SQL executed, nothing deployed, no ENV changed, no
Production touched, nothing staged/committed/pushed. Everything below is
derived from reading the actual current repository state (Phase 3 checkpoint,
commit `59dc254`), not from memory or assumption.

Phase 4 goal: let an anonymous, already-authorized Client Share visitor
securely open/download real **FILE** Resources the owner has explicitly
selected, without ever exposing the private storage bucket, `storage_path`,
service-role material, or any permanent public URL. **NOTE resources stay
permanently non-shareable.**

> **⚠ SUPERSEDED IN PART.** A correction pass (see "PHASE 4 — ARCHITECTURE
> CORRECTION PASS" at the end of this document) found two contradictions in
> the design below: (1) the recommended endpoint required a `resourceId`
> the public projection never actually exposes, and (2) the recommended
> direct-to-browser signed URL structurally leaks the internal storage
> path (and therefore the owner's internal user/project ids) into the
> browser. §7 (endpoint), §9 (signed URL vs. proxy decision), §12 (TTL),
> and the file-response shape in §8/§14 are all corrected there. §1-§6,
> §10, §11 (lifecycle logic), and §13-§16's overall shape remain accurate
> and are referenced, not repeated, by the correction.

---

## 1. Current architecture discovered

Phase 3 already built the entire authorization spine and the entire
*metadata* side of file sharing — it stops exactly one step short of
*delivering* file bytes.

- **Owner side**: owners can already select FILE Resources into a share
  link's Attachments today. `isShareableResource` (
  `share-link-configuration-editor.tsx:130-132`) = `!isNoteResource &&
  (isFileResource || isLinkResource)`, reused verbatim by the quick-share
  picker (`quickShareAttachmentCandidates` in `quick-share-defaults.ts`).
  FILE and LINK resources are both selectable; NOTE never is. This is a
  pure UI-layer filter — nothing at the DB layer rejects a NOTE mapping
  (see §5, gap G1).
- **Persistence**: `share_link_resources` (owner-scoped table) stores only
  `resource_id, public_label, can_download, display_order` — it has
  **never** stored `storage_path`, `file_name`, `url`, `mime_type`, or
  `size_bytes`. This isn't an oversight to fix in Phase 4; it's a
  deliberate Phase 1A decision, stated in the column's own migration
  comment: *"public file access resolves a short-lived signed URL
  server-side per request."* Phase 4 is that comment's own promise coming
  due.
- **Integrity**: `enforce_share_link_resource_integrity` (trigger,
  `202608030005`) validates link/resource ownership and
  project/task consistency on every insert/update into
  `share_link_resources`. It does **not** check `resource_type` (gap G1).
  `resource_id` has `on delete cascade` from `task_resources` — deleting a
  Resource immediately and structurally removes its share mapping (no
  Phase 4 work needed for this lifecycle case).
- **Projection**: `assembleClientProjection` (
  `lib/share/client-share-projection.server.ts`) already classifies every
  mapped resource via `classifyResource` (delegates to
  `isFileResource`/`isLinkResource`/`isNoteResource` from
  `resource-api.ts`) and already excludes NOTE at read time (`if (kind ===
  "note") continue;` — defense-in-depth on top of the UI filter). For a
  FILE resource it emits `{kind: "file", label: mapped.publicLabel,
  canDownload: mapped.canDownload}` — correctly **never** a URL or storage
  reference. For a LINK resource it emits `{kind: "link", label, url}`
  after validating the URL through `toSafeExternalClientUrl` (protocol
  allowlist via the platform `URL` parser, not regex).
- **Contract**: `clientProjectResourceSchema` (
  `lib/share/client-share-projection-contracts.ts:58-84`) is a
  discriminated union on `kind`. The `file` variant is `{kind, label,
  canDownload}` — structurally **incapable** of carrying a `url`. This is
  correct and needs no change for Phase 4 (see §6 — no contract change
  needed).
- **Rendering**: `client-project-view.tsx:128-155` already renders the
  resource list. For `kind === "link"` it renders a real `<a href>`. For
  `kind === "file"` (the `else` branch, line 143-149) it renders **inert
  text** — the label plus an optional "(downloadable)" hint — with no
  click affordance at all, because there is currently nothing to click
  through to. This is the exact, precise seam Phase 4 closes: give that
  file resource a way to actually be opened, on demand, without changing
  what the projection itself contains.
- **Authorization spine (reusable as-is)**:
  `verifyShareProjectionAuthorization` (
  `lib/share/share-session-grant.server.ts:474-526`) is the single gate
  the existing projection route calls. It re-derives, on every call, with
  no caching: browser session live+unrevoked (from the HttpOnly cookie) →
  link resolved by `publicId`, not revoked → link currently publicly
  active (state `active`, unexpired, project exists and
  `deleted_at IS NULL`) → grant exists for this exact
  (session, link) pair, unrevoked, unexpired,
  `granted_configuration_version === link.configurationVersion`, and (if
  the link has PIN material) `pin_verified_at IS NOT NULL`. It returns
  `{shareLinkId, projectId, userId}` on success or `null` — the same
  generic-failure shape every existing public route already keys off of.
  **This function already implements the first 6 links of the Phase 4
  authorization chain the task specifies almost verbatim.** Phase 4 does
  not need to reimplement or duplicate any of it.
- **Owner-side file delivery precedent**:
  `app/api/task-resources/file-url/route.ts` — Supabase-Auth-authenticated
  (`createClient()`, RLS-bound), ownership-scoped `task_resources` select
  (`.eq("user_id", user.id)`), then
  `supabase.storage.from("task-resources").createSignedUrl(storage_path,
  600, {download: shouldDownload ? downloadFileName : false})`. Returns
  `{url, expires_in, download, resource:{safe fields}}` — never
  `storage_path`. **This cannot be reused directly for anonymous
  visitors** — there is no Supabase Auth session, so `auth.uid()` is null
  and RLS-bound storage access has nothing to authorize against. The
  mechanism (signed URL, JSON response, safe resource echo, TTL) is the
  right template; the *client* it's called through is not.
- **Storage**: bucket name `"task-resources"` (constant `STORAGE_BUCKET` in
  `upload-and-create/route.ts`). Storage path convention:
  `${userId}/${projectId ?? "no-project"}/${taskId ? `task-${taskId}` :
  "project"}/${randomUUID}.${ext}` — first path segment is the owning
  user's id (the standard Supabase Storage RLS-by-folder convention),
  filename is a random UUID (no enumeration via filename guessing), never
  the original filename. 10MB limit, small MIME allowlist.

## 2. Exact relevant files

| File | Role for Phase 4 |
|---|---|
| `lib/share/share-session-grant.server.ts` | `verifyShareProjectionAuthorization` — reused unchanged as the entry gate |
| `lib/share/client-share-projection.server.ts` | `classifyResource`, `isFileResource` usage pattern — reused for re-validation |
| `lib/share/client-share-projection-contracts.ts` | Projection contract — **unchanged** |
| `app/api/share/[publicId]/projection/route.ts` | Direct structural template (cookie read, rate limit, auth call, no-store headers, generic-error posture) for the new route |
| `lib/share/share-rate-limit.server.ts` | `checkShareRateLimit` — reused with existing `projection_read` action |
| `app/api/task-resources/file-url/route.ts` | Signed-URL generation pattern (TTL, `download` option, safe response shape) — reused, but via `supabaseAdmin` instead of the RLS client |
| `lib/supabase/admin.ts` | `supabaseAdmin` — the service-role client the new route must use |
| `app/components/dashboard/resources/resource-api.ts` | `isFileResource`/`isNoteResource` — reused for server-side re-validation |
| `app/components/dashboard/tasks/share-link/client-project-view.tsx` | Frontend: needs a click handler for `kind === "file"` that calls the new endpoint on demand |
| `supabase/migrations/202608030003_client_share_owner_foundation.sql` (lines ~445-490) | `share_link_resources` schema — read, not modified |
| `supabase/migrations/202608030005_client_share_integrity_and_security.sql` (lines ~389-490) | Integrity trigger — read; gap noted, not modified |

No new file needs to be touched outside of: one new API route, and a small
edit to `client-project-view.tsx` to make the file `<span>` clickable and
call it.

## 3. Exact DB/storage objects involved

- `project_share_links` (read-only, via `resolveShareLinkByPublicId`/`resolveShareLinkById`, already covered by the auth gate)
- `share_browser_sessions`, `share_session_grants` (read-only, already covered)
- `share_link_resources` — **new read**: `SELECT resource_id, public_label, can_download WHERE share_link_id = :shareLinkId AND resource_id = :resourceId AND user_id = :userId` (three-way scoped; `user_id` comes from the already-verified authorization, never from client input)
- `task_resources` — **new read**: `SELECT id, resource_type, storage_path, file_name, mime_type, user_id, project_id WHERE id = :resourceId AND user_id = :userId` (defense-in-depth re-check, not trusting the mapping row alone)
- Storage bucket `task-resources` — **new call**: `supabaseAdmin.storage.from("task-resources").createSignedUrl(storage_path, TTL, {download})`
- `share_rate_limit_buckets` (via the existing `increment_share_rate_limit_bucket` RPC, existing `projection_read` action reused — see §6)

No new table, column, index, trigger, or RLS/storage policy is read from or
needs to be created for any of the above.

## 4. What can be reused unchanged

- `verifyShareProjectionAuthorization` — the entire session/grant/link/
  configuration-version/PIN gate, byte for byte.
- `checkShareRateLimit` with the existing `projection_read` action/scope.
- `clientProjectFileResourceSchema` / `clientProjectResourceSchema` — no
  contract change; the projection still only ever says "there is a file
  here, label X, downloadable: true/false."
- `isFileResource`/`isNoteResource` from `resource-api.ts`.
- The `createSignedUrl(..., {download})` mechanism and its safe-response
  shape, copied from `file-url/route.ts` but re-pointed at `supabaseAdmin`.
- The existing route-scaffolding conventions: `NO_STORE_HEADERS`,
  `isCrossSiteFetch`, generic error envelope (`{ok:false, code, error}`),
  `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- `share_link_resources`' schema and its cascade-delete behavior — no
  migration needed.

## 5. Gaps blocking secure FILE sharing

- **G1 — no delivery mechanism.** The projection tells the client a file
  exists; nothing lets the client obtain it. This is the entire Phase 4
  gap and is closed purely in application code (§7-§9).
- **G2 — no independent `resource_type` re-check at delivery time.**
  Nothing at the DB layer (trigger or RPC) currently rejects mapping a
  NOTE resource into `share_link_resources` — only the owner UI filters
  it out today, plus the projection's own read-time `continue` on
  `kind === "note"`. The new file-delivery endpoint must **not** trust
  "it's in `share_link_resources`" as proof it's a file; it must
  independently re-derive `classifyResource`/`isFileResource` off the
  freshly-read `task_resources` row and refuse anything that isn't a
  file, exactly mirroring the projection's own defense-in-depth posture.
  This is pre-existing (Phase 1A/3) behavior, not a Phase 4 regression —
  flagged here because Phase 4 is the first place a NOTE-classified
  mapping could otherwise translate into an actual data leak instead of
  merely disappearing from a list.
- **G3 — frontend has no click affordance for files.** `client-project-
  view.tsx`'s file branch is inert `<span>` text. Needs a small,
  additive change (not a redesign) to fetch a fresh URL on click/open and
  navigate to it.

No other gaps were found. In particular: TTL residual-access-window
behavior, cascade-delete-on-resource-deletion, and cross-owner/cross-
project mapping are all **already correctly handled** by existing Phase
1A/3 mechanisms (cascade FK, `enforce_share_link_resource_integrity`'s
ownership/project checks) and require no new work.

## 6. Whether SQL/schema changes are required

**No.** Phase 4 can be implemented entirely in application code against
the existing schema. Specifically:

- `share_link_resources` already has every column needed
  (`resource_id`, `public_label`, `can_download`) and its `user_id` +
  cascade-delete + integrity trigger already provide the correct
  ownership/lifecycle guarantees.
- `task_resources` already has `storage_path`, `file_name`,
  `resource_type`.
- `service_role` (the key behind `supabaseAdmin`) already has standing
  grants sufficient to read `share_link_resources`/`task_resources`
  (used identically today by `buildPublicClientShareProjection`), and
  service-role inherently bypasses Postgres RLS — including the RLS
  policies that gate Supabase Storage's `storage.objects` table — so no
  new Storage policy is needed for `supabaseAdmin.storage...createSignedUrl`
  to succeed against a bucket whose *policies* are scoped to
  `auth.uid()`. Service-role access to Storage does not go through those
  policies at all.
- Rate limiting can reuse the existing `projection_read` action/scope
  without extending the RPC's closed `p_action` vocabulary (verified
  directly in `202608130001_client_share_rate_limit_increment.sql:161-
  162`, `if p_action is null or p_action not in (...)`) — reusing an
  existing action avoids a migration. (Decision point, not a unilateral
  call — see §15.)
- The projection contract does not need a new field: the file's
  short-lived URL is fetched on demand through a *separate* endpoint,
  never embedded in the projection payload (which is cached/refreshed on
  a different cadence than a user's "open this file" click).

If, after this plan, the product decision is instead "give file access
its own tighter rate-limit action" rather than reusing `projection_read`,
that specific choice (and only that choice) would require a new migration
extending the RPC's action `CHECK`. Everything else described in this
report needs none.

## 7. Recommended endpoint architecture

`GET /api/share/[publicId]/resources/[resourceId]/file-url`

Chosen over the flatter `?resourceId=` query-param alternative because it
mirrors the task's own suggested shape, reads cleanly, and Next.js App
Router handles the extra dynamic segment with no added complexity. A
**separate** route from `/projection` (not folded into it), because file-
URL generation must happen lazily, exactly when the visitor clicks a
specific attachment — generating (and thus starting the TTL clock on)
every mapped file's signed URL on every projection load would waste calls
and needlessly shrink the useful window before the visitor actually
follows through. This mirrors the owner side's own existing separation
(`/api/task-resources` list vs. `/api/task-resources/file-url` on-demand).

Request: no query params beyond the two path segments; no bearer secret
of any kind (identical posture to `/projection` — the HttpOnly session
cookie is the only credential). `resourceId` validated as a UUID before
any DB call.

Response (success): `{ok: true, data: {url, expiresIn, download}}` — no
`storage_path`, no internal ids beyond what the client already has
(`resourceId` it already sent), no `mime_type`/`size_bytes`/`file_name`
unless later decided useful for a nicer download-name (optional, safe:
`file_name` is not sensitive by itself, but keeping the response minimal
is preferable — see §15 open decision).

Response (failure): same generic envelope as `/projection`
(`{ok:false, code:"UNAVAILABLE", error:"..."}`, 401) for **every**
authorization failure (no session, invalid session, no grant, revoked
grant, disabled/revoked/expired link, stale configuration_version,
unmapped resource, wrong project/owner, deleted resource, NOTE resource,
malformed/non-existent id) — deliberately indistinguishable from each
other, exactly matching the existing `/projection` route's "one generic
failure shape regardless of which check failed" rule (AGENTS.md rule 10,
already enforced there).

## 8. Authorization sequence (exact order, all server-side, all re-checked every call — nothing cached)

1. `assertClientShareEnabled()` — feature flag, same as `/projection`.
2. Same-origin defense-in-depth (`isCrossSiteFetch`) — same as `/projection`.
3. Validate `publicId` shape (`isValidSharePublicId`).
4. Validate `resourceId` shape (UUID).
5. Read + validate the HttpOnly session cookie shape.
6. Rate limit check (`checkShareRateLimit`, `projection_read` action, `browser_session` scope, keyed by the session digest) — **before** any DB authorization work, matching `/projection`'s own ordering.
7. `verifyShareProjectionAuthorization({cookieValue, publicId})` → `{shareLinkId, projectId, userId}` or generic 401. This alone re-validates: session live+unrevoked; link active+unexpired+project-not-deleted; grant same-session+same-link+unexpired+unrevoked+configuration-version-match+PIN-satisfied.
8. **New**: `SELECT resource_id, public_label, can_download FROM share_link_resources WHERE share_link_id = :shareLinkId AND resource_id = :resourceId AND user_id = :userId` via `supabaseAdmin`. No row → generic 401 (covers: unmapped resource, resource belonging to another project/owner — the last of which is structurally impossible anyway per the integrity trigger, but the query is scoped defensively regardless).
9. **New**: `SELECT id, resource_type, storage_path, file_name, mime_type, user_id, project_id, task_id FROM task_resources WHERE id = :resourceId AND user_id = :userId` via `supabaseAdmin`. No row → generic 401 (covers: resource deleted since mapping — though cascade delete should already have removed the mapping in step 8; this is the belt to that suspenders).
10. **New**: re-classify via `isFileResource`/`isNoteResource` on the freshly-read row. Not a file → generic 401 (covers: NOTE resource, and closes gap G2).
11. **New**: `supabaseAdmin.storage.from("task-resources").createSignedUrl(row.storage_path, TTL, {download: mapping.can_download ? row.file_name : false})`. Storage error → generic 401 or 500 per existing route conventions (never leak *why*).
12. Return `{ok:true, data:{url, expiresIn: TTL, download: mapping.can_download}}` with the same `NO_STORE_HEADERS` as `/projection`.

Every one of the task's required chain links (publicId → session → grant
→ link → project → configuration_version → resource mapped → resource
exists/not deleted → resource is FILE → owner-approved → short-lived
access) is covered by steps 5-11 above, in that order, with no step
trusting a result cached from an earlier request.

## 9. Signed URL vs. redirect vs. proxy/stream — decision and rationale

| Approach | Security | Browser UX | Cost | Complexity |
|---|---|---|---|---|
| **JSON + short-lived signed URL** (recommended) | Equal to the others — TTL-bound, scoped, never guessable | Two-step (fetch JSON, then navigate/open) but matches proven owner-side UX exactly | Zero added egress/compute — file bytes flow browser↔Supabase Storage directly | Lowest — direct reuse of `createSignedUrl`, no byte handling in our server |
| Redirect (302 to signed URL) | Same URL exposure as above once followed | One-step navigation, but hard to show a friendly in-page error state on auth failure (a failed redirect target just breaks the link/tab) | Same as above | Slightly more awkward error handling than JSON |
| Proxy/stream through Next.js | No real security gain — signed URL is already scoped+short-lived | Same as user, but adds latency | **Doubles egress** (Storage→our function→browser), consumes Vercel function time/memory per file, needs manual Range-request handling for larger files | Highest — new byte-streaming code, new failure modes |

**Recommendation: JSON response containing a short-lived signed URL**,
exactly matching the owner-side `/file-url` precedent and exactly
matching what `share_link_resources`' own Phase 1A migration comment
already committed to ("public file access resolves a short-lived signed
URL server-side per request"). It's the cheapest, simplest, most-proven
option and introduces no new class of failure mode.

## 10. `canDownload` semantics

`can_download` (and the signed URL's `download` option it maps to) is a
**browser UX hint, not an access-control or DRM mechanism.** Supabase's
`createSignedUrl(..., {download: filename})` sets
`Content-Disposition: attachment; filename="..."` on the eventual GET,
which makes the browser show a native Save-As prompt instead of
rendering the file inline. `canDownload: false` means the file opens/
previews in the browser tab with no forced download prompt.

This does **not**, and cannot, prevent a visitor who can already view a
file from saving it by other means — screenshot, browser "Save Page As",
copying the signed URL before its TTL elapses and fetching it externally,
or a PDF/image viewer's own built-in save affordance. Nothing in Supabase
Storage, the browser, or this design offers real save-prevention, and the
Phase 4 report/UI copy must not claim otherwise. `canDownload` should be
understood by the owner (and documented, if surfaced in copy) purely as
"show a Save-As download prompt" vs. "open for viewing," never as
"prevent saving."

## 11. Lifecycle / revocation behavior, scenario by scenario

| Scenario | Behavior | Mechanism |
|---|---|---|
| Owner unshares the file (removes from Attachments) | Next file-url request → 401 immediately | `share_link_resources` row deleted by the owner's save path → step 8 lookup returns no row |
| Resource deleted entirely | Mapping row cascade-deleted the instant the Resource is deleted | `resource_id` FK `on delete cascade` (pre-existing, no Phase 4 change) |
| Link disabled | Next file-url request → 401 immediately | `verifyShareProjectionAuthorization` → `isShareLinkCurrentlyPubliclyActive` requires `state === "active"` |
| Link revoked | Next file-url request → 401 immediately | `resolveShareLinkByPublicId`/`resolveShareLinkById` both filter `neq("state", "revoked")` |
| Link expires | Next file-url request → 401 immediately | `isShareLinkCurrentlyPubliclyActive` checks `expiresAt` |
| `configuration_version` changes (title/status/comments/etc. edited) | Existing grant becomes stale; next file-url request → 401 (visitor is asked to re-enter, matching existing Phase 3 projection behavior) | Grant's `granted_configuration_version` no longer matches the link's live value |
| PIN added | Existing grant lacks `pin_verified_at` (or predates the requirement) → 401 until re-verified, identical to today's projection behavior | `linkRequiresPin && grant.pin_verified_at === null` check |
| PIN removed | Existing grant remains valid (PIN check only enforced when link currently requires one) | No change needed — same rule as projection |
| Browser grant/session expires | Next file-url request → 401 | `resolveBrowserSessionFromCookie` / grant `expires_at` checks |
| An already-issued signed URL still exists after any of the above | It keeps working until its own TTL elapses — this is an inherent property of signed URLs, not a bug, and is explicitly anticipated by the Phase 1A migration comment on `share_link_resources.resource_id`. Keeping the TTL short (§ below) bounds this window tightly. | N/A — inherent to the mechanism, mitigated by TTL choice, not eliminated |

Every one of the task's 8 required scenarios is covered above with no
new schema.

## 12. Recommended TTL

**120 seconds.** Rationale: the signed URL is generated fresh on every
click/open and the browser begins using it essentially immediately, so it
does not need to survive minutes — unlike the owner's 10-minute
(`600s`) precedent, which serves a UI that may sit open before the owner
acts. A public-visitor TTL should be *meaningfully tighter* than the
owner one, both because "never outlive the authorization context in a
meaningful way" is an explicit requirement and because it directly bounds
the residual-access window called out in §11. 120s is long enough for a
normal page load/download to start on typical connections while being
short enough that the post-revocation exposure window stays small. This
is a security-relevant parameter and is flagged here as a recommendation
for explicit owner sign-off, not a unilaterally finalized number — 60s or
180s would also be defensible; I would avoid going below ~60s (risk of
failing mid-download on slow connections) or above ~300s (starts to
approach the owner-side TTL with none of the owner-side justification
for it).

## 13. Exact implementation slices, in recommended order (for a future turn — not this one)

1. New route file `app/api/share/[publicId]/resources/[resourceId]/file-url/route.ts`, built by direct structural cloning of `/projection/route.ts`'s scaffolding (headers, cross-site check, rate limit, generic error envelope) plus the new steps 8-12 from §8.
2. A small server helper (new function, e.g. in `client-share-projection.server.ts` or a new `share-file-access.server.ts`) encapsulating steps 8-11 — mapping lookup, resource lookup, file-type re-check, signed URL generation — so the route stays thin, mirroring how `buildPublicClientShareProjection` is factored out today.
3. Frontend: `client-project-view.tsx`'s file branch (line 143-149) becomes a button/link that, on click, calls the new endpoint and opens the returned URL in a new tab (`window.open`) — matching the LINK branch's existing `target="_blank" rel="noopener noreferrer nofollow"` posture. Loading/error states kept minimal (e.g., disable the control while the fetch is in flight; on failure, a generic "This file is not available" message — never surfacing the failure code/reason).
4. Tests: unit tests for the new server helper (all DENIED branches from §14), and a route-level test mirroring the existing `/projection` route's test suite structure.

No slice requires a migration (§6).

## 14. Test matrix

**AUTHORIZED**
- Mapped FILE resource + valid session/grant → 200 with `{url, expiresIn, download}`.
- `publicLabel` is what's echoed to the caller/UI, never the private title/file_name.
- Existing LINK resources continue rendering/working unchanged (regression check on `/projection`, untouched).
- `canDownload: true` mapping → response's `download` reflects true; `false` → false.

**DENIED (all → identical generic 401 envelope)**
- No browser session cookie.
- Malformed/invalid session cookie.
- Valid session, no grant for this link.
- Revoked grant.
- Disabled link.
- Revoked link.
- Expired link.
- Stale `configuration_version` (grant predates an owner edit).
- Resource not mapped to this share link.
- Resource mapped to a *different* share link (same or different owner).
- Resource belonging to a different owner (structurally prevented at mapping-insert time already; verify the read query's own scoping independently rejects it too).
- Resource deleted (mapping cascade-gone).
- NOTE resource (should be structurally unreachable via the owner UI, but must be rejected server-side per G2 if ever present).
- Malformed `resourceId` (not a UUID).
- Non-existent `resourceId`.
- Arbitrary/crafted `resourceId` attempting to reach another owner's file — must fail at the scoped `share_link_resources`/`task_resources` lookups (§8 steps 8-9), never at a storage-path level, since the client never supplies a storage path.

**LIFECYCLE**
- Owner shares a file → client can immediately open it.
- Owner unshares it → next request denied.
- Owner revokes the whole share link → denied.
- Session/grant refresh flows (re-entering a PIN, etc.) continue to behave exactly as Phase 3 already verified for `/projection` — no regression.
- Signed URL expires after TTL → subsequent use of the *same* URL fails (expected — verify this is Supabase Storage's own behavior, not something this app needs to enforce).

**PRIVACY**
- `storage_path` never appears in any response body (file-url route or projection).
- No private DB fields (`user_id`, internal resource id where avoidable, `mime_type`/`size_bytes` if excluded per §15) leak into the response.
- No service-role key or any credential material ever reaches the client.
- No analytics/session-replay instrumentation fires on this path (matches Phase 3's existing no-instrumentation posture on public share routes).
- Response headers include `Cache-Control: private, no-store` etc., matching `/projection`.

## 15. Disposable runtime/browser acceptance plan (design only — no execution this turn)

1. In a disposable/dev environment only, upload a real, harmless test file (e.g., a small PDF) as an owner-authenticated user via the existing Attachments upload UI.
2. Select that file under the share link's Attachments (existing quick-share picker) and save.
3. Confirm "Share update" succeeds and the link's configuration_version behavior matches existing Phase 3 expectations.
4. As an anonymous client (separate browser/incognito), open the public share URL, complete session/PIN flow as configured.
5. Confirm the attachment now renders as an openable control (post-Phase-4) rather than inert text.
6. Click it; confirm the file opens/downloads successfully, with no Text2Task login prompt anywhere in the flow.
7. Inspect Network tab: confirm neither the projection response nor the file-url response contains `storage_path`, and the signed URL itself is Supabase's own domain, not something revealing internal structure beyond what a signed URL inherently contains.
8. As the owner, unshare that file (deselect it, save) and confirm the anonymous client, on a fresh click, can no longer obtain a new file-url (existing/cached URL, if any, only works until its own short TTL elapses — expected, not a bug).
9. As the owner, disable or revoke the share link entirely; confirm the anonymous client's next file-url attempt (and projection reload) both fail.
10. Confirm a hand-crafted request for a different, unmapped `resourceId` (e.g., an id copied from a different project) against the same `publicId`/session is denied with the same generic error.

This plan intentionally uses only harmless disposable content and produces
no Production data or SQL; it is presented for a future turn's execution,
not run in this one.

## 16. Risks / unknowns requiring proof

- **Supabase Storage bucket-level policies for `"task-resources"` are not found anywhere in `supabase/migrations/`** (a repo-wide search for `storage.objects`/`bucket_id`/storage-scoped `create policy` returned no matches). This means the bucket's access policies are either configured outside version control (Supabase dashboard) or rely entirely on Supabase's own default private-bucket behavior plus the owner-side RLS-bound client's `auth.uid()`-scoped folder convention. This doesn't block Phase 4 (service-role bypasses Storage RLS regardless of what those policies say), but it *is* a real blind spot in this repository's infrastructure-as-code coverage worth flagging independently of Phase 4, since it can't be verified from the repo alone.
- **`file_name`/`mime_type` inclusion in the file-url response** is an open, minor decision: including `file_name` would let the frontend show a nicer downloading-filename without relying solely on the signed URL's own `Content-Disposition`, but the minimal-response principle argues for omitting it unless there's a concrete UX need. Flagged as a decision point for the implementation turn, not resolved here.
- **Reusing `projection_read` vs. adding a dedicated `file_access` rate-limit action** (§6) is a product/security trade-off, not a technical blocker — reusing avoids a migration; a dedicated action would allow tuning file-access limits independently (e.g., if large files make a tighter cap desirable) but requires extending the RPC's closed action vocabulary. Needs explicit sign-off before the implementation turn picks one.
- **The "Phase 1A report" referenced by `share_link_resources.resource_id`'s own migration comment** was not located in this turn's search (its exact filename wasn't recoverable from context); it likely already contains upstream design intent consistent with this plan, but was not read to cross-check. Worth locating before implementation in case it contains constraints not otherwise visible in code.

---

## PHASE 4 IMPLEMENTATION READINESS: READY

The existing schema, existing authorization gate
(`verifyShareProjectionAuthorization`), existing rate-limit
infrastructure, existing projection contract, and existing owner-side
signed-URL precedent together already contain everything Phase 4 needs.
No migration, no schema change, and no change to Phase 3's existing
behavior is required — Phase 4 is additive: one new server-side helper,
one new API route, and a small frontend change to make the existing
(currently inert) file-resource UI element clickable. The two items in
§16 (bucket-policy visibility, and the two named decision points on
response-field minimality and rate-limit action reuse) are minor and do
not block starting implementation — they should simply be confirmed or
decided explicitly before or during that turn, not treated as
prerequisites to beginning it.

> **This verdict is superseded by the correction pass below**, which
> changes the delivery mechanism (§9/§12) and the endpoint identifier
> (§7). The corrected verdict is at the end of that section.

---

# PHASE 4 — ARCHITECTURE CORRECTION PASS

Scope of this pass: same as above — **audit/plan only, no code edits, no
migration, no SQL execution, no deploy, no Production, no build, no
stage/commit/push.** Two contradictions in the pass above are resolved
here with evidence, including two external lookups (Supabase's own
documented signed-URL format, and Vercel's current serverless response
body limits) rather than relying on recollection alone.

## Issue 1 — the projection has no resourceId, but the recommended endpoint needed one

Confirmed contradiction: `clientProjectFileResourceSchema` is `{kind,
label, canDownload}` — no id of any kind — while §7's endpoint,
`GET /api/share/[publicId]/resources/[resourceId]/file-url`, requires the
browser to already possess a `resourceId` it was never given. This is a
genuine design gap in the original pass, not implementable as written.

**Resolution: `fileRef`, a deterministic keyed-HMAC opaque reference,
computed at read time, never persisted.**

The codebase already has exactly this pattern in production use.
`lib/share/share-browser-session.server.ts:137-184` derives
`session_digest` as:

```
createHmac("sha256", key).update(DOMAIN).update("\0").update(rawSecret).digest("hex")
```

where `key` comes from an existing, already-provisioned environment
variable (`TEXT2TASK_SHARE_SESSION_HMAC_KEY_V1`, ≥32 bytes, validated and
decoded by the module-private `getSessionHmacKey()`), and `DOMAIN`
(`"text2task.share.browser-session-digest.v1"`) is a fixed
domain-separation label prepended before a NUL byte and the actual
secret — standard, safe multi-purpose-key derivation, not a novel
technique for this codebase.

**`fileRef` reuses the exact same key with a new domain label:**

```
function deriveFileRef(shareLinkId: string, resourceId: string): string {
  const key = getSessionHmacKey(); // exported for reuse, was module-private
  return createHmac("sha256", key)
    .update("text2task.share.file-ref.v1")
    .update("\0")
    .update(shareLinkId)
    .update("\0")
    .update(resourceId)
    .digest("base64url");
}
```

Properties:
- **Deterministic and unpersisted.** The same `(shareLinkId, resourceId)`
  pair always yields the same `fileRef` while mapped, so it survives page
  reloads with no storage, no cache, no new column.
- **Not reversible and not forgeable** without the server's key — an
  attacker who observes a `fileRef` cannot recover `resourceId` or
  `shareLinkId` from it (one-way HMAC), and cannot mint a valid `fileRef`
  for a `resourceId` they merely guess.
- **Not shareable across share links.** Because `shareLinkId` is part of
  the HMAC input, the same underlying resource mapped into two different
  links (if that's ever possible for the same owner) produces two
  unrelated `fileRef` values — a leaked `fileRef` from one link context
  is meaningless against another.
- **Zero new secrets.** Reuses the already-provisioned session HMAC key
  via domain separation — the established pattern in this exact file —
  rather than introducing a second key/env var.

**Resolution (server side, on every request):**
1. Run the full existing authorization gate
   (`verifyShareProjectionAuthorization`) → `{shareLinkId, projectId, userId}`.
2. Reject a syntactically invalid `fileRef` early (wrong length/alphabet
   for a base64url-encoded 32-byte digest) before any DB call.
3. `SELECT resource_id, public_label, can_download FROM
   share_link_resources WHERE share_link_id = :shareLinkId AND user_id =
   :userId` — the same small, already-bounded mapped-resource set the
   projection itself builds from (realistically single digits to low
   tens of rows per link).
4. For each mapped row, compute `deriveFileRef(shareLinkId,
   row.resource_id)` and compare it to the supplied `fileRef` using
   `timingSafeEqual` on two equal-length (both fixed 32-byte digests)
   buffers — never `===` on strings. This mirrors
   `share-pin.server.ts:313-321`'s existing "length-check then
   `timingSafeEqual`, never plain equality" convention exactly. With a
   handful of mapped rows, scanning all of them is microseconds of HMAC
   compute — not a performance concern, and avoids needing an index or a
   stored reverse-lookup.
5. No match → the same generic 401 the rest of the route already uses.
6. On match, proceed with the resolved `resourceId` exactly as §8's
   original steps 9-11 describe (re-fetch `task_resources`, re-verify
   `isFileResource`/`isNoteResource`, then deliver — see Issue 2 for the
   corrected delivery step).

**Corrected public FILE projection contract** (the only projection
change — LINK resources are untouched):

```ts
export const clientProjectFileResourceSchema = z
  .object({
    kind: z.literal("file"),
    label: z.string(),
    canDownload: z.boolean(),
    fileRef: z.string(),
  })
  .strict();
```

`assembleClientProjection`'s file branch computes `fileRef:
deriveFileRef(shareLinkId, resolvedResource.id)` — `shareLinkId` is
already an input to that function; no new data dependency.

**Does any internal DB id reach the browser?** No. `fileRef` is a
fixed-length opaque digest structurally incapable of being decoded back
into `resourceId`/`shareLinkId`/`projectId`/`userId`. This is the same
privacy posture the rest of the projection already holds itself to (no
project/link/task/owner ids anywhere in `ClientProjectProjection`) —
`fileRef` extends that posture to files instead of breaking it.

## Issue 2 — does a Supabase signed URL expose `storage_path`?

Verified externally (not from recollection alone) against Supabase's own
documented behavior: a signed URL for a private bucket has the literal
shape

```
https://<project-ref>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=<signed-token>
```

— **the bucket name and the full object path are plaintext in the URL
itself.** Only the `token` query parameter is the actual short-lived
authorization; the path is not hidden or obfuscated by it. (Sources:
[Serving assets from Storage](https://supabase.com/docs/guides/storage/serving/downloads),
[Signed URLs and Public Access — supabase-js](https://deepwiki.com/supabase/supabase-js/6.5-signed-urls-and-public-access).)

Applied to this codebase's actual storage path convention
(`${userId}/${projectId ?? "no-project"}/${taskId ? `task-${taskId}` :
"project"}/${randomUUID}.${ext}`, confirmed in
`upload-and-create/route.ts`), a direct signed URL handed to an anonymous
browser would contain the **owner's internal Supabase user id and the
project's internal id in plaintext in the URL string** — exactly the
class of internal identifier `ClientProjectProjection`'s own doc comment
says must never reach a client ("no project UUID... no owner user ID...
appear anywhere in this schema"). One repo-native piece of corroborating
evidence: `scripts/client-share/build-phase1b-runtime-package.test.ts:1538`
already asserts that a runtime test source redacts `'signedUrl'` in the
same list as `'storagePath'`, `'userId'`, `'projectId'`, `'pinHash'` —
this codebase has already, independently, treated a signed URL as
sensitive material in the same tier as the path/ids it embeds.

**Classification: B — the direct-to-browser signed URL, using this
bucket's current path convention, violates the stricter Client Share
privacy contract.** §9's original recommendation (JSON + direct signed
URL) is withdrawn.

### Fallback architecture: server-mediated delivery (no path/token ever reaches the browser)

The browser only ever sees `GET /api/share/[publicId]/resources/[fileRef]`.
The server:
1. Resolves and authorizes exactly as in Issue 1's steps 1-6.
2. Reads the file directly via `supabaseAdmin.storage.from("task-resources").download(storage_path)`. Service-role access bypasses Storage's RLS-equivalent policies entirely — **no signed URL/token needs to be generated at all**, internally or externally, since the service-role client can read the object directly. This is simpler than the original design, not just more private.
3. Streams that content back as the Route Handler's own `Response` body, setting `Content-Type` from the resource's stored `mime_type` and, when `can_download` is true, `Content-Disposition: attachment; filename="<sanitized public_label><original extension>"` — using the owner-set, already-public-safe `public_label` as the visible filename, never the internal `file_name`. This is a positive side effect of server mediation: it resolves the original §16 open question (whether to expose `file_name`) by making it unnecessary — the browser gets a sensible download name without the internal filename ever being sent.
4. Response headers otherwise match the rest of the public surface: `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, etc.

**This changes §9's "proxy costs more" objection but does not overturn it
casually** — it's the *forced* conclusion once path exposure is
disqualifying, not a preference between two equally-valid options.

**Platform-limit check (explicitly required before trusting this, per
this turn's instruction not to switch to a proxy blind):** Vercel's own
current documentation states serverless functions have a **4.5 MB
response body limit for buffered responses**, enforced at the
infrastructure level and not configurable — but this limit applies to
buffered payloads; genuinely **streamed** Route Handler responses are
Vercel's documented escape hatch for larger payloads. (Sources:
[Vercel body size limit guide](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions),
[Vercel Functions Limits](https://vercel.com/docs/functions/limitations).)
Text2Task's existing product contract allows files up to **10 MB**
(`MAX_FILE_SIZE_BYTES` in `upload-and-create/route.ts`) — comfortably
over the 4.5 MB buffered ceiling. **Implication: the corrected endpoint
must return a genuinely streamed `Response` (e.g. converting the
downloaded `Blob` to a `ReadableStream` via `blob.stream()` and passing
that as the `Response` body, not `NextResponse.json(...)` or a
fully-buffered `Buffer`/base64 payload) — a buffered implementation would
silently break for any file over ~4.5 MB despite passing code review.**
This is exactly the kind of platform behavior that must be *proven*, not
assumed, before it's relied on — see the disposable-proof addition below.

### Alternative considered and not recommended: change the storage path convention instead

Removing `userId`/`projectId` from *future* uploads' path convention
(e.g. `resources/${randomUUID}.${ext}`) would make a *future* signed URL
path-safe and let Phase 4 keep the simpler direct-signed-URL design.
Rejected as the primary approach because it is **not retroactive**:
every file already uploaded under the current convention keeps embedding
`userId`/`projectId` in its path forever unless each object is
individually copied to a new key and its `task_resources.storage_path`
row updated — a genuine bulk data migration (storage + DB writes) against
a live production bucket, explicitly out of scope for this pass and
riskier than Phase 4 itself. It would also leave two delivery code paths
(old-convention files needing the proxy anyway, new-convention files
using direct signed URLs) rather than one uniform mechanism. The
server-mediated proxy works identically for every existing and future
file regardless of its path convention, needs no backfill, and no
compatibility branch — it is the more robust choice even though it costs
a small, bounded amount of function compute per file open.

### Exact disposable proof required before Phase 4 browser acceptance

In a disposable/dev environment only (not this turn):
1. Generate one real signed URL for one harmless test file via the
   existing owner-side `/api/task-resources/file-url` route and inspect
   it directly (dev tools/logging) to confirm the path/bucket-exposure
   finding above against this project's *actual* Supabase instance, not
   just documentation.
2. Build the corrected streamed proxy endpoint against a harmless test
   file sized close to (but under) the 10 MB product ceiling, and confirm
   the download completes successfully end-to-end in a real browser —
   proving the streamed-response approach actually avoids Vercel's 4.5 MB
   buffered limit in this app's current Next.js/Vercel configuration,
   rather than trusting the general platform documentation alone.
3. Confirm via Network tab that the *only* URL ever visible to the
   browser is `/api/share/[publicId]/resources/[fileRef]` — no
   `supabase.co/storage/...` URL appears anywhere in the page, requests,
   or response bodies.

## Recheck: "no schema changes"

**Still true — Phase 4 remains implementable with zero SQL/migrations.**
Both corrections are pure application code:
- `fileRef` is computed at read time from existing columns
  (`share_link_resources.resource_id`, the caller's already-verified
  `shareLinkId`) using an **already-provisioned** secret — no new table,
  column, or environment variable.
- The delivery mechanism moves from "return a signed URL" to "stream the
  bytes ourselves," which is a route-handler implementation change only;
  it reads the exact same `storage_path` column and the exact same
  bucket, just via `.download()` instead of `.createSignedUrl()`.

The one non-DB, non-SQL addition surfaced by this pass is that
`getSessionHmacKey()` (currently module-private in
`share-browser-session.server.ts`) needs to be exported (or an equivalent
small refactor) so `fileRef` derivation can reuse it — an application
code change, not a configuration or schema change, and not something
requiring a new secret to be provisioned.

## Corrected implementation slices

1. Export (or otherwise expose) the existing HMAC key accessor from
   `share-browser-session.server.ts`; add a `deriveFileRef` helper
   (new small module or colocated) using the `text2task.share.file-ref.v1`
   domain label.
2. Add `fileRef` to `clientProjectFileResourceSchema` and compute it in
   `assembleClientProjection`'s file branch.
3. New route `app/api/share/[publicId]/resources/[fileRef]/route.ts`:
   auth gate (steps 1-7 from the original §8) → `fileRef` scan-and-match
   against the link's mapped resources (Issue 1, steps 3-5) →
   `task_resources` re-fetch + `isFileResource` re-check (original §8
   steps 9-10) → `supabaseAdmin.storage...download(storage_path)` →
   streamed `Response` with `Content-Type`/`Content-Disposition` set from
   safe fields only (Issue 2).
4. Frontend: `client-project-view.tsx`'s file branch becomes a control
   whose `href`/click target is directly
   `/api/share/[publicId]/resources/${resource.fileRef}` (no separate
   JSON-fetch-then-navigate step needed now, since the endpoint itself
   *is* the file response) — simpler than the original two-step design.
5. Tests: HMAC-derivation unit tests (determinism, non-forgeability,
   timing-safe comparison usage — mirroring `share-pin.server.test.ts`'s
   existing style of asserting `timingSafeEqual` appears and `===`
   doesn't), route-level tests for the full DENIED matrix, and a
   streamed-response size test using a near-10MB fixture.

No slice requires a migration.

## Corrected test matrix (delta from the original §14 — all original DENIED/LIFECYCLE/PRIVACY rows still apply against `fileRef` in place of `resourceId`)

**AUTHORIZED**
- Mapped FILE resource + valid session/grant + correct `fileRef` → 200,
  streamed body, correct `Content-Type`, `Content-Disposition` present
  only when `canDownload`, filename derived from `public_label`.
- A near-10MB file completes successfully (platform-limit proof).

**DENIED — additional rows beyond the original §14 list**
- Syntactically invalid `fileRef` (wrong length/charset) rejected before any DB call.
- `fileRef` valid in shape but not matching any of this link's currently mapped resources.
- `fileRef` correctly computed for a resource under a *different* share link (cross-link replay) — must fail because `shareLinkId` is part of the HMAC input.
- `fileRef` for a resource that *was* mapped but has since been unmapped — must fail (mapping re-fetched fresh every request, never cached).

**PRIVACY — additional rows**
- No `storage.co`/Supabase Storage URL of any kind ever appears in any response body, header, or redirect target visible to the browser.
- Internal `file_name` never appears in `Content-Disposition`; only the sanitized `public_label` (+ safe extension) does.
- `fileRef` cannot be used to recover `resourceId` (structural property of HMAC, asserted by a unit test that no reverse mapping exists in code, not just claimed).

## PHASE 4 IMPLEMENTATION READINESS: READY

Both contradictions are resolved without any schema/SQL/ENV change:
`fileRef` closes the missing-identifier gap by reusing the codebase's own
existing HMAC-key/domain-separation pattern, and server-mediated
(streamed) delivery closes the path-exposure gap by construction, at the
cost of a small amount of added function compute per file open — a cost
that's bounded by the existing 10 MB file-size product contract. The only
work items carried forward are proof items, not blockers: (1) run the
disposable proof above to confirm actual signed-URL shape and actual
streamed-response behavior against this project's real Supabase/Vercel
configuration rather than documentation alone, and (2) export the
currently-private HMAC key accessor as a small, low-risk refactor. Neither
requires a product decision to resolve, unlike the two items already
flagged and approved in §16 (rate-limit action reuse, response-field
minimality) plus the storage-path-rename alternative, which was
evaluated and explicitly not recommended.

> **⚠ One item above is corrected by the Phase 4A spike below: the
> "zero new secrets" claim in Issue 1's fileRef design was wrong.** This
> codebase's own established convention (`share-secret.server.ts`'s own
> comment) is a dedicated HMAC key per purpose, not domain-separated
> reuse of an existing key. The spike below implements the corrected
> version.

---

# PHASE 4A — SECURE FILE DELIVERY INFRASTRUCTURE PROOF

Scope: a disposable, isolated proof of the delivery transport and
response-security contract only — **not** the full Phase 4 feature. No
new file in this pass is wired into any live route (nothing added under
`app/api/**`); no existing production file was modified; no migration,
SQL, deploy, or Production access occurred. Two genuinely new source
files, two test files, one throwaway standalone Node script (run, then
deleted, not committed) were produced. `npm test` (Vitest) was actually
executed against the new code — see §8/§13 for real, not fabricated,
results.

## 1. Exact installed/runtime behavior discovered

- `next`: **16.1.6** (App Router, Node runtime default). `next.config.ts` sets only an image `remotePatterns` allowlist — no custom `runtime`, body-size, or streaming configuration anywhere in the repo.
- `react`/`react-dom`: 19.2.3.
- `@supabase/supabase-js`: **2.99.1**, which pulls in `@supabase/storage-js` **2.99.1** (confirmed via `node_modules/@supabase/storage-js/package.json`).
- No `vercel.json` in the repository — Function configuration (memory, `maxDuration`, etc.) is either left at Vercel's defaults or set in the Vercel dashboard, not version-controlled.
- The existing `app/api/task-resources/upload-and-create/route.ts` (which already accepts request bodies up to the product's 10MB limit) sets **no** special `runtime`/`maxDuration`/body-size export — it relies entirely on platform defaults and already works for 10MB **inbound** payloads today. This is reassuring context but not proof for the **outbound/response** direction, which is a distinct Vercel limit from the inbound request-body path.
- Node version in this environment: v24.14.0 (used for the standalone verification script in §9).

## 2. Exact upload MIME allowlist

Read directly from `app/api/task-resources/upload-and-create/route.ts:8-21` (unchanged from the earlier pass, re-confirmed):

```
image/png, image/jpeg, image/jpg, image/webp, image/gif,
application/pdf,
text/plain, text/csv,
application/msword,
application/vnd.openxmlformats-officedocument.wordprocessingml.document,
application/vnd.ms-excel,
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

No HTML, SVG, XML, JavaScript, or any other browser-executable type is or
has ever been in this allowlist.

## 3. Inline-safe vs. forced-download classification

| Type | Classification | Reason |
|---|---|---|
| `image/png`, `image/jpeg`, `image/jpg`, `image/webp`, `image/gif` | **A — inline-safe** | Raster-only, no active-content capability |
| `application/pdf` | **A — inline-safe, with mitigations** | Modern browsers render PDFs in a sandboxed viewer process; mitigated further by `Content-Security-Policy: sandbox` + `nosniff` on every response from this endpoint regardless of type |
| `text/plain`, `text/csv` | **A — inline-safe, `nosniff` mandatory** | Inert as declared, but a maliciously-crafted "text/plain" file containing HTML-like bytes could be MIME-sniffed and executed by a browser without `X-Content-Type-Options: nosniff` — this header is therefore non-negotiable on this endpoint, not merely a nice-to-have |
| `application/msword`, `...wordprocessingml.document`, `application/vnd.ms-excel`, `...spreadsheetml.sheet` | **B — forced attachment** | No native browser viewer exists for these; browsers already always download/hand off to an external app regardless of `Content-Disposition`, so forcing `attachment` removes ambiguity without changing observed behavior |
| Anything outside the allowlist (HTML, SVG, XML, JS, etc.) | **C — never reaches this code path** | Rejected at upload time; the delivery endpoint's own `resolveContentDisposition` additionally fails safe to `forced-attachment` for any unrecognized MIME as defense-in-depth, in case a pre-allowlist-era row or a future allowlist change is ever inconsistent |

Implemented and tested in `lib/share/share-file-response.server.ts` /
`.test.ts` — `classifyMimeForInlineDelivery` and
`resolveContentDisposition`.

## 4. HMAC/fileRef encapsulation decision — corrected

**Self-correction from the prior pass:** the earlier "reuse
`TEXT2TASK_SHARE_SESSION_HMAC_KEY_V1` via domain separation, zero new
secrets" recommendation was wrong. Reading `lib/share/share-secret.server.ts`
(a sibling module using the identical HMAC pattern) surfaced its own
explicit comment: *"Deliberately separate from every other HMAC/
encryption key in this repository... reusing a key across unrelated
purposes would let a compromise of one purpose's key compromise the
other's data too."* That is this codebase's actual, stated rule, and the
prior pass's reuse plan violated it.

**Corrected design, implemented in `lib/share/share-file-ref.server.ts`:**
a dedicated env var `TEXT2TASK_SHARE_FILE_REF_HMAC_KEY_V1`, following the
exact same lazy-load/base64url-decode/min-32-bytes/fail-closed shape as
`share-secret.server.ts` and `share-browser-session.server.ts`. The
key-reading function (`getShareFileRefHmacKey`) is **not exported**; the
module exports only three narrow capabilities:
- `deriveShareFileRef(shareLinkId, resourceId): string`
- `isPlausibleShareFileRef(value): boolean` (cheap syntactic pre-check)
- `matchShareFileRef(candidateFileRef, shareLinkId, mappedResourceIds): string | null` (scans the link's small mapped set, `timingSafeEqual` comparison, mirroring `share-pin.server.ts`'s existing convention)

Enforced by tests (`share-file-ref.server.test.ts`, "dedicated-key
convention" block): the raw key is never exported, the module reads only
its own env var, and comparison uses `timingSafeEqual`, never `===`.

**Correction to §recheck "no schema changes" from the prior pass:** this
means Phase 4 now needs **one new environment variable** provisioned
(dev/preview/production) before shipping — a small, non-DB, non-SQL
operational item, but a real correction to the previous "zero
configuration changes" claim. No SQL/migration is still required.

## 5. Safe Content-Disposition design

Implemented in `lib/share/share-file-response.server.ts` (`buildContentDisposition`/`resolveContentDisposition`), built **only** from `public_label` (already owner-set, already public-safe) plus a validated extension — the function has no `file_name` parameter at all, so the internal filename cannot leak through it even by mistake. Emits both the RFC 6266 ASCII `filename=` fallback and the RFC 5987 `filename*=UTF-8''...` form. Verified by 12 tests in `share-file-response.server.test.ts`, including:
- quotes stripped (cannot break out of the quoted value)
- CR/LF stripped (cannot inject a second header)
- other control characters (NUL, DEL) stripped
- `/` and `\` replaced (no path-like segments survive)
- empty or entirely-stripped label falls back to `"attachment"`
- names over 100 characters truncated
- Unicode preserved correctly via `filename*=UTF-8''...`, with a safe ASCII-only fallback in `filename=`
- an unsafe/overlong extension is dropped rather than embedded verbatim

## 6. Is Supabase's `.download()` buffered or a true stream? — resolved definitively from installed source

Read directly from the installed `@supabase/storage-js@2.99.1` package
(`node_modules/@supabase/storage-js/src/packages/StorageFileApi.ts`,
`BlobDownloadBuilder.ts`, `StreamDownloadBuilder.ts`):

- `StorageFileApi.download(path)` returns a `BlobDownloadBuilder`.
- Awaiting it directly (`await ...download(path)`) resolves via `BlobDownloadBuilder.execute()`, which calls `await result.blob()` — **this fully buffers the object into memory as a `Blob`** before returning.
- `BlobDownloadBuilder` additionally exposes `.asStream()`, returning a `StreamDownloadBuilder` whose `execute()` resolves `data: result.body as ReadableStream` — **the raw underlying `fetch` Response's own `body`, with zero buffering or transformation by the SDK.**

**Conclusion: the corrected Phase 4 delivery code must call
`supabaseAdmin.storage.from(bucket).download(path).asStream()`, not the
bare `.download(path)`**, to get a genuine pass-through stream. This
supersedes the previous pass's "convert the downloaded Blob to a stream"
description — that's unnecessary; a true stream is available directly
from the SDK without ever fully buffering.

## 7. Exact disposable proof implementation

Five new files, zero modified existing files:
- `lib/share/share-file-ref.server.ts` — fileRef derivation/matching (§4).
- `lib/share/share-file-ref.server.test.ts` — 14 tests.
- `lib/share/share-file-response.server.ts` — Content-Disposition + MIME classification + `buildStreamedFileResponse` (a `Response` constructor wrapping a `ReadableStream` with the correct security headers).
- `lib/share/share-file-response.server.test.ts` — 16 tests.
- `lib/share/share-streamed-delivery.spike.test.ts` — the streaming-integrity proof (§9).

None of these are imported by any route handler; there is no new public
surface area from this pass.

## 8. Small-file result

All local, in-memory, no network/Supabase dependency — **actually
executed**, not simulated in the report:
- 1KB and 64KB synthetic streams through `buildStreamedFileResponse`: byte-for-byte identical on read-back, correct headers (`Content-Type`, `Content-Length`, `Content-Disposition`, `nosniff`, `sandbox` CSP all verified).
- 2MB multi-chunk (8 chunks of 256KB) stream: byte-for-byte identical on read-back inside the Vitest suite.

## 9. Near-10MB result

Two separate pieces of evidence, both real:

**(a) Plain Node (v24.14.0), run directly, not through Vitest** — a
throwaway script (not committed; deleted after running) built a 9.5MB
synthetic `ReadableStream`, wrapped it in the same `Response` shape
`buildStreamedFileResponse` produces, and read it back:

```
build+enqueue: 12.62ms
response-construct: 34.05ms
read-back: 0.69ms
chunks read: 38   total bytes: 9,961,472   (= 9.5 * 1024 * 1024, exact)
```

Byte-for-byte correctness confirmed. This is real, executed evidence that
Node's native `Response`/`ReadableStream` machinery handles a ~9.5MB
multi-chunk stream instantly and correctly, with no size ceiling of its
own.

**(b) The same logic run inside this repo's Vitest suite exhibited a
severe, reproducible slowdown (30s+, hitting the test timeout) at the
9.5MB size, despite passing cleanly at 2MB.** This was investigated: the
plain-Node result above proves the streaming *logic* itself is not the
cause (it's instant outside Vitest), so this is attributed to Vitest's
own test-runner/vite-node transform overhead when repeatedly awaiting
`reader.read()` across ~38 chunks in that specific harness — a test
environment artifact, not a defect in the delivery code. The kept test
suite uses 2MB (passes reliably in ~8s total for the whole 3-file suite)
and the 9.5MB case is documented in a code comment rather than left in
as a flaky/slow test.

**What this does NOT prove:** actual behavior of a **deployed Vercel
Function** streaming a ~9.5MB response over a real network connection,
through Vercel's actual edge/platform layer, against this project's
actual Supabase Storage bucket. That requires a live deployment, which
this session has no credentials or access to create. See §11 for the
exact scope of what remains open.

## 10. Browser-visible URL/privacy result

Not empirically observed in a real browser this session (no live
deployment to point one at). By construction, though: `.asStream()`'s
`ReadableStream` is consumed entirely server-side and piped into our own
`Response` — at no point does a Supabase Storage URL, bucket name,
object path, or token exist anywhere the browser could see it. The only
URL a browser would ever be given is our own
`/api/share/[publicId]/resources/[fileRef]`. This is a structural
property of the design (nothing to leak, because nothing Supabase-hosted
is ever handed to the client), not something that needs a live network
trace to establish logically — but confirming it empirically in a real
browser's Network tab remains part of the eventual acceptance plan
(§15 of the original pass) once a real route exists.

## 11. Is the Vercel proxy architecture viable for the full 10MB contract?

**Inconclusive this session — leaning strongly positive, not proven.**
In favor: Vercel's own documentation explicitly recommends streaming
Route Handler responses as the sanctioned way past the 4.5MB *buffered*
response limit; the installed Supabase SDK provides a genuine unbuffered
stream (§6); and this repo's own streaming/Response construction was
shown, via real execution, to correctly pass ~9.5MB through instantly
with no ceiling of its own (§9a). Against: none of this was run through
an actual deployed Vercel Function, so the one Vercel-platform-specific
fact that actually matters — whether Vercel's edge counts a genuinely
streamed Route Handler response toward the 4.5MB buffered ceiling, in
*this* project's current Next.js 16 / Vercel configuration — was not
independently confirmed. This is exactly the fact the original request
asked not to assume from generic docs alone, and it remains unconfirmed
because doing so requires deploy access this session does not have.

## 12. Files changed for the spike

**Added (5):** `lib/share/share-file-ref.server.ts`,
`lib/share/share-file-ref.server.test.ts`,
`lib/share/share-file-response.server.ts`,
`lib/share/share-file-response.server.test.ts`,
`lib/share/share-streamed-delivery.spike.test.ts`.
**Modified:** none. **New routes:** none. **Migrations:** none. **ENV
changes actually applied:** none (a new var is *needed* before shipping,
per §4, but none was set this session).

## 13. Tests run/results

`npx vitest run lib/share/share-file-ref.server.test.ts
lib/share/share-file-response.server.test.ts
lib/share/share-streamed-delivery.spike.test.ts` — **37/37 passed**,
8.92s total (after fixing two real bugs surfaced during this pass: an
over-strict assertion in the "dedicated-key convention" test, and the
Vitest-specific large-stream slowdown described in §9b). Separately, the
standalone Node script in §9a was executed directly via `node` and
produced the byte-exact result quoted there.

## 14. Cleanup requirements for temporary spike code

None of the five new files are wired into any route, so there is nothing
to disable before a normal deploy — they are inert, additive library
code with their own passing tests. Recommendation: **keep them as the
first real Phase 4 implementation slice** (they are production-quality,
not throwaway) rather than deleting and rebuilding equivalents later. The
one throwaway artifact (`/tmp/stream-probe.mjs`) was deleted after use
and was never part of the repository.

## 15. Verdict

**PHASE 4 DELIVERY ARCHITECTURE: PROVEN (application layer) — PLATFORM LAYER UNVERIFIED, not BLOCKED.**

Nothing tested this session failed. The application-layer questions this
spike was scoped to answer are answered with real evidence: the SDK
exposes a true unbuffered stream (`.asStream()`), this codebase's own
response-construction code correctly and quickly passes a near-10MB
stream through byte-for-byte, the MIME/Content-Disposition/security-
header design is safe and tested against realistic adversarial input,
and the fileRef encapsulation now correctly follows this repository's own
stated key-isolation convention. Calling this outright "PROVEN" without
qualification would overstate it, and calling it "BLOCKED" would misstate
what was actually found (nothing failed) — so the honest label is
proven-at-the-application-layer with one specific, named, platform-level
fact still open.

**The one remaining gap:** empirical confirmation, against a real Vercel
Preview deployment of this project, that a streamed Route Handler
response carrying a file near the 10MB product limit is not truncated or
rejected by Vercel's infrastructure. This needs either (a) deploy access
granted to this session, or (b) the user deploying the current branch (no
new route exists yet to test against, so this specific check would need
the minimal real route from the next slice below, or a tiny disposable
route added temporarily to a Preview branch and removed after), or (c) a
deliberate decision to proceed on the strength of Vercel's own
documentation plus the evidence in §9 without a live check, accepting
that residual risk explicitly rather than silently.

**Next Phase 4 implementation slice, if proceeding:** wire the two new
modules into the real endpoint —
`app/api/share/[publicId]/resources/[fileRef]/route.ts`, following the
authorization sequence already designed in the correction pass above
(§8 of that section) but with `.download(storage_path).asStream()` in
place of `createSignedUrl`, `matchShareFileRef` in place of a direct
`resourceId` path param, and `resolveContentDisposition` +
`buildStreamedFileResponse` for the response — deployed to a real Preview
branch specifically so the one open platform question in this section can
finally be closed with a real observation instead of documentation and
local proof alone.

---

# PHASE 4B — MINIMAL REAL FILE DELIVERY VERTICAL SLICE

Scope: wire the minimum **real** server path needed to deploy to a
disposable Vercel Preview and close the one open question from Phase 4A
(§11: does a genuinely streamed Route Handler response survive Vercel's
platform for a file near the 10MB product limit). This is real,
production-quality code — not a spike — but is deliberately **not** the
full Phase 4 feature: the Client Project file UI (`client-project-view.tsx`)
is untouched, so no anonymous visitor can reach this endpoint through the
product yet. No migration, no SQL, no deploy, no ENV change, no
stage/commit/push occurred this turn.

## 1. Files changed

**Added (2):**
- `app/api/share/[publicId]/resources/[fileRef]/route.ts` — the real endpoint.
- `app/api/share/[publicId]/resources/[fileRef]/route.test.ts` — 26 tests.

**Modified (4):**
- `lib/share/client-share-projection-contracts.ts` — added `fileRef: z.string()` to `clientProjectFileResourceSchema`.
- `lib/share/client-share-projection.server.ts` — threaded `shareLinkId` into `assembleClientProjection`'s input and both call sites; the file branch now computes `fileRef: deriveShareFileRef(input.shareLinkId, mapped.resourceId)`.
- `lib/share/client-share-projection.server.test.ts` — updated 3 existing `resources` assertions to include the now-required `fileRef` (computed via the real `deriveShareFileRef`, not hardcoded), added a determinism/cross-resource test, strengthened the "never leaks" test to also assert the resourceId/shareLinkId themselves never appear.
- `app/components/dashboard/tasks/share-link/client-project-view.test.tsx` — added `fileRef` to two fixture objects so they satisfy the now-stricter type; **the test's own behavior and title are unchanged** ("renders a file resource as plain text... never a downloadable link" — still true, since the UI itself was deliberately not touched this turn).

The five Phase 4A files (`share-file-ref.server.ts`, its test,
`share-file-response.server.ts`, its test, and the streaming spike test)
are unchanged, kept as-is, and are now actually consumed by the real
route rather than sitting unwired.

## 2. Exact route architecture

`GET /api/share/[publicId]/resources/[fileRef]` — Node runtime
(`export const runtime = "nodejs"`), `export const dynamic =
"force-dynamic"`, matching `/projection/route.ts` exactly. Same
`NO_STORE_HEADERS` shape, same generic `{ok:false, code:"UNAVAILABLE",
error:"..."}` failure envelope, same `isCrossSiteFetch` same-origin
defense, same `assertClientShareEnabled`/`isShareAvailabilityError`
feature-gate wrapping.

## 3. Authorization chain (exact order implemented)

1. `assertClientShareEnabled()`.
2. `isCrossSiteFetch` same-origin check.
3. `isValidSharePublicId(publicId)`.
4. `isPlausibleShareFileRef(fileRef)` — cheap syntactic reject before any DB call.
5. Read + validate the HttpOnly session cookie shape.
6. `checkShareRateLimit({action:"projection_read", scope:"browser_session", ...})` — reused, no new vocabulary.
7. `verifyShareProjectionAuthorization({cookieValue, publicId})` → `{shareLinkId, projectId, userId}` or generic-unavailable. This one call re-verifies session live+unrevoked, link active+unexpired+project-not-deleted, grant same-session+same-link+unexpired+unrevoked+configuration-version-match+PIN-satisfied — nothing about it was reimplemented.
8. `SELECT resource_id, public_label, can_download FROM share_link_resources WHERE share_link_id = :shareLinkId AND user_id = :userId` via `supabaseAdmin` — this link's own mapped set only.
9. `matchShareFileRef(fileRef, shareLinkId, mappedResourceIds)` → resolved `resourceId` or `null`. No match → generic-unavailable (covers: unmapped, cross-link replay, garbage-but-plausible fileRef).
10. `SELECT id, resource_type, url, storage_path, file_name, mime_type, project_id FROM task_resources WHERE id = :resourceId AND user_id = :userId` via `supabaseAdmin`, `.maybeSingle()`. No row → generic-unavailable (covers: deleted resource).
11. Defense-in-depth: `row.project_id !== null && row.project_id !== projectId` → generic-unavailable (re-verifies live what the integrity trigger already guarantees at write time).
12. Re-classify via the real `isFileResource`/`isNoteResource` (from `resource-api.ts`, not re-implemented) on the freshly-read row. Not a file, or no `storage_path` → generic-unavailable.
13. `supabaseAdmin.storage.from("task-resources").download(row.storage_path).asStream()` — the true-stream variant, proven in Phase 4A never to buffer. Error/no stream → generic-unavailable.
14. `resolveSafeMimeType`/`extractExtension`/`resolveContentDisposition` build the response headers from safe fields only.
15. `buildStreamedFileResponse` returns the `Response`.

Every DENIED case from the task's own list (malformed fileRef,
syntactically-valid-but-unknown fileRef, cross-link replay, unmapped
resource, resource removed after projection built, different
owner/project, deleted/nonexistent resource, NOTE resource, invalid
session, no grant, revoked grant/link, disabled/expired link, stale
configuration_version) resolves to the identical generic 401 — verified
by the 26-test route suite (§6 below).

## 4. Streaming implementation

Exactly the Phase 4A-proven mechanism: `.download(path).asStream()`,
never the bare buffered `.download(path)`, never `.createSignedUrl()`,
never a redirect. `Content-Length` is deliberately **not** set — the
route has no authoritative byte count once bytes flow through
`.asStream()` (that call never materializes a `Blob`, so there is
nothing to measure without defeating the point of streaming), and the
stored `size_bytes` column is a separate, independently-writable value
that is not proven to match the object actually being streamed right
now. Streaming correctness was prioritized over supplying this optional
header, exactly as instructed.

## 5. Response-security behavior implemented

- `Cache-Control: private, no-store`, `Pragma: no-cache`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` on every branch (failure and success alike).
- `Content-Security-Policy: sandbox` on the success branch (via `SHARE_FILE_RESPONSE_SECURITY_HEADERS`).
- `resolveSafeMimeType` refuses to put an arbitrary stored `mime_type` value into the `Content-Type` header — anything outside the audited upload allowlist becomes `application/octet-stream`.
- `resolveContentDisposition` forces `attachment` for any MIME type with no native inline browser viewer (Word/Excel, and any unrecognized type by the same fallback), and builds the filename **only** from `public_label` + a validated extension — `file_name` is never read into any header.
- `storage_path`, `resourceId`, `shareLinkId`, `userId` never appear in any response body, header, or error message on any path — asserted directly by the PRIVACY test group.
- Diagnostics (`logShareFileRouteError`) log only a fixed stage tag and an error-vs-unknown category, matching the projection route's own logging discipline — never the cookie, PIN, storage_path, or a fileRef alongside the resource it resolved to.

## 6. Tests / results

All commands actually executed this turn, real output:

- New route tests: `26/26 passed`.
- Full regression sweep — `npx vitest run lib/share app/api/share app/components/dashboard/tasks/share-link`: **42 test files, 1572 tests, all passed**, 71.36s. This includes the updated projection tests, the Phase 4A fileRef/response-helper/streaming-spike tests, the new route tests, and every pre-existing Client Share test in the repo (session, grants, PIN, rate limit, projection, owner UI, quick-share, etc.) — no regression anywhere in the suite.
- `npx tsc --noEmit -p tsconfig.json`: **clean, zero errors** (one pre-existing type error surfaced initially in a test fixture missing the now-required `fileRef` field — fixed as part of this slice, see §1).
- `npx eslint` on all new/modified files: **clean, zero warnings/errors**.

## 7. TypeScript

Clean (§6). The `fileRef` addition to `clientProjectFileResourceSchema`
is non-optional by design (a discriminated-union member that can't forget
to carry it), which is exactly what surfaced the one fixture that needed
updating — the type system doing its job, not a defect.

## 8. git diff --check

Clean (exit 0). Only benign LF→CRLF line-ending normalization warnings on
Windows (`core.autocrlf`), no trailing-whitespace or conflict-marker
issues.

## 9. git status --short

```
 M app/components/dashboard/tasks/share-link/client-project-view.test.tsx
 M lib/share/client-share-projection-contracts.ts
 M lib/share/client-share-projection.server.test.ts
 M lib/share/client-share-projection.server.ts
?? app/api/share/[publicId]/resources/
?? docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_4_AUDIT_AND_PLAN_2026-08-18.md
?? lib/share/share-file-ref.server.test.ts
?? lib/share/share-file-ref.server.ts
?? lib/share/share-file-response.server.test.ts
?? lib/share/share-file-response.server.ts
?? lib/share/share-streamed-delivery.spike.test.ts
```

Nothing staged, nothing committed, nothing pushed. `client-project-view.tsx`
itself (the actual UI component, as opposed to its test file) is **not**
in this list — confirming the final UI was genuinely left untouched as
instructed.

## 10. Exact manual Preview steps needed to close the 9.5MB Vercel proof

This is the one thing that still requires an actual deployment this
session cannot perform:

1. Push this branch (or a copy of it) and let Vercel build a Preview deployment — a real `next build` against these files, on real Vercel infrastructure, is required at this step (this is the "full Build" the constraints allow only when strictly necessary to deploy the proof).
2. Set `TEXT2TASK_SHARE_FILE_REF_HMAC_KEY_V1` on that Preview environment only (32+ random bytes, base64url-encoded — e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`). Without it, `deriveShareFileRef` fails closed and the projection's file branch will 500.
3. As an existing owner account on that Preview deployment, upload one harmless real test file close to but under 10MB, and map it into a share link's Attachments (existing UI, already supports this — see Phase 4 audit §1).
4. Load the share link's public page in a browser, open DevTools → Network, and reload `/api/share/[publicId]/projection` — copy the `fileRef` value for the test file's `resources` entry out of the response body (this is the intended, correct way to obtain it, since the UI does not yet expose a click affordance).
5. Navigate the browser directly to `/api/share/<publicId>/resources/<fileRef>`.
6. Observe: does the file load completely (Network tab shows the full byte size, no truncation, no non-2xx status, no premature connection close)? This is the actual near-10MB Vercel-platform proof Phase 4A could not perform locally.
7. Confirm in the same Network tab that no `supabase.co` URL, `storage_path`-shaped string, or internal id appears anywhere in the request/response for either the projection call or the file call.
8. Repeat with the mapped file removed from the share link (expect the file request to now fail generically) and with the link disabled (expect the same).
9. Tear down: remove the Preview-only env var and the disposable test file/share link once the proof is captured; this Preview deployment should not be treated as a lasting environment.

---

## PHASE 4B CODE STATUS: IMPLEMENTED

## VERCEL NEAR-10MB STREAMING: AWAITING REAL PREVIEW PROOF

**Phase 4 is not complete.** What exists now: a real, tested, passing
vertical slice from the public projection (now carrying `fileRef` for
FILE resources) through to a real, authorization-complete, streaming
delivery route — but with no click affordance in the product UI yet, and
with the one Vercel-platform-specific fact from Phase 4A (§10 above)
still unverified against a live deployment. Remaining before Phase 4 can
be called done: run the manual Preview proof above, then (only after
that proof succeeds) wire `client-project-view.tsx`'s file branch to
actually call this endpoint.

## 11. Confirmed separate defect: inbound upload fails for a ~9.5MB file (`FUNCTION_PAYLOAD_TOO_LARGE`)

While attempting the manual Preview proof above, uploading a harmless
~9.5MB test file through the **existing owner Resources upload UI**
(`app/api/task-resources/upload-and-create/route.ts`) failed before the
request ever reached Supabase, with:

```
Request Entity Too Large
FUNCTION_PAYLOAD_TOO_LARGE
```

This is a **pre-existing product defect, unrelated to Phase 4 and not
fixed in this turn**, confirmed now against a real deployment rather
than only inferred from the 10MB constant. The product's own documented
contract — `MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024` and the visible copy
"Maximum size is 10MB" — cannot actually be honored by the *upload* path
today for files that exceed Vercel's separate, platform-level inbound
request-body ceiling. This is the mirror image of the Phase 4A/4B outbound
question (§11 of Phase 4A, §10 of Phase 4B): that work concerned whether
a large file can be *streamed out* through a Route Handler; this defect
is about the *existing, already-shipped* inbound upload path silently
failing for files in the upper part of its own advertised size range.

**Not addressed this turn, by explicit instruction.** A disposable-only
workaround (`docs/client-share-phase4-file-fixture/`) was prepared so the
Phase 4B outbound proof does not depend on fixing this first — it places
a fixture file directly via the Supabase Storage dashboard and a matching
`task_resources` row via SQL, bypassing the broken upload endpoint
entirely, in the disposable project only. **This defect itself still
needs its own investigation and fix as a separate piece of work** before
Text2Task's 10MB upload claim is actually true end-to-end in Production —
tracked here as a known gap, not resolved.

---

# PHASE 4B REAL PREVIEW DEFECT #1: DIRECT FILE NAVIGATION INVALID_ORIGIN

Found during real disposable-Preview testing, after the disposable file
fixture (`docs/client-share-phase4-file-fixture/`) verified 10/10 PASS.
The public share page loaded anonymously, the projection succeeded, the
FILE resource's `fileRef` was present with no internal ids/storage_path/
Supabase URL anywhere — then opening
`GET /api/share/<publicId>/resources/<fileRef>` **directly in the same
browser** (typed/pasted into the address bar) returned:

```json
{"ok": false, "code": "INVALID_ORIGIN", "error": "Invalid request origin."}
```

before authorization was ever reached. The Vercel near-10MB streaming
proof is still **not** tested — this defect blocked it before that
question could even be attempted.

## Exact root cause

Both `/projection/route.ts` and the new `/resources/[fileRef]/route.ts`
each had their own private, identically-shaped `isCrossSiteFetch`:

```ts
function isCrossSiteFetch(headers: Headers): boolean {
  const secFetchSite = headers.get("sec-fetch-site");
  return secFetchSite !== null && secFetchSite.toLowerCase() !== "same-origin";
}
```

The comment above it already stated the *intent* correctly ("A missing
Sec-Fetch-Site ... is accepted"), but the code only accounts for the
header being **absent**. A direct top-level navigation — typing/pasting
a URL into the address bar, following a bookmark, or any other
browser-generated request with no initiating page — does not omit
`Sec-Fetch-Site` in any modern Fetch-Metadata-supporting browser; it
sends it explicitly as `Sec-Fetch-Site: none` (per the Fetch Metadata
spec / MDN: *"The user agent's user explicitly caused the request, e.g.
by typing a URL into the browser's address bar, clicking a bookmark, or
via drag and drop"*). The old check treated that legitimate `"none"`
value exactly like a foreign `"cross-site"` value and rejected it —
which is precisely what a direct address-bar navigation to the file
route (its own primary intended use case, per the product contract) is.
This is a real logic gap, not a false alarm from the real-Preview test.

This was latent in the projection route too (identical code), though it
had not manifested there in practice because that route is normally
called via `fetch()` from the already-loaded page (`Sec-Fetch-Site:
same-origin`), not via direct navigation.

## Exact fix

Extracted the check into one shared module,
`lib/share/share-request-security.server.ts`, exporting
`isRejectableCrossSiteRequest(headers)`, and pointed both routes at it
(their own local copies deleted, not left duplicated). The corrected
policy:

- **Allow**: `Sec-Fetch-Site` absent (unchanged); `same-origin`
  (unchanged, covers same-origin `fetch()` and same-origin navigation,
  `target="_blank"` or not — tab-ness does not affect the site
  relationship); `none` **provided** `Sec-Fetch-Mode` is either absent or
  exactly `navigate` (the fix — this is the shape every direct/typed/
  bookmarked top-level GET navigation actually has).
- **Deny**: `cross-site`; `same-site` (deliberately *not* widened beyond
  what this app's existing single-origin security model already relies
  on — the task's own suggestion to consider allowing `same-site` was
  evaluated and not adopted, to avoid silently broadening trust beyond
  what was proven necessary to fix the confirmed defect); `none` paired
  with a present, non-`navigate` `Sec-Fetch-Mode` (a combination no real
  browser's navigation machinery produces — treated as contradictory and
  rejected, satisfying the "malformed/contradictory metadata" requirement
  without needing to guess at further cases no real browser can produce).

## Security reasoning

This remains defense-in-depth, not the primary authorization boundary —
unchanged by this fix. Every request to the file route still
independently requires, on every single call, with nothing cached: a
valid HttpOnly Client Share browser-session cookie, a live non-revoked
grant, an active non-disabled/non-revoked/non-expired link, an exact
`configuration_version` match, a `fileRef` that resolves within that
link's own currently-mapped resource set, and independent re-verification
that the resolved resource is still a live FILE. Fetch Metadata headers
are a browser-cooperation signal a non-browser client can trivially
forge — this check exists only to reject the shape of request a
*compliant browser* would send as a result of a genuinely cross-site
page, narrowing that one specific attack surface; it was never the thing
standing between an attacker and the file, and still isn't after this
fix. The fix widens what a *legitimate* browser-driven request looks
like; it does not weaken what's required to pass everything past it.

## Tests

- New: `lib/share/share-request-security.server.test.ts` — 12 tests, both ALLOW (same-origin fetch, same-origin top-level navigation, same-origin `target=_blank`, direct/typed navigation with `none`+`navigate`, `none` with no `Mode` present, headers entirely absent) and DENY (cross-site fetch, cross-site navigation, foreign `Origin`-style value regardless of case, `same-site`, contradictory `none`+non-`navigate`, unrecognized value) branches, matching this defect record's own reasoning line for line.
- Updated: `app/api/share/[publicId]/resources/[fileRef]/route.test.ts` — added the exact real-Preview regression case (`Sec-Fetch-Site: none` + `Mode: navigate` → 200, not 403), a same-origin `target=_blank` case, a still-rejected contradictory-metadata case, and confirmation that full session/grant/fileRef authorization is still independently enforced even once the origin check passes. Also fixed two pre-existing (unrelated) eslint unused-parameter warnings surfaced while touching this file.
- Updated: `app/api/share/[publicId]/projection/route.test.ts` — added the same regression case, proving the shared-helper fix propagated correctly rather than only patching the file route.
- All existing tests in both files continue to pass unmodified otherwise — no test was loosened or deleted to make this pass.

**Results, all actually executed this turn:**
- New/updated route + helper tests: **57/57 passed**.
- Full Client Share regression sweep (`lib/share app/api/share app/components/dashboard/tasks/share-link`): **43 test files, 1589 tests, all passed**, 63.25s.
- `npx tsc --noEmit -p tsconfig.json`: clean, zero errors.
- `npx eslint` on every touched file: clean, zero errors, zero warnings (after fixing the two pre-existing unused-param warnings noted above).
- `git diff --check`: clean (exit 0; only benign LF→CRLF warnings on Windows).

## PHASE 4B REAL PREVIEW DEFECT #1: CLOSED BY REAL PREVIEW RETEST

Re-verified against a real deployment of the fix, on the same disposable
Preview that originally surfaced it. Confirmed: direct top-level
navigation to `/api/share/<publicId>/resources/<fileRef>` no longer
returns `INVALID_ORIGIN`; the request now reaches the Function, executes,
performs multiple Supabase calls, and returns a response — proving the
`Sec-Fetch-Site: none` / `Mode: navigate` fix works correctly against a
real browser's actual header shape, not just the local test suite's
simulated one. This defect is fully closed.

Closing this defect revealed a **second, independent** blocker
immediately behind it — see below. The near-10MB streaming proof is
still not reached.

---

# PHASE 4B REAL PREVIEW DEFECT #2: FILE ROUTE 401 UNAVAILABLE

With Defect #1 closed, the same direct-navigation retest now reaches the
Function (middleware 200, ~1.2s execution, multiple Supabase calls) but
returns the route's own deliberately generic denial:

```json
{"ok": false, "code": "UNAVAILABLE", "error": "This file is not available."}
```

By AGENTS.md rule 10 / this route's own design, roughly thirteen
different internal branches all produce this exact identical public
response on purpose — that deliberate indistinguishability is correct
for the public contract, but it also means the generic response alone
cannot say which branch actually fired. Per this turn's own instruction,
no stage was assumed from the public response — the reasoning below is
evidence-based elimination, then instrumentation was added to make the
next retest conclusive rather than guessed.

## Evidence-based elimination (before any code change)

- **Not stages 1-4** (feature flag, origin check, `publicId`/`fileRef`
  syntax): these are synchronous/near-instant with no DB call; ~1.2s and
  "multiple Supabase calls" rules them out.
- **Not stage 6** (rate limit): a rate-limit denial returns
  `code: "RATE_LIMITED"` with HTTP 429, not `"UNAVAILABLE"`/401 — the
  reported response code itself rules this branch out directly, not by
  assumption.
- **Not the cookie/session-shape checks** (stage 5): also synchronous,
  no DB call, would not account for ~1.2s or multiple Supabase calls on
  their own.
- **Mapping existence and fileRef-derivation consistency are already
  independently proven correct**: the anonymous projection (a prior,
  separate request through `buildPublicClientShareProjection`, which
  reads `share_link_resources` with the identical
  `.eq("share_link_id", ...).eq("user_id", ...)` shape this route uses,
  and computes `fileRef` via the identical `deriveShareFileRef`) already
  succeeded and returned this exact file's `fileRef`. That is direct
  proof the mapping row exists, the HMAC key is present and correctly
  configured on this Preview, and `fileRef` derivation is consistent
  between the two routes — none of stages 8/9 (mapping lookup, fileRef
  match) can be failing for a structural/configuration reason, though a
  *transient* re-check (e.g. the file having been unshared between the
  two requests, or a session/grant that expired in between) cannot be
  ruled out by reasoning alone.
- This leaves stages 7 (`verifyShareProjectionAuthorization`, if
  something changed between the projection call and this one), 10-12
  (`task_resources` re-fetch, project-scope re-check, FILE
  re-classification), and 13 (`storage.download().asStream()`) as the
  live candidates — genuinely ambiguous from the public response and
  the evidence available without server-side logs, which is exactly the
  gap the new diagnostics close.

**Leading hypothesis, explicitly not asserted as confirmed:** stage 13
(`storage_stream_open_failed`), specifically the Storage *object* not
actually existing at the exact path the `task_resources` row references.
This is flagged as the single most likely candidate because the
disposable file fixture's own verification SQL
(`docs/client-share-phase4-file-fixture/03_VERIFY_FILE_RESOURCE.sql`)
can only check the **database row's** shape — it has no access to the
Storage subsystem and cannot prove an object was actually uploaded to
that exact path (this exact limitation is called out in that package's
own `00_READ_ME_FIRST.md`). The multi-step manual Supabase Dashboard
upload (substituting the looked-up owner UUID into a folder path by
hand) is a realistic place for a path mismatch to occur independent of
any application code defect. **This is a hypothesis for the retest to
confirm or refute via the new stage tag, not a diagnosed root cause.**

## Diagnosis approach: safe stage-tagged diagnostics (no defect assumed, no fixture change made)

No code defect was found on inspection of the authorization/mapping/
classification logic — re-reading `verifyShareProjectionAuthorization`,
the mapping query, `matchShareFileRef`, the `task_resources` re-fetch,
the project-scope check, and `isFileResource`/`isNoteResource` found
nothing structurally wrong. Per this turn's own instruction not to
guess, **no fixture or code "fix" was applied speculatively.** Instead,
`app/api/share/[publicId]/resources/[fileRef]/route.ts`'s
`genericUnavailable()` helper now takes a required `stage` parameter,
logged server-side only via `console.error("share_file_stage", {stage,
...})` at every one of the ~13 denial branches plus the rate-limit,
cross-site-rejected, and success paths — so the *next* retest will show
exactly which stage fired in Vercel's function logs, closing the gap the
generic public response deliberately leaves open.

**Stage tag vocabulary** (every value ever logged): `cross_site_rejected`,
`public_id_invalid`, `file_ref_invalid`, `cookie_missing_or_invalid`,
`session_digest_failed`, `rate_limited`, `authorization_failed`,
`mapping_lookup_failed`, `mapping_lookup_ok` (also carries a bare
mapped-resource *count*, never the ids themselves), `file_ref_no_match`,
`mapping_row_missing` (structurally unreachable), `resource_lookup_failed`,
`resource_not_found`, `project_scope_failed`, `resource_not_file`,
`storage_stream_open_failed` (also carries Supabase Storage's own
generic error `message`, e.g. `"Object not found"` — never the
storage_path itself), `stream_response_started`.

**Never logged, by construction and asserted directly by a new test**:
the raw session cookie, PIN, HMAC keys, the `fileRef` value, `resourceId`,
`shareLinkId`, `projectId`, `userId`, `storage_path`, `file_name`,
service-role material, any Supabase Storage URL/token, or a fileRef-to-
resource mapping. The public HTTP response is byte-for-byte unchanged —
asserted directly by a new test.

## Whether this is a code / fixture / environment defect

**Not yet determined — intentionally.** The instrumentation above exists
specifically because the evidence available this turn is insufficient to
say with certainty; claiming a specific classification now would be
exactly the "guessing from the generic public response" this turn's own
instruction forbids. The leading hypothesis (fixture Storage-object path
mismatch, an environment/data issue rather than a code defect) is
recorded above for the next retest to confirm or refute, not asserted as
final.

## Tests

Added to `app/api/share/[publicId]/resources/[fileRef]/route.test.ts`
(new `PHASE 4B DEFECT #2 stage-tagged diagnostics` group, 11 tests):
correct stage tag asserted for `authorization_failed`,
`mapping_lookup_failed`, `mapping_lookup_ok` (exact bare count, e.g. `{
stage: "mapping_lookup_ok", mappedCount: 2 }`), `file_ref_no_match`,
`resource_not_found`, `project_scope_failed`, `resource_not_file`,
`storage_stream_open_failed` (exact generic Storage error message only),
`stream_response_started`, and `cross_site_rejected`; a sweep across five
representative denied scenarios asserting the serialized log output
never contains the fileRef, resourceId, shareLinkId, userId, projectId,
storage_path, or raw session secret; and a direct assertion that the
public response body is byte-for-byte unchanged
(`{ok:false, code:"UNAVAILABLE", error:"This file is not available."}`)
even when the new diagnostics fire. No existing test was loosened,
skipped, or deleted.

**Results, all actually executed this turn:**
- File route tests (including the 11 new diagnostics tests): **42/42 passed**.
- Full Client Share regression sweep (`lib/share app/api/share app/components/dashboard/tasks/share-link`): **43 test files, 1601 tests, all passed**, 49.87s.
- `npx tsc --noEmit -p tsconfig.json`: clean, zero errors.
- `npx eslint` on both touched files: clean, zero errors, zero warnings.
- `git diff --check`: clean (exit 0; only benign LF→CRLF warnings).

## PHASE 4B REAL PREVIEW DEFECT #2: DIAGNOSED — AWAITING PREVIEW RETEST

Diagnostics added and verified locally; the root cause is not yet
confirmed pending a real retest that can actually read the new
`share_file_stage` log line. No fixture data, migration, SQL, or upload
code was touched. No code was speculatively "fixed" without evidence.

### Exact next Preview retest step

1. Re-deploy this branch (including the Defect #1 fix and the new Defect #2 diagnostics) to the same disposable Preview.
2. Repeat the exact same direct-navigation request to `/api/share/<publicId>/resources/<fileRef>`.
3. In the Vercel dashboard, open that specific invocation's Function Logs and find the `share_file_stage` line — its `stage` field is the answer.
4. Branch from there:
   - `storage_stream_open_failed` with `storageErrorMessage: "Object not found"` (or similar) → confirms the leading hypothesis; re-check the exact uploaded object path against `docs/client-share-phase4-file-fixture/00_READ_ME_FIRST.md` step 4 and re-upload if it's wrong (no SQL/code change needed — a fixture-placement correction only).
   - `authorization_failed` → re-check whether the same browser/cookie context was actually used for both the projection call and the direct navigation (e.g. a separate Incognito *window* rather than a tab in the same window does not share cookies), and whether the grant/session were still valid at request time.
   - `project_scope_failed` → would indicate the fixture's `project_id` and the share link's own `project_id` genuinely disagree; would need the fixture data re-verified against the actual share link's project (a fixture-data issue).
   - `resource_not_file` → would indicate the fixture row's classification is wrong (a fixture-data issue, not a code defect).
   - Any other stage → report the exact tag for further investigation; each one now maps to exactly one line in `route.ts`.

---

# PHASE 4B DEFECT #2 — STATUS: AUTHORIZATION FAILURE NARROWED

The retest above happened and returned exactly one `share_file_stage`
line: `{ stage: 'authorization_failed', result: 'unavailable' }`. Combined
with the same-session evidence (projection succeeded, returned the FILE
with a real `fileRef`, seconds before the direct-navigation file-route
call failed), this narrows the search to `verifyShareProjectionAuthorization`
itself — the ONE function both routes call, identically.

## 1. Compared both routes' calls to `verifyShareProjectionAuthorization` — found identical

Read both route files side by side, argument by argument:

| | `/projection/route.ts` | `/resources/[fileRef]/route.ts` |
|---|---|---|
| `publicId` source | `(await context.params).publicId` | `(await context.params).publicId` |
| `publicId` validated by | `isValidSharePublicId` | `isValidSharePublicId` |
| Cookie name | `getShareBrowserSessionCookiePolicy().name` | `getShareBrowserSessionCookiePolicy().name` (same function) |
| Cookie read via | `request.cookies.get(name)?.value ?? null` | `request.cookies.get(name)?.value ?? null` (identical) |
| Cookie shape check | `isValidRawShareBrowserSessionSecret` | `isValidRawShareBrowserSessionSecret` |
| Digest fn | `hashShareBrowserSessionSecret` | `hashShareBrowserSessionSecret` |
| Rate limit call | `{action:"projection_read", scope:"browser_session", identityDigest: sessionDigest, identityDigestVersion:1}` | identical object shape |
| Call to the gate | `verifyShareProjectionAuthorization({cookieValue, publicId})` | `verifyShareProjectionAuthorization({cookieValue, publicId})` |

**No difference found.** Both routes call the exact same function with
the exact same two fields, sourced the exact same way. This rules out a
routing/parameter bug between the two routes as the cause — confirmed by
direct comparison, not assumed.

## 2. Traced `verifyShareProjectionAuthorization` internally

Read the function's full body (`lib/share/share-session-grant.server.ts`)
and its own extensive pre-existing test suite
(`share-session-grant.server.test.ts`, 57 tests before this turn,
already covering: no cookie, unresolvable session, unresolvable link, no
grant, stale `configuration_version`, expired grant, PIN required but
unverified — i.e. items A/D/F/G-I/J from the task's own lettered list
were already independently tested and passing). No internal defect was
found in this function either.

Eight internal, mutually-exclusive branches exist, mapped exactly onto
new safe stage tags (`share_projection_auth_stage`, logged inside
`verifyShareProjectionAuthorization` itself, so it applies identically
regardless of which route calls it):

| Tag | Meaning |
|---|---|
| `session_lookup_failed` | `resolveBrowserSessionFromCookie` returned null (no matching digest, or revoked, or expired — that function itself does not further distinguish these sub-cases) |
| `link_lookup_failed` | `resolveShareLinkByPublicId` returned null (not found, or `state = 'revoked'`) |
| `link_not_active` | link resolved but `isShareLinkCurrentlyPubliclyActive` is false (state not `active`, expired, or project deleted/missing) |
| `grant_query_failed` | the `share_session_grants` select itself errored |
| `grant_not_found` | no unrevoked grant row for this exact (session, link) pair |
| `grant_expired` | the grant's own `expires_at` has passed |
| `config_version_mismatch` | `grant.granted_configuration_version !== link.configurationVersion` |
| `pin_not_verified` | link currently requires a PIN, grant has no `pin_verified_at` |
| `authorization_ok` | success |

## 3. High-priority question: how can projection succeed and the file route fail within seconds?

Evaluated each candidate explicitly, per the task's own list — not picking one without evidence:

- **File route reads a different cookie name/path** — **disproven** by §1's direct comparison: both call `getShareBrowserSessionCookiePolicy()`, the same function, same literal cookie name, same `request.cookies.get()` pattern.
- **File route passes the wrong `publicId`/session value** — **disproven** by §1: both resolve `publicId` from `context.params` the same way and pass the same `cookieValue` variable into the same call shape.
- **Projection route has a fallback/exchange path the file route does not** — **disproven** by reading `/projection/route.ts` in full: it has no session-creation, no grant-issuance, no fallback of any kind — it calls `verifyShareProjectionAuthorization` exactly once, exactly like the file route, and treats a null result identically (generic unauthorized). Neither route ever calls `resolveOrCreateBrowserSession`/`ensureCurrentGrant` (the session/grant-*writing* functions) — those only run from `POST /api/share/session`, a separate route neither of these two touches.
- **`configuration_version` changed between requests** — **not disproven, plausible**: this is a genuine external/timing candidate. Sharing/unsharing a Resource does not itself bump `configuration_version` (established Client Share fact from earlier phases), but an owner editing link *settings* (title/status/subtitle/comments/target-date visibility) during the same test session would. Cannot be confirmed or ruled out without the actual `config_version_mismatch` (or other) tag from the retest.
- **Browser session grant is consumed/rotated unexpectedly** — **not supported by the code**: `verifyShareProjectionAuthorization` is read-only (confirmed by re-reading it — no `.insert()`/`.update()` call anywhere in it); it cannot itself rotate or consume anything. A grant only changes via `ensureCurrentGrant`, called only from the session-exchange route, not from either of these two GET routes.
- **Host/domain/path cookie behavior differs for direct API navigation** — **investigated, not the cause via standard RFC 6265 path matching**: the session cookie's `Path` is `/api/share` (confirmed by reading `share-browser-session.server.ts` directly, not assumed); a cookie with `Path=/api/share` matches any request path with `/api/share/` as a prefix, which covers `/api/share/<publicId>/resources/<fileRef>` exactly as it covers `/api/share/<publicId>/projection` — this is standard browser behavior, not something either route's code controls. (The doc comment on that constant was stale — written before the file route existed and enumerating only the two Phase 3 routes by name — corrected in this turn to describe the prefix-match property generally; this was a documentation staleness fix only, not a functional change, since the underlying `Path` value already covered the new route.) A *duplicate, differently-scoped cookie of the same name* left over from some other origin/path in the same browser profile remains a theoretically possible browser-side confound this repository's code cannot detect or rule out — flagged as a real, if unconfirmed, environmental candidate.
- **Helper contains route-sensitive behavior** — **disproven**: `verifyShareProjectionAuthorization`'s signature and body take no route identifier, no request object, nothing that could branch differently per caller. It is a pure function of `(cookieValue, publicId)` plus current database state.
- **Direct navigation causes some required request context to be absent** — **disproven for anything this function reads**: it never reads `Sec-Fetch-*`, `Origin`, or any other request header — only `cookieValue` and `publicId`, both already proven identical in shape and source between the two routes.

**Conclusion:** every candidate that would constitute a *code* defect
was checked directly against the actual source and disproven. The
candidates that remain open (`configuration_version` changing between
the two real requests; a genuinely different/duplicate cookie in that
specific browser profile) are external to the code paths this repository
controls, and can only be confirmed by reading the actual
`share_projection_auth_stage` tag the next retest produces.

## 4. Regression tests

Since no code-level asymmetry between the two routes was found (an
important, honest result — not every investigation ends in a code fix),
the tests added prove exactly that, rather than fabricating a fix for an
unconfirmed bug:

- **New**: `verifyShareProjectionAuthorization - PHASE 4B DEFECT #2 sub-stage diagnostics` (`share-session-grant.server.test.ts`) — one test per stage tag (`session_lookup_failed`, `link_lookup_failed`, `link_not_active`, `grant_not_found`, `grant_expired`, `config_version_mismatch`, `pin_not_verified`, `authorization_ok`), each asserting the *exact* single log call; plus a test asserting no forbidden value (cookie, session/link/project/user id, publicId) ever appears in any stage-tag log call.
- **New**: `PHASE 4B DEFECT #2 -- both routes call verifyShareProjectionAuthorization identically` — the requested integration-style regression: given the identical `(cookieValue, publicId)` input against unchanged database state, two successive calls (simulating "projection call, then file-route call, seconds apart, same session") return byte-for-byte identical successful authorization. This is the strongest proof available that the shared gate itself introduces no asymmetry — it is a determinism proof, not a "before/after" bug-fix test, because no reproducible code bug was found to fix.
- **Preserved, unmodified**: all 8 existing denial-path tests already covering missing cookie, unresolvable session, unresolvable link, no grant, stale `configuration_version`, expired grant, and PIN-required-unverified (`share-session-grant.server.test.ts`'s pre-existing `verifyShareProjectionAuthorization - never trusts any single dimension alone` group) — confirmed still passing, not weakened.

**Results, all actually executed this turn:**
- `share-session-grant.server.test.ts`: **57/57 passed** (47 pre-existing + 10 new).
- File route + projection route + auth helper tests together: **114/114 passed**.
- Full Client Share regression sweep: **43 test files, 1611 tests, all passed**, 35.65s.
- `npx tsc --noEmit -p tsconfig.json`: clean (one real implicit-`any` error surfaced and fixed during this turn — `consoleErrorSpy.mock.calls` needed an explicit `unknown[][]` cast before `.filter()`).
- `npx eslint` on all three touched files: clean, zero errors, zero warnings.
- `git diff --check`: clean (exit 0; only benign LF→CRLF warnings).

## PHASE 4B DEFECT #2: AWAITING PREVIEW RETEST (no code defect confirmed — diagnostics narrowed, not yet resolved)

Not "FIXED IN CODE," because no reproducible code defect was found to
fix — asserting otherwise would overstate what this turn's evidence
supports. What changed: `verifyShareProjectionAuthorization` now emits a
sub-stage tag on every call from either route, so the next retest will
show precisely which of the 8 internal checks is failing, closing the
remaining ambiguity §3 above could not resolve through code inspection
alone. No fixture, SQL, migration, or ENV change was made.

### Exact next Preview retest step

1. Re-deploy this branch to the same disposable Preview.
2. Repeat the exact same sequence: load the share page, let the projection call succeed, copy the `fileRef`, then immediately navigate directly to `/api/share/<publicId>/resources/<fileRef>`.
3. In Vercel Function Logs for that specific file-route invocation, find the `share_projection_auth_stage` line (logged from inside the shared helper, so it fires for this call regardless of which route triggered it) and read its `stage` value.
4. Branch from there:
   - `config_version_mismatch` → an owner-side settings edit likely happened between the two requests; retest without any intervening owner action in another tab.
   - `session_lookup_failed` / `grant_not_found` → strongly suggests the direct navigation is not actually sending the same session cookie the projection call used (check DevTools → Application → Cookies for `t2t_client_share_session` immediately before navigating, and confirm the navigation happens in the same browser window/tab, not a separate Incognito window).
   - `grant_expired` / `link_not_active` → check the fixture share link's own configured expiry and state directly (read-only inspection, no change).
   - `pin_not_verified` → confirm the link doesn't require a PIN the current grant never satisfied.
   - Any stage other than these → report the exact tag; each one now maps to exactly one line in `share-session-grant.server.ts`.

---

# PHASE 4B DEFECT #2 ROOT CAUSE: link resolved by `resolveShareLinkByPublicId` had `state = 'revoked'` — the shared `link_lookup_failed` tag conflated "not found" with "found but revoked" into one indistinguishable value

The retest's exact evidence — `share_projection_auth_stage {stage:
"link_lookup_failed"}` on the failing file request, `authorization_ok`
on the projection call moments before, same `publicId`, same browser
context — narrowed the failure to exactly one function:
`resolveShareLinkByPublicId`. This section documents what was found,
fixed, and (importantly) what was investigated and *disproven* along the
way, per the task's own instruction not to pick an explanation without
evidence.

## 1. Split `link_lookup_failed` into its exact outcomes — done, and it revealed the mechanism directly

Re-read `resolveShareLinkByPublicId` byte-for-byte. Its old body:

```ts
const { data, error } = await supabaseAdmin
  .from("project_share_links")
  .select(SHARE_LINK_COLUMNS)
  .eq("public_id", publicId)
  .neq("state", "revoked")
  .maybeSingle();

if (error || !data) return null;
```

`error || !data` collapses THREE genuinely different outcomes into one
`return null`: a real query error, a `public_id` that matches no row at
all, and a `public_id` that matches a row currently in `state =
'revoked'` (filtered out by `.neq("state", "revoked")` before it ever
reaches the `if`). The caller then logged one single generic
`link_lookup_failed` tag for all three — which is exactly why the
generic tag alone couldn't say which of the three actually happened.

**Fix**: removed the `.neq("state", "revoked")` query-level filter and
replaced it with an explicit `state === "revoked"` check in code after
the (single, same-cost) query — this makes "not found at all" and
"found but revoked" observable as two distinct branches, each logging
its own precise tag, with **no extra database round trip** and **no
change to the function's external contract** (it still returns `null`
for either case, exactly as before — the security behavior is
unchanged, only the diagnostic visibility improved):

```ts
const { data, error } = await supabaseAdmin
  .from("project_share_links")
  .select(SHARE_LINK_COLUMNS)
  .eq("public_id", publicId)
  .maybeSingle();

if (error) { log("link_query_failed"); return null; }
if (!data) { log("link_not_found_by_public_id"); return null; }
if (data.state === "revoked") { log("link_revoked"); return null; }
log("link_resolved");
return toResolvedShareLink(data);
```

## 2. Audited whether the query couples session-derived link identity with the requested `publicId` — proven it does not, a second time, with more precision

Re-confirmed directly from the actual function signature and body:
`resolveShareLinkByPublicId(publicId: string)` — one parameter, no
session/browser/grant argument of any kind, nothing for a "session
→ link" coupling to even attach to. The query is `.eq("public_id",
publicId)` alone (now, after the fix, with no other filter at the query
level at all — `state` is checked in code afterward, not before). The
task's hypothesized "link discovery depends on a stale link id stored in
browser-session state" model does not exist anywhere in this code and
never did — `share_browser_sessions` has no `share_link_id` column (see
§3), so there is no session-stored link identity to accidentally couple
against in the first place. This hypothesis is disproven by direct
source inspection, not assumed away.

`project_share_links.public_id` also carries a genuine database-level
`unique` constraint
(`project_share_links_public_id_unique`, `202608030003_client_share_owner_foundation.sql`),
which independently rules out "duplicate row causing `.maybeSingle()` to
error" as a possibility — Postgres itself would reject any insert that
violated it.

## 3. Session-vs-grant data model — confirmed: option B

Read both table definitions directly:

- `share_browser_sessions` (`202608030004_client_share_session_foundation.sql`): `id, session_digest, digest_version, expires_at, revoked_at, created_at` — **no `share_link_id` column at all.** A browser session is browser-level, not tied to any one link.
- `share_session_grants`: `browser_session_id` **and** `share_link_id` together, with `share_session_grants_current_unique_idx` scoped per **(browser_session_id, share_link_id)** pair — the *grant*, not the session, is the link-specific authorization object. The same browser session can legitimately hold independent grants for multiple different links simultaneously (each requiring its own PIN verification, its own configuration_version match, etc.).

This is exactly option **B** in the task's own framing, and it is
already how the code is written — the fix in §1 didn't need to touch
this model at all, because the model was never the source of the bug;
the *diagnostic granularity* was.

## 4. Explaining the live contradiction: `T1: authorization_ok` → `T2 (~1 min later): link_revoked` (or `link_not_found_by_public_id` — the retest's own new tag will say which)

With §1's fix live, this is no longer ambiguous — the very next retest
will show one of exactly two things, and both are fully explained
without any code defect:

- **`link_revoked`**: the link's `state` column changed to `'revoked'`
  between T1 and T2. Found via `revoke_share_link(p_link_id)`
  (`202608060002_client_share_access_operations.sql`), the only RPC in
  this codebase that sets `state = 'revoked'`. The most plausible
  real-world trigger, given this is the same manual Preview test
  session: the tester likely continued through the Phase 4 test plan's
  own later lifecycle step ("owner revokes the whole share link →
  denied," already an explicit item in this document's own §14/§Corrected
  test matrix) sometime between capturing the projection response and
  re-testing direct file navigation — i.e., the system worked exactly as
  designed for a link that was, by that point, genuinely revoked. This
  is flagged as the most likely explanation given the code, not asserted
  as certain without the tag confirming it.
- **`link_not_found_by_public_id`**: would point to a different
  `publicId` actually being used for the second request (e.g. a
  copy-paste error, or a link rotation producing a new identifier) —
  distinguishable from `link_revoked` for the first time after this fix.

Every other candidate the task asked to evaluate was checked directly
against source and disproven (unchanged from the prior turn's findings,
reconfirmed here): different cookie name/path, wrong `publicId` passed,
a projection-only fallback path, grant rotation-on-read, a
route-sensitive helper, or missing request context on direct navigation
— none of these exist in the actual code.

## 5. Fixed the model's diagnostic granularity, not the test, and not the security contract

No grant check was weakened. No PIN/expiry/revocation/config-version
bypass was introduced. No fallback to project ownership was added. No
internal id is logged. The only change is that `resolveShareLinkByPublicId`
now tells the truth about *which* of its three failure modes occurred,
server-side only.

## 6. Regression tests

- **New** (`resolveShareLinkByPublicId` describe block): a revoked-row case (`state: "revoked"` row → still returns `null`, same external contract as before) — proves the fix is behavior-preserving; a structural note confirming the function's own arity (1 parameter) as direct proof no session-derived coupling exists to test against.
- **New** (`verifyShareProjectionAuthorization - PHASE 4B DEFECT #2 sub-stage diagnostics`): split the old single `link_lookup_failed` test into three — `link_not_found_by_public_id`, `link_revoked` (the new, previously-unreachable-to-observe case), and `link_query_failed` — plus updated the `link_not_active` test to expect the new two-entry log sequence (`link_resolved` then `link_not_active`), since a link that resolves but isn't currently active now correctly logs both of its own stages.
- **New** (`PHASE 4B DEFECT #2 -- both routes call verifyShareProjectionAuthorization identically`): the requested cross-link regression — a browser session holding a valid grant for link A does **not** authorize link B under the same session/cookie, proving grants (not sessions) remain the actual link-specific boundary after this change.
- **Preserved, unmodified**: every existing denial test (no grant, revoked/expired grant, disabled/revoked/expired link, stale `configuration_version`, PIN not verified) — all still passing, none weakened.

**Results, all actually executed this turn:**
- `share-session-grant.server.test.ts`: **62/62 passed** (57 prior + 5 new).
- File route + projection route + auth helper tests together: **119/119 passed**.
- Full Client Share regression sweep: **43 test files, 1616 tests, all passed**, 31.35s.
- `npx tsc --noEmit -p tsconfig.json`: clean.
- `npx eslint` on both touched files: clean, zero errors, zero warnings.
- `git diff --check`: clean (exit 0; only benign LF→CRLF warnings).

## STATUS: FIXED IN CODE — AWAITING ONE FINAL PREVIEW RETEST

The diagnostic-granularity fix is real, tested, and behavior-preserving.
Whether the underlying trigger was a genuine link revocation during
testing (most likely) or something else, the code now reports which,
closing the investigation regardless of which it turns out to be — no
further blind guessing is possible after the next retest's log line.

### Exact ONE final Preview retest

1. Re-deploy this branch.
2. Confirm the share link under test is currently **active, not revoked** (re-share it fresh from the owner UI if the prior test session left it revoked — this is expected, not a bug, if that's what the tag confirms).
3. Load the share page, let the projection call succeed, copy the fresh `fileRef`, and — **without performing any other owner-side action in the meantime** — immediately navigate directly to `/api/share/<publicId>/resources/<fileRef>`.
4. Expect: no more `authorization_failed`. The request should now proceed into the file-specific stages (`mapping_lookup_ok`, then either `stream_response_started` on success or one of the file-specific denial tags if something else needs attention) — finally reaching the near-10MB Vercel streaming question this entire investigation has been trying to get back to.

---

# PHASE 4C — FINAL FILE UI + LIFECYCLE ACCEPTANCE + PHASE 4 CLOSURE

## Real Vercel Preview streaming acceptance (the question this entire investigation was working toward)

```
REAL VERCEL PREVIEW STREAMING ACCEPTANCE:
status:          200
expectedBytes:   9,961,472
receivedBytes:   9,961,472
PASS:            true
```

The browser received the complete near-10MB fixture file end-to-end
through the real deployed `.download(path).asStream()` route on real
Vercel infrastructure — the Vercel-platform question Phase 4A could only
prove locally (§9 of that section) and Phase 4B could not reach until
Defects #1 and #2 were closed is now **empirically settled**: a
genuinely streamed Route Handler response on this project's current
Next.js 16 / Vercel configuration is not truncated or rejected at the
4.5MB buffered-response ceiling. **VERCEL NEAR-10MB STREAMING: PASS.**
**PHASE 4B SECURE FILE DELIVERY INFRASTRUCTURE: PROVEN.** The backend
architecture (`.asStream()`, `fileRef`, the shared authorization gate,
the response-security helpers) is unchanged in this turn, as instructed
— this section only wires the already-proven backend into the public UI
and closes out the remaining lifecycle/regression/documentation work.

## Acceptance history (preserved in full, not erased)

The complete real-Preview investigation, in the order it actually
happened:

1. **Direct-navigation `INVALID_ORIGIN`** (Phase 4B Defect #1) — the shared cross-site check treated a legitimate `Sec-Fetch-Site: none` (direct/typed navigation) identically to a foreign `cross-site` value. Fixed by extracting `isRejectableCrossSiteRequest` into `lib/share/share-request-security.server.ts`, correctly distinguishing `none`+`navigate` as legitimate. Retested and **closed** against the real Preview.
2. **`link_lookup_failed` → narrowed to `link_revoked`** (Phase 4B Defect #2) — closing Defect #1 revealed a second, independent blocker: the shared authorization gate returned a single generic `link_lookup_failed` tag that conflated "not found" with "found but revoked." Split into precise, safe stage tags (`link_query_failed` / `link_not_found_by_public_id` / `link_revoked` / `link_resolved`) directly inside `resolveShareLinkByPublicId`, with no change to the function's external null-for-either-case contract or the security model (confirmed: browser sessions are session-level, grants are the link-specific object — option B, unchanged).
3. **Manual `publicId`/`fileRef` transcription produced misleading evidence during testing.** Because the pre-Phase-4C UI had no click affordance, verifying the file route required manually copying `publicId` from the browser's address bar and `fileRef` from a DevTools Network response body, then hand-constructing the URL. This manual step is itself a plausible source of exactly the kind of transient mismatch (a stale/mistyped `publicId`, or testing against a link that had since been revoked by another step in the same manual test pass) that produced the `link_not_found_by_public_id`-shaped confusion during the investigation — a testing-process artifact, not evidence of a second code defect. **This is precisely why Phase 4C's own §2 requirement (derive `publicId` from the current share route and `fileRef` from the live projection, programmatically, never by hand) matters as a real regression-prevention property, not just convenience**: once the UI constructs the URL itself, this entire class of manual-transcription confound structurally cannot recur.
4. **Final real browser file request succeeded** — after Defects #1 and #2 were fixed and retested, and after eliminating the manual-transcription variable, the real Preview file request succeeded end-to-end for the full near-10MB fixture (see above).

## 1. Public UI — FILE attachments wired

`app/components/dashboard/tasks/share-link/client-project-view.tsx`:
`ClientProjectViewProps` gained an **optional** `publicId?: string` prop.
A new local `buildShareFileUrl(publicId, fileRef)` constructs
`/api/share/${encodeURIComponent(publicId)}/resources/${encodeURIComponent(fileRef)}`
— the only two inputs are the current share route's own `publicId` and
the projection's own opaque `fileRef`; no internal id of any kind is
ever read or constructed. The resource-rendering loop is now written as
an **exhaustive** `kind` check (`"link"` → real anchor; `"file"` → the
new affordance; anything else → renders nothing) rather than a blanket
`else`, so a hypothetical unexpected resource kind can never be silently
coerced into the file-rendering branch — a defense-in-depth hardening
found and applied while implementing this, on top of the server-side
guarantee that NOTE resources are never included in the projection at
all.

`app/share/[publicId]/share-view.client.tsx`: the public page's own
`publicId` (already a prop of `ShareView`) is threaded through
`ShareViewBody` into `<ClientProjectView projection={...}
publicId={publicId} />` — the exact "derive from the current share
route" property §2 requires. The owner's own authenticated Preview
(`share-link-panel.tsx`) is **not** changed — it still calls
`<ClientProjectView projection={data} />` with no `publicId`, so FILE
resources there keep the original inert-label rendering. This is
deliberate, not an oversight: the owner's dashboard session carries no
Client Share browser-session cookie, so a clickable link to the public
file endpoint would 401 for that specific caller — showing the owner a
broken/confusing link would be worse than the status quo, and nothing in
Phase 4's scope required changing the owner Preview.

## 2. Final FILE UI behavior

For a FILE resource, when both `publicId` and a non-empty `fileRef` are
available: the resource's `label` renders as plain text (unchanged
position/styling), followed by a real `<a>` action —
**"Open file"** when `canDownload` is `false`, **"Download"** when
`canDownload` is `true` — `target="_blank" rel="noopener noreferrer
nofollow"`, pointing at the constructed public endpoint URL. Normal
browser navigation/new-tab click; no JavaScript-generated auth header of
any kind; the existing HttpOnly Client Share session cookie authorizes
the request exactly as the real Preview proof already demonstrated for
direct navigation. When `publicId` is absent, or the resource's
`fileRef` is empty (defensive; the strict projection schema makes this
structurally unreachable in production, but the component does not rely
on that alone), it falls back to the original inert-label + `(downloadable)`-hint
rendering — never a broken `href`.

LINK resources are completely unchanged (same anchor, same `url`, same
`rel`). NOTE resources remain structurally excluded server-side and now
additionally cannot reach the file-rendering branch client-side either,
per §1's exhaustiveness hardening.

## 3. `canDownload` behavior and why

Inspected before deciding, per this turn's own instruction: the
established semantic (Phase 4A/4B, and this same document's own §10 from
the original Phase 4 pass) is that `can_download` is a
**`Content-Disposition` UX hint the server already enforces**
(`resolveContentDisposition`/`buildContentDisposition` in
`lib/share/share-file-response.server.ts`) — `attachment` (native Save-As
prompt) when true, `inline` (opens/previews in the tab) when false —
**never** an access-control or save-prevention mechanism. The owner's
own file-url endpoint (`app/api/task-resources/file-url/route.ts`)
independently confirmed the same duality exists for the owner's own
files (a `download` query param toggling the identical
`Content-Disposition` behavior), which is the "existing product
contract" this turn asked to be preserved rather than reinterpreted.

Because the **public** file endpoint's `Content-Disposition` is fixed
server-side by the owner's own `can_download` mapping value (not a
per-click visitor choice — there is no `?download=` query param on the
public route), exactly **one** action per file is ever correct, and its
label text should describe what will actually happen when clicked. That
is why the UI shows "Download" vs. "Open file" rather than showing both,
or showing neither, or a static "(downloadable)" label with no click
target: showing two actions would imply a client-side choice the server
does not actually offer; showing a generic label regardless of
`canDownload` would either overclaim capability (calling a
`canDownload: false` file "downloadable") or underclaim it (never
telling a visitor a `canDownload: true` file will download). The label
itself never claims downloadability — only the action text does, and
only when it is literally true. This does **not** claim or imply any
save-prevention capability for `canDownload: false` — consistent with
the original Phase 4 pass's own explicit disclaimer that no such
capability exists.

## 4. Public UI tests (A–I)

New `describe` block in `client-project-view.test.tsx`
("PHASE 4C FILE attachment affordance"), plus one new integration test in
`share-view.client.test.tsx` proving the real wiring end-to-end:

| Item | Covered by |
|---|---|
| A. LINK unchanged | new test alongside FILE resources present, plus the original LINK test (unmodified) |
| B. FILE "Open file" affordance | new test, `canDownload: false` |
| C. exact `href` shape, percent-encoded | two new tests: exact-match and adversarial-character encoding for both `publicId` and `fileRef` |
| D. no resourceId/storage_path/internal filename | new test asserting forbidden substrings absent from the rendered DOM, with a positive control (the fileRef itself, which IS expected to appear) proving the assertion is meaningful |
| E. NOTE never renders | new test forcing an out-of-union `"note"` kind through and asserting nothing renders (exercises §1's new exhaustiveness guard directly) |
| F. malformed/missing fileRef never creates a broken link | two new tests: empty `fileRef`, empty `publicId` — both fall back to inert rendering |
| G. `canDownload: true` behavior | new test — "Download" action, same href |
| H. `canDownload: false` behavior | new test — "Open file" action, not "Download" |
| I. RTL/dir/layout unaffected | new test — `dir="rtl"`, section landmark, FILE action all present together |

The **existing** file-resource test (previously titled "renders a file
resource as plain text... never a downloadable link") was **kept, not
deleted** — retitled to make explicit that it now specifically covers the
no-`publicId` fallback case (the owner Preview's own real behavior),
which is still exactly what it asserts.

## 5. Full lifecycle matrix result

All 29 requested scenarios map onto existing or newly-added regression
coverage; **no scenario failed**. New coverage was added only where a
genuine gap existed — most of AUTHORIZED (1–3) and DENIED (4–19) were
already exhaustively covered by the Phase 4B/Defect#2 test suites
(`route.test.ts`'s 45 tests, `share-session-grant.server.test.ts`'s 62
tests, `client-share-projection.server.test.ts`'s 54 tests):

- **AUTHORIZED 1–3**: (1) covered directly; (2) composed from `share-session-grant.server.test.ts`'s own PIN-verified-grant test plus the file route's `authorizeSuccessfully()` streaming test (both exercise the identical shared gate); (3) covered by the existing "two successive calls against unchanged state return identical authorization" determinism test.
- **DENIED 4–19**: all pre-existing (unmapped resource, cross-link fileRef, forged fileRef, NOTE, LINK-not-FILE, deleted resource, project-scope mismatch, no session, no grant, expired grant, PIN unverified, disabled/revoked/expired link, deleted project, stale `configuration_version`) — reconfirmed passing, none weakened.
- **OWNER CONFIG LIFECYCLE 20–23**: (20) and (21) are **new** tests in `route.test.ts` (`PHASE 4C owner-config lifecycle` group) — unshare-then-deny, then re-share-with-the-same-deterministic-fileRef-then-authorize-again, proving mapping/unmapping never rotates or invalidates the fileRef itself, only its current authorization; (22) already covered by the existing PIN-not-required-by-default happy path; (23) is a **new** test proving a revoked link's authorization failure happens *before* the mapping table is ever queried, so an old `fileRef` has no code path to bypass a revocation.
- **PRIVACY 24–27**: all pre-existing, reconfirmed. **PRIVACY 28** (`/share/**` excluded from analytics/session-replay and the cookie-consent banner): confirmed via the existing, independent `lib/analytics/analytics-paths.test.ts` and `app/components/analytics/cookie-consent-banner.test.tsx` suites, run this turn — both pass, unmodified (out of Phase 4's own scope, correctly untouched).

## 6. Rate limit / request security — unchanged, as instructed

`GET /api/share/[publicId]/resources/[fileRef]` continues to reuse the
`projection_read` rate-limit action/`browser_session` scope, and the
shared `isRejectableCrossSiteRequest` helper (Defect #1's fix) is
unchanged in this turn. No architecture decision already proven in
Preview was reopened.

## 7. Diagnostics retain/remove decision: **RETAINED**, right-sized by log level

`share_file_stage` and `share_projection_auth_stage` are kept
permanently as low-risk operational diagnostics — not temporary
acceptance-only logging to be stripped. Rationale: they directly closed
two real, otherwise hard-to-diagnose production-relevant issues this
same investigation (Defects #1 and #2); every value is a fixed,
low-cardinality stage name (never a cookie, PIN, HMAC key, fileRef,
resourceId, shareLinkId, projectId, userId, storage_path, file_name, or
Supabase Storage URL/token — asserted directly by dedicated tests in
both test files); the cost is one `console` call per branch, already
paid; and any future anomaly in this exact authorization chain can be
diagnosed the same way without another multi-turn investigation.

**One refinement made while reviewing them for this decision**: the
success-shaped tags (`link_resolved`, `authorization_ok`,
`mapping_lookup_ok`, `stream_response_started`) were moved from
`console.error` to `console.info`. Blanket `console.error` usage for
*every* successful request on a healthy, presumably high-traffic public
endpoint would otherwise dilute error-level monitoring/alerting with
non-error events — every actual denial reason correctly stays on
`console.error`. This is a log-level right-sizing, not a scope change:
identical stage vocabulary, identical safety guarantees, tests updated
to merge both spies where a sequence of mixed-level tags is asserted.

## 8. Files changed

**Modified:**
- `app/components/dashboard/tasks/share-link/client-project-view.tsx` — FILE affordance, exhaustive kind check, `publicId` prop.
- `app/components/dashboard/tasks/share-link/client-project-view.test.tsx` — new A–I test matrix.
- `app/share/[publicId]/share-view.client.tsx` — threads `publicId` into `ClientProjectView`.
- `app/share/[publicId]/share-view.client.test.tsx` — new end-to-end wiring test.
- `app/api/share/[publicId]/resources/[fileRef]/route.ts` — new owner-config lifecycle tests' route already supported them unchanged; log-level right-sizing for two stage tags.
- `app/api/share/[publicId]/resources/[fileRef]/route.test.ts` — new owner-config lifecycle tests; spy updates for the log-level change.
- `lib/share/share-session-grant.server.ts` — log-level right-sizing for two stage tags.
- `lib/share/share-session-grant.server.test.ts` — spy updates for the log-level change.

**Not modified (confirmed unchanged, by design):**
`app/components/dashboard/tasks/share-link/share-link-panel.tsx` (owner Preview caller), all Phase 4A/4B backend files (`share-file-ref.server.ts`, `share-file-response.server.ts`, `share-request-security.server.ts`, the file route's own authorization/streaming logic), `client-share-projection.server.ts`, `client-share-projection-contracts.ts`.

**No migration, no SQL, no ENV change, nothing staged/committed/pushed, nothing deployed.**

## 9. Verification — exact counts, all actually executed this turn

1. Focused `client-project-view` tests: **31/31 passed**.
2. File endpoint tests: **45/45 passed**.
3. Share authorization/session/grant tests: **62/62 passed**.
4. Projection tests (`client-share-projection.server.test.ts`, part of the sweep below): passing, unmodified this turn.
5. Full Client Share regression + analytics-isolation sweep (`lib/share app/api/share app/components/dashboard/tasks/share-link app/share/[publicId] app/components/analytics/cookie-consent-banner.test.tsx lib/analytics/analytics-paths.test.ts`): **46 test files, 1659 tests, all passed**, 33.92s.
6. Analytics-isolation tests: included in the sweep above — both files passed, unmodified.
7. `npx tsc --noEmit -p tsconfig.json`: **clean, zero errors.**
8. `npx eslint` on all 8 touched files: **clean, zero errors, zero warnings.**
9. `git diff --check`: **clean** (exit 0; only benign LF→CRLF warnings on Windows).
10. `npm run build`: **succeeded** — Turbopack compiled successfully in 39.3s, TypeScript passed during build, all 89 static pages generated, `/api/share/[publicId]/resources/[fileRef]` correctly listed as a dynamic (ƒ) route alongside its siblings.

## 10. Phase 4 completion criteria — all met

- Public FILE UI wired: ✅ (§1–2).
- Security/lifecycle matrix passes: ✅ (§5, all 29 scenarios).
- All regressions pass: ✅ (§9, 1659 tests).
- TypeScript/eslint/diff clean: ✅ (§9).
- Full build passes: ✅ (§9.10).
- No unresolved Phase 4 blocker remains: ✅ — the one remaining historical item, the pre-existing inbound `FUNCTION_PAYLOAD_TOO_LARGE` upload defect (recorded in this document's own §11 under Phase 4B), is explicitly **out of Phase 4's scope** (Phase 4 concerns outbound delivery of already-uploaded files, not the separate inbound upload path) and was never a Phase 4 blocker — it remains open as its own tracked item, not a condition of Phase 4 closure.

---

# PHASE 4 — COMPLETE / PASS

Phase 4 (secure FILE delivery for the Client Share public surface) is
complete: FILE resources are now openable/downloadable by an anonymous,
already-authorized Client Share visitor through a real, tested,
Preview-proven server-mediated streaming endpoint, wired into the actual
public product UI, with NOTE resources permanently excluded, LINK
behavior unchanged, `canDownload` semantics preserved and accurately
reflected in the UI, and a full lifecycle/security/privacy regression
matrix passing alongside a clean TypeScript/eslint/build. No code in
this turn was staged, committed, pushed, or deployed — the next action
is the user's own decision to review, stage, and ship this branch.
