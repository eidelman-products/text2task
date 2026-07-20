import Link from "next/link";

import { isOwnerEmail, requireOwner } from "@/lib/auth/owner.server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import UserActivityTable, {
  type OwnerUserActivityRow,
} from "./user-activity-table.client";

const REPORT_ROW_LIMIT = 2000;
const AUTH_USERS_PAGE_SIZE = 1000;
const AUTH_USERS_MAX_PAGES = 5; // safety cap: up to 5,000 auth accounts

type OwnerActivityProfileRow = {
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

type OwnerActivityReport = {
  totalProfiles: number;
  rows: OwnerActivityProfileRow[];
};

type AuthUserSummary = {
  id: string;
  email: string | null;
  createdAt: string | null;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  provider: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseTimestamp(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? value : null;
}

function readNullableTimestamp(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  return parseTimestamp(value);
}

function readNullableString(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && value.trim() ? value : null;
}

function readNonNegativeInteger(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readUuid(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function parseOwnerActivityReport(value: unknown): OwnerActivityReport | null {
  if (!isRecord(value)) {
    return null;
  }

  const totalProfiles = readNonNegativeInteger(value, "total_profiles");

  if (totalProfiles === null || !Array.isArray(value.rows)) {
    return null;
  }

  const rows: OwnerActivityProfileRow[] = [];

  for (const item of value.rows) {
    if (!isRecord(item)) {
      return null;
    }

    const id = readUuid(item, "id");
    const successfulExtractCount = readNonNegativeInteger(
      item,
      "successful_extract_count"
    );
    const projectCount = readNonNegativeInteger(item, "project_count");

    if (id === null || successfulExtractCount === null || projectCount === null) {
      return null;
    }

    rows.push({
      id,
      plan: readNullableString(item, "plan"),
      subscriptionStatus: readNullableString(item, "subscription_status"),
      extractCount: readNonNegativeInteger(item, "extract_count"),
      successfulExtractCount,
      lastExtractAt: readNullableTimestamp(item, "last_extract_at"),
      lastDashboardSeenAt: readNullableTimestamp(item, "last_dashboard_seen_at"),
      profileCreatedAt: readNullableTimestamp(item, "profile_created_at"),
      projectCount,
      firstProjectAt: readNullableTimestamp(item, "first_project_at"),
      lastProjectAt: readNullableTimestamp(item, "last_project_at"),
    });
  }

  return { totalProfiles, rows };
}

async function loadOwnerActivityReport(): Promise<OwnerActivityReport | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc(
      "get_owner_user_activity_report",
      { p_limit: REPORT_ROW_LIMIT }
    );

    if (error) {
      console.warn("Owner user activity RPC failed:", error.message);
      return null;
    }

    const parsed = parseOwnerActivityReport(data);

    if (!parsed) {
      console.warn("Owner user activity RPC returned malformed data.");
    }

    return parsed;
  } catch (error) {
    console.warn("Owner user activity query failed:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

async function loadAllAuthUsers(): Promise<AuthUserSummary[] | null> {
  try {
    const users: AuthUserSummary[] = [];

    for (let page = 1; page <= AUTH_USERS_MAX_PAGES; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: AUTH_USERS_PAGE_SIZE,
      });

      if (error) {
        console.warn("Owner user activity: listUsers failed:", error.message);
        return null;
      }

      for (const authUser of data.users) {
        const provider = authUser.app_metadata?.provider;

        users.push({
          id: authUser.id,
          email: authUser.email ?? null,
          createdAt: authUser.created_at ?? null,
          emailConfirmedAt: authUser.email_confirmed_at ?? null,
          lastSignInAt: authUser.last_sign_in_at ?? null,
          provider: typeof provider === "string" ? provider : null,
        });
      }

      if (data.users.length < AUTH_USERS_PAGE_SIZE) {
        break;
      }
    }

    return users;
  } catch (error) {
    console.warn("Owner user activity: listUsers threw:", {
      message: error instanceof Error ? error.message : "Unknown auth admin error",
    });
    return null;
  }
}

function latestOf(...values: Array<string | null>): string | null {
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

function mergeUserActivity(
  authUsers: AuthUserSummary[] | null,
  activityReport: OwnerActivityReport | null
): OwnerUserActivityRow[] {
  const profileById = new Map(
    (activityReport?.rows ?? []).map((row) => [row.id, row])
  );
  const authById = new Map((authUsers ?? []).map((user) => [user.id, user]));
  const allIds = new Set<string>([...profileById.keys(), ...authById.keys()]);

  const merged: OwnerUserActivityRow[] = [];

  for (const id of allIds) {
    const authUser = authById.get(id) ?? null;
    const profile = profileById.get(id) ?? null;

    const lastExtractAt = profile?.lastExtractAt ?? null;
    const lastDashboardSeenAt = profile?.lastDashboardSeenAt ?? null;
    const lastProjectAt = profile?.lastProjectAt ?? null;
    const lastSignInAt = authUser?.lastSignInAt ?? null;

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
      lastActivityAt: latestOf(
        lastSignInAt,
        lastDashboardSeenAt,
        lastExtractAt,
        lastProjectAt
      ),
      isOwnerOrTest: isOwnerEmail(authUser?.email ?? null),
    });
  }

  merged.sort((a, b) => {
    const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : -Infinity;
    const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : -Infinity;

    return bTime - aTime;
  });

  return merged;
}

export default async function AdminUserActivityPage() {
  await requireOwner();

  const [authUsersResult, activityReportResult] = await Promise.allSettled([
    loadAllAuthUsers(),
    loadOwnerActivityReport(),
  ]);

  const authUsers =
    authUsersResult.status === "fulfilled" ? authUsersResult.value : null;
  const activityReport =
    activityReportResult.status === "fulfilled"
      ? activityReportResult.value
      : null;

  if (!authUsers && !activityReport) {
    return (
      <main className="admin-analytics-page">
        <style>{ownerUsersCss}</style>
        <section className="admin-analytics-shell">
          <p className="admin-eyebrow">Owner analytics</p>
          <h1>Users &amp; Activity data is not available yet</h1>
          <p className="admin-muted">
            Neither the profile/activity report nor the Auth Admin user list
            could be loaded. This affects only this page.
          </p>
          <p>
            <Link href="/admin/analytics" className="owner-users-back-link">
              &larr; Back to Overview
            </Link>
          </p>
        </section>
      </main>
    );
  }

  const mergedRows = mergeUserActivity(authUsers, activityReport);

  return (
    <main className="admin-analytics-page">
      <style>{ownerUsersCss}</style>

      <section className="admin-analytics-shell">
        <div className="admin-header">
          <div>
            <p className="admin-eyebrow">Owner analytics</p>
            <h1>Users &amp; Activity</h1>
          </div>
          <p className="admin-muted">
            Private internal view. Times shown in Israel time (24-hour).
          </p>
        </div>

        <nav className="admin-tabs" aria-label="Owner analytics sections">
          <Link href="/admin/analytics" className="admin-tab">
            Overview
          </Link>
          <span className="admin-tab admin-tab--active">Users &amp; Activity</span>
        </nav>

        {!authUsers ? (
          <p className="owner-users-warning">
            Auth Admin data is temporarily unavailable. Showing profile and
            activity data only — signup date, verification, provider, and
            last sign-in may be incomplete below.
          </p>
        ) : null}

        {!activityReport ? (
          <p className="owner-users-warning">
            The profile/activity report is temporarily unavailable. Showing
            Auth account data only — plan, subscription, extraction, and
            project activity are unavailable below.
          </p>
        ) : null}

        <UserActivityTable rows={mergedRows} />
      </section>
    </main>
  );
}

const ownerUsersCss = `
  .admin-analytics-page {
    min-height: 100svh;
    background: #f8fafc;
    color: #0f172a;
    padding: 32px 20px;
  }

  .admin-analytics-shell {
    width: min(1180px, 100%);
    margin: 0 auto;
    display: grid;
    gap: 20px;
  }

  .admin-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 18px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 18px;
  }

  .admin-eyebrow {
    margin: 0 0 8px;
    color: #2563eb;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .admin-header h1,
  .admin-analytics-shell h1 {
    margin: 0;
    font-size: 34px;
    line-height: 1.1;
    font-weight: 850;
  }

  .admin-muted {
    margin: 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
  }

  .admin-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .admin-tab {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #475569;
    font-size: 13px;
    font-weight: 800;
    text-decoration: none;
  }

  a.admin-tab:hover {
    border-color: #93c5fd;
    color: #1d4ed8;
  }

  .admin-tab--active {
    border-color: #2563eb;
    background: #eff6ff;
    color: #1d4ed8;
  }

  .owner-users-warning {
    margin: 0;
    padding: 12px 16px;
    border: 1px solid #fde68a;
    border-radius: 8px;
    background: #fffbeb;
    color: #92400e;
    font-size: 13px;
    font-weight: 700;
  }

  .owner-users-back-link {
    color: #1d4ed8;
    font-size: 13px;
    font-weight: 800;
    text-decoration: none;
  }

  .admin-product-stat-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 14px;
  }

  .admin-stat-card,
  .admin-panel {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 18px 44px rgba(15, 23, 42, 0.06);
  }

  .admin-stat-card {
    padding: 16px;
    display: grid;
    gap: 6px;
  }

  .admin-stat-card p {
    margin: 0;
    color: #64748b;
    font-size: 12px;
  }

  .admin-stat-card strong {
    display: block;
    color: #0f172a;
    font-size: 26px;
    line-height: 1;
    font-weight: 850;
  }

  .admin-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 18px;
    border-bottom: 1px solid #e2e8f0;
  }

  .admin-panel-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: 16px;
    font-weight: 850;
  }

  .admin-panel-header span {
    color: #64748b;
    font-size: 12px;
    font-weight: 750;
    white-space: nowrap;
  }

  .admin-empty-panel {
    padding: 18px;
  }

  .owner-users-table-shell {
    display: grid;
    gap: 0;
  }

  .owner-users-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    padding: 14px 18px;
    border-bottom: 1px solid #e2e8f0;
  }

  .owner-users-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .owner-users-filter {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #475569;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
  }

  .owner-users-filter:hover {
    border-color: #93c5fd;
    color: #1d4ed8;
  }

  .owner-users-filter--active {
    border-color: #2563eb;
    background: #eff6ff;
    color: #1d4ed8;
  }

  .owner-users-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
  }

  .owner-users-badge {
    display: inline-flex;
    align-items: center;
    margin-left: 8px;
    padding: 0 7px;
    height: 18px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #64748b;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .owner-users-count {
    padding: 12px 18px;
  }

  .admin-table-wrap {
    overflow-x: auto;
  }

  .admin-table-wrap table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .admin-table-wrap th,
  .admin-table-wrap td {
    padding: 12px 18px;
    border-bottom: 1px solid #edf2f7;
    text-align: left;
    white-space: nowrap;
  }

  .admin-table-wrap th {
    color: #475569;
    background: #f8fafc;
    font-weight: 800;
  }

  .admin-table-wrap td {
    color: #1e293b;
  }

  .admin-status-pill {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 0 9px;
    border-radius: 999px;
    font-size: 12px;
    line-height: 1;
    font-weight: 850;
  }

  .admin-status-pill--yes {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #bbf7d0;
  }

  .admin-status-pill--no {
    background: #f8fafc;
    color: #475569;
    border: 1px solid #e2e8f0;
  }

  @media (max-width: 1020px) {
    .admin-product-stat-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 820px) {
    .admin-analytics-page {
      padding: 22px 14px;
    }

    .admin-header {
      display: grid;
      align-items: start;
    }

    .admin-header h1,
    .admin-analytics-shell h1 {
      font-size: 28px;
    }

    .admin-product-stat-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`;
