// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import type { CreateCalendarEventInput, UpdateCalendarEventInput } from "@/lib/calendar/calendar-types";
import {
  createCalendarEventClient,
  deleteCalendarEventClient,
  updateCalendarEventClient,
} from "./mutate-calendar-event.client";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid DateOnly`);
  return parsed;
}

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_ITEM_ID = `event:${VALID_UUID}`;

const VALID_ITEM = {
  kind: "manual_event",
  id: VALID_ITEM_ID,
  date: "2027-01-12",
  time: "14:30",
  title: "Client call",
  notes: "Discuss scope",
  projectId: null,
  projectTitle: null,
  clientId: null,
  clientName: null,
};

const CREATE_INPUT: CreateCalendarEventInput = {
  title: "Client call",
  eventDate: toDateOnly("2027-01-12"),
  eventTime: null,
  notes: null,
  projectId: null,
  clientId: null,
};

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createCalendarEventClient", () => {
  it("sends the correct POST URL/method/body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, item: VALID_ITEM }));
    vi.stubGlobal("fetch", fetchMock);

    await createCalendarEventClient(CREATE_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/calendar/events");
    expect(options).toMatchObject({ method: "POST" });
    expect(JSON.parse(options.body)).toEqual(CREATE_INPUT);
  });

  it("returns a validated ManualCalendarEventItem on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, item: VALID_ITEM }))
    );

    const result = await createCalendarEventClient(CREATE_INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.id).toBe(VALID_ITEM_ID);
      expect(result.item.title).toBe("Client call");
    }
  });

  it("surfaces the server's own error message on a 400 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Linked project not found." }, { ok: false, status: 400 }))
    );

    const result = await createCalendarEventClient(CREATE_INPUT);

    expect(result).toEqual({ ok: false, error: "Linked project not found." });
  });

  it("uses a generic message, never the raw body, on a 500 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: "TypeError: cannot read property 'x' of undefined at ..." }, { ok: false, status: 500 })
      )
    );

    const result = await createCalendarEventClient(CREATE_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain("TypeError");
    }
  });

  it("returns a network error when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await createCalendarEventClient(CREATE_INPUT);

    expect(result.ok).toBe(false);
  });

  it("returns an error when the response body is not valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(throwingJsonResponse()));

    const result = await createCalendarEventClient(CREATE_INPUT);

    expect(result.ok).toBe(false);
  });

  it("returns an error when success is true but item is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, item: { kind: "manual_event" } }))
    );

    const result = await createCalendarEventClient(CREATE_INPUT);

    expect(result.ok).toBe(false);
  });
});

describe("updateCalendarEventClient", () => {
  const PATCH_INPUT: UpdateCalendarEventInput = { title: "Updated title" };

  it("sends the correct PATCH URL/method/body for a valid id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, item: VALID_ITEM }));
    vi.stubGlobal("fetch", fetchMock);

    await updateCalendarEventClient(VALID_ITEM_ID, PATCH_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`/api/calendar/events/${VALID_UUID}`);
    expect(options).toMatchObject({ method: "PATCH" });
    expect(JSON.parse(options.body)).toEqual(PATCH_INPUT);
  });

  it("returns a validated ManualCalendarEventItem on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, item: VALID_ITEM }))
    );

    const result = await updateCalendarEventClient(VALID_ITEM_ID, PATCH_INPUT);

    expect(result.ok).toBe(true);
  });

  it("never calls fetch for a malformed id (project: prefix)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateCalendarEventClient(`project:${VALID_UUID}`, PATCH_INPUT);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it("never calls fetch for a malformed id (garbage string)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateCalendarEventClient("not-an-id", PATCH_INPUT);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
});

describe("deleteCalendarEventClient", () => {
  it("sends the correct DELETE URL/method for a valid id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, alreadyDeleted: false }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteCalendarEventClient(VALID_ITEM_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`/api/calendar/events/${VALID_UUID}`);
    expect(options).toMatchObject({ method: "DELETE" });
  });

  it("treats { alreadyDeleted: false } as success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, alreadyDeleted: false }))
    );

    const result = await deleteCalendarEventClient(VALID_ITEM_ID);

    expect(result).toEqual({ ok: true, alreadyDeleted: false });
  });

  it("treats { alreadyDeleted: true } as an equally successful outcome", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, alreadyDeleted: true }))
    );

    const result = await deleteCalendarEventClient(VALID_ITEM_ID);

    expect(result).toEqual({ ok: true, alreadyDeleted: true });
  });

  it("never calls fetch for a malformed id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteCalendarEventClient("event:not-a-uuid");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it("surfaces the server's own error message on a 404 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Not found." }, { ok: false, status: 404 }))
    );

    const result = await deleteCalendarEventClient(VALID_ITEM_ID);

    expect(result).toEqual({ ok: false, error: "Not found." });
  });

  it("returns a network error when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await deleteCalendarEventClient(VALID_ITEM_ID);

    expect(result.ok).toBe(false);
  });
});
