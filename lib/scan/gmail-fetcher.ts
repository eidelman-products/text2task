import type {
  GmailListMessagesResponse,
  GmailListPage,
  GmailMessageMetadata,
} from "./scan-types";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch<T>(
  accessToken: string,
  url: string
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("🚨 GMAIL ERROR:", res.status, text);
    throw new Error(`Gmail API error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function listMessagePage(
  accessToken: string,
  pageToken?: string | null,
  maxResults: number = 100
): Promise<GmailListPage> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: "label:INBOX",
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const url = `${GMAIL_BASE}/messages?${params.toString()}`;

  const data = await gmailFetch<GmailListMessagesResponse>(accessToken, url);

  return {
    messages: data.messages || [],
    nextPageToken: data.nextPageToken || null,
    resultSizeEstimate: data.resultSizeEstimate || null,
  };
}

export async function getMessagesMetadata(
  accessToken: string,
  ids: string[]
): Promise<GmailMessageMetadata[]> {
  const results: GmailMessageMetadata[] = [];

  for (const id of ids) {
    const url =
      `${GMAIL_BASE}/messages/${id}` +
      `?format=metadata` +
      `&metadataHeaders=From` +
      `&metadataHeaders=Subject` +
      `&metadataHeaders=List-Unsubscribe`;

    const data = await gmailFetch<GmailMessageMetadata>(accessToken, url);
    results.push(data);
  }

  return results;
}

export async function fetchMessagesPageWithMetadata(
  accessToken: string,
  pageToken?: string | null
): Promise<{
  messages: GmailMessageMetadata[];
  nextPageToken: string | null;
  resultSizeEstimate: number | null;
}> {
  const page = await listMessagePage(accessToken, pageToken);

  if (!page.messages.length) {
    return {
      messages: [],
      nextPageToken: null,
      resultSizeEstimate: page.resultSizeEstimate,
    };
  }

  const ids = page.messages.map((m) => m.id);
  const metadata = await getMessagesMetadata(accessToken, ids);

  return {
    messages: metadata,
    nextPageToken: page.nextPageToken,
    resultSizeEstimate: page.resultSizeEstimate,
  };
}