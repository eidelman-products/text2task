import "server-only";

import type OpenAI from "openai";

import { openai } from "@/lib/openai";
import {
  InvalidSuggestionOutputError,
  parseBatchSuggestionsResponse,
  parseTaskSuggestionsResponse,
  type BatchSuggestionTaskInput,
  type ParsedBatchResult,
  type TaskSuggestion,
  type TaskSuggestionInput,
} from "@/lib/task-suggestions/schemas";

export const TASK_SUGGESTION_TIMEOUT_MS = 45_000;

const TASK_SUGGESTION_MODEL = "gpt-4.1-mini";

export type TaskSuggestionErrorCode =
  | "suggestion_timeout"
  | "invalid_model_output"
  | "provider_failure"
  | "suggestion_configuration_error";

export class TaskSuggestionError extends Error {
  readonly code: TaskSuggestionErrorCode;

  constructor(code: TaskSuggestionErrorCode) {
    super(code);
    this.name = "TaskSuggestionError";
    this.code = code;
  }
}

const TASK_SUGGESTIONS_SYSTEM_PROMPT = `
You are an AI assistant that analyzes a single task and returns concise smart suggestions.

The product language is English only.
Return output in English only.

Your job is NOT to create new tasks.
Your job is NOT to rewrite the entire task.
Your job is NOT to invent missing data.

Your job is to analyze the task and return up to 3 high-value suggestions that improve clarity and actionability.

Allowed suggestion types:
- improvement
- warning
- issue

Allowed fields:
- title
- amount
- deadline
- priority
- general

Rules:
1. Return valid JSON only.
2. Return an array only.
3. Maximum 3 suggestions.
4. Keep messages short and clear.
5. Keep suggestions extremely short (max 6-8 words).
6. Prefer direct actionable phrases, not explanations.
7. Example: "Use 'Logo design'" instead of long sentences.
8. Do not invent client names, prices, currencies, or dates.
9. Do not guess exact deadlines from vague phrases.
10. Do not guess currency from numbers.
11. Do not split the task into multiple tasks.
12. Do not explain your reasoning.
13. If the task is already clear and actionable, return an empty array.
14. Focus only on the most important issues.
15. Avoid long sentences in suggestions.
16. Prefer short phrases over explanations.
17. Suggest priority if missing or incorrect.
18. Also confirm priority if it is clearly correct.
19. Use only: Low, Medium, or High.
20. Base priority on urgency words, deadlines, and task importance.
21. Keep priority suggestions extremely short (e.g., "High").

What to look for:
- unclear or weak task title
- unclear amount
- vague or missing deadline
- missing important information
- task too broad
- task too small or not meaningful
- priority worth suggesting
- suggest priority based on urgency and context

Examples of good behavior:
- "Logo 500" -> better title + unclear amount
- "Build website" -> too broad + missing amount/deadline
- "Check email" -> may not be a meaningful standalone task
- "Send final invoice by Friday" -> probably no suggestions

Output format:
[
  {
    "type": "improvement" | "warning" | "issue",
    "field": "title" | "amount" | "deadline" | "priority" | "general",
    "message": "Short English message",
    "suggestion": "Optional short English suggestion"
  }
]

Do not wrap the JSON in markdown.
Do not add commentary before or after the JSON.
`.trim();

const BATCH_TASK_SUGGESTIONS_SYSTEM_PROMPT =
  "You analyze task previews and return strict JSON only. No markdown. No extra text.";

export async function suggestTaskImprovements(
  input: TaskSuggestionInput
): Promise<TaskSuggestion[]> {
  const userPrompt = buildTaskSuggestionsUserPrompt(input);

  const response = await createSuggestionChatCompletion({
    model: TASK_SUGGESTION_MODEL,
    messages: [
      {
        role: "system",
        content: TASK_SUGGESTIONS_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const rawContent = getTextFromResponse(response);

  try {
    return parseTaskSuggestionsResponse(rawContent);
  } catch (error) {
    if (error instanceof InvalidSuggestionOutputError) {
      throw new TaskSuggestionError("invalid_model_output");
    }

    throw error;
  }
}

export async function suggestBatchTaskImprovements(
  tasks: BatchSuggestionTaskInput[]
): Promise<ParsedBatchResult[]> {
  const response = await createSuggestionChatCompletion({
    model: TASK_SUGGESTION_MODEL,
    messages: [
      {
        role: "system",
        content: BATCH_TASK_SUGGESTIONS_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildBatchPrompt(tasks),
      },
    ],
    temperature: 0.2,
  });

  const rawText = getTextFromResponse(response);

  try {
    return parseBatchSuggestionsResponse(rawText, tasks);
  } catch (error) {
    if (error instanceof InvalidSuggestionOutputError) {
      throw new TaskSuggestionError("invalid_model_output");
    }

    throw error;
  }
}

function buildTaskSuggestionsUserPrompt(input: TaskSuggestionInput): string {
  const payload = {
    client_name: normalizeString(input.client_name),
    task_title: normalizeString(input.task_title),
    amount: normalizeAmount(input.amount),
    deadline_text: normalizeString(input.deadline_text),
    priority: normalizeString(input.priority),
    source: normalizeString(input.source),
  };

  return `
Analyze this task and return smart suggestions as a JSON array only.

Task:
${JSON.stringify(payload, null, 2)}
  `.trim();
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

async function createSuggestionChatCompletion(
  body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new TaskSuggestionError("suggestion_configuration_error");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, TASK_SUGGESTION_TIMEOUT_MS);

  try {
    return await openai.chat.completions.create(body, {
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new TaskSuggestionError("suggestion_timeout");
    }

    throw new TaskSuggestionError("provider_failure");
  } finally {
    clearTimeout(timeout);
  }
}

function getTextFromResponse(
  response: OpenAI.Chat.Completions.ChatCompletion
): string {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content === "string" && content.trim()) {
    return content;
  }

  throw new TaskSuggestionError("invalid_model_output");
}

function normalizeString(value?: string | null): string {
  if (!value) return "";
  return value.trim();
}

function normalizeAmount(value?: string | number | null): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
