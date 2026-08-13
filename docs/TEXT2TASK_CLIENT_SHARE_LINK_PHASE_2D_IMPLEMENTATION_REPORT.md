# Text2Task — Client Share Link — Phase 2D Implementation Report

**Strict Owner Preview Projection + Preview UI**

Status at completion: **PHASE 2D — COMPLETE AND VERIFIED** (implementation, final acceptance review addendum §25, and user-run Production Build evidence §26). Phases 0–2C remain closed and were not reopened. Phase 3 was not started.

---

## 1. Files created

- `lib/share/client-share-projection-contracts.ts` — the strict, purpose-built Zod projection contract (`ClientProjectProjection` and all nested types), plus the `previewShareLinkResponseSchema` envelope.
- `lib/share/client-share-projection.server.ts` — `buildClientShareProjection(supabase, { linkId, userId })`, the one server-only projection builder.
- `lib/share/client-share-projection.server.test.ts` — 33 tests covering authorization boundary, visibility gating, safe status mapping, progress, task projection, resource projection, latest update, and the mandatory toxic-fixture privacy test.
- `app/api/share-links/[id]/preview/route.ts` — `GET`, the authenticated owner Preview endpoint.
- `app/api/share-links/[id]/preview/route.test.ts` — 17 tests covering the feature gate, validation, authentication, projection outcomes, no-side-effect guarantees, and no-store headers.
- `app/components/dashboard/tasks/share-link/client-project-view.tsx` — the one reusable presentational `ClientProjectView` component.
- `app/components/dashboard/tasks/share-link/client-project-view.test.tsx` — 19 tests covering privacy, empty states, LTR/RTL, header visibility, progress, latest update, task groups, resources, and semantic structure.

## 2. Files modified

- `app/components/dashboard/tasks-view.tsx` — wired `onOpenPreview`/`onClosePreview` into `<ShareLinkPanel>`.
- `app/components/dashboard/tasks/share-link/share-link-channels.tsx` — added the always-visible `Preview` button; removed the early-return that previously hid this component entirely for non-revealable, non-rotatable states (draft/expired), since Preview must remain available there.
- `app/components/dashboard/tasks/share-link/share-link-channels.test.tsx` — added `onOpenPreview` to test fixtures; updated the "expired" test to assert Preview renders while Copy/Share/WhatsApp/Rotate do not (previously asserted an empty container, which is no longer the correct behavior).
- `app/components/dashboard/tasks/share-link/share-link-client.ts` — added `previewShareLink(linkId)` client-side fetch wrapper.
- `app/components/dashboard/tasks/share-link/share-link-panel.tsx` — added `previewOpen`-gated structural branch rendering `PreviewView`/`ClientProjectView` in place of (never alongside) the normal management sections.
- `app/components/dashboard/tasks/share-link/share-link-panel.test.tsx` — added `previewOpen`/`previewData`/`onOpenPreview`/`onClosePreview` to test fixtures.
- `app/components/dashboard/tasks/share-link/use-share-link.ts` — added `previewOpen`/`previewData` state, `openPreview`/`closePreview` actions, and `"preview"` to `ShareLinkActionKind`.

No other files were modified. No file outside the Client Share feature area was touched.

## 3. Strict projection contract

`ClientProjectProjection` (`.strict()` at every level, independently declared — never `Pick<Project>`/`Pick<Subtask>`/`Pick<TaskResource>`/`Pick<ManagedShareLink>`):

```
title: string | null                 // only when titleVisible
subtitle: string | null              // clientFacingSubtitle, whenever set
status: "not_started"|"in_progress"|"completed" | null   // only when statusVisible
targetDate: string | null            // only when targetDateVisible
contentDirection: "auto"|"ltr"|"rtl"
commentsEnabled: boolean
progress: { completed, total, percent } | null   // null when zero shared tasks
latestUpdate: { body, publishedAt } | null
tasks: Array<{ title, publicGroup, waitingForClientFeedback }>
resources: Array<
  { kind: "file", label, canDownload } |
  { kind: "link", label, url }
>
```

## 4. Explicit private data excluded

