import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  suggestBatchTaskImprovements,
  TaskSuggestionError,
} from "@/lib/task-suggestions/task-suggestion.server";
import type { BatchSuggestionTaskInput } from "@/lib/task-suggestions/schemas";

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
          results: [],
        },
        { status: 400 }
      );
    }

    const tasks = normalizeBatchTasks(body);

    if (!tasks.length) {
      return NextResponse.json({ results: [] });
    }

    const results = await suggestBatchTaskImprovements(tasks);

    return NextResponse.json({ results });
  } catch (error) {
    logSuggestionRouteFailure({
      route: "batch",
      error,
      startedAt,
    });

    return NextResponse.json(
      {
        error: "Failed to generate suggestions",
        results: [],
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

function normalizeBatchTasks(body: unknown): BatchSuggestionTaskInput[] {
  const tasks = isRecord(body) && Array.isArray(body.tasks) ? body.tasks : [];

  return tasks.map((task) => {
    const record: Record<string, unknown> = isRecord(task) ? task : {};

    return {
      previewId: normalizeTextInput(record.previewId),
      client_name: normalizeTextInput(record.client_name),
      task_title: normalizeTextInput(record.task_title),
      amount: normalizeTextInput(record.amount),
      deadline_text: normalizeTextInput(record.deadline_text),
      priority: normalizePriority(record.priority),
      source: normalizeTextInput(record.source),
    };
  });
}

function normalizePriority(value: unknown): "Low" | "Medium" | "High" {
  if (value === "High") {
    return "High";
  }

  if (value === "Low") {
    return "Low";
  }

  return "Medium";
}

function normalizeTextInput(value: unknown): string {
  return String(value || "");
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
  route: "batch";
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
