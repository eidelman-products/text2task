import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: (payload: unknown) => insertMock(table, payload),
    }),
  },
}));

const {
  validateShareMessageSubmission,
  insertPublicShareMessage,
  SHARE_MESSAGE_BODY_MAX_CODEPOINTS,
  SHARE_MESSAGE_AUTHOR_NAME_MAX_CODEPOINTS,
} = await import("./share-public-message.server");

beforeEach(() => {
  insertMock.mockReset().mockResolvedValue({ error: null });
});

function request(body: string, authorDisplayName?: string) {
  return { body, authorDisplayName };
}

describe("validateShareMessageSubmission - body", () => {
  it("accepts ordinary text", () => {
    const result = validateShareMessageSubmission(request("Looks great, thanks!"));
    expect(result).toEqual({ ok: true, data: { body: "Looks great, thanks!", authorDisplayName: null } });
  });

  it("rejects an empty body", () => {
    expect(validateShareMessageSubmission(request(""))).toEqual({
      ok: false,
      code: "SHARE_MESSAGE_BODY_EMPTY",
    });
  });

  it("rejects a whitespace-only body", () => {
    expect(validateShareMessageSubmission(request("   \n\t  "))).toEqual({
      ok: false,
      code: "SHARE_MESSAGE_BODY_EMPTY",
    });
  });

  it("accepts a body at exactly the 4000-codepoint limit", () => {
    const body = "a".repeat(SHARE_MESSAGE_BODY_MAX_CODEPOINTS);
    const result = validateShareMessageSubmission(request(body));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.body).toHaveLength(SHARE_MESSAGE_BODY_MAX_CODEPOINTS);
  });

  it("rejects a body one codepoint over the limit", () => {
    const body = "a".repeat(SHARE_MESSAGE_BODY_MAX_CODEPOINTS + 1);
    expect(validateShareMessageSubmission(request(body))).toEqual({
      ok: false,
      code: "SHARE_MESSAGE_BODY_TOO_LONG",
    });
  });

  it("counts Unicode codepoints, not UTF-16 code units -- 4000 astral-plane emoji must be accepted, not rejected as 8000 units", () => {
    // Each "🙂" is a surrogate pair (2 UTF-16 units, 1 codepoint).
    const body = "🙂".repeat(SHARE_MESSAGE_BODY_MAX_CODEPOINTS);
    expect(body.length).toBe(SHARE_MESSAGE_BODY_MAX_CODEPOINTS * 2);

    const result = validateShareMessageSubmission(request(body));
    expect(result.ok).toBe(true);
  });

  it("never truncates a body within the limit -- stores it exactly as submitted (aside from control-char/newline normalization)", () => {
    const body = "Line one\nLine two\nLine three";
    const result = validateShareMessageSubmission(request(body));
    expect(result).toEqual({ ok: true, data: { body, authorDisplayName: null } });
  });

  it("preserves multiline text", () => {
    const body = "First paragraph.\n\nSecond paragraph.";
    const result = validateShareMessageSubmission(request(body));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.body).toBe(body);
  });

  it("normalizes CRLF and lone CR to a plain LF", () => {
    const result = validateShareMessageSubmission(request("one\r\ntwo\rthree"));
    expect(result).toEqual({ ok: true, data: { body: "one\ntwo\nthree", authorDisplayName: null } });
  });

  it("preserves Hebrew (RTL) text untouched", () => {
    const body = "שלום, תודה על העדכון!";
    const result = validateShareMessageSubmission(request(body));
    expect(result).toEqual({ ok: true, data: { body, authorDisplayName: null } });
  });

  it("preserves Arabic (RTL) text untouched", () => {
    const body = "شكرا على التحديث";
    const result = validateShareMessageSubmission(request(body));
    expect(result).toEqual({ ok: true, data: { body, authorDisplayName: null } });
  });

  it("preserves emoji untouched", () => {
    const body = "Great work! 🎉🚀😀";
    const result = validateShareMessageSubmission(request(body));
    expect(result).toEqual({ ok: true, data: { body, authorDisplayName: null } });
  });

  it("treats HTML-like content as plain text -- stored verbatim, never parsed/stripped", () => {
    const body = "<script>alert(1)</script> <b>bold</b>";
    const result = validateShareMessageSubmission(request(body));
    expect(result).toEqual({ ok: true, data: { body, authorDisplayName: null } });
  });

  it("strips C0 control characters other than tab and newline", () => {
    const body = "hello" + String.fromCharCode(0) + String.fromCharCode(1) + String.fromCharCode(7) + "world";
    const result = validateShareMessageSubmission(request(body));
    expect(result).toEqual({ ok: true, data: { body: "helloworld", authorDisplayName: null } });
  });

