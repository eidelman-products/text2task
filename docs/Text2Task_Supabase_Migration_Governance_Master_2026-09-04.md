# Text2Task Supabase Migration Governance Master Handoff

Date: 2026-09-04

Scope: **READ-ONLY FORENSIC AUDIT / EVIDENCE COLLECTION.**

Companion file: `Text2Task_Supabase_Migration_Governance_Master_2026-09-04.docx`

This document records the Phase M2 production migration-history and schema-evidence audit for Text2Task. It is intentionally separate from the Live Demo conversion handoff because the migration-history mismatch predates the Live Demo work and affects future database governance across the project.

## 1. Executive Decision

Status: **MORE EVIDENCE REQUIRED FOR MIGRATION-HISTORY RECONCILIATION.**

Live Demo app rollout status: **PAUSED BEFORE APP PUSH.**

The production schema change from `202609030001_homepage_demo_claim_auth_continuation.sql` has already been manually applied by the user through the Supabase SQL Editor and independently verified with all 13 post-migration checks passing. Old production app + new production DB smoke testing also passed.

However, Supabase migration history is not aligned with the repository. The remote migration history reports only one remote-only version, `20260615222035`, while all 57 local SQL migrations are reported as local-only, including the manually applied `202609030001` migration. Therefore no truthful migration-history repair or `db push` action should be taken during the Live Demo rollout.

## 2. Hard Safety Boundaries

During this M2 audit:

- No production schema changes were made.
- No migration repair was run.
- No `supabase db push` was run.
- No `supabase db pull` was run.
- No `supabase db reset` was run.
- No destructive SQL was run.
- No files were staged.
- No commit was created.
- No push or deploy was run.
- No application code was modified.

## 3. Evidence Artifacts

Temporary audit directory outside the repository:

```text
C:\Users\Home\AppData\Local\Temp\text2task-supabase-migration-audit
```

Files created there:

```text
local_migration_inventory.csv
remote_migration_list.json
remote_migration_list.stderr.txt
production_public_schema.sql
```

Important limitation: `production_public_schema.sql` is zero bytes because `supabase db dump --linked --schema public` failed before producing a schema dump. It must not be treated as production schema evidence.

## 4. Remote Migration History Evidence

Command used:

```text
npx.cmd supabase@latest migration list --linked
```

Observed result:

```text
Remote history contains: 20260615222035
Remote-only migration: 20260615222035
Local-only migrations: all 57 local SQL migration versions from 202605250001 through 202609030001
Current migration 202609030001: local-only in migration history despite schema-level manual production application
```

This confirms that manual execution in the Supabase SQL Editor did not record `202609030001` in Supabase migration history.

## 5. Production Schema Dump Attempt

Command attempted:

```text
npx.cmd supabase@latest db dump --linked --schema public --file "%TEMP%\text2task-supabase-migration-audit\production_public_schema.sql"
```

Result:

```text
FAILED: Supabase CLI attempted to inspect Docker image through Docker Desktop Linux engine.
Docker engine was unavailable at npipe:////./pipe/dockerDesktopLinuxEngine.
The output schema file exists but is zero bytes.
```

Additional environment check:

```text
where.exe pg_dump
```

Result:

```text
pg_dump was not found on PATH.
```

Conclusion: this environment could not produce a reliable production schema-only dump. A future audit must rerun schema export from an environment with Docker Desktop Linux engine running or with a compatible `pg_dump` available and a safe read-only connection procedure.

## 6. Local Migration Inventory

Local migration folder:

```text
supabase/migrations
```

Observed SQL migration count:

```text
57
```

Observed migration range:

```text
202605250001_project_update_engine.sql
through
202609030001_homepage_demo_claim_auth_continuation.sql
```

No duplicate local SQL migration timestamp was observed during the M1/M2 inspection.

## 7. Clean-Rebuild Finding

The local migration chain is not proven to rebuild production from an empty database.

Evidence:

```text
supabase/migrations/202605250001_project_update_engine.sql
```

The first local migration creates `public.project_updates`, `public.project_update_items`, and `public.project_timeline_events`, but immediately references pre-existing base tables:

```text
auth.users
public.projects
public.clients
public.tasks
```

Later migrations continue to reference and alter those base tables, including `public.users`. Therefore the repository migration folder appears to start after an earlier production baseline, not at full database genesis.

## 8. Remote-Only Migration Search

Remote-only version searched:

```text
20260615222035
```

Git-history search result:

```text
No local migration file named 20260615222035 was found in the current tree.
No deleted local migration file named 20260615222035 was found in inspected git history.
The only matched history context was the original repository commit / existing schema artifact names, not a recovered migration body for 20260615222035.
```

Conclusion: M2 did not recover the SQL body or concrete effects of remote-only migration `20260615222035`.

## 9. Current Live Demo Migration Evidence

Current migration:

```text
supabase/migrations/202609030001_homepage_demo_claim_auth_continuation.sql
```

Static local effect summary:

```text
Table altered: public.homepage_demo_claims
Columns added:
- auth_continuation_token_hash
- auth_continuation_started_at
- auth_continuation_expires_at
- auth_continuation_consumed_at

Indexes added:
- homepage_demo_claims_auth_continuation_token_hash_unique_idx
- homepage_demo_claims_pending_auth_continuation_expiry_idx

New/replaced v2 RPCs/functions:
- public.prepare_homepage_demo_claim_auth_continuation
- public.claim_homepage_demo_project_v2
- public.prepare_homepage_demo_duplicate_override_v2
- public.claim_homepage_demo_project_with_duplicate_override_v2

Maintenance/cleanup functions replaced:
- public.purge_expired_homepage_demo_trials
- public.purge_homepage_demo_retention
```

Privilege posture summary:

```text
No direct anon/authenticated/public table grants were added.
Homepage Demo table access remains service-role oriented.
Function execute grants are service-role only for the new v2/continuation and maintenance functions.
Old RPC names are preserved in local migration history.
Raw continuation tokens are not persisted; only SHA-256 token hashes are stored.
```

Production status from user-run verification:

```text
202609030001 schema manually applied in production
13/13 post-migration DB verification checks PASS
Old production app + New production DB smoke test PASS
```

## 10. Supabase Link Metadata

`supabase link` introduced local metadata under:

```text
supabase/.temp/
```

Observed files:

```text
cli-latest
gotrue-version
linked-project.json
pooler-url
postgres-version
project-ref
rest-version
storage-migration
storage-version
```

Commit rule:

```text
Do not commit supabase/.temp/
Do not commit project-ref/link/cache metadata.
Do not print or copy connection URLs, pooler URLs, passwords, tokens, or production credentials into repository docs.
```

No committed `supabase/config.toml` was found.

## 11. Automatic DB Push Risk

Repository inspection found:

```text
No package script runs Supabase migrations.
No package script runs supabase db push.
No .github workflow directory exists.
No vercel.json exists.
No committed supabase/config.toml exists.
```

The only `supabase db push` references found are documentation/runtime-package comments and handoff warnings, not executable push/deploy automation.

Conclusion: no repo-local automated workflow was found that would run `supabase db push` during `git push` or Vercel app deployment. A Vercel Git integration may still auto-deploy application code after a push to `main`, but this repository does not contain evidence that such an app deploy would apply Supabase migrations.

## 12. Why Not Repair Now

Do not run:

```text
supabase migration repair
supabase db push
manual inserts into supabase_migrations.schema_migrations
```

Reason: the remote history mismatch is historical and broad. Marking local migrations as applied without proving that production schema exactly matches their cumulative effects could make migration history look clean while hiding real divergence.

The current Live Demo migration is schema-applied and verified, but the repository's overall local migration chain is not proven equivalent to production.

## 13. Future Reconciliation Procedure

Recommended future maintenance path:

1. Export a trusted schema-only production snapshot from a machine with Docker/`pg_dump` available.
2. Save the export outside the repository unless explicitly approved for a redacted artifact.
3. Recover or identify the effects of remote-only migration `20260615222035`.
4. Build a migration-to-production crosswalk object-by-object:
   - tables
   - columns
   - constraints
   - indexes
   - triggers
   - functions/RPCs
   - RLS enablement and policies
   - grants/revokes
   - extensions
5. Rebuild the local migration chain in an isolated scratch project or branch, never production.
6. Compare scratch schema against production schema.
7. Only after object-level equivalence is proven, choose one deliberate baseline/reconciliation strategy.
8. Document the chosen strategy and exact commands before execution.

## 14. Rollout Gate

Live Demo app rollout should remain paused until the rollout owner intentionally accepts the migration-history risk or completes the future reconciliation work.

Minimum facts already favorable to app rollout:

```text
Current production migration schema is applied.
13/13 DB verification passed.
Old app + new DB smoke test passed.
No repo automation was found that would run db push during deploy.
```

Blocking governance uncertainty:

```text
Production migration history remains broadly out of sync.
Current migration 202609030001 remains unrecorded in remote migration history.
Production schema dump could not be collected in this environment.
Remote-only 20260615222035 body/effects were not recovered.
Clean rebuild from local migrations is not proven.
```

## 15. M2 Final Report

### A. Audit Result

Read-only evidence collection completed with limitations. Migration-history reconciliation is **not ready**.

### B. Production Access / Mutation Status

No production mutation was performed by Codex in M2. Read-only Supabase CLI migration-list metadata was collected.

### C. Remote Migration History

Remote migration history reports only `20260615222035` as remote-applied. All local SQL migrations, including `202609030001`, appear local-only.

### D. Local Migration History

The repository contains 57 local SQL migrations under `supabase/migrations`.

### E. Current Migration Status

`202609030001_homepage_demo_claim_auth_continuation.sql` is schema-applied in production according to user-run verification, but it is not recorded in Supabase migration history.

### F. Production Schema Evidence

Production schema-only dump was attempted but not captured because the Supabase CLI dump path required Docker and Docker Desktop Linux engine was unavailable. `pg_dump` was not on PATH.

### G. Local Migration Effects

Local migration inventory was exported to the temp audit directory as `local_migration_inventory.csv`.

### H. Remote-Only Migration

`20260615222035` remains remote-only. Its SQL body/effects were not recovered in M2.

### I. Clean Rebuild Feasibility

