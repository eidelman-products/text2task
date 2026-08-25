import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection or a running Supabase project, matching this repository's
// established migration-testing convention exactly.
//
// PURPOSE (added after the Phase 8 disposable-run Step 3 failure,
// 2026-08-25: `column project.status does not exist` while applying
// 202607270001_project_completion_reconciliation.sql's own top-level
// historical-backfill UPDATE): 01_PREPARE_RUNTIME_FIXTURES.sql's
// public.projects/public.tasks/public.clients stand-ins must contain
// EVERY column the 17-migration prerequisite chain genuinely references
// against those specific tables -- not just the one column a single past
// failure happened to name. This file mechanically re-derives that
// requirement from the actual migration source (four extraction
// patterns: alias-qualified reads in SELECT/WHERE/JOIN clauses,
// `select alias.* into record_var` record-copy field access -- e.g.
// `v_project.client_id` after `select project.* into v_project` -- bare
// UPDATE...SET target columns, and INSERT column lists -- the latter two
// are never alias-qualified, which is exactly the blind spot the
// original stand-in's column set fell into) and asserts the fixture
// schema is a superset of it. If a future migration added to this
// prerequisite chain references a new column on one of these four
// tables, this test fails BEFORE anyone burns a disposable Supabase
// project run finding out the hard way.
//
// SCOPE / HONEST LIMITS: this is a deliberately targeted heuristic
// parser for the specific patterns observed in this repository's actual
// migrations, not a general SQL parser. It tracks, per file, a
// currently-active alias -> real-table mapping via a simple sequential
// state machine (each `from|join|update public.<table> as <alias>`
// declaration updates the mapping for that alias; a declaration against
// an UNRELATED table, e.g. `public.share_link_tasks as task`, clears
// that alias from the map so later `task.column` references in that
// region are correctly NOT attributed to `public.tasks`). This mirrors
// exactly how the real ambiguity (the `task` alias meaning either
// `public.tasks` or `public.share_link_tasks` in different places) was
// manually resolved during the original audit.

const REPO_ROOT = path.join(__dirname, "..", "..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const FIXTURE_FILE = path.join(
  REPO_ROOT,
  "docs",
  "client-share-phase8-access-epoch-runtime",
  "01_PREPARE_RUNTIME_FIXTURES.sql"
);

// Exact prerequisite chain this package's own 02_APPLY_OR_VERIFY_PREREQUISITES.sql
// bundles, in order -- kept as a literal, separately-maintained list
// (not imported from the generator script) so this test independently
// re-confirms the generator's own file list is what actually gets audited.
const PREREQUISITE_MIGRATIONS = [
  "202605250001_project_update_engine.sql",
  "202606150001_project_update_apply_hardening.sql",
  "202607270001_project_completion_reconciliation.sql",
  "202608030003_client_share_owner_foundation.sql",
  "202608030004_client_share_session_foundation.sql",
  "202608030005_client_share_integrity_and_security.sql",
  "202608050001_client_share_owner_reads.sql",
  "202608060001_client_share_lifecycle_operations.sql",
  "202608060002_client_share_access_operations.sql",
  "202608060003_client_share_configuration_save.sql",
  "202608110001_client_share_publication_intent.sql",
  "202608110002_client_share_management_mapping_metadata.sql",
  "202608130001_client_share_rate_limit_increment.sql",
  "202608190001_client_share_message_owner_rpcs.sql",
  "202608210001_client_share_project_update_provenance.sql",
  "202608230001_client_share_apply_boundary.sql",
  "202608230002_client_share_apply_conversion_closure.sql",
];

// The four tables this package's own stand-in schema must cover --
// every other table either genuinely predates the fixture concern (not
// referenced by name here) or is created fresh within this same
// prerequisite chain (needs no stand-in).
const STAND_IN_TABLES = ["projects", "tasks", "clients", "task_resources"] as const;
type StandInTable = (typeof STAND_IN_TABLES)[number];

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

/**
 * Extracts every column this file's SQL genuinely references against one
 * of the four stand-in tables, keyed by table name. Four extraction
 * passes (the first two run together, line by line; the third and
 * fourth run as separate whole-source regex sweeps), matching the ways a
 * column name appears in these migrations:
 *   1. Alias-qualified reads/writes: `alias.column` wherever `alias` is
 *      currently mapped (by the preceding `from|join|update ... as
 *      alias` declaration, OR by a `select alias.* into record_var`
 *      record copy -- see pass 2) to one of the four tables.
 *   2. Record-copy field access: `select project.* into v_project`
 *      followed later by `v_project.client_id` -- `v_project` is mapped
 *      to whatever table `project` was mapped to at that point, and pass
 *      1's alias-qualified matching then covers it automatically.
 *   3. Bare UPDATE...SET target columns: `update public.<table> as X
 *      set\n  col1 = ...,\n  col2 = ...` -- these are never
 *      alias-qualified (invalid SQL to do so on the SET side), so they
 *      are invisible to passes 1/2 entirely.
 *   4. INSERT column lists: `insert into public.<table> (\n  col1,\n
 *      col2\n)` -- also never alias-qualified.
 */
function extractRequiredColumns(source: string): Record<StandInTable, Set<string>> {
  const result: Record<StandInTable, Set<string>> = {
    projects: new Set(),
    tasks: new Set(),
    clients: new Set(),
    task_resources: new Set(),
  };

  const lines = source.split("\n");
  const aliasToTable = new Map<string, StandInTable | null>();

  const declRegex = /\b(?:from|join|update)\s+public\.(\w+)\s+as\s+(\w+)/i;
  // `select <alias>.* into <record_var>` copies an alias's entire row
  // into a plpgsql record variable -- subsequent `<record_var>.<field>`
  // accesses (e.g. `v_project.client_id` after `select project.* into
  // v_project`) are then indistinguishable, syntactically, from a
  // genuine table alias reference, and must resolve to the SAME table.
  const selectStarIntoRegex = /select\s+(\w+)\.\*\s*\n\s*into\s+(\w+)/i;
  const aliasColumnRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\b/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const decl = line.match(declRegex);
    if (decl) {
      const table = decl[1];
      const alias = decl[2];
      if ((STAND_IN_TABLES as readonly string[]).includes(table)) {
        aliasToTable.set(alias, table as StandInTable);
      } else {
        // Declared against an unrelated table (e.g. share_link_tasks,
        // share_link_resources) -- clear any stale mapping for this
        // alias so later bare references in this region are not
        // misattributed to one of our four stand-in tables.
        aliasToTable.set(alias, null);
      }
    }

    // `select project.*` on this line, `into v_project` on the next --
    // matches this exact two-line shape used throughout these migrations.
    const twoLineWindow = line + "\n" + (lines[i + 1] ?? "");
    const starInto = twoLineWindow.match(selectStarIntoRegex);
    if (starInto) {
      const sourceAlias = starInto[1];
      const recordVar = starInto[2];
      const sourceTable = aliasToTable.get(sourceAlias);
      if (sourceTable) {
        aliasToTable.set(recordVar, sourceTable);
      }
    }

    let match: RegExpExecArray | null;
    aliasColumnRegex.lastIndex = 0;
    while ((match = aliasColumnRegex.exec(line)) !== null) {
      const alias = match[1];
      const column = match[2];
      const table = aliasToTable.get(alias);
      if (table) {
        result[table].add(column);
      }
    }
  }

  // Pass 2: bare UPDATE...SET target columns.
  const updateSetRegex = /update\s+public\.(projects|tasks|clients)\s+as\s+\w+\s*\n\s*set\s*\n([\s\S]*?)(?:\n\s*where\b|\n\s*from\b)/gi;
  let updateMatch: RegExpExecArray | null;
  while ((updateMatch = updateSetRegex.exec(source)) !== null) {
    const table = updateMatch[1] as StandInTable;
    const setBlock = updateMatch[2];
    const targetRegex = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gm;
    let targetMatch: RegExpExecArray | null;
    while ((targetMatch = targetRegex.exec(setBlock)) !== null) {
      result[table].add(targetMatch[1]);
    }
  }

  // Pass 3: INSERT column lists.
  const insertRegex = /insert\s+into\s+public\.(projects|tasks|clients)\s*\(([\s\S]*?)\)\s*\n\s*values/gi;
  let insertMatch: RegExpExecArray | null;
  while ((insertMatch = insertRegex.exec(source)) !== null) {
    const table = insertMatch[1] as StandInTable;
    const columnList = insertMatch[2];
    for (const rawName of columnList.split(",")) {
      const name = rawName.trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        result[table].add(name);
      }
    }
  }

  return result;
}