Never read or returned by this module: amount, priority (including "Urgent"), client phone/email/notes, raw input, source message text, extraction metadata, internal project notes, private Resource notes, storage paths, signed URLs, bucket names, internal timeline events, analytics events, owner user ID, project UUID, share-link UUID, subtask UUIDs, Resource database IDs, hidden/total task counts, unmapped task/Resource data, PIN hash, token digest, encrypted secret material, share secret, and the full owner-management object. Verified by the toxic-fixture test (§10) and by every `.strict()` Zod boundary rejecting unknown keys.

## 5. Server data sources and scoping

1. `project_share_links` — one bounded `select("project_id")`, scoped to `id = linkId AND user_id = callerId AND state <> 'revoked'`, `.maybeSingle()`. Translates the trusted link id into a project id; revoked links are structurally excluded here.
2. `public.get_share_link_management_state` RPC (existing, unmodified, called via the existing `getShareLinksRepository.server.ts`'s `getShareLinkManagementState`) — supplies `link` (with `titleVisible`/`statusVisible`/`targetDateVisible`/`commentsEnabled`/`clientFacingSubtitle`/`contentDirection`), the complete structured `mappedTasks`/`mappedResources` (Phase 2B's corrective metadata), and `currentUpdate`.
3. `projects` — bounded `select("title, status, deadline_date")`, scoped to `id = projectId AND user_id = callerId AND deleted_at IS NULL`.
4. `tasks` — bounded `select("id, task_title")`, scoped to `project_id = projectId AND user_id = callerId AND deleted_at IS NULL AND id IN (mapped subtask ids)`. Only queried when there is at least one mapped task.
5. `task_resources` — bounded `select("id, url, storage_path, file_name, resource_type")`, scoped to `project_id = projectId AND user_id = callerId AND id IN (mapped resource ids)`. `storage_path`/`file_name` are read only to classify file-vs-link (`isFileResource`/`isLinkResource`/`isNoteResource`, reused unmodified from `resource-api.ts`) and are never included in the returned projection.

No `select("*")` anywhere. No new RPC, no new migration, no service-role client, no weakening of RLS, no `anon` grants.

## 6. Safe status mapping

```
New         -> not_started
In Progress -> in_progress
Review      -> in_progress
Done        -> completed
(anything else, including "Urgent") -> null (fails closed, omitted)
```

`priority` is never read by this module at all, so "Urgent" cannot reach this map through any path.

## 7. Progress calculation

Computed only from the mapped tasks that actually resolved to a real, non-deleted task. `completed` = count with `publicGroup === "completed"`; `total` = resolved mapped task count; `percent = round(completed/total*100)`. Zero resolved tasks → `progress: null` (never a fabricated `0/0`, never derived from any internal project-wide count, which this module never queries).

## 8. Task projection

Only mapped tasks that resolved to a real task row appear; each entry carries only `title`, the persisted `publicGroup`, and the persisted `waitingForClientFeedback` — both taken directly from the owner-curated share mapping, never inferred from internal task status. A mapped task that no longer resolves (soft-deleted) is silently omitted (fail-closed disappearance, never a placeholder).

## 9. Resource projection

Only mapped resources that resolved appear. Note Resources are excluded outright (`classifyResource` checks `resource_type === "note"` first). File resources return `{ kind: "file", label: publicLabel, canDownload }` — no storage path, no signed URL, no file name/mime/size. Link resources return `{ kind: "link", label: publicLabel, url }` using the owner-approved external URL only, **after** it passes the server-side URL scheme allowlist (§25.2) — a mapped link resource whose URL is unsafe or malformed is omitted entirely, exactly like any other resource that fails to resolve. A mapped resource that no longer resolves is silently omitted.

## 10. Latest-update projection

Only `currentUpdate` from `get_share_link_management_state` (the latest explicitly published `share_link_updates` row) is used — `{ body, publishedAt }` only, dropping `version`. Project Timeline and Client Update analysis/history are never read by this module.

## 11. Preview endpoint and authorization behavior

`GET /api/share-links/[id]/preview`:
1. `assertClientShareEnabled()` — fails closed to 404 before any DB work when the feature flag is off.
2. Validates `id` as a UUID (400 on failure).
3. `supabase.auth.getUser()` — 401 if unauthenticated.
4. `buildClientShareProjection(supabase, { linkId, userId })` — the link lookup itself is owner-scoped (`user_id = caller`), so a cross-tenant owner receives `SHARE_LINK_NOT_FOUND`/`UNAUTHORIZED` → mapped to 401/404, never leaking existence of another owner's link.
5. Success returns `{ ok: true, data: <strict projection> }` only.

