import {
  addMessagesToAggregate,
  buildScanResultFromAggregate,
  createScanAggregateState,
  setAggregateTotalInboxCount,
} from "./scan-aggregator";
import { fetchMessagesPageWithMetadata } from "./gmail-fetcher";
import {
  DEFAULT_FULL_SCAN_PAGE_SIZE,
  DEFAULT_METADATA_CONCURRENCY,
  DEFAULT_SAMPLE_SCAN_PAGE_SIZE,
  SAMPLE_SCAN_LIMIT,
  type RunScanOptions,
  type ScanProgress,
  type ScanResult,
} from "./scan-types";

function clampPercent(value: number): number {
  return Math.max(1, Math.min(99, Math.floor(value)));
}

function calculateProgress(params: {
  scannedCount: number;
  estimatedTotal: number | null;
  mode: "sample" | "full";
  effectiveLimit: number | null;
  completed: boolean;
}): number {
  if (params.completed) {
    return 100;
  }

  if (params.effectiveLimit && params.effectiveLimit > 0) {
    return clampPercent((params.scannedCount / params.effectiveLimit) * 100);
  }

  if (params.estimatedTotal && params.estimatedTotal > 0) {
    return clampPercent((params.scannedCount / params.estimatedTotal) * 100);
  }

  return clampPercent(10 + params.scannedCount / 20);
}

export async function runScan({
  userId,
  gmailAccessToken,
  mode,
  sampleLimit = SAMPLE_SCAN_LIMIT,
  maxEmails = null,
  maxPages,
  pageToken = null,
  pageSize,
  metadataConcurrency = DEFAULT_METADATA_CONCURRENCY,
  onProgress,
  onPartialResult,
}: RunScanOptions): Promise<ScanResult> {
  if (!userId) {
    throw new Error("Missing userId");
  }

  if (!gmailAccessToken) {
    throw new Error("Missing Gmail access token");
  }

  const effectivePageSize =
    pageSize ??
    (mode === "sample"
      ? DEFAULT_SAMPLE_SCAN_PAGE_SIZE
      : DEFAULT_FULL_SCAN_PAGE_SIZE);

  const effectiveLimit =
    typeof maxEmails === "number"
      ? maxEmails
      : mode === "sample"
      ? sampleLimit
      : null;

  const aggregate = createScanAggregateState({
    mode,
  });

  let nextPageToken: string | null = pageToken ?? null;
  let pageCount = 0;
  let completed = false;

  while (true) {
    if (typeof maxPages === "number" && pageCount >= maxPages) {
      break;
    }

    if (
      typeof effectiveLimit === "number" &&
      aggregate.processedMessages >= effectiveLimit
    ) {
      completed = true;
      nextPageToken = null;
      break;
    }

    const remaining =
      typeof effectiveLimit === "number"
        ? Math.max(0, effectiveLimit - aggregate.processedMessages)
        : effectivePageSize;

    if (typeof effectiveLimit === "number" && remaining === 0) {
      completed = true;
      nextPageToken = null;
      break;
    }

    const currentPageSize =
      typeof effectiveLimit === "number"
        ? Math.min(effectivePageSize, remaining)
        : effectivePageSize;

    const page = await fetchMessagesPageWithMetadata(
      gmailAccessToken,
      nextPageToken,
      {
        maxResults: currentPageSize,
        metadataConcurrency,
      }
    );

    setAggregateTotalInboxCount(aggregate, page.resultSizeEstimate);

    if (!page.messages.length) {
      completed = true;
      nextPageToken = null;
      break;
    }

    addMessagesToAggregate(aggregate, page.messages);

    pageCount += 1;
    nextPageToken = page.nextPageToken;

    if (
      typeof effectiveLimit === "number" &&
      aggregate.processedMessages >= effectiveLimit
    ) {
      completed = true;
      nextPageToken = null;
    } else if (!nextPageToken) {
      completed = true;
    }

    const progress: ScanProgress = {
      scannedCount: aggregate.processedMessages,
      estimatedTotal:
        typeof effectiveLimit === "number"
          ? effectiveLimit
          : aggregate.totalInboxCount,
      progressPercent: calculateProgress({
        scannedCount: aggregate.processedMessages,
        estimatedTotal: aggregate.totalInboxCount,
        mode,
        effectiveLimit,
        completed,
      }),
      nextPageToken,
      pageCount,
      completed,
    };

    if (onProgress) {
      await onProgress(progress);
    }

    if (onPartialResult) {
      const partialResult = buildScanResultFromAggregate(aggregate, completed);
      await onPartialResult(partialResult, progress);
    }

    if (completed) {
      break;
    }
  }

  return buildScanResultFromAggregate(aggregate, completed);
}