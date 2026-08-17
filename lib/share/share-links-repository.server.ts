import "server-only";

import {
  activateShareLinkDataSchema,
  activateShareLinkRpcDataSchema,
  canonicalizeUuid,
  clearSharePinDataSchema,
  clearShareLinkExpiryDataSchema,
  createShareLinkDraftDataSchema,
  disableShareLinkDataSchema,
  reenableShareLinkDataSchema,
  revealShareLinkSecretDataSchema,
  revealShareLinkSecretRpcDataSchema,
  revokeShareLinkDataSchema,
  rotateShareLinkSecretDataSchema,
  rotateShareLinkSecretRpcDataSchema,
  saveShareConfigurationDataSchema,
  setSharePinDataSchema,
  setShareLinkExpiryDataSchema,
  shareLinkManagementStateDataSchema,
  shareLinkSummaryDataSchema,
  type ActivateShareLinkData,
  type ClearSharePinData,
  type ClearShareLinkExpiryData,
  type CreateShareLinkDraftData,
  type DisableShareLinkData,
  type ReenableShareLinkData,
  type RevealShareLinkSecretData,
  type RevokeShareLinkData,
  type RotateShareLinkSecretData,
  type SaveShareConfigurationData,
  type SaveShareConfigurationRequest,
  type SetSharePinData,
  type SetShareLinkExpiryData,
  type ShareLinkManagementStateData,
  type ShareLinkSummaryData,
} from "@/lib/share/share-contracts";
import { generateSharePublicId } from "@/lib/share/share-public-id.server";
import { hashSharePin } from "@/lib/share/share-pin.server";
import {
  createShareSecretDigest,
  generateRawShareSecret,
  isShareSecretError,
  SHARE_SECRET_DIGEST_VERSION,
} from "@/lib/share/share-secret.server";
import {
  decryptShareSecret,
  encryptShareSecret,
  isShareSecretEncryptionError,
} from "@/lib/share/share-secret-encryption.server";

/**
 * Real browser defect #3 investigation: activateShareLink/
 * rotateShareLinkSecret both generate and encrypt a fresh secret BEFORE
 * calling their RPC, and both previously discarded any failure from that
 * step with a bare `catch { return UNEXPECTED }` -- meaning a missing or
 * malformed TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1/
 * TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1 environment variable on a
 * given deployment (a real, plausible, and byte-for-byte-reproducing
 * explanation for the reported "activate returns 500 with only
 * 'Failed to activate the share link.'" symptom -- config succeeds
 * because save_share_configuration never touches secret material at
 * all) was completely invisible in every log. This helper logs ONLY a
 * fixed operation tag and, when the error is one of the two typed
 * secret-material error classes, its own safe enum `.code` (e.g.
 * "encryption_key_missing") -- never the key, never the raw secret,
 * never the digest/ciphertext. The HTTP response and owner-facing
 * message are completely unchanged by this -- both still return
 * `UNEXPECTED` -> INTERNAL_ERROR -> the existing generic fallback text;
 * this only makes the cause visible in Vercel's own function logs.
 */
function logSecretMaterialFailure(operation: string, error: unknown): void {
  if (isShareSecretError(error) || isShareSecretEncryptionError(error)) {
    console.error("share_links_secret_material_failure", {
      operation,
      reason: error.code,
    });
    return;
  }

  console.error("share_links_secret_material_failure", {
    operation,
    reason: "unexpected_error",
    category: error instanceof Error ? "Error" : "UnknownThrownValue",
  });
}

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

// Centralized, exact RPC names and parameter names -- the only database
// entry points this repository (and therefore any Phase 1B route) is
// permitted to call.
const GET_SHARE_LINK_MANAGEMENT_STATE_RPC = "get_share_link_management_state";
const LIST_SHARE_LINK_SUMMARIES_RPC = "list_share_link_summaries";
const CREATE_SHARE_LINK_DRAFT_RPC = "create_share_link_draft";
const ACTIVATE_SHARE_LINK_RPC = "activate_share_link";
const DISABLE_SHARE_LINK_RPC = "disable_share_link";
const REENABLE_SHARE_LINK_RPC = "reenable_share_link";
const SET_SHARE_LINK_PIN_RPC = "set_share_link_pin";
const CLEAR_SHARE_LINK_PIN_RPC = "clear_share_link_pin";
const SET_SHARE_LINK_EXPIRY_RPC = "set_share_link_expiry";
const CLEAR_SHARE_LINK_EXPIRY_RPC = "clear_share_link_expiry";
const ROTATE_SHARE_LINK_SECRET_RPC = "rotate_share_link_secret";
const REVOKE_SHARE_LINK_RPC = "revoke_share_link";
const REVEAL_SHARE_LINK_SECRET_RPC = "reveal_share_link_secret";
const SAVE_SHARE_CONFIGURATION_RPC = "save_share_configuration";

