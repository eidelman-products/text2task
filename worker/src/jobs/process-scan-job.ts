import { supabaseAdmin } from "../supabase";
import { logger } from "../logger";
import { getValidAccessToken } from "../lib/get-valid-access-token";
import { runScan } from "../lib/scan/scan-engine";
import type { ScanProgress, ScanResult } from "../lib/scan/scan-types";

export type ScanJobPayload = {
  scanJobId: string;
};

function buildScanResultsRow(params: {
  scanJobId: string;
  userId: string;
  scanResult: ScanResult;
}) {
  const { scanJobId, userId, scanResult } = params;

  const inboxHealthSummary = {
    mode: scanResult.mode,
    scanned: scanResult.scanned,
    totalInboxCount: scanResult.totalInboxCount,
    senderGroups: scanResult.senderGroups,
    largestSenderCount: scanResult.largestSenderCount,
    healthScore: scanResult.healthScore,
    completed: scanResult.completed,
  };

  const promotionsSummary = {
    senders: scanResult.promotionsSenders,
    promotionsFound: scanResult.promotionsFound,
    promotionsFoundInSampleScan: scanResult.promotionsFoundInSampleScan,
    fullInboxPromotionsCount: scanResult.fullInboxPromotionsCount,
  };

  const smartViewsSummary = {
    counts: scanResult.smartViews,
    ids: scanResult.smartViewIds,
  };

  const rawSummaryJson = {
    mode: scanResult.mode,
    scanned: scanResult.scanned,
    totalInboxCount: scanResult.totalInboxCount,
    topSenders: scanResult.topSenders,
    promotionsSenders: scanResult.promotionsSenders,
    promotionsFound: scanResult.promotionsFound,
    promotionsFoundInSampleScan: scanResult.promotionsFoundInSampleScan,
    fullInboxPromotionsCount: scanResult.fullInboxPromotionsCount,
    senderGroups: scanResult.senderGroups,
    largestSenderCount: scanResult.largestSenderCount,
    healthScore: scanResult.healthScore,
    smartViews: scanResult.smartViews,
    smartViewIds: scanResult.smartViewIds,
    completed: scanResult.completed,
  };

  return {
    job_id: scanJobId,
    user_id: userId,
    top_senders: scanResult.topSenders,
    promotions_summary: promotionsSummary,
    smart_views_summary: smartViewsSummary,
    inbox_health_summary: inboxHealthSummary,
    raw_summary_json: rawSummaryJson,
    updated_at: new Date().toISOString(),
  };
}

async function savePartialResults(params: {
  scanJobId: string;
  userId: string;
  scanResult: ScanResult;
}) {
  const row = buildScanResultsRow(params);

  const { error } = await supabaseAdmin
    .from("scan_results")
    .upsert(row, { onConflict: "job_id" });

  if (error) {
    throw new Error(`Failed saving scan_results: ${error.message}`);
  }
}

async function updateJobProgress(scanJobId: string, progress: ScanProgress) {
  const currentStep = progress.completed
    ? "Finalizing scan"
    : `Scanning Gmail messages (${progress.scannedCount}${
        progress.estimatedTotal ? ` / ${progress.estimatedTotal}` : ""
      })`;

  const { error } = await supabaseAdmin
    .from("scan_jobs")
    .update({
      current_step: currentStep,
      progress_percent: progress.progressPercent,
      processed_messages: progress.scannedCount,
      total_messages_estimate: progress.estimatedTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scanJobId);

  if (error) {
    throw new Error(`Failed updating scan progress: ${error.message}`);
  }
}

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
      processed_messages: 0,
      total_messages_estimate: 0,
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
        progress_percent: 10,
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
      pageSize: 25,
      metadataConcurrency: 5,
      onProgress: async (progress) => {
        await updateJobProgress(scanJobId, progress);
      },
      onPartialResult: async (partialResult, progress) => {
        await savePartialResults({
          scanJobId,
          userId,
          scanResult: partialResult,
        });

        if (progress.completed) {
          logger.info("Partial scan result saved for completed scan", {
            scanJobId,
            scannedCount: progress.scannedCount,
          });
        }
      },
    });

    const { error: savingStateError } = await supabaseAdmin
      .from("scan_jobs")
      .update({
        current_step: "Saving results",
        progress_percent: 95,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanJobId);

    if (savingStateError) {
      throw new Error(`Failed updating saving state: ${savingStateError.message}`);
    }

    await savePartialResults({
      scanJobId,
      userId,
      scanResult,
    });

    const { error: completedError } = await supabaseAdmin
      .from("scan_jobs")
      .update({
        status: "completed",
        current_step: "Scan completed successfully",
        progress_percent: 100,
        processed_messages: scanResult.scanned,
        total_messages_estimate:
          scanResult.totalInboxCount ?? scanResult.scanned,
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