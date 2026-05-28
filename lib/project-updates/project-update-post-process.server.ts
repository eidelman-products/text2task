import type {
  ExistingProjectUpdateContext,
  JsonRecord,
} from "@/lib/project-updates/project-update-types";
import type { ProjectUpdateItemType } from "@/lib/project-updates/project-update-types";
import { compareSubtaskTitles } from "@/lib/tasks/task-title-similarity";

export type PostProcessProjectUpdateItem = {
  type: ProjectUpdateItemType;
  title: string;
  description?: string | null;
  targetTaskId?: number | string | null;
  targetField?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  confidence?: number | null;
  aiReason?: string | null;
};

type ExistingSubtask = ExistingProjectUpdateContext["subtasks"][number];

type DuplicateMatch = {
  existingTaskId: number;
  existingTitle: string;
  proposedTitle: string;
  score: number;
  reason: string;
};

type PostProcessProjectUpdateItemsInput<TItem extends PostProcessProjectUpdateItem> = {
  items: TItem[];
  context: ExistingProjectUpdateContext;
};

export function postProcessProjectUpdateItems<TItem extends PostProcessProjectUpdateItem>({
  items,
  context,
}: PostProcessProjectUpdateItemsInput<TItem>): TItem[] {
  return items.map((item) => postProcessProjectUpdateItem({ item, context }));
}

function postProcessProjectUpdateItem<TItem extends PostProcessProjectUpdateItem>({
  item,
  context,
}: {
  item: TItem;
  context: ExistingProjectUpdateContext;
}): TItem {
  if (item.type === "deadline_change") {
    return postProcessProjectDeadlineChange({ item, context });
  }

  if (item.type === "priority_change") {
    return postProcessProjectPriorityChange({ item, context });
  }

  if (item.type === "status_change") {
    return postProcessProjectStatusChange({ item, context });
  }

  if (item.type === "budget_change") {
    return postProcessProjectBudgetChange({ item, context });
  }

  if (item.type === "new_subtask") {
    return postProcessNewSubtask({ item, context });
  }

  if (item.type === "update_subtask") {
    return postProcessUpdateSubtask({ item, context });
  }

  return item;
}

function postProcessProjectDeadlineChange<TItem extends PostProcessProjectUpdateItem>({
  item,
  context,
}: {
  item: TItem;
  context: ExistingProjectUpdateContext;
}): TItem {
  const newValue = toRecord(item.newValue);
  const suggestedDeadline =
    getStringValue(newValue, ["deadline_text", "deadline", "value"]) ||
    getStringValue(newValue, ["deadlineDate", "deadline_date"]);

  const currentDeadline =
    context.project.deadline_text ||
    context.project.deadline_date ||
    "";

  if (!suggestedDeadline || !currentDeadline) {
    return item;
  }

  if (areSameLooseTextValue(suggestedDeadline, currentDeadline)) {
    return toNoActionItem(item, {
      title: "Deadline already matches this project",
      description:
        "The client mentioned the deadline, but it already matches the current project deadline.",
      oldValue: {
        deadline_text: context.project.deadline_text,
        deadline_date: context.project.deadline_date,
      },
      newValue: {
        deadline_text: suggestedDeadline,
      },
      reason:
        "The suggested deadline is the same as the existing project deadline.",
    });
  }

  return item;
}

function postProcessProjectPriorityChange<TItem extends PostProcessProjectUpdateItem>({
  item,
  context,
}: {
  item: TItem;
  context: ExistingProjectUpdateContext;
}): TItem {
  const newValue = toRecord(item.newValue);
  const suggestedPriority = normalizePriority(
    getStringValue(newValue, ["priority", "value"])
  );
  const currentPriority = normalizePriority(context.project.priority);

  if (!suggestedPriority || !currentPriority) {
    return item;
  }

  if (suggestedPriority === currentPriority) {
    return toNoActionItem(item, {
      title: "Priority already matches this project",
      description:
        "The client mentioned the priority, but the project already has this priority.",
      oldValue: {
        priority: context.project.priority,
      },
      newValue: {
        priority: suggestedPriority,
      },
      reason:
        "The suggested priority is the same as the existing project priority.",
    });
  }

  return item;
}

function postProcessProjectStatusChange<TItem extends PostProcessProjectUpdateItem>({
  item,
  context,
}: {
  item: TItem;
  context: ExistingProjectUpdateContext;
}): TItem {
  const newValue = toRecord(item.newValue);
  const suggestedStatus = normalizeStatus(
    getStringValue(newValue, ["status", "value"])
  );
  const currentStatus = normalizeStatus(context.project.status);

  if (!suggestedStatus || !currentStatus) {
    return item;
  }

  if (suggestedStatus === currentStatus) {
    return toNoActionItem(item, {
      title: "Status already matches this project",
      description:
        "The client mentioned the status, but the project already has this status.",
      oldValue: {
        status: context.project.status,
      },
      newValue: {
        status: suggestedStatus,
      },
      reason:
        "The suggested status is the same as the existing project status.",
    });
  }

  return item;
}

