import { parseDeadline } from "./parse-deadline";
import { formatDeadline } from "./format-deadline";

export type DeadlineUiTone =
  | "neutral"
  | "safe"
  | "soon"
  | "urgent"
  | "overdue"
  | "done";

export type DeadlineUiMeta = {
  rawText: string;
  formattedDate: string;
  deadlineDate: string | null;
  isParsed: boolean;
  isMissing: boolean;
  isDone: boolean;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueTomorrow: boolean;
  isDueSoon: boolean;
  isOnTrack: boolean;
  daysFromNow: number | null;
  label: string;
  icon: string;
  tone: DeadlineUiTone;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
};

function startOfDay(date: Date) {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

function differenceInCalendarDays(target: Date, base: Date) {
  const targetStart = startOfDay(target).getTime();
  const baseStart = startOfDay(base).getTime();
  const msPerDay = 1000 * 60 * 60 * 24;

  return Math.round((targetStart - baseStart) / msPerDay);
}

function tryParseDate(value?: string | null) {
  if (!value || !value.trim()) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return startOfDay(parsed);
}

export function getDeadlineUi(
  deadlineText?: string | null,
  deadlineDate?: string | null,
  status?: string | null
): DeadlineUiMeta {
  const normalizedStatus = (status || "").trim().toLowerCase();
  const rawText = (deadlineText || "").trim();

  const parsedFromText = rawText ? parseDeadline(rawText) : null;
  const resolvedDeadlineDate =
    deadlineDate?.trim() || parsedFromText?.deadlineDate || null;

  const resolvedDate = tryParseDate(resolvedDeadlineDate);
  const formattedDate = formatDeadline(rawText, resolvedDeadlineDate);

  if (normalizedStatus === "done") {
    return {
      rawText,
      formattedDate: formattedDate || rawText,
      deadlineDate: resolvedDeadlineDate,
      isParsed: !!resolvedDate,
      isMissing: !rawText && !resolvedDeadlineDate,
      isDone: true,
      isOverdue: false,
      isDueToday: false,
      isDueTomorrow: false,
      isDueSoon: false,
      isOnTrack: false,
      daysFromNow: null,
      label: "Completed",
      icon: "✅",
      tone: "done",
      textColor: "#15803d",
      backgroundColor: "rgba(34,197,94,0.10)",
      borderColor: "rgba(34,197,94,0.18)",
    };
  }

  if (!rawText && !resolvedDeadlineDate) {
    return {
      rawText: "",
      formattedDate: "",
      deadlineDate: null,
      isParsed: false,
      isMissing: true,
      isDone: false,
      isOverdue: false,
      isDueToday: false,
      isDueTomorrow: false,
      isDueSoon: false,
      isOnTrack: false,
      daysFromNow: null,
      label: "No deadline",
      icon: "📅",
      tone: "neutral",
      textColor: "#64748b",
      backgroundColor: "rgba(148,163,184,0.08)",
      borderColor: "rgba(148,163,184,0.16)",
    };
  }

  if (!resolvedDate) {
    return {
      rawText,
      formattedDate: formattedDate || rawText,
      deadlineDate: resolvedDeadlineDate,
      isParsed: false,
      isMissing: false,
      isDone: false,
      isOverdue: false,
      isDueToday: false,
      isDueTomorrow: false,
      isDueSoon: false,
      isOnTrack: false,
      daysFromNow: null,
      label: formattedDate || rawText || "Custom deadline",
      icon: "📅",
      tone: "neutral",
      textColor: "#475569",
      backgroundColor: "rgba(226,232,240,0.55)",
      borderColor: "rgba(203,213,225,0.85)",
    };
  }

  const now = startOfDay(new Date());
  const daysFromNow = differenceInCalendarDays(resolvedDate, now);

  const isOverdue = daysFromNow < 0;
  const isDueToday = daysFromNow === 0;
  const isDueTomorrow = daysFromNow === 1;
  const isDueSoon = daysFromNow >= 2 && daysFromNow <= 3;
  const isOnTrack = daysFromNow >= 4;

  if (isOverdue) {
    return {
      rawText,
      formattedDate,
      deadlineDate: resolvedDeadlineDate,
      isParsed: true,
      isMissing: false,
      isDone: false,
      isOverdue: true,
      isDueToday: false,
      isDueTomorrow: false,
      isDueSoon: false,
      isOnTrack: false,
      daysFromNow,
      label: `Overdue`,
      icon: "🚨",
      tone: "overdue",
      textColor: "#b91c1c",
      backgroundColor: "rgba(239,68,68,0.10)",
      borderColor: "rgba(239,68,68,0.18)",
    };
  }

  if (isDueToday) {
    return {
      rawText,
      formattedDate,
      deadlineDate: resolvedDeadlineDate,
      isParsed: true,
      isMissing: false,
      isDone: false,
      isOverdue: false,
      isDueToday: true,
      isDueTomorrow: false,
      isDueSoon: false,
      isOnTrack: false,
      daysFromNow,
      label: `Due today`,
      icon: "⏰",
      tone: "urgent",
      textColor: "#b45309",
      backgroundColor: "rgba(245,158,11,0.10)",
      borderColor: "rgba(245,158,11,0.18)",
    };
  }

  if (isDueTomorrow) {
    return {
      rawText,
      formattedDate,
      deadlineDate: resolvedDeadlineDate,
      isParsed: true,
      isMissing: false,
      isDone: false,
      isOverdue: false,
      isDueToday: false,
      isDueTomorrow: true,
      isDueSoon: false,
      isOnTrack: false,
      daysFromNow,
      label: `Due tomorrow`,
      icon: "🟠",
      tone: "urgent",
      textColor: "#c2410c",
      backgroundColor: "rgba(249,115,22,0.10)",
      borderColor: "rgba(249,115,22,0.18)",
    };
  }

  if (isDueSoon) {
    return {
      rawText,
      formattedDate,
      deadlineDate: resolvedDeadlineDate,
      isParsed: true,
      isMissing: false,
      isDone: false,
      isOverdue: false,
      isDueToday: false,
      isDueTomorrow: false,
      isDueSoon: true,
      isOnTrack: false,
      daysFromNow,
      label: `Due soon`,
      icon: "📅",
      tone: "soon",
      textColor: "#b45309",
      backgroundColor: "rgba(251,191,36,0.12)",
      borderColor: "rgba(245,158,11,0.18)",
    };
  }

  return {
    rawText,
    formattedDate,
    deadlineDate: resolvedDeadlineDate,
    isParsed: true,
    isMissing: false,
    isDone: false,
    isOverdue: false,
    isDueToday: false,
    isDueTomorrow: false,
    isDueSoon: false,
    isOnTrack,
    daysFromNow,
    label: "On track",
    icon: "✅",
    tone: "safe",
    textColor: "#15803d",
    backgroundColor: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.18)",
  };
}