import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const ensureUserMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

vi.mock("@/lib/supabase/ensureUser", () => ({
  ensureUser: (input: unknown) => ensureUserMock(input),
}));

const { requireDashboardUser } = await import("./requireDashboardUser");

beforeEach(() => {
  getUserMock.mockReset();
  ensureUserMock.mockReset();
  redirectMock.mockClear();
});

describe("requireDashboardUser", () => {
  it("redirects to /login when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    await expect(requireDashboardUser()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(ensureUserMock).not.toHaveBeenCalled();
  });

  it("redirects to /login when auth.getUser() returns an error", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "session expired" },
    });

    await expect(requireDashboardUser()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(ensureUserMock).not.toHaveBeenCalled();
  });

  it("redirects to /login when the authenticated user has no email", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: null } },
      error: null,
    });

    await expect(requireDashboardUser()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(ensureUserMock).not.toHaveBeenCalled();
  });

  it("returns the app user via ensureUser for an authenticated user with an email", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "person@example.com" } },
      error: null,
    });
    ensureUserMock.mockResolvedValue({
      id: "user-1",
      email: "person@example.com",
      plan: "free",
    });

    const result = await requireDashboardUser();

    expect(ensureUserMock).toHaveBeenCalledWith({
      id: "user-1",
      email: "person@example.com",
    });
    expect(result).toEqual({ id: "user-1", email: "person@example.com", plan: "free" });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