function postProcessProjectBudgetChange<TItem extends PostProcessProjectUpdateItem>({
  item,
  context,
}: {
  item: TItem;
  context: ExistingProjectUpdateContext;
}): TItem {
  const newValue = toRecord(item.newValue);

  const suggestedAmount =
    getStringValue(newValue, ["amount", "budget", "price", "value"]) ||
    getStringValue(newValue, ["amount_value"]);

  const currentAmount =
    context.project.amount ||
    (typeof context.project.amount_value === "number"
      ? String(context.project.amount_value)
      : "");

  if (!suggestedAmount || !currentAmount) {
    return item;
  }

  if (areSameMoneyishValue(suggestedAmount, currentAmount)) {
    return toNoActionItem(item, {
      title: "Budget already matches this project",
      description:
        "The client mentioned the budget, but it already matches the current project budget.",
      oldValue: {
        amount: context.project.amount,
        amount_value: context.project.amount_value,
        currency_code: context.project.currency_code,
      },
      newValue: {
        amount: suggestedAmount,
      },
      reason:
        "The suggested budget is the same as the existing project budget.",
    });
  }

  return item;
}

function postProcessNewSubtask<TItem extends PostProcessProjectUpdateItem>({
  item,
  context,
}: {
  item: TItem;
  context: ExistingProjectUpdateContext;
}): TItem {
  const proposedTitle = getSuggestedSubtaskTitle(item);

  if (!proposedTitle) {
    return item;
  }

  const duplicate = findDuplicateSubtaskInContext({
    subtasks: context.subtasks,
    candidateTitle: proposedTitle,
  });

  if (!duplicate) {
    return item;
  }

  return toDuplicateWarningItem(item, duplicate);
}

function postProcessUpdateSubtask<TItem extends PostProcessProjectUpdateItem>({
  item,
  context,
}: {
  item: TItem;
  context: ExistingProjectUpdateContext;
}): TItem {
  const targetTaskId = normalizeTaskId(item.targetTaskId);
  const proposedTitle = getSuggestedSubtaskTitle(item);

  if (targetTaskId) {
    const targetSubtask = context.subtasks.find(
      (subtask) => Number(subtask.id) === targetTaskId
    );

    if (!targetSubtask) {
      return item;
    }

    if (isUnchangedSubtaskUpdate({ item, subtask: targetSubtask })) {
      return toNoActionItem(item, {
        title: "Subtask already matches this update",
        description:
          "The client mentioned a subtask update, but the matching subtask already has these values.",
        oldValue: buildSubtaskSnapshot(targetSubtask),
        newValue: toRecord(item.newValue),
        reason:
          "The suggested subtask update does not change the existing subtask.",
      });
    }

    return item;
  }

  if (!proposedTitle) {
    return item;
  }

  const duplicate = findDuplicateSubtaskInContext({
    subtasks: context.subtasks,
    candidateTitle: proposedTitle,
  });

  if (!duplicate) {
    return item;
  }

  return toDuplicateWarningItem(item, duplicate);
}

function isUnchangedSubtaskUpdate({
  item,
  subtask,
}: {
  item: PostProcessProjectUpdateItem;
  subtask: ExistingSubtask;
}) {
  const newValue = toRecord(item.newValue);
  const checks: boolean[] = [];

  const nextTitle = getStringValue(newValue, ["task_title", "title", "name"]);
  if (nextTitle) {
    checks.push(areSameLooseTextValue(nextTitle, subtask.task_title || ""));
  }

  const nextDeadline = getStringValue(newValue, [
    "deadline_text",
    "deadline",
    "deadline_date",
  ]);
  if (nextDeadline) {
    checks.push(
      areSameLooseTextValue(
        nextDeadline,
        subtask.deadline_text || subtask.deadline_date || ""
      )
    );
  }

  const nextAmount = getStringValue(newValue, ["amount", "budget", "price"]);
  if (nextAmount) {
    checks.push(areSameMoneyishValue(nextAmount, subtask.amount || ""));
  }

  const nextPriority = normalizePriority(getStringValue(newValue, ["priority"]));
  if (nextPriority) {
    checks.push(nextPriority === normalizePriority(subtask.priority));
  }

  const nextStatus = normalizeStatus(getStringValue(newValue, ["status"]));
  if (nextStatus) {
    checks.push(nextStatus === normalizeStatus(subtask.status));
  }

  if (checks.length === 0) {
    return false;
  }

  return checks.every(Boolean);
}

