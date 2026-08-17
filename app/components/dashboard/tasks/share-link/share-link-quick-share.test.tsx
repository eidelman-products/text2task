// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { TaskResource } from "../../resources/resource-api";
import type { TaskProjectGroup, TaskProjectSubtask } from "../task-types";
import { ShareLinkQuickShare } from "./share-link-quick-share";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const LINK_ID = "22222222-2222-4222-8222-222222222222";

function subtask(overrides: Partial<TaskProjectSubtask> = {}): TaskProjectSubtask {
  return {
    id: 1,
    project_id: PROJECT_ID,
    title: "Design hero",
    status: "New",
    priority: "Medium",
    amount: "",
    deadline: "",
    ...overrides,
  };
}

function project(subtasks: TaskProjectSubtask[] = []): TaskProjectGroup {
  return {
    key: `project::${PROJECT_ID}`,
    project_id: PROJECT_ID,
    project: null,
    clientName: "Acme",
    projectTitle: "Website launch",
    projectSummary: "",
    tasks: [],
    subtasks,
    primaryTask: {
      id: 1,
      client: null,
      project: null,
      task: "Design hero",
      amount: "",
      deadline: "",
      priority: "Medium",
      status: "New",
      source: "manual",
      project_id: PROJECT_ID,
      created_at: "2026-08-03T10:00:00.000Z",
    },
    taskIds: subtasks.map((s) => s.id),
    amount: "",
    deadline: "",
    priority: "Medium",
    status: "New",
    source: "manual",
    hasContactDetails: false,
    subtaskCount: subtasks.length,
    completedSubtaskCount: 0,
  };
}

function resource(overrides: Partial<TaskResource> = {}): TaskResource {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_id: "user-1",
    project_id: PROJECT_ID,
    task_id: null,
    resource_type: "link",
    title: "Brand brief",
    url: "https://example.com/brief",
    storage_path: null,
    file_name: null,
    mime_type: null,
    size_bytes: null,
    notes: null,
    created_at: "2026-08-03T10:00:00.000Z",
    updated_at: "2026-08-03T10:00:00.000Z",
    ...overrides,
  };
}

function link(overrides: Record<string, unknown> = {}) {
  return {
    id: LINK_ID,
    publicId: "abcdefgh12345678ijklmnop",
    state: "active" as const,
    expiresAt: null,
    hasPin: false,
    commentsEnabled: false,
    clientFacingSubtitle: null,
    contentDirection: "auto" as const,
    titleVisible: true,
    statusVisible: true,
    targetDateVisible: false,
    configurationVersion: 1,
    createdAt: "2026-08-10T00:00:00Z",
    activatedAt: "2026-08-10T00:00:00Z",
    disabledAt: null,
    rotatedAt: null,
    lastViewedAt: null,
    viewCount: 0,
    ...overrides,
  };
}

type Props = ComponentProps<typeof ShareLinkQuickShare>;

function renderQuickShare(overrides: Partial<Props> = {}) {
  const onShare = vi.fn();
  const defaultProps: Props = {
    link: null,
    mappedTasks: [],
    mappedResources: [],
    project: project(),
    resources: [],
    resourcesLoading: false,
    pending: false,
    disabled: false,
    onShare,
    ...overrides,
  };
  const view = render(<ShareLinkQuickShare {...defaultProps} />);
  return { onShare, ...view };
}

describe("ShareLinkQuickShare - progress preview", () => {
  it("previews the automatic default grouping when no link/mapping exists yet", () => {
    renderQuickShare({
      project: project([subtask({ id: 1, status: "Done" }), subtask({ id: 2, status: "New" })]),
    });

    expect(screen.getByText("50% complete")).toBeInTheDocument();
    expect(screen.getByText(/1 completed/)).toBeInTheDocument();
    expect(screen.getByText(/1 coming up/)).toBeInTheDocument();
  });

  it("shows a friendly empty state when the project has no tasks", () => {
    renderQuickShare({ project: project([]) });
    expect(screen.getByText(/this project has no tasks yet/i)).toBeInTheDocument();
  });

  it("previews the persisted mapping once one exists, not a fresh automatic recompute", () => {
    renderQuickShare({
      project: project([subtask({ id: 1, status: "New" })]),
      mappedTasks: [{ subtaskId: "1", publicGroup: "completed", waitingForClientFeedback: false, displayOrder: 0 }],
    });

    expect(screen.getByText("100% complete")).toBeInTheDocument();
  });
});

