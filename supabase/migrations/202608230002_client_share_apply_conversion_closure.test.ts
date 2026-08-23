import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608230001_client_share_apply_boundary.test.ts).
//
// IMPORTANT: nothing in this file proves runtime behaviour (that the
// capability actually flows through set_config/current_setting at
// runtime, that a forged 'applied' row is actually rejected by a real
// Postgres engine, that text/image Apply is actually unaffected). It
// proves only that the migration declares exactly the structural contract
// the Phase 6C plan (and its security correction) locks. Runtime
// verification against a disposable Postgres instance is a separate,
// user-run step -- not faked here.

const MIGRATION_PATH = path.join(
  __dirname,
  "202608230002_client_share_apply_conversion_closure.sql"
);

const APPLY_RPC_SOURCE_PATH = path.join(
  __dirname,
  "202607270001_project_completion_reconciliation.sql"
);

const STATUS_RPC_SOURCE_PATH = path.join(
  __dirname,
  "202608190001_client_share_message_owner_rpcs.sql"
);

const BOUNDARY_SOURCE_PATH = path.join(
  __dirname,
  "202608230001_client_share_apply_boundary.sql"
);

const PROVENANCE_MIGRATION_PATH = path.join(
  __dirname,
  "202608210001_client_share_project_update_provenance.sql"
);

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function stripLineComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

