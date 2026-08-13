import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608030004_client_share_session_foundation.test.ts).
//
// SQL text inspection cannot prove the atomic-increment BEHAVIOUR (real
// concurrency safety) at runtime. The disposable runtime verification
// package under docs/client-share-phase3-rate-limit-runtime/ -- including
// its true-concurrency Node runner -- is what must prove that, against an
// isolated database, before this function is relied upon.
const MIGRATION_PATH = path.join(
  __dirname,
  "202608130001_client_share_rate_limit_increment.sql"
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

const FUNCTION_SIGNATURE =
  "public.increment_share_rate_limit_bucket(text, text, text, smallint, uuid, integer)";

function extractFunctionBody(source: string): string {
  const startMarker = "create or replace function public.increment_share_rate_limit_bucket(";
  const startIndex = source.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error("Could not find increment_share_rate_limit_bucket function definition");
  }
  const endMarker = "\n$$;";
  const endIndex = source.indexOf(endMarker, startIndex);
  if (endIndex === -1) {
    throw new Error("Could not find end of increment_share_rate_limit_bucket function body");
  }
  return source.slice(startIndex, endIndex + endMarker.length);
}

const functionBlock = extractFunctionBody(code);

describe("202608130001 - additive only, fail closed", () => {
  it("never uses `create table`, `alter table` or `create table if not exists`", () => {
    expect(normalizedCode).not.toMatch(/create table/);
    expect(normalizedCode).not.toMatch(/alter table/);
  });

  it("touches no existing production or Client Share table definition", () => {
    for (const table of [
      "projects",
      "tasks",
      "clients",
      "task_resources",
      "project_updates",
      "project_timeline_events",
      "project_share_links",
      "share_link_tasks",
      "share_link_resources",
      "share_link_updates",
      "share_messages",
      "share_message_conversions",
      "share_browser_sessions",
      "share_session_grants",
      "share_link_events",
      "project_share_secret_material",
    ]) {
      expect(normalizedCode).not.toMatch(new RegExp(`alter table public\\.${table}\\b`));
      expect(normalizedCode).not.toMatch(new RegExp(`create table public\\.${table}\\b`));
    }
  });

  it("drops no table, column, constraint, index or function", () => {
    expect(normalizedCode).not.toMatch(/drop table\b/);
    expect(normalizedCode).not.toMatch(/drop column\b/);
    expect(normalizedCode).not.toMatch(/drop constraint\b/);
    expect(normalizedCode).not.toMatch(/drop index\b/);
    expect(normalizedCode).not.toMatch(/drop function\b/);
  });

  it("performs no insert, update or delete outside the function body's own single statement", () => {
    // Only one INSERT statement should exist in the entire migration, and
    // it must be the one inside the function body (asserted separately
    // below) -- no top-level DML anywhere in the migration file itself.
    const insertCount = (normalizedCode.match(/\binsert into\b/g) ?? []).length;
    expect(insertCount).toBe(1);
    expect(normalizedCode).not.toMatch(/^\s*update public\./m);
    expect(normalizedCode).not.toMatch(/^\s*delete from/m);
  });

  it("does not define a down/rollback migration (forward-only, matching repo convention)", () => {
    expect(normalizedSql).not.toMatch(/^-- down/m);
    expect(normalizedCode).not.toMatch(/\brollback\b/);
  });

  it("uses `create or replace function` only for its own new function", () => {
    const createOrReplaceMatches = code.match(/create or replace function[^(]*\(/g) ?? [];
    expect(createOrReplaceMatches).toHaveLength(1);
    expect(createOrReplaceMatches[0]).toContain(
      "public.increment_share_rate_limit_bucket"
    );
  });
});

describe("202608130001 - function exists with the exact expected signature", () => {
  it("defines public.increment_share_rate_limit_bucket with exactly these parameters, in order", () => {
    expect(code).toContain(
      "create or replace function public.increment_share_rate_limit_bucket(\n  p_scope text,\n  p_action text,\n  p_identity_digest text,\n  p_identity_digest_version smallint,\n  p_share_link_id uuid,\n  p_window_seconds integer\n)"
    );
  });

  it("returns jsonb", () => {
    expect(functionBlock).toMatch(/\)\s*\nreturns jsonb\n/);
  });

  it("uses the exact underlying SQL types the table itself uses for the equivalent columns (not re-derived types)", () => {
    // identity_digest: text; identity_digest_version: smallint;
    // share_link_id: uuid; window_seconds: integer -- exactly matching
    // public.share_rate_limit_buckets' own column types
    // (202608030004_client_share_session_foundation.sql).
    expect(code).toContain("p_identity_digest text");
    expect(code).toContain("p_identity_digest_version smallint");
    expect(code).toContain("p_share_link_id uuid");
    expect(code).toContain("p_window_seconds integer");
  });
});

describe("202608130001 - SECURITY DEFINER hardening", () => {
  it("is SECURITY DEFINER, not SECURITY INVOKER", () => {
    expect(functionBlock).toMatch(/\nsecurity definer\n/);
    expect(functionBlock).not.toMatch(/\nsecurity invoker\n/);
  });

  it("sets an explicit safe search_path", () => {
    expect(functionBlock).toContain("set search_path = public, pg_temp");
  });

  it("contains no dynamic SQL", () => {
    expect(normalizedCode).not.toMatch(/\bexecute\s+format\b/);
    expect(normalizedCode).not.toMatch(/\bexecute\s+'/);
    expect(normalizedCode).not.toContain("execute immediate");
  });

  it("fully qualifies every reference to the rate-limit table with the public schema", () => {
    const unqualified = functionBlock.match(/[^.]\bshare_rate_limit_buckets\b/g) ?? [];
    for (const match of unqualified) {
      // Every occurrence must be immediately preceded by "public." --
      // this regex intentionally allows a leading space/newline/paren
      // before "public." itself, so we assert on the wider context
      // instead of a bare match.
      expect(match).not.toBe(" share_rate_limit_buckets");
    }
    expect(functionBlock).not.toMatch(/(?<!public\.)\bshare_rate_limit_buckets\b/);
  });
});

describe("202608130001 - privilege model: service_role only", () => {
  it("revokes execute from public, anon and authenticated", () => {
    expect(code).toContain(
      `revoke all on function ${FUNCTION_SIGNATURE}\n  from public;`
    );
    expect(code).toContain(
      `revoke all on function ${FUNCTION_SIGNATURE}\n  from anon;`
    );
    expect(code).toContain(
      `revoke all on function ${FUNCTION_SIGNATURE}\n  from authenticated;`
    );
  });

  it("revokes-then-grants service_role (defense in depth), never skipping the revoke", () => {
    expect(code).toContain(
      `revoke all on function ${FUNCTION_SIGNATURE}\n  from service_role;`
    );
    expect(code).toContain(
      `grant execute on function ${FUNCTION_SIGNATURE}\n  to service_role;`
    );
  });

  it("grants execute to service_role only -- never to authenticated or anon anywhere in the migration", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    expect(grants).toHaveLength(1);
    expect(grants[0]).toContain("to service_role;");
    expect(normalizedCode).not.toMatch(/\bgrant\b[^;]*\banon\b/);
    expect(normalizedCode).not.toMatch(/\bgrant\b[^;]*\bauthenticated\b/);
  });

  it("never grants ALL, TRUNCATE, TRIGGER or REFERENCES", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    for (const grant of grants) {
      expect(grant.toLowerCase()).not.toMatch(/^grant\s+all\b/);
      expect(grant.toLowerCase()).not.toMatch(/\btruncate\b/);
      expect(grant.toLowerCase()).not.toMatch(/\btrigger\b/);
      expect(grant.toLowerCase()).not.toMatch(/\breferences\b/);
    }
  });
});

