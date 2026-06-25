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

type SignupAttributionRow = {
  event_name: "signup_attribution_captured" | "signup_success";
  user_id: string | null;
  occurred_at: string;
  anonymous_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_page: string | null;
  country_code: string | null;
  page_path: string | null;
};

type PeriodStats = {
  label: string;
  total: number;
  pageViews: number;
  uniqueVisitors: number;
};

type RecentUserSummary = {
  id: string;
  signupDate: string;
  projectCount: number;
  firstProjectSavedAt: string | null;
};

type ProductActivationData = {
  totalUsers: number;
  totalProjects: number;
  activatedUsers: number;
  notActivatedUsers: number;
  activationRate: number;
  recentUsers: RecentUserSummary[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const TRAFFIC_ROWS_LIMIT = 5000;
const RECENT_USERS_LIMIT = 25;
const SIGNUP_ATTRIBUTION_LIMIT = 200;
const SIGNUP_ATTRIBUTION_EVENTS = [
  "signup_attribution_captured",
  "signup_success",
] as const;
const OWNER_ANALYTICS_TIME_ZONE = "Asia/Jerusalem";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const numberFormatter = new Intl.NumberFormat("en-US");
const analyticsTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: OWNER_ANALYTICS_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const ownerTimeZonePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: OWNER_ANALYTICS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
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

function isAdminPath(pathname: string | null | undefined) {
  return typeof pathname === "string" && pathname.startsWith("/admin");
}

function filterOwnerTrafficRows(rows: AnalyticsEventRow[]) {
  return rows.filter((row) => !isAdminPath(row.page_path));
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseEventDate(row: AnalyticsEventRow) {
  return parseTimestamp(row.occurred_at) ?? 0;
}

function getDateTimePart(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function getOwnerTimeZoneDateParts(timestamp: number) {
  const parts = ownerTimeZonePartsFormatter.formatToParts(new Date(timestamp));
  const year = Number(getDateTimePart(parts, "year"));
  const month = Number(getDateTimePart(parts, "month"));
  const day = Number(getDateTimePart(parts, "day"));
  const hour = Number(getDateTimePart(parts, "hour"));
  const minute = Number(getDateTimePart(parts, "minute"));
  const second = Number(getDateTimePart(parts, "second"));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second)
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
  };
}

function getOwnerTimeZoneOffsetMs(timestamp: number) {
  const parts = getOwnerTimeZoneDateParts(timestamp);

  if (!parts) {
    return 0;
  }

  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    ) - timestamp
  );
}

function getStartOfOwnerAnalyticsDay(timestamp: number) {
  const parts = getOwnerTimeZoneDateParts(timestamp);

  if (!parts) {
    const fallback = new Date(timestamp);
    fallback.setUTCHours(0, 0, 0, 0);

    return fallback.getTime();
  }

  const localMidnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  let startOfDay =
    localMidnightAsUtc - getOwnerTimeZoneOffsetMs(localMidnightAsUtc);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const adjusted =
      localMidnightAsUtc - getOwnerTimeZoneOffsetMs(startOfDay);

    if (adjusted === startOfDay) {
      return startOfDay;
    }

    startOfDay = adjusted;
  }

  return startOfDay;
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

function getTrafficSource(row: Pick<AnalyticsEventRow, "utm_source">) {
  return row.utm_source?.trim() || "direct / none";
}

function getTrafficCampaign(row: Pick<AnalyticsEventRow, "utm_campaign">) {
  return row.utm_campaign?.trim() || "none";
}

function getCountry(row: Pick<AnalyticsEventRow, "country_code">) {
  return row.country_code?.trim().toUpperCase() || "Unknown";
}

