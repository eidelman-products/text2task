# Text2Task — Partial/Mixed-Completion False-"Done" Bug: Implementation Report

Status: **Implemented, tested, verified. Not committed. Not pushed.**
Companion mapping report (unchanged by this work): `docs/TEXT2TASK_PARTIAL_TASK_COMPLETION_MAPPING.md`

---

## 1. Exact implementation verdict

The confirmed root cause — a deterministic regex (`hasTaskCompletionCue`) unconditionally overwriting `status` to `"Done"` whenever any completion phrase appeared anywhere in a fact's title/description, with zero negation, scope, or contradiction awareness — has been **removed**. Status is now the AI model's own extracted value, passed straight through, never overridden by a keyword match.

In its place, the fix adds a **structured completion-evidence contract** (`completedEvidence`, `incompleteEvidence`, `completionScope`) that the AI must populate whenever it proposes Done, plus an **authoritative deterministic gate in the Judge** that only allows an automatic `apply` decision when the evidence is unambiguous and fully grounded. Anything mixed, partial, unclear, contradictory, or missing evidence routes to the **existing** `needs_review` decision path — no new decision kind, no new database column, no migration.

The exact reproduction ("The desktop design is complete, and the mobile layout is still in progress.") now produces `needs_review`, never an auto-apply Done, verified end-to-end through the real facts-extraction → Judge pipeline (not just hand-built fixtures).

## 2. Root-cause code removed or changed

**Removed** (`lib/project-updates/v2/project-update-facts.server.ts`, `repairFactsShape`):
```ts
status: hasCompletionCue ? "Done" : subtask.status,   // <- deleted
```
This was the single line that guaranteed the bug. It is gone; nothing replaces it with an equivalent keyword-based decision.

**Retained, narrowed to non-authoritative title cleanup only**: `hasTaskCompletionCue` still exists, but its only remaining use is deciding whether to strip filler words ("is approved now") out of the *displayed title* (`cleanCompletionCueFromTitle`). It no longer touches `status` anywhere in the codebase — confirmed by a repo-wide sweep (§ Final root-cause sweep below) and by a dedicated test (`existing non-completion statuses remain compatible`) proving the model's own status is never overwritten.

**New authoritative decision point**: `evaluateSubtaskCompletionGate` in `lib/project-updates/v2/project-update-judge.server.ts` — a small, evidence-array-driven function (not a regex over free text) that is now the only place a Done can be auto-applied to an existing subtask.

## 3. Final evidence contract

Added to `ExtractedSubtaskFactSchema` (Zod, `project-update-facts.server.ts`) and `ProjectUpdateExtractedSubtaskFact` (`project-update-facts.types.ts`):

```ts
completedEvidence: string[];    // short, source-grounded excerpts supporting completion
incompleteEvidence: string[];   // short, source-grounded excerpts showing remaining/pending/excluded work
completionScope: "full" | "partial" | "unclear" | null;   // null unless status is "Done"
```

**Derivation, not trust** — matching the locked instruction not to trust a model-provided conflict boolean:
- `hasConflict` is never asked of the model. It is computed purely as `completedEvidence.length > 0 && incompleteEvidence.length > 0`, independently, in both `repairFactsShape` (to normalize `completionScope`) and the Judge's gate (to decide apply-vs-review).
- **Groundedness check**: every evidence string is verified as an actual (whitespace/case-normalized) substring of the client's raw update text before being trusted. A hallucinated excerpt the model didn't actually find in the text is silently dropped, never surfaced to the user or the gate. (`normalizeEvidenceEntries` / `normalizeForGroundingComparison`.)
- **Scope normalization is fail-safe, not model-trusting**: `normalizeCompletionScope` forces `"unclear"` whenever there's no grounded `completedEvidence` at all (even if the model claimed `"full"`), and forces `"partial"` whenever both evidence arrays are non-empty (even if the model claimed `"full"`). The model's self-reported scope is only honored when it isn't contradicted by the arrays it itself provided.

This directly satisfies the mapping report's confirmed schema-limitation finding: the pipeline can now express partial/mixed completion instead of collapsing everything to one enum value.

## 4. Prompt changes

`buildProjectUpdateFactsPrompt` (same file) now:
- Documents the three new JSON fields in the output shape spec.
- Adds a new rule section ("1a. Completion evidence") defining full vs. partial vs. unclear completion, instructing the model to extract short **verbatim** excerpts (never invented/paraphrased ones), and listing example qualifying language ("but", "however", "still", "only", "partially", "not yet", "remaining", "except", "excluding", "aside from", "pending", "waiting on", "yet to", "in progress", "left to do") as things to *watch for in the client's own text* — this guides the model's own natural-language reasoning; it is not a deterministic keyword-matching mechanism in code (no new regex was added anywhere in `project-update-judge.server.ts` or `project-update-facts.server.ts` — confirmed by the sweep below).
- Adds one new worked example ("Partial/mixed completion example") using a **generic** two-part deliverable (English/Spanish brochure versions) — deliberately not "desktop and mobile" — showing the model exactly how to populate `completedEvidence`, `incompleteEvidence`, and `completionScope: "partial"` for a mixed case, plus an explanatory note on why this differs from a clean full completion.
- Updates the existing "Completion example" to include the new fields for a genuine full completion.

