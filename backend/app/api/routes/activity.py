from fastapi import APIRouter

from app.models.platform import ActivityLogResponse
from app.services.platform import platform_service

router = APIRouter()


@router.get("", response_model=list[ActivityLogResponse])
def list_activity() -> list[ActivityLogResponse]:
    return platform_service.list_activity()
