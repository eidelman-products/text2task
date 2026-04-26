import type { TaskRow } from "./tasks-view";
import { formatDeadline } from "@/lib/tasks/format-deadline";
import { getDeadlineUi } from "@/lib/tasks/get-deadline-ui";

export type DashboardUrgencyTone = "overdue" | "today" | "tomorrow" | "soon";

export type UrgentPreviewTask = {
  id: number;
  task: string;
  clientName: string;
  deadlineLabel: string;
  tone: DashboardUrgencyTone;
  sortTime: number;
};

export type PaidCompletedProgress = {
  thisMonthCount: number;
  previousMonthCount: number;
  percentChange: number | null;
  displayValue: string;
  helper: string;
  tone: "green" | "red" | "slate";
  arrowSymbol: "↑" | "↓" | "•";
};

export function getClientDisplayName(task: TaskRow) {
  return task.client?.name?.trim() || "Unassigned";
}

export function normalizeTaskFromApi(item: any): TaskRow {
  const rawDeadlineText =
    typeof item.deadline_text === "string" ? item.deadline_text : "";
  const rawDeadlineDate =
    typeof item.deadline_date === "string" ? item.deadline_date : null;

  const displayDeadline =
    formatDeadline(rawDeadlineText, rawDeadlineDate) ||
    rawDeadlineText ||
    (rawDeadlineDate ? formatDeadline(rawDeadlineDate) : "") ||
    "";

  return {
    id: item.id,
    client: item.client
      ? {
          id: item.client.id,
          name: item.client.name,
          phone: item.client.phone ?? null,
          email: item.client.email ?? null,
          notes: item.client.notes ?? null,
        }
      : null,
    task: item.task_title || "",
    amount:
      item.amount !== null && item.amount !== undefined
        ? String(item.amount)
        : "",
    deadline: displayDeadline,
    deadline_date: rawDeadlineDate,
    deadline_original_text: rawDeadlineText || null,
    priority: item.priority || "Medium",
    status: item.status || "New",
    source: item.source || "Pasted text",
    raw_input: item.raw_input || "",
    created_at: item.created_at || null,
    client_phone: item.client?.phone ?? null,
    client_email: item.client?.email ?? null,
    client_notes: item.client?.notes ?? null,
  };
}

export function buildTaskCopyText(task: TaskRow) {
  return [
    `Client: ${getClientDisplayName(task)}`,
    `Task: ${task.task || "—"}`,
    `Amount: ${task.amount || "—"}`,
    `Deadline: ${task.deadline || "—"}`,
    `Phone: ${task.client?.phone || task.client_phone || "—"}`,
    `Email: ${task.client?.email || task.client_email || "—"}`,
    `Notes: ${task.client?.notes || task.client_notes || "—"}`,
    `Priority: ${task.priority || "—"}`,
    `Status: ${task.status || "—"}`,
  ].join("\n");
}

export function escapeCsvValue(value: string) {
  const safeValue = value ?? "";

  if (
    safeValue.includes(",") ||
    safeValue.includes('"') ||
    safeValue.includes("\n")
  ) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }

  return safeValue;
}

export function getStatusToneBg(
  tone: "slate" | "red" | "orange" | "blue" | "purple" | "green"
) {
  switch (tone) {
    case "red":
      return "rgba(239,68,68,0.16)";
    case "orange":
      return "rgba(249,115,22,0.13)";
    case "blue":
      return "rgba(59,130,246,0.12)";
    case "purple":
      return "rgba(139,92,246,0.12)";
    case "green":
      return "rgba(34,197,94,0.14)";
    case "slate":
    default:
      return "rgba(148,163,184,0.10)";
  }
}

export function getStatusToneColor(
  tone: "slate" | "red" | "orange" | "blue" | "purple" | "green"
) {
  switch (tone) {
    case "red":
      return "#dc2626";
    case "orange":
      return "#d97706";
    case "blue":
      return "#2563eb";
    case "purple":
      return "#7c3aed";
    case "green":
      return "#15803d";
    case "slate":
    default:
      return "#475569";
  }
}

export function getUrgencyBadgeBackground(tone: DashboardUrgencyTone) {
  switch (tone) {
    case "overdue":
      return "linear-gradient(180deg, rgba(254,242,242,0.92) 0%, rgba(255,255,255,0.92) 100%)";
    case "today":
      return "linear-gradient(180deg, rgba(255,247,237,0.94) 0%, rgba(255,255,255,0.92) 100%)";
    case "tomorrow":
      return "linear-gradient(180deg, rgba(255,251,235,0.94) 0%, rgba(255,255,255,0.92) 100%)";
    case "soon":
    default:
      return "linear-gradient(180deg, rgba(239,246,255,0.94) 0%, rgba(255,255,255,0.92) 100%)";
  }
}

export function getUrgencyBadgeBorder(tone: DashboardUrgencyTone) {
  switch (tone) {
    case "overdue":
      return "1px solid rgba(239,68,68,0.16)";
    case "today":
      return "1px solid rgba(245,158,11,0.16)";
    case "tomorrow":
      return "1px solid rgba(245,158,11,0.12)";
    case "soon":
    default:
      return "1px solid rgba(59,130,246,0.14)";
  }
}

export function getUrgencyBadgeColor(tone: DashboardUrgencyTone) {
  switch (tone) {
    case "overdue":
      return "#dc2626";
    case "today":
      return "#d97706";
    case "tomorrow":
      return "#a16207";
    case "soon":
    default:
      return "#2563eb";
  }
}

