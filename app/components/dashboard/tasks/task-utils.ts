import { formatDeadline } from "@/lib/tasks/format-deadline";
import type {
  TaskArchiveView,
  TaskProjectGroup,
  TaskProjectSubtask,
  TaskRow,
} from "./task-types";

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
    contact_name: task.client?.contact_name ?? task.contact_name ?? null,
    client_phone: task.client?.phone ?? task.client_phone ?? null,
    client_email: task.client?.email ?? task.client_email ?? null,
    client_notes: task.client?.notes ?? task.client_notes ?? null,
    project_id: task.project_id ?? null,
    subtask_order: task.subtask_order ?? null,
    is_archived: Boolean(task.is_archived),
  };
}

export function formatCreatedDate(value?: string | null) {
  if (!value) return "Created —";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Created —";

  const date = parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const time = parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `Created ${date} · ${time}`;
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

export function getContactDisplayName(task: TaskRow) {
  return (
    task.client?.contact_name?.trim() ||
    task.contact_name?.trim() ||
    ""
  );
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
  if (view === "archived") return "Archived Projects";
  return "Task CRM";
}

export function getViewDescription(view: TaskArchiveView) {
  if (view === "archived") {
    return "Review archived client projects, restore work, or permanently delete items you no longer need.";
  }

  return "Manage clients, projects, subtasks, deadlines, and status in one clean workspace.";
}

export function getTaskProjectKey(task: TaskRow) {
  if (task.project_id) {
    return `project::${task.project_id}`;
  }

  const clientName = getClientDisplayName(task).toLowerCase().trim();
  const rawInput = (task.raw_input || "").toLowerCase().trim();
  const source = (task.source || "").toLowerCase().trim();

  if (rawInput) {
    return `${clientName || "unassigned"}::${simpleStringHash(rawInput)}`;
  }

  const createdDay = task.created_at
    ? task.created_at.slice(0, 10)
    : "unknown-date";

  const fallbackSignature = [
    clientName || "unassigned",
    source || "manual",
    createdDay,
    task.deadline_date || task.deadline || "no-deadline",
    task.amount || "no-amount",
  ].join("::");

  return fallbackSignature;
}

export function buildTaskProjectGroups(tasks: TaskRow[]): TaskProjectGroup[] {
  const groups = new Map<string, TaskRow[]>();

  for (const task of tasks) {
    const normalizedTask = normalizeTask(task);
    const key = getTaskProjectKey(normalizedTask);
    const existing = groups.get(key) || [];

    existing.push(normalizedTask);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([key, groupTasks]) =>
    buildSingleTaskProjectGroup(key, groupTasks)
  );
}

function buildSingleTaskProjectGroup(
  key: string,
  rawTasks: TaskRow[]
): TaskProjectGroup {
  const tasks = [...rawTasks].sort((a, b) => {
    const orderA = a.subtask_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.subtask_order ?? Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) return orderA - orderB;

    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;

    if (createdA !== createdB) return createdA - createdB;

    return a.id - b.id;
  });

  const primaryTask = choosePrimaryTask(tasks);
  const project = getBestProject(tasks);
  const projectId = project?.id || getProjectId(tasks);
  const clientName =
    project?.client_name?.trim() ||
    getClientDisplayName(primaryTask);
  const contactName =
    project?.contact_name?.trim() ||
    getBestContactName(tasks);
  const rawInput =
    project?.raw_input?.trim() ||
    tasks.find((task) => task.raw_input)?.raw_input ||
    "";

  const subtasks: TaskProjectSubtask[] = tasks.map((task) => ({
    id: task.id,
    project_id: task.project_id || projectId,
    title: cleanTaskTitle(task.task),
    status: task.status || "New",
    priority: task.priority || "Medium",
    amount: task.amount || "",
    deadline: task.deadline || "",
    deadline_date: task.deadline_date,
    deadline_original_text: task.deadline_original_text,
    created_at: task.created_at,
    completed_at: task.completed_at,
    is_archived: task.is_archived,
    archived_at: task.archived_at,
    deleted_at: task.deleted_at,
  }));

  const completedSubtaskCount = subtasks.filter(
    (subtask) =>
      String(subtask.status || "").trim().toLowerCase() === "done" ||
      Boolean(subtask.completed_at)
  ).length;

  const contact = getBestContactDetails(tasks);
  const amount = getCleanProjectAmount(project, tasks, rawInput);
  const deadlineTask = chooseProjectDeadlineTask(tasks);
  const projectDeadline = getProjectDeadlineFromEntity(project);

  return {
    key,
    project_id: projectId,
    project,

    clientName,
    contactName,
    contact_name: contactName,
    projectTitle:
      project?.title?.trim() || getProjectTitle(tasks, rawInput),
    projectSummary:
      project?.summary?.trim() || getProjectSummary(tasks, rawInput),
    tasks,
    subtasks,
    primaryTask,
    taskIds: tasks.map((task) => task.id),

    amount,
    deadline:
      projectDeadline.deadline ||
      deadlineTask.deadline ||
      primaryTask.deadline ||
      "",
    deadline_date:
      projectDeadline.deadline_date ||
      deadlineTask.deadline_date ||
      primaryTask.deadline_date,
    deadline_original_text:
      projectDeadline.deadline_original_text ||
      deadlineTask.deadline_original_text ||
      primaryTask.deadline_original_text ||
      null,

    priority: project?.priority?.trim() || getProjectPriority(tasks),
    status: project?.status?.trim() || getProjectStatus(tasks),
    source: project?.source?.trim() || primaryTask.source || "",

    created_at:
      project?.created_at ||
      getEarliestTaskCreatedAt(tasks) ||
      primaryTask.created_at,
    updated_at:
      project?.updated_at ||
      getLatestTaskUpdatedAt(tasks) ||
      primaryTask.updated_at ||
      null,
    completed_at:
      project?.completed_at ||
      (completedSubtaskCount === subtasks.length && subtasks.length > 0
        ? primaryTask.completed_at || new Date().toISOString()
        : primaryTask.completed_at || null),
    is_archived:
      typeof project?.is_archived === "boolean"
        ? project.is_archived
        : tasks.every((task) => Boolean(task.is_archived)),
    archived_at: project?.archived_at || primaryTask.archived_at || null,
    deleted_at: project?.deleted_at || primaryTask.deleted_at || null,

    client_phone: contact.phone,
    client_email: contact.email,
    client_notes: contact.notes,

    hasContactDetails: Boolean(
      contactName || contact.phone || contact.email || contact.notes
    ),
    subtaskCount: subtasks.length,
    completedSubtaskCount,
  };
}

