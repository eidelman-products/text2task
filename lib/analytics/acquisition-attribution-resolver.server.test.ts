import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
const queryResponses: Array<{ data: unknown[] | null; error: { message: string } | null }> =
  [];

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

const { resolvePaidConversionAcquisitionAttribution } = await import(
  "./acquisition-attribution-resolver.server"
);

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function queueQueryResponse(data: unknown[] | null, error: { message: string } | null = null) {
  queryResponses.push({ data, error });
}

function buildQuery() {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() =>
      Promise.resolve(queryResponses.shift() ?? { data: [], error: null })
    ),
  };

  return query;
}

beforeEach(() => {
  fromMock.mockReset().mockImplementation(() => buildQuery());
  queryResponses.length = 0;
});

describe("resolvePaidConversionAcquisitionAttribution", () => {
  it("resolves a paid user back to the user's consented organic Google acquisition event", async () => {
    queueQueryResponse([
      {
        event_name: "signup_attribution_captured",
        user_id: USER_A,
        occurred_at: "2026-09-13T10:00:00.000Z",
        anonymous_id: "anon-a",
        utm_source: "google",
        utm_medium: "organic",
        utm_campaign: "launch",
        utm_content: null,
        referrer: "https://www.google.com/",
        landing_page: "/",
        country_code: "IL",
        page_path: "/signup",
      },
    ]);

    const result = await resolvePaidConversionAcquisitionAttribution(USER_A);

    expect(result).toEqual({
      status: "known",
      source: "google",
      medium: "organic",
      campaign: "launch",
      content: null,
      referrer: "https://www.google.com/",
      landingPage: "/",
      countryCode: "IL",
      evidenceEventName: "signup_attribution_captured",
      evidenceUserId: USER_A,
      evidenceAnonymousId: "anon-a",
    });
  });

  it("uses existing anonymous_id linkage when the user row carries no copied attribution fields", async () => {
    queueQueryResponse([
      {
        event_name: "signup_success",
        user_id: USER_A,
        occurred_at: "2026-09-13T10:05:00.000Z",
        anonymous_id: "anon-a",
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        referrer: null,
        landing_page: null,
        country_code: null,
        page_path: "/auth/confirm",
      },
    ]);
    queueQueryResponse([
      {
        event_name: "page_view",
        user_id: null,
        occurred_at: "2026-09-13T09:59:00.000Z",
        anonymous_id: "anon-a",
        utm_source: "google",
        utm_medium: "organic",
        utm_campaign: null,
        utm_content: null,
        referrer: "https://www.google.com/",
        landing_page: "/",
        country_code: "IL",
        page_path: "/",
      },
    ]);

    const result = await resolvePaidConversionAcquisitionAttribution(USER_A);

    expect(result.status).toBe("known");
    expect(result.source).toBe("google");
    expect(result.medium).toBe("organic");
    expect(result.evidenceAnonymousId).toBe("anon-a");
  });

  it("does not let user B inherit user A attribution", async () => {
    queueQueryResponse([
      {
        event_name: "signup_attribution_captured",
        user_id: USER_B,
        occurred_at: "2026-09-13T10:00:00.000Z",
        anonymous_id: "anon-b",
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        referrer: null,
        landing_page: null,
        country_code: null,
        page_path: "/signup",
      },
    ]);
    queueQueryResponse([
      {
        event_name: "page_view",
        user_id: USER_A,
        occurred_at: "2026-09-13T09:59:00.000Z",
        anonymous_id: "anon-b",
        utm_source: "google",
        utm_medium: "organic",
        utm_campaign: null,
        utm_content: null,
        referrer: null,
        landing_page: "/",
        country_code: null,
        page_path: "/",
      },
    ]);

    const result = await resolvePaidConversionAcquisitionAttribution(USER_B);

    expect(result.status).toBe("unknown");
    expect(result.source).toBe("unknown");
  });

  it("returns unknown safely when no consented acquisition data exists", async () => {
    queueQueryResponse([]);

    const result = await resolvePaidConversionAcquisitionAttribution(USER_A);

    expect(result).toEqual({
      status: "unknown",
      source: "unknown",
      medium: null,
      campaign: null,
      content: null,
      referrer: null,
      landingPage: null,
      countryCode: null,
      evidenceEventName: null,
      evidenceUserId: null,
      evidenceAnonymousId: null,
    });
  });

  it("returns unknown instead of fabricating attribution when the query fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    queueQueryResponse(null, { message: "analytics unavailable" });

    const result = await resolvePaidConversionAcquisitionAttribution(USER_A);

    expect(result.status).toBe("unknown");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
