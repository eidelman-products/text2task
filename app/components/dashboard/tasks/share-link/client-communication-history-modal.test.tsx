// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const getShareLinkMessagesMock = vi.fn();
const sendShareMessageReplyMock = vi.fn();
const setShareMessageStatusMock = vi.fn();

vi.mock("./share-link-client", () => ({
  getShareLinkMessages: (linkId: string) => getShareLinkMessagesMock(linkId),
  sendShareMessageReply: (linkId: string, input: unknown) => sendShareMessageReplyMock(linkId, input),
  setShareMessageStatus: (linkId: string, messageId: string, status: string) =>
    setShareMessageStatusMock(linkId, messageId, status),
  ShareLinkClientError: class ShareLinkClientError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

const { ClientCommunicationHistoryModal } = await import("./client-communication-history-modal");

const LINK_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_MESSAGE_ID = "33333333-3333-4333-8333-333333333333";
const OWNER_MESSAGE_ID = "44444444-4444-4444-8444-444444444444";

function clientMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: CLIENT_MESSAGE_ID,
    shareLinkId: LINK_ID,
    projectId: PROJECT_ID,
    authorType: "client" as const,
    authorDisplayName: "Jane",
    body: "Any update on this?",
    parentId: null,
    isVisibleToClient: true,
    status: "new" as const,
    reviewedAt: null,
    resolvedAt: null,
    createdAt: "2026-08-19T00:00:00Z",
    updatedAt: "2026-08-19T00:00:00Z",
    ...overrides,
  };
}

function ownerMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: OWNER_MESSAGE_ID,
    shareLinkId: LINK_ID,
    projectId: PROJECT_ID,
    authorType: "owner" as const,
    authorDisplayName: null,
    body: "On track for Friday!",
    parentId: CLIENT_MESSAGE_ID,
    isVisibleToClient: true,
    status: "reviewed" as const,
    reviewedAt: "2026-08-19T01:00:00Z",
    resolvedAt: null,
    createdAt: "2026-08-19T01:00:00Z",
    updatedAt: "2026-08-19T01:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  getShareLinkMessagesMock.mockReset();
  sendShareMessageReplyMock.mockReset();
  setShareMessageStatusMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderModal(
  onClose = vi.fn(),
  overrides: Partial<{
    isHistorical: boolean;
    canReply: boolean;
    onAnalyzeMessage: (messageId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  }> = {}
) {
  const onAnalyzeMessage = overrides.onAnalyzeMessage ?? vi.fn().mockResolvedValue({ ok: true });

  return {
    onClose,
    onAnalyzeMessage,
    ...render(
      <ClientCommunicationHistoryModal
        shareLinkId={LINK_ID}
        onClose={onClose}
        {...overrides}
        onAnalyzeMessage={onAnalyzeMessage}
      />
    ),
  };
}

describe("ClientCommunicationHistoryModal - open/close", () => {
  it("36. requests GET messages for this link on open (mount)", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [], unreadCount: 0 });
    renderModal();

    await waitFor(() => {
      expect(getShareLinkMessagesMock).toHaveBeenCalledWith(LINK_ID);
    });
  });

  it("35. clicking Back calls onClose", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [], unreadCount: 0 });
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("47. opening the modal never calls setShareMessageStatus (reading is not workflow mutation)", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    renderModal();

    await screen.findByText("Any update on this?");

    expect(setShareMessageStatusMock).not.toHaveBeenCalled();
  });
});

