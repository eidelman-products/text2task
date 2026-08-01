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
  /**
   * Free-text Project name for an event whose Project doesn't exist as a
   * real project row. Always null when `projectId` is non-null -- the two
   * are kept mutually exclusive at every layer (Zod, the repository, and a
   * database CHECK constraint); see calendar-link-validation.server.ts.
   */
  customProjectName: string | null;
  /**
   * Resolved display value only: the linked project's title when
   * `projectId` is set, otherwise `customProjectName`, otherwise null. The
   * UI renders this directly and never needs to know which of the two
   * produced it.
   */
  projectTitle: string | null;
  clientId: string | null;
  /** Free-text Client name; mutually exclusive with `clientId` (see above). */
  customClientName: string | null;
  /**
   * Resolved display value only: the linked client's name when `clientId`
   * is set, otherwise `customClientName`, otherwise null.
   */
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

/**
 * One selectable Project option for the Add/Edit Manual Event form's
 * picker, returned by `GET /api/calendar/options`
 * (lib/calendar/load-calendar-options.server.ts). Deliberately not just
 * `{id, title}` -- `clientId`/`clientName` let the form preview/lock the
 * Client field from the project's own current client without a second
 * round-trip, and `isArchived` distinguishes an already-linked archived
 * project (still returned so an existing event stays editable) from a
 * normal, newly-selectable one.
 */
export type CalendarProjectOption = {
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  isArchived: boolean;
};

/** One selectable Client option for the same picker. */
export type CalendarClientOption = {
  id: string;
  name: string;
};

/**
 * `projectsTruncated`/`clientsTruncated` are `true` only when the *normal*
 * (non-included) result for that type actually exceeded the endpoint's cap
 * -- never inferred from array length alone, since an included
 * currently-linked value can be appended on top of an already-full page
 * without that appended value indicating truncation on its own.
 */
export type CalendarOptionsResult = {
  projects: CalendarProjectOption[];
  clients: CalendarClientOption[];
  projectsTruncated: boolean;
  clientsTruncated: boolean;
};

export type CreateCalendarEventInput = {
  title: string;
  eventDate: DateOnly;
  eventTime: TimeOnly | null;
  notes: string | null;
  projectId: string | null;
  customProjectName: string | null;
  clientId: string | null;
  customClientName: string | null;
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
  customProjectName?: string | null;
  clientId?: string | null;
  customClientName?: string | null;
};
