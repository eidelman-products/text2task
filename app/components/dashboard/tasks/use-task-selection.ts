import { useEffect, useMemo, useState } from "react";
import type { TaskArchiveView, TaskRow } from "./task-types";

type UseTaskSelectionArgs = {
  visibleTasks: TaskRow[];
  archiveView: TaskArchiveView;
};

export function useTaskSelection({
  visibleTasks,
  archiveView,
}: UseTaskSelectionArgs) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);

  const visibleTaskIds = useMemo(() => {
    return visibleTasks.map((task) => task.id);
  }, [visibleTasks]);

  useEffect(() => {
    const visibleIds = new Set(visibleTaskIds);

    setSelectedTaskIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [visibleTaskIds]);

  useEffect(() => {
    setSelectedTaskIds([]);
  }, [archiveView]);

  function toggleSelect(taskId: number) {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  }

  function clearSelection() {
    setSelectedTaskIds([]);
  }

  function toggleSelectAllVisible() {
    const allVisibleSelected =
      visibleTaskIds.length > 0 &&
      visibleTaskIds.every((id) => selectedTaskIds.includes(id));

    if (allVisibleSelected) {
      setSelectedTaskIds((prev) =>
        prev.filter((id) => !visibleTaskIds.includes(id))
      );
      return;
    }

    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      visibleTaskIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }

  const allVisibleSelected =
    visibleTaskIds.length > 0 &&
    visibleTaskIds.every((id) => selectedTaskIds.includes(id));

  const hasSelection = selectedTaskIds.length > 0;

  return {
    selectedTaskIds,
    setSelectedTaskIds,
    hasSelection,
    allVisibleSelected,
    toggleSelect,
    toggleSelectAllVisible,
    clearSelection,
  };
}