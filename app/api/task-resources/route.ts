import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ResourceTypeSchema = z.enum([
  "link",
  "image",
  "logo",
  "banner",
  "document",
  "brief",
  "reference",
  "file",
  "note",
  "website",
]);

const CreateResourceSchema = z.object({
  project_id: z.string().uuid().nullable().optional(),
  task_id: z.number().int().positive().nullable().optional(),
  resource_type: ResourceTypeSchema.default("link"),
  title: z.string().trim().max(160).nullable().optional(),
  url: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  storage_path: z.string().trim().max(1000).nullable().optional(),
  file_name: z.string().trim().max(255).nullable().optional(),
  mime_type: z.string().trim().max(255).nullable().optional(),
  size_bytes: z.number().int().nonnegative().nullable().optional(),
});

const UpdateResourceSchema = z.object({
  resource_id: z.string().uuid(),
  resource_type: ResourceTypeSchema.optional(),
  title: z.string().trim().max(160).nullable().optional(),
  url: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const DeleteResourceSchema = z.object({
  resource_id: z.string().uuid(),
});

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function hasResourceContent(input: z.infer<typeof CreateResourceSchema>) {
  return Boolean(
    normalizeOptionalText(input.title) ||
      normalizeOptionalText(input.url) ||
      normalizeOptionalText(input.notes) ||
      normalizeOptionalText(input.storage_path)
  );
}

function hasUpdateContent(input: z.infer<typeof UpdateResourceSchema>) {
  return (
    input.resource_type !== undefined ||
    input.title !== undefined ||
    input.url !== undefined ||
    input.notes !== undefined
  );
}

async function verifyProjectOwnership({
  supabase,
  userId,
  projectId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  projectId: string;
}) {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to verify project ownership");
  }

  return Boolean(data?.id);
}

async function verifyTaskOwnership({
  supabase,
  userId,
  taskId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  taskId: number;
}) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, project_id")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to verify task ownership");
  }

  return data || null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");
    const taskIdRaw = url.searchParams.get("task_id");

    let query = supabase
      .from("task_resources")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (taskIdRaw) {
      const taskId = Number(taskIdRaw);

      if (!Number.isInteger(taskId) || taskId <= 0) {
        return NextResponse.json(
          { error: "Invalid task_id" },
          { status: 400 }
        );
      }

      query = query.eq("task_id", taskId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("task resources GET error:", error);

      return NextResponse.json(
        { error: error.message || "Failed to load resources" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      resources: data ?? [],
    });
  } catch (error: any) {
    console.error("task resources GET unexpected error:", error);

    return NextResponse.json(
      { error: error.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateResourceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid resource payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const projectId = input.project_id || null;
    const taskId = input.task_id || null;

    if (!projectId && !taskId) {
      return NextResponse.json(
        { error: "Resource must be connected to a project or task" },
        { status: 400 }
      );
    }

    if (!hasResourceContent(input)) {
      return NextResponse.json(
        {
          error:
            "Resource must include a title, URL, note, or uploaded file path",
        },
        { status: 400 }
      );
    }

    let resolvedProjectId = projectId;

    if (taskId) {
      const task = await verifyTaskOwnership({
        supabase,
        userId: user.id,
        taskId,
      });

      if (!task) {
        return NextResponse.json(
          { error: "Task not found or not allowed" },
          { status: 404 }
        );
      }

      if (!resolvedProjectId && task.project_id) {
        resolvedProjectId = task.project_id;
      }
    }

    if (resolvedProjectId) {
      const ownsProject = await verifyProjectOwnership({
        supabase,
        userId: user.id,
        projectId: resolvedProjectId,
      });

      if (!ownsProject) {
        return NextResponse.json(
          { error: "Project not found or not allowed" },
          { status: 404 }
        );
      }
    }

    const { data, error } = await supabase
      .from("task_resources")
      .insert({
        user_id: user.id,
        project_id: resolvedProjectId,
        task_id: taskId,
        resource_type: input.resource_type || "link",
        title: normalizeOptionalText(input.title),
        url: normalizeOptionalText(input.url),
        notes: normalizeOptionalText(input.notes),
        storage_path: normalizeOptionalText(input.storage_path),
        file_name: normalizeOptionalText(input.file_name),
        mime_type: normalizeOptionalText(input.mime_type),
        size_bytes: input.size_bytes ?? null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("task resources POST error:", error);

      return NextResponse.json(
        { error: error.message || "Failed to create resource" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      resource: data,
    });
  } catch (error: any) {
    console.error("task resources POST unexpected error:", error);

    return NextResponse.json(
      { error: error.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = UpdateResourceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid update payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    if (!hasUpdateContent(input)) {
      return NextResponse.json(
        { error: "No resource changes were provided" },
        { status: 400 }
      );
    }

    const { data: existingResource, error: lookupError } = await supabase
      .from("task_resources")
      .select("*")
      .eq("id", input.resource_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) {
      console.error("task resources PATCH lookup error:", lookupError);

      return NextResponse.json(
        { error: lookupError.message || "Failed to find resource" },
        { status: 500 }
      );
    }

    if (!existingResource) {
      return NextResponse.json(
        { error: "Resource not found or not allowed" },
        { status: 404 }
      );
    }

    const updates: Record<string, string | null> = {};

    if (input.resource_type !== undefined) {
      updates.resource_type = input.resource_type;
    }

    if (input.title !== undefined) {
      updates.title = normalizeOptionalText(input.title);
    }

    if (input.url !== undefined) {
      updates.url = normalizeOptionalText(input.url);
    }

    if (input.notes !== undefined) {
      updates.notes = normalizeOptionalText(input.notes);
    }

    const nextTitle =
      "title" in updates ? updates.title : existingResource.title;
    const nextUrl = "url" in updates ? updates.url : existingResource.url;
    const nextNotes =
      "notes" in updates ? updates.notes : existingResource.notes;
    const nextStoragePath = existingResource.storage_path;

    const stillHasContent = Boolean(
      normalizeOptionalText(nextTitle) ||
        normalizeOptionalText(nextUrl) ||
        normalizeOptionalText(nextNotes) ||
        normalizeOptionalText(nextStoragePath)
    );

    if (!stillHasContent) {
      return NextResponse.json(
        {
          error:
            "Resource must keep a title, URL, note, or uploaded file path",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("task_resources")
      .update(updates)
      .eq("id", input.resource_id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      console.error("task resources PATCH error:", error);

      return NextResponse.json(
        { error: error.message || "Failed to update resource" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      resource: data,
    });
  } catch (error: any) {
    console.error("task resources PATCH unexpected error:", error);

    return NextResponse.json(
      { error: error.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = DeleteResourceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid delete payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { data: existingResource, error: lookupError } = await supabase
      .from("task_resources")
      .select("*")
      .eq("id", parsed.data.resource_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) {
      console.error("task resources DELETE lookup error:", lookupError);

      return NextResponse.json(
        { error: lookupError.message || "Failed to find resource" },
        { status: 500 }
      );
    }

    if (!existingResource) {
      return NextResponse.json(
        { error: "Resource not found or not allowed" },
        { status: 404 }
      );
    }

    const { data: deletedResource, error: deleteError } = await supabase
      .from("task_resources")
      .delete()
      .eq("id", parsed.data.resource_id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (deleteError || !deletedResource) {
      console.error("task resources DELETE error:", deleteError);

      return NextResponse.json(
        {
          error:
            deleteError?.message ||
            "Resource could not be deleted. It may have already been removed.",
        },
        { status: deleteError ? 500 : 404 }
      );
    }

    let cleanupWarning: string | null = null;

    if (existingResource.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("task-resources")
        .remove([existingResource.storage_path]);

      if (storageError) {
        cleanupWarning = "storage_cleanup_failed";
        console.error("task resource storage cleanup error after DB delete:", {
          resourceId: parsed.data.resource_id,
          storagePath: existingResource.storage_path,
          error: storageError,
        });
      }
    }

    const response: {
      success: true;
      deleted_resource_id: string;
      cleanup_warning?: string;
    } = {
      success: true,
      deleted_resource_id: parsed.data.resource_id,
    };

    if (cleanupWarning) {
      response.cleanup_warning = cleanupWarning;
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("task resources DELETE unexpected error:", error);

    return NextResponse.json(
      { error: error.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
