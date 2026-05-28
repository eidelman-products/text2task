import { z } from "zod";

import { openai } from "@/lib/openai";
import { createProjectUpdateAuditItems, createProjectUpdateAuditRecord, createProjectTimelineEvent } from "@/lib/project-updates/project-update-audit.server";
import { loadProjectUpdateContext } from "@/lib/project-updates/project-update-context.server";
import { postProcessProjectUpdateItems } from "@/lib/project-updates/project-update-post-process.server";

import type {
  JsonRecord,
  ProjectTimelineEvent,
  ProjectUpdate,
  ProjectUpdateItem,
  ProjectUpdateItemType,
  ProjectUpdateSourceType,
} from "@/lib/project-updates/project-update-types";

const PROJECT_UPDATE_MODEL = "gpt-4.1-mini";

const ProjectUpdateItemTypeSchema = z.enum([
  "new_subtask",
  "update_subtask",
  "deadline_change",
  "budget_change",
  "priority_change",
  "status_change",
  "client_detail_change",
  "project_note",
  "client_note",
  "duplicate_warning",
  "no_action",
]);

const JsonRecordSchema = z.record(z.string(), z.unknown());

const JsonPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const JsonValueSchema = z.union([
  JsonRecordSchema,
  JsonPrimitiveSchema,
]);

const SuggestedPrioritySchema = z.enum(["Low", "Medium", "High"]);

const SuggestedStatusSchema = z.enum([
  "New",
  "In Progress",
  "Review",
  "Urgent",
  "Done",
]);

const OptionalStringValueSchema = z.string().min(1).optional();

const NewSubtaskValueSchema = z.object({
  task_title: z.string().min(1),
  deadline_text: OptionalStringValueSchema,
  amount: OptionalStringValueSchema,
  priority: SuggestedPrioritySchema.optional(),
  status: SuggestedStatusSchema.optional(),
});

const UpdateSubtaskValueSchema = z
  .object({
    task_title: OptionalStringValueSchema,
    deadline_text: OptionalStringValueSchema,
    amount: OptionalStringValueSchema,
    priority: SuggestedPrioritySchema.optional(),
    status: SuggestedStatusSchema.optional(),
    notes: OptionalStringValueSchema,
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "update_subtask newValue must include at least one changed field.",
  });

const DeadlineChangeValueSchema = z.object({
  deadline_text: z.string().min(1),
  deadline_date: z.string().min(1).nullable().optional(),
});

const BudgetChangeValueSchema = z.object({
  amount: z.string().min(1),
  amount_value: z.number().nullable().optional(),
  currency_code: z.string().min(1).nullable().optional(),
});

const PriorityChangeValueSchema = z.object({
  priority: SuggestedPrioritySchema,
});

const StatusChangeValueSchema = z.object({
  status: SuggestedStatusSchema,
});

const ClientDetailChangeValueSchema = z
  .object({
    client_name: OptionalStringValueSchema,
    contact_name: OptionalStringValueSchema,
    phone: OptionalStringValueSchema,
    email: OptionalStringValueSchema,
    notes: OptionalStringValueSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "client_detail_change newValue must include at least one client field.",
  });

const NoteValueSchema = z.object({
  note: z.string().min(1),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function getStringFromRecord(record: JsonRecord | undefined, keys: string[]) {
  if (!record) return null;

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

function normalizePriority(value: unknown): unknown {
  const text = getNonEmptyString(value);

  if (!text) {
    return value;
  }

  const normalized = text.toLowerCase();

  if (normalized === "low") return "Low";
  if (normalized === "medium") return "Medium";
  if (normalized === "high") return "High";

  return value;
}

function normalizeStatus(value: unknown): unknown {
  const text = getNonEmptyString(value);

  if (!text) {
    return value;
  }

  const normalized = text.toLowerCase().replace(/[_-]+/g, " ");

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

  return value;
}

function normalizeObjectValue(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return { ...value };
  }

  return {};
}

function hasSupportedSubtaskUpdateField(value: Record<string, unknown>): boolean {
  const supportedKeys = [
    "task_title",
    "title",
    "name",
    "deadline_text",
    "deadline",
    "deadline_date",
    "amount",
    "amount_value",
    "currency_code",
    "budget",
    "price",
    "cost",
    "priority",
    "status",
    "notes",
    "note",
  ];

  return supportedKeys.some((key) => {
    const field = value[key];

    if (typeof field === "string") {
      return field.trim().length > 0;
    }

    if (typeof field === "number") {
      return Number.isFinite(field);
    }

    return field !== null && field !== undefined;
  });
}

function hasTargetTaskId(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return /^\d+$/.test(value.trim());
  }

  return false;
}

function containsAdditionCue(value: string): boolean {
  return /\b(add|create|include|build|make|design|prepare|new)\b|\balso add\b|\bplease add\b/.test(
    value.toLowerCase()
  );
}

function containsTargetlessDeliverableCue(value: string): boolean {
  const normalized = value.toLowerCase();

  return (
    containsAdditionCue(normalized) ||
    /\bupdate\s+(?:the\s+)?[\w\s-]+?\s+(?:with|using|to include|for)\s+(?:our\s+|the\s+)?(?:new|updated|additional|more)\b/.test(
      normalized
    )
  );
}

function looksLikeNewDeliverableAddition(input: {
  item: Record<string, unknown>;
  rawInput?: string;
}): boolean {
  const { item, rawInput } = input;
  const searchableText = [
    item.title,
    item.description,
    item.aiReason,
    isRecord(item.newValue) ? item.newValue.task_title : null,
    isRecord(item.newValue) ? item.newValue.title : null,
    rawInput,
  ]
    .map((value) => getNonEmptyString(value))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!searchableText) {
    return false;
  }

  return containsTargetlessDeliverableCue(searchableText);
}

