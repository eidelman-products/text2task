import type {
  ExistingProjectUpdateContext,
  JsonRecord,
} from "@/lib/project-updates/project-update-types";
import {
  normalizeProjectUpdateBudget,
  resolveProjectUpdateDeadline,
} from "@/lib/project-updates/project-update-field-normalizers";
import { resolveSubtaskReference } from "@/lib/project-updates/v2/project-update-subtask-reference.server";

import type {
  ProjectUpdateExtractedFacts,
  ProjectUpdateExtractedSubtaskFact,
  ProjectUpdateFactPriority,
  ProjectUpdateFactStatus,
  ProjectUpdateJudgeDecision,
  ProjectUpdateV2AnalysisSummary,
  ProjectUpdateV2JudgeResult,
} from "@/lib/project-updates/v2/project-update-facts.types";

type JudgeProjectUpdateInput = {
  facts: ProjectUpdateExtractedFacts;
  context: ExistingProjectUpdateContext;
};

export function judgeProjectUpdateFacts({
  facts,
  context,
}: JudgeProjectUpdateInput): ProjectUpdateV2JudgeResult {
  const decisions: ProjectUpdateJudgeDecision[] = [];

  facts.requestedSubtasks.forEach((subtask, index) => {
    decisions.push(
      judgeRequestedSubtask({
        subtask,
        context,
        index,
      })
    );
  });

  const deadlineDecision = judgeProjectDeadlineChange({
    deadlineText: facts.projectChanges.deadlineText,
    context,
  });

  if (deadlineDecision) {
    decisions.push(deadlineDecision);
  }

  const amountDecision = judgeProjectAmountChange({
    amount: facts.projectChanges.amount,
    context,
  });

  if (amountDecision) {
    decisions.push(amountDecision);
  }

  const priorityDecision = judgeProjectPriorityChange({
    priority: facts.projectChanges.priority,
    context,
  });

  if (priorityDecision) {
    decisions.push(priorityDecision);
  }

  const statusDecision = judgeProjectStatusChange({
    status: facts.projectChanges.status,
    context,
  });

  if (statusDecision) {
    decisions.push(statusDecision);
  }

  const clientDecision = judgeClientChanges({
    facts,
    context,
  });

  if (clientDecision) {
    decisions.push(clientDecision);
  }


  if (decisions.length === 0) {
    decisions.push({
      id: "no-action-1",
      kind: "no_change",
      itemType: "no_action",
      title: "No new project changes found",
      description:
        "Text2Task did not find a clear update that changes this project.",
      targetTaskId: null,
      targetField: null,
      oldValue: null,
      newValue: null,
      confidence: facts.confidence,
      reason:
        "The extracted update did not include requested work, project changes, client changes, or useful notes.",
      reviewLabel: "No change",
    });
  }

  return {
    summary: buildJudgeSummary(decisions),
    decisions,
  };
}

function findSubtaskById(
  subtasks: ExistingProjectUpdateContext["subtasks"],
  taskId: number
) {
  return subtasks.find((subtask) => Number(subtask.id) === taskId) ?? null;
}

/**
 * Project Update V2 subtask matching:
 *
 * Identity resolution (is this extracted reference the same deliverable as
 * an existing subtask?) is fully delegated to resolveSubtaskReference,
 * which never receives or trusts a client/AI-supplied id -- it only reads
 * project-owned subtask ids from `context.subtasks`.
 *
 * This function is only responsible for turning that resolution, plus the
 * extracted fact's own fields (status, deadline, amount, priority), into
 * the correct ProjectUpdateJudgeDecision.
 *
 * A claimed-complete/approved fact (subtask.status === "Done") is treated
 * specially: unless the reference is confidently identified, it must never
 * become a brand-new subtask that is already marked Done. A client does
 * not report brand-new work as already finished, so an unmatched
 * completion claim always needs human review instead.
 */
