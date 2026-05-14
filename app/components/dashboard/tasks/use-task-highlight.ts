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

    let attempts = 0;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;

    const interval = setInterval(() => {
      attempts += 1;
      const target = taskRefs.current[highlightedTaskId];

      if (target) {
        clearInterval(interval);

        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        setFlashTaskId(highlightedTaskId);

        clearTimer = setTimeout(() => {
          setFlashTaskId((current) =>
            current === highlightedTaskId ? null : current
          );
        }, 2600);
      }

      if (attempts >= 12) {
        clearInterval(interval);
      }
    }, 150);

    return () => {
      clearInterval(interval);
      if (clearTimer) {
        clearTimeout(clearTimer);
      }
    };
  }, [highlightedTaskId, groupedTasks]);

  return {
    flashTaskId,
    taskRefs,
  };
}
