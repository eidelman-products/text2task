# Text2Task Work Calendar — Route + Shared Dashboard Shell Implementation Report

Status: **Route and navigation infrastructure implemented, tested, verified. No Calendar data UI. No visible Calendar nav item. Not committed. Not pushed. `npm run build` not run.**

---

## 1. Exact verdict

`/dashboard/calendar` now exists as a real, server-authenticated Next.js route rendering a polished but intentionally minimal development shell — one `<h1>Calendar</h1>`, a subtitle, and a neutral informational card. It shares the exact same sidebar, logo, account menu, and responsive mobile behavior as `/dashboard` via a new reusable `RoutedDashboardShell`, built entirely from the **existing** `DashboardShell`/`DashboardSidebarProfile`/`DashboardUserMenu` primitives — no markup was duplicated. The Calendar item is **not** registered anywhere in the visible sidebar nav list; the route is reachable only by direct URL for development QA, exactly as locked.

A new shared, pure `lib/dashboard/workspace-navigation.ts` module is now the single source of truth for the dashboard's navigation concepts, replacing a `DashboardNav` string union that was independently declared in two files. `DashboardSidebarProfile` and `SidebarButton` now support two rendering modes — "workspace" (SPA callback, used inside `DashboardClient`) and "routed" (real `next/link` navigation, used inside `RoutedDashboardShell`) — as one component each, not two parallel implementations. `/dashboard` gained a validated `?view=` query parameter so external links/routes can request a specific SPA tab on load, with zero URL synchronization added to in-page tab clicks. The existing Dashboard/Extract/Tasks workflow inside `DashboardClient` is behaviorally unchanged.

**51 test files / 614 tests passing** (up from the 44-file/564-test baseline at the start of this milestone — **50 net new tests** across 7 new test files). Clean `tsc --noEmit`. Clean `eslint` (targeted and repo-wide). Clean `git diff --check`.

---

## 2. Starting repository state

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `62f8f27` — "Add Work Calendar foundation" |
| `git status --short` | *(empty — clean)* |
| Working tree | Clean |
| History confirmed present | `62f8f27` Add Work Calendar foundation; `6a72c93` Prevent false Done on partial task updates; `79c8899` Add accessible deadline date picker (all three confirmed via `git log`) |
| Test baseline | 44 test files / 564 tests, all passing |
| Dashboard route structure (before) | `app/dashboard/layout.tsx` (noindex metadata only), `app/dashboard/page.tsx` (server-guarded SPA entry), `app/dashboard/billing/page.tsx`, `app/dashboard/profile/page.tsx` (both client-guarded, no shared shell) |
| `DashboardClient`/sidebar/shell contracts (before) | `DashboardClient` (1866 lines) owned all SPA nav state (`activeNav: DashboardNav`, `handleNavChange`), rendered `DashboardSidebarProfile` (email/plan/activeNav/onNavChange props) inside the generic, already-reusable `DashboardShell` (sidebar/children/activeNavLabel/mobile-sidebar props — no SPA-specific logic). `SidebarButton` only supported a single `{label, active, onClick}` button-only shape. `DashboardNav = "dashboard" \| "extract" \| "tasks"` was declared independently in both `dashboard-client.tsx` and `dashboard-sidebar-profile.tsx`. |
| Auth-guard pattern (before) | `app/dashboard/page.tsx` inlined: `createClient()` → `auth.getUser()` → `redirect("/login")` on error/absent-user/no-email → `ensureUser({id, email})`. No shared extraction existed. |
| Profile/user data flow (before) | Two independent paths: (1) `ensureUser` (service-role `supabaseAdmin`, `lib/supabase/ensureUser.ts`) — server-side, used only by `/dashboard` to seed `DashboardClient`'s `email`/`plan` props (which `DashboardSidebarProfile` displays in its workspace-summary card). (2) `DashboardUserMenu` — a fully self-contained client component that fetches its own account info from `/api/billing/subscription` and renders Profile/Billing/Contact/Logout — takes **zero** props beyond an optional `compact` flag, already rendered internally by `DashboardShell` for both desktop and mobile. This meant the actual profile-menu/logout/billing UI needed **no new data plumbing at all** to reach a routed page — reusing `DashboardShell` was sufficient. |
| Mobile sidebar behavior (before) | Fully implemented in `DashboardShell`: an overlay + slide-in drawer, `isMobileSidebarOpen`/`onOpenMobileSidebar`/`onCloseMobileSidebar` props (owned by whichever parent renders `DashboardShell`), a mobile header with a hamburger button, the `Text2Task` logo, an `activeNavLabel` string, and a compact `DashboardUserMenu`. Responsive breakpoint: 900px, via a `<style>` block with `@media` queries (both desktop and mobile markup always in the DOM; CSS decides visibility). |

