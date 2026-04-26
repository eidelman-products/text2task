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
  ]),
  value: z.union([z.string(), z.number(), z.null()]),
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
          { error: "Cannot update client details because this task has no linked client" },
          { status: 400 }
        );
      }

      const normalizedValue = normalizeOptionalText(value);

      let clientUpdateData: Record<string, string | null> = {};

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
          { error: clientUpdateError.message || "Failed to update client details" },
          { status: 500 }
        );
      }

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
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Reload task after client update error:", error);

        return NextResponse.json(
          { error: error.message || "Failed to reload updated task" },
          { status: 500 }
        );
      }

      const task = {
        ...data,
        client: Array.isArray((data as any).clients)
          ? (data as any).clients[0] ?? currentClient
          : (data as any).clients ?? currentClient,
      };

      const { clients, ...cleanTask } = task as any;

      return NextResponse.json({
        success: true,
        task: cleanTask,
      });
    }

    let updateData: Record<string, unknown> = {};

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
        updateData.status =
          typeof value === "string" && value.trim() ? value.trim() : "New";
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

    const task = {
      ...data,
      client: Array.isArray((data as any).clients)
        ? (data as any).clients[0] ?? currentClient
        : (data as any).clients ?? currentClient,
    };

    const { clients, ...cleanTask } = task as any;

    return NextResponse.json({
      success: true,
      task: cleanTask,
    });
  } catch (error) {
    console.error("Update task route error:", error);

    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}