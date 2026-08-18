import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ENV_KEY = "TEXT2TASK_SHARE_FILE_REF_HMAC_KEY_V1";
const VALID_KEY_A = Buffer.alloc(32, 7).toString("base64url");
const VALID_KEY_B = Buffer.alloc(32, 9).toString("base64url");

async function loadModule() {
  // Re-imported per test after mutating process.env so the lazily-loaded
  // key is re-read each time -- the module caches nothing module-level.
  return import("./share-file-ref.server");
}

describe("deriveShareFileRef", () => {
  const originalValue = process.env[ENV_KEY];

  beforeEach(() => {
    process.env[ENV_KEY] = VALID_KEY_A;
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalValue;
    }
  });

  it("is deterministic for the same (shareLinkId, resourceId) pair", async () => {
    const { deriveShareFileRef } = await loadModule();
    const a = deriveShareFileRef("link-1", "resource-1");
    const b = deriveShareFileRef("link-1", "resource-1");
    expect(a).toBe(b);
  });

  it("differs when resourceId differs", async () => {
    const { deriveShareFileRef } = await loadModule();
    expect(deriveShareFileRef("link-1", "resource-1")).not.toBe(
      deriveShareFileRef("link-1", "resource-2")
    );
  });

  it("differs when shareLinkId differs (no cross-link replay)", async () => {
    const { deriveShareFileRef } = await loadModule();
    expect(deriveShareFileRef("link-1", "resource-1")).not.toBe(
      deriveShareFileRef("link-2", "resource-1")
    );
  });

  it("differs when the HMAC key differs (key rotation changes every fileRef)", async () => {
    const { deriveShareFileRef } = await loadModule();
    const withKeyA = deriveShareFileRef("link-1", "resource-1");
    process.env[ENV_KEY] = VALID_KEY_B;
    const withKeyB = deriveShareFileRef("link-1", "resource-1");
    expect(withKeyA).not.toBe(withKeyB);
  });

  it("returns exactly 43 base64url characters (32-byte digest, no padding)", async () => {
    const { deriveShareFileRef, isPlausibleShareFileRef } = await loadModule();
    const ref = deriveShareFileRef("link-1", "resource-1");
    expect(ref).toHaveLength(43);
    expect(/^[A-Za-z0-9_-]{43}$/.test(ref)).toBe(true);
    expect(isPlausibleShareFileRef(ref)).toBe(true);
  });

  it("throws a typed error when the key is missing", async () => {
    delete process.env[ENV_KEY];
    const { deriveShareFileRef, ShareFileRefError } = await loadModule();
    expect(() => deriveShareFileRef("link-1", "resource-1")).toThrow(ShareFileRefError);
  });

  it("throws a typed error for empty shareLinkId/resourceId", async () => {
    const { deriveShareFileRef, ShareFileRefError } = await loadModule();
    expect(() => deriveShareFileRef("", "resource-1")).toThrow(ShareFileRefError);
    expect(() => deriveShareFileRef("link-1", "")).toThrow(ShareFileRefError);
  });
});

describe("isPlausibleShareFileRef", () => {
  beforeEach(() => {
    process.env[ENV_KEY] = VALID_KEY_A;
  });

  it("rejects wrong length, wrong alphabet, and non-string input", async () => {
    const { isPlausibleShareFileRef } = await loadModule();
    expect(isPlausibleShareFileRef("too-short")).toBe(false);
    expect(isPlausibleShareFileRef("a".repeat(43) + "!")).toBe(false);
    expect(isPlausibleShareFileRef(null)).toBe(false);
    expect(isPlausibleShareFileRef(undefined)).toBe(false);
    expect(isPlausibleShareFileRef(12345)).toBe(false);
  });
});

describe("matchShareFileRef", () => {
  beforeEach(() => {
    process.env[ENV_KEY] = VALID_KEY_A;
  });

  it("finds the correct resourceId among several mapped decoys", async () => {
    const { deriveShareFileRef, matchShareFileRef } = await loadModule();
    const mapped = ["r-1", "r-2", "r-3", "r-4"];
    const target = deriveShareFileRef("link-1", "r-3");

    expect(matchShareFileRef(target, "link-1", mapped)).toBe("r-3");
  });

  it("returns null when no mapped resource matches", async () => {
    const { deriveShareFileRef, matchShareFileRef } = await loadModule();
    const foreignRef = deriveShareFileRef("link-1", "r-not-mapped");

    expect(matchShareFileRef(foreignRef, "link-1", ["r-1", "r-2"])).toBeNull();
  });

  it("returns null for a fileRef computed under a different shareLinkId (cross-link replay rejected)", async () => {
    const { deriveShareFileRef, matchShareFileRef } = await loadModule();
    const refUnderOtherLink = deriveShareFileRef("link-OTHER", "r-1");

    expect(matchShareFileRef(refUnderOtherLink, "link-1", ["r-1"])).toBeNull();
  });

  it("returns null for syntactically invalid input without throwing", async () => {
    const { matchShareFileRef } = await loadModule();
    expect(matchShareFileRef("garbage", "link-1", ["r-1"])).toBeNull();
  });

  it("returns null for an empty mapped set", async () => {
    const { deriveShareFileRef, matchShareFileRef } = await loadModule();
    const ref = deriveShareFileRef("link-1", "r-1");
    expect(matchShareFileRef(ref, "link-1", [])).toBeNull();
  });
});

describe("dedicated-key convention", () => {
  it("reads its key from its own dedicated env var, never the session or share-secret one", () => {
    const source = readFileSync(
      path.resolve(__dirname, "share-file-ref.server.ts"),
      "utf8"
    );
    expect(source).toContain('process.env[FILE_REF_HMAC_KEY_ENV]');
    expect(source).toContain("TEXT2TASK_SHARE_FILE_REF_HMAC_KEY_V1");
    expect(source).not.toContain('process.env["TEXT2TASK_SHARE_SESSION_HMAC_KEY_V1"]');
    expect(source).not.toContain("process.env.TEXT2TASK_SHARE_SESSION_HMAC_KEY_V1");
    expect(source).not.toContain('process.env["TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1"]');
    expect(source).not.toContain("process.env.TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1");
  });

  it("never exports the raw key accessor -- only fileRef derivation/matching", () => {
    const source = readFileSync(
      path.resolve(__dirname, "share-file-ref.server.ts"),
      "utf8"
    );
    expect(source).not.toContain("export function getShareFileRefHmacKey");
    expect(source).not.toContain("export const getShareFileRefHmacKey");
  });

  it("uses timingSafeEqual for fileRef comparison, never a plain equality check", () => {
    const source = readFileSync(
      path.resolve(__dirname, "share-file-ref.server.ts"),
      "utf8"
    );
    expect(source).toContain("timingSafeEqual(expectedBuffer, candidateBuffer)");
    expect(source).not.toMatch(/expected\s*===\s*candidateFileRef/);
  });
});
