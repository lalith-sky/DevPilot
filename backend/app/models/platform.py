from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


TaskStatus = Literal["queued", "in_progress", "completed", "cancelled"]
ExecutionStatus = Literal["pending", "running", "completed", "failed"]


class AgentResponse(BaseModel):
    id: str
    name: str
    description: str
    capabilities: list[str]
    status: Literal["registered"] = "registered"
    ai_enabled: Literal[False] = False
    created_at: datetime


class AgentCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=3, max_length=500)
    capabilities: list[str] = Field(min_length=1, max_length=12)

    @field_validator("name", "description")
    @classmethod
    def clean_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value must not be blank.")
        return value

    @field_validator("capabilities")
    @classmethod
    def clean_capabilities(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        if not cleaned:
            raise ValueError("At least one capability is required.")
        return cleaned


class TaskCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=2000)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Title must contain at least 3 non-whitespace characters.")
        return value

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str) -> str:
        return value.strip()


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskExecutionConfirmRequest(BaseModel):
    confirmed: bool


class TaskExecutionResponse(BaseModel):
    id: str
    task_id: str
    status: ExecutionStatus
    stdout: str
    stderr: str
    jsonl_events: int
    exit_code: int | None
    final_response: str | None
    started_at: datetime | None
    completed_at: datetime | None
    timeout_seconds: int
    error: str | None = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: str
    status: TaskStatus
    assigned_agent_id: str | None = None
    assigned_agent_name: str | None = None
    created_at: datetime
    updated_at: datetime


class ActivityLogResponse(BaseModel):
    id: str
    action: Literal["task_created", "task_assigned", "task_status_updated"]
    message: str
    task_id: str
    created_at: datetime


class DashboardStats(BaseModel):
    agents_registered: int
    agents_connected: int
    tasks_total: int
    tasks_queued: int
    tasks_in_progress: int
    tasks_completed: int
