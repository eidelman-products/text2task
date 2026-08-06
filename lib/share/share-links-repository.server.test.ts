import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateSharePublicIdMock = vi.fn();
vi.mock("@/lib/share/share-public-id.server", () => ({
  generateSharePublicId: () => generateSharePublicIdMock(),
}));

const generateRawShareSecretMock = vi.fn();
const createShareSecretDigestMock = vi.fn();
vi.mock("@/lib/share/share-secret.server", () => ({
  generateRawShareSecret: () => generateRawShareSecretMock(),
  createShareSecretDigest: (secret: string) => createShareSecretDigestMock(secret),
  SHARE_SECRET_DIGEST_VERSION: 1,
}));

const encryptShareSecretMock = vi.fn();
vi.mock("@/lib/share/share-secret-encryption.server", () => ({
  encryptShareSecret: (plaintext: string, linkId: string) =>
    encryptShareSecretMock(plaintext, linkId),
}));

const {
  activateShareLink,
  createShareLinkDraft,
  disableShareLink,
  getShareLinkManagementState,
  listShareLinkSummaries,
  reenableShareLink,
} = await import("./share-links-repository.server");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_2 = "22222222-2222-4222-8222-222222222222";
const VALID_PUBLIC_ID = "abcdefgh12345678";
const VALID_PUBLIC_ID_2 = "zyxwvutsrqponmlk";
const VALID_TIMESTAMP = "2026-08-05T00:00:00Z";
const VALID_RAW_SECRET = "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc"; // 43 chars
// Lowercase hex, exactly 64 characters -- the exact persisted
// representation createShareSecretDigest now returns directly (no
// base64url intermediate encoding), matching
// project_share_links_secret_digest_format_check exactly.
const VALID_DIGEST_HEX =
  "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";

function validEncryptedMaterial() {
  return {
    // AES-GCM adds no padding, so a real 43-byte plaintext always
    // produces a 43-byte ciphertext -- match that shape here too.
    ciphertext: Buffer.alloc(43, 0xab),
    nonce: Buffer.alloc(12, 1),
    authTag: Buffer.alloc(16, 2),
    encryptionVersion: 1,
  };
}

beforeEach(() => {
  generateSharePublicIdMock.mockReset().mockReturnValue(VALID_PUBLIC_ID);
  generateRawShareSecretMock.mockReset().mockReturnValue(VALID_RAW_SECRET);
  createShareSecretDigestMock.mockReset().mockReturnValue(VALID_DIGEST_HEX);
  encryptShareSecretMock.mockReset().mockReturnValue(validEncryptedMaterial());
});

function validManagedLink() {
  return {
    id: VALID_UUID,
    publicId: VALID_PUBLIC_ID,
    state: "active" as const,
    expiresAt: null,
    hasPin: false,
    commentsEnabled: true,
    clientFacingSubtitle: null,
    contentDirection: "auto" as const,
    configurationVersion: 1,
    createdAt: VALID_TIMESTAMP,
    activatedAt: null,
    disabledAt: null,
    rotatedAt: null,
    lastViewedAt: null,
    viewCount: 0,
  };
}

function validManagementStateData() {
  return {
    link: validManagedLink(),
    mappedTaskIds: ["1", "42"],
    mappedResourceIds: [VALID_UUID],
    currentUpdate: null,
  };
}

function validSummaryEntry(projectId: string) {
  return {
    projectId,
    linkId: null,
    state: null,
    expiresAt: null,
    hasPin: false,
    createdAt: null,
    lastViewedAt: null,
    viewCount: 0,
    taskCount: 0,
    resourceCount: 0,
    unreadCount: null,
  };
}

function buildFakeClient(rpcImpl: ReturnType<typeof vi.fn>) {
  return { rpc: rpcImpl };
}

