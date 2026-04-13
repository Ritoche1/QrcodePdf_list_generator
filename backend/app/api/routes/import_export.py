"""Import/export routes for CSV and XLSX files."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.models.entry import Entry
from app.models.project import Project
from app.services.export_service import export_entries_csv, export_entries_xlsx
from app.services.import_service import get_column_preview, import_from_file

router = APIRouter(tags=["import_export"])

# Simple in-memory cache for preview data (keyed by project_id)
# In production a proper cache/store would be used, but for simplicity we hold last preview
_preview_cache: dict[int, bytes] = {}
_preview_filename_cache: dict[int, str] = {}


class ImportConfirmRequest(BaseModel):
    column_mapping: dict[str, str]
    content_type: str = "text"


@router.post("/projects/{project_id}/import/preview")
async def import_preview(
    project_id: int,
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Upload a CSV or XLSX file and return a column preview with suggested mappings.
    Does not import any data.
    """
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    allowed_extensions = {".csv", ".xlsx", ".xls"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Cache raw bytes for confirm step
    _preview_cache[project_id] = file_bytes
    _preview_filename_cache[project_id] = file.filename

    try:
        preview = get_column_preview(file_bytes, file.filename)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse file: {e}")

    return {
        "project_id": project_id,
        "filename": file.filename,
        **preview,
    }


@router.post("/projects/{project_id}/import/confirm")
async def import_confirm(
    project_id: int,
    payload: ImportConfirmRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Confirm the column mapping and import data from the previously uploaded file.
    """
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project_id not in _preview_cache:
        raise HTTPException(
            status_code=400,
            detail="No preview data found. Upload the file first via /import/preview",
        )

    file_bytes = _preview_cache[project_id]
    filename = _preview_filename_cache[project_id]

    try:
        entry_dicts = import_from_file(
            file_bytes=file_bytes,
            filename=filename,
            column_mapping=payload.column_mapping,
            content_type=payload.content_type,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Import failed: {e}")

    if not entry_dicts:
        raise HTTPException(status_code=400, detail="No valid rows found to import")

    # Insert entries
    entries = []
    for ed in entry_dicts:
        entry = Entry(
            project_id=project_id,
            content_type=ed.get("content_type", "text"),
            content_data=ed.get("content_data", "{}"),
            label=ed.get("label"),
            status=ed.get("status", "draft"),
            tags=ed.get("tags", "[]"),
            serial_number=ed.get("serial_number"),
        )
        session.add(entry)
        entries.append(entry)

    await session.flush()

    # Clean up cache
    _preview_cache.pop(project_id, None)
    _preview_filename_cache.pop(project_id, None)

    return {
        "imported": len(entries),
        "project_id": project_id,
        "message": f"Successfully imported {len(entries)} entries",
    }


@router.get("/projects/{project_id}/export/data")
async def export_data(
    project_id: int,
    format: str = Query("csv", description="Export format: csv or xlsx"),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Export project entries as CSV or XLSX."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await session.execute(
        select(Entry).where(Entry.project_id == project_id).order_by(Entry.created_at)
    )
    entries = result.scalars().all()

    entry_dicts = [
        {
            "id": e.id,
            "project_id": e.project_id,
            "content_type": e.content_type,
            "content_data": e.content_data,
            "label": e.label,
            "status": e.status,
            "serial_number": e.serial_number,
            "tags": e.tags,
            "created_at": str(e.created_at),
            "updated_at": str(e.updated_at),
        }
        for e in entries
    ]

    if format.lower() == "xlsx":
        data = export_entries_xlsx(entry_dicts)
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="project_{project_id}_entries.xlsx"'
            },
        )
    else:
        data = export_entries_csv(entry_dicts)
        return Response(
            content=data,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="project_{project_id}_entries.csv"'
            },
        )
