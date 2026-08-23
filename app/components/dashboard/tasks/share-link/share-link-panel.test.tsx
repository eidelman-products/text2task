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
      onAnalyzeMessage={vi.fn().mockResolvedValue({ ok: true })}
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
    // Comment-stripped: Phase 5F's own doc comments legitimately quote
    // the literal button text while explaining its behavior, which must
    // not itself fail this check (same code/executable distinction
    // established throughout this feature's own test suites).
    const executable = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // The entry point button text only appears once, inside this file.
    expect((executable.match(/Client messages/g) ?? []).length).toBe(1);
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

describe("ShareLinkPanel - PHASE 5F REAL PREVIEW DEFECT regression: Client messages remains reachable after revoke", () => {
  const REVOKED_LINK_ID = "22222222-2222-4222-8222-222222222222";
  const MESSAGE_ID = "66666666-6666-4666-8666-666666666666";

  function jsonResponse(body: unknown, status = 200) {
    return Promise.resolve(
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
    );
  }

  function messageRow(overrides: Record<string, unknown> = {}) {
    return {
      id: MESSAGE_ID,
      shareLinkId: REVOKED_LINK_ID,
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

  function noManagedLinkState(overrides: Partial<ShareLinkPanelState> = {}) {
    return baseState({
      data: { link: null, mappedTasks: [], mappedResources: [], currentUpdate: null },
      ...overrides,
    });
  }

  function mockRevokedFixture(fetchMock: ReturnType<typeof vi.fn>) {
    fetchMock.mockImplementation((url: unknown, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";

      if (u.includes("/history-link")) {
        return jsonResponse({ ok: true, data: { linkId: REVOKED_LINK_ID, state: "revoked" } });
      }
      if (u.endsWith(`/api/share-links/${REVOKED_LINK_ID}/messages`) && method === "GET") {
        return jsonResponse({ ok: true, data: { messages: [messageRow()], unreadCount: 1 } });
      }
      // Fail loudly (rather than silently succeeding) for any call this
      // scenario should never make -- activate/enable/draft-create/
      // delete -- so a regression here shows up as a real test failure.
      if (
        u.includes("/activate") ||
        u.includes("/enable") ||
        (u === "/api/share-links" && method === "POST") ||
        method === "DELETE"
      ) {
        return jsonResponse({ ok: false, code: "INTERNAL_ERROR", error: "unexpected call" }, 500);
      }
      return jsonResponse({ ok: true, data: { messages: [], unreadCount: 0 } });
    });
  }

  it("1-9. entry point remains reachable, resolves the revoked link id, and renders its retained history", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    mockRevokedFixture(fetchMock);

    const user = userEvent.setup();
    // 3-5: simulates the state exactly as observed in the real Preview
    // repro -- link revoked, panel reopened, no active/manageable link
    // (state.data.link === null).
    renderPanel(noManagedLinkState());

    // 6: Client messages STILL exists even though no active share remains.
    const entry = await screen.findByRole("button", { name: /client messages/i });
    expect(entry).toBeInTheDocument();
    expect(screen.getByText("From a previous share")).toBeInTheDocument();

    // 7: click entry
    await user.click(entry);

    // 8: the owner history GET used the resolved REVOKED link id, not a
    // fabricated/guessed one.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/share-links/${REVOKED_LINK_ID}/messages`,
        undefined
      );
    });

    // 9: the historical message renders.
    expect(await screen.findByText("Any update on this?")).toBeInTheDocument();

    // The owner must not infer the revoked link still works.
    expect(screen.getByText(/This share link has been revoked/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  });

  it("10. public-link controls (Copy/WhatsApp/Email) do not treat the revoked link as active -- the panel still offers the fresh share-creation flow, kept separate from history", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    mockRevokedFixture(fetchMock);

    renderPanel(noManagedLinkState());

    await screen.findByRole("button", { name: /client messages/i });

    expect(screen.queryByRole("button", { name: /copy client link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /whatsapp/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^share update$/i })).toBeInTheDocument();
  });

  it("REAL-WORLD TRANSITION: reproduces the exact live sequence (active-link session, then a fresh reopen that loads through isLoading:true before settling on link:null) -- not just a pre-settled render", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    mockRevokedFixture(fetchMock);

    const { rerender } = renderPanel(baseState({ data: linkData("active") }));
    // Before revoke: an active link exists, no historical fallback is
    // fetched or needed.
    await screen.findByRole("button", { name: /client messages/i });
    expect(screen.queryByText("From a previous share")).not.toBeInTheDocument();

    // Panel closes (owner navigates away / dashboard refresh tears the
    // open session down).
    rerender(<PanelHarness state={baseState({ isOpen: false })} />);

    // Owner reopens -- openPanel()'s own real sequence: isLoading:true
    // with data reset first...
    rerender(
      <PanelHarness
        state={baseState({ isLoading: true, data: null, resourcesLoading: true })}
      />
    );
    // ...then, once get_share_link_management_state resolves post-revoke,
    // isLoading:false with data.link now null.
    rerender(<PanelHarness state={noManagedLinkState({ isLoading: false })} />);

    const entry = await screen.findByRole("button", { name: /client messages/i });
    expect(entry).toBeInTheDocument();
    expect(screen.getByText("From a previous share")).toBeInTheDocument();
  });

  it("11. no automatic re-enable/new-link creation occurs merely from opening the panel or the history view", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    mockRevokedFixture(fetchMock);

    const user = userEvent.setup();
    renderPanel(noManagedLinkState());

    const entry = await screen.findByRole("button", { name: /client messages/i });
    await user.click(entry);
    await screen.findByText("Any update on this?");

    for (const [url, init] of fetchMock.mock.calls as [string, RequestInit | undefined][]) {
      expect(url).not.toContain("/activate");
      expect(url).not.toContain("/enable");
      expect((init?.method ?? "GET")).not.toBe("DELETE");
    }
  });

  it("does not resolve or render more than one historical link -- no multi-link selector was introduced", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    mockRevokedFixture(fetchMock);

    const user = userEvent.setup();
    renderPanel(noManagedLinkState());

    const entryButtons = await screen.findAllByRole("button", { name: /client messages/i });
    expect(entryButtons).toHaveLength(1);

    await user.click(entryButtons[0]);
    await screen.findByText("Any update on this?");

    // Exactly one history-link resolution call was made, requesting a
    // single row (the client wrapper's own contract), never a list.
    const historyCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/history-link"));
    expect(historyCalls.length).toBe(1);
  });

  it("does not introduce polling -- the history resolution fetches exactly once, not on an interval", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    mockRevokedFixture(fetchMock);

    renderPanel(noManagedLinkState());
    await screen.findByRole("button", { name: /client messages/i });

    const countAfterMount = fetchMock.mock.calls.filter(([url]) => String(url).includes("/history-link")).length;
    expect(countAfterMount).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 60));

    const countAfterWait = fetchMock.mock.calls.filter(([url]) => String(url).includes("/history-link")).length;
    expect(countAfterWait).toBe(1);
  });

  it("when an active/manageable link exists, the historical fallback is never fetched at all", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((url: unknown) => {
      if (String(url).includes("/history-link")) {
        throw new Error("history-link must not be called when an active link exists");
      }
      return jsonResponse({ ok: true, data: { messages: [], unreadCount: 0 } });
    });

    renderPanel(baseState({ data: linkData("active") }));
    await screen.findByRole("button", { name: /client messages/i });

    expect(screen.queryByText("From a previous share")).not.toBeInTheDocument();
  });

  it("entry point appears once the history fetch resolves, and its absence WHILE loading is not permanent", async () => {
    let resolveHistory: (value: Response) => void = () => {};
    const pendingHistory = new Promise<Response>((resolve) => {
      resolveHistory = resolve;
    });

    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((url: unknown) => {
      const u = String(url);
      if (u.includes("/history-link")) {
        return pendingHistory;
      }
      return jsonResponse({ ok: true, data: { messages: [], unreadCount: 0 } });
    });

    renderPanel(noManagedLinkState());

    // While the history fetch is still in flight, there is genuinely no
    // link id to operate against yet -- correctly absent, not a bug.
    expect(screen.queryByRole("button", { name: /client messages/i })).not.toBeInTheDocument();

    resolveHistory(await jsonResponse({ ok: true, data: { linkId: REVOKED_LINK_ID, state: "revoked" } }));

    // Once resolved, the entry point must appear -- its earlier absence
    // must not be permanent/sticky.
    expect(await screen.findByRole("button", { name: /client messages/i })).toBeInTheDocument();
  });

  it("a stale (slower) history response arriving after a fresher one does not overwrite the resolved link with stale data", async () => {
    let resolveFirst: (value: Response) => void = () => {};
    const firstHistoryResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    let historyCallCount = 0;
    const STALE_LINK_ID = "77777777-7777-4777-8777-777777777777";

    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((url: unknown) => {
      const u = String(url);
      if (u.includes("/history-link")) {
        historyCallCount += 1;
        if (historyCallCount === 1) return firstHistoryResponse;
        return jsonResponse({ ok: true, data: { linkId: REVOKED_LINK_ID, state: "revoked" } });
      }
      return jsonResponse({ ok: true, data: { messages: [], unreadCount: 0 } });
    });

    const { rerender } = renderPanel(noManagedLinkState());
    // Force a second, fresher fetch by toggling the projectId (a
    // realistic re-trigger), while the first (stale) call is still
    // in flight.
    rerender(<PanelHarness state={noManagedLinkState({ projectId: "88888888-8888-4888-8888-888888888888" })} />);

    await screen.findByRole("button", { name: /client messages/i });

    // Now let the STALE first response resolve, with a DIFFERENT linkId
    // -- it must be discarded, not overwrite the fresher, already-
    // rendered result.
    resolveFirst(await jsonResponse({ ok: true, data: { linkId: STALE_LINK_ID, state: "revoked" } }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /client messages/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/share-links/${REVOKED_LINK_ID}/messages`, undefined);
    });
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/share-links/${STALE_LINK_ID}/messages`, undefined);
  });

  it("no Project Timeline integration and no Phase 6 action was introduced by this fix (source-level check)", () => {
    const files = [
      "share-link-panel.tsx",
      "use-share-link-history.ts",
      "client-communication-history-modal.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(join(__dirname, file), "utf8");
      const executable = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(executable).not.toMatch(/project-update-history/i);
      expect(executable).not.toContain("project_timeline_events");
      expect(executable).not.toContain("share_message_conversions");
      expect(executable.match(/\bconvert\b/gi) ?? []).toHaveLength(0);
    }
  });
});
