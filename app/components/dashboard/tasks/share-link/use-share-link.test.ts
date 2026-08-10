// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import type { ShareLinkManagementStateData } from "@/lib/share/share-contracts";
import type { TaskProjectGroup, TaskRow } from "../task-types";
import { ShareLinkClientError } from "./share-link-client";

const getShareLinkManagementStateMock = vi.fn();
const createShareLinkDraftMock = vi.fn();
const activateShareLinkMock = vi.fn();
const disableShareLinkMock = vi.fn();
const reenableShareLinkMock = vi.fn();
const revokeShareLinkMock = vi.fn();
const revealShareLinkSecretMock = vi.fn();

vi.mock("./share-link-client", async () => {
  const actual = await vi.importActual<typeof import("./share-link-client")>(
    "./share-link-client"
  );
  return {
    ShareLinkClientError: actual.ShareLinkClientError,
    getShareLinkManagementState: (...args: unknown[]) =>
      getShareLinkManagementStateMock(...args),
    createShareLinkDraft: (...args: unknown[]) => createShareLinkDraftMock(...args),
    activateShareLink: (...args: unknown[]) => activateShareLinkMock(...args),
    disableShareLink: (...args: unknown[]) => disableShareLinkMock(...args),
    reenableShareLink: (...args: unknown[]) => reenableShareLinkMock(...args),
    revokeShareLink: (...args: unknown[]) => revokeShareLinkMock(...args),
    revealShareLinkSecret: (...args: unknown[]) => revealShareLinkSecretMock(...args),
  };
});

const { useShareLink } = await import("./use-share-link");

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const LINK_ID = "22222222-2222-4222-8222-222222222222";

function taskRow(): TaskRow {
  return {
    id: 1,
    client: { id: "client-1", name: "Acme" },
    project: { id: PROJECT_ID, title: "Website launch", client_name: "Acme" },
    task: "Design hero",
    amount: "",
    deadline: "",
    priority: "Medium",
    status: "New",
    source: "manual",
    project_id: PROJECT_ID,
    created_at: "2026-08-03T10:00:00.000Z",
  };
}

function projectGroup(): TaskProjectGroup {
  const task = taskRow();
  return {
    key: `project::${PROJECT_ID}`,
    project_id: PROJECT_ID,
    project: task.project,
    clientName: "Acme",
    projectTitle: "Website launch",
    projectSummary: "",
    tasks: [task],
    subtasks: [],
    primaryTask: task,
    taskIds: [task.id],
    amount: "",
    deadline: "",
    priority: "Medium",
    status: "New",
    source: "manual",
    hasContactDetails: false,
    subtaskCount: 1,
    completedSubtaskCount: 0,
  };
}

function noLinkState() {
  return { link: null, mappedTaskIds: [], mappedResourceIds: [], currentUpdate: null };
}

function draftLinkState() {
  return {
    link: {
      id: LINK_ID,
      publicId: "abcdefgh12345678",
      state: "draft" as const,
      expiresAt: null,
      hasPin: false,
      commentsEnabled: true,
      clientFacingSubtitle: null,
      contentDirection: "auto" as const,
      configurationVersion: 1,
      createdAt: "2026-08-10T00:00:00Z",
      activatedAt: null,
      disabledAt: null,
      rotatedAt: null,
      lastViewedAt: null,
      viewCount: 0,
    },
    mappedTaskIds: [],
    mappedResourceIds: [],
    currentUpdate: null,
  };
}

beforeEach(() => {
  getShareLinkManagementStateMock.mockReset();
  createShareLinkDraftMock.mockReset();
  activateShareLinkMock.mockReset();
  disableShareLinkMock.mockReset();
  reenableShareLinkMock.mockReset();
  revokeShareLinkMock.mockReset();
  revealShareLinkSecretMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useShareLink - open/close and load", () => {
  it("opens with a resolved projectId, loads management state, and reports no-link data", async () => {
    getShareLinkManagementStateMock.mockResolvedValue(noLinkState());

    const { result } = renderHook(() => useShareLink());

    act(() => {
      result.current.openPanel(projectGroup());
    });

    expect(result.current.state.isOpen).toBe(true);
    expect(result.current.state.projectId).toBe(PROJECT_ID);
    expect(result.current.state.isLoading).toBe(true);

    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    expect(result.current.state.data?.link).toBeNull();
    expect(result.current.state.loadError).toBeNull();
    expect(getShareLinkManagementStateMock).toHaveBeenCalledWith(PROJECT_ID);
  });

  it("reports a load error without a projectId, never calling the API", () => {
    const { result } = renderHook(() => useShareLink());

    act(() => {
      result.current.openPanel({ ...projectGroup(), project_id: null, project: null, primaryTask: { ...taskRow(), project_id: null, project: null }, tasks: [], key: "fallback::1" });
    });

    expect(result.current.state.isOpen).toBe(true);
    expect(result.current.state.loadError).toMatch(/project id/i);
    expect(getShareLinkManagementStateMock).not.toHaveBeenCalled();
  });

  it("closePanel resets to the initial closed state", async () => {
    getShareLinkManagementStateMock.mockResolvedValue(noLinkState());
    const { result } = renderHook(() => useShareLink());

    act(() => {
      result.current.openPanel(projectGroup());
    });
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));

    act(() => {
      result.current.closePanel();
    });

    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.data).toBeNull();
  });

  it("maps a load failure through describeError", async () => {
    getShareLinkManagementStateMock.mockRejectedValue(
      new ShareLinkClientError("UNAUTHENTICATED", "no")
    );
    const { result } = renderHook(() => useShareLink());

    act(() => {
      result.current.openPanel(projectGroup());
    });

    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    expect(result.current.state.loadError).toMatch(/signed in/i);
  });
});

