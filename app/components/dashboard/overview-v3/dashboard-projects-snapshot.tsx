"use client";

import type React from "react";
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
      color: "#15803d",
      background: "rgba(34,197,94,0.1)",
      border: "1px solid rgba(34,197,94,0.18)",
    };
  }

  if (normalized.includes("progress")) {
    return {
      color: "#047857",
      background: "rgba(16,185,129,0.1)",
      border: "1px solid rgba(16,185,129,0.18)",
    };
  }

  if (normalized.includes("review")) {
    return {
      color: "#92400e",
      background: "rgba(245,158,11,0.1)",
      border: "1px solid rgba(245,158,11,0.18)",
    };
  }

  return {
    color: "#475569",
    background: "rgba(148,163,184,0.1)",
    border: "1px solid rgba(148,163,184,0.16)",
  };
}

function getPriorityPillStyle(priority: string): React.CSSProperties {
  const normalized = priority.toLowerCase();

  if (normalized === "high") {
    return {
      color: "#b91c1c",
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.14)",
    };
  }

  if (normalized === "medium") {
    return {
      color: "#92400e",
      background: "rgba(245,158,11,0.08)",
      border: "1px solid rgba(245,158,11,0.14)",
    };
  }

  if (normalized === "low") {
    return {
      color: "#15803d",
      background: "rgba(34,197,94,0.08)",
      border: "1px solid rgba(34,197,94,0.14)",
    };
  }

  return {
    color: "#475569",
    background: "rgba(148,163,184,0.08)",
    border: "1px solid rgba(148,163,184,0.14)",
  };
}

function getSafeValue(value: string, fallback: string) {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

function getInitials(value: string) {
  const clean = value.trim();

  if (!clean) return "P";

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.charAt(0) || ""}${parts[1]?.charAt(0) || ""}`
      .toUpperCase()
      .slice(0, 2);
  }

  return clean.charAt(0).toUpperCase();
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

  return (
    <button
      type="button"
      onClick={() => openTaskInNewWindow(project.id)}
      className="recent-work-row"
      style={rowStyle}
      aria-label={`Open ${title}`}
    >
      <div aria-hidden="true" style={rowAccentStyle} />

      <div style={rowIndexWrapStyle}>
        <span style={rowAvatarStyle}>{getInitials(clientName)}</span>
        <span style={rowNumberStyle}>{String(index + 1).padStart(2, "0")}</span>
      </div>

      <div style={rowMainStyle}>
        <div style={rowTopLineStyle}>
          <div style={rowTitleWrapStyle}>
            <div style={rowTitleStyle}>{title}</div>
            <div style={rowSubtitleStyle}>{clientName}</div>
          </div>

          <div style={rowRightStyle}>
            <span style={{ ...pillStyle, ...getStatusPillStyle(status) }}>
              {status}
            </span>
            <span className="recent-work-arrow" style={rowArrowStyle}>
              ↗
            </span>
          </div>
        </div>

        <div style={rowSummaryStyle}>{summary}</div>

        <div style={rowMetaStyle}>
          <span style={metaChipStyle}>{amount}</span>
          <span style={metaChipStyle}>{deadline}</span>
          <span style={{ ...metaChipStyle, ...getPriorityPillStyle(priority) }}>
            {priority}
          </span>
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
            <span style={countPillStyle}>
              {visibleProjects.length} latest
            </span>
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
          <div style={emptyIconStyle}>+</div>

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
    position: relative;
    overflow: hidden;
    transition:
      transform 170ms ease,
      box-shadow 170ms ease,
      border-color 170ms ease,
      background 170ms ease;
  }

  .recent-work-row:hover {
    transform: translateY(-2px);
    border-color: rgba(99,102,241,0.22) !important;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,255,0.98)) !important;
    box-shadow:
      0 20px 40px rgba(15,23,42,0.08),
      0 0 0 1px rgba(99,102,241,0.05),
      inset 0 1px 0 rgba(255,255,255,0.98) !important;
  }

  .recent-work-row:hover .recent-work-arrow {
    transform: translate(2px, -2px);
  }

  @media (max-width: 1180px) {
    .recent-work-list {
      gap: 10px !important;
    }
  }

  @media (max-width: 720px) {
    .projects-snapshot-root {
      border-radius: 24px !important;
      padding: 16px !important;
    }

    .recent-work-row {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .recent-work-index {
      display: none !important;
    }
  }
`;

const shellStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  borderRadius: 28,
  padding: 16,
  border: "1px solid rgba(226,232,240,0.82)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,255,0.94) 100%)",
  boxShadow:
    "0 22px 48px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.98)",
  display: "grid",
  gap: 14,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const headerTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const sectionKickerStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#4f46e5",
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const titleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 19,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: "-0.045em",
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 700,
};

const headerActionsStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const countPillStyle: React.CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(99,102,241,0.16)",
  background: "rgba(99,102,241,0.07)",
  color: "#4338ca",
  padding: "7px 10px",
  fontSize: 11,
  lineHeight: 1,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const viewAllButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(99,102,241,0.16)",
  background: "rgba(255,255,255,0.88)",
  color: "#4338ca",
  borderRadius: 999,
  padding: "8px 11px",
  fontSize: 12,
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(15,23,42,0.045)",
  whiteSpace: "nowrap",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 9,
};

const rowStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  borderRadius: 20,
  padding: 12,
  border: "1px solid rgba(226,232,240,0.8)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,255,0.84) 100%)",
  boxShadow:
    "0 12px 26px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.98)",
  cursor: "pointer",
  textAlign: "left",
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: 12,
  alignItems: "flex-start",
};

const rowAccentStyle: React.CSSProperties = {
  position: "absolute",
  inset: "0 auto 0 0",
  width: 4,
  background:
    "linear-gradient(180deg, rgba(99,102,241,0.9), rgba(168,85,247,0.55), rgba(14,165,233,0.38))",
};

const rowIndexWrapStyle: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  gap: 5,
  paddingLeft: 3,
};

const rowAvatarStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(79,70,229,1), rgba(124,58,237,0.92))",
  color: "#ffffff",
  fontSize: 10,
  fontWeight: 950,
  boxShadow: "0 12px 22px rgba(79,70,229,0.22)",
};

const rowNumberStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 9,
  fontWeight: 950,
  letterSpacing: "0.08em",
};

const rowMainStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  minWidth: 0,
};

const rowTopLineStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  minWidth: 0,
};

const rowTitleWrapStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 2,
};

const rowTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  lineHeight: 1.22,
  fontWeight: 950,
  letterSpacing: "-0.03em",
  display: "-webkit-box",
  WebkitLineClamp: 1,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const rowSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  lineHeight: 1.25,
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowRightStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
};

const pillStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const rowArrowStyle: React.CSSProperties = {
  color: "#4338ca",
  fontSize: 12,
  fontWeight: 950,
  transition: "transform 170ms ease",
};

const rowSummaryStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.42,
  fontWeight: 650,
  display: "-webkit-box",
  WebkitLineClamp: 1,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const rowMetaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const metaChipStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 8px",
  color: "#475569",
  background: "rgba(248,250,252,0.9)",
  border: "1px solid rgba(226,232,240,0.84)",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 900,
  maxWidth: 140,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const emptyStyle: React.CSSProperties = {
  borderRadius: 20,
  border: "1px dashed rgba(148,163,184,0.3)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(248,250,255,0.68))",
  padding: 16,
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const emptyIconStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "rgba(99,102,241,0.08)",
  color: "#4338ca",
  fontSize: 22,
  fontWeight: 850,
  flexShrink: 0,
};

const emptyContentStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  flex: "1 1 220px",
};

const emptyTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 950,
};

const emptyTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 650,
};

const emptyButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(99,102,241,0.18)",
  background: "#4f46e5",
  color: "#ffffff",
  borderRadius: 999,
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(79,70,229,0.22)",
  whiteSpace: "nowrap",
};