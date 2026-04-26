"use client";

import { useState } from "react";
import type { ActiveNav, SmartViewIds, SmartViews } from "./dashboard-types";

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
  activeNav: ActiveNav;
  setActiveNav: (nav: ActiveNav) => void;
  scanResult: DashboardScanResult | null;
  onUpgradeClick: () => void;
};

function getInitial(email: string) {
  if (!email) return "U";
  return email[0]?.toUpperCase() || "U";
}

function getDisplayName(email: string) {
  if (!email) return "Connected User";
  return email.split("@")[0] || "Connected User";
}

function badgeStyle(isActive: boolean) {
  return {
    minWidth: "34px",
    height: "28px",
    borderRadius: "999px",
    background: isActive
      ? "rgba(255,255,255,0.18)"
      : "rgba(255,255,255,0.10)",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 10px",
    flexShrink: 0 as const,
    boxShadow: isActive ? "0 6px 14px rgba(15,23,42,0.12)" : "none",
    transition: "all 160ms ease",
  };
}

function navItemStyle(isActive: boolean, isHovered: boolean) {
  const active = isActive || isHovered;

  return {
    width: "100%",
    border: isActive
      ? "1px solid rgba(96,165,250,0.30)"
      : active
      ? "1px solid rgba(148,163,184,0.18)"
      : "1px solid transparent",
    background: isActive
      ? "linear-gradient(90deg, rgba(37,99,235,0.30) 0%, rgba(59,130,246,0.12) 100%)"
      : isHovered
      ? "linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%)"
      : "transparent",
    color: "#e5eefc",
    borderRadius: "16px",
    padding: "13px 16px",
    fontSize: "15px",
    fontWeight: 800,
    cursor: "pointer" as const,
    textAlign: "left" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    transition:
      "all 160ms ease, transform 120ms ease, box-shadow 120ms ease",
    transform: isHovered ? "translateX(3px)" : "translateX(0)",
    boxShadow: isActive
      ? "0 10px 22px rgba(37,99,235,0.10)"
      : isHovered
      ? "0 6px 16px rgba(15,23,42,0.08)"
      : "none",
  };
}

type SidebarNavButtonProps = {
  label: string;
  count?: number | string;
  isActive: boolean;
  onClick: () => void;
};

