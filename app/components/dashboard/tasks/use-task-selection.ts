import { useMemo, useState } from "react";
import type { TaskArchiveView, TaskRow } from "./task-types";

type UseTaskSelectionArgs = {
  visibleTasks: TaskRow[];
  archiveView: TaskArchiveView;
};

/**
 * The effective (displayed) selection: raw selected ids, pruned down to
 * only ids that are still in the current visible set. Extracted as a pure
 * function so this filtering -- the actual behavior previously produced by
 * an effect one render late -- is directly testable without rendering.
 */
export function getVisibleSelectedTaskIds(
  rawSelectedTaskIds: number[],
  visibleTaskIds: number[]
): number[] {
  const visibleIds = new Set(visibleTaskIds);

  return rawSelectedTaskIds.filter((id) => visibleIds.has(id));
}

export function useTaskSelection({
  visibleTasks,
  archiveView,
}: UseTaskSelectionArgs) {
  const [rawSelectedTaskIds, setRawSelectedTaskIds] = useState<number[]>([]);

  const visibleTaskIds = useMemo(() => {
    return visibleTasks.map((task) => task.id);
  }, [visibleTasks]);

  /*
    A task that scrolls out of the visible set (filtering, search, pagination,
    etc.) should no longer count as selected. Rather than pruning the stored
    selection in an effect (which would let a stale, still-hidden id remain
    "selected" for one extra render before the effect catches up), the
    effective selection is derived fresh on every render from the raw stored
    ids plus the current visible set.
  */
  const selectedTaskIds = useMemo(
    () => getVisibleSelectedTaskIds(rawSelectedTaskIds, visibleTaskIds),
    [rawSelectedTaskIds, visibleTaskIds]
  );

  /*
    Switching between the active/archived task views should always start
    with an empty selection -- selecting an archived task does not carry a
    meaningful intent once you are looking at active tasks, and vice versa.
    This clears the raw stored selection (not just the derived view above)
    so a previously selected id does not silently reappear as selected if
    the user switches back to the view it belongs to. Mirrors the previous
    useEffect's exact dependency ([archiveView]), applied during render
    instead of in an effect to avoid an extra committed render pass.
  */
  const [previousArchiveView, setPreviousArchiveView] = useState(archiveView);

  if (previousArchiveView !== archiveView) {
    setPreviousArchiveView(archiveView);
    setRawSelectedTaskIds([]);
  }

  function toggleSelect(taskId: number) {
    setRawSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  }

  function clearSelection() {
    setRawSelectedTaskIds([]);
  }

  function toggleSelectAllVisible() {
    const allVisibleSelected =
      visibleTaskIds.length > 0 &&
      visibleTaskIds.every((id) => selectedTaskIds.includes(id));

    if (allVisibleSelected) {
      setRawSelectedTaskIds((prev) =>
        prev.filter((id) => !visibleTaskIds.includes(id))
      );
      return;
    }

    setRawSelectedTaskIds((prev) => {
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
    setSelectedTaskIds: setRawSelectedTaskIds,
    hasSelection,
    allVisibleSelected,
    toggleSelect,
    toggleSelectAllVisible,
    clearSelection,
  };
}