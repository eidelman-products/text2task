export type ParseAmountResult = {
  rawText: string;
  amountValue: number | null;
  currencyCode: string | null;
  displayAmount: string | null;
  matched: boolean;
};

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "₪": "ILS",
};

const WORD_TO_CURRENCY: Record<string, string> = {
  usd: "USD",
  dollar: "USD",
  dollars: "USD",
  eur: "EUR",
  euro: "EUR",
  euros: "EUR",
  gbp: "GBP",
  pound: "GBP",
  pounds: "GBP",
  ils: "ILS",
  nis: "ILS",
  shekel: "ILS",
  shekels: "ILS",
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeNumberString(value: string) {
  return value.replace(/,/g, "").trim();
}

function parseNumericValue(value: string): number | null {
  const normalized = normalizeNumberString(value);
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDisplayAmount(
  amountValue: number | null,
  currencyCode: string | null,
  fallbackText: string
) {
  if (amountValue === null) {
    return fallbackText || null;
  }

  const cleanNumber = Number.isInteger(amountValue)
    ? String(amountValue)
    : String(amountValue);

  return currencyCode ? `${cleanNumber} ${currencyCode}` : cleanNumber;
}

export function parseAmount(input?: string | number | null): ParseAmountResult {
  if (input === null || input === undefined) {
    return {
      rawText: "",
      amountValue: null,
      currencyCode: null,
      displayAmount: null,
      matched: false,
    };
  }

  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      return {
        rawText: "",
        amountValue: null,
        currencyCode: null,
        displayAmount: null,
        matched: false,
      };
    }

    return {
      rawText: String(input),
      amountValue: input,
      currencyCode: null,
      displayAmount: String(input),
      matched: true,
    };
  }

  const rawText = normalizeWhitespace(input);
  if (!rawText) {
    return {
      rawText: "",
      amountValue: null,
      currencyCode: null,
      displayAmount: null,
      matched: false,
    };
  }

  const lowered = rawText.toLowerCase();

  // $300 / €450 / ₪1200 / £99
  const symbolBeforeMatch = rawText.match(/^([$€£₪])\s*([\d,]+(?:\.\d+)?)$/);
  if (symbolBeforeMatch) {
    const currencyCode = SYMBOL_TO_CURRENCY[symbolBeforeMatch[1]] ?? null;
    const amountValue = parseNumericValue(symbolBeforeMatch[2]);

    return {
      rawText,
      amountValue,
      currencyCode,
      displayAmount: formatDisplayAmount(amountValue, currencyCode, rawText),
      matched: amountValue !== null,
    };
  }

  // 300 USD / 450 eur / 1200 ILS
  const codeAfterMatch = lowered.match(
    /^([\d,]+(?:\.\d+)?)\s*(usd|dollar|dollars|eur|euro|euros|gbp|pound|pounds|ils|nis|shekel|shekels)$/
  );
  if (codeAfterMatch) {
    const amountValue = parseNumericValue(codeAfterMatch[1]);
    const currencyCode = WORD_TO_CURRENCY[codeAfterMatch[2]] ?? null;

    return {
      rawText,
      amountValue,
      currencyCode,
      displayAmount: formatDisplayAmount(amountValue, currencyCode, rawText),
      matched: amountValue !== null,
    };
  }

  // USD 300 / EUR 450 / ILS 1200
  const codeBeforeMatch = lowered.match(
    /^(usd|dollar|dollars|eur|euro|euros|gbp|pound|pounds|ils|nis|shekel|shekels)\s*([\d,]+(?:\.\d+)?)$/
  );
  if (codeBeforeMatch) {
    const currencyCode = WORD_TO_CURRENCY[codeBeforeMatch[1]] ?? null;
    const amountValue = parseNumericValue(codeBeforeMatch[2]);

    return {
      rawText,
      amountValue,
      currencyCode,
      displayAmount: formatDisplayAmount(amountValue, currencyCode, rawText),
      matched: amountValue !== null,
    };
  }

  // plain number: 300 / 1,500 / 2500.50
  const plainNumberMatch = rawText.match(/^[\d,]+(?:\.\d+)?$/);
  if (plainNumberMatch) {
    const amountValue = parseNumericValue(rawText);

    return {
      rawText,
      amountValue,
      currencyCode: null,
      displayAmount: formatDisplayAmount(amountValue, null, rawText),
      matched: amountValue !== null,
    };
  }

  return {
    rawText,
    amountValue: null,
    currencyCode: null,
    displayAmount: rawText,
    matched: false,
  };
}