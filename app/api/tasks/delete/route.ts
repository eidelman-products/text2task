import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const DeleteTaskSchema = z.object({
  taskId: z.number(),
  mode: z.enum(["archive", "permanent"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = DeleteTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { taskId, mode = "archive" } = parsed.data;

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nowIso = new Date().toISOString();

    if (mode === "permanent") {
      const { data, error } = await supabase
        .from("tasks")
        .update({
          deleted_at: nowIso,
          is_archived: true,
          archived_at: nowIso,
        })
        .eq("id", taskId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .select("id")
        .single();

      if (error) {
        console.error("Task permanent delete error:", error);

        return NextResponse.json(
          { error: error.message || "Failed to permanently delete task" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: "permanent",
        deletedTaskId: data.id,
      });
    }

    const { data, error } = await supabase
      .from("tasks")
      .update({
        is_archived: true,
        archived_at: nowIso,
      })
      .eq("id", taskId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error) {
      console.error("Task archive error:", error);

      return NextResponse.json(
        { error: error.message || "Failed to move task to archive" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: "archive",
      archivedTaskId: data.id,
    });
  } catch (error: any) {
    console.error("Delete task route error:", error);

    return NextResponse.json(
      { error: error.message || "Failed to update task" },
      { status: 500 }
    );
  }
}