"use client";

import { useState } from "react";
import type { SmartViewIds, SmartViews } from "./dashboard-types";

type SidebarNav = "dashboard" | "extract" | "tasks";

type DashboardTopSender = {
  sender: string;
  count: number;
  ids?: string[];
};

type DashboardScanResult = {
  mode?: "sample" | "full";
  scanned: number;
  totalInboxCount?: number | null;
  topSenders: DashboardTopSender[];
  promotionsSenders: DashboardTopSender[];
  promotionsFound: number;
  promotionsFoundInSampleScan: number;
  fullInboxPromotionsCount: number | null;
  senderGroups: number;
  largestSenderCount: number;
  healthScore: number;
  smartViews: SmartViews;
  smartViewIds: SmartViewIds;
  completed?: boolean;
};

type DashboardSidebarProps = {
  email: string;
  plan: "free" | "pro";
  activeNav: SidebarNav;
setActiveNav: (nav: SidebarNav) => void;
  scanResult: DashboardScanResult | null;
  onUpgradeClick: () => void;
};

function getDisplayName(email: string) {
  if (!email) return "Connected User";
  return email.split("@")[0] || "Connected User";
}

function navItemStyle(isActive: boolean, isHovered: boolean) {
  return {
    width: "100%",
    border: isActive
      ? "1px solid rgba(96,165,250,0.45)"
      : isHovered
      ? "1px solid rgba(148,163,184,0.22)"
      : "1px solid transparent",
    background: isActive
      ? "linear-gradient(90deg, rgba(37,99,235,0.14) 0%, rgba(59,130,246,0.06) 100%)"
      : isHovered
      ? "rgba(15,23,42,0.035)"
      : "transparent",
    color: isActive ? "#2563eb" : "#334155",
    borderRadius: "18px",
    padding: "14px 16px",
    fontSize: "16px",
    fontWeight: 900,
    cursor: "pointer" as const,
    textAlign: "left" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "12px",
    transition: "all 160ms ease",
    boxShadow: isActive
      ? "0 10px 22px rgba(37,99,235,0.08)"
      : isHovered
      ? "0 8px 18px rgba(15,23,42,0.04)"
      : "none",
  };
}

type SidebarNavButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function SidebarNavButton({ label, isActive, onClick }: SidebarNavButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      style={navItemStyle(isActive, hovered)}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "999px",
          background: isActive ? "#60a5fa" : "#cbd5e1",
          boxShadow: isActive ? "0 0 0 6px rgba(96,165,250,0.16)" : "none",
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </button>
  );
}

