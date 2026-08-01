import { describe, expect, it } from "vitest";
import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import type {
  CalendarItem,
  ManualCalendarEventItem,
  ProjectDeadlineCalendarItem,
} from "@/lib/calendar/calendar-types";
import { filterCalendarItems, type CalendarItemFilters } from "./calendar-filters";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid DateOnly`);
  return parsed;
}

const FIXTURE_DATE = toDateOnly("2027-01-20");

function projectDeadline(
  overrides: Partial<ProjectDeadlineCalendarItem> & { id: string; title: string }
): ProjectDeadlineCalendarItem {
  return {
    kind: "project_deadline",
    date: FIXTURE_DATE,
    projectId: overrides.id,
    clientName: null,
    status: null,
    priority: null,
    isOverdue: false,
    ...overrides,
  };
}

function manualEvent(
  overrides: Partial<ManualCalendarEventItem> & { id: string; title: string }
): ManualCalendarEventItem {
  return {
    kind: "manual_event",
    date: FIXTURE_DATE,
    time: null,
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

function noFilter(): CalendarItemFilters {
  return { kind: "all" };
}

describe("filterCalendarItems -- kind filter", () => {
  const deadline = projectDeadline({ id: "project:1", title: "Website launch" });
  const event = manualEvent({ id: "event:1", title: "Team sync" });
  const items: CalendarItem[] = [deadline, event];

  it("kind: all keeps everything", () => {
    expect(filterCalendarItems(items, { kind: "all" })).toEqual(items);
  });

  it("kind: project_deadline keeps only project deadlines", () => {
    expect(filterCalendarItems(items, { kind: "project_deadline" })).toEqual([deadline]);
  });

  it("kind: manual_event keeps only manual events", () => {
    expect(filterCalendarItems(items, { kind: "manual_event" })).toEqual([event]);
  });
});

describe("filterCalendarItems -- status filter", () => {
  const inProgress = projectDeadline({ id: "project:1", title: "A", status: "in_progress" });
  const done = projectDeadline({ id: "project:2", title: "B", status: "done" });
  const noStatus = projectDeadline({ id: "project:3", title: "C", status: null });
  const event = manualEvent({ id: "event:1", title: "D" });
  const items: CalendarItem[] = [inProgress, done, noStatus, event];

  it("narrows project deadlines to the matching status", () => {
    const result = filterCalendarItems(items, { kind: "all", status: "in_progress" });
    expect(result.map((item) => item.id)).toEqual(["project:1", "event:1"]);
  });

  it("excludes project deadlines with no status when a status filter is active", () => {
    const result = filterCalendarItems(items, { kind: "all", status: "in_progress" });
    expect(result.map((item) => item.id)).not.toContain("project:3");
  });

  it("no status filter (undefined/null) keeps all statuses", () => {
    expect(filterCalendarItems(items, { kind: "all", status: undefined })).toEqual(items);
    expect(filterCalendarItems(items, { kind: "all", status: null })).toEqual(items);
  });
});

describe("filterCalendarItems -- priority filter", () => {
  const high = projectDeadline({ id: "project:1", title: "A", priority: "high" });
  const low = projectDeadline({ id: "project:2", title: "B", priority: "low" });
  const event = manualEvent({ id: "event:1", title: "C" });
  const items: CalendarItem[] = [high, low, event];

  it("narrows project deadlines to the matching priority", () => {
    const result = filterCalendarItems(items, { kind: "all", priority: "high" });
    expect(result.map((item) => item.id)).toEqual(["project:1", "event:1"]);
  });
});

describe("filterCalendarItems -- client filter", () => {
  const acmeDeadline = projectDeadline({ id: "project:1", title: "A", clientName: "Acme" });
  const otherDeadline = projectDeadline({ id: "project:2", title: "B", clientName: "Globex" });
  const noClientDeadline = projectDeadline({ id: "project:3", title: "C", clientName: null });
  const acmeEvent = manualEvent({ id: "event:1", title: "D", clientId: "client-acme", clientName: "Acme" });
  const noClientEvent = manualEvent({ id: "event:2", title: "E" });
  const items: CalendarItem[] = [acmeDeadline, otherDeadline, noClientDeadline, acmeEvent, noClientEvent];

  it("keeps only items whose resolved client name matches", () => {
    const result = filterCalendarItems(items, { kind: "all", clientName: "Acme" });
    expect(result.map((item) => item.id)).toEqual(["project:1", "event:1"]);
  });

  it("excludes items with no client at all when a client filter is active", () => {
    const result = filterCalendarItems(items, { kind: "all", clientName: "Acme" });
    expect(result.map((item) => item.id)).not.toContain("project:3");
    expect(result.map((item) => item.id)).not.toContain("event:2");
  });

  it("no client filter (undefined/null) keeps items regardless of client", () => {
    expect(filterCalendarItems(items, { kind: "all", clientName: undefined })).toEqual(items);
  });
});

describe("filterCalendarItems -- combined filters apply as AND", () => {
  const match = projectDeadline({
    id: "project:1",
    title: "A",
    status: "in_progress",
    clientName: "Acme",
  });
  const wrongClient = projectDeadline({
    id: "project:2",
    title: "B",
    status: "in_progress",
    clientName: "Globex",
  });
  const wrongStatus = projectDeadline({
    id: "project:3",
    title: "C",
    status: "done",
    clientName: "Acme",
  });
  const event = manualEvent({ id: "event:1", title: "D", clientName: "Acme" });
  const items: CalendarItem[] = [match, wrongClient, wrongStatus, event];

  it("only keeps items satisfying every active filter", () => {
    const result = filterCalendarItems(items, {
      kind: "all",
      status: "in_progress",
      clientName: "Acme",
    });

    // event:1 passes because status filters never remove manual events (see
    // below), and it independently matches the client filter.
    expect(result.map((item) => item.id)).toEqual(["project:1", "event:1"]);
  });

  it("kind: project_deadline combined with status/client narrows to matching deadlines only", () => {
    const result = filterCalendarItems(items, {
      kind: "project_deadline",
      status: "in_progress",
      clientName: "Acme",
    });

    expect(result.map((item) => item.id)).toEqual(["project:1"]);
  });
});

describe("filterCalendarItems -- status/priority filters never hide manual events", () => {
  const deadlineMatching = projectDeadline({ id: "project:1", title: "A", status: "in_progress" });
  const deadlineNonMatching = projectDeadline({ id: "project:2", title: "B", status: "done" });
  const event = manualEvent({ id: "event:1", title: "C" });
  const items: CalendarItem[] = [deadlineMatching, deadlineNonMatching, event];

  it("keeps manual events when a status filter is active, even though events have no status", () => {
    const result = filterCalendarItems(items, { kind: "all", status: "in_progress" });
    expect(result.map((item) => item.id)).toContain("event:1");
  });

  it("still removes non-matching project deadlines when the same status filter is active", () => {
    const result = filterCalendarItems(items, { kind: "all", status: "in_progress" });
    expect(result.map((item) => item.id)).not.toContain("project:2");
  });

  it("keeps manual events when a priority filter is active, even though events have no priority", () => {
    const deadlineWithPriority = projectDeadline({ id: "project:3", title: "D", priority: "high" });
    const result = filterCalendarItems([deadlineWithPriority, event], { kind: "all", priority: "high" });
    expect(result.map((item) => item.id)).toEqual(["project:3", "event:1"]);
  });
});

describe("filterCalendarItems -- no-op and empty-list cases", () => {
  it("an empty/no-op filter set returns everything unchanged", () => {
    const items: CalendarItem[] = [
      projectDeadline({ id: "project:1", title: "A" }),
      manualEvent({ id: "event:1", title: "B" }),
    ];

    expect(filterCalendarItems(items, noFilter())).toEqual(items);
  });

  it("filtering an empty list returns an empty list", () => {
    expect(filterCalendarItems([], { kind: "all" })).toEqual([]);
    expect(filterCalendarItems([], { kind: "all", status: "in_progress", clientName: "Acme" })).toEqual([]);
  });
});
