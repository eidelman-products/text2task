import { getDeadlineUi } from "./get-deadline-ui";

export type DashboardTaskLike = {
  id: number;
  task: string;
  project_id?: string | null;
  amount?: string | null;
  deadline?: string | null;
  deadline_date?: string | null;
  deadline_original_text?: string | null;
  priority?: string | null;
  status?: string | null;
  created_at?: string | null;
  is_archived?: boolean | null;
  deleted_at?: string | null;
  client?: {
    id?: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
  } | null;
  project?: {
    id?: string | null;
    title?: string | null;
    amount?: string | null;
    deadline_text?: string | null;
    deadline_date?: string | null;
    priority?: string | null;
    status?: string | null;
    is_archived?: boolean | null;
    deleted_at?: string | null;
  } | null;
};

export type AlertBucketItem = {
  id: number;
  clientName: string;
  taskTitle: string;
  deadlineLabel: string;
  deadlineDate: string | null;
  amount: string;
  priority: string;
  status: string;
  daysFromNow: number | null;
  usesProjectDeadline: boolean;
};

export type DashboardAlertsResult = {
  overdue: AlertBucketItem[];
  dueToday: AlertBucketItem[];
  dueTomorrow: AlertBucketItem[];
  dueSoon: AlertBucketItem[];
  counts: {
    overdue: number;
    dueToday: number;
    dueTomorrow: number;
    dueSoon: number;
    totalAttention: number;
  };
};

type AlertDeadline = {
  deadlineText: string;
  deadlineDate: string | null;
  status: string;
  usesProjectDeadline: boolean;
};

function getClientName(task: DashboardTaskLike) {
  return task.client?.name?.trim() || "Unassigned";
}

function getTaskTitle(task: DashboardTaskLike, usesProjectDeadline: boolean) {
  if (usesProjectDeadline) {
    return (
      task.project?.title?.trim() ||
      (task.task || "").trim() ||
      "Untitled project"
    );
  }

  return (task.task || "").trim() || "Untitled task";
}

function getPriority(task: DashboardTaskLike, usesProjectDeadline: boolean) {
  return (
    (usesProjectDeadline ? task.project?.priority : task.priority)?.trim() ||
    task.priority?.trim() ||
    task.project?.priority?.trim() ||
    "Medium"
  );
}

function getStatus(task: DashboardTaskLike, usesProjectDeadline: boolean) {
  return (
    (usesProjectDeadline ? task.project?.status : task.status)?.trim() ||
    task.status?.trim() ||
    task.project?.status?.trim() ||
    "New"
  );
}

function getAmount(task: DashboardTaskLike, usesProjectDeadline: boolean) {
  return (
    (usesProjectDeadline ? task.project?.amount : task.amount)?.trim() ||
    task.amount?.trim() ||
    task.project?.amount?.trim() ||
    "-"
  );
}

function isDone(value?: string | null) {
  return String(value || "").trim().toLowerCase() === "done";
}

function hasExplicitTaskDeadline(task: DashboardTaskLike) {
  return Boolean(
    task.deadline_original_text?.trim() ||
      task.deadline_date?.trim() ||
      task.deadline?.trim()
  );
}

function getProjectDeadline(task: DashboardTaskLike): AlertDeadline | null {
  if (!task.project) return null;

  const deadlineText = task.project.deadline_text?.trim() || "";
  const deadlineDate = task.project.deadline_date?.trim() || null;

  if (!deadlineText && !deadlineDate) return null;

  return {
    deadlineText,
    deadlineDate,
    status: task.project.status?.trim() || "New",
    usesProjectDeadline: true,
  };
}

function getTaskDeadline(task: DashboardTaskLike): AlertDeadline | null {
  if (!hasExplicitTaskDeadline(task)) return null;

  return {
    deadlineText:
      task.deadline_original_text?.trim() || task.deadline?.trim() || "",
    deadlineDate: task.deadline_date?.trim() || null,
    status:
      isDone(task.status) || isDone(task.project?.status)
        ? "Done"
        : task.status?.trim() || "New",
    usesProjectDeadline: false,
  };
}

function getProjectKey(task: DashboardTaskLike) {
  return task.project_id?.trim() || task.project?.id?.trim() || null;
}

function isExcludedTask(task: DashboardTaskLike) {
  return Boolean(
    task.deleted_at ||
      task.project?.deleted_at ||
      task.is_archived ||
      task.project?.is_archived
  );
}

