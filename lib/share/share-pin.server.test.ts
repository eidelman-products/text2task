import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  hashSharePin,
  isSharePinError,
  isValidSharePin,
  SHARE_PIN_HASH_VERSION,
  SharePinError,
  verifySharePin,
  type StoredSharePinMaterial,
} from "./share-pin.server";

describe("isValidSharePin", () => {
  it.each(["1234", "12345", "123456"])("accepts exactly %s (4-6 digits)", (pin) => {
    expect(isValidSharePin(pin)).toBe(true);
  });

  it.each([
    "123", // too short
    "1234567", // too long
    "", // empty
    " 1234", // leading whitespace
    "1234 ", // trailing whitespace
    "12 34", // internal whitespace
    "12a4", // non-digit
    "１２３４", // Unicode fullwidth digits
    "٤٥٦٧", // Unicode Arabic-indic digits
    1234, // number, not a string
    1234567890,
    null,
    undefined,
  ])("rejects invalid value %s", (value) => {
    expect(isValidSharePin(value)).toBe(false);
  });
});

describe("SHARE_PIN_HASH_VERSION", () => {
  it("is 1", () => {
    expect(SHARE_PIN_HASH_VERSION).toBe(1);
  });
});

describe("hashSharePin", () => {
  it("returns the exact V1 profile alongside a 22-char salt and a 43-char hash", async () => {
    const result = await hashSharePin("1234");

    expect(result.pinSalt).toHaveLength(22);
    expect(result.pinSalt).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(result.pinHash).toHaveLength(43);
    expect(result.pinHash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.pinHashVersion).toBe(1);
    expect(result.pinScryptN).toBe(16384);
    expect(result.pinScryptR).toBe(8);
    expect(result.pinScryptP).toBe(1);
    expect(result.pinKeyLength).toBe(32);
  });

  it("returns only the seven expected fields -- never the plaintext PIN", async () => {
    const result = await hashSharePin("1234");
    expect(Object.keys(result).sort()).toEqual(
      [
        "pinHash",
        "pinSalt",
        "pinHashVersion",
        "pinScryptN",
        "pinScryptR",
        "pinScryptP",
        "pinKeyLength",
      ].sort()
    );
  });

  it("uses a fresh salt (and therefore a different hash representation) on every call, even for the same PIN", async () => {
    const first = await hashSharePin("123456");
    const second = await hashSharePin("123456");
    expect(first.pinSalt).not.toBe(second.pinSalt);
    expect(first.pinHash).not.toBe(second.pinHash);
  });

  it.each(["123", "1234567", "12a4", "", " 1234"])(
    "rejects an invalid PIN %s before ever calling scrypt",
    async (pin) => {
      let caught: unknown;
      try {
        await hashSharePin(pin);
      } catch (error) {
        caught = error;
      }
      expect(isSharePinError(caught)).toBe(true);
      expect((caught as SharePinError).code).toBe("invalid_pin");
    }
  );

  it("rejects a numeric PIN (no coercion from a number)", async () => {
    let caught: unknown;
    try {
      // @ts-expect-error -- intentionally passing a number to prove no coercion
      await hashSharePin(1234);
    } catch (error) {
      caught = error;
    }
    expect(isSharePinError(caught)).toBe(true);
    expect((caught as SharePinError).code).toBe("invalid_pin");
  });
});

