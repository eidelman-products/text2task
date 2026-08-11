// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";

import { ShareLinkPanel } from "./share-link-panel";
import type { ShareLinkPanelState } from "./use-share-link";

function baseState(overrides: Partial<ShareLinkPanelState> = {}): ShareLinkPanelState {
  return {
    isOpen: true,
    project: {
      key: "project::1",
      project_id: "11111111-1111-4111-8111-111111111111",
      project: null,
      clientName: "Acme",
      projectTitle: "Website launch",
      projectSummary: "",
      tasks: [],
      subtasks: [],
      primaryTask: {
        id: 1,
        client: null,
        project: null,
        task: "Design hero",
        amount: "",
        deadline: "",
        priority: "Medium",
        status: "New",
        source: "manual",
        project_id: "11111111-1111-4111-8111-111111111111",
        created_at: "2026-08-03T10:00:00.000Z",
      },
      taskIds: [1],
      amount: "",
      deadline: "",
      priority: "Medium",
      status: "New",
      source: "manual",
      hasContactDetails: false,
      subtaskCount: 0,
      completedSubtaskCount: 0,
    },
    projectId: "11111111-1111-4111-8111-111111111111",
    isLoading: false,
    loadError: null,
    data: null,
    actionPending: null,
    actionError: null,
    copyStatus: "idle",
    ...overrides,
  };
}

function linkData(state: "draft" | "active" | "disabled" | "expired") {
  return {
    link: {
      id: "22222222-2222-4222-8222-222222222222",
      publicId: "abcdefgh12345678ijklmnop",
      state,
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
      activatedAt: state === "active" ? "2026-08-10T00:00:00Z" : null,
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

function renderPanel(state: ShareLinkPanelState, overrides: Partial<Parameters<typeof ShareLinkPanel>[0]> = {}) {
  function Wrapper() {
    const triggerRef = useRef<HTMLElement | null>(null);
    return (
      <ShareLinkPanel
        state={state}
        triggerRef={triggerRef}
        onClose={vi.fn()}
        onRetry={vi.fn()}
        onCreateDraft={vi.fn()}
        onActivate={vi.fn()}
        onDisable={vi.fn()}
        onReenable={vi.fn()}
        onRevoke={vi.fn()}
        onCopyLink={vi.fn()}
        {...overrides}
      />
    );
  }
  return render(<Wrapper />);
}

describe("ShareLinkPanel - rendering per state", () => {
  it("renders nothing when closed", () => {
    renderPanel(baseState({ isOpen: false }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a loading indicator while isLoading", () => {
    renderPanel(baseState({ isLoading: true }));
    expect(screen.getByText(/loading share link status/i)).toBeInTheDocument();
  });

  it("shows the load error and a retry button", async () => {
    const onRetry = vi.fn();
    renderPanel(baseState({ loadError: "Could not load." }), { onRetry });

    expect(screen.getByText("Could not load.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the no-link setup state with a create-draft action", async () => {
    const onCreateDraft = vi.fn();
    renderPanel(baseState({ data: { link: null, mappedTaskIds: [], mappedResourceIds: [], currentUpdate: null } }), {
      onCreateDraft,
    });

    expect(screen.getByText(/no client share link exists/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /create draft link/i }));
    expect(onCreateDraft).toHaveBeenCalledTimes(1);
  });

  it("draft state shows Activate and Revoke, not Copy/Disable/Re-enable", () => {
    renderPanel(baseState({ data: linkData("draft") }));

    expect(screen.getByRole("button", { name: /activate link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revoke link/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy client link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /disable link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /re-enable link/i })).not.toBeInTheDocument();
  });

  it("active state shows Copy link and Disable, not Activate/Re-enable", async () => {
    const onCopyLink = vi.fn();
    renderPanel(baseState({ data: linkData("active") }), { onCopyLink });

    expect(screen.getByRole("button", { name: /copy client link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disable link/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /activate link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /re-enable link/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /copy client link/i }));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });

  it("shows 'Link copied' once copyStatus is copied", () => {
    renderPanel(baseState({ data: linkData("active"), copyStatus: "copied" }));
    expect(screen.getByRole("button", { name: /link copied/i })).toBeInTheDocument();
  });

  it("disabled state shows Re-enable, not Copy/Activate/Disable", async () => {
    const onReenable = vi.fn();
    renderPanel(baseState({ data: linkData("disabled") }), { onReenable });

    expect(screen.getByRole("button", { name: /re-enable link/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy client link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^activate link$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^disable link$/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /re-enable link/i }));
    expect(onReenable).toHaveBeenCalledTimes(1);
  });

  it("expired state shows only Status and Revoke -- no Activate/Copy/Disable/Re-enable", async () => {
    // 'expired' is not currently reachable through any delivered Phase 1B
    // RPC (no write path sets it -- see the migration's own "future expiry
    // sweep" comment), but the read contract's type retains it for
    // forward compatibility, and share-link-panel.tsx already renders it
    // defensively. This test covers that defensive branch directly.
    const onRevoke = vi.fn();
    renderPanel(baseState({ data: linkData("expired") }), { onRevoke });

    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^revoke link$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /activate link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy client link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^disable link$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /re-enable link/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^revoke link$/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirm revoke/i }));
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });

  it("revoke requires a second confirming click before calling onRevoke", async () => {
    const onRevoke = vi.fn();
    renderPanel(baseState({ data: linkData("active") }), { onRevoke });

    await userEvent.click(screen.getByRole("button", { name: /^revoke link$/i }));
    expect(onRevoke).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /confirm revoke/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /confirm revoke/i }));
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });

  it("disable requires a second confirming click before calling onDisable", async () => {
    const onDisable = vi.fn();
    renderPanel(baseState({ data: linkData("active") }), { onDisable });

    await userEvent.click(screen.getByRole("button", { name: /^disable link$/i }));
    expect(onDisable).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /confirm disable/i }));
    expect(onDisable).toHaveBeenCalledTimes(1);
  });

  it("shows the action error banner when present", () => {
    renderPanel(baseState({ data: linkData("active"), actionError: "That action failed." }));
    expect(screen.getByRole("alert")).toHaveTextContent("That action failed.");
  });

  it("never renders the plaintext secret anywhere in the DOM", () => {
    renderPanel(baseState({ data: linkData("active") }));
    expect(document.body.textContent).not.toMatch(/[A-Za-z0-9_-]{43}/);
  });
});
