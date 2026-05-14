import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const FileUrlQuerySchema = z.object({
  resource_id: z.string().uuid(),
  download: z.enum(["true", "false"]).optional().default("false"),
});

const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 10;

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

    const parsed = FileUrlQuerySchema.safeParse({
      resource_id: url.searchParams.get("resource_id"),
      download: url.searchParams.get("download") || "false",
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid file request",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const shouldDownload = parsed.data.download === "true";

    const { data: resource, error: resourceError } = await supabase
      .from("task_resources")
      .select(
        "id, user_id, title, resource_type, storage_path, file_name, mime_type, size_bytes"
      )
      .eq("id", parsed.data.resource_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (resourceError) {
      console.error("task resource file-url lookup error:", resourceError);

      return NextResponse.json(
        { error: resourceError.message || "Failed to find resource" },
        { status: 500 }
      );
    }

    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found or not allowed" },
        { status: 404 }
      );
    }

    if (!resource.storage_path) {
      return NextResponse.json(
        { error: "This resource does not have an uploaded file" },
        { status: 400 }
      );
    }

    const downloadFileName =
      resource.file_name ||
      resource.title ||
      resource.storage_path.split("/").pop() ||
      "resource-file";

    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from("task-resources")
        .createSignedUrl(
          resource.storage_path,
          SIGNED_URL_EXPIRES_IN_SECONDS,
          {
            download: shouldDownload ? downloadFileName : false,
          }
        );

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("task resource signed URL error:", signedUrlError);

      return NextResponse.json(
        { error: signedUrlError?.message || "Failed to create file URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      expires_in: SIGNED_URL_EXPIRES_IN_SECONDS,
      download: shouldDownload,
      resource: {
        id: resource.id,
        title: resource.title,
        resource_type: resource.resource_type,
        file_name: resource.file_name,
        mime_type: resource.mime_type,
        size_bytes: resource.size_bytes,
      },
    });
  } catch (error: any) {
    console.error("task resource file-url unexpected error:", error);

    return NextResponse.json(
      { error: error.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}