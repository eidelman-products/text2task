import { compareSubtaskTitles } from "./task-title-similarity";

type SupabaseLikeClient = {
  from: (table: string) => any;
};

type ExistingSubtaskRow = {
  id: number;
  task_title: string | null;
};

export type DuplicateSubtaskMatch = {
  existingTaskId: number;
  existingTitle: string;
  proposedTitle: string;
  score: number;
  reason: string;
};

export async function findDuplicateSubtaskInProject({
  supabase,
  userId,
  projectId,
  candidateTitle,
}: {
  supabase: SupabaseLikeClient;
  userId: string;
  projectId: string;
  candidateTitle: string;
}): Promise<DuplicateSubtaskMatch | null> {
  const title = candidateTitle.trim();

  if (!title) return null;

  const { data, error } = await supabase
    .from("tasks")
    .select("id, task_title")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("Subtask duplicate detection query failed:", error);
    return null;
  }

  const rows = Array.isArray(data) ? (data as ExistingSubtaskRow[]) : [];
  let bestMatch: DuplicateSubtaskMatch | null = null;

  for (const row of rows) {
    const existingTitle = row.task_title?.trim();

    if (!existingTitle) continue;

    const comparison = compareSubtaskTitles(title, existingTitle);

    if (!comparison.isDuplicate) continue;

    const match = {
      existingTaskId: Number(row.id),
      existingTitle,
      proposedTitle: title,
      score: comparison.score,
      reason: comparison.reason,
    };

    if (!bestMatch || match.score > bestMatch.score) {
      bestMatch = match;
    }
  }

  return bestMatch;
}

export function findDuplicateSubtaskInNewTitles(
  titles: string[]
): DuplicateSubtaskMatch | null {
  const seen: Array<{ title: string; index: number }> = [];

  for (let index = 0; index < titles.length; index += 1) {
    const proposedTitle = titles[index]?.trim();

    if (!proposedTitle) continue;

    for (const existing of seen) {
      const comparison = compareSubtaskTitles(proposedTitle, existing.title);

      if (comparison.isDuplicate) {
        return {
          existingTaskId: 0,
          existingTitle: existing.title,
          proposedTitle,
          score: comparison.score,
          reason: `duplicate within this apply request: ${comparison.reason}`,
        };
      }
    }

    seen.push({ title: proposedTitle, index });
  }

  return null;
}
