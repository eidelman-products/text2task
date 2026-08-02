# Text2Task — Minimal Authenticated Activity Mapping

**Status: MAPPING ONLY.** No code was edited, no migration was created or applied, nothing was deployed. This document is the complete architecture map requested to fill one gap in the existing owner-analytics system: reliably knowing when a real authenticated user returned and only *viewed* product surfaces without performing a database write.

---

## 1. Executive verdict

Text2Task's owner-analytics system is more mature than the "we only have `page_view`" framing suggests, but it has a structural blind spot exactly where the request says it does:

- `page_view` (`app/components/analytics/attribution-capture.tsx`) is **anonymous by design** — it never attaches `user_id`, even when the visitor is authenticated, and is gated behind marketing-analytics consent. It cannot answer "which authenticated user returned."
- A separate, already-working precedent exists for exactly this class of problem: **`last_dashboard_seen_at`**, written by `public.record_dashboard_visit()` via `POST /api/activity/dashboard-visit`, resolves the user **server-side** from the Supabase session, is **consent-independent** (treated as essential/operational, not marketing analytics), and fires fire-and-forget from a `useEffect` keyed only on `userId`. This is the strongest existing template in the codebase and the recommended architecture extends it rather than replacing it.
- That precedent is a **single rate-limited scalar column**, not an event log — it can answer "did they open the dashboard in roughly the last 4 hours," but it cannot answer "which page," "how many distinct days," "returning user," or produce a timeline. It also does not exclude owner/test accounts at the data layer (only in the UI).
- The 12 authenticated surfaces named in the request (Dashboard, Extract, Task CRM, Calendar, project expansion, Resources, History, Add Client Update, calendar day, calendar event) are real and were traced exactly: only `/dashboard` and `/dashboard/calendar` are genuine routes with a server-side auth guard (`requireDashboardUser()`); everything else (Extract, Task CRM, project expansion, Resources, History, Add Client Update, the calendar day/event dialogs) is client-side `useState` inside those two routes — zero Next.js prefetch risk for 10 of the 12 surfaces, and auth is always confirmed before any of them can mount.
- The existing `analytics_events` table already has a nullable `user_id` FK to `auth.users`, but reusing it for this feature would silently pollute the Overview page's "tracked events" traffic counters, which today scan *every* `event_name` in the 30-day window with no filter. **Recommendation: a new, small, dedicated table (`authenticated_product_events`), not an extension of `analytics_events`.**
- Every write-action the request asked about (project saved/archived/completed, calendar event created/updated) is **already reliably inferable** from existing domain-table timestamps — no new "action" event instrumentation is needed for those. Two are only partially inferable (extraction, task status changes — only current-state/latest-timestamp, no per-event history). One has zero trace today: **CSV export**, which is a pure client-side blob download with no server involvement at all.

**Bottom line:** this is a genuinely minimal, additive extension. One new table, one new write endpoint (structurally a near-copy of the existing dashboard-visit route), 10 new event names fired from 6 already-identified files, one new summary RPC, and a small extension to the existing Users & Activity table plus one new per-user timeline route.

---

## 2. Current analytics architecture (map)

Three independent systems coexist today, each with a different purpose and a different data model:

| System | Table/column | Identity | Purpose |
|---|---|---|---|
| Marketing/traffic analytics | `public.analytics_events` | `anonymous_id` primary, `user_id` nullable/rarely populated | Page views, UTM/campaign attribution, country, signup attribution |
| Authenticated activity counters | `public.users` columns (`last_dashboard_seen_at`, `successful_extract_count`, `last_extract_at`) | `user_id`, resolved server-side | Per-user scalar "last seen"/"lifetime count" signals, owner-analytics only |
| Project-scoped audit trail | `public.project_updates`, `project_update_items`, `project_timeline_events` | `project_id` (not user-centric) | Full old/new-value history of the AI client-update analyze/apply flow, exposed to the product user via `/api/project-updates/history` |

There is **no** system today that produces a per-user, cross-surface, chronological "what did this authenticated user look at" timeline. The closest things are: (a) the project-scoped timeline above (AI-update-flow only, not view events), and (b) `DashboardRecentActivity`, a pure client-side widget that re-derives "Task updated"/"Project details updated" from already-loaded task rows on every render — not a backend feed, no field-level detail, not available to the owner.

---

## 3. Existing database schema — `public.analytics_events`

Single migration: `supabase/migrations/202606190001_analytics_events.sql`. No other migration touches this table. No retention/cleanup job exists for it anywhere (checked for `pg_cron`/scheduled deletes — the only cron job in the repo, `homepage-demo-maintenance-v1`, operates on unrelated `homepage_demo_*` tables).

```sql
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  occurred_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  anonymous_id text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  utm_content text null,
  referrer text null,
  landing_page text null,
  page_path text null,
  country_code text null,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text null,
  created_at timestamptz not null default now(),
  constraint analytics_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);
```

**Indexes:** `occurred_at desc`, `event_name`, `user_id`, `anonymous_id`, `utm_source`, `utm_campaign`, `country_code`, and a **unique partial index** `on (idempotency_key) where idempotency_key is not null` — this is the table's dedup mechanism, used by two of its three write paths (not by `page_view`).

**RLS:** enabled, **zero policies defined**. Combined with the grants below, this means default-deny for every role except one with `BYPASSRLS` (`service_role`).

**Grants:**
```sql
revoke all on table public.analytics_events from public, anon, authenticated;
grant select, insert on table public.analytics_events to service_role;
```
No `update`/`delete` grant exists for any role.

**Key facts for the extension:**
- `user_id` is already nullable and FK'd to `auth.users(id) on delete set null` — no schema change needed to attribute a row to a user, *if* this table were reused (it will not be — see §10).
- Anonymous and authenticated rows already share this one table (`signup_success` rows carry both `user_id` and `anonymous_id` together).
- No dedicated session-id/visitor table exists. "Visitor identity" is the client-generated `anonymous_id` (persisted to `localStorage` + cookie `t2t_anon_id`, 180-day max-age), not a DB-backed session.

### Event-name contracts
`lib/analytics/internal-events.server.ts`, `ALLOWED_EVENT_NAMES`:
```
page_view, signup_attribution_captured, signup_success, email_confirmed,
login_success, first_extract_created, project_saved,
client_update_created, client_update_applied,
homepage_demo_extract_attempt, homepage_demo_extract_succeeded, homepage_demo_extract_failed
```
Only **6 of these 12** are ever actually written anywhere in the repo: `page_view`, `signup_attribution_captured`, `signup_success`, and the three `homepage_demo_extract_*` names. **`first_extract_created`, `project_saved`, `client_update_created`, `client_update_applied` are reserved in the allowlist but never fired** — the schema was clearly designed with headroom for product-action events that were never wired up. This is a relevant precedent but, per §13, this mapping recommends *not* retroactively wiring these up as part of the minimal view-tracking scope (see §10 for why).

A second, narrower allowlist gates what the public browser endpoint accepts: `app/api/analytics/event/route.ts`, `ALLOWED_BROWSER_EVENTS = new Set(["page_view"])` — today, the browser can only ever trigger `page_view` through the public API; every other event name is written from trusted server code.

No Zod schema exists anywhere in the analytics path. Validation is hand-rolled: `clampText`, `sanitizeUuid`, `sanitizeCountryCode`, `sanitizeMetadata`, `sanitizeAttributionFields`. Metadata sanitization limits: `MAX_METADATA_BYTES = 2000`, `MAX_METADATA_DEPTH = 3`, `MAX_OBJECT_KEYS = 25`, `MAX_ARRAY_ITEMS = 20`, and a `SENSITIVE_KEY_PATTERN` regex (`/(password|token|secret|authorization|cookie|message|raw|screenshot|task_text|project_summary|resource|content|private|client_message)/i`) that strips any matching metadata key. Insert races a `1250ms` timeout; a timed-out write is simply abandoned (fire-and-forget philosophy, not retried).

**Every write to `analytics_events` uses the service-role client** (`supabaseAdmin`, `lib/supabase/admin.ts`) via one funnel function, `logAnalyticsEventSafe()`. Three call sites exist, all server-side:
1. `app/api/analytics/event/route.ts` — the `page_view` browser endpoint.
2. `lib/analytics/signup-attribution.server.ts` — signup events, deferred via `after()`, called from `app/auth/oauth/callback/route.ts`, `app/auth/confirm/route.ts`, `app/api/auth/signup/route.ts`.
3. `app/api/homepage-demo/extract/route.ts` — the anonymous public live-demo flow.

No anon-key or user-session-authenticated Supabase client can write to this table under current RLS/grants — a critical constraint the new table must also satisfy.

### Read paths
No SQL views exist. Two RPCs, both `security invoker`, `service_role`-execute-only, both `stable`:
- `public.get_owner_product_activation_analytics()` (`202606200001_owner_product_activation_analytics.sql`) — reads `public.users`/`public.projects` directly, **not** `analytics_events`.
- Direct `.from("analytics_events").select(...)` queries (three of them) inside `app/admin/analytics/page.tsx` for traffic/live-demo/signup-attribution reporting (see §7).

