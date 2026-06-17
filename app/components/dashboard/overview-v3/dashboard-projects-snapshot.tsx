"use client";

import { useState } from "react";
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

function hasDisplayValue(value: string, missingLabels: string[]) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) return false;
  if (missingLabels.includes(normalized)) return false;
  if (/^[\u2013\u2014-]+$/.test(normalized)) return false;
  if (normalized === "\u00e2\u20ac\u201d") return false;

  return true;
}

function WorkRow({
  project,
  isOpen,
  onToggle,
}: {
  project: ProjectSnapshotItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const clientName = getSafeValue(project.clientName, "Unassigned client");
  const title = getSafeValue(project.title, "Untitled project");
  const summary = getSafeValue(
    project.summary,
    "Recently added project from your CRM workspace."
  );
  const amount = String(project.amount || "").trim();
  const deadline = String(project.deadline || "").trim();
  const priority = getSafeValue(project.priority, "Normal");
  const status = getSafeValue(project.status, "New");
  const createdDate = formatDashboardDate(project.createdAt);
  const dueDate = hasDisplayValue(deadline, ["no deadline"])
    ? formatDashboardDate(deadline)
    : "";
  const amountLabel = hasDisplayValue(amount, ["no amount"]) ? amount : "";
  const showPriority = ["high", "urgent"].includes(priority.toLowerCase());
  const showStatus = status.toLowerCase() !== "new";
  const progressLabel = `${project.completedTaskCount}/${project.taskCount} done`;
  const metadataItems = [
    createdDate ? { label: "Created", value: createdDate } : null,
    dueDate ? { label: "Due", value: dueDate } : null,
    { label: "Progress", value: progressLabel },
    amountLabel ? { label: "Amount", value: amountLabel } : null,
  ].filter(
    (item): item is { label: string; value: string } => Boolean(item)
  );

  return (
    <article
      className={`recent-work-card${isOpen ? " is-open" : ""}`}
      style={cardStyle}
    >
      <div className="recent-work-card-header" style={cardHeaderStyle}>
        <div style={cardTitleWrapStyle}>
          <div style={cardTitleStyle}>{title}</div>
          <div style={cardClientStyle}>{clientName}</div>
        </div>

        <button
          type="button"
          className="recent-work-toggle-button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={`recent-work-details-${project.id}`}
          style={detailsToggleButtonStyle}
        >
          <span className="recent-work-toggle-label-desktop">
            {isOpen ? "Hide details" : "Open details"}
          </span>
          <span className="recent-work-toggle-label-mobile">
            {isOpen ? "Hide details" : "Open details"}
          </span>
        </button>
      </div>

      {isOpen ? (
        <div
          id={`recent-work-details-${project.id}`}
          style={expandedDetailsStyle}
        >
          <div style={detailsSeparatorStyle} />

          <p style={detailsSummaryStyle}>{summary}</p>

          <div className="recent-work-details-lower" style={detailsLowerStyle}>
            <div style={detailsMetaStyle}>
              {metadataItems.map((item) => (
                <span key={item.label} style={detailsMetaItemStyle}>
                  <span style={detailsMetaLabelStyle}>{item.label}</span>
                  <span style={detailsMetaValueStyle}>{item.value}</span>
                </span>
              ))}

              {showStatus ? (
                <span style={{ ...pillStyle, ...getStatusPillStyle(status) }}>
                  {status}
                </span>
              ) : null}

              {showPriority ? (
                <span
                  style={{ ...pillStyle, ...getPriorityPillStyle(priority) }}
                >
                  {priority}
                </span>
              ) : null}
            </div>

            <div
              className="recent-work-details-footer"
              style={detailsFooterStyle}
            >
              <button
                type="button"
                className="recent-work-open-button"
                onClick={() => openTaskInNewWindow(project.id)}
                aria-label={`Open project ${title}`}
                style={openProjectButtonStyle}
              >
                Open project {"\u2192"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function DashboardProjectsSnapshot({
  projects,
  onGoToTasks,
  onGoToExtract,
}: Props) {
  const [openProjectId, setOpenProjectId] = useState<number | null>(null);
  const visibleProjects = projects.slice(0, 5);
  const hasProjects = visibleProjects.length > 0;

  const toggleProjectDetails = (projectId: number) => {
    setOpenProjectId((current) => (current === projectId ? null : projectId));
  };

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

          <button
            type="button"
            className="recent-work-view-all"
            onClick={onGoToTasks}
            style={viewAllButtonStyle}
          >
            View all →
          </button>
        </div>
      </div>

      {hasProjects ? (
        <div className="recent-work-list" style={listStyle}>
          {visibleProjects.map((project) => (
            <WorkRow
              key={project.id}
              project={project}
              isOpen={openProjectId === project.id}
              onToggle={() => toggleProjectDetails(project.id)}
            />
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

          <button
            type="button"
            onClick={onGoToExtract}
            style={emptyButtonStyle}
          >
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

  .recent-work-toggle-label-mobile {
    display: none;
  }

  .recent-work-card,
  .recent-work-toggle-button,
  .recent-work-open-button,
  .recent-work-view-all {
    transition:
      transform 170ms ease,
      box-shadow 170ms ease,
      border-color 170ms ease,
      background 170ms ease,
      color 170ms ease;
  }

  .recent-work-card:hover {
    transform: translateY(-1px);
    border-color: rgba(37, 99, 235, 0.18) !important;
    background: #ffffff !important;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.055) !important;
  }

  .recent-work-toggle-button:hover,
  .recent-work-view-all:hover {
    border-color: rgba(37, 99, 235, 0.28) !important;
    background: #ffffff !important;
    color: #1d4ed8 !important;
    transform: translateY(-1px);
  }

  .recent-work-open-button:hover {
    background: #1e40af !important;
    border-color: #1e40af !important;
    color: #ffffff !important;
    transform: translateY(-1px);
  }

  @media (max-width: 720px) {
    .projects-snapshot-root {
      padding: 0 !important;
    }

    .recent-work-card {
      border-color: rgba(226, 232, 240, 0.9) !important;
      background: #ffffff !important;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.035) !important;
      padding: 12px 12px !important;
    }

    .recent-work-card:hover {
      transform: translateY(-1px) !important;
      border-color: rgba(203, 213, 225, 0.95) !important;
      background: #ffffff !important;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.045) !important;
    }

    .recent-work-card-header {
      align-items: stretch !important;
      flex-direction: column !important;
      gap: 6px !important;
    }

    .recent-work-details-lower {
      align-items: stretch !important;
      flex-direction: column !important;
    }

    .recent-work-toggle-button {
      align-self: flex-start !important;
      width: auto !important;
      justify-content: center !important;
      border-color: rgba(203, 213, 225, 0.9) !important;
      background: rgba(248, 250, 252, 0.86) !important;
      box-shadow: none !important;
      color: #475569 !important;
      padding: 7px 9px !important;
      font-size: 11.5px !important;
    }

    .recent-work-toggle-button:hover {
      border-color: rgba(148, 163, 184, 0.78) !important;
      background: #ffffff !important;
      color: #334155 !important;
      transform: translateY(-1px) !important;
    }

    .recent-work-toggle-label-desktop {
      display: none !important;
    }

    .recent-work-toggle-label-mobile {
      display: inline !important;
    }

    .recent-work-open-button {
      width: 100% !important;
      justify-content: center !important;
    }

    .recent-work-details-footer {
      justify-content: stretch !important;
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

const cardStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  borderRadius: dashboardRadii.lg,
  padding: "13px 14px",
  border: `1px solid ${dashboardColors.border.subtle}`,
  background: dashboardColors.background.surface,
  boxShadow: dashboardShadows.xs,
  display: "grid",
  gap: 0,
  overflow: "hidden",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: dashboardSpacing[3],
  alignItems: "center",
  minWidth: 0,
};

const cardTitleWrapStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 4,
  flex: "1 1 auto",
};

const cardTitleStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 14,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: 0,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  overflowWrap: "anywhere",
};

const cardClientStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 11.5,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.bold,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const detailsToggleButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  border: `1px solid ${dashboardColors.border.default}`,
  background: "rgba(255, 255, 255, 0.94)",
  color: dashboardColors.primary[700],
  borderRadius: dashboardRadii.full,
  padding: "8px 11px",
  fontSize: 11.5,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
  cursor: "pointer",
  boxShadow: dashboardShadows.xs,
  whiteSpace: "nowrap",
};

const pillStyle: React.CSSProperties = {
  borderRadius: dashboardRadii.full,
  padding: "5px 8px",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
  whiteSpace: "nowrap",
};

const expandedDetailsStyle: React.CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[2],
  minWidth: 0,
  paddingTop: dashboardSpacing[3],
};

const detailsSeparatorStyle: React.CSSProperties = {
  width: "100%",
  height: 1,
  background: dashboardColors.border.subtle,
};

const detailsSummaryStyle: React.CSSProperties = {
  margin: 0,
  color: dashboardColors.text.muted,
  fontSize: 12.25,
  lineHeight: dashboardTypography.lineHeight.normal,
  fontWeight: dashboardTypography.weight.medium,
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  overflowWrap: "anywhere",
};

const detailsLowerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: dashboardSpacing[3],
  minWidth: 0,
};

const detailsMetaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  columnGap: dashboardSpacing[3],
  rowGap: dashboardSpacing[3],
  flexWrap: "wrap",
  flex: "1 1 auto",
  minWidth: 0,
};

const detailsMetaItemStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 5,
  minWidth: 0,
};

const detailsMetaLabelStyle: React.CSSProperties = {
  color: dashboardColors.text.subtle,
  fontSize: 10,
  lineHeight: 1.2,
  fontWeight: dashboardTypography.weight.black,
  textTransform: "uppercase",
  letterSpacing: 0,
  whiteSpace: "nowrap",
};

const detailsMetaValueStyle: React.CSSProperties = {
  color: dashboardColors.text.secondary,
  fontSize: 11.5,
  lineHeight: 1.2,
  fontWeight: dashboardTypography.weight.bold,
  overflowWrap: "anywhere",
};

const detailsFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  flex: "0 0 auto",
  minWidth: 0,
};

const openProjectButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${dashboardColors.primary[100]}`,
  background: dashboardColors.primary[50],
  color: dashboardColors.primary[700],
  borderRadius: dashboardRadii.full,
  padding: "9px 12px",
  fontSize: 12,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
  cursor: "pointer",
  boxShadow: dashboardShadows.xs,
  whiteSpace: "nowrap",
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
