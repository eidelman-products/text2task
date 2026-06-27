import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type JsonRecord = Record<string, unknown>;

type WebhookAction =
  | "ignore"
  | "sync_checkout"
  | "sync_subscription"
  | "grant_pro"
  | "trial_pro"
  | "past_due"
  | "scheduled_cancel"
  | "downgrade_free"
  | "refund_downgrade"
  | "dispute_downgrade"
  | "pending_review";

type CreemWebhookReasonCode =
  | "creem_webhook_processed"
  | "creem_webhook_checkout_synced"
  | "creem_webhook_duplicate"
  | "creem_webhook_stale"
  | "creem_webhook_ignored_unsupported"
  | "creem_webhook_ignored_product"
  | "creem_webhook_pending_review"
  | "creem_webhook_db_failed";

type NormalizedCreemWebhook = {
  providerEventId: string;
  eventType: string;
  providerEventCreatedAt: string;
  providerStateUpdatedAt: string;
  objectId: string | null;
  checkoutId: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  productId: string | null;
  environment: string | null;
  creemRequestId: string | null;
  internalUserId: string | null;
  action: WebhookAction;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  refundAmount: string | null;
  amountPaid: string | null;
  refundedAmount: string | null;
  refundCurrency: string | null;
  transactionCurrency: string | null;
  reasonCode: CreemWebhookReasonCode;
};

type CreemWebhookRpcResult = {
  processingStatus: string;
  reasonCode: string;
};

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
const MAX_PROVIDER_ID_LENGTH = 180;
const MAX_EVENT_TYPE_LENGTH = 120;
const MAX_PROVIDER_FIELD_LENGTH = 240;
const MAX_NUMERIC_LENGTH = 48;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const SUCCESSFUL_REFUND_STATUSES: ReadonlySet<string> = new Set([
  "succeeded",
  "success",
  "completed",
  "paid",
]);
const SUPPORTED_EVENT_TYPES: ReadonlySet<string> = new Set([
  "checkout.completed",
  "subscription.active",
  "subscription.paid",
  "subscription.trialing",
  "subscription.update",
  "subscription.scheduled_cancel",
  "subscription.canceled",
  "subscription.expired",
  "subscription.past_due",
  "subscription.paused",
  "refund.created",
  "dispute.created",
] as const);

function verifyCreemSignature(
  payload: string,
  signature: string,
  secret: string
) {
  const normalizedSignature = signature.trim();

  if (!HEX_SHA256_PATTERN.test(normalizedSignature)) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(normalizedSignature, "hex")
  );
}

function jsonResponse(body: JsonRecord, status: number) {
  return NextResponse.json(body, { status });
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getRecordField(record: JsonRecord | null, fieldName: string) {
  if (!record) return null;
  return isRecord(record[fieldName]) ? record[fieldName] : null;
}

function getBoundedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;

  return trimmed;
}

function firstBoundedString(maxLength: number, ...values: unknown[]) {
  for (const value of values) {
    const text = getBoundedString(value, maxLength);
    if (text) return text;
  }

  return null;
}

function getObjectId(value: unknown) {
  const directId = getBoundedString(value, MAX_PROVIDER_FIELD_LENGTH);
  if (directId) return directId;

  const record = isRecord(value) ? value : null;
  return firstBoundedString(MAX_PROVIDER_FIELD_LENGTH, record?.id);
}

function getWebhookObject(payload: JsonRecord) {
  return getRecordField(payload, "object");
}

function getEventType(payload: JsonRecord) {
  return firstBoundedString(MAX_EVENT_TYPE_LENGTH, payload.eventType);
}

function parseTimestamp(value: unknown) {
  let date: Date | null = null;

  if (typeof value === "number" && Number.isFinite(value)) {
    date = new Date(value > 1_000_000_000_000 ? value : value * 1000);
  } else if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const numericValue = Number(trimmed);

    if (/^\d+(\.\d+)?$/.test(trimmed) && Number.isFinite(numericValue)) {
      date = new Date(
        numericValue > 1_000_000_000_000
          ? numericValue
          : numericValue * 1000
      );
    } else {
      date = new Date(trimmed);
    }
  }

  if (!date || Number.isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  if (year < 2020 || year > 2100) return null;

  return date.toISOString();
}

