# Text2Task Client Share Link — Phase 6 Supplemental Mapping & Design Validation

**Date:** 2026-08-21
**Type:** Read-only architecture audit / design validation (no code, no migration, no SQL executed)
**Checkpoint:** `main @ 8142245` — "Complete Client Share Phase 5 communication lifecycle" — working tree clean, `main...origin/main [ahead 14]`, Phase 0-5 COMPLETE/PASS, Production rollout NOT authorized.

This report resolves the 10 open design questions raised after the initial Phase 6 mapping report. It supersedes that report's design for analyze-time timeline isolation, analyze-time idempotency, the server-trusted input path, the apply/conversion transaction boundary, and the "converted is terminal" guarantee. Nothing in this document has been implemented — every recommendation below is a proposal for a future, separately-approved implementation slice.

---

## 1. Client-Share Analyze must not write the professional Timeline

### Exact code path

`analyzeProjectUpdateV2` (`lib/project-updates/v2/project-update-v2-analyzer.server.ts:59-178`) unconditionally calls `createProjectTimelineEvent` (`lib/project-updates/project-update-audit.server.ts:238-291`) at lines 147-166, immediately after persisting the `project_updates` row and its suggested `project_update_items` — **before any owner review or apply confirmation**. This happens on every successful analysis today, for both `"text"` and `"image"` sources.

```ts
// project-update-v2-analyzer.server.ts:147-166
const timelineResult = await createProjectTimelineEvent({
  projectId: contextResult.context.project.id,
  eventType: "ai_update_analyzed",
  eventTitle: sourceType === "image" ? "Screenshot update analyzed" : "Client update analyzed",
  eventSummary: timelineSummary,
  sourceUpdateId: updateResult.data.id,
  metadata: { engine: "project-update-v2", sourceType, ... },
});
```

**Finding: the stated invariant ("analysis-initiation never touches the professional timeline") is false for the *existing* text/image flow, and would be false for `client_share` too if reused unmodified.** This is not a new risk Phase 6 introduces — it is a pre-existing property of the shared analyzer that Phase 6 must explicitly account for, because the product rule for Client Share is stricter than the rule that has quietly applied to text/image updates until now.

### Smallest backward-compatible change

Add one conditional around the existing call, keyed on `sourceType`:

```ts
// project-update-v2-analyzer.server.ts, replacing lines 147-166
const timelineResult =
  sourceType === "client_share"
    ? { ok: true as const, data: null }
    : await createProjectTimelineEvent({ ...same as today... });
```

This is a **single `if`/ternary around one existing call site**, in one existing file. Nothing about the analyzer's AI extraction, judging, `project_updates`/`project_update_items` persistence, or response shape changes. `sourceType === "image" | "text"` callers are byte-for-byte unaffected — the new branch is only reachable once a `"client_share"` value exists at all (see §3), which today it does not (the route-level Zod schema still only accepts the values already in `ProjectUpdateSourceTypeSchema`).

### Tests required

- Existing text/image analyze tests continue to assert a timeline event **is** created — must still pass unmodified (regression).
- New: `sourceType: "client_share"` analyze call creates a `project_updates` row and `project_update_items`, and asserts `createProjectTimelineEvent` is **never called** (mock assertion) and the response's `timelineEvent` field is `null`.
- New: the eventual Apply step (§4) for a `client_share`-sourced update still creates its normal `project_timeline_events` rows exactly as today — i.e., timeline events appear starting at Apply, not before.

### Other analyze-time side effects checked

- `createProjectUpdateAuditRecord` and `createProjectUpdateAuditItems` (`project-update-audit.server.ts:124-236`) write only `project_updates`/`project_update_items` — no other table, no notification, no analytics event (confirmed in the original report, §A.5: the only analytics event is `client_update_opened`, fired on **modal open**, not on analyze). No other side effect violates the boundary.

---

## 2. Durable analyze-time idempotency

### Audit of `project_updates` for reusable provenance/idempotency fields

Full column list (`supabase/migrations/202605250001_project_update_engine.sql:25-53`): `id, user_id, project_id, client_id, source_type, raw_input, ai_summary jsonb, status, created_by, reviewed_by, applied_by, created_at, analyzed_at, reviewed_at, applied_at, ignored_at`, plus `apply_attempt_id`/`apply_failed_at`/`apply_error_code` added by a later migration (referenced by the apply RPC).

