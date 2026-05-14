"use client";

import type React from "react";
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
  overdueCount,
  dueTodayCount,
  dueTomorrowCount,
  dueSoonCount,
}: {
  overdueCount: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  dueSoonCount: number;
}) {
  if (overdueCount > 0) {
    return `${overdueCount} overdue task${overdueCount === 1 ? "" : "s"} need attention now`;
  }

  if (dueTodayCount > 0) {
    return `${dueTodayCount} task${dueTodayCount === 1 ? "" : "s"} need your attention today`;
  }

  if (dueTomorrowCount > 0) {
    return `${dueTomorrowCount} task${dueTomorrowCount === 1 ? "" : "s"} should be reviewed before tomorrow`;
  }

  if (dueSoonCount > 0) {
    return `${dueSoonCount} upcoming task${dueSoonCount === 1 ? "" : "s"} need a quick review`;
  }

  return "No urgent tasks right now";
}

function getNoteToneStyles(tone: UrgentBoardNote["tone"]) {
  if (tone === "overdue") {
    return {
      pin: "#ef4444",
      pinShadow: "0 9px 18px rgba(185,28,28,0.30)",
      badgeText: "#991b1b",
      badgeBg: "rgba(254,226,226,0.92)",
      paper:
        "linear-gradient(180deg, rgba(255,244,244,0.99) 0%, rgba(255,250,250,0.96) 100%)",
      border: "1px solid rgba(248,113,113,0.24)",
      shadow:
        "0 20px 40px rgba(127,29,29,0.13), 0 8px 18px rgba(15,23,42,0.05)",
      rotate: "-1.1deg",
    };
  }

  if (tone === "today") {
    return {
      pin: "#f97316",
      pinShadow: "0 9px 18px rgba(194,65,12,0.26)",
      badgeText: "#9a3412",
      badgeBg: "rgba(255,237,213,0.94)",
      paper:
        "linear-gradient(180deg, rgba(255,249,240,1) 0%, rgba(255,253,247,0.97) 100%)",
      border: "1px solid rgba(251,146,60,0.23)",
      shadow:
        "0 20px 40px rgba(154,52,18,0.11), 0 8px 18px rgba(15,23,42,0.05)",
      rotate: "0.7deg",
    };
  }

  if (tone === "tomorrow") {
    return {
      pin: "#eab308",
      pinShadow: "0 9px 18px rgba(161,98,7,0.24)",
      badgeText: "#854d0e",
      badgeBg: "rgba(254,243,199,0.95)",
      paper:
        "linear-gradient(180deg, rgba(255,252,232,1) 0%, rgba(255,254,247,0.97) 100%)",
      border: "1px solid rgba(234,179,8,0.22)",
      shadow:
        "0 20px 40px rgba(133,77,14,0.10), 0 8px 18px rgba(15,23,42,0.05)",
      rotate: "-0.45deg",
    };
  }

  return {
    pin: "#6366f1",
    pinShadow: "0 9px 18px rgba(79,70,229,0.24)",
    badgeText: "#3730a3",
    badgeBg: "rgba(224,231,255,0.94)",
    paper:
      "linear-gradient(180deg, rgba(246,248,255,1) 0%, rgba(255,255,255,0.97) 100%)",
    border: "1px solid rgba(99,102,241,0.2)",
    shadow:
      "0 20px 40px rgba(79,70,229,0.10), 0 8px 18px rgba(15,23,42,0.05)",
    rotate: "0.5deg",
  };
}

function getToneLabel(tone: UrgentBoardNote["tone"]) {
  if (tone === "overdue") return "Overdue";
  if (tone === "today") return "Due today";
  if (tone === "tomorrow") return "Due tomorrow";
  return "Due soon";
}

function BoardMetric({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <div
      style={{
        ...metricPillStyle,
        ...(active ? metricPillActiveStyle : null),
      }}
    >
      <span style={metricValueStyle}>{value}</span>
      <span style={metricLabelStyle}>{label}</span>
    </div>
  );
}

function NoteInfo({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div style={noteInfoRowStyle}>
      <span style={noteInfoLabelStyle}>{label}</span>
      <span style={noteInfoValueStyle}>{value}</span>
    </div>
  );
}

