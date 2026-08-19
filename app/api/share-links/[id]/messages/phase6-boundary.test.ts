import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Phase 5C hard boundary (static, source-level -- no live DB, no
 * imports): proves the owner communication routes contain no reference
 * to Phase 6's own tables/columns/status value in EXECUTABLE code.
 * Comment-stripped first (mirroring the same `code` vs
 * `normalizedExecutable` distinction the migration/repository tests
 * already draw) -- these routes' own doc comments legitimately NAME
 * `converted`/timeline/update tables while explaining they are excluded,
 * which must not itself fail the check.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const ROUTE_FILES = [
  "route.ts",
  "reply/route.ts",
  "[messageId]/route.ts",
] as const;

describe("Phase 6 boundary -- owner communication routes (app/api/share-links/[id]/messages/**)", () => {
  it.each(ROUTE_FILES)("%s never references share_message_conversions/project_updates/project_timeline_events in executable code", (relativePath) => {
    const source = readFileSync(join(__dirname, relativePath), "utf8");
    const executable = stripComments(source);

    for (const forbidden of ["share_message_conversions", "project_updates", "project_timeline_events"]) {
      expect(executable).not.toContain(forbidden);
    }
  });

  it.each(ROUTE_FILES)("%s never sends status='converted' as a value anywhere in executable code", (relativePath) => {
    const source = readFileSync(join(__dirname, relativePath), "utf8");
    const executable = stripComments(source);

    expect(executable).not.toContain("converted");
  });

  it.each(ROUTE_FILES)("%s performs no task/subtask/project-status/CRM mutation call", (relativePath) => {
    const source = readFileSync(join(__dirname, relativePath), "utf8");
    const executable = stripComments(source);

    expect(executable).not.toMatch(/\.from\(\s*["'`]tasks["'`]/);
    expect(executable).not.toMatch(/\.from\(\s*["'`]subtasks["'`]/);
    expect(executable).not.toMatch(/\.from\(\s*["'`]projects["'`]/);
  });

  it.each(ROUTE_FILES)("%s never imports an email or AI-analysis module", (relativePath) => {
    const source = readFileSync(join(__dirname, relativePath), "utf8");

    expect(source).not.toMatch(/from ["'@].*\/(email|mail|smtp)/i);
    expect(source).not.toMatch(/from ["'@].*\/(ai|llm|analysis)/i);
  });
});