export function getUrgentTaskAccent(tone: DashboardUrgencyTone) {
  switch (tone) {
    case "overdue":
      return "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)";
    case "today":
      return "linear-gradient(180deg, #f59e0b 0%, #ea580c 100%)";
    case "tomorrow":
      return "linear-gradient(180deg, #fbbf24 0%, #d97706 100%)";
    case "soon":
    default:
      return "linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)";
  }
}

export function getUrgentDeadlineBadgeStyle(
  tone: DashboardUrgencyTone
): React.CSSProperties {
  if (tone === "today") {
    return {
      flexShrink: 0,
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "7px 11px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 900,
      background: "linear-gradient(180deg, #f59e0b 0%, #ea580c 100%)",
      color: "#ffffff",
      border: "1px solid rgba(234,88,12,0.28)",
      boxShadow: "0 10px 22px rgba(249,115,22,0.22)",
    };
  }

  if (tone === "overdue") {
    return {
      flexShrink: 0,
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "7px 11px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 900,
      background: "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)",
      color: "#ffffff",
      border: "1px solid rgba(220,38,38,0.28)",
      boxShadow: "0 10px 22px rgba(239,68,68,0.22)",
    };
  }

  if (tone === "tomorrow") {
    return {
      flexShrink: 0,
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "7px 11px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 900,
      background: "rgba(255,251,235,0.98)",
      color: "#a16207",
      border: "1px solid rgba(245,158,11,0.20)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.92)",
    };
  }

  return {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "7px 11px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    background: "rgba(239,246,255,0.98)",
    color: "#2563eb",
    border: "1px solid rgba(59,130,246,0.16)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.92)",
  };
}

export function buildUrgentPreviewTasks(tasks: TaskRow[]): UrgentPreviewTask[] {
  return tasks
    .map((task) => {
      const deadlineUi = getDeadlineUi(
        task.deadline_original_text?.trim() || task.deadline?.trim() || "",
        task.deadline_date?.trim() || null,
        task.status || null
      );

      if (
        deadlineUi.isDone ||
        deadlineUi.isMissing ||
        !deadlineUi.isParsed ||
        deadlineUi.daysFromNow === null
      ) {
        return null;
      }

      let tone: DashboardUrgencyTone | null = null;

      if (deadlineUi.isOverdue) {
        tone = "overdue";
      } else if (deadlineUi.isDueToday) {
        tone = "today";
      } else if (deadlineUi.isDueTomorrow) {
        tone = "tomorrow";
      } else if (deadlineUi.isDueSoon) {
        tone = "soon";
      }

      if (!tone) return null;

      const sortTime = deadlineUi.deadlineDate
        ? new Date(deadlineUi.deadlineDate).getTime()
        : Number.MAX_SAFE_INTEGER;

      return {
        id: task.id,
        task: task.task || "Untitled task",
        clientName: getClientDisplayName(task),
        deadlineLabel: deadlineUi.label,
        tone,
        sortTime,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const toneOrder: Record<DashboardUrgencyTone, number> = {
        overdue: 0,
        today: 1,
        tomorrow: 2,
        soon: 3,
      };

      if (toneOrder[a!.tone] !== toneOrder[b!.tone]) {
        return toneOrder[a!.tone] - toneOrder[b!.tone];
      }

      return a!.sortTime - b!.sortTime;
    }) as UrgentPreviewTask[];
}

export function getPaidCompletedProgress(tasks: TaskRow[]): PaidCompletedProgress {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const paidCompletedTasks = tasks.filter((task) => {
    const amountNumber = Number(
      String(task.amount || "").replace(/[^0-9.-]/g, "")
    );
    if (task.status !== "Done") return false;
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return false;
    if (!task.created_at) return false;

    const created = new Date(task.created_at);
    return !Number.isNaN(created.getTime());
  });

  const thisMonthCount = paidCompletedTasks.filter((task) => {
    const created = new Date(task.created_at as string);
    return created >= currentMonthStart && created < nextMonthStart;
  }).length;

  const previousMonthCount = paidCompletedTasks.filter((task) => {
    const created = new Date(task.created_at as string);
    return created >= previousMonthStart && created < currentMonthStart;
  }).length;

  if (previousMonthCount <= 0 && thisMonthCount <= 0) {
    return {
      thisMonthCount,
      previousMonthCount,
      percentChange: null,
      displayValue: "—",
      helper: "vs last month",
      tone: "slate",
      arrowSymbol: "•",
    };
  }

  if (previousMonthCount <= 0 && thisMonthCount > 0) {
    return {
      thisMonthCount,
      previousMonthCount,
      percentChange: null,
      displayValue: `+${thisMonthCount}`,
      helper: "vs last month",
      tone: "green",
      arrowSymbol: "↑",
    };
  }

  const percentChange = Math.round(
    ((thisMonthCount - previousMonthCount) / previousMonthCount) * 100
  );

  return {
    thisMonthCount,
    previousMonthCount,
    percentChange,
    displayValue:
      percentChange === 0
        ? "0%"
        : `${percentChange > 0 ? "+" : ""}${percentChange}%`,
    helper: "vs last month",
    tone:
      percentChange > 0 ? "green" : percentChange < 0 ? "red" : "slate",
    arrowSymbol:
      percentChange > 0 ? "↑" : percentChange < 0 ? "↓" : "•",
  };
}