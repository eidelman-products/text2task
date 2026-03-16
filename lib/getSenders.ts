import { cookies } from "next/headers";

type GmailHeader = {
  name: string;
  value: string;
};

type GmailListMessage = {
  id: string;
};

type GmailListResponse = {
  messages?: GmailListMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailMessage = {
  id: string;
  labelIds?: string[];
  payload?: {
    headers?: GmailHeader[];
  };
};

type SenderItem = {
  sender: string;
  count: number;
  ids: string[];
  unsubscribeAvailable: boolean;
};

type SmartViewItem = {
  count: number;
  ids: string[];
};

type SmartViewCounts = {
  unread: number;
  social: number;
  jobSearch: number;
  shopping: number;
};

export type GetSendersResult = {
  scanned: number;
  topSenders: SenderItem[];
  promotionsSenders: SenderItem[];
  smartViews: SmartViewCounts;
  smartViewIds: {
    unread: string[];
    social: string[];
    jobSearch: string[];
    shopping: string[];
  };
  fullInboxPromotionsCount: number | null;
};

const SAMPLE_SCAN_LIMIT = 1000;
const GMAIL_LIST_PAGE_SIZE = 500;
const MESSAGE_BATCH_SIZE = 20;

function emptyResult(): GetSendersResult {
  return {
    scanned: 0,
    topSenders: [],
    promotionsSenders: [],
    smartViews: {
      unread: 0,
      social: 0,
      jobSearch: 0,
      shopping: 0,
    },
    smartViewIds: {
      unread: [],
      social: [],
      jobSearch: [],
      shopping: [],
    },
    fullInboxPromotionsCount: null,
  };
}

async function fetchExactLabelCount(accessToken: string, labelId: string): Promise<number> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/labels/${labelId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) return 0;
  const data = await res.json();
  return data.messagesTotal || 0;
}

async function fetchCountByQuery(accessToken: string, query: string): Promise<number> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "1");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) return 0;
  const data: GmailListResponse = await res.json();
  return data.resultSizeEstimate || 0;
}

async function fetchMessageIds(accessToken: string, limit: number): Promise<GmailListMessage[]> {
  const collected: GmailListMessage[] = [];
  let nextPageToken: string | undefined;

  while (collected.length < limit) {
    const remaining = limit - collected.length;
    const maxResults = Math.min(GMAIL_LIST_PAGE_SIZE, remaining);

    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("maxResults", String(maxResults));
    url.searchParams.set("q", "label:INBOX");

    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken);
    }

    const listRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!listRes.ok) break;

    const listData: GmailListResponse = await listRes.json();
    const messages = listData.messages || [];

    if (!messages.length) break;

    collected.push(...messages);
    nextPageToken = listData.nextPageToken;

    if (!nextPageToken) break;
  }

  return collected.slice(0, limit);
}

async function fetchMessageMetadata(accessToken: string, messageId: string): Promise<GmailMessage | null> {
  const url =
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}` +
    `?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return res.ok ? await res.json() : null;
}

function normalizeSender(fromHeader: string): string {
  const sender = fromHeader.split("<")[0].trim().replace(/^"|"$/g, "");
  return sender || "Unknown Sender";
}

