# Production Baseline Evidence

This directory contains sanitized evidence for the Text2Task Supabase canonical baseline acceptance package. Raw Production M3/M3B snapshots are intentionally not committed.

## Canonical Lineage

The active repository replay chain after M6 is exactly:

1. `20260615222035_remote_schema.sql`
2. `202609040001_canonical_production_closure.sql`

The active migration files and the durable evidence copies are hash-pinned in `canonical-artifact-manifest.json`.

## M4C Acceptance

M4C post-replay parity passed with:

- APPLICATION_DRIFT = 0
- prior drifts resolved = 298 / 298
- security gates = 15 / 15 PASS
- canonical rebuild = VERIFIED

See `m4c-parity-summary.json`.

## M7 History Reconciliation

Production migration-history reconciliation is complete and recorded in `m7-history-reconciliation-summary.json`.

- reconciliation type = HISTORY ONLY
- target version = `202609040001`
- final Production history = `20260615222035`, `202609040001`
- post-repair dry-run = Remote database is up to date
- pending migrations = 0
- real `db push` required = false
- schema SQL re-executed = false

No raw snapshots, credentials, project connection metadata, or raw cron/runtime dumps are committed here.

## Production Cron Evidence

Production cron verification is sanitized and recorded as VERIFIED:

- job = `homepage-demo-maintenance-v1`
- schedule = `*/5 * * * *`
- command = `select * from public.run_homepage_demo_maintenance(1000);`
- active = `true`
- database = `postgres`
- username = `postgres`
- duplicate maintenance jobs = `0`
- latest 10 runs inspected: successes `10`, failures `0`, latest status `succeeded`

## M6 Repository Cutover

The local repository migration directory cutover is complete. The 57 pre-canonical SQL migrations and 22 historical migration tests are preserved under `docs/database/migration-archive/precanonical-2026-09-04/`.

## Commit Inclusion

The dedicated migration-governance commit boundary and file classification plan is recorded in `commit-inclusion-plan.json`.

## Remaining Boundaries

Database migration-governance recovery is complete. Future migrations must use timestamps greater than `202609040001` and follow the Staging-first canonical workflow. Live Demo application rollout has not been performed yet.
