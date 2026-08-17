// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import type { ShareLinkManagementStateData } from "@/lib/share/share-contracts";
import type { TaskProjectGroup, TaskProjectSubtask, TaskRow } from "../task-types";
import { ShareLinkClientError } from "./share-link-client";

const getShareLinkManagementStateMock = vi.fn();
const createShareLinkDraftMock = vi.fn();
const activateShareLinkMock = vi.fn();
const disableShareLinkMock = vi.fn();
const reenableShareLinkMock = vi.fn();
const revokeShareLinkMock = vi.fn();
const revealShareLinkSecretMock = vi.fn();
const saveShareConfigurationMock = vi.fn();
const setSharePinMock = vi.fn();
const clearSharePinMock = vi.fn();
const setShareLinkExpiryMock = vi.fn();
const clearShareLinkExpiryMock = vi.fn();
const rotateShareLinkSecretMock = vi.fn();

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
    saveShareConfiguration: (...args: unknown[]) => saveShareConfigurationMock(...args),
    setSharePin: (...args: unknown[]) => setSharePinMock(...args),
    clearSharePin: (...args: unknown[]) => clearSharePinMock(...args),
    setShareLinkExpiry: (...args: unknown[]) => setShareLinkExpiryMock(...args),
    clearShareLinkExpiry: (...args: unknown[]) => clearShareLinkExpiryMock(...args),
    rotateShareLinkSecret: (...args: unknown[]) => rotateShareLinkSecretMock(...args),
  };
});

const fetchTaskResourcesMock = vi.fn();

vi.mock("../../resources/resource-api", async () => {
  const actual = await vi.importActual<typeof import("../../resources/resource-api")>(
    "../../resources/resource-api"
  );
  return {
    ...actual,
    fetchTaskResources: (...args: unknown[]) => fetchTaskResourcesMock(...args),
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

function projectGroupWithSubtasks(subtasks: TaskProjectSubtask[]): TaskProjectGroup {
  return { ...projectGroup(), subtasks };
}

function subtask(overrides: Partial<TaskProjectSubtask> = {}): TaskProjectSubtask {
  return {
    id: 1,
    project_id: PROJECT_ID,
    title: "Design hero",
    status: "New",
    priority: "Medium",
    amount: "",
    deadline: "",
    ...overrides,
  };
}

function noLinkState() {
  return { link: null, mappedTasks: [], mappedResources: [], currentUpdate: null };
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
      titleVisible: false,
      statusVisible: false,
      targetDateVisible: false,
      configurationVersion: 1,
      createdAt: "2026-08-10T00:00:00Z",
      activatedAt: null,
      disabledAt: null,
      rotatedAt: null,
      lastViewedAt: null,
      viewCount: 0,
    },
    mappedTasks: [],
    mappedResources: [],
    currentUpdate: null,
  };
}

function activeLinkState(overrides: Record<string, unknown> = {}) {
  const base = draftLinkState();
  return {
    ...base,
    link: {
      ...base.link,
      state: "active" as const,
      activatedAt: "2026-08-10T00:00:00Z",
      ...overrides,
    },
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
  saveShareConfigurationMock.mockReset();
  setSharePinMock.mockReset();
  clearSharePinMock.mockReset();
  setShareLinkExpiryMock.mockReset();
  clearShareLinkExpiryMock.mockReset();
  rotateShareLinkSecretMock.mockReset();
  fetchTaskResourcesMock.mockReset();
  fetchTaskResourcesMock.mockResolvedValue([]);
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

  it("saveConfiguration calls the client with the current linkId and request, then refreshes from the authoritative state", async () => {
    const result = await openAndLoad(draftLinkState());
    saveShareConfigurationMock.mockResolvedValue({
      linkId: LINK_ID,
      configurationVersion: 2,
      currentUpdate: null,
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce(draftLinkState());

    const request = { settings: { commentsEnabled: false } };
    await act(async () => {
      await result.current.saveConfiguration(request as never);
    });

    expect(saveShareConfigurationMock).toHaveBeenCalledWith(LINK_ID, request);
    expect(getShareLinkManagementStateMock).toHaveBeenCalledTimes(2);
    expect(result.current.state.actionPending).toBeNull();
    expect(result.current.state.actionError).toBeNull();
  });

  it("a failed saveConfiguration keeps the prior data and sets a safe actionError, without refreshing", async () => {
    const result = await openAndLoad(draftLinkState());
    saveShareConfigurationMock.mockRejectedValue(
      new ShareLinkClientError("SHARE_LINK_STATE_CONFLICT", "conflict")
    );

    await act(async () => {
      await result.current.saveConfiguration({ settings: { commentsEnabled: false } } as never);
    });

    expect(result.current.state.actionPending).toBeNull();
    expect(result.current.state.actionError).toBeTruthy();
    expect(result.current.state.data?.link?.id).toBe(LINK_ID);
    expect(getShareLinkManagementStateMock).toHaveBeenCalledTimes(1);
  });

  it("rapid repeated saveConfiguration calls cannot double-submit", async () => {
    const result = await openAndLoad(draftLinkState());
    let resolveSave!: (value: { linkId: string; configurationVersion: number; currentUpdate: null }) => void;
    saveShareConfigurationMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );

    let firstCall: Promise<void>;
    let secondCall: Promise<void>;
    act(() => {
      firstCall = result.current.saveConfiguration({ settings: { commentsEnabled: false } } as never);
      secondCall = result.current.saveConfiguration({ settings: { commentsEnabled: false } } as never);
    });

    expect(saveShareConfigurationMock).toHaveBeenCalledTimes(1);

    getShareLinkManagementStateMock.mockResolvedValueOnce(draftLinkState());
    await act(async () => {
      resolveSave({ linkId: LINK_ID, configurationVersion: 2, currentUpdate: null });
      await firstCall;
      await secondCall;
    });

    expect(saveShareConfigurationMock).toHaveBeenCalledTimes(1);
  });
});

describe("useShareLink - project-level Resources", () => {
  it("openPanel loads project-level Resources alongside the management state", async () => {
    const resource = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      user_id: "user-1",
      project_id: PROJECT_ID,
      task_id: null,
      resource_type: "link" as const,
      title: "Brief",
      url: "https://example.com",
      storage_path: null,
      file_name: null,
      mime_type: null,
      size_bytes: null,
      notes: null,
      created_at: "2026-08-03T10:00:00.000Z",
      updated_at: "2026-08-03T10:00:00.000Z",
    };
    getShareLinkManagementStateMock.mockResolvedValue(noLinkState());
    fetchTaskResourcesMock.mockResolvedValue([resource]);

    const { result } = renderHook(() => useShareLink());
    act(() => {
      result.current.openPanel(projectGroup());
    });

    expect(result.current.state.resourcesLoading).toBe(true);
    await waitFor(() => expect(result.current.state.resourcesLoading).toBe(false));

    expect(fetchTaskResourcesMock).toHaveBeenCalledWith({ project_id: PROJECT_ID });
    expect(result.current.state.resources).toEqual([resource]);
    expect(result.current.state.resourcesError).toBeNull();
  });

  it("a Resources load failure sets resourcesError, and retryResources retries", async () => {
    getShareLinkManagementStateMock.mockResolvedValue(noLinkState());
    fetchTaskResourcesMock.mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useShareLink());
    act(() => {
      result.current.openPanel(projectGroup());
    });

    await waitFor(() => expect(result.current.state.resourcesLoading).toBe(false));
    expect(result.current.state.resourcesError).toBeTruthy();
    expect(result.current.state.resources).toEqual([]);

    fetchTaskResourcesMock.mockResolvedValueOnce([]);
    act(() => {
      result.current.retryResources();
    });

    await waitFor(() => expect(result.current.state.resourcesLoading).toBe(false));
    expect(result.current.state.resourcesError).toBeNull();
  });
});

