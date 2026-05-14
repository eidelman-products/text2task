import type { TaskRow } from "../tasks-view";
import type {
  PaidCompletedProgress,
  UrgentPreviewTask,
} from "../dashboard-helpers";
import { getIncomeAnalytics } from "@/lib/tasks/get-income-analytics";

export type DashboardOverviewV3Props = {
  openTasks: number;
  highPriority: number;
  doneTasks: number;
  progress: PaidCompletedProgress;
  urgentTasks: UrgentPreviewTask[];
  overdueCount: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  dueSoonCount: number;
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
  priority: string;
  status: string;
  tone: ProjectCardTone;
};