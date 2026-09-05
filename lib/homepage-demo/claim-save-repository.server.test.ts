import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

const {
  claimHomepageDemoProject,
  loadHomepageDemoClaimSaveSource,
} = await import("./claim-save-repository.server");

const CLAIM_ID = "55555555-5555-4555-8555-555555555555";
const TRIAL_ID = "66666666-6666-4666-8666-666666666666";
const DRAFT_ID = "77777777-7777-4777-8777-777777777777";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const CLAIM_TOKEN_HASH = "a".repeat(64);
const CONTINUATION_TOKEN_HASH = "d".repeat(64);
const PUBLIC_TOKEN_HASH = "b".repeat(64);
const SESSION_TOKEN_HASH = "c".repeat(64);
const REQUEST_HASH = "e".repeat(64);

function future(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function past(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function buildClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: CLAIM_ID,
    trial_id: TRIAL_ID,
    draft_id: DRAFT_ID,
    claim_token_hash: CLAIM_TOKEN_HASH,
    public_token_hash: PUBLIC_TOKEN_HASH,
    session_token_hash: SESSION_TOKEN_HASH,
    status: "pending",
    expires_at: future(10),
    auth_continuation_token_hash: null,
    auth_continuation_started_at: null,
    auth_continuation_expires_at: null,
    auth_continuation_consumed_at: null,
    ...overrides,
  };
}

function buildTrial(overrides: Record<string, unknown> = {}) {
  return {
    id: TRIAL_ID,
    public_token_hash: PUBLIC_TOKEN_HASH,
    session_token_hash: SESSION_TOKEN_HASH,
    input_type: "text",
    status: "review_ready",
    risk_state: "allowed",
    expires_at: future(10),
    claimed_by_user_id: null,
    claimed_at: null,
    ...overrides,
  };
}

function buildDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: DRAFT_ID,
    trial_id: TRIAL_ID,
    status: "ready",
    schema_version: "homepage-demo-draft-v1",
    engine_version: "text-extraction-v1",
    normalized_result: {
      tasks: [
        {
          source: "text",
          client_name: "Acme",
          contact_name: "",
          client_phone: "",
          client_email: "",
          client_notes: "",
          task_title: "Prepare launch checklist",
          amount: "",
          deadline_text: "",
          priority: "medium",
          raw_input: "Please prepare the launch checklist.",
        },
      ],
    },
    edited_result: null,
    expires_at: future(10),
    claimed_by_user_id: null,
    claimed_at: null,
    ...overrides,
  };
}

function mockTables({
  claim,
  trial = buildTrial(),
  draft = buildDraft(),
}: {
  claim: Record<string, unknown> | null;
  trial?: Record<string, unknown> | null;
  draft?: Record<string, unknown> | null;
}) {
  fromMock.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          limit: () =>
            Promise.resolve({
              data:
                table === "homepage_demo_drafts"
                  ? draft === null
                    ? []
                    : [draft]
                  : [],
              error: null,
            }),
        }),
        limit: () =>
          Promise.resolve({
            data:
              table === "homepage_demo_claims"
                ? claim === null
                  ? []
                  : [claim]
                : table === "homepage_demo_trials"
                  ? trial === null
                    ? []
                    : [trial]
                  : [],
            error: null,
          }),
      }),
    }),
  }));
}

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("loadHomepageDemoClaimSaveSource - pending-auth continuation", () => {
  it("loads the draft when only a valid continuation token remains after original expiries", async () => {
    mockTables({
      claim: buildClaim({
        expires_at: past(20),
        auth_continuation_token_hash: CONTINUATION_TOKEN_HASH,
        auth_continuation_started_at: past(25),
        auth_continuation_expires_at: future(30),
      }),
      trial: buildTrial({ expires_at: past(20) }),
      draft: buildDraft({ expires_at: past(20) }),
    });

    const source = await loadHomepageDemoClaimSaveSource({
      claimTokenHash: null,
      continuationTokenHash: CONTINUATION_TOKEN_HASH,
    });

    expect(source.kind).toBe("pending");
    expect(source).toMatchObject({ claimId: CLAIM_ID });
  });

  it("does not resurrect an expired claim when no valid continuation token is present", async () => {
    mockTables({
      claim: buildClaim({ expires_at: past(20) }),
    });

    const source = await loadHomepageDemoClaimSaveSource({
      claimTokenHash: CLAIM_TOKEN_HASH,
    });

    expect(source.kind).toBe("rpc_replay");
  });
});

describe("claimHomepageDemoProject - v2 RPC contract", () => {
  it("passes both authority hashes to claim_homepage_demo_project_v2", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          outcome: "saved",
          saved_project_id: "99999999-9999-4999-8999-999999999999",
          created: true,
        },
      ],
      error: null,
    });

    await claimHomepageDemoProject({
      claimTokenHash: CLAIM_TOKEN_HASH,
      continuationTokenHash: CONTINUATION_TOKEN_HASH,
      authenticatedUserId: USER_ID,
      requestHash: REQUEST_HASH,
      importGroups: [{ title: "Demo", tasks: [] }],
      duplicateCheckPassed: true,
    });

    expect(rpcMock).toHaveBeenCalledWith("claim_homepage_demo_project_v2", {
      p_claim_token_hash: CLAIM_TOKEN_HASH,
      p_auth_continuation_token_hash: CONTINUATION_TOKEN_HASH,
      p_authenticated_user_id: USER_ID,
      p_request_hash: REQUEST_HASH,
      p_import_groups: [{ title: "Demo", tasks: [] }],
      p_duplicate_check_passed: true,
    });
  });
});
