# Text2Task Client Share Data Flow Audit and Architecture

Date: 2026-09-08

Scope: repository-first forensic audit plus user-supplied Production evidence addendum. No production or staging database was queried by Codex. No product code, SQL migration, dependency, deployment, git staging, commit, or push action was performed while producing this artifact.

## A. Executive Summary

Confirmed issue: Client Preview and public Client Share can drift from the internal Task CRM task statuses and progress.

Primary root cause: `share_link_tasks.public_group` stores mutable client-facing task presentation state that is initially derived from canonical subtask status, then later treated as the source for shared task state and progress. Once a mapping exists, quick-share intentionally stops recomputing it. The server projection reads live task titles from `public.tasks`, but it does not read live `tasks.status` or `tasks.completed_at`; therefore Done/In Progress/Review/New changes after initial sharing are not reflected in Preview or public Share.

Production confirmation, supplied after the initial audit: for project `Greenfield Studio Website Launch`, Production has one total share link, one currently active share link, and no multiple-active-link conflict. Canonical tasks are Done, Done, In Progress, Review, Not Started, Not Started, with two completed tasks and 33 percent canonical progress. Every corresponding `share_link_tasks.public_group` row is `coming_up`, producing 0 of 6 share-derived progress. This confirms the P0 repository root cause in Production.

The current architecture is live for:
- project title, project status, and target date values, subject to visibility flags
- task title, when the mapped task still resolves
- resource classification and external link safety
- link/session/grant access checks

The current architecture is not live for:
- shared task group/state
- shared task completion
- shared progress numerator

Caching is not supported as the root cause from repository evidence. Relevant routes are `force-dynamic`, API responses are `no-store`, public client fetches use `cache: "no-store"`, and Preview discards projection state when closed.

Recommended target architecture: keep share tables as access/publication metadata, but make the single server-side Client Share projection derive task public state and progress from canonical `public.tasks.status` and `public.tasks.completed_at` on every fresh read. Owner-curated presentation fields should remain only where they do not duplicate mutable canonical work state, or must be clearly split into inclusion/order/client-feedback override fields.

## B. Current Data-Flow Diagram

Internal Task CRM:

```text
public.tasks / public.projects
  -> lib/tasks/load-dashboard-tasks.server.ts
  -> app/components/dashboard/tasks/task-utils.ts
  -> app/components/dashboard/tasks/desktop-tasks-table.tsx
  -> app/components/dashboard/tasks/mobile-task-card.tsx
```

Share creation/update:

```text
Share with client button
  -> app/components/dashboard/tasks/share-link/use-share-link.ts
  -> app/components/dashboard/tasks/share-link/quick-share-defaults.ts
  -> app/components/dashboard/tasks/share-link/share-link-client.ts
  -> app/api/share-links and app/api/share-links/[id]/config
  -> lib/share/share-links-repository.server.ts
  -> public.create_share_link_draft / public.save_share_configuration
  -> public.project_share_links / public.share_link_tasks / public.share_link_resources / public.share_link_updates
```

Owner Preview:

```text
Preview button
  -> useShareLink.openPreview()
  -> previewShareLink()
  -> GET /api/share-links/[id]/preview
  -> lib/share/client-share-projection.server.ts buildClientShareProjection()
  -> get_share_link_management_state() for mappedTasks/mappedResources/link metadata
  -> live projects(title,status,deadline_date)
  -> live tasks(id,task_title)
  -> assembleClientProjection()
  -> ClientProjectView
```

Public Share:

```text
/share/[publicId] page
  -> ShareView client component
  -> fragment secret exchange via POST /api/share/session
  -> HttpOnly share browser session cookie + share_session_grants
  -> GET /api/share/[publicId]/projection
  -> verifyShareProjectionAuthorization()
  -> buildPublicClientShareProjection()
  -> service-role bounded reads of project_share_links/share_link_tasks/share_link_resources/share_link_updates
  -> live projects(title,status,deadline_date)
  -> live tasks(id,task_title)
  -> assembleClientProjection()
  -> ClientProjectView
```

Observed data-flow defect:

```text
Canonical subtask status mutation
  -> public.tasks.status / public.tasks.completed_at updated
  -> internal CRM reflects new state
  -> share_link_tasks.public_group remains unchanged
  -> Preview/Public projection uses old public_group for task grouping/progress
```

## C. Canonical Source-of-Truth Table

| Data concept | Authoritative source | Internal reader | Preview reader | Public reader |
| --- | --- | --- | --- | --- |
| Project title | `public.projects.title` | `loadDashboardTasks` joined project row, `buildTaskProjectGroups` | `buildClientShareProjection` reads `projects.title` if `titleVisible` | `buildPublicClientShareProjection` reads `projects.title` if `title_visible` |
| Project status | `public.projects.status`, with internal fallback derivation when missing | `buildTaskProjectGroups` prefers `project.status`, else `getProjectStatus(tasks)` | `buildClientShareProjection` reads `projects.status` and maps via `PROJECT_STATUS_MAP` | `buildPublicClientShareProjection` reads `projects.status` and maps via `PROJECT_STATUS_MAP` |
| Subtask title | `public.tasks.task_title` | `loadDashboardTasks` -> `normalizeTask` -> `subtasks.title` | reads `tasks.id, task_title` for mapped task ids | reads `tasks.id, task_title` for mapped task ids |
| Subtask status | `public.tasks.status` | rendered from `TaskProjectSubtask.status` | not read | not read |
| Subtask completion | `public.tasks.status = Done` or `public.tasks.completed_at` | `completedSubtaskCount` uses either Done or `completed_at` | not read; inferred from `share_link_tasks.public_group = completed` | not read; inferred from `share_link_tasks.public_group = completed` |
| Project progress | derived from canonical task rows | `completedSubtaskCount / subtaskCount` | derived from resolved mapped tasks and persisted `publicGroup` | derived from resolved mapped tasks and persisted `public_group` |
| Shared task inclusion/order | owner share configuration | not applicable | `share_link_tasks.subtask_id/display_order` through management RPC | direct service-role read of `share_link_tasks` |
| Waiting for feedback | share presentation metadata | not canonical task state | `share_link_tasks.waiting_for_client_feedback` | `share_link_tasks.waiting_for_client_feedback` |
| Share access | `project_share_links`, `share_browser_sessions`, `share_session_grants` | owner UI only | authenticated owner route | public route via fragment exchange and cookie grant |
| Share secret | generated server-side, HMAC digest in `project_share_links`, encrypted owner-reveal material in `project_share_secret_material` | not exposed in CRM list | Preview does not reveal | public exchange uses fragment secret, then cookie grant |

## D. Exact File/Function Inventory

Routes:
- `app/share/[publicId]/page.tsx`: public server shell, `dynamic = "force-dynamic"`.
- `app/api/share/session/route.ts`: fragment secret/PIN exchange, session cookie and grant creation.
- `app/api/share/[publicId]/projection/route.ts`: public projection read endpoint.
- `app/api/share/[publicId]/pin/route.ts`: PIN recovery/reverification.
- `app/api/share/[publicId]/resources/[fileRef]/route.ts`: public file delivery behind the same grant gate.
- `app/api/share/[publicId]/messages/route.ts`: public client message route.
- `app/api/share-links/route.ts`: owner management-state read and draft creation.
- `app/api/share-links/[id]/preview/route.ts`: owner Preview projection endpoint.
- `app/api/share-links/[id]/config/route.ts`: owner configuration save endpoint.
- `app/api/share-links/[id]/activate/route.ts`, `disable/route.ts`, `enable/route.ts`, `revoke/route.ts`, `rotate/route.ts`, `reveal/route.ts`, `pin/route.ts`, `expiry/route.ts`: owner lifecycle/access operations.
- `app/api/share-links/[id]/messages/**`: owner communication history/reply/status/analyze routes.
- `app/api/share-links/summary/route.ts`, `app/api/share-links/history-link/route.ts`: owner share summary/history helpers.

Components and hooks:
- `app/components/dashboard/tasks/share-link/share-link-panel.tsx`: owner Client Share panel and Preview modal.
- `app/components/dashboard/tasks/share-link/share-link-quick-share.tsx`: quick-share UI.
- `app/components/dashboard/tasks/share-link/share-link-configuration-editor.tsx`: advanced task/resource/settings editor.
- `app/components/dashboard/tasks/share-link/use-share-link.ts`: owner orchestration for create/share/preview/lifecycle.
- `app/components/dashboard/tasks/share-link/share-link-client.ts`: client fetch wrappers.
- `app/components/dashboard/tasks/share-link/client-project-view.tsx`: shared read-only client-facing presentation.
- `app/share/[publicId]/share-view.client.tsx`: public client state machine and projection rendering.
- `app/components/dashboard/tasks/desktop-tasks-table.tsx`: internal desktop Task CRM.
- `app/components/dashboard/tasks/mobile-task-card.tsx`: internal mobile Task CRM.

