import { useCallback, useRef, useState } from "react";

import type {
  SaveShareConfigurationRequest,
  ShareLinkManagementStateData,
} from "@/lib/share/share-contracts";
import type { TaskProjectGroup } from "../task-types";
import { fetchTaskResources, type TaskResource } from "../../resources/resource-api";
import {
  ShareLinkClientError,
  activateShareLink as activateShareLinkRequest,
  clearShareLinkExpiry as clearShareLinkExpiryRequest,
  clearSharePin as clearSharePinRequest,
  createShareLinkDraft as createShareLinkDraftRequest,
  disableShareLink as disableShareLinkRequest,
  getShareLinkManagementState,
  reenableShareLink as reenableShareLinkRequest,
  revealShareLinkSecret as revealShareLinkSecretRequest,
  revokeShareLink as revokeShareLinkRequest,
  rotateShareLinkSecret as rotateShareLinkSecretRequest,
  saveShareConfiguration as saveShareConfigurationRequest,
  setShareLinkExpiry as setShareLinkExpiryRequest,
  setSharePin as setSharePinRequest,
} from "./share-link-client";

/**
 * Reveals the current share secret and builds the ephemeral client URL
 * entirely within this function's own local scope. The URL is returned
 * to the caller and must be used and discarded immediately -- never
 * assigned to any component or hook state. Shared by copyLink,
 * nativeShare and whatsapp below so the reveal + URL-construction logic
 * exists in exactly one place, per the "one small internal action
 * helper" guidance -- it never returns/stores the URL in hook state
 * itself, only hands it back to its own immediate caller.
 */
