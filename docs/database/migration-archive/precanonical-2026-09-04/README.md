# Precanonical Supabase Migration Archive

This directory preserves the original local Text2Task migration lineage before the canonical Supabase recovery baseline adopted on 2026-09-05.

These files are historical evidence. They are not the active replay chain after canonical adoption.

## Active Canonical Replay Chain

After M6, `supabase/migrations/` contains exactly:

1. `20260615222035_remote_schema.sql`
2. `202609040001_canonical_production_closure.sql`

## Archived History

This archive contains:

- 57 pre-canonical SQL migration files, preserved byte-for-byte from the original local lineage.
- 22 historical per-migration tests under `tests/`.

Do not edit historical SQL or historical tests. Future migrations must use new timestamps after `202609040001`.

## Test Discovery

The files under `tests/` are preserved historical artifacts, not active repository regression tests after canonical adoption. Normal Vitest discovery intentionally excludes only:

`docs/database/migration-archive/precanonical-2026-09-04/tests/**`

Active migration validation now lives under:

- `supabase/migration-tests/`
- the currently maintained runtime-package tests under `scripts/client-share/`

Runtime-package tests that still need byte-for-byte historical migration bodies must read those source files from this archive, not from `supabase/migrations/`. Do not copy archived SQL back into `supabase/migrations/`; that directory is the active canonical replay chain only.

Archive manifest: `archive-manifest.json`
