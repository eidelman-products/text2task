import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { loadShareMessageForConversion } from "@/lib/share/share-messages-repository.server";
import { loadProjectUpdateContext } from "@/lib/project-updates/project-update-context.server";
import { extractProjectUpdateFacts } from "@/lib/project-updates/v2/project-update-facts.server";
import { judgeProjectUpdateFacts } from "@/lib/project-updates/v2/project-update-judge.server";
import {
  buildProjectUpdateV2AuditItems,
  buildProjectUpdateV2AuditSummary,
} from "@/lib/project-updates/v2/project-update-result-builder.server";
import {
  createProjectUpdateAuditItems,
  createProjectUpdateAuditRecord,
  markProjectUpdateAsAnalyzed,
  markProjectUpdateAsFailed,
} from "@/lib/project-updates/project-update-audit.server";
import type {
  ProjectTimelineEvent,
  ProjectUpdate,
  ProjectUpdateItem,
} from "@/lib/project-updates/project-update-types";
import type { ProjectUpdateV2AnalysisSummary } from "@/lib/project-updates/v2/project-update-facts.types";

/*
  Phase 6B (corrected) -- reservation-first operational idempotency for
  converting one owned, client-authored share message into a Client
  Update analysis.

  The FIRST Phase 6B implementation ran the full AI pipeline (context
  load, fact extraction, judging) BEFORE any project_updates row existed,
  and only relied on Phase 6A's unique index to arbitrate the final
  INSERT. The final acceptance audit proved this unsafe: two simultaneous
  first-time requests both ran a full concurrent AI analysis, and because
  the row was inserted at status='analyzed' with its items added in a
  SEPARATE, later statement, a losing concurrent request could observe
  the winner's still-in-progress row (status='analyzed', zero items yet)
  and misclassify it as an abandoned attempt safe to reanalyze -- racing
  item deletion/insertion and ai_summary/analyzed_at writes on the same
  row with no locking of any kind (CONCURRENCY_BLOCKER / STATUS_BLOCKER).

  This corrected version claims a durable "reservation" row -- via the
  SAME createProjectUpdateAuditRecord INSERT Phase 6A/6B already use,
  written at status='draft' -- BEFORE any AI call. Ownership of that
  INSERT (or, for retries, ownership of an atomic conditional UPDATE) is
  the ONLY thing that authorizes a request to call extractProjectUpdateFacts
  / judgeProjectUpdateFacts. A losing request never runs AI; it re-selects
  the authoritative row and reports either the finished result (READY) or
  the fact that another request currently owns it (IN_PROGRESS) -- it
  never guesses based on item count, because item count is no longer
  status-authoritative anywhere in this file (Correction 4: status alone
  decides; a successful analysis CAN legitimately persist zero items,
  e.g. a purely conversational client message with no actionable
  content -- see project-update-result-builder.server.ts's
  buildProjectUpdateV2AuditItems, which maps 1:1 from the judge's own
  decisions array and has no minimum-length invariant).

  This file still creates no second analyzer, no second persistence
  system, and no second review state machine. Every AI call and every
  row write reuses the EXACT existing building blocks analyzeProjectUpdateV2
  itself is built from (loadProjectUpdateContext, extractProjectUpdateFacts,
  judgeProjectUpdateFacts, buildProjectUpdateV2AuditSummary/Items,
  createProjectUpdateAuditItems, createProjectUpdateAuditRecord,
  markProjectUpdateAsAnalyzed, markProjectUpdateAsFailed) -- it no longer
  calls analyzeProjectUpdateV2 itself for client_share at all, because
  that function's own shape (INSERT-after-AI) is exactly the concurrency
  hole being corrected here. analyzeProjectUpdateV2's client_share support
  remains in place and covered by its own tests (documenting the exact
  rawInput-persistence / no-timeline-event contract in isolation); this
  file simply no longer calls it for the fresh-reservation path.

  Never inserts into share_message_conversions, never sets
  share_messages.status, never touches apply_project_update_transaction.
  Phase 6C's own future atomic Apply-closure work is untouched.
*/

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type ShareMessageConversionErrorCode =
  | "UNAUTHENTICATED"
  | "SHARE_MESSAGE_NOT_FOUND"
  | "SHARE_MESSAGE_NOT_CLIENT_AUTHORED"
  | "SHARE_MESSAGE_PROJECT_NOT_FOUND"
  | "UNEXPECTED";

