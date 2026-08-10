import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202607290001_calendar_events.test.ts and
// 202608030001_authenticated_product_events.test.ts).
//
// These assertions are deliberately section-scoped rather than broad
// whole-file string searches: a column-absence claim is checked against
// the actual column list of the actual table, not against the presence or
// absence of a word somewhere in a prose comment. SQL text inspection
// cannot prove RLS, trigger or cascade BEHAVIOUR at runtime -- the
// executable integration-test matrix in
// docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1A_DATABASE_FOUNDATION_REPORT.md
// is what must prove that, against an isolated database, before Phase 3.
const MIGRATION_PATH = path.join(
  __dirname,
  "202608030003_client_share_owner_foundation.sql"
);

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

const sql = readNormalized(MIGRATION_PATH);
const normalizedSql = sql.toLowerCase();

/**
 * Removes whole-line `--` comments only. Explanatory prose must never be
 * able to satisfy (or violate) a structural assertion. Trailing inline
 * comments are not used in this migration, and string literals inside
 * `comment on ...` statements are deliberately preserved so the comment
 * assertions below still work.
 */
function stripLineComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

const code = stripLineComments(sql);
const normalizedCode = code.toLowerCase();

/**
 * Additionally removes `comment on ... is '...';` statements, leaving only
 * executable SQL. Used where an assertion must be about what the migration
 * DOES, not about what its documentation mentions -- the table comments
 * deliberately name project_timeline_events in order to state that this
 * feature is separate from it.
 */
