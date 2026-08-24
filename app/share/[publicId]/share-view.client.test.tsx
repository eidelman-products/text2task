// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ShareView, REVALIDATION_INTERVAL_MS } from "./share-view.client";

const VALID_PUBLIC_ID = "abcdefgh12345678ijklmnop";
const VALID_SECRET = "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc"; // 43 base64url chars

function setLocation(pathname: string, hash: string) {
  window.history.replaceState(null, "", pathname + hash);
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    })
  );
}

function fakeProjection() {
  return {
    title: "Website launch",
    subtitle: null,
    status: null,
    targetDate: null,
    contentDirection: "auto" as const,
    commentsEnabled: false,
    progress: null,
    latestUpdate: null,
    tasks: [],
    resources: [],
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

describe("ShareView - fragment lifecycle", () => {
  it("scrubs the fragment from the visible URL immediately on mount", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/share/session") return jsonResponse({ ok: true, status: "authorized" });
      return jsonResponse({ ok: true, data: fakeProjection() });
    });

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    await waitFor(() => {
      expect(window.location.hash).toBe("");
    });
    expect(window.location.pathname).toBe(`/share/${VALID_PUBLIC_ID}`);
  });

  it("exchanges the fragment secret via POST /api/share/session with publicId+secret only", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/share/session") return jsonResponse({ ok: true, status: "authorized" });
      return jsonResponse({ ok: true, data: fakeProjection() });
    });

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    await waitFor(() => {
      const exchangeCall = fetchMock.mock.calls.find(([url]) => url === "/api/share/session");
      expect(exchangeCall).toBeDefined();
    });

    const [, exchangeOptions] = fetchMock.mock.calls.find(([url]) => url === "/api/share/session")!;
    const parsedBody = JSON.parse((exchangeOptions as RequestInit).body as string);
    expect(parsedBody).toEqual({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET });
  });

  it("a malformed fragment never triggers a network call and shows the unavailable state", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, "#not-a-valid-secret");

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    await screen.findByText(/not available/i);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("with no fragment at all, fetches the projection directly (returning-visitor / clean-URL refresh path)", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, "");
    fetchMock.mockImplementation(() => jsonResponse({ ok: true, data: fakeProjection() }));

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/share/${VALID_PUBLIC_ID}/projection`,
        expect.objectContaining({ method: "GET" })
      );
    });
    expect(fetchMock).not.toHaveBeenCalledWith("/api/share/session", expect.anything());
  });

  it("the secret never appears anywhere in the rendered DOM", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/share/session") return jsonResponse({ ok: true, status: "authorized" });
      return jsonResponse({ ok: true, data: fakeProjection() });
    });

    const { container } = render(<ShareView publicId={VALID_PUBLIC_ID} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.innerHTML).not.toContain(VALID_SECRET);
  });
});

describe("ShareView - authorized -> ready renders the real Phase 2D ClientProjectView", () => {
  it("renders the projection once authorized", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/share/session") return jsonResponse({ ok: true, status: "authorized" });
      return jsonResponse({ ok: true, data: fakeProjection() });
    });

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    await screen.findByText("Website launch");
    await screen.findByText("Shared securely via Text2Task.");
  });

  it("PHASE 4C -- passes this exact route's own publicId through to ClientProjectView, so a FILE resource's action points at THIS publicId's file endpoint", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/share/session") return jsonResponse({ ok: true, status: "authorized" });
      return jsonResponse({
        ok: true,
        data: {
          ...fakeProjection(),
          resources: [{ kind: "file", label: "Final logo", canDownload: false, fileRef: "opaque-ref-1" }],
        },
      });
    });

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    const action = await screen.findByRole("link", { name: "Open file" });
    expect(action).toHaveAttribute("href", `/api/share/${VALID_PUBLIC_ID}/resources/opaque-ref-1`);
  });
});

describe("ShareView - PIN flow", () => {
  it("shows the PIN form when the server returns pin_required", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    fetchMock.mockImplementation(() => jsonResponse({ ok: true, status: "pin_required" }));

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    await screen.findByText(/PIN protected/i);
  });

  it("submitting the PIN resends the retained secret plus the PIN to the same exchange endpoint", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    let call = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/share/session") {
        call += 1;
        if (call === 1) return jsonResponse({ ok: true, status: "pin_required" });
        return jsonResponse({ ok: true, status: "authorized" });
      }
      return jsonResponse({ ok: true, data: fakeProjection() });
    });

    render(<ShareView publicId={VALID_PUBLIC_ID} />);
    await screen.findByText(/PIN protected/i);

    const input = screen.getByLabelText("PIN");
    await userEvent.type(input, "1234");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      const secondCall = fetchMock.mock.calls.filter(([url]) => url === "/api/share/session")[1];
      expect(secondCall).toBeDefined();
    });

    const secondExchangeCall = fetchMock.mock.calls.filter(([url]) => url === "/api/share/session")[1];
    const parsedBody = JSON.parse((secondExchangeCall[1] as RequestInit).body as string);
    expect(parsedBody).toEqual({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET, pin: "1234" });
  });

  it("wrong PIN keeps the form visible with an error message and does not advance to ready", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/share/session") {
        return jsonResponse({ ok: false, code: "PIN_INCORRECT", error: "Incorrect PIN." }, 401);
      }
      return jsonResponse({ ok: true, data: fakeProjection() });
    });

    render(<ShareView publicId={VALID_PUBLIC_ID} />);
    await screen.findByText(/PIN protected/i);

    await userEvent.type(screen.getByLabelText("PIN"), "0000");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByText(/incorrect pin/i);
    expect(screen.queryByText("Website launch")).not.toBeInTheDocument();
  });

  it("correct PIN advances to the ready projection view", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    let call = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/share/session") {
        call += 1;
        return call === 1
          ? jsonResponse({ ok: true, status: "pin_required" })
          : jsonResponse({ ok: true, status: "authorized" });
      }
      return jsonResponse({ ok: true, data: fakeProjection() });
    });

    render(<ShareView publicId={VALID_PUBLIC_ID} />);
    await screen.findByText(/PIN protected/i);

    await userEvent.type(screen.getByLabelText("PIN"), "1234");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByText("Website launch");
  });
});

describe("ShareView - rate limiting", () => {
  it("shows a rate-limited message on 429 from the exchange endpoint", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    fetchMock.mockImplementation(() => jsonResponse({ ok: false, code: "RATE_LIMITED" }, 429));

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    await screen.findByText(/wait a moment/i);
  });

  it("shows a rate-limited message on 429 from the projection endpoint", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, "");
    fetchMock.mockImplementation(() => jsonResponse({ ok: false, code: "RATE_LIMITED" }, 429));

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    await screen.findByText(/wait a moment/i);
  });
});

describe("ShareView - unavailable posture", () => {
  it("shows a generic unavailable message on a generic exchange failure", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    fetchMock.mockImplementation(() => jsonResponse({ ok: false, code: "UNAVAILABLE" }, 404));

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    await screen.findByText(/not available/i);
  });

  it("shows a generic unavailable message when the projection fetch fails after authorization", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/share/session") return jsonResponse({ ok: true, status: "authorized" });
      return jsonResponse({ ok: false, code: "UNAVAILABLE" }, 401);
    });

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    await screen.findByText(/not available/i);
  });
});

describe("ShareView - Phase 5D Messages section wiring", () => {
  function mockEndpoints(commentsEnabled: boolean) {
    fetchMock.mockImplementation((url: string) => {
      if (url === `/api/share/${VALID_PUBLIC_ID}/projection`) {
        return jsonResponse({ ok: true, data: { ...fakeProjection(), commentsEnabled } });
      }
      if (url === `/api/share/${VALID_PUBLIC_ID}/messages`) {
        return jsonResponse({ ok: true, data: { messages: [] } });
      }
      return jsonResponse({ ok: true, data: fakeProjection() });
    });
  }

  it("renders the Messages section when the projection's commentsEnabled is true", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, "");
    mockEndpoints(true);

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    expect(await screen.findByRole("region", { name: "Messages" })).toBeInTheDocument();
  });

  it("does not render the Messages section, and never fetches it, when commentsEnabled is false", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, "");
    mockEndpoints(false);

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    await screen.findByText("Website launch");
    expect(screen.queryByRole("region", { name: "Messages" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      `/api/share/${VALID_PUBLIC_ID}/messages`,
      expect.anything()
    );
  });
});

describe("ShareView - Phase 7C live invalidation / background revalidation", () => {
  const PROJECTION_URL = `/api/share/${VALID_PUBLIC_ID}/projection`;

  function setVisibility(value: "visible" | "hidden") {
    Object.defineProperty(document, "visibilityState", {
      value,
      configurable: true,
    });
  }

  beforeEach(() => {
    // `shouldAdvanceTime` keeps the fake clock synced to real elapsed time,
    // so Testing Library's own internal `waitFor`/`findBy*` polling (which
    // uses real setTimeout scheduling) still resolves normally, while
    // `vi.advanceTimersByTimeAsync` remains available to jump the clock
    // forward deterministically for the interval/focus/visibility
    // assertions below. Enabling this from the very start of the test
    // (rather than after mount) also ensures the component's own
    // `setInterval` is registered against the fake clock, so it can
    // actually be advanced by `vi.advanceTimersByTimeAsync`.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderReady(initialTitle = "Website launch") {
    setLocation(`/share/${VALID_PUBLIC_ID}`, "");
    let projectionCallCount = 0;
    let currentBody: unknown = { ok: true, data: { ...fakeProjection(), title: initialTitle } };
    let currentStatus = 200;

    // Deliberately never reassigned via fetchMock.mockImplementation again
    // after this point (even by individual tests) -- all response control
    // flows through setNextProjectionBody/setNextProjectionStatus so the
    // call counter below stays accurate for the lifetime of the test.
    fetchMock.mockImplementation((url: string) => {
      if (url === PROJECTION_URL) {
        projectionCallCount++;
        return jsonResponse(currentBody, currentStatus);
      }
      return jsonResponse({ ok: true, data: fakeProjection() });
    });

    const view = render(<ShareView publicId={VALID_PUBLIC_ID} />);
    await screen.findByText(initialTitle);

    return {
      ...view,
      getProjectionCallCount: () => projectionCallCount,
      setNextProjectionBody: (body: unknown) => {
        currentBody = body;
      },
      setNextProjectionStatus: (status: number) => {
        currentStatus = status;
      },
    };
  }

  it("does not poll while the document is hidden", async () => {
    const { getProjectionCallCount } = await renderReady();
    setVisibility("hidden");

    await vi.advanceTimersByTimeAsync(REVALIDATION_INTERVAL_MS);

    expect(getProjectionCallCount()).toBe(1);
  });

  it("polls again at the chosen interval while visible", async () => {
    const { getProjectionCallCount } = await renderReady();

    await vi.advanceTimersByTimeAsync(REVALIDATION_INTERVAL_MS);

    expect(getProjectionCallCount()).toBe(2);
  });

  it("does not poll again before the interval elapses", async () => {
    const { getProjectionCallCount } = await renderReady();

    await vi.advanceTimersByTimeAsync(REVALIDATION_INTERVAL_MS - 1000);

    expect(getProjectionCallCount()).toBe(1);
  });

  it("focus regaining triggers an immediate revalidation, without waiting for the interval", async () => {
    const { getProjectionCallCount } = await renderReady();

    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(getProjectionCallCount()).toBe(2));
  });

  it("a visibilitychange-to-visible event triggers an immediate revalidation", async () => {
    const { getProjectionCallCount } = await renderReady();

    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(getProjectionCallCount()).toBe(2));
  });

  it("focus while hidden does not trigger a revalidation", async () => {
    const { getProjectionCallCount } = await renderReady();
    setVisibility("hidden");

    window.dispatchEvent(new Event("focus"));
    // No fake-timer advance needed here -- this asserts the handler's own
    // synchronous visibility guard, not a delayed effect.
    expect(getProjectionCallCount()).toBe(1);
  });

  it("a successful background revalidation replaces stale content with the fresh projection", async () => {
    const { getProjectionCallCount, setNextProjectionBody } = await renderReady("Website launch");
    setNextProjectionBody({ ok: true, data: { ...fakeProjection(), title: "Website launch v2" } });

    await vi.advanceTimersByTimeAsync(REVALIDATION_INTERVAL_MS);
    await vi.waitFor(() => expect(getProjectionCallCount()).toBe(2));

    expect(await screen.findByText("Website launch v2")).toBeInTheDocument();
    expect(screen.queryByText("Website launch")).not.toBeInTheDocument();
  });

  it("a mapping change (e.g. an unshared task) is reflected on the next revalidation with no special-case handling", async () => {
    const withTask = {
      ok: true,
      data: {
        ...fakeProjection(),
        tasks: [{ title: "Design hero", publicGroup: "in_progress", waitingForClientFeedback: false }],
      },
    };
    const { getProjectionCallCount, setNextProjectionBody } = await renderReady();
    setNextProjectionBody(withTask);

    // Force a fresh render cycle showing the task first (simulating an
    // already-mapped task being visible before the owner unmaps it).
    window.dispatchEvent(new Event("focus"));
    await screen.findByText("Design hero");

    setNextProjectionBody({ ok: true, data: fakeProjection() }); // task removed from the next response
    await vi.advanceTimersByTimeAsync(REVALIDATION_INTERVAL_MS);
    await vi.waitFor(() => expect(getProjectionCallCount()).toBeGreaterThanOrEqual(3));
    await vi.waitFor(() => expect(screen.queryByText("Design hero")).not.toBeInTheDocument());
  });

  it("access lost during background revalidation (revoked/disabled/expired) drops the stale projection and shows the unavailable state -- fail closed, not stale-behind-an-error", async () => {
    await renderReady();
    fetchMock.mockImplementation(() =>
      jsonResponse({ ok: false, code: "UNAVAILABLE", error: "gone" }, 401)
    );

    await vi.advanceTimersByTimeAsync(REVALIDATION_INTERVAL_MS);

    expect(await screen.findByText(/not available/i)).toBeInTheDocument();
    expect(screen.queryByText("Website launch")).not.toBeInTheDocument();
  });

  it("access lost during background revalidation also removes the Messages section -- no stale Send control against hidden project content", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, "");
    fetchMock.mockImplementation((url: string) => {
      if (url === PROJECTION_URL) {
        return jsonResponse({ ok: true, data: { ...fakeProjection(), commentsEnabled: true } });
      }
      if (url === `/api/share/${VALID_PUBLIC_ID}/messages`) {
        return jsonResponse({ ok: true, data: { messages: [] } });
      }
      return jsonResponse({ ok: true, data: fakeProjection() });
    });
    render(<ShareView publicId={VALID_PUBLIC_ID} />);
    expect(await screen.findByRole("region", { name: "Messages" })).toBeInTheDocument();

    fetchMock.mockImplementation(() =>
      jsonResponse({ ok: false, code: "UNAVAILABLE", error: "gone" }, 401)
    );
    await vi.advanceTimersByTimeAsync(REVALIDATION_INTERVAL_MS);

    await vi.waitFor(() => {
      expect(screen.queryByRole("region", { name: "Messages" })).not.toBeInTheDocument();
    });
  });

  it("access lost during background revalidation never re-triggers a session exchange -- the discarded secret is never resurrected, and no exchange/projection loop occurs", async () => {
    await renderReady();
    fetchMock.mockClear();
    fetchMock.mockImplementation(() =>
      jsonResponse({ ok: false, code: "UNAVAILABLE", error: "gone" }, 401)
    );

    await vi.advanceTimersByTimeAsync(REVALIDATION_INTERVAL_MS);
    await screen.findByText(/not available/i);

    // The fallback path (fetchProjection) is the only extra call --
    // never POST /api/share/session, since no secret is retained.
    const sessionCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/share/session");
    expect(sessionCalls).toHaveLength(0);
  });

  it("a rate-limited background poll (429) does not disrupt the current view", async () => {
    const { getProjectionCallCount, setNextProjectionBody, setNextProjectionStatus } = await renderReady();
    setNextProjectionBody({ ok: false, code: "RATE_LIMITED" });
    setNextProjectionStatus(429);

    await vi.advanceTimersByTimeAsync(REVALIDATION_INTERVAL_MS);
    await vi.waitFor(() => expect(getProjectionCallCount()).toBe(2));

    expect(screen.getByText("Website launch")).toBeInTheDocument();
  });

  it("unmounting clears the interval and removes the focus/visibilitychange listeners", async () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const removeFocusSpy = vi.spyOn(window, "removeEventListener");
    const removeVisibilitySpy = vi.spyOn(document, "removeEventListener");

    const { unmount, getProjectionCallCount } = await renderReady();
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(removeFocusSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(removeVisibilitySpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

    // No further fetch happens after unmount even if the interval's own
    // original timer somehow still fired (it should not, but this proves
    // the observable outcome, not just that the API was called).
    await vi.advanceTimersByTimeAsync(REVALIDATION_INTERVAL_MS * 2);
    expect(getProjectionCallCount()).toBe(1);
  });
});

describe("ShareView - Phase 7D accessibility (headings + live regions on top-level page states)", () => {
  it("the 'unavailable' state carries a heading and an assertive live region", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, "#not-a-valid-secret");

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    const heading = await screen.findByRole("heading", { name: /not available/i });
    expect(heading.tagName).toBe("H1");
    expect(screen.getByRole("alert")).toHaveTextContent(/not available/i);
  });

  it("the PIN-required state carries a heading", async () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, `#${VALID_SECRET}`);
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/share/session") return jsonResponse({ ok: true, status: "pin_required" });
      return jsonResponse({ ok: true, data: fakeProjection() });
    });

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    const heading = await screen.findByRole("heading", { name: /pin protected/i });
    expect(heading.tagName).toBe("H1");
  });

  it("the loading state carries a polite live region", () => {
    setLocation(`/share/${VALID_PUBLIC_ID}`, "");
    fetchMock.mockReturnValue(new Promise(() => {}));

    render(<ShareView publicId={VALID_PUBLIC_ID} />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });
});
