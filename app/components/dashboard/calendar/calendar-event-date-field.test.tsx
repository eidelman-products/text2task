// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { localDateToDateOnly, parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { CalendarEventDateField } from "./calendar-event-date-field";

function anotherDayInCurrentMonth(): DateOnly {
  const now = new Date();
  const targetDay = now.getDate() === 1 ? 2 : 1;
  const target = new Date(now.getFullYear(), now.getMonth(), targetDay, 12, 0, 0, 0);
  return localDateToDateOnly(target);
}

function getDayCellButton(dateOnly: DateOnly): HTMLElement {
  const cell = document.querySelector(`[data-day="${dateOnly}"]`);
  if (!cell) throw new Error(`No calendar day cell found for ${dateOnly}`);
  const button = cell.querySelector("button");
  if (!button) throw new Error(`Day cell for ${dateOnly} has no button`);
  return button as HTMLElement;
}

describe("CalendarEventDateField", () => {
  it("renders a trigger labeled 'Date'", () => {
    render(<CalendarEventDateField value={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
  });

  it("displays the currently-selected value", () => {
    const value = parseDateOnly("2027-03-15")!;
    render(<CalendarEventDateField value={value} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Date")).toHaveTextContent("Mar 15, 2027");
  });

  it("calls onChange with the selected date, uncoerced", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CalendarEventDateField value={null} onChange={onChange} />);

    await user.click(screen.getByLabelText("Date"));
    const target = anotherDayInCurrentMonth();
    await user.click(getDayCellButton(target));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(target);
  });

  it("forwards disabled to the underlying trigger", () => {
    render(<CalendarEventDateField value={null} onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText("Date")).toBeDisabled();
  });

  it("forwards aria-describedby to the underlying trigger", () => {
    render(
      <CalendarEventDateField value={null} onChange={vi.fn()} aria-describedby="date-error" />
    );
    expect(screen.getByLabelText("Date")).toHaveAttribute("aria-describedby", "date-error");
  });

  it("marks the wrapper data-invalid when invalid", () => {
    const { container } = render(
      <CalendarEventDateField value={null} onChange={vi.fn()} invalid />
    );
    expect(container.querySelector("div")).toHaveAttribute("data-invalid", "true");
  });

  it("does not set data-invalid on the wrapper when valid", () => {
    const { container } = render(<CalendarEventDateField value={null} onChange={vi.fn()} />);
    expect(container.querySelector("div")).not.toHaveAttribute("data-invalid");
  });
});
