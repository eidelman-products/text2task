export type BatchSuggestionType = "improvement" | "warning" | "issue";

export type BatchSuggestionField =
  | "title"
  | "amount"
  | "deadline"
  | "priority"
  | "general";

export type BatchSuggestionActionType =
  | "set_deadline"
  | "set_priority"
  | "set_amount_currency";

export type BatchSuggestionAction = {
  type: BatchSuggestionActionType;
  value: string;
};

export type BatchTaskSuggestion = {
  type: BatchSuggestionType;
  field: BatchSuggestionField;
  message: string;
  suggestion?: string;
  action?: BatchSuggestionAction;
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

export type BatchSuggestionResult = {
  previewId: string;
  suggestions: BatchTaskSuggestion[];
};

type BatchSuggestionsResponse = {
  results?: BatchSuggestionResult[];
};

export async function fetchBatchSuggestions(
  tasks: BatchSuggestionTaskInput[]
): Promise<Record<string, BatchTaskSuggestion[]>> {
  if (!tasks.length) {
    return {};
  }

  const response = await fetch("/api/tasks/suggest-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tasks }),
  });

  const data = (await response.json()) as BatchSuggestionsResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || "Failed to load batch suggestions");
  }

  const results = Array.isArray(data?.results) ? data.results : [];

  return results.reduce<Record<string, BatchTaskSuggestion[]>>((acc, item) => {
    if (!item?.previewId) {
      return acc;
    }

    acc[item.previewId] = Array.isArray(item.suggestions)
      ? item.suggestions
      : [];

    return acc;
  }, {});
}