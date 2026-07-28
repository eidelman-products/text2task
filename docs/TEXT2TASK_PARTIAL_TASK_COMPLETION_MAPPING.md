# Text2Task — Partial/Mixed-Completion False-"Done" Bug: Root-Cause Mapping

Status: **Mapping only. No application code was modified.**
Repository: `C:\Users\Home\projects\inboxshaper`. Branch `main`. HEAD at mapping time: `79c8899` ("Add accessible deadline date picker"). Working tree clean before and after this investigation.

---

## 1. Executive verdict

The bug is **caused by deterministic, non-AI code, not by an AI reasoning failure**, and it is architecturally guaranteed to recur for any client update where a completion phrase ("is complete", "is done", "signed off", "looks good", etc.) appears anywhere in the text describing a task — regardless of what else, including directly contradicting language, appears in the same sentence.

**Confirmed root cause (code-proven, not a hypothesis):** `lib/project-updates/v2/project-update-facts.server.ts`, function `hasTaskCompletionCue` (lines 158–169) inside `repairFactsShape` (lines 440–499). This runs on every AI-extracted subtask fact, on the **live, only-in-production pipeline** (both text and screenshot updates funnel through it), and unconditionally overwrites `status: "Done"` whenever a completion-phrase regex matches anywhere in the fact's `title` or `description` — with **zero negation, contrast, or scope awareness**, and it **overrides whatever the AI model itself decided**. For the reproduction text ("The desktop design is complete, and the mobile layout is still in progress."), the substring "is complete" trips the very first regex; the adjacent "still in progress" clause is never inspected by this function or anything downstream.

**Compounding architectural limitation (also confirmed):** the entire schema — from the AI's structured output, through the deterministic Judge, to the database `tasks.status` column itself — models status as **one flat enum value per task**. There is no field anywhere in the pipeline that can represent "part of this compound task is done, part is not." Even a perfectly-reasoning AI model has nowhere to put a nuanced answer; it must collapse to a single value.

**Severity is higher than the reported symptom alone suggests:** this investigation confirmed (Track C, §9 below) that if the falsely-completed subtask happens to be the *last remaining active subtask* in its project, the **same database transaction** that applies the false Done also triggers `reconcile_project_completion`, which will atomically mark the **entire parent project** as Done. A single AI misjudgment, uncaught by any layer, can silently complete a project that is not actually finished.

This is a **combined** root cause (deterministic-guard gap is the confirmed, code-proven trigger; schema-cannot-express-mixed-state is the confirmed, code-proven architectural enabler that makes any fix at the "just add a keyword check" level fundamentally insufficient), with several confirmed contributing factors (prompt ambiguity, missing Judge-level validation, weak review UX, zero test coverage on the defective file, and an observability gap that would prevent diagnosing recurrences). Full classification with evidence is in §11.

**No database migration is required for the recommended fix** (§12–13) — the defect and its correct fix both live entirely in the TypeScript analysis/judge layer, upstream of the transactional RPC. The RPC and `tasks`/`projects` schema behave exactly as designed once given correct input.

---

## 2. Exact reproduction

**Existing subtask:** "Design desktop and mobile landing page layouts" (a single row in the `tasks` table, one `status` enum column, one `task_title` string — no internal structure representing "desktop" and "mobile" as separable components).

**Client update text:** "The desktop design is complete, and the mobile layout is still in progress."

**Actual system behavior:** the update is analyzed, and the system suggests "Mark Design desktop and mobile landing page layouts as Done." A user reviewing this in the Project Updates review card sees only that title (plus, if they expand a collapsed "Edit saved details" disclosure, a plain status dropdown) — the sentence that actually justifies or contradicts the suggestion is not shown at the point of decision. On Apply, the subtask's `status` column is set to `Done` in the database, unconditionally, with the "still in progress" clause never having reached any decision point in the pipeline.

**Expected behavior:** the system must not silently mark the whole compound subtask Done when the evidence is explicitly mixed. This mapping does not prescribe which of the product-acceptable outcomes (keep In Progress; propose In Progress instead of Done; record partial-progress information; require review) is correct — see §12 for the recommended architecture and §17 for the specific product decision this still requires.

---

## 3. Current repository state (Step 1)

| Item | Value |
|---|---|
| Current branch | `main` |
| Current HEAD | `79c8899` — commit message "Add accessible deadline date picker" |
| `git status --short` | *(empty — clean)* |
| Working tree clean? | Yes, confirmed both before and after this investigation |
| Framework | Next.js 16.1.6 (App Router), React 19.2.3 |
| Test tooling | Vitest 4.1.10 (`node` environment by default; `jsdom` available per-file for component tests, per the date-picker work) |
| Date Picker commit present? | **Confirmed** — `79c8899` is HEAD, exactly as expected |
| Dirty work overwritten? | None — tree was already clean; nothing was at risk |

No file was created, modified, or deleted during investigation except this one new report at the very end.

---

## 4. Complete end-to-end data-flow map (Step 2)

### 4.0 Critical architectural correction: the files named in typical bug-report intuition are dead code

Both live API routes —
- `app/api/project-updates/analyze/route.ts` (text updates)
- `app/api/project-updates/analyze-image/route.ts` (screenshot updates)

— call **`analyzeProjectUpdateV2`** (`lib/project-updates/v2/project-update-v2-analyzer.server.ts`). Neither route imports `lib/project-updates/project-update-analysis.server.ts` (the older, single-monolithic-schema "v1" analyzer) or `lib/project-updates/project-update-image-mapper.server.ts`. A repo-wide grep confirms these two files, plus `lib/project-updates/project-update-post-process.server.ts` (imported only by the dead v1 analyzer), have **no importers from any live route** — they are unreachable, orphaned "v1" code. This was independently confirmed by both Track A and Track B. **Any fix must target the live v2 files below; a fix applied to the v1 files would have zero production effect.**

### 4.1 The live pipeline, stage by stage

