# Text2Task Client Share — Phase 6C
## Atomic Apply + Conversion Closure
## Audit and Accepted Implementation Plan
## 2026-08-23

**Status: DESIGN READY AFTER SECURITY CORRECTION — NOT IMPLEMENTED.** This document is self-contained: it does not assume the reader has access to any prior conversation. It consolidates the Phase 6 Accepted Plan, the Phase 6A and 6B implementation reports, the original supplemental mapping report, a completed read-only Phase 6C design audit (verdict: `PHASE_6C_DESIGN_READY`), and a second, final pre-implementation security audit that found the original design's conversion helper vulnerable to a forged-`applied` standalone-invocation attack (verdict: `PHASE_6C_PLAN_SECURITY_BLOCKED`) and whose corrected, row-bound transaction-capability design is now reflected throughout this document — into one durable reference sufficient to begin Phase 6C implementation in a future, separately-authorized turn.

**The Phase 6 Accepted Plan (`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6_ACCEPTED_PLAN_2026-08-21.md`) remains authoritative wherever this document conflicts with it.**

---

## 1. Current repository checkpoint

```
main @ 0b10e61 — "Complete Client Share Phase 6B message analysis flow"
```

Previous checkpoints in this engagement:

```
70f2858 — "Complete Client Share Phase 6A provenance foundation"
8142245 — "Complete Client Share Phase 5 communication lifecycle"
```

- Working tree: **clean** at the completion of the Phase 6C audit.
- Branch: `main...origin/main`, **ahead of origin by 16 commits**.
- **No Phase 6C implementation exists yet** — no migration, no application code change, no test.
- Phase 6B's own migration, `supabase/migrations/202608230001_client_share_apply_boundary.sql`, has been runtime-verified against a disposable Supabase project (29/29 pass) and the full Next.js production build has passed locally — but it has **not** been applied to the Production database, and no deploy or push has occurred.
- No push, deploy, or Production SQL is authorized by anything in this document.

---

## 2. Completed foundation

### Phase 6A — durable source + structural analyze-idempotency foundation (`supabase/migrations/202608210001_client_share_project_update_provenance.sql`)

- `public.project_updates.source_share_message_id uuid null` — nullable FK to `public.share_messages(id)`, **`on delete restrict`** (not `set null`, not `cascade` — a hard delete of a referenced message fails outright rather than silently corrupting or destroying a permanent `project_updates` record).
- A biconditional CHECK constraint: `(source_type = 'client_share') = (source_share_message_id is not null)` — rejects both invalid states.
- A partial unique index, `project_updates_source_share_message_id_key`, on `(source_share_message_id) where source_share_message_id is not null` — the structural "one message → at most one `project_updates` row" guarantee.
- One combined `before insert or update` trigger, `enforce_project_update_source_provenance()` (`security invoker`): on insert, proves the referenced `share_messages` row exists, is `author_type='client'`, shares the same `user_id`/`project_id`, and — critically — that `raw_input` is **exactly equal** (`IS NOT DISTINCT FROM`, no trim/case-fold/hash) to that message's `body`; on update, rejects **any** change to `source_type` or `source_share_message_id` in either direction, and rejects any change to `raw_input` once `source_share_message_id` was already non-null.
- The public generic `POST /api/project-updates/analyze` route and its request Zod schema were **not** touched — still only accepts `text`/`image`/`email`/`manual`. The analyzer's own actionable input types (`ProjectUpdateV2AnalyzerInput`, `CreateProjectUpdateInput`) were **not** widened in 6A either (only the passive, display-oriented `ProjectUpdateSourceType` TS union was).
- Disposable-project runtime verification: **64/64 PASS**.

### Phase 6B — explicit server-authorized Analyze + existing review reuse (`supabase/migrations/202608230001_client_share_apply_boundary.sql` plus application code)

