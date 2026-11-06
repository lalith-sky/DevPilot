from fastapi import APIRouter

from app.api.routes.activity import router as activity_router
from app.api.routes.agents import router as agents_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.health import router as health_router
from app.api.routes.tasks import router as tasks_router

router = APIRouter()
router.include_router(health_router, tags=["health"])
router.include_router(agents_router, prefix="/agents", tags=["agents"])
router.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
router.include_router(activity_router, prefix="/activity", tags=["activity"])
router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
