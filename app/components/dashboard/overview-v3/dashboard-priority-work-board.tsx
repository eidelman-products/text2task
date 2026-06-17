"use client";

import type React from "react";
import { useState } from "react";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
} from "../ui/tokens";
import { openTaskInNewWindow } from "./dashboard-overview-utils";
import type {
  PriorityProjectGroup,
  PriorityProjectSummary,
  PriorityTone,
} from "./dashboard-priority-work-utils";

type Props = {
  summary: PriorityProjectSummary;
  onGoToTasks: () => void;
};

const previewLimit = 3;

function getToneStyles(tone: PriorityTone) {
  if (tone === "overdue") {
    return {
      text: dashboardColors.status.red,
      background: dashboardColors.status.redSoft,
      border: "rgba(248, 113, 113, 0.22)",
      label: "Overdue",
    };
  }

  if (tone === "today") {
    return {
      text: dashboardColors.status.amber,
      background: dashboardColors.status.amberSoft,
      border: "rgba(251, 191, 36, 0.24)",
      label: "Due today",
    };
  }

  if (tone === "tomorrow") {
    return {
      text: "#92400e",
      background: "#fffbeb",
      border: "rgba(251, 191, 36, 0.20)",
      label: "Due tomorrow",
    };
  }

  return {
    text: dashboardColors.primary[700],
    background: dashboardColors.primary[50],
    border: dashboardColors.primary[100],
    label: "Due soon",
  };
}

function getAttentionCopy(count: number) {
  return `${count} item${count === 1 ? "" : "s"} need attention`;
}

function getBoardTitle(projectCount: number) {
  if (projectCount === 1) return "1 project needs attention";
  return `${projectCount} projects need attention`;
}

function getPreviewMeta(item: PriorityProjectGroup["previewItems"][number]) {
  const parts = item.usesProjectDeadline ? ["Client delivery"] : [];

  if (item.dueText) {
    parts.push(item.dueText);
  }

  if (item.dueDateText) {
    parts.push(item.dueDateText);
  }

  return parts.join(" · ");
}

function BreakdownPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: PriorityTone;
}) {
  if (count <= 0) return null;

  const toneStyle = getToneStyles(tone);

  return (
    <span
      style={{
        ...breakdownPillStyle,
        color: toneStyle.text,
        background: toneStyle.background,
        border: `1px solid ${toneStyle.border}`,
      }}
    >
      {count} {label}
    </span>
  );
}

