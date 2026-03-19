import { supabaseAdmin } from "../supabase";
import { logger } from "../logger";
import { getValidAccessToken } from "../lib/get-valid-access-token";

// נייבא את runScan מהאפליקציה (בהמשך נעתיק אותו ל-worker)
import { runScan } from "../lib/scan/scan-engine";

export type ScanJobPayload = {
  scanJobId: string;
};

export async function processScanJob(payload: ScanJobPayload) {
  const { scanJobId } = payload;

  logger.info("Starting scan job", { scanJobId });

  // 1. להביא את ה-job
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

  // 2. עדכון ל-running
  await supabaseAdmin
    .from("scan_jobs")
    .update({
      status: "running",
      current_step: "Loading Gmail access token",
      progress_percent: 5,
      started_at: job.started_at ?? startedAt,
      updated_at: startedAt,
    })
    .eq("id", scanJobId);

  try {
    // 3. קבלת access token
    const accessToken = await getValidAccessToken(userId);

    await supabaseAdmin
      .from("scan_jobs")
      .update({
        current_step: "Scanning Gmail messages",
        progress_percent: 15,
      })
      .eq("id", scanJobId);

    // 4. הרצת scan אמיתי 🔥
    const scanResult = await runScan({
      userId,
      gmailAccessToken: accessToken,
      mode: "full",
    });

    await supabaseAdmin
      .from("scan_jobs")
      .update({
        current_step: "Saving results",
        progress_percent: 85,
      })
      .eq("id", scanJobId);

    // 5. שמירת תוצאה
    await supabaseAdmin.from("scan_results").upsert({
      scan_id: scanJobId,
      user_id: userId,
      mode: "full",
      scanned: scanResult.scanned,
      top_senders: scanResult.topSenders,
      promotions_senders: scanResult.promotionsSenders,
      smart_views: scanResult.smartViews,
      smart_view_ids: scanResult.smartViewIds,
      full_inbox_promotions_count: null,
      completed: scanResult.completed,
    });

    // 6. סיום
    await supabaseAdmin
      .from("scan_jobs")
      .update({
        status: "completed",
        current_step: "Scan completed successfully",
        progress_percent: 100,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanJobId);

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
      })
      .eq("id", scanJobId);

    throw error;
  }
}