describe("useShareLink - Phase 2C access controls (PIN / expiry / rotate)", () => {
  async function openAndLoad(initialData: ShareLinkManagementStateData) {
    getShareLinkManagementStateMock.mockResolvedValue(initialData);
    const { result } = renderHook(() => useShareLink());

    act(() => {
      result.current.openPanel(projectGroup());
    });
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));

    return result;
  }

  it("setPin calls setSharePin with the current linkId and the entered pin, then refreshes", async () => {
    const result = await openAndLoad(draftLinkState());
    setSharePinMock.mockResolvedValue({
      linkId: LINK_ID,
      hasPin: true,
      state: "draft",
      configurationVersion: 2,
      updatedAt: "2026-08-12T00:00:00Z",
    });
    const refreshed = draftLinkState();
    getShareLinkManagementStateMock.mockResolvedValueOnce({
      ...refreshed,
      link: { ...refreshed.link, hasPin: true },
    });

    await act(async () => {
      await result.current.setPin("1234");
    });

    expect(setSharePinMock).toHaveBeenCalledWith(LINK_ID, "1234");
    expect(getShareLinkManagementStateMock).toHaveBeenCalledTimes(2);
    expect(result.current.state.actionError).toBeNull();
  });

  it("clearPin calls clearSharePin with the current linkId", async () => {
    const result = await openAndLoad(draftLinkState());
    clearSharePinMock.mockResolvedValue({
      linkId: LINK_ID,
      hasPin: false,
      state: "draft",
      configurationVersion: 2,
      updatedAt: "2026-08-12T00:00:00Z",
    });

    await act(async () => {
      await result.current.clearPin();
    });

    expect(clearSharePinMock).toHaveBeenCalledWith(LINK_ID);
  });

  it("setExpiry calls setShareLinkExpiry with the current linkId and the ISO timestamp", async () => {
    const result = await openAndLoad(draftLinkState());
    setShareLinkExpiryMock.mockResolvedValue({
      linkId: LINK_ID,
      state: "draft",
      expiresAt: "2026-09-01T00:00:00Z",
      configurationVersion: 2,
      updatedAt: "2026-08-12T00:00:00Z",
    });

    await act(async () => {
      await result.current.setExpiry("2026-09-01T00:00:00Z");
    });

    expect(setShareLinkExpiryMock).toHaveBeenCalledWith(LINK_ID, "2026-09-01T00:00:00Z");
  });

  it("clearExpiry calls clearShareLinkExpiry with the current linkId", async () => {
    const result = await openAndLoad(draftLinkState());
    clearShareLinkExpiryMock.mockResolvedValue({
      linkId: LINK_ID,
      state: "draft",
      expiresAt: null,
      configurationVersion: 2,
      updatedAt: "2026-08-12T00:00:00Z",
    });

    await act(async () => {
      await result.current.clearExpiry();
    });

    expect(clearShareLinkExpiryMock).toHaveBeenCalledWith(LINK_ID);
  });

  it("a failed setPin/setExpiry preserves the prior authoritative state and sets a safe actionError", async () => {
    const result = await openAndLoad(draftLinkState());
    setSharePinMock.mockRejectedValue(new ShareLinkClientError("SHARE_LINK_STATE_CONFLICT", "conflict"));

    await act(async () => {
      await result.current.setPin("1234");
    });

    expect(result.current.state.actionPending).toBeNull();
    expect(result.current.state.actionError).toBeTruthy();
    expect(result.current.state.data?.link?.hasPin).toBe(false);
  });

  it("rotate calls rotateShareLinkSecret with the current linkId and never stores the returned plaintext secret", async () => {
    const result = await openAndLoad(activeLinkState());
    rotateShareLinkSecretMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      state: "active",
      configurationVersion: 2,
      rotatedAt: "2026-08-12T00:00:00Z",
      secret: "Q8j1PwDrSyTiNpZsCfGhJkLzXcVbNm1234567890abd",
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce(activeLinkState());

    await act(async () => {
      await result.current.rotate();
    });

    expect(rotateShareLinkSecretMock).toHaveBeenCalledWith(LINK_ID);
    const serializedState = JSON.stringify(result.current.state);
    expect(serializedState).not.toContain("Q8j1PwDrSyTiNpZsCfGhJkLzXcVbNm1234567890abd");
  });

  it("rapid repeated rotate confirmations cannot rotate twice", async () => {
    const result = await openAndLoad(activeLinkState());
    let resolveRotate!: (value: {
      linkId: string;
      publicId: string;
      state: "active";
      configurationVersion: number;
      rotatedAt: string;
      secret: string;
    }) => void;
    rotateShareLinkSecretMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRotate = resolve;
      })
    );

    let firstCall: Promise<void>;
    let secondCall: Promise<void>;
    act(() => {
      firstCall = result.current.rotate();
      secondCall = result.current.rotate();
    });

    expect(rotateShareLinkSecretMock).toHaveBeenCalledTimes(1);

    getShareLinkManagementStateMock.mockResolvedValueOnce(activeLinkState());
    await act(async () => {
      resolveRotate({
        linkId: LINK_ID,
        publicId: "abcdefgh12345678",
        state: "active",
        configurationVersion: 2,
        rotatedAt: "2026-08-12T00:00:00Z",
        secret: "Q8j1PwDrSyTiNpZsCfGhJkLzXcVbNm1234567890abd",
      });
      await firstCall;
      await secondCall;
    });

    expect(rotateShareLinkSecretMock).toHaveBeenCalledTimes(1);
  });
});