function shouldNormalizeTargetlessUpdateSubtask(input: {
  item: Record<string, unknown>;
  newValue: Record<string, unknown>;
  rawInput?: string;
}) {
  const { item, newValue, rawInput } = input;

  if (
    hasTargetTaskId(item.targetTaskId) ||
    hasTargetTaskId(item.target_task_id) ||
    hasSupportedSubtaskUpdateField(newValue)
  ) {
    return false;
  }

  const title = getNonEmptyString(item.title);
  const directText = [title, rawInput]
    .map((value) => getNonEmptyString(value))
    .filter(Boolean)
    .join(" ");

  if (!directText) {
    return false;
  }

  return containsTargetlessDeliverableCue(directText);
}

function getAiItemType(item: Record<string, unknown>) {
  return getNonEmptyString(item.type) || getNonEmptyString(item.itemType);
}

function getAiItemTitle(item: Record<string, unknown>) {
  return (
    getNonEmptyString(item.title) ||
    getNonEmptyString(item.itemTitle) ||
    getNonEmptyString(item.name)
  );
}

function getAiItemNewValue(item: Record<string, unknown>) {
  return normalizeObjectValue(item.newValue ?? item.new_value);
}

function getAiItemTargetTaskId(item: Record<string, unknown>) {
  return item.targetTaskId ?? item.target_task_id ?? item.taskId ?? null;
}

function normalizeTargetlessUpdateSubtaskToNewSubtask(input: {
  item: Record<string, unknown>;
  rawInput?: string;
}) {
  const { item, rawInput } = input;
  const title = getNonEmptyString(item.title);
  const taskTitle =
    title ||
    cleanNewSubtaskTitle({ item, rawInput }) ||
    "New client-requested deliverable";

  if (process.env.NODE_ENV !== "production") {
    console.warn("Normalized targetless update_subtask to new_subtask", {
      itemType: item.type,
      itemTitle: item.title,
      normalizedType: "new_subtask",
      reason: "targetless update_subtask with unsupported newValue and deliverable cue",
    });
  }

  return {
    ...item,
    type: "new_subtask",
    targetTaskId: null,
    targetField: item.targetField ?? "task_title",
    title: taskTitle,
    newValue: {
      task_title: taskTitle,
      status: "New",
      priority: "Medium",
    },
  };
}

function repairAiItemBeforeValidation(input: {
  item: Record<string, unknown>;
  itemIndex: number;
  rawInput?: string;
}) {
  const { item, itemIndex, rawInput } = input;

  if (item.type !== "update_subtask") {
    return item;
  }

  const newValue = normalizeObjectValue(item.newValue);
  const isTargetless =
    !hasTargetTaskId(item.targetTaskId) && !hasTargetTaskId(item.target_task_id);
  const hasSupportedValue = hasSupportedSubtaskUpdateField(newValue);

  if (isTargetless && !hasSupportedValue && process.env.NODE_ENV !== "production") {
    console.warn("Pre-validation update_subtask repair candidate", {
      itemIndex,
      title: item.title,
      newValueKeys: Object.keys(newValue),
      rawInputSnippet: getNonEmptyString(rawInput)?.slice(0, 180) ?? null,
    });
  }

  if (
    isTargetless &&
    !hasSupportedValue &&
    looksLikeNewDeliverableAddition({
      item: {
        ...item,
        newValue,
      },
      rawInput,
    })
  ) {
    return normalizeTargetlessUpdateSubtaskToNewSubtask({ item, rawInput });
  }

  return item;
}

