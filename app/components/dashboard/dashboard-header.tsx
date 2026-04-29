"use client";

type DashboardHeaderProps = {
  userEmail?: string;
  onBilling: () => void;
  onDisconnect: () => void;
  onLogout: () => void;
  isDisconnecting?: boolean;
  isLoggingOut?: boolean;
};

export default function DashboardHeader({
  userEmail,
  onBilling,
  onDisconnect,
  onLogout,
  isDisconnecting = false,
  isLoggingOut = false,
}: DashboardHeaderProps) {
  // These props are intentionally kept for backward compatibility.
  // The global user menu now lives in dashboard-shell.tsx.
  void userEmail;
  void onBilling;
  void onDisconnect;
  void onLogout;
  void isDisconnecting;
  void isLoggingOut;

  return (
    <header style={headerWrapStyle}>
      <div style={copyBlockStyle}>
        <div style={kickerRowStyle}>
          <span style={kickerDotStyle} />
          <span style={kickerTextStyle}>Live workspace</span>
        </div>

        <h1 style={titleStyle}>Dashboard</h1>

        <p style={subtitleStyle}>
          See what needs attention now and track your revenue with a cleaner,
          sharper workspace.
        </p>
      </div>
    </header>
  );
}

const headerWrapStyle: React.CSSProperties = {
  width: "100%",
  marginBottom: "18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  paddingRight: "78px",
};

const copyBlockStyle: React.CSSProperties = {
  minWidth: 0,
};

const kickerRowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "9px",
  padding: "7px 10px",
  borderRadius: "999px",
  border: "1px solid rgba(199,210,254,0.78)",
  background: "rgba(238,242,255,0.72)",
};

const kickerDotStyle: React.CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  background: "linear-gradient(135deg, #6366f1, #2563eb)",
  boxShadow: "0 0 0 4px rgba(99,102,241,0.12)",
};

const kickerTextStyle: React.CSSProperties = {
  color: "#4f46e5",
  fontSize: "11px",
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "42px",
  fontWeight: 950,
  color: "#0f172a",
  lineHeight: 1,
  marginBottom: "8px",
  letterSpacing: "-0.06em",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: "760px",
  color: "#64748b",
  fontSize: "16px",
  lineHeight: 1.65,
  fontWeight: 650,
};