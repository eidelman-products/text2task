import SectionCard from "./section-card";
import MetricCard from "./metric-card";
import SenderTable from "./sender-table";

type TopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
};

type SmartViewPageProps = {
  title: string;
  count: number;
  viewKey: "unread" | "social" | "jobSearch" | "shopping";
  description: string;
  rows: TopSender[];
  deletingSender: string | null;
  archivingSender: string | null;
  remainingWeeklyCleanup: number;
  plan: "free" | "pro";
  onDelete: (item: TopSender) => void;
  onArchive: (item: TopSender) => void;
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

export default function SmartViewPage({
  title,
  count,
  viewKey,
  description,
  rows,
  deletingSender,
  archivingSender,
  remainingWeeklyCleanup,
  plan,
  onDelete,
  onArchive,
}: SmartViewPageProps) {
  return (
    <SectionCard title={title} subtitle={description}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        <MetricCard label={title} value={formatNumber(count)} accent="#2563eb" />
        <MetricCard label="Scan type" value="Sample Scan" accent="#0f172a" />
        <MetricCard label="Plan" value="Free" accent="#2563eb" />
      </div>

      <div
        style={{
          marginBottom: "18px",
          background: "#f8fafc",
          border: "1px solid #dbe7ff",
          borderRadius: "18px",
          padding: "18px",
          color: "#475569",
          lineHeight: 1.8,
          fontSize: "15px",
        }}
      >
        {viewKey === "unread" ? (
          <>
            This number is the <b>real unread inbox count</b>. The sender table
            below shows the matching sender groups found inside your current
            sample scan.
          </>
        ) : viewKey === "social" ? (
          <>
            This view is based on emails Gmail itself labeled as <b>Social</b>.
            The table below shows the matching sender groups inside the current sample.
          </>
        ) : (
          <>
            This view is based on your <b>real sample scan matches</b>. The
            table below shows sender groups that matched this category inside
            the current sample.
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            border: "1px solid #dbe7ff",
            borderRadius: "20px",
            padding: "20px",
            color: "#64748b",
            fontWeight: 700,
          }}
        >
          No matching sender groups found in this sample scan.
        </div>
      ) : (
        <SenderTable
          rows={rows}
          deletingSender={deletingSender}
          archivingSender={archivingSender}
          remainingWeeklyCleanup={remainingWeeklyCleanup}
          plan={plan}
          onDelete={onDelete}
          onArchive={onArchive}
        />
      )}
    </SectionCard>
  );
}