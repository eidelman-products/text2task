import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MAX_TASK_IDS = 500;

const BulkTaskStatusSchema = z
  .object({
    taskIds: z
      .array(z.number().int().positive().safe())
      .min(1)
      .max(MAX_TASK_IDS),
    status: z.enum(["New", "In Progress", "Review", "Urgent", "Done"]),
  })
  .strict();

const TransactionalBulkTaskStatusRpcResponseSchema = z
  .object({
    status: z.enum(["Done", "In Progress"]),
    affectedTaskIds: z.array(z.number().int().positive().safe()),
    affectedProjectIds: z.array(z.string().uuid()),
    completedProjectIds: z.array(z.string().uuid()),
  })
  .strict();

type OwnedTask = {
  id: number;
  project_id: string | null;
  completed_at: string | null;
};

function errorResponse(code: string, error: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      code,
      error,
    },
    { status }
  );
}

function uniqueValues<T>(values: T[]) {
  return Array.from(new Set(values));
}

function transactionalRpcErrorResponse(error: {
  code?: string | null;
  message?: string | null;
}) {
  const message = error.message || "";

  if (message.includes("UNAUTHORIZED")) {
    return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
  }

  if (
    message.includes("INVALID_STATUS") ||
    message.includes("INVALID_TASK_IDS") ||
    message.includes("TOO_MANY_TASKS")
  ) {
    return errorResponse("INVALID_PAYLOAD", "Invalid request body", 400);
  }

  if (message.includes("TARGET_VALIDATION_FAILED")) {
    return errorResponse(
      "TARGET_VALIDATION_FAILED",
      "One or more selected tasks could not be found",
      400
    );
  }

  if (message.includes("CONCURRENT_MODIFICATION")) {
    return errorResponse(
      "CONCURRENT_MODIFICATION",
      "Selected tasks changed while the update was running. Please try again.",
      409
    );
  }

  if (message.includes("TASK_UPDATE_FAILED")) {
    return errorResponse(
      "TASK_UPDATE_FAILED",
      "Could not update every selected task",
      500
    );
  }

  if (message.includes("PROJECT_UPDATE_FAILED")) {
    return errorResponse(
      "PROJECT_UPDATE_FAILED",
      "Could not complete related projects",
      500
    );
  }

  console.error("Transactional bulk task status RPC error:", error);

  return errorResponse(
    "INTERNAL_ERROR",
    "Could not update selected tasks",
    500
  );
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_PAYLOAD", "Invalid request body", 400);
    }

    const parsed = BulkTaskStatusSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("INVALID_PAYLOAD", "Invalid request body", 400);
    }

    const taskIds = uniqueValues(parsed.data.taskIds);
    const { status } = parsed.data;
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
    }

    if (status === "Done" || status === "In Progress") {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "apply_task_bulk_status_transaction",
        {
          p_task_ids: taskIds,
          p_status: status,
        }
      );

      if (rpcError) {
        return transactionalRpcErrorResponse(rpcError);
      }

      const parsedRpcData =
        TransactionalBulkTaskStatusRpcResponseSchema.safeParse(rpcData);

      if (!parsedRpcData.success || parsedRpcData.data.status !== status) {
        console.error("Invalid transactional bulk task status RPC response:", {
          status,
          rpcData,
          validationError: parsedRpcData.success
            ? null
            : parsedRpcData.error.flatten(),
        });

        return errorResponse(
          "INTERNAL_ERROR",
          "Could not update selected tasks",
          500
        );
      }

      const affectedTaskIds = uniqueValues(
        parsedRpcData.data.affectedTaskIds
      );
      const affectedTaskIdSet = new Set(affectedTaskIds);

      if (
        affectedTaskIds.length !== taskIds.length ||
        taskIds.some((taskId) => !affectedTaskIdSet.has(taskId))
      ) {
        console.error("Transactional bulk task status affected-task mismatch:", {
          status,
          requestedTaskIds: taskIds,
          affectedTaskIds,
        });

        return errorResponse(
          "INTERNAL_ERROR",
          "Could not update selected tasks",
          500
        );
      }

      const { data: updatedTasks, error: reloadError } = await supabase
        .from("tasks")
        .select("id, project_id, status, completed_at, updated_at")
        .in("id", taskIds)
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (reloadError) {
        console.warn("Bulk task status reload error:", reloadError);
      }

      return NextResponse.json({
        ok: true,
        affectedTaskIds: taskIds,
        ...(reloadError ? {} : { updatedTasks: updatedTasks ?? [] }),
        message: `Updated ${taskIds.length} task(s) to ${status}`,
      });
    }

    const { data: ownedTaskRows, error: ownershipError } = await supabase
      .from("tasks")
      .select("id, project_id, completed_at")
      .in("id", taskIds)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (ownershipError) {
      console.error("Bulk task status ownership validation error:", ownershipError);
      return errorResponse(
        "INTERNAL_ERROR",
        "Could not validate selected tasks",
        500
      );
    }

    const ownedTasks = (ownedTaskRows ?? []) as OwnedTask[];
    const ownedTaskIds = new Set(ownedTasks.map((task) => task.id));

    if (
      ownedTasks.length !== taskIds.length ||
      taskIds.some((taskId) => !ownedTaskIds.has(taskId))
    ) {
      return errorResponse(
        "TARGET_VALIDATION_FAILED",
        "One or more selected tasks could not be found",
        400
      );
    }

    const nowIso = new Date().toISOString();
    const { data: statusUpdatedTasks, error: statusUpdateError } = await supabase
      .from("tasks")
      .update({
        status,
        updated_at: nowIso,
      })
      .in("id", taskIds)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select("id");

    if (statusUpdateError) {
      console.error("Bulk task status update error:", statusUpdateError);
      return errorResponse(
        "TASK_UPDATE_FAILED",
        "Could not update selected tasks",
        500
      );
    }

    if ((statusUpdatedTasks ?? []).length !== taskIds.length) {
      return errorResponse(
        "TASK_UPDATE_FAILED",
        "Could not update every selected task",
        500
      );
    }

    const { data: updatedTasks, error: reloadError } = await supabase
      .from("tasks")
      .select("id, project_id, status, completed_at, updated_at")
      .in("id", taskIds)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (reloadError) {
      console.warn("Bulk task status reload error:", reloadError);
    }

    return NextResponse.json({
      ok: true,
      affectedTaskIds: taskIds,
      ...(reloadError ? {} : { updatedTasks: updatedTasks ?? [] }),
      message: `Updated ${taskIds.length} task(s) to ${status}`,
    });
  } catch (error) {
    console.error("Bulk task status route error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Could not update selected tasks",
      500
    );
  }
}