Available for every non-revoked link state (draft/active/disabled/expired) — Preview is a configuration-inspection capability, not public access, and never calls `reveal_share_link_secret`.

## 12. Confirmation: Preview has no view/activity side effects

The route imports only `buildClientShareProjection` from the share layer — no reveal, rotate, activate, or any view-count/`last_viewed_at` mutation function is imported or reachable from this route. `buildClientShareProjection` itself only performs `select`s (never an `update`/`insert`) and calls the existing read-only `get_share_link_management_state` RPC. No `share_page_viewed` (or any) analytics event is emitted. No anonymous session or token exchange occurs. Verified by dedicated route tests (§14).

## 13. Reusable client-view component

`ClientProjectView({ projection: ClientProjectProjection })` — the sole prop is the strict projection type. It receives no `Project`, `projectId`, `userId`, `ManagedShareLink`, raw Resources, raw subtasks, or secret, and has no data-fetching of its own. It is rendered unchanged by Phase 2D's owner Preview (inside `ShareLinkPanel`'s structural `previewOpen` branch, never mixed with dashboard/private controls) and is intended for direct reuse, unmodified, by Phase 3's future public route.

## 14. RTL behavior

`dir` is set on the component's root element to `projection.contentDirection` **exactly**, with no conditional omission: `"auto"` → `dir="auto"`, `"ltr"` → `dir="ltr"`, `"rtl"` → `dir="rtl"`. All three are set explicitly (see §25.1 — the original implementation omitted the attribute for `"auto"`, which was corrected in the final acceptance review since an omitted attribute can inherit direction from an ancestor rather than being genuinely auto). Explicit tests confirm all three exact DOM values, plus correct rendering of Hebrew title/task content under `dir="rtl"` (`client-project-view.test.tsx`).

## 15. Toxic-fixture privacy test result

`lib/share/client-share-projection.server.test.ts`'s "MANDATORY toxic fixture" test builds a fixture with sentinel values for amount, raw input, client email/phone, private notes, an **unshared** task with a sensitive title, and an **unshared** Resource with a sensitive file name/storage path/note, plus the literal string `"Urgent"`, the project UUID, the owner user ID, and the link UUID. It serializes the resulting projection to JSON and asserts none of these sentinels appear anywhere in the output, and separately asserts only the deliberately shared task/resource made it through. **Result: PASSED.**

## 16. Targeted test commands and results

