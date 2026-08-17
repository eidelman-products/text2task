// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ShareView } from "./share-view.client";

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