## 5. Judge gate behavior

`judgeRequestedSubtask` (`project-update-judge.server.ts`), for a confidently-matched existing subtask with a proposed Done:

```
apply (auto-Done) requires ALL of:
  - completedEvidence.length > 0
  - incompleteEvidence.length === 0
  - completionScope === "full"
  - derived hasConflict === false (redundant with the above, computed independently)

otherwise -> needs_review, carrying:
  - description: "Completed: ... Still incomplete: ..." (human-readable)
  - newValue: { status: "Done", completed_evidence: [...], incomplete_evidence: [...] }
  - reason: one of a small set of fixed, evidence-derived explanations
    (conflict / no evidence / scope not full)
```

Ambiguous title matching (multiple candidate subtasks) and no-match cases are **unaffected** — they already routed to `needs_review` before the gate ever runs, exactly as before. The gate only changes behavior for the *confidently-matched, single-candidate* case, which is precisely where the bug lived.

`newValue` reuses the existing `JsonRecord`/jsonb field — no schema change. This was confirmed to flow untouched through `buildProjectUpdateV2AuditItems` and `createProjectUpdateAuditItems` (both pass `new_value` straight through to the `project_update_items.new_value` jsonb column with no filtering), so no adapter changes were needed in the result-builder or audit-writer files, matching the "don't touch what doesn't need touching" instruction.

## 6. Review UI behavior

`project-update-review-card.tsx`, `NeedsReviewFindings`: when a needs_review item's `new_value` carries `completed_evidence`/`incomplete_evidence` (read via a new `getStringArrayValue` helper in `project-update-ui-types.ts`), it now renders a small, clearly labeled **"Partial or conflicting completion — proposed: <status>"** box with two distinguishable, separately-listed groups: **Completed** and **Still incomplete** — instead of the generic single-paragraph description. Items without this evidence shape (including all historical rows, and every other needs_review reason) fall back to the pre-existing plain-description rendering, unchanged.

No redesign of the review modal. No change to any other item type's rendering. The existing "Edit saved details" disclosure and status dropdown for *ready* items are untouched and still fully functional (verified by a new test rendering a ready item and a mixed-completion needs_review item side by side).

## 7. Historical compatibility

- **Zod defaults**: `completedEvidence`/`incompleteEvidence` default to `[]`, `completionScope` is nullable — a model response that omits the new fields (or a schema mismatch on an old client) does not crash extraction.
- **Malformed data fails safely, not silently**: an invalid `completionScope` enum value fails the whole extraction's Zod parse (`ok: false`), exactly matching this file's existing established pattern for every other enum field — proven by a dedicated test.
- **Missing evidence on a proposed Done never auto-applies**: proven at both the facts layer (`completionScope` normalizes to `"unclear"`) and the Judge layer (gate requires non-empty `completedEvidence`), independently — belt and suspenders.
- **Historical `project_update_items` rows** (persisted before this change, with no `completed_evidence`/`incomplete_evidence` in their `new_value`) render exactly as they did before — proven by a dedicated component test using `new_value: null` plus a plain `description`, confirming no crash and the correct plain-description fallback.
- **Existing needs_review fail-closed guard is untouched and still applies**: `needs_review` was already in `NON_APPLICABLE_ACCEPTED_ITEM_TYPES` before this change; the mixed-completion case simply reuses that existing, already-tested protection rather than requiring new apply-layer logic.

## 8. Files created

- `lib/project-updates/v2/project-update-facts.server.test.ts` — 15 tests for the facts-extraction/repair layer (previously zero coverage).
- `lib/project-updates/v2/project-update-v2-pipeline.integration.test.ts` — 4 tests exercising the real facts→Judge seam (mocked model, real deterministic logic on both sides).
- `docs/TEXT2TASK_PARTIAL_TASK_COMPLETION_IMPLEMENTATION_REPORT.md` — this report.

## 9. Files modified

