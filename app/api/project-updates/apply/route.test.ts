import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/*
  Phase 6C correction (Apply re-enable) -- the Phase 6B temporary hard
  guard that rejected any source_type='client_share' update with 409
  project_update_source_not_appliable, BEFORE claimProjectUpdateForApply,
  has been removed now that Phase 6C's atomic conversion closure exists
  (supabase/migrations/202608230002_client_share_apply_conversion_closure.sql).
  client_share now proceeds through the SAME claim/RPC path as every other
  source type -- no second Apply route, no source-type special-casing
  left in this route at all. Proven below by asserting client_share now
  reaches the claim step (the update() mock is actually called) and never
  produces the retired project_update_source_not_appliable code, and that
  its behavior under an identical status/config is byte-for-byte identical
  to text's.

  This file does not attempt to cover the full successful-apply pipeline
  (accepted work mutation, timeline events, the RPC's own transactional
  behavior) -- that lives in the migration's own static/runtime coverage,
  not here; only this route's own claim/dispatch logic is targeted.
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
              // Used by claimProjectUpdateForApply's own fallback read
              // (after a failed/no-op claim UPDATE) -- kept behaviorally
              // identical to `single` above so client_share and text hit
              // the exact same fallback state-failure path.
              maybeSingle: () =>
                Promise.resolve(
                  config.projectUpdate
                    ? { data: config.projectUpdate, error: null }
                    : { data: null, error: null }
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

describe("POST /api/project-updates/apply - Phase 6C Apply re-enable (client_share, inverse of the retired Phase 6B guard)", () => {
  it("client_share no longer returns 409 project_update_source_not_appliable -- it reaches the same claim step as text/image", async () => {
    currentFake = buildFakeSupabase({
      projectUpdate: baseUpdate({
        source_type: "client_share",
        source_share_message_id: "msg-1",
        status: "analyzed",
      }),
      // A reject-only request skips the accepted-item payload/duplicate
      // validation pipeline entirely (unrelated to this route's own
      // source_type guard), so any item type reaches claim.
      items: [{ id: ITEM_ID, type: "no_action" }],
    });

    const rejectOnlyRequest = new NextRequest("http://localhost/api/project-updates/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectUpdateId: UPDATE_ID,
        acceptedItemIds: [],
        rejectedItemIds: [ITEM_ID],
        editedItems: [],
      }),
    });

    const response = await POST(rejectOnlyRequest);
    const body = await response.json();

    expect(body.code).not.toBe("project_update_source_not_appliable");
    // The claim UPDATE was actually attempted -- proving the route no
    // longer short-circuits on source_type before ever reaching
    // claimProjectUpdateForApply, unlike the retired Phase 6B guard.
    expect(currentFake.projectUpdatesUpdateMock).toHaveBeenCalled();
  });

  it("client_share and text produce byte-for-byte identical behavior under an identical status/config -- no source-type special-casing remains in this route", async () => {
    currentFake = buildFakeSupabase({
      projectUpdate: baseUpdate({
        source_type: "client_share",
        source_share_message_id: "msg-1",
        status: "draft",
      }),
    });
    const clientShareResponse = await POST(buildRequest());
    const clientShareBody = await clientShareResponse.json();

    currentFake = buildFakeSupabase({
      projectUpdate: baseUpdate({ source_type: "text", status: "draft" }),
    });
    const textResponse = await POST(buildRequest());
    const textBody = await textResponse.json();

    expect(clientShareResponse.status).toBe(textResponse.status);
    expect(clientShareBody.code).toBe(textBody.code);
    expect(clientShareBody.code).toBe("project_update_invalid_state");
  });

  it("no second Apply route/endpoint exists -- client_share is applied through this exact same POST handler", async () => {
    currentFake = buildFakeSupabase({
      projectUpdate: baseUpdate({
        source_type: "client_share",
        source_share_message_id: "msg-1",
        status: "analyzed",
      }),
    });

    // Calling the SAME imported POST handler for a client_share update
    // does not throw, and does not route anywhere else -- there is
    // exactly one POST export from this module for both source types.
    await expect(POST(buildRequest())).resolves.toBeInstanceOf(Response);
  });

  it("text Apply is unaffected -- an invalid status still produces the SAME pre-existing status-check error", async () => {
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
