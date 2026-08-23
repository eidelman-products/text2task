# Text2Task Client Share Link — Phase 6B Implementation Report

**Date:** 2026-08-21
**Scope:** Phase 6B only — explicit server-authorized Analyze + existing Client Update review reuse, exactly as scoped in `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6_ACCEPTED_PLAN_2026-08-21.md`, **corrected** after a final read-only acceptance audit found three blockers in the original implementation.
**PHASE 6C NOT AUTHORIZED. NO APPLY / NO CONVERTED CLOSURE.**

---

## 1. Starting checkpoint

- `main @ 70f2858` — "Complete Client Share Phase 6A provenance foundation"
- Phase 6A: COMPLETE / ACCEPTED (prior runtime-verified, unaffected by this turn)
- The application-layer correction pass (§2–§16 below) required no new migration. A **separate, later correction** (§20 "DB Apply Boundary") did require and add exactly one new migration, `supabase/migrations/202608230001_client_share_apply_boundary.sql` — see that section for the full design audit and implementation.

## 2. Final acceptance-audit blockers discovered (before this correction)

A read-only audit of the first Phase 6B implementation, tracing the real Apply route/RPC and the real concurrency behavior of the original `share-message-conversion.server.ts`, found three confirmed blockers:

1. **PHASE_BOUNDARY_BLOCKER** — `POST /api/project-updates/apply` and `apply_project_update_transaction` had no awareness that `client_share` `project_updates` rows exist. The existing "Save N changes" Apply action was fully visible/enabled for a client_share analysis, and both the Next.js route and the RPC would process it, producing real task/project mutation with no `share_message_conversions` trace and no `share_messages.status='converted'` — exactly the Phase 6C-only behavior this program is structured to prevent.
2. **CONCURRENCY_BLOCKER** — the original algorithm ran the full AI pipeline (`loadProjectUpdateContext` → `extractProjectUpdateFacts` → `judgeProjectUpdateFacts`) *before* any `project_updates` row existed, relying only on Phase 6A's unique index to arbitrate the final INSERT. Two simultaneous first-time requests both ran a full concurrent AI analysis. Because the row was inserted at `status='analyzed'` with items added in a *separate*, later statement, a losing request could observe the winner's still-in-progress row (`status='analyzed'`, zero items yet) and misclassify it as abandoned — racing item deletion/insertion and `ai_summary`/`analyzed_at` writes on the same row with no locking.
3. **STATUS_BLOCKER** — the root cause of #2: the retry-branch condition `RETRYABLE_STATUSES.has(status) || existing.itemCount === 0` was independent of status, so it could also route `applying`/`applied` rows (with zero items, an edge state) into a reanalysis, violating the locked "applying/applied must never be mutated in Phase 6B" invariant.

Full detail of the audit's evidence trail is preserved in the conversation record; this report documents the corrections made in response.

## 3. Exact corrections implemented

| # | Correction | Summary |
|---|---|---|
| 1 | Apply must be impossible in 6B | New server hard guard in `/api/project-updates/apply` + UI boundary in the existing review shell |
| 2 | Reservation before AI | `project_updates` row is INSERTed at `status='draft'` *before* any AI call; ownership of that INSERT (or an atomic claim UPDATE) is the sole authorization to run AI |
| 3 | Structured unique handling | `dbErrorCode` (raw Postgres `error.code`) threaded through; 23505 + exact constraint name + reselected winner required before ever treating a failure as "expected race" |
| 4 | Status is authoritative | Item count no longer participates in any branching decision at all |
| 5 | Retries have single ownership | Atomic compare-and-set claim (`WHERE status = 'failed'/'ignored' → 'draft'`) before a retry may run AI |
| 6 | Analysis into the reserved slot | `analyzeProjectUpdateV2` (INSERT-after-AI) is no longer called for client_share at all; its own constituent building blocks are composed directly against the already-owned row |
| 7 | IN_PROGRESS response | New `state: "ready" \| "in_progress"` discriminant on the service/route/UI contract |
| 8 | Zero-item analyses | Confirmed a legitimate analysis can produce zero items (see §7 below) — this is not evidence of anything and never triggers retry |

## 4. Exact files created (this correction)

- `lib/project-updates/project-update-audit.server.test.ts` — new, targeted coverage for `dbErrorCode` propagation and `markProjectUpdateAsFailed`
- `app/api/project-updates/apply/route.test.ts` — new, the Apply-boundary guard tests (no prior test file existed for this route)
- `app/components/dashboard/tasks/project-updates/project-update-shell.test.tsx` — new, the UI Apply-boundary tests (no prior test file existed for this component)

## 5. Exact files modified (this correction)

- `lib/share/share-message-conversion.server.ts` — **full rewrite** of the operational-idempotency algorithm (reservation-first; see §8 below)
- `lib/share/share-message-conversion.server.test.ts` — **full rewrite**: 22 tests covering reservation-first ordering, deterministic barrier-based simultaneous-request tests, atomic retry-claim concurrency, the corrected status matrix, and structured-23505 handling
- `lib/project-updates/project-update-audit.server.ts` — added `dbErrorCode?: string | null` to `AuditWriteResult`'s failure shape; `createProjectUpdateAuditRecord` now propagates `error?.code`; added new exported `markProjectUpdateAsFailed(projectUpdateId)` (best-effort, guarded to only transition a row it finds in `status='draft'`)
- `app/api/project-updates/apply/route.ts` — added the server hard guard (see §6)
- `app/components/dashboard/tasks/project-updates/project-update-shell.tsx` — added the UI Apply-boundary gate (see §6)
- `app/components/dashboard/tasks/project-updates/project-update-types.ts` — widened the **local UI** `ProjectUpdateSourceType` to include `'client_share'` (it was still `"text" | "image" | "email" | "manual"`, an oversight from the original Phase 6B turn that made the UI guard's own `source_type` comparison a TypeScript compile error — this is the smallest fix that makes the type system agree with the feature's own stated intent)
- `app/api/share-links/[id]/messages/[messageId]/analyze/route.ts` — response now carries the `state` discriminant (`"ready"` vs. `"in_progress"`); the `"in_progress"` branch returns `{ok:true, state:"in_progress", projectUpdateId}` and nothing else
- `app/api/share-links/[id]/messages/[messageId]/analyze/route.test.ts` — updated the success-shape assertion for the new `state` field; added an `IN_PROGRESS` describe block (2 tests)
- `app/components/dashboard/tasks-view.tsx` — `handleAnalyzeShareMessage` now branches on `payload.state`; `"in_progress"` is surfaced through the modal's existing inline-error slot ("This message is already being analyzed. Try again in a moment.") rather than opening the review modal with an empty/incomplete result

`analyzeProjectUpdateV2` itself (`lib/project-updates/v2/project-update-v2-analyzer.server.ts`) and its own discriminated-union input type are **unchanged by this correction** — they remain correct in isolation (exact-rawInput persistence, no-timeline-event for client_share) and are still covered by their own tests, but `share-message-conversion.server.ts` no longer calls this function for client_share at all (see §8) because its own shape — INSERT happens only after AI completes — is exactly the concurrency hole being corrected.

## 6. Final Apply boundary implementation

**A. Server hard guard** (`app/api/project-updates/apply/route.ts`), placed immediately after `loadProjectUpdateForApply` succeeds and *before* the pre-existing status check, `claimProjectUpdateForApply`, or `apply_project_update_transaction`:

```ts
if (loaded.update.source_type === "client_share") {
  return NextResponse.json(
    { ok: false, code: "project_update_source_not_appliable", error: "..." },
    { status: 409, headers: dashboardTasksNoStoreHeaders }
  );
}
```

`source_type` is read from `loaded.update` — the authoritative DB row `loadProjectUpdateForApply` itself just SELECTed — never anything the browser could supply. Proven by `route.test.ts`: a client_share update is rejected with 409 before `rpc()`/the claim UPDATE are ever touched (and before any `tasks`/`project_timeline_events` table access); a text/image update with an *invalid* status still reaches the pre-existing status-check error unchanged, proving the new guard is a true no-op for non-client_share sources rather than accidentally altering their behavior.

