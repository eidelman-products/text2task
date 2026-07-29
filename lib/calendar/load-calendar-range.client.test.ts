// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import {
  isCalendarAbortError,
  loadCalendarRangeClient,
  type LoadCalendarRangeClientResult,
} from "./load-calendar-range.client";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid DateOnly`);
  return parsed;
}

/** Narrows away the `null` ("this was aborted") case for tests asserting a genuine settled result. */
function expectSettled(
  result: LoadCalendarRangeClientResult | null
): LoadCalendarRangeClientResult {
  if (result === null) throw new Error("expected a settled (non-aborted) result, got null");
  return result;
}

const RANGE = { start: toDateOnly("2027-01-01"), end: toDateOnly("2027-02-11") };

function jsonResponse(body: unknown, init?: { status?: number; ok?: boolean }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadCalendarRangeClient", () => {
  it("fetches the exact start/end range with cache: no-store", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await loadCalendarRangeClient(RANGE, new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/calendar?start=2027-01-01&end=2027-02-11");
    expect(options).toMatchObject({ cache: "no-store" });
  });

  it("parses valid project deadline and manual event items", async () => {
    const deadline = {
      kind: "project_deadline",
      id: "project:p1",
      date: "2027-01-10",
      projectId: "p1",
      title: "Website redesign",
      clientName: "Acme",
      status: "in_progress",
      priority: "high",
      isOverdue: false,
    };
    const manualEvent = {
      kind: "manual_event",
      id: "event:e1",
      date: "2027-01-12",
      time: "14:30",
      title: "Client call",
      notes: "Discuss scope",
      projectId: null,
      projectTitle: null,
      clientId: "c1",
      clientName: "Acme",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, items: [deadline, manualEvent] }))
    );

    const result = await loadCalendarRangeClient(RANGE, new AbortController().signal);

    expect(result).toEqual({ ok: true, items: [deadline, manualEvent] });
  });

  it("accepts a manual event with a null time as an all-day event", async () => {
    const manualEvent = {
      kind: "manual_event",
      id: "event:e2",
      date: "2027-01-12",
      time: null,
      title: "All-day reminder",
      notes: null,
      projectId: null,
      projectTitle: null,
      clientId: null,
      clientName: null,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, items: [manualEvent] }))
    );

    const result = await loadCalendarRangeClient(RANGE, new AbortController().signal);

    expect(result).toEqual({ ok: true, items: [manualEvent] });
  });

  it("drops an individual item with an invalid non-null time rather than failing the whole request", async () => {
    const badEvent = {
      kind: "manual_event",
      id: "event:e3",
      date: "2027-01-12",
      time: "not-a-time",
      title: "Broken",
      notes: null,
      projectId: null,
      projectTitle: null,
      clientId: null,
      clientName: null,
    };
    const goodDeadline = {
      kind: "project_deadline",
      id: "project:p2",
      date: "2027-01-13",
      projectId: "p2",
      title: "Ok",
      clientName: null,
      status: null,
      priority: null,
      isOverdue: true,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, items: [badEvent, goodDeadline] }))
    );

    const result = await loadCalendarRangeClient(RANGE, new AbortController().signal);

    expect(result).toEqual({ ok: true, items: [goodDeadline] });
  });

  it("drops an item missing a required field", async () => {
    const missingTitle = {
      kind: "project_deadline",
      id: "project:p3",
      date: "2027-01-14",
      projectId: "p3",
      clientName: null,
      status: null,
      priority: null,
      isOverdue: false,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, items: [missingTitle] }))
    );

    const result = await loadCalendarRangeClient(RANGE, new AbortController().signal);

    expect(result).toEqual({ ok: true, items: [] });
  });

  it("drops an item with an unrecognized kind", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ success: true, items: [{ kind: "mystery", id: "x", date: "2027-01-14" }] })
      )
    );

    const result = await loadCalendarRangeClient(RANGE, new AbortController().signal);

    expect(result).toEqual({ ok: true, items: [] });
  });

  it("rejects a response whose items field is not an array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, items: "nope" })));

    const result = expectSettled(await loadCalendarRangeClient(RANGE, new AbortController().signal));

    expect(result.ok).toBe(false);
  });

  it("rejects a response missing success: true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ items: [] })));

    const result = expectSettled(await loadCalendarRangeClient(RANGE, new AbortController().signal));

    expect(result.ok).toBe(false);
  });

  it("surfaces the server's error message on a non-200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Range too large" }, { ok: false, status: 400 }))
    );

    const result = await loadCalendarRangeClient(RANGE, new AbortController().signal);

    expect(result).toEqual({ ok: false, error: "Range too large" });
  });

  it("returns a generic error on a non-200 response with an unreadable body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 500 })));

    const result = await loadCalendarRangeClient(RANGE, new AbortController().signal);

    expect(result).toEqual({ ok: false, error: "Could not load calendar items." });
  });

  it("returns a network-failure error when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = expectSettled(await loadCalendarRangeClient(RANGE, new AbortController().signal));

    expect(result.ok).toBe(false);
  });

  it("resolves to null (never rejects) when fetch() rejects with a real DOMException AbortError", async () => {
    const abortError = new DOMException("signal is aborted without reason", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(
      loadCalendarRangeClient(RANGE, new AbortController().signal)
    ).resolves.toBeNull();
  });

  it("resolves to null (never rejects) when fetch() rejects with a plain Error named AbortError (fallback shape)", async () => {
    const abortError = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(
      loadCalendarRangeClient(RANGE, new AbortController().signal)
    ).resolves.toBeNull();
  });

  it("resolves to null when the abort happens while reading the response body (response.json() rejects with AbortError)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new DOMException("signal is aborted without reason", "AbortError");
        },
      } as unknown as Response)
    );

    await expect(
      loadCalendarRangeClient(RANGE, new AbortController().signal)
    ).resolves.toBeNull();
  });

  it("returns an error when the response body cannot be parsed as JSON for a genuine (non-abort) reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      } as unknown as Response)
    );

    const result = expectSettled(await loadCalendarRangeClient(RANGE, new AbortController().signal));

    expect(result.ok).toBe(false);
  });
});

describe("isCalendarAbortError", () => {
  it("is true for a real DOMException named AbortError", () => {
    expect(isCalendarAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
  });

  it("is true for a plain Error named AbortError (fallback shape)", () => {
    expect(isCalendarAbortError(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(
      true
    );
  });

  it("is false for a DOMException with a different name", () => {
    expect(isCalendarAbortError(new DOMException("nope", "NotFoundError"))).toBe(false);
  });

  it("is false for a genuine network error", () => {
    expect(isCalendarAbortError(new TypeError("Failed to fetch"))).toBe(false);
  });

  it("is false for non-error values", () => {
    expect(isCalendarAbortError("AbortError")).toBe(false);
    expect(isCalendarAbortError(null)).toBe(false);
    expect(isCalendarAbortError(undefined)).toBe(false);
  });
});
