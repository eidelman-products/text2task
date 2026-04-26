import type {
  TaskSuggestion,
  TaskSuggestionField,
  TaskSuggestionType,
} from "./task-suggestions-prompt";

const ALLOWED_TYPES: TaskSuggestionType[] = [
  "improvement",
  "warning",
  "issue",
];

const ALLOWED_FIELDS: TaskSuggestionField[] = [
  "title",
  "amount",
  "deadline",
  "priority",
  "general",
];

export function parseTaskSuggestionsResponse(raw: string): TaskSuggestion[] {
  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const cleaned = parsed
      .map(normalizeSuggestion)
      .filter((item): item is TaskSuggestion => item !== null)
      .slice(0, 3);

    return cleaned;
  } catch {
    return [];
  }
}

function normalizeSuggestion(value: unknown): TaskSuggestion | null {
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

  const result: TaskSuggestion = {
    type,
    field,
    message,
  };

  if (suggestion) {
    result.suggestion = suggestion;
  }

  return result;
}

function normalizeType(value: unknown): TaskSuggestionType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase() as TaskSuggestionType;

  if (!ALLOWED_TYPES.includes(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeField(value: unknown): TaskSuggestionField | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase() as TaskSuggestionField;

  if (!ALLOWED_FIELDS.includes(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return normalized;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}