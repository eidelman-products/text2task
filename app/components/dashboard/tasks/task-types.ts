export type TaskArchiveView = "active" | "archived" | "all";

export type ClientEntity = {
  id: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

export type ProjectEntity = {
  id: string;
  client_id?: string | null;
  client_name?: string | null;
  contact_name?: string | null;
  title?: string | null;
  summary?: string | null;
  amount?: string | null;
  amount_value?: number | null;
  currency_code?: string | null;
  deadline_text?: string | null;
  deadline_date?: string | null;
  priority?: string | null;
  status?: string | null;
  source?: string | null;
  raw_input?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
  deleted_at?: string | null;
};

export type TaskRow = {
  id: number;
  client: ClientEntity | null;
  project?: ProjectEntity | null;
  task: string;
  amount: string;
  deadline: string;
  priority: string;
  status: string;
  source: string;
  raw_input?: string;
  deadline_date?: string | null;
  deadline_original_text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
  deleted_at?: string | null;

  contact_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_notes?: string | null;

  project_id?: string | null;
  subtask_order?: number | null;
};

export type TaskGroup = {
  key: string;
  clientName: string;
  contactName?: string | null;
  tasks: TaskRow[];
};

/**
 * A single deliverable/subtask inside a grouped client project.
 *
 * Example:
 * Project: Rivon Media — Product video editing package
 * Contact: Mark
 * Subtasks:
 * - Short Facebook ad
 * - Vertical reel
 * - 3 Instagram story clips
 */
export type TaskProjectSubtask = {
  id: number;
  project_id?: string | null;
  title: string;
  status: string;
  priority: string;
  amount: string;
  deadline: string;
  deadline_date?: string | null;
  deadline_original_text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
  deleted_at?: string | null;
};

/**
 * New 2026 SaaS CRM display model.
 *
 * Instead of showing every extracted task as a separate table row,
 * the UI shows one clean client/project row with expandable subtasks.
 */
export type TaskProjectGroup = {
  key: string;

  project_id?: string | null;
  project?: ProjectEntity | null;

  clientName: string;
  contactName?: string | null;

  projectTitle: string;
  projectSummary: string;

  tasks: TaskRow[];
  subtasks: TaskProjectSubtask[];
  primaryTask: TaskRow;
  taskIds: number[];

  amount: string;
  deadline: string;
  deadline_date?: string | null;
  deadline_original_text?: string | null;

  priority: string;
  status: string;
  source: string;

  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
  deleted_at?: string | null;

  contact_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_notes?: string | null;

  hasContactDetails: boolean;
  subtaskCount: number;
  completedSubtaskCount: number;
};