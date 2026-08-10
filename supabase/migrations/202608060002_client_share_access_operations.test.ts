import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608060001_client_share_lifecycle_operations.test.ts).
const MIGRATION_PATH = path.join(
  __dirname,
  "202608060002_client_share_access_operations.sql"
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

const FUNCTION_SIGNATURES = {
  set_share_link_pin: "uuid, text, text, smallint, integer, integer, integer, integer",
  clear_share_link_pin: "uuid",
  set_share_link_expiry: "uuid, timestamptz",
  clear_share_link_expiry: "uuid",
  rotate_share_link_secret: "uuid, text, smallint, text, text, text, smallint",
  revoke_share_link: "uuid",
  reveal_share_link_secret: "uuid",
} as const;

const FUNCTION_NAMES = Object.keys(
  FUNCTION_SIGNATURES
) as (keyof typeof FUNCTION_SIGNATURES)[];

const MUTATING_FUNCTION_NAMES = FUNCTION_NAMES.filter(
  (name) => name !== "reveal_share_link_secret"
);

const bodies = Object.fromEntries(
  FUNCTION_NAMES.map((name) => [name, extractFunctionBody(code, name)])
) as Record<(typeof FUNCTION_NAMES)[number], string>;

const normalizedWhitespaceBodies = Object.fromEntries(
  FUNCTION_NAMES.map((name) => [name, normalizeWhitespace(bodies[name])])
) as Record<(typeof FUNCTION_NAMES)[number], string>;

function normalizedWhitespaceCodeContains(fragment: string): boolean {
  return normalizeWhitespace(code).includes(normalizeWhitespace(fragment));
}

describe("202608060002 - all seven RPC signatures, security posture and auth handling", () => {
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

  it("uses SECURITY INVOKER nowhere among the seven functions", () => {
    for (const name of FUNCTION_NAMES) {
      expect(bodies[name]).not.toContain("security invoker");
    }
  });

  it.each(FUNCTION_NAMES)("%s obtains and null-checks auth.uid() internally", (name) => {
    const body = bodies[name];
    expect(body).toContain("v_user_id uuid := auth.uid();");
    expect(body).toContain("if v_user_id is null then");
    expect(body).toContain("message = 'UNAUTHORIZED'");
  });

  it.each(FUNCTION_NAMES)("%s accepts no user_id or project_id parameter", (name) => {
    const startMarker = `create or replace function public.${name}(`;
    const startIndex = code.indexOf(startMarker);
    const paramsEnd = code.indexOf(")\nreturns", startIndex);
    const paramList = code.slice(startIndex + startMarker.length, paramsEnd).toLowerCase();
    expect(paramList).not.toMatch(/p_user_id/);
    expect(paramList).not.toMatch(/p_project_id/);
  });

  it("contains no dynamic SQL (EXECUTE statement) anywhere in the migration", () => {
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+'/);
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+format\(/);
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+v_/);
  });

  it.each(FUNCTION_NAMES)(
    "%s verifies the linked project exists and is not deleted, without a separate route-level SELECT",
    (name) => {
      const body = bodies[name];
      expect(body).toContain("from public.projects as project");
      expect(body).toContain("project.deleted_at");
      expect(body).toContain("if v_project_deleted_at is not null then");
      expect(body).toContain("message = 'SHARE_LINK_NOT_FOUND'");
    }
  );

  it.each(FUNCTION_NAMES)(
    "%s returns SHARE_LINK_NOT_FOUND for a nonexistent, other-owner, or deleted-project target -- never reveals existence otherwise",
    (name) => {
      const body = bodies[name];
      expect(body).toContain("and link.user_id = v_user_id");
      const notFoundOccurrences = body.match(/message = 'SHARE_LINK_NOT_FOUND'/g) ?? [];
      expect(notFoundOccurrences.length).toBeGreaterThanOrEqual(2);
    }
  );
});

describe("202608060002 - row locking discipline", () => {
  it.each(MUTATING_FUNCTION_NAMES)("%s locks the target link row FOR UPDATE", (name) => {
    const normalizedBody = normalizedWhitespaceBodies[name];
    expect(normalizedBody).toContain(
      "from public.project_share_links as link where link.id = p_link_id and link.user_id = v_user_id for update"
    );
  });

  it("reveal_share_link_secret does not lock the link row -- it is a pure read", () => {
    const normalizedBody = normalizedWhitespaceBodies.reveal_share_link_secret;
    expect(normalizedBody).not.toContain(
      "from public.project_share_links as link where link.id = p_link_id and link.user_id = v_user_id for update"
    );
  });
});

