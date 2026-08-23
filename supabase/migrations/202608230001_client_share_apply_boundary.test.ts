import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608210001_client_share_project_update_provenance.test.ts).
//
// IMPORTANT: nothing in this file proves runtime behaviour (that the
// trigger actually fires against a real Postgres engine, that a direct
// INSERT is actually rejected, that text/image Apply is actually
// unaffected). It proves only that the migration declares exactly the
// structural contract this Phase 6B DB-boundary correction locks. Runtime
// verification against a disposable Postgres instance is a separate,
// user-run step -- not faked here.
const MIGRATION_PATH = path.join(
  __dirname,
  "202608230001_client_share_apply_boundary.sql"
);

const PROVENANCE_MIGRATION_PATH = path.join(
  __dirname,
  "202608210001_client_share_project_update_provenance.sql"
);

const APPLY_RPC_MIGRATION_PATH = path.join(
  __dirname,
  "202607270001_project_completion_reconciliation.sql"
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
  "enforce_project_update_client_share_apply_boundary"
);

describe("202608230001 - dedicated function exists, separate from Phase 6A's provenance trigger", () => {
  it("defines public.enforce_project_update_client_share_apply_boundary()", () => {
    expect(code).toContain(
      "create or replace function public.enforce_project_update_client_share_apply_boundary()"
    );
  });

  it("is a distinct function name from enforce_project_update_source_provenance", () => {
    expect(code).not.toContain(
      "create or replace function public.enforce_project_update_source_provenance"
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
});

describe("202608230001 - trigger wiring: BEFORE INSERT OR UPDATE on project_updates", () => {
  it("is wired as a before-insert-or-update row trigger on public.project_updates", () => {
    expect(code).toContain(
      "create trigger project_updates_enforce_client_share_apply_boundary\nbefore insert or update on public.project_updates\nfor each row\nexecute function public.enforce_project_update_client_share_apply_boundary();"
    );
  });

  it("drops any prior copy of the same trigger first (idempotent, not a silent adoption)", () => {
    expect(code).toContain(
      "drop trigger if exists project_updates_enforce_client_share_apply_boundary\n  on public.project_updates;"
    );
  });

  it("never fires only on UPDATE -- INSERT is explicitly included", () => {
    expect(normalizedCode).not.toMatch(
      /create trigger project_updates_enforce_client_share_apply_boundary\nbefore update on public\.project_updates/
    );
  });
});

describe("202608230001 - the guard's own logic: inspects only NEW, never OLD, never TG_OP", () => {
  it("checks source_type = 'client_share'", () => {
    expect(triggerFunctionBody).toContain("new.source_type = 'client_share'");
  });

  it("rejects status = 'applying'", () => {
    expect(triggerFunctionBody).toMatch(/new\.status in \([^)]*'applying'[^)]*\)/);
  });

  it("rejects status = 'applied'", () => {
    expect(triggerFunctionBody).toMatch(/new\.status in \([^)]*'applied'[^)]*\)/);
  });

  it("raises a stable P0001 application error, PROJECT_UPDATE_SOURCE_NOT_APPLIABLE", () => {
    expect(triggerFunctionBody).toContain("errcode = 'P0001'");
    expect(triggerFunctionBody).toContain("message = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE'");
  });

  it("never references OLD -- the guard cannot depend on the row's prior state", () => {
    expect(triggerFunctionBody.toLowerCase()).not.toContain("old.");
  });

  it("never branches on TG_OP -- the same check applies to INSERT and UPDATE identically", () => {
    expect(triggerFunctionBody).not.toContain("TG_OP");
  });

  it("returns NEW when the guard does not fire", () => {
    expect(triggerFunctionBody).toContain("return new;");
  });
});

describe("202608230001 - direct execution locked down (matches Phase 6A's own trigger-function convention)", () => {
  it("revokes execute from public, anon, authenticated and service_role", () => {
    for (const role of ["public", "anon", "authenticated", "service_role"]) {
      expect(normalizedCode).toContain(
        `revoke all on function public.enforce_project_update_client_share_apply_boundary()\n  from ${role};`
      );
    }
  });

  it("issues no positive GRANT statement at all", () => {
    expect(normalizedExecutable).not.toMatch(/^\s*grant\s/m);
  });

  it("grants no new table privilege to anon or public", () => {
    expect(normalizedExecutable).not.toMatch(/grant[\s\S]*?to\s+anon/);
    expect(normalizedExecutable).not.toMatch(/grant[\s\S]*?to\s+public/);
  });
});

describe("202608230001 - boundary: apply_project_update_transaction is untouched", () => {
  it("this migration never defines or replaces apply_project_update_transaction", () => {
    expect(normalizedCode).not.toContain(
      "create or replace function public.apply_project_update_transaction"
    );
  });

  it("this migration issues no grant/revoke statement naming apply_project_update_transaction", () => {
    expect(normalizedExecutable).not.toMatch(
      /(grant|revoke)[\s\S]*?apply_project_update_transaction/
    );
  });

  it("the real, currently-authoritative apply_project_update_transaction definition (202607270001) is unmodified by this change -- this test reads it directly and only asserts it still exists with its own unchanged grants", () => {
    const rpcMigrationSource = readNormalized(APPLY_RPC_MIGRATION_PATH);
    expect(rpcMigrationSource).toContain(
      "create or replace function public.apply_project_update_transaction("
    );
    expect(rpcMigrationSource).toContain(
      ") to authenticated;"
    );
  });
});

describe("202608230001 - boundary: Phase 6A provenance function/migration untouched", () => {
  it("this migration never defines or replaces enforce_project_update_source_provenance", () => {
    expect(normalizedCode).not.toContain(
      "create or replace function public.enforce_project_update_source_provenance"
    );
  });

  it("the Phase 6A provenance migration file itself is not modified by this change -- read directly and confirmed still intact", () => {
    const provenanceMigrationSource = readNormalized(PROVENANCE_MIGRATION_PATH);
    expect(provenanceMigrationSource).toContain(
      "create or replace function public.enforce_project_update_source_provenance()"
    );
    expect(provenanceMigrationSource).toContain(
      "create trigger project_updates_enforce_source_provenance"
    );
  });
});

describe("202608230001 - boundary: no schema shape change, no conversion-closure write path", () => {
  it("adds no column (no ALTER TABLE ... ADD COLUMN anywhere)", () => {
    expect(normalizedExecutable).not.toMatch(/add column/);
  });

  it("creates no new table", () => {
    expect(normalizedExecutable).not.toMatch(/create table/);
  });

  it("never references share_message_conversions outside of doc comments", () => {
    // Comment-stripped: this migration's own header/function comments
    // legitimately NAME share_message_conversions while explaining it is
    // excluded (matching this repository's established comment-vs-executable
    // test convention).
    expect(normalizedExecutable).not.toContain("share_message_conversions");
  });

  it("never writes share_messages.status = 'converted' (or any share_messages write at all)", () => {
    expect(normalizedExecutable).not.toContain("share_messages");
  });
});
