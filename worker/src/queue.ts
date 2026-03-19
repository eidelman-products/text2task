import { config } from "./config";

export const scanQueueName = config.SCAN_QUEUE_NAME;

export const redisConnectionOptions = {
  url: config.REDIS_URL,
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
};