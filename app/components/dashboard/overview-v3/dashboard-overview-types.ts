import type { TaskRow } from "../tasks-view";
import type { PaidCompletedProgress } from "../dashboard-helpers";
import { getIncomeAnalytics } from "@/lib/tasks/get-income-analytics";
import type { PriorityProjectSummary } from "./dashboard-priority-work-utils";

export type DashboardOverviewV3Props = {
  openTasks: number;
  highPriority: number;
  doneTasks: number;
  progress: PaidCompletedProgress;
  priorityWork: PriorityProjectSummary;
  activeTasks: TaskRow[];
  analytics: ReturnType<typeof getIncomeAnalytics>;
  userEmail: string;
  onGoToExtract: () => void;
  onGoToTasks: () => void;
};

export type DashboardStatTone = "neutral" | "warning" | "success" | "growth";
export type DashboardTrendTone = "up" | "down" | "flat";
export type UrgentNoteTone = "overdue" | "today" | "tomorrow" | "soon";
export type ProjectCardTone = "normal" | "progress" | "review" | "done" | "high";

export type DashboardStatItem = {
  label: string;
  value: string | number;
  helper: string;
  tone: DashboardStatTone;
  trendLabel?: string;
  trendTone?: DashboardTrendTone;
};

export type UrgentBoardNote = {
  id: number;
  title: string;
  clientName: string;
  deadlineLabel: string;
  usesProjectDeadline: boolean;
  tone: UrgentNoteTone;
  openLabel: string;
};

export type ProjectSnapshotItem = {
  id: number;
  clientName: string;
  title: string;
  summary: string;
  amount: string;
  deadline: string;
  createdAt: string | null;
  taskCount: number;
  completedTaskCount: number;
  priority: string;
  status: string;
  tone: ProjectCardTone;
};
