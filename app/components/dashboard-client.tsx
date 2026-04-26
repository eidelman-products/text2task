"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import EmptyState from "./dashboard/empty-state";
import TasksView, { TaskGroup, TaskRow } from "./dashboard/tasks-view";
import ExtractWorkspace from "./dashboard/extract-workspace";
import RevenueSnapshotPremium from "./dashboard/revenue-snapshot-premium";
import DashboardShell from "./dashboard/dashboard-shell";
import DashboardSidebarProfile from "./dashboard/dashboard-sidebar-profile";
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

const DELETE_UNDO_DURATION = 7000;

export default function DashboardClient({
  email,
  userId,
  initialPlan,
}: DashboardClientProps) {
  const [activeNav, setActiveNav] = useState<"dashboard" | "extract" | "tasks">(
    "dashboard"
  );
  const [plan] = useState<"free" | "pro">(initialPlan);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
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

  const saveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {}
  );
  const copyTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {}
  );
  const deleteTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {}
  );

  const stats = useMemo(() => {
    const total = tasks.length;
    const high = tasks.filter((task) => task.priority === "High").length;
    const open = tasks.filter((task) => task.status !== "Done").length;
    const done = tasks.filter((task) => task.status === "Done").length;

    return { total, high, open, done };
  }, [tasks]);

  const dashboardAlerts = useMemo(() => getDashboardAlerts(tasks), [tasks]);
  const incomeAnalytics = useMemo(() => getIncomeAnalytics(tasks), [tasks]);
  const progressStats = useMemo(() => getPaidCompletedProgress(tasks), [tasks]);

  const urgentPreviewTasks = useMemo(() => {
    return buildUrgentPreviewTasks(tasks).slice(0, 4);
  }, [tasks]);

  const groupedTasks = useMemo<TaskGroup[]>((() => {
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
  }) as any, [tasks, searchTerm, statusFilter, priorityFilter, sortOption]);

  const visibleTasks = useMemo(() => {
    return groupedTasks.flatMap((group) => group.tasks);
  }, [groupedTasks]);

  async function fetchTasksFromServer(): Promise<TaskRow[]> {
    const res = await fetch("/api/tasks", {
      method: "GET",
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load tasks");
    }

    return (data.tasks || []).map(normalizeTaskFromApi);
  }

  function exportVisibleTasksToCsv() {
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

    setTasks((prev) => [...[...rows].reverse(), ...prev]);

    toast.success("Tasks saved", {
      description:
        rows.length === 1
          ? "1 task was added to your CRM."
          : `${rows.length} tasks were added to your CRM.`,
    });
  }

  function handleOpenTaskFromDashboard(taskId: number) {
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
      Object.values(deleteTimersRef.current).forEach((timer) =>
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

        const mappedTasks = await fetchTasksFromServer();
        setTasks(mappedTasks);
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
  }, [userId]);

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

    setSavingTaskIds((prev) => ({ ...prev, [taskId]: true }));
    setSavedTaskIds((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });

    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status } : task))
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
        throw new Error(data.error || "Failed to update task status");
      }

      const updatedTask = data.task ? normalizeTaskFromApi(data.task) : null;

      if (updatedTask) {
        setTasks((prev) =>
          prev.map((task) => (task.id === taskId ? updatedTask : task))
        );
      }

      markTaskSaved(taskId);
    } catch (error: any) {
      const message = error.message || "Failed to update task status";
      console.error(error);
      setTasks(previousTasks);
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
      currentValue = String(currentTask.client?.phone ?? "").trim();
    } else if (field === "email") {
      currentValue = String(currentTask.client?.email ?? "").trim();
    } else if (field === "notes") {
      currentValue = String(currentTask.client?.notes ?? "").trim();
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

    setSavingTaskIds((prev) => ({ ...prev, [taskId]: true }));
    setSavedTaskIds((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });

    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;

        if (field === "phone" || field === "email" || field === "notes") {
          return {
            ...task,
            client: task.client
              ? {
                  ...task.client,
                  [field]:
                    normalizedValue === "" && field !== "notes"
                      ? null
                      : normalizedValue === ""
                      ? null
                      : normalizedValue,
                }
              : null,
            ...(field === "phone"
              ? { client_phone: normalizedValue === "" ? null : normalizedValue }
              : {}),
            ...(field === "email"
              ? { client_email: normalizedValue === "" ? null : normalizedValue }
              : {}),
            ...(field === "notes"
              ? { client_notes: normalizedValue === "" ? null : normalizedValue }
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
          return { ...task, status: normalizedValue };
        }

        return task;
      })
    );

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
        throw new Error(data.error || "Failed to update task");
      }

      const updatedTask = data.task ? normalizeTaskFromApi(data.task) : null;

      if (updatedTask) {
        setTasks((prev) =>
          prev.map((task) => (task.id === taskId ? updatedTask : task))
        );
      }

      markTaskSaved(taskId);

      toast.success("Task updated", {
        description: "Your change was saved successfully.",
      });
    } catch (error: any) {
      const message = error.message || "Failed to update task";
      console.error(error);
      setTasks(previousTasks);
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

  async function deleteTask(taskId: number) {
    const taskToDelete = tasks.find((task) => task.id === taskId);
    const taskIndex = tasks.findIndex((task) => task.id === taskId);

    if (!taskToDelete || taskIndex === -1) {
      toast.error("Task not found", {
        description: "Could not find the task to delete.",
      });
      return;
    }

    if (deleteTimersRef.current[taskId]) {
      clearTimeout(deleteTimersRef.current[taskId]);
      delete deleteTimersRef.current[taskId];
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));

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

    const toastId = toast("Task deleted", {
      description: taskToDelete.task
        ? `"${taskToDelete.task}" will be permanently deleted in a few seconds.`
        : "This task will be permanently deleted in a few seconds.",
      duration: DELETE_UNDO_DURATION,
      action: {
        label: "Undo",
        onClick: () => {
          if (deleteTimersRef.current[taskId]) {
            clearTimeout(deleteTimersRef.current[taskId]);
            delete deleteTimersRef.current[taskId];
          }

          setTasks((prev) => {
            if (prev.some((task) => task.id === taskId)) {
              return prev;
            }

            const next = [...prev];
            const safeIndex = Math.min(Math.max(taskIndex, 0), next.length);
            next.splice(safeIndex, 0, taskToDelete);
            return next;
          });

          setDeletingTaskIds((prev) => {
            const next = { ...prev };
            delete next[taskId];
            return next;
          });

          toast.dismiss(toastId);
          toast.success("Task restored", {
            description: "The task was restored before deletion.",
          });
        },
      },
    });

    deleteTimersRef.current[taskId] = setTimeout(async () => {
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
          body: JSON.stringify({ taskId }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to delete task");
        }

        toast.success("Task permanently deleted", {
          description: taskToDelete.task
            ? `"${taskToDelete.task}" was removed.`
            : "The task was removed.",
        });
      } catch (error: any) {
        const message = error.message || "Failed to delete task";
        console.error(error);

        setTasks((prev) => {
          if (prev.some((task) => task.id === taskId)) {
            return prev;
          }

          const next = [...prev];
          const safeIndex = Math.min(Math.max(taskIndex, 0), next.length);
          next.splice(safeIndex, 0, taskToDelete);
          return next;
        });

        toast.error("Delete failed", {
  description: message,
  action: {
    label: "Retry",
    onClick: () => deleteTask(taskId),
  },
});
      } finally {
        delete deleteTimersRef.current[taskId];

        setDeletingTaskIds((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      }
    }, DELETE_UNDO_DURATION);
  }

  function toggleClientGroup(groupKey: string) {
    setExpandedClients((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }

  function renderDashboard() {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <DashboardHeroHeader
          openTasks={stats.open}
          highPriority={stats.high}
          doneTasks={stats.done}
        />

        <DashboardTopSummaryStrip
          openTasks={stats.open}
          highPriority={stats.high}
          doneTasks={stats.done}
          progress={progressStats}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.55fr) minmax(320px, 0.85fr)",
            gap: 16,
            alignItems: "start",
          }}
        >
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
            tasks={stats.total}
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
        existingTasks={tasks}
        fetchTasksFromServer={fetchTasksFromServer}
        onTasksSaved={handleTasksSaved}
        onGoToTasks={() => setActiveNav("tasks")}
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
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
            sortOption={sortOption}
            visibleTasksCount={visibleTasks.length}
            highlightedTaskId={highlightedTaskId}
            onSearchTermChange={setSearchTerm}
            onStatusFilterChange={setStatusFilter}
            onPriorityFilterChange={setPriorityFilter}
            onSortOptionChange={setSortOption}
            onExportCsv={exportVisibleTasksToCsv}
            toggleClientGroup={toggleClientGroup}
            updateTaskStatus={updateTaskStatus}
            updateTaskField={updateTaskField}
            copyTask={copyTask}
            deleteTask={deleteTask}
          />
        );
      case "dashboard":
      default:
        return renderDashboard();
    }
  }

  return (
    <DashboardShell
      sidebar={
        <DashboardSidebarProfile
          email={email}
          plan={plan}
          activeNav={activeNav}
          onNavChange={setActiveNav}
        />
      }
    >
      {renderContent()}
    </DashboardShell>
  );
}

