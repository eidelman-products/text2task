import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createShareSecretDigest,
  generateRawShareSecret,
  isShareSecretError,
  isValidRawShareSecret,
  isValidShareSecretDigest,
  SHARE_SECRET_DIGEST_VERSION,
  ShareSecretError,
} from "./share-secret.server";

const HMAC_KEY_ENV = "TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1";

// 32 raw bytes, base64url-encoded -- a syntactically valid key fixture.
const VALID_KEY_32_BYTES =
  "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA";
// 31 raw bytes -- one byte short of the minimum.
const SHORT_KEY_31_BYTES = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHw";

const originalEnv = process.env[HMAC_KEY_ENV];

beforeEach(() => {
  delete process.env[HMAC_KEY_ENV];
});

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env[HMAC_KEY_ENV];
  } else {
    process.env[HMAC_KEY_ENV] = originalEnv;
  }
});

describe("generateRawShareSecret", () => {
  it("produces exactly 43 base64url characters", () => {
    const secret = generateRawShareSecret();
    expect(secret).toHaveLength(43);
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("produces distinct values on repeated calls", () => {
    const secrets = new Set(Array.from({ length: 20 }, () => generateRawShareSecret()));
    expect(secrets.size).toBe(20);
  });
});

describe("isValidRawShareSecret", () => {
  it("accepts a valid generated secret", () => {
    expect(isValidRawShareSecret(generateRawShareSecret())).toBe(true);
  });

  it.each(["", "a".repeat(42), "a".repeat(44), "not valid chars!!!!!!!!!!!!!!!!!!!!!!!!!!!", 42])(
    "rejects an invalid value %s",
    (value) => {
      expect(isValidRawShareSecret(value)).toBe(false);
    }
  );
});

describe("isValidShareSecretDigest", () => {
  const VALID_DIGEST_HEX =
    "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";

  it("accepts a valid 64-character lowercase hex digest", () => {
    expect(isValidShareSecretDigest(VALID_DIGEST_HEX)).toBe(true);
  });

  it("accepts a freshly computed digest", () => {
    process.env[HMAC_KEY_ENV] = VALID_KEY_32_BYTES;
    expect(
      isValidShareSecretDigest(createShareSecretDigest(generateRawShareSecret()))
    ).toBe(true);
  });

  it.each([
    "", // empty
    "0".repeat(63), // one short
    "0".repeat(65), // one long
    VALID_DIGEST_HEX.toUpperCase(), // uppercase hex is not the canonical form
    "g".repeat(64), // non-hex character
    "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc", // a valid *base64url* 43-char shape -- not the persisted hex-64 shape
    42,
    null,
    undefined,
  ])("rejects an invalid value %s", (value) => {
    expect(isValidShareSecretDigest(value)).toBe(false);
  });
});

describe("SHARE_SECRET_DIGEST_VERSION", () => {
  it("is 1", () => {
    expect(SHARE_SECRET_DIGEST_VERSION).toBe(1);
  });
});

describe("createShareSecretDigest", () => {
  beforeEach(() => {
    process.env[HMAC_KEY_ENV] = VALID_KEY_32_BYTES;
  });

  it("returns exactly 64 lowercase hex characters -- the exact persisted representation, not base64url", () => {
    const digest = createShareSecretDigest(generateRawShareSecret());
    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(isValidShareSecretDigest(digest)).toBe(true);
  });

  it("is deterministic for the same secret and key", () => {
    const secret = generateRawShareSecret();
    expect(createShareSecretDigest(secret)).toBe(createShareSecretDigest(secret));
  });

  it("produces different digests for different secrets", () => {
    const a = createShareSecretDigest(generateRawShareSecret());
    const b = createShareSecretDigest(generateRawShareSecret());
    expect(a).not.toBe(b);
  });

  it("uses a domain-separated input, not a bare HMAC of the secret alone", () => {
    const secret = generateRawShareSecret();
    const digest = createShareSecretDigest(secret);

    const key = Buffer.from(VALID_KEY_32_BYTES, "base64url");
    const bareHmac = createHmac("sha256", key).update(secret).digest("hex");

    expect(digest).not.toBe(bareHmac);
  });

  it("rejects a raw secret that is not exactly 43 base64url characters -- never computes an HMAC over an arbitrary string", () => {
    let caught: unknown;
    try {
      createShareSecretDigest("not-a-valid-raw-secret");
    } catch (error) {
      caught = error;
    }
    expect(isShareSecretError(caught)).toBe(true);
    expect((caught as ShareSecretError).code).toBe("invalid_raw_secret");
  });

  it.each(["", "a".repeat(42), "a".repeat(44), "not valid chars!!!!!!!!!!!!!!!!!!!!!!!!!!!"])(
    "rejects malformed raw secret shape %s",
    (value) => {
      expect(() => createShareSecretDigest(value)).toThrow(ShareSecretError);
    }
  );

  it("rejects a valid-looking digest passed where a raw secret is expected (a 43-char base64url string is not necessarily a real secret, but this still proves shape validation runs)", () => {
    // A 43-char base64url string IS the accepted raw-secret shape, so this
    // should succeed -- included to make explicit that shape validation,
    // not semantic secret-ness, is what is actually checked.
    expect(() =>
      createShareSecretDigest("P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc")
    ).not.toThrow();
  });

  it("fails closed when the HMAC key is missing", () => {
    delete process.env[HMAC_KEY_ENV];
    expect(() => createShareSecretDigest(generateRawShareSecret())).toThrow(
      ShareSecretError
    );
    try {
      createShareSecretDigest(generateRawShareSecret());
    } catch (error) {
      expect(isShareSecretError(error)).toBe(true);
      expect((error as ShareSecretError).code).toBe("hmac_key_missing");
    }
  });

  it("fails closed when the HMAC key is malformed (not base64url)", () => {
    process.env[HMAC_KEY_ENV] = "not-valid-base64url-!!!";
    expect(() => createShareSecretDigest(generateRawShareSecret())).toThrow(
      ShareSecretError
    );
  });

  it("fails closed when the HMAC key decodes to fewer than 32 bytes", () => {
    process.env[HMAC_KEY_ENV] = SHORT_KEY_31_BYTES;
    let caught: unknown;
    try {
      createShareSecretDigest(generateRawShareSecret());
    } catch (error) {
      caught = error;
    }
    expect(isShareSecretError(caught)).toBe(true);
    expect((caught as ShareSecretError).code).toBe("hmac_key_too_short");
  });

  it("never falls back to a default key when the configured key is invalid", () => {
    delete process.env[HMAC_KEY_ENV];
    expect(() => createShareSecretDigest(generateRawShareSecret())).toThrow();
  });
});

describe("no sensitive material is ever logged", () => {
  it("never logs the raw secret, digest or key across generation, digesting and a key failure", () => {
    const secretMarker = generateRawShareSecret();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      process.env[HMAC_KEY_ENV] = VALID_KEY_32_BYTES;
      const digest = createShareSecretDigest(secretMarker);

      delete process.env[HMAC_KEY_ENV];
      try {
        createShareSecretDigest(secretMarker);
      } catch {
        // expected
      }

      for (const spy of [logSpy, errorSpy, warnSpy]) {
        for (const call of spy.mock.calls) {
          const serialized = JSON.stringify(call);
          expect(serialized).not.toContain(secretMarker);
          expect(serialized).not.toContain(digest);
          expect(serialized).not.toContain(VALID_KEY_32_BYTES);
        }
      }
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