function judgeRequestedSubtask({
  subtask,
  context,
  index,
}: {
  subtask: ProjectUpdateExtractedSubtaskFact;
  context: ExistingProjectUpdateContext;
  index: number;
}): ProjectUpdateJudgeDecision {
  const title = cleanTitle(subtask.title);
  const isCompletionFact = subtask.status === "Done";
  const decisionId = `subtask-${index + 1}`;

  const resolution = resolveSubtaskReference({
    candidateTitle: title,
    subtasks: context.subtasks,
  });

  if (resolution.outcome === "confident_match") {
    const matchedSubtask = findSubtaskById(
      context.subtasks,
      resolution.targetTaskId
    );
    const existingTitle = matchedSubtask?.task_title?.trim() || title;

    if (isCompletionFact) {
      const existingStatus = normalizeStatus(matchedSubtask?.status ?? null);

      if (existingStatus === "Done") {
        return {
          id: decisionId,
          kind: "no_change",
          itemType: "no_action",
          title: "Subtask is already Done",
          description:
            "The client approved or completed this deliverable, and the matching subtask is already marked Done.",
          targetTaskId: resolution.targetTaskId,
          targetField: "status",
          oldValue: {
            existing_task_id: resolution.targetTaskId,
            existing_title: existingTitle,
            status: matchedSubtask?.status ?? null,
          },
          newValue: {
            status: "Done",
          },
          confidence: resolution.confidenceScore,
          reason: resolution.reason,
          reviewLabel: "No change",
        };
      }

      return {
        id: decisionId,
        kind: "apply",
        itemType: "update_subtask",
        title: `Mark ${existingTitle} as Done`,
        description:
          subtask.description ||
          "Client approval or completion language matches this existing subtask.",
        targetTaskId: resolution.targetTaskId,
        targetField: "status",
        oldValue: {
          existing_task_id: resolution.targetTaskId,
          existing_title: existingTitle,
          status: matchedSubtask?.status ?? null,
        },
        newValue: {
          status: "Done",
        },
        confidence: resolution.confidenceScore,
        reason: resolution.reason,
        reviewLabel: "Apply",
      };
    }

    const newValue = compactRecord({
      task_title: title,
      deadline_text: subtask.deadlineText,
      amount: subtask.amount,
      priority: subtask.priority,
      status: subtask.status,
    });

    if (Object.keys(newValue).length === 0) {
      return {
        id: decisionId,
        kind: "no_change",
        itemType: "no_action",
        title: "This task already exists",
        description:
          "Text2Task found this requested work already in the project, so it will not create another subtask.",
        targetTaskId: resolution.targetTaskId,
        targetField: "task_title",
        oldValue: {
          existing_task_id: resolution.targetTaskId,
          existing_title: existingTitle,
        },
        newValue: null,
        confidence: resolution.confidenceScore,
        reason: resolution.reason,
        reviewLabel: "Already exists",
      };
    }

    return {
      id: decisionId,
      kind: "apply",
      itemType: "update_subtask",
      title,
      description:
        subtask.description ||
        `Client requested an update to existing subtask: ${existingTitle}.`,
      targetTaskId: resolution.targetTaskId,
      targetField: "task_title",
      oldValue: {
        existing_task_id: resolution.targetTaskId,
        existing_title: existingTitle,
      },
      newValue,
      confidence: resolution.confidenceScore,
      reason: resolution.reason,
      reviewLabel: "Apply",
    };
  }

  if (resolution.outcome === "ambiguous_match") {
    const bestCandidate =
      resolution.bestCandidateTaskId !== null
        ? findSubtaskById(context.subtasks, resolution.bestCandidateTaskId)
        : null;

    return {
      id: decisionId,
      kind: "needs_review",
      itemType: "needs_review",
      title: isCompletionFact
        ? `Review before marking "${title}" as Done`
        : `Review before creating "${title}"`,
      description: isCompletionFact
        ? "The client referenced a deliverable as approved or complete, but Text2Task could not confidently identify a single matching subtask. Review before applying."
        : "Text2Task found a possible related subtask but is not confident enough to update it automatically. Review before applying.",
      targetTaskId: resolution.bestCandidateTaskId,
      targetField: "task_title",
      oldValue: resolution.bestCandidateTaskId
        ? {
            existing_task_id: resolution.bestCandidateTaskId,
            existing_title: bestCandidate?.task_title ?? null,
          }
        : null,
      newValue: {
        proposed_title: title,
        status: subtask.status,
      },
      confidence: resolution.confidenceScore,
      reason: resolution.reason,
      reviewLabel: "Needs review",
    };
  }

  // resolution.outcome === "no_match"
  if (isCompletionFact) {
    return {
      id: decisionId,
      kind: "needs_review",
      itemType: "needs_review",
      title: `Review before marking "${title}" as Done`,
      description:
        "The client referenced a deliverable as approved or complete, but Text2Task could not find a matching existing subtask. A claimed-complete item with no confident match is not safe to create as new, already-finished work.",
      targetTaskId: null,
      targetField: "task_title",
      oldValue: null,
      newValue: {
        proposed_title: title,
        status: subtask.status,
      },
      confidence: null,
      reason: resolution.reason,
      reviewLabel: "Needs review",
    };
  }

  return {
    id: decisionId,
    kind: "apply",
    itemType: "new_subtask",
    title,
    description:
      subtask.description || "Client requested this additional work item.",
    targetTaskId: null,
    targetField: "task_title",
    oldValue: null,
    newValue: compactRecord({
      task_title: title,
      deadline_text: subtask.deadlineText,
      amount: subtask.amount,
      priority: subtask.priority || "Medium",
      status: subtask.status || "New",
    }),
    confidence: 0.9,
    reason:
      "This requested work item does not match an existing subtask in the project.",
    reviewLabel: "Apply",
  };
}