function extractFixtureColumns(fixtureSource: string, table: StandInTable): Set<string> {
  const createRegex = new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`, "m");
  const match = fixtureSource.match(createRegex);
  if (!match) {
    throw new Error(`Could not find "create table public.${table} (...)" in the fixture file.`);
  }
  const body = match[1];
  const columns = new Set<string>();
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("--")) continue;
    if (/^constraint\b/i.test(line)) continue;
    const columnMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+/);
    if (columnMatch) {
      columns.add(columnMatch[1]);
    }
  }
  return columns;
}

describe("Phase 8 Access Epoch runtime package - fixture schema covers every prerequisite-chain column dependency", () => {
  const fixtureSource = readNormalized(FIXTURE_FILE);

  const required: Record<StandInTable, Set<string>> = {
    projects: new Set(),
    tasks: new Set(),
    clients: new Set(),
    task_resources: new Set(),
  };

  for (const name of PREREQUISITE_MIGRATIONS) {
    const source = readNormalized(path.join(MIGRATIONS_DIR, name));
    const found = extractRequiredColumns(source);
    for (const table of STAND_IN_TABLES) {
      for (const column of found[table]) {
        required[table].add(column);
      }
    }
  }

  it("the exact defect this test exists to prevent: projects.status is required and present", () => {
    expect(required.projects.has("status")).toBe(true);
    const fixtureColumns = extractFixtureColumns(fixtureSource, "projects");
    expect(fixtureColumns.has("status")).toBe(true);
  });

  for (const table of STAND_IN_TABLES) {
    it(`public.${table}: every column required by the prerequisite chain is declared in the fixture stand-in`, () => {
      const fixtureColumns = extractFixtureColumns(fixtureSource, table);
      const missing = [...required[table]].filter((column) => !fixtureColumns.has(column));
      expect(missing).toEqual([]);
    });
  }

  it("sanity check: the extraction itself found a non-trivial number of required columns (a silently-broken parser reporting zero would falsely pass)", () => {
    const totalRequired = STAND_IN_TABLES.reduce((sum, table) => sum + required[table].size, 0);
    expect(totalRequired).toBeGreaterThan(20);
  });

  it("sanity check: known columns from the original Step 3 failure's own root cause are all present in the required set (proves the extraction actually found them, not just that the fixture happens to declare them)", () => {
    expect(required.projects.has("status")).toBe(true);
    expect(required.projects.has("priority")).toBe(true);
    expect(required.projects.has("completed_at")).toBe(true);
    expect(required.projects.has("client_id")).toBe(true);
    expect(required.tasks.has("is_archived")).toBe(true);
    expect(required.tasks.has("task_title")).toBe(true);
    expect(required.tasks.has("subtask_order")).toBe(true);
    expect(required.clients.has("email")).toBe(true);
  });
});

// =========================================================================
// PURPOSE (added after the Phase 8 disposable-run Step 4 failure,
// 2026-08-25: `new row for relation "project_share_links" violates check
// constraint "project_share_links_timestamp_order_check"` while seeding
// fixture rows -- created_at defaulted to `now()` at insert time while
// activated_at was explicitly backdated to `now() - interval '2 days'`,
// violating `activated_at >= created_at`): 02B_SEED_PRE_MIGRATION_PRODUCT_FIXTURES.sql's
// own project_share_links/share_session_grants inserts must be internally
// timestamp-coherent against the REAL constraints those tables enforce
// (project_share_links_timestamp_order_check,
// share_browser_sessions_lifecycle_check,
// share_session_grants_lifecycle_check). This is inherently a live-engine
// question in general (arbitrary SQL timestamp expressions cannot be
// evaluated statically) -- this test proves it AS FAR AS CAN BE
// MECHANICALLY PROVEN: every timestamp expression in this fixture file is,
// by construction, written as `now()`, `now() - interval 'N days'`, or
// `now() + interval 'N days'` -- a closed, easily-parsed vocabulary this
// test converts to a signed day-offset and compares directly, exactly
// mirroring the real CHECK constraints' own `>=`/`>` comparisons (valid
// because every offset is relative to the SAME transaction-frozen `now()`
// -- see the fixture file's own header comment on this point).
// =========================================================================

const PROJECT_SHARE_LINKS_MIGRATION = "202608030003_client_share_owner_foundation.sql";
const SESSION_FOUNDATION_MIGRATION = "202608030004_client_share_session_foundation.sql";

/** Converts `now()`, `now() - interval 'N days'`, `now() + interval 'N
 * days'` into a signed day offset. Returns null for anything outside
 * this closed vocabulary (e.g. a bare NULL, a literal timestamp) --
 * callers must skip those columns rather than assume a value. */
function parseDayOffset(expr: string): number | null {
  const trimmed = expr.trim();
  if (/^now\(\)$/i.test(trimmed)) return 0;
  const match = trimmed.match(/^now\(\)\s*([+-])\s*interval\s+'(\d+)\s*days?'$/i);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * Number(match[2]);
}

/** Splits a parenthesized, comma-separated SQL value list into its top-level
 * items, respecting nested parens and single-quoted strings (so a value
 * like `repeat('a1', 32)` is not split on its own internal comma). */
function splitTopLevel(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  let inString = false;
  for (const ch of text) {
    if (ch === "'" ) inString = !inString;
    if (!inString) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
    }
    if (ch === "," && depth === 0 && !inString) {
      items.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) items.push(current);
  return items.map((item) => item.trim());
}

/** Some values in this fixture are a plpgsql variable reference (e.g.
 * `v_grant_disabled_link_created_at`) rather than an inline `now() ±
 * interval` expression -- resolves it back to that expression via its
 * own `<name> timestamptz := <expr>;` declaration, so parseDayOffset can
 * still evaluate it. Returns the original string unchanged if it is not
 * a bare `v_...` identifier or no matching declaration is found. */
function resolveVariableExpression(source: string, expr: string): string {
  const trimmed = expr.trim();
  if (!/^v_[A-Za-z0-9_]+$/.test(trimmed)) return trimmed;
  const declMatch = source.match(new RegExp(`${trimmed}\\s+timestamptz\\s*:=\\s*(now\\(\\)[^;]*);`));
  return declMatch ? declMatch[1].trim() : trimmed;
}

type FixtureRow = Record<string, string>;

function extractInsertRows(source: string, table: string): FixtureRow[] {
  const rows: FixtureRow[] = [];
  const insertRegex = new RegExp(`insert into public\\.${table}\\s*\\(([\\s\\S]*?)\\)\\s*values\\s*\\(([\\s\\S]*?)\\)\\s*returning`, "gi");
  let match: RegExpExecArray | null;
  while ((match = insertRegex.exec(source)) !== null) {
    const columns = splitTopLevel(match[1]);
    const values = splitTopLevel(match[2]);
    const row: FixtureRow = {};
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]] = values[i] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function extractUpdateSetValues(source: string, table: string): Array<Record<string, string>> {
  const results: Array<Record<string, string>> = [];
  const updateRegex = new RegExp(`update public\\.${table}\\s*\\n\\s*set\\s+([\\s\\S]*?)\\n\\s*where`, "gi");
  let match: RegExpExecArray | null;
  while ((match = updateRegex.exec(source)) !== null) {
    const assignments = splitTopLevel(match[1]);
    const parsed: Record<string, string> = {};
    for (const assignment of assignments) {
      const eq = assignment.indexOf("=");
      if (eq === -1) continue;
      const column = assignment.slice(0, eq).trim();
      const value = assignment.slice(eq + 1).trim();
      parsed[column] = value;
    }
    results.push(parsed);
  }
  return results;
}

describe("Phase 8 Access Epoch runtime package - fixture timestamp/lifecycle coherence (02B)", () => {
  const fixtureSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "02B_SEED_PRE_MIGRATION_PRODUCT_FIXTURES.sql")
  );

  const linkRows = extractInsertRows(fixtureSource, "project_share_links");
  const linkUpdates = extractUpdateSetValues(fixtureSource, "project_share_links");
  const sessionRows = extractInsertRows(fixtureSource, "share_browser_sessions");
  const grantRows = extractInsertRows(fixtureSource, "share_session_grants");

  it("found the expected number of project_share_links fixture inserts (4) and the one disabled-transition update (1) -- a parser that silently found zero would falsely pass every check below", () => {
    expect(linkRows.length).toBe(4);
    expect(linkUpdates.length).toBe(1);
  });

  it("every project_share_links INSERT explicitly sets created_at (the exact regression this test exists to catch: relying on the column's own `default now()` while backdating activated_at/disabled_at)", () => {
    for (const row of linkRows) {
      expect(row["created_at"]).toBeDefined();
      expect(parseDayOffset(row["created_at"])).not.toBeNull();
    }
  });

  it("project_share_links_timestamp_order_check: every INSERT satisfies activated_at >= created_at (mirrors the real CHECK constraint's own comparison)", () => {
    for (const row of linkRows) {
      const createdAt = parseDayOffset(row["created_at"]);
      const activatedAt = row["activated_at"] !== undefined ? parseDayOffset(row["activated_at"]) : null;
      expect(createdAt).not.toBeNull();
      if (activatedAt !== null && row["activated_at"] !== undefined) {
        expect(activatedAt).toBeGreaterThanOrEqual(createdAt as number);
      }
    }
  });

  it("project_share_links_timestamp_order_check: every INSERT satisfies expires_at > created_at where expires_at is set", () => {
    for (const row of linkRows) {
      const createdAt = parseDayOffset(row["created_at"]);
      if (row["expires_at"] !== undefined) {
        const expiresAt = parseDayOffset(row["expires_at"]);
        expect(expiresAt).not.toBeNull();
        expect(expiresAt as number).toBeGreaterThan(createdAt as number);
      }
    }
  });

  it("project_share_links_timestamp_order_check: the disabled-transition UPDATE's disabled_at satisfies disabled_at >= created_at (created_at taken from that same link's own INSERT, since UPDATE never re-specifies it)", () => {
    // This fixture's own disabled-link row is inserted 'active' and
    // transitioned separately -- its created_at comes from the INSERT
    // (now() - 6 days), its disabled_at from the UPDATE (now() - 1 day).
    const disabledLinkInsert = linkRows.find((row) => row["public_id"]?.includes("phase8aeDisabledLink"));
    expect(disabledLinkInsert).toBeDefined();
    const createdAt = parseDayOffset(disabledLinkInsert!["created_at"]);
    expect(createdAt).not.toBeNull();

    for (const update of linkUpdates) {
      if (update["disabled_at"] === undefined) continue;
      const disabledAt = parseDayOffset(update["disabled_at"]);
      expect(disabledAt).not.toBeNull();
      expect(disabledAt as number).toBeGreaterThanOrEqual(createdAt as number);
    }
  });

  it("the disabled-transition UPDATE does not decrease configuration_version (enforce_project_share_link_integrity's own SHARE_LINK_CONFIGURATION_VERSION_DECREASE check) -- it must be a plain positive integer literal strictly greater than every INSERT's own configuration_version for that same row", () => {
    const disabledLinkInsert = linkRows.find((row) => row["public_id"]?.includes("phase8aeDisabledLink"));
    expect(disabledLinkInsert).toBeDefined();
    const insertedVersion = Number(disabledLinkInsert!["configuration_version"]);
    expect(Number.isFinite(insertedVersion)).toBe(true);

    for (const update of linkUpdates) {
      if (update["configuration_version"] === undefined) continue;
      const updatedVersion = Number(update["configuration_version"]);
      expect(Number.isFinite(updatedVersion)).toBe(true);
      expect(updatedVersion).toBeGreaterThan(insertedVersion);
    }
  });

  it("the disabled-transition UPDATE does not touch activated_at at all (SHARE_LINK_ACTIVATED_AT_IMMUTABLE fires if a non-null activated_at is changed by any UPDATE)", () => {
    for (const update of linkUpdates) {
      expect(update["activated_at"]).toBeUndefined();
    }
  });

  it("share_browser_sessions_lifecycle_check: every seeded session satisfies expires_at > (implicit created_at default now(), i.e. offset 0)", () => {
    for (const row of sessionRows) {
      expect(row["expires_at"]).toBeDefined();
      const expiresAt = parseDayOffset(row["expires_at"]);
      expect(expiresAt).not.toBeNull();
      // None of this fixture's session inserts specify created_at, so it
      // is the column's own `default now()` -- offset 0.
      expect(expiresAt as number).toBeGreaterThan(0);
    }
  });

  it("share_session_grants_lifecycle_check: every seeded grant satisfies expires_at > created_at and (pin_verified_at is absent or pin_verified_at >= created_at)", () => {
    for (const row of grantRows) {
      const createdAt =
        row["created_at"] !== undefined
          ? parseDayOffset(resolveVariableExpression(fixtureSource, row["created_at"]))
          : 0;
      expect(createdAt).not.toBeNull();

      expect(row["expires_at"]).toBeDefined();
      const expiresAt = parseDayOffset(row["expires_at"]);
      expect(expiresAt).not.toBeNull();
      expect(expiresAt as number).toBeGreaterThan(createdAt as number);

      if (row["pin_verified_at"] !== undefined && row["pin_verified_at"].trim().toLowerCase() !== "null") {
        const pinVerifiedAt = parseDayOffset(row["pin_verified_at"]);
        expect(pinVerifiedAt).not.toBeNull();
        expect(pinVerifiedAt as number).toBeGreaterThanOrEqual(createdAt as number);
      }
    }
  });

  it("cross-reference sanity: the disabled-link grant's created_at falls strictly between that link's own activated_at and disabled_at (a visitor can only exchange the secret after activation, and the grant must still exist before disable happens) -- narrative realism, not merely constraint satisfaction", () => {
    const disabledLinkInsert = linkRows.find((row) => row["public_id"]?.includes("phase8aeDisabledLink"));
    const activatedAt = parseDayOffset(disabledLinkInsert!["activated_at"]);
    const disabledAtUpdate = linkUpdates.find((update) => update["disabled_at"] !== undefined);
    const disabledAt = parseDayOffset(disabledAtUpdate!["disabled_at"]);

    // The grant's own created_at is assigned to a plpgsql variable
    // (v_grant_disabled_link_created_at) rather than inlined -- extracted
    // directly from its `:=` declaration.
    const declMatch = fixtureSource.match(/v_grant_disabled_link_created_at timestamptz := (now\(\)[^;]*);/);
    expect(declMatch).not.toBeNull();
    const grantCreatedAt = parseDayOffset(declMatch![1].trim());

    expect(activatedAt).not.toBeNull();
    expect(disabledAt).not.toBeNull();
    expect(grantCreatedAt).not.toBeNull();
    expect(grantCreatedAt as number).toBeGreaterThan(activatedAt as number);
    expect(grantCreatedAt as number).toBeLessThan(disabledAt as number);
  });

  it("sanity check: the prerequisite migrations these constraints come from are exactly the ones this package's own chain includes (proves the constraint names asserted throughout this suite are not stale/invented)", () => {
    const ownerFoundation = readNormalized(path.join(MIGRATIONS_DIR, PROJECT_SHARE_LINKS_MIGRATION));
    expect(ownerFoundation).toContain("project_share_links_timestamp_order_check");
    expect(ownerFoundation).toContain("project_share_links_state_lifecycle_check");

    const sessionFoundation = readNormalized(path.join(MIGRATIONS_DIR, SESSION_FOUNDATION_MIGRATION));
    expect(sessionFoundation).toContain("share_browser_sessions_lifecycle_check");
    expect(sessionFoundation).toContain("share_session_grants_lifecycle_check");

    expect(PREREQUISITE_MIGRATIONS).toContain(PROJECT_SHARE_LINKS_MIGRATION);
    expect(PREREQUISITE_MIGRATIONS).toContain(SESSION_FOUNDATION_MIGRATION);
  });
});

// =========================================================================
// PURPOSE (added after the Phase 8 disposable-run Step 7 failure,
// 2026-08-25: `42501: permission denied for table projects` inside
// 03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql's own Section B, at a raw
// `insert into public.projects` issued immediately after
// `perform pg_temp.act_as('authenticated', v_owner)`): mechanical
// research (traced from real application source, not from Supabase's own
// GRANT hint) proved this INSERT's role placement was actually CORRECT --
// real Production genuinely grants `authenticated` INSERT/UPDATE(/DELETE)
// on `projects`/`tasks`/`task_resources`, and two earlier, independent
// Client Share runtime packages had already discovered and fixed this
// identical gap. The fix is a new, additive grant/policy file
// (01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql), not a change to file
// 03's own role placement. This test suite guards the resulting shape
// from two directions: (a) 01B's own grant surface stays exactly the
// evidenced set, never broader, and (b) file 03's role-sensitive writes
// keep their current, now-understood-correct role placement -- a harness
// bug in EITHER direction (a fixture/setup write silently running under
// the wrong role, or 01B silently widening beyond what is evidenced)
// would be caught here.
// =========================================================================

const GRANT_FILE = "01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql";

