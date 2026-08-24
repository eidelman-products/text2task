// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { isClientSharePagePath, proxy, SHARE_PUBLIC_PAGE_HEADERS } from "./proxy";

/*
  Phase 7D proxy.ts test-closure. Per this turn's own instruction:
  "First inspect whether the header logic can be extracted into a small
  pure helper WITHOUT changing behavior" -- `isClientSharePagePath` and
  the exported `SHARE_PUBLIC_PAGE_HEADERS` constant are exactly that (see
  proxy.ts's own doc comment on isClientSharePagePath): a narrow,
  behavior-preserving extraction, not an elaborate Next.js/Supabase
  middleware emulation framework.

  Two layers of proof, matching the task's own requirement to prove
  actual header BEHAVIOR, not just the static array's own values:

  1. The pure predicate + the pure header array, asserted directly --
     fast, deterministic, no NextRequest/Supabase involved.
  2. The real `proxy()` function invoked with a real NextRequest for the
     `/share/...` branch and for a representative non-share early-return
     route (`/api/homepage-demo/review`) -- both of these branches return
     BEFORE `proxy()` ever constructs its Supabase client (see proxy.ts's
     own function body), so this needs no Supabase mocking and no env
     vars, while still exercising the real header-setting code path
     end-to-end on a real Response object, not a re-implementation of it.
*/

describe("isClientSharePagePath - pure path predicate", () => {
  it("matches the bare /share page", () => {
    expect(isClientSharePagePath("/share")).toBe(true);
  });

  it("matches any /share/<publicId> page", () => {
    expect(isClientSharePagePath("/share/abcdefgh12345678ijklmnop")).toBe(true);
  });

  it("does not match a path that merely starts with the same letters", () => {
    expect(isClientSharePagePath("/shared")).toBe(false);
    expect(isClientSharePagePath("/share-something")).toBe(false);
  });

  it("does not match an unrelated route (representative non-share route)", () => {
    expect(isClientSharePagePath("/dashboard")).toBe(false);
    expect(isClientSharePagePath("/")).toBe(false);
  });

  it("does not match the API surface -- proxy.ts only sets page-level headers; the API routes under /api/share/** set their own headers directly in each route handler", () => {
    expect(isClientSharePagePath("/api/share/session")).toBe(false);
    expect(isClientSharePagePath("/api/share/abc/projection")).toBe(false);
  });
});

describe("SHARE_PUBLIC_PAGE_HEADERS - exact policy values", () => {
  function headerValue(name: string): string | undefined {
    return SHARE_PUBLIC_PAGE_HEADERS.find(([headerName]) => headerName === name)?.[1];
  }

  it("Permissions-Policy denies camera/microphone/geolocation/payment/usb/fullscreen", () => {
    expect(headerValue("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()"
    );
  });

  it("X-Robots-Tag is present and matches the accepted Phase 7A value", () => {
    expect(headerValue("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
  });

  it("Referrer-Policy is no-referrer", () => {
    expect(headerValue("Referrer-Policy")).toBe("no-referrer");
  });

  it("Cache-Control is private, no-store", () => {
    expect(headerValue("Cache-Control")).toBe("private, no-store");
  });

  it("X-Content-Type-Options is nosniff", () => {
    expect(headerValue("X-Content-Type-Options")).toBe("nosniff");
  });

  it("Content-Security-Policy matches the accepted Phase 7 value", () => {
    expect(headerValue("Content-Security-Policy")).toBe(
      "frame-ancestors 'none'; object-src 'none'; base-uri 'none'"
    );
  });
});

describe("proxy() - /share/... page headers, end to end on a real Response", () => {
  it("applies every Client Share page header to the bare /share page", async () => {
    const response = await proxy(new NextRequest("http://localhost/share"));

    expect(response.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()"
    );
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "frame-ancestors 'none'; object-src 'none'; base-uri 'none'"
    );
  });

  it("applies the same headers to a /share/[publicId] page", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/share/abcdefgh12345678ijklmnop")
    );

    expect(response.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()"
    );
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
  });
});

describe("proxy() - a representative non-share route does not receive Client Share page policy", () => {
  it("/api/homepage-demo/review (an early-return route unrelated to Client Share) gets none of the Client Share headers", async () => {
    const response = await proxy(new NextRequest("http://localhost/api/homepage-demo/review"));

    expect(response.headers.get("Permissions-Policy")).toBeNull();
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("/homepage-demo/review keeps its own distinct header set, not the Client Share page's policy", async () => {
    const response = await proxy(new NextRequest("http://localhost/homepage-demo/review"));

    // Has its own noindex/no-store baseline...
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    // ...but never the Client Share page's own Permissions-Policy/CSP,
    // which are specific to the anonymous public share surface.
    expect(response.headers.get("Permissions-Policy")).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
  });
});