Services, contracts, mappers:
- `lib/share/client-share-projection.server.ts`: `buildClientShareProjection`, `buildPublicClientShareProjection`, `assembleClientProjection`, `mapProjectStatusForClient`, `toSafeExternalClientUrl`.
- `lib/share/client-share-projection-contracts.ts`: strict external projection schema.
- `lib/share/share-contracts.ts`: owner management/configuration schemas, share public group vocabulary.
- `lib/share/share-links-repository.server.ts`: RPC wrappers for owner share operations.
- `lib/share/share-session-grant.server.ts`: public link/session/grant verification.
- `lib/share/share-secret.server.ts`, `share-secret-encryption.server.ts`, `share-pin.server.ts`, `share-browser-session.server.ts`, `share-public-id.server.ts`, `share-rate-limit.server.ts`, `share-request-security.server.ts`.
- `app/components/dashboard/tasks/share-link/quick-share-defaults.ts`: automatic public group derivation and persisted-mapping behavior.
- `app/components/dashboard/tasks/task-utils.ts`: internal canonical task grouping/progress/status derivation.
- `lib/tasks/load-dashboard-tasks.server.ts`: internal dashboard task query.

Task/status writes:
- `app/api/tasks/update/route.ts`: single task status updates.
- `app/api/tasks/bulk-status/route.ts`: bulk status updates.
- `app/api/projects/update/route.ts`: project status updates.
- `app/api/project-updates/apply/route.ts`: project update application can mutate task/project state.
- `supabase/migrations/202609040001_canonical_production_closure.sql`: `public.apply_task_bulk_status_transaction`.

Tests inspected:
- `lib/share/client-share-projection.server.test.ts`
- `app/components/dashboard/tasks/share-link/quick-share-defaults.test.ts`
- `app/components/dashboard/tasks/share-link/client-project-view.test.tsx`
- `app/components/dashboard/tasks/share-link/share-link-quick-share.test.tsx`
- `app/components/dashboard/tasks/share-link/use-share-link.test.ts`
- `app/components/dashboard/tasks/share-link/share-link-configuration-editor.test.tsx`
- `app/api/share-links/[id]/preview/route.test.ts`
- `app/api/share/[publicId]/projection/route.test.ts`
- `app/api/share/session/route.test.ts`
- `app/api/share/[publicId]/pin/route.test.ts`
- `app/api/share/[publicId]/resources/[fileRef]/route.test.ts`
- `lib/share/share-session-grant.server.test.ts`
- `lib/share/share-contracts.test.ts`

## E. Exact DB Object Inventory

Canonical task/project data:
- `public.projects`
  - Relevant columns: `id`, `user_id`, `client_id`, `client_name`, `title`, `summary`, `deadline_date`, `priority`, `status`, `is_archived`, `archived_at`, `completed_at`, `deleted_at`, `created_at`, `updated_at`, `contact_name`.
  - Primary key: `id`.
  - Tenant boundary: `user_id`; RLS owner policies exist in `20260615222035_remote_schema.sql`.
  - Status source: `status`, default `New`.
  - Completion source: `completed_at` lifetime marker plus `status = Done`.
  - Indexes include `projects_user_active_idx`, `projects_user_id_idx`, `projects_client_id_idx`.
- `public.tasks`
  - Relevant columns: `id`, `user_id`, `project_id`, `client_id`, `task_title`, `status`, `priority`, `subtask_order`, `completed_at`, `is_archived`, `archived_at`, `deleted_at`, `created_at`, `updated_at`.
  - Primary key: `id`, legacy bigint with `tasks_id_seq`.
  - Tenant boundary: `user_id`; project relation: `project_id`.
  - Canonical subtask state: `status`.
  - Canonical completion: `status = Done` or `completed_at is not null` in internal UI.
  - Indexes include `tasks_project_id_idx`, `tasks_project_order_idx`, `tasks_status_idx`, `tasks_user_active_idx`, `tasks_user_completed_idx`, `tasks_user_deleted_idx`.
- `public.task_resources`
  - Relevant columns: `id`, `user_id`, `project_id`, `task_id`, `resource_type`, `title`, `url`, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `notes`.
  - Public projection intentionally excludes notes and raw storage metadata.

Client Share tables:
- `public.project_share_links`
  - Purpose: link lifecycle, access metadata, visibility flags.
  - Relevant columns: `id`, `user_id`, `project_id`, `public_id`, `secret_digest`, `secret_digest_version`, `state`, `expires_at`, `comments_enabled`, `client_facing_subtitle`, `content_direction`, `configuration_version`, `access_epoch`, `pin_epoch`, PIN hash columns, lifecycle timestamps, `title_visible`, `status_visible`, `target_date_visible`, `view_count`, `last_viewed_at`.
  - Does not store copied project title/status/date values.
- `public.share_link_tasks`
  - Purpose: explicit owner-curated list of visible subtasks and presentation metadata.
  - Relevant columns: `id`, `user_id`, `share_link_id`, `subtask_id`, `public_group`, `waiting_for_client_feedback`, `display_order`, timestamps.
  - Unique key: `(share_link_id, subtask_id)`.
  - FKs: `share_link_id -> project_share_links(id)`, `subtask_id -> tasks(id)`, `user_id -> auth.users(id)`.
  - Check: `public_group in ('in_progress','waiting_for_feedback','completed','coming_up')`.
  - Critical defect field: `public_group` duplicates mutable task state for progress purposes.
- `public.share_link_resources`
  - Purpose: explicit owner-curated resource inclusion/presentation.
- `public.share_link_updates`
  - Purpose: owner-published latest update body/version.
- `public.project_share_secret_material`
  - Purpose: encrypted owner-reveal material. Closed table.
- `public.share_browser_sessions`
  - Purpose: anonymous browser session identity. Stores only digest, not raw cookie secret.
- `public.share_session_grants`
  - Purpose: per-browser/per-link access grant. Uses access and PIN epochs.
- `public.share_rate_limit_buckets`, `public.share_messages`, `public.share_link_events`
  - Purpose: rate limiting, communication, and audit/event support.

Relevant RPC/functions:
- `public.get_share_link_management_state(p_project_id uuid)`: owner read of link metadata and mapped task/resource/update state.
- `public.save_share_configuration(p_link_id uuid, p_settings jsonb, p_tasks jsonb, p_resources jsonb, p_publish_update jsonb)`: owner atomic settings/task/resource/update save. Null `p_tasks` leaves existing task mapping unchanged.
- `public.create_share_link_draft`, `activate_share_link`, `disable_share_link`, `reenable_share_link`, `revoke_share_link`, `rotate_share_link_secret`, `reveal_share_link_secret`, `set_share_link_pin`, `clear_share_pin`, `set_share_link_expiry`, `clear_share_link_expiry`.
- `public.apply_task_bulk_status_transaction(p_task_ids bigint[], p_status text)`: transactional Done/In Progress task status path.

## F. Status Matrix

| Internal DB value | Internal UI label | Counts complete internally | Preview/Public current label or bucket | Current issue |
| --- | --- | --- | --- | --- |
| `Not Started` | Legacy value normalized to New by `normalizeTaskFromApi`; Production evidence confirms it can exist in `tasks.status` | No, unless `completed_at` is set | Currently not mapped by Client Share task projection because task status is not read; future mapper must treat as not started | Production-present legacy canonical DB value |
| `New` | New | No, unless `completed_at` is set | Project status `not_started`; automatic task group `coming_up` on first quick-share | Existing mapping can stay `coming_up` forever |
| `In Progress` | In Progress | No, unless `completed_at` is set | Project status `in_progress`; automatic task group `in_progress` | Existing mapping may still be `coming_up` |
| `Review` | Review | No, unless `completed_at` is set | Project status `in_progress`; automatic task group `in_progress` | Existing mapping may still be `coming_up`; public label loses Review nuance by design |
| `Urgent` | Urgent | No, unless `completed_at` is set | Project status mapping fails closed to null; automatic task group `in_progress` | Internal value appears supported in UI but omitted at project status projection |
| `Done` | Done | Yes | Project status `completed`; automatic task group `completed` | Existing mapping may still be `coming_up` or `in_progress` |
| `In Review` | Not a current select option in inspected Task CRM selects | No known direct support | Not mapped; likely null if project status | Mentioned in docs/copy; not in current status enum paths inspected |
| `Completed` | UI wording exists; project-update post-processing maps completed/complete to Done; not a current Task CRM select option | Internal `isDoneTask` checks only lowercase `done`, but `completed_at` also counts | Not mapped by current Client Share project status | Legacy alias to handle as completed in future share normalizer |
| null/empty | UI defaults to New in grouping | No unless `completed_at` set | Project status null; task status not read | Fails closed externally |

