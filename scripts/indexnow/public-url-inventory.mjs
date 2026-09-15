import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SITE_ORIGIN } from "./indexnow-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SITEMAP_PATH = path.join(REPO_ROOT, "app/sitemap.ts");
const USE_CASES_DIR = path.join(REPO_ROOT, "app/lib/use-cases/cases");

function normalizePathname(pathname) {
  if (pathname === "") {
    return "/";
  }

  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/+$/, "")
    : withLeadingSlash;
}

export function canonicalUrlFromPath(pathname) {
  return new URL(normalizePathname(pathname), SITE_ORIGIN).toString();
}

export async function getUseCaseSlugs() {
  const files = await readdir(USE_CASES_DIR);
  const slugs = [];

  for (const file of files.filter((entry) => entry.endsWith(".ts")).sort()) {
    const source = await readFile(path.join(USE_CASES_DIR, file), "utf8");
    const match = source.match(/"slug"\s*:\s*"([^"]+)"/);

    if (match) {
      slugs.push(match[1]);
    }
  }

  return slugs.sort();
}

export async function getSitemapPathnames() {
  const sitemapSource = await readFile(SITEMAP_PATH, "utf8");
  const paths = new Set();

  for (const match of sitemapSource.matchAll(/absoluteUrl\("([^"]+)"\)/g)) {
    paths.add(normalizePathname(match[1]));
  }

  for (const match of sitemapSource.matchAll(/path:\s*"([^"]+)"/g)) {
    paths.add(normalizePathname(match[1]));
  }

  for (const slug of await getUseCaseSlugs()) {
    paths.add(`/use-cases/${slug}`);
  }

  return [...paths].sort((first, second) => {
    if (first === "/") return -1;
    if (second === "/") return 1;
    return first.localeCompare(second);
  });
}

export async function getSitemapUrls() {
  return (await getSitemapPathnames()).map(canonicalUrlFromPath);
}
