// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AiProjectReviewPanel from "./ai-project-review-panel";
import type { PreviewProjectGroup } from "../editable-preview-list";
import {
  formatDateOnlyForDisplay,
  localDateToDateOnly,
  todayDateOnly,
} from "@/lib/tasks/date-only";

type PreviewItem = PreviewProjectGroup["items"][number]["preview"];

function offsetFromToday(offsetDays: number) {
  const now = new Date();
  const shifted = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
    12,
    0,
    0,
    0
  );
  return localDateToDateOnly(shifted);
}

function buildPreviewItem(overrides: Partial<PreviewItem> = {}): PreviewItem {
  return {
    previewId: "preview-1",
    client: "Acme Co",
    task: "Ship homepage",
    amount: "",
    deadline: "",
    priority: "Medium",
    status: "Not Started",
    source: "Text extraction",
    deadline_date: null,
    deadline_original_text: null,
    ...overrides,
  };
}

function buildGroup(
  overrides: Partial<PreviewProjectGroup> = {},
  items?: PreviewProjectGroup["items"]
): PreviewProjectGroup {
  const resolvedItems =
    items ??
    ([
      { preview: buildPreviewItem({ previewId: "preview-0" }), originalIndex: 0 },
      { preview: buildPreviewItem({ previewId: "preview-1" }), originalIndex: 3 },
    ] as PreviewProjectGroup["items"]);

  return {
    key: "group-1",
    clientName: "Acme Co",
    contactName: "",
    projectTitle: "Homepage project",
    projectSummary: "",
    amount: "",
    deadline: "",
    deadlineDate: null,
    priority: "Medium",
    prioritySource: "unknown",
    source: "Text extraction",
    client_phone: "",
    client_email: "",
    client_notes: "",
    items: resolvedItems,
    ...overrides,
  };
}

describe("AiProjectReviewPanel deadline field (DeadlineField integration)", () => {
  it("derives and displays the correct date from group.deadlineDate", () => {
    const value = offsetFromToday(10);
    const group = buildGroup({ deadlineDate: value });

    render(
      <AiProjectReviewPanel
        groupIndex={0}
        group={group}
        aiMetaByPreviewId={{}}
        onChange={vi.fn()}
        onRemovePreviewItem={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Deadline")).toHaveTextContent(
      formatDateOnlyForDisplay(value)
    );
  });

  it("shows the placeholder when group.deadlineDate is null", () => {
    const group = buildGroup({ deadlineDate: null });

    render(
      <AiProjectReviewPanel
        groupIndex={0}
        group={group}
        aiMetaByPreviewId={{}}
        onChange={vi.fn()}
        onRemovePreviewItem={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Deadline")).toHaveTextContent(
      "Set a deadline"
    );
  });

  it("fans a picker commit out to every item in the group via field \"deadline_date\", never \"deadline\"", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const previewA = buildPreviewItem({
      previewId: "preview-a",
      deadline_original_text: "next Friday",
      deadline: "08/14/26",
    });
    const previewB = buildPreviewItem({
      previewId: "preview-b",
      deadline_original_text: "next Friday",
      deadline: "08/14/26",
    });
    const group = buildGroup({ deadlineDate: null }, [
      { preview: previewA, originalIndex: 0 },
      { preview: previewB, originalIndex: 5 },
    ]);

    render(
      <AiProjectReviewPanel
        groupIndex={0}
        group={group}
        aiMetaByPreviewId={{}}
        onChange={onChange}
        onRemovePreviewItem={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText("Deadline"));
    await user.click(screen.getByRole("button", { name: "Today" }));

    // Exactly one commit per item in the group -- the existing
    // "one deadline per group, applied to every subtask" fan-out.
    expect(onChange).toHaveBeenCalledTimes(2);

    const today = todayDateOnly();

    for (const [index, field, value] of onChange.mock.calls) {
      expect([0, 5]).toContain(index);
      // Committed through "deadline_date" (the generic, provenance-preserving
      // fallback in updatePreviewItem), never the free-text "deadline" field
      // that would re-derive/clobber deadline_original_text.
      expect(field).toBe("deadline_date");
      expect(value).toBe(today);
    }

    expect(
      onChange.mock.calls.some(([, field]) => field === "deadline")
    ).toBe(false);
    expect(
      onChange.mock.calls.some(([, field]) => field === "deadline_original_text")
    ).toBe(false);
  });

  it('commits an empty string ("" cleared sentinel) through "deadline_date" on Clear, without touching "deadline"/"deadline_original_text"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value = offsetFromToday(4);
    const preview = buildPreviewItem({
      deadline_date: value,
      deadline_original_text: "next Friday",
      deadline: "08/14/26",
    });
    const group = buildGroup({ deadlineDate: value }, [
      { preview, originalIndex: 2 },
    ]);

    render(
      <AiProjectReviewPanel
        groupIndex={0}
        group={group}
        aiMetaByPreviewId={{}}
        onChange={onChange}
        onRemovePreviewItem={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText("Deadline"));
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2, "deadline_date", "");
    expect(
      onChange.mock.calls.some(([, field]) => field === "deadline")
    ).toBe(false);
    expect(
      onChange.mock.calls.some(([, field]) => field === "deadline_original_text")
    ).toBe(false);
  });
});