**No existing field solves this.** `ai_summary jsonb` stores AI *output*, not a source key, and a JSON field cannot carry a DB-enforced uniqueness guarantee. There is no external-id, metadata, or nullable-source-entity column of any kind. The repository's own words in the Phase 1A migration comment already anticipated exactly this gap ("Phase 6 will need its own new grant/RPC when it actually arrives") but did not anticipate the analyze-idempotency problem specifically — that gap is real and new to this audit.

### Recommended minimal design (confirmed the smallest durable option)

```sql
alter table public.project_updates
  add column source_share_message_id uuid null
    references public.share_messages(id) on delete set null;

create unique index project_updates_source_share_message_id_key
  on public.project_updates (source_share_message_id)
  where source_share_message_id is not null;
```

- **Delete behavior**: `on delete set null`, matching `share_message_conversions.project_update_id`'s own existing `on delete set null` exactly (§B of the prior report) — if a share message were ever hard-deleted (it never is today; only link-level cascade on a hard-deleted `project_share_links` row, which nothing in this codebase currently does), the `project_updates` row survives, just loses its provenance pointer. No circular-FK risk: `share_messages` has no FK back to `project_updates` (only `share_message_conversions` does, and that table's own FK is separately `on delete set null`), so this is a simple one-directional reference, not a cycle.
- **Owner/project integrity**: enforced the same way every other Client Share integrity check in this codebase is enforced — either as a small addition to a `before insert or update` trigger on `project_updates` (if one exists; the current migration does not show one) or, more consistently with this repo's pattern, inside the RPC/route that sets the value (verify `share_messages.user_id = auth.uid()` and `share_messages.project_id = p_project_id` before insert, exactly like `enforce_share_message_conversion_integrity` already does for `share_message_conversions.project_update_id`/`target_task_id`).
- **Normal Client Updates unaffected when NULL**: the partial unique index (`where source_share_message_id is not null`) means every existing text/image `project_updates` row (where this column is always `NULL`) is completely untouched — `NULL <> NULL` in a partial unique index simply means unlimited `NULL` rows are allowed, so zero behavior change for any existing caller.

### Partial-failure window discovered during this audit (not previously flagged)

`analyzeProjectUpdateV2` is three sequential, non-transactional Supabase calls: insert `project_updates` → insert `project_update_items` → insert timeline event. If the second call fails, the function returns an error **but the `project_updates` row from the first call is never rolled back or cleaned up** — this is a genuine, pre-existing gap in the shared analyzer, not introduced by Phase 6, but Phase 6's uniqueness constraint makes it newly load-bearing: a naive "insert on every analyze attempt" design would let one failed attempt permanently occupy the unique `source_share_message_id` slot for that message, making every subsequent retry fail with a unique-constraint violation.

Confirmed every legitimate, fully-completed analysis has **at least one** `project_update_items` row: `ProjectUpdateItemType` includes a `"no_action"` value (`lib/project-updates/project-update-types.ts:23`) specifically so a "nothing to change" analysis still produces an auditable item. So **zero associated items is a reliable signal of an incomplete/partial-failure attempt**, not a legitimate empty result.

### Recommended concurrency/retry/resume model — "one slot per message, update-in-place until applied"

Rather than a blind `insert`, the new server-trusted entry point (§3) should do a **find-or-create**, keyed on `source_share_message_id`:

1. `select * from project_updates where source_share_message_id = :messageId and user_id = auth.uid()`.
2. **Found, `status in ('applied')`** → already converted; return the existing record as "already converted" (idempotent success, not an error) — matches share_messages.status already being `'converted'` at that point (§5).
3. **Found, `status in ('analyzed','reviewed')` and has ≥1 item** → a genuine in-progress analysis exists; **resume it** (return the existing record so the UI reopens the existing review, rather than analyzing again). This directly satisfies "how a retry should find/reopen the existing analyzed update."
4. **Found, has 0 items (partial-failure signature from above), or `status in ('ignored','failed')`** → safe to **re-run analysis and overwrite this same row in place** (update, not insert) — since nothing has been applied yet, nothing in the professional system has been touched, so re-analyzing is exactly as safe as the first attempt. This answers "whether abandoned analysis can safely be resumed" (yes, by definition nothing durable happened) and "whether failed analysis should be retryable" (yes, via update-in-place, never a second insert).
5. **Not found** → normal `insert`, as designed above.