Not proven. The first local migration depends on pre-existing base tables such as `public.projects`, `public.clients`, `public.tasks`, and `auth.users`.

### J. Workflow / CI Risk

No repo-local workflow or package script was found that runs Supabase migrations or `supabase db push`.

### K. Link Metadata Risk

`supabase/.temp/` exists and must not be committed. It contains local link/cache metadata including project-ref and pooler-url files.

### L. Secret / Credential Handling

No credentials were added to this governance handoff. Project ref, pooler URL, database passwords, access tokens, and production credentials must remain out of tracked files.

### M. Repair Recommendation

Do not run migration repair now. Do not run `supabase db push` now.

### N. Reconciliation Recommendation

Treat reconciliation as a separate maintenance milestone requiring a trusted production schema dump and scratch rebuild.

### O. Live Demo Rollout Recommendation

Default recommendation: **PAUSE APP ROLLOUT** pending owner decision, because M2 did not prove full production/local migration-history safety.

### P. Files Intentionally Changed By M2

```text
docs/Text2Task_Supabase_Migration_Governance_Master_2026-09-04.md
docs/Text2Task_Supabase_Migration_Governance_Master_2026-09-04.docx
docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.md
docs/Text2Task_Live_Demo_Conversion_Master_Handoff_2026-09-03.docx
```

### Q. Files That Must Not Be Included In Any Commit

```text
supabase/.temp/
.claude/
any project-ref/link/cache metadata
any database password, access token, connection URI, or production credential
```

### R. Final Go / No-Go

Migration-history reconciliation: **NO-GO**.

`supabase db push`: **NO-GO**.

Live Demo app rollout: **PAUSE / OWNER DECISION REQUIRED**.

Committing the already completed Live Demo conversion work plus these governance docs can be considered separately, but only if `supabase/.temp/`, `.claude/`, and all credentials/link metadata remain excluded.

## 16. M3 -- Canonical Production Schema Snapshot

Date: 2026-09-04

Status: **SNAPSHOT SQL PRODUCED / USER-RUN PRODUCTION SNAPSHOT SUCCEEDED**

M3 replaced the failed Docker-dependent Supabase CLI schema dump path with a read-only PostgreSQL catalog snapshot query. Docker was not introduced because M2 proved `supabase db dump` required Docker Desktop Linux engine in this environment, and the M3 brief explicitly prohibited adding Docker merely as an audit workaround.

The M3 query used catalog inspection only and returned one JSON result containing public schema tables, columns, constraints, indexes, functions, triggers, policies, effective grants, extensions, sequences, comments with security/lifecycle terms, and migration-history metadata. Function definitions matching conservative possible-secret patterns were redacted in the snapshot output and listed in `function_secret_review`.

Production changes made by M3: **NONE**.

## 17. M3B -- Evidence Normalization And Completeness Audit

Date: 2026-09-04

Status: **MORE EVIDENCE REQUIRED**

### 17.1 Snapshot Validation

The exported production snapshot was recovered locally from:

```text
%TEMP%\text2task-supabase-migration-audit\production_schema_snapshot_m3.json
```

Validated snapshot version:

```text
text2task-production-schema-snapshot-m3-2026-09-04
```

Actual counts from the JSON:

```text
tables: 42
columns: 605
constraints: 329
indexes: 212
types: 0
functions: 76
function_secret_review: 11
triggers: 36
policies: 57
grants: 166
extensions: 6
sequences: 1
views: 0
comments: 170
migration_history: 1
```

All required snapshot sections were present.

### 17.2 Remote Baseline Recovered

The production migration-history row contains:

```text
version: 20260615222035
name: remote_schema
statement_count: 313
```

The statement array was recovered in exact stored order to:

```text
%TEMP%\text2task-supabase-migration-audit\20260615222035_remote_schema_recovered.sql
```

Recovered baseline summary:

```text
tables_created: 14
functions_created: 3
constraints_added: 52
indexes_created: 55
rls_enabled_tables: 14
policies_created: 46
grants: 58
default_privileges: 12
extensions: pg_stat_statements, pgcrypto, supabase_vault, uuid-ossp
```

The original M1/M2 limitation "remote-only migration body unknown" is now resolved.

### 17.3 Recovered Baseline Content

The recovered `remote_schema` baseline creates the foundational public application tables:

```text
billing_subscriptions
clients
customer_stories
gmail_oauth_tokens
project_timeline_events
project_update_items
project_updates
projects
scan_jobs
scan_results
scan_snapshots
task_resources
tasks
users
```

It also includes baseline trigger functions, constraints, indexes, RLS enablement, policies, direct grants, default privileges, and app/platform extension declarations.

### 17.4 Baseline Boundary Finding

The clean lineage is not yet proven to be simply:

```text
20260615222035_remote_schema
plus all later local migrations
```

Reason: the local files dated on or before 2026-06-15 split into two different evidence classes.

Pre-baseline local migration classification:

```text
BASELINE_ALREADY_CONTAINS: 2
PARTIAL / CURRENT_PRODUCTION_PRESENT_BUT_NOT_IN_BASELINE: 9
```

The first two local migrations are absorbed by the recovered baseline:

```text
202605250001_project_update_engine.sql
202605280002_customer_stories.sql
```

The other same-day pre-baseline files describe durable effects that are visible in current production but are not stored as created objects in the recovered baseline statement set. Examples include `project_import_attempts` and transactional RPCs such as `apply_project_bulk_action_transaction`, `apply_task_bulk_status_transaction`, `import_projects_transaction`, `update_project_client_identity_transaction`, and `apply_project_update_transaction`.

Therefore, the recovered baseline is high-value evidence but not yet a complete active-lineage boundary by itself.

### 17.5 Local Crosswalk Status

Machine-readable local crosswalk was written outside the repository:

```text
%TEMP%\text2task-supabase-migration-audit\m3b_local_migration_crosswalk.json
%TEMP%\text2task-supabase-migration-audit\m3b_analysis.json
```

Using the repository's date-plus-sequence migration naming convention:

```text
pre-baseline local migrations: 11
post-baseline local migrations: 46
```

Post-baseline preliminary classification:

```text
VERIFIED_POST_BASELINE_APPLIED: 43
UNKNOWN / NEEDS BODY-LEVEL DIFF: 3
```

The three post-baseline files that need body-level confirmation are:

```text
202606160001_fix_project_update_client_detail_json.sql
202606270003_homepage_demo_privilege_hardening.sql
202606300002_homepage_demo_maintenance_cron.sql
```

This classification is preliminary and must be reconciled against supplemental default-ACL, schema-privilege, and storage evidence before an active lineage is declared.

### 17.6 Current Production Delta From Baseline

Current production contains 28 public tables not created by the recovered baseline. The current table-level delta maps cleanly to post-baseline local migrations except for `project_import_attempts`, which maps to a same-day pre-baseline local file not present in the recovered baseline.

Examples:

```text
analytics_events -> 202606190001_analytics_events.sql
billing_checkout_attempts -> 202606230001_billing_checkout_attempts.sql
homepage_demo_* -> 202606270002 through 202609030001 Homepage Demo migrations
calendar_events -> 202607290001_calendar_events.sql
authenticated_product_events -> 202608030001_authenticated_product_events.sql
project_share_links and share_* tables -> 202608030003 through 202608250001 Client Share migrations
project_import_attempts -> 202606150004_project_import_idempotency.sql, but this is not in recovered baseline
```

Function and index deltas also map broadly to local migration source, but full body-level drift comparison is deferred until supplemental evidence is collected.

### 17.7 Current Live Demo Migration

`202609030001_homepage_demo_claim_auth_continuation.sql` remains:

```text
SCHEMA VERIFIED APPLIED
HISTORY NOT RECORDED
```

Snapshot-confirmed columns on `homepage_demo_claims`:

```text
auth_continuation_token_hash
auth_continuation_started_at
auth_continuation_expires_at
auth_continuation_consumed_at
```

Snapshot-confirmed functions:

```text
prepare_homepage_demo_claim_auth_continuation
claim_homepage_demo_project_v2
prepare_homepage_demo_duplicate_override_v2
claim_homepage_demo_project_with_duplicate_override_v2
purge_expired_homepage_demo_trials
purge_homepage_demo_retention
```

Snapshot-confirmed indexes:

```text
homepage_demo_claims_auth_continuation_token_hash_unique_idx
homepage_demo_claims_pending_auth_continuation_expiry_idx
```

Snapshot-confirmed constraints:

```text
homepage_demo_claims_auth_continuation_token_hash_check
homepage_demo_claims_auth_continuation_lifecycle_check
```

### 17.8 Function Redaction Review

The snapshot redacted 11 function definitions because conservative possible-secret keywords matched. Local source exists for every redacted function, so full comparison can proceed from repository migration lineage without exposing production function bodies in chat.

Flagged functions with local source ownership:

```text
activate_share_link -> 202608060001_client_share_lifecycle_operations.sql
apply_task_bulk_status_transaction -> 202607270001_project_completion_reconciliation.sql
create_share_link_draft -> 202608060001_client_share_lifecycle_operations.sql
disable_share_link -> 202608060001_client_share_lifecycle_operations.sql
enforce_project_share_link_integrity -> 202608030005_client_share_integrity_and_security.sql
enforce_share_message_integrity -> 202608030005_client_share_integrity_and_security.sql
reenable_share_link -> 202608060001_client_share_lifecycle_operations.sql
reveal_share_link_secret -> 202608060002_client_share_access_operations.sql
revoke_share_link -> 202608060002_client_share_access_operations.sql
rotate_share_link_secret -> 202608250001_client_share_access_epoch.sql
save_share_configuration -> 202608110001_client_share_publication_intent.sql
```

No redacted function was found without trustworthy local source.

### 17.9 Default ACL And Schema Privilege Gap

The recovered baseline contains 12 `ALTER DEFAULT PRIVILEGES` statements. Local migrations contain no additional `ALTER DEFAULT PRIVILEGES` statements.

The M3 snapshot captured effective table/sequence/function grants but did not capture current `pg_default_acl` state or dedicated schema-level privileges. M3B therefore requires supplemental read-only production evidence before M4.

### 17.10 Auth / Storage Findings