function findDuplicateSubtaskInContext({
  subtasks,
  candidateTitle,
}: {
  subtasks: ExistingProjectUpdateContext["subtasks"];
  candidateTitle: string;
}): DuplicateMatch | null {
  const cleanCandidate = candidateTitle.trim();

  if (!cleanCandidate) {
    return null;
  }

  let bestMatch: DuplicateMatch | null = null;

  for (const subtask of subtasks) {
    const existingTitle = subtask.task_title?.trim();

    if (!existingTitle) {
      continue;
    }

    const comparison = compareSubtaskTitles(cleanCandidate, existingTitle);

    if (!comparison.isDuplicate) {
      continue;
    }

    const match: DuplicateMatch = {
      existingTaskId: Number(subtask.id),
      existingTitle,
      proposedTitle: cleanCandidate,
      score: comparison.score,
      reason: comparison.reason,
    };

    if (!bestMatch || match.score > bestMatch.score) {
      bestMatch = match;
    }
  }

  return bestMatch;
}

function getSuggestedSubtaskTitle(item: PostProcessProjectUpdateItem) {
  const newValue = toRecord(item.newValue);

  return (
    getStringValue(newValue, ["task_title", "title", "name", "proposed_title"]) ||
    item.title ||
    null
  );
}

function toDuplicateWarningItem<TItem extends PostProcessProjectUpdateItem>(
  item: TItem,
  duplicate: DuplicateMatch
): TItem {
  const isExactDuplicate =
    duplicate.score >= 100 || duplicate.reason === "normalized title match";

  return {
    ...item,
    type: "duplicate_warning",
    title: isExactDuplicate
      ? "This task already exists"
      : "Possible duplicate subtask",
    description: isExactDuplicate
      ? "Text2Task found this subtask already in the project, so it will not create another one."
      : "Text2Task found a similar existing subtask, so it will not create another one.",
    targetTaskId: duplicate.existingTaskId,
    targetField: "task_title",
    oldValue: {
      existing_task_id: duplicate.existingTaskId,
      existing_title: duplicate.existingTitle,
    },
    newValue: {
      proposed_title: duplicate.proposedTitle,
      existing_task_id: duplicate.existingTaskId,
      existing_title: duplicate.existingTitle,
      score: duplicate.score,
      reason: duplicate.reason,
    },
    confidence: item.confidence ?? null,
    aiReason: isExactDuplicate
      ? "The requested task matches an existing subtask in this project."
      : "The requested task looks similar to an existing subtask in this project.",
  };
}

function toNoActionItem<TItem extends PostProcessProjectUpdateItem>(
  item: TItem,
  input: {
    title: string;
    description: string;
    oldValue: JsonRecord | null;
    newValue: JsonRecord | null;
    reason: string;
  }
): TItem {
  return {
    ...item,
    type: "no_action",
    title: input.title,
    description: input.description,
    targetTaskId: normalizeTaskId(item.targetTaskId),
    targetField: item.targetField ?? null,
    oldValue: input.oldValue,
    newValue: input.newValue,
    confidence: item.confidence ?? null,
    aiReason: input.reason,
  };
}

function buildSubtaskSnapshot(subtask: ExistingSubtask): JsonRecord {
  return {
    task_id: subtask.id,
    task_title: subtask.task_title,
    status: subtask.status,
    priority: subtask.priority,
    deadline_text: subtask.deadline_text,
    deadline_date: subtask.deadline_date,
    amount: subtask.amount,
  };
}

function toRecord(value: unknown): JsonRecord {
  if (isRecord(value)) {
    return value;
  }

  return {};
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringValue(record: JsonRecord | null | undefined, keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function normalizeTaskId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }

  return null;
}

function normalizePriority(value: unknown) {
  const normalized = normalizePlainText(value);

  if (!normalized) {
    return null;
  }

  if (normalized === "low") return "Low";
  if (normalized === "medium") return "Medium";
  if (normalized === "high") return "High";

  return null;
}

function normalizeStatus(value: unknown) {
  const normalized = normalizePlainText(value).replace(/[_-]+/g, " ");

  if (!normalized) {
    return null;
  }

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

function areSameLooseTextValue(a: unknown, b: unknown) {
  const normalizedA = normalizeComparableText(a);
  const normalizedB = normalizeComparableText(b);

  if (!normalizedA || !normalizedB) {
    return false;
  }

  return normalizedA === normalizedB;
}

function areSameMoneyishValue(a: unknown, b: unknown) {
  const normalizedA = normalizeMoneyishText(a);
  const normalizedB = normalizeMoneyishText(b);

  if (!normalizedA || !normalizedB) {
    return false;
  }

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
    .replace(/\bby\s+/g, "")
    .replace(/\bdue\s+/g, "")
    .replace(/\bdeadline\s+/g, "")
    .replace(/\bthe\s+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMoneyishText(value: unknown) {
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