function DashboardHeroHeader({
  openTasks,
  highPriority,
  doneTasks,
}: {
  openTasks: number;
  highPriority: number;
  doneTasks: number;
}) {
  return (
    <section style={heroShellStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
          <div
            style={{
              fontSize: 40,
              fontWeight: 950,
              lineHeight: 1.02,
              letterSpacing: "-0.06em",
              color: "#0f172a",
            }}
          >
            Dashboard
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#526174",
              lineHeight: 1.65,
              maxWidth: 720,
            }}
          >
            See what needs attention now and track your revenue with a cleaner,
            sharper workspace.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <HeroPill label="Open" value={openTasks} tone="slate" />
          <HeroPill label="High priority" value={highPriority} tone="red" />
          <HeroPill label="Done" value={doneTasks} tone="green" />
        </div>
      </div>
    </section>
  );
}

function HeroPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "green" | "red";
}) {
  const palette = {
    slate: {
      background: "rgba(255,255,255,0.78)",
      border: "1px solid rgba(148,163,184,0.14)",
      color: "#475569",
    },
    green: {
      background: "rgba(240,253,244,0.84)",
      border: "1px solid rgba(34,197,94,0.14)",
      color: "#15803d",
    },
    red: {
      background: "rgba(254,242,242,0.84)",
      border: "1px solid rgba(239,68,68,0.16)",
      color: "#dc2626",
    },
  }[tone];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        border: palette.border,
        background: palette.background,
        color: palette.color,
        boxShadow: "0 10px 20px rgba(15,23,42,0.035)",
      }}
    >
      <span style={{ color: "#64748b", fontWeight: 700 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const heroShellStyle: React.CSSProperties = {
  borderRadius: 28,
  padding: 18,
  border: "1px solid rgba(255,255,255,0.84)",
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.82) 0%, rgba(244,247,255,0.88) 100%)",
  boxShadow:
    "0 22px 42px rgba(99,102,241,0.05), inset 0 1px 0 rgba(255,255,255,0.92)",
  backdropFilter: "blur(18px)",
};