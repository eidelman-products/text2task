import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const CREEM_PRODUCT_ID = "prod_5yqlBNrglVmQtKeaaJ5DzX";
const PRODUCTION_APP_URL = "https://text2task.com";

async function getAuthenticatedUser() {
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
            // Safe to ignore in route handlers where cookies may be read-only.
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  return user;
}

function getAppUrl(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (origin && origin.includes("text2task.com")) {
    return origin;
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
    const apiKey = process.env.CREEM_API_KEY;
    const apiBaseUrl =
      process.env.CREEM_API_BASE_URL || "https://test-api.creem.io/v1";
    const appUrl = getAppUrl(req);

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing CREEM_API_KEY in env" },
        { status: 500 }
      );
    }

    const user = await getAuthenticatedUser();

    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await fetch(`${apiBaseUrl}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        product_id: CREEM_PRODUCT_ID,
        request_id: user.id,
        customer: {
          email: user.email,
        },
        metadata: {
          user_id: user.id,
          email: user.email,
          product: "text2task_pro",
          plan: "pro",
        },
        success_url: `${appUrl}/dashboard?checkout=success`,
      }),
    });

    const data = await res.json();

    console.log("CREEM CHECKOUT RESPONSE:", data);

    if (!res.ok) {
      return NextResponse.json({ error: data }, { status: res.status });
    }

    const checkoutUrl = data.checkout_url || data.url;

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Missing checkout URL from Creem" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error("CREEM CHECKOUT ERROR:", err);

    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}