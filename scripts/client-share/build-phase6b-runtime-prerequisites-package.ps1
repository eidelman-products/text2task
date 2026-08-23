<#
.SYNOPSIS
  Mechanically builds the Phase 6B Apply-RPC runtime prerequisite bundle:
    docs/client-share-phase6b-runtime/00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql
  and regenerates docs/client-share-phase6b-runtime/MANIFEST.md to include it.

.DESCRIPTION
  Root cause this package fixes: the Phase 6A disposable runtime package
  (docs/client-share-phase6a-runtime/) deliberately EXCLUDED every migration
  that only `create or replace function`s apply_project_update_transaction
  (that package's own generator, build-phase6a-runtime-package.ps1, says so
  explicitly in its header comment) -- Phase 6A's own runtime tests never
  called that RPC, so it was correctly out of scope there. Phase 6B's own
  runtime tests (01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql, sections I and
  K) DO call it directly, so the disposable project needs the REAL,
  currently-authoritative function installed before those sections can mean
  anything.

  Dependency analysis (see this repository's own DB-boundary audit and the
  Phase 6B runtime-harness-correction report for the full trace): five
  migrations redefine apply_project_update_transaction over time --
  202606150008 (original), 202606160001, 202606160002, 202607020005, and
  202607270001 (current, authoritative). Only 202607270001 needs to be
  applied here:
    - 202606160002, 202607020005 and 202607270001 are each a COMPLETE,
      self-contained `create or replace function` (a full body, not a
      diff) -- applying the last one alone produces the exact same end
      state as applying all of them in order, on top of ANY starting
      state (including a disposable project where the function does not
      exist yet at all).
    - 202606160001 is the one exception: it does NOT redefine the function
      statically. It reads the function's CURRENT definition via
      pg_get_functiondef(), string-replaces one expression, and
      re-executes the patched source -- a genuine runtime dependency on
      202606150008's exact original body being present first. But its own
      net effect is itself immediately superseded by 202606160002's full
      replace one migration later, so it contributes nothing to the FINAL
      state this package needs to reproduce, and bundling it would only
      add a real, avoidable fragility (it actively FAILS if run against
      any state other than the exact one it expects) for zero benefit.
    - No other schema dependency exists: apply_project_update_transaction,
      reconcile_project_completion and apply_task_bulk_status_transaction
      (all three defined by 202607270001) are plpgsql functions, which
      Postgres compiles lazily on first EXECUTION, not at CREATE FUNCTION
      time -- so their %ROWTYPE and column references against
      projects/tasks/clients do not need those tables' full production
      column set to exist merely for CREATE OR REPLACE FUNCTION to
      succeed. Phase 6B's own runtime tests only ever call this RPC along
      a path that exits at its very first status-precondition check
      (APPLY_ATTEMPT_MISMATCH), before the function ever touches
      projects/tasks/clients at all -- confirmed by direct trace of the
      current function body -- so no fixture table extension is needed
      either.

  Same generation guarantees as every prior generator in this family:
    - never modifies any source migration file
    - never runs any SQL
    - never connects to Supabase
    - never uses any credential or project reference
    - never calls Get-Date or embeds any wall-clock timestamp
    - builds the generated output in a temporary staging file first and
      validates it completely BEFORE the real package file is touched
    - inserts a generated, non-executable source-path + SHA-256 comment
      immediately before the migration's own content, without altering
      the migration body itself in any way
    - regenerates MANIFEST.md's full file inventory and hash table
    - fails closed (throws, writes nothing) if the source migration file
      is absent

  Run manually, once, from anywhere inside the repository:
    powershell -File scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..\..')
Write-Host "Repository root resolved to: $repoRoot"

$migrationsDir = Join-Path $repoRoot 'supabase\migrations'
$packageDir = Join-Path $repoRoot 'docs\client-share-phase6b-runtime'

$sourceName = '202607270001_project_completion_reconciliation.sql'
$sourceRelativePath = "supabase/migrations/$sourceName"
$sourcePath = Join-Path $migrationsDir $sourceName

$outputFileName = '00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql'
$manifestFileName = 'MANIFEST.md'
$outputFile = Join-Path $packageDir $outputFileName
$manifestFile = Join-Path $packageDir $manifestFileName