function stripCommentOnStatements(source: string): string {
  return source.replace(/comment on [\s\S]*?';/g, "");
}

const executable = stripCommentOnStatements(code);
const normalizedExecutable = executable.toLowerCase();

function extractCreateTableBlock(source: string, tableName: string): string {
  const startMarker = `create table public.${tableName} (`;
  const startIndex = source.indexOf(startMarker);

  if (startIndex === -1) {
    throw new Error(`Could not find create table for public.${tableName}`);
  }

  const endIndex = source.indexOf("\n);", startIndex);

  if (endIndex === -1) {
    throw new Error(`Could not find end of create table for public.${tableName}`);
  }

  return source.slice(startIndex, endIndex + 3);
}

const COLUMN_DEFINITION =
  /^ {2}([a-z_]+)\s+(uuid|text|integer|smallint|bigint|boolean|timestamptz|date|numeric|jsonb|bytea)\b/;

function extractColumnNames(block: string): string[] {
  return block
    .split("\n")
    .map((line) => COLUMN_DEFINITION.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[1]);
}

const OWNER_TABLES = [
  "project_share_links",
  "share_link_tasks",
  "share_link_resources",
  "share_link_updates",
  "share_messages",
  "share_message_conversions",
] as const;

const blocks = Object.fromEntries(
  OWNER_TABLES.map((table) => [table, extractCreateTableBlock(code, table)])
) as Record<(typeof OWNER_TABLES)[number], string>;

const columns = Object.fromEntries(
  OWNER_TABLES.map((table) => [table, extractColumnNames(blocks[table])])
) as Record<(typeof OWNER_TABLES)[number], string[]>;

describe("202608030003 - every required owner-facing table is created", () => {
  it.each(OWNER_TABLES)("creates public.%s", (table) => {
    expect(code).toContain(`create table public.${table} (`);
  });

  it("never uses `create table if not exists` for a new Client Share table (schema drift must fail closed)", () => {
    expect(normalizedCode).not.toMatch(/create table if not exists/);
  });

  it("never uses `if not exists` on a new index either, so a pre-existing incompatible index cannot be silently accepted", () => {
    expect(normalizedCode).not.toMatch(/create (unique )?index if not exists/);
  });

  it("never uses `add column if not exists`", () => {
    expect(normalizedCode).not.toMatch(/add column if not exists/);
  });

  it("uses `if exists` only for the exact-recreation cases the repository already sanctions (policies and triggers)", () => {
    const ifExistsStatements = code.match(/drop [a-z ]*if exists/gi) ?? [];
    expect(ifExistsStatements.length).toBeGreaterThan(0);
    for (const statement of ifExistsStatements) {
      expect(statement.toLowerCase()).toMatch(
        /^drop (policy|trigger) if exists$/
      );
    }
  });

  it("does not define a down/rollback migration (forward-only, matching repo convention)", () => {
    expect(normalizedSql).not.toMatch(/^-- down/m);
    expect(normalizedCode).not.toMatch(/\brollback\b/);
  });

  it("does not create or install any database extension", () => {
    expect(normalizedCode).not.toMatch(/create extension/);
  });
});

describe("202608030003 - foreign key column types match the verified live schema", () => {
  it("project references are uuid", () => {
    expect(blocks.project_share_links).toContain(
      "project_id uuid not null references public.projects(id) on delete cascade"
    );
    expect(blocks.share_messages).toContain(
      "project_id uuid not null references public.projects(id) on delete cascade"
    );
  });

  it("task references are bigint, never uuid (public.tasks.id is the legacy bigint key)", () => {
    expect(blocks.share_link_tasks).toContain(
      "subtask_id bigint not null references public.tasks(id) on delete cascade"
    );
    expect(blocks.share_message_conversions).toContain(
      "target_task_id bigint null references public.tasks(id) on delete set null"
    );
    expect(blocks.share_link_tasks).not.toMatch(/subtask_id\s+uuid/);
    expect(blocks.share_message_conversions).not.toMatch(/target_task_id\s+uuid/);
  });

  it("Resource references are uuid", () => {
    expect(blocks.share_link_resources).toContain(
      "resource_id uuid not null\n    references public.task_resources(id) on delete cascade"
    );
  });

  it("every ownership FK is uuid -> auth.users(id) on delete cascade", () => {
    for (const table of OWNER_TABLES) {
      expect(blocks[table]).toContain(
        "user_id uuid not null references auth.users(id) on delete cascade"
      );
    }
  });

  it("Client Update references are uuid -> public.project_updates(id)", () => {
    expect(blocks.share_message_conversions).toContain(
      "project_update_id uuid null\n    references public.project_updates(id) on delete set null"
    );
  });

  it("share_link_updates.created_by is a required owner FK that cascades with the owning account", () => {
    expect(blocks.share_link_updates).toContain(
      "created_by uuid not null references auth.users(id) on delete cascade"
    );
    expect(blocks.share_link_updates).not.toMatch(/created_by[\s\S]*on delete set null/);
  });
});

describe("202608030003 - deliberate foreign key delete actions", () => {
  it("share-link children cascade from the link, so deleting a link removes everything hanging off it", () => {
    for (const table of [
      "share_link_tasks",
      "share_link_resources",
      "share_link_updates",
      "share_messages",
    ] as const) {
      expect(blocks[table]).toContain(
        "share_link_id uuid not null\n    references public.project_share_links(id) on delete cascade"
      );
    }
  });

  it("conversions cascade from their message but only null out their optional targets", () => {
    expect(blocks.share_message_conversions).toContain(
      "message_id uuid not null\n    references public.share_messages(id) on delete cascade"
    );
    expect(blocks.share_message_conversions).toContain(
      "on delete set null"
    );
  });

  it("every foreign key in the migration declares an explicit delete action", () => {
    const references = code.match(/references [a-z_.]+\([a-z_]+\)[^,\n]*/g) ?? [];
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference).toMatch(/on delete (cascade|set null)/);
    }
  });
});