describe("useShareLink - Phase 2C Copy/Native Share/WhatsApp", () => {
  async function openAndLoad(initialData: ShareLinkManagementStateData) {
    getShareLinkManagementStateMock.mockResolvedValue(initialData);
    const { result } = renderHook(() => useShareLink());

    act(() => {
      result.current.openPanel(projectGroup());
    });
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));

    return result;
  }

  it("nativeShare reveals, calls navigator.share with the ephemeral URL, and never stores the secret", async () => {
    const result = await openAndLoad(activeLinkState());
    revealShareLinkSecretMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
    });
    const shareMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share: shareMock, clipboard: { writeText: vi.fn() } });

    await act(async () => {
      await result.current.nativeShare();
    });

    expect(shareMock).toHaveBeenCalledTimes(1);
    const shareArg = shareMock.mock.calls[0][0];
    expect(shareArg.url).toContain("/share/abcdefgh12345678#P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc");
    expect(result.current.state.actionError).toBeNull();

    const serializedState = JSON.stringify(result.current.state);
    expect(serializedState).not.toContain("P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc");
  });

  it("nativeShare treats a user-cancelled share (AbortError) as a benign no-op, not an application error", async () => {
    const result = await openAndLoad(activeLinkState());
    revealShareLinkSecretMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
    });
    const abortError = new DOMException("User cancelled", "AbortError");
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(abortError),
      clipboard: { writeText: vi.fn() },
    });

    await act(async () => {
      await result.current.nativeShare();
    });

    expect(result.current.state.actionError).toBeNull();
  });

  it("nativeShare surfaces a real (non-Abort) failure as actionError", async () => {
    const result = await openAndLoad(activeLinkState());
    revealShareLinkSecretMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
    });
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new Error("share failed")),
      clipboard: { writeText: vi.fn() },
    });

    await act(async () => {
      await result.current.nativeShare();
    });

    expect(result.current.state.actionError).toBeTruthy();
  });

  it("nativeShare fails closed without ever revealing when navigator.share is unsupported", async () => {
    const result = await openAndLoad(activeLinkState());
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });

    await act(async () => {
      await result.current.nativeShare();
    });

    expect(result.current.state.actionError).toBeTruthy();
    expect(revealShareLinkSecretMock).not.toHaveBeenCalled();
  });

  it("whatsapp reveals, navigates the pre-opened popup to a wa.me URL containing the ephemeral URL, and never stores the secret", async () => {
    const result = await openAndLoad(activeLinkState());
    revealShareLinkSecretMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
    });
    const popup = { closed: false, location: { href: "" }, close: vi.fn() } as unknown as Window;

    await act(async () => {
      await result.current.whatsapp(popup);
    });

    expect((popup as unknown as { location: { href: string } }).location.href).toContain(
      "https://wa.me/?text="
    );
    expect((popup as unknown as { location: { href: string } }).location.href).toContain(
      encodeURIComponent("/share/abcdefgh12345678#P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc")
    );

    const serializedState = JSON.stringify(result.current.state);
    expect(serializedState).not.toContain("P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc");
  });

  it("whatsapp closes the pre-opened popup if reveal fails, leaving no orphan tab", async () => {
    const result = await openAndLoad(activeLinkState());
    revealShareLinkSecretMock.mockRejectedValue(
      new ShareLinkClientError("SHARE_LINK_STATE_CONFLICT", "conflict")
    );
    const closeMock = vi.fn();
    const popup = { closed: false, location: { href: "" }, close: closeMock } as unknown as Window;

    await act(async () => {
      await result.current.whatsapp(popup);
    });

    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("whatsapp closes the pre-opened popup if the navigation attempt itself throws, leaving no orphan tab", async () => {
    const result = await openAndLoad(activeLinkState());
    revealShareLinkSecretMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
    });
    const closeMock = vi.fn();
    const popup = {
      closed: false,
      // Simulates a browser throwing when the parent attempts to
      // navigate a popup it no longer has permission to touch (e.g. the
      // user navigated it away manually in the meantime).
      set location(_value: unknown) {
        throw new DOMException("Blocked a frame with origin from accessing a cross-origin frame.");
      },
      close: closeMock,
    } as unknown as Window;

    await act(async () => {
      await result.current.whatsapp(popup);
    });

    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(result.current.state.actionError).toBeTruthy();
  });

  it("whatsapp falls back to window.open when no popup handle is supplied", async () => {
    const result = await openAndLoad(activeLinkState());
    revealShareLinkSecretMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
    });
    const windowOpenMock = vi.spyOn(window, "open").mockReturnValue(null);

    await act(async () => {
      await result.current.whatsapp(null);
    });

    expect(windowOpenMock).toHaveBeenCalledTimes(1);
    expect(windowOpenMock.mock.calls[0][0]).toContain("https://wa.me/?text=");
  });

  it("duplicate rapid clicks across different share channels cannot trigger duplicate reveals", async () => {
    const result = await openAndLoad(activeLinkState());
    let resolveReveal!: (value: {
      linkId: string;
      publicId: string;
      secret: string;
    }) => void;
    revealShareLinkSecretMock.mockReturnValue(
      new Promise((resolve) => {
        resolveReveal = resolve;
      })
    );
    vi.stubGlobal("navigator", {
      share: vi.fn().mockResolvedValue(undefined),
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    let firstCall: Promise<void>;
    let secondCall: Promise<void>;
    act(() => {
      firstCall = result.current.copyLink();
      secondCall = result.current.nativeShare();
    });

    expect(revealShareLinkSecretMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveReveal({
        linkId: LINK_ID,
        publicId: "abcdefgh12345678",
        secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
      });
      await firstCall;
      await secondCall;
    });

    expect(revealShareLinkSecretMock).toHaveBeenCalledTimes(1);
  });
});

