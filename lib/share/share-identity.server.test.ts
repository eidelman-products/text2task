import { beforeEach, describe, expect, it, vi } from "vitest";

const getTrustedClientIpIdentityMock = vi.fn();

vi.mock("@/lib/homepage-demo/client-ip.server", () => ({
  getHomepageDemoTrustedClientIpIdentity: (headers: unknown) =>
    getTrustedClientIpIdentityMock(headers),
}));

const {
  createShareNetworkIdentityDigest,
  createShareLinkRateLimitIdentityDigest,
  isShareIdentityError,
  SHARE_IDENTITY_DIGEST_VERSION,
} = await import("./share-identity.server");

const ENV_KEY = "TEXT2TASK_SHARE_NETWORK_IDENTITY_HMAC_KEY_V1";
const VALID_KEY = Buffer.alloc(32, 7).toString("base64url");
const HEX_64_PATTERN = /^[0-9a-f]{64}$/;

function fakeHeaders(): Headers {
  return new Headers();
}

beforeEach(() => {
  getTrustedClientIpIdentityMock.mockReset();
  delete process.env[ENV_KEY];
});

describe("createShareNetworkIdentityDigest", () => {
  it("throws identity_configuration_invalid when the HMAC key env var is missing", () => {
    getTrustedClientIpIdentityMock.mockReturnValue({
      family: "ipv4",
      normalizedIdentity: "ipv4:203.0.113.5",
    });

    expect(() => createShareNetworkIdentityDigest(fakeHeaders())).toThrowError();
    try {
      createShareNetworkIdentityDigest(fakeHeaders());
    } catch (error) {
      expect(isShareIdentityError(error)).toBe(true);
      if (isShareIdentityError(error)) {
        expect(error.code).toBe("identity_configuration_invalid");
      }
    }
  });

  it("throws identity_configuration_invalid when the key is too short", () => {
    process.env[ENV_KEY] = Buffer.alloc(16, 1).toString("base64url");
    getTrustedClientIpIdentityMock.mockReturnValue({
      family: "ipv4",
      normalizedIdentity: "ipv4:203.0.113.5",
    });

    expect(() => createShareNetworkIdentityDigest(fakeHeaders())).toThrowError();
  });

  it("returns a bare lowercase 64-hex digest with version 1, never a 'v1:' prefixed string", () => {
    process.env[ENV_KEY] = VALID_KEY;
    getTrustedClientIpIdentityMock.mockReturnValue({
      family: "ipv4",
      normalizedIdentity: "ipv4:203.0.113.5",
    });

    const result = createShareNetworkIdentityDigest(fakeHeaders());

    expect(HEX_64_PATTERN.test(result.digest)).toBe(true);
    expect(result.digest.startsWith("v1:")).toBe(false);
    expect(result.version).toBe(SHARE_IDENTITY_DIGEST_VERSION);
    expect(result.version).toBe(1);
  });

  it("is deterministic for the identical normalized identity", () => {
    process.env[ENV_KEY] = VALID_KEY;
    getTrustedClientIpIdentityMock.mockReturnValue({
      family: "ipv4",
      normalizedIdentity: "ipv4:203.0.113.5",
    });

    const first = createShareNetworkIdentityDigest(fakeHeaders());
    const second = createShareNetworkIdentityDigest(fakeHeaders());

    expect(first.digest).toBe(second.digest);
  });

  it("produces a different digest for a different normalized identity", () => {
    process.env[ENV_KEY] = VALID_KEY;

    getTrustedClientIpIdentityMock.mockReturnValue({
      family: "ipv4",
      normalizedIdentity: "ipv4:203.0.113.5",
    });
    const first = createShareNetworkIdentityDigest(fakeHeaders());

    getTrustedClientIpIdentityMock.mockReturnValue({
      family: "ipv4",
      normalizedIdentity: "ipv4:198.51.100.7",
    });
    const second = createShareNetworkIdentityDigest(fakeHeaders());

    expect(first.digest).not.toBe(second.digest);
  });

  it("throws identity_unavailable (fails closed) when the trusted IP cannot be determined, never falling back to an 'unlimited' state", () => {
    process.env[ENV_KEY] = VALID_KEY;
    getTrustedClientIpIdentityMock.mockImplementation(() => {
      throw new Error("no trusted IP");
    });

    expect(() => createShareNetworkIdentityDigest(fakeHeaders())).toThrowError();
    try {
      createShareNetworkIdentityDigest(fakeHeaders());
    } catch (error) {
      expect(isShareIdentityError(error)).toBe(true);
      if (isShareIdentityError(error)) {
        expect(error.code).toBe("identity_unavailable");
      }
    }
  });
});

describe("createShareLinkRateLimitIdentityDigest", () => {
  const LINK_ID_A = "11111111-1111-4111-8111-111111111111";
  const LINK_ID_B = "22222222-2222-4222-8222-222222222222";

  it("returns a bare lowercase 64-hex digest with version 1, requiring no environment configuration", () => {
    const result = createShareLinkRateLimitIdentityDigest(LINK_ID_A);

    expect(HEX_64_PATTERN.test(result.digest)).toBe(true);
    expect(result.version).toBe(1);
  });

  it("is deterministic for the identical link id", () => {
    expect(createShareLinkRateLimitIdentityDigest(LINK_ID_A).digest).toBe(
      createShareLinkRateLimitIdentityDigest(LINK_ID_A).digest
    );
  });

  it("produces a distinct digest for a distinct link id", () => {
    expect(createShareLinkRateLimitIdentityDigest(LINK_ID_A).digest).not.toBe(
      createShareLinkRateLimitIdentityDigest(LINK_ID_B).digest
    );
  });
});
