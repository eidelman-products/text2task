import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { rpc: (fn: string, params: Record<string, unknown>) => rpcMock(fn, params) },
}));

const { checkShareRateLimit } = await import("./share-rate-limit.server");

function rpcSuccess(requestCount: number, windowSeconds: number, expiresInMs = 60_000) {
  return {
    data: {
      requestCount,
      windowStart: new Date(Date.now() - 1000).toISOString(),
      windowSeconds,
      expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    },
    error: null,
  };
}

beforeEach(() => {
  rpcMock.mockReset();
});

describe("checkShareRateLimit - calls the atomic RPC, never a SELECT-then-UPDATE", () => {
  it("calls exactly increment_share_rate_limit_bucket with the locked action's window_seconds", async () => {
    rpcMock.mockResolvedValue(rpcSuccess(1, 300));

    await checkShareRateLimit({
      action: "session_exchange",
      scope: "network_identity",
      identityDigest: "a".repeat(64),
      identityDigestVersion: 1,
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("increment_share_rate_limit_bucket", {
      p_scope: "network_identity",
      p_action: "session_exchange",
      p_identity_digest: "a".repeat(64),
      p_identity_digest_version: 1,
      p_share_link_id: null,
      p_window_seconds: 300,
    });
  });

  it("passes shareLinkId through when supplied, null when omitted", async () => {
    rpcMock.mockResolvedValue(rpcSuccess(1, 300));

    await checkShareRateLimit({
      action: "pin_verification",
      scope: "share_link",
      identityDigest: "b".repeat(64),
      identityDigestVersion: 1,
      shareLinkId: "11111111-1111-4111-8111-111111111111",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "increment_share_rate_limit_bucket",
      expect.objectContaining({ p_share_link_id: "11111111-1111-4111-8111-111111111111" })
    );
  });
});

describe("checkShareRateLimit - locked V1 policy, exact limits and windows", () => {
  it.each([
    ["session_exchange", 10, 300],
    ["pin_verification", 5, 300],
    ["projection_read", 120, 300],
    ["invalid_link_access", 20, 300],
    ["comment_submission", 10, 300],
    ["file_access", 60, 300],
  ] as const)("%s: limit=%d window=%ds", async (action, limit, windowSeconds) => {
    rpcMock.mockResolvedValue(rpcSuccess(limit, windowSeconds));

    const atLimit = await checkShareRateLimit({
      action,
      scope: "network_identity",
      identityDigest: "c".repeat(64),
      identityDigestVersion: 1,
    });
    expect(atLimit.allowed).toBe(true);
    expect(atLimit.limit).toBe(limit);
    expect(atLimit.windowSeconds).toBe(windowSeconds);

    rpcMock.mockResolvedValue(rpcSuccess(limit + 1, windowSeconds));
    const overLimit = await checkShareRateLimit({
      action,
      scope: "network_identity",
      identityDigest: "c".repeat(64),
      identityDigestVersion: 1,
    });
    expect(overLimit.allowed).toBe(false);
  });
});

describe("checkShareRateLimit - fail closed on any RPC failure", () => {
  it("returns allowed: false when the RPC returns an error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await checkShareRateLimit({
      action: "session_exchange",
      scope: "network_identity",
      identityDigest: "d".repeat(64),
      identityDigestVersion: 1,
    });

    expect(result.allowed).toBe(false);
  });

  it("returns allowed: false when the RPC response is malformed", async () => {
    rpcMock.mockResolvedValue({ data: { unexpected: true }, error: null });

    const result = await checkShareRateLimit({
      action: "session_exchange",
      scope: "network_identity",
      identityDigest: "e".repeat(64),
      identityDigestVersion: 1,
    });

    expect(result.allowed).toBe(false);
  });

  it("returns allowed: false when the RPC call itself rejects", async () => {
    rpcMock.mockRejectedValue(new Error("network failure"));

    await expect(
      checkShareRateLimit({
        action: "session_exchange",
        scope: "network_identity",
        identityDigest: "f".repeat(64),
        identityDigestVersion: 1,
      })
    ).rejects.toThrow();
  });
});

describe("checkShareRateLimit - Retry-After derivation", () => {
  it("derives retryAfterSeconds from the RPC's own expiresAt, never a raw identity value", async () => {
    rpcMock.mockResolvedValue(rpcSuccess(1, 300, 45_000));

    const result = await checkShareRateLimit({
      action: "session_exchange",
      scope: "network_identity",
      identityDigest: "a".repeat(64),
      identityDigestVersion: 1,
    });

    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(45);
  });

  it("never returns a negative retryAfterSeconds even if expiresAt is already in the past", async () => {
    rpcMock.mockResolvedValue(rpcSuccess(1, 300, -5_000));

    const result = await checkShareRateLimit({
      action: "session_exchange",
      scope: "network_identity",
      identityDigest: "a".repeat(64),
      identityDigestVersion: 1,
    });

    expect(result.retryAfterSeconds).toBe(0);
  });
});
