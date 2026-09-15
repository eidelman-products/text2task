import { CANONICAL_HOST, SITE_ORIGIN } from "./indexnow-config.mjs";
import { canonicalUrlFromPath } from "./public-url-inventory.mjs";

const PRIVATE_PREFIXES = [
  "/api",
  "/app",
  "/auth",
  "/dashboard",
  "/admin",
  "/share",
  "/homepage-demo",
  "/login",
  "/signup",
  "/check-email",
  "/forgot-password",
  "/reset-password",
];

const ASSET_PREFIXES = ["/_next", "/landing"];
const ASSET_EXTENSIONS = /\.(?:avif|css|gif|ico|jpeg|jpg|js|json|map|mp4|pdf|png|svg|txt|webp|woff2?)$/i;
const REDIRECT_ALIASES = new Set(["/pricing", "/index.html"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizePathname(pathname) {
  if (!pathname || pathname === "") {
    return "/";
  }

  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/+$/, "")
    : withLeadingSlash;
}

export function isPrivateOrSensitivePath(pathname) {
  const normalized = normalizePathname(pathname);

  return PRIVATE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export function isAssetPath(pathname) {
  const normalized = normalizePathname(pathname);

  return (
    ASSET_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    ) || ASSET_EXTENSIONS.test(normalized)
  );
}

export function safeDisplayUrl(value) {
  try {
    const url = value.startsWith("/")
      ? new URL(value, SITE_ORIGIN)
      : new URL(value);
    const pathname = normalizePathname(url.pathname);

    if (isPrivateOrSensitivePath(pathname)) {
      const prefix = PRIVATE_PREFIXES.find(
        (candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`),
      );
      return `[private-url-redacted:${prefix ?? "sensitive"}]`;
    }

    return `${url.origin}${pathname}`;
  } catch {
    return "[invalid-url]";
  }
}

export function validateIndexNowUrl(value, sitemapUrls, options = {}) {
  const sitemapSet = sitemapUrls instanceof Set ? sitemapUrls : new Set(sitemapUrls);

  let url;
  try {
    url = value.startsWith("/") ? new URL(value, SITE_ORIGIN) : new URL(value);
  } catch {
    return reject(value, "INVALID_URL");
  }

  const pathname = normalizePathname(url.pathname);

  if (url.protocol !== "https:") {
    return reject(value, "NON_HTTPS_URL");
  }

  if (LOCAL_HOSTS.has(url.hostname)) {
    return reject(value, "LOCALHOST_URL");
  }

  if (url.hostname.endsWith(".vercel.app")) {
    return reject(value, "VERCEL_PREVIEW_HOST");
  }

  if (url.origin !== SITE_ORIGIN || url.host !== CANONICAL_HOST) {
    return reject(value, "NON_CANONICAL_HOST");
  }

  if (url.search) {
    return reject(value, "QUERY_STRING_REJECTED");
  }

  if (url.hash) {
    return reject(value, "FRAGMENT_REJECTED");
  }

  if (isPrivateOrSensitivePath(pathname)) {
    return reject(value, "PRIVATE_OR_NOINDEX_PATH");
  }

  if (isAssetPath(pathname)) {
    return reject(value, "ASSET_URL_REJECTED");
  }

  if (REDIRECT_ALIASES.has(pathname)) {
    return reject(value, "REDIRECT_ALIAS_REJECTED");
  }

  const canonicalUrl = canonicalUrlFromPath(pathname);

  if (!options.allowDeletedUrl && !sitemapSet.has(canonicalUrl)) {
    return reject(value, "NOT_IN_SITEMAP_ALLOWLIST");
  }

  return {
    ok: true,
    input: value,
    url: canonicalUrl,
    pathname,
  };
}

function reject(value, reason) {
  return {
    ok: false,
    input: safeDisplayUrl(value),
    reason,
  };
}

export function validateAndDedupeUrls(values, sitemapUrls, options = {}) {
  const accepted = [];
  const rejected = [];
  const seen = new Set();
  let duplicateCount = 0;

  for (const value of values) {
    const result = validateIndexNowUrl(value, sitemapUrls, options);

    if (!result.ok) {
      rejected.push(result);
      continue;
    }

    if (seen.has(result.url)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(result.url);
    accepted.push(result.url);
  }

  return { accepted, rejected, duplicateCount };
}
