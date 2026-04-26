export type ExtractedPreviewPriority = "Low" | "Medium" | "High";

export type ExtractedPreview = {
  previewId: string;
  client: string;
  task: string;
  amount: string;
  deadline: string;
  priority: ExtractedPreviewPriority;
  status: string;
  source: string;
  raw_input?: string;
  deadline_date?: string | null;
  deadline_original_text?: string | null;
};

export type HybridAppliedChange = {
  field: "amount" | "deadline" | "priority";
  before: string;
  after: string;
};

export type HybridPreviewMeta = {
  aiApplied: boolean;
  changes: HybridAppliedChange[];
};

type SuggestBatchRequestTask = {
  previewId: string;
  client_name: string;
  task_title: string;
  amount: string;
  deadline_text: string;
  priority: ExtractedPreviewPriority;
  source: string;
};

type SuggestBatchResponseItem = {
  previewId: string;
  appliedTask?: {
    previewId: string;
    client_name: string;
    task_title: string;
    amount: string;
    deadline_text: string;
    priority: ExtractedPreviewPriority;
    source: string;
  };
  changes?: HybridAppliedChange[];
  aiApplied?: boolean;
};

export type BuildHybridPreviewResult = {
  previewItems: ExtractedPreview[];
  aiMetaByPreviewId: Record<string, HybridPreviewMeta>;
};

function normalizeValue(value?: string | null) {
  return (value || "").trim();
}

function buildSystemDeadlineChange(
  preview: ExtractedPreview
): HybridAppliedChange | null {
  const originalText = normalizeValue(
    preview.deadline_original_text || preview.deadline
  );
  const parsedDate = normalizeValue(preview.deadline_date);

  if (!originalText || !parsedDate) {
    return null;
  }

  if (originalText === parsedDate) {
    return null;
  }

  return {
    field: "deadline",
    before: originalText,
    after: parsedDate,
  };
}

function mergeChanges(
  systemChanges: HybridAppliedChange[],
  aiChanges: HybridAppliedChange[]
) {
  const merged: HybridAppliedChange[] = [];
  const seen = new Set<string>();

  for (const change of [...systemChanges, ...aiChanges]) {
    const key = `${change.field}::${change.before}::${change.after}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(change);
  }

  return merged;
}

function getRawDeadlineForSuggest(preview: ExtractedPreview) {
  return (
    normalizeValue(preview.deadline_original_text) ||
    normalizeValue(preview.deadline_date) ||
    normalizeValue(preview.deadline) ||
    ""
  );
}

function mapPreviewToSuggestTask(
  preview: ExtractedPreview
): SuggestBatchRequestTask {
  return {
    previewId: preview.previewId,
    client_name: preview.client,
    task_title: preview.task,
    amount: preview.amount,
    deadline_text: getRawDeadlineForSuggest(preview),
    priority: preview.priority,
    source: preview.source,
  };
}

function mapAppliedTaskToPreview(
  appliedTask: NonNullable<SuggestBatchResponseItem["appliedTask"]>,
  originalPreview: ExtractedPreview
): ExtractedPreview {
  return {
    previewId: appliedTask.previewId,
    client: appliedTask.client_name || "",
    task: appliedTask.task_title || "",
    amount: appliedTask.amount || "",
    deadline: originalPreview.deadline,
    priority:
      appliedTask.priority === "High"
        ? "High"
        : appliedTask.priority === "Low"
        ? "Low"
        : "Medium",
    status: originalPreview.status || "Not Started",
    source: appliedTask.source || "",
    raw_input: originalPreview.raw_input,
    deadline_date: originalPreview.deadline_date ?? null,
    deadline_original_text:
      originalPreview.deadline_original_text ?? originalPreview.deadline ?? null,
  };
}

export function getEmptyHybridMetaMap(
  previewItems: ExtractedPreview[]
): Record<string, HybridPreviewMeta> {
  const map: Record<string, HybridPreviewMeta> = {};

  for (const preview of previewItems) {
    const systemDeadlineChange = buildSystemDeadlineChange(preview);

    map[preview.previewId] = {
      aiApplied: false,
      changes: systemDeadlineChange ? [systemDeadlineChange] : [],
    };
  }

  return map;
}

export async function buildHybridPreviewItems(
  previewItems: ExtractedPreview[]
): Promise<BuildHybridPreviewResult> {
  if (!previewItems.length) {
    return {
      previewItems: [],
      aiMetaByPreviewId: {},
    };
  }

  const res = await fetch("/api/tasks/suggest-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tasks: previewItems.map(mapPreviewToSuggestTask),
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Failed to build hybrid preview");
  }

  const results: SuggestBatchResponseItem[] = Array.isArray(data?.results)
    ? data.results
    : [];

  const resultsByPreviewId = new Map<string, SuggestBatchResponseItem>(
    results.map((item) => [item.previewId, item])
  );

  const nextPreviewItems = previewItems.map((preview) => {
    const result = resultsByPreviewId.get(preview.previewId);

    if (result?.appliedTask) {
      return mapAppliedTaskToPreview(result.appliedTask, preview);
    }

    return preview;
  });

  const aiMetaByPreviewId: Record<string, HybridPreviewMeta> = {};

  for (const preview of nextPreviewItems) {
    const result = resultsByPreviewId.get(preview.previewId);
    const aiChanges = Array.isArray(result?.changes) ? result.changes : [];
    const systemDeadlineChange = buildSystemDeadlineChange(preview);
    const mergedChanges = mergeChanges(
      systemDeadlineChange ? [systemDeadlineChange] : [],
      aiChanges
    );

    aiMetaByPreviewId[preview.previewId] = {
      aiApplied: !!result?.aiApplied,
      changes: mergedChanges,
    };
  }

  return {
    previewItems: nextPreviewItems,
    aiMetaByPreviewId,
  };
}