import { parseDeadline } from "./parse-deadline";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateToMMDDYY(date: Date) {
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const year = String(date.getFullYear()).slice(-2);

  return `${month}/${day}/${year}`;
}

function tryParseIsoLike(value: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function tryParseSlashDate(value: string) {
  if (!value) return null;

  const trimmed = value.trim();

  // DD/MM/YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]);
    const year = Number(ddmmyyyy[3]);

    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // MM/DD/YY or MM/DD/YYYY
  const mmddyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (mmddyy) {
    const month = Number(mmddyy[1]);
    const day = Number(mmddyy[2]);
    const rawYear = mmddyy[3];
    const year =
      rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);

    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

export function formatDeadline(
  deadlineText?: string | null,
  deadlineDate?: string | null
) {
  // 1) אם יש ISO / deadline_date תקין - תמיד נציג MM/DD/YY
  if (deadlineDate?.trim()) {
    const isoDate = tryParseIsoLike(deadlineDate.trim());
    if (isoDate) {
      return formatDateToMMDDYY(isoDate);
    }
  }

  const rawText = (deadlineText || "").trim();
  if (!rawText) return "";

  // 2) אם הטקסט עצמו כבר ISO / datetime
  const isoFromText = tryParseIsoLike(rawText);
  if (isoFromText) {
    return formatDateToMMDDYY(isoFromText);
  }

  // 3) אם הטקסט הוא תאריך עם /
  const slashDate = tryParseSlashDate(rawText);
  if (slashDate) {
    return formatDateToMMDDYY(slashDate);
  }

  // 4) אם זה טקסט טבעי כמו tomorrow / end of month / next week
  const parsed = parseDeadline(rawText);
  if (parsed.deadlineDate) {
    const parsedDate = tryParseIsoLike(parsed.deadlineDate);
    if (parsedDate) {
      return formatDateToMMDDYY(parsedDate);
    }
  }

  // 5) fallback - לא הצלחנו להבין, מחזירים את הטקסט המקורי
  return rawText;
}