import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import {
  OWNER_ANALYTICS_EXCLUSION_COOKIE,
  hasOwnerAnalyticsExclusionCookie,
  setOwnerAnalyticsExclusionCookie,
} from "./owner-exclusion.server";

function buildRequestWithCookie(value: string | undefined) {
  const headers: Record<string, string> = {};

  if (value !== undefined) {
    headers.cookie = `${OWNER_ANALYTICS_EXCLUSION_COOKIE}=${value}`;
  }

  return new NextRequest("http://localhost/api/analytics/event", { headers });
}

describe("hasOwnerAnalyticsExclusionCookie", () => {
  it("returns true only for the exact intended value '1'", () => {
    expect(hasOwnerAnalyticsExclusionCookie(buildRequestWithCookie("1"))).toBe(
      true
    );
  });

  it("returns false when the cookie is absent", () => {
    expect(hasOwnerAnalyticsExclusionCookie(buildRequestWithCookie(undefined))).toBe(
      false
    );
  });

  it.each(["true", "yes", "0", "2", ""])(
    "returns false for a malformed/non-exact value: %j",
    (value) => {
      expect(hasOwnerAnalyticsExclusionCookie(buildRequestWithCookie(value))).toBe(
        false
      );
    }
  );

  it("never throws even if reading cookies unexpectedly fails", () => {
    const request = buildRequestWithCookie("1");
    vi.spyOn(request.cookies, "get").mockImplementation(() => {
      throw new Error("simulated cookie read failure");
    });

    expect(() => hasOwnerAnalyticsExclusionCookie(request)).not.toThrow();
    expect(hasOwnerAnalyticsExclusionCookie(request)).toBe(false);
  });
});

describe("setOwnerAnalyticsExclusionCookie", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test");
    vi.unstubAllEnvs();
  });

  it("sets the cookie with the exact intended value", () => {
    const response = NextResponse.redirect("http://localhost/dashboard");
    setOwnerAnalyticsExclusionCookie(response);

    const cookie = response.cookies.get(OWNER_ANALYTICS_EXCLUSION_COOKIE);
    expect(cookie?.value).toBe("1");
  });

  it("sets httpOnly, sameSite=lax, path=/, and a 180-day maxAge", () => {
    const response = NextResponse.redirect("http://localhost/dashboard");
    setOwnerAnalyticsExclusionCookie(response);

    const cookie = response.cookies.get(OWNER_ANALYTICS_EXCLUSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 180);
  });

  it("sets secure=true in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = NextResponse.redirect("http://localhost/dashboard");
    setOwnerAnalyticsExclusionCookie(response);

    const cookie = response.cookies.get(OWNER_ANALYTICS_EXCLUSION_COOKIE);
    expect(cookie?.secure).toBe(true);
  });

  it("does not set secure outside production", () => {
    vi.stubEnv("NODE_ENV", "test");

    const response = NextResponse.redirect("http://localhost/dashboard");
    setOwnerAnalyticsExclusionCookie(response);

    const cookie = response.cookies.get(OWNER_ANALYTICS_EXCLUSION_COOKIE);
    expect(cookie?.secure).toBeFalsy();
  });

  it("never throws even if the underlying cookie set call fails", () => {
    const response = NextResponse.redirect("http://localhost/dashboard");
    vi.spyOn(response.cookies, "set").mockImplementation(() => {
      throw new Error("simulated cookie write failure");
    });

    expect(() => setOwnerAnalyticsExclusionCookie(response)).not.toThrow();
  });
});

describe("round trip", () => {
  it("a cookie set by setOwnerAnalyticsExclusionCookie is recognized by hasOwnerAnalyticsExclusionCookie", () => {
    const response = NextResponse.redirect("http://localhost/dashboard");
    setOwnerAnalyticsExclusionCookie(response);
    const setCookieHeader = response.headers.get("set-cookie");
    expect(setCookieHeader).toBeTruthy();

    const request = new NextRequest("http://localhost/api/analytics/event", {
      headers: { cookie: `${OWNER_ANALYTICS_EXCLUSION_COOKIE}=1` },
    });

    expect(hasOwnerAnalyticsExclusionCookie(request)).toBe(true);
  });
});
