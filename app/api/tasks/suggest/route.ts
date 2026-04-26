import { NextResponse } from "next/server";
import OpenAI from "openai";

import { openai } from "@/lib/openai";
import {
  buildTaskSuggestionsUserPrompt,
  TASK_SUGGESTIONS_SYSTEM_PROMPT,
  type TaskSuggestionInput,
} from "@/lib/ai/task-suggestions-prompt";
import { parseTaskSuggestionsResponse } from "@/lib/ai/task-suggestions-schema";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TaskSuggestionInput;

    const input: TaskSuggestionInput = {
      client_name: body?.client_name ?? "",
      task_title: body?.task_title ?? "",
      amount: body?.amount ?? "",
      deadline_text: body?.deadline_text ?? "",
      priority: body?.priority ?? "",
      source: body?.source ?? "",
    };

    if (!input.task_title || !String(input.task_title).trim()) {
      return NextResponse.json(
        { error: "task_title is required" },
        { status: 400 }
      );
    }

    const userPrompt = buildTaskSuggestionsUserPrompt(input);

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
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
    const suggestions = parseTaskSuggestionsResponse(rawContent);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Task suggestions API error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate task suggestions",
        suggestions: [],
      },
      { status: 500 }
    );
  }
}

function getTextFromResponse(
  response: OpenAI.Chat.Completions.ChatCompletion
): string {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  return "[]";
}