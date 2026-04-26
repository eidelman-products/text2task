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

export const TASK_SUGGESTIONS_SYSTEM_PROMPT = `
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

export function buildTaskSuggestionsUserPrompt(
  input: TaskSuggestionInput
): string {
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

function normalizeString(value?: string | null): string {
  if (!value) return "";
  return value.trim();
}

function normalizeAmount(value?: string | number | null): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}