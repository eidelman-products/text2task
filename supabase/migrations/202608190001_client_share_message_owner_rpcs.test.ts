import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608060002_client_share_access_operations.test.ts).
const MIGRATION_PATH = path.join(
  __dirname,
  "202608190001_client_share_message_owner_rpcs.sql"
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

const FUNCTION_SIGNATURES = {
  send_share_message_reply: "uuid, uuid, text",
  set_share_message_status: "uuid, text",
} as const;

const FUNCTION_NAMES = Object.keys(
  FUNCTION_SIGNATURES
) as (keyof typeof FUNCTION_SIGNATURES)[];

const bodies = Object.fromEntries(
  FUNCTION_NAMES.map((name) => [name, extractFunctionBody(code, name)])
) as Record<(typeof FUNCTION_NAMES)[number], string>;

const normalizedWhitespaceBodies = Object.fromEntries(
  FUNCTION_NAMES.map((name) => [name, normalizeWhitespace(bodies[name])])
) as Record<(typeof FUNCTION_NAMES)[number], string>;

function normalizedWhitespaceCodeContains(fragment: string): boolean {
  return normalizeWhitespace(code).includes(normalizeWhitespace(fragment));
}

describe("202608190001 - both RPC signatures, security posture and auth handling", () => {
  it.each(FUNCTION_NAMES)("declares public.%s with the exact signature", (name) => {
    expect(code).toContain(`create or replace function public.${name}(`);
  });

  it.each(FUNCTION_NAMES)(
    "%s is plpgsql, SECURITY DEFINER, with an explicit locked search_path",
    (name) => {
      const body = bodies[name];
      expect(body).toContain("returns jsonb");
      expect(body).toContain("language plpgsql");
      expect(body).toContain("security definer");
      expect(body).toContain("set search_path = public, pg_temp");
    }
  );

  it("uses SECURITY INVOKER nowhere in this migration", () => {
    expect(normalizedCode).not.toContain("security invoker");
  });

  it.each(FUNCTION_NAMES)("%s obtains and null-checks auth.uid() internally", (name) => {
    const body = bodies[name];
    expect(body).toContain("v_user_id uuid := auth.uid();");
    expect(body).toContain("if v_user_id is null then");
    expect(body).toContain("message = 'UNAUTHORIZED'");
  });

  it.each(FUNCTION_NAMES)("%s accepts no p_user_id or p_author_type parameter", (name) => {
    const startMarker = `create or replace function public.${name}(`;
    const startIndex = code.indexOf(startMarker);
    const paramsEnd = code.indexOf(")\nreturns", startIndex);
    const paramList = code.slice(startIndex + startMarker.length, paramsEnd).toLowerCase();
    expect(paramList).not.toMatch(/p_user_id/);
    expect(paramList).not.toMatch(/p_author_type/);
    expect(paramList).not.toMatch(/p_is_visible_to_client/);
    expect(paramList).not.toMatch(/p_project_id/);
  });

  it("contains no dynamic SQL (EXECUTE statement) anywhere in the migration", () => {
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+'/);
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+format\(/);
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+v_/);
  });
});

