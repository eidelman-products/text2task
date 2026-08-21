import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608030005_client_share_integrity_and_security.test.ts).
//
// IMPORTANT: nothing in this file proves runtime behaviour (that the
// trigger actually fires, that a hard delete actually fails, that the
// unique index actually rejects a second row) against a real Postgres
// engine. It proves only that the migration declares exactly the
// structural contract the Phase 6 Accepted Plan locks: the column, its
// FK delete action, the partial unique index, the coupling CHECK, the
// trigger's security posture and wiring, and that Phase 6A opened no new
// write surface elsewhere. Runtime verification against a disposable
// Postgres instance is a later, separately-tracked step -- not faked
// here.
const MIGRATION_PATH = path.join(
  __dirname,
  "202608210001_client_share_project_update_provenance.sql"
);

const REPO_ROOT = path.join(__dirname, "..", "..");
const ANALYZE_ROUTE_PATH = path.join(
  REPO_ROOT,
  "app",
  "api",
  "project-updates",
  "analyze",
  "route.ts"
);
const ANALYZER_V2_INPUT_TYPES_PATH = path.join(
  REPO_ROOT,
  "lib",
  "project-updates",
  "v2",
  "project-update-facts.types.ts"
);
const PROJECT_UPDATE_AUDIT_PATH = path.join(
  REPO_ROOT,
  "lib",
  "project-updates",
  "project-update-audit.server.ts"
);
const PROJECT_UPDATE_TYPES_PATH = path.join(
  REPO_ROOT,
  "lib",
  "project-updates",
  "project-update-types.ts"
);

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

const sql = readNormalized(MIGRATION_PATH);

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

const triggerFunctionBody = extractFunctionBody(
  code,
  "enforce_project_update_source_provenance"
);

describe("202608210001 - source_share_message_id column and FK", () => {
  it("adds source_share_message_id as a nullable uuid column", () => {
    expect(normalizedCode).toContain(
      "add column if not exists source_share_message_id uuid null"
    );
  });

  it("declares the FK with ON DELETE RESTRICT, never SET NULL or CASCADE", () => {
    expect(normalizedCode).toContain(
      "foreign key (source_share_message_id)\n  references public.share_messages(id)\n  on delete restrict"
    );
    expect(normalizedCode).not.toContain(
      "source_share_message_id) on delete set null"
    );
    expect(normalizedCode).not.toContain(
      "source_share_message_id) on delete cascade"
    );
  });

  it("validates the FK constraint explicitly (not valid then validate constraint)", () => {
    expect(normalizedCode).toContain(
      "add constraint project_updates_source_share_message_id_fkey"
    );
    expect(normalizedCode).toContain(
      "validate constraint project_updates_source_share_message_id_fkey"
    );
  });
});

describe("202608210001 - structural uniqueness", () => {
  it("creates a partial unique index restricted to non-null source_share_message_id", () => {
    expect(normalizedCode).toContain(
      "create unique index if not exists project_updates_source_share_message_id_key\n  on public.project_updates (source_share_message_id)\n  where source_share_message_id is not null"
    );
  });
});

describe("202608210001 - source_type CHECK widening", () => {
  it("drops and re-adds project_updates_source_type_check", () => {
    expect(normalizedCode).toContain(
      "drop constraint if exists project_updates_source_type_check"
    );
    expect(normalizedCode).toContain(
      "add constraint project_updates_source_type_check"
    );
  });

  it("preserves every existing source_type value", () => {
    const checkStart = normalizedCode.indexOf(
      "add constraint project_updates_source_type_check"
    );
    const checkClause = normalizedCode.slice(checkStart, checkStart + 300);

    for (const value of ["'text'", "'image'", "'email'", "'manual'"]) {
      expect(checkClause).toContain(value);
    }
  });

  it("adds 'client_share' as a new accepted value", () => {
    const checkStart = normalizedCode.indexOf(
      "add constraint project_updates_source_type_check"
    );
    const checkClause = normalizedCode.slice(checkStart, checkStart + 300);

    expect(checkClause).toContain("'client_share'");
  });

  it("validates the widened CHECK constraint explicitly", () => {
    expect(normalizedCode).toContain(
      "validate constraint project_updates_source_type_check"
    );
  });
});

