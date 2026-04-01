import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseFromCookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: job, error } = await supabase
      .from("scan_jobs")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    return NextResponse.json({
      scanId: job.id,
      scanType: job.scan_type,
      status: job.status,
      progress: job.progress_percent ?? 0,
      currentStep: job.current_step ?? "",
      processedMessages: job.processed_messages ?? 0,
      nextPageToken: job.next_page_token ?? null,
      startedAt: job.started_at ?? null,
      finishedAt: job.finished_at ?? null,
      errorMessage: job.error_message ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseFromCookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: job, error: jobError } = await supabase
      .from("scan_jobs")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    if (job.status === "completed") {
      return NextResponse.json(
        {
          error: "Completed scans cannot be cancelled",
          scanId: job.id,
          status: job.status,
        },
        { status: 400 }
      );
    }

    if (job.status === "failed") {
      return NextResponse.json(
        {
          error: "Failed scans cannot be cancelled",
          scanId: job.id,
          status: job.status,
        },
        { status: 400 }
      );
    }

    if (job.status === "cancelled") {
      return NextResponse.json({
        success: true,
        scanId: job.id,
        status: job.status,
        currentStep: job.current_step ?? "Scan cancelled",
      });
    }

    if (!["queued", "running"].includes(job.status)) {
      return NextResponse.json(
        {
          error: "This scan cannot be cancelled",
          scanId: job.id,
          status: job.status,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("scan_jobs")
      .update({
        status: "cancelled",
        current_step: "Scan cancelled by user",
        finished_at: now,
        updated_at: now,
        error_message: null,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to cancel scan" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scanId: id,
      status: "cancelled",
      currentStep: "Scan cancelled by user",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}