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
      New project-based architecture:
      Use the real tasks array returned from /api/tasks as the source of truth.

      Do NOT rebuild flatTasks from groupedTasks here, because groupedTasks is a
      legacy view model and may not carry newer project fields such as:
      - project_id
      - subtask_order
      - contact_name

      Resources, subtasks, project grouping, and future project-level features
      must rely on the normalized task rows from the real API response.
    */
    return sortFlatTasks(allNormalizedTasks, sortOption);
  }, [allNormalizedTasks, sortOption]);

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
        const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;

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
        const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;

        if (createdA !== createdB) {
          return createdB - createdA;
        }

        return a.clientName.localeCompare(b.clientName);
      }
    }
  });
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