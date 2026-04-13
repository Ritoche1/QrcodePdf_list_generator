#!/usr/bin/env python3

import os
import re

import pandas as pd
import qrcode
from fpdf import FPDF

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
INVALID_FILENAME_CHARS = re.compile(r"[^A-Za-z0-9._-]+")


def image_filename(name):
    """Build a safe image filename for an entry name."""
    sanitized_name = INVALID_FILENAME_CHARS.sub("_", str(name)).strip("._")
    if not sanitized_name:
        sanitized_name = "entry"
    return f"{sanitized_name}.png"


def create_qr_code(name, url):
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
    img.save(os.path.join(IMAGE_DIR, image_filename(name)))


def validate_data(data):
    """Validate required columns before generating files."""
    missing_columns = REQUIRED_COLUMNS - set(data.columns)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise ValueError(f"CSV is missing required column(s): {missing}")


def generate_qr_codes(data):
    """Generate QR code images from all rows in the dataframe."""
    os.makedirs(IMAGE_DIR, exist_ok=True)
    for _, row in data.iterrows():
        create_qr_code(row["name"], row["url"])


def generate_pdf_file(data):
    """Generate a PDF that lays out QR images in a 4x4 grid per page."""
    images_per_row = 4
    rows_per_page = 4
    items_per_page = images_per_row * rows_per_page

    pdf = FPDF("P", "mm", "A4")
    pdf.add_page()
    pdf.set_font("Times", size=20)
    for index, row in data.iterrows():
        position_on_page = index % items_per_page
        if position_on_page == 0 and index != 0:
            pdf.add_page()

        column_index = position_on_page % images_per_row
        row_index = position_on_page // images_per_row
        x = GRID_MARGIN_X_MM + QR_SIZE_MM * column_index
        y = GRID_MARGIN_Y_MM + CELL_HEIGHT_MM * row_index

        path = os.path.join(IMAGE_DIR, image_filename(row["name"]))
        pdf.image(path, x, y, QR_SIZE_MM, QR_SIZE_MM)
        pdf.text(x + LABEL_OFFSET_X_MM, y + LABEL_OFFSET_Y_MM, row["name"])

    pdf.output(OUTPUT_PDF)


def load_data():
    """Load and validate input CSV data."""
    data = pd.read_csv(CSV_FILE)
    validate_data(data)
    return data


def main():
    """Entry point for generating QR images and the output PDF."""
    try:
        data = load_data()
    except FileNotFoundError as exc:
        raise SystemExit(
            f"Input file not found: {CSV_FILE}. Add it to project root and retry."
        ) from exc
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    generate_qr_codes(data)
    generate_pdf_file(data)


if __name__ == "__main__":
    main()
