import type { CSSProperties, JSX } from "react";
import type { DateOnly } from "@/lib/tasks/date-only";
import { formatDateOnlyForA11y } from "@/lib/tasks/date-only";
import type { CalendarItem } from "@/lib/calendar/calendar-types";
import { dashboardColors, dashboardSpacing, dashboardTypography } from "../ui/tokens";
import { CalendarAgendaItem } from "./calendar-agenda-item";

export { CalendarAgendaItem } from "./calendar-agenda-item";

/**
 * Read-only agenda for one selected calendar day. `items` arrives already
 * sorted by the caller (`lib/calendar/calendar-item-sort.ts`'s
 * `sortCalendarItemsForDay`) -- this component preserves that order exactly
 * and performs no sorting/grouping/derivation of its own.
 *
 * Owns the Work Calendar page's single `<h2>` (the selected date heading).
 */
export type SelectedDayAgendaProps = {
  date: DateOnly;
  items: CalendarItem[];
};

export function SelectedDayAgenda({ date, items }: SelectedDayAgendaProps): JSX.Element {
  return (
    <section style={sectionStyle}>
      <div aria-live="polite">
        <h2 style={headingStyle}>{formatDateOnlyForA11y(date)}</h2>
      </div>

      {items.length === 0 ? (
        <p style={emptyStateStyle}>Nothing scheduled for this day.</p>
      ) : (
        <ul style={listStyle}>
          {items.map((item) => (
            <CalendarAgendaItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[3],
  fontFamily: dashboardTypography.fontFamily,
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.xl,
  fontWeight: dashboardTypography.weight.bold,
  color: dashboardColors.text.primary,
};

const emptyStateStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.medium,
  color: dashboardColors.text.muted,
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: dashboardSpacing[2],
};