describe("202608060002 - function privilege hardening", () => {
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

  it("grants no direct table DML (insert/update/delete) on any table", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    for (const grant of grants) {
      const normalized = grant.toLowerCase();
      if (normalized.startsWith("grant execute")) {
        continue;
      }
      expect(normalized).not.toMatch(/\b(insert|update|delete)\b/);
    }
  });

  it("does not modify any RLS policy anywhere", () => {
    expect(normalizedCode).not.toMatch(/create policy/);
    expect(normalizedCode).not.toMatch(/alter policy/);
    expect(normalizedCode).not.toMatch(/drop policy/);
  });

  it("does not modify any existing trigger or constraint", () => {
    expect(normalizedCode).not.toMatch(/create trigger/);
    expect(normalizedCode).not.toMatch(/drop trigger/);
    expect(normalizedCode).not.toMatch(/alter table[^;]*add constraint/);
    expect(normalizedCode).not.toMatch(/alter table[^;]*drop constraint/);
  });
});

describe("202608060002 - no session/grant table access anywhere", () => {
  it("no function references share_browser_sessions", () => {
    expect(normalizedCode).not.toContain("share_browser_sessions");
  });

  it("no function references share_session_grants", () => {
    expect(normalizedCode).not.toContain("share_session_grants");
  });

  it.each(FUNCTION_NAMES)(
    "%s performs no insert/update/delete against any session or grant table",
    (name) => {
      const body = bodies[name].toLowerCase();
      expect(body).not.toMatch(/insert into public\.share_(browser_sessions|session_grants)/);
      expect(body).not.toMatch(/update public\.share_(browser_sessions|session_grants)/);
      expect(body).not.toMatch(/delete from public\.share_(browser_sessions|session_grants)/);
    }
  );
});

describe("202608060002 - session-invalidation / configuration_version contract documentation", () => {
  it("documents the configuration_version invalidation contract with the required concepts", () => {
    expect(normalizedCode).toContain("granted_configuration_version");
    expect(normalizedCode).toContain("phase 3");
    expect(normalizedCode).toMatch(/stale/);
  });
});

describe("202608060002 - set_share_link_pin behavior", () => {
  const body = bodies.set_share_link_pin;

  it("accepts no plaintext PIN parameter -- only an already-hashed V1 profile", () => {
    expect(code).toContain(
      "create or replace function public.set_share_link_pin(\n  p_link_id uuid,\n  p_pin_hash text,\n  p_pin_salt text,\n  p_pin_hash_version smallint,\n  p_pin_scrypt_n integer,\n  p_pin_scrypt_r integer,\n  p_pin_scrypt_p integer,\n  p_pin_key_length integer\n)"
    );
    expect(body.toLowerCase()).not.toMatch(/p_pin_plaintext/);
    expect(body.toLowerCase()).not.toMatch(/p_pin_value/);
    expect(body.toLowerCase()).not.toMatch(/p_pin(?!_hash|_salt|_scrypt|_key_length)/);
  });

  it("validates every PIN field against the exact V1 profile before any mutation", () => {
    expect(body).toContain("p_pin_hash !~ '^[A-Za-z0-9_-]{43}$'");
    expect(body).toContain("p_pin_salt !~ '^[A-Za-z0-9_-]{22}$'");
    expect(body).toContain("p_pin_hash_version <> 1");
    expect(body).toContain("p_pin_scrypt_n <> 16384");
    expect(body).toContain("p_pin_scrypt_r <> 8");
    expect(body).toContain("p_pin_scrypt_p <> 1");
    expect(body).toContain("p_pin_key_length <> 32");

    const updateIndex = body.indexOf("update public.project_share_links");
    for (const validationMessage of [
      "INVALID_PIN_MATERIAL'",
    ]) {
      const messageIndex = body.indexOf(`message = '${validationMessage.replace("'", "")}`);
      expect(messageIndex).toBeGreaterThan(-1);
      expect(messageIndex).toBeLessThan(updateIndex);
    }
  });

  it("pin_hash is required to be exactly 43 base64url characters and pin_salt exactly 22", () => {
    expect(body).toContain("{43}$'");
    expect(body).toContain("{22}$'");
  });

  it("rejects a revoked link", () => {
    expect(body).toContain("if v_link_state = 'revoked' then");
    expect(body).toContain("message = 'SHARE_LINK_REVOKED'");
  });

  it("sets all seven PIN columns in one UPDATE statement", () => {
    const updateStart = body.indexOf("update public.project_share_links");
    const updateEnd = body.indexOf(";", updateStart);
    const updateText = body.slice(updateStart, updateEnd).toLowerCase();
    for (const column of [
      "pin_hash = p_pin_hash",
      "pin_salt = p_pin_salt",
      "pin_hash_version = p_pin_hash_version",
      "pin_scrypt_n = p_pin_scrypt_n",
      "pin_scrypt_r = p_pin_scrypt_r",
      "pin_scrypt_p = p_pin_scrypt_p",
      "pin_key_length = p_pin_key_length",
    ]) {
      expect(updateText).toContain(column);
    }
    const updateStatements = body.match(/update public\.project_share_links/g) ?? [];
    expect(updateStatements).toHaveLength(1);
  });

  it("increases configuration_version exactly once", () => {
    expect(body).toContain("v_new_configuration_version := v_link_configuration_version + 1;");
    const versionAssignments = body.match(/v_new_configuration_version :=/g) ?? [];
    expect(versionAssignments).toHaveLength(1);
    expect(body).toContain("configuration_version = v_new_configuration_version");
  });

  it("writes no event -- no PIN event exists in the closed vocabulary", () => {
    expect(body).not.toContain("insert into public.share_link_events");
  });

  it("returns only linkId, hasPin, state, configurationVersion, updatedAt -- never PIN material, user id or project id", () => {
    expect(body).toContain(
      "return jsonb_build_object(\n    'linkId', p_link_id,\n    'hasPin', true,\n    'state', v_link_state,\n    'configurationVersion', v_new_configuration_version,\n    'updatedAt', v_now\n  );"
    );
    const returnStart = body.indexOf("return jsonb_build_object(");
    const returnBlock = body.slice(returnStart).toLowerCase();
    for (const forbidden of ["pinhash", "pinsalt", "userid", "projectid", "pin_hash", "pin_salt"]) {
      expect(returnBlock).not.toContain(forbidden);
    }
  });

  it("is allowed in every non-revoked state -- no additional state restriction beyond revoked", () => {
    const lowered = body.toLowerCase();
    expect(lowered).not.toContain("if v_link_state <> 'draft'");
    expect(lowered).not.toContain("if v_link_state <> 'active'");
    expect(lowered).not.toContain("not in ('active'");
  });
});

