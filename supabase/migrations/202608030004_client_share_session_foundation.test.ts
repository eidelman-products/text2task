import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608030001_authenticated_product_events.test.ts).
//
// SQL text inspection cannot prove RLS, cascade or atomic-increment
// BEHAVIOUR at runtime. The executable integration-test matrix in
// docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1A_DATABASE_FOUNDATION_REPORT.md
// is what must prove that, against an isolated database, before Phase 3.
const MIGRATION_PATH = path.join(
  __dirname,
  "202608030004_client_share_session_foundation.sql"
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
  /^ {2}([a-z_]+)\s+(uuid|text|integer|smallint|bigint|boolean|timestamptz|date|numeric|jsonb|bytea|inet)\b/;

function extractColumnNames(block: string): string[] {
  return block
    .split("\n")
    .map((line) => COLUMN_DEFINITION.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[1]);
}

const SERVICE_ROLE_ONLY_TABLES = [
  "share_browser_sessions",
  "share_session_grants",
  "share_link_events",
  "share_rate_limit_buckets",
] as const;

const blocks = Object.fromEntries(
  SERVICE_ROLE_ONLY_TABLES.map((table) => [
    table,
    extractCreateTableBlock(code, table),
  ])
) as Record<(typeof SERVICE_ROLE_ONLY_TABLES)[number], string>;

const columns = Object.fromEntries(
  SERVICE_ROLE_ONLY_TABLES.map((table) => [
    table,
    extractColumnNames(blocks[table]),
  ])
) as Record<(typeof SERVICE_ROLE_ONLY_TABLES)[number], string[]>;

describe("202608030004 - every required table is created, fail closed", () => {
  it.each(SERVICE_ROLE_ONLY_TABLES)("creates public.%s", (table) => {
    expect(code).toContain(`create table public.${table} (`);
  });

  it("never uses `create table if not exists` for a new Client Share table", () => {
    expect(normalizedCode).not.toMatch(/create table if not exists/);
  });

  it("never silently skips a new security-sensitive index through `if not exists`", () => {
    expect(normalizedCode).not.toMatch(/create (unique )?index if not exists/);
  });

  it("never uses `add column if not exists`", () => {
    expect(normalizedCode).not.toMatch(/add column if not exists/);
  });

  it("uses `if exists` only for exact trigger recreation", () => {
    const ifExistsStatements = code.match(/drop [a-z ]*if exists/gi) ?? [];
    expect(ifExistsStatements.length).toBeGreaterThan(0);
    for (const statement of ifExistsStatements) {
      expect(statement.toLowerCase()).toBe("drop trigger if exists");
    }
  });

  it("does not define a down/rollback migration (forward-only, matching repo convention)", () => {
    expect(normalizedSql).not.toMatch(/^-- down/m);
    expect(normalizedCode).not.toMatch(/\brollback\b/);
  });
});

describe("202608030004 - browser sessions and per-link grants are separate tables", () => {
  it("keeps the session identity and the per-link authorisation in two different tables", () => {
    expect(code).toContain("create table public.share_browser_sessions (");
    expect(code).toContain("create table public.share_session_grants (");
  });

  it("the session table carries no share_link_id at all, so a session is never bound to one link", () => {
    expect(columns.share_browser_sessions).not.toContain("share_link_id");
    expect(blocks.share_browser_sessions).not.toContain("project_share_links");
  });

  it("one browser session can structurally hold grants for many links: the current-grant key is the PAIR, never the session alone", () => {
    expect(code).toContain(
      "create unique index share_session_grants_current_unique_idx\n  on public.share_session_grants (browser_session_id, share_link_id)\n  where revoked_at is null;"
    );
    expect(blocks.share_session_grants).not.toMatch(
      /unique\s*\(\s*browser_session_id\s*\)/
    );
  });

  it("preserves historical revoked grants instead of permanently blocking reissue for a session/link pair", () => {
    expect(blocks.share_session_grants).not.toMatch(
      /unique\s*\(\s*browser_session_id\s*,\s*share_link_id\s*\)/
    );
    expect(normalizedCode).not.toContain(
      "share_session_grants_session_link_unique"
    );
    expect(code).toContain("where revoked_at is null;");
  });

  it("documents the future atomic exchange operation required before inserting a replacement grant", () => {
    expect(sql).toContain(
      "lock the existing current grant for the browser session/link"
    );
    expect(sql).toContain("mark it\n-- revoked/superseded");
    expect(sql).toContain("insert the replacement\n-- grant");
    expect(sql).toContain("commit atomically");
  });

  it("deleting a browser session cascades all of its grants", () => {
    expect(blocks.share_session_grants).toContain(
      "browser_session_id uuid not null\n    references public.share_browser_sessions(id) on delete cascade"
    );
  });

  it("deleting a share link cascades only that link's grants", () => {
    expect(blocks.share_session_grants).toContain(
      "share_link_id uuid not null\n    references public.project_share_links(id) on delete cascade"
    );
  });

  it("records the configuration version a grant was issued against, so a rotation makes it detectably stale", () => {
    expect(columns.share_session_grants).toContain(
      "granted_configuration_version"
    );
    expect(blocks.share_session_grants).toContain(
      "check (granted_configuration_version > 0)"
    );
  });

  it("keeps revoked grants auditable rather than deleting them", () => {
    expect(columns.share_session_grants).toContain("revoked_at");
    expect(blocks.share_session_grants).toContain(
      "(revoked_at is null or revoked_at >= created_at)"
    );
  });
});

describe("202608030004 - browser session lifecycle constraints", () => {
  it("stores only a versioned digest of the cookie secret, never the secret itself", () => {
    expect(columns.share_browser_sessions).toContain("session_digest");
    expect(columns.share_browser_sessions).toContain("digest_version");
    expect(blocks.share_browser_sessions).toContain(
      "check (session_digest ~ '^[0-9a-f]{64}$')"
    );
    for (const column of columns.share_browser_sessions) {
      expect(column).not.toMatch(/token/);
      expect(column).not.toMatch(/secret/);
      expect(column).not.toMatch(/cookie/);
    }
  });

  it("makes the session digest unique, because it is the lookup key", () => {
    expect(blocks.share_browser_sessions).toContain(
      "constraint share_browser_sessions_session_digest_unique\n    unique (session_digest)"
    );
  });

  it("requires expires_at after created_at, and forbids last_seen_at / revoked_at predating created_at", () => {
    expect(blocks.share_browser_sessions).toContain("expires_at > created_at");
    expect(blocks.share_browser_sessions).toContain(
      "last_seen_at >= created_at"
    );
    expect(blocks.share_browser_sessions).toContain(
      "(revoked_at is null or revoked_at >= created_at)"
    );
  });

  it("requires the same ordering invariants on grants", () => {
    expect(blocks.share_session_grants).toContain("expires_at > created_at");
    expect(blocks.share_session_grants).toContain(
      "(pin_verified_at is null or pin_verified_at >= created_at)"
    );
  });
});

describe("202608030004 - content-free operational events", () => {
  it("uses a closed event vocabulary", () => {
    for (const eventType of [
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
    ]) {
      expect(blocks.share_link_events).toContain(`'${eventType}'`);
    }
    expect(blocks.share_link_events).toContain(
      "constraint share_link_events_event_type_check"
    );
  });

  it("has no general-purpose metadata JSONB escape hatch", () => {
    expect(blocks.share_link_events).not.toMatch(/\bjsonb\b/);
    expect(columns.share_link_events).not.toContain("metadata");
  });

  it("stores no project title, task title, comment body, client name, file name, Resource label, secret, PIN, URL or storage path", () => {
    for (const forbidden of [
      "project_title",
      "task_title",
      "title",
      "body",
      "comment",
      "client_name",
      "file_name",
      "label",
      "public_label",
      "secret",
      "secret_digest",
      "pin",
      "url",
      "public_url",
      "signed_url",
      "storage_path",
    ]) {
      expect(columns.share_link_events).not.toContain(forbidden);
    }
  });

  it("stores no raw IP address and no user agent string, only a versioned keyed digest", () => {
    for (const table of SERVICE_ROLE_ONLY_TABLES) {
      for (const column of columns[table]) {
        expect(column).not.toMatch(/^ip\b/);
        expect(column).not.toMatch(/ip_address/);
        expect(column).not.toMatch(/user_agent/);
      }
      expect(blocks[table]).not.toMatch(/\binet\b/);
    }
    expect(columns.share_link_events).toContain("identity_digest");
    expect(columns.share_link_events).toContain("identity_digest_version");
    expect(blocks.share_link_events).toContain(
      "identity_digest ~ '^[0-9a-f]{64}$'"
    );
  });

  it("is append-only in this migration: no updated_at column and no positive grant yet", () => {
    expect(columns.share_link_events).not.toContain("updated_at");
    const eventGrants = (code.match(/^grant[^;]*;/gm) ?? []).filter((grant) =>
      grant.includes("public.share_link_events")
    );
    expect(eventGrants).toEqual([]);
  });
});

describe("202608030004 - rate-limit bucket identity cannot be defeated by NULLs", () => {
  it("derives a stable non-nullable scope key instead of putting the nullable share_link_id in the unique key", () => {
    expect(blocks.share_rate_limit_buckets).toContain(
      "share_link_key text not null\n    generated always as (coalesce(share_link_id::text, '-')) stored"
    );
  });

  it("keys the bucket on the generated key, never on the nullable column", () => {
    expect(blocks.share_rate_limit_buckets).toContain(
      "constraint share_rate_limit_buckets_identity_unique\n    unique (\n      scope,\n      action,\n      identity_digest,\n      share_link_key,\n      window_start,\n      window_seconds\n    )"
    );
    expect(blocks.share_rate_limit_buckets).not.toMatch(
      /unique\s*\([^)]*\bshare_link_id\b[^)]*\)/
    );
  });

  it("bounds the permitted window durations", () => {
    expect(blocks.share_rate_limit_buckets).toContain(
      "check (window_seconds in (60, 300, 3600, 86400))"
    );
  });

  it("uses closed scope and action vocabularies", () => {
    expect(blocks.share_rate_limit_buckets).toContain(
      "check (scope in ('browser_session', 'network_identity', 'share_link'))"
    );
    for (const action of [
      "session_exchange",
      "pin_verification",
      "projection_read",
      "comment_submission",
      "file_access",
      "invalid_link_access",
    ]) {
      expect(blocks.share_rate_limit_buckets).toContain(`'${action}'`);
    }
  });

  it("keeps the count non-negative and the expiry at or beyond the end of the window", () => {
    expect(blocks.share_rate_limit_buckets).toContain("check (request_count >= 0)");
    expect(blocks.share_rate_limit_buckets).toContain(
      "expires_at >= window_start + (window_seconds * interval '1 second')"
    );
  });

  it("requires a link-scoped bucket to name its link, and forbids attributing an invalid-link attempt to one", () => {
    expect(blocks.share_rate_limit_buckets).toContain(
      "check (scope <> 'share_link' or share_link_id is not null)"
    );
    expect(blocks.share_rate_limit_buckets).toContain(
      "check (action <> 'invalid_link_access' or share_link_id is null)"
    );
  });

  it("maintains updated_at through the shared Client Share helper, because the count is genuinely mutable", () => {
    expect(columns.share_rate_limit_buckets).toContain("updated_at");
    expect(code).toContain(
      "create trigger share_rate_limit_buckets_set_updated_at\nbefore update on public.share_rate_limit_buckets\nfor each row\nexecute function public.set_client_share_updated_at();"
    );
  });
});

