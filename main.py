#!/usr/bin/env python3

import argparse
import csv
import os
import pandas as pd
import shutil
import tempfile
import threading
import time
import uuid
import zipfile

import qrcode
from flask import Flask, jsonify, redirect, render_template_string, request, send_file, session, url_for
from fpdf import FPDF
from werkzeug.utils import secure_filename

CSV_FILE = "data.csv"
IMAGE_DIR = "image"
OUTPUT_PDF = "qr_codes.pdf"
REQUIRED_COLUMNS = {"name", "url"}
QR_SIZE_MM = 50
CELL_HEIGHT_MM = 60
GRID_MARGIN_X_MM = 10
GRID_MARGIN_Y_MM = 10
LABEL_OFFSET_X_MM = 16
LABEL_OFFSET_Y_MM = 55
ALLOWED_EXTENSIONS = {".csv", ".xlsx"}
TEMP_RETENTION_SECONDS = 1800

UPLOADS = {}
JOBS = {}
UPLOADS_LOCK = threading.Lock()
JOBS_LOCK = threading.Lock()


app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or os.urandom(32)


def create_qr_code(name, url, image_dir=IMAGE_DIR):
    """Create and save a QR code image from a name/url pair."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(os.path.join(image_dir, f"{name}.png"))


def validate_data(data):
    """Validate required columns before generating files."""
    if isinstance(data, pd.DataFrame):
        header_columns = set(data.columns)
    else:
        header_columns = set(data[0].keys()) if data else set()
    missing_columns = REQUIRED_COLUMNS - header_columns
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise ValueError(f"CSV is missing required column(s): {missing}")


def sanitize_file_name(value, fallback_index):
    """Create a filesystem-safe file name base."""
    base = secure_filename(str(value).strip()).replace(".", "_").strip("_")
    return base or f"qr_{fallback_index}"


def normalize_mapped_data(data, label_column, url_column):
    """Normalize mapped columns into expected name/url fields."""
    if label_column not in data.columns:
        raise ValueError(f"Label column not found: {label_column}")
    if url_column not in data.columns:
        raise ValueError(f"URL column not found: {url_column}")

    mapped = data[[label_column, url_column]].copy()
    mapped.columns = ["name", "url"]
    mapped = mapped.dropna(subset=["name", "url"])
    mapped["name"] = mapped["name"].astype(str).str.strip()
    mapped["url"] = mapped["url"].astype(str).str.strip()
    mapped = mapped[(mapped["name"] != "") & (mapped["url"] != "")]
    if mapped.empty:
        raise ValueError("No valid rows found after applying selected column mapping.")
    return mapped


def generate_qr_codes(data, image_dir=IMAGE_DIR, progress_callback=None):
    """Generate QR code images from all rows in the dataframe."""
    os.makedirs(image_dir, exist_ok=True)
    generated_rows = []
    used_names = set()
    total_rows = len(data)

    for index, row in enumerate(data.itertuples(index=False), start=1):
        label = str(row.name)
        base_name = sanitize_file_name(label, index)
        image_name = base_name
        suffix = 1
        while image_name in used_names:
            suffix += 1
            image_name = f"{base_name}_{suffix}"
        used_names.add(image_name)

        create_qr_code(image_name, str(row.url), image_dir=image_dir)
        generated_rows.append({"name": label, "url": str(row.url), "image_name": image_name})
        if progress_callback:
            progress_callback(index, total_rows)

    return pd.DataFrame(generated_rows)


def generate_pdf_file(data, image_dir=IMAGE_DIR, output_pdf=OUTPUT_PDF):
    """Generate a PDF that lays out QR images in a 4x4 grid per page."""
    images_per_row = 4
    rows_per_page = 4
    items_per_page = images_per_row * rows_per_page

    pdf = FPDF("P", "mm", "A4")
    pdf.add_page()
    pdf.set_font("Times", size=20)
    for index, row in enumerate(data):
        position_on_page = index % items_per_page
        if position_on_page == 0 and index != 0:
            pdf.add_page()

        column_index = position_on_page % images_per_row
        row_index = position_on_page // images_per_row
        x = GRID_MARGIN_X_MM + QR_SIZE_MM * column_index
        y = GRID_MARGIN_Y_MM + CELL_HEIGHT_MM * row_index

        image_name = row.get("image_name", row["name"])
        path = os.path.join(image_dir, f"{image_name}.png")
        pdf.image(path, x, y, QR_SIZE_MM, QR_SIZE_MM)
        pdf.text(x + LABEL_OFFSET_X_MM, y + LABEL_OFFSET_Y_MM, str(row["name"]))

    pdf.output(output_pdf)


def load_data():
    """Load and validate input CSV data."""
    with open(CSV_FILE, newline="", encoding="utf-8-sig") as csv_file:
        data = list(csv.DictReader(csv_file))
    validate_data(data)
    return data


def load_data_from_file(file_path):
    """Load input data from CSV or XLSX file."""
    extension = os.path.splitext(file_path)[1].lower()
    if extension == ".csv":
        return pd.read_csv(file_path)
    if extension == ".xlsx":
        return pd.read_excel(file_path)
    raise ValueError("Unsupported file format. Please upload CSV or XLSX.")


def create_zip_archive(image_dir, pdf_path, zip_path):
    """Package generated QR files into a zip archive."""
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_name in sorted(os.listdir(image_dir)):
            if file_name.lower().endswith(".png"):
                archive.write(os.path.join(image_dir, file_name), arcname=file_name)
        archive.write(pdf_path, arcname=os.path.basename(pdf_path))


def cleanup_stale_resources():
    """Remove expired upload/job temporary directories."""
    current_time = time.time()
    stale_upload_ids = []
    stale_job_ids = []

    with UPLOADS_LOCK:
        for upload_id, upload_info in UPLOADS.items():
            if current_time - upload_info["created_at"] > TEMP_RETENTION_SECONDS:
                stale_upload_ids.append(upload_id)
        for upload_id in stale_upload_ids:
            shutil.rmtree(UPLOADS[upload_id]["upload_dir"], ignore_errors=True)
            del UPLOADS[upload_id]

    with JOBS_LOCK:
        for job_id, job_info in JOBS.items():
            completed_at = job_info.get("completed_at")
            if completed_at and current_time - completed_at > TEMP_RETENTION_SECONDS:
                stale_job_ids.append(job_id)
        for job_id in stale_job_ids:
            work_dir = JOBS[job_id].get("working_directory")
            if work_dir:
                shutil.rmtree(work_dir, ignore_errors=True)
            del JOBS[job_id]


def get_session_entries():
    """Get normalized entries from session storage."""
    stored_entries = session.get("entries", [])
    if not isinstance(stored_entries, list):
        return []

    normalized = []
    for row in stored_entries:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name", "")).strip()
        url = str(row.get("url", "")).strip()
        if name and url:
            normalized.append({"name": name, "url": url})
    return normalized


def set_session_entries(entries):
    """Persist normalized entries to session storage."""
    session["entries"] = [
        {"name": str(row["name"]).strip(), "url": str(row["url"]).strip()}
        for row in entries
        if str(row.get("name", "")).strip() and str(row.get("url", "")).strip()
    ]
    session.modified = True


def process_background_job(job_id, file_path, label_column, url_column):
    """Generate QR assets in a background thread."""
    working_directory = None
    try:
        data = load_data_from_file(file_path)
        mapped = normalize_mapped_data(data, label_column=label_column, url_column=url_column)
        working_directory = tempfile.mkdtemp(prefix=f"qr_job_{job_id}_")
        image_dir = os.path.join(working_directory, "image")
        pdf_path = os.path.join(working_directory, OUTPUT_PDF)
        zip_path = os.path.join(working_directory, "qr_codes.zip")

        def progress_callback(done, total):
            with JOBS_LOCK:
                JOBS[job_id]["progress"] = done
                JOBS[job_id]["total"] = total

        generated = generate_qr_codes(mapped, image_dir=image_dir, progress_callback=progress_callback)
        generate_pdf_file(generated, image_dir=image_dir, output_pdf=pdf_path)
        create_zip_archive(image_dir=image_dir, pdf_path=pdf_path, zip_path=zip_path)

        with JOBS_LOCK:
            JOBS[job_id]["status"] = "complete"
            JOBS[job_id]["progress"] = JOBS[job_id]["total"]
            JOBS[job_id]["pdf_path"] = pdf_path
            JOBS[job_id]["zip_path"] = zip_path
            JOBS[job_id]["working_directory"] = working_directory
            JOBS[job_id]["completed_at"] = time.time()
    except Exception as error:
        with JOBS_LOCK:
            JOBS[job_id]["status"] = "error"
            JOBS[job_id]["error"] = str(error)
            JOBS[job_id]["completed_at"] = time.time()
        if working_directory:
            shutil.rmtree(working_directory, ignore_errors=True)
    finally:
        upload_dir = os.path.dirname(file_path)
        shutil.rmtree(upload_dir, ignore_errors=True)


def process_entries_job(job_id, entries):
    """Generate QR assets from prepared entry rows."""
    working_directory = None
    try:
        mapped = pd.DataFrame(entries)
        working_directory = tempfile.mkdtemp(prefix=f"qr_job_{job_id}_")
        image_dir = os.path.join(working_directory, "image")
        pdf_path = os.path.join(working_directory, OUTPUT_PDF)
        zip_path = os.path.join(working_directory, "qr_codes.zip")

        def progress_callback(done, total):
            with JOBS_LOCK:
                JOBS[job_id]["progress"] = done
                JOBS[job_id]["total"] = total

        generated = generate_qr_codes(mapped, image_dir=image_dir, progress_callback=progress_callback)
        generate_pdf_file(generated, image_dir=image_dir, output_pdf=pdf_path)
        create_zip_archive(image_dir=image_dir, pdf_path=pdf_path, zip_path=zip_path)

        with JOBS_LOCK:
            JOBS[job_id]["status"] = "complete"
            JOBS[job_id]["progress"] = JOBS[job_id]["total"]
            JOBS[job_id]["pdf_path"] = pdf_path
            JOBS[job_id]["zip_path"] = zip_path
            JOBS[job_id]["working_directory"] = working_directory
            JOBS[job_id]["completed_at"] = time.time()
    except Exception as error:
        with JOBS_LOCK:
            JOBS[job_id]["status"] = "error"
            JOBS[job_id]["error"] = str(error)
            JOBS[job_id]["completed_at"] = time.time()
        if working_directory:
            shutil.rmtree(working_directory, ignore_errors=True)


UPLOAD_TEMPLATE = """
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Bulk QR Generator</title></head>
<body>
  <h1>Bulk QR generation</h1>
  <p><a href="/entries">Manage entries manually</a></p>
  {% if error %}<p style="color: red;">{{ error }}</p>{% endif %}
  <form action="/upload" method="post" enctype="multipart/form-data">
    <label for="file">Upload CSV or XLSX:</label>
    <input id="file" type="file" name="file" accept=".csv,.xlsx" required>
    <button type="submit">Upload</button>
  </form>
