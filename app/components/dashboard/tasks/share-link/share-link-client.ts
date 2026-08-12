import {
  shareLinkManagementStateResponseSchema,
  createShareLinkDraftResponseSchema,
  activateShareLinkResponseSchema,
  disableShareLinkResponseSchema,
  reenableShareLinkResponseSchema,
  revokeShareLinkResponseSchema,
  revealShareLinkSecretResponseSchema,
  saveShareConfigurationResponseSchema,
  type ShareLinkApiErrorCode,
  type ShareLinkManagementStateData,
  type CreateShareLinkDraftData,
  type ActivateShareLinkData,
  type DisableShareLinkData,
  type ReenableShareLinkData,
  type RevokeShareLinkData,
  type RevealShareLinkSecretData,
  type SaveShareConfigurationRequest,
  type SaveShareConfigurationData,
} from "@/lib/share/share-contracts";

/**
 * Client-side fetch wrappers for the Phase 2A owner operations only
 * (management-state read, draft creation, activate, disable, re-enable,
 * revoke, reveal). Mirrors resource-api.ts's plain-fetch convention --
 * this feature does not need a heavier client library. Every response is
 * re-validated through the same zod schemas the server already uses, so a
 * malformed or unexpected response never silently reaches the UI as if it
 * were well-formed data.
 */
export class ShareLinkClientError extends Error {
  code: ShareLinkApiErrorCode | "UNEXPECTED_RESPONSE" | "NETWORK_ERROR";

  constructor(code: ShareLinkApiErrorCode | "UNEXPECTED_RESPONSE" | "NETWORK_ERROR", message: string) {
    super(message);
    this.name = "ShareLinkClientError";
    this.code = code;
  }
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function requestShareLink<T>(
  input: string,
  init: RequestInit | undefined,
  responseSchema: { safeParse: (value: unknown) => { success: boolean; data?: { ok: boolean; data?: T; code?: ShareLinkApiErrorCode; error?: string } } }
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(input, init);
  } catch {
    throw new ShareLinkClientError("NETWORK_ERROR", "Could not reach the server.");
  }

  const json = await readJson(res);
  const parsed = responseSchema.safeParse(json);

  if (!parsed.success || !parsed.data) {
    throw new ShareLinkClientError(
      "UNEXPECTED_RESPONSE",
      "The server returned an unexpected response."
    );
  }

  if (!parsed.data.ok) {
    throw new ShareLinkClientError(
      parsed.data.code ?? "UNEXPECTED_RESPONSE",
      parsed.data.error ?? "Request failed."
    );
  }

  return parsed.data.data as T;
}

export function getShareLinkManagementState(
  projectId: string
): Promise<ShareLinkManagementStateData> {
  return requestShareLink(
    `/api/share-links?projectId=${encodeURIComponent(projectId)}`,
    undefined,
    shareLinkManagementStateResponseSchema
  );
}

export function createShareLinkDraft(
  projectId: string
): Promise<CreateShareLinkDraftData> {
  return requestShareLink(
    "/api/share-links",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    },
    createShareLinkDraftResponseSchema
  );
}

export function activateShareLink(linkId: string): Promise<ActivateShareLinkData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/activate`,
    { method: "POST" },
    activateShareLinkResponseSchema
  );
}

export function disableShareLink(linkId: string): Promise<DisableShareLinkData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/disable`,
    { method: "POST" },
    disableShareLinkResponseSchema
  );
}

export function reenableShareLink(linkId: string): Promise<ReenableShareLinkData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/enable`,
    { method: "POST" },
    reenableShareLinkResponseSchema
  );
}

export function revokeShareLink(linkId: string): Promise<RevokeShareLinkData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/revoke`,
    { method: "POST" },
    revokeShareLinkResponseSchema
  );
}

export function revealShareLinkSecret(
  linkId: string
): Promise<RevealShareLinkSecretData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/reveal`,
    { method: "POST" },
    revealShareLinkSecretResponseSchema
  );
}

export function saveShareConfiguration(
  linkId: string,
  request: SaveShareConfigurationRequest
): Promise<SaveShareConfigurationData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/config`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    saveShareConfigurationResponseSchema
  );
}
