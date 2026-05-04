import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { TaskRow } from "./task-types";

type UseTaskSingleDeleteArgs = {
  flatTasks: TaskRow[];
  allNormalizedTasks: TaskRow[];
  normalizedStatsTasks: TaskRow[];
  permanentlyDeleteTask: (taskId: number) => Promise<void> | void;
};

export function useTaskSingleDelete({
  flatTasks,
  allNormalizedTasks,
  normalizedStatsTasks,
  permanentlyDeleteTask,
}: UseTaskSingleDeleteArgs) {
  const [singleDeleteTask, setSingleDeleteTask] = useState<TaskRow | null>(null);
  const [isSingleDeleting, setIsSingleDeleting] = useState(false);

  const requestSinglePermanentDelete = useCallback(
    (taskId: number) => {
      const task =
        flatTasks.find((item) => item.id === taskId) ||
        allNormalizedTasks.find((item) => item.id === taskId) ||
        normalizedStatsTasks.find((item) => item.id === taskId) ||
        null;

      if (!task) {
        toast.error("Could not find this task");
        return;
      }

      setSingleDeleteTask(task);
    },
    [flatTasks, allNormalizedTasks, normalizedStatsTasks]
  );

  const closeSingleDeleteConfirm = useCallback(() => {
    if (isSingleDeleting) return;
    setSingleDeleteTask(null);
  }, [isSingleDeleting]);

  const confirmSinglePermanentDelete = useCallback(async () => {
    if (!singleDeleteTask) return;

    try {
      setIsSingleDeleting(true);
      await permanentlyDeleteTask(singleDeleteTask.id);
      toast.success("Task permanently deleted");
      setSingleDeleteTask(null);
    } catch (error) {
      console.error("Permanent delete failed:", error);
      toast.error("Could not permanently delete this task");
    } finally {
      setIsSingleDeleting(false);
    }
  }, [singleDeleteTask, permanentlyDeleteTask]);

  return {
    singleDeleteTask,
    isSingleDeleting,
    requestSinglePermanentDelete,
    closeSingleDeleteConfirm,
    confirmSinglePermanentDelete,
  };
}