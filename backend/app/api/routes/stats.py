"""Stats/dashboard route."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.models.entry import Entry, EntryStatus
from app.models.project import Project

router = APIRouter(tags=["stats"])


@router.get("/stats")
async def get_stats(
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Return dashboard statistics."""
    # Total projects
    total_projects_result = await session.execute(select(func.count()).select_from(Project))
    total_projects = total_projects_result.scalar_one()

    # Total entries
    total_entries_result = await session.execute(select(func.count()).select_from(Entry))
    total_entries = total_entries_result.scalar_one()

    # Entries by status
    draft_result = await session.execute(
        select(func.count()).where(Entry.status == EntryStatus.draft)
    )
    draft_count = draft_result.scalar_one()

    generated_result = await session.execute(
        select(func.count()).where(Entry.status == EntryStatus.generated)
    )
    generated_count = generated_result.scalar_one()

    printed_result = await session.execute(
        select(func.count()).where(Entry.status == EntryStatus.printed)
    )
    printed_count = printed_result.scalar_one()

    archived_result = await session.execute(
        select(func.count()).where(Entry.status == EntryStatus.archived)
    )
    archived_count = archived_result.scalar_one()

    # Most recent project
    recent_project_result = await session.execute(
        select(Project).order_by(Project.created_at.desc()).limit(1)
    )
    recent_project = recent_project_result.scalar_one_or_none()

    return {
        "total_projects": total_projects,
        "total_entries": total_entries,
        "entries_by_status": {
            "draft": draft_count,
            "generated": generated_count,
            "printed": printed_count,
            "archived": archived_count,
        },
        "recent_project": {
            "id": recent_project.id,
            "name": recent_project.name,
            "created_at": recent_project.created_at.isoformat(),
        }
        if recent_project
        else None,
    }
