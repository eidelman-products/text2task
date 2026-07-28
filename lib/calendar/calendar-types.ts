import type { DateOnly } from "@/lib/tasks/date-only";
import type { TimeOnly } from "@/lib/calendar/time-only";

/**
 * Work Calendar read-model and CRUD contracts.
 *
 * Project deadlines are never persisted here -- `ProjectDeadlineCalendarItem`
 * is a read-time projection of `projects.deadline_date`, computed fresh on
 * every load in lib/calendar/load-calendar-range.server.ts. Only
 * `ManualCalendarEventItem` corresponds to a real, independently-owned
 * database row (`calendar_events`).
 */

export type ProjectDeadlineCalendarItem = {
  kind: "project_deadline";
  /** Stable, kind-prefixed id: `project:${projectId}`. */
  id: string;
  date: DateOnly;
  projectId: string;
  title: string;
  clientName: string | null;
  status: string | null;
  priority: string | null;
  isOverdue: boolean;
};

export type ManualCalendarEventItem = {
  kind: "manual_event";
  /** Stable, kind-prefixed id: `event:${calendarEvents.id}`. */
  id: string;
  date: DateOnly;
  /** Null means all-day -- there is no separate "all day" flag. */
  time: TimeOnly | null;
  title: string;
  notes: string | null;
  projectId: string | null;
  /** Resolved via join for display; null when no project is linked. */
  projectTitle: string | null;
  clientId: string | null;
  /** Resolved via join for display; null when no client is linked. */
  clientName: string | null;
};

export type CalendarItem = ProjectDeadlineCalendarItem | ManualCalendarEventItem;

/** An active project with no deadline, for the Unscheduled Projects panel. */
export type UnscheduledProjectCalendarItem = {
  id: string;
  title: string;
  clientName: string | null;
  status: string | null;
  priority: string | null;
  /** ISO timestamp (projects.created_at is a timestamptz, not a DateOnly). */
  createdAt: string;
};

export type CalendarRangeQuery = {
  start: DateOnly;
  end: DateOnly;
};

export type CreateCalendarEventInput = {
  title: string;
  eventDate: DateOnly;
  eventTime: TimeOnly | null;
  notes: string | null;
  projectId: string | null;
  clientId: string | null;
};

/**
 * All fields are independently optional so a caller can distinguish "field
 * omitted" (key absent) from "explicitly cleared" (key present, value
 * `null`) from "field changed" (key present, real value). Server code
 * consuming this type must check key presence (`"eventTime" in input`), not
 * truthiness/nullishness (`input.eventTime ?? existing`), or explicit
 * clearing silently becomes impossible.
 */
export type UpdateCalendarEventInput = {
  title?: string;
  eventDate?: DateOnly;
  eventTime?: TimeOnly | null;
  notes?: string | null;
  projectId?: string | null;
  clientId?: string | null;
};