- `lib/project-updates/v2/project-update-facts.server.ts` — evidence contract, prompt, root-cause removal, evidence normalization.
- `lib/project-updates/v2/project-update-facts.types.ts` — new fields on `ProjectUpdateExtractedSubtaskFact`.
- `lib/project-updates/v2/project-update-judge.server.ts` — completion evidence gate.
- `lib/project-updates/v2/project-update-judge.server.test.ts` — existing Done-producing fixtures updated with explicit evidence (6 tests), plus a new 9-test completion-evidence-gate suite.
- `app/components/dashboard/tasks/project-updates/project-update-review-card.tsx` — evidence rendering for needs_review items.
- `app/components/dashboard/tasks/project-updates/project-update-ui-types.ts` — new `getStringArrayValue` helper.
- `app/components/dashboard/tasks/project-updates/project-update-review-card.test.tsx` — 5 new tests.
- `lib/project-updates/project-update-apply.server.test.ts` — 1 new regression test tying the existing fail-closed guard to this specific bug's evidence shape.

**Not modified** (confirmed by sweep): `project-update-result-builder.server.ts`, `project-update-audit.server.ts`, `project-update-apply.server.ts` (only its test file changed), any file under `supabase/migrations/**`, `project-update-image.server.ts`, any dead V1 file, `package.json`/lockfiles, any Date Picker file.

## 10. Test coverage added

| Area | New tests | What they prove |
|---|---|---|
| Facts extraction/repair | 15 | Exact reproduction, full/partial/exception/quantified/pending-approval phrasings, negated completion, evidence groundedness filtering, fail-safe "unclear" on missing evidence, malformed-enum safe failure, missing-fields default safely, non-Done statuses untouched, prompt construction sanity (no hardcoded "desktop and mobile") |
| Judge gate | 9 | Exact reproduction → needs_review, full completion → apply, explicit partial/exception/approval-pending → needs_review, missing evidence → needs_review, atomic full completion → apply, evidence-overrides-self-reported-scope, ambiguous match still safe |
| Judge (updated existing) | 6 fixtures updated | Confirms adding the gate did not regress any of the 15 pre-existing matching-behavior tests |
| Review UI | 5 | Evidence visible, groups distinguishable, never rendered as ready-to-apply, historical rows render safely, co-existing ready item stays editable |
| Apply-layer regression | 1 | This bug's specific evidence shape is still fail-closed rejected by the existing guard |
| Pipeline integration | 4 | Real facts→Judge seam for text and simulated-screenshot sourceType, valid full completion, false-match protection |

**Total new/updated tests: 40.** Full suite: **338 → 372 passing** (34 net new; 6 pre-existing fixtures updated in place, 0 removed, 0 skipped).

## 11. Exact verification results

```
npx vitest run
  Test Files  30 passed (30)
       Tests  372 passed (372)

npx tsc --noEmit
  (clean, no output)

npx eslint <all 10 changed/created files>
  (clean, no output)

npm run lint   (repo-wide)
  (clean, no output)

git diff --check
  (clean, exit 0)

git status --short
   M app/components/dashboard/tasks/project-updates/project-update-review-card.test.tsx
   M app/components/dashboard/tasks/project-updates/project-update-review-card.tsx
   M app/components/dashboard/tasks/project-updates/project-update-ui-types.ts
   M lib/project-updates/project-update-apply.server.test.ts
   M lib/project-updates/v2/project-update-facts.server.ts
   M lib/project-updates/v2/project-update-facts.types.ts
   M lib/project-updates/v2/project-update-judge.server.test.ts
   M lib/project-updates/v2/project-update-judge.server.ts
  ?? docs/TEXT2TASK_PARTIAL_TASK_COMPLETION_MAPPING.md   (pre-existing, unchanged by this task)
  ?? lib/project-updates/v2/project-update-facts.server.test.ts
  ?? lib/project-updates/v2/project-update-v2-pipeline.integration.test.ts

git diff --stat
   8 files changed, 880 insertions(+), 9 deletions(-)
```

**Root-cause sweep** (grep across `lib/`, `app/`):
- `hasTaskCompletionCue`: exactly 2 non-test usages, both title-cleanup only, never assigned to `status`.
- `hasCompletionCue`/`hasCompletionCueForTitleCleanup`: same — confirmed never wired to `status`.
- `eslint-disable`, `@ts-ignore`/`@ts-expect-error`, `as any`: **zero matches** in any changed file.
- No new regex-based conflict/negation detector was added anywhere in code (the negation-word list only exists in the prompt text handed to the model, not as a pattern-matcher in TypeScript).
- No file under `supabase/migrations/**` touched. No dead V1 file (`project-update-analysis.server.ts`, `project-update-image-mapper.server.ts`, `project-update-post-process.server.ts`) touched.

`npm run build` was **not run**, per instruction — the user performs the final production build.

## 12. Manual QA inputs

Run each against a real project with an existing subtask matching the described deliverable, using the actual analyze UI (text and/or screenshot).

