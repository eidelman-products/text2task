import type {
  JsonRecord,
  ProjectUpdateItemType,
} from "@/lib/project-updates/project-update-types";
import type {
  ProjectUpdateJudgeDecision,
  ProjectUpdateV2AnalysisSummary,
} from "@/lib/project-updates/v2/project-update-facts.types";

export type ProjectUpdateV2AuditItemInput = {
  projectUpdateId: string;
  projectId: string;
  targetTaskId: number | null;
  type: ProjectUpdateItemType;
  title: string;
  description: string | null;
  targetField: string | null;
  oldValue: JsonRecord | null;
  newValue: JsonRecord | null;
  confidence: number | null;
  status: "suggested" | "accepted" | "rejected" | "applied" | "skipped";
  aiReason: string | null;
  userNote: string | null;
};

export type ProjectUpdateV2AuditSummary = ProjectUpdateV2AnalysisSummary & {
  engine: "project-update-v2";
  suggestedItemCount: number;
  applyableItemCount: number;
  alreadyExistsCount: number;
  noChangeCount: number;
  needsReviewCount: number;
};

export function buildProjectUpdateV2AuditItems(input: {
  decisions: ProjectUpdateJudgeDecision[];
  projectUpdateId: string;
  projectId: string;
}): ProjectUpdateV2AuditItemInput[] {
  return input.decisions.map((decision) => ({
    projectUpdateId: input.projectUpdateId,
    projectId: input.projectId,
    targetTaskId: decision.targetTaskId,

    type: decision.itemType,
    title: decision.title,
    description: decision.description,

    targetField: decision.targetField,
    oldValue: decision.oldValue,
    newValue: decision.newValue,

    confidence: decision.confidence,
    status: "suggested",
    aiReason: buildAuditReason(decision),
    userNote: null,
  }));
}

export function buildProjectUpdateV2AuditSummary(input: {
  summary: ProjectUpdateV2AnalysisSummary;
  decisions: ProjectUpdateJudgeDecision[];
}): ProjectUpdateV2AuditSummary {
  const applyableItemCount = input.decisions.filter(
    (decision) => decision.kind === "apply" || decision.kind === "needs_review"
  ).length;

  const alreadyExistsCount = input.decisions.filter(
    (decision) => decision.kind === "already_exists"
  ).length;

  const noChangeCount = input.decisions.filter(
    (decision) => decision.kind === "no_change"
  ).length;

  const needsReviewCount = input.decisions.filter(
    (decision) => decision.kind === "needs_review"
  ).length;

  return {
    ...input.summary,
    engine: "project-update-v2",
    suggestedItemCount: input.decisions.length,
    applyableItemCount,
    alreadyExistsCount,
    noChangeCount,
    needsReviewCount,
  };
}

export function buildProjectUpdateV2TimelineSummary(input: {
  summary: ProjectUpdateV2AnalysisSummary;
  decisions: ProjectUpdateJudgeDecision[];
}) {
  const applyCount = input.decisions.filter(
    (decision) => decision.kind === "apply"
  ).length;

  const alreadyExistsCount = input.decisions.filter(
    (decision) => decision.kind === "already_exists"
  ).length;

  const noChangeCount = input.decisions.filter(
    (decision) => decision.kind === "no_change"
  ).length;

  const needsReviewCount = input.decisions.filter(
    (decision) => decision.kind === "needs_review"
  ).length;

  const parts = [
    applyCount > 0
      ? `${applyCount} ${applyCount === 1 ? "change" : "changes"} can be applied`
      : null,
    alreadyExistsCount > 0
      ? `${alreadyExistsCount} already ${alreadyExistsCount === 1 ? "exists" : "exist"}`
      : null,
    noChangeCount > 0
      ? `${noChangeCount} ${noChangeCount === 1 ? "thing already matches" : "things already match"}`
      : null,
    needsReviewCount > 0
      ? `${needsReviewCount} ${needsReviewCount === 1 ? "item needs" : "items need"} review`
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : input.summary.headline;
}

function buildAuditReason(decision: ProjectUpdateJudgeDecision) {
  const labels = [
    `Review result: ${decision.reviewLabel}`,
    decision.reason,
  ].filter(Boolean);

  return labels.join(" · ") || null;
}