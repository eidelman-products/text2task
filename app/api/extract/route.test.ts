import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
const createServerClientMock = vi.fn();
const extractProjectFromTextMock = vi.fn();
const scheduleExtractAnalyticsMock = vi.fn();
const fromMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [],
      set: vi.fn(),
    }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

vi.mock("@/lib/extraction/text-extraction.server", () => ({
  TextExtractionError: class TextExtractionError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  extractProjectFromText: (...args: unknown[]) =>
    extractProjectFromTextMock(...args),
}));

vi.mock("@/lib/analytics/seo-funnel-events.server", () => ({
  scheduleSuccessfulExtractionActivityAndFirstExtractAnalytics: (
    ...args: unknown[]
  ) => scheduleExtractAnalyticsMock(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

const { POST } = await import("./route");

const USER_ID = "11111111-1111-4111-8111-111111111111";

function buildRequest(body: unknown = { input: "Build the proposal" }) {
  return new NextRequest("http://localhost/api/extract", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function queueUserProfile(successfulExtractCount: number) {
  const maybeSingleMock = vi.fn().mockResolvedValue({
    data: {
      id: USER_ID,
      email: "user@example.com",
      plan: "free",
      extract_count: 3,
      subscription_status: "free",
      successful_extract_count: successfulExtractCount,
    },
    error: null,
  });
  const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
  const updateEqMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

  fromMock.mockReturnValue({
    select: selectMock,
    update: updateMock,
  });
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  getUserMock
    .mockReset()
    .mockResolvedValue({ data: { user: { id: USER_ID, email: "user@example.com" } }, error: null });
  createServerClientMock.mockReset().mockReturnValue({
    auth: { getUser: getUserMock },
  });
  extractProjectFromTextMock.mockReset().mockResolvedValue({
    tasks: [{ title: "Task" }],
    project: { title: "Project" },
  });
  scheduleExtractAnalyticsMock.mockReset();
  fromMock.mockReset();
  queueUserProfile(0);
});

describe("POST /api/extract - SEO funnel measurement", () => {
  it("schedules first_extract_created analytics only after a successful extraction response path", async () => {
    const request = buildRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(scheduleExtractAnalyticsMock).toHaveBeenCalledWith({
      request,
      userId: USER_ID,
      successfulExtractCountBefore: 0,
      source: "text",
    });
  });

  it("passes the persisted successful_extract_count so repeat extracts do not become first_extract_created", async () => {
    queueUserProfile(2);

    const request = buildRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(scheduleExtractAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        successfulExtractCountBefore: 2,
      })
    );
  });

  it("does not schedule analytics for unauthorized or invalid extraction requests", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

    const unauthorized = await POST(buildRequest());
    const invalid = await POST(buildRequest({ input: "" }));

    expect(unauthorized.status).toBe(401);
    expect(invalid.status).toBe(400);
    expect(scheduleExtractAnalyticsMock).not.toHaveBeenCalled();
  });

  it("does not schedule analytics when extraction fails", async () => {
    extractProjectFromTextMock.mockRejectedValueOnce(new Error("model failed"));

    const response = await POST(buildRequest());

    expect(response.status).toBe(500);
    expect(scheduleExtractAnalyticsMock).not.toHaveBeenCalled();
  });

  it("keeps a successful text extraction successful when analytics scheduling fails", async () => {
    scheduleExtractAnalyticsMock.mockImplementationOnce(() => {
      throw new Error("analytics unavailable");
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
