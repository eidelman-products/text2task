import { formatDeadline } from "@/lib/tasks/format-deadline";
import type { TaskArchiveView, TaskRow } from "./task-types";

export function normalizeTask(task: TaskRow): TaskRow {
  const preciseDeadline = task.deadline_date?.trim() || "";
  const fallbackDeadline = task.deadline?.trim() || "";
  const originalDeadlineText = task.deadline_original_text?.trim() || "";

  const resolvedDeadline = preciseDeadline || fallbackDeadline;
  const formattedDeadline = resolvedDeadline
    ? formatDeadline(resolvedDeadline)
    : "";

  return {
    ...task,
    deadline:
      formattedDeadline || originalDeadlineText || fallbackDeadline || "",
    client_phone: task.client?.phone ?? task.client_phone ?? null,
    client_email: task.client?.email ?? task.client_email ?? null,
    client_notes: task.client?.notes ?? task.client_notes ?? null,
    is_archived: Boolean(task.is_archived),
  };
}

export function formatCreatedDate(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getDeadlineSortValue(task: TaskRow) {
  if (task.deadline_date) {
    const precise = new Date(task.deadline_date).getTime();
    if (!Number.isNaN(precise)) return precise;
  }

  const fallback = new Date(task.deadline).getTime();
  if (!Number.isNaN(fallback)) return fallback;

  return Number.MAX_SAFE_INTEGER;
}

export function getClientName(task: TaskRow) {
  return task.client?.name?.trim() || "";
}

export function getClientDisplayName(task: TaskRow) {
  return task.client?.name?.trim() || "Unassigned";
}

export function getEditableDeadlineValue(task: TaskRow) {
  return task.deadline_original_text?.trim() || task.deadline || "";
}

export function isDoneTask(task: TaskRow) {
  return String(task.status || "").trim().toLowerCase() === "done";
}

export function isCompletedLifetimeTask(task: TaskRow) {
  return isDoneTask(task) || Boolean(task.completed_at);
}

export function isDeletedTask(task: TaskRow) {
  return Boolean(task.deleted_at);
}

export function isArchivedCurrentTask(task: TaskRow) {
  return Boolean(task.is_archived) && !isDeletedTask(task);
}

export function isActiveCurrentTask(task: TaskRow) {
  return !task.is_archived && !isDeletedTask(task);
}

export function getViewTitle(view: TaskArchiveView) {
  if (view === "archived") return "Archived Tasks";
  return "Task CRM";
}

export function getViewDescription(view: TaskArchiveView) {
  if (view === "archived") {
    return "Review archived work, restore tasks, or permanently delete items you no longer need.";
  }

  return "Manage tasks, clients, deadlines, and status in one powerful workspace.";
}