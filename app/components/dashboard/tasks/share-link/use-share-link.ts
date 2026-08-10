import { useCallback, useRef, useState } from "react";

import type { ShareLinkManagementStateData } from "@/lib/share/share-contracts";
import type { TaskProjectGroup } from "../task-types";
import {
  ShareLinkClientError,
  activateShareLink as activateShareLinkRequest,
  createShareLinkDraft as createShareLinkDraftRequest,
  disableShareLink as disableShareLinkRequest,
  getShareLinkManagementState,
  reenableShareLink as reenableShareLinkRequest,
  revealShareLinkSecret as revealShareLinkSecretRequest,
  revokeShareLink as revokeShareLinkRequest,
} from "./share-link-client";

/*
  Owner-facing Client Share management state, mirroring
  use-project-update-history.ts's shape: one state object, a project-id
  resolver duplicated from tasks-view.tsx's own getResolvedProjectId (the
  same existing pattern that file's sibling hooks already use), and
  callback actions that always re-fetch the authoritative management state
  after a mutation rather than trusting an optimistic local update -- the
  RPC/repository layer remains the single source of truth for lifecycle
  state (Phase 2A mapping summary section 6: "must never treat local
  selection state as equivalent to durable authorization").
*/

export type ShareLinkActionKind =
  | "createDraft"
  | "activate"
  | "disable"
  | "reenable"
  | "revoke"
  | "copyLink";

export type ShareLinkPanelState = {
  isOpen: boolean;
  project: TaskProjectGroup | null;
  projectId: string | null;
  isLoading: boolean;
  loadError: string | null;
  data: ShareLinkManagementStateData | null;
  actionPending: ShareLinkActionKind | null;
  actionError: string | null;
  copyStatus: "idle" | "copied" | "failed";
};

const INITIAL_STATE: ShareLinkPanelState = {
  isOpen: false,
  project: null,
  projectId: null,
  isLoading: false,
  loadError: null,
  data: null,
  actionPending: null,
  actionError: null,
  copyStatus: "idle",
};

export function getShareLinkProjectId(
  project: TaskProjectGroup | null
): string | null {
  if (!project) return null;

  const directProjectId =
    project.project_id ||
    project.project?.id ||
    project.primaryTask?.project_id ||
    project.primaryTask?.project?.id ||
    project.tasks.find((task) => task.project_id)?.project_id ||
    project.tasks.find((task) => task.project?.id)?.project?.id ||
    "";

  if (directProjectId) return directProjectId;

  const cleaned = String(project.key || "").trim();

  if (cleaned.startsWith("project::")) {
    return cleaned.replace("project::", "").trim() || null;
  }

  if (cleaned.startsWith("project:")) {
    return cleaned.replace("project:", "").trim() || null;
  }

  return null;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ShareLinkClientError) {
    switch (error.code) {
      case "UNAUTHENTICATED":
        return "You need to be signed in to manage this share link.";
      case "PROJECT_NOT_FOUND":
        return "Text2Task could not find this project. Refresh the dashboard and try again.";
      case "PROJECT_ARCHIVED":
        return "This project is archived.";
      case "SHARE_LINK_NOT_FOUND":
        return "This share link no longer exists. Refresh and try again.";
      case "SHARE_LINK_STATE_CONFLICT":
        return "This action is not available for the share link's current state.";
      case "SHARE_LINK_ANOTHER_LINK_ACTIVE":
        return "Another share link for this project is already active.";
      case "SHARE_LINK_SECRET_UNAVAILABLE":
        return "The share link secret could not be retrieved. Try rotating the link.";
      case "NOT_FOUND":
        return "Client sharing is not available right now.";
      default:
        return fallback;
    }
  }

  return fallback;
}

