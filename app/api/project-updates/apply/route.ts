import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  findDuplicateSubtaskInNewTitles,
  findDuplicateSubtaskInProject,
  type DuplicateSubtaskMatch,
} from "@/lib/tasks/subtask-duplicate-detection";
import { parseDeadline } from "@/lib/tasks/parse-deadline";
import {
  dashboardTasksNoStoreHeaders,
  loadDashboardTasksForUser,
  type DashboardTaskRow,
} from "@/lib/tasks/load-dashboard-tasks.server";

import type {
  JsonRecord,
  ProjectTimelineEvent,
  ProjectUpdate,
  ProjectUpdateItem,
  ProjectUpdateItemType,
} from "@/lib/project-updates/project-update-types";

const ApplyProjectUpdateRequestSchema = z
  .object({
    projectUpdateId: z.string().min(1, "Project update id is required."),
    acceptedItemIds: z.array(z.string().min(1)).default([]),
    rejectedItemIds: z.array(z.string().min(1)).default([]),
    editedItems: z
      .array(
        z.object({
          itemId: z.string().min(1),
          newValue: z.record(z.string(), z.unknown()),
        })
      )
      .default([]),
  })
  .refine(
    (value) => value.acceptedItemIds.length > 0 || value.rejectedItemIds.length > 0,
    {
      message: "At least one accepted or rejected item id is required.",
      path: ["acceptedItemIds"],
    }
  );

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ApplyProjectUpdateResponse =
  | {
      ok: true;
      update: ProjectUpdate;
      project: ProjectRow | null;
      projectTasks: ProjectTaskSnapshotRow[];
      dashboardTasks: ProjectTaskSnapshotRow[];
      appliedItems: ProjectUpdateItem[];
      rejectedItems: ProjectUpdateItem[];
      timelineEvents: ProjectTimelineEvent[];
    }
  | {
      ok: false;
      code?: string;
      error: string;
      message?: string;
      duplicate?: DuplicateSubtaskMatch;
      details?: unknown;
    };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ProjectUpdateRow = ProjectUpdate;

type ProjectUpdateItemRow = ProjectUpdateItem;

type ProjectUpdateClaimFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
  details?: unknown;
};

type ProjectUpdateClaimResult =
  | {
      ok: true;
      attemptId: string;
      update: ProjectUpdateRow;
    }
  | ProjectUpdateClaimFailure;

type EditedItemOverride = {
  itemId: string;
  newValue: JsonRecord;
};

type ProjectClientRow = {
  id: string;
  name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at?: string | null;
};

