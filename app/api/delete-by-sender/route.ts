import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sender = body.sender;
  const accessToken = body.accessToken;

  if (!sender || !accessToken) {
    return NextResponse.json({
      success: false,
      error: "Missing sender or access token"
    });
  }

  const searchQuery = `from:${sender}`;

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const listData = await listResponse.json();
  const messages = listData.messages || [];

  let deleted = 0;

  for (const message of messages) {
    await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}/trash`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    deleted++;
  }

  return NextResponse.json({
    success: true,
    sender,
    deleted
  });
}
