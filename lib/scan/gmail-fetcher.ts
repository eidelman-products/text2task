import type {
  GmailListMessagesResponse,
  GmailListPage,
  GmailMessageMetadata,
} from "./scan-types";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// Production-safe defaults for SaaS + Gmail API friendliness
const GMAIL_FETCH_MAX_RETRIES = 5;
const GMAIL_FETCH_INITIAL_DELAY_MS = 750;
const GMAIL_FETCH_MAX_DELAY_MS = 10_000;
const METADATA_CONCURRENCY = 8;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number) {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function getJitteredDelay(baseDelay: number) {
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(baseDelay + jitter, GMAIL_FETCH_MAX_DELAY_MS);
}

function getRetryAfterDelayMs(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) return null;

  const seconds = Number(retryAfterHeader);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, GMAIL_FETCH_MAX_DELAY_MS);
  }

  const dateMs = Date.parse(retryAfterHeader);
  if (Number.isNaN(dateMs)) return null;

  const delay = dateMs - Date.now();
  if (delay <= 0) return 0;

  return Math.min(delay, GMAIL_FETCH_MAX_DELAY_MS);
}

async function parseErrorBody(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function gmailFetch<T>(accessToken: string, url: string): Promise<T> {
  let attempt = 0;
  let delay = GMAIL_FETCH_INITIAL_DELAY_MS;

  while (attempt <= GMAIL_FETCH_MAX_RETRIES) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (res.ok) {
        return (await res.json()) as T;
      }

      const errorText = await parseErrorBody(res);

      if (!shouldRetryStatus(res.status) || attempt === GMAIL_FETCH_MAX_RETRIES) {
        console.error("🚨 GMAIL ERROR:", {
          status: res.status,
          attempt,
          url,
          body: errorText,
        });

        throw new Error(`Gmail API error: ${res.status} ${errorText}`);
      }

      const retryAfterMs = getRetryAfterDelayMs(res.headers.get("retry-after"));
      const waitMs =
        retryAfterMs !== null ? retryAfterMs : getJitteredDelay(delay);

      console.warn("Gmail API transient error, retrying request", {
        status: res.status,
        attempt: attempt + 1,
        maxRetries: GMAIL_FETCH_MAX_RETRIES,
        waitMs,
        url,
      });

      await sleep(waitMs);
      delay = Math.min(delay * 2, GMAIL_FETCH_MAX_DELAY_MS);
      attempt += 1;
    } catch (error) {
      const isLastAttempt = attempt === GMAIL_FETCH_MAX_RETRIES;

      if (isLastAttempt) {
        console.error("🚨 GMAIL NETWORK ERROR:", {
          attempt,
          url,
          error,
        });
        throw error;
      }

      const waitMs = getJitteredDelay(delay);

      console.warn("Gmail fetch network failure, retrying request", {
        attempt: attempt + 1,
        maxRetries: GMAIL_FETCH_MAX_RETRIES,
        waitMs,
        url,
        error,
      });

      await sleep(waitMs);
      delay = Math.min(delay * 2, GMAIL_FETCH_MAX_DELAY_MS);
      attempt += 1;
    }
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