describe("202608190001 - function privilege hardening", () => {
  it.each(FUNCTION_NAMES)("%s is revoked from public, anon and service_role", (name) => {
    const signature = FUNCTION_SIGNATURES[name];
    for (const role of ["public", "anon", "service_role"]) {
      expect(
        normalizedWhitespaceCodeContains(
          `revoke all on function public.${name}(${signature}) from ${role};`
        )
      ).toBe(true);
    }
  });

  it.each(FUNCTION_NAMES)("%s grants execute only to authenticated", (name) => {
    const signature = FUNCTION_SIGNATURES[name];
    expect(
      normalizedWhitespaceCodeContains(
        `grant execute on function public.${name}(${signature}) to authenticated;`
      )
    ).toBe(true);
  });

  it("grants execute to no function for public, anon or service_role", () => {
    const grants = code.match(/^grant execute on function[^;]*;/gm) ?? [];
    expect(grants.length).toBe(FUNCTION_NAMES.length);
    for (const grant of grants) {
      expect(grant.toLowerCase()).not.toMatch(/\bto public\b/);
      expect(grant.toLowerCase()).not.toMatch(/\bto anon\b/);
      expect(grant.toLowerCase()).not.toMatch(/\bto service_role\b/);
    }
  });

  it("grants no direct table DML (insert/update/delete) on any table -- no broad authenticated grant was added", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    for (const grant of grants) {
      const normalized = grant.toLowerCase();
      if (normalized.startsWith("grant execute")) {
        continue;
      }
      expect(normalized).not.toMatch(/\b(insert|update|delete)\b/);
    }
  });

  it("this migration contains no bare 'grant ... on table public.share_messages ... to authenticated' statement of any kind", () => {
    expect(normalizedCode).not.toMatch(/grant\s+(insert|update|delete)[^;]*on table public\.share_messages/);
  });

  it("does not modify any RLS policy, trigger, or constraint anywhere", () => {
    expect(normalizedCode).not.toMatch(/create policy/);
    expect(normalizedCode).not.toMatch(/alter policy/);
    expect(normalizedCode).not.toMatch(/drop policy/);
    expect(normalizedCode).not.toMatch(/create trigger/);
    expect(normalizedCode).not.toMatch(/drop trigger/);
    expect(normalizedCode).not.toMatch(/alter table/);
    expect(normalizedCode).not.toMatch(/create index/);
    expect(normalizedCode).not.toMatch(/create table/);
  });
});

describe("202608190001 - send_share_message_reply owner/link/parent scoping", () => {
  const body = normalizedWhitespaceBodies.send_share_message_reply;

  it("scopes the link lookup by owner", () => {
    expect(body).toContain("from public.project_share_links as link where link.id = p_share_link_id and link.user_id = v_user_id");
  });

  it("checks the linked project is not soft-deleted", () => {
    expect(body).toContain("project.deleted_at");
    expect(body).toContain("if v_project_deleted_at is not null then");
  });

  it("scopes the parent message lookup by owner", () => {
    expect(body).toContain("from public.share_messages as message where message.id = p_parent_message_id and message.user_id = v_user_id");
  });

  it("rejects a parent message belonging to a different share link", () => {
    expect(body).toContain("if v_parent_share_link_id <> p_share_link_id then");
    expect(body).toContain("message = 'SHARE_MESSAGE_PARENT_LINK_MISMATCH'");
  });

  it("rejects a nonexistent parent message", () => {
    expect(body).toContain("message = 'SHARE_MESSAGE_PARENT_NOT_FOUND'");
  });

  it("validates body length identically to share_messages_body_check (1-4000 trimmed characters)", () => {
    expect(body).toContain("v_trimmed_body := btrim(coalesce(p_body, ''));");
    expect(body).toContain("if char_length(v_trimmed_body) < 1 then");
    expect(body).toContain("message = 'SHARE_MESSAGE_BODY_EMPTY'");
    expect(body).toContain("if char_length(p_body) > 4000 then");
    expect(body).toContain("message = 'SHARE_MESSAGE_BODY_TOO_LONG'");
  });

  it("hardcodes author_type='owner' and is_visible_to_client=true in the insert -- neither is caller-supplied", () => {
    expect(body).toContain("'owner', null, p_body, p_parent_message_id, true, 'reviewed', v_now");
  });

  it("never sets status to 'converted'", () => {
    expect(bodies.send_share_message_reply).not.toContain("'converted'");
  });
});

