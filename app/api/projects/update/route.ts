import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseDeadline } from "@/lib/tasks/parse-deadline";
import { parseAmount } from "@/lib/tasks/parse-amount";

const UpdateProjectSchema = z.object({
  projectId: z.string().uuid(),
  field: z.enum([
    "title",
    "summary",
    "amount",
    "deadline",
    "priority",
    "status",
    "client_name",
    "contact_name",
  ]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeNullableText(value: unknown): string | null {
  const clean = normalizeText(value);
  return clean === "" ? null : clean;
}

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

function isDoneStatus(status: unknown) {
  return String(status || "").trim().toLowerCase() === "done";
}

async function reloadProject({
  supabase,
  projectId,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  projectId: string;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      *,
      clients (
        id,
        name,
        contact_name,
        phone,
        email,
        notes,
        created_at
      )
    `
    )
    .eq("id", projectId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to reload updated project");
  }

  const project = {
    ...data,
    client: Array.isArray((data as any).clients)
      ? (data as any).clients[0] ?? null
      : (data as any).clients ?? null,
  };

  const { clients, ...cleanProject } = project;

  return cleanProject;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = UpdateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { projectId, field, value } = parsed.data;

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: existingProject, error: existingProjectError } =
      await supabase
        .from("projects")
        .select(
          `
          id,
          user_id,
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
          status,
          completed_at,
          deleted_at,
          created_at,
          updated_at
        `
        )
        .eq("id", projectId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .single();

    if (existingProjectError || !existingProject) {
      return NextResponse.json(
        { error: existingProjectError?.message || "Project not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const nowIso = new Date().toISOString();

    if (field === "title") {
      const title = normalizeText(value);

      if (!title) {
        return NextResponse.json(
          { error: "Project title cannot be empty" },
          { status: 400 }
        );
      }

      updateData.title = title;
    }

    if (field === "summary") {
      updateData.summary = normalizeNullableText(value);
    }

    if (field === "amount") {
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
    }

    if (field === "deadline") {
      const deadlineText = normalizeText(value);
      const parsedDeadline = parseDeadline(deadlineText);

      updateData.deadline_text = deadlineText;
      updateData.deadline_date = parsedDeadline.deadlineDate;
    }

    if (field === "priority") {
      updateData.priority = normalizeText(value) || "Medium";
    }

    if (field === "status") {
      const nextStatus = normalizeText(value) || "New";

      updateData.status = nextStatus;

      /*
        Project-level completed state:
        Once a project is marked Done, completed_at is preserved as a lifetime signal.
        If the user later changes status away from Done, we do not erase completed_at.
      */
      if (isDoneStatus(nextStatus) && !existingProject.completed_at) {
        updateData.completed_at = nowIso;
      }
    }

    if (field === "client_name") {
      const nextClientName = normalizeText(value);

      if (!nextClientName) {
        return NextResponse.json(
          { error: "Client name cannot be empty" },
          { status: 400 }
        );
      }

      updateData.client_name = nextClientName;
    }

    if (field === "contact_name") {
      const nextContactName = normalizeNullableText(value);

      updateData.contact_name = nextContactName;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Unsupported project field" },
        { status: 400 }
      );
    }

    const isSimpleProjectField =
      field !== "client_name" && field !== "contact_name";

    if (isSimpleProjectField) {
      const { data: updatedProject, error: projectUpdateError } = await supabase
        .from("projects")
        .update(updateData)
        .eq("id", projectId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .select("*")
        .single();

      if (projectUpdateError || !updatedProject) {
        console.error("Project update error:", projectUpdateError);

        if (projectUpdateError?.code === "PGRST116" || !updatedProject) {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 }
          );
        }

        return NextResponse.json(
          { error: projectUpdateError?.message || "Failed to update project" },
          { status: 500 }
        );
      }

      try {
        const project = await reloadProject({
          supabase,
          projectId,
          userId: user.id,
        });

        return NextResponse.json({
          success: true,
          project,
        });
      } catch (reloadError) {
        console.warn(
          "Project updated, but relationship reload failed:",
          reloadError
        );

        return NextResponse.json({
          success: true,
          project: updatedProject,
        });
      }
    }

    const identityValue =
      field === "client_name"
        ? String(updateData.client_name)
        : (updateData.contact_name as string | null);
    const { data: updatedProject, error: projectUpdateError } =
      await supabase.rpc("update_project_client_identity_transaction", {
        p_project_id: projectId,
        p_field: field,
        p_value: identityValue,
      });

    if (projectUpdateError || !updatedProject) {
      console.error("Project update error:", projectUpdateError);

      const message = projectUpdateError?.message || "";

      if (message.includes("PROJECT_NOT_FOUND")) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      if (
        message.includes("INVALID_REQUEST") ||
        message.includes("INVALID_CLIENT_NAME")
      ) {
        return NextResponse.json(
          { error: "Invalid request body" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: projectUpdateError?.message || "Failed to update project" },
        { status: 500 }
      );
    }

    try {
      const project = await reloadProject({
        supabase,
        projectId,
        userId: user.id,
      });

      return NextResponse.json({
        success: true,
        project,
      });
    } catch (reloadError) {
      console.warn(
        "Project client identity updated, but relationship reload failed:",
        reloadError
      );

      return NextResponse.json({
        success: true,
        project: updatedProject,
      });
    }
  } catch (error: any) {
    console.error("Update project route error:", error);

    return NextResponse.json(
      { error: error.message || "Failed to update project" },
      { status: 500 }
    );
  }
}
