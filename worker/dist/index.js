"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("./config");
const logger_1 = require("./logger");
const queue_1 = require("./queue");
const process_scan_job_1 = require("./jobs/process-scan-job");
logger_1.logger.info("Booting InboxShaper worker", {
    queue: queue_1.scanQueueName,
    concurrency: config_1.config.WORKER_CONCURRENCY,
    env: config_1.config.NODE_ENV,
});
const worker = new bullmq_1.Worker(queue_1.scanQueueName, async (job) => {
    logger_1.logger.info("Received queue job", {
        bullJobId: job.id,
        scanJobId: job.data.scanJobId,
    });
    await (0, process_scan_job_1.processScanJob)(job.data);
}, {
    connection: queue_1.redisConnectionOptions,
    concurrency: config_1.config.WORKER_CONCURRENCY,
});
const shutdownRedis = new ioredis_1.default(queue_1.redisConnectionOptions.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});
worker.on("ready", () => {
    logger_1.logger.info("Worker is ready");
});
worker.on("completed", (job) => {
    logger_1.logger.info("BullMQ job completed", {
        bullJobId: job.id,
        scanJobId: job.data.scanJobId,
    });
});
worker.on("failed", (job, err) => {
    logger_1.logger.error("BullMQ job failed", {
        bullJobId: job?.id,
        scanJobId: job?.data?.scanJobId,
        error: err.message,
    });
});
worker.on("error", (err) => {
    logger_1.logger.error("Worker runtime error", { error: err.message });
});
async function shutdown(signal) {
    logger_1.logger.warn(`Received ${signal}, shutting down worker...`);
    await worker.close();
    await shutdownRedis.quit();
    process.exit(0);
}
process.on("SIGINT", () => {
    void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
});
