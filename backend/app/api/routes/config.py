"""Application config routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.app import AppConfigResponse

router = APIRouter(tags=["config"])


@router.get("/config", response_model=AppConfigResponse)
async def get_app_config() -> AppConfigResponse:
    return AppConfigResponse(
        app_name=settings.app_name,
        app_version=settings.app_version,
        debug=settings.debug,
        demo_mode=settings.demo_mode,
    )