import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ShareLinkClientError,
  activateShareLink,
  createShareLinkDraft,
  disableShareLink,
  getShareLinkManagementState,
  reenableShareLink,
  revealShareLinkSecret,
  revokeShareLink,
} from "./share-link-client";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getShareLinkManagementState", () => {
  it("returns the parsed data on a successful no-link response", async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        ok: true,
        data: { link: null, mappedTaskIds: [], mappedResourceIds: [], currentUpdate: null },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await getShareLinkManagementState(VALID_UUID);

    expect(data.link).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/share-links?projectId=${VALID_UUID}`,
      undefined
    );
  });

  it("throws ShareLinkClientError with the server's error code on a failure response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        jsonResponse({ ok: false, code: "UNAUTHENTICATED", error: "Unauthorized." }, 401)
      )
    );

    await expect(getShareLinkManagementState(VALID_UUID)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws UNEXPECTED_RESPONSE when the response does not match the contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(jsonResponse({ nonsense: true })));

    await expect(getShareLinkManagementState(VALID_UUID)).rejects.toMatchObject({
      code: "UNEXPECTED_RESPONSE",
    });
  });

  it("throws NETWORK_ERROR when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

    await expect(getShareLinkManagementState(VALID_UUID)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("is an instance of ShareLinkClientError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(jsonResponse({ ok: false, code: "NOT_FOUND", error: "x" }, 404))
    );

    try {
      await getShareLinkManagementState(VALID_UUID);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ShareLinkClientError);
    }
  });
});

describe("createShareLinkDraft", () => {
  it("POSTs the projectId and returns the created draft", async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        ok: true,
        data: { linkId: VALID_UUID, publicId: "abcdefgh12345678", state: "draft", createdAt: "2026-08-10T00:00:00Z" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await createShareLinkDraft(VALID_UUID);

    expect(data.state).toBe("draft");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/share-links");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ projectId: VALID_UUID });
  });
});

describe("activateShareLink / disableShareLink / reenableShareLink / revokeShareLink", () => {
  it("activateShareLink POSTs to the activate route", async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        ok: true,
        data: {
          linkId: VALID_UUID,
          publicId: "abcdefgh12345678",
          state: "active",
          configurationVersion: 1,
          activatedAt: "2026-08-10T00:00:00Z",
          secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await activateShareLink(VALID_UUID);

    expect(data.state).toBe("active");
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/share-links/${VALID_UUID}/activate`,
      { method: "POST" }
    );
  });

  it("disableShareLink POSTs to the disable route", async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        ok: true,
        data: { linkId: VALID_UUID, state: "disabled", configurationVersion: 2, disabledAt: "2026-08-10T00:00:00Z" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await disableShareLink(VALID_UUID);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/share-links/${VALID_UUID}/disable`,
      { method: "POST" }
    );
  });

  it("reenableShareLink POSTs to the enable route", async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        ok: true,
        data: {
          linkId: VALID_UUID,
          state: "active",
          configurationVersion: 3,
          activatedAt: "2026-08-10T00:00:00Z",
          disabledAt: "2026-08-10T00:00:00Z",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await reenableShareLink(VALID_UUID);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/share-links/${VALID_UUID}/enable`,
      { method: "POST" }
    );
  });

  it("revokeShareLink POSTs to the revoke route", async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        ok: true,
        data: { linkId: VALID_UUID, state: "revoked", configurationVersion: 4, revokedAt: "2026-08-10T00:00:00Z" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await revokeShareLink(VALID_UUID);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/share-links/${VALID_UUID}/revoke`,
      { method: "POST" }
    );
  });
});

describe("revealShareLinkSecret", () => {
  it("returns the plaintext secret and publicId only -- never ciphertext/nonce/authTag", async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        ok: true,
        data: {
          linkId: VALID_UUID,
          publicId: "abcdefgh12345678ijklmnop",
          secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await revealShareLinkSecret(VALID_UUID);

    expect(data).toEqual({
      linkId: VALID_UUID,
      publicId: "abcdefgh12345678ijklmnop",
      secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/share-links/${VALID_UUID}/reveal`,
      { method: "POST" }
    );
  });

  it("rejects a response schema carrying extra/unexpected secret-adjacent fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        jsonResponse({
          ok: true,
          data: {
            linkId: VALID_UUID,
            publicId: "abcdefgh12345678ijklmnop",
            secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
            ciphertextHex: "should-not-be-here",
          },
        })
      )
    );

    await expect(revealShareLinkSecret(VALID_UUID)).rejects.toMatchObject({
      code: "UNEXPECTED_RESPONSE",
    });
  });
});
