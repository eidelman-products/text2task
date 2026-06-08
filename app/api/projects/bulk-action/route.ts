import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MAX_PROJECT_TARGETS = 100;
const MAX_TASK_IDS = 500;

const ProjectTargetSchema = z
  .object({
    kind: z.literal("project"),
    projectId: z.string().uuid(),
  })
  .strict();

const LegacyTaskGroupTargetSchema = z
  .object({
    kind: z.literal("legacy_task_group"),
    taskIds: z
      .array(z.number().int().positive().safe())
      .min(1)
      .max(MAX_TASK_IDS),
  })
  .strict();

const ProjectBulkActionSchema = z
  .object({
    action: z.enum(["archive", "restore", "soft_delete"]),
    targets: z
      .array(
        z.discriminatedUnion("kind", [
          ProjectTargetSchema,
          LegacyTaskGroupTargetSchema,
        ])
      )
      .min(1)
      .max(MAX_PROJECT_TARGETS + MAX_TASK_IDS),
  })
  .strict()
  .superRefine((value, ctx) => {
    const projectTargetCount = value.targets.filter(
      (target) => target.kind === "project"
    ).length;
    const taskIdCount = value.targets.reduce(
      (count, target) =>
        target.kind === "legacy_task_group"
          ? count + target.taskIds.length
          : count,
      0
    );

    if (projectTargetCount > MAX_PROJECT_TARGETS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `A maximum of ${MAX_PROJECT_TARGETS} project targets is allowed`,
        path: ["targets"],
      });
    }

    if (taskIdCount > MAX_TASK_IDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `A maximum of ${MAX_TASK_IDS} task IDs is allowed`,
        path: ["targets"],
      });
    }
  });

type ProjectBulkAction = z.infer<typeof ProjectBulkActionSchema>["action"];
type LegacyTaskGroupTarget = z.infer<typeof LegacyTaskGroupTargetSchema>;

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

function deduplicateLegacyGroups(groups: LegacyTaskGroupTarget[]) {
  const seen = new Set<string>();

  return groups.flatMap((group) => {
    const taskIds = uniqueValues(group.taskIds).sort((a, b) => a - b);
    const key = taskIds.join(",");

    if (seen.has(key)) return [];

    seen.add(key);
    return [{ kind: "legacy_task_group" as const, taskIds }];
  });
}

