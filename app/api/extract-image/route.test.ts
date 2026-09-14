import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server"
  );

  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      void callback();
    },
  };
});

const getUserMock = vi.fn();
const createServerClientMock = vi.fn();
const extractProjectFromImageMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();
const analyticsInsertMock = vi.fn();

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

vi.mock("@/lib/extraction/image-extraction.server", () => ({
  ImageExtractionError: class ImageExtractionError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  extractProjectFromImage: (...args: unknown[]) =>
    extractProjectFromImageMock(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

const { POST } = await import("./route");

const USER_ID = "11111111-1111-4111-8111-111111111111";

function buildRequest() {
  const formData = new FormData();
  formData.set(
    "image",
    new File(["fake-image"], "work-order.png", { type: "image/png" })
  );

  return new NextRequest("http://localhost/api/extract-image", {
    method: "POST",
    body: formData,
  });
}

function queueUserProfile(successfulExtractCount: number) {
  fromMock.mockImplementation((table: string) => {
    if (table === "analytics_events") {
      return {
        insert: (row: Record<string, unknown>) => analyticsInsertMock(row),
      };
    }

    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({
              data: {
                id: USER_ID,
                email: "user@example.com",
                plan: "free",
                extract_count: 3,
                subscription_status: "free",
                successful_extract_count: successfulExtractCount,
              },
              error: null,
            })
          ),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    };
  });
}

async function flushScheduledAnalytics() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  getUserMock
    .mockReset()
    .mockResolvedValue({ data: { user: { id: USER_ID, email: "user@example.com" } }, error: null });
  createServerClientMock.mockReset().mockReturnValue({
    auth: { getUser: getUserMock },
  });
  extractProjectFromImageMock.mockReset().mockResolvedValue({
    tasks: [{ title: "Task" }],
    raw_input: "extracted text",
  });
  fromMock.mockReset();
  rpcMock.mockReset().mockResolvedValue({ data: null, error: null });
  analyticsInsertMock.mockReset().mockResolvedValue({ data: null, error: null });
  queueUserProfile(0);
});

describe("POST /api/extract-image - SEO funnel measurement", () => {
  it("emits first_extract_created exactly once after a first successful authenticated image extraction", async () => {
    const response = await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("record_successful_extraction", {
      p_user_id: USER_ID,
    });
    expect(analyticsInsertMock).toHaveBeenCalledTimes(1);
    expect(analyticsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "first_extract_created",
        user_id: USER_ID,
        idempotency_key: `first_extract_created:${USER_ID}`,
        metadata: { source: "image" },
      })
    );
  });

  it("does not emit a duplicate first_extract_created after the first successful image extraction", async () => {
    queueUserProfile(2);

    const response = await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(analyticsInsertMock).not.toHaveBeenCalled();
  });

  it("does not emit first_extract_created when image extraction fails", async () => {
    extractProjectFromImageMock.mockRejectedValueOnce(new Error("model failed"));

    const response = await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(response.status).toBe(500);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(analyticsInsertMock).not.toHaveBeenCalled();
  });

  it("keeps a successful image extraction successful when analytics insertion fails", async () => {
    analyticsInsertMock.mockResolvedValueOnce({
      data: null,
      error: { message: "analytics unavailable" },
    });

    const response = await POST(buildRequest());
    const body = await response.json();
    await flushScheduledAnalytics();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(analyticsInsertMock).toHaveBeenCalledTimes(1);
  });
});
