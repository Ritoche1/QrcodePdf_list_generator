"""QR code generation routes."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.models.entry import Entry
from app.schemas.qr import QRGenerateRequest, QRGenerateResponse, QRPreviewRequest
from app.services.qr_service import (
    build_qr_content,
    generate_qr_png,
    save_qr_image,
)

router = APIRouter(prefix="/qr", tags=["qr"])


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
        fg_color=payload.fg_color,
        bg_color=payload.bg_color,
        error_correction=payload.error_correction,
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
    entry = await session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    content_data = entry.content_data
    if isinstance(content_data, str):
        content_data = json.loads(content_data)

    try:
        content, warnings = build_qr_content(entry.content_type, content_data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    image_bytes, warnings = generate_qr_png(
        content,
        fg_color=payload.fg_color,
        bg_color=payload.bg_color,
        error_correction=payload.error_correction,
        box_size=payload.box_size,
        border=payload.border,
    )

    relative_path = save_qr_image(entry_id, image_bytes)
    entry.qr_image_path = relative_path
    entry.status = "generated"

    await session.flush()

    return QRGenerateResponse(
        entry_id=entry_id,
        qr_image_path=relative_path,
        message="QR code generated successfully",
    )
