import { supabaseAdmin } from "../supabase";
import { logger } from "../logger";

export type ScanJobPayload = {
  scanJobId: string;
};

export async function processScanJob(payload: ScanJobPayload) {
  const { scanJobId } = payload;

  logger.info("Starting scan job", { scanJobId });

  const { data: job, error: fetchError } = await supabaseAdmin
    .from("scan_jobs")
    .select("*")
    .eq("id", scanJobId)
    .single();

  if (fetchError || !job) {
    throw new Error(`scan_jobs row not found for id=${scanJobId}`);
  }

  if (!["queued", "running"].includes(job.status)) {
    logger.warn("Skipping job because status is not processable", {
      scanJobId,
      status: job.status,
    });
    return;
  }

  const startedAt = new Date().toISOString();

  const { error: runningError } = await supabaseAdmin
    .from("scan_jobs")
    .update({
      status: "running",
      current_step: "Worker picked up job",
      progress_percent: 1,
      started_at: job.started_at ?? startedAt,
      updated_at: startedAt,
    })
    .eq("id", scanJobId);

  if (runningError) {
    throw new Error(`Failed updating job to running: ${runningError.message}`);
  }

  // כאן ייכנס מנוע הסריקה האמיתי בהמשך
  const { error: completeError } = await supabaseAdmin
    .from("scan_jobs")
    .update({
      status: "completed",
      current_step: "Worker pipeline connected successfully",
      progress_percent: 100,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      result_snapshot: {
        note: "Worker foundation is working. Scan engine not wired yet."
      },
    })
    .eq("id", scanJobId);

  if (completeError) {
    throw new Error(`Failed updating job to completed: ${completeError.message}`);
  }

  logger.info("Completed scan job", { scanJobId });
}