describe("Phase 8 Access Epoch runtime package - authenticated mutation-privilege grant surface (01B)", () => {
  const grantSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", GRANT_FILE)
  );

  function extractGrantPairs(source: string): Array<{ table: string; verbs: string[] }> {
    const pairs: Array<{ table: string; verbs: string[] }> = [];
    const regex = /grant\s+([a-z, ]+)\s+on table public\.(\w+) to (\w+);/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      const verbs = match[1].split(",").map((v) => v.trim().toUpperCase());
      pairs.push({ table: `${match[2]}->${match[3]}`, verbs });
    }
    return pairs;
  }

  it("grants exactly the evidenced verb set per table -- projects and tasks get INSERT/UPDATE/DELETE, task_resources gets INSERT/UPDATE only, all to authenticated", () => {
    const pairs = extractGrantPairs(grantSource);
    const byTarget = new Map(pairs.map((p) => [p.table, p.verbs.slice().sort()]));

    expect(byTarget.get("projects->authenticated")).toEqual(["DELETE", "INSERT", "UPDATE"]);
    expect(byTarget.get("tasks->authenticated")).toEqual(["DELETE", "INSERT", "UPDATE"]);
    expect(byTarget.get("task_resources->authenticated")).toEqual(["INSERT", "UPDATE"]);
  });

  it("never grants anything to anon, and never grants clients any mutation verb", () => {
    expect(grantSource).not.toMatch(/grant\s+[a-z, ]+\s+on table[\s\S]{0,80}?to anon;/i);
    expect(grantSource).not.toMatch(/grant\s+[a-z, ]+\s+on table public\.clients/i);
  });

  it("never grants or references project_share_links, share_session_grants, or any other Client-Share-owned table in an EXECUTABLE statement -- this file's own scope is strictly the pre-existing base-table stand-ins (comment-only mentions explaining what is NOT touched are fine and expected)", () => {
    const executable = grantSource
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    for (const forbidden of ["project_share_links", "share_session_grants", "share_browser_sessions", "share_link_tasks", "share_link_resources", "share_messages"]) {
      expect(executable).not.toContain(forbidden);
    }
  });

  it("every INSERT/UPDATE/DELETE policy uses the exact auth.uid() = user_id ownership predicate -- no broader using(true)/with check(true) shape", () => {
    expect(grantSource).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(grantSource).not.toMatch(/with check\s*\(\s*true\s*\)/i);
    const policyCount = (grantSource.match(/create policy/gi) ?? []).length;
    const ownerPredicateCount = (grantSource.match(/auth\.uid\(\)\s*=\s*user_id/gi) ?? []).length;
    expect(policyCount).toBeGreaterThan(0);
    // Each policy references the predicate at least once (INSERT policies
    // once via WITH CHECK; UPDATE/DELETE policies at least once via
    // USING, twice for UPDATE's own USING + WITH CHECK).
    expect(ownerPredicateCount).toBeGreaterThanOrEqual(policyCount);
  });

  it("includes its own idempotent, fail-closed final verification (positive AND negative checks) -- not merely a bare GRANT/CREATE POLICY sequence with no confirmation", () => {
    expect(grantSource).toContain("has_table_privilege");
    expect(grantSource).toContain("REFUSING TO CONTINUE");
    expect(grantSource).toMatch(/unexpected[\s\S]{0,400}has_table_privilege/i);
  });
});

describe("Phase 8 Access Epoch runtime package - role-state correctness in file 03's own fixture/setup writes", () => {
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );

  /** Walks the source line by line, tracking the current simulated role
   * (mirroring pg_temp.act_as('authenticated', ...) / act_as('postgres')
   * calls exactly as PostgreSQL would apply them sequentially), and
   * returns the role in effect at every `insert into public.<table>`
   * call site found. */
  function roleAtEachInsert(source: string): Array<{ line: number; table: string; role: string }> {
    const results: Array<{ line: number; table: string; role: string }> = [];
    let currentRole = "postgres"; // session starts as postgres/superuser
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const roleSwitch = line.match(/act_as\('(\w+)'/);
      if (roleSwitch) {
        currentRole = roleSwitch[1];
        continue;
      }
      const insertMatch = line.match(/insert into public\.(\w+)/);
      if (insertMatch) {
        results.push({ line: i + 1, table: insertMatch[1], role: currentRole });
      }
    }
    return results;
  }

  const inserts = roleAtEachInsert(testSource);

  it("every insert into public.projects/tasks/task_resources runs while the simulated role is authenticated -- the evidenced, Production-faithful path (01B's own grant makes this valid; running these as postgres would silently stop proving the real RLS-bound owner path)", () => {
    const ownerScopedTables = new Set(["projects", "tasks", "task_resources"]);
    const offenders = inserts.filter((i) => ownerScopedTables.has(i.table) && i.role !== "authenticated");
    expect(offenders).toEqual([]);
  });

  it("found the expected number of owner-scoped table inserts (7 into projects -- Sections B/C/D/E/F/G/I, C now self-contained per the Section-isolation redesign -- plus 1 into tasks and 1 into task_resources -- Section C) -- a parser finding zero would silently pass everything above", () => {
    const ownerScopedTables = new Set(["projects", "tasks", "task_resources"]);
    const relevant = inserts.filter((i) => ownerScopedTables.has(i.table));
    expect(relevant.length).toBe(9);
    expect(relevant.filter((i) => i.table === "projects").length).toBe(7);
    expect(relevant.filter((i) => i.table === "tasks").length).toBe(1);
    expect(relevant.filter((i) => i.table === "task_resources").length).toBe(1);
  });

  it("every insert into the harness-only tracking/scratch tables (share_browser_sessions, share_session_grants, text2task_phase8_fixture_ids, test_results) runs while the simulated role is postgres -- these are never real Production tables an owner-scoped RLS client would write, and a regression here would mean a harness-internal write silently started depending on a grant that does not exist", () => {
    const harnessTables = new Set(["share_browser_sessions", "share_session_grants", "text2task_phase8_fixture_ids"]);
    const offenders = inserts.filter((i) => harnessTables.has(i.table) && i.role !== "postgres");
    expect(offenders).toEqual([]);
    const relevant = inserts.filter((i) => harnessTables.has(i.table));
    expect(relevant.length).toBeGreaterThan(0);
  });

  it("Section H's new H9/H10 assertions (verifying 01B's grant surface stays exactly the evidenced set) are present in file 03 -- the security check this fix added must not have been silently dropped or only ever exist in 01B's own one-time verification", () => {
    expect(testSource).toContain("H9:");
    expect(testSource).toContain("H10:");
    expect(testSource).toContain("no broader");
  });

  it("Section H's PRE-EXISTING project_share_links/share_session_grants least-privilege assertions (H1-H8) are untouched by this fix -- still present, still asserting the original claims, proving this repair did not accidentally weaken or remove them", () => {
    expect(testSource).toContain("H1: RLS remains enabled on project_share_links");
    expect(testSource).toContain("H2: authenticated has ONLY SELECT on project_share_links");
    expect(testSource).toContain("H2: authenticated has NO privilege of any kind on share_session_grants");
    expect(testSource).toContain("H3: enforce_share_session_grant_integrity remains SECURITY INVOKER");
    expect(testSource).toContain("H3: rotate_share_link_secret remains SECURITY DEFINER");
    expect(testSource).toContain("H3: set_share_link_pin remains SECURITY DEFINER");
  });

  it("file 03 itself never issues a GRANT statement of its own -- all privilege changes for this package live exclusively in 01B, one auditable place", () => {
    expect(testSource).not.toMatch(/\bgrant\s+(insert|update|delete|all)\b/i);
  });
});

// =========================================================================
// PURPOSE (added after the Phase 8 disposable-run Step 7 failure,
// 2026-08-25: `42883: function public.activate_share_link(uuid, text,
// integer, text, text, text, integer) does not exist` -- a bare integer
// literal like `1` is typed `integer` by Postgres at parse time, and
// integer -> smallint is only an ASSIGNMENT cast, not an IMPLICIT one --
// implicit casts are what function-overload resolution uses, so a bare
// `1` can never resolve to a `smallint`-typed parameter no matter how
// obviously the value would fit): every RPC call in
// 03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql that passes a literal into a
// `smallint`-typed parameter position must carry an explicit `::smallint`
// cast. This suite mechanically re-derives which positions are
// `smallint` from the CURRENT installed function signatures (re-read from
// the exact migrations that define them -- 202608060001 for
// activate_share_link, 202608250001 for rotate_share_link_secret and
// set_share_link_pin, since that migration reproduces both in full with
// only the stated access_epoch/pin_epoch additions, never touching their
// parameter lists), then checks every actual call site in file 03 against
// that ground truth.
// =========================================================================

const ACTIVATE_SHARE_LINK_MIGRATION = "202608060001_client_share_lifecycle_operations.sql";

