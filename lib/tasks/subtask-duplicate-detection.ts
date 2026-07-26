import { compareSubtaskTitles } from "./task-title-similarity";

import type { SupabaseLikeClient } from "@/lib/supabase/query-builder-like";

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

/*
  supabase is accepted through an unconstrained generic and narrowed with a
  single `as` assertion, rather than typed as SupabaseLikeClient directly:
  this repo's real Supabase client has no Database schema generic, which
  makes its query-builder methods (particularly `.eq()`) resolve to a very
  deep type. Comparing that real type structurally against any interface
  that also declares an `eq` member overflows TypeScript's
  type-instantiation depth limit at real call sites (verified directly).
  An unconstrained generic parameter has nothing concrete to structurally
  compare at the call boundary, so both the real client and small test
  fakes are accepted; the query below is still fully type-checked against
  the precise SupabaseLikeClient shape once narrowed.
*/
export async function findDuplicateSubtaskInProject<Client>({
  supabase: supabaseClient,
  userId,
  projectId,
  candidateTitle,
}: {
  supabase: Client;
  userId: string;
  projectId: string;
  candidateTitle: string;
}): Promise<DuplicateSubtaskMatch | null> {
  const title = candidateTitle.trim();

  if (!title) return null;

  const supabase = supabaseClient as SupabaseLikeClient;
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
