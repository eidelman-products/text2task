import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/api/auth/google/callback`,
      scopes: [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/userinfo.email",
        "openid",
      ].join(" "),
      queryParams: {
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
      },
    },
  });

  if (error || !data.url) {
    console.error("Failed to start Google OAuth:", error);
    return NextResponse.redirect(`${origin}/?error=google_oauth_start_failed`);
  }

  return NextResponse.redirect(data.url);
}