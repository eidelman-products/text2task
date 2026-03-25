export type TopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod?: "url" | "mailto" | null;
};

export type SmartViews = {
  unread: number;
  social: number;
  jobSearch: number;
  shopping: number;
};

export type SmartViewIds = {
  unread: string[];
  social: string[];
  jobSearch: string[];
  shopping: string[];
};

export type ActiveNav =
  | "dashboard"
  | "scan-results"
  | "top-senders"
  | "promotions"
  | "unread"
  | "social-notifications"
  | "job-search"
  | "online-shopping"
  | "privacy-trust"
  | "billing";

export type ScanResult = {
  mode?: "sample" | "full";
  scanned: number;
  totalInboxCount?: number | null;
  topSenders: TopSender[];
  promotionsSenders: TopSender[];
  promotionsFound: number;
  promotionsFoundInSampleScan: number;
  fullInboxPromotionsCount: number | null;
  senderGroups: number;
  largestSenderCount: number;
  healthScore: number;
  smartViews: SmartViews;
  smartViewIds: SmartViewIds;
  completed?: boolean;
};

export type SenderBucket =
  | "1000+ messages"
  | "500–999 messages"
  | "100–499 messages"
  | "10–99 messages";

export type HealthTone = "green" | "yellow" | "red";

export type ToneStyles = {
  cardBg: string;
  cardBorder: string;
  title: string;
  bar: string;
  chipBg: string;
  chipColor: string;
  chipText: string;
};