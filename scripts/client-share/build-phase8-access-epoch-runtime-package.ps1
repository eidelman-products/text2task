<#
.SYNOPSIS
  Mechanically builds THREE generated outputs of the Phase 8 Access Epoch
  runtime verification package:
    docs/client-share-phase8-access-epoch-runtime/02_APPLY_OR_VERIFY_PREREQUISITES.sql
    docs/client-share-phase8-access-epoch-runtime/02C_APPLY_ACCESS_EPOCH_MIGRATION.sql
    docs/client-share-phase8-access-epoch-runtime/MANIFEST.md

.DESCRIPTION
  Same generation discipline as every prior generator in this family
  (scripts/client-share/build-phase6a-runtime-package.ps1 is the closest
  precedent -- same two-bundle-plus-manifest shape, same staging/
  validation approach). File 02 bundles the full 17-migration prerequisite
  chain (3 pre-existing Project Update Engine migrations + all 14
  currently-applied Client Share migrations) verbatim, in order, bringing
  a fresh disposable project to the exact schema shape Production is
  expected to be on immediately BEFORE the Phase 8 corrective migration.
  File 02C bundles the ONE new migration under test,
  202608250001_client_share_access_epoch.sql, verbatim, with a SHA-256
  header so its identity can be checked against the file actually
  intended for Production before it is ever pasted into a disposable
  project's SQL Editor.

  Same guarantees as every prior generator in this family:
    - never modifies any source migration file
    - never runs any SQL
    - never connects to Supabase
    - never uses any credential or project reference
    - never calls Get-Date or embeds any wall-clock timestamp
    - builds all three generated outputs in a temporary staging
      subdirectory first and validates them completely BEFORE any real
      package file is touched
    - inserts a generated, non-executable source-path + SHA-256 comment
      immediately before each migration's BEGIN boundary marker in each
      bundle, without altering the migration body itself in any way
    - regenerates MANIFEST.md's full file inventory and hash table from
      the same computed hashes
    - fails closed (throws, writes nothing) if any expected source file is
      absent

  Run manually, once, from anywhere inside the repository:
    powershell -File scripts/client-share/build-phase8-access-epoch-runtime-package.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------
# 1. Resolve the repository root safely, from this script's own location.
# ---------------------------------------------------------------------
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..\..')
Write-Host "Repository root resolved to: $repoRoot"

$migrationsDir = Join-Path $repoRoot 'supabase\migrations'
$packageDir = Join-Path $repoRoot 'docs\client-share-phase8-access-epoch-runtime'
$reportPath = Join-Path $repoRoot 'docs\TEXT2TASK_CLIENT_SHARE_LINK_ACCESS_EPOCH_IMPLEMENTATION_REPORT_2026-08-25.md'

# The 17-migration prerequisite chain, in exact dependency order -- 3
# pre-existing Project Update Engine migrations, then the full 14-file
# Client Share chain through 202608230002 (the last migration applied
# before the Phase 8 corrective change). This is the SAME 14-file Client
# Share list build-phase6a-runtime-package.ps1 uses, extended with the
# three migrations Phase 6A/6B/6C themselves added after that generator
# was last run (202608210001, 202608230001, 202608230002) plus the two
# Project Update Engine prerequisites Phase 6's own closure needs
# (202605250001, 202606150001) -- deliberately NOT 202607270001 as a
# separate bundle entry; it IS included below, third, exactly where
# build-phase6a-runtime-package.ps1 places its own 0c prerequisite.
$prerequisiteSourceFiles = @(
  '202605250001_project_update_engine.sql',
  '202606150001_project_update_apply_hardening.sql',
  '202607270001_project_completion_reconciliation.sql',
  '202608030003_client_share_owner_foundation.sql',
  '202608030004_client_share_session_foundation.sql',
  '202608030005_client_share_integrity_and_security.sql',
  '202608050001_client_share_owner_reads.sql',
  '202608060001_client_share_lifecycle_operations.sql',
  '202608060002_client_share_access_operations.sql',
  '202608060003_client_share_configuration_save.sql',
  '202608110001_client_share_publication_intent.sql',
  '202608110002_client_share_management_mapping_metadata.sql',
  '202608130001_client_share_rate_limit_increment.sql',
  '202608190001_client_share_message_owner_rpcs.sql',
  '202608210001_client_share_project_update_provenance.sql',
  '202608230001_client_share_apply_boundary.sql',
  '202608230002_client_share_apply_conversion_closure.sql'
)

$accessEpochMigrationFile = '202608250001_client_share_access_epoch.sql'