function PriorityProjectCard({
  group,
  isOpen,
  onToggle,
}: {
  group: PriorityProjectGroup;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const tone = getToneStyles(group.highestTone);
  const previewItems = group.previewItems.slice(0, previewLimit);
  const hiddenCount = Math.max(group.previewItems.length - previewLimit, 0);

  return (
    <article
      className={`priority-project-card ${isOpen ? "is-open" : "is-collapsed"}`}
      style={projectCardStyle}
    >
      <div className="priority-project-card-header" style={projectHeaderStyle}>
        <div style={projectMainStyle}>
          <div style={projectTitleRowStyle}>
            <h3 style={projectTitleStyle}>{group.projectTitle}</h3>

            <span
              style={{
                ...toneBadgeStyle,
                color: tone.text,
                background: tone.background,
                border: `1px solid ${tone.border}`,
              }}
            >
              {tone.label}
            </span>
          </div>

          <div style={projectMetaStyle}>
            <span style={projectClientStyle}>
              {group.clientName || "Unassigned"}
            </span>
            <span style={projectMetaSeparatorStyle}>•</span>
            <span>{getAttentionCopy(group.attentionCount)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="priority-details-button"
          style={detailsButtonStyle}
          aria-expanded={isOpen}
        >
          {isOpen ? "Hide details" : "Open details"}
        </button>
      </div>

      {isOpen ? (
        <div style={expandedContentStyle}>
          <div style={breakdownRowStyle}>
            <BreakdownPill
              label="overdue"
              count={group.overdueCount}
              tone="overdue"
            />
            <BreakdownPill
              label="due today"
              count={group.dueTodayCount}
              tone="today"
            />
            <BreakdownPill
              label="due tomorrow"
              count={group.dueTomorrowCount}
              tone="tomorrow"
            />
            <BreakdownPill
              label="due soon"
              count={group.dueSoonCount}
              tone="soon"
            />
          </div>

          <div style={previewListStyle}>
            {previewItems.map((item) => {
              const previewMeta = getPreviewMeta(item);

              return (
                <div
                  key={`${item.usesProjectDeadline ? "project" : "task"}-${item.id}-${item.tone}`}
                  style={previewItemStyle}
                >
                  <span aria-hidden="true" style={previewBulletStyle} />
                  <div style={previewCopyStyle}>
                    <div style={previewTitleStyle}>{item.title}</div>
                    {previewMeta ? (
                      <div style={previewMetaStyle}>{previewMeta}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {hiddenCount > 0 ? (
              <div style={moreItemsStyle}>+{hiddenCount} more</div>
            ) : null}
          </div>

          <div style={expandedActionRowStyle}>
            <button
              type="button"
              onClick={() => openTaskInNewWindow(group.representativeTaskId)}
              className="priority-open-project-button"
              style={openProjectButtonStyle}
            >
              Open project →
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function DashboardPriorityWorkBoard({
  summary,
  onGoToTasks,
}: Props) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const hasGroups = summary.groups.length > 0;

  function toggleGroup(key: string) {
    setOpenGroups((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  return (
    <section className="priority-work-root" style={boardShellStyle}>
      <style>{responsiveCss}</style>

      <div style={boardHeaderStyle}>
        <div style={boardHeaderTextStyle}>
          <div style={boardKickerStyle}>Priority work</div>

          <div style={boardTitleStyle}>
            {hasGroups ? (
              <span>{getBoardTitle(summary.projectCount)}</span>
            ) : (
              <span>No urgent tasks right now</span>
            )}
          </div>
        </div>
      </div>

      {hasGroups ? (
        <div className="priority-project-list" style={projectListStyle}>
          {summary.groups.map((group) => (
            <PriorityProjectCard
              key={group.key}
              group={group}
              isOpen={Boolean(openGroups[group.key])}
              onToggle={() => toggleGroup(group.key)}
            />
          ))}
        </div>
      ) : (
        <div style={emptyBoardStyle}>
          <div style={emptyIconStyle}>✓</div>
          <div style={emptyCopyStyle}>
            <div style={emptyTitleStyle}>No urgent work right now</div>
            <div style={emptyTextStyle}>
              Tasks that become overdue, due today, or due soon will appear here.
            </div>
          </div>
        </div>
      )}

      <div style={footerActionStyle}>
        <button
          type="button"
          onClick={onGoToTasks}
          className="priority-view-all-button"
          style={viewAllButtonStyle}
        >
          View all tasks
        </button>
      </div>
    </section>
  );
}

const responsiveCss = `
  .priority-work-root,
  .priority-work-root * {
    box-sizing: border-box;
  }

  .priority-work-root button {
    font-family: inherit;
  }

  .priority-project-card,
  .priority-details-button,
  .priority-open-project-button,
  .priority-view-all-button {
    transition:
      background 170ms ease,
      border-color 170ms ease,
      box-shadow 170ms ease,
      transform 170ms ease;
  }

  .priority-project-card.is-collapsed:hover {
    transform: translateY(-1px);
    border-color: rgba(37, 99, 235, 0.18) !important;
    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.075) !important;
    background: rgba(255, 255, 255, 0.98) !important;
  }

  .priority-details-button:hover,
  .priority-open-project-button:hover,
  .priority-view-all-button:hover {
    transform: translateY(-1px);
    border-color: rgba(37, 99, 235, 0.18) !important;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.065) !important;
  }

  @media (max-width: 760px) {
    .priority-work-root {
      max-width: 100% !important;
      margin-bottom: 40px !important;
    }

    .priority-project-card-header {
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 12px !important;
    }

    .priority-details-button {
      justify-self: start !important;
    }
  }

  @media (max-width: 560px) {
    .priority-project-list {
      gap: 10px !important;
    }
  }
`;

const boardShellStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 1000,
  minWidth: 0,
  margin: "0 0 clamp(40px, 5vw, 56px)",
  display: "grid",
  gap: dashboardSpacing[3],
};

const boardHeaderStyle: React.CSSProperties = {
  width: "100%",
  display: "grid",
  gap: dashboardSpacing[2],
};

const boardHeaderTextStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 6,
};

const boardKickerStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: dashboardColors.primary[600],
  fontWeight: dashboardTypography.weight.black,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const boardTitleStyle: React.CSSProperties = {
  margin: 0,
  color: dashboardColors.text.primary,
  fontSize: 22,
  lineHeight: 1.08,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.035em",
};

const projectListStyle: React.CSSProperties = {
  width: "100%",
  display: "grid",
  gap: dashboardSpacing[2],
};

const projectCardStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  display: "grid",
  gap: 0,
  border: `1px solid ${dashboardColors.border.subtle}`,
  borderRadius: dashboardRadii.lg,
  padding: "13px 14px",
  background: "rgba(255, 255, 255, 0.9)",
  boxShadow: dashboardShadows.xs,
};

const projectHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: dashboardSpacing[3],
};

const projectMainStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 6,
};

const projectTitleRowStyle: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: dashboardSpacing[2],
};

const projectTitleStyle: React.CSSProperties = {
  minWidth: 0,
  margin: 0,
  color: dashboardColors.text.primary,
  fontSize: 14.5,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.025em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const toneBadgeStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 22,
  padding: "0 8px",
  borderRadius: dashboardRadii.full,
  fontSize: 10,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
};

const projectMetaStyle: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 6,
  color: dashboardColors.text.muted,
  fontSize: 12,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.medium,
  overflow: "hidden",
  whiteSpace: "nowrap",
};

const projectClientStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const projectMetaSeparatorStyle: React.CSSProperties = {
  color: dashboardColors.text.subtle,
  flexShrink: 0,
};

const detailsButtonStyle: React.CSSProperties = {
  border: `1px solid ${dashboardColors.border.default}`,
  background: "rgba(255, 255, 255, 0.92)",
  color: dashboardColors.primary[700],
  borderRadius: dashboardRadii.full,
  padding: "9px 12px",
  fontSize: 12,
  fontWeight: dashboardTypography.weight.black,
  cursor: "pointer",
  boxShadow: dashboardShadows.xs,
  whiteSpace: "nowrap",
};

const expandedContentStyle: React.CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[2],
  marginTop: dashboardSpacing[3],
  paddingTop: dashboardSpacing[3],
  borderTop: `1px solid ${dashboardColors.border.subtle}`,
};

const breakdownRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const breakdownPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 22,
  padding: "0 8px",
  borderRadius: dashboardRadii.full,
  fontSize: 10.5,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
};

const previewListStyle: React.CSSProperties = {
  display: "grid",
  gap: 0,
};

const previewItemStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  alignItems: "start",
  gap: 9,
  padding: "8px 0",
  borderBottom: `1px solid ${dashboardColors.border.subtle}`,
};

const previewBulletStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  marginTop: 6,
  borderRadius: dashboardRadii.full,
  background: dashboardColors.primary[100],
  flexShrink: 0,
};

const previewCopyStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 2,
};

const previewTitleStyle: React.CSSProperties = {
  minWidth: 0,
  color: dashboardColors.text.primary,
  fontSize: 13,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.bold,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const previewMetaStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 11.5,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.medium,
};

const moreItemsStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 12,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.black,
  paddingLeft: 2,
};

const expandedActionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const openProjectButtonStyle: React.CSSProperties = {
  border: `1px solid ${dashboardColors.primary[100]}`,
  background: dashboardColors.primary[600],
  color: dashboardColors.text.inverse,
  borderRadius: dashboardRadii.full,
  padding: "10px 13px",
  fontSize: 12,
  fontWeight: dashboardTypography.weight.black,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(37, 99, 235, 0.18)",
  whiteSpace: "nowrap",
};

const footerActionStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "flex-end",
  marginTop: 2,
};