function getProviderCreatedAt(payload: JsonRecord) {
  return parseTimestamp(payload.created_at);
}

function getProviderStateUpdatedAt(
  payload: JsonRecord,
  object: JsonRecord,
  eventType: string
) {
  if (
    eventType.startsWith("subscription.") ||
    eventType === "refund.created" ||
    eventType === "dispute.created"
  ) {
    return parseTimestamp(object.updated_at) ?? parseTimestamp(payload.created_at);
  }

  return parseTimestamp(payload.created_at);
}

function parseOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return null;
}

function firstBoolean(...values: unknown[]) {
  for (const value of values) {
    const parsed = parseOptionalBoolean(value);
    if (parsed !== null) return parsed;
  }

  return null;
}

function firstRecord(...values: unknown[]) {
  for (const value of values) {
    if (isRecord(value)) return value;
  }

  return null;
}

function getCheckoutObject(object: JsonRecord) {
  return getRecordField(object, "checkout");
}

function getSubscriptionObject(object: JsonRecord) {
  return getRecordField(object, "subscription");
}

function getObjectMetadata(object: JsonRecord): JsonRecord {
  return firstRecord(object.metadata) ?? {};
}

function getCheckoutMetadata(object: JsonRecord): JsonRecord {
  return firstRecord(getCheckoutObject(object)?.metadata) ?? {};
}

function getCustomerId(object: JsonRecord) {
  const checkout = getCheckoutObject(object);
  const subscription = getSubscriptionObject(object);
  const transaction = getRecordField(object, "transaction");

  return firstBoundedString(
    MAX_PROVIDER_FIELD_LENGTH,
    getObjectId(object.customer),
    getObjectId(checkout?.customer),
    getObjectId(subscription?.customer),
    getObjectId(transaction?.customer)
  );
}

function getSubscriptionId(object: JsonRecord, eventType: string) {
  const transaction = getRecordField(object, "transaction");

  if (eventType.startsWith("subscription.")) {
    return firstBoundedString(MAX_PROVIDER_FIELD_LENGTH, object.id);
  }

  if (eventType === "checkout.completed") {
    return firstBoundedString(
      MAX_PROVIDER_FIELD_LENGTH,
      getObjectId(object.subscription)
    );
  }

  if (eventType === "refund.created" || eventType === "dispute.created") {
    return firstBoundedString(
      MAX_PROVIDER_FIELD_LENGTH,
      getObjectId(object.subscription),
      getObjectId(transaction?.subscription)
    );
  }

  return null;
}

function getProductId(object: JsonRecord, eventType: string) {
  const product = getRecordField(object, "product");
  const order = getRecordField(object, "order");
  const subscription = getSubscriptionObject(object);
  const transaction = getRecordField(object, "transaction");
  const transactionSubscription = getRecordField(transaction, "subscription");

  if (eventType === "checkout.completed") {
    return firstBoundedString(
      MAX_PROVIDER_FIELD_LENGTH,
      getObjectId(product),
      getObjectId(order?.product)
    );
  }

  if (eventType.startsWith("subscription.")) {
    return firstBoundedString(MAX_PROVIDER_FIELD_LENGTH, getObjectId(product));
  }

  if (eventType === "refund.created" || eventType === "dispute.created") {
    return firstBoundedString(
      MAX_PROVIDER_FIELD_LENGTH,
      getObjectId(subscription?.product),
      getObjectId(transactionSubscription?.product),
      getObjectId(order?.product),
      getObjectId(product)
    );
  }

  return null;
}