Incident-specific Production mapping:
- Internal subtasks are Done, Done, In Progress, Review, Not Started, Not Started and should produce 2/6 complete, 33 percent.
- All six `share_link_tasks.public_group` rows are `coming_up`.
- Current shared view therefore shows 0/6 complete from the stale share mapping.
- `projects.status = New`; public project status `Not started` is therefore explained by live project status mapping, not by task progress. Project status and task progress are separate concepts in the current product architecture.

## G. Progress Calculation Comparison

Internal Task CRM:
- Location: `app/components/dashboard/tasks/task-utils.ts`.
- Numerator: subtasks where lowercase status is `done` or `completed_at` is truthy.
- Denominator: all grouped subtasks included in the current task list.
- Display: `desktop-tasks-table.tsx` shows `completedSubtaskCount/subtaskCount done`; `mobile-task-card.tsx` shows equivalent progress.
- Deleted/archived: dashboard load/filtering and subtask eligibility govern visible groups; `isActiveCurrentTask` excludes archived/deleted in active views.

Owner quick-share preview:
- Location: `quick-share-defaults.ts`.
- If no mapping exists: derives counts from current subtasks using `suggestAutomaticPublicGroup`.
- If any mapping exists: counts persisted `mappedTasks`.
- Numerator: `publicGroup === 'completed'`, unless waiting-for-feedback is counted separately.
- Denominator: mapped task count or automatic eligible subtask count.

Owner Preview and public Share:
- Location: `lib/share/client-share-projection.server.ts`, `assembleClientProjection`.
- Numerator: resolved projected tasks where `publicGroup === 'completed'`.
- Denominator: resolved mapped tasks.
- Does not read `tasks.status` or `tasks.completed_at`.
- Soft-deleted mapped tasks disappear because callers query only `.is('deleted_at', null)`.
- Archived task filtering gap: owner automatic inclusion excludes archived tasks, but projection reads only `deleted_at` and not `is_archived` for task rows. The schema comment says projection must also filter `is_archived`; current code does not select/filter it.

Conclusion: there are multiple independent progress calculations. Internal progress is canonical-state based; Client Share progress is share-presentation based.

## H. Cache/Staleness Findings

Caching is not confirmed as a contributor.

Evidence:
- `app/share/[publicId]/page.tsx`: `dynamic = "force-dynamic"`.
- `app/api/share/[publicId]/projection/route.ts`: `dynamic = "force-dynamic"` and `Cache-Control: private, no-store`.
- `app/api/share/session/route.ts`: `dynamic = "force-dynamic"` and no-store headers.
- `app/api/share-links/[id]/preview/route.ts`: explicit no-store headers.
- `app/api/share-links/route.ts` and `app/api/share-links/[id]/config/route.ts`: explicit no-store headers.
- `app/share/[publicId]/share-view.client.tsx`: projection/session/PIN fetches use `cache: "no-store"` and `credentials: "same-origin"`.
- `useShareLink.openPreview()` discards `previewData` on close and fetches fresh on reopen.

Residual non-root-cause note: public share pages revalidate every 60 seconds and on focus/visibility once ready. Real-time websocket propagation is explicitly not required by the locked requirement.

## I. Security Findings

Security posture to preserve:
- Public viewers do not directly query `public.projects`, `public.tasks`, or share tables from the browser.
- Public projection is server-mediated through `/api/share/[publicId]/projection`.
- The public URL carries only `publicId` in the path and a fragment secret initially; `ShareView` scrubs the fragment after exchange.
- Raw share secret is not stored in Postgres; `project_share_links.secret_digest` is a one-way digest. Owner reveal uses encrypted material in `project_share_secret_material`.
- Public reads revalidate session, link state, expiry, project existence/deletion, and grant epoch state on every projection read through `verifyShareProjectionAuthorization`.
- Public route failures are generic and avoid existence disclosure.
- Projection contract excludes internal ids, raw rows, task priority, notes, raw resources, storage path, file name, mime type, size bytes, raw project/task rows, and secret/PIN material.
- `ClientProjectView` receives only strict `ClientProjectProjection` and public route `publicId` for file URLs.
- RLS is enabled for canonical and share tables in active migrations; share session/grant tables are service-role mediated.

Security defects or risks discovered:
- Fixing live task state must not grant `anon` direct access to canonical tables.
- The projection currently reads `tasks.id, task_title` only. A safe fix needs `status`, `completed_at`, and likely `is_archived` in the bounded server read, still scoped by `project_id`, `user_id`, mapped ids, and `deleted_at is null`.
- The `share_link_tasks` table comment states soft-deleted and archived task filtering must happen at projection read time; current projection filters deleted but not archived.

## J. Git History/Evolution Findings

Relevant history:
- `2ba1bbb Add Client Share Phase 1B owner reads`
- `c4c19d3 Add Client Share Phase 1B lifecycle operations`
- `6023107 Add Client Share Phase 1B access operations`
- `80fd66b Add Client Share Phase 1B configuration save`
- `e2a8a6c Add Client Share Phase 1C publication intent`
- `7f38212 Add Client Share Phase 2B content configuration`
- `8cb91a7 Add Client Share Phase 2C access and sharing controls`
- `da3f62f Add Client Share Phase 2D preview projection`
- `59dc254 Complete Client Share Phase 3 public sharing`
- later hardening through phases 4-8 and canonical migration recovery.

`git log -S"Progress computed ONLY from the shared tasks"` and `git log -S"CORE RULE (owner overrides always win)"` both identify `59dc254 Complete Client Share Phase 3 public sharing` as the point where the current mapped-task progress behavior and persisted-mapping rule are visible in the audited source.

Status workflow has richer values (`New`, `In Progress`, `Review`, `Urgent`, `Done`) in current Task CRM UI and API routes. Client Share's public vocabulary is deliberately smaller (`coming_up`, `in_progress`, `waiting_for_feedback`, `completed`). The bug is not the existence of a smaller public vocabulary by itself; it is treating the smaller derived value as durable mutable work state after canonical status changes.

## K. Confirmed Root Cause(s)

Confirmed from repository:
- `share_link_tasks.public_group` persists a derived client-facing task state.
- `save_share_configuration` preserves existing mappings when `p_tasks is null`.
- `useShareLink.shareUpdate()` sends automatic task mappings only when no mapping exists; after any mapping exists it omits `tasks`.
- `assembleClientProjection()` uses `mapped.publicGroup` for each task and computes completion from that group.
- Preview and public Share read live task title only, not live status/completion.
- Existing tests assert this behavior.

Requires Production database verification:
- The exact Production `project_share_links.status_visible` value for the incident link.
- The exact Production `projects.status` for "Greenfield Studio Website Launch".
- The exact Production `share_link_tasks.public_group` values for the six incident subtasks.

However, the observed UI of 0/6 strongly matches all six mapped task groups being non-`completed`, while the "Not started" project label strongly matches `projects.status = 'New'` with status visible.

## L. Root Causes Ranked

P0:
- Duplicated mutable task state in `share_link_tasks.public_group` is used as live completion/progress state.
- Projection does not read canonical `tasks.status`/`tasks.completed_at` for shared tasks.

P1:
- Multiple progress implementations with incompatible sources: internal uses canonical completion; share uses persisted public groups.
- Project status is read from `projects.status`, not derived from mixed subtask statuses; if project status remains `New`, public status shows Not started even when subtasks have advanced.

P2:
- Status mapping gaps: `Urgent`, `In Review`, and `Completed` are not mapped in `PROJECT_STATUS_MAP`; `Urgent` intentionally fails closed in tests, but it is still a current UI project status option.
- Advanced editor and quick-share default mapping differ for `New` tasks: quick-share maps `New -> coming_up`; advanced editor's new-selection heuristic maps non-Done statuses to `in_progress`.

P3:
- Projection filters soft-deleted tasks but not archived tasks, despite migration comments saying archived tasks must also be filtered on public projection reads.
- Current tests lock in stale snapshot behavior rather than live canonical synchronization.

## M. Other Architectural Defects Discovered

- There is no single canonical share status/progress mapper. The repository has internal status derivation, quick-share derivation, editor derivation, and projection derivation.
- `waitingForClientFeedback` is a separate share presentation flag that can override grouping visually but is counted separately in quick-share. This needs clear semantics in any live-derived architecture.
- `configuration_version` does not bump for task mapping changes in `save_share_configuration` per function comments. That is acceptable for presentation freshness under current design, but any future grant/cache logic must not rely on configuration version to represent task status freshness.
- Client Share status labels intentionally collapse Review into In progress. If product wants clients to see Review distinctly, the strict public contract needs a new public status value and tests. If not, Review should continue mapping to In progress.