Auth findings:

```text
Local migrations reference auth.users and auth.uid().
No local migration creates app-owned auth schema tables, auth hooks, auth triggers, or auth functions.
auth.* usage is currently classified as REFERENCE_ONLY / PLATFORM_MANAGED.
```

Storage findings:

```text
App source requires Supabase Storage bucket: task-resources.
The bucket is used by authenticated task-resource upload/download routes and Client Share service-role streaming.
Local migrations do not create or configure storage.buckets/storage.objects policies.
Client Share migrations explicitly state they do not alter storage.objects or storage.buckets.
```

Conclusion: canonical environment bootstrap must deliberately account for `task-resources` bucket configuration and storage policies. This is governance debt if it remains outside migrations/bootstrap scripts.

### 17.11 Security Observations

All 42 public tables in the M3 snapshot have RLS enabled.

Some foundational baseline tables still show broad anon/authenticated table privileges inherited from the historical baseline/default-privilege model. This is not automatically classified as exploitable because RLS and policies must be evaluated together with app route architecture.

Observed examples:

```text
billing_subscriptions: anon/authenticated privileges present, RLS enabled, no policies -> no row access through RLS.
customer_stories: public read policy exists for approved stories; user-owned policies also exist.
core owner tables: broad grants exist historically, but RLS policies constrain by auth.uid() for authenticated users.
Homepage Demo and Client Share newer tables: service-role-oriented hardening migrations remove direct anon/authenticated access where required.
```

No production security change is authorized by M3B.

### 17.12 Recommended Canonical Lineage

Recommended active-lineage hypothesis:

```text
20260615222035_remote_schema
plus verified post-baseline migrations
plus explicitly recovered same-day gap migrations/effects
plus future migrations
```

This is preferred over an ahistorical fresh 2026-09-04 mega-baseline because it preserves the real remote baseline row and explains the origin of the foundational schema.

However, this is not ready to implement until the supplemental evidence below is collected and a staging rebuild proves equivalence.

### 17.13 Supplemental Evidence Required

M3B requires one additional read-only production evidence query for:

```text
pg_default_acl current state
public/storage schema-level privileges
task-resources storage bucket configuration
storage.buckets/storage.objects RLS posture
storage policies relevant to task-resources
storage table grants for PUBLIC, anon, authenticated, service_role
```

The supplemental SQL was prepared in temp only:

```text
%TEMP%\text2task-supabase-migration-audit\m3b_supplemental_read_only.sql
```

### 17.14 Local Analyzer

Temporary local analyzer scripts were prepared outside the repository:

```text
%TEMP%\text2task-supabase-migration-audit\m3b_analyzer.cjs
%TEMP%\text2task-supabase-migration-audit\snapshot_compare_analyzer.cjs
```

The comparison analyzer validates required sections, canonicalizes objects deterministically, and can compare a future staging snapshot against production with statuses:

```text
MATCH
MISSING
EXTRA
DEFINITION_DRIFT
```

### 17.15 Next Manual Action

Run the M3B supplemental read-only SQL in the production Supabase SQL Editor and return/export the single JSON result. Do not run M4, do not repair migration history, and do not run `supabase db push`.

Live Demo app rollout remains paused pending migration-governance reconciliation or explicit rollout-owner risk acceptance.

## 18. Phase M4A Canonical Migration Set Proposal

Date: 2026-09-04

Scope: local proposal only. No production query was run, no production change was made, no staging project was created, no active migration file was added or moved, and no Supabase migration-history command was run.

### 18.1 M4A Result

Result: MORE EVIDENCE REQUIRED before production use.

The M4A temp proposal artifacts were created under:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\
```

This is a proposal package for M4B staging validation, not an approved production migration package.

### 18.2 Anchor Candidate

Created temp-only anchor candidate:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\20260615222035_remote_schema.sql
```

Verification:

```text
Statement count: 313
SHA-256: 9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991
Immutable match against recovered source: YES
```

The recovered production anchor was copied byte-for-byte from:

```text
%TEMP%\text2task-supabase-migration-audit\20260615222035_remote_schema_recovered.sql
```

No statements were rewritten, reordered, cleaned, removed, or merged into the closure.

### 18.3 Closure Candidate

Created temp-only closure candidate:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\202609040001_canonical_production_closure.sql
```

Version:

```text
202609040001
```

SHA-256:

```text
4ed2e04045b9be76a11bcd15081d7e0b89ae6729ecfbbfb7d292dad58f3d6382
```

Top-level proposal statement count:

```text
857
```

Major sections:

```text
session: 1
tables: 56
columns: 14
constraints: 259
indexes: 88
functions: 73
triggers: 29
RLS: 42
policies: 11
grants: 109
storage configuration: 1
storage policies: 4
comments: 170
```

The closure candidate is generated from M3/M3B production evidence, local authoritative function bodies for redacted functions, and local migration provenance. It is not a blind concatenation of the 57 divergent migration files.

### 18.4 Proposal Manifests

Created:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\canonical_closure_manifest.json
%TEMP%\text2task-supabase-migration-audit\m4a\grant_ownership_classification.json
%TEMP%\text2task-supabase-migration-audit\m4a\archive_manifest.json
%TEMP%\text2task-supabase-migration-audit\m4a\homepage_demo_maintenance_cron_operational_status.json
%TEMP%\text2task-supabase-migration-audit\m4a\m4a_static_validator.cjs
%TEMP%\text2task-supabase-migration-audit\m4a\m4a_static_validation_report.json
%TEMP%\text2task-supabase-migration-audit\m4a\m4b_snapshot_comparator.cjs
%TEMP%\text2task-supabase-migration-audit\m4a\m4a_summary.json
```

Manifest object count:

```text
canonical_closure_manifest.json: 1300 records
archive_manifest.json: 57 records
57/57 current local SQL migrations classified: YES
```

### 18.5 Ownership Boundary

Closure includes Text2Task app-owned `public` schema objects and required Text2Task configuration on Supabase platform objects.

Included ownership classes:

```text
TEXT2TASK_APP_OWNED
TEXT2TASK_CONFIGURATION_ON_PLATFORM_OBJECT
APP_OWNED_REQUIRED_GRANT
```

Excluded or not-owned classes:

```text
SUPABASE_PLATFORM_MANAGED
HISTORICAL_ANCHOR_OR_PLATFORM_EFFECTIVE
PLATFORM_OR_HISTORICAL_DEFAULT_ACL
PLATFORM_PREREQUISITE
OPERATIONAL
```

No `auth.users`, `storage.buckets`, or `storage.objects` table definition is included in the closure.

### 18.6 Default ACL Decision

The closure candidate contains no `ALTER DEFAULT PRIVILEGES` statements.

Reason: the immutable recovered anchor already contains the historical default ACL statements represented by the production history row. M3B current default ACL evidence is preserved for staging parity review, but the closure does not blindly reproduce all 144 observed default privilege entries.

### 18.7 Storage Configuration

The closure candidate includes Text2Task configuration for:

```text
storage.buckets / task-resources
```

Captured configuration:

```text
private bucket
file_size_limit: 10485760
type: STANDARD
avif_autodetection: false
allowed MIME type allowlist from M3B
```

The closure candidate also includes the four verified Text2Task `storage.objects` policies for `task-resources`.

It does not include `storage.objects` rows, filenames, object paths, user file metadata, or file content.

### 18.8 Auth Configuration

No Text2Task-owned `auth` schema object requiring closure DDL was discovered.

References to `auth.users`, `auth.uid()`, and `auth.admin` remain dependency references, not app-owned objects.

### 18.9 Extensions

Production extensions were classified as:

```text
pgcrypto: APP_REQUIRED, already present in immutable anchor
uuid-ossp: APP_REQUIRED, already present in immutable anchor
pg_cron: OPERATIONAL, not included in closure pending cron job verification
pg_stat_statements: PLATFORM_PREREQUISITE
plpgsql: PLATFORM_PREREQUISITE
supabase_vault: PLATFORM_PREREQUISITE
```

The closure does not blindly install all production extensions.

### 18.10 Cron Decision

`202606300002_homepage_demo_maintenance_cron.sql` defines:

```text
Job name: homepage-demo-maintenance-v1
Schedule: */5 * * * *
Command: select * from public.run_homepage_demo_maintenance(1000);
Dependency: public.run_homepage_demo_maintenance(integer), pg_cron
Semantics: stale processing recovery before retention cleanup; aggregate counts only
```

M4A status:

```text
CRON_PRODUCTION_STATE = UNVERIFIED
```

Decision: do not include cron in the canonical closure candidate. Treat it as separate operational configuration until the specific production `cron.job` row is verified.

Prepared read-only SQL for a later explicit verification step:

```sql
select jsonb_build_object(
  'job_found', count(*) = 1,
  'jobs', coalesce(jsonb_agg(jsonb_build_object(
    'jobname', jobname,
    'schedule', schedule,
    'command', command,
    'active', active
  ) order by jobname), '[]'::jsonb)
) as homepage_demo_maintenance_cron_verification
from cron.job
where jobname = 'homepage-demo-maintenance-v1';
```

This SQL was not executed and was not copied to clipboard.

### 18.11 Static Validation

Temporary validator:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\m4a_static_validator.cjs
```

Result:

```text
PASS: 14/14 checks
```

Checks covered:

```text
anchor immutable hash
no obvious env secret assignments
no auth platform table creation
no storage platform table creation
no closure ALTER DEFAULT PRIVILEGES
no duplicate active canonical versions
Homepage Demo continuation included
storage bucket policy presence
storage bucket config included without storage object rows
RLS coverage statements present
manifest nonempty
security-sensitive functions have search_path evidence
function grants use explicit signatures
function comments use explicit signatures
```

### 18.12 Staging Comparator

Temporary M4B comparator:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\m4b_snapshot_comparator.cjs
```

Future inputs:

```text
production M3 snapshot
production M3B supplemental snapshot
staging M3 snapshot
staging M3B supplemental snapshot
```

Comparison categories include tables, columns, constraints, indexes, functions, triggers, policies, app grants, storage bucket configuration, and storage policies. The comparator separates application drift from expected platform variance by category.

### 18.13 Proposed Final Repo Structure

After M4B staging acceptance only:

