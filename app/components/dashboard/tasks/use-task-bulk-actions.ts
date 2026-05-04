import { useCallback, useState } from "react";
import { toast } from "sonner";

type UseTaskBulkActionsArgs = {
  selectedTaskIds: number[];
  clearSelection: () => void;
  updateTaskStatus: (taskId: number, status: string) => Promise<void> | void;
  archiveTask: (taskId: number) => Promise<void> | void;
  restoreTask: (taskId: number) => Promise<void> | void;
  permanentlyDeleteTask: (taskId: number) => Promise<void> | void;
};

export function useTaskBulkActions({
  selectedTaskIds,
  clearSelection,
  updateTaskStatus,
  archiveTask,
  restoreTask,
  permanentlyDeleteTask,
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
      const ids = [...selectedTaskIds];

      for (const id of ids) {
        await permanentlyDeleteTask(id);
      }

      clearSelection();
      setShowBulkDeleteConfirm(false);
      toast.success(`Permanently deleted ${ids.length} selected task(s)`);
    } catch (error) {
      console.error("Bulk permanent delete failed:", error);
      toast.error("Could not permanently delete selected tasks");
    } finally {
      setIsBulkDeleting(false);
    }
  }, [selectedTaskIds, permanentlyDeleteTask, clearSelection]);

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