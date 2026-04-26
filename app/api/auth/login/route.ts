import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/supabase/ensureUser";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const emailValue = formData.get("email");
    const passwordValue = formData.get("password");

    const email =
      typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
    const password =
      typeof passwordValue === "string" ? passwordValue : "";

    if (!email || !password || !isValidEmail(email)) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_credentials", request.url)
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_credentials", request.url)
      );
    }

    await ensureUser({
      id: data.user.id,
      email: data.user.email ?? email,
    });

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("login route error:", error);

    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}