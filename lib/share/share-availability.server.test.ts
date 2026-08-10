import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ShareAvailabilityError,
  assertClientShareEnabled,
  isClientShareEnabled,
  isShareAvailabilityError,
} from "./share-availability.server";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isClientShareEnabled", () => {
  it("is disabled when the env var is unset", () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", undefined as unknown as string);
    expect(isClientShareEnabled()).toBe(false);
  });

  it("is disabled for an empty string", () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "");
    expect(isClientShareEnabled()).toBe(false);
  });

  it("is disabled for any value other than the literal string true", () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "1");
    expect(isClientShareEnabled()).toBe(false);

    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "yes");
    expect(isClientShareEnabled()).toBe(false);

    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "falsetrue");
    expect(isClientShareEnabled()).toBe(false);
  });

  it("is enabled only for the exact literal string true (case-insensitive, trimmed)", () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "true");
    expect(isClientShareEnabled()).toBe(true);

    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "True");
    expect(isClientShareEnabled()).toBe(true);

    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "  true  ");
    expect(isClientShareEnabled()).toBe(true);
  });
});

describe("assertClientShareEnabled", () => {
  it("throws ShareAvailabilityError when disabled", () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "false");
    expect(() => assertClientShareEnabled()).toThrow(ShareAvailabilityError);
  });

  it("does not throw when enabled", () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "true");
    expect(() => assertClientShareEnabled()).not.toThrow();
  });
});

describe("isShareAvailabilityError", () => {
  it("identifies a ShareAvailabilityError instance", () => {
    expect(isShareAvailabilityError(new ShareAvailabilityError())).toBe(true);
  });

  it("rejects an unrelated error", () => {
    expect(isShareAvailabilityError(new Error("other"))).toBe(false);
    expect(isShareAvailabilityError("not an error")).toBe(false);
    expect(isShareAvailabilityError(null)).toBe(false);
  });
});
