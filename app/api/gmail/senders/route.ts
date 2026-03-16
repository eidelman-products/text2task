import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type GmailHeader = {
  name: string;
  value: string;
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
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("gmail_provider_token")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing Google provider token" },
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

  const listData = await listRes.json();
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

    const fromHeader =
      headers.find((h) => h.name === "From")?.value || "";

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
}
