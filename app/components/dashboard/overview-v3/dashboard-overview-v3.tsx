"use client";

import type React from "react";
import DashboardBusinessPulse from "./dashboard-business-pulse";
import DashboardProjectsSnapshot from "./dashboard-projects-snapshot";
import DashboardRecentActivity from "./dashboard-recent-activity";
import DashboardStatCard from "./dashboard-stat-card";
import DashboardUrgentBoard from "./dashboard-urgent-board";
import type {
  DashboardOverviewV3Props,
  DashboardStatItem,
  DashboardTrendTone,
} from "./dashboard-overview-types";
import {
  getRecentActiveProjects,
  getUserDisplayName,
  mapUrgentTasksToNotes,
} from "./dashboard-overview-utils";

function getProgressTrendTone(tone: string): DashboardTrendTone {
  if (tone === "green") return "up";
  if (tone === "red") return "down";
  return "flat";
}

function getClientName(task: DashboardOverviewV3Props["activeTasks"][number]) {
  return (
    task.project?.client_name?.trim() ||
    task.client?.name?.trim() ||
    "Unassigned client"
  );
}

function getNewClientsThisMonth(tasks: DashboardOverviewV3Props["activeTasks"]) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const clientNames = new Set<string>();

  for (const task of tasks) {
    const createdAtValue = task.project?.created_at || task.created_at;

    if (!createdAtValue) continue;

    const createdAt = new Date(createdAtValue);

    if (Number.isNaN(createdAt.getTime())) continue;

    if (
      createdAt.getMonth() === currentMonth &&
      createdAt.getFullYear() === currentYear
    ) {
      const clientName = getClientName(task).trim().toLowerCase();

      if (clientName && clientName !== "unassigned client") {
        clientNames.add(clientName);
      }
    }
  }

  return clientNames.size;
}

export default function DashboardOverviewV3({
  openTasks,
  doneTasks,
  progress,
  urgentTasks,
  overdueCount,
  dueTodayCount,
  dueTomorrowCount,
  dueSoonCount,
  activeTasks,
  analytics,
  userEmail,
  onGoToExtract,
  onGoToTasks,
}: DashboardOverviewV3Props) {
  const displayName = getUserDisplayName(userEmail);
  const urgentNotes = mapUrgentTasksToNotes(urgentTasks);
  const recentWork = getRecentActiveProjects(activeTasks);
  const newClientsThisMonth = getNewClientsThisMonth(activeTasks);

  const statItems: DashboardStatItem[] = [
    {
      label: "Open work",
      value: openTasks,
      helper: "Active tasks",
      tone: "neutral",
      trendLabel: openTasks > 0 ? `${openTasks} open` : "Clear",
      trendTone: "flat",
    },
    {
      label: "New clients",
      value: newClientsThisMonth,
      helper: "This month",
      tone: "growth",
      trendLabel:
        newClientsThisMonth > 0
          ? `↑ ${newClientsThisMonth} new`
          : "No new",
      trendTone: newClientsThisMonth > 0 ? "up" : "flat",
    },
    {
      label: "Completed",
      value: doneTasks,
      helper: "Done tasks",
      tone: "success",
      trendLabel: doneTasks > 0 ? "↑ Done" : undefined,
      trendTone: doneTasks > 0 ? "up" : undefined,
    },
    {
      label: "Growth",
      value: progress.displayValue,
      helper: "Work trend",
      tone: "growth",
      trendLabel:
        progress.displayValue === "—"
          ? undefined
          : `${progress.arrowSymbol} ${progress.displayValue}`,
      trendTone: getProgressTrendTone(progress.tone),
    },
  ];

  return (
    <section className="dashboard-v3-root" style={rootStyle}>
      <style>{responsiveCss}</style>

      <div aria-hidden="true" style={backgroundGlowTopStyle} />
      <div aria-hidden="true" style={backgroundGlowBottomStyle} />

      <header className="dashboard-v3-hero" style={heroStyle}>
        <div className="dashboard-v3-hero-main" style={heroMainStyle}>
          <div style={heroTextGroupStyle}>
            <h1 style={heroTitleStyle}>Welcome back, {displayName}</h1>
            <p style={heroSubtitleStyle}>
              See what needs attention now and track your revenue with a cleaner,
              sharper workspace.
            </p>
          </div>

          <div className="dashboard-v3-actions" style={heroActionsStyle}>
            <button type="button" onClick={onGoToExtract} style={primaryButtonStyle}>
              + Extract new request
            </button>

            <button type="button" onClick={onGoToTasks} style={secondaryButtonStyle}>
              Open Task CRM
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-v3-stat-grid" style={statGridStyle}>
        {statItems.map((item) => (
          <DashboardStatCard key={item.label} item={item} />
        ))}
      </div>

      <div className="dashboard-v3-command-zone" style={commandZoneStyle}>
        <DashboardUrgentBoard
          notes={urgentNotes}
          overdueCount={overdueCount}
          dueTodayCount={dueTodayCount}
          dueTomorrowCount={dueTomorrowCount}
          dueSoonCount={dueSoonCount}
          onGoToTasks={onGoToTasks}
        />
      </div>

      <div className="dashboard-v3-secondary-grid" style={secondaryGridStyle}>
        <div style={recentWorkColumnStyle}>
          <DashboardProjectsSnapshot
            projects={recentWork}
            onGoToTasks={onGoToTasks}
            onGoToExtract={onGoToExtract}
          />
        </div>

        <div style={businessPulseColumnStyle}>
          <DashboardBusinessPulse analytics={analytics} />
        </div>
      </div>

      <DashboardRecentActivity tasks={activeTasks} />
    </section>
  );
}