describe("Phase 8 Access Epoch runtime package - RPC call argument-type correctness in file 03", () => {
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );

  /** Extracts each parameter's declared type from a `create or replace
   * function public.<name>(...)` signature block, in the exact migration
   * source that currently defines it -- the ground truth this suite
   * checks file 03's call sites against. */
  function extractParamTypes(source: string, functionName: string): string[] {
    const startMarker = `create or replace function public.${functionName}(`;
    const startIndex = source.indexOf(startMarker);
    if (startIndex === -1) {
      throw new Error(`Could not find function ${functionName} in the given source.`);
    }
    const parenStart = startIndex + startMarker.length - 1;
    let depth = 0;
    let i = parenStart;
    for (; i < source.length; i++) {
      if (source[i] === "(") depth++;
      if (source[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    const paramList = source.slice(parenStart + 1, i);
    return splitTopLevel(paramList).map((param) => {
      const parts = param.trim().split(/\s+/);
      return parts[1] ?? ""; // parts[0] is the parameter name (p_xxx)
    });
  }

  /** Finds every call to `functionName` in file 03 (via `public.<name>(`),
   * returning each call's raw argument-expression list. Skips occurrences
   * immediately preceded by a single quote -- those are string literals
   * (e.g. `'public.rotate_share_link_secret(uuid,...)'::regprocedure`
   * signature strings used elsewhere in this file for catalog lookups),
   * not real calls. */
  function extractCallArgs(source: string, functionName: string): string[][] {
    const calls: string[][] = [];
    const marker = `public.${functionName}(`;
    let searchFrom = 0;
    for (;;) {
      const idx = source.indexOf(marker, searchFrom);
      if (idx === -1) break;
      if (idx > 0 && source[idx - 1] === "'") {
        searchFrom = idx + marker.length;
        continue;
      }
      const start = idx + marker.length;
      let depth = 1;
      let i = start;
      let inString = false;
      while (i < source.length && depth > 0) {
        const c = source[i];
        if (c === "'") inString = !inString;
        else if (!inString && c === "(") depth++;
        else if (!inString && c === ")") depth--;
        i++;
      }
      calls.push(splitTopLevel(source.slice(start, i - 1)));
      searchFrom = i;
    }
    return calls;
  }

  const activateSource = readNormalized(path.join(MIGRATIONS_DIR, ACTIVATE_SHARE_LINK_MIGRATION));
  const accessEpochSource = readNormalized(path.join(MIGRATIONS_DIR, "202608250001_client_share_access_epoch.sql"));

  const activateParamTypes = extractParamTypes(activateSource, "activate_share_link");
  const rotateParamTypes = extractParamTypes(accessEpochSource, "rotate_share_link_secret");
  const setPinParamTypes = extractParamTypes(accessEpochSource, "set_share_link_pin");

  it("ground truth: activate_share_link's smallint positions are exactly 3 and 7 (re-derived from the migration that currently defines it, not hardcoded)", () => {
    expect(activateParamTypes).toEqual(["uuid", "text", "smallint", "text", "text", "text", "smallint"]);
  });

  it("ground truth: rotate_share_link_secret's smallint positions are exactly 3 and 7 (re-derived from 202608250001, which reproduces this function in full)", () => {
    expect(rotateParamTypes).toEqual(["uuid", "text", "smallint", "text", "text", "text", "smallint"]);
  });

  it("ground truth: set_share_link_pin's smallint position is exactly 4 (re-derived from 202608250001) -- positions 5-8 are plain integer, which bare integer literals already match with no cast needed", () => {
    expect(setPinParamTypes).toEqual(["uuid", "text", "text", "smallint", "integer", "integer", "integer", "integer"]);
  });

  function assertLiteralArgIsExplicitlySmallint(arg: string, callIndex: number, position: number, functionName: string) {
    const trimmed = arg.trim();
    // Only bare, unadorned integer literals are ambiguous (Postgres types
    // them `integer` by default) -- a variable reference or an already-cast
    // expression is fine regardless of its own text shape.
    if (/^-?\d+$/.test(trimmed)) {
      expect(
        trimmed,
        `${functionName} call #${callIndex + 1}, argument ${position + 1}: bare integer literal "${trimmed}" passed into a smallint parameter without an explicit ::smallint cast -- Postgres will report 42883 (function does not exist), since integer->smallint is an assignment cast, not an implicit one usable in overload resolution.`
      ).toMatch(/::smallint$/);
    }
  }

  it("every activate_share_link call in file 03 casts its smallint-position literal arguments explicitly", () => {
    const calls = extractCallArgs(testSource, "activate_share_link");
    expect(calls.length).toBeGreaterThan(0);
    for (const [callIndex, args] of calls.entries()) {
      activateParamTypes.forEach((type, position) => {
        if (type === "smallint") {
          assertLiteralArgIsExplicitlySmallint(args[position] ?? "", callIndex, position, "activate_share_link");
        }
      });
    }
  });

  it("every rotate_share_link_secret call in file 03 casts its smallint-position literal arguments explicitly", () => {
    const calls = extractCallArgs(testSource, "rotate_share_link_secret");
    expect(calls.length).toBeGreaterThan(0);
    for (const [callIndex, args] of calls.entries()) {
      rotateParamTypes.forEach((type, position) => {
        if (type === "smallint") {
          assertLiteralArgIsExplicitlySmallint(args[position] ?? "", callIndex, position, "rotate_share_link_secret");
        }
      });
    }
  });

  it("every set_share_link_pin call in file 03 casts its smallint-position literal argument explicitly", () => {
    const calls = extractCallArgs(testSource, "set_share_link_pin");
    expect(calls.length).toBeGreaterThan(0);
    for (const [callIndex, args] of calls.entries()) {
      setPinParamTypes.forEach((type, position) => {
        if (type === "smallint") {
          assertLiteralArgIsExplicitlySmallint(args[position] ?? "", callIndex, position, "set_share_link_pin");
        }
      });
    }
  });

  it("found the expected total call counts (8 activate_share_link -- Section C now issues its own after being made self-contained, 4 rotate_share_link_secret, 4 set_share_link_pin) -- a parser silently finding zero calls would falsely pass every check above", () => {
    expect(extractCallArgs(testSource, "activate_share_link").length).toBe(8);
    expect(extractCallArgs(testSource, "rotate_share_link_secret").length).toBe(4);
    expect(extractCallArgs(testSource, "set_share_link_pin").length).toBe(4);
  });

  it("no call anywhere in file 03 relies on ambiguous integer-to-smallint resolution for ANY function with a smallint parameter -- exhaustive sweep across every function this package calls, not just the three known offenders", () => {
    const functionsWithSmallintParams: Array<{ name: string; paramTypes: string[] }> = [
      { name: "activate_share_link", paramTypes: activateParamTypes },
      { name: "rotate_share_link_secret", paramTypes: rotateParamTypes },
      { name: "set_share_link_pin", paramTypes: setPinParamTypes },
    ];

    const violations: string[] = [];
    for (const fn of functionsWithSmallintParams) {
      const calls = extractCallArgs(testSource, fn.name);
      for (const [callIndex, args] of calls.entries()) {
        fn.paramTypes.forEach((type, position) => {
          const arg = (args[position] ?? "").trim();
          if (type === "smallint" && /^-?\d+$/.test(arg)) {
            violations.push(`${fn.name} call #${callIndex + 1} arg ${position + 1}: "${arg}"`);
          }
        });
      }
    }
    expect(violations).toEqual([]);
  });

  it("sanity check: functions with NO smallint parameter (create_share_link_draft, disable_share_link, reenable_share_link, save_share_configuration, clear_share_link_pin, set_share_link_expiry, clear_share_link_expiry, revoke_share_link) are confirmed to genuinely have none, re-derived from their own current signatures -- proves this suite did not simply skip them by assumption", () => {
    const noSmallintFunctions: Array<{ name: string; source: string }> = [
      { name: "create_share_link_draft", source: activateSource },
      { name: "disable_share_link", source: activateSource },
      { name: "reenable_share_link", source: activateSource },
      { name: "revoke_share_link", source: readNormalized(path.join(MIGRATIONS_DIR, "202608060002_client_share_access_operations.sql")) },
      { name: "clear_share_link_pin", source: readNormalized(path.join(MIGRATIONS_DIR, "202608060002_client_share_access_operations.sql")) },
      { name: "set_share_link_expiry", source: readNormalized(path.join(MIGRATIONS_DIR, "202608060002_client_share_access_operations.sql")) },
      { name: "clear_share_link_expiry", source: readNormalized(path.join(MIGRATIONS_DIR, "202608060002_client_share_access_operations.sql")) },
      { name: "save_share_configuration", source: readNormalized(path.join(MIGRATIONS_DIR, "202608110001_client_share_publication_intent.sql")) },
    ];
    for (const fn of noSmallintFunctions) {
      const types = extractParamTypes(fn.source, fn.name);
      expect(types, `${fn.name} was expected to have zero smallint parameters`).not.toContain("smallint");
    }
  });
});

// =========================================================================
// PURPOSE (added after the Phase 8 disposable-run Step 7 failure,
// 2026-08-25: `23505: duplicate key value violates unique constraint
// "share_browser_sessions_session_digest_unique"` -- `repeat('e5', 32)`
// was used both by 02B's own committed `session_no_pin` fixture AND by
// file 03's own Section D, and -- discovered only by the FULL sweep this
// suite performs, not by fixing that one collision alone --
// `repeat('55', 32)` was independently reused FIVE times across file 03's
// own Sections B/D/E/F/G, which would have failed the exact same way,
// one section at a time, on every subsequent re-run): this suite
// mechanically enumerates every literal value written into a
// UNIQUE-constrained column across BOTH 02B and file 03 combined, and
// fails if any two independent fixture objects collide. An intentional
// duplicate used specifically to test rejection-on-uniqueness would need
// to be added to the explicit allowlist below, with a name and reason --
// none exists today.
// =========================================================================

describe("Phase 8 Access Epoch runtime package - fixture uniqueness collision detector (02B + 03 combined)", () => {
  const seedSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "02B_SEED_PRE_MIGRATION_PRODUCT_FIXTURES.sql")
  );
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );

  type TaggedValue = { file: string; value: string };

  /** No collisions are intentional anywhere in this package today -- an
   * empty allowlist is itself an assertion: if this suite is ever
   * extended with a deliberate uniqueness-rejection test, that test's
   * own fixture value(s) must be added here BY NAME, not silently
   * tolerated by loosening the checks below. */
  const ALLOWLISTED_DUPLICATES: ReadonlySet<string> = new Set();

  function findDuplicates(values: TaggedValue[]): Map<string, TaggedValue[]> {
    const byValue = new Map<string, TaggedValue[]>();
    for (const entry of values) {
      if (ALLOWLISTED_DUPLICATES.has(entry.value)) continue;
      const existing = byValue.get(entry.value) ?? [];
      existing.push(entry);
      byValue.set(entry.value, existing);
    }
    const duplicates = new Map<string, TaggedValue[]>();
    for (const [value, entries] of byValue) {
      if (entries.length > 1) duplicates.set(value, entries);
    }
    return duplicates;
  }

  function formatDuplicates(duplicates: Map<string, TaggedValue[]>): string {
    return [...duplicates.entries()]
      .map(([value, entries]) => `  "${value}" used ${entries.length}x: ${entries.map((e) => e.file).join(", ")}`)
      .join("\n");
  }

  it("share_browser_sessions.session_digest: no two fixture sessions across 02B + 03 share the same digest (the exact class of bug this suite exists to catch)", () => {
    const seedRows = extractInsertRows(seedSource, "share_browser_sessions");
    const testRows = extractInsertRows(testSource, "share_browser_sessions");

    const values: TaggedValue[] = [
      ...seedRows.map((row) => ({ file: "02B", value: (row["session_digest"] ?? "").trim() })),
      ...testRows.map((row) => ({ file: "03", value: (row["session_digest"] ?? "").trim() })),
    ];

    const duplicates = findDuplicates(values);
    expect(duplicates.size, `Duplicate session_digest seed(s) found:\n${formatDuplicates(duplicates)}`).toBe(0);
  });

  it("share_browser_sessions.session_digest: found the expected total row count (4 from 02B + 10 from 03 = 14: Sections B, C (made self-contained), D-outer, D-nested, E, F (f1 long-lived + f2 short-TTL, added by the Section F expiry redesign), and G's three sessions) -- a parser silently finding fewer would falsely pass the uniqueness check above", () => {
    const seedRows = extractInsertRows(seedSource, "share_browser_sessions");
    const testRows = extractInsertRows(testSource, "share_browser_sessions");
    expect(seedRows.length).toBe(4);
    expect(testRows.length).toBe(10);
  });

  it("project_share_links.public_id: no two fixture links across 02B + 03 share the same public_id", () => {
    const seedRows = extractInsertRows(seedSource, "project_share_links");
    const draftCallRegex = /create_share_link_draft\(v_project_id,\s*'([A-Za-z0-9_-]+)'\)/g;
    const testValues: TaggedValue[] = [];
    let match: RegExpExecArray | null;
    while ((match = draftCallRegex.exec(testSource)) !== null) {
      testValues.push({ file: "03", value: match[1] });
    }

    const values: TaggedValue[] = [
      ...seedRows.map((row) => ({ file: "02B", value: (row["public_id"] ?? "").trim().replace(/^'|'$/g, "") })),
      ...testValues,
    ];

    const duplicates = findDuplicates(values);
    expect(duplicates.size, `Duplicate public_id seed(s) found:\n${formatDuplicates(duplicates)}`).toBe(0);
  });

  it("project_share_links.public_id: found the expected total count (4 from 02B + 8 from 03 = 12, after Section C was made self-contained with its own draft call)", () => {
    const seedRows = extractInsertRows(seedSource, "project_share_links");
    const draftCallRegex = /create_share_link_draft\(v_project_id,\s*'([A-Za-z0-9_-]+)'\)/g;
    const testCount = (testSource.match(draftCallRegex) ?? []).length;
    expect(seedRows.length).toBe(4);
    expect(testCount).toBe(8);
  });

  it("all session_digest values are well-formed 64-character lowercase hex (matches share_browser_sessions_session_digest_format_check exactly -- a malformed seed would fail with a DIFFERENT error than uniqueness, but is worth catching here too)", () => {
    const seedRows = extractInsertRows(seedSource, "share_browser_sessions");
    const testRows = extractInsertRows(testSource, "share_browser_sessions");
    for (const row of [...seedRows, ...testRows]) {
      const raw = (row["session_digest"] ?? "").trim();
      const seedMatch = raw.match(/^repeat\('([0-9a-f]{2})',\s*32\)$/);
      expect(seedMatch, `session_digest expression "${raw}" is not a repeat('<2-lowercase-hex-chars>', 32) literal`).not.toBeNull();
    }
  });

  it("all public_id values are well-formed per project_share_links_public_id_format_check (^[A-Za-z0-9_-]{16,64}$)", () => {
    const seedRows = extractInsertRows(seedSource, "project_share_links");
    const draftCallRegex = /create_share_link_draft\(v_project_id,\s*'([A-Za-z0-9_-]+)'\)/g;
    const testValues: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = draftCallRegex.exec(testSource)) !== null) {
      testValues.push(match[1]);
    }
    const seedValues = seedRows.map((row) => (row["public_id"] ?? "").trim().replace(/^'|'$/g, ""));
    for (const value of [...seedValues, ...testValues]) {
      expect(value, `public_id "${value}" fails the ^[A-Za-z0-9_-]{16,64}$ format check`).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    }
  });
});

// =========================================================================
// PURPOSE: a static, mechanically-derived CONSTRAINT PREFLIGHT MATRIX --
// table / constraint / fixture write site / expected validity -- covering
// every fixture write in 02B and file 03 against the real constraints
// installed by the prerequisite chain + 202608250001. This is the
// document-as-test form of the full manual audit performed for this
// package; it exists so the NEXT harness change is checked against the
// same matrix mechanically, not re-derived from scratch by re-reading
// every migration again.
// =========================================================================