describe("ShareLinkQuickShare - Share update submission", () => {
  it("submits the typed client update body, and an empty PIN/attachment selection", async () => {
    const { onShare } = renderQuickShare();

    await userEvent.type(
      screen.getByPlaceholderText(/optional message to your client/i),
      "Homepage is live."
    );
    await userEvent.click(screen.getByRole("button", { name: /^share update$/i }));

    expect(onShare).toHaveBeenCalledWith({
      updateBody: "Homepage is live.",
      pin: null,
      clearPin: false,
      attachmentResourceIds: [],
    });
  });

  it("sharing with an empty update body still works (update is optional)", async () => {
    const { onShare } = renderQuickShare();
    await userEvent.click(screen.getByRole("button", { name: /^share update$/i }));
    expect(onShare).toHaveBeenCalledWith({
      updateBody: "",
      pin: null,
      clearPin: false,
      attachmentResourceIds: [],
    });
  });
});

describe("ShareLinkQuickShare - Attachments", () => {
  it("offers shareable Resources and excludes Notes from the picker", async () => {
    renderQuickShare({
      resources: [
        resource({ id: "r1", title: "Link resource", resource_type: "link" }),
        resource({ id: "r2", title: "Note resource", resource_type: "note", url: null }),
      ],
    });

    await userEvent.click(screen.getByRole("button", { name: /add attachment/i }));

    expect(screen.getByText("Link resource")).toBeInTheDocument();
    expect(screen.queryByText("Note resource")).not.toBeInTheDocument();
  });

  it("pre-checks Resources that are already mapped", async () => {
    renderQuickShare({
      resources: [resource({ id: "r1", title: "Brand brief" })],
      mappedResources: [{ resourceId: "r1", publicLabel: "Brand brief", canDownload: false, displayOrder: 0 }],
    });

    await userEvent.click(screen.getByRole("button", { name: /1 attachment selected/i }));
    expect(screen.getByRole("checkbox", { name: "Brand brief" })).toBeChecked();
  });

  it("selecting an attachment includes its id in the Share update submission", async () => {
    const { onShare } = renderQuickShare({
      resources: [resource({ id: "r1", title: "Brand brief" })],
    });

    await userEvent.click(screen.getByRole("button", { name: /add attachment/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Brand brief" }));
    await userEvent.click(screen.getByRole("button", { name: /^share update$/i }));

    expect(onShare).toHaveBeenCalledWith({
      updateBody: "",
      pin: null,
      clearPin: false,
      attachmentResourceIds: ["r1"],
    });
  });
});

describe("ShareLinkQuickShare - PIN: one checkbox is the enable/disable control (final PIN UX turn)", () => {
  it("1. no PIN -> checkbox unchecked", () => {
    renderQuickShare({ link: link({ hasPin: false }) });
    expect(screen.getByRole("checkbox", { name: /protect with a pin/i })).not.toBeChecked();
  });

  it("2. existing PIN -> checkbox checked, and the existing PIN value is never shown or fetched", () => {
    renderQuickShare({ link: link({ hasPin: true }) });
    const checkbox = screen.getByRole("checkbox", { name: /protect with a pin/i });
    expect(checkbox).toBeChecked();
    // No PIN input renders at all for an already-protected, untouched
    // link -- there is nothing to type, and the persisted PIN is never
    // retrieved in plaintext to populate one.
    expect(screen.queryByLabelText(/^pin$/i)).not.toBeInTheDocument();
  });

  it("3. unchecked -> checked -> PIN input appears (enabling a brand-new PIN)", async () => {
    renderQuickShare({ link: link({ hasPin: false }) });
    expect(screen.queryByLabelText(/^pin$/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: /protect with a pin/i }));

    expect(screen.getByLabelText(/^pin$/i)).toBeInTheDocument();
  });

  it("does not include a PIN by default", async () => {
    const { onShare } = renderQuickShare({ link: null });
    await userEvent.click(screen.getByRole("button", { name: /^share update$/i }));
    expect(onShare.mock.calls[0][0].pin).toBeNull();
    expect(onShare.mock.calls[0][0].clearPin).toBe(false);
  });

  it("4. enabling PIN + Share update sends the freshly-typed PIN, and clearPin is false", async () => {
    const { onShare } = renderQuickShare({ link: link({ hasPin: false }) });

    await userEvent.click(screen.getByRole("checkbox", { name: /protect with a pin/i }));
    await userEvent.type(screen.getByLabelText(/^pin$/i), "4242");
    await userEvent.click(screen.getByRole("button", { name: /^share update$/i }));

    expect(onShare.mock.calls[0][0].pin).toBe("4242");
    expect(onShare.mock.calls[0][0].clearPin).toBe(false);
  });

  it("rejects an invalid PIN client-side without calling onShare", async () => {
    const { onShare } = renderQuickShare({ link: link({ hasPin: false }) });

    await userEvent.click(screen.getByRole("checkbox", { name: /protect with a pin/i }));
    await userEvent.type(screen.getByLabelText(/^pin$/i), "12");
    await userEvent.click(screen.getByRole("button", { name: /^share update$/i }));

    expect(onShare).not.toHaveBeenCalled();
    expect(screen.getByText(/4-6 digits/i)).toBeInTheDocument();
  });

  it("5. existing PIN -> unchecked -> Share update sends clearPin: true and no pin value", async () => {
    const { onShare } = renderQuickShare({ link: link({ hasPin: true }) });

    await userEvent.click(screen.getByRole("checkbox", { name: /protect with a pin/i }));
    await userEvent.click(screen.getByRole("button", { name: /^share update$/i }));

    expect(onShare.mock.calls[0][0]).toMatchObject({ pin: null, clearPin: true });
  });

  it("leaving an already-protected link's checkbox checked (untouched) sends neither pin nor clearPin", async () => {
    const { onShare } = renderQuickShare({ link: link({ hasPin: true }) });

    await userEvent.click(screen.getByRole("button", { name: /^share update$/i }));

    expect(onShare.mock.calls[0][0]).toMatchObject({ pin: null, clearPin: false });
  });

  it("re-checking after unchecking an already-protected link cancels the pending disable (no PIN input, no clearPin)", async () => {
    const { onShare } = renderQuickShare({ link: link({ hasPin: true }) });
    const checkbox = screen.getByRole("checkbox", { name: /protect with a pin/i });

    await userEvent.click(checkbox); // uncheck -> would disable
    await userEvent.click(checkbox); // re-check -> back to "leave as-is"
    expect(screen.queryByLabelText(/^pin$/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^share update$/i }));
    expect(onShare.mock.calls[0][0]).toMatchObject({ pin: null, clearPin: false });
  });

  it("10. reopening resets the checkbox to the link's own current hasPin, never leaking or reusing a stale local draft", () => {
    const { rerender } = renderQuickShare({ link: link({ hasPin: false, configurationVersion: 1 }) });
    expect(screen.getByRole("checkbox", { name: /protect with a pin/i })).not.toBeChecked();

    rerender(
      <ShareLinkQuickShare
        link={link({ hasPin: true, configurationVersion: 2 })}
        mappedTasks={[]}
        mappedResources={[]}
        project={project()}
        resources={[]}
        resourcesLoading={false}
        pending={false}
        disabled={false}
        onShare={vi.fn()}
      />
    );

    expect(screen.getByRole("checkbox", { name: /protect with a pin/i })).toBeChecked();
  });
});

describe("ShareLinkQuickShare - final simplification: no secondary entry points (real browser defect #3 turn)", () => {
  it("never renders 'Edit what client sees', 'Manage link', or any other advanced/settings entry point, whether or not a link exists", () => {
    const { rerender } = renderQuickShare({ link: null });

    for (const forbidden of [
      /edit what client sees/i,
      /^manage link$/i,
      /^advanced$/i,
      /^more options$/i,
      /^settings$/i,
    ]) {
      expect(screen.queryByRole("button", { name: forbidden })).not.toBeInTheDocument();
    }

    rerender(
      <ShareLinkQuickShare
        link={link()}
        mappedTasks={[]}
        mappedResources={[]}
        project={project()}
        resources={[]}
        resourcesLoading={false}
        pending={false}
        disabled={false}
        onShare={vi.fn()}
      />
    );

    for (const forbidden of [
      /edit what client sees/i,
      /^manage link$/i,
      /^advanced$/i,
      /^more options$/i,
      /^settings$/i,
    ]) {
      expect(screen.queryByRole("button", { name: forbidden })).not.toBeInTheDocument();
    }
  });

  it("never renders lifecycle/technical terminology (Draft, Activate link, Revoke link, Set expiry, Text direction, Allow client comments, Save configuration)", () => {
    renderQuickShare({ link: link() });

    for (const forbidden of [
      /^draft$/i,
      /activate link/i,
      /revoke link/i,
      /set expiry/i,
      /text direction/i,
      /allow client comments/i,
      /save configuration/i,
    ]) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
    }
  });

  it("does not render a duplicate 'Share project update' heading -- the dialog's own 'Share with client' heading is the only title", () => {
    renderQuickShare();
    expect(screen.queryByText(/share project update/i)).not.toBeInTheDocument();
  });
});
