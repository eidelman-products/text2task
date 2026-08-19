// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";

import { ShareLinkPanel } from "./share-link-panel";
import type { ShareLinkPanelState } from "./use-share-link";

// Phase 5D -- ShareLinkPanel now conditionally fetches the Client
// Communication unread badge (useOwnerShareMessages) whenever a link
// with an id is open. None of the tests below exercise that feature
// directly, but without a stub, that hook would attempt a real network
// call on every render that has a link -- stubbed here to a generic,
// deterministic failure response so every test in this file stays
// network-free (the badge hook fails closed on any error, so this
// never affects what these tests assert on).
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, code: "INTERNAL_ERROR", error: "stub" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("ShareLinkPanel - Phase 5D Client messages entry point", () => {
  it("33. renders the Client messages entry point when a link exists", () => {
    renderPanel(baseState({ data: linkData("active") }));
    expect(screen.getByRole("button", { name: /client messages/i })).toBeInTheDocument();
  });

  it("does not render the entry point when there is no link yet (fresh draft)", () => {
    renderPanel(baseState({ data: null }));
    expect(screen.queryByRole("button", { name: /client messages/i })).not.toBeInTheDocument();
  });

  it("34. clicking the entry point swaps the panel content to the communication view", async () => {
    const user = userEvent.setup();
    renderPanel(baseState({ data: linkData("active") }));

    await user.click(screen.getByRole("button", { name: /client messages/i }));

    expect(await screen.findByText("Chronological conversation between you and your client.")).toBeInTheDocument();
  });

  it("35. clicking Back closes the communication view and returns to the previous panel content", async () => {
    const user = userEvent.setup();
    renderPanel(baseState({ data: linkData("active") }));

    await user.click(screen.getByRole("button", { name: /client messages/i }));
    await screen.findByText("Chronological conversation between you and your client.");

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(
      screen.queryByText("Chronological conversation between you and your client.")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /client messages/i })).toBeInTheDocument();
  });

  it("41. displays the unread badge with the count from the owner messages GET", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, data: { messages: [], unreadCount: 5 } }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    renderPanel(baseState({ data: linkData("active") }));

    expect(await screen.findByText("5")).toBeInTheDocument();
  });

  it("does not render a badge when unreadCount is 0", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, data: { messages: [], unreadCount: 0 } }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    renderPanel(baseState({ data: linkData("active") }));

    await screen.findByRole("button", { name: /client messages/i });
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("64. no dashboard/project-card changes -- this entry point only ever renders inside the existing Share panel, never elsewhere", () => {
    const source = readFileSync(join(__dirname, "share-link-panel.tsx"), "utf8");
    // The entry point button text only appears once, inside this file.
    expect((source.match(/Client messages/g) ?? []).length).toBe(1);
  });
});

