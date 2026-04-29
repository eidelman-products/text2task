import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseDeadline } from "@/lib/tasks/parse-deadline";
import { parseAmount } from "@/lib/tasks/parse-amount";

type TasksView = "active" | "archived" | "all" | "stats";

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

function pickFirstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function normalizeEmail(value: unknown): string {
  const email = normalizeOptionalClientField(value);

  if (!email) return "";

  return email.toLowerCase();
}

function normalizePhone(value: unknown): string {
  const phone = normalizeOptionalClientField(value);

  if (!phone) return "";

  return phone;
}

function normalizeTasksView(value: string | null): TasksView {
  if (value === "archived") return "archived";
  if (value === "all") return "all";
  if (value === "stats") return "stats";
  return "active";
}

function isDoneStatus(status: string | null | undefined) {
  return String(status || "").trim().toLowerCase() === "done";
}

function cleanTaskWithJoinedClient(task: any) {
  const cleanTask = {
    ...task,
    client: Array.isArray(task.clients)
      ? task.clients[0] ?? null
      : task.clients ?? null,
  };

  const { clients, ...result } = cleanTask;
  return result;
}

function getClientPayloadFromBody(body: any) {
  const client_name = pickFirstString(
    body.client_name,
    body.clientName,
    body.client,
    body.customer_name,
    body.customerName,
    body.customer
  );

  const rawPhone = pickFirstString(
    body.client_phone,
    body.clientPhone,
    body.phone,
    body.phone_number,
    body.phoneNumber,
    body.client_mobile,
    body.clientMobile,
    body.mobile
  );

  const rawEmail = pickFirstString(
    body.client_email,
    body.clientEmail,
    body.email,
    body.email_address,
    body.emailAddress,
    body.client_mail,
    body.clientMail
  );

  const client_notes = pickFirstString(
    body.client_notes,
    body.clientNotes,
    body.notes,
    body.client_note,
    body.clientNote
  );

  return {
    client_name,
    client_phone: normalizePhone(rawPhone),
    client_email: normalizeEmail(rawEmail),
    client_notes,
  };
}

function getTaskTitleFromBody(body: any): string {
  return pickFirstString(
    body.task_title,
    body.taskTitle,
    body.title,
    body.task,
    body.name
  );
}

function getDeadlineTextFromBody(body: any): string {
  return pickFirstString(
    body.deadline_text,
    body.deadlineText,
    body.deadline,
    body.due_date_text,
    body.dueDateText,
    body.due_date,
    body.dueDate
  );
}

function getSourceFromBody(body: any): string {
  return (
    pickFirstString(
      body.source,
      body.input_source,
      body.inputSource,
      body.origin
    ) || "Pasted text"
  );
}

function getRawInputFromBody(body: any): string {
  return pickFirstString(
    body.raw_input,
    body.rawInput,
    body.original_text,
    body.originalText,
    body.input,
    body.text
  );
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
    const view = normalizeTasksView(url.searchParams.get("view"));

    let query = supabase
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
      .eq("user_id", user.id);

    /*
      חשוב:
      active / archived / all = מיועדים להצגת טבלה למשתמש ולכן לא מציגים deleted_at.
      stats = מיועד לסטטיסטיקות Lifetime ולכן כולל גם משימות שנמחקו לצמיתות.
    */
    if (view !== "stats") {
      query = query.is("deleted_at", null);
    }

    if (view === "active") {
      query = query.eq("is_archived", false);
    }

    if (view === "archived") {
      query = query.eq("is_archived", true);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("tasks GET error:", error);

      return NextResponse.json(
        { error: error.message || "Failed to load tasks" },
        { status: 500 }
      );
    }

    const tasks = (data ?? []).map(cleanTaskWithJoinedClient);

    return NextResponse.json({
      view,
      tasks,
    });
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

    const { client_name, client_phone, client_email, client_notes } =
      getClientPayloadFromBody(body);

    const task_title = getTaskTitleFromBody(body);

    const rawAmountInput = normalizeAmountInput(
      body.amount ??
        body.budget ??
        body.price ??
        body.cost ??
        body.value ??
        body.amount_text ??
        body.amountText
    );

    const parsedAmount = parseAmount(rawAmountInput);

    const amount =
      parsedAmount.displayAmount ??
      (typeof rawAmountInput === "string"
        ? rawAmountInput
        : typeof rawAmountInput === "number"
        ? String(rawAmountInput)
        : null);

    const deadline_text = getDeadlineTextFromBody(body);

    const priority =
      pickFirstString(body.priority, body.task_priority, body.taskPriority) ||
      "Medium";

    const status =
      pickFirstString(body.status, body.task_status, body.taskStatus) || "New";

    const source = getSourceFromBody(body);

    const raw_input = getRawInputFromBody(body);

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
        console.error("client lookup error:", clientLookupError);

        return NextResponse.json(
          { error: clientLookupError.message || "Failed to lookup client" },
          { status: 500 }
        );
      }

      if (existingClients && existingClients.length > 0) {
        const existingClient = existingClients[0];

        clientId = existingClient.id;

        /*
          חשוב:
          לא מוחקים מידע קיים אם השדה החדש ריק.
          אם AI/Preview שלח טלפון או אימייל חדש - מעדכנים את הלקוח.
          אם לא שלח - משאירים את מה שכבר קיים.
        */
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
              .eq("user_id", user.id)
              .select("id, name, phone, email, notes, created_at")
              .single();

          if (updateClientError) {
            console.error("client update error:", updateClientError);

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
          console.error("client create error:", createClientError);

          return NextResponse.json(
            { error: createClientError.message || "Failed to create client" },
            { status: 500 }
          );
        }

        clientId = newClient.id;
        clientData = newClient;
      }
    }

    const nowIso = new Date().toISOString();
    const completed_at = isDoneStatus(status) ? nowIso : null;

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
        is_archived: false,
        archived_at: null,
        completed_at,
        deleted_at: null,
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
      console.error("task insert error:", error);

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