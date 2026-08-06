import { createCipheriv } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptShareSecret,
  encryptShareSecret,
  isShareSecretEncryptionError,
  SHARE_SECRET_ENCRYPTION_VERSION,
  ShareSecretEncryptionError,
} from "./share-secret-encryption.server";

const ENCRYPTION_KEY_ENV = "TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1";

// 32 raw bytes, base64url-encoded -- a syntactically valid key fixture.
const VALID_KEY_32_BYTES = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA";
// 31 / 33 raw bytes -- one byte short of / over the required exact length.
const KEY_31_BYTES = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHw";
const KEY_33_BYTES = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAh";

const LINK_ID_A = "11111111-1111-4111-8111-111111111111";
const LINK_ID_B = "22222222-2222-4222-8222-222222222222";
const PLAINTEXT = "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc"; // 43 chars

const originalEnv = process.env[ENCRYPTION_KEY_ENV];

beforeEach(() => {
  process.env[ENCRYPTION_KEY_ENV] = VALID_KEY_32_BYTES;
});

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env[ENCRYPTION_KEY_ENV];
  } else {
    process.env[ENCRYPTION_KEY_ENV] = originalEnv;
  }
});

describe("SHARE_SECRET_ENCRYPTION_VERSION", () => {
  it("is 1", () => {
    expect(SHARE_SECRET_ENCRYPTION_VERSION).toBe(1);
  });
});

describe("encryptShareSecret", () => {
  it("produces a 12-byte nonce, a 16-byte auth tag and an exactly 43-byte ciphertext (AES-GCM adds no padding)", () => {
    const material = encryptShareSecret(PLAINTEXT, LINK_ID_A);
    expect(material.nonce).toHaveLength(12);
    expect(material.authTag).toHaveLength(16);
    expect(material.ciphertext).toHaveLength(43);
    expect(material.encryptionVersion).toBe(1);
  });

  it("uses a fresh random nonce (and therefore different ciphertext) on every call", () => {
    const first = encryptShareSecret(PLAINTEXT, LINK_ID_A);
    const second = encryptShareSecret(PLAINTEXT, LINK_ID_A);
    expect(first.nonce.equals(second.nonce)).toBe(false);
    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
  });

  it.each(["", "a".repeat(42), "a".repeat(44), "not valid chars!!!!!!!!!!!!!!!!!!!!!!!!!!!"])(
    "rejects invalid plaintext shape %s before ever encrypting anything",
    (plaintext) => {
      let caught: unknown;
      try {
        encryptShareSecret(plaintext, LINK_ID_A);
      } catch (error) {
        caught = error;
      }
      expect(isShareSecretEncryptionError(caught)).toBe(true);
      expect((caught as ShareSecretEncryptionError).code).toBe("invalid_plaintext");
    }
  );

  it("rejects a malformed shareLinkId", () => {
    let caught: unknown;
    try {
      encryptShareSecret(PLAINTEXT, "not-a-uuid");
    } catch (error) {
      caught = error;
    }
    expect(isShareSecretEncryptionError(caught)).toBe(true);
    expect((caught as ShareSecretEncryptionError).code).toBe(
      "invalid_share_link_id"
    );
  });

  it("fails closed when the encryption key is missing", () => {
    delete process.env[ENCRYPTION_KEY_ENV];
    expect(() => encryptShareSecret(PLAINTEXT, LINK_ID_A)).toThrow(
      ShareSecretEncryptionError
    );
  });

  it("fails closed when the encryption key is malformed (not base64url)", () => {
    process.env[ENCRYPTION_KEY_ENV] = "not-valid-base64url-!!!";
    let caught: unknown;
    try {
      encryptShareSecret(PLAINTEXT, LINK_ID_A);
    } catch (error) {
      caught = error;
    }
    expect(isShareSecretEncryptionError(caught)).toBe(true);
    expect((caught as ShareSecretEncryptionError).code).toBe(
      "encryption_key_malformed"
    );
  });

  it.each([
    ["31 bytes", KEY_31_BYTES],
    ["33 bytes", KEY_33_BYTES],
  ])("fails closed when the encryption key decodes to the wrong length (%s)", (_label, key) => {
    process.env[ENCRYPTION_KEY_ENV] = key;
    let caught: unknown;
    try {
      encryptShareSecret(PLAINTEXT, LINK_ID_A);
    } catch (error) {
      caught = error;
    }
    expect(isShareSecretEncryptionError(caught)).toBe(true);
    expect((caught as ShareSecretEncryptionError).code).toBe(
      "encryption_key_wrong_length"
    );
  });
});

