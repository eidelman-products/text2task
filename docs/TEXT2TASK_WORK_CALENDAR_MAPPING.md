# Text2Task — Work Calendar Feature: Architecture Mapping

Status: **Mapping only. No application code, schema, or configuration was modified.**
Repository: `C:\Users\Home\projects\inboxshaper`, branch `main`, HEAD `6a72c93` ("Prevent false Done on partial task updates").

---

## 1. Executive verdict

The Work Calendar is buildable on top of existing, well-engineered infrastructure — the `DateOnly` module, `DateField`/`DeadlineField`, the `@daypicker/react` + `@floating-ui/react` primitives, and the established RLS/ownership/soft-delete conventions are all solid and directly reusable. **One new table is required** (`calendar_events` for manual events only — project deadlines are projected, never duplicated), **one new migration**, **no changes to `projects`/`tasks` schema**, and **no timezone infrastructure needs to be built** because none exists today and the MVP doesn't require it if a timezone-naive "floating local time" policy is adopted (matching how `deadline_date` already works).

The single biggest open architectural fork — **not resolvable from repo evidence alone, needs a decision before Phase D** — is where the Calendar route lives: the dashboard currently has two incompatible navigation patterns (an SPA with no per-tab URLs, and standalone routed pages with no shared sidebar/auth-guard consistency). My recommendation is below (§21, §23).

Two more load-bearing recommendations: (1) the merge of project deadlines + manual events into one read model should happen server-side, in a new `.server.ts` query module mirroring the existing `load-dashboard-tasks.server.ts` pattern, returned through a new narrow API route — the Calendar UI never touches Supabase directly; (2) the month grid needs a genuinely new component (the existing `Calendar`/DayPicker wrapper is single-date-only with no slot for multi-item day content), ideally built by configuring a second DayPicker instance with a custom `Day` render override so it inherits DayPicker's native grid accessibility rather than hand-rolling a `role="grid"` implementation from scratch (which has zero precedent anywhere in this repo).

Realistic estimate: **~10–15 engineer-days sequential**, compressible to **~7–10 days** with two engineers on strictly-owned parallel phases (see §22, §25, §28).

---

## 2. Current repository state (Step 1)

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `6a72c93` — "Prevent false Done on partial task updates" |
| Previous | `79c8899` — "Add accessible deadline date picker" (confirmed present) |
| `git status --short` | *(empty — clean)* |
| Working tree | Clean, nothing at risk |
| Framework | Next.js **16.1.6** (App Router), React **19.2.3** |
| TypeScript | `^5`, strict mode (existing convention throughout) |
| Package manager | npm (`package-lock.json` conventions; no yarn/pnpm lockfile) |
| Test tooling | Vitest **4.1.10**, `@testing-library/react` **16.3.2**, jsdom **29.1.1** |
| Calendar/date dependencies already installed | `@daypicker/react ^10.0.1`, `@floating-ui/react ^0.27.20` |
| Current test baseline | **30 test files / 372 tests, all passing** (confirmed via fresh `npx vitest run`) |
| Both expected recent commits present | Yes — confirmed by `git log` |
| Dirty work at risk | None |

---

## 3. Locked MVP scope

(Reproduced from the task brief for traceability — not repeated in full elsewhere in this report.) Month view with prev/next/Today navigation; project deadlines projected from `projects.deadline_date` (title, client, status/priority, overdue styling, click-through to project, edit through the existing safe persistence path); manual events (title required, date required, optional time/notes/project/client link) created via day-click or an Add button, editable and deletable, explicitly independent from project deadlines (no silent cross-writes); filters (All / Project deadlines / Manual events / status / priority / client); an Unscheduled Projects area; one shared desktop/mobile architecture (no second mobile-only implementation); full reuse of `DateOnly`/`DateField`/DayPicker/Floating UI/dashboard tokens; full keyboard/screen-reader accessibility. Explicitly out of scope: external calendar sync, recurring events, attendees, video links, reminders/notifications, drag-and-drop, hourly planners, team calendars, automatic task splitting, subtask-level calendar display.

---

## 4. Complete current architecture inventory (Steps 2, 10)

### 4.1 Two incompatible dashboard patterns coexist — the central navigation fork

**Pattern A — the SPA workspace.** `app/dashboard/page.tsx` is a server component: `supabase.auth.getUser()`, redirect to `/login` if absent, then renders `DashboardClient` (`app/components/dashboard-client.tsx`, 1832 lines). Navigation between "Dashboard" / "Extract" / "Tasks" is **pure client-side React state** — `type DashboardNav = "dashboard" | "extract" | "tasks"` (line 38), switched via `setActiveNav`, rendered via a `switch` in `renderContent()` (lines 1761–1809). **There is no URL change** between these three "pages" — `/dashboard` is the only route. The `DashboardNav` union type is **redeclared, not shared**, in at least `dashboard-client.tsx:38` and `dashboard-sidebar-profile.tsx:15`.

**Pattern B — standalone routed pages.** `app/dashboard/billing/page.tsx` and `app/dashboard/profile/page.tsx` are real routes at `/dashboard/billing` / `/dashboard/profile`. They do **not** use the shared sidebar/shell at all, use raw-hex inline styles (an older convention, not `tokens.ts`), and — critically — have **no server-side auth guard**: each is `"use client"` and only discovers unauthenticated state after mount via a `fetch(...)` returning 401, then `window.location.href = "/login"`, meaning there's a brief unauthenticated-content flash on these two routes today.

**Route file tree today:**
```
app/dashboard/layout.tsx     — sets robots: {index:false, follow:false}, inherited by every nested route
app/dashboard/page.tsx       — server-guarded entry to the SPA workspace
app/dashboard/billing/page.tsx   — client-guarded, no shared shell
app/dashboard/profile/page.tsx   — client-guarded, no shared shell
```
No `app/dashboard/calendar/` exists. Neither existing pattern alone satisfies the brief's implicit requirements (a real, shareable `/dashboard/calendar` URL **and** the shared sidebar/tokens **and** a proper server-side auth guard) — see §21/§23 for the recommended resolution.

### 4.2 Nav item mechanics
Nav items are individual JSX calls in `dashboard-sidebar-profile.tsx` (not a config array), each a `<SidebarButton label active onClick>` (`sidebar-button.tsx`). Icon glyphs are derived by string-matching the label (`getNavIcon`, `.includes("dashboard")` → "▦", etc.) — adding "Calendar" means touching the `DashboardNav` type in 2+ places, adding a `SidebarButton`, a `getNavIcon` case, and (if kept as an SPA tab) a `renderContent()` case. Active-state highlighting is a boolean prop, not URL-based (no `usePathname()`/`aria-current` anywhere in this nav).

### 4.3 Loading/error boundaries
**No `loading.tsx`/`error.tsx` exists anywhere under `app/dashboard/`.** All loading/error states are in-component local state + `sonner` toasts. A Calendar page should follow this same in-component convention.

