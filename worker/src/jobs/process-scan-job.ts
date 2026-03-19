import { supabaseAdmin } from "../supabase";
import { logger } from "../logger";
import { getValidAccessToken } from "../lib/get-valid-access-token";
import { runScan } from "../lib/scan/scan-engine";

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

  const userId = job.user_id;

  if (!userId) {
    throw new Error("Missing user_id in scan_jobs");
  }

  const startedAt = new Date().toISOString();

  const { error: runningError } = await supabaseAdmin
    .from("scan_jobs")
    .update({
      status: "running",
      current_step: "Loading Gmail access token",
      progress_percent: 5,
      started_at: job.started_at ?? startedAt,
      updated_at: startedAt,
      error_message: null,
      finished_at: null,
    })
    .eq("id", scanJobId);

  if (runningError) {
    throw new Error(`Failed updating job to running: ${runningError.message}`);
  }

  try {
    const accessToken = await getValidAccessToken(userId);

    const { error: scanStartError } = await supabaseAdmin
      .from("scan_jobs")
      .update({
        current_step: "Scanning Gmail messages",
        progress_percent: 15,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanJobId);

    if (scanStartError) {
      throw new Error(`Failed updating scan start state: ${scanStartError.message}`);
    }

    const scanResult = await runScan({
      userId,
      gmailAccessToken: accessToken,
      mode: "full",
    });

    const { error: savingStateError } = await supabaseAdmin
      .from("scan_jobs")
      .update({
        current_step: "Saving results",
        progress_percent: 85,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanJobId);

    if (savingStateError) {
      throw new Error(`Failed updating saving state: ${savingStateError.message}`);
    }

    const inboxHealthSummary = {
      mode: "full",
      scanned: scanResult.scanned,
      completed: scanResult.completed,
    };

    const promotionsSummary = {
      senders: scanResult.promotionsSenders,
      count: scanResult.promotionsSenders.length,
    };

    const smartViewsSummary = {
      counts: scanResult.smartViews,
      ids: scanResult.smartViewIds,
    };

    const rawSummaryJson = {
      scanned: scanResult.scanned,
      completed: scanResult.completed,
      topSenders: scanResult.topSenders,
      promotionsSenders: scanResult.promotionsSenders,
      smartViews: scanResult.smartViews,
      smartViewIds: scanResult.smartViewIds,
      mode: "full",
    };

    const { error: resultsError } = await supabaseAdmin
      .from("scan_results")
      .upsert(
        {
          job_id: scanJobId,
          user_id: userId,
          top_senders: scanResult.topSenders,
          promotions_summary: promotionsSummary,
          smart_views_summary: smartViewsSummary,
          inbox_health_summary: inboxHealthSummary,
          raw_summary_json: rawSummaryJson,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "job_id",
        }
      );

    if (resultsError) {
      throw new Error(`Failed saving scan_results: ${resultsError.message}`);
    }

    const { error: completedError } = await supabaseAdmin
      .from("scan_jobs")
      .update({
        status: "completed",
        current_step: "Scan completed successfully",
        progress_percent: 100,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", scanJobId);

    if (completedError) {
      throw new Error(`Failed updating job to completed: ${completedError.message}`);
    }

    logger.info("Completed scan job", { scanJobId });
  } catch (error: any) {
    logger.error("Scan failed", {
      scanJobId,
      error: error.message,
    });

    await supabaseAdmin
      .from("scan_jobs")
      .update({
        status: "failed",
        current_step: "Scan failed",
        error_message: error.message,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanJobId);

    throw error;
  }
}