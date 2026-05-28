import type {
  JsonRecord,
  ProjectUpdateItemType,
} from "@/lib/project-updates/project-update-types";

/**
 * Project Update V2 principle:
 *
 * AI extracts facts only.
 * Code decides what is new, duplicated, unchanged, or applyable.
 *
 * This keeps Text updates and Screenshot updates consistent:
 * text -> facts -> judge -> suggested update plan
 * image -> transcription -> facts -> judge -> suggested update plan
 */

export type ProjectUpdateV2SourceType = "text" | "image";

export type ProjectUpdateFactPriority = "Low" | "Medium" | "High";

export type ProjectUpdateFactStatus =
  | "New"
  | "In Progress"
  | "Review"
  | "Urgent"
  | "Done";

export type ProjectUpdateExtractedSubtaskFact = {
  /**
   * A client-requested deliverable or work item.
   * Example: "Add customer reviews section to homepage"
   */
  title: string;

  /**
   * Optional explanation from the original client update.
   * This should be short and factual, not a decision.
   */
  description: string | null;

  /**
   * Optional deadline that appears to belong to this specific deliverable.
   * Project-wide deadline belongs in projectChanges.deadlineText.
   */
  deadlineText: string | null;

  /**
   * Optional amount/budget that appears to belong to this specific deliverable.
   * Project-wide budget belongs in projectChanges.amount.
   */
  amount: string | null;

  /**
   * Optional status requested for this specific deliverable.
   */
  status: ProjectUpdateFactStatus | null;

  /**
   * Optional priority requested for this specific deliverable.
   */
  priority: ProjectUpdateFactPriority | null;
};

export type ProjectUpdateExtractedProjectChanges = {
  /**
   * Project-wide deadline mentioned in the update.
   * Example: "next Friday", "by May 10", "tomorrow by 6 PM".
   */
  deadlineText: string | null;

  /**
   * Project-wide budget/amount mentioned in the update.
   * Example: "$950", "950 USD".
   */
  amount: string | null;

  /**
   * Project-wide priority mentioned in the update.
   */
  priority: ProjectUpdateFactPriority | null;

  /**
   * Project-wide status mentioned in the update.
   */
  status: ProjectUpdateFactStatus | null;
};

export type ProjectUpdateExtractedClientChanges = {
  clientName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export type ProjectUpdateExtractedNoteFact = {
  note: string;
  scope: "project" | "client";
};

export type ProjectUpdateExtractedFacts = {
  /**
   * Short summary of the client update.
   * This is not the final Suggested Update Plan.
   */
  summary: string;

  /**
   * Facts about requested work/deliverables.
   */
  requestedSubtasks: ProjectUpdateExtractedSubtaskFact[];

  /**
   * Facts about project-level changes.
   */
  projectChanges: ProjectUpdateExtractedProjectChanges;

  /**
   * Facts about client/contact record changes.
   */
  clientChanges: ProjectUpdateExtractedClientChanges;

  /**
   * Useful notes/context that are not actual tasks.
   */
  notes: ProjectUpdateExtractedNoteFact[];

  /**
   * Optional extraction confidence.
   * The judge should not depend only on this.
   */
  confidence: number | null;
};

export type ProjectUpdateFactsExtractionInput = {
  rawInput: string;
  sourceType: ProjectUpdateV2SourceType;
};

export type ProjectUpdateFactsExtractionResult =
  | {
      ok: true;
      facts: ProjectUpdateExtractedFacts;
      normalizedRawInput: string;
    }
  | {
      ok: false;
      error: string;
      details?: unknown;
    };

export type ProjectUpdateJudgeDecisionKind =
  | "apply"
  | "already_exists"
  | "no_change"
  | "needs_review"
  | "ignore";

export type ProjectUpdateJudgeDecision = {
  id: string;
  kind: ProjectUpdateJudgeDecisionKind;

  /**
   * The final Project Update item type that will be saved to project_update_items.
   */
  itemType: ProjectUpdateItemType;

  title: string;
  description: string | null;

  targetTaskId: number | null;
  targetField: string | null;

  oldValue: JsonRecord | null;
  newValue: JsonRecord | null;

  confidence: number | null;
  reason: string | null;

  /**
   * User-facing category for review UI.
   */
  reviewLabel: "Apply" | "Already exists" | "No change" | "Needs review" | "Info";
};

export type ProjectUpdateV2AnalysisSummary = {
  headline: string;
  reasoning: string;
  riskLevel: "low" | "medium" | "high";
  detectedChanges: string[];
};

export type ProjectUpdateV2JudgeResult = {
  summary: ProjectUpdateV2AnalysisSummary;
  decisions: ProjectUpdateJudgeDecision[];
};

export type ProjectUpdateV2AnalyzerInput = {
  projectId: string;
  rawInput: string;
  sourceType: ProjectUpdateV2SourceType;
};

export type ProjectUpdateV2AnalyzerResult =
  | {
      ok: true;
      summary: ProjectUpdateV2AnalysisSummary;
      decisions: ProjectUpdateJudgeDecision[];
      normalizedRawInput: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
      details?: unknown;
    };