const RPC_ERROR_CODE = "P0001";

export type ShareLinksRepositoryErrorCode =
  | "UNAUTHORIZED"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_ARCHIVED"
  | "SHARE_LINK_NOT_FOUND"
  | "SHARE_LINK_STATE_CONFLICT"
  | "SHARE_LINK_ANOTHER_LINK_ACTIVE"
  | "SHARE_LINK_SECRET_UNAVAILABLE"
  | "INVALID_REQUEST"
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
 * Maps a lifecycle RPC (create/activate/disable/reenable) error by exact
 * code and exact message, never substring matching. Every wrong-state
 * message (SHARE_LINK_NOT_DRAFT / SHARE_LINK_NOT_ACTIVE /
 * SHARE_LINK_NOT_DISABLED) collapses into the single
 * SHARE_LINK_STATE_CONFLICT repository/public category, per the exact
 * SQL message still being checked individually below --
 * SHARE_LINK_ANOTHER_LINK_ACTIVE and every other stable code keep their
 * own distinct category. PUBLIC_ID_COLLISION is deliberately absent here:
 * createShareLinkDraft handles it itself, before ever reaching this
 * function, as a retry signal rather than a caller-visible error.
 */
function mapLifecycleRpcError(error: ShareLinksRpcError): ShareLinksRepositoryError {
  if (error.code !== RPC_ERROR_CODE) {
    return { code: "UNEXPECTED" };
  }

  switch (error.message) {
    case "UNAUTHORIZED":
      return { code: "UNAUTHORIZED" };
    case "PROJECT_NOT_FOUND":
      return { code: "PROJECT_NOT_FOUND" };
    case "PROJECT_ARCHIVED":
      return { code: "PROJECT_ARCHIVED" };
    case "SHARE_LINK_NOT_FOUND":
      return { code: "SHARE_LINK_NOT_FOUND" };
    case "SHARE_LINK_NOT_DRAFT":
    case "SHARE_LINK_NOT_ACTIVE":
    case "SHARE_LINK_NOT_DISABLED":
      return { code: "SHARE_LINK_STATE_CONFLICT" };
    case "SHARE_LINK_ANOTHER_LINK_ACTIVE":
      return { code: "SHARE_LINK_ANOTHER_LINK_ACTIVE" };
    default:
      // Includes INVALID_PUBLIC_ID, INVALID_SECRET_DIGEST(_VERSION),
      // INVALID_CIPHERTEXT, INVALID_NONCE, INVALID_AUTH_TAG,
      // INVALID_ENCRYPTION_VERSION and SHARE_LINK_SECRET_MATERIAL_MISSING
      // -- every one of these indicates a repository-side bug (the
      // repository itself is responsible for well-formed RPC arguments),
      // never a condition an owner caused, so all fail closed as
      // UNEXPECTED rather than exposing an internal validation code.
      return { code: "UNEXPECTED" };
  }
}

/**
 * Maps a Phase 1B.3 access-operation RPC (PIN/expiry/rotate/revoke/
 * reveal) error by exact code and exact message, never substring
 * matching. Deliberately separate from mapLifecycleRpcError above: that
 * mapper's SHARE_LINK_SECRET_MATERIAL_MISSING handling (falling through
 * to UNEXPECTED, exercised by app/api/share-links/[id]/enable/route.test.ts)
 * must not change, so this phase's own distinct
 * SHARE_LINK_SECRET_UNAVAILABLE category is introduced only here, not by
 * touching the existing function. SHARE_LINK_REVOKED (an access-operation
 * -specific message no Phase 1B.2 RPC raises) collapses into the same
 * SHARE_LINK_STATE_CONFLICT public category as every other wrong-state
 * condition.
 */
