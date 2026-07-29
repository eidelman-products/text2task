// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { parseTimeOnly, type TimeOnly } from "@/lib/calendar/time-only";
import type {
  CalendarItem,
  ManualCalendarEventItem,
  ProjectDeadlineCalendarItem,
} from "@/lib/calendar/calendar-types";
import { SelectedDayAgenda } from "./selected-day-agenda";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid DateOnly`);
  return parsed;
}

function toTimeOnly(value: string): TimeOnly {
  const parsed = parseTimeOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid TimeOnly`);
  return parsed;
}

function deadline(
  overrides: Partial<ProjectDeadlineCalendarItem> & { id: string; date: DateOnly }
): CalendarItem {
  return {
    kind: "project_deadline",
    projectId: "p1",
    title: "Project",
    clientName: null,
    status: null,
    priority: null,
    isOverdue: false,
    ...overrides,
  };
}

function event(
  overrides: Partial<ManualCalendarEventItem> & { id: string; date: DateOnly }
): CalendarItem {
  return {
    kind: "manual_event",
    time: null,
    title: "Event",
    notes: null,
    projectId: null,
    projectTitle: null,
    clientId: null,
    clientName: null,
    ...overrides,
  };
}

const DAY = toDateOnly("2027-01-20");

describe("SelectedDayAgenda", () => {
  it("renders the full unambiguous selected date as the heading", () => {
    render(<SelectedDayAgenda date={DAY} items={[]} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "January 20, 2027" })
    ).toBeInTheDocument();
  });

  it("shows a neutral empty-state message and no items when there are none", () => {
    render(<SelectedDayAgenda date={DAY} items={[]} />);

    expect(screen.getByText("Nothing scheduled for this day.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("preserves the exact given order, does not re-sort", () => {
    const items: CalendarItem[] = [
      event({ id: "event:z", date: DAY, title: "Z Event" }),
      deadline({ id: "project:a", date: DAY, title: "A Project" }),
      event({ id: "event:m", date: DAY, title: "M Event" }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(3);
    expect(listItems.map((el) => el.textContent)).toEqual([
      expect.stringContaining("Z Event"),
      expect.stringContaining("A Project"),
      expect.stringContaining("M Event"),
    ]);
  });

  it("shows a project deadline's title, client, status, and priority", () => {
    const items: CalendarItem[] = [
      deadline({
        id: "project:a",
        date: DAY,
        title: "Redesign site",
        clientName: "Acme Co",
        status: "In Progress",
        priority: "High",
      }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    expect(screen.getByText("Project deadline")).toBeInTheDocument();
    expect(screen.getByText("Redesign site")).toBeInTheDocument();
    expect(screen.getByText("Acme Co")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("shows an Overdue text indicator when isOverdue is true", () => {
    const items: CalendarItem[] = [
      deadline({ id: "project:a", date: DAY, title: "Late thing", isOverdue: true }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("does not show Overdue when isOverdue is false", () => {
    const items: CalendarItem[] = [
      deadline({ id: "project:a", date: DAY, title: "On time", isOverdue: false }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
  });

  it.each(["done", "Done", " DONE "])(
    "marks a project deadline with status %j as completed",
    (statusValue) => {
      const items: CalendarItem[] = [
        deadline({ id: "project:a", date: DAY, title: "Finished thing", status: statusValue }),
      ];

      render(<SelectedDayAgenda date={DAY} items={items} />);

      expect(screen.getByText("Completed")).toBeInTheDocument();
    }
  );

  it("does not mark a non-done status as completed", () => {
    const items: CalendarItem[] = [
      deadline({ id: "project:a", date: DAY, title: "Ongoing", status: "New" }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("renders an Open Task CRM link to the general Tasks view, not claiming to open the specific project", () => {
    const items: CalendarItem[] = [
      deadline({ id: "project:a", date: DAY, title: "Very Specific Project Name" }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    const link = screen.getByRole("link", { name: "Open Task CRM" });
    expect(link).toHaveAttribute("href", "/dashboard?view=tasks");
    expect(link.textContent).not.toContain("Very Specific Project Name");
  });

  it("shows a manual event's time, client, project, and notes only when present", () => {
    const items: CalendarItem[] = [
      event({
        id: "event:full",
        date: DAY,
        title: "Kickoff call",
        time: toTimeOnly("14:30"),
        clientName: "Beta LLC",
        projectTitle: "Beta Launch",
        notes: "Bring slides",
      }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    expect(screen.getByText("Manual event")).toBeInTheDocument();
    expect(screen.getByText("Kickoff call")).toBeInTheDocument();
    expect(screen.getByText("2:30 PM")).toBeInTheDocument();
    expect(screen.getByText("Beta LLC")).toBeInTheDocument();
    expect(screen.getByText("Project: Beta Launch")).toBeInTheDocument();
    expect(screen.getByText("Bring slides")).toBeInTheDocument();
  });

  it("omits time/client/project/notes rows entirely when null, no placeholders", () => {
    const items: CalendarItem[] = [
      event({ id: "event:bare", date: DAY, title: "Bare event" }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    const listItem = screen.getByRole("listitem");
    expect(within(listItem).queryByText(/none/i)).not.toBeInTheDocument();
    expect(listItem.textContent).not.toMatch(/project:/i);
  });

  it("preserves line breaks in notes via white-space: pre-line", () => {
    const items: CalendarItem[] = [
      event({
        id: "event:notes",
        date: DAY,
        title: "Multiline",
        notes: "Line one\nLine two",
      }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    const notes = screen.getByText((_, element) => element?.textContent === "Line one\nLine two");
    expect(notes).toHaveStyle({ whiteSpace: "pre-line" });
  });

  it("truncates very long notes with a trailing ellipsis but does not truncate short notes", () => {
    const longNotes = "x".repeat(500);
    const items: CalendarItem[] = [
      event({ id: "event:long", date: DAY, title: "Long notes event", notes: longNotes }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    const listItem = screen.getByRole("listitem");
    expect(listItem.textContent).toContain("…");
    expect(listItem.textContent).not.toContain("x".repeat(500));
  });

  it("has no edit/delete/Add Event controls anywhere", () => {
    const items: CalendarItem[] = [
      deadline({ id: "project:a", date: DAY, title: "A" }),
      event({ id: "event:b", date: DAY, title: "B", notes: "n" }),
    ];

    const { container } = render(<SelectedDayAgenda date={DAY} items={items} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/add event/i);
    expect(container.textContent).not.toMatch(/\bedit\b/i);
    expect(container.textContent).not.toMatch(/\bdelete\b/i);
  });

  it("the only link present for a manual event day is none -- manual events have zero interactive elements", () => {
    const items: CalendarItem[] = [
      event({ id: "event:only", date: DAY, title: "Solo event" }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