```text
supabase/
  config.toml
  README.md
  migrations/
    20260615222035_remote_schema.sql
    202609040001_canonical_production_closure.sql

docs/database/migration-archive/precanonical-2026-09-04/
  <57 historical SQL files and associated provenance>

docs/database/production-baseline-evidence/
  sanitized manifests
  checksums
  comparison report
```

Do not commit raw production evidence snapshots or function bodies until a secret/security review confirms they are appropriate for the repository.

### 18.14 Config.toml Design

Future `supabase/config.toml` should be committed only after review and should contain no credentials, passwords, access tokens, connection URIs, or production project-ref identity.

Design goals:

```text
local project id/name only
explicit schemas used by local tooling
no linked production metadata
no secrets
no environment-specific DB URL
documented rule that supabase/.temp stays local-only
```

`supabase/.temp/` should be explicitly ignored if not already covered.

### 18.15 M4B Staging Procedure

M4B should:

```text
1. Create a dedicated isolated Supabase staging project.
2. Configure safe isolated staging prerequisites only.
3. Apply exact 20260615222035 anchor candidate.
4. Apply exact 202609040001 closure candidate.
5. Configure cron separately only if approved for staging.
6. Run M3 snapshot SQL against staging.
7. Run M3B supplemental snapshot SQL against staging.
8. Compare staging snapshots against production M3/M3B with the temp comparator.
9. Run DB security verification.
10. Run application smoke tests.
11. Run auth/storage flows.
12. Decide PASS/FAIL.
```

Staging safety controls:

```text
different Supabase project
no production DB credentials
no production service role
no production webhook secrets
no live CREEM billing
no production Resend sending
no production Google OAuth callback unless deliberately safe
no production analytics pollution
no production user data
```

### 18.16 Production History Future Step

No production history repair was run in M4A.

After staging acceptance only, production remote history should eventually contain:

```text
20260615222035
202609040001
```

The 57 legacy migrations must not be marked applied one by one.

Future repair command shape, not run:

```powershell
npx.cmd supabase migration repair --status applied 202609040001 --linked
```

Then verify alignment:

```powershell
npx.cmd supabase migration list --linked
```

### 18.17 Live Demo Rollout

Live Demo rollout remains PAUSED.

## 21. M4B Clean Rebuild Failure Analysis and Closure Regeneration #3

### 21.1 Failure Summary

The third isolated staging-only clean rebuild failed while applying:

```text
202609040001_canonical_production_closure.sql
```

The immutable anchor applied successfully. Production was not touched.

PostgreSQL error:

```text
ERROR: role "PUBLIC" does not exist
SQLSTATE: 42704
Closure statement: 598
```

Failing statement:

```sql
grant execute on function "public"."enforce_calendar_event_relationship_integrity"() to "PUBLIC";
```

Root cause:

```text
PUBLIC is a PostgreSQL pseudo-role/grantee and must be rendered as unquoted PUBLIC in GRANT/REVOKE statements.
Quoted "PUBLIC" is interpreted as a real database role named PUBLIC, which does not exist on a fresh Supabase project.
```

### 21.2 Production and Staging Safety

Production changes:

```text
NONE
```

Production queries by Codex:

```text
NONE
```

Staging commands by Codex:

```text
NONE
```

Git operations:

```text
Staged: NO
Commit: NO
Push: NO
Deploy: NO
```

### 21.3 Global Grant/Revoke Rendering Correction

The temporary closure generator was corrected globally so grantees are rendered through one central role renderer:

```text
PUBLIC_PSEUDO_ROLE -> PUBLIC
REAL_ROLE -> quoted PostgreSQL identifier
```

Real roles recognized by the static simulator:

```text
anon
authenticated
service_role
postgres
supabase_admin
```

Pseudo roles recognized by the static simulator:

```text
PUBLIC
```

No string-literal grantees are permitted.

### 21.4 Grant/Revoke Rendering Audit

Created:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\grant_revoke_rendering_audit.json
```

Audit result:

```text
Total GRANT statements: 109
Total REVOKE statements: 0
PUBLIC references: 2
Invalid quoted PUBLIC before fix: 2
Invalid quoted PUBLIC after fix: 0
Unresolved role references: 0
```

PUBLIC grants after correction:

```text
grant execute on function "public"."enforce_calendar_event_relationship_integrity"() to PUBLIC;
grant execute on function "public"."set_calendar_events_updated_at"() to PUBLIC;
```

### 21.5 Function Execute Security Review

Every function EXECUTE grant in the regenerated closure was audited for grantee rendering and role resolution.

Security-sensitive Homepage Demo, Client Share, owner/admin, and service-role RPC grants remain scoped to the verified production intent from M3/M3B evidence and ownership classification.

The only PUBLIC EXECUTE grants retained are the two legacy trigger/integrity helper functions listed above. Homepage Demo RPCs and Client Share RPCs do not receive accidental PUBLIC execute grants from this regeneration.

### 21.6 Table and Sequence Privilege Review

Homepage Demo direct table grants remain service-role-only where present.

Homepage Demo direct table grants to the following browser/pseudo roles remain absent:

```text
PUBLIC
anon
authenticated
```

Client Share secret-material table grants remain absent for all roles. The table remains reachable only through its narrowly scoped SECURITY DEFINER RPC pattern, consistent with the production evidence and repository guardrails.

Sequence grants were audited with the same role renderer and contain no unresolved roles or quoted PUBLIC pseudo-role references.

### 21.7 Regenerated Closure

Regenerated full closure:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\202609040001_canonical_production_closure.sql
```

Version:

```text
202609040001
```

New SHA-256:

```text
3e2d20fe105743b5b7d969b289d1453534107420155b1c765d7fcd14218ab20e
```

Statement count:

```text
857
```

The immutable anchor remains unchanged:

```text
20260615222035 SHA-256:
9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991
```

### 21.8 Prior Fixes Preserved

Generated-column fix:

```text
public.share_rate_limit_buckets.share_link_key remains:
text not null generated always as (coalesce(share_link_id::text, '-')) stored

DEFAULT on generated column: ABSENT
```

FK dependency fix:

```text
86/86 foreign keys safe
Unsatisfied FK dependencies after fix: 0
```

### 21.9 Hardened Static Validation

Updated:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\m4a_static_validator.cjs
%TEMP%\text2task-supabase-migration-audit\m4a\m4a_static_validation_report.json
```

Result:

```text
PASS: 69/69 checks
```

New privilege checks include:

```text
No GRANT renders PUBLIC as "PUBLIC"
No REVOKE renders PUBLIC as "PUBLIC"
Every PUBLIC grantee uses the pseudo-role keyword
Every non-PUBLIC grantee resolves to an expected real role
No single-quoted role strings
Function EXECUTE grants match the ownership/security manifest
Table grants match app-owned security posture
Sequence grants match app-owned security posture
Homepage Demo least-privilege checks remain PASS
Client Share least-privilege checks remain PASS
```

### 21.10 Manifest

Updated:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\canonical_closure_manifest.json
```

Manifest records:

```text
1301
```

Unresolved Text2Task-owned objects:

```text
0
```

Unresolved FK dependencies:

```text
0
```

Unresolved role references:

```text
0
```

### 21.11 M4B Status

M4B status:

```text
NOT YET PASSED
```

The failed staging DB should again be treated as dirty/failed evidence. The next attempt must be a fresh staging-only reset from an empty staging state:

```text
EMPTY STAGING -> IMMUTABLE ANCHOR -> COMPLETE REGENERATED CLOSURE
```

Do not use plain `db push` as the acceptance test.

### 21.12 Live Demo Status

Live Demo remains PAUSED.

### 21.13 Next M4B Action

Exact next user action:

```text
In the isolated staging workspace only, replace the staging copy of 202609040001_canonical_production_closure.sql with:

%TEMP%\text2task-supabase-migration-audit\m4a\202609040001_canonical_production_closure.sql

Verify the replacement file hash:

3e2d20fe105743b5b7d969b289d1453534107420155b1c765d7fcd14218ab20e

Verify the Supabase CLI link points to the isolated staging project, not Production.

Then run:

npx.cmd supabase migration list --linked
npx.cmd supabase db reset --linked --no-seed
```

After reset succeeds, run M3/M3B staging snapshots and compare to production evidence with the M4B comparator. Do not run any production command and do not repair migration history.

## 27. M6 Canonical Repository Cutover

### 27.1 Result

M6 local repository cutover:

```text
PASS
```

This phase modified only local repository files. Production was not queried or modified. Staging was not queried or modified. No `db push`, `db pull`, `db reset`, migration repair, commit, push, or deploy was run.

### 27.2 Active Migration Directory

After M6, `supabase/migrations/` contains exactly:

```text
20260615222035_remote_schema.sql
202609040001_canonical_production_closure.sql
```

Active hashes:

```text
20260615222035_remote_schema.sql:
9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991

202609040001_canonical_production_closure.sql:
13a7aa8d12b8a6685e38fa13b4e53c2fdfc499c030201500ec2564789f70c830
```

### 27.3 Historical Archive

The pre-canonical local migration lineage is preserved under:

```text
docs/database/migration-archive/precanonical-2026-09-04/
```

Archive contents:

```text
pre-canonical SQL migrations: 57
historical migration tests: 22
missing archive files: 0
hash mismatches: 0
duplicate versions: 0
```

The archived migration tests are historical evidence and are no longer active replay tests. Durable canonical static regression tests remain under:

```text
supabase/migration-tests/
```

### 27.4 Production Cron Verification

Production cron verification is complete with sanitized evidence:

```text
job: homepage-demo-maintenance-v1
schedule: */5 * * * *
command: select * from public.run_homepage_demo_maintenance(1000);
active: true
database: postgres
username: postgres
duplicate jobs calling run_homepage_demo_maintenance: 0
latest runs inspected: 10
successes: 10
failures: 0
latest status: succeeded
```

Cron remains operational evidence outside the canonical schema closure.

### 27.5 Canonical Acceptance Carried Forward

The M4C acceptance facts remain:

```text
canonical rebuild: VERIFIED
APPLICATION_DRIFT: 0
security gates: 15 / 15 PASS
FK parity: 86 / 86
CHECK parity: 174 / 174
grant parity: 166 / 166
Homepage / Client Share / Owner / Admin / Storage gates: PASS
```

