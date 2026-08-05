import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  getShareLinkManagementState,
  listShareLinkSummaries,
} from "./share-links-repository.server";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_2 = "22222222-2222-4222-8222-222222222222";
const VALID_PUBLIC_ID = "abcdefgh12345678";
const VALID_TIMESTAMP = "2026-08-05T00:00:00Z";

function validManagedLink() {
  return {
    id: VALID_UUID,
    publicId: VALID_PUBLIC_ID,
    state: "active" as const,
    expiresAt: null,
    hasPin: false,
    commentsEnabled: true,
    clientFacingSubtitle: null,
    contentDirection: "auto" as const,
    configurationVersion: 1,
    createdAt: VALID_TIMESTAMP,
    activatedAt: null,
    disabledAt: null,
    rotatedAt: null,
    lastViewedAt: null,
    viewCount: 0,
  };
}

function validManagementStateData() {
  return {
    link: validManagedLink(),
    mappedTaskIds: ["1", "42"],
    mappedResourceIds: [VALID_UUID],
    currentUpdate: null,
  };
}

function validSummaryEntry(projectId: string) {
  return {
    projectId,
    linkId: null,
    state: null,
    expiresAt: null,
    hasPin: false,
    createdAt: null,
    lastViewedAt: null,
    viewCount: 0,
    taskCount: 0,
    resourceCount: 0,
    unreadCount: null,
  };
}

function buildFakeClient(rpcImpl: ReturnType<typeof vi.fn>) {
  return { rpc: rpcImpl };
}

describe("getShareLinkManagementState", () => {
  it("calls exactly the get_share_link_management_state RPC with p_project_id", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validManagementStateData(),
      error: null,
    });
    const client = buildFakeClient(rpc);

    await getShareLinkManagementState(client, VALID_UUID);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_share_link_management_state", {
      p_project_id: VALID_UUID,
    });
  });

  it("returns parsed success data on a valid RPC response", async () => {
    const payload = validManagementStateData();
    const rpc = vi.fn().mockResolvedValue({ data: payload, error: null });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: true, data: payload });
  });

  it("canonicalizes an uppercase projectId to lowercase before calling the RPC, even when the caller did not", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: validManagementStateData(),
      error: null,
    });
    const client = buildFakeClient(rpc);

    await getShareLinkManagementState(client, VALID_UUID.toUpperCase());

    expect(rpc).toHaveBeenCalledWith("get_share_link_management_state", {
      p_project_id: VALID_UUID,
    });
  });

  it("maps {code:P0001, message:UNAUTHORIZED} to a typed UNAUTHORIZED error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "UNAUTHORIZED" },
    });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNAUTHORIZED" } });
  });

  it("maps {code:P0001, message:PROJECT_NOT_FOUND} to a typed PROJECT_NOT_FOUND error, never the raw Postgres error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "PROJECT_NOT_FOUND", code: "P0001", details: "raw" },
    });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "PROJECT_NOT_FOUND" } });
    expect(result).not.toHaveProperty("error.details");
    expect(result).not.toHaveProperty("error.hint");
  });

  it("does not use substring matching -- a message that merely contains PROJECT_NOT_FOUND is not matched", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "context: PROJECT_NOT_FOUND happened" },
    });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("requires the exact code P0001 -- the same message with a different code is UNEXPECTED", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42501", message: "UNAUTHORIZED" },
    });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("maps an unrecognized RPC error to a typed UNEXPECTED error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "SOMETHING_ELSE" },
    });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when the RPC returns malformed data that does not match the contract", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { link: { id: VALID_UUID, pinHash: "leak-should-not-parse" } },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when the RPC returns null with no error", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = buildFakeClient(rpc);

    const result = await getShareLinkManagementState(client, VALID_UUID);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });
});

