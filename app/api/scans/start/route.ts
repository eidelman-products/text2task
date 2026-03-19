import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { scanQueue } from "@/lib/scan-queue";

type ScanType = "sample" | "full";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let scanType: ScanType = "sample";

    try {
      const body = await request.json().catch(() => null);
      if (body?.scanType === "full" || body?.scanType === "sample") {
        scanType = body.scanType;
      }
    } catch {
      // keep default
    }

    const { data: existingJobs, error: existingJobsError } = await supabase
      .from("scan_jobs")
      .select("id, status, scan_type, current_step, progress_percent")
      .eq("user_id", user.id)
      .in("status", ["queued", "running"]);

    if (existingJobsError) {
      return NextResponse.json(
        { error: existingJobsError.message },
        { status: 500 }
      );
    }

    const existingJob =
      existingJobs && existingJobs.length > 0 ? existingJobs[0] : null;

    if (existingJob) {
      return NextResponse.json(
        {
          error: "Scan already in progress",
          scanId: existingJob.id,
          status: existingJob.status,
          scanType: existingJob.scan_type,
          progress: existingJob.progress_percent ?? 0,
          currentStep: existingJob.current_step ?? "",
        },
        { status: 400 }
      );
    }

    const initialStep =
      scanType === "full"
        ? "Starting full scan..."
        : "Starting sample scan...";

    const { data: newJob, error: insertError } = await supabase
      .from("scan_jobs")
      .insert([
        {
          user_id: user.id,
          scan_type: scanType,
          status: "queued",
          progress_percent: 0,
          current_step: initialStep,
          processed_messages: 0,
          total_messages_estimate: null,
          next_page_token: null,
          error_message: null,
          started_at: null,
          finished_at: null,
          result_snapshot: {},
        },
      ])
      .select()
      .single();

    if (insertError || !newJob) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create job" },
        { status: 500 }
      );
    }

    await scanQueue.add(
      "scan-inbox",
      {
        scanJobId: newJob.id,
      },
      {
        jobId: newJob.id,
        removeOnComplete: 100,
        removeOnFail: 100,
      }
    );

    return NextResponse.json({
      success: true,
      scanId: newJob.id,
      scanType: newJob.scan_type,
      status: newJob.status,
      progress: newJob.progress_percent ?? 0,
      currentStep: newJob.current_step ?? "",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}