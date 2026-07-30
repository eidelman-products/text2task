"use client";

import { useId, type ChangeEvent } from "react";

import type { CalendarClientOption } from "@/lib/calendar/calendar-types";
import { fieldLabel, inputBase } from "../ui/styles";
import { dashboardSpacing } from "../ui/tokens";

/*
  Native <select> wrapper for the Client picker. Purely controlled/presentational
  -- CalendarEventForm derives `locked`/`lockedClientName` from its own
  two-independent-flags historical-client rule (§9 of the manual events
  mapping); this field has no network knowledge and no relationship logic
  of its own -- it only renders whatever locked state it's given.

  When `locked` is true, the field renders a single, disabled option showing
  the derived client (or "No client" when the locked project has none) --
  `value`/`options` are ignored for rendering in that state, since the
  locked display is a preview the server remains authoritative over, not a
  real independently-selectable value.
*/

export type CalendarEventClientFieldProps = {
  value: string | null;
  onChange: (next: string | null) => void;
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
  const selectId = id ?? generatedId;
  const isDisabled = disabled || locked;

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onChange(event.target.value === "" ? null : event.target.value);
  }

  return (
    <div style={{ display: "grid", gap: dashboardSpacing[1] }}>
      <label htmlFor={selectId} style={fieldLabel}>
        Client
      </label>
      <select
        id={selectId}
        value={locked ? "" : (value ?? "")}
        onChange={handleChange}
        disabled={isDisabled}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        style={{ ...inputBase, minHeight: 44 }}
      >
        {locked ? (
          <option value="">{lockedClientName ?? "No client"}</option>
        ) : (
          <>
            <option value="">No client</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