describe("Phase 8 Access Epoch runtime package - constraint preflight matrix", () => {
  const seedSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "02B_SEED_PRE_MIGRATION_PRODUCT_FIXTURES.sql")
  );
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );
  const ownerFoundationSource = readNormalized(path.join(MIGRATIONS_DIR, "202608030003_client_share_owner_foundation.sql"));
  const sessionFoundationSource = readNormalized(path.join(MIGRATIONS_DIR, "202608030004_client_share_session_foundation.sql"));
  const integritySource = readNormalized(path.join(MIGRATIONS_DIR, "202608030005_client_share_integrity_and_security.sql"));

  // TABLE | CONSTRAINT | WHERE IT IS ENFORCED (ground truth) | WHICH FIXTURE
  // WRITE SITE(S) IT GOVERNS | WHY THIS SUITE CONSIDERS IT SATISFIED.
  // Kept as a literal, human-readable matrix (not just pass/fail booleans)
  // so a future reader can see the reasoning, not just a green checkmark.
  const MATRIX: Array<{
    table: string;
    constraint: string;
    definedIn: string;
    writeSites: string;
    expectedValidity: string;
  }> = [
    {
      table: "project_share_links",
      constraint: "project_share_links_public_id_format_check",
      definedIn: "202608030003",
      writeSites: "02B (4 direct INSERTs), 03 (8 create_share_link_draft calls)",
      expectedValidity: "PASS -- verified above (format + uniqueness suite)",
    },
    {
      table: "project_share_links",
      constraint: "project_share_links_public_id_unique",
      definedIn: "202608030003",
      writeSites: "02B (4 direct INSERTs), 03 (8 create_share_link_draft calls)",
      expectedValidity: "PASS -- verified above (uniqueness suite)",
    },
    {
      table: "project_share_links",
      constraint: "project_share_links_timestamp_order_check",
      definedIn: "202608030003",
      writeSites: "02B's 4 direct INSERTs (explicit created_at <= activated_at/disabled_at)",
      expectedValidity: "PASS -- verified by the dedicated timestamp/lifecycle-coherence suite above",
    },
    {
      table: "project_share_links",
      constraint: "project_share_links_state_lifecycle_check",
      definedIn: "202608030003",
      writeSites: "02B's 4 direct INSERTs + its one disabled-transition UPDATE",
      expectedValidity: "PASS -- verified by the dedicated timestamp/lifecycle-coherence suite above",
    },
    {
      table: "project_share_links",
      constraint: "enforce_project_share_link_integrity (state-transition + version-bump-on-access-change, incl. SHARE_LINK_VERSION_NOT_INCREMENTED when expires_at changes without a configuration_version bump in the SAME statement)",
      definedIn: "202608030005",
      writeSites: "02B's disabled-link transition UPDATE; 03 Section F's set_share_link_expiry/clear_share_link_expiry RPC calls (each RPC bumps configuration_version in the same UPDATE that changes expires_at -- this is the exact invariant a prior raw-UPDATE harness design violated; see Section F's own header comment)",
      expectedValidity: "PASS -- verified by the dedicated timestamp/lifecycle-coherence suite above (02B) and by Section F's F-G/F-H before/after configuration_version captures (03) -- see the 'no raw expires_at mutation bypasses configuration_version' regression suite below",
    },
    {
      table: "share_browser_sessions",
      constraint: "enforce_share_browser_session_integrity (SHARE_SESSION_EXPIRY_IMMUTABLE -- expires_at can never change after insert, for any caller)",
      definedIn: "202608030005",
      writeSites: "03 Section F's session-TTL sub-test (F-F) -- deliberately never UPDATEs an existing session's expires_at; instead INSERTs a FRESH session (digest f2) with the desired short expires_at baked in at insert time, then waits for genuine wall-clock time to pass via pg_sleep()",
      expectedValidity: "PASS structurally -- 03 contains no UPDATE statement targeting share_browser_sessions.expires_at anywhere (verified by the 'no raw session-expiry mutation' regression suite below); this row exists specifically because an earlier harness design DID attempt such an UPDATE and was correctly rejected by this trigger, which is why Section F was redesigned",
    },
    {
      table: "share_browser_sessions",
      constraint: "share_browser_sessions_session_digest_unique",
      definedIn: "202608030004",
      writeSites: "02B (4), 03 (10, across Sections B/C/D/E/F/G -- Section F now creates two: f1 long-lived for the link-expiry sub-tests, f2 short-TTL for the independent session-TTL sub-test)",
      expectedValidity: "PASS -- verified above (uniqueness suite) -- THIS is the constraint the Step 7 failure violated",
    },
    {
      table: "share_browser_sessions",
      constraint: "share_browser_sessions_session_digest_format_check",
      definedIn: "202608030004",
      writeSites: "02B (4), 03 (10)",
      expectedValidity: "PASS -- verified above (format suite)",
    },
    {
      table: "share_browser_sessions",
      constraint: "share_browser_sessions_lifecycle_check (expires_at > created_at)",
      definedIn: "202608030004",
      writeSites: "02B (4, no explicit created_at -- default now()), 03 (10, likewise)",
      expectedValidity: "PASS -- verified by the timestamp/lifecycle-coherence suite for 02B; 03's own sessions all use now()+N-day expires_at with implicit now() created_at, trivially satisfying > ",
    },
    {
      table: "share_session_grants",
      constraint: "share_session_grants_current_unique_idx (partial unique on browser_session_id, share_link_id WHERE revoked_at IS NULL)",
      definedIn: "202608030004",
      writeSites: "02B (4 direct INSERTs, one per distinct session+link pair), 03 (pg_temp.emulate_ensure_current_grant, called multiple times per section against a stable session+link pair, always revoking the prior current grant before inserting its replacement)",
      expectedValidity: "PASS -- every session_id is now globally unique (see above), so cross-section collision is structurally impossible; within a section, emulate_ensure_current_grant's own revoke-then-insert sequence (mirroring the real TypeScript function) keeps at most one non-revoked row per pair at all times",
    },
    {
      table: "share_session_grants",
      constraint: "share_session_grants_lifecycle_check (expires_at > created_at, pin_verified_at >= created_at)",
      definedIn: "202608030004",
      writeSites: "02B (4 direct INSERTs), 03 (via emulate_ensure_current_grant)",
      expectedValidity: "PASS -- verified by the timestamp/lifecycle-coherence suite for 02B; emulate_ensure_current_grant always derives created_at/pin_verified_at/expires_at from the same now()-based session expiry, matching the real ensureCurrentGrant's own invariant",
    },
    {
      table: "share_session_grants",
      constraint: "enforce_share_session_grant_integrity (session live+unrevoked, link active+unexpired, project not deleted, granted_*_epoch exact match, PIN-verification-presence match)",
      definedIn: "202608030005 (base), 202608250001 (adds access_epoch/pin_epoch checks, removes expiry-vs-link check)",
      writeSites: "02B (4 direct INSERTs, each against its own just-activated/just-disabled link), 03 (every emulate_ensure_current_grant / emulate_pin_recovery / emulate_session_exchange call, plus Section G5b's own deliberate direct INSERT against a revoked link, which is EXPECTED to be rejected and is caught by its own nested exception handler)",
      expectedValidity: "PASS -- every 03 call path re-derives the link's live epoch/state values immediately before writing (mirroring the real TypeScript emulation layer), so a stale value can never be passed; G5b's own expected rejection is asserted, not merely tolerated",
    },
    {
      table: "public.tasks / public.task_resources / public.projects",
      constraint: "no UNIQUE constraint beyond auto-generated primary key id",
      definedIn: "01_PREPARE_RUNTIME_FIXTURES.sql (this package's own stand-in)",
      writeSites: "03 Section B/C/D/E/F/G/I (projects, one per section), Section C7/C8 (tasks, task_resources)",
      expectedValidity: "PASS structurally -- no literal-value collision is possible regardless of repeated user_id/project_id (both are FK references, not unique columns)",
    },
    {
      table: "public.tasks / public.task_resources / public.projects",
      constraint: "authenticated INSERT/UPDATE(/DELETE) grant + owner-scoped RLS policy",
      definedIn: "01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql",
      writeSites: "03 Section B/D/E/F/G/I (projects), Section C7/C8 (tasks, task_resources)",
      expectedValidity: "PASS -- verified by the role-state-correctness suite above (every insert into these tables runs while the simulated role is authenticated) and by 01B's own idempotent final-verification block",
    },
    {
      table: "activate_share_link / rotate_share_link_secret / set_share_link_pin",
      constraint: "exact smallint-typed parameter positions",
      definedIn: "202608060001 (activate_share_link), 202608250001 (rotate_share_link_secret, set_share_link_pin)",
      writeSites: "03: 8 activate_share_link calls, 4 rotate_share_link_secret calls, 4 set_share_link_pin calls",
      expectedValidity: "PASS -- verified by the RPC call argument-type-correctness suite above",
    },
    {
      table: "project_updates / share_messages / share_message_conversions",
      constraint: "source_type/status CHECKs, author_type CHECK, status_timestamps coupling CHECK",
      definedIn: "202605250001 (project_updates), 202608030003 (share_messages)",
      writeSites: "02B only (one control row each) -- 03 never writes to either table",
      expectedValidity: "PASS -- 02B's own control rows use plain, default-satisfying values ('text'/'draft' for project_updates; default 'new' status, no reviewed_at/resolved_at for share_messages) -- no collision risk since 03 never touches these tables at all",
    },
  ];

  it("the constraint preflight matrix itself is non-empty and covers every table this package's fixture writes touch", () => {
    const coveredTables = new Set(MATRIX.map((row) => row.table));
    expect(MATRIX.length).toBeGreaterThan(10);
    expect([...coveredTables].some((t) => t.includes("project_share_links"))).toBe(true);
    expect([...coveredTables].some((t) => t.includes("share_browser_sessions"))).toBe(true);
    expect([...coveredTables].some((t) => t.includes("share_session_grants"))).toBe(true);
  });

  it("every constraint name in the matrix genuinely exists in the migration it claims to be defined in (the matrix does not cite a stale or invented constraint name)", () => {
    const sourcesByMigrationPrefix: Record<string, string> = {
      "202608030003": ownerFoundationSource,
      "202608030004": sessionFoundationSource,
      "202608030005": integritySource,
    };
    for (const row of MATRIX) {
      const firstPrefix = row.definedIn.split(/[\s(,]/)[0];
      const source = sourcesByMigrationPrefix[firstPrefix];
      if (!source) continue; // rows citing 202608250001 or 202608060001 are covered by other suites in this file
      // Extract the bare constraint/check name (first token before any
      // parenthetical explanation) to search for.
      const bareName = row.constraint.split(/[\s(]/)[0];
      expect(source, `Matrix row for ${row.table}/${bareName} claims it is defined in ${row.definedIn}, but "${bareName}" was not found there`).toContain(bareName);
    }
  });

  it("every fixture write site the matrix references is confirmed present (project count sanity: 02B has exactly 4 project_share_links inserts, 03 has exactly 10 share_browser_sessions inserts and 8 create_share_link_draft calls)", () => {
    expect(extractInsertRows(seedSource, "project_share_links").length).toBe(4);
    expect(extractInsertRows(testSource, "share_browser_sessions").length).toBe(10);
    expect((testSource.match(/create_share_link_draft\(v_project_id,\s*'[A-Za-z0-9_-]+'\)/g) ?? []).length).toBe(8);
  });
});

// =========================================================================
// PURPOSE (added 2026-08-25, Section F redesign): file 03's own Step 8
// disposable run reached Section F and failed with `P0001:
// SHARE_LINK_VERSION_NOT_INCREMENTED`, raised by
// enforce_project_share_link_integrity against a raw
// `update public.project_share_links set expires_at = ...` that changed
// an access-classified column without also bumping configuration_version
// in the SAME statement -- a real, always-enforced trigger invariant, not
// a harness inconvenience (see Section F's own header comment in
// 03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql for the full root-cause writeup).
// A second, related defect was found proactively during the same audit:
// share_browser_sessions.expires_at is UNCONDITIONALLY immutable after
// insert (SHARE_SESSION_EXPIRY_IMMUTABLE), so no UPDATE against it can
// ever be legitimate, by any caller.
//
// WHY THE EARLIER "constraint preflight matrix" suite (immediately above)
// did not already catch this: that suite -- and the
// timestamp/lifecycle-coherence suite further above -- were both built to
// check STATIC, literal fixture VALUES (an INSERT's own column list)
// against single-row CHECK constraints (e.g. "expires_at > created_at").
// Neither ever modeled a TRIGGER-level, cross-column, cross-STATEMENT
// invariant like "if this UPDATE changes any access-classified column,
// configuration_version must ALSO increase in that same UPDATE" -- that
// class of rule only exists in a BEFORE UPDATE trigger function's own
// body, not in a table's declarative CHECK constraints, and file 03's
// Section F was (at the time) the ONLY raw UPDATE against either of
// these two tables anywhere in this whole package -- 02B's own one
// project_share_links UPDATE (the disabled-transition) happens to touch
// `state`, which the earlier suite's dedicated
// SHARE_LINK_CONFIGURATION_VERSION_DECREASE check (line ~445 above)
// already covered by coincidence, not by design intent to model
// trigger-required companion-column semantics generally. This suite
// closes that gap directly and generally, so a future raw mutation
// re-introducing either defect fails here before anyone burns another
// disposable Supabase run finding out the hard way.
// =========================================================================

