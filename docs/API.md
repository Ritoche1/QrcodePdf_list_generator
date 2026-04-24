# API Documentation

QRCodePDF exposes a REST API at `/api/v1/`. When running locally, interactive Swagger documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

## Base URL

```
http://localhost:8000/api/v1
```

No authentication is required.

---

## Projects

### List Projects

```http
GET /projects
```

**Response** `200 OK`
```json
[
  {
    "id": 1,
    "name": "My Campaign",
    "description": "QR codes for spring campaign",
    "created_at": "2026-04-13T10:00:00",
    "updated_at": "2026-04-13T10:00:00",
    "entry_count": 42
  }
]
```

### Create Project

```http
POST /projects
Content-Type: application/json

{
  "name": "My Campaign",
  "description": "QR codes for spring campaign"
}
```

**Response** `201 Created`

### Get Project

```http
GET /projects/{id}
```

### Update Project

```http
PUT /projects/{id}
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}
```

### Delete Project

```http
DELETE /projects/{id}
```

**Response** `204 No Content` — deletes the project and all its entries.

---

## Entries

### List Entries (with search, filter, pagination)

```http
GET /projects/{id}/entries?search=example&status=draft&tags=campaign&sort_by=created_at&sort_order=desc&page=1&per_page=20
```

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | Full-text search on label and content |
| `status` | string | — | Filter by status: `draft`, `generated`, `printed`, `archived` |
| `tags` | string | — | Filter by tag (comma-separated for multiple) |
| `sort_by` | string | `created_at` | Sort field |
| `sort_order` | string | `desc` | `asc` or `desc` |
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page |

**Response** `200 OK`
```json
{
  "items": [
    {
      "id": 1,
      "project_id": 1,
      "content_type": "url",
      "content_data": { "url": "https://example.com" },
      "label": "Example Site",
      "status": "draft",
      "tags": ["campaign", "web"],
      "created_at": "2026-04-13T10:00:00",
      "updated_at": "2026-04-13T10:00:00"
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 20,
  "pages": 3
}
```

### Create Entry

```http
POST /projects/{id}/entries
Content-Type: application/json

{
  "content_type": "url",
  "content_data": { "url": "https://example.com" },
  "label": "Example Site",
  "tags": ["campaign"]
}
```

**Content types and their `content_data` format:**

#### URL
```json
{ "url": "https://example.com" }
```

#### Plain Text
```json
{ "text": "Hello, world!" }
```

#### vCard
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+33612345678",
  "email": "john@example.com",
  "organization": "Acme Inc",
  "title": "Engineer",
  "address": "123 Main St, Paris"
}
```

#### Wi-Fi
```json
{
  "ssid": "MyNetwork",
  "password": "secret123",
  "encryption": "WPA",
  "hidden": false
}
```

### Bulk Create Entries

```http
POST /projects/{id}/entries/bulk
Content-Type: application/json

[
  { "content_type": "url", "content_data": { "url": "https://a.com" }, "label": "A" },
  { "content_type": "url", "content_data": { "url": "https://b.com" }, "label": "B" }
]
```

### Update Entry

```http
PUT /entries/{id}
Content-Type: application/json

{
  "label": "New Label",
  "status": "generated",
  "tags": ["updated"]
}
```

### Delete Entry

```http
DELETE /entries/{id}
```

### Bulk Update Status

```http
PATCH /entries/bulk-status
Content-Type: application/json

{
  "entry_ids": [1, 2, 3],
  "status": "printed"
}
```

### Bulk Add/Remove Tags

```http
PATCH /entries/bulk-tags
Content-Type: application/json

{
  "entry_ids": [1, 2, 3],
  "add_tags": ["printed"],
  "remove_tags": ["draft"]
}
```

---

## QR Code Generation

### Preview QR Code

Generate a QR code preview image without saving it.

```http
POST /qr/preview
Content-Type: application/json

{
  "content_type": "url",
  "content_data": { "url": "https://example.com" },
  "design": {
    "foreground_color": "#000000",
    "background_color": "#FFFFFF",
    "error_correction": "M"
  }
}
```

**Response** `200 OK` — PNG image bytes (`Content-Type: image/png`)

### Generate QR for Entry

```http
POST /qr/generate/{entry_id}
Content-Type: application/json

{
  "foreground_color": "#000000",
  "background_color": "#FFFFFF",
  "error_correction": "M"
}
```

**Response** `200 OK` — PNG image bytes, also saved to `/data/files/`

---

## PDF Generation

### Generate PDF

```http
POST /projects/{id}/pdf
Content-Type: application/json

{
  "page_size": "A4",
  "margin_top": 10,
  "margin_bottom": 10,
  "margin_left": 10,
  "margin_right": 10,
  "columns": 4,
  "rows": 4,
  "qr_size": 40,
  "spacing": 5,
  "show_labels": true,
  "show_serial": false,
  "foreground_color": "#000000",
  "background_color": "#FFFFFF",
  "error_correction": "M"
}
```

**Response** `200 OK` — PDF file bytes (`Content-Type: application/pdf`)

### Preview First Page

```http
POST /projects/{id}/pdf/preview
Content-Type: application/json

{ ... same body as /pdf ... }
```

**Response** `200 OK` — PNG image of first page

### Export as ZIP (individual PNGs)

```http
POST /projects/{id}/export
Content-Type: application/json

{
  "foreground_color": "#000000",
  "background_color": "#FFFFFF",
  "error_correction": "M"
}
```

**Response** `200 OK` — ZIP archive (`Content-Type: application/zip`)

---

## Import / Export Data

### Preview Import

Upload a CSV or XLSX file to see detected columns.

```http
POST /projects/{id}/import/preview
Content-Type: multipart/form-data

file: (binary)
```

**Response** `200 OK`
```json
{
  "columns": ["name", "url", "category"],
  "preview_rows": [
    ["Example", "https://example.com", "web"],
    ["Test", "https://test.com", "test"]
  ],
  "total_rows": 100,
  "file_id": "abc123"
}
```

### Confirm Import

```http
POST /projects/{id}/import/confirm
Content-Type: application/json

{
  "file_id": "abc123",
  "mapping": {
    "label": "name",
    "url": "url"
  },
  "content_type": "url"
}
```

### Export Data

```http
GET /projects/{id}/export/data?format=csv
GET /projects/{id}/export/data?format=xlsx
```

**Response** — CSV or XLSX file download

---

## Stats

```http
GET /stats
```

**Response** `200 OK`
```json
{
  "total_projects": 5,
  "total_entries": 234,
  "entries_by_status": {
    "draft": 100,
    "generated": 80,
    "printed": 50,
    "archived": 4
  },
  "recent_projects": [...]
}
```
