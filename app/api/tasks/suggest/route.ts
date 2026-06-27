import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  suggestTaskImprovements,
  TaskSuggestionError,
} from "@/lib/task-suggestions/task-suggestion.server";
import type { TaskSuggestionInput } from "@/lib/task-suggestions/schemas";

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const isAuthenticated = await hasAuthenticatedUser();

    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body",
          suggestions: [],
        },
        { status: 400 }
      );
    }

    const input = normalizeTaskSuggestionInput(body);

    if (!input.task_title || !String(input.task_title).trim()) {
      return NextResponse.json(
        { error: "task_title is required" },
        { status: 400 }
      );
    }

    const suggestions = await suggestTaskImprovements(input);

    return NextResponse.json({ suggestions });
  } catch (error) {
    logSuggestionRouteFailure({
      route: "single",
      error,
      startedAt,
    });

    return NextResponse.json(
      {
        error: "Failed to generate task suggestions",
        suggestions: [],
      },
      { status: getSuggestionErrorStatus(error) }
    );
  }
}

async function hasAuthenticatedUser(): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return !error && Boolean(user?.id);
}

function normalizeTaskSuggestionInput(body: unknown): TaskSuggestionInput {
  const record: Record<string, unknown> = isRecord(body) ? body : {};

  return {
    client_name: normalizeTextInput(record.client_name),
    task_title: normalizeTextInput(record.task_title),
    amount: normalizeTextInput(record.amount),
    deadline_text: normalizeTextInput(record.deadline_text),
    priority: normalizeTextInput(record.priority),
    source: normalizeTextInput(record.source),
  };
}

function normalizeTextInput(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function getSuggestionErrorStatus(error: unknown) {
  if (
    error instanceof TaskSuggestionError &&
    error.code === "suggestion_timeout"
  ) {
    return 504;
  }

  return 500;
}

function logSuggestionRouteFailure({
  route,
  error,
  startedAt,
}: {
  route: "single";
  error: unknown;
  startedAt: number;
}) {
  console.error("Task suggestion route failed", {
    route,
    category:
      error instanceof TaskSuggestionError ? error.code : "unexpected_error",
    elapsedMs: Date.now() - startedAt,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