function getProjectId(tasks: TaskRow[]) {
  return tasks.find((task) => task.project_id)?.project_id || null;
}

function getBestProject(tasks: TaskRow[]) {
  return tasks.find((task) => task.project && task.project.id)?.project || null;
}

function getEarliestTaskCreatedAt(tasks: TaskRow[]) {
  let earliest: { value: string; time: number } | null = null;

  for (const task of tasks) {
    if (!task.created_at) continue;

    const time = new Date(task.created_at).getTime();
    if (Number.isNaN(time)) continue;

    if (!earliest || time < earliest.time) {
      earliest = { value: task.created_at, time };
    }
  }

  return earliest?.value || null;
}

function getLatestTaskUpdatedAt(tasks: TaskRow[]) {
  let latest: { value: string; time: number } | null = null;

  for (const task of tasks) {
    const value = task.updated_at || task.created_at;
    if (!value) continue;

    const time = new Date(value).getTime();
    if (Number.isNaN(time)) continue;

    if (!latest || time > latest.time) {
      latest = { value, time };
    }
  }

  return latest?.value || null;
}

function getProjectDeadlineFromEntity(
  project: NonNullable<TaskRow["project"]> | null
) {
  if (!project) {
    return {
      deadline: "",
      deadline_date: null,
      deadline_original_text: null,
    };
  }

  const deadlineText = project.deadline_text?.trim() || "";
  const deadlineDate = project.deadline_date?.trim() || null;

  const formattedDeadline =
    formatDeadline(deadlineText, deadlineDate) ||
    deadlineText ||
    (deadlineDate ? formatDeadline(deadlineDate) : "") ||
    "";

  return {
    deadline: formattedDeadline,
    deadline_date: deadlineDate,
    deadline_original_text: deadlineText || null,
  };
}

function choosePrimaryTask(tasks: TaskRow[]) {
  const activeTasks = tasks.filter((task) => !task.deleted_at);

  const highPriorityTask = activeTasks.find(
    (task) => String(task.priority || "").toLowerCase() === "high"
  );

  if (highPriorityTask) return highPriorityTask;

  const earliestDeadlineTask = chooseProjectDeadlineTask(activeTasks);
  if (earliestDeadlineTask) return earliestDeadlineTask;

  return activeTasks[0] || tasks[0];
}