it("strips DEL (0x7F)", () => {
    const body = "a" + String.fromCharCode(127) + "b";
    const result = validateShareMessageSubmission(request(body));
    expect(result).toEqual({ ok: true, data: { body: "ab", authorDisplayName: null } });
  });

  it("preserves tab characters", () => {
    const result = validateShareMessageSubmission(request("a\tb"));
    expect(result).toEqual({ ok: true, data: { body: "a\tb", authorDisplayName: null } });
  });

  it("a body that is only control characters is rejected as empty", () => {
    const result = validateShareMessageSubmission(request(String.fromCharCode(0) + String.fromCharCode(1) + String.fromCharCode(2)));
    expect(result).toEqual({ ok: false, code: "SHARE_MESSAGE_BODY_EMPTY" });
  });
});

describe("validateShareMessageSubmission - authorDisplayName", () => {
  it("omitted name normalizes to null", () => {
    const result = validateShareMessageSubmission(request("hi"));
    expect(result).toEqual({ ok: true, data: { body: "hi", authorDisplayName: null } });
  });

  it("empty-string name normalizes to null", () => {
    const result = validateShareMessageSubmission(request("hi", ""));
    expect(result).toEqual({ ok: true, data: { body: "hi", authorDisplayName: null } });
  });

  it("whitespace-only name normalizes to null", () => {
    const result = validateShareMessageSubmission(request("hi", "   "));
    expect(result).toEqual({ ok: true, data: { body: "hi", authorDisplayName: null } });
  });

  it("trims leading/trailing whitespace from a supplied name", () => {
    const result = validateShareMessageSubmission(request("hi", "  Jane Client  "));
    expect(result).toEqual({ ok: true, data: { body: "hi", authorDisplayName: "Jane Client" } });
  });

  it("accepts a name at exactly the 80-codepoint limit", () => {
    const name = "a".repeat(SHARE_MESSAGE_AUTHOR_NAME_MAX_CODEPOINTS);
    const result = validateShareMessageSubmission(request("hi", name));
    expect(result).toEqual({ ok: true, data: { body: "hi", authorDisplayName: name } });
  });

  it("rejects a name one codepoint over the limit", () => {
    const name = "a".repeat(SHARE_MESSAGE_AUTHOR_NAME_MAX_CODEPOINTS + 1);
    expect(validateShareMessageSubmission(request("hi", name))).toEqual({
      ok: false,
      code: "SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG",
    });
  });

  it("counts codepoints, not UTF-16 units, for the name limit too", () => {
    const name = "🙂".repeat(SHARE_MESSAGE_AUTHOR_NAME_MAX_CODEPOINTS);
    const result = validateShareMessageSubmission(request("hi", name));
    expect(result.ok).toBe(true);
  });

  it("never treats the name as identity -- it is a bare string, never validated as an email/phone", () => {
    const result = validateShareMessageSubmission(request("hi", "not-an-email-or-phone @@ ##"));
    expect(result.ok).toBe(true);
  });
});

describe("validateShareMessageSubmission - authorDisplayName Phase 7C hardening", () => {
  it("strips Unicode bidi formatting control characters (RLO/LRO/embeddings/isolates), never a normal RTL letter", () => {
    const rlo = String.fromCharCode(0x202e);
    const pdf = String.fromCharCode(0x202c);
    const result = validateShareMessageSubmission(request("hi", `John${rlo}Owner${pdf}`));
    expect(result).toEqual({ ok: true, data: { body: "hi", authorDisplayName: "JohnOwner" } });
  });

  it("preserves genuine Hebrew and Arabic names completely untouched", () => {
    const hebrew = validateShareMessageSubmission(request("hi", "משה"));
    expect(hebrew).toEqual({ ok: true, data: { body: "hi", authorDisplayName: "משה" } });

    const arabic = validateShareMessageSubmission(request("hi", "محمد"));
    expect(arabic).toEqual({ ok: true, data: { body: "hi", authorDisplayName: "محمد" } });
  });

  it("collapses an embedded newline/tab in a name to a single space, rather than preserving a multi-line label", () => {
    const result = validateShareMessageSubmission(request("hi", "John\nOwner"));
    expect(result).toEqual({ ok: true, data: { body: "hi", authorDisplayName: "John Owner" } });

    const withTab = validateShareMessageSubmission(request("hi", "John\tOwner"));
    expect(withTab).toEqual({ ok: true, data: { body: "hi", authorDisplayName: "John Owner" } });
  });

  it("does not collapse ordinary internal whitespace in a normal multi-word name", () => {
    const result = validateShareMessageSubmission(request("hi", "Jane Client"));
    expect(result).toEqual({ ok: true, data: { body: "hi", authorDisplayName: "Jane Client" } });
  });

  it("does not damage or reject a name that is entirely emoji/astral-plane content", () => {
    const result = validateShareMessageSubmission(request("hi", "🙂🎉"));
    expect(result).toEqual({ ok: true, data: { body: "hi", authorDisplayName: "🙂🎉" } });
  });
});

