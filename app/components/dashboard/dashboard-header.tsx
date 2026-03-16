"use client";

type DashboardHeaderProps = {
  onDisconnect: () => void;
  isDisconnecting?: boolean;
};

export default function DashboardHeader({
  onDisconnect,
  isDisconnecting = false,
}: DashboardHeaderProps) {
  return (
    <div
      style={{
        marginBottom: "18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "54px",
            fontWeight: 800,
            color: "#0f172a",
            lineHeight: 0.98,
            marginBottom: "8px",
          }}
        >
          InboxShaper Dashboard
        </div>

        <div
          style={{
            color: "#64748b",
            fontSize: "18px",
            lineHeight: 1.7,
          }}
        >
          Analyze your inbox, review results, and clean email faster.
        </div>
      </div>

      <button
        type="button"
        onClick={onDisconnect}
        disabled={isDisconnecting}
        style={{
          border: "1px solid #fecaca",
          background: "#ffffff",
          color: "#dc2626",
          borderRadius: "14px",
          padding: "14px 22px",
          fontSize: "16px",
          fontWeight: 600,
          cursor: isDisconnecting ? "not-allowed" : "pointer",
          opacity: isDisconnecting ? 0.7 : 1,
          transition: "all 0.2s ease",
          minWidth: "170px",
        }}
      >
        {isDisconnecting ? "Disconnecting..." : "Disconnect Gmail"}
      </button>
    </div>
  );
}