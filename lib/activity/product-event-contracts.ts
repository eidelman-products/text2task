import { z } from "zod";

import { parseDateOnly } from "@/lib/tasks/date-only";

/*
  Shared, framework-independent event contracts for the minimal
  authenticated-activity ("viewed this product surface") tracking layer --
  see docs/TEXT2TASK_MINIMAL_AUTHENTICATED_ACTIVITY_MAPPING.md sections 10
  and 11 for the full architecture this module implements.

  This module never imports Supabase, "server-only", or any Next.js API --
  it is meant to be shared, unmodified, between future client-side
  instrumentation code (building an event payload) and the future
  server-side tracking route (validating one before insert). The single
  public entry point, `validateProductEventInput`, accepts `unknown` and
  returns a fully-typed result with no unsafe casts anywhere in this file
  (Zod's `safeParse` narrows `unknown` to a known shape without one).

  Deliberately NOT included in the public input contract, at all, ever:
  user_id (always resolved server-side from the authenticated session --
  see the migration comment on authenticated_product_events.user_id),
  created_at (server clock only), idempotency_key (server-computed only),
  metadata, or any other free-form field. `RawProductEventInputSchema` is
  `.strict()`, so a payload containing any of those (or any other unknown
  key) fails validation outright rather than having the extra field
  silently ignored -- this makes it structurally difficult for later
  instrumentation code to smuggle anything beyond exactly what this module
  allows.
*/

export const PRODUCT_EVENT_NAMES = [
  "dashboard_viewed",
  "extract_viewed",
  "tasks_viewed",
  "calendar_viewed",
  "project_details_expanded",
  "project_resources_viewed",
  "project_history_viewed",
  "client_update_opened",
  "calendar_day_viewed",
  "calendar_event_viewed",
] as const;

/*
  `authenticated_app_opened` is intentionally not included -- see the
  mapping document section 11. Every authenticated session necessarily
  produces one of the events above as its first row (a user cannot reach
  any tracked surface without first rendering /dashboard or
  /dashboard/calendar, both of which are tracked events on their own), so
  a synthetic "session started" wrapper event would add one extra write
  per visit with no additional analytical value: "did the user return" and
  "what was their most recent activity" are both already answerable from
  the first/latest row of the events below.
*/

export const ProductEventNameSchema = z.enum(PRODUCT_EVENT_NAMES);
export type ProductEventName = z.infer<typeof ProductEventNameSchema>;

export const PRODUCT_ENTITY_TYPES = [
  "project",
  "calendar_event",
  "calendar_day",
] as const;

export const ProductEntityTypeSchema = z.enum(PRODUCT_ENTITY_TYPES);
export type ProductEntityType = z.infer<typeof ProductEntityTypeSchema>;

/**
 * The single source of truth for "does this event carry an entity, and
 * which kind." Typed as `Record<ProductEventName, ...>` so TypeScript
 * itself enforces exhaustiveness -- adding a new name to
 * `PRODUCT_EVENT_NAMES` without adding a corresponding entry here is a
 * compile error, and there is no way to add an entry for a name that
 * isn't in `PRODUCT_EVENT_NAMES` either.
 */
export const PRODUCT_EVENT_ENTITY_TYPE: Readonly<
  Record<ProductEventName, ProductEntityType | null>
> = {
  dashboard_viewed: null,
  extract_viewed: null,
  tasks_viewed: null,
  calendar_viewed: null,
  project_details_expanded: "project",
  project_resources_viewed: "project",
  project_history_viewed: "project",
  client_update_opened: "project",
  calendar_day_viewed: "calendar_day",
  calendar_event_viewed: "calendar_event",
};

const MAX_ROUTE_LENGTH = 300;
/**
 * A generous sanity cap applied to the RAW route string, before any
 * stripping. This exists only to reject truly pathological (multi-KB+)
 * input outright -- it must stay well above any realistic query string a
 * real page could produce, so a short, legitimate pathname followed by an
 * incidentally large query string is never rejected merely because of the
 * query string's own length (that string is discarded below anyway; only
 * the final, stripped pathname is checked against `MAX_ROUTE_LENGTH`).
 */
const MAX_RAW_ROUTE_LENGTH = 10_000;
const MAX_ENTITY_ID_LENGTH = 64;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Normalizes a route to a safe, storable internal pathname, or returns
 * `null` if it isn't one. Rejects anything that isn't a same-origin
 * pathname (no `http(s)://`, no protocol-relative `//host/...`), strips
 * any query string and hash fragment (their content is never demonstrated
 * to be needed by this feature and dropping them removes an entire class
 * of accidental-sensitive-data risk), and enforces the final length cap on
 * the stripped result -- so a short real pathname followed by an
 * incidentally huge query string is not rejected, but a genuinely oversized
 * pathname is.
 */