describe("ClientCommunicationHistoryModal - loading / empty / list", () => {
  it("37. shows a loading state before the first response resolves", () => {
    getShareLinkMessagesMock.mockReturnValue(new Promise(() => {}));
    renderModal();
    expect(screen.getAllByText(/Loading client messages/i).length).toBeGreaterThan(0);
  });

  it("38. shows the empty state with no messages", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [], unreadCount: 0 });
    renderModal();
    expect(await screen.findByText("No client messages yet.")).toBeInTheDocument();
  });

  it("39. renders messages in the order returned by the server (chronological)", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage(), ownerMessage()],
      unreadCount: 1,
    });
    renderModal();

    const list = await screen.findByLabelText("Client message history");
    const items = list.querySelectorAll("li");
    expect(items[0].textContent).toContain("Any update on this?");
    expect(items[1].textContent).toContain("On track for Friday!");
  });

  it("40. distinguishes client vs owner authors", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage(), ownerMessage()],
      unreadCount: 1,
    });
    renderModal();

    await screen.findByText("Jane", { exact: false });
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("40b. Phase 7C: renders the trusted role as a fixed prefix, not the client-supplied name alone -- a client cannot make a message appear as the trusted role text itself", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage({ authorDisplayName: "Owner" }), ownerMessage()],
      unreadCount: 1,
    });
    renderModal();

    // The client-supplied name is rendered ONLY as "Client · <name>" --
    // never as a bare "Owner" that could be confused with a genuine
    // owner-authored message (which always renders as the fixed "You").
    const clientCard = await screen.findByText((_, element) => {
      return element?.textContent === "Client · Owner";
    });
    expect(clientCard).toBeInTheDocument();
    // Exactly one "You" exists (the real owner message) -- the client's
    // spoofed "Owner" display name never produces a second one.
    expect(screen.getAllByText("You")).toHaveLength(1);
    expect(screen.queryByText("Owner", { exact: true })).not.toBeInTheDocument();
  });

  it("41. displays the unread count", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 4 });
    renderModal();
    expect(await screen.findByText("4 unread")).toBeInTheDocument();
  });

  it("41b. Phase 7D: the loading state is announced via a polite live region", () => {
    getShareLinkMessagesMock.mockReturnValue(new Promise(() => {}));
    renderModal();
    const statuses = screen.getAllByRole("status");
    expect(statuses.some((el) => /loading client messages/i.test(el.textContent ?? ""))).toBe(true);
  });

  it("41c. Phase 7D: a load failure is announced via an assertive live region", async () => {
    getShareLinkMessagesMock.mockRejectedValue(new Error("network down"));
    renderModal();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("ClientCommunicationHistoryModal - Phase 7D touch-target closure", () => {
  it("compact per-message action buttons (Mark reviewed/Resolve/Dismiss/Reply) meet a practical ~36px minimum touch target", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    renderModal();

    await screen.findByText("Any update on this?");

    for (const name of [/mark reviewed/i, /^resolve$/i, /^dismiss$/i, /^reply$/i]) {
      const button = screen.getByRole("button", { name });
      expect(button.style.minHeight).toBe("36px");
    }
  });
});

describe("ClientCommunicationHistoryModal - status display", () => {
  it("42. displays 'New' for status=new", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage({ status: "new" })], unreadCount: 1 });
    renderModal();
    expect(await screen.findByText("New")).toBeInTheDocument();
  });

  it("43. displays 'Reviewed' for status=reviewed", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage({ status: "reviewed" })],
      unreadCount: 0,
    });
    renderModal();
    expect(await screen.findByText("Reviewed")).toBeInTheDocument();
  });

  it("44. displays 'Resolved' for status=resolved", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage({ status: "resolved" })],
      unreadCount: 0,
    });
    renderModal();
    expect(await screen.findByText("Resolved")).toBeInTheDocument();
  });

  it("45. displays 'Dismissed' for status=dismissed", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage({ status: "dismissed" })],
      unreadCount: 0,
    });
    renderModal();
    expect(await screen.findByText("Dismissed")).toBeInTheDocument();
  });

  it("46. never exposes a Convert action, even for a 'converted' status row", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage({ status: "converted" })],
      unreadCount: 0,
    });
    renderModal();
    await screen.findByText("Converted");
    expect(screen.queryByRole("button", { name: /convert/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/turn into task/i)).not.toBeInTheDocument();
  });
});