type ProjectRow = {
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

type ProjectTaskSnapshotRow = DashboardTaskRow;

type ApplyMutationResult = {
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

function asJsonRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function getStringValue(
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

function getNumberValue(
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

function normalizeStatus(value: string | null): string {
  if (!value || !value.trim()) {
    return "New";
  }

  return value.trim();
}

function normalizePriority(value: string | null): string {
  if (!value || !value.trim()) {
    return "Medium";
  }

  return value.trim();
}

function isDoneStatus(value: string | null | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "done" || normalized === "completed" || normalized === "complete";
}

function getOptionalString(record: JsonRecord, keys: string[]): string | null {
  return getStringValue(record, keys, null);
}

function getOptionalNumber(record: JsonRecord, keys: string[]): number | null {
  return getNumberValue(record, keys, null);
}

function normalizeAllowedChoice(
  value: string | null,
  allowed: string[],
  fieldName: string
): string | null {
  if (value === null) return null;

  const match = allowed.find((option) => option.toLowerCase() === value.toLowerCase());

  if (!match) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  return match;
}

function compactJsonRecord(record: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string") return value.trim().length > 0;
      return true;
    })
  );
}

function normalizeEditedNewValueForItem(item: ProjectUpdateItemRow, rawValue: JsonRecord): JsonRecord {
  switch (item.type as ProjectUpdateItemType) {
    case "new_subtask": {
      const taskTitle =
        getOptionalString(rawValue, ["task_title", "title", "name"]) || item.title;

      if (!taskTitle?.trim()) {
        throw new Error("New subtask edits require a task title.");
      }

      return compactJsonRecord({
        task_title: taskTitle,
        deadline_text: getOptionalString(rawValue, ["deadline_text", "deadline"]),
        amount: getOptionalString(rawValue, ["amount", "budget", "price", "cost"]),
        amount_value: getOptionalNumber(rawValue, ["amount_value", "budget_value"]),
        currency_code: getOptionalString(rawValue, ["currency_code", "currency"]),
        priority:
          normalizeAllowedChoice(
            getOptionalString(rawValue, ["priority"]),
            ["Low", "Medium", "High"],
            "priority"
          ) ?? "Medium",
        status:
          normalizeAllowedChoice(
            getOptionalString(rawValue, ["status"]),
            ["New", "In Progress", "Review", "Urgent", "Done"],
            "status"
          ) ?? "New",
      });
    }

    case "update_subtask": {
      const normalized = compactJsonRecord({
        task_title: getOptionalString(rawValue, ["task_title", "title", "name"]),
        deadline_text: getOptionalString(rawValue, ["deadline_text", "deadline"]),
        deadline_date: getOptionalString(rawValue, ["deadline_date"]),
        amount: getOptionalString(rawValue, ["amount", "budget", "price", "cost"]),
        amount_value: getOptionalNumber(rawValue, ["amount_value", "budget_value"]),
        currency_code: getOptionalString(rawValue, ["currency_code", "currency"]),
        priority: normalizeAllowedChoice(
          getOptionalString(rawValue, ["priority"]),
          ["Low", "Medium", "High"],
          "priority"
        ),
        status: normalizeAllowedChoice(
          getOptionalString(rawValue, ["status"]),
          ["New", "In Progress", "Review", "Urgent", "Done"],
          "status"
        ),
        notes: getOptionalString(rawValue, ["notes", "note"]),
      });

      if (Object.keys(normalized).length === 0) {
        throw new Error("Subtask edits require at least one supported field.");
      }

      return normalized;
    }

    case "deadline_change": {
      const deadlineText = getOptionalString(rawValue, ["deadline_text", "deadline", "value"]);

      if (!deadlineText) {
        throw new Error("Deadline edits require a suggested deadline.");
      }

      return compactJsonRecord({
        deadline_text: deadlineText,
        deadline_date: getOptionalString(rawValue, ["deadline_date"]),
      });
    }

    case "budget_change": {
      const amount = getOptionalString(rawValue, ["amount", "budget", "price", "cost", "value"]);

      if (!amount) {
        throw new Error("Budget edits require a suggested amount.");
      }

      return compactJsonRecord({
        amount,
        amount_value: getOptionalNumber(rawValue, ["amount_value", "budget_value"]),
        currency_code: getOptionalString(rawValue, ["currency_code", "currency"]),
      });
    }

    case "priority_change": {
      const priority = normalizeAllowedChoice(
        getOptionalString(rawValue, ["priority", "value"]),
        ["Low", "Medium", "High"],
        "priority"
      );

      if (!priority) {
        throw new Error("Priority edits require a suggested priority.");
      }

      return { priority };
    }

    case "status_change": {
      const status = normalizeAllowedChoice(
        getOptionalString(rawValue, ["status", "value"]),
        ["New", "In Progress", "Review", "Urgent", "Done"],
        "status"
      );

      if (!status) {
        throw new Error("Status edits require a suggested status.");
      }

      return { status };
    }

    case "client_detail_change": {
      const normalized = compactJsonRecord({
        client_name: getOptionalString(rawValue, ["client_name", "name"]),
        contact_name: getOptionalString(rawValue, ["contact_name"]),
        phone: getOptionalString(rawValue, ["phone"]),
        email: getOptionalString(rawValue, ["email"]),
        notes: getOptionalString(rawValue, ["notes", "client_notes"]),
      });

      if (Object.keys(normalized).length === 0) {
        throw new Error("Client detail edits require at least one supported field.");
      }

      return normalized;
    }

    case "project_note":
    case "client_note": {
      const note = getOptionalString(rawValue, ["note", "notes", "value"]);

      if (!note) {
        throw new Error("Note edits require note text.");
      }

      return { note };
    }

    case "duplicate_warning":
    case "no_action":
      return compactJsonRecord(rawValue);

    default:
      return compactJsonRecord(rawValue);
  }
}

function getTaskTitleFromItem(item: ProjectUpdateItemRow): string {
  const nextValue = asJsonRecord(item.new_value);

  return (
    getStringValue(nextValue, ["task_title", "title", "name"], null) ||
    item.title ||
    "New client-requested task"
  );
}

function applyEditedOverridesToItems(input: {
  items: ProjectUpdateItemRow[];
  overrides: Map<string, JsonRecord>;
}) {
  return input.items.map((item) => {
    const override = input.overrides.get(item.id);

    if (!override) return item;

    return {
      ...item,
      new_value: override,
    };
  });
}

function getProjectUpdateItemEventTitle(item: ProjectUpdateItemRow): string {
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
    default:
      return "Project update item reviewed";
  }
}

async function loadProjectUpdateForApply(input: {
  supabase: SupabaseServerClient;
  projectUpdateId: string;
  userId: string;
}): Promise<
  | {
      ok: true;
      update: ProjectUpdateRow;
      project: ProjectRow;
      items: ProjectUpdateItemRow[];
    }
  | {
      ok: false;
      status: number;
      error: string;
    }
> {
  const { data: update, error: updateError } = await input.supabase
    .from("project_updates")
    .select("*")
    .eq("id", input.projectUpdateId)
    .eq("user_id", input.userId)
    .single();

  if (updateError || !update) {
    return {
      ok: false,
      status: 404,
      error: "Project update not found or you do not have access to it.",
    };
  }

  const typedUpdate = update as ProjectUpdateRow;

  const { data: project, error: projectError } = await input.supabase
    .from("projects")
    .select(
      `
      id,
      user_id,
      client_id,
      title,
      summary,
      client_name,
      contact_name,
      amount,
      amount_value,
      currency_code,
      deadline_text,
      deadline_date,
      priority,
      status,
      deleted_at
    `
    )
    .eq("id", typedUpdate.project_id)
    .eq("user_id", input.userId)
    .is("deleted_at", null)
    .single();

  if (projectError || !project) {
    return {
      ok: false,
      status: 404,
      error: "Project not found or you do not have access to it.",
    };
  }

  const { data: items, error: itemsError } = await input.supabase
    .from("project_update_items")
    .select("*")
    .eq("project_update_id", input.projectUpdateId)
    .eq("project_id", typedUpdate.project_id)
    .eq("user_id", input.userId)
    .order("created_at", { ascending: true });

  if (itemsError) {
    return {
      ok: false,
      status: 500,
      error: itemsError.message || "Could not load project update items.",
    };
  }

  return {
    ok: true,
    update: typedUpdate,
    project: project as ProjectRow,
    items: (items ?? []) as ProjectUpdateItemRow[],
  };
}

