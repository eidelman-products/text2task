"use client";

import type React from "react";
import DashboardFooter from "./dashboard-footer";
import DashboardUserMenu from "./dashboard-user-menu";

type Props = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  activeNavLabel: string;
  isMobileSidebarOpen: boolean;
  onOpenMobileSidebar: () => void;
  onCloseMobileSidebar: () => void;
};

export default function DashboardShell({
  sidebar,
  children,
  activeNavLabel,
  isMobileSidebarOpen,
  onOpenMobileSidebar,
  onCloseMobileSidebar,
}: Props) {
  return (
    <div style={styles.wrapper}>
      <style>{responsiveCss}</style>

      {/* DESKTOP FIXED SIDEBAR */}
      <aside className="dashboard-desktop-sidebar" style={styles.desktopSidebar}>
        {sidebar}
      </aside>

      {/* MOBILE DRAWER */}
      {isMobileSidebarOpen ? (
        <div style={styles.overlay} onClick={onCloseMobileSidebar}>
          <div
            style={styles.mobileSidebar}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={styles.mobileDrawerTop}>
              <div style={styles.mobileDrawerTitle}>Menu</div>

              <button
                type="button"
                onClick={onCloseMobileSidebar}
                style={styles.closeButton}
                aria-label="Close navigation"
              >
                ×
              </button>
            </div>

            {sidebar}
          </div>
        </div>
      ) : null}

      {/* MAIN AREA */}
      <main className="dashboard-main-area" style={styles.main}>
        <div className="dashboard-desktop-account-menu" style={styles.desktopAccountMenu}>
          <DashboardUserMenu />
        </div>

        <header className="dashboard-mobile-header" style={styles.mobileHeader}>
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            style={styles.menuButton}
            aria-label="Open navigation"
          >
            ☰
          </button>

          <div style={styles.mobileHeaderCenter}>
            <div style={styles.logo}>Text2Task</div>
            <div style={styles.mobileActiveLabel}>{activeNavLabel}</div>
          </div>

          <DashboardUserMenu compact />
        </header>

        <div className="dashboard-content-outer" style={styles.contentOuter}>
          <div className="dashboard-content-inner" style={styles.contentInner}>
            <div style={styles.pageContent}>{children}</div>

            <DashboardFooter />
          </div>
        </div>
      </main>
    </div>
  );
}

const responsiveCss = `
  @media (max-width: 900px) {
    .dashboard-desktop-sidebar {
      display: none !important;
    }

    .dashboard-desktop-account-menu {
      display: none !important;
    }

    .dashboard-mobile-header {
      display: flex !important;
    }

    .dashboard-main-area {
      width: 100% !important;
      margin-left: 0 !important;
    }

    .dashboard-content-outer {
      justify-content: center !important;
    }

    .dashboard-content-inner {
      max-width: 430px !important;
      padding: 18px 14px 0 !important;
    }
  }

  @media (min-width: 901px) {
    .dashboard-desktop-sidebar {
      display: block !important;
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      bottom: 0 !important;
      width: 292px !important;
      height: 100vh !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
    }

    .dashboard-desktop-account-menu {
      display: block !important;
    }

    .dashboard-mobile-header {
      display: none !important;
    }

    .dashboard-main-area {
      width: calc(100% - 292px) !important;
      margin-left: 292px !important;
      min-height: 100vh !important;
    }

    .dashboard-content-outer {
      justify-content: flex-start !important;
    }

    .dashboard-content-inner {
      width: 100% !important;
      max-width: none !important;
      padding: 28px 32px 0 !important;
    }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: "100%",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, #eef4ff 0%, #f8fafc 46%, #ffffff 100%)",
    overflowX: "hidden",
  },

  desktopSidebar: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.92) 100%)",
    borderRight: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "18px 0 55px rgba(15,23,42,0.035)",
    zIndex: 200,
  },

  desktopAccountMenu: {
    position: "fixed",
    top: 24,
    right: 32,
    zIndex: 1200,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 3000,
    background: "rgba(15,23,42,0.42)",
    backdropFilter: "blur(8px)",
  },

  mobileSidebar: {
    width: 320,
    maxWidth: "86vw",
    height: "100%",
    background: "#ffffff",
    overflowY: "auto",
    overflowX: "hidden",
    boxShadow: "28px 0 70px rgba(15,23,42,0.25)",
  },

  mobileDrawerTop: {
    height: 58,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    borderBottom: "1px solid rgba(226,232,240,0.95)",
    background: "rgba(255,255,255,0.96)",
    position: "sticky",
    top: 0,
    zIndex: 5,
  },

  mobileDrawerTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    border: "1px solid rgba(203,213,225,0.95)",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 800,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  },

  main: {
    minWidth: 0,
    overflowX: "hidden",
    position: "relative",
  },

  mobileHeader: {
    height: 64,
    position: "sticky",
    top: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "0 14px",
    background: "rgba(255,255,255,0.94)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(226,232,240,0.95)",
  },

  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    border: "1px solid rgba(203,213,225,0.95)",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(15,23,42,0.06)",
    flexShrink: 0,
  },

  mobileHeaderCenter: {
    minWidth: 0,
    display: "grid",
    gap: 1,
    textAlign: "center",
  },

  logo: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    whiteSpace: "nowrap",
  },

  mobileActiveLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  contentOuter: {
    width: "100%",
    display: "flex",
    overflowX: "hidden",
  },

  contentInner: {
    width: "100%",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  pageContent: {
    width: "100%",
    minWidth: 0,
    maxWidth: 1440,
  },
};