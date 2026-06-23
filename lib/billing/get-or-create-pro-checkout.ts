import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createCreemCheckout,
  isHttpsCheckoutUrl,
} from "@/lib/billing/create-creem-checkout";
import {
  PRO_PURCHASE_INTENT_MAX_AGE_SECONDS,
  PRO_PURCHASE_INTENT_VALUE,
} from "@/lib/billing/pro-purchase-intent";

const PRO_CHECKOUT_LEASE_SECONDS = 120;
const ACTIVE_PRO_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "paid",
  "scheduled_cancel",
]);

type AuthenticatedCheckoutUser = {
  id: string;
  email: string;
};

type ClaimRow = {
  attemptId: string | null;
  creemRequestId: string | null;
  checkoutUrl: string | null;
  status: string | null;
  leaseToken: string | null;
  shouldCreateCheckout: boolean;
  expiresAt: string | null;
};

export type ProCheckoutResult =
  | { status: "checkout_ready"; checkoutUrl: string }
  | { status: "already_pro" }
  | { status: "creation_in_progress" }
  | { status: "checkout_unavailable" };

type GetOrCreateProCheckoutInput = {
  user: AuthenticatedCheckoutUser;
  appUrl: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getStringField(value: unknown, fieldName: string) {
  if (!isRecord(value)) return null;

  const fieldValue = value[fieldName];

  return typeof fieldValue === "string" && fieldValue.trim()
    ? fieldValue.trim()
    : null;
}

function getBooleanField(value: unknown, fieldName: string) {
  if (!isRecord(value)) return null;

  const fieldValue = value[fieldName];

  return typeof fieldValue === "boolean" ? fieldValue : null;
}

function normalizeClaimRow(value: unknown): ClaimRow | null {
  const row = Array.isArray(value) ? value[0] : value;

  if (!isRecord(row)) return null;

  const shouldCreateCheckout = getBooleanField(
    row,
    "should_create_checkout"
  );

  if (shouldCreateCheckout === null) return null;

  return {
    attemptId: getStringField(row, "attempt_id"),
    creemRequestId: getStringField(row, "creem_request_id"),
    checkoutUrl: getStringField(row, "checkout_url"),
    status: getStringField(row, "status"),
    leaseToken: getStringField(row, "lease_token"),
    shouldCreateCheckout,
    expiresAt: getStringField(row, "expires_at"),
  };
}

function getReadyOrInProgressResult(row: ClaimRow): ProCheckoutResult | null {
  if (
    row.status === "checkout_created" &&
    isHttpsCheckoutUrl(row.checkoutUrl)
  ) {
    return {
      status: "checkout_ready",
      checkoutUrl: row.checkoutUrl,
    };
  }

  if (row.status === "creating" && !row.checkoutUrl) {
    return {
      status: "creation_in_progress",
    };
  }

  return null;
}

async function isAlreadyPro(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,plan,subscription_status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Pro checkout subscription guard failed:", error);
    return null;
  }

  const plan = getStringField(data, "plan");
  const subscriptionStatus = getStringField(data, "subscription_status");

  return (
    plan === "pro" ||
    Boolean(
      subscriptionStatus &&
        ACTIVE_PRO_SUBSCRIPTION_STATUSES.has(subscriptionStatus)
    )
  );
}

async function claimBillingCheckoutAttempt(userId: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_billing_checkout_attempt",
    {
      p_user_id: userId,
      p_intent: PRO_PURCHASE_INTENT_VALUE,
      p_ttl_seconds: PRO_PURCHASE_INTENT_MAX_AGE_SECONDS,
      p_lease_seconds: PRO_CHECKOUT_LEASE_SECONDS,
    }
  );

  if (error) {
    console.error("Pro checkout claim failed:", error);
    return null;
  }

  return normalizeClaimRow(data);
}

async function completeBillingCheckoutCreation({
  attemptId,
  leaseToken,
  checkoutUrl,
}: {
  attemptId: string;
  leaseToken: string;
  checkoutUrl: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "complete_billing_checkout_creation",
    {
      p_attempt_id: attemptId,
      p_lease_token: leaseToken,
      p_checkout_url: checkoutUrl,
    }
  );

  if (error) {
    console.error("Pro checkout completion failed:", error);
    return false;
  }

  return data === true;
}

async function failBillingCheckoutCreation({
  attemptId,
  leaseToken,
  errorCode,
}: {
  attemptId: string;
  leaseToken: string;
  errorCode: string;
}) {
  const { error } = await supabaseAdmin.rpc("fail_billing_checkout_creation", {
    p_attempt_id: attemptId,
    p_lease_token: leaseToken,
    p_error_code: errorCode,
  });

  if (error) {
    console.error("Pro checkout failure marker failed:", error);
  }
}

export async function getOrCreateProCheckout({
  user,
  appUrl,
}: GetOrCreateProCheckoutInput): Promise<ProCheckoutResult> {
  const alreadyPro = await isAlreadyPro(user.id);

  if (alreadyPro === null) {
    return { status: "checkout_unavailable" };
  }

  if (alreadyPro) {
    return { status: "already_pro" };
  }

  const claim = await claimBillingCheckoutAttempt(user.id);

  if (!claim) {
    return { status: "checkout_unavailable" };
  }

  if (!claim.shouldCreateCheckout) {
    return (
      getReadyOrInProgressResult(claim) ?? {
        status: "checkout_unavailable",
      }
    );
  }

  if (!claim.attemptId || !claim.leaseToken || !claim.creemRequestId) {
    return { status: "checkout_unavailable" };
  }

  const creemResult = await createCreemCheckout({
    userId: user.id,
    email: user.email,
    requestId: claim.creemRequestId,
    appUrl,
  });

  if (!creemResult.ok) {
    if (creemResult.failureKind === "definite") {
      await failBillingCheckoutCreation({
        attemptId: claim.attemptId,
        leaseToken: claim.leaseToken,
        errorCode: creemResult.errorCode,
      });
    }

    return { status: "checkout_unavailable" };
  }

  const completed = await completeBillingCheckoutCreation({
    attemptId: claim.attemptId,
    leaseToken: claim.leaseToken,
    checkoutUrl: creemResult.checkoutUrl,
  });

  if (completed) {
    return {
      status: "checkout_ready",
      checkoutUrl: creemResult.checkoutUrl,
    };
  }

  const followUpClaim = await claimBillingCheckoutAttempt(user.id);

  if (!followUpClaim) {
    return { status: "checkout_unavailable" };
  }

  if (!followUpClaim.shouldCreateCheckout) {
    return (
      getReadyOrInProgressResult(followUpClaim) ?? {
        status: "checkout_unavailable",
      }
    );
  }

  return { status: "checkout_unavailable" };
}
