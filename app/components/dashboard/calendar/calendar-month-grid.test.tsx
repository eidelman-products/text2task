// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { buildCalendarGridDays } from "@/lib/calendar/calendar-item-grouping";
import type { CalendarItem } from "@/lib/calendar/calendar-types";
import { CalendarMonthGrid } from "./calendar-month-grid";

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

function event(id: string, date: DateOnly, title: string): CalendarItem {
  return {
    kind: "manual_event",
    id,
    date,
    time: null,
    title,
    notes: null,
    projectId: null,
    projectTitle: null,
    clientId: null,
    clientName: null,
  };
}

const VISIBLE_MONTH = toDateOnly("2027-01-15");
const TODAY = toDateOnly("2027-01-10");
const SELECTED = toDateOnly("2027-01-20");

function renderGrid(items: CalendarItem[], overrides: Partial<{ onSelectDate: (d: DateOnly) => void; onMonthChange: (d: DateOnly) => void }> = {}) {
  const gridDays = buildCalendarGridDays(VISIBLE_MONTH, items);
  const onSelectDate = overrides.onSelectDate ?? vi.fn();
  const onMonthChange = overrides.onMonthChange ?? vi.fn();

  render(
    <CalendarMonthGrid
      visibleMonth={VISIBLE_MONTH}
      selectedDate={SELECTED}
      today={TODAY}
      gridDays={gridDays}
      onSelectDate={onSelectDate}
      onMonthChange={onMonthChange}
    />
  );

  return { onSelectDate, onMonthChange };
}

describe("CalendarMonthGrid", () => {
  it("renders weekday headings", () => {
    renderGrid([]);
    expect(screen.getByText("Su")).toBeInTheDocument();
    expect(screen.getByText("Sa")).toBeInTheDocument();
  });

  it("marks today and the selected day accessibly, not only via color", () => {
    renderGrid([]);

    const todayButton = screen.getByRole("button", { name: /January 10, 2027, Today/ });
    expect(todayButton).toBeInTheDocument();

    const selectedButton = screen.getByRole("button", { name: /January 20, 2027, Selected/ });
    expect(selectedButton).toBeInTheDocument();
  });

  it("renders a project deadline preview distinguished by text, not color alone", () => {
    renderGrid([deadline("project:a", toDateOnly("2027-01-12"), "Website redesign")]);
    expect(screen.getByText("Deadline: Website redesign")).toBeInTheDocument();
  });

  it("renders a manual event preview distinguished by text, not color alone", () => {
    renderGrid([event("event:a", toDateOnly("2027-01-12"), "Client call")]);
    expect(screen.getByText("Event: Client call")).toBeInTheDocument();
  });

  it("caps visible items at 3 and shows an accessible +N more indication", () => {
    // Titles are alphabetical so insertion order matches the deterministic
    // title-tiebreak sort order from sortCalendarItemsForDay -- otherwise
    // which 3 of the 5 items survive the cap would be sort-order-dependent,
    // not insertion-order-dependent.
    const day = toDateOnly("2027-01-14");
    renderGrid([
      deadline("project:a", day, "Alpha"),
      deadline("project:b", day, "Bravo"),
      deadline("project:c", day, "Charlie"),
      deadline("project:d", day, "Delta"),
      event("event:e", day, "Echo"),
    ]);

    expect(screen.getByText("Deadline: Alpha")).toBeInTheDocument();
    expect(screen.getByText("Deadline: Bravo")).toBeInTheDocument();
    expect(screen.getByText("Deadline: Charlie")).toBeInTheDocument();
    expect(screen.queryByText("Deadline: Delta")).not.toBeInTheDocument();
    expect(screen.queryByText("Event: Echo")).not.toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("includes the scheduled item count in the day's accessible label", () => {
    const day = toDateOnly("2027-01-14");
    renderGrid([deadline("project:a", day, "One"), event("event:b", day, "Two")]);

    expect(screen.getByRole("button", { name: /2 items scheduled/ })).toBeInTheDocument();
  });

  it("does not render a nested interactive element inside any day cell", () => {
    renderGrid([deadline("project:a", toDateOnly("2027-01-12"), "Website redesign")]);

    for (const gridcell of screen.getAllByRole("gridcell")) {
      const nestedButtons = within(gridcell).queryAllByRole("button");
      const nestedLinks = within(gridcell).queryAllByRole("link");
      // The gridcell's own day button is itself the sole interactive element.
      expect(nestedButtons.length).toBeLessThanOrEqual(1);
      expect(nestedLinks).toHaveLength(0);
    }
  });

  it("selecting a day via click calls onSelectDate with that date", async () => {
    const user = userEvent.setup();
    const { onSelectDate } = renderGrid([]);

    await user.click(screen.getByRole("button", { name: /January 12, 2027/ }));

    expect(onSelectDate).toHaveBeenCalledWith("2027-01-12");
  });

  it("selecting a day via keyboard (Enter) still works", async () => {
    const user = userEvent.setup();
    const { onSelectDate } = renderGrid([]);

    const day = screen.getByRole("button", { name: /January 12, 2027/ });
    day.focus();
    await user.keyboard("{Enter}");

    expect(onSelectDate).toHaveBeenCalledWith("2027-01-12");
  });

  it("selecting a leading/trailing outside-month day still calls onSelectDate", async () => {
    const user = userEvent.setup();
    // January 2027 starts on a Friday -- Dec 2026 leading days are in the grid.
    const { onSelectDate } = renderGrid([]);

    await user.click(screen.getByRole("button", { name: /December 31, 2026/ }));

    expect(onSelectDate).toHaveBeenCalledWith("2026-12-31");
  });
});
