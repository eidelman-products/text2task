import { compareSubtaskTitles } from "@/lib/tasks/task-title-similarity";

import type { ExistingProjectUpdateContext } from "@/lib/project-updates/project-update-types";

/**
 * Resolves whether an AI-extracted subtask reference (a title fragment
 * pulled from a client update, with no id attached) identifies an existing,
 * project-owned subtask.
 *
 * This module never receives, trusts, or returns a client- or AI-supplied
 * id. Every candidate id in a resolution is read directly from the
 * project-owned `subtasks` passed in by the caller.
 */
export type SubtaskReferenceResolution =
  | {
      outcome: "confident_match";
      targetTaskId: number;
      confidenceScore: number;
      reason: string;
    }
  | {
      outcome: "ambiguous_match";
      bestCandidateTaskId: number | null;
      confidenceScore: number;
      reason: string;
    }
  | {
      outcome: "no_match";
      reason: string;
    };

type ExistingSubtask = ExistingProjectUpdateContext["subtasks"][number];

/**
 * Words that grammatically wrap a reference but carry zero identifying
 * evidence on their own (determiners, prepositions, and the client's own
 * completion/approval language, which is already surfaced separately via
 * the extracted `status` field and must not double as title evidence).
 */
const ZERO_WEIGHT_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "to",
  "for",
  "with",
  "and",
  "of",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "now",
  "approved",
  "approve",
  "approval",
  "signed",
  "off",
  "done",
  "complete",
  "completed",
  "looks",
  "look",
  "good",
  "ready",
]);

/**
 * Words that are common enough across unrelated deliverables that they
 * must not, by themselves, prove identity the way a distinctive business
 * term does. They are not discarded -- they still contribute weak,
 * partial evidence (GENERIC_TOKEN_WEIGHT), because a combination of
 * generic words can still uniquely describe a single deliverable
 * ("landing page" when a project has only one landing-page task).
 */
const GENERIC_REFERENCE_TERMS = new Set([
  "page",
  "section",
  "website",
  "landing",
  "content",
  "create",
  "add",
  "design",
  "update",
  "build",
  "site",
  "web",
  "homepage",
  "new",
]);

const MIN_TOKEN_LENGTH = 2;

/** Weight contributed by each shared distinctive (non-generic) token. */
const DISTINCTIVE_TOKEN_WEIGHT = 1;

/** Weight contributed by each shared generic token -- deliberately partial credit. */
const GENERIC_TOKEN_WEIGHT = 0.5;

/**
 * Minimum weighted evidence a candidate must accumulate against a single
 * existing subtask before that subtask can ever be treated as confidently
 * identified. Below this, the strongest read is still "possibly related",
 * never "the same deliverable".
 */
const MIN_CONFIDENT_SCORE = 1;

/**
 * A confident match must account for every meaningful word in the
 * reference (distinctive + generic), not just a subset. This is what
 * keeps a partial reference such as "first 4 Instagram posts" from being
 * confidently identified with a task for "8 Instagram posts" -- "first"
 * and "4" are never explained by the existing title, so coverage stays
 * below 1.
 */
const FULL_COVERAGE_THRESHOLD = 1;

/**
 * The best-scoring existing subtask must beat the runner-up by at least
 * this ratio before it is treated as uniquely identified. A tie (or near
 * tie) between two plausible subtasks must stay ambiguous rather than
 * silently picking one.
 */
const REQUIRED_MARGIN_RATIO = 1.4;

/**
 * Minimum share of the candidate's own meaningful wording that an existing
 * subtask must account for before it is even a plausible relation
 * candidate. A small incidental overlap -- one shared word out of many --
 * is not evidence that a reference is about an existing deliverable; it is
 * exactly as consistent with the reference being unrelated new work that
 * happens to mention one similar word.
 *
 * Calibrated against confirmed production runtime evidence: candidates
 * that are genuinely new work scored well below this line (coverage
 * ~0.143 and ~0.375), while a genuine partial reference to existing work
 * scored well above it (coverage ~0.667). 0.5 sits with real margin on
 * both sides of that evidence.
 */
const MIN_PLAUSIBLE_COVERAGE = 0.5;

type ReferenceTokens = {
  distinctive: Set<string>;
  generic: Set<string>;
  meaningfulCount: number;
};

function tokenizeReferenceTitle(value: string): ReferenceTokens {
  const normalized = String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const distinctive = new Set<string>();
  const generic = new Set<string>();

  if (normalized) {
    for (const token of normalized.split(/\s+/)) {
      if (token.length < MIN_TOKEN_LENGTH) continue;
      if (ZERO_WEIGHT_STOPWORDS.has(token)) continue;

      if (GENERIC_REFERENCE_TERMS.has(token)) {
        generic.add(token);
      } else {
        distinctive.add(token);
      }
    }
  }

  return {
    distinctive,
    generic,
    meaningfulCount: distinctive.size + generic.size,
  };
}

