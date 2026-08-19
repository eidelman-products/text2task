"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { OwnerShareMessage } from "@/lib/share/share-contracts";
import {
  ShareLinkClientError,
  getShareLinkMessages,
  sendShareMessageReply,
  setShareMessageStatus,
} from "./share-link-client";

/*
  Phase 5D -- the owner-side Client Communication data hook. Used TWICE,
  independently, by design (see the Phase 5D doc's own "unread strategy"
  section): once by ShareLinkPanel itself (enabled only while the panel
  is open and a link exists, for the "Client messages [unread]" badge),
  and once by ClientCommunicationHistoryModal (enabled only while that
  view is showing, for the full message list). Each instance owns its
  own isolated fetch -- a failure in one can never affect the other, and
  neither ever affects the Share panel's own core management request
  (Phase 5D's own "failure isolation" rule). No polling: each instance
  fetches once when `enabled` transitions to true, never on an interval.
*/

export type OwnerShareMessagesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; messages: OwnerShareMessage[]; unreadCount: number }
  | { status: "error"; error: string };

export type OwnerShareMessageMutationState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "error"; error: string };

const GENERIC_LOAD_ERROR = "Client messages could not be loaded right now.";

function friendlyMutationError(error: unknown): string {
  if (error instanceof ShareLinkClientError) {
    switch (error.code) {
      case "SHARE_MESSAGE_PARENT_NOT_FOUND":
        return "That message could not be found. Refresh and try again.";
      case "SHARE_MESSAGE_PARENT_LINK_MISMATCH":
        return "That message does not belong to this share link.";
      case "SHARE_MESSAGE_NOT_FOUND":
        return "That message could not be found. Refresh and try again.";
      case "SHARE_MESSAGE_STATUS_INVALID":
        return "That status is not valid.";
      case "UNAUTHENTICATED":
        return "You are not signed in. Please refresh and try again.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}

export function useOwnerShareMessages(shareLinkId: string | null, enabled: boolean) {
  const [state, setState] = useState<OwnerShareMessagesState>({ status: "idle" });
  const [mutation, setMutation] = useState<OwnerShareMessageMutationState>({ status: "idle" });

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    if (!shareLinkId) {
      setState({ status: "idle" });
      return;
    }

    const requestId = ++requestIdRef.current;
    setState((current) => (current.status === "loaded" ? current : { status: "loading" }));

    try {
      const data = await getShareLinkMessages(shareLinkId);
      if (requestIdRef.current !== requestId || !isMountedRef.current) return;
      setState({ status: "loaded", messages: data.messages, unreadCount: data.unreadCount });
    } catch {
      if (requestIdRef.current !== requestId || !isMountedRef.current) return;
      setState({ status: "error", error: GENERIC_LOAD_ERROR });
    }
  }, [shareLinkId]);

  useEffect(() => {
    if (!enabled || !shareLinkId) {
      return;
    }
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, shareLinkId]);

  const reply = useCallback(
    async (parentMessageId: string, body: string): Promise<boolean> => {
      if (!shareLinkId) return false;

      setMutation({ status: "pending" });
      try {
        await sendShareMessageReply(shareLinkId, { parentMessageId, body });
        if (isMountedRef.current) setMutation({ status: "idle" });
        await refetch();
        return true;
      } catch (error) {
        if (isMountedRef.current) setMutation({ status: "error", error: friendlyMutationError(error) });
        return false;
      }
    },
    [shareLinkId, refetch]
  );

  const updateStatus = useCallback(
    async (
      messageId: string,
      status: "new" | "reviewed" | "resolved" | "dismissed"
    ): Promise<boolean> => {
      if (!shareLinkId) return false;

      setMutation({ status: "pending" });
      try {
        await setShareMessageStatus(shareLinkId, messageId, status);
        if (isMountedRef.current) setMutation({ status: "idle" });
        await refetch();
        return true;
      } catch (error) {
        if (isMountedRef.current) setMutation({ status: "error", error: friendlyMutationError(error) });
        return false;
      }
    },
    [shareLinkId, refetch]
  );

  return { state, mutation, refetch, reply, updateStatus };
}
