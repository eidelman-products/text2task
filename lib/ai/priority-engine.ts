export type AutoPriority = "Low" | "Medium" | "High";

type AutoPriorityInput = {
  task?: string | null;
  deadline?: string | null;
};

const HIGH_PRIORITY_KEYWORDS = [
  "asap",
  "urgent",
  "immediately",
  "right away",
  "today",
  "tonight",
  "now",
  "critical",
  "priority",
];

const MEDIUM_PRIORITY_KEYWORDS = [
  "soon",
  "this week",
  "next week",
  "follow up",
  "review",
  "update",
  "prepare",
  "schedule",
];

const LOW_PRIORITY_KEYWORDS = [
  "someday",
  "later",
  "eventually",
  "when possible",
  "optional",
  "nice to have",
];

export function getAutoPriority({
  task,
  deadline,
}: AutoPriorityInput): AutoPriority {
  const normalizedTask = normalize(task);
  const normalizedDeadline = normalize(deadline);
  const combined = `${normalizedTask} ${normalizedDeadline}`.trim();

  if (!combined) {
    return "Medium";
  }

  if (containsAny(combined, HIGH_PRIORITY_KEYWORDS)) {
    return "High";
  }

  if (containsAny(combined, LOW_PRIORITY_KEYWORDS)) {
    return "Low";
  }

  if (containsAny(combined, MEDIUM_PRIORITY_KEYWORDS)) {
    return "Medium";
  }

  if (isTodayDeadline(normalizedDeadline)) {
    return "High";
  }

  if (isTomorrowDeadline(normalizedDeadline)) {
    return "High";
  }

  if (isThisWeekDeadline(normalizedDeadline)) {
    return "Medium";
  }

  if (isNextWeekDeadline(normalizedDeadline)) {
    return "Medium";
  }

  if (!normalizedDeadline) {
    return "Medium";
  }

  return "Medium";
}

function normalize(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function isTodayDeadline(deadline: string): boolean {
  return deadline.includes("today");
}

function isTomorrowDeadline(deadline: string): boolean {
  return deadline.includes("tomorrow");
}

function isThisWeekDeadline(deadline: string): boolean {
  return (
    deadline.includes("this week") ||
    deadline.includes("by friday") ||
    deadline.includes("by monday") ||
    deadline.includes("by tuesday") ||
    deadline.includes("by wednesday") ||
    deadline.includes("by thursday")
  );
}

function isNextWeekDeadline(deadline: string): boolean {
  return deadline.includes("next week");
}