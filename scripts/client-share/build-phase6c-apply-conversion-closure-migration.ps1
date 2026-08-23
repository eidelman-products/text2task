<#
.SYNOPSIS
  Mechanically builds the Phase 6C migration:
    supabase/migrations/202608230002_client_share_apply_conversion_closure.sql

.DESCRIPTION
  Reconstructs THREE existing, authoritative database functions from their
  own correct, independent historical source migrations -- never from each
  other, never hand-retyped -- and authors ONE new function from a
  deterministic template (it has no historical source to reconstruct).

  Corrected by the Phase 6C final pre-implementation source-provenance
  review (see docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6C_AUDIT_AND_PLAN_2026-08-23.md
  section 13): an earlier draft of this plan incorrectly implied both
  apply_project_update_transaction AND set_share_message_status could be
  sourced from 202607270001. That is false -- set_share_message_status has
  never been defined there. Each of the three reconstructed functions below
  is read from its own, independently-verified, correct source file.

  A. apply_project_update_transaction
     source: supabase/migrations/202607270001_project_completion_reconciliation.sql
     insertions: (1) the row-bound transaction-local capability
     (text2task.client_share_apply_update_id), set immediately before the
     existing authoritative applied-status UPDATE; (2) the conversion-
     closure call, immediately before the existing final return. Both
     insertions are gated on `v_update.source_share_message_id is not
     null` -- a complete no-op for every non-client_share row.

  B. set_share_message_status
     source: supabase/migrations/202608190001_client_share_message_owner_rpcs.sql
     insertions: load the row's current status in the existing
     `select ... for update`, and reject with SHARE_MESSAGE_STATUS_TERMINAL
     before any status mutation is computed, if the row is already
     'converted'.

  C. enforce_project_update_client_share_apply_boundary
     source: supabase/migrations/202608230001_client_share_apply_boundary.sql
     modification: the predicate is narrowed so 'applying' is no longer
     blocked at all (the real Apply RPC independently re-validates and
     performs real work regardless of how 'applying' was reached -- proven
     safe by the Phase 6C security audit), and an *entering* transition
     into 'applied' (INSERT already-applied, or UPDATE from a non-applied
     prior status) is permitted only when the transaction-local capability
     matches the exact row id. An already-applied row receiving an
     ordinary non-status update (OLD.status = 'applied' AND NEW.status =
     'applied') does NOT require the capability -- the guard protects
     *establishing* applied, not every future write to an already-applied
     row. TG_OP-safe: OLD is never referenced except inside a branch that
     has already established TG_OP = 'UPDATE'.
     THE TRIGGER ITSELF IS NEVER DROPPED. Only its function body is
     replaced (CREATE OR REPLACE) -- the existing `create trigger
     project_updates_enforce_client_share_apply_boundary` binding by name
     is untouched and does not need to be, and is not, redeclared.

  D. finalize_share_message_conversion (NEW)
     No historical source -- authored directly below as a deterministic
     template. SECURITY DEFINER. Independently requires the SAME
     transaction-local capability (text2task.client_share_apply_update_id)
     bound to p_project_update_id, BEFORE any of its other checks --
     closing the standalone-invocation attack the Phase 6C security audit
     found (a raw UPDATE forging project_updates.status='applied' followed
     by a direct call to this helper would otherwise pass every one of its
     other, independently-necessary checks).

  For each of A, B, and C: the anchor text this generator searches for and
  replaces must occur EXACTLY ONCE in the extracted function body, or the
  generator throws and writes nothing (fails closed) -- if the source
  migration's shape has changed, this generator's own insertion logic
  needs deliberate review before it can be trusted again, not a silent
  guess. After insertion, the generator strips the SAME inserted text back
  out and asserts the remainder is BYTE-IDENTICAL (SHA-256 match) to the
  original, unmodified extracted body -- proving each reconstruction
  changed only what it intended to, nothing else, mechanically rather than
  by inspection. A pass for one function is never treated as evidence for
  another -- all three proofs are independent.

  Same generation guarantees as every prior generator in this family:
    - never modifies any source migration file
    - never runs any SQL
    - never connects to Supabase
    - never uses any credential or project reference
    - never calls Get-Date or embeds any wall-clock timestamp (the
      migration's own header date is a fixed literal, matching its
      filename slot)
    - builds the generated output in a temporary staging file first and
      validates it completely BEFORE the real migration file is touched
    - fails closed (throws, writes nothing) if any source migration file
      or expected anchor is missing, or if any reconstruction hash proof
      fails
    - running this generator twice against unchanged sources produces an
      identical file, byte-for-byte (verified in-process before writing)

  Run manually, once, from anywhere inside the repository:
    powershell -File scripts/client-share/build-phase6c-apply-conversion-closure-migration.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..\..')
