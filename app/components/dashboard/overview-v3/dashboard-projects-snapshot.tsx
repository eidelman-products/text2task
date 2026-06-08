"use client";

import type React from "react";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
} from "../ui/tokens";
import type { ProjectSnapshotItem } from "./dashboard-overview-types";
import { openTaskInNewWindow } from "./dashboard-overview-utils";

type Props = {
  projects: ProjectSnapshotItem[];
  onGoToTasks: () => void;
  onGoToExtract: () => void;
};

function getStatusPillStyle(status: string): React.CSSProperties {
  const normalized = status.toLowerCase();

  if (normalized.includes("done")) {
    return {
      color: dashboardColors.status.green,
      background: dashboardColors.status.greenSoft,
      border: "1px solid rgba(34, 197, 94, 0.16)",
    };
  }

  if (normalized.includes("progress")) {
    return {
      color: "#047857",
      background: "rgba(236, 253, 245, 0.82)",
      border: "1px solid rgba(16, 185, 129, 0.16)",
    };
  }

  if (normalized.includes("review")) {
    return {
      color: dashboardColors.status.amber,
      background: dashboardColors.status.amberSoft,
      border: "1px solid rgba(245, 158, 11, 0.16)",
    };
  }

  return {
    color: dashboardColors.text.secondary,
    background: dashboardColors.background.surfaceSoft,
    border: `1px solid ${dashboardColors.border.subtle}`,
  };
}

function getPriorityPillStyle(priority: string): React.CSSProperties {
  const normalized = priority.toLowerCase();

  if (normalized === "high") {
    return {
      color: dashboardColors.status.red,
      background: dashboardColors.status.redSoft,
      border: "1px solid rgba(239, 68, 68, 0.14)",
    };
  }

  if (normalized === "medium") {
    return {
      color: dashboardColors.status.amber,
      background: dashboardColors.status.amberSoft,
      border: "1px solid rgba(245, 158, 11, 0.14)",
    };
  }

  if (normalized === "low") {
    return {
      color: dashboardColors.status.green,
      background: dashboardColors.status.greenSoft,
      border: "1px solid rgba(34, 197, 94, 0.14)",
    };
  }

  return {
    color: dashboardColors.text.muted,
    background: dashboardColors.background.surfaceSoft,
    border: `1px solid ${dashboardColors.border.subtle}`,
  };
}