function getApplyOperationalDetails(update: ProjectUpdateRow) {
  return {
    status: update.status,
    applyAttemptId: update.apply_attempt_id,
    applyStartedAt: update.apply_started_at,
    applyFailedAt: update.apply_failed_at,
    applyErrorCode: update.apply_error_code,
  };
}

function getProjectUpdateStateFailure(
  update: ProjectUpdateRow
): ProjectUpdateClaimFailure {
  const details = getApplyOperationalDetails(update);

  if (update.status === "applied") {
    return {
      ok: false,
      status: 409,
      code: "project_update_already_applied",
      error: "This project update was already applied. Refresh the workspace to see the latest changes.",
      details,
    };
  }

  if (update.status === "applying") {
    return {
      ok: false,
      status: 409,
      code: "project_update_apply_in_progress",
      error:
        "This project update is already being applied. Wait for it to finish, then refresh the workspace. If it remains in progress, contact support before trying again.",
      details,
    };
  }

  if (update.status === "failed") {
    const error = update.apply_attempt_id
      ? "A previous apply attempt failed after it started. It was not retried automatically. Contact support before trying again."
      : "This project update is in a failed state and cannot be applied. Re-analyze the client update or contact support before trying again.";

    return {
      ok: false,
      status: 409,
      code: "project_update_apply_failed",
      error,
      details,
    };
  }

  return {
    ok: false,
    status: 409,
    code: "project_update_invalid_state",
    error: `This project update cannot be applied while its status is "${update.status}".`,
    details,
  };
}

async function claimProjectUpdateForApply(input: {
  supabase: SupabaseServerClient;
  projectUpdateId: string;
  userId: string;
}): Promise<ProjectUpdateClaimResult> {
  const attemptId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  const { data: claimedUpdate, error: claimError } = await input.supabase
    .from("project_updates")
    .update({
      status: "applying",
      apply_started_at: startedAt,
      apply_attempt_id: attemptId,
      apply_failed_at: null,
      apply_error_code: null,
    })
    .eq("id", input.projectUpdateId)
    .eq("user_id", input.userId)
    .in("status", ["analyzed", "reviewed"])
    .select("*")
    .maybeSingle();

  if (claimError) {
    console.error("Could not claim project update for apply:", {
      updateId: input.projectUpdateId,
      error: claimError.message,
    });

    return {
      ok: false,
      status: 500,
      code: "project_update_claim_failed",
      error: "Text2Task could not safely start applying this update. No changes were applied.",
    };
  }

  if (claimedUpdate) {
    return {
      ok: true,
      attemptId,
      update: claimedUpdate as ProjectUpdateRow,
    };
  }

  const { data: currentUpdate, error: currentError } = await input.supabase
    .from("project_updates")
    .select("*")
    .eq("id", input.projectUpdateId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (currentError || !currentUpdate) {
    return {
      ok: false,
      status: 404,
      code: "project_update_not_found",
      error: "Project update not found or you do not have access to it.",
    };
  }

  const typedUpdate = currentUpdate as ProjectUpdateRow;
  return getProjectUpdateStateFailure(typedUpdate);
}

async function getNextSubtaskOrder(input: {
  supabase: SupabaseServerClient;
  projectId: string;
  userId: string;
}): Promise<number> {
  const { data } = await input.supabase
    .from("tasks")
    .select("subtask_order")
    .eq("project_id", input.projectId)
    .eq("user_id", input.userId)
    .is("deleted_at", null)
    .order("subtask_order", { ascending: false, nullsFirst: false })
    .limit(1);

  const currentMax = data?.[0]?.subtask_order;

  if (typeof currentMax === "number" && Number.isFinite(currentMax)) {
    return currentMax + 1;
  }

  return 1;
}

async function applyNewSubtask(input: {
  supabase: SupabaseServerClient;
  userId: string;
  project: ProjectRow;
  update: ProjectUpdateRow;
  item: ProjectUpdateItemRow;
}): Promise<ApplyMutationResult> {
  const nextValue = asJsonRecord(input.item.new_value);
  const nowIso = new Date().toISOString();
  const status = normalizeStatus(getStringValue(nextValue, ["status"], input.project.status));
  const priority = normalizePriority(getStringValue(nextValue, ["priority"], input.project.priority));

  const nextSubtaskOrder = await getNextSubtaskOrder({
    supabase: input.supabase,
    projectId: input.project.id,
    userId: input.userId,
  });

  const taskTitle = getTaskTitleFromItem(input.item);

  const taskPayload = {
    user_id: input.userId,
    client_name: input.project.client_name ?? "Client",
    contact_name: input.project.contact_name ?? null,
    client_id: input.project.client_id,
    project_id: input.project.id,
    subtask_order: nextSubtaskOrder,

    task_title: taskTitle,
    amount: getStringValue(nextValue, ["amount", "budget", "price", "cost"], input.project.amount),
    amount_value: getNumberValue(nextValue, ["amount_value", "budget_value"], input.project.amount_value),
    currency_code: getStringValue(nextValue, ["currency_code", "currency"], input.project.currency_code),

    deadline_text: getStringValue(nextValue, ["deadline_text", "deadline"], input.project.deadline_text),
    deadline_date: getStringValue(nextValue, ["deadline_date"], input.project.deadline_date),

    priority,
    status,

    source: "client_update",
    raw_input: input.update.raw_input,

    is_archived: false,
    archived_at: null,
    completed_at: isDoneStatus(status) ? nowIso : null,
    deleted_at: null,
    updated_at: nowIso,
  };

  const { data, error } = await input.supabase
    .from("tasks")
    .insert(taskPayload)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not create new subtask.");
  }

  const newTaskId = Number(data.id);

  return {
    timelineEventType: "subtask_added",
    eventTitle: "New subtask added",
    eventSummary: taskTitle,
    targetTaskId: newTaskId,
    targetField: "task_title",
    oldValue: null,
    newValue: {
      task_id: newTaskId,
      task_title: taskTitle,
      subtask_order: nextSubtaskOrder,
    },
    metadata: {
      updateItemType: input.item.type,
    },
  };
}

