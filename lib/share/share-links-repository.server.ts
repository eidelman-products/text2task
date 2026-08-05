import "server-only";

import {
  canonicalizeUuid,
  shareLinkManagementStateDataSchema,
  shareLinkSummaryDataSchema,
  type ShareLinkManagementStateData,
  type ShareLinkSummaryData,
} from "@/lib/share/share-contracts";

/**
 * Minimal structural shape of the Supabase RPC call this repository
 * actually uses, matching the established pattern in
 * lib/calendar/calendar-events-repository.server.ts: this repo's real
 * Supabase client has no `Database` schema generic, so comparing it
 * directly against a declared interface can overflow TypeScript's
 * structural-assignability depth limit. Every exported function below
 * therefore accepts `supabase` through an unconstrained generic parameter
 * and narrows it with one `as` assertion at the point of use.
 *
 * The error shape is deliberately narrow (code + message only) rather than
 * the full PostgrestError -- this repository never reads or forwards
 * `details`/`hint`, and never returns a raw database error to a caller.
 */
type ShareLinksRpcError = {
  code?: string | null;
  message: string;
};

type ShareLinksRpcResult = {
  data: unknown;
  error: ShareLinksRpcError | null;
};

export type ShareLinksSupabaseLikeClient = {
  rpc: (
    fn: string,
    params: Record<string, unknown>
  ) => PromiseLike<ShareLinksRpcResult>;
};

// Centralized, exact RPC names and parameter names -- the only two
// database entry points this repository (and therefore any Phase 1B.1
// route) is permitted to call.
const GET_SHARE_LINK_MANAGEMENT_STATE_RPC = "get_share_link_management_state";
const LIST_SHARE_LINK_SUMMARIES_RPC = "list_share_link_summaries";

const RPC_ERROR_CODE = "P0001";

export type ShareLinksRepositoryErrorCode =
  | "UNAUTHORIZED"
  | "PROJECT_NOT_FOUND"
  | "UNEXPECTED";

export interface ShareLinksRepositoryError {
  code: ShareLinksRepositoryErrorCode;
}

export type ShareLinksRepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ShareLinksRepositoryError };

/**
 * Maps an RPC error by its exact `code` (the Postgres SQLSTATE PostgREST
 * reports for a raised exception) and exact `message` -- never by
 * substring matching, so an error message that happens to *contain* one
 * of these words in a longer sentence is never misclassified.
 */
function mapRpcError(error: ShareLinksRpcError): ShareLinksRepositoryError {
  if (error.code === RPC_ERROR_CODE && error.message === "UNAUTHORIZED") {
    return { code: "UNAUTHORIZED" };
  }
  if (error.code === RPC_ERROR_CODE && error.message === "PROJECT_NOT_FOUND") {
    return { code: "PROJECT_NOT_FOUND" };
  }
  return { code: "UNEXPECTED" };
}

/**
 * Reads the single V1-managed share link for one owned project, via
 * public.get_share_link_management_state. Never performs a direct table
 * SELECT and never uses the service-role admin client -- ownership is
 * enforced entirely by the RPC (auth.uid() plus RLS) on the RLS-bound
 * client passed in.
 *
 * `projectId` is canonicalized to lowercase here defensively -- the
 * route already does this via shareLinkManagementStateQuerySchema, but
 * this function must behave correctly even when called directly with an
 * uncanonicalized id, since Postgres's own uuid::text output is always
 * lowercase and this repository must never send it something a caller
 * merely *assumed* was already canonical.
 */
export async function getShareLinkManagementState<Client>(
  supabase: Client,
  projectId: string
): Promise<ShareLinksRepositoryResult<ShareLinkManagementStateData>> {
  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(GET_SHARE_LINK_MANAGEMENT_STATE_RPC, {
    p_project_id: canonicalizeUuid(projectId),
  });

  if (error) {
    return { ok: false, error: mapRpcError(error) };
  }

  const parsed = shareLinkManagementStateDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Confirms the RPC's parsed summary object covers exactly (no more, no
 * fewer than) the requested project ids, and that every entry's own key
 * equals its `projectId`. The Zod contract already enforces the
 * key === projectId invariant per record; this adds the
 * requested-vs-received set comparison the contract cannot know on its
 * own, so a malformed or tampered RPC result fails closed rather than
 * silently exposing an unrequested project or hiding a requested one.
 *
 * `requestedProjectIds` must already be canonical lowercase (see
 * `listShareLinkSummaries` below) -- Postgres's returned keys are always
 * canonical lowercase, so comparing against an uncanonicalized requested
 * id (e.g. one supplied in uppercase) would otherwise produce a false
 * mismatch even though it is the same UUID.
 */
function isExactRequestedProjectSet(
  requestedProjectIds: string[],
  data: ShareLinkSummaryData
): boolean {
  const requested = new Set(requestedProjectIds);
  const receivedKeys = Object.keys(data);

  if (receivedKeys.length !== requested.size) {
    return false;
  }

  for (const key of receivedKeys) {
    if (!requested.has(key)) {
      return false;
    }
  }

  for (const [key, entry] of Object.entries(data)) {
    if (entry.projectId !== key) {
      return false;
    }
  }

  return true;
}

/**
 * Reads one share-link summary per requested project, via
 * public.list_share_link_summaries. Rejects the whole call
 * (PROJECT_NOT_FOUND) rather than returning partial cross-tenant results,
 * mirroring the RPC's own fail-closed behavior, and fails closed
 * (UNEXPECTED) if the parsed result does not cover exactly the requested
 * project id set.
 *
 * `projectIds` is canonicalized to lowercase here defensively -- the
 * route already does this via shareLinkSummaryQuerySchema, but this
 * function must behave correctly even when called directly with
 * uncanonicalized ids: both the RPC call and the exact-set comparison
 * against Postgres's (always-lowercase) returned keys use the
 * canonicalized ids, never the caller's original casing.
 */
export async function listShareLinkSummaries<Client>(
  supabase: Client,
  projectIds: string[]
): Promise<ShareLinksRepositoryResult<ShareLinkSummaryData>> {
  const canonicalProjectIds = projectIds.map(canonicalizeUuid);

  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(LIST_SHARE_LINK_SUMMARIES_RPC, {
    p_project_ids: canonicalProjectIds,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error) };
  }

  const parsed = shareLinkSummaryDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  if (!isExactRequestedProjectSet(canonicalProjectIds, parsed.data)) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}