**Concurrent requests**: two simultaneous "convert" clicks race to step 5's `insert`. The DB unique index resolves it — the losing request's insert raises `unique_violation`; the route should catch that specific Postgres error code and immediately re-run step 1's `select` to return the winner's row, rather than surfacing a raw 500. This closes the "concurrent requests" test category with a small, well-understood catch-and-reselect pattern already conceptually similar to `apply_project_update_transaction`'s own `for update` row-locking philosophy.

**Net result**: because `applied` rows are structurally protected by the *apply* claim mechanism (`status in (analyzed, reviewed)` guard, already existing and unchanged) and the unique index permanently pins one message to one `project_updates` slot, **it is now structurally impossible for one share message to reach `applied` status twice** — the core required invariant.

---

## 3. Server-trusted source message input

### Recommendation: a narrow, new Client Share owner route — not a generic-endpoint extension

**Do not** have the browser send `message.body` to `/api/project-updates/analyze`. Instead, follow the exact pattern already established by every other owner-mutation route in `app/api/share-links/[id]/messages/`, most directly `app/api/share-links/[id]/messages/[messageId]/route.ts` (the existing `PATCH` status-change route):

```ts
// app/api/share-links/[id]/messages/[messageId]/route.ts:61-119 (existing pattern, cited verbatim)
assertClientShareEnabled();
const { id, messageId } = await context.params;           // parsed + uuid-validated
const { data: { user } } = await supabase.auth.getUser(); // 401 if absent
const ownership = await verifyOwnedShareMessageBelongsToLink(supabase, {
  messageId, shareLinkId: id, userId: user.id,
});                                                          // proves link+message+owner triple
// ... only then does the route call the actual mutation
```

