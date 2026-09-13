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

const logAnalyticsEventSafeMock = vi.fn();
const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/analytics/internal-events.server", () => ({
  logAnalyticsEventSafe: (...args: unknown[]) =>
    logAnalyticsEventSafeMock(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

const {
  hasActiveProjectBeforeSave,
  schedulePaidConversionAnalytics,
  scheduleProjectSavedAnalytics,
  scheduleSuccessfulExtractionActivityAndFirstExtractAnalytics,
} = await import("./seo-funnel-events.server");

const USER_ID = "11111111-1111-4111-8111-111111111111";

function buildRequest() {
  const attribution = encodeURIComponent(
    JSON.stringify({
      anonymous_id: "anon-123",
      utm_source: "google",
      utm_medium: "organic",
      utm_campaign: "launch",
      landing_page: "/",
      page_path: "/dashboard",
    })
  );

  return new NextRequest("http://localhost/api/extract", {
    headers: {
      cookie: [
        "t2t_analytics_consent=accepted",
        `t2t_attribution=${attribution}`,
      ].join("; "),
      "x-vercel-ip-country": "IL",
    },
  });
}

async function flushScheduledAnalytics() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  logAnalyticsEventSafeMock.mockReset().mockResolvedValue(true);
  rpcMock.mockReset().mockResolvedValue({ data: null, error: null });
  fromMock.mockReset();
});

describe("scheduleSuccessfulExtractionActivityAndFirstExtractAnalytics", () => {
  it("records the activity RPC and emits first_extract_created for the user's first successful extract", async () => {
    scheduleSuccessfulExtractionActivityAndFirstExtractAnalytics({
      request: buildRequest(),
      userId: USER_ID,
      successfulExtractCountBefore: 0,
      source: "text",
    });

    await flushScheduledAnalytics();

    expect(rpcMock).toHaveBeenCalledWith("record_successful_extraction", {
      p_user_id: USER_ID,
    });
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "first_extract_created",
        userId: USER_ID,
        anonymousId: "anon-123",
        pagePath: "/dashboard",
        countryCode: "IL",
        metadata: { source: "text" },
        idempotencyKey: `first_extract_created:${USER_ID}`,
      })
    );
  });

  it("does not emit first_extract_created after the user's first persisted extraction", async () => {
    scheduleSuccessfulExtractionActivityAndFirstExtractAnalytics({
      request: buildRequest(),
      userId: USER_ID,
      successfulExtractCountBefore: 1,
      source: "image",
    });

    await flushScheduledAnalytics();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("does not emit first_extract_created if the authoritative activity write fails", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "rpc failed" },
    });

    scheduleSuccessfulExtractionActivityAndFirstExtractAnalytics({
      request: buildRequest(),
      userId: USER_ID,
      successfulExtractCountBefore: 0,
      source: "text",
    });

    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });
});

describe("scheduleProjectSavedAnalytics", () => {
  it("emits project_saved for a first successful persisted project save", async () => {
    scheduleProjectSavedAnalytics({
      request: buildRequest(),
      userId: USER_ID,
      hadProjectBefore: false,
      source: "project_import",
      createdProjectCount: 2,
    });

    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "project_saved",
        userId: USER_ID,
        idempotencyKey: `project_saved:${USER_ID}`,
        metadata: {
          source: "project_import",
          created_project_count: 2,
        },
      })
    );
  });

  it("does not emit project_saved for repeat saves or zero-project outcomes", async () => {
    scheduleProjectSavedAnalytics({
      request: buildRequest(),
      userId: USER_ID,
      hadProjectBefore: true,
      source: "project_import",
      createdProjectCount: 1,
    });
    scheduleProjectSavedAnalytics({
      request: buildRequest(),
      userId: USER_ID,
      hadProjectBefore: false,
      source: "project_import",
      createdProjectCount: 0,
    });

    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("uses a stable user-level idempotency key and keeps users independent", async () => {
    const otherUserId = "22222222-2222-4222-8222-222222222222";

    scheduleProjectSavedAnalytics({
      request: buildRequest(),
      userId: USER_ID,
      hadProjectBefore: false,
      source: "tasks_project_create",
      createdProjectCount: 1,
    });
    scheduleProjectSavedAnalytics({
      request: buildRequest(),
      userId: USER_ID,
      hadProjectBefore: false,
      source: "project_import",
      createdProjectCount: 1,
    });
    scheduleProjectSavedAnalytics({
      request: buildRequest(),
      userId: otherUserId,
      hadProjectBefore: false,
      source: "homepage_demo_claim",
      createdProjectCount: 1,
    });

    await flushScheduledAnalytics();

    const keys = logAnalyticsEventSafeMock.mock.calls.map(
      ([input]) => input.idempotencyKey
    );

    expect(keys).toEqual([
      `project_saved:${USER_ID}`,
      `project_saved:${USER_ID}`,
      `project_saved:${otherUserId}`,
    ]);
  });
});