describe("202608210001 - provenance coupling CHECK", () => {
  it("adds a biconditional CHECK coupling source_type='client_share' to a non-null source_share_message_id", () => {
    expect(normalizedCode).toContain(
      "add constraint project_updates_source_provenance_coupling_check"
    );
    expect(normalizedCode).toContain(
      "check ((source_type = 'client_share') = (source_share_message_id is not null))"
    );
  });

  it("validates the coupling CHECK constraint explicitly", () => {
    expect(normalizedCode).toContain(
      "validate constraint project_updates_source_provenance_coupling_check"
    );
  });
});

describe("202608210001 - enforce_project_update_source_provenance() security posture", () => {
  it("defines public.enforce_project_update_source_provenance()", () => {
    expect(code).toContain(
      "create or replace function public.enforce_project_update_source_provenance()"
    );
  });

  it("is plpgsql, SECURITY INVOKER, with an explicit locked search_path", () => {
    expect(triggerFunctionBody).toContain("returns trigger");
    expect(triggerFunctionBody).toContain("language plpgsql");
    expect(triggerFunctionBody).toContain("security invoker");
    expect(triggerFunctionBody).toContain("set search_path = public, pg_temp");
  });

  it("uses SECURITY DEFINER nowhere in this migration", () => {
    expect(normalizedCode).not.toContain("security definer");
  });

  it("is wired as a before-insert-or-update row trigger on public.project_updates", () => {
    expect(code).toContain(
      "create trigger project_updates_enforce_source_provenance\nbefore insert or update on public.project_updates\nfor each row\nexecute function public.enforce_project_update_source_provenance();"
    );
    expect(code).toContain(
      "drop trigger if exists project_updates_enforce_source_provenance\n  on public.project_updates;"
    );
  });

  it("revokes execute from public, anon, authenticated and service_role", () => {
    for (const role of ["public", "anon", "authenticated", "service_role"]) {
      expect(normalizedCode).toContain(
        `revoke all on function public.enforce_project_update_source_provenance()\n  from ${role};`
      );
    }
  });
});

describe("202608210001 - cross-table integrity (INSERT path)", () => {
  it("rejects a source message that does not exist", () => {
    expect(triggerFunctionBody).toContain(
      "PROJECT_UPDATE_SOURCE_MESSAGE_NOT_FOUND"
    );
  });

  it("rejects a source message that is not client-authored", () => {
    expect(triggerFunctionBody).toContain("v_message_author_type <> 'client'");
    expect(triggerFunctionBody).toContain(
      "PROJECT_UPDATE_SOURCE_MESSAGE_NOT_CLIENT_AUTHORED"
    );
  });

  it("rejects a source message owned by a different user", () => {
    expect(triggerFunctionBody).toContain("v_message_user_id <> new.user_id");
    expect(triggerFunctionBody).toContain(
      "PROJECT_UPDATE_SOURCE_MESSAGE_OWNER_MISMATCH"
    );
  });

  it("rejects a source message from a different project", () => {
    expect(triggerFunctionBody).toContain(
      "v_message_project_id <> new.project_id"
    );
    expect(triggerFunctionBody).toContain(
      "PROJECT_UPDATE_SOURCE_MESSAGE_PROJECT_MISMATCH"
    );
  });

  it("only runs the cross-table lookup when source_share_message_id is not null", () => {
    expect(triggerFunctionBody).toContain(
      "if new.source_share_message_id is not null then"
    );
  });
});

