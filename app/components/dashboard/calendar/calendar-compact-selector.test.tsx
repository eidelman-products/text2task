// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { buildCalendarGridDays } from "@/lib/calendar/calendar-item-grouping";
import type { CalendarItem } from "@/lib/calendar/calendar-types";
import { CalendarCompactSelector } from "./calendar-compact-selector";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid DateOnly`);
  return parsed;
}

function deadline(id: string, date: DateOnly, title: string): CalendarItem {
  return {
    kind: "project_deadline",
    id,
    date,
    projectId: id,
    title,
    clientName: null,
    status: null,
    priority: null,
    isOverdue: false,
  };
}

function getDayCellButton(dateOnly: DateOnly): HTMLElement {
  const cell = document.querySelector(`[data-day="${dateOnly}"]`);
  if (!cell) throw new Error(`No calendar day cell found for ${dateOnly}`);
  const button = cell.querySelector("button");
  if (!button) throw new Error(`Day cell for ${dateOnly} has no button`);
  return button as HTMLElement;
}

const VISIBLE_MONTH = toDateOnly("2027-01-15");
const SELECTED = toDateOnly("2027-01-20");

function renderSelector(
  items: CalendarItem[],
  overrides: Partial<{ onSelectDate: (d: DateOnly) => void; onMonthChange: (d: DateOnly) => void }> = {}
) {
  const gridDays = buildCalendarGridDays(VISIBLE_MONTH, items);
  const onSelectDate = overrides.onSelectDate ?? vi.fn();
  const onMonthChange = overrides.onMonthChange ?? vi.fn();

  const { container } = render(
    <CalendarCompactSelector
      selectedDate={SELECTED}
      visibleMonth={VISIBLE_MONTH}
      gridDays={gridDays}
      onSelectDate={onSelectDate}
      onMonthChange={onMonthChange}
    />
  );

  return { onSelectDate, onMonthChange, container };
}

describe("CalendarCompactSelector", () => {
  it("renders the compact single-date Calendar primitive for the visible month", () => {
    renderSelector([]);
    expect(getDayCellButton(toDateOnly("2027-01-14"))).toBeInTheDocument();
  });

  it("selecting a day calls onSelectDate with that date", async () => {
    const user = userEvent.setup();
    const { onSelectDate } = renderSelector([]);

    await user.click(getDayCellButton(toDateOnly("2027-01-12")));

    expect(onSelectDate).toHaveBeenCalledWith("2027-01-12");
  });

  it("gives days with scheduled items an accessible indicator via the day's accessible label", () => {
    const day = toDateOnly("2027-01-12");
    renderSelector([deadline("project:a", day, "Website redesign")]);

    const button = getDayCellButton(day);
    expect(button.getAttribute("aria-label")).toMatch(/1 item scheduled/);
  });

  it("a day with no scheduled items has no item-count phrase in its accessible label", () => {
    renderSelector([]);

    const button = getDayCellButton(toDateOnly("2027-01-12"));
    expect(button.getAttribute("aria-label")).not.toMatch(/item/);
  });

  it("highlights the selected date", () => {
    renderSelector([]);
    const cell = document.querySelector(`[data-day="${SELECTED}"]`);
    expect(cell).toHaveAttribute("data-selected", "true");
  });
});

describe("CalendarCompactSelector - mobile clipping/duplicate-control corrective pass", () => {
  it("1. suppresses DayPicker's own Previous/Next navigation buttons", () => {
    const { container } = renderSelector([]);
    // DayPicker's own nav buttons carry an accessible name containing
    // "month" ("Go to the Previous Month" / "Go to the Next Month"); none
    // should be present -- CalendarToolbar is the sole nav control.
    expect(
      within(container).queryAllByRole("button", { name: /previous month|next month/i })
    ).toHaveLength(0);
  });

  it("2. suppresses DayPicker's own month/year caption and dropdown selects", () => {
    const { container } = renderSelector([]);
    expect(container.querySelectorAll("select")).toHaveLength(0);
    expect(within(container).queryByText("January")).not.toBeInTheDocument();
    expect(within(container).queryByText("2027")).not.toBeInTheDocument();
  });

  it("4. renders all seven weekday headings", () => {
    renderSelector([]);
    for (const label of ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("5. renders a Saturday day button, not clipped out of the DOM", () => {
    renderSelector([]);
    // January 2027: Jan 16 is a Saturday.
    expect(getDayCellButton(toDateOnly("2027-01-16"))).toBeInTheDocument();
  });

  it("6-7. scopes responsive, container-based sizing to this component only, with no fixed min-width forcing overflow", () => {
    const { container } = renderSelector([]);
    const styleTag = container.querySelector("style");
    const css = styleTag?.textContent ?? "";

    // Container-based: the grid and each day cell take a relative share of
    // the available width (not a hardcoded pixel width).
    expect(css).toMatch(/\.calendar-compact-selector \.t2t-cal-grid[^}]*table-layout:\s*fixed/);
    expect(css).toMatch(/\.calendar-compact-selector \.t2t-cal-day\b[^}]*width:\s*14\.2857%/);
    // The day button explicitly overrides the shared primitive's fixed
    // 44px min-width down to 0 so it can actually shrink on narrow phones.
    expect(css).toMatch(/\.calendar-compact-selector \.t2t-cal-day-button[^}]*min-width:\s*0/);
    expect(css).not.toMatch(/\.calendar-compact-selector \.t2t-cal-day-button[^}]*min-width:\s*44px/);

    // NOTE: jsdom does not perform real layout/paint, so this only proves
    // the responsive CSS rules exist and target the right elements -- it
    // cannot verify pixel-perfect fit at any real viewport width. Manual
    // QA at 320/360/375/390/400px (see the updated implementation report)
    // remains required to confirm the actual rendered result.
  });

  it("10. does not introduce a nested interactive element in any day cell", () => {
    renderSelector([]);
    for (const cell of document.querySelectorAll("[data-day]")) {
      const buttons = within(cell as HTMLElement).queryAllByRole("button");
      const links = within(cell as HTMLElement).queryAllByRole("link");
      expect(buttons.length).toBeLessThanOrEqual(1);
      expect(links).toHaveLength(0);
    }
  });
});
