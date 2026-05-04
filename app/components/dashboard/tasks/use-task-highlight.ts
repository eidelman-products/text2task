import { useEffect, useRef, useState } from "react";
import type { TaskGroup } from "./task-types";

type UseTaskHighlightArgs = {
  highlightedTaskId?: number | null;
  groupedTasks: TaskGroup[];
};

export function useTaskHighlight({
  highlightedTaskId,
  groupedTasks,
}: UseTaskHighlightArgs) {
  const [flashTaskId, setFlashTaskId] = useState<number | null>(null);
  const taskRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!highlightedTaskId) return;

    const timer = setTimeout(() => {
      const target = taskRefs.current[highlightedTaskId];

      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        setFlashTaskId(highlightedTaskId);
      }
    }, 250);

    const clearTimer = setTimeout(() => {
      setFlashTaskId((current) =>
        current === highlightedTaskId ? null : current
      );
    }, 2600);

    return () => {
      clearTimeout(timer);
      clearTimeout(clearTimer);
    };
  }, [highlightedTaskId, groupedTasks]);

  return {
    flashTaskId,
    taskRefs,
  };
}