function getEnvironment(payload: JsonRecord, object: JsonRecord) {
  const checkout = getCheckoutObject(object);
  const subscription = getSubscriptionObject(object);

  const explicitMode = firstBoundedString(
    80,
    payload.mode,
    payload.environment,
    object.mode,
    object.environment,
    checkout?.mode,
    checkout?.environment,
    subscription?.mode,
    subscription?.environment
  );

  if (explicitMode) return explicitMode;

  const testMode = firstBoolean(
    payload.test_mode,
    object.test_mode,
    checkout?.test_mode,
    subscription?.test_mode
  );

  return testMode === null ? null : testMode ? "test" : "live";
}

function getCreemRequestId(object: JsonRecord, eventType: string) {
  const checkout = getCheckoutObject(object);

  if (eventType === "checkout.completed") {
    return firstBoundedString(MAX_PROVIDER_FIELD_LENGTH, object.request_id);
  }

  if (
    eventType.startsWith("subscription.") ||
    eventType === "refund.created" ||
    eventType === "dispute.created"
  ) {
    return firstBoundedString(MAX_PROVIDER_FIELD_LENGTH, checkout?.request_id);
  }

  return null;
}

function getInternalUserId(object: JsonRecord, eventType: string) {
  const metadata =
    eventType === "refund.created" || eventType === "dispute.created"
      ? getCheckoutMetadata(object)
      : getObjectMetadata(object);
  const candidate = firstBoundedString(80, metadata.user_id);

  return candidate && UUID_PATTERN.test(candidate) ? candidate : null;
}

function getCurrentPeriodEnd(object: JsonRecord) {
  const subscription = getSubscriptionObject(object);

  return (
    parseTimestamp(object.current_period_end_date) ??
    parseTimestamp(subscription?.current_period_end_date)
  );
}

function getCurrentPeriodStart(object: JsonRecord) {
  const subscription = getSubscriptionObject(object);

  return (
    parseTimestamp(object.current_period_start_date) ??
    parseTimestamp(subscription?.current_period_start_date)
  );
}

function getCancelAtPeriodEnd(object: JsonRecord) {
  const subscription = getSubscriptionObject(object);

  return firstBoolean(
    object.cancel_at_period_end,
    subscription?.cancel_at_period_end
  );
}

function getNumericString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    const text = String(value);
    return text.length <= MAX_NUMERIC_LENGTH ? text : null;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_NUMERIC_LENGTH ||
    !/^\d+(\.\d+)?$/.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
}

function decimalParts(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return { whole, fraction };
}

function compareNonNegativeDecimals(left: string, right: string) {
  const leftParts = decimalParts(left);
  const rightParts = decimalParts(right);
  const scale = Math.max(leftParts.fraction.length, rightParts.fraction.length);
  const leftInteger = BigInt(
    `${leftParts.whole}${leftParts.fraction.padEnd(scale, "0")}`
  );
  const rightInteger = BigInt(
    `${rightParts.whole}${rightParts.fraction.padEnd(scale, "0")}`
  );

  if (leftInteger < rightInteger) return -1;
  if (leftInteger > rightInteger) return 1;
  return 0;
}

function getCurrency(value: unknown) {
  const currency = getBoundedString(value, 12);
  return currency ? currency.toUpperCase() : null;
}

function getRefundEvidence(object: JsonRecord) {
  const transaction = getRecordField(object, "transaction");

  return {
    refundAmount: getNumericString(object.refund_amount),
    amountPaid: getNumericString(transaction?.amount_paid),
    refundedAmount: getNumericString(transaction?.refunded_amount),
    refundCurrency: getCurrency(object.currency),
    transactionCurrency: getCurrency(transaction?.currency),
  };
}

function isSuccessfulFullRefund(object: JsonRecord) {
  const status = firstBoundedString(80, object.status)?.toLowerCase();
  const evidence = getRefundEvidence(object);

  if (!status || !SUCCESSFUL_REFUND_STATUSES.has(status)) return false;
  if (!evidence.amountPaid || !evidence.refundedAmount) return false;

  if (
    evidence.refundCurrency &&
    evidence.transactionCurrency &&
    evidence.refundCurrency !== evidence.transactionCurrency
  ) {
    return false;
  }

  return (
    compareNonNegativeDecimals(
      evidence.refundedAmount,
      evidence.amountPaid
    ) >= 0
  );
}