describe("getShareLinkManagementState", () => {
  it("calls exactly the get_share_link_management_state RPC with p_project_id", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validManagementStateData(),
      error: null,
    });
    const client = buildFakeClient(rpc);

    await getShareLinkManagementState(client, VALID_UUID);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_share_link_management_state", {
      p_project_id: VALID_UUID,
    });
  });

  it("returns parsed success data on a valid RPC response", async () => {
    const payload = validManagementStateData();
    const rpc = vi.fn().mockResolvedValue({ data: payload, error: null });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: true, data: payload });
  });

  it("canonicalizes an uppercase projectId to lowercase before calling the RPC, even when the caller did not", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validManagementStateData(),
      error: null,
    });
    const client = buildFakeClient(rpc);

    await getShareLinkManagementState(client, VALID_UUID.toUpperCase());

    expect(rpc).toHaveBeenCalledWith("get_share_link_management_state", {
      p_project_id: VALID_UUID,
    });
  });

  it("maps {code:P0001, message:UNAUTHORIZED} to a typed UNAUTHORIZED error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "UNAUTHORIZED" },
    });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNAUTHORIZED" } });
  });

  it("maps {code:P0001, message:PROJECT_NOT_FOUND} to a typed PROJECT_NOT_FOUND error, never the raw Postgres error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "PROJECT_NOT_FOUND", code: "P0001", details: "raw" },
    });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "PROJECT_NOT_FOUND" } });
    expect(result).not.toHaveProperty("error.details");
    expect(result).not.toHaveProperty("error.hint");
  });

  it("does not use substring matching -- a message that merely contains PROJECT_NOT_FOUND is not matched", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "context: PROJECT_NOT_FOUND happened" },
    });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("requires the exact code P0001 -- the same message with a different code is UNEXPECTED", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42501", message: "UNAUTHORIZED" },
    });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("maps an unrecognized RPC error to a typed UNEXPECTED error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "SOMETHING_ELSE" },
    });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when the RPC returns malformed data that does not match the contract", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { link: { id: VALID_UUID, pinHash: "leak-should-not-parse" } },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when the RPC returns null with no error", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });
});

describe("listShareLinkSummaries", () => {
  it("calls exactly the list_share_link_summaries RPC with p_project_ids", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
      error: null,
    });
    const client = buildFakeClient(rpc);

    await listShareLinkSummaries(client, [VALID_UUID]);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("list_share_link_summaries", {
      p_project_ids: [VALID_UUID],
    });
  });

  it("returns parsed success data on a valid RPC response covering exactly the requested projects", async () => {
    const payload = {
      [VALID_UUID]: validSummaryEntry(VALID_UUID),
      [VALID_UUID_2]: validSummaryEntry(VALID_UUID_2),
    };
    const rpc = vi.fn().mockResolvedValue({ data: payload, error: null });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID, VALID_UUID_2]);

    expect(result).toEqual({ ok: true, data: payload });
  });

  it("canonicalizes every projectId to lowercase before calling the RPC, even when the caller did not", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
      error: null,
    });
    const client = buildFakeClient(rpc);

    await listShareLinkSummaries(client, [VALID_UUID.toUpperCase()]);

    expect(rpc).toHaveBeenCalledWith("list_share_link_summaries", {
      p_project_ids: [VALID_UUID],
    });
  });

  it("succeeds the exact-set comparison when the caller supplied uppercase but Postgres returns lowercase keys", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID.toUpperCase()]);

    expect(result).toEqual({
      ok: true,
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
    });
  });

  it("collapses a lowercase and uppercase spelling of the same uuid to one requested id for the exact-set comparison", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [
      VALID_UUID.toUpperCase(),
      VALID_UUID,
    ]);

    expect(result).toEqual({
      ok: true,
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
    });
  });

  it("maps {code:P0001, message:UNAUTHORIZED} to a typed UNAUTHORIZED error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "UNAUTHORIZED" },
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID]);

    expect(result).toEqual({ ok: false, error: { code: "UNAUTHORIZED" } });
  });

  it("maps {code:P0001, message:PROJECT_NOT_FOUND} to a typed PROJECT_NOT_FOUND error, never the raw Postgres error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "PROJECT_NOT_FOUND", code: "P0001", hint: "raw" },
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID]);

    expect(result).toEqual({ ok: false, error: { code: "PROJECT_NOT_FOUND" } });
    expect(result).not.toHaveProperty("error.hint");
  });

  it("fails closed with UNEXPECTED when the RPC returns malformed data", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: { unreadCount: 5 } },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID]);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when a requested project is missing from the result", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID, VALID_UUID_2]);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when an unrequested project appears in the result", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        [VALID_UUID]: validSummaryEntry(VALID_UUID),
        [VALID_UUID_2]: validSummaryEntry(VALID_UUID_2),
      },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID]);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when a non-empty request returns an empty {} object", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID]);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when a record key does not equal its entry's projectId", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID_2) },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID]);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });
});

