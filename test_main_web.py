import tempfile
import time
from pathlib import Path

import pytest

from main import JOBS, UPLOADS, UPLOADS_LOCK, app


@pytest.fixture(autouse=True)
def reset_global_state():
    with UPLOADS_LOCK:
        UPLOADS.clear()
    JOBS.clear()
    yield
    with UPLOADS_LOCK:
        UPLOADS.clear()
    JOBS.clear()


def test_manual_add_and_update_entries():
    app.config["TESTING"] = True
    with app.test_client() as client:
        with client.session_transaction() as flask_session:
            flask_session["entries"] = [{"name": "Imported Row", "url": "https://imported.test"}]

        response = client.post(
            "/entries/add",
            data={"name": "Manual Row", "url": "https://manual.test"},
            follow_redirects=True,
        )
        assert response.status_code == 200
        page = response.get_data(as_text=True)
        assert "Imported Row" in page
        assert "Manual Row" in page

        response = client.post(
            "/entries/update",
            data={
                "count": "2",
                "name_0": "Edited Imported Row",
                "url_0": "https://edited-imported.test",
                "name_1": "Manual Row",
                "url_1": "https://manual.test",
                "delete_1": "on",
            },
            follow_redirects=True,
        )
        assert response.status_code == 200
        page = response.get_data(as_text=True)
        assert "Edited Imported Row" in page
        assert "Manual Row" not in page


def test_update_entries_rejects_incomplete_rows():
    app.config["TESTING"] = True
    with app.test_client() as client:
        with client.session_transaction() as flask_session:
            flask_session["entries"] = [{"name": "Row One", "url": "https://one.test"}]

        response = client.post(
            "/entries/update",
            data={
                "count": "1",
                "name_0": "Row One",
                "url_0": "",
            },
            follow_redirects=True,
        )
        assert response.status_code == 200
        page = response.get_data(as_text=True)
        assert "Each entry must include both name and URL." in page


def test_start_job_imports_uploaded_rows_into_session_entries():
    app.config["TESTING"] = True
    with tempfile.TemporaryDirectory() as upload_dir:
        file_path = Path(upload_dir) / "rows.csv"
        file_path.write_text("name,url\nImported Row,https://imported.test\n", encoding="utf-8")
        upload_id = "upload-test-id"
        with UPLOADS_LOCK:
            UPLOADS[upload_id] = {
                "file_path": str(file_path),
                "filename": "rows.csv",
                "upload_dir": upload_dir,
                "created_at": time.time(),
            }

        with app.test_client() as client:
            response = client.post(
                "/start-job",
                data={"upload_id": upload_id, "label_column": "name", "url_column": "url"},
                follow_redirects=True,
            )
            assert response.status_code == 200
            page = response.get_data(as_text=True)
            assert "Imported 1 entries." in page
            assert "Imported Row" in page


def test_generate_entries_requires_at_least_one_valid_row():
    app.config["TESTING"] = True
    with app.test_client() as client:
        with client.session_transaction() as flask_session:
            flask_session["entries"] = [{"name": "", "url": "https://invalid.test"}]

        response = client.post("/entries/generate", follow_redirects=True)
        assert response.status_code == 200
        assert "Add at least one entry before generating." in response.get_data(as_text=True)
