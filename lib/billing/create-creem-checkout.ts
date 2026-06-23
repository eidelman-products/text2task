import "server-only";

const DEFAULT_CREEM_API_BASE_URL = "https://api.creem.io/v1";
const CREEM_CHECKOUT_TIMEOUT_MS = 15000;

export type CreateCreemCheckoutInput = {
  userId: string;
  email: string;
  requestId: string;
  appUrl: string;
};

export type CreateCreemCheckoutResult =
  | {
      ok: true;
      checkoutUrl: string;
    }
  | {
      ok: false;
      errorCode:
        | "not_configured"
        | "provider_rejected"
        | "provider_unavailable"
        | "invalid_provider_response";
      failureKind: "definite" | "ambiguous";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getStringField(
  record: Record<string, unknown>,
  fieldNames: readonly string[]
) {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function isHttpsCheckoutUrl(
  value: string | null | undefined
): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);

    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function getCheckoutUrl(data: unknown) {
  if (!isRecord(data)) {
    return null;
  }

  return getStringField(data, [
    "checkout_url",
    "url",
    "checkoutUrl",
    "payment_url",
  ]);
}

function getAppOrigin(appUrl: string) {
  try {
    const url = new URL(appUrl);

    return url.origin;
  } catch {
    return appUrl.replace(/\/$/, "");
  }
}

export async function createCreemCheckout({
  userId,
  email,
  requestId,
  appUrl,
}: CreateCreemCheckoutInput): Promise<CreateCreemCheckoutResult> {
  const apiKey = process.env.CREEM_API_KEY?.trim();
  const productId = process.env.CREEM_PRODUCT_ID?.trim();
  const apiBaseUrl = (
    process.env.CREEM_API_BASE_URL || DEFAULT_CREEM_API_BASE_URL
  )
    .trim()
    .replace(/\/+$/, "");

  if (!apiKey || !productId) {
    return {
      ok: false,
      errorCode: "not_configured",
      failureKind: "definite",
    };
  }

  if (!productId.startsWith("prod_") || !apiBaseUrl.includes("api.creem.io")) {
    return {
      ok: false,
      errorCode: "not_configured",
      failureKind: "definite",
    };
  }

  const appOrigin = getAppOrigin(appUrl);
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => {
    controller.abort();
  }, CREEM_CHECKOUT_TIMEOUT_MS);

  try {
    const creemResponse = await fetch(`${apiBaseUrl}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        product_id: productId,
        request_id: requestId,
        units: 1,
        customer: {
          email,
        },
        metadata: {
          user_id: userId,
          email,
          product: "text2task_pro",
          plan: "pro",
        },
        success_url: `${appOrigin}/dashboard?checkout=success`,
      }),
      signal: controller.signal,
    });

    if (!creemResponse.ok) {
      if (
        creemResponse.status >= 500 ||
        creemResponse.status === 408 ||
        creemResponse.status === 429
      ) {
        return {
          ok: false,
          errorCode: "provider_unavailable",
          failureKind: "ambiguous",
        };
      }

      return {
        ok: false,
        errorCode: "provider_rejected",
        failureKind: "definite",
      };
    }

    const data = await creemResponse.json().catch(() => null);
    const checkoutUrl = getCheckoutUrl(data);

    if (!isHttpsCheckoutUrl(checkoutUrl)) {
      return {
        ok: false,
        errorCode: "invalid_provider_response",
        failureKind: "ambiguous",
      };
    }

    return {
      ok: true,
      checkoutUrl,
    };
  } catch {
    return {
      ok: false,
      errorCode: "provider_unavailable",
      failureKind: "ambiguous",
    };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
