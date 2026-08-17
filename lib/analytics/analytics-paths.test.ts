import { describe, expect, it } from "vitest";

import { shouldSkipAnalyticsPath } from "./analytics-paths";

describe("shouldSkipAnalyticsPath - Phase 3 Client Share public route exclusion", () => {
  it("skips analytics on the /share root path", () => {
    expect(shouldSkipAnalyticsPath("/share")).toBe(true);
  });

  it("skips analytics on every /share/<publicId> path", () => {
    expect(shouldSkipAnalyticsPath("/share/abcdefgh12345678ijklmnop")).toBe(true);
  });

  it("skips analytics on a nested /share/** path", () => {
    expect(shouldSkipAnalyticsPath("/share/abcdefgh12345678ijklmnop/anything")).toBe(true);
  });

  it("does not skip analytics for a path that merely starts with 'share' without the slash boundary", () => {
    expect(shouldSkipAnalyticsPath("/sharewarez")).toBe(false);
  });
});

describe("shouldSkipAnalyticsPath - existing exclusions remain intact", () => {
  it("still skips /admin paths", () => {
    expect(shouldSkipAnalyticsPath("/admin")).toBe(true);
    expect(shouldSkipAnalyticsPath("/admin/analytics")).toBe(true);
  });

  it("still skips exactly /homepage-demo/review", () => {
    expect(shouldSkipAnalyticsPath("/homepage-demo/review")).toBe(true);
  });

  it("does not skip ordinary marketing/dashboard paths", () => {
    expect(shouldSkipAnalyticsPath("/")).toBe(false);
    expect(shouldSkipAnalyticsPath("/dashboard")).toBe(false);
    expect(shouldSkipAnalyticsPath("/pricing")).toBe(false);
  });

  it("handles null/undefined pathname safely", () => {
    expect(shouldSkipAnalyticsPath(null)).toBe(false);
    expect(shouldSkipAnalyticsPath(undefined)).toBe(false);
  });
});
