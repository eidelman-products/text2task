<#
.SYNOPSIS
  Mechanically builds BOTH generated outputs of the Phase 2B mapping-read
  corrective foundation runtime verification package:
    docs/client-share-phase2b-mapping-read-runtime/02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql
    docs/client-share-phase2b-mapping-read-runtime/MANIFEST.md

.DESCRIPTION
  This is the Phase 2B mapping-read counterpart of
  scripts/client-share/build-phase1c-runtime-package.ps1, extended from
  eight source migrations to nine (adding
  202608110002_client_share_management_mapping_metadata.sql), producing
  the same two generated outputs in a different package directory. It
  does not read, write or modify anything under
  docs/client-share-phase1b-runtime/, docs/client-share-phase1c-runtime/
  or either prior generator script.

  Same guarantees as the Phase 1B/1C generators:
    - never modifies the nine source migration files
    - never runs any SQL
    - never connects to Supabase
    - never uses any credential or project reference
    - never calls Get-Date or embeds any wall-clock timestamp
    - builds both generated outputs in a temporary staging subdirectory
      first and validates both staged outputs completely BEFORE either
      real package file is touched
    - inserts a generated, non-executable source-path + SHA-256 comment
      immediately before each migration's BEGIN boundary marker in the
      apply bundle, without altering the migration body itself in any way
    - regenerates MANIFEST.md's full file inventory and hash table from
      the same computed hashes

  Run manually, once, from anywhere inside the repository:
    powershell -File scripts/client-share/build-phase2b-mapping-read-runtime-package.ps1
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
$packageDir = Join-Path $repoRoot 'docs\client-share-phase2b-mapping-read-runtime'

$sourceFiles = @(
  '202608030003_client_share_owner_foundation.sql',
  '202608030004_client_share_session_foundation.sql',
  '202608030005_client_share_integrity_and_security.sql',
  '202608050001_client_share_owner_reads.sql',
  '202608060001_client_share_lifecycle_operations.sql',
  '202608060002_client_share_access_operations.sql',
  '202608060003_client_share_configuration_save.sql',
  '202608110001_client_share_publication_intent.sql',
  '202608110002_client_share_management_mapping_metadata.sql'
)

$bundleFileName = '02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql'
$manifestFileName = 'MANIFEST.md'
$bundleFile = Join-Path $packageDir $bundleFileName
$manifestFile = Join-Path $packageDir $manifestFileName

$generatedOutputs = @($bundleFile, $manifestFile)

