export type GetSendersResult = {
  scanned: number;
  topSenders: Array<{
    sender: string;
    count: number;
    ids: string[];
    unsubscribeAvailable: boolean;
    unsubscribeTarget?: string;
    unsubscribeMethod?: "url" | "mailto" | null;
  }>;
  promotionsSenders: Array<{
    sender: string;
    count: number;
    ids: string[];
    unsubscribeAvailable: boolean;
    unsubscribeTarget?: string;
    unsubscribeMethod?: "url" | "mailto" | null;
  }>;
  smartViews: {
    unread: number;
    social: number;
    jobSearch: number;
    shopping: number;
  };
  smartViewIds: {
    unread: string[];
    social: string[];
    jobSearch: string[];
    shopping: string[];
  };
  fullInboxPromotionsCount: number | null;
};

export async function getSenders(): Promise<GetSendersResult> {
  throw new Error(
    "Legacy getSenders() is disabled. Use the V2 scan flow via /api/scans/start with scanType='sample'."
  );
}