$prereqBundleFileName = '02_APPLY_OR_VERIFY_PREREQUISITES.sql'
$accessEpochBundleFileName = '02C_APPLY_ACCESS_EPOCH_MIGRATION.sql'
$manifestFileName = 'MANIFEST.md'
$prereqBundleFile = Join-Path $packageDir $prereqBundleFileName
$accessEpochBundleFile = Join-Path $packageDir $accessEpochBundleFileName
$manifestFile = Join-Path $packageDir $manifestFileName

$generatedOutputs = @($prereqBundleFile, $accessEpochBundleFile, $manifestFile)

# ---------------------------------------------------------------------
# 2. Refuse to write anywhere outside the allowed package directory, and
#    only ever to these three named files.
# ---------------------------------------------------------------------
$resolvedPackageDir = (Resolve-Path $packageDir).Path
foreach ($target in $generatedOutputs) {
  $resolvedParent = Split-Path -Parent $target
  if ((Resolve-Path $resolvedParent).Path -ne $resolvedPackageDir) {
    throw "Refusing to run: computed output path '$target' is not inside the allowed package directory '$resolvedPackageDir'."
  }
}
if ((Split-Path -Leaf $prereqBundleFile) -ne $prereqBundleFileName) {
  throw "Refusing to run: the prerequisite-bundle generator target may only ever be '$prereqBundleFileName'."
}
if ((Split-Path -Leaf $accessEpochBundleFile) -ne $accessEpochBundleFileName) {
  throw "Refusing to run: the access-epoch-bundle generator target may only ever be '$accessEpochBundleFileName'."
}
if ((Split-Path -Leaf $manifestFile) -ne $manifestFileName) {
  throw "Refusing to run: the manifest generator target may only ever be '$manifestFileName'."
}

# ---------------------------------------------------------------------
# 3. Shared helpers.
# ---------------------------------------------------------------------
function Get-NormalizedContent {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Refusing to run: required file not found at '$Path'."
  }
  $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  return $raw -replace "`r`n", "`n" -replace "`r", "`n"
}

function Get-Sha256Hex {
  param([string]$Text)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha.ComputeHash($bytes)
  } finally {
    $sha.Dispose()
  }
  return ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant()
}

function Write-StagedFile {
  param([string]$StagingPath, [string]$Content)
  [System.IO.File]::WriteAllText($StagingPath, $Content, [System.Text.UTF8Encoding]::new($false))
}

# ---------------------------------------------------------------------
# 4. Read and hash the seventeen prerequisite migrations plus the one
#    access-epoch migration under test. Read-only against
#    supabase/migrations/ -- only Get-Content, never a write. Fails
#    closed (throws) if any is missing.
# ---------------------------------------------------------------------
$prereqContents = [ordered]@{}
$prereqHashes = [ordered]@{}
$prereqRelativePaths = [ordered]@{}

foreach ($name in $prerequisiteSourceFiles) {
  $path = Join-Path $migrationsDir $name
  $content = Get-NormalizedContent -Path $path
  $prereqContents[$name] = $content
  $prereqHashes[$name] = Get-Sha256Hex -Text $content
  $prereqRelativePaths[$name] = "supabase/migrations/$name"
  Write-Host "Read prerequisite migration: $name  sha256=$($prereqHashes[$name])"
}

$accessEpochPath = Join-Path $migrationsDir $accessEpochMigrationFile
$accessEpochContent = Get-NormalizedContent -Path $accessEpochPath
$accessEpochHash = Get-Sha256Hex -Text $accessEpochContent
Write-Host "Read access-epoch migration: $accessEpochMigrationFile  sha256=$accessEpochHash"

# ---------------------------------------------------------------------
# 5. Build the prerequisite bundle (file 02): safety preamble, each of
#    the 17 sources verbatim with a generated source-path + SHA-256
#    comment and clear non-executable boundary markers, then a final
#    structural verification query.
# ---------------------------------------------------------------------
$prereqHeader = @'
-- Text2Task Client Share Link -- Phase 8 Access Epoch Runtime Verification Package
-- File 02: Exact 17-migration prerequisite chain bundle (MECHANICALLY
-- GENERATED) -- brings a fresh disposable project to the exact schema
-- shape Production is expected to already be on immediately BEFORE the
-- Phase 8 corrective migration (202608250001) is ever applied.
--
-- Generated by scripts/client-share/build-phase8-access-epoch-runtime-package.ps1.
-- Do not hand-edit this file -- edit the seventeen source migrations
-- under supabase/migrations/ and re-run the generator instead.
--
-- Run this SECOND, after 01_PREPARE_RUNTIME_FIXTURES.sql, in the same
-- brand-new, temporary Supabase project. Never run this in the real
-- Text2Task production project.
--
-- This file contains the EXACT, UNMODIFIED contents of, in order:
--   1. 202605250001_project_update_engine.sql                    [prerequisite]
--   2. 202606150001_project_update_apply_hardening.sql            [prerequisite]
--   3. 202607270001_project_completion_reconciliation.sql         [prerequisite]
--   4. 202608030003_client_share_owner_foundation.sql
--   5. 202608030004_client_share_session_foundation.sql
--   6. 202608030005_client_share_integrity_and_security.sql
--   7. 202608050001_client_share_owner_reads.sql
--   8. 202608060001_client_share_lifecycle_operations.sql
--   9. 202608060002_client_share_access_operations.sql
--   10. 202608060003_client_share_configuration_save.sql
--   11. 202608110001_client_share_publication_intent.sql
--   12. 202608110002_client_share_management_mapping_metadata.sql
--   13. 202608130001_client_share_rate_limit_increment.sql
--   14. 202608190001_client_share_message_owner_rpcs.sql
--   15. 202608210001_client_share_project_update_provenance.sql
--   16. 202608230001_client_share_apply_boundary.sql
--   17. 202608230002_client_share_apply_conversion_closure.sql
-- with only a safety preamble, one generated source-path/hash comment per
-- migration, and a verification query added around them.