describe("202608210001 - content integrity: raw_input must equal the referenced message's body", () => {
  it("selects share_messages.body alongside the ownership/project/author columns", () => {
    expect(triggerFunctionBody).toContain(
      "select message.user_id, message.project_id, message.author_type, message.body"
    );
    expect(triggerFunctionBody).toContain(
      "into v_message_user_id, v_message_project_id, v_message_author_type, v_message_body"
    );
  });

  it("rejects an insert whose raw_input does not exactly equal the referenced message's body", () => {
    expect(triggerFunctionBody).toContain(
      "new.raw_input is distinct from v_message_body"
    );
    expect(triggerFunctionBody).toContain(
      "PROJECT_UPDATE_SOURCE_MESSAGE_BODY_MISMATCH"
    );
  });

  it("the body-mismatch check runs after every ownership/project/author check, never replacing them", () => {
    const notFoundIndex = triggerFunctionBody.indexOf("PROJECT_UPDATE_SOURCE_MESSAGE_NOT_FOUND");
    const notClientIndex = triggerFunctionBody.indexOf("PROJECT_UPDATE_SOURCE_MESSAGE_NOT_CLIENT_AUTHORED");
    const ownerMismatchIndex = triggerFunctionBody.indexOf("PROJECT_UPDATE_SOURCE_MESSAGE_OWNER_MISMATCH");
    const projectMismatchIndex = triggerFunctionBody.indexOf("PROJECT_UPDATE_SOURCE_MESSAGE_PROJECT_MISMATCH");
    const bodyMismatchIndex = triggerFunctionBody.indexOf("PROJECT_UPDATE_SOURCE_MESSAGE_BODY_MISMATCH");

    expect(bodyMismatchIndex).toBeGreaterThan(notFoundIndex);
    expect(bodyMismatchIndex).toBeGreaterThan(notClientIndex);
    expect(bodyMismatchIndex).toBeGreaterThan(ownerMismatchIndex);
    expect(bodyMismatchIndex).toBeGreaterThan(projectMismatchIndex);
  });

  it("performs no normalization -- no trim/lower/hash function wraps the comparison", () => {
    const comparisonLine = triggerFunctionBody
      .split("\n")
      .find((line) => line.includes("new.raw_input is distinct from v_message_body"));

    expect(comparisonLine).toBeDefined();
    for (const fn of ["btrim(", "trim(", "lower(", "upper(", "md5(", "digest(", "encode("]) {
      expect(comparisonLine).not.toContain(fn);
    }
  });
});

describe("202608210001 - provenance immutability (UPDATE path)", () => {
  it("branches on TG_OP = 'UPDATE'", () => {
    expect(triggerFunctionBody).toContain("if TG_OP = 'UPDATE' then");
  });

  it("uses NULL-safe comparison (IS DISTINCT FROM) for both source-identity columns and raw_input", () => {
    expect(triggerFunctionBody).toContain(
      "new.source_type is distinct from old.source_type"
    );
    expect(triggerFunctionBody).toContain(
      "new.source_share_message_id is distinct from old.source_share_message_id"
    );
    expect(triggerFunctionBody).toContain(
      "new.raw_input is distinct from old.raw_input"
    );
  });

  it("rejects any change to either source-identity column, or to raw_input on an already-client_share row, with a stable error code", () => {
    expect(triggerFunctionBody).toContain(
      "PROJECT_UPDATE_SOURCE_PROVENANCE_IMMUTABLE"
    );
  });

  it("does not scope the source_type/source_share_message_id immutability guard to only client_share rows -- it applies to every row", () => {
    // The UPDATE branch compares old/new directly with no preceding
    // "if old.source_type = 'client_share'" (or similar) guard, so a
    // pre-existing normal row being retroactively turned into
    // client_share is rejected exactly like every other transition.
    const updateBranch = triggerFunctionBody.slice(
      triggerFunctionBody.indexOf("if TG_OP = 'UPDATE' then"),
      triggerFunctionBody.indexOf("end if;", triggerFunctionBody.indexOf("if TG_OP = 'UPDATE' then"))
    );
    expect(updateBranch).not.toContain("old.source_type = 'client_share'");
  });

  it("scopes the NEW raw_input immutability rule to rows whose OLD source_share_message_id was already non-null -- never broadened to ordinary text/image/email/manual updates", () => {
    const updateBranch = triggerFunctionBody.slice(
      triggerFunctionBody.indexOf("if TG_OP = 'UPDATE' then"),
      triggerFunctionBody.indexOf("end if;", triggerFunctionBody.indexOf("if TG_OP = 'UPDATE' then"))
    );
    expect(updateBranch).toContain("old.source_share_message_id is not null");
    // The raw_input comparison must be gated behind that guard, not a
    // bare top-level condition that would apply to every row.
    const rawInputCheckIndex = updateBranch.indexOf("new.raw_input is distinct from old.raw_input");
    const guardIndex = updateBranch.indexOf("old.source_share_message_id is not null");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(rawInputCheckIndex).toBeGreaterThan(-1);
  });
});