### 4.4 Responsive mechanics — three inconsistent breakpoints in active use
1. CSS media-query class-toggling at **900px** (`DashboardShell`, both desktop/mobile markup always in the DOM, CSS decides visibility).
2. The identical CSS-toggle pattern but at **1080px** for the task list specifically (`tasks-view-styles.ts`) — a different, undocumented threshold.
3. JS `window.matchMedia` at **900px** (`DatePickerPopover`'s `useIsMobile()`), reading from `dashboardBreakpoints.mobile` in `tokens.ts` — but a *second*, separately-declared `MOBILE_BREAKPOINT = 900` constant also exists in `app/components/dashboard/ui/shell.ts`, duplicating rather than importing the tokens.ts value.

**Recommendation: standardize the Calendar on `dashboardBreakpoints.mobile` (900px) via the JS `matchMedia` mechanism**, matching the date-picker precedent exactly (§4.6) — not the task list's divergent 1080px.

### 4.5 Existing shared UI primitives (`app/components/dashboard/ui/`)
`DashboardButton` (variants primary/secondary/soft/ghost/danger/icon), `DashboardCard`/`Section`/`SurfaceHeader`, `DashboardBadge` (neutral/blue/green/amber/red/purple — directly usable for event/deadline-kind chips), `DashboardEmptyState` (tokens-based, dashed-border card — also this repo's de facto "loading state" component, used with different copy rather than a skeleton). **No shared `Select`** (every dropdown is a raw `<select>` with inline styles). **No shared `Modal`/bottom-sheet component** — every dialog in the app hand-rolls the same recipe (`createPortal(document.body)` + `useHasMounted()` gate + manual `keydown === "Escape"` listener + manual outside-click via `onMouseDown` target-check + manual `document.body.style.overflow` scroll-lock) independently, 3 times already (`DatePickerPopover`, `ProjectUpdateModalV2`, the profile-page feedback modal). Building the Add/Edit Event dialog will be a **4th** near-duplicate unless extracted first (flagged as an open item, §23).

### 4.6 The date-picker/calendar primitive stack (all in `app/components/dashboard/ui/calendar/` unless noted)
- **`lib/tasks/date-only.ts`** — the `DateOnly` branded type + `parseDateOnly`, `isDateOnly`, `dateOnlyToLocalDate`, `localDateToDateOnly`, `todayDateOnly`, `compareDateOnly`, `formatDateOnlyForDisplay`, `formatDateOnlyForA11y`. Every conversion funnels through one validation point (`brandDateOnly`); `Date↔DateOnly` conversions anchor at **local noon** specifically to dodge DST-boundary bugs; `.toISOString()`/UTC conversion is explicitly forbidden by the module's own doc comment. Extremely well tested (leap years, month/year/century boundaries, the two-digit-year `Date` constructor quirk).
- **`lib/tasks/parse-deadline.ts`** — natural-language deadline text → `{ deadlineDate: DateOnly | null, matched: boolean }`.
- **`lib/tasks/get-deadline-ui.ts`** — `getDeadlineUi(deadlineText, deadlineDate, status)` → overdue/due-today/due-tomorrow/due-soon/on-track classification + tone/label/icon, computed safely via `date-only.ts`, never raw `Date` math. **This is the function the Calendar's overdue styling must reuse.**
  - ⚠️ **A divergent, unsafe duplicate exists**: `mobile-task-card.tsx`'s local `getDeadlineState()` reimplements the same classification using `new Date(rawDate)` directly on a bare `YYYY-MM-DD` string — the exact UTC-day-shift bug class `date-only.ts` was built to eliminate. Read-only display today, but **do not copy this pattern** for Calendar.
  - ⚠️ A second, already-known, still-unfixed instance of the same unsafe pattern exists in `project-update-judge.server.ts:897` (AI deadline-change comparison) — unrelated to Calendar, out of scope to fix here, noted for completeness only.
- **`Calendar`** (`calendar.tsx`) — thin wrapper over `@daypicker/react`'s `<DayPicker mode="single">`. **Single-date-selection only, no slot for per-day event content.** Cannot be reused as-is for a multi-item month grid; a new component is required (§9, §10). Its keyboard/grid accessibility (`role="grid"`/`gridcell`, roving tabindex, arrow/Home/End/PageUp/PageDown) is entirely **delegated to DayPicker itself** — nothing hand-rolled. This is directly reusable for the mobile compact date selector, and its rendering approach (a second, differently-configured `DayPicker` instance with a custom `components.Day` override) is the recommended path for the desktop month grid too, to inherit this accessibility rather than reinvent it.
- **`DatePickerPopover`** (`date-picker-popover.tsx`) — pure positional/lifecycle container, knows nothing about dates. `@floating-ui/react` usage: `useFloating` + `autoUpdate` + `offset` + `flip` + `shift`; notably **not** `useDismiss`/`useRole`/`FloatingFocusManager`/`FloatingPortal` — dismiss and focus-trap are hand-rolled instead (documented in-code as intentional: "no focus-trap utility exists elsewhere in this codebase"). Desktop: anchored floating popover. Mobile (< 900px via `matchMedia`): fixed-position bottom sheet, body-scroll-locked. This exact recipe is the strongest existing precedent for any new bottom-sheet-on-mobile surface.
- **`DateField`** (`date-field.tsx`) — generic, product-agnostic field. Explicit-commit model (`onChange` fires only on Today/day-click/Clear, never Escape/blur — two structurally separate code paths by design). Required `label` prop (no icon-only fields allowed). 44px minimum touch targets. `aria-live="polite"` announcement region using the **full** unambiguous month-name format.
- **`DeadlineField`** (`app/components/dashboard/tasks/deadline-field.tsx`) — thin product-facing adapter over `DateField` (renamed `onChange`→`onCommit`, default label/placeholder). **This is the exact pattern a Calendar-specific "Event date" field, and the Calendar's inline project-deadline editor, should copy** — a thin named wrapper, never a fork.
- **No time-input precedent exists anywhere in the repo** (`<input type="time">` or custom) — the Manual Event form's optional time field is genuinely new work.

### 4.7 Desktop/mobile shared-architecture precedent
`tasks-view.tsx` computes derived state **once**, then feeds the *same* data and callbacks into two always-mounted, CSS-toggled sibling components: `MobileTaskCard` and `DesktopTasksTable`. **This is the direct precedent for the Calendar's month-grid vs. day-agenda split.** One caution from this precedent: each of the two components currently re-derives its own visual-state helpers independently (near-duplicated logic) rather than sharing one derivation function — the Calendar version should **not** repeat this; extract shared per-item derivation (sorting, overdue classification, chip styling) into one function/hook consumed by both the grid and the agenda.

### 4.8 Design tokens
`app/components/dashboard/ui/tokens.ts` — `dashboardColors`/`Spacing`/`Radii`/`Shadows`/`Typography`/`ZIndex`/`Breakpoints`/`Transitions`. All rendering is inline `CSSProperties` (never Tailwind classes, never CSS Modules, for dashboard components specifically); scoped `<style>` tags are used only for pseudo-classes/media-queries inline styles can't express. The newer calendar/date-picker code is fully tokens-driven; older surfaces (task table, billing, profile) still use raw hex — **Calendar should follow tokens.ts consistently**, matching the newer convention.

### 4.9 Accessibility conventions already established
`role="dialog"` **without** `aria-modal` for lightweight popovers (matches `DatePickerPopover`) vs. `role="dialog"` **with** `aria-modal="true"` for true full-page/full-overlay modals (matches `ProjectUpdateModalV2`, the profile feedback modal) — a real, consistent distinction to preserve. Escape closes without committing; click-outside via `onMouseDown` target-check + `preventDefault()` (documented workaround for a jsdom/browser focus race); focus-trap is hand-rolled per-component (no shared utility exists); focus returns to the trigger on any close path via a `wasOpenRef` transition-detection pattern; 44px minimum touch targets; `visuallyHidden` style for live-region text. **No hand-rolled `role="grid"`/roving-tabindex implementation exists anywhere** — grid accessibility is entirely delegated to DayPicker today, reinforcing the recommendation to build the month grid as a configured DayPicker instance rather than from scratch.

---

## 5. Navigation and route map (Step 2 summary — see §4.1–4.3 for detail)

| Concern | Current state | Calendar implication |
|---|---|---|
| Route | No `/dashboard/calendar` exists | New route needed — placement is the open architectural fork (§21, §23) |
| Auth guard | Server-side redirect (SPA) vs. client-fetch-then-redirect (billing/profile) | New route must use the server-side pattern to avoid an unauth-content flash |
| noindex | Automatic via `app/dashboard/layout.tsx` metadata inheritance | Free — any new nested route inherits it with zero extra work |
| Nav item wiring | `DashboardNav` type duplicated, individual `SidebarButton` JSX, string-matched icons | Requires touching 2+ files consistently; no config-array refactor needed for MVP |
| Loading/error UI | In-component only, no route-level boundaries | Follow the same convention |

---

## 6. Project deadline data flow (Step 3)

**Authoritative source**: `projects.deadline_date` — confirmed a strict Postgres **`date`** column (not timestamp), via `::date` casts in every RPC that writes it (`nullif(v_updates->>'deadline_date','')::date`). `projects.deadline_text` is the original human-entered text, kept alongside the canonical date.

**Which rows appear on the Calendar** — recommended filter, matching the repo's established "active row" gate (`(is_archived = false or is_archived is null) and deleted_at is null`, used consistently across every existing "active" query):
- Always exclude `deleted_at IS NOT NULL` (soft-deleted).
- Exclude `is_archived = true` by default (archived projects shouldn't clutter an active work calendar — no MVP requirement asks for them, and this matches every other "active" query in the codebase).
- **Completed (`status = 'Done'`) projects with a deadline**: recommend **still showing** them on their deadline date (a calendar is also a historical record of when things were due — hiding them would make "what was due last month" unanswerable) but visually de-emphasized/muted rather than styled as urgent/overdue. This is a product-level call — flagged as confirmable-but-defensible in §23.
- **Completed projects with no deadline**: recommend **excluding** from the Unscheduled Projects panel (§18) — a finished project doesn't need to keep nagging the user to set a deadline it will never need. Active (non-Done) projects with no deadline should appear there.

**Overdue logic**: reuse `getDeadlineUi()` (`lib/tasks/get-deadline-ui.ts`) exactly — do not reimplement (see the `mobile-task-card.tsx` cautionary duplicate in §4.6).

**No second deadline computation path should be invented.** `date-only.ts` + `get-deadline-ui.ts` are sufficient and already timezone-safe.

---

## 7. Client/project relationship findings (Step 4)

**`clients` is confirmed a genuinely first-class table** with its own primary key (`id uuid`) and its own ownership column (`user_id uuid`) — not merely denormalized text on `projects`. Evidence: `202607020004_project_priority_source.sql` shows real `INSERT INTO public.clients (...)` / `SELECT ... FROM public.clients WHERE client.user_id = v_user_id` statements, and a dedicated RPC (`update_project_client_identity_transaction`, `202606150007_...sql`) exists specifically to keep `projects.client_name`/`contact_name` (denormalized display copies) in sync whenever a real `clients` row is linked via `projects.client_id`.

Direct answers:
- **Can an event safely reference a project with a real FK?** Yes — `projects.id` is a stable `uuid` PK.
- **Can an event safely reference a client with a real FK?** Yes — `clients.id` is a stable `uuid` PK, confirmed first-class.
- **If clients weren't stable, what would MVP do?** N/A — moot, they are stable.
- **Should selecting a project imply/display its client?** Yes — recommend auto-populating (and locking, with an explicit "change" affordance) the client field from the selected project's `client_id`/`client_name` when a project is chosen in the Add/Edit Event form, to prevent the exact conflicting-client-selection problem the next bullet raises.
- **What happens if a linked project is later archived/deleted?** The FK precedent (`on delete set null`) means a deleted project silently unlinks itself from the event (event survives, `project_id` becomes null) — this is safe and self-healing, matching existing repo convention exactly. Archived (not deleted) projects should still resolve normally; the event UI should just visually flag "(archived project)" if displaying a linked, archived project.
- **What if a linked project's client changes later?** Recommend the event's `client_id` **not** auto-update (explicit, no hidden cross-entity sync, matching the MVP's own "no hidden synchronization" rule) — the event keeps whatever client was linked at creation/edit time until a user explicitly changes it.
- **Should an event allow a client that conflicts with its linked project's client?** Recommend **no** — if a project is linked, the client field should be derived/locked to that project's client (previous bullet); if the user wants a different client, they should either unlink the project or the UI should make clear that changing the client after picking a project is unusual and require an explicit action. This is the one consistent rule: **project-linked ⇒ client is derived, not independently editable** (unless no project is linked, in which case client is a free, independent optional choice).

---

## 8. Manual-event database recommendation (Step 5)

**Table name: `calendar_events`** (matches the brief; no stronger existing convention argues against it).

```sql
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  event_date date not null,
  event_time time without time zone null,
  notes text null,

  project_id uuid null references public.projects(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);
```

**Field-by-field rationale:**

| Field | Type | Why (or why not) |
|---|---|---|
| `id` | `uuid` default `gen_random_uuid()` | Matches every other table's PK convention |
| `user_id` | `uuid not null references auth.users(id) on delete cascade` | Matches the confirmed convention: **every** RLS-bearing table gets its own `user_id`, never derived via a join, even when a parent FK also exists. Hard-owned → `cascade`, matching `project_updates.user_id`'s exact FK clause |
| `title` | `text not null` | MVP-required field. Recommend an app-layer (Zod) non-blank + max-length (e.g. 200) check; a DB-level `check (char_length(btrim(title)) > 0)` is optional defense-in-depth, not required to match existing convention (no equivalent CHECK was found on comparable `text not null` title columns elsewhere) |
| `event_date` | **`date` not null** | Mirrors `projects.deadline_date`'s exact type — the whole point of the DateOnly architecture is a real Postgres `date` column, never a timestamp, for a calendar-day concept |
| `event_time` | `time without time zone`, **nullable** | Optional per MVP. Nullable = "all-day" (see §11 for why a separate `all_day` boolean is redundant and rejected) |
| `notes` | `text`, nullable | Optional per MVP |
| `project_id` | `uuid null references public.projects(id) on delete set null` | Optional link. Nullable-FK-to-optional-entity → `set null` is the exact, confirmed repo convention (`project_updates.client_id`, `project_update_items.target_task_id` both use this shape) |
| `client_id` | `uuid null references public.clients(id) on delete set null` | Same reasoning |
| `created_at` | `timestamptz not null default now()` | Standard |
| `updated_at` | `timestamptz not null default now()` | See below — recommend a dedicated trigger, unlike `projects`/`tasks` |
| `deleted_at` | `timestamptz null` | Soft-delete, matching the universal repo convention over hard deletes |

**Fields explicitly evaluated and rejected for MVP** (per the brief's explicit instruction not to add speculative fields):
- **`event_type`** — MVP has exactly one kind of manual event; no categorization requested. Skip.
- **`status`** — manual events aren't tracked through a workflow (unlike tasks). Skip.
- **`color`** — no per-event custom coloring requested; kind-based (project deadline vs. manual event) styling is sufficient. Skip.
- **`all_day boolean`** — redundant with `event_time IS NULL`, which already conveys exactly this. Adding both would be two signals for one fact. Skip; document `event_time IS NULL` as the all-day signal.
- **start/end times** — MVP says "optional time" (singular), no duration/range requested; matches the explicit "no hourly week/day planner" exclusion. Skip.
- **`timezone`** — no per-user timezone storage exists anywhere in this repo today (confirmed, §9), and the recommended MVP date/time policy (§9) is timezone-naive by design. A column would be meaningless without a stored reference. Skip; documented as a clean future extension point if timezone-aware sync is ever built.
- **`source`** — `projects.source` exists because projects have multiple creation paths (AI extraction, manual, import); calendar events have exactly one creation path (this UI) in MVP. Skip; same future-extension note as timezone if external sync is ever added.
- **`archived` flag** — no archive workflow requested for manual events. Skip.
- **sort/order field** — no user-defined intra-day ordering requested; chronological by `event_time` (nulls first) then `created_at` is sufficient and matches how the rest of the app orders lists. Skip.

**`updated_at` trigger**: unlike `projects`/`tasks` (which have no trigger — every RPC sets `updated_at` manually), `calendar_events` is a standalone new feature table with plain API-route writes (no RPC), so a dedicated trigger is the safer, convention-matching choice — mirroring `set_customer_stories_updated_at()`/`set_homepage_demo_updated_at()`, not the RPC-managed pattern:
```sql
create or replace function public.set_calendar_events_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row execute function public.set_calendar_events_updated_at();
```

**Indexes:**
```sql
create index if not exists calendar_events_user_id_event_date_idx
  on public.calendar_events(user_id, event_date);

create index if not exists calendar_events_project_id_idx
  on public.calendar_events(project_id) where project_id is not null;

create index if not exists calendar_events_client_id_idx
  on public.calendar_events(client_id) where client_id is not null;
```
The first is load-bearing (the primary month-range query shape). The latter two are standard FK-column indexing hygiene (cheap, partial, low-priority but low-cost).

**Writes go through plain API routes with direct table calls, not a new RPC.** Every write touches exactly one row with no multi-table transaction/reconciliation need (unlike `apply_project_update_transaction`, which exists because of genuine multi-step atomicity requirements). Introducing an RPC here would be unjustified complexity for a single-row CRUD op.

---

## 9. Date/time/timezone decision analysis (Step 6)

**No per-user timezone/locale/date-format preference is stored anywhere in this repo** (confirmed: no `profiles` table exists; the only `users` table extension columns are billing/activity-tracking fields; the only timezone constant anywhere is a hardcoded `Asia/Jerusalem` used solely for owner analytics day-bucketing, unrelated to any user preference).

| Option | Correctness for intl. users | Browser TZ changes | DST | Future sync readiness | Query complexity | Migration complexity | Verdict |
|---|---|---|---|---|---|---|---|
| **A: `event_date date` + `event_time time without time zone`** | Correct in the only sense currently possible — no stored reference exists to be "more correct" against | No effect — value is a plain wall-clock reading, immune to TZ changes by construction | No effect — no UTC conversion ever happens | Requires a deliberate future migration (add `timezone`, decide semantics) if real sync is ever built — but that's true of any option, since no timezone is stored today regardless | Simplest — mirrors `deadline_date` exactly, same `DateOnly` machinery reused | None beyond the new table itself | **Recommended for MVP** |
| B: `event_date date` (all-day) + `starts_at timestamptz` (timed) | Introduces a UTC-anchored value with no timezone to correctly anchor it *from* — the app would have to assume "browser's current timezone at save time," which silently breaks the moment the browser's TZ differs between create and view (e.g., a laptop that travels) | **Actively dangerous** — a timed event's displayed local time would drift if viewed from a different timezone than it was created in, despite there being no user intent for that | `timestamptz` handles DST transitions correctly *within one timezone*, but doesn't fix the cross-timezone drift problem above | Marginally better positioned for sync than A only if a timezone were also stored — which it isn't | Two different column types/semantics to reason about per row | Same, but adds meaningfully more subtlety for zero present benefit | Rejected for MVP — solves a problem this app doesn't have data to solve correctly, while introducing a *new*, worse problem (silent local-time drift) |
| C: `starts_at timestamptz` for every event + `is_all_day` | Same UTC-anchoring problem as B, applied universally, plus forces every all-day event through an artificial time-of-day convention (usually midnight) that has to be carefully excluded from display logic everywhere | Same drift risk as B | Handled correctly within a timezone, same caveat as B | Same caveat as B | Every date-only display path needs to strip/ignore the artificial time component | Higher — every write path must decide the all-day sentinel time convention | Rejected — worst of both: no correctness benefit today, most complexity |
| D: another design | Not needed — Option A is both the simplest and the only one that introduces zero new risk given the confirmed absence of timezone infrastructure | — | — | — | — | — | N/A |

**Recommended policy: Option A**, exactly mirroring how `projects.deadline_date` already works — a plain, timezone-naive "floating local time" value, interpreted as whatever the browser's local wall-clock time is when displayed. This is a deliberate, documented choice, not an oversight: it is the only option consistent with the non-negotiable "no timezone-unsafe date handling" rule given that **no timezone-storage infrastructure exists to safely do otherwise**, and building that infrastructure now would itself be exactly the kind of "broad product expansion beyond the locked MVP" the brief forbids. All date/time storage and comparison must route through `date-only.ts` (for `event_date`) and simple `HH:MM` string handling (for `event_time`, no `Date` object round-tripping needed for display — a bare 24h string is sufficient and avoids ever needing timezone-aware parsing).

**Future consequence, documented not implemented**: if real external-calendar sync is ever added (explicitly out of MVP scope), it would require a deliberate schema migration (adding a `timezone` column and re-defining semantics for existing naive rows, likely treating them as "whatever timezone the syncing service assumes") — this is a known, acceptable, and clearly-signposted future migration cost, not a hidden one.

---

## 10. RLS/security design (Step 7)

**RLS policy shape** — exactly the confirmed 4-policy-per-table convention, single-column ownership check, **never a join**:
```sql
alter table public.calendar_events enable row level security;

create policy "Users can view own calendar events"
  on public.calendar_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own calendar events"
  on public.calendar_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update own calendar events"
  on public.calendar_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own calendar events"
  on public.calendar_events for delete
  using (auth.uid() = user_id);
```

**Critical: RLS alone does NOT validate that a linked `project_id`/`client_id` belongs to the same user** — RLS on `calendar_events` only ever checks `calendar_events.user_id`, never the *referenced* row's ownership. The confirmed repo-wide pattern for this exact situation (nullable FK to another user-owned table) is: **no DB-level cross-table CHECK/trigger; ownership is re-validated explicitly in server code at write time**, exactly as `apply_project_update_transaction` re-checks `client.user_id = v_user_id` before trusting a `client_id` it's about to use.

**Required server-side validation** (API route, before every insert/update that sets `project_id` and/or `client_id`):
```
if project_id provided:
  SELECT id FROM projects WHERE id = :project_id AND user_id = :authed_user_id AND deleted_at IS NULL
  → if not found: reject (400/404), do not silently drop the field
if client_id provided:
  SELECT id FROM clients WHERE id = :client_id AND user_id = :authed_user_id
  → if not found: reject
```
This closes the IDOR risk directly: without this check, a malicious client could send another user's `project_id` and, because RLS only checks the *event* row's ownership, the insert would otherwise succeed and silently leak a foreign key reference (not the other user's data itself, but a real relationship to it, which is still a boundary violation worth explicitly preventing).

**Can ownership be enforced by RLS alone?** No — for the event row itself, yes; for the *linked* rows' ownership, no, RLS structurally cannot express "the row referenced by this nullable FK belongs to the same user" without a cross-table policy (which the repo's own convention deliberately avoids everywhere). Server-side validation is required, matching every existing precedent.

---

## 11. API/server contracts (Step 8)

**Server pattern to follow** (confirmed consistent across every sampled route): `const supabase = await createClient()` (`lib/supabase/server.ts`, SSR cookie-based) → `auth.getUser()` → 401 if absent → Zod `.safeParse()` on the request body → 400 on failure → every query/mutation chains explicit `.eq("user_id", user.id)` (never RLS-only) → response shape `{ success: true, data }` / `{ error: string }` (the simple-CRUD shape, not the heavier `{ ok, ... }` discriminated shape used only by the AI apply flow) → `console.error` before any 500.

**Proposed routes:**

| Route | Method | Purpose |
|---|---|---|
| `app/api/calendar/route.ts` | `GET` | Load the merged read model for a date range (`?start=...&end=...`) |
| `app/api/calendar/unscheduled/route.ts` | `GET` | Load unscheduled (no-deadline) active projects |
| `app/api/calendar/events/route.ts` | `POST` | Create a manual event |
| `app/api/calendar/events/[id]/route.ts` | `PATCH` | Update a manual event |
| `app/api/calendar/events/[id]/route.ts` | `DELETE` | Delete (soft) a manual event |

Project deadline editing from the Calendar **reuses the existing `POST /api/projects/update` route as-is** (§14) — no new route needed for that.

**Proposed TypeScript contracts** (illustrative; exact names are the implementer's call, semantics are load-bearing):

```ts
// lib/calendar/calendar-types.ts

type CalendarItem =
  | {
      kind: "project_deadline";
      id: string;                    // `project:${projectId}`
      date: DateOnly;                // projects.deadline_date — always non-null for items of this kind
      projectId: string;
      title: string;
      clientName: string | null;
      status: string | null;
      priority: string | null;
      isOverdue: boolean;            // derived via getDeadlineUi at merge time, not re-derived client-side
    }
  | {
      kind: "manual_event";
      id: string;                    // `event:${calendarEvents.id}`
      date: DateOnly;                // calendar_events.event_date
      time: string | null;           // "HH:MM" 24h, or null (all-day)
      title: string;
      notes: string | null;
      projectId: string | null;
      projectTitle: string | null;   // resolved via join for display, avoids a second client lookup
      clientId: string | null;
      clientName: string | null;
    };

type CalendarRangeQuery = { start: DateOnly; end: DateOnly };

type CreateCalendarEventInput = {
  title: string;
  eventDate: DateOnly;
  eventTime: string | null;   // "HH:MM" or null
  notes: string | null;
  projectId: string | null;
  clientId: string | null;
};

type UpdateCalendarEventInput = Partial<CreateCalendarEventInput>;
```

- **Discriminated union** on `kind`, per the brief — kept, since project deadlines and manual events genuinely differ in editability, source of truth, and available fields; collapsing them into one shape would force nullable fields that are actually always-present-or-always-absent per kind.
- **Validation**: Zod schema mirroring `CreateCalendarEventInput` exactly, with `title` non-blank + max length, `eventDate` validated through `parseDateOnly` (reject if invalid, do not silently coerce), `eventTime` validated against a strict `HH:MM` regex or `null`.
- **Response shape**: `{ success: true, event }` / `{ success: true, deleted: true }` / `{ error: string }`, matching `/api/projects/update`'s convention exactly.
- **Authorization boundary**: every route re-derives the user from the session, never trusts a client-sent user id; linked `projectId`/`clientId` re-validated per §10.
- **Persistence boundary**: the API route is the only thing that talks to Supabase for events; the read-model GET route is the only thing that talks to Supabase for the merged calendar view. No component imports Supabase.
- **Optimistic update + rollback**: reuse the exact inline pattern from `updateProjectField`/`updateTaskField` in `dashboard-client.tsx` (snapshot → optimistic `setState` → fetch → rollback both snapshots in `catch`/non-ok-response → toast with a `Retry` action) — no new hook needed, matches house convention exactly.
- **Idempotency**: not required for MVP — single-row CRUD with no multi-step transaction has no partial-failure state to recover from, unlike the AI apply flow. A double-submit is prevented at the UI layer (disable the Save button while a request is in flight), matching how the rest of the app already guards this.

---

## 12. Calendar read model (Step 9)

**Where the merge happens**: a new server module, `lib/calendar/load-calendar-range.server.ts`, following `lib/tasks/load-dashboard-tasks.server.ts`'s exact shape — two scoped Supabase queries (`projects` filtered by `deadline_date` range, `calendar_events` filtered by `event_date` range, both `.eq("user_id", ...)` and excluding deleted/archived per §6), normalized into `CalendarItem[]`, called from `GET /api/calendar/route.ts`. The Calendar UI receives one pre-merged, pre-sorted array — it never sees the two source shapes separately and never imports Supabase, satisfying the brief's explicit requirement.

**Month-boundary / leading-trailing-day handling**: the query range must **not** be limited to the 1st–last day of the requested month — a rendered 6-row grid can show up to ~6 trailing days of the previous month and ~6 leading days of the next. The client (or a small shared pure utility) computes the *full visible grid range* from the requested month and sends that as `start`/`end` — this avoids a whole class of "item missing from the visible trailing-day cell" bugs.

**Sorting within a day**: all-day items (project deadlines always; manual events with `time: null`) sort first, then timed manual events ascending by time, with title as a final tiebreaker for stability.

**"+N more" overflow**: recommend a tunable cap (e.g. 3 visible chips per desktop day cell) with a "+N more" affordance that expands inline or deep-links to that day's agenda — a product-tunable constant, not load-bearing logic.

**Historical/completed items**: shown per §6 (Done projects still show, de-emphasized).

**Stale linked records** (an event whose `project_id`/`client_id` no longer resolves because the row was hard-deleted at the DB level, or the FK's `on delete set null` already fired): the read model should simply reflect `projectId: null`/`clientId: null` once the FK has nulled out — no special handling needed, this is self-healing by construction (§7).

**Stable IDs**: `kind`-prefixed (`project:<uuid>` / `event:<uuid>`) as a defensive/debugging nicety on top of the `kind` discriminant itself, which remains the primary way consumers branch — prevents any theoretical id-string collision between the two source tables' UUID spaces from ever mattering.

---

## 13. Proposed TypeScript contracts

Covered inline in §11 (`CalendarItem`, `CalendarRangeQuery`, `CreateCalendarEventInput`, `UpdateCalendarEventInput`). No generated Supabase types file exists anywhere in this repo (confirmed absent) — these types, like `ProjectEntity`/`ClientEntity` in `task-types.ts`, would be hand-authored, following that exact file's style (flat interfaces, nullable-not-optional for DB-sourced fields).

---

## 14. Desktop UX (Step 11)

- **Header**: "Calendar" + a short subtitle + an "Add event" `DashboardButton` (primary variant).
- **Toolbar**: Previous/Next/Today (`DashboardButton`, `ghost`/`secondary` variants) + visible month/year label + a filter trigger (§18).
- **Month grid**: a new component (not the existing `Calendar`), recommended built as a second, independently-configured `DayPicker` instance with a custom `components.Day` render override injecting up to N `CalendarItemChip`s (`DashboardBadge`-based) per cell — inheriting DayPicker's native `role="grid"` keyboard accessibility rather than a from-scratch implementation. Today/selected-day visual state, overdue treatment (muted/red per `getDeadlineUi`'s tone), and the "+N more" overflow live here.
- **Interaction**: click empty date area → opens Add Event prefilled with that date; click "Add event" in the toolbar → opens Add Event with no date prefilled (or today's date as a sane default — product call, low-stakes); click a manual-event chip → opens it in view/edit mode (Add/Edit dialog reused, populated); click a project-deadline chip → opens the compact inline deadline editor described in §16 (with a "View in Task CRM" escape hatch to the full project). No drag-and-drop (explicitly out of scope).
- **Unscheduled Projects**: given the SPA's existing layout patterns lean on card/section-based composition rather than persistent side panels, recommend a **collapsible section below the grid** on desktop (expanded by default if non-empty, with a count badge) rather than a fixed side panel — simpler to also share verbatim with the mobile layout (§15), avoiding a second, panel-specific implementation. A dedicated side panel is a reasonable alternative if the eventual visual design calls for it, but isn't required by anything in the repo's current layout conventions.

---

## 15. Mobile UX (Step 12)

One shared architecture, per §4.7's `tasks-view.tsx` precedent — the same derived-data hook feeds both the desktop grid and:
- **Compact date selector**: reuse the **existing** `Calendar`/DayPicker wrapper directly (single-date selection is exactly what it already does well) instead of building a second bespoke mini-calendar — a genuine, low-risk reuse opportunity, unlike the full month grid.
- **Selected-day agenda**: a flat, scrollable list (`SelectedDayAgenda`) of that day's `CalendarItem[]`, reusing `DashboardCard`/`DashboardBadge` for each row — same underlying data as the desktop grid's day cells, just listed instead of chipped.
- **Add/edit**: the bottom-sheet variant of the Add/Edit Event dialog (§17) — same component as desktop, different presentation branch, matching `DatePickerPopover`'s existing desktop-popover/mobile-sheet split exactly.
- **Touch targets**: 44px minimum, matching the existing date-picker convention.
- **Sticky toolbar / scrolling / orientation / virtual keyboard**: no specific existing precedent to cite beyond general responsive CSS discipline already used elsewhere (`DashboardShell`'s always-both-render + CSS-toggle approach) — standard care applies, nothing calendar-specific needed here.
- **Focus return / delete confirmation**: handled by the same dialog component's existing focus-management recipe (§4.9), not a mobile-specific mechanism.

---

## 16. Create/edit/delete event flow (Step 13)

**Fields**: Title (required), Date (required, `DeadlineField`-style component but with an "Event date" label — see below), Time (optional, new component), Notes (optional, `<textarea>` matching existing multi-line field styling), Project (optional, `<select>` — no shared Select primitive exists, follow the raw-`<select>`-with-inline-style convention), Client (optional, derived/locked when a project is selected, per §7).

**Time input**: no precedent exists in this repo. Recommend a **native `<input type="time">`**, wrapped in the same labeled-field visual shell as other fields, rather than a new custom floating-ui popover. Rationale: (a) universal modern-browser support with zero new accessibility work (native time inputs are keyboard- and screen-reader-accessible by default, and use the OS's native picker on mobile — arguably *better* mobile UX than a custom popover); (b) avoids adding a **fourth** hand-rolled popover/dialog implementation on top of the three that already exist (§4.5); (c) matches "no broad product expansion" — MVP asks for "optional time," not a rich time-picker experience.

**Dialog architecture**: recommend modeling on `ProjectUpdateModalV2`'s recipe (centered modal desktop / bottom-sheet mobile, `role="dialog" aria-modal="true"`) rather than `DatePickerPopover`'s anchored-popover recipe — the event dialog is launched from multiple non-anchored trigger points (a day-cell click, a toolbar button, an existing-chip click), which doesn't fit a single-trigger-anchored floating popover model as naturally as `DatePickerPopover`'s one-field-one-popover use case does.

**Defaults/behavior**:
- Default date when opened from a day-cell click: that day.
- Default date when opened from the toolbar "Add event" button: today (or the currently-viewed month's first day if navigated away from the current month — minor UX call).
- Validation: title non-blank (trimmed) + reasonable max length (matches Zod contract, §11); date required and must parse via `parseDateOnly`; time, if provided, must match `HH:MM`.
- Save button: disabled while blank/invalid or while a request is in flight (prevents double-submit — no idempotency key needed given the guard, §11).
- Closing with unsaved changes: no existing precedent for a confirm-before-discard prompt anywhere in this codebase's modals — recommend matching that (silent close), keeping the form lightweight; add a confirm step only if product later observes accidental data loss as a real problem.
- Escape/click-outside: reuse the established recipe exactly (§4.9).
- Focus return: reuse the established `wasOpenRef` pattern.
- **Deletion confirmation**: recommend an inline confirm sub-state within the same dialog (e.g., the Delete button becomes "Confirm delete?" on first click) rather than a nested second dialog-over-a-dialog — simpler, avoids overlay stacking, no existing precedent argues for a separate confirmation modal.
- **Failed save**: keep the dialog open, show an inline error (matching the `applyError`/`analysisError` inline-string convention seen elsewhere), do not close/discard the user's input.
- **Failed delete**: same — surface an error, leave the event in place (don't optimistically remove it from the grid before the delete actually succeeds, or roll back if it was removed optimistically, per §11's rollback convention).
- **Linked archived/deleted project**: display a small "(archived)" or "(no longer available)" affix next to the project name in the form if the linked project's current state warrants it; do not block editing the event itself over this.

---

## 17. Project deadline editing flow (Step 14)

**The existing safe path** (confirmed the only direct, non-AI manual-edit path in the entire app today): `ProjectMetaEditor` → `DeadlineField` → `commitProjectDeadline` → `updateProjectField` (`dashboard-client.tsx`) → `POST /api/projects/update` → Zod `UpdateProjectSchema` → **server re-derives the canonical date from text via `parseDeadline`, never trusts a client-sent date directly** → direct `.update()` on `projects` (not an RPC) scoped to `.eq("id",...).eq("user_id",...).is("deleted_at",null)` → optimistic UI update with snapshot/rollback → toast with Retry.

**Important distinction confirmed**: this is a *different, lighter* path than the AI Project Update flow's `apply_project_update_transaction` RPC (`POST /api/project-updates/apply`) — the Calendar must call `/api/projects/update`, never the AI-apply route, to stay semantically correct (a direct user edit, not an AI-suggested change going through review).

**Today this path has exactly one entry point, desktop-only** (the Task CRM's desktop table row) — mobile shows the deadline read-only. The Calendar becomes the **first mobile-capable surface** for this edit, which is fine: `DeadlineField`/`DateField`/`DatePickerPopover` already fully support the mobile bottom-sheet presentation (§4.6), so no new date-editing infrastructure is needed — only a new call site.

**Recommendation**: build a small `ProjectDeadlineDetails` component — a compact inline popover/panel triggered by clicking a project-deadline chip, showing the project's title/client/status/priority plus an embedded `DeadlineField` wired to the exact same `commitProjectDeadline`-equivalent call (`POST /api/projects/update`), **plus** a "View in Task CRM" link/button for full navigation. This satisfies both halves of the brief ("opens project details or routes to the correct project" — support both) without forcing a full page navigation for a quick deadline nudge, and without inventing a second save path with different semantics (the non-negotiable constraint).

---

## 18. Filters and Unscheduled Projects (Step 15)

**Filter model**: All / Project deadlines / Manual events (a `kind` filter) + Status + Priority + Client. Status and Priority apply **only** to `project_deadline` items (manual events have neither field in the MVP schema, §8). Client applies to **both** kinds (project deadlines via their denormalized `clientName`; manual events via their own optional `clientId`/resolved `clientName`) — but only meaningfully filters items that actually have a client set. Mixed-filter behavior: filters combine with AND (kind AND status AND priority AND client), consistent with how filter combinations typically behave elsewhere in the dashboard.

**Persistence**: recommend **plain in-memory component state** for MVP, not URL search params — no existing precedent in this codebase drives filters through the URL (the dashboard is otherwise entirely client-fetched, no-URL-state), and introducing that pattern here would be a first for the repo rather than a reuse of an established convention. Flag URL-param-driven filters as a reasonable, low-risk future enhancement (shareable filtered views), not an MVP requirement.

**Mobile presentation**: a compact filter row/sheet (reusing the same bottom-sheet recipe as the Add/Edit dialog) rather than the full filter bar shown inline on desktop.

**Unscheduled Projects**:
- Recommend: **active** (non-`Done`), non-archived, non-deleted projects with `deadline_date IS NULL` — matching the "what work is due" product framing (a finished project with no deadline doesn't need to keep nagging the user, §6).
- Sorting: `created_at` descending (newest first), matching the existing dashboard task-list default order.
- Maximum visible count: recommend a small cap (e.g. 5–10) with a "View all" expansion, to keep the panel from dominating the page for power users with many unscheduled projects.
- Setting a deadline inline: yes — reuse `DeadlineField` directly in each row (same component, same `/api/projects/update` call as §17), letting a user schedule a project without leaving the Calendar.

---

## 19. Performance/query strategy (Step 16)

**No `.gte()`/`.lte()` range-query pattern exists yet on a date-only column anywhere in this repo** (confirmed) — the closest precedent is timestamp-range filtering on `created_at`/`occurred_at`/`expires_at` in a few unrelated features. The Calendar's month-range query is new territory but low-risk, directly modeled on that shape:

```
projects:
  SELECT id, title, client_name, status, priority, deadline_date
  FROM projects
  WHERE user_id = :uid
    AND deleted_at IS NULL
    AND (is_archived = false OR is_archived IS NULL)
    AND deadline_date >= :gridStart AND deadline_date <= :gridEnd
  -- indexed by calendar_events_user_id_event_date_idx-equivalent on projects (see below)

calendar_events:
  SELECT * FROM calendar_events
  WHERE user_id = :uid
    AND deleted_at IS NULL
    AND event_date >= :gridStart AND event_date <= :gridEnd
  -- indexed by calendar_events_user_id_event_date_idx

unscheduled projects:
  SELECT id, title, client_name, status, priority, created_at
  FROM projects
  WHERE user_id = :uid AND deleted_at IS NULL
    AND (is_archived = false OR is_archived IS NULL)
    AND deadline_date IS NULL AND status != 'Done'
  ORDER BY created_at DESC LIMIT :cap
```

**Recommend a new composite index on `projects`** to support the month-range query efficiently at scale — `projects` currently has no confirmed index list (its base `CREATE TABLE` predates tracked migrations), so this should be added via the same migration:
```sql
create index if not exists projects_user_id_deadline_date_idx
  on public.projects(user_id, deadline_date)
  where deleted_at is null;
```

**Caching**: this repo's entire dashboard data layer uses `cache: "no-store"` + refetch-on-navigation, with zero SWR/React Query/`unstable_cache` usage for any dashboard data. **The Calendar should follow this exact convention** — fetch the visible month's range on mount and on every prev/next/Today navigation, no client-side cache library, no server-side revalidation tags needed for MVP. Month-navigation "prefetching" (eagerly fetching the adjacent month before the user clicks Next) is a reasonable, optional future optimization, not required — the existing dashboard doesn't prefetch anything either.

**No pagination needed** within a single month's data (bounded by definition — a month has at most 31 days, and the "+N more" cap already handles a day with many items without needing to page the whole month's query).

---

## 20. Accessibility requirements (Step 18)

Directly inherited from §4.9's established conventions, applied to the new surfaces:
- **Month grid**: delegate to DayPicker's native `role="grid"`/`gridcell` + roving tabindex (via the recommended second-DayPicker-instance approach) rather than hand-rolling — this repo has zero precedent for a hand-built accessible grid, so reuse is materially lower-risk than new construction.
- **Day-cell content**: each cell's item chips need individual accessible names (e.g. "Design homepage — deadline, overdue" / "Send first draft — 2:00 PM"), not just a color dot — status/overdue must never be color-only (explicit non-negotiable-adjacent good practice, and matches `getDeadlineUi`'s existing `label` field, which already exists precisely for this purpose).
- **"+N more"**: must be a real, focusable, labeled control ("3 more events on July 14"), not a bare visual affordance.
- **Today/selected-day announcement**: an `aria-live="polite"` region announcing the visible month on navigation (mirroring `DateField`'s existing selection-announcement pattern) and the selected day on mobile agenda selection.
- **Add/Edit Event dialog**: `role="dialog" aria-modal="true"`, hand-rolled focus trap + focus return matching the established recipe exactly (no shared utility exists to import — copy the pattern, don't fork `DatePickerPopover` itself since the trigger-anchoring model differs).
- **Filters**: standard `<label>`-associated controls, no special pattern needed beyond what's already used for the raw `<select>` convention elsewhere.
- **Delete confirmation**: the inline confirm-state button (§16) needs its accessible name to change with its state ("Delete" → "Confirm delete?"), not rely on visual-only feedback.
- **Touch targets**: 44px minimum throughout, matching the date-picker precedent.
- **Testing infra**: the jsdom `matchMedia` polyfill already installed in `vitest.setup.ts` (built specifically for `DatePickerPopover`'s responsive branch) works for any new Calendar responsive logic with zero additional test-setup work.

---

## 21. Empty/loading/error states (Step 17, Step 21 partial)

| State | Recommendation |
|---|---|
| No items in visible month | `DashboardEmptyState` (tokens-based), e.g. "Nothing scheduled this month" |
| No manual events at all (first-ever use) | Same component, encouraging copy + the "Add event" action surfaced directly in the empty state |
| No unscheduled projects | Collapse/hide the Unscheduled Projects section entirely (don't show an empty panel for a genuinely non-issue state) |
| Loading a month | `DashboardEmptyState`-with-loading-copy, matching this repo's confirmed "loading = empty-state component with different text" convention (no skeleton component exists anywhere in the repo) |
| Failed month load | Inline error string near the top of the page (matching `tasksError`'s threading pattern), with a retry action |
| Failed create/update/delete | Inline error within the dialog (create/update) or a toast with Retry (delete, matching `updateProjectField`'s toast-retry pattern) |
| Event linked to archived project | Small inline "(archived)" affix, non-blocking |
| Event linked to deleted/missing project | `project_id` is already `null` by the time this is observable (FK `on delete set null`) — nothing special to render, the event just shows with no project link |
| Project deadline cleared while Calendar is open | Next month-range refetch (on navigation) naturally reflects it; no live-subscription needed for MVP (matches the no-realtime convention of the rest of the dashboard) |
| Project completed while Calendar is open | Same — reflected on next refetch, shown de-emphasized per §6 |
| Month boundary / leap day / DST | Fully covered by `date-only.ts`'s existing, extensively-tested safety guarantees (§4.6) — no new edge-case logic needed if all date math routes through it |
| Multiple items with the same title/date | No special handling needed — `id` is what distinguishes them, not title uniqueness |
| Long titles | Standard `truncate`-style CSS (an existing helper, `styles.ts`'s `truncate`) in chips; full title visible in the day-agenda/dialog |
| Large notes | No length cap requested for MVP beyond a sane textarea max-length; not a rendering risk in an agenda/dialog context |
| Offline/network interruption | Handled by the existing fetch-failure → rollback → toast-with-retry convention (§11) |
| Double-click/double-submit | Prevented by disabling the Save/Delete action while a request is in flight (§16) |

---

## 22. Full test matrix (Step 19)

Following the confirmed house style: `describe` blocks grouped by behavior, `build<X>(overrides)` fixture builders, `offsetFromToday`-style date fixture helpers, `userEvent.setup()` + `await user.click`, `getByLabelText`/`getByRole` query preference, `vi.mock` + dynamic-import-after-mock for any external dependency (Supabase, here, rather than OpenAI).

**Pure/unit tests** (`node` env):
- `CalendarItem` normalization (project row → item, event row → item) — field mapping correctness, null-handling.
- Project + manual-event merge/sort (all-day-first, then timed ascending, title tiebreak).
- Grid-range date generation (a month's leading/trailing days, including a leap-February and a December→January rollover).
- Month boundary correctness (first/last visible day for a 6-row vs. 5-row month).
- Overdue classification reuse (confirm `getDeadlineUi` is called, not reimplemented).
- Filter combination logic (kind AND status AND priority AND client).
- Optional-time ordering (all-day before timed; multiple timed events ascending).
- Leap year month-grid generation (February 2028).
- `DateOnly` safety — already covered by existing `date-only.test.ts`; no new tests needed there, only reuse.

**Database/migration tests** (static-assertion style, matching `202607270001_...test.ts`'s confirmed "not run against real Postgres" approach):
- Table definition present with expected columns/types.
- Indexes present.
- FK constraints present with correct `ON DELETE` clauses.
- RLS enabled + all 4 policies present with the expected `auth.uid() = user_id` predicate.
- (Cross-user isolation and invalid-linked-project/client rejection are **not** testable at this static-SQL-assertion level, given this repo's confirmed lack of a live-Postgres test harness — these must be covered at the API-route test level instead, below.)

**API/server tests** (mocked Supabase client, following the `vi.mock` + dynamic-import convention):
- Month-range load returns correctly merged/sorted items.
- Create succeeds with valid input.
- Update succeeds, partial-field updates work.
- Delete (soft) succeeds.
- Unauthorized access (no session) → 401.
- Linked-project ownership rejected when the project belongs to a different user (the IDOR case, §10) — this is the test that substitutes for the DB-level cross-user check the migration tests can't exercise.
- Malformed date/time input → 400, no partial write.
- Archived/deleted linked project handled gracefully (still creates/updates the event, `project_id` nulled or flagged as appropriate).
- Double-submit/idempotency — confirms a rapid double-POST doesn't create two rows if the UI guard is bypassed (defense in depth, even though the primary guard is UI-level per §11).

**Component tests** (jsdom, `// @vitest-environment jsdom` docblock):
- Month navigation (prev/next/Today) updates the visible range and refetches.
- Selected-day state.
- Event overflow ("+N more" reveals the rest).
- Add Event (from day-click, prefilled date; from toolbar, no prefill).
- Edit an existing manual event, save.
- Delete an existing manual event, inline confirm.
- Filters narrow the visible set correctly.
- Unscheduled Projects panel renders, inline deadline-set works.
- Project-deadline chip opens the compact editor; editing it calls the same `/api/projects/update` path (mock and assert the call, mirroring how `deadline-field.test.tsx` verifies `onCommit`).
- Manual-event chip opens the dialog in edit mode with correct pre-filled values.
- Loading/error/empty states render the expected `DashboardEmptyState`/inline-error copy.
- Keyboard navigation across the month grid (delegated to DayPicker — a thin smoke test confirming arrow-key nav still reaches the custom day content, not a full re-test of DayPicker's own grid behavior).
- Focus return after closing the Add/Edit dialog via Escape/click-outside/save (mirroring `date-field.test.tsx`'s existing assertions almost verbatim).
- Mobile selected-day agenda renders the same data as the desktop grid for a given day (a shared-derivation regression guard, directly testing the §4.7 caution about not duplicating logic).

**Integration tests**:
- Create an event → it appears in the correct month/day cell.
- Edit an event's date → it moves to the new day, disappears from the old one.
- Delete an event → it disappears from the grid.
- Update a project's deadline via the Calendar's inline editor → the grid reflects it on next load.
- Clear a project's deadline → it moves from the grid into Unscheduled Projects.
- Clicking a linked-project chip navigates to the correct project in Task CRM.
- A manual event linked to a project remains independent when the project's deadline changes (the core "no silent cross-writes" guarantee from the brief) — directly test the desktop-design/mobile-layout-style example: editing the project deadline must never touch the manual event's own `event_date`, and vice versa.

**Manual QA**: desktop, mobile, keyboard-only, screen reader, a simulated browser-timezone change (confirm no day-shift, validating the Option A policy's core promise), a leap day (Feb 29, 2028), a month boundary, a day with many events (overflow behavior), a failed network request (offline simulation), and a full production build (`npm run build`, performed by the user per the task's constraints).

---

## 23. Recommended production architecture (Step 21)

- **Route**: `/dashboard/calendar` as a **real Next.js route** (`app/dashboard/calendar/page.tsx`) with a server-side auth guard matching `app/dashboard/page.tsx`'s pattern exactly (not billing/profile's client-only pattern) — see the recommended nav resolution below.
- **Navigation**: extend the shared sidebar to support real route-based items alongside the SPA's tab-based items — "Dashboard"/"Extract"/"Tasks" continue to set `activeNav` and stay on `/dashboard`; "Calendar" (and, implicitly, "Billing"/"Profile" if ever normalized later, though that's out of scope here) navigates via `next/link`/`router.push` to its own route, rendering the shared `DashboardShell` from within its own page rather than only from inside the monolithic `DashboardClient`. This is a moderate, but bounded and well-justified, change to nav wiring — it's the only option that gets a real shareable URL, the shared sidebar/tokens, and a proper server-side auth guard simultaneously. See §23 (Open Questions) for the lower-effort fallback if this refactor is deferred.
- **Database**: one new table, `calendar_events`, per §8. No changes to `projects`/`tasks`.
- **RLS**: 4-policy convention per §10, plus mandatory server-side re-validation of linked `project_id`/`client_id` ownership.
- **Indexes**: `calendar_events(user_id, event_date)`, `calendar_events(project_id)` partial, `calendar_events(client_id)` partial, plus a new `projects(user_id, deadline_date)` partial index.
- **API/server boundary**: new `.server.ts` query module (`lib/calendar/load-calendar-range.server.ts`) + 5 new API routes (§11), all following the confirmed simple-CRUD convention; project-deadline edits reuse the existing `/api/projects/update` route unchanged.
- **Read model**: server-side merge into one sorted `CalendarItem[]` discriminated union, per §12.
- **DateOnly/time policy**: Option A (naive `date` + `time without time zone`), per §9 — zero new timezone infrastructure.
- **Desktop structure**: new month-grid component (configured DayPicker instance), toolbar, collapsible Unscheduled Projects section, per §14.
- **Mobile structure**: reuse of the existing `Calendar` component as a compact date selector + a new `SelectedDayAgenda` list, sharing all derived data with the desktop grid via one hook, per §15.
- **Event dialog**: new component modeled on `ProjectUpdateModalV2`'s modal/sheet recipe, per §16 — flagged as a 4th hand-rolled instance of a pattern this repo has never shared/extracted (real, pre-existing tech debt this feature inherits rather than causes).
- **Project deadline editing**: reuse `DeadlineField` + the existing `/api/projects/update` path, wrapped in a new compact `ProjectDeadlineDetails` popover with a full-navigation escape hatch, per §17.
- **Unscheduled Projects**: filtered/sorted per §18, with inline `DeadlineField`-based scheduling.
- **Tests**: full matrix per §22, matching established house conventions throughout.
- **Release strategy**: phased per §25, each phase its own isolated commit (the user commits, per this task's ownership rules), full verification suite (`vitest`, `tsc`, `eslint`) after every phase, `npm run build` only at the very end, by the user.

### Text architecture diagram

```
                     ┌───────────────────────────────┐
                     │        projects table          │
                     │   (deadline_date: date, ...)   │
                     └───────────────┬─────────────────┘
                                     │  read-only projection
                                     │  (never duplicated)
                                     ▼
┌─────────────────────┐   ┌───────────────────────────────┐   ┌────────────────────────┐
│  calendar_events     │──▶│  load-calendar-range.server.ts │◀──│  clients table          │
│  (new table, manual  │   │  (merge + sort + normalize)    │   │  (resolved for display) │
│  events, own PK/RLS) │   └───────────────┬─────────────────┘   └────────────────────────┘
└─────────────────────┘                   │
                                           ▼
                              GET /api/calendar (+ /unscheduled)
                                           │
                                           ▼
                         CalendarItem[] (discriminated union:
                         "project_deadline" | "manual_event")
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                                              ▼
        CalendarMonthGrid (desktop)                  CalendarCompactSelector +
        + CalendarItemChip                            SelectedDayAgenda (mobile)
                    │                                              │
                    └───────────────┬──────────────────────────────┘
                                     ▼
                    AddEditEventDialog  /  ProjectDeadlineDetails
                          │                          │
                          ▼                          ▼
          POST/PATCH/DELETE                POST /api/projects/update
          /api/calendar/events             (existing, unchanged, safe path)
                          │                          │
                          ▼                          ▼
                calendar_events table          projects table
```

---

## 24. Phased implementation plan (Step 22) — not executed

**Phase A — Schema/migration/RLS/types.**
- Files created: one new migration (e.g. `supabase/migrations/202607290001_calendar_events.sql` — table, trigger, indexes, RLS, plus the new `projects(user_id, deadline_date)` index); `lib/calendar/calendar-types.ts` (hand-authored TS types).
- Files modified: none.
- Depends on: nothing — can start immediately.
- Parallel-safe with: nothing else meaningfully depends on Phase A being *finished* to *start* Phase B/C (types can be drafted in parallel), but B/C's real implementation needs A's final column names locked.
- Risks: getting the FK `ON DELETE` semantics or the RLS policy shape wrong is expensive to fix post-launch (real user data). Low complexity otherwise.
- Tests: the static-assertion migration test (§22).
- Verification: `npx vitest run <the new migration test>`, manual review of the SQL against §8/§10 verbatim.
- Rollback: forward-only per repo convention — a mistake needs a follow-up corrective migration, not a down-migration.
- Isolated commit: yes.

**Phase B — Server repository/API/read model.**
- Files created: `lib/calendar/load-calendar-range.server.ts`, `lib/calendar/load-unscheduled-projects.server.ts`, `app/api/calendar/route.ts`, `app/api/calendar/unscheduled/route.ts`, `app/api/calendar/events/route.ts`, `app/api/calendar/events/[id]/route.ts`.
- Files modified: none (project-deadline edits reuse `/api/projects/update` untouched).
- Depends on: Phase A's final schema.
- Parallel-safe with: Phase C (pure utilities have no file overlap with API routes).
- Risks: the IDOR check (§10) is the single highest-value thing to get right here — must be tested explicitly, not assumed from RLS.
- Tests: API/server test matrix (§22).
- Verification: `npx vitest run`, `npx tsc --noEmit`.
- Rollback: revert commit; no data migration entangled.
- Isolated commit: yes.

**Phase C — Shared pure calendar utilities.**
- Files created: `lib/calendar/calendar-grid.ts` (month-grid range generation, leading/trailing day math — all routed through `date-only.ts`), `lib/calendar/calendar-item-sort.ts` (merge/sort logic), possibly folded into the same files as Phase B if the implementer prefers fewer files — kept separate here for clean unit-testability without mocking Supabase.
- Depends on: nothing beyond Phase A's types.
- Parallel-safe with: Phase B.
- Risks: low — this is the most directly precedented, lowest-risk phase (`date-only.ts` does the hard work already).
- Tests: pure/unit test matrix (§22) — the largest, cheapest-to-write test block.
- Verification: `npx vitest run`, `npx tsc --noEmit`.
- Isolated commit: yes.

**Phase D — Calendar route, navigation, month view (desktop).**
- Files created: `app/dashboard/calendar/page.tsx`, the month-grid component tree (`CalendarPage`/`CalendarToolbar`/`CalendarMonthGrid`/`CalendarDayCell`/`CalendarItemChip`), plus **the nav-wiring change** described in §23 (touching `dashboard-sidebar-profile.tsx`, and wherever `DashboardShell` needs to be rendered from a standalone route).
- Files modified: `DashboardNav`-adjacent type declarations (2+ files, §4.2), sidebar nav config.
- Depends on: Phases A, B, C all complete (needs real data + real utilities).
- Parallel-safe with: nothing — this is the first phase where the UI shell exists, everything downstream depends on it.
- Risks: the **navigation architecture decision** (§23) lives here — get product/engineering sign-off before starting this phase, not mid-phase.
- Tests: component tests for month navigation/grid rendering (§22, partial).
- Verification: `npx vitest run`, `npx tsc --noEmit`, `npx eslint`, manual browser check of the route + auth guard.
- Isolated commit: yes (likely the largest single phase — consider splitting into "route + nav" and "month grid" sub-commits if it grows unwieldy).

**Phase E — Manual Event create/edit/delete.**
- Files created: `AddEditEventDialog`, the new `TimeField` primitive (`app/components/dashboard/ui/calendar/time-field.tsx`), `DeleteEventConfirmation` (or the inline-confirm-state variant recommended in §16).
- Depends on: Phase D (needs the grid to launch the dialog from) and Phase B (needs the write routes).
- Parallel-safe with: Phase F, if strictly scoped — Phase E owns the dialog files, Phase F owns the deadline-editor/unscheduled-panel files, no overlap.
- Risks: this is the phase most likely to add a 4th duplicated modal implementation (§4.5) — worth a deliberate go/no-go on extracting a shared dialog primitive first, as a small preparatory sub-phase, if time allows.
- Tests: component tests for the dialog + integration tests for create/edit/delete (§22).
- Verification: `npx vitest run`, `npx tsc --noEmit`, `npx eslint`.
- Isolated commit: yes.

**Phase F — Project Deadline integration + Unscheduled Projects.**
- Files created: `ProjectDeadlineDetails`, `UnscheduledProjectsPanel`.
- Files modified: none beyond what Phase D already scaffolded.
- Depends on: Phase D; independent of Phase E's dialog internals (different files).
- Parallel-safe with: Phase E (see above).
- Risks: must call the exact existing `/api/projects/update` path with no behavioral drift — cover with a test asserting the same payload shape `ProjectMetaEditor` sends today.
- Tests: component + integration tests (§22).
- Verification: same as above.
- Isolated commit: yes.

**Phase G — Filters and responsive/mobile behavior.**
- Files created: `CalendarFilters`, `CalendarCompactSelector` (thin wrapper reusing `Calendar`), `SelectedDayAgenda`.
- Depends on: Phases D, E, F all functionally complete (filters need real items to filter, the mobile agenda needs the same data hook the grid uses).
- Parallel-safe with: nothing meaningfully — this phase's job is partly to *unify* what came before across breakpoints.
- Risks: the §4.7 duplication caution applies most directly here — verify the shared-derivation hook, don't let grid and agenda diverge.
- Tests: filter + mobile component tests, the shared-derivation regression test (§22).
- Verification: same as above, plus a manual mobile-viewport check.
- Isolated commit: yes.

**Phase H — Tests, QA, build, release verification.**
- No new feature files; fills any remaining gaps in the test matrix (§22), runs the full manual QA list, and is where `npm run build` is finally run — **by the user**, per this task's constraints.
- Verification commands: `npx vitest run` (full suite), `npx tsc --noEmit`, `npx eslint <changed files>`, `npm run lint`, `git diff --check`.
- Rollback strategy for the whole feature if a serious issue surfaces post-launch: since `calendar_events` is a wholly new, additive table with no writes to `projects`/`tasks` from this feature (deadline edits go through the pre-existing, independently-shipped `/api/projects/update` route), the Calendar feature can be **disabled at the nav/route level alone** (hide the nav item, the route stays reachable-but-unlinked) without any data cleanup or migration rollback needed — a clean, low-risk rollback story.
- Isolated commit: yes (or folded into Phase G's commit if the gap is small).

**No phase proposes parallel agents editing the same file** — B/C are file-disjoint by design; E/F are file-disjoint by design; D, G, H are each solo/sequential because they either establish or unify shared state.

---

## 25. Parallel execution plan (Step 26 — summary)

- **A** solo, first.
- **B** and **C** in parallel once A's schema/types are locked (no shared files).
- **D** solo, after B+C (establishes the shell everything else builds on).
- **E** and **F** in parallel after D (disjoint files — dialog vs. deadline-editor/unscheduled-panel).
- **G** solo, after E+F (unifies filters/mobile across both).
- **H** last (verification only, minimal new code).

---

## 26. Exact anticipated file list (Step 27)

**New files:**
```
supabase/migrations/202607290001_calendar_events.sql   (exact date/number TBD at implementation time)
supabase/migrations/202607290001_calendar_events.test.ts
lib/calendar/calendar-types.ts
lib/calendar/load-calendar-range.server.ts
lib/calendar/load-unscheduled-projects.server.ts
lib/calendar/calendar-grid.ts
lib/calendar/calendar-item-sort.ts
lib/calendar/*.test.ts (multiple, per §22)
app/api/calendar/route.ts
app/api/calendar/unscheduled/route.ts
app/api/calendar/events/route.ts
app/api/calendar/events/[id]/route.ts
app/api/calendar/**/*.test.ts (or a route-testing convention matching however this repo currently tests API routes, if at all — Track C/D did not find an existing precedent for testing `app/api/**` routes directly, worth confirming at implementation time)
app/dashboard/calendar/page.tsx
app/components/dashboard/calendar/calendar-page.tsx (or similar — top-level client component)
app/components/dashboard/calendar/calendar-toolbar.tsx
app/components/dashboard/calendar/calendar-month-grid.tsx
app/components/dashboard/calendar/calendar-day-cell.tsx
app/components/dashboard/calendar/calendar-item-chip.tsx
app/components/dashboard/calendar/selected-day-agenda.tsx
app/components/dashboard/calendar/calendar-compact-selector.tsx
app/components/dashboard/calendar/unscheduled-projects-panel.tsx
app/components/dashboard/calendar/calendar-filters.tsx
app/components/dashboard/calendar/add-edit-event-dialog.tsx
app/components/dashboard/calendar/project-deadline-details.tsx
app/components/dashboard/calendar/*.test.tsx (per component, per §22)
app/components/dashboard/ui/calendar/time-field.tsx
app/components/dashboard/ui/calendar/time-field.test.tsx
docs/TEXT2TASK_WORK_CALENDAR_IMPLEMENTATION_REPORT.md (future, once implemented — not part of this task)
```

**Likely modified files:**
```
app/components/dashboard-client.tsx           (DashboardNav type, if the SPA-tab fallback nav option is chosen instead of §23's recommended route refactor)
app/components/dashboard/dashboard-sidebar-profile.tsx   (new nav item; DashboardNav type)
app/components/dashboard/sidebar-button.tsx    (new icon case, if needed)
```

**Not expected to require changes**: `lib/tasks/date-only.ts`, `get-deadline-ui.ts`, `parse-deadline.ts` (reused as-is), `app/api/projects/update/route.ts` (reused as-is), any `projects`/`tasks` migration, `DateField`/`DeadlineField`/`Calendar`/`DatePickerPopover` (reused as-is), any Project Update / AI pipeline file (unrelated).

---

## 27. Updated realistic time estimate (Step 28)

Based on actual repository findings (not a generic estimate): **~10–15 engineer-days sequential** for one engineer working through Phases A→H in order. The month-grid component (Phase D) and the event dialog (Phase E) are the two largest single items, mainly because neither has a ready-made component to lift wholesale (the grid needs genuinely new multi-item-per-day rendering; the dialog is a 4th instance of a pattern that's never been shared). Everything else — date/time handling, RLS, the read-model merge, optimistic updates, project-deadline reuse — has strong, low-risk precedent to build directly on top of, which meaningfully de-risks and speeds up the rest of the work relative to a greenfield estimate.

With two engineers on the parallel-safe tracks in §25 (B‖C, then E‖F), this compresses to **~7–10 days**. The navigation-architecture decision (§23) should be resolved *before* Phase D starts — revisiting it mid-phase would be the single most expensive kind of rework in this plan, since it touches shared, cross-cutting nav files.

---

## 28. Open product/engineering questions (Step 23)

Only questions genuinely requiring product sign-off (repo-inspectable questions are answered directly above, not repeated here):

1. **Calendar route placement** (§4.1, §23) — build the recommended real `/dashboard/calendar` route with a nav-wiring refactor (shareable URL, shared shell, proper server-guard — moderate upfront cost), **or** ship it faster as a 4th SPA tab at plain `/dashboard` (zero nav-refactor cost, no distinct/shareable URL, matches today's "Dashboard/Extract/Tasks" precedent exactly)? **My recommendation is the real route**, but this genuinely trades off shipping speed against long-term URL/UX correctness and needs explicit sign-off given it touches shared infrastructure.
2. **Completed-project deadline visibility** (§6) — show Done projects' past deadlines on the calendar (de-emphasized), or hide them entirely once a project is marked Done? I recommend showing (de-emphasized) but this is a genuine product taste call.
3. **Archived-project deadline visibility** — should archived projects' deadlines ever appear on the calendar, or always be fully excluded (my default recommendation)?
4. **Manual events linked to a deleted project** — confirmed self-healing via `on delete set null` (§7) — but should the UI proactively surface "this event's project link was removed" as a one-time notice, or silently reflect the null state with no special messaging (my default recommendation, §21)?
5. **Client linking when no project is selected** — confirmed clients ARE a stable first-class entity (§7), so this question from the original brief is resolved by repo evidence, not a product call: independent client selection is safe and supported.
6. **Unscheduled Projects inline deadline-setting** — confirmed safe and recommended (§18) via the existing `DeadlineField`/`/api/projects/update` path; sign-off only needed if product wants this *not* offered inline for some UX reason.
7. **Clicking a project-deadline item: details vs. direct navigation** — I recommend supporting both (compact inline editor + a "View in Task CRM" escape hatch, §17); confirm this matches product's intended interaction weight (is a full navigation always preferred instead?).
8. **Manual event "status"** — confirmed explicitly out of MVP schema (§8); revisit only if product later wants a "mark done" concept for manual events distinct from tasks.
9. **Event deletion: hard or soft** — recommended soft (`deleted_at`, matching universal repo convention, §8); confirm no product reason exists to hard-delete instead (e.g., a stricter data-minimization requirement for calendar notes specifically).
10. **Filter persistence across sessions/URL** — recommended plain component state for MVP (§18), no existing precedent argues for URL-param persistence; confirm this is acceptable or whether shareable filtered views are actually a near-term want.

---

## 29. Explicit assumptions

- **`projects`/`tasks`/`clients`/`users` base tables predate this repo's tracked migration history** (confirmed no `CREATE TABLE` for any of them exists in `supabase/migrations/`) — every schema fact about them in this report is reconstructed from `ALTER`/RPC/`INSERT`/`SELECT` evidence and cross-checked TypeScript types, not read from one authoritative source. This is flagged wherever it applies (§7 clients, §6/§8 projects) and should be spot-verified against the live database schema before writing the actual migration, since an untracked base schema is inherently less certain than a tracked one.
- **RLS policies for `projects`/`tasks`/`clients` themselves could not be directly cited** (same reason) — the 4-policy convention is confirmed for every *tracked* table and assumed (with high confidence, given how consistently it's applied) to also govern these three, but this should be spot-verified in the Supabase dashboard before implementation.
- **The dashboard's current auth-guard inconsistency between `/dashboard` and `/dashboard/billing`/`/dashboard/profile`** is treated as pre-existing technical debt, not something this mapping is scoped to fix — the recommendation is only that the *new* Calendar route follow the safer of the two existing patterns, not that the older routes be retrofitted.
- **No live-Postgres test harness exists in this repo** (confirmed via the two existing migration test files' own doc comments) — the test matrix's "database/migration tests" are scoped accordingly (static assertions only), with cross-user-isolation/ownership testing pushed to the API-route test layer instead, where it's actually exercisable.
- **"Active projects" filtering** throughout this report consistently means the repo's own established `(is_archived = false or is_archived is null) and deleted_at is null` gate — applied to Calendar's new queries by direct analogy, not because any Calendar-specific migration or code was found to confirm it (none exists yet).

---

## 30. Explicit confirmation: no application code was modified

This session performed exclusively read-only investigation via four parallel, read-only subagent tracks (navigation/UI/calendar primitives; database schema/RLS/relationships; server/API patterns/read-model/deadline-edit path; test infrastructure/accessibility/performance/edge cases) plus this lead's own synthesis and architectural judgment calls. No `.ts`/`.tsx`/`.sql`/config/dependency/prompt/schema/test file was created, edited, or deleted, except this report. No migration was created or run. No dependency was installed. `npm run build` was not run. Nothing was committed or pushed. The only new file created in this entire session is this report.