# ---------------------------------------------------------------------
# Refuse to write anywhere outside the allowed package directory.
# ---------------------------------------------------------------------
$resolvedPackageDir = (Resolve-Path $packageDir).Path
foreach ($target in @($outputFile, $manifestFile)) {
  $resolvedParent = Split-Path -Parent $target
  if ((Resolve-Path $resolvedParent).Path -ne $resolvedPackageDir) {
    throw "Refusing to run: computed output path '$target' is not inside the allowed package directory '$resolvedPackageDir'."
  }
}

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
  try { $hashBytes = $sha.ComputeHash($bytes) } finally { $sha.Dispose() }
  return ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant()
}

function Write-StagedFile {
  param([string]$StagingPath, [string]$Content)
  [System.IO.File]::WriteAllText($StagingPath, $Content, [System.Text.UTF8Encoding]::new($false))
}

# ---------------------------------------------------------------------
# Read and hash the single authoritative source migration.
# ---------------------------------------------------------------------
$sourceContent = Get-NormalizedContent -Path $sourcePath
$sourceHash = Get-Sha256Hex -Text $sourceContent
Write-Host "Read source migration: $sourceName  sha256=$sourceHash"

# ---------------------------------------------------------------------
# Truncate the ONE-TIME HISTORICAL BACKFILL statement (the file's own
# trailing statement, clearly delineated by this exact comment marker).
# Root-cause finding from the first prerequisite-package run: unlike the
# three CREATE OR REPLACE FUNCTION bodies above it (plpgsql function
# bodies are lazily compiled -- Postgres does not validate their
# embedded SQL's column references against the live catalog until the
# function is actually CALLED, regardless of check_function_bodies),
# this backfill is a plain, directly-executed top-level
# `WITH ... UPDATE public.projects ...` statement. Postgres validates a
# top-level DML statement's column references immediately when it runs
# -- so it fails now with `42703 column project.status does not exist`
# against the Phase 6A disposable fixture's intentionally minimal
# `projects` stand-in (id/user_id/deleted_at/is_archived/created_at
# only). check_function_bodies=off would have NO effect here: that
# setting only relaxes CREATE FUNCTION's own body-validation pass; it
# does not apply to an ordinary top-level statement that isn't inside
# any function body at all.
#
# This statement is safe and correct to omit from this runtime
# prerequisite bundle: it is a ONE-TIME PRODUCTION data backfill for
# projects that were already fully completed by their subtasks before
# this migration first shipped -- by its own header comment, it is
# naturally idempotent and a no-op against any project with no matching
# historical data, which describes every disposable test project
# (including this one) by construction. It defines no function, no
# trigger, no grant -- omitting it changes nothing about the RPC
# contract Phase 6B's own runtime tests (Sections I and K5) exercise;
# see this script's own top-of-file header comment for the full proof
# that APPLY_ATTEMPT_MISMATCH is reached before any of
# projects/tasks/clients is ever touched.
#
# The full, untruncated source is still hashed above (for provenance/
# drift-detection of the WHOLE migration file) -- only the EMBEDDED
# bundle content is truncated, clearly marked, with the omitted
# statement's own first line and byte length recorded so any future
# drift in it is still visible on a re-run of this generator.
$backfillMarker = "-- One-time historical backfill."
$backfillIndex = $sourceContent.IndexOf($backfillMarker)
if ($backfillIndex -lt 0) {
  throw "Refusing to run: expected marker '$backfillMarker' not found in '$sourceName'. The source migration's shape has changed -- update this generator's truncation logic (and its own comments) to match before re-running, rather than silently bundling something different than intended."
}
$includedContent = $sourceContent.Substring(0, $backfillIndex).TrimEnd() + "`n"
$omittedContent = $sourceContent.Substring($backfillIndex)
$omittedFirstLine = ($omittedContent -split "`n")[0]
$omittedByteLength = [System.Text.Encoding]::UTF8.GetByteCount($omittedContent)
Write-Host "Truncated at marker '$backfillMarker' -- omitting $omittedByteLength bytes starting with: $omittedFirstLine"

