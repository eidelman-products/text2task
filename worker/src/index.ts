import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config";
import { logger } from "./logger";
import { redisConnectionOptions, scanQueueName } from "./queue";
import { processScanJob, ScanJobPayload } from "./jobs/process-scan-job";

logger.info("Booting InboxShaper worker", {
  queue: scanQueueName,
  concurrency: config.WORKER_CONCURRENCY,
  env: config.NODE_ENV,
});

const worker = new Worker<ScanJobPayload>(
  scanQueueName,
  async (job: Job<ScanJobPayload>) => {
    logger.info("Received queue job", {
      bullJobId: job.id,
      scanJobId: job.data.scanJobId,
    });

    await processScanJob(job.data);
  },
  {
    connection: redisConnectionOptions,
    concurrency: config.WORKER_CONCURRENCY,
  }
);

const shutdownRedis = new IORedis(redisConnectionOptions.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

worker.on("ready", () => {
  logger.info("Worker is ready");
});

worker.on("completed", (job: Job<ScanJobPayload>) => {
  logger.info("BullMQ job completed", {
    bullJobId: job.id,
    scanJobId: job.data.scanJobId,
  });
});

worker.on("failed", (job: Job<ScanJobPayload> | undefined, err: Error) => {
  logger.error("BullMQ job failed", {
    bullJobId: job?.id,
    scanJobId: job?.data?.scanJobId,
    error: err.message,
  });
});

worker.on("error", (err: Error) => {
  logger.error("Worker runtime error", { error: err.message });
});

async function shutdown(signal: string) {
  logger.warn(`Received ${signal}, shutting down worker...`);
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