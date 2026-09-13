import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const rpcMock = vi.fn();
const schedulePaidConversionAnalyticsMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock("@/lib/analytics/seo-funnel-events.server", () => ({
  schedulePaidConversionAnalytics: (...args: unknown[]) =>
    schedulePaidConversionAnalyticsMock(...args),
}));

const { POST } = await import("./route");

const SECRET = "webhook-secret";
const PRODUCT_ID = "prod_text2task";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

function signBody(body: string) {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

function buildPayload(eventType = "subscription.paid", eventId = "evt_1") {
  return {
    id: eventId,
    eventType,
    created_at: "2026-09-13T10:00:00.000Z",
    object: {
      id: "sub_1",
      updated_at: "2026-09-13T10:00:00.000Z",
      product: { id: PRODUCT_ID },
      customer: { id: "cust_1" },
      metadata: { user_id: USER_ID },
      status: "paid",
    },
  };
}

function buildRequest(payload: unknown, signature?: string) {
  const body = JSON.stringify(payload);

  return new NextRequest("http://localhost/api/webhooks/creem", {
    method: "POST",
    body,
    headers: {
      "creem-signature": signature ?? signBody(body),
      "content-type": "application/json",
    },
  });
}

beforeEach(() => {
  process.env.CREEM_WEBHOOK_SECRET = SECRET;
  process.env.CREEM_PRODUCT_ID = PRODUCT_ID;
  rpcMock.mockReset().mockResolvedValue({
    data: [
      {
        result_processing_status: "processed",
        result_reason_code: "creem_webhook_processed",
        result_resolved_user_id: USER_ID,
      },
    ],
    error: null,
  });
  schedulePaidConversionAnalyticsMock.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/webhooks/creem - paid_conversion measurement", () => {
  it("emits paid_conversion only after a verified subscription.paid webhook is processed for a resolved user", async () => {
    const response = await POST(buildRequest(buildPayload()));

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith(
      "process_creem_webhook_event",
      expect.objectContaining({
        p_event_type: "subscription.paid",
        p_action: "grant_pro",
        p_internal_user_id_candidate: USER_ID,
      })
    );
    expect(schedulePaidConversionAnalyticsMock).toHaveBeenCalledWith({
      userId: USER_ID,
      provider: "creem",
      eventType: "subscription.paid",
      processingStatus: "processed",
      reasonCode: "creem_webhook_processed",
      environment: null,
    });
  });

  it("does not emit paid_conversion for duplicate webhook deliveries", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          result_processing_status: "duplicate",
          result_reason_code: "creem_webhook_duplicate",
          result_resolved_user_id: USER_ID,
        },
      ],
      error: null,
    });

    const response = await POST(buildRequest(buildPayload()));

    expect(response.status).toBe(200);
    expect(schedulePaidConversionAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: "duplicate",
        reasonCode: "creem_webhook_duplicate",
      })
    );
  });

  it("does not process or emit paid_conversion for an invalid signature", async () => {
    const response = await POST(buildRequest(buildPayload(), "0".repeat(64)));

    expect(response.status).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(schedulePaidConversionAnalyticsMock).not.toHaveBeenCalled();
  });

  it("passes non-conversion and unresolved-user events through without creating a false conversion", async () => {
    await POST(buildRequest(buildPayload("subscription.canceled")));

    rpcMock.mockResolvedValueOnce({
      data: [
        {
          result_processing_status: "pending_unmatched",
          result_reason_code: "creem_webhook_pending_review",
          result_resolved_user_id: null,
        },
      ],
      error: null,
    });
    await POST(buildRequest(buildPayload("subscription.paid")));

    expect(schedulePaidConversionAnalyticsMock).toHaveBeenCalledTimes(2);
    expect(schedulePaidConversionAnalyticsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ eventType: "subscription.canceled" })
    );
    expect(schedulePaidConversionAnalyticsMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: null,
        processingStatus: "pending_unmatched",
      })
    );
  });

  it("handles a distinct later subscription.paid renewal for user A and a first subscription.paid for user B", async () => {
    await POST(buildRequest(buildPayload("subscription.paid", "evt_initial_a")));
    await POST(buildRequest(buildPayload("subscription.paid", "evt_renewal_a")));

    rpcMock.mockResolvedValueOnce({
      data: [
        {
          result_processing_status: "processed",
          result_reason_code: "creem_webhook_processed",
          result_resolved_user_id: OTHER_USER_ID,
        },
      ],
      error: null,
    });
    const userBPayload = buildPayload("subscription.paid", "evt_initial_b");
    userBPayload.object.metadata.user_id = OTHER_USER_ID;
    await POST(buildRequest(userBPayload));

    expect(schedulePaidConversionAnalyticsMock).toHaveBeenCalledTimes(3);
    expect(schedulePaidConversionAnalyticsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: USER_ID })
    );
    expect(schedulePaidConversionAnalyticsMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userId: USER_ID })
    );
    expect(schedulePaidConversionAnalyticsMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ userId: OTHER_USER_ID })
    );
  });

  it("keeps processed Creem webhook success from becoming a false retry when analytics fails", async () => {
    schedulePaidConversionAnalyticsMock.mockRejectedValueOnce(
      new Error("analytics unavailable")
    );

    const response = await POST(buildRequest(buildPayload()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });
  });
});