function getUpdateData(action: ProjectBulkAction, nowIso: string) {
  if (action === "restore") {
    return {
      is_archived: false,
      archived_at: null,
    };
  }

  if (action === "soft_delete") {
    return {
      deleted_at: nowIso,
      is_archived: true,
      archived_at: nowIso,
    };
  }

  return {
    is_archived: true,
    archived_at: nowIso,
  };
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_PAYLOAD", "Invalid request body", 400);
    }

    const parsed = ProjectBulkActionSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("INVALID_PAYLOAD", "Invalid request body", 400);
    }

    const { action, targets } = parsed.data;
    const projectIds = uniqueValues(
      targets.flatMap((target) =>
        target.kind === "project" ? [target.projectId] : []
      )
    );
    const legacyGroups = deduplicateLegacyGroups(
      targets.filter(
        (target): target is LegacyTaskGroupTarget =>
          target.kind === "legacy_task_group"
      )
    );
    const legacyTaskIds = uniqueValues(
      legacyGroups.flatMap((group) => group.taskIds)
    );

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
    }

    if (projectIds.length > 0) {
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id")
        .in("id", projectIds)
        .eq("user_id", user.id);

      if (projectsError) {
        console.error("Project bulk action validation error:", projectsError);
        return errorResponse(
          "INTERNAL_ERROR",
          "Could not validate selected projects",
          500
        );
      }

      const ownedProjectIds = new Set(
        (projects ?? []).map((project) => project.id)
      );

      if (projectIds.some((projectId) => !ownedProjectIds.has(projectId))) {
        return errorResponse(
          "TARGET_VALIDATION_FAILED",
          "One or more selected projects could not be found",
          400
        );
      }
    }

    let legacyTasks: Array<{ id: number; project_id: string | null }> = [];

    if (legacyTaskIds.length > 0) {
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("id, project_id")
        .in("id", legacyTaskIds)
        .eq("user_id", user.id);

      if (tasksError) {
        console.error("Legacy task group validation error:", tasksError);
        return errorResponse(
          "INTERNAL_ERROR",
          "Could not validate selected tasks",
          500
        );
      }

      legacyTasks = (tasks ?? []) as Array<{
        id: number;
        project_id: string | null;
      }>;
      const ownedTaskIds = new Set(legacyTasks.map((task) => task.id));

      if (legacyTaskIds.some((taskId) => !ownedTaskIds.has(taskId))) {
        return errorResponse(
          "TARGET_VALIDATION_FAILED",
          "One or more selected tasks could not be found",
          400
        );
      }
    }

    const projectIdSet = new Set(projectIds);
    const standaloneLegacyTaskIds = legacyTasks
      .filter(
        (task) => !task.project_id || !projectIdSet.has(task.project_id)
      )
      .map((task) => task.id);
    const updateData = getUpdateData(action, new Date().toISOString());

    /*
      These batched updates intentionally validate every target before mutation.
      A future database RPC can make the project and task updates fully atomic.
    */
    let affectedProjectIds: string[] = [];

    if (projectIds.length > 0) {
      const { data: updatedProjects, error: projectUpdateError } =
        await supabase
          .from("projects")
          .update(updateData)
          .in("id", projectIds)
          .eq("user_id", user.id)
          .select("id");

      if (projectUpdateError) {
        console.error(
          "Project bulk action project update error:",
          projectUpdateError
        );
        return errorResponse(
          "PROJECT_UPDATE_FAILED",
          "Could not update selected projects",
          500
        );
      }

      affectedProjectIds = (updatedProjects ?? []).map(
        (project) => project.id
      );
    }

    const affectedTaskIds: number[] = [];

    if (projectIds.length > 0) {
      let projectTasksUpdate = supabase
        .from("tasks")
        .update(updateData)
        .in("project_id", projectIds)
        .eq("user_id", user.id);

      if (action !== "soft_delete") {
        projectTasksUpdate = projectTasksUpdate.is("deleted_at", null);
      }

      const { data: updatedProjectTasks, error: projectTasksUpdateError } =
        await projectTasksUpdate.select("id");

      if (projectTasksUpdateError) {
        console.error(
          "Project bulk action project task update error:",
          projectTasksUpdateError
        );
        return errorResponse(
          "TASK_UPDATE_FAILED",
          "Could not update tasks for selected projects",
          500
        );
      }

      affectedTaskIds.push(
        ...(updatedProjectTasks ?? []).map((task) => task.id)
      );
    }

    if (standaloneLegacyTaskIds.length > 0) {
      let legacyTasksUpdate = supabase
        .from("tasks")
        .update(updateData)
        .in("id", standaloneLegacyTaskIds)
        .eq("user_id", user.id);

      if (action !== "soft_delete") {
        legacyTasksUpdate = legacyTasksUpdate.is("deleted_at", null);
      }

      const { data: updatedLegacyTasks, error: legacyTasksUpdateError } =
        await legacyTasksUpdate.select("id");

      if (legacyTasksUpdateError) {
        console.error(
          "Project bulk action legacy task update error:",
          legacyTasksUpdateError
        );
        return errorResponse(
          "TASK_UPDATE_FAILED",
          "Could not update selected legacy tasks",
          500
        );
      }

      affectedTaskIds.push(
        ...(updatedLegacyTasks ?? []).map((task) => task.id)
      );
    }

    const uniqueAffectedTaskIds = uniqueValues(affectedTaskIds);
    const affectedTaskIdSet = new Set(uniqueAffectedTaskIds);
    const affectedLegacyGroupCount = legacyGroups.filter((group) =>
      group.taskIds.some((taskId) => affectedTaskIdSet.has(taskId))
    ).length;

    return NextResponse.json({
      ok: true,
      action,
      affectedProjectCount: affectedProjectIds.length,
      affectedTaskCount: uniqueAffectedTaskIds.length,
      affectedLegacyGroupCount,
      affectedProjectIds,
      affectedTaskIds: uniqueAffectedTaskIds,
    });
  } catch (error) {
    console.error("Project bulk action route error:", error);

    return errorResponse(
      "INTERNAL_ERROR",
      "Could not complete the selected project action",
      500
    );
  }
}
