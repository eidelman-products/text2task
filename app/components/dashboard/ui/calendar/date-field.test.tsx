// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  formatDateOnlyForDisplay,
  localDateToDateOnly,
  parseDateOnly,
  todayDateOnly,
  type DateOnly,
} from "@/lib/tasks/date-only";
import { DateField } from "./date-field";

/*
  Builds a DateOnly string for "today shifted by `offsetDays`", guaranteed
  distinct from today for any non-zero offset, via real `Date` arithmetic
  (never string slicing/`.toISOString()`), matching this repo's date-only
  safety rules.
*/
function offsetFromToday(offsetDays: number): DateOnly {
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

function getDayCellButton(dateOnly: DateOnly): HTMLElement {
  const cell = document.querySelector(`[data-day="${dateOnly}"]`);
  if (!cell) {
    throw new Error(`No calendar day cell found for ${dateOnly}`);
  }
  const button = cell.querySelector("button");
  if (!button) {
    throw new Error(`Day cell for ${dateOnly} has no button`);
  }
  return button as HTMLElement;
}

describe("DateField", () => {
  it("renders a labeled trigger and opens the picker on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateField value={null} onChange={onChange} label="Deadline" />);

    const trigger = screen.getByLabelText("Deadline");
    expect(trigger).toHaveTextContent("Set a date");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(
      screen.getByRole("dialog", { name: "Choose deadline date" })
    ).toBeInTheDocument();
  });

  it("displays the correct currently-selected date on the trigger", () => {
    const value = offsetFromToday(2);
    render(
      <DateField value={value} onChange={vi.fn()} label="Deadline" />
    );

    expect(screen.getByLabelText("Deadline")).toHaveTextContent(
      formatDateOnlyForDisplay(value)
    );
  });

  it("selecting a different day commits exactly once and closes the popover", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateField value={null} onChange={onChange} label="Deadline" />);

    await user.click(screen.getByLabelText("Deadline"));
    const target = offsetFromToday(3);
    const dayButton = getDayCellButton(target);

    await user.click(dayButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(target);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("supports month navigation via next/previous buttons", async () => {
    const user = userEvent.setup();
    render(<DateField value={null} onChange={vi.fn()} label="Deadline" />);

    await user.click(screen.getByLabelText("Deadline"));

    const monthSelect = screen.getByRole("combobox", {
      name: "Choose the Month",
    }) as HTMLSelectElement;
    const initialMonth = monthSelect.value;

    await user.click(
      screen.getByRole("button", { name: "Go to the Next Month" })
    );
    expect(monthSelect.value).not.toBe(initialMonth);

    await user.click(
      screen.getByRole("button", { name: "Go to the Previous Month" })
    );
    expect(monthSelect.value).toBe(initialMonth);
  });

  it("supports jumping to a far-future year via the year dropdown", async () => {
    const user = userEvent.setup();
    render(<DateField value={null} onChange={vi.fn()} label="Deadline" />);

    await user.click(screen.getByLabelText("Deadline"));

    const yearSelect = screen.getByRole("combobox", {
      name: "Choose the Year",
    }) as HTMLSelectElement;
    const targetYear = String(new Date().getFullYear() + 5);

    await user.selectOptions(yearSelect, targetYear);

    expect(yearSelect.value).toBe(targetYear);
  });

  it("Today action commits today's date exactly once and closes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value = offsetFromToday(10);
    render(<DateField value={value} onChange={onChange} label="Deadline" />);

    await user.click(screen.getByLabelText("Deadline"));
    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(todayDateOnly());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Clear action commits null exactly once and closes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value = offsetFromToday(4);
    render(<DateField value={value} onChange={onChange} label="Deadline" />);

    await user.click(screen.getByLabelText("Deadline"));
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not render a Clear action when clearable is false", async () => {
    const user = userEvent.setup();
    render(
      <DateField
        value={offsetFromToday(1)}
        onChange={vi.fn()}
        label="Deadline"
        clearable={false}
      />
    );

    await user.click(screen.getByLabelText("Deadline"));
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("Escape closes without committing and value is unchanged", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateField value={null} onChange={onChange} label="Deadline" />);

    const trigger = screen.getByLabelText("Deadline");
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returns focus to the trigger after Escape", async () => {
    const user = userEvent.setup();
    render(<DateField value={null} onChange={vi.fn()} label="Deadline" />);

    const trigger = screen.getByLabelText("Deadline");
    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(trigger).toHaveFocus();
  });

  it("clicking outside the panel closes without committing, and returns focus", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateField value={null} onChange={onChange} label="Deadline" />);

    const trigger = screen.getByLabelText("Deadline");
    await user.click(trigger);

    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement;
    if (!overlay) throw new Error("overlay element not found");

    await user.click(overlay);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("returns focus to the trigger after a committed selection", async () => {
    const user = userEvent.setup();
    render(<DateField value={null} onChange={vi.fn()} label="Deadline" />);

    const trigger = screen.getByLabelText("Deadline");
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(trigger).toHaveFocus();
  });

  it("disabled state prevents opening the picker", async () => {
    const user = userEvent.setup();
    render(
      <DateField value={null} onChange={vi.fn()} label="Deadline" disabled />
    );

    const trigger = screen.getByLabelText("Deadline");
    expect(trigger).toBeDisabled();

    await user.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loading state prevents opening and shows a loading affordance", async () => {
    const user = userEvent.setup();
    render(
      <DateField value={null} onChange={vi.fn()} label="Deadline" loading />
    );

    const trigger = screen.getByLabelText("Deadline");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent("Saving...");

    await user.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("supports a full keyboard-only selection flow with no mouse events", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateField value={null} onChange={onChange} label="Deadline" />);

    const trigger = screen.getByLabelText("Deadline");
    trigger.focus();
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // DayPicker's `autoFocus` already moved DOM focus onto today's cell.
    // Move three days forward via ArrowRight (verified against
    // node_modules/react-day-picker/dist/esm/DayPicker.js's keyMap) and
    // commit with Enter -- no pointer/mouse interaction anywhere in this test.
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{Enter}");

    const expected = offsetFromToday(3);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expected);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("exposes an accessible label for the trigger", () => {
    render(<DateField value={null} onChange={vi.fn()} label="Deadline" />);

    const trigger = screen.getByRole("button", { name: "Deadline" });
    expect(trigger).toBeInTheDocument();
  });

  it("announces the selected date for screen readers using the unambiguous a11y format", async () => {
    const user = userEvent.setup();
    render(<DateField value={null} onChange={vi.fn()} label="Deadline" />);

    await user.click(screen.getByLabelText("Deadline"));
    await user.click(screen.getByRole("button", { name: "Today" }));

    const today = todayDateOnly();
    expect(parseDateOnly(today)).not.toBeNull();
    // The visually-hidden live region announces via formatDateOnlyForA11y,
    // never the ambiguous MM/DD/YY format -- assert the full month name is
    // present rather than re-deriving the exact string here.
    expect(screen.getByText(/Selected [A-Z][a-z]+ \d{1,2}, \d{4}/)).toBeInTheDocument();
  });

  it("[Work Calendar mobile corrective pass] retains its own navigation and month/year caption unchanged -- DateField never passes hideNavigation/hideCaption", async () => {
    const user = userEvent.setup();
    render(<DateField value={null} onChange={vi.fn()} label="Deadline" />);

    await user.click(screen.getByLabelText("Deadline"));

    // Both of Calendar's own nav buttons and both dropdown selects remain
    // present -- proving the new, additive `hideNavigation`/`hideCaption`
    // props (added for the Work Calendar's mobile compact selector) default
    // to false/undefined and leave every other caller of the shared
    // Calendar primitive completely unaffected.
    expect(screen.getByRole("button", { name: "Go to the Previous Month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to the Next Month" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Choose the Month" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Choose the Year" })).toBeInTheDocument();
  });
});