describe("hasActiveProjectBeforeSave", () => {
  it("checks for an existing active project with service-role access", async () => {
    const limitMock = vi.fn().mockResolvedValue({
      data: [{ id: "existing-project" }],
      error: null,
    });
    const isMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqMock = vi.fn().mockReturnValue({ is: isMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });

    await expect(hasActiveProjectBeforeSave(USER_ID)).resolves.toBe(true);

    expect(fromMock).toHaveBeenCalledWith("projects");
    expect(selectMock).toHaveBeenCalledWith("id");
    expect(eqMock).toHaveBeenCalledWith("user_id", USER_ID);
    expect(isMock).toHaveBeenCalledWith("deleted_at", null);
    expect(limitMock).toHaveBeenCalledWith(1);
  });

  it("fails closed when the project preflight cannot be trusted", async () => {
    const limitMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "select failed" },
    });
    const isMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqMock = vi.fn().mockReturnValue({ is: isMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    fromMock.mockReturnValue({ select: selectMock });

    await expect(hasActiveProjectBeforeSave(USER_ID)).resolves.toBe(true);

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("schedulePaidConversionAnalytics", () => {
  it("emits paid_conversion only for a processed confirmed Creem payment with a resolved user", async () => {
    await schedulePaidConversionAnalytics({
      userId: USER_ID,
      provider: "creem",
      eventType: "subscription.paid",
      processingStatus: "processed",
      reasonCode: "creem_webhook_processed",
      environment: "live",
    });

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith({
      eventName: "paid_conversion",
      userId: USER_ID,
      metadata: {
        provider: "creem",
        event_type: "subscription.paid",
        processing_status: "processed",
        reason_code: "creem_webhook_processed",
        environment: "live",
      },
      idempotencyKey: `paid_conversion:${USER_ID}`,
    });
  });

  it("does not emit paid_conversion for duplicates, pending events, cancellations, or missing users", async () => {
    await schedulePaidConversionAnalytics({
      userId: USER_ID,
      provider: "creem",
      eventType: "subscription.paid",
      processingStatus: "duplicate",
      reasonCode: "creem_webhook_duplicate",
      environment: "live",
    });
    await schedulePaidConversionAnalytics({
      userId: USER_ID,
      provider: "creem",
      eventType: "subscription.paid",
      processingStatus: "pending_unmatched",
      reasonCode: "creem_webhook_pending_review",
      environment: "live",
    });
    await schedulePaidConversionAnalytics({
      userId: USER_ID,
      provider: "creem",
      eventType: "subscription.canceled",
      processingStatus: "processed",
      reasonCode: "creem_webhook_processed",
      environment: "live",
    });
    await schedulePaidConversionAnalytics({
      userId: null,
      provider: "creem",
      eventType: "subscription.paid",
      processingStatus: "processed",
      reasonCode: "creem_webhook_processed",
      environment: "live",
    });

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("dedupes distinct later subscription.paid renewals by user while keeping separate users independent", async () => {
    const otherUserId = "22222222-2222-4222-8222-222222222222";
    const persistedRows = new Map<string, unknown>();
    logAnalyticsEventSafeMock.mockImplementation(async (input) => {
      if (persistedRows.has(input.idempotencyKey)) {
        return false;
      }

      persistedRows.set(input.idempotencyKey, input);
      return true;
    });

    await schedulePaidConversionAnalytics({
      userId: USER_ID,
      provider: "creem",
      eventType: "subscription.paid",
      processingStatus: "processed",
      reasonCode: "creem_webhook_processed",
      environment: "live",
    });
    await schedulePaidConversionAnalytics({
      userId: USER_ID,
      provider: "creem",
      eventType: "subscription.paid",
      processingStatus: "processed",
      reasonCode: "creem_webhook_processed",
      environment: "live",
    });
    await schedulePaidConversionAnalytics({
      userId: otherUserId,
      provider: "creem",
      eventType: "subscription.paid",
      processingStatus: "processed",
      reasonCode: "creem_webhook_processed",
      environment: "live",
    });

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(3);
    expect(Array.from(persistedRows.keys())).toEqual([
      `paid_conversion:${USER_ID}`,
      `paid_conversion:${otherUserId}`,
    ]);
  });

  it("swallows analytics insertion failures so Creem processing can remain authoritative", async () => {
    logAnalyticsEventSafeMock.mockRejectedValueOnce(
      new Error("analytics unavailable")
    );

    await expect(
      schedulePaidConversionAnalytics({
        userId: USER_ID,
        provider: "creem",
        eventType: "subscription.paid",
        processingStatus: "processed",
        reasonCode: "creem_webhook_processed",
        environment: "live",
      })
    ).resolves.toBeUndefined();
  });
});
