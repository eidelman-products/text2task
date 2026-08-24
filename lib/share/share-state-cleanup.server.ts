import "server-only";

import { after } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Phase 7B -- lazy, bounded, best-effort cleanup of naturally-expired
 * Client Share ephemeral security state: public.share_rate_limit_buckets,
 * public.share_session_grants, public.share_browser_sessions.
 *
 * Deliberately does NOT touch public.share_link_events -- that table's
 * own retention policy is a separate, still-open product decision (see
 * the original master handoff's "Product decisions still open or
 * deferred" section), not something this cleanup slice should decide by
 * side effect.
 *
 * Design constraints, all load-bearing:
 * - Only ever deletes rows whose own `expires_at` is safely in the past
 *   (CLEANUP_GRACE_PERIOD_SECONDS beyond expiry) -- never based on
 *   `revoked_at` alone. A revoked-but-not-yet-expired row is deliberately
 *   retained, matching this schema's own column comments ("Retained
 *   rather than deleted so revocation stays auditable"). Because a
 *   grant's own expires_at can never exceed its parent session's
 *   expires_at (enforced by enforce_share_session_grant_integrity), an
 *   expired session's remaining grants are always themselves expired too
 *   -- so sweeping sessions by expires_at alone can never orphan a still-
 *   valid grant.
 * - Bounded per call (a capped SELECT feeding a targeted DELETE ... IN
 *   (...)), so one invocation can never become a slow, lock-heavy
 *   operation, and can never grow unbounded even under a large backlog.
 * - No cron/scheduled infrastructure: triggered probabilistically from
 *   an existing request path (session exchange, the route that already
 *   creates new sessions/grants) and scheduled via next/server's after()
 *   -- the same, already-established pattern this repository already
 *   uses elsewhere (app/api/activity/dashboard-visit/route.ts,
 *   lib/analytics/signup-attribution.server.ts) for "run after the
 *   response is sent, never block or fail the response." Every failure
 *   mode is caught and logged, never thrown -- the triggering request's
 *   own success never depends on cleanup succeeding.
 * - Uses the existing supabaseAdmin (service_role) client only, against
 *   grants service_role already holds (select/insert/update/delete on
 *   all three tables, granted in 202608030005) -- no privilege is
 *   broadened, no new grant is required.
 */

const CLEANUP_TRIGGER_PROBABILITY = 0.02; // ~1 in 50 session-exchange calls
const CLEANUP_GRACE_PERIOD_SECONDS = 24 * 60 * 60; // 1 day past expires_at
const CLEANUP_BATCH_LIMIT = 200;

type CleanupTable =
  | "share_rate_limit_buckets"
  | "share_session_grants"
  | "share_browser_sessions";

/** Order matters only for intentionality, not correctness: rate-limit
 * buckets have no FK relationship to sessions/grants; grants are swept
 * before their parent sessions (though the sessions' own ON DELETE
 * CASCADE would clean up any remaining ones regardless). */
const CLEANUP_TABLES: readonly CleanupTable[] = [
  "share_rate_limit_buckets",
  "share_session_grants",
  "share_browser_sessions",
];

function logCleanupWarning(stage: string, detail: unknown): void {
  console.warn("share_state_cleanup_failed", {
    stage,
    message: detail instanceof Error ? detail.message : String(detail),
  });
}

async function cleanupExpiredRowsForTable(table: CleanupTable): Promise<void> {
  try {
    const cutoffIso = new Date(Date.now() - CLEANUP_GRACE_PERIOD_SECONDS * 1000).toISOString();

    const { data: staleRows, error: selectError } = await supabaseAdmin
      .from(table)
      .select("id")
      .lt("expires_at", cutoffIso)
      .limit(CLEANUP_BATCH_LIMIT);

    if (selectError) {
      logCleanupWarning(`${table}.select`, selectError);
      return;
    }

    if (!staleRows || staleRows.length === 0) {
      return;
    }

    const ids = (staleRows as ReadonlyArray<{ id: string }>).map((row) => row.id);

    const { error: deleteError } = await supabaseAdmin.from(table).delete().in("id", ids);

    if (deleteError) {
      logCleanupWarning(`${table}.delete`, deleteError);
    }
  } catch (error) {
    logCleanupWarning(table, error);
  }
}

async function cleanupExpiredShareState(): Promise<void> {
  for (const table of CLEANUP_TABLES) {
    // Sequential, not Promise.all: keeps each table's bounded batch fully
    // independent and avoids issuing several concurrent DELETEs from one
    // background invocation for no real benefit (this runs well after the
    // triggering request's own response has already been sent).
    await cleanupExpiredRowsForTable(table);
  }
}

/**
 * Probabilistically schedules a bounded, best-effort cleanup pass to run
 * after the current response has been sent. Safe to call unconditionally
 * from any public route -- most calls are a no-op (the random draw
 * misses), and the ones that aren't never affect the caller's own
 * response in any way, including on failure.
 */
export function maybeScheduleShareStateCleanup(): void {
  if (Math.random() >= CLEANUP_TRIGGER_PROBABILITY) {
    return;
  }

  try {
    after(async () => {
      await cleanupExpiredShareState();
    });
  } catch (error) {
    logCleanupWarning("schedule", error);
  }
}
