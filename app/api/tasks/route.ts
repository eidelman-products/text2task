import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseDeadline } from "@/lib/tasks/parse-deadline";
import { parseAmount } from "@/lib/tasks/parse-amount";

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

function normalizeClientName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalClientField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("tasks")
      .select(
        `
        *,
        clients (
          id,
          name,
          phone,
          email,
          notes,
          created_at
        )
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("tasks GET error:", error);

      return NextResponse.json(
        { error: error.message || "Failed to load tasks" },
        { status: 500 }
      );
    }

    const tasks =
      data?.map((task: any) => ({
        ...task,
        client: Array.isArray(task.clients)
          ? task.clients[0] ?? null
          : task.clients ?? null,
      })) ?? [];

    const cleanedTasks = tasks.map(({ clients, ...task }: any) => task);

    return NextResponse.json({ tasks: cleanedTasks });
  } catch (error: any) {
    console.error("tasks GET unexpected error:", error);

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

    const client_name = normalizeClientName(body.client_name);
    const client_phone = normalizeOptionalClientField(body.client_phone);
    const client_email = normalizeOptionalClientField(body.client_email);
    const client_notes = normalizeOptionalClientField(body.client_notes);

    const task_title =
      typeof body.task_title === "string" ? body.task_title.trim() : "";

    const rawAmountInput = normalizeAmountInput(body.amount);
    const parsedAmount = parseAmount(rawAmountInput);

    const amount =
      parsedAmount.displayAmount ??
      (typeof rawAmountInput === "string"
        ? rawAmountInput
        : typeof rawAmountInput === "number"
        ? String(rawAmountInput)
        : null);

    const deadline_text =
      typeof body.deadline_text === "string" ? body.deadline_text.trim() : "";

    const priority =
      typeof body.priority === "string" && body.priority.trim()
        ? body.priority.trim()
        : "Medium";

    const status =
      typeof body.status === "string" && body.status.trim()
        ? body.status.trim()
        : "New";

    const source =
      typeof body.source === "string" && body.source.trim()
        ? body.source.trim()
        : "Pasted text";

    const raw_input =
      typeof body.raw_input === "string" ? body.raw_input.trim() : "";

    if (!task_title) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      );
    }

    const { deadlineDate } = parseDeadline(deadline_text);

    let clientId: string | null = null;
    let clientData: any = null;

    if (client_name) {
      const { data: existingClients, error: clientLookupError } = await supabase
        .from("clients")
        .select("id, name, phone, email, notes, created_at")
        .eq("user_id", user.id)
        .ilike("name", client_name)
        .limit(1);

      if (clientLookupError) {
        return NextResponse.json(
          { error: clientLookupError.message || "Failed to lookup client" },
          { status: 500 }
        );
      }

      if (existingClients && existingClients.length > 0) {
        const existingClient = existingClients[0];

        clientId = existingClient.id;

        const nextPhone = client_phone || existingClient.phone || null;
        const nextEmail = client_email || existingClient.email || null;
        const nextNotes = client_notes || existingClient.notes || null;

        const shouldUpdateClient =
          nextPhone !== (existingClient.phone || null) ||
          nextEmail !== (existingClient.email || null) ||
          nextNotes !== (existingClient.notes || null);

        if (shouldUpdateClient) {
          const { data: updatedClient, error: updateClientError } =
            await supabase
              .from("clients")
              .update({
                phone: nextPhone,
                email: nextEmail,
                notes: nextNotes,
              })
              .eq("id", existingClient.id)
              .select("id, name, phone, email, notes, created_at")
              .single();

          if (updateClientError) {
            return NextResponse.json(
              {
                error:
                  updateClientError.message || "Failed to update client details",
              },
              { status: 500 }
            );
          }

          clientData = updatedClient;
        } else {
          clientData = existingClient;
        }
      } else {
        const { data: newClient, error: createClientError } = await supabase
          .from("clients")
          .insert({
            user_id: user.id,
            name: client_name,
            phone: client_phone || null,
            email: client_email || null,
            notes: client_notes || null,
          })
          .select("id, name, phone, email, notes, created_at")
          .single();

        if (createClientError) {
          return NextResponse.json(
            { error: createClientError.message || "Failed to create client" },
            { status: 500 }
          );
        }

        clientId = newClient.id;
        clientData = newClient;
      }
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        client_name,
        client_id: clientId,
        task_title,
        amount,
        amount_value: parsedAmount.amountValue,
        currency_code: parsedAmount.currencyCode,
        deadline_text,
        deadline_date: deadlineDate,
        priority,
        status,
        source,
        raw_input,
      })
      .select(
        `
        *,
        clients (
          id,
          name,
          phone,
          email,
          notes,
          created_at
        )
      `
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to save task" },
        { status: 500 }
      );
    }

    const task = {
      ...data,
      client: Array.isArray((data as any).clients)
        ? (data as any).clients[0] ?? clientData
        : (data as any).clients ?? clientData,
    };

    const { clients, ...cleanTask } = task as any;

    return NextResponse.json({ task: cleanTask });
  } catch (error: any) {
    console.error("tasks POST unexpected error:", error);

    return NextResponse.json(
      { error: error.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}