function validCreateShareLinkDraftRpcData(overrides: Record<string, unknown> = {}) {
  return {
    linkId: VALID_UUID,
    publicId: VALID_PUBLIC_ID,
    state: "draft",
    createdAt: VALID_TIMESTAMP,
    ...overrides,
  };
}

describe("createShareLinkDraft", () => {
  it("calls create_share_link_draft with the canonical project id and a fresh candidate public id", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validCreateShareLinkDraftRpcData(),
      error: null,
    });
    const client = buildFakeClient(rpc);

    await createShareLinkDraft(client, VALID_UUID.toUpperCase());

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("create_share_link_draft", {
      p_project_id: VALID_UUID,
      p_public_id: VALID_PUBLIC_ID,
    });
  });

  it("returns parsed success data on a valid RPC response", async () => {
    const payload = validCreateShareLinkDraftRpcData();
    const rpc = vi.fn().mockResolvedValue({ data: payload, error: null });
    const client = buildFakeClient(rpc);

    const result = await createShareLinkDraft(client, VALID_UUID);

    expect(result).toEqual({ ok: true, data: payload });
  });

  it("retries once on an exact PUBLIC_ID_COLLISION, then succeeds, using a fresh public id on the retry", async () => {
    generateSharePublicIdMock
      .mockReturnValueOnce(VALID_PUBLIC_ID)
      .mockReturnValueOnce(VALID_PUBLIC_ID_2);

    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0001", message: "PUBLIC_ID_COLLISION" },
      })
      .mockResolvedValueOnce({
        data: validCreateShareLinkDraftRpcData({ publicId: VALID_PUBLIC_ID_2 }),
        error: null,
      });
    const client = buildFakeClient(rpc);

    const result = await createShareLinkDraft(client, VALID_UUID);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "create_share_link_draft", {
      p_project_id: VALID_UUID,
      p_public_id: VALID_PUBLIC_ID,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "create_share_link_draft", {
      p_project_id: VALID_UUID,
      p_public_id: VALID_PUBLIC_ID_2,
    });
    expect(result.ok).toBe(true);
  });

  it("retries twice on two exact PUBLIC_ID_COLLISIONs, then succeeds on the third attempt", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0001", message: "PUBLIC_ID_COLLISION" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0001", message: "PUBLIC_ID_COLLISION" },
      })
      .mockResolvedValueOnce({
        data: validCreateShareLinkDraftRpcData(),
        error: null,
      });
    const client = buildFakeClient(rpc);

    const result = await createShareLinkDraft(client, VALID_UUID);

    expect(rpc).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(true);
  });

  it("fails closed as UNEXPECTED after three consecutive PUBLIC_ID_COLLISIONs, never a fourth attempt", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "PUBLIC_ID_COLLISION" },
    });
    const client = buildFakeClient(rpc);

    const result = await createShareLinkDraft(client, VALID_UUID);

    expect(rpc).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("does not retry a non-collision error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "PROJECT_NOT_FOUND" },
    });
    const client = buildFakeClient(rpc);

    const result = await createShareLinkDraft(client, VALID_UUID);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, error: { code: "PROJECT_NOT_FOUND" } });
  });

  it("maps PROJECT_ARCHIVED to a typed error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "PROJECT_ARCHIVED" },
    });
    const client = buildFakeClient(rpc);

    const result = await createShareLinkDraft(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "PROJECT_ARCHIVED" } });
  });

  it("fails closed with UNEXPECTED when the RPC returns malformed data", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { linkId: VALID_UUID },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await createShareLinkDraft(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });
});

