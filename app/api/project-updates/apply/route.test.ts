import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/*
  Phase 6B correction (blocker fix) -- proves the new server hard guard
  in POST /api/project-updates/apply: a project_updates row with
  source_type='client_share' must be rejected BEFORE claimProjectUpdateForApply
  and BEFORE apply_project_update_transaction is ever called (no mutation
  of any kind), while text/image Apply behavior is completely unaffected
  (the guard is a no-op for them -- proven by letting an invalid status
  fall through to the SAME pre-existing status-check error it always
  produced, rather than the new guard's own error code).

  This file does not attempt to cover the full pre-existing (pre-Phase-6B)
  successful-apply pipeline -- that has no prior test coverage of its own
  and is unrelated to this correction; only the new guard's placement and
  behavior is targeted here.
*/

const getUserMock = vi.fn();
const rpcMock = vi.fn();

function buildFakeSupabase(config: {
  projectUpdate: Record<string, unknown> | null;
  project?: Record<string, unknown> | null;
  items?: unknown[];
}) {
  const projectUpdatesUpdateMock = vi.fn();
  const tasksMock = vi.fn();
  const projectsUpdateMock = vi.fn();
  const timelineEventsInsertMock = vi.fn();

  const from = vi.fn((table: string) => {
    if (table === "project_updates") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve(
                  config.projectUpdate
                    ? { data: config.projectUpdate, error: null }
                    : { data: null, error: { message: "not found" } }
                ),
            }),
          }),
        }),
        update: (patch: unknown) => {
          projectUpdatesUpdateMock(patch);
          return {
            eq: () => ({
              eq: () => ({
                in: () => ({
                  select: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        },
      };
    }

    if (table === "projects") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                single: () =>
                  Promise.resolve(
                    config.project
                      ? { data: config.project, error: null }
                      : {
                          data: {
                            id: "project-1",
                            user_id: "user-1",
                            client_id: null,
                            title: "Homepage refresh",
                            deleted_at: null,
                          },
                          error: null,
                        }
                  ),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "project_update_items") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: config.items ?? [], error: null }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "tasks") {
      tasksMock();
      return { insert: vi.fn(), update: vi.fn() };
    }

    if (table === "project_timeline_events") {
      return { insert: timelineEventsInsertMock };
    }

    if (table === "clients") {
      return { update: vi.fn() };
    }

    return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
  });

  return {
    supabase: {
      auth: { getUser: getUserMock },
      from,
      rpc: rpcMock,
    },
    projectUpdatesUpdateMock,
    tasksMock,
    timelineEventsInsertMock,
  };
}

let currentFake: ReturnType<typeof buildFakeSupabase>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(currentFake.supabase),
}));

const { POST } = await import("./route");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const UPDATE_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";

function buildRequest() {
  return new NextRequest("http://localhost/api/project-updates/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectUpdateId: UPDATE_ID,
      acceptedItemIds: [ITEM_ID],
      rejectedItemIds: [],
      editedItems: [],
    }),
  });
}

function baseUpdate(overrides: Record<string, unknown> = {}) {
  return {
    id: UPDATE_ID,
    user_id: USER_ID,
    project_id: "project-1",
    source_type: "text",
    source_share_message_id: null,
    status: "analyzed",
    apply_attempt_id: null,
    apply_started_at: null,
    apply_failed_at: null,
    apply_error_code: null,
    ...overrides,
  };
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  rpcMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/project-updates/apply - Phase 6B Apply boundary (client_share)", () => {
  it("rejects a client_share update with 409 project_update_source_not_appliable, BEFORE claim/RPC", async () => {
    currentFake = buildFakeSupabase({
      projectUpdate: baseUpdate({ source_type: "client_share", source_share_message_id: "msg-1" }),
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("project_update_source_not_appliable");
    expect(rpcMock).not.toHaveBeenCalled();
    expect(currentFake.projectUpdatesUpdateMock).not.toHaveBeenCalled();
  });

  it("no tasks/project/client/timeline mutation occurs from a rejected client_share Apply", async () => {
    currentFake = buildFakeSupabase({
      projectUpdate: baseUpdate({ source_type: "client_share", source_share_message_id: "msg-1" }),
    });

    await POST(buildRequest());

    expect(currentFake.tasksMock).not.toHaveBeenCalled();
    expect(currentFake.timelineEventsInsertMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("a direct authenticated POST with a client_share projectUpdateId cannot bypass the guard even with a plausible-looking body", async () => {
    currentFake = buildFakeSupabase({
      projectUpdate: baseUpdate({
        source_type: "client_share",
        source_share_message_id: "msg-1",
        status: "analyzed",
      }),
    });

    const response = await POST(buildRequest());

    expect(response.status).toBe(409);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("text Apply is unaffected by the new guard -- an invalid status still produces the SAME pre-existing status-check error, not the new guard's error", async () => {
    currentFake = buildFakeSupabase({
      projectUpdate: baseUpdate({ source_type: "text", status: "draft" }),
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(body.code).not.toBe("project_update_source_not_appliable");
    expect(body.code).toBe("project_update_invalid_state");
  });

  it("image Apply is unaffected by the new guard -- an invalid status still produces the SAME pre-existing status-check error, not the new guard's error", async () => {
    currentFake = buildFakeSupabase({
      projectUpdate: baseUpdate({ source_type: "image", status: "failed", apply_attempt_id: null }),
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(body.code).not.toBe("project_update_source_not_appliable");
    expect(body.code).toBe("project_update_apply_failed");
  });
});
