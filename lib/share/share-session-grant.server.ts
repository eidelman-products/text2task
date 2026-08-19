import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { canonicalizeUuid } from "./share-contracts";
import {
  generateShareBrowserSessionSecret,
  hashShareBrowserSessionSecret,
  isValidRawShareBrowserSessionSecret,
  SHARE_BROWSER_SESSION_TTL_SECONDS,
} from "./share-browser-session.server";
import { isValidSharePublicId } from "./share-public-id.server";
import type { StoredSharePinMaterial } from "./share-pin.server";

/**
 * Real browser defect #4 investigation: safe, structured server-side
 * diagnostics for the grant-creation path. Logs only a fixed operation
 * tag, a fixed stage identifier, and (when available) the failed
 * insert/update's own Postgres error code (e.g. "23514" for a check
 * violation, "23505" for the expected unique-violation race) -- never the
 * PIN, the raw share secret, the session cookie/token, the service-role
 * key, or any project/task/Resource data. Exists purely so a future
 * ensureCurrentGrant failure can be pinpointed from Vercel's own function
 * logs without another full static trace.
 */
function logShareGrantFailure(
  stage: "create_browser_session" | "create_grant" | "validate_grant",
  detail: { postgresCode?: string | null } = {}
): void {
  console.error("share_session_grant_failure", {
    operation: "share_session_create",
    stage,
    postgresCode: detail.postgresCode ?? null,
  });
}

/**
 * Phase 3 -- server-mediated resolution and creation of
 * share_browser_sessions / share_session_grants rows for the anonymous
 * Client Share surface. Every DB access here is a service-role read/
 * write through explicit, bounded column selects (never `select("*")`),
 * scoped by the exact identifiers the caller has already proven it may
 * reference. Anonymous callers never query these tables directly --
 * only this module does, on their behalf, after its own verification.
 *
 * Session/grant identity, revocation and configuration-version rules are
 * NOT re-implemented or duplicated here beyond what is needed to shape a
 * correct write -- the database's own integrity triggers
 * (enforce_share_browser_session_integrity, enforce_share_session_grant_integrity,
 * 202608030005) remain the unconditional second line of defense under
 * every insert/update this module performs.
 */

// ---------------------------------------------------------------------
// Share link resolution (bounded columns only)
// ---------------------------------------------------------------------

export type ResolvedShareLink = Readonly<{
  id: string;
  projectId: string;
  userId: string;
  publicId: string;
  state: "draft" | "active" | "disabled" | "expired" | "revoked";
  expiresAt: string | null;
  secretDigest: string | null;
  secretDigestVersion: number | null;
  configurationVersion: number;
  pinMaterial: StoredSharePinMaterial | null;
}>;

type ShareLinkRow = {
  id: string;
  project_id: string;
  user_id: string;
  public_id: string;
  state: string;
  expires_at: string | null;
  secret_digest: string | null;
  secret_digest_version: number | null;
  pin_hash: string | null;
  pin_salt: string | null;
  pin_hash_version: number | null;
  pin_scrypt_n: number | null;
  pin_scrypt_r: number | null;
  pin_scrypt_p: number | null;
  pin_key_length: number | null;
  configuration_version: number;
};

const SHARE_LINK_COLUMNS =
  "id, project_id, user_id, public_id, state, expires_at, secret_digest, secret_digest_version, pin_hash, pin_salt, pin_hash_version, pin_scrypt_n, pin_scrypt_r, pin_scrypt_p, pin_key_length, configuration_version";

function toResolvedShareLink(row: ShareLinkRow): ResolvedShareLink {
  const hasPinMaterial =
    row.pin_hash !== null &&
    row.pin_salt !== null &&
    row.pin_hash_version !== null &&
    row.pin_scrypt_n !== null &&
    row.pin_scrypt_r !== null &&
    row.pin_scrypt_p !== null &&
    row.pin_key_length !== null;

  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    publicId: row.public_id,
    state: row.state as ResolvedShareLink["state"],
    expiresAt: row.expires_at,
    secretDigest: row.secret_digest,
    secretDigestVersion: row.secret_digest_version,
    configurationVersion: row.configuration_version,
    pinMaterial: hasPinMaterial
      ? {
          pinHash: row.pin_hash as string,
          pinSalt: row.pin_salt as string,
          pinHashVersion: row.pin_hash_version as number,
          pinScryptN: row.pin_scrypt_n as number,
          pinScryptR: row.pin_scrypt_r as number,
          pinScryptP: row.pin_scrypt_p as number,
          pinKeyLength: row.pin_key_length as number,
        }
      : null,
  };
}

