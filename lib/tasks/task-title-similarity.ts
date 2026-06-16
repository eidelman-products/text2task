export function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|llc|ltd|inc|co|company|studio|agency)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanTaskTitle(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|please|need|needs|for|to|and|with|new)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanSubtaskDuplicateTitle(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bsigned\s+off\b/g, " ")
    .replace(/\blooks?\s+good\b/g, " ")
    .replace(
      /\b(the|a|an|please|need|needs|for|to|and|with|new|add|create|build|make|update|design|prepare|approved|approve|approval|signed|off|done|completed|complete|looks|look|good|ready|now|is|are|was|were|be|been|being)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function getTextSimilarity(a: string, b: string) {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);

  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  const intersection = new Set(
    Array.from(aTokens).filter((token) => bTokens.has(token))
  );

  const union = new Set([...Array.from(aTokens), ...Array.from(bTokens)]);

  return intersection.size / union.size;
}

export function compareSubtaskTitles(candidateTitle: string, existingTitle: string) {
  const candidate = cleanSubtaskDuplicateTitle(candidateTitle);
  const existing = cleanSubtaskDuplicateTitle(existingTitle);

  if (!candidate || !existing) {
    return {
      isDuplicate: false,
      score: 0,
      reason: "missing comparable title",
    };
  }

  if (candidate === existing) {
    return {
      isDuplicate: true,
      score: 100,
      reason: "normalized title match",
    };
  }

  const candidateTokens = tokenize(candidate);
  const existingTokens = tokenize(existing);
  const sharedTokens = Array.from(candidateTokens).filter((token) =>
    existingTokens.has(token)
  );
  const meaningfulCandidateTokens = getMeaningfulTokens(candidateTokens);
  const meaningfulExistingTokens = getMeaningfulTokens(existingTokens);
  const unmatchedMeaningfulCandidateTokens = meaningfulCandidateTokens.filter(
    (token) => !existingTokens.has(token)
  );
  const unmatchedMeaningfulExistingTokens = meaningfulExistingTokens.filter(
    (token) => !candidateTokens.has(token)
  );
  const candidateCoverage =
    candidateTokens.size > 0 ? sharedTokens.length / candidateTokens.size : 0;
  const existingCoverage =
    existingTokens.size > 0 ? sharedTokens.length / existingTokens.size : 0;
  const meaningfulCandidateCoverage =
    meaningfulCandidateTokens.length > 0
      ? meaningfulCandidateTokens.filter((token) => existingTokens.has(token)).length /
        meaningfulCandidateTokens.length
      : 0;
  const meaningfulExistingCoverage =
    meaningfulExistingTokens.length > 0
      ? meaningfulExistingTokens.filter((token) => candidateTokens.has(token)).length /
        meaningfulExistingTokens.length
      : 0;
  const similarity = getTextSimilarity(candidate, existing);

  if (
    (candidate.includes(existing) || existing.includes(candidate)) &&
    Math.min(meaningfulCandidateTokens.length, meaningfulExistingTokens.length) >= 2 &&
    (meaningfulCandidateCoverage >= 0.8 || meaningfulExistingCoverage >= 0.8) &&
    unmatchedMeaningfulCandidateTokens.length < 2 &&
    unmatchedMeaningfulExistingTokens.length < 2
  ) {
    return {
      isDuplicate: true,
      score: 94,
      reason: "specific normalized title containment",
    };
  }

  if (
    similarity >= 0.72 &&
    candidateCoverage >= 0.72 &&
    existingCoverage >= 0.72 &&
    unmatchedMeaningfulCandidateTokens.length < 2 &&
    unmatchedMeaningfulExistingTokens.length < 2
  ) {
    return {
      isDuplicate: true,
      score: Math.round(similarity * 100),
      reason: "high title token overlap",
    };
  }

  if (
    similarity >= 0.6 &&
    sharedTokens.length >= 3 &&
    candidateCoverage >= 0.75 &&
    existingCoverage >= 0.75 &&
    meaningfulCandidateCoverage >= 0.75 &&
    meaningfulExistingCoverage >= 0.66 &&
    unmatchedMeaningfulCandidateTokens.length === 0 &&
    unmatchedMeaningfulExistingTokens.length < 2
  ) {
    return {
      isDuplicate: true,
      score: Math.round(similarity * 100),
      reason: "strong shared title terms",
    };
  }

  return {
    isDuplicate: false,
    score: Math.round(similarity * 100),
    reason: "title similarity below duplicate threshold",
  };
}

function getMeaningfulTokens(tokens: Set<string>) {
  return Array.from(tokens).filter((token) => !GENERIC_CONTEXT_TOKENS.has(token));
}

const GENERIC_CONTEXT_TOKENS = new Set([
  "home",
  "homepage",
  "page",
  "section",
  "website",
  "site",
  "web",
  "landing",
  "content",
]);

function tokenize(value: string) {
  return new Set(
    String(value || "")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  );
}