describe("202608060002 - clear_share_link_pin behavior", () => {
  const body = bodies.clear_share_link_pin;

  it("rejects a revoked link", () => {
    expect(body).toContain("if v_link_state = 'revoked' then");
    expect(body).toContain("message = 'SHARE_LINK_REVOKED'");
  });

  it("sets all seven PIN columns to null in one UPDATE statement when a PIN exists", () => {
    const updateStart = body.indexOf("update public.project_share_links");
    const updateEnd = body.indexOf(";", updateStart);
    const updateText = body.slice(updateStart, updateEnd).toLowerCase();
    for (const column of [
      "pin_hash = null",
      "pin_salt = null",
      "pin_hash_version = null",
      "pin_scrypt_n = null",
      "pin_scrypt_r = null",
      "pin_scrypt_p = null",
      "pin_key_length = null",
    ]) {
      expect(updateText).toContain(column);
    }
  });

  it("is an idempotent no-op with no configuration_version bump when no PIN exists", () => {
    expect(body).toContain("if not v_link_has_pin then");
    const noOpBranchStart = body.indexOf("if not v_link_has_pin then");
    const noOpBranchEnd = body.indexOf("end if;", noOpBranchStart);
    const noOpBranch = body.slice(noOpBranchStart, noOpBranchEnd);
    expect(noOpBranch).toContain("'configurationVersion', v_link_configuration_version");
    expect(noOpBranch).not.toContain("v_new_configuration_version");
  });

  it("increases configuration_version exactly once only when a PIN genuinely existed", () => {
    const versionAssignments = body.match(/v_new_configuration_version :=/g) ?? [];
    expect(versionAssignments).toHaveLength(1);
    expect(body).toContain("v_new_configuration_version := v_link_configuration_version + 1;");
  });

  it("writes no event and touches no session/grant table", () => {
    expect(body).not.toContain("insert into public.share_link_events");
  });

  it("returns only linkId, hasPin=false, state, configurationVersion, updatedAt", () => {
    const returnBlocks = body.match(/return jsonb_build_object\([\s\S]*?\);/g) ?? [];
    expect(returnBlocks.length).toBe(2);
    for (const block of returnBlocks) {
      expect(block).toContain("'hasPin', false");
      expect(block.toLowerCase()).not.toContain("pinhash");
      expect(block.toLowerCase()).not.toContain("pinsalt");
    }
  });
});

