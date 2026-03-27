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
  onDisconnect,
  onLogout,
  isDisconnecting = false,
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

  const avatarLetter = userEmail?.trim()?.charAt(0)?.toUpperCase() || "Y";

  return (
    <div
      style={{
        marginBottom: "18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "54px",
            fontWeight: 800,
            color: "#0f172a",
            lineHeight: 0.98,
            marginBottom: "8px",
          }}
        >
          InboxShaper Dashboard
        </div>

        <div
          style={{
            color: "#64748b",
            fontSize: "18px",
            lineHeight: 1.7,
          }}
        >
          Analyze your inbox, review results, and clean email faster.
        </div>
      </div>

      <div
        ref={menuRef}
        style={{
          position: "relative",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          style={{
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            color: "#0f172a",
            borderRadius: "999px",
            height: "48px",
            minWidth: "48px",
            padding: "0 14px 0 10px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "999px",
              background: "#f59e0b",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            {avatarLetter}
          </div>

          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
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
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "56px",
              right: 0,
              width: "240px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "18px",
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.14)",
              padding: "10px",
              zIndex: 50,
            }}
          >
            <div
              style={{
                padding: "10px 12px 12px 12px",
                borderBottom: "1px solid #f1f5f9",
                marginBottom: "6px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#94a3b8",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Account
              </div>

              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#0f172a",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userEmail || "Signed in user"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onBilling();
              }}
              role="menuitem"
              style={menuItemStyle}
            >
              Manage Subscription
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDisconnect();
              }}
              disabled={isDisconnecting}
              role="menuitem"
              style={{
                ...menuItemStyle,
                color: "#dc2626",
                opacity: isDisconnecting ? 0.6 : 1,
                cursor: isDisconnecting ? "not-allowed" : "pointer",
              }}
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect Gmail"}
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

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: "12px",
  padding: "12px 14px",
  fontSize: "14px",
  fontWeight: 600,
  textAlign: "left",
  cursor: "pointer",
  display: "block",
};