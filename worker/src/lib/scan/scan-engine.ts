import { buildScanResult } from "./scan-aggregator";
import { fetchMessagesPageWithMetadata } from "./gmail-fetcher";
import {
  SAMPLE_SCAN_LIMIT,
  type GmailMessageMetadata,
  type RunScanOptions,
  type ScanResult,
} from "./scan-types";

export async function runScan({
  userId,
  gmailAccessToken,
  mode,
  sampleLimit = SAMPLE_SCAN_LIMIT,
  maxPages,
}: RunScanOptions): Promise<ScanResult> {
  if (!userId) {
    throw new Error("Missing userId");
  }

  if (!gmailAccessToken) {
    throw new Error("Missing Gmail access token");
  }

  const limit = mode === "sample" ? sampleLimit : Number.POSITIVE_INFINITY;

  const allMessages: GmailMessageMetadata[] = [];
  let nextPageToken: string | null = null;
  let pageCount = 0;
  let totalInboxCount: number | null = null;

  while (allMessages.length < limit) {
    if (typeof maxPages === "number" && pageCount >= maxPages) {
      break;
    }

    const page = await fetchMessagesPageWithMetadata(
      gmailAccessToken,
      nextPageToken
    );

    if (totalInboxCount === null && page.resultSizeEstimate != null) {
      totalInboxCount = page.resultSizeEstimate;
    }

    if (!page.messages.length) {
      break;
    }

    allMessages.push(...page.messages);
    pageCount += 1;
    nextPageToken = page.nextPageToken;

    if (!nextPageToken) {
      break;
    }
  }

  const slicedMessages =
    mode === "sample" ? allMessages.slice(0, sampleLimit) : allMessages;

  return buildScanResult({
    mode,
    messages: slicedMessages,
    totalInboxCount,
    fullInboxPromotionsCount: null,
    completed: !nextPageToken,
  });
}