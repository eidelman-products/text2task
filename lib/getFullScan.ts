export type GetFullScanResult = {
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
  mode: "full";
  completed: boolean;
};

export async function getFullScan(): Promise<GetFullScanResult> {
  throw new Error(
    "Legacy getFullScan() is disabled. Use the V2 scan flow via /api/scans/start with scanType='full'."
  );
}