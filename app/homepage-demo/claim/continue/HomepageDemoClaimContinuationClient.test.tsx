// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import HomepageDemoClaimContinuationClient from "./HomepageDemoClaimContinuationClient";

const CLAIM_SAVE_ENDPOINT = "/api/homepage-demo/claim/save";
const CLAIM_SAVE_ANYWAY_ENDPOINT = "/api/homepage-demo/claim/save-anyway";
const DASHBOARD_DESTINATION = "/dashboard";
const LOGIN_DESTINATION = "/login?intent=homepage-demo-claim";

type JsonBody = Readonly<Record<string, unknown>>;

function jsonResponse(body: JsonBody, status = 200) {
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

function successBody(code: "saved" | "already_claimed", created: boolean) {
  return {
    code,
    destination: DASHBOARD_DESTINATION,
    created,
  };
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

let fetchMock: ReturnType<typeof vi.fn>;
let replaceMock: ReturnType<typeof vi.fn>;
const originalLocation = window.location;

beforeEach(() => {
  replaceMock = vi.fn();

  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, replace: replaceMock },
  });

  fetchMock = vi.fn();
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

function getFetchCalls(path: string) {
  return fetchMock.mock.calls.filter(([input]) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    return new URL(url, "http://localhost").pathname === path;
  });
}

function mockSaveResult(
  body: JsonBody,
  status = 200
): ReturnType<typeof fetchMock.mockImplementation> {
  return fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (new URL(url, "http://localhost").pathname === CLAIM_SAVE_ENDPOINT) {
      return jsonResponse(body, status);
    }

    throw new Error(`Unexpected fetch to ${url}`);
  });
}

describe("HomepageDemoClaimContinuationClient", () => {
  it("auto-saves immediately after authentication and redirects to the dashboard on a fresh save", async () => {
    mockSaveResult(successBody("saved", true));

    render(<HomepageDemoClaimContinuationClient />);

    expect(
      screen.getByRole("heading", { name: "Saving your project..." })
    ).toBeInTheDocument();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith(DASHBOARD_DESTINATION);

    const saveCalls = getFetchCalls(CLAIM_SAVE_ENDPOINT);
    expect(saveCalls).toHaveLength(1);
    expect(saveCalls[0][1]).toMatchObject({
      method: "POST",
      body: "{}",
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
  });

  it("redirects to the dashboard for an already-claimed idempotent replay", async () => {
    mockSaveResult(successBody("already_claimed", false));

    render(<HomepageDemoClaimContinuationClient />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith(DASHBOARD_DESTINATION);
    expect(getFetchCalls(CLAIM_SAVE_ENDPOINT)).toHaveLength(1);
  });

  it("shows duplicate confirmation and lets the user save another copy", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      const pathname = new URL(url, "http://localhost").pathname;

      if (pathname === CLAIM_SAVE_ANYWAY_ENDPOINT) {
        return jsonResponse(successBody("saved", true));
      }

      if (pathname === CLAIM_SAVE_ENDPOINT) {
        return jsonResponse({ code: "duplicate_detected" }, 409);
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });

    const user = userEvent.setup();
    render(<HomepageDemoClaimContinuationClient />);

    const saveAnywayButton = await screen.findByRole("button", {
      name: "Save anyway",
    });
    expect(
      screen.getByRole("heading", { name: "A similar project was found" })
    ).toBeInTheDocument();

    await user.click(saveAnywayButton);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith(DASHBOARD_DESTINATION);
    expect(getFetchCalls(CLAIM_SAVE_ENDPOINT)).toHaveLength(1);
    expect(getFetchCalls(CLAIM_SAVE_ANYWAY_ENDPOINT)).toHaveLength(1);
  });

  it("prevents duplicate save-anyway submissions while the override request is in flight", async () => {
    const pendingSaveAnyway = deferredResponse();

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      const pathname = new URL(url, "http://localhost").pathname;

      if (pathname === CLAIM_SAVE_ANYWAY_ENDPOINT) {
        return pendingSaveAnyway.promise;
      }

      if (pathname === CLAIM_SAVE_ENDPOINT) {
        return Promise.resolve(jsonResponse({ code: "duplicate_detected" }, 409));
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });

    const user = userEvent.setup();
    render(<HomepageDemoClaimContinuationClient />);

    const saveAnywayButton = await screen.findByRole("button", {
      name: "Save anyway",
    });

    await user.dblClick(saveAnywayButton);
    expect(
      await screen.findByRole("heading", { name: "Saving another copy..." })
    ).toBeInTheDocument();
    expect(getFetchCalls(CLAIM_SAVE_ANYWAY_ENDPOINT)).toHaveLength(1);

    pendingSaveAnyway.resolve(jsonResponse(successBody("saved", true)));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith(DASHBOARD_DESTINATION);
  });

  it("refreshes normal duplicate authority when save-anyway authority has expired", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      const pathname = new URL(url, "http://localhost").pathname;

      if (pathname === CLAIM_SAVE_ANYWAY_ENDPOINT) {
        return jsonResponse({ code: "duplicate_authority_expired" }, 410);
      }

      if (pathname === CLAIM_SAVE_ENDPOINT) {
        return jsonResponse({ code: "duplicate_detected" }, 409);
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });

    const user = userEvent.setup();
    render(<HomepageDemoClaimContinuationClient />);

    await user.click(
      await screen.findByRole("button", { name: "Save anyway" })
    );

    expect(
      await screen.findByText("Please confirm again before saving another copy.")
    ).toBeInTheDocument();
    expect(getFetchCalls(CLAIM_SAVE_ENDPOINT)).toHaveLength(2);
    expect(getFetchCalls(CLAIM_SAVE_ANYWAY_ENDPOINT)).toHaveLength(1);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("shows retry UI after a temporary save failure and retries without duplicating while loading", async () => {
    const retryResponse = deferredResponse();

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ code: "temporarily_unavailable" }, 503)
      )
      .mockReturnValueOnce(retryResponse.promise);

    const user = userEvent.setup();
    render(<HomepageDemoClaimContinuationClient />);

    const retryButton = await screen.findByRole("button", { name: "Try again" });
    expect(
      screen.getByRole("heading", {
        name: "We couldn't save your project right now.",
      })
    ).toBeInTheDocument();

    await user.dblClick(retryButton);
    expect(
      await screen.findByRole("heading", { name: "Saving your project..." })
    ).toBeInTheDocument();
    expect(getFetchCalls(CLAIM_SAVE_ENDPOINT)).toHaveLength(2);

    retryResponse.resolve(jsonResponse(successBody("saved", true)));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith(DASHBOARD_DESTINATION);
  });

  it("redirects unauthenticated users back to the demo-intent login route", async () => {
    mockSaveResult({ code: "unauthorized" }, 401);

    render(<HomepageDemoClaimContinuationClient />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith(LOGIN_DESTINATION);
  });

  it("fails closed when the continuation claim is expired or unavailable", async () => {
    mockSaveResult({ code: "expired" }, 410);

    render(<HomepageDemoClaimContinuationClient />);

    expect(
      await screen.findByRole("heading", {
        name: "This project preview has expired.",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to homepage" })).toHaveAttribute(
      "href",
      "/"
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
