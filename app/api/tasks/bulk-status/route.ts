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

    if (status === "Done") {
      const taskIdsMissingCompletedAt = ownedTasks
        .filter((task) => !task.completed_at)
        .map((task) => task.id);

      if (taskIdsMissingCompletedAt.length > 0) {
        const { error: completionUpdateError } = await supabase
          .from("tasks")
          .update({
            completed_at: nowIso,
          })
          .in("id", taskIdsMissingCompletedAt)
          .eq("user_id", user.id)
          .is("deleted_at", null);

        if (completionUpdateError) {
          console.error(
            "Bulk task completion timestamp update error:",
            completionUpdateError
          );
          return errorResponse(
            "TASK_UPDATE_FAILED",
            "Could not complete selected tasks",
            500
          );
        }
      }

      const projectIds = uniqueValues(
        ownedTasks.flatMap((task) => (task.project_id ? [task.project_id] : []))
      );

      if (projectIds.length > 0) {
        const { data: projectTaskRows, error: projectTasksError } =
          await supabase
            .from("tasks")
            .select("project_id, status")
            .in("project_id", projectIds)
            .eq("user_id", user.id)
            .or("is_archived.eq.false,is_archived.is.null")
            .is("deleted_at", null);

        if (projectTasksError) {
          console.error(
            "Bulk task status project completion validation error:",
            projectTasksError
          );
          return errorResponse(
            "PROJECT_UPDATE_FAILED",
            "Could not validate project completion",
            500
          );
        }

        const projectCompletionState = new Map<string, boolean>();

        for (const task of projectTaskRows ?? []) {
          if (!task.project_id) continue;

          const isDone = String(task.status || "").trim().toLowerCase() === "done";
          projectCompletionState.set(
            task.project_id,
            (projectCompletionState.get(task.project_id) ?? true) && isDone
          );
        }

        const completedProjectIds = projectIds.filter(
          (projectId) => projectCompletionState.get(projectId) === true
        );

        if (completedProjectIds.length > 0) {
          const { data: projects, error: projectsError } = await supabase
            .from("projects")
            .select("id, completed_at")
            .in("id", completedProjectIds)
            .eq("user_id", user.id)
            .is("deleted_at", null);

          if (projectsError) {
            console.error(
              "Bulk task status project lookup error:",
              projectsError
            );
            return errorResponse(
              "PROJECT_UPDATE_FAILED",
              "Could not load completed projects",
              500
            );
          }

          const ownedCompletedProjectIds = (projects ?? []).map(
            (project) => project.id
          );

          if (ownedCompletedProjectIds.length > 0) {
            const { error: projectUpdateError } = await supabase
              .from("projects")
              .update({
                status: "Done",
                priority: "Low",
                updated_at: nowIso,
              })
              .in("id", ownedCompletedProjectIds)
              .eq("user_id", user.id)
              .is("deleted_at", null);

            if (projectUpdateError) {
              console.error(
                "Bulk task status project completion update error:",
                projectUpdateError
              );
              return errorResponse(
                "PROJECT_UPDATE_FAILED",
                "Could not complete related projects",
                500
              );
            }

            const projectIdsMissingCompletedAt = (projects ?? [])
              .filter((project) => !project.completed_at)
              .map((project) => project.id);

            if (projectIdsMissingCompletedAt.length > 0) {
              const { error: projectCompletionTimestampError } = await supabase
                .from("projects")
                .update({
                  completed_at: nowIso,
                })
                .in("id", projectIdsMissingCompletedAt)
                .eq("user_id", user.id)
                .is("deleted_at", null);

              if (projectCompletionTimestampError) {
                console.error(
                  "Bulk task status project completion timestamp error:",
                  projectCompletionTimestampError
                );
                return errorResponse(
                  "PROJECT_UPDATE_FAILED",
                  "Could not complete related projects",
                  500
                );
              }
            }
          }
        }
      }
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
