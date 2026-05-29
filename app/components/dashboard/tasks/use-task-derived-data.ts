import { useMemo } from "react";
import type { TaskSortOption } from "../task-filters";
import type { TaskGroup, TaskProjectGroup, TaskRow } from "./task-types";
import {
  buildTaskProjectGroups,
  getClientName,
  getDeadlineSortValue,
  isArchivedCurrentTask,
  isCompletedLifetimeTask,
  normalizeTask,
} from "./task-utils";

type UseTaskDerivedDataArgs = {
  tasks: TaskRow[];
  statsTasks: TaskRow[];
  groupedTasks: TaskGroup[];
  sortOption: TaskSortOption;
};

export function useTaskDerivedData({
  tasks,
  statsTasks,
  groupedTasks,
  sortOption,
}: UseTaskDerivedDataArgs) {
  const allNormalizedTasks = useMemo(() => {
    return tasks.map((task) => normalizeTask(task));
  }, [tasks]);

  const normalizedStatsTasks = useMemo(() => {
    return statsTasks.map((task) => normalizeTask(task));
  }, [statsTasks]);

  const flatTasks = useMemo(() => {
    /*
      The Tasks CRM must render from the same filtered data that powers the
      toolbar counts. dashboard-client builds groupedTasks from the current
      search/status/priority filters, while preserving the original TaskRow
      objects and their project metadata.

      Rebuilding from raw tasks here makes filters/counts disagree with the
      visible project cards.
    */
    const visibleTasks = groupedTasks.flatMap((group) => group.tasks);

    return sortFlatTasks(
      visibleTasks.map((task) => normalizeTask(task)),
      sortOption
    );
  }, [groupedTasks, sortOption]);

  const projectGroups = useMemo(() => {
    const groups = buildTaskProjectGroups(flatTasks);

    return sortProjectGroups(groups, sortOption);
  }, [flatTasks, sortOption]);

  const hasMatchingTasks = projectGroups.length > 0;

  /**
   * These counts describe what the user currently sees in the active workspace.
   * This avoids confusing numbers like "6 High Priority Tasks" when the current
   * Tasks view only shows 4 visible tasks and none of them are high priority.
   */
  const activeProjectsCount = projectGroups.length;

  const totalTasksCount = flatTasks.length;

  const highPriorityTasksCount = flatTasks.filter(
    (task) =>
      !Boolean(task.deleted_at) &&
      !Boolean(task.is_archived) &&
      String(task.priority || "").trim().toLowerCase() === "high"
  ).length;

  /**
   * Completed Projects is intentionally lifetime-based.
   * It includes completed projects even if they were later archived or deleted.
   */
  const allLifetimeProjectGroups = useMemo(() => {
    return buildLifetimeProjectGroups(normalizedStatsTasks);
  }, [normalizedStatsTasks]);

  const completedProjectsCount = allLifetimeProjectGroups.filter(
    isCompletedProjectGroup
  ).length;

  /**
   * Archived Tasks is current archive state.
   */
  const archivedTasksCount = normalizedStatsTasks.filter(
    isArchivedCurrentTask
  ).length;

  return {
    allNormalizedTasks,
    normalizedStatsTasks,

    /**
     * Project-ready flat list from real API tasks.
     */
    flatTasks,

    /**
     * New 2026 SaaS CRM model:
     * one clean client/project row with expandable subtasks.
     */
    projectGroups,

    hasMatchingTasks,

    /**
     * Clear dashboard stats.
     */
    activeProjectsCount,
    totalTasksCount,
    completedProjectsCount,
    archivedTasksCount,
    highPriorityTasksCount,

    /**
     * Backward-compatible stats names.
     */
    activeCount: activeProjectsCount,
    doneCount: completedProjectsCount,
    archivedCount: archivedTasksCount,
    highCount: highPriorityTasksCount,
  };
}