function judgeProjectDeadlineChange({
  deadlineText,
  context,
}: {
  deadlineText: string | null;
  context: ExistingProjectUpdateContext;
}): ProjectUpdateJudgeDecision | null {
  if (!deadlineText) return null;

  const requestedDeadline = resolveProjectUpdateDeadline({
    deadlineText,
    currentDeadlineDate: context.project.deadline_date,
  });
  const requestedDeadlineDate = requestedDeadline.deadline_date;
  const currentDeadlineDate = context.project.deadline_date?.trim() || null;

  if (requestedDeadlineDate) {
    if (
      currentDeadlineDate &&
      areSameDeadlineDate(currentDeadlineDate, requestedDeadlineDate)
    ) {
      return {
        id: "project-deadline",
        kind: "no_change",
        itemType: "no_action",
        title: "Deadline already matches this project",
        description:
          "The client mentioned the deadline, but it already matches the current project deadline.",
        targetTaskId: null,
        targetField: "deadline_text",
        oldValue: {
          deadline_text: context.project.deadline_text,
          deadline_date: context.project.deadline_date,
        },
        newValue: {
          deadline_text: requestedDeadline.deadline_text,
          deadline_date: requestedDeadlineDate,
        },
        confidence: 0.95,
        reason:
          "The requested deadline normalizes to the same date as the current project deadline.",
        reviewLabel: "No change",
      };
    }

    return {
      id: "project-deadline",
      kind: "apply",
      itemType: "deadline_change",
      title: `Update project deadline to ${deadlineText}`,
      description: "Client requested a project-wide deadline change.",
      targetTaskId: null,
      targetField: "deadline_text",
      oldValue: {
        deadline_text: context.project.deadline_text,
        deadline_date: context.project.deadline_date,
      },
      newValue: requestedDeadline,
      confidence: 0.9,
      reason:
        "The client update includes a project-wide deadline date that differs from the current project deadline date.",
      reviewLabel: "Apply",
    };
  }

  const currentDeadline =
    context.project.deadline_text || context.project.deadline_date || null;

  if (currentDeadline && areSameDeadlineValue(currentDeadline, deadlineText)) {
    return {
      id: "project-deadline",
      kind: "no_change",
      itemType: "no_action",
      title: "Deadline already matches this project",
      description:
        "The client mentioned the deadline, but it already matches the current project deadline.",
      targetTaskId: null,
      targetField: "deadline_text",
      oldValue: {
        deadline_text: context.project.deadline_text,
        deadline_date: context.project.deadline_date,
      },
      newValue: requestedDeadline,
      confidence: 0.95,
      reason:
        "The requested deadline normalizes to the same value as the current project deadline.",
      reviewLabel: "No change",
    };
  }

  return {
    id: "project-deadline",
    kind: "apply",
    itemType: "deadline_change",
    title: `Update project deadline to ${deadlineText}`,
    description: "Client requested a project-wide deadline change.",
    targetTaskId: null,
    targetField: "deadline_text",
    oldValue: {
      deadline_text: context.project.deadline_text,
      deadline_date: context.project.deadline_date,
    },
    newValue: requestedDeadline,
    confidence: 0.9,
    reason:
      "The client update includes a project-wide deadline that differs from the current project deadline.",
    reviewLabel: "Apply",
  };
}

