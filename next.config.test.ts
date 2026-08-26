import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

/*
  2026-08-26 -- Google Search Console reported a 404 for the legacy,
  unreferenced static-site path /index.html. Fixed with the FIRST and
  only redirects() entry in this project (no middleware.ts, no
  vercel.json redirect rules exist). This suite tests next.config.ts's
  own redirects() function directly -- the smallest-surface way to
  regression-protect a Next.js redirect without standing up a server --
  and proves the fix is scoped to exactly this one path with no
  side effects on unrelated routing.
*/

async function getRedirects() {
  if (typeof nextConfig.redirects !== "function") {
    throw new Error("next.config.ts must export a redirects() function.");
  }

  return nextConfig.redirects();
}

describe("next.config.ts redirects()", () => {
  it("redirects /index.html to / as a permanent redirect", async () => {
    const redirects = await getRedirects();
    const indexHtmlRedirect = redirects.find((r) => r.source === "/index.html");

    expect(indexHtmlRedirect).toBeDefined();
    expect(indexHtmlRedirect!.destination).toBe("/");
    expect(indexHtmlRedirect!.permanent).toBe(true);
  });

  it("the /index.html redirect destination is a single relative path, not a second hop through an absolute/external URL (no redirect chain)", async () => {
    const redirects = await getRedirects();
    const indexHtmlRedirect = redirects.find((r) => r.source === "/index.html");

    expect(indexHtmlRedirect!.destination).not.toMatch(/^https?:\/\//);
    // The destination itself must not be a path that ALSO appears as a
    // redirect source elsewhere in this config -- that would be a chain.
    expect(redirects.some((r) => r.source === indexHtmlRedirect!.destination)).toBe(false);
  });

  it("defines exactly one redirect rule -- this fix is scoped to /index.html only, no unrelated redirects were introduced", async () => {
    const redirects = await getRedirects();
    expect(redirects).toHaveLength(1);
    expect(redirects[0].source).toBe("/index.html");
  });

  it("does not redirect an unrelated, arbitrary unknown path (legitimate 404 behavior for other URLs is preserved)", async () => {
    const redirects = await getRedirects();
    const unrelatedMatch = redirects.find(
      (r) => r.source === "/some-arbitrary-unknown-page"
    );

    expect(unrelatedMatch).toBeUndefined();
  });

  it("does not redirect the homepage itself, the actual canonical destination (no self-redirect / no loop)", async () => {
    const redirects = await getRedirects();
    const homepageMatch = redirects.find((r) => r.source === "/");

    expect(homepageMatch).toBeUndefined();
  });

  it("does not redefine or touch image remote-pattern configuration (unrelated Next.js config is untouched)", () => {
    expect(nextConfig.images?.remotePatterns).toEqual([
      { protocol: "https", hostname: "logo.clearbit.com" },
    ]);
  });
});