describe("verifySharePin", () => {
  it("succeeds for the correct PIN", async () => {
    const hashed = await hashSharePin("4321");
    const material: StoredSharePinMaterial = hashed;
    await expect(verifySharePin("4321", material)).resolves.toBe(true);
  });

  it("fails for an incorrect PIN of the same length", async () => {
    const hashed = await hashSharePin("4321");
    await expect(verifySharePin("4322", hashed)).resolves.toBe(false);
  });

  it("fails for an incorrect PIN of a different valid length", async () => {
    const hashed = await hashSharePin("4321");
    await expect(verifySharePin("432199", hashed)).resolves.toBe(false);
  });

  it("rejects an invalid candidate PIN shape before deriving anything", async () => {
    const hashed = await hashSharePin("4321");
    let caught: unknown;
    try {
      await verifySharePin("12", hashed);
    } catch (error) {
      caught = error;
    }
    expect(isSharePinError(caught)).toBe(true);
    expect((caught as SharePinError).code).toBe("invalid_pin");
  });

  it.each([
    ["short hash", { pinHash: "abc", pinSalt: "a".repeat(22) }],
    ["long hash", { pinHash: "a".repeat(44), pinSalt: "a".repeat(22) }],
    ["non-base64url hash", { pinHash: "!".repeat(43), pinSalt: "a".repeat(22) }],
    ["short salt", { pinHash: "a".repeat(43), pinSalt: "abc" }],
    ["long salt", { pinHash: "a".repeat(43), pinSalt: "a".repeat(23) }],
    ["non-base64url salt", { pinHash: "a".repeat(43), pinSalt: "!".repeat(22) }],
  ])("fails closed on malformed stored material (%s)", async (_label, overrides) => {
    const material: StoredSharePinMaterial = {
      pinHashVersion: 1,
      pinScryptN: 16384,
      pinScryptR: 8,
      pinScryptP: 1,
      pinKeyLength: 32,
      ...overrides,
    };
    let caught: unknown;
    try {
      await verifySharePin("4321", material);
    } catch (error) {
      caught = error;
    }
    expect(isSharePinError(caught)).toBe(true);
    expect((caught as SharePinError).code).toBe("invalid_stored_material");
  });

  it.each([
    ["pinHashVersion", { pinHashVersion: 2 }],
    ["pinScryptN", { pinScryptN: 8192 }],
    ["pinScryptR", { pinScryptR: 4 }],
    ["pinScryptP", { pinScryptP: 2 }],
    ["pinKeyLength", { pinKeyLength: 16 }],
  ])("fails closed on an unsupported profile (%s)", async (_label, overrides) => {
    const hashed = await hashSharePin("4321");
    const material: StoredSharePinMaterial = { ...hashed, ...overrides };
    let caught: unknown;
    try {
      await verifySharePin("4321", material);
    } catch (error) {
      caught = error;
    }
    expect(isSharePinError(caught)).toBe(true);
    expect((caught as SharePinError).code).toBe("unsupported_profile");
  });

  // `material` is untrusted runtime input at this security boundary --
  // not only a compile-time-typed StoredSharePinMaterial object -- so
  // every case below intentionally bypasses the compile-time type to
  // prove the function fails closed against arbitrary runtime shapes
  // (e.g. a JSON.parse result or a loosely-typed database row).
  function validRuntimeMaterial(
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      // Both "A".repeat(N) strings are the canonical base64url encoding
      // of an all-zero byte sequence of the expected length, so they
      // pass the canonical round-trip check on their own -- letting
      // each test below corrupt exactly one other field in isolation.
      pinHash: "A".repeat(43),
      pinSalt: "A".repeat(22),
      pinHashVersion: 1,
      pinScryptN: 16384,
      pinScryptR: 8,
      pinScryptP: 1,
      pinKeyLength: 32,
      ...overrides,
    };
  }

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an array", []],
    ["a string", "not-an-object"],
    ["a number", 42],
    ["a boolean", true],
  ])("fails closed with invalid_stored_material when material is %s", async (_label, material) => {
    let caught: unknown;
    try {
      await verifySharePin("4321", material);
    } catch (error) {
      caught = error;
    }
    expect(isSharePinError(caught)).toBe(true);
    expect((caught as SharePinError).code).toBe("invalid_stored_material");
  });

  it("fails closed with invalid_stored_material when a required field is missing", async () => {
    const { pinKeyLength: _omitted, ...incomplete } = validRuntimeMaterial();
    let caught: unknown;
    try {
      await verifySharePin("4321", incomplete);
    } catch (error) {
      caught = error;
    }
    expect(isSharePinError(caught)).toBe(true);
    expect((caught as SharePinError).code).toBe("invalid_stored_material");
  });

  it.each([
    ["pinHash", 12345],
    ["pinSalt", 12345],
    ["pinHashVersion", "1"],
    ["pinScryptN", "16384"],
    ["pinScryptR", "8"],
    ["pinScryptP", "1"],
    ["pinKeyLength", "32"],
  ])("fails closed with invalid_stored_material when %s has the wrong primitive type", async (field, badValue) => {
    const material = validRuntimeMaterial({ [field as string]: badValue });
    let caught: unknown;
    try {
      await verifySharePin("4321", material);
    } catch (error) {
      caught = error;
    }
    expect(isSharePinError(caught)).toBe(true);
    expect((caught as SharePinError).code).toBe("invalid_stored_material");
  });

  it("fails closed with invalid_stored_material on a non-canonical 22-character base64url salt whose decoded bytes re-encode differently", async () => {
    // The last character encodes 4 canonical-zero padding bits alongside
    // 2 data bits; "B" sets one of those padding bits, decoding to the
    // exact same 16 zero bytes but failing the round-trip re-encode
    // check (re-encoding those bytes always yields "A", not "B").
    const material = validRuntimeMaterial({ pinSalt: "A".repeat(21) + "B" });
    let caught: unknown;
    try {
      await verifySharePin("4321", material);
    } catch (error) {
      caught = error;
    }
    expect(isSharePinError(caught)).toBe(true);
    expect((caught as SharePinError).code).toBe("invalid_stored_material");
  });

  it("fails closed with invalid_stored_material on a non-canonical 43-character base64url hash whose decoded bytes re-encode differently", async () => {
    const material = validRuntimeMaterial({ pinHash: "A".repeat(42) + "B" });
    let caught: unknown;
    try {
      await verifySharePin("4321", material);
    } catch (error) {
      caught = error;
    }
    expect(isSharePinError(caught)).toBe(true);
    expect((caught as SharePinError).code).toBe("invalid_stored_material");
  });

  it("continues verifying correctly formed V1 material, and an incorrect PIN still returns false", async () => {
    const hashed = await hashSharePin("4321");
    await expect(verifySharePin("4321", hashed)).resolves.toBe(true);
    await expect(verifySharePin("9999", hashed)).resolves.toBe(false);
  });
}, 20000);