describe("202608030003 - forbidden secret, token and PIN storage", () => {
  const linkColumns = columns.project_share_links;

  it("has no raw share-secret column", () => {
    for (const forbidden of [
      "secret",
      "share_secret",
      "raw_secret",
      "secret_plaintext",
      "secret_value",
    ]) {
      expect(linkColumns).not.toContain(forbidden);
    }
  });

  it("has no encrypted or otherwise reversible secret column", () => {
    for (const column of linkColumns) {
      expect(column).not.toMatch(/encrypted/);
      expect(column).not.toMatch(/cipher/);
      expect(column).not.toMatch(/_enc$/);
    }
  });

  it("has no raw-token column anywhere in the migration", () => {
    for (const table of OWNER_TABLES) {
      for (const column of columns[table]) {
        expect(column).not.toMatch(/token/);
      }
    }
  });

  it("stores the share secret only as a versioned keyed digest", () => {
    expect(linkColumns).toContain("secret_digest");
    expect(linkColumns).toContain("secret_digest_version");
    expect(blocks.project_share_links).toContain(
      "check (secret_digest is null or secret_digest ~ '^[0-9a-f]{64}$')"
    );
  });

  it("names the digest-consistency constraint on project_share_links", () => {
    expect(blocks.project_share_links).toContain(
      "constraint project_share_links_secret_digest_consistency_check"
    );
  });

  it("has no plaintext or reversible PIN column", () => {
    for (const forbidden of ["pin", "pin_plaintext", "pin_value", "pin_code"]) {
      expect(linkColumns).not.toContain(forbidden);
    }
  });

  describe("project_share_links_secret_digest_consistency_check -- nullable only for draft, or a revoked link that never activated", () => {
    const constraintIdx = blocks.project_share_links.indexOf(
      "constraint project_share_links_secret_digest_consistency_check"
    );
    const constraintBlock = blocks.project_share_links.slice(constraintIdx, constraintIdx + 500);

    it("locates the constraint's full CHECK expression", () => {
      expect(constraintIdx).toBeGreaterThan(-1);
      expect(constraintBlock).toContain("check (");
    });

    it("[permits] a true draft (state = 'draft') to have a null digest, independent of activated_at", () => {
      expect(constraintBlock).toContain("state = 'draft'");
    });

    it("[permits] a revoked link to have a null digest ONLY when it never activated (activated_at is null) -- not every revoked link", () => {
      expect(constraintBlock).toContain("or (state = 'revoked' and activated_at is null)");
    });

    it("the null-digest branch is exactly (draft) OR (revoked AND never-activated) -- structurally, no other state/activated_at combination can satisfy it", () => {
      expect(constraintBlock).toContain(
        "and (\n          state = 'draft'\n          or (state = 'revoked' and activated_at is null)\n        )"
      );
    });

    it("[rejects null for active/disabled/expired] the digest-required branch is completely unconditional on state -- it never mentions the state column at all, so it is the only branch active/disabled/expired rows (which can never satisfy the draft/never-activated-revoked null branch) can ever satisfy", () => {
      const orIdx = constraintBlock.indexOf(")\n      or (");
      expect(orIdx).toBeGreaterThan(-1);
      const nonNullBranch = constraintBlock.slice(orIdx, orIdx + 160);
      expect(nonNullBranch).toContain("secret_digest is not null");
      expect(nonNullBranch).toContain("secret_digest_version is not null");
      expect(nonNullBranch).toContain("secret_digest_version > 0");
      expect(nonNullBranch).not.toMatch(/\bstate\b/);
    });

    it("[rejects null for a previously-activated revoked link] the revoked null-branch clause requires activated_at is null specifically -- a revoked row with activated_at is not null fails that clause and therefore falls through to the digest-required branch, so an activated link's digest history can never be silently dropped by revocation", () => {
      expect(constraintBlock).toContain("state = 'revoked' and activated_at is null");
      // A bare "state = 'revoked'" with no activated_at qualifier anywhere
      // in the null-branch would be the unconditionally-broad regression
      // this test guards against.
      expect(constraintBlock).not.toContain("or state = 'revoked'\n");
      expect(constraintBlock).not.toContain("'draft', 'revoked'");
    });

    it("does not weaken the existing digest format or version-positivity validation", () => {
      expect(blocks.project_share_links).toContain(
        "check (secret_digest is null or secret_digest ~ '^[0-9a-f]{64}$')"
      );
      expect(constraintBlock).toContain("secret_digest_version > 0");
    });

    it("cross-contract: the widened constraint can represent the already-delivered draft -> revoked transition that enforce_project_share_link_integrity's own state-transition matrix and revoke_share_link both already support with no state restriction", () => {
      // enforce_project_share_link_integrity (202608030005) explicitly
      // allows (old.state = 'draft' and new.state in ('active', 'revoked')),
      // and revoke_share_link (202608060002) has no state restriction at
      // all -- this constraint must not be the one thing that makes that
      // already-delivered transition impossible for a link with no digest.
      expect(constraintBlock).toContain("state = 'revoked' and activated_at is null");
    });
  });

  it("updates the secret_digest column comment to no longer claim nullability is draft-only", () => {
    expect(normalizedSql).not.toContain(
      "nullable only in the pre-generation ''draft'' state, which project_share_links_secret_digest_consistency_check enforces."
    );
    expect(sql).toContain("revoked directly from ''draft'' without ever activating");
  });

  it("stores the PIN as a salted, versioned, explicitly parameterised scrypt derivation", () => {
    for (const required of [
      "pin_hash",
      "pin_salt",
      "pin_hash_version",
      "pin_scrypt_n",
      "pin_scrypt_r",
      "pin_scrypt_p",
      "pin_key_length",
    ]) {
      expect(linkColumns).toContain(required);
    }
  });

  it("requires the PIN fields to be either all absent or the exact reviewed scrypt v1 profile", () => {
    const block = blocks.project_share_links;
    expect(block).toContain("constraint project_share_links_pin_completeness_check");
    expect(block).toContain(
      "pin_hash is null\n        and pin_salt is null\n        and pin_hash_version is null"
    );
    expect(block).toContain("pin_hash is not null");
    expect(block).toContain("pin_hash_version = 1");
    expect(block).toContain("pin_hash ~ '^[A-Za-z0-9_-]+$'");
    expect(block).toContain("char_length(pin_hash) = 43");
    expect(block).toContain("pin_scrypt_n = 16384");
    expect(block).toContain("pin_scrypt_r = 8");
    expect(block).toContain("pin_scrypt_p = 1");
    expect(block).toContain("pin_key_length = 32");
    expect(block).not.toContain("pin_scrypt_n >= 16384");
    expect(block).not.toContain("pin_scrypt_n <= 1048576");
    expect(block).not.toContain("(pin_scrypt_n & (pin_scrypt_n - 1)) = 0");
  });

  it("uses no unstructured JSON escape hatch for PIN or secret parameters", () => {
    for (const table of OWNER_TABLES) {
      expect(blocks[table]).not.toMatch(/\bjsonb\b/);
    }
  });
});