**B. UI boundary** (`app/components/dashboard/tasks/project-updates/project-update-shell.tsx`):

```ts
const isClientShareResult = form.analysisResult?.update.source_type === "client_share";
const canApply = /* ...existing conditions... */ && !isClientShareResult && hasSelectedApplyableItems(form);
```

When `canApply` is false and an `analysisResult` exists, the existing (unmodified) `getPrimaryButtonState` already falls back to a "Close" primary button — no new UI state, no second review component. The review card (suggested items, checkboxes) still renders normally; only the ability to submit Apply is gated. This is convenience/UX only — the server guard above is the actual authority. Proven by `project-update-shell.test.tsx`: a client_share result with a selected, applyable item shows "Close" (never "Save N changes") while an identical text/image result is completely unaffected, and the review card's item content remains visible for client_share.

## 7. RPC direct-execution grant finding

Inspected `supabase/migrations/202606150008_transactional_project_update_apply.sql` directly:

```sql
revoke all on function public.apply_project_update_transaction(...) from public;
revoke all on function public.apply_project_update_transaction(...) from anon;
grant execute on function public.apply_project_update_transaction(...) to authenticated;
```

The function is `security invoker`. **`authenticated` does have a direct EXECUTE grant**, and Supabase's client SDKs call PostgREST's `/rest/v1/rpc/...` endpoint directly using the caller's own session JWT — this does **not** route through our Next.js server at all. This means any authenticated Text2Task user could, in principle, call `apply_project_update_transaction` directly (via `supabase.rpc(...)` in browser devtools, or a raw HTTP request carrying their own session), completely bypassing `/api/project-updates/apply` and therefore bypassing the new server hard guard in §6A.

Per this turn's explicit instruction, **no migration was created or modified** to close this specific DB-level gap (revoking/narrowing the `authenticated` grant, or adding a `source_type` check inside the SQL function itself, would each require a new, separately authorized migration). This is reported as a **DB-BOUNDARY finding requiring a future authorized migration** — it is not fixed in this turn. The server hard guard (§6A) and UI boundary (§6B) were still implemented regardless, because they fully close the primary, documented, intended call path (this app's own API), reduce real risk today, and require no migration — but they are not a complete closure of the Apply boundary while the RPC's own grant remains this broad. This is the single most important unresolved item carried out of this correction; see §14 "known limitations."

## 8. Exact reservation-first algorithm

Implemented in `lib/share/share-message-conversion.server.ts` (`convertShareMessageToClientUpdate`):

1. `loadShareMessageForConversion` — unchanged: authorizes link/message/project ownership and `author_type='client'`, loads the exact `share_messages.body`.
2. `findExistingSlot` — reads any existing `project_updates` row for this `source_share_message_id` + `user_id`, plus its item count.
3. **No existing slot** → `reserveAndAnalyzeFreshSlot`: calls `createProjectUpdateAuditRecord({..., sourceType:"client_share", sourceShareMessageId, status:"draft"})` — the SAME persistence function Phase 6A/6B already use, now called with **no AI having run yet**. `source_type`, `source_share_message_id`, and `raw_input` (the exact server-loaded body) are written in this single INSERT, from the row's very first moment of existence.
   - **INSERT succeeds** → this request is the sole owner of the reservation; it alone calls `analyzeIntoReservedSlot`.
   - **INSERT fails** → `handleReservationConflict` (§10 below).
4. **Existing slot found** → `handleExistingSlot`, branching purely on `status` (§9 below; item count plays no role).
5. `analyzeIntoReservedSlot` — the ONLY place AI runs for client_share. Composes `loadProjectUpdateContext` → `extractProjectUpdateFacts` → `judgeProjectUpdateFacts` → `buildProjectUpdateV2AuditSummary`/`Items` → (delete-then-insert) `createProjectUpdateAuditItems` → `markProjectUpdateAsAnalyzed` (an UPDATE touching only `status`/`ai_summary`/`analyzed_at`). Wrapped in a try/catch: any handled failure or thrown exception calls the new best-effort `markReservationFailed` (→ `markProjectUpdateAsFailed`, itself guarded to only transition a row it finds in `status='draft'`) before returning the error, so a later explicit request can retry via the normal failed-status claim path (§11).

`analyzeProjectUpdateV2` — the pre-existing function whose own shape is INSERT-after-AI — is **never called** by this file for client_share any more. It remains unchanged and still correctly implements its own contract (exact rawInput, no timeline event) for whichever caller might still use it in isolation; its own tests continue to document that contract.

## 9. Exact simultaneous first-request sequence (after correction)

Verified by a **deterministic deferred/barrier test** (`share-message-conversion.server.test.ts`, "simultaneous first requests" describe block):

