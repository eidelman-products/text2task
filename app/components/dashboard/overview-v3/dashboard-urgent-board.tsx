"use client";

import type React from "react";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
} from "../ui/tokens";
import type { UrgentBoardNote } from "./dashboard-overview-types";
import { openTaskInNewWindow } from "./dashboard-overview-utils";

type Props = {
  notes: UrgentBoardNote[];
  overdueCount: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  dueSoonCount: number;
  onGoToTasks: () => void;
};

function getBoardTitle({
  notes,
  overdueCount,
  dueTodayCount,
  dueTomorrowCount,
  dueSoonCount,
}: {
  notes: UrgentBoardNote[];
  overdueCount: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  dueSoonCount: number;
}) {
  const itemLabel = getUrgentItemLabel(notes);

  if (overdueCount > 0) {
    return `${overdueCount} overdue ${itemLabel(overdueCount)} need attention`;
  }

  if (dueTodayCount > 0) {
    return `${dueTodayCount} ${itemLabel(dueTodayCount)} due today`;
  }

  if (dueTomorrowCount > 0) {
    return `${dueTomorrowCount} ${itemLabel(dueTomorrowCount)} due tomorrow`;
  }

  if (dueSoonCount > 0) {
    return `${dueSoonCount} upcoming ${itemLabel(dueSoonCount)}`;
  }

  return "No urgent tasks right now";
}

function getUrgentItemLabel(notes: UrgentBoardNote[]) {
  const allProjectLevel =
    notes.length > 0 && notes.every((note) => note.usesProjectDeadline);
  const allTaskLevel =
    notes.length > 0 && notes.every((note) => !note.usesProjectDeadline);
  const noun = allProjectLevel ? "project" : allTaskLevel ? "task" : "item";

  return (count: number) => `${noun}${count === 1 ? "" : "s"}`;
}

function getToneStyles(tone: UrgentBoardNote["tone"]) {
  if (tone === "overdue") {
    return {
      text: dashboardColors.status.red,
      background: dashboardColors.status.redSoft,
      border: "rgba(248, 113, 113, 0.22)",
      dot: dashboardColors.status.red,
      label: "Overdue",
    };
  }

  if (tone === "today") {
    return {
      text: dashboardColors.status.amber,
      background: dashboardColors.status.amberSoft,
      border: "rgba(251, 191, 36, 0.24)",
      dot: dashboardColors.status.amber,
      label: "Due today",
    };
  }

  if (tone === "tomorrow") {
    return {
      text: "#92400e",
      background: "#fffbeb",
      border: "rgba(251, 191, 36, 0.20)",
      dot: "#f59e0b",
      label: "Tomorrow",
    };
  }

  return {
    text: dashboardColors.primary[700],
    background: dashboardColors.primary[50],
    border: dashboardColors.primary[100],
    dot: dashboardColors.primary[500],
    label: "Soon",
  };
}

function UrgentTaskRow({ note }: { note: UrgentBoardNote }) {
  const tone = getToneStyles(note.tone);

  return (
    <button
      type="button"
      onClick={() => openTaskInNewWindow(note.id)}
      className="urgent-task-row"
      style={taskRowStyle}
    >
      <span
        aria-hidden="true"
        style={{
          ...taskToneDotStyle,
          background: tone.dot,
        }}
      />

      <div style={taskMainStyle}>
        <div style={taskTitleRowStyle}>
          <div style={taskTitleStyle}>{note.title}</div>

          <span
            style={{
              ...taskBadgeStyle,
              color: tone.text,
              background: tone.background,
              border: `1px solid ${tone.border}`,
            }}
          >
            {tone.label}
          </span>
        </div>

        <div style={taskMetaRowStyle}>
          <span style={taskClientStyle}>{note.clientName}</span>
          <span style={taskMetaSeparatorStyle}>•</span>
          <span style={taskMetaStyle}>
            {note.usesProjectDeadline ? "Client delivery" : `Task #${note.id}`}
          </span>
          <span style={taskMetaSeparatorStyle}>•</span>
          <span style={taskMetaStyle}>{note.deadlineLabel}</span>
        </div>
      </div>

      <span style={openTaskStyle}>Open →</span>
    </button>
  );
}

