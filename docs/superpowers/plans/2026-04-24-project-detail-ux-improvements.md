# Project Detail UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three UX improvements to ProjectDetail: edit entries inline, full QR design options on the per-entry Generate QR modal, and export scoped to selected entries in the bulk actions bar.

**Architecture:** All changes are additive. Issue 1 wires existing hooks/components. Issue 2 replaces one state variable and swaps a hand-rolled picker for the existing `QrDesignOptionsForm`. Issue 3 extends `BulkActions`, adds a POST export endpoint on the backend, and updates `importExportApi.exportData` to use it when IDs are provided.

**Tech Stack:** React 18 + TypeScript, TanStack Query, FastAPI (Python), SQLAlchemy async, Axios

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/pages/ProjectDetail.tsx` | Issues 1, 2, 3 — wire edit, expand QR design state, add export handler |
| `frontend/src/components/entries/BulkActions.tsx` | Issue 3 — add Export Data dropdown, rename ZIP button |
| `frontend/src/lib/api.ts` | Issue 3 — update `exportData` to POST with `entry_ids` |
| `backend/app/api/routes/import_export.py` | Issue 3 — add `POST /projects/{id}/export/data` endpoint |

---

## Task 1: Wire edit entry in ProjectDetail

**Files:**
- Modify: `frontend/src/pages/ProjectDetail.tsx`

- [ ] **Step 1: Add `useUpdateEntry` hook and `editEntry` state**

  In `ProjectDetail.tsx`, find the existing imports block that contains `useCreateEntry`:

  ```ts
  // existing line ~17:
  import { useEntries, useDeleteEntry, useBulkDelete, useBulkStatus, useCreateEntry, entryKeys } from '@/hooks/useEntries';
  ```

  Replace with:

  ```ts
  import { useEntries, useDeleteEntry, useBulkDelete, useBulkStatus, useCreateEntry, useUpdateEntry, entryKeys } from '@/hooks/useEntries';
  ```

  Then add `editEntry` state after the existing `manualEntryOpen` state (around line 57):

  ```ts
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  ```

  And add the hook after `useCreateEntry` (around line 83):

  ```ts
  const { mutateAsync: updateEntry, isPending: isUpdatingEntry } = useUpdateEntry(id!);
  ```

- [ ] **Step 2: Add `handleUpdateEntry` handler**

  Add after `handleCreateEntry` (around line 287):

  ```ts
  const handleUpdateEntry = async (payload: CreateEntry) => {
    if (!editEntry) return;
    try {
      await updateEntry({ id: editEntry.id, payload });
      await queryClient.invalidateQueries({ queryKey: entryKeys.all(id!) });
      toast.success('Entry updated');
      setEditEntry(null);
    } catch {
      toast.error('Failed to update entry');
    }
  };
  ```

- [ ] **Step 3: Pass `onEdit` to `EntryTable`**

  Find the `<EntryTable>` block (around line 476). Add `onEdit` prop:

  ```tsx
  <EntryTable
    entries={entries}
    total={total}
    loading={entriesLoading}
    filters={filters}
    onFiltersChange={setFilters}
    selectedIds={selectedIds}
    onSelectAll={handleSelectAll}
    onSelectRow={handleSelectRow}
    onEdit={(entry) => setEditEntry(entry)}
    onDelete={(entry) => setDeleteEntryId(entry.id)}
    onGenerateQr={openQrDesignModal}
    onPreviewQr={handlePreviewEntryQr}
    onDownloadQr={handleDownloadEntryQr}
  />
  ```

- [ ] **Step 4: Add edit `EntryEditorModal` instance**

  Add after the existing `<EntryEditorModal>` (the `create` one, around line 517):

  ```tsx
  <EntryEditorModal
    isOpen={Boolean(editEntry)}
    mode="edit"
    initialEntry={editEntry}
    loading={isUpdatingEntry}
    onClose={() => setEditEntry(null)}
    onSubmit={handleUpdateEntry}
  />
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/pages/ProjectDetail.tsx
  git commit -m "feat: wire edit entry modal on project detail page"
  ```

---

## Task 2: Full QR design options on Generate QR modal

**Files:**
- Modify: `frontend/src/pages/ProjectDetail.tsx`

- [ ] **Step 1: Add `QrDesignOptionsForm` import**

  Find the existing QR-related import (around line 18):

  ```ts
  import { useGenerateQr } from '@/hooks/useQrPreview';
  ```

  Add below it:

  ```ts
  import { QrDesignOptionsForm } from '@/components/qr/QrDesignOptions';
  import type { QrDesignOptions } from '@/types';
  ```

- [ ] **Step 2: Replace `qrDesignColor` state with `qrDesignOptions`**

  Find (around line 65–68):

  ```ts
  const [qrDesignEntry, setQrDesignEntry] = useState<Entry | null>(null);
  const [qrDesignColor, setQrDesignColor] = useState(STANDARD_QR_FOREGROUND_COLOR);
  const [qrDesignPreviewUrl, setQrDesignPreviewUrl] = useState<string | null>(null);
  const [qrDesignPreviewLoading, setQrDesignPreviewLoading] = useState(false);
  ```

  Replace with:

  ```ts
  const [qrDesignEntry, setQrDesignEntry] = useState<Entry | null>(null);
  const [qrDesignOptions, setQrDesignOptions] = useState<QrDesignOptions>({
    foreground_color: STANDARD_QR_FOREGROUND_COLOR,
    background_color: STANDARD_QR_BACKGROUND_COLOR,
    error_correction: STANDARD_QR_ERROR_CORRECTION,
    size: 400,
  });
  const [qrDesignPreviewUrl, setQrDesignPreviewUrl] = useState<string | null>(null);
  const [qrDesignPreviewLoading, setQrDesignPreviewLoading] = useState(false);
  ```

- [ ] **Step 3: Update `openQrDesignModal` to initialize from `defaultQrDesign`**

  Find (around line 307):

  ```ts
  const openQrDesignModal = (entry: Entry) => {
    setQrDesignEntry(entry);
    setQrDesignColor(defaultQrDesign.foreground_color);
  };
  ```

  Replace with:

  ```ts
  const openQrDesignModal = (entry: Entry) => {
    setQrDesignEntry(entry);
    setQrDesignOptions(defaultQrDesign);
  };
  ```

- [ ] **Step 4: Update the QR design preview `useEffect`**

  Find the `useEffect` that watches `qrDesignEntry` (around line 114). The call to `qrApi.preview` currently patches only `foreground_color`. Replace the entire effect:

  ```ts
  useEffect(() => {
    if (!qrDesignEntry) return;
    let cancelled = false;
    setQrDesignPreviewLoading(true);
    qrApi
      .preview({
        content: qrDesignEntry.content,
        design: qrDesignOptions,
      })
      .then((blob) => {
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        setQrDesignPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setQrDesignPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      })
      .finally(() => {
        if (!cancelled) setQrDesignPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [qrDesignEntry, qrDesignOptions]);
  ```

- [ ] **Step 5: Update `handleGenerateQr` to accept full design options**

  Find (around line 289):

  ```ts
  const handleGenerateQr = async (entryId: string, fgColor?: string): Promise<boolean> => {
    try {
      await generateQr({
        entryId,
        payload: fgColor ? { fg_color: fgColor } : undefined,
      });
  ```

  Replace with:

  ```ts
  const handleGenerateQr = async (entryId: string, design?: QrDesignOptions): Promise<boolean> => {
    try {
      await generateQr({
        entryId,
        payload: design
          ? {
              fg_color: design.foreground_color,
              bg_color: design.background_color,
              error_correction: design.error_correction,
            }
          : undefined,
      });
  ```

- [ ] **Step 6: Update modal body and save action**

  Find the Generate QR modal (around line 525). Replace the hand-rolled color picker `<div className="space-y-4">` block content:

  ```tsx
  <Modal
    isOpen={Boolean(qrDesignEntry)}
    onClose={closeQrDesignModal}
    title="Generate QR Code"
    description="Customize the QR design and preview before saving."
    size="md"
    footer={(
      <>
        <Button variant="outline" onClick={closeQrDesignModal}>
          Cancel
        </Button>
        <Button
          onClick={async () => {
            if (!qrDesignEntry) return;
            const success = await handleGenerateQr(qrDesignEntry.id, qrDesignOptions);
            if (success) closeQrDesignModal();
          }}
          loading={isGeneratingQr}
          disabled={qrDesignPreviewLoading || !qrDesignPreviewUrl}
        >
          Save
        </Button>
      </>
    )}
  >
    <div className="space-y-4">
      <QrDesignOptionsForm value={qrDesignOptions} onChange={setQrDesignOptions} />
      <div className="flex items-center justify-center min-h-52 rounded-lg border border-gray-200 bg-gray-50">
        {qrDesignPreviewLoading && <p className="text-sm text-gray-500">Generating preview…</p>}
        {!qrDesignPreviewLoading && qrDesignPreviewUrl && (
          <img src={qrDesignPreviewUrl} alt="QR color preview" className="max-w-full rounded-lg border border-gray-200 bg-white" />
        )}
        {!qrDesignPreviewLoading && !qrDesignPreviewUrl && (
          <p className="text-sm text-red-500">Preview unavailable. Please adjust settings and try again.</p>
        )}
      </div>
    </div>
  </Modal>
  ```

- [ ] **Step 7: Remove now-unused `qrDesignColor` references**

  Also remove the `STANDARD_QR_FOREGROUND_COLOR` import if it's no longer used elsewhere in `ProjectDetail.tsx`. Check by searching for remaining usages:

  After the changes above, `STANDARD_QR_FOREGROUND_COLOR` is still used to initialize `qrDesignOptions` state, so keep it. Remove any remaining `qrDesignColor` variable references if any were missed.

- [ ] **Step 8: Commit**

  ```bash
  git add frontend/src/pages/ProjectDetail.tsx
  git commit -m "feat: expand QR design modal to full design options (fg, bg, error correction)"
  ```

---

## Task 3a: Add POST export/data endpoint on backend

**Files:**
- Modify: `backend/app/api/routes/import_export.py`

- [ ] **Step 1: Add the Pydantic request model**

  Add after the existing `ImportConfirmRequest` class (around line 27):

  ```python
  class ExportDataRequest(BaseModel):
      format: str = "csv"
      entry_ids: list[int] | None = None
  ```

- [ ] **Step 2: Add the POST endpoint**

  Add after the existing `GET /projects/{project_id}/export/data` endpoint (after line 189):

  ```python
  @router.post("/projects/{project_id}/export/data")
  async def export_data_selected(
      project_id: int,
      payload: ExportDataRequest,
      session: AsyncSession = Depends(get_session),
  ) -> Response:
      """Export selected entries as CSV or XLSX. Filters by entry_ids when provided."""
      project = await session.get(Project, project_id)
      if not project:
          raise HTTPException(status_code=404, detail="Project not found")

      stmt = select(Entry).where(Entry.project_id == project_id)
      if payload.entry_ids:
          stmt = stmt.where(Entry.id.in_(payload.entry_ids))
      stmt = stmt.order_by(Entry.created_at)

      result = await session.execute(stmt)
      entries = result.scalars().all()

      entry_dicts = [
          {
              "id": e.id,
              "project_id": e.project_id,
              "content_type": e.content_type,
              "content_data": e.content_data,
              "label": e.label,
              "status": e.status,
              "serial_number": e.serial_number,
              "tags": e.tags,
              "created_at": str(e.created_at),
              "updated_at": str(e.updated_at),
          }
          for e in entries
      ]

      if payload.format.lower() == "xlsx":
          data = export_entries_xlsx(entry_dicts)
          return Response(
              content=data,
              media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              headers={
                  "Content-Disposition": f'attachment; filename="project_{project_id}_entries.xlsx"'
              },
          )
      else:
          data = export_entries_csv(entry_dicts)
          return Response(
              content=data,
              media_type="text/csv",
              headers={
                  "Content-Disposition": f'attachment; filename="project_{project_id}_entries.csv"'
              },
          )
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add backend/app/api/routes/import_export.py
  git commit -m "feat: add POST export/data endpoint with optional entry_ids filter"
  ```

---

## Task 3b: Update frontend API client for selected export

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Update `exportData` to accept optional `entryIds`**

  Find (around line 525):

  ```ts
  exportData: async (
    projectId: string,
    format: 'csv' | 'xlsx'
  ): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(
      `/projects/${projectId}/export/data`,
      { params: { format }, responseType: 'blob' }
    );
    return data;
  },
  ```

  Replace with:

  ```ts
  exportData: async (
    projectId: string,
    format: 'csv' | 'xlsx',
    entryIds?: string[]
  ): Promise<Blob> => {
    if (entryIds && entryIds.length > 0) {
      const normalizedIds = entryIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);
      const { data } = await apiClient.post<Blob>(
        `/projects/${projectId}/export/data`,
        { format, entry_ids: normalizedIds },
        { responseType: 'blob' }
      );
      return data;
    }
    const { data } = await apiClient.get<Blob>(
      `/projects/${projectId}/export/data`,
      { params: { format }, responseType: 'blob' }
    );
    return data;
  },
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/src/lib/api.ts
  git commit -m "feat: update exportData API to POST with entry_ids for selected export"
  ```

---

## Task 3c: Add export actions to BulkActions bar

**Files:**
- Modify: `frontend/src/components/entries/BulkActions.tsx`

- [ ] **Step 1: Add `onExportData` prop and rename ZIP button label**

  Replace the entire file content:

  ```tsx
  import { useState } from 'react';
  import { clsx } from 'clsx';
  import { Tag, Trash2, CheckCircle, X, QrCode, Download, FileDown } from 'lucide-react';
  import { Button } from '@/components/ui';
  import type { EntryStatus } from '@/types';

  interface BulkActionsProps {
    selectedCount: number;
    onClearSelection: () => void;
    onChangeStatus: (status: EntryStatus) => void;
    onDownloadZip?: () => void;
    onExportData?: (format: 'csv' | 'xlsx') => void;
    onDelete: () => void;
    onGenerateQr?: () => void;
    loading?: boolean;
  }

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'generated', label: 'Generated' },
    { value: 'printed', label: 'Printed' },
    { value: 'archived', label: 'Archived' },
  ];

  export function BulkActions({
    selectedCount,
    onClearSelection,
    onChangeStatus,
    onDownloadZip,
    onExportData,
    onDelete,
    onGenerateQr,
    loading,
  }: BulkActionsProps) {
    const [status, setStatus] = useState<EntryStatus>('generated');

    if (selectedCount === 0) return null;

    return (
      <div
        className={clsx(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
          'flex items-center gap-3 px-4 py-3 rounded-2xl',
          'bg-gray-900 text-white shadow-2xl shadow-gray-900/40',
          'border border-gray-700'
        )}
      >
        {/* Count + deselect */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-indigo-500 rounded-lg px-2.5 py-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="text-sm font-semibold">{selectedCount}</span>
          </div>
          <span className="text-sm text-gray-300">selected</span>
          <button
            onClick={onClearSelection}
            className="ml-1 p-0.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Change status */}
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as EntryStatus)}
            className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onChangeStatus(status)}
            loading={loading}
            className="bg-gray-700 text-white hover:bg-gray-600 border-0"
          >
            <Tag className="w-3.5 h-3.5 mr-1" />
            Set status
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {onGenerateQr && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={onGenerateQr}
              loading={loading}
              className="bg-indigo-600 text-white hover:bg-indigo-500 border-0"
              leftIcon={<QrCode className="w-3.5 h-3.5" />}
            >
              Generate QR
            </Button>
            <div className="w-px h-6 bg-gray-700" />
          </>
        )}

        {onDownloadZip && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={onDownloadZip}
              loading={loading}
              className="bg-gray-700 text-white hover:bg-gray-600 border-0"
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export QR Codes
            </Button>
            <div className="w-px h-6 bg-gray-700" />
          </>
        )}

        {onExportData && (
          <>
            <div className="relative group">
              <Button
                size="sm"
                variant="secondary"
                className="bg-gray-700 text-white hover:bg-gray-600 border-0"
                leftIcon={<FileDown className="w-3.5 h-3.5" />}
              >
                Export Data
              </Button>
              <div className="absolute bottom-full mb-1 left-0 hidden group-hover:block z-50 w-36">
                <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-lg py-1">
                  <button
                    onClick={() => onExportData('csv')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => onExportData('xlsx')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                  >
                    Export Excel
                  </button>
                </div>
              </div>
            </div>
            <div className="w-px h-6 bg-gray-700" />
          </>
        )}

        {/* Delete */}
        <Button
          size="sm"
          variant="danger"
          onClick={onDelete}
          loading={loading}
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
        >
          Delete
        </Button>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/src/components/entries/BulkActions.tsx
  git commit -m "feat: add Export Data dropdown and rename ZIP button in BulkActions"
  ```

---

## Task 3d: Wire export handlers in ProjectDetail

**Files:**
- Modify: `frontend/src/pages/ProjectDetail.tsx`

- [ ] **Step 1: Add `handleExportSelected` handler**

  Find the existing `handleExport` function (around line 207):

  ```ts
  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await importExportApi.exportData(id!, format);
      downloadBlob(blob, `${project.name}.${format}`);
    } catch {
      toast.error('Export failed');
    }
  };
  ```

  Add after it:

  ```ts
  const handleExportSelected = async (format: 'csv' | 'xlsx') => {
    if (selectedIds.size === 0) return;
    try {
      const blob = await importExportApi.exportData(id!, format, Array.from(selectedIds));
      downloadBlob(blob, `${project.name}-selected.${format}`);
      toast.success(`Exported ${selectedIds.size} entries`);
    } catch {
      toast.error('Export failed');
    }
  };
  ```

- [ ] **Step 2: Pass `onExportData` to `BulkActions`**

  Find the `<BulkActions>` block (around line 492). Add the prop:

  ```tsx
  <BulkActions
    selectedCount={selectedIds.size}
    onClearSelection={() => setSelectedIds(new Set())}
    onChangeStatus={handleBulkStatus}
    onDownloadZip={handleDownloadSelectedZip}
    onExportData={handleExportSelected}
    onDelete={() => setBulkDeleteConfirmOpen(true)}
    onGenerateQr={handleBulkGenerateQr}
    loading={isBulkStatusLoading || isBulkDeleting || isGeneratingQr}
  />
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/pages/ProjectDetail.tsx
  git commit -m "feat: wire selected entry export into BulkActions bar"
  ```

---

## Self-Review

- **Issue 1 coverage:** `useUpdateEntry` wired ✓, `editEntry` state ✓, `handleUpdateEntry` ✓, `onEdit` prop on `EntryTable` ✓, edit modal instance ✓
- **Issue 2 coverage:** `qrDesignOptions` state ✓, `openQrDesignModal` init ✓, preview `useEffect` updated ✓, `handleGenerateQr` signature updated ✓, modal body uses `QrDesignOptionsForm` ✓
- **Issue 3 coverage:** Backend POST endpoint ✓, `exportData` API updated ✓, `BulkActions` has Export Data dropdown ✓, `handleExportSelected` in `ProjectDetail` ✓
- **Placeholder scan:** All steps contain full code. No TBDs.
- **Type consistency:** `QrDesignOptions` used consistently. `handleGenerateQr` updated at call site in Task 2 step 6. `updateEntry` mutation signature is `{ id: string; payload: UpdateEntry }` — `handleUpdateEntry` passes `{ id: editEntry.id, payload }` which matches.
- **`UpdateEntry` type check:** `CreateEntry` (`content_type: ContentType`, `content: QrContentData`, optional label/tags) is structurally assignable to `UpdateEntry` (all same fields as optional). No cast needed.
