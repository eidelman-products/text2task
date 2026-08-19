import {
  shareLinkManagementStateResponseSchema,
  createShareLinkDraftResponseSchema,
  activateShareLinkResponseSchema,
  disableShareLinkResponseSchema,
  reenableShareLinkResponseSchema,
  revokeShareLinkResponseSchema,
  revealShareLinkSecretResponseSchema,
  saveShareConfigurationResponseSchema,
  setSharePinResponseSchema,
  clearSharePinResponseSchema,
  setShareLinkExpiryResponseSchema,
  clearShareLinkExpiryResponseSchema,
  rotateShareLinkSecretResponseSchema,
  getShareLinkMessagesResponseSchema,
  sendShareMessageReplyResponseSchema,
  setShareMessageStatusResponseSchema,
  type ShareLinkApiErrorCode,
  type GetShareLinkMessagesData,
  type SendShareMessageReplyData,
  type SetShareMessageStatusData,
  type ShareLinkManagementStateData,
  type CreateShareLinkDraftData,
  type ActivateShareLinkData,
  type DisableShareLinkData,
  type ReenableShareLinkData,
  type RevokeShareLinkData,
  type RevealShareLinkSecretData,
  type SaveShareConfigurationRequest,
  type SaveShareConfigurationData,
  type SetSharePinData,
  type ClearSharePinData,
  type SetShareLinkExpiryData,
  type ClearShareLinkExpiryData,
  type RotateShareLinkSecretData,
} from "@/lib/share/share-contracts";
import {
  previewShareLinkResponseSchema,
  type ClientProjectProjection,
} from "@/lib/share/client-share-projection-contracts";

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

/**
 * Phase 2C owner access-control operations. `pin`/`expiresAt` are sent
 * exactly as the owner supplied them (already validated client-side
 * against the same canonical schemas the route itself uses) -- this
 * module performs no PIN hashing or timestamp reformatting of its own;
 * the server remains the sole authority for both.
 */
export function setSharePin(linkId: string, pin: string): Promise<SetSharePinData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/pin`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    },
    setSharePinResponseSchema
  );
}

export function clearSharePin(linkId: string): Promise<ClearSharePinData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/pin`,
    { method: "DELETE" },
    clearSharePinResponseSchema
  );
}

export function setShareLinkExpiry(
  linkId: string,
  expiresAt: string
): Promise<SetShareLinkExpiryData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/expiry`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresAt }),
    },
    setShareLinkExpiryResponseSchema
  );
}

export function clearShareLinkExpiry(linkId: string): Promise<ClearShareLinkExpiryData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/expiry`,
    { method: "DELETE" },
    clearShareLinkExpiryResponseSchema
  );
}

/**
 * Rotation's own success response includes a freshly generated plaintext
 * secret (mirroring activateShareLink's response shape) -- this wrapper
 * returns it exactly once to its caller and stores nothing itself. The
 * caller (useShareLink's `rotate` action) discards it without ever
 * assigning it to any persisted state, matching this feature's
 * secret-handling discipline throughout.
 */
export function rotateShareLinkSecret(linkId: string): Promise<RotateShareLinkSecretData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/rotate`,
    { method: "POST" },
    rotateShareLinkSecretResponseSchema
  );
}

/**
 * Phase 2D owner Preview. Returns only the strict client-facing
 * projection -- no secret, no full URL, no owner management fields.
 * This call never reveals the share secret and never mutates
 * view_count/last_viewed_at (see the route's own doc comment).
 */
export function previewShareLink(linkId: string): Promise<ClientProjectProjection> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/preview`,
    undefined,
    previewShareLinkResponseSchema
  );
}

/**
 * Phase 5D -- owner Client Communication History. `getShareLinkMessages`
 * is a plain read (chronological messages + unreadCount, both directions,
 * every workflow status); `sendShareMessageReply` and
 * `setShareMessageStatus` are the two owner-write actions, each going
 * through their own already-existing API route
 * (`app/api/share-links/[id]/messages/**`), which themselves call the
 * narrow Phase 5A RPCs -- this module performs no DB access of its own,
 * exactly like every other function in this file.
 */
export function getShareLinkMessages(linkId: string): Promise<GetShareLinkMessagesData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/messages`,
    undefined,
    getShareLinkMessagesResponseSchema
  );
}

export function sendShareMessageReply(
  linkId: string,
  input: { parentMessageId: string; body: string }
): Promise<SendShareMessageReplyData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/messages/reply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    sendShareMessageReplyResponseSchema
  );
}

export function setShareMessageStatus(
  linkId: string,
  messageId: string,
  status: "new" | "reviewed" | "resolved" | "dismissed"
): Promise<SetShareMessageStatusData> {
  return requestShareLink(
    `/api/share-links/${encodeURIComponent(linkId)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
    setShareMessageStatusResponseSchema
  );
}