async function applyUpdateSubtask(input: {
  supabase: SupabaseServerClient;
  userId: string;
  project: ProjectRow;
  item: ProjectUpdateItemRow;
}): Promise<ApplyMutationResult> {
  if (!input.item.target_task_id) {
    throw new Error("Missing target task id for subtask update.");
  }

  const nextValue = asJsonRecord(input.item.new_value);

  if (!nextValue) {
    throw new Error("Missing new value for subtask update.");
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const taskTitle = getStringValue(nextValue, ["task_title", "title", "name"]);
  const amount = getStringValue(nextValue, ["amount", "budget", "price", "cost"]);
  const amountValue = getNumberValue(nextValue, ["amount_value", "budget_value"]);
  const currencyCode = getStringValue(nextValue, ["currency_code", "currency"]);
  const deadlineText = getStringValue(nextValue, ["deadline_text", "deadline"]);
  const deadlineDate = getStringValue(nextValue, ["deadline_date"]);
  const priority = getStringValue(nextValue, ["priority"]);
  const status = getStringValue(nextValue, ["status"]);

  if (taskTitle !== null) updateData.task_title = taskTitle;
  if (amount !== null) updateData.amount = amount;
  if (amountValue !== null) updateData.amount_value = amountValue;
  if (currencyCode !== null) updateData.currency_code = currencyCode;
  if (deadlineText !== null) updateData.deadline_text = deadlineText;
  if (deadlineDate !== null) updateData.deadline_date = deadlineDate;
  if (priority !== null) updateData.priority = priority;
  if (status !== null) {
    updateData.status = status;
    updateData.completed_at = isDoneStatus(status) ? new Date().toISOString() : null;
  }

  const { error } = await input.supabase
    .from("tasks")
    .update(updateData)
    .eq("id", input.item.target_task_id)
    .eq("project_id", input.project.id)
    .eq("user_id", input.userId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message || "Could not update subtask.");
  }

  return {
    timelineEventType: "subtask_updated",
    eventTitle: "Subtask updated",
    eventSummary: input.item.title,
    targetTaskId: input.item.target_task_id,
    targetField: input.item.target_field ?? null,
    oldValue: asJsonRecord(input.item.old_value),
    newValue: nextValue,
    metadata: {
      updateItemType: input.item.type,
    },
  };
}

async function applyProjectFieldChange(input: {
  supabase: SupabaseServerClient;
  userId: string;
  project: ProjectRow;
  item: ProjectUpdateItemRow;
}): Promise<ApplyMutationResult> {
  const nextValue = asJsonRecord(input.item.new_value);

  if (!nextValue) {
    throw new Error("Missing new value for project field update.");
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  let timelineEventType: ApplyMutationResult["timelineEventType"] = "update_item_accepted";
  let eventTitle = getProjectUpdateItemEventTitle(input.item);
  let targetField = input.item.target_field ?? null;

  if (input.item.type === "deadline_change") {
    const deadlineText = getStringValue(nextValue, ["deadline_text", "deadline"]);
    const deadlineDate =
      getStringValue(nextValue, ["deadline_date"]) ||
      (deadlineText ? parseDeadline(deadlineText).deadlineDate : null);

    if (deadlineText !== null) updateData.deadline_text = deadlineText;
    if (deadlineDate !== null) updateData.deadline_date = deadlineDate;

    timelineEventType = "deadline_updated";
    eventTitle = "Deadline updated";
    targetField = targetField ?? "deadline";
  }

  if (input.item.type === "budget_change") {
    const amount = getStringValue(nextValue, ["amount", "budget", "price", "cost"]);
    const amountValue = getNumberValue(nextValue, ["amount_value", "budget_value"]);
    const currencyCode = getStringValue(nextValue, ["currency_code", "currency"]);

    if (amount !== null) updateData.amount = amount;
    if (amountValue !== null) updateData.amount_value = amountValue;
    if (currencyCode !== null) updateData.currency_code = currencyCode;

    timelineEventType = "budget_updated";
    eventTitle = "Budget updated";
    targetField = targetField ?? "budget";
  }

  if (input.item.type === "priority_change") {
    const priority = getStringValue(nextValue, ["priority"]);

    if (priority !== null) {
      updateData.priority = priority;
    }

    timelineEventType = "priority_updated";
    eventTitle = "Priority updated";
    targetField = targetField ?? "priority";
  }

  if (input.item.type === "status_change") {
    const status = getStringValue(nextValue, ["status"]);

    if (status !== null) {
      updateData.status = status;
    }

    timelineEventType = "status_updated";
    eventTitle = "Status updated";
    targetField = targetField ?? "status";
  }

  if (Object.keys(updateData).length === 1) {
    throw new Error("No supported project field was found to update.");
  }

  const { error } = await input.supabase
    .from("projects")
    .update(updateData)
    .eq("id", input.project.id)
    .eq("user_id", input.userId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message || "Could not update project field.");
  }

  return {
    timelineEventType,
    eventTitle,
    eventSummary: input.item.title,
    targetTaskId: null,
    targetField,
    oldValue: asJsonRecord(input.item.old_value),
    newValue: nextValue,
    metadata: {
      updateItemType: input.item.type,
    },
  };
}

