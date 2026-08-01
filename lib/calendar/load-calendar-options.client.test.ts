// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCalendarOptionsClient } from "./load-calendar-options.client";

function jsonResponse(body: unknown, init?: { status?: number; ok?: boolean }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  } as Response;
}

function throwingJsonResponse(init?: { status?: number; ok?: boolean }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async (): Promise<unknown> => {
      throw new Error("not json");
    },
  } as Response;
}

const VALID_RESULT_BODY = {
  success: true,
  projects: [
    { id: "p1", title: "Website redesign", clientId: "c1", clientName: "Acme", isArchived: false },
  ],
  clients: [{ id: "c1", name: "Acme" }],
  projectsTruncated: false,
  clientsTruncated: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadCalendarOptionsClient — URL construction", () => {
  it("uses the bare route with no query string when neither include id is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(VALID_RESULT_BODY));
    vi.stubGlobal("fetch", fetchMock);

    await loadCalendarOptionsClient({});

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/calendar/options");
  });

  it("includes only includeProjectId when only that is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(VALID_RESULT_BODY));
    vi.stubGlobal("fetch", fetchMock);

    await loadCalendarOptionsClient({ includeProjectId: "p1" });

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/calendar/options?includeProjectId=p1");
  });

  it("includes only includeClientId when only that is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(VALID_RESULT_BODY));
    vi.stubGlobal("fetch", fetchMock);

    await loadCalendarOptionsClient({ includeClientId: "c1" });

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/calendar/options?includeClientId=c1");
  });

  it("includes both parameters when both are given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(VALID_RESULT_BODY));
    vi.stubGlobal("fetch", fetchMock);

    await loadCalendarOptionsClient({ includeProjectId: "p1", includeClientId: "c1" });

    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://localhost");
    expect(url.pathname).toBe("/api/calendar/options");
    expect(url.searchParams.get("includeProjectId")).toBe("p1");
    expect(url.searchParams.get("includeClientId")).toBe("c1");
  });

  it("omits null include parameters entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(VALID_RESULT_BODY));
    vi.stubGlobal("fetch", fetchMock);

    await loadCalendarOptionsClient({ includeProjectId: null, includeClientId: null });

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/calendar/options");
  });

  it("URL-encodes include ids via URLSearchParams, never manual concatenation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(VALID_RESULT_BODY));
    vi.stubGlobal("fetch", fetchMock);

    await loadCalendarOptionsClient({ includeProjectId: "p 1&x" });

    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://localhost");
    expect(url.searchParams.get("includeProjectId")).toBe("p 1&x");
  });

  it("requests with cache: no-store", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(VALID_RESULT_BODY));
    vi.stubGlobal("fetch", fetchMock);

    await loadCalendarOptionsClient({});

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });
});

describe("loadCalendarOptionsClient — success narrowing", () => {
  it("returns a validated CalendarOptionsResult on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(VALID_RESULT_BODY)));

    const result = await loadCalendarOptionsClient({});

    expect(result).toEqual({
      ok: true,
      result: {
        projects: VALID_RESULT_BODY.projects,
        clients: VALID_RESULT_BODY.clients,
        projectsTruncated: false,
        clientsTruncated: false,
      },
    });
  });

  it("accepts the full project option shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(VALID_RESULT_BODY)));

    const result = await loadCalendarOptionsClient({});

    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.result.projects[0]).toEqual({
        id: "p1",
        title: "Website redesign",
        clientId: "c1",
        clientName: "Acme",
        isArchived: false,
      });
    }
  });

  it("accepts an archived project option with null client fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          projects: [
            { id: "p2", title: "Old campaign", clientId: null, clientName: null, isArchived: true },
          ],
          clients: [],
          projectsTruncated: false,
          clientsTruncated: false,
        })
      )
    );

    const result = await loadCalendarOptionsClient({});

    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.result.projects[0]).toEqual({
        id: "p2",
        title: "Old campaign",
        clientId: null,
        clientName: null,
        isArchived: true,
      });
    }
  });

  it("accepts the client option shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(VALID_RESULT_BODY)));

    const result = await loadCalendarOptionsClient({});

    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.result.clients[0]).toEqual({ id: "c1", name: "Acme" });
    }
  });

  it("requires both truncation booleans to be present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ success: true, projects: [], clients: [], projectsTruncated: false })
      )
    );

    const result = await loadCalendarOptionsClient({});

    expect(result).toEqual({ ok: false, error: "Could not load project and client options." });
  });

  it("does not infer truncation from array length", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          projects: new Array(200).fill(VALID_RESULT_BODY.projects[0]),
          clients: [],
          projectsTruncated: true,
          clientsTruncated: false,
        })
      )
    );

    const result = await loadCalendarOptionsClient({});

    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.result.projectsTruncated).toBe(true);
      expect(result.result.projects).toHaveLength(200);
    }
  });
});

describe("loadCalendarOptionsClient — failure handling", () => {
  it("returns a stable error for malformed JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(throwingJsonResponse()));

    const result = await loadCalendarOptionsClient({});

    expect(result).toEqual({ ok: false, error: "Could not load project and client options." });
  });

  it("returns a stable error for a malformed success object (missing arrays)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true })));

    const result = await loadCalendarOptionsClient({});

    expect(result).toEqual({ ok: false, error: "Could not load project and client options." });
  });

  it("returns a stable error when a project entry is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          projects: [{ id: "p1" }], // missing title/clientId/clientName/isArchived
          clients: [],
          projectsTruncated: false,
          clientsTruncated: false,
        })
      )
    );

    const result = await loadCalendarOptionsClient({});

    expect(result).toEqual({ ok: false, error: "Could not load project and client options." });
  });

  it("returns a stable error when a client entry is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          projects: [],
          clients: [{ id: "c1" }], // missing name
          projectsTruncated: false,
          clientsTruncated: false,
        })
      )
    );

    const result = await loadCalendarOptionsClient({});

    expect(result).toEqual({ ok: false, error: "Could not load project and client options." });
  });

  it("returns a stable, generic error on a 400 response, never the raw body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "includeProjectId must be a valid UUID." }, { ok: false, status: 400 }))
    );

    const result = await loadCalendarOptionsClient({});

    expect(result).toEqual({ ok: false, error: "Could not load project and client options." });
  });

  it("returns a stable, generic error on a 500 response, never a raw database message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "relation \"projects\" does not exist" }, { ok: false, status: 500 }))
    );

    const result = await loadCalendarOptionsClient({});

    expect(result).toEqual({ ok: false, error: "Could not load project and client options." });
  });

  it("resolves to null (cancellation) on an expected AbortError, never throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"))
    );

    const result = await loadCalendarOptionsClient({});

    expect(result).toBeNull();
  });

  it("produces no unhandled rejection for an aborted request", async () => {
    const rejections: unknown[] = [];
    const handler = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", handler);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"))
    );

    await loadCalendarOptionsClient({ signal: new AbortController().signal });
    await new Promise((resolve) => setTimeout(resolve, 10));

    process.off("unhandledRejection", handler);
    expect(rejections).toHaveLength(0);
  });
});
