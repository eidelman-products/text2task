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
  onSearchTermChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onSortOptionChange,
  onExportCsv,
}: TasksToolbarProps) {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        padding: 12,
        borderRadius: 18,
        border: "2px solid rgba(168,85,247,0.45)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.98) 35%, rgba(255,247,237,0.96) 100%)",
        boxShadow:
          "0 10px 24px rgba(59,130,246,0.10), inset 0 0 0 1px rgba(59,130,246,0.06)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2.1fr 1fr 1fr 1fr auto",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div style={searchWrapStyle}>
          <span style={{ fontSize: 20, color: "#7c3aed" }}>⌕</span>
          <input
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Search client, task, amount, deadline..."
            style={searchInputStyle}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            onStatusFilterChange(e.target.value as TaskStatusFilter)
          }
          style={statusSelectStyle}
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) =>
            onPriorityFilterChange(e.target.value as TaskPriorityFilter)
          }
          style={prioritySelectStyle}
        >
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <select
          value={sortOption}
          onChange={(e) => onSortOptionChange(e.target.value as TaskSortOption)}
          style={sortSelectStyle}
        >
          <option value="client-asc">Client A → Z</option>
          <option value="client-desc">Client Z → A</option>
          <option value="task-asc">Task A → Z</option>
          <option value="task-desc">Task Z → A</option>
          <option value="deadline-asc">Deadline A → Z</option>
          <option value="deadline-desc">Deadline Z → A</option>
        </select>

        <button
          type="button"
          onClick={onExportCsv}
          style={{
            border: "1px solid rgba(15,23,42,0.06)",
            borderRadius: 12,
            padding: "11px 15px",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 10px 20px rgba(15,23,42,0.16)",
          }}
        >
          ⬇ Export CSV
        </button>
      </div>

      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#64748b",
        }}
      >
        Showing {visibleTasksCount} matching tasks
      </div>
    </div>
  );
}

const searchWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: "1px solid rgba(168,85,247,0.14)",
  borderRadius: 12,
  padding: "0 14px",
  minHeight: 46,
  background: "rgba(196,181,253,0.24)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
};

const searchInputStyle: CSSProperties = {
  border: "none",
  outline: "none",
  width: "100%",
  background: "transparent",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: 15,
};

const sharedSelectStyle: CSSProperties = {
  border: "1px solid rgba(203,213,225,0.95)",
  borderRadius: 12,
  padding: "11px 13px",
  width: "100%",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 14,
  outline: "none",
  minHeight: 46,
  boxShadow: "0 1px 4px rgba(15,23,42,0.025)",
};

const statusSelectStyle: CSSProperties = {
  ...sharedSelectStyle,
  background: "rgba(191,219,254,0.30)",
};

const prioritySelectStyle: CSSProperties = {
  ...sharedSelectStyle,
  background: "rgba(253,230,138,0.30)",
};

const sortSelectStyle: CSSProperties = {
  ...sharedSelectStyle,
  background: "rgba(216,180,254,0.28)",
};