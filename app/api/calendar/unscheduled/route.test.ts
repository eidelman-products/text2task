import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();

let tableResponse: { data: Record<string, unknown>[] | null; error?: unknown } = { data: [] };

const tableClient = {
  from() {
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
      order() {
        return chain;
      },
      limit() {
        return Promise.resolve({ data: tableResponse.data, error: tableResponse.error ?? null });
      },
    };

    return { select: () => chain };
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock }, ...tableClient }),
}));

const { GET } = await import("./route");

beforeEach(() => {
  getUserMock.mockReset();
  tableResponse = { data: [] };
});

describe("GET /api/calendar/unscheduled", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns the normalized unscheduled project list for an authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    tableResponse = {
      data: [
        {
          id: "p1",
          title: "New client intake",
          status: "New",
          priority: null,
          client_name: null,
          created_at: "2027-01-01T00:00:00.000Z",
        },
      ],
    };

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.items).toEqual([
      {
        id: "p1",
        title: "New client intake",
        clientName: null,
        status: "New",
        priority: null,
        createdAt: "2027-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("propagates a downstream loader failure with its status code", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    tableResponse = { data: null, error: { message: "db down" } };

    const response = await GET();

    expect(response.status).toBe(500);
  });
});
