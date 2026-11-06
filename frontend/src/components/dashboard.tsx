"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Activity, AlertCircle, Bot, Check, ChevronDown, CircleHelp, Clock3,
  LayoutDashboard, ListTodo, LoaderCircle, Menu, Plus, RefreshCw, Server,
  Settings2, ShieldCheck, X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ActivityLog, Agent, DashboardStats, Task, TaskExecution, TaskStatus } from "@/lib/types";

type Section = "Overview" | "Agents" | "Tasks" | "Activity";
type Connection = "checking" | "online" | "offline";

const sections: { name: Section; icon: typeof LayoutDashboard }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Agents", icon: Bot },
  { name: "Tasks", icon: ListTodo },
  { name: "Activity", icon: Activity },
];

const taskStatuses: TaskStatus[] = ["queued", "in_progress", "completed", "cancelled"];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(status: TaskStatus) {
  return status.replace("_", " ");
}

function StatCard({ label, value, icon: Icon, loading }: { label: string; value: number | null; icon: typeof Bot; loading: boolean }) {
  return <article className="stat-card">
    <div className="stat-label">{label}<span className="stat-icon"><Icon size={16} /></span></div>
    <div className="stat-value">{value === null ? loading ? <span className="stat-loading" /> : "—" : value}</div>
  </article>;
}