function getObjectIdentifier(object: JsonRecord) {
  return firstBoundedString(
    MAX_PROVIDER_FIELD_LENGTH,
    object.id,
    getCheckoutObject(object)?.id,
    getSubscriptionObject(object)?.id
  );
}

function getActionForEventType(eventType: string): {
  action: WebhookAction;
  subscriptionStatus: string | null;
  reasonCode: CreemWebhookReasonCode;
} {
  switch (eventType) {
    case "checkout.completed":
      return {
        action: "sync_checkout",
        subscriptionStatus: null,
        reasonCode: "creem_webhook_checkout_synced",
      };
    case "subscription.active":
      return {
        action: "sync_subscription",
        subscriptionStatus: "active",
        reasonCode: "creem_webhook_processed",
      };
    case "subscription.paid":
      return {
        action: "grant_pro",
        subscriptionStatus: "paid",
        reasonCode: "creem_webhook_processed",
      };
    case "subscription.trialing":
      return {
        action: "trial_pro",
        subscriptionStatus: "trialing",
        reasonCode: "creem_webhook_processed",
      };
    case "subscription.update":
      return {
        action: "sync_subscription",
        subscriptionStatus: null,
        reasonCode: "creem_webhook_processed",
      };
    case "subscription.scheduled_cancel":
      return {
        action: "scheduled_cancel",
        subscriptionStatus: "scheduled_cancel",
        reasonCode: "creem_webhook_processed",
      };
    case "subscription.past_due":
      return {
        action: "past_due",
        subscriptionStatus: "past_due",
        reasonCode: "creem_webhook_processed",
      };
    case "subscription.canceled":
    case "subscription.expired":
    case "subscription.paused":
      return {
        action: "downgrade_free",
        subscriptionStatus: eventType.replace("subscription.", ""),
        reasonCode: "creem_webhook_processed",
      };
    case "refund.created":
      return {
        action: "pending_review",
        subscriptionStatus: "refund_pending_review",
        reasonCode: "creem_webhook_pending_review",
      };
    case "dispute.created":
      return {
        action: "dispute_downgrade",
        subscriptionStatus: "disputed",
        reasonCode: "creem_webhook_processed",
      };
    default:
      return {
        action: "ignore",
        subscriptionStatus: null,
        reasonCode: "creem_webhook_ignored_unsupported",
      };
  }
}

function getNormalizedSubscriptionStatus(
  object: JsonRecord,
  eventType: string,
  action: WebhookAction,
  fallbackStatus: string | null
) {
  if (action === "refund_downgrade") return "refunded";
  if (action === "dispute_downgrade") return "disputed";

  if (eventType === "subscription.update") {
    return firstBoundedString(80, object.status) ?? fallbackStatus;
  }

  return fallbackStatus;
}

function malformedWebhook(message: string) {
  return { ok: false as const, message };
}