describe("202608030003 - PIN encoding CHECK constraint uses explicit char_length bounds, not an invalid regex repetition count", () => {
  // PostgreSQL's regex engine only supports repetition-count bounds up to
  // 255. A prior version of this constraint used the regex bound
  // `{32,512}`, which raises SQLSTATE 2201B ("invalid regular expression:
  // invalid repetition count(s)") for ANY non-null pin_hash, not just an
  // out-of-range one -- the CHECK expression itself cannot be evaluated.
  // This was proven by a real runtime execution (see the Phase 1A SQL
  // Editor package report, section 25) before this constraint was fixed.
  const block = blocks.project_share_links;

  it("checks pin_hash length with an explicit char_length(...) between clause (32 to 512 inclusive)", () => {
    expect(block).toContain("char_length(pin_hash) between 32 and 512");
  });

  it("checks pin_salt length with an explicit char_length(...) between clause (16 to 128 inclusive)", () => {
    expect(block).toContain("char_length(pin_salt) between 16 and 128");
  });

  it("still restricts pin_hash and pin_salt to the anchored Base64url character set, with no length bound folded into the regex", () => {
    const encodingCheckStart = block.indexOf(
      "constraint project_share_links_pin_encoding_check"
    );
    expect(encodingCheckStart).toBeGreaterThan(-1);
    const encodingCheck = block.slice(encodingCheckStart);

    const hashRegexMatches = encodingCheck.match(/pin_hash ~ '([^']+)'/);
    const saltRegexMatches = encodingCheck.match(/pin_salt ~ '([^']+)'/);
    expect(hashRegexMatches?.[1]).toBe("^[A-Za-z0-9_-]+$");
    expect(saltRegexMatches?.[1]).toBe("^[A-Za-z0-9_-]+$");
  });

  it("does not allow pin_hash or pin_salt to be an empty string when non-null (the anchored `+` requires at least one character)", () => {
    expect(block).not.toMatch(/pin_hash ~ '\^\[A-Za-z0-9_-\]\*\$'/);
    expect(block).not.toMatch(/pin_salt ~ '\^\[A-Za-z0-9_-\]\*\$'/);
  });

  it("the executable migration no longer contains the invalid {32,512} regex repetition bound anywhere", () => {
    expect(executable).not.toContain("{32,512}");
  });

  it("no executable regex repetition bound anywhere in this migration exceeds PostgreSQL's supported maximum of 255", () => {
    // Finds every `{m}`, `{m,}` and `{m,n}` regex repetition form in
    // executable SQL (comments and `comment on ... is '...';` bodies are
    // already stripped from `executable`), and fails with the offending
    // bound named if any numeric value inside it exceeds 255 -- the
    // actual PostgreSQL/ICU regex engine limit that produced SQLSTATE
    // 2201B for the old {32,512} bound. This is a generic guard, not
    // specific to the PIN columns, so it also catches a future regression
    // introduced anywhere else in this file.
    const repetitionPattern = /\{(\d+)(,(\d*))?\}/g;
    const offending: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = repetitionPattern.exec(executable)) !== null) {
      const bounds = [match[1], match[3]].filter(
        (value): value is string => value !== undefined && value !== ""
      );
      for (const bound of bounds) {
        if (Number(bound) > 255) {
          offending.push(match[0]);
        }
      }
    }

    expect(
      offending,
      `Found regex repetition bound(s) exceeding PostgreSQL's 255 limit: ${offending.join(", ")}`
    ).toEqual([]);
  });
});

