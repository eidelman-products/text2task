# Text2Task Client Share Link — Phase 6 Accepted Implementation Plan

**Status: LOCKED CONTRACT.** This document is the authoritative source of truth for Phase 6 scope, superseding prior Phase 6 discussion where it conflicts. Only Phase 6A is authorized for implementation. Nothing in this document has been implemented — it is a documentation-only contract lock.

---

## 1. Current verified checkpoint

- `main @ 8142245` — "Complete Client Share Phase 5 communication lifecycle"
- Phase 0-5: **COMPLETE / PASS**
- `main` was verified clean before Phase 6 mapping work began
- Working-tree additions prior to this document: `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6_SUPPLEMENTAL_MAPPING_AND_DESIGN_VALIDATION_2026-08-21.md`
- Production rollout: **NOT authorized**
- Client Share Production SQL / migration / deploy / feature enablement: **NOT authorized**

## 2. Source-of-truth order

When any two documents disagree, resolve in this order (highest first):

1. This document (`..._PHASE_6_ACCEPTED_PLAN_2026-08-21.md`) — locked decisions in §4-§6 below are final.
2. `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6_SUPPLEMENTAL_MAPPING_AND_DESIGN_VALIDATION_2026-08-21.md` — evidence and design reasoning, **as corrected by §5 of this document** (the nine acceptance corrections A-I below override that report's original 6A/6C boundary, public-route contract, idempotency-slice boundary, FK delete action, analyzer-contract boundary, provenance-immutability model, content-integrity requirement, and helper-function design).
3. The original Phase 6 mapping report (delivered earlier in this engagement, not filed as a standalone doc) — architecture evidence only, superseded wherever the supplemental report already revised it.
4. `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_5_AUDIT_AND_PLAN_2026-08-19.md` — Phase 0-5 authoritative record, unchanged and still binding for everything it covers.

## 3. Mapping verdict

The supplemental mapping report concluded **READY FOR PHASE 6A IMPLEMENTATION**, with every open design question resolved to a concrete, narrow, backward-compatible extension of existing code (repository evidence, not assumption, behind each conclusion). This document accepts that verdict, locks the product/architecture decisions it surfaced, applies nine corrections (§5), and authorizes exactly one implementation slice: **Phase 6A only**.

---

## 4. Locked product decisions

These are approved and no longer open for debate in future Phase 6 work:

1. Conversion uses the **existing** Client Update analyzer, review, and apply systems. No second analyzer, no second task system.
2. Only client-authored share messages may be converted. Owner-authored replies are **never** convertible (already enforced today at the DB trigger layer — `enforce_share_message_conversion_integrity`'s `SHARE_CONVERSION_MESSAGE_NOT_CLIENT_AUTHORED` check).
3. All client-authored, non-converted messages may be explicitly converted — including previously reviewed/resolved/dismissed messages. No artificial precondition status is required first.
4. `status = 'converted'` happens **only** after a successful authoritative Client Update Apply. Never at analyze time.
5. `'converted'` is **terminal**.
6. Conversion semantics, exactly:
   - `status = 'converted'`
   - `reviewed_at` = existing value **or** conversion time (never overwritten if already set)
   - `resolved_at` is **not** artificially set by conversion
   - an existing `resolved_at` is **not** artificially erased by conversion
   - `share_message_conversions.converted_at` is the single durable conversion timestamp
7. New error code approved: `SHARE_MESSAGE_STATUS_TERMINAL`.
8. The original share message body remains intact and visible in Client Communication History after conversion — conversion never rewrites, hides, or moves it.
9. Client Share Analyze must **not** write `ai_update_analyzed` or any other professional Project Timeline event. Existing normal text/image Analyze behavior is **unchanged**.
10. A successful Apply may create **only** the normal, existing professional work timeline effects the authoritative Client Update Apply flow already produces — nothing extra for a `client_share`-sourced update.
11. The server must load `share_messages.body` itself. The browser must **never** send the client message body back as trusted `rawInput` for conversion.
12. One source share message has **at most one** durable Client Update analysis slot, ever.
13. Analyze idempotency must be **database-backed**, not merely React/button-state gating.
14. Final work mutation + `share_message_conversions` trace + `share_messages.status='converted'` must be **atomic**. An "Apply commit → best-effort conversion RPC" design is explicitly **forbidden**.
15. Link state (active/disabled/expired/revoked) does not by itself remove the authenticated owner's conversion capability for retained historical client messages, provided the underlying project remains legally mutable under the existing product model (i.e., `projects.deleted_at is null`).
16. There is no true project-level "Archived" database lifecycle today — the dashboard's archived-project concept is derived from task-level `is_archived` state. Phase 6 must not invent a stricter project-archive mutation rule. `projects.deleted_at` remains the sole authoritative project-mutability gate.
17. Manual task conversion/prefill is **deferred from Phase 6 V1**. No task-creation UI, no direct message→task save path, is to be built in any 6A-6D slice.

## 5. Locked security/transaction invariants (acceptance corrections to the supplemental report)

The supplemental report's original design is accepted as evidence and reasoning, but is corrected in eight specific places before it becomes implementable:

**A — `sourceType='client_share'` prerequisites belong in Phase 6A, not deferred — but only as INTERNAL/DURABLE, DISPLAY-ORIENTED contracts, never as a public request-body value AND never as the analyzer's own actionable input type (see correction G for why).**
Phase 6A must deliver every durable/type prerequisite 6B needs to call the analyzer with `sourceType: "client_share"`, split into three distinct categories:

*Internal/durable, passive contracts (Phase 6A, in scope):*
- `project_updates.source_type` DB CHECK extended to accept `'client_share'`
- `ProjectUpdateSourceType` TypeScript union extended — this is the general, **display/read-oriented** type used to describe a value a `project_updates` row can already hold (e.g. UI code rendering "source: text/image/client_share"), not a type that by itself lets anything be constructed or persisted
- `project_updates.source_share_message_id` durable provenance/idempotency column + partial unique index (see correction F for its full integrity model)

*The analyzer's own actionable input contract (explicitly NOT touched by 6A — see correction G):*
- `ProjectUpdateV2AnalyzerInput`'s `sourceType` narrowing and `CreateProjectUpdateInput` (the persistence-layer input type) stay exactly as they are today (`"text" | "image"`) through all of 6A. Widening either without also adding the paired `sourceShareMessageId` parameter and insert-time wiring would let a type-valid call construct a database-invalid row — see correction G for the concrete evidence and the fix.

*Public generic analyze request contract (explicitly NOT touched by 6A, and not by any slice without separate authorization):*
- The browser-callable `POST /api/project-updates/analyze` route and its request-level Zod schema (`AnalyzeProjectUpdateRequestSchema` / `ProjectUpdateSourceTypeSchema` in `app/api/project-updates/analyze/route.ts`) **must not** accept `'client_share'` as a caller-supplied value. The route continues to accept only whatever it already accepts today (in practice, `"text"`/`"image"`, per the route's own existing collapse logic).
- **Reason (locked security rule):** the browser must never be able to send `sourceType: 'client_share'` plus browser-supplied `rawInput` and have that treated as an authenticated Client Share provenance claim — doing so would let any authenticated user fabricate a fake "this came from a client message" record with attacker-controlled text. Only the future, dedicated Phase 6B Client Share owner route may ever produce a `'client_share'` analysis, and only after the server has authenticated the owner, proved share-link/message/project ownership, proved `author_type='client'`, and loaded `share_messages.body` itself — never from a browser-supplied `rawInput`.
- Widening the internal analyzer's type union does **not** imply widening the public route's request schema — these are deliberately two separate contracts, and only the internal one moves in 6A.

**B — Phase 6A must not open any write access to `share_message_conversions`.**
During 6A there must be: no new `authenticated` INSERT grant, no `anon`/public grant of any kind, no conversion-writing RPC or helper function, and no UI conversion affordance of any kind. `share_message_conversions` remains exactly as shipped in Phase 1A — `select`-only to `authenticated`, no positive grant to any other role — until the atomic 6C design lands as one coherent unit.

**C — Every privileged database helper must be treated as an independent security boundary.**
The supplemental report proposed a `security definer` `finalize_share_message_conversion` helper intended to be called only from inside `apply_project_update_transaction`. **Before any 6C implementation**, the following must be explicitly re-verified against real PostgreSQL/PostgREST grant semantics, not assumed:
- If `authenticated` must hold `EXECUTE` on this function for the outer RPC's internal call to succeed, the function is **independently callable** by any authenticated client directly (PostgREST exposes every `EXECUTE`-granted function, regardless of the developer's intent for how it's called) — it must be secured as a **complete, standalone authorization boundary** (full ownership/author-type/project/status validation on every invocation), never on the assumption "the UI won't call it directly" or "only the outer RPC calls it."
- `apply_project_update_transaction` itself must **not** be changed to `security definer` merely to sidestep this — that would elevate its entire existing, already-shipped body, a materially larger and riskier change than the problem requires.
- Prefer whichever concrete design (a fully self-validating `security definer` helper that is safe to call directly; a `security invoker` helper relying on RLS if/when an INSERT RLS policy is added; or logic inlined directly into `apply_project_update_transaction` with no separate helper at all) yields the **smallest independently-callable privileged surface**. This determination is 6C implementation work, not something to be finalized here.

**D — Phase 6B must reuse existing Client Update review orchestration, not assume a bare `projectUpdateId` is sufficient.**
The existing Client Update review modal and its state management (`use-project-update.ts`, `project-update-review-card.tsx`) were built around an in-modal `openModal(project)` → analyze → review flow, not around "open directly to an arbitrary existing `project_updates` id returned by an unrelated route." 6B must map and reuse the actual orchestration path required to land a Client-Share-triggered analysis into that same review UI. A small, additive extension to that existing orchestration (e.g., a way to open the modal already-analyzed against a given update id) is allowed if the mapping shows it's needed. A second review modal, duplicated review state, or a second apply path is **forbidden**.

**E — Structural idempotency (Phase 6A) is a distinct, smaller guarantee than operational idempotency (Phase 6B) — do not conflate them.**
Phase 6A has no convert route and no owner-facing behavior of any kind, so it can only prove a **structural** database guarantee: *one share message can back at most one `project_updates` row, enforced by the FK + partial unique index + integrity constraints alone.* It proves this exists; it does not exercise it through any live flow.

The **operational** algorithm — find an existing slot; resume an in-progress (`analyzed`/`reviewed`, ≥1 item) analysis; retry a failed/incomplete/zero-item/`ignored` attempt by overwriting the same row in place; catch a concurrent `unique_violation` and reselect the winner; return or reopen the resulting analysis to the owner — requires the authenticated conversion route and service layer that only exists starting in **Phase 6B**. This algorithm remains a locked Phase 6B design contract (unchanged from the supplemental report's §2), but **Phase 6A must not claim it as implemented or tested behavior** — 6A has nothing to route a resume/retry/concurrent request through yet.

Restated precisely: **6A proves structural uniqueness and cross-table integrity at the data-model level. 6B proves operational idempotency, resume, retry, and concurrency behavior at the route/service level.** Phase 6A's exit criteria and test list (§6, §9) must describe only the former.

**F — Provenance fields must be mutually coupled, cross-table-verified, and use a non-corrupting FK delete action; this cannot wait for 6B.**
Phase 6A must prevent a durably contradictory provenance state. Required invariant, enforced in the database itself:

```
source_type = 'client_share'   IF AND ONLY IF   source_share_message_id IS NOT NULL
```

Both invalid states must be rejected at the DB layer:
- (a) `source_type = 'client_share'` with `source_share_message_id IS NULL`
- (b) `source_type <> 'client_share'` with `source_share_message_id IS NOT NULL`

This requires a DB CHECK constraint expressing the biconditional (e.g. `check ((source_type = 'client_share') = (source_share_message_id is not null))`), added in the same 6A migration as the column itself.

In addition, for any non-null `source_share_message_id`, durable integrity must independently prove — not merely be assumed to be true because a future 6B route happens to check it first — that:
- the referenced `share_messages` row exists
- `share_messages.author_type = 'client'`
- `share_messages.user_id = project_updates.user_id`
- `share_messages.project_id = project_updates.project_id`

**FK delete action, resolved (not `on delete set null`):** the column is declared `source_share_message_id uuid null references public.share_messages(id) on delete restrict`, not `on delete set null` as the supplemental report originally proposed. `SET NULL` was audited and rejected: it would leave `source_type = 'client_share'` with `source_share_message_id = NULL` — exactly the invalid state the coupling CHECK above exists to reject — an unresolvable contradiction between two required invariants, not a real design option. `CASCADE` was also audited and rejected: it would destroy the `project_updates` row itself (a permanent professional record — possibly already `applied`, with real tasks and timeline events attached) merely because its *originating* share message was deleted; `share_message_conversions.project_update_id`'s own existing `on delete set null` is not a valid precedent here because that column is optional-by-design (a conversion may legitimately have no linked update), whereas `source_share_message_id` is coupled to `source_type` and cannot be silently nulled. `RESTRICT` is correct: it makes a hard delete of a `share_messages` row that has ever produced a `project_updates` slot fail outright, preserving truthful provenance rather than silently corrupting or destroying it, matching the required product invariant verbatim.

This was verified as introducing zero risk to any existing legitimate transaction: a repository-wide audit of every deletion path found that **no application code anywhere hard-deletes `projects`, `tasks`, `project_share_links`, or `share_messages`** — every "delete" action in this codebase (`app/api/tasks/delete/route.ts`'s `mode: "permanent"`; `app/api/projects/bulk-action/route.ts`'s `action: "soft_delete"`) is a soft-delete (`deleted_at = now()`), never a real SQL `DELETE`, on every one of these tables. (The one confirmed exception anywhere in the schema, `task_resources`, is unrelated to this FK chain.) `RESTRICT` therefore changes the behavior of zero currently-executing code path; it only matters for a future or manual hard-delete attempt, which is exactly the case it exists to fail safely rather than corrupt.

The exact repository-consistent mechanism for the cross-table checks and the coupling constraint (a `before insert or update` trigger on `project_updates`, mirroring `enforce_share_message_conversion_integrity`'s own cross-table shape) is combined with correction H's immutability trigger below into one trigger function, matching this codebase's established one-trigger-multiple-checks pattern. The **invariants themselves are locked now** and must not be weakened during implementation. Existing, non-`client_share` `project_updates` rows (`source_share_message_id = NULL`) are unaffected by any of this — the CHECK constraint's `NULL` branch and the trigger's `if new.source_share_message_id is not null then ... end if;` guard both make it a no-op for every row Phase 6A doesn't create.

**G — Phase 6A must not widen the analyzer's own actionable input contract; doing so before 6B exists would create a type-valid, DB-invalid call.**
Audited the exact existing path `analyzeProjectUpdateV2` → `createProjectUpdateAuditRecord` → `project_updates` insert (`lib/project-updates/v2/project-update-v2-analyzer.server.ts:102-112`, `lib/project-updates/project-update-audit.server.ts:124-180`). **Confirmed: the current `CreateProjectUpdateInput` type and the actual insert statement have no field, parameter, or path of any kind to persist `source_share_message_id`** — the insert writes only `user_id, project_id, client_id, source_type, raw_input, ai_summary, status, created_by, analyzed_at`. If Phase 6A widened `ProjectUpdateV2AnalyzerInput`'s `sourceType` (currently narrowed to `"text" | "image"`, `project-update-facts.types.ts:17`) to also accept `'client_share'` without simultaneously adding the paired id parameter and persistence wiring, any call constructed with `sourceType: 'client_share'` would pass TypeScript type-checking but fail at the database with the new coupling CHECK violation from correction F (`source_type='client_share'` inserted with `source_share_message_id` unset, i.e. `NULL`) — a confusing runtime failure standing in for what should have been a compile-time impossibility.

**Resolution, locked:** Phase 6A widens only the passive/display `ProjectUpdateSourceType` union and the DB CHECK constraint (correction A). It does **not** touch `ProjectUpdateV2AnalyzerInput`, `CreateProjectUpdateInput`, or any other type that participates in constructing an actual call into the analyze/persist pipeline. Phase 6B is where `ProjectUpdateV2AnalyzerInput`/`CreateProjectUpdateInput` are extended as a discriminated, trusted-server contract — `sourceType: 'client_share'` REQUIRES a `sourceShareMessageId`, enforced at the TypeScript level, not merely by convention — and where `source_type` + `source_share_message_id` are persisted together in the same insert that creates the durable slot. No Client Share analyzer invocation of any kind exists before 6B.

**H — Provenance, once established, must be immutable at the database level, not by UI/API convention.**
Audited `project_updates`'s RLS and grants (`supabase/migrations/202605250001_project_update_engine.sql:254-284`). **Confirmed a materially broader security model than the Client Share feature's own tables**: `project_updates` has a plain, unrestricted `for update using (auth.uid() = user_id) with check (auth.uid() = user_id)` RLS policy — no column-level restriction — and no explicit `grant` statement anywhere for this table (relying on Supabase's default broad `authenticated` grant, unlike every Client Share table, which explicitly `revoke`s the default grant and re-grants narrowly). This means, as the schema stands today, any authenticated owner's own generic `.update()` call against their own row could change **any** column, including the new `source_type`/`source_share_message_id` once added — there is currently no mechanism, column-privilege or otherwise, that would stop it. A column-level `grant update (...)` restriction (the pattern used elsewhere in this codebase, e.g. `project_share_links`'s `view_count, last_viewed_at`) was evaluated and rejected here as introducing a much larger, error-prone allowlist across every column any existing legitimate flow (`markProjectUpdateAsAnalyzed`, `apply_project_update_transaction`) already needs to set, for no more safety than a two-column trigger provides.

**Resolution, locked:** a `before update` guard, combined into the same trigger function as correction F's insert-time checks (firing `before insert or update`, gated by `if TG_OP = 'UPDATE' then ... end if;` for the immutability half), rejects **any** change to `source_type` or `source_share_message_id` on an existing row, in either direction — uniformly covering message A → message B, `'client_share'` → any other value, a non-null id → `NULL`, and a pre-existing normal (`'text'`/`'image'`/etc.) row being retroactively turned into a `'client_share'` one. No exception is carved out for any caller, including a future 6B/6C retry-in-place mechanism — the supplemental report's own "update-in-place" resume/retry design (correction E) updates *result* state (`ai_summary`, `status`, items, timestamps), never the two source-identity columns, so this immutability rule does not conflict with it. Verified non-breaking: neither `markProjectUpdateAsAnalyzed` nor `apply_project_update_transaction` (the only two existing writers of `project_updates` rows after creation) ever sets `source_type` or (necessarily, since it doesn't exist yet) `source_share_message_id` — the trigger changes the behavior of zero existing code path.

**I — Proving ownership/project/author-type match is not sufficient; the row's own `raw_input` must be proven equal to the referenced message's `body`, not merely permitted to reference it.**
Discovered during Phase 6A runtime-harness acceptance review, still Phase 6A scope (not deferred to 6B): corrections F/H prove that a `client_share` row's `source_share_message_id` points at a real, owned, same-project, client-authored message — but nothing previously constrained the row's own `raw_input` column to actually equal that message's `body`. As originally implemented, an authenticated owner's existing direct `project_updates` UPDATE/INSERT surface (the same broad, unrestricted RLS access correction H's own audit already found) could legitimately reference a real `share_messages.id` while supplying unrelated, browser-controlled text as `raw_input`, producing a durable `source_type = 'client_share'` row whose claimed source does not match its actual content. This directly conflicts with the already-locked product rule (§4.11): *"The server must load `share_messages.body` itself. The browser must never send the client message body back as trusted `rawInput`."* A row that passes every identity check in corrections F/H but carries fabricated content still violates that rule in substance, even though no single prior check catches it.

**Resolution, locked:** the same trigger function is extended, not duplicated. On insert (or on any update where `source_share_message_id` is non-null), after the existing owner/project/author-type checks, it additionally loads the referenced message's `body` and requires `new.raw_input is not distinct from` that value — exact equality, no `trim`/case-fold/hash/other reinterpretation — failing closed with a new stable code, `PROJECT_UPDATE_SOURCE_MESSAGE_BODY_MISMATCH` (`P0001`), otherwise. On update, the existing immutability guard is extended so that once a row's `source_share_message_id` was already non-null, `raw_input` can never subsequently change either (rejected with the same `PROJECT_UPDATE_SOURCE_PROVENANCE_IMMUTABLE` code corrections F/H already use for the two source-identity columns) — the message body is itself already immutable (`enforce_share_message_integrity`, unmodified), so a client-share row's content has no legitimate reason to ever drift from it post-insert. This rule is deliberately **not** broadened to ordinary `text`/`image`/`email`/`manual` rows (`source_share_message_id is null`) — their `raw_input` remains exactly as freely editable as it always was; only content genuinely claiming Client Share provenance is held to this standard. Phase 6B's own future route satisfies this trivially by construction (it loads the message body server-side and persists exactly that value, never a caller-supplied `rawInput`, per the already-locked §4.11 rule) — this is a database-level backstop proving that rule, not a new constraint 6B has to design around.

---

## 6. Locked phase structure

### Phase 6A — Durable source + analyze-idempotency foundation

**Purpose:** the durable schema/type foundation only — nothing owner-facing, nothing that touches conversion writes.

**In scope:**
- Additive migration: `project_updates.source_share_message_id uuid null references public.share_messages(id) on delete restrict` (correction F — `restrict`, not `set null` or `cascade`)
- Partial unique index: `create unique index ... on public.project_updates (source_share_message_id) where source_share_message_id is not null`
- DB CHECK constraint coupling the two fields: `source_type = 'client_share' iff source_share_message_id is not null` (correction F)
- One combined `before insert or update` trigger enforcing: on insert, cross-table integrity for any non-null `source_share_message_id` (referenced `share_messages` row exists, `author_type='client'`, same `user_id`, same `project_id` as the `project_updates` row, **and `raw_input` exactly equals that message's `body`**); on update, immutability — any change to `source_type` or `source_share_message_id` on an existing row is rejected, in either direction, and `raw_input` additionally cannot change once a row's `source_share_message_id` was already non-null (corrections F, H, and I)
- `project_updates_source_type_check` extended to accept `'client_share'`
- `ProjectUpdateSourceType` TS union (the passive, display-oriented type) extended to accept `'client_share'` — **the analyzer's own actionable input contracts (`ProjectUpdateV2AnalyzerInput`, `CreateProjectUpdateInput`) are explicitly NOT extended** (correction G), and **the public `POST /api/project-updates/analyze` request Zod schema is explicitly NOT extended** (correction A)
- Migration shape tests, static/type-level tests proving the structural uniqueness, coupling/integrity, FK-delete, and immutability invariants (correction E — structural only; no operational resume/retry/concurrency behavior belongs here)

**Explicitly excluded from 6A:**
- No owner-facing UI of any kind
- No convert API route
- No change to `apply_project_update_transaction`
- No write path — grant, RPC, or otherwise — to `share_message_conversions` (per correction B)
- No `status='converted'` behavior anywhere
- No widening of the public generic analyze route's request contract (per correction A)
- No widening of the analyzer's own actionable input type or the persistence-layer input type (per correction G) — no Client Share analyzer invocation exists in 6A
- No find/resume/retry/concurrent-request algorithm or tests — that is a Phase 6B deliverable (per correction E)

**Exit criteria:**
- The additive migration is internally coherent and fail-closed
- One source share message can structurally own at most one `project_updates` slot (proven by the partial unique index + FK)
- The `client_share` ⇔ `source_share_message_id is not null` coupling constraint rejects both invalid states (correction F)
- Cross-table integrity rejects a cross-user, cross-project, or owner-authored (non-`'client'`) source message (correction F)
- A `client_share` row whose `raw_input` does not exactly equal the referenced message's `body` is rejected with `PROJECT_UPDATE_SOURCE_MESSAGE_BODY_MISMATCH` (correction I)
- A hard delete of a referenced `share_messages` row is blocked (`on delete restrict`) while any `project_updates` row still references it — provenance is never silently erased or contradicted (correction F)
- Once set, `source_type`/`source_share_message_id` cannot be changed by any subsequent `UPDATE`, in any direction, on any row (correction H); once a row's `source_share_message_id` was already non-null, `raw_input` cannot subsequently change either (correction I), while an ordinary `text`/`image`/`email`/`manual` row's `raw_input` remains freely editable
- Existing text/image (and any other pre-existing) `project_updates` rows and callers are completely unaffected — `source_share_message_id` stays `NULL` for all of them, zero behavior change; `markProjectUpdateAsAnalyzed` and `apply_project_update_transaction` continue to update exactly the columns they already update today
- No call can be constructed anywhere in the codebase that is TypeScript-valid but would violate the new DB coupling constraint — verified by the fact that no actionable input type was widened (correction G)
- The public `POST /api/project-updates/analyze` route still rejects (or silently collapses, matching its current behavior) any caller-supplied `'client_share'` value exactly as it would any other unrecognized value today — verified by a test, not assumed
- No new `public`/`anon` privilege is introduced anywhere
- All targeted/static tests pass, including every case listed in §9's Phase 6A test list
- TypeScript may be run if needed for the type-contract changes
- The user alone runs any full build
- No Production application of any kind

### Phase 6B — Explicit server-authorized Analyze + existing review (NOT YET AUTHORIZED)

**Purpose:** let an authenticated owner explicitly choose an eligible client message and analyze it through the existing Client Update system.

**Required flow:** Client Communication History → explicit "Analyze as client update" action → **new, dedicated** authenticated Client Share owner route (not the public generic analyze route, per correction A) → server proves owner/share-link/message/project/`author_type='client'` → server loads the immutable message body itself (never browser-supplied) → find-or-resume the one durable `project_updates` slot for that message (the operational algorithm, owned by this slice per correction E, built on top of 6A's structural foundation) → the same, unmodified analyzer service function called directly (not via HTTP) with `sourceType: 'client_share'` → no `ai_update_analyzed` timeline event → lands in the existing Client Update review experience (per correction D, with whatever minimal orchestration extension the mapping proves necessary).

**Requirements:** no browser-trusted message body; the public `POST /api/project-updates/analyze` route's request contract remains exactly as it is after 6A — still unable to accept `'client_share'` (correction A); no duplicate analyzer; no automatic Apply; no CRM/task mutation; no second review modal; duplicate-click/retry/concurrent-request all resolve to the same durable `project_updates` slot (this is where the find/resume/retry/concurrency algorithm from correction E is actually implemented and tested). This slice is also where `ProjectUpdateV2AnalyzerInput` and `CreateProjectUpdateInput` are finally widened — as a discriminated contract where `sourceType: 'client_share'` requires a paired `sourceShareMessageId`, with both persisted together in the single insert that creates the durable slot — closing the gap correction G identified and deliberately left open through 6A.

### Phase 6C — Atomic Apply + conversion closure (NOT YET AUTHORIZED)

**Purpose:** extend the one existing authoritative Client Update Apply transaction so a Client Share conversion closes atomically.

**Required all-or-nothing result:** existing accepted work mutations + existing normal Apply timeline effects + `share_message_conversions` trace + `share_messages.status='converted'` + correct `reviewed_at` semantics + converted-terminal enforcement — **or none of it**, on any failure.

**Requirements:** source message identity read from the durable `project_updates` row, never from browser input; no second Apply path; the existing Apply API contract/signature stays unchanged wherever repository evidence allows it; normal non-`client_share` Client Updates remain behaviorally unchanged; `share_message_conversions` receives no broad direct write grant (per correction B/C); any privileged helper is treated as a full, independent security boundary if it is independently callable (per correction C); `set_share_message_status` cannot transition a message FROM `'converted'`; the owner UI cannot offer ordinary status mutation on a converted message.

### Phase 6D — Runtime / security / lifecycle acceptance (NOT YET AUTHORIZED)

Must verify, against real disposable Supabase runtime evidence (and minimal real Preview/browser acceptance where appropriate): analyze double-click; request retry; concurrent Analyze; same message → exactly one `project_updates` slot; analyzed/reviewed resume; failure retry rules; `client_share` Analyze creates no professional timeline event; text/image Analyze unchanged; cross-tenant denial; cross-project denial; cross-share-link denial; owner-reply denial; deleted-project denial; revoked-history + live-project **positive** case; converted-terminal state; Apply atomic rollback if the conversion trace fails; Apply atomic rollback if the message-status transition fails; a work-mutation failure leaves communication unchanged; a successful Apply closes work + trace + converted state together; the public message projection still leaks no private conversion metadata; Phase 5 reply/review/resolve/dismiss/unread regressions; existing Client Update text/image/apply regressions. The user alone runs a full build before phase closure. Manual task conversion remains explicitly out of scope.

---

## 7. Exact expected file/migration/API/RPC/UI boundaries per slice

| Slice | Migration | New/changed files | RPC surface | UI |
|---|---|---|---|---|
| 6A | Yes — one additive migration (new column with `on delete restrict`, new partial unique index, coupling CHECK constraint, one combined insert+update integrity/immutability trigger, `source_type` CHECK extension) | `lib/project-updates/project-update-types.ts` (the passive `ProjectUpdateSourceType` TS union only); new/extended migration `.test.ts`. **`app/api/project-updates/analyze/route.ts` and its request-level Zod schema, and the analyzer's own actionable input types (`ProjectUpdateV2AnalyzerInput`, `CreateProjectUpdateInput`), are explicitly NOT touched** (corrections A and G) | None new | None |
| 6B | No (uses 6A's schema) | New, dedicated route under `app/api/share-links/[id]/messages/[messageId]/...` (never the public generic analyze route, correction A); new repository function in `lib/share/share-messages-repository.server.ts` (server-side body load + ownership/author-type proof); `ProjectUpdateV2AnalyzerInput`/`CreateProjectUpdateInput` widened as a discriminated, paired contract (correction G); the find/resume/retry/concurrency service logic (correction E); minimal, evidence-driven extension to existing Client Update review orchestration (per correction D) | None new beyond what 6A/6C define | New "Analyze as client update" action surfaced from `client-communication-history-modal.tsx`'s `MessageCard`, opening the **existing** review experience |
| 6C | Yes — extends `apply_project_update_transaction` in place (unchanged signature wherever possible) + `set_share_message_status` (terminal guard) + resolves correction C's helper-vs-inline design question | `app/api/share-links/[id]/messages/[messageId]/route.ts` (new terminal-status error mapping); `lib/project-updates/v2/project-update-v2-analyzer.server.ts` (timeline-skip branch, if not already landed in 6B) | Extended `apply_project_update_transaction`; extended `set_share_message_status`; the resolved design from correction C for the conversion write itself | `MessageCard` gains a terminal-state guard (no status buttons, no Reply, "Converted" badge) |
| 6D | No | Test files only, across the above | None new | None new |

## 8. Explicit do-not-do list (applies across all of 6A-6D unless a specific slice's own authorization says otherwise)

- Do not build a second Client Update analyzer.
- Do not build a second task/apply system.
- Do not let a client message automatically mutate a project, task, Client Update state, CRM data, or Project Timeline data.
- Do not allow any public/client-side conversion action.
- Do not grant direct anonymous or broad-authenticated access to Client Updates, tasks, `share_message_conversions`, or project tables.
- Do not use unsafe casts, suppressions, temporary patches, or duplicate APIs.
- Do not fail open on ownership/scope uncertainty — fail closed, matching every existing Client Share RPC.
- Do not invent a project-level "archived" restriction (§4.16).
- Do not build any manual task conversion/prefill UI (§4.17).
- Do not treat a `security definer` helper's callers as trusted by convention — secure it as an independent boundary (§5.C).
- Do not change `apply_project_update_transaction` to `security definer` (§5.C).
- Do not open `share_message_conversions` write access before 6C's atomic design is complete (§5.B).
- Do not widen the public `POST /api/project-updates/analyze` request contract to accept `'client_share'` at any point — only the dedicated Phase 6B owner route may ever produce a `'client_share'` analysis, and only from a server-loaded message body (§5.A).
- Do not implement or test find/resume/retry/concurrent-request behavior in Phase 6A — that is a Phase 6B deliverable; 6A proves structural uniqueness only (§5.E).
- Do not use `on delete set null` or `on delete cascade` on `source_share_message_id` — only `on delete restrict` keeps the coupling constraint and the professional `project_updates` record coherent (§5.F).
- Do not widen `ProjectUpdateV2AnalyzerInput` or `CreateProjectUpdateInput` (the analyzer's actionable input types) in Phase 6A, and do not allow any change to `source_type`/`source_share_message_id` on an existing row from any caller, including a future retry/resume mechanism (§5.G, §5.H).

## 9. Tests and runtime acceptance matrix

Full detail lives in the supplemental report §9 (analyze idempotency, timeline isolation, atomic apply, authorization, status-terminal, and regression categories) — that matrix is accepted as written, **except that its analyze-idempotency category is now split by correction E**: the structural half below belongs to 6A, the operational half (find/resume/retry/concurrent-request) belongs to 6B.

**Phase 6A test list (structural/static/migration-level only — this is the complete, locked list for this slice):**
- One message cannot back two `project_updates` rows (partial unique index violation on a second insert with the same `source_share_message_id`).
- `source_type = 'client_share'` with `source_share_message_id IS NULL` fails the coupling CHECK constraint.
- A non-null `source_share_message_id` with `source_type <> 'client_share'` fails the coupling CHECK constraint.
- A `source_share_message_id` referencing a message owned by a different user fails cross-table integrity.
- A `source_share_message_id` referencing a message from a different project (even same owner) fails cross-table integrity.
- A `source_share_message_id` referencing an owner-authored (`author_type='owner'`) message fails cross-table integrity.
- A `source_share_message_id` referencing a valid, client-authored, same-owner, same-project message succeeds.
- A `client_share` row whose `raw_input` exactly equals the referenced message's `body` succeeds; the same id with any different `raw_input` fails with `PROJECT_UPDATE_SOURCE_MESSAGE_BODY_MISMATCH`.
- A `client_share` row's `raw_input` cannot be changed by a later `UPDATE` (rejected with `PROJECT_UPDATE_SOURCE_PROVENANCE_IMMUTABLE`); an ordinary row's `raw_input` remains freely editable, proving the rule was not broadened beyond Client Share provenance.
- Existing normal Client Update provenance (`source_type` in `'text'`/`'image'`/`'email'`/`'manual'`, `source_share_message_id = NULL`) remains valid and completely unaffected — regression.
- No grant, RPC, or policy exists anywhere that allows a write to `share_message_conversions` (a structural/source-scan assertion, matching this codebase's established "boundary" test pattern).
- The public `POST /api/project-updates/analyze` route rejects (or collapses, matching current behavior for any unrecognized value) a request claiming `sourceType: 'client_share'` — proving correction A's public/internal split holds, not just asserting it in prose.
- No Client Share analyzer invocation is constructible in 6A — `ProjectUpdateV2AnalyzerInput`/`CreateProjectUpdateInput` remain unchanged, verified by a type-level or source-scan assertion (correction G).

**Provenance immutability (correction H — new category, structural/migration-level, locked for 6A):**
- Attempting to update a `client_share`-sourced row's `source_share_message_id` from message A to message B fails.
- Attempting to update a `client_share`-sourced row's `source_type` to `'text'`/`'image'`/`'email'`/`'manual'` fails.
- Attempting to null out a `client_share`-sourced row's `source_share_message_id` via a direct update fails.
- Attempting to retroactively turn an existing normal (`'text'`/`'image'`/etc.) row into a `'client_share'` row via a direct update fails — no exception exists for this transition anywhere.
- Updating any *other* column on a `client_share`-sourced row (mirroring exactly what `markProjectUpdateAsAnalyzed`/`apply_project_update_transaction` already legitimately do — `status`, `ai_summary`, `reviewed_at`, `applied_at`, etc.) still succeeds — the trigger blocks only the two source-identity columns, nothing else (regression against the existing apply/analyze test suites).

**Delete/FK (correction F — new category, structural/migration-level, locked for 6A):**
- A hard `DELETE` of a `share_messages` row referenced by a `project_updates.source_share_message_id` fails (`on delete restrict`), leaving both rows intact and provenance uncorrupted.
- A hard `DELETE` of a `share_messages` row with **no** referencing `project_updates` row succeeds normally (the restriction is scoped, not a blanket lock on the table).

**Phase 6B and later** own every remaining category from the supplemental report's §9 exactly as originally scoped: operational analyze idempotency (double-click, retry, concurrent requests, resume, all now understood as 6B's own deliverable per correction E) applies to 6B; timeline isolation, atomic apply, authorization, and status-terminal tests apply to 6C; the full real-runtime acceptance pass — including the four explicit manual/Preview checks (end-to-end convert on an active link; convert on a revoked link with real history; confirm a converted message's status buttons are blocked in the UI; confirm no timeline event appears until Apply) — applies to 6D.

## 10. Production / rollout boundary

No slice in this plan authorizes Production SQL, Production migration application, Production deploy, or enabling `TEXT2TASK_CLIENT_SHARE_ENABLED` for real users. Every slice targets the disposable/Preview environment only, exactly as every prior phase of this engagement has. Production rollout remains a separate, future, explicitly-requested action, not implied by any exit criteria in this document.

## 11. User-owned actions

- Running any full build (`next build` or equivalent), at 6A's exit and again at 6D's close.
- Deciding whether/when to apply any Phase 6 migration to the disposable Supabase environment.
- Approving 6B, 6C, and 6D individually — none are authorized by this document.
- All git add/commit/push actions.
- Any eventual Production rollout decision.

## 12. Exact Phase 6A implementation authorization

**Phase 6A — and only Phase 6A — is authorized for implementation in a future turn**, scoped exactly as written in §6's "Phase 6A" block and bounded by all eight corrections in §5, most directly:
- **A** — durable/passive type prerequisites only; the public generic analyze route's request contract is never touched, in 6A or any later slice, except by the dedicated 6B owner route pattern described in §6's Phase 6B block.
- **B** — zero write access to `share_message_conversions`.
- **E** — structural uniqueness/integrity only; no operational find/resume/retry/concurrency algorithm or test.
- **F** — the coupling CHECK constraint, cross-table integrity enforcement, and `on delete restrict` FK action are mandatory parts of 6A's migration, not optional hardening; `on delete set null`/`cascade` are explicitly rejected.
- **G** — the analyzer's own actionable input types (`ProjectUpdateV2AnalyzerInput`, `CreateProjectUpdateInput`) are never widened in 6A — only the passive `ProjectUpdateSourceType` union and the DB CHECK constraint move.
- **H** — a database-level immutability trigger, not UI/API convention, is mandatory in 6A's migration: `source_type`/`source_share_message_id` can never change on an existing row, in either direction, for any caller.

Implementation of 6A may include: the additive migration (column with `on delete restrict`, partial unique index, coupling CHECK constraint, one combined insert-integrity/update-immutability trigger, `source_type` CHECK extension), the passive `ProjectUpdateSourceType` TS extension, and their corresponding tests (§9's Phase 6A test list, including the new provenance-immutability and delete/FK categories). It may not include any file, route, RPC, or UI listed under 6B, 6C, or 6D in §7; it may not touch `app/api/project-updates/analyze/route.ts` or its request Zod schema at all; and it may not touch `ProjectUpdateV2AnalyzerInput`/`CreateProjectUpdateInput`.

**6B, 6C, and 6D are explicitly NOT authorized** by this document. Each requires its own separate, explicit authorization turn before any implementation work begins on it.

## 13. Exact stop point after Phase 6A

Once Phase 6A's migration, type-contract changes, and tests are implemented and its exit criteria (§6) are met: **stop**. Do not begin any 6B file, route, or UI work. Do not touch the public generic analyze route or its request schema (that remains out of scope through 6A entirely, per correction A). Do not widen `ProjectUpdateV2AnalyzerInput`/`CreateProjectUpdateInput` (that is 6B's, per correction G). Do not implement any find/resume/retry/concurrency logic (that is 6B's, per correction E). Do not run a full build (that is a user-owned action per §11). Do not commit, push, deploy, or touch Production. Report 6A's exit-criteria status and wait for explicit authorization to proceed to 6B.

## 14. Copy-paste continuation text for a future conversation

```
TEXT2TASK CLIENT SHARE — PHASE 6A IMPLEMENTATION

Authoritative documents, in this order:
1. docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6_ACCEPTED_PLAN_2026-08-21.md
2. docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6_SUPPLEMENTAL_MAPPING_AND_DESIGN_VALIDATION_2026-08-21.md
3. docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_5_AUDIT_AND_PLAN_2026-08-19.md

Implement Phase 6A exactly as scoped in the Accepted Plan's §6 "Phase 6A"
block, bounded by its §5 corrections A, B, E, F, G, and H:
- additive migration for project_updates.source_share_message_id
  (nullable FK to share_messages, ON DELETE RESTRICT -- not SET NULL,
  not CASCADE) + partial unique index (non-null values only)
- DB CHECK constraint coupling the fields: source_type = 'client_share'
  IF AND ONLY IF source_share_message_id IS NOT NULL
- one combined before-insert-or-update trigger:
  - on insert: cross-table integrity for any non-null
    source_share_message_id (referenced share_messages row exists,
    author_type='client', same user_id, same project_id as the
    project_updates row)
  - on update: reject ANY change to source_type or source_share_message_id
    on an existing row, in either direction, for any caller
- project_updates_source_type_check extended to accept 'client_share'
- ProjectUpdateSourceType TS union (the passive/display type only)
  extended to accept 'client_share'
- matching migration-shape/static/type tests, covering exactly the
  Phase 6A test list in the Accepted Plan's §9 (structural uniqueness,
  coupling constraint both directions, cross-user/cross-project/
  owner-authored rejection, valid-provenance acceptance, existing-data
  regression, no share_message_conversions write path, public analyze
  route still rejects 'client_share', no Client Share analyzer
  invocation constructible, provenance immutability in both directions,
  restrict-on-delete behavior)

Do NOT touch share_message_conversions' grants/RLS/write path in any way.
Do NOT touch app/api/project-updates/analyze/route.ts or its request Zod
schema -- the public generic analyze endpoint must never accept
'client_share' as a caller-supplied value (correction A).
Do NOT widen ProjectUpdateV2AnalyzerInput or CreateProjectUpdateInput --
the analyzer's actionable input contract stays 'text'|'image' through
all of 6A; widening it without the paired sourceShareMessageId parameter
and insert-time wiring would let a type-valid call violate the new DB
coupling constraint (correction G). That extension is Phase 6B's job.
Do NOT implement any find/resume/retry/concurrent-request algorithm --
that is Phase 6B's deliverable, not 6A's (correction E).
Do NOT use ON DELETE SET NULL or CASCADE on source_share_message_id --
only RESTRICT keeps the coupling constraint coherent (correction F).
Do NOT build any owner-facing UI, convert API route, or Apply RPC change.
Do NOT run a full build (user-owned). Do NOT commit/push/deploy/touch
Production/SQL against Production.

Stop after 6A's exit criteria are met and report status. 6B is not
authorized.
```

---

Stopping here per this turn's DOCUMENTATION ONLY scope. No application code, migration, or SQL was created or run.