const viewAllButtonStyle: React.CSSProperties = {
  border: `1px solid ${dashboardColors.border.default}`,
  background: "rgba(255, 255, 255, 0.92)",
  color: dashboardColors.text.secondary,
  borderRadius: dashboardRadii.full,
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: dashboardTypography.weight.black,
  cursor: "pointer",
  boxShadow: dashboardShadows.xs,
  whiteSpace: "nowrap",
  alignSelf: "end",
};

const emptyBoardStyle: React.CSSProperties = {
  minHeight: 116,
  borderRadius: dashboardRadii.xl,
  border: `1px dashed ${dashboardColors.border.default}`,
  background: "rgba(255, 255, 255, 0.62)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: dashboardSpacing[3],
  padding: dashboardSpacing[5],
  textAlign: "left",
};

const emptyIconStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: dashboardRadii.full,
  display: "grid",
  placeItems: "center",
  background: dashboardColors.status.greenSoft,
  color: dashboardColors.status.green,
  fontSize: 16,
  fontWeight: dashboardTypography.weight.black,
  flexShrink: 0,
};

const emptyCopyStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const emptyTitleStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 14,
  fontWeight: dashboardTypography.weight.black,
};

const emptyTextStyle: React.CSSProperties = {
  maxWidth: 520,
  color: dashboardColors.text.muted,
  fontSize: 12.5,
  lineHeight: dashboardTypography.lineHeight.normal,
  fontWeight: dashboardTypography.weight.medium,
};
