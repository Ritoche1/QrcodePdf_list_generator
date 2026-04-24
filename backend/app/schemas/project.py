from datetime import datetime

from pydantic import BaseModel, Field

from app.core.qr_defaults import (
    STANDARD_QR_BACKGROUND_COLOR,
    STANDARD_QR_ERROR_CORRECTION,
    STANDARD_QR_FOREGROUND_COLOR,
)


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: str | None = Field(None, description="Optional project description")
    default_qr_foreground_color: str = Field(
        STANDARD_QR_FOREGROUND_COLOR,
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Default QR foreground color (hex)",
    )
    default_qr_background_color: str = Field(
        STANDARD_QR_BACKGROUND_COLOR,
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Default QR background color (hex)",
    )
    default_qr_error_correction: str = Field(
        STANDARD_QR_ERROR_CORRECTION,
        pattern=r"^[LMQH]$",
        description="Default QR error correction level",
    )


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    default_qr_foreground_color: str | None = Field(
        None,
        pattern=r"^#[0-9A-Fa-f]{6}$",
    )
    default_qr_background_color: str | None = Field(
        None,
        pattern=r"^#[0-9A-Fa-f]{6}$",
    )
    default_qr_error_correction: str | None = Field(
        None,
        pattern=r"^[LMQH]$",
    )


class ProjectResponse(ProjectBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
    updated_at: datetime


class ProjectWithCount(ProjectResponse):
    entry_count: int = 0
    generated_count: int = 0
    printed_count: int = 0


class ProjectList(BaseModel):
    items: list[ProjectResponse]
    total: int
