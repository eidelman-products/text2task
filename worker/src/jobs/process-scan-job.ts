import { supabaseAdmin } from "../supabase";
import { logger } from "../logger";
import { getValidAccessToken } from "../lib/get-valid-access-token";
import { runScan } from "../lib/scan/scan-engine";
import type { ScanProgress, ScanResult } from "../lib/scan/scan-types";

export type ScanJobPayload = {
  scanJobId: string;
  userId?: string;
  scanType?: "sample" | "full";
  maxEmails?: number | null;
};

const SCAN_CANCELLED_ERROR = "SCAN_CANCELLED";

async function isScanCancelled(scanJobId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("scan_jobs")
    .select("status")
    .eq("id", scanJobId)
    .single();

  if (error) {
    throw new Error(`Failed checking scan cancel state: ${error.message}`);
  }

  return data?.status === "cancelled";
}

async function throwIfCancelled(scanJobId: string) {
  const cancelled = await isScanCancelled(scanJobId);
  if (cancelled) {
    throw new Error(SCAN_CANCELLED_ERROR);
  }
}

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

function buildScanSnapshotRow(params: {
  scanJobId: string;
  userId: string;
  scanType: "sample" | "full";
  scanResult: ScanResult;
}) {
  const { scanJobId, userId, scanType, scanResult } = params;

  const readyForCleanupCount =
    typeof scanResult.promotionsFound === "number"
      ? scanResult.promotionsFound
      : 0;

  const topSenderCount =
    Array.isArray(scanResult.topSenders) && scanResult.topSenders.length > 0
      ? Number(scanResult.topSenders[0]?.count ?? 0)
      : 0;

  return {
    user_id: userId,
    scan_job_id: scanJobId,
    scan_type: scanType,
    emails_analyzed: Number(scanResult.scanned ?? 0),
    promotions_count: Number(scanResult.promotionsFound ?? 0),
    sender_groups_count: Number(scanResult.senderGroups ?? 0),
    inbox_health_score: Number(scanResult.healthScore ?? 0),
    ready_for_cleanup_count: Number(readyForCleanupCount),
    top_sender_count: Number(topSenderCount),
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

async function saveScanSnapshot(params: {
  scanJobId: string;
  userId: string;
  scanType: "sample" | "full";
  scanResult: ScanResult;
}) {
  const row = buildScanSnapshotRow(params);

  const { error } = await supabaseAdmin
    .from("scan_snapshots")
    .insert(row);

  if (error) {
    throw new Error(`Failed saving scan_snapshots: ${error.message}`);
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
  const {
    scanJobId,
    scanType: payloadScanType,
    maxEmails: payloadMaxEmails,
  } = payload;

  logger.info("Starting scan job", {
    scanJobId,
    payloadScanType,
    payloadMaxEmails,
  });

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

  const resolvedScanType: "sample" | "full" =
    job.scan_type === "sample" || job.scan_type === "full"
      ? job.scan_type
      : payloadScanType === "sample"
      ? "sample"
      : "full";

  const resolvedMaxEmails =
    typeof payloadMaxEmails === "number"
      ? payloadMaxEmails
      : resolvedScanType === "sample"
      ? 1000
      : null;

  const startedAt = new Date().toISOString();

  const { error: runningError } = await supabaseAdmin
    .from("scan_jobs")
    .update({
      status: "running",
      current_step:
        resolvedScanType === "sample"
          ? "Loading Gmail access token for free scan"
          : "Loading Gmail access token for full scan",
      progress_percent: 5,
      processed_messages: 0,
      total_messages_estimate: resolvedMaxEmails,
      started_at: job.started_at ?? startedAt,
      updated_at: startedAt,
      error_message: null,
      finished_at: null,
      result_snapshot: {
        ...(job.result_snapshot ?? {}),
        scanMode: resolvedScanType,
        maxEmails: resolvedMaxEmails,
      },
    })
    .eq("id", scanJobId);

  if (runningError) {
    throw new Error(`Failed updating job to running: ${runningError.message}`);
  }

  try {
    await throwIfCancelled(scanJobId);

    const accessToken = await getValidAccessToken(userId);

    await throwIfCancelled(scanJobId);

    const { error: scanStartError } = await supabaseAdmin
      .from("scan_jobs")
      .update({
        current_step:
          resolvedScanType === "sample"
            ? "Scanning up to 1,000 Gmail messages"
            : "Scanning Gmail messages",
        progress_percent: 10,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanJobId);

    if (scanStartError) {
      throw new Error(
        `Failed updating scan start state: ${scanStartError.message}`
      );
    }

    const scanResult = await runScan({
      userId,
      gmailAccessToken: accessToken,
      mode: resolvedScanType,
      maxEmails: resolvedMaxEmails,
      pageSize: 25,
      metadataConcurrency: 5,
      onProgress: async (progress) => {
        await throwIfCancelled(scanJobId);
        await updateJobProgress(scanJobId, progress);
      },
      onPartialResult: async (partialResult, progress) => {
        await throwIfCancelled(scanJobId);

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

    await throwIfCancelled(scanJobId);

    const { error: savingStateError } = await supabaseAdmin
      .from("scan_jobs")
      .update({
        current_step: "Saving results",
        progress_percent: 95,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanJobId);

    if (savingStateError) {
      throw new Error(
        `Failed updating saving state: ${savingStateError.message}`
      );
    }

    await throwIfCancelled(scanJobId);

    await savePartialResults({
      scanJobId,
      userId,
      scanResult,
    });

    await throwIfCancelled(scanJobId);

    await saveScanSnapshot({
      scanJobId,
      userId,
      scanType: resolvedScanType,
      scanResult,
    });

    const finalTotalEstimate =
      resolvedScanType === "sample"
        ? resolvedMaxEmails ?? scanResult.scanned
        : scanResult.totalInboxCount ?? scanResult.scanned;

    await throwIfCancelled(scanJobId);

    const { error: completedError } = await supabaseAdmin
      .from("scan_jobs")
      .update({
        status: "completed",
        current_step:
          resolvedScanType === "sample"
            ? "Free scan completed successfully"
            : "Full scan completed successfully",
        progress_percent: 100,
        processed_messages: scanResult.scanned,
        total_messages_estimate: finalTotalEstimate,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
        result_snapshot: {
          ...(job.result_snapshot ?? {}),
          scanMode: resolvedScanType,
          maxEmails: resolvedMaxEmails,
          completedScanned: scanResult.scanned,
        },
      })
      .eq("id", scanJobId);

    if (completedError) {
      throw new Error(
        `Failed updating job to completed: ${completedError.message}`
      );
    }

    logger.info("Completed scan job", {
      scanJobId,
      resolvedScanType,
      resolvedMaxEmails,
      scanned: scanResult.scanned,
    });
  } catch (error: any) {
    if (error?.message === SCAN_CANCELLED_ERROR) {
      logger.info("Scan cancelled by user", {
        scanJobId,
        payloadScanType,
        payloadMaxEmails,
      });

      const now = new Date().toISOString();

      await supabaseAdmin
        .from("scan_jobs")
        .update({
          status: "cancelled",
          current_step: "Scan cancelled by user",
          finished_at: now,
          updated_at: now,
          error_message: null,
        })
        .eq("id", scanJobId);

      return;
    }

    logger.error("Scan failed", {
      scanJobId,
      error: error.message,
      payloadScanType,
      payloadMaxEmails,
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