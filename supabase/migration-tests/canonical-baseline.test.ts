import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const evidenceRoot = path.join(
  repoRoot,
  "docs",
  "database",
  "production-baseline-evidence",
);
const canonicalRoot = path.join(evidenceRoot, "canonical-migrations");
const activeMigrationRoot = path.join(repoRoot, "supabase", "migrations");
const archiveRoot = path.join(
  repoRoot,
  "docs",
  "database",
  "migration-archive",
  "precanonical-2026-09-04",
);

function readText(...parts: string[]) {
  return readFileSync(path.join(...parts), "utf8");
}

function sha256(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function activeClosure() {
  return readText(
    activeMigrationRoot,
    "202609040001_canonical_production_closure.sql",
  );
}

function activeAnchor() {
  return readText(activeMigrationRoot, "20260615222035_remote_schema.sql");
}

function grantLinesFor(closure: string, fragment: string) {
  return closure
    .split(/\r?\n/)
    .filter((line) => /^\s*grant\b/i.test(line))
    .filter((line) => line.includes(fragment));
}

describe("canonical Supabase baseline evidence", () => {
  it("keeps exactly the two canonical SQL migrations active", () => {
    expect(
      readdirSync(activeMigrationRoot)
        .filter((name) => name.endsWith(".sql"))
        .sort(),
    ).toEqual([
      "20260615222035_remote_schema.sql",
      "202609040001_canonical_production_closure.sql",
    ]);
  });

  it("pins the verified anchor and closure hashes", () => {
    const manifest = JSON.parse(
      readText(evidenceRoot, "canonical-artifact-manifest.json"),
    );

    expect(manifest.canonical_hashes_ok).toBe(true);
    expect(
      sha256(path.join(activeMigrationRoot, "20260615222035_remote_schema.sql")),
    ).toBe("9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991");
    expect(
      sha256(
        path.join(
          activeMigrationRoot,
          "202609040001_canonical_production_closure.sql",
        ),
      ),
    ).toBe("13a7aa8d12b8a6685e38fa13b4e53c2fdfc499c030201500ec2564789f70c830");
    expect(
      sha256(path.join(canonicalRoot, "20260615222035_remote_schema.sql")),
    ).toBe("9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991");
    expect(
      sha256(
        path.join(
          canonicalRoot,
          "202609040001_canonical_production_closure.sql",
        ),
      ),
    ).toBe("13a7aa8d12b8a6685e38fa13b4e53c2fdfc499c030201500ec2564789f70c830");
  });

  it("records a verified M4C parity result without raw snapshots", () => {
    const summary = JSON.parse(readText(evidenceRoot, "m4c-parity-summary.json"));

    expect(summary.final_status).toBe("PASS");
    expect(summary.canonical_rebuild_status).toBe("VERIFIED");
    expect(summary.application_drift).toBe(0);
    expect(summary.security_gates).toEqual({ passed: 15, total: 15 });
    expect(summary.structural_counts.foreign_keys).toEqual({
      production: 86,
      staging: 86,
    });
    expect(summary.structural_counts.check_constraints).toEqual({
      production: 174,
      staging: 174,
    });
    expect(summary.structural_counts.grants).toEqual({
      production: 166,
      staging: 166,
    });
    expect(summary.prior_drift_resolution).toMatchObject({
      prior_drifts: 298,
      resolved: 298,
      still_present: 0,
      changed: 0,
      new_drifts: 0,
    });
    expect(
      readdirSync(evidenceRoot).some((name) =>
        /^production_schema_snapshot_.*\.json$/.test(name),
      ),
    ).toBe(false);
  });

  it("preserves the 57 pre-canonical SQL migrations byte-for-byte", () => {
    const manifest = JSON.parse(readText(archiveRoot, "archive-manifest.json"));

    expect(manifest.historical_sql_migrations).toBe(57);
    expect(manifest.archived_sql_migrations).toBe(57);
    expect(manifest.missing_from_archive).toEqual([]);
    expect(manifest.hash_mismatches).toEqual([]);
    expect(manifest.duplicate_versions).toEqual([]);
  });

  it("preserves the 22 pre-canonical migration tests in the archive", () => {
    expect(
      readdirSync(path.join(archiveRoot, "tests"))
        .filter((name) => name.endsWith(".test.ts"))
        .sort(),
    ).toHaveLength(22);
  });

  it("keeps generated-column semantics canonical", () => {
    const closure = activeClosure();

    expect(closure).toMatch(
      /"share_link_key"\s+text\s+not\s+null\s+generated\s+always\s+as\s+\(coalesce\(share_link_id::text,\s*'-'\)\)\s+stored/i,
    );
    expect(closure).not.toMatch(/"share_link_key"[\s\S]{0,120}\bdefault\b/i);
  });

  it("keeps the three corrected CHECK constraints in the canonical closure", () => {
    const closure = activeClosure();

    expect(closure).toMatch(/drop constraint "project_update_items_type_check"/i);
    expect(closure).toMatch(
      /add constraint "project_update_items_type_check"[\s\S]*needs_review/i,
    );
    expect(closure).toMatch(/drop constraint "project_updates_source_type_check"/i);
    expect(closure).toMatch(
      /add constraint "project_updates_source_type_check"[\s\S]*client_share/i,
    );
    expect(closure).toMatch(/drop constraint "project_updates_status_check"/i);
    expect(closure).toMatch(
      /add constraint "project_updates_status_check"[\s\S]*applying/i,
    );
  });

  it("keeps canonical PK and UNIQUE additions before canonical FK additions", () => {
    const closure = activeClosure();
    const firstForeignKey = closure.search(/add constraint .* FOREIGN KEY/i);
    const lastPrimaryKeyOrUnique = Math.max(
      ...[...closure.matchAll(/add constraint .* PRIMARY KEY/gi)].map(
        (match) => match.index ?? -1,
      ),
      ...[...closure.matchAll(/add constraint .* UNIQUE/gi)].map(
        (match) => match.index ?? -1,
      ),
    );

    expect((activeAnchor().match(/add constraint .* FOREIGN KEY/gi) ?? []))
      .toHaveLength(36);
    expect((closure.match(/add constraint .* FOREIGN KEY/gi) ?? []))
      .toHaveLength(50);
    expect(firstForeignKey).toBeGreaterThan(lastPrimaryKeyOrUnique);
  });

  it("locks down PUBLIC rendering and privilege finalization", () => {
    const closure = activeClosure();

    expect(closure).not.toContain('"PUBLIC"');
    expect(closure).toMatch(/\bfrom PUBLIC\b/i);
    expect(closure).toMatch(/\bto PUBLIC\b/i);
    expect(closure.match(/\brevoke all privileges on\b/gi)?.length).toBe(476);
    expect(closure.match(/\bgrant\b[\s\S]*?\bto\b/gi)?.length).toBeGreaterThanOrEqual(
      166,
    );
  });

  it("keeps Homepage Demo tables service-role-only at the direct grant layer", () => {
    const closure = activeClosure();
    const homepageGrantLines = grantLinesFor(
      closure,
      'on table "public"."homepage_demo_',
    );

    expect(homepageGrantLines).toHaveLength(11);
    for (const line of homepageGrantLines) {
      expect(line).toMatch(/\bto "service_role";$/i);
      expect(line).not.toMatch(/\bto "(?:anon|authenticated)";$/i);
      expect(line).not.toMatch(/\bto PUBLIC;$/i);
    }
  });

  it("keeps sensitive Homepage Demo RPCs service-role-only", () => {
    const closure = activeClosure();

    for (const fn of [
      "claim_homepage_demo_project_v2",
      "claim_homepage_demo_project_with_duplicate_override_v2",
      "prepare_homepage_demo_claim_auth_continuation",
      "prepare_homepage_demo_duplicate_override_v2",
    ]) {
      const grantLines = closure
        .split(/\r?\n/)
        .filter(
          (line) =>
            line.includes(`grant execute on function "public"."${fn}"`) ||
            line.includes(`grant all privileges on function "public"."${fn}"`),
        );

      expect(grantLines).toHaveLength(1);
      expect(grantLines[0]).toMatch(/\bto "service_role";$/i);
      expect(grantLines[0]).not.toMatch(/\bto "(?:anon|authenticated)";$/i);
      expect(grantLines[0]).not.toMatch(/\bto PUBLIC;$/i);
    }
  });

  it("keeps owner/admin RPCs service-role-only", () => {
    const closure = activeClosure();

    for (const fn of [
      "get_owner_authenticated_activity_summary",
      "get_owner_product_activation_analytics",
      "get_owner_user_activity_report",
      "get_owner_user_activity_timeline",
    ]) {
      const grantLines = grantLinesFor(
        closure,
        `grant execute on function "public"."${fn}"`,
      );

      expect(grantLines).toHaveLength(1);
      expect(grantLines[0]).toMatch(/\bto "service_role";$/i);
    }
  });

  it("keeps Client Share owner RPCs off PUBLIC and anon", () => {
    const closure = activeClosure();

    for (const fn of [
      "activate_share_link",
      "apply_project_update_transaction",
      "disable_share_link",
      "finalize_share_message_conversion",
      "reenable_share_link",
      "reveal_share_link_secret",
      "revoke_share_link",
      "rotate_share_link_secret",
      "send_share_message_reply",
    ]) {
      const grantLines = grantLinesFor(
        closure,
        `grant execute on function "public"."${fn}"`,
      );

      expect(grantLines.length).toBeGreaterThanOrEqual(1);
      for (const line of grantLines) {
        expect(line).not.toMatch(/\bto "anon";$/i);
        expect(line).not.toMatch(/\bto PUBLIC;$/i);
      }
    }
  });

  it("keeps Client Share secret material without direct grants", () => {
    const closure = activeClosure();

    expect(closure).toMatch(
      /revoke all privileges on table "public"\."project_share_secret_material" from PUBLIC;/i,
    );
    expect(closure).toMatch(
      /revoke all privileges on table "public"\."project_share_secret_material" from "anon";/i,
    );
    expect(closure).toMatch(
      /revoke all privileges on table "public"\."project_share_secret_material" from "authenticated";/i,
    );
    expect(closure).toMatch(
      /revoke all privileges on table "public"\."project_share_secret_material" from "service_role";/i,
    );
    const grantLines = closure
      .split(/\r?\n/)
      .filter((line) =>
        line.includes('on table "public"."project_share_secret_material"'),
      )
      .filter((line) => /^\s*grant\b/i.test(line));

    expect(grantLines).toEqual([]);
  });

  it("keeps storage configuration and policies in the canonical closure", () => {
    const closure = activeClosure();

    expect(closure).toMatch(/'task-resources'/);
    expect(closure).toMatch(/10485760/);
    expect(closure.match(/create policy "Users can .* task resource files"/gi))
      .toHaveLength(4);
  });

  it("keeps RLS expectations represented", () => {
    const closure = activeClosure();

    expect(closure.match(/enable row level security/gi)?.length).toBe(42);
  });

  it("does not recreate platform-owned auth or storage tables", () => {
    const closure = activeClosure();

    expect(closure).not.toMatch(/create\s+table\s+(?:if\s+not\s+exists\s+)?"?auth"?\./i);
    expect(closure).not.toMatch(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?"?storage"?\."?(?:buckets|objects)"?/i,
    );
    expect(closure).not.toMatch(/alter\s+default\s+privileges/i);
  });

  it("gives every SECURITY DEFINER function an explicit search_path", () => {
    const closure = activeClosure();
    const definerDeclarations = [
      ...closure.matchAll(/^\s*security definer\s*$/gim),
    ];

    expect(definerDeclarations).toHaveLength(21);
    for (const declaration of definerDeclarations) {
      expect(closure.slice(declaration.index, declaration.index + 120))
        .toMatch(/\n\s*set search_path\s*(?:=|to)\s*/i);
    }
  });

  it("records verified cron parity as operational evidence", () => {
    const summary = JSON.parse(readText(evidenceRoot, "m4c-parity-summary.json"));

    expect(summary.cron_status).toBe("VERIFIED");
    expect(summary.cron_evidence).toMatchObject({
      job: "homepage-demo-maintenance-v1",
      schedule: "*/5 * * * *",
      command: "select * from public.run_homepage_demo_maintenance(1000);",
      active: true,
      database: "postgres",
      username: "postgres",
      duplicate_homepage_demo_maintenance_jobs: 0,
      recent_runs_inspected: 10,
      recent_successes: 10,
      recent_failures: 0,
      latest_status: "succeeded",
    });
  });

  it("documents local metadata exclusion rules", () => {
    const gitignore = readText(repoRoot, ".gitignore");

    expect(gitignore).toContain("supabase/.temp/");
    expect(gitignore).toContain(".claude/");
    expect(gitignore).toContain("linked-project.json");
    expect(gitignore).toContain("pooler-url");
  });
});
