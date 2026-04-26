"""QR code generation routes."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.demo import demo_mode_forbidden
from app.core.qr_defaults import (
    STANDARD_QR_BACKGROUND_COLOR,
    STANDARD_QR_ERROR_CORRECTION,
    STANDARD_QR_FOREGROUND_COLOR,
)
from app.models.entry import Entry, QrGenerationStatus
from app.models.project import Project
from app.schemas.qr import (
    QRBulkGenerateRequest,
    QRBulkGenerateResponse,
    QRGenerateRequest,
    QRGenerateResponse,
    QRPreviewRequest,
)
from app.services.qr_service import (
    build_qr_content,
    compute_qr_data_hash,
    generate_qr_png,
    load_qr_image,
    save_qr_image,
)

router = APIRouter(prefix="/qr", tags=["qr"])
logger = logging.getLogger(__name__)
DEFAULT_QR_BOX_SIZE = 10
DEFAULT_QR_BORDER = 4


@router.post("/preview")
async def qr_preview(payload: QRPreviewRequest) -> Response:
    """
    Generate a QR code preview PNG image and return it directly.
    Does not persist anything to the database.
    """
    try:
        content, warnings = build_qr_content(
            payload.content_type,
            payload.content_data,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    image_bytes, warnings = generate_qr_png(
        content,
        fg_color=payload.fg_color or STANDARD_QR_FOREGROUND_COLOR,
        bg_color=payload.bg_color or STANDARD_QR_BACKGROUND_COLOR,
        error_correction=payload.error_correction or STANDARD_QR_ERROR_CORRECTION,
        box_size=payload.box_size,
        border=payload.border,
    )

    headers = {}
    if warnings:
        headers["X-QR-Warnings"] = "; ".join(warnings)

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers=headers,
    )


@router.post("/generate/{entry_id}", response_model=QRGenerateResponse)
async def qr_generate(
    entry_id: int,
    payload: QRGenerateRequest,
    session: AsyncSession = Depends(get_session),
) -> QRGenerateResponse:
    """
    Generate and persist a QR code image for an existing entry.
    Updates the entry's qr_image_path and status to 'generated'.
    """
    if settings.demo_mode:
        raise demo_mode_forbidden("QR generation for project entries")
    entry = await session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    project = await session.get(Project, entry.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content_data = entry.content_data
    if isinstance(content_data, str):
        content_data = json.loads(content_data)

    normalized_content_type = getattr(entry.content_type, "value", entry.content_type)

    try:
        content, _ = build_qr_content(str(normalized_content_type), content_data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    data_hash = compute_qr_data_hash(str(normalized_content_type), content_data)
    has_design_overrides = (
        payload.fg_color is not None
        or payload.bg_color is not None
        or payload.error_correction is not None
        or payload.box_size != DEFAULT_QR_BOX_SIZE
        or payload.border != DEFAULT_QR_BORDER
    )
    if (
        not has_design_overrides
        and entry.qr_image_path
        and entry.qr_data_hash == data_hash
        and entry.qr_status == QrGenerationStatus.generated
        and load_qr_image(entry.qr_image_path) is not None
    ):
        return QRGenerateResponse(
            entry_id=entry_id,
            qr_image_path=entry.qr_image_path,
            qr_status=QrGenerationStatus.generated,
            qr_data_hash=data_hash,
            qr_generated_at=entry.qr_generated_at or entry.updated_at,
            regenerated=False,
            message="QR code reused from cache",
        )

    image_bytes, _ = generate_qr_png(
        content,
        fg_color=payload.fg_color or project.default_qr_foreground_color,
        bg_color=payload.bg_color or project.default_qr_background_color,
        error_correction=payload.error_correction or project.default_qr_error_correction,
        box_size=payload.box_size,
        border=payload.border,
    )

    try:
        relative_path = save_qr_image(entry_id, image_bytes)
        entry.qr_image_path = relative_path
        entry.qr_data_hash = data_hash
        entry.qr_generated_at = datetime.now(timezone.utc)
        entry.qr_status = QrGenerationStatus.generated
        entry.qr_error_message = None
        entry.status = "generated"
        await session.flush()
        return QRGenerateResponse(
            entry_id=entry_id,
            qr_image_path=relative_path,
            qr_status=QrGenerationStatus.generated,
            qr_data_hash=data_hash,
            qr_generated_at=entry.qr_generated_at,
            regenerated=True,
            message="QR code generated successfully",
        )
    except Exception as exc:
        entry.qr_status = QrGenerationStatus.error
        entry.qr_error_message = str(exc)[:500]
        await session.flush()
        logger.exception("Failed to generate QR code for entry_id=%s", entry_id)
        raise HTTPException(status_code=500, detail="Failed to generate QR code")


@router.post("/generate-bulk", response_model=QRBulkGenerateResponse)
async def qr_generate_bulk(
    payload: QRBulkGenerateRequest,
    session: AsyncSession = Depends(get_session),
) -> QRBulkGenerateResponse:
    if settings.demo_mode:
        raise demo_mode_forbidden("Bulk QR generation")
    stmt = select(Entry).where(Entry.id.in_(payload.entry_ids))
    result = await session.execute(stmt)
    entries = result.scalars().all()

    if not entries:
        raise HTTPException(status_code=404, detail="No entries found")

    generated = 0
    cached = 0
    errors = 0
    responses: list[QRGenerateResponse] = []

    for entry in entries:
        try:
            response = await qr_generate(
                entry.id,
                QRGenerateRequest(),
                session=session,
            )
            responses.append(response)
            if response.regenerated:
                generated += 1
            else:
                cached += 1
        except HTTPException:
            errors += 1

    return QRBulkGenerateResponse(
        processed=len(entries),
        generated=generated,
        cached=cached,
        errors=errors,
        results=responses,
    )