async function applyClientDetailChange(input: {
  supabase: SupabaseServerClient;
  userId: string;
  project: ProjectRow;
  item: ProjectUpdateItemRow;
}): Promise<ApplyMutationResult> {
  const nextValue = asJsonRecord(input.item.new_value);

  if (!nextValue) {
    throw new Error("Missing new value for client detail update.");
  }

  const nowIso = new Date().toISOString();

  const clientName = getStringValue(nextValue, ["client_name", "name"]);
  const contactName = getStringValue(nextValue, ["contact_name"]);
  const phone = getStringValue(nextValue, ["phone"]);
  const email = getStringValue(nextValue, ["email"]);
  const notes = getStringValue(nextValue, ["notes", "client_notes"]);

  const projectUpdateData: Record<string, unknown> = {
    updated_at: nowIso,
  };

  const clientUpdateData: Record<string, unknown> = {};
  const taskUpdateData: Record<string, unknown> = {
    updated_at: nowIso,
  };

  if (clientName !== null) {
    projectUpdateData.client_name = clientName;
    clientUpdateData.name = clientName;
    taskUpdateData.client_name = clientName;
  }

  if (contactName !== null) {
    projectUpdateData.contact_name = contactName;
    clientUpdateData.contact_name = contactName;
    taskUpdateData.contact_name = contactName;
  }

  if (phone !== null) {
    clientUpdateData.phone = phone;
  }

  if (email !== null) {
    clientUpdateData.email = email;
  }

  if (notes !== null) {
    clientUpdateData.notes = notes;
  }

  if (Object.keys(projectUpdateData).length > 1) {
    const { error: projectError } = await input.supabase
      .from("projects")
      .update(projectUpdateData)
      .eq("id", input.project.id)
      .eq("user_id", input.userId)
      .is("deleted_at", null);

    if (projectError) {
      throw new Error(projectError.message || "Could not update project client fields.");
    }
  }

  if (input.project.client_id && Object.keys(clientUpdateData).length > 0) {
    const { error: clientError } = await input.supabase
      .from("clients")
      .update(clientUpdateData)
      .eq("id", input.project.client_id)
      .eq("user_id", input.userId);

    if (clientError) {
      throw new Error(clientError.message || "Could not update client details.");
    }
  }

  if (Object.keys(taskUpdateData).length > 1) {
    const { error: taskError } = await input.supabase
      .from("tasks")
      .update(taskUpdateData)
      .eq("project_id", input.project.id)
      .eq("user_id", input.userId)
      .is("deleted_at", null);

    if (taskError) {
      throw new Error(taskError.message || "Could not sync client fields to tasks.");
    }
  }

  return {
    timelineEventType: "client_details_updated",
    eventTitle: "Client details updated",
    eventSummary: input.item.title,
    targetTaskId: null,
    targetField: input.item.target_field ?? "client",
    oldValue: asJsonRecord(input.item.old_value),
    newValue: nextValue,
    metadata: {
      updateItemType: input.item.type,
    },
  };
}

async function applyTimelineOnlyItem(input: {
  item: ProjectUpdateItemRow;
}): Promise<ApplyMutationResult> {
  return {
    timelineEventType:
      input.item.type === "project_note" || input.item.type === "client_note"
        ? "note_added"
        : "update_item_accepted",
    eventTitle: getProjectUpdateItemEventTitle(input.item),
    eventSummary: input.item.description ?? input.item.ai_reason ?? null,
    targetTaskId: input.item.target_task_id,
    targetField: input.item.target_field ?? null,
    oldValue: asJsonRecord(input.item.old_value),
    newValue: asJsonRecord(input.item.new_value),
    metadata: {
      updateItemType: input.item.type,
      timelineOnly: true,
    },
  };
}

async function applyAcceptedItem(input: {
  supabase: SupabaseServerClient;
  userId: string;
  project: ProjectRow;
  update: ProjectUpdateRow;
  item: ProjectUpdateItemRow;
}): Promise<ApplyMutationResult> {
  switch (input.item.type as ProjectUpdateItemType) {
    case "new_subtask":
      return applyNewSubtask(input);

    case "update_subtask":
      return applyUpdateSubtask(input);

    case "deadline_change":
    case "budget_change":
    case "priority_change":
    case "status_change":
      return applyProjectFieldChange(input);

    case "client_detail_change":
      return applyClientDetailChange(input);

    case "project_note":
    case "client_note":
    case "duplicate_warning":
    case "no_action":
      return applyTimelineOnlyItem({
        item: input.item,
      });

    default:
      return applyTimelineOnlyItem({
        item: input.item,
      });
  }
}

