import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AnalyticsEventRow = {
  event_name: string;
  occurred_at: string;
  anonymous_id: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  country_code: string | null;
  page_path: string | null;
};

type PeriodStats = {
  label: string;
  total: number;
  pageViews: number;
  uniqueVisitors: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function getOwnerEmails() {
  return (process.env.TEXT2TASK_OWNER_EMAILS ?? "")
    .split(/[\s,]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isOwnerEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  return getOwnerEmails().includes(normalizedEmail);
}

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email || !isOwnerEmail(user.email)) {
    notFound();
  }
}

function parseEventDate(row: AnalyticsEventRow) {
  const timestamp = new Date(row.occurred_at).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildPeriodStats(
  label: string,
  rows: AnalyticsEventRow[],
  since: number
): PeriodStats {
  const periodRows = rows.filter((row) => parseEventDate(row) >= since);
  const uniqueVisitors = new Set(
    periodRows.map((row) => row.anonymous_id).filter(Boolean)
  );

  return {
    label,
    total: periodRows.length,
    pageViews: periodRows.filter((row) => row.event_name === "page_view").length,
    uniqueVisitors: uniqueVisitors.size,
  };
}

function buildSourceRows(rows: AnalyticsEventRow[]) {
  const groups = new Map<
    string,
    { source: string; campaign: string; events: number; visitors: Set<string> }
  >();

  for (const row of rows) {
    const source = row.utm_source?.trim() || "(direct / none)";
    const campaign = row.utm_campaign?.trim() || "(none)";
    const key = `${source}\u0000${campaign}`;
    const current =
      groups.get(key) ??
      {
        source,
        campaign,
        events: 0,
        visitors: new Set<string>(),
      };

    current.events += 1;

    if (row.anonymous_id) {
      current.visitors.add(row.anonymous_id);
    }

    groups.set(key, current);
  }

  return Array.from(groups.values())
    .sort((a, b) => b.events - a.events)
    .slice(0, 12);
}

function buildCountryRows(rows: AnalyticsEventRow[]) {
  const groups = new Map<string, { country: string; events: number }>();

  for (const row of rows) {
    const country = row.country_code?.trim().toUpperCase() || "Unknown";
    const current = groups.get(country) ?? { country, events: 0 };

    current.events += 1;
    groups.set(country, current);
  }

  return Array.from(groups.values())
    .sort((a, b) => b.events - a.events)
    .slice(0, 12);
}

async function loadAnalyticsRows() {
  try {
    const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const { data, error } = await supabaseAdmin
      .from("analytics_events")
      .select(
        "event_name, occurred_at, anonymous_id, utm_source, utm_campaign, country_code, page_path"
      )
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.warn("Owner analytics query failed:", error.message);

      return null;
    }

    return (data ?? []) as AnalyticsEventRow[];
  } catch (error) {
    console.warn("Owner analytics query failed:", {
      message: error instanceof Error ? error.message : "Unknown analytics error",
    });

    return null;
  }
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return dateFormatter.format(date);
}

