import type { ActiveNav, ScanResult } from "./dashboard-types";

type DashboardSidebarProps = {
  email: string;
  activeNav: ActiveNav;
  setActiveNav: (value: ActiveNav) => void;
  setError: (value: string) => void;
  setSuccess: (value: string) => void;
  weeklyCleanupUsed: number;
  remainingWeeklyCleanup: number;
  freeWeeklyLimit: number;
  scanResult: ScanResult | null;
};

export default function DashboardSidebar({
  email,
  activeNav,
  setActiveNav,
  setError,
  setSuccess,
  weeklyCleanupUsed,
  remainingWeeklyCleanup,
  freeWeeklyLimit,
  scanResult,
}: DashboardSidebarProps) {
  const navItem = (
    label: string,
    key: ActiveNav,
    badge?: string | number
  ) => {
    const active = activeNav === key;

    return (
      <button
        onClick={() => {
          setActiveNav(key);
          setError("");
          setSuccess("");
        }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 14px",
          borderRadius: "16px",
          border: active
            ? "1px solid rgba(255,255,255,0.16)"
            : "1px solid transparent",
          background: active
            ? "linear-gradient(135deg, rgba(37,99,235,0.26) 0%, rgba(59,130,246,0.16) 100%)"
            : "transparent",
          color: active ? "#ffffff" : "rgba(255,255,255,0.84)",
          cursor: "pointer",
          fontWeight: active ? 800 : 600,
          fontSize: "15px",
          marginBottom: "6px",
          textAlign: "left",
        }}
      >
        <span>{label}</span>

        {badge !== undefined ? (
          <span
            style={{
              background: active
                ? "rgba(255,255,255,0.16)"
                : "rgba(255,255,255,0.1)",
              color: "#ffffff",
              borderRadius: "999px",
              padding: "3px 10px",
              fontSize: "12px",
              fontWeight: 800,
              minWidth: "28px",
              textAlign: "center",
            }}
          >
            {badge}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <aside
      style={{
        width: "300px",
        minWidth: "300px",
        background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        padding: "20px 16px",
        alignSelf: "stretch",
        position: "sticky",
        top: 0,
        minHeight: "100vh",
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
            width: "44px",
            height: "44px",
            borderRadius: "999px",
            background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "18px",
          }}
        >
          {email?.charAt(0)?.toUpperCase() || "U"}
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              color: "#ffffff",
              fontSize: "15px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {email.split("@")[0] || "InboxShaper user"}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.65)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {email}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px",
          padding: "16px",
          marginBottom: "16px",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "16px",
            fontWeight: 800,
            color: "#ffffff",
            marginBottom: "14px",
          }}
        >
          <span>🔒</span>
          <span>Privacy First</span>
        </div>

        <div
          style={{
            fontSize: "14px",
            lineHeight: 1.75,
            color: "rgba(255,255,255,0.92)",
            marginBottom: "14px",
          }}
        >
          <div>InboxShaper only scans Gmail metadata and never stores email content.</div>
          <div>All actions require your confirmation.</div>
          <div>You can disconnect Gmail anytime.</div>
        </div>

        <div
          style={{
            fontSize: "13px",
            color: "#93c5fd",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Free Plan
        </div>
      </div>

      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(37,99,235,0.16) 0%, rgba(59,130,246,0.08) 100%)",
          border: "1px solid rgba(96,165,250,0.35)",
          borderRadius: "20px",
          padding: "16px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            color: "#93c5fd",
            fontWeight: 800,
            marginBottom: "10px",
          }}
        >
          Weekly cleanup used
        </div>

        <div
          style={{
            fontSize: "32px",
            fontWeight: 800,
            color: "#ffffff",
            marginBottom: "12px",
          }}
        >
          {weeklyCleanupUsed} / {freeWeeklyLimit}
        </div>

        <div
          style={{
            width: "100%",
            height: "8px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.12)",
            overflow: "hidden",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              width: `${(weeklyCleanupUsed / freeWeeklyLimit) * 100}%`,
              height: "100%",
              background: "linear-gradient(90deg, #60a5fa 0%, #3b82f6 100%)",
            }}
          />
        </div>

        <div
          style={{
            fontSize: "14px",
            color: "rgba(255,255,255,0.76)",
            fontWeight: 700,
          }}
        >
          {remainingWeeklyCleanup} emails left this week
        </div>
      </div>

      <div
        style={{
          fontSize: "12px",
          fontWeight: 800,
          color: "rgba(255,255,255,0.42)",
          letterSpacing: "0.12em",
          marginBottom: "10px",
        }}
      >
        OVERVIEW
      </div>

      {navItem("Dashboard", "dashboard")}
      {navItem("Scan Results", "scan-results", scanResult ? "Ready" : undefined)}

      <div
        style={{
          fontSize: "12px",
          fontWeight: 800,
          color: "rgba(255,255,255,0.42)",
          letterSpacing: "0.12em",
          marginTop: "16px",
          marginBottom: "10px",
        }}
      >
        SMART VIEWS
      </div>

      {navItem(
        "Top Senders",
        "top-senders",
        scanResult ? scanResult.senderGroups : undefined
      )}
      {navItem(
        "Promotions",
        "promotions",
        scanResult ? scanResult.promotionsFoundInSampleScan : undefined
      )}
      {navItem(
        "Unread",
        "unread",
        scanResult ? scanResult.smartViews.unread : undefined
      )}
      {navItem(
        "Social Notifications",
        "social-notifications",
        scanResult ? scanResult.smartViews.social : undefined
      )}
      {navItem(
        "Job Search",
        "job-search",
        scanResult ? scanResult.smartViews.jobSearch : undefined
      )}
      {navItem(
        "Online Shopping",
        "online-shopping",
        scanResult ? scanResult.smartViews.shopping : undefined
      )}

      <div
        style={{
          fontSize: "12px",
          fontWeight: 800,
          color: "rgba(255,255,255,0.42)",
          letterSpacing: "0.12em",
          marginTop: "16px",
          marginBottom: "10px",
        }}
      >
        SYSTEM
      </div>

      {navItem("Privacy & Trust", "privacy-trust")}

      <div style={{ marginTop: "18px" }}>
        <button
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
            color: "white",
            border: "none",
            borderRadius: "18px",
            padding: "15px",
            fontWeight: 800,
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Upgrade to Pro
        </button>

        <div
          style={{
            marginTop: "12px",
            fontSize: "14px",
            color: "rgba(255,255,255,0.58)",
            lineHeight: 1.7,
          }}
        >
          Full Scan, unlimited cleanup, bulk actions, and better progress.
        </div>
      </div>
    </aside>
  );
}