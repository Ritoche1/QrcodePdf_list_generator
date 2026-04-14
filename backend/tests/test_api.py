"""
Basic integration tests for the QR Code PDF Generator API.
Run with: pytest tests/ -v
"""
from __future__ import annotations

import asyncio
import os
import pathlib

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Point to temp data dir
os.environ.setdefault("DATA_DIR", "/tmp/qrtest_pytest")
pathlib.Path("/tmp/qrtest_pytest").mkdir(exist_ok=True)


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
    pid = r.json()["id"]

    # Read
    r = await client.get(f"/api/v1/projects/{pid}")
    assert r.status_code == 200
    assert r.json()["name"] == "Test"

    # Update
    r = await client.put(f"/api/v1/projects/{pid}", json={"name": "Updated"})
    assert r.status_code == 200
    assert r.json()["name"] == "Updated"

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
