import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

function maskValue(value: string) {
  if (!value) return "missing";

  if (value.length <= 12) {
    return `${value.slice(0, 4)}...`;
  }

  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function getReadableCreemError(data: unknown) {
  if (!data || typeof data !== "object") {
    return "Creem checkout failed";
  }

  const value = data as Record<string, unknown>;

  if (Array.isArray(value.message)) {
    return value.message.join(", ");
  }

  if (typeof value.message === "string") return value.message;
  if (typeof value.error === "string") return value.error;
  if (typeof value.detail === "string") return value.detail;

  return "Creem checkout failed";
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.CREEM_API_KEY?.trim();

    const apiBaseUrl = (
      process.env.CREEM_API_BASE_URL || "https://api.creem.io/v1"
    ).trim();

    const productId = process.env.CREEM_PRODUCT_ID?.trim();

    const appUrl = getAppUrl(req);

    console.log("CREEM CHECKOUT CONFIG:", {
      apiBaseUrl,
      productIdPresent: Boolean(productId),
      productIdMasked: productId ? maskValue(productId) : "missing",
      productIdLength: productId?.length || 0,
      apiKeyPresent: Boolean(apiKey),
      apiKeyMasked: apiKey ? maskValue(apiKey) : "missing",
      appUrl,
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing CREEM_API_KEY in env" },
        { status: 500 }
      );
    }

    if (!productId) {
      return NextResponse.json(
        { error: "Missing CREEM_PRODUCT_ID in env" },
        { status: 500 }
      );
    }

    if (!productId.startsWith("prod_")) {
      return NextResponse.json(
        {
          error:
            "Invalid CREEM_PRODUCT_ID. It must start with prod_ and must not include CREEM_PRODUCT_ID=.",
          productIdMasked: maskValue(productId),
          productIdLength: productId.length,
        },
        { status: 500 }
      );
    }

    if (!apiBaseUrl.includes("api.creem.io")) {
      return NextResponse.json(
        { error: "Invalid CREEM_API_BASE_URL" },
        { status: 500 }
      );
    }

    const user = await getAuthenticatedUser();

    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestId = `${user.id}-${crypto.randomUUID()}`;

    const creemPayload = {
      product_id: productId,
      request_id: requestId,
      units: 1,
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
    };

    console.log("CREEM CHECKOUT PAYLOAD SAFE:", {
      product_id: maskValue(productId),
      request_id: requestId,
      customer_email: user.email,
      success_url: creemPayload.success_url,
    });

    const creemResponse = await fetch(`${apiBaseUrl}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(creemPayload),
    });

    const data = await creemResponse.json().catch(() => null);

    console.log("CREEM CHECKOUT STATUS:", creemResponse.status);
    console.log("CREEM CHECKOUT RESPONSE:", data);

    if (!creemResponse.ok) {
      return NextResponse.json(
        {
          error: getReadableCreemError(data),
          productIdMasked: maskValue(productId),
          productIdLength: productId.length,
          details: data,
        },
        { status: creemResponse.status }
      );
    }

    const checkoutUrl =
      data?.checkout_url ||
      data?.url ||
      data?.checkoutUrl ||
      data?.payment_url;

    if (!checkoutUrl || typeof checkoutUrl !== "string") {
      return NextResponse.json(
        {
          error: "Missing checkout URL from Creem",
          productIdMasked: maskValue(productId),
          productIdLength: productId.length,
          details: data,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error("CREEM CHECKOUT ERROR:", err);

    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}