export function useShareLink() {
  const [state, setState] = useState<ShareLinkPanelState>(INITIAL_STATE);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Ref mirrors of state, kept current on every render, so the
  // useCallback-memoized action functions below always read the latest
  // projectId/linkId without needing `state` in their own dependency
  // arrays (which would otherwise force a new function identity, and a
  // new ResponsiveDialog `initialFocusRef`/handler prop, on every state
  // change).
  const latestProjectIdRef = useRef<string | null>(null);
  latestProjectIdRef.current = state.projectId;

  const latestLinkIdRef = useRef<string | null>(null);
  latestLinkIdRef.current = state.data?.link?.id ?? null;

  // Synchronous reentrancy guard for runAction, mirroring the existing
  // pendingProjectActionRef pattern in tasks-view.tsx's runProjectAction:
  // the `actionPending` *state* value alone cannot prevent a second click
  // fired in the same event-loop tick (before React has re-rendered the
  // disabled button), so a plain ref is checked synchronously instead.
  const actionInFlightRef = useRef(false);

  const loadManagementState = useCallback(async (projectId: string) => {
    setState((current) => ({ ...current, isLoading: true, loadError: null }));

    try {
      const data = await getShareLinkManagementState(projectId);

      setState((current) =>
        current.projectId === projectId
          ? { ...current, isLoading: false, loadError: null, data }
          : current
      );
    } catch (error) {
      setState((current) =>
        current.projectId === projectId
          ? {
              ...current,
              isLoading: false,
              loadError: describeError(
                error,
                "Could not load this share link. Please try again."
              ),
            }
          : current
      );
    }
  }, []);

  const openPanel = useCallback(
    (project: TaskProjectGroup) => {
      const projectId = getShareLinkProjectId(project);

      const activeElement =
        typeof document !== "undefined" ? document.activeElement : null;
      triggerRef.current =
        activeElement instanceof HTMLElement && activeElement !== document.body
          ? activeElement
          : null;

      // A fresh panel session must never stay blocked by a still-in-flight
      // action's guard from whatever was open previously -- that prior
      // action's own eventual completion is harmless either way (its
      // state-write is guarded by loadManagementState's own
      // current.projectId check), it just must not hold this guard open
      // for the new session.
      actionInFlightRef.current = false;

      if (!projectId) {
        setState({
          ...INITIAL_STATE,
          isOpen: true,
          project,
          loadError: "This project needs a saved project id before it can be shared.",
        });
        return;
      }

      setState({
        ...INITIAL_STATE,
        isOpen: true,
        project,
        projectId,
        isLoading: true,
      });

      void loadManagementState(projectId);
    },
    [loadManagementState]
  );

  const closePanel = useCallback(() => {
    actionInFlightRef.current = false;
    setState(INITIAL_STATE);
  }, []);

  const refresh = useCallback(() => {
    const projectId = latestProjectIdRef.current;
    if (projectId) {
      void loadManagementState(projectId);
    }
  }, [loadManagementState]);

  const runAction = useCallback(
    async (kind: ShareLinkActionKind, run: () => Promise<void>) => {
      if (actionInFlightRef.current) return;
      actionInFlightRef.current = true;

      setState((current) => ({
        ...current,
        actionPending: kind,
        actionError: null,
      }));

      try {
        await run();
      } catch (error) {
        actionInFlightRef.current = false;
        setState((current) => ({
          ...current,
          actionPending: null,
          actionError: describeError(error, "That action could not be completed."),
        }));
        return;
      }

      actionInFlightRef.current = false;
      setState((current) => ({ ...current, actionPending: null }));

      const projectId = latestProjectIdRef.current;
      if (projectId) {
        void loadManagementState(projectId);
      }
    },
    [loadManagementState]
  );

  const createDraft = useCallback(() => {
    return runAction("createDraft", async () => {
      const projectId = latestProjectIdRef.current;
      if (!projectId) throw new Error("Missing project id.");
      await createShareLinkDraftRequest(projectId);
    });
  }, [runAction]);

  const activate = useCallback(() => {
    return runAction("activate", async () => {
      const linkId = latestLinkIdRef.current;
      if (!linkId) throw new Error("Missing share link id.");
      await activateShareLinkRequest(linkId);
    });
  }, [runAction]);

  const disable = useCallback(() => {
    return runAction("disable", async () => {
      const linkId = latestLinkIdRef.current;
      if (!linkId) throw new Error("Missing share link id.");
      await disableShareLinkRequest(linkId);
    });
  }, [runAction]);

  const reenable = useCallback(() => {
    return runAction("reenable", async () => {
      const linkId = latestLinkIdRef.current;
      if (!linkId) throw new Error("Missing share link id.");
      await reenableShareLinkRequest(linkId);
    });
  }, [runAction]);

  const revoke = useCallback(() => {
    return runAction("revoke", async () => {
      const linkId = latestLinkIdRef.current;
      if (!linkId) throw new Error("Missing share link id.");
      await revokeShareLinkRequest(linkId);
    });
  }, [runAction]);

  /*
    Copy Link never stores the plaintext secret or the full URL in React
    state -- it is built and handed to the Clipboard API entirely inside
    this function-scoped closure, then discarded. copyStatus (idle/copied/
    failed) is the only thing persisted, and it carries no secret material.
  */
  const copyLink = useCallback(() => {
    return runAction("copyLink", async () => {
      const linkId = latestLinkIdRef.current;
      if (!linkId) throw new Error("Missing share link id.");

      const revealed = await revealShareLinkSecretRequest(linkId);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/share/${revealed.publicId}#${revealed.secret}`;

      try {
        await navigator.clipboard.writeText(url);
        setState((current) => ({ ...current, copyStatus: "copied" }));
      } catch {
        setState((current) => ({ ...current, copyStatus: "failed" }));
        throw new Error("Could not copy the link to your clipboard.");
      }
    });
  }, [runAction]);

  return {
    state,
    triggerRef,
    openPanel,
    closePanel,
    refresh,
    createDraft,
    activate,
    disable,
    reenable,
    revoke,
    copyLink,
  };
}