describe("202608030004 - indexes", () => {
  it("has an expired-browser-session cleanup index", () => {
    expect(code).toContain(
      "create index share_browser_sessions_expires_at_idx\n  on public.share_browser_sessions (expires_at);"
    );
  });

  it("has an expired-grant cleanup index and an active-grants-by-link index", () => {
    expect(code).toContain(
      "create index share_session_grants_expires_at_idx\n  on public.share_session_grants (expires_at);"
    );
    expect(code).toContain(
      "create index share_session_grants_share_link_id_active_idx\n  on public.share_session_grants (share_link_id)\n  where revoked_at is null;"
    );
    expect(code).toContain(
      "create unique index share_session_grants_current_unique_idx\n  on public.share_session_grants (browser_session_id, share_link_id)\n  where revoked_at is null;"
    );
  });

  it("has an expired-rate-limit-bucket cleanup index", () => {
    expect(code).toContain(
      "create index share_rate_limit_buckets_expires_at_idx\n  on public.share_rate_limit_buckets (expires_at);"
    );
  });

  it("has the share-link event stream index", () => {
    expect(code).toContain(
      "create index share_link_events_share_link_id_created_at_idx\n  on public.share_link_events (share_link_id, created_at desc);"
    );
  });

  it("creates no index duplicating a table-level unique constraint", () => {
    const indexStatements = code.match(/create (unique )?index[\s\S]*?;/g) ?? [];
    for (const statement of indexStatements) {
      expect(statement).not.toContain("(session_digest)");
    }
    expect(blocks.share_session_grants).not.toMatch(
      /constraint\s+[a-z_]+[\s\S]*unique\s*\(\s*browser_session_id\s*,\s*share_link_id\s*\)/
    );
  });

  it("uses a partial unique current-grant index, so revoked rows do not occupy the reissue key", () => {
    const currentGrantIndex = code.match(
      /create unique index share_session_grants_current_unique_idx[\s\S]*?;/g
    );
    expect(currentGrantIndex).toEqual([
      "create unique index share_session_grants_current_unique_idx\n  on public.share_session_grants (browser_session_id, share_link_id)\n  where revoked_at is null;",
    ]);
    expect(currentGrantIndex?.[0]).not.toMatch(/where revoked_at is not null/);
  });

  it("creates no full-pair unique index that would block all future rows for a revoked session/link pair", () => {
    const indexStatements = code.match(/create unique index[\s\S]*?;/g) ?? [];
    for (const statement of indexStatements) {
      if (statement.includes("(browser_session_id, share_link_id)")) {
        expect(statement).toContain("where revoked_at is null");
      }
    }
  });

  it("creates every index on a table this migration itself creates", () => {
    const indexStatements = code.match(/create (unique )?index[\s\S]*?;/g) ?? [];
    expect(indexStatements.length).toBeGreaterThan(0);
    for (const statement of indexStatements) {
      expect(statement).toMatch(
        /on public\.(share_browser_sessions|share_session_grants|share_link_events|share_rate_limit_buckets)\b/
      );
    }
  });
});

