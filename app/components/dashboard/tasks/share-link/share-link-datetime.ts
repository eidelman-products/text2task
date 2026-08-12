/**
 * Local <-> UTC ISO timestamp conversion for the share-link expiry
 * picker only. Deliberately NOT lib/tasks/date-only.ts's `DateOnly` --
 * that type is explicitly calendar-day-only and its module bans
 * `.toISOString()`/UTC round-tripping entirely, which would silently
 * drop the time-of-day an owner picks for expiry. This module instead
 * follows the same "local Date getters only, never string-into-`new
 * Date()`" discipline that repository already establishes, applied to a
 * real instant rather than a bare date.
 *
 * `new Date(year, monthIndex, day, hour, minute)` (the multi-argument
 * constructor) interprets its arguments as LOCAL time per the JS spec,
 * so `.toISOString()` on the result performs a correct, deterministic
 * local-to-UTC conversion that accounts for the browser's actual
 * timezone offset -- never a naive string concatenation that would
 * silently treat a local wall-clock value as if it were already UTC.
 */

const DATETIME_LOCAL_INPUT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Parses a browser `<input type="datetime-local">` value
 * ("YYYY-MM-DDTHH:mm", always local wall-clock time, no seconds, no
 * timezone) into a UTC ISO 8601 timestamp matching
 * lib/share/share-contracts.ts's `strictTimestampSchema`. Returns null
 * for an empty, malformed, or calendar-invalid value -- never throws,
 * never silently corrects.
 */
export function utcIsoFromLocalDateTimeInput(value: string): string | null {
  const match = DATETIME_LOCAL_INPUT_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  // new Date(...) with out-of-range component values (e.g. month 13, day
  // 32) rolls over into the next month/year rather than failing -- so the
  // constructed date's own fields are checked back against the parsed
  // input instead of trusting Number.isNaN alone.
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date.toISOString();
}

/**
 * Formats a UTC ISO timestamp (or null) back into a
 * `<input type="datetime-local">` value in the owner's local timezone,
 * for prefilling the "change expiry" input. Returns "" for null or an
 * unparseable value -- never throws.
 */
export function localDateTimeInputFromUtcIso(iso: string | null): string {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Human-readable local display of a UTC ISO timestamp (or null), for the
 * "Expires <...>" line. Never throws; returns "" for null/unparseable.
 */
export function formatShareLinkExpiryForDisplay(iso: string | null): string {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
