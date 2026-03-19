"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "production", "test"]).default("development"),
    REDIS_URL: zod_1.z.string().min(1, "REDIS_URL is required"),
    SUPABASE_URL: zod_1.z.string().min(1, "SUPABASE_URL is required"),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z
        .string()
        .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
    SCAN_QUEUE_NAME: zod_1.z.string().default("scan-jobs"),
    WORKER_CONCURRENCY: zod_1.z.coerce.number().int().min(1).max(20).default(2),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("❌ Invalid worker environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.config = parsed.data;
