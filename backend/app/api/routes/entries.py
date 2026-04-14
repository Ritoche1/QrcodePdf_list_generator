"""Entry CRUD + search/filter routes."""
from __future__ import annotations

import json
import math
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, func, or_, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.models.entry import Entry, EntryStatus, QrGenerationStatus
from app.models.project import Project
from app.schemas.entry import (
    BulkStatusUpdate,
    BulkTagsUpdate,
    BulkDeleteRequest,
    EntryCreate,
    EntryListResponse,
    EntryResponse,
    EntryUpdate,
)
from app.services.qr_service import compute_qr_data_hash

router = APIRouter(tags=["entries"])


def _entry_to_response(entry: Entry) -> EntryResponse:
    content_data = entry.content_data
    if isinstance(content_data, str):
        content_data = json.loads(content_data)

    tags = entry.tags
    if isinstance(tags, str):
        tags = json.loads(tags)

    return EntryResponse(
        id=entry.id,
        project_id=entry.project_id,
        content_type=entry.content_type,
        content_data=content_data,
        label=entry.label,
        status=entry.status,
        tags=tags,
        serial_number=entry.serial_number,
        qr_image_path=entry.qr_image_path,
        qr_status=entry.qr_status,
        qr_data_hash=entry.qr_data_hash,
        qr_generated_at=entry.qr_generated_at,
        qr_error_message=entry.qr_error_message,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


async def _get_project_or_404(project_id: int, session: AsyncSession) -> Project:
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/projects/{project_id}/entries", response_model=EntryListResponse)
async def list_entries(
    project_id: int,
    search: str | None = Query(None, description="Full-text search on label and content_data"),
    status_filter: EntryStatus | None = Query(None, alias="status"),
    tags: list[str] = Query(default=[], description="Filter by tags (any match)"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", description="asc or desc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> EntryListResponse:
    """List entries with optional search, filter, sort, and pagination."""
    await _get_project_or_404(project_id, session)

    conditions = [Entry.project_id == project_id]

    if status_filter:
        conditions.append(Entry.status == status_filter)

    if search:
        search_term = f"%{search}%"
        conditions.append(
            or_(
                Entry.label.ilike(search_term),
                Entry.content_data.ilike(search_term),
            )
        )

    if tags:
        # Filter entries that contain any of the specified tags
        tag_conditions = []
        for tag in tags:
            tag_conditions.append(Entry.tags.like(f'%"{tag}"%'))
        conditions.append(or_(*tag_conditions))

    # Determine sort column
    sort_columns = {
        "created_at": Entry.created_at,
        "updated_at": Entry.updated_at,
        "label": Entry.label,
        "status": Entry.status,
        "content_type": Entry.content_type,
    }
    sort_col = sort_columns.get(sort_by, Entry.created_at)
    if sort_order == "asc":
        sort_col = sort_col.asc()
    else:
        sort_col = sort_col.desc()

    # Count total
    count_stmt = select(func.count()).where(and_(*conditions))
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    # Fetch page
    offset = (page - 1) * per_page
    stmt = select(Entry).where(and_(*conditions)).order_by(sort_col).offset(offset).limit(per_page)
    result = await session.execute(stmt)
    entries = result.scalars().all()

    pages = math.ceil(total / per_page) if total > 0 else 1

    return EntryListResponse(
        items=[_entry_to_response(e) for e in entries],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.post("/projects/{project_id}/entries", response_model=EntryResponse, status_code=201)
async def create_entry(
    project_id: int,
    payload: EntryCreate,
    session: AsyncSession = Depends(get_session),
) -> EntryResponse:
    """Create a single entry in a project."""
    await _get_project_or_404(project_id, session)

    entry = Entry(
        project_id=project_id,
        content_type=payload.content_type,
        content_data=json.dumps(payload.content_data),
        label=payload.label,
        status=payload.status,
        tags=json.dumps(payload.tags),
        serial_number=payload.serial_number,
        qr_status=QrGenerationStatus.not_generated,
    )
    session.add(entry)
    await session.flush()
    await session.refresh(entry)
    return _entry_to_response(entry)


@router.post("/projects/{project_id}/entries/bulk", response_model=list[EntryResponse], status_code=201)
async def create_entries_bulk(
    project_id: int,
    payload: list[EntryCreate],
    session: AsyncSession = Depends(get_session),
) -> list[EntryResponse]:
    """Create multiple entries at once."""
    await _get_project_or_404(project_id, session)

    if not payload:
        raise HTTPException(status_code=400, detail="Empty bulk payload")

    entries = []
    for item in payload:
        entry = Entry(
            project_id=project_id,
            content_type=item.content_type,
            content_data=json.dumps(item.content_data),
            label=item.label,
            status=item.status,
            tags=json.dumps(item.tags),
            serial_number=item.serial_number,
            qr_status=QrGenerationStatus.not_generated,
        )
        session.add(entry)
        entries.append(entry)

    await session.flush()
    for e in entries:
        await session.refresh(e)

    return [_entry_to_response(e) for e in entries]


@router.put("/entries/{entry_id}", response_model=EntryResponse)
async def update_entry(
    entry_id: int,
    payload: EntryUpdate,
    session: AsyncSession = Depends(get_session),
) -> EntryResponse:
    """Update an entry."""
    entry = await session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    content_changed = False
    current_content_type = getattr(entry.content_type, "value", entry.content_type)
    if payload.content_type is not None:
        payload_content_type = getattr(payload.content_type, "value", payload.content_type)
        if payload_content_type != current_content_type:
            entry.content_type = payload.content_type
            current_content_type = payload_content_type
            content_changed = True
    if payload.content_data is not None:
        entry.content_data = json.dumps(payload.content_data)
        content_changed = True
    if payload.label is not None:
        entry.label = payload.label
    if payload.status is not None:
        entry.status = payload.status
    if payload.tags is not None:
        entry.tags = json.dumps(payload.tags)
    if payload.serial_number is not None:
        entry.serial_number = payload.serial_number

    if content_changed:
        content_data = entry.content_data
        if isinstance(content_data, str):
            content_data = json.loads(content_data)
        current_hash = compute_qr_data_hash(str(current_content_type), content_data)

        if (
            entry.qr_image_path
            and entry.qr_status == QrGenerationStatus.generated
            and (not entry.qr_data_hash or entry.qr_data_hash != current_hash)
        ):
            entry.qr_status = QrGenerationStatus.outdated
        elif not entry.qr_image_path:
            entry.qr_status = QrGenerationStatus.not_generated
        entry.qr_error_message = None

    await session.flush()
    await session.refresh(entry)
    return _entry_to_response(entry)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Delete a single entry."""
    entry = await session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await session.delete(entry)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/entries/bulk-status", response_model=dict)
async def bulk_update_status(
    payload: BulkStatusUpdate,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Bulk update status for a list of entries."""
    stmt = (
        update(Entry)
        .where(Entry.id.in_(payload.entry_ids))
        .values(status=payload.status)
        .returning(Entry.id)
    )
    result = await session.execute(stmt)
    updated_ids = [row[0] for row in result.fetchall()]
    return {"updated": len(updated_ids), "ids": updated_ids}


@router.patch("/entries/bulk-tags", response_model=dict)
async def bulk_update_tags(
    payload: BulkTagsUpdate,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Bulk add or remove tags for a list of entries."""
    stmt = select(Entry).where(Entry.id.in_(payload.entry_ids))
    result = await session.execute(stmt)
    entries = result.scalars().all()

    updated_count = 0
    for entry in entries:
        current_tags: list[str] = json.loads(entry.tags) if entry.tags else []

        # Add tags
        for tag in payload.add_tags:
            if tag not in current_tags:
                current_tags.append(tag)

        # Remove tags
        current_tags = [t for t in current_tags if t not in payload.remove_tags]

        entry.tags = json.dumps(current_tags)
        updated_count += 1

    await session.flush()
    return {"updated": updated_count}


@router.post("/entries/bulk-delete", response_model=dict)
async def bulk_delete_entries(
    payload: BulkDeleteRequest,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Bulk delete a list of entries."""
    stmt = delete(Entry).where(Entry.id.in_(payload.entry_ids)).returning(Entry.id)
    result = await session.execute(stmt)
    deleted_ids = [row[0] for row in result.fetchall()]
    return {"deleted": len(deleted_ids), "ids": deleted_ids}