**Scenario 1 — mixed completion**
> The desktop design is complete, and the mobile layout is still in progress.

Expected: routes to **Needs review**, shows a "Partial or conflicting completion" box with "Completed" and "Still incomplete" evidence, never appears in "Ready to apply."

**Scenario 2 — full completion**
> The desktop and mobile layouts are complete.

Expected: appears in **Ready to apply** with a Done suggestion, applies normally when saved.

**Scenario 3 — exception**
> Design is complete except for mobile responsiveness.

Expected: **Needs review**.

**Scenario 4 — quantified partial**
> Most of the task is complete.

Expected: **Needs review**.

**Scenario 5 — atomic completion**
> The contact form is complete.

Expected: appears in **Ready to apply** for the matching atomic task (e.g. "Update contact form..."), applies normally.

Recommend also re-running Scenario 1 as a screenshot (a photo/screenshot of text containing that exact sentence) to visually confirm the image-transcription path produces the same "Needs review" outcome as text, since both paths converge on the same facts/judge pipeline this fix changed.

## 13. Remaining risks or open items

- **Real (non-mocked) model behavior is unverified.** All facts-layer tests mock the OpenAI response to control exactly what the model "said," per the no-live-calls instruction. Whether `gpt-4.1-mini` reliably populates `completedEvidence`/`incompleteEvidence`/`completionScope` well in practice — especially for phrasings not covered by the new worked example — can only be confirmed by the manual QA scenarios above against the real API.
- **Screenshot path is verified up to the shared funnel point, not through the actual image-transcription call.** `project-update-image.server.ts` (which produces the raw text blob from a screenshot) was intentionally not touched or mocked in the new integration test, since it's a separate, out-of-scope file; the test instead simulates its output. Manual QA scenario 1 (as a screenshot) is the recommended way to close this gap.
- **Product decision still open**: for evidence like "draft is finished, client approval is still pending," this fix treats it as `needs_review` (safe default) rather than deciding whether "approval" is in-scope for the matched task. This mirrors the mapping report's §17 open question — no code change needed to revisit it later, since it only affects how a human reviewer is asked to decide, not any automatic behavior.
- **No new logging/observability was added** (explicitly out of scope for this task, per instruction 13) — the raw pre-parse model response still isn't persisted. The mapping report's observability-gap finding stands as a separate, un-actioned item.
- **Evidence array caps**: `normalizeEvidenceEntries` caps each array at 8 entries and 300 characters per entry, defensively, to bound prompt-echo/display size. This is a reasonable, non-breaking safety limit but is worth knowing about if a future real-world case has unusually long/numerous evidence excerpts.

## 14. git status --short

```
 M app/components/dashboard/tasks/project-updates/project-update-review-card.test.tsx
 M app/components/dashboard/tasks/project-updates/project-update-review-card.tsx
 M app/components/dashboard/tasks/project-updates/project-update-ui-types.ts
 M lib/project-updates/project-update-apply.server.test.ts
 M lib/project-updates/v2/project-update-facts.server.ts
 M lib/project-updates/v2/project-update-facts.types.ts
 M lib/project-updates/v2/project-update-judge.server.test.ts
 M lib/project-updates/v2/project-update-judge.server.ts
?? docs/TEXT2TASK_PARTIAL_TASK_COMPLETION_MAPPING.md
?? lib/project-updates/v2/project-update-facts.server.test.ts
?? lib/project-updates/v2/project-update-v2-pipeline.integration.test.ts
```

## 15. git diff --stat

```
 .../project-update-review-card.test.tsx            | 190 ++++++++++++++++
 .../project-updates/project-update-review-card.tsx | 111 ++++++++-
 .../project-updates/project-update-ui-types.ts     |  21 ++
 .../project-update-apply.server.test.ts            |  21 ++
 .../v2/project-update-facts.server.ts               | 166 +++++++++++++-
 .../v2/project-update-facts.types.ts                |  23 ++
 .../v2/project-update-judge.server.test.ts          | 252 ++++++++++++++++++++-
 .../v2/project-update-judge.server.ts               | 105 +++++++++
 8 files changed, 880 insertions(+), 9 deletions(-)
```
(New untracked files are not counted by `git diff --stat`; they total ~700 additional lines across the two new test files.)

## 16. Explicit confirmation

**Nothing was committed. Nothing was pushed.** No branch was created or switched (`main`, unchanged, confirmed before and after). No migration was run or created. No production data was touched. No dependency was installed or upgraded (`package.json`/lockfiles unmodified). `npm run build` was not run. The mapping report (`docs/TEXT2TASK_PARTIAL_TASK_COMPLETION_MAPPING.md`) was not modified. All commits/pushes remain the user's action to take.
