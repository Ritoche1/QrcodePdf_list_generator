"""Project CRUD routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.demo import demo_mode_forbidden
from app.core.qr_defaults import (
    STANDARD_QR_BACKGROUND_COLOR,
    STANDARD_QR_ERROR_CORRECTION,
    STANDARD_QR_FOREGROUND_COLOR,
)
from app.models.entry import Entry, EntryStatus
from app.models.project import Project
from app.schemas.project import (
    ProjectCreate,
    ProjectList,
    ProjectResponse,
    ProjectUpdate,
    ProjectWithCount,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=ProjectList)
async def list_projects(
    session: AsyncSession = Depends(get_session),
) -> ProjectList:
    """List all projects with entry counts."""
    result = await session.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()

    items = []
    for p in projects:
        items.append(
            ProjectResponse(
                id=p.id,
                name=p.name,
                description=p.description,
                default_qr_foreground_color=p.default_qr_foreground_color,
                default_qr_background_color=p.default_qr_background_color,
                default_qr_error_correction=p.default_qr_error_correction,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )

    return ProjectList(items=items, total=len(items))


@router.post("", response_model=ProjectWithCount, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    session: AsyncSession = Depends(get_session),
) -> ProjectWithCount:
    """Create a new project."""
    if settings.demo_mode:
        raise demo_mode_forbidden("Project creation")
    project = Project(
        name=payload.name,
        description=payload.description,
        default_qr_foreground_color=payload.default_qr_foreground_color,
        default_qr_background_color=payload.default_qr_background_color,
        default_qr_error_correction=payload.default_qr_error_correction,
    )
    session.add(project)
    await session.flush()
    await session.refresh(project)

    return ProjectWithCount(
        id=project.id,
        name=project.name,
        description=project.description,
        default_qr_foreground_color=project.default_qr_foreground_color,
        default_qr_background_color=project.default_qr_background_color,
        default_qr_error_correction=project.default_qr_error_correction,
        created_at=project.created_at,
        updated_at=project.updated_at,
        entry_count=0,
        generated_count=0,
        printed_count=0,
    )


@router.get("/{project_id}", response_model=ProjectWithCount)
async def get_project(
    project_id: int,
    session: AsyncSession = Depends(get_session),
) -> ProjectWithCount:
    """Get a project with entry count statistics."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Count entries by status
    total_result = await session.execute(select(func.count()).where(Entry.project_id == project_id))
    entry_count = total_result.scalar_one()

    generated_result = await session.execute(
        select(func.count()).where(
            Entry.project_id == project_id,
            Entry.status == EntryStatus.generated,
        )
    )
    generated_count = generated_result.scalar_one()

    printed_result = await session.execute(
        select(func.count()).where(
            Entry.project_id == project_id,
            Entry.status == EntryStatus.printed,
        )
    )
    printed_count = printed_result.scalar_one()

    return ProjectWithCount(
        id=project.id,
        name=project.name,
        description=project.description,
        default_qr_foreground_color=project.default_qr_foreground_color,
        default_qr_background_color=project.default_qr_background_color,
        default_qr_error_correction=project.default_qr_error_correction,
        created_at=project.created_at,
        updated_at=project.updated_at,
        entry_count=entry_count,
        generated_count=generated_count,
        printed_count=printed_count,
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    session: AsyncSession = Depends(get_session),
) -> ProjectResponse:
    """Update a project's name or description."""
    if settings.demo_mode:
        raise demo_mode_forbidden("Project updates")
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.name is not None:
        project.name = payload.name
    if "description" in payload.model_fields_set:
        project.description = payload.description
    if "default_qr_foreground_color" in payload.model_fields_set:
        project.default_qr_foreground_color = (
            payload.default_qr_foreground_color or STANDARD_QR_FOREGROUND_COLOR
        )
    if "default_qr_background_color" in payload.model_fields_set:
        project.default_qr_background_color = (
            payload.default_qr_background_color or STANDARD_QR_BACKGROUND_COLOR
        )
    if "default_qr_error_correction" in payload.model_fields_set:
        project.default_qr_error_correction = (
            payload.default_qr_error_correction or STANDARD_QR_ERROR_CORRECTION
        )

    await session.flush()
    await session.refresh(project)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        default_qr_foreground_color=project.default_qr_foreground_color,
        default_qr_background_color=project.default_qr_background_color,
        default_qr_error_correction=project.default_qr_error_correction,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Delete a project and all its entries."""
    if settings.demo_mode:
        raise demo_mode_forbidden("Project deletion")
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await session.delete(project)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

