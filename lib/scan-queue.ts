import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("Missing REDIS_URL");
}

export const scanQueue = new Queue("scan-jobs", {
  connection: {
    url: redisUrl,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
});