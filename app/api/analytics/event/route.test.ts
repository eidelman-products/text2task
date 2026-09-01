import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { OWNER_ANALYTICS_EXCLUSION_COOKIE } from "@/lib/analytics/owner-exclusion.server";

/*
  Phase 4B -- first test file for this route. Phase 1-4's read-only audits
  repeatedly flagged this as the one untested link in the anonymous
  page_view pipeline; this covers the new server-derived idempotency-key
  logic specifically (the actual delta introduced this phase), plus basic
  existing-behavior preservation (event-name allowlisting, malformed body
  handling) so a future change can't silently regress either.
*/

const logAnalyticsEventSafeMock = vi.fn();

vi.mock("@/lib/analytics/internal-events.server", () => ({
  logAnalyticsEventSafe: (...args: unknown[]) =>
    logAnalyticsEventSafeMock(...args),
}));

const { POST } = await import("./route");

const VALID_PAGE_VIEW_ID = "22222222-2222-4222-8222-222222222222";
const ANOTHER_VALID_PAGE_VIEW_ID = "33333333-3333-4333-8333-333333333333";

function buildRequest(
  rawBody: string,
  contentLength?: number,
  extraHeaders?: Record<string, string>
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...extraHeaders,
  };

  if (contentLength !== undefined) {
    headers["content-length"] = String(contentLength);
  }

  return new NextRequest("http://localhost/api/analytics/event", {
    method: "POST",
    body: rawBody,
    headers,
  });
}

function buildJsonRequest(body: unknown, extraHeaders?: Record<string, string>) {
  return buildRequest(JSON.stringify(body), undefined, extraHeaders);
}

function withOwnerExclusionCookie(): Record<string, string> {
  return { cookie: `${OWNER_ANALYTICS_EXCLUSION_COOKIE}=1` };
}

beforeEach(() => {
  logAnalyticsEventSafeMock.mockReset();
  logAnalyticsEventSafeMock.mockResolvedValue(true);
});

describe("POST /api/analytics/event - idempotency key derivation (Phase 4B)", () => {
  it("derives page_view:<anonymousId>:<pageViewId> when both are present and valid", async () => {
    const response = await POST(
      buildJsonRequest({
        event_name: "page_view",
        page_path: "/pricing",
        anonymous_id: "anon-123",
        page_view_id: VALID_PAGE_VIEW_ID,
      })
    );

    expect(response.status).toBe(204);
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(1);
    const call = logAnalyticsEventSafeMock.mock.calls[0][0];
    expect(call.idempotencyKey).toBe(
      `page_view:anon-123:${VALID_PAGE_VIEW_ID}`
    );
  });

  it("also accepts the camelCase pageViewId alias", async () => {
    const response = await POST(
      buildJsonRequest({
        event_name: "page_view",
        page_path: "/",
        anonymous_id: "anon-123",
        pageViewId: VALID_PAGE_VIEW_ID,
      })
    );

    expect(response.status).toBe(204);
    const call = logAnalyticsEventSafeMock.mock.calls[0][0];
    expect(call.idempotencyKey).toBe(
      `page_view:anon-123:${VALID_PAGE_VIEW_ID}`
    );
  });

  it("two different valid pageViewIds for the same anonymousId/path produce two different idempotency keys", async () => {
    await POST(
      buildJsonRequest({
        event_name: "page_view",
        page_path: "/pricing",
        anonymous_id: "anon-123",
        page_view_id: VALID_PAGE_VIEW_ID,
      })
    );
    await POST(
      buildJsonRequest({
        event_name: "page_view",
        page_path: "/pricing",
        anonymous_id: "anon-123",
        page_view_id: ANOTHER_VALID_PAGE_VIEW_ID,
      })
    );

    const firstKey = logAnalyticsEventSafeMock.mock.calls[0][0].idempotencyKey;
    const secondKey = logAnalyticsEventSafeMock.mock.calls[1][0].idempotencyKey;
    expect(firstKey).not.toBe(secondKey);
  });

  it("test 19: a malformed page_view_id is rejected safely -- event still logs, without an idempotency key", async () => {
    const response = await POST(
      buildJsonRequest({
        event_name: "page_view",
        page_path: "/",
        anonymous_id: "anon-123",
        page_view_id: "not-a-real-uuid",
      })
    );

    expect(response.status).toBe(204);
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(1);
    const call = logAnalyticsEventSafeMock.mock.calls[0][0];
    expect(call.idempotencyKey).toBeNull();
    expect(call.pagePath).toBe("/");
  });

  it("test 20: missing anonymous ID with a valid pageViewId still logs safely, without an idempotency key", async () => {
    const response = await POST(
      buildJsonRequest({
        event_name: "page_view",
        page_path: "/",
        page_view_id: VALID_PAGE_VIEW_ID,
      })
    );

    expect(response.status).toBe(204);
    const call = logAnalyticsEventSafeMock.mock.calls[0][0];
    expect(call.idempotencyKey).toBeNull();
  });

  it("a missing page_view_id preserves prior behavior exactly (no idempotency key, event still logs)", async () => {
    const response = await POST(
      buildJsonRequest({
        event_name: "page_view",
        page_path: "/",
        anonymous_id: "anon-123",
      })
    );

    expect(response.status).toBe(204);
    const call = logAnalyticsEventSafeMock.mock.calls[0][0];
    expect(call.idempotencyKey).toBeNull();
  });
});

