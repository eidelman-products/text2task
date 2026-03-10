import { NextRequest, NextResponse } from "next/server";

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

  const gmailResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=20",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const gmailData = await gmailResponse.json();
  const messages = gmailData.messages || [];

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
    senderCounts[message.from] = (senderCounts[message.from] || 0) + 1;
  });

  const topSenders = Object.entries(senderCounts)
    .map(([from, count]) => ({ from, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    success: true,
    resultSizeEstimate: gmailData.resultSizeEstimate || 0,
    nextPageToken: gmailData.nextPageToken || null,
    messages: detailedMessages,
    topSenders,
  });
}
