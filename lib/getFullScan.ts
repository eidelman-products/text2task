import { createClient } from "@/lib/supabase/server";
import { runScan } from "@/lib/scan/scan-engine";
import { getValidAccessToken } from "@/lib/gmail/token-manager";

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

function emptyResult(): GetFullScanResult {
  return {
    scanned: 0,
    topSenders: [],
    promotionsSenders: [],
    smartViews: {
      unread: 0,
      social: 0,
      jobSearch: 0,
      shopping: 0,
    },
    smartViewIds: {
      unread: [],
      social: [],
      jobSearch: [],
      shopping: [],
    },
    fullInboxPromotionsCount: null,
    mode: "full",
    completed: false,
  };
}

async function fetchExactLabelCount(
  accessToken: string,
  labelId: string
): Promise<number> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/labels/${labelId}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Failed to fetch exact label count:", res.status, text);
    return 0;
  }

  const data = await res.json();
  return data.messagesTotal || 0;
}

export async function getFullScan(): Promise<GetFullScanResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("No authenticated user in getFullScan:", userError);
    return emptyResult();
  }

  const accessToken = await getValidAccessToken(user.id);

  const scanResult = await runScan({
    userId: user.id,
    gmailAccessToken: accessToken,
    mode: "full",
  });

  const fullInboxPromotionsCount = await fetchExactLabelCount(
    accessToken,
    "CATEGORY_PROMOTIONS"
  );

  return {
    scanned: scanResult.scanned,
    topSenders: scanResult.topSenders,
    promotionsSenders: scanResult.promotionsSenders,
    smartViews: scanResult.smartViews,
    smartViewIds: scanResult.smartViewIds,
    fullInboxPromotionsCount,
    mode: "full",
    completed: scanResult.completed,
  };
}