describe("202608030004 - service-role-only security model", () => {
  it("enables RLS on all four tables", () => {
    for (const table of SERVICE_ROLE_ONLY_TABLES) {
      expect(code).toContain(
        `alter table public.${table} enable row level security;`
      );
    }
  });

  it("defines no user-facing policy of any kind", () => {
    expect(normalizedCode).not.toMatch(/create policy/);
  });

  it("revokes everything from public, anon and authenticated", () => {
    for (const table of SERVICE_ROLE_ONLY_TABLES) {
      expect(code).toContain(`revoke all on table public.${table} from public;`);
      expect(code).toContain(`revoke all on table public.${table} from anon;`);
      expect(code).toContain(
        `revoke all on table public.${table} from authenticated;`
      );
    }
  });

  it("revokes all privileges from service_role and grants no positive access in migration 004", () => {
    for (const table of SERVICE_ROLE_ONLY_TABLES) {
      const revokeIndex = normalizedCode.indexOf(
        `revoke all privileges\n  on table public.${table}\n  from service_role;`
      );
      expect(revokeIndex).toBeGreaterThan(-1);
    }
    expect(code.match(/^grant[^;]*;/gm) ?? []).toEqual([]);
  });

  it("grants nothing whatsoever to anon anywhere in the migration", () => {
    expect(normalizedCode).not.toMatch(/\bgrant\b[^;]*\banon\b/);
  });

  it("grants nothing whatsoever to authenticated anywhere in the migration", () => {
    expect(normalizedCode).not.toMatch(/\bgrant\b[^;]*\bauthenticated\b/);
  });

  it("never grants ALL, TRUNCATE, TRIGGER or REFERENCES to any role", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    expect(grants).toEqual([]);
    for (const grant of grants) {
      expect(grant.toLowerCase()).not.toMatch(/^grant\s+all\b/);
      expect(grant.toLowerCase()).not.toMatch(/\btruncate\b/);
      expect(grant.toLowerCase()).not.toMatch(/\btrigger\b/);
      expect(grant.toLowerCase()).not.toMatch(/\breferences\b/);
    }
  });

  it("exposes none of these tables through a view", () => {
    expect(normalizedCode).not.toMatch(/create (or replace )?view/);
    expect(normalizedCode).not.toMatch(/materialized view/);
  });
});

