"""CSV/XLSX import service using pandas."""
from __future__ import annotations

import io
import json
from typing import Any

import pandas as pd


# Supported content types and their required fields
CONTENT_TYPE_FIELDS = {
    "url": ["url"],
    "text": ["text"],
    "vcard": ["first_name"],
    "wifi": ["ssid"],
}

CONTENT_TYPE_DETECTION_FIELDS: dict[str, set[str]] = {
    "url": {"url"},
    "text": {"text"},
    "vcard": {"first_name", "last_name", "organization", "title", "phone", "email", "address", "website", "note"},
    "wifi": {"ssid", "password", "security", "hidden"},
}
CONTENT_TYPE_PRIORITY = ("url", "vcard", "wifi", "text")

# Common column name aliases for auto-detection
COLUMN_ALIASES: dict[str, list[str]] = {
    "label": ["label", "name", "title", "description", "id", "identifier"],
    "url": ["url", "link", "href", "website", "web"],
    "text": ["text", "content", "data", "value", "message"],
    "serial_number": ["serial", "serial_number", "sn", "number", "no"],
    "tags": ["tags", "tag", "category", "categories", "group", "groups"],
    # vCard fields
    "first_name": ["first_name", "firstname", "first", "given_name", "given"],
    "last_name": ["last_name", "lastname", "last", "surname", "family_name"],
    "organization": ["organization", "org", "company", "employer"],
    "title": ["title", "job_title", "position", "role"],
    "phone": ["phone", "tel", "telephone", "mobile", "cell"],
    "email": ["email", "e-mail", "mail"],
    "address": ["address", "addr", "location"],
    "website": ["website", "web", "url", "homepage"] if False else [],
    # Wi-Fi fields
    "ssid": ["ssid", "network", "wifi_name", "network_name"],
    "password": ["password", "pass", "pwd", "wifi_password", "key"],
    "security": ["security", "security_type", "auth", "encryption"],
}


def _normalize_col(col: str) -> str:
    return col.strip().lower().replace(" ", "_").replace("-", "_")


def _read_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Read CSV or XLSX file into a DataFrame."""
    if filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls"):
        return pd.read_excel(io.BytesIO(file_bytes), dtype=str)
    else:
        # Try UTF-8 first, then latin-1
        try:
            return pd.read_csv(io.StringIO(file_bytes.decode("utf-8")), dtype=str)
        except UnicodeDecodeError:
            return pd.read_csv(io.StringIO(file_bytes.decode("latin-1")), dtype=str)


def _normalize_content_type(value: Any) -> str | None:
    """Normalize a content type string and return None if unsupported."""
    if value is None:
        return None
    normalized = str(value).strip().lower()
    return normalized if normalized in CONTENT_TYPE_FIELDS else None


def _infer_content_type(content_data: dict[str, Any], preferred_type: str | None = None) -> str:
    """Infer entry content type from populated fields, defaulting to text when unknown."""
    detected_types = [
        content_type
        for content_type, fields in CONTENT_TYPE_DETECTION_FIELDS.items()
        if any(str(content_data.get(field, "")).strip() for field in fields)
    ]

    if not detected_types:
        return "text"
    if len(detected_types) == 1:
        return detected_types[0]

    if preferred_type and preferred_type in detected_types:
        return preferred_type

    for content_type in CONTENT_TYPE_PRIORITY:
        if content_type in detected_types:
            return content_type

    return "text"


def get_column_preview(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """
    Parse the file and return a preview with column names, sample rows,
    and suggested column mappings.
    """
    df = _read_file(file_bytes, filename)
    df = df.fillna("")

    # Get column names and sample data
    columns = list(df.columns)
    sample_rows = df.head(5).to_dict(orient="records")

    # Auto-detect column mappings
    suggested_mapping: dict[str, str] = {}
    normalized_cols = {_normalize_col(c): c for c in columns}

    for field, aliases in COLUMN_ALIASES.items():
        if not aliases:
            continue
        for alias in aliases:
            if alias in normalized_cols:
                suggested_mapping[field] = normalized_cols[alias]
                break

    # Guess content type
    detected_content_type = "text"
    if "url" in suggested_mapping:
        detected_content_type = "url"
    elif "ssid" in suggested_mapping:
        detected_content_type = "wifi"
    elif "first_name" in suggested_mapping:
        detected_content_type = "vcard"

    return {
        "columns": columns,
        "row_count": len(df),
        "sample_rows": sample_rows,
        "suggested_mapping": suggested_mapping,
        "detected_content_type": detected_content_type,
    }


def import_from_file(
    file_bytes: bytes,
    filename: str,
    column_mapping: dict[str, str],
    content_type: str,
) -> list[dict[str, Any]]:
    """
    Parse the file and create entry dicts based on the confirmed column mapping.
    Returns a list of entry dicts ready for DB insertion.
    """
    df = _read_file(file_bytes, filename)
    df = df.fillna("")

    entries = []

    preferred_type = _normalize_content_type(content_type)

    # Fields that go into content_data vs top-level entry fields
    all_content_fields = set().union(*CONTENT_TYPE_DETECTION_FIELDS.values())

    for _, row in df.iterrows():
        content_data: dict[str, Any] = {}
        label: str | None = None
        serial_number: str | None = None
        tags: list[str] = []
        row_content_type: str | None = None

        for field, col_name in column_mapping.items():
            if col_name not in df.columns:
                continue
            value = str(row.get(col_name, "")).strip()

            if field == "label":
                label = value or None
            elif field == "serial_number":
                serial_number = value or None
            elif field == "tags":
                tags = [t.strip() for t in value.split(",") if t.strip()]
            elif field == "content_type":
                row_content_type = _normalize_content_type(value)
            elif field in all_content_fields:
                if value:
                    content_data[field] = value

        # Skip rows with no meaningful content
        if not content_data and not label:
            continue

        resolved_content_type = row_content_type or _infer_content_type(
            content_data,
            preferred_type=preferred_type,
        )

        entries.append({
            "content_type": resolved_content_type,
            "content_data": json.dumps(content_data),
            "label": label,
            "serial_number": serial_number,
            "tags": json.dumps(tags),
            "status": "draft",
        })

    return entries
