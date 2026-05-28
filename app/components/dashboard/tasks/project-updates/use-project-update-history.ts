import { useCallback, useState } from "react";
import type { TaskProjectGroup } from "../task-types";
import type {
  ProjectUpdateHistoryApiResponse,
  ProjectUpdateHistoryState,
} from "./project-update-history-types";

function getProjectId(project: TaskProjectGroup | null) {
  if (!project) return null;

  const directProjectId =
    project.project_id ||
    project.primaryTask?.project_id ||
    project.tasks.find((task) => task.project_id)?.project_id ||
    "";

  if (directProjectId) return directProjectId;

  const cleaned = String(project.key || "").trim();

  if (cleaned.startsWith("project::")) {
    return cleaned.replace("project::", "").trim() || null;
  }

  if (cleaned.startsWith("project:")) {
    return cleaned.replace("project:", "").trim() || null;
  }

  return null;
}

function getHistoryErrorMessage(status: number, fallback?: string) {
  if (status === 401) {
    return "You need to be signed in to view project update history.";
  }

  if (status === 404) {
    return "Text2Task could not find this project. Refresh the dashboard and try again.";
  }

  if (status === 400) {
    return fallback || "This project needs a saved project id before history can be loaded.";
  }

  return fallback || "Could not load update history. Please try again.";
}

export function useProjectUpdateHistory() {
  const [state, setState] = useState<ProjectUpdateHistoryState>({
    isOpen: false,
    project: null,
    isLoading: false,
    error: null,
    updates: [],
    events: [],
  });

  const loadHistory = useCallback(async (project: TaskProjectGroup) => {
    const projectId = getProjectId(project);

    if (!projectId) {
      setState((current) => ({
        ...current,
        isLoading: false,
        error: "This project needs a saved project id before history can be loaded.",
      }));
      return;
    }

    setState((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await fetch(
        `/api/project-updates/history?projectId=${encodeURIComponent(projectId)}`
      );
      const payload = (await response.json().catch(() => null)) as
        | ProjectUpdateHistoryApiResponse
        | null;

      if (!response.ok || !payload?.ok) {
        const fallback = payload && "error" in payload ? payload.error : undefined;
        throw new Error(getHistoryErrorMessage(response.status, fallback));
      }

      setState((current) => ({
        ...current,
        isLoading: false,
        error: null,
        updates: payload.updates,
        events: payload.events,
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not load update history. Please try again.";

      setState((current) => ({
        ...current,
        isLoading: false,
        error: message,
        updates: [],
        events: [],
      }));
    }
  }, []);

  const openHistory = useCallback((project: TaskProjectGroup) => {
    setState({
      isOpen: true,
      project,
      isLoading: true,
      error: null,
      updates: [],
      events: [],
    });

    void loadHistory(project);
  }, [loadHistory]);

  const closeHistory = useCallback(() => {
    setState({
      isOpen: false,
      project: null,
      isLoading: false,
      error: null,
      updates: [],
      events: [],
    });
  }, []);

  const refreshHistory = useCallback(() => {
    setState((current) => {
      if (current.project) {
        void loadHistory(current.project);
      }

      return current;
    });
  }, [loadHistory]);

  return {
    state,
    openHistory,
    closeHistory,
    refreshHistory,
  };
}