export type ShareMessageConversionResult =
  | {
      ok: true;
      /** A finished (or previously finished) analysis this caller can
       * open for review right now. */
      state: "ready";
      /** true when an existing analyzed/reviewed/applying/applied row
       * was returned unchanged (no new AI call this request); false
       * when THIS request just ran the analysis (fresh reservation
       * winner, or retry claim winner). */
      resumed: boolean;
      update: ProjectUpdate;
      items: ProjectUpdateItem[];
      timelineEvent: ProjectTimelineEvent | null;
      analysis: ProjectUpdateV2AnalysisSummary;
    }
  | {
      ok: true;
      /** Another request currently owns this message's reservation
       * (either a fresh analysis or a retry claim, still running). This
       * caller ran NO AI and created NO row -- the SAME durable
       * projectUpdateId is returned so a later explicit request can
       * check back. Never treat this as a failure requiring a new
       * conversion attempt. */
      state: "in_progress";
      projectUpdateId: string;
    }
  | {
      ok: false;
      code: ShareMessageConversionErrorCode;
      error: string;
    };

const FALLBACK_ANALYSIS_SUMMARY: ProjectUpdateV2AnalysisSummary = {
  headline: "Client update analyzed.",
  reasoning: "",
  riskLevel: "low",
  detectedChanges: [],
};

/** ai_summary is a loosely-typed JSON blob (project_updates.ai_summary
 * jsonb) -- never trusted structurally. Extracts exactly the four
 * ProjectUpdateV2AnalysisSummary fields buildProjectUpdateV2AuditSummary
 * itself always writes, falling back safely if the stored shape is ever
 * unexpected (e.g. a future non-V2 row). */
function extractAnalysisSummary(aiSummary: unknown): ProjectUpdateV2AnalysisSummary {
  if (!aiSummary || typeof aiSummary !== "object") {
    return FALLBACK_ANALYSIS_SUMMARY;
  }

  const record = aiSummary as Record<string, unknown>;
  const headline = typeof record.headline === "string" ? record.headline : FALLBACK_ANALYSIS_SUMMARY.headline;
  const reasoning = typeof record.reasoning === "string" ? record.reasoning : FALLBACK_ANALYSIS_SUMMARY.reasoning;
  const riskLevel =
    record.riskLevel === "low" || record.riskLevel === "medium" || record.riskLevel === "high"
      ? record.riskLevel
      : FALLBACK_ANALYSIS_SUMMARY.riskLevel;
  const detectedChanges = Array.isArray(record.detectedChanges)
    ? record.detectedChanges.filter((entry): entry is string => typeof entry === "string")
    : FALLBACK_ANALYSIS_SUMMARY.detectedChanges;

  return { headline, reasoning, riskLevel, detectedChanges };
}

/** Correction 4 -- status alone decides, never item count. */
const RESUMABLE_STATUSES = new Set(["analyzed", "reviewed", "applying", "applied"]);
const RETRYABLE_STATUSES = new Set(["failed", "ignored"]);
/** 'draft' is handled separately, inline: it means a reservation
 * (fresh or retry-claimed) is currently owned by SOME request and must
 * never be treated as auto-retryable by another. */

const RESERVATION_UNIQUE_CONSTRAINT = "project_updates_source_share_message_id_key";

type ExistingSlot = { update: Record<string, unknown>; itemCount: number };

