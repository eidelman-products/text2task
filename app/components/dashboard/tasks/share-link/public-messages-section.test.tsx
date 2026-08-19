// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PublicMessagesSection } from "./public-messages-section";

const PUBLIC_ID = "abcdefgh12345678ijklmnop";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function clientMessage(overrides: Record<string, unknown> = {}) {
  return {
    authorType: "client" as const,
    authorDisplayName: "Jane",
    body: "Any update?",
    createdAt: "2026-08-19T00:00:00Z",
    ...overrides,
  };
}

function ownerMessage(overrides: Record<string, unknown> = {}) {
  return {
    authorType: "owner" as const,
    authorDisplayName: null,
    body: "On track for Friday!",
    createdAt: "2026-08-19T01:00:00Z",
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderSection(overrides: Partial<Parameters<typeof PublicMessagesSection>[0]> = {}) {
  return render(
    <PublicMessagesSection
      publicId={PUBLIC_ID}
      commentsEnabled={true}
      contentDirection="auto"
      {...overrides}
    />
  );
}

describe("PublicMessagesSection - visibility", () => {
  it("1. renders nothing when commentsEnabled=false", () => {
    const { container } = renderSection({ commentsEnabled: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("1b. performs no fetch at all when commentsEnabled=false", () => {
    renderSection({ commentsEnabled: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("2. renders the Messages section when commentsEnabled=true", () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, data: { messages: [] } }));
    renderSection();
    expect(screen.getByRole("region", { name: "Messages" })).toBeInTheDocument();
  });

  it("3. requests GET history on mount when enabled", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, data: { messages: [] } }));
    renderSection();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/share/${PUBLIC_ID}/messages`,
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("4. shows a loading state before the first response resolves", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.getByText(/Loading messages/i)).toBeInTheDocument();
  });

  it("5. shows an empty state with no history", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, data: { messages: [] } }));
    renderSection();
    expect(await screen.findByText("No messages yet.")).toBeInTheDocument();
  });
});

describe("PublicMessagesSection - message rendering", () => {
  it("6. displays a client message", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, data: { messages: [clientMessage()] } }));
    renderSection();
    expect(await screen.findByText("Any update?")).toBeInTheDocument();
  });

  it("7. displays an owner reply", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, data: { messages: [clientMessage(), ownerMessage()] } })
    );
    renderSection();
    expect(await screen.findByText("On track for Friday!")).toBeInTheDocument();
  });

  it("8. preserves chronological order as returned by the server", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, data: { messages: [clientMessage(), ownerMessage()] } })
    );
    renderSection();

    const list = await screen.findByLabelText("Message history");
    const items = within(list).getAllByRole("listitem");
    expect(within(items[0]).getByText("Any update?")).toBeInTheDocument();
    expect(within(items[1]).getByText("On track for Friday!")).toBeInTheDocument();
  });

  it("9. falls back to 'Client' when authorDisplayName is missing", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, data: { messages: [clientMessage({ authorDisplayName: null })] } })
    );
    renderSection();
    expect(await screen.findByText("Client")).toBeInTheDocument();
  });

  it("10. labels an owner message 'Project team'", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, data: { messages: [ownerMessage()] } }));
    renderSection();
    expect(await screen.findByText("Project team")).toBeInTheDocument();
  });

  it("11. renders message body as plain text (React text node, not injected HTML)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, data: { messages: [clientMessage({ body: "Plain text body" })] } })
    );
    renderSection();
    const bodyEl = await screen.findByText("Plain text body");
    expect(bodyEl.innerHTML).toBe("Plain text body");
  });

  it("12. HTML-like body is shown as literal text, never interpreted", async () => {
    const htmlLike = "<script>alert(1)</script>";
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, data: { messages: [clientMessage({ body: htmlLike })] } })
    );
    renderSection();
    expect(await screen.findByText(htmlLike)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("13. preserves multiline body text", async () => {
    const multiline = "Line one\nLine two";
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, data: { messages: [clientMessage({ body: multiline })] } })
    );
    renderSection();
    const bodyEl = await screen.findByText((_, element) => element?.textContent === multiline);
    expect(bodyEl).toBeInTheDocument();
  });

  it("14. renders Hebrew text", async () => {
    const text = "שלום, תודה על העדכון!";
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, data: { messages: [clientMessage({ body: text })] } })
    );
    renderSection();
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("15. renders Arabic text", async () => {
    const text = "شكرا على التحديث";
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, data: { messages: [clientMessage({ body: text })] } })
    );
    renderSection();
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("16. renders emoji", async () => {
    const text = "Great work! 🎉";
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, data: { messages: [clientMessage({ body: text })] } })
    );
    renderSection();
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("17. the section root has an explicit dir attribute matching contentDirection (RTL layout)", () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, data: { messages: [] } }));
    renderSection({ contentDirection: "rtl" });
    expect(screen.getByRole("region", { name: "Messages" })).toHaveAttribute("dir", "rtl");
  });
});

describe("PublicMessagesSection - form validation", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, data: { messages: [] } }));
  });

  it("18. blocks an empty submit with a client-side error, without calling POST", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No messages yet.");

    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Enter a message.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("19. blocks a whitespace-only submit", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No messages yet.");

    await user.type(screen.getByLabelText("Message"), "   ");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Enter a message.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("20. accepts a 4000-character message", async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return jsonResponse({ ok: true });
      return jsonResponse({ ok: true, data: { messages: [] } });
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No messages yet.");

    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    // fireEvent.change (not userEvent.type, which is far too slow for 4000
    // keystrokes) -- goes through React's own value-tracking correctly.
    fireEvent.change(textarea, { target: { value: "a".repeat(4000) } });

    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("21. rejects a 4001-character message client-side", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No messages yet.");

    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "a".repeat(4001) } });

    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Message must be 4,000 characters or fewer.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("22. accepts an 80-character name", async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return jsonResponse({ ok: true });
      return jsonResponse({ ok: true, data: { messages: [] } });
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No messages yet.");

    const nameInput = screen.getByLabelText("Your name (optional)") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "a".repeat(80) } });
    await user.type(screen.getByLabelText("Message"), "hi");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("23. rejects an 81-character name client-side", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No messages yet.");

    const nameInput = screen.getByLabelText("Your name (optional)") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "a".repeat(81) } });
    await user.type(screen.getByLabelText("Message"), "hi");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Name must be 80 characters or fewer.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("PublicMessagesSection - submit lifecycle", () => {
  it("24. disables the submit button while a send is pending (prevents double submission)", async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return new Promise(() => {});
      return jsonResponse({ ok: true, data: { messages: [] } });
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No messages yet.");

    await user.type(screen.getByLabelText("Message"), "Hello");
    const button = screen.getByRole("button", { name: "Send message" });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    });
  });

  it("25. successful send clears the message body", async () => {
    let getCallCount = 0;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return jsonResponse({ ok: true });
      getCallCount += 1;
      return jsonResponse({
        ok: true,
        data: { messages: getCallCount > 1 ? [clientMessage()] : [] },
      });
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No messages yet.");

    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    await user.type(textarea, "Hello there");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(textarea.value).toBe("");
    });
  });

  it("26. successful send preserves the name field", async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return jsonResponse({ ok: true });
      return jsonResponse({ ok: true, data: { messages: [] } });
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No messages yet.");

    const nameInput = screen.getByLabelText("Your name (optional)") as HTMLInputElement;
    await user.type(nameInput, "Jane");
    await user.type(screen.getByLabelText("Message"), "Hello there");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(nameInput.value).toBe("Jane");
  });

  it("27. successful send re-fetches history (a second GET is issued)", async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return jsonResponse({ ok: true });
      return jsonResponse({ ok: true, data: { messages: [] } });
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No messages yet.");

    await user.type(screen.getByLabelText("Message"), "Hello there");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      const getCalls = fetchMock.mock.calls.filter(
        ([, options]) => !options || (options as RequestInit).method === undefined || (options as RequestInit).method === "GET"
      );
      expect(getCalls.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("PublicMessagesSection - failure handling", () => {
  it("28. shows a safe message on a rate-limited send, without leaking internals", async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return jsonResponse({ ok: false, code: "RATE_LIMITED", error: "x" }, 429);
      return jsonResponse({ ok: true, data: { messages: [] } });
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No messages yet.");

    await user.type(screen.getByLabelText("Message"), "Hello there");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText(/Too many messages sent/i)).toBeInTheDocument();
  });

  it("29. shows a generic safe message on an unexpected server failure", async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST")
        return jsonResponse({ ok: false, code: "INTERNAL_ERROR", error: "raw db failure" }, 500);
      return jsonResponse({ ok: true, data: { messages: [] } });
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No messages yet.");

    await user.type(screen.getByLabelText("Message"), "Hello there");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(
      await screen.findByText("Something went wrong sending your message. Please try again.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/raw db failure/)).not.toBeInTheDocument();
  });

  it("30. a failed history fetch does not throw / does not prevent the form from rendering", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    renderSection();

    expect(await screen.findByText("Messages could not be loaded right now.")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
  });
});

describe("PublicMessagesSection - race conditions (§18)", () => {
  it("a slow first GET resolving after a faster refetch does not overwrite the newer result", async () => {
    let resolveFirst: (value: Response) => void = () => {};
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    let getCallCount = 0;

    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return jsonResponse({ ok: true });
      getCallCount += 1;
      if (getCallCount === 1) return firstResponse;
      return jsonResponse({ ok: true, data: { messages: [clientMessage({ body: "Second, fresher" })] } });
    });

    const user = userEvent.setup();
    renderSection();

    // Trigger a second GET (via a send) while the first GET is still
    // in flight.
    await user.type(screen.getByLabelText("Message"), "Hello");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await screen.findByText("Second, fresher");

    // Now let the FIRST (stale) request resolve -- it must be discarded,
    // not overwrite the already-rendered fresher result.
    resolveFirst(await jsonResponse({ ok: true, data: { messages: [clientMessage({ body: "First, stale" })] } }));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.getByText("Second, fresher")).toBeInTheDocument();
    expect(screen.queryByText("First, stale")).not.toBeInTheDocument();
  });
});

describe("PublicMessagesSection - privacy / Phase 6 boundary", () => {
  it("31. never renders any internal message id in the DOM", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, data: { messages: [clientMessage(), ownerMessage()] } })
    );
    const { container } = renderSection();
    await screen.findByText("Any update?");

    expect(container.innerHTML).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("32. the component source contains no Convert/Turn into task/Apply update action, and no dangerouslySetInnerHTML", () => {
    const source = readFileSync(join(__dirname, "public-messages-section.tsx"), "utf8");
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toMatch(/convert/i);
    expect(source).not.toMatch(/turn into task/i);
    expect(source).not.toMatch(/apply update/i);
  });
});
