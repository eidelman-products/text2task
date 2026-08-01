"use client";

import { useId, useRef, useState, type CSSProperties, type RefObject } from "react";

import type {
  CalendarClientOption,
  CalendarItem,
  CalendarProjectOption,
  ManualCalendarEventItem,
} from "@/lib/calendar/calendar-types";
import type { DateOnly } from "@/lib/tasks/date-only";
import { ResponsiveDialog } from "../ui/responsive-dialog";
import { DashboardButton } from "../ui/button";
import { stack } from "../ui/styles";
import { dashboardColors, dashboardRadii, dashboardShadows, dashboardSpacing } from "../ui/tokens";
import { CalendarEventForm, type CalendarEventFormMode } from "./calendar-event-form";
import { SelectedDayAgenda } from "./selected-day-agenda";
import type { CalendarAgendaItemEditCallback } from "./calendar-agenda-item";

/*
  Single ResponsiveDialog instance shared by three modes -- "day" (the
  premium day-detail popup this redesign introduces), "create", and "edit"
  (CalendarEventForm, unchanged from Phase C/D). Supersedes the old
  AddEditCalendarEventDialog (create/edit only): that component's own
  ResponsiveDialog + busy/deleteConfirmPending ownership is preserved
  verbatim here, just widened to also render the day-agenda view.

  Critically, transitioning "day" -> "edit" (clicking Edit inside the
  popup) or "day" -> "create" (clicking its own Add event affordance) is a
  MODE change on the SAME open session -- `open` never toggles false, so
  ResponsiveDialog never unmounts/remounts: its trigger-capture (focus
  return on close), focus trap, Escape/Tab handling, and scroll lock all
  keep working unmodified, and its own initial-focus effect (keyed on
  `initialFocusRef`, which becomes `titleInputRef` only once the mode
  becomes create/edit) naturally refocuses the Title input on that
  transition. No dialog stacking, no second backdrop/Escape listener --
  exactly one ResponsiveDialog is ever open at a time.

  Closing from an edit/create reached via the day popup (Cancel, a
  successful Save, or a successful Delete) closes the WHOLE dialog back to
  the grid rather than returning to the day view -- CalendarEventForm's own
  onClose() is not mode-aware (by design: it is not touched by this
  redesign), so this is the one deliberate simplification, not an oversight.
*/

export type CalendarDialogMode =
  | { mode: "day"; date: DateOnly }
  | { mode: "create"; defaultDate: DateOnly }
  | { mode: "edit"; event: ManualCalendarEventItem };

export type CalendarDayDialogSharedProps = {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  /** The currently selected day's items. Read only in "day" mode. */
  items: CalendarItem[];
  onClose: () => void;
  onSaved: (item: ManualCalendarEventItem) => void;
  onDeleted: (itemId: string) => void;
  onEditFromDay: (item: ManualCalendarEventItem) => void;
  onCreateFromDay: (date: DateOnly) => void;
  projectOptions: CalendarProjectOption[];
  clientOptions: CalendarClientOption[];
  projectsTruncated: boolean;
  clientsTruncated: boolean;
  optionsLoading: boolean;
  optionsError: string | null;
  onRetryOptions: () => void;
};

export type CalendarDayDialogProps = CalendarDialogMode & CalendarDayDialogSharedProps;

