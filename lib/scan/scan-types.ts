export type ScanMode = "sample" | "full";

export type ScanStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type UnsubscribeMethod = "url" | "mailto" | null;

export type SenderGroup = {
  sender: string;
  count: number;
  ids: string[];
  unsubscribeAvailable: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod: UnsubscribeMethod;
};

export type SmartViewIds = {
  unread: string[];
  social: string[];
  jobSearch: string[];
  shopping: string[];
};

export type SmartViews = {
  unread: number;
  social: number;
  jobSearch: number;
  shopping: number;
};

export type ScanResult = {
  mode: ScanMode;
  scanned: number;
  totalInboxCount: number | null;
  topSenders: SenderGroup[];
  promotionsSenders: SenderGroup[];
  promotionsFound: number;
  promotionsFoundInSampleScan: number;
  fullInboxPromotionsCount: number | null;
  senderGroups: number;
  largestSenderCount: number;
  healthScore: number;
  smartViews: SmartViews;
  smartViewIds: SmartViewIds;
  completed: boolean;
};

export type ScanJob = {
  id: string;
  userId: string;
  mode: ScanMode;
  status: ScanStatus;
  progressPercent: number;
  scannedCount: number;
  estimatedTotal: number | null;
  nextPageToken: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RunScanOptions = {
  userId: string;
  gmailAccessToken: string;
  mode: ScanMode;
  sampleLimit?: number;
  maxPages?: number;
  pageToken?: string | null;
  resumeScanId?: string | null;
};

export type GmailMessageHeader = {
  name?: string;
  value?: string;
};

export type GmailMessageMetadata = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  payload?: {
    headers?: GmailMessageHeader[];
  };
};

export type GmailListMessagesResponse = {
  messages?: Array<{ id: string; threadId?: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

export type GmailListPage = {
  messages: Array<{ id: string; threadId?: string }>;
  nextPageToken: string | null;
  resultSizeEstimate: number | null;
};

export type ScanProgress = {
  scannedCount: number;
  estimatedTotal: number | null;
  progressPercent: number;
  nextPageToken: string | null;
};

export const SAMPLE_SCAN_LIMIT = 1000;