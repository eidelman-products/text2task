"use client";

import type React from "react";
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
  status: string;
  priority: string;
  amount: string;
  deadline: string;
  taskCount: number;
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
  return (
    task.project?.title?.trim() ||
    task.task?.trim() ||
    "Project workspace"
  );
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

function getStatus(task: TaskRow, kind: ActivityKind) {
  const status =
    kind === "task"
      ? task.status || task.project?.status
      : task.project?.status || task.status;

  return String(status || "New").trim() || "New";
}

function getPriority(task: TaskRow, kind: ActivityKind) {
  const priority =
    kind === "task"
      ? task.priority || task.project?.priority
      : task.project?.priority || task.priority;

  return String(priority || "Normal").trim() || "Normal";
}

function getAmount(task: TaskRow, kind: ActivityKind) {
  const projectAmount = String(task.project?.amount || "").trim();
  const taskAmount = String(task.amount || "").trim();

  return kind === "task"
    ? taskAmount || projectAmount || ""
    : projectAmount || taskAmount || "";
}

function formatReadableDeadline(value?: string | null) {
  if (!value) return "";

  const trimmed = String(value).trim();
  if (!trimmed) return "";

  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return trimmed;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getDeadline(task: TaskRow, kind: ActivityKind) {
  const projectDeadline = String(
    task.project?.deadline_text || task.project?.deadline_date || ""
  ).trim();

  const taskDeadline = String(
    task.deadline_original_text || task.deadline_date || task.deadline || ""
  ).trim();

  return formatReadableDeadline(
    kind === "task"
      ? taskDeadline || projectDeadline
      : projectDeadline || taskDeadline
  );
}

function formatShortDate(value?: string | null) {
  if (!value) return "Recently";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Recently";

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
    return "Updated today";
  }

  if (date >= startOfYesterday) {
    return "Updated yesterday";
  }

  return `Updated ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date)}`;
}

