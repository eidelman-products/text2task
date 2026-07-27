import type { TaskRow } from "./tasks-view";
import type { ProjectEntity } from "./tasks/task-types";
import { formatDeadline } from "@/lib/tasks/format-deadline";
import { getDashboardAlerts } from "@/lib/tasks/get-dashboard-alerts";

export type DashboardUrgencyTone = "overdue" | "today" | "tomorrow" | "soon";

export type UrgentPreviewTask = {
  id: number;
  task: string;
  clientName: string;
  deadlineLabel: string;
  usesProjectDeadline: boolean;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function pickString(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return "";
}

function pickStringOrNull(...candidates: unknown[]): string | null {
  return pickString(...candidates) || null;
}

/** Preserves an empty-string value rather than treating it as absent. */
function firstTypedString<T>(
  candidates: unknown[],
  fallback: T
): string | T {
  for (const candidate of candidates) {
    if (typeof candidate === "string") return candidate;
  }
  return fallback;
}

/**
 * Raw API rows for a task (and its embedded client/project) are untrusted
 * JSON from `/api/tasks` and `/api/tasks/snapshot` -- every field is read
 * defensively and coerced to TaskRow's real shape rather than assumed.
 */
export function normalizeTaskFromApi(rawItem: unknown): TaskRow {
  const item = asRecord(rawItem);
  const client = asRecord(item.client);

  const rawDeadlineText = firstTypedString(
    [item.deadline_text, item.deadline_original_text],
    ""
  );
  const rawDeadlineDate = firstTypedString([item.deadline_date], null);

  const displayDeadline =
    formatDeadline(rawDeadlineText, rawDeadlineDate) ||
    rawDeadlineText ||
    (rawDeadlineDate ? formatDeadline(rawDeadlineDate) : "") ||
    "";

  const clientId = pickString(client.id, item.client_id);
  const clientName = pickString(
    client.name,
    item.client_name,
    item.clientName
  ) || "Unassigned";

  const contactName = pickStringOrNull(
    client.contact_name,
    item.contact_name,
    item.contactName
  );

  const clientPhone = pickStringOrNull(
    client.phone,
    item.client_phone,
    item.clientPhone
  );

  const clientEmail = pickStringOrNull(
    client.email,
    item.client_email,
    item.clientEmail
  );

  const clientNotes = pickStringOrNull(
    client.notes,
    item.client_notes,
    item.clientNotes
  );

  const rawProjectValue = item.project ?? item.projects;
  const hasProject = isRecord(rawProjectValue);
  const rawProject = asRecord(rawProjectValue);

  const project = hasProject
    ? {
        id: pickString(rawProject.id, item.project_id),
        client_id: pickStringOrNull(rawProject.client_id),
        client_name: pickStringOrNull(rawProject.client_name),
        contact_name: pickStringOrNull(rawProject.contact_name),
        title: pickStringOrNull(rawProject.title),
        summary: pickStringOrNull(rawProject.summary),
        amount:
          rawProject.amount !== null && rawProject.amount !== undefined
            ? String(rawProject.amount)
            : null,
        amount_value:
          typeof rawProject.amount_value === "number"
            ? rawProject.amount_value
            : null,
        currency_code: pickStringOrNull(rawProject.currency_code),
        deadline_text: pickStringOrNull(rawProject.deadline_text),
        deadline_date: pickStringOrNull(rawProject.deadline_date),
        priority: pickStringOrNull(rawProject.priority),
        priority_source: pickStringOrNull(rawProject.priority_source) as
          | ProjectEntity["priority_source"]
          | null,
        status: pickStringOrNull(rawProject.status),
        source: pickStringOrNull(rawProject.source),
        raw_input: pickStringOrNull(rawProject.raw_input),
        created_at: pickStringOrNull(rawProject.created_at),
        updated_at: pickStringOrNull(rawProject.updated_at),
        completed_at: pickStringOrNull(rawProject.completed_at),
        is_archived:
          typeof rawProject.is_archived === "boolean"
            ? rawProject.is_archived
            : null,
        archived_at: pickStringOrNull(rawProject.archived_at),
        deleted_at: pickStringOrNull(rawProject.deleted_at),
      }
    : null;

  const rawStatus = item.status;

  return {
    id: typeof item.id === "number" ? item.id : Number(item.id),

    client: clientName
      ? {
          id: clientId,
          name: clientName,
          contact_name: contactName,
          phone: clientPhone,
          email: clientEmail,
          notes: clientNotes,
        }
      : null,

    project,

    task: pickString(item.task, item.task_title),
    amount:
      item.amount !== null && item.amount !== undefined
        ? String(item.amount)
        : "",

    deadline: displayDeadline,
    deadline_date: rawDeadlineDate,
    deadline_original_text: rawDeadlineText || null,

    priority: pickString(item.priority) || "Medium",
    status: rawStatus === "Not Started" ? "New" : pickString(rawStatus) || "New",

    source: pickString(item.source) || "Pasted text",
    raw_input: pickString(item.raw_input),

    created_at: pickStringOrNull(item.created_at),
    updated_at: pickStringOrNull(item.updated_at),
    completed_at: pickStringOrNull(item.completed_at),
    is_archived: Boolean(item.is_archived),
    archived_at: pickStringOrNull(item.archived_at),
    deleted_at: pickStringOrNull(item.deleted_at),

    contact_name: contactName,
    client_phone: clientPhone,
    client_email: clientEmail,
    client_notes: clientNotes,

    project_id: pickStringOrNull(item.project_id) || project?.id || null,
    subtask_order:
      typeof item.subtask_order === "number" ? item.subtask_order : null,
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
  const alerts = getDashboardAlerts(tasks);
  const buckets: Array<{
    tone: DashboardUrgencyTone;
    items: typeof alerts.overdue;
  }> = [
    { tone: "overdue", items: alerts.overdue },
    { tone: "today", items: alerts.dueToday },
    { tone: "tomorrow", items: alerts.dueTomorrow },
    { tone: "soon", items: alerts.dueSoon },
  ];

  return buckets.flatMap(({ tone, items }) =>
    items.map((item) => ({
      id: item.id,
      task: item.taskTitle,
      clientName: item.clientName,
      deadlineLabel: item.deadlineLabel,
      usesProjectDeadline: item.usesProjectDeadline,
      tone,
      sortTime: item.deadlineDate
        ? new Date(item.deadlineDate).getTime()
        : Number.MAX_SAFE_INTEGER,
    }))
  );
}

export function getPaidCompletedProgress(
  tasks: TaskRow[]
): PaidCompletedProgress {
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
    tone: percentChange > 0 ? "green" : percentChange < 0 ? "red" : "slate",
    arrowSymbol: percentChange > 0 ? "↑" : percentChange < 0 ? "↓" : "•",
  };
}