function sortFlatTasks(tasks: TaskRow[], sortOption: TaskSortOption) {
  return [...tasks].sort((a, b) => {
    switch (sortOption) {
      case "created-desc":
        return getTaskCreatedTime(b) - getTaskCreatedTime(a);

      case "created-asc":
        return getTaskCreatedTime(a) - getTaskCreatedTime(b);

      case "client-asc":
        return getClientName(a).localeCompare(getClientName(b));

      case "client-desc":
        return getClientName(b).localeCompare(getClientName(a));

      case "task-asc":
        return (a.task || "").localeCompare(b.task || "");

      case "task-desc":
        return (b.task || "").localeCompare(a.task || "");

      case "deadline-asc":
        return getDeadlineSortValue(a) - getDeadlineSortValue(b);

      case "deadline-desc":
        return getDeadlineSortValue(b) - getDeadlineSortValue(a);

      default: {
        const createdA = getTaskCreatedTime(a);
        const createdB = getTaskCreatedTime(b);

        if (createdA !== createdB) {
          return createdB - createdA;
        }

        const clientCompare = getClientName(a).localeCompare(getClientName(b));

        if (clientCompare !== 0) {
          return clientCompare;
        }

        const orderA = a.subtask_order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.subtask_order ?? Number.MAX_SAFE_INTEGER;

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        return a.id - b.id;
      }
    }
  });
}

function sortProjectGroups(
  groups: TaskProjectGroup[],
  sortOption: TaskSortOption
) {
  return [...groups].sort((a, b) => {
    switch (sortOption) {
      case "created-desc": {
        const createdCompare =
          getProjectCreatedTime(b) - getProjectCreatedTime(a);

        return createdCompare || compareProjectGroupsByName(a, b);
      }

      case "created-asc": {
        const createdCompare =
          getProjectCreatedTime(a) - getProjectCreatedTime(b);

        return createdCompare || compareProjectGroupsByName(a, b);
      }

      case "client-asc":
        return a.clientName.localeCompare(b.clientName);

      case "client-desc":
        return b.clientName.localeCompare(a.clientName);

      case "task-asc":
        return a.projectTitle.localeCompare(b.projectTitle);

      case "task-desc":
        return b.projectTitle.localeCompare(a.projectTitle);

      case "deadline-asc":
        return getProjectDeadlineSortValue(a) - getProjectDeadlineSortValue(b);

      case "deadline-desc":
        return getProjectDeadlineSortValue(b) - getProjectDeadlineSortValue(a);

      default: {
        const createdA = getProjectCreatedTime(a);
        const createdB = getProjectCreatedTime(b);

        if (createdA !== createdB) {
          return createdB - createdA;
        }

        return compareProjectGroupsByName(a, b);
      }
    }
  });
}

function getTaskCreatedTime(task: TaskRow) {
  const value = task.project?.created_at || task.created_at;
  if (!value) return 0;

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getProjectCreatedTime(group: TaskProjectGroup) {
  const value = group.project?.created_at || group.created_at;
  if (!value) return 0;

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareProjectGroupsByName(
  a: TaskProjectGroup,
  b: TaskProjectGroup
) {
  const clientCompare = a.clientName.localeCompare(b.clientName);

  if (clientCompare !== 0) return clientCompare;

  return a.projectTitle.localeCompare(b.projectTitle);
}

function getProjectDeadlineSortValue(group: TaskProjectGroup) {
  if (group.deadline_date) {
    const precise = new Date(group.deadline_date).getTime();

    if (!Number.isNaN(precise)) {
      return precise;
    }
  }

  if (group.deadline) {
    const fallback = new Date(group.deadline).getTime();

    if (!Number.isNaN(fallback)) {
      return fallback;
    }
  }

  return Number.MAX_SAFE_INTEGER;
}

function buildLifetimeProjectGroups(tasks: TaskRow[]) {
  const grouped = new Map<string, TaskRow[]>();

  for (const task of tasks) {
    const key = getLifetimeProjectKey(task);
    const existing = grouped.get(key) || [];

    existing.push(task);
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries()).map(([key, groupTasks]) => ({
    key,
    tasks: groupTasks,
  }));
}

function getLifetimeProjectKey(task: TaskRow) {
  if (task.project_id) {
    return `project::${task.project_id}`;
  }

  const clientName = task.client?.name?.trim().toLowerCase() || "unassigned";
  const rawInput = task.raw_input?.trim().toLowerCase() || "";

  if (rawInput) {
    return `${clientName}::${simpleStringHash(rawInput)}`;
  }

  const createdDay = task.created_at ? task.created_at.slice(0, 10) : "unknown";
  const amount = task.amount || "no-amount";
  const deadline = task.deadline_date || task.deadline || "no-deadline";

  return `${clientName}::${createdDay}::${amount}::${deadline}`;
}

function isCompletedProjectGroup(group: { tasks: TaskRow[] }) {
  if (!group.tasks.length) return false;

  return group.tasks.every((task) => isCompletedLifetimeTask(task));
}

function simpleStringHash(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}