function normalizeCreemWebhook(
  payload: unknown,
  expectedProductId: string
):
  | { ok: true; webhook: NormalizedCreemWebhook }
  | { ok: false; message: string } {
  if (!isRecord(payload)) {
    return malformedWebhook("Payload must be a JSON object");
  }

  const providerEventId = firstBoundedString(
    MAX_PROVIDER_ID_LENGTH,
    payload.id
  );
  const eventType = getEventType(payload);
  const providerEventCreatedAt = getProviderCreatedAt(payload);

  if (!providerEventId) {
    return malformedWebhook("Provider event id is missing or invalid");
  }
  if (!eventType) {
    return malformedWebhook("Event type is missing or invalid");
  }
  if (!providerEventCreatedAt) {
    return malformedWebhook("Provider event timestamp is missing or invalid");
  }

  const object = getWebhookObject(payload);

  if (!SUPPORTED_EVENT_TYPES.has(eventType)) {
    return {
      ok: true,
      webhook: {
        providerEventId,
        eventType,
        providerEventCreatedAt,
        providerStateUpdatedAt: providerEventCreatedAt,
        objectId: object ? getObjectIdentifier(object) : null,
        checkoutId: null,
        subscriptionId: null,
        customerId: object ? getCustomerId(object) : null,
        productId: null,
        environment: object ? getEnvironment(payload, object) : null,
        creemRequestId: null,
        internalUserId: null,
        action: "ignore",
        subscriptionStatus: null,
        cancelAtPeriodEnd: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        refundAmount: null,
        amountPaid: null,
        refundedAmount: null,
        refundCurrency: null,
        transactionCurrency: null,
        reasonCode: "creem_webhook_ignored_unsupported",
      },
    };
  }

  if (!object) {
    return malformedWebhook("Payload object is missing");
  }

  const actionForEvent = getActionForEventType(eventType);
  const productId = getProductId(object, eventType);
  const providerStateUpdatedAt =
    getProviderStateUpdatedAt(payload, object, eventType) ??
    providerEventCreatedAt;
  const refundEvidence = getRefundEvidence(object);
  let finalAction = actionForEvent.action;
  let reasonCode = actionForEvent.reasonCode;

  if (!productId || productId !== expectedProductId) {
    finalAction = "ignore";
    reasonCode = "creem_webhook_ignored_product";
  } else if (eventType === "refund.created") {
    if (isSuccessfulFullRefund(object)) {
      finalAction = "refund_downgrade";
      reasonCode = "creem_webhook_processed";
    } else {
      finalAction = "pending_review";
      reasonCode = "creem_webhook_pending_review";
    }
  }

  return {
    ok: true,
    webhook: {
      providerEventId,
      eventType,
      providerEventCreatedAt,
      providerStateUpdatedAt,
      objectId: getObjectIdentifier(object),
      checkoutId:
        eventType === "checkout.completed"
          ? getObjectIdentifier(object)
          : firstBoundedString(
              MAX_PROVIDER_FIELD_LENGTH,
              getCheckoutObject(object)?.id
            ),
      subscriptionId: getSubscriptionId(object, eventType),
      customerId: getCustomerId(object),
      productId,
      environment: getEnvironment(payload, object),
      creemRequestId: getCreemRequestId(object, eventType),
      internalUserId: getInternalUserId(object, eventType),
      action: finalAction,
      subscriptionStatus: getNormalizedSubscriptionStatus(
        object,
        eventType,
        finalAction,
        actionForEvent.subscriptionStatus
      ),
      cancelAtPeriodEnd: getCancelAtPeriodEnd(object),
      currentPeriodStart: getCurrentPeriodStart(object),
      currentPeriodEnd: getCurrentPeriodEnd(object),
      refundAmount: refundEvidence.refundAmount,
      amountPaid: refundEvidence.amountPaid,
      refundedAmount: refundEvidence.refundedAmount,
      refundCurrency: refundEvidence.refundCurrency,
      transactionCurrency: refundEvidence.transactionCurrency,
      reasonCode,
    },
  };
}

function normalizeRpcResult(data: unknown): CreemWebhookRpcResult | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRecord(row)) return null;

  const processingStatus = firstBoundedString(
    80,
    row.result_processing_status,
    row.processing_status
  );
  const reasonCode = firstBoundedString(
    120,
    row.result_reason_code,
    row.reason_code
  );

  if (!processingStatus || !reasonCode) return null;

  return { processingStatus, reasonCode };
}

function logWebhookResult({
  eventType,
  processingStatus,
  reasonCode,
}: {
  eventType: string;
  processingStatus: string;
  reasonCode: string;
}) {
  const payload = { eventType, processingStatus, reasonCode };

  if (reasonCode === "creem_webhook_db_failed") {
    console.error("Creem webhook processing failed:", payload);
    return;
  }

  console.info("Creem webhook processed:", payload);
}