describe("decryptShareSecret - round trip", () => {
  it("recovers the original plaintext", () => {
    const material = encryptShareSecret(PLAINTEXT, LINK_ID_A);
    const decrypted = decryptShareSecret({
      ...material,
      shareLinkId: LINK_ID_A,
    });
    expect(decrypted).toBe(PLAINTEXT);
  });

  it("recovers the plaintext when shareLinkId AAD is supplied in a different letter case (canonicalized to lowercase, and still round-trips)", () => {
    const material = encryptShareSecret(PLAINTEXT, LINK_ID_A);
    const decrypted = decryptShareSecret({
      ...material,
      shareLinkId: LINK_ID_A.toUpperCase(),
    });
    expect(decrypted).toBe(PLAINTEXT);
  });
});

describe("decryptShareSecret - input validation before any decryption is attempted", () => {
  function validInput() {
    const material = encryptShareSecret(PLAINTEXT, LINK_ID_A);
    return { ...material, shareLinkId: LINK_ID_A };
  }

  it("rejects a malformed shareLinkId", () => {
    const input = validInput();
    let caught: unknown;
    try {
      decryptShareSecret({ ...input, shareLinkId: "not-a-uuid" });
    } catch (error) {
      caught = error;
    }
    expect(isShareSecretEncryptionError(caught)).toBe(true);
    expect((caught as ShareSecretEncryptionError).code).toBe(
      "invalid_share_link_id"
    );
  });

  it.each([42, 44])(
    "rejects a ciphertext that is not exactly 43 bytes (got %d)",
    (length) => {
      const input = validInput();
      let caught: unknown;
      try {
        decryptShareSecret({ ...input, ciphertext: Buffer.alloc(length, 1) });
      } catch (error) {
        caught = error;
      }
      expect(isShareSecretEncryptionError(caught)).toBe(true);
      expect((caught as ShareSecretEncryptionError).code).toBe(
        "invalid_ciphertext_length"
      );
    }
  );

  it.each([11, 13])(
    "rejects a nonce that is not exactly 12 bytes (got %d)",
    (length) => {
      const input = validInput();
      let caught: unknown;
      try {
        decryptShareSecret({ ...input, nonce: Buffer.alloc(length, 1) });
      } catch (error) {
        caught = error;
      }
      expect(isShareSecretEncryptionError(caught)).toBe(true);
      expect((caught as ShareSecretEncryptionError).code).toBe(
        "invalid_nonce_length"
      );
    }
  );

  it.each([15, 17])(
    "rejects an auth tag that is not exactly 16 bytes (got %d)",
    (length) => {
      const input = validInput();
      let caught: unknown;
      try {
        decryptShareSecret({ ...input, authTag: Buffer.alloc(length, 1) });
      } catch (error) {
        caught = error;
      }
      expect(isShareSecretEncryptionError(caught)).toBe(true);
      expect((caught as ShareSecretEncryptionError).code).toBe(
        "invalid_auth_tag_length"
      );
    }
  );

  it("rejects an unrecognized encryptionVersion before validating lengths or attempting decryption", () => {
    const input = validInput();
    let caught: unknown;
    try {
      decryptShareSecret({ ...input, encryptionVersion: 2 });
    } catch (error) {
      caught = error;
    }
    expect(isShareSecretEncryptionError(caught)).toBe(true);
    expect((caught as ShareSecretEncryptionError).code).toBe(
      "unknown_encryption_version"
    );
  });
});