describe("ClientCommunicationHistoryModal - Phase 6C converted terminality (lifecycle actions hidden, Reply preserved)", () => {
  it("a converted message hides Analyze as client update", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage({ status: "converted" })],
      unreadCount: 0,
    });
    renderModal();
    await screen.findByText("Any update on this?");

    expect(
      screen.queryByRole("button", { name: /Analyze as client update/i })
    ).not.toBeInTheDocument();
  });

  it("a converted message hides Mark reviewed, Resolve, and Dismiss", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage({ status: "converted" })],
      unreadCount: 0,
    });
    renderModal();
    await screen.findByText("Any update on this?");

    expect(screen.queryByRole("button", { name: "Mark reviewed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  it("a converted message still exposes Reply when the normal canReply conditions are true -- the locked product decision (converted does not stop communication)", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage({ status: "converted" })],
      unreadCount: 0,
    });
    renderModal(vi.fn(), { canReply: true });
    await screen.findByText("Any update on this?");

    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
  });

  it("a non-converted message still shows Mark reviewed/Resolve/Dismiss (direct regression -- only converted hides them)", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage({ status: "new" })],
      unreadCount: 1,
    });
    renderModal();
    await screen.findByText("Any update on this?");

    expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });
});

describe("ClientCommunicationHistoryModal - explicit status actions", () => {
  it("48. Mark reviewed calls PATCH with status=reviewed", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    setShareMessageStatusMock.mockResolvedValue({
      messageId: CLIENT_MESSAGE_ID,
      status: "reviewed",
      reviewedAt: "X",
      resolvedAt: null,
    });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Mark reviewed" }));

    expect(setShareMessageStatusMock).toHaveBeenCalledWith(LINK_ID, CLIENT_MESSAGE_ID, "reviewed");
  });

  it("49. Resolve calls PATCH with status=resolved", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    setShareMessageStatusMock.mockResolvedValue({
      messageId: CLIENT_MESSAGE_ID,
      status: "resolved",
      reviewedAt: "X",
      resolvedAt: "Y",
    });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Resolve" }));

    expect(setShareMessageStatusMock).toHaveBeenCalledWith(LINK_ID, CLIENT_MESSAGE_ID, "resolved");
  });

  it("50. Dismiss calls PATCH with status=dismissed", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    setShareMessageStatusMock.mockResolvedValue({
      messageId: CLIENT_MESSAGE_ID,
      status: "dismissed",
      reviewedAt: "X",
      resolvedAt: null,
    });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(setShareMessageStatusMock).toHaveBeenCalledWith(LINK_ID, CLIENT_MESSAGE_ID, "dismissed");
  });

  it("51. a successful status change refetches/refreshes the data", async () => {
    getShareLinkMessagesMock
      .mockResolvedValueOnce({ messages: [clientMessage({ status: "new" })], unreadCount: 1 })
      .mockResolvedValueOnce({ messages: [clientMessage({ status: "reviewed" })], unreadCount: 0 });
    setShareMessageStatusMock.mockResolvedValue({
      messageId: CLIENT_MESSAGE_ID,
      status: "reviewed",
      reviewedAt: "X",
      resolvedAt: null,
    });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("New");

    await user.click(screen.getByRole("button", { name: "Mark reviewed" }));

    await waitFor(() => {
      expect(screen.getByText("0 unread")).toBeInTheDocument();
    });
    expect(getShareLinkMessagesMock).toHaveBeenCalledTimes(2);
  });

  it("52. a failed status change shows a safe error, without leaking internals", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    const { ShareLinkClientError } = await import("./share-link-client");
    setShareMessageStatusMock.mockRejectedValue(
      new ShareLinkClientError("INTERNAL_ERROR", "raw db failure")
    );
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Mark reviewed" }));

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/raw db failure/)).not.toBeInTheDocument();
  });
});

