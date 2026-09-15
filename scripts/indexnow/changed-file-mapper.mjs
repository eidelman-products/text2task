import { readFile } from "node:fs/promises";
import path from "node:path";

function normalizeFilePath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function oneUrl(pathname, sourceFile, status) {
  if (status === "D") {
    return {
      classification: "DELETED_OR_RENAMED_CANDIDATE",
      sourceFile,
      candidatePaths: [pathname],
      reviewRequired: true,
      reason: "Deleted public route candidate requires explicit 404/410 or redirect confirmation.",
    };
  }

  return {
    classification: "ONE_URL",
    sourceFile,
    candidatePaths: [pathname],
    reviewRequired: false,
    reason: "Changed source file maps deterministically to one canonical public URL.",
  };
}

function reviewRequired(classification, sourceFile, reason) {
  return {
    classification,
    sourceFile,
    candidatePaths: [],
    reviewRequired: true,
    reason,
  };
}

function noUrl(sourceFile, reason = "Changed file has no public SEO URL impact.") {
  return {
    classification: "NO_PUBLIC_SEO_URL",
    sourceFile,
    candidatePaths: [],
    reviewRequired: false,
    reason,
  };
}

async function readUseCaseSlug(sourceFile) {
  const source = await readFile(sourceFile, "utf8");
  const match = source.match(/"slug"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

export async function classifyChangedFile(filePath, options = {}) {
  const normalized = normalizeFilePath(filePath);
  const status = options.status ?? "M";

  let match = normalized.match(/^app\/features\/([^/]+)\/page\.tsx$/);
  if (match) {
    return oneUrl(`/features/${match[1]}`, normalized, status);
  }

  if (normalized === "app/resources/page.tsx") {
    return oneUrl("/resources", normalized, status);
  }

  match = normalized.match(/^app\/resources\/([^/]+)\/page\.tsx$/);
  if (match) {
    return oneUrl(`/resources/${match[1]}`, normalized, status);
  }

  if (normalized === "app/solutions/freelancer-project-management-software/page.tsx") {
    return oneUrl("/solutions/freelancer-project-management-software", normalized, status);
  }

  match = normalized.match(/^app\/(about|contact|privacy|terms)\/page\.tsx$/);
  if (match) {
    return oneUrl(`/${match[1]}`, normalized, status);
  }

  if (normalized === "app/use-cases/page.tsx") {
    return oneUrl("/use-cases", normalized, status);
  }

  match = normalized.match(/^app\/lib\/use-cases\/cases\/[^/]+\.ts$/);
  if (match) {
    const slug = await readUseCaseSlug(path.resolve(normalized));
    if (!slug) {
      return reviewRequired(
        "REVIEW_REQUIRED",
        normalized,
        "Use-case data file did not expose a slug that can be mapped safely.",
      );
    }

    return oneUrl(`/use-cases/${slug}`, normalized, status);
  }

  if (
    normalized === "app/use-cases/[slug]/page.tsx" ||
    normalized === "app/lib/use-cases/index.ts" ||
    normalized === "app/lib/use-cases/types.ts" ||
    normalized.startsWith("app/components/use-cases/") ||
    normalized === "app/sitemap.ts" ||
    normalized === "app/robots.ts" ||
    normalized === "app/layout.tsx" ||
    normalized === "app/lib/site-config.ts" ||
    normalized === "app/lib/schema.ts" ||
    normalized === "next.config.ts"
  ) {
    return reviewRequired(
      "ALL_PUBLIC_SEO_URLS",
      normalized,
      "Shared/global SEO file may affect many URLs; explicit review is required before any real submission.",
    );
  }

  if (
    normalized.startsWith("app/api/") ||
    normalized.startsWith("app/auth/") ||
    normalized.startsWith("app/dashboard/") ||
    normalized.startsWith("app/admin/") ||
    normalized.startsWith("app/share/") ||
    normalized.startsWith("app/homepage-demo/") ||
    normalized.startsWith("lib/")
  ) {
    return noUrl(normalized);
  }

  return noUrl(normalized, "No deterministic public SEO URL mapping exists for this file.");
}

export async function mapChangedFiles(filePaths) {
  const results = [];

  for (const filePath of filePaths) {
    results.push(await classifyChangedFile(filePath));
  }

  return results;
}
