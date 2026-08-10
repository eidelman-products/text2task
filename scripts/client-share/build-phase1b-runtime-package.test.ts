import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, a running Supabase project, or Supabase CLI/Docker,
// matching this repository's established migration-testing convention
// exactly (see supabase/migrations/202608060003_client_share_configuration_save.test.ts).

const REPO_ROOT = path.join(__dirname, "..", "..");
const PACKAGE_DIR = path.join(REPO_ROOT, "docs", "client-share-phase1b-runtime");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const GENERATOR_PATH = path.join(__dirname, "build-phase1b-runtime-package.ps1");
const REPORT_PATH = path.join(
  REPO_ROOT,
  "docs",
  "TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_RUNTIME_VERIFICATION_REPORT.md"
);

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function sha256(text: string): string {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

// Extracts every call to `callPrefix` (e.g. "pg_temp.record_result(") from
// `source`, returning the 1-indexed line number and the raw text of its
// balanced-paren argument list. Used to audit executable SQL call sites
// rather than relying on regex-over-a-single-line, which cannot safely span
// the multi-line calls this file uses throughout.
function extractBalancedCalls(source: string, callPrefix: string): Array<{ line: number; argsText: string }> {
  const calls: Array<{ line: number; argsText: string }> = [];
  let searchFrom = 0;
  for (;;) {
    const idx = source.indexOf(callPrefix, searchFrom);
    if (idx === -1) break;
    // Skip the function's own `create or replace function pg_temp.foo(...)`
    // definition site -- its declared parameter list (e.g. "p_id_text text")
    // is not a call and must not be mistaken for one.
    if (/function\s*$/.test(source.slice(Math.max(0, idx - 12), idx))) {
      searchFrom = idx + callPrefix.length;
      continue;
    }
    const start = idx + callPrefix.length;
    let depth = 1;
    let i = start;
    let inStr = false;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === "'") inStr = !inStr;
      else if (!inStr && c === "(") depth++;
      else if (!inStr && c === ")") depth--;
      i++;
    }
    calls.push({
      line: source.slice(0, idx).split("\n").length,
      argsText: source.slice(start, i - 1),
    });
    searchFrom = i;
  }
  return calls;
}