describe("ClientCommunicationHistoryModal - reply UX", () => {
  it("53. Reply is offered only for client-authored messages", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage(), ownerMessage()],
      unreadCount: 1,
    });
    renderModal();
    await screen.findByText("Jane", { exact: false });

    expect(screen.getAllByRole("button", { name: "Reply" })).toHaveLength(1);
  });

  it("54. only one reply composer is open at a time", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage(), clientMessage({ id: "55555555-5555-4555-8555-555555555555", body: "Second question" })],
      unreadCount: 2,
    });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Second question");

    const replyButtons = screen.getAllByRole("button", { name: "Reply" });
    await user.click(replyButtons[0]);
    expect(screen.getAllByRole("button", { name: "Submit reply" })).toHaveLength(1);
    // The other message's own Reply trigger is still present (only one
    // composer total, not one per message).
    expect(screen.getAllByRole("button", { name: "Reply" })).toHaveLength(1);
  });

  it("55. Cancel closes the composer without sending", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByLabelText("Reply"), "Draft text");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Reply")).not.toBeInTheDocument();
    expect(sendShareMessageReplyMock).not.toHaveBeenCalled();
  });

  it("56. an empty reply is blocked client-side", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.click(screen.getByRole("button", { name: "Submit reply" }));

    expect(await screen.findByText("Enter a reply.")).toBeInTheDocument();
    expect(sendShareMessageReplyMock).not.toHaveBeenCalled();
  });

  it("57. a valid reply POSTs with the exact parentMessageId", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    sendShareMessageReplyMock.mockResolvedValue({
      messageId: OWNER_MESSAGE_ID,
      shareLinkId: LINK_ID,
      parentId: CLIENT_MESSAGE_ID,
      authorType: "owner",
      createdAt: "2026-08-19T01:00:00Z",
    });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByLabelText("Reply"), "Thanks, on track!");
    await user.click(screen.getByRole("button", { name: "Submit reply" }));

    await waitFor(() => {
      expect(sendShareMessageReplyMock).toHaveBeenCalledWith(LINK_ID, {
        parentMessageId: CLIENT_MESSAGE_ID,
        body: "Thanks, on track!",
      });
    });
  });

  it("58. a successful reply closes the composer", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    sendShareMessageReplyMock.mockResolvedValue({
      messageId: OWNER_MESSAGE_ID,
      shareLinkId: LINK_ID,
      parentId: CLIENT_MESSAGE_ID,
      authorType: "owner",
      createdAt: "2026-08-19T01:00:00Z",
    });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByLabelText("Reply"), "Thanks!");
    await user.click(screen.getByRole("button", { name: "Submit reply" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Reply")).not.toBeInTheDocument();
    });
  });

  it("59. a successful reply refreshes the history (a second GET is issued)", async () => {
    getShareLinkMessagesMock
      .mockResolvedValueOnce({ messages: [clientMessage()], unreadCount: 1 })
      .mockResolvedValueOnce({ messages: [clientMessage(), ownerMessage()], unreadCount: 1 });
    sendShareMessageReplyMock.mockResolvedValue({
      messageId: OWNER_MESSAGE_ID,
      shareLinkId: LINK_ID,
      parentId: CLIENT_MESSAGE_ID,
      authorType: "owner",
      createdAt: "2026-08-19T01:00:00Z",
    });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByLabelText("Reply"), "Thanks!");
    await user.click(screen.getByRole("button", { name: "Submit reply" }));

    expect(await screen.findByText("On track for Friday!")).toBeInTheDocument();
    expect(getShareLinkMessagesMock).toHaveBeenCalledTimes(2);
  });

  it("60. replying does not call setShareMessageStatus on the parent", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    sendShareMessageReplyMock.mockResolvedValue({
      messageId: OWNER_MESSAGE_ID,
      shareLinkId: LINK_ID,
      parentId: CLIENT_MESSAGE_ID,
      authorType: "owner",
      createdAt: "2026-08-19T01:00:00Z",
    });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByLabelText("Reply"), "Thanks!");
    await user.click(screen.getByRole("button", { name: "Submit reply" }));

    await waitFor(() => {
      expect(sendShareMessageReplyMock).toHaveBeenCalled();
    });
    expect(setShareMessageStatusMock).not.toHaveBeenCalled();
  });
});