async function markItemsApplied(input: {
  supabase: SupabaseServerClient;
  userId: string;
  itemIds: string[];
}): Promise<ProjectUpdateItem[]> {
  if (input.itemIds.length === 0) {
    return [];
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await input.supabase
    .from("project_update_items")
    .update({
      status: "applied",
      accepted_at: nowIso,
      applied_at: nowIso,
      accepted_by: input.userId,
      applied_by: input.userId,
    })
    .in("id", input.itemIds)
    .eq("user_id", input.userId)
    .select("*");

  if (error) {
    throw new Error(error.message || "Could not mark update items as applied.");
  }

  return (data ?? []) as ProjectUpdateItem[];
}

async function markItemsRejected(input: {
  supabase: SupabaseServerClient;
  userId: string;
  itemIds: string[];
}): Promise<ProjectUpdateItem[]> {
  if (input.itemIds.length === 0) {
    return [];
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await input.supabase
    .from("project_update_items")
    .update({
      status: "rejected",
      rejected_at: nowIso,
      rejected_by: input.userId,
    })
    .in("id", input.itemIds)
    .eq("user_id", input.userId)
    .select("*");

  if (error) {
    throw new Error(error.message || "Could not mark update items as rejected.");
  }

  return (data ?? []) as ProjectUpdateItem[];
}

function buildValidatedEditedItemOverrides(input: {
  editedItems: EditedItemOverride[];
  loadedItems: ProjectUpdateItemRow[];
  acceptedItemIds: Set<string>;
  rejectedItemIds: Set<string>;
}): Map<string, JsonRecord> {
  const loadedItemsById = new Map(input.loadedItems.map((item) => [item.id, item]));
  const overrides = new Map<string, JsonRecord>();

  for (const editedItem of input.editedItems) {
    const item = loadedItemsById.get(editedItem.itemId);

    if (!item) {
      throw new Error("Edited item does not belong to this project update.");
    }

    if (input.rejectedItemIds.has(editedItem.itemId)) {
      throw new Error("Rejected items cannot receive edited values.");
    }

    if (!input.acceptedItemIds.has(editedItem.itemId)) {
      throw new Error("Only accepted items can receive edited values.");
    }

    overrides.set(
      editedItem.itemId,
      normalizeEditedNewValueForItem(item, editedItem.newValue)
    );
  }

  return overrides;
}

async function persistEditedItemOverrides(input: {
  supabase: SupabaseServerClient;
  userId: string;
  projectUpdateId: string;
  overrides: Map<string, JsonRecord>;
}): Promise<Map<string, ProjectUpdateItemRow>> {
  const updatedItems = new Map<string, ProjectUpdateItemRow>();

  for (const [itemId, newValue] of input.overrides) {
    const { data, error } = await input.supabase
      .from("project_update_items")
      .update({ new_value: newValue })
      .eq("id", itemId)
      .eq("project_update_id", input.projectUpdateId)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Could not save edited update item.");
    }

    updatedItems.set(itemId, data as ProjectUpdateItemRow);
  }

  return updatedItems;
}

async function findDuplicateAcceptedNewSubtask(input: {
  supabase: SupabaseServerClient;
  userId: string;
  projectId: string;
  acceptedItems: ProjectUpdateItemRow[];
}): Promise<DuplicateSubtaskMatch | null> {
  const newSubtaskTitles = input.acceptedItems
    .filter((item) => item.type === "new_subtask")
    .map((item) => getTaskTitleFromItem(item))
    .filter((title) => title.trim().length > 0);

  if (newSubtaskTitles.length === 0) {
    return null;
  }

  const duplicateWithinRequest = findDuplicateSubtaskInNewTitles(newSubtaskTitles);

  if (duplicateWithinRequest) {
    return duplicateWithinRequest;
  }

  for (const title of newSubtaskTitles) {
    const duplicate = await findDuplicateSubtaskInProject({
      supabase: input.supabase,
      userId: input.userId,
      projectId: input.projectId,
      candidateTitle: title,
    });

    if (duplicate) {
      return duplicate;
    }
  }

  return null;
}

async function insertTimelineEvents(input: {
  supabase: SupabaseServerClient;
  userId: string;
  projectId: string;
  updateId: string;
  events: Array<ApplyMutationResult & { sourceItemId: string }>;
}): Promise<ProjectTimelineEvent[]> {
  if (input.events.length === 0) {
    return [];
  }

  const rows = input.events.map((event) => ({
    user_id: input.userId,
    project_id: input.projectId,

    event_type: event.timelineEventType,
    event_title: event.eventTitle,
    event_summary: event.eventSummary,

    source_update_id: input.updateId,
    source_item_id: event.sourceItemId,
    target_task_id: event.targetTaskId ?? null,

    target_field: event.targetField ?? null,
    old_value: event.oldValue ?? null,
    new_value: event.newValue ?? null,

    actor_user_id: input.userId,
    metadata: event.metadata ?? null,
  }));

  const { data, error } = await input.supabase
    .from("project_timeline_events")
    .insert(rows)
    .select("*");

  if (error) {
    throw new Error(error.message || "Could not create project timeline events.");
  }

  return (data ?? []) as ProjectTimelineEvent[];
}

async function markProjectUpdateApplied(input: {
  supabase: SupabaseServerClient;
  userId: string;
  updateId: string;
  attemptId: string;
}): Promise<ProjectUpdate> {
  const nowIso = new Date().toISOString();

  const { data, error } = await input.supabase
    .from("project_updates")
    .update({
      status: "applied",
      reviewed_by: input.userId,
      applied_by: input.userId,
      reviewed_at: nowIso,
      applied_at: nowIso,
      apply_failed_at: null,
      apply_error_code: null,
    })
    .eq("id", input.updateId)
    .eq("user_id", input.userId)
    .eq("status", "applying")
    .eq("apply_attempt_id", input.attemptId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not mark project update as applied.");
  }

  return data as ProjectUpdate;
}

async function markProjectUpdateApplyFailed(input: {
  supabase: SupabaseServerClient;
  userId: string;
  updateId: string;
  attemptId: string;
  errorCode: string;
}): Promise<{
  recorded: boolean;
  update: ProjectUpdate | null;
  recordingError: string | null;
}> {
  const { data, error } = await input.supabase
    .from("project_updates")
    .update({
      status: "failed",
      apply_failed_at: new Date().toISOString(),
      apply_error_code: input.errorCode,
    })
    .eq("id", input.updateId)
    .eq("user_id", input.userId)
    .eq("status", "applying")
    .eq("apply_attempt_id", input.attemptId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Could not record failed project update apply attempt:", {
      updateId: input.updateId,
      attemptId: input.attemptId,
      error: error.message,
    });

    return {
      recorded: false,
      update: null,
      recordingError: error.message,
    };
  }

  return {
    recorded: Boolean(data),
    update: data ? (data as ProjectUpdate) : null,
    recordingError: null,
  };
}

