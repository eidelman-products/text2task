import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Phase 3 -- application-boundary wrapper around the already runtime-
 * verified atomic RPC public.increment_share_rate_limit_bucket
 * (202608130001_client_share_rate_limit_increment.sql). This module is
 * the ONLY place in the application that calls that RPC, and the ONLY
 * place the locked V1 numeric policy is declared -- the RPC itself
 * deliberately knows nothing about limits, only how to atomically count.
 *
 * Never uses an in-memory counter and never performs a SELECT-then-UPDATE
 * against share_rate_limit_buckets: every check below is a single call to
 * the atomic RPC, whose own row-locked `INSERT ... ON CONFLICT ... DO
 * UPDATE` is what makes concurrent callers safe. See
 * docs/TEXT2TASK_CLIENT_SHARE_PHASE3_RATE_LIMIT_FOUNDATION_REPORT.md for
 * the full atomicity rationale, already runtime-verified (23/23 SQL +
 * true-concurrency N=25 PASS).
 */

export type ShareRateLimitAction =
  | "session_exchange"
  | "pin_verification"
  | "projection_read"
  | "invalid_link_access";

export type ShareRateLimitScope = "browser_session" | "network_identity" | "share_link";

/**
 * Locked V1 policy (product decision, not re-decided here). A limit of N
 * means attempt counts 1..N are allowed; count N+1 and above in the same
 * bucket/window are rate-limited. window_seconds must be one of the
 * table's own accepted values (60, 300, 3600, 86400) -- 300 for every V1
 * action.
 */
const RATE_LIMIT_POLICY: Record<
  ShareRateLimitAction,
  { limit: number; windowSeconds: 60 | 300 | 3600 | 86400 }
> = {
  session_exchange: { limit: 10, windowSeconds: 300 },
  pin_verification: { limit: 5, windowSeconds: 300 },
  projection_read: { limit: 120, windowSeconds: 300 },
  invalid_link_access: { limit: 20, windowSeconds: 300 },
};

export type ShareRateLimitCheckInput = Readonly<{
  action: ShareRateLimitAction;
  scope: ShareRateLimitScope;
  identityDigest: string;
  identityDigestVersion: number;
  shareLinkId?: string | null;
}>;

export type ShareRateLimitCheckResult = Readonly<{
  allowed: boolean;
  requestCount: number;
  limit: number;
  windowSeconds: number;
  /** Seconds until the current window's bucket expires, derived from the
   * RPC's own returned expiresAt -- a safe, non-identity-revealing basis
   * for a Retry-After header. Always >= 0. */
  retryAfterSeconds: number;
}>;

export class ShareRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareRateLimitError";
  }
}

type IncrementRpcResponse = {
  requestCount: number;
  windowStart: string;
  windowSeconds: number;
  expiresAt: string;
};

function isIncrementRpcResponse(value: unknown): value is IncrementRpcResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).requestCount === "number" &&
    typeof (value as Record<string, unknown>).windowSeconds === "number" &&
    typeof (value as Record<string, unknown>).expiresAt === "string"
  );
}

/**
 * Consumes exactly one atomic increment of the named bucket and evaluates
 * it against the locked V1 policy for that action. Fails closed
 * (`allowed: false`) on any RPC error or malformed response -- a rate
 * limiter that cannot confirm the current count must never treat that as
 * "unlimited".
 */
export async function checkShareRateLimit(
  input: ShareRateLimitCheckInput
): Promise<ShareRateLimitCheckResult> {
  const policy = RATE_LIMIT_POLICY[input.action];

  const { data, error } = await supabaseAdmin.rpc("increment_share_rate_limit_bucket", {
    p_scope: input.scope,
    p_action: input.action,
    p_identity_digest: input.identityDigest,
    p_identity_digest_version: input.identityDigestVersion,
    p_share_link_id: input.shareLinkId ?? null,
    p_window_seconds: policy.windowSeconds,
  });

  if (error || !isIncrementRpcResponse(data)) {
    // Fail closed: an unreachable/erroring rate limiter must block, not
    // silently allow every request through.
    return {
      allowed: false,
      requestCount: policy.limit + 1,
      limit: policy.limit,
      windowSeconds: policy.windowSeconds,
      retryAfterSeconds: policy.windowSeconds,
    };
  }

  const expiresAtMs = Date.parse(data.expiresAt);
  const retryAfterSeconds = Number.isFinite(expiresAtMs)
    ? Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000))
    : policy.windowSeconds;

  return {
    allowed: data.requestCount <= policy.limit,
    requestCount: data.requestCount,
    limit: policy.limit,
    windowSeconds: policy.windowSeconds,
    retryAfterSeconds,
  };
}
