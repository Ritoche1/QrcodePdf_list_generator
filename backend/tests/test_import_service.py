from __future__ import annotations

import asyncio
import json
import os
import pathlib

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.services.import_service import import_from_file

os.environ.setdefault("DATA_DIR", "/tmp/qrtest_import")
pathlib.Path("/tmp/qrtest_import").mkdir(exist_ok=True)


def test_import_from_file_infers_content_type_per_row_when_not_mapped():
    csv_content = """label,url,text,first_name,last_name,ssid,password,security
URL Row,https://example.com,,,,,,
Text Row,,Welcome message,,,,,
VCard Row,,,Alice,Martin,,,
WiFi Row,,,,,OfficeWiFi,secret,WPA2
Label Only,,,,,,,
,,,,,,,
"""
    mapping = {
        "label": "label",
        "url": "url",
        "text": "text",
        "first_name": "first_name",
        "last_name": "last_name",
        "ssid": "ssid",
        "password": "password",
        "security": "security",
    }

    entries = import_from_file(
        file_bytes=csv_content.encode("utf-8"),
        filename="rows.csv",
        column_mapping=mapping,
        content_type="url",
    )

    assert len(entries) == 5
    assert [entry["content_type"] for entry in entries] == ["url", "text", "vcard", "wifi", "text"]
    assert json.loads(entries[-1]["content_data"]) == {}


def test_import_from_file_content_type_column_mapping_overrides_detection():
    csv_content = """content_type,url,text,label
text,https://example.com,,Force Text
url,,Hello world,Force Url
invalid,https://fallback.test,,Fallback Detect
"""
    mapping = {
        "content_type": "content_type",
        "url": "url",
        "text": "text",
        "label": "label",
    }

    entries = import_from_file(
        file_bytes=csv_content.encode("utf-8"),
        filename="rows.csv",
        column_mapping=mapping,
        content_type="text",
    )

    assert [entry["content_type"] for entry in entries] == ["text", "url", "url"]


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
async def test_import_confirm_infers_per_row_types_when_content_type_not_mapped(client: AsyncClient):
    project = await client.post("/api/v1/projects", json={"name": "Import infer test"})
    assert project.status_code == 201
    project_id = project.json()["id"]

    csv_content = """label,url,text,first_name,last_name
URL Row,https://example.com,,,
Text Row,,Hello world,,
VCard Row,,,Alice,Martin
"""

    preview = await client.post(
        f"/api/v1/projects/{project_id}/import/preview",
        files={"file": ("rows.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert preview.status_code == 200

    confirm = await client.post(
        f"/api/v1/projects/{project_id}/import/confirm",
        json={
            "column_mapping": {
                "label": "label",
                "url": "url",
                "text": "text",
                "first_name": "first_name",
                "last_name": "last_name",
            },
            "content_type": "text",
        },
    )
    assert confirm.status_code == 200
    assert confirm.json()["imported"] == 3

    listed = await client.get(f"/api/v1/projects/{project_id}/entries")
    assert listed.status_code == 200
    items = listed.json()["items"]
    types_by_label = {item["label"]: item["content_type"] for item in items}

    assert types_by_label["URL Row"] == "url"
    assert types_by_label["Text Row"] == "text"
    assert types_by_label["VCard Row"] == "vcard"
