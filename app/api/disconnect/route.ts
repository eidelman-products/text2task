import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const cookieStore = await cookies();
    const providerToken = cookieStore.get("gmail_provider_token")?.value;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json(
        { error: `getUser failed: ${userError.message}` },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (providerToken) {
      const revokeRes = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          token: providerToken,
        }).toString(),
        cache: "no-store",
      });

      if (!revokeRes.ok) {
        const revokeText = await revokeRes.text();
        return NextResponse.json(
          { error: `Google revoke failed: ${revokeText || revokeRes.statusText}` },
          { status: 500 }
        );
      }
    }

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      return NextResponse.json(
        { error: `Sign out failed: ${signOutError.message}` },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set("gmail_provider_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    console.error("DISCONNECT: unexpected error", error);

    return NextResponse.json(
      { error: error?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}