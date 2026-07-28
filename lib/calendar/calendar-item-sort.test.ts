import { describe, expect, it } from "vitest";
import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { parseTimeOnly, type TimeOnly } from "@/lib/calendar/time-only";
import type { ManualCalendarEventItem, ProjectDeadlineCalendarItem } from "@/lib/calendar/calendar-types";
import { sortCalendarItemsForDay } from "./calendar-item-sort";

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

const FIXTURE_DATE = toDateOnly("2027-01-20");

function projectDeadline(id: string, title: string): ProjectDeadlineCalendarItem {
  return {
    kind: "project_deadline",
    id,
    date: FIXTURE_DATE,
    projectId: id,
    title,
    clientName: null,
    status: null,
    priority: null,
    isOverdue: false,
  };
}

function allDayEvent(id: string, title: string): ManualCalendarEventItem {
  return {
    kind: "manual_event",
    id,
    date: FIXTURE_DATE,
    time: null,
    title,
    notes: null,
    projectId: null,
    projectTitle: null,
    clientId: null,
    clientName: null,
  };
}

function timedEvent(id: string, title: string, time: string): ManualCalendarEventItem {
  return {
    kind: "manual_event",
    id,
    date: FIXTURE_DATE,
    time: toTimeOnly(time),
    title,
    notes: null,
    projectId: null,
    projectTitle: null,
    clientId: null,
    clientName: null,
  };
}

describe("sortCalendarItemsForDay -- mixed input", () => {
  it("puts all-day items (deadlines and all-day events) before timed events, timed events ascending by time", () => {
    const morningStandup = timedEvent("event:1", "Morning standup", "09:00");
    const clientCall = timedEvent("event:2", "Client call", "14:30");
    const deadline = projectDeadline("project:1", "Website launch");
    const allDayReminder = allDayEvent("event:3", "Renew domain");

    const result = sortCalendarItemsForDay([clientCall, morningStandup, deadline, allDayReminder]);

    expect(result.map((item) => item.id)).toEqual([
      "event:3", // all-day (event), "Renew domain" -- alphabetically before "Website launch"
      "project:1", // all-day (deadline), "Website launch"
      "event:1", // 09:00
      "event:2", // 14:30
    ]);
  });
});

describe("sortCalendarItemsForDay -- all-day group ordering", () => {
  it("orders all-day items (mixing deadlines and all-day events) by title, then id", () => {
    const b = allDayEvent("event:b", "Bravo");
    const a = projectDeadline("project:a", "Alpha");
    const c = allDayEvent("event:c", "Charlie");

    const result = sortCalendarItemsForDay([c, b, a]);

    expect(result.map((item) => item.title)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });
});

describe("sortCalendarItemsForDay -- timed events", () => {
  it("sorts a pure list of timed events ascending by time, including midnight and near-midnight", () => {
    const nearMidnight = timedEvent("event:1", "Late night wrap-up", "23:59");
    const midnight = timedEvent("event:2", "Midnight release", "00:00");
    const noon = timedEvent("event:3", "Lunch", "12:00");
    const morning = timedEvent("event:4", "Standup", "09:00");

    const result = sortCalendarItemsForDay([nearMidnight, noon, midnight, morning]);

    expect(result.map((item) => item.id)).toEqual(["event:2", "event:4", "event:3", "event:1"]);
  });

  it("breaks ties between identical-time events by title, then id", () => {
    const second = timedEvent("event:z", "Sync", "10:00");
    const first = timedEvent("event:a", "Sync", "10:00");

    const result = sortCalendarItemsForDay([second, first]);

    expect(result.map((item) => item.id)).toEqual(["event:a", "event:z"]);
  });
});

describe("sortCalendarItemsForDay -- determinism and stability", () => {
  it("produces the same tiebreak order across repeated calls on the same input", () => {
    const items = [
      allDayEvent("event:2", "Same Title"),
      projectDeadline("project:1", "Same Title"),
      allDayEvent("event:1", "Same Title"),
    ];

    const firstRun = sortCalendarItemsForDay(items).map((item) => item.id);
    const secondRun = sortCalendarItemsForDay(items).map((item) => item.id);

    expect(firstRun).toEqual(["event:1", "event:2", "project:1"]);
    expect(secondRun).toEqual(firstRun);
  });

  it("is a no-op on an already-sorted list", () => {
    const items = [
      projectDeadline("project:1", "Alpha"),
      allDayEvent("event:1", "Bravo"),
      timedEvent("event:2", "Charlie", "09:00"),
      timedEvent("event:3", "Delta", "14:00"),
    ];

    const result = sortCalendarItemsForDay(items);

    expect(result.map((item) => item.id)).toEqual(items.map((item) => item.id));
  });

  it("returns an empty array for an empty list", () => {
    expect(sortCalendarItemsForDay([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const items = [
      timedEvent("event:2", "Charlie", "14:00"),
      projectDeadline("project:1", "Alpha"),
      timedEvent("event:3", "Delta", "09:00"),
    ];
    const originalOrder = [...items];
    const originalRefs = items.map((item) => item);

    const result = sortCalendarItemsForDay(items);

    expect(items).toEqual(originalOrder);
    expect(items.map((item) => item.id)).toEqual(originalOrder.map((item) => item.id));
    items.forEach((item, index) => {
      expect(item).toBe(originalRefs[index]);
    });
    // The returned array is sorted and is a different array instance.
    expect(result).not.toBe(items);
  });
});
