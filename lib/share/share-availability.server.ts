import "server-only";

/**
 * Neutral, server-side Client Share availability gate. Modeled on
 * lib/homepage-demo/config.server.ts's parseEnabledFlag +
 * assertHomepageDemoPublicExtractEnabled: only the literal string "true"
 * enables the feature (unset, empty, or any other value stays disabled),
 * and every app/api/share-links/** route must call
 * assertClientShareEnabled() before doing any Supabase/RPC work so a
 * disabled feature fails closed to a generic not-found response instead
 * of leaking a raw "function does not exist" Postgres error against a
 * Production database that does not yet have the Client Share schema.
 *
 * Deliberately reads process.env at call time rather than freezing a
 * config object at module load -- this has no user-facing effect, it only
 * keeps the gate trivially testable with per-test env stubbing. This gate
 * is independent of any Free/Pro plan decision: it is a single on/off
 * availability switch, not an entitlement system.
 */
export class ShareAvailabilityError extends Error {
  constructor() {
    super("Client Share is not currently available.");
    this.name = "ShareAvailabilityError";
  }
}

export function isShareAvailabilityError(
  error: unknown
): error is ShareAvailabilityError {
  return error instanceof ShareAvailabilityError;
}

function parseEnabledFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function isClientShareEnabled(): boolean {
  return parseEnabledFlag(process.env.TEXT2TASK_CLIENT_SHARE_ENABLED);
}

/** Throws ShareAvailabilityError when the feature is disabled. Callers
 * must invoke this before any Supabase client creation, RPC call, or body
 * parsing in every app/api/share-links/** route. */
export function assertClientShareEnabled(): void {
  if (!isClientShareEnabled()) {
    throw new ShareAvailabilityError();
  }
}
