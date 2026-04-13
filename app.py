#!/usr/bin/env python3

import pandas as pd
import streamlit as st

from main import OUTPUT_PDF, REQUIRED_COLUMNS, generate_pdf_file, generate_qr_codes, validate_data


def normalize_entries(data):
    """Normalize entry data to required columns and trimmed string values."""
    normalized_data = data.copy()
    for column in REQUIRED_COLUMNS:
        if column not in normalized_data.columns:
            normalized_data[column] = ""

    normalized_data = normalized_data[["name", "url"]].fillna("")
    normalized_data["name"] = normalized_data["name"].astype(str).str.strip()
    normalized_data["url"] = normalized_data["url"].astype(str).str.strip()
    normalized_data = normalized_data[
        (normalized_data["name"] != "") & (normalized_data["url"] != "")
    ]
    return normalized_data.reset_index(drop=True)


def empty_entries():
    """Return an empty dataframe with required entry columns."""
    return pd.DataFrame(columns=["name", "url"])


def add_manual_entry(entries, name, url):
    """Append one manual entry to the existing dataframe."""
    clean_name = name.strip()
    clean_url = url.strip()
    if not clean_name or not clean_url:
        raise ValueError("Both name and url are required.")

    new_entry = pd.DataFrame([{"name": clean_name, "url": clean_url}])
    return pd.concat([entries, new_entry], ignore_index=True)


def run_app():
    """Run the web interface for managing entries and generating the PDF."""
    st.set_page_config(page_title="QR Code PDF List Generator", layout="wide")
    st.title("QR Code PDF List Generator")
    st.write(
        "Import entries from CSV, add entries manually, edit or delete rows, then generate a PDF."
    )

    if "entries" not in st.session_state:
        st.session_state.entries = empty_entries()

    uploaded_file = st.file_uploader("Import CSV", type=["csv"])
    if st.button("Import CSV entries", disabled=uploaded_file is None):
        try:
            imported_entries = pd.read_csv(uploaded_file)
            validate_data(imported_entries)
            st.session_state.entries = pd.concat(
                [normalize_entries(st.session_state.entries), normalize_entries(imported_entries)],
                ignore_index=True,
            )
            st.success(f"Imported {len(imported_entries.index)} row(s).")
        except ValueError as exc:
            st.error(str(exc))

    with st.form("manual_entry_form", clear_on_submit=True):
        st.subheader("Add entry manually")
        name = st.text_input("Name")
        url = st.text_input("URL")
        add_clicked = st.form_submit_button("Add entry")
        if add_clicked:
            try:
                st.session_state.entries = add_manual_entry(
                    normalize_entries(st.session_state.entries), name, url
                )
                st.success("Entry added.")
            except ValueError as exc:
                st.error(str(exc))

    st.subheader("Entry list")
    normalized_entries = normalize_entries(st.session_state.entries)
    edited_entries = st.data_editor(
        normalized_entries,
        num_rows="dynamic",
        use_container_width=True,
        hide_index=True,
    )
    normalized_edited_entries = normalize_entries(edited_entries)
    st.session_state.entries = normalized_edited_entries
    entry_count = len(normalized_edited_entries.index)
    entry_word = "entry" if entry_count == 1 else "entries"
    st.caption(f"{entry_count} {entry_word} ready.")

    if st.button("Generate QR codes and PDF"):
        prepared_entries = st.session_state.entries
        if prepared_entries.empty:
            st.error("Add at least one complete entry before generating the PDF.")
            return

        validate_data(prepared_entries)
        generate_qr_codes(prepared_entries)
        generate_pdf_file(prepared_entries)
        st.success("Generated QR images and PDF.")
        with open(OUTPUT_PDF, "rb") as output_pdf:
            st.download_button(
                label="Download generated PDF",
                data=output_pdf.read(),
                file_name=OUTPUT_PDF,
                mime="application/pdf",
            )


if __name__ == "__main__":
    run_app()
