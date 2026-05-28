import {
  createProjectTimelineEvent,
  createProjectUpdateAuditItems,
  createProjectUpdateAuditRecord,
} from "@/lib/project-updates/project-update-audit.server";
import { loadProjectUpdateContext } from "@/lib/project-updates/project-update-context.server";
import { createClient } from "@/lib/supabase/server";
import { findDuplicateSubtaskInProject } from "@/lib/tasks/subtask-duplicate-detection";

import type { AnalyzeProjectUpdateResponse } from "@/lib/project-updates/project-update-analysis.server";
import type {
  ExistingProjectUpdateContext,
  JsonRecord,
  ProjectUpdateItemType,
} from "@/lib/project-updates/project-update-types";
import type { ProjectUpdateImageExtraction } from "@/lib/project-updates/project-update-image.server";

type DeterministicImageItem = {
  type: ProjectUpdateItemType;
  title: string;
  description: string | null;
  targetTaskId: number | null;
  targetField: string | null;
  oldValue: JsonRecord | null;
  newValue: JsonRecord | null;
  confidence: number | null;
  aiReason: string | null;
};

type AnalyzeProjectUpdateImageInput = {
  projectId: string;
  rawInput: string;
  imageExtraction: ProjectUpdateImageExtraction;
};

type AnalyzeProjectUpdateImageResult = {
  status: number;
  response: AnalyzeProjectUpdateResponse;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.;]+$/g, "")
    .trim();
}

function normalizeComparableText(value: string | null | undefined) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/^by\s+/i, "")
    .replace(/[^\p{L}\p{N}\s$]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRequestedTaskTitle(value: string) {
  return normalizeText(value)
    .replace(/^[-*•\d.)\s]+/, "")
    .replace(/\bwith\s+our\s+new\b/gi, "with new")
    .replace(/\bwith\s+the\s+new\b/gi, "with new")
    .trim();
}