`verifyOwnedShareMessageBelongsToLink` (`lib/share/share-messages-repository.server.ts:381-406`) currently selects only `id` — it does not return `body`/`author_type`/`project_id`/`status`. A new sibling repository function, e.g. `loadShareMessageForConversion(supabase, { messageId, shareLinkId, userId })`, should extend this exact pattern to select `id, body, author_type, project_id, status` scoped by `id = :messageId and share_link_id = :shareLinkId and user_id = :userId`, additionally rejecting (with specific error codes, matching this file's existing style) `author_type <> 'client'` and `status = 'converted'`.

### Proposed route/service contract

**New route**: `app/api/share-links/[id]/messages/[messageId]/convert/route.ts`, `POST`, empty or near-empty body (no `rawInput` parameter — the server loads it itself).

```
POST /api/share-links/:id/messages/:messageId/convert
→ 200 { ok: true, data: { projectUpdateId, status: "analyzed" | "already-converted", ... } }
→ 401 UNAUTHENTICATED / 404 SHARE_MESSAGE_NOT_FOUND / 409 SHARE_MESSAGE_NOT_CLIENT_AUTHORED
```

Internally: `assertClientShareEnabled()` → auth → `loadShareMessageForConversion` (proves ownership + `author_type='client'` + not-yet-converted, loads the immutable `body`) → find-or-create against `project_updates.source_share_message_id` (§2) → on a fresh/resumed slot, call **the existing, unmodified** `analyzeProjectUpdateV2({ projectId: message.project_id, rawInput: message.body, sourceType: "client_share" })` service function directly (a plain TypeScript service import, not an HTTP round-trip to `/api/project-updates/analyze` — this is a direct function call between two `lib/` modules, exactly how `app/api/project-updates/analyze/route.ts` itself already calls it) → return the resulting `project_updates` id so the client can open the **existing, unmodified** Client Update review modal against it.

This is "a narrow Client Share owner route that reuses the analyzer service directly" — no duplicated analyzer, no new AI call site, existing review/apply contracts (`AnalyzeProjectUpdateV2Response`, the review modal, the apply route) completely untouched.

---

## 4. Atomic Apply + conversion trace

### Full read of `apply_project_update_transaction` (`supabase/migrations/202606150008_transactional_project_update_apply.sql`, 872 lines, read in full)

Confirmed structure: one `plpgsql`, `security invoker` function. Locks, in this exact order, every time: `project_updates` row (`for update of update_row`, line 127) → `projects` row (line 148) → `clients` row if present (line 162) → every `tasks` row for the project (line 179) → every targeted `project_update_items` row (line 195). It performs all mutations, all `project_timeline_events` inserts, then the final `project_updates` status flip to `'applied'` (lines 782-801) — **all inside the one function invocation, which is one Postgres transaction**. A `raise exception` anywhere aborts everything already done in the same call.

**Its signature never changes based on caller-supplied source information — it only takes `p_update_id`.** This is the key enabling fact: the function can determine "is this a Client-Share-sourced update?" purely by reading `v_update.source_share_message_id` off the row it already loads and locks at line 122-127 — **never as a new parameter**. This directly answers "should `source_share_message_id` be read from `project_updates` rather than supplied/trusted from the browser": **yes, unconditionally** — reading it from the already-locked row closes an entire class of spoofing risk a new parameter would otherwise open, and requires **zero change to the RPC's call signature**, so `app/api/project-updates/apply/route.ts` needs no changes to keep calling it exactly as today.

### Rejected: the previous design (Apply commit → separate best-effort conversion RPC)

Correctly rejected per your instruction — it leaves exactly the ambiguous-partial-failure window the whole engagement has spent five phases eliminating everywhere else in this feature.

### Recommended design: extend the existing RPC in place, via one new internal-only helper function

Add one new conditional block near the end of the existing function body — after `v_final_update` is set (after line 801), before the final `return` (line 827) — active only when `v_update.source_share_message_id is not null`:

```sql
-- inside apply_project_update_transaction, after the existing "mark update applied" block
if v_update.source_share_message_id is not null then
  perform public.finalize_share_message_conversion(
    v_update.source_share_message_id,
    v_update.id
  );
end if;
```

`finalize_share_message_conversion(p_message_id uuid, p_project_update_id uuid)` is a **new, small, `security definer`** helper (matching the Phase 5A convention of `send_share_message_reply`/`set_share_message_status` exactly), doing:

1. `select ... from share_messages where id = p_message_id and user_id = v_user_id for update` (locks the message; `auth.uid()` obtained internally, not trusted from the outer call).
2. Fail closed (`raise exception`) if not found, `author_type <> 'client'`, or `status = 'converted'` already (defense-in-depth; structurally shouldn't be reachable because the outer RPC's own `status in (analyzed, reviewed)` claim guard already prevents re-applying an applied update, but checked anyway per this codebase's established two-layer posture).
3. `insert into share_message_conversions (user_id, message_id, project_update_id, target_task_id, converted_by, converted_at) values (v_user_id, p_message_id, p_project_update_id, null, v_user_id, now())` — the existing, already-shipped `enforce_share_message_conversion_integrity` trigger (§B of the prior report) independently re-validates this insert.
4. `update share_messages set status = 'converted', reviewed_at = coalesce(reviewed_at, now()) where id = p_message_id and user_id = v_user_id` — **`resolved_at` is never touched** (§5).

### Why this satisfies every constraint you listed

- **Atomicity**: because step 2 is a `perform` (function call) from *within* the outer function's own transaction, a `raise exception` inside the helper aborts the entire outer transaction — the work mutations, timeline events, and the `project_updates` status flip all roll back together with the conversion write. No new transaction-management code is needed; it is inherited for free from "one function call = one transaction," exactly like every other guarantee this RPC already provides.
- **"Existing normal Client Update callers remain unchanged"**: the RPC's parameter list (`p_update_id, p_apply_attempt_id, p_accepted_item_ids, p_rejected_item_ids, p_edited_items, p_apply_payload`) is untouched. Every existing text/image apply call has `source_share_message_id = null` on its row, so the new `if` branch is simply never entered — byte-for-byte unchanged behavior.
- **"How to avoid granting direct INSERT on `share_message_conversions`"**: `authenticated` never receives table-level INSERT. Only `execute` on the narrow `finalize_share_message_conversion` function is granted (same restrictive grant pattern as every sibling RPC) — the table itself keeps its current `select`-only grant to `authenticated` (§B of the prior report) forever. The only INSERT path is through this one `security definer` function, whose own internal checks (plus the still-active integrity trigger) are the sole gatekeepers.
- **Locking order**: the new lock (`share_messages`, via the helper) is acquired **last**, after every lock the existing function already takes in its established order (`project_updates` → `projects` → `clients` → `tasks` → `project_update_items`). Since this order is the only order this feature ever uses for these tables, and `share_messages` was never previously locked by this function at all, there is no new deadlock surface.
- **Unique/concurrency behavior**: `share_message_conversions_message_id_unique` (already existing, §B of the prior report) is the final backstop — even if the outer `status in (analyzed, reviewed)` claim guard were somehow bypassed twice concurrently (it can't be, by design), a second `finalize_share_message_conversion` call for the same message would hit the unique constraint and abort that transaction, never producing two conversion records.
- **"Do NOT create a second Apply RPC/path"**: satisfied — `apply_project_update_transaction` remains the one and only authoritative apply entry point; `finalize_share_message_conversion` is an internal helper it calls, not a second client-facing apply path.

---

## 5. `'converted'` must be terminal

### Can `set_share_message_status` currently revert a converted message?

**Yes — confirmed, this is a real gap.** Full re-read of `set_share_message_status` (`supabase/migrations/202608190001_client_share_message_owner_rpcs.sql:200-297`): the function validates only the **target** status (`p_status not in ('new','reviewed','resolved','dismissed')` → reject) and that the message exists/is owned. It never reads or checks the row's *current* `status` before performing:

```sql
-- 202608190001...sql:275-280
update public.share_messages
  set status = p_status, reviewed_at = v_reviewed_at, resolved_at = v_resolved_at
  where id = p_message_id and user_id = v_user_id;
```

There is no guard preventing this from firing when the row's existing `status = 'converted'`. As written today, an owner (or a stale UI) **could** flip a converted message back to `'reviewed'`/`'resolved'`/`'dismissed'`/`'new'`. (The `share_message_conversions` traceability row itself would remain untouched and permanently correct — only `share_messages.status` would become misleading.)

### Do current `MessageCard` status buttons still render for a converted row?

**Yes — confirmed, second real gap.** `client-communication-history-modal.tsx`'s `MessageCard` renders the `Mark reviewed`/`Resolve`/`Dismiss` button row (lines 237-267) whenever `isClient` is true (line 234) — there is no additional check for `message.status !== "converted"`. A converted client message today would still show all three buttons, each fully wired to `onStatusChange` → the same unguarded RPC above.

### Does unread logic already treat converted correctly?

**Yes, already safe, no change needed.** `share_messages_unread_client_idx` (`202608030003...sql:660-662`) is `where status = 'new' and author_type = 'client'`. Conversion requires `reviewed_at is not null` (enforced by `share_messages_status_timestamps_check`, `202608030003...sql:613-625` — any non-`'new'` status requires `reviewed_at`), so a message must already be past `'new'` before it can ever become `'converted'`. It is structurally impossible for a converted row to satisfy `status = 'new'`, so it is already excluded from the unread count with zero code changes.

### Does converting an already dismissed/resolved/reviewed message violate any constraint?

**No — verified safe.** `share_messages_status_timestamps_check` only requires `resolved_at is not null` **when** `status = 'resolved'` (`status <> 'resolved' or resolved_at is not null`) — it does not forbid a non-null `resolved_at` for any other status. So converting a previously-`'resolved'` message leaves its existing `resolved_at` value untouched (never cleared), and converting a `'dismissed'`/`'reviewed'` message (both already carry `reviewed_at`) satisfies the `converted`-requires-`reviewed_at` rule immediately, with `resolved_at` correctly staying `null`. This matches your accepted semantics exactly: *"resolved_at is NOT artificially set merely because conversion happened"* — and by symmetry, an existing `resolved_at` is never artificially cleared either.

### Smallest guards required (three layers, matching this codebase's established two/three-layer defense-in-depth posture)

1. **DB** (in `set_share_message_status`, small in-place edit to an existing Phase 5 RPC): select the row's current `status` (not just `reviewed_at`) at the existing lock step, and if `v_existing_status = 'converted'`, `raise exception` with a new code, e.g. `SHARE_MESSAGE_STATUS_TERMINAL`, before the `update` statement.
2. **API**: `PATCH .../messages/[messageId]/route.ts` needs one new `case` mapping that error code to a `409` response (its `switch` already has this exact shape for `UNAUTHORIZED`/`SHARE_MESSAGE_NOT_FOUND`/`INVALID_REQUEST`, `route.ts:121-136`).
3. **UI**: `MessageCard` gates the status-button row (and, separately, `Reply` per the existing `canReply` prop) on `message.status !== "converted"`, rendering the already-present `STATUS_LABELS.converted = "Converted"` badge instead (`client-communication-history-modal.tsx:33-43` — the label map already anticipates this read-only state, it is just never currently prevented from being clicked past).

### Confirmed preferred product rule matches repository evidence exactly

*"All client-authored, non-converted messages may be explicitly converted; owner-authored replies may never be converted"* — the owner-reply half is **already enforced today**, at the DB trigger layer, with zero new code (`enforce_share_message_conversion_integrity`'s `SHARE_CONVERSION_MESSAGE_NOT_CLIENT_AUTHORED` check, §B of the prior report). The "non-converted" half is the new guard designed above.

---

## 6. Archived project semantics — verified, not guessed

### What "Archived" actually means in this repository today

There is **no** `projects.is_archived` or `projects.archived_at` column anywhere in the schema (confirmed again this session — no `create table public.projects` migration exists in `supabase/migrations/`, and no grep hit for `projects.is_archived`/`archived_at` in any migration). The only project-level lifecycle column found anywhere is `projects.deleted_at` (soft-delete), already the sole gate every Client Share and Client Update RPC checks.

**"Archived project" is a UI-computed aggregate, not a database state.** The derivation, `app/components/dashboard/tasks/task-utils.ts:310-314`:

```ts
is_archived: typeof project?.is_archived === "boolean"
  ? project.is_archived
  : tasks.every((task) => Boolean(task.is_archived)),
```

A project is shown in the dashboard's "Archived Projects" view (`getViewTitle`/`getViewDescription`, `task-utils.ts:140-147`; `archiveView`/`archivedProjectsCount`, `tasks-view.tsx:171,345,492`) when **every one of its individual tasks has the task-level `is_archived = true` flag** — `is_archived`/`archived_at` genuinely exist, but only on `public.tasks`, never on `public.projects` (confirmed in the prior report and re-confirmed here).

### Is an effectively-archived project read-only? Is Analyze/Apply allowed?

**No special restriction exists anywhere.** Neither `analyzeProjectUpdateV2`'s context loader nor `apply_project_update_transaction` (read in full for this audit, §4) references `is_archived` at any point — the apply RPC's only project-level gate is `project.deleted_at is null` (line 147). **Analyze and Apply are both already fully allowed today on a project whose every task is archived.** "Archived" in this product means "hidden from the default active-work view," not "frozen" — restore/un-archive is a plain task-level flag flip, not a distinct lifecycle transition with its own authorization rules.

### Phase 6 rule (follows existing authoritative model, invents nothing new)

Gate Phase 6 conversion **exactly the same way** every existing Client Update and Client Share RPC already gates everything: `projects.deleted_at is null`. Do not add any new "is this project archived" check — the existing product already treats an archived project as fully mutable, and a new, stricter rule for Client Share specifically would be an invented restriction with no repository precedent, contradicting rule #8 (reuse the existing authoritative model).

---

## 7. Manual task prefill decision — re-verified

Re-searched specifically for a reusable manual task creation *review* UI (not just the ingestion endpoint already found in the prior report):

- `POST /api/tasks` (`app/api/tasks/route.ts`) is **never called from the dashboard task-list UI at all** — `app/components/dashboard-client.tsx` only calls `GET /api/tasks`, `GET /api/tasks/snapshot`, `POST /api/tasks/update`, and `POST /api/tasks/delete`. No production dashboard code path calls the creation endpoint directly.
- No component named or shaped like a "New Task" / "Create Task" form or modal exists anywhere under `app/components` (searched `New Task|CreateTask|AddTask|task-create|new-task` across the whole `app/` tree) — the only hits are the Client Update review card/modal (a different, already-reused flow) and an unrelated marketing resources page.

**Confirmed: no reusable manual task creation review UI exists in this repository.**

### Recommendation

**Defer manual task conversion from Phase 6 V1**, exactly as instructed. Do not build a second task-creation review UI as part of this feature. The `target_task_id` column on `share_message_conversions` and its trigger support for a task-only conversion (§B of the prior report) remain structurally available for a future phase, but nothing should be built against them now.

---

## 8. Final revised Phase 6 contract

| | **6A — Durable foundation** | **6B — Server-authorized Analyze** | **6C — Atomic Apply + conversion closure** | **6D — Runtime/security/lifecycle acceptance** |
|---|---|---|---|---|
| **Purpose** | Schema + access control only, no user-facing behavior | Owner-triggered, server-loaded analysis of one client message | Close the loop: apply produces the conversion record atomically | Real-Preview verification of every guarantee in this report |
| **Files likely touched** | New migration; no app code | New route `app/api/share-links/[id]/messages/[messageId]/convert/route.ts`; new repository fn `loadShareMessageForConversion` in `lib/share/share-messages-repository.server.ts`; new find-or-create helper against `project_updates` | Extend `apply_project_update_transaction` (new migration, in place); new helper fn `finalize_share_message_conversion`; small edit to `set_share_message_status` (terminal guard, §5); small edit to `PATCH .../messages/[messageId]/route.ts` (new error-code mapping); small edit to `analyzeProjectUpdateV2` (timeline-skip branch, §1); UI edit to `MessageCard`/`client-communication-history-modal.tsx` (convert action + terminal-status guard, per the original report's §G) | None — verification only |
| **Migration** | **Yes** — `project_updates.source_share_message_id` column + partial unique index + FK; `share_message_conversions` INSERT reachability (via the new `security definer` helper's own privileges — no direct table grant, §4); no schema change to `share_message_conversions` itself | No | **Yes** — replaces `apply_project_update_transaction` and `set_share_message_status` definitions in place (same function names/signatures, `create or replace function`); adds `finalize_share_message_conversion` | No |
| **Existing code reused** | `share_messages`, `share_message_conversions`, `enforce_share_message_conversion_integrity` (all unchanged) | `analyzeProjectUpdateV2` (unchanged, called directly as a service function), `verifyOwnedShareMessageBelongsToLink` pattern, existing Client Update review modal (unchanged) | `apply_project_update_transaction`'s entire existing body (unchanged, only appended to); existing apply API route (unchanged — RPC signature unchanged) | Everything above |
| **New/extended contracts** | `source_share_message_id` nullable FK column; new partial unique index | `POST /api/share-links/:id/messages/:messageId/convert` → `{ ok: true, data: { projectUpdateId, status } }` | `finalize_share_message_conversion(p_message_id, p_project_update_id)` (internal helper); `SHARE_MESSAGE_STATUS_TERMINAL` error code | None (test-only) |
| **Tests** | Migration shape tests (mirroring existing `*.test.ts` migration-source assertions); FK/unique-index behavior against a disposable DB | Route auth/ownership/author-type/idempotency tests (§9); find-or-create resume/retry/concurrent-race tests | Full atomic-apply test matrix (§9); terminal-status tests; timeline-isolation regression tests | Manual real-Preview checklist (below) |
| **Exit criteria** | Migration applies cleanly to disposable DB; zero application code changed; all existing Phase 1-5 tests still pass unmodified | New route fully covered by §9's authorization/idempotency tests; existing analyze route/tests for text/image completely unaffected | New apply-path tests (atomicity, rollback-on-failure, terminal status) all pass; full existing apply-route test suite passes unmodified; existing Phase 5 status/reply tests pass unmodified | Minimal real-Preview manual pass (2-4 checks, per this engagement's established target): (1) convert a message on an active link end-to-end through to a visible task/update; (2) convert a message on a revoked link with real history; (3) attempt to re-trigger status change on a converted message via the UI, confirm it's blocked; (4) confirm no `project_timeline_events` row appears until Apply, only at Apply |

**Manual task conversion is explicitly excluded from all four slices**, per §7.

---

## 9. Required tests — acceptance coverage map

**Analyze idempotency**
- Double-click / rapid resubmit on the convert route → single `project_updates` row (unique index).
- Simulated client retry after a timeout → find-or-create resolves to the same row, not a duplicate.
- Two concurrent convert requests for the same message → one wins the insert, the other's `unique_violation` is caught and reselects the winner; assert exactly one `project_updates` row exists afterward.
- A message with an existing `analyzed`/`reviewed` (≥1 item) `project_updates` row → convert call returns/reopens that existing row, does not call the analyzer again (mock assertion: `analyzeProjectUpdateV2` not invoked a second time).
- A message with a zero-item (partial-failure) or `ignored`/`failed` prior row → convert call safely overwrites that same row in place, still exactly one row for that message afterward.

**Timeline isolation**
- `sourceType: "client_share"` analyze call → assert `project_timeline_events` insert is never attempted.
- Existing `sourceType: "text"`/`"image"` analyze calls → assert the `ai_update_analyzed` event is still created exactly as today (regression, must not break).
- Successful Apply of a `client_share`-sourced update → assert only the normal, existing per-accepted-item timeline events are created (same event types as any other apply), nothing extra and nothing missing relative to the timeline events an equivalent text-sourced update would produce.

**Atomic Apply**
- Force `finalize_share_message_conversion`'s internal insert to fail (e.g. simulate the message having been reassigned to a different owner between analyze and apply) → assert the entire apply transaction rolls back: no task/project mutation persists, no timeline event persists, `project_updates.status` remains unchanged (not `'applied'`).
- Force the `share_messages` status update inside the helper to fail → same full-rollback assertion.
- Force the *existing* work-mutation logic to fail (a pre-existing test category, must still pass) → assert `share_messages.status` remains unchanged/non-`'converted'` (new assertion added to an existing failure-path test).
- A fully successful apply of a `client_share`-sourced update → assert, in one check, that the work mutation, the timeline events, the `share_message_conversions` row, and `share_messages.status = 'converted'` all appear together, or none do (single-transaction proof, e.g. via a forced mid-transaction error injected after the conversion insert and confirming even the already-completed work mutations are gone too).

**Authorization**
- Cross-tenant: user B cannot trigger conversion or apply-driven conversion for user A's message (existing `user_id = auth.uid()` scoping pattern, tested the same way every sibling RPC already is).
- Cross-project: a `source_share_message_id` whose `project_id` doesn't match the update's own project is rejected.
- Cross-share-link: the new convert route re-proves `verifyOwnedShareMessageBelongsToLink`'s triple exactly as the existing status-PATCH route does.
- Owner-authored reply → convert route rejects before ever calling the analyzer (author_type check happens in `loadShareMessageForConversion`, before any AI call — no analyzer invocation, no `project_updates` row created at all).
- Deleted (soft-deleted) project → convert route and apply-time `finalize_share_message_conversion` both fail closed, matching the existing `set_share_message_status`/`send_share_message_reply` pattern exactly.
- Revoked historical link with a still-live project → conversion **succeeds** (§C of the prior report: link state is irrelevant to conversion eligibility) — an explicit positive test, not just an absence-of-restriction assumption.

**Status**
- `set_share_message_status` called against a message with `status = 'converted'` → rejected with the new terminal error code, for all four target statuses (`new`/`reviewed`/`resolved`/`dismissed`).
- After conversion, `share_messages.reviewed_at` is non-null (was already, or was just set).
- After conversion, `share_messages.resolved_at` is unchanged from whatever it was immediately before conversion (null if it was null, preserved if it was already set from an earlier `'resolved'` transition).
- Public message payload (the existing `.select("author_type, author_display_name, body, created_at")` projection, `lib/share/share-public-message.server.ts:283`) still never includes `status`, `reviewed_at`, `resolved_at`, `id`, or `parent_id` — regression test confirming Phase 6 introduces no new public leak (this projection needs no change at all; the test only needs to keep proving it).

**Regression**
- Full existing Client Update text-flow test suite passes unmodified.
- Full existing Client Update image-flow test suite passes unmodified.
- Full existing Phase 5 reply/review/resolve/dismiss/unread test suite passes unmodified.
- Full existing Phase 5F revoked-history owner-access test suite passes unmodified.
- Full existing `apply_project_update_transaction` test suite (every non-`client_share` scenario) passes unmodified.

---

## 10. Final verdict

**READY FOR PHASE 6A IMPLEMENTATION.**

Every design question raised in this supplemental audit resolves to a concrete, narrow, backward-compatible extension of existing, already-shipped code, with repository evidence (not assumption) behind each one:

- Timeline isolation is a one-line conditional in an existing function.
- Idempotency is one nullable column + one partial unique index on an existing table, with a well-defined find-or-create/resume/retry model that requires no new table.
- The server-trusted input path reuses an existing route pattern exactly, with no new analyzer.
- Atomicity is achieved by extending the existing, single authoritative Apply RPC in place, calling one new narrowly-scoped internal helper — no second Apply path, no direct table grant on `share_message_conversions`.
- "Converted is terminal" requires two small, well-understood guards (one RPC edit, one route edit, one UI edit) on top of an owner-reply protection that is already fully enforced today.
- "Archived project" has no special meaning at the data layer and requires no new rule — Phase 6 should simply reuse the existing `deleted_at`-only gate.
- Manual task conversion is correctly out of scope for V1, confirmed by an exhaustive UI search rather than assumption.

**No blocker remains.** The only items requiring your explicit approval before 6A begins (not technical blockers, product decisions):
1. Whether `share_messages.status` flips to `'converted'` at Apply time (this report's design, closing the earlier report's open question) — confirmed as the only design consistent with "converted happens ONLY after successful Apply."
2. The exact wording/error-code naming for the new terminal-status guard (`SHARE_MESSAGE_STATUS_TERMINAL` is a proposal, not a requirement).

Nothing else is undecided. Stopping here — no files other than this report were edited or created; no migration, SQL, build, push, deploy, or Production access occurred.