export default function DashboardSidebar({
  email,
  plan,
  activeNav,
  setActiveNav,
  scanResult,
  onUpgradeClick,
}: DashboardSidebarProps) {
  const [upgradeHovered, setUpgradeHovered] = useState(false);
  const displayName = getDisplayName(email);

  void scanResult;

  return (
    <aside
      style={{
        width: "300px",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
        flexShrink: 0,
        background:
          "linear-gradient(180deg, #ffffff 0%, #f8fbff 55%, #f1f5ff 100%)",
        color: "#0f172a",
        padding: "22px 20px 18px",
        boxShadow: "inset -1px 0 0 rgba(15,23,42,0.08)",
        borderRight: "1px solid rgba(226,232,240,0.95)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "999px",
              background: "linear-gradient(135deg, #6366f1, #60a5fa)",
              boxShadow: "0 0 0 8px rgba(99,102,241,0.10)",
            }}
          />

          <div
            style={{
              fontSize: 30,
              fontWeight: 950,
              color: "#0f172a",
              letterSpacing: "-0.06em",
              lineHeight: 1,
            }}
          >
            Text2Task
          </div>
        </div>

        <div
          style={{
            fontSize: 15,
            lineHeight: 1.55,
            color: "#64748b",
            fontWeight: 650,
            marginBottom: 24,
          }}
        >
          Turn messy messages into structured work.
        </div>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 950,
              color: "#0f172a",
              marginBottom: 7,
              wordBreak: "break-word",
            }}
          >
            {displayName}
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#64748b",
              fontWeight: 650,
              wordBreak: "break-word",
              marginBottom: 12,
            }}
          >
            {email}
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 13px",
              borderRadius: "999px",
              background: plan === "pro" ? "#dcfce7" : "#eff6ff",
              border:
                plan === "pro"
                  ? "1px solid rgba(34,197,94,0.28)"
                  : "1px solid rgba(59,130,246,0.22)",
              fontSize: 12,
              fontWeight: 950,
              letterSpacing: "0.02em",
              color: plan === "pro" ? "#166534" : "#2563eb",
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "999px",
                background: plan === "pro" ? "#22c55e" : "#60a5fa",
                boxShadow:
                  plan === "pro"
                    ? "0 0 10px rgba(34,197,94,0.42)"
                    : "0 0 10px rgba(96,165,250,0.34)",
              }}
            />
            {plan === "pro" ? "PRO PLAN" : "FREE PLAN"}
          </div>
        </div>
      </div>

      <div
        style={{
          height: 1,
          background: "rgba(203,213,225,0.9)",
          marginBottom: 18,
        }}
      />

      <div
        style={{
          fontSize: 12,
          color: "#94a3b8",
          fontWeight: 950,
          letterSpacing: "0.10em",
          marginBottom: 12,
        }}
      >
        WORKSPACE
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <SidebarNavButton
          label="Dashboard"
          isActive={activeNav === "dashboard"}
          onClick={() => setActiveNav("dashboard")}
        />

        <SidebarNavButton
          label="Extract"
          isActive={activeNav === "extract"}
          onClick={() => setActiveNav("extract")}
        />

        <SidebarNavButton
          label="Tasks"
          isActive={activeNav === "tasks"}
          onClick={() => setActiveNav("tasks")}
        />
      </div>

      

      {plan === "free" ? (
        <div
          style={{
            marginTop: 28,
            borderRadius: 22,
            padding: 18,
            background:
              "linear-gradient(180deg, rgba(79,70,229,0.10), rgba(37,99,235,0.06))",
            border: "1px solid rgba(99,102,241,0.18)",
            boxShadow:
              "0 18px 36px rgba(37,99,235,0.08), inset 0 1px 0 rgba(255,255,255,0.78)",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: "rgba(99,102,241,0.14)",
              color: "#4f46e5",
              fontSize: 20,
              fontWeight: 950,
              marginBottom: 12,
            }}
          >
            ⚡
          </div>

          <div
            style={{
              fontSize: 16,
              fontWeight: 950,
              color: "#0f172a",
              marginBottom: 8,
              letterSpacing: "-0.02em",
            }}
          >
            Upgrade to Pro
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: "#64748b",
              fontWeight: 650,
              marginBottom: 14,
            }}
          >
            Unlock unlimited extracts and CSV export.
          </div>

          <div
            style={{
              fontSize: 24,
              fontWeight: 950,
              color: "#0f172a",
              letterSpacing: "-0.04em",
              marginBottom: 14,
            }}
          >
            $12.90
            <span
              style={{
                fontSize: 13,
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
            onClick={onUpgradeClick}
            onMouseEnter={() => setUpgradeHovered(true)}
            onMouseLeave={() => setUpgradeHovered(false)}
            style={{
              width: "100%",
              minHeight: 44,
              border: "none",
              borderRadius: 14,
              padding: "0 16px",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "#ffffff",
              fontWeight: 950,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: upgradeHovered
                ? "0 16px 30px rgba(79,70,229,0.32)"
                : "0 12px 24px rgba(79,70,229,0.24)",
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
            marginTop: 28,
            borderRadius: 22,
            padding: 18,
            background: "linear-gradient(180deg, #ecfdf5, #f0fdf4)",
            border: "1px solid rgba(34,197,94,0.22)",
            boxShadow:
              "0 18px 36px rgba(34,197,94,0.08), inset 0 1px 0 rgba(255,255,255,0.82)",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: "rgba(34,197,94,0.16)",
              color: "#15803d",
              fontSize: 20,
              fontWeight: 950,
              marginBottom: 12,
            }}
          >
            ✓
          </div>

          <div
            style={{
              fontSize: 16,
              fontWeight: 950,
              color: "#14532d",
              marginBottom: 8,
              letterSpacing: "-0.02em",
            }}
          >
            Pro plan active
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: "#166534",
              fontWeight: 700,
            }}
          >
            Unlimited extracts and CSV export are unlocked.
          </div>
        </div>
      )}
    </aside>
  );
}