</body>
</html>
"""

ENTRIES_TEMPLATE = """
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Entry List</title></head>
<body>
  <h1>Entry list</h1>
  <p><a href="/">Import additional CSV/XLSX file</a></p>
  {% if error %}<p style="color: red;">{{ error }}</p>{% endif %}
  {% if message %}<p style="color: green;">{{ message }}</p>{% endif %}

  <h2>Add entry manually</h2>
  <form action="/entries/add" method="post">
    <label for="name">Name</label>
    <input id="name" name="name" type="text" required>
    <label for="url">URL</label>
    <input id="url" name="url" type="url" required>
    <button type="submit">Add entry</button>
  </form>

  <h2>Current entries ({{ entries|length }})</h2>
  {% if entries %}
  <form action="/entries/update" method="post">
    <input type="hidden" name="count" value="{{ entries|length }}">
    <table border="1" cellpadding="6" cellspacing="0">
      <thead>
        <tr>
          <th>Name</th>
          <th>URL</th>
          <th>Delete</th>
        </tr>
      </thead>
      <tbody>
        {% for entry in entries %}
        <tr>
          <td><input type="text" name="name_{{ loop.index0 }}" value="{{ entry.name }}" required></td>
          <td><input type="url" name="url_{{ loop.index0 }}" value="{{ entry.url }}" required></td>
          <td><input type="checkbox" name="delete_{{ loop.index0 }}"></td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
    <button type="submit">Save edits</button>
  </form>
  {% endif %}

  <p>
    <form action="/entries/generate" method="post" style="display:inline;">
      <button type="submit" {% if not entries %}disabled{% endif %}>Generate QR codes and PDF</button>
    </form>
    <form action="/entries/clear" method="post" style="display:inline;">
      <button type="submit" {% if not entries %}disabled{% endif %}>Clear list</button>
    </form>
  </p>
