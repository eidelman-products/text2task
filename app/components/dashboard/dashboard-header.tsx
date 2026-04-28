"use client";

import { useEffect, useRef, useState } from "react";

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
  onLogout,
  isLoggingOut = false,
}: DashboardHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const avatarLetter = userEmail?.trim()?.charAt(0)?.toUpperCase() || "U";

  return (
    <div style={headerWrapStyle}>
      <div>
        <div style={titleStyle}>Dashboard</div>

        <div style={subtitleStyle}>
          See what needs attention now and track your revenue with a cleaner,
          sharper workspace.
        </div>
      </div>

      <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          style={profileButtonStyle}
        >
          <div style={avatarStyle}>{avatarLetter}</div>

          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="#64748b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {menuOpen && (
          <div role="menu" style={menuStyle}>
            <div style={accountBoxStyle}>
              <div style={accountLabelStyle}>Account</div>
              <div style={emailStyle}>{userEmail || "Signed in user"}</div>
            </div>

            <button type="button" role="menuitem" style={menuItemStyle}>
              Profile
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onBilling();
              }}
              style={menuItemStyle}
            >
              Billing
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              disabled={isLoggingOut}
              role="menuitem"
              style={{
                ...menuItemStyle,
                color: "#dc2626",
                opacity: isLoggingOut ? 0.6 : 1,
                cursor: isLoggingOut ? "not-allowed" : "pointer",
              }}
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const headerWrapStyle: React.CSSProperties = {
  marginBottom: "18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
};

const titleStyle: React.CSSProperties = {
  fontSize: "42px",
  fontWeight: 950,
  color: "#0f172a",
  lineHeight: 1,
  marginBottom: "8px",
  letterSpacing: "-0.06em",
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "16px",
  lineHeight: 1.65,
};

const profileButtonStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: "999px",
  height: "44px",
  minWidth: "54px",
  padding: "0 12px 0 7px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};

const avatarStyle: React.CSSProperties = {
  width: "30px",
  height: "30px",
  borderRadius: "999px",
  background: "linear-gradient(135deg, #f97316, #f59e0b)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "14px",
  fontWeight: 900,
};

const menuStyle: React.CSSProperties = {
  position: "absolute",
  top: "54px",
  right: 0,
  width: "230px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "18px",
  boxShadow: "0 18px 48px rgba(15, 23, 42, 0.14)",
  padding: "10px",
  zIndex: 50,
};

const accountBoxStyle: React.CSSProperties = {
  padding: "10px 12px 12px",
  borderBottom: "1px solid #f1f5f9",
  marginBottom: "6px",
};

const accountLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  color: "#94a3b8",
  marginBottom: "4px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const emailStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#0f172a",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: "12px",
  padding: "12px 14px",
  fontSize: "14px",
  fontWeight: 750,
  textAlign: "left",
  cursor: "pointer",
  display: "block",
};