```
1. User-provided update (text) or screenshot (image)
        │
        ├─ TEXT: POST /api/project-updates/analyze         [app/api/project-updates/analyze/route.ts]
        │         rawInput = user's typed text, forwarded verbatim
        │
        └─ IMAGE: POST /api/project-updates/analyze-image   [app/api/project-updates/analyze-image/route.ts]
                  │
                  ▼
        2. extractProjectUpdateImageInstructions()          [lib/project-updates/project-update-image.server.ts]
           AI CALL #1 (image only): model "gpt-5.4", OpenAI Responses API, multimodal (input_text + input_image)
           Schema: { rawTranscription, requestedTasks: string[], deadlineMentions: string[],
                      priorityMentions: string[], budgetMentions: string[], clientNotes: string[] }
           — plain string arrays, NO status field of any kind at this stage.
                  │
                  ▼
           buildRawInputFromImageExtraction() stitches these into one text blob
           ("[Image update transcription]" + rawTranscription + bullet lists), which becomes
           `rawInput` for the SAME downstream pipeline as text updates. From here on, text and
           image updates are IDENTICAL — one shared judge, one shared schema.
        │
        ▼
3. loadProjectUpdateContext()                                [lib/project-updates/project-update-context.server.ts]
   Loads the project row, client row, and every existing (active) subtask row from Supabase.
   Output: { project, client, subtasks: [{ id, title, status, ... }] }
        │
        ▼
4/5. extractProjectUpdateFacts()  — AI CALL #2 (or #1 for text)  [lib/project-updates/v2/project-update-facts.server.ts]
   Model: "gpt-4.1-mini" (literal constant, line 11), OpenAI Chat Completions,
   single `user`-role message (no separate system prompt), JSON-object response format, temperature 0.1.
   PROMPT (verbatim excerpt — full text in §5): the model is explicitly told
     "Do NOT compare against the existing project" and "Do NOT decide whether it already exists" —
     i.e. it CANNOT see the existing subtask "Design desktop and mobile landing page layouts" at all
     at this stage; it only extracts facts from the raw client text in isolation.
   SCHEMA (verbatim in §5): each requestedSubtasks[] entry = { title, description, deadlineText,
     amount, status: "New"|"In Progress"|"Review"|"Urgent"|"Done"|null, priority }.
   ONE flat status enum per fact. No partial/mixed/coverage field exists.
        │
        ▼
   repairFactsShape()  — DETERMINISTIC, NOT AI            [same file, lines 440-499]
   ★★★ THIS IS THE CONFIRMED ROOT-CAUSE MECHANISM — see §6 for full detail. ★★★
   hasTaskCompletionCue(title) || hasTaskCompletionCue(description) → if true,
   status is unconditionally force-set to "Done", OVERWRITING whatever the model returned.
   For our reproduction text, "is complete" matches immediately; "still in progress" a few
   words later is never inspected.
        │
        ▼
6. Parsed/repaired facts object: { summary, requestedSubtasks: [...], projectChanges, clientChanges, notes, confidence }
   This is the exact object handed to the next stage — `requestedSubtasks[i].status` is
   ALREADY "Done" by this point, unconditionally, if the regex matched.
        │
        ▼
7/8. judgeProjectUpdateFacts() → judgeRequestedSubtask()   [lib/project-updates/v2/project-update-judge.server.ts]
   DETERMINISTIC, NOT AI. For each fact independently (no cross-fact reconciliation):
     resolveSubtaskReference()                              [lib/project-updates/v2/project-update-subtask-reference.server.ts]
     — title-matching only; receives { candidateTitle, subtasks }, NEVER receives description/status/evidence.
     — For our reproduction, the fact's title closely/exactly matches the one existing subtask
       ("Design desktop and mobile landing page layouts") → outcome: "confident_match".
   Back in judgeRequestedSubtask (line 150): `const isCompletionFact = subtask.status === "Done";`
   — trusts this boolean as already-decided; NEVER re-derives it from text, NEVER inspects
     `subtask.description` for contradicting content (even though description is a parameter
     in scope and is copied verbatim into the decision's own `description` field one line later).
   Because the match is confident and the existing subtask isn't already Done, this produces:
     { kind: "apply", itemType: "update_subtask", title: "Mark Design desktop and mobile landing
       page layouts as Done", targetTaskId, targetField: "status", newValue: { status: "Done" },
       reviewLabel: "Apply", description: subtask.description || "<generic fallback>" }
   — THIS IS THE LITERAL STRING FROM THE BUG REPORT.
        │
        ▼
9. (No separate "Judge/verification layer" exists beyond the above — judgeProjectUpdateFacts
   IS the judge; there is no additional AI-based verification pass in the live pipeline.)
        │
        ▼
10. Post-processing: lib/project-updates/project-update-post-process.server.ts is DEAD CODE on
    this path (only reachable from the unreachable v1 analyzer) — it never executes for any
    real request. Zero opportunity to catch anything here, confirmed by both Track A and Track B.
        │
        ▼
11. buildProjectUpdateV2AuditItems() → project_update_items rows persisted   [v2/project-update-result-builder.server.ts, project-update-audit.server.ts]
    Suggested update plan: one row per decision, status = "suggested", description/ai_reason
    columns populated (ai_reason via buildAuditReason(): "Review result: Apply · <matching reason>"
    — this explains WHY THE TITLE MATCHED, not why status was judged Done).
        │
        ▼
12. Review-card rendering                                   [app/components/dashboard/tasks/project-updates/project-update-review-card.tsx]
    For a confident "apply"-kind update_subtask item, it renders in the "Ready to apply" list
    (ReadyUpdateRow) showing ONLY item.title. item.description/ai_reason are NOT rendered here
    (they're only shown for needs_review items, via NeedsReviewFindings). A collapsed "Edit
    saved details" disclosure (closed by default) reveals a plain 5-option status <select> —
    the user CAN downgrade the status here, but must proactively expand a closed disclosure to
    see it exists, and even then sees no reason to distrust the suggestion (no evidence shown,
    no visual distinction for Done vs. any other status).
        │
        ▼
13. User selection: user accepts the item (implicitly, by not deselecting it — items default
    to selected) and clicks "Save N changes" — one generic button/action for the whole batch,
    no per-item or per-Done confirmation.
        │
        ▼
14. Apply payload construction                               [lib/project-updates/project-update-apply.server.ts, app/api/project-updates/apply/route.ts]
    buildTransactionalApplyPayloadItem() for update_subtask: `if (status !== null) updates.status
    = status;` — mechanical copy, zero semantic validation. If the user edited the item via the
    disclosure, normalizeEditedNewValueForItem() validates only that the string is one of the 5
    enum values — no semantic check either way.
        │
        ▼
15. apply_project_update_transaction RPC                     [supabase/migrations/202607270001_project_completion_reconciliation.sql, lines 302-1212]
    update_subtask branch: validates structure/ownership only, then a blind
    `UPDATE tasks SET status = <value>, completed_at = case when done then now() else null end`.
    Zero semantic guard on Done anywhere in this function.
    ★ Then, unconditionally for any batch with ≥1 accepted item:
      `perform public.reconcile_project_completion(v_project.id, v_user_id, v_now);`
    — same transaction, same v_now. If this subtask was the LAST remaining active (non-Done)
      subtask in its project, the project's own status is ALSO atomically flipped to "Done"
      (priority → "Low", completed_at set). See §9 for full blast-radius detail.
        │
        ▼
16. Final task status shown in Task CRM: both the subtask AND (conditionally) its parent
    project now display "Done" throughout the dashboard — task lists, progress widgets,
    "due soon"/overdue alert surfaces (which filter on active/non-Done status), and the
    project's own summary card — reflecting a state that does not match reality.
```

### 4.2 Stage-by-stage table (as required by Step 2)