describe("Phase 8 Access Epoch runtime package - Section F regression: no raw mutation bypasses expiry/version trigger invariants", () => {
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );

  // The exact column set enforce_project_share_link_integrity's own
  // v_access_changed logic checks (202608030005), reproduced here as a
  // literal, separately-maintained list -- not derived from the trigger
  // source itself -- so this test independently re-confirms the set, the
  // same convention this file already uses for PREREQUISITE_MIGRATIONS.
  const ACCESS_CHANGED_COLUMNS = [
    "secret_digest",
    "secret_digest_version",
    "state",
    "expires_at",
    "pin_hash",
    "pin_salt",
    "pin_hash_version",
    "pin_scrypt_n",
    "pin_scrypt_r",
    "pin_scrypt_p",
    "pin_key_length",
    "comments_enabled",
    "client_facing_subtitle",
    "content_direction",
  ];

  /** Strips whole-line SQL comments (`-- ...`) before searching for actual
   * statements -- this file's own Section F header comment quotes the two
   * illegal UPDATE shapes verbatim (inside backticks) as part of
   * explaining why they were removed, which would otherwise falsely
   * trip these two checks. Only strips comments that occupy an entire
   * line (this file never places a `--` comment after real SQL on the
   * same line), so no live statement text is ever discarded. */
  function stripCommentLines(source: string): string {
    return source
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
  }

  const testSourceNoComments = stripCommentLines(testSource);

  it("file 03 contains NO raw UPDATE statement against project_share_links at all (every configuration change goes through a real owner RPC, which itself is proven elsewhere to bump configuration_version correctly)", () => {
    const updateRegex = /update\s+public\.project_share_links\b/gi;
    const matches = testSourceNoComments.match(updateRegex) ?? [];
    expect(matches, "file 03 must not issue a raw UPDATE against project_share_links -- use the real owner RPCs instead (set_share_link_expiry, clear_share_link_expiry, revoke_share_link, etc.)").toEqual([]);
  });

  it("file 03 contains NO raw UPDATE statement against share_browser_sessions at all (expires_at is unconditionally immutable after insert -- SHARE_SESSION_EXPIRY_IMMUTABLE -- so no UPDATE against this table can ever be legitimate)", () => {
    const updateRegex = /update\s+public\.share_browser_sessions\b/gi;
    const matches = testSourceNoComments.match(updateRegex) ?? [];
    expect(matches, "file 03 must not issue a raw UPDATE against share_browser_sessions -- a short-TTL session must be created FRESH (INSERT, with expires_at baked in) rather than shortening an existing one").toEqual([]);
  });

  it("generalized guard: IF a raw UPDATE against project_share_links is ever reintroduced anywhere in file 03, it must bump configuration_version in the SAME statement whenever it also touches an access-classified column -- otherwise it would be rejected by enforce_project_share_link_integrity's own SHARE_LINK_VERSION_NOT_INCREMENTED check", () => {
    const updates = extractUpdateSetValues(testSource, "project_share_links");
    for (const [index, update] of updates.entries()) {
      const touchesAccessChangedColumn = ACCESS_CHANGED_COLUMNS.some((col) => update[col] !== undefined);
      if (touchesAccessChangedColumn) {
        expect(
          update["configuration_version"],
          `file 03's project_share_links UPDATE #${index + 1} changes an access-classified column but does not also set configuration_version in the same statement -- this would be rejected with SHARE_LINK_VERSION_NOT_INCREMENTED`
        ).toBeDefined();
      }
    }
  });

  it("Section F's own header comment documents the root cause and redesign rationale (proves this is a deliberate, explained design, not a silently-dropped feature)", () => {
    expect(testSource).toContain("SHARE_LINK_VERSION_NOT_INCREMENTED");
    expect(testSource).toContain("SHARE_SESSION_EXPIRY_IMMUTABLE");
    expect(testSource).toContain("clock_timestamp()");
  });

  it("Section F genuinely exercises set_share_link_expiry and clear_share_link_expiry (the real RPCs) rather than merely removing the old assertions outright", () => {
    expect(testSource).toMatch(/perform public\.set_share_link_expiry\(v_link_id/);
    expect(testSource).toMatch(/perform public\.clear_share_link_expiry\(v_link_id\)/);
  });

  it("Section F uses pg_sleep() to prove genuine time passage rather than backdating any row", () => {
    expect(testSource).toMatch(/perform pg_sleep\(\d+\)/);
  });

  // ---------------------------------------------------------------------
  // ADDED 2026-08-26: a SECOND, more subtle instance of the exact same
  // now()-vs-clock_timestamp() class of bug the fix above already fixed
  // for the READ side (emulate_is_link_active / emulate_verify_authorization).
  // F-B's shortened link expiry and F-F's fresh session both used to
  // compute their own "N seconds from now" fixture VALUE from `now()`,
  // which is frozen to the whole transaction's own start time -- by the
  // time Section F runs (after Sections A-E), clock_timestamp() (used by
  // the verifier) could already be past that value even BEFORE
  // pg_sleep(), producing a false proof of TTL expiration. Fixed by
  // anchoring every short-lived fixture value to clock_timestamp() too.
  // This suite guards both directions generally: no seconds-scale
  // now()-based expiry may exist anywhere in the file, and Section F's
  // own short-lived fixtures specifically must be clock_timestamp()-anchored.
  // ---------------------------------------------------------------------

  it("no fixture expiry value anywhere in file 03 is a seconds-scale interval added to now() -- a short-lived (seconds) expiry must be anchored to clock_timestamp() (the same advancing clock any later verification or pg_sleep()-based wait reads), never the transaction-frozen now(), or it risks reading as already-expired the instant it is evaluated later in this same long-running transaction", () => {
    // Comments are stripped first -- this section's own 2026-08-26 header
    // note quotes the OLD, now-fixed `now() + interval '3 seconds'`
    // expression verbatim (inside backticks) to explain what was wrong,
    // which would otherwise falsely trip this check.
    const nowSecondsRegex = /now\(\)\s*\+\s*interval\s*'\d+\s*seconds?'/gi;
    const offenders = testSourceNoComments.match(nowSecondsRegex) ?? [];
    expect(offenders, `found now()-based seconds-scale expiry fixture(s), which must use clock_timestamp() instead: ${offenders.join(", ")}`).toEqual([]);
  });

  it("Section F's short-lived (3-second) expiry fixtures -- F-B's shortened link expiry and F-F's fresh session -- are anchored to clock_timestamp(), not now()", () => {
    // Section boundaries are located in the ORIGINAL source (the
    // "-- Section F:"/"-- Section G:" headings are themselves comment
    // lines, so they don't survive stripCommentLines) -- only the sliced
    // body is then comment-stripped before counting real code matches.
    const sectionFIdx = testSource.indexOf("-- Section F:");
    const sectionGIdx = testSource.indexOf("-- Section G:");
    expect(sectionFIdx).toBeGreaterThan(-1);
    expect(sectionGIdx).toBeGreaterThan(sectionFIdx);
    const sectionFBody = stripCommentLines(testSource.slice(sectionFIdx, sectionGIdx));

    const shortLivedMatches = sectionFBody.match(/clock_timestamp\(\)\s*\+\s*interval\s*'3 seconds'/g) ?? [];
    expect(shortLivedMatches.length, "expected exactly 2 short-lived (3-second) clock_timestamp()-anchored expiry fixtures in Section F: F-B's shortened link expiry and F-F's fresh session").toBe(2);
  });

  it("every expiry value actually WRITTEN in Section F's own body (set_share_link_expiry calls and share_browser_sessions.expires_at inserts) is clock_timestamp()-anchored, never a bare now() -- generalized guard against reintroducing the exact defect class this suite exists to catch, not just the two known fixtures above", () => {
    const sectionFIdx = testSource.indexOf("-- Section F:");
    const sectionGIdx = testSource.indexOf("-- Section G:");
    const sectionFBody = testSource.slice(sectionFIdx, sectionGIdx);

    const rpcArgs = [...sectionFBody.matchAll(/set_share_link_expiry\(v_link_id,\s*([^)]+)\)/g)].map((m) => m[1].trim());
    const sessionRows = extractInsertRows(sectionFBody, "share_browser_sessions");
    const insertExprs = sessionRows.map((row) => (row["expires_at"] ?? "").trim());

    const allExprs = [...rpcArgs, ...insertExprs];
    expect(allExprs.length, "expected to find Section F's own expiry-writing call sites -- a parser finding zero would silently pass everything above").toBeGreaterThanOrEqual(5);
    for (const expr of allExprs) {
      expect(expr.startsWith("now("), `Section F fixture expiry expression "${expr}" is anchored to now() (transaction-frozen) rather than clock_timestamp() -- unsafe when combined with this section's own pg_sleep() calls`).toBe(false);
    }
  });
});

// =========================================================================
// PURPOSE (added 2026-08-25, Task 3 -- section isolation): after
// repeatedly burning entire manual Supabase runs on the FIRST unexpected
// exception encountered (each run reporting only one new failure at a
// time), file 03's Sections A-J were each wrapped in their own
// `exception when others` handler so one section's unexpected failure
// cannot prevent every OTHER section from still running and reporting its
// own results in the SAME run. This suite statically guards the two
// invariants that design depends on: every section genuinely has its own
// handler (an exception cannot silently propagate past a section and
// abort the whole script before the final PASS/FAIL summary), and that
// handler can never itself misreport an unexpected exception as a PASS.
// =========================================================================

describe("Phase 8 Access Epoch runtime package - section isolation (Task 3): no unexpected exception can abort the whole diagnostic run, and no section-level exception can be silently classified PASS", () => {
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );

  /** Splits file 03 into its top-level `do $$ ... $$;` blocks, tagging
   * each with the section letter its own body's record_result calls use
   * (the FIRST section letter literal found inside the block) -- Sections
   * A-J are expected to be found this way; the safety-gate block (0) and
   * any other infrastructure block (variable declarations, function
   * definitions) legitimately has no section letter and is skipped. */
  function extractDoBlocks(source: string): Array<{ section: string | null; body: string }> {
    const blocks: Array<{ section: string | null; body: string }> = [];
    const blockRegex = /do \$\$([\s\S]*?)\$\$;/g;
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(source)) !== null) {
      const body = match[1];
      const sectionMatch = body.match(/pg_temp\.record_result\(\s*'([A-Z])'/);
      blocks.push({ section: sectionMatch ? sectionMatch[1] : null, body });
    }
    return blocks;
  }

  const blocks = extractDoBlocks(testSource);
  const lettered = blocks.filter((b): b is { section: string; body: string } => b.section !== null);
  const bySection = new Map<string, { section: string; body: string }[]>();
  for (const block of lettered) {
    const list = bySection.get(block.section) ?? [];
    list.push(block);
    bySection.set(block.section, list);
  }

  it("found the expected lettered sections A through J, one top-level do-block each (a parser finding fewer would silently pass every check below)", () => {
    const sections = "ABCDEFGHIJ".split("");
    for (const section of sections) {
      expect(bySection.get(section)?.length, `expected exactly one top-level do-block for Section ${section}`).toBe(1);
    }
  });

  it("every one of Sections A-J has its own `exception when others then` clause inside its own do-block", () => {
    const sections = "ABCDEFGHIJ".split("");
    const missing: string[] = [];
    for (const section of sections) {
      const block = bySection.get(section)?.[0];
      if (!block || !/exception\s*\n\s*when others then/.test(block.body)) {
        missing.push(section);
      }
    }
    expect(missing, `Section(s) missing their own 'exception when others' handler: ${missing.join(", ")}`).toEqual([]);
  });

  it("every Section's own 'exception when others' handler calls record_result with a literal `false` -- never `true` or a computed boolean -- so an unexpected exception can never be silently classified as a PASS", () => {
    const sections = "ABCDEFGHIJ".split("");
    const offenders: string[] = [];
    for (const section of sections) {
      const block = bySection.get(section)?.[0];
      if (!block) continue;
      const exceptionIdx = block.body.search(/exception\s*\n\s*when others then/);
      if (exceptionIdx === -1) continue;
      const handlerBody = block.body.slice(exceptionIdx);
      const recordCallMatch = handlerBody.match(/perform pg_temp\.record_result\(\s*\n?\s*'[A-Z]',\s*\n?\s*format\([^;]*?\),\s*\n?\s*(true|false)\s*\n?\s*\);/);
      if (!recordCallMatch || recordCallMatch[1] !== "false") {
        offenders.push(section);
      }
    }
    expect(offenders, `Section(s) whose exception handler does not unconditionally record 'false': ${offenders.join(", ")}`).toEqual([]);
  });

  it("Section G's own INNER, expected-rejection exception block (G5b, sqlstate 'P0001') is still present and nested inside Section G's OUTER handler -- proves the new outer handler was added alongside it, not in place of it", () => {
    const sectionG = bySection.get("G")?.[0];
    expect(sectionG).toBeDefined();
    expect(sectionG!.body).toMatch(/when sqlstate 'P0001' then/);
    // The inner handler's own `when sqlstate 'P0001'` must appear BEFORE
    // the outer section-level `when others` -- i.e. nested inside the
    // section body, not appended after the section's own outer handler.
    const innerIdx = sectionG!.body.indexOf("when sqlstate 'P0001' then");
    const outerIdx = sectionG!.body.search(/exception\s*\n\s*when others then/);
    expect(innerIdx).toBeGreaterThan(-1);
    expect(outerIdx).toBeGreaterThan(-1);
    expect(innerIdx).toBeLessThan(outerIdx);
  });

  it("the final PASS/FAIL verdict query counts FAIL rows from test_results directly (not a hardcoded assumption) -- so a section-level exception's own FAIL row is guaranteed to be reflected in the final status", () => {
    expect(testSource).toMatch(/count\(\*\) filter \(where status = 'FAIL'\) as failed_tests/);
    // Since the 2026-08-26 self-contained-summary redesign, the outer
    // SELECT's CASE branches on the subquery's own computed
    // `failed_tests` column (`t.failed_tests = 0`) rather than repeating
    // the raw count(*) filter expression a second time -- still directly
    // derived from FAIL-row counting, just referenced once instead of
    // twice.
    expect(testSource).toMatch(/when t\.failed_tests = 0 then 'PHASE_8_ACCESS_EPOCH_RUNTIME_PASS'/);
  });

  it("the final verdict is a plain SELECT, never a RAISE EXCEPTION -- an exception there would abort the transaction before ROLLBACK, defeating the entire point of section-level isolation (the run must always reach and report its own final summary)", () => {
    const resultsSectionIdx = testSource.indexOf("-- Results (Runtime Requirement K)");
    expect(resultsSectionIdx).toBeGreaterThan(-1);
    // Strip whole-line comments first -- this section's own header
    // comment explains, in prose, exactly why RAISE EXCEPTION is NOT
    // used here ("Deliberately a plain SELECT, not a RAISE EXCEPTION"),
    // which would otherwise falsely trip a naive substring search.
    const tail = testSource
      .slice(resultsSectionIdx)
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(tail).not.toMatch(/raise exception/i);
  });
});

// =========================================================================
// PURPOSE (Task 4 -- cross-section dependency removal): Section C
// previously continued Section B's own scenario, reading B's
// project/link/session/grant fixture rows out of
// text2task_phase8_fixture_ids. Once each section runs inside its own
// exception-isolated do-block (see above), a failure in Section B would
// roll back B's own fixture rows before Section C could ever read them --
// silently starving Section C of real evidence instead of loudly failing
// it. Section C was made fully self-contained (its own
// project/link/session/grant setup, digest c1) specifically so a failure
// in one unrelated section can never suppress meaningful runtime evidence
// for another.
// =========================================================================

