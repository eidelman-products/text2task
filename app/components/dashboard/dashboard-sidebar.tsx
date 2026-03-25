"use client";

import { useState } from "react";
import type { ActiveNav, SmartViewIds, SmartViews } from "./dashboard-types";

type DashboardTopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod?: "url" | "mailto" | null;
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
  setError: (value: string) => void;
  setSuccess: (value: string) => void;
  weeklyCleanupUsed: number;
  remainingWeeklyCleanup: number;
  freeWeeklyLimit: number;
  weeklyUnreadUsed: number;
  remainingWeeklyUnread: number;
  freeWeeklyUnreadLimit: number;
  scanResult: DashboardScanResult | null;
  onUpgradeClick: () => void;
};

function getInitial(email: string) {
  if (!email) return "U";
  return email[0]?.toUpperCase() || "U";
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
      ? "1px solid rgba(148,163,184,0.20)"
      : "1px solid transparent",
    background: isActive
      ? "linear-gradient(90deg, rgba(37,99,235,0.34) 0%, rgba(59,130,246,0.16) 100%)"
      : isHovered
      ? "linear-gradient(90deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)"
      : "transparent",
    color: "#e5eefc",
    borderRadius: "18px",
    padding: "14px 16px",
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
    transform: isHovered ? "translateX(2px)" : "translateX(0)",
    boxShadow: isActive
      ? "0 10px 24px rgba(37,99,235,0.12)"
      : isHovered
      ? "0 8px 18px rgba(15,23,42,0.10)"
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
  weeklyCleanupUsed,
  remainingWeeklyCleanup,
  freeWeeklyLimit,
  weeklyUnreadUsed,
  remainingWeeklyUnread,
  freeWeeklyUnreadLimit,
  scanResult,
  onUpgradeClick,
}: DashboardSidebarProps) {
  const smartViews = scanResult?.smartViews || {
    unread: 0,
    social: 0,
    jobSearch: 0,
    shopping: 0,
  };

  const cleanupPercent =
    plan === "pro"
      ? 100
      : Math.min(100, (weeklyCleanupUsed / Math.max(freeWeeklyLimit, 1)) * 100);

  const unreadPercent =
    plan === "pro"
      ? 100
      : Math.min(100, (weeklyUnreadUsed / Math.max(freeWeeklyUnreadLimit, 1)) * 100);

  const [upgradeHovered, setUpgradeHovered] = useState(false);

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
          "radial-gradient(circle at top left, rgba(59,130,246,0.18) 0%, rgba(15,23,42,1) 22%, rgba(2,8,23,1) 100%)",
        color: "#ffffff",
        padding: "20px 18px",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.06)",
        backdropFilter: "blur(10px)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "18px",
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
            boxShadow: "0 10px 20px rgba(99,102,241,0.32)",
            flexShrink: 0,
          }}
        >
          {getInitial(email)}
        </div>

        <div style={{ minWidth: 0 }}>
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
            {email.split("@")[0] || "Connected User"}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "rgba(226,232,240,0.88)",
              wordBreak: "break-word",
            }}
          >
            {email}
          </div>
        </div>
      </div>

      <div
        style={{
          borderRadius: "24px",
          padding: "18px",
          background: "rgba(15,23,42,0.56)",
          border: "1px solid rgba(255,255,255,0.08)",
          marginBottom: "14px",
          boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 900,
            letterSpacing: "0.04em",
            color: "#f8fafc",
            marginBottom: "12px",
          }}
        >
          🔒 Privacy First
        </div>

        <div
          style={{
            fontSize: "14px",
            lineHeight: 1.75,
            color: "rgba(226,232,240,0.95)",
            fontWeight: 600,
          }}
        >
          InboxShaper only scans Gmail metadata and never stores email content.
          All actions require your confirmation. You can disconnect Gmail anytime.
        </div>

        <div
          style={{
            marginTop: "14px",
            fontSize: "13px",
            fontWeight: 900,
            color: plan === "pro" ? "#86efac" : "#60a5fa",
          }}
        >
          {plan === "pro" ? "PRO PLAN ACTIVE" : "FREE PLAN"}
        </div>
      </div>

      <div
        style={{
          borderRadius: "24px",
          padding: "18px",
          background:
            plan === "pro"
              ? "linear-gradient(180deg, rgba(34,197,94,0.22) 0%, rgba(15,23,42,0.42) 100%)"
              : "linear-gradient(180deg, rgba(30,64,175,0.34) 0%, rgba(15,23,42,0.42) 100%)",
          border:
            plan === "pro"
              ? "1px solid rgba(34,197,94,0.35)"
              : "1px solid rgba(59,130,246,0.45)",
          marginBottom: "14px",
          boxShadow: "0 18px 34px rgba(2,8,23,0.22)",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 800,
            color: plan === "pro" ? "#86efac" : "#93c5fd",
            marginBottom: "12px",
          }}
        >
          Weekly cleanup used
        </div>

        <div
          style={{
            fontSize: "30px",
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            marginBottom: "14px",
          }}
        >
          {plan === "pro" ? "Unlimited" : `${weeklyCleanupUsed} / ${freeWeeklyLimit}`}
        </div>

        <div
          style={{
            width: "100%",
            height: "8px",
            background: "rgba(148,163,184,0.28)",
            borderRadius: "999px",
            overflow: "hidden",
            marginBottom: "12px",
            boxShadow: "inset 0 1px 2px rgba(15,23,42,0.12)",
          }}
        >
          <div
            style={{
              width: `${cleanupPercent}%`,
              height: "100%",
              borderRadius: "999px",
              background:
                plan === "pro"
                  ? "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)"
                  : "linear-gradient(90deg, #60a5fa 0%, #3b82f6 100%)",
              boxShadow:
                plan === "pro"
                  ? "0 0 16px rgba(34,197,94,0.22)"
                  : "0 0 16px rgba(59,130,246,0.22)",
              transition: "width 180ms ease",
            }}
          />
        </div>

        <div
          style={{
            fontSize: "14px",
            fontWeight: 800,
            color: "#e2e8f0",
          }}
        >
          {plan === "pro"
            ? "Unlimited cleanup available"
            : `${remainingWeeklyCleanup} cleanup emails left this week`}
        </div>
      </div>

      <div
        style={{
          borderRadius: "24px",
          padding: "18px",
          background:
            plan === "pro"
              ? "linear-gradient(180deg, rgba(16,185,129,0.18) 0%, rgba(15,23,42,0.42) 100%)"
              : "linear-gradient(180deg, rgba(8,145,178,0.26) 0%, rgba(15,23,42,0.42) 100%)",
          border:
            plan === "pro"
              ? "1px solid rgba(16,185,129,0.30)"
              : "1px solid rgba(34,211,238,0.35)",
          marginBottom: "22px",
          boxShadow: "0 18px 34px rgba(2,8,23,0.18)",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 800,
            color: plan === "pro" ? "#6ee7b7" : "#67e8f9",
            marginBottom: "12px",
          }}
        >
          Weekly unread actions used
        </div>

        <div
          style={{
            fontSize: "30px",
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            marginBottom: "14px",
          }}
        >
          {plan === "pro" ? "Unlimited" : `${weeklyUnreadUsed} / ${freeWeeklyUnreadLimit}`}
        </div>

        <div
          style={{
            width: "100%",
            height: "8px",
            background: "rgba(148,163,184,0.28)",
            borderRadius: "999px",
            overflow: "hidden",
            marginBottom: "12px",
            boxShadow: "inset 0 1px 2px rgba(15,23,42,0.12)",
          }}
        >
          <div
            style={{
              width: `${unreadPercent}%`,
              height: "100%",
              borderRadius: "999px",
              background:
                plan === "pro"
                  ? "linear-gradient(90deg, #10b981 0%, #059669 100%)"
                  : "linear-gradient(90deg, #22d3ee 0%, #06b6d4 100%)",
              boxShadow:
                plan === "pro"
                  ? "0 0 16px rgba(16,185,129,0.20)"
                  : "0 0 16px rgba(34,211,238,0.18)",
              transition: "width 180ms ease",
            }}
          />
        </div>

        <div
          style={{
            fontSize: "14px",
            fontWeight: 800,
            color: "#e2e8f0",
          }}
        >
          {plan === "pro"
            ? "Unlimited unread actions available"
            : `${remainingWeeklyUnread} unread actions left this week`}
        </div>
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
          label="Unread"
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
            Full Scan, unlimited cleanup, unlimited unread actions, bulk actions,
            and better progress.
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
              padding: "16px 18px",
              background: "linear-gradient(135deg, #2563eb 0%, #4f8cff 100%)",
              color: "#ffffff",
              fontWeight: 900,
              fontSize: "16px",
              cursor: "pointer",
              boxShadow: upgradeHovered
                ? "0 20px 36px rgba(37,99,235,0.40)"
                : "0 16px 30px rgba(37,99,235,0.32)",
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
            Pro is active. Full Scan and unlimited cleanup are unlocked.
          </div>
        </div>
      )}
    </aside>
  );
}