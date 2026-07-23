import {
  normalizeProjectUpdateBudget,
  resolveProjectUpdateDeadline,
} from "@/lib/project-updates/project-update-field-normalizers";
import type {
  JsonRecord,
  ProjectPrioritySource,
  ProjectUpdateItem,
  ProjectUpdateItemType,
} from "@/lib/project-updates/project-update-types";

export type ProjectUpdateItemRow = ProjectUpdateItem;

export type ProjectClientRow = {
  id: string;
  name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at?: string | null;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  client_id: string | null;

  title: string | null;
  summary: string | null;

  client_name: string | null;
  contact_name: string | null;

  amount: string | null;
  amount_value: number | null;
  currency_code: string | null;

  deadline_text: string | null;
  deadline_date: string | null;

  priority: string | null;
  priority_source: ProjectPrioritySource | null;
  status: string | null;

  source?: string | null;
  raw_input?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  client?: ProjectClientRow | null;
};

export type ApplyMutationResult = {
  timelineEventType:
    | "subtask_added"
    | "subtask_updated"
    | "deadline_updated"
    | "budget_updated"
    | "priority_updated"
    | "status_updated"
    | "client_details_updated"
    | "note_added"
    | "update_item_accepted";

  eventTitle: string;
  eventSummary: string | null;
  targetTaskId?: number | null;
  targetField?: string | null;
  oldValue?: JsonRecord | null;
  newValue?: JsonRecord | null;
  metadata?: JsonRecord | null;
};

export type TransactionalApplyPayloadItem = {
  itemId: string;
  itemType: ProjectUpdateItemType;
  newValue: JsonRecord | null;
  mutation: JsonRecord;
  event: {
    eventType: ApplyMutationResult["timelineEventType"];
    title: string;
    summary: string | null;
    targetTaskId: number | null;
    targetField: string | null;
    oldValue: JsonRecord | null;
    newValue: JsonRecord | null;
    metadata: JsonRecord | null;
  };
};

/**
 * Item types that are never directly applicable -- they represent a
 * stored judge decision that requires human review (an ambiguous or
 * unmatched reference, or a case that already matches the current
 * project state). Including one of these ids in acceptedItemIds must
 * never be treated as consent to mutate anything: the server -- not the
 * client's checkbox state -- is authoritative on whether a stored
 * decision is safe to apply.
 */
export const NON_APPLICABLE_ACCEPTED_ITEM_TYPES = new Set<ProjectUpdateItemType>([
  "duplicate_warning",
  "no_action",
  "needs_review",
]);

export function findNonApplicableAcceptedItem(
  items: ProjectUpdateItemRow[]
): ProjectUpdateItemRow | null {
  return (
    items.find((item) => NON_APPLICABLE_ACCEPTED_ITEM_TYPES.has(item.type)) ??
    null
  );
}

export function asJsonRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

export function getStringValue(
  record: JsonRecord | null,
  keys: string[],
  fallback: string | null = null
): string | null {
  if (!record) {
    return fallback;
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

  return fallback;
}

export function getExactStringValue(
  record: JsonRecord | null,
  keys: string[]
): string | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}

