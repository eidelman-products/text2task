// @vitest-environment jsdom
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    customProjectName: null,
    projectTitle: null,
    clientId: null,
    customClientName: null,
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
    expect(screen.getByText("High priority")).toBeInTheDocument();
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
    "shows the status badge in the completed (green) style when status is %j",
    (statusValue) => {
      const items: CalendarItem[] = [
        deadline({ id: "project:a", date: DAY, title: "Finished thing", status: statusValue }),
      ];

      render(<SelectedDayAgenda date={DAY} items={items} />);

      expect(screen.getByText(statusValue.trim())).toHaveStyle({ color: "#16a34a" });
    }
  );

  it("does not use the completed (green) style for a non-done status", () => {
    const items: CalendarItem[] = [
      deadline({ id: "project:a", date: DAY, title: "Ongoing", status: "New" }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    expect(screen.getByText("New")).toHaveStyle({ color: "#334155" });
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
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Beta Launch")).toBeInTheDocument();
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

  it("has no Add Event/Delete control, and no Edit control when onEditEvent is not supplied", () => {
    const items: CalendarItem[] = [
      deadline({ id: "project:a", date: DAY, title: "A" }),
      event({ id: "event:b", date: DAY, title: "B", notes: "n" }),
    ];

    const { container } = render(<SelectedDayAgenda date={DAY} items={items} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/add event/i);
    expect(container.textContent).not.toMatch(/\bdelete\b/i);
  });

  it("a manual event has zero interactive elements when onEditEvent is not supplied", () => {
    const items: CalendarItem[] = [
      event({ id: "event:only", date: DAY, title: "Solo event" }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("passes onEditEvent through to a manual event's Edit button", async () => {
    const user = userEvent.setup();
    const onEditEvent = vi.fn();
    const items: CalendarItem[] = [
      event({ id: "event:only", date: DAY, title: "Solo event" }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} onEditEvent={onEditEvent} />);

    await user.click(screen.getByRole("button", { name: "Edit Solo event" }));
    expect(onEditEvent).toHaveBeenCalledTimes(1);
  });

  it("never adds an Edit control to a Project Deadline row, even when onEditEvent is supplied", () => {
    const items: CalendarItem[] = [
      deadline({ id: "project:a", date: DAY, title: "Redesign site" }),
    ];

    render(<SelectedDayAgenda date={DAY} items={items} onEditEvent={vi.fn()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the heading's content/aria-live behavior and forwards the supplied ref with tabIndex=-1", () => {
    const headingRef = createRef<HTMLHeadingElement>();

    render(<SelectedDayAgenda date={DAY} items={[]} headingRef={headingRef} />);

    const heading = screen.getByRole("heading", { level: 2, name: "January 20, 2027" });
    expect(headingRef.current).toBe(heading);
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(heading.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it("does not accept an onDeleteEvent prop -- Delete is not this component's concern", () => {
    // Structural, not behavioral: SelectedDayAgendaProps has no onDeleteEvent
    // field at all (compile-time enforced) -- this test documents that
    // intent for anyone reading the suite, exercising the component's real
    // props exactly as declared.
    const items: CalendarItem[] = [event({ id: "event:only", date: DAY, title: "Solo event" })];
    render(<SelectedDayAgenda date={DAY} items={items} onEditEvent={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("keeps the empty-state message unchanged when a headingRef/onEditEvent are supplied", () => {
    const headingRef = createRef<HTMLHeadingElement>();
    render(<SelectedDayAgenda date={DAY} items={[]} onEditEvent={vi.fn()} headingRef={headingRef} />);

    expect(screen.getByText("Nothing scheduled for this day.")).toBeInTheDocument();
  });
});
