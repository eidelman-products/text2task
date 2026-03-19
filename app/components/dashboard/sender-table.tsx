import ActionCell from "./action-cell";

type TopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod?: "url" | "mailto" | null;
};

type SenderTableProps = {
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

function formatSender(sender: string) {
  const match = sender.match(/^(.*)<(.+)>$/);

  if (!match) {
    return {
      name: sender.trim(),
      email: null as string | null,
    };
  }

  const name = match[1]?.trim() || "Unknown Sender";
  const email = match[2]?.trim() || null;

  return {
    name,
    email,
  };
}

export default function SenderTable({
  rows,
  deletingSender,
  archivingSender,
  remainingWeeklyCleanup,
  plan,
  unsubscribedSenders = {},
  onDelete,
  onArchive,
  onUnsubscribe,
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

      {rows.map((item, index) => {
        const isUnsubscribed = Boolean(unsubscribedSenders[item.sender]);
        const formattedSender = formatSender(item.sender);

        return (
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
              background: isUnsubscribed ? "#f0fdf4" : "#ffffff",
              transition: "background 0.2s ease",
            }}
          >
            <div
              style={{
                minWidth: 0,
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
                {formattedSender.name}
              </div>

              {formattedSender.email ? (
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "12px",
                    color: "#64748b",
                    fontWeight: 600,
                    overflowWrap: "anywhere",
                  }}
                >
                  {formattedSender.email}
                </div>
              ) : null}
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
                isUnsubscribed={isUnsubscribed}
                onDelete={onDelete}
                onArchive={onArchive}
                onUnsubscribe={onUnsubscribe}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}