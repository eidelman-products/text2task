"use client";

import { useEffect, useRef, useState } from "react";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardTypography,
  dashboardZIndex,
} from "./ui/tokens";

type AccountInfo = {
  email: string;
  plan: "free" | "pro";
};

type DashboardUserMenuProps = {
  compact?: boolean;
};

export default function DashboardUserMenu({
  compact = false,
}: DashboardUserMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadAccount() {
      try {
        const res = await fetch("/api/billing/subscription", {
          method: "GET",
          cache: "no-store",
        });

        if (res.status === 401) {
          return;
        }

        const data = await res.json();

        if (res.ok) {
          setAccount({
            email: data.email || "Signed in user",
            plan: data.plan === "pro" ? "pro" : "free",
          });
        }
      } catch (error) {
        console.error("Failed to load account menu:", error);
      }
    }

    void loadAccount();
  }, []);

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

  const email = account?.email || "Signed in user";
  const plan = account?.plan || "free";
  const avatarLetter = email.trim().charAt(0).toUpperCase() || "U";

  async function handleLogout() {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      setLogoutError("");

      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Logout failed");
      }

      window.location.href = "/login";
    } catch (error) {
      console.error(error);
      setIsLoggingOut(false);
      setLogoutError("Logout failed. Please try again.");
    }
  }

  return (
    <div ref={menuRef} style={styles.wrapper}>
      <style>{responsiveCss}</style>

      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="dashboard-user-menu-trigger"
        style={{
          ...styles.profileButton,
          height: compact ? 38 : 42,
          minWidth: compact ? 48 : 56,
          padding: compact ? "0 9px 0 6px" : "0 11px 0 7px",
        }}
      >
        <div
          style={{
            ...styles.avatar,
            width: compact ? 27 : 30,
            height: compact ? 27 : 30,
            fontSize: compact ? 12.5 : 13.5,
          }}
        >
          {avatarLetter}
        </div>

        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke={dashboardColors.text.muted}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {menuOpen ? (
        <div role="menu" className="dashboard-user-menu-panel" style={styles.menu}>
          <div style={styles.topAccent} />

          <div style={styles.accountBox}>
            <div style={styles.accountTopRow}>
              <div style={styles.accountLabel}>Account</div>

              <div
                style={{
                  ...styles.planBadge,
                  ...(plan === "pro" ? styles.proBadge : styles.freeBadge),
                }}
              >
                {plan === "pro" ? "Pro" : "Free"}
              </div>
            </div>

            <div style={styles.email}>{email}</div>
          </div>

          <a
            href="/dashboard/profile"
            role="menuitem"
            className="dashboard-user-menu-item"
            style={styles.menuItem}
          >
            <span style={styles.menuIcon}>◎</span>
            <span>Profile</span>
          </a>

          <a
            href="/dashboard/billing"
            role="menuitem"
            className="dashboard-user-menu-item"
            style={styles.menuItem}
          >
            <span style={styles.menuIcon}>▣</span>
            <span>Billing</span>
          </a>

          <a
            href="/contact?from=dashboard"
            role="menuitem"
            className="dashboard-user-menu-item"
            style={styles.menuItem}
          >
            <span style={styles.menuIcon}>✦</span>
            <span>Contact support</span>
          </a>

          <div style={styles.divider} />

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            role="menuitem"
            className="dashboard-user-menu-item dashboard-user-menu-logout"
            style={{
              ...styles.logoutItem,
              opacity: isLoggingOut ? 0.65 : 1,
              cursor: isLoggingOut ? "not-allowed" : "pointer",
            }}
          >
            <span style={styles.logoutIcon}>↗</span>
            <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
          </button>

          {logoutError ? (
            <div role="alert" style={styles.logoutError}>
              {logoutError}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const responsiveCss = `
  .dashboard-user-menu-trigger {
    transition:
      transform 170ms ease,
      box-shadow 170ms ease,
      border-color 170ms ease,
      background 170ms ease;
  }

  .dashboard-user-menu-trigger:hover {
    transform: translateY(-1px);
    border-color: rgba(191, 219, 254, 0.95) !important;
    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.085), inset 0 1px 0 rgba(255,255,255,0.95) !important;
  }

  .dashboard-user-menu-panel {
    animation: dashboardUserMenuIn 150ms ease-out;
    transform-origin: top right;
  }

  @keyframes dashboardUserMenuIn {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .dashboard-user-menu-item {
    transition:
      background 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .dashboard-user-menu-item:hover {
    background: rgba(239, 246, 255, 0.72) !important;
    color: #1d4ed8 !important;
    transform: translateX(1px);
  }

  .dashboard-user-menu-logout:hover {
    background: rgba(254, 242, 242, 0.76) !important;
    color: #dc2626 !important;
  }

  .dashboard-user-menu-item:focus-visible,
  .dashboard-user-menu-trigger:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.22) !important;
  }
`;

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "relative",
    flexShrink: 0,
  },

  profileButton: {
    border: "1px solid rgba(226, 232, 240, 0.86)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.94))",
    color: dashboardColors.text.primary,
    borderRadius: dashboardRadii.full,
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    boxShadow: `${dashboardShadows.sm}, ${dashboardShadows.inset}`,
  },

  avatar: {
    borderRadius: dashboardRadii.full,
    background:
      "linear-gradient(135deg, rgba(239, 246, 255, 0.98), rgba(255, 255, 255, 0.98))",
    color: dashboardColors.primary[700],
    border: "1px solid rgba(191, 219, 254, 0.92)",
    display: "grid",
    placeItems: "center",
    fontWeight: dashboardTypography.weight.black,
    boxShadow: "0 8px 16px rgba(37, 99, 235, 0.08)",
  },

  menu: {
    position: "absolute",
    top: 52,
    right: 0,
    width: 268,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.985) 0%, rgba(248,250,252,0.965) 100%)",
    border: "1px solid rgba(191, 219, 254, 0.78)",
    borderRadius: 22,
    boxShadow:
      "0 24px 54px rgba(15, 23, 42, 0.13), inset 0 1px 0 rgba(255,255,255,0.95)",
    padding: 9,
    zIndex: dashboardZIndex.toast,
    backdropFilter: "blur(18px)",
    overflow: "hidden",
  },

  topAccent: {
    position: "absolute",
    top: 0,
    left: 18,
    right: 18,
    height: 2,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(37,99,235,0) 0%, rgba(37,99,235,0.38) 32%, rgba(37,99,235,0.14) 70%, rgba(37,99,235,0) 100%)",
    pointerEvents: "none",
  },

  accountBox: {
    padding: "11px 12px 12px",
    borderRadius: 17,
    background:
      "linear-gradient(180deg, rgba(239,246,255,0.56), rgba(255,255,255,0.78))",
    border: "1px solid rgba(191, 219, 254, 0.66)",
    marginBottom: 7,
  },

  accountTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 7,
  },

  accountLabel: {
    fontSize: 10.5,
    fontWeight: dashboardTypography.weight.black,
    color: dashboardColors.text.subtle,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },

  planBadge: {
    height: 21,
    padding: "0 8px",
    borderRadius: dashboardRadii.full,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9.5,
    fontWeight: dashboardTypography.weight.black,
    textTransform: "uppercase",
    letterSpacing: "0.055em",
  },

  proBadge: {
    color: dashboardColors.primary[700],
    background: "rgba(239, 246, 255, 0.92)",
    border: "1px solid rgba(191, 219, 254, 0.92)",
  },

  freeBadge: {
    color: dashboardColors.text.secondary,
    background: dashboardColors.background.surfaceSoft,
    border: `1px solid ${dashboardColors.border.subtle}`,
  },

  email: {
    fontSize: 13,
    fontWeight: dashboardTypography.weight.black,
    color: dashboardColors.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    letterSpacing: "-0.018em",
  },

  menuItem: {
    width: "100%",
    minHeight: 40,
    border: "none",
    background: "transparent",
    color: dashboardColors.text.primary,
    borderRadius: 15,
    padding: "0 11px",
    fontSize: 13.25,
    fontWeight: dashboardTypography.weight.bold,
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
  },

  logoutItem: {
    width: "100%",
    minHeight: 40,
    border: "none",
    background: "transparent",
    color: dashboardColors.status.red,
    borderRadius: 15,
    padding: "0 11px",
    fontSize: 13.25,
    fontWeight: dashboardTypography.weight.bold,
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  menuIcon: {
    width: 22,
    height: 22,
    borderRadius: dashboardRadii.full,
    display: "inline-grid",
    placeItems: "center",
    flexShrink: 0,
    fontSize: 10.5,
    fontWeight: dashboardTypography.weight.black,
    color: dashboardColors.primary[600],
    background: "rgba(239, 246, 255, 0.68)",
    border: "1px solid rgba(191, 219, 254, 0.72)",
  },

  logoutIcon: {
    width: 22,
    height: 22,
    borderRadius: dashboardRadii.full,
    display: "inline-grid",
    placeItems: "center",
    flexShrink: 0,
    fontSize: 10.5,
    fontWeight: dashboardTypography.weight.black,
    color: dashboardColors.status.red,
    background: "rgba(254, 242, 242, 0.68)",
    border: "1px solid rgba(254, 202, 202, 0.78)",
  },

  logoutError: {
    margin: "6px 4px 2px",
    borderRadius: 13,
    border: "1px solid rgba(248, 113, 113, 0.3)",
    background: "rgba(254, 242, 242, 0.82)",
    color: dashboardColors.status.red,
    padding: "9px 10px",
    fontSize: 11.5,
    lineHeight: 1.4,
    fontWeight: dashboardTypography.weight.bold,
  },

  divider: {
    height: 1,
    background: "rgba(226, 232, 240, 0.9)",
    margin: "8px 5px",
  },
};