describe("202608030003 - forbidden copies of authoritative project/task/client data", () => {
  it("the link never copies client contact detail, project money, priority or raw input", () => {
    for (const forbidden of [
      "client_email",
      "client_phone",
      "email",
      "phone",
      "notes",
      "amount",
      "amount_value",
      "currency_code",
      "priority",
      "priority_source",
      "raw_input",
      "source",
    ]) {
      expect(columns.project_share_links).not.toContain(forbidden);
    }
  });

  it("the task mapping copies no task title, status, deadline, amount, priority, source or client field", () => {
    for (const forbidden of [
      "task_title",
      "title",
      "status",
      "deadline",
      "deadline_text",
      "deadline_date",
      "amount",
      "amount_value",
      "priority",
      "raw_input",
      "source",
      "client_id",
      "client_name",
      "contact_name",
    ]) {
      expect(columns.share_link_tasks).not.toContain(forbidden);
    }
  });

  it("the Resource mapping copies no storage path, file name, url, MIME type, size or internal note", () => {
    for (const forbidden of [
      "storage_path",
      "file_name",
      "url",
      "signed_url",
      "mime_type",
      "size_bytes",
      "notes",
      "resource_type",
    ]) {
      expect(columns.share_link_resources).not.toContain(forbidden);
    }
  });

  it("the message table has no client email or phone column of any kind", () => {
    for (const column of columns.share_messages) {
      expect(column).not.toMatch(/email/);
      expect(column).not.toMatch(/phone/);
    }
  });

  it("the message body is plain text with no HTML or Markdown execution field", () => {
    expect(columns.share_messages).toContain("body");
    for (const forbidden of ["body_html", "html", "markdown", "rendered_body"]) {
      expect(columns.share_messages).not.toContain(forbidden);
    }
  });

  it("the published update copies no Client Update internals", () => {
    for (const forbidden of ["raw_input", "ai_summary", "source_type", "facts"]) {
      expect(columns.share_link_updates).not.toContain(forbidden);
    }
  });
});

describe("202608030003 - multiple active links per project remain structurally possible", () => {
  it("declares no unique constraint on project_id", () => {
    expect(blocks.project_share_links).not.toMatch(/unique\s*\(\s*project_id\s*\)/);
    expect(normalizedCode).not.toMatch(/project_share_links_project_id_unique/);
  });

  it("declares no unique index of any kind on public.project_share_links", () => {
    const uniqueIndexes = code.match(/create unique index[\s\S]*?;/g) ?? [];
    for (const statement of uniqueIndexes) {
      expect(statement).not.toContain("public.project_share_links");
    }
  });

  it("declares no partial unique index restricted to an active state", () => {
    expect(normalizedCode).not.toMatch(/where\s+state\s*=\s*'active'\s*;/);
    const uniqueIndexes = code.match(/create unique index[\s\S]*?;/g) ?? [];
    for (const statement of uniqueIndexes) {
      expect(statement.toLowerCase()).not.toContain("state = 'active'");
    }
  });

  it("the one partial unique index that does exist is about update versions, not links", () => {
    expect(code).toContain(
      "create unique index share_link_updates_current_version_unique_idx\n  on public.share_link_updates (share_link_id)\n  where is_current;"
    );
  });

  it("keeps non-unique owner/project/state indexes for future management operations", () => {
    expect(code).toContain(
      "create index project_share_links_user_id_project_id_idx\n  on public.project_share_links (user_id, project_id);"
    );
    expect(code).toContain(
      "create index project_share_links_user_id_state_idx\n  on public.project_share_links (user_id, state);"
    );
  });

  it("creates no index on secret_digest, which has no query path (lookup is always by public_id)", () => {
    const indexStatements = code.match(/create (unique )?index[\s\S]*?;/g) ?? [];
    for (const statement of indexStatements) {
      expect(statement).not.toContain("secret_digest");
    }
  });
});

