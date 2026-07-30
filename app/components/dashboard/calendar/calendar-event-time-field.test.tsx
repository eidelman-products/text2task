// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { parseTimeOnly } from "@/lib/calendar/time-only";
import { CalendarEventTimeField } from "./calendar-event-time-field";

describe("CalendarEventTimeField", () => {
  it("renders a native time input labeled 'Time'", () => {
    render(<CalendarEventTimeField value={null} onChange={vi.fn()} />);
    const input = screen.getByLabelText("Time");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "time");
  });

  it("displays the current TimeOnly value", () => {
    const value = parseTimeOnly("14:30")!;
    render(<CalendarEventTimeField value={value} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Time")).toHaveValue("14:30");
  });

  it("calls onChange with null when cleared to an empty string", () => {
    const onChange = vi.fn();
    const value = parseTimeOnly("09:00")!;
    render(<CalendarEventTimeField value={value} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange with a valid TimeOnly for a real HH:MM value", () => {
    const onChange = vi.fn();
    render(<CalendarEventTimeField value={null} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "09:05" } });

    expect(onChange).toHaveBeenCalledWith("09:05");
  });

  it("forwards disabled", () => {
    render(<CalendarEventTimeField value={null} onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText("Time")).toBeDisabled();
  });

  it("sets aria-invalid and aria-describedby when invalid", () => {
    render(
      <CalendarEventTimeField value={null} onChange={vi.fn()} invalid aria-describedby="time-error" />
    );
    const input = screen.getByLabelText("Time");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "time-error");
  });

  it("does not set aria-invalid when valid", () => {
    render(<CalendarEventTimeField value={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Time")).not.toHaveAttribute("aria-invalid");
  });
});
