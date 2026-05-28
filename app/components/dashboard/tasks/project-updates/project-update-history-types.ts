import type { TaskProjectGroup } from "../task-types";
import type {
  JsonRecord,
  ProjectTimelineEventRecord,
  ProjectUpdateRecord,
  SuggestedProjectUpdateItem,
} from "./project-update-types";

export type ProjectUpdateHistoryEntry = {
  update: ProjectUpdateRecord & {
    applied_at?: string | null;
    ignored_at?: string | null;
    reviewed_at?: string | null;
  };
  items: SuggestedProjectUpdateItem[];
  timelineEvents: ProjectTimelineEventRecord[];
};

export type ProjectUpdateHistoryApiResponse =
  | {
      ok: true;
      updates: ProjectUpdateHistoryEntry[];
      events: ProjectTimelineEventRecord[];
    }
  | {
      ok: false;
      error: string;
    };

export type ProjectUpdateHistoryState = {
  isOpen: boolean;
  project: TaskProjectGroup | null;
  isLoading: boolean;
  error: string | null;
  updates: ProjectUpdateHistoryEntry[];
  events: ProjectTimelineEventRecord[];
};

export type ProjectUpdateHistoryStatus =
  | "applied"
  | "partial"
  | "suggested"
  | "duplicate"
  | "no_changes"
  | "failed";

export type ProjectUpdateHistoryValueRow = {
  label: string;
  value: string;
};

export type ProjectUpdateHistoryJsonRecord = JsonRecord;
