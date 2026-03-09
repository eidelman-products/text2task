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

  // Exchange code for access token
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

  // Call Gmail API
  const gmailResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in%3Ainbox&maxResults=20",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const gmailData = await gmailResponse.json();

  return NextResponse.json({
    success: true,
    gmailData,
  });
}