function repairAnalysisOutputBeforeValidation(input: {
  value: unknown;
  rawInput?: string;
}): unknown {
  const { value, rawInput } = input;

  if (!isRecord(value) || !Array.isArray(value.items)) {
    return value;
  }

  return {
    ...value,
    items: value.items.map((rawItem, itemIndex) => {
      if (!isRecord(rawItem)) {
        return rawItem;
      }

      const item = {
        ...rawItem,
        type: getAiItemType(rawItem) || rawItem.type,
        title: getAiItemTitle(rawItem) || rawItem.title,
        targetTaskId: getAiItemTargetTaskId(rawItem),
        newValue: rawItem.newValue ?? rawItem.new_value,
      };
      const itemType = getAiItemType(item);

      if (itemType !== "update_subtask") {
        return item;
      }

      const newValue = getAiItemNewValue(item);
      const isTargetless = !hasTargetTaskId(getAiItemTargetTaskId(item));
      const hasSupportedValue = hasSupportedSubtaskUpdateField(newValue);
      const looksLikeDeliverable = looksLikeNewDeliverableAddition({
        item: {
          ...item,
          newValue,
        },
        rawInput,
      });

      if (isTargetless && !hasSupportedValue && process.env.NODE_ENV !== "production") {
        console.warn("Pre-validation update_subtask repair candidate", {
          itemIndex,
          itemType,
          title: getAiItemTitle(item),
          targetTaskId: getAiItemTargetTaskId(item),
          newValue,
          newValueKeys: Object.keys(newValue),
          hasSupportedUpdateSubtaskFields: hasSupportedValue,
          looksLikeDeliverableOrStandaloneWork: looksLikeDeliverable,
          rawInputSnippet: getNonEmptyString(rawInput)?.slice(0, 180) ?? null,
        });
      }

      if (isTargetless && !hasSupportedValue && looksLikeDeliverable) {
        const repaired = normalizeTargetlessUpdateSubtaskToNewSubtask({
          item: {
            ...item,
            newValue,
          },
          rawInput,
        });

        if (process.env.NODE_ENV !== "production") {
          console.warn("Pre-validation update_subtask repair converted item", {
            itemIndex,
            previousType: itemType,
            title: repaired.title,
            normalizedType: repaired.type,
          });
        }

        return repaired;
      }

      return {
        ...item,
        newValue,
      };
    }),
  };
}

function extractDeliverableTitleFromRawInput(rawInput?: string): string | null {
  const text = getNonEmptyString(rawInput);

  if (!text) {
    return null;
  }

  const match = text.match(
    /\b(?:please\s+)?(?:also\s+)?(?:add|create|include|build|make|design|prepare)\s+(?:an?\s+|the\s+)?(.+?)(?=\.|,|\band\s+(?:move|change|update|set|shift|extend|push)\b|$)/i
  );

  if (!match?.[1]) {
    return null;
  }

  const deliverable = match[1]
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^an?\s+/i, "")
    .replace(/^the\s+/i, "");

  if (!deliverable) {
    return null;
  }

  return `Add ${deliverable}`;
}

function extractAddedDeliverableTitle(rawInput?: string): string | null {
  return extractDeliverableTitleFromRawInput(rawInput);
}

function cleanNewSubtaskTitle(input: {
  item: Record<string, unknown>;
  rawInput?: string;
}): string | null {
  const { item, rawInput } = input;
  const rawItemTitle =
    getNonEmptyString(isRecord(item.newValue) ? item.newValue.task_title : null) ||
    getNonEmptyString(isRecord(item.newValue) ? item.newValue.title : null) ||
    getNonEmptyString(item.title) ||
    getNonEmptyString(item.description);

  if (rawItemTitle && !/^update\s+status\s+of\s+/i.test(rawItemTitle)) {
    return rawItemTitle
      .replace(/^add\s+new\s+subtask\s+for\s+/i, "Add ")
      .replace(/\s+subtask$/i, "")
      .trim();
  }

  const rawInputTitle = extractAddedDeliverableTitle(rawInput);
  if (rawInputTitle) {
    return rawInputTitle;
  }

  if (!rawItemTitle) {
    return null;
  }

  return rawItemTitle
    .replace(/^update\s+status\s+of\s+/i, "")
    .replace(/\s+subtask$/i, "")
    .replace(/^add\s+new\s+subtask\s+for\s+/i, "Add ")
    .replace(/^faq\s+section$/i, "Add FAQ section")
    .trim();
}

function getFallbackItemTitle(input: {
  item: Record<string, unknown>;
  rawInput?: string;
}): string {
  const { item, rawInput } = input;
  const newValue = normalizeObjectValue(item.newValue);

  switch (item.type) {
    case "new_subtask":
      return (
        getNonEmptyString(newValue.task_title) ||
        cleanNewSubtaskTitle({ item, rawInput }) ||
        getNonEmptyString(item.description) ||
        getNonEmptyString(item.aiReason) ||
        "Add new subtask"
      );

    case "update_subtask": {
      const targetField = getNonEmptyString(item.targetField);
      return targetField ? `Update subtask ${targetField}` : "Update subtask";
    }

    case "deadline_change": {
      const deadlineText = getNonEmptyString(newValue.deadline_text);
      return deadlineText
        ? `Update project deadline to ${deadlineText}`
        : "Update project deadline";
    }

    case "budget_change": {
      const amount = getNonEmptyString(newValue.amount);
      return amount ? `Update project budget to ${amount}` : "Update project budget";
    }

    case "priority_change": {
      const priority = getNonEmptyString(newValue.priority);
      return priority
        ? `Update project priority to ${priority}`
        : "Update project priority";
    }

    case "status_change": {
      const status = getNonEmptyString(newValue.status);
      return status ? `Update project status to ${status}` : "Update project status";
    }

    case "client_detail_change":
      return "Update client details";

    case "project_note":
      return "Add project note";

    case "client_note":
      return "Add client note";

    case "duplicate_warning":
      return "Possible duplicate update";

    case "no_action":
      return "No actionable update";

    default:
      return "Suggested project update";
  }
}

