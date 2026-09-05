# Text2Task Supabase Governance

Text2Task is an active production SaaS. Production schema changes must be boring, evidence-backed, and reversible through source-controlled migrations.

## Canonical Baseline

The active repository migration chain after M6 is exactly:

1. `20260615222035_remote_schema.sql`
2. `202609040001_canonical_production_closure.sql`

Future migrations must continue after `202609040001` with new timestamped migration files. Do not modify the canonical anchor or closure after acceptance; create a new migration for any future change.

The pre-canonical local migration history is preserved under:

`docs/database/migration-archive/precanonical-2026-09-04/`

Durable canonical static regression tests live under:

`supabase/migration-tests/`

## Production Workflow

1. Create a real timestamped migration in the repository.
2. Never manually mutate Production as the normal deployment path.
3. Never use the Supabase SQL Editor as the normal deployment mechanism.
4. Test the migration in an isolated Staging project first.
5. Verify migration history after Staging apply.
6. Run static migration, schema, and security tests.
7. Apply the approved migration to Production using the canonical CLI workflow.
8. Verify Production migration history immediately after apply.
9. Run Production smoke tests.
10. Commit, push, and deploy according to the release process only after the database state is verified.

## Prohibited Shortcuts

Never run `supabase db push` while migration histories diverge.

Never run `supabase migration repair` merely to silence CLI warnings.

Never modify Production schema to make Git history look cleaner.

Never weaken RLS, policies, grants, constraints, or RPC boundaries to make a comparison pass.

Never commit local connection metadata, Supabase link cache, credentials, raw Production snapshots, or temporary audit exports.

## Migration Repair Standard

Migration repair requires evidence that the actual schema and recorded migration history truthfully match. If history and schema differ, document the difference, prove the operational state, and design a dedicated reconciliation procedure.

M7 reconciled Production migration history for the canonical two-file replay chain. Production history now records `20260615222035` and `202609040001`, and the post-repair `db push --dry-run` result was "Remote database is up to date."

Future migrations must use timestamps greater than `202609040001` and follow the Staging-first canonical workflow. Do not use `supabase db push` as a shortcut around review, Staging replay, history verification, schema/security checks, and Production smoke testing.

## Environment Boundaries

Production is the authoritative runtime state.

Staging is disposable and must be rebuilt from source-controlled migrations before acceptance.

The canonical anchor and closure were created to recover a trustworthy migration baseline. They are not a pattern for normal feature work.

## Cron Boundary

Cron is not part of the canonical schema closure. Production cron has been verified separately as operational evidence.

Expected verified job:

```text
homepage-demo-maintenance-v1
*/5 * * * *
select * from public.run_homepage_demo_maintenance(1000);
active = true
database = postgres
username = postgres
latest 10 runs: 10 succeeded, 0 failed
```
