"use client";

import { useId, useRef, useState, type RefObject } from "react";

import type {
  CalendarClientOption,
  CalendarProjectOption,
  ManualCalendarEventItem,
} from "@/lib/calendar/calendar-types";
import { ResponsiveDialog } from "../ui/responsive-dialog";
import { CalendarEventForm, type CalendarEventFormMode } from "./calendar-event-form";

/*
  Composes ResponsiveDialog + CalendarEventForm into the one public Add/Edit
  Manual Event dialog. Owns only open/close wiring, the Title-input initial-
  focus ref, and the two pieces of state ResponsiveDialog itself needs to see
  from the outside: `busy` (mirrored from the form) and `deleteConfirmPending`
  (needed by this component's own onRequestClose so a still-open delete
  confirmation steps back instead of closing the dialog). Neither is an
  imperative ref -- both are plain controlled state, threaded down to
  CalendarEventForm via prop + change-callback pairs.

  No options fetch, no Calendar reconciliation logic, no second mobile form
  -- this component (and everything it renders) is production-inert until a
  future Phase D wires it into WorkCalendarClient.
*/

export type AddEditCalendarEventDialogSharedProps = {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSaved: (item: ManualCalendarEventItem) => void;
  onDeleted: (itemId: string) => void;
  projectOptions: CalendarProjectOption[];
  clientOptions: CalendarClientOption[];
  projectsTruncated: boolean;
  clientsTruncated: boolean;
  optionsLoading: boolean;
  optionsError: string | null;
  onRetryOptions: () => void;
};

export type AddEditCalendarEventDialogProps = CalendarEventFormMode &
  AddEditCalendarEventDialogSharedProps;

export function AddEditCalendarEventDialog(props: AddEditCalendarEventDialogProps) {
  const {
    open,
    triggerRef,
    onClose,
    onSaved,
    onDeleted,
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

  // Defensive reset on a fresh open -- this component may stay mounted
  // across close/reopen cycles (a future caller very plausibly keeps one
  // instance and toggles `open`), while ResponsiveDialog's own children
  // (and CalendarEventForm's own field state) already remount fresh each
  // time since ResponsiveDialog renders null while closed. Adjusted during
  // render (React's own documented pattern for this exact case), not in an
  // effect -- an effect-based reset would commit one extra, visible frame
  // with the stale busy/deleteConfirmPending values still in effect.
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

  const modeProps: CalendarEventFormMode =
    props.mode === "create"
      ? { mode: "create", defaultDate: props.defaultDate }
      : { mode: "edit", event: props.event };

  return (
    <ResponsiveDialog
      open={open}
      onRequestClose={handleRequestClose}
      triggerRef={triggerRef}
      initialFocusRef={titleInputRef}
      busy={busy}
      aria-labelledby={headingId}
    >
      <CalendarEventForm
        {...modeProps}
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
    </ResponsiveDialog>
  );
}
