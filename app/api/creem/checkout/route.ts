import { NextRequest, NextResponse } from "next/server";
import { SITE_ORIGIN } from "@/app/lib/site-config";
import { getOrCreateProCheckout } from "@/lib/billing/get-or-create-pro-checkout";
import { createClient } from "@/lib/supabase/server";

const PRODUCTION_APP_URL = SITE_ORIGIN;

function getAppUrl(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (origin && origin.includes("text2task.com")) {
    return origin.replace(/\/$/, "");
  }

  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    PRODUCTION_APP_URL;

  if (envUrl.includes("localhost")) {
    return PRODUCTION_APP_URL;
  }

  return envUrl.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getOrCreateProCheckout({
      user: {
        id: user.id,
        email: user.email,
      },
      appUrl: getAppUrl(req),
    });

    if (result.status === "checkout_ready") {
      return NextResponse.json({
        url: result.checkoutUrl,
        checkoutUrl: result.checkoutUrl,
      });
    }

    if (result.status === "already_pro") {
      return NextResponse.json({ error: "already_pro" }, { status: 409 });
    }

    if (result.status === "creation_in_progress") {
      return NextResponse.json(
        { error: "checkout_in_progress" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "checkout_unavailable" },
      { status: 503 }
    );
  } catch (error) {
    console.error("CREEM CHECKOUT ERROR:", error);

    return NextResponse.json(
      { error: "checkout_unavailable" },
      { status: 500 }
    );
  }
}