export function getNumberValue(
  record: JsonRecord | null,
  keys: string[],
  fallback: number | null = null
): number | null {
  if (!record) {
    return fallback;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

export function normalizeStatus(value: string | null): string {
  if (!value || !value.trim()) {
    return "New";
  }

  return value.trim();
}

export function normalizePriority(value: string | null): string {
  if (!value || !value.trim()) {
    return "Medium";
  }

  return value.trim();
}

export function validateProjectPriorityChoice(
  value: string | null
): "Low" | "Medium" | "High" | null {
  if (value === null) return null;

  if (value === "Low" || value === "Medium" || value === "High") {
    return value;
  }

  throw new Error("Invalid priority.");
}

export function getTaskTitleFromItem(item: ProjectUpdateItemRow): string {
  const nextValue = asJsonRecord(item.new_value);

  return (
    getStringValue(nextValue, ["task_title", "title", "name"], null) ||
    item.title ||
    "New client-requested task"
  );
}

export function getProjectUpdateItemEventTitle(item: ProjectUpdateItemRow): string {
  if (item.title?.trim()) {
    return item.title.trim();
  }

  switch (item.type) {
    case "new_subtask":
      return "New subtask added";
    case "update_subtask":
      return "Subtask updated";
    case "deadline_change":
      return "Deadline updated";
    case "budget_change":
      return "Budget updated";
    case "priority_change":
      return "Priority updated";
    case "status_change":
      return "Status updated";
    case "client_detail_change":
      return "Client details updated";
    case "project_note":
      return "Project note added";
    case "client_note":
      return "Client note added";
    case "duplicate_warning":
      return "Duplicate warning reviewed";
    case "no_action":
      return "No action required";
    case "needs_review":
      return "Needs review";
    default:
      return "Project update item reviewed";
  }
}

/**
 * Builds the transactional apply payload for exactly one stored,
 * accepted project_update_items row. This is the single place that
 * decides what a given item type actually mutates -- new_subtask always
 * inserts a fresh task, update_subtask always requires an existing,
 * validated target_task_id (never falls back to creating a task if it is
 * missing), and every other type either mutates a project field or
 * produces a timeline-only record.
 */
export function buildTransactionalApplyPayloadItem(input: {
  project: ProjectRow;
  item: ProjectUpdateItemRow;
}): TransactionalApplyPayloadItem {
  const { project, item } = input;
  const nextValue = asJsonRecord(item.new_value);
  let mutation: JsonRecord = { kind: "timeline_only" };
  let eventType: ApplyMutationResult["timelineEventType"] =
    item.type === "project_note" || item.type === "client_note"
      ? "note_added"
      : "update_item_accepted";
  let eventTitle = getProjectUpdateItemEventTitle(item);
  let eventSummary = item.description ?? item.ai_reason ?? null;
  let targetTaskId = item.target_task_id;
  let targetField = item.target_field ?? null;
  let eventMetadata: JsonRecord = {
    updateItemType: item.type,
    timelineOnly: true,
  };

  if (item.type === "new_subtask") {
    const status = normalizeStatus(
      getStringValue(nextValue, ["status"], project.status)
    );
    const priority = normalizePriority(
      getStringValue(nextValue, ["priority"], project.priority)
    );
    const taskTitle = getTaskTitleFromItem(item);

    mutation = {
      kind: "new_subtask",
      task: {
        client_name: project.client_name ?? "Client",
        contact_name: project.contact_name ?? null,
        task_title: taskTitle,
        amount: getStringValue(
          nextValue,
          ["amount", "budget", "price", "cost"],
          project.amount
        ),
        amount_value: getNumberValue(
          nextValue,
          ["amount_value", "budget_value"],
          project.amount_value
        ),
        currency_code: getStringValue(
          nextValue,
          ["currency_code", "currency"],
          project.currency_code
        ),
        deadline_text: getStringValue(
          nextValue,
          ["deadline_text", "deadline"],
          project.deadline_text
        ),
        deadline_date: getStringValue(
          nextValue,
          ["deadline_date"],
          project.deadline_date
        ),
        priority,
        status,
      },
    };
    eventType = "subtask_added";
    eventTitle = "New subtask added";
    eventSummary = taskTitle;
    targetTaskId = null;
    targetField = "task_title";
    eventMetadata = { updateItemType: item.type };
  } else if (item.type === "update_subtask") {
    if (!item.target_task_id || !nextValue) {
      throw new Error("Missing target task or value for subtask update.");
    }

    const updates: JsonRecord = {};
    const taskTitle = getStringValue(nextValue, ["task_title", "title", "name"]);
    const amount = getStringValue(nextValue, ["amount", "budget", "price", "cost"]);
    const amountValue = getNumberValue(nextValue, ["amount_value", "budget_value"]);
    const currencyCode = getStringValue(nextValue, ["currency_code", "currency"]);
    const deadlineText = getStringValue(nextValue, ["deadline_text", "deadline"]);
    const deadlineDate = getStringValue(nextValue, ["deadline_date"]);
    const priority = getStringValue(nextValue, ["priority"]);
    const status = getStringValue(nextValue, ["status"]);

    if (taskTitle !== null) updates.task_title = taskTitle;
    if (amount !== null) updates.amount = amount;
    if (amountValue !== null) updates.amount_value = amountValue;
    if (currencyCode !== null) updates.currency_code = currencyCode;
    if (deadlineText !== null) updates.deadline_text = deadlineText;
    if (deadlineDate !== null) updates.deadline_date = deadlineDate;
    if (priority !== null) updates.priority = priority;
    if (status !== null) updates.status = status;

    if (Object.keys(updates).length === 0) {
      throw new Error("No supported subtask field was found to update.");
    }

    mutation = {
      kind: "update_subtask",
      taskId: item.target_task_id,
      updates,
    };
    eventType = "subtask_updated";
    eventTitle = "Subtask updated";
    eventSummary = item.title;
    eventMetadata = { updateItemType: item.type };
  } else if (
    item.type === "deadline_change" ||
    item.type === "budget_change" ||
    item.type === "priority_change" ||
    item.type === "status_change"
  ) {
    if (!nextValue) {
      throw new Error("Missing new value for project field update.");
    }

    const updates: JsonRecord = {};

    if (item.type === "deadline_change") {
      const deadlineText = getStringValue(nextValue, ["deadline_text", "deadline"]);

      if (!deadlineText) {
        throw new Error("Deadline edits require a suggested deadline.");
      }

      const normalizedDeadline = resolveProjectUpdateDeadline({
        deadlineText,
        currentDeadlineDate: project.deadline_date,
      });

      updates.deadline_text = normalizedDeadline.deadline_text;
      updates.deadline_date = normalizedDeadline.deadline_date;
      eventType = "deadline_updated";
      eventTitle = "Deadline updated";
      targetField = targetField ?? "deadline";
    }

    if (item.type === "budget_change") {
      const amountText = getStringValue(nextValue, [
        "amount",
        "budget",
        "price",
        "cost",
      ]);

      if (!amountText) {
        throw new Error("Budget edits require a suggested amount.");
      }

      const normalizedBudget = normalizeProjectUpdateBudget({
        amountText,
        existingCurrencyCode: project.currency_code,
        existingAmountText: project.amount,
      });

      if (!normalizedBudget) {
        throw new Error("Budget edits require a numeric suggested amount.");
      }

      updates.amount = normalizedBudget.amount;
      updates.amount_value = normalizedBudget.amount_value;
      updates.currency_code = normalizedBudget.currency_code;
      eventType = "budget_updated";
      eventTitle = "Budget updated";
      targetField = targetField ?? "budget";
    }

    if (item.type === "priority_change") {
      const priority = validateProjectPriorityChoice(
        getExactStringValue(nextValue, ["priority", "value"])
      );

      if (!priority) {
        throw new Error("Priority edits require a suggested priority.");
      }

      updates.priority = priority;
      eventType = "priority_updated";
      eventTitle = "Priority updated";
      targetField = targetField ?? "priority";
    }

    if (item.type === "status_change") {
      const status = getStringValue(nextValue, ["status"]);
      if (status !== null) updates.status = status;
      eventType = "status_updated";
      eventTitle = "Status updated";
      targetField = targetField ?? "status";
    }

    if (Object.keys(updates).length === 0) {
      throw new Error("No supported project field was found to update.");
    }

    mutation = { kind: "project_field", updates };
    targetTaskId = null;
    eventSummary = item.title;
    eventMetadata = { updateItemType: item.type };
  } else if (item.type === "client_detail_change") {
    if (!nextValue) {
      throw new Error("Missing new value for client detail update.");
    }

    const projectUpdates: JsonRecord = {};
    const clientUpdates: JsonRecord = {};
    const taskUpdates: JsonRecord = {};
    const clientName = getStringValue(nextValue, ["client_name", "name"]);
    const contactName = getStringValue(nextValue, ["contact_name"]);
    const phone = getStringValue(nextValue, ["phone"]);
    const email = getStringValue(nextValue, ["email"]);
    const notes = getStringValue(nextValue, ["notes", "client_notes"]);

    if (clientName !== null) {
      projectUpdates.client_name = clientName;
      clientUpdates.name = clientName;
      taskUpdates.client_name = clientName;
    }

    if (contactName !== null) {
      projectUpdates.contact_name = contactName;
      clientUpdates.contact_name = contactName;
      taskUpdates.contact_name = contactName;
    }

    if (phone !== null) clientUpdates.phone = phone;
    if (email !== null) clientUpdates.email = email;
    if (notes !== null) clientUpdates.notes = notes;

    mutation = {
      kind: "client_detail",
      projectUpdates,
      clientUpdates,
      taskUpdates,
    };
    eventType = "client_details_updated";
    eventTitle = "Client details updated";
    eventSummary = item.title;
    targetTaskId = null;
    targetField = targetField ?? "client";
    eventMetadata = { updateItemType: item.type };
  }

  return {
    itemId: item.id,
    itemType: item.type,
    newValue: nextValue,
    mutation,
    event: {
      eventType,
      title: eventTitle,
      summary: eventSummary,
      targetTaskId,
      targetField,
      oldValue: asJsonRecord(item.old_value),
      newValue: nextValue,
      metadata: eventMetadata,
    },
  };
}