const responsiveCss = `
  .dashboard-v3-root,
  .dashboard-v3-root * {
    box-sizing: border-box;
  }

  .dashboard-v3-root button {
    font-family: inherit;
  }

  .dashboard-v3-actions button {
    transition:
      transform 160ms ease,
      box-shadow 160ms ease,
      border-color 160ms ease,
      background 160ms ease,
      opacity 160ms ease;
  }

  .dashboard-v3-actions button:hover {
    transform: translateY(-2px);
  }

  @media (max-width: 1180px) {
    .dashboard-v3-secondary-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 900px) {
    .dashboard-v3-hero-main {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    .dashboard-v3-actions {
      justify-content: flex-start !important;
    }

    .dashboard-v3-stat-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 640px) {
    .dashboard-v3-root {
      gap: 14px !important;
    }

    .dashboard-v3-stat-grid {
      grid-template-columns: 1fr !important;
    }

    .dashboard-v3-actions {
      flex-direction: column !important;
      align-items: stretch !important;
    }

    .dashboard-v3-actions button {
      width: 100% !important;
    }
  }
`;

const rootStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  display: "grid",
  gap: 16,
  overflow: "hidden",
};

const backgroundGlowTopStyle: React.CSSProperties = {
  position: "absolute",
  top: -170,
  right: -140,
  width: 360,
  height: 360,
  borderRadius: 999,
  background: "rgba(99,102,241,0.12)",
  filter: "blur(64px)",
  pointerEvents: "none",
};

const backgroundGlowBottomStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 40,
  left: -140,
  width: 280,
  height: 280,
  borderRadius: 999,
  background: "rgba(124,58,237,0.06)",
  filter: "blur(56px)",
  pointerEvents: "none",
};

const heroStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  borderRadius: 30,
  padding: "22px 24px",
  border: "1px solid rgba(255,255,255,0.92)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(224,231,255,0.9), transparent 34%), radial-gradient(circle at 100% 0%, rgba(241,245,249,0.92), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.99) 0%, rgba(247,249,255,0.95) 100%)",
  boxShadow:
    "0 26px 64px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.96)",
  overflow: "hidden",
};

const heroMainStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 18,
};

const heroTextGroupStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 8,
};

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "clamp(32px, 3.6vw, 52px)",
  lineHeight: 0.96,
  fontWeight: 950,
  letterSpacing: "-0.07em",
};

const heroSubtitleStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 760,
  color: "#526179",
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 650,
};

const heroActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(79,70,229,0.14)",
  borderRadius: 999,
  padding: "12px 16px",
  cursor: "pointer",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 950,
  background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
  boxShadow: "0 18px 34px rgba(79,70,229,0.24)",
  whiteSpace: "nowrap",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(203,213,225,0.84)",
  borderRadius: 999,
  padding: "12px 16px",
  cursor: "pointer",
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
  background: "rgba(255,255,255,0.86)",
  boxShadow: "0 10px 20px rgba(15,23,42,0.045)",
  whiteSpace: "nowrap",
};

const statGridStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const commandZoneStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  minWidth: 0,
};

const secondaryGridStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.1fr) minmax(360px, 0.9fr)",
  gap: 14,
  alignItems: "start",
};

const recentWorkColumnStyle: React.CSSProperties = {
  minWidth: 0,
  alignSelf: "start",
};

const businessPulseColumnStyle: React.CSSProperties = {
  minWidth: 0,
  alignSelf: "start",
};