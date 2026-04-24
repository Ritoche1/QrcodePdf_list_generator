from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models.entry import ContentType, EntryStatus, QrGenerationStatus


# Content data schemas for different QR types
class URLContent(BaseModel):
    url: str = Field(..., description="The URL to encode")


class TextContent(BaseModel):
    text: str = Field(..., description="Plain text to encode")


class VCardContent(BaseModel):
    first_name: str = Field(..., description="First name")
    last_name: str = Field("", description="Last name")
    organization: str | None = None
    title: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    website: str | None = None
    note: str | None = None


class WiFiContent(BaseModel):
    ssid: str = Field(..., description="Network SSID")
    password: str = Field("", description="Network password")
    security: str = Field("WPA", description="Security type: WPA, WEP, or nopass")
    hidden: bool = Field(False, description="Whether the network is hidden")


class EntryBase(BaseModel):
    content_type: ContentType = Field(..., description="Type of QR content")
    content_data: dict[str, Any] = Field(..., description="Content data as a dict")
    label: str | None = Field(None, max_length=500, description="Label printed below QR code")
    tags: list[str] = Field(default_factory=list, description="List of tags")
    serial_number: str | None = Field(None, max_length=100)


class EntryCreate(EntryBase):
    status: EntryStatus = Field(EntryStatus.draft, description="Entry status")


class EntryUpdate(BaseModel):
    content_type: ContentType | None = None
    content_data: dict[str, Any] | None = None
    label: str | None = None
    status: EntryStatus | None = None
    tags: list[str] | None = None
    serial_number: str | None = None


class EntryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    project_id: int
    content_type: ContentType
    content_data: dict[str, Any]
    label: str | None
    status: EntryStatus
    tags: list[str]
    serial_number: str | None
    qr_image_path: str | None
    qr_status: QrGenerationStatus
    qr_data_hash: str | None
    qr_generated_at: datetime | None
    qr_error_message: str | None
    created_at: datetime
    updated_at: datetime

    @field_validator("content_data", mode="before")
    @classmethod
    def parse_content_data(cls, v: Any) -> Any:
        if isinstance(v, str):
            import json

            return json.loads(v)
        return v

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v: Any) -> Any:
        if isinstance(v, str):
            import json

            return json.loads(v)
        return v


class EntryListResponse(BaseModel):
    items: list[EntryResponse]
    total: int
    page: int
    per_page: int
    pages: int


class BulkStatusUpdate(BaseModel):
    entry_ids: list[int] = Field(..., min_length=1)
    status: EntryStatus


class BulkTagsUpdate(BaseModel):
    entry_ids: list[int] = Field(..., min_length=1)
    add_tags: list[str] = Field(default_factory=list)
    remove_tags: list[str] = Field(default_factory=list)


class BulkDeleteRequest(BaseModel):
    entry_ids: list[int] = Field(..., min_length=1)
