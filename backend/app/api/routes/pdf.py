"""PDF generation routes."""

from __future__ import annotations

import copy
import json
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.demo import demo_mode_forbidden
from app.core.database import get_session
from app.core.qr_defaults import (
    STANDARD_QR_BACKGROUND_COLOR,
    STANDARD_QR_ERROR_CORRECTION,
    STANDARD_QR_FOREGROUND_COLOR,
)
from app.models.entry import Entry
from app.models.project import Project
from app.schemas.pdf import ExportZipRequest, PDFGenerateRequest
from app.services.pdf_service import (
    QRPDFGenerator,
    generate_export_zip,
    list_project_pdfs,
    save_pdf,
)

router = APIRouter(tags=["pdf"])


def _enum_value(value: Any) -> Any:
    return value.value if hasattr(value, "value") else value


async def _get_project_entries(
    project_id: int,
    entry_ids: list[int] | None,
    session: AsyncSession,
) -> tuple[Project, list[dict[str, Any]]]:
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
        raise HTTPException(status_code=400, detail="No entries found for PDF generation")

    normalized_entries: list[dict[str, Any]] = []
    for e in entries:
        content_data = e.content_data
        if isinstance(content_data, str):
            content_data = json.loads(content_data)
        else:
            # Ensure downstream processing cannot mutate ORM-attached objects.
            content_data = copy.deepcopy(content_data)

        tags = e.tags
        if isinstance(tags, str):
            tags = json.loads(tags)
        else:
            tags = copy.deepcopy(tags)

        normalized_entries.append(
            {
                "id": e.id,
                "project_id": e.project_id,
                "content_type": _enum_value(e.content_type),
                "content_data": content_data,
                "label": e.label,
                "serial_number": e.serial_number,
                "status": _enum_value(e.status),
                "tags": tags,
                "qr_image_path": e.qr_image_path,
                "qr_status": _enum_value(e.qr_status),
                "qr_data_hash": e.qr_data_hash,
            }
        )
    return project, normalized_entries


@router.post("/projects/{project_id}/pdf")
async def generate_pdf(
    project_id: int,
    payload: PDFGenerateRequest,
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Generate a PDF for a project and return the file."""
    if settings.demo_mode:
        raise demo_mode_forbidden("PDF generation")
    project, entries = await _get_project_entries(project_id, payload.entry_ids, session)
    layout = payload.layout.model_dump()
    layout["fg_color"] = (
        payload.layout.fg_color
        or project.default_qr_foreground_color
        or STANDARD_QR_FOREGROUND_COLOR
    )
    layout["bg_color"] = (
        payload.layout.bg_color
        or project.default_qr_background_color
        or STANDARD_QR_BACKGROUND_COLOR
    )
    layout["error_correction"] = (
        payload.layout.error_correction
        or project.default_qr_error_correction
        or STANDARD_QR_ERROR_CORRECTION
    )
    layout["qr_render_mode"] = payload.qr_render_mode

    generator = QRPDFGenerator(layout)
    pdf_bytes, page_count = generator.generate_pdf(entries)
    save_pdf(project_id, pdf_bytes)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="project_{project_id}.pdf"'},
    )


@router.get("/projects/{project_id}/pdf/download")
async def download_pdf(
    project_id: int,
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    """Download the latest generated PDF for a project."""
    if settings.demo_mode:
        raise demo_mode_forbidden("PDF downloads")
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
    if settings.demo_mode:
        return []
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
    if settings.demo_mode:
        raise demo_mode_forbidden("PDF downloads")
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    expected_prefix = f"project_{project_id}_"
    if not file_name.startswith(expected_prefix) or not file_name.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid PDF file name")

    timestamp_part = file_name[len(expected_prefix) : -4]
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
    if settings.demo_mode:
        raise demo_mode_forbidden("PDF previews")
    project, entries = await _get_project_entries(project_id, payload.entry_ids, session)
    layout = payload.layout.model_dump()
    layout["fg_color"] = (
        payload.layout.fg_color
        or project.default_qr_foreground_color
        or STANDARD_QR_FOREGROUND_COLOR
    )
    layout["bg_color"] = (
        payload.layout.bg_color
        or project.default_qr_background_color
        or STANDARD_QR_BACKGROUND_COLOR
    )
    layout["error_correction"] = (
        payload.layout.error_correction
        or project.default_qr_error_correction
        or STANDARD_QR_ERROR_CORRECTION
    )
    layout["qr_render_mode"] = payload.qr_render_mode

    generator = QRPDFGenerator(layout)
    png_bytes = generator.generate_preview_png(entries)

    return Response(content=png_bytes, media_type="image/png")


@router.post("/projects/{project_id}/export")
async def export_zip(
    project_id: int,
    payload: ExportZipRequest,
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Export all QR codes for a project as a ZIP of PNG/SVG images."""
    project, entries = await _get_project_entries(project_id, payload.entry_ids, session)

    zip_bytes = generate_export_zip(
        project_id=project_id,
        entries=entries,
        fmt=payload.format,
        fg_color=payload.fg_color
        or project.default_qr_foreground_color
        or STANDARD_QR_FOREGROUND_COLOR,
        bg_color=payload.bg_color
        or project.default_qr_background_color
        or STANDARD_QR_BACKGROUND_COLOR,
        error_correction=payload.error_correction
        or project.default_qr_error_correction
        or STANDARD_QR_ERROR_CORRECTION,
        box_size=payload.box_size,
        border=payload.border,
    )

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="project_{project_id}_qrcodes.zip"'},
    )
