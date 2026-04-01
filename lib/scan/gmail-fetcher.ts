import type {
  GmailListMessagesResponse,
  GmailListPage,
  GmailMessageMetadata,
} from "./scan-types";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

const GMAIL_FETCH_MAX_RETRIES = 5;
const GMAIL_FETCH_INITIAL_DELAY_MS = 500;
const METADATA_CONCURRENCY = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function gmailFetch<T>(accessToken: string, url: string): Promise<T> {
  let attempt = 0;
  let delay = GMAIL_FETCH_INITIAL_DELAY_MS;

  while (attempt <= GMAIL_FETCH_MAX_RETRIES) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (res.ok) {
      return res.json();
    }

    const text = await res.text();

    if (!shouldRetryStatus(res.status) || attempt === GMAIL_FETCH_MAX_RETRIES) {
      console.error("🚨 GMAIL ERROR:", res.status, text);
      throw new Error(`Gmail API error: ${res.status} ${text}`);
    }

    console.warn(
      `Gmail API retry ${attempt + 1}/${GMAIL_FETCH_MAX_RETRIES} after status ${res.status}`
    );

    await sleep(delay);
    delay *= 2;
    attempt += 1;
  }

  throw new Error("Unexpected Gmail fetch failure");
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

async function fetchSingleMessageMetadata(
  accessToken: string,
  id: string
): Promise<GmailMessageMetadata> {
  const url =
    `${GMAIL_BASE}/messages/${id}` +
    `?format=metadata` +
    `&metadataHeaders=From` +
    `&metadataHeaders=Subject` +
    `&metadataHeaders=List-Unsubscribe`;

  return gmailFetch<GmailMessageMetadata>(accessToken, url);
}

export async function getMessagesMetadata(
  accessToken: string,
  ids: string[]
): Promise<GmailMessageMetadata[]> {
  const results: GmailMessageMetadata[] = [];

  for (let i = 0; i < ids.length; i += METADATA_CONCURRENCY) {
    const chunk = ids.slice(i, i + METADATA_CONCURRENCY);

    const chunkResults = await Promise.all(
      chunk.map((id) => fetchSingleMessageMetadata(accessToken, id))
    );

    results.push(...chunkResults);
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