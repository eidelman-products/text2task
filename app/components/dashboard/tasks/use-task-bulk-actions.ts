import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { TaskRow } from "./task-types";

export type BulkPendingAction =
  | "mark_done"
  | "mark_in_progress"
  | "archive"
  | "restore"
  | "delete"
  | null;

type ProjectBulkActionTarget =
  | { kind: "project"; projectId: string }
  | { kind: "legacy_task_group"; taskIds: number[] };

type UseTaskBulkActionsArgs = {
  selectedTaskIds: number[];
  tasks: TaskRow[];
  clearSelection: () => void;
  refreshTasks: () => Promise<void> | void;
  updateTaskStatus: (
    taskId: number,
    status: string,
    options?: {
      suppressErrorToast?: boolean;
      throwOnError?: boolean;
    }
  ) => Promise<void> | void;
};

export function useTaskBulkActions({
  selectedTaskIds,
  tasks,
  clearSelection,
  refreshTasks,
  updateTaskStatus,
}: UseTaskBulkActionsArgs) {
  const [pendingBulkAction, setPendingBulkAction] =
    useState<BulkPendingAction>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const pendingBulkActionRef = useRef<BulkPendingAction>(null);

  const startBulkAction = useCallback((action: Exclude<BulkPendingAction, null>) => {
    if (pendingBulkActionRef.current) return false;

    pendingBulkActionRef.current = action;
    setPendingBulkAction(action);
    return true;
  }, []);

  const finishBulkAction = useCallback(() => {
    pendingBulkActionRef.current = null;
    setPendingBulkAction(null);
  }, []);

  const handleBulkStatus = useCallback(
    async (nextStatus: string) => {
      const ids = [...selectedTaskIds];
      const action =
        nextStatus === "Done" ? "mark_done" : "mark_in_progress";

      if (ids.length === 0 || !startBulkAction(action)) return;

      try {
        for (const id of ids) {
          await updateTaskStatus(id, nextStatus, {
            suppressErrorToast: true,
            throwOnError: true,
          });
        }

        clearSelection();
        toast.success(`Updated ${ids.length} task(s) to ${nextStatus}`);
      } catch (error) {
        console.error("Bulk status update failed:", error);

        try {
          await refreshTasks();
        } catch (refreshError) {
          console.error("Bulk status refresh failed:", refreshError);
        }

        toast.error("Could not update selected tasks");
      } finally {
        finishBulkAction();
      }
    },
    [
      selectedTaskIds,
      updateTaskStatus,
      clearSelection,
      refreshTasks,
      startBulkAction,
      finishBulkAction,
    ]
  );

  const runBulkProjectAction = useCallback(
    async (action: "archive" | "restore") => {
      if (selectedTaskIds.length === 0 || !startBulkAction(action)) return;

      try {
        const targets = buildBulkActionTargets(selectedTaskIds, tasks);

        if (targets.length === 0) {
          throw new Error("No selected projects could be resolved");
        }

        const response = await fetch("/api/projects/bulk-action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            targets,
          }),
        });
        const data = await response.json();

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || `Bulk project ${action} failed`);
        }

        await refreshTasks();
        clearSelection();
        toast.success(
          action === "archive"
            ? "Selected work moved to Archive."
            : "Selected work restored."
        );
      } catch (error) {
        console.error(`Bulk ${action} failed:`, error);
        toast.error(
          action === "archive"
            ? "Could not archive selected work."
            : "Could not restore selected work."
        );
      } finally {
        finishBulkAction();
      }
    },
    [
      selectedTaskIds,
      tasks,
      refreshTasks,
      clearSelection,
      startBulkAction,
      finishBulkAction,
    ]
  );

  const handleBulkArchive = useCallback(
    () => runBulkProjectAction("archive"),
    [runBulkProjectAction]
  );

  const handleBulkRestore = useCallback(
    () => runBulkProjectAction("restore"),
    [runBulkProjectAction]
  );

  const openBulkDeleteConfirm = useCallback(() => {
    if (selectedTaskIds.length === 0 || pendingBulkActionRef.current) return;
    setShowBulkDeleteConfirm(true);
  }, [selectedTaskIds.length]);

  const closeBulkDeleteConfirm = useCallback(() => {
    if (pendingBulkActionRef.current) return;
    setShowBulkDeleteConfirm(false);
  }, []);

  const confirmBulkPermanentDelete = useCallback(async () => {
    if (!startBulkAction("delete")) return;

    try {
      const targets = buildBulkActionTargets(selectedTaskIds, tasks);

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
      finishBulkAction();
    }
  }, [
    selectedTaskIds,
    tasks,
    refreshTasks,
    clearSelection,
    startBulkAction,
    finishBulkAction,
  ]);

  const resetBulkDeleteConfirm = useCallback(() => {
    if (pendingBulkActionRef.current) return;
    setShowBulkDeleteConfirm(false);
  }, []);

  const isBulkDeleting = pendingBulkAction === "delete";

  return {
    pendingBulkAction,
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

function buildBulkActionTargets(
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