describe("ShareLinkPanel - Phase 5D RUNTIME DEFECT regression: stale unread badge after leaving the communication view", () => {
  const MESSAGE_ID = "33333333-3333-4333-8333-333333333333";

  function messageRow(overrides: Record<string, unknown> = {}) {
    return {
      id: MESSAGE_ID,
      shareLinkId: "22222222-2222-4222-8222-222222222222",
      projectId: "11111111-1111-4111-8111-111111111111",
      authorType: "client",
      authorDisplayName: "Jane",
      body: "Any update on this?",
      parentId: null,
      isVisibleToClient: true,
      status: "new",
      reviewedAt: null,
      resolvedAt: null,
      createdAt: "2026-08-19T00:00:00Z",
      updatedAt: "2026-08-19T00:00:00Z",
      ...overrides,
    };
  }

  function jsonResponse(body: unknown, status = 200) {
    return Promise.resolve(
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
    );
  }

  it("1-6. reproduces the exact real-browser defect: after an explicit status mutation inside the modal, clicking Back refreshes the panel badge with no close/reopen", async () => {
    let unread = 1;
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((url: unknown, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "PATCH") {
        unread = 0;
        return jsonResponse({
          ok: true,
          data: { messageId: MESSAGE_ID, status: "reviewed", reviewedAt: "2026-08-19T01:00:00Z", resolvedAt: null },
        });
      }
      return jsonResponse({
        ok: true,
        data: {
          messages: [messageRow(unread === 0 ? { status: "reviewed", reviewedAt: "2026-08-19T01:00:00Z" } : {})],
          unreadCount: unread,
        },
      });
    });

    const user = userEvent.setup();
    renderPanel(baseState({ data: linkData("active") }));

    // 1. panel initially displays unread badge 1
    expect(await screen.findByText("1")).toBeInTheDocument();

    // 2. open Client messages
    await user.click(screen.getByRole("button", { name: /client messages/i }));
    expect(await screen.findByText("1 unread")).toBeInTheDocument();

    // 3. successful status mutation -> modal unreadCount -> 0
    await user.click(screen.getByRole("button", { name: "Mark reviewed" }));
    await waitFor(() => {
      expect(screen.getByText("0 unread")).toBeInTheDocument();
    });

    // 4. click Back
    await user.click(screen.getByRole("button", { name: "Back" }));

    // 5. main panel displays no unread badge (server truth is now 0) --
    // and 6. no close/reopen of the Share panel dialog was required.
    await waitFor(() => {
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /client messages/i })).toBeInTheDocument();
  });

  it("a failed status mutation does not alter the panel badge once Back is clicked", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((url: unknown, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "PATCH") {
        return jsonResponse({ ok: false, code: "INTERNAL_ERROR", error: "x" }, 500);
      }
      return jsonResponse({ ok: true, data: { messages: [messageRow()], unreadCount: 1 } });
    });

    const user = userEvent.setup();
    renderPanel(baseState({ data: linkData("active") }));

    expect(await screen.findByText("1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /client messages/i }));
    await screen.findByText("1 unread");

    await user.click(screen.getByRole("button", { name: "Mark reviewed" }));
    // The mutation fails -- the modal's own count must stay at 1.
    await screen.findByText("1 unread");

    await user.click(screen.getByRole("button", { name: "Back" }));

    // Server truth is still unreadCount=1 -- the panel badge correctly
    // still shows 1, not silently cleared.
    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("replying alone (no status change) does not change the unread count reflected on the panel badge after Back", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((url: unknown, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "POST") {
        return jsonResponse({
          ok: true,
          data: {
            messageId: "44444444-4444-4444-8444-444444444444",
            shareLinkId: "22222222-2222-4222-8222-222222222222",
            parentId: MESSAGE_ID,
            authorType: "owner",
            createdAt: "2026-08-19T01:00:00Z",
          },
        });
      }
      // Replying never changes status='new', so unreadCount stays 1 on
      // every GET, before and after.
      return jsonResponse({ ok: true, data: { messages: [messageRow()], unreadCount: 1 } });
    });

    const user = userEvent.setup();
    renderPanel(baseState({ data: linkData("active") }));

    expect(await screen.findByText("1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /client messages/i }));
    await screen.findByText("1 unread");

    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByLabelText("Reply"), "Thanks!");
    await user.click(screen.getByRole("button", { name: "Submit reply" }));
    await waitFor(() => {
      expect(screen.queryByLabelText("Reply")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("does not introduce polling or a duplicate GET loop -- the total GET count stays small and fixed for this scenario", async () => {
    let unread = 1;
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    const getUrls: unknown[] = [];
    fetchMock.mockImplementation((url: unknown, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "PATCH") {
        unread = 0;
        return jsonResponse({
          ok: true,
          data: { messageId: MESSAGE_ID, status: "resolved", reviewedAt: "X", resolvedAt: "Y" },
        });
      }
      getUrls.push(url);
      return jsonResponse({
        ok: true,
        data: { messages: [messageRow(unread === 0 ? { status: "resolved" } : {})], unreadCount: unread },
      });
    });

    const user = userEvent.setup();
    renderPanel(baseState({ data: linkData("active") }));

    await screen.findByText("1");
    await user.click(screen.getByRole("button", { name: /client messages/i }));
    await screen.findByText("1 unread");
    await user.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(screen.getByText("0 unread")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.queryByText("1")).not.toBeInTheDocument());

    // Exactly: 1 (badge on mount) + 1 (modal on open) + 1 (modal
    // refetch after mutation) + 1 (badge refetch on Back) = 4. Not
    // growing, not interval-driven.
    expect(getUrls.length).toBe(4);

    // Wait an extra tick to prove nothing keeps firing on its own.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getUrls.length).toBe(4);
  });
});
