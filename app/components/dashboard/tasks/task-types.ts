export type TaskArchiveView = "active" | "archived" | "all";

export type ClientEntity = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

export type TaskRow = {
  id: number;
  client: ClientEntity | null;
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
  completed_at?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
  deleted_at?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_notes?: string | null;
};

export type TaskGroup = {
  key: string;
  clientName: string;
  tasks: TaskRow[];
};