describe("insertPublicShareMessage - trusted server-side write", () => {
  const INPUT = {
    shareLinkId: "11111111-1111-4111-8111-111111111111",
    projectId: "22222222-2222-4222-8222-222222222222",
    userId: "33333333-3333-4333-8333-333333333333",
    body: "Hello",
    authorDisplayName: "Jane",
  };

  it("inserts exactly the 8 service_role-grantable columns, with server-controlled security fields hardcoded", async () => {
    const ok = await insertPublicShareMessage(INPUT);

    expect(ok).toBe(true);
    expect(insertMock).toHaveBeenCalledWith("share_messages", {
      user_id: INPUT.userId,
      share_link_id: INPUT.shareLinkId,
      project_id: INPUT.projectId,
      author_type: "client",
      author_display_name: "Jane",
      body: "Hello",
      parent_id: null,
      is_visible_to_client: true,
    });
  });

  it("never includes status, reviewed_at, resolved_at, id, created_at, or updated_at in the insert payload", async () => {
    await insertPublicShareMessage(INPUT);

    const [, payload] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    for (const forbiddenKey of ["status", "reviewed_at", "resolved_at", "id", "created_at", "updated_at"]) {
      expect(Object.prototype.hasOwnProperty.call(payload, forbiddenKey)).toBe(false);
    }
  });

  it("hardcodes author_type to 'client' regardless of any caller-shaped input", async () => {
    await insertPublicShareMessage(INPUT);
    const [, payload] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.author_type).toBe("client");
  });

  it("hardcodes parent_id to null (top-level messages only in this slice)", async () => {
    await insertPublicShareMessage(INPUT);
    const [, payload] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.parent_id).toBeNull();
  });

  it("hardcodes is_visible_to_client to true", async () => {
    await insertPublicShareMessage(INPUT);
    const [, payload] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.is_visible_to_client).toBe(true);
  });

  it("passes a null authorDisplayName through unchanged", async () => {
    await insertPublicShareMessage({ ...INPUT, authorDisplayName: null });
    const [, payload] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.author_display_name).toBeNull();
  });

  it("returns false (never throws) on an insert error", async () => {
    insertMock.mockResolvedValue({ error: { code: "23514", message: "check violation" } });
    await expect(insertPublicShareMessage(INPUT)).resolves.toBe(false);
  });
});

describe("Phase 6 boundary (hard test)", () => {
  const source = readFileSync(join(__dirname, "share-public-message.server.ts"), "utf8");
  const executable = stripJsComments(source);

  function stripJsComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  }

  it("never references share_message_conversions in executable code", () => {
    expect(executable).not.toContain("share_message_conversions");
  });

  it("never references project_updates in executable code", () => {
    expect(executable).not.toContain("project_updates");
  });

  it("never references project_timeline_events in executable code", () => {
    expect(executable).not.toContain("project_timeline_events");
  });

  it("never references a tasks/subtasks table in executable code", () => {
    expect(executable).not.toMatch(/\.from\(\s*["'`]tasks["'`]/);
    expect(executable).not.toMatch(/\.from\(\s*["'`]subtasks["'`]/);
  });

  it("never writes status = 'converted' or any status at all -- status is entirely absent from the insert payload", () => {
    expect(executable).not.toContain("converted");
  });

  it("the insert call only ever targets share_messages", () => {
    const fromCalls = [...executable.matchAll(/\.from\(\s*["'`]([a-zA-Z_]+)["'`]/g)].map((m) => m[1]);
    expect(new Set(fromCalls)).toEqual(new Set(["share_messages"]));
  });
});
