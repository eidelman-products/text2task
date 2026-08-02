import "server-only";

import { createHash } from "node:crypto";
import type { PostgrestError } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  validateProductEventInput,
  type ProductEventValidationFailureReason,
} from "@/lib/activity/product-event-contracts";

/*
  Server-only writer for public.authenticated_product_events (Phase 1:
  supabase/migrations/202608030001_authenticated_product_events.sql). This
  is the ONLY function anywhere in the codebase permitted to insert into
  that table -- see docs/TEXT2TASK_MINIMAL_AUTHENTICATED_ACTIVITY_MAPPING.md
  and docs/TEXT2TASK_AUTHENTICATED_ACTIVITY_PHASE2_IMPLEMENTATION_REPORT.md
  for the full design.

  Trust boundary: `userId` is a separate, trusted argument the caller must
  have already resolved from a real authenticated Supabase session (see
  app/api/activity/product-event/route.ts) -- this module never reads it
  from `event` or from any other untrusted input. `navigationId` and
  `event` are both still treated as fully untrusted here, independent of
  whatever validation an HTTP-layer caller may already have performed, so
  this function stays safe to call from any future trusted caller on its
  own. Every write funnels through validateProductEventInput() from
  lib/activity/product-event-contracts.ts (the single source of truth for
  event-name/route/entity validation), so this module never re-implements
  or diverges from that logic.

  This module mirrors lib/analytics/internal-events.server.ts's own
  established structure (timeout-raced insert, service-role client,
  duplicate-key detection via Postgres error code 23505, swallow-and-log
  rather than throw) applied to the new, separate table -- it never reads
  or writes public.analytics_events, public.projects, public.tasks, or any
  other product-domain table, and never calls either owner-report RPC.
*/

const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** navigationId is Supabase-auth-independent, but shares the same UUID shape. */
const NAVIGATION_ID_PATTERN = USER_ID_PATTERN;

const IDEMPOTENCY_KEY_HASH_ALGORITHM = "sha256";
const IDEMPOTENCY_KEY_HASH_DOMAIN =
  "text2task.authenticated_product_events.idempotency_key.v1";

/** Matches lib/analytics/internal-events.server.ts's own established value. */
const INSERT_TIMEOUT_MS = 1250;

export type LogProductEventInput = {
  /** Must already be a real, server-resolved authenticated user id. */
  userId: string;
  /** Untrusted -- validated as a UUID inside this function. */
  navigationId: unknown;
  /** Untrusted -- validated via validateProductEventInput inside this function. */
  event: unknown;
};

export type LogProductEventRejectedReason =
  | ProductEventValidationFailureReason
  | "invalid_user_id"
  | "invalid_navigation_id";

export type LogProductEventResult =
  | { readonly status: "recorded" }
  | { readonly status: "duplicate" }
  | {
      readonly status: "rejected";
      readonly reason: LogProductEventRejectedReason;
    }
  | { readonly status: "failed" };

function isUuidShaped(value: unknown): value is string {
  return typeof value === "string" && USER_ID_PATTERN.test(value);
}

function isNavigationIdShaped(value: unknown): value is string {
  return typeof value === "string" && NAVIGATION_ID_PATTERN.test(value);
}

/**
 * Deterministic per-logical-event dedupe key: the same
 * (userId, navigationId, eventName, route, entityType, entityId) tuple
 * always hashes to the same value, so a retried/duplicated delivery of the
 * exact same logical event collides on the Phase 1 unique partial index
 * (authenticated_product_events_idempotency_key_unique_idx) and is treated
 * as a safe duplicate rather than a second row -- while a different
 * navigationId (a genuinely later, deliberate view) always produces a
 * different key. Domain-separated, null-byte-joined hash chain, matching
 * this repository's own established pattern for deriving a safe
 * deterministic hash from several string inputs
 * (lib/homepage-demo/tokens.server.ts's hashHomepageDemoToken).
 */
