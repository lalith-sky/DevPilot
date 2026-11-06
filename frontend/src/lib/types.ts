export type Agent = {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  status: "registered";
  ai_enabled: false;
  created_at: string;
};

export type TaskStatus = "queued" | "in_progress" | "completed" | "cancelled";

export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskCreate = {
  title: string;
  description: string;
};

export type TaskStatusUpdate = {
  status: TaskStatus;
};

export type TaskExecutionStatus = "pending" | "running" | "completed" | "failed";

export type TaskExecution = {
  id: string;
  task_id: string;
  status: TaskExecutionStatus;
  stdout: string;
  stderr: string;
  jsonl_events: number;
  exit_code: number | null;
  final_response: string | null;
  started_at: string | null;
  completed_at: string | null;
  timeout_seconds: number;
  error: string | null;
};

export type ActivityLog = {
  id: string;
  action: "task_created" | "task_assigned" | "task_status_updated";
  message: string;
  task_id: string;
  created_at: string;
};

export type DashboardStats = {
  agents_registered: number;
  agents_connected: number;
  tasks_total: number;
  tasks_queued: number;
  tasks_in_progress: number;
  tasks_completed: number;
};

export type Health = {
  status: "ok";
};