function normalizeMissingItemTitle(input: {
  item: Record<string, unknown>;
  rawInput?: string;
}): Record<string, unknown> {
  const existingTitle = getNonEmptyString(input.item.title);

  if (existingTitle) {
    return {
      ...input.item,
      title: existingTitle,
    };
  }

  const fallbackTitle = getFallbackItemTitle(input);

  console.warn("Normalized missing project update item title", {
    itemType: input.item.type,
    normalizedTitle: fallbackTitle,
  });

  return {
    ...input.item,
    title: fallbackTitle,
  };
}

function normalizeAiItemValue(input: {
  item: Record<string, unknown>;
  rawInput?: string;
}): Record<string, unknown> {
  const { item, rawInput } = input;
  const type = item.type;
  const title = getNonEmptyString(item.title);
  const rawNewValue = item.newValue;

  if (type === "new_subtask") {
    const nextValue = normalizeObjectValue(rawNewValue);
    const taskTitle =
      getNonEmptyString(nextValue.task_title) ||
      getNonEmptyString(nextValue.title) ||
      title;

    if (taskTitle) {
      nextValue.task_title = taskTitle;
    }

    if (nextValue.priority !== undefined) {
      nextValue.priority = normalizePriority(nextValue.priority);
    }

    if (nextValue.status !== undefined) {
      nextValue.status = normalizeStatus(nextValue.status);
    }

    if (!getNonEmptyString(nextValue.status)) {
      nextValue.status = "New";
    }

    return {
      ...item,
      newValue: nextValue,
    };
  }

  if (type === "update_subtask") {
    const nextValue = normalizeObjectValue(rawNewValue);

    if (
      shouldNormalizeTargetlessUpdateSubtask({
        item,
        newValue: nextValue,
        rawInput,
      })
    ) {
      const taskTitle = title || cleanNewSubtaskTitle({ item, rawInput }) || "New client-requested deliverable";

      console.warn("Normalized targetless update_subtask to new_subtask", {
        itemType: item.type,
        itemTitle: item.title,
        normalizedType: "new_subtask",
        reason: "targetless update_subtask with unsupported newValue and deliverable cue",
      });

      return {
        ...item,
        type: "new_subtask",
        targetTaskId: null,
        targetField: item.targetField ?? "task_title",
        title: taskTitle,
        newValue: {
          task_title: taskTitle,
          status: "New",
          priority: "Medium",
        },
      };
    }

    if (!getNonEmptyString(nextValue.task_title)) {
      const nextTitle = getNonEmptyString(nextValue.title);
      if (nextTitle) {
        nextValue.task_title = nextTitle;
      }
    }

    if (nextValue.priority !== undefined) {
      nextValue.priority = normalizePriority(nextValue.priority);
    }

    if (nextValue.status !== undefined) {
      nextValue.status = normalizeStatus(nextValue.status);
    }

    if (
      !hasTargetTaskId(item.targetTaskId) &&
      !hasSupportedSubtaskUpdateField(nextValue) &&
      looksLikeNewDeliverableAddition({
        item: {
          ...item,
          newValue: nextValue,
        },
        rawInput,
      })
    ) {
      const taskTitle = cleanNewSubtaskTitle({
        item: {
          ...item,
          newValue: nextValue,
        },
        rawInput,
      });

      const usedRawInputCue =
        Boolean(rawInput && containsTargetlessDeliverableCue(rawInput)) &&
        !looksLikeNewDeliverableAddition({
          item: {
            ...item,
            newValue: nextValue,
          },
        });

      console.warn(
        usedRawInputCue
          ? "Normalized targetless update_subtask to new_subtask using rawInput addition cue"
          : "Normalized targetless update_subtask to new_subtask",
        {
        itemType: item.type,
        itemTitle: item.title,
        normalizedType: "new_subtask",
          reason: usedRawInputCue
            ? "targetless update_subtask with empty newValue and rawInput addition cue"
            : "targetless update_subtask with empty newValue and addition cue",
        }
      );

      return {
        ...item,
        type: "new_subtask",
        targetTaskId: null,
        targetField: item.targetField ?? "task_title",
        title: taskTitle || title || "New client-requested deliverable",
        newValue: {
          task_title: taskTitle || title || "New client-requested deliverable",
          status: "New",
          priority: "Medium",
        },
      };
    }

    return {
      ...item,
      newValue: nextValue,
    };
  }

  if (type === "deadline_change") {
    if (typeof rawNewValue === "string" || typeof rawNewValue === "number") {
      return {
        ...item,
        newValue: {
          deadline_text: String(rawNewValue).trim(),
        },
      };
    }

    const nextValue = normalizeObjectValue(rawNewValue);
    const deadlineText =
      getNonEmptyString(nextValue.deadline_text) ||
      getNonEmptyString(nextValue.deadline);

    if (deadlineText) {
      nextValue.deadline_text = deadlineText;
    }

    return {
      ...item,
      newValue: nextValue,
    };
  }

  if (type === "budget_change") {
    if (typeof rawNewValue === "string" || typeof rawNewValue === "number") {
      return {
        ...item,
        newValue: {
          amount: String(rawNewValue).trim(),
        },
      };
    }

    const nextValue = normalizeObjectValue(rawNewValue);
    const amount =
      getNonEmptyString(nextValue.amount) ||
      getNonEmptyString(nextValue.budget) ||
      getNonEmptyString(nextValue.price) ||
      getNonEmptyString(nextValue.cost);

    if (amount) {
      nextValue.amount = amount;
    }

    return {
      ...item,
      newValue: nextValue,
    };
  }

  if (type === "priority_change") {
    const nextValue = normalizeObjectValue(rawNewValue);
    nextValue.priority = normalizePriority(nextValue.priority);

    return {
      ...item,
      newValue: nextValue,
    };
  }

  if (type === "status_change") {
    const nextValue = normalizeObjectValue(rawNewValue);
    nextValue.status = normalizeStatus(nextValue.status);

    return {
      ...item,
      newValue: nextValue,
    };
  }

  if (type === "project_note" || type === "client_note") {
    if (typeof rawNewValue === "string" || typeof rawNewValue === "number") {
      return {
        ...item,
        newValue: {
          note: String(rawNewValue).trim(),
        },
      };
    }

    const nextValue = normalizeObjectValue(rawNewValue);
    const note =
      getNonEmptyString(nextValue.note) ||
      getNonEmptyString(nextValue.notes) ||
      getNonEmptyString(nextValue.value);

    if (note) {
      nextValue.note = note;
    }

    return {
      ...item,
      newValue: nextValue,
    };
  }

  return item;
}

