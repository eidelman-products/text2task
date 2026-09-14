import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createClientMock = vi.fn();
const getUserMock = vi.fn();
const validateProjectImportGroupsMock = vi.fn();
const findProjectDuplicateMock = vi.fn();
const createProjectGroupMock = vi.fn();
const claimProjectImportAttemptMock = vi.fn();
const executeClaimedProjectImportMock = vi.fn();
const toClaimedImportAttemptMock = vi.fn();
const failProjectImportAttemptMock = vi.fn();
const prepareProjectImportAttemptForDuplicateReviewMock = vi.fn();
const rollbackCreatedProjectsMock = vi.fn();
const hasActiveProjectBeforeSaveMock = vi.fn();
const scheduleProjectSavedAnalyticsMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

vi.mock("@/lib/projects/import-persistence.server", () => ({
  PROJECT_IMPORT_MAX_PROJECTS: 10,
  claimProjectImportAttempt: (...args: unknown[]) =>
    claimProjectImportAttemptMock(...args),
  executeClaimedProjectImport: (...args: unknown[]) =>
    executeClaimedProjectImportMock(...args),
  failProjectImportAttempt: (...args: unknown[]) =>
    failProjectImportAttemptMock(...args),
  prepareProjectImportAttemptForDuplicateReview: (...args: unknown[]) =>
    prepareProjectImportAttemptForDuplicateReviewMock(...args),
  toClaimedImportAttempt: (...args: unknown[]) =>
    toClaimedImportAttemptMock(...args),
  validateProjectImportGroups: (...args: unknown[]) =>
    validateProjectImportGroupsMock(...args),
  findProjectDuplicate: (...args: unknown[]) =>
    findProjectDuplicateMock(...args),
  createProjectGroup: (...args: unknown[]) => createProjectGroupMock(...args),
  rollbackCreatedProjects: (...args: unknown[]) =>
    rollbackCreatedProjectsMock(...args),
}));

vi.mock("@/lib/analytics/seo-funnel-events.server", () => ({
  hasActiveProjectBeforeSave: (...args: unknown[]) =>
    hasActiveProjectBeforeSaveMock(...args),
  scheduleProjectSavedAnalytics: (...args: unknown[]) =>
    scheduleProjectSavedAnalyticsMock(...args),
}));

const { POST } = await import("./route");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_GROUP = { name: "Project", tasks: [] };
const IDEMPOTENCY_KEY = "33333333-3333-4333-8333-333333333333";

function buildRequest(body: unknown = { projects: [PROJECT_GROUP] }) {
  return new NextRequest("http://localhost/api/projects/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getUserMock
    .mockReset()
    .mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  createClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
  });
  validateProjectImportGroupsMock.mockReset().mockReturnValue([]);
  findProjectDuplicateMock.mockReset().mockResolvedValue(null);
  createProjectGroupMock.mockReset().mockResolvedValue({
    project: { id: "project-1" },
    tasks: [{ id: 1 }],
  });
  claimProjectImportAttemptMock.mockReset();
  executeClaimedProjectImportMock.mockReset();
  toClaimedImportAttemptMock
    .mockReset()
    .mockReturnValue({ attemptId: "attempt-1" });
  failProjectImportAttemptMock.mockReset().mockResolvedValue(undefined);
  prepareProjectImportAttemptForDuplicateReviewMock
    .mockReset()
    .mockResolvedValue(undefined);
  rollbackCreatedProjectsMock.mockReset().mockResolvedValue(undefined);
  hasActiveProjectBeforeSaveMock.mockReset().mockResolvedValue(false);
  scheduleProjectSavedAnalyticsMock.mockReset();
});

describe("POST /api/projects/import - project_saved measurement", () => {
  it("schedules project_saved after authoritative project persistence succeeds", async () => {
    const request = buildRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(hasActiveProjectBeforeSaveMock).toHaveBeenCalledWith(USER_ID);
    expect(scheduleProjectSavedAnalyticsMock).toHaveBeenCalledWith({
      request,
      userId: USER_ID,
      hadProjectBefore: false,
      source: "project_import",
      createdProjectCount: 1,
    });
  });

  it("does not schedule project_saved when persistence fails and rollback runs", async () => {
    createProjectGroupMock.mockRejectedValueOnce(new Error("insert failed"));

    const response = await POST(buildRequest());

    expect(response.status).toBe(500);
    expect(rollbackCreatedProjectsMock).toHaveBeenCalled();
    expect(scheduleProjectSavedAnalyticsMock).not.toHaveBeenCalled();
  });

  it("does not schedule project_saved when duplicate review blocks persistence", async () => {
    findProjectDuplicateMock.mockResolvedValueOnce({ id: "existing-project" });

    const response = await POST(buildRequest());

    expect(response.status).toBe(409);
    expect(createProjectGroupMock).not.toHaveBeenCalled();
    expect(scheduleProjectSavedAnalyticsMock).not.toHaveBeenCalled();
  });

  it("schedules project_saved after the transactional import path commits a saved result", async () => {
    const request = buildRequest({
      projects: [PROJECT_GROUP],
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    claimProjectImportAttemptMock.mockResolvedValueOnce({
      kind: "claimed",
      attempt: { id: "attempt-1" },
      requestHash: "hash-1",
      payloadJson: [PROJECT_GROUP],
    });
    executeClaimedProjectImportMock.mockResolvedValueOnce({
      kind: "saved",
      result: {
        ok: true,
        createdProjects: [{ id: "project-1" }, { id: "project-2" }],
        createdTasks: [{ id: "task-1" }],
        duplicates: [],
        failedGroups: [],
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(scheduleProjectSavedAnalyticsMock).toHaveBeenCalledWith({
      request,
      userId: USER_ID,
      hadProjectBefore: false,
      source: "project_import",
      createdProjectCount: 2,
    });
  });

  it("keeps a successful project import successful when analytics scheduling fails", async () => {
    scheduleProjectSavedAnalyticsMock.mockImplementationOnce(() => {
      throw new Error("analytics unavailable");
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
