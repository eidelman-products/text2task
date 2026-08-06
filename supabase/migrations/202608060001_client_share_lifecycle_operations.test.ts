import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608030005_client_share_integrity_and_security.test.ts
// and 202608050001_client_share_owner_reads.test.ts).
const MIGRATION_PATH = path.join(
  __dirname,
  "202608060001_client_share_lifecycle_operations.sql"
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
  create_share_link_draft: "uuid, text",
  activate_share_link: "uuid, text, smallint, text, text, text, smallint",
  disable_share_link: "uuid",
  reenable_share_link: "uuid",
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

describe("202608060001 - project_share_secret_material table definition", () => {
  it("defines the exact table with the required columns", () => {
    expect(code).toContain("create table public.project_share_secret_material (");
    expect(code).toContain(
      "share_link_id uuid primary key\n    references public.project_share_links(id) on delete cascade"
    );
    expect(code).toContain("ciphertext bytea not null");
    expect(code).toContain("nonce bytea not null");
    expect(code).toContain("auth_tag bytea not null");
    expect(code).toContain("encryption_version smallint not null");
    expect(code).toContain("created_at timestamptz not null default now()");
    expect(code).toContain("updated_at timestamptz not null default now()");
  });

  it("constrains nonce to exactly 12 bytes and auth_tag to exactly 16 bytes", () => {
    expect(code).toContain(
      "constraint project_share_secret_material_nonce_length_check\n    check (octet_length(nonce) = 12)"
    );
    expect(code).toContain(
      "constraint project_share_secret_material_auth_tag_length_check\n    check (octet_length(auth_tag) = 16)"
    );
  });

  it("requires ciphertext to be exactly 43 bytes (the V1 raw secret length, since AES-GCM adds no padding)", () => {
    expect(code).toContain(
      "constraint project_share_secret_material_ciphertext_length_check\n    check (octet_length(ciphertext) = 43)"
    );
  });

  it("no longer contains a broad non-empty-only ciphertext rule", () => {
    expect(normalizedCode).not.toContain("ciphertext_not_empty_check");
    expect(normalizedCode).not.toMatch(/octet_length\(ciphertext\)\s*>\s*0/);
  });

  it("pins encryption_version to exactly 1 for this V1 implementation", () => {
    expect(code).toContain(
      "constraint project_share_secret_material_encryption_version_check\n    check (encryption_version = 1)"
    );
  });

  it("requires updated_at to never predate created_at", () => {
    expect(code).toContain(
      "constraint project_share_secret_material_timestamp_order_check\n    check (updated_at >= created_at)"
    );
  });

  it("stores no plaintext, digest or project/user duplication column", () => {
    const tableStart = code.indexOf(
      "create table public.project_share_secret_material ("
    );
    const tableEnd = code.indexOf(");", tableStart);
    const tableBody = code.slice(tableStart, tableEnd).toLowerCase();

    for (const forbidden of [
      "plaintext",
      "secret_digest",
      "digest text",
      "project_id",
      "user_id",
      "pin_",
    ]) {
      expect(tableBody).not.toContain(forbidden);
    }
  });

  it("reuses the existing shared updated_at trigger helper, not a new one", () => {
    expect(code).toContain(
      "drop trigger if exists project_share_secret_material_set_updated_at\n  on public.project_share_secret_material;"
    );
    expect(code).toContain(
      "create trigger project_share_secret_material_set_updated_at\nbefore update on public.project_share_secret_material\nfor each row\nexecute function public.set_client_share_updated_at();"
    );
    expect(normalizedCode).not.toMatch(
      /create (or replace )?function public\.set_client_share_secret_material_updated_at/
    );
  });
});

describe("202608060001 - project_share_secret_material is fully closed", () => {
  it("enables RLS", () => {
    expect(code).toContain(
      "alter table public.project_share_secret_material enable row level security;"
    );
  });

  it("defines no policy of any kind on this table", () => {
    expect(normalizedCode).not.toMatch(
      /create policy[\s\S]*?on public\.project_share_secret_material/
    );
  });

  it("explicitly revokes from public, anon, authenticated and service_role", () => {
    expect(code).toContain(
      "revoke all on table public.project_share_secret_material from public;"
    );
    expect(code).toContain(
      "revoke all on table public.project_share_secret_material from anon;"
    );
    expect(code).toContain(
      "revoke all on table public.project_share_secret_material from authenticated;"
    );
    expect(code).toContain(
      "revoke all privileges\n  on table public.project_share_secret_material\n  from service_role;"
    );
  });

  it("grants nothing whatsoever on this table to any role", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    for (const grant of grants) {
      expect(grant.toLowerCase()).not.toContain(
        "public.project_share_secret_material"
      );
    }
  });
});

