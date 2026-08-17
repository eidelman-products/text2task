import { useCallback, useRef, useState } from "react";

import type {
  SaveShareConfigurationRequest,
  ShareLinkManagementStateData,
} from "@/lib/share/share-contracts";
import type { ClientProjectProjection } from "@/lib/share/client-share-projection-contracts";
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
  previewShareLink as previewShareLinkRequest,
  reenableShareLink as reenableShareLinkRequest,
  revealShareLinkSecret as revealShareLinkSecretRequest,
  revokeShareLink as revokeShareLinkRequest,
  rotateShareLinkSecret as rotateShareLinkSecretRequest,
  saveShareConfiguration as saveShareConfigurationRequest,
  setShareLinkExpiry as setShareLinkExpiryRequest,
  setSharePin as setSharePinRequest,
} from "./share-link-client";
import {
  buildQuickShareResourceItems,
  buildQuickShareTaskItems,
} from "./quick-share-defaults";

/**
 * Real browser defect #2 fix: shareUpdate orchestrates up to four
 * sequential network calls (create draft, save configuration, set PIN,
 * activate) behind one actionPending/actionError pair. Before this,
 * whichever call failed, the owner (and any test/log) saw only the exact
 * same generic fallback text, with no way to tell which of the four
 * calls actually failed. Every call site inside shareUpdate below is
 * wrapped to re-throw a ShareUpdateStageError carrying a fixed `stage`
 * tag instead of the bare caught error -- describeError unwraps it back
 * to the original error before running its existing
 * ShareLinkClientError-code switch (so the owner-facing message is
 * unchanged for any error code it already recognizes), and runAction
 * separately records the stage on state.actionErrorStage for
 * tests/diagnostics. Never exposes DB internals or secrets -- only one
 * of a small fixed set of stage identifiers.
 */
export type ShareUpdateStage =
  | "share_update_create_draft_failed"
  | "share_update_save_failed"
  | "share_update_pin_failed"
  | "share_update_activate_failed";

export class ShareUpdateStageError extends Error {
  readonly stage: ShareUpdateStage;
  readonly cause: unknown;

  constructor(stage: ShareUpdateStage, cause: unknown) {
    super(cause instanceof Error ? cause.message : "Share update failed.");
    this.name = "ShareUpdateStageError";
    this.stage = stage;
    this.cause = cause;
  }
}

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
  | "whatsapp"
  | "email"
  | "preview"
  | "shareUpdate";

