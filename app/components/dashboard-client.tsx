"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { toast } from "sonner";
import TasksView, {
  TaskArchiveView,
  TaskGroup,
  TaskRow,
} from "./dashboard/tasks-view";
import ExtractWorkspace from "./dashboard/extract-workspace";
import RevenueSnapshotPremium from "./dashboard/revenue-snapshot-premium";
import DashboardShell from "./dashboard/dashboard-shell";
import DashboardSidebarProfile from "./dashboard/dashboard-sidebar-profile";
import DashboardHeader from "./dashboard/dashboard-header";
import DashboardTopSummaryStrip from "./dashboard/dashboard-top-summary-strip";
import DashboardUrgentTasksCard from "./dashboard/dashboard-urgent-tasks-card";
import DashboardAnalyticsOverviewSection from "./dashboard/dashboard-analytics-overview-section";
import {
  buildFilteredGroupedTasks,
  type TaskPriorityFilter,
  type TaskSortOption,
  type TaskStatusFilter,
} from "./dashboard/task-filters";
import { getDashboardAlerts } from "@/lib/tasks/get-dashboard-alerts";
import { getIncomeAnalytics } from "@/lib/tasks/get-income-analytics";
import {
  buildTaskCopyText,
  buildUrgentPreviewTasks,
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

const ARCHIVE_UNDO_DURATION = 7000;

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

function upsertTaskInList(list: TaskRow[], updatedTask: TaskRow) {
  const exists = list.some((task) => task.id === updatedTask.id);

  if (!exists) {
    return [updatedTask, ...list];
  }

  return replaceTaskInList(list, updatedTask);
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
  const [archiveView, setArchiveView] = useState<TaskArchiveView>("active");

  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [priorityFilter, setPriorityFilter] =
    useState<TaskPriorityFilter>("all");
  const [sortOption, setSortOption] = useState<TaskSortOption>("client-asc");
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

  const dashboardAlerts = useMemo(
    () => getDashboardAlerts(activeTasksForStats),
    [activeTasksForStats]
  );

  const incomeAnalytics = useMemo(
    () => getIncomeAnalytics(visibleStatsTasks),
    [visibleStatsTasks]
  );

  const progressStats = useMemo(
    () => getPaidCompletedProgress(visibleStatsTasks),
    [visibleStatsTasks]
  );

  const urgentPreviewTasks = useMemo(() => {
    return buildUrgentPreviewTasks(activeTasksForStats).slice(0, 4);
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
    setSortOption("client-asc");
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

  async function refreshTasks() {
    const [mappedTasks, mappedStatsTasks, mappedActiveTasks, mappedArchivedTasks] =
      await Promise.all([
        fetchTasksFromServer(archiveView),
        fetchTasksFromServer("stats"),
        fetchTasksFromServer("active"),
        fetchTasksFromServer("archived"),
      ]);

    setTasks(mappedTasks);

    setAllTasksForStats(
      mergeTaskStatsSources({
        statsTasks: mappedStatsTasks,
        activeTasks: mappedActiveTasks,
        archivedTasks: mappedArchivedTasks,
      })
    );
  }

  async function refreshStatsOnly() {
    const [mappedStatsTasks, mappedActiveTasks, mappedArchivedTasks] =
      await Promise.all([
        fetchTasksFromServer("stats"),
        fetchTasksFromServer("active"),
        fetchTasksFromServer("archived"),
      ]);

    setAllTasksForStats(
      mergeTaskStatsSources({
        statsTasks: mappedStatsTasks,
        activeTasks: mappedActiveTasks,
        archivedTasks: mappedArchivedTasks,
      })
    );
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

    toast.success("Tasks saved", {
      description:
        rows.length === 1
          ? "1 task was added to your CRM."
          : `${rows.length} tasks were added to your CRM.`,
    });
  }

  function handleOpenTaskFromDashboard(taskId: number) {
    setArchiveView("active");
    setHighlightedTaskId(taskId);
    setActiveNav("tasks");
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
        setHighlightedTaskId(parsedTaskId);
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

  async function updateTaskStatus(taskId: number, status: string) {
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
        setTasks((prev) => replaceTaskInList(prev, updatedTask));
        setAllTasksForStats((prev) => upsertTaskInList(prev, updatedTask));
      }

      markTaskSaved(taskId);
    } catch (error: any) {
      const message = error.message || "Failed to update task status";
      console.error(error);
      setTasks(previousTasks);
      setAllTasksForStats(previousAllTasks);
      toast.error("Status update failed", {
        description: message,
        action: {
          label: "Retry",
          onClick: () => updateTaskStatus(taskId, status),
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
    const taskIndex = tasks.findIndex((task) => task.id === taskId);

    if (!taskToArchive || taskIndex === -1) {
      toast.error("Task not found", {
        description: "Could not find the task to archive.",
      });
      return;
    }

    if (archiveTimersRef.current[taskId]) {
      clearTimeout(archiveTimersRef.current[taskId]);
      delete archiveTimersRef.current[taskId];
    }

    const nowIso = new Date().toISOString();

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

      return prev.filter((task) => task.id !== taskId);
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

    const toastId = toast("Task moved to Archive", {
      description: taskToArchive.task
        ? `"${taskToArchive.task}" will be archived in a few seconds.`
        : "This task will be archived in a few seconds.",
      duration: ARCHIVE_UNDO_DURATION,
      action: {
        label: "Undo",
        onClick: () => {
          if (archiveTimersRef.current[taskId]) {
            clearTimeout(archiveTimersRef.current[taskId]);
            delete archiveTimersRef.current[taskId];
          }

          setTasks((prev) => {
            if (prev.some((task) => task.id === taskId)) {
              return prev.map((task) =>
                task.id === taskId
                  ? { ...task, is_archived: false, archived_at: null }
                  : task
              );
            }

            const next = [...prev];
            const safeIndex = Math.min(Math.max(taskIndex, 0), next.length);
            next.splice(safeIndex, 0, {
              ...taskToArchive,
              is_archived: false,
              archived_at: null,
            });
            return next;
          });

          setAllTasksForStats((prev) =>
            prev.map((task) =>
              task.id === taskId
                ? { ...task, is_archived: false, archived_at: null }
                : task
            )
          );

          setDeletingTaskIds((prev) => {
            const next = { ...prev };
            delete next[taskId];
            return next;
          });

          toast.dismiss(toastId);
          toast.success("Archive cancelled", {
            description: "The task stayed in your active workspace.",
          });
        },
      },
    });

    archiveTimersRef.current[taskId] = setTimeout(async () => {
      setDeletingTaskIds((prev) => ({
        ...prev,
        [taskId]: true,
      }));

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

        await refreshStatsOnly();

        toast.success("Task archived", {
          description: taskToArchive.task
            ? `"${taskToArchive.task}" is now in Archive.`
            : "The task is now in Archive.",
        });
      } catch (error: any) {
        const message = error.message || "Failed to archive task";
        console.error(error);

        setTasks((prev) => {
          if (prev.some((task) => task.id === taskId)) {
            return prev.map((task) =>
              task.id === taskId
                ? { ...task, is_archived: false, archived_at: null }
                : task
            );
          }

          const next = [...prev];
          const safeIndex = Math.min(Math.max(taskIndex, 0), next.length);
          next.splice(safeIndex, 0, {
            ...taskToArchive,
            is_archived: false,
            archived_at: null,
          });
          return next;
        });

        setAllTasksForStats((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, is_archived: false, archived_at: null }
              : task
          )
        );

        toast.error("Archive failed", {
          description: message,
          action: {
            label: "Retry",
            onClick: () => archiveTask(taskId),
          },
        });
      } finally {
        delete archiveTimersRef.current[taskId];

        setDeletingTaskIds((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      }
    }, ARCHIVE_UNDO_DURATION);
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

      await refreshStatsOnly();

      toast.success("Task restored", {
        description: "The task is back in your active workspace.",
      });
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
      toast.error("Task not found", {
        description: "Could not find the task to delete.",
      });
      return;
    }

    const previousTasks = tasks;
    const previousAllTasks = allTasksForStats;

    setDeletingTaskIds((prev) => ({ ...prev, [taskId]: true }));
    setTasks((prev) => removeTaskFromList(prev, taskId));
    setAllTasksForStats((prev) => markTaskDeletedInList(prev, taskId));

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

      toast.success("Task permanently deleted", {
        description: taskToDelete.task
          ? `"${taskToDelete.task}" was removed from Archive.`
          : "The task was removed from Archive.",
      });

      await refreshTasks();
    } catch (error: any) {
      const message = error.message || "Failed to permanently delete task";
      console.error(error);

      setTasks(previousTasks);
      setAllTasksForStats(previousAllTasks);

      toast.error("Permanent delete failed", {
        description: message,
      });
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
    return (
      <div className="dashboard-page-root" style={dashboardPageRootStyle}>
        <style>{dashboardResponsiveCss}</style>

        <DashboardHeader
          userEmail={email}
          onBilling={handleBilling}
          onDisconnect={() => undefined}
          onLogout={handleLogout}
          isDisconnecting={false}
          isLoggingOut={isLoggingOut}
        />

        <DashboardTopSummaryStrip
          openTasks={stats.open}
          highPriority={stats.high}
          doneTasks={stats.done}
          progress={progressStats}
        />

        <div className="dashboard-primary-grid" style={dashboardPrimaryGridStyle}>
          <DashboardUrgentTasksCard
            urgentTasks={urgentPreviewTasks}
            overdueCount={dashboardAlerts.counts.overdue}
            dueTodayCount={dashboardAlerts.counts.dueToday}
            dueTomorrowCount={dashboardAlerts.counts.dueTomorrow}
            dueSoonCount={dashboardAlerts.counts.dueSoon}
            onOpenTask={handleOpenTaskFromDashboard}
          />

          <RevenueSnapshotPremium
            thisMonth={incomeAnalytics.summary.thisMonth}
            nextMonth={incomeAnalytics.summary.nextMonth}
            previousMonth={incomeAnalytics.summary.previousMonth}
            clients={incomeAnalytics.byClient.length}
            taskTypes={incomeAnalytics.byTaskType.length}
            tasks={visibleStatsTasks.length}
          />
        </div>

        <DashboardAnalyticsOverviewSection analytics={incomeAnalytics} />
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
            copyTask={copyTask}
            archiveTask={archiveTask}
            restoreTask={restoreTask}
            permanentlyDeleteTask={permanentlyDeleteTask}
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

  .dashboard-primary-grid > * {
    min-width: 0;
  }

  @media (max-width: 900px) {
    .dashboard-page-root {
      gap: 16px !important;
    }

    .dashboard-primary-grid {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }
  }

  @media (min-width: 901px) {
    .dashboard-page-root {
      gap: 18px !important;
    }

    .dashboard-primary-grid {
      grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.92fr) !important;
      gap: 18px !important;
      align-items: stretch !important;
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

const dashboardPrimaryGridStyle: CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 18,
  alignItems: "stretch",
  overflowX: "hidden",
};