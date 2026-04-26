import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const passwordValue = formData.get("password");
  const confirmPasswordValue = formData.get("confirmPassword");

  const password = typeof passwordValue === "string" ? passwordValue : "";
  const confirmPassword =
    typeof confirmPasswordValue === "string" ? confirmPasswordValue : "";

  if (!password || password.length < 8) {
    return NextResponse.redirect(
      new URL("/reset-password?error=password_too_short", request.url)
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.redirect(
      new URL("/reset-password?error=passwords_do_not_match", request.url)
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    if (userError) {
      console.error("update password getUser error:", userError);
    }

    return NextResponse.redirect(
      new URL("/reset-password?error=missing_session", request.url)
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password,
  });

  if (updateError) {
    console.error("update password route error:", updateError);

    return NextResponse.redirect(
      new URL("/reset-password?error=update_failed", request.url)
    );
  }

  const { error: signOutError } = await supabase.auth.signOut();

  if (signOutError) {
    console.error("update password signOut error:", signOutError);
  }

  return NextResponse.redirect(new URL("/login?reset=1", request.url));
}