export default function DashboardUrgentBoard({
  notes,
  overdueCount,
  dueTodayCount,
  dueTomorrowCount,
  dueSoonCount,
  onGoToTasks,
}: Props) {
  const visibleNotes = notes.slice(0, 4);
  const boardTitle = getBoardTitle({
    notes: visibleNotes,
    overdueCount,
    dueTodayCount,
    dueTomorrowCount,
    dueSoonCount,
  });

  const hasOverdue = overdueCount > 0;
  const overdueItemLabel = getUrgentItemLabel(visibleNotes)(overdueCount);

  return (
    <section className="urgent-board-root" style={boardShellStyle}>
      <style>{responsiveCss}</style>

      <div style={boardHeaderStyle}>
        <div style={boardHeaderTextStyle}>
          <div style={boardKickerStyle}>Priority work</div>

          <div style={boardTitleStyle}>
            {hasOverdue ? (
              <>
                <span style={boardTitleAccentStyle}>
                  {overdueCount} overdue
                </span>{" "}
                <span style={boardTitleMainStyle}>
                  {overdueItemLabel} need attention
                </span>
              </>
            ) : (
              <span style={boardTitleMainStyle}>{boardTitle}</span>
            )}
          </div>
        </div>

      </div>

      {notes.length ? (
        <div className="urgent-task-list" style={taskListStyle}>
          {visibleNotes.map((note) => (
            <UrgentTaskRow
              key={`${note.usesProjectDeadline ? "project" : "task"}-${note.id}`}
              note={note}
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

      <div style={taskFooterActionStyle}>
        <button type="button" onClick={onGoToTasks} style={viewAllButtonStyle}>
          View all tasks
        </button>
      </div>
    </section>
  );
}

const responsiveCss = `
  .urgent-board-root,
  .urgent-board-root * {
    box-sizing: border-box;
  }

  .urgent-board-root button {
    font-family: inherit;
  }

  .urgent-task-row {
    transition:
      background 170ms ease,
      border-color 170ms ease,
      box-shadow 170ms ease,
      transform 170ms ease;
  }

  .urgent-task-row:hover {
    transform: translateY(-1px);
    border-color: rgba(37, 99, 235, 0.18) !important;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06) !important;
    background: rgba(255, 255, 255, 0.98) !important;
  }

  .urgent-task-row:first-child {
    border-color: rgba(37, 99, 235, 0.16) !important;
    background: rgba(248, 251, 255, 0.96) !important;
    box-shadow: 0 8px 22px rgba(37, 99, 235, 0.055) !important;
  }

  @media (max-width: 900px) {
    .urgent-board-root {
      gap: 14px !important;
    }
  }

  @media (max-width: 760px) {
    .urgent-task-row {
      grid-template-columns: auto minmax(0, 1fr) !important;
    }

    .urgent-task-row > span:last-child {
      display: none !important;
    }
  }

  @media (max-width: 680px) {
    .urgent-board-root {
      gap: 12px !important;
    }
  }
`;

const boardShellStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  minWidth: 0,
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
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  gap: 8,
  fontSize: 22,
  lineHeight: 1.08,
  letterSpacing: "-0.035em",
};

const boardTitleAccentStyle: React.CSSProperties = {
  color: dashboardColors.status.red,
  fontWeight: dashboardTypography.weight.black,
};

const boardTitleMainStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontWeight: dashboardTypography.weight.black,
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

const taskFooterActionStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "flex-end",
  marginTop: 2,
};

const taskListStyle: React.CSSProperties = {
  width: "100%",
  display: "grid",
  gap: dashboardSpacing[2],
};

const taskRowStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 62,
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: dashboardSpacing[3],
  border: `1px solid ${dashboardColors.border.subtle}`,
  borderRadius: dashboardRadii.lg,
  padding: "11px 12px",
  background: "rgba(255, 255, 255, 0.88)",
  boxShadow: dashboardShadows.xs,
  cursor: "pointer",
  textAlign: "left",
};

const taskToneDotStyle: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: dashboardRadii.full,
  boxShadow: "0 0 0 4px rgba(148, 163, 184, 0.08)",
};

const taskMainStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 5,
};

const taskTitleRowStyle: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: dashboardSpacing[2],
};

const taskTitleStyle: React.CSSProperties = {
  minWidth: 0,
  color: dashboardColors.text.primary,
  fontSize: 13.5,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.025em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const taskBadgeStyle: React.CSSProperties = {
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

const taskMetaRowStyle: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 6,
  color: dashboardColors.text.muted,
  fontSize: 11.5,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.medium,
  overflow: "hidden",
  whiteSpace: "nowrap",
};

const taskClientStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const taskMetaSeparatorStyle: React.CSSProperties = {
  color: dashboardColors.text.subtle,
  flexShrink: 0,
};

const taskMetaStyle: React.CSSProperties = {
  flexShrink: 0,
};

const openTaskStyle: React.CSSProperties = {
  color: dashboardColors.primary[700],
  fontSize: 12,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
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
