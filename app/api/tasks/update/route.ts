import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseDeadline } from "@/lib/tasks/parse-deadline";
import { parseAmount } from "@/lib/tasks/parse-amount";

const UpdateTaskSchema = z.object({
  taskId: z.number(),
  field: z.enum([
    "task",
    "amount",
    "deadline",
    "priority",
    "status",
    "phone",
    "email",
    "notes",
    "archive",
    "restore",
  ]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

function normalizeAmountInput(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  return null;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function isDoneStatus(status: unknown) {
  return String(status || "").trim().toLowerCase() === "done";
}

function cleanJoinedTask(data: any, fallbackClient: any = null) {
  const task = {
    ...data,
    client: Array.isArray(data?.clients)
      ? data.clients[0] ?? fallbackClient
      : data?.clients ?? fallbackClient,
  };

  const { clients, ...cleanTask } = task;
  return cleanTask;
}

async function reloadTask({
  supabase,
  taskId,
  userId,
  fallbackClient,
}: {
  supabase: any;
  taskId: number;
  userId: string;
  fallbackClient?: any;
}) {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      clients (
        id,
        name,
        phone,
        email,
        notes,
        created_at
      )
    `
    )
    .eq("id", taskId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (error) {
    throw new Error(error.message || "Failed to reload updated task");
  }

  return cleanJoinedTask(data, fallbackClient ?? null);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = UpdateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { taskId, field, value } = parsed.data;

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: existingTask, error: existingTaskError } = await supabase
      .from("tasks")
      .select(
        `
        id,
        user_id,
        client_id,
        client_name,
        task_title,
        amount,
        amount_value,
        currency_code,
        deadline_text,
        deadline_date,
        priority,
        status,
        source,
        raw_input,
        is_archived,
        archived_at,
        completed_at,
        deleted_at,
        created_at,
        clients (
          id,
          name,
          phone,
          email,
          notes,
          created_at
        )
      `
      )
      .eq("id", taskId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (existingTaskError || !existingTask) {
      return NextResponse.json(
        { error: existingTaskError?.message || "Task not found" },
        { status: 404 }
      );
    }

    const currentClient = Array.isArray((existingTask as any).clients)
      ? (existingTask as any).clients[0] ?? null
      : (existingTask as any).clients ?? null;

    if (field === "phone" || field === "email" || field === "notes") {
      if (!existingTask.client_id) {
        return NextResponse.json(
          {
            error:
              "Cannot update client details because this task has no linked client",
          },
          { status: 400 }
        );
      }

      const normalizedValue = normalizeOptionalText(value);

      const clientUpdateData: Record<string, string | null> = {};

      if (field === "phone") {
        clientUpdateData.phone = normalizedValue;
      }

      if (field === "email") {
        clientUpdateData.email = normalizedValue;
      }

      if (field === "notes") {
        clientUpdateData.notes = normalizedValue;
      }

      const { error: clientUpdateError } = await supabase
        .from("clients")
        .update(clientUpdateData)
        .eq("id", existingTask.client_id)
        .eq("user_id", user.id);

      if (clientUpdateError) {
        console.error("Client update error:", clientUpdateError);

        return NextResponse.json(
          {
            error:
              clientUpdateError.message || "Failed to update client details",
          },
          { status: 500 }
        );
      }

      const cleanTask = await reloadTask({
        supabase,
        taskId,
        userId: user.id,
        fallbackClient: currentClient,
      });

      return NextResponse.json({
        success: true,
        task: cleanTask,
      });
    }

    let updateData: Record<string, unknown> = {};
    const nowIso = new Date().toISOString();

    switch (field) {
      case "task": {
        updateData.task_title = typeof value === "string" ? value.trim() : "";
        break;
      }

      case "amount": {
        const normalizedInput = normalizeAmountInput(value);
        const parsedAmount = parseAmount(normalizedInput);

        updateData.amount =
          parsedAmount.displayAmount ??
          (typeof normalizedInput === "string"
            ? normalizedInput
            : typeof normalizedInput === "number"
            ? String(normalizedInput)
            : null);

        updateData.amount_value = parsedAmount.amountValue;
        updateData.currency_code = parsedAmount.currencyCode;
        break;
      }

      case "deadline": {
        const deadlineText = typeof value === "string" ? value.trim() : "";
        const parsedDeadline = parseDeadline(deadlineText);

        updateData.deadline_text = deadlineText;
        updateData.deadline_date = parsedDeadline.deadlineDate;
        break;
      }

      case "priority": {
        updateData.priority =
          typeof value === "string" && value.trim() ? value.trim() : "Medium";
        break;
      }

      case "status": {
        const nextStatus =
          typeof value === "string" && value.trim() ? value.trim() : "New";

        updateData.status = nextStatus;

        /*
          Lifetime Completed:
          ברגע שמשימה סומנה Done פעם אחת — completed_at נשמר.
          גם אם המשתמש אחר כך מעביר לארכיון או מוחק לצמיתות,
          הספירה ההיסטורית של Done לא תיעלם.
        */
        if (isDoneStatus(nextStatus) && !existingTask.completed_at) {
          updateData.completed_at = nowIso;
        }

        break;
      }

      case "archive": {
        updateData.is_archived = true;
        updateData.archived_at = existingTask.archived_at || nowIso;
        break;
      }

      case "restore": {
        updateData.is_archived = false;
        updateData.archived_at = null;
        break;
      }

      default:
        return NextResponse.json(
          { error: "Unsupported field" },
          { status: 400 }
        );
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", taskId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select(
        `
        *,
        clients (
          id,
          name,
          phone,
          email,
          notes,
          created_at
        )
      `
      )
      .single();

    if (error) {
      console.error("Task update error:", error);

      return NextResponse.json(
        { error: error.message || "Failed to update task" },
        { status: 500 }
      );
    }

    const cleanTask = cleanJoinedTask(data, currentClient);

    return NextResponse.json({
      success: true,
      task: cleanTask,
    });
  } catch (error: any) {
    console.error("Update task route error:", error);

    return NextResponse.json(
      { error: error.message || "Failed to update task" },
      { status: 500 }
    );
  }
}