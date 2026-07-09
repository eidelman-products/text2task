"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { toast } from "sonner";
import TasksView, {
  TaskArchiveView,
  TaskGroup,
  TaskRow,
} from "./dashboard/tasks-view";
import { trackBeginCheckout } from "@/lib/analytics/events";
import ExtractWorkspace from "./dashboard/extract-workspace";
import DashboardShell from "./dashboard/dashboard-shell";
import DashboardSidebarProfile from "./dashboard/dashboard-sidebar-profile";
import FirstRunDashboard from "./dashboard/first-run-dashboard";
import DashboardOverviewV3 from "./dashboard/overview-v3/dashboard-overview-v3";
import {
  buildFilteredGroupedTasks,
  type TaskPriorityFilter,
  type TaskSortOption,
  type TaskStatusFilter,
} from "./dashboard/task-filters";
import { getIncomeAnalytics } from "@/lib/tasks/get-income-analytics";
import { buildPriorityProjectSummary } from "./dashboard/overview-v3/dashboard-priority-work-utils";
import {
  buildTaskCopyText,
  escapeCsvValue,
  getPaidCompletedProgress,
  normalizeTaskFromApi,
} from "./dashboard/dashboard-helpers";

type DashboardClientProps = {
  email: string;
  userId: string;
  initialPlan: "free" | "pro";
};

type DashboardNav = "dashboard" | "extract" | "tasks";
type TasksApiView = TaskArchiveView | "stats";

type TasksSnapshot = {
  tasks: TaskRow[];
  activeTasks: TaskRow[];
  archivedTasks: TaskRow[];
  statsTasks: TaskRow[];
  savedWork: SavedWorkState | null;
};

type SavedWorkState = {
  projectCount: number;
  taskCount: number;
  hasSavedWork: boolean;
};

type ProjectUpdateAppliedResult = {
  focusTaskId?: number | null;
  projectId?: string | null;
  project?: AppliedProjectEntity | null;
  projectTasks?: unknown[];
  dashboardTasks?: unknown[];
};

type AppliedProjectEntity = NonNullable<TaskRow["project"]> & {
  client?: TaskRow["client"] | null;
};

type ProjectRefreshPatch = {
  projectId?: string | null;
  project?: AppliedProjectEntity | null;
};

type ProjectTaskSnapshotPatch = {
  projectId: string;
  tasks: TaskRow[];
};

type DashboardTaskSnapshotPatch = {
  tasks: TaskRow[];
};

function getActiveNavLabel(activeNav: DashboardNav) {
  if (activeNav === "extract") return "Extract";
  if (activeNav === "tasks") return "Tasks";
  return "Dashboard";
}

function isDoneTask(task: TaskRow) {
  return String(task.status || "").trim().toLowerCase() === "done";
}

function isDeletedTask(task: TaskRow) {
  return Boolean(task.deleted_at);
}

function isActiveTask(task: TaskRow) {
  return !task.is_archived && !isDeletedTask(task);
}

function replaceTaskInList(list: TaskRow[], updatedTask: TaskRow) {
  return list.map((task) => (task.id === updatedTask.id ? updatedTask : task));
}

function syncProjectAcrossTaskList(list: TaskRow[], updatedTask: TaskRow) {
  if (!updatedTask?.project || !updatedTask?.project_id) {
    return replaceTaskInList(list, updatedTask);
  }

  return replaceTaskInList(list, updatedTask).map((task) => {
    const taskProjectId = task.project_id || task.project?.id || "";

    if (taskProjectId !== updatedTask.project_id) return task;

    return {
      ...task,
      project: updatedTask.project,
      project_id: updatedTask.project_id,
    };
  });
}

function upsertTaskInList(list: TaskRow[], updatedTask: TaskRow) {
  const exists = list.some((task) => task.id === updatedTask.id);

  if (!exists) {
    return [updatedTask, ...list];
  }

  return replaceTaskInList(list, updatedTask);
}

function replaceProjectInTaskList(
  list: TaskRow[],
  projectId: string,
  updatedProject: AppliedProjectEntity
) {
  const { client: updatedClient, ...updatedProjectFields } = updatedProject;

  return list.map((task) =>
    task.project_id === projectId || task.project?.id === projectId
      ? {
          ...task,
          project_id: projectId,
          ...(updatedClient
            ? {
                client: {
                  ...(task.client || {
                    id: updatedClient.id || "",
                    name:
                      updatedClient.name ||
                      updatedProjectFields.client_name ||
                      "Unassigned",
                  }),
                  ...updatedClient,
                  name:
                    updatedClient.name ||
                    updatedProjectFields.client_name ||
                    task.client?.name ||
                    "Unassigned",
                },
                client_phone: updatedClient.phone ?? null,
                client_email: updatedClient.email ?? null,
                client_notes: updatedClient.notes ?? null,
                contact_name:
                  updatedProjectFields.contact_name ??
                  updatedClient.contact_name ??
                  null,
              }
            : {}),
          project: {
            ...(task.project || { id: projectId }),
            ...updatedProjectFields,
            id: updatedProjectFields.id || projectId,
          },
        }
      : task
  );
}

function getTaskProjectId(task: TaskRow) {
  return task.project_id || task.project?.id || "";
}

