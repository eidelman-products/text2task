import type { CSSProperties } from "react";
import type {
  TaskPriorityFilter,
  TaskSortOption,
  TaskStatusFilter,
} from "./task-filters";

type TasksToolbarProps = {
  searchTerm: string;
  statusFilter: TaskStatusFilter;
  priorityFilter: TaskPriorityFilter;
  sortOption: TaskSortOption;
  visibleTasksCount: number;
  visibleProjectsCount: number;
  onSearchTermChange: (value: string) => void;
  onStatusFilterChange: (value: TaskStatusFilter) => void;
  onPriorityFilterChange: (value: TaskPriorityFilter) => void;
  onSortOptionChange: (value: TaskSortOption) => void;
  onExportCsv: () => void;
};

export default function TasksToolbar({
  searchTerm,
  statusFilter,
  priorityFilter,
  sortOption,
  visibleTasksCount,
  visibleProjectsCount,
  onSearchTermChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onSortOptionChange,
  onExportCsv,
}: TasksToolbarProps) {
  return (
    <div className="tasks-toolbar" style={toolbarShellStyle}>
      <style>{responsiveToolbarCss}</style>

      <div style={toolbarGlowStyle} />
      <div style={toolbarAccentStyle} />

      <div className="tasks-toolbar-grid" style={toolbarGridStyle}>
        <label className="tasks-toolbar-search" style={searchWrapStyle}>
          <span style={searchIconStyle}>⌕</span>

          <input
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Search client, project, task..."
            style={searchInputStyle}
          />
        </label>

        <FilterSelect
          value={statusFilter}
          onChange={(value) => onStatusFilterChange(value as TaskStatusFilter)}
          ariaLabel="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </FilterSelect>

        <FilterSelect
          value={priorityFilter}
          onChange={(value) =>
            onPriorityFilterChange(value as TaskPriorityFilter)
          }
          ariaLabel="Filter by priority"
        >
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </FilterSelect>

        <FilterSelect
          value={sortOption}
          onChange={(value) => onSortOptionChange(value as TaskSortOption)}
          ariaLabel="Sort tasks"
        >
          <option value="created-desc">Newest first</option>
          <option value="created-asc">Oldest first</option>
          <option value="client-asc">Client A → Z</option>
          <option value="client-desc">Client Z → A</option>
          <option value="task-asc">Project A → Z</option>
          <option value="task-desc">Project Z → A</option>
          <option value="deadline-asc">Deadline A → Z</option>
          <option value="deadline-desc">Deadline Z → A</option>
        </FilterSelect>

        <button
          type="button"
          onClick={onExportCsv}
          style={exportButtonStyle}
          className="tasks-toolbar-export"
        >
          <span style={exportIconStyle}>↓</span>
          Export CSV
        </button>
      </div>

      <div style={toolbarMetaRowStyle}>
        <span style={resultTextStyle}>
          Showing{" "}
          <strong style={resultStrongStyle}>
            {visibleProjectsCount} project
            {visibleProjectsCount === 1 ? "" : "s"}
          </strong>{" "}
          ·{" "}
          <strong style={resultStrongStyle}>
            {visibleTasksCount} task{visibleTasksCount === 1 ? "" : "s"}
          </strong>
        </span>

        <span style={hintTextStyle}>Grouped by client project</span>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  ariaLabel,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={selectStyle}
      aria-label={ariaLabel}
      className="tasks-toolbar-select"
    >
      {children}
    </select>
  );
}

const toolbarShellStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: 11,
  padding: "4px 2px 2px",
  borderRadius: 0,
  border: "none",
  background: "transparent",
  boxShadow: "none",
  overflow: "visible",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
};

const toolbarGlowStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  right: -80,
  top: -92,
  width: 260,
  height: 160,
  borderRadius: 999,
  background:
    "radial-gradient(circle, rgba(37,99,235,0.055) 0%, rgba(37,99,235,0.024) 42%, transparent 72%)",
  filter: "blur(18px)",
  pointerEvents: "none",
};

const toolbarAccentStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  width: 3,
  background:
    "linear-gradient(180deg, rgba(37,99,235,0.74) 0%, rgba(147,197,253,0.42) 100%)",
};

const toolbarGridStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns:
    "minmax(260px, 2.1fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(160px, 1fr) auto",
  gap: 10,
  alignItems: "center",
  width: "100%",
  minWidth: 0,
};

const searchWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: "1px solid rgba(203,213,225,0.78)",
  borderRadius: 14,
  padding: "0 13px",
  minHeight: 44,
  background: "rgba(255,255,255,0.94)",
  boxShadow: "0 1px 2px rgba(15,23,42,0.018)",
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box",
};

const searchIconStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  fontSize: 14,
  lineHeight: 1,
  color: "#2563eb",
  background: "rgba(239,246,255,0.92)",
  border: "1px solid rgba(191,219,254,0.72)",
  fontWeight: 950,
  flexShrink: 0,
};

const searchInputStyle: CSSProperties = {
  border: "none",
  outline: "none",
  width: "100%",
  minWidth: 0,
  background: "transparent",
  color: "#0f172a",
  fontWeight: 650,
  fontSize: 14,
};

const selectStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 44,
  border: "1px solid rgba(203,213,225,0.78)",
  borderRadius: 14,
  padding: "0 12px",
  color: "#334155",
  background: "rgba(255,255,255,0.94)",
  fontWeight: 760,
  fontSize: 13,
  outline: "none",
  boxShadow: "0 1px 2px rgba(15,23,42,0.018)",
  cursor: "pointer",
  boxSizing: "border-box",
};

const exportButtonStyle: CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "1px solid rgba(191,219,254,0.82)",
  borderRadius: 14,
  padding: "0 16px",
  background: "rgba(239,246,255,0.82)",
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 950,
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxShadow: "0 1px 2px rgba(15,23,42,0.018)",
  boxSizing: "border-box",
};

const exportIconStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 7,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.78)",
  fontSize: 13,
  lineHeight: 1,
  fontWeight: 950,
};

const toolbarMetaRowStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 12,
  padding: "0 2px 0 1px",
  flexWrap: "wrap",
};

const resultTextStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
};

const resultStrongStyle: CSSProperties = {
  color: "#334155",
  fontWeight: 950,
};

const hintTextStyle: CSSProperties = {
  display: "none",
  fontSize: 12,
  fontWeight: 900,
  color: "#2563eb",
};

const responsiveToolbarCss = `
  .tasks-toolbar input::placeholder {
    color: #94a3b8;
  }

  .tasks-toolbar-search,
  .tasks-toolbar-select,
  .tasks-toolbar-export {
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      box-shadow 160ms ease,
      background 160ms ease;
  }

  .tasks-toolbar-search:focus-within,
  .tasks-toolbar-select:focus {
    border-color: rgba(37,99,235,0.56) !important;
    box-shadow:
      0 0 0 4px rgba(37,99,235,0.07),
      inset 0 1px 0 rgba(255,255,255,0.92) !important;
  }

  .tasks-toolbar-export:hover {
    transform: translateY(-1px);
    box-shadow:
      0 8px 18px rgba(37,99,235,0.07),
      inset 0 1px 0 rgba(255,255,255,0.94) !important;
  }

  @media (max-width: 900px) {
    .tasks-toolbar {
      padding: 12px 12px 11px !important;
      border-radius: 19px !important;
    }

    .tasks-toolbar-grid {
      grid-template-columns: 1fr 1fr !important;
      gap: 9px !important;
    }

    .tasks-toolbar-search {
      grid-column: 1 / -1 !important;
    }

    .tasks-toolbar-export {
      grid-column: 1 / -1 !important;
      width: 100% !important;
    }
  }

  @media (max-width: 520px) {
    .tasks-toolbar {
      padding: 11px 10px 10px !important;
      gap: 9px !important;
      border-radius: 17px !important;
    }

    .tasks-toolbar-grid {
      grid-template-columns: 1fr !important;
      gap: 8px !important;
    }

    .tasks-toolbar-search,
    .tasks-toolbar-export {
      grid-column: auto !important;
    }

    .tasks-toolbar select,
    .tasks-toolbar button,
    .tasks-toolbar input {
      font-size: 13px !important;
    }
  }
`;