function normalizeAiAnalysisOutput(input: {
  value: unknown;
  rawInput?: string;
}): unknown {
  const { value, rawInput } = input;

  if (!isRecord(value)) {
    return value;
  }

  if (!Array.isArray(value.items)) {
    return value;
  }

  return {
    ...value,
    items: value.items.map((item, itemIndex) => {
      if (!isRecord(item)) {
        return item;
      }

      const normalizedValue = normalizeAiItemValue({ item, rawInput });
      const normalizedItem = normalizeMissingItemTitle({
        item: normalizedValue,
        rawInput,
      });

      return repairAiItemBeforeValidation({
        item: normalizedItem,
        itemIndex,
        rawInput,
      });
    }),
  };
}

function logProjectUpdateValidationFailure(input: {
  error: z.ZodError;
  parsedJson: unknown;
}) {
  const items = isRecord(input.parsedJson) && Array.isArray(input.parsedJson.items)
    ? input.parsedJson.items
    : [];
  const itemIssues = input.error.issues.filter((issue) => issue.path[0] === "items");

  itemIssues.forEach((issue) => {
    const itemIndex =
      typeof issue.path[1] === "number" ? issue.path[1] : "unknown";
    const item = typeof itemIndex === "number" ? items[itemIndex] : null;
    const itemRecord = isRecord(item) ? item : {};

    console.warn("Project update analysis validation failed", {
      itemIndex,
      itemType: itemRecord.type,
      itemTitle: itemRecord.title,
      path: issue.path.join("."),
      message: issue.message,
    });
  });
}

const TargetTaskIdSchema = z
  .union([
    z.number().int().nonnegative(),
    z
      .string()
      .regex(/^\d+$/)
      .transform((value) => Number(value)),
  ])
  .nullable()
  .optional();

const AiSuggestedUpdateItemSchema = z.object({
  type: ProjectUpdateItemTypeSchema,
  title: z.string().min(1).max(240),
  description: z.string().max(1000).nullable().optional(),

  targetTaskId: TargetTaskIdSchema,
  targetField: z.string().max(120).nullable().optional(),

  oldValue: JsonValueSchema.optional(),
  newValue: JsonValueSchema.optional(),

  confidence: z.number().min(0).max(1).nullable().optional(),
  aiReason: z.string().max(1200).nullable().optional(),
}).superRefine((item, ctx) => {
  const validateNewValue = (
    schema: z.ZodTypeAny,
    message: string
  ) => {
    const result = schema.safeParse(item.newValue);

    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newValue"],
        message,
      });
    }
  };

  switch (item.type) {
    case "new_subtask":
      validateNewValue(
        NewSubtaskValueSchema,
        "new_subtask newValue must include task_title, priority, and status."
      );
      break;

    case "update_subtask":
      validateNewValue(
        UpdateSubtaskValueSchema,
        "update_subtask newValue must include at least one supported subtask field."
      );
      break;

    case "deadline_change":
      validateNewValue(
        DeadlineChangeValueSchema,
        "deadline_change newValue must include deadline_text."
      );
      break;

    case "budget_change":
      validateNewValue(
        BudgetChangeValueSchema,
        "budget_change newValue must include amount."
      );
      break;

    case "priority_change":
      validateNewValue(
        PriorityChangeValueSchema,
        "priority_change newValue must include priority."
      );
      break;

    case "status_change":
      validateNewValue(
        StatusChangeValueSchema,
        "status_change newValue must include status."
      );
      break;

    case "client_detail_change":
      validateNewValue(
        ClientDetailChangeValueSchema,
        "client_detail_change newValue must include at least one client field."
      );
      break;

    case "project_note":
    case "client_note":
      validateNewValue(
        NoteValueSchema,
        `${item.type} newValue must include note.`
      );
      break;

    case "duplicate_warning":
    case "no_action":
      break;
  }
});