describe("202608130001 - atomic upsert-and-increment", () => {
  it("performs exactly one INSERT ... ON CONFLICT ... DO UPDATE against the rate-limit table -- never a SELECT-then-UPDATE pair", () => {
    expect(functionBlock).toContain("insert into public.share_rate_limit_buckets (");
    expect(functionBlock).toContain("on conflict on constraint share_rate_limit_buckets_identity_unique");
    expect(functionBlock).toContain("do update set");
    expect(normalizedCode).not.toMatch(/\bselect\b[^;]*\brequest_count\b[^;]*\binto\b/);
  });

  it("increments strictly as request_count = request_count + 1, referencing the table's own current value", () => {
    expect(functionBlock).toContain(
      "request_count = public.share_rate_limit_buckets.request_count + 1,"
    );
  });

  it("uses the EXACT existing named unique constraint as the conflict target, never a re-derived column list", () => {
    expect(functionBlock).toContain(
      "on conflict on constraint share_rate_limit_buckets_identity_unique"
    );
    // Never re-lists the bucket-identity columns as an inline ON CONFLICT
    // target -- that would silently drift from the table's own real
    // unique constraint if it were ever changed there but not here.
    expect(functionBlock).not.toMatch(
      /on conflict\s*\(\s*scope\s*,\s*action\s*,\s*identity_digest/
    );
  });

  it("advances updated_at on every increment, using the table's own mutable-row convention", () => {
    expect(functionBlock).toContain("updated_at = now()");
  });

  it("never performs a bare UPDATE statement against the table (the increment happens only inside the single atomic upsert)", () => {
    expect(normalizedCode).not.toMatch(/^\s*update public\.share_rate_limit_buckets/m);
  });

  it("uses no advisory lock and no process-local/session state as a substitute for the atomic statement", () => {
    expect(normalizedCode).not.toMatch(/pg_advisory/);
    expect(normalizedCode).not.toMatch(/pg_try_advisory/);
  });
});

describe("202608130001 - window_start / expires_at are server-computed, never caller-supplied", () => {
  it("accepts no p_window_start or p_expires_at parameter at all", () => {
    expect(normalizedCode).not.toContain("p_window_start");
    expect(normalizedCode).not.toContain("p_expires_at");
  });

  it("computes window_start as a deterministic fixed-window floor of now(), inside the function", () => {
    expect(functionBlock).toContain("v_now timestamptz := now();");
    expect(functionBlock).toContain(
      "v_window_start := to_timestamp(\n    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds\n  );"
    );
  });

  it("computes expires_at from window_start + window_seconds, matching the table's own expiry semantics exactly", () => {
    expect(functionBlock).toContain(
      "v_expires_at := v_window_start + (p_window_seconds * interval '1 second');"
    );
  });

  it("inserts the locally computed window_start/expires_at values, never a caller-supplied one", () => {
    // The VALUES list must reference the local v_window_start/v_expires_at
    // variables, not any parameter.
    expect(functionBlock).toMatch(/values\s*\(\s*p_scope,\s*p_action,\s*p_identity_digest,\s*p_identity_digest_version,\s*p_share_link_id,\s*v_window_start,\s*p_window_seconds,\s*1,\s*v_expires_at\s*\)/);
  });
});

describe("202608130001 - input validation mirrors the existing table contract exactly, never a redeclared vocabulary", () => {
  it("accepts only the table's own closed scope vocabulary", () => {
    expect(functionBlock).toContain(
      "p_scope not in ('browser_session', 'network_identity', 'share_link')"
    );
  });

  it("accepts only the table's own closed action vocabulary", () => {
    expect(functionBlock).toContain("p_action not in (\n      'session_exchange',\n      'pin_verification',\n      'projection_read',\n      'comment_submission',\n      'file_access',\n      'invalid_link_access'\n    )");
  });

  it("accepts only the table's own bounded window_seconds vocabulary (60, 300, 3600, 86400) and rejects anything else", () => {
    expect(functionBlock).toContain(
      "p_window_seconds not in (60, 300, 3600, 86400)"
    );
  });

  it("validates identity_digest against the table's own exact hex-64 format", () => {
    expect(functionBlock).toContain("p_identity_digest !~ '^[0-9a-f]{64}$'");
  });

  it("validates identity_digest_version is positive, matching the table's own check", () => {
    expect(functionBlock).toContain("p_identity_digest_version <= 0");
  });

  it("requires a share_link_id when scope is share_link, mirroring share_rate_limit_buckets_share_link_scope_check", () => {
    expect(functionBlock).toContain(
      "p_scope = 'share_link' and p_share_link_id is null"
    );
  });

  it("forbids a share_link_id when action is invalid_link_access, mirroring share_rate_limit_buckets_invalid_link_action_check", () => {
    expect(functionBlock).toContain(
      "p_action = 'invalid_link_access' and p_share_link_id is not null"
    );
  });

  it("raises a stable P0001 code for every validation failure, never a raw/unhandled error", () => {
    const raiseStatements = functionBlock.match(/raise exception using errcode = '[^']*', message = '[^']*';/g) ?? [];
    expect(raiseStatements.length).toBeGreaterThanOrEqual(7);
    for (const statement of raiseStatements) {
      expect(statement).toContain("errcode = 'P0001'");
    }
  });
});

describe("202608130001 - return contract is small and operational-only", () => {
  it("returns exactly requestCount, windowStart, windowSeconds, expiresAt", () => {
    expect(functionBlock).toContain(
      "return jsonb_build_object(\n    'requestCount', v_request_count,\n    'windowStart', v_window_start,\n    'windowSeconds', p_window_seconds,\n    'expiresAt', v_expires_at\n  );"
    );
  });

  it("never returns the identity digest, the share link id, an internal bucket id, or an allowed/threshold verdict", () => {
    const returnBlockMatch = functionBlock.match(/return jsonb_build_object\([\s\S]*?\);/);
    expect(returnBlockMatch).not.toBeNull();
    const returnBlock = returnBlockMatch?.[0] ?? "";
    for (const forbidden of [
      "identityDigest",
      "shareLinkId",
      "'id'",
      "allowed",
      "threshold",
      "limit",
    ]) {
      expect(returnBlock).not.toContain(forbidden);
    }
  });
});

describe("202608130001 - historical migrations remain untouched", () => {
  it("this migration file itself never mentions or redefines an existing Client Share function", () => {
    for (const existingFunction of [
      "enforce_project_share_link_integrity",
      "enforce_share_link_task_integrity",
      "enforce_share_link_resource_integrity",
      "enforce_share_link_update_integrity",
      "enforce_share_message_integrity",
      "enforce_share_message_conversion_integrity",
      "enforce_share_browser_session_integrity",
      "enforce_share_session_grant_integrity",
      "get_share_link_management_state",
      "list_share_link_summaries",
      "create_share_link_draft",
      "activate_share_link",
      "disable_share_link",
      "reenable_share_link",
      "set_share_link_pin",
      "clear_share_link_pin",
      "set_share_link_expiry",
      "clear_share_link_expiry",
      "rotate_share_link_secret",
      "revoke_share_link",
      "reveal_share_link_secret",
      "save_share_configuration",
      "set_client_share_updated_at",
    ]) {
      expect(normalizedCode).not.toContain(existingFunction.toLowerCase());
    }
  });
});