---

## 4. Existing page-view tracking

`app/components/analytics/attribution-capture.tsx`, mounted unconditionally in the root layout (`app/layout.tsx`), so it runs on **both** marketing and dashboard pages, with two exceptions carved out by `lib/analytics/analytics-paths.ts::shouldSkipAnalyticsPath()`: `/admin*` and `/homepage-demo/review`.

Gated behind two independent conditions, both of which must pass:
1. `NEXT_PUBLIC_TEXT2TASK_INTERNAL_ANALYTICS_ENABLED === "true"` (env flag).
2. `useAnalyticsConsentAccepted()` — the marketing cookie-consent banner choice.

**It is purely anonymous.** The payload it sends (`sendPageView()`) is `{ event_name: "page_view", page_path, attribution }` — `attribution` contains only `anonymous_id` + UTM/referrer/landing-page fields. No auth/session read happens client-side, and the server route never attaches a `userId` either. **`page_view` rows are always `user_id = null`, regardless of whether the visitor is logged in.**

Trigger: a `useEffect` with an empty dependency array, scheduled via `requestIdleCallback` (2000ms timeout) or a `setTimeout(1200ms)` fallback — fires once per mount of the root-layout-scoped component, i.e., once per hard navigation/full page load, not per client-side SPA route change (Next.js layouts persist across route transitions within the same layout scope).

Delivery: `navigator.sendBeacon`, falling back to `fetch(..., { keepalive: true })`.

**No deduplication exists in practice for `page_view`** — no Strict-Mode guard, no debounce, and while the table supports an `idempotency_key` mechanism, the `page_view` write path never sets one.

This confirms the request's own framing: `page_view` cannot answer "which authenticated user returned," is subject to marketing-consent opt-out, and has no dedup — none of which are acceptable properties for the new authenticated-activity signal.

---

## 5. Current "Last dashboard visit" logic

This is **not** part of the `analytics_events`/`page_view` system at all — it is a separate, purpose-built mechanism, and it is the strongest existing template for the new feature.

**Column:** `public.users.last_dashboard_seen_at` (added in `supabase/migrations/202607210001_user_activity_tracking_fields.sql`, alongside `successful_extract_count` and `last_extract_at`). Column comment: *"Owner-analytics only. Timestamp of the most recent dashboard visit, rate-limited to at most once per 4-hour window."*

**Write RPC**, `supabase/migrations/202607210002_user_activity_write_rpcs.sql`:
```sql
create or replace function public.record_dashboard_visit(p_user_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.users
  set last_dashboard_seen_at = now()
  where id = p_user_id
    and (
      last_dashboard_seen_at is null
      or last_dashboard_seen_at < now() - interval '4 hours'
    );
$$;
```
Execute granted only to `service_role`.

**Trigger** — `app/components/dashboard-client.tsx`, a dedicated `useEffect` keyed **only** on `userId` (deliberately separate from the tasks-loading effect, so internal tab navigation never re-fires it):
```ts
useEffect(() => {
  if (!userId) return;
  fetch("/api/activity/dashboard-visit", {
    method: "POST",
    keepalive: true,
  }).catch(() => {});
}, [userId]);
```

