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

const TASK_WITH_CONTEXT_SELECT = `
  *,
  clients (
    id,
    name,
    contact_name,
    phone,
    email,
    notes,
    created_at
  ),
  projects (
    id,
    client_id,
    client_name,
    contact_name,
    title,
    summary,
    amount,
    amount_value,
    currency_code,
    deadline_text,
    deadline_date,
    priority,
    priority_source,
    status,
    source,
    raw_input,
    created_at,
    updated_at,
    completed_at,
    is_archived,
    archived_at,
    deleted_at
  )
`;

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
    project: Array.isArray(data?.projects)
      ? data.projects[0] ?? null
      : data?.projects ?? null,
  };

  const { clients, projects, ...cleanTask } = task;
  return cleanTask;
}

async function reloadTask({
  supabase,
  taskId,
  userId,
  fallbackClient,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  taskId: number;
  userId: string;
  fallbackClient?: any;
}) {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_WITH_CONTEXT_SELECT)
    .eq("id", taskId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (error) {
    throw new Error(error.message || "Failed to reload updated task");
  }

  return cleanJoinedTask(data, fallbackClient ?? null);
}

async function touchTaskForActivity({
  supabase,
  taskId,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  taskId: number;
  userId: string;
}) {
  const { error } = await supabase
    .from("tasks")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message || "Failed to update task activity");
  }
}

function getJoinedProject(data: any) {
  return Array.isArray(data?.projects)
    ? data.projects[0] ?? null
    : data?.projects ?? null;
}

async function completeProjectIfEveryTaskDone({
  supabase,
  projectId,
  userId,
  nowIso,
  currentProject,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  projectId: string;
  userId: string;
  nowIso: string;
  currentProject?: any;
}) {
  const { data: projectTasks, error: projectTasksError } = await supabase
    .from("tasks")
    .select("id,status")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .or("is_archived.eq.false,is_archived.is.null")
    .is("deleted_at", null);

  if (projectTasksError) {
    throw new Error(
      projectTasksError.message || "Failed to check project subtasks"
    );
  }

  if (!projectTasks?.length) return false;

  const everyTaskDone = projectTasks.every((task) =>
    isDoneStatus((task as any).status)
  );

  if (!everyTaskDone) return false;

  const projectUpdateData: Record<string, unknown> = {
    status: "Done",
    priority: "Low",
    updated_at: nowIso,
  };

  if (!currentProject?.completed_at) {
    projectUpdateData.completed_at = nowIso;
  }

  const { error: projectUpdateError } = await supabase
    .from("projects")
    .update(projectUpdateData)
    .eq("id", projectId)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (projectUpdateError) {
    throw new Error(
      projectUpdateError.message || "Failed to complete project"
    );
  }

  return true;
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
        project_id,
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
        updated_at,
        clients (
          id,
          name,
          contact_name,
          phone,
          email,
          notes,
          created_at
        ),
        projects (
          id,
          client_id,
          client_name,
          contact_name,
          title,
          summary,
          amount,
          amount_value,
          currency_code,
          deadline_text,
          deadline_date,
          priority,
          priority_source,
          status,
          source,
          raw_input,
          created_at,
          updated_at,
          completed_at,
          is_archived,
          archived_at,
          deleted_at
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

      const { data: updatedClient, error: clientUpdateError } = await supabase
        .from("clients")
        .update(clientUpdateData)
        .eq("id", existingTask.client_id)
        .eq("user_id", user.id)
        .select("id, name, contact_name, phone, email, notes, created_at")
        .single();

      const clientUpdateErrorMessage =
        clientUpdateError?.message || "Failed to update client details";

      if (clientUpdateError || !updatedClient) {
        console.error("Client update error:", clientUpdateError);

        if (clientUpdateError?.code === "PGRST116" || !updatedClient) {
          return NextResponse.json(
            { error: "Client not found" },
            { status: 404 }
          );
        }

        return NextResponse.json(
          {
            error: clientUpdateErrorMessage,
          },
          { status: 500 }
        );
      }

      try {
        await touchTaskForActivity({
          supabase,
          taskId,
          userId: user.id,
        });
      } catch (activityError) {
        console.warn(
          "Client details updated, but task activity touch failed:",
          activityError
        );
      }

      try {
        const cleanTask = await reloadTask({
          supabase,
          taskId,
          userId: user.id,
          fallbackClient: updatedClient,
        });

        return NextResponse.json({
          success: true,
          task: cleanTask,
        });
      } catch (reloadError) {
        console.warn(
          "Client details updated, but task reload failed:",
          reloadError
        );

        return NextResponse.json({
          success: true,
          task: cleanJoinedTask(
            {
              ...existingTask,
              clients: updatedClient,
            },
            updatedClient
          ),
        });
      }
    }

    let updateData: Record<string, unknown> = {};
    let transactionalStatus: "Done" | "In Progress" | null = null;
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
        transactionalStatus =
          nextStatus === "Done" || nextStatus === "In Progress"
            ? nextStatus
            : null;

        /*
          Lifetime completion:
          Once a task is marked Done for the first time, completed_at is preserved.
          Even if the user later archives, restores, or changes status, the historical
          completed timestamp remains available for reporting.
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

    if (transactionalStatus) {
      const { error: transactionalStatusError } = await supabase.rpc(
        "apply_task_bulk_status_transaction",
        {
          p_task_ids: [taskId],
          p_status: transactionalStatus,
        }
      );

      if (transactionalStatusError) {
        console.error(
          "Transactional single-task status update error:",
          transactionalStatusError
        );

        return NextResponse.json(
          {
            error:
              transactionalStatusError.message || "Failed to update task",
          },
          { status: 500 }
        );
      }

      try {
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
      } catch (reloadError) {
        console.warn(
          "Task status updated transactionally, but task reload failed:",
          reloadError
        );

        return NextResponse.json({
          success: true,
          task: cleanJoinedTask(
            {
              ...existingTask,
              status: transactionalStatus,
              updated_at: nowIso,
              completed_at:
                transactionalStatus === "Done"
                  ? existingTask.completed_at || nowIso
                  : existingTask.completed_at,
            },
            currentClient
          ),
        });
      }
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", taskId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select(TASK_WITH_CONTEXT_SELECT)
      .single();

    if (error) {
      console.error("Task update error:", error);

      return NextResponse.json(
        { error: error.message || "Failed to update task" },
        { status: 500 }
      );
    }

    const shouldCheckProjectCompletion =
      field === "status" &&
      isDoneStatus(value) &&
      typeof (data as any)?.project_id === "string" &&
      Boolean((data as any).project_id);

    const projectWasCompleted = shouldCheckProjectCompletion
      ? await completeProjectIfEveryTaskDone({
          supabase,
          projectId: (data as any).project_id,
          userId: user.id,
          nowIso,
          currentProject: getJoinedProject(data),
        })
      : false;

    const cleanTask = projectWasCompleted
      ? await reloadTask({
          supabase,
          taskId,
          userId: user.id,
          fallbackClient: currentClient,
        })
      : cleanJoinedTask(data, currentClient);

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