describe("202608190001 - set_share_message_status", () => {
  const body = normalizedWhitespaceBodies.set_share_message_status;

  it("accepts only the four Phase 5 statuses, explicitly excluding 'converted'", () => {
    expect(body).toContain("if p_status is null or p_status not in ('new', 'reviewed', 'resolved', 'dismissed') then");
    expect(body).toContain("message = 'SHARE_MESSAGE_STATUS_INVALID'");
    expect(bodies.set_share_message_status).not.toMatch(/'converted'/);
  });

  it("scopes the message lookup by owner and locks the row FOR UPDATE", () => {
    expect(body).toContain("from public.share_messages as message where message.id = p_message_id and message.user_id = v_user_id for update");
  });

  it("checks the message's own (denormalized) project is not soft-deleted", () => {
    expect(body).toContain("project.deleted_at");
    expect(body).toContain("if v_project_deleted_at is not null then");
  });

  it("the UPDATE statement touches only status, reviewed_at, resolved_at -- never body/author_type/author_display_name/parent_id/share_link_id/project_id/user_id/created_at", () => {
    const updateMatch = bodies.set_share_message_status.match(
      /update public\.share_messages\s+set([\s\S]*?)where/
    );
    expect(updateMatch).not.toBeNull();
    const setClause = (updateMatch as RegExpMatchArray)[1].toLowerCase();
    expect(setClause).toContain("status");
    expect(setClause).toContain("reviewed_at");
    expect(setClause).toContain("resolved_at");
    for (const forbidden of [
      "body =",
      "author_type =",
      "author_display_name =",
      "parent_id =",
      "share_link_id =",
      "project_id =",
      "user_id =",
      "created_at =",
    ]) {
      expect(setClause).not.toContain(forbidden);
    }
  });

  it("implements the exact documented timestamp semantics per status", () => {
    // new
    expect(body).toContain("if p_status = 'new' then v_reviewed_at := null; v_resolved_at := null;");
    // reviewed
    expect(body).toContain("elsif p_status = 'reviewed' then v_reviewed_at := v_now; v_resolved_at := null;");
    // resolved
    expect(body).toContain("elsif p_status = 'resolved' then v_reviewed_at := coalesce(v_existing_reviewed_at, v_now); v_resolved_at := v_now;");
    // dismissed (the trailing else branch -- its own inline `-- dismissed`
    // comment is stripped by stripLineComments before this string is built)
    expect(body).toContain("else v_reviewed_at := v_now; v_resolved_at := null;");
  });
});

describe("202608190001 - Phase 6 boundary (hard test)", () => {
  // Checked against `normalizedExecutable` (comment-on statements
  // stripped, not just line comments) -- the two functions' own
  // `comment on function ... is '...'` documentation strings correctly
  // NAME these tables while explaining they are never touched, so
  // checking the un-stripped `normalizedCode` would trivially fail on
  // that prose. The EXECUTABLE SQL itself (what `normalizedExecutable`
  // isolates) is what must never reference them.
  it("this migration's executable SQL never references share_message_conversions", () => {
    expect(normalizedExecutable).not.toContain("share_message_conversions");
  });

  it("this migration's executable SQL never references project_updates", () => {
    expect(normalizedExecutable).not.toContain("project_updates");
  });

  it("this migration's executable SQL never references project_timeline_events", () => {
    expect(normalizedExecutable).not.toContain("project_timeline_events");
  });

  it("this migration never writes to public.tasks (no insert/update/delete)", () => {
    expect(normalizedExecutable).not.toMatch(/insert into public\.tasks/);
    expect(normalizedExecutable).not.toMatch(/update public\.tasks/);
    expect(normalizedExecutable).not.toMatch(/delete from public\.tasks/);
  });

  it("this migration never writes to public.projects, public.clients, or public.task_resources", () => {
    for (const table of ["public.projects", "public.clients", "public.task_resources"]) {
      expect(normalizedExecutable).not.toMatch(new RegExp(`insert into ${table}\\b`));
      expect(normalizedExecutable).not.toMatch(new RegExp(`update ${table}\\b`));
      expect(normalizedExecutable).not.toMatch(new RegExp(`delete from ${table}\\b`));
    }
  });

  it("this migration writes (insert/update) to no table other than public.share_messages", () => {
    const writes = normalizedExecutable.match(/(insert into|update)\s+public\.\w+/g) ?? [];
    expect(writes.length).toBeGreaterThan(0);
    for (const write of writes) {
      expect(write).toContain("public.share_messages");
    }
  });

  it("neither function's status vocabulary includes 'converted' anywhere in this migration", () => {
    expect(normalizedCode).not.toContain("'converted'");
  });
});

describe("202608190001 - no session/grant table access, no anonymous/service-role path", () => {
  it("no function references share_browser_sessions or share_session_grants", () => {
    expect(normalizedCode).not.toContain("share_browser_sessions");
    expect(normalizedCode).not.toContain("share_session_grants");
  });

  it("no function references current_role or service_role -- owner-authenticated only, unlike the client-write path in enforce_share_message_integrity", () => {
    expect(normalizedCode).not.toContain("current_role");
    expect(normalizedCode).not.toContain("service_role'");
  });
});
