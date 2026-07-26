/**
 * Pure request-window calculations for the owner analytics page
 * (app/admin/analytics/page.tsx). Every function here takes an explicit
 * timestamp argument -- none of them read the clock themselves -- so a
 * single captured request timestamp can be threaded through every
 * Supabase query window and every in-memory period filter for that
 * request, and so these calculations are deterministic and directly
 * unit-testable.
 */

export const OWNER_ANALYTICS_TIME_ZONE = "Asia/Jerusalem";
export const DAY_MS = 24 * 60 * 60 * 1000;

const ownerTimeZonePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: OWNER_ANALYTICS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function getDateTimePart(
  parts: Intl.DateTimeFormatPart[],
  type: string
) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function getOwnerTimeZoneDateParts(timestampMs: number) {
  const parts = ownerTimeZonePartsFormatter.formatToParts(
    new Date(timestampMs)
  );
  const year = Number(getDateTimePart(parts, "year"));
  const month = Number(getDateTimePart(parts, "month"));
  const day = Number(getDateTimePart(parts, "day"));
  const hour = Number(getDateTimePart(parts, "hour"));
  const minute = Number(getDateTimePart(parts, "minute"));
  const second = Number(getDateTimePart(parts, "second"));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second)
  ) {
    return null;
  }

  return { year, month, day, hour, minute, second };
}

function getOwnerTimeZoneOffsetMs(timestampMs: number) {
  const parts = getOwnerTimeZoneDateParts(timestampMs);

  if (!parts) {
    return 0;
  }

  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    ) - timestampMs
  );
}

/**
 * The UTC millisecond timestamp of local midnight, in the owner analytics
 * time zone, for the day containing `timestampMs`.
 */
export function getStartOfOwnerAnalyticsDay(timestampMs: number): number {
  const parts = getOwnerTimeZoneDateParts(timestampMs);

  if (!parts) {
    const fallback = new Date(timestampMs);
    fallback.setUTCHours(0, 0, 0, 0);

    return fallback.getTime();
  }

  const localMidnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  let startOfDay =
    localMidnightAsUtc - getOwnerTimeZoneOffsetMs(localMidnightAsUtc);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const adjusted = localMidnightAsUtc - getOwnerTimeZoneOffsetMs(startOfDay);

    if (adjusted === startOfDay) {
      return startOfDay;
    }

    startOfDay = adjusted;
  }

  return startOfDay;
}

export type AdminAnalyticsPeriodWindows = {
  /** UTC ms of local midnight (owner time zone) for the day containing nowMs. */
  startOfTodayMs: number;
  /** nowMs minus 7 days, in UTC ms. */
  sevenDaysAgoMs: number;
  /** nowMs minus 30 days, in UTC ms. Also used as the query lower bound. */
  thirtyDaysAgoMs: number;
};

/**
 * Computes every date-range boundary the owner analytics page needs from a
 * single captured request timestamp, so every Supabase query and every
 * in-memory period filter for one request agree exactly.
 */
export function buildAdminAnalyticsPeriodWindows(
  nowMs: number
): AdminAnalyticsPeriodWindows {
  return {
    startOfTodayMs: getStartOfOwnerAnalyticsDay(nowMs),
    sevenDaysAgoMs: nowMs - 7 * DAY_MS,
    thirtyDaysAgoMs: nowMs - 30 * DAY_MS,
  };
}
