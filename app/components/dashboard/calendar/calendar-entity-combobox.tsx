"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { fieldLabel, inputBase } from "../ui/styles";
import { dashboardColors, dashboardRadii, dashboardShadows, dashboardSpacing, dashboardTypography, dashboardZIndex } from "../ui/tokens";

/*
  Smallest production-safe accessible combobox this repo needs for "select
  an existing Text2Task entity, or type a name that doesn't exist yet" --
  used by both CalendarEventProjectField and CalendarEventClientField (each
  a thin wrapper mapping their own option shape into `CalendarEntityComboboxOption`
  and rendering this shared implementation). No third-party dependency; no
  portal (the suggestion list is a plain absolutely-positioned sibling,
  never escaping the dialog panel it's rendered in, unlike DatePickerPopover
  -- its content is small enough that this repo's established nested-overlay
  machinery would be unwarranted complexity here).

  Value model: exactly one of `id`/`customName` is ever non-null, or both are
  null (empty). This component never enforces cross-field rules (e.g. "a
  linked Project locks Client") -- that stays exactly where it already lived,
  in CalendarEventForm.
*/

export type CalendarEntityComboboxOption = {
  id: string;
  label: string;
  /** Rendered after the label, e.g. "(Archived)". Purely cosmetic. */
  suffix?: string;
};

export type CalendarEntityComboboxValue = {
  /** Non-null when an existing option is selected. */
  id: string | null;
  /** Non-null when a not-yet-existing name was typed and committed. */
  customName: string | null;
};

export type CalendarEntityComboboxProps = {
  id?: string;
  label: string;
  placeholder: string;
  value: CalendarEntityComboboxValue;
  onChange: (next: CalendarEntityComboboxValue) => void;
  options: CalendarEntityComboboxOption[];
  disabled?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
};

/** Suggestions are filtered as-you-type, but never more than this many are rendered at once. */
const MAX_VISIBLE_SUGGESTIONS = 50;

function resolveDisplayText(value: CalendarEntityComboboxValue, options: CalendarEntityComboboxOption[]): string {
  if (value.id !== null) {
    const match = options.find((option) => option.id === value.id);
    if (match) return match.suffix ? `${match.label} ${match.suffix}` : match.label;
    // A linked id whose option row isn't in the current options list (e.g.
    // still loading, or an edit-mode value for an item not otherwise
    // returned) -- fall back to showing nothing rather than a stale label;
    // CalendarEventForm already synthesizes a placeholder option for this
    // exact case while options are loading.
    return "";
  }
  return value.customName ?? "";
}

