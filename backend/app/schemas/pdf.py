from typing import Literal

from pydantic import BaseModel, Field


class PDFLayoutOptions(BaseModel):
    page_size: str = Field("A4", description="Page size: A4 or Letter")
    orientation: str = Field("portrait", description="portrait or landscape")
    margin_mm: float = Field(10.0, ge=0, le=50, description="Page margin in mm")
    columns: int = Field(3, ge=1, le=20, description="Number of columns")
    rows: int = Field(4, ge=1, le=20, description="Number of rows per page")
    qr_size_mm: float = Field(50.0, ge=10, le=200, description="QR code size in mm")
    spacing_mm: float = Field(5.0, ge=0, le=30, description="Spacing between QR codes in mm")
    show_labels: bool = Field(True, description="Print label below QR code")
    show_serial: bool = Field(False, description="Print serial number below QR code")
    label_font_size: float = Field(8.0, ge=4, le=24, description="Label font size in pt")
    # QR design
    fg_color: str | None = Field(None, description="QR foreground color (hex)")
    bg_color: str | None = Field(None, description="QR background color (hex)")
    error_correction: str | None = Field(
        None,
        description="Error correction level: L, M, Q, H",
        pattern="^[LMQH]$",
    )


class PDFGenerateRequest(BaseModel):
    layout: PDFLayoutOptions = Field(default_factory=PDFLayoutOptions)
    qr_render_mode: Literal["single_design", "per_entry_cached"] = Field(
        "single_design",
        description=(
            "QR rendering mode: "
            "'single_design' applies one selected design to all entries; "
            "'per_entry_cached' uses each entry's cached QR image and falls back "
            "to the standard QR design when cache is missing/outdated."
        ),
    )
    entry_ids: list[int] | None = Field(
        None,
        description="Specific entry IDs to include; None means all entries",
    )


class PDFGenerateResponse(BaseModel):
    file_path: str
    page_count: int
    entry_count: int
    message: str = "PDF generated successfully"


class ExportZipRequest(BaseModel):
    entry_ids: list[int] | None = Field(
        None,
        description="Specific entry IDs to export; None means all",
    )
    format: str = Field("png", description="Image format: png or svg")
    fg_color: str | None = Field(None)
    bg_color: str | None = Field(None)
    error_correction: str | None = Field(None, pattern="^[LMQH]$")
    box_size: int = Field(10, ge=1, le=50)
    border: int = Field(4, ge=0, le=20)