function getSafeValue(value: string, fallback: string) {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

function formatDashboardDate(value: string | null) {
  if (!value) return "";

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3])
      )
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function WorkRow({
  project,
  index,
}: {
  project: ProjectSnapshotItem;
  index: number;
}) {
  const clientName = getSafeValue(project.clientName, "Unassigned client");
  const title = getSafeValue(project.title, "Untitled project");
  const summary = getSafeValue(
    project.summary,
    "Recently added project from your CRM workspace."
  );
  const amount = getSafeValue(project.amount, "No amount");
  const deadline = getSafeValue(project.deadline, "No deadline");
  const priority = getSafeValue(project.priority, "Normal");
  const status = getSafeValue(project.status, "New");
  const createdDate = formatDashboardDate(project.createdAt);
  const hasDeadline = deadline.toLowerCase() !== "no deadline";
  const dueDate = hasDeadline ? formatDashboardDate(deadline) : "";
  const showPriority = ["high", "urgent"].includes(priority.toLowerCase());
  const progressLabel = `${project.completedTaskCount}/${project.taskCount} done`;
  const metadataItems = [
    createdDate ? `Created ${createdDate}` : "",
    dueDate ? `Due ${dueDate}` : "",
    progressLabel,
    amount,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => openTaskInNewWindow(project.id)}
      className="recent-work-row"
      style={rowStyle}
      aria-label={`Open ${title}`}
    >
      <div style={rowNumberWrapStyle}>
        <span style={rowNumberStyle}>{String(index + 1).padStart(2, "0")}</span>
      </div>

      <div style={rowMainStyle}>
        <div className="recent-work-row-top" style={rowTopLineStyle}>
          <div style={rowTitleWrapStyle}>
            <div style={rowTitleStyle}>{title}</div>
            <div style={rowSubtitleStyle}>{clientName}</div>
          </div>

          <div style={rowRightStyle}>
            <span style={{ ...pillStyle, ...getStatusPillStyle(status) }}>
              {status}
            </span>

            <span className="recent-work-arrow" style={rowArrowStyle}>
              Open →
            </span>
          </div>
        </div>

        <div style={rowSummaryStyle}>{summary}</div>

        <div style={rowMetaStyle}>
          {metadataItems.map((item, itemIndex) => (
            <span key={`${item}-${itemIndex}`} style={metaItemStyle}>
              {itemIndex > 0 ? (
                <span style={metaSeparatorStyle}>{"\u00b7"}</span>
              ) : null}
              <span style={metaTextStyle}>{item}</span>
            </span>
          ))}
          {showPriority ? (
            <span style={{ ...pillStyle, ...getPriorityPillStyle(priority) }}>
              {priority}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function DashboardProjectsSnapshot({
  projects,
  onGoToTasks,
  onGoToExtract,
}: Props) {
  const visibleProjects = projects.slice(0, 5);
  const hasProjects = visibleProjects.length > 0;

  return (
    <section className="projects-snapshot-root" style={shellStyle}>
      <style>{responsiveCss}</style>

      <div style={sectionHeaderStyle}>
        <div style={headerTextStyle}>
          <div style={sectionKickerStyle}>Recent work</div>
          <div style={titleStyle}>Latest work added to your CRM</div>
          <div style={subtitleStyle}>
            New projects and tasks created from client requests.
          </div>
        </div>

        <div style={headerActionsStyle}>
          {hasProjects ? (
            <span style={countTextStyle}>{visibleProjects.length} latest</span>
          ) : null}

          <button type="button" onClick={onGoToTasks} style={viewAllButtonStyle}>
            View all →
          </button>
        </div>
      </div>

      {hasProjects ? (
        <div className="recent-work-list" style={listStyle}>
          {visibleProjects.map((project, index) => (
            <WorkRow key={project.id} project={project} index={index} />
          ))}
        </div>
      ) : (
        <div style={emptyStyle}>
          <div style={emptyContentStyle}>
            <div style={emptyTitleStyle}>No recent work yet</div>
            <div style={emptyTextStyle}>
              Extract your next client request to create your first structured
              project.
            </div>
          </div>

          <button type="button" onClick={onGoToExtract} style={emptyButtonStyle}>
            Extract request →
          </button>
        </div>
      )}
    </section>
  );
}

const responsiveCss = `
  .projects-snapshot-root,
  .projects-snapshot-root * {
    box-sizing: border-box;
  }

  .projects-snapshot-root button {
    font-family: inherit;
  }

  .recent-work-row {
    transition:
      transform 170ms ease,
      box-shadow 170ms ease,
      border-color 170ms ease,
      background 170ms ease;
  }

  .recent-work-row:hover {
    transform: translateY(-1px);
    border-color: rgba(37, 99, 235, 0.18) !important;
    background: rgba(255, 255, 255, 0.98) !important;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.055) !important;
  }

  .recent-work-row:hover .recent-work-arrow {
    color: #1d4ed8 !important;
  }

  @media (max-width: 720px) {
    .projects-snapshot-root {
      padding: 0 !important;
    }

    .recent-work-row {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    .recent-work-row > div:first-child {
      display: none !important;
    }

    .recent-work-row-top {
      align-items: stretch !important;
      flex-direction: column !important;
    }
  }
`;

const shellStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  display: "grid",
  gap: dashboardSpacing[3],
};

const sectionHeaderStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: dashboardSpacing[3],
  flexWrap: "wrap",
};

const headerTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const sectionKickerStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: dashboardColors.primary[600],
  fontWeight: dashboardTypography.weight.black,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const titleStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 19,
  lineHeight: 1.12,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.04em",
};

const subtitleStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 12.5,
  lineHeight: dashboardTypography.lineHeight.normal,
  fontWeight: dashboardTypography.weight.medium,
};

const headerActionsStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: dashboardSpacing[2],
  flexWrap: "wrap",
};