function mapAccessOperationRpcError(
  error: ShareLinksRpcError
): ShareLinksRepositoryError {
  if (error.code !== RPC_ERROR_CODE) {
    return { code: "UNEXPECTED" };
  }

  switch (error.message) {
    case "UNAUTHORIZED":
      return { code: "UNAUTHORIZED" };
    case "SHARE_LINK_NOT_FOUND":
      return { code: "SHARE_LINK_NOT_FOUND" };
    case "SHARE_LINK_REVOKED":
    case "SHARE_LINK_STATE_CONFLICT":
      return { code: "SHARE_LINK_STATE_CONFLICT" };
    case "SHARE_LINK_SECRET_MATERIAL_MISSING":
      return { code: "SHARE_LINK_SECRET_UNAVAILABLE" };
    case "INVALID_EXPIRY":
      // The database performs the authoritative future-time check (the
      // owner-supplied timestamp can become non-future between request
      // parsing and transaction execution, so this can never be fully
      // replaced by a route-side clock comparison). This is owner-caused
      // invalid input, not an internal failure, so it maps to the public
      // INVALID_REQUEST category rather than UNEXPECTED -- unlike every
      // other internal-validation message below, whose exact SQL message
      // is never exposed to a caller.
      return { code: "INVALID_REQUEST" };
    default:
      // Includes INVALID_PIN_MATERIAL, INVALID_SECRET_DIGEST(_VERSION),
      // INVALID_CIPHERTEXT, INVALID_NONCE, INVALID_AUTH_TAG and
      // INVALID_ENCRYPTION_VERSION -- every one of these indicates a
      // repository-side bug (the repository itself is responsible for
      // well-formed RPC arguments), never a condition an owner caused, so
      // all fail closed as UNEXPECTED rather than exposing an internal
      // validation code.
      return { code: "UNEXPECTED" };
  }
}

/**
 * Maps public.save_share_configuration's error by exact code and exact
 * message, never substring matching. Deliberately its own mapper, not a
 * branch bolted onto mapAccessOperationRpcError above: this RPC's error
 * vocabulary (INVALID_SETTINGS/TASKS/RESOURCES/PUBLISH_UPDATE/
 * CONFIGURATION, plus the cross-tenant trigger codes) belongs to no
 * other RPC, and every existing mapper's established behavior must stay
 * untouched. PROJECT_ARCHIVED and INVALID_REQUEST already exist as
 * repository/public categories from earlier phases, so this operation
 * introduces no new category at all.
 */