describe("202608060002 - set_share_link_expiry behavior", () => {
  const body = bodies.set_share_link_expiry;

  it("rejects a null expiry", () => {
    expect(body).toContain("if p_expires_at is null then");
    expect(body).toContain("message = 'INVALID_EXPIRY'");
  });

  it("requires expiry to be strictly in the future relative to the transaction timestamp", () => {
    expect(body).toContain("if p_expires_at <= v_now then");
    expect(body).toContain("message = 'INVALID_EXPIRY'");
  });

  it("rejects a revoked link", () => {
    expect(body).toContain("if v_link_state = 'revoked' then");
    expect(body).toContain("message = 'SHARE_LINK_REVOKED'");
  });

  it("does not silently change state and does not auto-mark expired or auto-reactivate", () => {
    const updateStart = body.indexOf("update public.project_share_links");
    const updateEnd = body.indexOf(";", updateStart);
    const updateText = body.slice(updateStart, updateEnd).toLowerCase();
    expect(updateText).not.toContain("state =");
  });

  it("is an exact no-op with no configuration_version bump when the value is genuinely unchanged", () => {
    expect(body).toContain(
      "if v_link_expires_at is not null and v_link_expires_at = p_expires_at then"
    );
    const noOpBranchStart = body.indexOf(
      "if v_link_expires_at is not null and v_link_expires_at = p_expires_at then"
    );
    const noOpBranchEnd = body.indexOf("end if;", noOpBranchStart);
    const noOpBranch = body.slice(noOpBranchStart, noOpBranchEnd);
    expect(noOpBranch).toContain("'configurationVersion', v_link_configuration_version");
  });

  it("increases configuration_version exactly once when the value genuinely changes", () => {
    const versionAssignments = body.match(/v_new_configuration_version :=/g) ?? [];
    expect(versionAssignments).toHaveLength(1);
  });

  it("writes no event and touches no session/grant table", () => {
    expect(body).not.toContain("insert into public.share_link_events");
  });

  it("returns linkId, state, expiresAt, configurationVersion, updatedAt", () => {
    const returnBlocks = body.match(/return jsonb_build_object\([\s\S]*?\);/g) ?? [];
    for (const block of returnBlocks) {
      expect(block).toContain("'linkId'");
      expect(block).toContain("'state'");
      expect(block).toContain("'expiresAt'");
      expect(block).toContain("'configurationVersion'");
      expect(block).toContain("'updatedAt'");
    }
  });
});