# ---------------------------------------------------------------------
# 2. Refuse to write anywhere outside the allowed package directory, and
#    only ever to these two named files.
# ---------------------------------------------------------------------
$resolvedPackageDir = (Resolve-Path $packageDir).Path
foreach ($target in $generatedOutputs) {
  $resolvedParent = Split-Path -Parent $target
  if ((Resolve-Path $resolvedParent).Path -ne $resolvedPackageDir) {
    throw "Refusing to run: computed output path '$target' is not inside the allowed package directory '$resolvedPackageDir'."
  }
}
if ((Split-Path -Leaf $bundleFile) -ne $bundleFileName) {
  throw "Refusing to run: the apply-bundle generator target may only ever be '$bundleFileName'."
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
# 4. Read and hash the nine authoritative source migrations. Read-only
#    against supabase/migrations/ -- only Get-Content, never a write.
# ---------------------------------------------------------------------
$sourceContents = [ordered]@{}
$sourceHashes = [ordered]@{}
$sourceRelativePaths = [ordered]@{}

foreach ($name in $sourceFiles) {
  $path = Join-Path $migrationsDir $name
  $content = Get-NormalizedContent -Path $path
  $sourceContents[$name] = $content
  $sourceHashes[$name] = Get-Sha256Hex -Text $content
  $sourceRelativePaths[$name] = "supabase/migrations/$name"
  Write-Host "Read source migration: $name  sha256=$($sourceHashes[$name])"
}

# ---------------------------------------------------------------------
# 5. Build the apply bundle: safety preamble, each source verbatim with a
#    generated source-path + SHA-256 comment and clear non-executable
#    boundary markers, then a final verification query.
# ---------------------------------------------------------------------
$header = @'
-- Text2Task Client Share Link -- Phase 2B Mapping-Read Corrective
-- Foundation Runtime Verification Package
-- File 02: Exact Client Share migration bundle through Phase 2B's
-- mapping-read correction
-- (MECHANICALLY GENERATED)
--
-- Generated by
-- scripts/client-share/build-phase2b-mapping-read-runtime-package.ps1.
-- Do not hand-edit this file -- edit the nine source migrations under
-- supabase/migrations/ and re-run the generator instead.
--
-- Run this SECOND, after 01_CREATE_TEMP_TEST_FIXTURE.sql, in the same
-- brand-new, temporary Supabase project. Never run this in the real
-- Text2Task production project.
--
-- This file contains the EXACT, UNMODIFIED contents of, in order:
--   1. 202608030003_client_share_owner_foundation.sql
--   2. 202608030004_client_share_session_foundation.sql
--   3. 202608030005_client_share_integrity_and_security.sql
--   4. 202608050001_client_share_owner_reads.sql
--   5. 202608060001_client_share_lifecycle_operations.sql
--   6. 202608060002_client_share_access_operations.sql
--   7. 202608060003_client_share_configuration_save.sql
--   8. 202608110001_client_share_publication_intent.sql
--   9. 202608110002_client_share_management_mapping_metadata.sql
-- with only a safety preamble, one generated source-path/hash comment per
-- migration, and a verification query added around them.

-- =========================================================
-- SAFETY PREAMBLE (generated -- not part of any migration)
-- =========================================================

do $safety_preamble$
declare
  v_sentinel_kind text;
begin
  if to_regclass('public.text2task_client_share_phase2b_mapping_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 2B mapping-read runtime test sentinel was not found in this project. Run 01_CREATE_TEMP_TEST_FIXTURE.sql here first, and only ever inside a brand-new temporary Supabase project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase2b_mapping_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_2B_MAPPING_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row in this project does not identify it as a disposable Phase 2B mapping-read runtime test project.';
  end if;

  if to_regclass('public.project_share_links') is not null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.project_share_links already exists in this project. This bundle only applies fresh Client Share Link migrations to an empty test project; it never adopts, adapts around, or overwrites an existing table.';
  end if;
end;
$safety_preamble$;

'@

$footer = @'

-- =========================================================
-- FINAL VERIFICATION (generated -- not part of any migration)
--
-- Structural existence check only. File 03 (Section A onward) is the
-- authoritative runtime check for constraints, indexes, defaults and
-- exact-signature RPC security; this query is a fast smoke check only.
-- =========================================================

select
  check_item.kind,
  check_item.name,
  case check_item.kind
    when 'table' then to_regclass('public.' || check_item.name) is not null
    when 'function' then to_regprocedure('public.' || check_item.name) is not null
    when 'trigger' then exists (
      select 1
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and t.tgname = check_item.name
        and not t.tgisinternal
    )
    when 'column' then exists (
      select 1
      from information_schema.columns col
      where col.table_schema = 'public'
        and col.table_name = split_part(check_item.name, '.', 1)
        and col.column_name = split_part(check_item.name, '.', 2)
    )
  end as found
from (
  values
    ('table', 'project_share_links'),
    ('table', 'share_link_tasks'),
    ('table', 'share_link_resources'),
    ('table', 'share_link_updates'),
    ('table', 'share_messages'),
    ('table', 'share_message_conversions'),
    ('table', 'share_browser_sessions'),
    ('table', 'share_session_grants'),
    ('table', 'share_link_events'),
    ('table', 'share_rate_limit_buckets'),
    ('table', 'project_share_secret_material'),
    ('column', 'project_share_links.title_visible'),
    ('column', 'project_share_links.status_visible'),
    ('column', 'project_share_links.target_date_visible'),
    ('function', 'set_client_share_updated_at()'),
    ('function', 'enforce_project_share_link_integrity()'),
    ('function', 'enforce_share_link_task_integrity()'),
    ('function', 'enforce_share_link_resource_integrity()'),
    ('function', 'enforce_share_link_update_integrity()'),
    ('function', 'enforce_share_message_integrity()'),
    ('function', 'enforce_share_message_conversion_integrity()'),
    ('function', 'enforce_share_browser_session_integrity()'),
    ('function', 'enforce_share_session_grant_integrity()'),
    ('function', 'get_share_link_management_state(uuid)'),
    ('function', 'list_share_link_summaries(uuid[])'),
    ('function', 'create_share_link_draft(uuid,text)'),
    ('function', 'activate_share_link(uuid,text,smallint,text,text,text,smallint)'),
    ('function', 'disable_share_link(uuid)'),
    ('function', 'reenable_share_link(uuid)'),
    ('function', 'set_share_link_pin(uuid,text,text,smallint,integer,integer,integer,integer)'),
    ('function', 'clear_share_link_pin(uuid)'),
    ('function', 'set_share_link_expiry(uuid,timestamptz)'),
    ('function', 'clear_share_link_expiry(uuid)'),
    ('function', 'rotate_share_link_secret(uuid,text,smallint,text,text,text,smallint)'),
    ('function', 'revoke_share_link(uuid)'),
    ('function', 'reveal_share_link_secret(uuid)'),
    ('function', 'save_share_configuration(uuid,jsonb,jsonb,jsonb,jsonb)'),
    ('trigger', 'project_share_links_set_updated_at'),
    ('trigger', 'share_link_tasks_set_updated_at'),
    ('trigger', 'share_link_resources_set_updated_at'),
    ('trigger', 'share_messages_set_updated_at'),
    ('trigger', 'share_rate_limit_buckets_set_updated_at'),
    ('trigger', 'project_share_secret_material_set_updated_at'),
    ('trigger', 'project_share_links_enforce_integrity'),
    ('trigger', 'share_link_tasks_enforce_integrity'),
    ('trigger', 'share_link_resources_enforce_integrity'),
    ('trigger', 'share_link_updates_enforce_integrity'),
    ('trigger', 'share_messages_enforce_integrity'),
    ('trigger', 'share_message_conversions_enforce_integrity'),
    ('trigger', 'share_browser_sessions_enforce_integrity'),
    ('trigger', 'share_session_grants_enforce_integrity')
) as check_item(kind, name)
order by check_item.kind, check_item.name;
'@

$bundleParts = New-Object System.Collections.Generic.List[string]
$bundleParts.Add($header)

foreach ($name in $sourceFiles) {
  $sourceComment = "-- Source: $($sourceRelativePaths[$name])`n-- SHA-256 (normalized LF UTF-8): $($sourceHashes[$name])`n"
  $bundleParts.Add("$sourceComment-- ===== BEGIN $name (verbatim, unmodified) =====`n")
  $bundleParts.Add($sourceContents[$name])
  $bundleParts.Add("`n-- ===== END $name =====`n")
}

$bundleParts.Add($footer)

$bundle = ($bundleParts -join "`n") -replace "`r`n", "`n" -replace "`r", "`n"

# ---------------------------------------------------------------------
# 6. Mechanically verify each source appears exactly once, in order, and
#    that the generated source-hash comment for each migration exactly
#    matches its freshly-computed hash.
# ---------------------------------------------------------------------
$positions = @()
foreach ($name in $sourceFiles) {
  $beginMarker = "-- ===== BEGIN $name (verbatim, unmodified) ====="
  $occurrences = ([regex]::Matches($bundle, [regex]::Escape($beginMarker))).Count
  if ($occurrences -ne 1) {
    throw "Verification failed: '$name' begin-marker appears $occurrences time(s) in the generated bundle; expected exactly 1."
  }
  $positions += $bundle.IndexOf($beginMarker)

  $expectedComment = "-- SHA-256 (normalized LF UTF-8): $($sourceHashes[$name])"
  if (-not $bundle.Contains($expectedComment)) {
    throw "Verification failed: generated source-hash comment for '$name' not found or does not match its computed hash."
  }
}
for ($i = 1; $i -lt $positions.Count; $i++) {
  if ($positions[$i] -le $positions[$i - 1]) {
    throw "Verification failed: source migrations are not in the required order inside the generated bundle."
  }
}
Write-Host 'Order verification passed: all nine source migrations, each exactly once, each with a matching source-hash comment.'

$bundleHash = Get-Sha256Hex -Text $bundle

# ---------------------------------------------------------------------
# 7. Hash the other hand-authored package files that MANIFEST.md needs to
#    describe.
# ---------------------------------------------------------------------
$otherPackageFiles = [ordered]@{
  '00_READ_ME_FIRST.md' = @{ Path = (Join-Path $packageDir '00_READ_ME_FIRST.md'); Origin = 'hand-authored' }
  '01_CREATE_TEMP_TEST_FIXTURE.sql' = @{ Path = (Join-Path $packageDir '01_CREATE_TEMP_TEST_FIXTURE.sql'); Origin = 'hand-authored' }
  '03_RUN_PHASE2B_MAPPING_READ_RUNTIME_TESTS.sql' = @{ Path = (Join-Path $packageDir '03_RUN_PHASE2B_MAPPING_READ_RUNTIME_TESTS.sql'); Origin = 'hand-authored' }
  '04_CAPTURE_RESULTS.md' = @{ Path = (Join-Path $packageDir '04_CAPTURE_RESULTS.md'); Origin = 'hand-authored' }
  '05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md' = @{ Path = (Join-Path $packageDir '05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md'); Origin = 'hand-authored' }
  'build-phase2b-mapping-read-runtime-package.ps1' = @{ Path = $MyInvocation.MyCommand.Path; Origin = 'hand-authored (this generator)' }
}

$otherPackageHashes = [ordered]@{}
foreach ($key in $otherPackageFiles.Keys) {
  $content = Get-NormalizedContent -Path $otherPackageFiles[$key].Path
  $otherPackageHashes[$key] = Get-Sha256Hex -Text $content
  Write-Host "Read package file: $key  sha256=$($otherPackageHashes[$key])"
}

# ---------------------------------------------------------------------
# 8. Build MANIFEST.md deterministically.
# ---------------------------------------------------------------------
$manifestLines = New-Object System.Collections.Generic.List[string]
$manifestLines.Add('# Client Share Link -- Phase 2B Mapping-Read Corrective Foundation Runtime Verification Package Manifest')
$manifestLines.Add('')
$manifestLines.Add('Mechanically generated by `scripts/client-share/build-phase2b-mapping-read-runtime-package.ps1`.')
$manifestLines.Add('Deterministic from repository/package file contents alone -- no wall-clock')
$manifestLines.Add('timestamp, build number or `Get-Date` value is embedded anywhere in this file.')
$manifestLines.Add('Re-run the generator to reproduce it exactly, or to pick up source changes.')
$manifestLines.Add('')
$manifestLines.Add('## Package files (all eight approved files)')
$manifestLines.Add('')
$manifestLines.Add('| # | File | Origin | SHA-256 |')
$manifestLines.Add('|---|---|---|---|')
$manifestLines.Add("| 1 | ``00_READ_ME_FIRST.md`` | hand-authored | ``$($otherPackageHashes['00_READ_ME_FIRST.md'])`` |")
$manifestLines.Add("| 2 | ``01_CREATE_TEMP_TEST_FIXTURE.sql`` | hand-authored | ``$($otherPackageHashes['01_CREATE_TEMP_TEST_FIXTURE.sql'])`` |")
$manifestLines.Add("| 3 | ``02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql`` | **generated** (mechanically assembled from the nine source migrations below) | ``$bundleHash`` |")
$manifestLines.Add("| 4 | ``03_RUN_PHASE2B_MAPPING_READ_RUNTIME_TESTS.sql`` | hand-authored | ``$($otherPackageHashes['03_RUN_PHASE2B_MAPPING_READ_RUNTIME_TESTS.sql'])`` |")
$manifestLines.Add("| 5 | ``04_CAPTURE_RESULTS.md`` | hand-authored | ``$($otherPackageHashes['04_CAPTURE_RESULTS.md'])`` |")
$manifestLines.Add("| 6 | ``05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`` | hand-authored | ``$($otherPackageHashes['05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md'])`` |")
$manifestLines.Add('| 7 | `MANIFEST.md` | **generated** (this file) | *(intentionally not embedded -- see below)* |')
$manifestLines.Add("| 8 | ``build-phase2b-mapping-read-runtime-package.ps1`` | hand-authored (this generator) | ``$($otherPackageHashes['build-phase2b-mapping-read-runtime-package.ps1'])`` |")
$manifestLines.Add('')
$manifestLines.Add('### Why row 7 has no embedded hash')
$manifestLines.Add('')
$manifestLines.Add('Same reasoning as the Phase 1B/1C manifests: embedding would require a')
$manifestLines.Add('self-referential fixed point. The generator prints `MANIFEST.md`''s SHA-256')
$manifestLines.Add('to the console (`MANIFEST_SHA256=`) instead.')
$manifestLines.Add('')
$manifestLines.Add('## Source migration hashes (SHA-256 of file contents, LF-normalized)')
$manifestLines.Add('')
$manifestLines.Add('Applied by file 02, in this exact order, verbatim and unmodified.')
$manifestLines.Add('')
$manifestLines.Add('| # | Migration | SHA-256 |')
$manifestLines.Add('|---|---|---|')
$i = 1
foreach ($name in $sourceFiles) {
  $manifestLines.Add("| $i | ``$($sourceRelativePaths[$name])`` | ``$($sourceHashes[$name])`` |")
  $i++
}
$manifestLines.Add('')
$manifestLines.Add('Hashes 1-8 should match the values already recorded in')
$manifestLines.Add('`docs/client-share-phase1c-runtime/MANIFEST.md` for the same eight files --')
$manifestLines.Add('those migrations have not changed since Phase 1C''s own package was')
$manifestLines.Add('generated and runtime-verified. Hash 9 is new in this package.')
$manifestLines.Add('')
$manifestLines.Add('## To reproduce or re-verify these hashes')
$manifestLines.Add('')
$manifestLines.Add('```')
$manifestLines.Add('powershell -File scripts/client-share/build-phase2b-mapping-read-runtime-package.ps1')
$manifestLines.Add('```')
$manifestLines.Add('')
$manifestLines.Add('## Confirmations')
$manifestLines.Add('')
$manifestLines.Add('- The generator is read-only against `supabase/migrations/**`.')
$manifestLines.Add('- Both generated outputs are built and fully validated together in a')
$manifestLines.Add('  temporary staging subdirectory BEFORE either real package file is touched.')
$manifestLines.Add('- File 02''s content was assembled from the exact, unmodified text of the')
$manifestLines.Add('  nine source migrations above, mechanically verified every run.')
$manifestLines.Add('- This package does not modify the separate, existing')
$manifestLines.Add('  `docs/client-share-phase1b-runtime/` or `docs/client-share-phase1c-runtime/`')
$manifestLines.Add('  packages or either prior generator in any way.')
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
# 9. Stage both generated outputs, validate, and only then replace the
#    two real files.
# ---------------------------------------------------------------------
$stagingDir = Join-Path $packageDir '.generator-staging'
if (Test-Path -LiteralPath $stagingDir) {
  Remove-Item -LiteralPath $stagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

$stagedBundle = Join-Path $stagingDir $bundleFileName
$stagedManifest = Join-Path $stagingDir $manifestFileName

try {
  Write-StagedFile -StagingPath $stagedBundle -Content $bundle
  Write-StagedFile -StagingPath $stagedManifest -Content $manifest

  $stagedBundleReadBack = Get-NormalizedContent -Path $stagedBundle
  $stagedBundleHash = Get-Sha256Hex -Text $stagedBundleReadBack
  if ($stagedBundleHash -ne $bundleHash) {
    throw "Validation failed: staged bundle hash ($stagedBundleHash) does not match the in-memory bundle hash ($bundleHash)."
  }

  $stagedManifestReadBack = Get-NormalizedContent -Path $stagedManifest
  $stagedManifestHash = Get-Sha256Hex -Text $stagedManifestReadBack
  $inMemoryManifestHash = Get-Sha256Hex -Text $manifest
  if ($stagedManifestHash -ne $inMemoryManifestHash) {
    throw "Validation failed: staged manifest hash ($stagedManifestHash) does not match the in-memory manifest hash ($inMemoryManifestHash)."
  }

  $stagedCount = @(Get-ChildItem -LiteralPath $stagingDir -File).Count
  if ($stagedCount -ne 2) {
    throw "Validation failed: expected exactly 2 staged generated outputs, found $stagedCount."
  }
  Write-Host "Staged output validation passed: exactly $stagedCount generated outputs staged and hash-verified."

  Move-Item -LiteralPath $stagedBundle -Destination $bundleFile -Force
  Move-Item -LiteralPath $stagedManifest -Destination $manifestFile -Force
} finally {
  if (Test-Path -LiteralPath $stagingDir) {
    Remove-Item -LiteralPath $stagingDir -Recurse -Force
  }
}

Write-Host "Wrote generated bundle to: $bundleFile"
Write-Host "Wrote generated manifest to: $manifestFile"

# ---------------------------------------------------------------------
# 10. Final validation against the files as actually written.
# ---------------------------------------------------------------------
$finalBundleContent = Get-NormalizedContent -Path $bundleFile
$finalBundleHash = Get-Sha256Hex -Text $finalBundleContent
if ($finalBundleHash -ne $bundleHash) {
  throw "Validation failed: final bundle hash ($finalBundleHash) does not match the in-memory bundle hash ($bundleHash)."
}

$finalManifestContent = Get-NormalizedContent -Path $manifestFile
$finalManifestHash = Get-Sha256Hex -Text $finalManifestContent

$actualGeneratedCount = 0
foreach ($target in $generatedOutputs) {
  if (Test-Path -LiteralPath $target) { $actualGeneratedCount++ }
}
if ($actualGeneratedCount -ne 2) {
  throw "Validation failed: expected exactly 2 generated output files to exist after replacement, found $actualGeneratedCount."
}
Write-Host "Final output validation passed: exactly $actualGeneratedCount generated outputs present and hash-verified at their real locations."

# ---------------------------------------------------------------------
# 11. Console summary.
# ---------------------------------------------------------------------
Write-Host ''
Write-Host '=== SHA-256 SUMMARY ==='
foreach ($name in $sourceFiles) {
  Write-Host "$($sourceRelativePaths[$name]) : $($sourceHashes[$name])"
}
Write-Host "$bundleFileName (generated) : $finalBundleHash"
foreach ($key in $otherPackageHashes.Keys) {
  Write-Host "$key : $($otherPackageHashes[$key])"
}
Write-Host "MANIFEST_SHA256=$finalManifestHash"
Write-Host ''
Write-Host "Generated output paths (exactly 2):"
Write-Host "  $bundleFile"
Write-Host "  $manifestFile"
Write-Host "Generated output count: $actualGeneratedCount"
Write-Host ''
Write-Host 'PACKAGE_VERIFICATION_STATUS: PASS'
