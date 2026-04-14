"""QR code generation service using the qrcode and Pillow libraries."""
from __future__ import annotations

import io
import json
import re
from hmac import new as hmac_new
from pathlib import Path
from typing import Any

import qrcode
from PIL import Image
from qrcode.constants import ERROR_CORRECT_H, ERROR_CORRECT_L, ERROR_CORRECT_M, ERROR_CORRECT_Q

from app.core.config import settings

ERROR_CORRECTION_MAP = {
    "L": ERROR_CORRECT_L,
    "M": ERROR_CORRECT_M,
    "Q": ERROR_CORRECT_Q,
    "H": ERROR_CORRECT_H,
}

# Warn when encoded content exceeds this byte limit for the given error level
CONTENT_LENGTH_WARN_THRESHOLDS = {
    "L": 7089,
    "M": 5596,
    "Q": 3993,
    "H": 2953,
}


def build_qr_content(content_type: str, content_data: dict[str, Any]) -> tuple[str, list[str]]:
    """
    Build the raw QR string from content_type + content_data.
    Returns (qr_string, warnings).
    """
    warnings: list[str] = []

    if content_type == "url":
        url = content_data.get("url", "")
        if not _is_valid_url(url):
            warnings.append(f"URL may not be valid: {url!r}")
        return url, warnings

    elif content_type == "text":
        text = content_data.get("text", "")
        return text, warnings

    elif content_type == "vcard":
        return _build_vcard(content_data), warnings

    elif content_type == "wifi":
        return _build_wifi(content_data), warnings

    else:
        raise ValueError(f"Unknown content_type: {content_type!r}")


def _is_valid_url(url: str) -> bool:
    pattern = re.compile(
        r"^(https?|ftp)://"
        r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"
        r"localhost|"
        r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"
        r"(?::\d+)?"
        r"(?:/?|[/?]\S+)$",
        re.IGNORECASE,
    )
    return bool(pattern.match(url))


def _escape_vcard(value: str) -> str:
    """Escape special characters in vCard fields."""
    return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _build_vcard(data: dict[str, Any]) -> str:
    first = _escape_vcard(data.get("first_name", ""))
    last = _escape_vcard(data.get("last_name", ""))
    lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f"N:{last};{first};;;",
        f"FN:{first} {last}".strip(),
    ]
    if org := data.get("organization"):
        lines.append(f"ORG:{_escape_vcard(org)}")
    if title := data.get("title"):
        lines.append(f"TITLE:{_escape_vcard(title)}")
    if phone := data.get("phone"):
        lines.append(f"TEL;TYPE=CELL:{_escape_vcard(phone)}")
    if email := data.get("email"):
        lines.append(f"EMAIL:{_escape_vcard(email)}")
    if address := data.get("address"):
        lines.append(f"ADR;TYPE=HOME:;;{_escape_vcard(address)};;;;")
    if website := data.get("website"):
        lines.append(f"URL:{_escape_vcard(website)}")
    if note := data.get("note"):
        lines.append(f"NOTE:{_escape_vcard(note)}")
    lines.append("END:VCARD")
    return "\n".join(lines)


def _build_wifi(data: dict[str, Any]) -> str:
    ssid = data.get("ssid", "")
    password = data.get("password", "")
    security = data.get("security", "WPA").upper()
    hidden = "true" if data.get("hidden", False) else "false"

    def _escape_wifi(s: str) -> str:
        special = r'\;,":.'
        result = []
        for ch in s:
            if ch in special:
                result.append(f"\\{ch}")
            else:
                result.append(ch)
        return "".join(result)

    return f"WIFI:T:{security};S:{_escape_wifi(ssid)};P:{_escape_wifi(password)};H:{hidden};;"


def generate_qr_png(
    content: str,
    fg_color: str = "#000000",
    bg_color: str = "#ffffff",
    error_correction: str = "M",
    box_size: int = 10,
    border: int = 4,
) -> tuple[bytes, list[str]]:
    """
    Generate a QR code PNG and return (image_bytes, warnings).
    """
    warnings: list[str] = []

    ec = ERROR_CORRECTION_MAP.get(error_correction.upper(), ERROR_CORRECT_M)
    threshold = CONTENT_LENGTH_WARN_THRESHOLDS.get(error_correction.upper(), 2953)

    if len(content.encode("utf-8")) > threshold:
        warnings.append(
            f"Content is very long ({len(content)} chars). "
            f"The QR code may be difficult to scan."
        )

    qr = qrcode.QRCode(
        error_correction=ec,
        box_size=box_size,
        border=border,
    )
    qr.add_data(content)
    qr.make(fit=True)

    img: Image.Image = qr.make_image(fill_color=fg_color, back_color=bg_color).convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue(), warnings


def save_qr_image(entry_id: int, image_bytes: bytes) -> str:
    """
    Save QR image bytes to disk and return the relative path (relative to files_dir).
    """
    qr_dir = settings.files_dir / "qr"
    qr_dir.mkdir(parents=True, exist_ok=True)
    filename = f"entry_{entry_id}.png"
    file_path = qr_dir / filename
    file_path.write_bytes(image_bytes)
    return f"qr/{filename}"


def load_qr_image(relative_path: str | None) -> bytes | None:
    """Load QR image bytes from a relative file path if available."""
    if not relative_path:
        return None
    file_path = (settings.files_dir / relative_path).resolve()
    if not file_path.exists():
        return None
    qr_dir = (settings.files_dir / "qr").resolve()
    if file_path.parent != qr_dir:
        return None
    return file_path.read_bytes()


def compute_qr_data_hash(content_type: str, content_data: dict[str, Any]) -> str:
    """Build normalized QR payload and return deterministic content hash."""
    normalized_type = getattr(content_type, "value", content_type)
    content, _ = build_qr_content(str(normalized_type), content_data)
    return hmac_new(b"qr-cache-v1", content.encode("utf-8"), "sha256").hexdigest()


def check_duplicate_content(
    content: str,
    existing_contents: list[str],
) -> bool:
    """Return True if content already exists in existing_contents."""
    return content in existing_contents
