import type { CalendarItem } from "@/lib/calendar/calendar-types";

export type CalendarItemKindFilter = "all" | "project_deadline" | "manual_event";

/**
 * Filter criteria for a Work Calendar view. All set fields combine with
 * logical AND. `status`/`priority`/`clientName` use `null | undefined` to
 * mean "no filter on this field" (both are treated identically -- callers
 * may omit the key or pass `null` interchangeably).
 *
 * `clientName` (not `clientId`) is the client filter field: it's the only
 * client-identifying field both `CalendarItem` variants share --
 * `ProjectDeadlineCalendarItem` has no `clientId` at all, only `clientName`
 * (see calendar-types.ts). Filtering on `clientId` would make the client
 * filter silently inapplicable to every project deadline, which is not a
 * usable filter for a calendar meant to show both item kinds side by side.
 */
export type CalendarItemFilters = {
  kind: CalendarItemKindFilter;
  status?: string | null;
  priority?: string | null;
  clientName?: string | null;
};

function resolveClientName(item: CalendarItem): string | null {
  return item.clientName;
}

/**
 * `status` and `priority` are project-only concepts: `ManualCalendarEventItem`
 * has neither field in this feature's schema (calendar-types.ts). The rule
 * implemented here is: a `status`/`priority` filter only ever narrows
 * `project_deadline` items -- it removes `project_deadline` items that don't
 * match, but never removes a `manual_event`, because "does this event's
 * status match X" is not a question that has an answer for an item with no
 * status. Silently hiding manual events under a project-only filter would be
 * a confusing, undocumented side effect (a user filtering deadlines by
 * "in progress" almost certainly still wants to see their manual meetings
 * that day, not have them vanish). If product ever wants status/priority
 * filters to also imply "only project deadlines," that has to be expressed
 * by the caller explicitly setting `kind: "project_deadline"` -- this
 * function will not infer it.
 */
function matchesFilters(item: CalendarItem, filters: CalendarItemFilters): boolean {
  if (filters.kind !== "all" && item.kind !== filters.kind) {
    return false;
  }

  if (filters.status != null) {
    if (item.kind === "project_deadline" && item.status !== filters.status) {
      return false;
    }
  }

  if (filters.priority != null) {
    if (item.kind === "project_deadline" && item.priority !== filters.priority) {
      return false;
    }
  }

  if (filters.clientName != null) {
    if (resolveClientName(item) !== filters.clientName) {
      return false;
    }
  }

  return true;
}

/**
 * Filters `items` by `filters`, combining every set field with logical AND.
 * Pure and non-mutating; an empty/no-op filter set (`{ kind: "all" }`)
 * returns every item unchanged.
 */
export function filterCalendarItems(
  items: readonly CalendarItem[],
  filters: CalendarItemFilters
): CalendarItem[] {
  return items.filter((item) => matchesFilters(item, filters));
}
