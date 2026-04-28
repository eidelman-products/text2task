"use client";

import { useState } from "react";
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
  const [upgradeHovered, setUpgradeHovered] = useState(false);

  async function handleUpgrade() {
    try {
      const res = await fetch("/api/creem/checkout", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to start checkout");
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("Checkout URL missing");
    } catch (error) {
      console.error(error);
      alert("Failed to start checkout");
    }
  }

  return (
    <div
      style={{
        height: "100%",
        minHeight: "calc(100vh - 44px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1 }}>
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
      </div>

      {plan === "free" ? (
        <div
          style={{
            marginTop: 18,
            borderRadius: 18,
            padding: 13,
            background:
              "linear-gradient(180deg, rgba(79,70,229,0.10), rgba(37,99,235,0.06))",
            border: "1px solid rgba(99,102,241,0.18)",
            boxShadow:
              "0 12px 24px rgba(37,99,235,0.07), inset 0 1px 0 rgba(255,255,255,0.78)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 13,
              display: "grid",
              placeItems: "center",
              background: "rgba(99,102,241,0.14)",
              color: "#4f46e5",
              fontSize: 18,
              fontWeight: 950,
              marginBottom: 9,
            }}
          >
            ⚡
          </div>

          <div
            style={{
              fontSize: 15,
              fontWeight: 950,
              color: "#0f172a",
              marginBottom: 6,
              letterSpacing: "-0.02em",
            }}
          >
            Upgrade to Pro
          </div>

          <div
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              color: "#64748b",
              fontWeight: 650,
              marginBottom: 10,
            }}
          >
            Unlimited extracts and CSV export.
          </div>

          <div
            style={{
              fontSize: 20,
              fontWeight: 950,
              color: "#0f172a",
              letterSpacing: "-0.04em",
              marginBottom: 11,
            }}
          >
            $12.90
            <span
              style={{
                fontSize: 12,
                color: "#64748b",
                fontWeight: 750,
                marginLeft: 4,
              }}
            >
              / month
            </span>
          </div>

          <button
            type="button"
            onClick={handleUpgrade}
            onMouseEnter={() => setUpgradeHovered(true)}
            onMouseLeave={() => setUpgradeHovered(false)}
            style={{
              width: "100%",
              minHeight: 38,
              border: "none",
              borderRadius: 13,
              padding: "0 14px",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "#ffffff",
              fontWeight: 950,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: upgradeHovered
                ? "0 14px 26px rgba(79,70,229,0.30)"
                : "0 10px 20px rgba(79,70,229,0.22)",
              transform: upgradeHovered ? "translateY(-2px)" : "translateY(0)",
              transition: "all 180ms ease",
            }}
          >
            Upgrade to Pro
          </button>
        </div>
      ) : (
        <div
          style={{
            marginTop: 18,
            borderRadius: 18,
            padding: 13,
            background: "linear-gradient(180deg, #ecfdf5, #f0fdf4)",
            border: "1px solid rgba(34,197,94,0.22)",
            boxShadow:
              "0 12px 24px rgba(34,197,94,0.07), inset 0 1px 0 rgba(255,255,255,0.82)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 13,
              display: "grid",
              placeItems: "center",
              background: "rgba(34,197,94,0.16)",
              color: "#15803d",
              fontSize: 18,
              fontWeight: 950,
              marginBottom: 9,
            }}
          >
            ✓
          </div>

          <div
            style={{
              fontSize: 15,
              fontWeight: 950,
              color: "#14532d",
              marginBottom: 6,
              letterSpacing: "-0.02em",
            }}
          >
            Pro plan active
          </div>

          <div
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              color: "#166534",
              fontWeight: 700,
            }}
          >
            Unlimited extracts and CSV export are unlocked.
          </div>
        </div>
      )}
    </div>
  );
}

function getDisplayName(emailValue: string) {
  if (!emailValue) return "Connected user";
  const base = emailValue.split("@")[0] || "Connected user";
  return base.length > 28 ? `${base.slice(0, 28)}...` : base;
}