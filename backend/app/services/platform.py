from app.models.platform import ActivityLogResponse, AgentCreateRequest, AgentResponse, DashboardStats, TaskCreateRequest, TaskResponse, TaskStatus
from app.repositories.platform_repository import InMemoryPlatformRepository


class PlatformService:
    def __init__(self, repository: InMemoryPlatformRepository | None = None) -> None:
        self._repository = repository or InMemoryPlatformRepository()

    def list_agents(self) -> list[AgentResponse]:
        return self._repository.list_agents()

    @property
    def repository(self) -> InMemoryPlatformRepository:
        return self._repository

    def register_agent(self, payload: AgentCreateRequest) -> AgentResponse:
        return self._repository.register_agent(payload)

    def list_tasks(self) -> list[TaskResponse]:
        return self._repository.list_tasks()

    def get_task(self, task_id: str) -> TaskResponse | None:
        return self._repository.get_task(task_id)

    def create_task(self, payload: TaskCreateRequest) -> TaskResponse:
        return self._repository.create_task(payload)

    def update_task_status(self, task_id: str, status: TaskStatus) -> TaskResponse | None:
        return self._repository.update_task_status(task_id, status)

    def assign_task(self, task_id: str, agent_id: str | None) -> TaskResponse | None:
        return self._repository.assign_task(task_id, agent_id)

    def list_activity(self) -> list[ActivityLogResponse]:
        return self._repository.list_activity()

    def get_dashboard_stats(self) -> DashboardStats:
        return self._repository.get_dashboard_stats()


platform_service = PlatformService()