describe("useShareLink - actions", () => {
  async function openAndLoad(
    initialData: ShareLinkManagementStateData = noLinkState()
  ) {
    getShareLinkManagementStateMock.mockResolvedValue(initialData);
    const { result } = renderHook(() => useShareLink());

    act(() => {
      result.current.openPanel(projectGroup());
    });
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));

    return result;
  }

  it("createDraft calls the client with the resolved projectId and refreshes state", async () => {
    const result = await openAndLoad();
    createShareLinkDraftMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      state: "draft",
      createdAt: "2026-08-10T00:00:00Z",
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce(draftLinkState());

    await act(async () => {
      await result.current.createDraft();
    });

    expect(createShareLinkDraftMock).toHaveBeenCalledWith(PROJECT_ID);
    expect(getShareLinkManagementStateMock).toHaveBeenCalledTimes(2);
    expect(result.current.state.actionPending).toBeNull();
    expect(result.current.state.actionError).toBeNull();
  });

  it("a second call while an action is already in flight is ignored (no double submission)", async () => {
    const result = await openAndLoad();
    let resolveCreate!: (value: {
      linkId: string;
      publicId: string;
      state: "draft";
      createdAt: string;
    }) => void;
    createShareLinkDraftMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    let firstCall: Promise<void>;
    let secondCall: Promise<void>;
    act(() => {
      firstCall = result.current.createDraft();
      secondCall = result.current.createDraft();
    });

    expect(createShareLinkDraftMock).toHaveBeenCalledTimes(1);

    getShareLinkManagementStateMock.mockResolvedValueOnce(draftLinkState());
    await act(async () => {
      resolveCreate({
        linkId: LINK_ID,
        publicId: "abcdefgh12345678",
        state: "draft",
        createdAt: "2026-08-10T00:00:00Z",
      });
      await firstCall;
      await secondCall;
    });

    expect(createShareLinkDraftMock).toHaveBeenCalledTimes(1);
  });

  it("a failed action sets actionError and clears actionPending without refreshing", async () => {
    const result = await openAndLoad();
    createShareLinkDraftMock.mockRejectedValue(
      new ShareLinkClientError("PROJECT_ARCHIVED", "archived")
    );

    await act(async () => {
      await result.current.createDraft();
    });

    expect(result.current.state.actionPending).toBeNull();
    expect(result.current.state.actionError).toMatch(/archived/i);
  });

  it("activate calls the client with the current linkId", async () => {
    const result = await openAndLoad(draftLinkState());
    activateShareLinkMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      state: "active",
      configurationVersion: 2,
      activatedAt: "2026-08-10T00:00:00Z",
    });

    await act(async () => {
      await result.current.activate();
    });

    expect(activateShareLinkMock).toHaveBeenCalledWith(LINK_ID);
  });

  it("disable calls the client with the current linkId", async () => {
    const result = await openAndLoad(draftLinkState());
    disableShareLinkMock.mockResolvedValue({
      linkId: LINK_ID,
      state: "disabled",
      configurationVersion: 2,
      disabledAt: "2026-08-10T00:00:00Z",
    });

    await act(async () => {
      await result.current.disable();
    });

    expect(disableShareLinkMock).toHaveBeenCalledWith(LINK_ID);
  });

  it("reenable calls the client with the current linkId", async () => {
    const result = await openAndLoad(draftLinkState());
    reenableShareLinkMock.mockResolvedValue({
      linkId: LINK_ID,
      state: "active",
      configurationVersion: 2,
      activatedAt: "2026-08-10T00:00:00Z",
      disabledAt: "2026-08-10T00:00:00Z",
    });

    await act(async () => {
      await result.current.reenable();
    });

    expect(reenableShareLinkMock).toHaveBeenCalledWith(LINK_ID);
  });

  it("revoke calls the client with the current linkId, and the subsequent refresh reflects the RPC's own revoked-link exclusion (no-link again)", async () => {
    const result = await openAndLoad(draftLinkState());
    revokeShareLinkMock.mockResolvedValue({
      linkId: LINK_ID,
      state: "revoked",
      configurationVersion: 2,
      revokedAt: "2026-08-10T00:00:00Z",
    });
    // get_share_link_management_state filters `state <> 'revoked'` at the
    // SQL level, so the link this hook just revoked can never come back
    // from the very next management-state read -- the authoritative
    // post-revoke read is "no managed link", not a "revoked" link state.
    getShareLinkManagementStateMock.mockResolvedValueOnce(noLinkState());

    await act(async () => {
      await result.current.revoke();
    });

    expect(revokeShareLinkMock).toHaveBeenCalledWith(LINK_ID);
    expect(getShareLinkManagementStateMock).toHaveBeenCalledTimes(2);
    expect(result.current.state.data?.link).toBeNull();
  });

  it("copyLink reveals the secret, writes the built URL to the clipboard, and never stores the secret in state", async () => {
    const result = await openAndLoad(draftLinkState());
    revealShareLinkSecretMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await act(async () => {
      await result.current.copyLink();
    });

    expect(revealShareLinkSecretMock).toHaveBeenCalledWith(LINK_ID);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain(
      "/share/abcdefgh12345678#P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc"
    );
    expect(result.current.state.copyStatus).toBe("copied");

    // The secret must never appear anywhere in the serialized hook state.
    const serializedState = JSON.stringify(result.current.state);
    expect(serializedState).not.toContain("P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc");
  });

  it("copyLink reports a failed status when the clipboard write rejects, without throwing out of the hook", async () => {
    const result = await openAndLoad(draftLinkState());
    revealShareLinkSecretMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
    });
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    await act(async () => {
      await result.current.copyLink();
    });

    expect(result.current.state.copyStatus).toBe("failed");
    expect(result.current.state.actionError).toBeTruthy();
  });
});
