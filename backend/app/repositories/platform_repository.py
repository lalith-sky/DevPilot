from datetime import datetime, timezone
from threading import RLock
from uuid import uuid4

from app.models.platform import (
    ActivityLogResponse,
    AgentCreateRequest,
    AgentResponse,
    DashboardStats,
    TaskCreateRequest,
    TaskResponse,
    TaskStatus,
)


DEFAULT_AGENTS = (
    ("admin-agent", "Admin Agent", "Coordinates work, reviews outcomes, and gates risky operations.", ["coordination", "review", "approvals"]),
    ("code-engineer", "Code Engineer", "Implements scoped code changes with source-anchored workflows.", ["implementation", "refactoring", "code review"]),
    ("test-engineer", "Test Engineer", "Creates deterministic tests and validates behavior across the platform.", ["testing", "quality gates", "verification"]),
    ("bug-detective", "Bug Detective", "Investigates failures, diagnoses root causes, and documents fixes.", ["debugging", "diagnostics", "incident analysis"]),
    ("devops-engineer", "DevOps Engineer", "Owns deployment, CI/CD, and operational readiness workflows.", ["deployment", "CI/CD", "operations"]),
)


class InMemoryPlatformRepository:
    """Process-local store. Data resets whenever the API process restarts."""

    def __init__(self) -> None:
        now = datetime.now(timezone.utc)
        self._agents = [
            AgentResponse(
                id=agent_id,
                name=name,
                description=description,
                capabilities=capabilities,
                created_at=now,
            )
            for agent_id, name, description, capabilities in DEFAULT_AGENTS
        ]
        self._tasks: list[TaskResponse] = []
        self._activity: list[ActivityLogResponse] = []
        self._lock = RLock()

    def list_agents(self) -> list[AgentResponse]:
        with self._lock:
            return list(self._agents)

    def register_agent(self, payload: AgentCreateRequest) -> AgentResponse:
        agent = AgentResponse(
            id=str(uuid4()),
            name=payload.name,
            description=payload.description,
            capabilities=payload.capabilities,
            created_at=datetime.now(timezone.utc),
        )
        with self._lock:
            self._agents.append(agent)
        return agent

    def list_tasks(self) -> list[TaskResponse]:
        with self._lock:
            return list(reversed(self._tasks))

    def get_task(self, task_id: str) -> TaskResponse | None:
        with self._lock:
            return next((task for task in self._tasks if task.id == task_id), None)

    def create_task(self, payload: TaskCreateRequest) -> TaskResponse:
        now = datetime.now(timezone.utc)
        task = TaskResponse(
            id=str(uuid4()),
            title=payload.title,
            description=payload.description,
            status="queued",
            assigned_agent_id=None,
            assigned_agent_name=None,
            created_at=now,
            updated_at=now,
        )
        with self._lock:
            self._tasks.append(task)
            self._activity.append(ActivityLogResponse(
                id=str(uuid4()),
                action="task_created",
                message=f'Task "{task.title}" was created and queued. No agent execution was started.',
                task_id=task.id,
                created_at=now,
            ))
        return task

    def update_task_status(self, task_id: str, status: TaskStatus) -> TaskResponse | None:
        with self._lock:
            index = next((i for i, task in enumerate(self._tasks) if task.id == task_id), None)
            if index is None:
                return None
            previous = self._tasks[index]
            now = datetime.now(timezone.utc)
            updated = previous.model_copy(update={"status": status, "updated_at": now})
            self._tasks[index] = updated
            self._activity.append(ActivityLogResponse(
                id=str(uuid4()),
                action="task_status_updated",
                message=f'Task "{updated.title}" status changed from {previous.status.replace("_", " ")} to {status.replace("_", " ")}.',
                task_id=task_id,
                created_at=now,
            ))
            return updated

    def assign_task(self, task_id: str, agent_id: str | None) -> TaskResponse | None:
        with self._lock:
            index = next((i for i, task in enumerate(self._tasks) if task.id == task_id), None)
            if index is None:
                return None
            agent = next((candidate for candidate in self._agents if candidate.id == agent_id), None) if agent_id else None
            if agent_id and agent is None:
                raise ValueError("Agent not found.")
            previous = self._tasks[index]
            now = datetime.now(timezone.utc)
            updated = previous.model_copy(update={
                "assigned_agent_id": agent.id if agent else None,
                "assigned_agent_name": agent.name if agent else None,
                "updated_at": now,
            })
            self._tasks[index] = updated
            assignment = agent.name if agent else "Unassigned"
            self._activity.append(ActivityLogResponse(
                id=str(uuid4()),
                action="task_assigned",
                message=f'Task "{updated.title}" was assigned to {assignment}.',
                task_id=task_id,
                created_at=now,
            ))
            return updated

    def list_activity(self) -> list[ActivityLogResponse]:
        with self._lock:
            return list(reversed(self._activity))

    def get_dashboard_stats(self) -> DashboardStats:
        with self._lock:
            statuses = [task.status for task in self._tasks]
            return DashboardStats(
                agents_registered=len(self._agents),
                agents_connected=0,
                tasks_total=len(self._tasks),
                tasks_queued=statuses.count("queued"),
                tasks_in_progress=statuses.count("in_progress"),
                tasks_completed=statuses.count("completed"),
            )
