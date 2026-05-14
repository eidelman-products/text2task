export type DuplicateProjectSubtaskCandidate = {
  task_title?: string | null;
  task?: string | null;
  title?: string | null;
};

export type DuplicateProjectCandidate = {
  client_name: string;
  contact_name?: string | null;
  amount?: string | number | null;
  deadline_text?: string | null;
  deadline_date?: string | null;
  project_title?: string | null;
  summary?: string | null;
  subtasks: DuplicateProjectSubtaskCandidate[];
};

export type DuplicateProjectMatch = {
  project_id: string | null;
  existing_task_id: number;
  client_name: string;
  contact_name: string | null;
  amount: string | null;
  deadline_text: string | null;
  deadline_date: string | null;
  created_at: string | null;
  task_count: number;
  matched_task_count: number;
  score: number;
  confidence: "high" | "medium";
  reason: string;
  existing_tasks: Array<{
    id: number;
    task_title: string;
  }>;
};

type SupabaseLikeClient = {
  from: (table: string) => any;
};

type ExistingTaskRow = {
  id: number;
  project_id: string | null;
  task_title: string | null;
  amount: string | null;
  deadline_text: string | null;
  deadline_date: string | null;
  created_at: string | null;
  client_name: string | null;
  contact_name: string | null;
  clients?: {
    id?: string | null;
    name?: string | null;
    contact_name?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    created_at?: string | null;
  } | null;
};

type ExistingProjectGroup = {
  key: string;
  project_id: string | null;
  client_name: string;
  contact_name: string | null;
  amount: string | null;
  deadline_text: string | null;
  deadline_date: string | null;
  created_at: string | null;
  tasks: ExistingTaskRow[];
};