function chooseProjectDeadlineTask(tasks: TaskRow[]) {
  if (!tasks.length) return {} as TaskRow;

  return [...tasks].sort(
    (a, b) => getDeadlineSortValue(a) - getDeadlineSortValue(b)
  )[0];
}

function getBestContactName(tasks: TaskRow[]) {
  for (const task of tasks) {
    const contactName =
      task.client?.contact_name?.trim() ||
      task.contact_name?.trim() ||
      "";

    if (contactName) return contactName;
  }

  return null;
}

function getBestContactDetails(tasks: TaskRow[]) {
  for (const task of tasks) {
    const phone = task.client?.phone || task.client_phone || null;
    const email = task.client?.email || task.client_email || null;
    const notes = task.client?.notes || task.client_notes || null;

    if (phone || email || notes) {
      return { phone, email, notes };
    }
  }

  return {
    phone: null,
    email: null,
    notes: null,
  };
}

function getProjectPriority(tasks: TaskRow[]) {
  const priorities = tasks.map((task) =>
    String(task.priority || "").trim().toLowerCase()
  );

  if (priorities.includes("high")) return "High";
  if (priorities.includes("urgent")) return "High";
  if (priorities.includes("medium")) return "Medium";
  if (priorities.includes("low")) return "Low";

  return "Medium";
}

function getProjectStatus(tasks: TaskRow[]) {
  const statuses = tasks.map((task) =>
    String(task.status || "").trim().toLowerCase()
  );

  if (statuses.length && statuses.every((status) => status === "done")) {
    return "Done";
  }

  if (
    statuses.includes("in progress") ||
    statuses.includes("in-progress") ||
    statuses.includes("working")
  ) {
    return "In Progress";
  }

  if (statuses.includes("review")) {
    return "Review";
  }

  if (statuses.includes("urgent")) {
    return "Urgent";
  }

  if (statuses.includes("done")) {
    return "In Progress";
  }

  return tasks[0]?.status || "New";
}

function getProjectTitle(tasks: TaskRow[], rawInput: string) {
  const text = `${rawInput} ${tasks.map((task) => task.task).join(" ")}`
    .toLowerCase()
    .trim();

  if (
    text.includes("homepage banner") ||
    text.includes("email header") ||
    text.includes("product launch") ||
    text.includes("promo captions")
  ) {
    return "Product launch design package";
  }

  if (text.includes("product video") || text.includes("video editing")) {
    return "Product video editing package";
  }

  if (text.includes("landing page")) {
    return "Landing page project";
  }

  if (
    text.includes("logo") ||
    text.includes("instagram story templates") ||
    text.includes("linkedin banner")
  ) {
    return "Brand assets package";
  }

  if (
    text.includes("social media") ||
    text.includes("instagram posts") ||
    text.includes("reels") ||
    text.includes("story slides") ||
    text.includes("hashtags") ||
    text.includes("captions") ||
    text.includes("iced latte")
  ) {
    return "Social media content package";
  }

  if (
    text.includes("website") ||
    text.includes("homepage") ||
    text.includes("testimonials") ||
    text.includes("contact form")
  ) {
    return "Website revision package";
  }

  if (
    text.includes("client follow-ups") ||
    text.includes("spreadsheet") ||
    text.includes("response drafts") ||
    text.includes("client records") ||
    text.includes("overdue invoices") ||
    text.includes("follow-up email template")
  ) {
    return "Admin support package";
  }

  const firstTask = cleanTaskTitle(tasks[0]?.task || "");

  if (!firstTask) return "Client project";

  return firstTask.length > 72 ? `${firstTask.slice(0, 69)}...` : firstTask;
}

function getProjectSummary(tasks: TaskRow[], rawInput: string) {
  const cleanTitles = tasks
    .map((task) => cleanTaskTitle(task.task))
    .filter(Boolean);

  if (cleanTitles.length === 0) {
    return rawInput ? compactText(rawInput, 120) : "Structured client work";
  }

  if (cleanTitles.length === 1) {
    return cleanTitles[0];
  }

  const firstThree = cleanTitles.slice(0, 3).join(", ");
  const remaining = cleanTitles.length - 3;

  return remaining > 0
    ? `${firstThree} + ${remaining} more`
    : firstThree;
}