describe("202608060002 - clear_share_link_expiry behavior", () => {
  const body = bodies.clear_share_link_expiry;

  it("never invents an expired->active transition -- returns SHARE_LINK_STATE_CONFLICT for state = expired instead", () => {
    expect(body).toContain("if v_link_state = 'expired' then");
    const expiredBranchStart = body.indexOf("if v_link_state = 'expired' then");
    const expiredBranchEnd = body.indexOf("end if;", expiredBranchStart);
    const expiredBranch = body.slice(expiredBranchStart, expiredBranchEnd);
    expect(expiredBranch).toContain("message = 'SHARE_LINK_STATE_CONFLICT'");
    expect(expiredBranch.toLowerCase()).not.toContain("state = 'active'");
  });

  it("makes no mutation when state = expired -- the state-conflict branch precedes any UPDATE", () => {
    const expiredBranchIndex = body.indexOf("if v_link_state = 'expired' then");
    const updateIndex = body.indexOf("update public.project_share_links");
    expect(expiredBranchIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(-1);
    expect(expiredBranchIndex).toBeLessThan(updateIndex);
  });

  it("is an idempotent no-op with no configuration_version bump when expiry is already null", () => {
    expect(body).toContain("if v_link_expires_at is null then");
    const noOpBranchStart = body.indexOf("if v_link_expires_at is null then");
    const noOpBranchEnd = body.indexOf("end if;", noOpBranchStart);
    const noOpBranch = body.slice(noOpBranchStart, noOpBranchEnd);
    expect(noOpBranch).toContain("'configurationVersion', v_link_configuration_version");
  });

  it("increases configuration_version exactly once only when expiry was genuinely present", () => {
    const versionAssignments = body.match(/v_new_configuration_version :=/g) ?? [];
    expect(versionAssignments).toHaveLength(1);
  });

  it("writes no event and touches no session/grant table", () => {
    expect(body).not.toContain("insert into public.share_link_events");
  });

  it("returns the same safe shape as set_share_link_expiry", () => {
    const returnBlocks = body.match(/return jsonb_build_object\([\s\S]*?\);/g) ?? [];
    for (const block of returnBlocks) {
      expect(block).toContain("'linkId'");
      expect(block).toContain("'state'");
      expect(block).toContain("'expiresAt', null");
      expect(block).toContain("'configurationVersion'");
      expect(block).toContain("'updatedAt'");
    }
  });
});

describe("202608060002 - rotate_share_link_secret behavior", () => {
  const body = bodies.rotate_share_link_secret;

  it("accepts no plaintext-secret parameter -- only a digest and already-encrypted hex material, matching activate_share_link's shape exactly", () => {
    expect(code).toContain(
      "create or replace function public.rotate_share_link_secret(\n  p_link_id uuid,\n  p_secret_digest text,\n  p_secret_digest_version smallint,\n  p_ciphertext_hex text,\n  p_nonce_hex text,\n  p_auth_tag_hex text,\n  p_encryption_version smallint\n)"
    );
    expect(body.toLowerCase()).not.toMatch(/p_plaintext/);
    expect(body.toLowerCase()).not.toMatch(/p_raw_secret/);
  });

  it("validates the digest, digest version, ciphertext, nonce, auth tag and encryption version exactly as activate_share_link does, before any mutation", () => {
    expect(body).toContain("p_secret_digest !~ '^[0-9a-f]{64}$'");
    expect(body).toContain("p_secret_digest_version <> 1");
    expect(body).toContain("p_ciphertext_hex !~ '^[0-9a-f]{86}$'");
    expect(body).toContain("p_nonce_hex !~ '^[0-9a-f]{24}$'");
    expect(body).toContain("p_auth_tag_hex !~ '^[0-9a-f]{32}$'");
    expect(body).toContain("p_encryption_version <> 1");

    const firstMutationIndex = body.indexOf("update public.project_share_links");
    for (const validationMessage of [
      "INVALID_SECRET_DIGEST'",
      "INVALID_SECRET_DIGEST_VERSION'",
      "INVALID_CIPHERTEXT'",
      "INVALID_NONCE'",
      "INVALID_AUTH_TAG'",
      "INVALID_ENCRYPTION_VERSION'",
    ]) {
      const messageIndex = body.indexOf(validationMessage);
      expect(messageIndex).toBeGreaterThan(-1);
      expect(messageIndex).toBeLessThan(firstMutationIndex);
    }
  });

  it("is restricted to active and disabled states, rejecting draft, revoked and expired with a stable state conflict", () => {
    expect(body).toContain("if v_link_state not in ('active', 'disabled') then");
    expect(body).toContain("message = 'SHARE_LINK_STATE_CONFLICT'");
  });

  it("requires an existing secret_digest and exactly one existing project_share_secret_material row", () => {
    expect(body).toContain("if v_link_secret_digest is null then");
    expect(body).toContain(
      "from public.project_share_secret_material as material\n        where material.share_link_id = p_link_id"
    );
    const missingMaterialOccurrences =
      body.match(/message = 'SHARE_LINK_SECRET_MATERIAL_MISSING'/g) ?? [];
    expect(missingMaterialOccurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("updates project_share_links and project_share_secret_material atomically in the same function body", () => {
    expect(body).toContain("update public.project_share_links");
    expect(body).toContain("update public.project_share_secret_material");
    expect(body).toContain("decode(p_ciphertext_hex, 'hex')");
    expect(body).toContain("decode(p_nonce_hex, 'hex')");
    expect(body).toContain("decode(p_auth_tag_hex, 'hex')");
  });

  it("replaces secret_digest, secret_digest_version, rotated_at and configuration_version in one UPDATE statement, preserving state/public_id/activated_at/disabled_at/expires_at", () => {
    const linkUpdateStart = body.indexOf("update public.project_share_links");
    const linkUpdateEnd = body.indexOf(";", linkUpdateStart);
    const linkUpdateText = body.slice(linkUpdateStart, linkUpdateEnd).toLowerCase();
    expect(linkUpdateText).toContain("secret_digest = p_secret_digest");
    expect(linkUpdateText).toContain("secret_digest_version = p_secret_digest_version");
    expect(linkUpdateText).toContain("rotated_at = v_rotation_timestamp");
    expect(linkUpdateText).toContain("configuration_version = v_new_configuration_version");
    expect(linkUpdateText).not.toContain("state =");
    expect(linkUpdateText).not.toContain("public_id =");
    expect(linkUpdateText).not.toContain("activated_at =");
    expect(linkUpdateText).not.toContain("disabled_at =");
    expect(linkUpdateText).not.toContain("expires_at =");
    const linkUpdateStatements = body.match(/update public\.project_share_links/g) ?? [];
    expect(linkUpdateStatements).toHaveLength(1);
  });

  it("verifies both UPDATE statements affect exactly one row via GET DIAGNOSTICS", () => {
    const diagnosticsCalls = body.match(/get diagnostics v_updated_\w+_count = row_count;/g) ?? [];
    expect(diagnosticsCalls.length).toBe(2);
    expect(body).toContain("if v_updated_link_count <> 1 then");
    expect(body).toContain("if v_updated_material_count <> 1 then");
  });

  it("increases configuration_version exactly once", () => {
    const versionAssignments = body.match(/v_new_configuration_version :=/g) ?? [];
    expect(versionAssignments).toHaveLength(1);
  });

  it("writes exactly one content-free link_rotated event, with no identity digest, content or secret material", () => {
    expect(body).toContain(
      "insert into public.share_link_events (share_link_id, event_type)\n  values (p_link_id, 'link_rotated');"
    );
    const eventInserts = body.match(/insert into public\.share_link_events \([^)]*\)/g) ?? [];
    expect(eventInserts.length).toBe(1);
  });

  it("returns only linkId, publicId, state, configurationVersion, rotatedAt -- never encrypted material, digest, secret, owner or project identifiers", () => {
    const returnStart = body.indexOf("return jsonb_build_object(");
    const returnBlock = body.slice(returnStart).toLowerCase();
    for (const forbidden of [
      "secretdigest",
      "'digest'",
      "ciphertext",
      "nonce",
      "authtag",
      "auth_tag",
      "encryptionversion",
      "userid",
      "projectid",
    ]) {
      expect(returnBlock).not.toContain(forbidden);
    }
    expect(body).toContain(
      "return jsonb_build_object(\n    'linkId', p_link_id,\n    'publicId', v_link_public_id,\n    'state', v_link_state,\n    'configurationVersion', v_new_configuration_version,\n    'rotatedAt', v_rotation_timestamp\n  );"
    );
  });

  it("derives rotated_at from real wall-clock time (clock_timestamp()), never from the transaction-fixed now()", () => {
    expect(body).not.toContain("v_now timestamptz := now();");
    expect(body).not.toMatch(/\bv_now\b/);
    expect(body).toContain("v_rotation_timestamp timestamptz;");
    expect(body).toContain("v_rotation_timestamp := clock_timestamp();");
  });

  it("reads the row's own previous rotated_at under the same FOR UPDATE lock used for the rest of the rotation", () => {
    expect(body).toContain("v_link_rotated_at timestamptz;");
    const lockSelectStart = body.indexOf("select\n      link.state");
    const lockSelectEnd = body.indexOf("for update;", lockSelectStart);
    expect(lockSelectStart).toBeGreaterThan(-1);
    expect(lockSelectEnd).toBeGreaterThan(lockSelectStart);
    const lockSelect = body.slice(lockSelectStart, lockSelectEnd);
    expect(lockSelect).toContain("link.rotated_at");
    expect(lockSelect).toContain("v_link_rotated_at");
  });

  it("compares the clock_timestamp() candidate against the previous rotated_at and floors it to strictly exceed that value, guaranteeing a strictly monotonic rotated_at even for two rotations in one transaction or one clock tick", () => {
    const candidateIdx = body.indexOf("v_rotation_timestamp := clock_timestamp();");
    expect(candidateIdx).toBeGreaterThan(-1);
    const monotonicGuard = body.slice(candidateIdx, candidateIdx + 220);
    expect(monotonicGuard).toContain(
      "if v_link_rotated_at is not null and v_rotation_timestamp <= v_link_rotated_at then"
    );
    expect(monotonicGuard).toContain("v_rotation_timestamp := v_link_rotated_at + interval '1 microsecond';");
    // Strictly greater, not merely different: the guard's own comparison
    // uses <=, which rejects an equal candidate as well as a smaller one.
    expect(monotonicGuard).not.toContain("v_rotation_timestamp < v_link_rotated_at");
  });

  it("the monotonic timestamp is computed AFTER every validation/state/material check and BEFORE the first mutating UPDATE, so a rejected rotation never touches it", () => {
    const candidateIdx = body.indexOf("v_rotation_timestamp := clock_timestamp();");
    const firstMutationIndex = body.indexOf("update public.project_share_links");
    const lastValidationIndex = body.lastIndexOf("message = 'SHARE_LINK_SECRET_MATERIAL_MISSING'", candidateIdx);
    expect(lastValidationIndex).toBeGreaterThan(-1);
    expect(candidateIdx).toBeGreaterThan(lastValidationIndex);
    expect(firstMutationIndex).toBeGreaterThan(candidateIdx);
  });

  it("never uses pg_sleep or any artificial delay to force timestamp separation", () => {
    expect(body.toLowerCase()).not.toContain("pg_sleep");
  });

  it("does not change the semantics of any lifecycle timestamp other than rotated_at -- activated_at, disabled_at and expires_at remain absent from every SET clause in this function", () => {
    const setClauses = body.match(/set\s*\n(?:\s*\w+\s*=\s*[^,;]+,?\s*\n?)+/gi) ?? [];
    const combined = setClauses.join("\n").toLowerCase();
    expect(combined).not.toContain("activated_at =");
    expect(combined).not.toContain("disabled_at =");
    expect(combined).not.toContain("expires_at =");
    expect(combined).not.toContain("created_at =");
  });
});

describe("202608060002 - revoke_share_link behavior", () => {
  const body = bodies.revoke_share_link;

  it("treats revoked as terminal -- an already-revoked link returns a stable state conflict rather than replaying the mutation", () => {
    expect(body).toContain("if v_link_state = 'revoked' then");
    expect(body).toContain("message = 'SHARE_LINK_STATE_CONFLICT'");
  });

  it("allows revocation from every non-revoked state -- no additional state restriction", () => {
    const lowered = body.toLowerCase();
    expect(lowered).not.toContain("if v_link_state <> 'active'");
    expect(lowered).not.toContain("not in ('active'");
  });

  it("sets state = revoked and revoked_at, and increases configuration_version exactly once", () => {
    expect(body).toContain("state = 'revoked',\n      revoked_at = v_now,");
    const versionAssignments = body.match(/v_new_configuration_version :=/g) ?? [];
    expect(versionAssignments).toHaveLength(1);
    expect(body).toContain("configuration_version = v_new_configuration_version");
  });

  it("does not modify or delete project/task/resource/update content", () => {
    const lowered = body.toLowerCase();
    expect(lowered).not.toContain("delete from public.projects");
    expect(lowered).not.toContain("update public.projects");
    expect(lowered).not.toContain("share_link_tasks");
    expect(lowered).not.toContain("share_link_resources");
    expect(lowered).not.toContain("share_link_updates");
  });

  it("does not delete encrypted secret material -- no destructive cleanup is invented", () => {
    expect(body.toLowerCase()).not.toContain("delete from public.project_share_secret_material");
    expect(body.toLowerCase()).not.toContain("project_share_secret_material");
  });

  it("writes exactly one content-free link_revoked event", () => {
    expect(body).toContain(
      "insert into public.share_link_events (share_link_id, event_type)\n  values (p_link_id, 'link_revoked');"
    );
    const eventInserts = body.match(/insert into public\.share_link_events \([^)]*\)/g) ?? [];
    expect(eventInserts.length).toBe(1);
  });

  it("returns only linkId, state=revoked, configurationVersion, revokedAt", () => {
    expect(body).toContain(
      "return jsonb_build_object(\n    'linkId', p_link_id,\n    'state', 'revoked',\n    'configurationVersion', v_new_configuration_version,\n    'revokedAt', v_now\n  );"
    );
  });
});

describe("202608060002 - reveal_share_link_secret behavior", () => {
  const body = bodies.reveal_share_link_secret;

  it("allows reveal only for state = active -- draft, disabled, expired and revoked must not reveal", () => {
    expect(body).toContain("if v_link_state <> 'active' then");
    expect(body).toContain("message = 'SHARE_LINK_STATE_CONFLICT'");
  });

  it("requires secret_digest to exist, secret_digest_version = 1, and exactly one project_share_secret_material row", () => {
    expect(body).toContain("if v_link_secret_digest is null or v_link_secret_digest_version <> 1 then");
    expect(body).toContain("message = 'SHARE_LINK_SECRET_MATERIAL_MISSING'");
    expect(body).toContain("from public.project_share_secret_material as material");
    expect(body).toContain("if v_material_ciphertext is null then");
  });

  it("never decrypts and never returns plaintext -- only encoded encrypted material", () => {
    const lowered = body.toLowerCase();
    expect(lowered).not.toContain("decode(");
    expect(lowered).not.toContain("decrypt");
    expect(lowered).not.toContain("pgp_sym_decrypt");
  });

  it("returns lowercase-hex ciphertextHex, nonceHex, authTagHex and encryptionVersion via encode(..., 'hex')", () => {
    expect(body).toContain("encode(v_material_ciphertext, 'hex')");
    expect(body).toContain("encode(v_material_nonce, 'hex')");
    expect(body).toContain("encode(v_material_auth_tag, 'hex')");
    expect(body).toContain(
      "return jsonb_build_object(\n    'linkId', p_link_id,\n    'publicId', v_link_public_id,\n    'ciphertextHex', encode(v_material_ciphertext, 'hex'),\n    'nonceHex', encode(v_material_nonce, 'hex'),\n    'authTagHex', encode(v_material_auth_tag, 'hex'),\n    'encryptionVersion', v_material_encryption_version\n  );"
    );
  });

  it("does not update configuration_version, view counters, or write an event", () => {
    expect(body).not.toContain("v_new_configuration_version");
    expect(body).not.toContain("configuration_version =");
    expect(body).not.toContain("last_viewed_at");
    expect(body).not.toContain("view_count");
    expect(body).not.toContain("insert into public.share_link_events");
  });

  it("performs no INSERT, UPDATE or DELETE anywhere in its body -- pure read only", () => {
    const lowered = body.toLowerCase();
    expect(lowered).not.toMatch(/\binsert into\b/);
    expect(lowered).not.toMatch(/\bupdate public\./);
    expect(lowered).not.toMatch(/\bdelete from\b/);
  });
});

describe("202608060002 - event vocabulary and content-free discipline", () => {
  const ALLOWED_EVENT_TYPES = [
    "link_created",
    "link_activated",
    "link_viewed",
    "session_exchanged",
    "pin_failed",
    "comment_submitted",
    "owner_replied",
    "link_disabled",
    "link_rotated",
    "link_expired",
    "link_revoked",
    "shared_resource_opened",
    "rate_limit_triggered",
  ];

  it("writes only existing, allowed event_type values -- exactly link_rotated and link_revoked", () => {
    const eventInserts = code.match(/values \([^)]*'link_[a-z_]+'\)/g) ?? [];
    expect(eventInserts.length).toBe(2);
    const writtenTypes = new Set<string>();
    for (const insert of eventInserts) {
      const match = /'link_[a-z_]+'/.exec(insert);
      expect(match).not.toBeNull();
      if (match) {
        const eventType = match[0].replace(/'/g, "");
        expect(ALLOWED_EVENT_TYPES).toContain(eventType);
        writtenTypes.add(eventType);
      }
    }
    expect(writtenTypes).toEqual(new Set(["link_rotated", "link_revoked"]));
  });

  it("never widens the share_link_events event_type CHECK constraint", () => {
    expect(normalizedCode).not.toContain("share_link_events_event_type_check");
    expect(normalizedCode).not.toMatch(/alter table public\.share_link_events/);
  });

  it("every share_link_events insert supplies only share_link_id and event_type -- no identity, PIN or secret content column", () => {
    const eventInserts = code.match(/insert into public\.share_link_events \([^)]*\)/g) ?? [];
    expect(eventInserts.length).toBe(2);
    for (const insert of eventInserts) {
      expect(insert.replace(/\s+/g, " ")).toBe(
        "insert into public.share_link_events (share_link_id, event_type)"
      );
    }
  });

  it("PIN, expiry and reveal operations write no event at all", () => {
    for (const name of [
      "set_share_link_pin",
      "clear_share_link_pin",
      "set_share_link_expiry",
      "clear_share_link_expiry",
      "reveal_share_link_secret",
    ] as const) {
      expect(bodies[name]).not.toContain("insert into public.share_link_events");
    }
  });

  it("no event insert anywhere in this migration contains a PIN or secret value", () => {
    const eventInserts = code.match(/insert into public\.share_link_events[\s\S]*?;/g) ?? [];
    for (const insert of eventInserts) {
      const lowered = insert.toLowerCase();
      expect(lowered).not.toContain("pin_hash");
      expect(lowered).not.toContain("pin_salt");
      expect(lowered).not.toContain("secret_digest");
      expect(lowered).not.toContain("ciphertext");
    }
  });
});

describe("202608060002 - production-safety and scope boundaries", () => {
  it("does not modify any existing Client Share table's structure", () => {
    expect(normalizedCode).not.toMatch(/alter table public\.project_share_links\s+(add|drop|alter)/);
    expect(normalizedCode).not.toMatch(/alter table public\.project_share_secret_material\s+(add|drop|alter)/);
    expect(normalizedCode).not.toMatch(/alter table public\.share_link_tasks/);
    expect(normalizedCode).not.toMatch(/alter table public\.share_link_resources/);
    expect(normalizedCode).not.toMatch(/alter table public\.share_link_updates/);
  });

  it("creates no new table", () => {
    expect(normalizedCode).not.toMatch(/create table/);
  });

  it("implements no Phase 1B.4 function (save_share_configuration, task/resource mappings, update publication)", () => {
    for (const forbidden of [
      "save_share_configuration",
      "publish_share_update",
      "set_share_link_task_mapping",
      "set_share_link_resource_mapping",
    ]) {
      expect(normalizedCode).not.toContain(forbidden);
    }
  });

  it("does not redefine any Phase 1B.2 lifecycle function", () => {
    for (const forbidden of [
      "create_share_link_draft",
      "activate_share_link",
      "disable_share_link",
      "reenable_share_link",
    ]) {
      expect(normalizedCode).not.toContain(`create or replace function public.${forbidden}(`);
    }
  });

  it("does not define a down/rollback migration (forward-only, matching repo convention)", () => {
    expect(normalizedSql).not.toMatch(/^-- down/m);
    expect(normalizedCode).not.toMatch(/\brollback\b/);
  });

  it("comments every function", () => {
    for (const name of FUNCTION_NAMES) {
      expect(code).toContain(`comment on function public.${name}(`);
    }
  });
});