## N. Recommended Target Architecture

Use this architecture:

```text
public.projects / public.tasks as canonical current state
  -> one server-side Client Share projection builder
  -> one strict external projection contract
  -> owner Preview and public Share render the same ClientProjectView
```

Design principles:
- Keep `project_share_links` for lifecycle, access, visibility flags, and publication intent.
- Keep `share_link_tasks` for inclusion, ordering, and explicit client-only presentation metadata that is not canonical work state.
- Stop using `share_link_tasks.public_group` as the source of task completion/progress.
- On each fresh projection read, resolve mapped task ids to canonical task rows including `id`, `task_title`, `status`, `completed_at`, and `is_archived`.
- Derive a safe public task group from canonical status/completion in one shared server function.
- Derive progress from the same resolved canonical task rows.
- Preserve visibility gates and the strict external contract.
- Preserve service-role public server boundary and RLS-bound owner Preview boundary.

Candidate public task derivation:
- `completed_at is not null` or normalized `status = 'done'` -> `completed`
- normalized `status in ('in progress','in-progress','working','review','urgent','in review')` -> `in_progress`, unless explicit feedback flag is true
- normalized `status in ('new','todo','to do')` or null -> `coming_up`
- unknown -> fail closed to `in_progress` or omit, depending product policy; recommended: map unknown non-empty active work to `in_progress` without exposing raw value, with a server-side test.

Project status:
- Option 1: preserve explicit `projects.status` as project-level status, but ensure internal UX updates project status when subtasks advance.
- Option 2: derive public project status from visible canonical subtasks when `statusVisible` is true.
- Recommended: derive Client Share project status from the same visible canonical task set unless an explicitly owner-authored project status is required by product. This better satisfies the incident expectation where mixed subtasks should not show Not started.

## O. Minimal Safe Remediation Path

1. Add failing tests first:
   - Owner Preview resolves mapped tasks with live `tasks.status/completed_at` and returns 2/6 complete for Done, Done, In Progress, Review, New, New even if persisted `public_group` says `coming_up`.
   - Public Share path returns the same projection as Preview for the same fixture.
   - Existing mapped order/inclusion still controls which tasks are shared.
   - Deleted and archived tasks are omitted.
   - Fragment token/session/grant behavior remains unchanged.

2. Application code change:
   - Extend `TaskRow` in `client-share-projection.server.ts` to include `status`, `completed_at`, and `is_archived`.
   - Extend both owner and public task queries to select those fields.
   - Add one shared function to map canonical task state to `ClientProjectTask.publicGroup`.
   - Update `assembleClientProjection()` to use derived group for task state/progress, while retaining `waitingForClientFeedback`.
   - Decide whether `share_link_tasks.public_group` remains as an owner override or becomes ignored/deprecated for task state.

3. Optional DB follow-up:
   - If the column is no longer semantically authoritative, document/deprecate `share_link_tasks.public_group`.
   - A migration is not required just to read extra columns from `tasks`.
   - A migration is required only if the schema contract changes, the RPC shape changes, a new view/RPC is introduced, or columns/constraints/comments are updated.

4. Manual production data remediation should not be needed if projection derives from canonical tasks at read time.

## P. Database/Migration Implications

Application-code-only path is plausible:
- Both Preview and public projection already read canonical `public.tasks`.
- Adding `status`, `completed_at`, and `is_archived` to bounded selects is an application read change.
- No new direct anonymous DB privilege is needed.
- No backfill is needed if persisted `public_group` is ignored for live state.

Possible migration path if preferred:
- Add or replace a tightly scoped RPC/view for Client Share projection task rows that joins `share_link_tasks` to `tasks` and returns only allowed fields.
- Update comments on `share_link_tasks.public_group` to clarify whether it is deprecated or only an optional owner presentation override.
- Add tests for grants/RLS/no anon table grants if a migration touches DB functions or privileges.

Production workflow requirement for any DB change:
isolated staging Supabase -> exact migration tested -> approved migration workflow -> Production -> schema verification -> `supabase_migrations.schema_migrations` verification -> `supabase migration list` Local/Remote alignment -> application deployment.

## Q. Required Tests

Unit:
- canonical internal status -> public task group mapping
- `completed_at` counts complete even if status was reopened, or decide product semantics explicitly
- Review/In Review/Urgent/Completed/unknown/null handling
- archived/deleted mapped tasks omitted
- progress numerator/denominator for mixed states and zero tasks

Projection integration-style unit tests:
- `buildClientShareProjection` reads and uses canonical task state
- `buildPublicClientShareProjection` reads and uses canonical task state
- Preview and public fixtures produce identical `ClientProjectProjection`
- persisted `public_group` no longer overrides canonical completion unless the chosen product design explicitly keeps an override

API route tests:
- `/api/share-links/[id]/preview` still no-store/authenticated/no secret
- `/api/share/[publicId]/projection` still no-store/generic-denial/rate-limited and uses verified authorization

Component tests:
- `ClientProjectView` renders 2 of 6 complete and grouped tasks correctly from the projection
- Quick-share panel progress preview behavior adjusted to match live projection requirement

Database/RLS tests if migration is introduced:
- no new `anon` table privileges
- RLS enabled on all share tables
- service-role-only public mediation preserved
- RPCs, if added, have safe `search_path`, no dynamic SQL, and no secret leakage

E2E/regression:
- Create project with 6 subtasks, share, then update statuses to Done, Done, In Progress, Review, New, New.
- Fresh owner Preview shows 2/6 complete.
- Fresh public Share reload shows 2/6 complete.
- Rename task reflects after refresh.
- Soft-delete/archive task is removed from share projection.
- Revoked/expired/different-tenant links fail closed.

## R. Staging -> Production Rollout Plan

1. Implement tests and application fix locally.
2. Run focused Client Share tests, task status tests, and affected API route tests.
3. If no migration is needed, deploy application only after staging verification.
4. If a migration is needed, follow the canonical staging-first migration workflow.
5. Verify in staging:
   - owner Preview fresh read after task mutation
   - public Share fresh read after task mutation
   - security failures unchanged
   - no secrets or internal ids in projection JSON
6. Production rollout:
   - deploy after staging pass
   - run old incident smoke test: Greenfield-style 6 task mix should show 2/6
   - confirm no Supabase migration history drift if DB changes were part of rollout
7. Monitor safe server logs for projection authorization errors only; do not log task content or tokens.

## S. Uncertainties Requiring Additional Evidence

No Production database was queried. These remain unverified:
- Whether the owner previously customized/hid any task mappings for this link beyond the confirmed all-`coming_up` mapping.
- Whether archived subtasks exist in the incident project and are currently exposed.
- Whether `Completed` or `In Review` exist in historical Production rows despite not being current Task CRM select options.

Production evidence now verifies:
- `projects.status = New` for `Greenfield Studio Website Launch`.
- Canonical task statuses are Done, Done, In Progress, Review, Not Started, Not Started.
- Two canonical tasks have `completed_at` set.
- All six share task mappings have `share_link_tasks.public_group = coming_up`.
- There is exactly one share link and one currently active share link.
- Share-derived progress is 0/6 while canonical progress is 2/6.

## T. Production Evidence Addendum

User-supplied Production evidence confirms the incident exactly:

| Task | Canonical status | Canonical `completed_at` | Share `public_group` | Drift |
| --- | --- | --- | --- | --- |
| Review the final homepage design | Done | present | coming_up | yes |
| Update the pricing section with the approved plans | Done | present | coming_up | yes |
| Check all contact and signup forms | In Progress | null | coming_up | yes |
| Test the website on mobile and desktop | Review | null | coming_up | yes |
| Send the final version to the client for approval | Not Started | null | coming_up | no completion drift, but confirms legacy status vocabulary |
| Publish the website and confirm everything is working | Not Started | null | coming_up | no completion drift, but confirms legacy status vocabulary |

Project-level Production evidence:
- `projects.status = New`.
- Canonical completed task count: 2.
- Canonical eligible task count: 6.
- Canonical progress: 33 percent.
- Share-derived completed task count from `share_link_tasks.public_group`: 0.
- Share-derived total task count: 6.
- Share-derived progress: 0 percent.
- One active link only; no multiple-active-link ambiguity.

Conclusion: P0 root cause is confirmed in Production. The stale state is not a route cache or multiple-link conflict. It is persisted share presentation state being used as authoritative task workflow/completion state.

## U. Status Vocabulary Audit Addendum