function cleanTaskTitle(value: string) {
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[-•\d.)\s]+/, "")
    .trim();

  if (!cleaned) return "Untitled task";

  return cleaned;
}

function compactText(value: string, maxLength: number) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength - 3)}...`;
}

function getProjectAmount(tasks: TaskRow[], rawInput: string) {
  const amountFromRawInput = extractBudgetFromRawInput(rawInput);

  if (amountFromRawInput) {
    return amountFromRawInput;
  }

  const parsedAmounts = tasks
    .map((task) => parseAmountValue(task.amount))
    .filter((item): item is ParsedAmount => Boolean(item));

  if (!parsedAmounts.length) {
    return tasks.find((task) => task.amount)?.amount || "";
  }

  const currencies = Array.from(
    new Set(parsedAmounts.map((amount) => amount.currency))
  );

  if (currencies.length > 1) {
    return tasks.find((task) => task.amount)?.amount || "";
  }

  const uniqueAmounts = Array.from(
    new Set(parsedAmounts.map((amount) => `${amount.value}-${amount.currency}`))
  );

  if (uniqueAmounts.length === 1) {
    const first = parsedAmounts[0];
    return `${formatNumberWithoutNoise(first.value)} ${first.currency}`;
  }

  const total = parsedAmounts.reduce((sum, item) => sum + item.value, 0);
  const rounded = roundCurrency(total);
  const currency = currencies[0] || "USD";

  return `${formatNumberWithoutNoise(rounded)} ${currency}`;
}

function getCleanProjectAmount(
  project: NonNullable<TaskRow["project"]> | null,
  tasks: TaskRow[],
  rawInput: string
) {
  const structuredAmount = formatStructuredAmount(
    project?.amount_value,
    project?.currency_code
  );

  if (structuredAmount) return structuredAmount;

  if (isSafeDisplayAmount(project?.amount)) {
    return String(project?.amount || "").trim();
  }

  return getProjectAmount(tasks, rawInput);
}

function formatStructuredAmount(value?: number | null, currency?: string | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }

  const formattedValue = value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const cleanCurrency = String(currency || "USD").trim().toUpperCase();

  return `${formattedValue} ${cleanCurrency}`;
}

function isSafeDisplayAmount(value?: string | null) {
  const clean = String(value || "").trim();

  if (!clean) return false;

  const numberMatches = clean.match(/\d[\d,]*(?:\.\d+)?/g) || [];
  const normalizedNumbers = numberMatches
    .map((match) => Number(match.replace(/,/g, "")))
    .filter((amount) => Number.isFinite(amount));

  const seen = new Set<number>();

  for (const amount of normalizedNumbers) {
    if (seen.has(amount)) return false;
    seen.add(amount);
  }

  return true;
}

function extractBudgetFromRawInput(rawInput: string) {
  if (!rawInput) return "";

  const budgetPattern =
    /(?:budget(?:\s+is|:)?|around|for this batch)\s*(?:is\s*)?(?:around\s*)?([$€£₪]?\s*[\d,]+(?:\.\d{1,2})?)\s*(usd|eur|gbp|ils|nis|shekels?)?/i;

  const match = rawInput.match(budgetPattern);

  if (!match) return "";

  const value = parseFloat(String(match[1]).replace(/[^\d.]/g, ""));
  if (Number.isNaN(value)) return "";

  const currency = normalizeCurrency(match[1], match[2]);

  return `${formatNumberWithoutNoise(value)} ${currency}`;
}

type ParsedAmount = {
  value: number;
  currency: string;
};

function parseAmountValue(value: string): ParsedAmount | null {
  if (!value) return null;

  const amount = parseFloat(String(value).replace(/[^\d.]/g, ""));
  if (Number.isNaN(amount)) return null;

  return {
    value: amount,
    currency: normalizeCurrency(value),
  };
}

function normalizeCurrency(value?: string | null, explicitCurrency?: string) {
  const raw = `${value || ""} ${explicitCurrency || ""}`.toLowerCase();

  if (raw.includes("€") || raw.includes("eur")) return "EUR";
  if (raw.includes("£") || raw.includes("gbp")) return "GBP";
  if (
    raw.includes("₪") ||
    raw.includes("ils") ||
    raw.includes("nis") ||
    raw.includes("shekel")
  ) {
    return "ILS";
  }

  return "USD";
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatNumberWithoutNoise(value: number) {
  if (Number.isInteger(value)) {
    return value.toLocaleString("en-US");
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function simpleStringHash(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}
