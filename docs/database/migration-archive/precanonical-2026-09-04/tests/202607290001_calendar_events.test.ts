import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection (this repo's migrations are not exercised against a real
// Postgres instance in tests; matches the sibling
// 202607270001_project_completion_reconciliation.test.ts pattern exactly).
const MIGRATION_PATH = path.join(__dirname, "202607290001_calendar_events.sql");

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

const sql = readNormalized(MIGRATION_PATH);

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

describe("202607290001_calendar_events.sql - table definition", () => {
  it("creates the table with exactly the locked column set and types", () => {
    expect(sql).toContain("create table if not exists public.calendar_events (");
    expect(sql).toContain("id uuid primary key default gen_random_uuid(),");
    expect(sql).toContain(
      "user_id uuid not null references auth.users(id) on delete cascade,"
    );
    expect(sql).toContain("title text not null,");
    expect(sql).toContain("event_date date not null,");
    expect(sql).toContain("event_time time without time zone null,");
    expect(sql).toContain("notes text null,");
    expect(sql).toContain(
      "project_id uuid null references public.projects(id) on delete set null,"
    );
    expect(sql).toContain(
      "client_id uuid null references public.clients(id) on delete set null,"
    );
    expect(sql).toContain("created_at timestamptz not null default now(),");
    expect(sql).toContain("updated_at timestamptz not null default now(),");
    expect(sql).toContain("deleted_at timestamptz null,");
  });

  it("does not include any speculative/out-of-scope field", () => {
    for (const forbidden of [
      "status text",
      "event_type",
      "color text",
      "all_day",
      "starts_at",
      "ends_at",
      "timezone",
      "source text",
      "recurrence",
      "is_archived",
      "archived_at",
      "sort_order",
      "attendees",
      "reminder",
    ]) {
      expect(sql.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("enforces a non-blank, length-bounded title at the database layer", () => {
    expect(sql).toContain("constraint calendar_events_title_check");
    expect(sql).toContain(
      "check (char_length(trim(title)) >= 1 and char_length(title) <= 240)"
    );
  });

  it("enforces minute-precision event_time at the database layer (Correction 2)", () => {
    expect(sql).toContain("constraint calendar_events_event_time_minute_precision_check");
    expect(sql).toContain(
      "check (event_time is null or extract(second from event_time) = 0)"
    );
  });

  it("does not define a down/rollback migration (forward-only, matching repo convention)", () => {
    expect(sql.toLowerCase()).not.toMatch(/^-- down/m);
    expect(sql.toLowerCase()).not.toMatch(/\brollback\b/);
  });
});

describe("202607290001 - foreign key delete behavior", () => {
  it("user_id cascades on auth.users deletion (hard ownership FK)", () => {
    expect(sql).toContain(
      "user_id uuid not null references auth.users(id) on delete cascade,"
    );
  });

  it("project_id and client_id set null on delete (optional FK to an optional entity, matching project_updates.client_id precedent)", () => {
    expect(sql).toContain(
      "project_id uuid null references public.projects(id) on delete set null,"
    );
    expect(sql).toContain(
      "client_id uuid null references public.clients(id) on delete set null,"
    );
  });

  it("never uses a composite FK, and never lets project_id/client_id null out user_id", () => {
    expect(sql).not.toMatch(/foreign key\s*\(\s*project_id\s*,\s*user_id/i);
    expect(sql).not.toMatch(/foreign key\s*\(\s*client_id\s*,\s*user_id/i);
    expect(sql).not.toMatch(/user_id.*on delete set null/);
  });
});

describe("202607290001 - indexes", () => {
  it("adds the primary active-range composite index on calendar_events", () => {
    expect(sql).toContain(
      "create index if not exists calendar_events_user_id_event_date_idx\n  on public.calendar_events(user_id, event_date)\n  where deleted_at is null;"
    );
  });

  it("adds partial FK-column indexes for project_id and client_id", () => {
    expect(sql).toContain(
      "create index if not exists calendar_events_project_id_idx\n  on public.calendar_events(project_id)\n  where project_id is not null and deleted_at is null;"
    );
    expect(sql).toContain(
      "create index if not exists calendar_events_client_id_idx\n  on public.calendar_events(client_id)\n  where client_id is not null and deleted_at is null;"
    );
  });

  it("adds the supporting projects(user_id, deadline_date) index, idempotently, without altering any projects column", () => {
    expect(sql).toContain(
      "create index if not exists projects_user_id_deadline_date_idx\n  on public.projects(user_id, deadline_date)\n  where deleted_at is null;"
    );
  });
});

describe("202607290001 - updated_at trigger", () => {
  const body = extractFunctionBody(sql, "set_calendar_events_updated_at");

  it("sets updated_at to now() on every update", () => {
    expect(body).toContain("new.updated_at = now();");
  });

  it("is wired as a before-update row trigger", () => {
    expect(sql).toContain(
      "create trigger calendar_events_set_updated_at\nbefore update on public.calendar_events\nfor each row\nexecute function public.set_calendar_events_updated_at();"
    );
  });

  it("uses the repository's standard security posture (security invoker + explicit search_path)", () => {
    expect(body).toContain("security invoker");
    expect(body).toContain("set search_path = public, pg_temp");
  });
});

describe("202607290001 - relationship integrity enforcement", () => {
  const body = extractFunctionBody(
    sql,
    "enforce_calendar_event_relationship_integrity"
  );

  it("is wired as a before insert-or-update row trigger", () => {
    expect(sql).toContain(
      "create trigger calendar_events_enforce_relationship_integrity\nbefore insert or update on public.calendar_events\nfor each row\nexecute function public.enforce_calendar_event_relationship_integrity();"
    );
  });

  it("is a safe no-op when both project_id and client_id are null", () => {
    expect(body).toContain("if new.project_id is not null then");
    expect(body).toContain("if new.client_id is not null then");
    // No unconditional statement outside those two guards mutates or
    // validates anything -- the only unconditional line is the final
    // `return new;`.
    const afterLastGuardClose = body.slice(body.lastIndexOf("end if;"));
    expect(afterLastGuardClose.trim()).toBe("end if;\n\n  return new;\nend;\n$$;");
  });

  it("(Correction 1) only re-validates/re-normalizes when the relationship is actually changing: INSERT, or project_id/client_id differs from the current row", () => {
    expect(body).toContain("if tg_op = 'INSERT' then");
    expect(body).toContain("v_relationship_changed := true;");
    expect(body).toContain(
      "new.project_id is distinct from old.project_id\n      or new.client_id is distinct from old.client_id;"
    );
  });

  it("(Correction 1) returns immediately, before ever querying projects/clients, when the relationship has not changed", () => {
    const earlyReturnIndex = body.indexOf("if not v_relationship_changed then");
    const projectSelectIndex = body.indexOf("from public.projects as project");
    const clientSelectIndex = body.indexOf("from public.clients as client");

    expect(earlyReturnIndex).toBeGreaterThan(-1);
    expect(projectSelectIndex).toBeGreaterThan(-1);
    expect(clientSelectIndex).toBeGreaterThan(-1);
    // The early-return guard must appear textually before both lookups, so
    // an unrelated update (title/date/time/notes-only, or a soft delete)
    // can never reach a query that could pick up a since-changed project
    // client -- this is what makes "preserve OLD.client_id on unrelated
    // updates" actually true, not just documented.
    expect(earlyReturnIndex).toBeLessThan(projectSelectIndex);
    expect(earlyReturnIndex).toBeLessThan(clientSelectIndex);

    const earlyReturnBlock = body.slice(
      earlyReturnIndex,
      body.indexOf("end if;", earlyReturnIndex) + "end if;".length
    );
    expect(earlyReturnBlock).toContain("return new;");
  });

  it("rejects a project_id belonging to another user, distinctly from not-found", () => {
    expect(body).toContain("message = 'CALENDAR_EVENT_PROJECT_NOT_FOUND';");
    expect(body).toContain("message = 'CALENDAR_EVENT_PROJECT_NOT_OWNED';");
    expect(body).toContain("v_project_user_id <> new.user_id");
  });

  it("rejects a soft-deleted project", () => {
    expect(body).toContain("message = 'CALENDAR_EVENT_PROJECT_DELETED';");
    expect(body).toContain("v_project_deleted_at is not null");
  });

  it("rejects a client_id belonging to another user, distinctly from not-found", () => {
    expect(body).toContain("message = 'CALENDAR_EVENT_CLIENT_NOT_FOUND';");
    expect(body).toContain("message = 'CALENDAR_EVENT_CLIENT_NOT_OWNED';");
    expect(body).toContain("v_client_user_id <> new.user_id");
  });

  it("normalizes client_id to the linked project's client_id rather than rejecting a mismatch", () => {
    expect(body).toContain("new.client_id := v_project_client_id;");
  });

  it("never modifies user_id", () => {
    expect(body).not.toMatch(/new\.user_id\s*:?=/);
  });

  it("uses the repository's standard security posture (security invoker + explicit search_path)", () => {
    expect(body).toContain("security invoker");
    expect(body).toContain("set search_path = public, pg_temp");
  });
});

describe("202607290001 - Row Level Security", () => {
  it("enables RLS on calendar_events", () => {
    expect(sql).toContain("alter table public.calendar_events enable row level security;");
  });

  it("defines exactly the repository's 4-policy-per-operation shape, ownership-only, no join", () => {
    expect(sql).toContain(
      'create policy "Users can view own calendar events"\n  on public.calendar_events\n  for select\n  using (auth.uid() = user_id);'
    );
    expect(sql).toContain(
      'create policy "Users can insert own calendar events"\n  on public.calendar_events\n  for insert\n  with check (auth.uid() = user_id);'
    );
    expect(sql).toContain(
      'create policy "Users can update own calendar events"\n  on public.calendar_events\n  for update\n  using (auth.uid() = user_id)\n  with check (auth.uid() = user_id);'
    );
    expect(sql).toContain(
      'create policy "Users can delete own calendar events"\n  on public.calendar_events\n  for delete\n  using (auth.uid() = user_id);'
    );
  });

  it("never joins to projects/clients inside a policy predicate", () => {
    const policyBlocks = sql.match(/create policy[\s\S]*?;/g) || [];
    expect(policyBlocks.length).toBeGreaterThan(0);
    for (const block of policyBlocks) {
      expect(block).not.toMatch(/from public\.(projects|clients)/);
      expect(block).not.toMatch(/join/i);
    }
  });
});

describe("202607290001 - additive only, no project/task/client schema mutation", () => {
  it("never alters, drops, or updates rows in projects/tasks/clients", () => {
    expect(sql.toLowerCase()).not.toMatch(/alter table public\.projects\b/);
    expect(sql.toLowerCase()).not.toMatch(/alter table public\.tasks\b/);
    expect(sql.toLowerCase()).not.toMatch(/alter table public\.clients\b/);
    expect(sql.toLowerCase()).not.toMatch(/update public\.projects\b/);
    expect(sql.toLowerCase()).not.toMatch(/update public\.tasks\b/);
    expect(sql.toLowerCase()).not.toMatch(/update public\.clients\b/);
    expect(sql.toLowerCase()).not.toMatch(/drop table\b/);
    expect(sql.toLowerCase()).not.toMatch(/drop column\b/);
  });

  it("the only statement touching public.projects outside the trigger function is the new supporting index", () => {
    const projectsMentions = sql
      .split("\n")
      .filter((line) => /public\.projects/i.test(line));

    for (const line of projectsMentions) {
      const isIndexStatement = /create index|on public\.projects\(user_id, deadline_date\)/.test(
        line
      );
      const isFkReference = /references public\.projects\(id\)/.test(line);
      const isTriggerBodyReference =
        /from public\.projects as project/.test(line) ||
        /comment on/.test(line);

      expect(isIndexStatement || isFkReference || isTriggerBodyReference).toBe(
        true
      );
    }
  });
});
