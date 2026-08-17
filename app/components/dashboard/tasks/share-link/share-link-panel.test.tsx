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
    actionErrorStage: null,
    copyStatus: "idle",
    resources: [],
    resourcesLoading: false,
    resourcesError: null,
    previewOpen: false,
    previewData: null,
    ...overrides,
  };
}

function linkData(
  state: "draft" | "active" | "disabled" | "expired",
  linkOverrides: Record<string, unknown> = {}
) {
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
      ...linkOverrides,
    },
    mappedTasks: [],
    mappedResources: [],
    currentUpdate: null,
  };
}

function PanelHarness({
  state,
  overrides = {},
}: {
  state: ShareLinkPanelState;
  overrides?: Partial<Parameters<typeof ShareLinkPanel>[0]>;
}) {
  const triggerRef = useRef<HTMLElement | null>(null);
  return (
    <ShareLinkPanel
      state={state}
      triggerRef={triggerRef}
      onClose={vi.fn()}
      onRetry={vi.fn()}
      onCopyLink={vi.fn()}
      onNativeShare={vi.fn()}
      onWhatsApp={vi.fn()}
      onEmail={vi.fn()}
      onShareUpdate={vi.fn()}
      onOpenPreview={vi.fn()}
      onClosePreview={vi.fn()}
      {...overrides}
    />
  );
}

function renderPanel(state: ShareLinkPanelState, overrides: Partial<Parameters<typeof ShareLinkPanel>[0]> = {}) {
  return render(<PanelHarness state={state} overrides={overrides} />);
}

describe("ShareLinkPanel - top-level rendering", () => {
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

  it("shows the action error banner when present", () => {
    renderPanel(baseState({ data: linkData("active"), actionError: "That action failed." }));
    expect(screen.getByRole("alert")).toHaveTextContent("That action failed.");
  });

  it("never renders the plaintext secret anywhere in the DOM", () => {
    renderPanel(baseState({ data: linkData("active") }));
    expect(document.body.textContent).not.toMatch(/[A-Za-z0-9_-]{43}/);
  });
});

describe("ShareLinkPanel - final simplified normal panel content (real browser defect #3 turn)", () => {
  it("shows exactly the required simplified content for a no-link project: Share with client, Project progress, Client update, Attachments, PIN, Share update", () => {
    renderPanel(baseState({ data: { link: null, mappedTasks: [], mappedResources: [], currentUpdate: null } }));

    expect(screen.getByRole("heading", { name: /^share with client$/i })).toBeInTheDocument();
    expect(screen.getByText(/^project progress$/i)).toBeInTheDocument();
    expect(screen.getByText(/^client update$/i)).toBeInTheDocument();
    expect(screen.getByText(/^attachments$/i)).toBeInTheDocument();
    expect(screen.getByText(/protect with a pin \(optional\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^share update$/i })).toBeInTheDocument();
  });

  it("shows the same simplified content for an existing active link -- no old flat layout, no technical controls", () => {
    renderPanel(baseState({ data: linkData("active") }));

    expect(screen.getByRole("heading", { name: /^share with client$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^share update$/i })).toBeInTheDocument();

    for (const forbidden of [
      /^share project update$/i,
      /edit what client sees/i,
      /^manage link$/i,
      /^draft$/i,
      /activate link/i,
      /revoke link/i,
      /set expiry/i,
      /text direction/i,
      /allow client comments/i,
      /save configuration/i,
    ]) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: forbidden })).not.toBeInTheDocument();
    }
  });

  it("does not show a duplicate 'Share project update' heading -- only the dialog's own 'Share with client' heading appears", () => {
    renderPanel(baseState({ data: linkData("active") }));
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Share with client");
    expect(screen.queryByText(/share project update/i)).not.toBeInTheDocument();
  });

  it("Share update calls onShareUpdate with the built submission", async () => {
    const onShareUpdate = vi.fn();
    renderPanel(baseState({ data: linkData("active") }), { onShareUpdate });

    await userEvent.type(screen.getByPlaceholderText(/optional message to your client/i), "Homepage is live.");
    await userEvent.click(screen.getByRole("button", { name: /^share update$/i }));

    expect(onShareUpdate).toHaveBeenCalledTimes(1);
    expect(onShareUpdate.mock.calls[0][0]).toMatchObject({
      updateBody: "Homepage is live.",
      pin: null,
      attachmentResourceIds: [],
    });
  });

  it("opening the panel never calls onShareUpdate on its own", () => {
    const onShareUpdate = vi.fn();
    renderPanel(baseState({ data: linkData("active") }), { onShareUpdate });
    expect(onShareUpdate).not.toHaveBeenCalled();
  });
});

describe("ShareLinkPanel - result view after a successful Share update", () => {
  it("shows the result view (Copy/WhatsApp/Email/Preview, no Rotate, no Manage link) once a Share update completes successfully", () => {
    const { rerender } = renderPanel(baseState({ data: linkData("draft"), actionPending: "shareUpdate" }));

    rerender(
      <PanelHarness state={baseState({ data: linkData("active"), actionPending: null, actionError: null })} />
    );

    expect(screen.getByRole("heading", { name: /project shared/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy client link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^email$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rotate link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^manage link$/i })).not.toBeInTheDocument();
  });

  it("does NOT show the result view when Share update fails, and never reports false success", () => {
    const { rerender } = renderPanel(baseState({ data: linkData("draft"), actionPending: "shareUpdate" }));

    rerender(
      <PanelHarness
        state={baseState({
          data: linkData("draft"),
          actionPending: null,
          actionError: "That action could not be completed.",
          actionErrorStage: "share_update_activate_failed",
        })}
      />
    );

    expect(screen.queryByRole("heading", { name: /project shared/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^share update$/i })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("That action could not be completed.");
  });

  it("a fresh panel open always returns to the quick-share view, even if the previous session ended on the result view", () => {
    const activeState = baseState({ data: linkData("active"), actionPending: null, actionError: null });
    const { rerender } = renderPanel(baseState({ data: linkData("draft"), actionPending: "shareUpdate" }));
    rerender(<PanelHarness state={activeState} />);
    expect(screen.getByRole("heading", { name: /project shared/i })).toBeInTheDocument();

    // Close, then reopen for a different project -- projectId changes.
    rerender(<PanelHarness state={baseState({ isOpen: false })} />);
    rerender(
      <PanelHarness
        state={baseState({ projectId: "99999999-9999-4999-8999-999999999999", data: linkData("active") })}
      />
    );

    expect(screen.queryByRole("heading", { name: /project shared/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^share update$/i })).toBeInTheDocument();
  });
});