const AiProjectUpdateSummarySchema = z.object({
  headline: z.string().min(1).max(240),
  reasoning: z.string().max(1600).nullable().optional(),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
  detectedChanges: z.array(z.string().max(240)).default([]),
});

const AiProjectUpdateAnalysisSchema = z.object({
  summary: AiProjectUpdateSummarySchema,
  items: z.array(AiSuggestedUpdateItemSchema).min(1),
});

type AiSuggestedUpdateItem = z.infer<typeof AiSuggestedUpdateItemSchema>;
type AiProjectUpdateAnalysis = z.infer<typeof AiProjectUpdateAnalysisSchema>;

function recoverAiAnalysisFromInvalidItems(value: unknown): AiProjectUpdateAnalysis | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }

  const summaryResult = AiProjectUpdateSummarySchema.safeParse(value.summary);

  if (!summaryResult.success) {
    return null;
  }

  const items: AiSuggestedUpdateItem[] = [];

  value.items.forEach((item, itemIndex) => {
    const itemResult = AiSuggestedUpdateItemSchema.safeParse(item);

    if (itemResult.success) {
      items.push(itemResult.data);
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      const itemRecord = isRecord(item) ? item : {};
      console.warn("Recovered project update analysis by skipping invalid item", {
        itemIndex,
        itemType: itemRecord.type,
        itemTitle: itemRecord.title,
        issues: itemResult.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    items.push({
      type: "no_action",
      title: "Skipped unclear suggestion",
      description:
        "Text2Task skipped one unclear suggestion from the model instead of failing the whole analysis.",
      targetTaskId: null,
      targetField: null,
      oldValue: null,
      newValue: null,
      confidence: null,
      aiReason:
        "The model returned an unsupported item shape, so Text2Task ignored that item.",
    });
  });

  return {
    summary: summaryResult.data,
    items:
      items.length > 0
        ? items
        : [
            {
              type: "no_action",
              title: "No actionable update",
              description: "Text2Task did not find a supported change to add.",
              targetTaskId: null,
              targetField: null,
              oldValue: null,
              newValue: null,
              confidence: null,
              aiReason: "No valid update items were returned.",
            },
          ],
  };
}

export type AnalyzeProjectUpdateResponse =
  | {
      ok: true;
      update: ProjectUpdate;
      items: ProjectUpdateItem[];
      timelineEvent: ProjectTimelineEvent | null;
      analysis: AiProjectUpdateAnalysis["summary"];
    }
  | {
      ok: false;
      error: string;
      details?: unknown;
    };

export type AnalyzeProjectUpdateServiceInput = {
  projectId: string;
  rawInput: string;
  sourceType?: ProjectUpdateSourceType;
};

export type AnalyzeProjectUpdateServiceResult = {
  status: number;
  response: AnalyzeProjectUpdateResponse;
};

function parseJsonFromModelOutput(rawText: string): unknown {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error("The model returned an empty response.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to fallback parsing below.
  }

  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    // Continue to object extraction below.
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("The model response did not contain a JSON object.");
  }

  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}

function toJsonRecord(value: unknown): JsonRecord | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return { value };
  }

  return null;
}