describe("ClientCommunicationHistoryModal - privacy / boundary", () => {
  it("61. internal message ids are used only as React keys/handler args, never rendered as visible text", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    renderModal();
    await screen.findByText("Any update on this?");

    expect(screen.queryByText(CLIENT_MESSAGE_ID)).not.toBeInTheDocument();
  });

  it("62. Client Communication remains structurally separate from Project Timeline -- no import statement pulls in any Project Timeline/Project Update module, and no executable code references project_timeline_events", () => {
    const source = readFileSync(join(__dirname, "client-communication-history-modal.tsx"), "utf8");
    const importLines = source.match(/^import .*$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/project-update/i);
      expect(line).not.toMatch(/project-updates/i);
      expect(line).not.toMatch(/timeline/i);
    }
    // Comment-stripped: this file's own doc comment legitimately NAMES
    // project_timeline_events while explaining it is never touched,
    // mirroring the same code/normalizedExecutable distinction the
    // Phase 5A-5C boundary tests already established.
    const executable = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(executable).not.toContain("project_timeline_events");
  });

  it("66. no Phase 6 UI/actions -- no Convert/Turn into task/Apply update button anywhere in source", () => {
    const source = readFileSync(join(__dirname, "client-communication-history-modal.tsx"), "utf8");
    expect(source).not.toMatch(/turn into task/i);
    expect(source).not.toMatch(/apply update/i);
    expect(source.match(/\bconvert\b/gi) ?? []).toHaveLength(0);
  });
});

describe("ClientCommunicationHistoryModal - PHASE 5F historical/revoked-link mode", () => {
  it("default (no props) behaves exactly as before -- no historical notice, Reply available", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    renderModal();
    await screen.findByText("Any update on this?");

    expect(screen.queryByText(/This share link has been revoked/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
  });

  it("isHistorical=true shows a clear notice that the client can no longer send/receive here", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    renderModal(vi.fn(), { isHistorical: true });
    await screen.findByText("Any update on this?");

    expect(screen.getByText(/This share link has been revoked/i)).toBeInTheDocument();
  });

  it("canReply=false hides the Reply trigger entirely, even though history still renders", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    renderModal(vi.fn(), { canReply: false, isHistorical: true });
    await screen.findByText("Any update on this?");

    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  });

  it("canReply=false still allows explicit status actions (Mark reviewed/Resolve/Dismiss) -- only Reply is suppressed", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    renderModal(vi.fn(), { canReply: false });
    await screen.findByText("Any update on this?");

    expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("canReply=false never calls sendShareMessageReply even if somehow invoked programmatically (defensive no-op)", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    renderModal(vi.fn(), { canReply: false });
    await screen.findByText("Any update on this?");

    // No Reply control exists to click at all -- proves there is no
    // path left in the DOM that could trigger a reply.
    expect(screen.queryByLabelText("Reply")).not.toBeInTheDocument();
    expect(sendShareMessageReplyMock).not.toHaveBeenCalled();
  });

  it("owner GET still fires normally for a historical/revoked link -- read access is unaffected by canReply/isHistorical", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    renderModal(vi.fn(), { isHistorical: true, canReply: false });

    await waitFor(() => {
      expect(getShareLinkMessagesMock).toHaveBeenCalledWith(LINK_ID);
    });
  });
});

