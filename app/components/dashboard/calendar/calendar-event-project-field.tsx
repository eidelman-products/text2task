"use client";

import { useId, type ChangeEvent } from "react";

import type { CalendarProjectOption } from "@/lib/calendar/calendar-types";
import { fieldLabel, inputBase } from "../ui/styles";
import { dashboardSpacing } from "../ui/tokens";

/*
  Native <select> wrapper for the Project picker. Purely controlled/presentational
  -- no fetch, no cache, and no Client-lock business logic (that lives in
  CalendarEventForm, which derives the Client field's locked state from
  this field's own onChange, §9 of the manual events mapping).
*/

export type CalendarEventProjectFieldProps = {
  value: string | null;
  onChange: (next: string | null) => void;
  options: CalendarProjectOption[];
  disabled?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
  id?: string;
};

export function CalendarEventProjectField({
  value,
  onChange,
  options,
  disabled = false,
  invalid = false,
  "aria-describedby": ariaDescribedBy,
  id,
}: CalendarEventProjectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onChange(event.target.value === "" ? null : event.target.value);
  }

  return (
    <div style={{ display: "grid", gap: dashboardSpacing[1] }}>
      <label htmlFor={selectId} style={fieldLabel}>
        Project
      </label>
      <select
        id={selectId}
        value={value ?? ""}
        onChange={handleChange}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        style={{ ...inputBase, minHeight: 44 }}
      >
        <option value="">No project</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.isArchived ? `${option.title} (Archived)` : option.title}
          </option>
        ))}
      </select>
    </div>
  );
}
