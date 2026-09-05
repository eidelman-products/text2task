import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching 202607290001_calendar_events.test.ts's own
// established convention exactly.
const MIGRATION_PATH = path.join(__dirname, "202607310001_calendar_events_custom_names.sql");

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

const sql = readNormalized(MIGRATION_PATH);

function extractFunctionBody(source: string, functionName: string): string {
  const startMarker = `create or replace function public.${functionName}(`;
  const startIndex = source.indexOf(startMarker);

  if (startIndex === -1) {
    throw new Error(`Could not find function ${functionName} in migration`);
  }

  const endMarker = "\n$$;";
  const endIndex = source.indexOf(endMarker, startIndex);

  if (endIndex === -1) {
    throw new Error(`Could not find end of function ${functionName}`);
  }

  return source.slice(startIndex, endIndex + endMarker.length);
}

describe("202607310001_calendar_events_custom_names.sql - columns", () => {
  it("adds both nullable text columns, idempotently", () => {
    expect(sql).toContain("add column if not exists custom_project_name text null");
    expect(sql).toContain("add column if not exists custom_client_name text null");
  });

  it("does not define a down/rollback migration (forward-only, matching repo convention)", () => {
    expect(sql.toLowerCase()).not.toMatch(/^-- down/m);
    expect(sql.toLowerCase()).not.toMatch(/\brollback\b/);
  });

  it("never alters, drops, or updates rows in projects/tasks/clients, and never drops a column", () => {
    expect(sql.toLowerCase()).not.toMatch(/alter table public\.projects\b/);
    expect(sql.toLowerCase()).not.toMatch(/alter table public\.tasks\b/);
    expect(sql.toLowerCase()).not.toMatch(/alter table public\.clients\b/);
    expect(sql.toLowerCase()).not.toMatch(/update public\.projects\b/);
    expect(sql.toLowerCase()).not.toMatch(/update public\.tasks\b/);
    expect(sql.toLowerCase()).not.toMatch(/update public\.clients\b/);
    expect(sql.toLowerCase()).not.toMatch(/drop table\b/);
    expect(sql.toLowerCase()).not.toMatch(/drop column\b/);
  });

  it("touches only public.calendar_events (plus the function/trigger it owns)", () => {
    expect(sql).not.toMatch(/alter table public\.(projects|clients|tasks)\b/);
  });
});

describe("202607310001 - mutual-exclusivity and length constraints", () => {
  it("rejects a project_id and a custom_project_name both non-null", () => {
    expect(sql).toContain("constraint calendar_events_project_exclusivity_check");
    expect(sql).toContain("check (project_id is null or custom_project_name is null)");
  });

  it("rejects a client_id and a custom_client_name both non-null", () => {
    expect(sql).toContain("constraint calendar_events_client_exclusivity_check");
    expect(sql).toContain("check (client_id is null or custom_client_name is null)");
  });

  it("enforces a non-blank, <=240-character custom_project_name when present", () => {
    expect(sql).toContain("constraint calendar_events_custom_project_name_check");
    expect(sql).toContain(
      "char_length(trim(custom_project_name)) >= 1 and char_length(custom_project_name) <= 240"
    );
  });

  it("enforces a non-blank, <=240-character custom_client_name when present", () => {
    expect(sql).toContain("constraint calendar_events_custom_client_name_check");
    expect(sql).toContain(
      "char_length(trim(custom_client_name)) >= 1 and char_length(custom_client_name) <= 240"
    );
  });

  it("mirrors calendar_events_title_check's own 240-character limit rather than inventing a different number", () => {
    // The original migration's own title check, for direct comparison --
    // confirms 240 is reused, not coincidentally similar.
    const titleCheckLimit = /char_length\(title\) <= (\d+)/.exec(
      readNormalized(path.join(__dirname, "202607290001_calendar_events.sql"))
    );
    expect(titleCheckLimit?.[1]).toBe("240");
  });
});

describe("202607310001 - relationship trigger redefinition", () => {
  const body = extractFunctionBody(
    sql,
    "enforce_calendar_event_relationship_integrity"
  );

  it("forces both custom names to null whenever a project is linked", () => {
    expect(body).toContain("new.custom_project_name := null;");
    expect(body).toContain("new.custom_client_name := null;");
  });

  it("still normalizes client_id to the linked project's own client_id (unchanged from the original migration)", () => {
    expect(body).toContain("new.client_id := v_project_client_id;");
  });

  it("forces custom_client_name to null whenever a client is linked (independently of a project)", () => {
    const clientBlock = body.slice(body.indexOf("if new.client_id is not null then"));
    expect(clientBlock).toContain("new.custom_client_name := null;");
  });

  it("preserves the original migration's relationship-changed guard (only re-derives on insert or an actual project_id/client_id change)", () => {
    expect(body).toContain("if tg_op = 'INSERT' then");
    expect(body).toContain(
      "new.project_id is distinct from old.project_id\n      or new.client_id is distinct from old.client_id;"
    );
  });

  it("preserves the repository's standard security posture (security invoker + explicit search_path)", () => {
    expect(body).toContain("security invoker");
    expect(body).toContain("set search_path = public, pg_temp");
  });

  it("never modifies user_id", () => {
    expect(body).not.toMatch(/new\.user_id\s*:?=/);
  });

  it("is re-wired via create or replace, not a second competing trigger definition", () => {
    // The original migration's own trigger-creation statement is the single
    // source of truth for wiring -- this migration only redefines the
    // function body, it must never also re-create the trigger itself.
    expect(sql).not.toMatch(/create trigger calendar_events_enforce_relationship_integrity/);
  });
});