1. Request A starts, reaches `findExistingSlot` (sees nothing), reaches `reserveAndAnalyzeFreshSlot`, its INSERT wins (the row now exists at `status='draft'`), and A proceeds into `analyzeIntoReservedSlot`, where a barrier holds it *inside* `extractProjectUpdateFacts` (proving A has already won ownership and is now the sole in-flight AI call).
2. Request B starts **only now** (strictly after A's reservation row already exists, strictly before A has finished analyzing it). B's `findExistingSlot` sees A's row at `status='draft'`.
3. B's `handleExistingSlot` sees `status === 'draft'` and returns `{ok:true, state:"in_progress", projectUpdateId: <A's row id>}` **immediately** — B never calls `extractProjectUpdateFacts`, never calls `createProjectUpdateAuditItems`, never calls `markProjectUpdateAsAnalyzed`.
4. The barrier is released; A finishes, transitions its row to `status='analyzed'`, and returns `{ok:true, state:"ready", resumed:false, ...}`.
5. Assertions: `extractProjectUpdateFactsMock` was called **exactly once** (only by A) across the whole sequence; exactly one `project_updates` row ever existed.

A second, separate test proves the complementary case explicitly required by this correction: a request that arrives **after** the winner has already fully completed (not concurrently) resumes `state:"ready"` with `resumed:true` and calls no new AI — i.e. "loser returns READY if winner completed before reselect, otherwise IN_PROGRESS for the same id" is proven both ways.

## 10. Exact simultaneous retry sequence (after correction)

For an existing `failed`/`ignored` row, `claimRetryableSlot` performs a compare-and-set UPDATE: `WHERE id=<slot> AND user_id=<caller> AND status=<expected retryable status> → status='draft'`, `.select("id").maybeSingle()`. Verified by a test (parametrized over `failed`/`ignored`) that runs two genuinely concurrent retry attempts via `Promise.all` against a shared in-memory store that enforces this WHERE-matched mutation synchronously:

- Exactly one of the two concurrent calls' UPDATE matches (`status` still equals the expected value) and wins the claim — that request alone proceeds into `analyzeIntoReservedSlot` and runs AI.
- The other's UPDATE matches zero rows (the status has already changed); it never runs AI, re-selects via `findExistingSlot`, and — since the winner's row is now `status='draft'` — returns `state:"in_progress"` for the same id.
- Assertion: `extractProjectUpdateFactsMock` called **exactly once** across both concurrent calls; exactly one `project_updates` row exists throughout (never a second INSERT — the retry is always an UPDATE onto the same id).

## 11. Final status matrix

| Status | Item count | Outcome | Locked requirement satisfied |
|---|---|---|---|
| `analyzed` | any (including 0) | **resume, READY** | never reanalyzed merely because itemCount=0 |
| `reviewed` | any (including 0) | **resume, READY** | never reanalyzed merely because itemCount=0 |
| `applying` | any (including 0) | **resume, READY** (read-only) | never mutated/reanalyzed in Phase 6B; item count irrelevant |
| `applied` | any (including 0) | **resume, READY** (read-only) | never mutated/reanalyzed in Phase 6B; item count irrelevant |
| `failed` | any | **retryable, only after winning the atomic claim** | |
| `ignored` | any | **retryable, only after winning the atomic claim** | matches the accepted Phase 6 design |
| `draft` | any | **IN_PROGRESS** — another request currently owns this reservation | never auto-retried merely because it currently has zero items |

Item count is **never** consulted anywhere in the branching logic any more — status alone decides, exactly as Correction 4 required. All seven rows are covered by dedicated, parametrized tests (`status matrix` describe block, `share-message-conversion.server.test.ts`), each explicitly constructing a **zero-item** row for the four resumable statuses to prove the "never reanalyzed merely because itemCount=0" invariant directly, not merely by absence of a counter-test.

## 12. Exact structured 23505 mechanism

`createProjectUpdateAuditRecord` now returns `dbErrorCode: error?.code ?? null` on failure (propagating Postgres's own error code, previously discarded). `handleReservationConflict` in `share-message-conversion.server.ts`:

1. If `dbErrorCode !== "23505"` → propagate the original failure untouched. No reselect is even attempted.
2. Else if the error message does **not** contain the literal constraint name `project_updates_source_share_message_id_key` → propagate untouched (a 23505 on some *other* constraint on this table is never silently reinterpreted as "the source-message race").
3. Else → re-select via `findExistingSlot`. If **no** authoritative winner row is found, propagate the *original* database failure rather than fabricating a result. If a winner is found: resumable status → `resumeSlot` (READY); `draft`/`failed`/`ignored` → `IN_PROGRESS` for that same id.

All four required cases are directly tested: 23505 + exact constraint + resumable winner → READY; 23505 + exact constraint + draft winner → IN_PROGRESS; a non-23505 error → propagated with **zero** reselect attempts; a 23505 naming a *different* constraint → propagated (proving "message-regex alone is no longer authoritative" — the old code's bare `/duplicate key|unique constraint|23505/i` substring test would have misclassified this case, the new code does not); 23505 + exact constraint + no reselectable winner → the original DB failure is propagated, not fabricated.

## 13. Exact IN_PROGRESS API/UI behavior

- **Service** (`share-message-conversion.server.ts`): `{ok:true, state:"in_progress", projectUpdateId}` — no `update`/`items`/`analysis` fields at all.
- **Route** (`analyze/route.ts`): passes this through verbatim as the JSON body, still with the same no-store headers.
- **UI** (`tasks-view.tsx`'s `handleAnalyzeShareMessage`): recognizes `payload.state === "in_progress"` and returns `{ok:false, error:"This message is already being analyzed. Try again in a moment."}` to the caller — reusing the modal's **already-existing** inline-error display (`client-communication-history-modal.tsx`'s per-message error slot, built in the original Phase 6B turn) rather than inventing a new UI state. The review modal is never opened with an empty/incomplete result, and this is never treated as a failure that would authorize creating a second reservation — the same durable `projectUpdateId` is what the next explicit click will resolve to. No polling was added, matching the instruction that a clear "try again shortly" response is acceptable for Phase 6B.

## 14. Remaining limitations

- **DB-level Apply boundary is not fully closed** (see §7): `apply_project_update_transaction` still has a direct `authenticated` EXECUTE grant reachable outside this app's own server. The application-layer guard (§6A) and UI boundary (§6B) close the intended, documented path completely, but a determined authenticated user could still call the raw RPC directly. Closing this fully requires a new, separately authorized migration (narrowing the grant, or adding a `source_type` check inside the SQL function) — explicitly out of scope for this turn.
- No runtime verification against a disposable PostgreSQL instance was performed for this correction's application code (targeted/mocked tests and `tsc` only, per instruction). Phase 6A's own database contract (trigger, coupling check, unique index) that this algorithm depends on was already runtime-verified (64/64) in the prior phase and is unmodified.
- A concurrent-retry-claim loser that reselects and finds the row back at `failed`/`ignored` (i.e., the winner's own attempt already completed and failed) is still reported as `IN_PROGRESS` rather than a more precise "the previous retry failed, try again" message — not unsafe (a subsequent explicit request will correctly re-claim it), just slightly imprecise UI messaging in this rare compound-failure edge; not addressed in this turn to keep the branch count bounded.
- `analyzeIntoReservedSlot`'s AI cost for a genuine retry is unchanged from the original design (a real re-analysis, not a defect).
- Manual real-browser click-through was not performed (no dev server access instructed this turn); coverage is via targeted unit/RTL tests.

## 15. Explicit statements

**NO APPLY / NO CONVERTED CLOSURE.** No code in this correction inserts into `share_message_conversions`, sets `share_messages.status='converted'`, marks a message reviewed/resolved automatically, or triggers Apply automatically. Confirmed by a repository-wide boundary scan: every `share_message_conversions`/`apply_project_update_transaction` string match in the changed files is inside an explanatory doc comment; there are zero executable `'converted'` status-write references anywhere in the changed files.

**PHASE 6C NOT AUTHORIZED.** `apply_project_update_transaction`'s own SQL body, `set_share_message_status`, and atomic conversion closure remain untouched and unauthorized. The Apply route gained an additive rejection guard for `client_share` (§6A) — this narrows what Apply can do, it does not implement Apply-for-client_share or any part of Phase 6C's own future work.

## 16. Tests and results (this correction)

| Suite | Result |
|---|---|
| `lib/share/share-message-conversion.server.test.ts` (rewritten) | 22/22 pass |
| `app/api/share-links/[id]/messages/[messageId]/analyze/route.test.ts` (updated + IN_PROGRESS added) | 19/19 pass |
| `app/api/project-updates/apply/route.test.ts` (new) | 5/5 pass |
| `app/components/dashboard/tasks/project-updates/project-update-shell.test.tsx` (new) | 4/4 pass |
| `lib/project-updates/project-update-audit.server.test.ts` (new) | 5/5 pass |
| Full regression sweep (`lib/share/`, `lib/project-updates/`, `app/api/share-links/`, `app/api/project-updates/`, `app/components/dashboard/tasks/share-link/`, `app/components/dashboard/tasks/project-updates/`, `tasks-view.test.tsx`, `dashboard-client.test.tsx`) | **64 files / 2011 tests, all pass** |
| Phase 6A provenance migration test (`202608210001_..._provenance.test.ts`) | 37/37 pass (part of the sweep above, unaffected by this correction) |

## 17. `npx tsc --noEmit` result

**Clean, zero errors.**

## 18. `git diff --check`

**Clean, exit 0** — only benign CRLF/LF line-ending advisories on Windows-checked-out files.

## 19. `git status --short` (as of the end of the application-layer correction)

```
 M app/api/project-updates/apply/route.ts
 M app/components/dashboard/tasks-view.tsx
 M app/components/dashboard/tasks/project-updates/project-update-shell.tsx
 M app/components/dashboard/tasks/project-updates/project-update-types.ts
 M app/components/dashboard/tasks/share-link/client-communication-history-modal.test.tsx
 M app/components/dashboard/tasks/share-link/client-communication-history-modal.tsx
 M app/components/dashboard/tasks/share-link/share-link-panel.test.tsx
 M app/components/dashboard/tasks/share-link/share-link-panel.tsx
 M lib/project-updates/project-update-audit.server.ts
 M lib/project-updates/project-update-types.ts
 M lib/project-updates/v2/project-update-facts.types.ts
 M lib/project-updates/v2/project-update-v2-analyzer.server.ts
 M lib/share/share-contracts.ts
 M lib/share/share-messages-repository.server.test.ts
 M lib/share/share-messages-repository.server.ts
 M supabase/migrations/202608210001_client_share_project_update_provenance.test.ts