Write-Host "Repository root resolved to: $repoRoot"

$migrationsDir = Join-Path $repoRoot 'supabase\migrations'

$applyRpcSourceName = '202607270001_project_completion_reconciliation.sql'
$statusRpcSourceName = '202608190001_client_share_message_owner_rpcs.sql'
$boundarySourceName = '202608230001_client_share_apply_boundary.sql'

$applyRpcSourcePath = Join-Path $migrationsDir $applyRpcSourceName
$statusRpcSourcePath = Join-Path $migrationsDir $statusRpcSourceName
$boundarySourcePath = Join-Path $migrationsDir $boundarySourceName

$outputFileName = '202608230002_client_share_apply_conversion_closure.sql'
$outputFile = Join-Path $migrationsDir $outputFileName

# ---------------------------------------------------------------------
# Refuse to overwrite an existing migration file -- this slot must be
# free, or the caller must choose a different one before running this.
# ---------------------------------------------------------------------
if (Test-Path -LiteralPath $outputFile) {
  throw "Refusing to run: '$outputFile' already exists. Choose a free migration slot before running this generator, or remove the stale file if it is safe to regenerate."
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

function Get-OccurrenceCount {
  param([string]$Text, [string]$Needle)
  $count = 0
  $idx = 0
  while ($true) {
    $idx = $Text.IndexOf($Needle, $idx, [System.StringComparison]::Ordinal)
    if ($idx -lt 0) { break }
    $count++
    $idx += $Needle.Length
  }
  return $count
}

function Invoke-ExactlyOnceReplace {
  param([string]$Text, [string]$Old, [string]$New, [string]$Label)
  $count = Get-OccurrenceCount -Text $Text -Needle $Old
  if ($count -ne 1) {
    throw "Refusing to run: expected exactly ONE occurrence of anchor [$Label], found $count. The source migration's shape has changed -- this generator's insertion logic needs deliberate review before it can be trusted again."
  }
  return $Text.Replace($Old, $New)
}

function Get-FunctionBody {
  param([string]$Source, [string]$FunctionName)
  $startMarker = "create or replace function public.$FunctionName("
  $startIndex = $Source.IndexOf($startMarker, [System.StringComparison]::Ordinal)
  if ($startIndex -lt 0) {
    throw "Refusing to run: could not find function '$FunctionName' in the expected source."
  }
  $endMarker = "`n`$`$;"
  $endIndex = $Source.IndexOf($endMarker, $startIndex, [System.StringComparison]::Ordinal)
  if ($endIndex -lt 0) {
    throw "Refusing to run: could not find the end of function '$FunctionName' in the expected source."
  }
  $end = $endIndex + $endMarker.Length
  return $Source.Substring($startIndex, $end - $startIndex)
}

# =======================================================================
# A. apply_project_update_transaction  <-  202607270001
# =======================================================================
$applyRpcSource = Get-NormalizedContent -Path $applyRpcSourcePath
$applyRpcSourceHash = Get-Sha256Hex -Text $applyRpcSource
Write-Host "Read Apply RPC source: $applyRpcSourceName  sha256=$applyRpcSourceHash"

$applyRpcOriginalBody = Get-FunctionBody -Source $applyRpcSource -FunctionName 'apply_project_update_transaction'
$applyRpcOriginalBodyHash = Get-Sha256Hex -Text $applyRpcOriginalBody

$capabilityOldAnchor = @'
  update public.project_updates as update_row
  set
    status = 'applied',
'@

$capabilityNewAnchor = @'
  if v_update.source_share_message_id is not null then
    perform set_config(
      'text2task.client_share_apply_update_id',
      p_update_id::text,
      true
    );
  end if;

  update public.project_updates as update_row
  set
    status = 'applied',
'@

$closureOldAnchor = @'
  return jsonb_build_object(
    'update', to_jsonb(v_final_update),
'@

$closureNewAnchor = @'
  if v_update.source_share_message_id is not null then
    perform public.finalize_share_message_conversion(
      v_update.source_share_message_id,
      p_update_id
    );
  end if;

  return jsonb_build_object(
    'update', to_jsonb(v_final_update),
'@

$applyRpcModifiedBody = Invoke-ExactlyOnceReplace -Text $applyRpcOriginalBody -Old $capabilityOldAnchor -New $capabilityNewAnchor -Label 'apply_project_update_transaction: applied-status UPDATE (capability insertion point)'
$applyRpcModifiedBody = Invoke-ExactlyOnceReplace -Text $applyRpcModifiedBody -Old $closureOldAnchor -New $closureNewAnchor -Label 'apply_project_update_transaction: final return (closure insertion point)'

# Reconstruction/hash proof: reverse both insertions and assert byte
# identity to the original, unmodified extracted body.
$applyRpcReconstructed = $applyRpcModifiedBody.Replace($closureNewAnchor, $closureOldAnchor).Replace($capabilityNewAnchor, $capabilityOldAnchor)
$applyRpcReconstructedHash = Get-Sha256Hex -Text $applyRpcReconstructed
if ($applyRpcReconstructedHash -ne $applyRpcOriginalBodyHash) {
  throw "Reconstruction proof FAILED for apply_project_update_transaction: reversing the two insertions does not reproduce the original extracted body (original=$applyRpcOriginalBodyHash reconstructed=$applyRpcReconstructedHash)."
}
Write-Host "apply_project_update_transaction reconstruction proof PASSED (original body sha256=$applyRpcOriginalBodyHash)"

# =======================================================================
# B. set_share_message_status  <-  202608190001
#    (NEVER 202607270001 -- it has never been defined there)
# =======================================================================
$statusRpcSource = Get-NormalizedContent -Path $statusRpcSourcePath
$statusRpcSourceHash = Get-Sha256Hex -Text $statusRpcSource
Write-Host "Read message-status RPC source: $statusRpcSourceName  sha256=$statusRpcSourceHash"

$statusRpcOriginalBody = Get-FunctionBody -Source $statusRpcSource -FunctionName 'set_share_message_status'
$statusRpcOriginalBodyHash = Get-Sha256Hex -Text $statusRpcOriginalBody

$declareOldAnchor = @'
declare
  v_user_id uuid := auth.uid();
  v_message_user_id uuid;
  v_message_project_id uuid;
  v_project_deleted_at timestamptz;
  v_existing_reviewed_at timestamptz;
  v_reviewed_at timestamptz;
  v_resolved_at timestamptz;
  v_now timestamptz := now();
begin
'@

$declareNewAnchor = @'
declare
  v_user_id uuid := auth.uid();
  v_message_user_id uuid;
  v_message_project_id uuid;
  v_project_deleted_at timestamptz;
  v_existing_reviewed_at timestamptz;
  v_existing_status text;
  v_reviewed_at timestamptz;
  v_resolved_at timestamptz;
  v_now timestamptz := now();
begin
'@

$selectOldAnchor = @'
  select message.user_id, message.project_id, message.reviewed_at
    into v_message_user_id, v_message_project_id, v_existing_reviewed_at
    from public.share_messages as message
    where message.id = p_message_id and message.user_id = v_user_id
    for update;
'@

$selectNewAnchor = @'
  select message.user_id, message.project_id, message.reviewed_at, message.status
    into v_message_user_id, v_message_project_id, v_existing_reviewed_at, v_existing_status
    from public.share_messages as message
    where message.id = p_message_id and message.user_id = v_user_id
    for update;
'@

$terminalOldAnchor = @'
  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_NOT_FOUND';
  end if;

  if p_status = 'new' then
'@

$terminalNewAnchor = @'
  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_NOT_FOUND';
  end if;

  if v_existing_status = 'converted' then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_STATUS_TERMINAL';
  end if;

  if p_status = 'new' then
'@

$statusRpcModifiedBody = Invoke-ExactlyOnceReplace -Text $statusRpcOriginalBody -Old $declareOldAnchor -New $declareNewAnchor -Label 'set_share_message_status: declare block'
$statusRpcModifiedBody = Invoke-ExactlyOnceReplace -Text $statusRpcModifiedBody -Old $selectOldAnchor -New $selectNewAnchor -Label 'set_share_message_status: row-lock select'
$statusRpcModifiedBody = Invoke-ExactlyOnceReplace -Text $statusRpcModifiedBody -Old $terminalOldAnchor -New $terminalNewAnchor -Label 'set_share_message_status: terminal-guard insertion point'

$statusRpcReconstructed = $statusRpcModifiedBody.Replace($terminalNewAnchor, $terminalOldAnchor).Replace($selectNewAnchor, $selectOldAnchor).Replace($declareNewAnchor, $declareOldAnchor)
$statusRpcReconstructedHash = Get-Sha256Hex -Text $statusRpcReconstructed
if ($statusRpcReconstructedHash -ne $statusRpcOriginalBodyHash) {
  throw "Reconstruction proof FAILED for set_share_message_status: reversing the three edits does not reproduce the original extracted body (original=$statusRpcOriginalBodyHash reconstructed=$statusRpcReconstructedHash)."
}
Write-Host "set_share_message_status reconstruction proof PASSED (original body sha256=$statusRpcOriginalBodyHash)"

# =======================================================================
# C. enforce_project_update_client_share_apply_boundary  <-  202608230001
# =======================================================================
$boundarySource = Get-NormalizedContent -Path $boundarySourcePath
$boundarySourceHash = Get-Sha256Hex -Text $boundarySource
Write-Host "Read boundary source: $boundarySourceName  sha256=$boundarySourceHash"

$boundaryOriginalBody = Get-FunctionBody -Source $boundarySource -FunctionName 'enforce_project_update_client_share_apply_boundary'
$boundaryOriginalBodyHash = Get-Sha256Hex -Text $boundaryOriginalBody

$predicateOldAnchor = @'
begin
  if new.source_type = 'client_share'
    and new.status in ('applying', 'applied') then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE';
  end if;

  return new;
end;
$$;
'@

$predicateNewAnchor = @'
begin
  if new.source_type = 'client_share'
    and new.status = 'applied' then

    if tg_op = 'INSERT' then
      if current_setting('text2task.client_share_apply_update_id', true)
          is distinct from new.id::text then
        raise exception using
          errcode = 'P0001',
          message = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE';
      end if;
    elsif tg_op = 'UPDATE'
        and old.status is distinct from 'applied' then
      if current_setting('text2task.client_share_apply_update_id', true)
          is distinct from new.id::text then
        raise exception using
          errcode = 'P0001',
          message = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE';
      end if;
    end if;

  end if;

  return new;
end;
$$;
'@

$boundaryModifiedBody = Invoke-ExactlyOnceReplace -Text $boundaryOriginalBody -Old $predicateOldAnchor -New $predicateNewAnchor -Label 'enforce_project_update_client_share_apply_boundary: predicate'

$boundaryReconstructed = $boundaryModifiedBody.Replace($predicateNewAnchor, $predicateOldAnchor)
$boundaryReconstructedHash = Get-Sha256Hex -Text $boundaryReconstructed
if ($boundaryReconstructedHash -ne $boundaryOriginalBodyHash) {
  throw "Reconstruction proof FAILED for enforce_project_update_client_share_apply_boundary: reversing the predicate edit does not reproduce the original extracted body (original=$boundaryOriginalBodyHash reconstructed=$boundaryReconstructedHash)."
}
Write-Host "enforce_project_update_client_share_apply_boundary reconstruction proof PASSED (original body sha256=$boundaryOriginalBodyHash)"

# =======================================================================
# D. finalize_share_message_conversion (NEW -- no historical source)
# =======================================================================
$newHelperBody = @'
create or replace function public.finalize_share_message_conversion(
  p_message_id uuid,
  p_project_update_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_update_status text;
  v_update_source_type text;
  v_update_source_share_message_id uuid;
  v_update_project_id uuid;
  v_message_user_id uuid;
  v_message_project_id uuid;
  v_message_author_type text;
  v_message_status text;
  v_converted_at timestamptz := now();
  v_affected_count integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  -- Phase 6C security correction: this transaction-local, row-bound
  -- capability is the FIRST check, before any other validation. It can
  -- only be 'on' for this exact p_project_update_id inside the one
  -- transaction where apply_project_update_transaction itself set it,
  -- immediately before performing the real, authoritative applied
  -- transition for that row. A standalone call to this function, in its
  -- own separate transaction, never has this capability set -- closing
  -- the forged-applied standalone-invocation attack the Phase 6C security
  -- audit found, independent of whatever project_updates.status reads as.
  if current_setting('text2task.client_share_apply_update_id', true)
      is distinct from p_project_update_id::text then
    raise exception using
      errcode = 'P0001',
      message = 'SHARE_CONVERSION_APPLY_CONTEXT_REQUIRED';
  end if;

  select
    update_row.status,
    update_row.source_type,
    update_row.source_share_message_id,
    update_row.project_id
    into
      v_update_status,
      v_update_source_type,
      v_update_source_share_message_id,
      v_update_project_id
    from public.project_updates as update_row
    where update_row.id = p_project_update_id
      and update_row.user_id = v_user_id
    for update;

  if v_update_status is null then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_NOT_FOUND';
  end if;

  if v_update_status <> 'applied' then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_NOT_APPLIED';
  end if;

  if v_update_source_type <> 'client_share' then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_NOT_CLIENT_SHARE';
  end if;

  if v_update_source_share_message_id is distinct from p_message_id then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_MESSAGE_MISMATCH';
  end if;

  select
    message.user_id,
    message.project_id,
    message.author_type,
    message.status
    into
      v_message_user_id,
      v_message_project_id,
      v_message_author_type,
      v_message_status
    from public.share_messages as message
    where message.id = p_message_id
      and message.user_id = v_user_id
    for update;

  if v_message_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_MESSAGE_NOT_FOUND';
  end if;

  if v_message_project_id is distinct from v_update_project_id then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_PROJECT_MISMATCH';
  end if;

  if v_message_author_type <> 'client' then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_MESSAGE_NOT_CLIENT_AUTHORED';
  end if;

  if v_message_status = 'converted' then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_STATUS_TERMINAL';
  end if;

  insert into public.share_message_conversions (
    user_id,
    message_id,
    project_update_id,
    target_task_id,
    converted_by,
    converted_at
  ) values (
    v_user_id,
    p_message_id,
    p_project_update_id,
    null,
    v_user_id,
    v_converted_at
  );

  update public.share_messages
    set
      status = 'converted',
      reviewed_at = coalesce(reviewed_at, v_converted_at)
    where id = p_message_id
      and user_id = v_user_id;

  get diagnostics v_affected_count = row_count;

  if v_affected_count <> 1 then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_MESSAGE_UPDATE_FAILED';
  end if;
end;
$$;
'@

# =======================================================================
# Assemble the final migration file.
# =======================================================================
$migrationHeader = @'
-- Text2Task Client Share Link -- Phase 6C Atomic Apply + Conversion Closure
-- Migration: 202608230002_client_share_apply_conversion_closure.sql
-- Created: 2026-08-23
--
-- Mechanically generated by
-- scripts/client-share/build-phase6c-apply-conversion-closure-migration.ps1.
-- Do not hand-edit this file -- edit the relevant source migration and
-- re-run the generator instead. See that script's own header comment and
-- docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6C_AUDIT_AND_PLAN_2026-08-23.md
-- for the full design, including a final pre-implementation security
-- audit (verdict at the time: PHASE_6C_PLAN_SECURITY_BLOCKED) and the
-- row-bound transaction-capability correction that resolved it.
--
-- SECURITY DESIGN (see the plan document sections 6-9 for full detail):
-- project_updates carries a broad, column-unrestricted `authenticated`
-- RLS UPDATE policy, with no trigger guarding `status` beyond the
-- existing Phase 6B boundary. A prior draft of this migration would have
-- fully DROPped that boundary once this closure existed -- a security
-- audit found this unsafe: an owner could raw-UPDATE their own
-- client_share row directly to status='applied' (zero real work), then
-- call a standalone conversion helper directly, and every one of that
-- helper's originally-proposed checks would have passed. This migration
-- does NOT drop the Phase 6B boundary trigger or its function -- it
-- narrows the function's predicate in place (CREATE OR REPLACE only) and
-- introduces a transaction-local, ROW-BOUND capability
-- (text2task.client_share_apply_update_id, set via set_config with
-- is_local=true -- never a boolean/global flag) that only
-- apply_project_update_transaction itself can ever set, immediately
-- before its own authoritative applied-status transition.
-- finalize_share_message_conversion independently requires the SAME
-- capability, bound to the exact project_update id, before any of its
-- other (still independently necessary) checks -- closing the
-- standalone-invocation path even if project_updates.status='applied' is
-- ever forged by other means, without broadening any grant and without
-- changing text/image Apply behavior at all.
--
-- This migration, in order:
--   1. CREATE public.finalize_share_message_conversion (new, SECURITY
--      DEFINER) -- the conversion-closure helper.
--   2. CREATE OR REPLACE public.apply_project_update_transaction, adding
--      the row-bound capability (immediately before the existing
--      applied-status UPDATE) and the closure-block call (immediately
--      before the existing final return) -- same six-argument signature,
--      same SECURITY INVOKER, same grants; every other line preserved
--      verbatim from 202607270001.
--   3. CREATE OR REPLACE public.set_share_message_status, adding the
--      SHARE_MESSAGE_STATUS_TERMINAL guard before any status mutation --
--      same signature, same SECURITY DEFINER, same grants; every other
--      line preserved verbatim from 202608190001.
--   4. CREATE OR REPLACE public.enforce_project_update_client_share_apply_boundary
--      (the Phase 6B trigger FUNCTION only -- the trigger itself,
--      project_updates_enforce_client_share_apply_boundary, is NEVER
--      dropped and does not need to be, and is not, redeclared): 'applying'
--      is no longer blocked (the real Apply RPC always independently
--      re-validates and performs real work regardless of how 'applying'
--      was reached); an *entering* transition into 'applied' (a direct
--      INSERT already at 'applied', or an UPDATE from any non-'applied'
--      prior status) is permitted only when the transaction-local
--      capability matches the exact row id; an already-applied row
--      receiving an ordinary non-status update does not require the
--      capability.
--
-- No transient unsafe ordering: if this migration is interrupted after
-- step 3 but before step 4, the system remains SAFE -- client_share is
-- still blocked from applying/applied by the still-present, still-
-- unmodified Phase 6B trigger body, while the new closure logic sits
-- ready but inert (any attempt by the RPC to reach 'applied' would be
-- rejected by the still-old trigger body, aborting the whole Apply
-- transaction cleanly -- a hard failure, not a silent gap).
--
-- No historical migration is edited -- 202607270001, 202608190001,
-- 202608210001, and 202608230001 all remain exactly as they are; this is
-- a wholly new file. No new table, no new column.

'@

$migrationParts = New-Object System.Collections.Generic.List[string]
$migrationParts.Add($migrationHeader.TrimEnd() + "`n")

$migrationParts.Add(@'

-- =========================================================
-- 1. public.finalize_share_message_conversion (new)
-- =========================================================

'@.TrimStart())

$migrationParts.Add($newHelperBody.TrimEnd() + "`n`n")

$migrationParts.Add(@'
comment on function public.finalize_share_message_conversion(uuid, uuid) is
  'Phase 6C: atomic conversion-closure helper for client_share Apply. SECURITY DEFINER, callable directly by authenticated (required for the still-SECURITY INVOKER apply_project_update_transaction''s own perform call to succeed) -- therefore a complete, independent authorization boundary. Requires the transaction-local capability text2task.client_share_apply_update_id, bound to the exact p_project_update_id, before any other check or write -- a standalone call in its own transaction never has this set. Also independently re-validates ownership, applied status, client_share provenance, message linkage, author type, and not-already-converted -- a second, independent layer, not a replacement for the capability check. Writes exactly one share_message_conversions row and updates share_messages.status=''converted''; never touches resolved_at; target_task_id is always null in Phase 6C.';

revoke all on function public.finalize_share_message_conversion(uuid, uuid) from public;
revoke all on function public.finalize_share_message_conversion(uuid, uuid) from anon;
revoke all on function public.finalize_share_message_conversion(uuid, uuid) from service_role;
grant execute on function public.finalize_share_message_conversion(uuid, uuid) to authenticated;

'@)

$migrationParts.Add(@'
-- =========================================================
-- 2. public.apply_project_update_transaction (CREATE OR REPLACE --
--    same signature/security/grants, preserved from 202607270001 except
--    for the two Phase 6C insertions proven above)
-- =========================================================

'@)

$migrationParts.Add($applyRpcModifiedBody.TrimEnd() + "`n`n")

$migrationParts.Add(@'
comment on function public.apply_project_update_transaction(
  uuid,
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb
) is
  'Atomically applies one claimed Project Update review, commits item, mutation, timeline, and lifecycle writes, records user priority provenance for accepted project-level priority changes, and reconciles project completion via the shared reconcile_project_completion check. Phase 6C: for client_share rows only (source_share_message_id is not null), also establishes the transaction-local row-bound capability immediately before the applied-status write, and calls finalize_share_message_conversion immediately before the final return -- both a complete no-op for every other source type.';

'@)

$migrationParts.Add(@'
-- =========================================================
-- 3. public.set_share_message_status (CREATE OR REPLACE -- same
--    signature/security/grants, preserved from 202608190001 except for
--    the terminal-guard insertion proven above)
-- =========================================================

'@)

$migrationParts.Add($statusRpcModifiedBody.TrimEnd() + "`n`n")

$migrationParts.Add(@'
comment on function public.set_share_message_status(uuid, text) is
  'Owner-only workflow-state transition (new/reviewed/resolved/dismissed only -- converted is exclusively Phase 6C''s, never accepted as a target here) for one owned message. SECURITY DEFINER; obtains and null-checks auth.uid() internally; owner-scoped; project soft-delete checked; row locked FOR UPDATE. Phase 6C: loads the row''s current status in that same locked read and rejects with SHARE_MESSAGE_STATUS_TERMINAL, before any mutation is computed, if it is already ''converted'' -- the sole existing path capable of moving share_messages.status at all, so this one guard makes converted a true terminal state. Updates only status/reviewed_at/resolved_at -- never body, author_type, author_display_name, parent_id, share_link_id, project_id, user_id or created_at. Writes to no other table.';

'@)

$migrationParts.Add(@'
-- =========================================================
-- 4. public.enforce_project_update_client_share_apply_boundary
--    (CREATE OR REPLACE FUNCTION ONLY -- the trigger
--    project_updates_enforce_client_share_apply_boundary is NEVER
--    dropped and is not redeclared; preserved from 202608230001 except
--    for the predicate narrowing proven above)
-- =========================================================

'@)

$migrationParts.Add($boundaryModifiedBody.TrimEnd() + "`n`n")

$migrationParts.Add(@'
comment on function public.enforce_project_update_client_share_apply_boundary() is
  'Phase 6C client_share apply boundary (narrowed in place from the Phase 6B version -- never dropped): "applying" is no longer blocked for client_share (the real apply_project_update_transaction always independently re-validates and performs real work regardless of how "applying" was reached -- proven safe by the Phase 6C security audit). An *entering* transition into "applied" for client_share -- a direct INSERT already at "applied", or an UPDATE from any prior status other than "applied" -- is permitted only when the transaction-local capability text2task.client_share_apply_update_id matches the exact row id, a value only apply_project_update_transaction itself ever sets, immediately before its own authoritative applied-status write. An already-applied client_share row receiving an ordinary non-status update (OLD.status=''applied'' AND NEW.status=''applied'') does not require the capability -- this guard protects establishing applied, not every future write to an already-applied row. TG_OP-safe: OLD is referenced only inside a branch that has already established TG_OP=''UPDATE''.';
'@)

$migration = ($migrationParts -join "`n") -replace "`r`n", "`n" -replace "`r", "`n"
if (-not $migration.EndsWith("`n")) { $migration += "`n" }

# ---------------------------------------------------------------------
# Structural self-checks before writing anything.
# ---------------------------------------------------------------------
if ($migration -match '(?i)drop\s+trigger') {
  throw "Refusing to write: generated migration contains a DROP TRIGGER statement -- the Phase 6B boundary trigger must never be dropped."
}
if ($migration -match '(?i)drop\s+function\s+public\.enforce_project_update_client_share_apply_boundary') {
  throw "Refusing to write: generated migration drops the boundary function -- it must only be CREATE OR REPLACEd."
}
$capabilityGucOccurrences = Get-OccurrenceCount -Text $migration -Needle 'text2task.client_share_apply_update_id'
if ($capabilityGucOccurrences -lt 3) {
  throw "Refusing to write: expected the capability GUC name to appear at least three times (RPC set, trigger check, helper check), found $capabilityGucOccurrences."
}
Write-Host 'Structural self-checks passed (no DROP TRIGGER, no DROP of the boundary function, capability GUC name present in all three expected places).'

$migrationHash = Get-Sha256Hex -Text $migration

# ---------------------------------------------------------------------
# Stage, validate, then move into place.
# ---------------------------------------------------------------------
$stagingDir = Join-Path $migrationsDir '.generator-staging-phase6c'
if (Test-Path -LiteralPath $stagingDir) { Remove-Item -LiteralPath $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

try {
  $stagedOutput = Join-Path $stagingDir $outputFileName
  Write-StagedFile -StagingPath $stagedOutput -Content $migration

  $stagedReadBack = Get-NormalizedContent -Path $stagedOutput
  $stagedHash = Get-Sha256Hex -Text $stagedReadBack
  if ($stagedHash -ne $migrationHash) {
    throw "Validation failed: staged output hash ($stagedHash) does not match the in-memory hash ($migrationHash)."
  }

  Move-Item -LiteralPath $stagedOutput -Destination $outputFile -Force
} finally {
  if (Test-Path -LiteralPath $stagingDir) { Remove-Item -LiteralPath $stagingDir -Recurse -Force }
}

Write-Host "Wrote generated migration to: $outputFile"

$finalContent = Get-NormalizedContent -Path $outputFile
$finalHash = Get-Sha256Hex -Text $finalContent
if ($finalHash -ne $migrationHash) {
  throw "Validation failed: final output hash ($finalHash) does not match the in-memory hash ($migrationHash)."
}
Write-Host "Final output validation passed."

Write-Host ''
Write-Host '=== SHA-256 SUMMARY ==='
Write-Host "$applyRpcSourceName (full source) : $applyRpcSourceHash"
Write-Host "apply_project_update_transaction (original extracted body) : $applyRpcOriginalBodyHash"
Write-Host "$statusRpcSourceName (full source) : $statusRpcSourceHash"
Write-Host "set_share_message_status (original extracted body) : $statusRpcOriginalBodyHash"
Write-Host "$boundarySourceName (full source) : $boundarySourceHash"
Write-Host "enforce_project_update_client_share_apply_boundary (original extracted body) : $boundaryOriginalBodyHash"
Write-Host "$outputFileName (generated) : $finalHash"
Write-Host ''
Write-Host 'GENERATOR_VERIFICATION_STATUS: PASS'
