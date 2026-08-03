# Text2Task Authenticated Activity Phase 5 Implementation Report

## 1. Phase
Phase 5 implements the read-side owner analytics surface for authenticated product-view activity.

## 2. Commit Scope
This phase is local code only. It does not apply migrations, deploy, push, or modify `.claude/`.

## 3. Goal
Show authenticated product activity in the owner-only Users & Activity view and add a per-user owner-only timeline.

## 4. Owner Gate
Both owner analytics entry points call `requireOwner()` before cross-user authenticated activity is read.

## 5. Server Read Layer
Added `lib/activity/owner-authenticated-activity.server.ts` with `import "server-only"` and service-role Supabase Admin RPC reads.

## 6. Summary RPC
The Users & Activity page calls `get_owner_authenticated_activity_summary(p_user_ids uuid[])` once for the bounded set of known auth/profile user ids.

## 7. Timeline RPC
The timeline route calls `get_owner_user_activity_timeline(p_user_id uuid, p_limit int)` for one validated user id, defaulting to 200 rows.

## 8. RPC Bounds
Summary ids are deduped, UUID-validated, and capped at 2,000 before the RPC. Timeline limits are clamped to 500.

## 9. UUID Validation
The timeline route validates the dynamic `userId` param before Auth Admin resolution or timeline RPC access. Invalid ids call `notFound()`.

## 10. Auth Admin Resolution
The timeline route resolves the user via Supabase Auth Admin `getUserById`. Missing users call `notFound()`.

## 11. Merge Layer
Added `app/admin/analytics/users/owner-user-activity-merge.ts` so table row shaping stays pure and testable.

## 12. New Row Fields
Rows now include `authenticatedLastSeenAt`, `authenticatedLastViewedRoute`, `authenticatedLastEventName`, `totalAuthenticatedViews`, `authenticatedActiveDays`, and `isAuthenticatedReturningUser`.

## 13. Default Values
Missing authenticated activity defaults to `null`, `0`, and `false`, preserving existing Users & Activity behavior when the summary RPC has no row or is unavailable.

## 14. Last Activity
`lastActivityAt` now includes `authenticatedLastSeenAt`, so recent product views can move a user to the top of the owner table.

## 15. Table UI
The Users & Activity table adds compact `Authenticated activity`, `Usage`, and `Timeline` columns.

## 16. Event Labels
Added `lib/activity/product-event-labels.ts` for human labels. The UI does not use raw snake_case as the main display label.

## 17. Time Zone
Authenticated activity timestamps are formatted in Israel time with 24-hour output, matching the owner analytics convention.

## 18. Route Display
The summary column displays the last safe internal route when present.

## 19. Usage Display
Usage shows authenticated view count, active-day count, and a Returning badge for returning users.

## 20. Summary Cards
Added exactly two authenticated summary cards: `Authenticated active last 7 days` and `Returning users`.

## 21. Filters
Added `Viewed app` and `Returning` filters while preserving the existing filter set.

## 22. Owner/Test Visibility
Owner/test rows remain hidden by default. The new cards and filters operate over the same visible row set.

## 23. Timeline Route
Added `/admin/analytics/users/[userId]` as a server-rendered owner-only timeline page.

## 24. Timeline Entity Context
Timeline rows show only safe entity context: `Project` plus shortened UUID, `Calendar event` plus shortened UUID, `calendar_day` DateOnly, or no entity.

## 25. Sensitive Content Avoidance
The timeline does not read or display project names, client names, task content, update content, resource content, metadata, or public analytics payloads.

## 26. Failure Isolation
Summary RPC failures show a Users & Activity warning and keep all non-authenticated user data visible. Timeline RPC failures show `Authenticated activity is temporarily unavailable.`

## 27. Empty State
Timeline pages with no rows show `No authenticated product views recorded.`

## 28. Product Surface Isolation
No dashboard/product page imports were added. No browser component calls Supabase RPCs directly. No public API route was added for owner reads.

## 29. Overview Isolation
The existing owner analytics Overview page was not modified.

## 30. Tests Added
Added focused tests for the server read layer, merge helper, Users & Activity UI, and timeline route.

## 31. Verification
Commands run:

- `npm.cmd test -- lib/activity/owner-authenticated-activity.server.test.ts app/admin/analytics/users/owner-user-activity-merge.test.ts app/admin/analytics/users/user-activity-table.client.test.tsx app/admin/analytics/users/[userId]/page.test.tsx` passed: 4 files, 27 tests.
- `npm.cmd test -- lib/activity/product-event-contracts.test.ts lib/activity/log-product-event.server.test.ts lib/activity/use-track-product-view.client.test.tsx app/api/activity/product-event/route.test.ts app/components/dashboard-client.test.tsx lib/analytics/owner-analytics-window.test.ts` passed: 6 files, 158 tests.
- `npx.cmd tsc --noEmit` passed.
- Targeted `npm.cmd run lint -- ...` passed.
- `npm.cmd run lint` passed.
- Initial `npm.cmd run build` failed only because sandboxed network access could not fetch Google Fonts.
- Escalated `npm.cmd run build` passed after network access was allowed for Google Fonts.
- `npm.cmd test` passed: 93 files, 1334 tests.
