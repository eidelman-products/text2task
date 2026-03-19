import SectionCard from "./section-card";
import SenderTable from "./sender-table";

type TopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod?: "url" | "mailto" | null;
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
  unsubscribedSenders?: Record<string, boolean>;
  onDelete: (item: TopSender) => void;
  onArchive: (item: TopSender) => void;
  onUnsubscribe: (item: TopSender) => void;
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
  unsubscribedSenders = {},
  onDelete,
  onArchive,
  onUnsubscribe,
}: SmartViewPageProps) {
  return (
    <SectionCard title={title} subtitle={description}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "18px",
          padding: "16px 18px",
          borderRadius: "18px",
          background: "#f8fbff",
          border: "1px solid #dbe7ff",
        }}
      >
        <div
          style={{
            color: "#1e3a8a",
            fontSize: "14px",
            fontWeight: 800,
          }}
        >
          View: {title}
        </div>

        <div
          style={{
            color: "#0f172a",
            fontSize: "14px",
            fontWeight: 800,
          }}
        >
          {formatNumber(count)} emails matched
        </div>
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
          No sender groups available in this view.
        </div>
      ) : (
        <SenderTable
          rows={rows}
          deletingSender={deletingSender}
          archivingSender={archivingSender}
          remainingWeeklyCleanup={remainingWeeklyCleanup}
          plan={plan}
          unsubscribedSenders={unsubscribedSenders}
          onDelete={onDelete}
          onArchive={onArchive}
          onUnsubscribe={onUnsubscribe}
        />
      )}
    </SectionCard>
  );
}