function validActivateShareLinkRpcData(overrides: Record<string, unknown> = {}) {
  return {
    linkId: VALID_UUID,
    publicId: VALID_PUBLIC_ID,
    state: "active",
    configurationVersion: 1,
    activatedAt: VALID_TIMESTAMP,
    ...overrides,
  };
}

describe("activateShareLink", () => {
  it("calls activate_share_link with the canonical link id, the exact hex digest the helper returned, and the encrypted material as hex", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validActivateShareLinkRpcData(),
      error: null,
    });
    const client = buildFakeClient(rpc);

    await activateShareLink(client, VALID_UUID.toUpperCase());

    expect(rpc).toHaveBeenCalledTimes(1);
    const material = validEncryptedMaterial();
    expect(rpc).toHaveBeenCalledWith("activate_share_link", {
      p_link_id: VALID_UUID,
      p_secret_digest: VALID_DIGEST_HEX,
      p_secret_digest_version: 1,
      p_ciphertext_hex: material.ciphertext.toString("hex"),
      p_nonce_hex: material.nonce.toString("hex"),
      p_auth_tag_hex: material.authTag.toString("hex"),
      p_encryption_version: 1,
    });
  });

  it("passes createShareSecretDigest's return value through unchanged -- no base64url-to-hex conversion of the digest happens in the repository", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validActivateShareLinkRpcData(),
      error: null,
    });
    const client = buildFakeClient(rpc);
    createShareSecretDigestMock.mockReturnValue(
      "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100".slice(0, 64)
    );

    await activateShareLink(client, VALID_UUID);

    const [, params] = rpc.mock.calls[0];
    expect((params as { p_secret_digest: string }).p_secret_digest).toBe(
      createShareSecretDigestMock.mock.results[0]?.value
    );
  });

  it("generates the secret and encrypts it bound to the canonical link id", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validActivateShareLinkRpcData(),
      error: null,
    });
    const client = buildFakeClient(rpc);

    await activateShareLink(client, VALID_UUID.toUpperCase());

    expect(createShareSecretDigestMock).toHaveBeenCalledWith(VALID_RAW_SECRET);
    expect(encryptShareSecretMock).toHaveBeenCalledWith(VALID_RAW_SECRET, VALID_UUID);
  });

  it("never sends the plaintext secret to the RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validActivateShareLinkRpcData(),
      error: null,
    });
    const client = buildFakeClient(rpc);

    await activateShareLink(client, VALID_UUID);

    const [, params] = rpc.mock.calls[0];
    const serializedParams = JSON.stringify(params);
    expect(serializedParams).not.toContain(VALID_RAW_SECRET);
  });

  it("returns the plaintext secret only in its own safe server result, attached to the RPC's safe data", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validActivateShareLinkRpcData(),
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await activateShareLink(client, VALID_UUID);

    expect(result).toEqual({
      ok: true,
      data: { ...validActivateShareLinkRpcData(), secret: VALID_RAW_SECRET },
    });
  });

  it("prevents the RPC call entirely when secret generation/digesting fails", async () => {
    createShareSecretDigestMock.mockImplementation(() => {
      throw new Error("hmac key missing");
    });
    const rpc = vi.fn();
    const client = buildFakeClient(rpc);

    const result = await activateShareLink(client, VALID_UUID);

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("prevents the RPC call entirely when encryption fails, and never leaks the internal error message", async () => {
    encryptShareSecretMock.mockImplementation(() => {
      throw new Error("encryption key wrong length -- SENSITIVE_INTERNAL_DETAIL");
    });
    const rpc = vi.fn();
    const client = buildFakeClient(rpc);

    const result = await activateShareLink(client, VALID_UUID);

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
    expect(JSON.stringify(result)).not.toContain("SENSITIVE_INTERNAL_DETAIL");
  });

  it("maps SHARE_LINK_NOT_FOUND to a typed error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "SHARE_LINK_NOT_FOUND" },
    });
    const client = buildFakeClient(rpc);

    const result = await activateShareLink(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } });
  });

  it("collapses SHARE_LINK_NOT_DRAFT into the shared SHARE_LINK_STATE_CONFLICT category", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "SHARE_LINK_NOT_DRAFT" },
    });
    const client = buildFakeClient(rpc);

    const result = await activateShareLink(client, VALID_UUID);

    expect(result).toEqual({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });
  });

  it("keeps SHARE_LINK_ANOTHER_LINK_ACTIVE as its own distinct category", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "SHARE_LINK_ANOTHER_LINK_ACTIVE" },
    });
    const client = buildFakeClient(rpc);

    const result = await activateShareLink(client, VALID_UUID);

    expect(result).toEqual({
      ok: false,
      error: { code: "SHARE_LINK_ANOTHER_LINK_ACTIVE" },
    });
  });

  it("maps an internal validation message (e.g. INVALID_NONCE) to UNEXPECTED, never surfacing it directly", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "INVALID_NONCE" },
    });
    const client = buildFakeClient(rpc);

    const result = await activateShareLink(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when the RPC returns malformed data", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { linkId: VALID_UUID },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await activateShareLink(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED if the RPC row unexpectedly contains a secret field", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validActivateShareLinkRpcData({ secret: VALID_RAW_SECRET }),
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await activateShareLink(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });
});

