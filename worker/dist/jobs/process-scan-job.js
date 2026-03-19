"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processScanJob = processScanJob;
const supabase_1 = require("../supabase");
const logger_1 = require("../logger");
async function processScanJob(payload) {
    const { scanJobId } = payload;
    logger_1.logger.info("Starting scan job", { scanJobId });
    const { data: job, error: fetchError } = await supabase_1.supabaseAdmin
        .from("scan_jobs")
        .select("*")
        .eq("id", scanJobId)
        .single();
    if (fetchError || !job) {
        throw new Error(`scan_jobs row not found for id=${scanJobId}`);
    }
    if (!["queued", "running"].includes(job.status)) {
        logger_1.logger.warn("Skipping job because status is not processable", {
            scanJobId,
            status: job.status,
        });
        return;
    }
    const startedAt = new Date().toISOString();
    const { error: runningError } = await supabase_1.supabaseAdmin
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
    const { error: completeError } = await supabase_1.supabaseAdmin
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
    logger_1.logger.info("Completed scan job", { scanJobId });
}
