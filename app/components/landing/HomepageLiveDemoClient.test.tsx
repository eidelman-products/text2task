// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import HomepageLiveDemoClient from "./HomepageLiveDemoClient";

const VALID_PUBLIC_TOKEN = "a".repeat(43);
const VALID_IDEMPOTENCY_TOKEN = "b".repeat(43);
const CHALLENGE_TOKEN = "challenge-token";

const analyticsMocks = vi.hoisted(() => ({
  trackLiveDemoExampleClick: vi.fn(),
  trackLiveDemoSubmit: vi.fn(),
  trackLiveDemoSuccess: vi.fn(),
}));

const turnstileMocks = vi.hoisted(() => ({
  adapter: {
    execute: vi.fn(async () => "challenge-token"),
    reset: vi.fn(),
    dispose: vi.fn(),
  },
  createHomepageDemoTurnstileAdapter: vi.fn(),
}));

vi.mock("@/lib/analytics/events", () => analyticsMocks);

vi.mock("./homepage-demo-turnstile.client", () => ({
  HomepageDemoTurnstileClientError: class HomepageDemoTurnstileClientError extends Error {
    readonly code: string;

    constructor(code: string) {
      super("Homepage Demo challenge is unavailable.");
      this.name = "HomepageDemoTurnstileClientError";
      this.code = code;
    }
  },
  createHomepageDemoTurnstileAdapter:
    turnstileMocks.createHomepageDemoTurnstileAdapter,
}));

function jsonResponse(body: unknown, status = 200) {
  const text = JSON.stringify(body);
  const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0));
  let delivered = false;

  return {
    redirected: false,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? "application/json" : null,
    },
    body: {
      getReader: () => ({
        read: async () => {
          if (delivered) {
            return { done: true, value: undefined };
          }

          delivered = true;
          return { done: false, value: bytes };
        },
        releaseLock: () => {},
        cancel: async () => {},
      }),
    },
  } as unknown as Response;
}

