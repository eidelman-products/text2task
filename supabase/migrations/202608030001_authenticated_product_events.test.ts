import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repo's established migration-testing
// convention exactly (see 202607310001_calendar_events_custom_names.test.ts).
const MIGRATION_PATH = path.join(
  __dirname,
  "202608030001_authenticated_product_events.sql"
);
const ANALYTICS_EVENTS_MIGRATION_PATH = path.join(
  __dirname,
  "202606190001_analytics_events.sql"
);

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

const sql = readNormalized(MIGRATION_PATH);
const normalizedSql = sql.toLowerCase();

function statementIndex(statement: string) {
  return normalizedSql.indexOf(statement.toLowerCase());
}

describe("202608030001_authenticated_product_events.sql - table shape", () => {
  it("creates the table under the correct name", () => {
    expect(sql).toContain(
      "create table if not exists public.authenticated_product_events"
    );
  });

  it("requires user_id, with a foreign key to auth.users and on delete cascade", () => {
    expect(sql).toContain(
      "user_id uuid not null references auth.users(id) on delete cascade"
    );
  });

  it("requires event_name and route", () => {
    expect(sql).toContain("event_name text not null");
    expect(sql).toContain("route text not null");
  });

  it("has no metadata/jsonb column definition (prose explaining its absence is fine)", () => {
    expect(sql).not.toMatch(/^\s*metadata\s+jsonb\b/m);
    // No column is ever typed `jsonb` -- the only occurrence of the word
    // anywhere in the file is inside a prose comment explaining that no
    // such column exists.
    const jsonbOccurrences = sql.match(/jsonb/g) ?? [];
    expect(jsonbOccurrences).toHaveLength(1);
    expect(sql).toContain("no metadata/jsonb column");
  });

  it("has no free-form content/message/task/project-title/client field", () => {
    expect(sql.toLowerCase()).not.toMatch(
      /\b(message|task_text|project_title|client_name|contact_name|email|phone|budget|notes?|file_name|screenshot|content)\b\s+text/
    );
  });

  it("has no updated_at column -- rows are append-only", () => {
    expect(sql).not.toMatch(/\bupdated_at\b/);
  });

  it("never defines an update or delete grant, matching append-only rows", () => {
    expect(normalizedSql).not.toMatch(/grant\s+update\b/);
    expect(normalizedSql).not.toMatch(/grant\s+delete\b/);
  });
});

describe("202608030001_authenticated_product_events.sql - constraints", () => {
  it("caps route length at 300", () => {
    expect(sql).toContain("authenticated_product_events_route_length_check");
    expect(sql).toContain("check (char_length(route) <= 300)");
  });

  it("restricts entity_type to the three allowed values, or null", () => {
    expect(sql).toContain("authenticated_product_events_entity_type_check");
    expect(sql).toContain(
      "entity_type in ('project', 'calendar_event', 'calendar_day')"
    );
  });

  it("caps entity_id length at 64", () => {
    expect(sql).toContain("authenticated_product_events_entity_id_length_check");
    expect(sql).toContain("char_length(entity_id) <= 64");
  });

  it("rejects an entity_id supplied without an entity_type (via the consistency check)", () => {
    expect(sql).toContain("authenticated_product_events_entity_consistency_check");
    expect(sql).toContain("(entity_type is null and entity_id is null)");
  });

  it("requires a calendar_day entity_id to be a strict YYYY-MM-DD date shape", () => {
    expect(sql).toContain("entity_type = 'calendar_day'");
    expect(sql).toContain("entity_id ~ '^\\d{4}-\\d{2}-\\d{2}$'");
  });

  it("requires a project/calendar_event entity_id to be a well-formed UUID", () => {
    expect(sql).toContain("entity_type in ('project', 'calendar_event')");
    expect(sql).toContain(
      "entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'"
    );
  });
});

describe("202608030001_authenticated_product_events.sql - indexes", () => {
  it("has the primary (user_id, created_at desc) timeline index", () => {
    expect(sql).toContain(
      "authenticated_product_events_user_id_created_at_idx"
    );
    expect(sql).toContain(
      "on public.authenticated_product_events (user_id, created_at desc)"
    );
  });

  it("has an event_name index", () => {
    expect(sql).toContain("authenticated_product_events_event_name_idx");
    expect(sql).toContain(
      "on public.authenticated_product_events (event_name)"
    );
  });

  it("has a unique partial index on idempotency_key where not null", () => {
    expect(sql).toContain(
      "authenticated_product_events_idempotency_key_unique_idx"
    );
    expect(sql).toContain(
      "on public.authenticated_product_events (idempotency_key)\n  where idempotency_key is not null"
    );
  });
});

describe("202608030001_authenticated_product_events.sql - RLS and grants", () => {
  it("enables row level security", () => {
    expect(sql).toContain(
      "alter table public.authenticated_product_events enable row level security"
    );
  });

  it("defines no user-facing RLS policies", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
  });

  it("revokes all access from public, anon, and authenticated", () => {
    expect(sql).toContain(
      "revoke all on table public.authenticated_product_events from public"
    );
    expect(sql).toContain(
      "revoke all on table public.authenticated_product_events from anon"
    );
    expect(sql).toContain(
      "revoke all on table public.authenticated_product_events from authenticated"
    );
  });

  it("explicitly revokes all privileges from service_role before granting least privilege", () => {
    const serviceRoleRevoke =
      "revoke all privileges\non table public.authenticated_product_events\nfrom service_role";
    const serviceRoleGrant =
      "grant select, insert on table public.authenticated_product_events\n  to service_role";

    expect(sql).toContain(serviceRoleRevoke);
    expect(sql).toContain(serviceRoleGrant);
    expect(statementIndex(serviceRoleRevoke)).toBeGreaterThan(-1);
    expect(statementIndex(serviceRoleGrant)).toBeGreaterThan(
      statementIndex(serviceRoleRevoke)
    );
  });

  it("grants only select and insert to service_role", () => {
    expect(sql).toContain(
      "grant select, insert on table public.authenticated_product_events"
    );
    expect(sql).toContain("to service_role");
    expect(normalizedSql).not.toMatch(
      /grant\s+(update|delete|truncate|references|trigger)\b[\s\S]*?\bto\s+service_role\b/
    );
    expect(normalizedSql).not.toMatch(
      /grant\s+all(?:\s+privileges)?\b[\s\S]*?\bto\s+service_role\b/
    );
  });
});

describe("202608030001_authenticated_product_events.sql - isolation from analytics_events", () => {
  it("never modifies public.analytics_events", () => {
    expect(sql).not.toMatch(/alter table public\.analytics_events\b/);
    expect(sql).not.toMatch(/drop table public\.analytics_events\b/);
    expect(sql).not.toMatch(/update public\.analytics_events\b/);
    expect(sql).not.toMatch(/delete from public\.analytics_events\b/);
    expect(sql).not.toMatch(/truncate table public\.analytics_events\b/);
  });

  it("does not define a down/rollback migration (forward-only, matching repo convention)", () => {
    expect(normalizedSql).not.toMatch(/^-- down/m);
    expect(normalizedSql).not.toMatch(/\brollback\b/);
  });

  it("leaves the existing analytics_events migration file completely untouched", () => {
    // Sanity check that this migration doesn't accidentally redefine or
    // duplicate anything from the original table's own migration.
    const analyticsEventsSql = readNormalized(ANALYTICS_EVENTS_MIGRATION_PATH);
    expect(analyticsEventsSql).toContain(
      "create table if not exists public.analytics_events"
    );
    expect(sql).not.toContain("create table if not exists public.analytics_events");
  });
});
