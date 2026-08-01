// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { parseTimeOnly } from "@/lib/calendar/time-only";
import type {
  CalendarItem,
  ManualCalendarEventItem,
  ProjectDeadlineCalendarItem,
} from "@/lib/calendar/calendar-types";
import { CalendarAgendaItem } from "./calendar-agenda-item";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid DateOnly`);
  return parsed;
}

const DAY = toDateOnly("2027-01-20");

function deadline(
  overrides: Partial<ProjectDeadlineCalendarItem> & { id: string }
): CalendarItem {
  return {
    kind: "project_deadline",
    date: DAY,
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
  overrides: Partial<ManualCalendarEventItem> & { id: string }
): ManualCalendarEventItem {
  return {
    kind: "manual_event",
    date: DAY,
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

describe("CalendarAgendaItem — Project Deadline", () => {
  it("shows the kind label and the project title as the strongest text", () => {
    const item = deadline({ id: "project:a", title: "Redesign site" });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    expect(screen.getByText("Project deadline")).toBeInTheDocument();
    expect(screen.getByText("Redesign site")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows Status as a separate badge, distinct from the kind label and the title", () => {
    const item = deadline({ id: "project:a", title: "Redesign site", status: "In Progress" });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    const statusBadge = screen.getByText("In Progress");
    expect(statusBadge).toBeInTheDocument();
    // Not the same element as the kind label or the title -- a genuinely
    // separate, distinguishable piece of the hierarchy.
    expect(statusBadge).not.toBe(screen.getByText("Project deadline"));
    expect(statusBadge).not.toBe(screen.getByText("Redesign site"));
  });

  it("shows the Client with a labelled row when present, omitted when absent", () => {
    const withClient = deadline({ id: "project:a", title: "Redesign site", clientName: "Acme Co" });
    const { unmount } = render(<CalendarAgendaItem item={withClient} onEditEvent={vi.fn()} />);
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Acme Co")).toBeInTheDocument();
    unmount();

    const withoutClient = deadline({ id: "project:b", title: "Redesign site", clientName: null });
    render(<CalendarAgendaItem item={withoutClient} onEditEvent={vi.fn()} />);
    expect(screen.queryByText("Client")).not.toBeInTheDocument();
  });

  it("shows an understandable 'X priority' label, not a bare priority word", () => {
    const item = deadline({ id: "project:a", title: "Redesign site", priority: "High" });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    expect(screen.getByText(/High priority/)).toBeInTheDocument();
    expect(screen.queryByText(/^High$/)).not.toBeInTheDocument();
  });

  it("shows an understandable 'Overdue' label distinct from priority when isOverdue is true", () => {
    const item = deadline({ id: "project:a", title: "Late thing", isOverdue: true });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("does not show Overdue when isOverdue is false", () => {
    const item = deadline({ id: "project:a", title: "On time", isOverdue: false });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
  });

  it("marks a done-status deadline visually distinctly (muted title) without inventing a second redundant badge", () => {
    const item = deadline({ id: "project:a", title: "Finished thing", status: "Done" });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    // Status itself already reads "Done" -- no separate "Completed" badge duplicating it.
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("still renders its own Open Task CRM link, unchanged route", () => {
    const item = deadline({ id: "project:a", title: "Redesign site" });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    const link = screen.getByRole("link", { name: /Open Task CRM/ });
    expect(link).toHaveAttribute("href", "/dashboard?view=tasks");
  });
});

describe("CalendarAgendaItem — Manual Event", () => {
  it("renders exactly one interactive element, the Edit button", () => {
    const item = event({ id: "event:a", title: "Kickoff call" });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("Edit");
  });

  it("gives the Edit button an accessible name that includes the event title", () => {
    const item = event({ id: "event:a", title: "Kickoff call" });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Edit Kickoff call" })).toBeInTheDocument();
  });

  it("calls onEditEvent with the exact item and the real button element", async () => {
    const user = userEvent.setup();
    const onEditEvent = vi.fn();
    const item = event({ id: "event:a", title: "Kickoff call" });
    render(<CalendarAgendaItem item={item} onEditEvent={onEditEvent} />);

    const button = screen.getByRole("button", { name: "Edit Kickoff call" });
    await user.click(button);

    expect(onEditEvent).toHaveBeenCalledTimes(1);
    const [receivedItem, receivedTrigger] = onEditEvent.mock.calls[0];
    expect(receivedItem).toEqual(item);
    expect(receivedTrigger).toBeInstanceOf(HTMLButtonElement);
    expect(receivedTrigger.tagName).toBe("BUTTON");
  });

  it("renders no button at all when onEditEvent is not supplied", () => {
    const item = event({ id: "event:a", title: "Kickoff call" });
    render(<CalendarAgendaItem item={item} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders no Delete button", () => {
    const item = event({ id: "event:a", title: "Kickoff call" });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("the card itself (the list item) is not clickable", () => {
    const item = event({ id: "event:a", title: "Kickoff call" });
    const { container } = render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    const listItem = container.querySelector("li");
    expect(listItem).not.toHaveAttribute("onClick");
    expect(listItem?.getAttribute("role")).not.toBe("button");
  });

  it("shows a labelled Project row with an icon when a linked project is present", () => {
    const item = event({ id: "event:a", title: "Kickoff call", projectTitle: "Beta Launch" });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Beta Launch")).toBeInTheDocument();
  });

  it("renders a custom (not-yet-linked) Project name identically to a linked one", () => {
    const item = event({ id: "event:a", title: "Kickoff call", projectTitle: "Not Yet In Text2Task" });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Not Yet In Text2Task")).toBeInTheDocument();
  });

  it("shows a labelled Client row with an icon when present", () => {
    const item = event({ id: "event:a", title: "Kickoff call", clientName: "Beta LLC" });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Beta LLC")).toBeInTheDocument();
  });

  it("omits the Project/Client rows entirely when null, no placeholders", () => {
    const item = event({ id: "event:bare", title: "Bare event" });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    expect(screen.queryByText("Project")).not.toBeInTheDocument();
    expect(screen.queryByText("Client")).not.toBeInTheDocument();
  });

  it("shows time when present", () => {
    const time = parseTimeOnly("14:30");
    if (!time) throw new Error("fixture time did not parse");
    const item = event({ id: "event:full", title: "Kickoff call", time });
    render(<CalendarAgendaItem item={item} onEditEvent={vi.fn()} />);

    expect(screen.getByText("2:30 PM")).toBeInTheDocument();
  });
});