describe("POST /api/analytics/event - existing behavior preserved", () => {
  it("returns 204 and logs nothing for a disallowed event name", async () => {
    const response = await POST(
      buildJsonRequest({
        event_name: "not_a_real_event",
        page_path: "/",
        anonymous_id: "anon-123",
      })
    );

    expect(response.status).toBe(204);
    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 204 safely for a malformed JSON body, without throwing", async () => {
    const response = await POST(buildRequest("{not valid json"));

    expect(response.status).toBe(204);
    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 204 safely when the body exceeds the size limit", async () => {
    const response = await POST(
      buildRequest(
        JSON.stringify({
          event_name: "page_view",
          page_path: "/",
          anonymous_id: "a".repeat(9000),
        })
      )
    );

    expect(response.status).toBe(204);
    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("passes the page_path through unchanged", async () => {
    await POST(
      buildJsonRequest({
        event_name: "page_view",
        page_path: "/features/client-project-tracker",
        anonymous_id: "anon-123",
        page_view_id: VALID_PAGE_VIEW_ID,
      })
    );

    const call = logAnalyticsEventSafeMock.mock.calls[0][0];
    expect(call.pagePath).toBe("/features/client-project-tracker");
  });

  it("never throws even if logAnalyticsEventSafe itself rejects", async () => {
    logAnalyticsEventSafeMock.mockRejectedValue(new Error("simulated DB failure"));

    const response = await POST(
      buildJsonRequest({
        event_name: "page_view",
        page_path: "/",
        anonymous_id: "anon-123",
        page_view_id: VALID_PAGE_VIEW_ID,
      })
    );

    expect(response.status).toBe(204);
  });
});

describe("POST /api/analytics/event - owner analytics exclusion", () => {
  it.each(["/", "/dashboard", "/pricing", "/use-cases/web-designers"])(
    "owner-exclusion cookie present + page_view %s -> returns 204 and never logs",
    async (pagePath) => {
      const response = await POST(
        buildJsonRequest(
          {
            event_name: "page_view",
            page_path: pagePath,
            anonymous_id: "anon-owner-browser",
            page_view_id: VALID_PAGE_VIEW_ID,
          },
          withOwnerExclusionCookie()
        )
      );

      expect(response.status).toBe(204);
      expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
    }
  );

  it("owner-exclusion cookie present + /admin path -> still never logs (existing /admin exclusion is unaffected)", async () => {
    const response = await POST(
      buildJsonRequest(
        {
          event_name: "page_view",
          page_path: "/admin",
          anonymous_id: "anon-owner-browser",
          page_view_id: VALID_PAGE_VIEW_ID,
        },
        withOwnerExclusionCookie()
      )
    );

    expect(response.status).toBe(204);
    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("no owner-exclusion cookie -> anonymous visitor is logged normally", async () => {
    const response = await POST(
      buildJsonRequest({
        event_name: "page_view",
        page_path: "/",
        anonymous_id: "anon-normal-visitor",
        page_view_id: VALID_PAGE_VIEW_ID,
      })
    );

    expect(response.status).toBe(204);
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(1);
  });

  it("a crafted body claiming isOwner: true, without the trusted cookie, does NOT activate exclusion", async () => {
    const response = await POST(
      buildJsonRequest({
        event_name: "page_view",
        page_path: "/",
        anonymous_id: "anon-spoofer",
        page_view_id: VALID_PAGE_VIEW_ID,
        isOwner: true,
      })
    );

    expect(response.status).toBe(204);
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(1);
  });

  it("a crafted anonymous_id that merely looks owner-related does NOT activate exclusion", async () => {
    const response = await POST(
      buildJsonRequest({
        event_name: "page_view",
        page_path: "/",
        anonymous_id: "owner-admin-text2task",
        page_view_id: VALID_PAGE_VIEW_ID,
      })
    );

    expect(response.status).toBe(204);
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(1);
  });

  it.each(["true", "0", "2", "", "yes"])(
    "a malformed exclusion-cookie value (%j) does NOT activate exclusion -- only the exact value '1' does",
    async (malformedValue) => {
      const response = await POST(
        buildJsonRequest(
          {
            event_name: "page_view",
            page_path: "/",
            anonymous_id: "anon-malformed-cookie",
            page_view_id: VALID_PAGE_VIEW_ID,
          },
          { cookie: `${OWNER_ANALYTICS_EXCLUSION_COOKIE}=${malformedValue}` }
        )
      );

      expect(response.status).toBe(204);
      expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(1);
    }
  );

  it("owner-exclusion cookie alongside other unrelated cookies still activates exclusion", async () => {
    const response = await POST(
      buildJsonRequest(
        {
          event_name: "page_view",
          page_path: "/",
          anonymous_id: "anon-owner-browser",
          page_view_id: VALID_PAGE_VIEW_ID,
        },
        {
          cookie: `t2t_anon_id=some-anon-id; ${OWNER_ANALYTICS_EXCLUSION_COOKIE}=1; t2t_analytics_consent=accepted`,
        }
      )
    );

    expect(response.status).toBe(204);
    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });
});
