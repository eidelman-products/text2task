export type IncomeTaskLike = {
  id: number;
  task: string;
  amount?: string | null;
  deadline?: string | null;
  deadline_date?: string | null;
  deadline_original_text?: string | null;
  status?: string | null;
  client?: {
    id?: string;
    name?: string | null;
  } | null;
};

export type IncomeBarItem = {
  key: "previousMonth" | "thisMonth" | "nextMonth";
  label: string;
  amount: number;
};

export type IncomeByClientItem = {
  clientName: string;
  amount: number;
  taskCount: number;
};

export type IncomeByTaskTypeItem = {
  taskType: string;
  amount: number;
  taskCount: number;
};

export type IncomeAnalyticsResult = {
  timeline: IncomeBarItem[];
  byClient: IncomeByClientItem[];
  byTaskType: IncomeByTaskTypeItem[];
  summary: {
    previousMonth: number;
    thisMonth: number;
    nextMonth: number;
    totalTracked: number;
  };
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(date: Date, months: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + months,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
}

function getResolvedDeadline(task: IncomeTaskLike) {
  const explicit = task.deadline_date?.trim();
  if (explicit) {
    const parsed = new Date(explicit);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const raw =
    task.deadline_original_text?.trim() || task.deadline?.trim() || "";

  if (!raw) return null;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return null;
}

function parseAmountValue(amount?: string | null) {
  const raw = (amount || "").trim();
  if (!raw) return null;

  const cleaned = raw.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!cleaned) return null;

  const value = Number(cleaned[0]);
  if (!Number.isFinite(value)) return null;

  return value;
}

function getClientName(task: IncomeTaskLike) {
  return task.client?.name?.trim() || "Unassigned";
}

function detectTaskType(taskTitle: string) {
  const text = taskTitle.toLowerCase();

  if (text.includes("logo")) return "Logo";
  if (text.includes("banner")) return "Banner";
  if (text.includes("landing")) return "Landing Page";
  if (text.includes("homepage")) return "Homepage";
  if (text.includes("website")) return "Website";
  if (text.includes("ad ")) return "Ads";
  if (text.includes("ads")) return "Ads";
  if (text.includes("creative")) return "Creative";
  if (text.includes("video")) return "Video";
  if (text.includes("edit")) return "Editing";
  if (text.includes("quote")) return "Quote / Proposal";
  if (text.includes("packaging")) return "Packaging";
  if (text.includes("promo")) return "Promo";
  if (text.includes("social")) return "Social Media";

  return "Other";
}

function sortByAmountDesc<T extends { amount: number }>(items: T[]) {
  return [...items].sort((a, b) => b.amount - a.amount);
}

export function getIncomeAnalytics(
  tasks: IncomeTaskLike[]
): IncomeAnalyticsResult {
  const now = new Date();

  const previousMonthStart = startOfMonth(addMonths(now, -1));
  const previousMonthEnd = endOfMonth(addMonths(now, -1));

  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);

  const nextMonthStart = startOfMonth(addMonths(now, 1));
  const nextMonthEnd = endOfMonth(addMonths(now, 1));

  let previousMonth = 0;
  let thisMonth = 0;
  let nextMonth = 0;
  let totalTracked = 0;

  const byClientMap = new Map<
    string,
    { clientName: string; amount: number; taskCount: number }
  >();

  const byTaskTypeMap = new Map<
    string,
    { taskType: string; amount: number; taskCount: number }
  >();

  for (const task of tasks) {
    const amountValue = parseAmountValue(task.amount);
    const resolvedDeadline = getResolvedDeadline(task);

    if (amountValue === null || !resolvedDeadline) {
      continue;
    }

    totalTracked += amountValue;

    if (
      resolvedDeadline >= previousMonthStart &&
      resolvedDeadline <= previousMonthEnd
    ) {
      previousMonth += amountValue;
    }

    if (resolvedDeadline >= thisMonthStart && resolvedDeadline <= thisMonthEnd) {
      thisMonth += amountValue;
    }

    if (resolvedDeadline >= nextMonthStart && resolvedDeadline <= nextMonthEnd) {
      nextMonth += amountValue;
    }

    const clientName = getClientName(task);
    const existingClient = byClientMap.get(clientName) || {
      clientName,
      amount: 0,
      taskCount: 0,
    };

    existingClient.amount += amountValue;
    existingClient.taskCount += 1;
    byClientMap.set(clientName, existingClient);

    const taskType = detectTaskType(task.task || "");
    const existingTaskType = byTaskTypeMap.get(taskType) || {
      taskType,
      amount: 0,
      taskCount: 0,
    };

    existingTaskType.amount += amountValue;
    existingTaskType.taskCount += 1;
    byTaskTypeMap.set(taskType, existingTaskType);
  }

  const byClient = sortByAmountDesc(Array.from(byClientMap.values())).slice(0, 8);
  const byTaskType = sortByAmountDesc(Array.from(byTaskTypeMap.values())).slice(
    0,
    8
  );

  return {
    timeline: [
      {
        key: "previousMonth",
        label: "Previous Month",
        amount: previousMonth,
      },
      {
        key: "thisMonth",
        label: "This Month",
        amount: thisMonth,
      },
      {
        key: "nextMonth",
        label: "Next Month",
        amount: nextMonth,
      },
    ],
    byClient,
    byTaskType,
    summary: {
      previousMonth,
      thisMonth,
      nextMonth,
      totalTracked,
    },
  };
}