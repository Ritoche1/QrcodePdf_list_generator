"""CSV/XLSX export service using pandas."""

from __future__ import annotations

import io
import json
from typing import Any

import pandas as pd


def _flatten_entry(entry: dict[str, Any]) -> dict[str, Any]:
    """Flatten an entry dict for export, expanding content_data fields."""
    content_data = entry.get("content_data", {})
    if isinstance(content_data, str):
        content_data = json.loads(content_data)

    tags = entry.get("tags", [])
    if isinstance(tags, str):
        tags = json.loads(tags)

    row = {
        "id": entry.get("id"),
        "project_id": entry.get("project_id"),
        "content_type": entry.get("content_type"),
        "label": entry.get("label"),
        "status": entry.get("status"),
        "serial_number": entry.get("serial_number"),
        "tags": ",".join(tags) if tags else "",
        "created_at": entry.get("created_at"),
        "updated_at": entry.get("updated_at"),
    }

    # Add all content_data fields as columns
    for key, value in content_data.items():
        row[f"content_{key}"] = value

    return row


def export_entries_csv(entries: list[dict[str, Any]]) -> bytes:
    """Export entries to CSV bytes."""
    rows = [_flatten_entry(e) for e in entries]
    df = pd.DataFrame(rows)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode("utf-8")


def export_entries_xlsx(entries: list[dict[str, Any]]) -> bytes:
    """Export entries to XLSX bytes."""
    rows = [_flatten_entry(e) for e in entries]
    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Entries")
    return buf.getvalue()