export function CalendarEntityCombobox({
  id,
  label,
  placeholder,
  value,
  onChange,
  options,
  disabled = false,
  invalid = false,
  "aria-describedby": ariaDescribedBy,
}: CalendarEntityComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-listbox`;

  const [inputText, setInputText] = useState(() => resolveDisplayText(value, options));
  // Separate from `inputText` deliberately: opening an already-populated
  // field (a click/focus with no typing yet) must show every suggestion,
  // not just the ones matching whatever label happens to already be
  // displayed -- otherwise there would be no way to browse to a DIFFERENT
  // option once one is already selected. Only real typing (handleChange)
  // narrows this; focusing resets it to "" (show everything) regardless of
  // the current display text.
  const [filterQuery, setFilterQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Whether the input itself currently has focus, tracked as state (not a
  // ref read during render, which would trip the `react-hooks/refs` "no ref
  // access during render" rule) purely via the onFocus/onBlur handlers
  // below -- used only to gate the external-value resync immediately after.
  const [isFocused, setIsFocused] = useState(false);

  // Tracks whether `value` last changed because of THIS component's own
  // onChange call (every handler below that calls `emit` also updates this
  // state synchronously) versus an external change (e.g. a Project
  // selection auto-locking/clearing Client) -- only the latter resyncs
  // `inputText`, and only while the user isn't actively focused on the
  // field. Adjusting state during render (rather than in an effect) is
  // React's own documented pattern for exactly this "derive from a changed
  // prop" case -- matches this codebase's existing `wasOpen` convention
  // (CalendarDayDialog).
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value.id !== lastSyncedValue.id || value.customName !== lastSyncedValue.customName) {
    setLastSyncedValue(value);
    if (!isFocused) {
      setInputText(resolveDisplayText(value, options));
    }
  }

  // True only while the user has typed something since the last commit
  // (selecting a suggestion, clearing, or an external value sync) --
  // without this, blurring the input for ANY reason (e.g. clicking Save
  // right after selecting a suggestion) would re-run `commitTypedText`
  // against the still-displayed label text and misread an untouched,
  // already-linked selection as a freshly-typed custom name, silently
  // discarding the id that was just selected.
  const [isDirty, setIsDirty] = useState(false);

  const trimmedQuery = filterQuery.trim().toLowerCase();
  const suggestions =
    trimmedQuery.length === 0
      ? options
      : options.filter((option) => option.label.toLowerCase().includes(trimmedQuery));
  const visibleSuggestions = suggestions.slice(0, MAX_VISIBLE_SUGGESTIONS);

  function emit(next: CalendarEntityComboboxValue) {
    setLastSyncedValue(next);
    onChange(next);
  }

  function selectOption(option: CalendarEntityComboboxOption) {
    setInputText(option.suffix ? `${option.label} ${option.suffix}` : option.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
    setIsDirty(false);
    emit({ id: option.id, customName: null });
  }

  function commitTypedText() {
    const trimmed = inputText.trim();
    setInputText(trimmed);
    setIsDirty(false);
    if (trimmed.length === 0) {
      emit({ id: null, customName: null });
      return;
    }
    emit({ id: null, customName: trimmed });
  }

  function handleFocus() {
    if (disabled) return;
    setIsFocused(true);
    setFilterQuery("");
    setIsOpen(true);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    // A mousedown on a suggestion/clear button already preventDefault()'d,
    // so real blur here only ever means focus genuinely left the widget.
    void event;
    setIsFocused(false);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (isDirty) commitTypedText();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setInputText(event.target.value);
    setFilterQuery(event.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
    setIsDirty(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightedIndex((current) => Math.min(current + 1, visibleSuggestions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) return;
      setHighlightedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (!isOpen) return;
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < visibleSuggestions.length) {
        selectOption(visibleSuggestions[highlightedIndex]);
      } else {
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (isDirty) commitTypedText();
      }
      return;
    }

    if (event.key === "Escape") {
      if (!isOpen) return;
      // Matches DatePickerPopover's own "first Escape closes the local
      // overlay, a second closes the dialog" convention:
      // preventDefault() here is what ResponsiveDialog's own Escape
      // handler checks (`if (event.defaultPrevented) return;`) to skip
      // closing the whole dialog on this same keypress.
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }

  function handleOptionMouseDown(event: ReactMouseEvent<HTMLLIElement>) {
    // Keeps the input focused through the click so `handleBlur` (which
    // would otherwise fire first and close the list) never runs.
    event.preventDefault();
  }

  function handleClearMouseDown(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  function handleClearClick() {
    setInputText("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    setIsDirty(false);
    emit({ id: null, customName: null });
    inputRef.current?.focus();
  }

  const showClear = inputText.length > 0;
  const activeDescendant =
    isOpen && highlightedIndex >= 0 && highlightedIndex < visibleSuggestions.length
      ? `${listboxId}-option-${highlightedIndex}`
      : undefined;

  return (
    <div style={{ display: "grid", gap: dashboardSpacing[1] }}>
      <label htmlFor={inputId} style={fieldLabel}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          value={inputText}
          placeholder={placeholder}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeDescendant}
          aria-invalid={invalid || undefined}
          aria-describedby={ariaDescribedBy}
          style={{ ...inputBase, minHeight: 44, paddingRight: showClear ? 40 : undefined }}
        />

        {showClear && !disabled ? (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onMouseDown={handleClearMouseDown}
            onClick={handleClearClick}
            style={clearButtonStyle}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        ) : null}

        {isOpen && !disabled ? (
          <ul id={listboxId} role="listbox" aria-label={`${label} suggestions`} style={listboxStyle}>
            {visibleSuggestions.length === 0 ? (
              <li style={emptyOptionStyle}>
                {trimmedQuery.length === 0 ? "No options -- type to enter a custom name" : "No matches -- Enter to use this as a custom name"}
              </li>
            ) : (
              visibleSuggestions.map((option, index) => (
                <li
                  key={option.id}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onMouseDown={handleOptionMouseDown}
                  onClick={() => selectOption(option)}
                  style={{
                    ...optionStyle,
                    background: index === highlightedIndex ? dashboardColors.primary[50] : "transparent",
                  }}
                >
                  {option.label}
                  {option.suffix ? <span style={optionSuffixStyle}> {option.suffix}</span> : null}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

const clearButtonStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: 2,
  transform: "translateY(-50%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 44,
  minHeight: 44,
  border: "none",
  background: "transparent",
  color: dashboardColors.text.muted,
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
};

const listboxStyle: CSSProperties = {
  position: "absolute",
  zIndex: dashboardZIndex.popover,
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  maxHeight: 220,
  overflowY: "auto",
  margin: 0,
  padding: dashboardSpacing[1],
  listStyle: "none",
  background: dashboardColors.background.surface,
  border: `1px solid ${dashboardColors.border.default}`,
  borderRadius: dashboardRadii.lg,
  boxShadow: dashboardShadows.md,
};

const optionStyle: CSSProperties = {
  padding: `${dashboardSpacing[2]}px ${dashboardSpacing[3]}px`,
  minHeight: 44,
  display: "flex",
  alignItems: "center",
  borderRadius: dashboardRadii.md,
  fontSize: dashboardTypography.size.md,
  fontWeight: dashboardTypography.weight.medium,
  color: dashboardColors.text.primary,
  cursor: "pointer",
};

const emptyOptionStyle: CSSProperties = {
  padding: `${dashboardSpacing[2]}px ${dashboardSpacing[3]}px`,
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.medium,
  color: dashboardColors.text.muted,
};

const optionSuffixStyle: CSSProperties = {
  color: dashboardColors.text.muted,
  fontWeight: dashboardTypography.weight.regular,
};