describe("202608030004 - comments on tables and security-sensitive columns", () => {
  it("comments every table it creates", () => {
    for (const table of SERVICE_ROLE_ONLY_TABLES) {
      expect(code).toContain(`comment on table public.${table} is`);
    }
  });

  it("comments every security-sensitive column", () => {
    for (const column of [
      "public.share_browser_sessions.session_digest",
      "public.share_browser_sessions.digest_version",
      "public.share_browser_sessions.revoked_at",
      "public.share_session_grants.granted_configuration_version",
      "public.share_session_grants.pin_verified_at",
      "public.share_session_grants.expires_at",
      "public.share_session_grants.revoked_at",
      "public.share_link_events.event_type",
      "public.share_link_events.identity_digest",
      "public.share_rate_limit_buckets.share_link_key",
      "public.share_rate_limit_buckets.scope",
      "public.share_rate_limit_buckets.action",
      "public.share_rate_limit_buckets.identity_digest",
    ]) {
      expect(code).toContain(`comment on column ${column} is`);
    }
  });
});

describe("202608030004 - leaves existing production schema untouched", () => {
  it("alters no existing production table", () => {
    for (const table of [
      "projects",
      "tasks",
      "clients",
      "users",
      "task_resources",
      "project_updates",
      "project_timeline_events",
      "analytics_events",
      "authenticated_product_events",
      "calendar_events",
      "homepage_demo_rate_limit_buckets",
    ]) {
      expect(normalizedCode).not.toMatch(
        new RegExp(`alter table public\\.${table}\\b`)
      );
    }
  });

  it("does not reuse or redefine the homepage demo's own rate-limit infrastructure", () => {
    expect(normalizedCode).not.toContain("homepage_demo");
  });

  it("drops no table, column, constraint, index or function", () => {
    expect(normalizedCode).not.toMatch(/drop table\b/);
    expect(normalizedCode).not.toMatch(/drop column\b/);
    expect(normalizedCode).not.toMatch(/drop constraint\b/);
    expect(normalizedCode).not.toMatch(/drop index\b/);
    expect(normalizedCode).not.toMatch(/drop function\b/);
  });

  it("defines no new function, reusing the helper created by the sibling owner-foundation migration", () => {
    expect(normalizedCode).not.toMatch(/create or replace function/);
    expect(code).toContain("execute function public.set_client_share_updated_at();");
  });

  it("performs no insert, update or delete against any table", () => {
    expect(normalizedCode).not.toMatch(/^\s*insert into/m);
    expect(normalizedCode).not.toMatch(/^\s*update public\./m);
    expect(normalizedCode).not.toMatch(/^\s*delete from/m);
  });

  it("never references project_timeline_events or any CRM table", () => {
    expect(normalizedCode).not.toContain("project_timeline_events");
    expect(normalizedCode).not.toContain("public.projects");
    expect(normalizedCode).not.toContain("public.tasks");
    expect(normalizedCode).not.toContain("public.clients");
  });
});