export type ShareLinkPanelState = {
  isOpen: boolean;
  project: TaskProjectGroup | null;
  projectId: string | null;
  isLoading: boolean;
  loadError: string | null;
  data: ShareLinkManagementStateData | null;
  actionPending: ShareLinkActionKind | null;
  actionError: string | null;
  // Real browser defect #2 fix: which of shareUpdate's sequential calls
  // failed, when actionError came from a ShareUpdateStageError -- null
  // for every other action, and for a shareUpdate failure that somehow
  // did not go through the stage-tagged path. Never shown to the owner
  // directly (the UI still shows only the existing safe actionError
  // text); exists purely so tests/logging can pinpoint the exact failed
  // step instead of only ever seeing the generic fallback message.
  actionErrorStage: ShareUpdateStage | null;
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
  // Phase 2D owner Preview. `previewData` holds only the strict
  // client-facing projection (never the raw project/link) and is
  // discarded on close so a stale preview can never linger past the
  // session that fetched it. Loading/error for the fetch itself reuse
  // the existing generic actionPending==="preview"/actionError fields,
  // matching every other action here.
  previewOpen: boolean;
  previewData: ClientProjectProjection | null;
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
  actionErrorStage: null,
  copyStatus: "idle",
  resources: [],
  resourcesLoading: false,
  resourcesError: null,
  previewOpen: false,
  previewData: null,
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
  // Unwrap a stage-tagged shareUpdate failure to the real underlying
  // error first, so every ShareLinkClientError code this function already
  // recognizes still produces its existing safe message -- the stage tag
  // itself is recorded separately (see runAction below), never woven into
  // the owner-facing text.
  const underlying = error instanceof ShareUpdateStageError ? error.cause : error;

  if (underlying instanceof ShareLinkClientError) {
    switch (underlying.code) {
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

  // Objective B (quick-share orchestration): mirrors of the currently
  // loaded link/data/project, read by shareUpdate/emailLink below so they
  // can make a single-pass decision (create a draft? activate? apply
  // automatic task defaults?) without threading extra parameters through
  // every call site.
  const latestLinkStateRef = useRef<"draft" | "active" | "disabled" | "expired" | null>(null);
  latestLinkStateRef.current = state.data?.link?.state ?? null;

  const latestDataRef = useRef<ShareLinkManagementStateData | null>(null);
  latestDataRef.current = state.data;

  const latestProjectRef = useRef<TaskProjectGroup | null>(null);
  latestProjectRef.current = state.project;

  const latestResourcesRef = useRef<TaskResource[]>([]);
  latestResourcesRef.current = state.resources;

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
        actionErrorStage: null,
      }));

      try {
        await run();
      } catch (error) {
        actionInFlightRef.current = false;
        setState((current) => ({
          ...current,
          actionPending: null,
          actionError: describeError(error, "That action could not be completed."),
          actionErrorStage: error instanceof ShareUpdateStageError ? error.stage : null,
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

  /*
    Phase 2D owner Preview. Fetches the SAME strict projection Phase 3's
    future public route will build, via the authenticated-owner-only
    /preview endpoint -- never the secure share link or secret, never a
    reveal call, never a public-view side effect (see the route's own
    doc comment: no view_count increment, no last_viewed_at mutation, no
    share_link_events row). `openPreview` sets previewOpen synchronously
    (so the panel can render its "loading" state immediately) and then
    runs the fetch through the same reentrancy-guarded runAction every
    other action here uses. `closePreview` discards the fetched
    projection entirely rather than merely hiding it, so reopening
    Preview always fetches fresh, current data instead of showing a
    possibly-stale one.
  */
  const openPreview = useCallback(() => {
    setState((current) => ({ ...current, previewOpen: true }));

    return runAction("preview", async () => {
      const linkId = latestLinkIdRef.current;
      if (!linkId) throw new Error("Missing share link id.");
      const projectId = latestProjectIdRef.current;

      const data = await previewShareLinkRequest(linkId);

      setState((current) =>
        current.projectId === projectId ? { ...current, previewData: data } : current
      );
    });
  }, [runAction]);

  const closePreview = useCallback(() => {
    setState((current) => ({ ...current, previewOpen: false, previewData: null }));
  }, []);

  /*
    Objective B -- the ONE primary "Share update" action. Owner UI
    orchestration only: no new backend, no new RPC. Reuses the exact same
    request functions every existing action above already calls
    (createShareLinkDraftRequest, saveShareConfigurationRequest,
    setSharePinRequest, activateShareLinkRequest) -- it cannot call the
    createDraft/saveConfiguration/activate *action* functions above
    directly, because those each go through runAction's own reentrancy
    guard, which is already held by this action's own runAction call by
    the time they would run, so they would silently no-op. This is the
    single place that sequence lives, under one actionPending value
    ("shareUpdate"), so the owner sees one "Sharing..." state instead of
    five separate ones for what the previous UI made five separate
    conceptual steps.

    - A brand-new link (no link at all yet) gets its safe default
      settings (title/status visible, target date hidden, comments off,
      auto direction) -- see share-contracts.ts's
      saveShareConfigurationSettingsSchema for the exact accepted keys.
      An existing link's settings are never touched here; changing them
      is an "Edit what client sees" concern.
    - Tasks: buildQuickShareTaskItems only returns an automatic set when
      NOTHING is mapped yet for this link (see quick-share-defaults.ts's
      own header comment for why a persisted mapping, once it exists, is
      never recomputed here).
    - Attachments/resources are opt-in only: nothing is sent unless the
      owner explicitly picked at least one this session.
    - PIN: `input.pin` (a freshly-typed value) sets a brand-new PIN;
      `input.clearPin` disables an existing one via the same clear-PIN
      path the old "Manage link" control used; the two are mutually
      exclusive by construction in the quick-share component (see
      share-link-quick-share.tsx's own handleShare). Neither ever fires
      when the checkbox's state simply matches what the link already had
      (no PIN change intended this submission).
    - Activation only happens when the link is not already active,
      satisfying "do not unnecessarily reactivate" for an already-active
      link.
  */
  const shareUpdate = useCallback(
    (input: {
      updateBody: string;
      pin: string | null;
      clearPin: boolean;
      attachmentResourceIds: string[];
    }) => {
      return runAction("shareUpdate", async () => {
        const projectId = latestProjectIdRef.current;
        if (!projectId) throw new Error("Missing project id.");

        const project = latestProjectRef.current;
        if (!project) throw new Error("Missing project.");

        const dataAtStart = latestDataRef.current;
        const isFirstShare = !dataAtStart || !dataAtStart.link;
        const mappedTasksAtStart = dataAtStart?.link ? dataAtStart.mappedTasks : [];
        const mappedResourcesAtStart = dataAtStart?.link ? dataAtStart.mappedResources : [];

        let linkId = latestLinkIdRef.current;
        const needsActivation = latestLinkStateRef.current !== "active";

        if (!linkId) {
          try {
            await createShareLinkDraftRequest(projectId);
            const fresh = await getShareLinkManagementState(projectId);
            if (!fresh.link) throw new Error("Could not create the share link.");
            linkId = fresh.link.id;
          } catch (error) {
            throw new ShareUpdateStageError("share_update_create_draft_failed", error);
          }
        }

        const request: SaveShareConfigurationRequest = {};

        if (isFirstShare) {
          request.settings = {
            titleVisible: true,
            statusVisible: true,
            targetDateVisible: false,
            commentsEnabled: false,
            contentDirection: "auto",
            clientFacingSubtitle: null,
          };
        }

        const taskItems = buildQuickShareTaskItems(project.subtasks, mappedTasksAtStart);
        if (taskItems !== undefined) {
          request.tasks = taskItems;
        }

        if (input.attachmentResourceIds.length > 0) {
          const resourceItems = buildQuickShareResourceItems(
            input.attachmentResourceIds,
            latestResourcesRef.current,
            mappedResourcesAtStart
          );

          // Defense in depth against ever sending a silently-truncated
          // resources array: save_share_configuration treats a supplied
          // `resources` group as a full-set replacement, so a shorter
          // array than what the owner actually selected would silently
          // DROP an existing persisted mapping (the exact regression
          // class real browser defect #1 fixed) rather than merely fail
          // to add one. If any selected id could not be resolved (neither
          // already mapped nor found in the loaded Resources list), fail
          // loudly here, before any network call, instead of sending a
          // request that could delete a persisted Resource mapping the
          // owner never asked to remove.
          if (resourceItems.length !== input.attachmentResourceIds.length) {
            throw new ShareUpdateStageError(
              "share_update_save_failed",
              new Error("One or more selected attachments could not be resolved.")
            );
          }

          request.resources = resourceItems;
        }

        const trimmedUpdate = input.updateBody.trim();
        if (trimmedUpdate.length > 0) {
          request.publishUpdate = { body: trimmedUpdate };
        }

        if (Object.keys(request).length > 0) {
          try {
            await saveShareConfigurationRequest(linkId, request);
          } catch (error) {
            throw new ShareUpdateStageError("share_update_save_failed", error);
          }
        }

        if (input.pin) {
          try {
            await setSharePinRequest(linkId, input.pin);
          } catch (error) {
            throw new ShareUpdateStageError("share_update_pin_failed", error);
          }
        } else if (input.clearPin) {
          // Owner unchecked "Protect with a PIN" on an already-protected
          // link -- disable it via the existing clear-PIN path. Never
          // rotates/recreates the link, and touches nothing else (task/
          // Resource mappings, the share secret, configuration_version
          // outside this field, and latest-update state are all
          // untouched by clear_share_pin, exactly as they already were
          // for the pre-existing "Manage link" clear-PIN control).
          try {
            await clearSharePinRequest(linkId);
          } catch (error) {
            throw new ShareUpdateStageError("share_update_pin_failed", error);
          }
        }

        if (needsActivation) {
          try {
            await activateShareLinkRequest(linkId);
          } catch (error) {
            throw new ShareUpdateStageError("share_update_activate_failed", error);
          }
        }
      });
    },
    [runAction]
  );

  /*
    Email channel (mailto: only this phase -- no email-delivery backend).
    Mirrors copyLink's own reveal-then-discard pattern: the secret URL is
    read into a local variable and handed straight to the mailto: link,
    never assigned to any state. The recipient is prefilled only from the
    project's own client email already visible to the authenticated owner
    in this same dashboard (never a new exposure); left blank otherwise.
    subject/body are composed entirely client-side and opened via the
    browser's own mailto: handoff -- Text2Task never sends this email.
  */
  const emailLink = useCallback(() => {
    return runAction("email", async () => {
      const linkId = latestLinkIdRef.current;
      if (!linkId) throw new Error("Missing share link id.");

      const url = await revealEphemeralShareUrl(linkId);
      const project = latestProjectRef.current;
      const projectTitle = project?.projectTitle?.trim() || "your project";
      const recipient = project?.client_email?.trim() || "";

      const subject = `Project update: ${projectTitle}`;
      const body = `Hi,\n\nHere's the latest update on your project:\n${url}\n`;
      const mailto = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      window.location.href = mailto;
    });
  }, [runAction]);

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
    emailLink,
    shareUpdate,
    openPreview,
    closePreview,
  };
}