function uniqueCleanValues(values: string[]) {
  const seen = new Set<string>();

  return values
    .map(cleanRequestedTaskTitle)
    .filter((value) => {
      if (!value) return false;

      const key = normalizeComparableText(value);
      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}

function normalizePriorityMention(value: string): "Low" | "Medium" | "High" | null {
  const normalized = normalizeComparableText(value);

  if (!normalized) return null;
  if (/\b(high|urgent|asap|rush|immediately)\b/.test(normalized)) return "High";
  if (/\b(low|no rush|not urgent|flexible|whenever)\b/.test(normalized)) return "Low";
  if (/\b(medium|normal|standard)\b/.test(normalized)) return "Medium";

  return null;
}

function isSameMeaningfulValue(current: string | null | undefined, next: string) {
  const currentValue = normalizeComparableText(current);
  const nextValue = normalizeComparableText(next);

  return Boolean(currentValue && nextValue && currentValue === nextValue);
}

function getCurrentDeadlineValue(project: ExistingProjectUpdateContext["project"]) {
  return project.deadline_text || project.deadline_date || null;
}

function getHeadlineForItems(items: DeterministicImageItem[]) {
  const applyableCount = items.filter(
    (item) => item.type !== "duplicate_warning" && item.type !== "no_action"
  ).length;
  const duplicateCount = items.filter((item) => item.type === "duplicate_warning").length;

  if (applyableCount > 0 && duplicateCount > 0) {
    return `${applyableCount} suggested changes and ${duplicateCount} duplicate ${duplicateCount === 1 ? "warning" : "warnings"} found.`;
  }

  if (applyableCount > 0) {
    return `${applyableCount} suggested ${applyableCount === 1 ? "change" : "changes"} found from the screenshot.`;
  }

  if (duplicateCount > 0) {
    return `${duplicateCount} requested ${duplicateCount === 1 ? "task already exists" : "tasks already exist"} in this project.`;
  }

  return "No new project changes found in the screenshot.";
}

function getDetectedChanges(items: DeterministicImageItem[]) {
  const labels = new Set<string>();

  items.forEach((item) => {
    if (item.type === "new_subtask") labels.add("new_subtask");
    if (item.type === "deadline_change") labels.add("deadline_change");
    if (item.type === "priority_change") labels.add("priority_change");
    if (item.type === "budget_change") labels.add("budget_change");
    if (item.type === "client_note") labels.add("client_note");
    if (item.type === "duplicate_warning") labels.add("duplicate_warning");
  });

  return Array.from(labels);
}

async function mapRequestedTasks(input: {
  extraction: ProjectUpdateImageExtraction;
  projectId: string;
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}): Promise<DeterministicImageItem[]> {
  const items: DeterministicImageItem[] = [];
  const requestedTasks = uniqueCleanValues(input.extraction.requestedTasks);

  for (const requestedTask of requestedTasks) {
    const duplicate = await findDuplicateSubtaskInProject({
      supabase: input.supabase,
      userId: input.userId,
      projectId: input.projectId,
      candidateTitle: requestedTask,
    });

    if (duplicate) {
      items.push({
        type: "duplicate_warning",
        title: "Already in this project",
        description:
          "Text2Task found a matching subtask, so it will not create another one.",
        targetTaskId: duplicate.existingTaskId,
        targetField: "task_title",
        oldValue: {
          existing_task_id: duplicate.existingTaskId,
          existing_title: duplicate.existingTitle,
        },
        newValue: {
          proposed_title: requestedTask,
          existing_task_id: duplicate.existingTaskId,
          existing_title: duplicate.existingTitle,
          score: duplicate.score,
          reason: duplicate.reason,
        },
        confidence: null,
        aiReason: "The requested task matches or closely resembles an existing subtask.",
      });
      continue;
    }

    items.push({
      type: "new_subtask",
      title: requestedTask,
      description: "Client requested this from the screenshot.",
      targetTaskId: null,
      targetField: "task_title",
      oldValue: null,
      newValue: {
        task_title: requestedTask,
        status: "New",
        priority: "Medium",
      },
      confidence: null,
      aiReason: "This screenshot request is treated as a requested deliverable.",
    });
  }

  return items;
}

function mapDeadlineMentions(input: {
  extraction: ProjectUpdateImageExtraction;
  project: ExistingProjectUpdateContext["project"];
}) {
  const deadlineText = uniqueCleanValues(input.extraction.deadlineMentions)[0];

  if (!deadlineText || isSameMeaningfulValue(getCurrentDeadlineValue(input.project), deadlineText)) {
    return null;
  }

  return {
    type: "deadline_change" as const,
    title: `Move project deadline to ${deadlineText}`,
    description: "Client requested a project deadline change in the screenshot.",
    targetTaskId: null,
    targetField: "deadline_text",
    oldValue: {
      deadline_text: input.project.deadline_text,
      deadline_date: input.project.deadline_date,
    },
    newValue: {
      deadline_text: deadlineText,
    },
    confidence: null,
    aiReason: "The screenshot includes a clear deadline mention.",
  };
}

function mapPriorityMentions(input: {
  extraction: ProjectUpdateImageExtraction;
  project: ExistingProjectUpdateContext["project"];
}) {
  const priority = uniqueCleanValues(input.extraction.priorityMentions)
    .map(normalizePriorityMention)
    .find((value): value is "Low" | "Medium" | "High" => Boolean(value));

  if (!priority || normalizeComparableText(input.project.priority) === priority.toLowerCase()) {
    return null;
  }

  return {
    type: "priority_change" as const,
    title: `Update project priority to ${priority}`,
    description: "Client indicated a priority change in the screenshot.",
    targetTaskId: null,
    targetField: "priority",
    oldValue: {
      priority: input.project.priority,
    },
    newValue: {
      priority,
    },
    confidence: null,
    aiReason: "The screenshot includes a clear priority cue.",
  };
}

function mapBudgetMentions(input: {
  extraction: ProjectUpdateImageExtraction;
  project: ExistingProjectUpdateContext["project"];
}) {
  const amount = uniqueCleanValues(input.extraction.budgetMentions)[0];

  if (!amount || isSameMeaningfulValue(input.project.amount, amount)) {
    return null;
  }

  return {
    type: "budget_change" as const,
    title: `Update project budget to ${amount}`,
    description: "Client mentioned a budget change in the screenshot.",
    targetTaskId: null,
    targetField: "amount",
    oldValue: {
      amount: input.project.amount,
      amount_value: input.project.amount_value,
      currency_code: input.project.currency_code,
    },
    newValue: {
      amount,
    },
    confidence: null,
    aiReason: "The screenshot includes a budget mention.",
  };
}

function mapClientNotes(extraction: ProjectUpdateImageExtraction) {
  const notes = uniqueCleanValues(extraction.clientNotes)
    .filter((note) => !/\b(deadline|priority|budget|urgent|asap)\b/i.test(note))
    .slice(0, 2);

  return notes.map((note): DeterministicImageItem => ({
    type: "client_note",
    title: "Add client note",
    description: "Screenshot included additional client context.",
    targetTaskId: null,
    targetField: "client_note",
    oldValue: null,
    newValue: {
      note,
    },
    confidence: null,
    aiReason: "The screenshot includes useful context that is not a task.",
  }));
}

function mapImageItemToAuditItem(input: {
  item: DeterministicImageItem;
  projectUpdateId: string;
  projectId: string;
}) {
  return {
    projectUpdateId: input.projectUpdateId,
    projectId: input.projectId,
    targetTaskId: input.item.targetTaskId,
    type: input.item.type,
    title: input.item.title,
    description: input.item.description,
    targetField: input.item.targetField,
    oldValue: input.item.oldValue,
    newValue: input.item.newValue,
    confidence: input.item.confidence,
    status: "suggested" as const,
    aiReason: input.item.aiReason,
    userNote: null,
  };
}

export async function analyzeProjectUpdateImageDeterministically(
  input: AnalyzeProjectUpdateImageInput
): Promise<AnalyzeProjectUpdateImageResult> {
  const contextResult = await loadProjectUpdateContext(input.projectId);

  if (!contextResult.ok) {
    return {
      status: contextResult.status,
      response: {
        ok: false,
        error: contextResult.error,
      },
    };
  }

  const supabase = await createClient();
  const taskItems = await mapRequestedTasks({
    extraction: input.imageExtraction,
    projectId: contextResult.context.project.id,
    userId: contextResult.userId,
    supabase,
  });
  const deadlineItem = mapDeadlineMentions({
    extraction: input.imageExtraction,
    project: contextResult.context.project,
  });
  const priorityItem = mapPriorityMentions({
    extraction: input.imageExtraction,
    project: contextResult.context.project,
  });
  const budgetItem = mapBudgetMentions({
    extraction: input.imageExtraction,
    project: contextResult.context.project,
  });
  const noteItems = mapClientNotes(input.imageExtraction);
  const items = [
    ...taskItems,
    deadlineItem,
    priorityItem,
    budgetItem,
    ...noteItems,
  ].filter((item): item is DeterministicImageItem => Boolean(item));

  if (items.length === 0) {
    items.push({
      type: "no_action",
      title: "No new project changes",
      description: "Text2Task did not find a new change to add from this screenshot.",
      targetTaskId: null,
      targetField: null,
      oldValue: null,
      newValue: null,
      confidence: null,
      aiReason: "The screenshot did not contain actionable changes that differ from the current project.",
    });
  }

  const headline = getHeadlineForItems(items);
  const analysis = {
    headline,
    reasoning:
      "Text2Task extracted visible screenshot instructions and mapped them to project update suggestions without asking the model to choose project update item types.",
    riskLevel: "low" as const,
    detectedChanges: getDetectedChanges(items),
  };

  const updateResult = await createProjectUpdateAuditRecord({
    projectId: contextResult.context.project.id,
    clientId: contextResult.context.project.client_id,
    rawInput: input.rawInput,
    sourceType: "image",
    status: "analyzed",
    aiSummary: {
      ...analysis,
      model: "deterministic-image-mapper",
      suggestedItemCount: items.length,
      imageExtraction: input.imageExtraction,
    },
  });

  if (!updateResult.ok) {
    return {
      status: updateResult.status,
      response: {
        ok: false,
        error: updateResult.error,
      },
    };
  }

  const itemResult = await createProjectUpdateAuditItems(
    items.map((item) =>
      mapImageItemToAuditItem({
        item,
        projectUpdateId: updateResult.data.id,
        projectId: contextResult.context.project.id,
      })
    )
  );

  if (!itemResult.ok) {
    return {
      status: itemResult.status,
      response: {
        ok: false,
        error: itemResult.error,
      },
    };
  }

  const timelineResult = await createProjectTimelineEvent({
    projectId: contextResult.context.project.id,
    eventType: "ai_update_analyzed",
    eventTitle: "Screenshot update analyzed",
    eventSummary: headline,
    sourceUpdateId: updateResult.data.id,
    metadata: {
      model: "deterministic-image-mapper",
      sourceType: "image",
      suggestedItemCount: itemResult.data.length,
      riskLevel: analysis.riskLevel,
    },
  });

  return {
    status: 200,
    response: {
      ok: true,
      update: updateResult.data,
      items: itemResult.data,
      timelineEvent: timelineResult.ok ? timelineResult.data : null,
      analysis,
    },
  };
}
