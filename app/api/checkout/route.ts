import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type LemonCreateCheckoutResponse = {
  data?: {
    attributes?: {
      url?: string;
    };
  };
  errors?: Array<{
    detail?: string;
    title?: string;
  }>;
};

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id || !user?.email) {
      return NextResponse.json(
        { error: "You must be signed in to start checkout" },
        { status: 401 }
      );
    }

    const email = user.email;
    const userId = user.id;

    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
    const variantId = process.env.LEMON_SQUEEZY_VARIANT_ID;

    if (!apiKey || !storeId || !variantId) {
      return NextResponse.json(
        { error: "Missing Lemon environment variables" },
        { status: 500 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://www.inboxshaper.com";

    const redirectUrl = `${appUrl}/dashboard`;

    const lemonRes = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              email,
              custom: {
                user_id: userId,
              },
            },
            product_options: {
              redirect_url: redirectUrl,
            },
            checkout_options: {
              embed: false,
              media: true,
              logo: true,
              desc: true,
              discount: true,
              subscription_preview: true,
            },
          },
          relationships: {
            store: {
              data: {
                type: "stores",
                id: String(storeId),
              },
            },
            variant: {
              data: {
                type: "variants",
                id: String(variantId),
              },
            },
          },
        },
      }),
      cache: "no-store",
    });

    const lemonData =
      (await lemonRes.json().catch(() => null)) as LemonCreateCheckoutResponse | null;

    if (!lemonRes.ok) {
      const message =
        lemonData?.errors?.[0]?.detail ||
        lemonData?.errors?.[0]?.title ||
        "Failed to create checkout";

      return NextResponse.json({ error: message }, { status: lemonRes.status });
    }

    const checkoutUrl = lemonData?.data?.attributes?.url;

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Checkout URL was not returned by Lemon" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create checkout" },
      { status: 500 }
    );
  }
}