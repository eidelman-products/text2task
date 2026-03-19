"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnectionOptions = exports.scanQueueName = void 0;
const config_1 = require("./config");
exports.scanQueueName = config_1.config.SCAN_QUEUE_NAME;
exports.redisConnectionOptions = {
    url: config_1.config.REDIS_URL,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
};
