import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus, Upload, Download, QrCode, FileDown,
} from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, Modal, ConfirmModal, Input } from '@/components/ui';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { EntryTable } from '@/components/entries/EntryTable';
import { EntryFiltersBar } from '@/components/entries/EntryFilters';
import { BulkActions } from '@/components/entries/BulkActions';
import { ImportModal } from '@/components/entries/ImportModal';
import { QrTypeSelector } from '@/components/qr/QrTypeSelector';
import { QrContentForm } from '@/components/qr/QrContentForm';
import { useProject, projectKeys } from '@/hooks/useProjects';
import { useEntries, useDeleteEntry, useBulkStatus, useUpdateEntry, entryKeys } from '@/hooks/useEntries';
import { useToastContext } from '@/components/ui/Toast';
import { importExportApi, downloadBlob } from '@/lib/api';
import type { EntryFilters, Entry, ContentType, QrContentData } from '@/types';

function createDefaultContent(type: ContentType): QrContentData {
  switch (type) {
    case 'url':
      return { type: 'url', url: 'https://example.com' };
    case 'text':
      return { type: 'text', text: 'Sample text' };
    case 'vcard':
      return { type: 'vcard', first_name: 'John', last_name: 'Doe' };
    case 'wifi':
      return { type: 'wifi', ssid: 'MyWifi', encryption: 'WPA', hidden: false };
  }
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToastContext();

  // Filters & pagination
  const [filters, setFilters] = useState<EntryFilters>({
    page: 1,
    per_page: 20,
    sort_by: 'created_at',
    sort_order: 'desc',
  });

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [importOpen, setImportOpen] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editContentType, setEditContentType] = useState<ContentType>('text');
  const [editContent, setEditContent] = useState<QrContentData>(createDefaultContent('text'));

  const { data: project, isLoading: projectLoading } = useProject(id!);
  const { data: entriesData, isLoading: entriesLoading } = useEntries(id!, filters);
  const { mutateAsync: deleteEntry, isPending: isDeleting } = useDeleteEntry(id!);
  const { mutateAsync: bulkStatus, isPending: isBulkLoading } = useBulkStatus(id!);
  const { mutateAsync: updateEntry, isPending: isUpdating } = useUpdateEntry(id!);

  const entries = entriesData?.items ?? [];
  const total = entriesData?.total ?? 0;

  if (projectLoading) return <PageLoader />;
  if (!project) return <div className="p-8 text-gray-500">Project not found.</div>;

  const handleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  const handleSelectRow = (entryId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const handleBulkStatus = async (status: import('@/types').EntryStatus) => {
    try {
      await bulkStatus({ ids: Array.from(selectedIds), status });
      toast.success(`Updated ${selectedIds.size} entries to "${status}"`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntryId) return;
    try {
      await deleteEntry(deleteEntryId);
      toast.success('Entry deleted');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteEntryId);
        return next;
      });
    } catch {
      toast.error('Failed to delete entry');
    } finally {
      setDeleteEntryId(null);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await importExportApi.exportData(id!, format);
      downloadBlob(blob, `${project.name}.${format}`);
    } catch {
      toast.error('Export failed');
    }
  };

  const handleOpenEditEntry = (entry: Entry) => {
    setEditingEntry(entry);
    setEditLabel(entry.label ?? '');
    setEditContentType(entry.content_type);
    setEditContent(entry.content);
  };

  const handleSaveEntry = async () => {
    if (!editingEntry) return;
    try {
      await updateEntry({
        id: editingEntry.id,
        payload: {
          label: editLabel.trim() || undefined,
          content_type: editContentType,
          content: editContent,
        },
      });
      toast.success('Entry updated');
      setEditingEntry(null);
    } catch {
      toast.error('Failed to update entry');
    }
  };

  return (
    <div>
      <PageHeader
        title={project.name}
        description={project.description}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => setImportOpen(true)}
            >
              Import
            </Button>
            <div className="relative group">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
              >
                Export
              </Button>
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg py-1 hidden group-hover:block z-20">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => handleExport('xlsx')}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Export Excel
                </button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<QrCode className="w-4 h-4" />}
              onClick={() => navigate(`/projects/${id}/generate`)}
            >
              Generate PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileDown className="w-4 h-4" />}
              onClick={() => navigate(`/projects/${id}/pdfs`)}
            >
              PDF History
            </Button>
            <Button
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => navigate(`/projects/${id}/generate`)}
            >
              Add & Generate
            </Button>
          </div>
        }
      />

      {/* Stats strip */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-6 mb-6 text-sm text-gray-500">
        <span>
          <strong className="text-gray-900">{project.entry_count}</strong> entries
        </span>
        <span>
          <strong className="text-gray-900">{project.generated_count}</strong> QR codes generated
        </span>
        <span>
          {project.tags.map((tag) => (
            <span key={tag} className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full mr-1">
              {tag}
            </span>
          ))}
        </span>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <EntryFiltersBar filters={filters} onChange={setFilters} />
      </Card>

      {/* Entries table */}
      <EntryTable
        entries={entries}
        total={total}
        loading={entriesLoading}
        filters={filters}
        onFiltersChange={setFilters}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onEdit={handleOpenEditEntry}
        onDelete={(entry) => setDeleteEntryId(entry.id)}
      />

      {/* Bulk actions floating bar */}
      <BulkActions
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onChangeStatus={handleBulkStatus}
        onDelete={() => {
          /* handle bulk delete */
          toast.info(`Delete ${selectedIds.size} entries — not yet implemented`);
        }}
        loading={isBulkLoading}
      />

      {/* Import modal */}
      <ImportModal
        projectId={id!}
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={async (count) => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: entryKeys.all(id!) }),
            queryClient.invalidateQueries({ queryKey: projectKeys.detail(id!) }),
          ]);
          toast.success(`Imported ${count} entries successfully`);
          setImportOpen(false);
        }}
      />

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteEntryId}
        onClose={() => setDeleteEntryId(null)}
        onConfirm={handleDeleteEntry}
        title="Delete Entry"
        message="This entry and its QR code will be permanently deleted."
        confirmLabel="Delete"
        loading={isDeleting}
      />

      <Modal
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        title="Edit entry"
        description="Update entry details."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingEntry(null)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={handleSaveEntry} loading={isUpdating}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Label"
            value={editLabel}
            onChange={(event) => setEditLabel(event.target.value)}
            placeholder="Entry label"
          />
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Type</p>
            <QrTypeSelector
              value={editContentType}
              onChange={(type) => {
                setEditContentType(type);
                setEditContent(createDefaultContent(type));
              }}
            />
          </div>
          <QrContentForm
            contentType={editContentType}
            value={editContent}
            onChange={setEditContent}
          />
        </div>
      </Modal>
    </div>
  );
}
