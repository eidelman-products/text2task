// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { CalendarToolbar } from "./calendar-toolbar";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid DateOnly`);
  return parsed;
}

describe("CalendarToolbar", () => {
  it("renders Previous/Today/Next as real buttons with accessible names including destination month", () => {
    render(
      <CalendarToolbar
        visibleMonth={toDateOnly("2026-07-16")}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Previous month, June 2026" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next month, August 2026" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to today" })).toBeInTheDocument();
  });

  it("calls onPrevious, onToday, onNext when their respective buttons are clicked", async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const onToday = vi.fn();

    render(
      <CalendarToolbar
        visibleMonth={toDateOnly("2026-07-16")}
        onPrevious={onPrevious}
        onNext={onNext}
        onToday={onToday}
      />
    );

    await user.click(screen.getByRole("button", { name: "Previous month, June 2026" }));
    expect(onPrevious).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Next month, August 2026" }));
    expect(onNext).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Go to today" }));
    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it("renders the visible month + year text inside an aria-live=polite region", () => {
    render(
      <CalendarToolbar
        visibleMonth={toDateOnly("2026-07-16")}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />
    );

    const label = screen.getByText("July 2026");
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute("aria-live", "polite");
  });

  it("updates the destination-month labels and visible label when visibleMonth changes (December -> January year rollover)", () => {
    render(
      <CalendarToolbar
        visibleMonth={toDateOnly("2026-12-01")}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Previous month, November 2026" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next month, January 2027" })
    ).toBeInTheDocument();
    expect(screen.getByText("December 2026")).toBeInTheDocument();
  });

  it("has exactly three buttons, none disabled, and no nested interactive elements", () => {
    render(
      <CalendarToolbar
        visibleMonth={toDateOnly("2026-07-16")}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);

    for (const button of buttons) {
      expect(button).not.toBeDisabled();
      expect(button.querySelector("button, a, input, select, textarea")).toBeNull();
    }
  });

  it("uses aria-hidden decorative glyphs for the arrows, not accessible text", () => {
    render(
      <CalendarToolbar
        visibleMonth={toDateOnly("2026-07-16")}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />
    );

    const previousButton = screen.getByRole("button", { name: "Previous month, June 2026" });
    const glyph = previousButton.querySelector("[aria-hidden='true']");
    expect(glyph).not.toBeNull();
  });
});
