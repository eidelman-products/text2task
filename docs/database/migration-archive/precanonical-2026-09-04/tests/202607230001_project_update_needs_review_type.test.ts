import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection. It asserts the migration file on disk both preserves every
// previously allowed public.project_update_items.type value and adds
// needs_review, and follows the mandated safe constraint-swap sequence.
const MIGRATION_PATH = path.join(
  __dirname,
  "202607230001_project_update_needs_review_type.sql"
);

const PREVIOUSLY_ALLOWED_TYPES = [
  "new_subtask",
  "update_subtask",
  "deadline_change",
  "budget_change",
  "priority_change",
  "status_change",
  "client_detail_change",
  "project_note",
  "client_note",
  "duplicate_warning",
  "no_action",
];

describe("202607230001_project_update_needs_review_type.sql", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("preserves every previously allowed project_update_items.type value", () => {
    for (const type of PREVIOUSLY_ALLOWED_TYPES) {
      expect(sql).toContain(`'${type}'`);
    }
  });

  it("adds needs_review to the allowed type values", () => {
    expect(sql).toContain("'needs_review'");
  });

  it("targets the real project_update_items table and its real type check constraint", () => {
    expect(sql).toContain("public.project_update_items");
    expect(sql).toContain("project_update_items_type_check");
  });

  it("follows the safe add-validate-drop-rename constraint swap sequence", () => {
    const addIndex = sql.indexOf("add constraint project_update_items_type_check_new");
    const validateIndex = sql.indexOf(
      "validate constraint project_update_items_type_check_new"
    );
    const dropIndex = sql.indexOf("drop constraint project_update_items_type_check;");
    const renameIndex = sql.indexOf(
      "rename constraint project_update_items_type_check_new to project_update_items_type_check"
    );

    expect(addIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeGreaterThan(addIndex);
    expect(dropIndex).toBeGreaterThan(validateIndex);
    expect(renameIndex).toBeGreaterThan(dropIndex);

    // The replacement constraint must be added NOT VALID and explicitly
    // validated in its own statement -- never silently skipped.
    expect(sql).toMatch(/add constraint project_update_items_type_check_new[\s\S]*?not valid;/);
  });

  it("does not backfill or reclassify historical rows", () => {
    expect(sql.toLowerCase()).not.toMatch(/^\s*update\s+public\.project_update_items/m);
  });

  it("documents that historical duplicate_warning rows are intentionally left unchanged", () => {
    expect(sql.toLowerCase()).toContain("duplicate_warning");
    expect(sql.toLowerCase()).toContain("backfill");
  });
});
