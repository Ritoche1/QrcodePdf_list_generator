from main import app


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
