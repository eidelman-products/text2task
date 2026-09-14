import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createClientMock = vi.fn();
const getUserMock = vi.fn();
const fromMock = vi.fn();
const findDuplicateProjectMock = vi.fn();
const buildDuplicateCandidateFromProjectPayloadMock = vi.fn();
const hasActiveProjectBeforeSaveMock = vi.fn();
const scheduleProjectSavedAnalyticsMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

vi.mock("@/lib/tasks/project-duplicate-detection", () => ({
  buildDuplicateCandidateFromProjectPayload: (...args: unknown[]) =>
    buildDuplicateCandidateFromProjectPayloadMock(...args),
  findDuplicateProject: (...args: unknown[]) =>
    findDuplicateProjectMock(...args),
}));

vi.mock("@/lib/analytics/seo-funnel-events.server", () => ({
  hasActiveProjectBeforeSave: (...args: unknown[]) =>
    hasActiveProjectBeforeSaveMock(...args),
  scheduleProjectSavedAnalytics: (...args: unknown[]) =>
    scheduleProjectSavedAnalyticsMock(...args),
}));

const { POST } = await import("./route");

const USER_ID = "11111111-1111-4111-8111-111111111111";

function buildRequest(
  body: unknown = {
    mode: "project",
    title: "Kitchen refresh",
    subtasks: [{ title: "Measure cabinets" }],
  }
) {
  return new NextRequest("http://localhost/api/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function configureSupabaseProjectCreate() {
  fromMock.mockImplementation((table: string) => {
    if (table === "projects") {
      return {
        insert: vi.fn((row: Record<string, unknown>) => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: { id: "project-1", ...row },
                error: null,
              })
            ),
          })),
        })),
      };
    }

    if (table === "tasks") {
      return {
        insert: vi.fn((rows: Array<Record<string, unknown>>) => ({
          select: vi.fn(() =>
            Promise.resolve({
              data: rows.map((row, index) => ({
                id: `task-${index + 1}`,
                clients: null,
                projects: null,
                ...row,
              })),
              error: null,
            })
          ),
        })),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });
}

beforeEach(() => {
  getUserMock
    .mockReset()
    .mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  fromMock.mockReset();
  configureSupabaseProjectCreate();
  createClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    from: (...args: unknown[]) => fromMock(...args),
  });
  buildDuplicateCandidateFromProjectPayloadMock
    .mockReset()
    .mockReturnValue({ title: "Kitchen refresh" });
  findDuplicateProjectMock.mockReset().mockResolvedValue(null);
  hasActiveProjectBeforeSaveMock.mockReset().mockResolvedValue(false);
  scheduleProjectSavedAnalyticsMock.mockReset();
});

describe("POST /api/tasks - project_saved measurement", () => {
  it("schedules project_saved after createProjectWithSubtasks persists a project", async () => {
    const request = buildRequest();
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.project.id).toBe("project-1");
    expect(hasActiveProjectBeforeSaveMock).toHaveBeenCalledWith(USER_ID);
    expect(scheduleProjectSavedAnalyticsMock).toHaveBeenCalledWith({
      request,
      userId: USER_ID,
      hadProjectBefore: false,
      source: "tasks_project_create",
      createdProjectCount: 1,
    });
  });

  it("passes prior-project state to the central helper so repeat saves dedupe by user", async () => {
    hasActiveProjectBeforeSaveMock.mockResolvedValueOnce(true);

    const request = buildRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(scheduleProjectSavedAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hadProjectBefore: true,
        source: "tasks_project_create",
      })
    );
  });

  it("does not schedule project_saved when duplicate detection blocks persistence", async () => {
    findDuplicateProjectMock.mockResolvedValueOnce({ id: "existing-project" });

    const response = await POST(buildRequest());

    expect(response.status).toBe(409);
    expect(scheduleProjectSavedAnalyticsMock).not.toHaveBeenCalled();
  });

  it("keeps project creation successful when analytics scheduling fails", async () => {
    scheduleProjectSavedAnalyticsMock.mockImplementationOnce(() => {
      throw new Error("analytics unavailable");
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.project.id).toBe("project-1");
  });

  it("does not pass project or task content into analytics metadata", async () => {
    await POST(buildRequest());

    const serialized = JSON.stringify(
      scheduleProjectSavedAnalyticsMock.mock.calls[0][0]
    );

    expect(serialized).not.toContain("Kitchen refresh");
    expect(serialized).not.toContain("Measure cabinets");
  });
});