// Splits a balanced-paren argument list on top-level commas (commas inside
// nested parens/brackets/string literals do not split).
function splitTopLevelArgs(argsText: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inStr = false;
  let cur = "";
  for (const c of argsText) {
    if (c === "'") inStr = !inStr;
    if (!inStr && (c === "(" || c === "[")) depth++;
    if (!inStr && (c === ")" || c === "]")) depth--;
    if (!inStr && depth === 0 && c === ",") {
      args.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur.trim().length) args.push(cur.trim());
  return args;
}

// True when `expr` is guaranteed to be a jsonb-typed PostgreSQL expression
// (a bare `->` extraction, jsonb_build_array/object, or pg_temp.get_json())
// UNLESS its outermost/final operation is a `->>` text extraction or it
// already carries an explicit ::text cast -- both of which make the overall
// expression text, not jsonb.
function isUncastJsonbExpression(expr: string): boolean {
  if (/^null$/i.test(expr)) return false;
  if (/::text\s*$/.test(expr)) return false;
  if (/->>\s*'[^']*'\s*$/.test(expr)) return false;
  // format(...)/array_to_string(...) always return text regardless of what
  // jsonb-shaped values are passed as their own arguments.
  if (/^format\(/.test(expr)) return false;
  if (/^array_to_string\(/.test(expr)) return false;
  return /->(?!>)/.test(expr) || /jsonb_build_array\(/.test(expr) || /jsonb_build_object\(/.test(expr) || /pg_temp\.get_json\(/.test(expr) || /::jsonb\b/.test(expr);
}

const EXPECTED_MIGRATION_ORDER = [
  "202608030003_client_share_owner_foundation.sql",
  "202608030004_client_share_session_foundation.sql",
  "202608030005_client_share_integrity_and_security.sql",
  "202608050001_client_share_owner_reads.sql",
  "202608060001_client_share_lifecycle_operations.sql",
  "202608060002_client_share_access_operations.sql",
  "202608060003_client_share_configuration_save.sql",
];

const EXPECTED_PACKAGE_FILES = [
  path.join(REPO_ROOT, "docs", "TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_RUNTIME_VERIFICATION_REPORT.md"),
  path.join(PACKAGE_DIR, "00_READ_ME_FIRST.md"),
  path.join(PACKAGE_DIR, "01_CREATE_TEMP_TEST_FIXTURE.sql"),
  path.join(PACKAGE_DIR, "02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql"),
  path.join(PACKAGE_DIR, "03_RUN_PHASE1B_RUNTIME_TESTS.sql"),
  path.join(PACKAGE_DIR, "04_CAPTURE_RESULTS.md"),
  path.join(PACKAGE_DIR, "05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md"),
  path.join(PACKAGE_DIR, "MANIFEST.md"),
  GENERATOR_PATH,
  path.join(__dirname, "build-phase1b-runtime-package.test.ts"),
];

const generatorSource = readNormalized(GENERATOR_PATH);
const readmeSource = readNormalized(path.join(PACKAGE_DIR, "00_READ_ME_FIRST.md"));
const fixtureSource = readNormalized(path.join(PACKAGE_DIR, "01_CREATE_TEMP_TEST_FIXTURE.sql"));
const bundleSource = readNormalized(
  path.join(PACKAGE_DIR, "02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql")
);
const runtimeTestSource = readNormalized(
  path.join(PACKAGE_DIR, "03_RUN_PHASE1B_RUNTIME_TESTS.sql")
);
const notAuthorizedSource = readNormalized(
  path.join(PACKAGE_DIR, "05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md")
);
const manifestSource = readNormalized(path.join(PACKAGE_DIR, "MANIFEST.md"));
const reportSource = readNormalized(REPORT_PATH);

const FORBIDDEN_COMMAND_PATTERNS = [
  /supabase\s+db\s+push/i,
  /supabase\s+link/i,
  /supabase\s+start/i,
  /\bdocker\b/i,
  /npm run build/i,
];

describe("Phase 1B runtime verification package -- exact file set", () => {
  it("contains exactly the ten approved package files, each existing on disk", () => {
    expect(EXPECTED_PACKAGE_FILES).toHaveLength(10);
    for (const filePath of EXPECTED_PACKAGE_FILES) {
      expect(existsSync(filePath)).toBe(true);
    }
  });

  it("does not modify the Phase 1A SQL Editor package or its generator", () => {
    const phase1aDir = path.join(REPO_ROOT, "docs", "client-share-phase1a-sql-editor");
    const phase1aFiles = [
      "00_READ_ME_FIRST.md",
      "01_CREATE_TEMP_TEST_FIXTURE.sql",
      "02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql",
      "03_RUN_PHASE1A_RUNTIME_TESTS.sql",
      "04_CAPTURE_RESULTS.md",
      "05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md",
      "MANIFEST.md",
    ];
    for (const name of phase1aFiles) {
      expect(existsSync(path.join(phase1aDir, name))).toBe(true);
    }
    expect(
      existsSync(path.join(REPO_ROOT, "scripts", "client-share", "build-phase1a-sql-editor-package.ps1"))
    ).toBe(true);
    // This package's own generator may mention the Phase 1A package only
    // to document that it does NOT touch it (a plain-English cross
    // reference in its header comment) -- it must never WRITE to that
    // directory or invoke that other generator.
    expect(generatorSource).toMatch(/does not read,\s*write or modify/);
    expect(generatorSource).not.toMatch(/Join-Path[^\n]*phase1a/i);
    expect(generatorSource).not.toContain("build-phase1a-sql-editor-package.ps1'");
    expect(generatorSource).not.toMatch(/\.\s*\\\s*build-phase1a-sql-editor-package\.ps1/);
  });
});

describe("generator script -- migration order and source references", () => {
  it("references the exact seven authoritative migration files, in order, nothing else", () => {
    const arrayMatch = generatorSource.match(/\$sourceFiles = @\(([\s\S]*?)\)/);
    expect(arrayMatch).not.toBeNull();
    const listed = [...(arrayMatch?.[1].matchAll(/'([^']+\.sql)'/g) ?? [])].map((m) => m[1]);
    expect(listed).toEqual(EXPECTED_MIGRATION_ORDER);
  });

  it("reads migrations from supabase/migrations via a relative path derived from the script's own location, never a hard-coded absolute or Production path", () => {
    expect(generatorSource).toMatch(/\$migrationsDir\s*=\s*Join-Path\s+\$repoRoot\s+'supabase\\migrations'/);
    expect(generatorSource).toContain("Get-Content -LiteralPath $Path -Raw -Encoding UTF8");
  });

  it("every listed migration file actually exists in supabase/migrations", () => {
    for (const name of EXPECTED_MIGRATION_ORDER) {
      expect(existsSync(path.join(MIGRATIONS_DIR, name))).toBe(true);
    }
  });

  it("uses SHA-256, not any weaker hash algorithm", () => {
    expect(generatorSource).toContain("[System.Security.Cryptography.SHA256]::Create()");
    expect(generatorSource).not.toMatch(/\bMD5\b/);
    expect(generatorSource).not.toMatch(/\bSHA1\b/i);
  });

  it("normalizes line endings to LF before hashing/writing, so output is deterministic across checkouts", () => {
    expect(generatorSource).toContain('-replace "`r`n", "`n" -replace "`r", "`n"');
  });

  it("mechanically verifies exact order and single-appearance of every source migration in the generated bundle", () => {
    expect(generatorSource).toContain("occurrences -ne 1");
    expect(generatorSource).toContain("not in the required order");
  });

  it("refuses to write anywhere outside the allowed package directory, and only to the two named output files", () => {
    expect(generatorSource).toContain("Refusing to run: computed output path");
    expect(generatorSource).toContain("02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql");
    expect(generatorSource).toContain("Refusing to run: the manifest generator target may only ever be");
  });

  it("never runs SQL, connects to Supabase, invokes Supabase CLI, or Docker", () => {
    for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
      expect(generatorSource).not.toMatch(pattern);
    }
    expect(generatorSource).not.toMatch(/Invoke-Sqlcmd/i);
    expect(generatorSource).not.toContain("$env:SUPABASE");
  });

  it("prints generated paths, source/output hashes and a final PACKAGE_VERIFICATION_STATUS line", () => {
    expect(generatorSource).toContain("Wrote generated bundle to:");
    expect(generatorSource).toContain("PACKAGE_VERIFICATION_STATUS: PASS");
  });

  it("never calls Get-Date and embeds no wall-clock timestamp logic (only mentions the cmdlet name in prose/comments describing that it is deliberately never invoked)", () => {
    expect(generatorSource).toContain("Get-Date");
    // Real invocation shapes this generator must never contain: a bare
    // cmdlet call (optionally with a -Flag or parens), assigned to a
    // variable, or piped into/from. Every actual mention in this script is
    // prose/comment text (e.g. "no Get-Date value is embedded"), where
    // Get-Date is followed by a backtick, comma, "or", etc. -- never by
    // "-", "(" or a pipe.
    expect(generatorSource).not.toMatch(/\bGet-Date\b\s*[-(]/);
    expect(generatorSource).not.toMatch(/=\s*Get-Date\b/);
    expect(generatorSource).not.toMatch(/Get-Date\s*\|/);
    expect(generatorSource).not.toMatch(/\|\s*Get-Date\b/);
  });
});

describe("generator script -- two generated outputs, staged and validated atomically", () => {
  it("has exactly two explicit generated output targets: the apply bundle and MANIFEST.md", () => {
    expect(generatorSource).toMatch(/\$bundleFile\s*=\s*Join-Path \$packageDir \$bundleFileName/);
    expect(generatorSource).toMatch(/\$manifestFile\s*=\s*Join-Path \$packageDir \$manifestFileName/);
    expect(generatorSource).toContain("$generatedOutputs = @($bundleFile, $manifestFile)");
  });

  it("builds both outputs in a temporary staging subdirectory before touching the real files", () => {
    expect(generatorSource).toContain("$stagingDir = Join-Path $packageDir '.generator-staging'");
    expect(generatorSource).toContain("$stagedBundle = Join-Path $stagingDir $bundleFileName");
    expect(generatorSource).toContain("$stagedManifest = Join-Path $stagingDir $manifestFileName");
    expect(generatorSource).toMatch(/Write-StagedFile -StagingPath \$stagedBundle/);
    expect(generatorSource).toMatch(/Write-StagedFile -StagingPath \$stagedManifest/);
  });

  it("validates both staged outputs (hash-verified) before replacing either real file", () => {
    expect(generatorSource).toContain("stagedBundleHash -ne $bundleHash");
    expect(generatorSource).toContain("stagedManifestHash -ne $inMemoryManifestHash");
    const stagedCountIndex = generatorSource.indexOf("$stagedCount -ne 2");
    const firstMoveIndex = generatorSource.indexOf("Move-Item -LiteralPath $stagedBundle");
    expect(stagedCountIndex).toBeGreaterThan(-1);
    expect(firstMoveIndex).toBeGreaterThan(stagedCountIndex);
  });

  it("moves both staged outputs into place only after validation, and cleans up the staging directory in a finally block", () => {
    expect(generatorSource).toMatch(/Move-Item -LiteralPath \$stagedBundle -Destination \$bundleFile -Force/);
    expect(generatorSource).toMatch(/Move-Item -LiteralPath \$stagedManifest -Destination \$manifestFile -Force/);
    expect(generatorSource).toContain("} finally {");
  });

  it("counts and validates exactly two generated outputs exist at their real locations after replacement", () => {
    expect(generatorSource).toContain("$actualGeneratedCount -ne 2");
    expect(generatorSource).toContain("exactly 2 generated output files to exist after replacement");
  });

  it("prints the final MANIFEST.md hash to the console rather than embedding a self-referential hash", () => {
    expect(generatorSource).toContain("MANIFEST_SHA256=$finalManifestHash");
  });

  it("does not claim the two-file replacement itself is a single filesystem-atomic transaction (only that both outputs are validated together BEFORE either real file is touched)", () => {
    expect(generatorSource).toContain("not a single");
    expect(generatorSource).toMatch(/filesystem-atomic multi-file transaction/);
    expect(generatorSource).toMatch(/no such mechanism is used\s*\n\s*or required/);
    expect(generatorSource).toContain("extraordinary I/O failure");
    expect(manifestSource).toContain("not a single");
    expect(manifestSource).toMatch(/filesystem-atomic multi-file transaction/);
    expect(manifestSource).toContain("extraordinary I/O failure");
  });
});

describe("generator script -- hashes every migration and every non-MANIFEST package file", () => {
  it("hashes all seven authoritative migrations", () => {
    for (const name of EXPECTED_MIGRATION_ORDER) {
      expect(generatorSource).toContain(name);
    }
    expect(generatorSource).toContain("$sourceHashes[$name] = Get-Sha256Hex -Text $content");
  });

  it("embeds each source migration's repository-relative path and SHA-256 as a generated comment immediately before its BEGIN marker in file 02", () => {
    expect(generatorSource).toContain('$sourceComment = "-- Source: $($sourceRelativePaths[$name])`n-- SHA-256 (normalized LF UTF-8): $($sourceHashes[$name])`n"');
    expect(generatorSource).toContain('$bundleParts.Add("$sourceComment-- ===== BEGIN $name (verbatim, unmodified) =====`n")');
  });

  it("hashes all nine non-MANIFEST package files (the apply bundle plus the eight other hand-authored files)", () => {
    const expectedOtherFiles = [
      "TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_RUNTIME_VERIFICATION_REPORT.md",
      "00_READ_ME_FIRST.md",
      "01_CREATE_TEMP_TEST_FIXTURE.sql",
      "03_RUN_PHASE1B_RUNTIME_TESTS.sql",
      "04_CAPTURE_RESULTS.md",
      "05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md",
      "build-phase1b-runtime-package.ps1",
      "build-phase1b-runtime-package.test.ts",
    ];
    for (const name of expectedOtherFiles) {
      expect(generatorSource).toContain(`'${name}'`);
    }
    // Plus the apply bundle itself (hashed separately as $bundleHash) --
    // 8 other files + 1 bundle = 9 non-MANIFEST package files hashed.
    expect(generatorSource).toContain("$bundleHash = Get-Sha256Hex -Text $bundle");
  });
});

describe("generated apply bundle (file 02) -- fidelity, order, and safety", () => {
  it("contains the exact seven BEGIN/END boundary markers, each exactly once, in the required order", () => {
    const positions = EXPECTED_MIGRATION_ORDER.map((name) => {
      const marker = `-- ===== BEGIN ${name} (verbatim, unmodified) =====`;
      const occurrences = bundleSource.split(marker).length - 1;
      expect(occurrences).toBe(1);
      return bundleSource.indexOf(marker);
    });
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("each migration's BEGIN marker is immediately preceded by a generated source-path + SHA-256 comment", () => {
    for (const name of EXPECTED_MIGRATION_ORDER) {
      const beginMarker = `-- ===== BEGIN ${name} (verbatim, unmodified) =====`;
      const beginIndex = bundleSource.indexOf(beginMarker);
      expect(beginIndex).toBeGreaterThan(-1);
      const preceding = bundleSource.slice(Math.max(0, beginIndex - 200), beginIndex);
      expect(preceding).toContain(`-- Source: supabase/migrations/${name}`);
      expect(preceding).toMatch(/-- SHA-256 \(normalized LF UTF-8\): [0-9a-f]{64}\n$/);
    }
  });

  it("the embedded source-hash comment for every migration exactly matches a freshly-computed SHA-256 of its actual current source content (LF-normalized)", () => {
    for (const name of EXPECTED_MIGRATION_ORDER) {
      const sourceContent = readNormalized(path.join(MIGRATIONS_DIR, name));
      const expectedHash = sha256(sourceContent);
      expect(bundleSource).toContain(`-- SHA-256 (normalized LF UTF-8): ${expectedHash}`);
    }
  });

  it("bundle is generated, not a manually re-typed duplicate -- each migration's body appears byte-identical to its source file", () => {
    for (const name of EXPECTED_MIGRATION_ORDER) {
      const sourceContent = readNormalized(path.join(MIGRATIONS_DIR, name));
      const beginMarker = `-- ===== BEGIN ${name} (verbatim, unmodified) =====`;
      const endMarker = `-- ===== END ${name} =====`;
      const startIndex = bundleSource.indexOf(beginMarker) + beginMarker.length;
      const endIndex = bundleSource.indexOf(endMarker, startIndex);
      expect(startIndex).toBeGreaterThan(-1);
      expect(endIndex).toBeGreaterThan(startIndex);
      const embedded = bundleSource.slice(startIndex, endIndex).replace(/^\n+/, "").replace(/\n+$/, "");
      expect(embedded).toBe(sourceContent.trim());
    }
  });

  it("has a safety preamble requiring the Phase 1B runtime sentinel and refusing to run if project_share_links already exists", () => {
    expect(bundleSource).toContain("text2task_client_share_phase1b_runtime_sentinel");
    expect(bundleSource).toContain("DISPOSABLE_PHASE_1B_RUNTIME_TEST_PROJECT");
    expect(bundleSource).toContain("public.project_share_links already exists");
  });

  it("contains no Production project URL, project reference, credential, or environment value", () => {
    expect(bundleSource).not.toMatch(/https?:\/\//i);
    expect(bundleSource).not.toMatch(/supabase\.co/i);
    expect(bundleSource).not.toMatch(/service_role_key/i);
    expect(bundleSource).not.toMatch(/anon_key/i);
    expect(bundleSource).not.toMatch(/\bpassword\s*=\s*['"][^'"]+['"]/i);
  });

  it("ends with a structural final-verification query covering every table, function and trigger, not just the three Phase 1A ones", () => {
    expect(bundleSource).toContain("project_share_secret_material");
    expect(bundleSource).toContain("save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)");
    expect(bundleSource).toContain("reveal_share_link_secret(uuid)");
  });
});

describe("fixture file (01) -- disposable-project safety and Phase 1B dependencies", () => {
  it("has the same fail-closed safety pattern as the Phase 1A fixture (refuses to run against a non-empty project)", () => {
    expect(fixtureSource).toContain("REFUSING TO RUN");
    expect(fixtureSource).toContain("text2task_client_share_phase1b_runtime_sentinel");
  });

  it("adds is_archived to the projects stand-in table, which Phase 1B's RPCs require and the Phase 1A fixture predates", () => {
    expect(fixtureSource).toMatch(/create table public\.projects \(/);
    expect(fixtureSource).toContain("is_archived boolean not null default false");
  });

  it("creates exactly two deterministic auth.users identities, matching file 03's expectations", () => {
    expect(fixtureSource).toContain("11111111-1111-4111-8111-111111111111");
    expect(fixtureSource).toContain("22222222-2222-4222-8222-222222222222");
  });

  it("uses no real email domain and no real credential", () => {
    expect(fixtureSource).toContain("@example.invalid");
    expect(fixtureSource).not.toMatch(/@(gmail|outlook|yahoo)\.com/i);
  });
});

describe("runtime test file (03) -- required section coverage A through R", () => {
  const requiredSections = [
    "SECTION A -- Object and security presence",
    "SECTION B -- Owner read RPCs",
    "SECTION C -- Draft creation and public-id collision",
    "SECTION D -- Activation and one-active-link rule",
    "SECTION E -- Disable and re-enable",
    "SECTION F -- PIN set/clear",
    "SECTION G -- Expiry set/clear",
    "SECTION H -- Secret rotation",
    "SECTION I -- Reveal RPC",
    "SECTION J -- Revoke",
    "SECTION K -- Configuration save: settings",
    "SECTION L -- Configuration save: tasks",
    "SECTION M -- Configuration save: resources",
    "SECTION N -- Configuration save: update publication",
    "SECTION O -- Configuration-save atomic rollback",
    "SECTION P -- Configuration-version / session-grant contract",
    "SECTION Q -- Tenant isolation and direct access",
    "SECTION R -- Final safe-output inspection",
  ];

  it.each(requiredSections)("contains %s", (section) => {
    expect(runtimeTestSource).toContain(section);
  });

  it("sections appear in exactly A-R order (each section header index is strictly increasing)", () => {
    const indices = requiredSections.map((s) => runtimeTestSource.indexOf(s));
    for (const idx of indices) {
      expect(idx).toBeGreaterThan(-1);
    }
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });
});

describe("runtime test file (03) -- Section A: constraints, indexes and triggers bound to their exact owning table", () => {
  it("verifies constraints via pg_constraint joined to the owning table, never a bare aggregate count", () => {
    expect(runtimeTestSource).toContain("from pg_constraint con");
    expect(runtimeTestSource).toContain("join pg_class tc on tc.oid = con.conrelid");
    expect(runtimeTestSource).toContain("con.conname = r.constraint_name");
    expect(runtimeTestSource).toContain("tc.relname = r.expected_table");
  });

  it("checks a representative sample of explicitly-named constraints across multiple tables", () => {
    const sample = [
      "project_share_links_pin_completeness_check",
      "share_link_tasks_share_link_id_subtask_id_unique",
      "share_link_resources_display_order_check",
      "share_link_updates_body_check",
      "share_messages_no_self_parent_check",
      "share_message_conversions_message_id_unique",
      "share_browser_sessions_session_digest_unique",
      "share_session_grants_lifecycle_check",
      "share_link_events_event_type_check",
      "share_rate_limit_buckets_window_seconds_check",
      "project_share_secret_material_ciphertext_length_check",
    ];
    for (const name of sample) {
      expect(runtimeTestSource).toContain(`'${name}'`);
    }
  });

  it("verifies indexes via pg_index/pg_class joined to the owning table, including the partial current-update index", () => {
    expect(runtimeTestSource).toContain("from pg_class ic");
    expect(runtimeTestSource).toContain("join pg_index i on i.indexrelid = ic.oid");
    expect(runtimeTestSource).toContain("join pg_class tc on tc.oid = i.indrelid");
    expect(runtimeTestSource).toContain("share_link_updates_current_version_unique_idx");
    expect(runtimeTestSource).toContain("share_session_grants_current_unique_idx");
  });

  it("verifies triggers via pg_trigger joined to the owning table, not only file 02's own smoke-test query", () => {
    const triggerLoopIndex = runtimeTestSource.indexOf("A-TRIGGER-*");
    expect(triggerLoopIndex).toBeGreaterThan(-1);
    const triggerSection = runtimeTestSource.slice(triggerLoopIndex, triggerLoopIndex + 3000);
    expect(triggerSection).toContain("from pg_trigger tg");
    expect(triggerSection).toContain("join pg_class tc on tc.oid = tg.tgrelid");
    expect(triggerSection).toContain("tg.tgname = r.trigger_name");
    expect(triggerSection).toContain("tc.relname = r.expected_table");
  });

  it("every constraint/index/trigger check records its own individual result row rather than hiding failures in one count", () => {
    expect(runtimeTestSource).toMatch(/'A-CONSTRAINT-' \|\| r\.constraint_name/);
    expect(runtimeTestSource).toMatch(/'A-INDEX-' \|\| r\.index_name/);
    expect(runtimeTestSource).toMatch(/'A-TRIGGER-' \|\| r\.trigger_name/);
  });
});

describe("runtime test file (03) -- Section A: structural primary-key and foreign-key coverage (implicit PK/FK are NOT out of scope)", () => {
  it("verifies primary keys structurally via pg_constraint contype='p' and pg_attribute-resolved columns, never a guessed auto-generated name", () => {
    const pkIndex = runtimeTestSource.indexOf("A-PK-*:");
    expect(pkIndex).toBeGreaterThan(-1);
    const pkSection = runtimeTestSource.slice(pkIndex, pkIndex + 2500);
    expect(pkSection).toContain("con.contype = 'p'");
    expect(pkSection).toContain("unnest(con.conkey) with ordinality");
    expect(pkSection).toContain("join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum");
    expect(pkSection).toContain("'A-PK-' || r.expected_table");
    // project_share_secret_material's PK is share_link_id, not a generic id
    // column -- proves the check is column-exact, not name-pattern-based.
    expect(pkSection).toContain("array['share_link_id']");
  });

  it("verifies foreign keys structurally via pg_constraint contype='f', resolved source/referenced columns, and exact ON DELETE behavior, never a guessed name", () => {
    const fkIndex = runtimeTestSource.indexOf("A-FK-*:");
    expect(fkIndex).toBeGreaterThan(-1);
    const fkSection = runtimeTestSource.slice(fkIndex, fkIndex + 6000);
    expect(fkSection).toContain("con.contype = 'f'");
    expect(fkSection).toContain("con.confdeltype = r.expected_delete_rule");
    expect(fkSection).toContain("join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum");
    expect(fkSection).toContain("join pg_attribute att on att.attrelid = con.confrelid and att.attnum = fk.attnum");
    expect(fkSection).toContain("'A-FK-' || r.source_table || '.' || r.source_column");
  });

  it("covers foreign keys into auth.users (a different schema than public), resolved via the referenced table's own namespace, not assumed", () => {
    const fkIndex = runtimeTestSource.indexOf("A-FK-*:");
    const fkSection = runtimeTestSource.slice(fkIndex, fkIndex + 6000);
    expect(fkSection).toContain("'project_share_links', 'user_id', 'auth', 'users', 'id', 'c'");
    expect(fkSection).toContain("join pg_namespace rn on rn.oid = rc.relnamespace");
    expect(fkSection).toContain("rn.nspname = r.ref_schema");
  });

  it("covers project_share_secret_material's share_link_id, which is simultaneously its primary key and its sole foreign key", () => {
    const fkIndex = runtimeTestSource.indexOf("A-FK-*:");
    const fkSection = runtimeTestSource.slice(fkIndex, fkIndex + 6000);
    expect(fkSection).toContain("'project_share_secret_material', 'share_link_id', 'public', 'project_share_links', 'id', 'c'");
  });

  it("no longer documents implicit primary-key/foreign-key constraints as out of scope -- the constraint-list header states they are verified separately, structurally", () => {
    expect(runtimeTestSource).not.toMatch(/primary-key\/foreign-key constraints are\s*\n--\s*intentionally out of scope/);
    expect(runtimeTestSource).toContain("Implicit (unnamed) primary-key and");
    expect(runtimeTestSource).toContain("foreign-key constraints are NOT out of scope");
  });
});

describe("runtime test file (03) -- Section A: pg_attribute.attname (type `name`) is explicitly cast to text before any text[]/text comparison", () => {
  it("the PK check aggregates att.attname::text (not bare att.attname) before comparing against the text[] expected_columns value", () => {
    const pkIndex = runtimeTestSource.indexOf("A-PK-*:");
    expect(pkIndex).toBeGreaterThan(-1);
    const pkSection = runtimeTestSource.slice(pkIndex, pkIndex + 2500);
    expect(pkSection).toContain("array_agg(att.attname::text order by k.ord)");
    expect(pkSection).not.toMatch(/array_agg\(att\.attname\s+order by k\.ord\)/);
  });

  it("the FK source-column check casts att.attname::text before comparing against the text scalar r.source_column", () => {
    const fkIndex = runtimeTestSource.indexOf("A-FK-*:");
    expect(fkIndex).toBeGreaterThan(-1);
    const fkSection = runtimeTestSource.slice(fkIndex, fkIndex + 6000);
    expect(fkSection).toContain(
      "select att.attname::text\n          from unnest(con.conkey) as k(attnum)\n          join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum\n          limit 1\n        ) = r.source_column"
    );
  });

  it("the FK referenced-column check casts att.attname::text before comparing against the text scalar r.ref_column", () => {
    const fkIndex = runtimeTestSource.indexOf("A-FK-*:");
    const fkSection = runtimeTestSource.slice(fkIndex, fkIndex + 6000);
    expect(fkSection).toContain(
      "select att.attname::text\n          from unnest(con.confkey) as fk(attnum)\n          join pg_attribute att on att.attrelid = con.confrelid and att.attnum = fk.attnum\n          limit 1\n        ) = r.ref_column"
    );
  });

  it("no structural PK/FK catalog expression anywhere in the file still aggregates or selects bare att.attname (every occurrence is explicitly cast to text)", () => {
    const bareAttnameMatches = runtimeTestSource.match(/att\.attname(?!::text)/g) ?? [];
    expect(bareAttnameMatches).toEqual([]);
  });

  it("every att.attname reference in the file is immediately followed by an explicit ::text cast (name[] vs text[] / name vs text operator-42883 regression guard)", () => {
    const attnameOccurrences = runtimeTestSource.match(/att\.attname::text/g) ?? [];
    // Exactly three sites: PK array_agg, FK source scalar select, FK referenced scalar select.
    expect(attnameOccurrences.length).toBe(3);
  });
});

describe("runtime test file (03) -- Section A: FK conkey/confkey unnest columns are explicitly aliased and qualified (42702 ambiguous_column regression guard)", () => {
  it("[A] the FK source-column lookup names the unnest relation/column explicitly as k(attnum) and references it qualified (att.attnum = k.attnum)", () => {
    const fkIndex = runtimeTestSource.indexOf("A-FK-*:");
    expect(fkIndex).toBeGreaterThan(-1);
    const fkSection = runtimeTestSource.slice(fkIndex, fkIndex + 6000);
    expect(fkSection).toContain("from unnest(con.conkey) as k(attnum)");
    expect(fkSection).toContain("att.attnum = k.attnum");
  });

  it("[B] the FK referenced-column lookup names the unnest relation/column explicitly as fk(attnum) and references it qualified (att.attnum = fk.attnum)", () => {
    const fkIndex = runtimeTestSource.indexOf("A-FK-*:");
    const fkSection = runtimeTestSource.slice(fkIndex, fkIndex + 6000);
    expect(fkSection).toContain("from unnest(con.confkey) as fk(attnum)");
    expect(fkSection).toContain("att.attnum = fk.attnum");
  });

  it("[C] neither unsafe bare-alias unnest form (`as attnum` with no column list) remains anywhere in the file", () => {
    expect(runtimeTestSource).not.toContain("from unnest(con.conkey) as attnum");
    expect(runtimeTestSource).not.toContain("from unnest(con.confkey) as attnum");
  });

  it("[D] no predicate in the FK structural block contains an unqualified RHS (`att.attnum = attnum`)", () => {
    const fkIndex = runtimeTestSource.indexOf("A-FK-*:");
    const fkSection = runtimeTestSource.slice(fkIndex, fkIndex + 6000);
    expect(fkSection).not.toMatch(/att\.attnum\s*=\s*attnum\b/);
  });

  it("[E] the att.attname::text cast (the prior 42883 fix) is preserved on both qualified FK lookups, not regressed while fixing the ambiguity", () => {
    const fkIndex = runtimeTestSource.indexOf("A-FK-*:");
    const fkSection = runtimeTestSource.slice(fkIndex, fkIndex + 6000);
    const castCount = (fkSection.match(/select att\.attname::text/g) ?? []).length;
    expect(castCount).toBe(2);
  });

  it("[F] the PK check's WITH ORDINALITY unnest continues to use explicit qualified aliases (k.attnum, k.ord), unaffected by the FK fix", () => {
    const pkIndex = runtimeTestSource.indexOf("A-PK-*:");
    expect(pkIndex).toBeGreaterThan(-1);
    const pkSection = runtimeTestSource.slice(pkIndex, pkIndex + 2500);
    expect(pkSection).toContain("from unnest(con.conkey) with ordinality as k(attnum, ord)");
    expect(pkSection).toContain("att.attnum = k.attnum");
    expect(pkSection).toContain("order by k.ord");
  });

  it("broader guard: no bare, unqualified '= attnum' or '= ord' predicate remains anywhere in Section A's structural catalog blocks", () => {
    const sectionAStart = runtimeTestSource.indexOf("-- SECTION A -- Object and security presence");
    const sectionAEnd = runtimeTestSource.indexOf("-- SECTION B -- Owner read RPCs");
    expect(sectionAStart).toBeGreaterThan(-1);
    expect(sectionAEnd).toBeGreaterThan(sectionAStart);
    const sectionA = runtimeTestSource.slice(sectionAStart, sectionAEnd);
    expect(sectionA).not.toContain("= attnum");
    expect(sectionA).not.toContain("= ord");
  });
});

describe("runtime test file (03) -- Section A: signature-exact RPC security checks", () => {
  it("resolves every RPC via to_regprocedure/OID, never a bare proname match", () => {
    expect(runtimeTestSource).toContain("v_proc_oid := to_regprocedure('public.' || r.full_signature)");
    expect(runtimeTestSource).not.toMatch(/p\.proname in \(\s*'get_share_link_management_state'/);
  });

  it("checks the exact SECURITY INVOKER/DEFINER status per RPC via prosecdef, not an aggregate count", () => {
    expect(runtimeTestSource).toContain("select p.prosecdef, p.proconfig into v_prosecdef, v_proconfig");
    expect(runtimeTestSource).toContain("v_prosecdef = (r.expected_security = 'DEFINER')");
  });

  it("checks the exact fixed search_path value as a normalized parsed list, not a `like 'search_path=%'` wildcard alone", () => {
    expect(runtimeTestSource).toContain("v_search_path_parts = array['public', 'pg_temp']");
    expect(runtimeTestSource).not.toMatch(/perform pg_temp\.record_result\('A', 'A5'/);
  });

  it("checks the exact four-role EXECUTE grant profile per RPC, including the two owner-read RPCs (not just the 12 mutating ones)", () => {
    expect(runtimeTestSource).toContain("v_auth_ok := has_function_privilege('authenticated', v_proc_oid, 'EXECUTE')");
    expect(runtimeTestSource).toContain("v_anon_ok := not has_function_privilege('anon', v_proc_oid, 'EXECUTE')");
    expect(runtimeTestSource).toContain("v_public_ok := not has_function_privilege('public', v_proc_oid, 'EXECUTE')");
    expect(runtimeTestSource).toContain("v_service_ok := not has_function_privilege('service_role', v_proc_oid, 'EXECUTE')");
    expect(runtimeTestSource).toContain("('get_share_link_management_state', 'get_share_link_management_state(uuid)', 'INVOKER')");
    expect(runtimeTestSource).toContain("all 14 RPCs, not just the 12 mutating ones");
  });

  it("covers all 14 RPC signatures in the signature-exact loop", () => {
    const signatures = [
      "get_share_link_management_state(uuid)",
      "list_share_link_summaries(uuid[])",
      "create_share_link_draft(uuid,text)",
      "activate_share_link(uuid,text,smallint,text,text,text,smallint)",
      "disable_share_link(uuid)",
      "reenable_share_link(uuid)",
      "set_share_link_pin(uuid,text,text,smallint,integer,integer,integer,integer)",
      "clear_share_link_pin(uuid)",
      "set_share_link_expiry(uuid,timestamptz)",
      "clear_share_link_expiry(uuid)",
      "rotate_share_link_secret(uuid,text,smallint,text,text,text,smallint)",
      "revoke_share_link(uuid)",
      "reveal_share_link_secret(uuid)",
      "save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)",
    ];
    for (const sig of signatures) {
      expect(runtimeTestSource).toContain(`'${sig}'`);
    }
  });
});

describe("runtime test file (03) -- result schema, verdict, and error-matching discipline", () => {
  it("defines the required internal result-row schema with all named columns", () => {
    expect(runtimeTestSource).toMatch(
      /create temporary table _test_results \(\s*seq serial primary key,\s*section text not null,\s*test_code text not null,\s*description text not null,\s*status text not null,\s*expected text,\s*actual text,\s*detail text/
    );
  });

  it("exposes the required PUBLIC result column names (test_number, section, test_name, status, expected, actual, details) in the final result projections", () => {
    expect(runtimeTestSource).toMatch(/seq as test_number,\s*section,\s*test_code as test_name,\s*description,\s*status,\s*expected,\s*actual,\s*detail as details/);
  });

  it("the FAIL-only projection uses the same public column names, including status", () => {
    expect(runtimeTestSource).toMatch(/seq as test_number,\s*section,\s*test_code as test_name,\s*description,\s*status,\s*expected,\s*actual,\s*detail as details\s*from _test_results\s*where status = 'FAIL'/);
  });

  it("defines both exact final-verdict constants", () => {
    expect(runtimeTestSource).toContain("PHASE_1B_RUNTIME_PASS");
    expect(runtimeTestSource).toContain("PHASE_1B_RUNTIME_FAIL");
  });

  it("displays every result row and the summary row before the final failure guard can abort the script", () => {
    const resultsSelectIndex = runtimeTestSource.indexOf("detail as details\nfrom _test_results\norder by seq;");
    const guardIndex = runtimeTestSource.indexOf("PHASE_1B_RUNTIME_FAIL: %s of %s tests failed");
    expect(resultsSelectIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(resultsSelectIndex);
  });

  it("every expected-failure assertion requires an exact SQLSTATE, never accepts any error unconditionally", () => {
    expect(runtimeTestSource).toContain("p_expected_sqlstate is not null and v_sqlstate is distinct from p_expected_sqlstate");
    expect(runtimeTestSource).toContain("p_expected_message is not null and v_errmsg is distinct from p_expected_message");
  });

  it("never uses a broad WHEN OTHERS THEN PASS-style unconditional exception swallow", () => {
    expect(runtimeTestSource).not.toMatch(/when others then\s*(--[^\n]*\n\s*)?(perform pg_temp\.record_result\([^)]*true\)|null;)\s*end;/i);
    expect(runtimeTestSource).not.toMatch(/exception\s+when\s+others\s+then\s+return;/i);
  });

  it("documents precisely what a FAIL guard does to the transaction, without overclaiming that the trailing rollback; statement always executes", () => {
    expect(runtimeTestSource).toContain("PostgreSQL puts the CURRENT transaction");
    expect(runtimeTestSource).toContain("failed/aborted state");
    expect(runtimeTestSource).toContain("Reached only on the PASS path");
  });

  it("always ends the file with rollback;, never commits", () => {
    const trimmed = runtimeTestSource.trimEnd();
    expect(trimmed.endsWith("rollback;")).toBe(true);
    expect(runtimeTestSource).not.toMatch(/\bcommit;/);
  });

  it("begins the assertion transaction with an explicit begin;", () => {
    expect(runtimeTestSource).toMatch(/^begin;$/m);
  });
});

describe("runtime test file (03) -- final guard embeds a compact FAILS=[...] report in the exception itself (Supabase SQL Editor only surfaces the final error)", () => {
  it("aggregates status='FAIL' rows only, ordered by seq, into v_fail_report", () => {
    // lastIndexOf: "select string_agg(" also appears earlier in
    // pg_temp.fake_b64url's own definition -- the final guard's use is the
    // last occurrence in the file.
    const idx = runtimeTestSource.lastIndexOf("select string_agg(");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(idx, idx + 900);
    expect(section).toContain("from _test_results\n      where status = 'FAIL';");
    expect(section).toContain("';' order by seq");
    expect(section).toContain("into v_fail_report");
  });

  it("each failed-row representation includes seq, section, test_code, expected, actual and detail", () => {
    const idx = runtimeTestSource.indexOf("'#%s|section=%s|test=%s|expected=%s|actual=%s|details=%s'");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(idx, idx + 500);
    expect(section).toContain("seq,");
    expect(section).toContain("section,");
    expect(section).toContain("test_code,");
    expect(section).toContain("coalesce(expected, '')");
    expect(section).toContain("coalesce(actual, '')");
    expect(section).toContain("coalesce(detail, '')");
  });

  it("bounds expected/actual/detail to a fixed, named character limit rather than an unbounded string", () => {
    expect(runtimeTestSource).toContain("v_max_field_chars constant int := 400");
    const idx = runtimeTestSource.indexOf("'#%s|section=%s|test=%s|expected=%s|actual=%s|details=%s'");
    const section = runtimeTestSource.slice(idx, idx + 500);
    const leftOpenCount = (section.match(/left\(regexp_replace\(coalesce\(/g) ?? []).length;
    const truncateCloseCount = (section.match(/, v_max_field_chars\)/g) ?? []).length;
    expect(leftOpenCount).toBe(3);
    expect(truncateCloseCount).toBe(3);
  });

  it("normalizes embedded line breaks and tabs to single spaces in every truncated field", () => {
    const idx = runtimeTestSource.indexOf("'#%s|section=%s|test=%s|expected=%s|actual=%s|details=%s'");
    const section = runtimeTestSource.slice(idx, idx + 500);
    const normalizeCount = (section.match(/regexp_replace\(coalesce\([a-z]+, ''\), '\[\\r\\n\\t\]\+', ' ', 'g'\)/g) ?? []).length;
    expect(normalizeCount).toBe(3);
  });

  it("the final exception message contains both PHASE_1B_RUNTIME_FAIL and the FAILS=[...] report", () => {
    const idx = runtimeTestSource.indexOf("raise exception using errcode = 'P0001', message = format(");
    const lastIdx = runtimeTestSource.lastIndexOf("raise exception using errcode = 'P0001', message = format(");
    expect(idx).toBeGreaterThan(-1);
    // The final guard's raise is the LAST such raise in the file (Section
    // A-R uses raise exception too, e.g. the require_id/require_test_pass
    // dependency guards -- this must specifically be the trailing one).
    const section = runtimeTestSource.slice(lastIdx, lastIdx + 400);
    expect(section).toContain("PHASE_1B_RUNTIME_FAIL: %s of %s tests failed. FAILS=[%s]");
    expect(section).toContain("v_failed_count, v_total_count, v_fail_report");
  });

  it("never drops a failing test's identity: the aggregation has no LIMIT/row cap, only per-field truncation", () => {
    const idx = runtimeTestSource.lastIndexOf("select string_agg(");
    const guardEnd = runtimeTestSource.indexOf("$$;\n\n-- Reached only on the PASS path");
    expect(idx).toBeGreaterThan(-1);
    expect(guardEnd).toBeGreaterThan(idx);
    const guardBlock = runtimeTestSource.slice(idx, guardEnd);
    expect(guardBlock).not.toMatch(/\blimit\s+\d+/i);
  });

  it("the PASS path (v_failed_count = 0) still raises no exception and the summary/runtime_status columns are unchanged", () => {
    expect(runtimeTestSource).toContain("if v_failed_count > 0 then");
    expect(runtimeTestSource).toContain("total_tests");
    expect(runtimeTestSource).toContain("passed_tests");
    expect(runtimeTestSource).toContain("failed_tests");
    expect(runtimeTestSource).toContain("runtime_status");
  });

});

describe("runtime test file (03) -- Section O: true post-retirement atomic rollback", () => {
  it("uses a narrowly-scoped, distinctively-named test-only trigger, not an application trigger or constraint", () => {
    expect(runtimeTestSource).toContain("phase_1b_test_only_inject_publish_failure");
    expect(runtimeTestSource).toContain("phase_1b_test_only_post_retirement_failure");
    expect(runtimeTestSource).toContain("PHASE_1B_TEST_ONLY_INJECTED_FAILURE");
  });

  it("the injected trigger only fires for one distinctive test-only body, and is a genuine BEFORE INSERT trigger on the real table", () => {
    expect(runtimeTestSource).toContain("before insert on public.share_link_updates");
    expect(runtimeTestSource).toContain("__PHASE_1B_TEST_ONLY_POST_RETIREMENT_INJECTED_FAILURE__");
  });

  it("snapshots the old current row before the injected failure and asserts it is unchanged and still current afterward", () => {
    expect(runtimeTestSource).toContain("O5-same-row-still-current");
    expect(runtimeTestSource).toContain("O5-exactly-one-current");
    expect(runtimeTestSource).toContain("O5-no-new-version");
    expect(runtimeTestSource).toContain("O5-config-version-unchanged");
  });

  it("drops the test-only trigger and function immediately after the assertion and verifies the drop", () => {
    expect(runtimeTestSource).toContain("drop trigger phase_1b_test_only_post_retirement_failure on public.share_link_updates");
    expect(runtimeTestSource).toContain("drop function pg_temp.phase_1b_test_only_inject_publish_failure()");
    expect(runtimeTestSource).toContain("O5-cleanup");
  });

  it("this is a genuinely valid publishUpdate call (reaches the RPC's real retire step), not an input-validation failure like O1-O4", () => {
    const o5Index = runtimeTestSource.indexOf("O5: TRUE post-retirement atomic rollback");
    expect(o5Index).toBeGreaterThan(-1);
    const o5Section = runtimeTestSource.slice(o5Index, o5Index + 4000);
    expect(o5Section).toContain("a genuinely valid publishUpdate that reaches the retire-then-insert sequence");
  });
});

describe("runtime test file (03) -- Section B: cross-owner context established before the RPC call", () => {
  it("switches to owner B's claim BEFORE the cross-owner get_share_link_management_state call, not after (the corrected ordering bug)", () => {
    const actAsOwnerBIndex = runtimeTestSource.indexOf("perform pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_b'));\n  perform pg_temp.try_rpc('B', 'B4'");
    expect(actAsOwnerBIndex).toBeGreaterThan(-1);
  });

  it("no longer contains the redundant duplicate B4b test that the corrected B4 supersedes", () => {
    expect(runtimeTestSource).not.toContain("'B4b'");
  });

  it("restores owner A's context immediately after the B4 cross-owner call, before any subsequent owner-A test", () => {
    const b4Index = runtimeTestSource.indexOf("'B', 'B4'");
    const restoreIndex = runtimeTestSource.indexOf("Restore owner A before every subsequent owner-A test", b4Index);
    const b5Index = runtimeTestSource.indexOf("'B', 'B5'");
    expect(b4Index).toBeGreaterThan(-1);
    expect(restoreIndex).toBeGreaterThan(b4Index);
    expect(b5Index).toBeGreaterThan(restoreIndex);
  });
});

describe("runtime test file (03) -- Section P: expiry-driven session-grant staleness", () => {
  it("performs a genuine set_share_link_expiry change (never a direct grant mutation) and proves staleness afterward", () => {
    const idx = runtimeTestSource.indexOf("P-EXPIRY-1");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(idx, idx + 5000);
    expect(section).toContain("P-EXPIRY-2");
    expect(section).toContain("set_share_link_expiry");
    expect(section).toContain("P-EXPIRY-3");
    expect(section).toContain("P-EXPIRY-4");
    expect(section).toContain("P-EXPIRY-5");
    expect(section).not.toMatch(/update public\.share_session_grants set granted_configuration_version/);
  });

  it("proves the existing grant row still exists and was not rewritten before proving it is stale", () => {
    const idx = runtimeTestSource.indexOf("P-EXPIRY-4");
    expect(idx).toBeGreaterThan(-1);
    const line = runtimeTestSource.slice(idx, idx + 400);
    expect(line).toContain("was not deleted");
    expect(line).toContain("was not rewritten");
  });
});

describe("runtime test file (03) -- Section P: P3 is a genuine, runtime-computed settings change (not a replay of K5's hard-coded value)", () => {
  it("reads the live content_direction/configuration_version and grant_1's stored version immediately before P3, rather than assuming K5's value", () => {
    const idx = runtimeTestSource.indexOf("P3-precondition");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(Math.max(0, idx - 900), idx + 200);
    expect(section).toContain(
      "select configuration_version, content_direction into v_link_version, v_old_direction"
    );
    expect(section).toContain(
      "select granted_configuration_version into v_grant_1_version_before"
    );
  });

  it("computes a content_direction value guaranteed to differ from whatever is live right now, and passes that computed value (not a hard-coded literal) into save_share_configuration", () => {
    const idx = runtimeTestSource.indexOf("v_new_direction := case when v_old_direction");
    expect(idx).toBeGreaterThan(-1);
    expect(runtimeTestSource.slice(idx, idx + 120)).toContain(
      "case when v_old_direction = 'rtl' then 'ltr' else 'rtl' end"
    );
    const p3CallIdx = runtimeTestSource.indexOf("'P', 'P3', 'fixture action", idx);
    expect(p3CallIdx).toBeGreaterThan(idx);
    const call = runtimeTestSource.slice(p3CallIdx, p3CallIdx + 300);
    expect(call).toContain("jsonb_build_object('contentDirection', v_new_direction)");
    expect(call).not.toContain('{"contentDirection":"rtl"}');
  });

  it("snapshots configuration_version before the call and asserts it advances by exactly one after the genuine (computed) direction change", () => {
    const idx = runtimeTestSource.indexOf("P3-version-bump");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(Math.max(0, idx - 300), idx + 300);
    expect(section).toContain("v_config_version_after = v_link_version + 1");
  });

  it("proves grant_1's row still exists and its stored granted_configuration_version was not rewritten by the change, before proving it is now stale", () => {
    const unchangedIdx = runtimeTestSource.indexOf("P3-grant-unchanged");
    const staleIdx = runtimeTestSource.indexOf("P3-stale");
    expect(unchangedIdx).toBeGreaterThan(-1);
    expect(staleIdx).toBeGreaterThan(unchangedIdx);
    const section = runtimeTestSource.slice(Math.max(0, unchangedIdx - 100), staleIdx + 400);
    expect(section).toContain("was not rewritten by the settings change");
    expect(section).toContain("v_grant_1_version_before");
    expect(section).toContain("<> v_config_version_after");
  });

  it("does not restore or otherwise touch content_direction via direct DML anywhere between P3 and the next section (P-EXPIRY)", () => {
    const staleIdx = runtimeTestSource.indexOf("P3-stale");
    const nextIdx = runtimeTestSource.indexOf("P-EXPIRY-1", staleIdx);
    expect(staleIdx).toBeGreaterThan(-1);
    expect(nextIdx).toBeGreaterThan(staleIdx);
    const section = runtimeTestSource.slice(staleIdx, nextIdx);
    expect(section).not.toMatch(/update\s+public\.project_share_links\s+set\s+content_direction/i);
  });
});

describe("runtime test file (03) -- Section I: expired-state reveal rejection (all four non-active states)", () => {
  it("persists the Section G10 expired fixture for deterministic reuse rather than inventing a shortcut", () => {
    expect(runtimeTestSource).toContain("pg_temp.set_val('link_expired_g10', v_expired_link::text)");
  });

  it("tests reveal rejection on the real expired fixture with the exact expected SQLSTATE/message", () => {
    const idx = runtimeTestSource.indexOf("'I', 'I3b'");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(idx, idx + 400);
    expect(section).toContain("link_expired_g10");
    expect(section).toContain("SHARE_LINK_STATE_CONFLICT");
    expect(section).toContain("'P0001'");
  });

  it("covers all four rejected states: draft, disabled, expired, revoked", () => {
    expect(runtimeTestSource).toContain("'I2'");
    expect(runtimeTestSource).toContain("'I3'");
    expect(runtimeTestSource).toContain("'I3b'");
    expect(runtimeTestSource).toContain("'I4'");
  });
});

describe("runtime test file (03) -- Section J: expired -> revoked, version/event proof, and content retention", () => {
  it("reuses the persisted Section G10 expired fixture for the expired -> revoked case rather than constructing a second one", () => {
    const idx = runtimeTestSource.indexOf("v_link_4 := pg_temp.get_uuid('link_expired_g10')");
    expect(idx).toBeGreaterThan(-1);
    const jExpiredIdx = runtimeTestSource.indexOf("J-EXPIRED", idx);
    expect(jExpiredIdx).toBeGreaterThan(idx);
  });

  it("proves configuration_version increases by exactly one and exactly one link_revoked event is created for each represented source state", () => {
    for (const code of ["J1", "J2", "J3", "J-EXPIRED"]) {
      expect(runtimeTestSource).toContain(`${code}-version`);
      expect(runtimeTestSource).toContain(`${code}-event`);
    }
  });

  it("creates real curated content (task mapping, Resource mapping, published update) via save_share_configuration itself before revoking, never by direct mutation", () => {
    const idx = runtimeTestSource.indexOf("J8setup3");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(idx, idx + 1200);
    expect(section).toContain("save_share_configuration");
    expect(section).toContain("task_a2");
    expect(section).toContain("resource_a2");
  });

  it("snapshots task/Resource mappings and the published update before revoke and proves they are unchanged afterward", () => {
    expect(runtimeTestSource).toContain("J9-tasks-retained");
    expect(runtimeTestSource).toContain("J9-resources-retained");
    expect(runtimeTestSource).toContain("J9-update-retained");
    const beforeIdx = runtimeTestSource.indexOf("J8-pre-content");
    const revokeIdx = runtimeTestSource.indexOf("'J', 'J8'");
    const afterIdx = runtimeTestSource.indexOf("J9-tasks-retained");
    expect(beforeIdx).toBeGreaterThan(-1);
    expect(revokeIdx).toBeGreaterThan(beforeIdx);
    expect(afterIdx).toBeGreaterThan(revokeIdx);
  });
});

describe("runtime test file (03) -- J3: genuine never-activated draft -> revoked, through real RPCs only (product-defect regression guard)", () => {
  it("J3's fixture is a genuine draft created through create_share_link_draft, with no activation step before J3 revokes it", () => {
    const setupIdx = runtimeTestSource.indexOf("'J', 'J3setup1'");
    const j3Idx = runtimeTestSource.indexOf("'J', 'J3', 'revoking a draft");
    expect(setupIdx).toBeGreaterThan(-1);
    expect(j3Idx).toBeGreaterThan(setupIdx);
    const section = runtimeTestSource.slice(setupIdx, j3Idx);
    expect(section).toContain("create_share_link_draft");
    expect(section).not.toContain("activate_share_link");
  });

  it("J3 revokes through the real revoke_share_link RPC, never through a direct UPDATE of project_share_links (not bypassed by direct DML)", () => {
    const j3Idx = runtimeTestSource.indexOf("'J', 'J3', 'revoking a draft");
    expect(j3Idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(j3Idx, j3Idx + 300);
    expect(section).toContain("format('select public.revoke_share_link(%L)', v_link_3)");
    expect(section).not.toContain("update public.project_share_links");
  });

  it("J3 expects the revoke call to SUCCEED (a genuine product behavior proof), not an expected failure", () => {
    const j3Idx = runtimeTestSource.indexOf("'J', 'J3', 'revoking a draft");
    const section = runtimeTestSource.slice(j3Idx, j3Idx + 300);
    expect(section).toMatch(/format\('select public\.revoke_share_link\(%L\)', v_link_3\),\s*\n\s*true, null, null, 'j3_result'\);/);
  });

  it("J3-version and J3-event still prove configuration_version +1 and exactly one link_revoked event from real before/after database reads, not from the RPC's own returned shape alone", () => {
    const idx = runtimeTestSource.indexOf("'J', 'J3', 'revoking a draft");
    const section = runtimeTestSource.slice(idx, idx + 1100);
    expect(section).toContain("v_config_after = v_config_before + 1");
    expect(section).toContain("v_event_count_after = v_event_count_before + 1");
  });
});

describe("runtime test file (03) -- K7: isolated SHARE_LINK_REVOKED proof, independent of K6's PROJECT_ARCHIVED (harness-defect regression guard)", () => {
  it("K7 uses a dedicated link on the non-archived project_a1, never K6's now-archived project_a2 target (j_link_1)", () => {
    const k7Idx = runtimeTestSource.indexOf("'K', 'K7', 'config save against a revoked link");
    expect(k7Idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(Math.max(0, k7Idx - 900), k7Idx + 300);
    expect(section).toContain("pg_temp.get_uuid('project_a1')");
    expect(section).not.toContain("j_link_1");
  });

  it("K7's dedicated link is created and revoked through the real create_share_link_draft and revoke_share_link RPCs, never by direct INSERT/UPDATE", () => {
    const setupIdx = runtimeTestSource.indexOf("'K', 'K7setup1'");
    const k7Idx = runtimeTestSource.indexOf("'K', 'K7', 'config save against a revoked link");
    expect(setupIdx).toBeGreaterThan(-1);
    expect(k7Idx).toBeGreaterThan(setupIdx);
    const section = runtimeTestSource.slice(setupIdx, k7Idx);
    expect(section).toContain("create_share_link_draft");
    expect(section).toContain("format('select public.revoke_share_link(%L)', v_k7_link)");
    expect(section).not.toMatch(/insert into public\.project_share_links/);
    expect(section).not.toMatch(/update public\.project_share_links/);
  });

  it("K7 expects exactly SQLSTATE P0001 / SHARE_LINK_REVOKED", () => {
    const k7Idx = runtimeTestSource.indexOf("'K', 'K7', 'config save against a revoked link");
    const section = runtimeTestSource.slice(k7Idx, k7Idx + 400);
    expect(section).toContain("false, 'SHARE_LINK_REVOKED', 'P0001'");
  });

  it("K6 (PROJECT_ARCHIVED) remains unchanged and still uses its own archived-project fixture", () => {
    const k6Idx = runtimeTestSource.indexOf("'K', 'K6', 'config save against a now-archived project");
    expect(k6Idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(k6Idx, k6Idx + 350);
    expect(section).toContain("v_archived_link");
    expect(section).toContain("false, 'PROJECT_ARCHIVED', 'P0001'");
  });
});

describe("runtime test file (03) -- O1: NULL-safe snapshot equality (harness-defect regression guard)", () => {
  it("O1-unchanged compares the before/after row snapshots with IS NOT DISTINCT FROM, not plain =", () => {
    const idx = runtimeTestSource.indexOf("'O', 'O1-unchanged'");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(idx, idx + 700);
    expect(section).toContain("is not distinct from row(");
  });

  it("the old NULL-sensitive plain row(...) = row(...) comparison is absent from the O1-unchanged assertion", () => {
    const idx = runtimeTestSource.indexOf("'O', 'O1-unchanged'");
    const section = runtimeTestSource.slice(idx, idx + 700);
    expect(section).not.toMatch(/configuration_version\)\s*\n\s*=\s*row\(/);
  });

  it("still compares every original snapshot field (comments_enabled, client_facing_subtitle, content_direction, configuration_version) plus the task-mapping count -- the fix narrows only the comparison operator, not the fields compared", () => {
    const idx = runtimeTestSource.indexOf("'O', 'O1-unchanged'");
    const section = runtimeTestSource.slice(idx, idx + 700);
    for (const field of ["comments_enabled", "client_facing_subtitle", "content_direction", "configuration_version"]) {
      expect(section).toContain(`v_settings_before.${field}`);
      expect(section).toContain(`v_settings_after.${field}`);
    }
    expect(section).toContain("v_task_count_before = v_task_count_after");
  });

  it("the expected outcome remains 'no change'", () => {
    const idx = runtimeTestSource.indexOf("'O', 'O1-unchanged'");
    const section = runtimeTestSource.slice(idx, idx + 700);
    expect(section).toContain("'no change'");
  });
});

describe("runtime test file (03) -- P5: repeated real rotation of the same link inside one outer transaction (product-defect regression guard, ultimate proof of the monotonic-timestamp fix)", () => {
  it("P5setup performs a second real rotate_share_link_secret call against link_a1 -- the same link Section H1 already rotated earlier in this same outer transaction", () => {
    const idx = runtimeTestSource.indexOf("'P', 'P5setup'");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(idx, idx + 450);
    expect(section).toContain("format('select public.rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 1::smallint)', pg_temp.get_uuid('link_a1')");
    expect(section).toContain("true);");
  });

  it("no sleep or artificial delay is introduced anywhere in Section P to force timestamp separation", () => {
    const pIdx = runtimeTestSource.indexOf("SECTION P -- Configuration-version / session-grant contract");
    const qIdx = runtimeTestSource.indexOf("SECTION Q -- Tenant isolation");
    expect(pIdx).toBeGreaterThan(-1);
    expect(qIdx).toBeGreaterThan(pIdx);
    const sectionP = runtimeTestSource.slice(pIdx, qIdx);
    expect(sectionP.toLowerCase()).not.toContain("pg_sleep");
  });

  it("P5's evidence is computed from the actual live grant/link configuration_version values, not a hard-coded 'observed not equal' string regardless of outcome", () => {
    const idx = runtimeTestSource.indexOf("'P', 'P5', 'grant_3 is now stale");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(idx, idx + 400);
    expect(section).toContain("format('grant=%s, live=%s', v_grant_3_version, v_config_version_after_rotation)");
    expect(section).not.toContain("'observed not equal'");
  });

  it("P5's boolean PASS condition remains the real inequality check between grant_3's stored version and the live configuration_version", () => {
    const idx = runtimeTestSource.indexOf("'P', 'P5', 'grant_3 is now stale");
    const section = runtimeTestSource.slice(idx, idx + 300);
    expect(section).toContain("v_grant_3_version <> v_config_version_after_rotation");
  });
});

describe("runtime package cross-file: the runtime lifecycle expectations match the corrected migration constraint", () => {
  it("file 03's J3/K7 draft-revoke fixtures rely on a constraint that is proven (in migration 003's own test suite) to allow a null digest for draft and for a never-activated revoked link", () => {
    // This is a documentation-level cross-check, not a re-derivation of the
    // migration's own test: it just proves the runtime package's revoke-a-
    // draft scenarios are exercising behavior the constraint is designed to
    // permit, per this file's own generator-embedded copy of the migration.
    const migrationCopyIdx = bundleSource.indexOf(
      "constraint project_share_links_secret_digest_consistency_check"
    );
    expect(migrationCopyIdx).toBeGreaterThan(-1);
    const constraintText = bundleSource.slice(migrationCopyIdx, migrationCopyIdx + 400);
    expect(constraintText).toContain("state = 'draft'");
    expect(constraintText).toContain("state = 'revoked' and activated_at is null");
  });
});

describe("runtime test file (03) -- Section H: H4 full rollback proof for the missing-material rotation failure", () => {
  it("snapshots secret_digest, secret_digest_version, rotated_at, configuration_version, state and the link_rotated event count before the expected failure, and proves all unchanged after", () => {
    const idx = runtimeTestSource.indexOf("H4-rollback-full");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(Math.max(0, idx - 2000), idx + 800);
    expect(section).toContain("v_h4_before");
    expect(section).toContain("v_h4_after");
    expect(section).toContain("secret_digest, secret_digest_version, rotated_at, configuration_version, state");
    expect(section).toContain("v_h4_material_count_after");
  });
});

describe("runtime test file (03) -- Section D: D10 full rollback proof for failed activation", () => {
  it("checks secret_digest, secret_digest_version, activated_at, configuration_version (exact pre-activation value), state, and the absence of a link_activated event", () => {
    const idx = runtimeTestSource.indexOf("D10-full-rollback");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(Math.max(0, idx - 1200), idx + 900);
    expect(section).toContain("secret_digest, secret_digest_version, activated_at, configuration_version, state");
    expect(section).toContain("v_d10_event_count");
    expect(section).toContain("configuration_version = 1");
  });
});

describe("runtime test file (03) -- role-context invariant: internal-table postconditions run as postgres, not as the authenticated owner (42501 permission_denied regression guard)", () => {
  it("[A/B] Section C's link_created verification restores postgres BEFORE the direct share_link_events SELECT, then resumes owner A afterward for C4 onward", () => {
    const idx = runtimeTestSource.indexOf("link_created event exists with no secret/content");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(idx, idx + 1000);
    const restoreIdx = section.indexOf("pg_temp.act_as('postgres')");
    const selectIdx = section.indexOf("from public.share_link_events");
    const resultIdx = section.indexOf("record_result('C', 'C3'");
    const resumeIdx = section.indexOf("pg_temp.act_as('authenticated', pg_temp.get_uuid('owner_a'))");
    expect(restoreIdx).toBeGreaterThan(-1);
    expect(selectIdx).toBeGreaterThan(restoreIdx);
    expect(resultIdx).toBeGreaterThan(selectIdx);
    expect(resumeIdx).toBeGreaterThan(resultIdx);
  });

  it("[B] Section F's F12 share_session_grants postcondition restores postgres immediately before the direct SELECT (not merely somewhere later in the block)", () => {
    const idx = runtimeTestSource.indexOf("no share_session_grants row was created by any PIN operation");
    expect(idx).toBeGreaterThan(-1);
    const before = runtimeTestSource.slice(Math.max(0, idx - 300), idx);
    const restoreIdx = before.lastIndexOf("pg_temp.act_as('postgres')");
    const selectIdx = before.lastIndexOf("select count(*) into v_grant_count from public.share_session_grants;");
    expect(restoreIdx).toBeGreaterThan(-1);
    expect(selectIdx).toBeGreaterThan(restoreIdx);
  });

  it("[B] Section G's G9 share_session_grants postcondition restores postgres immediately before the direct SELECT (not merely somewhere later in the block)", () => {
    const idx = runtimeTestSource.indexOf("no share_session_grants row was created by any expiry operation");
    expect(idx).toBeGreaterThan(-1);
    const before = runtimeTestSource.slice(Math.max(0, idx - 300), idx);
    const restoreIdx = before.lastIndexOf("pg_temp.act_as('postgres')");
    const selectIdx = before.lastIndexOf("select count(*) into v_grant_count from public.share_session_grants;");
    expect(restoreIdx).toBeGreaterThan(-1);
    expect(selectIdx).toBeGreaterThan(restoreIdx);
  });

  it("[C] A14's direct-access-denial test intentionally remains in owner A's authenticated context -- no false restoration forced before it", () => {
    const anchorIdx = runtimeTestSource.indexOf("act_as('authenticated', pg_temp.get_uuid('owner_a'))", runtimeTestSource.indexOf("'A13'"));
    const a14Idx = runtimeTestSource.indexOf("'A14'");
    expect(anchorIdx).toBeGreaterThan(-1);
    expect(a14Idx).toBeGreaterThan(anchorIdx);
    const between = runtimeTestSource.slice(anchorIdx, a14Idx);
    expect(between).not.toContain("act_as('postgres')");
  });

  it("[C] Q4's direct-access-denial test intentionally remains in owner B's authenticated context -- no false restoration forced before it", () => {
    const sectionQIdx = runtimeTestSource.indexOf("SECTION Q -- Tenant isolation");
    const ownerBIdx = runtimeTestSource.indexOf("act_as('authenticated', pg_temp.get_uuid('owner_b'))", sectionQIdx);
    const q4Idx = runtimeTestSource.indexOf("'Q4'");
    expect(ownerBIdx).toBeGreaterThan(-1);
    expect(q4Idx).toBeGreaterThan(ownerBIdx);
    const between = runtimeTestSource.slice(ownerBIdx, q4Idx);
    expect(between).not.toContain("act_as('postgres')");
  });

  it("[C] Q8/Q8b's direct-table-mutation-denial tests intentionally remain in owner A's authenticated context -- no false restoration forced before them", () => {
    const anchorIdx = runtimeTestSource.indexOf("act_as('authenticated', pg_temp.get_uuid('owner_a'))", runtimeTestSource.indexOf("Authenticated direct table mutation remains denied"));
    const q8Idx = runtimeTestSource.indexOf("'Q8'");
    expect(anchorIdx).toBeGreaterThan(-1);
    expect(q8Idx).toBeGreaterThan(anchorIdx);
    const between = runtimeTestSource.slice(anchorIdx, q8Idx);
    expect(between).not.toContain("act_as('postgres')");
  });

  it("[D] no GRANT to authenticated or anon was introduced for any of the five fully-closed internal tables, merely to satisfy the harness", () => {
    const closedTables = [
      "share_link_events",
      "share_session_grants",
      "share_browser_sessions",
      "share_rate_limit_buckets",
      "project_share_secret_material",
    ];
    for (const table of closedTables) {
      const re = new RegExp(`grant[^;]*on\\s+(public\\.)?${table}[^;]*to\\s+(authenticated|anon|public)`, "i");
      expect(runtimeTestSource).not.toMatch(re);
    }
  });

  it("[E] existing direct-access security assertions remain intact: A14, Q4, Q7/Q7b/Q7c, Q8/Q8b still exist and still expect a real 42501 denial", () => {
    for (const code of ["A14", "Q4", "Q7", "Q7b", "Q7c", "Q8", "Q8b"]) {
      expect(runtimeTestSource.indexOf(`'${code}'`), `${code} not found`).toBeGreaterThan(-1);
    }
    expect(runtimeTestSource).toContain("'42501'");
  });
});

describe("runtime test file (03) -- pg_temp.record_result: every evidence argument resolves to the real (text, text, text) signature (42883 undefined_function regression guard)", () => {
  it("establishes the actual record_result signature from its own definition: p_expected/p_actual/p_detail are all text", () => {
    const idx = runtimeTestSource.indexOf("create or replace function pg_temp.record_result(");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(idx, idx + 400);
    expect(section).toContain("p_section text, p_code text, p_desc text, p_pass boolean,");
    expect(section).toContain("p_expected text default null, p_actual text default null, p_detail text default null");
  });

  it("[L1-final-set] both the previously-buggy jsonb evidence arguments are now explicitly cast to ::text", () => {
    const idx = runtimeTestSource.indexOf("'L1-final-set'");
    expect(idx).toBeGreaterThan(-1);
    const line = runtimeTestSource.slice(idx, idx + 400);
    expect(line).toContain("jsonb_build_array(pg_temp.get_bigint('task_a1')::text)::text");
    expect(line).toContain("(v_result->'taskIds')::text");
  });

  it("comprehensive audit: every pg_temp.record_result call site's p_expected/p_actual/p_detail argument is either not jsonb-shaped, ends in a text-returning ->> extraction, or carries an explicit ::text cast", () => {
    const calls = extractBalancedCalls(runtimeTestSource, "pg_temp.record_result(");
    // Sanity: this must actually find calls (proves the parser itself works),
    // and must cover every section including L-R, not just a handful.
    expect(calls.length).toBeGreaterThan(150);

    const violations: string[] = [];
    for (const call of calls) {
      const args = splitTopLevelArgs(call.argsText);
      // args[4], args[5], args[6] are p_expected, p_actual, p_detail (0-indexed).
      for (let argIdx = 4; argIdx <= 6; argIdx++) {
        if (argIdx >= args.length) continue;
        const arg = args[argIdx];
        if (isUncastJsonbExpression(arg)) {
          violations.push(`line ${call.line}, argument #${argIdx + 1}: ${arg}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("the resourceIds/taskIds/currentUpdate/b7_result evidence sites specifically now carry the expected ::text cast (named regression coverage for the actual failures found at runtime)", () => {
    const expectedCasts = [
      "(v_result->'taskIds')::text",
      "(v_result->'resourceIds')::text",
      "(v_result->'currentUpdate')::text",
      "(pg_temp.get_json('n3_result')->'currentUpdate')::text",
      "pg_temp.get_json('b7_result')::text",
    ];
    for (const snippet of expectedCasts) {
      expect(runtimeTestSource, `missing expected cast: ${snippet}`).toContain(snippet);
    }
  });

  it("does not weaken evidence quality: the corrected arguments still carry the real jsonb value (via ::text serialization), not a vague placeholder string", () => {
    const idx = runtimeTestSource.indexOf("'L1-final-set'");
    const section = runtimeTestSource.slice(idx, idx + 400);
    // The actual/expected evidence must still be derived from the real
    // captured jsonb value -- not replaced with a generic literal like
    // 'see above' or 'result recorded'.
    expect(section).not.toMatch(/(v_result->'taskIds')::text['"]?\s*,\s*'(see|recorded|n\/a)/i);
    expect(section).toContain("v_result->'taskIds'");
  });
});

describe("runtime test file (03) -- other pg_temp test helpers: signature-exact call audit", () => {
  it("require_id's p_id_text argument is always explicitly cast to ::text at every call site", () => {
    const calls = extractBalancedCalls(runtimeTestSource, "pg_temp.require_id(");
    expect(calls.length).toBeGreaterThanOrEqual(4);
    for (const call of calls) {
      const args = splitTopLevelArgs(call.argsText);
      expect(args).toHaveLength(4);
      expect(args[3], `line ${call.line}: require_id 4th arg not cast to ::text`).toMatch(/::text\s*$/);
    }
  });

  it("act_as's p_user_id argument is always a uuid-returning call or an untyped literal, never a jsonb/record expression", () => {
    const calls = extractBalancedCalls(runtimeTestSource, "pg_temp.act_as(");
    expect(calls.length).toBeGreaterThan(50);
    for (const call of calls) {
      const args = splitTopLevelArgs(call.argsText);
      if (args.length < 2) continue; // 1-arg calls (postgres/anon/service_role) have no p_user_id
      const userIdArg = args[1];
      expect(isUncastJsonbExpression(userIdArg), `line ${call.line}: act_as p_user_id looks jsonb-shaped: ${userIdArg}`).toBe(false);
    }
  });

  it("try_rpc/try_stmt's p_sql argument is always built via format(...) (text-returning) or a plain quoted literal, never a bare jsonb expression", () => {
    for (const prefix of ["pg_temp.try_rpc(", "pg_temp.try_stmt("]) {
      const calls = extractBalancedCalls(runtimeTestSource, prefix);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        const args = splitTopLevelArgs(call.argsText);
        const sqlArg = args[3];
        expect(
          /^format\(/.test(sqlArg) || /^'.*'$/.test(sqlArg),
          `line ${call.line}: ${prefix} p_sql argument is neither format(...) nor a plain literal: ${sqlArg}`
        ).toBe(true);
      }
    }
  });
});

describe("runtime test file (03) -- signature-exact RPC calls: smallint parameters are never passed as bare (integer-typed) literals (42883 undefined_function regression guard)", () => {
  // activate_share_link(uuid, text, smallint, text, text, text, smallint) and
  // rotate_share_link_secret(uuid, text, smallint, text, text, text, smallint)
  // both take smallint at positions 3 and 7. integer -> smallint is an
  // assignment-only cast in PostgreSQL, not an implicit one, so a bare
  // integer literal (e.g. `1`) in either position makes the call resolve to
  // no function at all (42883), even though the RPC is not overloaded.
  const ACTIVATE_CALL_COUNT = 19;
  const ROTATE_CALL_COUNT = 11;
  const PIN_CALL_COUNT = 10;

  it(`every activate_share_link call site (${ACTIVATE_CALL_COUNT} total) casts both version arguments to ::smallint`, () => {
    const totalCalls = (runtimeTestSource.match(/public\.activate_share_link\(/g) ?? []).length;
    const castCalls = (
      runtimeTestSource.match(/activate_share_link\(%L, %L, \d::smallint, %L, %L, %L, \d::smallint\)/g) ?? []
    ).length;
    expect(totalCalls).toBe(ACTIVATE_CALL_COUNT);
    expect(castCalls).toBe(ACTIVATE_CALL_COUNT);
  });

  it(`every rotate_share_link_secret call site (${ROTATE_CALL_COUNT} total) casts both version arguments to ::smallint`, () => {
    const totalCalls = (runtimeTestSource.match(/public\.rotate_share_link_secret\(/g) ?? []).length;
    const castCalls = (
      runtimeTestSource.match(/rotate_share_link_secret\(%L, %L, \d::smallint, %L, %L, %L, \d::smallint\)/g) ?? []
    ).length;
    expect(totalCalls).toBe(ROTATE_CALL_COUNT);
    expect(castCalls).toBe(ROTATE_CALL_COUNT);
  });

  it(`every set_share_link_pin call site (${PIN_CALL_COUNT} total) casts pin_hash_version to ::smallint`, () => {
    const totalCalls = (runtimeTestSource.match(/public\.set_share_link_pin\(/g) ?? []).length;
    const castCalls = (
      runtimeTestSource.match(/set_share_link_pin\(%L, %L, %L, \d::smallint, \d+, \d+, \d+, \d+\)/g) ?? []
    ).length;
    expect(totalCalls).toBe(PIN_CALL_COUNT);
    expect(castCalls).toBe(PIN_CALL_COUNT);
  });

  it("no executable activate_share_link/rotate_share_link_secret call remains with a bare (uncast) integer literal in either smallint position", () => {
    expect(runtimeTestSource).not.toMatch(/activate_share_link\(%L, %L, \d, %L, %L, %L, \d\)/);
    expect(runtimeTestSource).not.toMatch(/rotate_share_link_secret\(%L, %L, \d, %L, %L, %L, \d\)/);
  });

  it("no executable set_share_link_pin call remains with a bare (uncast) integer literal in the pin_hash_version position", () => {
    expect(runtimeTestSource).not.toMatch(/set_share_link_pin\(%L, %L, %L, \d, \d+, \d+, \d+, \d+\)/);
  });

  it("malformed-version tests (D6, D9b, H10, F11) still cast their intentionally-invalid version value to ::smallint, so the call reaches the real RPC and returns its own application error rather than 42883", () => {
    // D6: secret_digest_version=2 (invalid); D9b/H10: encryption_version=2 (invalid); F11: pin_hash_version=2 (invalid).
    expect(runtimeTestSource).toContain("activate_share_link(%L, %L, 2::smallint, %L, %L, %L, 1::smallint)");
    expect(runtimeTestSource).toContain("activate_share_link(%L, %L, 1::smallint, %L, %L, %L, 2::smallint)");
    expect(runtimeTestSource).toContain("rotate_share_link_secret(%L, %L, 1::smallint, %L, %L, %L, 2::smallint)");
    expect(runtimeTestSource).toContain("set_share_link_pin(%L, %L, %L, 2::smallint, 16384, 8, 1, 32)");
  });

  it("F10's malformed scrypt-N test still casts its (valid) pin_hash_version to ::smallint even though N itself is the intentionally-invalid value", () => {
    expect(runtimeTestSource).toContain("set_share_link_pin(%L, %L, %L, 1::smallint, 8192, 8, 1, 32)");
  });

  it("every list_share_link_summaries call passes an explicitly-cast uuid[] array, never a bare/ambiguous array literal", () => {
    const totalCalls = (runtimeTestSource.match(/public\.list_share_link_summaries\(array\[/g) ?? []).length;
    const castCalls = (runtimeTestSource.match(/list_share_link_summaries\(array\[[^)]*\]::uuid\[\]\)/g) ?? []).length;
    expect(totalCalls).toBeGreaterThan(0);
    expect(totalCalls).toBe(castCalls);
  });
});

describe("runtime test file (03) -- Section F: exact seven-column PIN persistence and clear verification", () => {
  it("reads the raw row (never public RPC output) and proves all seven PIN columns exactly equal the supplied deterministic profile after set", () => {
    const idx = runtimeTestSource.indexOf("F1-columns-exact");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(Math.max(0, idx - 800), idx + 800);
    expect(section).toContain("pin_hash, pin_salt, pin_hash_version, pin_scrypt_n, pin_scrypt_r, pin_scrypt_p, pin_key_length");
    expect(section).toContain("v_f1_row.pin_hash_version = 1");
    expect(section).toContain("v_f1_row.pin_scrypt_n = 16384");
  });

  it("proves all seven PIN columns are NULL after clear_share_link_pin", () => {
    const idx = runtimeTestSource.indexOf("F4-columns-all-null");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(Math.max(0, idx - 800), idx + 800);
    expect(section).toContain("v_f4_row.pin_hash is null");
    expect(section).toContain("v_f4_row.pin_key_length is null");
  });
});

describe("runtime test file (03) -- Section R: recursive safe-output inspection", () => {
  it("defines a recursive JSON key-walking helper that descends into nested objects and arrays", () => {
    expect(runtimeTestSource).toContain("function pg_temp.recursive_json_keys(p_value jsonb) returns text[]");
    expect(runtimeTestSource).toContain("jsonb_typeof(p_value) = 'object'");
    expect(runtimeTestSource).toContain("jsonb_typeof(p_value) = 'array'");
  });

  it("the forbidden-key list includes the newly-required fields (phone, email, notes, contactName, clientName, amount, priority)", () => {
    const forbidden = ["phone", "email", "notes", "contactName", "clientName", "amount", "priority"];
    for (const key of forbidden) {
      expect(runtimeTestSource).toContain(`'${key}'`);
    }
  });

  it("handles projectId as a targeted check rather than a blanket forbidden key: required present on summaries, required absent elsewhere", () => {
    expect(runtimeTestSource).toContain("intentional, approved field");
    expect(runtimeTestSource).toContain("REQUIRED to be present");
    expect(runtimeTestSource).toContain("ordinary lifecycle/access/config result) unexpectedly contains projectId");
    expect(runtimeTestSource).toContain("DO intentionally contain projectId");
  });

  it("proves get_share_link_management_state includes the owner's own update body via a real RPC call captured before link_a1 is revoked, not a placeholder assertion", () => {
    expect(runtimeTestSource).toContain("P8b-r4-capture");
    expect(runtimeTestSource).not.toMatch(/record_result\('R', 'R3',\s*'the owner-read management-state result deliberately DOES include[\s\S]{0,80}true,/);
  });

  it("captures the real management-state result for link_a1 (P8b-r4-capture) strictly BEFORE Section P's P9 revoke_share_link call, in source order", () => {
    const captureIdx = runtimeTestSource.indexOf("P8b-r4-capture");
    const revokeIdx = runtimeTestSource.indexOf("'P', 'P9setup'");
    expect(captureIdx).toBeGreaterThan(-1);
    expect(revokeIdx).toBeGreaterThan(-1);
    expect(captureIdx).toBeLessThan(revokeIdx);
  });

  it("the pre-revoke capture verifies link.id = link_a1 and that currentUpdate.body is the real published body, both while link_a1 is still active", () => {
    const captureIdx = runtimeTestSource.indexOf("P8b-r4-capture");
    const revokeIdx = runtimeTestSource.indexOf("'P', 'P9setup'", captureIdx);
    expect(captureIdx).toBeGreaterThan(-1);
    expect(revokeIdx).toBeGreaterThan(captureIdx);
    const section = runtimeTestSource.slice(captureIdx, revokeIdx);
    expect(section).toContain("P8b-r4-capture-link");
    expect(section).toContain("(v_r4_capture->'link'->>'id')::uuid = pg_temp.get_uuid('link_a1')");
    expect(section).toContain("P8b-r4-capture-body");
    expect(section).toContain("v_r4_capture->'currentUpdate' ? 'body'");
    expect(section).toContain("v_r4_capture->'currentUpdate'->>'body') = 'Curated-content-only publication.'");
  });

  it("the final Section R4 block consumes the captured pre-revoke result and does NOT issue a fresh get_share_link_management_state call after P9's revoke", () => {
    const r4Idx = runtimeTestSource.indexOf("record_result('R', 'R4'");
    expect(r4Idx).toBeGreaterThan(-1);
    const blockStart = runtimeTestSource.lastIndexOf("do $$", r4Idx);
    const blockEnd = runtimeTestSource.indexOf("$$;", r4Idx) + 3;
    expect(blockStart).toBeGreaterThan(-1);
    const block = runtimeTestSource.slice(blockStart, blockEnd);

    expect(block).toContain("v_result := pg_temp.get_json('r4_management_before_revoke')");
    expect(block).not.toContain("try_rpc");
    expect(block).not.toContain("select public.get_share_link_management_state");
    expect(block).not.toContain("act_as(");

    const p9Idx = runtimeTestSource.indexOf("'P', 'P9',");
    expect(p9Idx).toBeGreaterThan(-1);
    expect(p9Idx).toBeLessThan(blockStart);
  });

  it("confirms P9's revoke_share_link semantics on link_a1 are unchanged (still the deliberate last action against it)", () => {
    const p9SetupIdx = runtimeTestSource.indexOf("'P', 'P9setup'");
    expect(p9SetupIdx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(Math.max(0, p9SetupIdx - 500), p9SetupIdx + 300);
    expect(section).toContain("deliberately");
    expect(section).toContain("LAST action taken against link_a1 in this file");
    expect(section).toContain("revoke_share_link");
  });

  it("confirms reveal_share_link_secret's result recursively rejects the full private/security forbidden-key list (not just userId/projectId)", () => {
    const idx = runtimeTestSource.indexOf("v_reveal_forbidden_keys text[]");
    expect(idx).toBeGreaterThan(-1);
    const section = runtimeTestSource.slice(idx, idx + 1500);
    for (const key of ["userId", "projectId", "secret", "secretDigest", "pinHash", "pinSalt", "storagePath", "signedUrl", "rawInput", "phone", "email", "notes", "contactName", "clientName", "amount", "priority"]) {
      expect(section).toContain(`'${key}'`);
    }
    expect(section).toContain("R3b");
  });

  it("confirms reveal_share_link_secret's TOP-LEVEL key set is exactly the six-field approved contract, no extra field", () => {
    const declareIdx = runtimeTestSource.indexOf("v_expected_top_level_keys text[] := array['linkId', 'publicId', 'ciphertextHex', 'nonceHex', 'authTagHex', 'encryptionVersion']");
    expect(declareIdx).toBeGreaterThan(-1);
    const r3cIdx = runtimeTestSource.indexOf("'R3c'", declareIdx);
    expect(r3cIdx).toBeGreaterThan(declareIdx);
    const section = runtimeTestSource.slice(declareIdx, r3cIdx + 200);
    expect(section).toContain("jsonb_object_keys(v_reveal_result)");
  });
});

describe("runtime test file (03) -- owner A / owner B / unauthenticated contexts", () => {
  it("simulates owner A, owner B and an unauthenticated caller via the act_as helper and request.jwt.claims", () => {
    expect(runtimeTestSource).toContain("pg_temp.act_as(p_role text, p_user_id uuid default null)");
    expect(runtimeTestSource).toContain("set_config('request.jwt.claims'");
    expect(runtimeTestSource).toContain("act_as('authenticated', pg_temp.get_uuid('owner_a'))");
    expect(runtimeTestSource).toContain("act_as('authenticated', pg_temp.get_uuid('owner_b'))");
    expect(runtimeTestSource).toMatch(/act_as\('authenticated'\);/);
  });

  it("proves auth.uid() actually resolves correctly before any RPC test relies on it", () => {
    expect(runtimeTestSource).toContain("H-UID-A");
    expect(runtimeTestSource).toContain("H-UID-B");
    expect(runtimeTestSource).toContain("H-UID-ANON");
  });
});

describe("runtime test file (03) -- no plaintext secrets presented as real application plaintext", () => {
  it("uses clearly-labeled deterministic fake/opaque test values, never a real secret-generation call", () => {
    expect(runtimeTestSource).toContain("pg_temp.fake_hex64");
    expect(runtimeTestSource).toContain("pg_temp.fake_b64url");
    expect(runtimeTestSource).toMatch(/never a real\s*\n--\s*HMAC output/);
  });

  it("never decrypts and states so explicitly", () => {
    expect(runtimeTestSource).toContain("This SQL runtime package does not decrypt");
  });

  it("only ever references the real server-only encryption module in prose (documenting the boundary), never as an executable import", () => {
    // A .sql file cannot contain a TypeScript import statement at all;
    // this asserts the mention (if any) is confined to a `--` comment line.
    const mentionLines = runtimeTestSource
      .split("\n")
      .filter((line) => line.includes("share-secret-encryption.server"));
    expect(mentionLines.length).toBeGreaterThan(0);
    for (const line of mentionLines) {
      expect(line.trimStart().startsWith("--")).toBe(true);
    }
  });
});

describe("00_READ_ME_FIRST.md -- exact execution order, safety framing, and file inventory", () => {
  it("documents the exact run order 01, then 02, then 03 in its numbered step-by-step instructions", () => {
    const idx01 = readmeSource.indexOf("Paste and run `01_CREATE_TEMP_TEST_FIXTURE.sql`");
    const idx02 = readmeSource.indexOf("Paste and run `02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql`");
    const idx03 = readmeSource.indexOf("Paste and run `03_RUN_PHASE1B_RUNTIME_TESTS.sql`");
    expect(idx01).toBeGreaterThan(-1);
    expect(idx02).toBeGreaterThan(idx01);
    expect(idx03).toBeGreaterThan(idx02);
  });

  it("instructs never to run in Production and never to hand-edit the generated SQL", () => {
    expect(readmeSource).toMatch(/[Nn]ever run/);
    expect(readmeSource.toLowerCase()).toContain("production");
    expect(readmeSource).toContain("Do not edit the generated SQL");
  });

  it("instructs to stop immediately on an unexpected error", () => {
    expect(readmeSource).toMatch(/[Ss]top immediately/);
  });

  it("lists build-phase1b-runtime-package.test.ts in its file-inventory table", () => {
    expect(readmeSource).toContain("build-phase1b-runtime-package.test.ts");
  });

  it("references the required public result column names", () => {
    expect(readmeSource).toContain("test_number");
    expect(readmeSource).toContain("test_name");
  });
});

describe("05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md -- explicit guard", () => {
  it("exists and is prominent about not authorizing Production application", () => {
    expect(notAuthorizedSource).toContain("Not Authorized");
    expect(notAuthorizedSource).toMatch(/does \*{0,2}not\*{0,2} authorize applying/i);
  });

  it("names all seven authoritative migrations", () => {
    for (const name of EXPECTED_MIGRATION_ORDER) {
      expect(notAuthorizedSource).toContain(name);
    }
  });

  it("contains no Production application command of any kind", () => {
    for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
      expect(notAuthorizedSource).not.toMatch(pattern);
    }
  });
});

describe("MANIFEST.md -- mechanically regenerated, covers every package file, no wall-clock content", () => {
  it("lists all ten approved files by name", () => {
    const expectedNames = [
      "00_READ_ME_FIRST.md",
      "01_CREATE_TEMP_TEST_FIXTURE.sql",
      "02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql",
      "03_RUN_PHASE1B_RUNTIME_TESTS.sql",
      "04_CAPTURE_RESULTS.md",
      "05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md",
      "MANIFEST.md",
      "TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_RUNTIME_VERIFICATION_REPORT.md",
      "build-phase1b-runtime-package.ps1",
      "build-phase1b-runtime-package.test.ts",
    ];
    for (const name of expectedNames) {
      expect(manifestSource).toContain(name);
    }
  });

  it("distinguishes generated files (file 02, MANIFEST.md itself) from every hand-authored file", () => {
    expect(manifestSource).toMatch(/02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT\.sql`[^\n]*\*\*generated\*\*/);
    expect(manifestSource).toMatch(/MANIFEST\.md`[^\n]*\*\*generated\*\*/);
    expect(manifestSource).toMatch(/00_READ_ME_FIRST\.md`[^\n]*hand-authored/);
    expect(manifestSource).toMatch(/build-phase1b-runtime-package\.test\.ts`[^\n]*hand-authored/);
  });

  it("explicitly documents why MANIFEST.md's own hash is not embedded in itself", () => {
    expect(manifestSource).toContain("Why row 8 has no embedded hash");
    expect(manifestSource).toContain("no fixed point");
    expect(manifestSource).toContain("prints that value to");
    expect(manifestSource).toContain("MANIFEST_SHA256=");
  });

  it("contains no wall-clock timestamp, build number, or 'Generated: <date>' line", () => {
    expect(manifestSource).not.toMatch(/Generated:\s*\d{4}-\d{2}-\d{2}/);
    expect(manifestSource).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    expect(manifestSource.toLowerCase()).toContain("no wall-clock");
  });

  it("lists a SHA-256 hash for all seven source migrations", () => {
    for (const name of EXPECTED_MIGRATION_ORDER) {
      expect(manifestSource).toContain(name);
    }
    const hashMatches = manifestSource.match(/`[0-9a-f]{64}`/g) ?? [];
    expect(hashMatches.length).toBeGreaterThanOrEqual(EXPECTED_MIGRATION_ORDER.length);
  });

  it("the seven listed source migration hashes exactly match freshly-computed SHA-256 values of the actual current migration files", () => {
    for (const name of EXPECTED_MIGRATION_ORDER) {
      const sourceContent = readNormalized(path.join(MIGRATIONS_DIR, name));
      const expectedHash = sha256(sourceContent);
      expect(manifestSource).toContain(`\`${expectedHash}\``);
    }
  });

  it("the generated apply bundle's hash listed in MANIFEST.md exactly matches a freshly-computed SHA-256 of the actual bundle file", () => {
    const expectedHash = sha256(bundleSource);
    expect(manifestSource).toContain(`\`${expectedHash}\``);
  });

  it("references the reproduction command", () => {
    expect(manifestSource).toContain("powershell -File scripts/client-share/build-phase1b-runtime-package.ps1");
  });
});

describe("MANIFEST.md -- mechanical freshness proof (this is what catches a forgotten generator re-run)", () => {
  // The nine non-MANIFEST package files MANIFEST.md must list a current
  // hash for, mapped to how to compute each one's actual current SHA-256
  // using the exact same LF-normalization convention the generator uses.
  const NINE_FILES: Record<string, string> = {
    "TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1B_RUNTIME_VERIFICATION_REPORT.md": reportSource,
    "00_READ_ME_FIRST.md": readmeSource,
    "01_CREATE_TEMP_TEST_FIXTURE.sql": fixtureSource,
    "02_APPLY_PHASE1A_AND_PHASE1B_TO_TEMP_PROJECT.sql": bundleSource,
    "03_RUN_PHASE1B_RUNTIME_TESTS.sql": runtimeTestSource,
    "04_CAPTURE_RESULTS.md": readNormalized(path.join(PACKAGE_DIR, "04_CAPTURE_RESULTS.md")),
    "05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md": notAuthorizedSource,
    "build-phase1b-runtime-package.ps1": generatorSource,
    // Read live: this test file's own current content, at test-run time --
    // this is precisely the file whose staleness this correction pass was
    // triggered by (the generator was not re-run after the final static
    // test edit in the prior pass).
    "build-phase1b-runtime-package.test.ts": readNormalized(path.join(__dirname, "build-phase1b-runtime-package.test.ts")),
  };

  // Parse ONLY the "## Package files" table (rows of the shape
  // | # | `name` | origin | `hash` or *(placeholder)* |) -- deliberately
  // scoped to that section alone so the later, differently-shaped
  // "## Source migration hashes" 3-cell table can never be mismatched
  // into these results.
  function parseManifestTable(source: string): Map<string, string | null> {
    const result = new Map<string, string | null>();
    const startMarker = "## Package files";
    const startIdx = source.indexOf(startMarker);
    if (startIdx === -1) {
      return result;
    }
    const nextSectionIdx = source.indexOf("\n## ", startIdx + startMarker.length);
    const tableSection = source.slice(startIdx, nextSectionIdx === -1 ? source.length : nextSectionIdx);
    const rowPattern = /^\|\s*\d+\s*\|\s*`([^`]+)`\s*\|[^|]*\|\s*(.+?)\s*\|\s*$/gm;
    let match: RegExpExecArray | null;
    while ((match = rowPattern.exec(tableSection)) !== null) {
      const [, name, hashField] = match;
      const hashMatch = hashField.match(/`([0-9a-f]{64})`/);
      result.set(name, hashMatch ? hashMatch[1] : null);
    }
    return result;
  }

  const manifestTable = parseManifestTable(manifestSource);

  it("the manifest table has a parseable row for every one of the nine non-MANIFEST files plus MANIFEST.md itself (exactly ten rows, none missing)", () => {
    expect(manifestTable.size).toBe(10);
    for (const name of Object.keys(NINE_FILES)) {
      expect(manifestTable.has(name)).toBe(true);
    }
    expect(manifestTable.has("MANIFEST.md")).toBe(true);
  });

  it("has no extra hashed package-file row beyond the ten approved files", () => {
    const approvedNames = new Set([...Object.keys(NINE_FILES), "MANIFEST.md"]);
    for (const name of manifestTable.keys()) {
      expect(approvedNames.has(name)).toBe(true);
    }
  });

  it("MANIFEST.md's own row is the documented self-hash exception (no 64-hex-char hash), and every other row has a well-formed 64-lowercase-hex hash", () => {
    expect(manifestTable.get("MANIFEST.md")).toBeNull();
    for (const name of Object.keys(NINE_FILES)) {
      const hash = manifestTable.get(name);
      expect(hash).not.toBeNull();
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it.each(Object.entries(NINE_FILES))(
    "the MANIFEST hash for %s exactly equals a freshly-computed SHA-256 of the actual current file (catches a stale MANIFEST after any later edit)",
    (name, content) => {
      const actualHash = sha256(content);
      const manifestHash = manifestTable.get(name);
      expect(manifestHash).toBe(actualHash);
    }
  );
});

describe("verification report -- final PHASE_1B_RUNTIME_VERIFIED_PASS status, with the historical 518/510/8 run retained and clearly labelled historical", () => {
  it("declares the exact final status PHASE_1B_RUNTIME_VERIFIED_PASS, not either superseded status", () => {
    expect(reportSource).toContain("**Status: `PHASE_1B_RUNTIME_VERIFIED_PASS`**");
    expect(reportSource).not.toContain("**Status: `AWAITING_FRESH_TEMP_PROJECT_RUNTIME_RETEST`**");
    expect(reportSource).not.toContain("**Status: `AWAITING_TEMP_PROJECT_RUNTIME_EXECUTION`**");
  });

  it("the report never simultaneously claims AWAITING_FRESH_TEMP_PROJECT_RUNTIME_RETEST and PHASE_1B_RUNTIME_VERIFIED_PASS as its current status (regression guard against a contradictory status)", () => {
    const hasVerifiedPass = reportSource.includes("**Status: `PHASE_1B_RUNTIME_VERIFIED_PASS`**");
    const hasAwaitingRetest = reportSource.includes("**Status: `AWAITING_FRESH_TEMP_PROJECT_RUNTIME_RETEST`**");
    expect(hasVerifiedPass).toBe(true);
    expect(hasAwaitingRetest).toBe(false);
  });

  it("records the historical first complete runtime result (518 total, 510 PASS, 8 FAIL) and the four independent root causes found, explicitly labelled historical/superseded", () => {
    expect(reportSource).toContain("Historical first complete runtime (superseded, kept for record)");
    expect(reportSource).toContain("518 runtime assertions");
    expect(reportSource).toContain("510 PASS, 8 FAIL");
    expect(reportSource).toContain("four independent causes");
  });

  it("records the final fresh-project retest result (520 total, 520 PASS, 0 FAIL, PHASE_1B_RUNTIME_PASS) as the current, authoritative outcome", () => {
    expect(reportSource).toContain("Final fresh-project retest (current, authoritative)");
    expect(reportSource).toContain("total_tests    = 520");
    expect(reportSource).toContain("passed_tests   = 520");
    expect(reportSource).toContain("failed_tests   = 0");
    expect(reportSource).toContain("runtime_status = PHASE_1B_RUNTIME_PASS");
  });

  it("explains why the final retest required a genuinely fresh disposable project (the project that produced the historical 8-failure result still had the pre-correction schema/RPC bodies baked into its live database)", () => {
    expect(reportSource).toContain("fresh disposable Supabase");
    expect(reportSource).toContain("whose live schema and RPC bodies still");
    expect(reportSource).toContain("reflected the pre-correction migrations");
  });

  it("explicitly confirms Production was never touched and remains not authorized by this PASS result", () => {
    expect(reportSource).toContain("No Client Share migration has ever been applied to Production");
    expect(reportSource).toContain("Production application remains NOT AUTHORIZED");
    expect(reportSource).toContain("This runtime PASS does not itself authorize Production");
  });

  it("documents known limitations: concurrency, no decryption, no Production authorization, no public flow yet, and the Resource deleted/unavailable N/A case", () => {
    expect(reportSource.toLowerCase()).toContain("concurrent");
    expect(reportSource).toContain("never decrypts");
    expect(reportSource).toMatch(/Production application is not authorized/);
    expect(reportSource.toLowerCase()).toContain("phase 3");
    expect(reportSource).toContain("No deleted/unavailable Resource sub-case is simulated");
  });

  it("does not assert a precise pre-execution total-check count; the authoritative count is total_tests at runtime", () => {
    expect(reportSource).toMatch(/is \*{0,2}not\*{0,2} the\s*\n?\s*authoritative check count/);
    expect(reportSource).toContain("does not assert a precise pre-execution number");
  });

  it("references the required public result column names", () => {
    expect(reportSource).toContain("test_number");
    expect(reportSource).toContain("test_name");
  });

  it("names all seven authoritative migrations in order in the '## Authoritative migrations' section (incidental earlier mentions of a migration name, e.g. in the status summary, are not part of this ordered list)", () => {
    const sectionIdx = reportSource.indexOf("## Authoritative migrations");
    expect(sectionIdx).toBeGreaterThan(-1);
    const nextSectionIdx = reportSource.indexOf("\n## ", sectionIdx + 1);
    const section = reportSource.slice(sectionIdx, nextSectionIdx === -1 ? undefined : nextSectionIdx);
    let cursor = -1;
    for (const name of EXPECTED_MIGRATION_ORDER) {
      const idx = section.indexOf(name);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("describes the true post-retirement rollback scenario (O5) distinctly from the four pre-validation scenarios", () => {
    expect(reportSource).toContain("true post-retirement");
    expect(reportSource).toContain("test-only");
  });

  it("describes the recursive safe-output inspection and the targeted projectId handling", () => {
    expect(reportSource.toLowerCase()).toContain("recursive");
    expect(reportSource).toContain("projectId");
  });
});
