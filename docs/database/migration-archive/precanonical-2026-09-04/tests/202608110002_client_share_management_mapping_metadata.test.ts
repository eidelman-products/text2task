import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608110001_client_share_publication_intent.test.ts).
//
// IMPORTANT: nothing in this file proves get_share_link_management_state
// actually returns correct data against a real database. It proves only
// that exactly the existing function is replaced (no new RPC), that the
// task/Resource mapping JSON now carries all four required fields per
// item, that ordering/auth/revocation/no-secret-material invariants are
// preserved, and that historical migrations remain untouched. Real
// PostgreSQL behavior is proven only by the disposable-project runtime
// package under docs/client-share-phase2b-mapping-read-runtime/, run by
// the user.

const MIGRATION_PATH = path.join(
  __dirname,
  "202608110002_client_share_management_mapping_metadata.sql"
);
const PRIOR_MIGRATION_PATH = path.join(
  __dirname,
  "202608110001_client_share_publication_intent.sql"
);
const OWNER_READS_MIGRATION_PATH = path.join(
  __dirname,
  "202608050001_client_share_owner_reads.sql"
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
const normalizedWhitespaceReadBody = normalizeWhitespace(readBody);

describe("202608110002 - replaces exactly the existing get_share_link_management_state, no new RPC", () => {
  it("keeps the exact prior signature and returns jsonb", () => {
    expect(code).toContain(
      "create or replace function public.get_share_link_management_state(p_project_id uuid)\nreturns jsonb"
    );
  });

  it("defines exactly one function in this migration", () => {
    const defs = code.match(/^create or replace function public\.[a-z_]+\(/gm) ?? [];
    expect(defs).toHaveLength(1);
  });

  it("does not create a new RPC, table, route-facing function or duplicate mapping-read function", () => {
    for (const forbidden of [
      "create table",
      "create or replace function public.get_share_link_mapping",
      "create or replace function public.get_share_link_task_mapping",
      "create or replace function public.get_share_link_resource_mapping",
      "create or replace function public.list_share_link_mapping",
    ]) {
      expect(normalizedCode).not.toContain(forbidden);
    }
  });

  it("does not touch save_share_configuration or list_share_link_summaries", () => {
    expect(normalizedCode).not.toContain("save_share_configuration");
    expect(normalizedCode).not.toContain("list_share_link_summaries");
  });

  it("is plpgsql, SECURITY INVOKER, with the exact locked search_path", () => {
    expect(readBody).toContain("language plpgsql");
    expect(readBody).toContain("security invoker");
    expect(readBody).toContain("set search_path = public, pg_temp");
    expect(readBody).not.toContain("security definer");
  });
});

describe("202608110002 - task mapping JSON carries all four required fields", () => {
  it("selects public_group, waiting_for_client_feedback and display_order from share_link_tasks", () => {
    expect(normalizedWhitespaceReadBody).toContain(
      normalizeWhitespace(
        `jsonb_build_object(
          'subtaskId', task.subtask_id::text,
          'publicGroup', task.public_group,
          'waitingForClientFeedback', task.waiting_for_client_feedback,
          'displayOrder', task.display_order
        )`
      )
    );
  });

  it("casts subtask_id to text so it is never round-tripped as a JSON number", () => {
    expect(readBody).toContain("task.subtask_id::text");
  });

  it("orders the task mapping by display_order then subtask_id, without renumbering", () => {
    expect(readBody).toContain("order by task.display_order, task.subtask_id");
    expect(normalizedExecutable).not.toMatch(/row_number\s*\(\s*\)/);
  });

  it("scopes the task mapping query to the resolved link and the invoking owner", () => {
    const queryStart = readBody.indexOf("from public.share_link_tasks as task");
    const queryBlock = readBody.slice(queryStart, queryStart + 200);
    expect(queryBlock).toContain("task.share_link_id = v_link_id");
    expect(queryBlock).toContain("task.user_id = v_user_id");
  });
});

describe("202608110002 - Resource mapping JSON carries all four required fields", () => {
  it("selects public_label, can_download and display_order from share_link_resources", () => {
    expect(normalizedWhitespaceReadBody).toContain(
      normalizeWhitespace(
        `jsonb_build_object(
          'resourceId', resource.resource_id,
          'publicLabel', resource.public_label,
          'canDownload', resource.can_download,
          'displayOrder', resource.display_order
        )`
      )
    );
  });

  it("orders the resource mapping by display_order then resource_id, without renumbering", () => {
    expect(readBody).toContain("order by resource.display_order, resource.resource_id");
  });

  it("scopes the resource mapping query to the resolved link and the invoking owner", () => {
    const queryStart = readBody.indexOf("from public.share_link_resources as resource");
    const queryBlock = readBody.slice(queryStart, queryStart + 200);
    expect(queryBlock).toContain("resource.share_link_id = v_link_id");
    expect(queryBlock).toContain("resource.user_id = v_user_id");
  });

  it("never selects storage_path, file_name, url, mime_type, size_bytes or notes", () => {
    for (const forbidden of [
      "resource.storage_path",
      "resource.file_name",
      "resource.url",
      "resource.mime_type",
      "resource.size_bytes",
      "resource.notes",
    ]) {
      expect(normalizedExecutable).not.toContain(forbidden);
    }
  });
});

describe("202608110002 - response shape replaces mappedTaskIds/mappedResourceIds entirely", () => {
  it("the no-link early return uses mappedTasks/mappedResources, not the retired bare-id keys", () => {
    expect(readBody).toContain("'mappedTasks', '[]'::jsonb");
    expect(readBody).toContain("'mappedResources', '[]'::jsonb");
    expect(normalizedExecutable).not.toContain("'mappedtaskids'");
    expect(normalizedExecutable).not.toContain("'mappedresourceids'");
  });

  it("the final return object uses mappedTasks/mappedResources", () => {
    expect(readBody).toContain("'mappedTasks', v_mapped_tasks");
    expect(readBody).toContain("'mappedResources', v_mapped_resources");
  });

  it("the managed link object keys are unchanged from 202608110001 (only the mapping arrays change)", () => {
    const objectStart = readBody.indexOf("'link', jsonb_build_object(");
    const objectEnd = readBody.indexOf("),\n    'mappedTasks'", objectStart);
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

  it("currentUpdate is unchanged (body, version, publishedAt)", () => {
    expect(readBody).toContain(
      "jsonb_build_object('body', upd.body, 'version', upd.version, 'publishedAt', upd.published_at)"
    );
  });
});

describe("202608110002 - owner/auth guard and revoked-link behavior retained", () => {
  it("still raises UNAUTHORIZED and PROJECT_NOT_FOUND exactly as before", () => {
    expect(readBody).toContain("message = 'UNAUTHORIZED'");
    expect(readBody).toContain("message = 'PROJECT_NOT_FOUND'");
  });

  it("still excludes revoked links from managed-link selection", () => {
    expect(readBody).toContain("link.state <> 'revoked'");
  });

  it("still resolves ownership via auth.uid() only -- no user_id or project_id parameter expansion", () => {
    expect(readBody).toContain("v_user_id uuid := auth.uid();");
    expect(code).toContain(
      "create or replace function public.get_share_link_management_state(p_project_id uuid)"
    );
  });

  it("still never mutates view_count or last_viewed_at", () => {
    expect(normalizedWhitespaceReadBody).not.toContain("update public.project_share_links");
  });
});

describe("202608110002 - no secret/PIN material added, grants remain authenticated-only", () => {
  it("never selects or returns secret_digest, pin_hash, pin_salt or any PIN scrypt parameter", () => {
    for (const forbidden of ["secret_digest", "pin_salt", "pin_scrypt"]) {
      expect(normalizedExecutable).not.toContain(forbidden);
    }
    // hasPin is derived from pin_hash IS NOT NULL only -- pin_hash itself
    // is read into a variable (as the prior version already did) but
    // never placed into the returned jsonb.
    expect(readBody).toContain("'hasPin', v_pin_hash is not null");
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

  it("grants nothing to anon anywhere", () => {
    expect(normalizedCode).not.toMatch(/\bgrant\b[^;]*\banon\b/);
  });
});

describe("202608110002 - production-safety and forward-only posture", () => {
  it("does not define a down/rollback migration", () => {
    expect(normalizedCode).not.toMatch(/^-- down/m);
    expect(normalizedExecutable).not.toMatch(/\brollback\b/);
  });

  it("contains no dynamic SQL", () => {
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+'/);
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+format\(/);
  });

  it("does not use IF NOT EXISTS anywhere", () => {
    expect(normalizedCode).not.toContain("if not exists");
  });

  it("adds no new index, policy, trigger, table-privilege grant or RLS change", () => {
    expect(normalizedCode).not.toMatch(/create (unique )?index/);
    expect(normalizedCode).not.toMatch(/create policy/);
    expect(normalizedCode).not.toMatch(/create trigger/);
    expect(normalizedCode).not.toMatch(/row level security/);
    expect(normalizedCode).not.toMatch(/\bgrant\b[^;]*\bon table\b/);
  });

  it("the function comments on itself", () => {
    expect(code).toContain(
      "comment on function public.get_share_link_management_state(uuid) is"
    );
  });
});

describe("202608110002 - historical migrations are untouched", () => {
  it("202608110001_client_share_publication_intent.sql still returns the prior mappedTaskIds/mappedResourceIds shape unchanged", () => {
    const priorSql = readNormalized(PRIOR_MIGRATION_PATH);
    expect(priorSql).toContain("'mappedTaskIds', v_task_ids");
    expect(priorSql).toContain("'mappedResourceIds', v_resource_ids");
  });

  it("202608050001_client_share_owner_reads.sql is untouched", () => {
    const ownerReadsSql = readNormalized(OWNER_READS_MIGRATION_PATH);
    expect(ownerReadsSql).toContain("'mappedTaskIds', v_task_ids");
    expect(ownerReadsSql).toContain("'mappedResourceIds', v_resource_ids");
  });
});
