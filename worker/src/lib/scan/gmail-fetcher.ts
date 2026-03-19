import type {
  GmailListMessagesResponse,
  GmailListPage,
  GmailMessageMetadata,
} from "./scan-types";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 20000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(
  attempt: number,
  retryAfterHeader: string | null
): number {
  if (retryAfterHeader) {
    const retryAfterSeconds = Number(retryAfterHeader);
    if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }
  }

  const jitter = Math.floor(Math.random() * 250);
  return BASE_DELAY_MS * 2 ** attempt + jitter;
}

async function gmailFetch<T>(
  accessToken: string,
  url: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        return (await res.json()) as T;
      }

      const text = await res.text();
      const retryAfter = res.headers.get("retry-after");
      const isRetryable = RETRYABLE_STATUS_CODES.has(res.status);

      console.error("🚨 GMAIL ERROR:", {
        status: res.status,
        retryable: isRetryable,
        attempt,
        url,
        body: text,
      });

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw new Error(`Gmail API error: ${res.status} ${text}`);
      }

      const delayMs = getRetryDelayMs(attempt, retryAfter);

      console.warn("Retrying Gmail request after delay", {
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        delayMs,
        status: res.status,
        url,
      });

      await sleep(delayMs);
    } catch (error) {
      clearTimeout(timeout);

      const message =
        error instanceof Error ? error.message : String(error);

      const isAbortError =
        error instanceof Error &&
        (error.name === "AbortError" || message.includes("aborted"));

      const isNetworkLikeError =
        isAbortError ||
        message.includes("fetch failed") ||
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("ECONNRESET") ||
        message.includes("ETIMEDOUT");

      lastError =
        error instanceof Error ? error : new Error(message);

      console.warn("Gmail request failed", {
        attempt,
        url,
        isAbortError,
        isNetworkLikeError,
        error: message,
      });

      if (!isNetworkLikeError || attempt === MAX_RETRIES) {
        throw lastError;
      }

      const delayMs = getRetryDelayMs(attempt, null);

      console.warn("Retrying Gmail request after network/timeout error", {
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        delayMs,
        url,
      });

      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error("Unknown Gmail fetch failure");
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const safeConcurrency = Math.max(1, concurrency);
  const results: TOutput[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = currentIndex;
      currentIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(safeConcurrency, items.length) }, () => worker())
  );

  return results;
}

export async function listMessagePage(
  accessToken: string,
  pageToken?: string | null,
  maxResults: number = 25
): Promise<GmailListPage> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: "label:INBOX",
    fields: "messages/id,messages/threadId,nextPageToken,resultSizeEstimate",
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
  ids: string[],
  concurrency: number = 5
): Promise<GmailMessageMetadata[]> {
  if (!ids.length) {
    return [];
  }

  return mapWithConcurrency(ids, concurrency, async (id) => {
    const url =
      `${GMAIL_BASE}/messages/${id}` +
      `?format=metadata` +
      `&metadataHeaders=From` +
      `&metadataHeaders=Subject` +
      `&metadataHeaders=List-Unsubscribe` +
      `&fields=id,threadId,labelIds,payload/headers`;

    return gmailFetch<GmailMessageMetadata>(accessToken, url);
  });
}

export async function fetchMessagesPageWithMetadata(
  accessToken: string,
  pageToken?: string | null,
  options?: {
    maxResults?: number;
    metadataConcurrency?: number;
  }
): Promise<{
  messages: GmailMessageMetadata[];
  nextPageToken: string | null;
  resultSizeEstimate: number | null;
}> {
  const page = await listMessagePage(
    accessToken,
    pageToken,
    options?.maxResults ?? 25
  );

  if (!page.messages.length) {
    return {
      messages: [],
      nextPageToken: null,
      resultSizeEstimate: page.resultSizeEstimate,
    };
  }

  const ids = page.messages.map((m) => m.id);
  const metadata = await getMessagesMetadata(
    accessToken,
    ids,
    options?.metadataConcurrency ?? 5
  );

  return {
    messages: metadata,
    nextPageToken: page.nextPageToken,
    resultSizeEstimate: page.resultSizeEstimate,
  };
}