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

type SenderBucket =
  | "1000+ messages"
  | "500–999 messages"
  | "100–499 messages"
  | "10–99 messages";

type TopSendersViewProps = {
  groupedTopSenders: Record<SenderBucket, TopSender[]>;
  weeklyCleanupUsed: number;
  freeWeeklyLimit: number;
  remainingWeeklyCleanup: number;
  deletingSender: string | null;
  archivingSender: string | null;
  plan: "free" | "pro";
  unsubscribedSenders?: Record<string, boolean>;
  onDelete: (item: TopSender) => void;
  onArchive: (item: TopSender) => void;
  onUnsubscribe: (item: TopSender) => void;
};

export default function TopSendersView({
  groupedTopSenders,
  weeklyCleanupUsed,
  freeWeeklyLimit,
  remainingWeeklyCleanup,
  deletingSender,
  archivingSender,
  plan,
  unsubscribedSenders = {},
  onDelete,
  onArchive,
  onUnsubscribe,
}: TopSendersViewProps) {
  const orderedSections: SenderBucket[] = [
    "1000+ messages",
    "500–999 messages",
    "100–499 messages",
    "10–99 messages",
  ];

  const hasAnyRows = orderedSections.some(
    (label) => groupedTopSenders[label].length > 0
  );

  return (
    <SectionCard
      title="Top Senders"
      subtitle="Review sender groups by size and clean the biggest opportunities first."
    >
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
          border: "1px solid #bfd3ff",
        }}
      >
        <div
          style={{
            color: "#1e3a8a",
            fontSize: "14px",
            fontWeight: 800,
          }}
        >
          Weekly cleanup used: {weeklyCleanupUsed} / {freeWeeklyLimit}
        </div>

        <div
          style={{
            color: "#15803d",
            fontSize: "14px",
            fontWeight: 800,
          }}
        >
          {remainingWeeklyCleanup} emails left this week
        </div>
      </div>

      {!hasAnyRows ? (
        <div
          style={{
            border: "1px solid #dbe7ff",
            borderRadius: "20px",
            padding: "20px",
            color: "#64748b",
            fontWeight: 700,
          }}
        >
          No sender groups available.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "20px" }}>
          {orderedSections.map((label) => {
            const rows = groupedTopSenders[label];
            if (!rows.length) return null;

            return (
              <div key={label}>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 800,
                    color: "#0f172a",
                    marginBottom: "12px",
                  }}
                >
                  {label}
                </div>

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
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}