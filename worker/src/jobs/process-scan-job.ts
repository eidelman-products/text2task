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

const DB_RETRY_MAX_ATTEMPTS = 4;
const DB_RETRY_INITIAL_DELAY_MS = 400;
const DB_RETRY_MAX_DELAY_MS = 4000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelayMs(attempt: number) {
  const base = Math.min(
    DB_RETRY_INITIAL_DELAY_MS * Math.pow(2, attempt),
    DB_RETRY_MAX_DELAY_MS
  );
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(base + jitter, DB_RETRY_MAX_DELAY_MS);
}

function isRetryableDbError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");

  const normalized = message.toLowerCase();

  return (
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("connection") ||
    normalized.includes("socket") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout") ||
    normalized.includes("service unavailable") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("gateway") ||
    normalized.includes("deadlock")
  );
}

async function withDbRetry<T>(
  operationName: string,
  fn: () => PromiseLike<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < DB_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === DB_RETRY_MAX_ATTEMPTS - 1;

      if (!isRetryableDbError(error) || isLastAttempt) {
        logger.error("Database operation failed", {
          operationName,
          attempt: attempt + 1,
          maxAttempts: DB_RETRY_MAX_ATTEMPTS,
          error:
            error instanceof Error ? error.message : String(error ?? "Unknown"),
        });
        throw error;
      }

      const delayMs = getBackoffDelayMs(attempt);

      logger.warn("Retrying database operation", {
        operationName,
        attempt: attempt + 1,
        maxAttempts: DB_RETRY_MAX_ATTEMPTS,
        delayMs,
        error:
          error instanceof Error ? error.message : String(error ?? "Unknown"),
      });

      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Database operation failed: ${operationName}`);
}

async function isScanCancelled(scanJobId: string): Promise<boolean> {
  const { data, error } = await withDbRetry("scan_jobs.select.status", () =>
    supabaseAdmin
      .from("scan_jobs")
      .select("status")
      .eq("id", scanJobId)
      .single()
  );

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

  const { error } = await withDbRetry("scan_results.upsert", () =>
    supabaseAdmin.from("scan_results").upsert(row, { onConflict: "job_id" })
  );

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

  const { error } = await withDbRetry("scan_snapshots.insert", () =>
    supabaseAdmin.from("scan_snapshots").insert(row)
  );

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

  const { error } = await withDbRetry("scan_jobs.update.progress", () =>
    supabaseAdmin
      .from("scan_jobs")
      .update({
        current_step: currentStep,
        progress_percent: progress.progressPercent,
        processed_messages: progress.scannedCount,
        total_messages_estimate: progress.estimatedTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanJobId)
  );

  if (error) {
    throw new Error(`Failed updating scan progress: ${error.message}`);
  }
}

async function updateJobState(
  scanJobId: string,
  values: Record<string, unknown>,
  operationName: string
) {
  const { error } = await withDbRetry(operationName, () =>
    supabaseAdmin
      .from("scan_jobs")
      .update({
        ...values,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanJobId)
  );

  if (error) {
    throw new Error(`Failed updating scan_jobs: ${error.message}`);
  }
}

async function trySavePartialResults(params: {
  scanJobId: string;
  userId: string;
  scanResult: ScanResult;
  reason: string;
}) {
  try {
    await savePartialResults({
      scanJobId: params.scanJobId,
      userId: params.userId,
      scanResult: params.scanResult,
    });

    logger.info("Partial scan result saved", {
      scanJobId: params.scanJobId,
      scanned: params.scanResult.scanned,
      reason: params.reason,
    });
  } catch (error) {
    logger.error("Failed saving partial scan result", {
      scanJobId: params.scanJobId,
      reason: params.reason,
      error: error instanceof Error ? error.message : String(error ?? "Unknown"),
    });
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

  const { data: job, error: fetchError } = await withDbRetry(
    "scan_jobs.select.full_row",
    () =>
      supabaseAdmin
        .from("scan_jobs")
        .select("*")
        .eq("id", scanJobId)
        .single()
  );

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
  let latestPartialResult: ScanResult | null = null;

  await updateJobState(
    scanJobId,
    {
      status: "running",
      current_step:
        resolvedScanType === "sample"
          ? "Loading Gmail access token for free scan"
          : "Loading Gmail access token for full scan",
      progress_percent: 5,
      processed_messages: 0,
      total_messages_estimate: resolvedMaxEmails,
      started_at: job.started_at ?? startedAt,
      error_message: null,
      finished_at: null,
      result_snapshot: {
        ...(job.result_snapshot ?? {}),
        scanMode: resolvedScanType,
        maxEmails: resolvedMaxEmails,
      },
    },
    "scan_jobs.update.running"
  );

  try {
    await throwIfCancelled(scanJobId);

    const accessToken = await getValidAccessToken(userId);

    await throwIfCancelled(scanJobId);

    await updateJobState(
      scanJobId,
      {
        current_step:
          resolvedScanType === "sample"
            ? "Scanning up to 1,000 Gmail messages"
            : "Scanning Gmail messages",
        progress_percent: 10,
      },
      "scan_jobs.update.scan_start"
    );

    const scanResult = await runScan({
      userId,
      gmailAccessToken: accessToken,
      mode: resolvedScanType,
      maxEmails: resolvedMaxEmails,
      pageSize: 25,
      metadataConcurrency: 5,
      onProgress: async (progress) => {
        await throwIfCancelled(scanJobId);

        try {
          await updateJobProgress(scanJobId, progress);
        } catch (error) {
          logger.error("Failed updating scan progress during onProgress", {
            scanJobId,
            scannedCount: progress.scannedCount,
            estimatedTotal: progress.estimatedTotal,
            progressPercent: progress.progressPercent,
            error:
              error instanceof Error
                ? error.message
                : String(error ?? "Unknown"),
          });

          throw error;
        }
      },
      onPartialResult: async (partialResult, progress) => {
        await throwIfCancelled(scanJobId);

        latestPartialResult = partialResult;

        try {
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
        } catch (error) {
          logger.error("Failed saving partial scan result during scan", {
            scanJobId,
            scannedCount: progress.scannedCount,
            completed: progress.completed,
            error:
              error instanceof Error
                ? error.message
                : String(error ?? "Unknown"),
          });

          throw error;
        }
      },
    });

    latestPartialResult = scanResult;

    await throwIfCancelled(scanJobId);

    await updateJobState(
      scanJobId,
      {
        current_step: "Saving results",
        progress_percent: 95,
      },
      "scan_jobs.update.saving_results"
    );

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

    await updateJobState(
      scanJobId,
      {
        status: "completed",
        current_step:
          resolvedScanType === "sample"
            ? "Free scan completed successfully"
            : "Full scan completed successfully",
        progress_percent: 100,
        processed_messages: scanResult.scanned,
        total_messages_estimate: finalTotalEstimate,
        finished_at: new Date().toISOString(),
        error_message: null,
        result_snapshot: {
          ...(job.result_snapshot ?? {}),
          scanMode: resolvedScanType,
          maxEmails: resolvedMaxEmails,
          completedScanned: scanResult.scanned,
        },
      },
      "scan_jobs.update.completed"
    );

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

      if (latestPartialResult) {
        await trySavePartialResults({
          scanJobId,
          userId,
          scanResult: latestPartialResult,
          reason: "cancelled-scan",
        });
      }

      await updateJobState(
        scanJobId,
        {
          status: "cancelled",
          current_step: "Scan cancelled by user",
          finished_at: now,
          error_message: null,
        },
        "scan_jobs.update.cancelled"
      );

      return;
    }

    logger.error("Scan failed", {
      scanJobId,
      error: error?.message ?? "Unknown error",
      payloadScanType,
      payloadMaxEmails,
    });

    if (latestPartialResult) {
      await trySavePartialResults({
        scanJobId,
        userId,
        scanResult: latestPartialResult,
        reason: "failed-scan",
      });
    }

    await updateJobState(
      scanJobId,
      {
        status: "failed",
        current_step: "Scan failed",
        error_message: error?.message ?? "Unknown scan error",
        finished_at: new Date().toISOString(),
      },
      "scan_jobs.update.failed"
    );

    throw error;
  }
}