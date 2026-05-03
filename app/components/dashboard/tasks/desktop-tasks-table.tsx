import type { KeyboardEvent, MutableRefObject } from "react";
import TaskRowComponent from "../task-row";
import type { TaskArchiveView, TaskRow } from "../tasks-view";
import {
  desktopHeaderRowStyle,
  desktopTableStyle,
  headerCellStyle,
  taskTableMinWidth,
} from "./task-table-layout";

type DesktopTasksTableProps = {
  tasks: TaskRow[];
  allVisibleSelected: boolean;
  hasMatchingTasks: boolean;
  savingTaskIds: Record<number, boolean>;
  savedTaskIds: Record<number, boolean>;
  deletingTaskIds: Record<number, boolean>;
  copiedTaskIds: Record<number, boolean>;
  selectedTaskIds: number[];
  archiveView: TaskArchiveView;
  flashTaskId: number | null;
  taskRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  onToggleSelectAllVisible: () => void;
  onEnterBlur: (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  toggleSelect: (taskId: number) => void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
  updateTaskStatus: (taskId: number, status: string) => Promise<void> | void;
  copyTask: (taskId: number) => void;
  archiveTask: (taskId: number) => Promise<void> | void;
  restoreTask: (taskId: number) => Promise<void> | void;
  permanentlyDeleteTask: (taskId: number) => Promise<void> | void;
  formatCreatedDate: (value?: string | null) => string;
};

export default function DesktopTasksTable({
  tasks,
  allVisibleSelected,
  hasMatchingTasks,
  savingTaskIds,
  savedTaskIds,
  deletingTaskIds,
  copiedTaskIds,
  selectedTaskIds,
  archiveView,
  flashTaskId,
  taskRefs,
  onToggleSelectAllVisible,
  onEnterBlur,
  toggleSelect,
  updateTaskField,
  updateTaskStatus,
  copyTask,
  archiveTask,
  restoreTask,
  permanentlyDeleteTask,
  formatCreatedDate,
}: DesktopTasksTableProps) {
  return (
    <div className="tasks-desktop-table" style={desktopTableStyle}>
      <div style={desktopHeaderRowStyle}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <input
            type="checkbox"
            checked={allVisibleSelected}
            disabled={!hasMatchingTasks}
            onChange={onToggleSelectAllVisible}
            style={{
              width: 16,
              height: 16,
              cursor: hasMatchingTasks ? "pointer" : "not-allowed",
              opacity: hasMatchingTasks ? 1 : 0.45,
            }}
          />
        </div>

        <div style={headerCellStyle}>👤 Client & Task</div>
        <div style={headerCellStyle}>💲 Amount</div>
        <div style={headerCellStyle}>📅 Deadline</div>
        <div style={headerCellStyle}>⚑ Priority</div>
        <div style={headerCellStyle}>↗ Status</div>
        <div style={headerCellStyle}>⚙ Actions</div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 14,
          paddingTop: 14,
          minWidth: taskTableMinWidth,
        }}
      >
        {tasks.map((task, index) => {
          const isSaving = !!savingTaskIds[task.id];
          const isSaved = !!savedTaskIds[task.id];
          const isDeleting = !!deletingTaskIds[task.id];
          const isCopied = !!copiedTaskIds[task.id];
          const isHighlighted = flashTaskId === task.id;
          const rowArchiveView =
            archiveView === "archived" || task.is_archived
              ? "archived"
              : "active";

          return (
            <div
              key={`desktop-${task.id}`}
              ref={(node) => {
                taskRefs.current[task.id] = node;
              }}
              style={{
                borderRadius: 22,
                overflow: "hidden",
                boxShadow: isHighlighted
                  ? "0 0 0 2px rgba(245,158,11,0.22), 0 16px 34px rgba(245,158,11,0.10)"
                  : "none",
                transition: "box-shadow 0.28s ease, transform 0.28s ease",
                transform: isHighlighted ? "translateY(-1px)" : "translateY(0)",
              }}
            >
              <TaskRowComponent
                rowIndex={index}
                task={task}
                createdLabel={formatCreatedDate(task.created_at)}
                isSaving={isSaving}
                isSaved={isSaved}
                isDeleting={isDeleting}
                isCopied={isCopied}
                isSelected={selectedTaskIds.includes(task.id)}
                archiveView={rowArchiveView}
                toggleSelect={toggleSelect}
                onEnterBlur={onEnterBlur}
                updateTaskField={updateTaskField}
                updateTaskStatus={updateTaskStatus}
                copyTask={copyTask}
                archiveTask={archiveTask}
                restoreTask={restoreTask}
                permanentlyDeleteTask={permanentlyDeleteTask}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}