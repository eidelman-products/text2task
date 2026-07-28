// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProjectUpdateReviewCard from "./project-update-review-card";
import type {
  JsonRecord,
  ProjectUpdateFormState,
  SuggestedProjectUpdateItem,
} from "./project-update-types";
import { formatDateOnlyForDisplay, localDateToDateOnly } from "@/lib/tasks/date-only";

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

function buildDeadlineChangeItem(
  overrides: Partial<SuggestedProjectUpdateItem> = {}
): SuggestedProjectUpdateItem {
  return {
    id: "item-1",
    project_update_id: "update-1",
    project_id: "project-1",
    target_task_id: null,
    type: "deadline_change",
    title: "Update project deadline",
    description: null,
    target_field: "deadline",
    old_value: { deadline_text: "ASAP", deadline_date: null },
    new_value: { deadline_text: "tomorrow" },
    confidence: 0.9,
    status: "suggested",
    ai_reason: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function buildFormState(
  item: SuggestedProjectUpdateItem,
  overrides: Partial<ProjectUpdateFormState> = {}
): ProjectUpdateFormState {
  return {
    rawInput: "Deadline moved to next week",
    inputMethod: "text",
    selectedImage: null,
    imageError: null,
    isAnalyzing: false,
    isApplying: false,
    analysisError: null,
    applyError: null,
    applyDuplicate: null,
    applySuccessMessage: null,
    analysisResult: {
      update: {
        id: "update-1",
        project_id: "project-1",
        client_id: null,
        source_type: "text",
        raw_input: "Deadline moved to next week",
        ai_summary: null,
        status: "analyzed",
        created_at: new Date().toISOString(),
        analyzed_at: new Date().toISOString(),
      },
      items: [item],
      timelineEvent: null,
      analysis: { headline: "Deadline change detected" },
    },
    selectedItemIds: [item.id],
    editedItemValues: {},
    applyPlaceholderMessage: null,
    ...overrides,
  };
}

async function openDeadlineEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Edit saved details"));
  await user.click(screen.getByLabelText("Suggested deadline"));
}

describe("ProjectUpdateReviewCard deadline_change integration", () => {
  it("displays the current deadline from a canonical deadline_date", async () => {
    const user = userEvent.setup();
    const currentValue = offsetFromToday(-3);
    const item = buildDeadlineChangeItem({
      old_value: { deadline_text: "March 1, 2020", deadline_date: currentValue },
    });

    render(
      <ProjectUpdateReviewCard
        form={buildFormState(item)}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={vi.fn()}
      />
    );

    await user.click(screen.getByText("Edit saved details"));

    const label = screen.getByText("Current deadline");
    expect(label.nextElementSibling).toHaveTextContent(
      formatDateOnlyForDisplay(currentValue)
    );
  });

  it("preserves the raw current-deadline text when it does not resolve to a canonical date", async () => {
    const user = userEvent.setup();
    const item = buildDeadlineChangeItem({
      old_value: { deadline_text: "ASAP", deadline_date: null },
    });

    render(
      <ProjectUpdateReviewCard
        form={buildFormState(item)}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={vi.fn()}
      />
    );

    await user.click(screen.getByText("Edit saved details"));

    const label = screen.getByText("Current deadline");
    expect(label.nextElementSibling).toHaveTextContent("ASAP");
  });

  it("resolves natural-language AI-suggested deadline text to the picker's initial canonical value", async () => {
    const user = userEvent.setup();
    const expected = offsetFromToday(1);
    const item = buildDeadlineChangeItem({
      new_value: { deadline_text: "tomorrow" },
    });

    render(
      <ProjectUpdateReviewCard
        form={buildFormState(item)}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={vi.fn()}
      />
    );

    await user.click(screen.getByText("Edit saved details"));

    expect(screen.getByLabelText("Suggested deadline")).toHaveTextContent(
      formatDateOnlyForDisplay(expected)
    );
  });

  it("renders the field with the \"Suggested deadline\" label, not the shared component's default \"Deadline\" label", async () => {
    const user = userEvent.setup();
    const item = buildDeadlineChangeItem();

    render(
      <ProjectUpdateReviewCard
        form={buildFormState(item)}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={vi.fn()}
      />
    );

    await user.click(screen.getByText("Edit saved details"));

    expect(screen.getByLabelText("Suggested deadline")).toBeInTheDocument();
    expect(screen.queryByLabelText("Deadline")).not.toBeInTheDocument();
    // Exactly one visible occurrence of the label -- no duplicated outer
    // heading alongside the field's own label.
    expect(screen.getAllByText("Suggested deadline")).toHaveLength(1);
  });

  it("committing a picked date sends the same canonical value as both deadline_text and deadline_date", async () => {
    const user = userEvent.setup();
    const onUpdateSuggestedItemValue = vi.fn();
    const item = buildDeadlineChangeItem();

    render(
      <ProjectUpdateReviewCard
        form={buildFormState(item)}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={onUpdateSuggestedItemValue}
      />
    );

    await openDeadlineEditor(user);
    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(onUpdateSuggestedItemValue).toHaveBeenCalledTimes(2);

    const todayValue = offsetFromToday(0);
    expect(onUpdateSuggestedItemValue).toHaveBeenNthCalledWith(
      1,
      item.id,
      "deadline_text",
      todayValue
    );
    expect(onUpdateSuggestedItemValue).toHaveBeenNthCalledWith(
      2,
      item.id,
      "deadline_date",
      todayValue
    );
  });

  it("clearing the suggested deadline sends empty strings for both fields", async () => {
    const user = userEvent.setup();
    const onUpdateSuggestedItemValue = vi.fn();
    const item = buildDeadlineChangeItem({
      new_value: { deadline_text: offsetFromToday(5) },
    });

    render(
      <ProjectUpdateReviewCard
        form={buildFormState(item)}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={onUpdateSuggestedItemValue}
      />
    );

    await openDeadlineEditor(user);
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(onUpdateSuggestedItemValue).toHaveBeenCalledWith(
      item.id,
      "deadline_text",
      ""
    );
    expect(onUpdateSuggestedItemValue).toHaveBeenCalledWith(
      item.id,
      "deadline_date",
      ""
    );
  });

  it("disables the deadline picker for an unselected item", async () => {
    const user = userEvent.setup();
    const item = buildDeadlineChangeItem();

    render(
      <ProjectUpdateReviewCard
        form={buildFormState(item, { selectedItemIds: [] })}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={vi.fn()}
      />
    );

    await user.click(screen.getByText("Edit saved details"));

    expect(screen.getByLabelText("Suggested deadline")).toBeDisabled();
  });

  it("does not touch non-deadline item type rendering (priority_change stays a select field)", async () => {
    const user = userEvent.setup();
    const item: SuggestedProjectUpdateItem = {
      id: "item-2",
      project_update_id: "update-1",
      project_id: "project-1",
      target_task_id: null,
      type: "priority_change",
      title: "Update project priority",
      description: null,
      target_field: "priority",
      old_value: { priority: "Medium" },
      new_value: { priority: "High" },
      confidence: 0.8,
      status: "suggested",
      ai_reason: null,
      created_at: new Date().toISOString(),
    };

    render(
      <ProjectUpdateReviewCard
        form={buildFormState(item)}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={vi.fn()}
      />
    );

    await user.click(screen.getByText("Edit saved details"));

    expect(screen.getByText("Suggested priority")).toBeInTheDocument();
    expect(screen.queryByLabelText("Suggested deadline")).not.toBeInTheDocument();
  });
});

function buildNeedsReviewCompletionItem(
  overrides: Partial<SuggestedProjectUpdateItem> = {}
): SuggestedProjectUpdateItem {
  return {
    id: "item-review-1",
    project_update_id: "update-1",
    project_id: "project-1",
    target_task_id: 1,
    type: "needs_review",
    title: "Review before marking Design desktop and mobile landing page layouts as Done",
    description:
      "Completed: The desktop design is complete Still incomplete: the mobile layout is still in progress",
    target_field: "status",
    old_value: {
      existing_task_id: 1,
      existing_title: "Design desktop and mobile landing page layouts",
      status: "New",
    },
    new_value: {
      status: "Done",
      completed_evidence: ["The desktop design is complete"],
      incomplete_evidence: ["the mobile layout is still in progress"],
    },
    confidence: 0.9,
    status: "suggested",
    ai_reason:
      "The update contains both completed and still-incomplete evidence for this subtask, so it was not automatically marked Done.",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function buildFormStateWithItems(
  items: SuggestedProjectUpdateItem[],
  overrides: Partial<ProjectUpdateFormState> = {}
): ProjectUpdateFormState {
  return {
    rawInput: "The desktop design is complete, and the mobile layout is still in progress.",
    inputMethod: "text",
    selectedImage: null,
    imageError: null,
    isAnalyzing: false,
    isApplying: false,
    analysisError: null,
    applyError: null,
    applyDuplicate: null,
    applySuccessMessage: null,
    analysisResult: {
      update: {
        id: "update-1",
        project_id: "project-1",
        client_id: null,
        source_type: "text",
        raw_input:
          "The desktop design is complete, and the mobile layout is still in progress.",
        ai_summary: null,
        status: "analyzed",
        created_at: new Date().toISOString(),
        analyzed_at: new Date().toISOString(),
      },
      items,
      timelineEvent: null,
      analysis: { headline: "Review required" },
    },
    selectedItemIds: items.map((item) => item.id),
    editedItemValues: {},
    applyPlaceholderMessage: null,
    ...overrides,
  };
}

describe("ProjectUpdateReviewCard partial/mixed completion evidence", () => {
  it("surfaces both completed and incomplete evidence for a mixed-completion needs_review item", () => {
    const item = buildNeedsReviewCompletionItem();

    render(
      <ProjectUpdateReviewCard
        form={buildFormStateWithItems([item])}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={vi.fn()}
      />
    );

    expect(screen.getByText("Partial or conflicting completion — proposed: Done")).toBeInTheDocument();
    expect(screen.getByText("The desktop design is complete")).toBeInTheDocument();
    expect(
      screen.getByText("the mobile layout is still in progress")
    ).toBeInTheDocument();
  });

  it("labels the two evidence groups distinguishably as Completed and Still incomplete", () => {
    const item = buildNeedsReviewCompletionItem();

    render(
      <ProjectUpdateReviewCard
        form={buildFormStateWithItems([item])}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={vi.fn()}
      />
    );

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Still incomplete")).toBeInTheDocument();
  });

  it("never presents a mixed-completion item as ready-to-apply", () => {
    const item = buildNeedsReviewCompletionItem();

    render(
      <ProjectUpdateReviewCard
        form={buildFormStateWithItems([item])}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={vi.fn()}
      />
    );

    // "Will be saved" / "Not saved" only render inside ReadyUpdateRow, which
    // a needs_review item never enters.
    expect(screen.queryByText("Will be saved")).not.toBeInTheDocument();
    expect(screen.queryByText("Not saved")).not.toBeInTheDocument();
    expect(screen.getByText("Review required")).toBeInTheDocument();
  });

  it("historical needs_review rows without evidence fields still render safely via the description fallback", () => {
    const item = buildNeedsReviewCompletionItem({
      new_value: null,
      description: "Text2Task found a possible related task but wasn't confident enough.",
    });

    render(
      <ProjectUpdateReviewCard
        form={buildFormStateWithItems([item])}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "Text2Task found a possible related task but wasn't confident enough."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Partial or conflicting completion/)
    ).not.toBeInTheDocument();
  });

  it("a ready item's status field stays editable when a needs_review completion-conflict item is also present", async () => {
    const user = userEvent.setup();
    const readyItem: SuggestedProjectUpdateItem = {
      id: "item-ready-1",
      project_update_id: "update-1",
      project_id: "project-1",
      target_task_id: 2,
      type: "update_subtask",
      title: "Update contact form recipient",
      description: null,
      target_field: "task_title",
      old_value: null,
      new_value: { task_title: "Update contact form recipient" } as JsonRecord,
      confidence: 0.9,
      status: "suggested",
      ai_reason: null,
      created_at: new Date().toISOString(),
    };
    const reviewItem = buildNeedsReviewCompletionItem();

    render(
      <ProjectUpdateReviewCard
        form={buildFormStateWithItems([readyItem, reviewItem])}
        isBusy={false}
        onToggleSuggestedItem={vi.fn()}
        onUpdateSuggestedItemValue={vi.fn()}
      />
    );

    await user.click(screen.getByText("Edit saved details"));

    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(
      screen.getByText("Partial or conflicting completion — proposed: Done")
    ).toBeInTheDocument();
  });
});