function replaceProjectTaskRowsInList(
  list: TaskRow[],
  projectId: string,
  projectTasks: TaskRow[]
) {
  const snapshotTasks = projectTasks.filter(
    (task) => getTaskProjectId(task) === projectId
  );

  if (snapshotTasks.length === 0) return list;

  const unrelatedTasks = list.filter(
    (task) => getTaskProjectId(task) !== projectId
  );
  const seenTaskIds = new Set<number>();
  const uniqueSnapshotTasks = snapshotTasks.filter((task) => {
    if (seenTaskIds.has(task.id)) return false;
    seenTaskIds.add(task.id);
    return true;
  });

  return [...uniqueSnapshotTasks, ...unrelatedTasks];
}

function replaceActiveTaskRowsInStatsList(
  list: TaskRow[],
  activeTasks: TaskRow[]
) {
  const nonActiveTasks = list.filter((task) => !isActiveTask(task));
  const map = new Map<number, TaskRow>();

  for (const task of activeTasks) {
    map.set(task.id, normalizeStatsTask(task, false));
  }

  for (const task of nonActiveTasks) {
    if (!map.has(task.id)) {
      map.set(task.id, normalizeStatsTask(task));
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
}

function removeTaskFromList(list: TaskRow[], taskId: number) {
  return list.filter((task) => task.id !== taskId);
}

function markTaskDeletedInList(list: TaskRow[], taskId: number) {
  const nowIso = new Date().toISOString();

  return list.map((task) =>
    task.id === taskId
      ? {
          ...task,
          deleted_at: task.deleted_at || nowIso,
          is_archived: true,
          archived_at: task.archived_at || nowIso,
        }
      : task
  );
}

function normalizeStatsTask(task: TaskRow, forcedArchiveState?: boolean) {
  return {
    ...task,
    is_archived:
      typeof forcedArchiveState === "boolean"
        ? forcedArchiveState
        : Boolean(task.is_archived),
    deleted_at: task.deleted_at ?? null,
    archived_at: task.archived_at ?? null,
    completed_at: task.completed_at ?? null,
  };
}

function mergeTaskStatsSources({
  statsTasks,
  activeTasks,
  archivedTasks,
}: {
  statsTasks: TaskRow[];
  activeTasks: TaskRow[];
  archivedTasks: TaskRow[];
}) {
  const map = new Map<number, TaskRow>();

  for (const task of statsTasks) {
    map.set(task.id, normalizeStatsTask(task));
  }

  for (const task of activeTasks) {
    const existing = map.get(task.id);

    map.set(task.id, {
      ...(existing || task),
      ...normalizeStatsTask(task, false),
      deleted_at: existing?.deleted_at ?? task.deleted_at ?? null,
      completed_at: existing?.completed_at ?? task.completed_at ?? null,
    });
  }

  for (const task of archivedTasks) {
    const existing = map.get(task.id);

    map.set(task.id, {
      ...(existing || task),
      ...normalizeStatsTask(task, true),
      deleted_at: existing?.deleted_at ?? task.deleted_at ?? null,
      archived_at:
        existing?.archived_at ?? task.archived_at ?? new Date().toISOString(),
      completed_at: existing?.completed_at ?? task.completed_at ?? null,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
}

export default function DashboardClient({
  email,
  userId,
  initialPlan,
}: DashboardClientProps) {
  const [activeNav, setActiveNav] = useState<DashboardNav>("dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [plan] = useState<"free" | "pro">(initialPlan);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [allTasksForStats, setAllTasksForStats] = useState<TaskRow[]>([]);
  const [savedWork, setSavedWork] = useState<SavedWorkState | null>(null);
  const [archiveView, setArchiveView] = useState<TaskArchiveView>("active");

  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [priorityFilter, setPriorityFilter] =
    useState<TaskPriorityFilter>("all");
  const [sortOption, setSortOption] = useState<TaskSortOption>("created-desc");
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(
    null
  );

  const [expandedClients, setExpandedClients] = useState<
    Record<string, boolean>
  >({});
  const [savingTaskIds, setSavingTaskIds] = useState<Record<number, boolean>>(
    {}
  );
  const [savedTaskIds, setSavedTaskIds] = useState<Record<number, boolean>>({});
  const [deletingTaskIds, setDeletingTaskIds] = useState<
    Record<number, boolean>
  >({});
  const [copiedTaskIds, setCopiedTaskIds] = useState<Record<number, boolean>>(
    {}
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  const saveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {}
  );
  const copyTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {}
  );
  const archiveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {}
  );
  const dashboardTaskSnapshotRef = useRef<DashboardTaskSnapshotPatch | null>(
    null
  );
  const projectTaskSnapshotRef = useRef<ProjectTaskSnapshotPatch | null>(null);

  const visibleStatsTasks = useMemo(
    () => allTasksForStats.filter((task) => !isDeletedTask(task)),
    [allTasksForStats]
  );

  const activeTasksForStats = useMemo(
    () => allTasksForStats.filter(isActiveTask),
    [allTasksForStats]
  );

  const completedTasksForStats = useMemo(
    () =>
      allTasksForStats.filter(
        (task) => isDoneTask(task) || Boolean(task.completed_at)
      ),
    [allTasksForStats]
  );

  const stats = useMemo(() => {
    const total = activeTasksForStats.length;
    const high = activeTasksForStats.filter(
      (task) => String(task.priority || "").trim().toLowerCase() === "high"
    ).length;
    const open = activeTasksForStats.filter((task) => !isDoneTask(task)).length;
    const done = completedTasksForStats.length;

    return { total, high, open, done };
  }, [activeTasksForStats, completedTasksForStats]);

  const incomeAnalytics = useMemo(
    () => getIncomeAnalytics(visibleStatsTasks),
    [visibleStatsTasks]
  );

  const progressStats = useMemo(
    () => getPaidCompletedProgress(visibleStatsTasks),
    [visibleStatsTasks]
  );

  const priorityWork = useMemo(() => {
    return buildPriorityProjectSummary(activeTasksForStats);
  }, [activeTasksForStats]);

  const groupedTasks = useMemo<TaskGroup[]>(() => {
    const map = new Map<string, TaskGroup>();

    for (const task of tasks) {
      const cleanClient = task.client?.name?.trim() || "Unassigned";
      const key = cleanClient ? cleanClient.toLowerCase() : "__unassigned__";
      const clientName = cleanClient || "Unassigned";

      if (!map.has(key)) {
        map.set(key, {
          key,
          clientName,
          tasks: [],
        });
      }

      map.get(key)!.tasks.push(task);
    }

    const baseGroups = Array.from(map.values()).sort((a, b) =>
      a.clientName.localeCompare(b.clientName)
    );

    return buildFilteredGroupedTasks(baseGroups, {
      searchTerm,
      statusFilter,
      priorityFilter,
      sortOption,
    });
  }, [tasks, searchTerm, statusFilter, priorityFilter, sortOption]);

  const visibleTasks = useMemo(() => {
    return groupedTasks.flatMap((group) => group.tasks);
  }, [groupedTasks]);

  function handleNavChange(nav: DashboardNav) {
    setActiveNav(nav);
    setIsMobileSidebarOpen(false);
  }

  function handleArchiveViewChange(view: TaskArchiveView) {
    setArchiveView(view);
    setSearchTerm("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSortOption("created-desc");
  }

  async function fetchTasksFromServer(
    viewOverride: TasksApiView = archiveView
  ): Promise<TaskRow[]> {
    const res = await fetch(`/api/tasks?view=${viewOverride}`, {
      method: "GET",
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load tasks");
    }

    return (data.tasks || []).map(normalizeTaskFromApi);
  }

  async function fetchTasksSnapshot(
    viewOverride: TaskArchiveView = archiveView
  ): Promise<TasksSnapshot> {
    const res = await fetch(`/api/tasks/snapshot?view=${viewOverride}`, {
      method: "GET",
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load task snapshot");
    }

    const normalizeRows = (rows: unknown) =>
      Array.isArray(rows) ? rows.map(normalizeTaskFromApi) : [];
    const rawSavedWork =
      data.savedWork && typeof data.savedWork === "object"
        ? data.savedWork
        : null;
    const projectCount = Number(rawSavedWork?.projectCount);
    const taskCount = Number(rawSavedWork?.taskCount);
    const normalizedSavedWork =
      Number.isFinite(projectCount) && Number.isFinite(taskCount)
        ? {
            projectCount,
            taskCount,
            hasSavedWork: projectCount > 0 || taskCount > 0,
          }
        : null;

    return {
      tasks: normalizeRows(data.tasks),
      activeTasks: normalizeRows(data.activeTasks),
      archivedTasks: normalizeRows(data.archivedTasks),
      statsTasks: normalizeRows(data.statsTasks),
      savedWork: normalizedSavedWork,
    };
  }

  async function refreshTasks(
    viewOverride: TaskArchiveView = archiveView,
    patch?: ProjectRefreshPatch
  ) {
    const {
      tasks: mappedTasks,
      statsTasks: mappedStatsTasks,
      activeTasks: mappedActiveTasks,
      archivedTasks: mappedArchivedTasks,
      savedWork: mappedSavedWork,
    } = await fetchTasksSnapshot(viewOverride);

    const pendingDashboardSnapshot = dashboardTaskSnapshotRef.current;
    const pendingSnapshot = projectTaskSnapshotRef.current;
    const patchProjectId = patch?.projectId || null;
    const patchProject = patch?.project || null;
    const nextAllTasksForStats = mergeTaskStatsSources({
      statsTasks: mappedStatsTasks,
      activeTasks: mappedActiveTasks,
      archivedTasks: mappedArchivedTasks,
    });
    const nextTasks = pendingDashboardSnapshot
      ? pendingDashboardSnapshot.tasks
      : pendingSnapshot
      ? replaceProjectTaskRowsInList(
          mappedTasks,
          pendingSnapshot.projectId,
          pendingSnapshot.tasks
        )
      : patchProjectId && patchProject
        ? replaceProjectInTaskList(mappedTasks, patchProjectId, patchProject)
        : mappedTasks;
    const nextStatsTasks = pendingDashboardSnapshot
      ? replaceActiveTaskRowsInStatsList(
          nextAllTasksForStats,
          pendingDashboardSnapshot.tasks
        )
      : pendingSnapshot
      ? replaceProjectTaskRowsInList(
          nextAllTasksForStats,
          pendingSnapshot.projectId,
          pendingSnapshot.tasks
        )
      : patchProjectId && patchProject
        ? replaceProjectInTaskList(
            nextAllTasksForStats,
            patchProjectId,
            patchProject
          )
        : nextAllTasksForStats;

    setTasks(nextTasks);
    setAllTasksForStats(nextStatsTasks);
    setSavedWork(mappedSavedWork);

    if (pendingDashboardSnapshot) {
      dashboardTaskSnapshotRef.current = null;
    }

    if (pendingSnapshot) {
      projectTaskSnapshotRef.current = null;
    }
  }

  async function handleProjectUpdateApplied(result: ProjectUpdateAppliedResult) {
    const focusTaskId =
      typeof result.focusTaskId === "number" && Number.isFinite(result.focusTaskId)
        ? result.focusTaskId
        : null;
    const dashboardTaskSnapshot = Array.isArray(result.dashboardTasks)
      ? result.dashboardTasks
          .filter((task) => task && typeof task === "object")
          .map(normalizeTaskFromApi)
      : [];
    const projectTaskSnapshot = Array.isArray(result.projectTasks)
      ? result.projectTasks
          .filter((task) => task && typeof task === "object")
          .map(normalizeTaskFromApi)
      : [];
    const projectId =
      typeof result.projectId === "string" && result.projectId.trim()
        ? result.projectId.trim()
        : result.project?.id ||
          projectTaskSnapshot.map(getTaskProjectId).find(Boolean) ||
          null;
    const updatedProject = result.project || null;

    setActiveNav("tasks");
    setArchiveView("active");
    setSearchTerm("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSortOption("created-desc");

    if (dashboardTaskSnapshot.length > 0) {
      dashboardTaskSnapshotRef.current = {
        tasks: dashboardTaskSnapshot,
      };
      setTasks(dashboardTaskSnapshot);
      setAllTasksForStats((prev) =>
        replaceActiveTaskRowsInStatsList(prev, dashboardTaskSnapshot)
      );
    } else if (projectId && projectTaskSnapshot.length > 0) {
      projectTaskSnapshotRef.current = {
        projectId,
        tasks: projectTaskSnapshot,
      };
      setTasks((prev) =>
        replaceProjectTaskRowsInList(prev, projectId, projectTaskSnapshot)
      );
      setAllTasksForStats((prev) =>
        replaceProjectTaskRowsInList(prev, projectId, projectTaskSnapshot)
      );
    } else {
      await refreshTasks("active", {
        projectId,
        project: updatedProject,
      });
    }

    if (focusTaskId) {
      setHighlightedTaskId(null);

      window.setTimeout(() => {
        setHighlightedTaskId(focusTaskId);
      }, 0);
    }
  }

  async function refreshStatsOnly() {
    const {
      statsTasks: mappedStatsTasks,
      activeTasks: mappedActiveTasks,
      archivedTasks: mappedArchivedTasks,
      savedWork: mappedSavedWork,
    } = await fetchTasksSnapshot(archiveView);

    setAllTasksForStats(
      mergeTaskStatsSources({
        statsTasks: mappedStatsTasks,
        activeTasks: mappedActiveTasks,
        archivedTasks: mappedArchivedTasks,
      })
    );
    setSavedWork(mappedSavedWork);
  }

  async function handleBilling() {
    if (isBillingLoading) return;

    try {
      setIsBillingLoading(true);

      const res = await fetch("/api/creem/checkout", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to open billing");
      }

      if (data?.url) {
        trackBeginCheckout();
        window.location.href = data.url;
        return;
      }

      throw new Error("Billing URL missing");
    } catch (error: any) {
      console.error(error);
      toast.error("Billing failed", {
        description: error?.message || "Could not open billing right now.",
      });
    } finally {
      setIsBillingLoading(false);
    }
  }

  async function handleLogout() {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);

      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Logout failed");
      }

      window.location.href = "/";
    } catch (error: any) {
      console.error(error);
      toast.error("Logout failed", {
        description: error?.message || "Could not log out. Please try again.",
      });
      setIsLoggingOut(false);
    }
  }

  function exportVisibleTasksToCsv() {
    if (plan === "free") {
      toast.error("CSV export is a Pro feature", {
        description:
          "Upgrade to Pro to export your tasks and client data as CSV.",
        action: {
          label: "Upgrade",
          onClick: handleBilling,
        },
      });
      return;
    }

    if (!visibleTasks.length) {
      toast.warning("No tasks to export", {
        description: "Change the filters or add tasks first.",
      });
      return;
    }

    const headers = [
      "Client",
      "Task",
      "Amount",
      "Deadline",
      "Phone",
      "Email",
      "Notes",
      "Priority",
      "Status",
      "Archived",
      "Source",
    ];

    const rows = visibleTasks.map((task) => [
      task.client?.name?.trim() || "Unassigned",
      task.task || "",
      task.amount || "",
      task.deadline || "",
      task.client?.phone || task.client_phone || "",
      task.client?.email || task.client_email || "",
      task.client?.notes || task.client_notes || "",
      task.priority || "",
      task.status || "",
      task.is_archived ? "Yes" : "No",
      task.source || "",
    ]);

    const csvContent = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.setAttribute("download", `text2task-tasks-${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("CSV exported", {
      description: `${visibleTasks.length} task(s) exported successfully.`,
    });
  }

  function handleTasksSaved(rows: TaskRow[]) {
    if (!rows.length) return;

    const cleanRows = rows.map((row) => ({
      ...row,
      is_archived: false,
      deleted_at: null,
    }));

    setTasks((prev) => {
      if (archiveView === "archived") return prev;
      return [...[...cleanRows].reverse(), ...prev];
    });

    setAllTasksForStats((prev) =>
      mergeTaskStatsSources({
        statsTasks: [...[...cleanRows].reverse(), ...prev],
        activeTasks: cleanRows,
        archivedTasks: prev.filter(
          (task) => task.is_archived && !task.deleted_at
        ),
      })
    );
    setSavedWork((current) => ({
      projectCount: Math.max(current?.projectCount ?? 0, 1),
      taskCount: (current?.taskCount ?? 0) + cleanRows.length,
      hasSavedWork: true,
    }));

    toast.success("Tasks saved", {
      description:
        rows.length === 1
          ? "1 task was added to your CRM."
          : `${rows.length} tasks were added to your CRM.`,
    });
  }

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) =>
        clearTimeout(timer)
      );
      Object.values(copyTimersRef.current).forEach((timer) =>
        clearTimeout(timer)
      );
      Object.values(archiveTimersRef.current).forEach((timer) =>
        clearTimeout(timer)
      );
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const taskId = params.get("taskId");

    if (view === "tasks") {
      setActiveNav("tasks");
    }

    if (taskId) {
      const parsedTaskId = Number(taskId);
      if (!Number.isNaN(parsedTaskId)) {
        setActiveNav("tasks");
        setHighlightedTaskId(parsedTaskId);
        setSearchTerm("");
        setStatusFilter("all");
        setPriorityFilter("all");
        setSortOption("created-desc");
        setArchiveView("active");
      }
    }
  }, []);

  useEffect(() => {
    setExpandedClients((prev) => {
      const next = { ...prev };

      for (const group of groupedTasks) {
        if (typeof next[group.key] === "undefined") {
          next[group.key] = true;
        }
      }

      if (highlightedTaskId) {
        const targetGroup = groupedTasks.find((group) =>
          group.tasks.some((task) => task.id === highlightedTaskId)
        );

        if (targetGroup) {
          next[targetGroup.key] = true;
        }
      }

      return next;
    });
  }, [groupedTasks, highlightedTaskId]);

  useEffect(() => {
    async function loadTasks() {
      try {
        setIsLoadingTasks(true);
        setTasksError("");

        await refreshTasks();
      } catch (error: any) {
        const message = error.message || "Failed to load tasks";
        setTasksError(message);
        toast.error("Could not load tasks", {
          description: message,
        });
      } finally {
        setIsLoadingTasks(false);
      }
    }

    void loadTasks();
  }, [userId, archiveView]);

  function markTaskSaved(taskId: number) {
    if (saveTimersRef.current[taskId]) {
      clearTimeout(saveTimersRef.current[taskId]);
    }

    setSavedTaskIds((prev) => ({
      ...prev,
      [taskId]: true,
    }));

    saveTimersRef.current[taskId] = setTimeout(() => {
      setSavedTaskIds((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }, 1800);
  }

  function markTaskCopied(taskId: number) {
    if (copyTimersRef.current[taskId]) {
      clearTimeout(copyTimersRef.current[taskId]);
    }

    setCopiedTaskIds((prev) => ({
      ...prev,
      [taskId]: true,
    }));

    copyTimersRef.current[taskId] = setTimeout(() => {
      setCopiedTaskIds((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }, 1800);
  }

  async function updateTaskStatus(
    taskId: number,
    status: string,
    options: {
      suppressErrorToast?: boolean;
      throwOnError?: boolean;
    } = {}
  ) {
    const previousTasks = tasks;
    const previousAllTasks = allTasksForStats;
    const isNextDone = String(status || "").trim().toLowerCase() === "done";
    const nowIso = new Date().toISOString();

    setSavingTaskIds((prev) => ({ ...prev, [taskId]: true }));
    setSavedTaskIds((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              completed_at: isNextDone
                ? task.completed_at || nowIso
                : task.completed_at,
            }
          : task
      )
    );

    setAllTasksForStats((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              completed_at: isNextDone
                ? task.completed_at || nowIso
                : task.completed_at,
            }
          : task
      )
    );

    try {
      const res = await fetch("/api/tasks/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          field: "status",
          value: status,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTasks(previousTasks);
        setAllTasksForStats(previousAllTasks);
        throw new Error(data.error || "Failed to update task status");
      }

      const updatedTask = data.task ? normalizeTaskFromApi(data.task) : null;

      if (updatedTask) {
        setTasks((prev) => syncProjectAcrossTaskList(prev, updatedTask));
        setAllTasksForStats((prev) =>
          syncProjectAcrossTaskList(prev, updatedTask)
        );
      }

      markTaskSaved(taskId);
    } catch (error: any) {
      const message = error.message || "Failed to update task status";
      console.error(error);
      setTasks(previousTasks);
      setAllTasksForStats(previousAllTasks);
      if (!options.suppressErrorToast) {
        toast.error("Status update failed", {
          description: message,
          action: {
            label: "Retry",
            onClick: () => updateTaskStatus(taskId, status),
          },
        });
      }

      if (options.throwOnError) {
        throw error;
      }
    } finally {
      setSavingTaskIds((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  }

  async function updateTaskField(taskId: number, field: string, value: any) {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) return;

    const textFields = [
      "task",
      "amount",
      "deadline",
      "priority",
      "status",
      "phone",
      "email",
      "notes",
    ];

    if (!textFields.includes(field)) return;

    const normalizedValue =
      field === "amount"
        ? value === null || value === undefined
          ? ""
          : String(value).trim()
        : String(value ?? "").trim();

    let currentValue = "";

    if (field === "phone") {
      currentValue = String(
        currentTask.client?.phone ?? currentTask.client_phone ?? ""
      ).trim();
    } else if (field === "email") {
      currentValue = String(
        currentTask.client?.email ?? currentTask.client_email ?? ""
      ).trim();
    } else if (field === "notes") {
      currentValue = String(
        currentTask.client?.notes ?? currentTask.client_notes ?? ""
      ).trim();
    } else if (field === "task") {
      currentValue = String(currentTask.task ?? "").trim();
    } else if (field === "amount") {
      currentValue = String(currentTask.amount ?? "").trim();
    } else if (field === "deadline") {
      currentValue = String(
        currentTask.deadline_original_text || currentTask.deadline || ""
      ).trim();
    } else if (field === "priority") {
      currentValue = String(currentTask.priority ?? "").trim();
    } else if (field === "status") {
      currentValue = String(currentTask.status ?? "").trim();
    }

    if (currentValue === normalizedValue) {
      return;
    }

    const previousTasks = tasks;
    const previousAllTasks = allTasksForStats;

    setSavingTaskIds((prev) => ({ ...prev, [taskId]: true }));
    setSavedTaskIds((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });

    function optimisticUpdate(task: TaskRow): TaskRow {
      if (task.id !== taskId) return task;

      if (field === "phone" || field === "email" || field === "notes") {
        return {
          ...task,
          client: task.client
            ? {
                ...task.client,
                [field]: normalizedValue === "" ? null : normalizedValue,
              }
            : null,
          ...(field === "phone"
            ? {
                client_phone: normalizedValue === "" ? null : normalizedValue,
              }
            : {}),
          ...(field === "email"
            ? {
                client_email: normalizedValue === "" ? null : normalizedValue,
              }
            : {}),
          ...(field === "notes"
            ? {
                client_notes: normalizedValue === "" ? null : normalizedValue,
              }
            : {}),
        };
      }

      if (field === "task") {
        return { ...task, task: normalizedValue };
      }

      if (field === "amount") {
        return { ...task, amount: normalizedValue };
      }

      if (field === "deadline") {
        return {
          ...task,
          deadline: normalizedValue,
          deadline_original_text: normalizedValue,
        };
      }

      if (field === "priority") {
        return { ...task, priority: normalizedValue };
      }

      if (field === "status") {
        const isNextDone =
          String(normalizedValue || "").trim().toLowerCase() === "done";

        return {
          ...task,
          status: normalizedValue,
          completed_at: isNextDone
            ? task.completed_at || new Date().toISOString()
            : task.completed_at,
        };
      }

      return task;
    }

    setTasks((prev) => prev.map(optimisticUpdate));
    setAllTasksForStats((prev) => prev.map(optimisticUpdate));

    try {
      const res = await fetch("/api/tasks/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          field,
          value:
            field === "amount" ||
            field === "phone" ||
            field === "email" ||
            field === "notes"
              ? normalizedValue === ""
                ? null
                : normalizedValue
              : normalizedValue,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTasks(previousTasks);
        setAllTasksForStats(previousAllTasks);
        throw new Error(data.error || "Failed to update task");
      }

      const updatedTask = data.task ? normalizeTaskFromApi(data.task) : null;

      if (updatedTask) {
        setTasks((prev) => replaceTaskInList(prev, updatedTask));
        setAllTasksForStats((prev) => upsertTaskInList(prev, updatedTask));
      }

      markTaskSaved(taskId);

      toast.success("Task updated", {
        description: "Your change was saved successfully.",
      });
    } catch (error: any) {
      const message = error.message || "Failed to update task";
      console.error(error);
      setTasks(previousTasks);
      setAllTasksForStats(previousAllTasks);
      toast.error("Update failed", {
        description: message,
        action: {
          label: "Retry",
          onClick: () => updateTaskField(taskId, field, value),
        },
      });
    } finally {
      setSavingTaskIds((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  }

  async function updateProjectField(
    projectId: string,
    field: string,
    value: any
  ) {
    if (!projectId) return;

    const previousTasks = tasks;
    const previousAllTasks = allTasksForStats;
    const affectedTaskIds = tasks
      .filter(
        (task) => task.project_id === projectId || task.project?.id === projectId
      )
      .map((task) => task.id);

    if (!affectedTaskIds.length) return;

    setSavingTaskIds((prev) => {
      const next = { ...prev };
      affectedTaskIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });

    setSavedTaskIds((prev) => {
      const next = { ...prev };
      affectedTaskIds.forEach((id) => {
        delete next[id];
      });
      return next;
    });

    function optimisticUpdate(task: TaskRow): TaskRow {
      if (task.project_id !== projectId && task.project?.id !== projectId) {
        return task;
      }

      const currentProject = task.project || {
        id: projectId,
      };

      return {
        ...task,
        project_id: projectId,
        project: {
          ...currentProject,
          ...(field === "title" ? { title: String(value ?? "").trim() } : {}),
          ...(field === "summary"
            ? { summary: String(value ?? "").trim() || null }
            : {}),
          ...(field === "amount" ? { amount: String(value ?? "").trim() } : {}),
          ...(field === "deadline"
            ? { deadline_text: String(value ?? "").trim() }
            : {}),
          ...(field === "priority"
            ? {
                priority: String(value ?? "").trim() || "Medium",
                priority_source: "user",
              }
            : {}),
          ...(field === "status"
            ? { status: String(value ?? "").trim() || "New" }
            : {}),
          ...(field === "client_name"
            ? { client_name: String(value ?? "").trim() }
            : {}),
          ...(field === "contact_name"
            ? { contact_name: String(value ?? "").trim() || null }
            : {}),
        },
      };
    }

    setTasks((prev) => prev.map(optimisticUpdate));
    setAllTasksForStats((prev) => prev.map(optimisticUpdate));

    try {
      const res = await fetch("/api/projects/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          field,
          value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTasks(previousTasks);
        setAllTasksForStats(previousAllTasks);
        throw new Error(data.error || "Failed to update project");
      }

      const updatedProject = data.project || null;

      if (updatedProject) {
        setTasks((prev) =>
          replaceProjectInTaskList(prev, projectId, updatedProject)
        );
        setAllTasksForStats((prev) =>
          replaceProjectInTaskList(prev, projectId, updatedProject)
        );
      }

      affectedTaskIds.forEach((id) => markTaskSaved(id));

      toast.success("Project updated", {
        description: "Your project changes were saved successfully.",
      });
    } catch (error: any) {
      const message = error.message || "Failed to update project";
      console.error(error);

      setTasks(previousTasks);
      setAllTasksForStats(previousAllTasks);

      toast.error("Project update failed", {
        description: message,
        action: {
          label: "Retry",
          onClick: () => updateProjectField(projectId, field, value),
        },
      });
    } finally {
      setSavingTaskIds((prev) => {
        const next = { ...prev };
        affectedTaskIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    }
  }

  async function copyTask(taskId: number) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      toast.error("Task not found", {
        description: "Could not find the task to copy.",
      });
      return;
    }

    const textToCopy = buildTaskCopyText(task);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      markTaskCopied(taskId);

      toast.success("Task copied", {
        description: "Task details were copied to your clipboard.",
      });
    } catch (error) {
      console.error(error);
      toast.error("Copy failed", {
        description: "Could not copy this task. Please try again.",
      });
    }
  }

  async function archiveTask(taskId: number) {
    const taskToArchive = tasks.find((task) => task.id === taskId);

    if (!taskToArchive) {
      toast.error("Task not found", {
        description: "Could not find the task to archive.",
      });
      return;
    }

    const previousTasks = tasks;
    const previousAllTasks = allTasksForStats;
    const nowIso = new Date().toISOString();

    setDeletingTaskIds((prev) => ({
      ...prev,
      [taskId]: true,
    }));

    setSavedTaskIds((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });

    setSavingTaskIds((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });

    setCopiedTaskIds((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });

    setTasks((prev) => {
      if (archiveView === "all") {
        return prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                is_archived: true,
                archived_at: task.archived_at || nowIso,
              }
            : task
        );
      }

      return removeTaskFromList(prev, taskId);
    });

    setAllTasksForStats((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              is_archived: true,
              archived_at: task.archived_at || nowIso,
            }
          : task
      )
    );

    try {
      const res = await fetch("/api/tasks/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId, mode: "archive" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to archive task");
      }

      toast.success("Task archived", {
        description: taskToArchive.task
          ? `"${taskToArchive.task}" is now in Archive.`
          : "The task is now in Archive.",
      });

      try {
        await refreshStatsOnly();
      } catch (refreshError) {
        console.error(
          "Task archived, but task statistics refresh failed:",
          refreshError
        );
        toast.warning(
          "Task archived, but dashboard statistics could not refresh. Please refresh the workspace."
        );
      }
    } catch (error: any) {
      const message = error.message || "Failed to archive task";
      console.error(error);

      setTasks(previousTasks);
      setAllTasksForStats(previousAllTasks);

      toast.error("Archive failed", {
        description: message,
        action: {
          label: "Retry",
          onClick: () => archiveTask(taskId),
        },
      });
    } finally {
      setDeletingTaskIds((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  }

  async function restoreTask(taskId: number) {
    const taskToRestore = tasks.find((task) => task.id === taskId);

    if (!taskToRestore) {
      toast.error("Task not found", {
        description: "Could not find the task to restore.",
      });
      return;
    }

    const previousTasks = tasks;
    const previousAllTasks = allTasksForStats;

    setDeletingTaskIds((prev) => ({ ...prev, [taskId]: true }));

    setTasks((prev) => {
      if (archiveView === "archived") {
        return removeTaskFromList(prev, taskId);
      }

      return prev.map((task) =>
        task.id === taskId
          ? { ...task, is_archived: false, archived_at: null }
          : task
      );
    });

    setAllTasksForStats((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, is_archived: false, archived_at: null }
          : task
      )
    );

    try {
      const res = await fetch("/api/tasks/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          field: "restore",
          value: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to restore task");
      }

      const updatedTask = data.task ? normalizeTaskFromApi(data.task) : null;

      if (updatedTask) {
        setAllTasksForStats((prev) => upsertTaskInList(prev, updatedTask));

        if (archiveView === "all") {
          setTasks((prev) => replaceTaskInList(prev, updatedTask));
        }
      }

      toast.success("Task restored", {
        description: "The task is back in your active workspace.",
      });

      try {
        await refreshStatsOnly();
      } catch (refreshError) {
        console.error(
          "Task restored, but task statistics refresh failed:",
          refreshError
        );
        toast.warning(
          "Task restored, but dashboard statistics could not refresh. Please refresh the workspace."
        );
      }
    } catch (error: any) {
      const message = error.message || "Failed to restore task";
      console.error(error);

      setTasks(previousTasks);
      setAllTasksForStats(previousAllTasks);

      toast.error("Restore failed", {
        description: message,
        action: {
          label: "Retry",
          onClick: () => restoreTask(taskId),
        },
      });
    } finally {
      setDeletingTaskIds((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  }

  async function permanentlyDeleteTask(taskId: number) {
    const taskToDelete = tasks.find((task) => task.id === taskId);

    if (!taskToDelete) {
      throw new Error("Could not find the task to delete.");
    }

    const previousTasks = tasks;
    const previousAllTasks = allTasksForStats;

    setDeletingTaskIds((prev) => ({ ...prev, [taskId]: true }));
    setTasks((prev) => removeTaskFromList(prev, taskId));
    setAllTasksForStats((prev) => markTaskDeletedInList(prev, taskId));

    try {
      try {
        const res = await fetch("/api/tasks/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ taskId, mode: "permanent" }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to permanently delete task");
        }
      } catch (error: any) {
        console.error(error);

        setTasks(previousTasks);
        setAllTasksForStats(previousAllTasks);
        throw error;
      }

      try {
        await refreshTasks();
      } catch (refreshError) {
        console.error(
          "Task deleted, but task list refresh failed:",
          refreshError
        );
        toast.warning(
          "Task deleted, but the task list could not refresh. Please refresh the workspace."
        );
      }
    } finally {
      setDeletingTaskIds((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  }

  function toggleClientGroup(groupKey: string) {
    setExpandedClients((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }

  function renderDashboard() {
    const showFirstRunDashboard =
      !isLoadingTasks && savedWork?.hasSavedWork === false;

    return (
      <div className="dashboard-page-root" style={dashboardPageRootStyle}>
        <style>{dashboardResponsiveCss}</style>

        {showFirstRunDashboard ? (
          <FirstRunDashboard
            onExtractFirstRequest={() => handleNavChange("extract")}
            onTryExample={() => handleNavChange("extract")}
          />
        ) : (
          <DashboardOverviewV3
            openTasks={stats.open}
            highPriority={stats.high}
            doneTasks={stats.done}
            progress={progressStats}
            priorityWork={priorityWork}
            activeTasks={activeTasksForStats}
            analytics={incomeAnalytics}
            userEmail={email}
            onGoToExtract={() => handleNavChange("extract")}
            onGoToTasks={() => handleNavChange("tasks")}
          />
        )}
      </div>
    );
  }

  function renderExtract() {
    return (
      <ExtractWorkspace
        plan={plan}
        existingTasks={visibleStatsTasks}
        fetchTasksFromServer={() => fetchTasksFromServer("active")}
        onTasksSaved={handleTasksSaved}
        onGoToTasks={() => handleNavChange("tasks")}
      />
    );
  }

  function renderContent() {
    switch (activeNav) {
      case "extract":
        return renderExtract();

      case "tasks":
        return (
          <TasksView
            isLoadingTasks={isLoadingTasks}
            tasksError={tasksError}
            tasks={tasks}
            groupedTasks={groupedTasks}
            expandedClients={expandedClients}
            savingTaskIds={savingTaskIds}
            savedTaskIds={savedTaskIds}
            deletingTaskIds={deletingTaskIds}
            copiedTaskIds={copiedTaskIds}
            archiveView={archiveView}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
            sortOption={sortOption}
            visibleTasksCount={visibleTasks.length}
            statsTasks={allTasksForStats}
            highlightedTaskId={highlightedTaskId}
            onArchiveViewChange={handleArchiveViewChange}
            onSearchTermChange={setSearchTerm}
            onStatusFilterChange={setStatusFilter}
            onPriorityFilterChange={setPriorityFilter}
            onSortOptionChange={setSortOption}
            onExportCsv={exportVisibleTasksToCsv}
            toggleClientGroup={toggleClientGroup}
            updateTaskStatus={updateTaskStatus}
            updateTaskField={updateTaskField}
            updateProjectField={updateProjectField}
            copyTask={copyTask}
            archiveTask={archiveTask}
            restoreTask={restoreTask}
            permanentlyDeleteTask={permanentlyDeleteTask}
            onRefreshTasks={refreshTasks}
            onProjectUpdateApplied={handleProjectUpdateApplied}
          />
        );

      case "dashboard":
      default:
        return renderDashboard();
    }
  }

  const sidebar = (
    <DashboardSidebarProfile
      email={email}
      plan={plan}
      activeNav={activeNav}
      onNavChange={handleNavChange}
    />
  );

  return (
    <DashboardShell
      sidebar={sidebar}
      activeNavLabel={getActiveNavLabel(activeNav)}
      isMobileSidebarOpen={isMobileSidebarOpen}
      onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
      onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
    >
      {renderContent()}
    </DashboardShell>
  );
}

const dashboardResponsiveCss = `
  .dashboard-page-root,
  .dashboard-page-root * {
    box-sizing: border-box;
  }

  .dashboard-page-root > * {
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  @media (max-width: 900px) {
    .dashboard-page-root {
      gap: 16px !important;
    }
  }

  @media (min-width: 901px) {
    .dashboard-page-root {
      gap: 18px !important;
    }
  }
`;

const dashboardPageRootStyle: CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 18,
  overflowX: "hidden",
};
