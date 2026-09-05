import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repo's established migration-testing
// convention exactly (see 202607210003_owner_user_activity_report_rpc.sql's
// own precedent and 202607310001_calendar_events_custom_names.test.ts).
const MIGRATION_PATH = path.join(
  __dirname,
  "202608030002_owner_authenticated_activity_report_rpc.sql"
);

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

const sql = readNormalized(MIGRATION_PATH);
const normalizedSql = sql.toLowerCase();

function statementIndex(statement: string) {
  return normalizedSql.indexOf(statement.toLowerCase());
}

function extractFunctionBody(source: string, functionSignaturePrefix: string): string {
  const startMarker = `create or replace function public.${functionSignaturePrefix}`;
  const startIndex = source.indexOf(startMarker);

  if (startIndex === -1) {
    throw new Error(`Could not find function ${functionSignaturePrefix} in migration`);
  }

  const endMarker = "\n$$;";
  const endIndex = source.indexOf(endMarker, startIndex);

  if (endIndex === -1) {
    throw new Error(`Could not find end of function ${functionSignaturePrefix}`);
  }

  return source.slice(startIndex, endIndex + endMarker.length);
}

describe("202608030002 - both functions exist with the correct names", () => {
  it("defines get_owner_authenticated_activity_summary(uuid[])", () => {
    expect(sql).toContain(
      "create or replace function public.get_owner_authenticated_activity_summary(\n  p_user_ids uuid[]\n)"
    );
  });

  it("defines get_owner_user_activity_timeline(uuid, int)", () => {
    expect(sql).toContain(
      "create or replace function public.get_owner_user_activity_timeline(\n  p_user_id uuid,\n  p_limit int default 200\n)"
    );
  });
});

describe("202608030002 - get_owner_authenticated_activity_summary", () => {
  const body = extractFunctionBody(sql, "get_owner_authenticated_activity_summary(");

  it("is STABLE and SECURITY INVOKER with a safe search_path", () => {
    expect(body).toContain("stable");
    expect(body).toContain("security invoker");
    expect(body).toContain("set search_path = public");
  });

  it("reads from authenticated_product_events", () => {
    expect(body).toContain("from public.authenticated_product_events");
  });

  it("caps the incoming id array defensively", () => {
    expect(body).toContain("unnest(p_user_ids[1:2000])");
  });

  it("computes distinct_active_days using Asia/Jerusalem, not UTC", () => {
    expect(body).toContain("at time zone 'Asia/Jerusalem'");
    expect(body).toContain("count(distinct scoped_event.israel_date)");
  });

  it("defines is_returning as more than one distinct active day", () => {
    expect(body).toContain("'is_returning', summary_row.distinct_active_days > 1");
  });

  it("picks the latest event deterministically (created_at desc with an id tiebreaker)", () => {
    expect(body).toContain("distinct on (scoped_event.user_id)");
    expect(body).toContain(
      "order by\n      scoped_event.user_id,\n      scoped_event.created_at desc,\n      scoped_event.id desc"
    );
  });

  it("returns no sensitive content -- only ids, timestamps, route, and event name", () => {
    expect(body).not.toMatch(/\bmetadata\b/);
    expect(body).not.toMatch(/\bmessage\b/);
  });

  it("revokes execution from public/anon/authenticated and grants only to service_role", () => {
    const serviceRoleRevoke =
      "revoke all privileges on function public.get_owner_authenticated_activity_summary(uuid[]) from service_role";
    const serviceRoleGrant =
      "grant execute on function public.get_owner_authenticated_activity_summary(uuid[])\n  to service_role";

    expect(sql).toContain(
      "revoke all on function public.get_owner_authenticated_activity_summary(uuid[]) from public"
    );
    expect(sql).toContain(
      "revoke all on function public.get_owner_authenticated_activity_summary(uuid[]) from anon"
    );
    expect(sql).toContain(
      "revoke all on function public.get_owner_authenticated_activity_summary(uuid[]) from authenticated"
    );
    expect(sql).toContain(serviceRoleRevoke);
    expect(sql).toContain(serviceRoleGrant);
    expect(statementIndex(serviceRoleGrant)).toBeGreaterThan(
      statementIndex(serviceRoleRevoke)
    );
    expect(normalizedSql).not.toMatch(
      /grant\s+all(?:\s+privileges)?\b[\s\S]*?get_owner_authenticated_activity_summary[\s\S]*?\bto\s+service_role\b/
    );
  });
});

describe("202608030002 - get_owner_user_activity_timeline", () => {
  const body = extractFunctionBody(sql, "get_owner_user_activity_timeline(");

  it("is STABLE and SECURITY INVOKER with a safe search_path", () => {
    expect(body).toContain("stable");
    expect(body).toContain("security invoker");
    expect(body).toContain("set search_path = public");
  });

  it("reads from authenticated_product_events, scoped to one user", () => {
    expect(body).toContain("from public.authenticated_product_events");
    expect(body).toContain("where event_row.user_id = p_user_id");
  });

  it("has a bounded default limit of 200", () => {
    expect(sql).toContain("p_limit int default 200");
  });

  it("clamps the limit to a hard ceiling regardless of the requested value", () => {
    expect(body).toContain("limit least(greatest(p_limit, 0), 500)");
  });

  it("orders newest first with a deterministic secondary tiebreaker", () => {
    expect(body).toContain("order by event_row.created_at desc, event_row.id desc");
    expect(body).toContain(
      "order by timeline_row.created_at desc, timeline_row.id desc"
    );
  });

  it("returns only the five safe timeline fields", () => {
    expect(body).toContain("'created_at', timeline_row.created_at");
    expect(body).toContain("'event_name', timeline_row.event_name");
    expect(body).toContain("'route', timeline_row.route");
    expect(body).toContain("'entity_type', timeline_row.entity_type");
    expect(body).toContain("'entity_id', timeline_row.entity_id");
  });

  it("returns no sensitive content -- no metadata or free-form content field", () => {
    expect(body).not.toMatch(/\bmetadata\b/);
  });

  it("revokes execution from public/anon/authenticated and grants only to service_role", () => {
    const serviceRoleRevoke =
      "revoke all privileges on function public.get_owner_user_activity_timeline(uuid, int) from service_role";
    const serviceRoleGrant =
      "grant execute on function public.get_owner_user_activity_timeline(uuid, int)\n  to service_role";

    expect(sql).toContain(
      "revoke all on function public.get_owner_user_activity_timeline(uuid, int) from public"
    );
    expect(sql).toContain(
      "revoke all on function public.get_owner_user_activity_timeline(uuid, int) from anon"
    );
    expect(sql).toContain(
      "revoke all on function public.get_owner_user_activity_timeline(uuid, int) from authenticated"
    );
    expect(sql).toContain(serviceRoleRevoke);
    expect(sql).toContain(serviceRoleGrant);
    expect(statementIndex(serviceRoleGrant)).toBeGreaterThan(
      statementIndex(serviceRoleRevoke)
    );
    expect(normalizedSql).not.toMatch(
      /grant\s+all(?:\s+privileges)?\b[\s\S]*?get_owner_user_activity_timeline[\s\S]*?\bto\s+service_role\b/
    );
  });
});

describe("202608030002 - forward-only migration convention", () => {
  it("does not define a down/rollback migration", () => {
    expect(normalizedSql).not.toMatch(/^-- down/m);
    expect(normalizedSql).not.toMatch(/\brollback\b/);
  });

  it("never touches public.analytics_events", () => {
    expect(sql).not.toMatch(/\banalytics_events\b/);
  });
});
