"use client";

import type { DateOnly } from "@/lib/tasks/date-only";
import { DateField } from "../ui/calendar/date-field";

/*
  Thin, product-facing adapter over the generic `DateField` UI primitive (see
  app/components/dashboard/ui/calendar/date-field.tsx). This is what Wave-2
  tracks import into project-meta-editor.tsx etc. -- it exists so the
  product-facing name/contract (`onCommit`, matching the existing
  `EditableMetaTextField`'s commit-on-explicit-action pattern already used in
  this codebase) is stable even if `DateField`'s own generic prop names ever
  need to differ.

  Deliberately thin: no business logic, no fetch/Supabase/API-route imports,
  just prop mapping and this repo's default copy for a deadline field.
  `label` defaults to "Deadline" (the Task CRM / Extract Review copy) but is
  overridable per call site -- e.g. Project Updates' suggested-value editor
  passes "Suggested deadline" so it reads correctly next to the adjacent
  "Current deadline" read-only comparison.
*/

export type DeadlineFieldProps = {
  value: DateOnly | null;
  onCommit: (next: DateOnly | null) => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
};

export function DeadlineField({
  value,
  onCommit,
  disabled = false,
  loading = false,
  label = "Deadline",
}: DeadlineFieldProps) {
  return (
    <DateField
      value={value}
      onChange={onCommit}
      disabled={disabled}
      loading={loading}
      label={label}
      placeholder="Set a deadline"
      todayLabel="Today"
      clearLabel="Clear"
    />
  );
}