async function reloadProjectAfterApply(input: {
  supabase: SupabaseServerClient;
  userId: string;
  projectId: string;
}): Promise<ProjectRow | null> {
  const { data, error } = await input.supabase
    .from("projects")
    .select(
      `
      id,
      user_id,
      client_id,
      client_name,
      contact_name,
      title,
      summary,
      amount,
      amount_value,
      currency_code,
      deadline_text,
      deadline_date,
      priority,
      status,
      source,
      raw_input,
      created_at,
      updated_at,
      completed_at,
      is_archived,
      archived_at,
      deleted_at,
      clients:clients (
        id,
        name,
        contact_name,
        phone,
        email,
        notes,
        created_at
      )
    `
    )
    .eq("id", input.projectId)
    .eq("user_id", input.userId)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    console.warn(
      "Could not reload project after applying client update:",
      error?.message || "Project not found"
    );
    return null;
  }

  const project = data as ProjectRow & { clients?: ProjectClientRow | ProjectClientRow[] | null };
  const client = Array.isArray(project.clients)
    ? project.clients[0] ?? null
    : project.clients ?? null;
  const { clients, ...cleanProject } = {
    ...project,
    client,
  };

  return cleanProject as ProjectRow;
}

async function reloadProjectTasksAfterApply(input: {
  supabase: SupabaseServerClient;
  userId: string;
  projectId: string;
}): Promise<ProjectTaskSnapshotRow[]> {
  try {
    return await loadDashboardTasksForUser({
      supabase: input.supabase,
      userId: input.userId,
      view: "active",
      projectId: input.projectId,
    });
  } catch (error) {
    console.warn(
      "Could not reload project task snapshot after applying client update:",
      error instanceof Error ? error.message : "Task snapshot reload failed"
    );
    return [];
  }
}