const countTextStyle: React.CSSProperties = {
  color: dashboardColors.primary[700],
  fontSize: 11,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
  whiteSpace: "nowrap",
};

const viewAllButtonStyle: React.CSSProperties = {
  border: `1px solid ${dashboardColors.border.default}`,
  background: "rgba(255, 255, 255, 0.92)",
  color: dashboardColors.primary[700],
  borderRadius: dashboardRadii.full,
  padding: "8px 11px",
  fontSize: 12,
  fontWeight: dashboardTypography.weight.black,
  cursor: "pointer",
  boxShadow: dashboardShadows.xs,
  whiteSpace: "nowrap",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[2],
};

const rowStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 70,
  borderRadius: dashboardRadii.lg,
  padding: "11px 12px",
  border: `1px solid ${dashboardColors.border.subtle}`,
  background: "rgba(255, 255, 255, 0.78)",
  boxShadow: "none",
  cursor: "pointer",
  textAlign: "left",
  display: "grid",
  gridTemplateColumns: "32px minmax(0, 1fr)",
  gap: dashboardSpacing[3],
  alignItems: "start",
};

const rowNumberWrapStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 6,
  paddingTop: 2,
};

const rowNumberStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: dashboardRadii.full,
  display: "grid",
  placeItems: "center",
  color: dashboardColors.primary[700],
  background: dashboardColors.primary[50],
  border: `1px solid ${dashboardColors.primary[100]}`,
  fontSize: 10,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
};

const rowMainStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const rowTopLineStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: dashboardSpacing[3],
  alignItems: "flex-start",
  minWidth: 0,
};

const rowTitleWrapStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 3,
};

const rowTitleStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 14,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.03em",
  display: "-webkit-box",
  WebkitLineClamp: 1,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const rowSubtitleStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 11.5,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.bold,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowRightStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: dashboardSpacing[2],
  flexShrink: 0,
};

const pillStyle: React.CSSProperties = {
  borderRadius: dashboardRadii.full,
  padding: "5px 8px",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
  whiteSpace: "nowrap",
};

const rowArrowStyle: React.CSSProperties = {
  color: dashboardColors.primary[700],
  fontSize: 11.5,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
  transition: "color 170ms ease",
  whiteSpace: "nowrap",
};

const rowSummaryStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 11.75,
  lineHeight: dashboardTypography.lineHeight.normal,
  fontWeight: dashboardTypography.weight.medium,
  display: "-webkit-box",
  WebkitLineClamp: 1,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const rowMetaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  columnGap: 9,
  rowGap: 7,
  flexWrap: "wrap",
  paddingTop: 1,
};

const metaItemStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
};

const metaTextStyle: React.CSSProperties = {
  color: dashboardColors.text.secondary,
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: dashboardTypography.weight.bold,
  whiteSpace: "nowrap",
};

const metaSeparatorStyle: React.CSSProperties = {
  color: dashboardColors.text.subtle,
  fontSize: 10,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.bold,
};

const emptyStyle: React.CSSProperties = {
  borderRadius: dashboardRadii.xl,
  border: `1px dashed ${dashboardColors.border.default}`,
  background: "rgba(255, 255, 255, 0.66)",
  padding: dashboardSpacing[4],
  display: "flex",
  alignItems: "center",
  gap: dashboardSpacing[3],
  flexWrap: "wrap",
};

const emptyContentStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  flex: "1 1 220px",
};

const emptyTitleStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 14.5,
  fontWeight: dashboardTypography.weight.black,
};

const emptyTextStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 12.5,
  lineHeight: dashboardTypography.lineHeight.normal,
  fontWeight: dashboardTypography.weight.medium,
};

const emptyButtonStyle: React.CSSProperties = {
  border: `1px solid ${dashboardColors.primary[600]}`,
  background: dashboardColors.primary[600],
  color: dashboardColors.text.inverse,
  borderRadius: dashboardRadii.full,
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: dashboardTypography.weight.black,
  cursor: "pointer",
  boxShadow: dashboardShadows.primary,
  whiteSpace: "nowrap",
};