function toAlertItem(
  task: DashboardTaskLike,
  alertDeadline: AlertDeadline
): AlertBucketItem {
  const deadlineUi = getDeadlineUi(
    alertDeadline.deadlineText,
    alertDeadline.deadlineDate,
    alertDeadline.status
  );

  return {
    id: task.id,
    clientName: getClientName(task),
    taskTitle: getTaskTitle(task, alertDeadline.usesProjectDeadline),
    deadlineLabel: deadlineUi.label,
    deadlineDate: deadlineUi.deadlineDate,
    amount: getAmount(task, alertDeadline.usesProjectDeadline),
    priority: getPriority(task, alertDeadline.usesProjectDeadline),
    status: getStatus(task, alertDeadline.usesProjectDeadline),
    daysFromNow: deadlineUi.daysFromNow,
    usesProjectDeadline: alertDeadline.usesProjectDeadline,
  };
}

function isAttentionDeadline(alertDeadline: AlertDeadline) {
  const deadlineUi = getDeadlineUi(
    alertDeadline.deadlineText,
    alertDeadline.deadlineDate,
    alertDeadline.status
  );

  return (
    !deadlineUi.isDone &&
    !deadlineUi.isMissing &&
    deadlineUi.isParsed &&
    (deadlineUi.isOverdue ||
      deadlineUi.isDueToday ||
      deadlineUi.isDueTomorrow ||
      deadlineUi.isDueSoon)
  );
}

function addAlertToBucket({
  task,
  alertDeadline,
  overdue,
  dueToday,
  dueTomorrow,
  dueSoon,
}: {
  task: DashboardTaskLike;
  alertDeadline: AlertDeadline;
  overdue: AlertBucketItem[];
  dueToday: AlertBucketItem[];
  dueTomorrow: AlertBucketItem[];
  dueSoon: AlertBucketItem[];
}) {
  const deadlineUi = getDeadlineUi(
    alertDeadline.deadlineText,
    alertDeadline.deadlineDate,
    alertDeadline.status
  );
  const item = toAlertItem(task, alertDeadline);

  if (deadlineUi.isOverdue) {
    overdue.push(item);
  } else if (deadlineUi.isDueToday) {
    dueToday.push(item);
  } else if (deadlineUi.isDueTomorrow) {
    dueTomorrow.push(item);
  } else {
    dueSoon.push(item);
  }
}

function sortAttentionItems(a: AlertBucketItem, b: AlertBucketItem) {
  const aDays = a.daysFromNow ?? Number.MAX_SAFE_INTEGER;
  const bDays = b.daysFromNow ?? Number.MAX_SAFE_INTEGER;

  if (aDays !== bDays) return aDays - bDays;

  return a.clientName.localeCompare(b.clientName);
}

export function getDashboardAlerts(
  tasks: DashboardTaskLike[]
): DashboardAlertsResult {
  const overdue: AlertBucketItem[] = [];
  const dueToday: AlertBucketItem[] = [];
  const dueTomorrow: AlertBucketItem[] = [];
  const dueSoon: AlertBucketItem[] = [];
  const seenProjectAlerts = new Set<string>();

  for (const task of tasks) {
    if (isExcludedTask(task)) {
      continue;
    }

    const projectKey = getProjectKey(task);
    const projectDeadline = getProjectDeadline(task);

    if (
      projectKey &&
      !seenProjectAlerts.has(projectKey) &&
      projectDeadline &&
      isAttentionDeadline(projectDeadline)
    ) {
      seenProjectAlerts.add(projectKey);
      addAlertToBucket({
        task,
        alertDeadline: projectDeadline,
        overdue,
        dueToday,
        dueTomorrow,
        dueSoon,
      });
    }

    const taskDeadline = getTaskDeadline(task);

    if (taskDeadline && isAttentionDeadline(taskDeadline)) {
      addAlertToBucket({
        task,
        alertDeadline: taskDeadline,
        overdue,
        dueToday,
        dueTomorrow,
        dueSoon,
      });
    }
  }

  overdue.sort(sortAttentionItems);
  dueToday.sort(sortAttentionItems);
  dueTomorrow.sort(sortAttentionItems);
  dueSoon.sort(sortAttentionItems);

  return {
    overdue,
    dueToday,
    dueTomorrow,
    dueSoon,
    counts: {
      overdue: overdue.length,
      dueToday: dueToday.length,
      dueTomorrow: dueTomorrow.length,
      dueSoon: dueSoon.length,
      totalAttention:
        overdue.length + dueToday.length + dueTomorrow.length + dueSoon.length,
    },
  };
}