**API route** — `app/api/activity/dashboard-visit/route.ts`:
- Resolves the user **server-side** from the Supabase session (`getAuthenticatedUserId()`) — never trusts a client-supplied id.
- **Not owner-restricted** — any authenticated user triggers it for their own row.
- Defers the actual RPC call via Next.js `after()`, so the HTTP response returns immediately.
- **Always returns 200**, regardless of auth state or write outcome (documented explicitly in the route's own comment).
- **Explicitly bypasses analytics consent** — the calling `useEffect`'s own code comment states: "does not depend on analytics-cookie consent."

**Read path** — `public.get_owner_user_activity_report()` RPC selects `last_dashboard_seen_at` directly from `public.users` (no `analytics_events` involved), consumed by `app/admin/analytics/users/page.tsx` and rendered as the "Last dashboard visit" column.

### Is it trustworthy?

**Partially — accurate but coarse, and not owner/test-filtered at the data layer.**
- ✅ It is a genuine, server-resolved, per-request `now()` timestamp — not derivable from an API call, a background poll, a prefetch, or middleware (the only caller in the repo is this one client-mounted `useEffect`).
- ⚠️ It self-rate-limits to once per 4 hours per user, so it under-represents visit frequency within that window and cannot answer "how many distinct days was this user active" or produce any timeline — it is a single scalar, not an event log.
- ⚠️ **It does not exclude the owner's own account or test accounts at the data layer.** The owner's own dashboard visits populate this exact same column; exclusion happens only as an optional client-side UI filter (`isOwnerOrTest`, default-hidden checkbox) on the *already-fetched* row set, not in the underlying data or the RPC's `WHERE` clause.

This is why the request's "did an authenticated user return" question is currently unanswerable with confidence for anything finer-grained than "sometime in roughly the last several hours to N×4-hour windows," and cannot answer "which page" or "returning user (2+ distinct days)" at all.

---

## 6. Current owner/test exclusion logic

`lib/auth/owner.server.ts` (full file, `server-only`):
```ts
export function getOwnerEmails() {
  return (process.env.TEXT2TASK_OWNER_EMAILS ?? "")
    .split(/[\s,]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
export function isOwnerEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return false;
  return getOwnerEmails().includes(normalizedEmail);
}
export async function requireOwner() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email || !isOwnerEmail(user.email)) {
    notFound();
  }
}
```
- Mechanism: a single **environment variable**, `TEXT2TASK_OWNER_EMAILS` (comma/whitespace-separated email list), lowercased/trimmed at read time. No DB role column, no `profiles`/`users` boolean flag, no internal allowlist table.
- This one list serves **two undistinguished purposes**: (a) gating `/admin/*` access (`requireOwner()`, called first-line in both `app/admin/analytics/page.tsx` and `app/admin/analytics/users/page.tsx`; failure → `notFound()`, a 404, not a login redirect), and (b) flagging rows as "owner/test" for exclusion on the Users & Activity table (`isOwnerEmail()` called per-row).
- Server-only (`import "server-only"` at the top) — cannot be bundled into client code. Only the already-computed boolean (`isOwnerOrTest`) crosses to the client, never the email list itself.
- UI toggle: `user-activity-table.client.tsx`, `useState(false)` (hidden by default), a plain client-side `.filter()` over the already-fetched full row set — toggling it triggers **no new network request**.
- The Overview page does not use this mechanism for row-level exclusion at all; its only "exclusion" is unrelated and path-based (`filterOwnerTrafficRows` drops `page_path` rows starting with `/admin` from traffic stats, unconditionally, no toggle).

### Recommendation
Keep the env-var mechanism for `/admin` **access gating** unchanged — it works, and changing it is out of scope. For the **flagging** concern specifically (which is really a data-classification problem, not an access-control problem), recommend evolving toward a `public.users.is_internal_test_account boolean not null default false` column as a **future, independent improvement** — it would (a) let a test account be flagged even if its email isn't an owner-domain address, (b) be indexable/filterable directly in SQL instead of requiring a per-row JS computation after fetching every row via the Auth Admin API, (c) not silently break if a real customer's email happens to collide with a pattern. **This is not required for the feature in this document** — the new tracking should reuse the existing `isOwnerEmail()` mechanism for consistency with how Users & Activity already flags rows, exactly as `record_dashboard_visit` already does today.

---

## 7. Current admin analytics queries and UI

### Route/auth map
- `app/admin/layout.tsx` — trivial, only sets `robots: noindex`. No auth check here.
- `app/admin/analytics/page.tsx` — Overview. Single file, all loaders inline, no client components (fully server-rendered). Calls `requireOwner()` first line.
- `app/admin/analytics/users/page.tsx` — Users & Activity. Server component with loaders (`loadOwnerActivityReport`, `loadAllAuthUsers`, `mergeUserActivity`); renders the client component `app/admin/analytics/users/user-activity-table.client.tsx`. Calls `requireOwner()` first line.
- **No middleware** exists at all in the repo — every `/admin` protection is per-page.

### Users & Activity — data provenance (confirmed field-by-field)

| Field | Source |
|---|---|
| Email, Verified, Provider, Last sign-in, Signup date (primary) | `supabaseAdmin.auth.admin.listUsers()` — Supabase Auth Admin API, paged up to 5,000 accounts, **not** a direct SQL query against `auth.users` |
| Last dashboard visit, Successful extracts, Last extract, Plan, Subscription status | `public.get_owner_user_activity_report()` RPC → `public.users` |
| Project count, First/last project | Same RPC's `project_stats` CTE aggregating `public.projects` |
| Profile OK/Missing | `hasProfile = profile !== null` in the RPC result set |
| Active last 7 days | `now - lastActivityAt ≤ 7 days` (client-computed) |
| Users who extracted / Never extracted | `successfulExtractCount > 0` / `=== 0` |
| Owner/test flag | `isOwnerEmail(authUser.email)`, computed server-side, shipped as a plain boolean |

The RPC's own migration comment is explicit: *"This function reads only public.users and public.projects. It does NOT read auth.users."* — confirming the two-source merge is deliberate design, not an oversight.

**No pagination** — up to 2000 rows from the RPC, up to 5000 from Auth, rendered in one page load. **Fixed sort**, not user-controllable: `lastActivityAt` descending, where `lastActivityAt = latestOf(lastSignInAt, lastDashboardSeenAt, lastExtractAt, lastProjectAt)`. Filtering (7 preset buttons + the owner/test checkbox) is entirely client-side over the already-loaded array.

**Timezone**: explicit `Asia/Jerusalem`, in `user-activity-table.client.tsx`:
```ts
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jerusalem",
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  hourCycle: "h23",
});
```
Page copy states this explicitly: *"Private internal view. Times shown in Israel time (24-hour)."* — **any new timestamp columns/computations must use this same `Asia/Jerusalem` convention**, including "distinct active days," which must be bucketed by Israel-time calendar date, not UTC.

### Overview — data provenance

| Metric | Source |
|---|---|
| Tracked events today/7d/30d, page views, tracked visitors | Raw `analytics_events` query (30-day window, ≤5000 rows, `/admin` paths excluded), bucketed in-memory by window boundary |
| Source/campaign, Country | Grouped from the same in-memory row set |
| Recent traffic events | Top 25 of the same row set |
| Product activation (total/activated users, rate, total projects, recent users) | `get_owner_product_activation_analytics()` RPC — reads `public.users`/`public.projects` directly, **not** `analytics_events` |
| Source/campaign/country on the recent-users table | A *separate* `analytics_events` query filtered to `signup_attribution_captured`/`signup_success` for those 25 user ids |

**Country detection**: `x-vercel-ip-country` header, falling back to `cf-ipcountry` (Cloudflare) — no IP address is ever stored, only the derived 2–3 letter country code.

**Activation definition** (Overview): a user counts as activated if they have **at least one row in `public.projects`** — "including archived and soft-deleted projects" per the RPC's own comment. This is a *different* definition from Users & Activity's "extracted/never extracted," which is based on `successful_extract_count`.

### Critical structural finding
**The Overview traffic queries have no `event_name` filter** — `loadTrafficRows()` selects every row in the 30-day window regardless of event type, and only differentiates `page_view` from "everything else" for the "page views" sub-metric. **Anonymous marketing traffic and authenticated in-app events already share one undifferentiated stream today, structurally.** This is the decisive fact behind the recommendation in §10 to use a separate table for the new feature: adding 10 new, comparatively high-frequency authenticated view events into `analytics_events` would silently inflate "tracked events today/7d/30d" on Overview unless that page's queries were also updated with an explicit exclusion — an additional coupled change this mapping recommends avoiding entirely by not sharing the table.

---

## 8. Authenticated route/component map

**Server-side auth guard**: `lib/supabase/requireDashboardUser.ts`:
```ts
export async function requireDashboardUser(): Promise<AppUser> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) { redirect("/login"); }
  if (!user.email) { redirect("/login"); }
  return ensureUser({ id: user.id, email: user.email });
}
```
A hard server-side `redirect()` before any markup renders.

**Only two of four `app/dashboard/**/page.tsx` files call it:**

| Route file | Calls `requireDashboardUser()`? |
|---|---|
| `app/dashboard/page.tsx` | ✅ first line |
| `app/dashboard/calendar/page.tsx` | ✅ first line |
| `app/dashboard/billing/page.tsx` | ❌ — `"use client"`, self-checks via a 401 from `/api/billing/subscription` inside a `useEffect`, after first paint |
| `app/dashboard/profile/page.tsx` | ❌ — same client-only pattern as billing |

(Billing/Profile are not among the 12 requested surfaces, so this gap does not block this feature, but it means neither of those two routes could safely host this style of instrumentation without adding a server guard first — noted here for completeness, not part of this feature's scope.)

### The 12 requested surfaces

| # | Surface | File | Kind | Trigger | Prefetch risk | Entity available | Auth confirmed before mount |
|---|---|---|---|---|---|---|---|
| 1 | Dashboard | `app/dashboard/page.tsx` → `app/components/dashboard-client.tsx` | Real route + client state (`activeNav="dashboard"`) | Route load / sidebar click | Route is `<Link>`-prefetchable; the tab itself is a `<button>`, no prefetch | `userId`, `email` | ✅ `requireDashboardUser()` in the route |
| 2 | Extract | `app/components/dashboard/extract-workspace.tsx` (`ExtractWorkspace`) | Client state only (`activeNav="extract"`) inside `DashboardClient` | Sidebar "Extract" click, or `?view=extract` | None — state toggle | none at this level | ✅ same as #1 |
| 3 | Task CRM | `app/components/dashboard/tasks-view.tsx` (`TasksView`) | Client state only (`activeNav="tasks"`) | Sidebar "Tasks" click, or `?view=tasks` | None | `project_id` per group | ✅ same as #1 |
| 4 | Calendar | `app/dashboard/calendar/page.tsx` → `app/components/dashboard/calendar/work-calendar-client.tsx` | Real route | `<Link href="/dashboard/calendar">` | Prefetch-eligible (real route) | none at top level | ✅ `requireDashboardUser()` in the route |
| 5 | Sidebar | `app/components/dashboard/dashboard-sidebar-profile.tsx` | Composed into both parents | N/A | Routed mode uses real `<Link>`s (prefetchable); workspace mode uses `<button>` | none | ✅ only ever rendered post-guard |
| 6 | Routed dashboard shell | `app/components/dashboard/routed-dashboard-shell.tsx` | Wrapper component | N/A | Inherits from whatever route mounted it | none | ✅ only ever instantiated from `/dashboard/calendar` today |
| 7 | Project card expansion | `app/components/dashboard/tasks/desktop-tasks-table.tsx` / `mobile-task-card.tsx` | Client `useState` toggle (`openProjectKeys`/`isOpen`) | "Open details" button | None | `getResolvedProjectId(project)` in scope | ✅ same as #1/#3 |
| 8 | Resources | `app/components/dashboard/resources/resource-manager-modal.tsx` | Client `useState` modal (`resourcesProject` in `TasksView`) | "Resources" button in an expanded card | None | `projectId` prop | ✅ same as #1/#3 |
| 9 | History | `app/components/dashboard/tasks/project-updates/project-update-history-modal.tsx` + `use-project-update-history.ts` | Client `useState` modal | "History" button in an expanded card | None | `project.project_id` | ✅ same as #1/#3 |
| 10 | Add Client Update | `app/components/dashboard/tasks/project-updates/project-update-modal.tsx` + `use-project-update.ts` | Client `useState` modal | "Add update" button | None | `project` in `uiState.modal` | ✅ same as #1/#3 |
| 11 | Calendar day detail | `app/components/dashboard/calendar/calendar-day-dialog.tsx`, mode `"day"` | Client `useState` (`activeDialog`) in `WorkCalendarClient` | Day-cell click | None | `date: DateOnly` | ✅ same as #4 |
| 12 | Calendar manual event detail/edit | Same file, mode `"edit"` | Client `useState` (`activeDialog`) | "Edit" on a manual event row | None | `event.id` (full `ManualCalendarEventItem`) | ✅ same as #4 |

**Structural conclusion:** only #1 and #4 are real, prefetchable Next.js routes; the other 10 are pure client-side state transitions inside those two routes, with zero prefetch risk and auth already guaranteed confirmed by the time any of them can render. This sharply simplifies the "could tracking accidentally fire before auth is confirmed / from a prefetch" concern raised in the request — for these 12 surfaces specifically, it structurally cannot happen.

`getResolvedProjectId()` is independently duplicated in at least four places (`tasks-view.tsx`, `desktop-tasks-table.tsx`, `use-project-update.ts`, `use-project-update-history.ts`). New instrumentation should call whichever local resolver is already in scope at each site rather than introducing a fifth copy or attempting to deduplicate the existing ones (out of scope for this feature).

**The existing dashboard-visit `useEffect` in `DashboardClient` is the direct template** — same file, same component, already doing exactly the "fire once per genuine mount, keyed on a primitive identity value, fire-and-forget" pattern this feature needs to replicate nine more times.

---

## 9. Gaps preventing reliable passive-user identification

1. `page_view` never carries `user_id` — anonymous by construction, cannot answer "which user."
2. `page_view` is consent-gated — a user who rejects marketing analytics produces zero signal, even though "did my paying customer open the app" is arguably an operational, not marketing, question.
3. `page_view` has no dedup — not safe to build a reliable "distinct visit" or "distinct day" count on top of it.
4. `last_dashboard_seen_at` is real and trustworthy for "did they open the dashboard within roughly the last several hours," but is a single scalar: no page-level granularity, no timeline, no distinct-day count, no returning-user calculation, and does not exclude owner/test accounts at the data layer.
5. No existing mechanism captures Extract/Task-CRM/Calendar-specific views, project expansion, Resources, History, Add Client Update, or calendar day/event views **at all** — these are pure gaps, not weak signals.
6. No mechanism anywhere merges multiple sources into a single per-user chronological timeline (the closest thing, `project_timeline_events`, is project-scoped and AI-update-flow-only).

---

## 10. Recommended minimal architecture

### Options evaluated

| | A: extend `analytics_events` | B: new `authenticated_product_events` table | C: raw table + summary view/RPC | D: safe combination |
|---|---|---|---|---|
| Compatible with existing traffic analytics | ⚠️ Requires also patching Overview's unfiltered traffic query to exclude the new event names — a coupled, easy-to-forget change | ✅ Structurally impossible to pollute Overview; zero changes needed there | orthogonal | ✅ |
| Consent requirements | Shares one table with consent-gated `page_view` — awkward to apply a *different* consent rule to some rows in the same table | ✅ Own table, own (consent-independent) policy, matching the `record_dashboard_visit` precedent | orthogonal | ✅ |
| Privacy/clarity | Mixes anonymous marketing rows with authenticated operational rows | ✅ Clean separation of concerns, self-documenting table name | orthogonal | ✅ |
| Indexes/RLS | Reuses existing indexes, but they're UTM/country-shaped — meaningless for this data | ✅ Purpose-built, smaller indexes | needed either way | ✅ |
| Admin query performance | fine either way | fine | An RPC for aggregation (distinct days, returning-user, last-seen) is needed regardless of A vs. B — raw per-row queries from the client are not appropriate | ✅ RPC included |
| Migration risk | Lower (no new table) | Slightly higher (new table + RLS + grants), but mechanical and precedented | — | Accepted, low |
| Future maintenance / retention | Retention policy would have to special-case rows by `event_name`, awkward | ✅ Independent retention policy possible later, doesn't affect marketing data | — | ✅ |
| Owner/test filtering | Same mechanism reused either way | Same mechanism reused either way | — | Reuses `isOwnerEmail()`, no new mechanism |

### Final recommendation: **Option D** — a new `authenticated_product_events` table (Option B) plus a dedicated summary/timeline RPC for the admin UI (Option C's aggregation idea), explicitly **not** extending `analytics_events`.

This is not a new architectural style for this codebase — it is the *same choice* the codebase already made for `last_dashboard_seen_at`/`record_dashboard_visit`: authenticated, operational, per-user activity signals live in their own purpose-built mechanism, separate from the anonymous marketing-attribution pipeline. This mapping simply generalizes that existing precedent from "one scalar column" to "one small append-only event table," because a scalar cannot answer the request's timeline/distinct-days/returning-user questions.

`last_dashboard_seen_at`/`record_dashboard_visit` itself is **left completely unchanged** — it is cheap, already deployed, and nothing about this proposal requires touching it. The new table is a strictly additive second signal with finer granularity.

Action-event tracking (`project_saved`, `client_update_applied`, etc. — the names already reserved-but-unused in `analytics_events`'s own allowlist) is **deliberately not built** as part of this feature. Per §13, those actions are already reliably inferable from existing domain-table timestamps; building explicit action events for them would be genuinely new instrumentation work outside this mapping's minimal scope. If/when product-action event tracking is ever built, `analytics_events`'s own already-reserved names are its natural home — kept structurally separate from this view-only table.

---

## 11. Exact event contract

### Naming convention audit

The existing `ALLOWED_EVENT_NAMES` set uses a consistent `<noun>_<past-tense-verb>` / `<noun>_<status>` pattern: `project_saved`, `client_update_created`, `client_update_applied`, `email_confirmed`, `login_success`, `signup_success`. The request's proposed names already fit this convention well and are adopted, with two small adjustments for consistency with names actually used in this codebase, and one event dropped:

| Requested name | Recommended name | Reason |
|---|---|---|
| `authenticated_app_opened` | **Not implemented** | See analysis below |
| `dashboard_viewed` | `dashboard_viewed` | Matches convention as-is |
| `extract_viewed` | `extract_viewed` | Matches convention as-is |
| `task_crm_viewed` | `tasks_viewed` | Matches the codebase's own internal identifier (`activeNav: "tasks"`, `TasksView` component, `?view=tasks`) rather than the marketing term "Task CRM" |
| `calendar_viewed` | `calendar_viewed` | Matches convention as-is |
| `project_details_expanded` | `project_details_expanded` | Matches convention as-is |
| `project_resources_viewed` | `project_resources_viewed` | Matches convention as-is |
| `project_history_viewed` | `project_history_viewed` | Matches convention as-is |
| `client_update_workflow_opened` | `client_update_opened` | Matches the existing `client_update_created`/`client_update_applied` noun prefix exactly; "workflow" isn't used as a modifier anywhere else in the codebase |
| `calendar_day_viewed` | `calendar_day_viewed` | Matches convention as-is |
| `calendar_event_viewed` | `calendar_event_viewed` | Matches convention as-is |

### Is `authenticated_app_opened` needed?

**No — recommend dropping it.** Every authenticated session necessarily produces at least one of the other nine view events as its first row (a user cannot reach any of the 12 surfaces without first rendering `/dashboard` or `/dashboard/calendar`, both of which fire their own `_viewed` event on mount). "Did the user return" and "what was their most recent activity" are both fully answerable by asking "does any row exist for this user on this date" / "what is `MAX(created_at)` for this user" against the unified event table — a synthetic wrapper event adds one extra write per session with zero additional analytical value. This directly answers the request's own question: **the first authenticated route view is sufficient.**

### Final event list (10 events)

| Event name | `entity_type` | `entity_id` | Fires from |
|---|---|---|---|
| `dashboard_viewed` | — | — | `DashboardClient` mount, `activeNav === "dashboard"` |
| `extract_viewed` | — | — | `DashboardClient`, `activeNav → "extract"` |
| `tasks_viewed` | — | — | `DashboardClient`, `activeNav → "tasks"` |
| `calendar_viewed` | — | — | `WorkCalendarClient` mount |
| `project_details_expanded` | `project` | project UUID | `toggleProject`/`setIsOpen` on transition to open only |
| `project_resources_viewed` | `project` | project UUID | `ResourceManagerModal`'s existing `useEffect([isOpen, projectId])`, on `isOpen → true` |
| `project_history_viewed` | `project` | project UUID | `use-project-update-history.ts`'s `openHistory()` |
| `client_update_opened` | `project` | project UUID | `use-project-update.ts`'s `openModal()` |
| `calendar_day_viewed` | `calendar_day` | ISO date (`YYYY-MM-DD`) | `WorkCalendarClient.handleSelectDate` → `activeDialog = {mode:"day", date}` |
| `calendar_event_viewed` | `calendar_event` | event UUID | `activeDialog = {mode:"edit", event}` transition only (not `"create"`) |

### Minimal event data (exact columns)

```
id            uuid        — server-generated
user_id       uuid        — server-resolved from the session, never client-supplied
event_name    text        — validated against a dedicated allowlist (see §17, item 3)
route         text        — clamped pathname, e.g. current pathname at fire time
entity_type   text null   — one of: 'project' | 'calendar_event' | 'calendar_day'
entity_id     text null   — UUID string (project/calendar_event) or ISO date string (calendar_day); format validated per entity_type, never trusted as-is
idempotency_key text null — server-computed (see §12), not client-supplied
created_at    timestamptz — server clock, default now()
```

No `metadata` jsonb column is included — unlike `analytics_events`, this table has no legitimate use case for free-form payloads in its minimal form, which removes an entire category of "did someone accidentally put sensitive data in here" risk. If a genuine need for small structured context ever appears, it should be added deliberately later, not defaulted to `{}` up front.

**Explicitly not stored, anywhere, ever:** client messages, raw extraction text, task text, project titles, client names, contact names, email content, customer email addresses, phone numbers, budgets, notes, uploaded file names/content, screenshot content, large metadata payloads, browser fingerprinting data. The schema above structurally cannot hold any of these — there is no free-text field large enough or intended for it.

---

## 12. Deduplication design

**Problem:** a plain, permanent unique constraint on `(user_id, event_name, route, entity_id)` would be *wrong* — it would prevent ever recording a second, genuinely distinct visit to the same page on a later day, which would silently break the "distinct active days" and "returning user" calculations that are the entire point of this feature. The dedup window must be **time-bounded**, not permanent.

**Recommendation: reuse `analytics_events`'s own proven mechanism — a nullable `idempotency_key text` column plus a unique partial index — but compute the key with a short, server-clock-bucketed window,** exactly matching the option the request calls "a short dedupe window based on `user_id + event_name + route + entity_id`" combined with "a server-generated idempotency key":

```
idempotency_key = `${userId}:${eventName}:${route}:${entityId ?? "none"}:${bucket}`
where bucket = floor(serverNowMs / (5 * 60 * 1000))   // 5-minute server-clock bucket
```

- The bucket is computed from the **server's own clock** at insert time — never from a client-supplied timestamp — so it cannot be manipulated by a slow client, clock skew, or a malicious caller.
- Two fires within the same 5-minute bucket collide on the unique partial index; the insert helper catches the Postgres unique-violation error code (`23505`) and treats it as a successful no-op — **exactly** the existing pattern already implemented as `isDuplicateIdempotencyKeyError()` in `lib/analytics/internal-events.server.ts`, reused verbatim rather than reinvented.
- Fires more than 5 minutes apart get different bucket values and both succeed — so a genuine second visit later the same day, or the next day, is correctly recorded.
- 5 minutes comfortably absorbs every enumerated false-positive risk: React re-renders, Strict-Mode double-invocation (dev-only), a rapid double-click, a network retry, a duplicated effect run — all of these resolve within milliseconds to low seconds, far inside the bucket.

**Client-side defense-in-depth (secondary, not authoritative):** a small `sessionStorage`-backed set of "already tracked in this tab session" keys, checked before even making the network call, to reduce redundant requests in the common case. This is explicitly *not* the source of truth — it doesn't survive a refresh, a new tab, or a client bug — the server-side idempotency key is what guarantees correctness.

**Options considered and rejected:**
- *Client-generated navigation ID, validated server-side*: adds complexity without adding real dedup value over the time-bucket approach, since it's still just a nonce the server has to trust was generated once per navigation.
- *A dedicated insert RPC with `ON CONFLICT` SQL*: functionally equivalent to catching the unique-violation error code in application code, which is the existing, already-tested pattern — no need to introduce a second dedup mechanism.
- *Heartbeat writes*: explicitly excluded by the request; not evaluated further.

**Trigger discipline** (applies uniformly to all 10 events, matching the existing `dashboard-visit` `useEffect` pattern exactly): fire from a `useEffect` keyed on a **primitive** dependency that only changes on a genuine, deliberate transition (`userId` for mount-based events; `activeNav`'s specific value for tab switches; `isOpen` transitioning to `true` for modals; `activeDialog`'s discriminated `mode`/entity for the calendar dialogs) — never on an object/array whose identity changes every render. This, combined with the server-side dedup window, is what satisfies every deduplication requirement in the request (React rerenders, Strict Mode, server component rendering, route prefetching, `<Link>` prefetch, API requests, middleware, background polling, refresh retries, network retries, duplicated effects, inactive tabs, analytics endpoint retries) without needing a heartbeat or a client-trusted identity signal.

---

## 13. Write-action audit and timeline recommendation

Per-action findings (full detail from the research pass; condensed here):

| Action | Explicit analytics event today? | Inferable from domain data? |
|---|---|---|
| Extraction completed | No | **Partial** — `public.users.last_extract_at` (latest only) + `successful_extract_count` (lifetime total); no per-event history |
| Project saved | No (`project_saved` reserved, unused) | **Yes, fully** — `projects.created_at`; already used by the existing activation RPC |
| Project updated | No | **Partial** — `updated_at` exists but the direct-edit route (`/api/projects/update`) doesn't explicitly set it in all cases (relies on an untracked DB trigger); no old/new-value trail on that path |
| Project archived | No | **Yes, fully** — `is_archived` + `archived_at`, set exactly at archive time; restore clears both |
| Project completed | No | **Yes, fully** — `completed_at`, set once and permanently preserved even if status later changes |
| Subtask/task status changed | No | **Partial** — current `status` + `completed_at` (first-Done-only) + `updated_at`; no full transition history for direct edits |
| Client update analyzed | No (`client_update_created` reserved, unused) | **Yes, fully** — already has a dedicated, richer audit trail: `project_updates.analyzed_at` + a `project_timeline_events` row (`event_type='ai_update_analyzed'`) |
| Client update applied | No (`client_update_applied` reserved, unused) | **Yes, very thoroughly** — the richest trail in the codebase: `project_updates.applied_at/by`, `project_update_items.old_value/new_value`, per-item `project_timeline_events` rows |
| Resource added | No | **Weak** — `task_resources.created_at` exists (creation only, no edit timestamp), but no `project_timeline_events` row despite `resource_added` being reserved in that table's own CHECK constraint |
| Calendar event created/updated | No | **Yes, fully** — `calendar_events.created_at`/`updated_at` (the latter DB-trigger-enforced, not ad hoc), `deleted_at` for soft-delete |
| CSV exported | No | **No trace at all** — purely a client-side `Blob`/`URL.createObjectURL` download; no server request of any kind is made |

Two existing partial "activity feed" mechanisms were found and are relevant context: (1) `project_timeline_events` + `/api/project-updates/history` — real, but project-scoped and populated only by the AI client-update flow; (2) `DashboardRecentActivity` — a pure client-side re-derivation from already-loaded task rows, not a backend feed, no field-level detail, not owner-visible.

### Recommendation for the Users & Activity timeline

**Minimal safe combination**, per the request's own third option framed as "infer meaningful actions from domain tables" plus the new view-only events:

- **View-only activity** → read from the new `authenticated_product_events` table (the 10 events in §11).
- **Meaningful-action activity** → inferred, read-only, from existing domain-table timestamps already audited above (`projects.created_at/archived_at/completed_at`, `tasks.completed_at`, `calendar_events.created_at/updated_at`, `project_updates.applied_at`, `project_timeline_events` rows) via a **new read-only RPC**, not new write instrumentation.
- **Do not** retroactively wire up `analytics_events`'s reserved-but-unused action names (`project_saved`, `client_update_created`, `client_update_applied`) as part of this feature — building those would be genuinely new write instrumentation outside this mapping's minimal scope, and the domain-table inference already covers the same ground for the actions that matter most (save/archive/complete/calendar-event).
- The one true gap — **CSV export has zero trace** — is out of scope for this mapping (not one of the requested view events); flagged here only as a fact for the owner's awareness, not something this document designs a solution for.

This lets the admin UI distinguish "View-only activity" vs. "Meaningful action activity" (the request's explicit UI requirement) by **merging two read sources**, not by adding a flag column to one table — no second source of truth is built for data that already exists.

---

## 14. Database proposal

**Table name:** `public.authenticated_product_events`

```sql
create table if not exists public.authenticated_product_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  event_name text not null,
  route text not null,

  entity_type text null,
  entity_id text null,

  idempotency_key text null,

  created_at timestamptz not null default now(),

  constraint authenticated_product_events_route_length_check
    check (char_length(route) <= 300),
  constraint authenticated_product_events_entity_type_check
    check (entity_type is null or entity_type in ('project', 'calendar_event', 'calendar_day')),
  constraint authenticated_product_events_entity_id_length_check
    check (entity_id is null or char_length(entity_id) <= 64)
);
```

**Why `on delete cascade`, unlike `analytics_events`'s `on delete set null`:** this table only ever holds authenticated-user rows by design (no anonymous rows are ever written here), so a row without its user is meaningless — deleting a user's account should remove their view-activity history, consistent with data-minimization expectations. (`analytics_events` uses `set null` because it must preserve anonymous-attributable marketing rows even after an account is deleted — a concern that doesn't apply here.)

**Why no DB-level enum/CHECK on `event_name`:** mirrors `analytics_events`'s own existing choice — enforcement lives in a server-side allowlist (§17, item 3) so adding a new event name never requires a new migration, exactly as today.

**Indexes:**
```sql
create index if not exists authenticated_product_events_user_id_created_at_idx
  on public.authenticated_product_events (user_id, created_at desc);
create index if not exists authenticated_product_events_event_name_idx
  on public.authenticated_product_events (event_name);
create unique index if not exists authenticated_product_events_idempotency_key_unique_idx
  on public.authenticated_product_events (idempotency_key)
  where idempotency_key is not null;
```
The first index is the primary access pattern (a user's own timeline, newest first). The second supports admin-side filtering/aggregation by event type. The third is the dedup mechanism from §12.

**RLS:**
```sql
alter table public.authenticated_product_events enable row level security;
```
**No policies** — mirrors `analytics_events` exactly. Combined with the grants below, this is default-deny for every role except `service_role`. Authenticated users must never be able to read even their own rows directly via PostgREST; every read goes through an owner-only RPC.

**Grants:**
```sql
revoke all on table public.authenticated_product_events from public, anon, authenticated;
grant select, insert on table public.authenticated_product_events to service_role;
```
No `update`/`delete` — rows are append-only, exactly like `analytics_events`.

**Database functions/RPCs** (read-side, for the admin UI — §16):
- `public.get_owner_authenticated_activity_summary(p_user_ids uuid[])` — per-user `{ last_seen, last_viewed_route, last_event_name, total_views, distinct_active_days, is_returning }`, computed with `distinct_active_days` bucketed by **`(created_at at time zone 'Asia/Jerusalem')::date`**, matching the existing Israel-time convention exactly. `is_returning := distinct_active_days > 1`.
- `public.get_owner_user_activity_timeline(p_user_id uuid, p_limit int default 200)` — ordered `{ created_at, event_name, route, entity_type, entity_id }` rows for one user's detail view, `order by created_at desc`.

Both `security invoker`, `stable`, `service_role`-execute-only, matching the two existing RPCs exactly in style.

**Retention:** no retention policy exists for `analytics_events` today either (a pre-existing gap, not introduced by this feature). Recommend defining one for the new table before shipping (e.g., 12–18 months), and separately flagging that `analytics_events` itself should probably get one too — but that is an existing gap, not a blocker for this feature.

**Migration sequence** (not applied in this phase):
1. `<timestamp>_authenticated_product_events.sql` — table, indexes, RLS, grants (as above).
2. `<timestamp>_owner_authenticated_activity_report_rpc.sql` — the two RPCs above.

---

## 15. RLS and security

Every requirement in the request maps directly onto a specific design decision already made above:

| Requirement | How it's satisfied |
|---|---|
| `user_id` resolved server-side | New endpoint reuses the exact `getAuthenticatedUserId()`-style session check already proven in `app/api/activity/dashboard-visit/route.ts` |
| No client-selected user ID | The request body never contains a `userId` field at all — it is not part of the event contract (§11) |
| Authenticated users cannot read analytics | RLS enabled, zero policies, no `authenticated`/`anon` grants — identical posture to `analytics_events` |
| Only owner/admin route can query cross-user activity | Both new RPCs are `service_role`-execute-only; called only from `app/admin/analytics/users/page.tsx` and the new `[userId]` route, both behind `requireOwner()` |
| No service-role secret exposed to the browser | `supabaseAdmin` is already `server-only`-guarded; the new write helper follows the same pattern |
| Safe event-name allowlist | New dedicated `Set` in `lib/activity/product-event-contracts.ts`, mirroring `ALLOWED_EVENT_NAMES`'s structure |
| Safe route/surface allowlist | `route` is clamped by length (DB CHECK, backstopped by server-side clamping before insert); no allowlist of exact paths is needed since it's stored as plain clamped text, not interpreted |
| Safe optional entity type | DB CHECK restricts `entity_type` to exactly 3 values |
| Validated UUID entity IDs | Server-side format validation per `entity_type` before insert (UUID regex for `project`/`calendar_event`, `YYYY-MM-DD` regex for `calendar_day`) — invalid values are dropped, not stored |
| Payload size limit | Route/entity fields clamped to small fixed lengths (300/64 chars); no free-form `metadata` field exists in this table at all (§11) |
| Rate limiting / dedup | The 5-minute idempotency-bucket mechanism (§12) |
| Analytics failures fail closed for analytics, fail open for product | The write endpoint always returns 200 and the client never awaits/branches on it — identical to the existing `dashboard-visit` route's own documented behavior |
| No sensitive content in analytics data | No free-text field exists in the schema capable of holding it (§11) |

**Owner authorization reuse:** the new admin surfaces (extended Users & Activity columns, new `[userId]` timeline route) sit behind the exact same `requireOwner()` call already used by both existing admin pages — no new authorization mechanism is introduced.

---

## 16. Consent and privacy implications

### How consent currently works
A single binary choice (`accepted`/`rejected`, no granular categories), stored in `localStorage` + a first-party cookie (`t2t_analytics_consent`). It gates exactly four things, all mounted in the root layout: `page_view` tracking, the Google Ads tag script, Microsoft Clarity, and Vercel Analytics/Speed Insights. It applies identically on `/dashboard` as on public marketing pages (both are covered by the root layout; only `/admin*` is excluded).

**The one existing, documented exception is `record_dashboard_visit`** — its own code comment states it "does not depend on analytics-cookie consent," i.e., it is already treated as essential/operational rather than marketing analytics.

### Recommendation
Treat the new `authenticated_product_events` tracking the same way, for the same reasons: it is server-resolved to a real authenticated `user_id` (not anonymous/cookie-based), carries no marketing attribution (no UTM/referrer/campaign fields), and exists for account-security/product-operation visibility rather than ad targeting or campaign measurement — a materially different purpose than the marketing-analytics pipeline the consent banner's own copy describes ("understand traffic and improve the product... Google Analytics... Microsoft Clarity"). This is architecturally consistent with the one precedent the codebase has already established for exactly this class of data.

**This is not a legal conclusion** — only an architectural recommendation consistent with the existing precedent and the current Privacy Policy's own framing of "non-essential analytics" as the thing users can reject. A legal/privacy review is recommended before shipping.

### Privacy Policy / Terms — wording check
`app/privacy/page.tsx`, Section 5 ("Cookies, analytics, and attribution") already broadly covers "signup and product usage events" under the analytics/cookies umbrella that the consent banner gates, and separately states that analytics events "are designed not to store raw client messages, uploaded screenshots, project content, task text, summaries, files, notes, resources, passwords, tokens, or private client data" (already true for the schema proposed in §14). `app/terms/page.tsx`, Section 8, is a single brief paragraph referencing analytics generally.

**Recommendation:** a small, additive wording update to Privacy Policy §5 is likely warranted — explicitly distinguishing "product usage/navigation events for your own authenticated account (used for account security, support, and product-operation purposes)" from the "non-essential analytics" the banner already describes as consent-gated, mirroring the distinction this document draws architecturally. **No legal page was modified in this mapping phase**, per the rules; this is a flag for review before implementation, not drafted language.

---

## 17. Admin UI proposal

### Users & Activity table extension (minimal — no redesign)

New columns, sourced from `get_owner_authenticated_activity_summary()`:

| New field | Definition |
|---|---|
| Last seen | `MAX(created_at)` across all 10 event types for this user |
| Last viewed page | `route` of the most recent row |
| Last authenticated event | `event_name` of the most recent row |
| Total authenticated views | `COUNT(*)` |
| Distinct active days | `COUNT(DISTINCT (created_at at time zone 'Asia/Jerusalem')::date)` |
| Returning user | `distinct_active_days > 1` — **explicitly defined this way per the request**, using the same Israel-time convention as every other timestamp already on this page |
| View-only activity indicator | Derived client-side: true if the user has view rows but no inferred meaningful-action timestamp newer than their oldest view row (exact threshold is a UI-layer choice, not a schema concern) |
| Last meaningful action | `GREATEST` of the inferred domain-table timestamps from §13 (project saved/archived/completed, calendar event created/updated, client update applied), computed in the same new summary RPC or a small sibling query |

These merge into the existing `OwnerUserActivityRow`/`mergeUserActivity` pattern exactly as the current fields already do (a third data source added to an already-multi-source merge, not a new pattern) and are wired through the **existing** `isOwnerOrTest` filter — new columns must be hidden by default alongside everything else, not exempt from it.

### Per-user detail view — recommended shape

**A dedicated route: `app/admin/analytics/users/[userId]/page.tsx`.**

Reasoning against the alternatives:
- *Expandable table row*: the table already has ~15 columns and no pagination (up to 2000 rows) — inline expansion of a timeline (potentially dozens of rows) inside an already-dense, unpaginated table would be heavy and hard to scan.
- *Side drawer / modal*: nothing else in this codebase's owner-analytics surface uses a drawer/modal pattern (both existing pages are plain server-rendered pages); introducing one here would be a new UI pattern for a two-person internal tool, contradicting "do not redesign the whole analytics interface."
- *Dedicated route*: **matches the existing architecture exactly** — both current admin pages are already separate routes behind `requireOwner()`, both server components with a thin client sub-component for interactivity. A `[userId]` route is the smallest possible extension of that exact pattern, is linkable/bookmarkable for the owner, and needs no new component pattern at all.

**Content** (per the request's own example):
```
15:01 — Dashboard viewed
15:03 — Task CRM viewed
15:04 — Project details expanded
15:06 — Calendar viewed
```
Sourced from `get_owner_user_activity_timeline(p_user_id)`, rendered as a simple ordered list/table: timestamp (Israel time, same formatter as the existing page), event label (human-readable mapping of `event_name`), route/surface, safe entity context (e.g., "Project" with no further identifying text beyond what's already visible elsewhere in the owner UI — no client names/titles pulled into this view), and a view-only/action badge. No sensitive content is possible to show here because none is stored (§11).

---

## 18. Exact file implementation map

**New files:**
1. `supabase/migrations/<timestamp>_authenticated_product_events.sql` — table, indexes, RLS, grants (§14).
2. `supabase/migrations/<timestamp>_authenticated_product_events.test.ts` — static-SQL tests, matching this repo's established migration-testing convention (string/regex assertions against the raw `.sql` file, no live DB).
3. `supabase/migrations/<timestamp>_owner_authenticated_activity_report_rpc.sql` — the two read RPCs (§14).
4. `supabase/migrations/<timestamp>_owner_authenticated_activity_report_rpc.test.ts` — static-SQL tests for the RPCs.
5. `lib/activity/product-event-contracts.ts` — `ALLOWED_PRODUCT_EVENT_NAMES`, entity-type allowlist, route/entity-id validators (mirrors `lib/analytics/internal-events.server.ts`'s allowlist structure).
6. `lib/activity/log-product-event.server.ts` — the service-role write helper (mirrors `logAnalyticsEventSafe`'s structure: timeout, idempotency handling, sanitization, `"server-only"`, swallow-all-errors).
7. `lib/activity/log-product-event.server.test.ts` — unit tests for the helper.
8. `app/api/activity/product-event/route.ts` — the POST endpoint (mirrors `app/api/activity/dashboard-visit/route.ts` exactly: server-side session resolution, always-200, `after()`-deferred write, never owner-restricted since it's per-user).
9. `app/api/activity/product-event/route.test.ts` — route tests.
10. `lib/activity/use-track-product-view.client.ts` — the one shared client-side fire-and-forget helper/hook used by every trigger site, avoiding 10 copies of the same fetch/keepalive/error-swallow boilerplate.
11. `lib/activity/use-track-product-view.client.test.ts` — tests for the shared client helper.
12. `app/admin/analytics/users/[userId]/page.tsx` — the new per-user timeline route (§17).
13. `app/admin/analytics/users/[userId]/user-activity-timeline.client.tsx` — the timeline list component for that route.
14. `app/admin/analytics/users/[userId]/page.test.tsx` (or equivalent, matching whatever test convention exists for the current admin pages once verified at implementation time).
15. `docs/TEXT2TASK_MINIMAL_AUTHENTICATED_ACTIVITY_MAPPING.md` — this document.

**Modified files** (instrumentation call sites — one small addition each, no restructuring):
16. `app/components/dashboard-client.tsx` — add tracking calls for `dashboard_viewed` (alongside the existing `userId`-keyed dashboard-visit effect), `extract_viewed`, `tasks_viewed` (keyed on `activeNav` transitions).
17. `app/components/dashboard/calendar/work-calendar-client.tsx` — add `calendar_viewed` (on mount) and hook `calendar_day_viewed`/`calendar_event_viewed` into the existing `activeDialog` transitions.
18. `app/components/dashboard/tasks/desktop-tasks-table.tsx` — add `project_details_expanded` in `toggleProject`, open-transition only.
19. `app/components/dashboard/tasks/mobile-task-card.tsx` — same, mobile variant.
20. `app/components/dashboard/resources/resource-manager-modal.tsx` — add `project_resources_viewed` inside the existing `useEffect([isOpen, projectId, taskId])`.
21. `app/components/dashboard/tasks/project-updates/use-project-update-history.ts` — add `project_history_viewed` in `openHistory()`.
22. `app/components/dashboard/tasks/project-updates/use-project-update.ts` — add `client_update_opened` in `openModal()`.
23. `app/admin/analytics/users/page.tsx` — extend `mergeUserActivity`/row type with the new summary fields (§17); add a link to the new `[userId]` route per row.
24. `app/admin/analytics/users/user-activity-table.client.tsx` — render the new columns; add the "View timeline" link; ensure new columns respect the existing `showOwnerTest` filter.

**Component-level tests** (colocated `*.test.tsx`, matching this repo's existing convention) for items 16–22, each verifying: exactly one tracking call fires per genuine trigger; no call fires on an unrelated re-render, a Strict-Mode double-invoke, or a prefetch.

---

## 19. Automated test plan

| Requirement | Test |
|---|---|
| Authenticated user ID is derived from the server session | Route test: mock an authenticated Supabase session, assert the inserted row's `user_id` matches the session's user, never a client-supplied value |
| Anonymous request cannot create authenticated activity | Route test: no session → route returns 200, **no row is written** (assert on the mocked insert call count) |
| Client-supplied `user_id` is ignored/rejected | Route test: POST a body containing a `userId` field → assert it has no effect on the written row (the contract doesn't even parse it) |
| One event per real navigation | Component test: render, trigger the real navigation/state-transition once, assert the tracking call fires exactly once |
| No duplicate from React rerender | Component test: force an unrelated parent re-render, assert no additional tracking call |
| No duplicate from Strict Mode | Component test: simulate mount→cleanup→mount (matching this repo's own existing Strict-Mode test pattern, e.g. the Calendar suite's "simulated React Strict Mode double-invoke" test), assert the server-side idempotency key would collapse both fires to one row (unit-test the dedup key computation directly, plus an integration-style test on the helper catching the `23505` conflict) |
| No event from Next.js prefetch | N/A for 10 of 12 surfaces (client `useState`, not routes); for `/dashboard` and `/dashboard/calendar`, assert the tracking `useEffect` never runs during a `<Link>` prefetch (Next.js prefetch does not execute component effects — confirm via existing test conventions for these two routes) |
| No event from API request | Route test: directly `POST` the tracking endpoint's *own* helper is not itself triggered by unrelated API routes; assert no other route imports `log-product-event.server.ts` |
| No event from background polling | Confirmed structurally: none of the 12 surfaces poll (verified in §8); no test needed beyond confirming the `useEffect` dependency arrays stay primitive-only |
| Project expansion produces one event | Component test on `DesktopTasksTable`/`MobileTaskCard`: open → 1 call; close → 0 additional calls; reopen within the dedupe window → still 1 row (idempotency) |
| Resources opening produces one event | Component test on `ResourceManagerModal` |
| History opening produces one event | Component test on the history modal/hook |
| Calendar opening produces one event | Component test on `WorkCalendarClient` mount |
| Inactive background tab does not create view activity | Confirmed structurally: all triggers are mount/state-transition-based, not visibility-based; no `visibilitychange`/interval logic exists to test against |
| Owner/test activity excluded by default | Extend the existing `user-activity-table.client.tsx` test suite: new columns for an `isOwnerOrTest` row are hidden with `showOwnerTest=false`, visible with `true` |
| Owner/test activity visible when explicitly included | Same test, inverse assertion |
| View-only user appears in Users & Activity | Integration test: a user with only view rows (no domain-table action timestamps) appears with `View-only activity = true` and null "Last meaningful action" |
| Last seen is correct | RPC/summary test: `MAX(created_at)` matches the expected row |
| Last viewed page is correct | RPC/summary test: `route` of the max-`created_at` row |
| Active-day count is correct in Israel time | RPC test with rows straddling a UTC-day boundary but the same Israel calendar date (and vice versa) — assert the boundary is computed via `at time zone 'Asia/Jerusalem'`, not UTC |
| Returning-user calculation is correct | RPC test: 1 distinct day → `false`; 2+ distinct days → `true` |
| User timeline is correctly ordered | RPC test: rows returned `created_at desc` |
| No sensitive fields stored | Schema/contract test: assert the table has no free-text/metadata column capable of holding message/task/client content (a structural test, not a runtime one) |
| Analytics failure does not affect product navigation | Component test: mock the tracking fetch to reject/throw, assert the surrounding component's own render/navigation behavior is completely unaffected |
| Existing anonymous traffic analytics remains unchanged | Regression test: `app/admin/analytics/page.tsx`'s existing traffic-query tests (if any) continue passing untouched; confirm no new event names ever appear in an `analytics_events` query, since they're never written there |
| Existing Product Activation metrics remain unchanged | Regression test: `get_owner_product_activation_analytics()` is not modified by this feature at all; existing tests for it continue passing untouched |

---

## 20. Manual production verification plan

Maps directly onto §21's Phase 6/7 below — see there for the exact step sequence. In summary: verify with the owner/test account first (internal activity explicitly visible), confirm rows appear with correct `user_id`/`event_name`/`route`/`entity_id`/timestamp, confirm the Users & Activity summary columns and the new `[userId]` timeline route render correctly for that account, then verify a **real, non-owner** account produces the same correct behavior and is excluded from the default (non-toggled) view.

---

## 21. Performance estimate

**Writes per typical authenticated visit:** a realistic session touches `dashboard_viewed` (always, 1) plus one or two of `extract_viewed`/`tasks_viewed`/`calendar_viewed` (1–2), plus zero to a few of the secondary surfaces (`project_details_expanded`, `project_resources_viewed`, `project_history_viewed`, `client_update_opened`, `calendar_day_viewed`, `calendar_event_viewed`) depending on what the user actually does — realistically **2 to 6 writes per visit**, comfortably under the request's own "fewer than 5–10 small inserts per visit" ceiling.

**Writes per 100 visits:** ≈100 × 4 (a reasonable mid-point of the 2–6 range) ≈ **400 inserts per 100 visits**.

**Expected row size:** `id` (16B) + `user_id` (16B) + `event_name` (~20B) + `route` (~30B) + `entity_type` (~15B) + `entity_id` (~36B) + `idempotency_key` (~80B) + `created_at` (8B) + row/page overhead (~24B) ≈ **~250 bytes per row**, before indexes; including the three indexes from §14, effective storage cost is roughly **600–900 bytes per row** including index overhead.

**Likely monthly row growth:** this document does not have access to real traffic/user-count figures, so this is illustrative math, not a measured number: for *N* active authenticated users each visiting *V* times/month at ~4 events/visit, monthly rows ≈ *N × V × 4*. For a small-to-mid-scale SaaS with, say, a few hundred to a few thousand monthly active users visiting roughly 10–20 times/month, that works out to roughly **15,000–120,000 rows/month** — trivial for an indexed Postgres table (Postgres/Supabase handle single-digit-millions of rows in a simply-indexed table without any special tuning; this only becomes a real concern in the tens-to-hundreds-of-millions-of-rows range without partitioning, which this feature's scale is nowhere near).

**Why this should not materially affect Supabase/Vercel performance:**
1. All writes are fire-and-forget via `after()`, fully decoupled from the response the user is waiting on — a slow or even failed insert adds zero latency to any page render.
2. Writes are single-row inserts against a small, indexed, RLS-locked, service-role-only table — one of the cheapest possible Postgres operations.
3. **Reads only ever happen on the two owner-only admin routes** (used by one person, infrequently) — nothing on any user-facing dashboard/calendar/task page ever reads from this table, so "no queries added to normal user page rendering" is satisfied by construction, not by discipline.
4. The existing `analytics_events` table already sustains a comparable-or-larger write volume (`page_view` fires on every single page load site-wide, anonymous and authenticated combined) without any documented performance issue; this new table's write pattern is strictly narrower in scope (authenticated-only, deliberate-view-only).

---

## 22. Rollout and rollback plan

The request's own 7-phase breakdown is adopted directly, with per-phase specifics filled in:

### Phase 1 — Database migration and contracts only
- **Work:** create (not apply) the two migrations from §14; create `lib/activity/product-event-contracts.ts`.
- **Verification:** `npx vitest run` on the new migration `.test.ts` files (static SQL assertions only, no live DB); `npx tsc --noEmit`.
- **Rollback:** delete the two untracked migration files; no database state exists yet, so rollback is trivial.
- **Expected DB writes:** zero (no code calls this yet).
- **Regression risk:** none — nothing references the new table yet.

### Phase 2 — Server tracking endpoint and tests
- **Work:** `lib/activity/log-product-event.server.ts`, `app/api/activity/product-event/route.ts`, plus their tests.
- **Verification:** route/unit tests per §19 (anonymous → 200/no-row; authenticated → correct row; client-supplied `userId` ignored; dedup collapses a rapid double-fire).
- **Rollback:** the route is inert until something calls it — safe to leave deployed even if Phase 3+ is delayed.
- **Expected DB writes:** zero in production (nothing calls the route from the UI yet); test-only writes against a test/staging database.
- **Regression risk:** none — a new, unreferenced route.

### Phase 3 — Instrument the four top-level authenticated routes (Dashboard, Extract, Task CRM, Calendar)
- **Work:** modify `dashboard-client.tsx` and `work-calendar-client.tsx` per §18, items 16–17 (4 events only: `dashboard_viewed`, `extract_viewed`, `tasks_viewed`, `calendar_viewed`).
- **Verification:** component tests per §19 for exactly these four; manual smoke test in a preview/staging environment confirming one row per genuine visit/tab-switch and no row on re-render.
- **Rollback:** revert these two files; the new table/endpoint remain harmlessly unused.
- **Expected DB writes:** 4 events × real traffic volume from this point forward.
- **Regression risk:** low — additive `useEffect`s only, mirroring an already-proven pattern (`dashboard-visit`) in the exact same file.

### Phase 4 — Instrument deliberate surface openings (project details, Resources, History, Add Client Update, calendar day/event)
- **Work:** modify the six remaining files per §18, items 18–22.
- **Verification:** component tests per §19 for these six; manual smoke test confirming each modal/expand fires exactly one row on genuine open.
- **Rollback:** revert these files individually if any single one misbehaves — they're independent of each other and of Phase 3.
- **Expected DB writes:** the remaining 6 event types × real usage volume.
- **Regression risk:** low — same additive pattern; slightly higher surface area (6 files) than Phase 3.

### Phase 5 — Extend Users & Activity admin analytics
- **Work:** the two RPCs from §14; the new `[userId]` route (§17); extend `user-activity-table.client.tsx`/`page.tsx` per §18, items 23–24.
- **Verification:** RPC tests per §19 (Israel-time bucketing, returning-user threshold, ordering); manual check of the extended table and the new timeline route against real (by then, owner/test) data from Phases 3–4.
- **Rollback:** revert the admin-page changes; the underlying table/data are unaffected and remain available for a retry.
- **Expected DB writes:** zero new writes (read-only phase).
- **Regression risk:** low — purely additive columns/route on an internal, two-person tool; explicitly must not touch the existing Overview page or existing Users & Activity fields.

### Phase 6 — Production verification using an owner/test account with internal activity explicitly enabled
- **Work:** none (verification only).
- **Verification:** log in as an owner/test account in production, exercise all 12 surfaces, toggle "Show owner/test accounts" **on** in Users & Activity, confirm: correct row counts, correct `route`/`entity_id` values, correct Israel-time timestamps, correct distinct-day/returning-user values, correct timeline ordering on the new `[userId]` route, and that dedup correctly collapses rapid repeat interactions (e.g., clicking Dashboard twice quickly) into one row.
- **Rollback:** if anything is wrong, the owner/test toggle keeps this data isolated from being seen as "real" — no rollback of code is necessarily required to keep operating safely, since this data is not shown in the default view.
- **Expected DB writes:** a handful of rows per manual test pass, all correctly flagged `isOwnerOrTest = true`.
- **Regression risk:** none — this phase is pure verification.

### Phase 7 — Enable default owner/test exclusion and verify a real non-owner user
- **Work:** none (verification only — exclusion is already default-on per §6/§17; this phase confirms it holds for the new columns too).
- **Verification:** confirm the "Show owner/test accounts" checkbox defaults to unchecked and that a real (non-owner) user's activity is visible with the checkbox unchecked, while the owner/test rows from Phase 6 are hidden.
- **Rollback:** N/A — this phase only confirms existing default behavior extends correctly to the new columns.
- **Expected DB writes:** ongoing, organic, from real user traffic.
- **Regression risk:** none if Phase 5's wiring correctly reused the existing `isOwnerOrTest` filter (§17) rather than introducing a parallel one — this is the one thing worth double-checking carefully in code review before Phase 7.

---

## 23. Risks and mitigations

1. **Table-sharing pollution risk** — avoided structurally by not extending `analytics_events` (§10); Overview's existing unfiltered traffic query is never touched.
2. **Over-firing from incorrect `useEffect` dependencies** — mitigated by mandating primitive-only dependency arrays, mirroring the exact existing `dashboard-visit` pattern, with a component-test checklist item ("N re-renders → 1 network call") for every instrumented site.
3. **Strict-Mode double-invoke inflating dev/QA counts** — absorbed by the server-side 5-minute idempotency window regardless of environment; explicitly tested (§19).
4. **Client-supplied `route`/`entity_id` abuse** — mitigated by strict server-side format validation and length clamps (§15); invalid values are dropped, never stored.
5. **Unbounded table growth with no retention policy** — a pre-existing gap shared with `analytics_events`; recommend defining a retention window for the new table before shipping, and flagging the older table's own lack of one as a separate, non-blocking improvement.
6. **Misinterpreting this table as a complete action/audit log** — mitigated by naming (`authenticated_product_events`, clearly view-scoped) and this document's own explicit statement that action/write tracking is a deliberately separate, not-yet-built concern (§13).
7. **Tracking calls introducing perceptible UI latency if implemented as awaited instead of fire-and-forget** — mitigated by mandating fire-and-forget everywhere (never awaited, errors always swallowed), with an explicit test asserting a tracking failure never blocks navigation/rendering (§19).
8. **New admin columns forgotten in the existing owner/test filter** — mitigated by explicitly wiring the new fields through the existing `isOwnerOrTest`/`showOwnerTest` mechanism rather than a parallel one (§17, §18); explicitly called out as the one thing to double-check in Phase 7 (§22).
9. **`/dashboard/billing` and `/dashboard/profile` are not server-auth-guarded** — a pre-existing architectural gap discovered during this audit (§8). Does not affect this feature (neither route is among the 12 requested surfaces, and all 12 confirmed surfaces render only after `requireDashboardUser()`), but is flagged for the owner's awareness should tracking ever be considered for those two routes later.
10. **Rapid day-to-day clicking in the calendar month view generating many distinct `calendar_day_viewed` rows** — each is still a single tiny fire-and-forget row (not a heartbeat), and the 5-minute idempotency bucket caps repeat views of the *same* day; genuinely browsing many different days each produces one legitimate row by design. No mitigation beyond the existing dedup is recommended; this is legitimate signal, not a heartbeat pattern.

---

## Appendix: source material

This document synthesizes five focused, read-only research passes across: (1) the `analytics_events` database schema, migrations, and TypeScript event contracts; (2) `page_view` tracking, the `last_dashboard_seen_at` mechanism, and the consent banner; (3) the `/admin/analytics` and `/admin/analytics/users` pages' exact queries, RPCs, and UI; (4) the authenticated route/component architecture for all 12 requested surfaces; (5) whether each of 11 candidate "meaningful write actions" is already tracked or inferable. Every file path, SQL definition, and code snippet quoted above was confirmed directly against the repository at the time of this audit; nothing above is speculative.
