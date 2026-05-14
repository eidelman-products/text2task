import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const RESOURCE_TYPE_BY_MIME: Record<string, string> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/jpg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "document",
  "text/plain": "document",
  "text/csv": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "document",
  "application/vnd.ms-excel": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "document",
};

function sanitizeFileName(fileName: string) {
  const cleanName = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return cleanName || "resource-file";
}

function getFileExtension(fileName: string) {
  const cleanName = sanitizeFileName(fileName);
  const parts = cleanName.split(".");

  if (parts.length < 2) return "";

  return parts.pop() || "";
}

function createSafeStoragePath({
  userId,
  projectId,
  taskId,
  fileName,
}: {
  userId: string;
  projectId: string | null;
  taskId: string | null;
  fileName: string;
}) {
  const safeFileName = sanitizeFileName(fileName);
  const extension = getFileExtension(safeFileName);
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const finalFileName = extension
    ? `${randomId}.${extension}`
    : `${randomId}-${safeFileName}`;

  const projectSegment = projectId || "no-project";
  const taskSegment = taskId ? `task-${taskId}` : "project";

  return `${userId}/${projectSegment}/${taskSegment}/${finalFileName}`;
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

    const formData = await req.formData();

    const file = formData.get("file");
    const projectIdRaw = formData.get("project_id");
    const taskIdRaw = formData.get("task_id");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    const projectId =
      typeof projectIdRaw === "string" && projectIdRaw.trim()
        ? projectIdRaw.trim()
        : null;

    const taskId =
      typeof taskIdRaw === "string" && taskIdRaw.trim()
        ? Number(taskIdRaw)
        : null;

    if (!projectId && !taskId) {
      return NextResponse.json(
        { error: "Upload must be connected to a project or task" },
        { status: 400 }
      );
    }

    let resolvedProjectId = projectId;

    if (taskId !== null) {
      if (!Number.isInteger(taskId) || taskId <= 0) {
        return NextResponse.json(
          { error: "Invalid task_id" },
          { status: 400 }
        );
      }

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

    const storagePath = createSafeStoragePath({
      userId: user.id,
      projectId: resolvedProjectId,
      taskId: taskId !== null ? String(taskId) : null,
      fileName: file.name,
    });

    const arrayBuffer = await file.arrayBuffer();

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("task-resources")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("task resource upload error:", uploadError);

      return NextResponse.json(
        { error: uploadError.message || "Failed to upload file" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      file: {
        storage_path: uploadData.path,
        file_name: sanitizeFileName(file.name),
        original_file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        resource_type: RESOURCE_TYPE_BY_MIME[file.type] || "file",
      },
    });
  } catch (error: any) {
    console.error("task resource upload unexpected error:", error);

    return NextResponse.json(
      { error: error.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}