function judgeProjectAmountChange({
  amount,
  context,
}: {
  amount: string | null;
  context: ExistingProjectUpdateContext;
}): ProjectUpdateJudgeDecision | null {
  if (!amount) return null;

  const normalizedBudget = normalizeProjectUpdateBudget({
    amountText: amount,
    existingCurrencyCode: context.project.currency_code,
    existingAmountText: context.project.amount,
  });
  const newValue = normalizedBudget ?? { amount };

  const currentAmount =
    context.project.amount ||
    (typeof context.project.amount_value === "number"
      ? String(context.project.amount_value)
      : null);

  if (currentAmount && areSameMoneyValue(currentAmount, amount)) {
    return {
      id: "project-budget",
      kind: "no_change",
      itemType: "no_action",
      title: "Budget already matches this project",
      description:
        "The client mentioned the budget, but it already matches the current project budget.",
      targetTaskId: null,
      targetField: "amount",
      oldValue: {
        amount: context.project.amount,
        amount_value: context.project.amount_value,
        currency_code: context.project.currency_code,
      },
      newValue,
      confidence: 0.95,
      reason:
        "The requested budget normalizes to the same value as the current project budget.",
      reviewLabel: "No change",
    };
  }

  return {
    id: "project-budget",
    kind: "apply",
    itemType: "budget_change",
    title: `Update project budget to ${amount}`,
    description: "Client requested a project-wide budget change.",
    targetTaskId: null,
    targetField: "amount",
    oldValue: {
      amount: context.project.amount,
      amount_value: context.project.amount_value,
      currency_code: context.project.currency_code,
    },
    newValue,
    confidence: 0.9,
    reason:
      "The client update includes a project-wide budget that differs from the current project budget.",
    reviewLabel: "Apply",
  };
}

function judgeProjectPriorityChange({
  priority,
  context,
}: {
  priority: ProjectUpdateFactPriority | null;
  context: ExistingProjectUpdateContext;
}): ProjectUpdateJudgeDecision | null {
  if (!priority) return null;

  const currentPriority = normalizePriority(context.project.priority);

  if (currentPriority && currentPriority === priority) {
    return {
      id: "project-priority",
      kind: "no_change",
      itemType: "no_action",
      title: "Priority already matches this project",
      description:
        "The client mentioned the priority, but the project already has this priority.",
      targetTaskId: null,
      targetField: "priority",
      oldValue: {
        priority: context.project.priority,
      },
      newValue: {
        priority,
      },
      confidence: 0.95,
      reason:
        "The requested priority is the same as the current project priority.",
      reviewLabel: "No change",
    };
  }

  return {
    id: "project-priority",
    kind: "apply",
    itemType: "priority_change",
    title: `Update project priority to ${priority}`,
    description: "Client requested a project-wide priority change.",
    targetTaskId: null,
    targetField: "priority",
    oldValue: {
      priority: context.project.priority,
    },
    newValue: {
      priority,
    },
    confidence: 0.9,
    reason:
      "The client update includes a project-wide priority that differs from the current project priority.",
    reviewLabel: "Apply",
  };
}

