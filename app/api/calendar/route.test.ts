import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock }, ...tableClient }),
}));

let tableResponses: Record<string, { data: Record<string, unknown>[] | null; error?: unknown }> = {};

const tableClient = {
  from(table: string) {
    const response = tableResponses[table] ?? { data: [] };

    const chain = {
      eq() {
        return chain;
      },
      is() {
        return chain;
      },
      or() {
        return chain;
      },
      gte() {
        return chain;
      },
      lte() {
        return Promise.resolve({ data: response.data, error: response.error ?? null });
      },
    };

    return { select: () => chain };
  },
};

const { GET } = await import("./route");

function buildRequest(query: string) {
  return new NextRequest(`http://localhost/api/calendar${query}`);
}

beforeEach(() => {
  getUserMock.mockReset();
  tableResponses = {};
});

describe("GET /api/calendar - authentication", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(buildRequest("?start=2027-01-01&end=2027-01-31"));

    expect(response.status).toBe(401);
  });
});

describe("GET /api/calendar - validation", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("rejects a missing start/end", async () => {
    const response = await GET(buildRequest(""));
    expect(response.status).toBe(400);
  });

  it("rejects an invalid date shape", async () => {
    const response = await GET(buildRequest("?start=2027-1-1&end=2027-01-31"));
    expect(response.status).toBe(400);
  });

  it("rejects a reversed range (end before start)", async () => {
    const response = await GET(buildRequest("?start=2027-02-01&end=2027-01-01"));
    expect(response.status).toBe(400);
  });

  it("rejects an oversized range", async () => {
    const response = await GET(buildRequest("?start=2020-01-01&end=2027-01-01"));
    expect(response.status).toBe(400);
  });
});

describe("GET /api/calendar - success", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns a merged, sorted CalendarItem[] for a valid range", async () => {
    tableResponses = {
      projects: {
        data: [
          {
            id: "p1",
            title: "Website redesign",
            status: "New",
            priority: "Medium",
            deadline_text: null,
            deadline_date: "2027-01-20",
            client_name: null,
          },
        ],
      },
      calendar_events: {
        data: [
          {
            id: "e1",
            title: "Send first draft",
            event_date: "2027-01-05",
            event_time: null,
            notes: null,
            project_id: null,
            client_id: null,
          },
        ],
      },
    };

    const response = await GET(buildRequest("?start=2027-01-01&end=2027-01-31"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.items).toHaveLength(2);
    // Chronological across the range: the Jan 5 event before the Jan 20 deadline.
    expect(body.items[0].date).toBe("2027-01-05");
    expect(body.items[1].date).toBe("2027-01-20");
  });

  it("propagates a downstream loader failure with its status code", async () => {
    tableResponses = {
      projects: { data: null, error: { message: "db down" } },
    };

    const response = await GET(buildRequest("?start=2027-01-01&end=2027-01-31"));

    expect(response.status).toBe(500);
  });
});
