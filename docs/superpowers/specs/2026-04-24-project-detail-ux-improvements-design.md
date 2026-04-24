# Project Detail UX Improvements — Design Spec
_Date: 2026-04-24_

## Overview

Three focused UX improvements to the Project Detail page (`ProjectDetail.tsx`):

1. Edit entry info directly from the project homepage
2. Full QR design options (fg color, bg color, error correction) on the per-entry Generate QR modal
3. Move the Export button into the bulk-selection action bar, scoped to selected entries

---

## Issue 1 — Edit Entry from Project Page

### Goal
Users can edit entry data (label, QR type, content fields, tags) directly from the project homepage, without navigating to the QR generation wizard.

### Current state
`EntryTable` already declares `onEdit?: (entry: Entry) => void` and renders an Edit button per row, but `ProjectDetail` never passes the prop, so the button is a no-op.

### Changes

**`ProjectDetail.tsx`**
- Add state: `editEntry: Entry | null` (initially `null`)
- Import and use `useUpdateEntry(id!)` hook (already exists in `hooks/useEntries.ts`)
- Pass `onEdit={(entry) => setEditEntry(entry)}` to `<EntryTable>`
- Add a second `<EntryEditorModal>` instance (or reuse the existing one with conditional mode):
  - `isOpen={Boolean(editEntry)}`
  - `mode="edit"`
  - `initialEntry={editEntry}`
  - `loading={isUpdatingEntry}`
  - `onClose={() => setEditEntry(null)}`
  - `onSubmit={handleUpdateEntry}`
- `handleUpdateEntry(payload)`: calls `updateEntry({ id: editEntry.id, ...payload })`, invalidates `entryKeys.all(id!)`, shows toast, closes modal

**No changes** to `EntryEditorModal`, `EntryTable`, or any hook.

---

## Issue 2 — Full QR Design Options on Generate QR Modal

### Goal
When generating/regenerating a QR code for an individual entry from the project page, users can control foreground color, background color, and error correction level — not just the foreground color.

### Current state
The modal stores only `qrDesignColor: string` (fg color). The preview effect patches `defaultQrDesign` with just `foreground_color: qrDesignColor`. `handleGenerateQr` only accepts an optional `fgColor?: string`.

### Changes

**`ProjectDetail.tsx`**
- Replace state `qrDesignColor: string` → `qrDesignOptions: QrDesignOptions`
- In `openQrDesignModal(entry)`: initialize `qrDesignOptions` from `defaultQrDesign` (fg, bg, error correction, size)
- Replace the hand-rolled color picker block in the modal body with `<QrDesignOptionsForm value={qrDesignOptions} onChange={setQrDesignOptions} />`
- Update the `useEffect` for QR design preview to use the full `qrDesignOptions` object instead of patching only `foreground_color`
- Extend `handleGenerateQr(entryId, design?: QrDesignOptions)`: map `design` to the backend payload `{ fg_color, bg_color, error_correction }` instead of only `fg_color`
- The Save button calls `handleGenerateQr(qrDesignEntry.id, qrDesignOptions)`

**`components/qr/QrDesignOptions.tsx`** — no changes, just used as-is.

---

## Issue 3 — Export in Bulk Actions Bar

### Goal
Move CSV/XLSX export into the bulk-selection floating bar so users can export only the entries they have selected. The top-bar Export button is **kept** as a "export all entries" fallback.

### Export options in the bar
- **Export Data** → dropdown with "Export CSV" and "Export XLSX" (scoped to selected entry IDs)
- **Export QR Codes** → single button downloading a ZIP of QR images for selected entries (already exists as "Download ZIP")

### Changes

**`BulkActions.tsx`**
- Add prop `onExportData?: (format: 'csv' | 'xlsx') => void`
- Add an "Export Data" dropdown button (same hover-dropdown pattern as the header) with "Export CSV" and "Export XLSX" options, placed between "Generate QR" and "Download ZIP"
- Rename the existing "Download ZIP" button label to "Export QR Codes" for clarity
- Separator lines (`w-px h-6 bg-gray-700`) between each action group

**`ProjectDetail.tsx`**
- Add `handleExportSelected(format: 'csv' | 'xlsx')`: calls `importExportApi.exportData(id!, format, Array.from(selectedIds))`, downloads blob
- Pass `onExportData={handleExportSelected}` to `<BulkActions>`

**`lib/api.ts` — `importExportApi.exportData`**
- Add optional third parameter `entryIds?: string[]`
- When provided, send as a POST request with body `{ format, entry_ids }` to avoid URL length limits with large selections
- When omitted (export all), keep existing GET request

**Backend**
- Add `POST /projects/{projectId}/export/data` endpoint accepting `{ format: 'csv'|'xlsx', entry_ids?: string[] }` and returning the file blob
- Existing `GET /projects/{projectId}/export/data` remains unchanged for full-project export

---

## Out of Scope
- Inline editing (editing directly in the table row without a modal)
- Bulk edit of multiple entries at once
- Per-entry QR design persistence across sessions (design is per-generation, not stored per entry)
