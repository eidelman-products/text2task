import { formatDeadline } from "@/lib/tasks/format-deadline";
import { parseAmount } from "@/lib/tasks/parse-amount";
import type { DuplicateProjectMatch } from "@/lib/tasks/project-duplicate-detection";

/**
 * Display formatting for the EXISTING saved project inside the duplicate
 * modal. These read only from the DuplicateProjectMatch returned by the
 * duplicate-detection query -- never from the incoming (new) candidate --
 * so a project genuinely missing amount/deadline always keeps the fallback
 * text instead of silently showing the new candidate's own values.
 */

export const DUPLICATE_PROJECT_AMOUNT_FALLBACK_TEXT = "—";
export const DUPLICATE_PROJECT_DEADLINE_FALLBACK_TEXT = "No deadline saved";

function formatWholeOrDecimal(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    value
  );
}

export function formatDuplicateProjectAmount(
  duplicate: Pick<DuplicateProjectMatch, "amount" | "amount_value" | "currency_code">
): string {
  const currencyCode = duplicate.currency_code?.trim() || null;

  const numericAmount =
    typeof duplicate.amount_value === "number" &&
    Number.isFinite(duplicate.amount_value)
      ? duplicate.amount_value
      : parseAmount(duplicate.amount).amountValue;

  if (numericAmount !== null) {
    const formattedNumber = formatWholeOrDecimal(numericAmount);

    return currencyCode ? `${formattedNumber} ${currencyCode}` : formattedNumber;
  }

  const rawAmount = duplicate.amount?.trim();

  return rawAmount || DUPLICATE_PROJECT_AMOUNT_FALLBACK_TEXT;
}

export function formatDuplicateProjectDeadline(
  duplicate: Pick<DuplicateProjectMatch, "deadline_text" | "deadline_date">
): string {
  const formatted = formatDeadline(duplicate.deadline_text, duplicate.deadline_date);

  return formatted || DUPLICATE_PROJECT_DEADLINE_FALLBACK_TEXT;
}
