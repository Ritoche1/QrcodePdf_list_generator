"""PDF generation routes."""
from __future__ import annotations

import json
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.models.entry import Entry
from app.models.project import Project
from app.schemas.pdf import ExportZipRequest, PDFGenerateRequest, PDFGenerateResponse
from app.services.pdf_service import (
    QRPDFGenerator,
    generate_export_zip,
    list_project_pdfs,
    save_pdf,
)

router = APIRouter(tags=["pdf"])


async def _get_project_entries(
    project_id: int,
    entry_ids: list[int] | None,
    session: AsyncSession,
) -> list[dict[str, Any]]:
    """Load entries from DB and convert to dicts for PDF service."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    stmt = select(Entry).where(Entry.project_id == project_id)
    if entry_ids:
        stmt = stmt.where(Entry.id.in_(entry_ids))
    stmt = stmt.order_by(Entry.created_at)

    result = await session.execute(stmt)
    entries = result.scalars().all()

    if not entries:
        raise HTTPException(
            status_code=400, detail="No entries found for PDF generation"
        )

    normalized_entries: list[dict[str, Any]] = []
    for e in entries:
        content_data = e.content_data
        if isinstance(content_data, str):
            content_data = json.loads(content_data)
        else:
            # Ensure downstream processing cannot mutate ORM-attached objects.
            content_data = json.loads(json.dumps(content_data))

        tags = e.tags
        if isinstance(tags, str):
            tags = json.loads(tags)
        else:
            tags = json.loads(json.dumps(tags))

        normalized_entries.append(
            {
                "id": e.id,
                "project_id": e.project_id,
                "content_type": e.content_type.value if hasattr(e.content_type, "value") else str(e.content_type),
                "content_data": content_data,
                "label": e.label,
                "serial_number": e.serial_number,
                "status": e.status.value if hasattr(e.status, "value") else str(e.status),
                "tags": tags,
            }
        )
    return normalized_entries


@router.post("/projects/{project_id}/pdf")
async def generate_pdf(
    project_id: int,
    payload: PDFGenerateRequest,
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Generate a PDF for a project and return the file."""
    entries = await _get_project_entries(project_id, payload.entry_ids, session)

    generator = QRPDFGenerator(payload.layout.model_dump())
    pdf_bytes, page_count = generator.generate_pdf(entries)
    save_pdf(project_id, pdf_bytes)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="project_{project_id}.pdf"'
        },
    )


@router.get("/projects/{project_id}/pdf/download")
async def download_pdf(
    project_id: int,
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    """Download the latest generated PDF for a project."""
    pdf_path = settings.files_dir / "pdf" / f"project_{project_id}.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF not yet generated for this project")
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"project_{project_id}.pdf",
    )


@router.get("/projects/{project_id}/pdfs")
async def list_pdfs(
    project_id: int,
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    """List all generated PDFs for a project."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return list_project_pdfs(project_id)


@router.get("/projects/{project_id}/pdfs/download")
async def download_project_pdf(
    project_id: int,
    file_name: str = Query(..., min_length=1),
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    """Download a specific generated PDF for a project."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    expected_prefix = f"project_{project_id}_"
    if not file_name.startswith(expected_prefix) or not file_name.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid PDF file name")

    timestamp_part = file_name[len(expected_prefix):-4]
    if not re.fullmatch(r"\d{8}T\d{12}Z", timestamp_part):
        raise HTTPException(status_code=400, detail="Invalid PDF file name")

    pdf_path = (settings.files_dir / "pdf" / file_name).resolve()
    allowed_dir = (settings.files_dir / "pdf").resolve()
    if pdf_path.parent != allowed_dir or not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")

    return FileResponse(path=str(pdf_path), media_type="application/pdf")


@router.post("/projects/{project_id}/pdf/preview")
async def pdf_preview(
    project_id: int,
    payload: PDFGenerateRequest,
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Generate the first-page preview PNG for a project PDF."""
    entries = await _get_project_entries(project_id, payload.entry_ids, session)

    generator = QRPDFGenerator(payload.layout.model_dump())
    png_bytes = generator.generate_preview_png(entries)

    return Response(content=png_bytes, media_type="image/png")


@router.post("/projects/{project_id}/export")
async def export_zip(
    project_id: int,
    payload: ExportZipRequest,
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Export all QR codes for a project as a ZIP of PNG/SVG images."""
    entries = await _get_project_entries(project_id, payload.entry_ids, session)

    zip_bytes = generate_export_zip(
        project_id=project_id,
        entries=entries,
        fmt=payload.format,
        fg_color=payload.fg_color,
        bg_color=payload.bg_color,
        error_correction=payload.error_correction,
        box_size=payload.box_size,
        border=payload.border,
    )

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="project_{project_id}_qrcodes.zip"'
        },
    )
