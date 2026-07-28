"use client";

import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  formatDateOnlyForA11y,
  formatDateOnlyForDisplay,
  todayDateOnly,
  type DateOnly,
} from "@/lib/tasks/date-only";
import { DashboardButton } from "../button";
import { dashboardColors, dashboardSpacing, dashboardTypography } from "../tokens";
import { fieldLabel, focusRing, inputBase, row, visuallyHidden } from "../styles";
import { Calendar } from "./calendar";
import { DatePickerPopover } from "./date-picker-popover";

/*
  The generic, reusable, persistence-agnostic date field described in
  docs/TEXT2TASK_DATE_PICKER_MAPPING.md §8/§9. This component imports nothing
  from `fetch`, Supabase, any project/task domain type, any API route path, or
  `dashboard-client.tsx` -- it is a pure UI primitive over `DateOnly | null`.

  Explicit-commit model: selecting a day, clicking Today, or clicking Clear
  calls `onChange` exactly once and closes the popover. Escape or
  click-outside never call `onChange` -- see `commit`/`closePicker` below,
  which are two entirely separate code paths so this can't regress silently.
*/

export type DateFieldProps = {
  value: DateOnly | null;
  onChange: (next: DateOnly | null) => void;
  disabled?: boolean;
  loading?: boolean;
  clearable?: boolean; // default true
  placeholder?: string;
  label: string; // required, for accessibility -- no icon-only fields
  minDate?: DateOnly;
  maxDate?: DateOnly;
  todayLabel?: string; // default "Today"
  clearLabel?: string; // default "Clear"
  id?: string;
  "aria-describedby"?: string;
};

export function DateField({
  value,
  onChange,
  disabled = false,
  loading = false,
  clearable = true,
  placeholder = "Set a date",
  label,
  minDate,
  maxDate,
  todayLabel = "Today",
  clearLabel = "Clear",
  id,
  "aria-describedby": ariaDescribedBy,
}: DateFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const triggerId = `${fieldId}-trigger`;
  const labelId = `${fieldId}-label`;

  const [isOpen, setIsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [isTriggerFocused, setIsTriggerFocused] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const isInteractive = !disabled && !loading;

  function openPicker() {
    if (!isInteractive) return;
    setIsOpen(true);
  }

  function closePicker() {
    setIsOpen(false);
  }

  function commit(next: DateOnly | null) {
    onChange(next);
    setAnnouncement(
      next ? `Selected ${formatDateOnlyForA11y(next)}` : "Date cleared"
    );
    closePicker();
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  const displayText = value ? formatDateOnlyForDisplay(value) : placeholder;

  return (
    <div style={fieldShellStyle}>
      <label id={labelId} htmlFor={triggerId} style={fieldLabel}>
        {label}
      </label>

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={!isInteractive}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-describedby={ariaDescribedBy}
        onClick={openPicker}
        onKeyDown={handleTriggerKeyDown}
        onFocus={() => setIsTriggerFocused(true)}
        onBlur={() => setIsTriggerFocused(false)}
        style={{
          ...triggerStyle,
          color: value
            ? dashboardColors.text.primary
            : dashboardColors.text.subtle,
          cursor: isInteractive ? "pointer" : "not-allowed",
          opacity: isInteractive ? 1 : 0.62,
          ...(isTriggerFocused ? focusRing : {}),
        }}
      >
        <span style={triggerTextStyle}>
          {loading ? "Saving..." : displayText}
        </span>
        <CalendarGlyph />
      </button>

      <div aria-live="polite" style={visuallyHidden}>
        {announcement}
      </div>

      <DatePickerPopover
        open={isOpen}
        onRequestClose={closePicker}
        triggerRef={triggerRef}
        aria-label={`Choose ${label.toLowerCase()} date`}
      >
        <Calendar
          value={value}
          onSelect={commit}
          minDate={minDate}
          maxDate={maxDate}
        />

        <div style={row(2, "center")}>
          <DashboardButton
            type="button"
            variant="soft"
            size="sm"
            onClick={() => commit(todayDateOnly())}
          >
            {todayLabel}
          </DashboardButton>

          {clearable ? (
            <DashboardButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => commit(null)}
            >
              {clearLabel}
            </DashboardButton>
          ) : null}
        </div>
      </DatePickerPopover>
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

const fieldShellStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[1],
  minWidth: 0,
};

const triggerStyle: CSSProperties = {
  ...inputBase,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: dashboardSpacing[2],
  minHeight: 44,
  textAlign: "left",
  appearance: "none",
};

const triggerTextStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontFamily: dashboardTypography.fontFamily,
};