</body>
</html>
"""

MAPPING_TEMPLATE = """
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Map columns</title></head>
<body>
  <h1>Map columns</h1>
  <p>File: {{ filename }}</p>
  <form action="/start-job" method="post">
    <input type="hidden" name="upload_id" value="{{ upload_id }}">
    <label for="url_column">URL column</label>
    <select name="url_column" id="url_column">
      {% for column in columns %}<option value="{{ column }}">{{ column }}</option>{% endfor %}
    </select>
    <label for="label_column">Label column</label>
    <select name="label_column" id="label_column">
      {% for column in columns %}<option value="{{ column }}">{{ column }}</option>{% endfor %}
    </select>
    <button type="submit">Generate QR codes</button>
  </form>
</body>
</html>
"""

PROGRESS_TEMPLATE = """
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Processing</title></head>
<body>
  <h1>Generation progress</h1>
  <p id="status">Starting background job...</p>
  <progress id="progress" value="0" max="100"></progress>
  <div id="downloads" style="display:none;">
    <p><a id="pdf_link" href="#">Download PDF</a></p>
    <p><a id="zip_link" href="#">Download ZIP</a></p>
  </div>
  <script>
    const jobId = "{{ job_id }}";
    const statusNode = document.getElementById("status");
    const progressNode = document.getElementById("progress");
    const downloadsNode = document.getElementById("downloads");
    const pdfLink = document.getElementById("pdf_link");
    const zipLink = document.getElementById("zip_link");
    const timer = setInterval(async () => {
      const response = await fetch(`/job-status/${jobId}`);
      const data = await response.json();
      const total = data.total || 1;
      const percentage = Math.floor((data.progress / total) * 100);
      progressNode.value = percentage;
      statusNode.textContent = `${data.status} (${data.progress}/${data.total})`;
      if (data.status === "complete") {
        clearInterval(timer);
        downloadsNode.style.display = "block";
        pdfLink.href = `/download/${jobId}/pdf`;
        zipLink.href = `/download/${jobId}/zip`;
        statusNode.textContent = "Completed.";
      }
      if (data.status === "error") {
        clearInterval(timer);
        statusNode.textContent = `Error: ${data.error}`;
      }
    }, 1000);
  </script>
