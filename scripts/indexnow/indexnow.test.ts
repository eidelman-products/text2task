import { describe, expect, it, vi } from "vitest";

import {
  CANONICAL_HOST,
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
} from "./indexnow-config.mjs";
import {
  classifyChangedFile,
  mapChangedFiles,
} from "./changed-file-mapper.mjs";
import {
  canonicalUrlFromPath,
  getSitemapPathnames,
  getSitemapUrls,
} from "./public-url-inventory.mjs";
import {
  buildIndexNowRequestBody,
  runIndexNowSubmission,
} from "./indexnow-submitter.mjs";
import {
  safeDisplayUrl,
  validateAndDedupeUrls,
  validateIndexNowUrl,
} from "./url-validator.mjs";

describe("IndexNow public URL inventory", () => {
  it("loads the current 33 canonical sitemap URLs", async () => {
    const sitemapUrls = await getSitemapUrls();

    expect(sitemapUrls).toHaveLength(33);
    expect(sitemapUrls).toContain("https://www.text2task.com/");
    expect(sitemapUrls).toContain(
      "https://www.text2task.com/features/email-to-tasks",
    );
    expect(sitemapUrls.every((url) => url.startsWith("https://www.text2task.com"))).toBe(true);
  });

  it("accepts a canonical production URL that exists in the sitemap", async () => {
    const sitemapUrls = await getSitemapUrls();
    const result = validateIndexNowUrl(
      "https://www.text2task.com/features/email-to-tasks",
      sitemapUrls,
    );

    expect(result).toMatchObject({
      ok: true,
      url: "https://www.text2task.com/features/email-to-tasks",
      pathname: "/features/email-to-tasks",
    });
  });

  it("accepts a relative sitemap route and canonicalizes it", async () => {
    const sitemapUrls = await getSitemapUrls();
    const result = validateIndexNowUrl("/solutions/freelancer-project-management-software", sitemapUrls);

    expect(result).toMatchObject({
      ok: true,
      url: "https://www.text2task.com/solutions/freelancer-project-management-software",
    });
  });

  it("rejects non-sitemap URLs in normal mode", async () => {
    const sitemapUrls = await getSitemapUrls();
    const result = validateIndexNowUrl("https://www.text2task.com/not-a-page", sitemapUrls);

    expect(result).toMatchObject({
      ok: false,
      reason: "NOT_IN_SITEMAP_ALLOWLIST",
    });
  });
});