function scoreCandidateAgainstExisting(
  candidate: ReferenceTokens,
  existing: ReferenceTokens
): { score: number; coverage: number; sharedDistinctive: number } {
  let sharedDistinctive = 0;
  let sharedGeneric = 0;

  candidate.distinctive.forEach((token) => {
    if (existing.distinctive.has(token)) sharedDistinctive += 1;
  });

  candidate.generic.forEach((token) => {
    if (existing.generic.has(token)) sharedGeneric += 1;
  });

  const score =
    sharedDistinctive * DISTINCTIVE_TOKEN_WEIGHT +
    sharedGeneric * GENERIC_TOKEN_WEIGHT;

  const coverage =
    candidate.meaningfulCount > 0
      ? (sharedDistinctive + sharedGeneric) / candidate.meaningfulCount
      : 0;

  return { score, coverage, sharedDistinctive };
}

function getExistingTaskId(subtask: ExistingSubtask): number {
  return Number(subtask.id);
}

/**
 * Resolves an extracted subtask reference against the project's own,
 * server-loaded subtasks. Returns a discriminated union describing
 * exactly how confident the identification is -- callers must never
 * treat `ambiguous_match`/`no_match` as safe to auto-apply.
 */
export function resolveSubtaskReference(input: {
  candidateTitle: string;
  subtasks: ExistingProjectUpdateContext["subtasks"];
}): SubtaskReferenceResolution {
  const candidateTitle = input.candidateTitle.trim();

  if (!candidateTitle) {
    return {
      outcome: "no_match",
      reason: "The extracted reference had no usable title.",
    };
  }

  // Strongest existing signal first: the shared, already-proven exact/
  // near-exact title comparison used across the rest of the app. This
  // function's scoring and thresholds are intentionally left unchanged.
  let bestDuplicate: {
    taskId: number;
    title: string;
    score: number;
  } | null = null;

  for (const subtask of input.subtasks) {
    const existingTitle = subtask.task_title?.trim();
    if (!existingTitle) continue;

    const comparison = compareSubtaskTitles(candidateTitle, existingTitle);
    if (!comparison.isDuplicate) continue;

    if (!bestDuplicate || comparison.score > bestDuplicate.score) {
      bestDuplicate = {
        taskId: getExistingTaskId(subtask),
        title: existingTitle,
        score: comparison.score,
      };
    }
  }

  if (bestDuplicate) {
    return {
      outcome: "confident_match",
      targetTaskId: bestDuplicate.taskId,
      confidenceScore: Math.min(1, bestDuplicate.score / 100),
      reason: `The reference title closely matches the existing subtask "${bestDuplicate.title}".`,
    };
  }

  // Below the exact/near-exact threshold: Project Update-specific
  // relation scoring, weighing distinctive business terms far more than
  // generic words while still letting generic words contribute.
  const candidateTokens = tokenizeReferenceTitle(candidateTitle);

  if (candidateTokens.meaningfulCount === 0) {
    return {
      outcome: "no_match",
      reason:
        "The reference did not contain enough identifying wording to compare against existing subtasks.",
    };
  }

  const scored = input.subtasks
    .map((subtask) => {
      const existingTitle = subtask.task_title?.trim();
      if (!existingTitle) return null;

      const existingTokens = tokenizeReferenceTitle(existingTitle);
      const { score, coverage, sharedDistinctive } = scoreCandidateAgainstExisting(
        candidateTokens,
        existingTokens
      );

      if (score <= 0) return null;

      // A candidate that contains distinctive (non-generic) vocabulary can
      // never be plausibly related to an existing task that shares none of
      // it -- overlap limited to generic words like "landing"/"page" is not
      // evidence of the same deliverable when the candidate's own
      // identifying term ("testimonial") is completely unaccounted for.
      // This guard does not apply when the candidate has no distinctive
      // tokens at all (a purely generic reference can still match).
      if (candidateTokens.distinctive.size > 0 && sharedDistinctive === 0) {
        return null;
      }

      // A single incidental shared word (or two) is not enough to make an
      // existing subtask a plausible relation candidate when it leaves
      // most of the reference's own wording completely unexplained. See
      // MIN_PLAUSIBLE_COVERAGE for the evidence behind this threshold.
      if (coverage < MIN_PLAUSIBLE_COVERAGE) {
        return null;
      }

      return {
        taskId: getExistingTaskId(subtask),
        title: existingTitle,
        score,
        coverage,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      outcome: "no_match",
      reason:
        "No existing subtask shares any identifying wording with this reference.",
    };
  }

  const [best, second] = scored;
  const marginRatio = second ? best.score / second.score : Infinity;

  const isConfidentlyIdentified =
    best.score >= MIN_CONFIDENT_SCORE &&
    best.coverage >= FULL_COVERAGE_THRESHOLD &&
    marginRatio >= REQUIRED_MARGIN_RATIO;

  if (isConfidentlyIdentified) {
    return {
      outcome: "confident_match",
      targetTaskId: best.taskId,
      confidenceScore: 0.85,
      reason: `The reference's wording is fully explained by "${best.title}" with no comparably strong alternative.`,
    };
  }

  return {
    outcome: "ambiguous_match",
    bestCandidateTaskId: best.taskId,
    confidenceScore: Math.min(0.6, best.score / (MIN_CONFIDENT_SCORE * 2)),
    reason:
      second && marginRatio < REQUIRED_MARGIN_RATIO
        ? `"${best.title}" and "${second.title}" are comparably plausible matches, so the reference is not specific enough to choose automatically.`
        : `"${best.title}" shares some wording with this reference, but not enough to confidently identify it as the same deliverable.`,
  };
}
