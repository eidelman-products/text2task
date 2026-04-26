import { getDeadlineUi } from "./get-deadline-ui";

export type DashboardTaskLike = {
  id: number;
  task: string;
  amount?: string | null;
  deadline?: string | null;
  deadline_date?: string | null;
  deadline_original_text?: string | null;
  priority?: string | null;
  status?: string | null;
  created_at?: string | null;
  client?: {
    id?: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
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

function getClientName(task: DashboardTaskLike) {
  return task.client?.name?.trim() || "Unassigned";
}

function getTaskTitle(task: DashboardTaskLike) {
  return (task.task || "").trim() || "Untitled task";
}

function getPriority(task: DashboardTaskLike) {
  return (task.priority || "").trim() || "Medium";
}

function getStatus(task: DashboardTaskLike) {
  return (task.status || "").trim() || "New";
}

function getAmount(task: DashboardTaskLike) {
  return (task.amount || "").trim() || "—";
}

function toAlertItem(task: DashboardTaskLike): AlertBucketItem {
  const deadlineUi = getDeadlineUi(
    task.deadline_original_text?.trim() || task.deadline?.trim() || "",
    task.deadline_date?.trim() || null,
    task.status || null
  );

  return {
    id: task.id,
    clientName: getClientName(task),
    taskTitle: getTaskTitle(task),
    deadlineLabel: deadlineUi.label,
    deadlineDate: deadlineUi.deadlineDate,
    amount: getAmount(task),
    priority: getPriority(task),
    status: getStatus(task),
    daysFromNow: deadlineUi.daysFromNow,
  };
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

  for (const task of tasks) {
    const deadlineUi = getDeadlineUi(
      task.deadline_original_text?.trim() || task.deadline?.trim() || "",
      task.deadline_date?.trim() || null,
      task.status || null
    );

    if (deadlineUi.isDone || deadlineUi.isMissing || !deadlineUi.isParsed) {
      continue;
    }

    const item = toAlertItem(task);

    if (deadlineUi.isOverdue) {
      overdue.push(item);
      continue;
    }

    if (deadlineUi.isDueToday) {
      dueToday.push(item);
      continue;
    }

    if (deadlineUi.isDueTomorrow) {
      dueTomorrow.push(item);
      continue;
    }

    if (deadlineUi.isDueSoon) {
      dueSoon.push(item);
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