export function computeProductEventIdempotencyKey(input: {
  userId: string;
  navigationId: string;
  eventName: string;
  route: string;
  entityType: string | null;
  entityId: string | null;
}): string {
  return createHash(IDEMPOTENCY_KEY_HASH_ALGORITHM)
    .update(IDEMPOTENCY_KEY_HASH_DOMAIN)
    .update("\0")
    .update(input.userId)
    .update("\0")
    .update(input.navigationId)
    .update("\0")
    .update(input.eventName)
    .update("\0")
    .update(input.route)
    .update("\0")
    .update(input.entityType ?? "")
    .update("\0")
    .update(input.entityId ?? "")
    .digest("hex");
}

function isDuplicateIdempotencyKeyError(
  error: { code?: string } | null | undefined
): boolean {
  return error?.code === "23505";
}

type InsertOutcome =
  | { status: "completed"; error: PostgrestError | null }
  | { status: "failed" }
  | { status: "timed_out" };

async function insertProductEventRowWithTimeout(
  row: Record<string, unknown>
): Promise<InsertOutcome> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const insertPromise = (async (): Promise<InsertOutcome> => {
    try {
      const { error } = await supabaseAdmin
        .from("authenticated_product_events")
        .insert(row);

      return { status: "completed", error };
    } catch {
      return { status: "failed" };
    }
  })();

  const timeoutPromise = new Promise<InsertOutcome>((resolve) => {
    timeoutId = setTimeout(
      () => resolve({ status: "timed_out" }),
      INSERT_TIMEOUT_MS
    );
  });

  const result = await Promise.race([insertPromise, timeoutPromise]);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  return result;
}

/**
 * Validates and records one authenticated product-view event. Never
 * throws -- every expected failure mode (invalid input, a duplicate
 * delivery, a database error, a timeout, an unexpected exception) resolves
 * to a typed result instead, so a caller can always safely ignore the
 * outcome without risking an unhandled rejection reaching product code.
 *
 * Safe to log: event name, route, entity type, a per-call correlation id,
 * and (on a genuine database failure) the Postgres error code. Never logs
 * the request body, `userId`, `navigationId`, or `entityId` -- none of
 * those are needed to debug a stuck/failing insert, and logging them would
 * be pure downside for no diagnostic benefit.
 */
export async function logProductEventSafe(
  input: LogProductEventInput
): Promise<LogProductEventResult> {
  const correlationId = crypto.randomUUID();

  try {
    if (!isUuidShaped(input.userId)) {
      return { status: "rejected", reason: "invalid_user_id" };
    }

    if (!isNavigationIdShaped(input.navigationId)) {
      return { status: "rejected", reason: "invalid_navigation_id" };
    }

    const validation = validateProductEventInput(input.event);

    if (!validation.ok) {
      return { status: "rejected", reason: validation.reason };
    }

    const { eventName, route, entityType, entityId } = validation.event;

    const idempotencyKey = computeProductEventIdempotencyKey({
      userId: input.userId,
      navigationId: input.navigationId,
      eventName,
      route,
      entityType,
      entityId,
    });

    const outcome = await insertProductEventRowWithTimeout({
      user_id: input.userId,
      event_name: eventName,
      route,
      entity_type: entityType,
      entity_id: entityId,
      idempotency_key: idempotencyKey,
    });

    if (outcome.status === "timed_out") {
      console.warn("Authenticated product event insert timed out:", {
        correlationId,
        eventName,
        route,
        entityType,
      });

      return { status: "failed" };
    }

    if (outcome.status === "failed") {
      console.warn("Authenticated product event insert failed:", {
        correlationId,
        eventName,
        route,
        entityType,
      });

      return { status: "failed" };
    }

    if (outcome.error) {
      if (isDuplicateIdempotencyKeyError(outcome.error)) {
        return { status: "duplicate" };
      }

      console.warn("Authenticated product event insert failed:", {
        correlationId,
        eventName,
        route,
        entityType,
        code: outcome.error.code,
      });

      return { status: "failed" };
    }

    return { status: "recorded" };
  } catch (error) {
    // A genuinely unexpected (programmer) error -- logged loudly (not
    // swallowed silently) with a correlation id for debugging, but still
    // never re-thrown: a tracking-endpoint failure must never propagate
    // into product code.
    console.error(
      "Authenticated product event logging failed unexpectedly:",
      {
        correlationId,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    );

    return { status: "failed" };
  }
}