-- =========================================================
-- SAFETY PREAMBLE (generated -- not part of any migration)
-- =========================================================

do $safety_preamble$
declare
  v_sentinel_kind text;
begin
  if to_regclass('public.text2task_phase8_access_epoch_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 8 Access Epoch runtime test sentinel was not found in this project. Run 01_PREPARE_RUNTIME_FIXTURES.sql here first, and only ever inside a brand-new temporary Supabase project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_phase8_access_epoch_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_8_ACCESS_EPOCH_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row in this project does not identify it as a disposable Phase 8 Access Epoch runtime test project.';
  end if;

  if to_regclass('public.project_updates') is not null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.project_updates already exists in this project. This bundle only applies fresh migrations to an empty test project; it never adopts, adapts around, or overwrites an existing table.';
  end if;

  if to_regclass('public.project_share_links') is not null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.project_share_links already exists in this project. This bundle only applies fresh Client Share Link migrations to an empty test project; it never adopts, adapts around, or overwrites an existing table.';
  end if;
end;
$safety_preamble$;

'@

$prereqFooter = @'

-- =========================================================
-- FINAL VERIFICATION (generated -- not part of any migration)
--
-- Structural existence check only -- confirms the disposable project now
-- sits at exactly the pre-202608250001 schema shape. File 03's own
-- Section A is the authoritative runtime check for the access-epoch
-- migration's own effects; this query only confirms the PREREQUISITE
-- chain landed correctly, including that access_epoch/pin_epoch do NOT
-- exist yet (this bundle must never accidentally include the migration
-- under test).
-- =========================================================

select
  check_item.kind,
  check_item.name,
  case check_item.kind
    when 'table' then to_regclass('public.' || check_item.name) is not null
    when 'function' then to_regprocedure('public.' || check_item.name) is not null
    when 'column' then exists (
      select 1
      from information_schema.columns col
      where col.table_schema = 'public'
        and col.table_name = split_part(check_item.name, '.', 1)
        and col.column_name = split_part(check_item.name, '.', 2)
    )
    when 'column_absent' then not exists (
      select 1
      from information_schema.columns col
      where col.table_schema = 'public'
        and col.table_name = split_part(check_item.name, '.', 1)
        and col.column_name = split_part(check_item.name, '.', 2)
    )
  end as found
from (
  values
    ('table', 'project_updates'),
    ('table', 'project_share_links'),
    ('table', 'share_session_grants'),
    ('table', 'share_messages'),
    ('table', 'share_message_conversions'),
    ('column', 'project_share_links.configuration_version'),
    ('column_absent', 'project_share_links.access_epoch'),
    ('column_absent', 'project_share_links.pin_epoch'),
    ('column_absent', 'share_session_grants.granted_access_epoch'),
    ('column_absent', 'share_session_grants.granted_pin_epoch'),
    ('function', 'apply_project_update_transaction(uuid,uuid,uuid[],uuid[],jsonb,jsonb)'),
    ('function', 'finalize_share_message_conversion(uuid,uuid)'),
    ('function', 'rotate_share_link_secret(uuid,text,smallint,text,text,text,smallint)'),
    ('function', 'set_share_link_pin(uuid,text,text,smallint,integer,integer,integer,integer)'),
    ('function', 'enforce_share_session_grant_integrity()')
) as check_item(kind, name)
order by check_item.kind, check_item.name;
'@

$prereqBundleParts = New-Object System.Collections.Generic.List[string]
$prereqBundleParts.Add($prereqHeader)

foreach ($name in $prerequisiteSourceFiles) {
  $sourceComment = "-- Source: $($prereqRelativePaths[$name])`n-- SHA-256 (normalized LF UTF-8): $($prereqHashes[$name])`n"
  $prereqBundleParts.Add("$sourceComment-- ===== BEGIN $name (verbatim, unmodified) =====`n")
  $prereqBundleParts.Add($prereqContents[$name])
  $prereqBundleParts.Add("`n-- ===== END $name =====`n")
}

$prereqBundleParts.Add($prereqFooter)

$prereqBundle = ($prereqBundleParts -join "`n") -replace "`r`n", "`n" -replace "`r", "`n"

# ---------------------------------------------------------------------
# 6. Mechanically verify the prerequisite bundle: each source appears
#    exactly once, in order, with a matching hash comment.
# ---------------------------------------------------------------------
$positions = @()
foreach ($name in $prerequisiteSourceFiles) {
  $beginMarker = "-- ===== BEGIN $name (verbatim, unmodified) ====="
  $occurrences = ([regex]::Matches($prereqBundle, [regex]::Escape($beginMarker))).Count
  if ($occurrences -ne 1) {
    throw "Verification failed: '$name' begin-marker appears $occurrences time(s) in the generated prerequisite bundle; expected exactly 1."
  }
  $positions += $prereqBundle.IndexOf($beginMarker)

  $expectedComment = "-- SHA-256 (normalized LF UTF-8): $($prereqHashes[$name])"
  if (-not $prereqBundle.Contains($expectedComment)) {
    throw "Verification failed: generated source-hash comment for '$name' not found or does not match its computed hash."
  }
}
for ($i = 1; $i -lt $positions.Count; $i++) {
  if ($positions[$i] -le $positions[$i - 1]) {
    throw "Verification failed: prerequisite source migrations are not in the required order inside the generated bundle."
  }
}
Write-Host 'Order verification passed: all seventeen prerequisite migrations, each exactly once, each with a matching source-hash comment.'

$prereqBundleHash = Get-Sha256Hex -Text $prereqBundle

# ---------------------------------------------------------------------
# 7. Build the access-epoch bundle (file 02C): safety preamble, the one
#    migration under test verbatim with its own hash comment, a final
#    structural verification query.
# ---------------------------------------------------------------------
$accessEpochHeader = @"
-- Text2Task Client Share Link -- Phase 8 Access Epoch Runtime Verification Package
-- File 02C: The migration under test, verbatim (MECHANICALLY GENERATED)
--
-- Generated by scripts/client-share/build-phase8-access-epoch-runtime-package.ps1.
-- Do not hand-edit this file -- edit
-- supabase/migrations/$accessEpochMigrationFile and re-run the generator
-- instead.
--
-- Run this THIRD, after 01_PREPARE_RUNTIME_FIXTURES.sql, 02, and
-- 02B_SEED_PRE_MIGRATION_PRODUCT_FIXTURES.sql, in the same temporary
-- Supabase project. Never run this in the real Text2Task production
-- project.
--
-- This file contains the EXACT, UNMODIFIED contents of
-- supabase/migrations/$accessEpochMigrationFile with only a safety
-- preamble, one generated source-path/hash comment, and a verification
-- query added around it.
--
-- BEFORE PASTING THIS INTO A DISPOSABLE PROJECT: independently confirm
-- the SHA-256 below matches supabase/migrations/$accessEpochMigrationFile
-- as it exists in the repository right now (e.g.
-- ``Get-FileHash -Algorithm SHA256 supabase\migrations\$accessEpochMigrationFile``,
-- normalized to LF line endings first if your local checkout uses CRLF) --
-- this is the byte-for-byte-identity proof required before Production
-- rollout (see this package's own 00_READ_ME_FIRST.md, item J).
--
-- Migration file SHA-256 (normalized LF UTF-8): $accessEpochHash

-- =========================================================
-- SAFETY PREAMBLE (generated -- not part of the migration)
-- =========================================================

do `$safety_preamble`$
declare
  v_sentinel_kind text;
begin
  if to_regclass('public.text2task_phase8_access_epoch_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 8 Access Epoch runtime test sentinel was not found in this project. Run 01_PREPARE_RUNTIME_FIXTURES.sql here first, and only ever inside a brand-new temporary Supabase project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_phase8_access_epoch_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_8_ACCESS_EPOCH_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row in this project does not identify it as a disposable Phase 8 Access Epoch runtime test project.';
  end if;

  if to_regclass('public.project_share_links') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.project_share_links does not exist yet. Run 02_APPLY_OR_VERIFY_PREREQUISITES.sql first.';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'project_share_links'
      and column_name = 'access_epoch'
  ) then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.project_share_links.access_epoch already exists -- this migration appears to already be applied in this project. This bundle is meant to run exactly once, immediately after 02B seeds the pre-migration fixture rows.';
  end if;

  if not exists (
    select 1 from public.text2task_phase8_fixture_ids where key = 'link_no_pin_active'
  ) then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. No pre-migration fixture rows were found (text2task_phase8_fixture_ids is empty). Run 02B_SEED_PRE_MIGRATION_PRODUCT_FIXTURES.sql first -- this bundle must apply against REAL, pre-existing rows to prove backfill safety, matching this package''s own Section A requirement.';
  end if;
end;
`$safety_preamble`$;

"@

$accessEpochFooter = @'

-- =========================================================
-- FINAL VERIFICATION (generated -- not part of the migration)
--
-- Structural existence check only. File 03's own Section A is the
-- authoritative runtime check for exact backfill values, constraints and
-- unrelated-data preservation; this query is a fast smoke check only.
-- =========================================================

select
  check_item.kind,
  check_item.name,
  case check_item.kind
    when 'column' then exists (
      select 1
      from information_schema.columns col
      where col.table_schema = 'public'
        and col.table_name = split_part(check_item.name, '.', 1)
        and col.column_name = split_part(check_item.name, '.', 2)
    )
    when 'constraint' then exists (
      select 1
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = split_part(check_item.name, '.', 1)
        and con.conname = split_part(check_item.name, '.', 2)
    )
    when 'function' then to_regprocedure('public.' || check_item.name) is not null
  end as found
from (
  values
    ('column', 'project_share_links.access_epoch'),
    ('column', 'project_share_links.pin_epoch'),
    ('column', 'share_session_grants.granted_access_epoch'),
    ('column', 'share_session_grants.granted_pin_epoch'),
    ('constraint', 'project_share_links.project_share_links_access_epoch_check'),
    ('constraint', 'project_share_links.project_share_links_pin_epoch_check'),
    ('constraint', 'share_session_grants.share_session_grants_access_epoch_check'),
    ('constraint', 'share_session_grants.share_session_grants_pin_epoch_check'),
    ('function', 'enforce_share_session_grant_integrity()'),
    ('function', 'rotate_share_link_secret(uuid,text,smallint,text,text,text,smallint)'),
    ('function', 'set_share_link_pin(uuid,text,text,smallint,integer,integer,integer,integer)')
) as check_item(kind, name)
order by check_item.kind, check_item.name;
'@

$accessEpochBundleParts = New-Object System.Collections.Generic.List[string]
$accessEpochBundleParts.Add($accessEpochHeader)
$sourceComment = "-- Source: supabase/migrations/$accessEpochMigrationFile`n-- SHA-256 (normalized LF UTF-8): $accessEpochHash`n"
$accessEpochBundleParts.Add("$sourceComment-- ===== BEGIN $accessEpochMigrationFile (verbatim, unmodified) =====`n")
$accessEpochBundleParts.Add($accessEpochContent)
$accessEpochBundleParts.Add("`n-- ===== END $accessEpochMigrationFile =====`n")
$accessEpochBundleParts.Add($accessEpochFooter)

$accessEpochBundle = ($accessEpochBundleParts -join "`n") -replace "`r`n", "`n" -replace "`r", "`n"

$accessEpochBeginMarker = "-- ===== BEGIN $accessEpochMigrationFile (verbatim, unmodified) ====="
$accessEpochOccurrences = ([regex]::Matches($accessEpochBundle, [regex]::Escape($accessEpochBeginMarker))).Count
if ($accessEpochOccurrences -ne 1) {
  throw "Verification failed: '$accessEpochMigrationFile' begin-marker appears $accessEpochOccurrences time(s) in the generated access-epoch bundle; expected exactly 1."
}
if (-not $accessEpochBundle.Contains("-- SHA-256 (normalized LF UTF-8): $accessEpochHash")) {
  throw "Verification failed: generated source-hash comment for '$accessEpochMigrationFile' not found or does not match its computed hash."
}
Write-Host 'Order/hash verification passed: the access-epoch migration appears exactly once, with a matching source-hash comment.'

$accessEpochBundleHash = Get-Sha256Hex -Text $accessEpochBundle

# ---------------------------------------------------------------------
# 8. Hash the other hand-authored package files that MANIFEST.md needs to
#    describe.
# ---------------------------------------------------------------------
$otherPackageFiles = [ordered]@{
  'TEXT2TASK_CLIENT_SHARE_LINK_ACCESS_EPOCH_IMPLEMENTATION_REPORT_2026-08-25.md' = @{ Path = $reportPath; Origin = 'hand-authored (updated, not regenerated, by this package)' }
  '00_READ_ME_FIRST.md' = @{ Path = (Join-Path $packageDir '00_READ_ME_FIRST.md'); Origin = 'hand-authored' }
  '01_PREPARE_RUNTIME_FIXTURES.sql' = @{ Path = (Join-Path $packageDir '01_PREPARE_RUNTIME_FIXTURES.sql'); Origin = 'hand-authored' }
  '01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql' = @{ Path = (Join-Path $packageDir '01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql'); Origin = 'hand-authored' }
  '02B_SEED_PRE_MIGRATION_PRODUCT_FIXTURES.sql' = @{ Path = (Join-Path $packageDir '02B_SEED_PRE_MIGRATION_PRODUCT_FIXTURES.sql'); Origin = 'hand-authored' }
  '03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql' = @{ Path = (Join-Path $packageDir '03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql'); Origin = 'hand-authored' }
  '04_CAPTURE_RESULTS.md' = @{ Path = (Join-Path $packageDir '04_CAPTURE_RESULTS.md'); Origin = 'hand-authored' }
  'build-phase8-access-epoch-runtime-package.ps1' = @{ Path = $MyInvocation.MyCommand.Path; Origin = 'hand-authored (this generator)' }
}

$otherPackageHashes = [ordered]@{}
foreach ($key in $otherPackageFiles.Keys) {
  $content = Get-NormalizedContent -Path $otherPackageFiles[$key].Path
  $otherPackageHashes[$key] = Get-Sha256Hex -Text $content
  Write-Host "Read package file: $key  sha256=$($otherPackageHashes[$key])"
}

# ---------------------------------------------------------------------
# 9. Build MANIFEST.md deterministically.
# ---------------------------------------------------------------------
$manifestLines = New-Object System.Collections.Generic.List[string]
$manifestLines.Add('# Client Share Link -- Phase 8 Access Epoch Runtime Verification Package Manifest')
$manifestLines.Add('')
$manifestLines.Add('Mechanically generated by `scripts/client-share/build-phase8-access-epoch-runtime-package.ps1`.')
$manifestLines.Add('Deterministic from repository/package file contents alone -- no wall-clock')
$manifestLines.Add('timestamp, build number or `Get-Date` value is embedded anywhere in this file.')
$manifestLines.Add('Re-run the generator to reproduce it exactly, or to pick up source changes.')
$manifestLines.Add('')
$manifestLines.Add('## Package files (all ten approved files)')
$manifestLines.Add('')
$manifestLines.Add('| # | File | Origin | SHA-256 |')
$manifestLines.Add('|---|---|---|---|')
$manifestLines.Add("| 1 | ``00_READ_ME_FIRST.md`` | hand-authored | ``$($otherPackageHashes['00_READ_ME_FIRST.md'])`` |")
$manifestLines.Add("| 2 | ``01_PREPARE_RUNTIME_FIXTURES.sql`` | hand-authored | ``$($otherPackageHashes['01_PREPARE_RUNTIME_FIXTURES.sql'])`` |")
$manifestLines.Add("| 3 | ``01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql`` | hand-authored | ``$($otherPackageHashes['01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql'])`` |")
$manifestLines.Add("| 4 | ``02_APPLY_OR_VERIFY_PREREQUISITES.sql`` | **generated** (mechanically assembled from the seventeen prerequisite migrations below) | ``$prereqBundleHash`` |")
$manifestLines.Add("| 5 | ``02B_SEED_PRE_MIGRATION_PRODUCT_FIXTURES.sql`` | hand-authored | ``$($otherPackageHashes['02B_SEED_PRE_MIGRATION_PRODUCT_FIXTURES.sql'])`` |")
$manifestLines.Add("| 6 | ``02C_APPLY_ACCESS_EPOCH_MIGRATION.sql`` | **generated** (mechanically assembled from the one migration under test) | ``$accessEpochBundleHash`` |")
$manifestLines.Add("| 7 | ``03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql`` | hand-authored | ``$($otherPackageHashes['03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql'])`` |")
$manifestLines.Add("| 8 | ``04_CAPTURE_RESULTS.md`` | hand-authored | ``$($otherPackageHashes['04_CAPTURE_RESULTS.md'])`` |")
$manifestLines.Add('| 9 | `MANIFEST.md` | **generated** (this file) | *(intentionally not embedded -- see below)* |')
$manifestLines.Add("| 10 | ``build-phase8-access-epoch-runtime-package.ps1`` | hand-authored (this generator) | ``$($otherPackageHashes['build-phase8-access-epoch-runtime-package.ps1'])`` |")
$manifestLines.Add('')
$manifestLines.Add('The Phase 8 Access Epoch implementation report itself is not a package')
$manifestLines.Add('file -- it lives at')
$manifestLines.Add('`docs/TEXT2TASK_CLIENT_SHARE_LINK_ACCESS_EPOCH_IMPLEMENTATION_REPORT_2026-08-25.md`,')
$manifestLines.Add('outside this package directory, and this generator only reads it (to confirm')
$manifestLines.Add('it exists) -- it never writes to it. Its hash at generation time was')
$manifestLines.Add("``$($otherPackageHashes['TEXT2TASK_CLIENT_SHARE_LINK_ACCESS_EPOCH_IMPLEMENTATION_REPORT_2026-08-25.md'])``.")
$manifestLines.Add('')
$manifestLines.Add('### Why row 8 has no embedded hash')
$manifestLines.Add('')
$manifestLines.Add('Same reasoning as every prior package''s manifest: embedding would require a')
$manifestLines.Add('self-referential fixed point. The generator prints `MANIFEST.md`''s SHA-256')
$manifestLines.Add('to the console (`MANIFEST_SHA256=`) instead.')
$manifestLines.Add('')
$manifestLines.Add('## Prerequisite migration hashes (SHA-256 of file contents, LF-normalized)')
$manifestLines.Add('')
$manifestLines.Add('Applied by file 02, in this exact order, verbatim and unmodified.')
$manifestLines.Add('')
$manifestLines.Add('| # | Migration | SHA-256 |')
$manifestLines.Add('|---|---|---|')
$i = 1
foreach ($name in $prerequisiteSourceFiles) {
  $manifestLines.Add("| $i | ``$($prereqRelativePaths[$name])`` | ``$($prereqHashes[$name])`` |")
  $i++
}
$manifestLines.Add('')
$manifestLines.Add('## The migration under test')
$manifestLines.Add('')
$manifestLines.Add('| Migration | SHA-256 |')
$manifestLines.Add('|---|---|')
$manifestLines.Add("| ``supabase/migrations/$accessEpochMigrationFile`` | ``$accessEpochHash`` |")
$manifestLines.Add('')
$manifestLines.Add('**This is the value to independently verify against the real repository file**')
$manifestLines.Add('before applying `02C_APPLY_ACCESS_EPOCH_MIGRATION.sql` to any disposable')
$manifestLines.Add('project, and again before this migration is ever applied to Production --')
$manifestLines.Add('see `00_READ_ME_FIRST.md`''s own item J note.')
$manifestLines.Add('')
$manifestLines.Add('## To reproduce or re-verify these hashes')
$manifestLines.Add('')
$manifestLines.Add('```')
$manifestLines.Add('powershell -File scripts/client-share/build-phase8-access-epoch-runtime-package.ps1')
$manifestLines.Add('```')
$manifestLines.Add('')
$manifestLines.Add('## Confirmations')
$manifestLines.Add('')
$manifestLines.Add('- The generator is read-only against `supabase/migrations/**`.')
$manifestLines.Add('- All three generated outputs are built and fully validated together in a')
$manifestLines.Add('  temporary staging subdirectory BEFORE any real package file is touched.')
$manifestLines.Add('- File 02''s content was assembled from the exact, unmodified text of the')
$manifestLines.Add('  seventeen prerequisite migrations above, mechanically verified every run.')
$manifestLines.Add('- File 02C''s content was assembled from the exact, unmodified text of the')
$manifestLines.Add('  one migration under test, mechanically verified every run.')
$manifestLines.Add('- This package does not modify any other existing Client Share runtime')
$manifestLines.Add('  package or generator in any way, and does not target any other package''s')
$manifestLines.Add('  own disposable Supabase project.')
$manifestLines.Add('- No Production project URL, project reference, credential or environment')
$manifestLines.Add('  value appears anywhere in this package.')
$manifestLines.Add('- This file embeds no wall-clock timestamp; re-running the generator against')
$manifestLines.Add('  unchanged inputs reproduces it byte-for-byte.')
$manifestLines.Add('')

$manifest = ($manifestLines -join "`n") -replace "`r`n", "`n" -replace "`r", "`n"
if (-not $manifest.EndsWith("`n")) {
  $manifest += "`n"
}

# ---------------------------------------------------------------------
# 10. Stage all three generated outputs, validate, and only then replace
#     the real files.
# ---------------------------------------------------------------------
$stagingDir = Join-Path $packageDir '.generator-staging'
if (Test-Path -LiteralPath $stagingDir) {
  Remove-Item -LiteralPath $stagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

$stagedPrereqBundle = Join-Path $stagingDir $prereqBundleFileName
$stagedAccessEpochBundle = Join-Path $stagingDir $accessEpochBundleFileName
$stagedManifest = Join-Path $stagingDir $manifestFileName

try {
  Write-StagedFile -StagingPath $stagedPrereqBundle -Content $prereqBundle
  Write-StagedFile -StagingPath $stagedAccessEpochBundle -Content $accessEpochBundle
  Write-StagedFile -StagingPath $stagedManifest -Content $manifest

  $stagedPrereqReadBack = Get-NormalizedContent -Path $stagedPrereqBundle
  $stagedPrereqHash = Get-Sha256Hex -Text $stagedPrereqReadBack
  if ($stagedPrereqHash -ne $prereqBundleHash) {
    throw "Validation failed: staged prerequisite bundle hash ($stagedPrereqHash) does not match the in-memory bundle hash ($prereqBundleHash)."
  }

  $stagedAccessEpochReadBack = Get-NormalizedContent -Path $stagedAccessEpochBundle
  $stagedAccessEpochHash = Get-Sha256Hex -Text $stagedAccessEpochReadBack
  if ($stagedAccessEpochHash -ne $accessEpochBundleHash) {
    throw "Validation failed: staged access-epoch bundle hash ($stagedAccessEpochHash) does not match the in-memory bundle hash ($accessEpochBundleHash)."
  }

  $stagedManifestReadBack = Get-NormalizedContent -Path $stagedManifest
  $stagedManifestHash = Get-Sha256Hex -Text $stagedManifestReadBack
  $inMemoryManifestHash = Get-Sha256Hex -Text $manifest
  if ($stagedManifestHash -ne $inMemoryManifestHash) {
    throw "Validation failed: staged manifest hash ($stagedManifestHash) does not match the in-memory manifest hash ($inMemoryManifestHash)."
  }

  $stagedCount = @(Get-ChildItem -LiteralPath $stagingDir -File).Count
  if ($stagedCount -ne 3) {
    throw "Validation failed: expected exactly 3 staged generated outputs, found $stagedCount."
  }
  Write-Host "Staged output validation passed: exactly $stagedCount generated outputs staged and hash-verified."

  Move-Item -LiteralPath $stagedPrereqBundle -Destination $prereqBundleFile -Force
  Move-Item -LiteralPath $stagedAccessEpochBundle -Destination $accessEpochBundleFile -Force
  Move-Item -LiteralPath $stagedManifest -Destination $manifestFile -Force
} finally {
  if (Test-Path -LiteralPath $stagingDir) {
    Remove-Item -LiteralPath $stagingDir -Recurse -Force
  }
}

Write-Host "Wrote generated prerequisite bundle to: $prereqBundleFile"
Write-Host "Wrote generated access-epoch bundle to: $accessEpochBundleFile"
Write-Host "Wrote generated manifest to: $manifestFile"

# ---------------------------------------------------------------------
# 11. Final validation against the files as actually written.
# ---------------------------------------------------------------------
$finalPrereqContent = Get-NormalizedContent -Path $prereqBundleFile
$finalPrereqHash = Get-Sha256Hex -Text $finalPrereqContent
if ($finalPrereqHash -ne $prereqBundleHash) {
  throw "Validation failed: final prerequisite bundle hash ($finalPrereqHash) does not match the in-memory bundle hash ($prereqBundleHash)."
}

$finalAccessEpochContent = Get-NormalizedContent -Path $accessEpochBundleFile
$finalAccessEpochHash = Get-Sha256Hex -Text $finalAccessEpochContent
if ($finalAccessEpochHash -ne $accessEpochBundleHash) {
  throw "Validation failed: final access-epoch bundle hash ($finalAccessEpochHash) does not match the in-memory bundle hash ($accessEpochBundleHash)."
}

$finalManifestContent = Get-NormalizedContent -Path $manifestFile
$finalManifestHash = Get-Sha256Hex -Text $finalManifestContent

$actualGeneratedCount = 0
foreach ($target in $generatedOutputs) {
  if (Test-Path -LiteralPath $target) { $actualGeneratedCount++ }
}
if ($actualGeneratedCount -ne 3) {
  throw "Validation failed: expected exactly 3 generated output files to exist after replacement, found $actualGeneratedCount."
}
Write-Host "Final output validation passed: exactly $actualGeneratedCount generated outputs present and hash-verified at their real locations."

# ---------------------------------------------------------------------
# 12. Console summary.
# ---------------------------------------------------------------------
Write-Host ''
Write-Host '=== SHA-256 SUMMARY ==='
foreach ($name in $prerequisiteSourceFiles) {
  Write-Host "$($prereqRelativePaths[$name]) : $($prereqHashes[$name])"
}
Write-Host "supabase/migrations/$accessEpochMigrationFile (migration under test) : $accessEpochHash"
Write-Host "$prereqBundleFileName (generated) : $finalPrereqHash"
Write-Host "$accessEpochBundleFileName (generated) : $finalAccessEpochHash"
foreach ($key in $otherPackageHashes.Keys) {
  Write-Host "$key : $($otherPackageHashes[$key])"
}
Write-Host "MANIFEST_SHA256=$finalManifestHash"
Write-Host ''
Write-Host "MIGRATION_UNDER_TEST_SHA256=$accessEpochHash"
Write-Host ''
Write-Host "Generated output paths (exactly 3):"
Write-Host "  $prereqBundleFile"
Write-Host "  $accessEpochBundleFile"
Write-Host "  $manifestFile"
Write-Host "Generated output count: $actualGeneratedCount"
Write-Host ''
Write-Host 'PACKAGE_VERIFICATION_STATUS: PASS'