function buildProjectUpdateSystemPrompt(): string {
  return [
    "You are Text2Task's Project Update Engine.",
    "Your job is to analyze a new client follow-up message against one EXISTING project.",
    "The existing project stays the container for every suggested change.",
    "Never suggest creating a new project.",
    "Never split one follow-up into random separate projects.",
    "Return a Suggested Update Plan only.",
    "Only suggest updates that are clearly supported by the new client message and the existing project context.",
    "Return JSON only. Do not include markdown, explanations outside JSON, or code fences.",
    "",
    "Important route limitation:",
    '- sourceType may be "image" as metadata, but this route currently analyzes rawInput text only.',
    "- Do not perform image processing or claim to inspect an uploaded image in this route.",
    "",
    "Valid item types:",
    "- new_subtask",
    "- update_subtask",
    "- deadline_change",
    "- budget_change",
    "- priority_change",
    "- status_change",
    "- client_detail_change",
    "- project_note",
    "- client_note",
    "- duplicate_warning",
    "- no_action",
    "",
    "Core product rules inherited from Extract:",
    "1. ONE CLIENT FOLLOW-UP FOR THIS PROJECT = UPDATE THIS PROJECT.",
    "2. DELIVERABLES / BULLETS / REQUESTED ITEMS INSIDE THE FOLLOW-UP = suggested subtask update items.",
    "3. Do not create separate projects from one client follow-up.",
    "4. Do not divide a project-level budget across subtasks unless the client clearly gives per-deliverable pricing.",
    "5. Keep client/contact details separate from deliverables.",
    "6. Use notes only for context; do not turn greetings, thanks, or vague comments into tasks.",
    "",
    "Suggested Update Plan rules:",
    "1. If the client asks for additional deliverables, use new_subtask.",
    '2. If the client says "also add X", "please add X", or "add X to Y", use new_subtask unless X clearly already exists in the provided subtasks.',
    "3. If the client says add, create, include, build, make, design, prepare, or asks for a deliverable that is not clearly an existing subtask, use new_subtask.",
    "4. Do not use update_subtask for add/create/include requests unless targetTaskId is provided and the message clearly modifies that existing subtask.",
    "5. Do not use update_subtask unless the message clearly modifies an existing subtask from the provided project context.",
    "6. update_subtask should usually include targetTaskId when the existing subtask is identifiable.",
    "7. If targetTaskId would be null and the item is an addition/new deliverable, prefer new_subtask.",
    '7a. Targetless requests like "update X with new copy", "update X with new locations", or "add a new section" should be new_subtask unless X is clearly an existing subtask and targetTaskId is provided.',
    '7b. If the request says update/add/create a section but there is no exact existing subtask match, classify it as new_subtask.',
    "8. Bullet lists should usually become separate useful new_subtask items.",
    "9. Multiple clear deliverables should not be collapsed into one vague item.",
    "10. Admin/contact/record update work can become new_subtask when it is work to perform, or client_detail_change when it changes the client record.",
    "11. If the client changes an existing deliverable, use update_subtask.",
    "12. Include targetTaskId when the existing subtask can be identified from project context.",
    "13. If unsure which existing subtask is meant, targetTaskId may be null and aiReason must explain the uncertainty.",
    "13a. Only use update_subtask when targetTaskId is known or the existing subtask is clearly matched and newValue contains supported changed fields.",
    "13b. Never return update_subtask with empty, null, primitive, or unsupported newValue.",
    "14. Repeated or already-existing work should become duplicate_warning or no_action when appropriate.",
    "15. If the message contains no actionable change, return one no_action item.",
    "16. Do not invent budgets, dates, phone numbers, emails, client names, or tasks.",
    "17. Keep titles short, professional, and user-friendly.",
    "",
    "Project-level vs subtask-level changes:",
    "1. deadline_change, budget_change, priority_change, and status_change are PROJECT-LEVEL changes.",
    "2. For project-level changes, targetTaskId must be null.",
    "3. If deadline, amount, status, or priority belongs to a specific existing subtask, use update_subtask with targetTaskId and targetField.",
    "4. Do not use project-level deadline_change for a subtask-specific deadline.",
    "5. Do not use project-level budget_change for a subtask-specific price.",
    "",
    "Notes distinction:",
    "1. client_note is a timeline/audit note only. It does not update the client record.",
    "2. client_detail_change with notes updates the actual client notes field.",
    "3. Use client_detail_change when the client record should change.",
    "4. Use client_note when the message should only be recorded as history/context.",
    "",
    "Value rules:",
    "1. Always include oldValue and newValue when a value is changed.",
    "2. Use oldValue from the existing project context when it is available.",
    "3. For duplicate_warning and no_action, oldValue and newValue may be null.",
    "4. Use only these priorities: Low, Medium, High.",
    "5. Use only these statuses: New, In Progress, Review, Urgent, Done.",
    "6. Every item must include a short human-readable title string. Never return null, empty, or missing title.",
    "",
    "Expected newValue shapes by item type:",
    "",
    "new_subtask:",
    "{",
    '  "task_title": "string",',
    '  "deadline_text": "optional string",',
    '  "amount": "optional string",',
    '  "priority": "Low | Medium | High",',
    '  "status": "New | In Progress | Review | Urgent | Done"',
    "}",
    "",
    "update_subtask:",
    "{",
    '  "task_title": "optional string",',
    '  "deadline_text": "optional string",',
    '  "amount": "optional string",',
    '  "priority": "optional Low | Medium | High",',
    '  "status": "optional New | In Progress | Review | Urgent | Done",',
    '  "notes": "optional string"',
    "}",
    "",
    "deadline_change:",
    "{",
    '  "deadline_text": "string",',
    '  "deadline_date": "optional ISO date string or null"',
    "}",
    "",
    "budget_change:",
    "{",
    '  "amount": "string",',
    '  "amount_value": "optional number or null",',
    '  "currency_code": "optional string or null"',
    "}",
    "",
    "priority_change:",
    "{",
    '  "priority": "Low | Medium | High"',
    "}",
    "",
    "status_change:",
    "{",
    '  "status": "New | In Progress | Review | Urgent | Done"',
    "}",
    "",
    "client_detail_change:",
    "{",
    '  "client_name": "optional string",',
    '  "contact_name": "optional string",',
    '  "phone": "optional string",',
    '  "email": "optional string",',
    '  "notes": "optional string"',
    "}",
    "",
    "project_note:",
    "{",
    '  "note": "string"',
    "}",
    "",
    "client_note:",
    "{",
    '  "note": "string"',
    "}",
    "",
    "Required JSON shape:",
    "{",
    '  "summary": {',
    '    "headline": "Short summary",',
    '    "reasoning": "Why these updates were suggested",',
    '    "riskLevel": "low",',
    '    "detectedChanges": ["change 1", "change 2"]',
    "  },",
    '  "items": [',
    "    {",
    '      "type": "new_subtask",',
    '      "title": "Create additional landing page section",',
    '      "description": "Client requested an additional section after the original scope.",',
    '      "targetTaskId": null,',
    '      "targetField": "task_title",',
    '      "oldValue": null,',
    '      "newValue": {',
    '        "task_title": "Create additional landing page section",',
    '        "priority": "Medium",',
    '        "status": "New"',
    "      },",
    '      "confidence": 0.92,',
    '      "aiReason": "The new message clearly asks for an additional deliverable."',
    "    }",
    "  ]",
    "}",
  ].join("\n");
}

