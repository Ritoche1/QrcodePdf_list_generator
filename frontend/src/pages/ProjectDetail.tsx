import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus, Download, FileDown, QrCode, RefreshCw, Settings2
} from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, Modal, ConfirmModal } from '@/components/ui';
import { Input, Textarea } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { EntryTable } from '@/components/entries/EntryTable';
import { EntryFiltersBar } from '@/components/entries/EntryFilters';
import { BulkActions } from '@/components/entries/BulkActions';
import { EntryEditorModal } from '@/components/entries/EntryEditorModal';
import { ImportModal } from '@/components/entries/ImportModal';
import { useProject, projectKeys, useUpdateProject } from '@/hooks/useProjects';
import { useEntries, useDeleteEntry, useBulkDelete, useBulkStatus, useCreateEntry, entryKeys } from '@/hooks/useEntries';
import { useToastContext } from '@/components/ui/Toast';
import { importExportApi, downloadBlob } from '@/lib/api';
import type { CreateEntry } from '@/types';
import type { EntryFilters } from '@/types';
import type { ErrorCorrectionLevel } from '@/types';

interface ProjectSettingsForm {
  name: string;
  description: string;
  default_qr_foreground_color: string;
  default_qr_background_color: string;
  default_qr_error_correction: ErrorCorrectionLevel;
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
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<ProjectSettingsForm>({
    name: '',
    description: '',
    default_qr_foreground_color: '#000000',
    default_qr_background_color: '#ffffff',
    default_qr_error_correction: 'M',
  });

  const { data: project, isLoading: projectLoading } = useProject(id!);
  const { data: entriesData, isLoading: entriesLoading } = useEntries(id!, filters);
  const { mutateAsync: updateProject, isPending: isUpdatingProject } = useUpdateProject(id!);
  const { mutateAsync: deleteEntry, isPending: isDeleting } = useDeleteEntry(id!);
  const { mutateAsync: bulkStatus, isPending: isBulkStatusLoading } = useBulkStatus(id!);
  const { mutateAsync: bulkDelete, isPending: isBulkDeleting } = useBulkDelete(id!);
  const { mutateAsync: createEntry, isPending: isCreatingEntry } = useCreateEntry(id!);

  const entries = entriesData?.items ?? [];
  const total = entriesData?.total ?? 0;

  useEffect(() => {
    if (!settingsOpen || !project) return;
    setSettingsForm({
      name: project.name,
      description: project.description ?? '',
      default_qr_foreground_color: project.default_qr_foreground_color,
      default_qr_background_color: project.default_qr_background_color,
      default_qr_error_correction: project.default_qr_error_correction,
    });
  }, [project, settingsOpen]);

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

  const handleBulkDelete = async () => {
    try {
      const result = await bulkDelete(Array.from(selectedIds));
      toast.success(`Deleted ${result.deleted} entries`);
      setSelectedIds(new Set());
      setBulkDeleteConfirmOpen(false);
    } catch {
      toast.error('Failed to delete entries');
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

  const handleCreateEntry = async (payload: CreateEntry) => {
    try {
      await createEntry(payload);
      await queryClient.invalidateQueries({ queryKey: projectKeys.detail(id!) });
      toast.success('Entry added');
      setManualEntryOpen(false);
    } catch {
      toast.error('Failed to add entry');
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsForm.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      await updateProject({
        name: settingsForm.name.trim(),
        description: settingsForm.description.trim() || null,
        default_qr_foreground_color: settingsForm.default_qr_foreground_color,
        default_qr_background_color: settingsForm.default_qr_background_color,
        default_qr_error_correction: settingsForm.default_qr_error_correction,
      });
      toast.success('Project settings updated');
      setSettingsOpen(false);
    } catch {
      toast.error('Failed to update project settings');
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
              leftIcon={<RefreshCw className={`w-4 h-4 ${entriesLoading || projectLoading ? 'animate-spin' : ''}`} />}
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: projectKeys.detail(id!) });
                queryClient.invalidateQueries({ queryKey: entryKeys.all(id!) });
              }}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Settings2 className="w-4 h-4" />}
              onClick={() => setSettingsOpen(true)}
            >
              Settings
            </Button>
            <div className="relative group">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add
              </Button>
              <div className="absolute right-0 top-full pt-1 hidden group-hover:block z-20 w-36">
                <div className="bg-white border border-gray-200 rounded-xl shadow-lg py-1">
                  <button
                    onClick={() => setImportOpen(true)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Import
                  </button>
                  <button
                    onClick={() => setManualEntryOpen(true)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Add Entry
                  </button>
                </div>
              </div>
            </div>
            <div className="relative group">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
              >
                Export
              </Button>
              <div className="absolute right-0 top-full pt-1 hidden group-hover:block z-20 w-36">
                <div className="bg-white border border-gray-200 rounded-xl shadow-lg py-1">
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
            </div>
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
              leftIcon={<QrCode className="w-4 h-4" />}
              onClick={() => navigate(`/projects/${id}/generate`)}
            >
              Generate
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
        onDelete={(entry) => setDeleteEntryId(entry.id)}
      />

      {/* Bulk actions floating bar */}
      <BulkActions
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onChangeStatus={handleBulkStatus}
        onDelete={() => setBulkDeleteConfirmOpen(true)}
        loading={isBulkStatusLoading || isBulkDeleting}
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

      <EntryEditorModal
        isOpen={manualEntryOpen}
        mode="create"
        loading={isCreatingEntry}
        onClose={() => setManualEntryOpen(false)}
        onSubmit={handleCreateEntry}
      />

      <Modal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Project Settings"
        description="Manage basic project details and default QR design options."
        size="xl"
        footer={(
          <>
            <Button variant="outline" onClick={() => setSettingsOpen(false)} disabled={isUpdatingProject}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} loading={isUpdatingProject}>
              Save Settings
            </Button>
          </>
        )}
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Basic settings</h3>
            <Input
              label="Project name"
              value={settingsForm.name}
              onChange={(event) => setSettingsForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Project name"
            />
            <Textarea
              label="Description"
              value={settingsForm.description}
              onChange={(event) => setSettingsForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={3}
              placeholder="Optional description"
            />
          </div>
          <div className="space-y-3 border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-800">Default QR design</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Foreground Color
                </label>
                <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-2 bg-white">
                  <input
                    type="color"
                    value={settingsForm.default_qr_foreground_color}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSettingsForm((prev) => ({ ...prev, default_qr_foreground_color: value }));
                    }}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <span className="text-sm font-mono text-gray-600">{settingsForm.default_qr_foreground_color}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Background Color
                </label>
                <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-2 bg-white">
                  <input
                    type="color"
                    value={settingsForm.default_qr_background_color}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSettingsForm((prev) => ({ ...prev, default_qr_background_color: value }));
                    }}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <span className="text-sm font-mono text-gray-600">{settingsForm.default_qr_background_color}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Error Correction Level
              </label>
              <select
                value={settingsForm.default_qr_error_correction}
                onChange={(event) => {
                  const value = event.target.value as ErrorCorrectionLevel;
                  setSettingsForm((prev) => ({ ...prev, default_qr_error_correction: value }));
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="L">Low (7%)</option>
                <option value="M">Medium (15%)</option>
                <option value="Q">Quartile (25%)</option>
                <option value="H">High (30%)</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

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

      {/* Bulk Delete confirm */}
      <ConfirmModal
        isOpen={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Multiple Entries"
        message={`Are you sure you want to delete ${selectedIds.size} entries? This action cannot be undone.`}
        confirmLabel="Delete All"
        loading={isBulkDeleting}
      />
    </div>
  );
}