# ---------------------------------------------------------------------
# Build the output: safety preamble, the migration verbatim with a
# source-path + hash comment, then a verification query.
# ---------------------------------------------------------------------
$header = @'
-- Text2Task Client Share Link -- Phase 6B DB Apply Boundary
-- Runtime Verification Package -- File 00 (MECHANICALLY GENERATED)
--
-- Brings the disposable project (already carrying the Phase 6A schema
-- and the Phase 6B boundary migration) up to the REAL, currently
-- authoritative apply_project_update_transaction contract, so
-- 01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql's Section I (direct RPC
-- precondition) and Section K5 (grant verification) test the ACTUAL
-- function, not a same-name stand-in.
--
-- Generated by scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1.
-- Do not hand-edit this file -- edit the source migration under
-- supabase/migrations/ and re-run the generator instead.
--
-- Run this in the SAME disposable Supabase project already used for the
-- Phase 6A package. Order relative to
-- supabase/migrations/202608230001_client_share_apply_boundary.sql does
-- not matter -- this file only defines FUNCTIONS
-- (apply_project_update_transaction, reconcile_project_completion,
-- apply_task_bulk_status_transaction); it creates no trigger on
-- public.project_updates, so it cannot conflict or interact with that
-- migration's trigger either way.
--
-- Never run this in the real Text2Task production project.
--
-- Contains the EXACT, UNMODIFIED contents of ONE source migration --
-- 202607270001_project_completion_reconciliation.sql -- with only a
-- safety preamble, one generated source-path/hash comment, and a
-- verification query added around it. See this generator script's own
-- header comment for the full dependency analysis of why this ONE
-- migration is sufficient (and why the other four historical
-- redefinitions of apply_project_update_transaction are deliberately
-- NOT bundled here).
--
-- ONE STATEMENT IS DELIBERATELY OMITTED: the migration's own trailing
-- "One-time historical backfill" top-level UPDATE statement. Unlike the
-- three CREATE OR REPLACE FUNCTION bodies above it (lazily compiled --
-- Postgres never validates their embedded SQL's column references
-- against the live catalog until the function is actually CALLED), that
-- backfill is an ordinary, directly-executed top-level DML statement,
-- validated immediately when it runs. It references projects.status,
-- which the Phase 6A disposable fixture's intentionally minimal
-- `projects` stand-in does not carry -- so it fails with
-- `42703 column project.status does not exist`, aborting before this
-- file's own verification query is ever reached. Omitting it changes
-- nothing about the RPC/function contract this package installs: the
-- backfill defines no function, trigger, or grant, and is a one-time
-- PRODUCTION data fixup that is naturally a no-op against any project
-- with no matching historical data -- true of every disposable test
-- project by construction, including this one. See this generator
-- script's own truncation-logic comment for the full proof.

-- =========================================================
-- SAFETY PREAMBLE (generated -- not part of any migration)
-- =========================================================

do $safety_preamble$
declare
  v_sentinel_kind text;