describe("202608210001 - Phase 6A boundary: no write path to share_message_conversions", () => {
  it("this migration never references share_message_conversions outside of doc comments", () => {
    // Comment-stripped: the trigger function's own `comment on function`
    // legitimately NAMES share_message_conversions while explaining it is
    // excluded (matching this repository's established comment-vs-executable
    // test convention, e.g. app/api/share-links/[id]/messages/phase6-boundary.test.ts).
    expect(normalizedExecutable).not.toContain("share_message_conversions");
  });

  it("this migration grants no new table privilege to anon or public", () => {
    expect(normalizedExecutable).not.toMatch(/grant[\s\S]*?to\s+anon/);
    expect(normalizedExecutable).not.toMatch(/grant[\s\S]*?to\s+public/);
  });

  it("this migration issues no positive GRANT statement at all (only REVOKE, plus the FK/CHECK/trigger DDL above)", () => {
    expect(normalizedExecutable).not.toMatch(/^\s*grant\s/m);
  });
});

describe("202608210001 - Phase 6A boundary: public generic analyze route untouched", () => {
  const analyzeRouteSource = readNormalized(ANALYZE_ROUTE_PATH);

  it("still only declares the original 4 source-type values, never client_share", () => {
    expect(analyzeRouteSource).toContain(
      'z.enum(["text", "image", "email", "manual"])'
    );
    expect(analyzeRouteSource).not.toContain("client_share");
  });
});

describe("202608210001 - Phase 6A boundary: analyzer's actionable input contract untouched", () => {
  const analyzerTypesSource = readNormalized(ANALYZER_V2_INPUT_TYPES_PATH);

  it("ProjectUpdateV2SourceType is still exactly 'text' | 'image'", () => {
    expect(analyzerTypesSource).toContain(
      'export type ProjectUpdateV2SourceType = "text" | "image";'
    );
  });
});

describe("202608210001 - Phase 6A boundary: persistence-layer input contract excludes client_share", () => {
  const auditSource = readNormalized(PROJECT_UPDATE_AUDIT_PATH);

  it("CreateProjectUpdateInput's sourceType excludes 'client_share'", () => {
    expect(auditSource).toContain(
      'sourceType?: Exclude<ProjectUpdateSourceType, "client_share">;'
    );
  });
});

describe("202608210001 - passive display type widened", () => {
  const typesSource = readNormalized(PROJECT_UPDATE_TYPES_PATH);

  it("ProjectUpdateSourceType now includes 'client_share' alongside every existing value", () => {
    expect(typesSource).toMatch(/export type ProjectUpdateSourceType =[\s\S]*?"text"/);
    expect(typesSource).toContain('"image"');
    expect(typesSource).toContain('"email"');
    expect(typesSource).toContain('"manual"');
    expect(typesSource).toContain('"client_share"');
  });
});