function normalizeProductEventRoute(rawRoute: string): string | null {
  if (rawRoute.length > MAX_RAW_ROUTE_LENGTH) {
    return null;
  }

  const trimmed = rawRoute.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  const withoutHash = trimmed.split("#")[0] ?? "";
  const withoutQuery = withoutHash.split("?")[0] ?? "";

  if (!withoutQuery.startsWith("/") || withoutQuery.length > MAX_ROUTE_LENGTH) {
    return null;
  }

  return withoutQuery;
}

function isValidEntityIdForType(
  entityType: ProductEntityType,
  entityId: string
): boolean {
  if (entityId.length > MAX_ENTITY_ID_LENGTH) {
    return false;
  }

  if (entityType === "calendar_day") {
    return parseDateOnly(entityId) !== null;
  }

  // "project" and "calendar_event" both use a real database UUID.
  return UUID_PATTERN.test(entityId);
}

/**
 * The raw, untrusted shape this module accepts before route/entity
 * normalization. `.strict()` rejects any payload containing an unknown key
 * (including, but not limited to, `userId`, `createdAt`, `idempotencyKey`,
 * or `metadata`) outright, rather than silently dropping it.
 */
const RawProductEventInputSchema = z
  .object({
    eventName: ProductEventNameSchema,
    route: z.string().min(1),
    entityType: ProductEntityTypeSchema.nullable().optional(),
    entityId: z.string().max(MAX_ENTITY_ID_LENGTH).nullable().optional(),
  })
  .strict();

export type ValidatedProductEvent = Readonly<{
  eventName: ProductEventName;
  route: string;
  entityType: ProductEntityType | null;
  entityId: string | null;
}>;

/**
 * Short, machine-readable rejection reasons -- intentionally not an error
 * message shown to any user; safe to log server-side for debugging.
 */
export type ProductEventValidationFailureReason =
  | "invalid_shape"
  | "invalid_route"
  | "unexpected_entity"
  | "entity_type_mismatch"
  | "missing_entity_id"
  | "invalid_entity_id";

export type ProductEventValidationResult =
  | { readonly ok: true; readonly event: ValidatedProductEvent }
  | { readonly ok: false; readonly reason: ProductEventValidationFailureReason };

/**
 * The single validation entry point for this feature. Accepts `unknown`
 * (an already-JSON-parsed request body, or any other untrusted value) and
 * either returns a fully validated, minimal `ValidatedProductEvent` or a
 * typed rejection reason -- never throws, never returns a partially-valid
 * result, never includes a `user_id` (which does not exist anywhere in the
 * input contract and must instead be resolved server-side from the
 * authenticated session by the caller).
 */
export function validateProductEventInput(
  input: unknown
): ProductEventValidationResult {
  const parsed = RawProductEventInputSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid_shape" };
  }

  const { eventName, route: rawRoute, entityType, entityId } = parsed.data;

  const route = normalizeProductEventRoute(rawRoute);
  if (route === null) {
    return { ok: false, reason: "invalid_route" };
  }

  const requiredEntityType = PRODUCT_EVENT_ENTITY_TYPE[eventName];
  const suppliedEntityType = entityType ?? null;
  const suppliedEntityId = entityId ?? null;

  if (requiredEntityType === null) {
    // This event never carries an entity. A caller supplying one anyway is
    // rejected outright rather than having the value silently stripped, so
    // a caller-side bug (sending an entity where none belongs) is always
    // surfaced immediately instead of quietly disappearing.
    if (suppliedEntityType !== null || suppliedEntityId !== null) {
      return { ok: false, reason: "unexpected_entity" };
    }

    return {
      ok: true,
      event: { eventName, route, entityType: null, entityId: null },
    };
  }

  if (suppliedEntityType !== requiredEntityType) {
    return { ok: false, reason: "entity_type_mismatch" };
  }

  if (suppliedEntityId === null) {
    return { ok: false, reason: "missing_entity_id" };
  }

  const trimmedEntityId = suppliedEntityId.trim();

  if (!isValidEntityIdForType(requiredEntityType, trimmedEntityId)) {
    return { ok: false, reason: "invalid_entity_id" };
  }

  return {
    ok: true,
    event: {
      eventName,
      route,
      entityType: requiredEntityType,
      entityId: trimmedEntityId,
    },
  };
}
