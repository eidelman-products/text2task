import "server-only";

export const PRO_PURCHASE_INTENT_COOKIE_NAME = "t2t_purchase_intent" as const;
export const PRO_PURCHASE_INTENT_VALUE = "upgrade_pro" as const;
export const PRO_PURCHASE_INTENT_MAX_AGE_SECONDS = 1800 as const;

export function isProPurchaseIntent(
  value: string | null | undefined
): value is typeof PRO_PURCHASE_INTENT_VALUE {
  return value === PRO_PURCHASE_INTENT_VALUE;
}

export const proPurchaseIntentCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api",
  maxAge: PRO_PURCHASE_INTENT_MAX_AGE_SECONDS,
} as const;

export const clearProPurchaseIntentCookieOptions = {
  ...proPurchaseIntentCookieOptions,
  maxAge: 0,
} as const;
