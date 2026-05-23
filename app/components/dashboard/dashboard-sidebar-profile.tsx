"use client";

import { useState } from "react";
import { trackBeginCheckout } from "@/lib/analytics/events";
import SidebarButton from "./sidebar-button";

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

        <div style={accountCardStyle}>
          <div style={accountTopStyle}>
            <div style={avatarStyle}>{getInitials(email)}</div>

            <div style={accountTextStyle}>
              <div style={displayNameStyle}>{getDisplayName(email)}</div>
              <div style={emailStyle}>{email}</div>
            </div>
          </div>

          <span
            style={{
              ...planBadgeStyle,
              color: plan === "pro" ? "#166534" : "#4338ca",
              background:
                plan === "pro"
                  ? "linear-gradient(135deg, rgba(240,253,244,0.96), rgba(220,252,231,0.72))"
                  : "linear-gradient(135deg, rgba(238,242,255,0.96), rgba(224,231,255,0.72))",
              border:
                plan === "pro"
                  ? "1px solid rgba(187,247,208,0.9)"
                  : "1px solid rgba(199,210,254,0.9)",
            }}
          >
            <span
              style={{
                ...planDotStyle,
                background: plan === "pro" ? "#22c55e" : "#6366f1",
                boxShadow:
                  plan === "pro"
                    ? "0 0 0 4px rgba(34,197,94,0.12)"
                    : "0 0 0 4px rgba(99,102,241,0.12)",
              }}
            />
            {plan === "pro" ? "Pro plan" : "Free plan"}
          </span>
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
        {plan === "free" ? (
          <div style={upgradeCardStyle}>
            <div style={upgradeHeaderStyle}>
              <div style={upgradeIconStyle}>✦</div>

              <div>
                <div style={upgradeTitleStyle}>Upgrade to Pro</div>
                <div style={upgradeSubtitleStyle}>Unlock the full workspace</div>
              </div>
            </div>

            <div style={priceStyle}>
              $12.90
              <span style={pricePeriodStyle}>/ month</span>
            </div>

            <button
              type="button"
              onClick={handleUpgrade}
              onMouseEnter={() => setUpgradeHovered(true)}
              onMouseLeave={() => setUpgradeHovered(false)}
              style={{
                ...upgradeButtonStyle,
                transform: upgradeHovered ? "translateY(-2px)" : "translateY(0)",
                boxShadow: upgradeHovered
                  ? "0 18px 34px rgba(79,70,229,0.34)"
                  : "0 12px 24px rgba(79,70,229,0.24)",
              }}
            >
              Upgrade now
            </button>
          </div>
        ) : (
          <div style={proDockStyle}>
            <div style={proDockTopStyle}>
              <div style={proDockIconStyle}>✓</div>

              <div style={proDockTextWrapStyle}>
                <div style={proDockTitleStyle}>Pro active</div>
                <div style={proDockTextStyle}>Unlimited workspace</div>
              </div>
            </div>

            <div style={proDockMeterStyle}>
              <span style={proDockMeterFillStyle} />
            </div>
          </div>
        )}
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
  padding: "18px 14px 14px",
  position: "relative",
  overflow: "hidden",
};

const topAreaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  alignContent: "start",
  gap: 14,
};

const brandBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const logoFrameStyle: React.CSSProperties = {
  width: 200,
  height: 61,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  overflow: "hidden",
};

const logoImageStyle: React.CSSProperties = {
  width: 200,
  height: 61,
  objectFit: "contain",
  objectPosition: "left center",
  display: "block",
};

const brandDescriptionStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 12.5,
  lineHeight: 1.45,
  fontWeight: 700,
  maxWidth: 210,
};

const accountCardStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 11,
  border: "1px solid rgba(226,232,240,0.78)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(248,250,252,0.58) 100%)",
  boxShadow:
    "0 12px 24px rgba(15,23,42,0.032), inset 0 1px 0 rgba(255,255,255,0.86)",
  display: "grid",
  gap: 8,
};

const accountTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minWidth: 0,
};

const avatarStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 13,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  color: "#4338ca",
  background: "linear-gradient(135deg, rgba(238,242,255,0.96), #ffffff)",
  border: "1px solid rgba(199,210,254,0.82)",
  fontSize: 11,
  fontWeight: 950,
  boxShadow: "0 8px 16px rgba(79,70,229,0.06)",
};

const accountTextStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 1,
};

const displayNameStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 13.25,
  lineHeight: 1.18,
  fontWeight: 930,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const emailStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 10.75,
  lineHeight: 1.3,
  fontWeight: 720,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const planBadgeStyle: React.CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 8px",
  borderRadius: 999,
  fontSize: 9.75,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: "0.055em",
  textTransform: "uppercase",
};

const planDotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  flexShrink: 0,
};

const navBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 9,
};

const navLabelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  paddingLeft: 3,
};

const navListStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
};

const bottomAreaStyle: React.CSSProperties = {
  marginTop: 14,
};

const upgradeCardStyle: React.CSSProperties = {
  borderRadius: 20,
  padding: 12,
  background:
    "radial-gradient(circle at top left, rgba(255,255,255,0.78), transparent 42%), linear-gradient(135deg, rgba(79,70,229,0.14) 0%, rgba(14,165,233,0.08) 100%)",
  border: "1px solid rgba(129,140,248,0.22)",
  boxShadow:
    "0 16px 32px rgba(79,70,229,0.09), inset 0 1px 0 rgba(255,255,255,0.72)",
  display: "grid",
  gap: 10,
};

const upgradeHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
};

const upgradeIconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 13,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  color: "#ffffff",
  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  boxShadow: "0 10px 22px rgba(79,70,229,0.24)",
  fontSize: 14,
  fontWeight: 950,
};

const upgradeTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 950,
  letterSpacing: "-0.025em",
};

const upgradeSubtitleStyle: React.CSSProperties = {
  marginTop: 2,
  color: "#64748b",
  fontSize: 11,
  fontWeight: 720,
};

const priceStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 20,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: "-0.055em",
};

const pricePeriodStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11.5,
  fontWeight: 760,
  letterSpacing: "-0.02em",
  marginLeft: 4,
};

const upgradeButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 37,
  border: "none",
  borderRadius: 14,
  color: "#ffffff",
  background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
  fontSize: 12.75,
  fontWeight: 950,
  cursor: "pointer",
  transition: "transform 170ms ease, box-shadow 170ms ease",
};

const proDockStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: "10px 11px",
  background:
    "linear-gradient(135deg, rgba(15,23,42,0.035), rgba(255,255,255,0.78)), linear-gradient(135deg, rgba(240,253,244,0.70), rgba(236,253,245,0.48))",
  border: "1px solid rgba(187,247,208,0.72)",
  boxShadow:
    "0 10px 22px rgba(15,23,42,0.035), inset 0 1px 0 rgba(255,255,255,0.86)",
  display: "grid",
  gap: 8,
};

const proDockTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minWidth: 0,
};

const proDockIconStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  color: "#16a34a",
  background:
    "linear-gradient(135deg, rgba(220,252,231,0.94), rgba(240,253,244,0.86))",
  border: "1px solid rgba(187,247,208,0.9)",
  fontSize: 13,
  fontWeight: 950,
  boxShadow: "0 8px 16px rgba(34,197,94,0.08)",
};

const proDockTextWrapStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 1,
};

const proDockTitleStyle: React.CSSProperties = {
  color: "#14532d",
  fontSize: 13,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: "-0.025em",
};

const proDockTextStyle: React.CSSProperties = {
  color: "#166534",
  fontSize: 10.75,
  lineHeight: 1.3,
  fontWeight: 720,
  whiteSpace: "nowrap",
};

const proDockMeterStyle: React.CSSProperties = {
  height: 4,
  borderRadius: 999,
  background: "rgba(187,247,208,0.48)",
  overflow: "hidden",
};

const proDockMeterFillStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #22c55e, #16a34a)",
};