describe("IndexNow URL validation safety", () => {
  it("rejects Preview URLs", async () => {
    const result = validateIndexNowUrl(
      "https://text2task-git-feature-owner.vercel.app/features/email-to-tasks",
      await getSitemapUrls(),
    );

    expect(result).toMatchObject({ ok: false, reason: "VERCEL_PREVIEW_HOST" });
  });

  it("rejects staging and non-canonical hosts", async () => {
    const result = validateIndexNowUrl(
      "https://staging.text2task.com/features/email-to-tasks",
      await getSitemapUrls(),
    );

    expect(result).toMatchObject({ ok: false, reason: "NON_CANONICAL_HOST" });
  });

  it("rejects localhost URLs", async () => {
    const result = validateIndexNowUrl(
      "https://localhost:3000/features/email-to-tasks",
      await getSitemapUrls(),
    );

    expect(result).toMatchObject({ ok: false, reason: "LOCALHOST_URL" });
  });

  it("rejects API routes", async () => {
    const result = validateIndexNowUrl("https://www.text2task.com/api/extract", await getSitemapUrls());

    expect(result).toMatchObject({ ok: false, reason: "PRIVATE_OR_NOINDEX_PATH" });
  });

  it("rejects auth and account routes", async () => {
    const sitemapUrls = await getSitemapUrls();

    expect(validateIndexNowUrl("https://www.text2task.com/auth/confirm", sitemapUrls)).toMatchObject({
      ok: false,
      reason: "PRIVATE_OR_NOINDEX_PATH",
    });
    expect(validateIndexNowUrl("https://www.text2task.com/login", sitemapUrls)).toMatchObject({
      ok: false,
      reason: "PRIVATE_OR_NOINDEX_PATH",
    });
  });

  it("rejects dashboard, admin, and app routes", async () => {
    const sitemapUrls = await getSitemapUrls();

    expect(validateIndexNowUrl("https://www.text2task.com/dashboard", sitemapUrls)).toMatchObject({
      ok: false,
      reason: "PRIVATE_OR_NOINDEX_PATH",
    });
    expect(validateIndexNowUrl("https://www.text2task.com/admin/analytics", sitemapUrls)).toMatchObject({
      ok: false,
      reason: "PRIVATE_OR_NOINDEX_PATH",
    });
    expect(validateIndexNowUrl("https://www.text2task.com/app/projects", sitemapUrls)).toMatchObject({
      ok: false,
      reason: "PRIVATE_OR_NOINDEX_PATH",
    });
  });

  it("rejects private share and token routes", async () => {
    const sitemapUrls = await getSitemapUrls();

    expect(validateIndexNowUrl("https://www.text2task.com/share/public-id#secret", sitemapUrls)).toMatchObject({
      ok: false,
      reason: "FRAGMENT_REJECTED",
    });
    expect(validateIndexNowUrl("https://www.text2task.com/homepage-demo/review?token=abc", sitemapUrls)).toMatchObject({
      ok: false,
      reason: "QUERY_STRING_REJECTED",
    });
  });

  it("rejects query variants and fragments", async () => {
    const sitemapUrls = await getSitemapUrls();

    expect(validateIndexNowUrl("https://www.text2task.com/features/email-to-tasks?utm_source=x", sitemapUrls)).toMatchObject({
      ok: false,
      reason: "QUERY_STRING_REJECTED",
    });
    expect(validateIndexNowUrl("https://www.text2task.com/features/email-to-tasks#pricing", sitemapUrls)).toMatchObject({
      ok: false,
      reason: "FRAGMENT_REJECTED",
    });
  });

  it("rejects redirect aliases and asset URLs", async () => {
    const sitemapUrls = await getSitemapUrls();

    expect(validateIndexNowUrl("https://www.text2task.com/pricing", sitemapUrls)).toMatchObject({
      ok: false,
      reason: "REDIRECT_ALIAS_REJECTED",
    });
    expect(validateIndexNowUrl("https://www.text2task.com/landing/text2task-demo.mp4", sitemapUrls)).toMatchObject({
      ok: false,
      reason: "ASSET_URL_REJECTED",
    });
  });

  it("deduplicates accepted canonical URLs", async () => {
    const result = validateAndDedupeUrls(
      [
        "/features/email-to-tasks",
        "https://www.text2task.com/features/email-to-tasks",
        "/solutions/freelancer-project-management-software",
      ],
      await getSitemapUrls(),
    );

    expect(result.accepted).toEqual([
      "https://www.text2task.com/features/email-to-tasks",
      "https://www.text2task.com/solutions/freelancer-project-management-software",
    ]);
    expect(result.duplicateCount).toBe(1);
  });

  it("redacts private URLs from logging output", () => {
    expect(safeDisplayUrl("https://www.text2task.com/share/public-id?email=user@example.com")).toBe(
      "[private-url-redacted:/share]",
    );
    expect(safeDisplayUrl("https://www.text2task.com/api/tasks?projectId=secret")).toBe(
      "[private-url-redacted:/api]",
    );
  });
});

describe("IndexNow changed-file mapping", () => {
  it("maps data-driven use-case source files to their canonical use-case URL", async () => {
    await expect(
      classifyChangedFile("app/lib/use-cases/cases/wordpress-freelancers.ts"),
    ).resolves.toMatchObject({
      classification: "ONE_URL",
      candidatePaths: ["/use-cases/wordpress-freelancers"],
      reviewRequired: false,
    });
  });

  it("maps resource pages correctly", async () => {
    await expect(
      classifyChangedFile("app/resources/how-to-turn-emails-into-tasks/page.tsx"),
    ).resolves.toMatchObject({
      classification: "ONE_URL",
      candidatePaths: ["/resources/how-to-turn-emails-into-tasks"],
    });
  });

  it("maps feature pages correctly", async () => {
    await expect(
      classifyChangedFile("app/features/email-to-tasks/page.tsx"),
    ).resolves.toMatchObject({
      classification: "ONE_URL",
      candidatePaths: ["/features/email-to-tasks"],
    });
  });

  it("maps unrelated source files to no public SEO URL", async () => {
    await expect(classifyChangedFile("lib/tasks/parse-deadline.ts")).resolves.toMatchObject({
      classification: "NO_PUBLIC_SEO_URL",
      candidatePaths: [],
    });
  });

  it("does not silently auto-submit the whole site for global/shared files", async () => {
    await expect(classifyChangedFile("app/layout.tsx")).resolves.toMatchObject({
      classification: "ALL_PUBLIC_SEO_URLS",
      candidatePaths: [],
      reviewRequired: true,
    });
  });

  it("marks deleted public route candidates as requiring explicit handling", async () => {
    await expect(
      classifyChangedFile("app/features/email-to-tasks/page.tsx", { status: "D" }),
    ).resolves.toMatchObject({
      classification: "DELETED_OR_RENAMED_CANDIDATE",
      candidatePaths: ["/features/email-to-tasks"],
      reviewRequired: true,
    });
  });

  it("maps a mixed changed-file list without submitting anything", async () => {
    const mapped = await mapChangedFiles([
      "app/features/email-to-tasks/page.tsx",
      "app/layout.tsx",
      "lib/tasks/parse-deadline.ts",
    ]);

    expect(mapped).toHaveLength(3);
    expect(mapped[0].classification).toBe("ONE_URL");
    expect(mapped[1].reviewRequired).toBe(true);
    expect(mapped[2].classification).toBe("NO_PUBLIC_SEO_URL");
  });
});

