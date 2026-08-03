import Link from "next/link";
import { notFound } from "next/navigation";

import {
  isOwnerAuthenticatedActivityUuid,
  loadOwnerUserActivityTimeline,
  type OwnerAuthenticatedActivityTimelineRow,
} from "@/lib/activity/owner-authenticated-activity.server";
import { getProductEventLabel } from "@/lib/activity/product-event-labels";
import type { ProductEntityType } from "@/lib/activity/product-event-contracts";
import { isOwnerEmail, requireOwner } from "@/lib/auth/owner.server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{ userId: string }>;
};

const timelineDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatDateTime(value: string) {
  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timelineDateFormatter.format(new Date(timestamp))
    : "-";
}

function shortenIdentifier(value: string) {
  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatEntityContext(
  entityType: ProductEntityType | null,
  entityId: string | null
) {
  if (entityType === null || entityId === null) {
    return null;
  }

  if (entityType === "calendar_day") {
    return entityId;
  }

  if (entityType === "calendar_event") {
    return `Calendar event ${shortenIdentifier(entityId)}`;
  }

  return `Project ${shortenIdentifier(entityId)}`;
}

async function loadAuthUser(userId: string) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error || !data.user) {
      return null;
    }

    const provider = data.user.app_metadata?.provider;

    return {
      id: data.user.id,
      email: data.user.email ?? null,
      createdAt: data.user.created_at ?? null,
      provider: typeof provider === "string" ? provider : null,
    };
  } catch (error) {
    console.warn("Owner authenticated activity: getUserById threw:", {
      message: error instanceof Error ? error.message : "Unknown auth admin error",
    });
    return null;
  }
}

function TimelineTable({
  rows,
}: {
  rows: OwnerAuthenticatedActivityTimelineRow[];
}) {
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Activity</th>
            <th>Route</th>
            <th>Entity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const entityContext = formatEntityContext(
              row.entityType,
              row.entityId
            );

            return (
              <tr
                key={`${row.createdAt}:${row.eventName}:${row.route}:${row.entityId ?? "none"}`}
              >
                <td>{formatDateTime(row.createdAt)}</td>
                <td>{getProductEventLabel(row.eventName)}</td>
                <td>
                  <code>{row.route}</code>
                </td>
                <td>{entityContext ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function OwnerUserActivityTimelinePage({
  params,
}: PageProps) {
  await requireOwner();

  const { userId } = await params;

  if (!isOwnerAuthenticatedActivityUuid(userId)) {
    notFound();
  }

  const authUser = await loadAuthUser(userId);

  if (!authUser) {
    notFound();
  }

  const timeline = await loadOwnerUserActivityTimeline(userId, 200);
  const ownerOrTest = isOwnerEmail(authUser.email);

  return (
    <main className="admin-analytics-page">
      <style>{timelineCss}</style>

      <section className="admin-analytics-shell">
        <div className="admin-header">
          <div>
            <p className="admin-eyebrow">Owner analytics</p>
            <h1>Authenticated activity timeline</h1>
          </div>
          <Link href="/admin/analytics/users" className="owner-users-back-link">
            &larr; Back to Users &amp; Activity
          </Link>
        </div>

        <section className="admin-panel owner-timeline-user">
          <div>
            <p className="admin-muted">User</p>
            <h2>
              {authUser.email ?? authUser.id}
              {ownerOrTest ? (
                <span className="owner-users-badge">owner/test</span>
              ) : null}
            </h2>
          </div>
          <dl>
            <div>
              <dt>Signup</dt>
              <dd>{authUser.createdAt ? formatDateTime(authUser.createdAt) : "-"}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{authUser.provider ?? "-"}</dd>
            </div>
          </dl>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2>Timeline</h2>
            <span>Latest 200 events</span>
          </div>

          {timeline.status === "unavailable" ? (
            <p className="admin-muted admin-empty-panel">
              Authenticated activity is temporarily unavailable.
            </p>
          ) : timeline.rows.length === 0 ? (
            <p className="admin-muted admin-empty-panel">
              No authenticated product views recorded.
            </p>
          ) : (
            <TimelineTable rows={timeline.rows} />
          )}
        </section>
      </section>
    </main>
  );
}

const timelineCss = `
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

  .admin-header h1 {
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

  .owner-users-back-link {
    color: #1d4ed8;
    font-size: 13px;
    font-weight: 800;
    text-decoration: none;
  }

  .admin-panel {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 18px 44px rgba(15, 23, 42, 0.06);
  }

  .owner-timeline-user {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 18px;
    padding: 18px;
  }

  .owner-timeline-user h2 {
    margin: 4px 0 0;
    font-size: 20px;
    line-height: 1.25;
  }

  .owner-timeline-user dl {
    display: flex;
    gap: 18px;
    margin: 0;
    flex-wrap: wrap;
  }

  .owner-timeline-user div {
    display: grid;
    gap: 4px;
  }

  .owner-timeline-user dt {
    color: #64748b;
    font-size: 12px;
    font-weight: 800;
  }

  .owner-timeline-user dd {
    margin: 0;
    font-size: 13px;
    font-weight: 750;
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
    vertical-align: middle;
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
    vertical-align: top;
  }

  .admin-table-wrap th {
    color: #475569;
    background: #f8fafc;
    font-weight: 800;
  }

  .admin-table-wrap td {
    color: #1e293b;
  }

  .admin-table-wrap code {
    color: #475569;
    font-size: 12px;
  }

  @media (max-width: 820px) {
    .admin-analytics-page {
      padding: 22px 14px;
    }

    .admin-header,
    .owner-timeline-user {
      display: grid;
      align-items: start;
    }

    .admin-header h1 {
      font-size: 28px;
    }
  }
`;
