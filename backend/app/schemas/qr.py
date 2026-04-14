from typing import Any

from pydantic import BaseModel, Field

from app.core.qr_defaults import STANDARD_QR_ERROR_CORRECTION


class QRPreviewRequest(BaseModel):
    content_type: str = Field(..., description="Type: url, text, vcard, wifi")
    content_data: dict[str, Any] = Field(..., description="Content data dict")
    # Design options
    fg_color: str | None = Field(None, description="Foreground color (hex)")
    bg_color: str | None = Field(None, description="Background color (hex)")
    error_correction: str | None = Field(
        STANDARD_QR_ERROR_CORRECTION,
        description="Error correction level: L, M, Q, H",
        pattern="^[LMQH]$",
    )
    box_size: int = Field(10, ge=1, le=50, description="Size of each QR box in pixels")
    border: int = Field(4, ge=0, le=20, description="Border size in boxes")


class QRGenerateRequest(BaseModel):
    fg_color: str | None = Field(None, description="Foreground color (hex)")
    bg_color: str | None = Field(None, description="Background color (hex)")
    error_correction: str | None = Field(
        None,
        description="Error correction level: L, M, Q, H",
        pattern="^[LMQH]$",
    )
    box_size: int = Field(10, ge=1, le=50, description="Size of each QR box in pixels")
    border: int = Field(4, ge=0, le=20, description="Border size in boxes")


class QRGenerateResponse(BaseModel):
    entry_id: int
    qr_image_path: str
    message: str = "QR code generated successfully"
