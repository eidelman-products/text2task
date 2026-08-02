# Text2Task Authenticated Activity - Phase 4 Implementation Report

## 1. Exact verdict

Phase 4 is complete locally. The six deliberate authenticated product-surface openings are instrumented through the existing isolated product-view helper. No admin analytics UI was changed. No migration was applied. Nothing was pushed or deployed.

## 2. Repository state before implementation

```
git branch --show-current             -> main
git log --oneline -6                  -> 0d4a4ae, 89beecb, 7232b4e, c08f450, 55307bc, 6ac9166
git status --short                    -> ?? .claude/
git status -sb                        -> ## main...origin/main [ahead 3], plus ?? .claude/
git log --oneline origin/main..HEAD   -> 0d4a4ae, 89beecb, 7232b4e
git diff --check                      -> clean
```

Git also printed the pre-existing global ignore permission warning for `C:\Users\Home/.config/git/ignore`.

## 3. Phase 1-3 commit verification

Confirmed local commits:

- `7232b4e Add authenticated activity data foundation`
- `89beecb Add authenticated activity tracking endpoint`
- `0d4a4ae Instrument authenticated top-level activity`

None was amended.

## 4. Pre-existing `.claude/` status

`.claude/` was present before implementation as unrelated untracked work. It was not read for this feature, modified, staged, committed, cleaned, or reset.

## 5. Files created

- `app/components/dashboard/tasks/project-surface-activity.test.tsx`
- `docs/TEXT2TASK_AUTHENTICATED_ACTIVITY_PHASE4_IMPLEMENTATION_REPORT.md`

## 6. Files modified

- `lib/activity/use-track-product-view.client.ts`
- `lib/activity/use-track-product-view.client.test.tsx`
- `app/components/dashboard/tasks/desktop-tasks-table.tsx`
- `app/components/dashboard/tasks/mobile-task-card.tsx`
- `app/components/dashboard/resources/resource-manager-modal.tsx`
- `app/components/dashboard/tasks/project-updates/use-project-update-history.ts`
- `app/components/dashboard/tasks/project-updates/use-project-update.ts`
- `app/components/dashboard/calendar/work-calendar-client.tsx`
- `app/components/dashboard/calendar/work-calendar-client-activity.test.tsx`

## 7. Helper/entity-contract changes

`useTrackProductView()` now supports all 10 Phase 1 event names, including entity-bearing events. The helper still validates through `validateProductEventInput()`, sends only `{ event, navigationId }`, uses same-origin `POST` with JSON and `keepalive`, swallows fetch failures, ignores non-204 responses, never retries, and imports no Supabase/server-only/service-role code.

## 8. Project-details instrumentation

Desktop and mobile project detail expansion now tracks `project_details_expanded` on closed-to-open transitions only, route `/dashboard`, `entityType: "project"`, `entityId: project UUID`. Desktop avoids counting the existing auto-highlight expansion by tracking only the user toggle path.

## 9. Resources instrumentation

`ResourceManagerModal` tracks `project_resources_viewed` from confirmed open state keyed by `isOpen + projectId`, route `/dashboard`, project UUID only. Task IDs, resource IDs, names, and content are not sent.

## 10. History instrumentation

`useProjectUpdateHistory()` tracks `project_history_viewed` from its open state and resolved project UUID. History loading, refreshes, rows, and timeline content are not sent and do not resend.

## 11. Client Update instrumentation

`useProjectUpdate()` tracks `client_update_opened` from the Add Client Update modal open state and resolved project UUID. Typing, image selection, analyze, review, and apply flows are not instrumented.

## 12. Calendar-day instrumentation

`WorkCalendarClient` tracks `calendar_day_viewed` only when `activeDialog.mode === "day"`, route `/dashboard/calendar`, `entityType: "calendar_day"`, `entityId` as the existing strict DateOnly string.

## 13. Calendar-event instrumentation

`WorkCalendarClient` tracks `calendar_event_viewed` only when `activeDialog.mode === "edit"`. It resolves the bare UUID with the existing `parseManualCalendarEventId()` helper and sends no title, time, notes, project/client relationship, or content.

## 14. Navigation-ID lifecycle

Each logical opening receives one `crypto.randomUUID()` navigation ID. Closing resets the helper state, so a later reopen gets a new ID. Switching to a different entity while open also gets a new ID.

## 15. Strict Mode behavior

The Phase 3 ref-based lifecycle remains intact: React Strict Mode effect replay reuses the same logical navigation ID and does not double-send.

## 16. Hidden-tab and stale-pending behavior

The helper still defers while `document.visibilityState !== "visible"`. Closing before visibility returns resets the pending view, and changing entity while hidden cancels the stale pending event and sends only the current one when visible.

## 17. Analytics-failure isolation

