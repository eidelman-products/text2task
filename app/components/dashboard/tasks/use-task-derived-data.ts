import { useMemo } from "react";
import type { TaskSortOption } from "../task-filters";
import type { TaskGroup, TaskRow } from "./task-types";
import {
  getClientName,
  getDeadlineSortValue,
  isActiveCurrentTask,
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
    const normalized = groupedTasks.flatMap((group) =>
      group.tasks.map((task) => normalizeTask(task))
    );

    return [...normalized].sort((a, b) => {
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
          const clientCompare = getClientName(a).localeCompare(getClientName(b));

          if (clientCompare !== 0) {
            return clientCompare;
          }

          const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;

          return createdB - createdA;
        }
      }
    });
  }, [groupedTasks, sortOption]);

  const hasMatchingTasks = flatTasks.length > 0;

  const activeCount = normalizedStatsTasks.filter(isActiveCurrentTask).length;

  const doneCount = normalizedStatsTasks.filter(isCompletedLifetimeTask).length;

  const archivedCount = normalizedStatsTasks.filter(isArchivedCurrentTask).length;

  const highCount = normalizedStatsTasks.filter(
    (task) =>
      isActiveCurrentTask(task) &&
      String(task.priority || "").trim().toLowerCase() === "high"
  ).length;

  return {
    allNormalizedTasks,
    normalizedStatsTasks,
    flatTasks,
    hasMatchingTasks,
    activeCount,
    doneCount,
    archivedCount,
    highCount,
  };
}