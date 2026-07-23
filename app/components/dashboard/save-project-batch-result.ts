import type { DuplicateProjectMatch } from "@/lib/tasks/project-duplicate-detection";

/**
 * Structured classification of a POST /api/projects/import response.
 *
 * A duplicate-project result is an expected business outcome (the server
 * intentionally returns 409 + DUPLICATE_PROJECT_DETECTED so the user can
 * choose to view the existing project or save anyway), not a failure --
 * callers must branch on `status` rather than throwing/catching it.
 * Anything that does not match the known "saved" or "duplicate" shapes
 * exactly is classified as "error" so genuine failures are never silently
 * treated as harmless.
 */
export type SaveProjectBatchOutcome =
  | { status: "saved"; createdTasks: unknown[] }
  | { status: "duplicate"; duplicate: DuplicateProjectMatch; groupIndex: number }
  | { status: "error"; message: string };

export function classifySaveProjectBatchResponse(input: {
  ok: boolean;
  status: number;
  data: unknown;
}): SaveProjectBatchOutcome {
  const { ok, status, data } = input;
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  if (ok) {
    const createdTasks = Array.isArray(record.createdTasks)
      ? record.createdTasks
      : [];

    return { status: "saved", createdTasks };
  }

  const duplicates = Array.isArray(record.duplicates) ? record.duplicates : null;
  const firstDuplicateEntry =
    duplicates && duplicates.length > 0 && duplicates[0] && typeof duplicates[0] === "object"
      ? (duplicates[0] as Record<string, unknown>)
      : null;

  if (
    status === 409 &&
    record.code === "DUPLICATE_PROJECT_DETECTED" &&
    firstDuplicateEntry &&
    Boolean(firstDuplicateEntry.duplicate) &&
    typeof firstDuplicateEntry.duplicate === "object" &&
    Number.isSafeInteger(firstDuplicateEntry.groupIndex)
  ) {
    return {
      status: "duplicate",
      duplicate: firstDuplicateEntry.duplicate as DuplicateProjectMatch,
      groupIndex: firstDuplicateEntry.groupIndex as number,
    };
  }

  const message =
    (typeof record.message === "string" && record.message) ||
    (typeof record.error === "string" && record.error) ||
    "Failed to save project";

  return { status: "error", message };
}
