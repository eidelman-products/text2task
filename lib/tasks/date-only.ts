/**
 * Canonical date-only value contract for Text2Task deadlines.
 *
 * A `DateOnly` represents exactly one calendar day — never a timestamp, never
 * a timezone-relative instant. It is always the strict `YYYY-MM-DD` shape.
 *
 * The ONLY permitted conversions (see docs/TEXT2TASK_DATE_PICKER_MAPPING.md §6):
 *   - DateOnly -> split numeric year/month/day -> construct a local-time
 *     `Date` via `new Date(year, monthIndex, day, ...)` (never a string
 *     passed into `new Date()`).
 *   - Date -> read LOCAL getters (`getFullYear`/`getMonth`/`getDate`) ->
 *     format directly as `YYYY-MM-DD`.
 *
 * `.toISOString()` / UTC conversion must never be used to derive or persist
 * a date-only value — see Risk 1/2/3 in the mapping report for the bugs
 * this module exists to eliminate.
 *
 * `DateOnly` is a branded/opaque type: the only place a value is cast to
 * `DateOnly` is inside this file, and only after full runtime validation.
 */

export type DateOnly = string & { readonly __brand: "DateOnly" };

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_NAMES_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Builds a local-noon `Date` for the given numeric year/month(1-12)/day,
 * sidestepping the legacy JS `Date` constructor quirk where a two-digit
 * `year` argument (0-99) is silently remapped to 1900-1999. We always
 * construct with a safe placeholder year first, then set the real year via
 * `setFullYear`, which never applies that remapping.
 */
function buildLocalNoonDate(year: number, month: number, day: number): Date {
  const d = new Date(2000, month - 1, day, 12, 0, 0, 0);
  d.setFullYear(year);
  return d;
}

/**
 * Validates that (year, month, day) is a real calendar date (rejects things
 * like month 13, day 32, Feb 30, or Feb 29 in a non-leap year) and that the
 * year fits the strict 4-digit `YYYY` shape this module's string format
 * requires.
 */
function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  if (year < 0 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const d = buildLocalNoonDate(year, month, day);

  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

/**
 * The single internal construction path for a validated `DateOnly`. Every
 * public factory in this module funnels through here so the brand cast
 * happens in exactly one place, after real validation.
 */
function brandDateOnly(year: number, month: number, day: number): DateOnly | null {
  if (!isRealCalendarDate(year, month, day)) return null;

  const value = `${pad2(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;

  return value as DateOnly;
}

/**
 * Parses `value` as a strict `YYYY-MM-DD` date-only string representing a
 * real calendar date. Returns `null` for anything else, including
 * non-string input — never throws.
 */
export function parseDateOnly(value: unknown): DateOnly | null {
  if (typeof value !== "string") return null;

  const match = value.match(DATE_ONLY_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return brandDateOnly(year, month, day);
}

/**
 * Pure predicate wrapper around `parseDateOnly` for use as a type guard.
 */
export function isDateOnly(value: unknown): value is DateOnly {
  return parseDateOnly(value) !== null;
}

/**
 * Converts a validated `DateOnly` into a `Date` anchored at local noon
 * (dodges DST-boundary edge cases). This `Date` must never be round-tripped
 * through `.toISOString()`/UTC to derive a calendar day — only ever read
 * back via local getters.
 */
export function dateOnlyToLocalDate(value: DateOnly): Date {
  const match = value.match(DATE_ONLY_PATTERN);

  if (!match) {
    throw new Error(`dateOnlyToLocalDate: invalid DateOnly value "${value}"`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return buildLocalNoonDate(year, month, day);
}

/**
 * Converts a `Date` into a validated `DateOnly` by reading its LOCAL
 * year/month/day components (never `.toISOString()`/UTC).
 */
export function localDateToDateOnly(value: Date): DateOnly {
  const year = value.getFullYear();
  const month = value.getMonth() + 1;
  const day = value.getDate();

  const branded = brandDateOnly(year, month, day);

  if (!branded) {
    throw new Error(
      `localDateToDateOnly: could not derive a valid DateOnly from Date "${value.toString()}"`
    );
  }

  return branded;
}

/**
 * Today's calendar day in the current process/browser's local timezone.
 */
export function todayDateOnly(): DateOnly {
  return localDateToDateOnly(new Date());
}

/**
 * Ordering comparator for two `DateOnly` values. Zero-padded `YYYY-MM-DD`
 * strings sort correctly with plain lexicographic comparison, so no `Date`
 * object is ever constructed here.
 */
export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Unambiguous short display form, e.g. "Jan 20, 2027". Built manually from
 * the branded string's numeric parts — no `Intl`/locale dependency.
 */
export function formatDateOnlyForDisplay(value: DateOnly): string {
  const match = value.match(DATE_ONLY_PATTERN);

  if (!match) {
    throw new Error(`formatDateOnlyForDisplay: invalid DateOnly value "${value}"`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return `${MONTH_NAMES_SHORT[month - 1]} ${day}, ${year}`;
}

/**
 * Full, unambiguous label for accessibility (aria-label/aria-live), e.g.
 * "January 20, 2027".
 */
export function formatDateOnlyForA11y(value: DateOnly): string {
  const match = value.match(DATE_ONLY_PATTERN);

  if (!match) {
    throw new Error(`formatDateOnlyForA11y: invalid DateOnly value "${value}"`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return `${MONTH_NAMES_FULL[month - 1]} ${day}, ${year}`;
}
