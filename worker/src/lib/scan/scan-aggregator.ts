import type {
  GmailMessageMetadata,
  ScanAggregateState,
  ScanMode,
  ScanResult,
  SenderGroup,
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

type MutableAggregateState = {
  mode: ScanMode;
  totalInboxCount: number | null;
  fullInboxPromotionsCount: number | null;
  processedMessages: number;
  allTopSendersMap: Map<string, SenderGroup>;
  promotionsSendersMap: Map<string, SenderGroup>;
  promotionsFoundCount: number;
  smartViewIds: SmartViewIds;
};

function cloneIds(ids: string[]): string[] {
  return [...ids];
}

function mergeSenderGroupsIntoMap(
  target: Map<string, SenderGroup>,
  groups: SenderGroup[]
): void {
  for (const group of groups) {
    const existing = target.get(group.sender);

    if (!existing) {
      target.set(group.sender, {
        sender: group.sender,
        count: group.count,
        ids: cloneIds(group.ids),
        unsubscribeAvailable: group.unsubscribeAvailable,
        unsubscribeTarget: group.unsubscribeTarget,
        unsubscribeMethod: group.unsubscribeMethod,
      });
      continue;
    }

    existing.count += group.count;

    const mergedIds = new Set([...existing.ids, ...group.ids]);
    existing.ids = Array.from(mergedIds);

    existing.unsubscribeAvailable =
      existing.unsubscribeAvailable || group.unsubscribeAvailable;

    if (!existing.unsubscribeTarget && group.unsubscribeTarget) {
      existing.unsubscribeTarget = group.unsubscribeTarget;
    }

    if (!existing.unsubscribeMethod && group.unsubscribeMethod) {
      existing.unsubscribeMethod = group.unsubscribeMethod;
    }
  }
}

function sortSenderGroups(groups: SenderGroup[]): SenderGroup[] {
  return [...groups].sort((a, b) => b.count - a.count);
}

export function createScanAggregateState(params: {
  mode: ScanMode;
  totalInboxCount?: number | null;
  fullInboxPromotionsCount?: number | null;
}): MutableAggregateState {
  return {
    mode: params.mode,
    totalInboxCount: params.totalInboxCount ?? null,
    fullInboxPromotionsCount: params.fullInboxPromotionsCount ?? null,
    processedMessages: 0,
    allTopSendersMap: new Map<string, SenderGroup>(),
    promotionsSendersMap: new Map<string, SenderGroup>(),
    promotionsFoundCount: 0,
    smartViewIds: {
      unread: [],
      social: [],
      jobSearch: [],
      shopping: [],
    },
  };
}

export function setAggregateTotalInboxCount(
  state: MutableAggregateState,
  totalInboxCount: number | null | undefined
): void {
  if (state.totalInboxCount == null && totalInboxCount != null) {
    state.totalInboxCount = totalInboxCount;
  }
}

export function addMessagesToAggregate(
  state: MutableAggregateState,
  messages: GmailMessageMetadata[]
): void {
  if (!messages.length) {
    return;
  }

  state.processedMessages += messages.length;

  const topSenderGroups = buildSenderGroups(messages);
  mergeSenderGroupsIntoMap(state.allTopSendersMap, topSenderGroups);

  const promotionsMessages = messages.filter(messageMatchesPromotions);
  state.promotionsFoundCount += promotionsMessages.length;

  const promotionsSenderGroups = buildSenderGroups(promotionsMessages);
  mergeSenderGroupsIntoMap(state.promotionsSendersMap, promotionsSenderGroups);

  for (const message of messages) {
    if (messageMatchesUnread(message)) {
      state.smartViewIds.unread.push(message.id);
    }

    if (messageMatchesSocial(message)) {
      state.smartViewIds.social.push(message.id);
    }

    if (messageMatchesJobSearch(message)) {
      state.smartViewIds.jobSearch.push(message.id);
    }

    if (messageMatchesShopping(message)) {
      state.smartViewIds.shopping.push(message.id);
    }
  }
}

export function buildAggregateSnapshot(
  state: MutableAggregateState
): ScanAggregateState {
  const topSenders = sortSenderGroups(Array.from(state.allTopSendersMap.values()));
  const promotionsSenders = sortSenderGroups(
    Array.from(state.promotionsSendersMap.values())
  );

  const smartViews: SmartViews = {
    unread: state.smartViewIds.unread.length,
    social: state.smartViewIds.social.length,
    jobSearch: state.smartViewIds.jobSearch.length,
    shopping: state.smartViewIds.shopping.length,
  };

  const senderGroups = topSenders.length;
  const largestSenderCount = getLargestSenderCount(topSenders);
  const promotionsFoundInSampleScan = state.promotionsFoundCount;
  const promotionsFound = state.promotionsFoundCount;

  const healthScore = calculateHealthScore(
    state.processedMessages,
    senderGroups,
    promotionsFoundInSampleScan
  );

  return {
    mode: state.mode,
    scanned: state.processedMessages,
    totalInboxCount: state.totalInboxCount,
    topSenders,
    promotionsSenders,
    promotionsFound,
    promotionsFoundInSampleScan,
    fullInboxPromotionsCount: state.fullInboxPromotionsCount,
    senderGroups,
    largestSenderCount,
    healthScore,
    smartViews,
    smartViewIds: {
      unread: cloneIds(state.smartViewIds.unread),
      social: cloneIds(state.smartViewIds.social),
      jobSearch: cloneIds(state.smartViewIds.jobSearch),
      shopping: cloneIds(state.smartViewIds.shopping),
    },
  };
}

export function buildScanResultFromAggregate(
  state: MutableAggregateState,
  completed: boolean
): ScanResult {
  const snapshot = buildAggregateSnapshot(state);

  return {
    ...snapshot,
    completed,
  };
}