describe("202608030003 - closed vocabularies", () => {
  it("link state is a five-value closed vocabulary", () => {
    expect(blocks.project_share_links).toContain(
      "check (state in ('draft', 'active', 'disabled', 'expired', 'revoked'))"
    );
  });

  it("content direction is auto / ltr / rtl", () => {
    expect(blocks.project_share_links).toContain(
      "check (content_direction in ('auto', 'ltr', 'rtl'))"
    );
  });

  it("public task groups are a closed client-facing vocabulary, never the internal status vocabulary", () => {
    expect(blocks.share_link_tasks).toContain(
      "'in_progress',\n        'waiting_for_feedback',\n        'completed',\n        'coming_up'"
    );
    expect(blocks.share_link_tasks.toLowerCase()).not.toContain("'urgent'");
    expect(blocks.share_link_tasks.toLowerCase()).not.toContain("'in progress'");
  });

  it("message author type and review status are closed vocabularies", () => {
    expect(blocks.share_messages).toContain(
      "check (author_type in ('client', 'owner'))"
    );
    expect(blocks.share_messages).toContain(
      "status in ('new', 'reviewed', 'resolved', 'dismissed', 'converted')"
    );
  });
});

describe("202608030003 - mapping and idempotency uniqueness", () => {
  it("one subtask may appear at most once per share link", () => {
    expect(blocks.share_link_tasks).toContain(
      "constraint share_link_tasks_share_link_id_subtask_id_unique\n    unique (share_link_id, subtask_id)"
    );
  });

  it("one Resource may appear at most once per share link", () => {
    expect(blocks.share_link_resources).toContain(
      "constraint share_link_resources_share_link_id_resource_id_unique\n    unique (share_link_id, resource_id)"
    );
  });

  it("published update versions are unique per link", () => {
    expect(blocks.share_link_updates).toContain(
      "constraint share_link_updates_share_link_id_version_unique\n    unique (share_link_id, version)"
    );
  });

  it("public_id is unique", () => {
    expect(blocks.project_share_links).toContain(
      "constraint project_share_links_public_id_unique\n    unique (public_id)"
    );
  });

  it("a message can be converted at most once, with no nullable column in the uniqueness key", () => {
    expect(blocks.share_message_conversions).toContain(
      "constraint share_message_conversions_message_id_unique\n    unique (message_id)"
    );
    expect(blocks.share_message_conversions).not.toMatch(
      /unique\s*\(\s*message_id\s*,\s*project_update_id\s*\)/
    );
  });

  it("non-negative and positive-integer invariants are database constraints, not conventions", () => {
    expect(blocks.project_share_links).toContain("check (configuration_version > 0)");
    expect(blocks.project_share_links).toContain("check (view_count >= 0)");
    expect(blocks.share_link_tasks).toContain("check (display_order >= 0)");
    expect(blocks.share_link_resources).toContain("check (display_order >= 0)");
    expect(blocks.share_link_updates).toContain("check (version > 0)");
  });
});

describe("202608030003 - updated_at helper and triggers", () => {
  it("defines one feature-scoped helper rather than duplicating an incompatible generic one", () => {
    expect(code).toContain(
      "create or replace function public.set_client_share_updated_at()"
    );
    expect(code).toContain("new.updated_at = now();");
    expect(code).toContain("security invoker");
    expect(code).toContain("set search_path = public, pg_temp");
  });

  it("never redefines an existing updated_at helper belonging to another feature", () => {
    expect(normalizedCode).not.toContain("set_homepage_demo_updated_at");
    expect(normalizedCode).not.toContain("set_calendar_events_updated_at");
    expect(normalizedCode).not.toContain("set_customer_stories_updated_at");
  });

  it("installs the updated_at trigger on exactly the tables with genuinely mutable state", () => {
    for (const table of [
      "project_share_links",
      "share_link_tasks",
      "share_link_resources",
      "share_messages",
    ]) {
      expect(code).toContain(
        `create trigger ${table}_set_updated_at\nbefore update on public.${table}\nfor each row\nexecute function public.set_client_share_updated_at();`
      );
    }
  });

  it("gives the append-only tables no updated_at column and no updated_at trigger", () => {
    expect(columns.share_link_updates).not.toContain("updated_at");
    expect(columns.share_message_conversions).not.toContain("updated_at");
    expect(code).not.toContain("share_link_updates_set_updated_at");
    expect(code).not.toContain("share_message_conversions_set_updated_at");
  });
});

