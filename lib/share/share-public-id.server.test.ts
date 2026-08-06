import { describe, expect, it } from "vitest";
import {
  generateSharePublicId,
  isValidSharePublicId,
  SHARE_PUBLIC_ID_PATTERN,
} from "./share-public-id.server";

describe("generateSharePublicId", () => {
  it("produces exactly 24 base64url characters", () => {
    const publicId = generateSharePublicId();
    expect(publicId).toHaveLength(24);
    expect(publicId).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });

  it("conforms to the existing database constraint pattern (^[A-Za-z0-9_-]{16,64}$)", () => {
    const publicId = generateSharePublicId();
    expect(SHARE_PUBLIC_ID_PATTERN.test(publicId)).toBe(true);
    expect(publicId).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  });

  it("produces distinct values on repeated calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateSharePublicId()));
    expect(ids.size).toBe(50);
  });

  it("takes no arguments -- structurally cannot derive from project id, user id, a timestamp or a counter", () => {
    expect(generateSharePublicId.length).toBe(0);
  });
});

describe("isValidSharePublicId", () => {
  it("accepts a freshly generated id", () => {
    expect(isValidSharePublicId(generateSharePublicId())).toBe(true);
  });

  it.each([
    "",
    "a".repeat(15),
    "a".repeat(65),
    "has spaces xxxxxxxxxxxx",
    "has/slash/xxxxxxxxxxxxx",
    123,
    null,
    undefined,
  ])("rejects an invalid value %s", (value) => {
    expect(isValidSharePublicId(value)).toBe(false);
  });
});