describe("IndexNow request building and submission guards", () => {
  it("builds the request body with the correct host, key, keyLocation, and canonical urlList", () => {
    const body = buildIndexNowRequestBody([
      canonicalUrlFromPath("/features/email-to-tasks"),
      canonicalUrlFromPath("/solutions/freelancer-project-management-software"),
    ]);

    expect(body).toEqual({
      host: CANONICAL_HOST,
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: [
        "https://www.text2task.com/features/email-to-tasks",
        "https://www.text2task.com/solutions/freelancer-project-management-software",
      ],
    });
  });

  it("dry-run makes no external request", async () => {
    const fetchImpl = vi.fn();
    const report = await runIndexNowSubmission({
      urls: ["/features/email-to-tasks"],
      fetchImpl,
    });

    expect(report.mode).toBe("dry-run");
    expect(report.requestWouldBeSent).toBe(false);
    expect(report.overallResult).toBe("DRY_RUN_NO_REQUEST_SENT");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("Preview environment makes no external request even with explicit submit", async () => {
    const fetchImpl = vi.fn();
    const report = await runIndexNowSubmission({
      submit: true,
      urls: ["/features/email-to-tasks"],
      env: { VERCEL_ENV: "preview" },
      fetchImpl,
    });

    expect(report.overallResult).toBe("VERCEL_ENV_NOT_PRODUCTION");
    expect(report.requestWouldBeSent).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("development mode makes no accidental request without explicit submit", async () => {
    const fetchImpl = vi.fn();
    const report = await runIndexNowSubmission({
      urls: ["/features/email-to-tasks"],
      env: { NODE_ENV: "development" },
      fetchImpl,
    });

    expect(report.mode).toBe("dry-run");
    expect(report.overallResult).toBe("DRY_RUN_NO_REQUEST_SENT");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("real request requires explicit submit action", async () => {
    const fetchImpl = vi.fn();
    const report = await runIndexNowSubmission({
      urls: ["/features/email-to-tasks"],
      env: { VERCEL_ENV: "production" },
      fetchImpl,
    });

    expect(report.mode).toBe("dry-run");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("submits only with explicit submit and an allowed environment", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const report = await runIndexNowSubmission({
      submit: true,
      urls: ["/features/email-to-tasks"],
      env: { VERCEL_ENV: "production" },
      fetchImpl,
      timeoutMs: 1_000,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      INDEXNOW_ENDPOINT,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("https://www.text2task.com/features/email-to-tasks"),
      }),
    );
    expect(report.overallResult).toBe("SUBMISSION_ACCEPTED");
    expect(report.statusCode).toBe(200);
  });

  it("handles IndexNow API failure cleanly as non-blocking", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    const report = await runIndexNowSubmission({
      submit: true,
      urls: ["/features/email-to-tasks"],
      env: { VERCEL_ENV: "production" },
      fetchImpl,
      timeoutMs: 1_000,
    });

    expect(report.overallResult).toBe("SUBMISSION_FAILED_NON_BLOCKING");
    expect(report.statusCode).toBe(429);
  });

  it("review-required file mappings prevent submission", async () => {
    const fetchImpl = vi.fn();
    const report = await runIndexNowSubmission({
      submit: true,
      files: ["app/layout.tsx"],
      env: { VERCEL_ENV: "production" },
      fetchImpl,
    });

    expect(report.overallResult).toBe("REVIEW_REQUIRED_NO_REQUEST_SENT");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("private/user URLs cannot enter logging or submission flow", async () => {
    const fetchImpl = vi.fn();
    const report = await runIndexNowSubmission({
      submit: true,
      urls: ["https://www.text2task.com/share/public-id?email=user@example.com"],
      env: { VERCEL_ENV: "production" },
      fetchImpl,
    });

    expect(report.acceptedUrls).toEqual([]);
    expect(report.rejectedUrls).toEqual([
      {
        ok: false,
        input: "[private-url-redacted:/share]",
        reason: "QUERY_STRING_REJECTED",
      },
    ]);
    expect(JSON.stringify(report)).not.toContain("user@example.com");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sitemap path inventory includes no private route categories", async () => {
    const paths = await getSitemapPathnames();

    expect(paths.some((entry) => entry.startsWith("/api"))).toBe(false);
    expect(paths.some((entry) => entry.startsWith("/dashboard"))).toBe(false);
    expect(paths.some((entry) => entry.startsWith("/share"))).toBe(false);
    expect(paths).not.toContain("/pricing");
  });
});