describe("202608030003 - Row Level Security, owner-facing model", () => {
  it("enables RLS on every table in this migration", () => {
    for (const table of OWNER_TABLES) {
      expect(code).toContain(
        `alter table public.${table} enable row level security;`
      );
    }
  });

  it("every policy explicitly targets the authenticated role", () => {
    const policies = code.match(/create policy[\s\S]*?;/g) ?? [];
    expect(policies.length).toBe(6);
    for (const policy of policies) {
      expect(policy).toContain("to authenticated");
    }
  });

  it("no policy targets the PostgreSQL PUBLIC role", () => {
    const policies = code.match(/create policy[\s\S]*?;/g) ?? [];
    for (const policy of policies) {
      expect(policy.toLowerCase()).not.toMatch(/\bto\s+public\b/);
      expect(policy.toLowerCase()).not.toMatch(/\bto\s+anon\b/);
    }
  });

  it("every policy predicate is the ownership comparison and never joins to a parent table", () => {
    const policies = code.match(/create policy[\s\S]*?;/g) ?? [];
    for (const policy of policies) {
      expect(policy).toContain("auth.uid() = user_id");
      expect(policy).not.toMatch(/from public\./);
      expect(policy).not.toMatch(/\bjoin\b/i);
      expect(policy).not.toMatch(/\bexists\b/i);
    }
  });

  it("each owner-facing table gets exactly one SELECT policy", () => {
    for (const table of OWNER_TABLES) {
      const tablePolicies = (code.match(/create policy[\s\S]*?;/g) ?? []).filter(
        (policy) => policy.includes(`on public.${table}`)
      );
      expect(tablePolicies).toHaveLength(1);
      expect(tablePolicies[0]).toContain(`on public.${table}\n  for select`);
    }
  });

  it("defines no authenticated mutation policy in Phase 1A", () => {
    const policies = code.match(/create policy[\s\S]*?;/g) ?? [];
    for (const policy of policies) {
      expect(policy).not.toMatch(/\n  for insert\n/);
      expect(policy).not.toMatch(/\n  for update\n/);
      expect(policy).not.toMatch(/\n  for delete\n/);
    }
    expect(normalizedCode).not.toMatch(/\n\s*for insert\n\s*to authenticated/);
    expect(normalizedCode).not.toMatch(/\n\s*for update\n\s*to authenticated/);
    expect(normalizedCode).not.toMatch(/\n\s*for delete\n\s*to authenticated/);
  });

  it("drops each policy by name before recreating it, so re-application is exact rather than additive", () => {
    const dropPolicies = code.match(/drop policy if exists/g) ?? [];
    const createPolicies = code.match(/create policy/g) ?? [];
    expect(dropPolicies.length).toBe(createPolicies.length);
  });
});

describe("202608030003 - grants, least privilege", () => {
  it("revokes everything from public, anon and authenticated on every table", () => {
    for (const table of OWNER_TABLES) {
      expect(code).toContain(`revoke all on table public.${table} from public;`);
      expect(code).toContain(`revoke all on table public.${table} from anon;`);
      expect(code).toContain(
        `revoke all on table public.${table} from authenticated;`
      );
    }
  });

  it("explicitly revokes all privileges from service_role on every owner-facing table", () => {
    for (const table of OWNER_TABLES) {
      const revokeIndex = normalizedCode.indexOf(
        `revoke all privileges on table public.${table} from service_role`
      );
      const wrappedRevokeIndex = normalizedCode.indexOf(
        `revoke all privileges\n  on table public.${table}\n  from service_role`
      );
      expect(Math.max(revokeIndex, wrappedRevokeIndex)).toBeGreaterThan(-1);
    }
  });

  it("contains no positive table grant that exposes an owner-facing table before integrity triggers exist", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    expect(grants).toEqual([]);
  });

  it("grants nothing whatsoever to anon anywhere in the migration", () => {
    expect(normalizedCode).not.toMatch(/\bgrant\b[^;]*\banon\b/);
  });

  it("never grants TRUNCATE, TRIGGER or REFERENCES to authenticated", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    for (const grant of grants) {
      if (!grant.includes("authenticated")) {
        continue;
      }
      expect(grant.toLowerCase()).not.toMatch(/\btruncate\b/);
      expect(grant.toLowerCase()).not.toMatch(/\btrigger\b/);
      expect(grant.toLowerCase()).not.toMatch(/\breferences\b/);
      expect(grant.toLowerCase()).not.toMatch(/\ball privileges\b/);
    }
  });

  it("never grants ALL or ALL PRIVILEGES to any role", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    for (const grant of grants) {
      expect(grant.toLowerCase()).not.toMatch(/^grant\s+all\b/);
    }
  });
});