export async function findDuplicateProject({
  supabase,
  userId,
  candidate,
}: {
  supabase: SupabaseLikeClient;
  userId: string;
  candidate: DuplicateProjectCandidate;
}): Promise<DuplicateProjectMatch | null> {
  const normalizedClientName = normalizeText(candidate.client_name);

  if (!normalizedClientName) {
    return null;
  }

  const candidateTitles = getCandidateTaskTitles(candidate);

  if (candidateTitles.length === 0) {
    return null;
  }

  /*
    We intentionally query recent active/non-deleted tasks only.
    This avoids false positives from old archived/deleted test data while still
    catching real duplicate saves created from text + image extraction.
  */
  const sinceIso = new Date(
    Date.now() - 1000 * 60 * 60 * 24 * 180
  ).toISOString();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      id,
      project_id,
      task_title,
      amount,
      deadline_text,
      deadline_date,
      created_at,
      client_name,
      contact_name,
      is_archived,
      deleted_at,
      clients (
        id,
        name,
        contact_name,
        phone,
        email,
        notes,
        created_at
      )
    `
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) {
    console.error("Duplicate detection query failed:", error);
    return null;
  }

  const rows = Array.isArray(data) ? (data as ExistingTaskRow[]) : [];
  const projectGroups = buildExistingProjectGroups(rows);

  let bestMatch: DuplicateProjectMatch | null = null;

  for (const group of projectGroups) {
    const match = scoreExistingProjectGroup(candidate, candidateTitles, group);

    if (!match) continue;

    if (!bestMatch || match.score > bestMatch.score) {
      bestMatch = match;
    }
  }

  if (!bestMatch) return null;

  /*
    Thresholds:
    - high: very likely same client project.
    - medium: useful warning, but user may still save anyway.
  */
  if (bestMatch.score >= 78) {
    return {
      ...bestMatch,
      confidence: "high",
    };
  }

  if (bestMatch.score >= 66) {
    return {
      ...bestMatch,
      confidence: "medium",
    };
  }

  return null;
}

export function buildDuplicateCandidateFromProjectPayload(projectPayload: {
  client_name: string;
  contact_name?: string | null;
  amount?: string | number | null;
  deadline_text?: string | null;
  deadline_date?: string | null;
  title?: string | null;
  summary?: string | null;
  subtasks?: DuplicateProjectSubtaskCandidate[];
}): DuplicateProjectCandidate {
  return {
    client_name: projectPayload.client_name || "",
    contact_name: projectPayload.contact_name || "",
    amount: projectPayload.amount ?? "",
    deadline_text: projectPayload.deadline_text || "",
    deadline_date: projectPayload.deadline_date || "",
    project_title: projectPayload.title || "",
    summary: projectPayload.summary || "",
    subtasks: Array.isArray(projectPayload.subtasks)
      ? projectPayload.subtasks
      : [],
  };
}

function buildExistingProjectGroups(rows: ExistingTaskRow[]) {
  const groups = new Map<string, ExistingProjectGroup>();

  for (const row of rows) {
    const clientName = getExistingClientName(row);
    const createdDay = row.created_at ? row.created_at.slice(0, 10) : "";
    const groupKey =
      row.project_id ||
      [
        normalizeText(clientName) || "unknown-client",
        createdDay || "unknown-date",
        normalizeAmount(row.amount || ""),
        normalizeDeadline(row.deadline_text || row.deadline_date || ""),
      ].join("::");

    const existing = groups.get(groupKey);

    if (existing) {
      existing.tasks.push(row);
      continue;
    }

    groups.set(groupKey, {
      key: groupKey,
      project_id: row.project_id || null,
      client_name: clientName,
      contact_name: getExistingContactName(row),
      amount: row.amount || null,
      deadline_text: row.deadline_text || null,
      deadline_date: row.deadline_date || null,
      created_at: row.created_at || null,
      tasks: [row],
    });
  }

  return Array.from(groups.values());
}

function scoreExistingProjectGroup(
  candidate: DuplicateProjectCandidate,
  candidateTitles: string[],
  group: ExistingProjectGroup
): DuplicateProjectMatch | null {
  const candidateClient = normalizeText(candidate.client_name);
  const existingClient = normalizeText(group.client_name);

  if (!candidateClient || !existingClient) {
    return null;
  }

  const clientScore = getClientScore(candidateClient, existingClient);

  /*
    If client/company is not clearly similar, this is not a duplicate.
  */
  if (clientScore < 0.82) {
    return null;
  }

  const candidateContact = normalizeText(candidate.contact_name || "");
  const existingContact = normalizeText(group.contact_name || "");
  const candidateAmount = normalizeAmount(candidate.amount);
  const existingAmount = normalizeAmount(group.amount);
  const candidateDeadline = normalizeDeadline(
    candidate.deadline_date || candidate.deadline_text || ""
  );
  const existingDeadline = normalizeDeadline(
    group.deadline_date || group.deadline_text || ""
  );

  const existingTitles = group.tasks
    .map((task) => task.task_title || "")
    .map(cleanTaskTitle)
    .filter(Boolean);

  if (existingTitles.length === 0) {
    return null;
  }

  const titleComparison = compareTaskTitleSets(candidateTitles, existingTitles);

  let score = 0;
  const reasons: string[] = [];

  score += clientScore * 32;

  if (clientScore >= 0.96) {
    reasons.push("same client/company");
  } else {
    reasons.push("similar client/company");
  }

  if (candidateContact && existingContact) {
    const contactScore = getTextSimilarity(candidateContact, existingContact);

    if (contactScore >= 0.9) {
      score += 10;
      reasons.push("same contact person");
    } else if (contactScore >= 0.72) {
      score += 6;
      reasons.push("similar contact person");
    }
  }

  if (candidateAmount && existingAmount) {
    if (candidateAmount === existingAmount) {
      score += 18;
      reasons.push("same project value");
    } else {
      const amountDistanceScore = getNumericClosenessScore(
        candidateAmount,
        existingAmount
      );

      if (amountDistanceScore >= 0.9) {
        score += 12;
        reasons.push("very similar project value");
      }
    }
  }

  if (candidateDeadline && existingDeadline) {
    if (candidateDeadline === existingDeadline) {
      score += 12;
      reasons.push("same deadline");
    } else {
      const deadlineScore = getTextSimilarity(candidateDeadline, existingDeadline);

      if (deadlineScore >= 0.82) {
        score += 8;
        reasons.push("similar deadline");
      }
    }
  }

  score += titleComparison.averageBestScore * 24;
  score += titleComparison.coverageScore * 14;

  if (titleComparison.matchedCount >= Math.min(candidateTitles.length, 2)) {
    reasons.push(`${titleComparison.matchedCount} matching subtasks`);
  }

  const taskCountScore = getTaskCountScore(candidateTitles.length, existingTitles.length);
  score += taskCountScore * 8;

  if (taskCountScore >= 0.9) {
    reasons.push("same number of subtasks");
  } else if (taskCountScore >= 0.65) {
    reasons.push("similar number of subtasks");
  }

  const roundedScore = Math.min(Math.round(score), 100);

  if (roundedScore < 66) {
    return null;
  }

  const firstTask = group.tasks[0];

  return {
    project_id: group.project_id,
    existing_task_id: firstTask.id,
    client_name: group.client_name,
    contact_name: group.contact_name,
    amount: group.amount,
    deadline_text: group.deadline_text,
    deadline_date: group.deadline_date,
    created_at: group.created_at,
    task_count: group.tasks.length,
    matched_task_count: titleComparison.matchedCount,
    score: roundedScore,
    confidence: roundedScore >= 78 ? "high" : "medium",
    reason: reasons.join(", "),
    existing_tasks: group.tasks.map((task) => ({
      id: task.id,
      task_title: task.task_title || "Untitled task",
    })),
  };
}

function getCandidateTaskTitles(candidate: DuplicateProjectCandidate) {
  const titles = candidate.subtasks
    .map((subtask) =>
      cleanTaskTitle(
        subtask.task_title || subtask.task || subtask.title || ""
      )
    )
    .filter(Boolean);

  if (titles.length > 0) {
    return titles;
  }

  const fallbackTitle = cleanTaskTitle(
    candidate.project_title || candidate.summary || ""
  );

  return fallbackTitle ? [fallbackTitle] : [];
}

function getExistingClientName(row: ExistingTaskRow) {
  return (
    row.clients?.name?.trim() ||
    row.client_name?.trim() ||
    "Unknown client"
  );
}

function getExistingContactName(row: ExistingTaskRow) {
  return (
    row.clients?.contact_name?.trim() ||
    row.contact_name?.trim() ||
    null
  );
}

function getClientScore(candidateClient: string, existingClient: string) {
  if (candidateClient === existingClient) return 1;

  if (
    candidateClient.includes(existingClient) ||
    existingClient.includes(candidateClient)
  ) {
    return 0.95;
  }

  return getTextSimilarity(candidateClient, existingClient);
}

function compareTaskTitleSets(candidateTitles: string[], existingTitles: string[]) {
  let totalBestScore = 0;
  let matchedCount = 0;

  for (const candidateTitle of candidateTitles) {
    const bestScore = Math.max(
      ...existingTitles.map((existingTitle) =>
        getTextSimilarity(candidateTitle, existingTitle)
      )
    );

    totalBestScore += bestScore;

    if (bestScore >= 0.72) {
      matchedCount += 1;
    }
  }

  const averageBestScore =
    candidateTitles.length > 0 ? totalBestScore / candidateTitles.length : 0;

  const coverageScore =
    candidateTitles.length > 0 ? matchedCount / candidateTitles.length : 0;

  return {
    averageBestScore,
    coverageScore,
    matchedCount,
  };
}

function getTaskCountScore(candidateCount: number, existingCount: number) {
  if (candidateCount <= 0 || existingCount <= 0) return 0;
  if (candidateCount === existingCount) return 1;

  const smaller = Math.min(candidateCount, existingCount);
  const larger = Math.max(candidateCount, existingCount);

  return smaller / larger;
}

function getNumericClosenessScore(candidateValue: string, existingValue: string) {
  const candidateNumber = Number(candidateValue);
  const existingNumber = Number(existingValue);

  if (!Number.isFinite(candidateNumber) || !Number.isFinite(existingNumber)) {
    return 0;
  }

  if (candidateNumber === existingNumber) return 1;

  const smaller = Math.min(candidateNumber, existingNumber);
  const larger = Math.max(candidateNumber, existingNumber);

  if (larger === 0) return 0;

  return smaller / larger;
}

function normalizeText(value: unknown) {
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

function cleanTaskTitle(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|please|need|needs|for|to|and|with|new)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAmount(value: unknown) {
  const raw = String(value || "").toLowerCase().trim();

  if (!raw) return "";

  const numberMatch = raw.replace(/,/g, "").match(/\d+(\.\d+)?/);

  if (!numberMatch) return "";

  return String(Number(numberMatch[0]));
}

function normalizeDeadline(value: unknown) {
  const raw = String(value || "").toLowerCase().trim();

  if (!raw) return "";

  return raw
    .replace(/\bby\b/g, "")
    .replace(/\bdue\b/g, "")
    .replace(/\bon\b/g, "")
    .replace(/[^\w\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTextSimilarity(a: string, b: string) {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);

  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  const intersection = new Set(
    Array.from(aTokens).filter((token) => bTokens.has(token))
  );

  const union = new Set([...Array.from(aTokens), ...Array.from(bTokens)]);

  return intersection.size / union.size;
}

function tokenize(value: string) {
  return new Set(
    String(value || "")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  );
}