describe("Phase 8 Access Epoch runtime package - Section C is self-contained (Task 4): no cross-section fixture dependency on Section B", () => {
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );

  it("Section C no longer reads any section_b_* key out of text2task_phase8_fixture_ids", () => {
    expect(testSource).not.toMatch(/section_b_link|section_b_session|section_b_project/);
  });

  it("Section B no longer writes to text2task_phase8_fixture_ids at all (nothing reads it any more)", () => {
    const sectionBIdx = testSource.indexOf("-- Section B:");
    const sectionCIdx = testSource.indexOf("-- Section C:");
    expect(sectionBIdx).toBeGreaterThan(-1);
    expect(sectionCIdx).toBeGreaterThan(sectionBIdx);
    const sectionBBody = testSource.slice(sectionBIdx, sectionCIdx);
    expect(sectionBBody).not.toMatch(/text2task_phase8_fixture_ids/);
  });

  it("Section C performs its own complete setup -- its own project INSERT, its own create_share_link_draft call, its own activate_share_link call, and its own share_browser_sessions INSERT (digest c1) -- all inside Section C's own do-block, not borrowed from Section B", () => {
    const sectionCIdx = testSource.indexOf("-- Section C:");
    const sectionDIdx = testSource.indexOf("-- Section D:");
    expect(sectionCIdx).toBeGreaterThan(-1);
    expect(sectionDIdx).toBeGreaterThan(sectionCIdx);
    const sectionCBody = testSource.slice(sectionCIdx, sectionDIdx);

    expect(sectionCBody).toMatch(/insert into public\.projects/);
    expect(sectionCBody).toMatch(/create_share_link_draft\(v_project_id,/);
    expect(sectionCBody).toMatch(/perform public\.activate_share_link\(/);
    expect(sectionCBody).toMatch(/repeat\('c1', 32\)/);
  });
});

// =========================================================================
// PURPOSE (added 2026-08-26): a real disposable-Supabase run completed to
// its final summary (total_tests=113, failed_tests=7), but the SQL
// Editor's result-set viewer only retained/displayed the LAST result set
// -- the FAIL-only SELECT (and the full-results SELECT before it) were
// not reliably accessible afterward, and this file's own trailing
// ROLLBACK means test_results itself no longer exists to query once the
// script finishes. The final summary SELECT was redesigned to be
// SELF-CONTAINED: it now carries a `failed_test_details` jsonb array
// (seq/section/name/status/detail for every FAIL row, ordered by seq)
// inline in the same row as total_tests/passed_tests/failed_tests/status,
// so a failure can be fully diagnosed from the one result set a client
// might retain, without requiring the earlier SELECTs or the now-rolled-
// -back table. This suite guards the redesign's own required properties
// directly against the final query's own source text and structure.
// =========================================================================

describe("Phase 8 Access Epoch runtime package - final summary is self-contained (2026-08-26): failed_test_details column", () => {
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );

  /** Extracts the text of the FINAL top-level `select ... from ...;`
   * statement in the Results section -- i.e. the summary query, which
   * follows the full-results SELECT and the FAIL-only SELECT and
   * precedes the trailing ROLLBACK. */
  function extractFinalSummaryQuery(source: string): string {
    const resultsIdx = source.indexOf("-- Results (Runtime Requirement K)");
    expect(resultsIdx).toBeGreaterThan(-1);
    const rollbackIdx = source.indexOf("\nrollback;", resultsIdx);
    expect(rollbackIdx).toBeGreaterThan(resultsIdx);
    const resultsBlock = source.slice(resultsIdx, rollbackIdx);
    // The summary query is the LAST `select` in this block (after the
    // full-results SELECT and the FAIL-only SELECT).
    const lastSelectIdx = resultsBlock.lastIndexOf("\nselect\n");
    expect(lastSelectIdx).toBeGreaterThan(-1);
    return resultsBlock.slice(lastSelectIdx);
  }

  const summaryQuery = extractFinalSummaryQuery(testSource);

  it("the final summary SELECT declares a failed_test_details output column", () => {
    expect(summaryQuery).toMatch(/failed_test_details/);
  });

  it("failed_test_details is built via jsonb_agg/json_agg over test_results filtered to FAIL rows (aggregates every FAIL row, not a fixed subset)", () => {
    expect(summaryQuery).toMatch(/jsonb_agg\(/);
    expect(summaryQuery).toMatch(/where\s+r\.status = 'FAIL'/);
  });

  it("failed_test_details preserves seq, section, name, status, and detail for each aggregated row", () => {
    for (const field of ["seq", "section", "name", "status", "detail"]) {
      expect(summaryQuery, `failed_test_details is missing the '${field}' key`).toMatch(new RegExp(`'${field}',\\s*r\\.${field}`));
    }
  });

  it("the jsonb_agg is explicitly ordered by seq -- deterministic diagnostic output, not dependent on physical row order", () => {
    expect(summaryQuery).toMatch(/jsonb_agg\(\s*jsonb_build_object\([\s\S]*?\)\s*order by r\.seq\s*\)/);
  });

  it("failed_test_details defaults to '[]'::jsonb (never null) when there are zero FAIL rows, via coalesce", () => {
    expect(summaryQuery).toMatch(/coalesce\(f\.failed_test_details,\s*'\[\]'::jsonb\)/);
  });

  it("total_tests/passed_tests/failed_tests are still derived by counting test_results rows (status still derives from a genuine FAIL count, not a hardcoded value)", () => {
    expect(summaryQuery).toMatch(/count\(\*\) as total_tests/);
    expect(summaryQuery).toMatch(/count\(\*\) filter \(where status = 'PASS'\) as passed_tests/);
    expect(summaryQuery).toMatch(/count\(\*\) filter \(where status = 'FAIL'\) as failed_tests/);
    expect(summaryQuery).toMatch(/when t\.failed_tests = 0 then 'PHASE_8_ACCESS_EPOCH_RUNTIME_PASS'/);
    expect(summaryQuery).toMatch(/else 'PHASE_8_ACCESS_EPOCH_RUNTIME_FAIL'/);
  });

  it("the final summary query contains no RAISE EXCEPTION (it is still a plain SELECT, preserving the existing must-always-reach-ROLLBACK invariant)", () => {
    const noComments = summaryQuery
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(noComments).not.toMatch(/raise exception/i);
  });

  it("ROLLBACK still follows the final summary SELECT, with only comment lines in between, and always executes (never gated behind a condition)", () => {
    // The summary query's own closing statement is `) as f;` (the FAIL
    // subquery's own closing paren/alias). Only comment lines (and
    // blank lines) may appear between that and the literal `rollback;`
    // statement -- no other SQL statement, and no conditional wrapping.
    const summaryEndMarker = ") as f;";
    const summaryEndIdx = testSource.indexOf(summaryEndMarker);
    expect(summaryEndIdx).toBeGreaterThan(-1);
    const afterSummary = testSource.slice(summaryEndIdx + summaryEndMarker.length);
    const nonCommentLines = afterSummary
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("--"));
    expect(nonCommentLines[0]).toBe("rollback;");
  });

  it("the two pre-existing SELECTs (full results, FAIL-only) are still present above the summary -- this is an additive change, not a replacement", () => {
    expect(testSource).toMatch(/select seq, section, name, status, detail from test_results order by seq;/);
    expect(testSource).toMatch(/where status = 'FAIL'\s*\norder by seq;/);
  });
});

// =========================================================================
// PURPOSE (added 2026-08-26): a complete, isolated disposable-Supabase run
// reached the final summary and reported 7 genuine FAIL rows (out of 113).
// Each was individually classified from repository evidence -- 6 were
// harness-only defects (wrong expectations or wrong SQL), 0 were real
// implementation defects. This suite locks in each classification's own
// supporting evidence so a future edit cannot silently reintroduce any of
// them.
// =========================================================================

describe("Phase 8 Access Epoch runtime package - Section C configuration_version semantics (2026-08-26 classification fix)", () => {
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );
  const saveConfigSource = readNormalized(
    path.join(MIGRATIONS_DIR, "202608110001_client_share_publication_intent.sql")
  );

  it("ground truth, re-derived from save_share_configuration's own CURRENT body: only the settings sub-operation ever assigns v_new_configuration_version / writes configuration_version -- the task-mapping, resource-mapping, and publish-update sub-operation blocks each contain zero references to it", () => {
    const startMarker = "create or replace function public.save_share_configuration(";
    const startIdx = saveConfigSource.indexOf(startMarker);
    expect(startIdx).toBeGreaterThan(-1);
    const endMarker = "\n$$;";
    const endIdx = saveConfigSource.indexOf(endMarker, startIdx);
    expect(endIdx).toBeGreaterThan(startIdx);
    const functionBody = saveConfigSource.slice(startIdx, endIdx);

    // Anchored to each sub-operation's own unique header comment -- NOT
    // the bare `if p_tasks/p_resources/p_publish_update is not null then`
    // guard text, which also appears earlier in the function's shape/
    // type-validation section (a DIFFERENT block, before any lock is
    // even acquired) and would otherwise be matched first by indexOf,
    // silently slicing the wrong region entirely.
    const taskBlockStart = functionBody.indexOf("-- Task-mapping sub-operation.");
    const resourceBlockStart = functionBody.indexOf("-- Resource-mapping sub-operation.");
    const publishBlockStart = functionBody.indexOf("-- Update-publication sub-operation.");
    const finalBlockStart = functionBody.indexOf("Final committed state");
    expect(taskBlockStart).toBeGreaterThan(-1);
    expect(resourceBlockStart).toBeGreaterThan(taskBlockStart);
    expect(publishBlockStart).toBeGreaterThan(resourceBlockStart);
    expect(finalBlockStart).toBeGreaterThan(publishBlockStart);

    const taskBlock = functionBody.slice(taskBlockStart, resourceBlockStart);
    const resourceBlock = functionBody.slice(resourceBlockStart, publishBlockStart);
    const publishBlock = functionBody.slice(publishBlockStart, finalBlockStart);

    expect(taskBlock).not.toMatch(/configuration_version/);
    expect(resourceBlock).not.toMatch(/configuration_version/);
    expect(publishBlock).not.toMatch(/configuration_version/);
  });

  it("C1's fixture genuinely toggles comments_enabled away from its own active default (true, not false) -- a freshly-drafted+activated link's comments_enabled is false (column default, untouched by create_share_link_draft/activate_share_link), so saving false again would be an exact no-op under save_share_configuration's own IS DISTINCT FROM change-detection", () => {
    const sectionCIdx = testSource.indexOf("-- Section C:");
    const sectionDIdx = testSource.indexOf("-- Section D:");
    const sectionCBody = testSource.slice(sectionCIdx, sectionDIdx);
    const c1Match = sectionCBody.match(/-- C1: comments_enabled[\s\S]*?save_share_configuration\(v_link_id, jsonb_build_object\('commentsEnabled', (\w+)\)/);
    expect(c1Match).not.toBeNull();
    expect(c1Match![1]).toBe("true");
  });

  it("C7/C8/C9 assert configuration_version/access_epoch/pin_epoch all UNCHANGED (not changed) -- matching the real function's intentional behavior re-derived above, not the original wrong expectation", () => {
    const sectionCIdx = testSource.indexOf("-- Section C:");
    const sectionDIdx = testSource.indexOf("-- Section D:");
    const sectionCBody = testSource.slice(sectionCIdx, sectionDIdx);

    const c7Start = sectionCBody.indexOf("-- C7: task mapping");
    const c8Start = sectionCBody.indexOf("-- C8: resource mapping");
    const c9Start = sectionCBody.indexOf("-- C9: publish/update");
    expect(c7Start).toBeGreaterThan(-1);
    expect(c8Start).toBeGreaterThan(c7Start);
    expect(c9Start).toBeGreaterThan(c8Start);

    const c7Block = sectionCBody.slice(c7Start, c8Start);
    const c8Block = sectionCBody.slice(c8Start, c9Start);
    const c9Block = sectionCBody.slice(c9Start);

    for (const [label, block] of [
      ["C7", c7Block],
      ["C8", c8Block],
      ["C9", c9Block],
    ] as const) {
      expect(block, `${label}'s own block is missing the "all UNCHANGED" assertion label`).toMatch(
        /configuration_version\/access_epoch\/pin_epoch all UNCHANGED/
      );
      expect(block, `${label}'s own block still compares configuration_version with > (demands a change) instead of = (unchanged)`).toMatch(
        /v_after\.configuration_version = v_before\.configuration_version/
      );
      expect(block, `${label}'s own block must not compare configuration_version with > anywhere (the old, wrong expectation)`).not.toMatch(
        /v_after\.configuration_version > v_before\.configuration_version/
      );
    }
  });

  it("C7/C8/C9 each also assert the underlying mapping/update was genuinely applied, not just that epochs/version were untouched", () => {
    const sectionCIdx = testSource.indexOf("-- Section C:");
    const sectionDIdx = testSource.indexOf("-- Section D:");
    const sectionCBody = testSource.slice(sectionCIdx, sectionDIdx);
    expect(sectionCBody).toMatch(/exists \(select 1 from public\.share_link_tasks where share_link_id = v_link_id and subtask_id = v_task_id\)/);
    expect(sectionCBody).toMatch(/exists \(select 1 from public\.share_link_resources where share_link_id = v_link_id and resource_id = v_resource_id\)/);
    expect(sectionCBody).toMatch(/exists \(select 1 from public\.share_link_updates where share_link_id = v_link_id and is_current and body = 'Phase 8 runtime publish-update body\.'\)/);
  });
});

