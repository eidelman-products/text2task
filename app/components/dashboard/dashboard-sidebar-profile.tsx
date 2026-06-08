"use client";

import { useState } from "react";
import { trackBeginCheckout } from "@/lib/analytics/events";
import SidebarButton from "./sidebar-button";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardTransitions,
  dashboardTypography,
} from "./ui/tokens";

type DashboardNav = "dashboard" | "extract" | "tasks";

export default function DashboardSidebarProfile({
  email,
  plan,
  activeNav,
  onNavChange,
}: {
  email: string;
  plan: "free" | "pro";
  activeNav: DashboardNav;
  onNavChange: (nav: DashboardNav) => void;
}) {
  const [upgradeHovered, setUpgradeHovered] = useState(false);
  const isPro = plan === "pro";

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
        trackBeginCheckout();
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
    <aside style={sidebarStyle}>
      <div style={topAccentStyle} />

      <div style={topAreaStyle}>
        <div style={brandBlockStyle}>
          <div style={logoFrameStyle}>
            <img
              src="/text2task-logo.png"
              alt="Text2Task"
              style={logoImageStyle}
            />
          </div>

          <p style={brandDescriptionStyle}>
            Turn messy messages into structured work.
          </p>
        </div>

        <nav style={navBlockStyle} aria-label="Workspace navigation">
          <div style={navLabelStyle}>Workspace</div>

          <div style={navListStyle}>
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
        </nav>
      </div>

      <div style={bottomAreaStyle}>
        <div style={workspaceCardStyle}>
          <div style={workspaceTopStyle}>
            <div style={avatarStyle}>{getInitials(email)}</div>

            <div style={workspaceTextStyle}>
              <div style={workspaceNameStyle}>{getDisplayName(email)}</div>
              <div style={workspaceMetaStyle}>
                {isPro ? "Pro workspace" : "Free workspace"}
              </div>
            </div>

            {isPro ? <span style={workspacePlanBadgeStyle}>Pro</span> : null}
          </div>

          {!isPro ? (
            <button
              type="button"
              onClick={handleUpgrade}
              onMouseEnter={() => setUpgradeHovered(true)}
              onMouseLeave={() => setUpgradeHovered(false)}
              style={{
                ...upgradeButtonStyle,
                transform: upgradeHovered ? "translateY(-1px)" : "translateY(0)",
                boxShadow: upgradeHovered
                  ? "0 14px 28px rgba(37, 99, 235, 0.2)"
                  : "0 8px 18px rgba(37, 99, 235, 0.13)",
              }}
            >
              Upgrade to Pro
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function getDisplayName(emailValue: string) {
  if (!emailValue) return "Connected user";

  const base = emailValue.split("@")[0] || "Connected user";
  const clean = base.replace(/[._-]+/g, " ").trim();

  if (!clean) return "Connected user";

  return clean.length > 24 ? `${clean.slice(0, 24)}...` : clean;
}

function getInitials(emailValue: string) {
  const name = getDisplayName(emailValue);
  const words = name.split(" ").filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

const sidebarStyle: React.CSSProperties = {
  minHeight: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  padding: `${dashboardSpacing[5]}px ${dashboardSpacing[4]}px ${dashboardSpacing[4]}px`,
  position: "relative",
  overflow: "hidden",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,252,0.96) 62%, rgba(239,246,255,0.44) 100%)",
};

const topAccentStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 18,
  right: 18,
  height: 2,
  borderRadius: 999,
  background:
    "linear-gradient(90deg, rgba(37,99,235,0) 0%, rgba(37,99,235,0.42) 28%, rgba(37,99,235,0.16) 68%, rgba(37,99,235,0) 100%)",
  pointerEvents: "none",
};

const topAreaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  alignContent: "start",
  gap: dashboardSpacing[7],
};

const brandBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[2],
  padding: `0 ${dashboardSpacing[1]}px`,
};

const logoFrameStyle: React.CSSProperties = {
  width: 178,
  height: 46,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  overflow: "hidden",
};

const logoImageStyle: React.CSSProperties = {
  width: 178,
  height: 46,
  objectFit: "contain",
  objectPosition: "left center",
  display: "block",
};

const brandDescriptionStyle: React.CSSProperties = {
  margin: 0,
  color: dashboardColors.text.muted,
  fontSize: 12.25,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.semibold,
  maxWidth: 204,
};

const navBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[2],
};

const navLabelStyle: React.CSSProperties = {
  color: dashboardColors.text.subtle,
  fontSize: 10,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  paddingLeft: dashboardSpacing[1],
};

const navListStyle: React.CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[2],
};

const bottomAreaStyle: React.CSSProperties = {
  marginTop: dashboardSpacing[4],
};

const workspaceCardStyle: React.CSSProperties = {
  borderRadius: dashboardRadii.xl,
  padding: "10px",
  border: "1px solid rgba(226, 232, 240, 0.86)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.84) 100%)",
  boxShadow:
    "0 12px 28px rgba(15, 23, 42, 0.055), inset 0 1px 0 rgba(255,255,255,0.94)",
  display: "grid",
  gap: 9,
};

const workspaceTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: dashboardSpacing[2],
  minWidth: 0,
};

const avatarStyle: React.CSSProperties = {
  width: 31,
  height: 31,
  borderRadius: dashboardRadii.full,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  color: dashboardColors.primary[700],
  background:
    "linear-gradient(135deg, rgba(239,246,255,0.98), rgba(255,255,255,0.98))",
  border: "1px solid rgba(191, 219, 254, 0.9)",
  fontSize: 10.5,
  fontWeight: dashboardTypography.weight.black,
  boxShadow: "0 7px 14px rgba(37, 99, 235, 0.07)",
};

const workspaceTextStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 2,
  flex: 1,
};

const workspaceNameStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 12.5,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.black,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const workspaceMetaStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 10.5,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.medium,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const workspacePlanBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 20,
  padding: "0 8px",
  borderRadius: dashboardRadii.full,
  color: dashboardColors.primary[700],
  background: dashboardColors.primary[50],
  border: `1px solid ${dashboardColors.primary[100]}`,
  fontSize: 9.5,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "0.045em",
  textTransform: "uppercase",
  flexShrink: 0,
};

const upgradeButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 34,
  border: "none",
  borderRadius: dashboardRadii.lg,
  color: dashboardColors.text.inverse,
  background: `linear-gradient(135deg, ${dashboardColors.primary[600]} 0%, ${dashboardColors.primary[500]} 100%)`,
  fontSize: 12.25,
  fontWeight: dashboardTypography.weight.black,
  cursor: "pointer",
  transition: `transform ${dashboardTransitions.base}, box-shadow ${dashboardTransitions.base}`,
};