/** Resolves a share link by its public, URL-carried identifier. Returns
 * null for any malformed input or non-existent link -- callers must
 * treat "malformed publicId" and "link genuinely absent" identically
 * (no enumeration oracle). Revoked links resolve to null structurally,
 * matching every owner-facing read's own `state <> 'revoked'` posture --
 * scoped by `public_id` alone, never by any session-derived identifier
 * (there is no coupling between browser-session state and this lookup;
 * grants, not sessions, are the link-specific authorization object --
 * see verifyShareProjectionAuthorization's own grant query below, scoped
 * to the link this function independently resolved). */
export async function resolveShareLinkByPublicId(
  publicId: string
): Promise<ResolvedShareLink | null> {
  if (!isValidSharePublicId(publicId)) {
    return null;
  }

  // Deliberately NOT filtered by `.neq("state", "revoked")` at the query
  // level any more -- fetching the row regardless of state and checking
  // `state` in code afterward is what lets "not found at all" and
  // "found but revoked" be distinguished from the exact same single
  // query, with no extra round trip and no change to the function's own
  // external null-for-either-case contract.
  const { data, error } = await supabaseAdmin
    .from("project_share_links")
    .select(SHARE_LINK_COLUMNS)
    .eq("public_id", publicId)
    .maybeSingle();

  if (error) {
    logShareProjectionAuthStage("link_query_failed");
    return null;
  }

  if (!data) {
    logShareProjectionAuthStage("link_not_found_by_public_id");
    return null;
  }

  const row = data as unknown as ShareLinkRow;

  if (row.state === "revoked") {
    logShareProjectionAuthStage("link_revoked");
    return null;
  }

  logShareProjectionAuthStage("link_resolved");
  return toResolvedShareLink(row);
}

/** Re-resolves a link by its trusted internal id (already known to the
 * caller from a prior resolution) -- used to re-check live state at
 * projection-read time without a second publicId round trip. */
export async function resolveShareLinkById(
  shareLinkId: string
): Promise<ResolvedShareLink | null> {
  const { data, error } = await supabaseAdmin
    .from("project_share_links")
    .select(SHARE_LINK_COLUMNS)
    .eq("id", canonicalizeUuid(shareLinkId))
    .neq("state", "revoked")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toResolvedShareLink(data as unknown as ShareLinkRow);
}

/** Phase 5B -- narrow, additive read of a single link's own
 * `comments_enabled` flag, scoped by both id and owner. Deliberately kept
 * separate from `verifyShareProjectionAuthorization`'s own return shape
 * (`VerifiedShareProjectionAuthorization`) rather than folded into it --
 * that type is shared by the projection and file-delivery routes and
 * their own existing exact-shape tests, so this is a standalone read the
 * messages route calls as its own distinct authorization step, after
 * `verifyShareProjectionAuthorization` has already succeeded. Fails
 * closed (`false`) on any error or not-found, never treats an unreadable
 * flag as "comments allowed". */
export async function resolveShareLinkCommentsEnabled(
  shareLinkId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("project_share_links")
    .select("comments_enabled")
    .eq("id", canonicalizeUuid(shareLinkId))
    .eq("user_id", canonicalizeUuid(userId))
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return (data as { comments_enabled: boolean }).comments_enabled === true;
}

/** True only when a link is currently in a state that may serve
 * anonymous public access: active, unexpired, and its project exists and
 * is not soft-deleted. Every public read must re-run this at read time
 * (AGENTS.md rule 8) -- never trust a previously-granted authorization
 * alone. */
