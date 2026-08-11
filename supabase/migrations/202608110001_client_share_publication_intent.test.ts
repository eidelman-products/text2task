import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608050001_client_share_owner_reads.test.ts
// and 202608060003_client_share_configuration_save.test.ts).
//
// IMPORTANT: nothing in this file proves these RPCs actually behave
// correctly against a real database. It proves only that the three new
// columns are declared correctly, that both extended functions keep
// their exact prior signature/security posture/grants, and that the
// new publication-intent fields are wired into the same validation,
// change-detection and output shape the existing settings fields use.
// Real PostgreSQL behavior (defaults on existing rows, atomic
// persistence, configuration_version increments, cross-tenant rejection,
// anon denial) is proven only by the disposable-project runtime package
// under docs/client-share-phase1c-runtime/, run by the user.
const MIGRATION_PATH = path.join(
  __dirname,
  "202608110001_client_share_publication_intent.sql"
);

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

const sql = readNormalized(MIGRATION_PATH);
const normalizedSql = sql.toLowerCase();

function stripLineComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

const code = stripLineComments(sql);
const normalizedCode = code.toLowerCase();

function stripCommentOnStatements(source: string): string {
  return source.replace(/comment on [\s\S]*?';/g, "");
}

const executable = stripCommentOnStatements(code);
const normalizedExecutable = executable.toLowerCase();

function normalizeWhitespace(source: string): string {
  return source.replace(/\s+/g, " ").trim();
}

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

const readBody = extractFunctionBody(code, "get_share_link_management_state");
const saveBody = extractFunctionBody(code, "save_share_configuration");
const normalizedWhitespaceReadBody = normalizeWhitespace(readBody);
const normalizedWhitespaceSaveBody = normalizeWhitespace(saveBody);

const NEW_COLUMNS = ["title_visible", "status_visible", "target_date_visible"] as const;
const NEW_JSON_KEYS = ["titleVisible", "statusVisible", "targetDateVisible"] as const;

describe("202608110001 - three new durable publication-intent columns", () => {
  it("adds exactly three new columns to project_share_links, each NOT NULL DEFAULT false", () => {
    expect(normalizeWhitespace(code)).toContain(
      normalizeWhitespace(
        `alter table public.project_share_links
          add column title_visible boolean not null default false,
          add column status_visible boolean not null default false,
          add column target_date_visible boolean not null default false;`
      )
    );
  });

  it.each(NEW_COLUMNS)("comments the %s column", (column) => {
    expect(code).toContain(`comment on column public.project_share_links.${column} is`);
  });

  it("never duplicates a project title/status/date VALUE column -- only visibility flags", () => {
    for (const forbidden of [
      "add column title ",
      "add column status ",
      "add column target_date ",
      "public_title",
      "public_status",
    ]) {
      expect(normalizedExecutable).not.toContain(forbidden);
    }
  });

  it("creates no new table", () => {
    expect(normalizedCode).not.toMatch(/create table/);
  });

  it("adds no new index, policy, trigger, grant table-privilege or RLS change", () => {
    expect(normalizedCode).not.toMatch(/create (unique )?index/);
    expect(normalizedCode).not.toMatch(/create policy/);
    expect(normalizedCode).not.toMatch(/create trigger/);
    expect(normalizedCode).not.toMatch(/row level security/);
    expect(normalizedCode).not.toMatch(/\bgrant\b[^;]*\bon table\b/);
  });

  it("contains exactly one ALTER TABLE statement, only adding columns", () => {
    const alters = code.match(/alter table[^;]*;/gi) ?? [];
    expect(alters).toHaveLength(1);
    for (const alterStatement of alters) {
      const lowerAlter = alterStatement.toLowerCase();
      expect(lowerAlter).toContain("add column");
      expect(lowerAlter).not.toContain("drop column");
      expect(lowerAlter).not.toContain("alter column");
    }
  });

  it("does not use IF NOT EXISTS (fail-closed schema-drift posture, matching every prior Client Share migration)", () => {
    expect(normalizedCode).not.toContain("if not exists");
  });
});

describe("202608110001 - get_share_link_management_state: extended read", () => {
  it("keeps the exact prior signature and returns jsonb", () => {
    expect(code).toContain(
      "create or replace function public.get_share_link_management_state(p_project_id uuid)\nreturns jsonb"
    );
  });

  it("is plpgsql, SECURITY INVOKER, with the exact locked search_path", () => {
    expect(readBody).toContain("language plpgsql");
    expect(readBody).toContain("security invoker");
    expect(readBody).toContain("set search_path = public, pg_temp");
    expect(readBody).not.toContain("security definer");
  });

  it("selects all three new columns from project_share_links", () => {
    expect(normalizedWhitespaceReadBody).toContain(
      normalizeWhitespace(
        "link.title_visible, link.status_visible, link.target_date_visible,"
      )
    );
  });

  it.each(NEW_JSON_KEYS)("returns %s as a real boolean value on the link object", (key) => {
    expect(readBody).toContain(`'${key}', v_`);
  });

  it("the managed link object contains exactly the allowlisted keys, including the three new flags", () => {
    const objectStart = readBody.indexOf("'link', jsonb_build_object(");
    const objectEnd = readBody.indexOf("),\n    'mappedTaskIds'", objectStart);
    const linkObject = readBody.slice(objectStart, objectEnd);
    const keys = [...linkObject.matchAll(/'([a-zA-Z]+)',/g)].map((m) => m[1]);
    expect(new Set(keys)).toEqual(
      new Set([
        "link",
        "id",
        "publicId",
        "state",
        "expiresAt",
        "hasPin",
        "commentsEnabled",
        "clientFacingSubtitle",
        "contentDirection",
        "titleVisible",
        "statusVisible",
        "targetDateVisible",
        "configurationVersion",
        "createdAt",
        "activatedAt",
        "disabledAt",
        "rotatedAt",
        "lastViewedAt",
        "viewCount",
      ])
    );
  });

  it("never returns a raw project title, status or date value -- only the three boolean flags", () => {
    for (const forbidden of ["project.title", "project.status", "project.deadline", "project.target_date"]) {
      expect(normalizedExecutable).not.toContain(forbidden);
    }
  });

  it("still raises UNAUTHORIZED and PROJECT_NOT_FOUND exactly as before", () => {
    expect(readBody).toContain("message = 'UNAUTHORIZED'");
    expect(readBody).toContain("message = 'PROJECT_NOT_FOUND'");
  });

  it("still never mutates view_count or last_viewed_at", () => {
    expect(normalizedWhitespaceReadBody).not.toContain("update public.project_share_links");
  });

  it("is revoked from public, anon and service_role, and granted only to authenticated", () => {
    expect(code).toContain(
      "revoke all on function public.get_share_link_management_state(uuid) from public;"
    );
    expect(code).toContain(
      "revoke all on function public.get_share_link_management_state(uuid) from anon;"
    );
    expect(code).toContain(
      "revoke all on function public.get_share_link_management_state(uuid) from service_role;"
    );
    expect(code).toContain(
      "grant execute on function public.get_share_link_management_state(uuid) to authenticated;"
    );
  });
});

describe("202608110001 - save_share_configuration: extended settings group", () => {
  it("keeps the exact prior signature and returns jsonb", () => {
    expect(code).toContain(
      "create or replace function public.save_share_configuration(\n  p_link_id uuid,\n  p_settings jsonb,\n  p_tasks jsonb,\n  p_resources jsonb,\n  p_publish_update jsonb\n)"
    );
  });

  it("is plpgsql, SECURITY DEFINER, with the exact locked search_path", () => {
    expect(saveBody).toContain("language plpgsql");
    expect(saveBody).toContain("security definer");
    expect(saveBody).toContain("set search_path = public, pg_temp");
    expect(saveBody).not.toContain("security invoker");
  });

  it("the settings allowlist check subtracts all six recognized keys", () => {
    expect(normalizedWhitespaceSaveBody).toContain(
      normalizeWhitespace(
        `p_settings
        - 'commentsEnabled' - 'clientFacingSubtitle' - 'contentDirection'
        - 'titleVisible' - 'statusVisible' - 'targetDateVisible'`
      )
    );
  });

  it.each(NEW_JSON_KEYS)(
    "validates %s as strictly boolean before use, rejecting non-boolean with INVALID_SETTINGS",
    (key) => {
      const marker = `p_settings ? '${key}'`;
      expect(saveBody).toContain(marker);
      const keyIndex = saveBody.indexOf(marker);
      const nearbyBlock = saveBody.slice(keyIndex, keyIndex + 400);
      expect(nearbyBlock).toContain(`jsonb_typeof(p_settings->'${key}') <> 'boolean'`);
      expect(nearbyBlock).toContain("message = 'INVALID_SETTINGS'");
    }
  );

  it("declares has-flags for all three new fields, defaulting to false like commentsEnabled", () => {
    expect(saveBody).toContain("v_has_title_visible boolean := false;");
    expect(saveBody).toContain("v_has_status_visible boolean := false;");
    expect(saveBody).toContain("v_has_target_date_visible boolean := false;");
  });

  it("fetches the three prior values under the same FOR UPDATE lock as the existing settings fields", () => {
    expect(normalizedWhitespaceSaveBody).toContain(
      normalizeWhitespace(
        `link.title_visible,
      link.status_visible,
      link.target_date_visible`
      )
    );
    expect(normalizedWhitespaceSaveBody).toContain("for update;");
  });

  it("the settings-changed expression includes all three new flags via IS DISTINCT FROM", () => {
    expect(normalizedWhitespaceSaveBody).toContain(
      normalizeWhitespace(
        "or (v_has_title_visible and v_title_visible is distinct from v_old_title_visible)"
      )
    );
    expect(normalizedWhitespaceSaveBody).toContain(
      normalizeWhitespace(
        "or (v_has_status_visible and v_status_visible is distinct from v_old_status_visible)"
      )
    );
    expect(normalizedWhitespaceSaveBody).toContain(
      normalizeWhitespace(
        "or (v_has_target_date_visible and v_target_date_visible is distinct from v_old_target_date_visible)"
      )
    );
  });

  it("the UPDATE statement writes all three new columns using the same omitted-means-unchanged CASE pattern", () => {
    for (const [column, hasFlag, value] of [
      ["title_visible", "v_has_title_visible", "v_title_visible"],
      ["status_visible", "v_has_status_visible", "v_status_visible"],
      ["target_date_visible", "v_has_target_date_visible", "v_target_date_visible"],
    ]) {
      expect(normalizedWhitespaceSaveBody).toContain(
        normalizeWhitespace(
          `${column} = case when ${hasFlag} then ${value} else ${column} end,`
        )
      );
    }
  });

  it("configuration_version still increases by exactly one statement, only inside the v_settings_changed branch", () => {
    const bumpOccurrences =
      saveBody.match(/v_new_configuration_version := v_link_configuration_version \+ 1;/g) ?? [];
    expect(bumpOccurrences).toHaveLength(1);
  });

  it("does not add or alter task/resource/update-publication behavior", () => {
    expect(normalizedWhitespaceSaveBody).toContain(
      "delete from public.share_link_tasks"
    );
    expect(normalizedWhitespaceSaveBody).toContain(
      "delete from public.share_link_resources"
    );
    expect(normalizedWhitespaceSaveBody).toContain(
      "insert into public.share_link_updates"
    );
  });

  it("never writes to share_link_events, share_browser_sessions or share_session_grants", () => {
    expect(normalizedExecutable).not.toContain("share_link_events");
    expect(normalizedExecutable).not.toContain("share_browser_sessions");
    expect(normalizedExecutable).not.toContain("share_session_grants");
  });

  it("never touches public_id, secret_digest, PIN material or lifecycle timestamps", () => {
    for (const forbidden of [
      "public_id =",
      "secret_digest =",
      "pin_hash =",
      "activated_at =",
      "disabled_at =",
      "rotated_at =",
      "revoked_at =",
    ]) {
      expect(normalizedWhitespaceSaveBody).not.toContain(forbidden);
    }
  });

  it("is revoked from public, anon and service_role, and granted only to authenticated", () => {
    expect(code).toContain(
      "revoke all on function public.save_share_configuration(uuid, jsonb, jsonb, jsonb, jsonb)\n  from public;"
    );
    expect(code).toContain(
      "revoke all on function public.save_share_configuration(uuid, jsonb, jsonb, jsonb, jsonb)\n  from anon;"
    );
    expect(code).toContain(
      "revoke all on function public.save_share_configuration(uuid, jsonb, jsonb, jsonb, jsonb)\n  from service_role;"
    );
    expect(code).toContain(
      "grant execute on function public.save_share_configuration(uuid, jsonb, jsonb, jsonb, jsonb)\n  to authenticated;"
    );
  });
});

describe("202608110001 - no separate per-flag RPCs, no signature drift", () => {
  it("defines exactly two functions in this migration", () => {
    const defs = code.match(/^create or replace function public\.[a-z_]+\(/gm) ?? [];
    expect(defs).toHaveLength(2);
  });

  it("does not create save_title_visibility, save_status_visibility or save_target_date_visibility", () => {
    for (const forbidden of [
      "save_title_visibility",
      "save_status_visibility",
      "save_target_date_visibility",
      "set_title_visible",
      "set_status_visible",
      "set_target_date_visible",
    ]) {
      expect(normalizedCode).not.toContain(forbidden);
    }
  });

  it("does not touch list_share_link_summaries", () => {
    expect(normalizedCode).not.toContain("list_share_link_summaries");
  });
});

describe("202608110001 - production-safety and forward-only posture", () => {
  it("does not define a down/rollback migration", () => {
    expect(normalizedSql).not.toMatch(/^-- down/m);
    expect(normalizedCode).not.toMatch(/\brollback\b/);
  });

  it("contains no dynamic SQL", () => {
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+'/);
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+format\(/);
  });

  it("grants nothing to anon anywhere", () => {
    expect(normalizedCode).not.toMatch(/\bgrant\b[^;]*\banon\b/);
  });

  it("both functions comment on themselves", () => {
    expect(code).toContain("comment on function public.get_share_link_management_state(uuid) is");
    expect(code).toContain(
      "comment on function public.save_share_configuration(uuid, jsonb, jsonb, jsonb, jsonb) is"
    );
  });
});