function judgeProjectStatusChange({
  status,
  context,
}: {
  status: ProjectUpdateFactStatus | null;
  context: ExistingProjectUpdateContext;
}): ProjectUpdateJudgeDecision | null {
  if (!status) return null;

  const currentStatus = normalizeStatus(context.project.status);

  if (currentStatus && currentStatus === status) {
    return {
      id: "project-status",
      kind: "no_change",
      itemType: "no_action",
      title: "Status already matches this project",
      description:
        "The client mentioned the status, but the project already has this status.",
      targetTaskId: null,
      targetField: "status",
      oldValue: {
        status: context.project.status,
      },
      newValue: {
        status,
      },
      confidence: 0.95,
      reason: "The requested status is the same as the current project status.",
      reviewLabel: "No change",
    };
  }

  return {
    id: "project-status",
    kind: "apply",
    itemType: "status_change",
    title: `Update project status to ${status}`,
    description: "Client requested a project-wide status change.",
    targetTaskId: null,
    targetField: "status",
    oldValue: {
      status: context.project.status,
    },
    newValue: {
      status,
    },
    confidence: 0.9,
    reason:
      "The client update includes a project-wide status that differs from the current project status.",
    reviewLabel: "Apply",
  };
}

function judgeClientChanges({
  facts,
  context,
}: {
  facts: ProjectUpdateExtractedFacts;
  context: ExistingProjectUpdateContext;
}): ProjectUpdateJudgeDecision | null {
  const nextClient = compactRecord({
    client_name: facts.clientChanges.clientName,
    contact_name: facts.clientChanges.contactName,
    phone: facts.clientChanges.phone,
    email: facts.clientChanges.email,
    notes: facts.clientChanges.notes,
  });

  if (Object.keys(nextClient).length === 0) {
    return null;
  }

  const currentClient = {
    client_name: context.project.client_name || context.client?.name || null,
    contact_name: context.project.contact_name || null,
    phone: context.client?.phone || null,
    email: context.client?.email || null,
    notes: context.client?.notes || null,
  };

  const changedFields = Object.entries(nextClient).filter(([key, value]) => {
    const currentValue = currentClient[key as keyof typeof currentClient];

    return !areSameLooseTextValue(currentValue, value);
  });

  if (changedFields.length === 0) {
    return null;
  }

  return {
    id: "client-details",
    kind: "apply",
    itemType: "client_detail_change",
    title: "Update client details",
    description: "The client update included client/contact information changes.",
    targetTaskId: null,
    targetField: "client_details",
    oldValue: currentClient,
    newValue: nextClient,
    confidence: 0.88,
    reason: "One or more extracted client details differ from the saved record.",
    reviewLabel: "Apply",
  };
}

function buildJudgeSummary(
  decisions: ProjectUpdateJudgeDecision[]
): ProjectUpdateV2AnalysisSummary {
  const applyCount = decisions.filter((decision) => decision.kind === "apply").length;
  const alreadyExistsCount = decisions.filter(
    (decision) => decision.kind === "already_exists"
  ).length;
  const noChangeCount = decisions.filter(
    (decision) => decision.kind === "no_change"
  ).length;
  const needsReviewCount = decisions.filter(
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

  const headline =
    parts.length > 0
      ? parts.join(", ")
      : "No new project changes found";

  return {
    headline,
    reasoning:
      "Text2Task extracted simple facts from the client update, then compared them against the existing project and subtasks.",
    riskLevel: needsReviewCount > 0 ? "medium" : "low",
    detectedChanges: buildDetectedChanges(decisions),
  };
}

function buildDetectedChanges(decisions: ProjectUpdateJudgeDecision[]) {
  const labels = new Set<string>();

  decisions.forEach((decision) => {
    if (decision.kind === "apply") {
      labels.add(decision.itemType);
      return;
    }

    if (decision.kind === "already_exists") {
      labels.add("already_exists");
      return;
    }

    if (decision.kind === "no_change") {
      labels.add("no_change");
      return;
    }

    if (decision.kind === "needs_review") {
      labels.add("needs_review");
    }
  });

  return Array.from(labels);
}

function compactRecord(record: Record<string, unknown>): JsonRecord {
  const compacted: JsonRecord = {};

  Object.entries(record).forEach(([key, value]) => {
    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed) {
        compacted[key] = trimmed;
      }

      return;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      compacted[key] = value;
      return;
    }

    if (value !== null && value !== undefined) {
      compacted[key] = value;
    }
  });

  return compacted;
}