Schema:
- `public.projects.status` is plain `text`, default `New`, no active migration check constraint found.
- `public.tasks.status` is plain `text`, default `New`, no active migration check constraint found.
- Because status is unconstrained text, Production can contain values not present in current selects or route enums.

Current UI/API values:
- `app/components/dashboard/tasks/project-meta-editor.tsx`, `desktop-tasks-table.tsx`, and `mobile-task-card.tsx` expose project/task choices `New`, `In Progress`, `Review`, `Urgent`, `Done`.
- `app/api/tasks/bulk-status/route.ts` validates bulk updates to `New`, `In Progress`, `Review`, `Urgent`, `Done`.
- `app/api/project-updates/apply/route.ts` normalizes project-update status changes to `New`, `In Progress`, `Review`, `Urgent`, `Done`.

Legacy/import values:
- `app/components/dashboard/dashboard-helpers.ts` maps legacy `Not Started` to `New` in `normalizeTaskFromApi`; the paired test explicitly verifies this.
- `app/components/dashboard/extract-workspace.tsx` and extraction tests still reference `Not Started`.
- `lib/preview/hybrid-preview.ts` defaults preview status to `Not Started`.
- `lib/projects/import-persistence.server.ts` can persist `pickFirstString(projectBody.status)` and `pickFirstString(subtask.status)` without converting `Not Started` to `New`.
- `app/api/tasks/route.ts` can persist provided project/subtask status text during project creation and only treats lowercase `done` as completed.

Completion aliases:
- `lib/project-updates/project-update-post-process.server.ts` maps `done`, `complete`, and `completed` to canonical `Done` for project-update analysis.
- Other internal completion predicates generally check normalized status `done` plus `completed_at`.

Required future Client Share task status normalizer:

| Raw value | Classification | Public workflow group | Complete |
| --- | --- | --- | --- |
| null/blank | not started/unknown empty | coming_up | false unless `completed_at` present |
| `Not Started` | legacy Production-present not-started | coming_up | false unless `completed_at` present |
| `New` | current not-started | coming_up | false unless `completed_at` present |
| `In Progress` | current active | in_progress | false unless `completed_at` present |
| `Review` | current active/review | in_progress | false unless `completed_at` present |
| `In Review` | legacy/possible alias | in_progress | false unless `completed_at` present |
| `Urgent` | current active, never expose raw urgency publicly | in_progress | false unless `completed_at` present |
| `Done` | current complete | completed | true |
| `Completed` | legacy/alias complete | completed | true |
| `Complete` | legacy/alias complete | completed | true |
| unknown non-empty | fail closed as active work without exposing raw value | in_progress | false unless `completed_at` present |

`completed_at` must be part of the canonical completion predicate because internal Task CRM already treats it as a lifetime completion signal.

## V. Exact Implementation Plan

No implementation has been performed. This section is the minimal long-term remediation plan.

### 1. `lib/share/client-share-task-state.ts`

New pure module.

Functions:
- `normalizeClientShareTaskWorkflowStatus(status: string | null | undefined)`
- `isClientShareTaskComplete(input: { status: string | null; completedAt: string | null })`
- `deriveClientShareTaskPublicGroup(input: { status: string | null; completedAt: string | null; waitingForClientFeedback: boolean })`
- `calculateClientShareProgress(tasks: readonly Array<{ canonicalComplete: boolean }>)`

Current behavior: no single canonical Client Share task-state module exists.

New behavior:
- Centralize all task workflow normalization for Client Share.
- Treat `Not Started` and `New` as not-started.
- Treat `Done`, `Completed`, and `Complete` as complete.
- Treat `completed_at` as complete even if status has drifted, matching internal lifetime completion semantics.
- Map active/review/urgent/unknown non-empty statuses to a safe public active group without exposing raw internal status.
- Compute progress from canonical completion, not `share_link_tasks.public_group`.

Why necessary: prevents another incomplete status mapper and gives Preview/Public/quick-share one source for status/completion/progress behavior.

Security impact: pure server/client-testable helper with no DB access and no secret handling. It must never expose raw status labels beyond the strict public group vocabulary.

Test impact: add `lib/share/client-share-task-state.test.ts` covering Not Started, New, In Progress, Review, In Review, Urgent, Done, Completed, Complete, null/blank, unknown, `completed_at`, Done -> reopened semantics, and progress math.

### 2. `lib/share/client-share-projection.server.ts`

Functions/types:
- `TaskRow`
- `TaskMappingRow`
- `assembleClientProjection`
- `buildClientShareProjection`
- `buildPublicClientShareProjection`
- `mapProjectStatusForClient`

Current behavior:
- Task queries select only `id, task_title`.
- `assembleClientProjection` copies `mapped.publicGroup` into `ClientProjectTask.publicGroup`.
- Progress counts projected tasks where `publicGroup === "completed"`.
- Public path reads `share_link_tasks` without `display_order` and relies on returned row order.
- Project status mapping handles only `New`, `In Progress`, `Review`, `Done`.

New behavior:
- Extend task row shape and bounded selects to `id, task_title, status, completed_at, is_archived, subtask_order`.
- Filter out mapped tasks that are deleted or archived. Deleted is already filtered by `.is("deleted_at", null)`; archived must be added through `is_archived`.
- Preserve share mapping for inclusion and order, but derive task public group from canonical task state and `waiting_for_client_feedback`.
- Compute progress using `calculateClientShareProgress` from canonical completion.
- Include `display_order` in public `share_link_tasks` select and sort deterministically by `display_order`, then `subtask_id`, matching owner management RPC behavior.
- Update project status mapping to reuse a project-safe normalizer without deriving or mutating `projects.status`: `Not Started`/`New -> not_started`; `In Progress`/`Review`/`In Review`/`Urgent -> in_progress`; `Done`/`Completed`/`Complete -> completed`; unknown/null -> null.

Why necessary: this is the shared reader used by both owner Preview and public Share. Fixing it makes existing active links correct after deploy without requiring users to regenerate links.

Security impact:
- No new browser-visible internal fields are added to the projection contract.
- Extra canonical task fields are read only on the server, scoped by owner/user/project/link/mapped ids.
- No direct `anon` table access or RLS weakening.
- Public path continues to use the existing service-role-mediated authorization gate.

Test impact:
- Replace stale tests in `lib/share/client-share-projection.server.test.ts` that assert progress comes only from mapped public groups.
- Add Preview/Public parity cases proving stale `public_group = coming_up` plus canonical Done/Done/In Progress/Review/Not Started/Not Started returns 2/6.
- Add archived task omission and deterministic public ordering tests.

### 3. `lib/share/client-share-projection-contracts.ts`

Current behavior: external task contract has `title`, `publicGroup`, `waitingForClientFeedback`; progress has `completed`, `total`, `percent`.

New behavior: no contract shape change required for the minimal fix. The meaning of `publicGroup` becomes a fresh derived display group, not persisted share workflow state.

Why necessary: keeping the contract stable makes the fix backward compatible for current UI and active public links.

Security impact: no new public fields.

Test impact: update comments/tests if they currently state progress is from mapped share tasks only.

### 4. `app/components/dashboard/tasks/share-link/quick-share-defaults.ts`

Functions:
- `suggestAutomaticPublicGroup`
- `buildAutomaticTaskItems`
- `buildQuickShareTaskProgress`
- `percentComplete`
- `buildQuickShareTaskItems`

Current behavior:
- First-share automatic grouping derives from current subtask status.
- Once any persisted mapping exists, quick-share progress reflects the persisted mapping and `buildQuickShareTaskItems` returns `undefined`.

New behavior:
- Reuse the canonical Client Share task-state helper for automatic first-share grouping.
- Change quick-share progress preview to count the current eligible canonical subtasks, not stale `mappedTasks.publicGroup`, while still preserving mapped task inclusion/order where the UI needs it.
- Keep `buildQuickShareTaskItems` compatibility behavior for initial remediation if preserving owner-hidden tasks requires not resending task mappings. The authoritative read path will no longer depend on persisted `public_group`.

Why necessary: owner-facing share panel should not continue showing stale 0/6 after the projection fix.

Security impact: no server access, no secret handling.

Test impact: replace tests that assert persisted mapping progress wins with tests that assert canonical task status/completion wins.

### 5. `app/components/dashboard/tasks/share-link/share-link-configuration-editor.tsx`

Function:
- `suggestPublicGroup`
- initial task draft construction

Current behavior: editor exposes `publicGroup` as owner-curated presentation, with `New` defaulting to `in_progress` for new selection while quick-share defaults `New` to `coming_up`.

New behavior for minimal fix:
- Do not remove the field yet.
- Align default suggestions with the canonical helper where new mappings are created.
- Treat persisted `publicGroup` as compatibility/presentation metadata, not authoritative workflow state.
- Consider copy/UX follow-up to clarify that workflow status comes from Task CRM.