function UrgentNoteCard({ note }: { note: UrgentBoardNote }) {
  const tone = getNoteToneStyles(note.tone);

  return (
    <button
      type="button"
      onClick={() => openTaskInNewWindow(note.id)}
      className="urgent-note-card"
      style={{
        ...noteCardStyle,
        background: tone.paper,
        border: tone.border,
        boxShadow: tone.shadow,
        transform: `rotate(${tone.rotate})`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          ...pinStyle,
          background: tone.pin,
          boxShadow: tone.pinShadow,
        }}
      />

      <div style={noteTopRowStyle}>
        <span
          style={{
            ...noteBadgeStyle,
            color: tone.badgeText,
            background: tone.badgeBg,
          }}
        >
          {note.deadlineLabel}
        </span>

        <span style={noteToneStyle}>{getToneLabel(note.tone)}</span>
      </div>

      <div style={noteTitleStyle}>{note.title}</div>

      <div style={noteClientStyle}>{note.clientName}</div>

      <div style={noteInfoBoxStyle}>
        <NoteInfo label="Task" value={`#${note.id}`} />
        <NoteInfo label="Deadline" value={note.deadlineLabel} />
      </div>

      <div style={noteFooterStyle}>
        <span>Open task</span>
        <span aria-hidden="true">↗</span>
      </div>
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
  const boardTitle = getBoardTitle({
    overdueCount,
    dueTodayCount,
    dueTomorrowCount,
    dueSoonCount,
  });

  return (
    <section className="urgent-board-root" style={boardShellStyle}>
      <style>{responsiveCss}</style>

      <div aria-hidden="true" style={boardGlowLeftStyle} />
      <div aria-hidden="true" style={boardGlowRightStyle} />
      <div aria-hidden="true" style={boardTextureStyle} />

      <div style={boardHeaderStyle}>
        <div style={boardHeaderTextStyle}>
          <div style={boardKickerStyle}>Urgent tasks board</div>
          <div style={boardTitleStyle}>{boardTitle}</div>
        </div>

        <div className="urgent-board-header-actions" style={headerActionsStyle}>
          <div className="urgent-board-metrics" style={metricsRowStyle}>
            <BoardMetric
              label="Overdue"
              value={overdueCount}
              active={overdueCount > 0}
            />
            <BoardMetric
              label="Today"
              value={dueTodayCount}
              active={dueTodayCount > 0}
            />
            <BoardMetric
              label="Tomorrow"
              value={dueTomorrowCount}
              active={dueTomorrowCount > 0}
            />
            <BoardMetric
              label="Soon"
              value={dueSoonCount}
              active={dueSoonCount > 0}
            />
          </div>

          <button type="button" onClick={onGoToTasks} style={viewAllButtonStyle}>
            View all tasks →
          </button>
        </div>
      </div>

      <div style={boardSurfaceStyle}>
        {notes.length ? (
          <div className="urgent-notes-grid" style={notesGridStyle}>
            {notes.map((note) => (
              <UrgentNoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <div style={emptyBoardStyle}>
            <div style={emptyIconStyle}>✓</div>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={emptyTitleStyle}>No urgent work right now</div>
              <div style={emptyTextStyle}>
                When a task becomes overdue, due today, or due soon, it will
                appear here.
              </div>
            </div>
          </div>
        )}
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

  .urgent-note-card {
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      border-color 180ms ease,
      background 180ms ease;
  }

  .urgent-note-card:hover {
    transform: translateY(-6px) rotate(0deg) !important;
    box-shadow: 0 32px 62px rgba(15,23,42,0.17) !important;
    border-color: rgba(99,102,241,0.26) !important;
  }

  @media (max-width: 1050px) {
    .urgent-board-header-actions {
      width: 100% !important;
      align-items: flex-start !important;
    }

    .urgent-board-metrics {
      justify-content: flex-start !important;
    }
  }

  @media (max-width: 760px) {
    .urgent-board-root {
      padding: 16px !important;
      border-radius: 28px !important;
    }

    .urgent-notes-grid {
      grid-template-columns: 1fr !important;
    }
  }
`;

const boardShellStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  minWidth: 0,
  borderRadius: 34,
  padding: 18,
  border: "1px solid rgba(224,231,255,0.78)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(79,70,229,0.13), transparent 32%), radial-gradient(circle at 100% 0%, rgba(245,158,11,0.13), transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.99) 0%, rgba(248,250,255,0.96) 45%, rgba(255,250,240,0.95) 100%)",
  boxShadow:
    "0 34px 78px rgba(15,23,42,0.09), inset 0 1px 0 rgba(255,255,255,0.98)",
  display: "grid",
  gap: 12,
  overflow: "hidden",
};

const boardGlowLeftStyle: React.CSSProperties = {
  position: "absolute",
  left: -130,
  bottom: -150,
  width: 310,
  height: 310,
  borderRadius: 999,
  background: "rgba(245,158,11,0.1)",
  filter: "blur(58px)",
  pointerEvents: "none",
};

const boardGlowRightStyle: React.CSSProperties = {
  position: "absolute",
  right: -120,
  top: -90,
  width: 300,
  height: 300,
  borderRadius: 999,
  background: "rgba(124,58,237,0.11)",
  filter: "blur(58px)",
  pointerEvents: "none",
};

const boardTextureStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  opacity: 0.24,
  pointerEvents: "none",
  backgroundImage:
    "linear-gradient(rgba(99,102,241,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.035) 1px, transparent 1px)",
  backgroundSize: "36px 36px",
};

const boardHeaderStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const boardHeaderTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const boardKickerStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#4f46e5",
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const boardTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 26,
  lineHeight: 1.02,
  fontWeight: 950,
  letterSpacing: "-0.06em",
};

const headerActionsStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 10,
  minWidth: 0,
};

const metricsRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 7,
  flexWrap: "wrap",
};

const metricPillStyle: React.CSSProperties = {
  minWidth: 74,
  borderRadius: 999,
  padding: "7px 9px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  border: "1px solid rgba(226,232,240,0.78)",
  background: "rgba(255,255,255,0.72)",
  boxShadow: "0 8px 18px rgba(15,23,42,0.035)",
};

const metricPillActiveStyle: React.CSSProperties = {
  borderColor: "rgba(245,158,11,0.2)",
  background: "rgba(255,251,235,0.86)",
};

const metricValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 950,
  lineHeight: 1,
};

const metricLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 10,
  fontWeight: 850,
  lineHeight: 1,
};

const viewAllButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(99,102,241,0.16)",
  background: "rgba(255,255,255,0.9)",
  color: "#4338ca",
  borderRadius: 999,
  padding: "10px 13px",
  fontSize: 12,
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 12px 26px rgba(15,23,42,0.055)",
  whiteSpace: "nowrap",
};

const boardSurfaceStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  minHeight: 220,
  borderRadius: 28,
  padding: "10px 18px 16px",
  display: "grid",
  alignContent: "start",
  gap: 18,
  overflow: "hidden",
};

const notesGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(205px, 246px))",
  gap: 20,
  alignItems: "start",
  justifyContent: "start",
};

const noteCardStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 246,
  minWidth: 0,
  minHeight: 156,
  borderRadius: 5,
  padding: "18px 16px 14px",
  cursor: "pointer",
  textAlign: "left",
  display: "grid",
  alignContent: "start",
  gap: 8,
};

const pinStyle: React.CSSProperties = {
  position: "absolute",
  top: -8,
  left: "50%",
  width: 14,
  height: 14,
  borderRadius: 999,
  transform: "translateX(-50%)",
  border: "1px solid rgba(255,255,255,0.58)",
};

const noteTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const noteBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 950,
};

const noteToneStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 850,
  lineHeight: 1,
};

const noteTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  lineHeight: 1.16,
  fontWeight: 950,
  letterSpacing: "-0.035em",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const noteClientStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  lineHeight: 1.3,
  fontWeight: 750,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const noteInfoBoxStyle: React.CSSProperties = {
  borderRadius: 10,
  padding: "7px 8px",
  border: "1px solid rgba(226,232,240,0.62)",
  background: "rgba(255,255,255,0.48)",
  display: "grid",
  gap: 5,
};

const noteInfoRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
};

const noteInfoLabelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 9,
  lineHeight: 1,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const noteInfoValueStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 10,
  lineHeight: 1.15,
  fontWeight: 850,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textAlign: "right",
};

const noteFooterStyle: React.CSSProperties = {
  marginTop: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  width: "100%",
  color: "#4338ca",
  fontSize: 11,
  fontWeight: 950,
};

const emptyBoardStyle: React.CSSProperties = {
  minHeight: 160,
  borderRadius: 22,
  border: "1px dashed rgba(148,163,184,0.26)",
  background: "rgba(255,255,255,0.56)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  padding: 22,
  textAlign: "left",
};

const emptyIconStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "rgba(34,197,94,0.1)",
  color: "#15803d",
  fontSize: 18,
  fontWeight: 950,
  flexShrink: 0,
};

const emptyTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 950,
};

const emptyTextStyle: React.CSSProperties = {
  maxWidth: 520,
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 650,
};