- New owner route, `POST /api/share-links/[id]/messages/[messageId]/analyze` — never accepts `rawInput`/`sourceType`/`sourceShareMessageId`/`projectId` from the request body; every value is server-derived from the authenticated session and the path.
- `loadShareMessageForConversion` (`lib/share/share-messages-repository.server.ts`) is the sole place `share_messages.body` is read for this feature — proves link/message/project ownership and `author_type='client'` before ever touching AI.
- **Reservation-before-AI**: `share-message-conversion.server.ts` reserves the durable `project_updates` slot (`status='draft'`, via the existing `createProjectUpdateAuditRecord`) **before** any AI call — closing a concurrency hole where the original design ran AI first and only relied on the unique index at INSERT time.
- **Concurrency ownership**: only the request that wins the reservation INSERT (or, for a retry, an atomic compare-and-set claim UPDATE) may call `extractProjectUpdateFacts`/`judgeProjectUpdateFacts`. A losing concurrent request never runs AI; it returns `state: "ready"` (if the winner already finished) or `state: "in_progress"` (same durable id, no new AI call) — never a fabricated second slot.
- **Retry/resume semantics**: status alone decides — `analyzed`/`reviewed`/`applying`/`applied` always resume read-only regardless of item count (a legitimate analysis can produce zero items); `failed`/`ignored` are retryable only after winning an atomic claim; `draft` means another request currently owns the reservation and is never auto-retried.
- **Existing review reuse**: no second modal, no second state machine. `tasks-view.tsx` calls the existing, unmodified `projectUpdateState.openModal(project)` + `setAnalysisResult(...)`.
- `analyzeProjectUpdateV2` skips `createProjectTimelineEvent` entirely when `sourceType === "client_share"` — client_share Analyze creates **no** professional timeline event; normal text/image behavior is byte-for-byte unchanged.
- **Temporary Apply UI/API boundary** (Phase 6B's own defensive addition, explicitly scoped to be removed by 6C): `project-update-shell.tsx`'s `canApply` excludes `source_type === "client_share"`; `POST /api/project-updates/apply` rejects a client_share update with `409 project_update_source_not_appliable` before ever claiming or calling the RPC.
- **DB-level client_share applying/applied boundary** (`202608230001`): a dedicated, single-purpose trigger, `enforce_project_update_client_share_apply_boundary()`, `before insert or update on project_updates`, rejects any row where `source_type='client_share' AND status IN ('applying','applied')` — inspects only `NEW`, never `OLD`, so it closes **both** the UPDATE-transition bypass and the direct-INSERT-at-`applying` bypass (the specific gap an UPDATE-only guard would have missed).
- Disposable-project runtime verification (extended package, including the Apply-RPC prerequisite fix discovered along the way): **29/29 PASS**.
- Full local Next.js production build: **PASS** (90/90 static pages, new analyze route present).
- Committed at `main @ 0b10e61`.

---

## 3. Locked Phase 6C outcome

Phase 6C authorizes Apply for `client_share` **only** when all of the following happen inside **one PostgreSQL transaction**:

1. Accepted Client Update work mutations (tasks/projects/clients — the existing, unmodified Apply logic).
2. Existing Apply timeline events (the existing, unmodified per-item `project_timeline_events` inserts).
3. `share_message_conversions` INSERT.
4. `share_messages.status = 'converted'`.
5. `share_messages.reviewed_at = COALESCE(existing reviewed_at, conversion time)`.
6. `share_messages.resolved_at` preserved exactly as it was — never set, never cleared, by conversion.
7. `project_updates.status = 'applied'`.
8. Project completion reconciliation (the existing `reconcile_project_completion` call).

**Any failure at any point rolls back all of it.** There must never be an observable intermediate state where:
- work changed but the message was not converted,
- a conversion trace exists but work did not change,
- a message says `converted` while Apply actually failed,
- two conversion rows exist for the same message, or
- any other partial-transaction state is externally visible.

---

## 4. Final authoritative Apply RPC

**Source**: `supabase/migrations/202607270001_project_completion_reconciliation.sql`.

Five migrations have ever defined `apply_project_update_transaction`, in order: `202606150008` (original) → `202606160001` → `202606160002` → `202607020005` → **`202607270001`** (current). Grepped every migration in the repository for the function name — **confirmed no migration after `202607270001`, including both `202608210001` (Phase 6A) and `202608230001` (Phase 6B), redefines it.** It remains the sole, current, authoritative source.

**Exact current transaction order:**

1. `v_user_id := auth.uid()`; `raise UNAUTHORIZED` if null.
2. `p_update_id`/`p_apply_attempt_id` null check → `INVALID_APPLY_ATTEMPT`.
3. `p_edited_items`/`p_apply_payload` array-shape check → `INVALID_APPLY_PAYLOAD`.
4. Build/dedupe `v_accepted_ids`/`v_rejected_ids`; empty-selection, over-500, and accepted∩rejected conflict checks.
5. `SELECT project_updates ... FOR UPDATE` (row lock) → `PROJECT_UPDATE_NOT_FOUND` if absent.
6. `status <> 'applying' OR apply_attempt_id mismatch` → `APPLY_ATTEMPT_MISMATCH`.
7. `SELECT projects ... FOR UPDATE` → `PROJECT_NOT_FOUND`.
8. `SELECT clients ... FOR UPDATE` (if `client_id` present) → `CLIENT_NOT_FOUND`.
9. Lock every `tasks` row for the project; lock every targeted `project_update_items` row.
10. Apply-payload count/shape validation; duplicate-timeline-event dedup check.
11. Edited-items loop → `UPDATE project_update_items.new_value`.
12. Main payload loop, per accepted item: type-specific **accepted work mutation** (`INSERT tasks` for `new_subtask` / `UPDATE tasks` for `update_subtask` / `UPDATE projects` for a project-field change / `UPDATE projects+clients+tasks` for `client_detail_change`) → **timeline event INSERT** for that item.
13. `UPDATE project_update_items` → `status='applied'` (accepted) / `'rejected'` (rejected) — **item status updates**.
14. `UPDATE project_updates` → `status='applied'`, `reviewed_by`/`applied_by`/`reviewed_at`/`applied_at` — the **project_update applied update**.
15. **Priority provenance**: if any accepted item was a `priority_change`, `UPDATE projects SET priority_source='user'`.
16. `perform reconcile_project_completion(...)` if any item was accepted.
17. Aggregate `appliedItems`/`rejectedItems` JSON; **final JSON response** via `return jsonb_build_object(...)`.

`language plpgsql`, `security invoker`, `set search_path = public, pg_temp`, `EXECUTE` granted to `authenticated`, revoked from `public`/`anon` — unchanged across all five generations.

---

## 5. Existing database contracts

### `public.share_message_conversions`

Created in `202608030003_client_share_owner_foundation.sql`; its integrity trigger added in `202608030005_client_share_integrity_and_security.sql`.

**Columns**: `id uuid PK default gen_random_uuid()`, `user_id uuid not null references auth.users(id) on delete cascade`, `message_id uuid not null references public.share_messages(id) on delete cascade`, `project_update_id uuid null references public.project_updates(id) on delete set null`, `target_task_id bigint null references public.tasks(id) on delete set null`, `converted_by uuid not null references auth.users(id) on delete cascade`, `converted_at timestamptz not null default now()`.

**Constraint**: `share_message_conversions_message_id_unique UNIQUE(message_id)` — at most one conversion record per message, enforced at the DB level, for any writer.

**Grants**: `authenticated` has **`SELECT` only** — confirmed via direct grant inspection (`202608030003` revokes everything from every role on creation; `202608030005` re-grants only `select on table public.share_message_conversions to authenticated`). No INSERT/UPDATE/DELETE grant exists for `authenticated` anywhere.

**Integrity trigger**, `enforce_share_message_conversion_integrity()` — `security invoker`, `before insert` **only** (the table is append-only by design; there is no UPDATE case). On every INSERT it independently verifies: the referenced message exists (`SHARE_CONVERSION_MESSAGE_NOT_FOUND`); `message.user_id = new.user_id` (`..._OWNER_MISMATCH`); `message.author_type = 'client'` (`..._MESSAGE_NOT_CLIENT_AUTHORED`); `new.converted_by = new.user_id` and `= auth.uid()` (`..._ACTOR_MISMATCH` / `..._ACTOR_NOT_AUTHENTICATED`); if `project_update_id` is non-null, that it exists, is owned by the same user, and its project matches the message's project; if `target_task_id` is non-null, the equivalent task checks. This trigger is unmodified by Phase 6A/6B and independently re-validates whatever Phase 6C's new closure logic inserts.

**NO new table or column is needed for Phase 6C.** Everything the atomic closure needs to write already exists exactly as needed.

### `public.share_messages`

**Status values** (`share_messages_status_check`): `'new'`, `'reviewed'`, `'resolved'`, `'dismissed'`, **`'converted'`** — `'converted'` is **already** a valid CHECK-constraint value today; no schema change is needed to accept it.

**`reviewed_at` requirement**: `share_messages_status_timestamps_check` requires `reviewed_at IS NOT NULL` whenever `status <> 'new'`. Since `'converted' ≠ 'new'`, this **already** requires `reviewed_at` to be set for any converted row, at the database level, for free — matching the locked conversion rule automatically.

**`resolved_at`**: the same constraint requires `resolved_at IS NOT NULL` only when `status = 'resolved'` — it places **no** requirement on `resolved_at` for `'converted'`. `resolved_at` is correctly never required, never artificially set, and never artificially erased by conversion.

**Direct authenticated table UPDATE**: **not available.** `authenticated` holds only `SELECT` on `share_messages` (confirmed grant inspection, same migration as above) — there is no UPDATE grant at the table level at all.

**`set_share_message_status(p_message_id uuid, p_status text)`** (`202608190001_client_share_message_owner_rpcs.sql`) is `SECURITY DEFINER` — the only path by which `share_messages.status` can ever change, for any of the four Phase 5 target statuses (`new`/`reviewed`/`resolved`/`dismissed`; `'converted'` is already excluded as a **target** value, always has been).

**Current terminality gap** (confirmed by direct read, not assumed): `set_share_message_status`'s own `SELECT ... FOR UPDATE` loads `user_id`, `project_id`, and `reviewed_at` — it never loads or checks the row's **current** `status`. This means a message already `'converted'` can, today, be silently moved back to `'reviewed'`/`'resolved'`/`'dismissed'`/`'new'` through this RPC with zero rejection. Separately, the shared `enforce_share_message_integrity()` trigger's own `UPDATE` branch only guards identity columns (`share_link_id`/`user_id`/`project_id`/`parent_id`/`author_type`/`author_display_name`/`body`/`created_at`) — it never inspects `status` either.

**Phase 6C must close this** by adding one small check to `set_share_message_status`: load the row's current `status` in the existing `SELECT ... FOR UPDATE`, and immediately reject with a new stable error code, `SHARE_MESSAGE_STATUS_TERMINAL`, if it is already `'converted'` — before any status mutation is computed or applied.

---

## 6. Phase 6B DB boundary — RETAINED AND NARROWED, NOT DROPPED

**This section was corrected by a second, final pre-implementation security audit.** The original design (below this note, superseded) called for Phase 6C to fully `DROP` the Phase 6B boundary trigger once the atomic closure existed. That audit found this unsafe: `project_updates` carries a broad, column-unrestricted `authenticated` RLS UPDATE policy (§18 risk 4) with no trigger guarding `status` itself once the Phase 6B trigger is gone — so a client_share owner could raw-UPDATE their own row directly to `status='applied'` with zero real Apply work, then call the (then-standalone-callable) `finalize_share_message_conversion` helper directly. Every one of the helper's originally-proposed checks would have passed against that forged state, because none of them depended on anything not already forgeable via that same UPDATE grant. This fabricates a real `share_message_conversions` row and `share_messages.status='converted'` with no real work — a direct violation of the §3 locked outcome. Verdict: `PHASE_6C_PLAN_SECURITY_BLOCKED`. The correction below closes this without dropping the boundary and without touching text/image behavior.

`supabase/migrations/202608230001_client_share_apply_boundary.sql` installs `enforce_project_update_client_share_apply_boundary()`, a `before insert or update` trigger on `public.project_updates` that currently rejects any row where `source_type = 'client_share' AND status IN ('applying', 'applied')` — inspecting only `NEW`, so it applies identically whether the row got there via INSERT or UPDATE.

**Phase 6C must NOT drop this trigger or its function.** Instead, Phase 6C `CREATE OR REPLACE`s the trigger function so it:

**`applying`** — **no longer blocked** by this trigger. A raw `applying` transition (however reached) is not treated as proof of a successful Apply; the real `apply_project_update_transaction` independently re-validates ownership, item state, and payload shape, and performs the actual work itself, regardless of how the row reached `applying` (see §9's direct-RPC analysis — this was proven safe by the security audit).

**`applied`** — protected by a **transaction-local, row-bound capability** (not a boolean flag — see §7): the trigger rejects an unauthorized *entering* transition into `applied` for a `client_share` row unless the current transaction holds a matching capability for that exact row's id.

Conceptual semantics (final exact SQL to be written at implementation time):

```sql
if new.source_type = 'client_share'
   and new.status = 'applied'
   and (
     tg_op = 'INSERT'
     or old.status is distinct from 'applied'
   )
   and current_setting('text2task.client_share_apply_update_id', true)
       is distinct from new.id::text
then
  raise exception using errcode = 'P0001',
    message = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE';
end if;
```

**Important — the boundary protects *establishing* `applied`, not every future update to an already-`applied` row.** The condition `old.status is distinct from 'applied'` (together with the `tg_op = 'INSERT'` branch for a row fabricated already-`applied` from birth) means: a direct INSERT already at `applied`, and every *entering* transition (`draft`/`analyzed`/`reviewed`/`applying` → `applied`) remain guarded; a subsequent, otherwise-legal non-status update to a row that is already legitimately `applied` and stays `applied` is **not** forced to re-supply the capability. This keeps the guard scoped to the one dangerous transition instead of over-blocking legitimate future writes to an already-applied row.

**Migration statement ordering must remain fail-safe** even if the migration is manually pasted into a SQL client and execution is interrupted partway — see the corrected §12.

---

## 7. Phase 6C database architecture

### `apply_project_update_transaction`

**Keep unchanged**: exact same six-argument signature (`p_update_id, p_apply_attempt_id, p_accepted_item_ids, p_rejected_item_ids, p_edited_items, p_apply_payload`); `SECURITY INVOKER`; `EXECUTE` granted to `authenticated`; `auth.uid()`-based ownership on every existing check; all existing text/image (and email/manual) behavior byte-for-byte unaffected.

**Do NOT**: switch Apply to a `service_role` client anywhere in the application; revoke `authenticated`'s existing `EXECUTE` grant; create a second Apply RPC; create a second Apply API endpoint.

### The transaction-local row-bound capability

**This subsection was added by the second, final pre-implementation security audit and is load-bearing for the rest of §7 — read it first.**

Phase 6C establishes a PostgreSQL transaction-local capability, scoped to the exact `project_update_id` being legitimately applied:

```sql
perform set_config(
  'text2task.client_share_apply_update_id',
  p_update_id::text,
  true  -- is_local: transaction-scoped, auto-clears on commit/rollback
);
```

set via `set_config(..., is_local => true)` **inside `apply_project_update_transaction` itself**, immediately before its existing, authoritative `UPDATE project_updates SET status = 'applied', ...` statement (see §8 for exact placement) — never near the top of the function, and never for non-`client_share` rows.

**Deliberately not a boolean flag.** A plain `app.client_share_transaction = 'on'` GUC (the original, generic form proposed by the read-only audit) would prove only "some legitimate Apply transaction is in progress" — it would not prove *which* `project_update_id` it was legitimately applying, so a capability minted for update A could be replayed to (mis)authorize update B if any code path ever handled more than one id per transaction. Binding the value to the exact `id::text` closes that off structurally: the trigger (§6) and the helper (below) each compare the *current setting* against the *specific row/id in front of them*, not against a generic "yes/no."

**Why this is the authoritative proof of a legitimate Apply** (§4 of the original audit instruction):
- It proves the current transaction is executing the authoritative `apply_project_update_transaction` RPC, for this exact `project_update_id`, and has reached the legitimate `applied`-state transition point — not merely that *a* transaction with this role exists.
- A raw Supabase/PostgREST table UPDATE executes in its own, separate transaction and has no way to have set this local value first — PostgREST issues one statement per request; there is no preceding `SET LOCAL`/`set_config` a bare `PATCH` can inject.
- A standalone call to `finalize_share_message_conversion` also executes in its own, separate transaction (unless it is the same transaction the outer RPC opened via `perform`), and therefore cannot inherit a setting it never set itself.
- The value auto-clears at commit or rollback (`is_local = true`), so it cannot leak across pooled connections or into a later, unrelated transaction.
- Because the comparison is against the exact row id, a capability legitimately minted for update A cannot be used to authorize update B, even within the same session.

**Reject-only Apply is not a problem for this design.** The existing RPC's own selection-count check only requires `cardinality(accepted) + cardinality(rejected) > 0` — `accepted_item_ids` may legitimately be empty as long as `rejected_item_ids` is not, meaning a fully legitimate "reject everything" Apply produces **zero** task/project mutations and **zero** timeline events, yet still legitimately reaches `status = 'applied'` and must still convert the message. This is exactly why "a real task/project mutation exists" or "a timeline event exists" was rejected as a candidate proof mechanism during the security audit — beyond being independently forgeable (`project_update_items` and `project_timeline_events` carry the same broad, owner-writable RLS shape as `project_updates` itself), such a check would have wrongly rejected this legitimate zero-work case. The row-bound capability is deliberately independent of whether any accepted work mutation exists at all: it proves *the authoritative transition happened*, not *that work happened*, which is the correct thing to prove given §3's own outcome only requires a successful Apply, not a non-empty one.

### `finalize_share_message_conversion` (new)

One dedicated `SECURITY DEFINER` helper — the only new privileged database object this slice introduces. It must be a **complete, independent authorization boundary** (per the Accepted Plan's own locked correction C): because `authenticated` will necessarily hold `EXECUTE` on it (required for the still-`SECURITY INVOKER` outer RPC's own `perform` call to succeed), PostgREST exposes it to direct, standalone invocation by any authenticated client regardless of the developer's intent for how it's called — so it must never assume it is only ever reached from inside the trusted outer RPC.

**Inputs**: `p_message_id uuid`, `p_project_update_id uuid`.

**Must derive the caller from `auth.uid()` internally** — never trust anything about identity from the caller's arguments.

**Must independently require the transaction-local capability, before any write**:

```sql
if current_setting('text2task.client_share_apply_update_id', true)
   is distinct from p_project_update_id::text
then
  raise exception using errcode = 'P0001',
    message = 'SHARE_CONVERSION_APPLY_CONTEXT_REQUIRED';
end if;
```

(Final exact error-code name to be chosen at implementation time after inspecting this repository's existing error-code conventions — `SHARE_CONVERSION_APPLY_CONTEXT_REQUIRED` is the conceptual name; it must fail closed — missing or mismatched setting is rejected, not treated as absence-means-allow.)

**Must also independently lock and validate**, before any write — **unchanged from the original design; these remain a second, independent layer, not replaced by the capability check above**:

`project_updates` (`SELECT ... FOR UPDATE`):
- owned by `auth.uid()`
- `status = 'applied'`
- `source_type = 'client_share'`
- `source_share_message_id = p_message_id`

`share_messages` (`SELECT ... FOR UPDATE`):
- owned by `auth.uid()`
- `id` matches the provenance already proven above
- `project_id` matches the `project_updates` row's own `project_id`
- `author_type = 'client'`
- `status <> 'converted'`

**Then, atomically** (still inside the same transaction the outer RPC already opened):
- `INSERT INTO share_message_conversions (user_id, message_id, project_update_id, converted_by, converted_at) VALUES (auth.uid(), p_message_id, p_project_update_id, auth.uid(), now())`.
- `UPDATE share_messages SET status = 'converted', reviewed_at = COALESCE(reviewed_at, now()) WHERE id = p_message_id AND user_id = auth.uid()`.
- **`resolved_at` is never referenced or touched.**

The existing, unmodified `enforce_share_message_conversion_integrity()` trigger independently re-validates the INSERT the moment it happens — a third layer, not a replacement for the helper's own checks.

**Why a direct, standalone call to this helper can no longer succeed maliciously — corrected proof.** The original design's proof (retracted): "`project_updates.status = 'applied'` and `share_messages.status <> 'converted'` are mutually exclusive in time for any given message, so no window exists for a standalone call to exploit." **This was disproven by the second security audit**: `status = 'applied'` is directly forgeable via a raw authenticated UPDATE (§18 risk 4) with zero real work, independent of any legitimate Apply ever running — so the "mutual exclusion" never actually held. The corrected proof: the helper's checks alone are no longer treated as sufficient. Its **new, first check** — the transaction-local capability, bound to `p_project_update_id` — can only be `on` inside the one transaction where `apply_project_update_transaction` itself set it, immediately before performing the real, authoritative `applied` transition for that exact row (§8). A standalone call, in its own transaction, never has this capability set, and therefore fails the first check before any of the original (still-necessary, still-independent) ownership/status/provenance checks are even relevant. Even in the hypothetical where an attacker somehow fabricates a `project_updates` row that already reads as `applied` (e.g. via the raw-UPDATE forgery the audit demonstrated), the standalone helper call still fails on the capability check alone.

---

## 8. Exact closure placement

**Two distinct insertion points, at two different steps of the existing 17-step transaction order (§4) — corrected by the second security audit, which requires the capability to be set separately and earlier than the closure block itself.**

### Insertion point 1 — the capability, immediately before step 14

`perform set_config('text2task.client_share_apply_update_id', p_update_id::text, true);` is inserted **immediately before** the existing, unmodified step 14 (`UPDATE project_updates SET status='applied', ...`), and **only when `v_update.source_share_message_id is not null`** — i.e., only for `client_share` rows. For every other source type, this statement is never reached; nothing about steps 1–17 changes for text/image/email/manual. This must be set **late** — after auth/ownership validation, apply-attempt validation, every lock (project/client/task/item), payload validation, the edited-items writes, every accepted work mutation, every timeline write, and the item status updates (i.e., after everything through the existing step 13) — not near the top of the function, so that the capability is minted only once the transaction has actually done everything a legitimate Apply is supposed to do, immediately before the one statement it exists to authorize.

Do not rely on manually clearing this setting for safety — `is_local = true` guarantees it is gone at commit or rollback regardless of what happens afterward in the same transaction or in any later one.

### Insertion point 2 — the closure block, immediately before the final return

The closure block itself is unchanged in position from the original design: a **single new `if` block**, gated `if v_update.source_share_message_id is not null then ... end if;`, inserted **immediately before the existing final `return jsonb_build_object(...)`** — i.e., strictly after every existing step: accepted work mutations, timeline event inserts, item status updates, the `project_updates` applied-state write (step 14, now preceded by the capability), priority provenance, and `reconcile_project_completion`. For any non-`client_share` row (`source_share_message_id is null`), this block is a complete no-op — zero behavior change for text/image/email/manual Applies. By the time this block runs and calls `finalize_share_message_conversion`, the capability set at insertion point 1 is still `on` for this exact `project_update_id` (it has not yet committed or rolled back), so the helper's own capability check (§7) passes.

This placement was chosen over an "early validate, late mutate" split specifically to avoid a TOCTOU gap: under Postgres's default READ COMMITTED isolation, an early, unlocked read of `share_messages` would simply be re-read fresh by a later `FOR UPDATE` anyway, providing no real protection. Doing the lock and every validation check together, as the first action inside this one new block, means there is no gap between "checked" and "used."

**Everything remains part of the same transaction.** If the closure block raises for any reason (helper validation failure, unique-constraint violation on the conversion insert, the `share_messages` update failing), the exception propagates out of `apply_project_update_transaction` exactly like any other `raise exception` already in this function today — Postgres aborts the entire transaction, unconditionally reverting every work mutation, every timeline insert, every item/update status change, and the priority-provenance/completion-reconciliation writes that had already executed earlier in the **same** function invocation, even though those statements "already succeeded" up to that point.

**Why no external side effect can escape rollback**: the entire function — existing body and the new closure block alike — is pure SQL/plpgsql against local Postgres tables. There is no HTTP call, no email send, no AI call, no call to anything outside this one database, anywhere in `apply_project_update_transaction` or in the proposed `finalize_share_message_conversion`. Full atomicity requires no new mechanism (no outbox pattern, no compensating transaction) — it falls out for free from "one function call is one Postgres transaction."

---

## 9. Direct RPC security

`authenticated` can invoke `apply_project_update_transaction` directly — confirmed via grant inspection in the Phase 6B DB-boundary audit (this RPC has always had `EXECUTE` granted to `authenticated`, `SECURITY INVOKER`, callable via PostgREST independent of the Next.js application). **Therefore the database transaction itself is the authoritative security boundary for Phase 6C — Next.js is not, and cannot be, the enforcement point.** The browser can never be trusted to supply source identity (`source_share_message_id`, ownership, author type) — every one of those facts must be re-derived from `auth.uid()` and the locked database rows themselves, inside the transaction, exactly as `finalize_share_message_conversion` is designed to do in §7.

**An authenticated owner may still legitimately**: raw-set their own `client_share` row's `status` to `applying` directly, choose their own `apply_attempt_id`, and call `apply_project_update_transaction` directly (not through the Next.js route). This is **not** treated as a bypass — the corrected §6 trigger no longer blocks `applying` at all, precisely because the RPC itself does not trust `applying` as proof of anything: it independently re-validates ownership, the apply-attempt match, every lock, and the full payload shape against live rows, then performs the real work mutations, timeline writes, and item-status updates itself, mints the row-bound capability (§7/§8) only after all of that has actually happened, and only then transitions the row to `applied` and runs the closure block. Reaching `applying` by an unusual path changes nothing about what the RPC subsequently does or requires.

**The one path that is genuinely closed, and the only one the security audit found dangerous**: a raw UPDATE directly to `status = 'applied'` (skipping `apply_attempt_id` validation and the RPC entirely), followed by a **standalone** call to `finalize_share_message_conversion`. The corrected §6 trigger rejects the raw UPDATE itself (no capability exists outside the RPC's own transaction), and even in a hypothetical where that forgery somehow succeeded, the helper's own new capability check (§7) independently rejects the standalone call. The distinction that matters is not "was the RPC called directly" (always fine — the RPC is self-validating) but "did `applied` get reached by *some* execution of the real RPC's own transaction, or by a raw table write" (only the former is ever accepted).

`FOR UPDATE` locks are required on both `project_updates` (already existing, unchanged) and, newly, `share_messages` (inside the helper) — without them, two concurrent transactions could both read a pre-mutation snapshot and both proceed.

**Concurrent/replay outcomes, discovered by direct trace, not assumption:**

| Scenario | Outcome |
|---|---|
| Two concurrent direct RPC calls, same `project_update_id` | The second blocks on the existing `project_updates` row lock until the first commits, then re-reads the now-`'applied'` row and fails its own `status <> 'applying'` check with `APPLY_ATTEMPT_MISMATCH` — zero mutation |
| Duplicate/replayed call with the same `apply_attempt_id`, after the first succeeded | `status ≠ 'applying'` now (it's `'applied'`) → `APPLY_ATTEMPT_MISMATCH`, no mutation |
| Stale `apply_attempt_id` from an abandoned claim | attempt-id mismatch → `APPLY_ATTEMPT_MISMATCH`, no mutation |
| `share_message` already `'converted'` when Apply is attempted again | Can only co-occur with `project_updates.status='applied'` for that same row (both set together, same transaction) — already covered by the row-status check above; the helper's own `status <> 'converted'` check is a second, independent gate |
| A direct, standalone call to `finalize_share_message_conversion` | Rejected by its own capability check — see §7's corrected proof |
| A raw authenticated UPDATE forcing `project_updates.status='applied'` on a `client_share` row (no RPC involved) | Rejected by the corrected §6 trigger — no transaction-local capability exists outside the RPC's own transaction |

**No new concurrency-control mechanism is required.** The existing status-claim + `apply_attempt_id` + `FOR UPDATE` design, entirely unmodified, already serializes every one of these cases.

---

## 10. Converted terminality

Phase 6C must modify `set_share_message_status(p_message_id uuid, p_status text)` so that, immediately after loading the row (extending its existing `SELECT ... FOR UPDATE` to also read the current `status`) and before computing or applying any status mutation:

```sql
if v_existing_status = 'converted' then
  raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_STATUS_TERMINAL';
end if;
```

**Do not modify `resolved_at` semantics** anywhere in this function — the existing per-target-status `reviewed_at`/`resolved_at` computation for `new`/`reviewed`/`resolved`/`dismissed` stays exactly as it is today.

**Do not allow `converted → new/reviewed/resolved/dismissed`, in any form, through any path.** This is the sole existing path capable of moving `share_messages.status` at all (no direct `authenticated` table UPDATE exists — §5), so this one guard is sufficient; no second, trigger-level defense-in-depth layer is structurally required, though one could optionally be added later for symmetry with other integrity triggers in this codebase.

---

## 11. Product/UI decisions (LOCKED for Phase 6C)

### Apply

`client_share` returns to the **same existing** Client Update Apply flow — the same review modal, the same `applySelectedChanges` state machine, the same `POST /api/project-updates/apply` endpoint.

**Remove**:
- The Phase 6B UI Apply suppression: `project-update-shell.tsx`'s `canApply` currently excludes `source_type === "client_share"` — delete that clause, restoring `canApply` to depend only on `hasSelectedApplyableItems(form)`, exactly as text/image already do.
- The Phase 6B API 409 rejection: `POST /api/project-updates/apply` currently rejects `source_type === "client_share"` with `409 project_update_source_not_appliable` before claiming or calling the RPC — delete that block, restoring the route to calling `claimProjectUpdateForApply` → the RPC uniformly for every source type.

**No second Apply route, modal, or state machine.**

### Communication History

A converted message:
- **remains visible** in Client Communication History
- **original body remains intact** (already permanently immutable — `enforce_share_message_integrity`'s own UPDATE branch has always rejected any change to `body`)
- **shows a "Converted" status badge** (`STATUS_LABELS.converted = "Converted"` already exists in `client-communication-history-modal.tsx`, unused until now — no code change needed for this specific piece)
- **cannot be Analyzed again** (`canAnalyzeAsClientUpdate = isClient && message.status !== "converted"` already exists in the current codebase, built forward-compatibly in Phase 6B — verified by direct read; **no new code needed for this specific piece**)
- **cannot be Mark reviewed / Resolved / Dismissed** — this guard does **not** yet exist. Verified by direct read: the action-button row currently renders unconditionally whenever `isClient` is true, with no `message.status !== "converted"` check anywhere on those three buttons. **This is genuinely new UI work Phase 6C must add.**

**IMPORTANT PRODUCT DECISION, explicitly locked**: **Do NOT disable Reply solely because a message became converted.** `"Converted"` is terminal for the processing/status lifecycle only — it is not a statement that communication with the client must stop. The existing Reply capability (`canReply`, already independently gated on link state) may remain available on a converted message unless some other, independent rule prevents it. Do not add a `status !== "converted"` guard to Reply as part of this work.

### Apply response

**Do NOT add `conversionId`/`convertedAt`/`converted` metadata to the Apply JSON response** unless concrete implementation evidence proves the existing UI actually needs it. Default design for Phase 6C: **preserve the existing Apply response contract exactly as it is today.**

### History refresh

**No new post-Apply refresh architecture is required.** Traced: the Share Link panel (`ClientCommunicationHistoryModal`'s host) is always closed (`shareLink.closePanel()`) **before** the Client Update review modal opens for the "Analyze as client update" flow — so the Communication History panel is never open while Apply happens. It owns its own data via `useOwnerShareMessages(shareLinkId, true)`, which fetches fresh on mount — reopening the panel after Apply already shows current DB state, including `'converted'`, via existing code, with no page reload. **Do not add polling or duplicate state synchronization** unless real implementation evidence proves this assumption wrong.

---

## 12. Migration strategy

**Proposed filename**: `supabase/migrations/202608240001_client_share_apply_conversion_closure.sql` (next sequential slot after `202608230001`, following this repository's `YYYYMMDDNNNN_description.sql` convention — use the actual implementation date if it differs from the date proposed here).

**Migration must, in this exact order — corrected by the second security audit; the boundary trigger is narrowed in place, never dropped**:

1. Install the `SECURITY DEFINER` conversion helper first: `CREATE FUNCTION public.finalize_share_message_conversion(...)`, including its new transaction-local capability check (§7).
2. `CREATE OR REPLACE FUNCTION public.apply_project_update_transaction(...)` — same six-argument signature, `SECURITY INVOKER`, same grants; with the row-bound `set_config` call inserted immediately before the existing step-14 applied-status UPDATE, and the closure block inserted immediately before the final return (§8); everything else preserved verbatim.
3. `CREATE OR REPLACE FUNCTION public.set_share_message_status(...)` with the `SHARE_MESSAGE_STATUS_TERMINAL` check from §10 added.
4. **Only after all three safety mechanisms above exist**: `CREATE OR REPLACE FUNCTION public.enforce_project_update_client_share_apply_boundary()` — narrowing the condition so `applying` is no longer blocked and an *entering* transition into `applied` is permitted only when the transaction-local capability matches the exact row id (§6). **The trigger itself, `project_updates_enforce_client_share_apply_boundary`, is kept installed throughout — it is never `DROP`ped, and neither is its function.**

**No transient unsafe ordering**: if this migration is manually pasted into a SQL client (this engagement's own established reality for disposable-project verification) and execution is interrupted after step 3 but before step 4, the system remains **safe** — client_share is still blocked from `applying`/`applied` by the still-present, still-unmodified Phase 6B trigger body, while the new closure logic sits ready but inert (the still-old trigger body would reject the RPC's own attempt to reach `applied`, causing the whole Apply transaction to roll back cleanly — a hard failure, not a silent gap). The reverse — narrowing or removing the boundary before the closure logic and capability check exist — would reopen exactly the hole this correction closes, even transiently, and must never be used.

**No historical migration is edited** — `202607270001`, `202608210001`, and `202608230001` all remain exactly as they are; this is a wholly new file.

---

## 13. Large RPC drift-protection strategy

**Corrected by a final pre-implementation source-provenance review.** The original design (superseded) incorrectly implied `apply_project_update_transaction` and `set_share_message_status` could both be sourced from `202607270001_project_completion_reconciliation.sql`. That migration defines only `apply_project_update_transaction` (plus `reconcile_project_completion`/`apply_task_bulk_status_transaction`) — `set_share_message_status` has never been defined there; its sole authoritative source is `202608190001_client_share_message_owner_rpcs.sql`. Phase 6C also now modifies a third existing function, `enforce_project_update_client_share_apply_boundary` (§6), authoritatively sourced from `202608230001_client_share_apply_boundary.sql`. The generator must read each function from its own correct, independent authoritative migration — never substitute one migration's text for another's.

`apply_project_update_transaction`'s body is roughly 875 lines across five historical generations. Hand-retyping any of these three existing functions for Phase 6C's migration is explicitly rejected as an unacceptable drift risk. The accepted approach, extending the exact discipline already used and proven for the Phase 6B RPC-prerequisite package's own truncation logic:

**Proposed generator**: `scripts/client-share/build-phase6c-apply-conversion-closure-migration.ps1`, reading **three independent authoritative historical sources** plus one new, deliberately-authored template — never conflating any of the four.

### A. Apply RPC source — `202607270001_project_completion_reconciliation.sql`

- Extracts and preserves `apply_project_update_transaction` from this file, and only this file — never a hand-copied version, never sourced from any other migration.
- Inserts, via **deterministic, anchor-based text insertion only**: the row-bound `set_config` block immediately before the existing step-14 `UPDATE project_updates SET status='applied'` statement, and the final conversion-closure block (the `finalize_share_message_conversion` call) immediately before the existing final `return jsonb_build_object('update', to_jsonb(v_final_update), ...)` (§7/§8) — never a hand-retyped reconstruction of the surrounding body.
- **Fails closed** (throws, writes nothing) if either expected anchor is missing or has moved.
- **Reconstruction/hash proof**: after inserting both new fragments, the generator programmatically strips them back out and asserts the remainder is byte-identical (SHA-256 match) to the original, unmodified `apply_project_update_transaction` body extracted from `202607270001` — proving the new migration changed *only* what it intended to in this function, nothing else, mechanically rather than by inspection.

### B. Message status RPC source — `202608190001_client_share_message_owner_rpcs.sql`

- Extracts and preserves `set_share_message_status` from this file, and only this file. **Do NOT source or reconstruct this function from `202607270001`** — it has never been defined there.
- Inserts, via the same anchor-based insertion discipline: the current-status load (extending the existing `SELECT ... FOR UPDATE`) and the `SHARE_MESSAGE_STATUS_TERMINAL` guard (§10), placed before any status mutation is computed or applied.
- **Reconstruction/hash proof**: after stripping the inserted load/guard back out, the remainder must be byte-identical (SHA-256 match) to the original, unmodified `set_share_message_status` body extracted from `202608190001` — proving every other existing behavior in this function is untouched.

### C. Phase 6B boundary source — `202608230001_client_share_apply_boundary.sql`

- Extracts and preserves `enforce_project_update_client_share_apply_boundary` from this file, and only this file.
- Modifies **only** the function's predicate, per §6: `applying` is no longer blocked; an *entering* transition into `applied` is permitted only when the transaction-local capability matches the exact row id; an already-`applied` → already-`applied` ordinary (non-status) update remains permitted without the capability.
- **Reconstruction/hash proof**: after removing the modified predicate, the generator confirms nothing else in the function (its `security invoker`, `search_path`, structure, or any other clause) changed versus the original extracted from `202608230001`.
- The existing trigger declaration (`project_updates_enforce_client_share_apply_boundary ... before insert or update ...`) itself remains authoritative and is **not** recreated unnecessarily — only the function body is `CREATE OR REPLACE`d (§12) — unless migration mechanics actually require redeclaring the trigger, which is not expected.

### D. New helper — `finalize_share_message_conversion`

This is a **new** Phase 6C function with **no historical source to preserve or reconstruct** — it may be generated from a deliberately-authored Phase 6C template (§7), since there is no prior authoritative version to hash-verify against. Its source must still be fully deterministic (the generator writes it identically on every run) and fully covered by static tests (§14), same as the three reconstructed functions.

A companion static test file asserts every existing behavior-defining fragment is still present verbatim in the reconstructed functions: for `apply_project_update_transaction` — the client-detail JSON-path (`#>`) fixes, the `priority_source = 'user'` provenance write, the `reconcile_project_completion` call, and every existing error code (`APPLY_ATTEMPT_MISMATCH`, `PROJECT_NOT_FOUND`, `TARGET_TASK_VALIDATION_FAILED`, etc.); for `set_share_message_status` and `enforce_project_update_client_share_apply_boundary` — their own respective existing behavior-defining fragments — plus, for all three, the current function signature, security mode (`SECURITY INVOKER`), and grant statements, unchanged.

---

## 14. Required static tests

The new migration's `.test.ts` file must assert, at minimum:

- `apply_project_update_transaction`'s signature is unchanged (same six arguments, same types).
- `apply_project_update_transaction` remains `SECURITY INVOKER`.
- `authenticated` `EXECUTE` grant on `apply_project_update_transaction` is preserved, unchanged.
- `finalize_share_message_conversion` is `SECURITY DEFINER`.
- `finalize_share_message_conversion` has an explicit, locked `search_path` (`set search_path = public, pg_temp`).
- `finalize_share_message_conversion`'s own direct grants are minimized/revoked from `public`/`anon`, matching the established sibling-RPC pattern, granting `EXECUTE` only to `authenticated`.
- `finalize_share_message_conversion` derives its actor from `auth.uid()` and rejects when it is null.
- Both `project_updates` and `share_messages` are locked (`FOR UPDATE`) inside the helper before any write.
- Source/project/author-type checks are present exactly as specified in §7 (owner match, `source_type='client_share'`, `source_share_message_id=p_message_id`, `author_type='client'`, project match).
- `share_message_conversions_message_id_unique` behavior is unaffected/still relied upon (no new duplicate-permitting path introduced).
- `reviewed_at = COALESCE(reviewed_at, now())` semantics for conversion, asserted textually.
- `resolved_at` is never referenced by the new closure/helper code (source-scan negative assertion).
- The new `SHARE_MESSAGE_STATUS_TERMINAL` guard is present in `set_share_message_status`, checked before any status mutation.
- No new table, no new column, anywhere in this migration (source-scan negative assertion).
- Every historical RPC fragment listed in §13 is preserved verbatim.

**Added by the second security audit — the boundary trigger is corrected in place, not dropped:**

- `project_updates_enforce_client_share_apply_boundary` (the trigger itself) still exists after this migration and is **not** the target of any `DROP TRIGGER` statement (structural negative assertion — this replaces the old, now-incorrect assertion that it is absent).
- `enforce_project_update_client_share_apply_boundary()` (the function) still exists and is **not** the target of any `DROP FUNCTION` statement — it is targeted only by `CREATE OR REPLACE FUNCTION`.
- The trigger function's new body no longer rejects `status = 'applying'` for `client_share` rows (source-scan/behavioral assertion — `applying` is permitted unconditionally now).
- The trigger function's new body still rejects an unauthorized *entering* transition into `status = 'applied'` for `client_share` rows (i.e., `old.status is distinct from 'applied'`, or `tg_op = 'INSERT'`, combined with a missing/mismatched capability).
- Direct INSERT of a `client_share` row already at `status = 'applied'`, with no capability set, remains rejected.
- An otherwise-legal, non-status update to a row that is already `client_share` + `applied` and remains `applied` does **not** require the capability to be set (source-scan/behavioral assertion that the guard is scoped to the entering transition only, not every future write).
- The exact custom GUC name `text2task.client_share_apply_update_id` appears in both the trigger function body and `finalize_share_message_conversion`'s body (source-scan assertion — not a different or abbreviated name).
- Every `set_config` call for this GUC uses `is_local = true` (source-scan assertion — never `false`/omitted, which would leak the setting past the current transaction).
- The `set_config` value passed by `apply_project_update_transaction` is `p_update_id::text` (source-scan assertion — the row-bound id, not a boolean/string literal like `'true'`/`'on'`).
- The `set_config` call inside `apply_project_update_transaction` appears strictly before the existing step-14 `UPDATE project_updates SET status='applied'` statement in source order (source-scan/anchor-position assertion).
- `finalize_share_message_conversion`'s capability check compares `current_setting('text2task.client_share_apply_update_id', true)` against `p_project_update_id::text` (source-scan assertion — the exact comparison, not merely "some check exists").
- No boolean-only, non-row-bound transaction flag (e.g. a bare `'on'`/`'true'` value with no id comparison) is used anywhere in the new capability mechanism (source-scan negative assertion, directly targeting the original, superseded generic-GUC design).

**Added by the final source-provenance review — each reconstructed function must be verified against its own correct, independent authoritative migration, per the corrected §13:**

- `apply_project_update_transaction` in the new migration is reconstructed from, and SHA-256/reconstruction-verified against, `202607270001_project_completion_reconciliation.sql` — and **not** any other migration.
- `set_share_message_status` in the new migration is reconstructed from, and SHA-256/reconstruction-verified against, `202608190001_client_share_message_owner_rpcs.sql` — explicitly **not** `202607270001` (negative assertion: the generator must not silently source this function from the wrong file).
- `enforce_project_update_client_share_apply_boundary` in the new migration is reconstructed from, and SHA-256/reconstruction-verified against, `202608230001_client_share_apply_boundary.sql`.
- Each of these three reconstruction proofs is independent — a passing proof for one function must not be treated as evidence for another; the test file asserts all three separately.
- `finalize_share_message_conversion` has no historical-source assertion (it is new, §13.D) but is still covered by the deterministic-output and behavioral assertions already listed above.

---

## 15. Required disposable runtime matrix

Future package: `docs/client-share-phase6c-runtime/` (a new, separate package — extending the established pattern from `docs/client-share-phase6a-runtime/` and `docs/client-share-phase6b-runtime/`, not modifying either).

**SUCCESS**: a real client_share Analyze result reaches `analyzed`; claim to `applying`; the Apply RPC succeeds; the accepted work mutation is committed; the timeline event is committed; a `share_message_conversions` row exists; the message is `converted`; the `project_update` is `applied`; all timestamps/relationships (`converted_at`, `reviewed_at`, `project_update_id` on the conversion row) are correct and mutually consistent.

**ATOMIC FAILURE**: force the conversion INSERT to fail after the work-mutation path has already begun → the entire transaction, including the already-executed work mutation, rolls back; force the `share_messages` converted UPDATE to fail → the entire transaction, including the conversion insert and the work mutation, rolls back.

**TERMINALITY**: `converted → new` rejected; `converted → reviewed` rejected; `converted → resolved` rejected; `converted → dismissed` rejected (all four, via `set_share_message_status`, with `SHARE_MESSAGE_STATUS_TERMINAL`); Analyze against an already-converted source rejected (via Phase 6A's existing immutability/uniqueness guarantees — regression, not new); Apply against the same converted source cannot execute a second time.

**IDEMPOTENCY**: duplicate Apply attempt produces no second work mutation; a replay of the same `apply_attempt_id` after success is rejected; a stale `apply_attempt_id` is rejected; the `share_message_conversions` unique constraint is the final backstop against a duplicate conversion row from any path.

**PROVENANCE**: wrong-owner `project_update`/`share_message` pairing rejected; wrong-project pairing rejected; an owner-authored (non-client) source message rejected; the source message body remains immutable (regression against Phase 6A); `project_updates.source_type`/`source_share_message_id` remain immutable (regression against Phase 6A).

**HISTORY**: a retained client message on a revoked/disabled/expired link, whose project is still live (`deleted_at is null`), can still be Applied successfully — an explicit positive test, not merely an absence-of-restriction assumption.

**REGRESSION**: text Apply behavior unchanged; image Apply behavior unchanged; existing priority-provenance write unchanged; existing completion reconciliation unchanged; the full Phase 6A provenance runtime suite still passes; the full Phase 6B Analyze/idempotency runtime suite still passes.

**CAPABILITY / FORGERY — added by the second security audit; these mandatory tests exist specifically to prove the standalone-helper attack the audit found is now closed:**

- **A.** Authenticated raw UPDATE, `analyzed` client_share → `applied`, without the capability set → **EXPECTED REJECT** (corrected §6 trigger).
- **B.** Authenticated direct INSERT of a `client_share` row already at `status='applied'`, without the capability set → **EXPECTED REJECT**.
- **C.** Authenticated standalone call to `finalize_share_message_conversion(...)` against a normal, still-`analyzed` row → **EXPECTED REJECT** with the capability-context error.
- **D.** Even if test-harness privileged setup fabricates a `client_share` row that already reads `status='applied'` without ever running the real Apply RPC: a standalone call to `finalize_share_message_conversion` against it → **EXPECTED REJECT** with the capability-context error. This is the test that most directly proves the originally-found attack is closed.
- **E.** Legitimate Apply RPC: sets the capability for the exact update id → the `applied` transition succeeds → the helper call succeeds → the conversion commits. (Positive-path confirmation, not merely absence of rejection.)
- **F.** A capability minted for update A cannot authorize the `applied` transition or the helper call for update B (row-bound, not global — direct test of the "row-bound, not boolean" design decision).
- **G.** After a transaction commits, a new, separate standalone-helper transaction has no capability available → **EXPECTED REJECT**.
- **H.** After a transaction rolls back, a new transaction has no leaked capability from the rolled-back attempt.

**APPLYING — added by the second security audit:**

- **I.** A raw authenticated `client_share` transition `analyzed → applying` is **no longer rejected** by the corrected Phase 6C boundary (confirms `applying` was correctly un-blocked, not merely "still blocked but nobody noticed").
- **J.** A direct call to the real Apply RPC after reaching `applying` (however reached) plus a matching `apply_attempt_id` only ever succeeds through the RPC's own full, independent validation/mutation/closure pipeline — it never short-circuits based on how `applying` was reached.

**APPLIED — EXISTING ROW — added by the second security audit:**

- **K.** A legitimate, already-`applied` `client_share` row may receive an otherwise-legal non-status update without the boundary treating `NEW.status = 'applied'` alone as an unauthorized entering transition (confirms the guard is scoped to *establishing* `applied`, not every future write to an already-applied row).

---

## 16. Required application tests

- The client_share review UI now shows and allows the normal "Save N changes" action (inverse of the existing Phase 6B test that proved it hidden).
- `POST /api/project-updates/apply` no longer returns the Phase 6B `409 project_update_source_not_appliable` for a client_share update (inverse of the existing Phase 6B test).
- Normal (text/image) Apply API/UI behavior is unchanged — direct regression.
- A converted message hides: the "Analyze as client update" action (already covered, re-confirm as regression), "Mark reviewed", "Resolve", "Dismiss".
- **Reply remains available** on a converted message — an explicit positive test proving the locked §11 decision holds, not merely an absence of a new restriction.
- The existing Client Update review modal/state machine is reused, not duplicated (source-scan boundary test, matching this engagement's established convention).
- No new Apply API endpoint exists (source-scan boundary test).

---

## 17. Expected implementation files

**NEW**:
- `supabase/migrations/202608240001_client_share_apply_conversion_closure.sql` (or the actual implementation date)
- Its migration static test (`.test.ts`)
- `scripts/client-share/build-phase6c-apply-conversion-closure-migration.ps1` (deterministic generator — a single script that reads and reconstructs from all three independent authoritative historical sources per the corrected §13: `202607270001` for `apply_project_update_transaction`, `202608190001` for `set_share_message_status`, `202608230001` for `enforce_project_update_client_share_apply_boundary` — plus the new, template-authored `finalize_share_message_conversion`; no separate generator file per function)
- `docs/client-share-phase6c-runtime/` (disposable runtime package)
- `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6C_IMPLEMENTATION_REPORT_<date>.md`

**MODIFIED**:
- `app/api/project-updates/apply/route.ts` (remove the Phase 6B client_share rejection)
- `app/api/project-updates/apply/route.test.ts`
- `app/components/dashboard/tasks/project-updates/project-update-shell.tsx` (remove the Phase 6B `canApply` gate)
- `app/components/dashboard/tasks/project-updates/project-update-shell.test.tsx`
- `app/components/dashboard/tasks/share-link/client-communication-history-modal.tsx` (add the terminal status-button gate; leave Reply untouched)
- `app/components/dashboard/tasks/share-link/client-communication-history-modal.test.tsx`

**No new route. No new modal. No new database table or column.**

---

## 18. Risks and explicit accepted boundaries

1. **The `SECURITY DEFINER` helper (`finalize_share_message_conversion`) is the single highest-risk artifact in this slice** and requires the strongest runtime verification of anything in Phase 6C — it must be implemented and tested exactly as the independent-boundary design in §7, never assuming trusted-caller context.
2. **Large-RPC reproduction drift must be guarded mechanically** (hash/reconstruction proof, §13) — not by manual review alone.
3. **New lock-order discipline**: `finalize_share_message_conversion` locks `share_messages` for the first time this RPC has ever locked it. The established, and now binding, order is **`project_updates` before `share_messages`** (matching the order the closure block itself uses, and consistent with every existing lock this RPC already takes in the order `project_updates → projects → clients → tasks → project_update_items`). Any future code that ever needs to lock both tables together must preserve this relative order, or a real deadlock risk is introduced where none exists today.
4. **`project_updates` still has a broad, unrestricted `authenticated` RLS UPDATE policy** (a pre-existing characteristic, documented by Phase 6A's own audit — correction H) — this remains true regardless of Phase 6C. **This risk was formally investigated by a second, final pre-implementation security audit and CONFIRMED as a live Phase 6C atomicity blocker under the original design**: fully dropping the Phase 6B boundary trigger, combined with the originally-proposed helper's "mutual exclusion in time" proof, would have let an owner raw-UPDATE their own client_share row directly to `status='applied'` (zero real work) and then call the then-standalone-callable `finalize_share_message_conversion` directly — every one of its originally-proposed checks would have passed, fabricating a real `share_message_conversions` row and `share_messages.status='converted'` with no real Apply. Unlike the equivalent pre-existing text/image risk (where forging `status='applied'` today has no further privileged consequence — nothing reads that label to trigger anything else), this would have been a **new** privileged conversion side effect reachable through that pre-existing gap. Verdict at the time: `PHASE_6C_PLAN_SECURITY_BLOCKED`.

   **This blocker is RESOLVED IN DESIGN**, not merely noted, by the corrections now reflected throughout §6–§9 and §12 of this document: the Phase 6B boundary trigger is retained (never dropped) and narrowed to protect exactly the *entering* `applied` transition, gated on a transaction-local, row-bound capability (`text2task.client_share_apply_update_id`, §7) that only `apply_project_update_transaction` itself can ever set, immediately before its own authoritative `applied` write (§8); `finalize_share_message_conversion` independently requires the same capability before any write, closing the standalone-invocation path even if `project_updates.status='applied'` is ever forged by other means. `applying` is deliberately left unblocked, since a forged `applying` state cannot produce an unearned conversion — the RPC always independently re-validates and performs the real work regardless of how `applying` was reached (§9).

   **Runtime acceptance must explicitly prove the attack is closed, not merely that the happy path works** — see §15's new CAPABILITY / FORGERY test category (tests A–H), particularly test D (a fabricated already-`applied` row rejected by the standalone helper). Do not accept Phase 6C's implementation report as complete unless these specific tests exist and pass. The broader fact that `project_updates` has wide `authenticated` UPDATE access remains true as a pre-existing table-level characteristic — it is not "fixed" by this migration — but it is no longer an unmitigated Phase 6C atomicity risk once these tests pass.
5. **Converted status does not prohibit future Reply** — locked in §11; do not reintroduce a Reply restriction as an incidental side effect of the terminality work.
6. **No Apply response expansion** unless required by concrete implementation evidence — locked in §11.

---

## 19. Explicit non-goals

Phase 6C does **not** include:

- Manual task conversion (deferred indefinitely, per the Accepted Plan's own §4.17).
- A second analyzer.
- A second review UI/modal/state machine.
- A second Apply route.
- Switching any part of this flow to a `service_role` client.
- Any change to the public `/share/**` surface (client-facing pages/APIs).
- Any change to share-link state semantics (active/disabled/expired/revoked eligibility rules).
- Inventing a project-level "archived" restriction (there is none today — `projects.deleted_at` remains the sole mutability gate, per the Accepted Plan's §4.16).
- New analytics/tracking events.
- Any Phase 6D work.

---

## 20. Implementation sequence

1. Start from clean `main @ 0b10e61`.
2. Generate the Phase 6C migration deterministically via the new generator script (§13), reconstructing `apply_project_update_transaction` from `202607270001`, `set_share_message_status` from `202608190001`, and `enforce_project_update_client_share_apply_boundary` from `202608230001` — each from its own correct, independent authoritative source — plus the new, template-authored `finalize_share_message_conversion` — never hand-authored, never sourced from the wrong migration.
3. Write and run the migration's static tests (§14).
4. Implement the application code changes (§17's MODIFIED list).
5. Write and run focused tests for each changed file.
6. Run the full relevant regression sweep (Client Share + Client Update suites).
7. `npx tsc --noEmit`.
8. Build the disposable Phase 6C runtime package (§15), extending the established pattern — do not run it yet.
9. **The user manually applies the required SQL — this new migration, plus the existing prerequisite chain — ONLY to the disposable Supabase project. Never Production.**
10. Disposable-project runtime verification must report a full **PASS** (matching the exact category list in §15) before proceeding.
11. **The user runs the full production build** (a user-owned action, matching every prior phase of this engagement).
12. Final `git diff`/`git status` review.
13. **The user commits** (not implied by any step above).
14. Production rollout remains a **separate, later, explicitly-requested checkpoint** — not implied by a passing disposable-runtime result or a passing local build.
15. **Phase 6D remains unauthorized** until Phase 6C is explicitly accepted by the user.

---

## 21. Current stop point

```
CURRENT STOP POINT
==================

Phase 6A: COMPLETE / ACCEPTED
Phase 6B: COMPLETE / ACCEPTED
Phase 6C: DESIGN READY AFTER SECURITY CORRECTION — NOT IMPLEMENTED
Phase 6D: NOT AUTHORIZED

HEAD:
0b10e61

SECURITY CORRECTION:
A second, final pre-implementation security audit found the original
Phase 6C helper design vulnerable to a forged-'applied' standalone-
invocation attack (verdict: PHASE_6C_PLAN_SECURITY_BLOCKED). The
corrected design — Phase 6B boundary trigger RETAINED and narrowed,
not dropped; transaction-local row-bound capability
(text2task.client_share_apply_update_id); helper independently requires
that capability — is now reflected in this document (see sections 6-9,
12, 14, 15, 18). No SQL, migration, generator, or application code has
been written for either the original or corrected design.

NEXT AUTHORIZED ACTION:
Phase 6C implementation ONLY after explicit user approval.

PRODUCTION:
202608230001 Phase 6B boundary migration NOT yet applied.
Phase 6C migration does not exist yet.
No deploy/push authorized.

This plan document itself remains uncommitted unless the user later asks.
```
