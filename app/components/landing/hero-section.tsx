"use client";

type HeroSectionProps = {
  jakartaClassName: string;
  onSignIn: () => void;
};

export default function HeroSection({
  jakartaClassName,
  onSignIn,
}: HeroSectionProps) {
  const trustPillStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 16px",
    borderRadius: "999px",
    fontSize: "15px",
    fontWeight: 700,
    color: "#334155",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  } as const;

  return (
    <div
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <h1
        className={jakartaClassName}
        style={{
          fontSize: "78px",
          lineHeight: "1.02",
          margin: "0 0 26px 0",
          fontWeight: 800,
          letterSpacing: "-0.05em",
          maxWidth: "920px",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        Clean your Gmail inbox in minutes.
      </h1>

      <p
        style={{
          fontSize: "25px",
          color: "#475569",
          maxWidth: "860px",
          margin: "0 auto 22px",
          lineHeight: "1.7",
          fontWeight: 500,
        }}
      >
        InboxShaper helps you scan clutter, review top senders, remove
        promotions, and clean your inbox faster without manual work.
      </p>

      <p
        className={jakartaClassName}
        style={{
          fontSize: "20px",
          color: "#0f172a",
          maxWidth: "860px",
          margin: "0 auto 34px",
          lineHeight: "1.8",
          fontWeight: 700,
        }}
      >
        Connect Gmail securely, review the results, and approve every cleanup
        action yourself.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <button
          onClick={onSignIn}
          className={jakartaClassName}
          style={{
            padding: "18px 34px",
            fontSize: "20px",
            borderRadius: "16px",
            border: "none",
            background: "#0f172a",
            color: "#ffffff",
            cursor: "pointer",
            fontWeight: 800,
            boxShadow: "0 18px 35px rgba(15, 23, 42, 0.16)",
          }}
        >
          Connect Gmail Securely
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "14px",
          flexWrap: "wrap",
          marginBottom: "14px",
        }}
      >
        <span style={trustPillStyle}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "999px",
              background: "#2563eb",
              display: "inline-block",
            }}
          />
          Metadata only
        </span>

        <span style={trustPillStyle}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "999px",
              background: "#16a34a",
              display: "inline-block",
            }}
          />
          No email storage
        </span>

        <span style={trustPillStyle}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "999px",
              background: "#f59e0b",
              display: "inline-block",
            }}
          />
          Every action requires approval
        </span>
      </div>

      <div
        style={{
          fontSize: "16px",
          color: "#64748b",
          lineHeight: "1.7",
          fontWeight: 500,
          marginBottom: "16px",
        }}
      >
        Google OAuth • Privacy-first • Disconnect anytime
      </div>

      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "999px",
          padding: "12px 18px",
          color: "#334155",
          fontSize: "15px",
          fontWeight: 500,
          lineHeight: 1.7,
          boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
        }}
      >
        No access to email content • No storage • Disconnect anytime
      </div>
    </div>
  );
}