Why necessary: avoids creating new stale defaults while keeping old links editable.

Security impact: none.

Test impact: update editor tests for aligned default suggestions and compatibility preservation.

### 6. `app/components/dashboard/tasks/share-link/client-project-view.tsx`

Component:
- `ClientProjectView`

Current behavior: renders only the strict projection it receives.

New behavior: likely no product-code change needed for the minimal fix if projection shape remains stable. If a future explicit public workflow label is added, update here only after contract change.

Why necessary: Preview/Public should remain shared presentation over the same contract.

Security impact: no additional data in scope.

Test impact: existing component tests should still pass, with added mixed-state projection fixture if useful.

### 7. API routes

Files:
- `app/api/share-links/[id]/preview/route.ts`
- `app/api/share/[publicId]/projection/route.ts`

Current behavior: both call the projection service and return no-store responses.

New behavior: no route shape change expected. They inherit the fixed projection.

Why necessary: keeping route behavior stable minimizes rollout risk.

Security impact: no-store and authorization behavior must remain unchanged.

Test impact: rerun and preserve route security/no-store tests.

### 8. Database/RPC/migrations

Current behavior:
- `share_link_tasks.public_group` persists owner-curated public group.
- `save_share_configuration` allows null `p_tasks` to leave mapping unchanged.

New behavior:
- No DB migration required for the minimal remediation.
- Do not remove, rename, or backfill `share_link_tasks.public_group`.
- Retain it for compatibility with existing links, editor payloads, and historical meaning.
- Treat it as non-authoritative for canonical workflow state in application projection.
- Later migration may update comments or add a dedicated noncanonical presentation field if product wants a manual display override.

Why necessary: existing active links become correct automatically after app deployment because projection reads current canonical tasks.

Security impact: no privilege change, no schema change, no production data mutation.

Test impact: no migration tests required for the application-only fix. If a future migration is introduced, follow canonical staging-first governance.

## W. Sync Contract for Implementation

After any successful canonical task mutation and a fresh read, Internal Task CRM, Client Preview, and Public Client Share must agree on task title, task existence, order, workflow-derived display group, completion, and progress.

Expected cases:
- `Not Started -> In Progress`: internal shows In Progress; Preview/Public move from `coming_up` to `in_progress`.
- `New -> In Progress`: same as above if `New` is present.
- `In Progress -> Review`: internal shows Review; Preview/Public remain public `in_progress` unless a public Review group is explicitly added later.
- `Review -> Done`: internal shows Done; Preview/Public count complete and group completed.
- `Done -> reopened`: if `completed_at` remains set, Client Share still counts complete under current internal lifetime semantics. If product wants reopening to clear completion, that is a separate canonical mutation policy change, not part of this Client Share projection fix.
- `Urgent`: public group `in_progress`; do not expose raw urgency.
- Rename: task title updates on fresh read.
- Add task: if not mapped, it remains hidden unless product chooses automatic inclusion; if mapped, it appears with canonical state.
- Archive task: omitted from Preview/Public.
- Soft delete task: omitted from Preview/Public.
- Reorder: mapped `display_order` remains share order; if no mapping exists, automatic/default order follows canonical subtask order.
- Mixed statuses: progress uses canonical completion count over eligible projected tasks.
- All complete: progress 100 percent.
- None complete: progress 0 percent if tasks exist, null only if no projected tasks resolve.
- `waiting_for_client_feedback`: noncomplete tasks with the flag display in `waiting_for_feedback`; completion still comes from canonical task state. Completed tasks remain completed even if the flag is stale.

## X. Test Plan for Remediation

New tests:
- `lib/share/client-share-task-state.test.ts`
  - status normalizer for `Not Started`, `New`, `In Progress`, `Review`, `In Review`, `Urgent`, `Done`, `Completed`, `Complete`, blank/null, unknown.
  - completion predicate for status and `completed_at`.
  - progress calculation for 0, none complete, mixed, all complete.
  - `waiting_for_client_feedback` overlay behavior.

Update tests:
- `lib/share/client-share-projection.server.test.ts`
  - replace "progress only from mapped/shared tasks" expectations with canonical status/completion expectations.
  - add Production incident fixture: stale all-`coming_up` mappings plus canonical Done, Done, In Progress, Review, Not Started, Not Started returns 2/6 and 33 percent.
  - add owner Preview and public projection parity for same fixture.
  - add archived/deleted filtering.
  - add deterministic public `display_order` sorting.
  - add project status alias mapping without deriving from tasks.
- `app/components/dashboard/tasks/share-link/quick-share-defaults.test.ts`
  - replace persisted mapping progress-wins test.
  - prove quick-share progress preview uses canonical subtasks.
  - prove first-share default grouping uses same normalizer.
- `app/components/dashboard/tasks/share-link/share-link-quick-share.test.tsx`
  - owner panel progress reflects canonical task statuses when mapping is stale.
- `app/components/dashboard/tasks/share-link/share-link-configuration-editor.test.tsx`
  - defaults align with canonical helper and existing persisted mapping remains editable.
- `app/api/share-links/[id]/preview/route.test.ts`
  - route remains authenticated, no-store, no secret, and reflects updated projection.
- `app/api/share/[publicId]/projection/route.test.ts`
  - route remains no-store, generic denial, rate-limited, session/grant-authorized, and reflects updated projection.
- Existing authorization/security regression tests:
  - `app/api/share/session/route.test.ts`
  - `app/api/share/[publicId]/pin/route.test.ts`
  - `app/api/share/[publicId]/resources/[fileRef]/route.test.ts`
  - `lib/share/share-session-grant.server.test.ts`
  - `lib/share/share-contracts.test.ts`

Old tests to replace:
- Any `client-share-projection.server.test.ts` test that asserts progress is computed from persisted `mappedTasks.publicGroup` rather than canonical `tasks.status/completed_at`.
- Any `quick-share-defaults.test.ts` test that asserts persisted mapping progress is never recomputed from current subtask status.

Focused commands for implementation phase:
- `npm.cmd test -- lib/share/client-share-task-state.test.ts`
- `npm.cmd test -- lib/share/client-share-projection.server.test.ts`
- `npm.cmd test -- app/components/dashboard/tasks/share-link/quick-share-defaults.test.ts`
- `npm.cmd test -- app/components/dashboard/tasks/share-link/share-link-quick-share.test.tsx`
- `npm.cmd test -- app/components/dashboard/tasks/share-link/share-link-configuration-editor.test.tsx`
- `npm.cmd test -- app/api/share-links/[id]/preview/route.test.ts`
- `npm.cmd test -- app/api/share/[publicId]/projection/route.test.ts`
- `npm.cmd test -- app/api/share/session/route.test.ts app/api/share/[publicId]/pin/route.test.ts app/api/share/[publicId]/resources/[fileRef]/route.test.ts lib/share/share-session-grant.server.test.ts`
- `git diff --check`

## Y. Rollout Plan for Remediation

Application-only path:
1. Implement pure status/completion/progress helper.
2. Update projection service to read canonical task state and derive task groups/progress.
3. Update quick-share/editor defaults to reuse the helper.
4. Run focused test suite above.
5. Run typecheck/lint/build only as appropriate for the project release gate.
6. Deploy to staging/preview environment.
7. Manual staging sync matrix:
   - Not Started/New -> In Progress.
   - In Progress -> Review.
   - Review -> Done.
   - Done -> reopened.
   - Urgent.
   - rename.
   - add mapped task.
   - archive.
   - soft delete.
   - reorder.
   - mixed, all complete, none complete.
   - waiting-for-feedback independent of workflow status.
8. Production deploy after staging pass.
9. Production smoke test `Greenfield Studio Website Launch`:
   - confirm Preview shows 2/6 and two completed tasks.
   - confirm public Share fresh read shows 2/6 and two completed tasks.
   - confirm project status remains `Not started` while `projects.status = New`, unless the owner changes project status.
10. Mutate one safe test task if approved, verify fresh-read sync in Preview/Public, then restore state if needed using the normal app UI.
11. Capture final verification.

If DB changes become necessary:
- Stop before creating a migration.
- Propose the exact migration and tests.
- Follow canonical staging-first migration governance before Production.

## Synchronization Matrix for Future Implementation

