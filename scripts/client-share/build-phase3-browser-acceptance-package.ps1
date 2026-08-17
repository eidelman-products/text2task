<#
.SYNOPSIS
  Mechanically builds the one generated output of the Phase 3 browser
  acceptance fixture package:
    docs/client-share-phase3-browser-acceptance/MANIFEST.md

.DESCRIPTION
  Unlike scripts/client-share/build-phase3-application-runtime-package.ps1
  and its siblings, this package contains no file mechanically assembled
  from supabase/migrations/** -- every SQL/Markdown file in
  docs/client-share-phase3-browser-acceptance/ is hand-authored. This
  generator's only job is to compute and record deterministic SHA-256
  hashes for every hand-authored file, exactly like every prior Client
  Share package's own MANIFEST.md, so the package's integrity can be
  verified without re-reading each file by hand.

  Same guarantees as every prior Client Share package generator:
    - never modifies any file under docs/client-share-phase3-browser-acceptance/
      other than MANIFEST.md itself
    - never modifies docs/client-share-phase3-runtime/ or any other
      existing Client Share package/generator in any way
    - never runs any SQL
    - never connects to Supabase
    - never uses any credential, project reference, or generates any secret
    - never calls Get-Date or embeds any wall-clock timestamp
    - builds the generated output in a temporary staging subdirectory
      first and validates it completely BEFORE the real MANIFEST.md file
      is touched

  Run manually, once, from anywhere inside the repository:
    powershell -File scripts/client-share/build-phase3-browser-acceptance-package.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------
# 1. Resolve the repository root safely, from this script's own location.
# ---------------------------------------------------------------------
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..\..')
Write-Host "Repository root resolved to: $repoRoot"

$packageDir = Join-Path $repoRoot 'docs\client-share-phase3-browser-acceptance'
$manifestFileName = 'MANIFEST.md'
$manifestFile = Join-Path $packageDir $manifestFileName

# ---------------------------------------------------------------------
# 2. Refuse to write anywhere outside the allowed package directory, and
#    only ever to this one named file.
# ---------------------------------------------------------------------
$resolvedPackageDir = (Resolve-Path $packageDir).Path
$resolvedManifestParent = Split-Path -Parent $manifestFile
if ((Resolve-Path $resolvedManifestParent).Path -ne $resolvedPackageDir) {
  throw "Refusing to run: computed output path '$manifestFile' is not inside the allowed package directory '$resolvedPackageDir'."
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
# 4. Hash every hand-authored package file, in a fixed, deterministic
#    order.
# ---------------------------------------------------------------------
$packageFiles = [ordered]@{
  '00_READ_ME_FIRST.md' = (Join-Path $packageDir '00_READ_ME_FIRST.md')
  '01_EXTEND_DISPOSABLE_APP_SCHEMA.sql' = (Join-Path $packageDir '01_EXTEND_DISPOSABLE_APP_SCHEMA.sql')
  '01A_PATCH_TASKS_IS_ARCHIVED.sql' = (Join-Path $packageDir '01A_PATCH_TASKS_IS_ARCHIVED.sql')
  '02_SEED_DISPOSABLE_OWNER_CONTENT.sql' = (Join-Path $packageDir '02_SEED_DISPOSABLE_OWNER_CONTENT.sql')
  '03_BROWSER_FIXTURE_VERIFICATION.sql' = (Join-Path $packageDir '03_BROWSER_FIXTURE_VERIFICATION.sql')
  '03A_DIAGNOSE_BROWSER_FIXTURE_FAILURE.sql' = (Join-Path $packageDir '03A_DIAGNOSE_BROWSER_FIXTURE_FAILURE.sql')
  '04_CAPTURE_RESULTS.md' = (Join-Path $packageDir '04_CAPTURE_RESULTS.md')
  '05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md' = (Join-Path $packageDir '05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md')
  'build-phase3-browser-acceptance-package.ps1' = $MyInvocation.MyCommand.Path
}

$packageHashes = [ordered]@{}
foreach ($key in $packageFiles.Keys) {
  $content = Get-NormalizedContent -Path $packageFiles[$key]
  $packageHashes[$key] = Get-Sha256Hex -Text $content
  Write-Host "Read package file: $key  sha256=$($packageHashes[$key])"
}

# ---------------------------------------------------------------------
# 5. Build MANIFEST.md deterministically.
# ---------------------------------------------------------------------
$manifestLines = New-Object System.Collections.Generic.List[string]
$manifestLines.Add('# Client Share Link -- Phase 3 Browser Acceptance Fixture Package Manifest')
$manifestLines.Add('')
$manifestLines.Add('Mechanically generated by `scripts/client-share/build-phase3-browser-acceptance-package.ps1`.')
$manifestLines.Add('Deterministic from this package''s own file contents alone -- no wall-clock')
$manifestLines.Add('timestamp, build number or `Get-Date` value is embedded anywhere in this file.')
$manifestLines.Add('Re-run the generator to reproduce it exactly, or to pick up file changes.')
$manifestLines.Add('')
$manifestLines.Add('Unlike the sibling `docs/client-share-phase3-runtime/` package, no file here')
$manifestLines.Add('is mechanically assembled from `supabase/migrations/**` -- every SQL/Markdown')
$manifestLines.Add('file in this package is hand-authored, so this manifest records only their')
$manifestLines.Add('hashes, with no separate "generated bundle" row.')
$manifestLines.Add('')
$manifestLines.Add('## Package files (all ten approved files)')
$manifestLines.Add('')
$manifestLines.Add('| # | File | Origin | SHA-256 |')
$manifestLines.Add('|---|---|---|---|')
$manifestLines.Add("| 1 | ``00_READ_ME_FIRST.md`` | hand-authored | ``$($packageHashes['00_READ_ME_FIRST.md'])`` |")
$manifestLines.Add("| 2 | ``01_EXTEND_DISPOSABLE_APP_SCHEMA.sql`` | hand-authored | ``$($packageHashes['01_EXTEND_DISPOSABLE_APP_SCHEMA.sql'])`` |")
$manifestLines.Add("| 3 | ``01A_PATCH_TASKS_IS_ARCHIVED.sql`` | hand-authored | ``$($packageHashes['01A_PATCH_TASKS_IS_ARCHIVED.sql'])`` |")
$manifestLines.Add("| 4 | ``02_SEED_DISPOSABLE_OWNER_CONTENT.sql`` | hand-authored | ``$($packageHashes['02_SEED_DISPOSABLE_OWNER_CONTENT.sql'])`` |")
$manifestLines.Add("| 5 | ``03_BROWSER_FIXTURE_VERIFICATION.sql`` | hand-authored | ``$($packageHashes['03_BROWSER_FIXTURE_VERIFICATION.sql'])`` |")
$manifestLines.Add("| 6 | ``03A_DIAGNOSE_BROWSER_FIXTURE_FAILURE.sql`` | hand-authored | ``$($packageHashes['03A_DIAGNOSE_BROWSER_FIXTURE_FAILURE.sql'])`` |")
$manifestLines.Add("| 7 | ``04_CAPTURE_RESULTS.md`` | hand-authored | ``$($packageHashes['04_CAPTURE_RESULTS.md'])`` |")
$manifestLines.Add("| 8 | ``05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`` | hand-authored | ``$($packageHashes['05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md'])`` |")
$manifestLines.Add('| 9 | `MANIFEST.md` | **generated** (this file) | *(intentionally not embedded -- see below)* |')
$manifestLines.Add("| 10 | ``build-phase3-browser-acceptance-package.ps1`` | hand-authored (this generator) | ``$($packageHashes['build-phase3-browser-acceptance-package.ps1'])`` |")
$manifestLines.Add('')
$manifestLines.Add('### Why row 9 has no embedded hash')
$manifestLines.Add('')
$manifestLines.Add('Same reasoning as every prior Client Share package manifest: embedding')
$manifestLines.Add('would require a self-referential fixed point. The generator prints')
$manifestLines.Add('`MANIFEST.md`''s SHA-256 to the console (`MANIFEST_SHA256=`) instead.')
$manifestLines.Add('')
$manifestLines.Add('## To reproduce or re-verify these hashes')
$manifestLines.Add('')
$manifestLines.Add('```')
$manifestLines.Add('powershell -File scripts/client-share/build-phase3-browser-acceptance-package.ps1')
$manifestLines.Add('```')
$manifestLines.Add('')
$manifestLines.Add('## Confirmations')
$manifestLines.Add('')
$manifestLines.Add('- The generator is read-only against every other Client Share package and')
$manifestLines.Add('  against `supabase/migrations/**` -- it does not read from either.')
$manifestLines.Add('- The generated output is built and fully validated in a temporary staging')
$manifestLines.Add('  subdirectory BEFORE the real `MANIFEST.md` file is touched.')
$manifestLines.Add('- This package does not modify `docs/client-share-phase3-runtime/` or any')
$manifestLines.Add('  other existing Client Share runtime package or generator in any way.')
$manifestLines.Add('- No Production project URL, project reference, credential, or environment')
$manifestLines.Add('  value appears anywhere in this package.')
$manifestLines.Add('- This file embeds no wall-clock timestamp; re-running the generator against')
$manifestLines.Add('  unchanged inputs reproduces it byte-for-byte.')
$manifestLines.Add('')

$manifest = ($manifestLines -join "`n") -replace "`r`n", "`n" -replace "`r", "`n"
if (-not $manifest.EndsWith("`n")) {
  $manifest += "`n"
}
$manifestHash = Get-Sha256Hex -Text $manifest

# ---------------------------------------------------------------------
# 6. Stage the generated output, validate, and only then replace the
#    real file.
# ---------------------------------------------------------------------
$stagingDir = Join-Path $packageDir '.generator-staging'
if (Test-Path -LiteralPath $stagingDir) {
  Remove-Item -LiteralPath $stagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

$stagedManifest = Join-Path $stagingDir $manifestFileName

try {
  Write-StagedFile -StagingPath $stagedManifest -Content $manifest

  $stagedManifestReadBack = Get-NormalizedContent -Path $stagedManifest
  $stagedManifestHash = Get-Sha256Hex -Text $stagedManifestReadBack
  if ($stagedManifestHash -ne $manifestHash) {
    throw "Validation failed: staged manifest hash ($stagedManifestHash) does not match the in-memory manifest hash ($manifestHash)."
  }

  $stagedCount = @(Get-ChildItem -LiteralPath $stagingDir -File).Count
  if ($stagedCount -ne 1) {
    throw "Validation failed: expected exactly 1 staged generated output, found $stagedCount."
  }
  Write-Host "Staged output validation passed: exactly $stagedCount generated output staged and hash-verified."

  Move-Item -LiteralPath $stagedManifest -Destination $manifestFile -Force
} finally {
  if (Test-Path -LiteralPath $stagingDir) {
    Remove-Item -LiteralPath $stagingDir -Recurse -Force
  }
}

Write-Host "Wrote generated manifest to: $manifestFile"

# ---------------------------------------------------------------------
# 7. Final validation against the file as actually written.
# ---------------------------------------------------------------------
$finalManifestContent = Get-NormalizedContent -Path $manifestFile
$finalManifestHash = Get-Sha256Hex -Text $finalManifestContent
if ($finalManifestHash -ne $manifestHash) {
  throw "Validation failed: final manifest hash ($finalManifestHash) does not match the in-memory manifest hash ($manifestHash)."
}
if (-not (Test-Path -LiteralPath $manifestFile)) {
  throw "Validation failed: expected generated output file does not exist after replacement."
}
Write-Host "Final output validation passed: generated output present and hash-verified at its real location."

# ---------------------------------------------------------------------
# 8. Console summary.
# ---------------------------------------------------------------------
Write-Host ''
Write-Host '=== SHA-256 SUMMARY ==='
foreach ($key in $packageHashes.Keys) {
  Write-Host "$key : $($packageHashes[$key])"
}
Write-Host "MANIFEST_SHA256=$finalManifestHash"
Write-Host ''
Write-Host "Generated output path:"
Write-Host "  $manifestFile"
Write-Host ''
Write-Host 'PACKAGE_VERIFICATION_STATUS: PASS'
