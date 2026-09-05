import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608230002_client_share_apply_conversion_closure.test.ts).
//
// IMPORTANT: nothing in this file proves runtime behaviour (that a stale
// grant is actually rejected by a real Postgres engine, that the backfill
// default is actually applied metadata-only without a table rewrite, that
// the trigger's new checks actually fire in the stated order against real
// rows). It proves only that the migration declares exactly the structural
// contract the Phase 8 corrective-fix approval locks. Runtime verification
// against a disposable Postgres instance is a separate, user-run step --
// not faked here.

const MIGRATION_PATH = path.join(__dirname, "202608250001_client_share_access_epoch.sql");

const INTEGRITY_SOURCE_PATH = path.join(
  __dirname,
  "202608030005_client_share_integrity_and_security.sql"
);

const ACCESS_OPERATIONS_SOURCE_PATH = path.join(
  __dirname,
  "202608060002_client_share_access_operations.sql"
);

const PUBLICATION_INTENT_MIGRATION_PATH = path.join(
  __dirname,
  "202608110001_client_share_publication_intent.sql"
);

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
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

function statementsContaining(source: string, needle: string): string[] {
  return source.split(";").filter((statement) => statement.includes(needle));
}

// stripLineComments deletes `--` comment lines but leaves their surrounding
// blank lines behind, so a spot where this migration's own explanatory
// comment sits between two SQL statements collapses to 2+ blank lines
// instead of the single blank line the original (comment-free at that
// spot) source has. Collapsing repeats to one blank line makes the
// byte-identity reconstruction proofs compare structure, not incidental
// whitespace produced by comment placement.
function collapseBlankLines(source: string): string {
  return source.replace(/\n{3,}/g, "\n\n");
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

const sql = readNormalized(MIGRATION_PATH);
const code = stripLineComments(sql);
const normalizedCode = code.toLowerCase();
const executable = stripCommentOnStatements(code);
const normalizedExecutable = executable.toLowerCase();

const integrityBody = extractFunctionBody(code, "enforce_share_session_grant_integrity");
const rotateBody = extractFunctionBody(code, "rotate_share_link_secret");
const setPinBody = extractFunctionBody(code, "set_share_link_pin");

describe("202608250001 - does not edit any already-applied migration file", () => {
  it("this migration file itself is the only new file -- the four named historical migrations are read-only inputs, never targets of this test's own writes", () => {
    // This test file's own existence proves the corrective change shipped
    // as a NEW file; the sibling assertions below prove each function this
    // migration reproduces is reconstructible back to its own original,
    // untouched source file.
    expect(path.basename(MIGRATION_PATH)).toBe("202608250001_client_share_access_epoch.sql");
  });

  it("202608030005 (enforce_share_session_grant_integrity's original definition) is unmodified -- still declares the pre-correction body with no access_epoch/pin_epoch reference", () => {
    const originalSource = readNormalized(INTEGRITY_SOURCE_PATH);
    expect(originalSource).toContain("create or replace function public.enforce_share_session_grant_integrity()");
    expect(originalSource).not.toContain("access_epoch");
    expect(originalSource).not.toContain("pin_epoch");
  });

  it("202608060002 (rotate_share_link_secret/set_share_link_pin's original definitions) is unmodified -- still declares no access_epoch/pin_epoch reference", () => {
    const originalSource = readNormalized(ACCESS_OPERATIONS_SOURCE_PATH);
    expect(originalSource).toContain("create or replace function public.rotate_share_link_secret(");
    expect(originalSource).toContain("create or replace function public.set_share_link_pin(");
    expect(originalSource).not.toContain("access_epoch");
    expect(originalSource).not.toContain("pin_epoch");
  });

  it("202608110001 (publication intent, the source of the additive-column convention this migration follows) is unmodified", () => {
    const originalSource = readNormalized(PUBLICATION_INTENT_MIGRATION_PATH);
    expect(originalSource).toContain("add column title_visible");
  });
});

describe("202608250001 - source provenance: each reproduced function reconstructed from its own current live definition", () => {
  it("enforce_share_session_grant_integrity is reconstructed from 202608030005 with exactly the stated additions and one removal", () => {
    const originalSource = readNormalized(INTEGRITY_SOURCE_PATH);
    const originalBody = extractFunctionBody(
      stripLineComments(originalSource),
      "enforce_share_session_grant_integrity"
    );

    const declareAdditions = "  v_link_access_epoch integer;\n  v_link_pin_epoch integer;\n";
    const updateImmutabilityAdditions =
      "    if new.granted_access_epoch is distinct from old.granted_access_epoch then\n      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_ACCESS_EPOCH_IMMUTABLE';\n    end if;\n\n    if new.granted_pin_epoch is distinct from old.granted_pin_epoch then\n      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_EPOCH_IMMUTABLE';\n    end if;\n\n";
    const selectColumnAdditions = "      link.access_epoch,\n      link.pin_epoch,\n";
    const intoColumnAdditions = "      v_link_access_epoch,\n      v_link_pin_epoch,\n";
    const stalenessAdditions =
      "  if new.granted_access_epoch <> v_link_access_epoch then\n    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_ACCESS_EPOCH_STALE';\n  end if;\n\n  if new.granted_pin_epoch <> v_link_pin_epoch then\n    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_EPOCH_STALE';\n  end if;\n\n";
    const removedExpiryVsLinkCheck =
      "  if v_link_expires_at is not null and new.expires_at > v_link_expires_at then\n    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_EXPIRY_EXCEEDS_LINK';\n  end if;\n\n";

    expect(integrityBody).toContain(declareAdditions);
    expect(integrityBody).toContain(updateImmutabilityAdditions);
    expect(integrityBody).toContain(selectColumnAdditions);
    expect(integrityBody).toContain(intoColumnAdditions);
    expect(integrityBody).toContain(stalenessAdditions);
    expect(integrityBody).not.toContain(removedExpiryVsLinkCheck);
    expect(originalBody).toContain(removedExpiryVsLinkCheck);

    // Reverse every addition and reinsert the removed check; the result
    // must be byte-identical to the untouched original body.
    const withoutAdditions = integrityBody
      .replace(declareAdditions, "")
      .replace(updateImmutabilityAdditions, "")
      .replace(selectColumnAdditions, "")
      .replace(intoColumnAdditions, "")
      .replace(stalenessAdditions, "");

    const sessionExceedsMarker =
      "  if new.expires_at > v_session_expires_at then\n    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_EXPIRY_EXCEEDS_SESSION';\n  end if;\n\n";
    const reconstructed = collapseBlankLines(
      withoutAdditions.replace(sessionExceedsMarker, () => sessionExceedsMarker + removedExpiryVsLinkCheck)
    );

    expect(sha256(reconstructed)).toBe(sha256(collapseBlankLines(originalBody)));
  });

  it("rotate_share_link_secret is reconstructed from 202608060002 with exactly one addition: access_epoch = access_epoch + 1", () => {
    const originalSource = readNormalized(ACCESS_OPERATIONS_SOURCE_PATH);
    const originalBody = extractFunctionBody(
      stripLineComments(originalSource),
      "rotate_share_link_secret"
    );

    const oldSetClause =
      "  update public.project_share_links\n    set\n      secret_digest = p_secret_digest,\n      secret_digest_version = p_secret_digest_version,\n      rotated_at = v_rotation_timestamp,\n      configuration_version = v_new_configuration_version\n    where id = p_link_id\n      and user_id = v_user_id;";
    const newSetClause =
      "  update public.project_share_links\n    set\n      secret_digest = p_secret_digest,\n      secret_digest_version = p_secret_digest_version,\n      rotated_at = v_rotation_timestamp,\n      configuration_version = v_new_configuration_version,\n      access_epoch = access_epoch + 1\n    where id = p_link_id\n      and user_id = v_user_id;";

    expect(rotateBody).toContain(newSetClause);
    expect(originalBody).toContain(oldSetClause);
    expect(originalBody).not.toContain("access_epoch");

    const reconstructed = rotateBody.replace(newSetClause, () => oldSetClause);
    expect(sha256(reconstructed)).toBe(sha256(originalBody));
  });

  it("set_share_link_pin is reconstructed from 202608060002 with exactly one addition: pin_epoch = pin_epoch + 1", () => {
    const originalSource = readNormalized(ACCESS_OPERATIONS_SOURCE_PATH);
    const originalBody = extractFunctionBody(stripLineComments(originalSource), "set_share_link_pin");

    const oldSetClause =
      "  update public.project_share_links\n    set\n      pin_hash = p_pin_hash,\n      pin_salt = p_pin_salt,\n      pin_hash_version = p_pin_hash_version,\n      pin_scrypt_n = p_pin_scrypt_n,\n      pin_scrypt_r = p_pin_scrypt_r,\n      pin_scrypt_p = p_pin_scrypt_p,\n      pin_key_length = p_pin_key_length,\n      configuration_version = v_new_configuration_version\n    where id = p_link_id\n      and user_id = v_user_id;";
    const newSetClause =
      "  update public.project_share_links\n    set\n      pin_hash = p_pin_hash,\n      pin_salt = p_pin_salt,\n      pin_hash_version = p_pin_hash_version,\n      pin_scrypt_n = p_pin_scrypt_n,\n      pin_scrypt_r = p_pin_scrypt_r,\n      pin_scrypt_p = p_pin_scrypt_p,\n      pin_key_length = p_pin_key_length,\n      configuration_version = v_new_configuration_version,\n      pin_epoch = pin_epoch + 1\n    where id = p_link_id\n      and user_id = v_user_id;";

    expect(setPinBody).toContain(newSetClause);
    expect(originalBody).toContain(oldSetClause);
    expect(originalBody).not.toContain("pin_epoch");

    const reconstructed = setPinBody.replace(newSetClause, () => oldSetClause);
    expect(sha256(reconstructed)).toBe(sha256(originalBody));
  });

  it("each of the three reconstruction proofs is independent -- swapping any two source hashes would not accidentally match", () => {
    const integritySource = readNormalized(INTEGRITY_SOURCE_PATH);
    const accessOperationsSource = readNormalized(ACCESS_OPERATIONS_SOURCE_PATH);

    const hashes = [sha256(integritySource), sha256(accessOperationsSource)];
    expect(new Set(hashes).size).toBe(2);
  });
});

describe("202608250001 - schema additions", () => {
  it("adds access_epoch and pin_epoch to project_share_links as NOT NULL with a constant default of 1 (metadata-only, no backfill query needed)", () => {
    expect(normalizedExecutable).toContain(
      "alter table public.project_share_links\n  add column access_epoch integer not null default 1,\n  add column pin_epoch integer not null default 1;"
    );
  });

  it("adds granted_access_epoch and granted_pin_epoch to share_session_grants as NOT NULL with a constant default of 1", () => {
    expect(normalizedExecutable).toContain(
      "alter table public.share_session_grants\n  add column granted_access_epoch integer not null default 1,\n  add column granted_pin_epoch integer not null default 1;"
    );
  });

  it("adds a > 0 check constraint for all four new columns", () => {
    expect(normalizedExecutable).toContain("check (access_epoch > 0)");
    expect(normalizedExecutable).toContain("check (pin_epoch > 0)");
    expect(normalizedExecutable).toContain("check (granted_access_epoch > 0)");
    expect(normalizedExecutable).toContain("check (granted_pin_epoch > 0)");
  });

  it("uses no backfilling UPDATE statement -- the constant DEFAULT clause on the ADD COLUMN itself is the entire backfill (metadata-only per Postgres, matching 202608110001's established convention)", () => {
    expect(normalizedExecutable).not.toMatch(
      /update\s+public\.(project_share_links|share_session_grants)\s+set\s+(access_epoch|pin_epoch|granted_access_epoch|granted_pin_epoch)/
    );
  });

  it("creates no new table", () => {
    expect(normalizedExecutable).not.toMatch(/create table/);
  });

  it("does not touch project_updates, share_messages, or share_message_conversions", () => {
    expect(normalizedExecutable).not.toContain("project_updates");
    expect(normalizedExecutable).not.toContain("share_messages");
    expect(normalizedExecutable).not.toContain("share_message_conversions");
  });

  it("does not modify configuration_version's own column definition, default, or any existing bump site outside the three named functions", () => {
    const offending = statementsContaining(normalizedExecutable, "configuration_version").filter(
      (statement) => /\balter\s+table\b/.test(statement)
    );
    expect(offending).toEqual([]);
  });
});

describe("202608250001 - enforce_share_session_grant_integrity: new checks", () => {
  it("remains SECURITY INVOKER with a locked search_path (unchanged posture)", () => {
    expect(integrityBody).toContain("security invoker");
    expect(integrityBody).toContain("set search_path = public, pg_temp");
  });

  it("rejects an UPDATE that changes granted_access_epoch or granted_pin_epoch", () => {
    expect(integrityBody).toContain("SHARE_GRANT_ACCESS_EPOCH_IMMUTABLE");
    expect(integrityBody).toContain("SHARE_GRANT_PIN_EPOCH_IMMUTABLE");
  });

  it("rejects an INSERT whose granted_access_epoch or granted_pin_epoch does not match the link's live value", () => {
    expect(integrityBody).toContain("SHARE_GRANT_ACCESS_EPOCH_STALE");
    expect(integrityBody).toContain("SHARE_GRANT_PIN_EPOCH_STALE");
  });

  it("preserves SHARE_GRANT_CONFIGURATION_VERSION_STALE (configuration_version staleness is still enforced at the DB layer, even though it is no longer read as an authorization predicate at the application layer)", () => {
    expect(integrityBody).toContain("SHARE_GRANT_CONFIGURATION_VERSION_STALE");
  });

  it("removes SHARE_GRANT_EXPIRY_EXCEEDS_LINK entirely", () => {
    expect(integrityBody).not.toContain("SHARE_GRANT_EXPIRY_EXCEEDS_LINK");
  });

  it("preserves SHARE_GRANT_EXPIRY_EXCEEDS_SESSION and SHARE_GRANT_LINK_EXPIRED unchanged", () => {
    expect(integrityBody).toContain("SHARE_GRANT_EXPIRY_EXCEEDS_SESSION");
    expect(integrityBody).toContain("SHARE_GRANT_LINK_EXPIRED");
  });

  it("preserves every other existing error code untouched", () => {
    for (const errorCode of [
      "SHARE_GRANT_SESSION_IMMUTABLE",
      "SHARE_GRANT_LINK_IMMUTABLE",
      "SHARE_GRANT_CONFIGURATION_VERSION_IMMUTABLE",
      "SHARE_GRANT_PIN_VERIFICATION_IMMUTABLE",
      "SHARE_GRANT_CREATED_AT_IMMUTABLE",
      "SHARE_GRANT_EXPIRY_IMMUTABLE",
      "SHARE_GRANT_REVOCATION_IRREVERSIBLE",
      "SHARE_GRANT_REVOCATION_IMMUTABLE",
      "SHARE_GRANT_SESSION_NOT_FOUND",
      "SHARE_GRANT_SESSION_REVOKED",
      "SHARE_GRANT_SESSION_EXPIRED",
      "SHARE_GRANT_LINK_NOT_FOUND",
      "SHARE_GRANT_PROJECT_NOT_FOUND",
      "SHARE_GRANT_PROJECT_DELETED",
      "SHARE_GRANT_LINK_NOT_ACTIVE",
      "SHARE_GRANT_PIN_VERIFICATION_REQUIRED",
      "SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED",
    ]) {
      expect(integrityBody).toContain(errorCode);
    }
  });

  it("grants no privilege to any role on this trigger function (function is never directly callable, matching the live definition)", () => {
    for (const role of ["public", "anon", "authenticated", "service_role"]) {
      expect(normalizedExecutable).toMatch(
        new RegExp(
          `revoke all on function public\\.enforce_share_session_grant_integrity\\(\\)\\s*\\n\\s*from ${role};`
        )
      );
    }
    expect(normalizedExecutable).not.toMatch(
      /grant execute on function public\.enforce_share_session_grant_integrity/
    );
  });
});

describe("202608250001 - rotate_share_link_secret: access_epoch bump only, everything else unchanged", () => {
  it("keeps the exact same seven-argument signature", () => {
    expect(code).toContain(
      "create or replace function public.rotate_share_link_secret(\n  p_link_id uuid,\n  p_secret_digest text,\n  p_secret_digest_version smallint,\n  p_ciphertext_hex text,\n  p_nonce_hex text,\n  p_auth_tag_hex text,\n  p_encryption_version smallint\n)"
    );
  });

  it("remains SECURITY DEFINER", () => {
    expect(rotateBody).toContain("security definer");
  });

  it("bumps access_epoch by exactly 1 in the same UPDATE that bumps configuration_version", () => {
    expect(rotateBody).toMatch(
      /configuration_version = v_new_configuration_version,\s*\n\s*access_epoch = access_epoch \+ 1/
    );
  });

  it("does not touch pin_epoch at all", () => {
    expect(rotateBody).not.toContain("pin_epoch");
  });

  it("preserves the clock_timestamp()-floored rotated_at monotonicity logic", () => {
    expect(rotateBody).toContain("v_rotation_timestamp := clock_timestamp();");
    expect(rotateBody).toContain("v_rotation_timestamp := v_link_rotated_at + interval '1 microsecond';");
  });

  it("preserves every existing error code", () => {
    for (const errorCode of [
      "UNAUTHORIZED",
      "SHARE_LINK_NOT_FOUND",
      "INVALID_SECRET_DIGEST",
      "INVALID_SECRET_DIGEST_VERSION",
      "INVALID_CIPHERTEXT",
      "INVALID_NONCE",
      "INVALID_AUTH_TAG",
      "INVALID_ENCRYPTION_VERSION",
      "SHARE_LINK_STATE_CONFLICT",
      "SHARE_LINK_SECRET_MATERIAL_MISSING",
    ]) {
      expect(rotateBody).toContain(errorCode);
    }
  });

  it("still writes exactly one link_rotated event", () => {
    expect(rotateBody).toContain("insert into public.share_link_events (share_link_id, event_type)");
    expect(rotateBody).toContain("values (p_link_id, 'link_rotated');");
  });

  it("issues no grant/revoke statement naming rotate_share_link_secret with a broadened role set (existing authenticated-only EXECUTE posture is re-declared identically, not expanded)", () => {
    const grantStatements = statementsContaining(
      normalizedExecutable,
      "rotate_share_link_secret"
    ).filter((statement) => /\bgrant execute\b/.test(statement));
    expect(grantStatements).toHaveLength(1);
    expect(grantStatements[0]).toContain("to authenticated");
  });
});

describe("202608250001 - set_share_link_pin: pin_epoch bump only, everything else unchanged", () => {
  it("keeps the exact same eight-argument signature", () => {
    expect(code).toContain(
      "create or replace function public.set_share_link_pin(\n  p_link_id uuid,\n  p_pin_hash text,\n  p_pin_salt text,\n  p_pin_hash_version smallint,\n  p_pin_scrypt_n integer,\n  p_pin_scrypt_r integer,\n  p_pin_scrypt_p integer,\n  p_pin_key_length integer\n)"
    );
  });

  it("remains SECURITY DEFINER", () => {
    expect(setPinBody).toContain("security definer");
  });

  it("bumps pin_epoch by exactly 1 in the same UPDATE that bumps configuration_version", () => {
    expect(setPinBody).toMatch(
      /configuration_version = v_new_configuration_version,\s*\n\s*pin_epoch = pin_epoch \+ 1/
    );
  });

  it("does not touch access_epoch at all", () => {
    expect(setPinBody).not.toContain("access_epoch");
  });

  it("bumps pin_epoch unconditionally -- no branch distinguishes first-add from value-change (the RPC never has, matching its existing configuration_version bump)", () => {
    const updateStatement = setPinBody.slice(
      setPinBody.indexOf("update public.project_share_links"),
      setPinBody.indexOf("and user_id = v_user_id;") + "and user_id = v_user_id;".length
    );
    expect(updateStatement).not.toMatch(/if\s+.*then/);
  });

  it("preserves every existing error code, including SHARE_LINK_REVOKED", () => {
    for (const errorCode of ["UNAUTHORIZED", "SHARE_LINK_NOT_FOUND", "INVALID_PIN_MATERIAL", "SHARE_LINK_REVOKED"]) {
      expect(setPinBody).toContain(errorCode);
    }
  });

  it("still writes no share_link_events row and no session/grant row (matching the existing documented behavior)", () => {
    // This is an unstripped comment line -- check the raw sql, not `code`
    // (which strips `--` comment lines by design for the executable-only
    // assertions elsewhere in this file).
    expect(sql).toContain("No event: the closed share_link_events vocabulary has no PIN event.");
    expect(setPinBody).not.toContain("insert into public.share_link_events");
  });

  it("issues no grant/revoke statement naming set_share_link_pin with a broadened role set", () => {
    const grantStatements = statementsContaining(
      normalizedExecutable,
      "set_share_link_pin"
    ).filter((statement) => /\bgrant execute\b/.test(statement));
    expect(grantStatements).toHaveLength(1);
    expect(grantStatements[0]).toContain("to authenticated");
  });
});

describe("202608250001 - operations that must NOT bump either new field are never redefined by this migration", () => {
  it("does not CREATE OR REPLACE disable_share_link, reenable_share_link, clear_share_link_pin, set_share_link_expiry, clear_share_link_expiry, revoke_share_link, or save_share_configuration -- none of them needed to change", () => {
    for (const functionName of [
      "disable_share_link",
      "reenable_share_link",
      "clear_share_link_pin",
      "set_share_link_expiry",
      "clear_share_link_expiry",
      "revoke_share_link",
      "save_share_configuration",
    ]) {
      expect(normalizedCode).not.toContain(`create or replace function public.${functionName}(`);
    }
  });

  it("redefines exactly three functions in total", () => {
    const matches = normalizedCode.match(/create or replace function public\.\w+\(/g) ?? [];
    expect(matches).toHaveLength(3);
  });
});

describe("202608250001 - no RLS policy change, no privilege broadening, no plaintext secret exposure", () => {
  it("issues no CREATE POLICY, ALTER POLICY, or DROP POLICY statement", () => {
    expect(normalizedExecutable).not.toMatch(/(create|alter|drop)\s+policy/);
  });

  it("issues no ROW LEVEL SECURITY toggle", () => {
    expect(normalizedExecutable).not.toMatch(/row level security/);
  });

  it("every GRANT EXECUTE statement targets only authenticated (no new anon or public execute grant)", () => {
    const grantStatements = normalizedExecutable
      .split(";")
      .filter((statement) => /\bgrant execute\b/.test(statement));
    expect(grantStatements.length).toBeGreaterThan(0);
    for (const statement of grantStatements) {
      expect(statement).toContain("to authenticated");
      expect(statement).not.toContain("to anon");
      expect(statement).not.toContain("to public");
    }
  });

  it("introduces no new column or parameter capable of carrying a plaintext secret or plaintext PIN", () => {
    expect(normalizedExecutable).not.toMatch(/p_(secret|pin)\b(?!_hash|_salt|_digest|_scrypt|_key)/);
  });
});