export function CalendarDayDialog(props: CalendarDayDialogProps) {
  const {
    open,
    triggerRef,
    items,
    onClose,
    onSaved,
    onDeleted,
    onEditFromDay,
    onCreateFromDay,
    projectOptions,
    clientOptions,
    projectsTruncated,
    clientsTruncated,
    optionsLoading,
    optionsError,
    onRetryOptions,
  } = props;

  const headingId = useId();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false);

  // Defensive reset on a fresh open -- see AddEditCalendarEventDialog's
  // original comment (this is the same pattern, unchanged): adjusted during
  // render, not in an effect, so no stale-state frame is ever visible.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBusy(false);
      setDeleteConfirmPending(false);
    }
  }

  function handleRequestClose() {
    if (deleteConfirmPending) {
      setDeleteConfirmPending(false);
      return;
    }
    onClose();
  }

  const content =
    props.mode === "day" ? (
      <CalendarDayAgendaView
        headingId={headingId}
        date={props.date}
        items={items}
        onEditEvent={(item) => onEditFromDay(item)}
        onAddEvent={() => onCreateFromDay(props.date)}
      />
    ) : (
      <CalendarEventForm
        {...(props.mode === "create"
          ? ({ mode: "create", defaultDate: props.defaultDate } satisfies CalendarEventFormMode)
          : ({ mode: "edit", event: props.event } satisfies CalendarEventFormMode))}
        headingId={headingId}
        titleInputRef={titleInputRef}
        onSaved={onSaved}
        onDeleted={onDeleted}
        onClose={onClose}
        projectOptions={projectOptions}
        clientOptions={clientOptions}
        projectsTruncated={projectsTruncated}
        clientsTruncated={clientsTruncated}
        optionsLoading={optionsLoading}
        optionsError={optionsError}
        onRetryOptions={onRetryOptions}
        busy={busy}
        onBusyChange={setBusy}
        deleteConfirmPending={deleteConfirmPending}
        onDeleteConfirmPendingChange={setDeleteConfirmPending}
      />
    );

  return (
    <ResponsiveDialog
      open={open}
      onRequestClose={handleRequestClose}
      triggerRef={triggerRef}
      initialFocusRef={props.mode === "day" ? undefined : titleInputRef}
      busy={busy}
      aria-labelledby={headingId}
    >
      {/* Purely a visual-polish wash behind the heading -- a plain <div>
          with only a `background`, no padding/margin of its own, so it adds
          zero spacing/positioning change; the close button below stays
          positioned relative to the same ancestor (ResponsiveDialog's own
          panel) as before, since this wrapper is never given `position`. */}
      <div style={panelAccentStyle}>
        {/* A sibling overlay, not a CalendarEventForm/SelectedDayAgenda
            change -- one subtle close X applies uniformly across all three
            modes (day/create/edit) without touching either component's own
            heading markup. Disabled while busy, matching every other
            dismissal path (Escape/backdrop) already respecting `busy`. */}
        <button
          type="button"
          aria-label="Close"
          onClick={handleRequestClose}
          disabled={busy}
          style={closeButtonStyle}
        >
          <span aria-hidden="true">&times;</span>
        </button>
        {content}
      </div>
    </ResponsiveDialog>
  );
}

function CalendarDayAgendaView({
  headingId,
  date,
  items,
  onEditEvent,
  onAddEvent,
}: {
  headingId: string;
  date: DateOnly;
  items: CalendarItem[];
  onEditEvent: CalendarAgendaItemEditCallback;
  onAddEvent: () => void;
}) {
  return (
    <div style={stack(5)}>
      <SelectedDayAgenda headingId={headingId} date={date} items={items} onEditEvent={onEditEvent} />

      {/* Compact footer: closing is owned entirely by the dialog's own
          close X / Escape / backdrop now -- a separate "Close" text button
          here would just be a redundant, less discoverable duplicate. */}
      <div style={footerRowStyle}>
        <DashboardButton type="button" variant="primary" onClick={onAddEvent}>
          + Add event
        </DashboardButton>
      </div>
    </div>
  );
}

const panelAccentStyle: CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(37, 99, 235, 0.07) 0%, rgba(124, 58, 237, 0.04) 45%, transparent 78%)",
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: dashboardSpacing[3],
  right: dashboardSpacing[3],
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 36,
  minHeight: 36,
  borderRadius: dashboardRadii.full,
  border: `1px solid ${dashboardColors.border.subtle}`,
  background: dashboardColors.background.surface,
  color: dashboardColors.text.secondary,
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: dashboardShadows.xs,
  zIndex: 1,
};

const footerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: dashboardSpacing[3],
  paddingTop: dashboardSpacing[3],
  borderTop: `1px solid ${dashboardColors.border.subtle}`,
};
