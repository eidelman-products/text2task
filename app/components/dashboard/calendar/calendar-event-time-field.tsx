"use client";

import { useId, type ChangeEvent } from "react";

import { parseTimeOnly, type TimeOnly } from "@/lib/calendar/time-only";
import { fieldLabel, inputBase } from "../ui/styles";
import { dashboardSpacing } from "../ui/tokens";

/*
  Native `<input type="time">` wrapper, converting to/from `TimeOnly` at its
  own boundary -- never inside CalendarEventForm directly. No `step`
  attribute is set: without one, every evergreen browser's own time input
  never emits seconds, matching TimeOnly's own HH:MM-only, no-seconds
  contract with zero extra stripping logic needed.
*/

export type CalendarEventTimeFieldProps = {
  value: TimeOnly | null;
  onChange: (next: TimeOnly | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
  id?: string;
};

export function CalendarEventTimeField({
  value,
  onChange,
  disabled = false,
  invalid = false,
  "aria-describedby": ariaDescribedBy,
  id,
}: CalendarEventTimeFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    if (raw === "") {
      onChange(null);
      return;
    }
    // parseTimeOnly already returns `TimeOnly | null` -- a malformed or
    // partial value (e.g. a browser mid-entry state) simply maps to `null`
    // here, never a forced/unsafe cast to TimeOnly.
    onChange(parseTimeOnly(raw));
  }

  return (
    <div style={{ display: "grid", gap: dashboardSpacing[1] }}>
      <label htmlFor={inputId} style={fieldLabel}>
        Time
      </label>
      <input
        id={inputId}
        type="time"
        value={value ?? ""}
        onChange={handleChange}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        style={inputBase}
      />
    </div>
  );
}
