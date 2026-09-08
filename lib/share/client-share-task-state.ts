import { isCanonicalTaskComplete, normalizeCanonicalTaskStatus } from "@/lib/tasks/canonical-task-status";
import type {
  ClientProjectTask,
  ClientProjectTaskWorkflowStatus,
} from "./client-share-projection-contracts";

export type ClientShareTaskStateInput = {
  status: string | null | undefined;
  completedAt: string | null | undefined;
  waitingForClientFeedback?: boolean;
};

export function deriveClientShareTaskWorkflowStatus(
  input: ClientShareTaskStateInput
): ClientProjectTaskWorkflowStatus {
  if (isCanonicalTaskComplete(input)) return "completed";

  switch (normalizeCanonicalTaskStatus(input.status)) {
    case "not_started":
      return "not_started";
    case "unknown":
      return "unknown";
    case "review":
      return "in_review";
    case "urgent":
      return "urgent";
    case "in_progress":
      return "in_progress";
    case "done":
      return "completed";
  }
}

export function deriveClientShareTaskPublicGroup(
  input: ClientShareTaskStateInput
): ClientProjectTask["publicGroup"] {
  const workflowStatus = deriveClientShareTaskWorkflowStatus(input);

  if (workflowStatus === "completed") return "completed";
  if (input.waitingForClientFeedback) return "waiting_for_feedback";
  if (workflowStatus === "not_started") return "coming_up";
  return "in_progress";
}

export function calculateClientShareProgress(
  tasks: readonly ClientShareTaskStateInput[]
): { completed: number; total: number; percent: number } | null {
  if (tasks.length === 0) return null;

  const completed = tasks.filter((task) => isCanonicalTaskComplete(task)).length;

  return {
    completed,
    total: tasks.length,
    percent: Math.round((completed / tasks.length) * 100),
  };
}
