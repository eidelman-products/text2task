"use client";

import type React from "react";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
} from "../ui/tokens";
import DashboardBusinessPulse from "./dashboard-business-pulse";
import DashboardProjectsSnapshot from "./dashboard-projects-snapshot";
import DashboardRecentActivity from "./dashboard-recent-activity";
import DashboardPriorityWorkBoard from "./dashboard-priority-work-board";
import type { DashboardOverviewV3Props } from "./dashboard-overview-types";
import {
  getRecentActiveProjects,
  getUserDisplayName,
} from "./dashboard-overview-utils";

export default function DashboardOverviewV3({
  priorityWork,
  activeTasks,
  analytics,
  userEmail,
  onGoToExtract,
  onGoToTasks,
}: DashboardOverviewV3Props) {
  const displayName = getUserDisplayName(userEmail);
  const recentWork = getRecentActiveProjects(activeTasks);

  return (
    <section className="dashboard-v3-root" style={rootStyle}>
      <style>{responsiveCss}</style>

      <header className="dashboard-v3-hero" style={heroStyle}>
        <div className="dashboard-v3-hero-main" style={heroMainStyle}>
          <div style={heroTextGroupStyle}>
            <h1 style={heroTitleStyle}>Welcome back, {displayName} 👋</h1>

            <p style={heroSubtitleStyle}>
              Here’s what needs your attention today.
            </p>
          </div>

          <div className="dashboard-v3-actions" style={heroActionsStyle}>
            <button type="button" onClick={onGoToExtract} style={primaryButtonStyle}>
              + Extract New Request
            </button>

            <button type="button" onClick={onGoToTasks} style={secondaryButtonStyle}>
              Open Task CRM
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-v3-priority-section">
        <DashboardPriorityWorkBoard
          summary={priorityWork}
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

      <div className="dashboard-v3-activity-section">
        <DashboardRecentActivity tasks={activeTasks} />
      </div>
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
    transform: translateY(-1px);
  }

  .dashboard-v3-priority-section {
    margin-top: 24px;
  }

  .dashboard-v3-secondary-grid {
    margin-top: 4px;
  }

  .dashboard-v3-activity-section {
    margin-top: 42px;
  }

  @media (max-width: 1180px) {
    .dashboard-v3-secondary-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 900px) {
    .dashboard-v3-hero-main {
      grid-template-columns: 1fr !important;
      gap: 18px !important;
    }

    .dashboard-v3-actions {
      justify-content: flex-start !important;
    }
  }

  @media (max-width: 640px) {
    .dashboard-v3-root {
      gap: 18px !important;
    }

    .dashboard-v3-hero {
      padding-top: 0 !important;
    }

    .dashboard-v3-actions {
      flex-direction: column !important;
      align-items: stretch !important;
    }

    .dashboard-v3-actions button {
      width: 100% !important;
    }

    .dashboard-v3-priority-section {
      margin-top: 12px !important;
    }

    .dashboard-v3-secondary-grid {
      margin-top: 24px !important;
    }

    .dashboard-v3-secondary-grid > div:last-child {
      margin-top: 36px !important;
    }

    .dashboard-v3-activity-section {
      margin-top: 52px !important;
    }
  }
`;

const rootStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 1240,
  minWidth: 0,
  margin: "0 auto",
  display: "grid",
  gap: dashboardSpacing[5],
  overflow: "hidden",
};

const heroStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  padding: "2px 0 0",
};

const heroMainStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "start",
  gap: dashboardSpacing[6],
};

const heroTextGroupStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 6,
};

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  color: dashboardColors.text.primary,
  fontSize: "clamp(27px, 3vw, 34px)",
  lineHeight: 1.08,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.045em",
};

const heroSubtitleStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 620,
  color: dashboardColors.text.muted,
  fontSize: 15,
  lineHeight: dashboardTypography.lineHeight.normal,
  fontWeight: dashboardTypography.weight.medium,
};

const heroActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: dashboardSpacing[3],
  flexWrap: "wrap",
  paddingTop: 4,
};

const primaryButtonStyle: React.CSSProperties = {
  border: `1px solid ${dashboardColors.primary[600]}`,
  borderRadius: dashboardRadii.full,
  padding: "12px 18px",
  cursor: "pointer",
  color: dashboardColors.text.inverse,
  fontSize: 13,
  fontWeight: dashboardTypography.weight.black,
  background: dashboardColors.primary[600],
  boxShadow: "0 16px 30px rgba(37, 99, 235, 0.22)",
  whiteSpace: "nowrap",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: `1px solid ${dashboardColors.border.default}`,
  borderRadius: dashboardRadii.full,
  padding: "12px 18px",
  cursor: "pointer",
  color: dashboardColors.text.primary,
  fontSize: 13,
  fontWeight: dashboardTypography.weight.bold,
  background: "#ffffff",
  boxShadow: dashboardShadows.xs,
  whiteSpace: "nowrap",
};

const secondaryGridStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.35fr) minmax(340px, 0.85fr)",
  gap: dashboardSpacing[8],
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