describe("Phase 8 Access Epoch runtime package - Section H information_schema domain-type array comparisons (2026-08-26 classification fix)", () => {
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );

  it("every array_agg(...) sourced from information_schema.role_table_grants casts its aggregated column(s) to ::text before aggregation -- information_schema.role_table_grants.privilege_type/table_name are DOMAIN types (character_data/sql_identifier), and array_agg over a bare domain column preserves that domain in the resulting array, which has no automatic operator against a plain text[] literal (the exact runtime failure: \"operator does not exist: information_schema.character_data[] = text[]\")", () => {
    const arrayAggCalls = [...testSource.matchAll(/array_agg\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g)]
      .map((m) => ({ full: m[0], index: m.index ?? -1 }))
      .filter((call) => {
        // Only the calls whose surrounding query reads from
        // information_schema.role_table_grants are in scope here.
        const windowStart = Math.max(0, call.index - 400);
        const window = testSource.slice(windowStart, call.index + call.full.length + 200);
        return window.includes("information_schema.role_table_grants");
      });
    expect(arrayAggCalls.length, "expected to find the H6 and H9 array_agg(...) calls sourced from information_schema.role_table_grants -- a parser finding zero would silently pass everything below").toBe(2);
    for (const call of arrayAggCalls) {
      expect(call.full, `array_agg call "${call.full}" does not cast its column(s) to ::text before aggregating -- unsafe against information_schema's own domain-typed columns`).toMatch(/::text/);
    }
  });

  it("H6's comparison array_agg expression is exactly privilege_type::text, ordered by privilege_type::text", () => {
    expect(testSource).toMatch(/array_agg\(privilege_type::text order by privilege_type::text\)/);
  });

  it("H9's comparison array_agg expression casts both table_name and privilege_type to ::text before concatenation", () => {
    expect(testSource).toMatch(/array_agg\(\(table_name::text \|\| '\.' \|\| privilege_type::text\)/);
  });
});

describe("Phase 8 Access Epoch runtime package - public_id exact-24-character rule (2026-08-26 classification fix)", () => {
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );
  const lifecycleSource = readNormalized(
    path.join(MIGRATIONS_DIR, ACTIVATE_SHARE_LINK_MIGRATION)
  );

  it("ground truth, re-derived from create_share_link_draft's own current body: public_id must match EXACTLY ^[A-Za-z0-9_-]{24}$ -- STRICTER than the table's own project_share_links_public_id_format_check (16-64 chars). This is the rule the earlier, table-constraint-only static check (below) did not model, which is why a 23-character fixture passed static review but failed at runtime with INVALID_PUBLIC_ID.", () => {
    expect(lifecycleSource).toMatch(/p_public_id !~ '\^\[A-Za-z0-9_-\]\{24\}\$'/);
  });

  it("every literal public_id passed to create_share_link_draft in file 03 is EXACTLY 24 characters and matches ^[A-Za-z0-9_-]{24}$ -- the real, stricter RPC-enforced rule, not just the table's 16-64 CHECK constraint", () => {
    const draftCallRegex = /create_share_link_draft\(v_project_id,\s*'([A-Za-z0-9_-]+)'\)/g;
    const ids = [...testSource.matchAll(draftCallRegex)].map((m) => m[1]);
    expect(ids.length, "expected to find every create_share_link_draft call's own public_id literal").toBe(8);
    for (const id of ids) {
      expect(id, `public_id "${id}" (length ${id.length}) fails create_share_link_draft's own exact-24-character rule`).toMatch(/^[A-Za-z0-9_-]{24}$/);
    }
  });

  it("Section I's public_id specifically is no longer the 23-character typo that produced INVALID_PUBLIC_ID", () => {
    // Checked against the actual create_share_link_draft call site only
    // -- this file's own explanatory comment for this fix (correctly)
    // quotes the OLD, 23-character value verbatim as part of documenting
    // what was wrong, which would otherwise falsely trip a raw
    // testSource.toContain() check.
    const draftCallRegex = /create_share_link_draft\(v_project_id,\s*'([A-Za-z0-9_-]+)'\)/g;
    const ids = [...testSource.matchAll(draftCallRegex)].map((m) => m[1]);
    expect(ids).not.toContain("phase8secIConcurLink001");
    expect(ids).toContain("phase8secIConcurLink0001");
  });
});

describe("Phase 8 Access Epoch runtime package - J1 comment-vs-executable-logic fix (2026-08-26 classification fix)", () => {
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );
  const accessEpochSource = readNormalized(path.join(MIGRATIONS_DIR, "202608250001_client_share_access_epoch.sql"));

  it("ground truth: 202608250001's replacement enforce_share_session_grant_integrity body contains no executable `raise exception ... message = 'SHARE_GRANT_EXPIRY_EXCEEDS_LINK'` branch -- only an explanatory comment naming the removed error code", () => {
    const startMarker = "create or replace function public.enforce_share_session_grant_integrity()";
    const startIdx = accessEpochSource.indexOf(startMarker);
    expect(startIdx).toBeGreaterThan(-1);
    const endIdx = accessEpochSource.indexOf("\n$$;", startIdx);
    expect(endIdx).toBeGreaterThan(startIdx);
    const functionBody = accessEpochSource.slice(startIdx, endIdx);

    // The bare name still appears (in the explanatory comment) --
    expect(functionBody).toMatch(/SHARE_GRANT_EXPIRY_EXCEEDS_LINK/);
    // -- but never as part of an executable raise statement.
    expect(functionBody).not.toMatch(/message = 'SHARE_GRANT_EXPIRY_EXCEEDS_LINK'/);
  });

  it("J1's assertion in file 03 checks for the SPECIFIC executable pattern (message = 'SHARE_GRANT_EXPIRY_EXCEEDS_LINK'), not a bare substring that would also match the function's own explanatory comment", () => {
    expect(testSource).toMatch(/v_integrity_def not ilike '%message = ''SHARE_GRANT_EXPIRY_EXCEEDS_LINK''%'/);
    // The old, over-broad bare-substring form must not remain.
    expect(testSource).not.toMatch(/v_integrity_def not ilike '%SHARE_GRANT_EXPIRY_EXCEEDS_LINK%'/);
  });
});

// =========================================================================
// PURPOSE (added 2026-08-26, final scripted run 138/139 -- sole failure
// H9): a direct read-only PostgreSQL catalog query against the real
// disposable run confirmed authenticated's ACTUAL effective grant on
// projects/tasks/task_resources was exactly {SELECT,INSERT,UPDATE,DELETE}
// / {SELECT,INSERT,UPDATE} respectively -- the intended, correct surface.
// H9's own expected array had only ever included the MUTATION privileges
// 01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql itself adds, omitting
// the SELECT privilege 01_PREPARE_RUNTIME_FIXTURES.sql separately,
// intentionally already grants on these same tables -- so H9 was
// comparing the COMPLETE effective privilege set against an INCOMPLETE
// expected subset, and flagged the already-intended SELECT grant as
// unexpected "broader" access. This suite re-derives the true expected
// surface directly from BOTH source files (01's SELECT grant + 01B's
// mutation grants) and cross-checks it against H9's own expected array in
// file 03, so a future edit cannot silently narrow H9 back down to
// mutation-only and reintroduce this exact false positive.
// =========================================================================

describe("Phase 8 Access Epoch runtime package - H9 completeness (2026-08-26, confirmed via direct read-only catalog query)", () => {
  const testSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql")
  );
  const fixturesSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", "01_PREPARE_RUNTIME_FIXTURES.sql")
  );
  const grantSource = readNormalized(
    path.join(REPO_ROOT, "docs", "client-share-phase8-access-epoch-runtime", GRANT_FILE)
  );

  it("ground truth: 01_PREPARE_RUNTIME_FIXTURES.sql grants authenticated SELECT on all four base-table stand-ins (projects, tasks, clients, task_resources)", () => {
    expect(fixturesSource).toMatch(
      /grant select on table\s*\n\s*public\.projects, public\.tasks, public\.clients, public\.task_resources\s*\n\s*to authenticated;/
    );
  });

  it("ground truth: 01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql's own mutation grant is exactly {projects,tasks}.{INSERT,UPDATE,DELETE} + task_resources.{INSERT,UPDATE} (re-confirms the pre-existing H9 ground-truth this file's own earlier suite already established, as the other half of H9's now-complete expected set)", () => {
    expect(grantSource).toMatch(/grant insert, update, delete on table public\.projects to authenticated;/);
    expect(grantSource).toMatch(/grant insert, update, delete on table public\.tasks to authenticated;/);
    expect(grantSource).toMatch(/grant insert, update on table public\.task_resources to authenticated;/);
  });

  it("H9's own expected array in file 03 is the UNION of 01's SELECT grant and 01B's mutation grants for projects and tasks -- {DELETE,INSERT,SELECT,UPDATE} each -- not the mutation-only subset that produced the false positive", () => {
    const h9Match = testSource.match(/perform pg_temp\.record_result\('H', 'H9:[\s\S]*?= array\[([\s\S]*?)\]\);/);
    expect(h9Match, "expected to find H9's own record_result call with its expected array").not.toBeNull();
    const expectedArrayText = h9Match![1];

    for (const table of ["projects", "tasks"]) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        expect(expectedArrayText, `H9's expected array is missing ${table}.${privilege}`).toContain(`${table}.${privilege}`);
      }
    }
  });

  it("H9's own expected array includes task_resources.SELECT alongside its evidenced INSERT/UPDATE (no DELETE, matching the withheld-by-design delete policy) -- not the mutation-only subset", () => {
    const h9Match = testSource.match(/perform pg_temp\.record_result\('H', 'H9:[\s\S]*?= array\[([\s\S]*?)\]\);/);
    expect(h9Match).not.toBeNull();
    const expectedArrayText = h9Match![1];

    for (const privilege of ["SELECT", "INSERT", "UPDATE"]) {
      expect(expectedArrayText, `H9's expected array is missing task_resources.${privilege}`).toContain(`task_resources.${privilege}`);
    }
    expect(expectedArrayText, "H9's expected array must NOT include task_resources.DELETE -- no delete policy/grant was ever established for this table").not.toContain("task_resources.DELETE");
  });

  it("H9's expected array has exactly 11 entries -- 4 each for projects/tasks + 3 for task_resources -- not more, not fewer (a parser finding the wrong count would silently pass the per-privilege checks above via partial substring matches)", () => {
    const h9Match = testSource.match(/perform pg_temp\.record_result\('H', 'H9:[\s\S]*?= array\[([\s\S]*?)\]\);/);
    expect(h9Match).not.toBeNull();
    const entries = h9Match![1].match(/'[a-z_]+\.[A-Z]+'/g) ?? [];
    expect(entries.length).toBe(11);
  });

  it("H9's own label text no longer describes the mutation-only shape ({INSERT,UPDATE,DELETE} without SELECT) -- proves the label was updated alongside the expected array, not left stale", () => {
    expect(testSource).not.toMatch(/H9: authenticated''s grant on the base-table stand-ins is exactly \{projects,tasks\}\.\{INSERT,UPDATE,DELETE\}/);
    expect(testSource).toMatch(/H9: authenticated''s COMPLETE effective grant on the base-table stand-ins/);
  });

  it("the separate security assertions this fix must not weaken are still present and unchanged in shape: H1 (RLS enabled), H2 (anon has no privilege of any kind; authenticated has ONLY SELECT on the Client-Share-owned tables), H10 (anon/clients untouched)", () => {
    expect(testSource).toContain("H1: RLS remains enabled on project_share_links");
    expect(testSource).toContain("H1: RLS remains enabled on share_session_grants");
    expect(testSource).toContain("H2: anon has NO privilege of any kind on project_share_links");
    expect(testSource).toContain("H2: authenticated has ONLY SELECT on project_share_links");
    expect(testSource).toContain("H2: authenticated has NO privilege of any kind on share_session_grants");
    expect(testSource).toMatch(/H10: anon and public\.clients remain untouched by 01B/);
  });

  it("owner-scoped RLS policies for the mutation privileges remain independently verified by 01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql's own final-verification block (pg_policies check) -- not duplicated in file 03's Section H, but not removed either", () => {
    expect(grantSource).toMatch(/from pg_policies p/);
    expect(grantSource).toMatch(/'projects\.INSERT-policy', 'projects', 'Fixture owner insert'/);
    expect(grantSource).toMatch(/'tasks\.DELETE-policy', 'tasks', 'Fixture owner delete'/);
    expect(grantSource).toMatch(/'task_resources\.UPDATE-policy', 'task_resources', 'Fixture owner update'/);
  });
});