async function findExistingSlot(
  supabase: SupabaseClient,
  input: { sourceShareMessageId: string; userId: string }
): Promise<ExistingSlot | null> {
  const { data, error } = await supabase
    .from("project_updates")
    .select("*")
    .eq("source_share_message_id", input.sourceShareMessageId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const { count } = await supabase
    .from("project_update_items")
    .select("id", { count: "exact", head: true })
    .eq("project_update_id", (data as { id: string }).id)
    .eq("user_id", input.userId);

  return { update: data as Record<string, unknown>, itemCount: count ?? 0 };
}

async function loadItemsForUpdate(
  supabase: SupabaseClient,
  input: { projectUpdateId: string; userId: string }
): Promise<ProjectUpdateItem[]> {
  const { data } = await supabase
    .from("project_update_items")
    .select("*")
    .eq("project_update_id", input.projectUpdateId)
    .eq("user_id", input.userId)
    .order("created_at", { ascending: true });

  return (data ?? []) as ProjectUpdateItem[];
}

function readyResult(
  update: Record<string, unknown>,
  items: ProjectUpdateItem[],
  resumed: boolean
): ShareMessageConversionResult {
  return {
    ok: true,
    state: "ready",
    resumed,
    update: update as unknown as ProjectUpdate,
    items,
    timelineEvent: null,
    analysis: extractAnalysisSummary(update.ai_summary),
  };
}

function inProgressResult(projectUpdateId: string): ShareMessageConversionResult {
  return { ok: true, state: "in_progress", projectUpdateId };
}

async function resumeSlot(
  supabase: SupabaseClient,
  slot: ExistingSlot,
  userId: string
): Promise<ShareMessageConversionResult> {
  const items = await loadItemsForUpdate(supabase, {
    projectUpdateId: String(slot.update.id),
    userId,
  });
  return readyResult(slot.update, items, true);
}

/** Best-effort only -- a failure here must never mask the ORIGINAL
 * analysis failure being reported to the caller. Guarded to only ever
 * transition a row this file itself put into 'draft' (a reservation or
 * a claimed retry), never any other status. */
async function markReservationFailed(projectUpdateId: string): Promise<void> {
  try {
    await markProjectUpdateAsFailed(projectUpdateId);
  } catch {
    // Best-effort: a later explicit request will still find this row in
    // whatever state it is actually in and act accordingly.
  }
}

/**
 * Runs the analyzer's own constituent steps -- never analyzeProjectUpdateV2
 * itself, which INSERTs -- against an ALREADY-OWNED reservation row
 * (status='draft', source_type/source_share_message_id/raw_input already
 * durably written by whichever INSERT or claim gave this caller
 * ownership). Persists via a delete+insert of items (createProjectUpdateAuditItems)
 * and a single UPDATE (markProjectUpdateAsAnalyzed) that touches only
 * status/ai_summary/analyzed_at -- never source_type, source_share_message_id,
 * or raw_input, so Phase 6A's immutability trigger sees no change to
 * those columns. No project_timeline_events row is created here, matching
 * the locked Phase 6B requirement.
 */
async function analyzeIntoReservedSlot(
  supabase: SupabaseClient,
  input: { projectUpdateId: string; projectId: string; userId: string; body: string }
): Promise<ShareMessageConversionResult> {
  try {
    const contextResult = await loadProjectUpdateContext(input.projectId);
    if (!contextResult.ok) {
      await markReservationFailed(input.projectUpdateId);
      return { ok: false, code: "UNEXPECTED", error: contextResult.error };
    }

    const factsResult = await extractProjectUpdateFacts({
      rawInput: input.body,
      sourceType: "client_share",
    });
    if (!factsResult.ok) {
      await markReservationFailed(input.projectUpdateId);
      return { ok: false, code: "UNEXPECTED", error: factsResult.error };
    }

    const judgeResult = judgeProjectUpdateFacts({
      facts: factsResult.facts,
      context: contextResult.context,
    });

    const auditSummary = buildProjectUpdateV2AuditSummary({
      summary: judgeResult.summary,
      decisions: judgeResult.decisions,
    });

    // Defensive only: a fresh reservation's row never has items yet, and
    // a retry claim starts from a row this same request just atomically
    // won -- but clearing first keeps this step idempotent regardless.
    await supabase
      .from("project_update_items")
      .delete()
      .eq("project_update_id", input.projectUpdateId)
      .eq("user_id", input.userId);

    const itemResult = await createProjectUpdateAuditItems(
      buildProjectUpdateV2AuditItems({
        decisions: judgeResult.decisions,
        projectUpdateId: input.projectUpdateId,
        projectId: input.projectId,
      })
    );
    if (!itemResult.ok) {
      await markReservationFailed(input.projectUpdateId);
      return { ok: false, code: "UNEXPECTED", error: itemResult.error };
    }

    const updateResult = await markProjectUpdateAsAnalyzed(input.projectUpdateId, {
      ...auditSummary,
      extractedFacts: factsResult.facts,
    });
    if (!updateResult.ok) {
      return { ok: false, code: "UNEXPECTED", error: updateResult.error };
    }

    return {
      ok: true,
      state: "ready",
      resumed: false,
      update: updateResult.data,
      items: itemResult.data,
      timelineEvent: null,
      analysis: judgeResult.summary,
    };
  } catch (error) {
    await markReservationFailed(input.projectUpdateId);
    return {
      ok: false,
      code: "UNEXPECTED",
      error: error instanceof Error ? error.message : "Could not analyze this client update.",
    };
  }
}

/**
 * Correction 5 -- single-ownership atomic claim for an existing
 * failed/ignored row, via a compare-and-set style UPDATE: only a caller
 * whose UPDATE actually matches `status = expectedStatus` transitions the
 * row to 'draft' and may proceed to analyze; a losing concurrent claim
 * affects zero rows and must run NO AI.
 */
async function claimRetryableSlot(
  supabase: SupabaseClient,
  input: { projectUpdateId: string; userId: string; expectedStatus: "failed" | "ignored" }
): Promise<boolean> {
  const { data, error } = await supabase
    .from("project_updates")
    .update({ status: "draft" })
    .eq("id", input.projectUpdateId)
    .eq("user_id", input.userId)
    .eq("status", input.expectedStatus)
    .select("id")
    .maybeSingle();

  return !error && Boolean(data);
}

async function handleExistingSlot(
  supabase: SupabaseClient,
  slot: ExistingSlot,
  input: { projectId: string; userId: string; body: string }
): Promise<ShareMessageConversionResult> {
  const status = String(slot.update.status ?? "");
  const projectUpdateId = String(slot.update.id);

  if (RESUMABLE_STATUSES.has(status)) {
    // analyzed / reviewed / applying / applied -- ALWAYS resume,
    // read-only, regardless of item count (Correction 4 / 8: status is
    // authoritative, and zero items can be a legitimate finished result).
    return resumeSlot(supabase, slot, input.userId);
  }

  if (status === "draft") {
    // Another request currently owns this reservation (fresh analysis or
    // a retry claim, still running) -- never auto-retried merely because
    // it has zero items right now.
    return inProgressResult(projectUpdateId);
  }

  if (RETRYABLE_STATUSES.has(status)) {
    const claimed = await claimRetryableSlot(supabase, {
      projectUpdateId,
      userId: input.userId,
      expectedStatus: status as "failed" | "ignored",
    });

    if (!claimed) {
      // Lost the race for this retry -- reselect and report the CURRENT
      // state; never run AI ourselves.
      const reselected = await findExistingSlot(supabase, {
        sourceShareMessageId: String(slot.update.source_share_message_id ?? ""),
        userId: input.userId,
      });

      if (!reselected) {
        return {
          ok: false,
          code: "UNEXPECTED",
          error: "Could not reselect this update after a concurrent retry claim.",
        };
      }

      const reselectedStatus = String(reselected.update.status ?? "");
      if (RESUMABLE_STATUSES.has(reselectedStatus)) {
        return resumeSlot(supabase, reselected, input.userId);
      }

      return inProgressResult(String(reselected.update.id));
    }

    // Sole owner of this retry claim -- run analysis into the SAME row.
    return analyzeIntoReservedSlot(supabase, {
      projectUpdateId,
      projectId: input.projectId,
      userId: input.userId,
      body: input.body,
    });
  }

  // Exhaustive over the 7 known ProjectUpdateStatus values (4 resumable +
  // draft + 2 retryable). A future, unrecognized status must fail closed
  // rather than silently retrying or resuming a row this code does not
  // understand.
  return { ok: false, code: "UNEXPECTED", error: `Unrecognized project update status: ${status}` };
}

/**
 * Correction 3 -- structured unique-violation handling. Only ever
 * treated as "another request already reserved this source message" when
 * BOTH: the failure carries PostgreSQL error code 23505, AND the error
 * message names the exact constraint this algorithm arbitrates on
 * (project_updates_source_share_message_id_key) -- a 23505 on any other
 * constraint is propagated untouched, never silently reinterpreted.
 * Even then, winner re-selection is required before treating it as the
 * expected race: if no authoritative row can be found, the original
 * database failure is propagated rather than fabricating a result.
 */
async function handleReservationConflict(
  supabase: SupabaseClient,
  reservation: Extract<Awaited<ReturnType<typeof createProjectUpdateAuditRecord>>, { ok: false }>,
  input: { userId: string; sourceShareMessageId: string }
): Promise<ShareMessageConversionResult> {
  if (reservation.dbErrorCode !== "23505") {
    return { ok: false, code: "UNEXPECTED", error: reservation.error };
  }

  if (!reservation.error.includes(RESERVATION_UNIQUE_CONSTRAINT)) {
    return { ok: false, code: "UNEXPECTED", error: reservation.error };
  }

  const winner = await findExistingSlot(supabase, {
    sourceShareMessageId: input.sourceShareMessageId,
    userId: input.userId,
  });

  if (!winner) {
    return { ok: false, code: "UNEXPECTED", error: reservation.error };
  }

  const winnerStatus = String(winner.update.status ?? "");
  if (RESUMABLE_STATUSES.has(winnerStatus)) {
    return resumeSlot(supabase, winner, input.userId);
  }

  // draft / failed / ignored -- the winner's own attempt is either still
  // in flight or not yet re-claimed by a request that will run AI right
  // now. This loser must never run AI itself.
  return inProgressResult(String(winner.update.id));
}

async function reserveAndAnalyzeFreshSlot(
  supabase: SupabaseClient,
  input: { projectId: string; userId: string; sourceShareMessageId: string; body: string }
): Promise<ShareMessageConversionResult> {
  const reservation = await createProjectUpdateAuditRecord({
    projectId: input.projectId,
    rawInput: input.body,
    sourceType: "client_share",
    sourceShareMessageId: input.sourceShareMessageId,
    status: "draft",
  });

  if (!reservation.ok) {
    return handleReservationConflict(supabase, reservation, input);
  }

  // Sole owner of this brand-new reservation -- the ONLY request
  // permitted to run AI for this message right now.
  return analyzeIntoReservedSlot(supabase, {
    projectUpdateId: reservation.data.id,
    projectId: input.projectId,
    userId: input.userId,
    body: input.body,
  });
}

export async function convertShareMessageToClientUpdate(
  supabase: SupabaseClient,
  input: { shareLinkId: string; messageId: string; userId: string }
): Promise<ShareMessageConversionResult> {
  const sourceResult = await loadShareMessageForConversion(supabase, {
    messageId: input.messageId,
    shareLinkId: input.shareLinkId,
    userId: input.userId,
  });

  if (!sourceResult.ok) {
    const code = sourceResult.error.code;
    if (
      code === "SHARE_MESSAGE_NOT_FOUND" ||
      code === "SHARE_MESSAGE_NOT_CLIENT_AUTHORED" ||
      code === "SHARE_MESSAGE_PROJECT_NOT_FOUND"
    ) {
      return { ok: false, code, error: "This message is not eligible for conversion." };
    }
    return { ok: false, code: "UNEXPECTED", error: "Could not load this message." };
  }

  const { messageId, projectId, body } = sourceResult.data;

  const existing = await findExistingSlot(supabase, {
    sourceShareMessageId: messageId,
    userId: input.userId,
  });

  if (existing) {
    return handleExistingSlot(supabase, existing, { projectId, userId: input.userId, body });
  }

  // No existing slot -- reserve one BEFORE any AI call. The Phase 6A
  // partial unique index (project_updates_source_share_message_id_key)
  // is the sole arbiter of which concurrent reservation INSERT wins.
  return reserveAndAnalyzeFreshSlot(supabase, {
    projectId,
    userId: input.userId,
    sourceShareMessageId: messageId,
    body,
  });
}