describe("useShareLink - Objective B: shareUpdate (one-action orchestration)", () => {
  async function openAndLoad(
    initialData: ShareLinkManagementStateData,
    project: TaskProjectGroup = projectGroup()
  ) {
    getShareLinkManagementStateMock.mockResolvedValueOnce(initialData);
    const { result } = renderHook(() => useShareLink());

    act(() => {
      result.current.openPanel(project);
    });
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));

    return result;
  }

  it("category A: first-time share creates a draft transparently, applies safe default settings and automatic task grouping, saves, and activates", async () => {
    const result = await openAndLoad(
      noLinkState(),
      projectGroupWithSubtasks([
        subtask({ id: 1, title: "New task", status: "New" }),
        subtask({ id: 2, title: "Done task", status: "Done" }),
      ])
    );
    createShareLinkDraftMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      state: "draft",
      createdAt: "2026-08-10T00:00:00Z",
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce(draftLinkState());
    saveShareConfigurationMock.mockResolvedValue({
      linkId: LINK_ID,
      configurationVersion: 1,
      currentUpdate: null,
    });
    activateShareLinkMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      state: "active",
      configurationVersion: 1,
      activatedAt: "2026-08-10T00:01:00Z",
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce(activeLinkState());

    await act(async () => {
      await result.current.shareUpdate({ updateBody: "", pin: null, clearPin: false, attachmentResourceIds: [] });
    });

    expect(createShareLinkDraftMock).toHaveBeenCalledWith(PROJECT_ID);
    expect(saveShareConfigurationMock).toHaveBeenCalledWith(LINK_ID, {
      settings: {
        titleVisible: true,
        statusVisible: true,
        targetDateVisible: false,
        commentsEnabled: false,
        contentDirection: "auto",
        clientFacingSubtitle: null,
      },
      tasks: [
        { subtaskId: "1", publicGroup: "coming_up", waitingForClientFeedback: false, displayOrder: 0 },
        { subtaskId: "2", publicGroup: "completed", waitingForClientFeedback: false, displayOrder: 1 },
      ],
    });
    expect(activateShareLinkMock).toHaveBeenCalledWith(LINK_ID);
    expect(result.current.state.actionError).toBeNull();
  });

  it("category B: an already-active link with a persisted task mapping is not reactivated, and its task mapping is never resent/recomputed", async () => {
    const existingMappedTasks = [
      { subtaskId: "1", publicGroup: "in_progress" as const, waitingForClientFeedback: false, displayOrder: 0 },
    ];
    const result = await openAndLoad(
      { ...activeLinkState(), mappedTasks: existingMappedTasks },
      projectGroupWithSubtasks([subtask({ id: 1, status: "New" })])
    );
    saveShareConfigurationMock.mockResolvedValue({
      linkId: LINK_ID,
      configurationVersion: 1,
      currentUpdate: { version: 1, publishedAt: "2026-08-12T00:00:00Z" },
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce({
      ...activeLinkState(),
      mappedTasks: existingMappedTasks,
    });

    await act(async () => {
      await result.current.shareUpdate({
        updateBody: "Homepage is live.",
        pin: null, clearPin: false,
        attachmentResourceIds: [],
      });
    });

    expect(createShareLinkDraftMock).not.toHaveBeenCalled();
    expect(activateShareLinkMock).not.toHaveBeenCalled();
    expect(saveShareConfigurationMock).toHaveBeenCalledWith(LINK_ID, {
      publishUpdate: { body: "Homepage is live." },
    });
  });

  it("category C: owner-customized persisted task mapping always wins -- automatic grouping is never recomputed once anything is mapped", async () => {
    // Task 1's persisted group ("completed") deliberately disagrees with
    // what the automatic default would produce for its internal status
    // ("New" -> "coming_up") -- if shareUpdate ever recomputed instead of
    // leaving `tasks` untouched, this mismatch would be silently
    // overwritten on the very next Share update.
    const customMapping = [
      { subtaskId: "1", publicGroup: "completed" as const, waitingForClientFeedback: false, displayOrder: 0 },
    ];
    const result = await openAndLoad(
      { ...activeLinkState(), mappedTasks: customMapping },
      projectGroupWithSubtasks([subtask({ id: 1, status: "New" })])
    );
    saveShareConfigurationMock.mockResolvedValue({
      linkId: LINK_ID,
      configurationVersion: 1,
      currentUpdate: { version: 1, publishedAt: "2026-08-12T00:00:00Z" },
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce({
      ...activeLinkState(),
      mappedTasks: customMapping,
    });

    await act(async () => {
      await result.current.shareUpdate({ updateBody: "Update", pin: null, clearPin: false, attachmentResourceIds: [] });
    });

    const request = saveShareConfigurationMock.mock.calls[0][1];
    expect(request.tasks).toBeUndefined();
  });

  it("category E: PIN is opt-in -- omitted when neither pin nor clearPin is supplied", async () => {
    const result = await openAndLoad(
      { ...activeLinkState(), mappedTasks: [{ subtaskId: "1", publicGroup: "in_progress", waitingForClientFeedback: false, displayOrder: 0 }] },
      projectGroupWithSubtasks([subtask({ id: 1 })])
    );
    setSharePinMock.mockResolvedValue({
      linkId: LINK_ID,
      hasPin: true,
      state: "active",
      configurationVersion: 1,
      updatedAt: "2026-08-12T00:00:00Z",
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce(activeLinkState());

    await act(async () => {
      await result.current.shareUpdate({ updateBody: "", pin: "4242", clearPin: false, attachmentResourceIds: [] });
    });

    expect(setSharePinMock).toHaveBeenCalledWith(LINK_ID, "4242");
    // Nothing else changed (no update body, no attachments, tasks already
    // mapped) -- saveShareConfiguration must not be called with an empty
    // request just to carry the PIN, since PIN is its own separate call.
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
  });

  it("FINAL PIN UX: existing PIN -> clearPin: true calls the existing clear-PIN path exactly once, and never setSharePin", async () => {
    const mappedTasks = [
      { subtaskId: "1", publicGroup: "in_progress" as const, waitingForClientFeedback: false, displayOrder: 0 },
    ];
    const result = await openAndLoad(
      { ...activeLinkState({ hasPin: true }), mappedTasks },
      projectGroupWithSubtasks([subtask({ id: 1 })])
    );
    clearSharePinMock.mockResolvedValue({
      linkId: LINK_ID,
      hasPin: false,
      state: "active",
      configurationVersion: 1,
      updatedAt: "2026-08-18T00:00:00Z",
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce({
      ...activeLinkState({ hasPin: false }),
      mappedTasks,
    });

    await act(async () => {
      await result.current.shareUpdate({ updateBody: "", pin: null, clearPin: true, attachmentResourceIds: [] });
    });

    expect(clearSharePinMock).toHaveBeenCalledWith(LINK_ID);
    expect(clearSharePinMock).toHaveBeenCalledTimes(1);
    expect(setSharePinMock).not.toHaveBeenCalled();
    expect(result.current.state.actionError).toBeNull();
  });

  it("FINAL PIN UX: removing a PIN does not create a draft, does not recreate/rotate the link, and does not resend task/Resource mappings or publicLabel", async () => {
    const mappedTasks = [
      { subtaskId: "1", publicGroup: "in_progress" as const, waitingForClientFeedback: false, displayOrder: 0 },
    ];
    const mappedResources = [
      { resourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", publicLabel: "Brand brief", canDownload: false, displayOrder: 0 },
    ];
    const result = await openAndLoad(
      { ...activeLinkState({ hasPin: true }), mappedTasks, mappedResources },
      projectGroupWithSubtasks([subtask({ id: 1 })])
    );
    clearSharePinMock.mockResolvedValue({
      linkId: LINK_ID,
      hasPin: false,
      state: "active",
      configurationVersion: 1,
      updatedAt: "2026-08-18T00:00:00Z",
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce({
      ...activeLinkState({ hasPin: false }),
      mappedTasks,
      mappedResources,
    });

    await act(async () => {
      await result.current.shareUpdate({ updateBody: "", pin: null, clearPin: true, attachmentResourceIds: [] });
    });

    expect(createShareLinkDraftMock).not.toHaveBeenCalled();
    expect(rotateShareLinkSecretMock).not.toHaveBeenCalled();
    // No update/attachments/first-share settings were touched, and tasks
    // are already mapped -- saveShareConfiguration must not be called at
    // all for a pure PIN-removal submission, so no mapping/publicLabel
    // can possibly be resent or rewritten.
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
  });

  it("FINAL PIN UX: a failed clear-PIN surfaces stage share_update_pin_failed and never falsely reports success", async () => {
    const result = await openAndLoad(activeLinkState({ hasPin: true }), projectGroupWithSubtasks([subtask({ id: 1 })]));
    clearSharePinMock.mockRejectedValue(new ShareLinkClientError("SHARE_LINK_STATE_CONFLICT", "conflict"));

    await act(async () => {
      await result.current.shareUpdate({ updateBody: "", pin: null, clearPin: true, attachmentResourceIds: [] });
    });

    expect(result.current.state.actionPending).toBeNull();
    expect(result.current.state.actionError).toBeTruthy();
    expect(result.current.state.actionErrorStage).toBe("share_update_pin_failed");
  });

  it("FINAL PIN UX: a successful PIN removal refreshes management state so the owner UI reflects hasPin: false afterward", async () => {
    const result = await openAndLoad(activeLinkState({ hasPin: true }), projectGroupWithSubtasks([subtask({ id: 1 })]));
    clearSharePinMock.mockResolvedValue({
      linkId: LINK_ID,
      hasPin: false,
      state: "active",
      configurationVersion: 1,
      updatedAt: "2026-08-18T00:00:00Z",
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce(activeLinkState({ hasPin: false }));

    await act(async () => {
      await result.current.shareUpdate({ updateBody: "", pin: null, clearPin: true, attachmentResourceIds: [] });
    });

    expect(result.current.state.data?.link?.hasPin).toBe(false);
  });

  it("FINAL PIN UX: the existing PIN value is never present anywhere in hook state or in any client-call argument", async () => {
    const result = await openAndLoad(activeLinkState({ hasPin: true }), projectGroupWithSubtasks([subtask({ id: 1 })]));
    clearSharePinMock.mockResolvedValue({
      linkId: LINK_ID,
      hasPin: false,
      state: "active",
      configurationVersion: 1,
      updatedAt: "2026-08-18T00:00:00Z",
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce(activeLinkState({ hasPin: false }));

    await act(async () => {
      await result.current.shareUpdate({ updateBody: "", pin: null, clearPin: true, attachmentResourceIds: [] });
    });

    // clearSharePin's own contract takes only the link id -- there is no
    // PIN value parameter to leak in the first place. The management
    // state schema itself (managedShareLinkSchema) exposes only the
    // boolean hasPin, never a pin/plaintext field, so there is nothing in
    // result.current.state for an existing PIN's value to appear in.
    expect(clearSharePinMock).toHaveBeenCalledWith(LINK_ID);
    expect(clearSharePinMock.mock.calls[0]).toHaveLength(1);
    expect(result.current.state.data?.link).not.toHaveProperty("pin");
  });

  it("Attachments: a selected, already-mapped Resource keeps its persisted publicLabel/canDownload/displayOrder in the request", async () => {
    const mappedResources = [
      { resourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", publicLabel: "Brand brief", canDownload: true, displayOrder: 3 },
    ];
    fetchTaskResourcesMock.mockResolvedValue([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        user_id: "user-1",
        project_id: PROJECT_ID,
        task_id: null,
        resource_type: "link" as const,
        title: "brief-internal.pdf",
        url: "https://example.com/brief",
        storage_path: null,
        file_name: null,
        mime_type: null,
        size_bytes: null,
        notes: null,
        created_at: "2026-08-03T10:00:00.000Z",
        updated_at: "2026-08-03T10:00:00.000Z",
      },
    ]);
    const result = await openAndLoad(
      { ...activeLinkState(), mappedTasks: [{ subtaskId: "1", publicGroup: "in_progress", waitingForClientFeedback: false, displayOrder: 0 }], mappedResources },
      projectGroupWithSubtasks([subtask({ id: 1 })])
    );
    saveShareConfigurationMock.mockResolvedValue({
      linkId: LINK_ID,
      configurationVersion: 1,
      currentUpdate: null,
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce({ ...activeLinkState(), mappedResources });

    await act(async () => {
      await result.current.shareUpdate({
        updateBody: "",
        pin: null, clearPin: false,
        attachmentResourceIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      });
    });

    expect(saveShareConfigurationMock).toHaveBeenCalledWith(LINK_ID, {
      resources: [
        {
          resourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          publicLabel: "Brand brief",
          canDownload: true,
          displayOrder: 3,
        },
      ],
    });
  });

  it("a failure partway through the orchestration surfaces actionError and never falsely reports success", async () => {
    const result = await openAndLoad(noLinkState(), projectGroupWithSubtasks([subtask({ id: 1 })]));
    createShareLinkDraftMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      state: "draft",
      createdAt: "2026-08-10T00:00:00Z",
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce(draftLinkState());
    saveShareConfigurationMock.mockRejectedValue(
      new ShareLinkClientError("SHARE_LINK_STATE_CONFLICT", "conflict")
    );

    await act(async () => {
      await result.current.shareUpdate({ updateBody: "", pin: null, clearPin: false, attachmentResourceIds: [] });
    });

    expect(activateShareLinkMock).not.toHaveBeenCalled();
    expect(result.current.state.actionPending).toBeNull();
    expect(result.current.state.actionError).toBeTruthy();
  });

  it("opening the panel never calls shareUpdate's own orchestrated endpoints on its own", async () => {
    await openAndLoad(noLinkState());
    expect(createShareLinkDraftMock).not.toHaveBeenCalled();
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
    expect(activateShareLinkMock).not.toHaveBeenCalled();
  });
});

describe("useShareLink - REAL BROWSER DEFECT #2 REGRESSION: shareUpdate against an existing, already-configured Draft link", () => {
  // Reproduces the exact reported browser state: an existing Draft link
  // (from earlier browser-acceptance work) with title/status already
  // visible, one persisted mapped task, one persisted mapped Resource
  // with its own publicLabel, no PIN, and an owner-typed Client update --
  // then Share update is clicked.
  const EXISTING_RESOURCE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const UPDATE_BODY =
    "Work is currently in progress. This is a test client update for the Phase 3 sharing flow.";

  function existingDraftState(): ShareLinkManagementStateData {
    const base = draftLinkState();
    return {
      link: { ...base.link, titleVisible: true, statusVisible: true },
      mappedTasks: [
        { subtaskId: "1", publicGroup: "in_progress", waitingForClientFeedback: false, displayOrder: 0 },
      ],
      mappedResources: [
        {
          resourceId: EXISTING_RESOURCE_ID,
          publicLabel: "Phase 3 Browser Fixture Resource",
          canDownload: false,
          displayOrder: 0,
        },
      ],
      currentUpdate: null,
    };
  }

  async function openAndLoad(initialData: ShareLinkManagementStateData, project: TaskProjectGroup) {
    getShareLinkManagementStateMock.mockResolvedValueOnce(initialData);
    const { result } = renderHook(() => useShareLink());

    act(() => {
      result.current.openPanel(project);
    });
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));

    return result;
  }

  it("preserves persisted configuration exactly: no createDraft, no settings/task-remap, exact resource metadata retained, update published, activated exactly once, no false success on failure", async () => {
    const project = projectGroupWithSubtasks([subtask({ id: 1, status: "New" })]);
    const result = await openAndLoad(existingDraftState(), project);

    saveShareConfigurationMock.mockResolvedValue({
      linkId: LINK_ID,
      configurationVersion: 1,
      currentUpdate: { version: 1, publishedAt: "2026-08-13T00:00:00Z" },
    });
    activateShareLinkMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      state: "active",
      configurationVersion: 1,
      activatedAt: "2026-08-13T00:01:00Z",
    });
    getShareLinkManagementStateMock.mockResolvedValueOnce({
      ...existingDraftState(),
      link: { ...existingDraftState().link, state: "active" },
    });

    await act(async () => {
      await result.current.shareUpdate({
        updateBody: UPDATE_BODY,
        pin: null, clearPin: false,
        attachmentResourceIds: [EXISTING_RESOURCE_ID],
      });
    });

    // 1. create draft: skipped -- the link already exists.
    expect(createShareLinkDraftMock).not.toHaveBeenCalled();
    // 4. PIN: skipped -- PIN is off.
    expect(setSharePinMock).not.toHaveBeenCalled();

    // 2. save configuration: called exactly once, with settings and tasks
    // both OMITTED (an existing link's settings are untouched; the one
    // already-mapped task is never recomputed/resent), the resource's
    // exact persisted publicLabel/canDownload/displayOrder unchanged, and
    // the client update included.
    expect(saveShareConfigurationMock).toHaveBeenCalledTimes(1);
    const [savedLinkId, request] = saveShareConfigurationMock.mock.calls[0];
    expect(savedLinkId).toBe(LINK_ID);
    expect(request.settings).toBeUndefined();
    expect(request.tasks).toBeUndefined();
    expect(request.resources).toEqual([
      {
        resourceId: EXISTING_RESOURCE_ID,
        publicLabel: "Phase 3 Browser Fixture Resource",
        canDownload: false,
        displayOrder: 0,
      },
    ]);
    expect(request.publishUpdate).toEqual({ body: UPDATE_BODY });

    // 5. activate: called exactly once (the link was a draft).
    expect(activateShareLinkMock).toHaveBeenCalledTimes(1);
    expect(activateShareLinkMock).toHaveBeenCalledWith(LINK_ID);

    // Save happened strictly before activate.
    const saveOrder = saveShareConfigurationMock.mock.invocationCallOrder[0];
    const activateOrder = activateShareLinkMock.mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(activateOrder);

    expect(result.current.state.actionError).toBeNull();
    expect(result.current.state.actionErrorStage).toBeNull();
  });

  it("a save-configuration failure surfaces stage share_update_save_failed and never reaches activate (no false success)", async () => {
    const result = await openAndLoad(existingDraftState(), projectGroupWithSubtasks([subtask({ id: 1 })]));
    saveShareConfigurationMock.mockRejectedValue(
      new ShareLinkClientError("SHARE_LINK_STATE_CONFLICT", "conflict")
    );

    await act(async () => {
      await result.current.shareUpdate({
        updateBody: UPDATE_BODY,
        pin: null, clearPin: false,
        attachmentResourceIds: [EXISTING_RESOURCE_ID],
      });
    });

    expect(activateShareLinkMock).not.toHaveBeenCalled();
    expect(result.current.state.actionPending).toBeNull();
    expect(result.current.state.actionError).toBeTruthy();
    expect(result.current.state.actionErrorStage).toBe("share_update_save_failed");
  });

  it("an activate failure (after save already succeeded) surfaces stage share_update_activate_failed, not the generic save stage", async () => {
    const result = await openAndLoad(existingDraftState(), projectGroupWithSubtasks([subtask({ id: 1 })]));
    saveShareConfigurationMock.mockResolvedValue({
      linkId: LINK_ID,
      configurationVersion: 1,
      currentUpdate: null,
    });
    activateShareLinkMock.mockRejectedValue(
      new ShareLinkClientError("SHARE_LINK_ANOTHER_LINK_ACTIVE", "conflict")
    );

    await act(async () => {
      await result.current.shareUpdate({ updateBody: UPDATE_BODY, pin: null, clearPin: false, attachmentResourceIds: [] });
    });

    expect(saveShareConfigurationMock).toHaveBeenCalledTimes(1);
    expect(result.current.state.actionErrorStage).toBe("share_update_activate_failed");
    expect(result.current.state.actionError).toMatch(/already active/i);
  });

  it("a createDraft failure (first-time share) surfaces stage share_update_create_draft_failed and never calls save or activate", async () => {
    const result = await openAndLoad(noLinkState(), projectGroupWithSubtasks([subtask({ id: 1 })]));
    createShareLinkDraftMock.mockRejectedValue(new ShareLinkClientError("PROJECT_ARCHIVED", "archived"));

    await act(async () => {
      await result.current.shareUpdate({ updateBody: "", pin: null, clearPin: false, attachmentResourceIds: [] });
    });

    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
    expect(activateShareLinkMock).not.toHaveBeenCalled();
    expect(result.current.state.actionErrorStage).toBe("share_update_create_draft_failed");
  });

  it("a PIN failure (after save already succeeded) surfaces stage share_update_pin_failed and never proceeds to activate", async () => {
    const result = await openAndLoad(existingDraftState(), projectGroupWithSubtasks([subtask({ id: 1 })]));
    saveShareConfigurationMock.mockResolvedValue({
      linkId: LINK_ID,
      configurationVersion: 1,
      currentUpdate: null,
    });
    setSharePinMock.mockRejectedValue(new ShareLinkClientError("SHARE_LINK_STATE_CONFLICT", "conflict"));

    await act(async () => {
      await result.current.shareUpdate({ updateBody: UPDATE_BODY, pin: "4242", clearPin: false, attachmentResourceIds: [] });
    });

    expect(saveShareConfigurationMock).toHaveBeenCalledTimes(1);
    expect(activateShareLinkMock).not.toHaveBeenCalled();
    expect(result.current.state.actionErrorStage).toBe("share_update_pin_failed");
  });

  it("a selected attachment that cannot be resolved fails safely before any network call, never sending a truncated resources array that could drop the persisted mapping", async () => {
    const result = await openAndLoad(existingDraftState(), projectGroupWithSubtasks([subtask({ id: 1 })]));

    await act(async () => {
      await result.current.shareUpdate({
        updateBody: "",
        pin: null, clearPin: false,
        attachmentResourceIds: ["ffffffff-ffff-4fff-8fff-ffffffffffff"],
      });
    });

    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
    expect(result.current.state.actionErrorStage).toBe("share_update_save_failed");
  });
});

describe("useShareLink - Objective B: emailLink (mailto: channel)", () => {
  async function openAndLoad(initialData: ShareLinkManagementStateData, project: TaskProjectGroup = projectGroup()) {
    getShareLinkManagementStateMock.mockResolvedValueOnce(initialData);
    const { result } = renderHook(() => useShareLink());

    act(() => {
      result.current.openPanel(project);
    });
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));

    return result;
  }

  it("reveals the secret and opens a mailto: link with a safe subject/body containing the URL, never storing the secret", async () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });

    const result = await openAndLoad(activeLinkState());
    revealShareLinkSecretMock.mockResolvedValue({
      linkId: LINK_ID,
      publicId: "abcdefgh12345678",
      secret: "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc",
    });

    await act(async () => {
      await result.current.emailLink();
    });

    expect(window.location.href).toContain("mailto:");
    expect(window.location.href).toContain(encodeURIComponent("Project update: Website launch"));
    expect(window.location.href).toContain(
      encodeURIComponent("/share/abcdefgh12345678#P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc")
    );

    const serializedState = JSON.stringify(result.current.state);
    expect(serializedState).not.toContain("P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc");
  });
});
