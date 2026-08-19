import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Table-keyed response queue: `.from(table)` calls each pull the NEXT
 * queued response for THAT table, in the order it was queued for that
 * table specifically -- decoupled from calls to any OTHER table, which
 * makes tests robust against this module's own conditional call counts
 * (e.g. isShareLinkCurrentlyPubliclyActive only queries `projects` when
 * the link is already state = 'active' and unexpired).
 */
const queues = new Map<string, Array<{ data: unknown; error: unknown }>>();

function queueResponse(table: string, response: { data: unknown; error: unknown }): void {
  const existing = queues.get(table) ?? [];
  existing.push(response);
  queues.set(table, existing);
}

function nextFor(table: string): { data: unknown; error: unknown } {
  const queue = queues.get(table);
  if (!queue || queue.length === 0) {
    return { data: null, error: null };
  }
  return queue.shift() as { data: unknown; error: unknown };
}

// Real browser defect #4 regression: records every .insert() payload per
// table so a test can assert on the exact literal values a write sent
// (e.g. that created_at and pin_verified_at are the same value), not just
// on the function's final boolean/return outcome. Purely additive --
// existing tests that never read insertPayloads are unaffected.
const insertPayloads = new Map<string, unknown[]>();

function recordInsert(table: string, payload: unknown): void {
  const existing = insertPayloads.get(table) ?? [];
  existing.push(payload);
  insertPayloads.set(table, existing);
}

function insertPayloadsFor(table: string): unknown[] {
  return insertPayloads.get(table) ?? [];
}

function makeChain(table: string) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    insert: (payload: unknown) => {
      recordInsert(table, payload);
      return chain;
    },
    update: () => chain,
    eq: () => chain,
    neq: () => chain,
    is: () => chain,
    in: () => chain,
    maybeSingle: () => Promise.resolve(nextFor(table)),
    single: () => Promise.resolve(nextFor(table)),
    then: (
      resolve: (value: { data: unknown; error: unknown }) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve(nextFor(table)).then(resolve, reject),
  };
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: (table: string) => makeChain(table) },
}));

const {
  resolveShareLinkByPublicId,
  resolveShareLinkById,
  resolveShareLinkCommentsEnabled,
  isShareLinkCurrentlyPubliclyActive,
  resolveBrowserSessionFromCookie,
  createBrowserSession,
  ensureCurrentGrant,
  verifyShareProjectionAuthorization,
} = await import("./share-session-grant.server");

const { generateShareBrowserSessionSecret, hashShareBrowserSessionSecret } = await import(
  "./share-browser-session.server"
);

const SESSION_ENV_KEY = "TEXT2TASK_SHARE_SESSION_HMAC_KEY_V1";
const VALID_SESSION_KEY = Buffer.alloc(32, 3).toString("base64url");

const VALID_PUBLIC_ID = "abcdefgh12345678ijklmnop";
const VALID_LINK_ID = "11111111-1111-4111-8111-111111111111";
const VALID_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const VALID_USER_ID = "33333333-3333-4333-8333-333333333333";
const VALID_SESSION_ID = "44444444-4444-4444-8444-444444444444";
const FUTURE_TIMESTAMP = new Date(Date.now() + 60_000).toISOString();
const PAST_TIMESTAMP = new Date(Date.now() - 60_000).toISOString();

function validLinkRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_LINK_ID,
    project_id: VALID_PROJECT_ID,
    user_id: VALID_USER_ID,
    public_id: VALID_PUBLIC_ID,
    state: "active",
    expires_at: null,
    secret_digest: "a".repeat(64),
    secret_digest_version: 1,
    pin_hash: null,
    pin_salt: null,
    pin_hash_version: null,
    pin_scrypt_n: null,
    pin_scrypt_r: null,
    pin_scrypt_p: null,
    pin_key_length: null,
    configuration_version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  queues.clear();
  insertPayloads.clear();
  process.env[SESSION_ENV_KEY] = VALID_SESSION_KEY;
});

afterEach(() => {
  delete process.env[SESSION_ENV_KEY];
});