async function revealEphemeralShareUrl(linkId: string): Promise<string> {
  const revealed = await revealShareLinkSecretRequest(linkId);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/share/${revealed.publicId}#${revealed.secret}`;
}

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
  | "copyLink"
  | "saveConfiguration"
  | "setPin"
  | "clearPin"
  | "setExpiry"
  | "clearExpiry"
  | "rotate"
  | "nativeShare"
  | "whatsapp";

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
  // Project-level Resources available to select for sharing (Phase 2B).
  // Loaded once when the panel opens, alongside the management-state
  // read -- never re-fetched after a configuration save, since saving a
  // share configuration never creates/deletes a Resource, only its
  // share-mapping. Mirrors ResourceManagerModal's own existing
  // project-level (task_id: null) read scope exactly -- no new Resource
  // read path was introduced.
  resources: TaskResource[];
  resourcesLoading: boolean;
  resourcesError: string | null;
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
  resources: [],
  resourcesLoading: false,
  resourcesError: null,
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
      case "INVALID_REQUEST":
        return "That value was not valid. Please check and try again.";
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

  const loadResources = useCallback(async (projectId: string) => {
    setState((current) => ({
      ...current,
      resourcesLoading: true,
      resourcesError: null,
    }));

    try {
      const resources = await fetchTaskResources({ project_id: projectId });

      setState((current) =>
        current.projectId === projectId
          ? { ...current, resourcesLoading: false, resourcesError: null, resources }
          : current
      );
    } catch {
      setState((current) =>
        current.projectId === projectId
          ? {
              ...current,
              resourcesLoading: false,
              resourcesError: "Could not load Resources. Please try again.",
              resources: [],
            }
          : current
      );
    }
  }, []);

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
        resourcesLoading: true,
      });

      void loadManagementState(projectId);
      void loadResources(projectId);
    },
    [loadManagementState, loadResources]
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

  const retryResources = useCallback(() => {
    const projectId = latestProjectIdRef.current;
    if (projectId) {
      void loadResources(projectId);
    }
  }, [loadResources]);

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
    revealEphemeralShareUrl's own function-scoped closure, then
    discarded. copyStatus (idle/copied/failed) is the only thing
    persisted, and it carries no secret material.
  */
  const copyLink = useCallback(() => {
    return runAction("copyLink", async () => {
      const linkId = latestLinkIdRef.current;
      if (!linkId) throw new Error("Missing share link id.");

      const url = await revealEphemeralShareUrl(linkId);

      try {
        await navigator.clipboard.writeText(url);
        setState((current) => ({ ...current, copyStatus: "copied" }));
      } catch {
        setState((current) => ({ ...current, copyStatus: "failed" }));
        throw new Error("Could not copy the link to your clipboard.");
      }
    });
  }, [runAction]);

  /*
    Phase 2C access controls. Each mirrors the exact pattern every other
    action here already uses: resolve the current linkId from the ref,
    forward to the client wrapper, let runAction's own reentrancy guard
    and post-success refresh handle the rest. None of these inspect or
    transform the PIN/timestamp -- the owner-facing component validates
    against the same canonical contracts the route itself uses before
    ever calling these, and the server remains the sole authority.
  */
  const setPin = useCallback(
    (pin: string) => {
      return runAction("setPin", async () => {
        const linkId = latestLinkIdRef.current;
        if (!linkId) throw new Error("Missing share link id.");
        await setSharePinRequest(linkId, pin);
      });
    },
    [runAction]
  );

  const clearPin = useCallback(() => {
    return runAction("clearPin", async () => {
      const linkId = latestLinkIdRef.current;
      if (!linkId) throw new Error("Missing share link id.");
      await clearSharePinRequest(linkId);
    });
  }, [runAction]);

  const setExpiry = useCallback(
    (expiresAt: string) => {
      return runAction("setExpiry", async () => {
        const linkId = latestLinkIdRef.current;
        if (!linkId) throw new Error("Missing share link id.");
        await setShareLinkExpiryRequest(linkId, expiresAt);
      });
    },
    [runAction]
  );

  const clearExpiry = useCallback(() => {
    return runAction("clearExpiry", async () => {
      const linkId = latestLinkIdRef.current;
      if (!linkId) throw new Error("Missing share link id.");
      await clearShareLinkExpiryRequest(linkId);
    });
  }, [runAction]);

  /*
    Rotation replaces the link's secret. The RPC's own response includes
    a freshly generated plaintext secret (mirroring activateShareLink's
    response shape) -- it is intentionally never read out of the
    resolved promise below, so it is discarded the instant this async
    function returns, never assigned to any state. If the owner needs to
    copy the rotated link, copyLink performs its own fresh reveal
    afterward rather than this action ever surfacing the secret it just
    generated.
  */
  const rotate = useCallback(() => {
    return runAction("rotate", async () => {
      const linkId = latestLinkIdRef.current;
      if (!linkId) throw new Error("Missing share link id.");
      await rotateShareLinkSecretRequest(linkId);
    });
  }, [runAction]);

  /*
    Native Share (Web Share API). A user dismissing the native share
    sheet rejects with a DOMException named "AbortError" -- that is
    swallowed here as a benign no-op, never surfaced as actionError, so
    cancelling never reads as an application failure. Unsupported-browser
    detection is primarily the component's own render-time concern (it
    should not offer this control at all when navigator.share does not
    exist), but this action still fails closed defensively if called
    anyway.
  */
  const nativeShare = useCallback(() => {
    return runAction("nativeShare", async () => {
      const linkId = latestLinkIdRef.current;
      if (!linkId) throw new Error("Missing share link id.");

      if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
        throw new Error(
          "Native sharing is not available in this browser. Use Copy link instead."
        );
      }

      const url = await revealEphemeralShareUrl(linkId);

      try {
        await navigator.share({
          title: "Text2Task project update",
          text: "Here's the latest project update.",
          url,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        throw error;
      }
    });
  }, [runAction]);

  /*
    WhatsApp via a plain wa.me prefilled link -- no API, no OAuth, no
    phone number. Popup-blocking safety: `popup` is a window handle the
    CALLER (the component's click handler) must open synchronously,
    inside the original user gesture -- without the `noopener` window
    feature, which browsers always resolve to a null return value,
    defeating the whole pre-open strategy -- *before* invoking this
    action. By the time this async function reaches its own `await`,
    that gesture has already been spent, so this function only ever
    navigates the pre-opened window rather than calling `window.open`
    itself post-await. If reveal OR the navigation attempt itself fails,
    the pre-opened blank window is closed rather than left as an orphan
    tab. If no popup handle was supplied (e.g. the caller's own
    window.open call was itself blocked), this falls back to a direct
    post-reveal window.open, which is the best remaining option in that
    situation.
  */
  const whatsapp = useCallback(
    (popup: Window | null) => {
      return runAction("whatsapp", async () => {
        const linkId = latestLinkIdRef.current;
        if (!linkId) {
          popup?.close();
          throw new Error("Missing share link id.");
        }

        let url: string;
        try {
          url = await revealEphemeralShareUrl(linkId);
        } catch (error) {
          popup?.close();
          throw error;
        }

        const message = `Here's the latest project update: ${url}`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

        try {
          if (popup && !popup.closed) {
            popup.location.href = waUrl;
          } else {
            window.open(waUrl, "_blank", "noopener,noreferrer");
          }
        } catch (error) {
          popup?.close();
          throw error;
        }
      });
    },
    [runAction]
  );

  /*
    Configuration save. `request` is built entirely by the caller (the
    configuration editor component) -- this hook never inspects or
    derives its contents, it only forwards it to the existing atomic
    save_share_configuration RPC via the repository/route layer and, on
    success, reconciles from the authoritative re-read rather than
    trusting the editor's own local draft as final. `runAction`'s
    existing reentrancy guard covers rapid repeated Save clicks the same
    way it already covers every other action.
  */
  const saveConfiguration = useCallback(
    (request: SaveShareConfigurationRequest) => {
      return runAction("saveConfiguration", async () => {
        const linkId = latestLinkIdRef.current;
        if (!linkId) throw new Error("Missing share link id.");
        await saveShareConfigurationRequest(linkId, request);
      });
    },
    [runAction]
  );

  return {
    state,
    triggerRef,
    openPanel,
    closePanel,
    refresh,
    retryResources,
    createDraft,
    activate,
    disable,
    reenable,
    revoke,
    copyLink,
    saveConfiguration,
    setPin,
    clearPin,
    setExpiry,
    clearExpiry,
    rotate,
    nativeShare,
    whatsapp,
  };
}
