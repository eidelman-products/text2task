export type CanonicalTaskWorkflowStatus =
  | "not_started"
  | "in_progress"
  | "review"
  | "urgent"
  | "done"
  | "unknown";

export function normalizeCanonicalTaskStatus(
  value: string | null | undefined
): CanonicalTaskWorkflowStatus {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) return "unknown";
  if (normalized === "not started" || normalized === "new") return "not_started";
  if (normalized === "in progress" || normalized === "working") return "in_progress";
  if (normalized === "review" || normalized === "in review") return "review";
  if (normalized === "urgent") return "urgent";
  if (normalized === "done" || normalized === "complete" || normalized === "completed") {
    return "done";
  }

  return "unknown";
}

export function isCanonicalTaskComplete(input: {
  status: string | null | undefined;
  completedAt: string | null | undefined;
}): boolean {
  return normalizeCanonicalTaskStatus(input.status) === "done" || Boolean(input.completedAt);
}
