import type { AlertBucketItem } from "@/lib/tasks/get-dashboard-alerts";
import { getDashboardAlerts } from "@/lib/tasks/get-dashboard-alerts";
import type { TaskRow } from "../tasks-view";
import { getTaskProjectKey } from "../tasks/task-utils";

export type PriorityTone = "overdue" | "today" | "tomorrow" | "soon";

export type PriorityProjectGroup = {
  key: string;
  projectId: string | null;
  projectTitle: string;
  clientName: string | null;
  representativeTaskId: number;
  attentionCount: number;
  overdueCount: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  dueSoonCount: number;
  highestTone: PriorityTone;
  earliestSortTime: number;
  hasProjectDeadlineAlert: boolean;
  previewItems: Array<{
    id: number;
    title: string;
    label: string;
    dueText: string | null;
    dueDateText: string | null;
    tone: PriorityTone;
    usesProjectDeadline: boolean;
  }>;
};

export type PriorityProjectSummary = {
  groups: PriorityProjectGroup[];
  projectCount: number;
  totalAttentionCount: number;
};

type PriorityDraftItem = PriorityProjectGroup["previewItems"][number] & {
  sortTime: number;
};

type PriorityDraftGroup = Omit<PriorityProjectGroup, "previewItems"> & {
  previewItems: PriorityDraftItem[];
};

const DEFAULT_PRIORITY_GROUP_LIMIT = 4;

const toneRank: Record<PriorityTone, number> = {
  overdue: 0,
  today: 1,
  tomorrow: 2,
  soon: 3,
};

export function buildPriorityProjectSummary(
  tasks: TaskRow[],
  limit = DEFAULT_PRIORITY_GROUP_LIMIT
): PriorityProjectSummary {
  const taskById = new Map<number, TaskRow>();

  for (const task of tasks) {
    taskById.set(task.id, task);
  }

  const alerts = getDashboardAlerts(tasks);
  const buckets: Array<{
    tone: PriorityTone;
    items: AlertBucketItem[];
  }> = [
    { tone: "overdue", items: alerts.overdue },
    { tone: "today", items: alerts.dueToday },
    { tone: "tomorrow", items: alerts.dueTomorrow },
    { tone: "soon", items: alerts.dueSoon },
  ];
  const groups = new Map<string, PriorityDraftGroup>();

  for (const { tone, items } of buckets) {
    for (const item of items) {
      const task = taskById.get(item.id);

      if (!task) {
        continue;
      }

      const projectId = getProjectId(task);
      const key = projectId ? `project::${projectId}` : getTaskProjectKey(task);
      const sortTime = getItemSortTime(item);
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, {
          key,
          projectId,
          projectTitle: getProjectTitle(task, item),
          clientName: item.clientName || getClientName(task),
          representativeTaskId: item.id,
          attentionCount: 1,
          overdueCount: tone === "overdue" ? 1 : 0,
          dueTodayCount: tone === "today" ? 1 : 0,
          dueTomorrowCount: tone === "tomorrow" ? 1 : 0,
          dueSoonCount: tone === "soon" ? 1 : 0,
          highestTone: tone,
          earliestSortTime: sortTime,
          hasProjectDeadlineAlert: item.usesProjectDeadline,
          previewItems: [toPreviewItem(item, tone, sortTime)],
        });
        continue;
      }

      existing.attentionCount += 1;
      existing.overdueCount += tone === "overdue" ? 1 : 0;
      existing.dueTodayCount += tone === "today" ? 1 : 0;
      existing.dueTomorrowCount += tone === "tomorrow" ? 1 : 0;
      existing.dueSoonCount += tone === "soon" ? 1 : 0;
      existing.hasProjectDeadlineAlert =
        existing.hasProjectDeadlineAlert || item.usesProjectDeadline;
      existing.previewItems.push(toPreviewItem(item, tone, sortTime));

      if (
        isHigherPriority(tone, sortTime, existing.highestTone, existing.earliestSortTime)
      ) {
        existing.highestTone = tone;
        existing.representativeTaskId = item.id;
      }

      if (sortTime < existing.earliestSortTime) {
        existing.earliestSortTime = sortTime;
      }
    }
  }

  const sortedGroups = Array.from(groups.values()).sort(sortGroups);
  const displayGroups = sortedGroups.map((group) => ({
    ...group,
    previewItems: group.previewItems.sort(sortPreviewItems).map((item) => {
      const { sortTime, ...previewItem } = item;
      void sortTime;
      return previewItem;
    }),
  }));

  return {
    groups: displayGroups.slice(0, limit),
    projectCount: displayGroups.length,
    totalAttentionCount: displayGroups.reduce(
      (total, group) => total + group.attentionCount,
      0
    ),
  };
}

function getProjectId(task: TaskRow) {
  return task.project_id?.trim() || task.project?.id?.trim() || null;
}

function getClientName(task: TaskRow) {
  return task.client?.name?.trim() || "Unassigned";
}

function getProjectTitle(task: TaskRow, item: AlertBucketItem) {
  return (
    task.project?.title?.trim() ||
    (item.usesProjectDeadline ? item.taskTitle?.trim() : "") ||
    task.task?.trim() ||
    "Untitled project"
  );
}

function getItemSortTime(item: AlertBucketItem) {
  if (item.deadlineDate) {
    const parsed = new Date(item.deadlineDate).getTime();

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  if (typeof item.daysFromNow === "number") {
    return item.daysFromNow;
  }

  return Number.MAX_SAFE_INTEGER;
}

function toPreviewItem(
  item: AlertBucketItem,
  tone: PriorityTone,
  sortTime: number
): PriorityDraftItem {
  return {
    id: item.id,
    title: item.taskTitle || "Untitled work",
    label: item.usesProjectDeadline ? "Client delivery" : "Task",
    dueText: item.deadlineLabel || null,
    dueDateText: formatShortDueDate(item.deadlineDate),
    tone,
    usesProjectDeadline: item.usesProjectDeadline,
    sortTime,
  };
}

function formatShortDueDate(value: string | null) {
  if (!value) return null;

  const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return `${month}/${day}/${year.slice(-2)}`;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  }).format(parsed);
}

function isHigherPriority(
  nextTone: PriorityTone,
  nextSortTime: number,
  currentTone: PriorityTone,
  currentSortTime: number
) {
  const nextRank = toneRank[nextTone];
  const currentRank = toneRank[currentTone];

  if (nextRank !== currentRank) {
    return nextRank < currentRank;
  }

  return nextSortTime < currentSortTime;
}

function sortPreviewItems(a: PriorityDraftItem, b: PriorityDraftItem) {
  const toneCompare = toneRank[a.tone] - toneRank[b.tone];

  if (toneCompare !== 0) return toneCompare;
  if (a.sortTime !== b.sortTime) return a.sortTime - b.sortTime;

  return a.title.localeCompare(b.title);
}

function sortGroups(a: PriorityDraftGroup, b: PriorityDraftGroup) {
  const toneCompare = toneRank[a.highestTone] - toneRank[b.highestTone];

  if (toneCompare !== 0) return toneCompare;
  if (a.earliestSortTime !== b.earliestSortTime) {
    return a.earliestSortTime - b.earliestSortTime;
  }

  const clientCompare = (a.clientName || "").localeCompare(b.clientName || "");

  if (clientCompare !== 0) return clientCompare;

  return a.projectTitle.localeCompare(b.projectTitle);
}
