import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608030005_client_share_integrity_and_security.test.ts).
//
// IMPORTANT: nothing in this file proves these RPCs actually behave
// correctly against a real database. It proves only that both functions
// are declared with the right signature, security posture, error
// semantics, field allowlist, grant model and (for the summary RPC) a
// set-based, non-N+1 query shape.
const MIGRATION_PATH = path.join(
  __dirname,
  "202608050001_client_share_owner_reads.sql"
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

/**
 * Collapses all whitespace runs (including newlines) to a single space, so
 * assertions prove a sequence of SQL tokens appears in order without
 * pinning to one exact indentation/line-wrapping layout. Used specifically
 * for the set-based summary query, which is the part of this migration
 * most likely to be reformatted later.
 */
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

const FUNCTION_NAMES = [
  "get_share_link_management_state",
  "list_share_link_summaries",
] as const;

const bodies = Object.fromEntries(
  FUNCTION_NAMES.map((name) => [name, extractFunctionBody(code, name)])
) as Record<(typeof FUNCTION_NAMES)[number], string>;

const summaryBody = bodies.list_share_link_summaries;
const normalizedWhitespaceSummaryBody = normalizeWhitespace(summaryBody);

describe("202608050001 - both RPCs exist with the required signature and security posture", () => {
  it("declares get_share_link_management_state(p_project_id uuid) returns jsonb", () => {
    expect(code).toContain(
      "create or replace function public.get_share_link_management_state(p_project_id uuid)\nreturns jsonb"
    );
  });

  it("declares list_share_link_summaries(p_project_ids uuid[]) returns jsonb", () => {
    expect(code).toContain(
      "create or replace function public.list_share_link_summaries(p_project_ids uuid[])\nreturns jsonb"
    );
  });

  it.each(FUNCTION_NAMES)(
    "%s is plpgsql, SECURITY INVOKER, with an explicit locked search_path",
    (name) => {
      const body = bodies[name];
      expect(body).toContain("language plpgsql");
      expect(body).toContain("security invoker");
      expect(body).toContain("set search_path = public, pg_temp");
    }
  );

  it("uses SECURITY DEFINER nowhere in the migration", () => {
    expect(normalizedCode).not.toContain("security definer");
  });

  it.each(FUNCTION_NAMES)("%s obtains and checks auth.uid()", (name) => {
    const body = bodies[name];
    expect(body).toContain("v_user_id uuid := auth.uid();");
    expect(body).toContain("if v_user_id is null then");
    expect(body).toContain("message = 'UNAUTHORIZED'");
  });
});

describe("202608050001 - ownership failures never reveal cross-tenant existence", () => {
  it("get_share_link_management_state raises PROJECT_NOT_FOUND for missing, foreign or deleted projects alike", () => {
    const body = bodies.get_share_link_management_state;
    expect(body).toContain("from public.projects as project");
    expect(body).toContain("v_project_owner is null");
    expect(body).toContain("or v_project_owner <> v_user_id");
    expect(body).toContain("or v_project_deleted_at is not null");
    const occurrences = body.match(/message = 'PROJECT_NOT_FOUND'/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(1);
  });

  it("list_share_link_summaries rejects the whole call with PROJECT_NOT_FOUND rather than partial results", () => {
    expect(summaryBody).toContain(
      "if v_owned_project_count <> cardinality(v_project_ids) then"
    );
    expect(summaryBody).toContain("message = 'PROJECT_NOT_FOUND'");
    expect(summaryBody).toContain("and project.user_id = v_user_id");
    expect(summaryBody).toContain("and project.deleted_at is null");
  });
});

describe("202608050001 - list_share_link_summaries input validation", () => {
  it("rejects a null or empty project id array", () => {
    expect(summaryBody).toContain(
      "if p_project_ids is null or cardinality(p_project_ids) = 0 then"
    );
    expect(summaryBody).toContain("message = 'INVALID_PROJECT_IDS'");
  });

  it("enforces the 100-project upper bound", () => {
    expect(summaryBody).toContain("if cardinality(p_project_ids) > 100 then");
    expect(summaryBody).toContain("message = 'TOO_MANY_PROJECT_IDS'");
  });

  it("rejects a null value inside the array", () => {
    expect(summaryBody).toContain("where requested.project_id is null");
  });

  it("normalizes (dedupes) the requested ids deterministically", () => {
    expect(summaryBody).toContain(
      "select array_agg(distinct requested.project_id order by requested.project_id)"
    );
  });

  it("keeps unreadCount null, and never queries client-message content", () => {
    expect(summaryBody).toContain("'unreadCount', null");
    expect(normalizedCode).not.toContain("share_messages");
  });
});

describe("202608050001 - list_share_link_summaries is a set-based query, not an N+1 loop", () => {
  it("contains no FOREACH, LOOP or END LOOP anywhere in the migration", () => {
    expect(normalizedCode).not.toMatch(/\bforeach\b/);
    expect(normalizedCode).not.toMatch(/\bloop\b/);
    expect(normalizedCode).not.toMatch(/\bend loop\b/);
  });

  it("builds requested_projects, managed_links, task_counts and resource_counts as CTEs of one statement", () => {
    expect(normalizedWhitespaceSummaryBody).toContain(
      "with requested_projects as ("
    );
    expect(normalizedWhitespaceSummaryBody).toContain("managed_links as (");
    expect(normalizedWhitespaceSummaryBody).toContain("task_counts as (");
    expect(normalizedWhitespaceSummaryBody).toContain(
      "resource_counts as ("
    );
  });

  it("selects one managed link per requested project via DISTINCT ON, with the deterministic active-first tiebreak", () => {
    expect(normalizedWhitespaceSummaryBody).toContain(
      "select distinct on (link.project_id) link.project_id, link.id as link_id"
    );
    expect(normalizedWhitespaceSummaryBody).toContain(
      "where link.project_id = any (v_project_ids) and link.user_id = v_user_id and link.state <> 'revoked'"
    );
    expect(normalizedWhitespaceSummaryBody).toContain(
      "order by link.project_id, (link.state = 'active') desc, link.updated_at desc, link.created_at desc, link.id desc"
    );
  });

  it("computes task and resource counts as one grouped aggregate over all selected links, not per-project queries", () => {
    expect(normalizedWhitespaceSummaryBody).toContain(
      "select task.share_link_id, count(*) as task_count from public.share_link_tasks as task"
    );
    expect(normalizedWhitespaceSummaryBody).toContain(
      "group by task.share_link_id"
    );
    expect(normalizedWhitespaceSummaryBody).toContain(
      "select resource.share_link_id, count(*) as resource_count from public.share_link_resources as resource"
    );
    expect(normalizedWhitespaceSummaryBody).toContain(
      "group by resource.share_link_id"
    );
  });

  it("builds exactly one aggregate result covering every requested project, via a single jsonb_object_agg", () => {
    const aggCalls = summaryBody.match(/jsonb_object_agg\(/g) ?? [];
    expect(aggCalls).toHaveLength(1);
    expect(normalizedWhitespaceSummaryBody).toContain(
      "select jsonb_object_agg("
    );
    expect(normalizedWhitespaceSummaryBody).toContain(
      "from requested_projects left join managed_links"
    );
    expect(normalizedWhitespaceSummaryBody).toContain(
      "on managed_links.project_id = requested_projects.project_id"
    );
  });

  it("left-joins counts by share_link_id so a project without a managed link still gets one zero-filled row", () => {
    expect(normalizedWhitespaceSummaryBody).toContain(
      "left join task_counts on task_counts.share_link_id = managed_links.link_id"
    );
    expect(normalizedWhitespaceSummaryBody).toContain(
      "left join resource_counts on resource_counts.share_link_id = managed_links.link_id"
    );
    expect(normalizedWhitespaceSummaryBody).toContain(
      "coalesce(managed_links.view_count, 0)"
    );
    expect(normalizedWhitespaceSummaryBody).toContain(
      "coalesce(task_counts.task_count, 0)"
    );
    expect(normalizedWhitespaceSummaryBody).toContain(
      "coalesce(resource_counts.resource_count, 0)"
    );
  });
});

describe("202608050001 - safe field allowlist, no secret or PIN material", () => {
  it("get_share_link_management_state exposes hasPin only as a boolean, never the pin_hash/pin_salt value", () => {
    const body = bodies.get_share_link_management_state;
    expect(body).toContain("'hasPin', v_pin_hash is not null");
    expect(body).not.toContain("'pinHash'");
    expect(body).not.toContain("'pinSalt'");
  });

  it("list_share_link_summaries exposes hasPin only as a boolean derived from pin_hash", () => {
    expect(normalizedWhitespaceSummaryBody).toContain(
      "'hasPin', managed_links.pin_hash is not null"
    );
  });

  it("never selects secret_digest, pin_salt, PIN scrypt parameters or internal identity columns into any output", () => {
    for (const forbidden of [
      "secret_digest",
      "secret_digest_version",
      "pin_salt",
      "pin_hash_version",
      "pin_scrypt_n",
      "pin_scrypt_r",
      "pin_scrypt_p",
      "pin_key_length",
      "created_by",
    ]) {
      expect(normalizedExecutable).not.toContain(forbidden);
    }
  });

  it("never returns user_id or project_id as an output field", () => {
    expect(normalizedCode).not.toMatch(/'userid'/);
    expect(normalizedCode).not.toMatch(/'projectid', v_user_id/);
  });

  it("casts mapped subtask ids to text so bigint ids are never returned as JSON numbers", () => {
    const body = bodies.get_share_link_management_state;
    expect(body).toContain(
      "jsonb_agg(task.subtask_id::text order by task.display_order, task.subtask_id)"
    );
  });

  it("currentUpdate contains only body, version and publishedAt", () => {
    const body = bodies.get_share_link_management_state;
    expect(body).toContain(
      "jsonb_build_object('body', upd.body, 'version', upd.version, 'publishedAt', upd.published_at)"
    );
  });

  it("get_share_link_management_state's link object contains exactly the allowlisted keys", () => {
    const body = bodies.get_share_link_management_state;
    const objectStart = body.indexOf("'link', jsonb_build_object(");
    const objectEnd = body.indexOf("),\n    'mappedTaskIds'", objectStart);
    const linkObject = body.slice(objectStart, objectEnd);
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

  it("list_share_link_summaries's per-project object contains exactly the allowlisted keys", () => {
    const objectStart = normalizedWhitespaceSummaryBody.indexOf(
      "jsonb_build_object( 'projectId'"
    );
    const objectEnd = normalizedWhitespaceSummaryBody.indexOf(
      ") ) into v_result",
      objectStart
    );
    const summaryObject = normalizedWhitespaceSummaryBody.slice(
      objectStart,
      objectEnd
    );
    const keys = [...summaryObject.matchAll(/'([a-zA-Z]+)',/g)].map(
      (m) => m[1]
    );
    expect(new Set(keys)).toEqual(
      new Set([
        "projectId",
        "linkId",
        "state",
        "expiresAt",
        "hasPin",
        "createdAt",
        "lastViewedAt",
        "viewCount",
        "taskCount",
        "resourceCount",
        "unreadCount",
      ])
    );
  });
});

describe("202608050001 - read-only, no dynamic SQL", () => {
  it.each(FUNCTION_NAMES)("%s never assigns to a NEW column", (name) => {
    expect(bodies[name]).not.toMatch(/new\.[a-z_]+\s*:=/);
  });

  it("contains no INSERT, UPDATE, DELETE, MERGE or TRUNCATE statement anywhere", () => {
    expect(normalizedExecutable).not.toMatch(/\binsert\s+into\b/);
    expect(normalizedExecutable).not.toMatch(/\bupdate\s+public\./);
    expect(normalizedExecutable).not.toMatch(/\bdelete\s+from\b/);
    expect(normalizedExecutable).not.toMatch(/\bmerge\s+into\b/);
    expect(normalizedExecutable).not.toMatch(/\btruncate\b/);
  });

  it("contains no dynamic SQL (EXECUTE statement)", () => {
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+'/);
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+format\(/);
  });

  it("does not mutate view_count or last_viewed_at", () => {
    expect(normalizedExecutable).not.toMatch(/update public\.project_share_links/);
  });

  it("does not write analytics or event rows", () => {
    expect(normalizedCode).not.toContain("share_link_events");
    expect(normalizedCode).not.toContain("analytics_events");
  });
});

describe("202608050001 - grants: revoked from public and anon, granted only to authenticated", () => {
  it.each(FUNCTION_NAMES)("%s is revoked from public and anon", (name) => {
    const signature = name === "get_share_link_management_state" ? "uuid" : "uuid[]";
    expect(code).toContain(
      `revoke all on function public.${name}(${signature}) from public;`
    );
    expect(code).toContain(
      `revoke all on function public.${name}(${signature}) from anon;`
    );
  });

  it.each(FUNCTION_NAMES)(
    "%s grants execute only to authenticated",
    (name) => {
      const signature = name === "get_share_link_management_state" ? "uuid" : "uuid[]";
      expect(code).toContain(
        `grant execute on function public.${name}(${signature}) to authenticated;`
      );
    }
  );

  it("grants nothing to service_role anywhere in this migration", () => {
    expect(normalizedCode).not.toContain("service_role");
  });

  it("grants nothing whatsoever to anon", () => {
    expect(normalizedCode).not.toMatch(/\bgrant\b[^;]*\banon\b/);
  });

  it("grants execute to exactly two functions, both to authenticated only", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    expect(grants).toHaveLength(2);
    for (const grant of grants) {
      expect(grant).toContain("grant execute on function public.");
      expect(grant).toContain("to authenticated;");
    }
  });
});

describe("202608050001 - comments and production-safety boundaries", () => {
  it.each(FUNCTION_NAMES)("comments the function it creates", (name) => {
    expect(code).toContain(`comment on function public.${name}(`);
  });

  it("creates no table, column, index, policy, view, trigger or extension", () => {
    expect(normalizedCode).not.toMatch(/create table/);
    expect(normalizedCode).not.toMatch(/add column/);
    expect(normalizedCode).not.toMatch(/create (unique )?index/);
    expect(normalizedCode).not.toMatch(/create policy/);
    expect(normalizedCode).not.toMatch(/create (or replace )?view/);
    expect(normalizedCode).not.toMatch(/create trigger/);
    expect(normalizedCode).not.toMatch(/create extension/);
  });

  it("alters no existing table and drops nothing", () => {
    expect(normalizedCode).not.toMatch(/alter table/);
    expect(normalizedCode).not.toMatch(/drop table\b/);
    expect(normalizedCode).not.toMatch(/drop column\b/);
    expect(normalizedCode).not.toMatch(/drop policy\b/);
    expect(normalizedCode).not.toMatch(/drop trigger\b/);
  });

  it("does not define a down/rollback migration (forward-only, matching repo convention)", () => {
    expect(normalizedSql).not.toMatch(/^-- down/m);
    expect(normalizedCode).not.toMatch(/\brollback\b/);
  });

  it("touches only the four Phase 1A owner-facing tables, plus public.projects for ownership checks", () => {
    const reads = code.match(/from public\.[a-z_]+ as [a-z_]+/g) ?? [];
    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) {
      expect(read).toMatch(
        /from public\.(projects|project_share_links|share_link_tasks|share_link_resources|share_link_updates) as /
      );
    }
  });
});
