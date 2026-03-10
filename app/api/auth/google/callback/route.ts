import { NextRequest, NextResponse } from "next/server";

function normalizeSender(from: string) {
  const lowerFrom = from.toLowerCase();

  if (lowerFrom.includes("aliexpress")) return "AliExpress";
  if (lowerFrom.includes("amazon")) return "Amazon";
  if (lowerFrom.includes("linkedin")) return "LinkedIn";
  if (lowerFrom.includes("youtube")) return "YouTube";
  if (lowerFrom.includes("vercel")) return "Vercel";
  if (lowerFrom.includes("binance")) return "Binance";
  if (lowerFrom.includes("github")) return "GitHub";
  if (lowerFrom.includes("semrush")) return "Semrush";
  if (lowerFrom.includes("alibaba")) return "Alibaba";
  if (lowerFrom.includes("tubespanner")) return "TubeSpanner";

  const cleaned = from
    .replace(/<.*?>/g, "")
    .replace(/["']/g, "")
    .trim();

  return cleaned || "Unknown Sender";
}
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json(
      { success: false, error: "No code received" },
      { status: 400 }
    );
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

const MAX_EMAILS = 100;
const PAGE_SIZE = 25;

let allMessages: { id: string; threadId: string }[] = [];
let nextPageToken: string | null = null;

do {
  const gmailUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
gmailUrl.searchParams.set("labelIds", "INBOX");  
gmailUrl.searchParams.set("maxResults", PAGE_SIZE.toString());

  if (nextPageToken) {
    gmailUrl.searchParams.set("pageToken", nextPageToken);
  }

  const gmailResponse = await fetch(gmailUrl.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const gmailData = await gmailResponse.json();
  const messages = gmailData.messages || [];

  allMessages = [...allMessages, ...messages];
  nextPageToken = gmailData.nextPageToken || null;

  if (allMessages.length >= MAX_EMAILS) {
    allMessages = allMessages.slice(0, MAX_EMAILS);
    break;
  }
} while (nextPageToken);

const messages = allMessages;

  const detailedMessages = await Promise.all(
    messages.map(async (message: { id: string; threadId: string }) => {
      const detailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const detailData = await detailResponse.json();
      const headers = detailData.payload?.headers || [];

      const fromHeader =
        headers.find((h: { name: string; value: string }) => h.name === "From")
          ?.value || "Unknown Sender";

      const subjectHeader =
        headers.find((h: { name: string; value: string }) => h.name === "Subject")
          ?.value || "(No Subject)";

      const dateHeader =
        headers.find((h: { name: string; value: string }) => h.name === "Date")
          ?.value || "";

      return {
        id: message.id,
        threadId: message.threadId,
        from: fromHeader,
        subject: subjectHeader,
        date: dateHeader,
      };
    })
  );

  const senderCounts: Record<string, number> = {};

  detailedMessages.forEach((message) => {
  const normalizedSender = normalizeSender(message.from);
  senderCounts[normalizedSender] = (senderCounts[normalizedSender] || 0) + 1;
});

  const topSenders = Object.entries(senderCounts)
    .map(([from, count]) => ({ from, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    success: true,
resultSizeEstimate: messages.length,
nextPageToken: nextPageToken,
    messages: detailedMessages,
    topSenders,
  });
}