### 27.6 Production History Boundary

Production migration history remains deliberately unreconciled after M6:

```text
Production remote history: 20260615222035 only
Repository active history: 20260615222035, 202609040001
```

Do not run:

```text
supabase db push
supabase migration repair
```

until M7 deliberately audits and reconciles Production migration history. M6 does not mark `202609040001` as applied in Production history.

### 27.7 Durable Evidence Updated

Updated evidence files:

```text
docs/database/production-baseline-evidence/canonical-artifact-manifest.json
docs/database/production-baseline-evidence/m4c-parity-summary.json
docs/database/production-baseline-evidence/migration-test-classification.json
docs/database/production-baseline-evidence/commit-inclusion-plan.json
docs/database/production-baseline-evidence/README.md
docs/database/migration-archive/precanonical-2026-09-04/archive-manifest.json
docs/database/migration-archive/precanonical-2026-09-04/README.md
supabase/README.md
```

Raw Production and Staging snapshots remain excluded from committed evidence.

### 27.8 Rollout Status

Live Demo rollout remains paused pending commit, push, deploy, and post-deploy verification gates. The M6 governance commit should remain separate from Live Demo application changes unless the release owner explicitly chooses a combined commit boundary.

## 28. M7 Production Migration History Reconciliation Closeout

### 28.1 Result

M7 final closeout:

```text
PASS
EXECUTED + VERIFIED
```

This section records a user-executed, history-only Production migration-history reconciliation. During this closeout, Codex did not connect to Supabase, did not modify Production or Staging, did not run SQL, did not run `db push`, `db pull`, `db reset`, or migration repair, and did not stage, commit, push, or deploy.

### 28.2 Evidence Re-Audit

The local M7 evidence re-audit and user-provided execution evidence confirmed:

```text
active repository migrations: 2
20260615222035_remote_schema.sql SHA-256:
9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991

202609040001_canonical_production_closure.sql SHA-256:
13a7aa8d12b8a6685e38fa13b4e53c2fdfc499c030201500ec2564789f70c830

canonical baseline tests: 20 / 20 PASS
Production vs canonical Staging APPLICATION_DRIFT: 0
security gates: 15 / 15 PASS
prior drifts resolved: 298 / 298
schema/security evidence gaps: 0
cron: VERIFIED
Production link verified: text2task-db
```

The evidence supported a history-only reconciliation. The canonical closure SQL was not re-executed against Production as part of reconciliation.

### 28.3 Repair Semantics

Local no-install Supabase CLI help was not available in this workspace without `npx` attempting package resolution. Official Supabase documentation confirms the relevant semantics:

```text
supabase_migrations.schema_migrations tracks applied migration versions.
db push compares local supabase/migrations against that history table.
migration repair updates the tracking table only.
--status applied inserts/records the specified version.
--status reverted deletes/removes the specified version.
migration repair does not apply or revert SQL.
```

Therefore the correct reconciliation type is:

```text
HISTORY ONLY
```

### 28.4 Target Version and Final History

The only history version added was:

```text
202609040001
```

The old 57 archived migrations were not repaired into Production history. `202609030001` was not marked as applied. The 57 historical migrations were not proven as the canonical replay chain from database genesis; they remain archived as pre-canonical provenance. The two-migration baseline is the proven active replay model.

Canonical Production migration history is now:

```text
20260615222035
202609040001
```

### 28.5 Pre-Flight Gates Verified

The user verified all pre-flight gates before repair:

Active migration files:

```text
20260615222035_remote_schema.sql
202609040001_canonical_production_closure.sql
```

Canonical hashes:

```text
20260615222035_remote_schema.sql:
9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991

202609040001_canonical_production_closure.sql:
13a7aa8d12b8a6685e38fa13b4e53c2fdfc499c030201500ec2564789f70c830
```

Production identity:

```text
project: text2task-db
```

Pre-repair Production history:

```text
20260615222035 = Local + Remote
202609040001 = Local only
```

### 28.6 Executed Repair Command

The following user-executed command repaired history only:

```powershell
npx supabase@latest migration repair 202609040001 --status applied --linked
```

CLI result:

```text
Repaired migration history: [202609040001] => applied
Finished supabase migration repair.
```

Allowed effect:

```text
add/mark applied one migration-history record: 202609040001
```

Verified non-effects:

```text
no application table changes
no column changes
no function changes
no policy changes
no grant changes
no Storage changes
no Cron changes
no application data changes
no migration SQL execution
```

### 28.7 History-Only Rollback Plan

Use only if the wrong history version is recorded or post-repair verification reveals an unexpected history issue:

```powershell
npx.cmd supabase@latest migration repair 202609040001 --status reverted --linked
```

This removes/reverts the migration-history record only. It is not a schema rollback.

### 28.8 Post-Flight Gates

Post-repair migration list verified:

```text
20260615222035 = Local + Remote
202609040001 = Local + Remote
```

Post-repair dry-run command executed by the user:

```powershell
npx supabase@latest db push --dry-run --linked
```

Dry-run result:

```text
DRY RUN: migrations will *not* be pushed to the database.
Remote database is up to date.
```

No real `db push` was required.

### 28.9 Rollout Boundary

Database migration-governance recovery is complete. Future migrations must use timestamps greater than `202609040001` and follow the canonical Staging-first workflow. The old 57 migrations remain archive-only historical provenance.

Live Demo application rollout has not been performed yet and remains a separate release boundary. The dedicated migration-governance commit may now be prepared before resuming the Live Demo application rollout.

## 24. M4C Canonical Closure Security and Constraint Correction

### 24.1 Starting State

M4B clean rebuild passed, but final Production vs Staging parity failed.

M4B final result:

```text
APPLICATION_DRIFT = 298
constraints = 3
grant / privilege drift = 295
security gates = 9 / 15 PASS
```

Production remained unchanged. Staging remained unchanged during M4C. Live Demo rollout remains PAUSED.

### 24.2 Root Causes

The three constraint drifts were stale anchor constraints. The immutable anchor carried older definitions for:

```text
public.project_update_items.project_update_items_type_check
public.project_updates.project_updates_source_type_check
public.project_updates.project_updates_status_check
```

The prior generator preserved anchor-defined constraints too aggressively. M4C corrected source precedence: verified current Production state is authoritative, and a stale anchor constraint must be transformed by the closure.

The privilege drift was systemic, not 295 independent object mistakes. Fresh Supabase project defaults, object creation behavior, default function EXECUTE to PUBLIC, anchor grant state, closure object creation, and missing explicit REVOKEs allowed Staging to retain broader effective privileges than Production.

### 24.3 Constraint Correction

All Production CHECK constraints were audited.

```text
Total Production CHECK constraints: 174
Stale before M4C: 3
Stale after M4C static model: 0
```

The regenerated closure drops and recreates only the three stale CHECK constraints:

```text
project_update_items_type_check includes needs_review
project_updates_source_type_check includes client_share
project_updates_status_check includes applying
```

### 24.4 Privilege Reconstruction

M4C generated an app-owned privilege manifest for:

```text
public tables: 42
public functions/RPCs: 76
public sequences: 1
role-target records: 476
```

Before M4C, extra effective privilege targets were:

```text
PUBLIC: 71
anon: 98
authenticated: 76
service_role: 50
```

After the M4C static final-state model, expected extra privilege targets are:

```text
PUBLIC: 0
anon: 0
authenticated: 0
service_role: 0
```

The closure now performs explicit current-object ACL finalization: revoke all privileges from PUBLIC, anon, authenticated, and service_role for every Text2Task-owned public table, sequence, and function target, then grant back only verified Production privileges.

Closure privilege statements:

```text
REVOKE ALL statements: 476
verified Production GRANT statements: 166
invalid grant/revoke rendering records: 0
unresolved role references: 0
```

PUBLIC is rendered as PostgreSQL's pseudo-role:

```text
TO PUBLIC
FROM PUBLIC
```

It is never rendered as:

```text
"PUBLIC"
```

### 24.5 Security Posture

Homepage Demo table and RPC posture is intended to match verified Production exactly. The v2 continuation/claim RPCs remain service-role-only where verified by Production evidence.

Client Share sensitive tables, including `project_share_secret_material`, have no extra direct role privileges after the M4C static final-state model. Client Share RPC EXECUTE posture is intended to match Production exactly.

Owner, admin, reporting, analytics, billing, and activity RPC EXECUTE posture is intended to match Production exactly.

### 24.6 Default ACL Decision

M4C did not add `ALTER DEFAULT PRIVILEGES`.

M3B showed default ACL record count parity already existed:

```text
Production default privilege records: 144
Staging default privilege records: 144
```

Therefore the M4C correction deliberately finalizes current Text2Task-owned object ACLs rather than copying or changing global default ACL behavior. Future default privilege governance remains a separate deliberate design decision.

### 24.7 Regenerated Closure

Closure version remains:

```text
202609040001
```

Regenerated closure:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\202609040001_canonical_production_closure.sql
```

New SHA-256:

```text
13a7aa8d12b8a6685e38fa13b4e53c2fdfc499c030201500ec2564789f70c830
```

Statement count:

```text
1396
```

Immutable anchor remains unchanged:

```text
20260615222035_remote_schema.sql
9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991
```

### 24.8 Static Validation

Hardened validator:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\m4a_static_validator.cjs
```

Validation result:

```text
PASS: 123 / 123 checks
```

Static privilege simulator:

```text
Available: true
Reliable: reliable for Text2Task public object ACL finalization; fresh Staging replay remains authoritative
Result: PASS_STATIC_EXPECTATION
Before-state privilege diffs: 295
After-state privilege diffs: 0
```

### 24.9 Manifest

