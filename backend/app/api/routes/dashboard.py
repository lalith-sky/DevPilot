from fastapi import APIRouter

from app.models.platform import DashboardStats
from app.services.platform import platform_service

router = APIRouter()


@router.get("/summary", response_model=DashboardStats)
def get_dashboard_summary() -> DashboardStats:
    return platform_service.get_dashboard_stats()
