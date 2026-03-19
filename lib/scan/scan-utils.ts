import type {
  GmailMessageHeader,
  GmailMessageMetadata,
  SenderGroup,
  UnsubscribeMethod,
} from "./scan-types";

export function getHeaderValue(
  headers: GmailMessageHeader[] | undefined,
  name: string
): string | undefined {
  if (!headers?.length) return undefined;

  const target = name.toLowerCase();
  const found = headers.find(
    (header) => (header.name || "").toLowerCase() === target
  );

  return found?.value;
}

export function normalizeSender(rawFrom: string | undefined): string {
  if (!rawFrom) return "Unknown Sender";

  const trimmed = rawFrom.trim();
  if (!trimmed) return "Unknown Sender";

  return trimmed;
}

export function parseListUnsubscribe(
  value: string | undefined
): {
  unsubscribeAvailable: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod: UnsubscribeMethod;
} {
  if (!value) {
    return {
      unsubscribeAvailable: false,
      unsubscribeMethod: null,
    };
  }

  const mailtoMatch = value.match(/<mailto:[^>]+>/i);
  if (mailtoMatch) {
    return {
      unsubscribeAvailable: true,
      unsubscribeTarget: mailtoMatch[0].slice(1, -1),
      unsubscribeMethod: "mailto",
    };
  }

  const urlMatch = value.match(/<https?:\/\/[^>]+>/i);
  if (urlMatch) {
    return {
      unsubscribeAvailable: true,
      unsubscribeTarget: urlMatch[0].slice(1, -1),
      unsubscribeMethod: "url",
    };
  }

  return {
    unsubscribeAvailable: false,
    unsubscribeMethod: null,
  };
}

export function messageMatchesPromotions(
  message: GmailMessageMetadata
): boolean {
  const labels = message.labelIds || [];
  return labels.includes("CATEGORY_PROMOTIONS");
}

export function messageMatchesUnread(message: GmailMessageMetadata): boolean {
  const labels = message.labelIds || [];
  return labels.includes("UNREAD");
}

export function messageMatchesSocial(message: GmailMessageMetadata): boolean {
  const labels = message.labelIds || [];
  return labels.includes("CATEGORY_SOCIAL");
}

export function messageMatchesShopping(
  message: GmailMessageMetadata
): boolean {
  const headers = message.payload?.headers || [];
  const subject = getHeaderValue(headers, "Subject") || "";
  const lower = subject.toLowerCase();

  return (
    lower.includes("order") ||
    lower.includes("shipping") ||
    lower.includes("delivered") ||
    lower.includes("receipt") ||
    lower.includes("your package")
  );
}

export function messageMatchesJobSearch(
  message: GmailMessageMetadata
): boolean {
  const headers = message.payload?.headers || [];
  const subject = getHeaderValue(headers, "Subject") || "";
  const lower = subject.toLowerCase();

  return (
    lower.includes("job") ||
    lower.includes("application") ||
    lower.includes("interview") ||
    lower.includes("candidate") ||
    lower.includes("career")
  );
}

export function buildSenderGroups(
  messages: GmailMessageMetadata[]
): SenderGroup[] {
  const senderMap = new Map<string, SenderGroup>();

  for (const message of messages) {
    const headers = message.payload?.headers || [];
    const rawFrom = getHeaderValue(headers, "From");
    const listUnsubscribe = getHeaderValue(headers, "List-Unsubscribe");

    const sender = normalizeSender(rawFrom);
    const unsubscribe = parseListUnsubscribe(listUnsubscribe);

    const existing = senderMap.get(sender);

    if (existing) {
      existing.count += 1;
      existing.ids.push(message.id);

      if (!existing.unsubscribeAvailable && unsubscribe.unsubscribeAvailable) {
        existing.unsubscribeAvailable = true;
        existing.unsubscribeTarget = unsubscribe.unsubscribeTarget;
        existing.unsubscribeMethod = unsubscribe.unsubscribeMethod;
      }

      continue;
    }

    senderMap.set(sender, {
      sender,
      count: 1,
      ids: [message.id],
      unsubscribeAvailable: unsubscribe.unsubscribeAvailable,
      unsubscribeTarget: unsubscribe.unsubscribeTarget,
      unsubscribeMethod: unsubscribe.unsubscribeMethod,
    });
  }

  return Array.from(senderMap.values()).sort((a, b) => b.count - a.count);
}

export function calculateHealthScore(
  scanned: number,
  senderGroups: number,
  promotionsFound: number
): number {
  if (scanned <= 0) return 0;

  const senderDensity = Math.min(100, Math.round((senderGroups / scanned) * 1000));
  const promotionsRatio = Math.min(
    100,
    Math.round((promotionsFound / scanned) * 100)
  );

  const rawScore = 100 - Math.round(senderDensity * 0.35 + promotionsRatio * 0.65);
  return Math.max(0, Math.min(100, rawScore));
}

export function getLargestSenderCount(groups: SenderGroup[]): number {
  if (!groups.length) return 0;
  return Math.max(...groups.map((group) => group.count));
}