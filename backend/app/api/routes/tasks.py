from fastapi import APIRouter, HTTPException, status

from app.models.platform import (
    TaskCreateRequest,
    TaskExecutionConfirmRequest,
    TaskExecutionResponse,
    TaskResponse,
    TaskStatusUpdate,
)
from app.services.codex_execution import ExecutionError, get_codex_execution_service
from app.services.platform import platform_service

router = APIRouter()


@router.get("", response_model=list[TaskResponse])
def list_tasks() -> list[TaskResponse]:
    return platform_service.list_tasks()


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreateRequest) -> TaskResponse:
    return platform_service.create_task(payload)


@router.get("/{task_id}/execution", response_model=TaskExecutionResponse | None)
def get_task_execution(task_id: str) -> TaskExecutionResponse | None:
    if platform_service.get_task(task_id) is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    return get_codex_execution_service(platform_service.repository).get_execution(task_id)


@router.post("/{task_id}/execute", response_model=TaskExecutionResponse, status_code=status.HTTP_202_ACCEPTED)
def execute_task(task_id: str, payload: TaskExecutionConfirmRequest) -> TaskExecutionResponse:
    try:
        return get_codex_execution_service(platform_service.repository).start_execution(task_id, payload.confirmed)
    except ExecutionError as error:
        message = str(error)
        code = status.HTTP_409_CONFLICT if "progress" in message else status.HTTP_400_BAD_REQUEST
        if message == "Task not found.":
            code = status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=code, detail=message) from error

@router.patch("/{task_id}/assignment", response_model=TaskResponse)
def assign_task(task_id: str, agent_id: str | None = None) -> TaskResponse:
    try:
        task = platform_service.assign_task(task_id, agent_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


@router.patch("/{task_id}/status", response_model=TaskResponse)
def update_task_status(task_id: str, payload: TaskStatusUpdate) -> TaskResponse:
    task = platform_service.update_task_status(task_id, payload.status)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task
