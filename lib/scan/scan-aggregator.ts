import type {
  GmailMessageMetadata,
  ScanMode,
  ScanResult,
  SmartViewIds,
  SmartViews,
} from "./scan-types";
import {
  buildSenderGroups,
  calculateHealthScore,
  getLargestSenderCount,
  messageMatchesJobSearch,
  messageMatchesPromotions,
  messageMatchesShopping,
  messageMatchesSocial,
  messageMatchesUnread,
} from "./scan-utils";

type BuildScanResultInput = {
  mode: ScanMode;
  messages: GmailMessageMetadata[];
  totalInboxCount?: number | null;
  fullInboxPromotionsCount?: number | null;
  completed?: boolean;
};

export function buildScanResult({
  mode,
  messages,
  totalInboxCount = null,
  fullInboxPromotionsCount = null,
  completed = true,
}: BuildScanResultInput): ScanResult {
  const topSenders = buildSenderGroups(messages);

  const promotionsMessages = messages.filter(messageMatchesPromotions);
  const promotionsSenders = buildSenderGroups(promotionsMessages);

  const smartViewIds: SmartViewIds = {
    unread: [],
    social: [],
    jobSearch: [],
    shopping: [],
  };

  for (const message of messages) {
    if (messageMatchesUnread(message)) {
      smartViewIds.unread.push(message.id);
    }

    if (messageMatchesSocial(message)) {
      smartViewIds.social.push(message.id);
    }

    if (messageMatchesJobSearch(message)) {
      smartViewIds.jobSearch.push(message.id);
    }

    if (messageMatchesShopping(message)) {
      smartViewIds.shopping.push(message.id);
    }
  }

  const smartViews: SmartViews = {
    unread: smartViewIds.unread.length,
    social: smartViewIds.social.length,
    jobSearch: smartViewIds.jobSearch.length,
    shopping: smartViewIds.shopping.length,
  };

  const scanned = messages.length;
  const senderGroups = topSenders.length;
  const largestSenderCount = getLargestSenderCount(topSenders);
  const promotionsFoundInSampleScan = promotionsMessages.length;
  const promotionsFound = promotionsFoundInSampleScan;
  const healthScore = calculateHealthScore(
    scanned,
    senderGroups,
    promotionsFoundInSampleScan
  );

  return {
    mode,
    scanned,
    totalInboxCount,
    topSenders,
    promotionsSenders,
    promotionsFound,
    promotionsFoundInSampleScan,
    fullInboxPromotionsCount,
    senderGroups,
    largestSenderCount,
    healthScore,
    smartViews,
    smartViewIds,
    completed,
  };
}