</body>
</html>
"""


@app.route("/")
def index():
    """Upload page."""
    cleanup_stale_resources()
    return render_template_string(UPLOAD_TEMPLATE, error=request.args.get("error"))


@app.route("/upload", methods=["POST"])
def upload():
    """Receive file upload and show column mapping."""
    cleanup_stale_resources()
    upload_file = request.files.get("file")
    if upload_file is None or not upload_file.filename:
        return redirect(url_for("index", error="Please select a CSV or XLSX file."))

    filename = secure_filename(upload_file.filename)
    extension = os.path.splitext(filename)[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        return redirect(url_for("index", error="Only CSV and XLSX files are supported."))

    upload_dir = tempfile.mkdtemp(prefix="qr_upload_")
    file_path = os.path.join(upload_dir, filename)
    upload_file.save(file_path)
    try:
        data = load_data_from_file(file_path)
    except Exception as error:
        shutil.rmtree(upload_dir, ignore_errors=True)
        return redirect(url_for("index", error=f"Failed to parse file: {error}"))

    upload_id = uuid.uuid4().hex
    with UPLOADS_LOCK:
        UPLOADS[upload_id] = {
            "file_path": file_path,
            "filename": filename,
            "upload_dir": upload_dir,
            "created_at": time.time(),
        }
    return render_template_string(
        MAPPING_TEMPLATE,
        upload_id=upload_id,
        filename=filename,
        columns=list(data.columns),
    )


@app.route("/start-job", methods=["POST"])
def start_job():
    """Import mapped CSV/XLSX rows into the editable entry list."""
    cleanup_stale_resources()
    upload_id = request.form.get("upload_id")
    url_column = request.form.get("url_column", "")
    label_column = request.form.get("label_column", "")
    with UPLOADS_LOCK:
        upload_info = UPLOADS.pop(upload_id or "", None)
    if upload_info is None:
        return redirect(url_for("index", error="Upload session expired. Please upload again."))
    try:
        data = load_data_from_file(upload_info["file_path"])
        mapped = normalize_mapped_data(data, label_column=label_column, url_column=url_column)
        imported_entries = mapped.to_dict(orient="records")
        current_entries = get_session_entries()
        current_entries.extend(imported_entries)
        set_session_entries(current_entries)
        return redirect(url_for("entries_page", message=f"Imported {len(imported_entries)} entries."))
    except Exception as error:
        return redirect(url_for("entries_page", error=f"Failed to import entries: {error}"))
    finally:
        shutil.rmtree(upload_info["upload_dir"], ignore_errors=True)


@app.route("/entries")
def entries_page():
    """Show and manage current entry list."""
    cleanup_stale_resources()
    return render_template_string(
        ENTRIES_TEMPLATE,
        entries=get_session_entries(),
        error=request.args.get("error"),
        message=request.args.get("message"),
    )


@app.route("/entries/add", methods=["POST"])
def add_entry():
    """Add one manual entry to the current list."""
    name = request.form.get("name", "").strip()
    url = request.form.get("url", "").strip()
    if not name or not url:
        return redirect(url_for("entries_page", error="Name and URL are required."))
    current_entries = get_session_entries()
    current_entries.append({"name": name, "url": url})
    set_session_entries(current_entries)
    return redirect(url_for("entries_page", message="Entry added."))


@app.route("/entries/update", methods=["POST"])
def update_entries():
    """Edit and delete entries from the current list."""
    try:
        count = int(request.form.get("count", "0"))
    except ValueError:
        count = 0

    updated_entries = []
    for index in range(count):
        if request.form.get(f"delete_{index}"):
            continue
        name = request.form.get(f"name_{index}", "").strip()
        url = request.form.get(f"url_{index}", "").strip()
        if not name or not url:
            return redirect(url_for("entries_page", error="Each entry must include both name and URL."))
        updated_entries.append({"name": name, "url": url})

    set_session_entries(updated_entries)
    return redirect(url_for("entries_page", message="Entry list updated."))


@app.route("/entries/clear", methods=["POST"])
def clear_entries():
    """Clear all current entries."""
    set_session_entries([])
    return redirect(url_for("entries_page", message="Entry list cleared."))


@app.route("/entries/generate", methods=["POST"])
def generate_entries():
    """Generate assets from current mixed entry list."""
    current_entries = get_session_entries()
    if not current_entries:
        return redirect(url_for("entries_page", error="Add at least one entry before generating."))
    try:
        validate_data(current_entries)
    except ValueError as error:
        return redirect(url_for("entries_page", error=str(error)))

    job_id = uuid.uuid4().hex
    with JOBS_LOCK:
        JOBS[job_id] = {
            "status": "running",
            "progress": 0,
            "total": 0,
            "error": "",
            "pdf_path": None,
            "zip_path": None,
        }

    thread = threading.Thread(
        target=process_entries_job,
        args=(job_id, list(current_entries)),
        daemon=True,
    )
    thread.start()
    return render_template_string(PROGRESS_TEMPLATE, job_id=job_id)


@app.route("/job-status/<job_id>")
def job_status(job_id):
    """Fetch processing progress for the given job."""
    cleanup_stale_resources()
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is None:
            return jsonify({"status": "error", "error": "Unknown job.", "progress": 0, "total": 0}), 404
        return jsonify(
            {
                "status": job["status"],
                "progress": job["progress"],
                "total": job["total"],
                "error": job["error"],
            }
        )


@app.route("/download/<job_id>/<file_type>")
def download(job_id, file_type):
    """Download generated PDF or ZIP for a completed job."""
    cleanup_stale_resources()
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is None or job["status"] != "complete":
            return redirect(url_for("index", error="Job not available for download."))
        if file_type == "pdf":
            path = job["pdf_path"]
            filename = OUTPUT_PDF
        elif file_type == "zip":
            path = job["zip_path"]
            filename = "qr_codes.zip"
        else:
            return redirect(url_for("index", error="Unsupported download type."))

    return send_file(path, as_attachment=True, download_name=filename)


def run_cli_generation():
    """Entry point for generating QR images and the output PDF."""
    try:
        data = load_data()
    except FileNotFoundError as exc:
        raise SystemExit(
            f"Input file not found: {CSV_FILE}. Add it to project root and retry."
        ) from exc
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    generated = generate_qr_codes(data)
    generate_pdf_file(generated)


def parse_args():
    """Parse command line options."""
    parser = argparse.ArgumentParser(description="QR code PDF list generator")
    parser.add_argument(
        "--web",
        action="store_true",
        help="Run web UI for bulk CSV/XLSX processing.",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Host for web mode.")
    parser.add_argument("--port", default=5000, type=int, help="Port for web mode.")
    return parser.parse_args()


def main():
    """Application entry point."""
    args = parse_args()
    if args.web:
        app.run(host=args.host, port=args.port)
        return
    run_cli_generation()


if __name__ == "__main__":
    main()
