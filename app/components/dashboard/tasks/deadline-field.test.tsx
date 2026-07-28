// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { formatDateOnlyForDisplay, localDateToDateOnly } from "@/lib/tasks/date-only";
import { DeadlineField } from "./deadline-field";

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

describe("DeadlineField", () => {
  it("uses the repo's default deadline label and placeholder copy", () => {
    render(<DeadlineField value={null} onCommit={vi.fn()} />);

    const trigger = screen.getByLabelText("Deadline");
    expect(trigger).toHaveTextContent("Set a deadline");
  });

  it("displays an already-set deadline value", () => {
    const value = offsetFromToday(7);
    render(<DeadlineField value={value} onCommit={vi.fn()} />);

    expect(screen.getByLabelText("Deadline")).toHaveTextContent(
      formatDateOnlyForDisplay(value)
    );
  });

  it("forwards a committed selection to onCommit exactly once", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<DeadlineField value={null} onCommit={onCommit} />);

    await user.click(screen.getByLabelText("Deadline"));
    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("disabled prop prevents opening the picker", async () => {
    const user = userEvent.setup();
    render(<DeadlineField value={null} onCommit={vi.fn()} disabled />);

    const trigger = screen.getByLabelText("Deadline");
    expect(trigger).toBeDisabled();

    await user.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loading prop shows the saving affordance and prevents opening", async () => {
    const user = userEvent.setup();
    render(<DeadlineField value={null} onCommit={vi.fn()} loading />);

    const trigger = screen.getByLabelText("Deadline");
    expect(trigger).toHaveTextContent("Saving...");

    await user.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("defaults the label to \"Deadline\" when no label prop is passed", () => {
    render(<DeadlineField value={null} onCommit={vi.fn()} />);

    expect(screen.getByLabelText("Deadline")).toBeInTheDocument();
  });

  it("renders a custom label when the label prop is provided", () => {
    render(
      <DeadlineField
        value={null}
        onCommit={vi.fn()}
        label="Suggested deadline"
      />
    );

    expect(screen.getByLabelText("Suggested deadline")).toBeInTheDocument();
    expect(screen.queryByLabelText("Deadline")).not.toBeInTheDocument();
    expect(screen.getByText("Suggested deadline")).toBeInTheDocument();
  });

  it("exposes a custom label to assistive technology on both the trigger and the popover dialog", async () => {
    const user = userEvent.setup();
    render(
      <DeadlineField
        value={null}
        onCommit={vi.fn()}
        label="Suggested deadline"
      />
    );

    // The trigger's accessible name comes from its associated <label>.
    const trigger = screen.getByRole("button", { name: "Suggested deadline" });
    await user.click(trigger);

    // The popover itself must also carry the custom label, not the default.
    const dialog = await screen.findByRole("dialog", {
      name: /suggested deadline/i,
    });
    expect(dialog).toBeInTheDocument();
  });

  it("does not render a duplicated outer label alongside the field's own label", () => {
    render(
      <DeadlineField
        value={null}
        onCommit={vi.fn()}
        label="Suggested deadline"
      />
    );

    // Exactly one visible occurrence of the label text -- no second/outer
    // heading duplicating it.
    expect(screen.getAllByText("Suggested deadline")).toHaveLength(1);
  });

  it("still commits a selection exactly once with a custom label, unchanged from the default-label behavior", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <DeadlineField
        value={null}
        onCommit={onCommit}
        label="Suggested deadline"
      />
    );

    await user.click(screen.getByLabelText("Suggested deadline"));
    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
