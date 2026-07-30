/*
  Shared, pure focusable-element helpers -- extracted from
  DatePickerPopover's own file-local FOCUSABLE_SELECTOR/query logic
  (app/components/dashboard/ui/calendar/date-picker-popover.tsx), which
  ResponsiveDialog (responsive-dialog.tsx) also needs verbatim. This is the
  one piece of that component's focus-trap code that is genuinely
  copy-identical between the two call sites (the selector string and the
  query itself) -- the surrounding keydown-listener wiring stays separate
  per component, since each is tied to its own ref/lifecycle and forcing a
  single shared hook over that would be cosmetic reuse, not real
  deduplication.
*/

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Whether a single element itself matches the shared focusable-element
 * contract -- used by ResponsiveDialog to validate an `initialFocusRef`
 * target (a plain `<div>` with no `tabindex`, or an element with
 * `tabindex="-1"`, is never a valid initial-focus target; this is what
 * makes that rejection automatic rather than a second, separately
 * maintained check).
 */
export function matchesFocusableSelector(element: HTMLElement): boolean {
  return element.matches(FOCUSABLE_SELECTOR);
}