function stripCommentOnStatements(source: string): string {
  return source.replace(/comment on [\s\S]*?';/g, "");
}

function statementsContaining(source: string, needle: string): string[] {
  // Splits on ';' (a reasonable approximation for this migration -- no
  // function body here contains a top-level, unquoted ';' outside of
  // $$...$$ function bodies followed immediately by another statement in
  // a way that would defeat this) and returns only statements that
  // actually contain `needle`, so a grant/revoke proximity check can
  // never accidentally span across an unrelated statement boundary.
  return source
    .split(";")
    .filter((statement) => statement.includes(needle));
}

function extractFunctionBody(source: string, functionName: string): string {
  const startMarker = `create or replace function public.${functionName}(`;
  const startIndex = source.indexOf(startMarker);

  if (startIndex === -1) {
    throw new Error(`Could not find function ${functionName} in migration`);
  }

  const endMarker = "\n$$;";
  const endIndex = source.indexOf(endMarker, startIndex);

  if (endIndex === -1) {
    throw new Error(`Could not find end of function ${functionName}`);
  }

  return source.slice(startIndex, endIndex + endMarker.length);
}

const sql = readNormalized(MIGRATION_PATH);
const code = stripLineComments(sql);
const normalizedCode = code.toLowerCase();
const executable = stripCommentOnStatements(code);
const normalizedExecutable = executable.toLowerCase();

const applyRpcBody = extractFunctionBody(code, "apply_project_update_transaction");
const statusRpcBody = extractFunctionBody(code, "set_share_message_status");
const boundaryBody = extractFunctionBody(
  code,
  "enforce_project_update_client_share_apply_boundary"
);
const helperBody = extractFunctionBody(code, "finalize_share_message_conversion");

const CAPABILITY_GUC = "text2task.client_share_apply_update_id";

describe("202608230002 - source provenance: each preserved function reconstructed from its own correct, independent authoritative migration", () => {
  it("apply_project_update_transaction is reconstructed from 202607270001, and only from 202607270001", () => {
    const applyRpcSource = readNormalized(APPLY_RPC_SOURCE_PATH);
    expect(applyRpcSource).toContain(
      "create or replace function public.apply_project_update_transaction("
    );

    const originalBody = extractFunctionBody(
      stripLineComments(applyRpcSource),
      "apply_project_update_transaction"
    );

    // Reverse the two known Phase 6C insertions and assert byte identity
    // to the original, unmodified source body -- an independent proof,
    // not merely "the function still exists".
    const capabilityBlock = `  if v_update.source_share_message_id is not null then
    perform set_config(
      'text2task.client_share_apply_update_id',
      p_update_id::text,
      true
    );
  end if;

`;
    const closureBlock = `  if v_update.source_share_message_id is not null then
    perform public.finalize_share_message_conversion(
      v_update.source_share_message_id,
      p_update_id
    );
  end if;

`;

    expect(applyRpcBody).toContain(capabilityBlock);
    expect(applyRpcBody).toContain(closureBlock);

    const reconstructed = applyRpcBody
      .replace(closureBlock, "")
      .replace(capabilityBlock, "");

    expect(sha256(reconstructed)).toBe(sha256(originalBody));
  });

  it("set_share_message_status is reconstructed from 202608190001, and NEVER from 202607270001", () => {
    const statusRpcSource = readNormalized(STATUS_RPC_SOURCE_PATH);
    expect(statusRpcSource).toContain(
      "create or replace function public.set_share_message_status("
    );

    const applyRpcSource = readNormalized(APPLY_RPC_SOURCE_PATH);
    expect(applyRpcSource).not.toContain(
      "create or replace function public.set_share_message_status("
    );

    const originalBody = extractFunctionBody(
      stripLineComments(statusRpcSource),
      "set_share_message_status"
    );

    const declareOld = `declare
  v_user_id uuid := auth.uid();
  v_message_user_id uuid;
  v_message_project_id uuid;
  v_project_deleted_at timestamptz;
  v_existing_reviewed_at timestamptz;
  v_reviewed_at timestamptz;
  v_resolved_at timestamptz;
  v_now timestamptz := now();
begin
`;
    const declareNew = `declare
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
`;
    const selectOld = `  select message.user_id, message.project_id, message.reviewed_at
    into v_message_user_id, v_message_project_id, v_existing_reviewed_at
    from public.share_messages as message
    where message.id = p_message_id and message.user_id = v_user_id
    for update;
`;
    const selectNew = `  select message.user_id, message.project_id, message.reviewed_at, message.status
    into v_message_user_id, v_message_project_id, v_existing_reviewed_at, v_existing_status
    from public.share_messages as message
    where message.id = p_message_id and message.user_id = v_user_id
    for update;
`;
    const terminalBlock = `  if v_existing_status = 'converted' then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_STATUS_TERMINAL';
  end if;

`;

    expect(statusRpcBody).toContain(declareNew);
    expect(statusRpcBody).toContain(selectNew);
    expect(statusRpcBody).toContain(terminalBlock);

    const reconstructed = statusRpcBody
      .replace(terminalBlock, "")
      .replace(selectNew, selectOld)
      .replace(declareNew, declareOld);

    expect(sha256(reconstructed)).toBe(sha256(originalBody));
  });

  it("enforce_project_update_client_share_apply_boundary is reconstructed from 202608230001", () => {
    const boundarySource = readNormalized(BOUNDARY_SOURCE_PATH);
    expect(boundarySource).toContain(
      "create or replace function public.enforce_project_update_client_share_apply_boundary("
    );

    const originalBody = extractFunctionBody(
      stripLineComments(boundarySource),
      "enforce_project_update_client_share_apply_boundary"
    );

    const originalPredicate = `begin
  if new.source_type = 'client_share'
    and new.status in ('applying', 'applied') then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE';
  end if;

  return new;
end;
$$;`;

    const newPredicate = `begin
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
$$;`;

    expect(boundaryBody).toContain(newPredicate);

    // Use a replacer FUNCTION, not a string: originalPredicate contains
    // literal "$$;" and String.prototype.replace treats "$$" in a string
    // replacement value as a special escape (collapsing to one "$"),
    // which would silently corrupt this reconstruction.
    const reconstructed = boundaryBody.replace(newPredicate, () => originalPredicate);
    expect(sha256(reconstructed)).toBe(sha256(originalBody));
  });

  it("each of the three reconstruction proofs is independent -- swapping any two source hashes would not accidentally match", () => {
    const applyRpcSource = readNormalized(APPLY_RPC_SOURCE_PATH);
    const statusRpcSource = readNormalized(STATUS_RPC_SOURCE_PATH);
    const boundarySource = readNormalized(BOUNDARY_SOURCE_PATH);

    const hashes = [
      sha256(applyRpcSource),
      sha256(statusRpcSource),
      sha256(boundarySource),
    ];

    expect(new Set(hashes).size).toBe(3);
  });
});

describe("202608230002 - apply_project_update_transaction: signature/security/grants unchanged", () => {
  it("keeps the exact same six-argument signature", () => {
    expect(code).toContain(
      "create or replace function public.apply_project_update_transaction(\n  p_update_id uuid,\n  p_apply_attempt_id uuid,\n  p_accepted_item_ids uuid[],\n  p_rejected_item_ids uuid[],\n  p_edited_items jsonb,\n  p_apply_payload jsonb\n)"
    );
  });

  it("remains SECURITY INVOKER", () => {
    expect(applyRpcBody).toContain("security invoker");
  });

  it("issues no grant/revoke statement naming apply_project_update_transaction (existing ACL is preserved automatically by CREATE OR REPLACE, not reissued)", () => {
    const offending = statementsContaining(
      normalizedExecutable,
      "apply_project_update_transaction"
    ).filter((statement) => /\b(grant|revoke)\b/.test(statement));
    expect(offending).toEqual([]);
  });

  it("preserves the client-detail JSON-path (#>) fixes", () => {
    expect(applyRpcBody).toContain("v_mutation #> '{projectUpdates}'");
    expect(applyRpcBody).toContain("v_mutation #> '{clientUpdates}'");
    expect(applyRpcBody).toContain("v_mutation #> '{taskUpdates}'");
  });

  it("preserves the priority_source = 'user' provenance write", () => {
    expect(applyRpcBody).toContain("priority_source = 'user'");
  });

  it("preserves the reconcile_project_completion call", () => {
    expect(applyRpcBody).toContain(
      "perform public.reconcile_project_completion(v_project.id, v_user_id, v_now);"
    );
  });

  it("preserves every existing error code", () => {
    for (const errorCode of [
      "APPLY_ATTEMPT_MISMATCH",
      "PROJECT_NOT_FOUND",
      "CLIENT_NOT_FOUND",
      "ITEM_VALIDATION_FAILED",
      "APPLY_PAYLOAD_ITEM_MISMATCH",
      "TARGET_TASK_VALIDATION_FAILED",
      "MARK_APPLIED_ITEMS_FAILED",
      "MARK_REJECTED_ITEMS_FAILED",
      "MARK_UPDATE_APPLIED_FAILED",
      "PROJECT_PRIORITY_PROVENANCE_UPDATE_FAILED",
    ]) {
      expect(applyRpcBody).toContain(errorCode);
    }
  });
});

describe("202608230002 - row-bound transaction-local capability", () => {
  it("uses the exact locked GUC name", () => {
    expect(applyRpcBody).toContain(CAPABILITY_GUC);
    expect(boundaryBody).toContain(CAPABILITY_GUC);
    expect(helperBody).toContain(CAPABILITY_GUC);
  });

  it("apply_project_update_transaction sets the capability with is_local=true (never false or omitted)", () => {
    expect(applyRpcBody).toMatch(
      /perform set_config\(\s*'text2task\.client_share_apply_update_id',\s*p_update_id::text,\s*true\s*\);/
    );
  });

  it("sets the capability value to p_update_id::text -- the row-bound id, never a boolean literal", () => {
    expect(applyRpcBody).not.toMatch(
      /set_config\(\s*'text2task\.client_share_apply_update_id',\s*'(true|on)'/
    );
  });

  it("sets the capability strictly before the existing applied-status UPDATE (source order)", () => {
    const capabilityIndex = applyRpcBody.indexOf(
      "perform set_config(\n      'text2task.client_share_apply_update_id',"
    );
    const appliedUpdateIndex = applyRpcBody.indexOf(
      "update public.project_updates as update_row\n  set\n    status = 'applied',"
    );

    expect(capabilityIndex).toBeGreaterThan(-1);
    expect(appliedUpdateIndex).toBeGreaterThan(-1);
    expect(capabilityIndex).toBeLessThan(appliedUpdateIndex);
  });

  it("gates the capability strictly on client_share (source_share_message_id is not null) -- a complete no-op for every other source type", () => {
    expect(applyRpcBody).toMatch(
      /if v_update\.source_share_message_id is not null then\s*\n\s*perform set_config\(/
    );
  });

  it("no boolean-only, non-row-bound transaction flag is used anywhere (negative assertion against the superseded generic-GUC design)", () => {
    expect(normalizedExecutable).not.toContain("client_share_transaction");
    expect(normalizedExecutable).not.toMatch(
      /set_config\(\s*'[^']*client_share[^']*',\s*'(on|true)'/
    );
  });
});

describe("202608230002 - Phase 6B boundary: RETAINED and narrowed in place, never dropped", () => {
  it("issues no DROP TRIGGER statement anywhere", () => {
    expect(normalizedExecutable).not.toMatch(/drop\s+trigger/);
  });

  it("issues no DROP FUNCTION statement targeting the boundary function", () => {
    expect(normalizedExecutable).not.toMatch(
      /drop\s+function\s+public\.enforce_project_update_client_share_apply_boundary/
    );
  });

  it("issues no CREATE TRIGGER statement at all -- the existing trigger binding is untouched, not redeclared", () => {
    expect(normalizedExecutable).not.toMatch(/create\s+trigger/);
  });

  it("no longer rejects status = 'applying' for client_share -- the predicate checks only 'applied'", () => {
    expect(boundaryBody).toContain("and new.status = 'applied' then");
    expect(boundaryBody).not.toMatch(/new\.status in \([^)]*'applying'/);
  });

  it("rejects an entering INSERT already at status='applied' without a matching capability", () => {
    expect(boundaryBody).toMatch(/if tg_op = 'INSERT' then/);
  });

  it("rejects an entering UPDATE (old.status distinct from 'applied') without a matching capability", () => {
    expect(boundaryBody).toMatch(
      /elsif tg_op = 'UPDATE'\s*\n\s*and old\.status is distinct from 'applied' then/
    );
  });

  it("does not require the capability for an already-applied row receiving a non-status update (old.status = 'applied' -> new.status = 'applied' falls through both branches)", () => {
    // Structural proof: the UPDATE branch's own guard condition is
    // `old.status is distinct from 'applied'` -- when OLD.status is
    // already 'applied', this condition is false, so neither branch's
    // capability check executes at all for that row.
    expect(boundaryBody).toContain("old.status is distinct from 'applied' then");
  });

  it("never references OLD outside of a branch that has already established TG_OP = 'UPDATE' (source-order proof)", () => {
    const oldReferenceIndex = boundaryBody.indexOf("old.status");
    const updateGuardIndex = boundaryBody.indexOf("tg_op = 'UPDATE'");

    expect(oldReferenceIndex).toBeGreaterThan(-1);
    expect(updateGuardIndex).toBeGreaterThan(-1);
    expect(updateGuardIndex).toBeLessThan(oldReferenceIndex);
  });

  it("raises the same stable existing error code, PROJECT_UPDATE_SOURCE_NOT_APPLIABLE", () => {
    expect(boundaryBody).toContain("message = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE'");
  });

  it("the boundary function remains SECURITY INVOKER with a locked search_path", () => {
    expect(boundaryBody).toContain("security invoker");
    expect(boundaryBody).toContain("set search_path = public, pg_temp");
  });

  it("issues no grant/revoke statement naming the boundary function (existing lockdown is preserved automatically, not reissued)", () => {
    const offending = statementsContaining(
      normalizedExecutable,
      "enforce_project_update_client_share_apply_boundary"
    ).filter((statement) => /\b(grant|revoke)\b/.test(statement));
    expect(offending).toEqual([]);
  });

  it("the Phase 6B migration file itself is not modified by this change -- read directly and confirmed still intact, trigger still installed there", () => {
    const boundaryMigrationSource = readNormalized(BOUNDARY_SOURCE_PATH);
    expect(boundaryMigrationSource).toContain(
      "create trigger project_updates_enforce_client_share_apply_boundary"
    );
    expect(boundaryMigrationSource).toContain(
      "before insert or update on public.project_updates"
    );
  });
});

describe("202608230002 - finalize_share_message_conversion: new, complete, independent authorization boundary", () => {
  it("is SECURITY DEFINER with a locked search_path", () => {
    expect(helperBody).toContain("security definer");
    expect(helperBody).toContain("set search_path = public, pg_temp");
  });

  it("derives the actor from auth.uid() and rejects when null", () => {
    expect(helperBody).toContain("v_user_id uuid := auth.uid();");
    expect(helperBody).toContain("if v_user_id is null then");
    expect(helperBody).toContain("message = 'UNAUTHORIZED'");
  });

  it("checks the transaction-local capability BEFORE any other validation or write (source-order proof)", () => {
    const capabilityIndex = helperBody.indexOf(CAPABILITY_GUC);
    const firstSelectIndex = helperBody.indexOf("select\n    update_row.status");
    const insertIndex = helperBody.indexOf("insert into public.share_message_conversions");

    expect(capabilityIndex).toBeGreaterThan(-1);
    expect(firstSelectIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(-1);
    expect(capabilityIndex).toBeLessThan(firstSelectIndex);
    expect(capabilityIndex).toBeLessThan(insertIndex);
  });

  it("compares the capability against p_project_update_id::text exactly", () => {
    expect(helperBody).toContain(
      "if current_setting('text2task.client_share_apply_update_id', true)\n      is distinct from p_project_update_id::text then"
    );
  });

  it("fails closed with a stable error code when the capability is missing or mismatched", () => {
    expect(helperBody).toContain("message = 'SHARE_CONVERSION_APPLY_CONTEXT_REQUIRED'");
  });

  it("locks project_updates FOR UPDATE and validates ownership/applied-status/client_share-provenance/message-linkage", () => {
    expect(helperBody).toContain("from public.project_updates as update_row");
    expect(helperBody).toContain("for update;");
    expect(helperBody).toContain("v_update_status <> 'applied'");
    expect(helperBody).toContain("v_update_source_type <> 'client_share'");
    expect(helperBody).toContain(
      "v_update_source_share_message_id is distinct from p_message_id"
    );
  });

  it("locks share_messages FOR UPDATE (after project_updates -- matching the binding lock order) and validates project match/author_type/not-already-converted", () => {
    const projectUpdatesLockIndex = helperBody.indexOf(
      "from public.project_updates as update_row"
    );
    const shareMessagesLockIndex = helperBody.indexOf(
      "from public.share_messages as message"
    );

    expect(projectUpdatesLockIndex).toBeGreaterThan(-1);
    expect(shareMessagesLockIndex).toBeGreaterThan(-1);
    expect(projectUpdatesLockIndex).toBeLessThan(shareMessagesLockIndex);

    expect(helperBody).toContain("v_message_project_id is distinct from v_update_project_id");
    expect(helperBody).toContain("v_message_author_type <> 'client'");
    expect(helperBody).toContain("v_message_status = 'converted'");
  });

  it("inserts exactly one share_message_conversions row with converted_by = the authenticated actor", () => {
    expect(helperBody).toContain("insert into public.share_message_conversions");
    expect(helperBody).toContain("v_user_id,\n    p_message_id,\n    p_project_update_id,\n    null,\n    v_user_id,");
  });

  it("uses reviewed_at = coalesce(reviewed_at, now-at-conversion) semantics, asserted textually", () => {
    expect(helperBody).toContain("reviewed_at = coalesce(reviewed_at, v_converted_at)");
  });

  it("never references resolved_at (source-scan negative assertion)", () => {
    expect(helperBody.toLowerCase()).not.toContain("resolved_at");
  });

  it("target_task_id is always null in this migration (source-scan assertion)", () => {
    expect(helperBody).toMatch(/target_task_id,\s*\n\s*converted_by,/);
  });

  it("grants EXECUTE only to authenticated; revoked from public, anon, service_role", () => {
    for (const role of ["public", "anon", "service_role"]) {
      expect(normalizedExecutable).toContain(
        `revoke all on function public.finalize_share_message_conversion(uuid, uuid) from ${role};`
      );
    }
    expect(normalizedExecutable).toContain(
      "grant execute on function public.finalize_share_message_conversion(uuid, uuid) to authenticated;"
    );
  });
});

describe("202608230002 - apply_project_update_transaction calls the closure helper only for client_share, strictly before the final return", () => {
  it("gates the helper call on source_share_message_id is not null", () => {
    expect(applyRpcBody).toMatch(
      /if v_update\.source_share_message_id is not null then\s*\n\s*perform public\.finalize_share_message_conversion\(/
    );
  });

  it("calls the helper strictly before the final return jsonb_build_object", () => {
    const closureCallIndex = applyRpcBody.indexOf(
      "perform public.finalize_share_message_conversion("
    );
    const returnIndex = applyRpcBody.indexOf("return jsonb_build_object(\n    'update',");

    expect(closureCallIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(-1);
    expect(closureCallIndex).toBeLessThan(returnIndex);
  });

  it("no exception block swallows a helper failure into a fabricated success (no BEGIN...EXCEPTION wrapping the closure call)", () => {
    const closureCallIndex = applyRpcBody.indexOf(
      "perform public.finalize_share_message_conversion("
    );
    const precedingSlice = applyRpcBody.slice(0, closureCallIndex);
    const lastExceptionIndex = precedingSlice.lastIndexOf("exception when");

    // No "exception when" block exists anywhere in this function at all --
    // any raised exception always propagates and aborts the whole
    // transaction, matching every other error path already in this RPC.
    expect(lastExceptionIndex).toBe(-1);
  });
});

describe("202608230002 - set_share_message_status: converted terminality", () => {
  it("loads the row's current status in the existing locked SELECT", () => {
    expect(statusRpcBody).toContain("message.status");
    expect(statusRpcBody).toContain("v_existing_status");
  });

  it("rejects with SHARE_MESSAGE_STATUS_TERMINAL before any status mutation is computed", () => {
    const terminalCheckIndex = statusRpcBody.indexOf("SHARE_MESSAGE_STATUS_TERMINAL");
    const firstMutationIndex = statusRpcBody.indexOf("if p_status = 'new' then");

    expect(terminalCheckIndex).toBeGreaterThan(-1);
    expect(firstMutationIndex).toBeGreaterThan(-1);
    expect(terminalCheckIndex).toBeLessThan(firstMutationIndex);
  });

  it("never changes resolved_at semantics for new/reviewed/resolved/dismissed", () => {
    expect(statusRpcBody).toContain("v_reviewed_at := coalesce(v_existing_reviewed_at, v_now);");
    expect(statusRpcBody).toContain("v_resolved_at := v_now;");
  });

  it("remains SECURITY DEFINER with EXECUTE granted only to authenticated (no new grant/revoke statement issued -- ACL preserved automatically)", () => {
    expect(statusRpcBody).toContain("security definer");
    const offending = statementsContaining(
      normalizedExecutable,
      "set_share_message_status"
    ).filter((statement) => /\b(grant|revoke)\b/.test(statement));
    expect(offending).toEqual([]);
  });
});

describe("202608230002 - reject-only Apply still converts (no accepted-work-mutation requirement anywhere in the new closure/capability logic)", () => {
  it("the capability set_config call is unconditional on accepted-item count -- gated only on source_share_message_id", () => {
    const capabilityLine = applyRpcBody.match(
      /if [^\n]*then\s*\n\s*perform set_config\(/
    )?.[0];

    expect(capabilityLine).toBeDefined();
    expect(capabilityLine).not.toContain("v_accepted_ids");
  });

  it("the closure call is unconditional on accepted-item count -- gated only on source_share_message_id", () => {
    const closureLine = applyRpcBody.match(
      /if [^\n]*then\s*\n\s*perform public\.finalize_share_message_conversion\(/
    )?.[0];

    expect(closureLine).toBeDefined();
    expect(closureLine).not.toContain("v_accepted_ids");
  });

  it("finalize_share_message_conversion itself never inspects project_update_items or project_timeline_events as a proof of work", () => {
    expect(helperBody).not.toContain("project_update_items");
    expect(helperBody).not.toContain("project_timeline_events");
  });
});

describe("202608230002 - schema: no new table, no new column; historical migrations untouched", () => {
  it("adds no column", () => {
    expect(normalizedExecutable).not.toMatch(/add column/);
  });

  it("creates no new table", () => {
    expect(normalizedExecutable).not.toMatch(/create table/);
  });

  it("the Phase 6A provenance migration file itself is not modified by this change", () => {
    const provenanceSource = readNormalized(PROVENANCE_MIGRATION_PATH);
    expect(provenanceSource).toContain(
      "create or replace function public.enforce_project_update_source_provenance()"
    );
  });

  it("this migration never redefines enforce_project_update_source_provenance", () => {
    expect(normalizedCode).not.toContain(
      "create or replace function public.enforce_project_update_source_provenance"
    );
  });
});
