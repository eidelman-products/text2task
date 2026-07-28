// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProjectUpdateReviewCard from "./project-update-review-card";
import type {
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