function buildProjectUpdateUserPrompt(input: {
  context: unknown;
  rawInput: string;
}): string {
  return [
    "Existing project context:",
    JSON.stringify(input.context, null, 2),
    "",
    "New client follow-up message:",
    input.rawInput,
    "",
    "Analyze the new message only in relation to the existing project context.",
    "Do not create or suggest a new project.",
    "Compare the follow-up to the existing project and subtasks, then return only suggested update items.",
    "If sourceType was image upstream, treat rawInput as the text available to this route; do not infer unseen image content.",
    "Return the Suggested Update Plan as strict JSON.",
  ].join("\n");
}

function mapAiItemToAuditItem(input: {
  aiItem: AiSuggestedUpdateItem;
  projectUpdateId: string;
  projectId: string;
}) {
  return {
    projectUpdateId: input.projectUpdateId,
    projectId: input.projectId,
    targetTaskId: input.aiItem.targetTaskId ?? null,

    type: input.aiItem.type as ProjectUpdateItemType,
    title: input.aiItem.title,
    description: input.aiItem.description ?? null,

    targetField: input.aiItem.targetField ?? null,
    oldValue: toJsonRecord(input.aiItem.oldValue),
    newValue: toJsonRecord(input.aiItem.newValue),

    confidence: input.aiItem.confidence ?? null,
    status: "suggested" as const,

    aiReason: input.aiItem.aiReason ?? null,
    userNote: null,
  };
}

export async function analyzeProjectUpdate(
  input: AnalyzeProjectUpdateServiceInput
): Promise<AnalyzeProjectUpdateServiceResult> {
  const { projectId, rawInput, sourceType = "text" } = input;
  const contextResult = await loadProjectUpdateContext(projectId);

  if (!contextResult.ok) {
    return {
      status: contextResult.status,
      response: {
        ok: false,
        error: contextResult.error,
      },
    };
  }

  let aiParsed: AiProjectUpdateAnalysis | null = null;

  try {
    const completion = await openai.chat.completions.create({
      model: PROJECT_UPDATE_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildProjectUpdateSystemPrompt(),
        },
        {
          role: "user",
          content: buildProjectUpdateUserPrompt({
            context: contextResult.context,
            rawInput,
          }),
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content ?? "";
    const parsedJson = parseJsonFromModelOutput(rawContent);
    const normalizedJson = normalizeAiAnalysisOutput({
      value: parsedJson,
      rawInput,
    });
    const repairedJson = repairAnalysisOutputBeforeValidation({
      value: normalizedJson,
      rawInput,
    });
    const safeResult = AiProjectUpdateAnalysisSchema.safeParse(repairedJson);

    if (!safeResult.success) {
      logProjectUpdateValidationFailure({
        error: safeResult.error,
        parsedJson: repairedJson,
      });

      const recoveredResult = recoverAiAnalysisFromInvalidItems(repairedJson);

      if (recoveredResult) {
        aiParsed = recoveredResult;
      } else {
        return {
          status: 502,
          response: {
            ok: false,
            error: "Model returned invalid project update structure.",
            details: safeResult.error.flatten(),
          },
        };
      }
    } else {
      aiParsed = safeResult.data;
    }

    if (!aiParsed) {
      return {
        status: 502,
        response: {
          ok: false,
          error: "Model returned empty project update analysis.",
        },
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI error.";

    return {
      status: 502,
      response: {
        ok: false,
        error: `Could not analyze project update: ${message}`,
      },
    };
  }

  aiParsed = {
    ...aiParsed,
    items: postProcessProjectUpdateItems({
      items: aiParsed.items,
      context: contextResult.context,
    }),
  };

  const updateResult = await createProjectUpdateAuditRecord({
    projectId: contextResult.context.project.id,
    clientId: contextResult.context.project.client_id,
    rawInput,
    sourceType: sourceType as ProjectUpdateSourceType,
    status: "analyzed",
    aiSummary: {
      ...aiParsed.summary,
      model: PROJECT_UPDATE_MODEL,
      suggestedItemCount: aiParsed.items.length,
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
    aiParsed.items.map((aiItem) =>
      mapAiItemToAuditItem({
        aiItem,
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
    eventTitle: "Client update analyzed",
    eventSummary: aiParsed.summary.headline,
    sourceUpdateId: updateResult.data.id,
    metadata: {
      model: PROJECT_UPDATE_MODEL,
      sourceType,
      suggestedItemCount: itemResult.data.length,
      riskLevel: aiParsed.summary.riskLevel,
    },
  });

  return {
    status: 200,
    response: {
      ok: true,
      update: updateResult.data,
      items: itemResult.data,
      timelineEvent: timelineResult.ok ? timelineResult.data : null,
      analysis: aiParsed.summary,
    },
  };
}
