from fastapi import APIRouter, status

from app.models.platform import AgentCreateRequest, AgentResponse
from app.services.platform import platform_service

router = APIRouter()

@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def register_agent(payload: AgentCreateRequest) -> AgentResponse:
    return platform_service.register_agent(payload)

@router.get("", response_model=list[AgentResponse])
def list_agents() -> list[AgentResponse]:
    return platform_service.list_agents()