| # | Stage | File | Function | Input shape | Output shape | Status values in scope | Can create/modify/reject/downgrade/approve Done? | Has full original message? | Has exact existing task title? | Understands partial vs. whole? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | User input | (client) | — | raw text or image file | HTTP request body | n/a | n/a | Yes (it's the source) | No | n/a |
| 2 | Image extraction (image only) | `lib/project-updates/project-update-image.server.ts` | `extractProjectUpdateImageInstructions` | image (base64) | `{ rawTranscription, requestedTasks[], ... }` (no status field) | none — schema has no status | **Cannot create Done** (no status field exists) | Yes, transcribes it | No — explicitly forbidden from comparing to existing project | No status concept at all |
| 3 | Project context load | `lib/project-updates/project-update-context.server.ts` | `loadProjectUpdateContext` | projectId | `{ project, client, subtasks[] }` | reads existing DB statuses | Approve-only in the sense of supplying ground truth; does not itself decide anything | n/a (doesn't see the update text) | **Yes** — this is the one stage with the authoritative existing title | Sees whole-task status only (DB enum) |
| 4/5 | AI fact extraction | `lib/project-updates/v2/project-update-facts.server.ts` | `extractProjectUpdateFacts` (AI call) | project context + raw text | `ExtractedFacts` (unrepaired) | can set `status: "Done"` per fact | **Can create Done** (model's own choice) | Yes, full raw text in prompt | **No** — explicitly told not to compare against existing project | No partial/scope field in schema |
| — | Deterministic repair | same file | `repairFactsShape` → `hasTaskCompletionCue` | unrepaired facts | repaired facts | **force-overwrites to `"Done"`** | **Can create/override Done, cannot reject or downgrade** | Yes, but only pattern-matches, doesn't reason over it | No | **No — root cause: zero negation/scope awareness** |
| 6 | Parsed update items (intermediate) | same file | (return value) | — | `ProjectUpdateExtractedFacts` | already fixed by prior stage | n/a — just a data handoff | Yes (unused by any check) | No | No |
| 7/8 | Task reference resolution | `lib/project-updates/v2/project-update-subtask-reference.server.ts` | `resolveSubtaskReference` | `{ candidateTitle, subtasks }` only | `{ targetTaskId, confidenceScore, reason, outcome }` | none — doesn't see status at all | **Cannot touch status** (out of scope for this function) | **No — never receives description/evidence** | **Yes — its whole job** | No — pure title matching |
| 9 | Judge (decision layer) | `lib/project-updates/v2/project-update-judge.server.ts` | `judgeRequestedSubtask` | fact (incl. `status`, `description`) + matched subtask | `ProjectUpdateJudgeDecision` (`kind`, `newValue`, `description`, ...) | trusts `status === "Done"` boolean | **Can approve/pass-through Done; never rejects or downgrades based on description content** | **Yes, in scope as a parameter — but never inspected** | Yes (via the resolver's match) | **No — genuine gap: has the data, doesn't check it** |
| 10 | Post-processing | `lib/project-updates/project-update-post-process.server.ts` | `postProcessProjectUpdateItems` | — | — | — | **Never executes** (dead code on live path) | n/a | n/a | n/a |
| 11 | Suggested update plan / persistence | `lib/project-updates/project-update-audit.server.ts`, `v2/project-update-result-builder.server.ts` | `createProjectUpdateAuditRecord`/`Items`/`Timeline` | judge decisions | DB rows (`project_update_items`, `project_updates`) | stores `new_value.status` as-is | Approve-only (mechanical persistence) | Yes, persisted in `description`/`ai_reason` columns (not always populated with the contradicting clause) | Yes | No |
| 12 | Review-card rendering | `app/components/dashboard/tasks/project-updates/project-update-review-card.tsx` | `ReadyUpdateRow`, `EditableFields` | persisted item | rendered UI + editable status `<select>` | shows all 5 values in an edit control | **User CAN downgrade here — but evidence not shown, Done not visually flagged, edit control hidden behind a closed disclosure** | Description not rendered for ready items | Yes (title shown) | No — UI doesn't reason about it either |
| 13 | User selection | (client interaction) | — | — | accepted/rejected item IDs | — | User is the only real approval gate, and it's weak per above | Only what's visible in the UI (title only, for ready items) | Yes | No |
| 14 | Apply payload construction | `lib/project-updates/project-update-apply.server.ts` | `buildTransactionalApplyPayloadItem` | accepted item (possibly edited) | RPC mutation payload | mechanical copy | **Cannot reject — zero semantic validation** | Description present but unused for validation; used only for a timeline `event_summary` fallback that IS overridden to `item.title` for `update_subtask` specifically | Yes | No |
| 15 | Transactional RPC | `supabase/migrations/202607270001_...sql` | `apply_project_update_transaction` + `reconcile_project_completion` | mutation payload | DB row updates (`tasks`, `projects`, `project_timeline_events`) | blind `UPDATE ... SET status = ...` | **Cannot reject — purely mechanical; ALSO cascades to project-level Done via `reconcile_project_completion`** | No (SQL, no text reasoning) | n/a (operates on already-resolved `target_task_id`) | No — single enum column |
| 16 | Task CRM display | dashboard components (not the focus of this bug, but the observable symptom) | various | DB state | rendered UI | reads `tasks.status`/`projects.status` | n/a — display only | n/a | n/a | n/a |

---

## 5. Prompt/model/schema inventory (Step 4)

### 5.1 Live text-facts extraction — `lib/project-updates/v2/project-update-facts.server.ts`

**Model:** `PROJECT_UPDATE_FACTS_MODEL = "gpt-4.1-mini"` (literal constant, not env-configurable). OpenAI Chat Completions API, `response_format: { type: "json_object" }`, `temperature: 0.1`, single `user`-role message (no separate `system` message).

**Prompt (verbatim, `buildProjectUpdateFactsPrompt`):**

> You are Text2Task's Project Update V2 facts extraction engine.
>
> Your only job is to extract simple factual information from a client follow-up update.
> Do NOT decide whether anything is new, duplicated, already existing, unchanged, safe to apply, or needs review.
> **Do NOT compare against the existing project.**
> Do NOT create project_update_items.
> Do NOT output item types like new_subtask, update_subtask, duplicate_warning, no_action, deadline_change, or priority_change.
>
> The next system step will compare these facts against the existing project and decide what should be applied.
>
> Return JSON only. No markdown. No comments. No extra text.
>
> [... full JSON shape spec, matching the schema below ...]
>
> Facts extraction rules:
>
> 1. Requested subtasks
> - Extract each client-requested deliverable, task, section, update, or work item.
> - ...
> - **If the client says an existing deliverable is approved, signed off, done, completed, complete, looks good, or ready, extract that deliverable as a requestedSubtask with status "Done".**
> - For completion/approval language, keep the title focused on the deliverable itself and do not include status filler like approved now, signed off, done, completed, looks good, ready, or now in the title.
> - Use requestedSubtasks[].status = "Done" for task-specific approval/completion. Only use projectChanges.status when the whole project status changed.
> - Do not decide whether it already exists. Just extract the requested work.
>
> [... rules 2-6 for project-level changes, client changes, notes, missing values, source type ...]

**There is no instruction anywhere in this prompt about**: compound/multi-part tasks, partial completion, mixed/conflicting evidence, or any negation/contrast word (grepped literally for "but", "however", "still", "only", "partially", "not yet", "remaining", "while", "one part", "the rest" — zero matches in this prompt string).

**Schema (verbatim, `ExtractedFactsSchema`):**
```ts
const StatusSchema = z.enum(["New", "In Progress", "Review", "Urgent", "Done"]);
const NullableStringSchema = z.string().trim().min(1).nullable();

const ExtractedSubtaskFactSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: NullableStringSchema,
  deadlineText: NullableStringSchema,
  amount: NullableStringSchema,
  status: StatusSchema.nullable(),
  priority: PrioritySchema.nullable(),
});

const ExtractedFactsSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  requestedSubtasks: z.array(ExtractedSubtaskFactSchema).default([]),
  projectChanges: ExtractedProjectChangesSchema,
  clientChanges: ExtractedClientChangesSchema,
  notes: z.array(ExtractedNoteFactSchema).default([]),
  confidence: z.number().min(0).max(1).nullable(),
});
```

**Allowed status values, everywhere in this pipeline:** exactly `New | In Progress | Review | Urgent | Done` — a five-value string enum, one value per subtask fact. **No field exists for**: partial completion, mixed evidence, uncertainty (beyond the generic scalar `confidence: number`), a "do not change status" conclusion, or a review-required outcome (that concept exists one layer later, in the Judge's decision `kind`, not in this schema).

### 5.2 Deterministic post-repair — `repairFactsShape` / `hasTaskCompletionCue` (same file)

Not an AI stage — pure regex logic, run on every extracted fact unconditionally. Full detail and code in §6.

### 5.3 Live image extraction — `lib/project-updates/project-update-image.server.ts`

**Model:** `PROJECT_UPDATE_IMAGE_MODEL = "gpt-5.4"` — a **different** model from the text-facts stage, via OpenAI's Responses API (`openai.responses.create`), multimodal input (`input_text` + `input_image`, `detail: "auto"`).

**Schema:**
```ts
const ImageInstructionExtractionSchema = z.object({
  rawTranscription: z.string().default(""),
  requestedTasks: z.array(z.string()).default([]),
  deadlineMentions: z.array(z.string()).default([]),
  priorityMentions: z.array(z.string()).default([]),
  budgetMentions: z.array(z.string()).default([]),
  clientNotes: z.array(z.string()).default([]),
});
```
Plain string arrays — **no status field of any kind**. Its own prompt explicitly forbids status/classification judgments: *"Do not classify anything as new_subtask or update_subtask... Do not decide whether a task is new or existing... Only extract visible instructions into the simple JSON fields above."*

**Funnel point:** the extracted fields are stitched into one `"[Image update transcription]" + ...` text blob (`buildRawInputFromImageExtraction`) and handed to `analyzeProjectUpdateV2` as `rawInput`, with `sourceType: "image"`. **From this point forward, the image path is identical to the text path** — same `extractProjectUpdateFacts` call, same `repairFactsShape`, same judge, same schema. **The confirmed root-cause bug (§6) applies identically to screenshot updates**, once any completion language survives image transcription into the shared text blob.

### 5.4 Can the current schema express any of the required concepts?

| Concept | Exists? | Where |
|---|---|---|
| One part complete, another part incomplete | **No** | Nowhere — single `status` enum per fact, per subtask row |
| Progress without full completion | Only as the existing `"In Progress"` enum value — a whole-task state, not a partial-progress measure | `StatusSchema` |
| Mixed evidence | **No** | No such field |
| Uncertainty | Only a generic scalar `confidence: number \| null` — not scoped to *what* is uncertain | `ExtractedFactsSchema.confidence`, `ProjectUpdateJudgeDecision.confidence` |
| Partial completion notes | Only incidentally, if the model happens to put contradicting text into the free-text `description` field — but nothing downstream reads it (§6) | `description` |
| Suggested status of In Progress | **Yes, mechanically possible** — `"In Progress"` is a valid `StatusSchema` value the model could choose — but nothing steers the model toward it for mixed evidence, and `repairFactsShape` can override it back to `"Done"` regardless | `StatusSchema` |
| "Do not change status" conclusion | Exists at the Judge-decision level (`kind: "no_change"`) but only for "proposed value equals current DB value," never for "evidence is too mixed to decide" | `ProjectUpdateJudgeDecisionKind` |
| Review-required outcome | **Yes, exists and is wired** (`kind: "needs_review"`) — but only reachable via ambiguous/no title-match (cross-subtask confusion), never via within-subtask mixed evidence (§6, §8) | `ProjectUpdateJudgeDecisionKind`, `resolveSubtaskReference` outcomes |

---

## 6. Actual decision-maker analysis (Step 3) — the confirmed root cause

**Which layer first produced "Done"?** `repairFactsShape`, specifically `hasTaskCompletionCue`, in `lib/project-updates/v2/project-update-facts.server.ts`. This is **deterministic TypeScript code that runs after the AI call and unconditionally overrides the AI's own output** — it is not the model "hallucinating" or "reasoning incorrectly"; it is a fixed regex, guaranteed to produce the same result on the same input every time.

```ts
// lines 158-169
function hasTaskCompletionCue(value: string | null) {
  const normalized = String(value || "").toLowerCase().replace(/\s+/g, " ");
  return [
    /\b(?:is|are|was|were|be|been|being|has been|have been)\s+(?:approved|done|completed|complete|ready)\b/,
    /\b(?:approved|done|completed|ready)\s+now\b/,
    /\b(?:client|customer|they|he|she|we)\s+(?:approved|completed)\b/,
    /\bsigned\s+off\b/,
    /\blooks?\s+good\b/,
    /\b(?:is|are|was|were|be|been|being|seems?|looks?)\s+ready\b/,
  ].some((pattern) => pattern.test(normalized));
}

// lines 464-478, inside repairFactsShape, applied to every extracted requestedSubtask:
const hasCompletionCue = hasTaskCompletionCue(title) || hasTaskCompletionCue(description);
return {
  ...subtask,
  title: hasCompletionCue ? cleanCompletionCueFromTitle(title) : title,
  status: hasCompletionCue ? "Done" : subtask.status,   // ← unconditional override
};
```

For "The desktop design is complete, and the mobile layout is still in progress." — the normalized string contains the exact substring **"design is complete"**, which matches `/\b(?:is|are|was|were|...)\s+(?:...|complete)\b/` immediately. The function performs a single `.some()` scan over the whole string with **no negation lookahead/lookbehind, no clause segmentation, and no check for a subsequent contradicting phrase**. The moment it matches, `status` becomes `"Done"` — full stop, regardless of "still in progress" appearing a few words later in the identical string.

**Which later layers had the opportunity to reject or downgrade it, and why didn't they?**

| Layer | Had the data? | Checked it? | Verdict |
|---|---|---|---|
| Judge (`judgeRequestedSubtask`) | **Yes** — `subtask.description` is a function parameter, quoted verbatim into the decision | **No** — `isCompletionFact = subtask.status === "Done"` (line 150) trusts the already-decided boolean; no code path anywhere in this file reads the *content* of `description` | Genuine reasoning/validation gap — the evidence was visible and unused |
| Task reference resolver (`resolveSubtaskReference`) | **No** — receives only `{ candidateTitle, subtasks }`; description/status are never passed to it | N/A — not its job | Not a gap; correctly out of scope for this function |
| Post-processing (`project-update-post-process.server.ts`) | N/A | N/A | **Never executes** — dead code on the live path (§4.0) |
| Apply-payload construction | **Yes** — `item.description` is present on the loaded row | **No** — used only to populate a timeline `event_summary` fallback that is itself overridden to `item.title` for `update_subtask` items specifically; never gates the mutation | Genuine reasoning/validation gap |
| Transactional RPC | No (SQL layer, no NLP) | N/A | Correctly out of scope — a database function cannot be expected to parse English |

**Was the evidence sentence preserved intact at the decision-making stage?** Yes, in the sense that the raw text is stored (`project_updates.raw_input`, verified not-null and always the client's exact original text) and often echoed into `subtask.description`/`item.description`/`item.ai_reason`. **No**, in the sense that the field carrying it is never inspected by any conditional logic — it is purely decorative/display text from the Judge's perspective.

**Was "still in progress" visible to the deciding layer?** Visible in the sense of being in-memory and in-scope, yes (to `repairFactsShape` on the full description string, and to the Judge on `subtask.description`). Never actually read/parsed for its semantic content by either.

**Did the system reason at the level of the entire subtask, or only recognize the phrase "desktop design is complete"?** The latter, exclusively. `hasTaskCompletionCue` performs zero task-level reasoning — it is a stateless string-pattern test with no concept of "this subtask has two components."

**Did matching the existing compound task cause the partial clause to be lost?** No — confirmed independently by Track B via direct code reading. `resolveSubtaskReference` never touches `status` or `description` at all; it answers only "which task row does this title refer to." The clause was never lost by matching; it was made irrelevant by the earlier, unconditional `repairFactsShape` override, and then never re-examined by anything downstream.

**Is this primarily an AI reasoning failure, a schema limitation, a deterministic-guard gap, or a combination?** **A combination, with the deterministic-guard gap as the confirmed, reproducible trigger, and the schema limitation as the confirmed, architectural reason a real fix cannot simply be "read the description more carefully" without also changing what can be *expressed*.** Full classification in §11.

---

## 7. Compound-task semantics (Step 5)

**Does the data model support multiple deliverables within one subtask?** No. A `tasks` row has exactly one `task_title` (free text) and one `status` enum column. Nothing distinguishes "Design desktop and mobile landing page layouts" from a genuinely atomic task like "Send invoice" at the schema level — both are one row, one status.

**Is status only one enum value for the whole subtask?** Confirmed yes, at every layer: the extraction schema, the judge decision type, the `project_update_items.new_value` JSON shape, and the underlying `tasks.status` Postgres column are all single-value.

**Is there any notes/progress field that could safely hold partial state?** `tasks` (and the update-item persistence layer) has free-text fields (`description`, `ai_reason` on `project_update_items`; task-level notes are not part of this investigation's direct scope but are known from prior sessions to exist as a display field elsewhere in the app) that could *display* a partial-progress note, but nothing in the current status-transition logic reads such a field to gate a status decision. It would need new, deliberate wiring — it is not "already there, just underused."

**Would automatic task splitting be a dangerous scope expansion?** Yes — no existing splitting mechanism was found anywhere in the codebase across all four investigation tracks. Splitting a task after the fact would need to define: how it interacts with duplicate detection (`lib/tasks/project-duplicate-detection.ts`, `subtask-duplicate-detection.ts` — built to match on title similarity; splitting would immediately create near-duplicate-looking titles), task ordering/`subtask_order`, project progress counting (`reconcile_project_completion` counts active tasks — splitting mid-project changes the denominator), the audit/timeline trail (which currently references one `target_task_id` per event), and CSV export/analytics that assume stable task identity over time. None of this exists today; building it safely is a substantial, separate feature, not a bug fix.

**Is keeping the compound task In Progress the safest current semantic?** Given the current one-enum-per-task model, yes — "In Progress" (or an equivalent non-Done, review-flagged state) is the only status value that doesn't assert something false, and it requires zero data-model change.

**Existing logic for the other listed concerns:**
- **Duplicate detection**: exists (`lib/tasks/project-duplicate-detection.ts`, `subtask-duplicate-detection.ts`) but operates on title similarity for *new* task creation, not on partial-completion semantics — not directly implicated in this bug, but relevant to why splitting would be risky (see above).
- **Task reference matching / fuzzy matching**: `resolveSubtaskReference` (§4, §6) — exact/near-exact title match first, weighted token-overlap fallback. This is the ONLY existing "fuzzy" mechanism in the causal chain, and it is not itself the defect (§6).
- **Progress percentages**: none found anywhere in the schema or UI for individual tasks — status is the only progress signal.
- **Status inheritance**: none between subtasks and their project in the "downward" direction; only the "upward" direction (all-subtasks-Done → project Done) exists, via `reconcile_project_completion`.
- **Project auto-completion / "all subtasks Done" logic**: exists, confirmed live and correctly implemented for its own designed purpose (`reconcile_project_completion`, built in a prior, separate, already-verified session) — its correctness is not in question; its *interaction* with this bug is a severity amplifier (§9).

---

## 8. Conflict and negation handling (Step 6)

Reasoned directly from `hasTaskCompletionCue`'s actual regex logic (the one fully deterministic, code-provable layer in the chain) by Track B, cross-checked against the live prompt text by Track A:

| # | Input | `hasTaskCompletionCue` fires? | Why | Downstream fate |
|---|---|---|---|---|
| A | "Desktop is complete, mobile is still in progress." | **Yes**, on "is complete" | No negation scoping | Forced Done — **this is the exact reproduction** |
| B | "The copy is finished, but design is not done yet." | **No** for either clause — "finished" isn't a cue word; "is not done" fails because "is" isn't immediately followed by a cue word (it's followed by "not") | Adjacency requirement happens to protect this phrasing, incidentally, not by design | Outcome depends entirely on the model's own (unverifiable-without-execution) judgment; no code-level guard either way |
| C | "Homepage is done. Contact form still needs work." | "Homepage is done" → **yes**; "still needs work" → no cue words present | If extracted as two separate facts mapping to two separate existing tasks, each is handled correctly and independently — the bug requires ONE compound task, not two atomic ones | Correct outcome *if and only if* these are genuinely two separate task rows |
| D | "Most of the task is complete." | **Yes**, on "is complete" | No quantifier/hedge awareness ("most of") | Forced Done despite explicit partial-quantifier language — same bug class |
| E | "Draft completed; client approval is still pending." | **No** — "Draft completed" lacks the required adjacent auxiliary verb; no other pattern matches | Regex happens not to fire here | Model-dependent, unguarded either way |
| F | "Design is complete, except for mobile responsiveness." | **Yes**, on "is complete" | No "except"/exception-clause awareness | Forced Done — **same bug class as the primary reproduction, arguably even clearer intent** |
| G | "Not complete — only the first section is finished." | **No** — "finished" isn't a cue word; "Not complete" fails the adjacency requirement (auxiliary verb must directly precede a cue word; "Not" isn't one of the alternatives) | Regex happens not to fire | Model-dependent, unguarded |
| H | "Everything is complete." | **Yes**, on "is complete" | Correctly intended to fire here | **Correct outcome** — this is a legitimate full-completion case |
| I | "Desktop and mobile layouts are complete." | **Yes**, on "are complete" | Correctly intended to fire here (both components genuinely complete) | **Correct outcome** |
| J | "The task is still in progress." | **No** cue words present at all | Correctly does not fire | **Correct outcome** |

**Pattern**: the bug is **not limited to compound tasks with explicit "and."** It reliably fires for *any* text containing a bare completion phrase, irrespective of scope, hedging, quantification, or exception clauses (D, F reproduce the same class). It is *coincidentally* silent for some negation phrasings only because of the regex's narrow adjacency requirements (B, E, G) — this is **not a designed protection**, it is an accidental gap in the pattern's coverage, and for those cases the system has **zero deterministic guard either way**, leaving correctness entirely up to unverified, non-deterministic model behavior. **This confirms the bug is a systemic pattern-matching defect, not a narrow "compound task" edge case** — it affects single tasks with exceptions (F), quantified partial claims (D), and would affect approval-pending language (E) or explicit negation (G, B) *if* the model itself ever proposed Done for such phrasing, since nothing downstream would catch it regardless.

**Screenshot/image updates**: affected identically, once transcribed text re-enters the shared facts-extraction stage (§5.3) — confirmed by both Track A and Track B tracing the funnel point precisely.

---

## 9. Apply/audit blast radius (Step 7)

- **Can the user edit the suggested status before Apply?** Yes, via a plain 5-option `<select>` — but it is hidden behind a closed-by-default "Edit saved details" disclosure in the review card, not exposed inline.
- **Does the review card show the evidence needed to catch the mistake?** **No**, for the exact failure mode in this bug. `item.description`/`item.ai_reason` are rendered only for `needs_review` items (`NeedsReviewFindings`); a confident "apply"-kind item (which is what this bug produces) renders in the "Ready to apply" list showing **only the title** — the sentence that would let a human catch the contradiction is not shown at decision time.
- **Is the exact source sentence shown?** No, not directly in the ready-item flow. It is retrievable after the fact via the separate "Project update history" surface (`project-update-history-modal.tsx`, `app/api/project-updates/history/route.ts`), which does render `item.description` — but only as a forensic, after-the-fact lookup, not at the moment of decision.
- **Is Done visually distinguished as high-impact?** **No.** Confirmed — no conditional styling, icon, or warning keyed off `status === "Done"` anywhere in the review card. It renders identically to a Priority or Review-status suggestion.
- **Does completing a subtask automatically affect project status?** **Yes — and this is a confirmed, severe blast-radius finding.** `apply_project_update_transaction` calls `reconcile_project_completion` unconditionally at the end of any batch with ≥1 accepted item, in the **same transaction**. If the falsely-completed subtask is the last remaining active subtask, the parent **project's** `status` becomes `"Done"`, `priority` becomes `"Low"`, and `completed_at` is set — atomically, with the subtask mutation, with no separate confirmation step and no way to apply "just the subtask" without also risking the project cascade.
- **Does the apply RPC validate the semantic correctness of Done?** No — confirmed at both the TypeScript apply layer and the SQL RPC layer: both perform structural/ownership validation only, and mechanically execute whatever status value arrives.
- **Do history/audit records preserve the original suggestion vs. final applied value?** Partially. `project_update_items.new_value` is **overwritten in place** if the user edits it before applying (no separate "original AI suggestion" vs. "final applied value" columns) — `old_value` preserves the pre-update DB state (a real before/after diff), but not an AI-suggestion-vs-user-edit diff. `description`/`ai_reason` on the item row do survive the apply RPC untouched. The `project_timeline_events` row created at apply time, however, has its `event_summary` hard-set to `item.title` for `update_subtask` specifically (overriding the generic `description`-based fallback used by other item types) — so the durable audit-trail record of *this specific mutation* does not carry the reasoning, only the sibling `project_update_items` row does.
- **Is rollback possible?** **No dedicated undo exists anywhere in the Project Updates feature** (confirmed via repo-wide grep for undo/revert/rollback — no hits in this feature's code). Recovery is fully manual: a user must independently (1) edit the subtask's status back via the normal task-editing UI, and (2) if the project auto-completed, separately edit the project's status back — there is no automatic "un-complete" direction anywhere; `reconcile_project_completion` and the RPC are both strictly one-directional (toward Done only).
- **Are status updates idempotent?** Yes for `reconcile_project_completion` itself (guarded by `status is distinct from 'Done'`). The overall apply flow is protected from *double-processing the same suggestion* by claim/status guards on `project_updates`/`project_update_items` (not itself an idempotency concern for this bug).
- **Can a false Done trigger downstream behavior?** Yes, directly confirmed: project auto-completion (above), and by extension every dashboard surface that reads `tasks.status`/`projects.status`/`completed_at` — progress widgets, active/overdue task filters, and the project's own display state — would all reflect the false state immediately upon the same apply-response reload that the frontend performs.

---

## 10. Existing test coverage (Step 8)

**Complete inventory — 8 test files, 104 tests total, all currently passing** (`npx vitest run` on all 8, confirmed by Track D):

| File | Covers | Gap |
|---|---|---|
| `lib/project-updates/v2/project-update-judge.server.test.ts` | Title matching outcomes, ambiguous/ multi-candidate routing to `needs_review`, idempotent no-op on already-Done, 6 real production regression fixtures (Cedar Lane, Summit Growth, Harbor Fitness) | Zero coverage of within-subtask contradictory/negated evidence; the "partial completion" tests here are a *different* scenario (see below) |
| `lib/project-updates/v2/project-update-subtask-reference.server.test.ts` | Same matching space at the resolver-unit level | Same gap |
| `lib/project-updates/project-update-apply.server.test.ts` | Fail-closed guards (needs_review/duplicate never silently applied), target-id safety | No status-semantics coverage (not this file's job) |
| `lib/project-updates/v2/project-update-judge-deadline.server.test.ts` | Deadline comparison normalization only | Unrelated to this bug |
| `app/components/dashboard/tasks/project-updates/project-update-ui-types.test.ts` | needs_review bucket classification, summary-variant resolution | No coverage of ready-item evidence visibility |
| `app/components/dashboard/tasks/project-updates/project-update-review-card.test.tsx` | `deadline_change` item rendering only (built during the date-picker work) | **Zero coverage of `update_subtask`/status rendering at all** |
| `supabase/migrations/202607230001_project_update_needs_review_type.test.ts` | Static SQL string assertions for the `needs_review` type migration | N/A — not a behavior test |
| `supabase/migrations/202607270001_project_completion_reconciliation.test.ts` | Static SQL string assertions for `reconcile_project_completion`'s own guards (correctly proven safe *in isolation*) | Does not and cannot test whether the *input* it receives (a Done status) was itself justified — that's upstream of this migration's scope |

**On the existing "partial completion" tests — a critical clarification.** Two tests literally use the phrase "partial completion" (`project-update-judge.server.test.ts:224` and `:365`), but they test a **different failure mode**: a small claimed-done fragment (e.g. "First 4 Instagram posts") failing to confidently identify one specific task among *several similar candidates* (e.g. three separate campaign-deliverable subtasks) — a **cross-subtask reference-matching ambiguity**, correctly routed to `needs_review`. This is unrelated to our bug's mechanism, which is **within-subtask** contradictory evidence about a single, unambiguously-matched compound task. Do not mistake the existing coverage for covering this bug — it doesn't, and the test names could mislead a future engineer into thinking it does.

**The single most important finding**: `lib/project-updates/v2/project-update-facts.server.ts` — the file containing the confirmed root-cause `hasTaskCompletionCue`/`repairFactsShape` logic, on the live production path for both text and image updates — **has zero test coverage of any kind.** No test imports from this file at all.

**Is the exact reproduction tested anywhere?** **No — confirmed by explicit, exhaustive search across the entire repository. This scenario is completely untested.**

---

## 11. Root-cause classification (Step 10)

### Confirmed root cause (direct code evidence, reproducible from static analysis alone)

1. **Missing deterministic contradiction guard** — `hasTaskCompletionCue` (`lib/project-updates/v2/project-update-facts.server.ts:158-169`) is a pattern-matcher with zero negation/scope/exception awareness that **unconditionally overrides** the AI's own status decision. This is the mechanism that *guarantees* the reported reproduction, deterministically, on every run. Evidence: §6, cross-confirmed independently by both Track A and Track B with matching line numbers and matching regex analysis.
2. **Schema cannot express mixed state** — `ExtractedSubtaskFactSchema`, `ProjectUpdateJudgeDecision`, `ProjectUpdateItemType`, and the underlying `tasks.status` column all model exactly one enum value per task. No field exists anywhere for partial/mixed/scoped completion. This is the architectural reason the bug cannot be fixed by "just checking the text harder" without also changing what the system can *represent* — even a hypothetically perfect regex or perfect model output still has nowhere to put "half done." Evidence: §5.4, §7, confirmed independently by all four tracks.

### Confirmed contributing factors (would not alone cause the bug, but allow it through or amplify it once triggered)

3. **Judge validation gap** — the Judge has `subtask.description` (which may contain the contradicting clause) in scope as a parameter but never inspects its content; it purely trusts an already-decided boolean. Evidence: §6.
4. **Prompt ambiguity** — the facts-extraction prompt instructs the model to mark a deliverable Done on any completion language, with zero instruction for mixed/compound/partial scenarios. Evidence: §5.1.
5. **Review UX insufficient to catch high-impact mistakes** — evidence text is not shown for confidently-matched "ready" items, Done is not visually distinguished, and the status-edit control is hidden behind a closed disclosure. Evidence: §9.
6. **Apply-layer semantic weakness** — both the TypeScript apply-payload builder and the SQL RPC purely trust the incoming status value with zero semantic validation. Evidence: §9.
7. **Project-auto-completion blast-radius amplifier** — `reconcile_project_completion` (built correctly, in a prior, unrelated, already-verified session, for its own legitimate purpose) will cascade a false subtask-Done into a false project-Done in the same transaction, when the subtask is the project's last active one. Not itself a bug, but a severity multiplier for this one. Evidence: §9.
8. **Test coverage gap** — the file containing the actual defect mechanism has zero tests; the exact reproduction is untested anywhere in 104 existing tests. Evidence: §10.
9. **Observability gap** — raw pre-parse AI model output is never persisted, so a future recurrence cannot be forensically distinguished as "the model's own error" vs. "the deterministic override corrupted a correct model response." Evidence: §13 (Step 9 investigation, folded in below).

### Unrelated observations (found during mapping, not causally connected — but relevant to correctly scoping a fix)

- The "v1" pipeline (`project-update-analysis.server.ts`, `project-update-image-mapper.server.ts`, `project-update-post-process.server.ts`) is dead code, unreachable from any live route. **Directly relevant to scoping**: a fix must target the live v2 files (§4), not these — fixing the v1 files would have zero production effect. Recommend flagging as a separate cleanup candidate, out of scope for this bug fix.
- The existing "partial completion" tests cover a different (cross-subtask matching) scenario — noted in §10 to prevent false confidence.

### Hypothesis requiring further reproduction or logs (not code-provable from static analysis alone)

- **Model behavior for phrasings that don't trip the regex** (e.g. "Draft completed; client approval is still pending," variant E in §8) is genuinely unverifiable without executing the model — whether `gpt-4.1-mini` itself would propose an unwarranted `Done` for such text is model-dependent, non-deterministic behavior that this investigation cannot prove either way from code alone.
- **Real-world frequency of this bug class in production** is unknown. No analytics/telemetry exists for judge-decision outcomes or suggestion-acceptance rates, and no live database query was run (correctly, per this task's read-only/no-DB-access constraint — no MCP or database tool is available in this environment). §13 specifies the exact read-only query that would be needed to estimate this later; it has not been executed.

---

## 12. Production data / log evidence (Step 9)

**No live production data was queried.** No database-access MCP tool or equivalent is available in this session/environment, and none was assumed. All findings below are from static repository code only.

- **Raw (pre-parse) AI output**: not persisted anywhere. `rawContent` (the model's literal JSON string response) is used transiently in `extractProjectUpdateFacts` and discarded; only the post-`repairFactsShape` result is ever stored (into `project_updates.ai_summary.extractedFacts`). **This is a real, direct gap for diagnosing this exact bug class after the fact** — it is currently impossible to tell, for any historical incident, whether the model itself said "Done" or whether `hasTaskCompletionCue` forced it.
- **Judge decisions/reasoning**: partially persisted. `project_update_items.ai_reason` is populated (`buildAuditReason`), but its content explains *why the title matched*, not *why the status was judged Done* — there is no stored explanation of the completion decision itself.
- **Source evidence**: `project_updates.raw_input` (not-null) stores the client's exact original text, joinable to every derived `project_update_items` row via foreign key. This part of the audit trail is solid — a bad item CAN be traced back to its exact source sentence.
- **Applied status transitions**: fully auditable via `project_timeline_events` (before/after values, actor, target task) — confirmed wired for every mutation path, including project-level auto-completion (same shared `reconcile_project_completion` mechanism).
- **Existing analytics/telemetry**: none for Project Update decisions specifically. `lib/analytics/events.ts` contains only marketing/conversion tracking (Google Ads/GA4 events) — no AI-suggestion acceptance/rejection tracking, no judge-outcome counters, no apply-success/failure telemetry stream.

**Specification for a future read-only query** (not executed — provided for later use by someone with authorized production DB access):

```sql
-- Heuristic proxy for candidate false-Done events: an applied update_subtask
-- item setting status to Done, whose source raw_input contains a negation/
-- contrast marker, targeting a task whose title suggests multiple components.
-- This is a HEURISTIC, not a precise detector -- it cannot see the AI's raw
-- pre-parse output or the hasTaskCompletionCue trigger state (neither is
-- persisted, per above), only the final persisted title/status/raw_input.
-- Every hit would need manual review of raw_input to confirm a true positive.
select
  pu.id as project_update_id, pu.project_id, pu.raw_input,
  pui.id as item_id, pui.title, pui.ai_reason, pui.new_value, pui.applied_at,
  pte.old_value as task_status_before, pte.new_value as task_status_after
from project_update_items pui
join project_updates pu on pu.id = pui.project_update_id
left join project_timeline_events pte
  on pte.source_item_id = pui.id and pte.event_type = 'subtask_updated'
where pui.type = 'update_subtask'
  and pui.new_value->>'status' = 'Done'
  and pui.status in ('accepted', 'applied')
  and pu.raw_input ~* '\y(still|however|but|not yet|remaining|in progress|incomplete|partially)\y'
  and (
    pui.title ~* '\yand\y'
    or exists (select 1 from tasks t where t.id = pui.target_task_id and t.task_title ~* '\yand\y')
  )
order by pu.created_at desc;
```

This query is a specification only. It has not been run, and no assumption is made that it can or will be run without explicit future authorization and access.

---

## 13. Recommended production architecture (Step 11)

### Evaluation of each option against repository evidence

| Option | Correctness | False-positive risk | False-negative risk | Complexity | Schema compat. | Migration? | Cost/latency | Testability | Auditability | User impact | Rollback safety |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **A. Prompt-only** | Reduces frequency of the model *itself* proposing bad Done, but does **not** fix the deterministic override (§6), which fires regardless of what the model says | Low | **High** — the override still fires on any matching phrase | Low | Full | No | Negligible (same call) | Easy | No change | Positive but insufficient alone | Safe |
| **B. Judge-only deterministic guard** (keyword-based "never Done if incomplete/remaining/in-progress clause present") | Better than nothing, but is exactly the "keyword hack" the engineering rule explicitly forbids — same fundamental weakness as the current broken code, just with a broader keyword list and a different location | **Elevated** — could block legitimate completions that happen to contain an unrelated word from the list (e.g. "no remaining concerns, task is done") | **Still non-trivial** — natural-language negation/scope genuinely cannot be reliably solved by keyword lists (§8 already shows both false triggers AND false safety from the *existing* narrow regex) | Low | Full | No | Negligible | Easy | Improves | Simple to reason about, but not truly correct | Safe |
| **C. Structured evidence model** (require `completedEvidence`, `incompleteEvidence`, `completionScope`, `hasConflict`, `confidence` from the AI) | **High** — forces the model to reason explicitly about scope/conflict rather than collapsing to one enum; directly fixes the confirmed schema limitation (§11, item 2) | Low-moderate (depends on model reliability at populating new fields — mitigated by requiring the fields, not inferring them) | Moderate initially (model may under-report conflicts) but correctable via prompt iteration and Option D's gate | Moderate (schema change, prompt change) | **Requires extending the AI-facing schema, not the DB schema** — see §14 | **No DB migration required** (see below) | Small (slightly larger structured output) | **Good** — new fields are directly unit-testable | **Good** — evidence becomes a first-class, inspectable field instead of buried prose | Positive — more transparent | Safe |
| **D. Two-stage decision** (Judge deterministically validates full completion before allowing Done) | **High** — this is the natural place to *enforce* Option C's new fields; the Judge already exists as a checkpoint, it just doesn't check the right thing today | Low, if the gate condition is precise (`hasConflict === false` and `completionScope === "full"`) | Low — ambiguous/conflicting cases correctly fall to the **already-existing, already-wired `needs_review` outcome**, not a new UI concept | Low-moderate (logic change in an already-tested file) | Full | No | None | **Excellent** — pure deterministic logic, directly unit-testable (matches the existing test style for this file) | Excellent | Neutral-to-positive (more items may route to review, which is the point) | Safe |
| **E. Compound-task-aware logic** (detect multi-component existing titles, require full coverage) | Useful **supplementary** signal, but on its own is a narrower, more overfit heuristic than C+D (pattern-matches the *task title*, not general conflict detection) | Moderate if used alone (many legitimately-atomic tasks contain "and") | Moderate if used alone (doesn't catch F/D-style single-task exceptions from §8, which aren't title-compound) | Low, as an addition to D | Full | No | None | Good | Good | Neutral | Safe |
| **F. Automatic task splitting** | Would only be correct with substantial new infrastructure (§7) that does not exist today | **High** — explicitly assessed against duplicate detection, ordering, project-completion counting, and audit-trail stability, all of which would need redesign | High (splitting logic itself would need the same evidence-quality guarantees as C/D, so it doesn't even avoid the core problem) | **High** | Would very likely require DB migration and new UI | **Likely yes** | Moderate-high | Hard (new stateful behavior) | Complicates (new task identities) | **High risk** — silently changing task structure a user didn't ask for | **Risky** — hard to undo a split cleanly | **Explicitly rejected as a first-line fix per the repository evidence gathered — no existing safe mechanism, high blast radius on unrelated systems** |
| **G. Keep In Progress + record partial progress, no schema expansion** | Correct as a **default/fallback behavior**, but by itself doesn't explain *how* the system decides "this needs the safe default" without also implementing something like B, C, or D | Low (erring toward not-Done is the safe direction) | The full point of this option — no false positives, but by itself doesn't solve detection, only sets the safe default once detection (elsewhere) has flagged a case | Low | Full | No | None | Easy | Neutral | Positive (never worse than today) | Safe |

### Recommendation

**Adopt C + D together, as one coherent change, with G as the resulting default behavior and B/E as supplementary, non-primary signals. Reject F outright for this fix.**

Concretely:
1. **Fix the confirmed root cause directly**: remove (or make strictly advisory, never authoritative) the unconditional `status: hasCompletionCue ? "Done" : subtask.status` override in `repairFactsShape`. This single line is what *guarantees* the reported bug; leaving it in place while adding guards elsewhere would be exactly the "fixing symptoms while leaving the root cause intact" the engineering rule forbids.
2. **Expand the AI-facing contract (Option C)** so the model must explicitly separate completed-evidence from incomplete-evidence and declare a completion scope and conflict flag, rather than collapsing straight to a status enum. This directly targets the confirmed schema limitation (§11, item 2) and gives the *next* layer something real to validate.
3. **Strengthen the Judge into a real gate (Option D)**, reusing its existing position as the one deterministic checkpoint that already has (but currently ignores) the evidence text in scope: only allow an `apply`-kind Done decision when the new structured evidence says there is no conflict and the scope is full; otherwise route to the **already-existing, already-wired `needs_review` decision kind** (no new UI concept required) or propose `In Progress` — i.e., Option G becomes the natural fallback, not a separately-implemented behavior.
4. **Add Option E as a defense-in-depth signal, not the primary mechanism** — e.g., when an existing matched task's title contains a coordinating conjunction ("and"/"/"/etc.), require a stricter (not different-in-kind) evidence-completeness check before Done, on top of the same C/D gate everyone else goes through. This must be evidence-driven (a general "does this title look compound" heuristic), not a hardcoded "desktop and mobile" special case, per the non-negotiable rule.
5. **Do not implement automatic splitting (Option F)** as part of this fix. If product later wants it, it needs its own dedicated design against duplicate detection, task ordering, project-completion counting, and audit-trail stability — none of which exist today for this purpose.
6. **Prompt improvement (Option A) should also be made**, as a complementary reduction in how often the model itself proposes an unwarranted Done — but explicitly not relied upon alone, since it cannot fix code that runs after the model and overrides it regardless of what it says.

This ordering directly satisfies the stated priorities: it prevents false Done (root-cause fix, not a keyword patch), preserves valid full-completion updates (H, I in §8 continue to work — "everything is complete," "desktop and mobile ... are complete"), avoids overfitting to specific words (structured evidence + a real gate, not an expanded keyword list), works identically for text and screenshot updates (both already funnel into the same facts/judge stage), keeps the user as the final review authority (nothing here removes the existing accept/edit/reject flow — it only changes what gets *proposed*), preserves audit history (the new evidence fields are additive to what's already stored), and requires no database schema change (§14).

---

## 14. Proposed contracts (Step 12)

### 14.1 Where the new evidence type would live

Following the repository's existing convention (types colocated per feature, e.g. `lib/project-updates/v2/project-update-facts.types.ts`), a new or extended type in that same file:

```ts
// Illustrative shape -- not the exact final field names; repository convention
// (camelCase, nullable-not-optional for AI-facing fields, per the existing
// ExtractedSubtaskFactSchema style) should win over this exact shape if the
// implementer finds a cleaner fit.
type SubtaskCompletionEvidence = {
  completedEvidence: string[];    // verbatim phrase(s) supporting completion
  incompleteEvidence: string[];   // verbatim phrase(s) contradicting/qualifying it
  completionScope: "full" | "partial" | "unclear";
  hasConflict: boolean;           // true whenever both arrays are non-empty
};

// Extends the existing ExtractedSubtaskFactSchema (project-update-facts.server.ts)
// rather than replacing it -- `status` stays as today's mechanism for the
// non-completion case (New/In Progress/Review/Urgent); the new fields only
// activate/matter when status is (or would be) "Done".
```

- **Produced by**: the AI fact-extraction call itself (`extractProjectUpdateFacts`), by extending its prompt and Zod schema to require these fields whenever it emits `status: "Done"` for a fact. This keeps the "reasoning" work where the model already does it, rather than trying to reconstruct it deterministically after the fact (which is exactly what today's flawed regex attempts and fails at).
- **Validated by**: the Judge (`judgeRequestedSubtask`), which becomes the enforcement point — `hasConflict === true` or `completionScope !== "full"` routes to `needs_review` (existing decision kind) instead of `apply`.
- **Persisted**: yes, as part of the same `ai_summary`/`description`/`ai_reason` mechanism already used today — this is additive JSON/text content, not a new relational shape. `project_update_items.description`/`ai_reason` (existing `text` columns) can carry a formatted rendering of the evidence for audit/review purposes with **zero schema change**. If a future need arises for structured querying of evidence (e.g. for the analytics query in §12), a new `evidence jsonb` column *could* be added later — but this is explicitly **optional**, not required for the core fix, per "avoid unnecessary schema/database changes."
- **Transient-only**: the raw pre-`repairFactsShape` AI output — recommended to persist this too (§11 observability gap), but that is an observability improvement, not required for the correctness fix itself.
- **Maps into the existing update-item schema**: `ProjectUpdateJudgeDecision`/`project_update_items` already have `description`, `ai_reason`, `new_value` (jsonb), and `confidence` — the new evidence can flow into `description`/`ai_reason` as formatted text with no shape change, and `new_value` already accepts an object, so `hasConflict`/`completionScope` could optionally be embedded there too without a migration (jsonb accepts arbitrary shape).
- **Database changes necessary?** **No**, for the core fix. `tasks.status` remains exactly as it is; `apply_project_update_transaction` and `reconcile_project_completion` need zero changes, since the fix prevents the bad `Done` from ever being proposed/applied in the first place — it does not need to change what happens once a *correct* Done is applied.
- **Older payload compatibility**: since nothing in the DB schema changes, historical `project_update_items` rows remain fully readable/compatible as-is. The `history` route/modal (§9) would simply show older items without the new evidence fields populated (falling back to today's display), and new items with them.

---

## 15. Full test matrix (Step 13)

### Pure unit tests (`lib/project-updates/v2/project-update-facts.server.test.ts` — **new file, filling the confirmed zero-coverage gap**)

1. **Exact reproduction**: fact title/description built from "The desktop design is complete, and the mobile layout is still in progress." → assert `hasCompletionCue`/whatever replaces it does **not** force `status: "Done"` (post-fix), and/or the new evidence fields show `hasConflict: true`, `completionScope: "partial"`.
2. **Both components complete**: "The desktop and mobile layouts are complete." → `status: "Done"` allowed, `hasConflict: false`, `completionScope: "full"`.
3. **Explicit partial**: "Only the desktop layout is complete." → not Done; scope `"partial"`.
4. **Exception clause**: "Design is complete except for mobile responsiveness." → not Done; conflict detected.
5. **Approval pending**: "Draft is finished, client approval is still pending." → not Done if approval is understood as part of the matched task's scope (product decision — see §17, open question).
6. Leap-year/date-adjacent edge cases are not relevant to this bug (deadline logic is separately, already tested — not in scope here).
7. Full regression of every existing `hasTaskCompletionCue` case from before the fix (H, I from §8) to confirm no regression on legitimate full-completion phrasing.

### Judge tests (extend `project-update-judge.server.test.ts` — already well-tested, add to existing style)

8. Single atomic task, fully complete → `apply`/Done still works (regression guard).
9. Single atomic task, still in progress, no completion language → `In Progress`/no-op as today (regression guard).
10. **New**: fact with `hasConflict: true` for a confidently-matched single existing task → `needs_review`, never `apply`.
11. **New**: contradictory clauses within one fact (variants F, D from §8) → conflict-safe routing (`needs_review` or `In Progress` proposal, per the product decision in §17).
12. **New**: multiple existing tasks, only one is genuinely (fully) complete per its own evidence → only that one becomes `apply`; the other(s) remain unaffected (extends the existing cross-subtask-ambiguity tests with a same-time multi-fact scenario).
13. **New — false-match protection**: a completed-evidence clause naming one task must not complete a different, similarly-named task (extends existing `resolveSubtaskReference` ambiguity tests with the new evidence dimension).

### Schema/contract tests

14. `ExtractedSubtaskFactSchema` (extended) rejects/accepts the new fields correctly; `hasConflict` derivable/consistent with non-empty `incompleteEvidence`.

### Component/review-card tests (extend `project-update-review-card.test.tsx`, which currently has zero `update_subtask`/status coverage)

15. A `needs_review` item produced by the new conflict-guard renders with its evidence visible (already-existing `NeedsReviewFindings` rendering — verify the new evidence text surfaces there correctly).
16. **User-edited review result**: user manually overrides a suggested status via the existing edit control → Apply respects the user's final selection, not the AI's original suggestion (regression guard on existing behavior, currently untested for this item type).

### Integration / route tests

17. `POST /api/project-updates/analyze` end-to-end with the exact reproduction text (mocked model response) → resulting persisted `project_update_items` row has `kind: needs_review` (or equivalent), not `apply`/Done.
18. **Screenshot/image version of the exact reproduction**: an image whose transcription yields the same mixed-status text → same outcome as the text path (confirms the shared-pipeline assumption in §5.3/§8 holds after the fix).

### Database/RPC tests

19. No new RPC test is strictly required, since the fix does not change the RPC — but **regression-confirm** the existing `202607270001_project_completion_reconciliation.test.ts` assertions still hold (they should, untouched).
20. **Project auto-completion must not occur because of a false Done**: an integration-level test (mocked apply flow) confirming that when the Judge correctly routes the mixed-evidence case to `needs_review` instead of `apply`, the subtask is never actually updated, and therefore `reconcile_project_completion` never has a reason to fire for it.

### Manual QA

- Run the exact reproduction (text and, separately, a real screenshot) against a real (non-mocked) model call in a staging/dev environment, to confirm real-world model behavior matches the new prompt's guidance, not just the deterministic guard's fallback behavior.
- Confirm the review card visually surfaces the new evidence for any item routed to `needs_review` as a result of this change.
- Confirm a project whose last subtask is a *genuine* full completion still correctly auto-completes (regression check on the interaction with `reconcile_project_completion`, using the real RPC, not a mock).

---

## 16. Phased implementation plan (Step 14) — not executed

**Phase A — Reproduction tests and decision contract.**
- Files likely created: `lib/project-updates/v2/project-update-facts.server.test.ts` (new, filling the confirmed gap), extensions to `lib/project-updates/v2/project-update-facts.types.ts` (new evidence type, additive).
- Files likely modified: none yet — this phase is tests-and-types-first, proving the gap and defining the target contract before touching logic.
- Parallel-safe? Yes, single-owner, no conflicting files with any other phase at this point.
- Risks: low — purely additive.
- Verification: `npx vitest run lib/project-updates/v2/project-update-facts.server.test.ts`, `npx tsc --noEmit`.
- Rollback: trivial (new files only).
- Isolated commit: yes.

**Phase B — Prompt/schema evidence improvements.**
- Files likely modified: `lib/project-updates/v2/project-update-facts.server.ts` (prompt text + `ExtractedSubtaskFactSchema` extension + removal/downgrade of the unconditional `hasTaskCompletionCue` override in `repairFactsShape`).
- Files likely modified (image path, if the image extraction prompt itself needs alignment — evaluate during implementation whether this is needed, since the image schema already has no status field and the shared risk is downstream): `lib/project-updates/project-update-image.server.ts`, only if evidence during implementation shows it's needed.
- Parallel-safe with Phase C? **No** — Phase C's Judge changes depend on the exact shape Phase B produces; must be sequential or done by the same owner.
- Risks: moderate — prompt changes can shift model behavior in ways only fully visible via real model calls (not mockable in unit tests alone); budget for manual QA against a real model.
- Verification: unit tests from Phase A now exercised against real logic; `npx tsc --noEmit`; `npx eslint <files>`.
- Rollback: revert this commit; the old override is small and easy to restore if a regression is found.
- Isolated commit: yes.

**Phase C — Judge/deterministic full-completion guard.**
- Files likely modified: `lib/project-updates/v2/project-update-judge.server.ts` (the new gate logic in `judgeRequestedSubtask`), extending `lib/project-updates/v2/project-update-judge.server.test.ts`.
- Depends on: Phase B's contract being stable.
- Parallel-safe with Phase D? Likely yes once Phase B/C's output shape is fixed, since Phase D consumes the *decision*, not the facts contract directly — but confirm no shared file overlap before parallelizing (both may touch `project-update-apply.server.ts` only tangentially, if at all — evaluate during implementation).
- Risks: low-moderate — this is the enforcement point; getting the gate condition exactly right (not too strict, not too loose) is the crux of the whole fix.
- Verification: full existing Judge test suite must still pass (104 existing tests, zero regressions expected) plus new tests from §15.
- Rollback: revert commit; Judge reverts to today's (unsafe) trust-the-boolean behavior.
- Isolated commit: yes.

**Phase D — Post-processing and apply compatibility.**
- Files likely modified: none expected if C correctly routes conflicting evidence to the already-existing `needs_review` path (no new item-processing branch needed in `project-update-apply.server.ts` or the RPC) — **confirm this during implementation**; if a new decision kind beyond `needs_review`/`apply`/`no_change`/`already_exists`/`ignore` is deemed necessary, this phase would need to touch `project-update-apply.server.ts` and the `v2/project-update-result-builder.server.ts` formatting logic.
- Parallel-safe with Phase C? No — depends on Phase C's exact output.
- Risks: low if no new decision kind is needed (the existing `needs_review` path is proven, tested infrastructure); moderate if a new kind is required.
- Verification: `npx vitest run`, existing apply-layer tests must still pass unchanged.
- Isolated commit: yes.

**Phase E — Review UX improvements (only if evidence from earlier phases shows they're needed).**
- Files likely modified: `app/components/dashboard/tasks/project-updates/project-update-review-card.tsx` (surface evidence for ready items too, not just needs_review; consider visual distinction for Done suggestions).
- Parallel-safe with A-D? Could start once the new evidence shape (Phase A/B) is stable, independent of C/D's internal logic, **but must not run concurrently with any other phase touching the same review-card file** — no other phase in this plan touches it, so this can run in its own isolated track once its data dependency (the evidence shape) is fixed.
- Risks: low — additive UI, existing component test file (`project-update-review-card.test.tsx`) currently has zero `update_subtask` coverage, so this phase should also fill that gap (§15, items 15-16).
- Verification: component tests (jsdom), manual QA.
- Isolated commit: yes.

**Phase F — Full regression suite and production-safe verification.**
- No new files expected; this is the integration/verification phase.
- Commands: `npx vitest run`, `npx tsc --noEmit`, `npx eslint <all changed files>`, `npm run lint`, `npm run build` (per whatever this repository's established convention is for who runs the build), full manual QA per §15.
- Risks: none beyond normal regression risk of a multi-phase change — this phase exists specifically to catch it.
- Rollback: each prior phase's isolated commit allows scoped rollback of just the phase that regresses, without reverting the whole effort.

**No phase proposes parallel agents editing the same file.** The sequential dependency chain (A → B → C → D, with E parallelizable once its data dependency is stable, F last) reflects genuine data-contract dependencies, not an arbitrary ordering choice.

---

## 17. Exact anticipated file list

**Likely new files:**
- `lib/project-updates/v2/project-update-facts.server.test.ts`

**Likely modified files:**
- `lib/project-updates/v2/project-update-facts.server.ts`
- `lib/project-updates/v2/project-update-facts.types.ts`
- `lib/project-updates/v2/project-update-judge.server.ts`
- `lib/project-updates/v2/project-update-judge.server.test.ts`
- `app/components/dashboard/tasks/project-updates/project-update-review-card.tsx` (Phase E, conditional)
- `app/components/dashboard/tasks/project-updates/project-update-review-card.test.tsx` (Phase E, conditional)

**Possibly modified, only if implementation reveals a genuine need:**
- `lib/project-updates/project-update-image.server.ts` (if the image-side prompt needs alignment)
- `lib/project-updates/project-update-apply.server.ts`, `lib/project-updates/v2/project-update-result-builder.server.ts` (Phase D, only if a new decision kind beyond the existing five is needed)

**Not expected to require changes:**
- Anything under `supabase/migrations/**` (no DB schema or RPC change required, per §14)
- `lib/project-updates/project-update-context.server.ts`, `project-update-field-normalizers.ts`, `project-update-audit.server.ts` (unaffected by this fix's scope)
- The dead v1 files (`project-update-analysis.server.ts`, `project-update-image-mapper.server.ts`, `project-update-post-process.server.ts`) — out of scope; fixing them would have zero production effect

---

## 18. Open product/engineering questions (Step 15)

1. **When evidence is mixed, should the system propose "In Progress" or route to "needs_review"?** Both are architecturally supported by the recommendation in §13 — this is a product-UX decision, not an engineering constraint. `needs_review` reuses more existing infrastructure (already has dedicated UI); silently proposing "In Progress" is less friction but risks a different kind of quiet incorrectness if the *actual* right status was something else (e.g. "Review").
2. **Does "Draft is finished, client approval is still pending" count as incomplete for the matched task, or is "approval" considered outside the task's own scope?** (§15, test 5) This depends on what the existing task's title/scope is understood to cover — a product/domain judgment, not something inferable from code alone.
3. **Should the compound-task-aware heuristic (Option E) look only at coordinating conjunctions ("and"), or also slashes, ampersands, and comma-separated lists**, as enumerated in the original bug-report brief? Recommend starting narrow (evidence-driven, measured against real data) and expanding only if real false-negatives are observed — avoid speculative broadening.
4. **Should raw pre-parse AI output be persisted going forward** (§11, §12 observability gap)? This has a real storage-cost and PII/data-retention-policy dimension outside this mapping's scope to decide.
5. **Should the dead v1 pipeline files be deleted** as a follow-up cleanup, now that this investigation has confirmed they are unreachable? Not required for this bug fix, but worth a deliberate decision rather than leaving confusing dead code that could mislead a future investigation the way it could have misled this one had the tracks not verified reachability directly.
6. **Is a manual "undo" for Project Update apply actions (§9) worth building**, independent of this specific bug, given the confirmed absence of any rollback mechanism today? This is a larger, separate feature request the blast-radius investigation surfaced but which is out of scope for a root-cause fix to this bug specifically.

---

## 19. Explicit assumptions made during this mapping

- The two-model architecture (`gpt-4.1-mini` for text-facts extraction, `gpt-5.4` for image transcription) reflects the actual current constants read from source; if these are ever changed to environment-variable-driven configuration, the model names themselves would need re-verification, but the pipeline *structure* documented here would not change.
- "Live" vs. "dead" code status was determined by grepping for importers of each file across the whole repository and confirming both real API routes' actual call chains — this is a static analysis conclusion, not a runtime trace; it is treated as reliable given TypeScript/ES module imports are statically resolvable and no dynamic `import()`-based routing was found in this feature.
- No live production database was queried; all statements about persisted data reflect what the *code* writes, not confirmed observed production values. The one place this mapping goes further is the git history/commit evidence for `reconcile_project_completion`, which is itself repository code (a migration file), not production data.
- The severity assessment in §1/§9 (project auto-completion cascade) is a **confirmed code-level finding** (the RPC unconditionally calls `reconcile_project_completion`), not a hypothesis — but whether this has *actually occurred* in production for a false-Done event is unknown without the log/query access described in §12.

---

## 20. Explicit confirmation: no application code was modified

This session performed exclusively read-only investigation via four parallel, read-only subagent tracks (prompts/models/schemas; task matching/judge/post-processing; review UI/apply/RPC/audit; tests/observability) plus this lead's own synthesis. No `.ts`/`.tsx`/`.sql`/config/dependency/prompt/schema/test file was created, edited, or deleted. No migration was run. No production data was queried or modified. Nothing was committed or pushed. The only new file created in this entire session is this report.