| Change | Internal UI expected | Client Preview expected | Public Share expected |
| --- | --- | --- | --- |
| New -> In Progress | subtask shows In Progress | fresh read shows task in public in-progress group | fresh read shows same |
| In Progress -> Review | subtask shows Review | fresh read maps safely, likely In progress unless public Review is added | same as Preview |
| Review -> Done | subtask shows Done, progress increments | fresh read counts completed | same as Preview |
| Done -> reopened | subtask status changes; `completed_at` lifetime policy must be decided | follow explicit canonical completion rule | same as Preview |
| Rename task | title updates | fresh read shows new title | same |
| Add task | task appears internally | appears only if share inclusion policy includes new tasks automatically; otherwise hidden until mapped | same |
| Delete/soft-delete task | removed/hidden internally | omitted from projection | omitted |
| Archive task | hidden in active CRM | should be omitted from projection | omitted |
| Reorder task | internal order changes | if share mapping stores custom order, preserve mapping; otherwise derive canonical order | same |
| Project rename | project title updates | fresh read shows new title if visible | same |
| Project status change | project status updates | fresh read maps public status if visible | same |
| 0 tasks | no progress | progress null | progress null |
| 1 task | 0/1 or 1/1 | same from canonical state | same |
| all tasks complete | full completion | completed = total, status completed if derived | same |
| mixed Done/In Progress/Review/New | mixed progress | correct numerator and public groups from canonical state | same |
| expired share link | internal unaffected | owner Preview available only for owner route if non-revoked | public unavailable |
| revoked share link | internal unaffected | owner routes reject revoked current link | public unavailable |
| multiple share links for project | internal unaffected | deterministic owner-selected/managed link behavior | public link isolated by its own id/grant |
| different project same workspace | isolated by project/link ids | cannot bleed across project id | cannot bleed across grant/link/project/user triple |
| different tenant | RLS/auth.uid boundary | owner route scoped to user id | public service-role reads scoped to verified user id/project id/link id |

## Final Audit Notes

Initial `git status --short`: clean output, with Git warning about inaccessible user-level ignore file.

`git diff --check` before artifact creation: pass.

DOCX artifact was not created because `python.exe` failed to run and `py` was unavailable, so `python-docx` availability could not be confirmed without installing packages. Per instructions, no package install was attempted.

## Z. Implementation Closeout - 2026-09-08

Status: application remediation implemented locally. Production verification is not marked complete.

No Supabase project was queried or modified by Codex during implementation. No SQL migration was created. No schema change was required.

Changed files:
- `lib/tasks/canonical-task-status.ts`
- `lib/tasks/canonical-task-status.test.ts`
- `lib/share/client-share-task-state.ts`
- `lib/share/client-share-task-state.test.ts`
- `lib/share/client-share-projection-contracts.ts`
- `lib/share/client-share-projection.server.ts`
- `lib/share/client-share-projection.server.test.ts`
- `app/components/dashboard/tasks/task-utils.ts`
- `app/components/dashboard/tasks/share-link/quick-share-defaults.ts`
- `app/components/dashboard/tasks/share-link/quick-share-defaults.test.ts`
- `app/components/dashboard/tasks/share-link/share-link-configuration-editor.tsx`
- `app/components/dashboard/tasks/share-link/share-link-configuration-editor.test.tsx`
- `app/components/dashboard/tasks/share-link/share-link-quick-share.test.tsx`
- `app/components/dashboard/tasks/share-link/client-project-view.tsx`
- `app/components/dashboard/tasks/share-link/client-project-view.test.tsx`
- `app/share/[publicId]/share-view.client.test.tsx`
- `docs/Text2Task_Client_Share_Data_Flow_Audit_and_Architecture.md`

Implemented architecture:
- `lib/tasks/canonical-task-status.ts` now owns the shared canonical Task CRM status normalization and completion predicate used by Task CRM utilities and Client Share.
- `lib/share/client-share-task-state.ts` derives the Client Share workflow label, presentation group, and progress from current canonical task state.
- `lib/share/client-share-projection.server.ts` reads `tasks.status`, `tasks.completed_at`, and `tasks.is_archived` in both owner Preview and public Share projection paths.
- Owner Preview and public Share still use one strict server-built projection contract and do not expose raw project/task rows.
- Existing active share links self-heal on the next fresh read because stale `share_link_tasks.public_group` no longer controls workflow/completion/progress.

Final status contract:
- `Not Started` and `New` normalize to `not_started`.
- `In Progress` normalizes to `in_progress`.
- `Review` and `In Review` normalize to `in_review` for Client Share task workflow.
- `Urgent` normalizes to `urgent` for Client Share task workflow.
- `Done`, `Completed`, and `Complete` normalize to `completed` for Client Share task workflow.
- Unknown task statuses remain incomplete and display as `Status unavailable` in Client Share unless `completed_at` is present. This avoids inventing an `In progress` workflow meaning for future or invalid statuses.

Canonical completion rule:
- A task is complete when its status is semantically done or `completed_at` is present.
- Completion wins over `waiting_for_client_feedback`.

Canonical progress rule:
- Progress is computed from mapped/share-visible tasks that resolve to live, non-archived, non-deleted canonical task rows.
- Numerator is canonical complete count.
- Denominator is resolved eligible shared task count.
- Zero resolved shared tasks returns `null`, not `0/0`.

`public_group` treatment:
- `share_link_tasks.public_group` remains in the DB and API contracts for compatibility, inclusion/order/configuration editing, and historical mappings.
- It is no longer authoritative for Client Share workflow status, completion, or progress.
- Client-visible task section grouping is derived from canonical workflow status plus the explicit waiting-for-feedback overlay, not from `publicGroup`.
- First-share save compatibility still writes one of the existing `public_group` enum values for selected tasks; unknown statuses use the compatibility save value `in_progress`, but that stored value is not used as visible workflow truth.
- Quick-share continues to omit task updates once any persisted mapping exists so owner-hidden tasks are not silently re-shared, but the quick-share progress preview derives counts from current canonical subtask status and `completed_at`.

`waiting_for_client_feedback` treatment:
- Remains valid share-specific metadata.
- Noncomplete waiting tasks may display in the waiting-for-feedback group while retaining canonical workflow status underneath.
- Completed tasks display completed even if the waiting flag is true.

Project status behavior:
- `projects.status` remains separate from task progress and is never mutated or derived by this remediation.
- Client Share safely normalizes project-status aliases for display when the project status visibility flag is enabled.

Completed local verification:
- `npm.cmd test -- lib/tasks/canonical-task-status.test.ts lib/share/client-share-task-state.test.ts lib/share/client-share-projection.server.test.ts app/components/dashboard/tasks/share-link/quick-share-defaults.test.ts app/components/dashboard/tasks/share-link/client-project-view.test.tsx app/components/dashboard/tasks/share-link/share-link-quick-share.test.tsx app/components/dashboard/tasks/share-link/share-link-configuration-editor.test.tsx app/share/[publicId]/share-view.client.test.tsx app/api/share-links/[id]/preview/route.test.ts app/api/share/[publicId]/projection/route.test.ts app/components/dashboard/tasks/share-link/use-share-link.test.ts app/components/dashboard/tasks/share-link/share-link-panel.test.tsx app/components/dashboard/tasks/share-link/share-link-entry-point.test.tsx app/api/share-links/[id]/config/route.test.ts app/api/share/session/route.test.ts app/api/share/[publicId]/pin/route.test.ts app/api/share/[publicId]/resources/[fileRef]/route.test.ts lib/share/share-session-grant.server.test.ts lib/share/share-links-repository.server.test.ts lib/share/share-contracts.test.ts`
  - Result: 20 test files passed, 1221 tests passed.
- `npx.cmd tsc --noEmit`
  - Result: pass.
- `npx.cmd eslint <changed files>`
  - Result: pass.
- `npm.cmd run lint`
  - Result: fails on pre-existing unrelated `react-hooks/set-state-in-effect` error in `app/components/dashboard/tasks/share-link/share-link-channels.tsx`; changed-file lint passes.
- `npm.cmd run build`
  - Result: pass after unsandboxed rerun. The first sandboxed attempt failed only while fetching Google Fonts.

Remaining staging verification:
- Create or use a staging project with tasks: Done, Done, In Progress, Review, Not Started, Not Started.
- Confirm owner Preview shows 2 of 6 complete and distinct Completed, In progress, In review, and Not started labels.
- Confirm public Share shows the same 2 of 6 complete result.
- Change a Not Started task to In Progress, refresh Preview/Public, and confirm both update without regenerating the share link.
- Change In Progress to Review, then Review to Done, then reopen Done, confirming fresh-read synchronization each time.
- Verify `waiting_for_client_feedback` remains independent: a noncomplete waiting task shows feedback treatment, while a completed waiting task remains completed.

## Staging Validation - 2026-09-09

Status: PASS.

Persistent staging environment:
- Vercel Preview now points to the persistent staging Supabase project `text2task-staging` for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- No key values, secret values, credentials, or sensitive material are recorded in this repository.
- Production environment variables were not changed.
- Staging Supabase Authentication URL configuration was corrected operationally: Site URL was changed away from localhost to the Text2Task Vercel Preview branch URL, and a Vercel Preview redirect allow-list wildcard was added for the Text2Task Vercel project.
- Production Supabase configuration was not changed.

