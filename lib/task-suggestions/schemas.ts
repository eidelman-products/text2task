export type TaskSuggestionType = "improvement" | "warning" | "issue";

export type TaskSuggestionField =
  | "title"
  | "amount"
  | "deadline"
  | "priority"
  | "general";

export type TaskSuggestion = {
  type: TaskSuggestionType;
  field: TaskSuggestionField;
  message: string;
  suggestion?: string;
};

export type TaskSuggestionInput = {
  client_name?: string | null;
  task_title?: string | null;
  amount?: string | number | null;
  deadline_text?: string | null;
  priority?: string | null;
  source?: string | null;
};

export type BatchSuggestionType = TaskSuggestionType;

export type BatchSuggestionField = TaskSuggestionField;

export type SuggestionAction =
  | {
      type: "set_priority";
      value: "Low" | "Medium" | "High";
    }
  | {
      type: "set_amount";
      value: string;
    };

export type BatchTaskSuggestion = {
  type: BatchSuggestionType;
  field: BatchSuggestionField;
  message: string;
  suggestion?: string;
  action?: SuggestionAction;
};

export type BatchSuggestionTaskInput = {
  previewId: string;
  client_name: string;
  task_title: string;
  amount: string;
  deadline_text: string;
  priority: "Low" | "Medium" | "High";
  source: string;
};

export type RawBatchResult = {
  previewId: string;
  suggestions: BatchTaskSuggestion[];
};

export type AppliedTaskChange = {
  field: "amount" | "priority";
  before: string;
  after: string;
};

export type ParsedBatchResult = {
  previewId: string;
  suggestions: BatchTaskSuggestion[];
  appliedTask: BatchSuggestionTaskInput;
  changes: AppliedTaskChange[];
  aiApplied: boolean;
};

export class InvalidSuggestionOutputError extends Error {
  constructor() {
    super("Invalid suggestion model output");
    this.name = "InvalidSuggestionOutputError";
  }
}

export function parseTaskSuggestionsResponse(raw: string): TaskSuggestion[] {
  const parsed = parseJson(raw);

  if (!Array.isArray(parsed)) {
    throw new InvalidSuggestionOutputError();
  }

  return normalizeSuggestions(parsed);
}

export function parseBatchSuggestionsResponse(
  raw: string,
  sourceTasks: BatchSuggestionTaskInput[]
): ParsedBatchResult[] {
  const jsonText = extractJsonObject(raw);
  const parsed = parseJson(jsonText);

  if (!isRecord(parsed) || !Array.isArray(parsed.results)) {
    throw new InvalidSuggestionOutputError();
  }

  const normalized = parsed.results.map(normalizeBatchResult);

  const byPreviewId = new Map<string, BatchTaskSuggestion[]>(
    normalized
      .filter((item) => item.previewId)
      .map((item) => [item.previewId, item.suggestions])
  );

  return sourceTasks.map((task) => {
    const rawSuggestions = byPreviewId.get(task.previewId) || [];

    const suggestionsWithActions = enrichSuggestionsWithActions(
      rawSuggestions,
      task
    );

    const { updatedTask, changes, aiApplied } = applySuggestionsToTask(
      task,
      suggestionsWithActions
    );

    return {
      previewId: task.previewId,
      suggestions: suggestionsWithActions,
      appliedTask: updatedTask,
      changes,
      aiApplied,
    };
  });
}

function normalizeBatchResult(value: unknown): RawBatchResult {
  if (!isRecord(value)) {
    return {
      previewId: "",
      suggestions: [],
    };
  }

  return {
    previewId:
      typeof value.previewId === "string" ? value.previewId : "",
    suggestions: normalizeSuggestions(value.suggestions),
  };
}

function enrichSuggestionsWithActions(
  suggestions: BatchTaskSuggestion[],
  task: BatchSuggestionTaskInput
): BatchTaskSuggestion[] {
  return suggestions.map((suggestion) => {
    if (suggestion.field === "amount" && task.amount) {
      const normalizedMoney = normalizeExplicitMoney(task.amount);

      if (normalizedMoney && normalizedMoney !== task.amount.trim()) {
        return {
          ...suggestion,
          action: {
            type: "set_amount",
            value: normalizedMoney,
          },
        };
      }
    }

    if (suggestion.field === "priority") {
      const normalizedSuggestion = (suggestion.suggestion || "").trim();

      if (
        normalizedSuggestion === "High" ||
        normalizedSuggestion === "Medium" ||
        normalizedSuggestion === "Low"
      ) {
        return {
          ...suggestion,
          action: {
            type: "set_priority",
            value: normalizedSuggestion,
          },
        };
      }
    }

    return suggestion;
  });
}

