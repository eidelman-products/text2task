import { describe, expect, it } from "vitest";

import { getPortalUrl, getReadableCreemError } from "./creem-response";

describe("getPortalUrl - external Creem API response narrowing", () => {
  it("reads the url field from a well-formed response", () => {
    expect(getPortalUrl({ url: "https://billing.example.com/portal" })).toBe(
      "https://billing.example.com/portal"
    );
  });

  it("falls back across every known field name Creem might use", () => {
    expect(
      getPortalUrl({ customer_portal_link: "https://a.example.com" })
    ).toBe("https://a.example.com");
    expect(getPortalUrl({ portalUrl: "https://b.example.com" })).toBe(
      "https://b.example.com"
    );
    expect(getPortalUrl({ billing_url: "https://c.example.com" })).toBe(
      "https://c.example.com"
    );
  });

  it("trims whitespace from the resolved url", () => {
    expect(getPortalUrl({ url: "  https://example.com  " })).toBe(
      "https://example.com"
    );
  });

  it("returns null when no known url field is present", () => {
    expect(getPortalUrl({ unrelated: "value" })).toBeNull();
  });

  it("returns null when the url field is present but blank", () => {
    expect(getPortalUrl({ url: "   " })).toBeNull();
  });

  it("returns null when the url field is not a string", () => {
    expect(getPortalUrl({ url: 12345 })).toBeNull();
  });

  it("remains fail-closed for a null response body", () => {
    expect(getPortalUrl(null)).toBeNull();
  });

  it("remains fail-closed for a non-object response body", () => {
    expect(getPortalUrl("unexpected string body")).toBeNull();
    expect(getPortalUrl(42)).toBeNull();
    expect(getPortalUrl(undefined)).toBeNull();
  });

  it("remains fail-closed for an array response body", () => {
    expect(getPortalUrl(["https://example.com"])).toBeNull();
  });
});

describe("getReadableCreemError - external Creem API error narrowing", () => {
  it("prefers a string message field", () => {
    expect(getReadableCreemError({ message: "Customer not found" })).toBe(
      "Customer not found"
    );
  });

  it("joins an array message field into one readable string", () => {
    expect(
      getReadableCreemError({ message: ["Field required", "Invalid id"] })
    ).toBe("Field required, Invalid id");
  });

  it("falls back to the error field when message is absent", () => {
    expect(getReadableCreemError({ error: "Unauthorized" })).toBe(
      "Unauthorized"
    );
  });

  it("falls back to the detail field when message and error are absent", () => {
    expect(getReadableCreemError({ detail: "Rate limited" })).toBe(
      "Rate limited"
    );
  });

  it("returns a generic fallback for a null or non-object body", () => {
    expect(getReadableCreemError(null)).toBe("Failed to create billing portal");
    expect(getReadableCreemError("plain text error")).toBe(
      "Failed to create billing portal"
    );
  });

  it("returns a generic fallback when no recognizable field is present", () => {
    expect(getReadableCreemError({ unrelated: true })).toBe(
      "Failed to create billing portal"
    );
  });
});
