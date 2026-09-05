import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

const { prepareHomepageDemoClaimAuthContinuation } = await import(
  "./claim-repository.server"
);

const CLAIM_TOKEN_HASH = "a".repeat(64);
const EXISTING_CONTINUATION_TOKEN_HASH = "b".repeat(64);
const CANDIDATE_CONTINUATION_TOKEN_HASH = "c".repeat(64);

beforeEach(() => {
  rpcMock.mockReset();
});

describe("prepareHomepageDemoClaimAuthContinuation", () => {
  it("delegates to the service-role RPC with the server-controlled TTL", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          outcome: "continuation_prepared",
          set_cookie: true,
          expires_at: expiresAt.toISOString(),
        },
      ],
      error: null,
    });

    const result = await prepareHomepageDemoClaimAuthContinuation({
      claimTokenHash: CLAIM_TOKEN_HASH,
      existingContinuationTokenHash: null,
      candidateContinuationTokenHash: CANDIDATE_CONTINUATION_TOKEN_HASH,
      continuationTtlSeconds: 3600,
    });

    expect(result).toEqual({
      outcome: "continuation_prepared",
      setCookie: true,
      expiresAt,
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "prepare_homepage_demo_claim_auth_continuation",
      {
        p_claim_token_hash: CLAIM_TOKEN_HASH,
        p_existing_continuation_token_hash: null,
        p_candidate_continuation_token_hash:
          CANDIDATE_CONTINUATION_TOKEN_HASH,
        p_continuation_ttl_seconds: 3600,
      }
    );
  });

  it("maps continuation_reused without setting a replacement cookie", async () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          outcome: "continuation_reused",
          set_cookie: false,
          expires_at: expiresAt.toISOString(),
        },
      ],
      error: null,
    });

    const result = await prepareHomepageDemoClaimAuthContinuation({
      claimTokenHash: CLAIM_TOKEN_HASH,
      existingContinuationTokenHash: EXISTING_CONTINUATION_TOKEN_HASH,
      candidateContinuationTokenHash: CANDIDATE_CONTINUATION_TOKEN_HASH,
      continuationTtlSeconds: 3600,
    });

    expect(result).toEqual({
      outcome: "continuation_reused",
      setCookie: false,
      expiresAt,
    });
  });

  it("rejects client-shaped invalid TTL input before the RPC", async () => {
    await expect(
      prepareHomepageDemoClaimAuthContinuation({
        claimTokenHash: CLAIM_TOKEN_HASH,
        existingContinuationTokenHash: null,
        candidateContinuationTokenHash: CANDIDATE_CONTINUATION_TOKEN_HASH,
        continuationTtlSeconds: 0,
      })
    ).rejects.toMatchObject({ code: "invalid_repository_input" });

    expect(rpcMock).not.toHaveBeenCalled();
  });
});
