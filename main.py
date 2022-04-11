#!/usr/bin/env python3

import qrcode
import pandas as pd
from fpdf import FPDF
import os


def create_qr_code(name, url):
    qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_L,
    box_size=10,
    border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(f"image/{name}.png")

def generate_qr_codes(data):
    if os.path.exists("image") == False:
        os.mkdir("image")
    for index, row in data.iterrows():
        create_qr_code(row["name"], row["url"])

def generate_pdf_file(data):
    i = 10
    h = 10
    j = 0
    pdf = FPDF("P", "mm", "A4")
    pdf.add_page()
    pdf.set_font("Times", size=20)
    for index, row in data.iterrows():
        path = f"image/{row['name']}.png"
        pdf.image(path, 10 + 50 * j, h, 50, 50)
        if (index % 4) == 0 and index != 0:
            pdf.text(26 + 50 * j, h + 55, row["name"])
            h += 60
            j = -1
        else:
            pdf.text(26 + 50 * j, h + 55, row["name"])
        if (index % 16 == 0 and index != 0):
            h = 10
            j = -1
            i = 0
            pdf.add_page()
        i += 10
        j += 1

    pdf.output("qr_codes.pdf")

def main():
    data = pd.read_csv("data.csv")
    generate_qr_codes(data)
    generate_pdf_file(data)



if __name__ == "__main__":
    main()