function cleanTitle(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.;]+$/g, "")
    .trim();
}

function normalizePriority(value: unknown): ProjectUpdateFactPriority | null {
  const normalized = normalizePlainText(value);

  if (normalized === "low") return "Low";
  if (normalized === "medium") return "Medium";
  if (normalized === "high") return "High";

  return null;
}

function normalizeStatus(value: unknown): ProjectUpdateFactStatus | null {
  const normalized = normalizePlainText(value).replace(/[_-]+/g, " ");

  if (normalized === "new") return "New";
  if (normalized === "in progress") return "In Progress";
  if (normalized === "review") return "Review";
  if (normalized === "urgent") return "Urgent";

  if (
    normalized === "done" ||
    normalized === "complete" ||
    normalized === "completed"
  ) {
    return "Done";
  }

  return null;
}

function areSameDeadlineValue(a: unknown, b: unknown) {
  const normalizedA = normalizeComparableDeadline(a);
  const normalizedB = normalizeComparableDeadline(b);

  if (!normalizedA || !normalizedB) return false;

  return normalizedA === normalizedB;
}

function areSameDeadlineDate(a: unknown, b: unknown) {
  const normalizedA = normalizeDeadlineDateKey(a);
  const normalizedB = normalizeDeadlineDateKey(b);

  if (!normalizedA || !normalizedB) return false;

  return normalizedA === normalizedB;
}

function areSameMoneyValue(a: unknown, b: unknown) {
  const normalizedA = normalizeMoneyishValue(a);
  const normalizedB = normalizeMoneyishValue(b);

  if (!normalizedA || !normalizedB) return false;

  return normalizedA === normalizedB;
}

function areSameLooseTextValue(a: unknown, b: unknown) {
  const normalizedA = normalizeComparableText(a);
  const normalizedB = normalizeComparableText(b);

  if (!normalizedA || !normalizedB) return false;

  return normalizedA === normalizedB;
}

function normalizePlainText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeComparableText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparableDeadline(value: unknown) {
  return normalizeComparableText(value)
    .replace(/\bby\b/g, " ")
    .replace(/\bdue\b/g, " ")
    .replace(/\bdeadline\b/g, " ")
    .replace(/\bproject\b/g, " ")
    .replace(/\bmove\b/g, " ")
    .replace(/\bchange\b/g, " ")
    .replace(/\bupdate\b/g, " ")
    .replace(/\bto\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDeadlineDateKey(value: unknown) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  const dateOnly = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];

  if (dateOnly) return dateOnly;

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toISOString().slice(0, 10);
}

function normalizeMoneyishValue(value: unknown) {
  const raw = String(value || "").toLowerCase();

  const numeric = raw.match(/\d+(?:[.,]\d+)?/g)?.join("") || "";
  const currency =
    raw.includes("usd") || raw.includes("$")
      ? "usd"
      : raw.includes("eur") || raw.includes("€")
        ? "eur"
        : raw.includes("gbp") || raw.includes("£")
          ? "gbp"
          : "";

  if (!numeric) {
    return normalizeComparableText(raw);
  }

  return `${numeric}${currency}`;
}