describe("202608060001 - corrected secret_digest column comment", () => {
  it("adds a new comment on project_share_links.secret_digest without editing migration 202608030003", () => {
    expect(code).toContain(
      "comment on column public.project_share_links.secret_digest is"
    );
  });

  it("clarifies secret_digest remains one-way, that encrypted material lives separately, and is never the verification value", () => {
    const commentStart = code.indexOf(
      "comment on column public.project_share_links.secret_digest is"
    );
    const commentEnd = code.indexOf(";", commentStart);
    const commentText = code.slice(commentStart, commentEnd).toLowerCase();

    expect(commentText).toContain("one-way");
    expect(commentText).toContain("project_share_secret_material");
    expect(commentText).toContain("never");
  });
});

describe("202608060001 - all four RPC signatures, security posture and auth handling", () => {
  it.each(FUNCTION_NAMES)("declares public.%s with the exact signature", (name) => {
    expect(code).toContain(
      `create or replace function public.${name}(`
    );
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

  it("uses SECURITY INVOKER nowhere among the four lifecycle functions", () => {
    for (const name of FUNCTION_NAMES) {
      expect(bodies[name]).not.toContain("security invoker");
    }
  });

  it.each(FUNCTION_NAMES)("%s obtains and checks auth.uid()", (name) => {
    const body = bodies[name];
    expect(body).toContain("v_user_id uuid := auth.uid();");
    expect(body).toContain("if v_user_id is null then");
    expect(body).toContain("message = 'UNAUTHORIZED'");
  });

  it.each(FUNCTION_NAMES)("%s accepts no user_id parameter", (name) => {
    const startMarker = `create or replace function public.${name}(`;
    const startIndex = code.indexOf(startMarker);
    const paramsEnd = code.indexOf(")", startIndex);
    const paramList = code
      .slice(startIndex + startMarker.length, paramsEnd)
      .toLowerCase();
    expect(paramList).not.toMatch(/p_user_id/);
  });

  it("contains no dynamic SQL (EXECUTE statement) anywhere in the migration", () => {
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+'/);
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+format\(/);
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+v_/);
  });
});

describe("202608060001 - function privilege hardening", () => {
  it.each(FUNCTION_NAMES)(
    "%s is revoked from public, anon and service_role",
    (name) => {
      const signature = FUNCTION_SIGNATURES[name];
      for (const role of ["public", "anon", "service_role"]) {
        expect(normalizedCode).toContain(
          `from ${role};`
        );
      }
      expect(code).toContain(
        `revoke all on function public.${name}(${signature})`
      );
    }
  );

  it.each(FUNCTION_NAMES)("%s grants execute only to authenticated", (name) => {
    const signature = FUNCTION_SIGNATURES[name];
    expect(normalizedWhitespaceCodeContains(
      `grant execute on function public.${name}(${signature}) to authenticated;`
    )).toBe(true);
  });

  it("grants execute to no lifecycle function for public, anon or service_role", () => {
    const grants = code.match(/^grant execute on function[^;]*;/gm) ?? [];
    for (const grant of grants) {
      expect(grant.toLowerCase()).not.toMatch(/\bto public\b/);
      expect(grant.toLowerCase()).not.toMatch(/\bto anon\b/);
      expect(grant.toLowerCase()).not.toMatch(/\bto service_role\b/);
    }
  });

  it("grants no direct table DML (insert/update/delete) on any Client Share table", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    for (const grant of grants) {
      const normalized = grant.toLowerCase();
      if (normalized.startsWith("grant execute")) {
        continue;
      }
      expect(normalized).not.toMatch(/\b(insert|update|delete)\b/);
    }
  });
});

function normalizedWhitespaceCodeContains(fragment: string): boolean {
  return normalizeWhitespace(code).includes(normalizeWhitespace(fragment));
}

