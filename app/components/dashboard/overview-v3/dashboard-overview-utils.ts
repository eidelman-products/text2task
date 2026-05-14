import type { TaskRow } from "../tasks-view";
import type { UrgentPreviewTask } from "../dashboard-helpers";
import { getClientDisplayName } from "../dashboard-helpers";
import type {
  ProjectCardTone,
  ProjectSnapshotItem,
  UrgentBoardNote,
  UrgentNoteTone,
} from "./dashboard-overview-types";

export function getUserDisplayName(email: string) {
  const localPart = email.split("@")[0] || "there";
  const firstPart = localPart.split(/[._-]/)[0] || localPart;

  return firstPart
    .replace(/\d+/g, "")
    .trim()
    .replace(/^./, (char) => char.toUpperCase()) || "there";
}

export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function getRevenueChange(thisMonth: number, previousMonth: number) {
  if (!previousMonth || previousMonth <= 0) return null;
  return Math.round(((thisMonth - previousMonth) / previousMonth) * 100);
}

export function openTaskInNewWindow(taskId: number) {
  if (typeof window === "undefined") return;

  const url = `/dashboard?view=tasks&taskId=${encodeURIComponent(
    String(taskId)
  )}`;

  window.open(url, "_blank", "noopener,noreferrer");
}

export function normalizeStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function normalizePriority(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function isDoneTask(task: TaskRow) {
  return normalizeStatus(task.project?.status || task.status) === "done";
}

export function isHighPriorityTask(task: TaskRow) {
  return normalizePriority(task.project?.priority || task.priority) === "high";
}

export function getTaskTitle(task: TaskRow) {
  return task.task?.trim() || task.project?.title?.trim() || "Untitled task";
}

export function getProjectTitle(task: TaskRow) {
  return task.project?.title?.trim() || task.task?.trim() || "Untitled project";
}

export function getProjectSummary(task: TaskRow) {
  return (
    task.project?.summary?.trim() ||
    task.client_notes?.trim() ||
    task.client?.notes?.trim() ||
    task.task?.trim() ||
    "No project summary yet."
  );
}

export function getProjectAmount(task: TaskRow) {
  return (
    task.project?.amount?.toString().trim() ||
    task.amount?.toString().trim() ||
    "—"
  );
}

export function getProjectDeadline(task: TaskRow) {
  return (
    task.project?.deadline_text?.trim() ||
    task.project?.deadline_date?.trim() ||
    task.deadline_original_text?.trim() ||
    task.deadline?.trim() ||
    task.deadline_date?.trim() ||
    "No deadline"
  );
}

export function getProjectPriority(task: TaskRow) {
  return task.project?.priority?.trim() || task.priority?.trim() || "Medium";
}

export function getProjectStatus(task: TaskRow) {
  return task.project?.status?.trim() || task.status?.trim() || "New";
}

function getProjectCreatedAt(task: TaskRow) {
  return task.project?.created_at || task.created_at || null;
}

function getProjectSortTime(task: TaskRow) {
  const createdAt = getProjectCreatedAt(task);
  const time = createdAt ? new Date(createdAt).getTime() : 0;

  return Number.isNaN(time) ? 0 : time;
}

function isDeletedOrArchived(task: TaskRow) {
  return Boolean(
    task.deleted_at ||
      task.project?.deleted_at ||
      task.is_archived ||
      task.project?.is_archived
  );
}

export function mapUrgentTasksToNotes(
  urgentTasks: UrgentPreviewTask[]
): UrgentBoardNote[] {
  return urgentTasks.slice(0, 6).map((task) => ({
    id: task.id,
    title: task.task || "Untitled task",
    clientName: task.clientName || "Unassigned",
    deadlineLabel: task.deadlineLabel || "Due soon",
    tone: task.tone as UrgentNoteTone,
    openLabel: task.tone === "overdue" ? "Open now" : "Open task",
  }));
}

/**
 * Recent Work = latest work created/added to the CRM.
 *
 * Important:
 * This intentionally uses created_at and does NOT filter out Done work.
 * A completed project can still be recent work if it was added recently.
 *
 * Recent Activity is a different feature and must use updated_at later.
 */
export function getRecentActiveProjects(tasks: TaskRow[]): ProjectSnapshotItem[] {
  const projectMap = new Map<string, TaskRow>();

  for (const task of tasks) {
    if (!task || isDeletedOrArchived(task)) continue;

    const key =
      task.project_id ||
      task.project?.id ||
      `${getClientDisplayName(task)}-${getProjectTitle(task)}`;

    const existing = projectMap.get(key);

    if (!existing) {
      projectMap.set(key, task);
      continue;
    }

    if (getProjectSortTime(task) > getProjectSortTime(existing)) {
      projectMap.set(key, task);
    }
  }

  return Array.from(projectMap.values())
    .sort((a, b) => getProjectSortTime(b) - getProjectSortTime(a))
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      clientName: getClientDisplayName(task),
      title: getProjectTitle(task),
      summary: getProjectSummary(task),
      amount: getProjectAmount(task),
      deadline: getProjectDeadline(task),
      priority: getProjectPriority(task),
      status: getProjectStatus(task),
      tone: getProjectTone(task),
    }));
}

export function getProjectTone(task: TaskRow): ProjectCardTone {
  if (isDoneTask(task)) return "done";
  if (isHighPriorityTask(task)) return "high";

  const status = normalizeStatus(getProjectStatus(task));

  if (status.includes("progress")) return "progress";
  if (status.includes("review")) return "review";

  return "normal";
}

export function getUrgentBoardTitle({
  overdueCount,
  dueTodayCount,
  dueTomorrowCount,
}: {
  overdueCount: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
}) {
  if (overdueCount > 0) return "Start with overdue work";
  if (dueTodayCount > 0) return "Today needs your attention";
  if (dueTomorrowCount > 0) return "Prepare tomorrow’s work";
  return "Your urgent board is calm";
}

export function getUrgentBoardSubtitle({
  overdueCount,
  dueTodayCount,
  dueTomorrowCount,
  dueSoonCount,
}: {
  overdueCount: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  dueSoonCount: number;
}) {
  const total =
    overdueCount + dueTodayCount + dueTomorrowCount + dueSoonCount;

  if (total <= 0) {
    return "No urgent deadlines right now. New deadline-sensitive work will appear here.";
  }

  return `${total} deadline-sensitive item${
    total === 1 ? "" : "s"
  } need attention across your workspace.`;
}