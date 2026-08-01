"use client";

import {
  useId,
  useMemo,
  useState,
  type FormEvent,
  type RefObject,
} from "react";

import type { DateOnly } from "@/lib/tasks/date-only";
import type { TimeOnly } from "@/lib/calendar/time-only";
import type {
  CalendarClientOption,
  CalendarProjectOption,
  ManualCalendarEventItem,
  UpdateCalendarEventInput,
} from "@/lib/calendar/calendar-types";
import { CreateCalendarEventInputSchema } from "@/lib/calendar/calendar-schemas";
import {
  createCalendarEventClient,
  updateCalendarEventClient,
  deleteCalendarEventClient,
} from "@/lib/calendar/mutate-calendar-event.client";
import { DashboardButton } from "../ui/button";
import { fieldLabel, inputBase, row, stack } from "../ui/styles";
import { dashboardColors, dashboardSpacing, dashboardTypography } from "../ui/tokens";
import { CalendarEventDateField } from "./calendar-event-date-field";
import { CalendarEventTimeField } from "./calendar-event-time-field";
import { CalendarEventProjectField } from "./calendar-event-project-field";
import { CalendarEventClientField } from "./calendar-event-client-field";
import type { CalendarEntityComboboxValue } from "./calendar-entity-combobox";

/*
  Owns all Add/Edit Manual Event form field state, client-side validation,
  request-body assembly (create vs. dirty-diff edit), the mutation network
  calls themselves, and the edit-mode-only inline two-step Delete flow.

  `busy` and `deleteConfirmPending` are BOTH fully controlled from the
  parent (AddEditCalendarEventDialog) via prop + change-callback pairs, not
  owned here -- deleteConfirmPending must be visible to the dialog's own
  ResponsiveDialog onRequestClose handler (to step back instead of closing),
  and busy must reach ResponsiveDialog's own busy prop, both of which only
  the dialog (the ResponsiveDialog caller) can wire. This form never reaches
  into ResponsiveDialog or an imperative ref to do either itself.
*/

export type CalendarEventFormMode =
  | { mode: "create"; defaultDate: DateOnly }
  | { mode: "edit"; event: ManualCalendarEventItem };

export type CalendarEventFormSharedProps = {
  headingId: string;
  titleInputRef?: RefObject<HTMLInputElement | null>;
  onSaved: (item: ManualCalendarEventItem) => void;
  onDeleted: (itemId: string) => void;
  onClose: () => void;
  projectOptions: CalendarProjectOption[];
  clientOptions: CalendarClientOption[];
  projectsTruncated: boolean;
  clientsTruncated: boolean;
  optionsLoading: boolean;
  optionsError: string | null;
  onRetryOptions: () => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  deleteConfirmPending: boolean;
  onDeleteConfirmPendingChange: (pending: boolean) => void;
};

export type CalendarEventFormProps = CalendarEventFormMode & CalendarEventFormSharedProps;

type FormState = {
  title: string;
  date: DateOnly | null;
  time: TimeOnly | null;
  /** UI-level string; "" (never null) represents "no notes entered yet". */
  notes: string;
  projectId: string | null;
  customProjectName: string | null;
  clientId: string | null;
  customClientName: string | null;
};

type InitialValues = {
  title: string;
  date: DateOnly | null;
  time: TimeOnly | null;
  /** Normalized (trimmed, blank -> null) -- matches what the server stores. */
  notes: string | null;
  projectId: string | null;
  customProjectName: string | null;
  clientId: string | null;
  customClientName: string | null;
};

/** The four relationship fields, independent of whatever else FormState/InitialValues carry. */
type RelationshipFields = {
  projectId: string | null;
  customProjectName: string | null;
  clientId: string | null;
  customClientName: string | null;
};