No fact above was assumed — every claim was confirmed by reading the actual files before making any change.

---

## 3. Navigation architecture before

- SPA-only: `DashboardClient` owned a single `activeNav` state switching between three in-page views (Dashboard/Extract/Tasks) at the one URL `/dashboard`. No other route shared its sidebar.
- `DashboardNav` (the workspace-view union) was declared **twice**, independently, in `dashboard-client.tsx` and `dashboard-sidebar-profile.tsx` — a latent duplication risk the mapping report had already flagged.
- `SidebarButton` supported exactly one interaction shape: a `<button onClick>`. There was no way to render a real navigable link without either forking the component or misusing a button as a link.
- `billing`/`profile` pages proved a working alternative pattern (real routes) but with two known weaknesses this milestone was explicitly told to avoid repeating: a client-only auth check (flash-of-unauthenticated-content risk) and no shared sidebar/shell at all.

## 4. Navigation architecture after

- One shared, pure module (`lib/dashboard/workspace-navigation.ts`) defines every navigation concept: `DashboardWorkspaceView` (SPA tabs), `DashboardRoutedDestination` (real routes — only `"calendar"` today), and `DashboardActiveNavItem` (a discriminated union describing what's currently selected, in either mode). `DashboardWorkspaceView` and `DashboardRoutedDestination` are deliberately **not** merged into one ambiguous string type.
- `DashboardSidebarProfile` and `SidebarButton` each gained a second rendering mode instead of being duplicated. `DashboardSidebarProfile`'s nav list is now generated by mapping over `DASHBOARD_WORKSPACE_VIEWS` (three items, unchanged) rather than three hand-written JSX blocks — reducing, not adding, duplication.
- A new `RoutedDashboardShell` client component composes the **existing** `DashboardShell` + `DashboardSidebarProfile` (in `"routed"` mode) for any future routed page, owning only the minimal `isMobileSidebarOpen` state `DashboardShell` needs (since a routed page has no `DashboardClient` to own it).
- `/dashboard/calendar` is the first (and, this milestone, only) consumer of `RoutedDashboardShell`.
- `DashboardClient` gained one new optional prop, `initialView`, and now imports `DashboardWorkspaceView`/`DEFAULT_DASHBOARD_WORKSPACE_VIEW`/`getDashboardWorkspaceViewLabel` from the shared module instead of declaring its own union and label-lookup function.

---

## 5. Shared workspace-view contract

`lib/dashboard/workspace-navigation.ts` — pure, no React, no Supabase:

```ts
export type DashboardWorkspaceView = "dashboard" | "extract" | "tasks";
export const DASHBOARD_WORKSPACE_VIEWS: readonly DashboardWorkspaceView[] = [...];
export const DEFAULT_DASHBOARD_WORKSPACE_VIEW: DashboardWorkspaceView = "dashboard";

export type DashboardRoutedDestination = "calendar";

export type DashboardActiveNavItem =
  | { kind: "workspace"; view: DashboardWorkspaceView }
  | { kind: "routed"; destination: DashboardRoutedDestination };

export function parseDashboardWorkspaceView(value: unknown): DashboardWorkspaceView;
export function getDashboardWorkspaceHref(view: DashboardWorkspaceView): string;
export function getDashboardRoutedHref(destination: DashboardRoutedDestination): string;
export function getDashboardWorkspaceViewLabel(view: DashboardWorkspaceView): string;
export function isWorkspaceViewActive(item: DashboardActiveNavItem, view: DashboardWorkspaceView): boolean;
export function isRoutedDestinationActive(item: DashboardActiveNavItem, destination: DashboardRoutedDestination): boolean;
```

`parseDashboardWorkspaceView` never throws — any non-matching value (wrong type, wrong string, array, object) safely falls back to `"dashboard"`. `getDashboardWorkspaceHref("dashboard")` deliberately omits the query parameter (`/dashboard`, not `/dashboard?view=dashboard`), so the canonical/default URL stays clean. 12 focused tests cover every function, including the active-item comparison helpers proving a routed active item never matches any workspace view and vice versa.

---

## 6. `/dashboard?view=` behavior

`app/dashboard/page.tsx` now reads Next.js 16's async `searchParams`, extracts `view` (defensively handling the `string | string[] | undefined` shape a repeated query param can produce — takes the first value), and validates it through `parseDashboardWorkspaceView` before passing it to `DashboardClient` as `initialView`.

- No parameter → `dashboard`.
- `?view=extract` → `extract`.
- `?view=tasks` → `tasks`.
- Any invalid value (including a nonsense string, or the SPA-only concept accidentally colliding with a routed name) → falls back to `dashboard`.
- `DashboardClient`'s `useState<DashboardNav>` is seeded from `initialView ?? DEFAULT_DASHBOARD_WORKSPACE_VIEW` **once**, on mount. `handleNavChange` (the existing in-page tab-click handler) is completely untouched — no `router.replace`/`push` was added anywhere, so clicking Dashboard/Extract/Tasks after landing continues to be a pure state change with no URL synchronization, exactly as instructed.
- No `localStorage`/`sessionStorage`/cookies/hash/global variable was used to transfer the requested view — it flows through the URL query string only, validated at the server boundary.

6 tests cover this at the page level, using a shallow mock of `DashboardClient` (asserting only the `initialView` prop it receives) rather than rendering the full 1800+ line component.

---

## 7. Routed Dashboard shell architecture

`app/components/dashboard/routed-dashboard-shell.tsx` (`"use client"`, ~55 lines):

```ts
function RoutedDashboardShell({ email, plan, activeDestination, activeLabel, children }): JSX.Element
```

It owns exactly one piece of state (`isMobileSidebarOpen`), builds the `sidebar` element as `<DashboardSidebarProfile mode="routed" activeItem={{kind:"routed", destination: activeDestination}} email={email} plan={plan} />`, and renders `<DashboardShell sidebar={sidebar} activeNavLabel={activeLabel} ...>{children}</DashboardShell>` — the identical `DashboardShell` component `DashboardClient` already uses, unmodified. No new mobile-drawer implementation, no second responsive breakpoint, no forked account menu: all of that lives in `DashboardShell`/`DashboardUserMenu` and is inherited automatically.

---

## 8. Calendar route auth behavior

A new shared helper, `lib/supabase/requireDashboardUser.ts`, extracts the auth-guard pattern that was about to exist identically in two files:

```ts
export async function requireDashboardUser(): Promise<AppUser> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  if (!user.email) redirect("/login");
  return ensureUser({ id: user.id, email: user.email });
}
```

Both `app/dashboard/page.tsx` and `app/dashboard/calendar/page.tsx` now call this single function — identical behavior, one place to get it right, matching the exact `/dashboard` pattern that predates this milestone (server Supabase client, `auth.getUser()`, redirect-if-absent, `ensureUser` for the app-level row). **No client-only auth flash**: the redirect happens server-side, before any HTML ships, exactly like `/dashboard` and unlike `billing`/`profile`. 4 focused tests cover `requireDashboardUser` directly (no user → redirect; auth error → redirect; no email → redirect; valid session → returns the `ensureUser` result, `ensureUser` never called after a redirect).

---

## 9. User/profile data flow

No new data-loading path was created. `requireDashboardUser()` (§8) supplies `email`/`plan` for the sidebar's workspace-summary card — the exact same `ensureUser` call `/dashboard` already made. `DashboardUserMenu` (profile/billing/logout, the real account dropdown) is **self-contained and self-fetching** — it takes no user-data props at all, and `DashboardShell` already renders it internally for both desktop and mobile. Reusing `DashboardShell` via `RoutedDashboardShell` was therefore sufficient to get real, non-hardcoded account information, profile/billing links, and working logout on `/dashboard/calendar` with zero additional server-side data plumbing. No second account API was created; no information is fetched more than once across components.

---

## 10. Desktop navigation behavior

Unchanged visually and behaviorally on `/dashboard` (SPA callback mode). On `/dashboard/calendar`: the identical sidebar renders Dashboard/Extract/Tasks as real `next/link` links (`/dashboard`, `/dashboard?view=extract`, `/dashboard?view=tasks`) instead of buttons; clicking one performs a real page navigation back into the SPA, landing on the requested tab via `?view=`. None of the three shows as active (correctly — you are on none of their routes). The account menu, logo, and workspace-summary card render identically to `/dashboard`.

## 11. Mobile navigation behavior

`RoutedDashboardShell` owns its own `isMobileSidebarOpen` state and passes the same `onOpenMobileSidebar`/`onCloseMobileSidebar` callbacks into the same `DashboardShell`, so the hamburger button, overlay, slide-in drawer, close button, and compact account menu behave identically to `/dashboard` — confirmed by a dedicated open/close test. No second mobile sidebar implementation exists.

## 12. Accessibility

- `SidebarButton` now renders either a `<button type="button">` (workspace mode) or a `next/link` `<a href>` (routed mode) — never a button standing in for a link or vice versa.
- `aria-current="page"` is applied to the active routed link (the semantically correct token for "this represents the current page"); `aria-current="true"` is applied to the active workspace button (a valid ARIA token for "current selection" that isn't a page). Both are **omitted** entirely when inactive, rather than set to `"false"`.
- The decorative icon glyph span now has `aria-hidden="true"` — previously it was exposed to the accessible name (e.g. "▦ Dashboard" instead of "Dashboard"), a pre-existing minor defect fixed as part of this change since it directly affects the new link-mode's accessible name too.
- No interactive element is nested inside another (verified by a dedicated test on the link markup).
- Keyboard navigation is unaffected — both button and link modes are natively focusable/activatable elements with no custom key handling removed or added.
- Exactly one `<h1>` exists on the Calendar page (verified by test); mobile navigation focus behavior is unchanged since `DashboardShell`'s own drawer/focus handling was not modified.

---

## 13. Files created

- `lib/dashboard/workspace-navigation.ts`
- `lib/dashboard/workspace-navigation.test.ts`
- `lib/supabase/requireDashboardUser.ts`
- `lib/supabase/requireDashboardUser.test.ts`
- `app/components/dashboard/routed-dashboard-shell.tsx`
- `app/components/dashboard/routed-dashboard-shell.test.tsx`
- `app/components/dashboard/sidebar-button.test.tsx`
- `app/components/dashboard/dashboard-sidebar-profile.test.tsx`
- `app/dashboard/calendar/page.tsx`
- `app/dashboard/calendar/page.test.tsx`
- `app/dashboard/page.test.tsx`
- `docs/TEXT2TASK_WORK_CALENDAR_ROUTE_SHELL_IMPLEMENTATION_REPORT.md` (this file)

## 14. Files modified

- `app/dashboard/page.tsx` — uses `requireDashboardUser`; reads/validates `?view=`; passes `initialView` to `DashboardClient`.
- `app/components/dashboard-client.tsx` — accepts optional `initialView` prop; imports the shared workspace-view type/default/label helper instead of declaring its own; updated the `DashboardSidebarProfile` call site to the new `mode`/`activeItem`/`onWorkspaceViewChange` contract.
- `app/components/dashboard/dashboard-sidebar-profile.tsx` — supports `"workspace"`/`"routed"` modes; nav list generated from `DASHBOARD_WORKSPACE_VIEWS` instead of three hand-written blocks.
- `app/components/dashboard/sidebar-button.tsx` — supports button/link rendering modes via a discriminated `as` prop; extracted the shared visual markup/styles so both modes render identical visuals from one source; added `aria-hidden` on the icon and mode-appropriate `aria-current`.

No other file was touched. `DashboardShell`, `DashboardUserMenu`, `DashboardFooter`, and every existing Dashboard/Extract/Tasks-rendering code path inside `DashboardClient` are byte-for-byte unchanged.

---

## 15. Tests added

| Area | File | Tests |
|---|---|---|
| Shared navigation contract | `workspace-navigation.test.ts` | 12 |
| Shared auth-guard helper | `requireDashboardUser.test.ts` | 4 |
| SidebarButton (button/link modes, aria-current, no nested interactive elements) | `sidebar-button.test.tsx` | 8 |
| DashboardSidebarProfile (workspace/routed modes, active-state, account card) | `dashboard-sidebar-profile.test.tsx` | 8 |
| RoutedDashboardShell (composition, mobile drawer, account menu reuse) | `routed-dashboard-shell.test.tsx` | 5 |
| `/dashboard` initial view resolution | `page.test.tsx` | 6 |
| Calendar route (auth, one H1, no Calendar API call, no visible nav item, no interactive controls) | `calendar/page.test.tsx` | 7 |
| **Total new** | **7 files** | **50 tests** |

Every locked test requirement is covered: the shared contract's parse/reject/href/fallback behavior; `/dashboard`'s four `?view=` scenarios; both sidebar rendering modes including the internally-supported-but-not-visible routed Calendar active state; the Calendar route's redirect-when-unauthenticated and render-when-authenticated behavior, its single H1, its lack of any `/api/calendar` fetch, and the continued absence of a visible Calendar nav item; and regression coverage confirming Dashboard/Extract/Tasks sidebar destinations and the real account menu remain present and correct in both modes.

---

## 16. Verification results

```
npx vitest run
  Test Files  51 passed (51)
       Tests  614 passed (614)

npx tsc --noEmit
  (clean, no output)

npx eslint <all 15 changed/created .ts/.tsx files>
  (clean, no output)

npm run lint   (repo-wide)
  (clean, no output)

git diff --check
  (clean, exit 0)

git status --short
   M app/components/dashboard-client.tsx
   M app/components/dashboard/dashboard-sidebar-profile.tsx
   M app/components/dashboard/sidebar-button.tsx
   M app/dashboard/page.tsx
  ?? app/components/dashboard/dashboard-sidebar-profile.test.tsx
  ?? app/components/dashboard/routed-dashboard-shell.test.tsx
  ?? app/components/dashboard/routed-dashboard-shell.tsx
  ?? app/components/dashboard/sidebar-button.test.tsx
  ?? app/dashboard/calendar/
  ?? app/dashboard/page.test.tsx
  ?? lib/dashboard/
  ?? lib/supabase/requireDashboardUser.test.ts
  ?? lib/supabase/requireDashboardUser.ts

git diff --stat
 app/components/dashboard-client.tsx                |  33 +++--
 app/components/dashboard/dashboard-sidebar-profile.tsx |  82 ++++++++----
 app/components/dashboard/sidebar-button.tsx        | 147 +++++++++++++--------
 app/dashboard/page.tsx                             |  32 ++---
 4 files changed, 180 insertions(+), 114 deletions(-)
```

**Grep sweep across every changed file:**

| Pattern | Result |
|---|---|
| `as any` | 0 matches |
| `eslint-disable` | 0 matches |
| `ts-ignore`/`ts-expect-error` | 0 matches |
| Duplicated `"dashboard" \| "extract" \| "tasks"` union | Exactly 1 match, in the single canonical `lib/dashboard/workspace-navigation.ts` — `dashboard-client.tsx` now imports it (`type DashboardNav = DashboardWorkspaceView`, an alias, not a redeclaration) |
| Hardcoded user/account details | 0 in application code (2 matches are test **descriptions** asserting values are *not* hardcoded) |
| Client-only auth redirects | 0 new matches (the pre-existing `DashboardUserMenu` logout redirect is unrelated and untouched) |
| Calendar API fetching | 0 in application code (1 match is the Calendar page test asserting no such call occurs) |
| Visible Calendar navigation registration | 0 in `dashboard-sidebar-profile.tsx` (its nav list only ever maps over `DASHBOARD_WORKSPACE_VIEWS`, which does not include `"calendar"`); the only `label="Calendar"` usages are in `sidebar-button.test.tsx`, exercising the generic component's link mode in isolation, not wiring it into the real sidebar |
| Copied desktop/mobile sidebar markup | 0 — one `DashboardShell`, one `DashboardSidebarProfile`, one `SidebarButton`, each with two modes, not two implementations |
| Nested interactive elements | 0 — confirmed directly on the rendered link markup |

`npm run build` was not run, per instruction.

---

## 17. Explicit confirmation

- **No Calendar data UI was built.** The Calendar page renders a static heading, subtitle, and one neutral `DashboardEmptyState` informational card — no month grid, no event list, no filters, no Add Event button, no sample/placeholder data.
- **No visible Calendar nav item was added.** `DashboardSidebarProfile`'s rendered nav list is generated exclusively from `DASHBOARD_WORKSPACE_VIEWS` (Dashboard/Extract/Tasks); `/dashboard/calendar` is reachable only by direct URL, confirmed by both the grep sweep and a dedicated test.
- **No database/API changes were made.** No migration, schema, RPC, or `app/api/**` route was touched — grep confirms zero references to `/api/calendar` in any changed application file.
- **Nothing was committed. Nothing was pushed.** No branch was created or switched (`main`, unchanged, confirmed before and after via `git status --short`).
- **`npm run build` was not run.**
