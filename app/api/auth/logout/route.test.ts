import { beforeEach, describe, expect, it, vi } from "vitest";

import { OWNER_ANALYTICS_EXCLUSION_COOKIE } from "@/lib/analytics/owner-exclusion.server";

const signOutMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { signOut: signOutMock },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

const { POST } = await import("./route");

beforeEach(() => {
  signOutMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
});

describe("POST /api/auth/logout - owner-exclusion cookie persistence", () => {
  it("does not clear the owner-exclusion cookie (it intentionally persists past logout)", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    const setCookieHeaders = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];

    const ownerExclusionHeader = setCookieHeaders.find((header) =>
      header.startsWith(`${OWNER_ANALYTICS_EXCLUSION_COOKIE}=`)
    );

    expect(ownerExclusionHeader).toBeUndefined();
  });
});