function mapSaveConfigurationRpcError(
  error: ShareLinksRpcError
): ShareLinksRepositoryError {
  if (error.code !== RPC_ERROR_CODE) {
    return { code: "UNEXPECTED" };
  }

  switch (error.message) {
    case "UNAUTHORIZED":
      return { code: "UNAUTHORIZED" };
    case "SHARE_LINK_NOT_FOUND":
      return { code: "SHARE_LINK_NOT_FOUND" };
    case "PROJECT_ARCHIVED":
      return { code: "PROJECT_ARCHIVED" };
    case "SHARE_LINK_REVOKED":
      return { code: "SHARE_LINK_STATE_CONFLICT" };
    case "INVALID_CONFIGURATION":
    case "INVALID_SETTINGS":
    case "INVALID_TASKS":
    case "INVALID_RESOURCES":
    case "INVALID_PUBLISH_UPDATE":
      return { code: "INVALID_REQUEST" };
    // The exact cross-owner/cross-project codes
    // enforce_share_link_task_integrity / enforce_share_link_resource_
    // integrity (202608030005) raise. This RPC's own prevalidation is
    // designed to make these unreachable in practice, but if the
    // unconditional trigger ever fires anyway (its own independent
    // second line of defense), the failure is still owner-caused invalid
    // input, not a repository bug -- mapped to INVALID_REQUEST without
    // ever exposing the trigger's own message, which could otherwise
    // hint at another tenant's row existing.
    case "SHARE_TASK_LINK_NOT_FOUND":
    case "SHARE_TASK_OWNER_MISMATCH":
    case "SHARE_TASK_NOT_FOUND":
    case "SHARE_TASK_NOT_OWNED":
    case "SHARE_TASK_DELETED":
    case "SHARE_TASK_WITHOUT_PROJECT":
    case "SHARE_TASK_PROJECT_MISMATCH":
    case "SHARE_RESOURCE_LINK_NOT_FOUND":
    case "SHARE_RESOURCE_OWNER_MISMATCH":
    case "SHARE_RESOURCE_NOT_FOUND":
    case "SHARE_RESOURCE_NOT_OWNED":
    case "SHARE_RESOURCE_RELATIONSHIP_INVALID":
    case "SHARE_RESOURCE_PROJECT_MISMATCH":
    case "SHARE_RESOURCE_TASK_PROJECT_MISMATCH":
      return { code: "INVALID_REQUEST" };
    // Objective B real browser defect #2 investigation: these four codes
    // are enforce_share_link_update_integrity's (202608030005) own
    // defense-in-depth checks on the publishUpdate insert/retire this RPC
    // performs -- SHARE_UPDATE_LINK_NOT_FOUND, SHARE_UPDATE_OWNER_MISMATCH
    // and SHARE_UPDATE_CREATED_BY_MISMATCH on insert, SHARE_UPDATE_IMMUTABLE
    // on the retire-current-row update. This RPC's own logic always
    // inserts with user_id = created_by = the already-ownership-verified
    // caller and never touches the retired row's immutable columns, so
    // none of these should ever fire in practice -- but until this fix
    // they fell through to the `default: UNEXPECTED` branch below
    // unmapped, exactly like the SHARE_TASK_*/SHARE_RESOURCE_* trigger
    // codes did before this file's own precedent for them was added.
    // Mapped the same way, for the same reason: never leak the trigger's
    // own message, but never silently collapse a real defense-in-depth
    // signal into the same generic bucket reserved for the three verified
    // "should be structurally impossible" row-count assertions below.
    case "SHARE_UPDATE_LINK_NOT_FOUND":
    case "SHARE_UPDATE_OWNER_MISMATCH":
    case "SHARE_UPDATE_CREATED_BY_MISMATCH":
    case "SHARE_UPDATE_IMMUTABLE":
      return { code: "INVALID_REQUEST" };
    default:
      // Includes TASK_SET_VERIFICATION_FAILED,
      // RESOURCE_SET_VERIFICATION_FAILED and
      // PUBLISH_UPDATE_INSERT_FAILED -- internal consistency assertions
      // that should never fire in practice -- and any other unrecognized
      // message. All fail closed as UNEXPECTED rather than exposing an
      // internal code.
      return { code: "UNEXPECTED" };
  }
}

function hexFromBuffer(value: Buffer): string {
  return value.toString("hex");
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

const MAX_PUBLIC_ID_ATTEMPTS = 3;

/**
 * Creates an owned draft share link, via public.create_share_link_draft.
 * Generates a fresh candidate public id for each of up to
 * MAX_PUBLIC_ID_ATTEMPTS attempts, retrying only on the RPC's exact
 * {code: P0001, message: PUBLIC_ID_COLLISION} result -- a bounded `for`
 * loop, never an unbounded one. Any other RPC error, or exhausting every
 * attempt, returns a typed failure (collision exhaustion surfaces as
 * UNEXPECTED, matching every other internal failure).
 */
export async function createShareLinkDraft<Client>(
  supabase: Client,
  projectId: string
): Promise<ShareLinksRepositoryResult<CreateShareLinkDraftData>> {
  const client = supabase as ShareLinksSupabaseLikeClient;
  const canonicalProjectId = canonicalizeUuid(projectId);

  for (let attempt = 0; attempt < MAX_PUBLIC_ID_ATTEMPTS; attempt += 1) {
    const candidatePublicId = generateSharePublicId();

    const { data, error } = await client.rpc(CREATE_SHARE_LINK_DRAFT_RPC, {
      p_project_id: canonicalProjectId,
      p_public_id: candidatePublicId,
    });

    if (error) {
      if (error.code === RPC_ERROR_CODE && error.message === "PUBLIC_ID_COLLISION") {
        continue;
      }
      return { ok: false, error: mapLifecycleRpcError(error) };
    }

    const parsed = createShareLinkDraftDataSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, error: { code: "UNEXPECTED" } };
    }

    return { ok: true, data: parsed.data };
  }

  return { ok: false, error: { code: "UNEXPECTED" } };
}

