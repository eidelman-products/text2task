import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  __dirname,
  "202609030001_homepage_demo_claim_auth_continuation.sql"
);

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function stripLineComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

function stripCommentOnStatements(source: string): string {
  return source.replace(/comment on [\s\S]*?';/g, "");
}

function extractFunctionBody(source: string, functionName: string): string {
  const startMarker = `create or replace function public.${functionName}(`;
  const startIndex = source.indexOf(startMarker);

  if (startIndex === -1) {
    throw new Error(`Could not find function ${functionName}`);
  }

  const endMarker = "\n$$;";
  const endIndex = source.indexOf(endMarker, startIndex);

  if (endIndex === -1) {
    throw new Error(`Could not find end of function ${functionName}`);
  }

  return source.slice(startIndex, endIndex + endMarker.length);
}

const sql = readNormalized(MIGRATION_PATH);
const code = stripLineComments(sql);
const executable = stripCommentOnStatements(code);
const normalizedCode = code.toLowerCase();
const normalizedExecutable = executable.toLowerCase();

const FUNCTION_NAMES = [
  "prepare_homepage_demo_claim_auth_continuation",
  "claim_homepage_demo_project_v2",
  "prepare_homepage_demo_duplicate_override_v2",
  "claim_homepage_demo_project_with_duplicate_override_v2",
] as const;

const bodies = Object.fromEntries(
  FUNCTION_NAMES.map((name) => [name, extractFunctionBody(code, name)])
) as Record<(typeof FUNCTION_NAMES)[number], string>;

describe("202609030001 - additive pending-auth continuation schema", () => {
  it("adds only nullable continuation columns to homepage_demo_claims", () => {
    expect(code).toContain("alter table public.homepage_demo_claims");
    expect(code).toContain(
      "add column if not exists auth_continuation_token_hash text null"
    );
    expect(code).toContain(
      "add column if not exists auth_continuation_started_at timestamptz null"
    );
    expect(code).toContain(
      "add column if not exists auth_continuation_expires_at timestamptz null"
    );
    expect(code).toContain(
      "add column if not exists auth_continuation_consumed_at timestamptz null"
    );

    expect(normalizedExecutable).not.toContain("drop column");
    expect(normalizedExecutable).not.toContain("rename column");
    expect(normalizedExecutable).not.toContain("alter column");
  });

  it("stores only continuation token hashes and enforces lifecycle bounds", () => {
    expect(code).toContain(
      "auth_continuation_token_hash ~ '^[0-9a-f]{64}$'"
    );
    expect(code).toContain("auth_continuation_started_at < expires_at");
    expect(code).toContain(
      "auth_continuation_expires_at > auth_continuation_started_at"
    );
    expect(normalizedExecutable).not.toContain("auth_continuation_token text");
    expect(normalizedExecutable).not.toContain("raw_continuation");
    expect(normalizedExecutable).not.toContain("continuation_token text");
  });

  it("adds a partial unique index for continuation token hashes", () => {
    expect(code).toContain(
      "homepage_demo_claims_auth_continuation_token_hash_unique_idx"
    );
    expect(code).toContain("where auth_continuation_token_hash is not null");
  });
});

describe("202609030001 - service-role-only security posture", () => {
  it.each(FUNCTION_NAMES)("%s is SECURITY INVOKER with locked search_path", (name) => {
    const body = bodies[name];

    expect(body).toContain("security invoker");
    expect(body).toContain("set search_path = pg_catalog");
  });

  it("grants continuation tables/functions only to service_role", () => {
    expect(code).toContain(
      "from public, anon, authenticated"
    );

    const grantLines = normalizedCode
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("grant "));

    for (const role of ["public", "anon", "authenticated"]) {
      expect(normalizedCode).toContain(`from ${role}`);
      expect(grantLines.some((line) => line.endsWith(`to ${role};`))).toBe(
        false
      );
    }

    for (const name of FUNCTION_NAMES) {
      expect(code).toContain(`grant execute on function public.${name}`);
      expect(code).toContain("to service_role;");
    }
  });
});

describe("202609030001 - continuation lifecycle and TTL rules", () => {
  it("starts continuation only from an unexpired pending claim and fixes first-start expiry", () => {
    const body = bodies.prepare_homepage_demo_claim_auth_continuation;

    expect(body).toContain("v_claim.status <> 'pending'");
    expect(body).toContain("v_claim.expires_at <= v_now");
    expect(body).toContain(
      "auth_continuation_token_hash = p_candidate_continuation_token_hash"
    );
    expect(body).toContain("auth_continuation_started_at = v_now");
    expect(body).toContain(
      "v_now + (p_continuation_ttl_seconds * interval '1 second')"
    );
    expect(body).toContain("auth_continuation_token_hash is null");
  });

  it("reuses matching active continuation and does not slide expiry on retry", () => {
    const body = bodies.prepare_homepage_demo_claim_auth_continuation;

    expect(body).toContain("'continuation_reused'::text");
    expect(body).toContain("v_claim.auth_continuation_expires_at");
    expect(body).not.toContain("auth_continuation_expires_at = clock_timestamp()");
  });

  it("claim save v2 allows either short claim authority or valid continuation authority", () => {
    const body = bodies.claim_homepage_demo_project_v2;

    expect(body).toContain(
      "p_claim_token_hash is null\n      and p_auth_continuation_token_hash is null"
    );
    expect(body).toContain("p_claim_token_hash is not null");
    expect(body).toContain("p_auth_continuation_token_hash is not null");
    expect(body).toContain("v_has_claim_authority :=");
    expect(body).toContain("v_has_continuation_authority :=");
    expect(body).toContain("v_claim.auth_continuation_started_at < v_claim.expires_at");
    expect(body).toContain("v_claim.auth_continuation_expires_at > v_now");
    expect(body).toContain("auth_continuation_consumed_at");
  });
});

describe("202609030001 - retention keeps active continuations usable", () => {
  it("updates both legacy and current retention functions to skip active pending continuations", () => {
    expect(code).toContain(
      "create or replace function public.purge_expired_homepage_demo_trials"
    );
    expect(code).toContain(
      "create or replace function public.purge_homepage_demo_retention"
    );

    const activeContinuationPredicate =
      "claim.status = 'pending'\n          and claim.auth_continuation_token_hash is not null\n          and claim.auth_continuation_expires_at > v_now\n          and claim.auth_continuation_consumed_at is null";

    expect(code).toContain(activeContinuationPredicate);
  });
});
