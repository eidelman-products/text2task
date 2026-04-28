import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Safe to ignore when cookies cannot be written.
            }
          },
        },
      }
    );

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LOGOUT ERROR:", error);

    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}