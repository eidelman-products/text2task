import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getReadableCreemError(data: unknown) {
  if (!data || typeof data !== "object") {
    return "Failed to create billing portal";
  }

  const value = data as Record<string, unknown>;

  if (Array.isArray(value.message)) {
    return value.message.join(", ");
  }

  if (typeof value.message === "string") return value.message;
  if (typeof value.error === "string") return value.error;
  if (typeof value.detail === "string") return value.detail;

  return "Failed to create billing portal";
}

function getPortalUrl(data: any) {
  const url =
    data?.customer_portal_link ||
    data?.customerPortalLink ||
    data?.customer_portal_url ||
    data?.customerPortalUrl ||
    data?.url ||
    data?.portal_url ||
    data?.portalUrl ||
    data?.billing_url ||
    data?.billingUrl ||
    data?.customer_portal_url ||
    data?.link;

  return typeof url === "string" && url.trim() ? url.trim() : null;
}

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
              // Safe to ignore in route handlers where cookies may be read-only.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: appUser, error: appUserError } = await supabaseAdmin
      .from("users")
      .select(
        "id,email,plan,subscription_status,creem_customer_id"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (appUserError) {
      console.error("Billing portal user lookup error:", appUserError);
      return NextResponse.json(
        { error: "Failed to load billing account" },
        { status: 500 }
      );
    }

    if (!appUser) {
      return NextResponse.json(
        { error: "Billing account not found" },
        { status: 401 }
      );
    }

    const subscriptionStatus =
      typeof appUser.subscription_status === "string"
        ? appUser.subscription_status
        : null;
    const canManageBilling =
      appUser.plan === "pro" ||
      subscriptionStatus === "active" ||
      subscriptionStatus === "trialing" ||
      subscriptionStatus === "paid" ||
      subscriptionStatus === "scheduled_cancel";

    if (!canManageBilling) {
      return NextResponse.json(
        { error: "Billing portal is only available for active Pro accounts" },
        { status: 403 }
      );
    }

    if (!appUser.creem_customer_id) {
      return NextResponse.json(
        {
          error:
            "Billing portal is not available for this account yet. Please contact billing support.",
        },
        { status: 409 }
      );
    }

    const apiKey = process.env.CREEM_API_KEY?.trim();
    const rawApiBaseUrl = (
      process.env.CREEM_API_BASE_URL || "https://api.creem.io"
    )
      .trim()
      .replace(/\/$/, "");
    const apiBaseUrl = rawApiBaseUrl.endsWith("/v1")
      ? rawApiBaseUrl.slice(0, -3)
      : rawApiBaseUrl;

    if (!apiKey) {
      console.error("Missing CREEM_API_KEY for billing portal");
      return NextResponse.json(
        { error: "Billing portal is not configured" },
        { status: 500 }
      );
    }

    const creemResponse = await fetch(
      `${apiBaseUrl}/v1/customers/billing`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          customer_id: appUser.creem_customer_id,
        }),
      }
    );

    const data = await creemResponse.json().catch(() => null);

    if (!creemResponse.ok) {
      console.error("CREEM BILLING PORTAL ERROR:", {
        status: creemResponse.status,
        details: data,
      });

      return NextResponse.json(
        { error: getReadableCreemError(data) },
        { status: creemResponse.status }
      );
    }

    const url = getPortalUrl(data);

    if (!url) {
      console.error("CREEM BILLING PORTAL MISSING URL:", data);

      return NextResponse.json(
        { error: "Missing billing portal URL from Creem" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("BILLING PORTAL ERROR:", error);

    return NextResponse.json(
      { error: "Failed to open billing portal" },
      { status: 500 }
    );
  }
}