function getHeaderValue(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function isShoppingEmail(from: string, subject: string): boolean {
  return (
    from.includes("amazon") ||
    from.includes("aliexpress") ||
    from.includes("ebay") ||
    from.includes("etsy") ||
    from.includes("temu") ||
    from.includes("agoda") ||
    from.includes("booking") ||
    from.includes("trip") ||
    from.includes("travel") ||
    from.includes("shopify") ||
    subject.includes("order") ||
    subject.includes("shipping") ||
    subject.includes("delivery") ||
    subject.includes("your package") ||
    subject.includes("price alert") ||
    subject.includes("booking") ||
    subject.includes("receipt")
  );
}

function isJobEmail(from: string, subject: string): boolean {
  return (
    from.includes("linkedin") ||
    from.includes("indeed") ||
    from.includes("glassdoor") ||
    from.includes("ziprecruiter") ||
    from.includes("monster") ||
    from.includes("hire") ||
    subject.includes("job") ||
    subject.includes("job alert") ||
    subject.includes("application") ||
    subject.includes("applied") ||
    subject.includes("recruiter") ||
    subject.includes("interview") ||
    subject.includes("position")
  );
}

function pushSmartViewItem(target: SmartViewItem, messageId: string) {
  target.count += 1;
  target.ids.push(messageId);
}

function sortSenderItems(map: Record<string, { count: number; ids: string[]; unsubscribeAvailable: boolean }>) {
  return Object.entries(map)
    .map(([sender, data]) => ({
      sender,
      count: data.count,
      ids: data.ids,
      unsubscribeAvailable: data.unsubscribeAvailable,
    }))
    .sort((a, b) => b.count - a.count);
}

function upsertSender(
  map: Record<string, { count: number; ids: string[]; unsubscribeAvailable: boolean }>,
  sender: string,
  messageId: string,
  unsubscribeAvailable: boolean
) {
  if (!map[sender]) {
    map[sender] = {
      count: 0,
      ids: [],
      unsubscribeAvailable: false,
    };
  }

  map[sender].count += 1;
  map[sender].ids.push(messageId);

  if (unsubscribeAvailable) {
    map[sender].unsubscribeAvailable = true;
  }
}

export async function getSenders(): Promise<GetSendersResult> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("gmail_provider_token")?.value;

  if (!accessToken) {
    return emptyResult();
  }

  const messages = await fetchMessageIds(accessToken, SAMPLE_SCAN_LIMIT);

  if (!messages.length) {
    return emptyResult();
  }

  const [unreadCount, socialCount, promoCount] = await Promise.all([
    fetchCountByQuery(accessToken, "is:unread label:INBOX"),
    fetchExactLabelCount(accessToken, "CATEGORY_SOCIAL"),
    fetchExactLabelCount(accessToken, "CATEGORY_PROMOTIONS"),
  ]);

  const allSenderMap: Record<
    string,
    {
      count: number;
      ids: string[];
      unsubscribeAvailable: boolean;
    }
  > = {};

  const promotionsSenderMap: Record<
    string,
    {
      count: number;
      ids: string[];
      unsubscribeAvailable: boolean;
    }
  > = {};

  const smartViewMap: {
    unread: SmartViewItem;
    social: SmartViewItem;
    jobSearch: SmartViewItem;
    shopping: SmartViewItem;
  } = {
    unread: { count: 0, ids: [] },
    social: { count: 0, ids: [] },
    jobSearch: { count: 0, ids: [] },
    shopping: { count: 0, ids: [] },
  };

  for (let i = 0; i < messages.length; i += MESSAGE_BATCH_SIZE) {
    const batch = messages.slice(i, i + MESSAGE_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((m) => fetchMessageMetadata(accessToken, m.id)));

    batchResults.forEach((msgData, idx) => {
      if (!msgData) return;

      const currentMessageId = batch[idx]?.id;
      if (!currentMessageId) return;

      const headers = msgData.payload?.headers || [];
      const labelIds = msgData.labelIds || [];

      const fromHeader = getHeaderValue(headers, "From") || "Unknown Sender";
      const subjectHeader = getHeaderValue(headers, "Subject");
      const listUnsubscribeHeader = getHeaderValue(headers, "List-Unsubscribe");

      const sender = normalizeSender(fromHeader);
      const from = fromHeader.toLowerCase();
      const subject = subjectHeader.toLowerCase();
      const hasUnsubscribe = Boolean(listUnsubscribeHeader);

      // Top Senders = all inbox senders from the sample
      upsertSender(allSenderMap, sender, currentMessageId, hasUnsubscribe);

      // Promotions = only what Gmail itself labeled as Promotions
      if (labelIds.includes("CATEGORY_PROMOTIONS")) {
        upsertSender(promotionsSenderMap, sender, currentMessageId, hasUnsubscribe);
      }

      // Unread = smart view based on unread inbox messages
      if (labelIds.includes("UNREAD") && labelIds.includes("INBOX")) {
        pushSmartViewItem(smartViewMap.unread, currentMessageId);
      }

      // Social = only what Gmail itself labeled as Social
      if (labelIds.includes("CATEGORY_SOCIAL")) {
        pushSmartViewItem(smartViewMap.social, currentMessageId);
      }

      // Custom smart views
      if (isJobEmail(from, subject)) {
        pushSmartViewItem(smartViewMap.jobSearch, currentMessageId);
      }

      if (isShoppingEmail(from, subject)) {
        pushSmartViewItem(smartViewMap.shopping, currentMessageId);
      }
    });
  }

  return {
    scanned: messages.length,
    topSenders: sortSenderItems(allSenderMap),
    promotionsSenders: sortSenderItems(promotionsSenderMap),
    smartViews: {
      unread: unreadCount,
      social: socialCount,
      jobSearch: smartViewMap.jobSearch.count,
      shopping: smartViewMap.shopping.count,
    },
    smartViewIds: {
      unread: smartViewMap.unread.ids,
      social: smartViewMap.social.ids,
      jobSearch: smartViewMap.jobSearch.ids,
      shopping: smartViewMap.shopping.ids,
    },
    fullInboxPromotionsCount: promoCount,
  };
}