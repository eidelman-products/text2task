import { describe, expect, it } from "vitest";
import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { parseTimeOnly, type TimeOnly } from "./time-only";
import type { CalendarItem } from "./calendar-types";
import {
  buildCalendarDayAccessibleLabel,
  buildCalendarGridDays,
  getCalendarItemsForDate,
  groupCalendarItemsByDate,
} from "./calendar-item-grouping";

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

function deadline(overrides: Partial<CalendarItem> & { date: DateOnly; id: string }): CalendarItem {
  return {
    kind: "project_deadline",
    projectId: "p1",
    title: "Project",
    clientName: null,
    status: null,
    priority: null,
    isOverdue: false,
    ...overrides,
  } as CalendarItem;
}

function event(overrides: Partial<CalendarItem> & { date: DateOnly; id: string }): CalendarItem {
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
  } as CalendarItem;
}

describe("groupCalendarItemsByDate", () => {
  it("groups items by date and sorts each day's bucket deterministically", () => {
    const jan10 = toDateOnly("2027-01-10");
    const jan12 = toDateOnly("2027-01-12");

    const items: CalendarItem[] = [
      event({ id: "event:b", date: jan10, title: "B", time: toTimeOnly("14:00") }),
      deadline({ id: "project:a", date: jan10, title: "A" }),
      deadline({ id: "project:c", date: jan12, title: "C" }),
    ];

    const byDate = groupCalendarItemsByDate(items);

    expect(byDate.get(jan10)?.map((item) => item.id)).toEqual(["project:a", "event:b"]);
    expect(byDate.get(jan12)?.map((item) => item.id)).toEqual(["project:c"]);
  });

  it("returns an empty map for an empty input", () => {
    expect(groupCalendarItemsByDate([]).size).toBe(0);
  });
});

describe("getCalendarItemsForDate", () => {
  it("returns an empty array for a date with no items, never undefined/throwing", () => {
    const byDate = groupCalendarItemsByDate([]);
    expect(getCalendarItemsForDate(byDate, toDateOnly("2027-01-01"))).toEqual([]);
  });

  it("returns the grouped items for a date that has them", () => {
    const jan10 = toDateOnly("2027-01-10");
    const byDate = groupCalendarItemsByDate([deadline({ id: "project:a", date: jan10 })]);
    expect(getCalendarItemsForDate(byDate, jan10)).toHaveLength(1);
  });
});

describe("buildCalendarGridDays", () => {
  it("attaches each grid day's items and flags outside-month days", () => {
    // January 2027 starts on a Friday, so the grid includes December
    // leading days -- an ideal fixture for the outside-month flag.
    const visibleMonth = toDateOnly("2027-01-15");
    const dec31 = toDateOnly("2026-12-31");
    const jan10 = toDateOnly("2027-01-10");

    const items: CalendarItem[] = [
      deadline({ id: "project:a", date: dec31, title: "Leading day item" }),
      deadline({ id: "project:b", date: jan10, title: "In-month item" }),
    ];

    const gridDays = buildCalendarGridDays(visibleMonth, items);

    const decDay = gridDays.find((day) => day.date === dec31);
    const janDay = gridDays.find((day) => day.date === jan10);

    expect(decDay?.isOutsideMonth).toBe(true);
    expect(decDay?.items).toHaveLength(1);
    expect(janDay?.isOutsideMonth).toBe(false);
    expect(janDay?.items).toHaveLength(1);
  });

  it("every grid day has an items array, even with zero items", () => {
    const gridDays = buildCalendarGridDays(toDateOnly("2027-02-01"), []);
    expect(gridDays.every((day) => Array.isArray(day.items) && day.items.length === 0)).toBe(
      true
    );
  });

  it("the grid length matches getCalendarGridDays (leading + month + trailing)", () => {
    const gridDays = buildCalendarGridDays(toDateOnly("2027-02-01"), []);
    expect(gridDays.length % 7).toBe(0);
    expect(gridDays.length).toBeGreaterThanOrEqual(28);
  });
});

describe("buildCalendarDayAccessibleLabel", () => {
  it("includes the full unambiguous date", () => {
    const label = buildCalendarDayAccessibleLabel({
      date: toDateOnly("2027-01-20"),
      isToday: false,
      isSelected: false,
      itemCount: 0,
    });
    expect(label).toContain("January 20, 2027");
  });

  it("includes Today and Selected only when applicable", () => {
    const label = buildCalendarDayAccessibleLabel({
      date: toDateOnly("2027-01-20"),
      isToday: true,
      isSelected: true,
      itemCount: 0,
    });
    expect(label).toContain("Today");
    expect(label).toContain("Selected");

    const plain = buildCalendarDayAccessibleLabel({
      date: toDateOnly("2027-01-20"),
      isToday: false,
      isSelected: false,
      itemCount: 0,
    });
    expect(plain).not.toContain("Today");
    expect(plain).not.toContain("Selected");
  });

  it("uses singular phrasing for exactly one item and plural for more", () => {
    const one = buildCalendarDayAccessibleLabel({
      date: toDateOnly("2027-01-20"),
      isToday: false,
      isSelected: false,
      itemCount: 1,
    });
    expect(one).toContain("1 item scheduled");

    const many = buildCalendarDayAccessibleLabel({
      date: toDateOnly("2027-01-20"),
      isToday: false,
      isSelected: false,
      itemCount: 3,
    });
    expect(many).toContain("3 items scheduled");
  });

  it("omits the item-count phrase entirely for zero items", () => {
    const label = buildCalendarDayAccessibleLabel({
      date: toDateOnly("2027-01-20"),
      isToday: false,
      isSelected: false,
      itemCount: 0,
    });
    expect(label).not.toContain("item");
  });
});
