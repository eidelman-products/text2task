"use client";

import SidebarButton from "./sidebar-button";

export default function DashboardSidebarProfile({
  email,
  plan,
  activeNav,
  onNavChange,
}: {
  email: string;
  plan: "free" | "pro";
  activeNav: "dashboard" | "extract" | "tasks";
  onNavChange: (nav: "dashboard" | "extract" | "tasks") => void;
}) {
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background:
                "linear-gradient(135deg, #60a5fa 0%, #6366f1 55%, #8b5cf6 100%)",
              boxShadow:
                "0 0 0 8px rgba(96,165,250,0.08), 0 10px 24px rgba(99,102,241,0.18)",
              flexShrink: 0,
            }}
          />

          <div
            style={{
              fontSize: 27,
              fontWeight: 900,
              letterSpacing: "-0.05em",
              color: "#0f172a",
            }}
          >
            Text2Task
          </div>
        </div>

        <div
          style={{
            color: "#64748b",
            fontSize: 14,
            lineHeight: 1.7,
            maxWidth: 210,
          }}
        >
          Turn messy messages into structured work.
        </div>
      </div>

      <div
        style={{
          padding: "0 4px 16px",
          marginBottom: 10,
          borderBottom: "1px solid rgba(226,232,240,0.95)",
        }}
      >
        <div
          style={{
            fontSize: 15,
            color: "#0f172a",
            fontWeight: 850,
            lineHeight: 1.4,
            wordBreak: "break-word",
            marginBottom: 8,
          }}
        >
          {getDisplayName(email)}
        </div>

        <div
          style={{
            fontSize: 13,
            color: "#64748b",
            lineHeight: 1.6,
            wordBreak: "break-word",
            marginBottom: 10,
          }}
        >
          {email}
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 11px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: plan === "pro" ? "#166534" : "#1d4ed8",
            background:
              plan === "pro"
                ? "rgba(34,197,94,0.11)"
                : "linear-gradient(180deg, rgba(59,130,246,0.10) 0%, rgba(99,102,241,0.10) 100%)",
            border:
              plan === "pro"
                ? "1px solid rgba(34,197,94,0.18)"
                : "1px solid rgba(59,130,246,0.18)",
            boxShadow:
              plan === "pro"
                ? "0 6px 16px rgba(34,197,94,0.08)"
                : "0 8px 18px rgba(59,130,246,0.08)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: plan === "pro" ? "#22c55e" : "#3b82f6",
              boxShadow:
                plan === "pro"
                  ? "0 0 0 4px rgba(34,197,94,0.14)"
                  : "0 0 0 4px rgba(59,130,246,0.14)",
            }}
          />
          {plan === "pro" ? "Pro plan" : "Free plan"}
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#94a3b8",
          fontWeight: 900,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: 12,
          paddingLeft: 4,
        }}
      >
        Workspace
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <SidebarButton
          label="Dashboard"
          active={activeNav === "dashboard"}
          onClick={() => onNavChange("dashboard")}
        />
        <SidebarButton
          label="Extract"
          active={activeNav === "extract"}
          onClick={() => onNavChange("extract")}
        />
        <SidebarButton
          label="Tasks"
          active={activeNav === "tasks"}
          onClick={() => onNavChange("tasks")}
        />
      </div>
    </>
  );
}

function getDisplayName(emailValue: string) {
  if (!emailValue) return "Connected user";
  const base = emailValue.split("@")[0] || "Connected user";
  return base.length > 28 ? `${base.slice(0, 28)}...` : base;
}