describe("202608060001 - create_share_link_draft behavior", () => {
  const body = bodies.create_share_link_draft;
  const normalizedBody = normalizedWhitespaceBodies.create_share_link_draft;

  it("rejects an invalid or missing project id, and an archived project", () => {
    expect(body).toContain("message = 'PROJECT_NOT_FOUND'");
    expect(body).toContain("message = 'PROJECT_ARCHIVED'");
    expect(body).toContain("v_project_is_archived");
  });

  it("tightens its own public_id input validation to exactly the V1 24-character generator shape, not the table's future-compatible 16-64 range", () => {
    expect(body).toContain("p_public_id !~ '^[A-Za-z0-9_-]{24}$'");
    expect(body).not.toContain("p_public_id !~ '^[A-Za-z0-9_-]{16,64}$'");
    expect(body).toContain("message = 'INVALID_PUBLIC_ID'");
  });

  it("locks the owning project row before inserting", () => {
    expect(normalizedBody).toContain(
      "from public.projects as project where project.id = p_project_id for update"
    );
  });

  it("never sets state, secret_digest, pin or activation fields directly -- the draft insert relies on table defaults", () => {
    const insertStart = body.indexOf("insert into public.project_share_links (");
    const insertEnd = body.indexOf("returning", insertStart);
    const insertText = body.slice(insertStart, insertEnd).toLowerCase();
    expect(insertText).toContain("user_id");
    expect(insertText).toContain("project_id");
    expect(insertText).toContain("public_id");
    expect(insertText).not.toContain("secret_digest");
    expect(insertText).not.toContain("pin_hash");
    expect(insertText).not.toContain("state");
  });

  it("catches unique_violation, inspects the exact constraint name via GET STACKED DIAGNOSTICS, and maps only the public_id constraint to PUBLIC_ID_COLLISION", () => {
    expect(body).toContain("exception\n    when unique_violation then");
    expect(body).toContain("get stacked diagnostics v_constraint_name = constraint_name;");
    expect(body).toContain(
      "if v_constraint_name = 'project_share_links_public_id_unique' then"
    );
    expect(body).toContain("message = 'PUBLIC_ID_COLLISION'");
  });

  it("rethrows every unrelated unique violation rather than swallowing it", () => {
    expect(body).toContain("raise;\n  end;");
  });

  it("contains no procedural retry loop -- collision handling is a single attempt per call", () => {
    expect(normalizedExecutable).not.toMatch(/\bloop\b/);
    expect(normalizedExecutable).not.toMatch(/\bfor\b[^;]*\bin\b[^;]*\bloop\b/);
  });

  it("writes exactly one content-free link_created event", () => {
    expect(body).toContain(
      "insert into public.share_link_events (share_link_id, event_type)\n  values (v_link_id, 'link_created');"
    );
  });

  it("returns only linkId, publicId, state, createdAt", () => {
    const returnStart = body.indexOf("return jsonb_build_object(");
    const keys = [...body.slice(returnStart).matchAll(/'([a-zA-Z]+)',/g)].map(
      (m) => m[1]
    );
    expect(new Set(keys)).toEqual(
      new Set(["linkId", "publicId", "state", "createdAt"])
    );
  });
});

