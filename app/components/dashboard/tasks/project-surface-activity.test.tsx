// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ResourceManagerModal from "../resources/resource-manager-modal";
import DesktopTasksTable from "./desktop-tasks-table";
import MobileTaskCard from "./mobile-task-card";
import { useProjectUpdate } from "./project-updates/use-project-update";
import { useProjectUpdateHistory } from "./project-updates/use-project-update-history";
import type { TaskProjectGroup, TaskRow } from "./task-types";

vi.mock("../resources/resource-api", () => ({
  createLinkResource: vi.fn(),
  createNoteResource: vi.fn(),
  deleteTaskResource: vi.fn(),
  fetchTaskResources: vi.fn().mockResolvedValue([]),
  formatResourceFileSize: vi.fn(() => ""),
  getResourceIcon: vi.fn(() => "link"),
  getResourceTypeLabel: vi.fn(() => "Link"),
  getTaskResourceFileUrl: vi.fn(() => null),
  isFileResource: vi.fn(() => false),
  isLinkResource: vi.fn(() => false),
  isNoteResource: vi.fn(() => false),
  updateTaskResource: vi.fn(),
  uploadAndCreateFileResource: vi.fn(),
}));

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const NAV_A = "33333333-3333-4333-8333-333333333333";
const NAV_B = "44444444-4444-4444-8444-444444444444";

type FetchMock = ReturnType<typeof vi.fn>;

function installFetchMock(productEventStatus = 204) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === "/api/activity/product-event") {
      return Promise.resolve(new Response(null, { status: productEventStatus }));
    }
    if (url.startsWith("/api/project-updates/history")) {
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, updates: [], events: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function installRejectedProductEventFetchMock() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === "/api/activity/product-event") {
      return Promise.reject(new TypeError("activity endpoint unavailable"));
    }
    if (url.startsWith("/api/project-updates/history")) {
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, updates: [], events: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true })));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function installRandomUuidMock(...uuids: string[]) {
  const randomUUID = vi.fn();
  for (const uuid of uuids) {
    randomUUID.mockReturnValueOnce(uuid);
  }
  randomUUID.mockReturnValue(uuids[uuids.length - 1] ?? NAV_A);
  vi.stubGlobal("crypto", { randomUUID });
  return randomUUID;
}

function productEventCalls(fetchMock: FetchMock) {
  return fetchMock.mock.calls.filter(
    ([url]) => String(url) === "/api/activity/product-event"
  );
}

function productEventBodies(fetchMock: FetchMock) {
  return productEventCalls(fetchMock).map((call) => {
    const init = call[1] as RequestInit;
    return JSON.parse(String(init.body)) as {
      event: {
        eventName: string;
        route: string;
        entityType: string | null;
        entityId: string | null;
      };
      navigationId: string;
    };
  });
}

function setVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
}

function taskRow(id: number, projectId: string | null = PROJECT_ID): TaskRow {
  return {
    id,
    client: {
      id: `client-${id}`,
      name: "Acme",
    },
    project: projectId
      ? {
          id: projectId,
          title: id === 2 ? "Second launch" : "Website launch",
          client_name: "Acme",
        }
      : null,
    task: id === 2 ? "Draft copy" : "Design hero",
    amount: "",
    deadline: "",
    priority: "Medium",
    status: "New",
    source: "manual",
    project_id: projectId,
    created_at: "2026-08-03T10:00:00.000Z",
  };
}

function projectGroup(projectId: string | null = PROJECT_ID): TaskProjectGroup {
  const task = taskRow(1, projectId);
  return {
    key: projectId ? `project::${projectId}` : "fallback::1",
    project_id: projectId,
    project: task.project,
    clientName: "Acme",
    projectTitle: "Website launch",
    projectSummary: "",
    tasks: [task],
    subtasks: [
      {
        id: task.id,
        project_id: projectId,
        title: task.task,
        status: task.status,
        priority: task.priority,
        amount: task.amount,
        deadline: task.deadline,
      },
    ],
    primaryTask: task,
    taskIds: [task.id],
    amount: "",
    deadline: "",
    priority: "Medium",
    status: "New",
    source: "manual",
    hasContactDetails: false,
    subtaskCount: 1,
    completedSubtaskCount: 0,
  };
}

function noop() {}