describe("decryptShareSecret - a successfully authenticated but non-secret-shaped plaintext still fails closed", () => {
  it("rejects an authentic 43-byte ciphertext whose decrypted plaintext is not a valid base64url secret shape", () => {
    // Built directly with node:crypto, bypassing encryptShareSecret's own
    // plaintext validation entirely, to prove decryptShareSecret does not
    // simply trust "GCM authentication passed" as proof of a valid
    // secret shape. The plaintext below is exactly 43 bytes (so it is not
    // rejected by the ciphertext-length pre-check) but uses characters
    // outside the base64url alphabet.
    const notASecretShape = "!".repeat(43);
    const key = Buffer.from(VALID_KEY_32_BYTES, "base64url");
    const nonce = Buffer.alloc(12, 9);
    const cipher = createCipheriv("aes-256-gcm", key, nonce, {
      authTagLength: 16,
    });
    cipher.setAAD(Buffer.from(LINK_ID_A, "utf8"));
    const ciphertext = Buffer.concat([
      cipher.update(notASecretShape, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    expect(ciphertext).toHaveLength(43);

    let caught: unknown;
    try {
      decryptShareSecret({
        ciphertext,
        nonce,
        authTag,
        encryptionVersion: 1,
        shareLinkId: LINK_ID_A,
      });
    } catch (error) {
      caught = error;
    }
    expect(isShareSecretEncryptionError(caught)).toBe(true);
    expect((caught as ShareSecretEncryptionError).code).toBe(
      "invalid_decrypted_plaintext"
    );
  });
});

describe("decryptShareSecret - tamper and mismatch detection", () => {
  function validInput() {
    const material = encryptShareSecret(PLAINTEXT, LINK_ID_A);
    return { ...material, shareLinkId: LINK_ID_A };
  }

  it("fails when the ciphertext is modified", () => {
    const input = validInput();
    const tampered = Buffer.from(input.ciphertext);
    tampered[0] = tampered[0] ^ 0xff;
    expect(() =>
      decryptShareSecret({ ...input, ciphertext: tampered })
    ).toThrow(ShareSecretEncryptionError);
  });

  it("fails when the auth tag is modified", () => {
    const input = validInput();
    const tampered = Buffer.from(input.authTag);
    tampered[0] = tampered[0] ^ 0xff;
    expect(() => decryptShareSecret({ ...input, authTag: tampered })).toThrow(
      ShareSecretEncryptionError
    );
  });

  it("fails when the nonce is modified", () => {
    const input = validInput();
    const tampered = Buffer.from(input.nonce);
    tampered[0] = tampered[0] ^ 0xff;
    expect(() => decryptShareSecret({ ...input, nonce: tampered })).toThrow(
      ShareSecretEncryptionError
    );
  });

  it("fails when the wrong share_link_id AAD is supplied", () => {
    const input = validInput();
    expect(() =>
      decryptShareSecret({ ...input, shareLinkId: LINK_ID_B })
    ).toThrow(ShareSecretEncryptionError);
  });

  it("fails when the wrong key is supplied", () => {
    const input = validInput();
    const differentKey = Buffer.alloc(32, 7).toString("base64url");
    process.env[ENCRYPTION_KEY_ENV] = differentKey;
    expect(() => decryptShareSecret(input)).toThrow(ShareSecretEncryptionError);
  });

  it("fails closed with unknown_encryption_version for an unrecognized version", () => {
    const input = validInput();
    let caught: unknown;
    try {
      decryptShareSecret({ ...input, encryptionVersion: 2 });
    } catch (error) {
      caught = error;
    }
    expect(isShareSecretEncryptionError(caught)).toBe(true);
    expect((caught as ShareSecretEncryptionError).code).toBe(
      "unknown_encryption_version"
    );
  });

  it("fails closed when the decryption-time key is missing", () => {
    const input = validInput();
    delete process.env[ENCRYPTION_KEY_ENV];
    expect(() => decryptShareSecret(input)).toThrow(ShareSecretEncryptionError);
  });
});

describe("no sensitive material is ever logged", () => {
  it("never logs plaintext, key, ciphertext, nonce or auth tag across encrypt, decrypt and a tamper failure", () => {
    const marker = "SENSITIVE_PLAINTEXT_MARKER_4e21ab9012345678901234567890ab";
    const secretMarker = marker.slice(0, 43);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const material = encryptShareSecret(secretMarker, LINK_ID_A);
      decryptShareSecret({ ...material, shareLinkId: LINK_ID_A });

      const tampered = Buffer.from(material.ciphertext);
      tampered[0] = tampered[0] ^ 0xff;
      try {
        decryptShareSecret({
          ...material,
          ciphertext: tampered,
          shareLinkId: LINK_ID_A,
        });
      } catch {
        // expected
      }

      for (const spy of [logSpy, errorSpy, warnSpy]) {
        for (const call of spy.mock.calls) {
          const serialized = JSON.stringify(call);
          expect(serialized).not.toContain(secretMarker);
          expect(serialized).not.toContain(VALID_KEY_32_BYTES);
          expect(serialized).not.toContain(material.ciphertext.toString("hex"));
          expect(serialized).not.toContain(material.nonce.toString("hex"));
          expect(serialized).not.toContain(material.authTag.toString("hex"));
        }
      }
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
