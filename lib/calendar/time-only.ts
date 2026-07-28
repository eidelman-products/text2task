/**
 * Canonical time-of-day value contract for Work Calendar manual events.
 *
 * A `TimeOnly` represents exactly one wall-clock time of day — strict
 * `HH:MM`, 24-hour, zero-padded, no seconds, no timezone. It follows the
 * same branded/opaque pattern as `DateOnly` (lib/tasks/date-only.ts):
 * validation happens in exactly one funnel point (`brandTimeOnly`), and the
 * only cast to `TimeOnly` happens there, after real validation.
 *
 * A `null` `event_time` means an all-day event — there is no separate
 * "all day" flag (see docs/TEXT2TASK_WORK_CALENDAR_FOUNDATION_IMPLEMENTATION_REPORT.md).
 *
 * This module never constructs a `Date`, never calls `.toISOString()` or
 * `Date.parse`, and never performs UTC/locale-aware parsing. Time-of-day
 * values are pure string arithmetic — there is no calendar-day component to
 * get wrong, so none of the DST/UTC-day-shift concerns that motivate
 * `date-only.ts`'s `Date` handling apply here; the safest choice is simply
 * to never involve `Date` at all.
 */

export type TimeOnly = string & { readonly __brand: "TimeOnly" };

const TIME_ONLY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATABASE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The single internal construction path for a validated `TimeOnly`. Every
 * public factory in this module funnels through here.
 */
function brandTimeOnly(hour: number, minute: number): TimeOnly | null {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;

  return `${pad2(hour)}:${pad2(minute)}` as TimeOnly;
}

/**
 * Parses `value` as a strict `HH:MM` 24-hour time-of-day string. Returns
 * `null` for anything else — including seconds (`"14:30:00"`), missing
 * zero-padding (`"9:30"`), 12-hour/AM-PM forms, and non-string input.
 * Never throws.
 */
export function parseTimeOnly(value: unknown): TimeOnly | null {
  if (typeof value !== "string") return null;

  const match = value.match(TIME_ONLY_PATTERN);
  if (!match) return null;

  return brandTimeOnly(Number(match[1]), Number(match[2]));
}

/**
 * Pure predicate wrapper around `parseTimeOnly` for use as a type guard.
 */
export function isTimeOnly(value: unknown): value is TimeOnly {
  return parseTimeOnly(value) !== null;
}

/**
 * Normalizes a raw `time without time zone` value as it arrives from
 * Postgres/Supabase (`"HH:MM:SS"`, optionally with a fractional-seconds
 * suffix the driver may include). This is deliberately narrower than a
 * general parser: since every write path in this codebase only ever writes
 * a `TimeOnly` (`"HH:MM"`) value, a non-zero seconds/fractional component on
 * read means the stored value did not originate from this application's own
 * write path. Rather than silently truncating that precision, this
 * normalizer rejects it (`null`) so the caller can decide how to handle a
 * genuinely unexpected value instead of quietly losing information.
 */
export function normalizeDatabaseTimeOnly(value: unknown): TimeOnly | null {
  if (typeof value !== "string") return null;

  const match = value.match(DATABASE_TIME_PATTERN);
  if (!match) return null;

  const seconds = Number(match[3]);
  if (seconds !== 0) return null;

  return brandTimeOnly(Number(match[1]), Number(match[2]));
}

/**
 * Human-readable 12-hour display form, e.g. "2:30 PM", "12:00 AM". Built
 * manually from the branded string's numeric parts — no `Intl`/locale
 * dependency, matching `formatDateOnlyForDisplay`'s approach.
 */
export function formatTimeOnlyForDisplay(value: TimeOnly): string {
  const match = value.match(TIME_ONLY_PATTERN);

  if (!match) {
    throw new Error(`formatTimeOnlyForDisplay: invalid TimeOnly value "${value}"`);
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${displayHour}:${pad2(minute)} ${period}`;
}
