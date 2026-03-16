import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/supabase/ensureUser";

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
    return NextResponse.redirect(
      `${origin}/?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  const userId = data.user?.id;
  const userEmail = data.user?.email;
  const providerToken = data.session?.provider_token;

  if (userId && userEmail) {
    try {
      await ensureUser({
        id: userId,
        email: userEmail,
      });
    } catch (err) {
      console.error("ensureUser failed:", err);
    }
  }

  const response = NextResponse.redirect(`${origin}/dashboard`);

  if (providerToken) {
    response.cookies.set("gmail_provider_token", providerToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}