export async function isShareLinkCurrentlyPubliclyActive(
  link: ResolvedShareLink
): Promise<boolean> {
  if (link.state !== "active") {
    return false;
  }

  if (link.expiresAt !== null && new Date(link.expiresAt).getTime() <= Date.now()) {
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, deleted_at")
    .eq("id", link.projectId)
    .eq("user_id", link.userId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return (data as { deleted_at: string | null }).deleted_at === null;
}

// ---------------------------------------------------------------------
// Browser session resolution / creation
// ---------------------------------------------------------------------

export type ResolvedBrowserSession = Readonly<{
  id: string;
  expiresAt: string;
}>;

type BrowserSessionRow = {
  id: string;
  expires_at: string;
  revoked_at: string | null;
};

/** Resolves an existing browser session from the raw cookie value.
 * Returns null (never throws) for a missing, malformed, non-existent,
 * expired, or revoked session -- every caller must treat all of those
 * identically: fail closed, mint or require a fresh session. Never
 * trusts the cookie's mere presence. */
export async function resolveBrowserSessionFromCookie(
  rawCookieValue: string | null
): Promise<ResolvedBrowserSession | null> {
  if (rawCookieValue === null || !isValidRawShareBrowserSessionSecret(rawCookieValue)) {
    return null;
  }

  let digest: string;
  try {
    digest = hashShareBrowserSessionSecret(rawCookieValue);
  } catch {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("share_browser_sessions")
    .select("id, expires_at, revoked_at")
    .eq("session_digest", digest)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as BrowserSessionRow;

  if (row.revoked_at !== null) {
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return { id: row.id, expiresAt: row.expires_at };
}

/** Creates a brand-new browser session row and returns both its id and
 * the raw secret the caller must set as the HttpOnly cookie value --
 * the raw secret is never persisted; only its digest is written. */
export async function createBrowserSession(): Promise<
  Readonly<{ session: ResolvedBrowserSession; rawSecret: string }>
> {
  const rawSecret = generateShareBrowserSessionSecret();
  const digest = hashShareBrowserSessionSecret(rawSecret);
  const expiresAt = new Date(
    Date.now() + SHARE_BROWSER_SESSION_TTL_SECONDS * 1000
  ).toISOString();

  const { data, error } = await supabaseAdmin
    .from("share_browser_sessions")
    .insert({ session_digest: digest, digest_version: 1, expires_at: expiresAt })
    .select("id, expires_at")
    .single();

  if (error || !data) {
    logShareGrantFailure("create_browser_session", { postgresCode: error?.code });
    throw new Error("Failed to create Client Share browser session.");
  }

  const row = data as { id: string; expires_at: string };

  return { session: { id: row.id, expiresAt: row.expires_at }, rawSecret };
}

/** Reuses a valid existing session from the request cookie, or mints a
 * fresh one. `rawSecretForCookie` is non-null only when a NEW session
 * was created and the caller must Set-Cookie it; a reused session needs
 * no new Set-Cookie call. */
export async function resolveOrCreateBrowserSession(
  existingCookieValue: string | null
): Promise<
  Readonly<{ session: ResolvedBrowserSession; rawSecretForCookie: string | null }>
> {
  const existing = await resolveBrowserSessionFromCookie(existingCookieValue);

  if (existing) {
    return { session: existing, rawSecretForCookie: null };
  }

  const created = await createBrowserSession();
  return { session: created.session, rawSecretForCookie: created.rawSecret };
}

// ---------------------------------------------------------------------
// Grant resolution / creation
// ---------------------------------------------------------------------

type GrantRow = {
  id: string;
  granted_configuration_version: number;
  pin_verified_at: string | null;
  expires_at: string;
  revoked_at: string | null;
};

/**
 * Ensures the (browserSessionId, shareLinkId) pair has a CURRENT, valid
 * grant matching the link's live configuration_version and PIN-
 * verification requirement. Mirrors 202608030004's own documented
 * exchange contract exactly: "lock the existing current grant ... mark
 * it revoked/superseded when it is stale ... insert the replacement
 * grant". A pre-existing grant that already matches is left untouched
 * (no redundant write). `pinVerifiedNow` must be true only when this
 * exact call is the moment PIN verification just succeeded (never
 * re-supplied on a later call) -- the integrity trigger makes
 * pin_verified_at immutable after insert, so this module never attempts
 * to set it on an UPDATE.
 */
export async function ensureCurrentGrant(input: {
  browserSessionId: string;
  browserSessionExpiresAt: string;
  shareLinkId: string;
  linkConfigurationVersion: number;
  linkExpiresAt: string | null;
  pinVerifiedNow: boolean;
}): Promise<boolean> {
  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("share_session_grants")
    .select("id, granted_configuration_version, pin_verified_at, expires_at, revoked_at")
    .eq("browser_session_id", input.browserSessionId)
    .eq("share_link_id", input.shareLinkId)
    .is("revoked_at", null);

  if (existingError) {
    logShareGrantFailure("create_grant", { postgresCode: existingError.code });
    return false;
  }

  const existing = ((existingRows as GrantRow[] | null) ?? [])[0] ?? null;

  if (existing) {
    const stillValid =
      existing.granted_configuration_version === input.linkConfigurationVersion &&
      new Date(existing.expires_at).getTime() > Date.now();

    if (stillValid) {
      return true;
    }

    const { error: revokeError } = await supabaseAdmin
      .from("share_session_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", existing.id)
      .is("revoked_at", null);

    if (revokeError) {
      logShareGrantFailure("create_grant", { postgresCode: revokeError.code });
      return false;
    }
  }

  const grantExpiresAt = computeGrantExpiresAt(
    input.browserSessionExpiresAt,
    input.linkExpiresAt
  );

  // Real browser defect #4 fix: share_session_grants_lifecycle_check
  // requires `pin_verified_at is null or pin_verified_at >= created_at`.
  // created_at defaults to the DATABASE's own now(), evaluated when the
  // row is physically inserted -- strictly AFTER this request has
  // travelled the network to Postgres. A pin_verified_at computed here in
  // Node.js is captured BEFORE that network round trip, so it is always
  // chronologically earlier than the server-side created_at by however
  // long the request took to arrive -- deterministically violating the
  // check constraint on every PIN-protected grant, every time (never a
  // race, never flaky). The fix: compute exactly one timestamp and supply
  // it for BOTH created_at and pin_verified_at in the same insert, so
  // they are the identical literal value the constraint compares rather
  // than two independently-clocked timestamps -- created_at's own
  // `default now()` is simply overridden here, which is ordinary,
  // supported Postgres behavior, not a schema change.
  const insertedAt = new Date().toISOString();

  const { error: insertError } = await supabaseAdmin.from("share_session_grants").insert({
    browser_session_id: input.browserSessionId,
    share_link_id: input.shareLinkId,
    granted_configuration_version: input.linkConfigurationVersion,
    created_at: insertedAt,
    pin_verified_at: input.pinVerifiedNow ? insertedAt : null,
    expires_at: grantExpiresAt,
  });

  if (!insertError) {
    return true;
  }

  // A concurrent request may have already inserted the current grant for
  // this exact (session, link) pair, tripping
  // share_session_grants_current_unique_idx (unique_violation, 23505).
  // Fail-safe re-check rather than treating this as an authorization
  // failure -- the other request's grant is equally valid.
  const { data: raceRows } = await supabaseAdmin
    .from("share_session_grants")
    .select("granted_configuration_version, expires_at")
    .eq("browser_session_id", input.browserSessionId)
    .eq("share_link_id", input.shareLinkId)
    .is("revoked_at", null);

  const raceGrant = ((raceRows as Pick<GrantRow, "granted_configuration_version" | "expires_at">[] | null) ?? [])[0];

  const raceGrantValid =
    raceGrant !== undefined &&
    raceGrant.granted_configuration_version === input.linkConfigurationVersion &&
    new Date(raceGrant.expires_at).getTime() > Date.now();

  if (!raceGrantValid) {
    // Not a concurrent-insert race after all (no matching row was found
    // on re-check) -- the insert genuinely failed for some other reason
    // (e.g. a check-constraint violation). postgresCode distinguishes a
    // real defect (anything other than 23505) from the expected race.
    logShareGrantFailure("create_grant", { postgresCode: insertError.code });
  }

  return raceGrantValid;
}

function computeGrantExpiresAt(
  browserSessionExpiresAt: string,
  linkExpiresAt: string | null
): string {
  const sessionExpiryMs = new Date(browserSessionExpiresAt).getTime();

  if (linkExpiresAt === null) {
    return new Date(sessionExpiryMs).toISOString();
  }

  const linkExpiryMs = new Date(linkExpiresAt).getTime();

  return new Date(Math.min(sessionExpiryMs, linkExpiryMs)).toISOString();
}

// ---------------------------------------------------------------------
// Full read-time revalidation for the public projection endpoint
// ---------------------------------------------------------------------

export type VerifiedShareProjectionAuthorization = Readonly<{
  shareLinkId: string;
  projectId: string;
  userId: string;
}>;

/**
 * PHASE 4B DEFECT #2 DIAGNOSTICS -- logs a fixed, safe sub-stage
 * identifier for `verifyShareProjectionAuthorization`, server-side only
 * (Vercel function logs), never echoed to any caller. This is the SAME
 * gate every public route (projection, the file-delivery route, and any
 * future sibling) shares -- a real-Preview retest found the file route
 * failing here with only "authorization_failed" visible, while the
 * projection route (calling this exact same function, with the same
 * cookie/publicId, seconds earlier) had succeeded. Code-level comparison
 * of both routes' call sites found them identical, and this function's
 * own extensive existing test coverage
 * (share-session-grant.server.test.ts) found no internal defect either.
 *
 * Also called from `resolveShareLinkByPublicId` (defined above this
 * function but hoisted, so the call resolves correctly) -- real Preview
 * evidence narrowed the failure specifically to link resolution, so that
 * function's own single generic "not found" case was split into its
 * three genuinely distinct outcomes (query error / not found at all /
 * found but revoked) rather than adding another broad, undifferentiated
 * pass. Never logs the cookie, session id, grant id, publicId,
 * link/project/user ids, or any other per-request value -- only the
 * fixed stage name.
 */
type ShareProjectionAuthStage =
  | "link_query_failed"
  | "link_not_found_by_public_id"
  | "link_revoked"
  | "link_resolved"
  | "session_lookup_failed"
  | "link_not_active"
  | "grant_query_failed"
  | "grant_not_found"
  | "grant_expired"
  | "config_version_mismatch"
  | "pin_not_verified"
  | "authorization_ok";

// PHASE 4C -- retained permanently as a low-risk operational diagnostic
// (see the Phase 4 audit doc's own "diagnostics retain/remove" section
// for the full rationale). Right-sized by log level here: the two
// success-shaped stages use `console.info` so a healthy, high-volume
// public endpoint doesn't emit a `console.error` line for every single
// successful request, which would otherwise dilute error-level
// monitoring/alerting with non-error events; every actual denial reason
// stays on `console.error`, where it belongs.
const SHARE_PROJECTION_AUTH_SUCCESS_STAGES: ReadonlySet<ShareProjectionAuthStage> = new Set([
  "link_resolved",
  "authorization_ok",
]);

function logShareProjectionAuthStage(stage: ShareProjectionAuthStage): void {
  const log = SHARE_PROJECTION_AUTH_SUCCESS_STAGES.has(stage) ? console.info : console.error;
  log("share_projection_auth_stage", { stage });
}

/**
 * The single authorization gate for GET /api/share/[publicId]/projection
 * (and, since Phase 4B, GET /api/share/[publicId]/resources/[fileRef] --
 * both routes call this exact function with the exact same two
 * arguments). Never trusts the cookie or the publicId alone -- every
 * dimension (session live+unrevoked, link active+unexpired+project-not-
 * deleted, grant same-session+same-link+unexpired+unrevoked+exact-
 * configuration-version-match+PIN-requirement-satisfied) is re-checked
 * against the database on every call. Returns null for ANY failure --
 * callers must respond with the same generic unavailable posture
 * regardless of which check failed (AGENTS.md rule 10).
 */
export async function verifyShareProjectionAuthorization(input: {
  cookieValue: string | null;
  publicId: string;
}): Promise<VerifiedShareProjectionAuthorization | null> {
  const session = await resolveBrowserSessionFromCookie(input.cookieValue);
  if (!session) {
    logShareProjectionAuthStage("session_lookup_failed");
    return null;
  }

  // resolveShareLinkByPublicId already logs its own precise outcome
  // (link_query_failed / link_not_found_by_public_id / link_revoked /
  // link_resolved) -- no redundant generic tag needed here.
  const link = await resolveShareLinkByPublicId(input.publicId);
  if (!link) {
    return null;
  }

  const linkActive = await isShareLinkCurrentlyPubliclyActive(link);
  if (!linkActive) {
    logShareProjectionAuthStage("link_not_active");
    return null;
  }

  const { data: grantRows, error: grantError } = await supabaseAdmin
    .from("share_session_grants")
    .select("granted_configuration_version, pin_verified_at, expires_at, revoked_at")
    .eq("browser_session_id", session.id)
    .eq("share_link_id", link.id)
    .is("revoked_at", null);

  if (grantError) {
    logShareGrantFailure("validate_grant", { postgresCode: grantError.code });
    logShareProjectionAuthStage("grant_query_failed");
    return null;
  }

  const grant = ((grantRows as GrantRow[] | null) ?? [])[0];

  if (!grant) {
    logShareProjectionAuthStage("grant_not_found");
    return null;
  }

  if (new Date(grant.expires_at).getTime() <= Date.now()) {
    logShareProjectionAuthStage("grant_expired");
    return null;
  }

  if (grant.granted_configuration_version !== link.configurationVersion) {
    logShareProjectionAuthStage("config_version_mismatch");
    return null;
  }

  const linkRequiresPin = link.pinMaterial !== null;

  if (linkRequiresPin && grant.pin_verified_at === null) {
    logShareProjectionAuthStage("pin_not_verified");
    return null;
  }

  logShareProjectionAuthStage("authorization_ok");
  return { shareLinkId: link.id, projectId: link.projectId, userId: link.userId };
}