function buildInitialState(props: CalendarEventFormMode): { form: FormState; initial: InitialValues } {
  if (props.mode === "create") {
    return {
      form: {
        title: "",
        date: props.defaultDate,
        time: null,
        notes: "",
        projectId: null,
        customProjectName: null,
        clientId: null,
        customClientName: null,
      },
      initial: {
        title: "",
        date: props.defaultDate,
        time: null,
        notes: null,
        projectId: null,
        customProjectName: null,
        clientId: null,
        customClientName: null,
      },
    };
  }

  const { event } = props;
  return {
    form: {
      title: event.title,
      date: event.date,
      time: event.time,
      notes: event.notes ?? "",
      projectId: event.projectId,
      customProjectName: event.customProjectName,
      clientId: event.clientId,
      customClientName: event.customClientName,
    },
    initial: {
      title: event.title,
      date: event.date,
      time: event.time,
      notes: event.notes,
      projectId: event.projectId,
      customProjectName: event.customProjectName,
      clientId: event.clientId,
      customClientName: event.customClientName,
    },
  };
}

function normalizeNotes(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Derives the `projectId`/`customProjectName`/`clientId`/`customClientName`
 * keys (if any) an edit-mode PATCH body should include, per this feature's
 * locked relationship rules -- via independent per-field value comparisons,
 * never falsy coercion, and never collapsing an explicit clear into
 * omission.
 *
 * Project and its custom name are treated as one relationship: unchanged
 * (both fields identical to initial) omits both keys entirely, preserving
 * whatever the server already has (including a clear-then-reselect-original
 * round trip). A genuinely different, non-null (existing) project sends
 * `projectId` (and `customProjectName` only if it also changed, e.g. moving
 * off a previous custom name) but deliberately never a client-derived
 * `clientId`/`customClientName` -- the server always re-derives/clears the
 * client side unconditionally whenever a non-null `projectId` is part of a
 * relationship-touching write (calendar-link-validation.server.ts), and
 * remains authoritative there. Only once the project side is either
 * unchanged or cleared/custom (never a newly-linked existing project) is
 * Client's own pair independently diffed the same way.
 */
function deriveRelationshipPatch(
  initial: RelationshipFields,
  current: RelationshipFields
): Pick<UpdateCalendarEventInput, "projectId" | "customProjectName" | "clientId" | "customClientName"> {
  const patch: Pick<UpdateCalendarEventInput, "projectId" | "customProjectName" | "clientId" | "customClientName"> = {};

  const projectChanged =
    current.projectId !== initial.projectId || current.customProjectName !== initial.customProjectName;

  if (projectChanged) {
    if (current.projectId !== initial.projectId) patch.projectId = current.projectId;
    if (current.customProjectName !== initial.customProjectName) {
      patch.customProjectName = current.customProjectName;
    }

    if (current.projectId !== null) {
      return patch;
    }
  }

  if (current.clientId !== initial.clientId) patch.clientId = current.clientId;
  if (current.customClientName !== initial.customClientName) patch.customClientName = current.customClientName;

  return patch;
}

function combineIds(...ids: Array<string | undefined | false>): string | undefined {
  const filtered = ids.filter((id): id is string => Boolean(id));
  return filtered.length > 0 ? filtered.join(" ") : undefined;
}

export function CalendarEventForm(props: CalendarEventFormProps) {
  const {
    headingId,
    titleInputRef,
    onSaved,
    onDeleted,
    onClose,
    projectOptions,
    clientOptions,
    projectsTruncated,
    clientsTruncated,
    optionsLoading,
    optionsError,
    onRetryOptions,
    busy,
    onBusyChange,
    deleteConfirmPending,
    onDeleteConfirmPendingChange,
  } = props;

  const idPrefix = useId();
  const [{ form: initialForm, initial }] = useState(() => buildInitialState(props));
  const [title, setTitle] = useState(initialForm.title);
  const [date, setDate] = useState<DateOnly | null>(initialForm.date);
  const [time, setTime] = useState<TimeOnly | null>(initialForm.time);
  const [notes, setNotes] = useState(initialForm.notes);
  const [projectId, setProjectId] = useState<string | null>(initialForm.projectId);
  const [customProjectName, setCustomProjectName] = useState<string | null>(initialForm.customProjectName);
  const [clientId, setClientId] = useState<string | null>(initialForm.clientId);
  const [customClientName, setCustomClientName] = useState<string | null>(initialForm.customClientName);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isEdit = props.mode === "edit";
  const existingEvent = props.mode === "edit" ? props.event : null;

  const optionsDisabled = optionsLoading || optionsError !== null;

  // While options are still loading in edit mode, show the event's already-
  // known project/client text (not a blank/mismatched select) rather than
  // waiting on the network -- the field itself stays dumb; this form
  // synthesizes a one-item placeholder option so it has something valid to
  // display, per the manual events mapping's own §13 loading-state note.
  const projectOptionsForDisplay = useMemo(() => {
    if (!isEdit || !optionsLoading) return projectOptions;
    if (projectId === null) return projectOptions;
    if (projectOptions.some((option) => option.id === projectId)) return projectOptions;

    return [
      ...projectOptions,
      {
        id: projectId,
        title: existingEvent?.projectTitle ?? "Loading…",
        clientId: existingEvent?.clientId ?? null,
        clientName: existingEvent?.clientName ?? null,
        isArchived: false,
      },
    ];
  }, [isEdit, optionsLoading, projectId, projectOptions, existingEvent]);

  const clientOptionsForDisplay = useMemo(() => {
    if (!isEdit || !optionsLoading || projectId !== null) return clientOptions;
    if (clientId === null) return clientOptions;
    if (clientOptions.some((option) => option.id === clientId)) return clientOptions;

    return [
      ...clientOptions,
      { id: clientId, name: existingEvent?.clientName ?? "Loading…" },
    ];
  }, [isEdit, optionsLoading, projectId, clientId, clientOptions, existingEvent]);

  const projectOptionsById = useMemo(() => {
    const map = new Map<string, CalendarProjectOption>();
    for (const option of projectOptionsForDisplay) map.set(option.id, option);
    return map;
  }, [projectOptionsForDisplay]);

  const isClientLocked = projectId !== null;
  const lockedClientName = isClientLocked
    ? (projectOptionsById.get(projectId)?.clientName ?? null)
    : null;

  function handleProjectChange(next: CalendarEntityComboboxValue) {
    if (next.id === projectId && next.customName === customProjectName) return; // no-op
    setProjectId(next.id);
    setCustomProjectName(next.customName);
    if (next.id !== null) {
      // Selecting an existing project always resets the effective client to
      // that project's own current client -- discarding any client value
      // chosen while Client was briefly unlocked during an intervening
      // clear -- and a linked project is never paired with a custom Client
      // name.
      const selected = projectOptionsById.get(next.id);
      setClientId(selected?.clientId ?? null);
      setCustomClientName(null);
    }
    // Clearing, or typing a custom Project name (next.id === null either
    // way), intentionally leaves Client's own state untouched -- it
    // unlocks (if it was locked) and retains whatever it was showing.
  }

  function handleClientChange(next: CalendarEntityComboboxValue) {
    setClientId(next.id);
    setCustomClientName(next.customName);
  }

  const titleErrorId = `${idPrefix}-title-error`;
  const dateErrorId = `${idPrefix}-date-error`;
  const notesErrorId = `${idPrefix}-notes-error`;
  const projectTruncatedId = `${idPrefix}-project-truncated`;
  const clientTruncatedId = `${idPrefix}-client-truncated`;
  const saveErrorId = `${idPrefix}-save-error`;
  const deleteErrorId = `${idPrefix}-delete-error`;

  function validate(): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    if (title.trim().length === 0) {
      errors.title = "Title is required.";
    }
    if (date === null) {
      errors.date = "Date is required.";
    }

    // Reuses the real, already-live CreateCalendarEventInputSchema for
    // every shape/length rule (title max length, notes max length) rather
    // than re-deriving a second, independently-maintained set of limits.
    const candidate = {
      title: title.trim(),
      eventDate: date ?? "",
      eventTime: time,
      notes: normalizeNotes(notes),
      projectId,
      customProjectName,
      clientId,
      customClientName,
    };
    const result = CreateCalendarEventInputSchema.safeParse(candidate);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key === "eventDate") {
          if (!("date" in errors)) errors.date = issue.message;
          continue;
        }
        if (key && !(key in errors)) {
          errors[key] = issue.message;
        }
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (busy || deleteConfirmPending) return;

    const { valid, errors } = validate();
    setFieldErrors(errors);
    if (!valid) return;

    setSaveError(null);

    if (props.mode === "edit" && existingEvent) {
      const relationshipPatch = deriveRelationshipPatch(initial, {
        projectId,
        customProjectName,
        clientId,
        customClientName,
      });
      const patch: UpdateCalendarEventInput = { ...relationshipPatch };

      const trimmedTitle = title.trim();
      if (trimmedTitle !== initial.title) patch.title = trimmedTitle;
      if (date !== null && date !== initial.date) patch.eventDate = date;
      if (time !== initial.time) patch.eventTime = time;
      const normalizedNotes = normalizeNotes(notes);
      if (normalizedNotes !== initial.notes) patch.notes = normalizedNotes;

      if (Object.keys(patch).length === 0) {
        // Nothing genuinely changed -- never send an empty PATCH (and never
        // add a fake field merely to avoid one); there's nothing to save.
        onClose();
        return;
      }

      onBusyChange(true);
      const result = await updateCalendarEventClient(existingEvent.id, patch);
      onBusyChange(false);

      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      onSaved(result.item);
      onClose();
      return;
    }

    if (date === null) return; // unreachable: validate() above already required a non-null date

    onBusyChange(true);
    const result = await createCalendarEventClient({
      title: title.trim(),
      eventDate: date,
      eventTime: time,
      notes: normalizeNotes(notes),
      projectId,
      customProjectName,
      clientId,
      customClientName,
    });
    onBusyChange(false);

    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    onSaved(result.item);
    onClose();
  }

  function handleCancelClick() {
    if (busy) return;
    if (deleteConfirmPending) {
      onDeleteConfirmPendingChange(false);
      setDeleteError(null);
      return;
    }
    onClose();
  }

  function handleDeleteClick() {
    if (busy) return;
    onDeleteConfirmPendingChange(true);
  }

  function handleCancelDelete() {
    onDeleteConfirmPendingChange(false);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (busy || !existingEvent) return;

    onBusyChange(true);
    const result = await deleteCalendarEventClient(existingEvent.id);
    onBusyChange(false);

    if (!result.ok) {
      setDeleteError(result.error);
      return; // stay in confirm state so the user can retry immediately
    }
    onDeleted(existingEvent.id);
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} style={stack(4)} noValidate>
      <h2 id={headingId} style={headingStyle}>
        {isEdit ? "Edit event" : "Add event"}
      </h2>

      {optionsError ? (
        <div role="alert" style={bannerStyle}>
          <span>{optionsError}</span>
          <DashboardButton type="button" variant="soft" size="sm" onClick={onRetryOptions}>
            Retry
          </DashboardButton>
        </div>
      ) : null}

      {saveError ? (
        <div id={saveErrorId} role="alert" style={bannerStyle}>
          {saveError}
        </div>
      ) : null}

      <div style={stack(1)}>
        <label htmlFor={`${idPrefix}-title`} style={fieldLabel}>
          Title
        </label>
        <input
          id={`${idPrefix}-title`}
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(changeEvent) => setTitle(changeEvent.target.value)}
          disabled={busy}
          aria-invalid={Boolean(fieldErrors.title) || undefined}
          aria-describedby={combineIds(fieldErrors.title && titleErrorId)}
          style={inputBase}
        />
        {fieldErrors.title ? (
          <p id={titleErrorId} role="alert" style={errorTextStyle}>
            {fieldErrors.title}
          </p>
        ) : null}
      </div>

      <div style={row(4, "flex-start")}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CalendarEventDateField
            value={date}
            onChange={setDate}
            disabled={busy}
            invalid={Boolean(fieldErrors.date)}
            aria-describedby={combineIds(fieldErrors.date && dateErrorId)}
          />
          {fieldErrors.date ? (
            <p id={dateErrorId} role="alert" style={errorTextStyle}>
              {fieldErrors.date}
            </p>
          ) : null}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CalendarEventTimeField value={time} onChange={setTime} disabled={busy} />
        </div>
      </div>

      <div style={row(4, "flex-start")}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CalendarEventProjectField
            value={projectId}
            customValue={customProjectName}
            onChange={handleProjectChange}
            options={projectOptionsForDisplay}
            disabled={busy || optionsDisabled}
            aria-describedby={combineIds(projectsTruncated && projectTruncatedId)}
          />
          {projectsTruncated ? (
            <p id={projectTruncatedId} style={truncatedNoteStyle}>
              Showing the first 200 projects.
            </p>
          ) : null}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CalendarEventClientField
            value={clientId}
            customValue={customClientName}
            onChange={handleClientChange}
            options={clientOptionsForDisplay}
            locked={isClientLocked}
            lockedClientName={lockedClientName}
            disabled={busy || optionsDisabled}
            aria-describedby={combineIds(clientsTruncated && clientTruncatedId)}
          />
          {clientsTruncated ? (
            <p id={clientTruncatedId} style={truncatedNoteStyle}>
              Showing the first 200 clients.
            </p>
          ) : null}
        </div>
      </div>

      <div style={stack(1)}>
        <label htmlFor={`${idPrefix}-notes`} style={fieldLabel}>
          Notes
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          value={notes}
          onChange={(changeEvent) => setNotes(changeEvent.target.value)}
          disabled={busy}
          rows={4}
          aria-invalid={Boolean(fieldErrors.notes) || undefined}
          aria-describedby={combineIds(fieldErrors.notes && notesErrorId)}
          style={{ ...inputBase, resize: "vertical" }}
        />
        {fieldErrors.notes ? (
          <p id={notesErrorId} role="alert" style={errorTextStyle}>
            {fieldErrors.notes}
          </p>
        ) : null}
      </div>

      {isEdit && deleteConfirmPending ? (
        <div style={deleteConfirmRowStyle}>
          <span style={{ fontWeight: dashboardTypography.weight.bold }}>
            Delete this event?
          </span>
          {deleteError ? (
            <p id={deleteErrorId} role="alert" style={errorTextStyle}>
              {deleteError}
            </p>
          ) : null}
          <div style={row(2)}>
            <DashboardButton
              type="button"
              variant="danger"
              disabled={busy}
              onClick={handleConfirmDelete}
            >
              Confirm delete
            </DashboardButton>
            <DashboardButton
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={handleCancelDelete}
            >
              Cancel delete
            </DashboardButton>
          </div>
        </div>
      ) : null}

      <div style={actionRowStyle}>
        {isEdit && !deleteConfirmPending ? (
          <DashboardButton
            type="button"
            variant="danger"
            disabled={busy}
            onClick={handleDeleteClick}
          >
            Delete
          </DashboardButton>
        ) : (
          <span />
        )}
        <div style={row(2)}>
          <DashboardButton type="button" variant="ghost" disabled={busy} onClick={handleCancelClick}>
            Cancel
          </DashboardButton>
          <DashboardButton type="submit" variant="primary" loading={busy} disabled={deleteConfirmPending}>
            Save
          </DashboardButton>
        </div>
      </div>
    </form>
  );
}

const headingStyle = {
  margin: 0,
  fontSize: dashboardTypography.size.xl,
  fontWeight: dashboardTypography.weight.bold,
  color: dashboardColors.text.primary,
};

const bannerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: dashboardSpacing[3],
  padding: dashboardSpacing[3],
  borderRadius: 12,
  background: dashboardColors.status.redSoft,
  color: dashboardColors.status.red,
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.medium,
} as const;

const errorTextStyle = {
  margin: 0,
  color: dashboardColors.status.red,
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.medium,
} as const;

const truncatedNoteStyle = {
  margin: 0,
  color: dashboardColors.text.muted,
  fontSize: dashboardTypography.size.xs,
} as const;

const deleteConfirmRowStyle = {
  display: "grid",
  gap: dashboardSpacing[2],
  padding: dashboardSpacing[3],
  borderRadius: 12,
  background: dashboardColors.status.redSoft,
} as const;

const actionRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: dashboardSpacing[3],
} as const;