Updated manifest:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\canonical_closure_manifest.json
```

Manifest records:

```text
1420
```

Unresolved counts:

```text
Text2Task-owned objects: 0
FK dependencies: 0
role references: 0
CHECK constraints: 0
app privilege targets: 0
```

### 24.10 M4C Status

M4C status:

```text
READY FOR FRESH STAGING REPLAY
```

This does not mark the canonical closure accepted for production use. The next required step is a fresh isolated Staging replay followed by the Production vs Staging M4B comparator.

Do not run `supabase db push`.

Do not run migration repair.

Do not touch Production.

## 25. M4C Post-Replay Final Production vs Staging Parity Recheck

### 25.1 Starting State

The corrected M4C closure was copied into the isolated Staging workspace and replayed from a fresh Staging reset.

Fresh Staging replay result:

```text
PASS
```

Staging migration history after replay:

```text
20260615222035 = Local + Remote
202609040001   = Local + Remote
```

Updated Staging M3 and M3B snapshots were captured after the corrected M4C replay and manually verified as correct. Production was not queried or modified.

### 25.2 Canonical Artifacts

Immutable anchor:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\20260615222035_remote_schema.sql
SHA-256: 9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991
```

Corrected closure:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\202609040001_canonical_production_closure.sql
SHA-256: 13a7aa8d12b8a6685e38fa13b4e53c2fdfc499c030201500ec2564789f70c830
```

### 25.3 Historical Failure Preserved

Historical failed M4B report remains preserved:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\m4b_final_parity_report.json
```

Previous M4B failure:

```text
APPLICATION_DRIFT = 298
stale CHECK constraints = 3
grant / privilege drift = 295
security gates = 9 / 15 PASS
```

M4C post-replay drift resolution:

```text
prior drifts: 298
resolved: 298
still present: 0
changed: 0
new drifts: 0
```

### 25.4 Current Parity Result

New machine-readable report:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\m4c_post_replay_parity_report.json
```

Drift-resolution report:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\m4c_drift_resolution_report.json
```

Current result:

```text
APPLICATION_DRIFT = 0
SECURITY GATES = 15 / 15 PASS
NEEDS_EVIDENCE = 0
CANONICAL REBUILD = VERIFIED
M4C PARITY STATUS = PASS
```

### 25.5 Current Counts

Production vs Staging:

```text
tables: 42 / 42
columns: 605 / 605
constraints: 329 / 329
CHECK constraints: 174 / 174
indexes: 212 / 212
functions: 76 / 76
triggers: 36 / 36
policies: 57 / 57
effective app-owned grants: 166 / 166
extensions: 6 / 5
sequences: 1 / 1
views: 0 / 0
default privilege records: 144 / 144
storage policies: 4 / 4
storage table grants: 6 / 6
```

The extension difference is classified as platform variance, not application drift.

### 25.6 Security Gates

All 15 gates passed:

```text
1. All expected Production public tables exist: PASS
2. Public table column contracts match: PASS
3. Required RLS state matches: PASS
4. Public policies match: PASS
5. Homepage Demo least-privilege posture matches: PASS
6. Homepage Demo continuation RPC posture matches: PASS
7. Client Share secret-material boundaries match: PASS
8. Client Share RPC posture matches: PASS
9. Owner/admin reporting restrictions match: PASS
10. task-resources bucket is private: PASS
11. task-resources configuration matches: PASS
12. All four storage policies match: PASS
13. share_link_key generated invariant matches: PASS
14. Function SECURITY DEFINER/search_path posture matches: PASS
15. No accidental PUBLIC/anon/authenticated privilege escalation exists: PASS
```

### 25.7 Constraint and Privilege Closure

The three stale CHECK constraints now match Production exactly:

```text
project_update_items_type_check includes needs_review
project_updates_source_type_check includes client_share
project_updates_status_check includes applying
```

All Production CHECK constraints match:

```text
CHECK_APPLICATION_DRIFT = 0
```

Effective privilege parity:

```text
Production grants: 166
Staging grants: 166
PUBLIC extra/missing/changed: 0 / 0 / 0
anon extra/missing/changed: 0 / 0 / 0
authenticated extra/missing/changed: 0 / 0 / 0
service_role extra/missing/changed: 0 / 0 / 0
```

Production-verified PUBLIC EXECUTE functions match Staging:

```text
enforce_calendar_event_relationship_integrity()
set_calendar_events_updated_at()
set_customer_stories_updated_at()
set_task_resources_updated_at()
set_updated_at()
```

### 25.8 Storage and Default ACL

Storage parity passed:

```text
task-resources private: true
file_size_limit: 10485760 / 10485760
type: STANDARD / STANDARD
avif_autodetection: false / false
versioning_status: DISABLED / DISABLED
storage.objects rows included: false / false
storage drift count: 0
```

Default ACL evidence:

```text
Production default privilege records: 144
Staging default privilege records: 144
default ACL drift count: 0
```

No broad `ALTER DEFAULT PRIVILEGES` is recommended by this evidence.

### 25.9 Difference Classification

Application drift:

```text
0
```

Platform variance:

```text
4
```

Details:

```text
pg_cron missing in Staging
pgcrypto classification-only variance
plpgsql classification-only variance
uuid-ossp classification-only variance
```

Expected governance history difference:

```text
1
```

Production migration history remains historically divergent and intentionally unreconciled. Staging canonical history contains:

```text
20260615222035
202609040001
```

Snapshot representation differences:

```text
67
```

Details:

```text
environment snapshot labels: 2
staging generated-column scope metadata note: 1
function body redaction availability differences with security metadata compared: 33
function body line-ending/formatting differences normalized: 31
```

Needs evidence:

```text
0
```

### 25.10 Cron and Rollout Status

Cron parity remains separately unverified:

```text
CRON_PARITY = NOT YET VERIFIED
homepage-demo-maintenance-v1
*/5 * * * *
select * from public.run_homepage_demo_maintenance(1000);
```

Production unchanged.

Staging unchanged during comparison.

Live Demo rollout remains paused until governance decides the next rollout step after canonical rebuild verification.

## 26. M5 Canonical Acceptance and Commit-Inclusion Package

### 26.1 M5 Result

M5 repository-safe acceptance package:

```text
PASS
```

This means the local governance package is prepared. It does not mean Production migration history is reconciled, cron runtime is verified, Production canonical history is adopted, or the Live Demo rollout is complete.

Production was not queried or modified.

Staging was not queried or modified during M5.

No Git staging, commit, push, or deploy was performed.

### 26.2 Canonical Active Migration Target

Long-term active migration lineage target:

```text
supabase/migrations/20260615222035_remote_schema.sql
supabase/migrations/202609040001_canonical_production_closure.sql
```

Verified canonical SQL copies are currently stored in the sanitized evidence package:

```text
docs/database/production-baseline-evidence/canonical-migrations/20260615222035_remote_schema.sql
SHA-256: 9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991

docs/database/production-baseline-evidence/canonical-migrations/202609040001_canonical_production_closure.sql
SHA-256: 13a7aa8d12b8a6685e38fa13b4e53c2fdfc499c030201500ec2564789f70c830
```

M5 did not silently replace the active `supabase/migrations/` directory. That physical cutover must remain an explicit follow-up commit-prep action because it removes/moves the current pre-canonical active chain.

### 26.3 Historical Archive

Historical SQL archive:

```text
docs/database/migration-archive/precanonical-2026-09-04/
```

Archive verification:

```text
historical SQL migrations: 57
archived SQL migrations: 57
missing from archive: 0
hash mismatches: 0
duplicate SQL migration versions: 0
```

The archive is historical/pre-canonical evidence and is not the target active replay chain after canonical adoption.

### 26.4 Migration Test Classification

Historical migration tests:

```text
22
```

Classification:

```text
KEEP_ACTIVE:
supabase/migration-tests/canonical-baseline.test.ts

MOVE_WITH_ARCHIVE:
22 pre-canonical supabase/migrations/*.test.ts files during physical active-lineage cutover

REPOINT_TO_CANONICAL:
generated column/default semantics
FK target ordering
PUBLIC pseudo-role rendering
exact CHECK final states
Homepage Demo privilege boundaries
Client Share secret-material boundaries
owner/admin RPC privileges
storage policy/configuration
no auth/storage platform table recreation
no broad ALTER DEFAULT PRIVILEGES
canonical migration hashes

HISTORICAL_ONLY:
none deleted; pre-canonical tests remain preserved as historical evidence when moved
```

Durable canonical static test added:

```text
supabase/migration-tests/canonical-baseline.test.ts
```

Local test result:

```text
PASS: 8 / 8
```

### 26.5 Supabase Config

Committed `supabase/config.toml` recommendation:

```text
NO
```

No existing repo `supabase/config.toml` was found. M5 does not invent config without a concrete CLI/local-runtime need. Any future committed config must contain no Production project ref, database URL, password, PAT, service-role key, anon key, connection string, or link/cache metadata.

### 26.6 Gitignore Governance

`.gitignore` was updated to exclude:

```text
.claude/
supabase/.temp/
supabase/.branches/
supabase/.env
supabase/.env.*
**/linked-project.json
**/project-ref
**/pooler-url
text2task-supabase-migration-audit/
production_schema_snapshot_*.json
staging_schema_snapshot_*.json
m4*_parity_report.json
m4*_drift_resolution_report.json
```

Canonical migrations, governance docs, and sanitized evidence are not ignored.

### 26.7 Production Evidence Policy

Raw Production snapshots committed:

```text
NO
```

Sanitized evidence package:

```text
docs/database/production-baseline-evidence/README.md
docs/database/production-baseline-evidence/canonical-artifact-manifest.json
docs/database/production-baseline-evidence/m4c-parity-summary.json
docs/database/production-baseline-evidence/migration-test-classification.json
docs/database/production-baseline-evidence/commit-inclusion-plan.json
docs/database/production-baseline-evidence/canonical-migrations/
```

The raw M3/M3B Production snapshots remain TEMP-only.

### 26.8 Commit Boundary

Recommended commit boundary:

```text
Dedicated migration-governance commit: YES
```

Do not combine the canonical governance recovery package with Live Demo application code. The Live Demo worktree remains a separate rollout/code commit lane.

Machine-readable commit inclusion plan:

```text
docs/database/production-baseline-evidence/commit-inclusion-plan.json
```

### 26.9 Remaining Items

Still pending:

```text
Production cron runtime verification
Production migration-history reconciliation/adoption plan
Production canonical history adoption
Final app rollout/deploy
Final Production smoke tests
```

Live Demo status:

```text
PAUSED
```

Exact next governance action:

