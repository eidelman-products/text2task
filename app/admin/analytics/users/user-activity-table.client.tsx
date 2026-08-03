"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { getProductEventLabel } from "@/lib/activity/product-event-labels";
import type { OwnerUserActivityRow } from "./owner-user-activity-types";

type FilterKey =
  | "all"
  | "active_7d"
  | "extracted"
  | "never_extracted"
  | "missing_profile"
  | "unverified"
  | "viewed_app"
  | "returning"
  | "free"
  | "pro";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "active_7d", label: "Active last 7 days" },
  { key: "extracted", label: "Extracted" },
  { key: "never_extracted", label: "Never extracted" },
  { key: "missing_profile", label: "Missing profile" },
  { key: "unverified", label: "Unverified" },
  { key: "viewed_app", label: "Viewed app" },
  { key: "returning", label: "Returning" },
  { key: "free", label: "Free" },
  { key: "pro", label: "Pro" },
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jerusalem",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "-";
  }

  return dateFormatter.format(new Date(timestamp));
}

function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function matchesFilter(row: OwnerUserActivityRow, filter: FilterKey, now: number) {
  switch (filter) {
    case "all":
      return true;
    case "active_7d": {
      if (!row.lastActivityAt) {
        return false;
      }
      const timestamp = new Date(row.lastActivityAt).getTime();
      return Number.isFinite(timestamp) && now - timestamp <= SEVEN_DAYS_MS;
    }
    case "extracted":
      return row.successfulExtractCount > 0;
    case "never_extracted":
      return row.successfulExtractCount === 0;
    case "missing_profile":
      return !row.hasProfile;
    case "unverified":
      return !row.emailConfirmedAt;
    case "viewed_app":
      return row.totalAuthenticatedViews > 0;
    case "returning":
      return row.isAuthenticatedReturningUser;
    case "free":
      return row.plan === "free";
    case "pro":
      return row.plan === "pro";
    default:
      return true;
  }
}

function computeSummary(rows: OwnerUserActivityRow[], now: number) {
  return {
    authUsers: rows.length,
    publicProfiles: rows.filter((row) => row.hasProfile).length,
    activeLast7Days: rows.filter((row) => {
      if (!row.lastActivityAt) return false;
      const timestamp = new Date(row.lastActivityAt).getTime();
      return Number.isFinite(timestamp) && now - timestamp <= SEVEN_DAYS_MS;
    }).length,
    extracted: rows.filter((row) => row.successfulExtractCount > 0).length,
    neverExtracted: rows.filter((row) => row.successfulExtractCount === 0)
      .length,
    missingProfiles: rows.filter((row) => !row.hasProfile).length,
    authenticatedActiveLast7Days: rows.filter((row) => {
      if (!row.authenticatedLastSeenAt) return false;
      const timestamp = new Date(row.authenticatedLastSeenAt).getTime();
      return Number.isFinite(timestamp) && now - timestamp <= SEVEN_DAYS_MS;
    }).length,
    returningUsers: rows.filter((row) => row.isAuthenticatedReturningUser)
      .length,
  };
}

