import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateShareBrowserSessionSecret,
  getShareBrowserSessionCookieClearPolicy,
  getShareBrowserSessionCookiePolicy,
  hashShareBrowserSessionSecret,
  isShareBrowserSessionError,
  isValidRawShareBrowserSessionSecret,
  isValidShareBrowserSessionDigest,
  SHARE_BROWSER_SESSION_COOKIE_PATH,
  SHARE_BROWSER_SESSION_TTL_SECONDS,
} from "./share-browser-session.server";

const ENV_KEY = "TEXT2TASK_SHARE_SESSION_HMAC_KEY_V1";
const VALID_KEY = Buffer.alloc(32, 9).toString("base64url");
const HEX_64_PATTERN = /^[0-9a-f]{64}$/;

beforeEach(() => {
  delete process.env[ENV_KEY];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SHARE_BROWSER_SESSION_TTL_SECONDS", () => {
  it("is exactly 7 days, the locked V1 product decision", () => {
    expect(SHARE_BROWSER_SESSION_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
    expect(SHARE_BROWSER_SESSION_TTL_SECONDS).toBe(604800);
  });
});

describe("generateShareBrowserSessionSecret", () => {
  it("returns exactly 43 base64url characters", () => {
    const secret = generateShareBrowserSessionSecret();
    expect(secret).toHaveLength(43);
    expect(/^[A-Za-z0-9_-]{43}$/.test(secret)).toBe(true);
  });

  it("is different on every call (fresh randomness, not a fixed value)", () => {
    const a = generateShareBrowserSessionSecret();
    const b = generateShareBrowserSessionSecret();
    expect(a).not.toBe(b);
  });
});

describe("isValidRawShareBrowserSessionSecret", () => {
  it("accepts a genuinely generated secret", () => {
    expect(isValidRawShareBrowserSessionSecret(generateShareBrowserSessionSecret())).toBe(true);
  });

  it("rejects wrong length, wrong characters, and non-string values", () => {
    expect(isValidRawShareBrowserSessionSecret("too-short")).toBe(false);
    expect(isValidRawShareBrowserSessionSecret("a".repeat(43) + "!")).toBe(false);
    expect(isValidRawShareBrowserSessionSecret(12345)).toBe(false);
    expect(isValidRawShareBrowserSessionSecret(null)).toBe(false);
    expect(isValidRawShareBrowserSessionSecret(undefined)).toBe(false);
  });
});

describe("isValidShareBrowserSessionDigest", () => {
  it("accepts exactly 64 lowercase hex characters", () => {
    expect(isValidShareBrowserSessionDigest("a".repeat(64))).toBe(true);
  });

  it("rejects uppercase, wrong length, and non-hex characters", () => {
    expect(isValidShareBrowserSessionDigest("A".repeat(64))).toBe(false);
    expect(isValidShareBrowserSessionDigest("a".repeat(63))).toBe(false);
    expect(isValidShareBrowserSessionDigest("g".repeat(64))).toBe(false);
    expect(isValidShareBrowserSessionDigest(123)).toBe(false);
  });
});

describe("hashShareBrowserSessionSecret", () => {
  it("throws (fails closed) when the HMAC key is missing", () => {
    const secret = generateShareBrowserSessionSecret();
    expect(() => hashShareBrowserSessionSecret(secret)).toThrowError();
    try {
      hashShareBrowserSessionSecret(secret);
    } catch (error) {
      expect(isShareBrowserSessionError(error)).toBe(true);
      if (isShareBrowserSessionError(error)) {
        expect(error.code).toBe("hmac_key_missing");
      }
    }
  });

  it("throws hmac_key_too_short for a key shorter than 32 bytes", () => {
    process.env[ENV_KEY] = Buffer.alloc(16, 1).toString("base64url");
    const secret = generateShareBrowserSessionSecret();

    try {
      hashShareBrowserSessionSecret(secret);
      throw new Error("expected hashShareBrowserSessionSecret to throw");
    } catch (error) {
      expect(isShareBrowserSessionError(error)).toBe(true);
      if (isShareBrowserSessionError(error)) {
        expect(error.code).toBe("hmac_key_too_short");
      }
    }
  });

  it("throws invalid_raw_session_secret for a malformed raw secret, never hashing it", () => {
    process.env[ENV_KEY] = VALID_KEY;

    try {
      hashShareBrowserSessionSecret("not-a-valid-secret");
      throw new Error("expected hashShareBrowserSessionSecret to throw");
    } catch (error) {
      expect(isShareBrowserSessionError(error)).toBe(true);
      if (isShareBrowserSessionError(error)) {
        expect(error.code).toBe("invalid_raw_session_secret");
      }
    }
  });

  it("returns a valid lowercase 64-hex digest, matching share_browser_sessions_session_digest_format_check", () => {
    process.env[ENV_KEY] = VALID_KEY;
    const digest = hashShareBrowserSessionSecret(generateShareBrowserSessionSecret());

    expect(HEX_64_PATTERN.test(digest)).toBe(true);
  });

  it("is deterministic for the identical raw secret", () => {
    process.env[ENV_KEY] = VALID_KEY;
    const secret = generateShareBrowserSessionSecret();

    expect(hashShareBrowserSessionSecret(secret)).toBe(hashShareBrowserSessionSecret(secret));
  });

  it("produces a different digest for a different raw secret", () => {
    process.env[ENV_KEY] = VALID_KEY;

    const digestA = hashShareBrowserSessionSecret(generateShareBrowserSessionSecret());
    const digestB = hashShareBrowserSessionSecret(generateShareBrowserSessionSecret());

    expect(digestA).not.toBe(digestB);
  });
});

describe("cookie policy", () => {
  it("uses the narrowest path covering both public Client Share API routes, not the whole site", () => {
    expect(SHARE_BROWSER_SESSION_COOKIE_PATH).toBe("/api/share");
    expect(getShareBrowserSessionCookiePolicy().path).toBe("/api/share");
  });

  it("is HttpOnly, SameSite=Lax, 7-day maxAge, and carries no Domain field", () => {
    const policy = getShareBrowserSessionCookiePolicy();

    expect(policy.httpOnly).toBe(true);
    expect(policy.sameSite).toBe("lax");
    expect(policy.maxAge).toBe(SHARE_BROWSER_SESSION_TTL_SECONDS);
    expect(Object.prototype.hasOwnProperty.call(policy, "domain")).toBe(false);
  });

  it("is Secure in production and not Secure outside production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getShareBrowserSessionCookiePolicy().secure).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    expect(getShareBrowserSessionCookiePolicy().secure).toBe(false);
  });

  it("the clear policy matches the set policy except maxAge: 0", () => {
    const setPolicy = getShareBrowserSessionCookiePolicy();
    const clearPolicy = getShareBrowserSessionCookieClearPolicy();

    expect(clearPolicy.name).toBe(setPolicy.name);
    expect(clearPolicy.path).toBe(setPolicy.path);
    expect(clearPolicy.httpOnly).toBe(setPolicy.httpOnly);
    expect(clearPolicy.sameSite).toBe(setPolicy.sameSite);
    expect(clearPolicy.maxAge).toBe(0);
  });
});
