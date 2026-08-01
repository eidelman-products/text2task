"use client";

import { useId } from "react";

import type { CalendarClientOption } from "@/lib/calendar/calendar-types";
import { fieldLabel, inputBase } from "../ui/styles";
import { dashboardSpacing } from "../ui/tokens";
import { CalendarEntityCombobox, type CalendarEntityComboboxOption, type CalendarEntityComboboxValue } from "./calendar-entity-combobox";

/*
  Thin wrapper around the shared CalendarEntityCombobox for the Client
  picker -- CalendarEventForm derives `locked`/`lockedClientName` from its
  own two-independent-flags historical-client rule (§9 of the manual events
  mapping); this field has no network knowledge and no relationship logic
  of its own -- it only renders whatever locked state it's given.

  When `locked` is true, this renders a single, disabled, read-only text
  input showing the derived client (or "No client" when the locked project
  has none) -- `value`/`customValue`/`options` are ignored for rendering in
  that state, since the locked display is a preview the server remains
  authoritative over, not a real independently-selectable value. Locked mode
  intentionally does not mount the interactive combobox at all, so there is
  no stale internal text-state to reconcile when a Project is linked/cleared.
*/

export type CalendarEventClientFieldProps = {
  value: string | null;
  customValue: string | null;
  onChange: (next: CalendarEntityComboboxValue) => void;
  options: CalendarClientOption[];
  locked: boolean;
  /** Only meaningful when `locked` is true; `null` renders "No client". */
  lockedClientName: string | null;
  disabled?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
  id?: string;
};

export function CalendarEventClientField({
  value,
  customValue,
  onChange,
  options,
  locked,
  lockedClientName,
  disabled = false,
  invalid = false,
  "aria-describedby": ariaDescribedBy,
  id,
}: CalendarEventClientFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  if (locked) {
    return (
      <div style={{ display: "grid", gap: dashboardSpacing[1] }}>
        <label htmlFor={inputId} style={fieldLabel}>
          Client
        </label>
        <input
          id={inputId}
          type="text"
          value={lockedClientName ?? "No client"}
          disabled
          readOnly
          aria-invalid={invalid || undefined}
          aria-describedby={ariaDescribedBy}
          style={{ ...inputBase, minHeight: 44 }}
        />
      </div>
    );
  }

  const comboboxOptions: CalendarEntityComboboxOption[] = options.map((option) => ({
    id: option.id,
    label: option.name,
  }));

  return (
    <CalendarEntityCombobox
      id={inputId}
      label="Client"
      placeholder="Search or enter a client"
      value={{ id: value, customName: customValue }}
      onChange={onChange}
      options={comboboxOptions}
      disabled={disabled}
      invalid={invalid}
      aria-describedby={ariaDescribedBy}
    />
  );
}
