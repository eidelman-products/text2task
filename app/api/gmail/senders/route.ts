import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/gmail/token-manager";

type GmailHeader = {
  name: string;
  value: string;
};

type GmailListResponse = {
  messages?: { id: string }[];
};

type GmailMessage = {
  id: string;
  payload?: {
    headers?: GmailHeader[];
  };
};

function extractSender(fromHeader: string): string {
  if (!fromHeader) return "Unknown";

  const emailMatch = fromHeader.match(/<([^>]+)>/);
  const email = emailMatch?.[1] || fromHeader;

  const domain = email.split("@")[1];
  if (!domain) return email.trim();

  return domain.replace(/^mail\./, "").trim();
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id || !user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const accessToken = await getValidAccessToken(user.id);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing Gmail access token" },
        { status: 401 }
      );
    }

    const MAX_RESULTS = 1000;

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${MAX_RESULTS}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!listRes.ok) {
      const errorText = await listRes.text();
      return NextResponse.json(
        { error: "Failed to list Gmail messages", details: errorText },
        { status: 500 }
      );
    }

    const listData: GmailListResponse = await listRes.json();
    const messages = listData.messages || [];

    if (!messages.length) {
      return NextResponse.json({ senders: [] });
    }

    const senderCounts: Record<string, number> = {};

    for (const message of messages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

      if (!msgRes.ok) continue;

      const msgData: GmailMessage = await msgRes.json();
      const headers = msgData.payload?.headers || [];

      const fromHeader = headers.find((h) => h.name === "From")?.value || "";
      const sender = extractSender(fromHeader);

      senderCounts[sender] = (senderCounts[sender] || 0) + 1;
    }

    const senders = Object.entries(senderCounts)
      .map(([sender, count], index) => ({
        id: index.toString(),
        sender,
        emails: count,
        domain: sender.toLowerCase(),
        unsubscribable: true,
      }))
      .sort((a, b) => b.emails - a.emails);

    return NextResponse.json({ senders });
  } catch (error: any) {
    console.error("gmail/senders route error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to load senders" },
      { status: 500 }
    );
  }
}