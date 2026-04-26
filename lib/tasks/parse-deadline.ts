type ParseDeadlineResult = {
  deadlineDate: string | null;
  matched: boolean;
};

function cloneDate(date: Date) {
  return new Date(date.getTime());
}

function startOfDay(date: Date) {
  const d = cloneDate(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = cloneDate(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function endOfMonth(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function endOfYear(date: Date) {
  const d = new Date(date.getFullYear(), 11, 31);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number) {
  const d = cloneDate(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addWeeks(date: Date, weeks: number) {
  return addDays(date, weeks * 7);
}

function addMonths(date: Date, months: number) {
  const d = cloneDate(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date: Date, years: number) {
  const d = cloneDate(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\bthe\b/g, "")
    .replace(/\bby\b/g, "")
    .replace(/\bon\b/g, "")
    .replace(/\bdue\b/g, "")
    .replace(/\buntil\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

function buildLocalDate(year: number, month: number, day: number) {
  const d = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (!isValidDate(d)) return null;
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

function normalizeTwoDigitYear(year: number) {
  if (year >= 100) return year;
  return year <= 69 ? 2000 + year : 1900 + year;
}

function applyTime(baseDate: Date, text: string): Date {
  const d = cloneDate(baseDate);
  const normalized = normalize(text);

  if (/\b(eod|end of day)\b/.test(normalized)) {
    return endOfDay(d);
  }

  if (/\bnoon\b/.test(normalized)) {
    d.setHours(12, 0, 0, 0);
    return d;
  }

  if (/\bmidnight\b/.test(normalized)) {
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const timeMatch12h = normalized.match(
    /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/
  );
  if (timeMatch12h) {
    let hours = Number(timeMatch12h[1]);
    const minutes = Number(timeMatch12h[2] || "0");
    const meridiem = timeMatch12h[3];

    if (meridiem === "pm" && hours !== 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;

    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  const timeMatch24h = normalized.match(/\b(?:at\s+)?(\d{1,2}):(\d{2})\b/);
  if (timeMatch24h) {
    const hours = Number(timeMatch24h[1]);
    const minutes = Number(timeMatch24h[2]);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      d.setHours(hours, minutes, 0, 0);
      return d;
    }
  }

  return d;
}

function isTimeOnlyExpression(text: string) {
  return (
    /\b(noon|midnight|eod|end of day)\b/.test(text) ||
    /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/.test(text) ||
    /\b\d{1,2}:\d{2}\b/.test(text)
  );
}

function resolveNextWeekday(baseDate: Date, targetDay: number) {
  const d = startOfDay(baseDate);
  let diff = targetDay - d.getDay();
  if (diff <= 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function resolveThisWeekday(baseDate: Date, targetDay: number) {
  const weekStart = startOfWeek(baseDate);
  const d = cloneDate(weekStart);
  const mondayBasedIndex = targetDay === 0 ? 6 : targetDay - 1;
  d.setDate(weekStart.getDate() + mondayBasedIndex);
  return startOfDay(d);
}

function getMonthIndexMap(): Record<string, number> {
  return {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sep: 8,
    sept: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11,
  };
}

function buildDateFromMonthDay(
  monthIndex: number,
  day: number,
  now: Date
): Date | null {
  if (day < 1 || day > 31) return null;

  let year = now.getFullYear();
  let d = new Date(year, monthIndex, day, 12, 0, 0, 0);

  if (Number.isNaN(d.getTime()) || d.getMonth() !== monthIndex) {
    return null;
  }

  if (d.getTime() < startOfDay(now).getTime()) {
    d = new Date(year + 1, monthIndex, day, 12, 0, 0, 0);

    if (Number.isNaN(d.getTime()) || d.getMonth() !== monthIndex) {
      return null;
    }
  }

  return d;
}

function extractNumericDate(raw: string) {
  const match = raw.match(
    /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/
  );

  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = normalizeTwoDigitYear(Number(match[3]));

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const parsed = buildLocalDate(year, month, day);
  if (!parsed) return null;

  return {
    parsed,
    matchedText: match[0],
  };
}

export function parseDeadline(deadlineText?: string | null): ParseDeadlineResult {
  if (!deadlineText || !deadlineText.trim()) {
    return { deadlineDate: null, matched: false };
  }

  const raw = deadlineText.trim();

  const isoDateTimePattern =
    /^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(z|[+\-]\d{2}:\d{2})?$/i;

  if (isoDateTimePattern.test(raw)) {
    const parsed = new Date(raw);
    if (isValidDate(parsed)) {
      return {
        deadlineDate: parsed.toISOString(),
        matched: true,
      };
    }
  }

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const parsed = buildLocalDate(year, month, day);

    if (parsed) {
      return {
        deadlineDate: parsed.toISOString(),
        matched: true,
      };
    }
  }

  const numericDate = extractNumericDate(raw);
  if (numericDate) {
    const withTime = applyTime(numericDate.parsed, raw);
    return {
      deadlineDate: withTime.toISOString(),
      matched: true,
    };
  }

  const now = new Date();
  const text = normalize(raw);

  if (isTimeOnlyExpression(text)) {
    const todayWithTime = applyTime(startOfDay(now), text);
    return {
      deadlineDate: todayWithTime.toISOString(),
      matched: true,
    };
  }

  if (text === "today") {
    return {
      deadlineDate: startOfDay(now).toISOString(),
      matched: true,
    };
  }

  if (text === "tomorrow") {
    const d = addDays(startOfDay(now), 1);
    return {
      deadlineDate: d.toISOString(),
      matched: true,
    };
  }

  if (text === "day after tomorrow") {
    const d = addDays(startOfDay(now), 2);
    return {
      deadlineDate: d.toISOString(),
      matched: true,
    };
  }

  if (text === "tonight") {
    const d = cloneDate(now);
    d.setHours(20, 0, 0, 0);
    return {
      deadlineDate: d.toISOString(),
      matched: true,
    };
  }

  if (text === "this week") {
    return {
      deadlineDate: endOfWeek(now).toISOString(),
      matched: true,
    };
  }

  if (text === "next week") {
    const d = endOfWeek(addWeeks(now, 1));
    return {
      deadlineDate: d.toISOString(),
      matched: true,
    };
  }

  if (
    text === "end of week" ||
    text === "week end" ||
    text === "eow" ||
    text === "by end of week"
  ) {
    return {
      deadlineDate: endOfWeek(now).toISOString(),
      matched: true,
    };
  }

  if (text === "this month") {
    return {
      deadlineDate: endOfMonth(now).toISOString(),
      matched: true,
    };
  }

  if (text === "next month") {
    return {
      deadlineDate: endOfMonth(addMonths(now, 1)).toISOString(),
      matched: true,
    };
  }

  if (
    text.includes("end of month") ||
    text.includes("month end") ||
    text === "eom" ||
    text === "by end of month"
  ) {
    return {
      deadlineDate: endOfMonth(now).toISOString(),
      matched: true,
    };
  }

  if (
    text.includes("end of next month") ||
    text === "next month end" ||
    text === "eom next month"
  ) {
    return {
      deadlineDate: endOfMonth(addMonths(now, 1)).toISOString(),
      matched: true,
    };
  }

  if (
    text === "end of year" ||
    text === "year end" ||
    text === "eoy" ||
    text === "by end of year"
  ) {
    return {
      deadlineDate: endOfYear(now).toISOString(),
      matched: true,
    };
  }

  if (text === "next year") {
    return {
      deadlineDate: endOfYear(addYears(now, 1)).toISOString(),
      matched: true,
    };
  }

  const relativeMatch = text.match(
    /\bin\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)\b/
  );
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    let d = startOfDay(now);

    if (unit.startsWith("day")) d = addDays(d, amount);
    else if (unit.startsWith("week")) d = addWeeks(d, amount);
    else if (unit.startsWith("month")) d = addMonths(d, amount);
    else if (unit.startsWith("year")) d = addYears(d, amount);

    d = applyTime(d, text);

    return {
      deadlineDate: d.toISOString(),
      matched: true,
    };
  }

  const fromNowMatch = text.match(
    /\b(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+from\s+now\b/
  );
  if (fromNowMatch) {
    const amount = Number(fromNowMatch[1]);
    const unit = fromNowMatch[2];
    let d = startOfDay(now);

    if (unit.startsWith("day")) d = addDays(d, amount);
    else if (unit.startsWith("week")) d = addWeeks(d, amount);
    else if (unit.startsWith("month")) d = addMonths(d, amount);
    else if (unit.startsWith("year")) d = addYears(d, amount);

    d = applyTime(d, text);

    return {
      deadlineDate: d.toISOString(),
      matched: true,
    };
  }

  const weekdays: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  for (const [name, dayIndex] of Object.entries(weekdays)) {
    if (text === name) {
      const d = applyTime(resolveNextWeekday(now, dayIndex), text);
      return {
        deadlineDate: d.toISOString(),
        matched: true,
      };
    }

    if (text === `next ${name}`) {
      const d = applyTime(resolveNextWeekday(now, dayIndex), text);
      return {
        deadlineDate: d.toISOString(),
        matched: true,
      };
    }

    if (text === `this ${name}`) {
      const d = applyTime(resolveThisWeekday(now, dayIndex), text);
      return {
        deadlineDate: d.toISOString(),
        matched: true,
      };
    }
  }

  const months = getMonthIndexMap();

  const monthDayMatch = text.match(
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})\b/
  );
  if (monthDayMatch) {
    const monthIndex = months[monthDayMatch[1]];
    const day = Number(monthDayMatch[2]);
    const d = buildDateFromMonthDay(monthIndex, day, now);

    if (d) {
      const withTime = applyTime(d, text);
      return {
        deadlineDate: withTime.toISOString(),
        matched: true,
      };
    }
  }

  const dayMonthMatch = text.match(
    /\b(\d{1,2})\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b/
  );
  if (dayMonthMatch) {
    const day = Number(dayMonthMatch[1]);
    const monthIndex = months[dayMonthMatch[2]];
    const d = buildDateFromMonthDay(monthIndex, day, now);

    if (d) {
      const withTime = applyTime(d, text);
      return {
        deadlineDate: withTime.toISOString(),
        matched: true,
      };
    }
  }

  const endOfNamedMonthMatch = text.match(
    /\b(end of|by end of)\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b/
  );
  if (endOfNamedMonthMatch) {
    const monthIndex = months[endOfNamedMonthMatch[2]];
    let year = now.getFullYear();

    if (monthIndex < now.getMonth()) {
      year += 1;
    }

    const d = new Date(year, monthIndex + 1, 0);
    d.setHours(23, 59, 59, 999);

    return {
      deadlineDate: d.toISOString(),
      matched: true,
    };
  }

  return {
    deadlineDate: null,
    matched: false,
  };
}