function validDisableShareLinkRpcData(overrides: Record<string, unknown> = {}) {
  return {
    linkId: VALID_UUID,
    state: "disabled",
    configurationVersion: 2,
    disabledAt: VALID_TIMESTAMP,
    ...overrides,
  };
}

describe("disableShareLink", () => {
  it("calls disable_share_link with the canonical link id", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validDisableShareLinkRpcData(),
      error: null,
    });
    const client = buildFakeClient(rpc);

    await disableShareLink(client, VALID_UUID.toUpperCase());

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("disable_share_link", {
      p_link_id: VALID_UUID,
    });
  });

  it("returns parsed success data on a valid RPC response", async () => {
    const payload = validDisableShareLinkRpcData();
    const rpc = vi.fn().mockResolvedValue({ data: payload, error: null });
    const client = buildFakeClient(rpc);

    const result = await disableShareLink(client, VALID_UUID);

    expect(result).toEqual({ ok: true, data: payload });
  });

  it("collapses SHARE_LINK_NOT_ACTIVE into SHARE_LINK_STATE_CONFLICT", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "SHARE_LINK_NOT_ACTIVE" },
    });
    const client = buildFakeClient(rpc);

    const result = await disableShareLink(client, VALID_UUID);

    expect(result).toEqual({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });
  });

  it("maps SHARE_LINK_NOT_FOUND to a typed error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "SHARE_LINK_NOT_FOUND" },
    });
    const client = buildFakeClient(rpc);

    const result = await disableShareLink(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } });
  });

  it("fails closed with UNEXPECTED when the RPC returns malformed data", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { state: "disabled" },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await disableShareLink(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });
});

function validReenableShareLinkRpcData(overrides: Record<string, unknown> = {}) {
  return {
    linkId: VALID_UUID,
    state: "active",
    configurationVersion: 3,
    activatedAt: VALID_TIMESTAMP,
    disabledAt: VALID_TIMESTAMP,
    ...overrides,
  };
}

