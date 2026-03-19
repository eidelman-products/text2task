// lib/gmail/unsubscribe.ts

export type UnsubscribeInfo = {
  raw: string;
  mailto?: string;
  url?: string;
};

function cleanAngleBrackets(value: string): string {
  return value.trim().replace(/^<|>$/g, "");
}

function splitHeaderParts(headerValue: string): string[] {
  return headerValue
    .split(",")
    .map((part) => cleanAngleBrackets(part))
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseListUnsubscribeHeader(
  headerValue: string | undefined | null
): UnsubscribeInfo | null {
  if (!headerValue || typeof headerValue !== "string") {
    return null;
  }

  const raw = headerValue.trim();
  if (!raw) return null;

  const parts = splitHeaderParts(raw);

  let mailto: string | undefined;
  let url: string | undefined;

  for (const part of parts) {
    const lower = part.toLowerCase();

    if (!mailto && lower.startsWith("mailto:")) {
      mailto = part;
      continue;
    }

    if (
      !url &&
      (lower.startsWith("http://") || lower.startsWith("https://"))
    ) {
      url = part;
      continue;
    }
  }

  if (!mailto && !url) {
    return null;
  }

  return {
    raw,
    mailto,
    url,
  };
}

export function getPreferredUnsubscribeTarget(
  headerValue: string | undefined | null
): string | null {
  const parsed = parseListUnsubscribeHeader(headerValue);

  if (!parsed) return null;

  // Prefer https/http first because it is the most user-friendly path.
  if (parsed.url) return parsed.url;

  // Fallback to mailto if that is the only option.
  if (parsed.mailto) return parsed.mailto;

  return null;
}

export function hasUnsubscribeOption(
  headerValue: string | undefined | null
): boolean {
  return Boolean(getPreferredUnsubscribeTarget(headerValue));
}

export function getUnsubscribeMethod(
  target: string | null | undefined
): "url" | "mailto" | null {
  if (!target) return null;

  const lower = target.toLowerCase();

  if (lower.startsWith("mailto:")) return "mailto";
  if (lower.startsWith("http://") || lower.startsWith("https://")) return "url";

  return null;
}