```text
Targeted read-only Production cron verification.
```
## 22. M4B Post-Rebuild Staging Verification Started

### 22.1 Clean Rebuild Status

The isolated staging-only clean rebuild has completed successfully.

Staging project:

```text
text2task-staging
```

Staging project ref:

```text
lbznpuxfwgwjaprdnljv
```

Production project:

```text
text2task-db
```

Production remains unchanged.

### 22.2 Staging Migration History

`supabase migration list` in the isolated staging workspace showed:

```text
20260615222035 = LOCAL + REMOTE
202609040001   = LOCAL + REMOTE
```

Therefore the immutable anchor plus canonical production closure successfully replayed from a fresh/reset Supabase staging database.

### 22.3 Staging M3 Snapshot

The staging M3 structural snapshot completed successfully against `text2task-staging`.

Verified staging M3 evidence includes:

```text
42 public tables
605 columns
329 constraints
212 indexes
76 functions
36 triggers
57 policies
canonical migration history aligned for 20260615222035 and 202609040001
```

### 22.4 Staging M3B Supplemental Snapshot

The staging M3B supplemental snapshot SQL has been prepared with the final corrected M3B design.

The staging M3B snapshot label is:

```text
text2task-staging-schema-snapshot-m4b-supplemental-2026-09-05
```

The prepared SQL captures:

```text
pg_default_acl
public/storage schema privileges
task-resources bucket configuration
storage.buckets and storage.objects RLS state
relevant storage policies
relevant storage table grants
```

The prepared SQL preserves:

```text
PUBLIC pseudo-role handling through ACL catalog inspection
pg_policies.roles explicit name[] overlap typing
no storage.objects row reads
no filenames, object paths, user metadata, file content, credentials, tokens, or secrets
```

### 22.5 Parity Comparison Status

M4B parity comparison is still pending.

M4B is not yet accepted merely because the migrations replayed and M3 completed. Final acceptance still requires:

```text
APPLICATION_DRIFT = 0
```

or every non-zero difference must be proven legitimate platform/environment variance.

### 22.6 Cron Status

`homepage-demo-maintenance-v1` remains separate operational configuration.

Production cron state remains:

```text
UNVERIFIED
```

Cron is not part of the canonical closure and has not been configured in staging as part of this step.

### 22.7 Rollout Status

M4B status:

```text
PARITY VERIFICATION STARTED; COMPARATOR PENDING; NOT YET PASSED
```

Live Demo rollout remains PAUSED.
## 23. M4B Final Production vs Staging Parity Comparison

### 23.1 Comparator Result

The final evidence-based Production vs freshly rebuilt Staging parity comparison was completed from local evidence only.

Machine-readable report:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\m4b_final_parity_report.json
```

M4B final status:

```text
FAIL
```

Production changes:

```text
NONE
```

Staging changes during comparison:

```text
NONE
```

### 23.2 Canonical Artifact Integrity

Immutable anchor SHA-256:

```text
9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991
```

Canonical closure SHA-256:

```text
3e2d20fe105743b5b7d969b289d1453534107420155b1c765d7fcd14218ab20e
```

Both hashes matched expected values.

### 23.3 Structural Counts

Production vs Staging:

```text
Tables:      42 / 42
Columns:     605 / 605
Constraints: 329 / 329
Indexes:     212 / 212
Functions:   76 / 76
Triggers:    36 / 36
Policies:    57 / 57
Grants:      166 / 433
Extensions:  6 / 5
Sequences:   1 / 1
Views:       0 / 0
Types:       0 / 0
```

### 23.4 Application Drift

Application drift count:

```text
298
```

Breakdown:

```text
Constraints: 3
Grants: 295
```

Constraint drift:

```text
public.project_update_items.project_update_items_type_check
Production includes: needs_review
Staging omits: needs_review

public.project_updates.project_updates_source_type_check
Production includes: client_share
Staging omits: client_share

public.project_updates.project_updates_status_check
Production includes: applying
Staging omits: applying
```

Privilege drift summary:

```text
Extra staging grants: 267
Grant definition differences: 28

Extra staging grants by role:
PUBLIC: 71
anon: 98
authenticated: 69
service_role: 29

Extra staging grants by type:
function: 218
table: 49
```

Security-sensitive examples include extra staging direct/effective privileges on:

```text
public.homepage_demo_claims
public.homepage_demo_trials
public.project_share_secret_material
public.claim_homepage_demo_project_v2(...)
public.prepare_homepage_demo_claim_auth_continuation(...)
public.prepare_homepage_demo_duplicate_override_v2(...)
public.activate_share_link(...)
public.reveal_share_link_secret(...)
```

This is not platform variance. It changes the application/security contract and blocks M4B.

### 23.5 Security Gates

Security gates:

```text
1. All expected Production public tables exist: PASS
2. Public table column contracts match: PASS
3. Required RLS state matches: PASS
4. Public policies match: PASS
5. Homepage Demo least-privilege posture matches: FAIL
6. Homepage Demo continuation RPC posture matches: FAIL
7. Client Share secret-material boundaries match: FAIL
8. Client Share RPC posture matches: FAIL
9. Owner/admin reporting restrictions match: FAIL
10. task-resources bucket is private: PASS
11. task-resources configuration matches: PASS
12. All four storage policies match: PASS
13. share_link_key generated invariant matches: PASS
14. Function SECURITY DEFINER/search_path posture matches: PASS
15. No accidental PUBLIC/anon/authenticated privilege escalation exists: FAIL
```

Final:

```text
9/15 PASS
```

### 23.6 Non-Application Differences

Platform variance:

```text
4
```

Classified platform differences:

```text
pg_cron missing from staging
pgcrypto classification label differs but version/schema match
plpgsql classification label differs but version/schema match
uuid-ossp classification label differs but version/schema match
```

Expected governance history difference:

```text
1
```

Production migration history contains:

```text
20260615222035
```

Staging migration history contains:

```text
20260615222035
202609040001
```

This remains an expected governance-history difference, not application schema drift.

Snapshot representation differences:

```text
3
```

These are environment snapshot labels and the staging M3 generated-column interpretation note.

Needs evidence:

```text
0
```

### 23.7 Comparator Normalizations

The temporary comparator was hardened for:

```text
Supabase SQL Editor export unwrapping
Deterministic JSON object/array ordering
Generated-column representation normalization
Function redaction-safe metadata comparison
Migration-history classification as expected governance difference
```

The comparator did not normalize away RLS, FORCE RLS, policies, grants, SECURITY DEFINER, search_path, constraints, indexes, generated semantics, bucket privacy, MIME restrictions, or storage access boundaries.

### 23.8 Canonical Rebuild Decision

Clean staging rebuild:

```text
PASS
```

Final parity audit:

```text
FAIL
```

Canonical rebuild status:

```text
NOT VERIFIED
```

M4B status:

```text
FAIL / MORE WORK REQUIRED
```

### 23.9 Cron Status

Cron parity:

```text
NOT YET VERIFIED
```

`homepage-demo-maintenance-v1` remains operational configuration outside the canonical closure.

### 23.10 Next Governance Step

Exact next governance action:

```text
M4C: analyze the closure privilege/default-privilege reconstruction model and the three stale project update check constraints, then regenerate a corrected closure candidate. Do not touch Production.
```

Live Demo rollout remains PAUSED.

The production DB already has `202609030001_homepage_demo_claim_auth_continuation.sql` manually applied and previously verified 13/13 PASS. Old App + New DB smoke previously passed. The pause is migration-governance related, not a newly discovered Live Demo application-code blocker.

### 18.18 M4A Next Action

Exact next action:

```text
Begin M4B by creating an isolated Supabase staging project and applying only the temp M4A canonical candidates there: 20260615222035_remote_schema.sql followed by 202609040001_canonical_production_closure.sql. Do not touch production or migration history.
```

## 19. M4B Clean Rebuild Failure Analysis and Closure Regeneration 1

Date: 2026-09-05

Scope: local failure analysis and temp closure regeneration only. No production query was run. No production change was made. No migration repair, `db push`, `db pull`, `db reset`, staging command, commit, push, or deploy was run by Codex.

### 19.1 First M4B Staging Result

The first real isolated staging clean rebuild did not pass.

User-reported staging sequence:

```text
20260615222035_remote_schema.sql: applied successfully
202609040001_canonical_production_closure.sql: failed
```

Failure:

```text
ERROR: both default and generation expression specified
for column "share_link_key"
of table "share_rate_limit_buckets"

SQLSTATE: 42601
Closure statement: 53
```

Production impact: NONE.

### 19.2 Root Cause

The M3 production snapshot represented:

```text
public.share_rate_limit_buckets.share_link_key
```

with both:

```text
generated_expression = COALESCE((share_link_id)::text, '-'::text)
default_expression   = COALESCE((share_link_id)::text, '-'::text)
```

That is catalog ambiguity, not schema intent. PostgreSQL stores generated column expressions in `pg_attrdef`, so a snapshot query that reads `pg_attrdef` as a normal default without checking generated-column state can duplicate the expression.

The authoritative local migration source is:

```text
supabase/migrations/202608030004_client_share_session_foundation.sql
```

Authoritative DDL:

```sql
share_link_key text not null
  generated always as (coalesce(share_link_id::text, '-')) stored
```

There is no real `DEFAULT`.

### 19.3 Column Semantics Audit

Created:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\generated_identity_default_audit.json
```

Audit result across all 605 production columns:

```text
Columns with default/generated/identity metadata: 224
Generated columns: 1
Identity columns: 0
Generated columns with snapshot default expression: 1
Invalid candidates after regeneration: 0
```

Only generated column:

```text
public.share_rate_limit_buckets.share_link_key
```

Classification:

```text
authoritative_semantics = GENERATED_STORED
authoritative_source = 202608030004_client_share_session_foundation.sql
closure_action = emit GENERATED ALWAYS AS (...) STORED; suppress snapshot default_expression
```

### 19.4 Normalization Rule

Temporary M4A closure generation was corrected to classify each column into exactly one compatible mode:

```text
NORMAL_WITH_OPTIONAL_DEFAULT
IDENTITY
GENERATED_STORED
```

Rules:

```text
Generated column: emit generated expression, never emit DEFAULT.
Identity column: preserve identity semantics, never synthesize incompatible DEFAULT.
Ordinary column: emit DEFAULT only when it is a true default.
```

Future M3 snapshot SQL/design should separate real defaults from generated expressions by using `pg_attribute.attgenerated` and `pg_attribute.attidentity`. A default expression should be reported as a true default only when the column is not generated; generated expressions should be reported in a separate generated-expression field.

### 19.5 Regenerated Closure

Regenerated temp-only closure candidate:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\202609040001_canonical_production_closure.sql
```

Version remains:

```text
202609040001
```

New closure SHA-256:

```text
6ba6d9d1bdf883559a0bb702cea0f12f67baecd2c93e8e41d46b37d360be95e6
```

Top-level proposal statement count:

```text
857
```

Anchor status:

```text
20260615222035 hash unchanged:
9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991
```

### 19.6 Final Share Link Key DDL

The regenerated closure now emits:

```sql
"share_link_key" text not null generated always as (coalesce(share_link_id::text, '-')) stored,
```

The unique invariant remains:

```sql
alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_identity_unique" UNIQUE (scope, action, identity_digest, share_link_key, window_start, window_seconds);
```

### 19.7 Hardened Static Validation

Updated:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\m4a_static_validator.cjs
%TEMP%\text2task-supabase-migration-audit\m4a\m4a_static_validation_report.json
```

Result:

```text
PASS: 28/28 checks
```

New generated/default checks include:

```text
no generated column contains DEFAULT
no identity column contains incompatible synthesized DEFAULT
production generated column audit count
share_link_key generated stored invariant
share_link_key has no default
unique constraint keys on share_link_key
generated column not writable in closure DML
no duplicate DEFAULT in column lines
no duplicate generated clause in column lines
```

The structural pass also checked for duplicate table definitions, duplicate constraints, policy target existence, trigger-function availability, platform-owned table creation, and unresolved Text2Task-owned manifest records.

### 19.8 Manifest Update

Updated:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\canonical_closure_manifest.json
```

Manifest records:

```text
1301
```

The manifest now explicitly records that the M3 snapshot's apparent default for generated columns is PostgreSQL catalog representation, not an independent default.

Unresolved Text2Task-owned manifest records:

```text
0
```

### 19.9 M4B Status

M4B status:

```text
NOT YET PASSED
```

Expected staging state from the user-reported first attempt:

```text
20260615222035 = applied
202609040001 = not applied
```

Do not repair staging history. The next acceptance attempt should use a staging-only fresh reset so both canonical migrations replay from a clean state.

### 19.10 Live Demo Status

Live Demo remains PAUSED.

The pause is still migration-governance related. No new production application-code blocker was identified by this failure analysis.

### 19.11 Next M4B Action

Exact next user action:

```text
In the isolated staging workspace only, replace the staging copy of 202609040001_canonical_production_closure.sql with:

%TEMP%\text2task-supabase-migration-audit\m4a\202609040001_canonical_production_closure.sql

Verify the Supabase CLI link points to the isolated staging project, not production.

Then run a staging-only clean reset so both canonical migrations replay from scratch:

npx.cmd supabase migration list --linked
npx.cmd supabase db reset --linked

After reset succeeds, run the M3 and M3B staging snapshots and compare them to production evidence with:

%TEMP%\text2task-supabase-migration-audit\m4a\m4b_snapshot_comparator.cjs
```

Do not run any production command and do not repair migration history.

## 20. M4B Clean Rebuild Failure Analysis and Closure Regeneration 2

Date: 2026-09-05

Scope: local failure analysis, dependency audit, and temp closure regeneration only. Codex did not query Production, did not modify Production, did not run staging commands, did not run migration repair, did not run `db push`, did not run `db reset`, and did not stage, commit, push, or deploy.

### 20.1 Second M4B Staging Result

The second isolated staging clean rebuild did not pass.

User-reported staging sequence:

```text
20260615222035_remote_schema.sql: applied successfully
202609040001_canonical_production_closure.sql: failed
```

Failure:

```text
ERROR: there is no unique constraint matching given keys
for referenced table "homepage_demo_trials"

SQLSTATE: 42830
Closure statement: 108
```

Failing statement:

```sql
alter table only "public"."homepage_demo_admission_attempts"
  add constraint "homepage_demo_admission_attempts_trial_id_fkey"
  FOREIGN KEY (trial_id)
  REFERENCES homepage_demo_trials(id)
  ON DELETE SET NULL;
```

Production impact: NONE.

### 20.2 Root Cause

Root cause: closure constraint ordering.

Production has the required candidate key:

```sql
alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_pkey" PRIMARY KEY (id);
```

The failed closure candidate contained that qualifying key, but it emitted the dependent FK before the target table's primary key. That made `homepage_demo_trials(id)` invalid as an FK target at the exact execution point.

The failure is not evidence that Production lacks the key. It is evidence that the M4A closure generator was emitting constraints in snapshot/alphabetical order instead of dependency-safe phases.

### 20.3 Foreign-Key Dependency Audit

Created:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\foreign_key_dependency_audit.json
```

Audit result:

```text
Total production FKs: 86
Unsatisfied before ordering fix: 8
Unsatisfied after ordering fix: 0
FKs depending on qualifying unique indexes instead of PK/UNIQUE constraints: 0
```

The 8 before-fix unsatisfied dependencies were:

```text
homepage_demo_admission_attempts_trial_id_fkey -> public.homepage_demo_trials(id)
homepage_demo_claims_draft_trial_fk -> public.homepage_demo_drafts(id, trial_id)
homepage_demo_claims_trial_binding_fk -> public.homepage_demo_trials(id, public_token_hash, session_token_hash)
homepage_demo_drafts_trial_id_fkey -> public.homepage_demo_trials(id)
homepage_demo_trial_entitlements_trial_id_fkey -> public.homepage_demo_trials(id)
project_updates_source_share_message_id_fkey -> public.share_messages(id)
share_message_conversions_message_id_fkey -> public.share_messages(id)
share_messages_parent_id_fkey -> public.share_messages(id)
```

After regeneration, all FK target keys are either:

```text
ANCHOR_ALREADY_PRESENT
CLOSURE_CREATED_BEFORE_USE
PLATFORM_PREREQUISITE
```

No unresolved FK dependency remains.

### 20.4 Global Constraint Ordering Model

The temporary closure generator was refactored to emit dependency-safe phases:

```text
1. session
2. tables
3. columns
4. primary keys
5. unique constraints
6. qualifying unique indexes
7. check constraints
8. foreign keys
9. remaining indexes
10. functions
11. triggers
12. RLS
13. policies
14. grants
15. storage configuration
16. storage policies
17. comments
```

This handles circular table relationships by creating all tables first, then candidate keys, then FKs.

### 20.5 Regenerated Closure

Regenerated temp-only closure candidate:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\202609040001_canonical_production_closure.sql
```

Version remains:

```text
202609040001
```

New closure SHA-256:

```text
8f9695e287aabcc47dcd5999f93c9380eb7ff684292831db39172d9a50766820
```

Top-level proposal statement count:

```text
857
```

Closure section counts:

```text
session: 1
tables: 56
columns: 14
primary keys: 28
unique constraints: 25
qualifying unique indexes: 16
check constraints: 156
foreign keys: 50
indexes: 72
functions: 73
triggers: 29
RLS: 42
policies: 11
grants: 109
storage configuration: 1
storage policies: 4
comments: 170
```

### 20.6 Previous Generated-Column Fix Preserved

The previous generated/default fix remains preserved.

Current closure line:

```sql
"share_link_key" text not null generated always as (coalesce(share_link_id::text, '-')) stored,
```

There is no `DEFAULT` on `share_link_key`.

The unique constraint remains:

```sql
alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_identity_unique" UNIQUE (scope, action, identity_digest, share_link_key, window_start, window_seconds);
```

### 20.7 Hardened Static Validation and Simulator

Updated:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\m4a_static_validator.cjs
%TEMP%\text2task-supabase-migration-audit\m4a\m4a_static_validation_report.json
```

Result:

```text
PASS: 40/40 checks
```

New FK/order checks include:

```text
all production FKs audited
FK dependencies satisfied before use
every FK target table exists before FK creation
every FK target key exists before FK creation
all production FKs represented exactly once
all production PKs represented correctly
all production UNIQUE constraints represented correctly
circular relationships safe because candidate keys precede FKs
anchor-provided candidate keys recognized
no duplicate PK/UNIQUE/index recreation against anchor objects
```

Execution-order simulation result:

```text
ALL FK DEPENDENCIES SATISFIED BEFORE USE
```

### 20.8 Manifest

Updated:

```text
%TEMP%\text2task-supabase-migration-audit\m4a\canonical_closure_manifest.json
```

Manifest records:

```text
1301
```

Unresolved Text2Task-owned objects:

```text
0
```

Unresolved FK dependencies:

```text
0
```

### 20.9 Anchor Status

The immutable anchor remains unchanged:

```text
20260615222035 SHA-256:
9a799941742523fb34bf304d579b0a9da5aea6c94922b678a803de262ef5a991
```

### 20.10 M4B Status

M4B status:

```text
NOT YET PASSED
```

The failed staging DB should be treated as dirty/failed evidence. The next attempt must be a fresh staging-only reset from an empty staging state:

```text
EMPTY STAGING -> ANCHOR -> REGENERATED CLOSURE
```

Do not use plain `db push` as the acceptance test.

### 20.11 Live Demo Status

Live Demo remains PAUSED.

### 20.12 Next M4B Action

Exact next user action:

```text
In the isolated staging workspace only, replace the staging copy of 202609040001_canonical_production_closure.sql with:

%TEMP%\text2task-supabase-migration-audit\m4a\202609040001_canonical_production_closure.sql

Verify the replacement file hash:

8f9695e287aabcc47dcd5999f93c9380eb7ff684292831db39172d9a50766820

Verify the Supabase CLI link points to the isolated staging project, not Production.

Then run:

npx.cmd supabase migration list --linked
npx.cmd supabase db reset --linked --no-seed
```

After reset succeeds, run M3/M3B staging snapshots and compare to production evidence with the M4B comparator. Do not run any production command and do not repair migration history.
