import type { CSSProperties } from "react";
import type { TaskArchiveView } from "./task-types";

type TasksArchiveTabsProps = {
  archiveView: TaskArchiveView;
  onArchiveViewChange: (value: TaskArchiveView) => void;
};

export default function TasksArchiveTabs({
  archiveView,
  onArchiveViewChange,
}: TasksArchiveTabsProps) {
  const options: Array<{
    value: TaskArchiveView;
    label: string;
    description: string;
  }> = [
    {
      value: "active",
      label: "Active",
      description: "Current work",
    },
    {
      value: "archived",
      label: "Archive",
      description: "Completed or hidden work",
    },
  ];

  return (
    <div className="tasks-archive-tabs" style={archiveTabsStyle}>
      {options.map((option) => {
        const isActive = archiveView === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onArchiveViewChange(option.value)}
            style={{
              ...archiveTabButtonStyle,
              background: isActive
                ? "linear-gradient(180deg, rgba(239,246,255,0.96) 0%, rgba(255,255,255,0.96) 100%)"
                : "rgba(255,255,255,0.72)",
              borderColor: isActive
                ? "rgba(59,130,246,0.28)"
                : "rgba(226,232,240,0.92)",
              color: isActive ? "#1d4ed8" : "#475569",
              boxShadow: isActive
                ? "0 12px 24px rgba(59,130,246,0.07), inset 0 0 0 1px rgba(59,130,246,0.04)"
                : "none",
            }}
          >
            <span style={archiveTabLabelStyle}>{option.label}</span>
            <span style={archiveTabDescriptionStyle}>
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const archiveTabsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 180px))",
  gap: 8,
  justifyContent: "start",
};

const archiveTabButtonStyle: CSSProperties = {
  minHeight: 46,
  borderRadius: 14,
  padding: "9px 12px",
  border: "1px solid rgba(226,232,240,0.92)",
  cursor: "pointer",
  textAlign: "left",
  display: "grid",
  gap: 2,
};

const archiveTabLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 950,
};

const archiveTabDescriptionStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 750,
  color: "#64748b",
};