begin
  if to_regclass('public.text2task_client_share_phase6a_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 6A runtime test sentinel was not found in this project. Run the Phase 6A runtime package here first, and only ever inside a disposable Supabase project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase6a_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_6A_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row in this project does not identify it as a disposable Phase 6A/6B runtime test project.';
  end if;

  if to_regclass('public.project_updates') is null
    or to_regclass('public.projects') is null
    or to_regclass('public.tasks') is null
    or to_regclass('public.clients') is null
    or to_regclass('public.project_update_items') is null
    or to_regclass('public.project_timeline_events') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. One or more required tables (project_updates, projects, tasks, clients, project_update_items, project_timeline_events) were not found. Run the Phase 6A runtime package (01 and 02) in this project first.';
  end if;
end;
$safety_preamble$;

'@

$footer = @'

-- =========================================================
-- FINAL VERIFICATION (generated -- not part of any migration)
--
-- Deliberately ONE row, ONE result set, three plain columns -- nothing
-- to scroll through or interpret across multiple statements. Does NOT
-- claim the disposable project supports a successful FULL Apply
-- execution (it does not have the full production projects/tasks/
-- clients column set) -- it claims only what Phase 6B's own runtime
-- tests actually need: the real six-argument RPC exists and
-- authenticated can call it. Section I's own early-exit path
-- (APPLY_ATTEMPT_MISMATCH, before any projects/tasks/clients touch) is
-- proved separately by this generator's own header comment and by
-- 01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql itself.
-- =========================================================

-- Uses to_regprocedure() (returns NULL, never errors, when the function
-- is absent) rather than a bare ::regprocedure literal cast (which
-- RAISES if the function does not exist) -- so this query itself always
-- returns exactly one clean row, even when the RPC turns out not to be
-- installed, instead of erroring out and leaving the user with a raw
-- Postgres exception instead of a diagnosis. has_function_privilege()
-- is STRICT (returns NULL, not an error, for a NULL oid input), so
-- passing a possibly-NULL fn_oid through it is safe by construction.
with rpc as (
  select to_regprocedure(
    'public.apply_project_update_transaction(uuid,uuid,uuid[],uuid[],jsonb,jsonb)'
  ) as fn_oid
)
select
  rpc.fn_oid is not null as apply_rpc_exists,
  coalesce(has_function_privilege('authenticated', rpc.fn_oid, 'EXECUTE'), false)
    as authenticated_execute,
  case
    when rpc.fn_oid is not null
      and coalesce(has_function_privilege('authenticated', rpc.fn_oid, 'EXECUTE'), false)
    then 'PHASE_6B_APPLY_PREREQUISITE_READY'
    else 'PHASE_6B_APPLY_PREREQUISITE_NOT_READY'
  end as prerequisite_status
from rpc;
'@

$sourceComment = "-- Source: $sourceRelativePath (TRUNCATED -- see this file's own header and the generator's comment)`n-- SHA-256 of the FULL, untruncated source file (normalized LF UTF-8): $sourceHash`n-- Omitted tail: $omittedByteLength bytes starting with: $omittedFirstLine`n"
$bundle = ($header + "$sourceComment-- ===== BEGIN $sourceName (verbatim through the omission point above) =====`n" + $includedContent + "`n-- ===== END $sourceName (truncated) =====`n" + $footer) -replace "`r`n", "`n" -replace "`r", "`n"

# ---------------------------------------------------------------------
# Mechanically verify the source appears exactly once, with a matching
# hash comment, AND that the included content is genuinely a verbatim
# PREFIX of the real source file (never a hand-edited substitute) --
# re-derived independently here from the real file on disk, not merely
# trusted from the variable already built above.
# ---------------------------------------------------------------------
$beginMarker = "-- ===== BEGIN $sourceName (verbatim through the omission point above) ====="
$occurrences = ([regex]::Matches($bundle, [regex]::Escape($beginMarker))).Count
if ($occurrences -ne 1) {
  throw "Verification failed: '$sourceName' begin-marker appears $occurrences time(s); expected exactly 1."
}
$expectedComment = "-- SHA-256 of the FULL, untruncated source file (normalized LF UTF-8): $sourceHash"
if (-not $bundle.Contains($expectedComment)) {
  throw "Verification failed: generated source-hash comment does not match the computed hash."
}
$freshSourceContent = Get-NormalizedContent -Path $sourcePath
if (-not $freshSourceContent.StartsWith($includedContent.TrimEnd())) {
  throw "Verification failed: the embedded (truncated) content is not a verbatim prefix of the real source migration file. Refusing to write a bundle that might not match the authoritative migration text."
}
Write-Host 'Order/hash/prefix verification passed.'

$bundleHash = Get-Sha256Hex -Text $bundle

# ---------------------------------------------------------------------
# Stage, validate, then replace the real output file.
# ---------------------------------------------------------------------
$stagingDir = Join-Path $packageDir '.generator-staging-prereq'
if (Test-Path -LiteralPath $stagingDir) { Remove-Item -LiteralPath $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

try {
  $stagedOutput = Join-Path $stagingDir $outputFileName
  Write-StagedFile -StagingPath $stagedOutput -Content $bundle

  $stagedReadBack = Get-NormalizedContent -Path $stagedOutput
  $stagedHash = Get-Sha256Hex -Text $stagedReadBack
  if ($stagedHash -ne $bundleHash) {
    throw "Validation failed: staged output hash ($stagedHash) does not match the in-memory hash ($bundleHash)."
  }

  Move-Item -LiteralPath $stagedOutput -Destination $outputFile -Force
} finally {
  if (Test-Path -LiteralPath $stagingDir) { Remove-Item -LiteralPath $stagingDir -Recurse -Force }
}

Write-Host "Wrote generated output to: $outputFile"

$finalContent = Get-NormalizedContent -Path $outputFile
$finalHash = Get-Sha256Hex -Text $finalContent
if ($finalHash -ne $bundleHash) {
  throw "Validation failed: final output hash ($finalHash) does not match the in-memory hash ($bundleHash)."
}
Write-Host "Final output validation passed."

# ---------------------------------------------------------------------
# Regenerate MANIFEST.md deterministically -- describes every file in
# this package directory, not just the one this generator produces.
# ---------------------------------------------------------------------
$otherPackageFiles = [ordered]@{
  '00_READ_ME_FIRST.md' = (Join-Path $packageDir '00_READ_ME_FIRST.md')
  '01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql' = (Join-Path $packageDir '01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql')
  '02_CAPTURE_RESULTS.md' = (Join-Path $packageDir '02_CAPTURE_RESULTS.md')
  'build-phase6b-runtime-prerequisites-package.ps1' = $MyInvocation.MyCommand.Path
}
$otherPackageHashes = [ordered]@{}
foreach ($key in $otherPackageFiles.Keys) {
  $content = Get-NormalizedContent -Path $otherPackageFiles[$key]
  $otherPackageHashes[$key] = Get-Sha256Hex -Text $content
  Write-Host "Read package file: $key  sha256=$($otherPackageHashes[$key])"
}

$manifestLines = New-Object System.Collections.Generic.List[string]
$manifestLines.Add('# Client Share Link -- Phase 6B DB Apply Boundary Runtime Package Manifest')
$manifestLines.Add('')
$manifestLines.Add('File `00` is mechanically generated by `scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1`;')
$manifestLines.Add('every other file in this package is hand-authored (small enough that the full')
$manifestLines.Add('staged multi-file generator discipline used by the Phase 6A package is not')
$manifestLines.Add('warranted -- see `00_READ_ME_FIRST.md`). Deterministic from repository/package')
$manifestLines.Add('file contents alone -- no wall-clock timestamp is embedded anywhere in this file.')
$manifestLines.Add('Re-run the generator to reproduce it exactly, or to pick up a source change.')
$manifestLines.Add('')
$manifestLines.Add('## Package files')
$manifestLines.Add('')
$manifestLines.Add('| # | File | Origin | SHA-256 |')
$manifestLines.Add('|---|---|---|---|')
$manifestLines.Add("| 1 | ``00_READ_ME_FIRST.md`` | hand-authored | ``$($otherPackageHashes['00_READ_ME_FIRST.md'])`` |")
$manifestLines.Add("| 2 | ``$outputFileName`` | **generated** (mechanically assembled from the one source migration below) | ``$finalHash`` |")
$manifestLines.Add("| 3 | ``01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql`` | hand-authored | ``$($otherPackageHashes['01_RUN_PHASE6B_BOUNDARY_RUNTIME_TESTS.sql'])`` |")
$manifestLines.Add("| 4 | ``02_CAPTURE_RESULTS.md`` | hand-authored | ``$($otherPackageHashes['02_CAPTURE_RESULTS.md'])`` |")
$manifestLines.Add('| 5 | `MANIFEST.md` | **generated** (this file) | *(intentionally not embedded -- self-referential fixed point)* |')
$manifestLines.Add("| 6 | ``build-phase6b-runtime-prerequisites-package.ps1`` | hand-authored (this generator) | ``$($otherPackageHashes['build-phase6b-runtime-prerequisites-package.ps1'])`` |")
$manifestLines.Add('')
$manifestLines.Add('## Migration this package exercises')
$manifestLines.Add('')
$manifestLines.Add('Applied by file `00` verbatim THROUGH its own trailing "One-time historical')
$manifestLines.Add('backfill" statement, which is deliberately omitted (see file `00`''s own header')
$manifestLines.Add('and the generator''s truncation-logic comment for the full proof this is safe --')
$manifestLines.Add('in short: that statement is a directly-executed top-level DML referencing a')
$manifestLines.Add('column the disposable fixture does not carry, is unrelated to any function/')
$manifestLines.Add('trigger/grant this package installs, and is a one-time PRODUCTION data fixup')
$manifestLines.Add('that is a no-op against any project with no matching historical data). The')
$manifestLines.Add('three CREATE OR REPLACE FUNCTION statements themselves are 100% verbatim,')
$manifestLines.Add('character-for-character, with zero hand-editing. See that generator''s own')
$manifestLines.Add('header comment for the full dependency analysis of why this ONE migration (of')
$manifestLines.Add('the five that have ever redefined `apply_project_update_transaction`) is')
$manifestLines.Add('sufficient.')
$manifestLines.Add('')
$manifestLines.Add('| Migration | SHA-256 (full file) |')
$manifestLines.Add('|---|---|')
$manifestLines.Add("| ``$sourceRelativePath`` | ``$sourceHash`` |")
$manifestLines.Add('')
$manifestLines.Add('The Phase 6B DB apply boundary migration this whole package is verifying --')
$manifestLines.Add('`supabase/migrations/202608230001_client_share_apply_boundary.sql` -- is applied')
$manifestLines.Add('directly from its own real location, not duplicated into this package (see')
$manifestLines.Add('`00_READ_ME_FIRST.md`), so it is not listed as a source migration here.')
$manifestLines.Add('')
$manifestLines.Add('## To reproduce or re-verify these hashes')
$manifestLines.Add('')
$manifestLines.Add('```')
$manifestLines.Add('powershell -File scripts/client-share/build-phase6b-runtime-prerequisites-package.ps1')
$manifestLines.Add('```')
$manifestLines.Add('')
$manifestLines.Add('## Confirmations')
$manifestLines.Add('')
$manifestLines.Add('- The generator is read-only against `supabase/migrations/**`.')
$manifestLines.Add('- The generated output is built and fully validated in a temporary staging file')
$manifestLines.Add('  BEFORE the real package file is touched.')
$manifestLines.Add('- This package targets the SAME disposable Supabase project the Phase 6A runtime')
$manifestLines.Add('  package already used -- it does not provision or describe a new one, and does')
$manifestLines.Add('  not modify any file under `docs/client-share-phase6a-runtime/`.')
$manifestLines.Add('- No Production project URL, project reference, credential or environment value')
$manifestLines.Add('  appears anywhere in this package.')
$manifestLines.Add('- This file embeds no wall-clock timestamp; re-running the generator against')
$manifestLines.Add('  unchanged inputs reproduces it byte-for-byte.')
$manifestLines.Add('')

$manifest = ($manifestLines -join "`n") -replace "`r`n", "`n" -replace "`r", "`n"
if (-not $manifest.EndsWith("`n")) { $manifest += "`n" }

$stagingDir2 = Join-Path $packageDir '.generator-staging-manifest'
if (Test-Path -LiteralPath $stagingDir2) { Remove-Item -LiteralPath $stagingDir2 -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDir2 -Force | Out-Null
try {
  $stagedManifest = Join-Path $stagingDir2 $manifestFileName
  Write-StagedFile -StagingPath $stagedManifest -Content $manifest
  $stagedManifestReadBack = Get-NormalizedContent -Path $stagedManifest
  $stagedManifestHash = Get-Sha256Hex -Text $stagedManifestReadBack
  $inMemoryManifestHash = Get-Sha256Hex -Text $manifest
  if ($stagedManifestHash -ne $inMemoryManifestHash) {
    throw "Validation failed: staged manifest hash does not match the in-memory manifest hash."
  }
  Move-Item -LiteralPath $stagedManifest -Destination $manifestFile -Force
} finally {
  if (Test-Path -LiteralPath $stagingDir2) { Remove-Item -LiteralPath $stagingDir2 -Recurse -Force }
}

Write-Host "Wrote generated manifest to: $manifestFile"
$finalManifestHash = Get-Sha256Hex -Text (Get-NormalizedContent -Path $manifestFile)

Write-Host ''
Write-Host '=== SHA-256 SUMMARY ==='
Write-Host "$sourceRelativePath : $sourceHash"
Write-Host "$outputFileName (generated) : $finalHash"
foreach ($key in $otherPackageHashes.Keys) {
  Write-Host "$key : $($otherPackageHashes[$key])"
}
Write-Host "MANIFEST_SHA256=$finalManifestHash"
Write-Host ''
Write-Host 'PACKAGE_VERIFICATION_STATUS: PASS'
