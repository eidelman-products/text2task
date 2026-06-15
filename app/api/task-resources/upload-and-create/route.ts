import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const STORAGE_BUCKET = "task-resources";

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

const UploadMetadataSchema = z.object({
  project_id: z.string().uuid().nullable(),
  task_id: z.number().int().positive().safe().nullable(),
  resource_type: ResourceTypeSchema.nullable(),
  title: z.string().trim().max(160).nullable(),
  notes: z.string().trim().max(1000).nullable(),
});

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed || null;
}

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
  supabase: SupabaseServerClient;
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
  supabase: SupabaseServerClient;
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

async function removeUploadedFile(
  supabase: SupabaseServerClient,
  storagePath: string
) {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error("task resource upload cleanup error:", error);
  }

  return !error;
}

export async function POST(req: NextRequest) {
  let uploadedStoragePath: string | null = null;
  let supabase: SupabaseServerClient | null = null;

  try {
    supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const taskIdRaw = normalizeOptionalText(formData.get("task_id"));
    const parsedMetadata = UploadMetadataSchema.safeParse({
      project_id: normalizeOptionalText(formData.get("project_id")),
      task_id: taskIdRaw ? Number(taskIdRaw) : null,
      resource_type: normalizeOptionalText(formData.get("resource_type")),
      title: normalizeOptionalText(formData.get("title")),
      notes: normalizeOptionalText(formData.get("notes")),
    });

    if (!parsedMetadata.success) {
      return NextResponse.json(
        {
          error: "Invalid resource upload metadata",
          details: parsedMetadata.error.flatten(),
        },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
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

    const safeFileName = sanitizeFileName(file.name);

    if (safeFileName.length > 255) {
      return NextResponse.json(
        { error: "File name is too long" },
        { status: 400 }
      );
    }

    const input = parsedMetadata.data;
    const effectiveTitle = input.title || file.name.trim() || safeFileName;
    const projectId = input.project_id;
    const taskId = input.task_id;

    if (effectiveTitle.length > 160) {
      return NextResponse.json(
        { error: "Resource title is too long" },
        { status: 400 }
      );
    }

    if (!projectId && !taskId) {
      return NextResponse.json(
        { error: "Upload must be connected to a project or task" },
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

    const storagePath = createSafeStoragePath({
      userId: user.id,
      projectId: resolvedProjectId,
      taskId: taskId ? String(taskId) : null,
      fileName: file.name,
    });
    const arrayBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("task resource upload-and-create upload error:", uploadError);

      return NextResponse.json(
        { error: uploadError.message || "Failed to upload file" },
        { status: 500 }
      );
    }

    uploadedStoragePath = uploadData.path;

    const { data: resource, error: resourceError } = await supabase
      .from("task_resources")
      .insert({
        user_id: user.id,
        project_id: resolvedProjectId,
        task_id: taskId,
        resource_type:
          input.resource_type || RESOURCE_TYPE_BY_MIME[file.type] || "file",
        title: effectiveTitle,
        url: null,
        notes: input.notes,
        storage_path: uploadData.path,
        file_name: safeFileName,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select("*")
      .single();

    if (resourceError || !resource) {
      const cleanupSucceeded = await removeUploadedFile(
        supabase,
        uploadedStoragePath
      );
      const metadataError =
        resourceError?.message ||
        "Failed to create resource metadata after upload";
      uploadedStoragePath = null;

      return NextResponse.json(
        {
          error: cleanupSucceeded
            ? metadataError
            : `${metadataError}. Uploaded file cleanup also failed.`,
          cleanup_succeeded: cleanupSucceeded,
        },
        { status: 500 }
      );
    }

    uploadedStoragePath = null;

    return NextResponse.json({
      resource,
    });
  } catch (error) {
    if (supabase && uploadedStoragePath) {
      await removeUploadedFile(supabase, uploadedStoragePath);
    }

    console.error("task resource upload-and-create unexpected error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