function applySuggestionsToTask(
  task: BatchSuggestionTaskInput,
  suggestions: BatchTaskSuggestion[]
): {
  updatedTask: BatchSuggestionTaskInput;
  changes: AppliedTaskChange[];
  aiApplied: boolean;
} {
  const updatedTask: BatchSuggestionTaskInput = { ...task };
  const changes: AppliedTaskChange[] = [];

  suggestions.forEach((suggestion) => {
    if (!suggestion.action) return;

    if (suggestion.action.type === "set_amount") {
      const before = updatedTask.amount;
      const after = suggestion.action.value;

      if (before !== after) {
        updatedTask.amount = after;
        changes.push({
          field: "amount",
          before,
          after,
        });
      }
    }

    if (suggestion.action.type === "set_priority") {
      const before = updatedTask.priority;
      const after = suggestion.action.value;

      if (before !== after) {
        updatedTask.priority = after;
        changes.push({
          field: "priority",
          before,
          after,
        });
      }
    }
  });

  return {
    updatedTask,
    changes,
    aiApplied: changes.length > 0,
  };
}

function normalizeExplicitMoney(amount: string): string | null {
  const raw = amount.trim();

  if (!raw || !hasCurrency(raw)) {
    return null;
  }

  const amountNumber = normalizeAmountNumber(raw);
  if (!amountNumber) {
    return null;
  }

  const currency = detectCurrency(raw);
  if (!currency) {
    return null;
  }

  return `${amountNumber} ${currency}`;
}

function detectCurrency(amount: string): "USD" | "EUR" | "GBP" | "ILS" | null {
  const normalized = amount.trim().toUpperCase();

  if (normalized.includes("$") || /\bUSD\b/.test(normalized)) {
    return "USD";
  }

  if (normalized.includes("€") || /\bEUR\b/.test(normalized)) {
    return "EUR";
  }

  if (normalized.includes("£") || /\bGBP\b/.test(normalized)) {
    return "GBP";
  }

  if (
    normalized.includes("₪") ||
    /\bILS\b/.test(normalized) ||
    /\bNIS\b/.test(normalized)
  ) {
    return "ILS";
  }

  return null;
}

function hasCurrency(amount: string) {
  const normalized = amount.trim().toUpperCase();

  return (
    /[$€₪£]/.test(normalized) ||
    /\b(USD|EUR|GBP|ILS|NIS)\b/.test(normalized)
  );
}

function normalizeAmountNumber(amount: string) {
  return amount
    .replace(/[$€₪£]/g, "")
    .replace(/\b(USD|EUR|GBP|ILS|NIS)\b/gi, "")
    .replace(/,/g, "")
    .trim();
}

function normalizeSuggestions(value: unknown): BatchTaskSuggestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeSuggestion(item))
    .filter((item): item is BatchTaskSuggestion => item !== null)
    .slice(0, 3);
}

function normalizeSuggestion(value: unknown): BatchTaskSuggestion | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = normalizeType(value.type);
  const field = normalizeField(value.field);
  const message = normalizeText(value.message);
  const suggestion = normalizeOptionalText(value.suggestion);

  if (!type || !field || !message) {
    return null;
  }

  return {
    type,
    field,
    message,
    ...(suggestion ? { suggestion } : {}),
  };
}

function normalizeType(value: unknown): TaskSuggestionType | null {
  if (typeof value !== "string") return null;

  switch (value.trim().toLowerCase()) {
    case "improvement":
      return "improvement";
    case "warning":
      return "warning";
    case "issue":
      return "issue";
    default:
      return null;
  }
}

function normalizeField(value: unknown): TaskSuggestionField | null {
  if (typeof value !== "string") return null;

  switch (value.trim().toLowerCase()) {
    case "title":
      return "title";
    case "amount":
      return "amount";
    case "deadline":
      return "deadline";
    case "priority":
      return "priority";
    case "general":
      return "general";
    default:
      return null;
  }
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const text = value.trim();
  return text ? text : null;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const text = value.trim();
  return text || undefined;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new InvalidSuggestionOutputError();
  }
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  throw new InvalidSuggestionOutputError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
