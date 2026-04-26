import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

type BatchSuggestionType = "improvement" | "warning" | "issue";
type BatchSuggestionField =
  | "title"
  | "amount"
  | "deadline"
  | "priority"
  | "general";

type SuggestionActionType = "set_priority" | "set_amount";

type SuggestionAction = {
  type: SuggestionActionType;
  value: string;
};

type BatchTaskSuggestion = {
  type: BatchSuggestionType;
  field: BatchSuggestionField;
  message: string;
  suggestion?: string;
  action?: SuggestionAction;
};

type BatchSuggestionTaskInput = {
  previewId: string;
  client_name: string;
  task_title: string;
  amount: string;
  deadline_text: string;
  priority: "Low" | "Medium" | "High";
  source: string;
};

type RawBatchResult = {
  previewId?: string;
  suggestions?: BatchTaskSuggestion[];
};

type AppliedTaskChange = {
  field: "amount" | "priority";
  before: string;
  after: string;
};

type ParsedBatchResult = {
  previewId: string;
  suggestions: BatchTaskSuggestion[];
  appliedTask: BatchSuggestionTaskInput;
  changes: AppliedTaskChange[];
  aiApplied: boolean;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tasks = Array.isArray(body?.tasks) ? body.tasks : [];

    if (!tasks.length) {
      return NextResponse.json({ results: [] });
    }

    const safeTasks: BatchSuggestionTaskInput[] = tasks.map((task: any) => ({
      previewId: String(task?.previewId || ""),
      client_name: String(task?.client_name || ""),
      task_title: String(task?.task_title || ""),
      amount: String(task?.amount || ""),
      deadline_text: String(task?.deadline_text || ""),
      priority:
        task?.priority === "High"
          ? "High"
          : task?.priority === "Low"
          ? "Low"
          : "Medium",
      source: String(task?.source || ""),
    }));

    const prompt = buildBatchPrompt(safeTasks);

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You analyze task previews and return strict JSON only. No markdown. No extra text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    const rawText =
      response.choices?.[0]?.message?.content || '{"results":[]}';

    const parsed = parseBatchSuggestionsResponse(rawText, safeTasks);

    console.log("BATCH RESULTS:", JSON.stringify(parsed, null, 2));

    return NextResponse.json({ results: parsed });
  } catch (error) {
    console.error("Batch suggestions error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate suggestions",
        results: [],
      },
      { status: 500 }
    );
  }
}

function buildBatchPrompt(tasks: BatchSuggestionTaskInput[]) {
  return `
Analyze these task previews and return only useful suggestions.

Return valid JSON only in this exact format:
{
  "results": [
    {
      "previewId": "preview-1",
      "suggestions": [
        {
          "type": "improvement" | "warning" | "issue",
          "field": "title" | "amount" | "deadline" | "priority" | "general",
          "message": "Short English message",
          "suggestion": "Optional short English suggestion"
        }
      ]
    }
  ]
}

Core rules:
1. English only.
2. JSON only.
3. Max 3 suggestions per task.
4. Keep messages short, direct, and practical.
5. If the task is already good enough, return an empty suggestions array.
6. Always return the same previewId that was provided.
7. Do not invent dates, currencies, prices, quantities, or facts.
8. Prefer fewer high-value suggestions over many weak suggestions.
9. Do not repeat the same idea twice for the same task.

Title rules:
1. Suggest title improvement only if the title is vague, too long, repetitive, or unclear.
2. Prefer short action-oriented titles.
3. Do not suggest title changes if the current title is already clear.

Amount rules:
1. Treat amount as money only when it clearly represents a payment, price, budget, fee, deposit, invoice amount, salary, or monetary total.
2. Do NOT treat these as money amounts unless explicitly clear:
   - quantities
   - item counts
   - measurements
   - dimensions
   - phone numbers
   - apartment numbers
   - order numbers
   - tracking numbers
   - reference codes
3. If a numeric value exists without clear money context, do not flag amount.
4. Do not invent or guess a currency.
5. If amount is ambiguous, use a warning or issue suggestion instead of pretending it is clear money.

Deadline rules:
1. Suggest a deadline improvement only if missing, vague, or relative.
2. Relative phrases like "next week", "tomorrow", "end of month", "soon", "ASAP" are vague.
3. Do not invent a deadline if none exists.
4. If the deadline is already specific and clear, do not flag it.
5. IMPORTANT: Never rewrite deadline_text into display labels like "Overdue • Jan 5" or "Due in 3 days • Apr 23".
6. IMPORTANT: Never convert deadline_text into ISO strings as an automatic action.
7. Deadline suggestions are advisory only, not auto-applied transformations.

Priority rules:
1. Suggest priority only when the current priority seems mismatched with urgency.
2. If you suggest priority, the suggestion text must be exactly one of:
   - High
   - Medium
   - Low
3. Use High only for urgent or time-sensitive work.
4. Use Medium for normal work.
5. Use Low for non-urgent work.

General behavior:
1. Focus on real data quality improvements.
2. Avoid cosmetic or low-value suggestions.
3. If the task has one strong issue, return that instead of multiple minor notes.

Tasks:
${JSON.stringify(tasks, null, 2)}
`.trim();
}

function parseBatchSuggestionsResponse(
  raw: string,
  sourceTasks: BatchSuggestionTaskInput[]
): ParsedBatchResult[] {
  try {
    const jsonText = extractJsonObject(raw);
    const parsed = JSON.parse(jsonText);
    const results = Array.isArray(parsed?.results) ? parsed.results : [];

    const normalized: RawBatchResult[] = results.map((item: RawBatchResult) => ({
      previewId: typeof item?.previewId === "string" ? item.previewId : "",
      suggestions: normalizeSuggestions(item?.suggestions),
    }));

    const byPreviewId = new Map<string, BatchTaskSuggestion[]>(
      normalized
        .filter((item) => item.previewId)
        .map((item) => [item.previewId as string, item.suggestions || []])
    );

    return sourceTasks.map((task: BatchSuggestionTaskInput) => {
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
  } catch {
    return sourceTasks.map((task: BatchSuggestionTaskInput) => ({
      previewId: task.previewId,
      suggestions: [],
      appliedTask: task,
      changes: [],
      aiApplied: false,
    }));
  }
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
      const after = suggestion.action.value as "Low" | "Medium" | "High";

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
    .map((item: unknown) => normalizeSuggestion(item))
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

function normalizeType(value: unknown): BatchSuggestionType | null {
  if (typeof value !== "string") return null;

  if (
    value !== "improvement" &&
    value !== "warning" &&
    value !== "issue"
  ) {
    return null;
  }

  return value;
}

function normalizeField(value: unknown): BatchSuggestionField | null {
  if (typeof value !== "string") return null;

  if (
    value !== "title" &&
    value !== "amount" &&
    value !== "deadline" &&
    value !== "priority" &&
    value !== "general"
  ) {
    return null;
  }

  return value;
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

  throw new Error("No JSON object found in model response");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}