function buildSourceRows(rows: AnalyticsEventRow[]) {
  const groups = new Map<
    string,
    { source: string; campaign: string; events: number; visitors: Set<string> }
  >();

  for (const row of rows) {
    const source = getTrafficSource(row);
    const campaign = getTrafficCampaign(row);
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
    const country = getCountry(row);
    const current = groups.get(country) ?? { country, events: 0 };

    current.events += 1;
    groups.set(country, current);
  }

  return Array.from(groups.values())
    .sort((a, b) => b.events - a.events)
    .slice(0, 12);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function readUuid(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function readTimestampString(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && parseTimestamp(value) !== null
    ? value
    : null;
}

function readNullableTimestampString(
  record: Record<string, unknown>,
  key: string
) {
  const value = record[key];

  if (value === null) {
    return null;
  }

  return readTimestampString(record, key) ?? undefined;
}

function parseProductActivationData(
  value: unknown
): ProductActivationData | null {
  if (!isRecord(value) || !isRecord(value.summary)) {
    return null;
  }

  const totalUsers = readNonNegativeInteger(value.summary, "total_users");
  const totalProjects = readNonNegativeInteger(value.summary, "total_projects");
  const activatedUsers = readNonNegativeInteger(
    value.summary,
    "activated_users"
  );
  const notActivatedUsers = readNonNegativeInteger(
    value.summary,
    "not_activated_users"
  );

  if (
    totalUsers === null ||
    totalProjects === null ||
    activatedUsers === null ||
    notActivatedUsers === null ||
    activatedUsers > totalUsers ||
    notActivatedUsers !== totalUsers - activatedUsers
  ) {
    return null;
  }

  if (
    !Array.isArray(value.recent_users) ||
    value.recent_users.length > RECENT_USERS_LIMIT
  ) {
    return null;
  }

  const recentUsers: RecentUserSummary[] = [];

  for (const item of value.recent_users) {
    if (!isRecord(item)) {
      return null;
    }

    const userId = readUuid(item, "user_id");
    const signupDate = readTimestampString(item, "signup_at");
    const projectCount = readNonNegativeInteger(item, "project_count");
    const firstProjectSavedAt = readNullableTimestampString(
      item,
      "first_project_saved_at"
    );

    if (
      !userId ||
      !signupDate ||
      projectCount === null ||
      firstProjectSavedAt === undefined ||
      (projectCount === 0 && firstProjectSavedAt !== null) ||
      (projectCount > 0 && firstProjectSavedAt === null)
    ) {
      return null;
    }

    recentUsers.push({
      id: userId,
      signupDate,
      projectCount,
      firstProjectSavedAt,
    });
  }

  return {
    totalUsers,
    totalProjects,
    activatedUsers,
    notActivatedUsers,
    activationRate: totalUsers === 0 ? 0 : (activatedUsers / totalUsers) * 100,
    recentUsers,
  };
}

async function loadTrafficRows(now: number) {
  try {
    const since = new Date(now - 30 * DAY_MS).toISOString();
    const { data, error } = await supabaseAdmin
      .from("analytics_events")
      .select(
        "event_name, occurred_at, anonymous_id, utm_source, utm_campaign, country_code, page_path"
      )
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(TRAFFIC_ROWS_LIMIT);

    if (error) {
      console.warn("Owner traffic analytics query failed:", error.message);

      return null;
    }

    return filterOwnerTrafficRows((data ?? []) as AnalyticsEventRow[]);
  } catch (error) {
    console.warn("Owner traffic analytics query failed:", {
      message: error instanceof Error ? error.message : "Unknown analytics error",
    });

    return null;
  }
}

async function loadSignupAttributionRows(userIds: string[]) {
  if (userIds.length === 0) {
    return [];
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("analytics_events")
      .select(
        "event_name, user_id, occurred_at, anonymous_id, utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_page, country_code, page_path"
      )
      .in("event_name", SIGNUP_ATTRIBUTION_EVENTS)
      .in("user_id", userIds)
      .order("occurred_at", { ascending: true })
      .limit(SIGNUP_ATTRIBUTION_LIMIT);

    if (error) {
      console.warn("Owner signup attribution query failed:", error.message);

      return null;
    }

    return ((data ?? []) as SignupAttributionRow[]).filter(
      (row) => !isAdminPath(row.page_path)
    );
  } catch (error) {
    console.warn("Owner signup attribution query failed:", {
      message: error instanceof Error ? error.message : "Unknown analytics error",
    });

    return null;
  }
}

async function loadProductActivationData() {
  try {
    const { data, error } = await supabaseAdmin.rpc(
      "get_owner_product_activation_analytics"
    );

    if (error) {
      console.warn("Owner product activation RPC failed:", error.message);

      return null;
    }

    const parsed = parseProductActivationData(data);

    if (!parsed) {
      console.warn("Owner product activation RPC returned malformed data.");
    }

    return parsed;
  } catch (error) {
    console.warn("Owner product activation query failed:", {
      message:
        error instanceof Error ? error.message : "Unknown product analytics error",
    });

    return null;
  }
}

function hasSignupAttributionText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasValidSignupAttribution(row: SignupAttributionRow) {
  return Boolean(
    hasSignupAttributionText(row.anonymous_id) ||
      hasSignupAttributionText(row.utm_source) ||
      hasSignupAttributionText(row.utm_medium) ||
      hasSignupAttributionText(row.utm_campaign) ||
      hasSignupAttributionText(row.utm_content) ||
      hasSignupAttributionText(row.referrer) ||
      hasSignupAttributionText(row.landing_page) ||
      hasSignupAttributionText(row.page_path) ||
      hasSignupAttributionText(row.country_code)
  );
}

function buildSignupAttributionByUser(rows: SignupAttributionRow[]) {
  const candidatesByUser = new Map<
    string,
    {
      captured?: SignupAttributionRow;
      success?: SignupAttributionRow;
    }
  >();
  const attributionByUser = new Map<string, SignupAttributionRow>();

  for (const row of rows) {
    const userId = row.user_id?.trim();

    if (!userId || !hasValidSignupAttribution(row)) {
      continue;
    }

    const candidates = candidatesByUser.get(userId) ?? {};

    if (
      row.event_name === "signup_attribution_captured" &&
      !candidates.captured
    ) {
      candidates.captured = row;
    }

    if (row.event_name === "signup_success" && !candidates.success) {
      candidates.success = row;
    }

    candidatesByUser.set(userId, candidates);
  }

  for (const [userId, candidates] of candidatesByUser) {
    const attribution = candidates.captured ?? candidates.success;

    if (attribution) {
      attributionByUser.set(userId, attribution);
    }
  }

  return attributionByUser;
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercentage(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  const rounded = Number(value.toFixed(1));

  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function formatDate(value: string | null | undefined) {
  const timestamp = parseTimestamp(value);

  if (timestamp === null) {
    return "Unknown";
  }

  const parts = analyticsTimestampFormatter.formatToParts(new Date(timestamp));
  const month = getDateTimePart(parts, "month");
  const day = getDateTimePart(parts, "day");
  const hour = getDateTimePart(parts, "hour");
  const minute = getDateTimePart(parts, "minute");

  if (!month || !day || !hour || !minute) {
    return "Unknown";
  }

  return `${month} ${day}, ${hour}:${minute}`;
}

function formatOptionalDate(value: string | null | undefined) {
  return value ? formatDate(value) : "—";
}

function formatTimeToFirstProject(
  signupDate: string | null,
  firstProjectSavedAt: string | null
) {
  const signupTimestamp = parseTimestamp(signupDate);
  const firstProjectTimestamp = parseTimestamp(firstProjectSavedAt);

  if (
    signupTimestamp === null ||
    firstProjectTimestamp === null ||
    firstProjectTimestamp < signupTimestamp
  ) {
    return "—";
  }

  const diffMs = firstProjectTimestamp - signupTimestamp;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) {
    return "<1 min";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 48) {
    return `${diffHours} hr`;
  }

  const diffDays = Math.floor(diffHours / 24);

  return `${diffDays} days`;
}

function getSignupSource(attribution: SignupAttributionRow | undefined) {
  if (!attribution) {
    return "Attribution unavailable";
  }

  return attribution.utm_source?.trim() || "direct / none";
}

function getSignupCampaign(attribution: SignupAttributionRow | undefined) {
  if (!attribution) {
    return "—";
  }

  return attribution.utm_campaign?.trim() || "—";
}

function getSignupCountry(attribution: SignupAttributionRow | undefined) {
  if (!attribution) {
    return "Unknown";
  }

  return attribution.country_code?.trim().toUpperCase() || "Unknown";
}

function UnavailablePanel({ message }: { message: string }) {
  return (
    <div className="admin-panel admin-empty-panel">
      <p className="admin-muted">{message}</p>
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  await requireOwner();

  const now = Date.now();

  const [trafficRows, productData] = await Promise.all([
    loadTrafficRows(now),
    loadProductActivationData(),
  ]);
  const signupAttributionRows = productData
    ? await loadSignupAttributionRows(
        productData.recentUsers.map((user) => user.id)
      )
    : null;

  if (!trafficRows && !productData) {
    return (
      <main className="admin-analytics-page">
        <style>{adminAnalyticsCss}</style>
        <section className="admin-analytics-shell">
          <p className="admin-eyebrow">Owner analytics</p>
          <h1>Analytics data is not available yet</h1>
          <p className="admin-muted">
            The private analytics table or product reporting queries may not be
            available yet.
          </p>
        </section>
      </main>
    );
  }

  const startOfToday = getStartOfOwnerAnalyticsDay(now);

  const periodStats = trafficRows
    ? [
        buildPeriodStats("Today", trafficRows, startOfToday),
        buildPeriodStats("Last 7 days", trafficRows, now - 7 * DAY_MS),
        buildPeriodStats("Last 30 days", trafficRows, now - 30 * DAY_MS),
      ]
    : [];
  const sourceRows = trafficRows ? buildSourceRows(trafficRows) : [];
  const countryRows = trafficRows ? buildCountryRows(trafficRows) : [];
  const recentRows = trafficRows ? trafficRows.slice(0, 25) : [];
  const signupAttributionByUser = buildSignupAttributionByUser(
    signupAttributionRows ?? []
  );

  return (
    <main className="admin-analytics-page">
      <style>{adminAnalyticsCss}</style>

      <section className="admin-analytics-shell">
        <div className="admin-header">
          <div>
            <p className="admin-eyebrow">Owner analytics</p>
            <h1>Text2Task analytics</h1>
          </div>
          <p className="admin-muted">
            Private internal view. Times shown in Israel time (24-hour).
          </p>
        </div>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>Tracked traffic</h2>
              <p className="admin-muted">
                Traffic metrics include visitors who accepted analytics.
              </p>
            </div>
            <span>Last 30 days</span>
          </div>

          {trafficRows ? (
            <>
              <div className="admin-stat-grid">
                {periodStats.map((stat) => (
                  <article className="admin-stat-card" key={stat.label}>
                    <p>{stat.label}</p>
                    <strong>{formatNumber(stat.total)}</strong>
                    <span>tracked events</span>
                    <span>{formatNumber(stat.pageViews)} page views</span>
                    <span>
                      {formatNumber(stat.uniqueVisitors)} tracked visitors
                    </span>
                  </article>
                ))}
              </div>

              <section className="admin-section-grid">
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <h2>Source and campaign</h2>
                    <span>Tracked traffic</span>
                  </div>
                  <div className="admin-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Campaign</th>
                          <th>Events</th>
                          <th>Tracked visitors</th>
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
                    <span>Tracked traffic</span>
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
                  <h2>Recent traffic events</h2>
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
                          <tr
                            key={`${row.occurred_at}-${row.event_name}-${index}`}
                          >
                            <td>{formatDate(row.occurred_at)}</td>
                            <td>{row.event_name}</td>
                            <td>{getTrafficSource(row)}</td>
                            <td>{getTrafficCampaign(row)}</td>
                            <td>{getCountry(row)}</td>
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
            </>
          ) : (
            <UnavailablePanel message="Traffic analytics unavailable." />
          )}
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>Product activation</h2>
              <p className="admin-muted">
                Activation is based on saved project rows, including archived
                and soft-deleted projects.
              </p>
            </div>
            <span>All time</span>
          </div>

          {productData ? (
            <>
              <div className="admin-product-stat-grid">
                <article className="admin-stat-card">
                  <p>Total users</p>
                  <strong>{formatNumber(productData.totalUsers)}</strong>
                </article>
                <article className="admin-stat-card">
                  <p>Activated users</p>
                  <strong>{formatNumber(productData.activatedUsers)}</strong>
                </article>
                <article className="admin-stat-card">
                  <p>Not activated</p>
                  <strong>{formatNumber(productData.notActivatedUsers)}</strong>
                </article>
                <article className="admin-stat-card">
                  <p>Signup -&gt; Activation</p>
                  <strong>{formatPercentage(productData.activationRate)}</strong>
                </article>
                <article className="admin-stat-card">
                  <p>Total projects created</p>
                  <strong>{formatNumber(productData.totalProjects)}</strong>
                </article>
              </div>

              {signupAttributionRows === null ? (
                <p className="admin-muted">
                  Signup attribution is unavailable, so recent users show
                  attribution unavailable.
                </p>
              ) : null}

              <section className="admin-panel">
                <div className="admin-panel-header">
                  <h2>Recent users</h2>
                  <span>{formatNumber(productData.recentUsers.length)} shown</span>
                </div>
                <div className="admin-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Signup date</th>
                        <th>Source</th>
                        <th>Campaign</th>
                        <th>Country</th>
                        <th>Activated</th>
                        <th>First project saved</th>
                        <th>Projects created</th>
                        <th>Time to first project</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productData.recentUsers.length > 0
                        ? productData.recentUsers.map((user) => {
                            const attribution = signupAttributionByUser.get(user.id);
                            const isActivated = user.projectCount > 0;

                            return (
                              <tr key={user.id}>
                                <td>{formatDate(user.signupDate)}</td>
                                <td>{getSignupSource(attribution)}</td>
                                <td>{getSignupCampaign(attribution)}</td>
                                <td>{getSignupCountry(attribution)}</td>
                                <td>
                                  <span
                                    className={
                                      isActivated
                                        ? "admin-status-pill admin-status-pill--yes"
                                        : "admin-status-pill admin-status-pill--no"
                                    }
                                  >
                                    {isActivated ? "Yes" : "No"}
                                  </span>
                                </td>
                                <td>{formatOptionalDate(user.firstProjectSavedAt)}</td>
                                <td>{formatNumber(user.projectCount)}</td>
                                <td>
                                  {formatTimeToFirstProject(
                                    user.signupDate,
                                    user.firstProjectSavedAt
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        : null}
                      {productData.recentUsers.length === 0 ? (
                        <tr>
                          <td colSpan={8}>No users found yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <UnavailablePanel message="Product activation data unavailable." />
          )}
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
    gap: 26px;
  }

  .admin-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 18px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 18px;
  }

  .admin-section {
    display: grid;
    gap: 16px;
  }

  .admin-section-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
  }

  .admin-section-heading h2 {
    margin: 0 0 6px;
    color: #0f172a;
    font-size: 22px;
    line-height: 1.18;
    font-weight: 850;
    letter-spacing: 0;
  }

  .admin-section-heading span {
    color: #64748b;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
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

  .admin-stat-grid,
  .admin-product-stat-grid {
    display: grid;
    gap: 14px;
  }

  .admin-stat-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .admin-product-stat-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
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

  .admin-empty-panel {
    padding: 18px;
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
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 820px) {
    .admin-analytics-page {
      padding: 22px 14px;
    }

    .admin-header,
    .admin-section-heading,
    .admin-section-grid,
    .admin-stat-grid,
    .admin-product-stat-grid {
      grid-template-columns: 1fr;
    }

    .admin-header,
    .admin-section-heading {
      display: grid;
      align-items: start;
    }

    .admin-header h1,
    .admin-analytics-shell h1 {
      font-size: 28px;
    }
  }
`;
