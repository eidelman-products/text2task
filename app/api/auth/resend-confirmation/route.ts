import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const emailValue =
    body && typeof body === "object" && "email" in body
      ? (body as { email?: unknown }).email
      : null;
  const email =
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const origin = request.nextUrl.origin;

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
    },
  });

  if (error) {
    console.error("resend confirmation route error:", error);
  }

  return NextResponse.json({
    success: true,
    message: "If this email still needs confirmation, we sent a new link.",
  });
}