async function reloadActiveDashboardTasksAfterApply(input: {
  supabase: SupabaseServerClient;
  userId: string;
}): Promise<ProjectTaskSnapshotRow[]> {
  try {
    return await loadDashboardTasksForUser({
      supabase: input.supabase,
      userId: input.userId,
      view: "active",
    });
  } catch (error) {
    console.warn(
      "Could not reload active dashboard task snapshot after applying client update:",
      error instanceof Error
        ? error.message
        : "Dashboard task snapshot reload failed"
    );
    return [];
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "Invalid JSON request body.",
      },
      { status: 400, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const parsedBody = ApplyProjectUpdateRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "Invalid project update apply request.",
        details: parsedBody.error.flatten(),
      },
      { status: 400, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const { projectUpdateId, acceptedItemIds, rejectedItemIds, editedItems } = parsedBody.data;

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "You must be signed in to apply project updates.",
      },
      { status: 401, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const uniqueAcceptedIds = Array.from(new Set(acceptedItemIds));
  const uniqueRejectedIds = Array.from(new Set(rejectedItemIds));
  const duplicateIds = uniqueAcceptedIds.filter((id) => uniqueRejectedIds.includes(id));

  if (duplicateIds.length > 0) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "The same update item cannot be both accepted and rejected.",
        details: { duplicateIds },
      },
      { status: 400, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const loaded = await loadProjectUpdateForApply({
    supabase,
    projectUpdateId,
    userId: user.id,
  });

  if (!loaded.ok) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: loaded.error,
      },
      { status: loaded.status, headers: dashboardTasksNoStoreHeaders }
    );
  }

  if (loaded.update.status !== "analyzed" && loaded.update.status !== "reviewed") {
    const stateFailure = getProjectUpdateStateFailure(loaded.update);

    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        code: stateFailure.code,
        error: stateFailure.error,
        message: stateFailure.error,
        details: stateFailure.details,
      },
      { status: stateFailure.status, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const acceptedItems = loaded.items.filter((item) => uniqueAcceptedIds.includes(item.id));
  const rejectedItems = loaded.items.filter((item) => uniqueRejectedIds.includes(item.id));

  if (acceptedItems.length !== uniqueAcceptedIds.length) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "One or more accepted update items were not found.",
      },
      { status: 404, headers: dashboardTasksNoStoreHeaders }
    );
  }

  if (rejectedItems.length !== uniqueRejectedIds.length) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: "One or more rejected update items were not found.",
      },
      { status: 404, headers: dashboardTasksNoStoreHeaders }
    );
  }

  let editedOverrides: Map<string, JsonRecord>;

  try {
    editedOverrides = buildValidatedEditedItemOverrides({
      editedItems: editedItems.map((item) => ({
        itemId: item.itemId,
        newValue: item.newValue as JsonRecord,
      })),
      loadedItems: loaded.items,
      acceptedItemIds: new Set(uniqueAcceptedIds),
      rejectedItemIds: new Set(uniqueRejectedIds),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid edited item values.";

    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        error: message,
      },
      { status: 400, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const preflightItemsForApply = applyEditedOverridesToItems({
    items: loaded.items,
    overrides: editedOverrides,
  });
  const preflightAcceptedItems = preflightItemsForApply.filter((item) =>
    uniqueAcceptedIds.includes(item.id)
  );

  try {
    const duplicateSubtask = await findDuplicateAcceptedNewSubtask({
      supabase,
      userId: user.id,
      projectId: loaded.project.id,
      acceptedItems: preflightAcceptedItems,
    });

    if (duplicateSubtask) {
      return NextResponse.json<ApplyProjectUpdateResponse>(
        {
          ok: false,
          code: "duplicate_subtask",
          error:
            "This suggested subtask looks similar to an existing subtask. Edit the title or unselect this change before applying.",
          message:
            "This suggested subtask looks similar to an existing subtask. Edit the title or unselect this change before applying.",
          duplicate: duplicateSubtask,
        },
        { status: 409, headers: dashboardTasksNoStoreHeaders }
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not validate this project update.";

    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        code: "project_update_preflight_failed",
        error: `Could not safely validate this project update: ${message}`,
      },
      { status: 500, headers: dashboardTasksNoStoreHeaders }
    );
  }

  const claim = await claimProjectUpdateForApply({
    supabase,
    projectUpdateId,
    userId: user.id,
  });

  if (!claim.ok) {
    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        code: claim.code,
        error: claim.error,
        message: claim.error,
        details: claim.details,
      },
      { status: claim.status, headers: dashboardTasksNoStoreHeaders }
    );
  }

  let applyStage = "persist_edited_items";

  try {
    const updatedItemsById = await persistEditedItemOverrides({
      supabase,
      userId: user.id,
      projectUpdateId,
      overrides: editedOverrides,
    });
    const itemsForApply = loaded.items.map((item) => updatedItemsById.get(item.id) ?? item);
    const acceptedItemsForApply = itemsForApply.filter((item) =>
      uniqueAcceptedIds.includes(item.id)
    );
    const appliedTimelineResults: Array<ApplyMutationResult & { sourceItemId: string }> = [];

    applyStage = "apply_accepted_items";

    for (const item of acceptedItemsForApply) {
      const result = await applyAcceptedItem({
        supabase,
        userId: user.id,
        project: loaded.project,
        update: claim.update,
        item,
      });

      appliedTimelineResults.push({
        ...result,
        sourceItemId: item.id,
      });
    }

    applyStage = "mark_applied_items";

    const appliedItems = await markItemsApplied({
      supabase,
      userId: user.id,
      itemIds: uniqueAcceptedIds,
    });

    applyStage = "mark_rejected_items";

    const finalRejectedItems = await markItemsRejected({
      supabase,
      userId: user.id,
      itemIds: uniqueRejectedIds,
    });

    applyStage = "insert_timeline_events";

    const timelineEvents = await insertTimelineEvents({
      supabase,
      userId: user.id,
      projectId: loaded.project.id,
      updateId: loaded.update.id,
      events: appliedTimelineResults,
    });

    applyStage = "mark_update_applied";

    const finalUpdate = await markProjectUpdateApplied({
      supabase,
      userId: user.id,
      updateId: loaded.update.id,
      attemptId: claim.attemptId,
    });

    const updatedProject = await reloadProjectAfterApply({
      supabase,
      userId: user.id,
      projectId: loaded.project.id,
    });
    const projectTasks = await reloadProjectTasksAfterApply({
      supabase,
      userId: user.id,
      projectId: loaded.project.id,
    });
    const dashboardTasks = await reloadActiveDashboardTasksAfterApply({
      supabase,
      userId: user.id,
    });

    return NextResponse.json<ApplyProjectUpdateResponse>({
      ok: true,
      update: finalUpdate,
      project: updatedProject,
      projectTasks,
      dashboardTasks,
      appliedItems,
      rejectedItems: finalRejectedItems,
      timelineEvents,
    }, {
      headers: dashboardTasksNoStoreHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown apply error.";
    const errorCode = `project_update_${applyStage}_failed`;

    console.error("Project update apply attempt failed:", {
      updateId: loaded.update.id,
      attemptId: claim.attemptId,
      stage: applyStage,
      error: message,
    });

    const failedState = await markProjectUpdateApplyFailed({
      supabase,
      userId: user.id,
      updateId: loaded.update.id,
      attemptId: claim.attemptId,
      errorCode,
    });
    const recoveryMessage = failedState.recorded
      ? "The update was marked failed and will not be retried automatically. Contact support before trying again."
      : "Text2Task could not record the recovery state. Do not retry this update until support has inspected it.";

    return NextResponse.json<ApplyProjectUpdateResponse>(
      {
        ok: false,
        code: "project_update_apply_failed",
        error: `Could not apply project update: ${message} ${recoveryMessage}`,
        message: recoveryMessage,
        details: {
          applyAttemptId: claim.attemptId,
          applyErrorCode: errorCode,
          failedStateRecorded: failedState.recorded,
          applyFailedAt: failedState.update?.apply_failed_at ?? null,
        },
      },
      { status: 500, headers: dashboardTasksNoStoreHeaders }
    );
  }
}
