import { isOwnerEmail } from "@/lib/auth/owner.server";
import type {
  AuthenticatedActivitySummaryForMerge,
  AuthUserSummary,
  OwnerActivityReport,
  OwnerUserActivityRow,
} from "./owner-user-activity-types";

export function latestOf(...values: Array<string | null>): string | null {
  let latest: string | null = null;
  let latestTimestamp = -Infinity;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const timestamp = new Date(value).getTime();

    if (Number.isFinite(timestamp) && timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latest = value;
    }
  }

  return latest;
}

export function getOwnerActivityUserIds(
  authUsers: AuthUserSummary[] | null,
  activityReport: OwnerActivityReport | null
) {
  const ids = new Set<string>();

  for (const user of authUsers ?? []) {
    ids.add(user.id);
  }

  for (const row of activityReport?.rows ?? []) {
    ids.add(row.id);
  }

  return Array.from(ids);
}

export function mergeUserActivity(
  authUsers: AuthUserSummary[] | null,
  activityReport: OwnerActivityReport | null,
  authenticatedActivity: AuthenticatedActivitySummaryForMerge[] = []
): OwnerUserActivityRow[] {
  const profileById = new Map(
    (activityReport?.rows ?? []).map((row) => [row.id, row])
  );
  const authById = new Map((authUsers ?? []).map((user) => [user.id, user]));
  const authenticatedById = new Map(
    authenticatedActivity.map((row) => [row.userId, row])
  );
  const allIds = new Set<string>([
    ...profileById.keys(),
    ...authById.keys(),
    ...authenticatedById.keys(),
  ]);

  const merged: OwnerUserActivityRow[] = [];

  for (const id of allIds) {
    const authUser = authById.get(id) ?? null;
    const profile = profileById.get(id) ?? null;
    const authenticated = authenticatedById.get(id) ?? null;

    const lastExtractAt = profile?.lastExtractAt ?? null;
    const lastDashboardSeenAt = profile?.lastDashboardSeenAt ?? null;
    const lastProjectAt = profile?.lastProjectAt ?? null;
    const lastSignInAt = authUser?.lastSignInAt ?? null;
    const authenticatedLastSeenAt = authenticated?.lastSeenAt ?? null;

    merged.push({
      id,
      email: authUser?.email ?? null,
      signupAt: authUser?.createdAt ?? profile?.profileCreatedAt ?? null,
      emailConfirmedAt: authUser?.emailConfirmedAt ?? null,
      provider: authUser?.provider ?? null,
      lastSignInAt,
      hasProfile: profile !== null,
      plan: profile?.plan ?? null,
      subscriptionStatus: profile?.subscriptionStatus ?? null,
      extractCount: profile?.extractCount ?? null,
      successfulExtractCount: profile?.successfulExtractCount ?? 0,
      lastExtractAt,
      lastDashboardSeenAt,
      projectCount: profile?.projectCount ?? 0,
      lastProjectAt,
      authenticatedLastSeenAt,
      authenticatedLastViewedRoute: authenticated?.lastViewedRoute ?? null,
      authenticatedLastEventName: authenticated?.lastEventName ?? null,
      totalAuthenticatedViews: authenticated?.totalAuthenticatedViews ?? 0,
      authenticatedActiveDays: authenticated?.distinctActiveDays ?? 0,
      isAuthenticatedReturningUser: authenticated?.isReturning ?? false,
      lastActivityAt: latestOf(
        lastSignInAt,
        lastDashboardSeenAt,
        lastExtractAt,
        lastProjectAt,
        authenticatedLastSeenAt
      ),
      isOwnerOrTest: isOwnerEmail(authUser?.email ?? null),
    });
  }

  merged.sort((a, b) => {
    const aTime = a.lastActivityAt
      ? new Date(a.lastActivityAt).getTime()
      : -Infinity;
    const bTime = b.lastActivityAt
      ? new Date(b.lastActivityAt).getTime()
      : -Infinity;

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    const aLabel = a.email ?? a.id;
    const bLabel = b.email ?? b.id;

    return aLabel.localeCompare(bLabel);
  });

  return merged;
}
