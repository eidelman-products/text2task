"use client";

import type { DateOnly } from "@/lib/tasks/date-only";
import { DateField } from "../ui/calendar/date-field";

/*
  Thin, controlled adapter over the existing, unmodified `DateField`
  primitive (app/components/dashboard/ui/calendar/date-field.tsx), matching
  the exact thin-wrapper pattern `DeadlineField`
  (app/components/dashboard/tasks/deadline-field.tsx) already establishes.
  No custom date parsing lives here -- `value`/`onChange` pass DateOnly
  straight through to `DateField`'s own, already-tested contract.

  Nested DatePicker behavior needs no wiring here: DatePickerPopover (via
  DateField) already consumes ResponsiveDialog's NestedOverlayContext
  automatically whenever an ancestor ResponsiveDialog provides one -- this
  field renders identically whether that ancestor exists or not.

  Accessibility note: `DateField` does not accept an `aria-invalid` prop (it
  cannot be modified in this phase), so a validation error cannot be placed
  directly on its internal trigger button -- `aria-invalid` is also not a
  supported attribute on `role="group"` (it belongs on the actual invalid
  control), so this wrapper does not attempt to set it anywhere. It still
  forwards `aria-describedby` (which `DateField` does support), so a
  caller-rendered inline error remains programmatically associated with the
  trigger; `invalid` is exposed only as a plain `data-invalid` attribute for
  optional caller-side styling, never as an ARIA attribute misuse.
*/

export type CalendarEventDateFieldProps = {
  value: DateOnly | null;
  onChange: (next: DateOnly | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
};

export function CalendarEventDateField({
  value,
  onChange,
  disabled = false,
  invalid = false,
  "aria-describedby": ariaDescribedBy,
}: CalendarEventDateFieldProps) {
  return (
    <div data-invalid={invalid || undefined}>
      <DateField
        value={value}
        onChange={onChange}
        disabled={disabled}
        label="Date"
        placeholder="Set the event date"
        aria-describedby={ariaDescribedBy}
      />
    </div>
  );
}
