# Text2Task Client Share Link — Phase 2A Implementation Report

## Phase 2A — Feature-Gated Owner Integration + Management Shell

**Status: FINAL ACCEPTANCE PASS.** Ready to be checkpointed (staged and
committed). Not yet staged, not committed, not pushed, not deployed. No
migration. Production not accessed, not modified, not enabled.

**Build history**: the user-run full production Build first passed
(Next.js 16.1.6, TypeScript PASS, static generation 89/89 PASS) against
the pre-acceptance-review code. A final acceptance review then found and
fixed one genuine defect (§7 below — a double-submission reentrancy gap
in `useShareLink`'s `runAction`), requiring the Build to be rerun. **The
user has since reran the full production Build after that correction,
and it passed again**: Next.js 16.1.6 (Turbopack) compiled successfully,
TypeScript PASS, static generation 89/89 PASS. `git status --short`
before and after that second Build contained the same Phase 2A
working-tree file set — the Build created no new source changes.
**Phase 2A final acceptance: PASS.**

---

## 1. Scope Implemented

- A neutral, server-side Client Share availability gate, checked first in
  every existing `app/api/share-links/**` route.
- A matching UI visibility gate threaded server→client from
  `app/dashboard/page.tsx` down to the project card components.
- A "Share with client" entry point on both the desktop and mobile
  project cards, in the existing expanded-project action row.
- A dedicated management shell (`ShareLinkPanel`), built on the shared
  `ResponsiveDialog` primitive, covering: management-state read, create
  draft, activate, copy link (via reveal), disable, re-enable, revoke.

No Phase 1C schema change, no task/Resource configuration, no
subtitle/comments/direction editor, no PIN/expiry/rotation UI, no
Preview, no public `/share` route, no anonymous/session exchange, and no
Free/Pro pricing entitlement logic were implemented — all explicitly out
of scope per the accepted Pre-Phase-2 mapping summary.

---

## 2. Lifecycle State Coverage (verified against the actual Phase 1B contract)

The owner-management read contract's type
(`managedShareLinkStateSchema` in `lib/share/share-contracts.ts`) is
`"draft" | "active" | "disabled" | "expired"`.

- **`expired`**: the type allows it, but no delivered Phase 1B RPC
  currently writes it. `supabase/migrations/202608030003_client_share_owner_foundation.sql`'s
  own index comment documents `state = 'expired'` as the target of a
  **future, not-yet-built expiry sweep job** — under the write paths
  Phase 2A actually calls (create draft, activate, disable, re-enable,
  revoke, reveal), `expired` cannot occur today. The type retains it for
  forward compatibility with that future sweep, not because it is
  reachable now. `ShareLinkPanel` already renders it defensively and
  safely: only the status badge and a Revoke action are shown (no
  Activate/Copy/Disable/Re-enable), matching the state matrix. This
  defensive branch is now directly tested
  (`share-link-panel.test.tsx`, "expired state shows only Status and
  Revoke").
- **`revoked`**: **structurally impossible** for this read contract to
  return, not merely unreachable in practice. Both
  `get_share_link_management_state` and `list_share_link_summaries`
  filter `and link.state <> 'revoked'` at the SQL level (verified
  directly in `supabase/migrations/202608050001_client_share_owner_reads.sql`,
  lines 115 and 272), and `managedShareLinkStateSchema` itself excludes
  `"revoked"` from its enum. Once a link is revoked, the next
  management-state read simply reports "no managed link" (the owner can
  immediately start a new draft) — there is no "revoked" branch to
  render because the contract never returns one. This behavior is now
  directly tested: `use-share-link.test.ts`'s revoke test asserts that,
  after a successful revoke, the hook's subsequent refresh returns
  `data.link === null`, exercising the exact "revoked link excluded from
  the next read" contract behavior rather than merely asserting the RPC
  was called.

No backend lifecycle logic is duplicated in the UI — `ShareLinkPanel`
only ever renders what the authoritative read RPC actually returns.

---

## 3. Feature Gate

- **Helper**: `lib/share/share-availability.server.ts` —
  `isClientShareEnabled()` / `assertClientShareEnabled()` /
  `ShareAvailabilityError` / `isShareAvailabilityError()`. Modeled on the
  existing `lib/homepage-demo/config.server.ts` +
  `assertHomepageDemoPublicExtractEnabled()` pattern: only the exact
  string `"true"` (trimmed, case-insensitive) enables the feature —
  unset, empty, or any other value stays disabled.
- **Env var**: `TEXT2TASK_CLIENT_SHARE_ENABLED`.
- **Disabled-default behavior**: fail-closed. Every route calls
  `assertClientShareEnabled()` as the first line of its handler, before
  any Supabase client creation or body parsing. On failure, the route's
  catch block detects `isShareAvailabilityError(error)` and returns a
  generic `{ ok: false, code: "NOT_FOUND", error: "Not found." }` at HTTP
  404, without logging (a disabled feature is an expected state, not an
  error) and without ever reaching Supabase — so a Production database
  that has never had the 7 Client Share migrations applied cannot leak a
  raw Postgres error through these routes.
- **Owner routes protected**: all 14 handlers across all 11
  `app/api/share-links/**` route files — `GET`/`POST /api/share-links`,
  `GET /api/share-links/summary`, and `POST`/`PUT`/`DELETE`/`PATCH` on
  every `[id]/**` route (activate, disable, enable, pin, expiry, rotate,
  revoke, reveal, config).
- **UI gate**: `app/dashboard/page.tsx` computes
  `clientShareEnabled={isClientShareEnabled()}` server-side and passes it
  as a plain boolean prop through `DashboardClient` → `TasksView` →
  `DesktopTasksTable`/`MobileTaskCard`, exactly mirroring the existing
  `initialPlan` prop-threading pattern. This is UX only — the server-side
  gate on each route remains the actual security/availability boundary.
- **Pricing independence**: the gate has no relationship to
  `users.plan`/Free-Pro — it is a single, neutral on/off switch.
- **Env-var documentation convention**: checked for an established
  repository convention (`.env.example`, `.env.local.example`, a
  README/deployment-docs environment-variables section) before deciding
  whether to document `TEXT2TASK_CLIENT_SHARE_ENABLED`. Found none — no
  `.env.example` file exists anywhere in the repository, and the exact
  precedent this gate is modeled on
  (`TEXT2TASK_HOMEPAGE_DEMO_ENABLED`) is itself undocumented outside its
  own source file (`lib/homepage-demo/config.server.ts`) and this
  feature's own mapping docs. Per instruction, no new env-documentation
  system was created for Phase 2A; `TEXT2TASK_CLIENT_SHARE_ENABLED`
  follows the same (undocumented-outside-source) convention every other
  env-gated feature in this repository already uses.

---

## 4. UI

- **Desktop entry point**: `app/components/dashboard/tasks/desktop-tasks-table.tsx`
  — a new `onOpenShareLink?: (project) => void` prop; a "Share with
  client" button added to the existing expanded-project action row,
  right after the History button, using the same `crm-soft-button-v6`
  styling and `canManageResources`/`isProjectBusy` disabled logic as the
  Resources button. Renders only when the prop is provided (i.e. the
  gate is enabled).
- **Mobile entry point**: `app/components/dashboard/tasks/mobile-task-card.tsx`
  — the same optional-prop-hides-button convention already used for
  `onOpenProjectResources`/`onOpenProjectHistory`; button added to the
  existing `mobileProjectActionsStyle` row.
- **Shared management component**: `app/components/dashboard/tasks/share-link/share-link-panel.tsx`
  (`ShareLinkPanel`) — one component shared by both breakpoints via
  `ResponsiveDialog` (desktop-centered modal / mobile bottom sheet,
  auto-switching), rather than a sixth bespoke `createPortal` modal.
  Isolated from `DesktopTasksTable`/`MobileTaskCard` into its own
  directory + hook, following the same isolation convention already used
  by `project-updates/` (`useProjectUpdate`, `ProjectUpdateModal`) and
  `resources/` (`ResourceManagerModal`, `resource-api.ts`).
- **Orchestration**: `app/components/dashboard/tasks-view.tsx` owns the
  `useShareLink()` hook instance and renders one `<ShareLinkPanel>`
  alongside the existing Resources/Update/History modals, wiring
  `onOpenShareLink` into both project-card components exactly like
  `onOpenProjectResources`/`onOpenProjectHistory` already are.

---

## 5. Lifecycle Operations Implemented

| Operation | RPC/route reused |
|---|---|
| Management-state read | `get_share_link_management_state` via `GET /api/share-links` |
| Create draft | `create_share_link_draft` via `POST /api/share-links` |
| Activate | `activate_share_link` via `POST /api/share-links/[id]/activate` |
| Copy client link | `reveal_share_link_secret` via `POST /api/share-links/[id]/reveal` (secret built into a URL and copied client-side only; never persisted) |
| Disable | `disable_share_link` via `POST /api/share-links/[id]/disable` (requires a second confirming click) |
| Re-enable | `reenable_share_link` via `POST /api/share-links/[id]/enable` |
| Revoke | `revoke_share_link` via `POST /api/share-links/[id]/revoke` (requires a second confirming click) |

No new RPC, no new database contract, no change to any existing RPC
signature. `lib/share/share-contracts.ts` gained exactly one additive
enum value (`NOT_FOUND`) for the gate's own generic response code — every
other Phase 1B contract is unchanged.

---

## 6. Secret-Handling Behavior

- `useShareLink.copyLink()` calls `reveal`, builds
  `${window.location.origin}/share/<publicId>#<secret>` inside a single
  function-scoped closure, hands it to `navigator.clipboard.writeText`,
  and discards it — the plaintext secret and the full URL are never
  assigned to React state, `localStorage`, `sessionStorage`, a URL, a log
  call, or an analytics payload. Only a `copyStatus: "idle" | "copied" |
  "failed"` enum is persisted in hook state.
- Verified directly in tests: `use-share-link.test.ts` asserts the
  serialized hook state never contains the secret after a successful
  copy; `share-link-panel.test.tsx` asserts the rendered DOM never
  contains a 43-character secret-shaped string.
- A failed clipboard write sets `copyStatus: "failed"` and a user-facing
  `actionError`, without throwing out of the hook or ever re-displaying
  the secret on screen.
- Revoke and Disable both require an explicit second "Confirm" click
  before the destructive action fires (`ShareLinkPanel`'s
  `confirmingAction` state), matching the mapping summary's requirement
  for destructive-action confirmation.

---

## 7. Acceptance-Review Correction

A post-Build final acceptance review (checking specifically for
double-submission risk) found that `useShareLink`'s `runAction` had no
reentrancy guard: a rapid double-click on an action button (Activate,
Disable, Re-enable, Revoke, Copy Link) could fire the handler twice
before React re-rendered the button into its `disabled` state, sending
two concurrent requests for the same operation. The existing codebase
already has an established fix for exactly this class of problem
(`tasks-view.tsx`'s `runProjectAction`, guarded by
`pendingProjectActionRef`) — `runAction` did not follow it.

**Root-cause fix**: added a synchronous `actionInFlightRef` guard at the
top of `runAction` (`app/components/dashboard/tasks/share-link/use-share-link.ts`),
checked and set before any `setState`/async work begins, mirroring
`pendingProjectActionRef`'s pattern exactly. The ref is reset on success,
on failure, and whenever `openPanel`/`closePanel` start a fresh panel
session (so a still-in-flight action from a previous session can never
block the first action of a new one).

**Regression test added**: `use-share-link.test.ts` — "a second call
while an action is already in flight is ignored (no double submission)"
— asserts the underlying client function is called exactly once even
when the hook's action function is invoked twice before the first call
resolves.

No product behavior, contract, or scope changed — this is a pure
UI-layer robustness fix, within Phase 2A's own already-approved
behavior.

**Final targeted tests after this correction: 1084 / 1084 PASS.**
**Final `npx tsc --noEmit -p tsconfig.json`: PASS, 0 errors.**

This correction required the user to re-run the full production Build.
**The user has since done so, and it passed**: Next.js 16.1.6
(Turbopack) compiled successfully, TypeScript PASS, static generation
89/89 PASS. The working-tree source file list was unchanged by that
Build. No further Build rerun is pending.

---

## 8. Files Created and Modified — Exact Counts

Verified mechanically from `git status --short` (expanding the one
untracked directory into its individual files):

- **New files: 10** — 7 inside `app/components/dashboard/tasks/share-link/`
  (`share-link-client.ts`, `share-link-client.test.ts`, `use-share-link.ts`,
  `use-share-link.test.ts` [updated during acceptance review],
  `share-link-panel.tsx`, `share-link-panel.test.tsx` [updated during
  acceptance review], `share-link-entry-point.test.tsx`) + 2 in
  `lib/share/` (`share-availability.server.ts`,
  `share-availability.server.test.ts`) + this report.
- **Modified files: 31** — 11 `app/api/share-links/**` route files + their
  11 `.test.ts` files (22 total), plus `desktop-tasks-table.tsx`,
  `mobile-task-card.tsx`, `tasks-view.tsx`, `dashboard-client.tsx`,
  `dashboard-client.test.tsx`, `dashboard/page.tsx`, `dashboard/page.test.tsx`,
  `share-contracts.ts`, `share-contracts.test.ts` (9 total).
- **Total changed files: 41.**

### Files Created (10)

- `lib/share/share-availability.server.ts`
- `lib/share/share-availability.server.test.ts`
- `app/components/dashboard/tasks/share-link/share-link-client.ts`
- `app/components/dashboard/tasks/share-link/share-link-client.test.ts`
- `app/components/dashboard/tasks/share-link/use-share-link.ts`
- `app/components/dashboard/tasks/share-link/use-share-link.test.ts`
- `app/components/dashboard/tasks/share-link/share-link-panel.tsx`
- `app/components/dashboard/tasks/share-link/share-link-panel.test.tsx`
- `app/components/dashboard/tasks/share-link/share-link-entry-point.test.tsx`
- `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_2A_IMPLEMENTATION_REPORT.md` (this file)

### Files Modified (31)

- `lib/share/share-contracts.ts` (+ `.test.ts`) — added `NOT_FOUND` to
  `shareLinkApiErrorCodeSchema`.
- All 11 `app/api/share-links/**` route files (+ their `.test.ts`
  files, 22 files total) — gate check added as the first line of every
  handler, plus a gate-disabled 404 test case per handler.
- `app/components/dashboard/tasks/desktop-tasks-table.tsx` — new
  optional `onOpenShareLink` prop + button.
- `app/components/dashboard/tasks/mobile-task-card.tsx` — new optional
  `onOpenShareLink` prop + button.
- `app/components/dashboard/tasks-view.tsx` — `useShareLink()` hook
  instance, `openShareLinkPanel` handler, `<ShareLinkPanel>` render,
  `clientShareEnabled` prop threaded to both card components.
- `app/components/dashboard-client.tsx` (+ `.test.tsx`) —
  `clientShareEnabled` prop added and threaded to `TasksView`.
- `app/dashboard/page.tsx` (+ `.test.tsx`) — computes and passes
  `clientShareEnabled={isClientShareEnabled()}`.

---

## 9. Tests Added — Targeted Results

| Suite | Tests | Result |
|---|---|---|
| `lib/share/share-availability.server.test.ts` | 8 | PASS |
| `lib/share/share-contracts.test.ts` (updated) | full file | PASS |
| All 11 `app/api/share-links/**` route test files (updated) | full files, incl. 12 new gate tests | PASS |
| `share-link-client.test.ts` | 12 | PASS |
| `use-share-link.test.ts` | 13 | PASS |
| `share-link-panel.test.tsx` | 13 | PASS |
| `share-link-entry-point.test.tsx` | 4 | PASS |
| `dashboard-client.test.tsx` (updated) | full file | PASS |
| `dashboard/page.test.tsx` (updated, +2 gate tests) | full file | PASS |
| `project-surface-activity.test.tsx` (regression, unmodified) | full file | PASS |

**Combined targeted run** (`lib/share`, `app/api/share-links`,
`app/components/dashboard/tasks/share-link`, `dashboard-client.test.tsx`,
`project-surface-activity.test.tsx`, `dashboard/page.test.tsx`):
**1084 / 1084 passed, 0 failed.**

**`npx tsc --noEmit` across the full repository: 0 errors.**

Test coverage includes: feature-gate on/off behavior for every route;
UI-visibility presence/absence on both desktop and mobile; every
management-panel state (loading, load error, no-link, draft, active,
disabled, expired); post-revoke no-link refresh behavior; every owner
operation including double-submission rejection; secret non-persistence
in both hook state and the rendered DOM; and regression checks confirming
the pre-existing Resources/Add update/History actions and
project-expansion behavior are unchanged.

---

## 10. Intentionally Deferred

Phase 1C (durable title/status/target-date publication intent), Phase 2B
(task/Resource/settings configuration editor), Phase 2C (PIN/expiry/
rotation/WhatsApp/native-Share UX), Phase 2D (authoritative Preview
projection), the public `/share/[publicId]` route, fragment-to-session
exchange, public Resource access, client comments, Client Communication
History, and any Free/Pro entitlement design — all per the accepted
Pre-Phase-2 mapping summary and Addendum C sequencing.

---

## 11. Production State

- Production Client Share migrations: **NOT APPLIED** (unchanged).
- Production Client Share feature: **NOT ENABLED** (unchanged — the new
  gate defaults to disabled and nothing in this change flips it).
- No SQL was run, no Supabase project was accessed, no Production system
  was touched.

---

## 12. Next Authorized Phase

Phase 2A has completed final acceptance review, the double-submission
correction, and a second full production Build PASS. It is ready to be
checkpointed (staged and committed) by the user as its own checkpoint.

Per the accepted sequence (Phase 2A → Phase 1C → Phase 2B → Phase 2C →
Phase 2D → Phase 3 …), the next authorized phase is **Phase 1C —
durable project-level publication intent**, to begin only after Phase 2A
has been committed as its own checkpoint.
