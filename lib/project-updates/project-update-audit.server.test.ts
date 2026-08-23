import { afterEach, describe, expect, it, vi } from "vitest";

/*
  Phase 6B correction (blocker fix) -- targeted coverage for the two
  additions this correction made to project-update-audit.server.ts:
  createProjectUpdateAuditRecord now propagates the raw PostgreSQL error
  code as dbErrorCode (needed for share-message-conversion.server.ts's
  structured 23505 handling, Correction 3), and the new
  markProjectUpdateAsFailed best-effort transition (Correction 4/6) used
  to move a claimed client_share reservation back to 'failed' after a
  handled analysis failure.
*/

const getUserMock = vi.fn();

function buildFakeSupabase(config: {
  insert?: { data: unknown; error: { message: string; code?: string } | null };
  update?: { data: unknown; error: { message: string } | null };
}) {
  return {
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table !== "project_updates") {
        throw new Error(`unexpected table: ${table}`);
      }
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve(config.insert ?? { data: null, error: { message: "unset" } }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve(config.update ?? { data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      };
    },
  };
}

let fakeSupabase: ReturnType<typeof buildFakeSupabase>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(fakeSupabase),
}));

const { createProjectUpdateAuditRecord, markProjectUpdateAsFailed } = await import(
  "./project-update-audit.server"
);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const UPDATE_ID = "33333333-3333-4333-8333-333333333333";

afterEach(() => {
  vi.clearAllMocks();
});

describe("createProjectUpdateAuditRecord - dbErrorCode propagation (Correction 3)", () => {
  it("propagates the raw PostgreSQL error.code as dbErrorCode on a failed INSERT", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    fakeSupabase = buildFakeSupabase({
      insert: {
        data: null,
        error: {
          message: 'duplicate key value violates unique constraint "project_updates_source_share_message_id_key"',
          code: "23505",
        },
      },
    });

    const result = await createProjectUpdateAuditRecord({
      projectId: PROJECT_ID,
      rawInput: "Please add a footer.",
      sourceType: "client_share",
      sourceShareMessageId: "msg-1",
      status: "draft",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.dbErrorCode).toBe("23505");
      expect(result.error).toContain("project_updates_source_share_message_id_key");
    }
  });

  it("dbErrorCode is null when the DB driver provides no code", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    fakeSupabase = buildFakeSupabase({
      insert: { data: null, error: { message: "connection reset" } },
    });

    const result = await createProjectUpdateAuditRecord({
      projectId: PROJECT_ID,
      rawInput: "Please add a footer.",
      sourceType: "client_share",
      sourceShareMessageId: "msg-1",
      status: "draft",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.dbErrorCode).toBeNull();
  });

  it("a successful INSERT is unaffected -- no dbErrorCode field on an ok result", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    fakeSupabase = buildFakeSupabase({
      insert: { data: { id: UPDATE_ID, status: "draft" }, error: null },
    });

    const result = await createProjectUpdateAuditRecord({
      projectId: PROJECT_ID,
      rawInput: "Please add a footer.",
      sourceType: "client_share",
      sourceShareMessageId: "msg-1",
      status: "draft",
    });

    expect(result).toEqual({ ok: true, data: { id: UPDATE_ID, status: "draft" } });
  });
});

describe("markProjectUpdateAsFailed - best-effort draft-only transition (Correction 4/6)", () => {
  it("transitions a draft reservation to failed", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    fakeSupabase = buildFakeSupabase({
      update: { data: { id: UPDATE_ID, status: "failed" }, error: null },
    });

    const result = await markProjectUpdateAsFailed(UPDATE_ID);

    expect(result).toEqual({ ok: true, data: { id: UPDATE_ID, status: "failed" } });
  });

  it("returns ok:false without throwing when the row is no longer in a draft state (WHERE status='draft' matched zero rows)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    fakeSupabase = buildFakeSupabase({ update: { data: null, error: null } });

    const result = await markProjectUpdateAsFailed(UPDATE_ID);

    expect(result.ok).toBe(false);
  });
});
