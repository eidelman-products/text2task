import type { TaskGroup, TaskRow } from "./tasks-view";

export type TaskStatusFilter = "all" | "new" | "in-progress" | "done";
export type TaskPriorityFilter = "all" | "low" | "medium" | "high";
export type TaskSortOption =
  | "created-desc"
  | "created-asc"
  | "client-asc"
  | "client-desc"
  | "task-asc"
  | "task-desc"
  | "deadline-asc"
  | "deadline-desc";

export type TaskViewControls = {
  searchTerm: string;
  statusFilter: TaskStatusFilter;
  priorityFilter: TaskPriorityFilter;
  sortOption: TaskSortOption;
};

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function normalizeStatus(value: string | null | undefined): TaskStatusFilter {
  const status = normalize(value || "");

  if (!status) return "new";

  if (status === "new") return "new";
  if (status === "done" || status === "completed" || status === "complete") {
    return "done";
  }

  if (
    status === "in progress" ||
    status === "in-progress" ||
    status === "in_progress" ||
    status === "progress"
  ) {
    return "in-progress";
  }

  return "new";
}

function getFilterableStatus(task: TaskRow): TaskStatusFilter {
  return normalizeStatus(task.project?.status || task.status);
}

function getClientDisplayName(task: TaskRow) {
  return task.client?.name?.trim() || "";
}

function getTaskCreatedTime(task: TaskRow) {
  const value = task.project?.created_at || task.created_at;
  if (!value) return 0;

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getGroupCreatedTime(
  group: TaskGroup,
  direction: "newest" | "oldest"
) {
  const times = group.tasks
    .map((task) => getTaskCreatedTime(task))
    .filter((time) => time > 0);

  if (!times.length) return 0;

  return direction === "newest" ? Math.max(...times) : Math.min(...times);
}

function getSearchableStatus(task: TaskRow) {
  const status = getFilterableStatus(task);

  if (status === "in-progress") return "in progress";
  return status;
}

function matchesSearch(task: TaskRow, searchTerm: string) {
  const term = normalize(searchTerm);
  if (!term) return true;

  const haystack = [
    getClientDisplayName(task),
    task.project?.client_name || "",
    task.project?.contact_name || "",
    task.project?.title || "",
    task.project?.summary || "",
    task.task,
    task.amount,
    task.deadline,
    task.priority,
    task.status,
    task.project?.status || "",
    getSearchableStatus(task),
    task.source,
    task.raw_input || "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(term);
}

function matchesStatus(task: TaskRow, statusFilter: TaskStatusFilter) {
  if (statusFilter === "all") return true;

  return getFilterableStatus(task) === statusFilter;
}

function matchesPriority(task: TaskRow, priorityFilter: TaskPriorityFilter) {
  if (priorityFilter === "all") return true;

  return normalize(task.priority) === priorityFilter;
}

function sortTasks(tasks: TaskRow[], sortOption: TaskSortOption) {
  const sorted = [...tasks];

  sorted.sort((a, b) => {
    switch (sortOption) {
      case "created-desc":
        return getTaskCreatedTime(b) - getTaskCreatedTime(a);

      case "created-asc":
        return getTaskCreatedTime(a) - getTaskCreatedTime(b);

      case "client-asc":
        return getClientDisplayName(a).localeCompare(getClientDisplayName(b));

      case "client-desc":
        return getClientDisplayName(b).localeCompare(getClientDisplayName(a));

      case "task-asc":
        return a.task.localeCompare(b.task);

      case "task-desc":
        return b.task.localeCompare(a.task);

      case "deadline-asc":
        return a.deadline.localeCompare(b.deadline);

      case "deadline-desc":
        return b.deadline.localeCompare(a.deadline);

      default:
        return 0;
    }
  });

  return sorted;
}

function sortGroups(groups: TaskGroup[], sortOption: TaskSortOption) {
  const sorted = [...groups];

  sorted.sort((a, b) => {
    const aFirst = a.tasks[0];
    const bFirst = b.tasks[0];

    switch (sortOption) {
      case "created-desc":
        return (
          getGroupCreatedTime(b, "newest") -
          getGroupCreatedTime(a, "newest")
        );

      case "created-asc":
        return (
          getGroupCreatedTime(a, "oldest") -
          getGroupCreatedTime(b, "oldest")
        );

      case "client-asc":
        return a.clientName.localeCompare(b.clientName);

      case "client-desc":
        return b.clientName.localeCompare(a.clientName);

      case "task-asc":
        return (aFirst?.task || "").localeCompare(bFirst?.task || "");

      case "task-desc":
        return (bFirst?.task || "").localeCompare(aFirst?.task || "");

      case "deadline-asc":
        return (aFirst?.deadline || "").localeCompare(bFirst?.deadline || "");

      case "deadline-desc":
        return (bFirst?.deadline || "").localeCompare(aFirst?.deadline || "");

      default:
        return 0;
    }
  });

  return sorted;
}

export function buildFilteredGroupedTasks(
  groupedTasks: TaskGroup[],
  controls: TaskViewControls
): TaskGroup[] {
  const result: TaskGroup[] = [];

  for (const group of groupedTasks) {
    const filteredTasks = group.tasks.filter((task) => {
      return (
        matchesSearch(task, controls.searchTerm) &&
        matchesStatus(task, controls.statusFilter) &&
        matchesPriority(task, controls.priorityFilter)
      );
    });

    if (!filteredTasks.length) continue;

    result.push({
      ...group,
      tasks: sortTasks(filteredTasks, controls.sortOption),
    });
  }

  return sortGroups(result, controls.sortOption);
}