function getStatusStyle(status: string): React.CSSProperties {
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

function getPriorityStyle(priority: string): React.CSSProperties {
  const normalized = priority.toLowerCase();

  if (normalized === "high") {
    return {
      color: "#b91c1c",
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.16)",
    };
  }

  if (normalized === "medium") {
    return {
      color: "#92400e",
      background: "rgba(245,158,11,0.08)",
      border: "1px solid rgba(245,158,11,0.16)",
    };
  }

  if (normalized === "low") {
    return {
      color: "#15803d",
      background: "rgba(34,197,94,0.08)",
      border: "1px solid rgba(34,197,94,0.16)",
    };
  }

  return {
    color: "#475569",
    background: "rgba(148,163,184,0.08)",
    border: "1px solid rgba(148,163,184,0.16)",
  };
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

  const projectTitle = getProjectTitle(task);

  return {
    id: task.id,
    key: `task-${task.id}-${updatedTime}`,
    kind: "task",
    title: getTaskTitle(task),
    clientName: getClientName(task),
    projectTitle,
    status: getStatus(task, "task"),
    priority: getPriority(task, "task"),
    amount: getAmount(task, "task"),
    deadline: getDeadline(task, "task"),
    taskCount: 1,
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
    status: getStatus(task, "project"),
    priority: getPriority(task, "project"),
    amount: getAmount(task, "project"),
    deadline: getDeadline(task, "project"),
    taskCount: candidate.taskCount,
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

function DetailChip({ children }: { children: React.ReactNode }) {
  if (!children) return null;

  return <span style={detailChipStyle}>{children}</span>;
}

function ActivityCard({ item }: { item: RecentActivityItem }) {
  const statusStyle = getStatusStyle(item.status);
  const priorityStyle = getPriorityStyle(item.priority);

  return (
    <button
      type="button"
      className="recent-activity-card"
      onClick={() => openTaskInNewWindow(item.id)}
      style={cardStyle}
      aria-label={`Open ${item.title}`}
    >
      <div style={cardGlowStyle} />

      <div className="recent-activity-card-main" style={cardMainStyle}>
        <div style={iconWrapStyle}>
          <span style={iconDotStyle} />
        </div>

        <div style={contentStyle}>
          <div className="recent-activity-card-top" style={topLineStyle}>
            <div style={titleWrapStyle}>
              <div style={titleStyle}>{item.title}</div>
              <div style={subtitleStyle}>
                {item.clientName}
                {item.projectTitle ? ` · ${item.projectTitle}` : ""}
              </div>
            </div>

            <div className="recent-activity-date-wrap" style={dateWrapStyle}>
              <span style={dateStyle}>{formatShortDate(item.updatedAt)}</span>
              <span className="recent-activity-arrow" style={arrowStyle}>
                ↗
              </span>
            </div>
          </div>

          <div style={chipsRowStyle}>
            <span style={{ ...pillStyle, ...statusStyle }}>{item.status}</span>

            <span style={{ ...pillStyle, ...priorityStyle }}>
              {item.priority}
            </span>

            {item.deadline ? <DetailChip>Due {item.deadline}</DetailChip> : null}
            {item.amount ? <DetailChip>{item.amount}</DetailChip> : null}

            {item.kind === "project" && item.taskCount > 1 ? (
              <DetailChip>{item.taskCount} tasks</DetailChip>
            ) : (
              <DetailChip>{item.kind === "task" ? "Task update" : "Project update"}</DetailChip>
            )}
          </div>

          <div style={footerLineStyle}>
            <span>{formatUpdatedLabel(item.updatedAt)}</span>
            <span style={openTextStyle}>Open task</span>
          </div>
        </div>
      </div>
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

          <div style={headingStyle}>Latest workspace changes</div>

          <div style={subTextStyle}>
            The most recent task, subtask, and project updates in your CRM.
          </div>
        </div>

        <span style={countPillStyle}>{recentItems.length} updated</span>
      </div>

      {recentItems.length ? (
        <div style={listStyle}>
          {recentItems.map((item) => (
            <ActivityCard key={item.key} item={item} />
          ))}
        </div>
      ) : (
        <div style={emptyStyle}>
          <div style={emptyIconStyle}>↗</div>

          <div style={emptyTextWrapStyle}>
            <div style={emptyTitleStyle}>No recent activity yet</div>

            <div style={emptyTextStyle}>
              Task and project updates will appear here after your first change.
            </div>
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

  .recent-activity-card {
    position: relative;
    overflow: hidden;
    transition:
      transform 170ms ease,
      box-shadow 170ms ease,
      border-color 170ms ease,
      background 170ms ease;
  }

  .recent-activity-card:hover {
    transform: translateY(-2px);
    border-color: rgba(99,102,241,0.22) !important;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,255,0.98)) !important;
    box-shadow:
      0 22px 42px rgba(15,23,42,0.085),
      0 0 0 1px rgba(99,102,241,0.06),
      inset 0 1px 0 rgba(255,255,255,0.98) !important;
  }

  .recent-activity-card:hover .recent-activity-arrow {
    transform: translate(2px, -2px);
  }

  @media (max-width: 900px) {
    .recent-activity-card-main {
      align-items: flex-start !important;
    }
  }

  @media (max-width: 720px) {
    .recent-activity-root {
      border-radius: 24px !important;
      padding: 16px !important;
    }

    .recent-activity-card-top {
      align-items: flex-start !important;
      flex-direction: column !important;
    }

    .recent-activity-date-wrap {
      width: 100% !important;
      justify-content: space-between !important;
    }
  }
`;

const shellStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  borderRadius: 30,
  padding: 18,
  border: "1px solid rgba(226,232,240,0.82)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,255,0.95) 100%)",
  boxShadow:
    "0 26px 58px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.98)",
  display: "grid",
  gap: 14,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const headerTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const kickerStyle: React.CSSProperties = {
  color: "#4f46e5",
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const headingStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 20,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: "-0.045em",
};

const subTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 650,
  maxWidth: 560,
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

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  border: "1px solid rgba(226,232,240,0.78)",
  borderRadius: 20,
  padding: 13,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,255,0.82) 100%)",
  boxShadow:
    "0 14px 28px rgba(15,23,42,0.045), inset 0 1px 0 rgba(255,255,255,0.98)",
  cursor: "pointer",
  textAlign: "left",
};

const cardGlowStyle: React.CSSProperties = {
  position: "absolute",
  inset: "0 auto 0 0",
  width: 4,
  background:
    "linear-gradient(180deg, rgba(99,102,241,0.95), rgba(168,85,247,0.65), rgba(14,165,233,0.45))",
};

const cardMainStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  minWidth: 0,
};

const iconWrapStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.08))",
  border: "1px solid rgba(99,102,241,0.12)",
  flexShrink: 0,
  marginLeft: 2,
};

const iconDotStyle: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
  background: "#6366f1",
  boxShadow: "0 0 0 5px rgba(99,102,241,0.12)",
};

const contentStyle: React.CSSProperties = {
  display: "grid",
  gap: 9,
  minWidth: 0,
  flex: 1,
};

const topLineStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  minWidth: 0,
};

const titleWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  minWidth: 0,
};

const titleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  lineHeight: 1.25,
  fontWeight: 950,
  letterSpacing: "-0.03em",
  display: "-webkit-box",
  WebkitLineClamp: 1,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 700,
  display: "-webkit-box",
  WebkitLineClamp: 1,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const dateWrapStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "#4338ca",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const dateStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 850,
};

const arrowStyle: React.CSSProperties = {
  color: "#4338ca",
  fontWeight: 950,
  transition: "transform 170ms ease",
};

const chipsRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
};

const pillStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 950,
};

const detailChipStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 8px",
  color: "#475569",
  background: "rgba(248,250,252,0.92)",
  border: "1px solid rgba(226,232,240,0.82)",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 900,
};

const footerLineStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 800,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const openTextStyle: React.CSSProperties = {
  color: "#4338ca",
  fontWeight: 950,
};

const emptyStyle: React.CSSProperties = {
  borderRadius: 20,
  border: "1px dashed rgba(148,163,184,0.3)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(248,250,255,0.68))",
  padding: 16,
  display: "flex",
  alignItems: "center",
  gap: 13,
};

const emptyIconStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "rgba(99,102,241,0.08)",
  color: "#4338ca",
  fontSize: 17,
  fontWeight: 950,
  flexShrink: 0,
};

const emptyTextWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const emptyTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 950,
};

const emptyTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 650,
};