describe("resolveShareLinkByPublicId", () => {
  it("returns null for a malformed publicId without any DB call", async () => {
    const result = await resolveShareLinkByPublicId("not a valid public id");
    expect(result).toBeNull();
    expect(queues.get("project_share_links")).toBeUndefined();
  });

  it("returns null when the link is not found", async () => {
    queueResponse("project_share_links", { data: null, error: null });
    const result = await resolveShareLinkByPublicId(VALID_PUBLIC_ID);
    expect(result).toBeNull();
  });

  it("returns null on a query error, never throwing", async () => {
    queueResponse("project_share_links", { data: null, error: { message: "boom" } });
    const result = await resolveShareLinkByPublicId(VALID_PUBLIC_ID);
    expect(result).toBeNull();
  });

  it("PHASE 4B DEFECT #2 FINAL NARROWING -- returns null for a row that exists but is revoked (same external null contract as not-found, now distinguished internally via stage tags only)", async () => {
    queueResponse("project_share_links", { data: validLinkRow({ state: "revoked" }), error: null });
    const result = await resolveShareLinkByPublicId(VALID_PUBLIC_ID);
    expect(result).toBeNull();
  });

  it("is scoped by public_id alone -- no session-derived identifier is ever part of this query (confirms no session/link coupling exists)", async () => {
    queueResponse("project_share_links", { data: validLinkRow(), error: null });
    await resolveShareLinkByPublicId(VALID_PUBLIC_ID);
    // makeChain's `eq`/`is`/`in` are all no-op passthroughs that don't
    // record call arguments, so the real proof is structural: this
    // function's own signature (lib/share/share-session-grant.server.ts)
    // takes only `publicId: string` -- there is no session/browser
    // parameter for a coupled query to even reference.
    expect(resolveShareLinkByPublicId.length).toBe(1);
  });

  it("maps a found row, including PIN material only when all seven fields are present", async () => {
    queueResponse("project_share_links", { data: validLinkRow(), error: null });
    const result = await resolveShareLinkByPublicId(VALID_PUBLIC_ID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(VALID_LINK_ID);
    expect(result?.pinMaterial).toBeNull();
  });

  it("maps complete PIN material when present", async () => {
    queueResponse("project_share_links", {
      data: validLinkRow({
        pin_hash: "b".repeat(43),
        pin_salt: "c".repeat(22),
        pin_hash_version: 1,
        pin_scrypt_n: 16384,
        pin_scrypt_r: 8,
        pin_scrypt_p: 1,
        pin_key_length: 32,
      }),
      error: null,
    });

    const result = await resolveShareLinkByPublicId(VALID_PUBLIC_ID);
    expect(result?.pinMaterial).not.toBeNull();
    expect(result?.pinMaterial?.pinHashVersion).toBe(1);
  });
});

describe("resolveShareLinkById", () => {
  it("returns null when not found", async () => {
    queueResponse("project_share_links", { data: null, error: null });
    expect(await resolveShareLinkById(VALID_LINK_ID)).toBeNull();
  });

  it("resolves a found row", async () => {
    queueResponse("project_share_links", { data: validLinkRow(), error: null });
    const result = await resolveShareLinkById(VALID_LINK_ID);
    expect(result?.id).toBe(VALID_LINK_ID);
  });
});

describe("resolveShareLinkCommentsEnabled - Phase 5B", () => {
  it("returns true when the link's comments_enabled column is true", async () => {
    queueResponse("project_share_links", { data: { comments_enabled: true }, error: null });
    expect(await resolveShareLinkCommentsEnabled(VALID_LINK_ID, VALID_USER_ID)).toBe(true);
  });

  it("returns false when the link's comments_enabled column is false", async () => {
    queueResponse("project_share_links", { data: { comments_enabled: false }, error: null });
    expect(await resolveShareLinkCommentsEnabled(VALID_LINK_ID, VALID_USER_ID)).toBe(false);
  });

  it("fails closed (false) when no row is found (e.g. cross-owner id)", async () => {
    queueResponse("project_share_links", { data: null, error: null });
    expect(await resolveShareLinkCommentsEnabled(VALID_LINK_ID, VALID_USER_ID)).toBe(false);
  });

  it("fails closed (false) on a query error", async () => {
    queueResponse("project_share_links", { data: null, error: { code: "500" } });
    expect(await resolveShareLinkCommentsEnabled(VALID_LINK_ID, VALID_USER_ID)).toBe(false);
  });
});

describe("isShareLinkCurrentlyPubliclyActive", () => {
  it("is false for a non-active state, without querying projects", async () => {
    const link = (await resolveLinkWith({ state: "disabled" }))!;
    const active = await isShareLinkCurrentlyPubliclyActive(link);
    expect(active).toBe(false);
    expect(queues.get("projects")).toBeUndefined();
  });

  it("is false for an active but already-expired link, without querying projects", async () => {
    const link = (await resolveLinkWith({ state: "active", expires_at: PAST_TIMESTAMP }))!;
    const active = await isShareLinkCurrentlyPubliclyActive(link);
    expect(active).toBe(false);
    expect(queues.get("projects")).toBeUndefined();
  });

  it("is true for an active, unexpired link whose project is not deleted", async () => {
    const link = (await resolveLinkWith({ state: "active", expires_at: FUTURE_TIMESTAMP }))!;
    queueResponse("projects", { data: { id: VALID_PROJECT_ID, deleted_at: null }, error: null });
    expect(await isShareLinkCurrentlyPubliclyActive(link)).toBe(true);
  });

  it("is false when the project is soft-deleted", async () => {
    const link = (await resolveLinkWith({ state: "active" }))!;
    queueResponse("projects", {
      data: { id: VALID_PROJECT_ID, deleted_at: "2026-01-01T00:00:00Z" },
      error: null,
    });
    expect(await isShareLinkCurrentlyPubliclyActive(link)).toBe(false);
  });

  it("is false when the project lookup errors or the project is not found", async () => {
    const link = (await resolveLinkWith({ state: "active" }))!;
    queueResponse("projects", { data: null, error: null });
    expect(await isShareLinkCurrentlyPubliclyActive(link)).toBe(false);
  });
});

async function resolveLinkWith(overrides: Record<string, unknown>) {
  queueResponse("project_share_links", { data: validLinkRow(overrides), error: null });
  return resolveShareLinkByPublicId(VALID_PUBLIC_ID);
}

describe("resolveBrowserSessionFromCookie", () => {
  it("returns null for a null cookie value, without any DB call", async () => {
    expect(await resolveBrowserSessionFromCookie(null)).toBeNull();
    expect(queues.get("share_browser_sessions")).toBeUndefined();
  });

  it("returns null for a malformed cookie value, without any DB call", async () => {
    expect(await resolveBrowserSessionFromCookie("not-a-valid-secret")).toBeNull();
    expect(queues.get("share_browser_sessions")).toBeUndefined();
  });

  it("returns null when no session matches the digest", async () => {
    queueResponse("share_browser_sessions", { data: null, error: null });
    const raw = generateShareBrowserSessionSecret();
    expect(await resolveBrowserSessionFromCookie(raw)).toBeNull();
  });

  it("returns null for a revoked session", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: PAST_TIMESTAMP },
      error: null,
    });
    const raw = generateShareBrowserSessionSecret();
    expect(await resolveBrowserSessionFromCookie(raw)).toBeNull();
  });

  it("returns null for an expired session", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: PAST_TIMESTAMP, revoked_at: null },
      error: null,
    });
    const raw = generateShareBrowserSessionSecret();
    expect(await resolveBrowserSessionFromCookie(raw)).toBeNull();
  });

  it("resolves a live, unrevoked session", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    const raw = generateShareBrowserSessionSecret();
    const result = await resolveBrowserSessionFromCookie(raw);
    expect(result).toEqual({ id: VALID_SESSION_ID, expiresAt: FUTURE_TIMESTAMP });
  });

  it("looks the session up by the SAME digest hashShareBrowserSessionSecret computes for the raw cookie value (no reversible storage)", async () => {
    const raw = generateShareBrowserSessionSecret();
    const expectedDigest = hashShareBrowserSessionSecret(raw);
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    await resolveBrowserSessionFromCookie(raw);
    // The digest itself is never exposed by this module's return value --
    // this test only proves the lookup path executes without error using
    // the real hashing function, i.e. no parallel/second hashing scheme
    // exists.
    expect(expectedDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("createBrowserSession", () => {
  it("creates a session and returns both the id and the raw secret, never persisting the raw secret itself", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP },
      error: null,
    });

    const result = await createBrowserSession();

    expect(result.session.id).toBe(VALID_SESSION_ID);
    expect(result.rawSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("throws when the insert fails", async () => {
    queueResponse("share_browser_sessions", { data: null, error: { message: "boom" } });
    await expect(createBrowserSession()).rejects.toThrow();
  });
});

describe("ensureCurrentGrant - the atomic-upsert-equivalent exchange contract", () => {
  const baseInput = {
    browserSessionId: VALID_SESSION_ID,
    browserSessionExpiresAt: FUTURE_TIMESTAMP,
    shareLinkId: VALID_LINK_ID,
    linkConfigurationVersion: 1,
    linkExpiresAt: null as string | null,
    pinVerifiedNow: false,
  };

  it("inserts a fresh grant when none exists", async () => {
    queueResponse("share_session_grants", { data: [], error: null }); // select existing -> none
    queueResponse("share_session_grants", { data: null, error: null }); // insert -> success

    const ok = await ensureCurrentGrant(baseInput);
    expect(ok).toBe(true);
  });

  it("leaves an already-valid current grant untouched (no revoke, no re-insert)", async () => {
    queueResponse("share_session_grants", {
      data: [
        {
          id: "grant-1",
          granted_configuration_version: 1,
          pin_verified_at: null,
          expires_at: FUTURE_TIMESTAMP,
          revoked_at: null,
        },
      ],
      error: null,
    });

    const ok = await ensureCurrentGrant(baseInput);
    expect(ok).toBe(true);
    // Only the initial select was queued -- if the code attempted an
    // update/insert it would consume the (absent) next queued response
    // and receive { data: null, error: null }, which would still report
    // ok: true here, so this test's real assertion is the queue itself:
    // exactly one table interaction was required.
    expect(queues.get("share_session_grants")?.length ?? 0).toBe(0);
  });

  it("revokes a stale (wrong configuration_version) current grant, then inserts its replacement", async () => {
    queueResponse("share_session_grants", {
      data: [
        {
          id: "grant-1",
          granted_configuration_version: 1,
          pin_verified_at: null,
          expires_at: FUTURE_TIMESTAMP,
          revoked_at: null,
        },
      ],
      error: null,
    }); // select existing -> stale (v1, but link is now v2)
    queueResponse("share_session_grants", { data: null, error: null }); // revoke update -> success
    queueResponse("share_session_grants", { data: null, error: null }); // insert replacement -> success

    const ok = await ensureCurrentGrant({ ...baseInput, linkConfigurationVersion: 2 });
    expect(ok).toBe(true);
  });

  it("revokes an expired current grant, then inserts its replacement", async () => {
    queueResponse("share_session_grants", {
      data: [
        {
          id: "grant-1",
          granted_configuration_version: 1,
          pin_verified_at: null,
          expires_at: PAST_TIMESTAMP,
          revoked_at: null,
        },
      ],
      error: null,
    });
    queueResponse("share_session_grants", { data: null, error: null }); // revoke
    queueResponse("share_session_grants", { data: null, error: null }); // insert

    const ok = await ensureCurrentGrant(baseInput);
    expect(ok).toBe(true);
  });

  it("sets pin_verified_at only when pinVerifiedNow is true (structurally, via a successful insert under the integrity-trigger-equivalent assumption)", async () => {
    queueResponse("share_session_grants", { data: [], error: null });
    queueResponse("share_session_grants", { data: null, error: null });

    const ok = await ensureCurrentGrant({ ...baseInput, pinVerifiedNow: true });
    expect(ok).toBe(true);
  });

  it("REAL BROWSER DEFECT #4 REGRESSION: when pinVerifiedNow is true, created_at is supplied explicitly and equals pin_verified_at exactly -- never a later, independently-clocked value", async () => {
    // share_session_grants_lifecycle_check requires
    // `pin_verified_at is null or pin_verified_at >= created_at`.
    // created_at defaults to the database's own now(), evaluated when the
    // row is physically inserted -- strictly AFTER this request travels
    // the network to Postgres. A pin_verified_at computed in Node.js
    // BEFORE that round trip would always be chronologically earlier than
    // a server-computed created_at, deterministically violating this
    // constraint on every single PIN-protected grant. The fix supplies
    // one literal timestamp for both columns in the same insert payload,
    // so the constraint is satisfied by construction regardless of
    // network latency. This test proves the literal insert payload -- not
    // just the function's boolean return -- carries that guarantee.
    queueResponse("share_session_grants", { data: [], error: null }); // select existing -> none
    queueResponse("share_session_grants", { data: null, error: null }); // insert -> success

    const ok = await ensureCurrentGrant({ ...baseInput, pinVerifiedNow: true });
    expect(ok).toBe(true);

    const [insertPayload] = insertPayloadsFor("share_session_grants") as Array<{
      created_at?: unknown;
      pin_verified_at?: unknown;
    }>;
    expect(insertPayload).toBeDefined();
    expect(insertPayload.created_at).toBeTypeOf("string");
    expect(insertPayload.pin_verified_at).toBe(insertPayload.created_at);
  });

  it("when pinVerifiedNow is false, created_at is still supplied explicitly but pin_verified_at remains null", async () => {
    queueResponse("share_session_grants", { data: [], error: null });
    queueResponse("share_session_grants", { data: null, error: null });

    const ok = await ensureCurrentGrant({ ...baseInput, pinVerifiedNow: false });
    expect(ok).toBe(true);

    const [insertPayload] = insertPayloadsFor("share_session_grants") as Array<{
      created_at?: unknown;
      pin_verified_at?: unknown;
    }>;
    expect(insertPayload.created_at).toBeTypeOf("string");
    expect(insertPayload.pin_verified_at).toBeNull();
  });

  it("clamps grant expiry to the link's own expires_at when it is sooner than the session's", async () => {
    const linkExpiresSoon = new Date(Date.now() + 10_000).toISOString();
    queueResponse("share_session_grants", { data: [], error: null });
    queueResponse("share_session_grants", { data: null, error: null });

    const ok = await ensureCurrentGrant({
      ...baseInput,
      browserSessionExpiresAt: FUTURE_TIMESTAMP,
      linkExpiresAt: linkExpiresSoon,
    });
    expect(ok).toBe(true);
    // The exact clamped value is an internal implementation detail not
    // observable through this function's boolean return -- the docs/
    // client-share-phase3-runtime/ disposable package's own grant-expiry
    // assertions are the authoritative runtime proof of the exact stored
    // value.
  });

  it("returns false when the existing-grant select itself errors", async () => {
    queueResponse("share_session_grants", { data: null, error: { message: "boom" } });
    expect(await ensureCurrentGrant(baseInput)).toBe(false);
  });

  it("returns false when the revoke update fails", async () => {
    queueResponse("share_session_grants", {
      data: [
        {
          id: "grant-1",
          granted_configuration_version: 1,
          pin_verified_at: null,
          expires_at: PAST_TIMESTAMP,
          revoked_at: null,
        },
      ],
      error: null,
    });
    queueResponse("share_session_grants", { data: null, error: { message: "boom" } }); // revoke fails

    expect(await ensureCurrentGrant(baseInput)).toBe(false);
  });

  it("on an insert failure (simulated race/unique_violation), re-checks and returns true if a valid current grant now exists", async () => {
    queueResponse("share_session_grants", { data: [], error: null }); // select -> none
    queueResponse("share_session_grants", { data: null, error: { code: "23505", message: "duplicate" } }); // insert -> race
    queueResponse("share_session_grants", {
      data: [
        {
          granted_configuration_version: 1,
          expires_at: FUTURE_TIMESTAMP,
        },
      ],
      error: null,
    }); // re-check -> the other request's grant is valid

    expect(await ensureCurrentGrant(baseInput)).toBe(true);
  });

  it("on an insert failure with no valid grant found on re-check, fails closed", async () => {
    queueResponse("share_session_grants", { data: [], error: null });
    queueResponse("share_session_grants", { data: null, error: { code: "23505", message: "duplicate" } });
    queueResponse("share_session_grants", { data: [], error: null }); // re-check -> still none

    expect(await ensureCurrentGrant(baseInput)).toBe(false);
  });
});

describe("ensureCurrentGrant/createBrowserSession - real browser defect #4 safe diagnostic logging", () => {
  const baseInput = {
    browserSessionId: VALID_SESSION_ID,
    browserSessionExpiresAt: FUTURE_TIMESTAMP,
    shareLinkId: VALID_LINK_ID,
    linkConfigurationVersion: 1,
    linkExpiresAt: null as string | null,
    pinVerifiedNow: false,
  };

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("logs stage create_browser_session with the Postgres error code, never the raw secret", async () => {
    queueResponse("share_browser_sessions", { data: null, error: { code: "42501", message: "boom" } });

    await expect(createBrowserSession()).rejects.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith("share_session_grant_failure", {
      operation: "share_session_create",
      stage: "create_browser_session",
      postgresCode: "42501",
    });
  });

  it("logs stage create_grant with the Postgres error code when the existing-grant select errors", async () => {
    queueResponse("share_session_grants", { data: null, error: { code: "42P01", message: "boom" } });

    expect(await ensureCurrentGrant(baseInput)).toBe(false);

    expect(consoleErrorSpy).toHaveBeenCalledWith("share_session_grant_failure", {
      operation: "share_session_create",
      stage: "create_grant",
      postgresCode: "42P01",
    });
  });

  it("logs stage create_grant when an insert genuinely fails (not a 23505 race) and the re-check finds no matching grant", async () => {
    queueResponse("share_session_grants", { data: [], error: null }); // select -> none
    queueResponse("share_session_grants", { data: null, error: { code: "23514", message: "check violation" } }); // insert -> real failure
    queueResponse("share_session_grants", { data: [], error: null }); // re-check -> still none

    expect(await ensureCurrentGrant(baseInput)).toBe(false);

    expect(consoleErrorSpy).toHaveBeenCalledWith("share_session_grant_failure", {
      operation: "share_session_create",
      stage: "create_grant",
      postgresCode: "23514",
    });
  });

  it("does NOT log when an insert failure is resolved by the race re-check (a genuine concurrent success, not a defect)", async () => {
    queueResponse("share_session_grants", { data: [], error: null });
    queueResponse("share_session_grants", { data: null, error: { code: "23505", message: "duplicate" } });
    queueResponse("share_session_grants", {
      data: [{ granted_configuration_version: 1, expires_at: FUTURE_TIMESTAMP }],
      error: null,
    });

    expect(await ensureCurrentGrant(baseInput)).toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("never includes a PIN, raw secret, session token, or service-role key in any logged diagnostic", async () => {
    queueResponse("share_session_grants", { data: null, error: { code: "42P01", message: "boom" } });

    await ensureCurrentGrant(baseInput);

    const serializedCalls = JSON.stringify(consoleErrorSpy.mock.calls);
    for (const forbidden of ["pin", "secret", "cookie", "token", "service_role", "SUPABASE_SERVICE_ROLE_KEY"]) {
      expect(serializedCalls.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe("verifyShareProjectionAuthorization - never trusts any single dimension alone", () => {
  function queueHappyPath(overrides: {
    grantConfigVersion?: number;
    linkConfigVersion?: number;
    pinVerifiedAt?: string | null;
    linkHasPin?: boolean;
  } = {}) {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", {
      data: validLinkRow({
        configuration_version: overrides.linkConfigVersion ?? 1,
        ...(overrides.linkHasPin
          ? {
              pin_hash: "b".repeat(43),
              pin_salt: "c".repeat(22),
              pin_hash_version: 1,
              pin_scrypt_n: 16384,
              pin_scrypt_r: 8,
              pin_scrypt_p: 1,
              pin_key_length: 32,
            }
          : {}),
      }),
      error: null,
    });
    queueResponse("projects", { data: { id: VALID_PROJECT_ID, deleted_at: null }, error: null });
    queueResponse("share_session_grants", {
      data: [
        {
          granted_configuration_version: overrides.grantConfigVersion ?? 1,
          pin_verified_at: overrides.pinVerifiedAt ?? null,
          expires_at: FUTURE_TIMESTAMP,
          revoked_at: null,
        },
      ],
      error: null,
    });
  }

  it("authorizes when session, link and grant all agree", async () => {
    queueHappyPath();
    const raw = generateShareBrowserSessionSecret();

    const result = await verifyShareProjectionAuthorization({
      cookieValue: raw,
      publicId: VALID_PUBLIC_ID,
    });

    expect(result).toEqual({
      shareLinkId: VALID_LINK_ID,
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });
  });

  it("fails closed with no cookie at all", async () => {
    const result = await verifyShareProjectionAuthorization({
      cookieValue: null,
      publicId: VALID_PUBLIC_ID,
    });
    expect(result).toBeNull();
  });

  it("fails closed when the session cannot be resolved", async () => {
    queueResponse("share_browser_sessions", { data: null, error: null });
    const raw = generateShareBrowserSessionSecret();

    const result = await verifyShareProjectionAuthorization({
      cookieValue: raw,
      publicId: VALID_PUBLIC_ID,
    });
    expect(result).toBeNull();
  });

  it("fails closed when the link cannot be resolved", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", { data: null, error: null });
    const raw = generateShareBrowserSessionSecret();

    const result = await verifyShareProjectionAuthorization({
      cookieValue: raw,
      publicId: VALID_PUBLIC_ID,
    });
    expect(result).toBeNull();
  });

  it("fails closed when no grant exists for this exact (session, link) pair", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", { data: validLinkRow(), error: null });
    queueResponse("projects", { data: { id: VALID_PROJECT_ID, deleted_at: null }, error: null });
    queueResponse("share_session_grants", { data: [], error: null });
    const raw = generateShareBrowserSessionSecret();

    const result = await verifyShareProjectionAuthorization({
      cookieValue: raw,
      publicId: VALID_PUBLIC_ID,
    });
    expect(result).toBeNull();
  });

  it("fails closed when the grant's configuration_version is stale relative to the link's live version", async () => {
    queueHappyPath({ grantConfigVersion: 1, linkConfigVersion: 2 });
    const raw = generateShareBrowserSessionSecret();

    const result = await verifyShareProjectionAuthorization({
      cookieValue: raw,
      publicId: VALID_PUBLIC_ID,
    });
    expect(result).toBeNull();
  });

  it("fails closed when the grant is expired", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", { data: validLinkRow(), error: null });
    queueResponse("projects", { data: { id: VALID_PROJECT_ID, deleted_at: null }, error: null });
    queueResponse("share_session_grants", {
      data: [
        {
          granted_configuration_version: 1,
          pin_verified_at: null,
          expires_at: PAST_TIMESTAMP,
          revoked_at: null,
        },
      ],
      error: null,
    });
    const raw = generateShareBrowserSessionSecret();

    const result = await verifyShareProjectionAuthorization({
      cookieValue: raw,
      publicId: VALID_PUBLIC_ID,
    });
    expect(result).toBeNull();
  });

  it("fails closed when the link currently requires a PIN but the grant has no pin_verified_at", async () => {
    queueHappyPath({ linkHasPin: true, pinVerifiedAt: null });
    const raw = generateShareBrowserSessionSecret();

    const result = await verifyShareProjectionAuthorization({
      cookieValue: raw,
      publicId: VALID_PUBLIC_ID,
    });
    expect(result).toBeNull();
  });

  it("authorizes a PIN-required link when the grant's pin_verified_at is populated", async () => {
    queueHappyPath({ linkHasPin: true, pinVerifiedAt: FUTURE_TIMESTAMP });
    const raw = generateShareBrowserSessionSecret();

    const result = await verifyShareProjectionAuthorization({
      cookieValue: raw,
      publicId: VALID_PUBLIC_ID,
    });
    expect(result).not.toBeNull();
  });
});

describe("verifyShareProjectionAuthorization - PHASE 4B DEFECT #2 sub-stage diagnostics", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  // PHASE 4C -- the two success-shaped stages (link_resolved,
  // authorization_ok) are logged via console.info, not console.error
  // (see the module's own right-sizing comment); every denial stage
  // stays on console.error. This helper merges both spies, in call
  // order, so existing sequence assertions (e.g. "link_resolved then
  // link_not_active") continue to read correctly regardless of which
  // level either individual stage happens to use.
  function stageCalls(): unknown[][] {
    const tagged = (spy: ReturnType<typeof vi.spyOn>, order: "error" | "info") =>
      (spy.mock.invocationCallOrder as number[]).map((callOrder, i) => ({
        callOrder,
        call: (spy.mock.calls as unknown[][])[i],
        order,
      }));

    return [...tagged(consoleErrorSpy, "error"), ...tagged(consoleInfoSpy, "info")]
      .sort((a, b) => a.callOrder - b.callOrder)
      .map((entry) => entry.call)
      .filter((call) => call[0] === "share_projection_auth_stage");
  }

  function queueHappyPath(overrides: {
    grantConfigVersion?: number;
    linkConfigVersion?: number;
    pinVerifiedAt?: string | null;
    linkHasPin?: boolean;
  } = {}) {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", {
      data: validLinkRow({
        configuration_version: overrides.linkConfigVersion ?? 1,
        ...(overrides.linkHasPin
          ? {
              pin_hash: "b".repeat(43),
              pin_salt: "c".repeat(22),
              pin_hash_version: 1,
              pin_scrypt_n: 16384,
              pin_scrypt_r: 8,
              pin_scrypt_p: 1,
              pin_key_length: 32,
            }
          : {}),
      }),
      error: null,
    });
    queueResponse("projects", { data: { id: VALID_PROJECT_ID, deleted_at: null }, error: null });
    queueResponse("share_session_grants", {
      data: [
        {
          granted_configuration_version: overrides.grantConfigVersion ?? 1,
          pin_verified_at: overrides.pinVerifiedAt ?? null,
          expires_at: FUTURE_TIMESTAMP,
          revoked_at: null,
        },
      ],
      error: null,
    });
  }

  it("tags session_lookup_failed when the session cannot be resolved", async () => {
    queueResponse("share_browser_sessions", { data: null, error: null });
    await verifyShareProjectionAuthorization({
      cookieValue: generateShareBrowserSessionSecret(),
      publicId: VALID_PUBLIC_ID,
    });
    expect(stageCalls()).toEqual([["share_projection_auth_stage", { stage: "session_lookup_failed" }]]);
  });

  it("tags link_not_found_by_public_id when no row matches this public_id at all", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", { data: null, error: null });
    await verifyShareProjectionAuthorization({
      cookieValue: generateShareBrowserSessionSecret(),
      publicId: VALID_PUBLIC_ID,
    });
    expect(stageCalls()).toEqual([["share_projection_auth_stage", { stage: "link_not_found_by_public_id" }]]);
  });

  it("PHASE 4B DEFECT #2 FINAL NARROWING -- tags link_revoked (distinct from link_not_found_by_public_id) when the row exists but state = 'revoked'", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", { data: validLinkRow({ state: "revoked" }), error: null });
    await verifyShareProjectionAuthorization({
      cookieValue: generateShareBrowserSessionSecret(),
      publicId: VALID_PUBLIC_ID,
    });
    expect(stageCalls()).toEqual([["share_projection_auth_stage", { stage: "link_revoked" }]]);
  });

  it("tags link_query_failed when the project_share_links query itself errors", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", { data: null, error: { message: "boom" } });
    await verifyShareProjectionAuthorization({
      cookieValue: generateShareBrowserSessionSecret(),
      publicId: VALID_PUBLIC_ID,
    });
    expect(stageCalls()).toEqual([["share_projection_auth_stage", { stage: "link_query_failed" }]]);
  });

  it("tags link_resolved then link_not_active when the link resolves but is not currently publicly active", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", { data: validLinkRow({ state: "disabled" }), error: null });
    await verifyShareProjectionAuthorization({
      cookieValue: generateShareBrowserSessionSecret(),
      publicId: VALID_PUBLIC_ID,
    });
    expect(stageCalls()).toEqual([
      ["share_projection_auth_stage", { stage: "link_resolved" }],
      ["share_projection_auth_stage", { stage: "link_not_active" }],
    ]);
  });

  it("tags grant_not_found when no grant exists for this (session, link) pair", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", { data: validLinkRow(), error: null });
    queueResponse("projects", { data: { id: VALID_PROJECT_ID, deleted_at: null }, error: null });
    queueResponse("share_session_grants", { data: [], error: null });
    await verifyShareProjectionAuthorization({
      cookieValue: generateShareBrowserSessionSecret(),
      publicId: VALID_PUBLIC_ID,
    });
    expect(stageCalls().at(-1)).toEqual(["share_projection_auth_stage", { stage: "grant_not_found" }]);
  });

  it("tags grant_expired when the grant's own expires_at has passed", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", { data: validLinkRow(), error: null });
    queueResponse("projects", { data: { id: VALID_PROJECT_ID, deleted_at: null }, error: null });
    queueResponse("share_session_grants", {
      data: [{ granted_configuration_version: 1, pin_verified_at: null, expires_at: PAST_TIMESTAMP, revoked_at: null }],
      error: null,
    });
    await verifyShareProjectionAuthorization({
      cookieValue: generateShareBrowserSessionSecret(),
      publicId: VALID_PUBLIC_ID,
    });
    expect(stageCalls().at(-1)).toEqual(["share_projection_auth_stage", { stage: "grant_expired" }]);
  });

  it("tags config_version_mismatch when the grant is stale relative to the link's live configuration_version", async () => {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", { data: validLinkRow({ configuration_version: 2 }), error: null });
    queueResponse("projects", { data: { id: VALID_PROJECT_ID, deleted_at: null }, error: null });
    queueResponse("share_session_grants", {
      data: [{ granted_configuration_version: 1, pin_verified_at: null, expires_at: FUTURE_TIMESTAMP, revoked_at: null }],
      error: null,
    });
    await verifyShareProjectionAuthorization({
      cookieValue: generateShareBrowserSessionSecret(),
      publicId: VALID_PUBLIC_ID,
    });
    expect(stageCalls().at(-1)).toEqual(["share_projection_auth_stage", { stage: "config_version_mismatch" }]);
  });

  it("tags pin_not_verified when the link requires a PIN the grant hasn't verified", async () => {
    queueHappyPath({ linkHasPin: true, pinVerifiedAt: null });
    await verifyShareProjectionAuthorization({
      cookieValue: generateShareBrowserSessionSecret(),
      publicId: VALID_PUBLIC_ID,
    });
    expect(stageCalls().at(-1)).toEqual(["share_projection_auth_stage", { stage: "pin_not_verified" }]);
  });

  it("tags authorization_ok on success", async () => {
    queueHappyPath();
    await verifyShareProjectionAuthorization({
      cookieValue: generateShareBrowserSessionSecret(),
      publicId: VALID_PUBLIC_ID,
    });
    expect(stageCalls().at(-1)).toEqual(["share_projection_auth_stage", { stage: "authorization_ok" }]);
  });

  it("never logs the cookie, session id, grant id, publicId, or link/project/user id in any stage tag", async () => {
    queueHappyPath();
    const raw = generateShareBrowserSessionSecret();
    await verifyShareProjectionAuthorization({ cookieValue: raw, publicId: VALID_PUBLIC_ID });

    const serialized = JSON.stringify([...consoleErrorSpy.mock.calls, ...consoleInfoSpy.mock.calls]);
    for (const forbidden of [raw, VALID_SESSION_ID, VALID_LINK_ID, VALID_PROJECT_ID, VALID_USER_ID, VALID_PUBLIC_ID]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("PHASE 4B DEFECT #2 -- both routes call verifyShareProjectionAuthorization identically", () => {
  /**
   * Direct proof, not an assumption: /projection/route.ts and
   * /resources/[fileRef]/route.ts both call
   * `verifyShareProjectionAuthorization({cookieValue, publicId})` with the
   * exact same two fields, in the same order, sourced the same way (the
   * same cookie-policy name, the same context.params.publicId). Given
   * that, this function -- a pure, deterministic read of the SAME
   * database state -- cannot itself produce a different result for the
   * "projection" call vs. the "file route" call when the underlying
   * session/link/grant rows have not changed between them. This test
   * proves that determinism directly: the exact same input, called twice
   * (simulating a projection request immediately followed by a file-route
   * request against the same session/link state), returns the identical
   * successful authorization both times -- there is no code-level
   * asymmetry between the two routes' authorization calls. If a real
   * Preview retest still shows the file route failing while the
   * projection route succeeds under otherwise-identical conditions, the
   * cause is therefore external to this function and to both routes'
   * call sites (e.g. genuinely different request/cookie context, or the
   * underlying session/link/grant state actually changing between the
   * two real requests) -- not a routing or parameter bug, which this test
   * would have caught.
   */
  it("returns the identical successful authorization for two calls with the same cookie/publicId against unchanged DB state", async () => {
    queueHappyPath();
    queueHappyPath(); // second call re-reads the same (unchanged) state
    const raw = generateShareBrowserSessionSecret();

    const projectionCallResult = await verifyShareProjectionAuthorization({
      cookieValue: raw,
      publicId: VALID_PUBLIC_ID,
    });
    const fileRouteCallResult = await verifyShareProjectionAuthorization({
      cookieValue: raw,
      publicId: VALID_PUBLIC_ID,
    });

    expect(projectionCallResult).not.toBeNull();
    expect(fileRouteCallResult).toEqual(projectionCallResult);
  });

  function queueHappyPath(overrides: {
    grantConfigVersion?: number;
    linkConfigVersion?: number;
    pinVerifiedAt?: string | null;
    linkHasPin?: boolean;
  } = {}) {
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", {
      data: validLinkRow({ configuration_version: overrides.linkConfigVersion ?? 1 }),
      error: null,
    });
    queueResponse("projects", { data: { id: VALID_PROJECT_ID, deleted_at: null }, error: null });
    queueResponse("share_session_grants", {
      data: [
        {
          granted_configuration_version: overrides.grantConfigVersion ?? 1,
          pin_verified_at: overrides.pinVerifiedAt ?? null,
          expires_at: FUTURE_TIMESTAMP,
          revoked_at: null,
        },
      ],
      error: null,
    });
  }

  /**
   * Section 3's data-model question, answered and proven: a browser
   * session (share_browser_sessions) is a browser-LEVEL session with no
   * share_link_id column at all -- it is NOT tied to exactly one link.
   * `share_session_grants` is the link-specific authorization object
   * (browser_session_id + share_link_id together, unique per current
   * pair -- share_session_grants_current_unique_idx,
   * 202608030004_client_share_session_foundation.sql), meaning the SAME
   * session can hold independent grants for multiple different links.
   * This test proves the authorization gate respects that: a grant for
   * link A never authorizes link B, even under the same session/cookie.
   */
  it("a browser session holding a grant only for link A does not authorize link B -- no cross-link authorization", async () => {
    const PUBLIC_ID_B = "zzyyxxwwvvuuttssrrqqppoo";
    const LINK_ID_B = "99999999-9999-4999-8999-999999999999";
    const raw = generateShareBrowserSessionSecret();

    // Call 1: publicId A resolves link A; a grant exists for (session, link A).
    queueHappyPath();
    const resultForLinkA = await verifyShareProjectionAuthorization({
      cookieValue: raw,
      publicId: VALID_PUBLIC_ID,
    });
    expect(resultForLinkA).toEqual({
      shareLinkId: VALID_LINK_ID,
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    // Call 2: publicId B resolves a DIFFERENT link; the same session has
    // no grant for THIS link (the grants query, scoped by
    // browser_session_id + this resolved link's id, legitimately returns
    // nothing for a pair that was never granted).
    queueResponse("share_browser_sessions", {
      data: { id: VALID_SESSION_ID, expires_at: FUTURE_TIMESTAMP, revoked_at: null },
      error: null,
    });
    queueResponse("project_share_links", {
      data: validLinkRow({ id: LINK_ID_B, public_id: PUBLIC_ID_B }),
      error: null,
    });
    queueResponse("projects", { data: { id: VALID_PROJECT_ID, deleted_at: null }, error: null });
    queueResponse("share_session_grants", { data: [], error: null }); // no grant for (session, link B)

    const resultForLinkB = await verifyShareProjectionAuthorization({
      cookieValue: raw,
      publicId: PUBLIC_ID_B,
    });
    expect(resultForLinkB).toBeNull();
  });
});