describe("source constraints", () => {
  const source = readFileSync(path.join(__dirname, "share-pin.server.ts"), "utf8");

  it("marks the module server-only", () => {
    expect(source).toContain('import "server-only"');
  });

  it("uses only node:crypto, no third-party dependency", () => {
    expect(source).toContain('from "node:crypto"');
    expect(source).not.toMatch(/from ["'](?!node:|\.)/);
  });

  it("uses the asynchronous scrypt API, never scryptSync", () => {
    expect(source).not.toContain("scryptSync(");
    expect(source).toContain("scrypt as nodeScrypt");
    expect(source).toContain("nodeScrypt(password, salt, keyLength, options, (error, derivedKey)");
  });

  it("does not use promisify(scrypt) -- its inferred type loses the ScryptOptions overload", () => {
    expect(source).not.toContain("promisify(");
    expect(source).not.toMatch(/from ["']node:util["']/);
  });

  it("wraps the native callback scrypt in an explicitly typed Promise<Buffer>, resolving only with the callback's derivedKey and rejecting with the original error", () => {
    expect(source).toContain("function scryptDerive(");
    expect(source).toContain("): Promise<Buffer> {");
    expect(source).toContain("return new Promise((resolve, reject) => {");
    expect(source).toContain("reject(error);");
    expect(source).toContain("resolve(derivedKey);");
  });

  it("both hashSharePin and verifySharePin call the single scryptDerive wrapper, each supplying the exact V1 N/r/p/maxmem options", () => {
    const callSites = [...source.matchAll(/await scryptDerive\(/g)];
    expect(callSites).toHaveLength(2);
    expect(source).toContain(
      "derivedKey = await scryptDerive(pin, salt, PIN_KEY_LENGTH, {\n      N: PIN_SCRYPT_N,\n      r: PIN_SCRYPT_R,\n      p: PIN_SCRYPT_P,\n      maxmem: SCRYPT_MAXMEM,\n    });"
    );
    expect(source).toContain(
      "derivedKey = await scryptDerive(pin, salt, material.pinKeyLength, {\n      N: material.pinScryptN,\n      r: material.pinScryptR,\n      p: material.pinScryptP,\n      maxmem: SCRYPT_MAXMEM,\n    });"
    );
  });

  it("introduces no unsafe TypeScript suppression or cast anywhere in the module", () => {
    expect(source).not.toContain("as any");
    expect(source).not.toContain("as unknown as");
    expect(source).not.toContain("@ts-ignore");
    expect(source).not.toContain("@ts-expect-error");
    expect(source).not.toContain(") as Buffer");
  });

  it("uses timingSafeEqual for the final comparison, never a plain equality check on the derived key or hash", () => {
    expect(source).toContain("timingSafeEqual(derivedKey, storedHash)");
    expect(source).not.toMatch(/derivedKey\s*===/);
    expect(source).not.toMatch(/derivedKey\.toString\([^)]*\)\s*===/);
  });

  it("sets an explicit, bounded maxmem derived from the fixed N/r profile", () => {
    expect(source).toContain("SCRYPT_MAXMEM = 128 * PIN_SCRYPT_N * PIN_SCRYPT_R");
    expect(source).toContain("maxmem: SCRYPT_MAXMEM");
  });

  it("never accesses a stored-material property before confirming a non-null, non-array object", () => {
    expect(source).toContain(
      "typeof value === \"object\" && value !== null && !Array.isArray(value)"
    );
    expect(source).toContain("isPlainObject(material)");
  });

  it("checks every stored-material field's primitive type before it is ever used", () => {
    expect(source).toContain('typeof pinHash !== "string" || typeof pinSalt !== "string"');
    expect(source).toContain('typeof pinHashVersion !== "number"');
  });

  it("decodes pinHash/pinSalt through a canonical round-trip check, defending even against a byte-length mismatch a correctly-shaped string cannot actually produce", () => {
    expect(source).toContain("decoded.length !== expectedByteLength");
    expect(source).toContain('decoded.toString("base64url") !== value');
    expect(source).toContain("decodeCanonicalBase64Url(material.pinHash, material.pinKeyLength)");
    expect(source).toContain("decodeCanonicalBase64Url(material.pinSalt, SALT_RANDOM_BYTES)");
  });

  it("accepts unknown, not a compile-time-typed object, as verifySharePin's stored-material parameter", () => {
    expect(source).toContain("export async function verifySharePin(\n  pin: string,\n  material: unknown\n)");
  });
});

describe("no sensitive material is ever logged", () => {
  it("never logs the PIN, salt or hash across hashing and verification", async () => {
    const pinMarker = "1234";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const hashed = await hashSharePin(pinMarker);
      await verifySharePin(pinMarker, hashed);
      await verifySharePin("9999", hashed);

      for (const spy of [logSpy, errorSpy, warnSpy]) {
        for (const call of spy.mock.calls) {
          const serialized = JSON.stringify(call);
          expect(serialized).not.toContain(pinMarker);
          expect(serialized).not.toContain(hashed.pinHash);
          expect(serialized).not.toContain(hashed.pinSalt);
        }
      }
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  }, 15000);
});
