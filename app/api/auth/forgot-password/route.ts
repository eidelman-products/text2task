import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const emailValue = formData.get("email");

  const email =
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.redirect(
      new URL("/forgot-password?error=invalid_email", request.url)
    );
  }

  const supabase = await createClient();

  const redirectTo = `${request.nextUrl.origin}/auth/confirm?next=/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    console.error("forgot password route error:", error);

    return NextResponse.redirect(
      new URL("/forgot-password?error=unable_to_send", request.url)
    );
  }

  return NextResponse.redirect(
    new URL(
      `/forgot-password?sent=1&email=${encodeURIComponent(email)}`,
      request.url
    )
  );
}