Authentication validation:
- A dedicated staging test account was created and successfully authenticated against `text2task-staging`.
- Initial email confirmation reached Supabase successfully.
- The original redirect failed because staging Site URL was still localhost at that time.
- Supabase showed the user as confirmed.
- After correcting staging Auth URL configuration, normal email/password login to the Vercel Preview succeeded.
- The test password and all secret values are intentionally omitted.

Client Share regression fixture:
- Project: `Greenfield Studio Website Launch`.
- Client: `Greenfield Studio`.
- Budget: `1,500 USD`.
- Deadline: September 12, 2026.
- Priority: High.
- Six subtasks:
  1. Review the final homepage design
  2. Update the pricing section with the approved plans
  3. Check all contact and signup forms
  4. Test the website on mobile and desktop
  5. Send the final version to the client for approval
  6. Publish the website and confirm everything is working

Initial state:
- Project status: New.
- All six subtasks: New.
- Internal progress: 0/6.
- Client Share link was created while all tasks were still New.
- Client Share initially displayed 0 of 6 complete.
- This confirms the share mapping/link was persisted before task status mutations.

Canonical task mutations without regenerating the Client Share link:
- Task 1 changed to Done.
- Task 2 changed to Done.
- Task 3 changed to In Progress.
- Task 4 changed to Review.
- Task 5 remained New.
- Task 6 remained New.

Validation after refreshing the same existing Client Share link:
- Progress updated to 2 of 6 complete / 33%.
- Task 1 rendered under Completed.
- Task 2 rendered under Completed.
- Task 3 rendered under In progress.
- Task 4 rendered under In review.
- Tasks 5 and 6 rendered under Coming up / Not started.
- Preview/Public Client Share reflected the live canonical task state.
- No share-link regeneration was required.
- No `public_group` repair/update was required.

Owner-side Share with client panel validation:
- 33% complete.
- 2 completed.
- 2 in progress.
- 2 coming up.

Additional fresh-read validation:
- After the successful 2/6 validation, two additional subtask statuses were changed in Task CRM.
- The same existing Client Share link was refreshed again.
- The shared view updated again to reflect the new canonical state.
- This additional mutation/refresh test also passed.

Project status expectation:
- The project itself remained `projects.status = New`.
- Client Share therefore continued to show the project-level label `Not started`.
- This is expected and is not a synchronization defect.
- The architecture intentionally keeps project status separate from subtask-derived progress.
- Do not derive or mutate `projects.status` automatically from subtask statuses.

Root-cause remediation validation:
- Original Production incident behavior was reproduced and successfully remediated in staging.
- Old behavior: `share_link_tasks.public_group` could remain stale and Client Share could show 0/6 while canonical tasks were already 2/6 complete.
- Validated new behavior: existing Client Share links derive mutable workflow/completion/progress from fresh canonical task data, so later task changes become visible on refresh without rebuilding the share mapping.
- Staging validation result: PASS.

## Production Validation - 2026-09-09

Status: CLIENT SHARE LIVE SYNCHRONIZATION - PRODUCTION VERIFIED / CLOSED.

Production deployment:
- Commit: `43caa055386414e55e7627dff0881fb94357f7bb`.
- Commit message: `Merge Client Share live synchronization`.
- Branch: `main`.
- Vercel environment: Production.
- Vercel status: Ready.
- Deployment was triggered by the normal push to `main`.
- No manual Promote to Production was used.
- No manual redeploy was used for this milestone.
- No Supabase migration was required.
- No Production Supabase schema change was performed.
- No Production environment-variable change was required for the Client Share remediation.

Initial Production owner-side smoke test:
- Existing Production project: `Greenfield Studio Website Launch`.
- Initial canonical Task CRM state observed after deployment:
  1. Review the final homepage design - Done
  2. Update the pricing section with the approved plans - Done
  3. Check all contact and signup forms - In Progress
  4. Test the website on mobile and desktop - Review
  5. Send the final version to the client for approval - New
  6. Publish the website and confirm everything is working - New
- Internal Task CRM progress: 2 of 6 done.
- Project-level status at that point: New.
- The owner-side Share with client panel was opened without creating a new update first.
- It correctly displayed 33% complete, 2 completed, 2 in progress, and 2 coming up.
- This verified that the Production owner-side Client Share projection was deriving current task workflow/progress from canonical task state rather than stale `share_link_tasks.public_group` state.
- Initial owner-side Production smoke: PASS.

Initial Production public-share projection check:
- A Production public Client Share page was opened after deployment.
- The public page correctly displayed progress: 2 of 6 complete.
- Task grouping:
  - In review: Test the website on mobile and desktop.
  - In progress: Check all contact and signup forms.
  - Completed: Review the final homepage design; Update the pricing section with the approved plans.
  - Coming up: Send the final version to the client for approval; Publish the website and confirm everything is working.
- The two coming-up tasks displayed Not started.
- This matched the canonical Production Task CRM state.
- Initial public-share Production smoke: PASS.

Accuracy note:
- The older public Client Share URL from before deployment was not available for this Production smoke test.
- Production did not directly demonstrate recovery of that exact pre-deployment URL.
- The Production public-link test used a link opened/created after deployment.
- Staging had already validated same-link behavior across later canonical task mutations.

Final live-mutation Production test:
- Further canonical task-state changes were made manually in Production as part of the controlled smoke test.
- Final observed Task CRM state:
  - Project status: In Progress.
  - Progress: 4 of 6 done.
  - Review the final homepage design - Done.
  - Update the pricing section with the approved plans - Done.
  - Check all contact and signup forms - Done.
  - Test the website on mobile and desktop - Done.
  - Send the final version to the client for approval - Review.
  - Publish the website and confirm everything is working - New.
- The same already-open public Client Share link was observed again.
- No new Client Share link was generated.
- Share update was not clicked.
- No manual browser refresh was required.
- After several seconds, the already-open public Client Share UI updated automatically.
- The public view then displayed project label In progress and progress 4 of 6 complete.
- Updated task grouping:
  - In review: Send the final version to the client for approval.
  - Completed: Review the final homepage design; Update the pricing section with the approved plans; Check all contact and signup forms; Test the website on mobile and desktop.
  - Coming up: Publish the website and confirm everything is working.
- The remaining coming-up task displayed Not started.
- This proves in Production that later canonical task mutations propagate to an already-existing Client Share view without rebuilding the share mapping and without requiring a new link.
- The visible UI refreshed/revalidated automatically within several seconds. No specific polling, refetch, or realtime implementation mechanism is asserted here.
- Same-link later-mutation Production test: PASS.
- Automatic no-manual-refresh behavior: PASS.

Final root-cause remediation conclusion:
- Original Production defect: canonical tasks had progressed to 2/6 complete, persisted `share_link_tasks.public_group` remained stale, Client Share treated that duplicated presentation state as authoritative, and shared progress could therefore remain 0/6.
- Implemented architecture: canonical projects/tasks -> single server-side Client Share projection -> strict external Client Share contract -> Owner Preview / Public Share rendering.
- Authoritative mutable task state now comes from `tasks.status`, `tasks.completed_at`, and task archive/delete eligibility.
- `share_link_tasks.public_group` remains compatibility/configuration/history data only.
- `share_link_tasks.public_group` is not authoritative for workflow status, completion, progress, or public task grouping.
- `waiting_for_client_feedback` remains separate share-specific metadata.
- Project status remains independent from subtask-derived progress.

Final milestone status:
- STAGING VALIDATION: PASS.
- PRODUCTION DEPLOYMENT: PASS.
- OWNER SHARE PROJECTION: PASS.
- PUBLIC SHARE PROJECTION: PASS.
- POST-SHARE TASK MUTATION SYNC: PASS.
- AUTOMATIC OPEN-VIEW UPDATE: PASS.
- SECURITY REGRESSION: PASS.
- DB MIGRATION REQUIRED: NO.

Known unrelated repository-wide test baseline issue:
- Repository-wide `npm.cmd test` currently has a known pre-existing P2 maintenance defect.
- Last observed full-suite result: 24 failed / 194 passed test files; 4 failed / 4283 passed tests.
- Cause: historical migration-package tests retained after the canonical migration archival still reference obsolete historical SQL locations.
- This defect exists on `origin/main` independently of Client Share.
- Client Share commits did not modify the failing migration tests or migration SQL.
- Canonical migration baseline validation passes.
- Archive manifest validates 57/57 historical SQL files.
- No current canonical migration-integrity defect was found.
- This must be repaired as a separate milestone.