describe("202608030003 - separation from the professional project timeline", () => {
  it("share_messages has no foreign key to project_timeline_events", () => {
    expect(blocks.share_messages).not.toContain("project_timeline_events");
  });

  it("no trigger, function or statement anywhere references project_timeline_events", () => {
    expect(normalizedExecutable).not.toContain("project_timeline_events");
  });

  it("creates no trigger that could analyse a message or mutate CRM data", () => {
    const triggers = code.match(/create trigger[\s\S]*?;/g) ?? [];
    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) {
      expect(trigger).toContain("execute function public.set_client_share_updated_at();");
    }
  });

  it("performs no insert, update or delete against any table", () => {
    expect(normalizedCode).not.toMatch(/^\s*insert into/m);
    expect(normalizedCode).not.toMatch(/^\s*update public\./m);
    expect(normalizedCode).not.toMatch(/^\s*delete from/m);
  });
});

describe("202608030003 - comments on tables and security-sensitive columns", () => {
  it("comments every table it creates", () => {
    for (const table of OWNER_TABLES) {
      expect(code).toContain(`comment on table public.${table} is`);
    }
  });

  it("comments every security-sensitive column", () => {
    for (const column of [
      "public.project_share_links.public_id",
      "public.project_share_links.secret_digest",
      "public.project_share_links.secret_digest_version",
      "public.project_share_links.state",
      "public.project_share_links.configuration_version",
      "public.project_share_links.pin_hash",
      "public.project_share_links.pin_salt",
      "public.project_share_links.pin_hash_version",
      "public.share_link_tasks.subtask_id",
      "public.share_link_resources.resource_id",
      "public.share_link_resources.public_label",
      "public.share_messages.body",
      "public.share_messages.author_type",
      "public.share_messages.project_id",
      "public.share_message_conversions.converted_by",
    ]) {
      expect(code).toContain(`comment on column ${column} is`);
    }
  });
});

describe("202608030003 - leaves existing production schema untouched", () => {
  it("alters no existing production table", () => {
    for (const table of [
      "projects",
      "tasks",
      "clients",
      "users",
      "task_resources",
      "project_updates",
      "project_update_items",
      "project_timeline_events",
      "analytics_events",
      "authenticated_product_events",
      "calendar_events",
    ]) {
      expect(normalizedCode).not.toMatch(
        new RegExp(`alter table public\\.${table}\\b`)
      );
    }
    expect(normalizedCode).not.toMatch(/alter table storage\./);
  });

  it("drops no table, column, constraint or index", () => {
    expect(normalizedCode).not.toMatch(/drop table\b/);
    expect(normalizedCode).not.toMatch(/drop column\b/);
    expect(normalizedCode).not.toMatch(/drop constraint\b/);
    expect(normalizedCode).not.toMatch(/drop index\b/);
    expect(normalizedCode).not.toMatch(/drop function\b/);
  });

  it("does not touch the known overlapping task_resources resource_type CHECK constraints", () => {
    expect(normalizedCode).not.toContain("resource_type");
    expect(normalizedCode).not.toMatch(/task_resources_.*_check/);
  });

  it("does not touch storage buckets, objects or policies", () => {
    expect(normalizedCode).not.toContain("storage.objects");
    expect(normalizedCode).not.toContain("storage.buckets");
    expect(normalizedCode).not.toMatch(/\bcreate bucket\b/);
    expect(normalizedCode).not.toMatch(/storage\.[a-z_]+/);
  });

  it("redefines no function belonging to an existing migration", () => {
    const replacedFunctions =
      code.match(/create or replace function public\.[a-z_]+/g) ?? [];
    expect(replacedFunctions).toEqual([
      "create or replace function public.set_client_share_updated_at",
    ]);
  });

  it("touches existing production tables only through foreign key references, never through a statement", () => {
    for (const table of ["projects", "tasks", "task_resources", "project_updates"]) {
      // A foreign key reference is the only permitted contact surface.
      expect(code).toMatch(new RegExp(`references public\\.${table}\\(id\\)`));

      for (const statement of [
        `alter table public.${table}`,
        `insert into public.${table}`,
        `update public.${table}`,
        `delete from public.${table}`,
        `truncate table public.${table}`,
        `create index on public.${table}`,
        `drop table public.${table}`,
      ]) {
        expect(normalizedCode).not.toContain(statement);
      }
    }

    // No index anywhere in this migration is created on an existing table.
    const indexStatements = code.match(/create (unique )?index[\s\S]*?;/g) ?? [];
    for (const statement of indexStatements) {
      expect(statement).toMatch(
        /on public\.(project_share_links|share_link_tasks|share_link_resources|share_link_updates|share_messages|share_message_conversions)\b/
      );
    }
  });
});