describe("202608060001 - activate_share_link behavior", () => {
  const body = bodies.activate_share_link;
  const normalizedBody = normalizedWhitespaceBodies.activate_share_link;

  it("accepts no plaintext-secret parameter -- only a digest and already-encrypted hex material", () => {
    expect(code).toContain(
      "create or replace function public.activate_share_link(\n  p_link_id uuid,\n  p_secret_digest text,\n  p_secret_digest_version smallint,\n  p_ciphertext_hex text,\n  p_nonce_hex text,\n  p_auth_tag_hex text,\n  p_encryption_version smallint\n)"
    );
    expect(normalizedCode).not.toMatch(/p_secret\b/);
    expect(normalizedCode).not.toMatch(/p_plaintext/);
    expect(normalizedCode).not.toMatch(/p_raw_secret/);
  });

  it("validates the digest, digest version, ciphertext, nonce, auth tag and encryption version before any mutation", () => {
    expect(body).toContain("message = 'INVALID_SECRET_DIGEST'");
    expect(body).toContain("message = 'INVALID_SECRET_DIGEST_VERSION'");
    expect(body).toContain("message = 'INVALID_CIPHERTEXT'");
    expect(body).toContain("message = 'INVALID_NONCE'");
    expect(body).toContain("message = 'INVALID_AUTH_TAG'");
    expect(body).toContain("message = 'INVALID_ENCRYPTION_VERSION'");

    const firstMutationIndex = Math.min(
      ...["update public.project_share_links", "insert into public.project_share_secret_material"]
        .map((needle) => body.indexOf(needle))
        .filter((index) => index !== -1)
    );
    for (const validationMessage of [
      "INVALID_SECRET_DIGEST'",
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

  it("requires nonce_hex to be exactly 24 hex characters (12 bytes) and auth_tag_hex exactly 32 (16 bytes)", () => {
    expect(body).toContain("p_nonce_hex !~ '^[0-9a-f]{24}$'");
    expect(body).toContain("p_auth_tag_hex !~ '^[0-9a-f]{32}$'");
  });

  it("requires ciphertext_hex to be exactly 86 lowercase hex characters (the V1 43-byte ciphertext), matching the table's own exact-length constraint", () => {
    expect(body).toContain("p_ciphertext_hex !~ '^[0-9a-f]{86}$'");
  });

  it("no longer accepts a broad non-empty/even-length-only ciphertext rule", () => {
    expect(normalizedExecutable).not.toMatch(/length\(p_ciphertext_hex\)\s*=\s*0/);
    expect(normalizedExecutable).not.toMatch(/length\(p_ciphertext_hex\)\s*%\s*2/);
    expect(normalizedExecutable).not.toContain("p_ciphertext_hex !~ '^[0-9a-f]+$'");
  });

  it("locks the owning project row before the target link row (project-then-link order)", () => {
    const projectLockIndex = normalizedBody.indexOf(
      "from public.projects as project where project.id = v_project_id for update"
    );
    const linkLockIndex = normalizedBody.indexOf(
      "from public.project_share_links as link where link.id = p_link_id and link.user_id = v_user_id for update"
    );
    expect(projectLockIndex).toBeGreaterThan(-1);
    expect(linkLockIndex).toBeGreaterThan(-1);
    expect(projectLockIndex).toBeLessThan(linkLockIndex);
  });

  it("requires the target link to be draft, and rejects when another link for the project is already active", () => {
    expect(body).toContain("message = 'SHARE_LINK_NOT_DRAFT'");
    expect(normalizedBody).toContain(
      "where other_link.project_id = v_project_id and other_link.id <> p_link_id and other_link.state = 'active'"
    );
    expect(body).toContain("message = 'SHARE_LINK_ANOTHER_LINK_ACTIVE'");
  });

  it("performs the one-active-link check only after both locks are held", () => {
    const linkLockIndex = normalizedBody.indexOf(
      "from public.project_share_links as link where link.id = p_link_id and link.user_id = v_user_id for update"
    );
    const oneActiveCheckIndex = normalizedBody.indexOf(
      "where other_link.project_id = v_project_id"
    );
    expect(oneActiveCheckIndex).toBeGreaterThan(linkLockIndex);
  });

  it("updates project_share_links and inserts project_share_secret_material in the same function body, both after validation", () => {
    expect(body).toContain("update public.project_share_links");
    expect(body).toContain("set\n      state = 'active',\n      secret_digest = p_secret_digest,");
    expect(body).toContain("insert into public.project_share_secret_material (");
    expect(body).toContain("decode(p_ciphertext_hex, 'hex')");
    expect(body).toContain("decode(p_nonce_hex, 'hex')");
    expect(body).toContain("decode(p_auth_tag_hex, 'hex')");
  });

  it("increments configuration_version exactly once via v_link_configuration_version + 1", () => {
    expect(body).toContain("v_new_configuration_version := v_link_configuration_version + 1;");
    const versionAssignments = body.match(/v_new_configuration_version :=/g) ?? [];
    expect(versionAssignments).toHaveLength(1);
    expect(body).toContain("configuration_version = v_new_configuration_version");
  });

  it("writes exactly one content-free link_activated event", () => {
    expect(body).toContain(
      "insert into public.share_link_events (share_link_id, event_type)\n  values (p_link_id, 'link_activated');"
    );
  });

  it("never returns digest, ciphertext, nonce, auth tag, encryption version, user id or project id", () => {
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
      "return jsonb_build_object(\n    'linkId', p_link_id,\n    'publicId', v_link_public_id,\n    'state', 'active',\n    'configurationVersion', v_new_configuration_version,\n    'activatedAt', v_now\n  );"
    );
  });
});

describe("202608060001 - disable_share_link behavior", () => {
  const body = bodies.disable_share_link;

  it("requires the link to be active, and rejects otherwise", () => {
    expect(body).toContain("message = 'SHARE_LINK_NOT_ACTIVE'");
    expect(body).toContain("if v_link_state <> 'active' then");
  });

  it("does not delete or modify project_share_secret_material", () => {
    expect(normalizedExecutable.includes("delete from public.project_share_secret_material")).toBe(
      false
    );
    const disableBody = body.toLowerCase();
    expect(disableBody).not.toContain("project_share_secret_material");
  });

  it("increments configuration_version exactly once and sets disabled_at", () => {
    expect(body).toContain("v_new_configuration_version := v_link_configuration_version + 1;");
    expect(body).toContain("state = 'disabled',\n      disabled_at = v_now,");
  });

  it("writes exactly one content-free link_disabled event", () => {
    expect(body).toContain(
      "insert into public.share_link_events (share_link_id, event_type)\n  values (p_link_id, 'link_disabled');"
    );
  });

  it("returns only linkId, state, configurationVersion, disabledAt", () => {
    expect(body).toContain(
      "return jsonb_build_object(\n    'linkId', p_link_id,\n    'state', 'disabled',\n    'configurationVersion', v_new_configuration_version,\n    'disabledAt', v_now\n  );"
    );
  });
});

describe("202608060001 - reenable_share_link behavior", () => {
  const body = bodies.reenable_share_link;
  const normalizedBody = normalizedWhitespaceBodies.reenable_share_link;

  it("locks the owning project row before the target link row (project-then-link order)", () => {
    const projectLockIndex = normalizedBody.indexOf(
      "from public.projects as project where project.id = v_project_id for update"
    );
    const linkLockIndex = normalizedBody.indexOf(
      "from public.project_share_links as link where link.id = p_link_id and link.user_id = v_user_id for update"
    );
    expect(projectLockIndex).toBeGreaterThan(-1);
    expect(linkLockIndex).toBeGreaterThan(-1);
    expect(projectLockIndex).toBeLessThan(linkLockIndex);
  });

  it("requires the target link to be disabled, not expired -- expired->active is not implemented here", () => {
    expect(body).toContain("message = 'SHARE_LINK_NOT_DISABLED'");
    expect(body).toContain("if v_link_state <> 'disabled' then");
    expect(normalizedExecutable).not.toContain("'expired' and new.state");
    expect(body.toLowerCase()).not.toContain("v_link_state = 'expired'");
  });

  it("requires secret_digest and project_share_secret_material to already exist", () => {
    expect(body).toContain("if v_link_secret_digest is null then");
    expect(body).toContain(
      "from public.project_share_secret_material as material\n        where material.share_link_id = p_link_id"
    );
    const missingMaterialOccurrences =
      body.match(/message = 'SHARE_LINK_SECRET_MATERIAL_MISSING'/g) ?? [];
    expect(missingMaterialOccurrences.length).toBe(2);
  });

  it("rejects when another link for the project is already active", () => {
    expect(normalizedBody).toContain(
      "where other_link.project_id = v_project_id and other_link.id <> p_link_id and other_link.state = 'active'"
    );
    expect(body).toContain("message = 'SHARE_LINK_ANOTHER_LINK_ACTIVE'");
  });

  it("never sets activated_at or disabled_at in its UPDATE, and never touches secret material", () => {
    const updateStart = body.indexOf("update public.project_share_links");
    const updateEnd = body.indexOf(";", updateStart);
    const updateText = body.slice(updateStart, updateEnd).toLowerCase();
    expect(updateText).not.toContain("activated_at");
    expect(updateText).not.toContain("disabled_at");
    expect(updateText).not.toContain("secret_digest");
    expect(body.toLowerCase()).not.toMatch(/update public\.project_share_secret_material/);
    expect(body.toLowerCase()).not.toMatch(
      /insert into public\.project_share_secret_material/
    );
  });

  it("increments configuration_version exactly once", () => {
    expect(body).toContain("v_new_configuration_version := v_link_configuration_version + 1;");
    const versionAssignments = body.match(/v_new_configuration_version :=/g) ?? [];
    expect(versionAssignments).toHaveLength(1);
  });

  it("writes link_activated (reused, no distinct re-enable code)", () => {
    expect(body).toContain(
      "insert into public.share_link_events (share_link_id, event_type)\n  values (p_link_id, 'link_activated');"
    );
  });

  it("returns the existing activatedAt/disabledAt values, not freshly computed ones", () => {
    expect(body).toContain(
      "return jsonb_build_object(\n    'linkId', p_link_id,\n    'state', 'active',\n    'configurationVersion', v_new_configuration_version,\n    'activatedAt', v_link_activated_at,\n    'disabledAt', v_link_disabled_at\n  );"
    );
  });
});

describe("202608060001 - event vocabulary and content-free discipline", () => {
  const ALLOWED_EVENT_TYPES = ["link_created", "link_activated", "link_disabled"];

  it("writes only existing, allowed event_type values", () => {
    const eventInserts = code.match(/values \([^)]*'link_[a-z_]+'\)/g) ?? [];
    expect(eventInserts.length).toBeGreaterThan(0);
    for (const insert of eventInserts) {
      const match = /'link_[a-z_]+'/.exec(insert);
      expect(match).not.toBeNull();
      if (match) {
        expect(ALLOWED_EVENT_TYPES).toContain(match[0].replace(/'/g, ""));
      }
    }
  });

  it("never widens the share_link_events event_type CHECK constraint", () => {
    expect(normalizedCode).not.toContain("share_link_events_event_type_check");
    expect(normalizedCode).not.toMatch(/alter table public\.share_link_events/);
  });

  it("every share_link_events insert supplies only share_link_id and event_type -- no identity or content column", () => {
    const eventInserts =
      code.match(/insert into public\.share_link_events \([^)]*\)/g) ?? [];
    expect(eventInserts.length).toBeGreaterThan(0);
    for (const insert of eventInserts) {
      expect(insert.replace(/\s+/g, " ")).toBe(
        "insert into public.share_link_events (share_link_id, event_type)"
      );
    }
  });
});

describe("202608060001 - production-safety and scope boundaries", () => {
  it("does not modify any existing Client Share table's structure", () => {
    expect(normalizedCode).not.toMatch(/alter table public\.project_share_links\s+(add|drop|alter)/);
    expect(normalizedCode).not.toMatch(/alter table public\.share_link_tasks/);
    expect(normalizedCode).not.toMatch(/alter table public\.share_link_resources/);
    expect(normalizedCode).not.toMatch(/alter table public\.share_link_updates/);
  });

  it("creates no RLS policy, trigger or constraint on any existing table", () => {
    expect(normalizedCode).not.toMatch(
      /create policy[\s\S]*?on public\.project_share_links/
    );
    expect(normalizedCode).not.toMatch(/create trigger[\s\S]*?on public\.project_share_links/);
  });

  it("never redefines project_share_links_public_id_format_check -- the table's own 16-64 constraint stays exactly as 202608030003 defined it", () => {
    expect(normalizedCode).not.toContain("project_share_links_public_id_format_check");
    const ownerFoundationPath = path.join(
      __dirname,
      "202608030003_client_share_owner_foundation.sql"
    );
    const ownerFoundationSql = readFileSync(ownerFoundationPath, "utf8").replace(
      /\r\n/g,
      "\n"
    );
    expect(ownerFoundationSql).toContain(
      "constraint project_share_links_public_id_format_check\n    check (public_id ~ '^[A-Za-z0-9_-]{16,64}$')"
    );
  });

  it("does not create a schema-level one-active-link-per-project unique index", () => {
    expect(normalizedCode).not.toMatch(/create unique index[^;]*where state = 'active'/);
  });

  it("implements no PIN, expiry, rotation, reveal or save_share_configuration function", () => {
    for (const forbidden of [
      "set_share_link_pin",
      "clear_share_link_pin",
      "set_share_link_expiry",
      "clear_share_link_expiry",
      "rotate_share_link_secret",
      "revoke_share_link",
      "reveal_share_link_secret",
      "save_share_configuration",
    ]) {
      expect(normalizedCode).not.toContain(forbidden);
    }
  });

  it("supports only draft->active, active->disabled, disabled->active -- no expired/revoked transition logic", () => {
    for (const name of FUNCTION_NAMES) {
      const body = bodies[name].toLowerCase();
      expect(body).not.toContain("'expired'");
      expect(body).not.toContain("'revoked'");
    }
  });

  it("does not define a down/rollback migration (forward-only, matching repo convention)", () => {
    expect(normalizedSql).not.toMatch(/^-- down/m);
    expect(normalizedCode).not.toMatch(/\brollback\b/);
  });

  it("comments every function and the new table", () => {
    for (const name of FUNCTION_NAMES) {
      expect(code).toContain(`comment on function public.${name}(`);
    }
    expect(code).toContain(
      "comment on table public.project_share_secret_material is"
    );
  });
});