function SidebarNavButton({
  label,
  count,
  isActive,
  onClick,
}: SidebarNavButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      style={navItemStyle(isActive, hovered)}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span>{label}</span>
      {count !== undefined ? <span style={badgeStyle(isActive)}>{count}</span> : null}
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
  const smartViews = scanResult?.smartViews || {
    unread: 0,
    social: 0,
    jobSearch: 0,
    shopping: 0,
  };

  const [upgradeHovered, setUpgradeHovered] = useState(false);

  const displayName = getDisplayName(email);

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
          "radial-gradient(circle at top left, rgba(59,130,246,0.14) 0%, rgba(15,23,42,1) 22%, rgba(2,8,23,1) 100%)",
        color: "#ffffff",
        padding: "18px 14px 20px",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.05)",
        backdropFilter: "blur(10px)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "999px",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: "18px",
            boxShadow: "0 10px 20px rgba(99,102,241,0.28)",
            flexShrink: 0,
          }}
        >
          {getInitial(email)}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: "15px",
              lineHeight: 1.2,
              color: "#ffffff",
              marginBottom: "4px",
              wordBreak: "break-word",
            }}
          >
            {displayName}
          </div>

          <div
            style={{
              fontSize: "13px",
              color: "rgba(226,232,240,0.80)",
              wordBreak: "break-word",
              marginBottom: "8px",
            }}
          >
            {email}
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 10px",
              borderRadius: "999px",
              background:
                plan === "pro"
                  ? "rgba(34,197,94,0.12)"
                  : "rgba(59,130,246,0.12)",
              border:
                plan === "pro"
                  ? "1px solid rgba(34,197,94,0.22)"
                  : "1px solid rgba(59,130,246,0.22)",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.05em",
              color: plan === "pro" ? "#86efac" : "#93c5fd",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "999px",
                background: plan === "pro" ? "#22c55e" : "#60a5fa",
                boxShadow:
                  plan === "pro"
                    ? "0 0 10px rgba(34,197,94,0.40)"
                    : "0 0 10px rgba(96,165,250,0.34)",
              }}
            />
            {plan === "pro" ? "PRO PLAN ACTIVE" : "FREE PLAN"}
          </div>
        </div>
      </div>

      <div
        style={{
          borderRadius: "18px",
          padding: "11px 12px",
          background: "rgba(15,23,42,0.46)",
          border: "1px solid rgba(255,255,255,0.07)",
          marginBottom: "10px",
          boxShadow: "0 8px 18px rgba(0,0,0,0.14)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "6px",
          }}
        >
          <span style={{ fontSize: "13px" }}>🔒</span>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing: "0.03em",
              color: "#f8fafc",
            }}
          >
            Privacy First
          </div>
        </div>

        <div
          style={{
            fontSize: "12px",
            lineHeight: 1.45,
            color: "rgba(226,232,240,0.88)",
            fontWeight: 600,
          }}
        >
          InboxShaper scans Gmail metadata only and never stores email content.
        </div>
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "rgba(148,163,184,0.9)",
          fontWeight: 900,
          letterSpacing: "0.08em",
          marginTop: "16px",
          marginBottom: "12px",
        }}
      >
        OVERVIEW
      </div>

      <div style={{ display: "grid", gap: "8px", marginBottom: "22px" }}>
        <SidebarNavButton
          label="Dashboard"
          isActive={activeNav === "dashboard"}
          onClick={() => setActiveNav("dashboard")}
        />
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "rgba(148,163,184,0.9)",
          fontWeight: 900,
          letterSpacing: "0.08em",
          marginBottom: "12px",
        }}
      >
        SMART VIEWS
      </div>

      <div style={{ display: "grid", gap: "8px", marginBottom: "22px" }}>
        <SidebarNavButton
          label="Top Senders"
          count={scanResult?.senderGroups || 0}
          isActive={activeNav === "top-senders"}
          onClick={() => setActiveNav("top-senders")}
        />

        <SidebarNavButton
          label="Promotions"
          count={
            scanResult?.fullInboxPromotionsCount ??
            scanResult?.promotionsFoundInSampleScan ??
            0
          }
          isActive={activeNav === "promotions"}
          onClick={() => setActiveNav("promotions")}
        />

        <SidebarNavButton
          label="Unread Emails"
          count={smartViews.unread}
          isActive={activeNav === "unread"}
          onClick={() => setActiveNav("unread")}
        />

        <SidebarNavButton
          label="Social Notifications"
          count={smartViews.social}
          isActive={activeNav === "social-notifications"}
          onClick={() => setActiveNav("social-notifications")}
        />

        <SidebarNavButton
          label="Job Search"
          count={smartViews.jobSearch}
          isActive={activeNav === "job-search"}
          onClick={() => setActiveNav("job-search")}
        />

        <SidebarNavButton
          label="Online Shopping"
          count={smartViews.shopping}
          isActive={activeNav === "online-shopping"}
          onClick={() => setActiveNav("online-shopping")}
        />
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "rgba(148,163,184,0.9)",
          fontWeight: 900,
          letterSpacing: "0.08em",
          marginBottom: "12px",
        }}
      >
        SYSTEM
      </div>

      <div style={{ display: "grid", gap: "8px", marginBottom: "18px" }}>
        <SidebarNavButton
          label="Privacy & Trust"
          isActive={activeNav === "privacy-trust"}
          onClick={() => setActiveNav("privacy-trust")}
        />
      </div>

      {plan === "free" ? (
        <div
          style={{
            marginTop: "10px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "18px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#e2e8f0",
              marginBottom: "14px",
              lineHeight: 1.6,
            }}
          >
            Full Scan, deeper inbox insights, advanced analytics, and better scan visibility.
          </div>

          <button
            type="button"
            onClick={onUpgradeClick}
            onMouseEnter={() => setUpgradeHovered(true)}
            onMouseLeave={() => setUpgradeHovered(false)}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "18px",
              padding: "14px 16px",
              background: "linear-gradient(135deg, #2563eb 0%, #4f8cff 100%)",
              color: "#ffffff",
              fontWeight: 900,
              fontSize: "16px",
              cursor: "pointer",
              boxShadow: upgradeHovered
                ? "0 10px 20px rgba(37,99,235,0.30)"
                : "0 8px 16px rgba(37,99,235,0.24)",
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
            marginTop: "10px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "18px",
          }}
        >
          <div
            style={{
              borderRadius: "18px",
              padding: "16px 16px",
              background: "rgba(34,197,94,0.14)",
              border: "1px solid rgba(34,197,94,0.24)",
              color: "#dcfce7",
              fontSize: "14px",
              fontWeight: 800,
              lineHeight: 1.6,
            }}
          >
            Pro is active. Full Scan and advanced inbox analytics are unlocked.
          </div>
        </div>
      )}
    </aside>
  );
}