describe("ClientCommunicationHistoryModal - Phase 6B 'Analyze as client update' eligibility", () => {
  it("67. renders the action for an eligible client-authored, non-converted message", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    renderModal();
    await screen.findByText("Any update on this?");

    expect(screen.getByRole("button", { name: "Analyze as client update" })).toBeInTheDocument();
  });

  it("68. does NOT render the action for an owner-authored message", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [ownerMessage()], unreadCount: 0 });
    renderModal();
    await screen.findByText("On track for Friday!");

    expect(screen.queryByRole("button", { name: "Analyze as client update" })).not.toBeInTheDocument();
  });

  it("69. does NOT render the action for an already-converted client message", async () => {
    getShareLinkMessagesMock.mockResolvedValue({
      messages: [clientMessage({ status: "converted" })],
      unreadCount: 0,
    });
    renderModal();
    await screen.findByText("Any update on this?");

    expect(screen.queryByRole("button", { name: "Analyze as client update" })).not.toBeInTheDocument();
  });

  it.each(["reviewed", "resolved", "dismissed"])(
    "70. remains eligible for a client message with status=%s (locked product decision -- only 'converted' is excluded)",
    async (status) => {
      getShareLinkMessagesMock.mockResolvedValue({
        messages: [clientMessage({ status })],
        unreadCount: 0,
      });
      renderModal();
      await screen.findByText("Any update on this?");

      expect(screen.getByRole("button", { name: "Analyze as client update" })).toBeInTheDocument();
    }
  );

  it("71. remains eligible on a historical/revoked link (isHistorical=true, canReply=false) -- link state does not gate this action", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    renderModal(vi.fn(), { isHistorical: true, canReply: false });
    await screen.findByText("Any update on this?");

    expect(screen.getByRole("button", { name: "Analyze as client update" })).toBeInTheDocument();
  });
});

describe("ClientCommunicationHistoryModal - Phase 6B 'Analyze as client update' click behavior", () => {
  it("72. clicking the action calls onAnalyzeMessage with exactly this message's id", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    const user = userEvent.setup();
    const onAnalyzeMessage = vi.fn().mockResolvedValue({ ok: true });
    renderModal(vi.fn(), { onAnalyzeMessage });
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Analyze as client update" }));

    expect(onAnalyzeMessage).toHaveBeenCalledWith(CLIENT_MESSAGE_ID);
  });

  it("73. shows a busy/disabled state while the call is in flight, and prevents a second click from firing a second call", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    const user = userEvent.setup();
    let resolveAnalyze: (value: { ok: true }) => void = () => {};
    const onAnalyzeMessage = vi.fn(
      () => new Promise<{ ok: true }>((resolve) => { resolveAnalyze = resolve; })
    );
    renderModal(vi.fn(), { onAnalyzeMessage });
    await screen.findByText("Any update on this?");

    const button = screen.getByRole("button", { name: "Analyze as client update" });
    await user.click(button);

    expect(await screen.findByRole("button", { name: "Analyzing…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Analyzing…" }));
    expect(onAnalyzeMessage).toHaveBeenCalledTimes(1);

    resolveAnalyze({ ok: true });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Analyze as client update" })).not.toBeDisabled();
    });
  });

  it("74. shows an inline error message when onAnalyzeMessage resolves with ok:false, and clears it on the next successful attempt", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    const user = userEvent.setup();
    const onAnalyzeMessage = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "This message is not eligible for conversion." })
      .mockResolvedValueOnce({ ok: true });
    renderModal(vi.fn(), { onAnalyzeMessage });
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Analyze as client update" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This message is not eligible for conversion."
    );

    await user.click(screen.getByRole("button", { name: "Analyze as client update" }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("75. UI click-gating is convenience only -- this modal never bypasses onAnalyzeMessage's own async result to synthesize success locally", async () => {
    getShareLinkMessagesMock.mockResolvedValue({ messages: [clientMessage()], unreadCount: 1 });
    const user = userEvent.setup();
    const onAnalyzeMessage = vi.fn().mockResolvedValue({ ok: false, error: "Rejected by the server." });
    renderModal(vi.fn(), { onAnalyzeMessage });
    await screen.findByText("Any update on this?");

    await user.click(screen.getByRole("button", { name: "Analyze as client update" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Rejected by the server.");
    // The action remains available for another attempt -- nothing about
    // the message's own displayed status changed as a side effect of a
    // failed attempt.
    expect(screen.getByRole("button", { name: "Analyze as client update" })).toBeInTheDocument();
  });
});