function createDeferredResponse(): Readonly<{
  promise: Promise<Response>;
  resolve: (response: Response) => void;
}> {
  let resolveResponse: (response: Response) => void = () => {};
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  return {
    promise,
    resolve: resolveResponse,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
let assignMock: ReturnType<typeof vi.fn>;
let openMock: ReturnType<typeof vi.fn>;
let pendingReviewWindow: {
  close: ReturnType<typeof vi.fn>;
  document: {
    close: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  };
  location: {
    replace: ReturnType<typeof vi.fn>;
  };
  opener: Window | null;
};
const originalLocation = window.location;

beforeEach(() => {
  analyticsMocks.trackLiveDemoExampleClick.mockClear();
  analyticsMocks.trackLiveDemoSubmit.mockClear();
  analyticsMocks.trackLiveDemoSuccess.mockClear();
  turnstileMocks.adapter.execute.mockClear();
  turnstileMocks.adapter.reset.mockClear();
  turnstileMocks.adapter.dispose.mockClear();
  turnstileMocks.createHomepageDemoTurnstileAdapter.mockClear();

  assignMock = vi.fn();
  openMock = vi.fn();
  pendingReviewWindow = {
    close: vi.fn(),
    document: {
      close: vi.fn(),
      open: vi.fn(),
      write: vi.fn(),
    },
    location: {
      replace: vi.fn(),
    },
    opener: window,
  };

  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, assign: assignMock, hash: "" },
  });

  Object.defineProperty(window, "open", {
    configurable: true,
    value: openMock.mockReturnValue(pendingReviewWindow),
  });

  turnstileMocks.adapter.execute.mockResolvedValue(CHALLENGE_TOKEN);
  turnstileMocks.createHomepageDemoTurnstileAdapter.mockResolvedValue(
    turnstileMocks.adapter
  );

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/api/homepage-demo/bootstrap")) {
      return jsonResponse({
        code: "bootstrap_ready",
        publicToken: VALID_PUBLIC_TOKEN,
        idempotencyToken: VALID_IDEMPOTENCY_TOKEN,
      });
    }

    if (url.includes("/api/homepage-demo/extract")) {
      return jsonResponse({ code: "review_ready" });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

function setViewport(kind: "desktop" | "mobile"): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: kind === "desktop",
      media: "(min-width: 900px) and (hover: hover) and (pointer: fine)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

async function submitLiveDemo(): Promise<void> {
  const user = userEvent.setup();
  render(<HomepageLiveDemoClient turnstileSiteKey="site-key" />);

  await user.click(
    screen.getByRole("button", { name: "Preview my project" })
  );
}

function getFetchCalls(path: string) {
  return fetchMock.mock.calls.filter(([input]) =>
    (typeof input === "string" ? input : (input as URL).toString()).includes(
      path
    )
  );
}

describe("HomepageLiveDemoClient - review new-tab navigation", () => {
  it("opens a pending review tab from the preview click and navigates it to the review hash URL", async () => {
    setViewport("desktop");

    await submitLiveDemo();

    expect(openMock).toHaveBeenCalledWith("about:blank", "_blank");
    await waitFor(() =>
      expect(pendingReviewWindow.location.replace).toHaveBeenCalledTimes(1)
    );
    expect(pendingReviewWindow.location.replace).toHaveBeenCalledWith(
      `/homepage-demo/review#${VALID_PUBLIC_TOKEN}`
    );
    expect(pendingReviewWindow.opener).toBeNull();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("transitions the landing page to a completed reuse-only state after opening the review tab", async () => {
    setViewport("desktop");

    await submitLiveDemo();

    await screen.findByRole("button", { name: "Open preview again" });
    expect(
      screen.getByText("Preview opened in a new tab")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your temporary preview is ready.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Creating preview..." })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Preview my project" })
    ).not.toBeInTheDocument();
  });

  it("keeps the original landing page open on mobile success", async () => {
    setViewport("mobile");

    await submitLiveDemo();

    await waitFor(() =>
      expect(pendingReviewWindow.location.replace).toHaveBeenCalledTimes(1)
    );
    expect(pendingReviewWindow.location.replace).toHaveBeenCalledWith(
      `/homepage-demo/review#${VALID_PUBLIC_TOKEN}`
    );
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("keeps the public review token in the URL fragment, not in query string or pathname", async () => {
    setViewport("desktop");

    await submitLiveDemo();

    await waitFor(() =>
      expect(pendingReviewWindow.location.replace).toHaveBeenCalledTimes(1)
    );
    const assignedUrl = String(
      pendingReviewWindow.location.replace.mock.calls[0][0]
    );
    const [pathAndQuery, fragment] = assignedUrl.split("#");

    expect(pathAndQuery).toBe("/homepage-demo/review");
    expect(pathAndQuery).not.toContain(VALID_PUBLIC_TOKEN);
    expect(fragment).toBe(VALID_PUBLIC_TOKEN);
  });

  it("opens the existing review URL again without starting a new extraction flow", async () => {
    setViewport("desktop");
    const user = userEvent.setup();

    await submitLiveDemo();

    await screen.findByRole("button", { name: "Open preview again" });
    openMock.mockClear();
    fetchMock.mockClear();
    analyticsMocks.trackLiveDemoSubmit.mockClear();
    analyticsMocks.trackLiveDemoSuccess.mockClear();
    turnstileMocks.adapter.execute.mockClear();

    await user.click(screen.getByRole("button", { name: "Open preview again" }));

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledWith(
      `/homepage-demo/review#${VALID_PUBLIC_TOKEN}`,
      "_blank"
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(turnstileMocks.adapter.execute).not.toHaveBeenCalled();
    expect(analyticsMocks.trackLiveDemoSubmit).not.toHaveBeenCalled();
    expect(analyticsMocks.trackLiveDemoSuccess).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("multiple reopen clicks reuse the same existing review URL without extraction", async () => {
    setViewport("desktop");
    const user = userEvent.setup();

    await submitLiveDemo();

    const reopenButton = await screen.findByRole("button", {
      name: "Open preview again",
    });
    openMock.mockClear();
    fetchMock.mockClear();
    turnstileMocks.adapter.execute.mockClear();

    await user.click(reopenButton);
    await user.click(reopenButton);

    expect(openMock).toHaveBeenCalledTimes(2);
    expect(openMock).toHaveBeenNthCalledWith(
      1,
      `/homepage-demo/review#${VALID_PUBLIC_TOKEN}`,
      "_blank"
    );
    expect(openMock).toHaveBeenNthCalledWith(
      2,
      `/homepage-demo/review#${VALID_PUBLIC_TOKEN}`,
      "_blank"
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(turnstileMocks.adapter.execute).not.toHaveBeenCalled();
  });

  it("falls back to same-tab navigation for reopening only the existing review URL when popups are blocked", async () => {
    setViewport("desktop");
    const user = userEvent.setup();

    await submitLiveDemo();

    await screen.findByRole("button", { name: "Open preview again" });
    openMock.mockClear();
    fetchMock.mockClear();
    turnstileMocks.adapter.execute.mockClear();
    openMock.mockReturnValue(null);

    await user.click(screen.getByRole("button", { name: "Open preview again" }));

    expect(assignMock).toHaveBeenCalledTimes(1);
    expect(assignMock).toHaveBeenCalledWith(
      `/homepage-demo/review#${VALID_PUBLIC_TOKEN}`
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(turnstileMocks.adapter.execute).not.toHaveBeenCalled();
  });

  it("editing controls stay disabled after success and do not expose a second-demo CTA", async () => {
    setViewport("desktop");

    await submitLiveDemo();

    await screen.findByRole("button", { name: "Open preview again" });
    expect(screen.getByLabelText("Client message")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Try another example" })
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Preview my project" })
    ).not.toBeInTheDocument();
  });

  it("preserves extraction behavior and success tracking before navigation", async () => {
    setViewport("desktop");

    await submitLiveDemo();

    await waitFor(() =>
      expect(pendingReviewWindow.location.replace).toHaveBeenCalledTimes(1)
    );
    expect(analyticsMocks.trackLiveDemoSubmit).toHaveBeenCalledTimes(1);
    expect(analyticsMocks.trackLiveDemoSuccess).toHaveBeenCalledTimes(1);
    expect(turnstileMocks.adapter.execute).toHaveBeenCalledTimes(1);

    const extractCalls = getFetchCalls("/api/homepage-demo/extract");
    expect(extractCalls).toHaveLength(1);
    const extractBody = JSON.parse(
      (extractCalls[0][1] as RequestInit).body as string
    ) as Record<string, unknown>;
    expect(extractBody.publicToken).toBe(VALID_PUBLIC_TOKEN);
    expect(extractBody.idempotencyToken).toBe(VALID_IDEMPOTENCY_TOKEN);
    expect(extractBody.challengeToken).toBe(CHALLENGE_TOKEN);
  });

  it("failed extraction does not navigate", async () => {
    setViewport("desktop");
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/homepage-demo/bootstrap")) {
        return jsonResponse({
          code: "bootstrap_ready",
          publicToken: VALID_PUBLIC_TOKEN,
          idempotencyToken: VALID_IDEMPOTENCY_TOKEN,
        });
      }

      if (url.includes("/api/homepage-demo/extract")) {
        return jsonResponse({ code: "temporarily_unavailable" }, 503);
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });

    await submitLiveDemo();

    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Open preview again" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preview my project" })
    ).toBeEnabled();
    expect(assignMock).not.toHaveBeenCalled();
    expect(openMock).toHaveBeenCalledWith("about:blank", "_blank");
    expect(pendingReviewWindow.close).toHaveBeenCalledTimes(1);
    expect(pendingReviewWindow.location.replace).not.toHaveBeenCalled();
    expect(analyticsMocks.trackLiveDemoSuccess).not.toHaveBeenCalled();
  });

  it("missing or invalid success token fails safely before extraction and navigation", async () => {
    setViewport("desktop");
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/homepage-demo/bootstrap")) {
        return jsonResponse({
          code: "bootstrap_ready",
          publicToken: "not-a-valid-public-token",
          idempotencyToken: VALID_IDEMPOTENCY_TOKEN,
        });
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });

    await submitLiveDemo();

    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Open preview again" })
    ).not.toBeInTheDocument();
    expect(getFetchCalls("/api/homepage-demo/extract")).toHaveLength(0);
    expect(assignMock).not.toHaveBeenCalled();
    expect(openMock).toHaveBeenCalledWith("about:blank", "_blank");
    expect(pendingReviewWindow.close).toHaveBeenCalledTimes(1);
    expect(pendingReviewWindow.location.replace).not.toHaveBeenCalled();
  });

  it("falls back to same-tab review navigation if the pending tab is blocked", async () => {
    setViewport("desktop");
    openMock.mockReturnValue(null);

    await submitLiveDemo();

    await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(1));
    expect(assignMock).toHaveBeenCalledWith(
      `/homepage-demo/review#${VALID_PUBLIC_TOKEN}`
    );
    expect(pendingReviewWindow.location.replace).not.toHaveBeenCalled();
  });

  it("double-submitting while loading does not create duplicate navigation", async () => {
    setViewport("desktop");
    const user = userEvent.setup();
    const extractResponse = createDeferredResponse();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/homepage-demo/bootstrap")) {
        return jsonResponse({
          code: "bootstrap_ready",
          publicToken: VALID_PUBLIC_TOKEN,
          idempotencyToken: VALID_IDEMPOTENCY_TOKEN,
        });
      }

      if (url.includes("/api/homepage-demo/extract")) {
        return await extractResponse.promise;
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });
    render(<HomepageLiveDemoClient turnstileSiteKey="site-key" />);

    const button = screen.getByRole("button", { name: "Preview my project" });
    await user.dblClick(button);

    await waitFor(() =>
      expect(getFetchCalls("/api/homepage-demo/extract")).toHaveLength(1)
    );
    expect(openMock).toHaveBeenCalledTimes(1);
    extractResponse.resolve(jsonResponse({ code: "review_ready" }));

    await waitFor(() =>
      expect(pendingReviewWindow.location.replace).toHaveBeenCalledTimes(1)
    );
    expect(getFetchCalls("/api/homepage-demo/bootstrap")).toHaveLength(1);
    expect(getFetchCalls("/api/homepage-demo/extract")).toHaveLength(1);
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the submit button disabled with loading copy until review navigation begins", async () => {
    setViewport("desktop");
    const user = userEvent.setup();
    const extractResponse = createDeferredResponse();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/homepage-demo/bootstrap")) {
        return jsonResponse({
          code: "bootstrap_ready",
          publicToken: VALID_PUBLIC_TOKEN,
          idempotencyToken: VALID_IDEMPOTENCY_TOKEN,
        });
      }

      if (url.includes("/api/homepage-demo/extract")) {
        return await extractResponse.promise;
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });
    render(<HomepageLiveDemoClient turnstileSiteKey="site-key" />);

    await user.click(
      screen.getByRole("button", { name: "Preview my project" })
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Creating preview..." })
      ).toBeDisabled()
    );
    extractResponse.resolve(jsonResponse({ code: "review_ready" }));
    await waitFor(() =>
      expect(pendingReviewWindow.location.replace).toHaveBeenCalledTimes(1)
    );
    await screen.findByRole("button", { name: "Open preview again" });
    expect(
      screen.queryByRole("button", { name: "Creating preview..." })
    ).not.toBeInTheDocument();
  });
});
