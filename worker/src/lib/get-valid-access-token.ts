import { supabaseAdmin } from "../supabase";
import { decrypt } from "./crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function getValidAccessToken(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("gmail_oauth_tokens")
    .select(
      "access_token_encrypted, refresh_token_encrypted, expires_at"
    )
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("No Gmail tokens found");
  }

  if (!data.access_token_encrypted) {
    throw new Error("Missing encrypted access token");
  }

  const accessToken = decrypt(data.access_token_encrypted);
  const refreshToken = data.refresh_token_encrypted
    ? decrypt(data.refresh_token_encrypted)
    : null;

  const expiresAt = data.expires_at
    ? new Date(data.expires_at).getTime()
    : 0;

  const now = Date.now();

  if (expiresAt > now + 60 * 1000) {
    return accessToken;
  }

  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const json = await res.json();

  if (!res.ok || !json.access_token || !json.expires_in) {
    console.error("Token refresh failed", json);
    throw new Error("Failed to refresh token");
  }

  const newAccessToken = json.access_token as string;
  const expiresIn = Number(json.expires_in);
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

  await supabaseAdmin
    .from("gmail_oauth_tokens")
    .update({
      access_token_encrypted: data.access_token_encrypted, // לא משנה עכשיו
      expires_at: newExpiresAt.toISOString(),
    })
    .eq("user_id", userId);

  return newAccessToken;
}