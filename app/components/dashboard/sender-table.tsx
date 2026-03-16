import ActionCell from "./action-cell";

type TopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
};

type SenderTableProps = {
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

export default function SenderTable({
  rows,
  deletingSender,
  archivingSender,
  remainingWeeklyCleanup,
  plan,
  onDelete,
  onArchive,
}: SenderTableProps) {
  return (
    <div
      style={{
        border: "1px solid #dbe7ff",
        borderRadius: "20px",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 0.6fr 1.2fr",
          padding: "14px 18px",
          background: "#f8fbff",
          borderBottom: "1px solid #dbe7ff",
          fontSize: "14px",
          color: "#64748b",
          fontWeight: 800,
        }}
      >
        <div>Sender</div>
        <div>Emails</div>
        <div style={{ textAlign: "right" }}>Actions</div>
      </div>

      {rows.map((item, index) => (
        <div
          key={`${item.sender}-${index}`}
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 0.6fr 1.2fr",
            padding: "18px",
            borderBottom:
              index === rows.length - 1 ? "none" : "1px solid #edf2f7",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontWeight: 800,
              color: "#0f172a",
              fontSize: "16px",
              overflowWrap: "anywhere",
            }}
          >
            {item.sender}
          </div>

          <div
            style={{
              fontWeight: 800,
              color: "#0f172a",
              fontSize: "16px",
            }}
          >
            {formatNumber(item.count)}
          </div>

          <div>
            <ActionCell
              item={item}
              deletingSender={deletingSender}
              archivingSender={archivingSender}
              remainingWeeklyCleanup={remainingWeeklyCleanup}
              plan={plan}
              onDelete={onDelete}
              onArchive={onArchive}
            />
          </div>
        </div>
      ))}
    </div>
  );
}