import { parseAmount } from "@/lib/tasks/parse-amount";
import { parseDeadline } from "@/lib/tasks/parse-deadline";

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export type NormalizedProjectUpdateBudget = {
  amount: string;
  amount_value: number;
  currency_code: string | null;
};

export type NormalizedProjectUpdateDeadline = {
  deadline_text: string;
  deadline_date: string | null;
};

function normalizeCurrencyCode(value: string | null | undefined) {
  const clean = String(value || "").trim().toUpperCase();

  return clean || null;
}

function formatAmountValue(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatAmountDisplay(value: number, currencyCode: string | null) {
  const amount = formatAmountValue(value);

  return currencyCode ? `${amount} ${currencyCode}` : amount;
}

export function normalizeProjectUpdateBudget(input: {
  amountText: string;
  existingCurrencyCode?: string | null;
  existingAmountText?: string | null;
}): NormalizedProjectUpdateBudget | null {
  const amountText = input.amountText.trim();

  if (!amountText) {
    return null;
  }

  const parsed = parseAmount(amountText);

  if (!parsed.matched || parsed.amountValue === null) {
    return null;
  }

  const existingAmount = parseAmount(input.existingAmountText);
  const currencyCode = normalizeCurrencyCode(
    parsed.currencyCode ??
      input.existingCurrencyCode ??
      existingAmount.currencyCode
  );

  return {
    amount: formatAmountDisplay(parsed.amountValue, currencyCode),
    amount_value: parsed.amountValue,
    currency_code: currencyCode,
  };
}

function parseDateOnly(value: string | null | undefined): Date | null {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function normalizeDateOnly(value: string | null | undefined) {
  const parsed = parseDateOnly(value);

  if (!parsed) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function resolveFollowingWeekday(input: {
  deadlineText: string;
  currentDeadlineDate?: string | null;
}) {
  const currentDate = parseDateOnly(input.currentDeadlineDate);

  if (!currentDate) {
    return null;
  }

  const match = input.deadlineText
    .toLowerCase()
    .match(/\b(?:the\s+)?following\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);

  if (!match) {
    return null;
  }

  const targetDay = WEEKDAYS[match[1]];
  const resolved = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
    12,
    0,
    0,
    0
  );
  let diff = targetDay - resolved.getDay();

  if (diff <= 0) {
    diff += 7;
  }

  resolved.setDate(resolved.getDate() + diff);

  return formatDateOnly(resolved);
}

export function resolveProjectUpdateDeadline(input: {
  deadlineText: string;
  currentDeadlineDate?: string | null;
}): NormalizedProjectUpdateDeadline {
  const deadlineText = input.deadlineText.trim();
  const contextualDate = resolveFollowingWeekday({
    deadlineText,
    currentDeadlineDate: input.currentDeadlineDate,
  });

  if (contextualDate) {
    return {
      deadline_text: deadlineText,
      deadline_date: contextualDate,
    };
  }

  const parsed = parseDeadline(deadlineText);

  return {
    deadline_text: deadlineText,
    deadline_date: normalizeDateOnly(parsed.deadlineDate),
  };
}