describe("listShareLinkSummaries", () => {
  it("calls exactly the list_share_link_summaries RPC with p_project_ids", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
      error: null,
    });
    const client = buildFakeClient(rpc);

    await listShareLinkSummaries(client, [VALID_UUID]);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("list_share_link_summaries", {
      p_project_ids: [VALID_UUID],
    });
  });

  it("returns parsed success data on a valid RPC response covering exactly the requested projects", async () => {
    const payload = {
      [VALID_UUID]: validSummaryEntry(VALID_UUID),
      [VALID_UUID_2]: validSummaryEntry(VALID_UUID_2),
    };
    const rpc = vi.fn().mockResolvedValue({ data: payload, error: null });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID, VALID_UUID_2]);

    expect(result).toEqual({ ok: true, data: payload });
  });

  it("canonicalizes every projectId to lowercase before calling the RPC, even when the caller did not", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
      error: null,
    });
    const client = buildFakeClient(rpc);

    await listShareLinkSummaries(client, [VALID_UUID.toUpperCase()]);

    expect(rpc).toHaveBeenCalledWith("list_share_link_summaries", {
      p_project_ids: [VALID_UUID],
    });
  });

  it("succeeds the exact-set comparison when the caller supplied uppercase but Postgres returns lowercase keys", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID.toUpperCase()]);

    expect(result).toEqual({
      ok: true,
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
    });
  });

  it("collapses a lowercase and uppercase spelling of the same uuid to one requested id for the exact-set comparison", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [
      VALID_UUID.toUpperCase(),
      VALID_UUID,
    ]);

    expect(result).toEqual({
      ok: true,
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
    });
  });

  it("maps {code:P0001, message:UNAUTHORIZED} to a typed UNAUTHORIZED error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "UNAUTHORIZED" },
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID]);

    expect(result).toEqual({ ok: false, error: { code: "UNAUTHORIZED" } });
  });

  it("maps {code:P0001, message:PROJECT_NOT_FOUND} to a typed PROJECT_NOT_FOUND error, never the raw Postgres error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "PROJECT_NOT_FOUND", code: "P0001", hint: "raw" },
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID]);

    expect(result).toEqual({ ok: false, error: { code: "PROJECT_NOT_FOUND" } });
    expect(result).not.toHaveProperty("error.hint");
  });

  it("fails closed with UNEXPECTED when the RPC returns malformed data", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: { unreadCount: 5 } },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID]);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when a requested project is missing from the result", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID, VALID_UUID_2]);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when an unrequested project appears in the result", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        [VALID_UUID]: validSummaryEntry(VALID_UUID),
        [VALID_UUID_2]: validSummaryEntry(VALID_UUID_2),
      },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID]);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when a non-empty request returns an empty {} object", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID]);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed with UNEXPECTED when a record key does not equal its entry's projectId", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID_2) },
      error: null,
    });
    const client = buildFakeClient(rpc);

    const result = await listShareLinkSummaries(client, [VALID_UUID]);

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });
});

describe("share-links-repository.server.ts source constraints", () => {
  const source = readFileSync(
    path.join(__dirname, "share-links-repository.server.ts"),
    "utf8"
  );

  it("marks the module server-only", () => {
    expect(source).toContain('import "server-only"');
  });

  it("never imports or references the service-role admin client", () => {
    expect(source).not.toContain("supabaseAdmin");
    expect(source).not.toContain("lib/supabase/admin");
  });

  it("never performs a direct table query (.from(...))", () => {
    expect(source).not.toMatch(/\.from\(/);
  });

  it("calls only the two sanctioned RPCs", () => {
    const rpcCalls = [...source.matchAll(/\.rpc\(\s*([A-Z0-9_]+|"[a-z_]+")/g)].map(
      (m) => m[1]
    );
    expect(rpcCalls).toHaveLength(2);
  });

  it("centralizes the RPC names as named constants rather than inline string literals at call sites", () => {
    expect(source).toContain(
      'const GET_SHARE_LINK_MANAGEMENT_STATE_RPC = "get_share_link_management_state";'
    );
    expect(source).toContain(
      'const LIST_SHARE_LINK_SUMMARIES_RPC = "list_share_link_summaries";'
    );
  });

  it("maps RPC errors by exact code and message, never by substring matching", () => {
    expect(source).not.toMatch(/message\.includes\(/);
    expect(source).not.toMatch(/message\.startsWith\(/);
    expect(source).not.toMatch(/message\.endsWith\(/);
    expect(source).toContain('error.code === RPC_ERROR_CODE && error.message === "UNAUTHORIZED"');
    expect(source).toContain(
      'error.code === RPC_ERROR_CODE && error.message === "PROJECT_NOT_FOUND"'
    );
  });
});
