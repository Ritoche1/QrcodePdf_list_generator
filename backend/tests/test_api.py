"""
Basic integration tests for the QR Code PDF Generator API.
Run with: pytest tests/ -v
"""
from __future__ import annotations

import asyncio
import io
import os
import pathlib
import shutil
import tempfile
import zipfile

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.qr_defaults import (
    STANDARD_QR_BACKGROUND_COLOR,
    STANDARD_QR_ERROR_CORRECTION,
    STANDARD_QR_FOREGROUND_COLOR,
)

# Point to an isolated temp data dir per test run
TEST_DATA_DIR = tempfile.mkdtemp(prefix="qrtest_pytest_")
os.environ.setdefault("DATA_DIR", TEST_DATA_DIR)
pathlib.Path(TEST_DATA_DIR).mkdir(exist_ok=True)


def teardown_module(module):
    shutil.rmtree(TEST_DATA_DIR, ignore_errors=True)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def client():
    from app.main import app

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_project_crud(client: AsyncClient):
    # Create
    r = await client.post("/api/v1/projects", json={"name": "Test", "description": "desc"})
    assert r.status_code == 201
    created = r.json()
    pid = created["id"]
    assert created["default_qr_foreground_color"] == STANDARD_QR_FOREGROUND_COLOR
    assert created["default_qr_background_color"] == STANDARD_QR_BACKGROUND_COLOR
    assert created["default_qr_error_correction"] == STANDARD_QR_ERROR_CORRECTION

    # Read
    r = await client.get(f"/api/v1/projects/{pid}")
    assert r.status_code == 200
    assert r.json()["name"] == "Test"

    # Update
    r = await client.put(
        f"/api/v1/projects/{pid}",
        json={
            "name": "Updated",
            "description": None,
            "default_qr_foreground_color": "#4338ca",
            "default_qr_background_color": "#eef2ff",
            "default_qr_error_correction": "Q",
        },
    )
    assert r.status_code == 200
    updated = r.json()
    assert updated["name"] == "Updated"
    assert updated["description"] is None
    assert updated["default_qr_foreground_color"] == "#4338ca"
    assert updated["default_qr_background_color"] == "#eef2ff"
    assert updated["default_qr_error_correction"] == "Q"

    # Reset defaults back to system fallback values
    r = await client.put(
        f"/api/v1/projects/{pid}",
        json={
            "default_qr_foreground_color": None,
            "default_qr_background_color": None,
            "default_qr_error_correction": None,
        },
    )
    assert r.status_code == 200
    reset = r.json()
    assert reset["default_qr_foreground_color"] == STANDARD_QR_FOREGROUND_COLOR
    assert reset["default_qr_background_color"] == STANDARD_QR_BACKGROUND_COLOR
    assert reset["default_qr_error_correction"] == STANDARD_QR_ERROR_CORRECTION

    # Delete
    r = await client.delete(f"/api/v1/projects/{pid}")
    assert r.status_code == 204

    # Confirm gone
    r = await client.get(f"/api/v1/projects/{pid}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_qr_preview_url(client: AsyncClient):
    r = await client.post(
        "/api/v1/qr/preview",
        json={
            "content_type": "url",
            "content_data": {"url": "https://example.com"},
        },
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert len(r.content) > 500


@pytest.mark.asyncio
async def test_entry_lifecycle(client: AsyncClient):
    # Create project
    r = await client.post("/api/v1/projects", json={"name": "Entry Test"})
    pid = r.json()["id"]

    # Create entry
    r = await client.post(
        f"/api/v1/projects/{pid}/entries",
        json={
            "content_type": "text",
            "content_data": {"text": "Hello"},
            "label": "My label",
            "tags": ["a", "b"],
        },
    )
    assert r.status_code == 201
    eid = r.json()["id"]

    # List
    r = await client.get(f"/api/v1/projects/{pid}/entries")
    assert r.json()["total"] == 1

    # Update
    r = await client.put(f"/api/v1/entries/{eid}", json={"label": "Updated label"})
    assert r.status_code == 200
    assert r.json()["label"] == "Updated label"

    # Delete project (cascades to entries)
    r = await client.delete(f"/api/v1/projects/{pid}")
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_stats(client: AsyncClient):
    r = await client.get("/api/v1/stats")
    assert r.status_code == 200
    data = r.json()
    assert "total_projects" in data
    assert "total_entries" in data
    assert "entries_by_status" in data


@pytest.mark.asyncio
async def test_project_pdf_history_listing_and_download(client: AsyncClient):
    # Create project + one entry
    r = await client.post("/api/v1/projects", json={"name": "PDF History Test"})
    assert r.status_code == 201
    pid = r.json()["id"]

    r = await client.post(
        f"/api/v1/projects/{pid}/entries",
        json={
            "content_type": "url",
            "content_data": {"url": "https://example.com"},
            "label": "History Row",
        },
    )
    assert r.status_code == 201

    payload = {
        "layout": {
            "page_size": "A4",
            "columns": 2,
            "rows": 2,
            "fg_color": "#ff0000",
            "bg_color": "#ffffff",
            "error_correction": "H",
        }
    }

    r = await client.post(f"/api/v1/projects/{pid}/pdf", json=payload)
    assert r.status_code == 200
    r = await client.post(f"/api/v1/projects/{pid}/pdf", json=payload)
    assert r.status_code == 200

    r = await client.get(f"/api/v1/projects/{pid}/pdfs")
    assert r.status_code == 200
    files = r.json()
    assert len(files) >= 2
    assert all(item["file_name"].startswith(f"project_{pid}_") for item in files)

    first_file_name = files[0]["file_name"]
    r = await client.get(
        f"/api/v1/projects/{pid}/pdfs/download",
        params={"file_name": first_file_name},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"


@pytest.mark.asyncio
async def test_pdf_generation_does_not_modify_entry_content_type(client: AsyncClient):
    r = await client.post("/api/v1/projects", json={"name": "PDF Side Effect Test"})
    assert r.status_code == 201
    pid = r.json()["id"]

    entry_payloads = [
        {
            "content_type": "url",
            "content_data": {"url": "https://example.com"},
            "label": "URL entry",
        },
        {
            "content_type": "text",
            "content_data": {"text": "Hello"},
            "label": "Text entry",
        },
    ]
    for payload in entry_payloads:
        created = await client.post(f"/api/v1/projects/{pid}/entries", json=payload)
        assert created.status_code == 201

    before = await client.get(f"/api/v1/projects/{pid}/entries")
    assert before.status_code == 200
    before_types = {item["id"]: item["content_type"] for item in before.json()["items"]}

    payload = {
        "layout": {
            "page_size": "A4",
            "columns": 2,
            "rows": 2,
        }
    }
    generated = await client.post(f"/api/v1/projects/{pid}/pdf", json=payload)
    assert generated.status_code == 200

    after = await client.get(f"/api/v1/projects/{pid}/entries")
    assert after.status_code == 200
    after_types = {item["id"]: item["content_type"] for item in after.json()["items"]}

    assert after_types == before_types


@pytest.mark.asyncio
async def test_qr_generate_uses_project_default_design_when_not_provided(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    project_payload = {
        "name": "QR Default Design Test",
        "default_qr_foreground_color": "#4338ca",
        "default_qr_background_color": "#f8fafc",
        "default_qr_error_correction": "H",
    }
    project_resp = await client.post("/api/v1/projects", json=project_payload)
    assert project_resp.status_code == 201
    pid = project_resp.json()["id"]

    entry_resp = await client.post(
        f"/api/v1/projects/{pid}/entries",
        json={
            "content_type": "text",
            "content_data": {"text": "Default design"},
        },
    )
    assert entry_resp.status_code == 201
    eid = entry_resp.json()["id"]

    captured: dict[str, str] = {}

    def fake_generate_qr_png(content: str, fg_color: str, bg_color: str, error_correction: str, box_size: int, border: int):
        captured["fg_color"] = fg_color
        captured["bg_color"] = bg_color
        captured["error_correction"] = error_correction
        return b"fake-png", []

    monkeypatch.setattr("app.api.routes.qr.generate_qr_png", fake_generate_qr_png)
    monkeypatch.setattr("app.api.routes.qr.save_qr_image", lambda _entry_id, _image_bytes: "qr/test.png")

    generated = await client.post(f"/api/v1/qr/generate/{eid}", json={})
    assert generated.status_code == 200
    assert captured == {
        "fg_color": "#4338ca",
        "bg_color": "#f8fafc",
        "error_correction": "H",
    }


@pytest.mark.asyncio
async def test_pdf_generation_uses_project_default_design_when_not_provided(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    project_payload = {
        "name": "PDF Default Design Test",
        "default_qr_foreground_color": "#0f172a",
        "default_qr_background_color": "#f1f5f9",
        "default_qr_error_correction": "Q",
    }
    project_resp = await client.post("/api/v1/projects", json=project_payload)
    assert project_resp.status_code == 201
    pid = project_resp.json()["id"]

    entry_resp = await client.post(
        f"/api/v1/projects/{pid}/entries",
        json={
            "content_type": "text",
            "content_data": {"text": "PDF default design"},
        },
    )
    assert entry_resp.status_code == 201

    captured_layout: dict[str, str] = {}

    class FakePDFGenerator:
        def __init__(self, layout):
            captured_layout.update(layout)

        def generate_pdf(self, _entries):
            return b"%PDF-1.4\n", 1

    monkeypatch.setattr("app.api.routes.pdf.QRPDFGenerator", FakePDFGenerator)
    monkeypatch.setattr("app.api.routes.pdf.save_pdf", lambda _project_id, _pdf_bytes: None)

    generated = await client.post(
        f"/api/v1/projects/{pid}/pdf",
        json={"layout": {"columns": 1, "rows": 1}},
    )
    assert generated.status_code == 200
    assert captured_layout["fg_color"] == "#0f172a"
    assert captured_layout["bg_color"] == "#f1f5f9"
    assert captured_layout["error_correction"] == "Q"


@pytest.mark.asyncio
async def test_export_zip_respects_selected_entry_ids(client: AsyncClient):
    project_resp = await client.post("/api/v1/projects", json={"name": "ZIP Selection Test"})
    assert project_resp.status_code == 201
    pid = project_resp.json()["id"]

    entry_ids: list[int] = []
    for label in ["one", "two"]:
        created = await client.post(
            f"/api/v1/projects/{pid}/entries",
            json={
                "content_type": "text",
                "content_data": {"text": f"value-{label}"},
                "label": label,
            },
        )
        assert created.status_code == 201
        entry_ids.append(created.json()["id"])

    export_resp = await client.post(
        f"/api/v1/projects/{pid}/export",
        json={
            "entry_ids": [entry_ids[0]],
            "format": "png",
        },
    )
    assert export_resp.status_code == 200
    assert export_resp.headers["content-type"] == "application/zip"

    with zipfile.ZipFile(io.BytesIO(export_resp.content)) as zf:
        names = zf.namelist()
        assert len(names) == 1
        assert names[0].startswith(f"{entry_ids[0]}_")
