import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { TaskRow } from "./task-types";

type ProjectBulkActionTarget =
  | { kind: "project"; projectId: string }
  | { kind: "legacy_task_group"; taskIds: number[] };

type UseTaskBulkActionsArgs = {
  selectedTaskIds: number[];
  tasks: TaskRow[];
  clearSelection: () => void;
  refreshTasks: () => Promise<void> | void;
  updateTaskStatus: (taskId: number, status: string) => Promise<void> | void;
  archiveTask: (taskId: number) => Promise<void> | void;
  restoreTask: (taskId: number) => Promise<void> | void;
};

export function useTaskBulkActions({
  selectedTaskIds,
  tasks,
  clearSelection,
  refreshTasks,
  updateTaskStatus,
  archiveTask,
  restoreTask,
}: UseTaskBulkActionsArgs) {
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const handleBulkStatus = useCallback(
    async (nextStatus: string) => {
      const ids = [...selectedTaskIds];

      try {
        for (const id of ids) {
          await updateTaskStatus(id, nextStatus);
        }

        clearSelection();
        toast.success(`Updated ${ids.length} task(s) to ${nextStatus}`);
      } catch (error) {
        console.error("Bulk status update failed:", error);
        toast.error("Could not update selected tasks");
      }
    },
    [selectedTaskIds, updateTaskStatus, clearSelection]
  );

  const handleBulkArchive = useCallback(async () => {
    const ids = [...selectedTaskIds];

    try {
      for (const id of ids) {
        await archiveTask(id);
      }

      clearSelection();
      toast.success(`${ids.length} task(s) moved to Archive`);
    } catch (error) {
      console.error("Bulk archive failed:", error);
      toast.error("Could not archive selected tasks");
    }
  }, [selectedTaskIds, archiveTask, clearSelection]);

  const handleBulkRestore = useCallback(async () => {
    const ids = [...selectedTaskIds];

    try {
      for (const id of ids) {
        await restoreTask(id);
      }

      clearSelection();
      toast.success(`${ids.length} task(s) restored`);
    } catch (error) {
      console.error("Bulk restore failed:", error);
      toast.error("Could not restore selected tasks");
    }
  }, [selectedTaskIds, restoreTask, clearSelection]);

  const openBulkDeleteConfirm = useCallback(() => {
    if (selectedTaskIds.length === 0) return;
    setShowBulkDeleteConfirm(true);
  }, [selectedTaskIds.length]);

  const closeBulkDeleteConfirm = useCallback(() => {
    if (isBulkDeleting) return;
    setShowBulkDeleteConfirm(false);
  }, [isBulkDeleting]);

  const confirmBulkPermanentDelete = useCallback(async () => {
    try {
      setIsBulkDeleting(true);
      const targets = buildBulkDeleteTargets(selectedTaskIds, tasks);

      if (targets.length === 0) {
        throw new Error("No selected projects could be resolved");
      }

      const response = await fetch("/api/projects/bulk-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "soft_delete",
          targets,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Bulk project delete failed");
      }

      await refreshTasks();
      clearSelection();
      setShowBulkDeleteConfirm(false);
      toast.success("Selected projects deleted successfully.");
    } catch (error) {
      console.error("Bulk permanent delete failed:", error);
      toast.error(
        "Could not delete selected projects. Please refresh and try again."
      );
    } finally {
      setIsBulkDeleting(false);
    }
  }, [selectedTaskIds, tasks, refreshTasks, clearSelection]);

  const resetBulkDeleteConfirm = useCallback(() => {
    if (isBulkDeleting) return;
    setShowBulkDeleteConfirm(false);
  }, [isBulkDeleting]);

  return {
    isBulkDeleting,
    showBulkDeleteConfirm,
    handleBulkStatus,
    handleBulkArchive,
    handleBulkRestore,
    openBulkDeleteConfirm,
    closeBulkDeleteConfirm,
    confirmBulkPermanentDelete,
    resetBulkDeleteConfirm,
  };
}

function buildBulkDeleteTargets(
  selectedTaskIds: number[],
  tasks: TaskRow[]
): ProjectBulkActionTarget[] {
  const selectedIds = new Set(selectedTaskIds);
  const resolvedTaskIds = new Set<number>();
  const projectIds = new Set<string>();
  const legacyTaskIds = new Set<number>();

  tasks.forEach((task) => {
    if (!selectedIds.has(task.id)) return;

    resolvedTaskIds.add(task.id);
    const projectId = task.project_id || task.project?.id || "";

    if (projectId) {
      projectIds.add(projectId);
      return;
    }

    legacyTaskIds.add(task.id);
  });

  if (resolvedTaskIds.size !== selectedIds.size) {
    throw new Error("One or more selected tasks could not be resolved");
  }

  const targets: ProjectBulkActionTarget[] = Array.from(projectIds).map(
    (projectId) => ({
      kind: "project",
      projectId,
    })
  );

  if (legacyTaskIds.size > 0) {
    targets.push({
      kind: "legacy_task_group",
      taskIds: Array.from(legacyTaskIds),
    });
  }

  return targets;
}
