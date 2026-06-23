export const DASHBOARD_DESTINATION = "/dashboard" as const;
export const PRO_CHECKOUT_CONTINUATION_DESTINATION =
  "/api/billing/continue" as const;
export const PASSWORD_RESET_DESTINATION = "/reset-password" as const;

function hasSafePathSyntax(destination: string) {
  if (!destination || destination.trim() !== destination) {
    return false;
  }

  if (
    !destination.startsWith("/") ||
    destination.startsWith("//") ||
    destination.includes("\\") ||
    destination.toLowerCase().includes("%5c")
  ) {
    return false;
  }

  try {
    const decodedDestination = decodeURIComponent(destination);

    return (
      decodedDestination.startsWith("/") &&
      !decodedDestination.startsWith("//") &&
      !decodedDestination.includes("\\")
    );
  } catch {
    return false;
  }
}

function isDashboardDestination(destination: string) {
  return (
    destination === DASHBOARD_DESTINATION ||
    destination.startsWith(`${DASHBOARD_DESTINATION}?`)
  );
}

export function isPasswordResetDestination(
  destination: string | null | undefined
) {
  if (!destination || !hasSafePathSyntax(destination)) {
    return false;
  }

  return (
    destination === PASSWORD_RESET_DESTINATION ||
    destination.startsWith(`${PASSWORD_RESET_DESTINATION}?`)
  );
}

export function getSafeDashboardDestination(
  destination: string | null | undefined
) {
  if (!destination || !hasSafePathSyntax(destination)) {
    return DASHBOARD_DESTINATION;
  }

  return isDashboardDestination(destination)
    ? destination
    : DASHBOARD_DESTINATION;
}

export function getSafePostAuthDestination(
  destination: string | null | undefined
) {
  if (!destination || !hasSafePathSyntax(destination)) {
    return DASHBOARD_DESTINATION;
  }

  if (
    destination === PRO_CHECKOUT_CONTINUATION_DESTINATION ||
    isDashboardDestination(destination)
  ) {
    return destination;
  }

  return DASHBOARD_DESTINATION;
}

export function getSafeEmailConfirmationDestination(
  destination: string | null | undefined
) {
  if (!destination || !hasSafePathSyntax(destination)) {
    return DASHBOARD_DESTINATION;
  }

  if (
    destination === PRO_CHECKOUT_CONTINUATION_DESTINATION ||
    isDashboardDestination(destination) ||
    isPasswordResetDestination(destination)
  ) {
    return destination;
  }

  return DASHBOARD_DESTINATION;
}

export function getDestinationForProPurchaseIntent(
  hasValidProPurchaseIntent: boolean
) {
  return hasValidProPurchaseIntent
    ? PRO_CHECKOUT_CONTINUATION_DESTINATION
    : DASHBOARD_DESTINATION;
}

export function buildEmailConfirmationRedirect(
  origin: string,
  destination: string
) {
  return `${origin}/auth/confirm?next=${getSafePostAuthDestination(
    destination
  )}`;
}
