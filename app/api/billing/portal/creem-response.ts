/**
 * Narrowing for Creem's billing-portal API response/error bodies. Kept in
 * a separate module (not route.ts) so it can be unit tested without
 * pulling in "server-only"-guarded imports that route.ts transitively
 * depends on.
 */

export function getReadableCreemError(data: unknown) {
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

export function getPortalUrl(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const value = data as Record<string, unknown>;

  const url =
    value.customer_portal_link ||
    value.customerPortalLink ||
    value.customer_portal_url ||
    value.customerPortalUrl ||
    value.url ||
    value.portal_url ||
    value.portalUrl ||
    value.billing_url ||
    value.billingUrl ||
    value.customer_portal_url ||
    value.link;

  return typeof url === "string" && url.trim() ? url.trim() : null;
}
