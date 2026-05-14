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

      if (existingProject.client_id) {
        const { error: clientUpdateError } = await supabase
          .from("clients")
          .update({ name: nextClientName })
          .eq("id", existingProject.client_id)
          .eq("user_id", user.id);

        if (clientUpdateError) {
          console.error("Client name update error:", clientUpdateError);

          return NextResponse.json(
            { error: clientUpdateError.message || "Failed to update client" },
            { status: 500 }
          );
        }
      }

      /*
        Compatibility sync:
        Existing CRM screens still have fallback logic from task rows.
        The project remains the source of truth, but this prevents old fallback UI
        from showing stale client names until the read model is fully project-based.
      */
      await supabase
        .from("tasks")
        .update({ client_name: nextClientName })
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .is("deleted_at", null);
    }

    if (field === "contact_name") {
      const nextContactName = normalizeNullableText(value);

      updateData.contact_name = nextContactName;

      if (existingProject.client_id) {
        const { error: clientUpdateError } = await supabase
          .from("clients")
          .update({ contact_name: nextContactName })
          .eq("id", existingProject.client_id)
          .eq("user_id", user.id);

        if (clientUpdateError) {
          console.error("Contact name update error:", clientUpdateError);

          return NextResponse.json(
            { error: clientUpdateError.message || "Failed to update contact" },
            { status: 500 }
          );
        }
      }

      await supabase
        .from("tasks")
        .update({ contact_name: nextContactName })
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .is("deleted_at", null);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Unsupported project field" },
        { status: 400 }
      );
    }

    const { error: projectUpdateError } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", projectId)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (projectUpdateError) {
      console.error("Project update error:", projectUpdateError);

      return NextResponse.json(
        { error: projectUpdateError.message || "Failed to update project" },
        { status: 500 }
      );
    }

    const project = await reloadProject({
      supabase,
      projectId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error: any) {
    console.error("Update project route error:", error);

    return NextResponse.json(
      { error: error.message || "Failed to update project" },
      { status: 500 }
    );
  }
}