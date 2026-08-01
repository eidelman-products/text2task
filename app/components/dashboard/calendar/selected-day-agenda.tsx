import type { CSSProperties, JSX, RefObject } from "react";
import type { DateOnly } from "@/lib/tasks/date-only";
import { formatDateOnlyForA11y } from "@/lib/tasks/date-only";
import type { CalendarItem } from "@/lib/calendar/calendar-types";
import { dashboardColors, dashboardRadii, dashboardSpacing, dashboardTypography } from "../ui/tokens";
import { CalendarAgendaItem, type CalendarAgendaItemEditCallback } from "./calendar-agenda-item";

export { CalendarAgendaItem } from "./calendar-agenda-item";

/**
 * Presentational agenda for one selected calendar day -- the content
 * rendered inside CalendarDayDialog's "day" mode (the premium day-detail
 * popup). `items` arrives already sorted by the caller
 * (`lib/calendar/calendar-item-sort.ts`'s `sortCalendarItemsForDay`) --
 * this component preserves that order exactly and performs no sorting/
 * grouping/derivation of its own. It knows nothing about dialogs,
 * mutations, or fetching -- `onEditEvent` is a plain passthrough to
 * `CalendarAgendaItem`, and there is no `onDeleteEvent` (Delete lives
 * entirely inside CalendarDayDialog's edit mode, i.e. CalendarEventForm).
 *
 * Owns the Work Calendar's single `<h2>` (the selected date heading).
 * `headingRef` + the heading's own `tabIndex={-1}` exist only to support
 * WorkCalendarClient's last-resort focus-return fallback after a mutation
 * removes both the originating trigger and the Add Event button from the
 * DOM -- the heading's own semantics/content/visibility are unchanged, and
 * it is never part of the normal Tab order.
 */
export type SelectedDayAgendaProps = {
  date: DateOnly;
  items: CalendarItem[];
  onEditEvent?: CalendarAgendaItemEditCallback;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  /**
   * Optional `id` for the heading -- used by CalendarDayDialog so its
   * ResponsiveDialog's `aria-labelledby` can point at this exact heading
   * when this component is rendered as the day-detail popup's content.
   * Omitted by every other caller, with no change in behavior.
   */
  headingId?: string;
};

export function SelectedDayAgenda({
  date,
  items,
  onEditEvent,
  headingRef,
  headingId,
}: SelectedDayAgendaProps): JSX.Element {
  return (
    <section style={sectionStyle}>
      <div aria-live="polite">
        <h2 id={headingId} ref={headingRef} tabIndex={-1} style={headingStyle}>
          {formatDateOnlyForA11y(date)}
        </h2>
        <p style={subheadingStyle}>Deadlines and events scheduled for this day.</p>
      </div>

      {items.length === 0 ? (
        <div style={emptyStateWrapStyle}>
          <span aria-hidden="true" style={emptyStateDotStyle} />
          <p style={emptyStateStyle}>Nothing scheduled for this day.</p>
        </div>
      ) : (
        <ul style={listStyle}>
          {items.map((item) => (
            <CalendarAgendaItem key={item.id} item={item} onEditEvent={onEditEvent} />
          ))}
        </ul>
      )}
    </section>
  );
}

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[4],
  fontFamily: dashboardTypography.fontFamily,
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size["2xl"],
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.02em",
  color: dashboardColors.text.primary,
};

const subheadingStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.medium,
  color: dashboardColors.text.muted,
};

const emptyStateWrapStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: dashboardSpacing[3],
  padding: `${dashboardSpacing[8]}px ${dashboardSpacing[4]}px`,
  borderRadius: dashboardRadii.xl,
  border: `1px dashed ${dashboardColors.border.default}`,
  background: dashboardColors.background.surfaceSoft,
};

const emptyStateDotStyle: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: dashboardRadii.full,
  background: `linear-gradient(135deg, ${dashboardColors.primary[500]} 0%, ${dashboardColors.accent.purple} 100%)`,
  boxShadow: "0 0 0 6px rgba(79, 70, 229, 0.10)",
};

const emptyStateStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.medium,
  color: dashboardColors.text.muted,
  textAlign: "center",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: dashboardSpacing[3],
};
