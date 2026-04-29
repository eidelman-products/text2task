"use client";

import { useEffect, useRef, useState } from "react";

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
      alert("Logout failed. Please try again.");
    }
  }

  return (
    <div ref={menuRef} style={styles.wrapper}>
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        style={{
          ...styles.profileButton,
          height: compact ? 40 : 44,
          minWidth: compact ? 50 : 58,
          padding: compact ? "0 10px 0 6px" : "0 12px 0 7px",
        }}
      >
        <div
          style={{
            ...styles.avatar,
            width: compact ? 28 : 31,
            height: compact ? 28 : 31,
            fontSize: compact ? 13 : 14,
          }}
        >
          {avatarLetter}
        </div>

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

      {menuOpen ? (
        <div role="menu" style={styles.menu}>
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

          <a href="/dashboard/profile" role="menuitem" style={styles.menuItem}>
            <span style={styles.menuIcon}>👤</span>
            <span>Profile</span>
          </a>

          <a href="/dashboard/billing" role="menuitem" style={styles.menuItem}>
            <span style={styles.menuIcon}>💳</span>
            <span>Billing</span>
          </a>

          <a
            href="/contact?from=dashboard"
            role="menuitem"
            style={styles.menuItem}
          >
            <span style={styles.menuIcon}>✉️</span>
            <span>Contact support</span>
          </a>

          <div style={styles.divider} />

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            role="menuitem"
            style={{
              ...styles.logoutItem,
              opacity: isLoggingOut ? 0.65 : 1,
              cursor: isLoggingOut ? "not-allowed" : "pointer",
            }}
          >
            <span style={styles.menuIcon}>↪</span>
            <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "relative",
    flexShrink: 0,
  },

  profileButton: {
    border: "1px solid rgba(226,232,240,0.98)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
    color: "#0f172a",
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    boxShadow:
      "0 12px 30px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
    transition: "transform 160ms ease, box-shadow 160ms ease",
  },

  avatar: {
    borderRadius: 999,
    background: "linear-gradient(135deg, #f97316 0%, #f59e0b 100%)",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
    boxShadow: "0 8px 18px rgba(249,115,22,0.28)",
  },

  menu: {
    position: "absolute",
    top: 54,
    right: 0,
    width: 270,
    background: "rgba(255,255,255,0.98)",
    border: "1px solid rgba(226,232,240,0.98)",
    borderRadius: 22,
    boxShadow:
      "0 24px 70px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.92)",
    padding: 10,
    zIndex: 5000,
    backdropFilter: "blur(16px)",
  },

  accountBox: {
    padding: "12px 13px 13px",
    borderRadius: 16,
    background:
      "linear-gradient(135deg, rgba(238,242,255,0.80), rgba(248,250,252,0.92))",
    border: "1px solid rgba(199,210,254,0.72)",
    marginBottom: 8,
  },

  accountTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 5,
  },

  accountLabel: {
    fontSize: 11,
    fontWeight: 950,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  planBadge: {
    height: 22,
    padding: "0 9px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  proBadge: {
    color: "#166534",
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.22)",
  },

  freeBadge: {
    color: "#1d4ed8",
    background: "rgba(59,130,246,0.10)",
    border: "1px solid rgba(59,130,246,0.18)",
  },

  email: {
    fontSize: 14,
    fontWeight: 850,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  menuItem: {
    width: "100%",
    minHeight: 42,
    border: "none",
    background: "transparent",
    color: "#0f172a",
    borderRadius: 14,
    padding: "0 12px",
    fontSize: 14,
    fontWeight: 850,
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
  },

  logoutItem: {
    width: "100%",
    minHeight: 42,
    border: "none",
    background: "transparent",
    color: "#dc2626",
    borderRadius: 14,
    padding: "0 12px",
    fontSize: 14,
    fontWeight: 900,
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  menuIcon: {
    width: 20,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
  },

  divider: {
    height: 1,
    background: "rgba(226,232,240,0.95)",
    margin: "8px 4px",
  },
};