?? app/api/project-updates/apply/route.test.ts
?? app/api/share-links/[id]/messages/[messageId]/analyze/
?? app/components/dashboard/tasks/project-updates/project-update-shell.test.tsx
?? docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6B_IMPLEMENTATION_REPORT_2026-08-21.md
?? lib/project-updates/project-update-audit.server.test.ts
?? lib/project-updates/v2/project-update-v2-analyzer.server.test.ts
?? lib/share/share-message-conversion.server.test.ts
?? lib/share/share-message-conversion.server.ts
```

No new `supabase/migrations/*.sql` file yet at this point. No commit was made. (§20 below adds the one migration this application-layer correction alone could not close.)

---

## 20. DB Apply Boundary (design audit + implementation)

The application-layer correction above (§2–§19) left one explicitly flagged, unresolved finding: **the Apply RPC's own database grant is broader than the intended application call path**, and the design audit that followed this report's first version established the fix. This section documents that audit and the migration it authorized.

### 20.1 Final effective RPC grant finding

`public.apply_project_update_transaction` is redefined by **five** successive migrations (`202606150008` → `202606160001` → `202606160002` → `202607020005` → **`202607270001`**, the current authoritative definition — confirmed by grepping every migration file for the function name; no migration after `202607270001` touches it). Across all five generations, unchanged: `language plpgsql`, **`security invoker`**, `set search_path = public, pg_temp`, and grants — `revoke all ... from public`, `revoke all ... from anon`, **`grant execute ... to authenticated`**. `source_type` is referenced in none of the five generations.

### 20.2 Why "revoke `authenticated`" was rejected

`app/api/project-updates/apply/route.ts` calls the RPC using `createClient()` (`lib/supabase/server.ts`) — `createServerClient` with the **anon key** plus the caller's own session cookies, the exact same RLS-bound, `authenticated`-role session client the browser itself could use. There is no other, more-privileged pathway. Revoking `EXECUTE` from `authenticated` would return `42501 permission denied` for **every** Apply attempt — text/image included, not just client_share. Rejected: fails the "existing text/image Apply must remain unchanged" requirement outright.

### 20.3 Why `service_role` was rejected

Every ownership/ownership-adjacent check inside the RPC is `... = auth.uid()`. Under a `service_role` client, `auth.uid()` is `NULL`, so the RPC's own first line (`if v_user_id is null then raise UNAUTHORIZED`) would reject every call, including legitimate ones. Making this work would require adding a new `p_user_id` parameter and rewriting every internal ownership check to trust it instead of `auth.uid()` — moving the authorization boundary from the database (session JWT) to the application. This also broadens credential authority the codebase otherwise reserves exclusively for the public/anonymous Client Share surface (`supabaseAdmin`, `lib/supabase/admin.ts`) — never used for an authenticated-owner mutation anywhere else in this repository. Rejected: a fundamentally larger, riskier change, and an unnecessary broadening of authority.

### 20.4 Why an RPC-body rewrite (adding the check inside `apply_project_update_transaction` itself) was rejected for this turn

Placing `if v_update.source_type = 'client_share' then raise ...` directly inside the RPC (immediately after its own `APPLY_ATTEMPT_MISMATCH` check, before any lock/mutation) is fully sound in principle — but Postgres has no partial-function-patch mechanism, so it would require a new migration's `CREATE OR REPLACE FUNCTION` to reproduce the **entire current ~875-line body** verbatim, across five prior generations of accumulated fixes (priority-provenance write, client-detail JSON-path fix, project-completion reconciliation). This is a real, non-trivial transcription-drift risk for a Phase-6B-scoped change that should be as small and reviewable as possible. Rejected in favor of a smaller design (§20.5) that touches none of this.

### 20.5 Dedicated trigger design (implemented)

A **brand-new, single-purpose** `BEFORE INSERT OR UPDATE` trigger on `public.project_updates`, deliberately **separate** from Phase 6A's `enforce_project_update_source_provenance()` (which governs source-identity integrity/immutability only — conflating the two concerns into one function would make that function's own documented single purpose misleading, and would make Phase 6C's eventual removal of this temporary guard a riskier edit to a function it does not otherwise need to touch):

```sql
create or replace function public.enforce_project_update_client_share_apply_boundary()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.source_type = 'client_share'
    and new.status in ('applying', 'applied') then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE';
  end if;
  return new;
end;
$$;
```

Wired as `before insert or update on public.project_updates for each row`, with `revoke all ... from public/anon/authenticated/service_role` on the function itself (matching Phase 6A's own trigger-function convention exactly — this function is invoked only by the trigger mechanism, never called directly).

### 20.6 Why INSERT and UPDATE are both guarded

A **critical correction** to the original design audit: the audit's own first-pass Option C only considered blocking the *transition* into `applying` (an `OLD.status IS DISTINCT FROM 'applying'`-style condition), which is an **UPDATE-only** guard. But Phase 6A/runtime evidence establishes that an authenticated owner can legitimately `INSERT` `project_updates` rows directly under current RLS (`auth.uid() = user_id`, no column restriction) — meaning an attacker does not need to reach `applying` via a transition at all: they could `INSERT` a fully-formed row that is **already** `status='applying'` (or `'applied'`) from its very first moment of existence, which an UPDATE-only guard, comparing against `OLD`, would never see (there is no `OLD` row for an `INSERT`). The implemented function inspects **only `NEW`** — it never reads `OLD`, and never branches on `TG_OP` — so the identical check fires for INSERT and UPDATE alike, closing this exact hole.

### 20.7 Why `applying` AND `applied` are both prohibited

`applying` is prohibited because there is no legitimate in-flight Apply attempt for client_share yet in Phase 6B. `applied` is *additionally* prohibited — not merely implied by blocking `applying` — because a direct write must never be able to **fabricate an already-completed** client_share Apply lifecycle state outright; skipping `applying` entirely (going straight to a self-constructed `'applied'` row) would not be safe if only `applying` were blocked.

### 20.8 Direct INSERT bypass threat (the case this correction specifically closes)

Modeled and runtime-tested (§20.11, Section C — **the mandatory test**): an authenticated owner, using only their own real, unclaimed, client-authored source message (satisfying every one of Phase 6A's own coupling/content-integrity checks), attempts a single `INSERT` into `project_updates` with `status='applying'` and a self-chosen `apply_attempt_id` from the start — no prior row, no transition, nothing an UPDATE-only guard could ever have observed. This is rejected with `PROJECT_UPDATE_SOURCE_NOT_APPLIABLE`, and no row is persisted at all.

### 20.9 Phase 6C removal/replacement path

Phase 6C's own atomic "work mutation → `share_message_conversions` insert → `share_messages.status='converted'`" logic must live inside `apply_project_update_transaction` itself regardless of anything in this section (atomicity requires it). Because this guard is a **separate, isolated** trigger/function — never woven into the RPC body, never sharing a function with Phase 6A's provenance trigger — Phase 6C's own migration can `DROP TRIGGER project_updates_enforce_client_share_apply_boundary` (or narrow its condition) as one small, self-contained diff, fully decoupled from whatever else Phase 6C must independently do inside the RPC. This is not an architectural dead end; it is a deliberately temporary, cleanly-labeled placeholder.

### 20.10 Migration safety

- **Idempotent DDL**: `drop trigger if exists ... on public.project_updates;` before `create trigger`, matching Phase 6A's own established pattern exactly. `create or replace function` is naturally idempotent.
- **No silent drops of unrelated objects**: only the exact, newly-created trigger name is ever dropped-then-recreated.
- **No data backfill needed**: Phase 6B (the only code path that can ever write `source_type='client_share'` at all) was still uncommitted in the working tree as of this migration and has never written `status='applying'`/`'applied'` for any row — there is no existing data (in any real database) this guard could conflict with. No STOP condition was triggered.
- **No historical migration edited**: `202608230001_client_share_apply_boundary.sql` is a wholly new file; `202608210001` (Phase 6A) and `202607270001` (the RPC) are untouched, confirmed by the static test's direct reads of both files.

### 20.11 Static test results

`supabase/migrations/202608230001_client_share_apply_boundary.test.ts` (new): **26/26 pass.** Covers: dedicated function existence and separation from the Phase 6A trigger; `BEFORE INSERT OR UPDATE` wiring; the guard's own logic (`source_type='client_share'`, rejects `applying`, rejects `applied`, stable `P0001`/`PROJECT_UPDATE_SOURCE_NOT_APPLIABLE`, never references `OLD`, never branches on `TG_OP`, returns `NEW` otherwise); `EXECUTE` revoked from `public`/`anon`/`authenticated`/`service_role`; `apply_project_update_transaction` untouched (no redefinition, no grant/revoke statement naming it, and the real current RPC migration file is read directly and confirmed still intact); Phase 6A's provenance function/migration untouched (read directly); no new column/table; no `share_message_conversions`/`share_messages` reference outside doc comments.

### 20.12 Disposable runtime package

Created `docs/client-share-phase6b-runtime/` (`00_READ_ME_FIRST.md`, `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql`, `02_CAPTURE_RESULTS.md`, `MANIFEST.md`), extending — not duplicating — the existing Phase 6A disposable-project approach: it targets the **same** disposable Supabase project Phase 6A's package already provisioned, and points directly at the real `202608230001_client_share_apply_boundary.sql` file rather than copying it (avoiding a second, driftable copy of a migration small enough not to need mechanical bundling). File 01 is fully self-contained (its own `test_results`/`fixture_ids`/`record_result`/`act_as` scratch objects, matching Phase 6A's file 03 idiom exactly since `pg_temp` objects are session-scoped) and covers sections A–K exactly as specified, ending in a `PHASE_6B_BOUNDARY_RUNTIME_PASS`/`FAIL` verdict, always rolling back.

**Runtime status: NOT YET RUN.** Per instruction, this section will **not** claim a runtime PASS until the user actually executes the package and supplies the results — see `docs/client-share-phase6b-runtime/02_CAPTURE_RESULTS.md`, currently an unfilled template.

## 21. Combined test results (application-layer correction + DB boundary)

| Suite | Result |
|---|---|
| `lib/share/share-message-conversion.server.test.ts` | 22/22 pass |
| `app/api/share-links/[id]/messages/[messageId]/analyze/route.test.ts` | 19/19 pass |
| `app/api/project-updates/apply/route.test.ts` | 5/5 pass |
| `app/components/dashboard/tasks/project-updates/project-update-shell.test.tsx` | 4/4 pass |
| `lib/project-updates/project-update-audit.server.test.ts` | 5/5 pass |
| `supabase/migrations/202608210001_..._provenance.test.ts` (Phase 6A, unaffected) | 37/37 pass |
| `supabase/migrations/202608230001_client_share_apply_boundary.test.ts` (new) | 26/26 pass |
| Full regression sweep (`lib/share/`, `lib/project-updates/`, `app/api/share-links/`, `app/api/project-updates/`, `app/components/dashboard/tasks/share-link/`, `app/components/dashboard/tasks/project-updates/`, `tasks-view.test.tsx`, `dashboard-client.test.tsx`, plus the new migration test) | **65 files / 2037 tests, all pass** |

`npx tsc --noEmit`: **clean, zero errors.**
`git diff --check`: **clean, exit 0** — only benign CRLF/LF advisories.

## 22. `git status --short` (current, including the DB boundary migration)

```
 M app/api/project-updates/apply/route.ts
 M app/components/dashboard/tasks-view.tsx
 M app/components/dashboard/tasks/project-updates/project-update-shell.tsx
 M app/components/dashboard/tasks/project-updates/project-update-types.ts
 M app/components/dashboard/tasks/share-link/client-communication-history-modal.test.tsx
 M app/components/dashboard/tasks/share-link/client-communication-history-modal.tsx
 M app/components/dashboard/tasks/share-link/share-link-panel.test.tsx
 M app/components/dashboard/tasks/share-link/share-link-panel.tsx
 M lib/project-updates/project-update-audit.server.ts
 M lib/project-updates/project-update-types.ts
 M lib/project-updates/v2/project-update-facts.types.ts
 M lib/project-updates/v2/project-update-v2-analyzer.server.ts
 M lib/share/share-contracts.ts
 M lib/share/share-messages-repository.server.test.ts
 M lib/share/share-messages-repository.server.ts
 M supabase/migrations/202608210001_client_share_project_update_provenance.test.ts
?? app/api/project-updates/apply/route.test.ts
?? app/api/share-links/[id]/messages/[messageId]/analyze/
?? app/components/dashboard/tasks/project-updates/project-update-shell.test.tsx
?? docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6B_IMPLEMENTATION_REPORT_2026-08-21.md
?? docs/client-share-phase6b-runtime/
?? lib/project-updates/project-update-audit.server.test.ts
?? lib/project-updates/v2/project-update-v2-analyzer.server.test.ts
?? lib/share/share-message-conversion.server.test.ts
?? lib/share/share-message-conversion.server.ts
?? supabase/migrations/202608230001_client_share_apply_boundary.sql
?? supabase/migrations/202608230001_client_share_apply_boundary.test.ts
```

Exactly one new migration file: `supabase/migrations/202608230001_client_share_apply_boundary.sql`. No historical migration edited. No commit was made.

---

## 24. Runtime harness correction (first execution attempt + fix)

The user executed `docs/client-share-phase6b-runtime/01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql` for real, against the disposable Supabase project already used for Phase 6A, with `202608230001` applied. Result:

```
total_tests=27  passed_tests=25  failed_tests=2  status=PHASE_6B_BOUNDARY_RUNTIME_FAIL
```

Both FAILs:

- **I1**: `sqlstate=42883 sqlerrm=function public.apply_project_update_transaction(uuid, uuid, uuid[], uuid[], jsonb, jsonb) does not exist`
- **K5**: `detail=NULL` (the grant-verification query itself found nothing to check, for the same reason)

### 24.1 Root cause

Confirmed by direct inspection of `scripts/client-share/build-phase6a-runtime-package.ps1`'s own `$sourceFiles` list and header comment: the Phase 6A disposable package **deliberately excludes** every migration that only `create or replace function`s `apply_project_update_transaction` — Phase 6A's own runtime tests never called that RPC, so it was correctly out of scope there. Phase 6B's Sections I and K5 are the first tests in this whole runtime-package family to call it directly, and nothing had ever installed it in this disposable project. **No evidence of a defect in the Phase 6B boundary migration itself** — the other 25/27 tests, including the mandatory Section C (direct-INSERT-at-`applying` bypass) and both UPDATE-attack sections (A, B), all passed.

### 24.2 Exact missing migrations

`202606150008_transactional_project_update_apply.sql`, `202606160001_fix_project_update_client_detail_json.sql`, `202606160002_fix_client_detail_mutation_json_paths.sql`, `202607020005_project_update_priority_provenance.sql`, `202607270001_project_completion_reconciliation.sql` — all five are absent from `docs/client-share-phase6a-runtime/02_APPLY_CLIENT_SHARE_THROUGH_PHASE6A.sql`'s source list.

### 24.3 Dependency analysis — why only ONE of the five is needed

Read all five in full. Findings:

- `202606160002`, `202607020005`, and `202607270001` (current, authoritative) are each a **complete, self-contained** `create or replace function` — a full body, not a diff against the prior version. Applying the last one alone produces the exact same end state as applying all five in order, on any starting state (including one where the function does not exist yet at all).
- `202606160001` is the one exception: instead of a static body, it calls `pg_get_functiondef()` to read whatever definition **currently exists**, string-replaces one expression, and re-executes the patched source — a genuine runtime dependency on `202606150008`'s exact original text being present first (it raises `APPLY_PROJECT_UPDATE_TRANSACTION_METADATA_PATCH_NOT_FOUND` otherwise). Its own net effect is itself immediately overwritten by `202606160002`'s full replace one migration later, so it contributes nothing to the final state — bundling it would only add a real, order-sensitive fragility for zero benefit.
- No other schema dependency exists: `apply_project_update_transaction`, `reconcile_project_completion`, and `apply_task_bulk_status_transaction` are `plpgsql` functions, which Postgres compiles **lazily on first execution**, not at `CREATE FUNCTION` time — so their `%ROWTYPE`/column references against `projects`/`tasks`/`clients` do not need those tables' full production column set merely for `CREATE OR REPLACE FUNCTION` to succeed. Phase 6B's own runtime tests only ever call this RPC along a path that exits at its very first status-precondition check (`APPLY_ATTEMPT_MISMATCH`), before the function ever touches `projects`/`tasks`/`clients` at all (confirmed by direct trace of the current function body) — so no fixture-table column extension is needed either.

**Conclusion: `202607270001_project_completion_reconciliation.sql` alone is the minimum, sufficient, authoritative dependency.**

### 24.4 New runtime prerequisite file + generator

- `docs/client-share-phase6b-runtime/00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql` (new, **mechanically generated**) — the exact, unmodified contents of `202607270001_project_completion_reconciliation.sql`, with a safety preamble (Phase 6A sentinel + base tables) and a final verification query (function existence + exact-grant checks for all three functions this migration defines).
- `scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1` (new generator) — same discipline as the Phase 6A generator (read-only against migrations, never runs SQL, staged-then-validated write, hash-verified), scoped down for a single source file. Also regenerates this package's `MANIFEST.md`.
- Does **not** duplicate or hand-rewrite the 800+ line RPC — the generator embeds the real migration file verbatim; drift is structurally impossible without the hash check failing.

### 24.5 Confirmation: the Phase 6B boundary migration itself was NOT changed

`supabase/migrations/202608230001_client_share_apply_boundary.sql`, its trigger/function semantics, all Phase 6B application code (`share-message-conversion.server.ts`, the analyze route, the apply route guard, `project-update-shell.tsx`), and the Phase 6A provenance migration are **untouched** by this correction. Confirmed by `git status --short` (§27) showing no modification to any of those files this turn.

### 24.6 Corrected manual runtime sequence (from the user's current disposable-project state)

The user has already applied Phase 6A's `01`+`02` and `202608230001`. From here:

1. Paste and run `docs/client-share-phase6b-runtime/00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql` in full. Expect every row in its final table to show `found = true`.
2. **Do not reapply** `202608230001` — order relative to step 1 does not matter (file 00 only defines functions, never a trigger on `project_updates`, so it cannot conflict with that migration's trigger either way), and the trigger is already correctly installed per Run 1's own 25/27 pass.
3. Re-run `docs/client-share-phase6b-runtime/01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql` (updated — see §24.7/§24.8 below).
4. Expect `status = PHASE_6B_BOUNDARY_RUNTIME_PASS`, `failed_test_details = (no failures)`.

### 24.7 Test corrections (K5, I1, and new I5/I6)

- **K5** rewritten to check the **exact six-argument signature**'s grant via `has_function_privilege('authenticated', '...(uuid,uuid,uuid[],uuid[],jsonb,jsonb)'::regprocedure, 'EXECUTE')`, replacing the original name-only `information_schema.role_routine_grants` match — cannot be satisfied by an unrelated same-named overload, and the `::regprocedure` cast itself fails loudly if the exact signature doesn't exist.
- **I1** unchanged in its own expectation (`sqlstate='P0001', sqlerrm='APPLY_ATTEMPT_MISMATCH'`) — this was already correct; it only ever failed because the function didn't exist to raise it. Not weakened.
- **New I5**: the `projects` fixture row is snapshotted before/after via `%ROWTYPE` and compared by full row equality, proving zero mutation (not just zero *new* rows).
- **New I6**: zero new `clients` rows. Combined with the pre-existing I2 (`project_timeline_events`) and I3 (`tasks`), this now explicitly covers "no tasks/projects/clients/timeline mutation" as stated in the required test list, not just tasks/timeline.
- Safety gate extended to check for the real RPC's exact signature and fail with an actionable message naming file `00`, instead of letting Section I hit a raw, confusing `42883` deep into the run.

### 24.8 Failure-diagnostics visibility (Task 7)

The final statement in `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql` is now a single row containing `total_tests`, `passed_tests`, `failed_tests`, `status`, and a new `failed_test_details` column — every FAIL's `section`/`name`/`detail`, aggregated via `string_agg(...)`, right in that same row (`(no failures)` on a clean PASS). Since Supabase's SQL Editor only surfaces the last statement's result set, this means a FAIL is now fully diagnosable from that one visible row alone — no need to scroll up or manually re-run the separate full-results/FAIL-only queries (which are still present, for interactive/scroll-back use). `ROLLBACK` remains the unconditional final statement, unchanged.

### 24.9 Static/generator verification

- `supabase/migrations/202608230001_client_share_apply_boundary.test.ts` — still 26/26 (unaffected; that migration was not touched).
- Generator run: `PACKAGE_VERIFICATION_STATUS: PASS` (staged-hash validation passed); `MANIFEST.md` regenerated and hash-consistent with the actual files on disk (re-verified after every edit to `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql`/`00_READ_ME_FIRST.md`/`02_CAPTURE_RESULTS.md` this turn).
- No TypeScript source or test file changed this turn (this was a SQL/PowerShell/documentation-only correction) — `npx tsc --noEmit` re-run anyway as a sanity check: clean, zero errors. `git diff --check`: clean, exit 0.

### 24.10 Runtime acceptance status

**Still pending.** Run 1 (25/27, `PHASE_6B_BOUNDARY_RUNTIME_FAIL`) is fully recorded in `docs/client-share-phase6b-runtime/02_CAPTURE_RESULTS.md`, with its root cause, alongside a prepared "Run 2" template for the corrected sequence. **No runtime PASS is claimed anywhere in this report.** The DB boundary will not be treated as runtime-verified until the user runs the corrected sequence (§24.6) and Run 2 reports `PHASE_6B_BOUNDARY_RUNTIME_PASS`.

## 25. `git status --short` (current, including the runtime harness correction)

```
 M app/api/project-updates/apply/route.ts
 M app/components/dashboard/tasks-view.tsx
 M app/components/dashboard/tasks/project-updates/project-update-shell.tsx
 M app/components/dashboard/tasks/project-updates/project-update-types.ts
 M app/components/dashboard/tasks/share-link/client-communication-history-modal.test.tsx
 M app/components/dashboard/tasks/share-link/client-communication-history-modal.tsx
 M app/components/dashboard/tasks/share-link/share-link-panel.test.tsx
 M app/components/dashboard/tasks/share-link/share-link-panel.tsx
 M lib/project-updates/project-update-audit.server.ts
 M lib/project-updates/project-update-types.ts
 M lib/project-updates/v2/project-update-facts.types.ts
 M lib/project-updates/v2/project-update-v2-analyzer.server.ts
 M lib/share/share-contracts.ts
 M lib/share/share-messages-repository.server.test.ts
 M lib/share/share-messages-repository.server.ts
 M supabase/migrations/202608210001_client_share_project_update_provenance.test.ts
?? app/api/project-updates/apply/route.test.ts
?? app/api/share-links/[id]/messages/[messageId]/analyze/
?? app/components/dashboard/tasks/project-updates/project-update-shell.test.tsx
?? docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6B_IMPLEMENTATION_REPORT_2026-08-21.md
?? docs/client-share-phase6b-runtime/
?? lib/project-updates/project-update-audit.server.test.ts
?? lib/project-updates/v2/project-update-v2-analyzer.server.test.ts
?? lib/share/share-message-conversion.server.test.ts
?? lib/share/share-message-conversion.server.ts
?? scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1
?? supabase/migrations/202608230001_client_share_apply_boundary.sql
?? supabase/migrations/202608230001_client_share_apply_boundary.test.ts
```

No historical migration edited. No new migration added this turn (the one new migration, `202608230001`, was added in a prior turn and is unchanged here). No commit was made.

---

## 27. Runtime prerequisite correction #2 (second execution attempt + fix)

The user then ran the §24.4 prerequisite package (`00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql`) against the same disposable project, `202608230001` already successfully applied. It **failed to even load**:

```
ERROR 42703: column project.status does not exist
LINE: and project.status is distinct from 'Done'
```

### 27.1 Exact object and exact reason

Not any of the three functions. The failure is `202607270001_project_completion_reconciliation.sql`'s own **trailing "One-time historical backfill" statement** — a standalone, top-level `WITH eligible_projects AS (...) UPDATE public.projects ...`, the last statement in the file, entirely outside any `CREATE FUNCTION` body (confirmed by direct line-by-line inspection: `project.status is distinct from 'Done'` appears at line 67, inside `reconcile_project_completion`'s own plpgsql body, and again at lines 1236/1252, inside this unrelated trailing statement — the error is the latter).

PL/pgSQL function bodies are lazily compiled: Postgres stores them as opaque text and does not resolve their embedded SQL statements' column references against the live catalog until the function is actually *called* — this is ordinary, well-established behavior (it is exactly why forward-referencing a not-yet-created table/column inside a function body is a safe, common pattern), and it holds regardless of `check_function_bodies`. The backfill statement is not a function body — it is a plain top-level DML statement, and Postgres validates those immediately, the moment they run. The Phase 6A disposable fixture's `projects` stand-in (`docs/client-share-phase6a-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql`) only has `id, user_id, deleted_at, is_archived, created_at` by design, so `project.status` fails immediately.

### 27.2 `check_function_bodies = off` — investigated, correctly not what fixes this

`SET LOCAL check_function_bodies = off` before the `CREATE OR REPLACE FUNCTION` statements is a real, valid, safe Postgres/Supabase SQL Editor technique in general — it disables `CREATE FUNCTION`'s own pre-check compilation pass, which exists specifically to avoid false-positive errors from forward references (e.g., mutual recursion, dump/restore ordering). It has **zero effect** on a top-level statement that is not inside any function body at all. Since the actual failure is the trailing backfill UPDATE — not any function's `CREATE` — this setting would not have prevented the error. Confirmed by direct trace, not assumed.

### 27.3 Proof that `APPLY_ATTEMPT_MISMATCH` is reached before any missing dependency

Traced the current `apply_project_update_transaction` body statement-by-statement from entry:

1. `v_user_id := auth.uid()` — no dependency
2. `if v_user_id is null then raise UNAUTHORIZED` — no dependency
3. `if p_update_id is null or p_apply_attempt_id is null then raise INVALID_APPLY_ATTEMPT` — params only
4. `if p_edited_items is null or ... then raise INVALID_APPLY_PAYLOAD` — params only
5. Build `v_accepted_ids`/`v_rejected_ids` via `unnest(...)` — params only
6. Cardinality/conflict checks (`INVALID_ITEM_SELECTION`, `TOO_MANY_UPDATE_ITEMS`, `ITEM_SELECTION_CONFLICT`) — params only
7. `select update_row.* into v_update from project_updates where id=p_update_id and user_id=v_user_id for update` — touches **only** `project_updates` (full schema already present via the Phase 6A package)
8. `if not found then raise PROJECT_UPDATE_NOT_FOUND` — no additional dependency
9. **`if v_update.status <> 'applying' or apply_attempt_id mismatch then raise APPLY_ATTEMPT_MISMATCH`** — reads only `project_updates.status`/`apply_attempt_id`, both real, already-present columns

This is exactly where Test I1's call exits (the client_share row's own status is `'analyzed'`). Nothing before this point — and nothing this specific call path ever reaches — touches `projects`, `tasks`, `clients`, `project_update_items`, or `project_timeline_events` at all. No missing dependency exists on this path.

### 27.4 Whether the failed run left partial objects

Not assumed either way. Supabase SQL Editor's exact multi-statement commit semantics for a pasted script with no explicit `BEGIN`/`COMMIT` were not asserted with certainty. It does not matter: every statement in the corrected package (`CREATE OR REPLACE FUNCTION` ×3, `REVOKE ALL`, `GRANT EXECUTE`, `COMMENT ON FUNCTION`) is idempotent by construction — re-running the corrected file is safe and correct regardless of whether the three functions partially survived the first failed attempt or the whole batch was rolled back together.

### 27.5 Exact package/generator changes

- `scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1`: now truncates the embedded bundle at the backfill statement's own marker comment (`"-- One-time historical backfill."`). Verified two ways: (a) throws if the marker is ever missing (source migration's shape changed — fails closed rather than silently bundling something unintended), (b) independently re-reads the real migration file from disk and confirms the embedded content is a genuine verbatim prefix of it. **The three `CREATE OR REPLACE FUNCTION` statements remain 100% verbatim, character-for-character — no hand-written substitute RPC.** The full, untruncated source file is still hashed for provenance; only the embedded bundle content is truncated, clearly marked, with the omitted tail's byte length and first line recorded.
- `docs/client-share-phase6b-runtime/00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql`: regenerated from the corrected generator.
- Final verification query simplified per the "keep it simple" requirement: **one row**, three columns — `apply_rpc_exists`, `authenticated_execute`, `prerequisite_status` (`PHASE_6B_APPLY_PREREQUISITE_READY`/`_NOT_READY`). Uses `to_regprocedure()` (returns `NULL`, never errors) rather than a throwing `::regprocedure` literal cast, so the query itself always returns a clean diagnostic row even if the RPC still isn't installed, instead of erroring out a second time. Explicitly does **not** claim the disposable project supports a successful full Apply execution — only that the exact RPC exists and `authenticated` can call it.
- `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql`: **unchanged in this round** beyond what §24.7 already did. I1 still requires the exact `APPLY_ATTEMPT_MISMATCH` behavior (not weakened); K5 still verifies the exact six-argument signature's grant; the consolidated `failed_test_details` diagnostics are unchanged.
- **No change was made to** `supabase/migrations/202608230001_client_share_apply_boundary.sql`, its trigger/function semantics, any Phase 6B application code, or the Phase 6A provenance migration.

### 27.6 Corrected manual sequence (from the user's current disposable-project state)

Unchanged in shape from §24.6, using the corrected file:

1. Paste and run the corrected `00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql`. Expect exactly one row: `apply_rpc_exists=true, authenticated_execute=true, prerequisite_status=PHASE_6B_APPLY_PREREQUISITE_READY`.
2. Do not reapply `202608230001`.
3. Re-run `01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql` (unchanged since §24). Expect `status=PHASE_6B_BOUNDARY_RUNTIME_PASS`, `failed_test_details=(no failures)`.

### 27.7 Generator/static verification results

Generator re-run: `Truncated at marker '-- One-time historical backfill.' -- omitting 1712 bytes`; `Order/hash/prefix verification passed`; `PACKAGE_VERIFICATION_STATUS: PASS`. `MANIFEST.md` regenerated and hash-consistent with every file on disk after each documentation edit this round. `supabase/migrations/202608230001_client_share_apply_boundary.test.ts`: still 26/26 (unaffected; unchanged). No TypeScript source/test file changed this round — `npx tsc --noEmit` re-run anyway: clean. `git diff --check`: clean, exit 0.

### 27.8 Documented attempts (both rounds)

| Attempt | Result | Root cause | Boundary-migration finding? |
|---|---|---|---|
| Boundary suite #1 | `PHASE_6B_BOUNDARY_RUNTIME_FAIL`, 25/27 | Real RPC never installed in disposable project (Phase 6A package excludes it) | No — 25/27 passed including the mandatory Section C |
| Prerequisite package #1 | Errored, `42703` | Unrelated trailing backfill statement in the source migration references a column the minimal fixture lacks | No — statement defines no function/trigger/grant |

**Runtime acceptance remains PENDING** for both the prerequisite package and the boundary suite. Full detail of both attempts is recorded in `docs/client-share-phase6b-runtime/02_CAPTURE_RESULTS.md`.

## 28. `git status --short` (current, including this correction round)

```
 M app/api/project-updates/apply/route.ts
 M app/components/dashboard/tasks-view.tsx
 M app/components/dashboard/tasks/project-updates/project-update-shell.tsx
 M app/components/dashboard/tasks/project-updates/project-update-types.ts
 M app/components/dashboard/tasks/share-link/client-communication-history-modal.test.tsx
 M app/components/dashboard/tasks/share-link/client-communication-history-modal.tsx
 M app/components/dashboard/tasks/share-link/share-link-panel.test.tsx
 M app/components/dashboard/tasks/share-link/share-link-panel.tsx
 M lib/project-updates/project-update-audit.server.ts
 M lib/project-updates/project-update-types.ts
 M lib/project-updates/v2/project-update-facts.types.ts
 M lib/project-updates/v2/project-update-v2-analyzer.server.ts
 M lib/share/share-contracts.ts
 M lib/share/share-messages-repository.server.test.ts
 M lib/share/share-messages-repository.server.ts
 M supabase/migrations/202608210001_client_share_project_update_provenance.test.ts
?? app/api/project-updates/apply/route.test.ts
?? app/api/share-links/[id]/messages/[messageId]/analyze/
?? app/components/dashboard/tasks/project-updates/project-update-shell.test.tsx
?? docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6B_IMPLEMENTATION_REPORT_2026-08-21.md
?? docs/client-share-phase6b-runtime/
?? lib/project-updates/project-update-audit.server.test.ts
?? lib/project-updates/v2/project-update-v2-analyzer.server.test.ts
?? lib/share/share-message-conversion.server.test.ts
?? lib/share/share-message-conversion.server.ts
?? scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1
?? supabase/migrations/202608230001_client_share_apply_boundary.sql
?? supabase/migrations/202608230001_client_share_apply_boundary.test.ts
```

No historical migration edited. No new migration added this turn. `supabase/migrations/202608230001_client_share_apply_boundary.sql` remains exactly as it was. No commit was made.

---

## 29. Final runtime evidence — `PHASE_6B_BOUNDARY_RUNTIME_PASS`

The user completed the corrected manual sequence (§27.6) against the same disposable Supabase project. Final results:

**Prerequisite package** (`00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql`, corrected version):

```
apply_rpc_exists      = true
authenticated_execute = true
prerequisite_status   = PHASE_6B_APPLY_PREREQUISITE_READY
```

**Phase 6B boundary runtime suite** (`01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql`, corrected version):

```
total_tests         = 29
passed_tests         = 29
failed_tests          = 0
status                = PHASE_6B_BOUNDARY_RUNTIME_PASS
failed_test_details   = (no failures)
```

This supersedes the boundary suite's earlier 25/27 result (§24), whose 2 FAILs were fully explained by the missing Apply-RPC prerequisite alone, and the prerequisite package's earlier load failure (§27), fully explained by the unrelated trailing backfill statement. Neither prior attempt was ever evidence against the boundary migration itself — this final clean run against the real, current `apply_project_update_transaction` confirms it directly, across all 29 tests: both direct-UPDATE attacks (A, B) rejected; the **mandatory** direct-INSERT-at-`applying` bypass (C) rejected with no row persisted; the direct-INSERT-at-`applied` bypass (D) rejected; normal client_share `draft`/`analyzed` states unaffected and Phase 6A's own content-integrity trigger still independently active (E); text/image Apply claims completely unaffected (F, G, H); the direct RPC call against the still-`analyzed` client_share row failing with the RPC's own pre-existing `APPLY_ATTEMPT_MISMATCH`, zero task/timeline/client mutation and the `projects` row byte-for-byte unmutated (I); the whole-database summary confirming no client_share row anywhere ended up in `applying`/`applied` (J); and full trigger/grant metadata verification, including the exact-signature `authenticated` EXECUTE grant on the real RPC and confirmation that Phase 6A's own provenance trigger remains untouched (K).

Full detail recorded in `docs/client-share-phase6b-runtime/02_CAPTURE_RESULTS.md`.

**Production SQL:** still not run, at any point across this entire Phase 6B DB-boundary effort. **Phase 6C:** not started.

## 30. `git status --short` (current — documentation-only update recording final runtime evidence)

```
 M app/api/project-updates/apply/route.ts
 M app/components/dashboard/tasks-view.tsx
 M app/components/dashboard/tasks/project-updates/project-update-shell.tsx
 M app/components/dashboard/tasks/project-updates/project-update-types.ts
 M app/components/dashboard/tasks/share-link/client-communication-history-modal.test.tsx
 M app/components/dashboard/tasks/share-link/client-communication-history-modal.tsx
 M app/components/dashboard/tasks/share-link/share-link-panel.test.tsx
 M app/components/dashboard/tasks/share-link/share-link-panel.tsx
 M lib/project-updates/project-update-audit.server.ts
 M lib/project-updates/project-update-types.ts
 M lib/project-updates/v2/project-update-facts.types.ts
 M lib/project-updates/v2/project-update-v2-analyzer.server.ts
 M lib/share/share-contracts.ts
 M lib/share/share-messages-repository.server.test.ts
 M lib/share/share-messages-repository.server.ts
 M supabase/migrations/202608210001_client_share_project_update_provenance.test.ts
?? app/api/project-updates/apply/route.test.ts
?? app/api/share-links/[id]/messages/[messageId]/analyze/
?? app/components/dashboard/tasks/project-updates/project-update-shell.test.tsx
?? docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6B_IMPLEMENTATION_REPORT_2026-08-21.md
?? docs/client-share-phase6b-runtime/
?? lib/project-updates/project-update-audit.server.test.ts
?? lib/project-updates/v2/project-update-v2-analyzer.server.test.ts
?? lib/share/share-message-conversion.server.test.ts
?? lib/share/share-message-conversion.server.ts
?? scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1
?? supabase/migrations/202608230001_client_share_apply_boundary.sql
?? supabase/migrations/202608230001_client_share_apply_boundary.test.ts
```

Only documentation files changed this turn (`docs/client-share-phase6b-runtime/00_READ_ME_FIRST.md`, `02_CAPTURE_RESULTS.md`, `MANIFEST.md`, and this report — all already untracked as part of `docs/client-share-phase6b-runtime/` and the report file above). No application code, no SQL, no migration file touched. No commit was made.

## 31. Phase 6B implementation status (superseded by §32 — see below)

**RUNTIME_VERIFIED.** The Phase 6B DB apply boundary (`supabase/migrations/202608230001_client_share_apply_boundary.sql`) is now implemented, statically verified (26/26), and **runtime-verified against a real disposable PostgreSQL database** (`PHASE_6B_BOUNDARY_RUNTIME_PASS`, 29/29, 0 failed), as the real `authenticated` role, including the mandatory Section C direct-INSERT-at-`applying` bypass. Combined with the application-layer correction (§2–§19, all green) and the DB-boundary design/implementation (§20), Phase 6B's DB apply boundary work is complete.

This status verifies the migration's own database contract only. It does **not** authorize Phase 6C, a full build, a commit, a push, or any Production action — each requires its own separate, explicit authorization.

---

## 32. Final full production build evidence

The user ran the final full production build. Result:

```
Next.js 16.1.6 (Turbopack)

Creating an optimized production build ...
PASS — Compiled successfully in 29.0s
PASS — Finished TypeScript in 37.9s
PASS — Collected page data
PASS — Generated static pages 90/90
PASS — Finalized page optimization
```

No build errors. The new Phase 6B owner route is present in the production build output: `/api/share-links/[id]/messages/[messageId]/analyze`.

This is the final evidence layer on top of everything already recorded in this report:

- Application-layer correction (§2–§19): all targeted/regression tests green, `npx tsc --noEmit` clean.
- DB apply boundary design + implementation (§20): migration `202608230001_client_share_apply_boundary.sql` implemented, statically verified (26/26).
- Runtime harness corrections (§24, §27) and final runtime evidence (§29): `apply_rpc_exists=true`, `authenticated_execute=true`, `prerequisite_status=PHASE_6B_APPLY_PREREQUISITE_READY`; `total_tests=29, passed_tests=29, failed_tests=0, status=PHASE_6B_BOUNDARY_RUNTIME_PASS, failed_test_details=(no failures)`.
- Full production build (this section): PASS, 90/90 static pages generated, new analyze route present, no errors.

**Phase 6B final verification status: COMPLETE / ACCEPTED.**

**Explicitly not yet true, and not authorized by anything in this report:**

- Migration `supabase/migrations/202608230001_client_share_apply_boundary.sql` has **NOT** been applied to the Production database — it exists only in the working tree and was runtime-verified exclusively against the disposable Supabase project.
- No deploy has occurred.
- No push has occurred.
- No commit has occurred.
- Phase 6C has **NOT** been started — atomic Apply-and-convert closure for client_share (`share_message_conversions` insert, `share_messages.status='converted'`) remains entirely unimplemented and unauthorized.

## 33. Phase 6B implementation status

**COMPLETE / ACCEPTED** — application-layer correction, DB apply boundary implementation, disposable-project runtime verification (29/29 boundary suite + prerequisite package), and full production build are all green. This status does **not** extend to Production: `202608230001` is not applied there, nothing has been pushed or deployed, and no commit exists yet. Phase 6C remains unauthorized and unstarted.
