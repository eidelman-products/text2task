import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ plan: "free" }, { status: 200 });
    }

    const { data: dbUser, error: dbError } = await supabase
      .from("users")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (dbError) {
      console.error("billing/plan route db error:", dbError);
      return NextResponse.json({ plan: "free" }, { status: 200 });
    }

    return NextResponse.json(
      {
        plan: dbUser?.plan === "pro" ? "pro" : "free",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("billing/plan route unexpected error:", error);

    return NextResponse.json({ plan: "free" }, { status: 200 });
  }
}