describe("reenableShareLink", () => {
  it("calls reenable_share_link with the canonical link id", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validReenableShareLinkRpcData(),
      error: null,
    });
    const client = buildFakeClient(rpc);

    await reenableShareLink(client, VALID_UUID.toUpperCase());

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("reenable_share_link", {
      p_link_id: VALID_UUID,
    });
  });

  it("never generates or sends any secret material", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validReenableShareLinkRpcData(),
      error: null,
    });
    const client = buildFakeClient(rpc);

    await reenableShareLink(client, VALID_UUID);

    expect(generateRawShareSecretMock).not.toHaveBeenCalled();
    expect(createShareSecretDigestMock).not.toHaveBeenCalled();
    expect(encryptShareSecretMock).not.toHaveBeenCalled();
  });

  it("returns parsed success data on a valid RPC response", async () => {
    const payload = validReenableShareLinkRpcData();
    const rpc = vi.fn().mockResolvedValue({ data: payload, error: null });
    const client = buildFakeClient(rpc);

    const result = await reenableShareLink(client, VALID_UUID);

    expect(result).toEqual({ ok: true, data: payload });
  });

  it("collapses SHARE_LINK_NOT_DISABLED into SHARE_LINK_STATE_CONFLICT", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "SHARE_LINK_NOT_DISABLED" },
    });
    const client = buildFakeClient(rpc);

    const result = await reenableShareLink(client, VALID_UUID);

    expect(result).toEqual({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });
  });

  it("keeps SHARE_LINK_ANOTHER_LINK_ACTIVE as its own distinct category", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "SHARE_LINK_ANOTHER_LINK_ACTIVE" },
    });
    const client = buildFakeClient(rpc);

    const result = await reenableShareLink(client, VALID_UUID);

    expect(result).toEqual({
      ok: false,
      error: { code: "SHARE_LINK_ANOTHER_LINK_ACTIVE" },
    });
  });

  it("maps SHARE_LINK_SECRET_MATERIAL_MISSING to UNEXPECTED (an internal data-integrity anomaly, not owner-actionable)", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "SHARE_LINK_SECRET_MATERIAL_MISSING" },
    });
    const client = buildFakeClient(rpc);

    const result = await reenableShareLink(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when the RPC returns malformed data", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { linkId: VALID_UUID },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await reenableShareLink(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });
});

describe("share-links-repository.server.ts source constraints", () => {
  const source = readFileSync(
    path.join(__dirname, "share-links-repository.server.ts"),
    "utf8"
  );

  it("marks the module server-only", () => {
    expect(source).toContain('import "server-only"');
  });

  it("never imports or references the service-role admin client", () => {
    expect(source).not.toContain("supabaseAdmin");
    expect(source).not.toContain("lib/supabase/admin");
  });

  it("never performs a direct Supabase table query (.from(table)) -- Buffer.from is not a table query", () => {
    expect(source).not.toMatch(/(?<!Buffer)\.from\(/);
  });

  it("keeps exactly one digest representation -- no base64url-to-hex (or any other) digest conversion remains", () => {
    expect(source).not.toContain("base64UrlDigestToHex");
    expect(source).not.toMatch(/secretDigest[^;]*base64url/);
    expect(source).toContain("p_secret_digest: secretDigest,");
  });

  it("calls only the six sanctioned RPCs", () => {
    const rpcCalls = [...source.matchAll(/\.rpc\(\s*([A-Z0-9_]+|"[a-z_]+")/g)].map(
      (m) => m[1]
    );
    expect(rpcCalls).toHaveLength(6);
  });

  it("centralizes every RPC name as a named constant rather than an inline string literal at the call site", () => {
    expect(source).toContain(
      'const GET_SHARE_LINK_MANAGEMENT_STATE_RPC = "get_share_link_management_state";'
    );
    expect(source).toContain(
      'const LIST_SHARE_LINK_SUMMARIES_RPC = "list_share_link_summaries";'
    );
    expect(source).toContain(
      'const CREATE_SHARE_LINK_DRAFT_RPC = "create_share_link_draft";'
    );
    expect(source).toContain(
      'const ACTIVATE_SHARE_LINK_RPC = "activate_share_link";'
    );
    expect(source).toContain(
      'const DISABLE_SHARE_LINK_RPC = "disable_share_link";'
    );
    expect(source).toContain(
      'const REENABLE_SHARE_LINK_RPC = "reenable_share_link";'
    );
  });

  it("maps RPC errors by exact code and message, never by substring matching", () => {
    expect(source).not.toMatch(/message\.includes\(/);
    expect(source).not.toMatch(/message\.startsWith\(/);
    expect(source).not.toMatch(/message\.endsWith\(/);
    expect(source).toContain('error.code === RPC_ERROR_CODE && error.message === "UNAUTHORIZED"');
    expect(source).toContain(
      'error.code === RPC_ERROR_CODE && error.message === "PROJECT_NOT_FOUND"'
    );
  });
});