/**
 * Activates an owned draft share link, via public.activate_share_link.
 * Generates the raw share secret, its keyed digest, and its AES-256-GCM
 * encryption (AAD-bound to the canonical link id) entirely in this
 * function -- never in the route. `createShareSecretDigest` already
 * returns the exact persisted representation
 * (project_share_links.secret_digest's own lowercase-hex-64 format), so
 * it is sent to the RPC as-is, with no intermediate encoding conversion
 * -- there is exactly one digest representation anywhere in this path.
 * The encrypted ciphertext/nonce/authTag are hex-encoded here at the
 * repository/RPC boundary (they are stored as `bytea`, which the RPC
 * parameter list represents as hex text). The raw secret itself is never
 * sent to the RPC. Any crypto/key failure (missing/malformed HMAC or
 * encryption key, or either helper's own input validation rejecting a
 * malformed value) is caught here and fails closed as UNEXPECTED before
 * the RPC is ever called; its internal message is never forwarded to the
 * caller.
 *
 * The RPC itself never returns the raw secret (Postgres never sees
 * plaintext) -- this function attaches the secret it already generated
 * to the RPC's own safe, parsed result to produce the final
 * ActivateShareLinkData the route returns.
 */
export async function activateShareLink<Client>(
  supabase: Client,
  linkId: string
): Promise<ShareLinksRepositoryResult<ActivateShareLinkData>> {
  const canonicalLinkId = canonicalizeUuid(linkId);

  let rawSecret: string;
  let secretDigest: string;
  let ciphertextHex: string;
  let nonceHex: string;
  let authTagHex: string;
  let encryptionVersion: number;

  try {
    rawSecret = generateRawShareSecret();
    secretDigest = createShareSecretDigest(rawSecret);

    const encrypted = encryptShareSecret(rawSecret, canonicalLinkId);
    ciphertextHex = hexFromBuffer(encrypted.ciphertext);
    nonceHex = hexFromBuffer(encrypted.nonce);
    authTagHex = hexFromBuffer(encrypted.authTag);
    encryptionVersion = encrypted.encryptionVersion;
  } catch (error) {
    logSecretMaterialFailure("activate_share_link", error);
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(ACTIVATE_SHARE_LINK_RPC, {
    p_link_id: canonicalLinkId,
    p_secret_digest: secretDigest,
    p_secret_digest_version: SHARE_SECRET_DIGEST_VERSION,
    p_ciphertext_hex: ciphertextHex,
    p_nonce_hex: nonceHex,
    p_auth_tag_hex: authTagHex,
    p_encryption_version: encryptionVersion,
  });

  if (error) {
    return { ok: false, error: mapLifecycleRpcError(error) };
  }

  const parsed = activateShareLinkRpcDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  const fullData = activateShareLinkDataSchema.safeParse({
    ...parsed.data,
    secret: rawSecret,
  });
  if (!fullData.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: fullData.data };
}

/**
 * Disables an owned active share link, via public.disable_share_link.
 */
export async function disableShareLink<Client>(
  supabase: Client,
  linkId: string
): Promise<ShareLinksRepositoryResult<DisableShareLinkData>> {
  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(DISABLE_SHARE_LINK_RPC, {
    p_link_id: canonicalizeUuid(linkId),
  });

  if (error) {
    return { ok: false, error: mapLifecycleRpcError(error) };
  }

  const parsed = disableShareLinkDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Re-enables an owned disabled share link back to active, via
 * public.reenable_share_link. Never generates or sends any secret
 * material -- the RPC itself requires the existing secret_digest and
 * project_share_secret_material row to already be present.
 */
export async function reenableShareLink<Client>(
  supabase: Client,
  linkId: string
): Promise<ShareLinksRepositoryResult<ReenableShareLinkData>> {
  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(REENABLE_SHARE_LINK_RPC, {
    p_link_id: canonicalizeUuid(linkId),
  });

  if (error) {
    return { ok: false, error: mapLifecycleRpcError(error) };
  }

  const parsed = reenableShareLinkDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}

// ---------------------------------------------------------------------
// Phase 1B.3 access operations (PIN / expiry / rotate / revoke / reveal)
// ---------------------------------------------------------------------

/**
 * Sets/replaces the PIN on an owned share link, via
 * public.set_share_link_pin. Hashes the PIN with hashSharePin (fresh
 * salt, fixed V1 scrypt profile) entirely in this function -- the
 * plaintext PIN is never sent to the RPC, only the resulting hash/salt/
 * profile. A hashing failure (including an invalid PIN shape) is caught
 * here and fails closed as UNEXPECTED before the RPC is ever called.
 */
export async function setShareLinkPin<Client>(
  supabase: Client,
  linkId: string,
  pin: string
): Promise<ShareLinksRepositoryResult<SetSharePinData>> {
  const canonicalLinkId = canonicalizeUuid(linkId);

  let pinHash: string;
  let pinSalt: string;
  let pinHashVersion: number;
  let pinScryptN: number;
  let pinScryptR: number;
  let pinScryptP: number;
  let pinKeyLength: number;

  try {
    const hashed = await hashSharePin(pin);
    pinHash = hashed.pinHash;
    pinSalt = hashed.pinSalt;
    pinHashVersion = hashed.pinHashVersion;
    pinScryptN = hashed.pinScryptN;
    pinScryptR = hashed.pinScryptR;
    pinScryptP = hashed.pinScryptP;
    pinKeyLength = hashed.pinKeyLength;
  } catch {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(SET_SHARE_LINK_PIN_RPC, {
    p_link_id: canonicalLinkId,
    p_pin_hash: pinHash,
    p_pin_salt: pinSalt,
    p_pin_hash_version: pinHashVersion,
    p_pin_scrypt_n: pinScryptN,
    p_pin_scrypt_r: pinScryptR,
    p_pin_scrypt_p: pinScryptP,
    p_pin_key_length: pinKeyLength,
  });

  if (error) {
    return { ok: false, error: mapAccessOperationRpcError(error) };
  }

  const parsed = setSharePinDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  if (parsed.data.linkId !== canonicalLinkId) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Clears the PIN on an owned share link, via public.clear_share_link_pin.
 * Idempotent: the RPC itself leaves configuration_version untouched when
 * no PIN was present.
 */
export async function clearShareLinkPin<Client>(
  supabase: Client,
  linkId: string
): Promise<ShareLinksRepositoryResult<ClearSharePinData>> {
  const canonicalLinkId = canonicalizeUuid(linkId);

  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(CLEAR_SHARE_LINK_PIN_RPC, {
    p_link_id: canonicalLinkId,
  });

  if (error) {
    return { ok: false, error: mapAccessOperationRpcError(error) };
  }

  const parsed = clearSharePinDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  if (parsed.data.linkId !== canonicalLinkId) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Sets/replaces expires_at on an owned share link, via
 * public.set_share_link_expiry. `expiresAt` is forwarded verbatim (the
 * route already validated it as a strict ISO timestamp) -- this function
 * performs no reformatting of its own.
 */
export async function setShareLinkExpiry<Client>(
  supabase: Client,
  linkId: string,
  expiresAt: string
): Promise<ShareLinksRepositoryResult<SetShareLinkExpiryData>> {
  const canonicalLinkId = canonicalizeUuid(linkId);

  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(SET_SHARE_LINK_EXPIRY_RPC, {
    p_link_id: canonicalLinkId,
    p_expires_at: expiresAt,
  });

  if (error) {
    return { ok: false, error: mapAccessOperationRpcError(error) };
  }

  const parsed = setShareLinkExpiryDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  if (parsed.data.linkId !== canonicalLinkId) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Clears expires_at on an owned share link, via
 * public.clear_share_link_expiry. Idempotent when expiry was already
 * null; returns SHARE_LINK_STATE_CONFLICT (mapped from the RPC's own
 * SHARE_LINK_STATE_CONFLICT message) when the link is expired, since
 * clearing expiry on an expired link is not a supported transition.
 */
export async function clearShareLinkExpiry<Client>(
  supabase: Client,
  linkId: string
): Promise<ShareLinksRepositoryResult<ClearShareLinkExpiryData>> {
  const canonicalLinkId = canonicalizeUuid(linkId);

  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(CLEAR_SHARE_LINK_EXPIRY_RPC, {
    p_link_id: canonicalLinkId,
  });

  if (error) {
    return { ok: false, error: mapAccessOperationRpcError(error) };
  }

  const parsed = clearShareLinkExpiryDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  if (parsed.data.linkId !== canonicalLinkId) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Rotates the secret on an owned active/disabled share link, via
 * public.rotate_share_link_secret. Generates a fresh raw secret, its
 * keyed digest, and its AES-256-GCM encryption entirely in this function
 * -- exactly mirroring activateShareLink above -- and never sends the
 * plaintext secret to the RPC. Any crypto/key failure is caught here and
 * fails closed as UNEXPECTED before the RPC is ever called. The RPC never
 * returns the raw secret; this function attaches the secret it already
 * generated to the RPC's own safe, parsed result.
 */
export async function rotateShareLinkSecret<Client>(
  supabase: Client,
  linkId: string
): Promise<ShareLinksRepositoryResult<RotateShareLinkSecretData>> {
  const canonicalLinkId = canonicalizeUuid(linkId);

  let rawSecret: string;
  let secretDigest: string;
  let ciphertextHex: string;
  let nonceHex: string;
  let authTagHex: string;
  let encryptionVersion: number;

  try {
    rawSecret = generateRawShareSecret();
    secretDigest = createShareSecretDigest(rawSecret);

    const encrypted = encryptShareSecret(rawSecret, canonicalLinkId);
    ciphertextHex = hexFromBuffer(encrypted.ciphertext);
    nonceHex = hexFromBuffer(encrypted.nonce);
    authTagHex = hexFromBuffer(encrypted.authTag);
    encryptionVersion = encrypted.encryptionVersion;
  } catch (error) {
    logSecretMaterialFailure("rotate_share_link_secret", error);
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(ROTATE_SHARE_LINK_SECRET_RPC, {
    p_link_id: canonicalLinkId,
    p_secret_digest: secretDigest,
    p_secret_digest_version: SHARE_SECRET_DIGEST_VERSION,
    p_ciphertext_hex: ciphertextHex,
    p_nonce_hex: nonceHex,
    p_auth_tag_hex: authTagHex,
    p_encryption_version: encryptionVersion,
  });

  if (error) {
    return { ok: false, error: mapAccessOperationRpcError(error) };
  }

  const parsed = rotateShareLinkSecretRpcDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  if (parsed.data.linkId !== canonicalLinkId) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  const fullData = rotateShareLinkSecretDataSchema.safeParse({
    ...parsed.data,
    secret: rawSecret,
  });
  if (!fullData.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: fullData.data };
}

/**
 * Permanently revokes an owned share link, via public.revoke_share_link.
 * Terminal: an already-revoked link returns SHARE_LINK_STATE_CONFLICT
 * (mapped from the RPC's own message) rather than replaying the
 * mutation.
 */
export async function revokeShareLink<Client>(
  supabase: Client,
  linkId: string
): Promise<ShareLinksRepositoryResult<RevokeShareLinkData>> {
  const canonicalLinkId = canonicalizeUuid(linkId);

  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(REVOKE_SHARE_LINK_RPC, {
    p_link_id: canonicalLinkId,
  });

  if (error) {
    return { ok: false, error: mapAccessOperationRpcError(error) };
  }

  const parsed = revokeShareLinkDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  if (parsed.data.linkId !== canonicalLinkId) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Reveals the currently stored raw secret for an owned active share
 * link. public.reveal_share_link_secret never decrypts and never returns
 * plaintext -- it returns only encrypted material (lowercase hex,
 * exact-length), which this function converts to Buffer only after the
 * RPC result has passed strict schema validation, then decrypts
 * server-side via decryptShareSecret (AAD-bound to the canonical link
 * id, exactly as encryptShareSecret bound it during activation/
 * rotation). Any failure from this point on -- malformed hex, wrong key,
 * wrong AAD, a tampered auth tag, or a recovered plaintext that does not
 * pass the raw-secret shape check -- fails closed as
 * SHARE_LINK_SECRET_UNAVAILABLE. The ciphertext, nonce, auth tag and any
 * underlying crypto error detail are never included in the returned
 * result.
 */
export async function revealShareLinkSecret<Client>(
  supabase: Client,
  linkId: string
): Promise<ShareLinksRepositoryResult<RevealShareLinkSecretData>> {
  const canonicalLinkId = canonicalizeUuid(linkId);

  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(REVEAL_SHARE_LINK_SECRET_RPC, {
    p_link_id: canonicalLinkId,
  });

  if (error) {
    return { ok: false, error: mapAccessOperationRpcError(error) };
  }

  const parsedRpc = revealShareLinkSecretRpcDataSchema.safeParse(data);
  if (!parsedRpc.success) {
    // Malformed encrypted material (bad ciphertext/nonce/authTag hex, an
    // unsupported encryptionVersion, an invalid publicId, or a missing
    // field) is a stored-material integrity failure, not a generic
    // repository bug -- fails closed the same way a decryption failure
    // does, and decryption is never attempted.
    return { ok: false, error: { code: "SHARE_LINK_SECRET_UNAVAILABLE" } };
  }

  if (parsedRpc.data.linkId !== canonicalLinkId) {
    // The RPC is owner/state/project scoped by p_link_id already, so this
    // can only happen if the RPC's own result is corrupt or has been
    // tampered with -- treated exactly like any other secret-material
    // integrity failure. Decryption is never attempted.
    return { ok: false, error: { code: "SHARE_LINK_SECRET_UNAVAILABLE" } };
  }

  let secret: string;
  try {
    secret = decryptShareSecret({
      ciphertext: Buffer.from(parsedRpc.data.ciphertextHex, "hex"),
      nonce: Buffer.from(parsedRpc.data.nonceHex, "hex"),
      authTag: Buffer.from(parsedRpc.data.authTagHex, "hex"),
      encryptionVersion: parsedRpc.data.encryptionVersion,
      shareLinkId: canonicalLinkId,
    });
  } catch (error) {
    logSecretMaterialFailure("reveal_share_link_secret", error);
    return { ok: false, error: { code: "SHARE_LINK_SECRET_UNAVAILABLE" } };
  }

  const parsed = revealShareLinkSecretDataSchema.safeParse({
    linkId: parsedRpc.data.linkId,
    publicId: parsedRpc.data.publicId,
    secret,
  });
  if (!parsed.success) {
    return { ok: false, error: { code: "SHARE_LINK_SECRET_UNAVAILABLE" } };
  }

  return { ok: true, data: parsed.data };
}

// ---------------------------------------------------------------------
// Phase 1B.4 configuration save (settings / tasks / resources /
// publishUpdate, combined into one atomic RPC call)
// ---------------------------------------------------------------------

/**
 * Saves an owned share link's configuration -- settings, task mapping,
 * Resource mapping and an optional new published update -- via the
 * single atomic public.save_share_configuration RPC. Never queries or
 * mutates a Client Share table directly and never uses the admin/
 * service-role client; the RPC itself is the sole authoritative
 * ownership check and the sole place any of these tables are touched.
 *
 * Each omitted request group is sent as SQL null (`?? null` only ever
 * falls back on `undefined`, never on a legitimate empty array, so an
 * empty `tasks`/`resources` array -- "clear every mapping" -- is
 * preserved exactly as the caller supplied it, distinct from omitting
 * the group entirely). Every group's fields are forwarded verbatim: Zod
 * already parsed `subtaskId` as a canonical decimal string (never a
 * JavaScript number), and JSON serialization keeps it a string across
 * this RPC boundary the same way every other Phase 1B subtask id is
 * carried.
 */
export async function saveShareConfiguration<Client>(
  supabase: Client,
  linkId: string,
  request: SaveShareConfigurationRequest
): Promise<ShareLinksRepositoryResult<SaveShareConfigurationData>> {
  const canonicalLinkId = canonicalizeUuid(linkId);

  const client = supabase as ShareLinksSupabaseLikeClient;
  const { data, error } = await client.rpc(SAVE_SHARE_CONFIGURATION_RPC, {
    p_link_id: canonicalLinkId,
    p_settings: request.settings ?? null,
    p_tasks: request.tasks ?? null,
    p_resources: request.resources ?? null,
    p_publish_update: request.publishUpdate ?? null,
  });

  if (error) {
    return { ok: false, error: mapSaveConfigurationRpcError(error) };
  }

  const parsed = saveShareConfigurationDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  if (parsed.data.linkId !== canonicalLinkId) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}
