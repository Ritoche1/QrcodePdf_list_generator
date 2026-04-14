"""PDF generation service using fpdf2."""
from __future__ import annotations

import io
import json
import math
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fpdf import FPDF
from PIL import Image

from app.core.config import settings
from app.core.qr_defaults import (
    STANDARD_QR_BACKGROUND_COLOR,
    STANDARD_QR_ERROR_CORRECTION,
    STANDARD_QR_FOREGROUND_COLOR,
)
from app.services.qr_service import build_qr_content, compute_qr_data_hash, generate_qr_png, load_qr_image

# A4 and Letter dimensions in mm
PAGE_SIZES = {
    "A4": (210, 297),
    "Letter": (215.9, 279.4),
}


def mm_to_pt(mm: float) -> float:
    return mm * 2.834645669


def _parse_hex_color(hex_color: str) -> tuple[int, int, int]:
    """Convert #RRGGBB to (R, G, B) tuple."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return r, g, b


class QRPDFGenerator:
    def __init__(self, layout: dict[str, Any]):
        self.layout = layout
        self.page_size = layout.get("page_size", "A4")
        self.orientation = layout.get("orientation", "portrait")
        self.margin_mm = float(layout.get("margin_mm", 10))
        self.columns = int(layout.get("columns", 3))
        self.rows = int(layout.get("rows", 4))
        self.qr_size_mm = float(layout.get("qr_size_mm", 50))
        self.spacing_mm = float(layout.get("spacing_mm", 5))
        self.show_labels = bool(layout.get("show_labels", True))
        self.show_serial = bool(layout.get("show_serial", False))
        self.label_font_size = float(layout.get("label_font_size", 8))
        self.fg_color = layout.get("fg_color", STANDARD_QR_FOREGROUND_COLOR)
        self.bg_color = layout.get("bg_color", STANDARD_QR_BACKGROUND_COLOR)
        self.error_correction = layout.get("error_correction", STANDARD_QR_ERROR_CORRECTION)

        # Determine page dimensions
        w, h = PAGE_SIZES.get(self.page_size, PAGE_SIZES["A4"])
        if self.orientation == "landscape":
            w, h = h, w
        self.page_width_mm = w
        self.page_height_mm = h

    def _generate_entry_qr_bytes(self, entry: dict[str, Any]) -> bytes:
        """Generate QR PNG bytes for a single entry dict."""
        content_type = entry.get("content_type", "text")
        content_data = entry.get("content_data", {})
        if isinstance(content_data, str):
            content_data = json.loads(content_data)

        cached_bytes = load_qr_image(entry.get("qr_image_path"))
        if cached_bytes is not None and entry.get("qr_status") == "generated":
            current_hash = compute_qr_data_hash(content_type, content_data)
            if entry.get("qr_data_hash") == current_hash:
                return cached_bytes

        content, _ = build_qr_content(content_type, content_data)
        image_bytes, _ = generate_qr_png(
            content,
            fg_color=self.fg_color,
            bg_color=self.bg_color,
            error_correction=self.error_correction,
            box_size=10,
            border=4,
        )
        return image_bytes

    def generate_pdf(self, entries: list[dict[str, Any]]) -> tuple[bytes, int]:
        """
        Generate a PDF from a list of entry dicts.
        Returns (pdf_bytes, page_count).
        """
        pdf = FPDF(orientation=self.orientation[0].upper(), unit="mm", format=self.page_size)
        pdf.set_margins(self.margin_mm, self.margin_mm, self.margin_mm)
        pdf.set_auto_page_break(auto=False)

        # Use built-in font
        pdf.set_font("Helvetica", size=self.label_font_size)

        # Calculate cell dimensions
        label_height = (self.label_font_size * 0.352778 + 2) if self.show_labels else 0
        serial_height = (self.label_font_size * 0.352778 + 2) if self.show_serial else 0
        cell_height_mm = self.qr_size_mm + label_height + serial_height

        items_per_page = self.columns * self.rows
        page_count = 0

        usable_width = self.page_width_mm - 2 * self.margin_mm
        usable_height = self.page_height_mm - 2 * self.margin_mm

        # Calculate actual cell width (with spacing)
        cell_width_mm = (usable_width - (self.columns - 1) * self.spacing_mm) / self.columns

        for idx, entry in enumerate(entries):
            page_idx = idx // items_per_page
            item_idx = idx % items_per_page
            col = item_idx % self.columns
            row = item_idx // self.columns

            if item_idx == 0:
                pdf.add_page()
                page_count += 1

            x = self.margin_mm + col * (cell_width_mm + self.spacing_mm)
            y = self.margin_mm + row * (cell_height_mm + self.spacing_mm)

            # Generate QR image
            try:
                qr_bytes = self._generate_entry_qr_bytes(entry)
                # Write QR image to temp file-like object
                qr_buf = io.BytesIO(qr_bytes)
                qr_buf.seek(0)
                # fpdf2 accepts file-like objects via BytesIO name trick
                import tempfile, os
                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                    tmp.write(qr_bytes)
                    tmp_path = tmp.name

                pdf.image(tmp_path, x=x, y=y, w=self.qr_size_mm, h=self.qr_size_mm)
                os.unlink(tmp_path)
            except Exception as e:
                # Draw a placeholder box on error
                pdf.set_draw_color(200, 200, 200)
                pdf.rect(x, y, self.qr_size_mm, self.qr_size_mm)
                pdf.set_font("Helvetica", size=6)
                pdf.set_xy(x, y + self.qr_size_mm / 2 - 2)
                pdf.cell(self.qr_size_mm, 4, "QR Error", align="C")
                pdf.set_font("Helvetica", size=self.label_font_size)

            current_y = y + self.qr_size_mm

            if self.show_labels:
                label = entry.get("label") or ""
                pdf.set_font("Helvetica", size=self.label_font_size)
                r, g, b = _parse_hex_color(self.fg_color)
                pdf.set_text_color(r, g, b)
                pdf.set_xy(x, current_y)
                pdf.cell(cell_width_mm, label_height, label[:60], align="C")
                current_y += label_height

            if self.show_serial:
                serial = entry.get("serial_number") or ""
                pdf.set_font("Helvetica", "I", size=max(self.label_font_size - 1, 4))
                pdf.set_xy(x, current_y)
                pdf.cell(cell_width_mm, serial_height, serial[:40], align="C")
                pdf.set_font("Helvetica", size=self.label_font_size)

        return bytes(pdf.output()), page_count

    def generate_preview_png(self, entries: list[dict[str, Any]]) -> bytes:
        """
        Generate only the first page of the PDF as a PNG image.
        Returns PNG bytes.
        """
        # Limit to first page worth of entries
        items_per_page = self.columns * self.rows
        first_page_entries = entries[:items_per_page]
        pdf_bytes, _ = self.generate_pdf(first_page_entries)

        # Convert first page to PNG using pdf2image / fallback to pillow
        try:
            from pdf2image import convert_from_bytes
            images = convert_from_bytes(pdf_bytes, first_page=1, last_page=1, dpi=150)
            if images:
                buf = io.BytesIO()
                images[0].save(buf, format="PNG")
                return buf.getvalue()
        except ImportError:
            pass

        # Fallback: return PDF bytes wrapped — caller should handle gracefully
        # Create a simple white image with text
        img = Image.new("RGB", (800, 1100), color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()


def save_pdf(project_id: int, pdf_bytes: bytes) -> str:
    """Save generated PDF and return relative path of the versioned file."""
    pdf_dir = settings.files_dir / "pdf"
    pdf_dir.mkdir(parents=True, exist_ok=True)
    # Timestamp format: YYYYMMDDTHHMMSSffffffZ (UTC), used by the download validator.
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    versioned_filename = f"project_{project_id}_{timestamp}.pdf"
    versioned_path = pdf_dir / versioned_filename
    versioned_path.write_bytes(pdf_bytes)

    latest_filename = f"project_{project_id}.pdf"
    latest_path = pdf_dir / latest_filename
    latest_path.write_bytes(pdf_bytes)
    return f"pdf/{versioned_filename}"


def list_project_pdfs(project_id: int) -> list[dict[str, Any]]:
    """List versioned generated PDFs for a project, newest first."""
    pdf_dir = settings.files_dir / "pdf"
    if not pdf_dir.exists():
        return []

    pattern = f"project_{project_id}_*.pdf"
    files = sorted(pdf_dir.glob(pattern), key=lambda f: f.stat().st_mtime, reverse=True)
    items: list[dict[str, Any]] = []
    for file_path in files:
        stat = file_path.stat()
        items.append(
            {
                "file_name": file_path.name,
                "size_bytes": stat.st_size,
                "created_at": datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat(),
            }
        )
    return items


def generate_export_zip(
    project_id: int,
    entries: list[dict[str, Any]],
    fmt: str = "png",
    fg_color: str = STANDARD_QR_FOREGROUND_COLOR,
    bg_color: str = STANDARD_QR_BACKGROUND_COLOR,
    error_correction: str = STANDARD_QR_ERROR_CORRECTION,
    box_size: int = 10,
    border: int = 4,
) -> bytes:
    """
    Generate a ZIP file containing individual QR images for all entries.
    Returns ZIP bytes.
    """
    buf = io.BytesIO()

    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for entry in entries:
            content_type = entry.get("content_type", "text")
            content_data = entry.get("content_data", {})
            if isinstance(content_data, str):
                content_data = json.loads(content_data)

            try:
                content, _ = build_qr_content(content_type, content_data)
                current_hash = compute_qr_data_hash(content_type, content_data)
                if (
                    entry.get("qr_status") == "generated"
                    and entry.get("qr_data_hash") == current_hash
                ):
                    cached_bytes = load_qr_image(entry.get("qr_image_path"))
                    if cached_bytes is not None:
                        image_bytes = cached_bytes
                    else:
                        image_bytes, _ = generate_qr_png(
                            content,
                            fg_color=fg_color,
                            bg_color=bg_color,
                            error_correction=error_correction,
                            box_size=box_size,
                            border=border,
                        )
                else:
                    image_bytes, _ = generate_qr_png(
                        content,
                        fg_color=fg_color,
                        bg_color=bg_color,
                        error_correction=error_correction,
                        box_size=box_size,
                        border=border,
                    )
                entry_id = entry.get("id", "unknown")
                label = entry.get("label") or f"entry_{entry_id}"
                # Sanitize filename and include ID to avoid duplicates
                safe_label = "".join(c if c.isalnum() or c in " -_" else "_" for c in label)
                filename = f"{entry_id}_{safe_label[:50]}.{fmt}"
                zf.writestr(filename, image_bytes)
            except Exception:
                pass

    return buf.getvalue()