function AgentList({ agents, loading, error }: { agents: Agent[]; loading: boolean; error?: boolean }) {
  if (error) return <div className="state-message"><AlertCircle size={17} /> Agent data could not be loaded.</div>;
  if (loading) return <div className="state-message"><LoaderCircle className="spin" size={18} /> Loading registered agents…</div>;
  if (!agents.length) return <div className="empty-state"><Bot size={22} /><strong>No agents registered</strong><span>Registered agents will appear here when added.</span></div>;
  return <div className="agent-list">{agents.map((agent) => <article className="agent-card" key={agent.id}>
    <div className="agent-symbol"><Bot size={18} /></div>
    <div className="agent-content"><div className="agent-title"><h3>{agent.name}</h3><span className="registration-badge"><span /> Registered</span></div>
      <p>{agent.description}</p>
      <div className="capability-list">{agent.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div>
    </div>
    <span className="agent-notice"><ShieldCheck size={14} /> Not AI-powered</span>
  </article>)}</div>;
}

function TaskList({
  tasks, agents, executions, loading, error, updatingId, onStatusChange, onAssignmentChange, onExecute,
}: {
  tasks: Task[];
  agents: Agent[];
  executions: Record<string, TaskExecution | null>;
  loading: boolean;
  error?: boolean;
  updatingId: string | null;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onAssignmentChange: (taskId: string, agentId: string | null) => void;
  onExecute: (taskId: string) => void;
}) {
  if (error) return <div className="state-message"><AlertCircle size={17} /> Task data could not be loaded.</div>;
  if (loading) return <div className="state-message"><LoaderCircle className="spin" size={18} /> Loading tasks…</div>;
  if (!tasks.length) return <div className="empty-state"><ListTodo size={22} /><strong>No tasks yet</strong><span>Create a task to start tracking work in this workspace.</span></div>;
  return <div className="task-list">{tasks.map((task) => {
    const execution = executions[task.id];
    const executionActive = execution?.status === "pending" || execution?.status === "running";
    const canExecute = task.assigned_agent_id === "code-engineer";
    return <article className="task-row" key={task.id}>
    <span className={`task-mark ${task.status}`} aria-hidden="true">{task.status === "completed" ? <Check size={13} /> : null}</span>
    <div className="task-copy"><h3>{task.title}</h3><p>{task.description || "No description provided."}</p><span className="task-date"><Clock3 size={12} /> Updated {formatDate(task.updated_at)}</span></div>
    <div className="task-assignment-control"><label className="sr-only" htmlFor={`agent-${task.id}`}>Agent for {task.title}</label><select id={`agent-${task.id}`} value={task.assigned_agent_id ?? ""} disabled={updatingId === task.id} onChange={(event) => onAssignmentChange(task.id, event.target.value || null)}><option value="">Unassigned</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></div>
    <div className="task-execution"><span className={`execution-status ${execution?.status ?? "not-started"}`}>{execution?.status ?? "not started"}</span>{canExecute && <button className="execute-button" disabled={executionActive} onClick={() => onExecute(task.id)}>{executionActive ? "Running…" : "Execute"}</button>}{execution?.final_response && <details><summary>Result</summary><pre>{execution.final_response}</pre></details>}{execution?.error && <details><summary>Error</summary><pre>{execution.error}</pre></details>}{execution && (execution.stdout || execution.stderr) && <details><summary>Logs ({execution.jsonl_events} JSON events)</summary><pre>{execution.stdout || execution.stderr}</pre></details>}</div>
    <div className="task-status-control"><label className="sr-only" htmlFor={`status-${task.id}`}>Status for {task.title}</label>
      <select id={`status-${task.id}`} value={task.status} disabled={updatingId === task.id} onChange={(event) => onStatusChange(task.id, event.target.value as TaskStatus)}>
        {taskStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
      </select>{updatingId === task.id && <LoaderCircle className="spin status-spinner" size={14} />}</div>
  </article>;
  })}</div>;
}

function ActivityList({ entries, loading, error }: { entries: ActivityLog[]; loading: boolean; error?: boolean }) {
  if (error) return <div className="state-message"><AlertCircle size={17} /> Activity data could not be loaded.</div>;
  if (loading) return <div className="state-message"><LoaderCircle className="spin" size={18} /> Loading activity…</div>;
  if (!entries.length) return <div className="empty-state"><Activity size={22} /><strong>No activity recorded</strong><span>Task creation and status changes will be recorded here.</span></div>;
  return <div className="activity-list">{entries.map((entry) => <article className="activity-row" key={entry.id}>
    <span className="activity-marker"><Activity size={14} /></span><div><p>{entry.message}</p><span>{formatDate(entry.created_at)}</span></div>
  </article>)}</div>;
}

export function Dashboard() {
  const [section, setSection] = useState<Section>("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [connection, setConnection] = useState<Connection>("checking");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState("");
  const [createError, setCreateError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<Record<string, TaskExecution | null>>({});

  const refresh = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setRefreshError("");
    try {
      const health = await api.health();
      setConnection(health.status === "ok" ? "online" : "offline");
      const [nextStats, nextAgents, nextTasks, nextActivity] = await Promise.all([
        api.stats(), api.agents(), api.tasks(), api.activity(),
      ]);
      setStats(nextStats);
      setAgents(nextAgents);
      setTasks(nextTasks);
      const executionEntries = await Promise.all(nextTasks.map(async (task) => [task.id, await api.execution(task.id)] as const));
      setExecutions(Object.fromEntries(executionEntries));
      setActivity(nextActivity);
    } catch (error) {
      if (error instanceof ApiError) setConnection(error.status ? "online" : "offline");
      setRefreshError(error instanceof Error ? error.message : "Could not load workspace data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(true); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const hasActiveExecution = Object.values(executions).some((execution) => execution?.status === "pending" || execution?.status === "running");
    if (!hasActiveExecution) return;
    const timer = window.setInterval(() => { void refresh(); }, 2000);
    return () => window.clearInterval(timer);
  }, [executions, refresh]);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (cleanTitle.length < 3 || cleanTitle.length > 120) {
      setCreateError("Task title must be between 3 and 120 characters.");
      return;
    }
    if (cleanDescription.length > 2000) {
      setCreateError("Description must be 2,000 characters or fewer.");
      return;
    }
    setCreating(true);
    setCreateError("");
    setSuccessMessage("");
    try {
      await api.createTask({ title: cleanTitle, description: cleanDescription });
      setTitle("");
      setDescription("");
      setSuccessMessage("Task created. No agent was asked to execute it.");
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && !error.status) setConnection("offline");
      setCreateError(error instanceof Error ? error.message : "Could not create task.");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setUpdatingId(taskId);
    setRefreshError("");
    setSuccessMessage("");
    try {
      await api.updateTaskStatus(taskId, { status });
      setSuccessMessage("Task status updated and activity recorded.");
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && !error.status) setConnection("offline");
      setRefreshError(error instanceof Error ? error.message : "Could not update task status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleAssignmentChange(taskId: string, agentId: string | null) {
    setUpdatingId(taskId);
    setRefreshError("");
    setSuccessMessage("");
    try {
      await api.assignTask(taskId, agentId);
      setSuccessMessage(agentId ? "Task assigned. No agent execution was started." : "Task unassigned.");
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && !error.status) setConnection("offline");
      setRefreshError(error instanceof Error ? error.message : "Could not assign task.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleExecute(taskId: string) {
    if (!window.confirm("Start Codex execution for this Code Engineer task? Codex may modify files in the HackNova workspace.")) return;
    setRefreshError("");
    setSuccessMessage("");
    try {
      await api.executeTask(taskId);
      setSuccessMessage("Codex execution started. The task interface will show its result when it finishes.");
      await refresh();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Could not start Codex execution.");
    }
  }

  const activeSection = section === "Overview" ? "Workspace overview" : section;

  return <div className="platform-shell">
    <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><span className="brand-mark"><Server size={17} /></span><span>HackNova</span><button className="mobile-close icon-button" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="workspace-card"><span className="workspace-avatar">N</span><span className="workspace-copy"><strong>Nova workspace</strong><small>Developer platform</small></span><ChevronDown size={15} /></div>
      <p className="nav-caption">PLATFORM</p>
      <nav className="main-nav" aria-label="Main navigation">{sections.map(({ name, icon: Icon }) => <button key={name} onClick={() => { setSection(name); setMenuOpen(false); }} className={`nav-link ${section === name ? "active" : ""}`} aria-current={section === name ? "page" : undefined}><Icon size={17} /><span>{name}</span>{name === "Tasks" && stats && <span className="nav-count">{stats.tasks_total}</span>}</button>)}</nav>
      <div className="sidebar-note"><span className="sidebar-note-icon"><Bot size={15} /></span><div><strong>Agent runtime</strong><span>Not connected</span></div><span className="pending-badge">Planned</span></div>
      <div className="sidebar-bottom"><button className="nav-link" disabled><Settings2 size={17} /><span>Settings</span><span className="pending-label">Soon</span></button><button className="nav-link" disabled><CircleHelp size={17} /><span>Documentation</span><span className="pending-label">Soon</span></button><div className="profile-row"><span className="profile-avatar">HN</span><span className="profile-copy"><strong>HackNova</strong><small>Local workspace</small></span><span className="profile-menu">•••</span></div></div>
    </aside>
    {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="breadcrumbs"><span>Workspace</span><span className="crumb-separator">/</span><strong>{section}</strong></div><div className="topbar-right"><span className={`connection-status ${connection}`}><i />{connection === "checking" ? "Connecting" : connection === "online" ? "API connected" : "API disconnected"}</span><button className="refresh-button" onClick={() => void refresh(true)} aria-label="Refresh workspace data" disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /><span>Refresh</span></button><span className="topbar-divider" /><span className="workspace-short">Local workspace</span></div></header>
      <div className="content-wrap">
        <div className="page-heading"><div><span className="page-kicker">HACKNOVA PLATFORM</span><h1>{activeSection}</h1><p>Manage registered agents and track work across your developer platform.</p></div>{(section === "Tasks" || section === "Overview") && <button className="button-primary" onClick={() => { setSection("Tasks"); document.getElementById("create-task-title")?.focus(); }}><Plus size={16} /> Create task</button>}</div>
        {refreshError && <div className="alert error-alert" role="alert"><AlertCircle size={16} /><span>{refreshError}</span><button onClick={() => void refresh(true)}>Retry</button></div>}
        {successMessage && <div className="alert success-alert" role="status"><Check size={16} /><span>{successMessage}</span><button aria-label="Dismiss message" onClick={() => setSuccessMessage("")}><X size={15} /></button></div>}

        {section === "Overview" && <>
          <section className="stats-grid" aria-label="Workspace statistics">
            <StatCard label="Registered agents" value={stats?.agents_registered ?? null} icon={Bot} loading={loading} />
            <StatCard label="Total tasks" value={stats?.tasks_total ?? null} icon={ListTodo} loading={loading} />
            <StatCard label="In progress" value={stats?.tasks_in_progress ?? null} icon={Activity} loading={loading} />
            <StatCard label="Completed" value={stats?.tasks_completed ?? null} icon={Check} loading={loading} />
          </section>
          <section className="overview-columns"><article className="panel"><div className="panel-heading"><div><h2>Tasks</h2><p>Current workspace task status</p></div><button className="subtle-link" onClick={() => setSection("Tasks")}>View tasks <span>→</span></button></div><TaskList tasks={tasks.slice(0, 5)} agents={agents} executions={executions} loading={loading} error={Boolean(refreshError) && stats === null} updatingId={updatingId} onStatusChange={handleStatusChange} onAssignmentChange={handleAssignmentChange} onExecute={handleExecute} /></article>
            <article className="panel"><div className="panel-heading"><div><h2>Registered agents</h2><p>Available agent records</p></div><button className="subtle-link" onClick={() => setSection("Agents")}>View agents <span>→</span></button></div><AgentList agents={agents.slice(0, 4)} loading={loading} error={Boolean(refreshError) && stats === null} /></article></section>
          <section className="panel overview-activity"><div className="panel-heading"><div><h2>Recent activity</h2><p>Actions recorded by the platform</p></div><button className="subtle-link" onClick={() => setSection("Activity")}>View activity <span>→</span></button></div><ActivityList entries={activity.slice(0, 4)} loading={loading} error={Boolean(refreshError) && stats === null} /></section>
          {!loading && connection === "online" && stats?.agents_registered !== undefined && <p className="runtime-disclosure"><Bot size={14} /> Registered agents are catalog records only. No AI execution runtime is connected.</p>}
        </>}

        {section === "Agents" && <section className="panel page-panel"><div className="panel-heading"><div><h2>Agent registry</h2><p>Registered agent records available to this workspace.</p></div><span className="count-chip">{loading ? "…" : `${agents.length} registered`}</span></div><div className="agent-disclosure"><Bot size={15} /><span>Agents are registered in the platform but are not AI-powered and cannot execute tasks.</span></div><AgentList agents={agents} loading={loading} error={Boolean(refreshError) && stats === null} /></section>}

        {section === "Tasks" && <div className="tasks-layout"><section className="panel create-panel"><div className="panel-heading"><div><h2>Create a task</h2><p>Tasks are tracked only; no agent will run them.</p></div></div><form className="task-form" onSubmit={handleCreateTask}>
          <label htmlFor="create-task-title">Title <span>Required</span></label><input id="create-task-title" value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} required placeholder="e.g. Review deployment configuration" />
          <div className="field-help">3–120 characters</div><label htmlFor="create-task-description">Description <span>Optional</span></label><textarea id="create-task-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} placeholder="Add context or acceptance criteria…" /><div className="form-footer"><span>{description.length}/2,000</span><button className="button-primary" type="submit" disabled={creating || connection !== "online"}>{creating ? <><LoaderCircle size={15} className="spin" /> Creating…</> : <><Plus size={15} /> Add task</>}</button></div>
          {createError && <p className="form-error" role="alert">{createError}</p>}
        </form></section><section className="panel tasks-panel"><div className="panel-heading"><div><h2>Task list</h2><p>{stats ? `${stats.tasks_total} tasks in this workspace` : "Tasks from the API"}</p></div><span className="count-chip">{loading ? "…" : tasks.length}</span></div><TaskList tasks={tasks} agents={agents} executions={executions} loading={loading} error={Boolean(refreshError) && stats === null} updatingId={updatingId} onStatusChange={handleStatusChange} onAssignmentChange={handleAssignmentChange} onExecute={handleExecute} /></section></div>}

        {section === "Activity" && <section className="panel page-panel"><div className="panel-heading"><div><h2>Activity log</h2><p>Task actions recorded by the backend, newest first.</p></div><span className="count-chip">{loading ? "…" : `${activity.length} events`}</span></div><ActivityList entries={activity} loading={loading} error={Boolean(refreshError) && stats === null} /></section>}
        <footer className="page-footer"><span><span className="footer-dot" /> In-memory workspace data</span><span>Agent execution and external integrations are planned</span></footer>
      </div>
    </main>
  </div>;
}
