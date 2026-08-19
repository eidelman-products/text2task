"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
  Phase 5D -- the smallest dedicated public-message state/hook needed by
  PublicMessagesSection, following the exact fetch conventions
  share-view.client.tsx already established for this same public route
  (credentials: "same-origin", cache: "no-store", GET/POST against
  /api/share/[publicId]/messages, safeJson never throwing). Deliberately
  NOT part of ShareView's own state machine -- a Messages fetch/send
  failure must never affect the projection/tasks/resources view (Phase
  5D's own "failure isolation" rule), so this hook owns its own isolated
  loading/error state entirely.

  No polling: history is fetched once when `enabled` becomes true (i.e.
  once commentsEnabled is known true) and re-fetched only after a
  successful send.
*/

export type PublicShareMessage = Readonly<{
  authorType: "client" | "owner";
  authorDisplayName: string | null;
  body: string;
  createdAt: string;
}>;

export type PublicShareMessageHistoryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; messages: PublicShareMessage[] }
  | { status: "error"; error: string };

export type PublicShareMessageSendState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "error"; error: string };

export type SubmitPublicShareMessageInput = Readonly<{
  body: string;
  authorDisplayName?: string;
}>;

export type SubmitPublicShareMessageResult =
  | { ok: true }
  | { ok: false; code: string; error: string };

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const GENERIC_LOAD_ERROR = "Messages could not be loaded right now.";
const GENERIC_SEND_ERROR = "Something went wrong sending your message. Please try again.";

const SEND_ERROR_MESSAGES: Record<string, string> = {
  SHARE_MESSAGE_BODY_EMPTY: "Enter a message.",
  SHARE_MESSAGE_BODY_TOO_LONG: "Message must be 4,000 characters or fewer.",
  SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG: "Name must be 80 characters or fewer.",
  INVALID_REQUEST: "Enter a message.",
  UNAVAILABLE: "Messages are not available right now.",
  RATE_LIMITED: "Too many messages sent. Please wait a moment and try again.",
};

function mapSendErrorMessage(code: string | undefined): string {
  if (!code) return GENERIC_SEND_ERROR;
  return SEND_ERROR_MESSAGES[code] ?? GENERIC_SEND_ERROR;
}

export function usePublicShareMessages(publicId: string, enabled: boolean) {
  const [history, setHistory] = useState<PublicShareMessageHistoryState>({ status: "idle" });
  const [send, setSend] = useState<PublicShareMessageSendState>({ status: "idle" });

  const isMountedRef = useRef(true);
  // Monotonically increasing request id -- a fetch resolving after a
  // newer one has already started is discarded, so a slow first
  // response can never overwrite a fresher refetch's result.
  const requestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setHistory((current) => (current.status === "loaded" ? current : { status: "loading" }));

    try {
      const response = await fetch(`/api/share/${encodeURIComponent(publicId)}/messages`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
      });

      const body = (await safeJson(response)) as
        | { ok: true; data: { messages: PublicShareMessage[] } }
        | { ok: false; code: string; error: string }
        | null;

      if (requestIdRef.current !== requestId || !isMountedRef.current) return;

      if (response.ok && body && body.ok) {
        setHistory({ status: "loaded", messages: body.data.messages });
        return;
      }

      setHistory({ status: "error", error: GENERIC_LOAD_ERROR });
    } catch {
      if (requestIdRef.current !== requestId || !isMountedRef.current) return;
      setHistory({ status: "error", error: GENERIC_LOAD_ERROR });
    }
  }, [publicId]);

  useEffect(() => {
    if (!enabled) {
      setHistory({ status: "idle" });
      return;
    }
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, publicId]);

  const submit = useCallback(
    async (input: SubmitPublicShareMessageInput): Promise<SubmitPublicShareMessageResult> => {
      if (isMountedRef.current) setSend({ status: "pending" });

      const requestBody =
        input.authorDisplayName !== undefined && input.authorDisplayName.length > 0
          ? { body: input.body, authorDisplayName: input.authorDisplayName }
          : { body: input.body };

      try {
        const response = await fetch(`/api/share/${encodeURIComponent(publicId)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(requestBody),
        });

        const body = (await safeJson(response)) as
          | { ok: true }
          | { ok: false; code: string; error: string }
          | null;

        if (response.ok && body && body.ok) {
          if (isMountedRef.current) setSend({ status: "idle" });
          await refetch();
          return { ok: true };
        }

        const code =
          response.status === 429 ? "RATE_LIMITED" : body && !body.ok ? body.code : undefined;
        const message = mapSendErrorMessage(code);
        if (isMountedRef.current) setSend({ status: "error", error: message });
        return { ok: false, code: code ?? "UNKNOWN", error: message };
      } catch {
        if (isMountedRef.current) setSend({ status: "error", error: GENERIC_SEND_ERROR });
        return { ok: false, code: "NETWORK_ERROR", error: GENERIC_SEND_ERROR };
      }
    },
    [publicId, refetch]
  );

  return { history, send, refetch, submit };
}
