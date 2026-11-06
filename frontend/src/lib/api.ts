import type {
  ActivityLog,
  Agent,
  DashboardStats,
  Health,
  Task,
  TaskCreate,
  TaskExecution,
  TaskStatusUpdate,
} from "@/lib/types";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Could not reach the HackNova API. Check that the backend is running.");
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}.`;
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "detail" in body) {
        const value = body.detail;
        detail = Array.isArray(value)
          ? value.map((item) => typeof item === "object" && item !== null && "msg" in item ? String(item.msg) : String(item)).join(" ")
          : String(value);
      }
    } catch {
      // Keep the status based message when an error response has no JSON body.
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => request<Health>("/health"),
  agents: () => request<Agent[]>("/agents"),
  tasks: () => request<Task[]>("/tasks"),
  activity: () => request<ActivityLog[]>("/activity"),
  stats: () => request<DashboardStats>("/dashboard/summary"),
  createTask: (task: TaskCreate) => request<Task>("/tasks", { method: "POST", body: JSON.stringify(task) }),
  updateTaskStatus: (taskId: string, update: TaskStatusUpdate) =>
    request<Task>(`/tasks/${encodeURIComponent(taskId)}/status`, { method: "PATCH", body: JSON.stringify(update) }),
  assignTask: (taskId: string, agentId: string | null) =>
    request<Task>(`/tasks/${encodeURIComponent(taskId)}/assignment${agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ""}`, {
      method: "PATCH",
    }),
  execution: (taskId: string) => request<TaskExecution | null>(`/tasks/${encodeURIComponent(taskId)}/execution`),
  executeTask: (taskId: string) =>
    request<TaskExecution>(`/tasks/${encodeURIComponent(taskId)}/execute`, {
      method: "POST",
      body: JSON.stringify({ confirmed: true }),
    }),
};