export default async function AdminAnalyticsPage() {
  await requireOwner();

  const rows = await loadAnalyticsRows();

  if (!rows) {
    return (
      <main className="admin-analytics-page">
        <style>{adminAnalyticsCss}</style>
        <section className="admin-analytics-shell">
          <p className="admin-eyebrow">Owner analytics</p>
          <h1>Analytics data is not available yet</h1>
          <p className="admin-muted">
            The private analytics table may not be migrated yet, or the latest
            query was unavailable.
          </p>
        </section>
      </main>
    );
  }

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const periodStats = [
    buildPeriodStats("Today", rows, startOfToday.getTime()),
    buildPeriodStats("Last 7 days", rows, now - 7 * DAY_MS),
    buildPeriodStats("Last 30 days", rows, now - 30 * DAY_MS),
  ];
  const sourceRows = buildSourceRows(rows);
  const countryRows = buildCountryRows(rows);
  const recentRows = rows.slice(0, 25);

  return (
    <main className="admin-analytics-page">
      <style>{adminAnalyticsCss}</style>

      <section className="admin-analytics-shell">
        <div className="admin-header">
          <div>
            <p className="admin-eyebrow">Owner analytics</p>
            <h1>Text2Task analytics</h1>
          </div>
          <p className="admin-muted">Private internal view</p>
        </div>

        <div className="admin-stat-grid">
          {periodStats.map((stat) => (
            <article className="admin-stat-card" key={stat.label}>
              <p>{stat.label}</p>
              <strong>{formatNumber(stat.total)}</strong>
              <span>{formatNumber(stat.pageViews)} page views</span>
              <span>{formatNumber(stat.uniqueVisitors)} unique visitors</span>
            </article>
          ))}
        </div>

        <section className="admin-section-grid">
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h2>Source and campaign</h2>
              <span>30 days</span>
            </div>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Campaign</th>
                    <th>Events</th>
                    <th>Visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.length ? (
                    sourceRows.map((row) => (
                      <tr key={`${row.source}-${row.campaign}`}>
                        <td>{row.source}</td>
                        <td>{row.campaign}</td>
                        <td>{formatNumber(row.events)}</td>
                        <td>{formatNumber(row.visitors.size)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>No source data yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-header">
              <h2>Country</h2>
              <span>30 days</span>
            </div>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {countryRows.length ? (
                    countryRows.map((row) => (
                      <tr key={row.country}>
                        <td>{row.country}</td>
                        <td>{formatNumber(row.events)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2}>No country data yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2>Recent events</h2>
            <span>{formatNumber(recentRows.length)} shown</span>
          </div>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Source</th>
                  <th>Campaign</th>
                  <th>Country</th>
                  <th>Page</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.length ? (
                  recentRows.map((row, index) => (
                    <tr key={`${row.occurred_at}-${row.event_name}-${index}`}>
                      <td>{formatDate(row.occurred_at)}</td>
                      <td>{row.event_name}</td>
                      <td>{row.utm_source || "(direct / none)"}</td>
                      <td>{row.utm_campaign || "(none)"}</td>
                      <td>{row.country_code || "Unknown"}</td>
                      <td>{row.page_path || "/"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>No events logged yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

const adminAnalyticsCss = `
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
    gap: 22px;
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
    letter-spacing: 0;
  }

  .admin-header h1,
  .admin-analytics-shell h1 {
    margin: 0;
    font-size: 34px;
    line-height: 1.1;
    font-weight: 850;
    letter-spacing: 0;
  }

  .admin-muted {
    margin: 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
  }

  .admin-stat-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
    padding: 18px;
    display: grid;
    gap: 8px;
  }

  .admin-stat-card p,
  .admin-stat-card span {
    margin: 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.35;
  }

  .admin-stat-card strong {
    display: block;
    color: #0f172a;
    font-size: 30px;
    line-height: 1;
    font-weight: 850;
    letter-spacing: 0;
  }

  .admin-section-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr);
    gap: 14px;
  }

  .admin-panel {
    overflow: hidden;
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
    line-height: 1.2;
    font-weight: 850;
    letter-spacing: 0;
  }

  .admin-panel-header span {
    color: #64748b;
    font-size: 12px;
    font-weight: 750;
    white-space: nowrap;
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

  .admin-table-wrap tr:last-child td {
    border-bottom: 0;
  }

  @media (max-width: 820px) {
    .admin-analytics-page {
      padding: 22px 14px;
    }

    .admin-header,
    .admin-section-grid,
    .admin-stat-grid {
      grid-template-columns: 1fr;
    }

    .admin-header {
      display: grid;
      align-items: start;
    }

    .admin-header h1,
    .admin-analytics-shell h1 {
      font-size: 28px;
    }
  }
`;