async function processWebhook(webhook: NormalizedCreemWebhook) {
  const { data, error } = await supabaseAdmin.rpc(
    "process_creem_webhook_event",
    {
      p_provider_event_id: webhook.providerEventId,
      p_event_type: webhook.eventType,
      p_provider_event_created_at: webhook.providerEventCreatedAt,
      p_provider_state_updated_at: webhook.providerStateUpdatedAt,
      p_object_id: webhook.objectId,
      p_checkout_id: webhook.checkoutId,
      p_subscription_id: webhook.subscriptionId,
      p_customer_id: webhook.customerId,
      p_product_id: webhook.productId,
      p_environment: webhook.environment,
      p_creem_request_id: webhook.creemRequestId,
      p_internal_user_id_candidate: webhook.internalUserId,
      p_action: webhook.action,
      p_subscription_status: webhook.subscriptionStatus,
      p_cancel_at_period_end: webhook.cancelAtPeriodEnd,
      p_current_period_start: webhook.currentPeriodStart,
      p_current_period_end: webhook.currentPeriodEnd,
      p_refund_amount: webhook.refundAmount,
      p_amount_paid: webhook.amountPaid,
      p_refunded_amount: webhook.refundedAmount,
      p_refund_currency: webhook.refundCurrency,
      p_transaction_currency: webhook.transactionCurrency,
      p_reason_code: webhook.reasonCode,
    }
  );

  if (error) {
    console.error("Creem webhook database failure:", {
      eventType: webhook.eventType,
      reasonCode: "creem_webhook_db_failed",
      errorCode: error.code,
    });
    return null;
  }

  return normalizeRpcResult(data);
}

export async function POST(req: NextRequest) {
  const declaredLength = req.headers.get("content-length");

  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (
      Number.isFinite(parsedLength) &&
      parsedLength > MAX_WEBHOOK_BODY_BYTES
    ) {
      return jsonResponse({ error: "Webhook payload is too large" }, 413);
    }
  }

  const webhookSecret = process.env.CREEM_WEBHOOK_SECRET?.trim();
  const expectedProductId = process.env.CREEM_PRODUCT_ID?.trim();

  if (!webhookSecret || !expectedProductId) {
    console.error("Creem webhook configuration failure:", {
      reasonCode: "creem_webhook_db_failed",
      configuration: "missing_required_configuration",
    });
    return jsonResponse({ error: "Failed to process Creem webhook" }, 500);
  }

  const signature = req.headers.get("creem-signature");
  if (!signature) {
    return jsonResponse({ error: "Missing Creem signature" }, 401);
  }

  const rawBody = await req.text();

  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
    return jsonResponse({ error: "Webhook payload is too large" }, 413);
  }

  if (!verifyCreemSignature(rawBody, signature, webhookSecret)) {
    return jsonResponse({ error: "Invalid Creem signature" }, 401);
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Malformed Creem webhook" }, 400);
  }

  const normalized = normalizeCreemWebhook(
    parsedPayload,
    expectedProductId
  );

  if (!normalized.ok) {
    return jsonResponse({ error: "Malformed Creem webhook" }, 400);
  }

  try {
    const result = await processWebhook(normalized.webhook);

    if (!result) {
      return jsonResponse({ error: "Failed to process Creem webhook" }, 500);
    }

    logWebhookResult({
      eventType: normalized.webhook.eventType,
      processingStatus: result.processingStatus,
      reasonCode: result.reasonCode,
    });

    if (
      result.processingStatus === "pending_unmatched" ||
      result.processingStatus === "pending_conflict" ||
      result.processingStatus === "failed_retryable"
    ) {
      return jsonResponse({ error: "Failed to process Creem webhook" }, 503);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Creem webhook unexpected failure:", {
      eventType: normalized.webhook.eventType,
      reasonCode: "creem_webhook_db_failed",
      errorName: error instanceof Error ? error.name : typeof error,
    });

    return jsonResponse({ error: "Failed to process Creem webhook" }, 500);
  }
}
