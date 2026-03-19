import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/supabase/ensureUser";
import { encrypt } from "@/lib/gmail/crypto";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);

  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`);
  }

  const supabase = await createClient();

  const { data, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("exchangeCodeForSession failed:", exchangeError);
    return NextResponse.redirect(
      `${origin}/?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  const userId = data.user?.id;
  const userEmail = data.user?.email ?? null;
  const providerToken = data.session?.provider_token ?? null;
  const providerRefreshToken = data.session?.provider_refresh_token ?? null;
  const expiresAt = data.session?.expires_at ?? null;

  if (!userId || !userEmail) {
    console.error("Missing user after OAuth exchange");
    return NextResponse.redirect(`${origin}/?error=missing_user`);
  }

  try {
    await ensureUser({
      id: userId,
      email: userEmail,
    });
  } catch (err) {
    console.error("ensureUser failed:", err);
  }

  if (!providerToken) {
    console.error("Missing provider_token on Google session");
    return NextResponse.redirect(`${origin}/dashboard?gmail=missing-token`);
  }

  const encryptedAccessToken = encrypt(providerToken);
  const encryptedRefreshToken = providerRefreshToken
    ? encrypt(providerRefreshToken)
    : null;

  const { error: upsertError } = await supabase
    .from("gmail_oauth_tokens")
    .upsert(
      {
        user_id: userId,
        provider: "google",
        email: userEmail,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_type: "Bearer",
        scope: null,
        expires_at:
          typeof expiresAt === "number"
            ? new Date(expiresAt * 1000).toISOString()
            : null,
        last_refreshed_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("Failed saving Gmail tokens:", upsertError);
    return NextResponse.redirect(`${origin}/dashboard?gmail=save-failed`);
  }

  const response = NextResponse.redirect(`${origin}/dashboard`);

  response.cookies.delete("gmail_provider_token");
  response.cookies.delete("gmail_provider_refresh_token");
  response.cookies.delete("gmail_provider_token_expires_at");

  return response;
}