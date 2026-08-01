"use client";

import type { CalendarProjectOption } from "@/lib/calendar/calendar-types";
import { CalendarEntityCombobox, type CalendarEntityComboboxOption, type CalendarEntityComboboxValue } from "./calendar-entity-combobox";

/*
  Thin wrapper around the shared CalendarEntityCombobox for the Project
  picker -- maps CalendarProjectOption[] (title, isArchived) into the
  combobox's generic {id, label, suffix} shape and back out again. No
  fetch, no cache, and no Client-lock business logic (that lives in
  CalendarEventForm, which derives the Client field's locked state from
  this field's own onChange, per the manual events mapping's own §9).
*/

export type CalendarEventProjectFieldProps = {
  value: string | null;
  customValue: string | null;
  onChange: (next: CalendarEntityComboboxValue) => void;
  options: CalendarProjectOption[];
  disabled?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
  id?: string;
};

export function CalendarEventProjectField({
  value,
  customValue,
  onChange,
  options,
  disabled = false,
  invalid = false,
  "aria-describedby": ariaDescribedBy,
  id,
}: CalendarEventProjectFieldProps) {
  const comboboxOptions: CalendarEntityComboboxOption[] = options.map((option) => ({
    id: option.id,
    label: option.title,
    suffix: option.isArchived ? "(Archived)" : undefined,
  }));

  return (
    <CalendarEntityCombobox
      id={id}
      label="Project"
      placeholder="Search or enter a project"
      value={{ id: value, customName: customValue }}
      onChange={onChange}
      options={comboboxOptions}
      disabled={disabled}
      invalid={invalid}
      aria-describedby={ariaDescribedBy}
    />
  );
}