Product UI never awaits tracking. Tests cover rejected fetches and non-204 endpoint responses including `400`, `401`, `413`, `415`, and `503`; product surfaces still open/render. A missing table or storage outage is represented by the endpoint returning `503`, which the client ignores.

## 18. Primary UI actions remain first

Instrumentation is driven by already-open UI state or independent local state after the user action. No product save/update/apply/delete request is wrapped with, blocked by, or awaited on analytics.

## 19. No sensitive content is sent

Payloads contain only event name, route, entity type, entity ID, and navigation ID. No user ID, email, project title, client name, task text, update text, notes, resource names, calendar-event title, metadata, timestamps, or idempotency key is sent.

## 20. Phase 3 behavior unchanged

Dashboard, Extract, Tasks, and Calendar top-level view tracking continues to pass all Phase 3 tests. Top-level no-entity events still send null entity fields.

## 21. `record_dashboard_visit` unchanged

The existing `/api/activity/dashboard-visit` effect and `record_dashboard_visit()` RPC path were not modified.

## 22. No admin analytics UI changed

No file under `app/admin/analytics` was changed. Phase 5 was not started.

## 23. Security review

Auth remains server-resolved by `POST /api/activity/product-event`. `/dashboard` and `/dashboard/calendar` still call `requireDashboardUser()` before rendering instrumented clients. Client code imports no service-role/server-only modules and sends no client-supplied identity. `public.analytics_events`, Phase 1 migrations/RPCs, and the Phase 2 endpoint contract were not changed.

## 24. Tests added

- Helper tests for entity-bearing envelopes, project/calendar-day/calendar-event IDs, invalid entity IDs, non-204 isolation, hidden stale cancellation, reopen navigation IDs, and Phase 4 static file ownership.
- Project surface tests for desktop/mobile project details, Resources open/rerender/switch/reopen/hidden stale, History open/reopen/project change/failure, and Client Update open/typing/reopen/project change/failure.
- Calendar activity tests for day opens/reopens, create-mode exclusion, manual-event edit tracking, malformed manual-event IDs, and dialog failure isolation.

## 25. Commands run

```
npx.cmd vitest run lib/activity/use-track-product-view.client.test.tsx --reporter=verbose
npx.cmd vitest run app/components/dashboard/tasks/project-surface-activity.test.tsx --reporter=verbose
npx.cmd vitest run app/components/dashboard/calendar/work-calendar-client-activity.test.tsx --reporter=verbose
npx.cmd vitest run supabase/migrations/202608030001_authenticated_product_events.test.ts supabase/migrations/202608030002_owner_authenticated_activity_report_rpc.test.ts lib/activity/product-event-contracts.test.ts lib/activity/log-product-event.server.test.ts app/api/activity/product-event/route.test.ts lib/activity/use-track-product-view.client.test.tsx app/components/dashboard-client.test.tsx app/components/dashboard/calendar/work-calendar-client-activity.test.tsx app/components/dashboard/tasks/project-surface-activity.test.tsx --reporter=verbose
npx.cmd tsc --noEmit
npx.cmd eslint <targeted Phase 4 files>
npx.cmd eslint .
git diff --check
npx.cmd vitest run --reporter=verbose
npm.cmd run build
```

The first production build attempt failed under sandboxed network restrictions while fetching existing Next Google Fonts. The same build passed after approved network access. No font implementation was changed.

## 26. Exact test/lint/type-check/build results

- Targeted helper tests: 1 file passed, 24 tests passed.
- Targeted project surface tests: 1 file passed, 9 tests passed.
- Targeted calendar activity tests: 1 file passed, 13 tests passed.
- Phase 1-4 targeted regression pack: 9 files passed, 208 tests passed.
- `npx.cmd tsc --noEmit`: passed.
- Targeted ESLint: passed.
- Full `npx.cmd eslint .`: passed.
- `git diff --check`: passed; Git printed CRLF normalization warnings only.
- Full repository suite: 89 files passed, 1307 tests passed.
- Production build: passed after approved network access. `/api/activity/product-event` remains compiled; no new route was introduced.

## 27. No migration applied

No `supabase db push`, migration up, or equivalent command was run.

## 28. Nothing pushed or deployed

No `git push` was run. No deployment was triggered.

## 29. Final git status

At report creation, the working tree contained only Phase 4 tracked changes, this new report, and the pre-existing untracked `.claude/` directory. `.claude/` remained unstaged and uncommitted.

## 30. Exact recommended Phase 5 scope

Phase 5 should extend owner-only Users & Activity analytics: wire the Phase 1 summary/timeline RPCs into the admin Users page, add the per-user timeline route, preserve `requireOwner()`, reuse the existing owner/test filter, and keep the Overview/anonymous analytics pipeline untouched.