function renderDesktop(tasks: TaskRow[] = [taskRow(1)]) {
  return render(
    <DesktopTasksTable
      tasks={tasks}
      allVisibleSelected={false}
      hasMatchingTasks
      savingTaskIds={{}}
      savedTaskIds={{}}
      deletingTaskIds={{}}
      copiedTaskIds={{}}
      selectedTaskIds={[]}
      archiveView="active"
      flashTaskId={null}
      taskRefs={{ current: {} }}
      onToggleSelectAllVisible={noop}
      onEnterBlur={noop}
      toggleSelect={noop}
      updateTaskField={noop}
      updateTaskStatus={noop}
      updateProjectField={noop}
      copyTask={noop}
      pendingProjectAction={null}
      onArchiveProject={noop}
      onRestoreProject={noop}
      onRequestProjectDelete={noop}
      formatCreatedDate={() => "Created Aug 3"}
      projectResourceCounts={{}}
      onOpenProjectResources={noop}
      onOpenProjectUpdate={noop}
      onOpenProjectHistory={noop}
    />
  );
}

function renderMobile(group: TaskProjectGroup = projectGroup()) {
  return render(
    <MobileTaskCard
      project={group}
      projectId={group.project_id ?? null}
      isSaving={false}
      isSaved={false}
      isDeleting={false}
      isCopied={false}
      isSelected={false}
      isPartiallySelected={false}
      archiveView="active"
      onToggleProjectSelection={noop}
      updateTaskField={noop}
      updateTaskStatus={noop}
      updateProjectField={noop}
      copyTask={noop}
    />
  );
}

function ProjectUpdateProbe({ project = projectGroup() }: { project?: TaskProjectGroup }) {
  const update = useProjectUpdate();
  return (
    <>
      <button type="button" onClick={() => update.openModal(project)}>
        Open update
      </button>
      <button type="button" onClick={update.closeModal}>
        Close update
      </button>
      <button type="button" onClick={() => update.setRawInput("client update text")}>
        Type update
      </button>
      {update.uiState.modal.isOpen ? <div>Update modal open</div> : null}
    </>
  );
}

function ProjectHistoryProbe({ project = projectGroup() }: { project?: TaskProjectGroup }) {
  const history = useProjectUpdateHistory();
  return (
    <>
      <button type="button" onClick={() => history.openHistory(project)}>
        Open history
      </button>
      <button type="button" onClick={history.closeHistory}>
        Close history
      </button>
      {history.state.isOpen ? <div>History modal open</div> : null}
    </>
  );
}

afterEach(() => {
  setVisibilityState("visible");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("project details activity", () => {
  it("desktop open sends one project_details_expanded event and close does not", async () => {
    const fetchMock = installFetchMock();
    installRandomUuidMock(NAV_A, NAV_B);
    const user = userEvent.setup();

    renderDesktop();
    await user.click(screen.getByRole("button", { name: /Open details/i }));

    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));
    expect(productEventBodies(fetchMock)[0]).toEqual({
      event: {
        eventName: "project_details_expanded",
        route: "/dashboard",
        entityType: "project",
        entityId: PROJECT_ID,
      },
      navigationId: NAV_A,
    });

    await user.click(screen.getByRole("button", { name: /Hide details/i }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(productEventCalls(fetchMock)).toHaveLength(1);
  });

  it("mobile reopen uses a new navigationId and missing UUID sends no request", async () => {
    const fetchMock = installFetchMock();
    installRandomUuidMock(NAV_A, NAV_B);
    const user = userEvent.setup();

    const { unmount } = renderMobile();
    await user.click(screen.getByRole("button", { name: /Open details/i }));
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: /Hide details/i }));
    await user.click(screen.getByRole("button", { name: /Open details/i }));

    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(2));
    expect(productEventBodies(fetchMock).map((body) => body.navigationId)).toEqual([
      NAV_A,
      NAV_B,
    ]);

    unmount();
    renderMobile(projectGroup(null));
    await user.click(screen.getByRole("button", { name: /Open details/i }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(productEventCalls(fetchMock)).toHaveLength(2);
  });
});

