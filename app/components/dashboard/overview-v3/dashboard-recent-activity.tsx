"use client";

import type React from "react";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../ui/tokens";
import type { TaskRow } from "../tasks-view";
import { openTaskInNewWindow } from "./dashboard-overview-utils";

type Props = {
  tasks: TaskRow[];
};

type ActivityKind = "task" | "project";

type RecentActivityItem = {
  id: number;
  key: string;
  kind: ActivityKind;
  title: string;
  clientName: string;
  projectTitle: string;
  updatedAt: string | null;
  updatedTime: number;
};

type ProjectActivityCandidate = {
  id: number;
  projectKey: string;
  taskCount: number;
  newestTaskUpdatedTime: number;
  projectUpdatedAt: string | null;
  projectUpdatedTime: number;
  representativeTask: TaskRow;
};

function getClientName(task: TaskRow) {
  return (
    task.project?.client_name?.trim() ||
    task.client?.name?.trim() ||
    "Unassigned client"
  );
}

function getProjectTitle(task: TaskRow) {
  return task.project?.title?.trim() || task.task?.trim() || "Project workspace";
}

function getTaskTitle(task: TaskRow) {
  return task.task?.trim() || task.project?.title?.trim() || "Untitled task";
}

function getProjectKey(task: TaskRow) {
  return String(task.project_id || task.project?.id || `standalone-${task.id}`);
}

function getTime(value?: string | null) {
  if (!value) return 0;

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function formatShortDate(value?: string | null) {
  if (!value) return "Recent";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Recent";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatUpdatedLabel(value?: string | null) {
  if (!value) return "Updated recently";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Updated recently";

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) {
    return "Today";
  }

  if (date >= startOfYesterday) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getActivityLabel(kind: ActivityKind) {
  return kind === "project" ? "Project details updated" : "Task updated";
}

function isVisibleActivityTask(task: TaskRow) {
  if (!task) return false;
  if (task.deleted_at || task.project?.deleted_at) return false;
  if (task.is_archived || task.project?.is_archived) return false;

  return true;
}

function buildTaskActivityItem(task: TaskRow): RecentActivityItem | null {
  const updatedAt = task.updated_at || null;
  const updatedTime = getTime(updatedAt);

  if (!updatedAt || updatedTime <= 0) return null;

  return {
    id: task.id,
    key: `task-${task.id}-${updatedTime}`,
    kind: "task",
    title: getTaskTitle(task),
    clientName: getClientName(task),
    projectTitle: getProjectTitle(task),
    updatedAt,
    updatedTime,
  };
}

function buildProjectActivityCandidates(tasks: TaskRow[]) {
  const projects = new Map<string, ProjectActivityCandidate>();

  for (const task of tasks) {
    if (!isVisibleActivityTask(task)) continue;

    const projectUpdatedAt = task.project?.updated_at || null;
    const projectUpdatedTime = getTime(projectUpdatedAt);
    const taskUpdatedTime = getTime(task.updated_at || null);
    const projectKey = getProjectKey(task);

    const existing = projects.get(projectKey);

    if (!existing) {
      projects.set(projectKey, {
        id: task.id,
        projectKey,
        taskCount: 1,
        newestTaskUpdatedTime: taskUpdatedTime,
        projectUpdatedAt,
        projectUpdatedTime,
        representativeTask: task,
      });

      continue;
    }

    projects.set(projectKey, {
      ...existing,
      taskCount: existing.taskCount + 1,
      newestTaskUpdatedTime: Math.max(
        existing.newestTaskUpdatedTime,
        taskUpdatedTime
      ),
      projectUpdatedAt:
        projectUpdatedTime > existing.projectUpdatedTime
          ? projectUpdatedAt
          : existing.projectUpdatedAt,
      projectUpdatedTime: Math.max(
        existing.projectUpdatedTime,
        projectUpdatedTime
      ),
      representativeTask:
        projectUpdatedTime > existing.projectUpdatedTime
          ? task
          : existing.representativeTask,
    });
  }

  return [...projects.values()];
}

function buildProjectActivityItem(
  candidate: ProjectActivityCandidate
): RecentActivityItem | null {
  if (!candidate.projectUpdatedAt || candidate.projectUpdatedTime <= 0) {
    return null;
  }

  /*
    Project-level activity should appear once per project only when the project
    itself was updated after the latest task/subtask update.

    If two subtasks were updated today, they should both appear individually.
    The project row should not collapse or hide them.
  */
  if (candidate.projectUpdatedTime <= candidate.newestTaskUpdatedTime) {
    return null;
  }

  const task = candidate.representativeTask;

  return {
    id: task.id,
    key: `project-${candidate.projectKey}-${candidate.projectUpdatedTime}`,
    kind: "project",
    title: getProjectTitle(task),
    clientName: getClientName(task),
    projectTitle: "Project details updated",
    updatedAt: candidate.projectUpdatedAt,
    updatedTime: candidate.projectUpdatedTime,
  };
}

function buildRecentActivityItems(tasks: TaskRow[]) {
  const visibleTasks = tasks.filter(isVisibleActivityTask);

  const taskItems = visibleTasks
    .map(buildTaskActivityItem)
    .filter(Boolean) as RecentActivityItem[];

  const projectItems = buildProjectActivityCandidates(visibleTasks)
    .map(buildProjectActivityItem)
    .filter(Boolean) as RecentActivityItem[];

  return [...taskItems, ...projectItems]
    .sort((a, b) => b.updatedTime - a.updatedTime)
    .slice(0, 5);
}

function ActivityRow({ item }: { item: RecentActivityItem }) {
  return (
    <button
      type="button"
      className="recent-activity-row"
      onClick={() => openTaskInNewWindow(item.id)}
      style={rowStyle}
      aria-label={`Open ${item.title}`}
    >
      <div style={dateColumnStyle}>
        <span style={dateStyle}>{formatShortDate(item.updatedAt)}</span>
        <span style={relativeDateStyle}>{formatUpdatedLabel(item.updatedAt)}</span>
      </div>

      <div style={contentStyle}>
        <div style={titleStyle}>{item.title}</div>

        <div style={metaStyle}>
          <span style={clientStyle}>{item.clientName}</span>
          <span style={metaSeparatorStyle}>•</span>
          <span style={activityTypeStyle}>{getActivityLabel(item.kind)}</span>
        </div>
      </div>

      <span className="recent-activity-open" style={openTextStyle}>
        Open →
      </span>
    </button>
  );
}

export default function DashboardRecentActivity({ tasks }: Props) {
  const recentItems = buildRecentActivityItems(tasks);

  return (
    <section className="recent-activity-root" style={shellStyle}>
      <style>{responsiveCss}</style>

      <div style={headerStyle}>
        <div style={headerTextStyle}>
          <div style={kickerStyle}>Recent activity</div>

          <div style={headingRowStyle}>
            <div style={headingStyle}>Latest workspace changes</div>
            <span style={countTextStyle}>{recentItems.length} updated</span>
          </div>

          <div style={subTextStyle}>
            The latest project and task updates in your workspace.
          </div>
        </div>
      </div>

      {recentItems.length ? (
        <div style={listStyle}>
          {recentItems.map((item) => (
            <ActivityRow key={item.key} item={item} />
          ))}
        </div>
      ) : (
        <div style={emptyStyle}>
          <div style={emptyTitleStyle}>No recent activity yet</div>

          <div style={emptyTextStyle}>
            Task and project updates will appear here after your first change.
          </div>
        </div>
      )}
    </section>
  );
}

const responsiveCss = `
  .recent-activity-root,
  .recent-activity-root * {
    box-sizing: border-box;
  }

  .recent-activity-root button {
    font-family: inherit;
  }

  .recent-activity-row {
    transition:
      background 170ms ease,
      border-color 170ms ease,
      box-shadow 170ms ease,
      transform 170ms ease;
  }

  .recent-activity-row:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.99) !important;
    border-color: rgba(37, 99, 235, 0.16) !important;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.055) !important;
  }

  .recent-activity-row:hover .recent-activity-open {
    color: #1d4ed8 !important;
    transform: translateX(2px);
  }

  @media (max-width: 760px) {
    .recent-activity-root {
      max-width: 100% !important;
    }

    .recent-activity-row {
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 7px !important;
      min-height: 0 !important;
      padding: 9px 11px !important;
    }

    .recent-activity-row > div:first-child {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding-right: 0 !important;
      border-right: 0 !important;
    }

    .recent-activity-row > span:last-child {
      justify-self: start !important;
      padding-left: 0 !important;
      font-size: 11px !important;
    }
  }
`;

const shellStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  display: "grid",
  gap: dashboardSpacing[3],
};

const headerStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  gap: dashboardSpacing[3],
  alignItems: "flex-start",
};

const headerTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const kickerStyle: React.CSSProperties = {
  color: dashboardColors.primary[600],
  fontSize: 10.5,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const headingStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 19,
  lineHeight: 1.12,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.04em",
};

const headingRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: dashboardSpacing[2],
  flexWrap: "wrap",
};

const subTextStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 12.5,
  lineHeight: dashboardTypography.lineHeight.normal,
  fontWeight: dashboardTypography.weight.medium,
};

const countTextStyle: React.CSSProperties = {
  color: dashboardColors.text.secondary,
  fontSize: 10.5,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.bold,
  whiteSpace: "nowrap",
  padding: "4px 7px",
  borderRadius: dashboardRadii.full,
  border: `1px solid ${dashboardColors.border.subtle}`,
  background: "rgba(248, 250, 252, 0.78)",
};

const listStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 820,
  justifySelf: "start",
  display: "grid",
  gap: dashboardSpacing[2],
};

const rowStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 58,
  display: "grid",
  gridTemplateColumns: "88px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: dashboardSpacing[3],
  border: `1px solid ${dashboardColors.border.subtle}`,
  borderRadius: dashboardRadii.lg,
  padding: "10px 13px",
  background: "rgba(255, 255, 255, 0.78)",
  boxShadow: "none",
  cursor: "pointer",
  textAlign: "left",
};

const dateColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
  paddingRight: dashboardSpacing[3],
  borderRight: `1px solid ${dashboardColors.border.subtle}`,
};

const dateStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 12,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
  whiteSpace: "nowrap",
};

const relativeDateStyle: React.CSSProperties = {
  color: dashboardColors.text.subtle,
  fontSize: 10.5,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.bold,
  whiteSpace: "nowrap",
};

const contentStyle: React.CSSProperties = {
  minWidth: 0,
  maxWidth: 680,
  display: "grid",
  gap: 4,
};

const titleStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 14,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.03em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metaStyle: React.CSSProperties = {
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

const clientStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metaSeparatorStyle: React.CSSProperties = {
  color: dashboardColors.text.subtle,
  flexShrink: 0,
};

const activityTypeStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  flexShrink: 0,
};

const openTextStyle: React.CSSProperties = {
  color: dashboardColors.primary[700],
  fontSize: 11.5,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
  whiteSpace: "nowrap",
  paddingLeft: dashboardSpacing[2],
  transition: "color 170ms ease, transform 170ms ease",
};

const emptyStyle: React.CSSProperties = {
  borderRadius: dashboardRadii.xl,
  border: `1px dashed ${dashboardColors.border.default}`,
  background: "rgba(255, 255, 255, 0.66)",
  padding: dashboardSpacing[4],
  display: "grid",
  gap: 5,
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