export default function UserActivityTable({
  rows,
  authenticatedActivityUnavailable = false,
}: {
  rows: OwnerUserActivityRow[];
  authenticatedActivityUnavailable?: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [showOwnerTest, setShowOwnerTest] = useState(false);

  const visibleRows = useMemo(
    () => rows.filter((row) => showOwnerTest || !row.isOwnerOrTest),
    [rows, showOwnerTest]
  );

  const summary = useMemo(() => {
    // Intentional: summary cards are evaluated against the current time
    // whenever the memo recomputes (on data load or checkbox toggle), not on
    // every render.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();

    return computeSummary(visibleRows, now);
  }, [visibleRows]);

  const filteredRows = useMemo(() => {
    // Intentional: "active in last 7 days" is evaluated against the current
    // time whenever the memo recomputes (on filter/toggle change), not on
    // every render.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();

    return visibleRows.filter((row) => matchesFilter(row, activeFilter, now));
  }, [visibleRows, activeFilter]);

  return (
    <>
      <div className="admin-product-stat-grid">
        <article className="admin-stat-card">
          <p>Auth users</p>
          <strong>{summary.authUsers}</strong>
        </article>
        <article className="admin-stat-card">
          <p>Public profiles</p>
          <strong>{summary.publicProfiles}</strong>
        </article>
        <article className="admin-stat-card">
          <p>Active last 7 days</p>
          <strong>{summary.activeLast7Days}</strong>
        </article>
        <article className="admin-stat-card">
          <p>Users who extracted</p>
          <strong>{summary.extracted}</strong>
        </article>
        <article className="admin-stat-card">
          <p>Never extracted</p>
          <strong>{summary.neverExtracted}</strong>
        </article>
        <article className="admin-stat-card">
          <p>Missing profiles</p>
          <strong>{summary.missingProfiles}</strong>
        </article>
        <article className="admin-stat-card">
          <p>Authenticated active last 7 days</p>
          <strong>{summary.authenticatedActiveLast7Days}</strong>
        </article>
        <article className="admin-stat-card">
          <p>Returning users</p>
          <strong>{summary.returningUsers}</strong>
        </article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>All accounts</h2>
          <span>{rows.length} total</span>
        </div>
        <div className="owner-users-table-shell">
          <div className="owner-users-controls">
            <div
              className="owner-users-filters"
              role="group"
              aria-label="Filter users"
            >
              {FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={
                    activeFilter === filter.key
                      ? "owner-users-filter owner-users-filter--active"
                      : "owner-users-filter"
                  }
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <label className="owner-users-toggle">
              <input
                type="checkbox"
                checked={showOwnerTest}
                onChange={(event) => setShowOwnerTest(event.target.checked)}
              />
              Show owner/test accounts
            </label>
          </div>

          {authenticatedActivityUnavailable ? (
            <p className="admin-muted owner-users-count">
              Authenticated activity is temporarily unavailable.
            </p>
          ) : null}

          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Signup</th>
                  <th>Verified</th>
                  <th>Provider</th>
                  <th>Last sign-in</th>
                  <th>Last dashboard visit</th>
                  <th>Authenticated activity</th>
                  <th>Usage</th>
                  <th>Successful extracts</th>
                  <th>Last extract</th>
                  <th>Projects</th>
                  <th>Last project</th>
                  <th>Plan</th>
                  <th>Subscription</th>
                  <th>Profile</th>
                  <th>Timeline</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length ? (
                  filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.email ?? "Unknown"}
                        {row.isOwnerOrTest ? (
                          <span className="owner-users-badge">owner/test</span>
                        ) : null}
                      </td>
                      <td>{formatDate(row.signupAt)}</td>
                      <td>
                        <span
                          className={
                            row.emailConfirmedAt
                              ? "admin-status-pill admin-status-pill--yes"
                              : "admin-status-pill admin-status-pill--no"
                          }
                        >
                          {row.emailConfirmedAt ? "Verified" : "Unverified"}
                        </span>
                      </td>
                      <td>{row.provider ?? "-"}</td>
                      <td>{formatDate(row.lastSignInAt)}</td>
                      <td>{formatDate(row.lastDashboardSeenAt)}</td>
                      <td>
                        <div className="owner-users-stack">
                          <strong>
                            {getProductEventLabel(row.authenticatedLastEventName)}
                          </strong>
                          <span>{formatDate(row.authenticatedLastSeenAt)}</span>
                          {row.authenticatedLastViewedRoute ? (
                            <code>{row.authenticatedLastViewedRoute}</code>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="owner-users-stack">
                          <span>
                            {formatCount(
                              row.totalAuthenticatedViews,
                              "view",
                              "views"
                            )}
                          </span>
                          <span>
                            {formatCount(
                              row.authenticatedActiveDays,
                              "active day",
                              "active days"
                            )}
                          </span>
                          {row.isAuthenticatedReturningUser ? (
                            <span className="admin-status-pill admin-status-pill--yes">
                              Returning
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>{row.successfulExtractCount}</td>
                      <td>{formatDate(row.lastExtractAt)}</td>
                      <td>{row.projectCount}</td>
                      <td>{formatDate(row.lastProjectAt)}</td>
                      <td>{row.plan ?? "-"}</td>
                      <td>{row.subscriptionStatus ?? "-"}</td>
                      <td>
                        <span
                          className={
                            row.hasProfile
                              ? "admin-status-pill admin-status-pill--yes"
                              : "admin-status-pill admin-status-pill--no"
                          }
                        >
                          {row.hasProfile ? "OK" : "Missing"}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/admin/analytics/users/${row.id}`}
                          className="owner-users-action-link"
                        >
                          View timeline
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={16}>No users match this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="admin-muted owner-users-count">
            Showing {filteredRows.length} of {rows.length} accounts.
          </p>
        </div>
      </section>
    </>
  );
}