describe("resources activity", () => {
  it("resource modal open sends project_resources_viewed once and rerender does not duplicate", async () => {
    const fetchMock = installFetchMock();
    installRandomUuidMock(NAV_A, NAV_B);

    const { rerender } = render(
      <ResourceManagerModal isOpen projectId={PROJECT_ID} taskId={null} onClose={noop} />
    );
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    rerender(
      <ResourceManagerModal isOpen projectId={PROJECT_ID} taskId={null} onClose={noop} />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(productEventCalls(fetchMock)).toHaveLength(1);
  });

  it("resource modal project switch while open sends a second event", async () => {
    const fetchMock = installFetchMock();
    installRandomUuidMock(NAV_A, NAV_B);

    const { rerender } = render(
      <ResourceManagerModal isOpen projectId={PROJECT_ID} taskId={null} onClose={noop} />
    );
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    rerender(
      <ResourceManagerModal isOpen projectId={OTHER_PROJECT_ID} taskId={null} onClose={noop} />
    );

    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(2));
    expect(productEventBodies(fetchMock).map((body) => body.event.entityId)).toEqual([
      PROJECT_ID,
      OTHER_PROJECT_ID,
    ]);
  });

  it("resource modal close/reopen gets a new navigationId and hidden project switch cancels stale pending", async () => {
    setVisibilityState("hidden");
    const fetchMock = installFetchMock();
    installRandomUuidMock(NAV_A, NAV_B, "55555555-5555-4555-8555-555555555555");

    const { rerender } = render(
      <ResourceManagerModal isOpen projectId={PROJECT_ID} taskId={null} onClose={noop} />
    );

    rerender(
      <ResourceManagerModal isOpen projectId={OTHER_PROJECT_ID} taskId={null} onClose={noop} />
    );

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));
    expect(productEventBodies(fetchMock)[0]).toMatchObject({
      event: {
        eventName: "project_resources_viewed",
        route: "/dashboard",
        entityType: "project",
        entityId: OTHER_PROJECT_ID,
      },
      navigationId: NAV_B,
    });

    rerender(
      <ResourceManagerModal isOpen={false} projectId={OTHER_PROJECT_ID} taskId={null} onClose={noop} />
    );
    rerender(
      <ResourceManagerModal isOpen projectId={OTHER_PROJECT_ID} taskId={null} onClose={noop} />
    );

    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(2));
    expect(productEventBodies(fetchMock)[1].navigationId).toBe(
      "55555555-5555-4555-8555-555555555555"
    );
  });
});

describe("project update activity", () => {
  it("history open sends project_history_viewed and load failure does not affect tracking isolation", async () => {
    const fetchMock = installFetchMock(503);
    installRandomUuidMock(NAV_A);
    const user = userEvent.setup();

    render(<ProjectHistoryProbe />);
    await user.click(screen.getByRole("button", { name: "Open history" }));

    expect(screen.getByText("History modal open")).toBeInTheDocument();
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));
    expect(productEventBodies(fetchMock)[0].event).toMatchObject({
      eventName: "project_history_viewed",
      route: "/dashboard",
      entityType: "project",
      entityId: PROJECT_ID,
    });
  });

  it("history close/reopen and project change create new logical events", async () => {
    const fetchMock = installFetchMock();
    installRandomUuidMock(NAV_A, NAV_B, "55555555-5555-4555-8555-555555555555");
    const user = userEvent.setup();

    const { rerender } = render(<ProjectHistoryProbe />);
    await user.click(screen.getByRole("button", { name: "Open history" }));
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Close history" }));
    await user.click(screen.getByRole("button", { name: "Open history" }));
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(2));

    rerender(<ProjectHistoryProbe project={projectGroup(OTHER_PROJECT_ID)} />);
    await user.click(screen.getByRole("button", { name: "Open history" }));
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(3));

    expect(productEventBodies(fetchMock).map((body) => body.event.entityId)).toEqual([
      PROJECT_ID,
      PROJECT_ID,
      OTHER_PROJECT_ID,
    ]);
  });

  it("client update open sends client_update_opened and fetch rejection does not prevent opening", async () => {
    const fetchMock = installRejectedProductEventFetchMock();
    installRandomUuidMock(NAV_A);
    const user = userEvent.setup();

    render(<ProjectUpdateProbe />);
    await user.click(screen.getByRole("button", { name: "Open update" }));

    expect(screen.getByText("Update modal open")).toBeInTheDocument();
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));
  });

  it("client update typing does not resend and reopen/project change create new logical events", async () => {
    const fetchMock = installFetchMock();
    installRandomUuidMock(NAV_A, NAV_B, "55555555-5555-4555-8555-555555555555");
    const user = userEvent.setup();

    const { rerender } = render(<ProjectUpdateProbe />);
    await user.click(screen.getByRole("button", { name: "Open update" }));
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Type update" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(productEventCalls(fetchMock)).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Close update" }));
    await user.click(screen.getByRole("button", { name: "Open update" }));
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(2));

    rerender(<ProjectUpdateProbe project={projectGroup(OTHER_PROJECT_ID)} />);
    await user.click(screen.getByRole("button", { name: "Open update" }));
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(3));

    expect(productEventBodies(fetchMock).map((body) => body.event.entityId)).toEqual([
      PROJECT_ID,
      PROJECT_ID,
      OTHER_PROJECT_ID,
    ]);
  });
});
