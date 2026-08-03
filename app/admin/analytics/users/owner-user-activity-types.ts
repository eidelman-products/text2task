import type { ProductEventName } from "@/lib/activity/product-event-contracts";

export type OwnerUserActivityRow = {
  id: string;
  email: string | null;
  signupAt: string | null;
  emailConfirmedAt: string | null;
  provider: string | null;
  lastSignInAt: string | null;
  hasProfile: boolean;
  plan: string | null;
  subscriptionStatus: string | null;
  extractCount: number | null;
  successfulExtractCount: number;
  lastExtractAt: string | null;
  lastDashboardSeenAt: string | null;
  projectCount: number;
  lastProjectAt: string | null;
  authenticatedLastSeenAt: string | null;
  authenticatedLastViewedRoute: string | null;
  authenticatedLastEventName: ProductEventName | null;
  totalAuthenticatedViews: number;
  authenticatedActiveDays: number;
  isAuthenticatedReturningUser: boolean;
  lastActivityAt: string | null;
  isOwnerOrTest: boolean;
};

export type OwnerActivityProfileRow = {
  id: string;
  plan: string | null;
  subscriptionStatus: string | null;
  extractCount: number | null;
  successfulExtractCount: number;
  lastExtractAt: string | null;
  lastDashboardSeenAt: string | null;
  profileCreatedAt: string | null;
  projectCount: number;
  firstProjectAt: string | null;
  lastProjectAt: string | null;
};

export type OwnerActivityReport = {
  totalProfiles: number;
  rows: OwnerActivityProfileRow[];
};

export type AuthUserSummary = {
  id: string;
  email: string | null;
  createdAt: string | null;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  provider: string | null;
};

export type AuthenticatedActivitySummaryForMerge = {
  userId: string;
  lastSeenAt: string | null;
  lastViewedRoute: string | null;
  lastEventName: ProductEventName | null;
  totalAuthenticatedViews: number;
  distinctActiveDays: number;
  isReturning: boolean;
};