```
npx vitest run app/components/dashboard/tasks/share-link lib/share app/api/share-links
```
→ **29 test files passed, 1304 tests passed** (updated after the final acceptance review's addendum in §25 added 10 URL-safety tests and revised the direction tests; see §25.4 for the exact delta).

Individually (post-acceptance-review counts):
- `lib/share/client-share-projection.server.test.ts` — 43/43 passed (33 original + 10 new URL-safety tests, §25.4).
- `app/api/share-links/[id]/preview/route.test.ts` — 17/17 passed (unchanged — no Cache-Control code change was needed, §25.3).
- `app/components/dashboard/tasks/share-link/client-project-view.test.tsx` — 19/19 passed (one direction test rewritten, one rel-token assertion strengthened; count unchanged).
- `app/components/dashboard/tasks/share-link/share-link-channels.test.tsx` — all passed after updating the one test whose expected behavior changed (Preview button now always renders).
- `app/components/dashboard/tasks/share-link/share-link-panel.test.tsx` — all passed.
- All prior Phase 2A/2B/2C tests — all passed (no regressions).

## 17. TypeScript result

```
npx tsc --noEmit -p tsconfig.json
```
→ **Exit code 0. Zero errors**, across the full repository.

## 18. `git diff --check`

→ **Exit code 0.** No whitespace errors.

## 19. `git status --short`

```
 M app/components/dashboard/tasks-view.tsx
 M app/components/dashboard/tasks/share-link/share-link-channels.test.tsx
 M app/components/dashboard/tasks/share-link/share-link-channels.tsx
 M app/components/dashboard/tasks/share-link/share-link-client.ts
 M app/components/dashboard/tasks/share-link/share-link-panel.test.tsx
 M app/components/dashboard/tasks/share-link/share-link-panel.tsx
 M app/components/dashboard/tasks/share-link/use-share-link.ts
?? app/api/share-links/[id]/preview/
?? app/components/dashboard/tasks/share-link/client-project-view.test.tsx
?? app/components/dashboard/tasks/share-link/client-project-view.tsx
?? lib/share/client-share-projection-contracts.ts
?? lib/share/client-share-projection.server.test.ts
?? lib/share/client-share-projection.server.ts
```

Nothing outside the Client Share feature area is dirty.

## 20. Migration status

**No migration was created.** Every field the projection needs is already reachable from existing, unmodified data access: `get_share_link_management_state` (Phase 1C/2B's existing RPC) plus ordinary bounded `.select()` reads against `projects`/`tasks`/`task_resources` through the same RLS-bound client pattern already used elsewhere in the app (e.g. `lib/tasks/load-dashboard-tasks.server.ts`). This matches the pre-Phase-2 mapping summary's explicit prediction that Phase 2D requires no migration.

## 21. Confirmation: no SQL/Supabase/Production access

No SQL was written or executed. No Supabase migration, RPC, or RLS policy was created or modified. No Production system was accessed.

## 22. Confirmation: feature flag remains disabled

`TEXT2TASK_CLIENT_SHARE_ENABLED` was not touched in any non-test file. The Preview route calls `assertClientShareEnabled()` first, same as every other Client Share route, and fails closed to 404 when the flag is off (verified by a dedicated test).

## 23. Confirmation: no Build/stage/commit/push/deploy (by the assistant)

No `git add`, `git commit`, `git push`, or production build was run by the assistant at any point during implementation or the final acceptance review. All changes remained as uncommitted working-tree modifications for the user's own review. The user subsequently ran the Production Build independently — see §26 for that evidence, recorded here as authoritative user-supplied evidence, not as a Build run by the assistant.

## 24. Confirmation: Phase 3 not started

No public `/share` route was created. No anonymous session or token-exchange route was created. No signed-URL generation, comment submission, or branding schema was added. `buildClientShareProjection` and `ClientProjectView` are built to be reused unchanged by a future Phase 3, but Phase 3 itself was not begun.

---

## 25. Final acceptance review addendum

A narrow final acceptance review (after a power-loss recovery audit confirmed the implementation above was intact and unmodified, HEAD still at `8cb91a7`) corrected three specific items before Phase 2D could be marked accepted. Nothing else in this report changed.

### 25.1 contentDirection — exact `dir` value

`app/components/dashboard/tasks/share-link/client-project-view.tsx`: the root element now sets `dir={projection.contentDirection}` directly — `"auto"` → `dir="auto"`, `"ltr"` → `dir="ltr"`, `"rtl"` → `dir="rtl"`. The previous implementation omitted the attribute for `"auto"`; an omitted attribute can inherit direction from an ancestor element instead of being genuinely auto, so the attribute is now always set explicitly. `client-project-view.test.tsx` was updated: the test that previously asserted no `dir` attribute for `"auto"` now asserts `dir="auto"` is present.

### 25.2 External URL security boundary

`lib/share/client-share-projection.server.ts` adds `toSafeExternalClientUrl(value: string | null): string | null` (private to the module) — the enforcement point sits in the projection builder itself, before a URL can ever reach `ClientProjectProjection`, not in the React component and not relying on write-time Resource validation. It parses the candidate value with the platform `URL` constructor (never a regex/substring check, which can be evaded by variants like `\tjavascript:` or `JaVaScRiPt:`) and allowlists only `parsed.protocol === "http:" || parsed.protocol === "https:"`. Any other scheme, or a value that throws during `URL` parsing (malformed/non-absolute), returns `null`. In the resource-building loop, a `null` result means the mapped link resource is **omitted from the projection entirely** — the same fail-closed "disappears" behavior already used for a mapped task/resource that no longer resolves — never a stripped or partially-sanitized fallback URL. No normalization, no server-side fetch, no redirect-following, no preview generation.

Allowed schemes: `http:`, `https:`. Rejected (non-exhaustive, tested explicitly): `javascript:`, `data:`, `file:`, `vbscript:`, mixed-case (`JaVaScRiPt:`), whitespace-prefixed (`\tjavascript:`), and non-absolute/malformed strings (`"not-a-url"`).

The projection contract (`clientProjectLinkResourceSchema`) was left as `url: z.string()` — filtering is enforced at the builder, which the task's acceptance criteria treats as the mandatory boundary; the contract was not coupled to internal Resource types.

### 25.3 Preview Cache-Control — verified, not changed

`app/api/share-links/[id]/preview/route.ts` was inspected and left unmodified: it already sets `Cache-Control: private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0` plus `Pragma: no-cache` and `Expires: 0` on every response branch (400/401/404/500/200), which already contains the required `private` and `no-store` directives. Per the acceptance instructions, this was treated as acceptable and not narrowed or rewritten. Existing route tests already assert `private`/`no-store` across every response branch (400/401/404/500/200) — no test changes were needed here.

### 25.4 Test delta from this addendum

- `lib/share/client-share-projection.server.test.ts`: +10 tests in a new `"external URL safety (server-side scheme allowlist)"` describe block — 7 unsafe/malformed-URL cases each asserting the resource is omitted and the raw URL never appears in the serialized JSON, 2 safe-scheme cases (`http:`/`https:`) asserting the resource is kept, and 1 dedicated "never exposed even as a fallback" toxic-URL test. 33 → 43 tests, all passing.
- `app/components/dashboard/tasks/share-link/client-project-view.test.tsx`: 1 test rewritten (no-attribute → `dir="auto"` assertion), 1 test strengthened with explicit per-token `rel` assertions (`noopener`/`noreferrer`/`nofollow` checked individually, order-independent). Count unchanged at 19.
- The mandatory toxic-fixture privacy test (§15) was left untouched and still passes.

### 25.5 Files touched by this addendum only

- `app/components/dashboard/tasks/share-link/client-project-view.tsx` (production code — `dir` fix)
- `app/components/dashboard/tasks/share-link/client-project-view.test.tsx` (tests)
- `lib/share/client-share-projection.server.ts` (production code — URL allowlist)
- `lib/share/client-share-projection.server.test.ts` (tests)
- This file (documentation)

No other file from the original Phase 2D file list (§1, §2) was touched by this addendum.

---

## 26. User-run Production Build evidence

After the implementation (§1–§24) and the final acceptance review addendum (§25) were both complete on disk, the user independently ran the Production Build — this step was performed by the user, not by the assistant, consistent with the standing rule that only the user runs the Production Build.

Command: `npm run build`

Result: **PASS**

- Next.js: `16.1.6` (Turbopack)
- Compiled successfully in **36.7s**
- TypeScript Build phase finished successfully in **26.8s**
- Page data collection: succeeded
- Static generation: succeeded, **89/89 pages**
- Final page optimization: succeeded
- No Build errors

Route table evidence:
- `/api/share-links/[id]/preview` is present in the generated route table, confirming the Phase 2D owner Preview endpoint builds and is registered correctly.
- No public `/share` route exists in the route table — correct for Phase 2D, since public access is explicitly out of scope until Phase 3.

Summary carried forward from the implementation and acceptance review, reconfirmed consistent with this Build:
- Final targeted tests: **1304/1304 PASS**, 29 test files (§16, §25.4).
- TypeScript: **PASS**, zero errors (§17).
- Final acceptance review: **PHASE 2D FINAL ACCEPTANCE: FIXED AND PASS** (§25) — `contentDirection="auto"` renders explicit `dir="auto"` (and `ltr`/`rtl` render explicitly too, §25.1); external link projection allows only `http:`/`https:`, with `javascript:`/`data:`/`file:`/`vbscript:`/malformed URLs failing closed (§25.2); valid client links retain `target="_blank"` and `rel="noopener noreferrer nofollow"`; Preview `Cache-Control` remains explicit `private` + `no-store` (§25.3, unchanged).
- No migration was created at any point (§20).
- No SQL, Supabase, or Production system access occurred at any point (§21).
- `TEXT2TASK_CLIENT_SHARE_ENABLED` remains disabled by default (§22).
- Phase 3 has not started (§24).

With this Build result recorded, the only remaining Phase 2D action is the **user's own Git checkpoint commit** — no further code, test, or documentation work is outstanding for Phase 2D.

---

# PHASE 2D — COMPLETE AND VERIFIED
