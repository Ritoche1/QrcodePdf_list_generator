# QR Code PDF List Generator

Generate a printable PDF sheet of QR codes from a CSV file.

## Project objective

This project reads a CSV containing names and URLs, generates one QR image per row, and compiles those images into a PDF (`qr_codes.pdf`) for printing or sharing.

## Features

- CSV-driven QR code generation
- Automatic image output into `image/` directory
- PDF layout in a 4x4 grid per page
- Input validation for required CSV columns

## Setup

1. Clone the repository:

```sh
git clone https://github.com/Ritoche1/QrcodePdf_list_generator.git
cd QrcodePdf_list_generator
```

2. Install dependencies:

```sh
pip install -r requirement.txt
```

## Input format

Place `data.csv` in the project root. It must contain:

- `name`
- `url`

Example:

```csv
name,url
GitHub,https://github.com
Python,https://www.python.org
```

## Usage

Run:

```sh
python3 main.py
```

Outputs:

- `image/<name>.png` files for each row in CSV
- `qr_codes.pdf` containing all generated QR codes

## Sample output PDF

The PDF is generated as an A4 document with up to 16 QR codes per page (4 columns × 4 rows), each with its corresponding `name` label beneath it.

## Roadmap

- [ ] CLI arguments for custom input/output paths
- [ ] Filename sanitization for broader character support
- [ ] Automated tests
- [ ] Optional logo/styling support in PDF output

## Contribution guidelines

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Keep changes focused and small
4. Open a pull request with a clear description and example input/output

## FAQ

### Why do I get “Input file not found: data.csv”?
Create `data.csv` in the repository root and run the script again.

### Why do I get a missing column error?
Your CSV must contain both `name` and `url` columns.

### Can I use this with many rows?
Yes. The script creates additional PDF pages automatically after every 16 QR codes.
