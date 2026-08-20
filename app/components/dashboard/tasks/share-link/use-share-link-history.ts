"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getMostRecentShareLink } from "./share-link-client";

/*
  PHASE 5F REAL PREVIEW DEFECT FIX -- resolves whether a project has a
  historical (typically revoked) share link whose Client Communication
  History remains reachable, for the exact case
  `get_share_link_management_state` cannot answer: it deliberately
  excludes revoked links from what it calls "managed" (correct for its
  own "what can I activate/reconfigure" purpose), which previously left
  the owner with no way at all to reopen Client Communication History
  once their only link was revoked.

  Deliberately its own small, isolated hook -- mirrors
  useOwnerShareMessages's own isolation rationale exactly: a failure
  here must never affect the Share panel's core management state, and
  this is fetched only as a fallback (`enabled` should be
  `!managedLink && state.isOpen`), never on an interval.
*/

export type ShareLinkHistoryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; linkId: string | null; state: string | null }
  | { status: "error" };

export function useShareLinkHistory(projectId: string | null, enabled: boolean) {
  const [state, setState] = useState<ShareLinkHistoryState>({ status: "idle" });
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    if (!projectId) {
      setState({ status: "idle" });
      return;
    }

    const requestId = ++requestIdRef.current;
    setState({ status: "loading" });

    try {
      const data = await getMostRecentShareLink(projectId);
      if (requestIdRef.current !== requestId || !isMountedRef.current) return;
      setState({ status: "loaded", linkId: data.linkId, state: data.state });
    } catch {
      if (requestIdRef.current !== requestId || !isMountedRef.current) return;
      // Fails closed to "no history entry point" rather than throwing --
      // this hook's own failure must never break the rest of the Share
      // panel. There is nothing user-correctable to surface for a read
      // this incidental to the panel's primary purpose.
      setState({ status: "error" });
    }
  }, [projectId]);

  useEffect(() => {
    if (!enabled || !projectId) {
      return;
    }
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId]);

  return { state, refetch };
}
