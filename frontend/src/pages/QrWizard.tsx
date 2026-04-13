import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, ConfirmModal, Input } from '@/components/ui';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { QrTypeSelector } from '@/components/qr/QrTypeSelector';
import { QrContentForm } from '@/components/qr/QrContentForm';
import { QrDesignOptionsForm } from '@/components/qr/QrDesignOptions';
import { QrPreview } from '@/components/qr/QrPreview';
import { PdfLayoutOptionsForm } from '@/components/pdf/PdfLayoutOptions';
import { PdfPreview } from '@/components/pdf/PdfPreview';
import { EntryFiltersBar } from '@/components/entries/EntryFilters';
import { EntryTable } from '@/components/entries/EntryTable';
import { EntryEditorModal } from '@/components/entries/EntryEditorModal';
import { useProject } from '@/hooks/useProjects';
import { useEntries, useCreateEntry, useDeleteEntry, useUpdateEntry } from '@/hooks/useEntries';
import { useToastContext } from '@/components/ui/Toast';
import { pdfApi, downloadBlob } from '@/lib/api';
import type {
  ContentType, CreateEntry, Entry, EntryFilters, PdfLayoutOptions, QrContentData, QrDesignOptions, UpdateEntry,
} from '@/types';

type WizardStep = 'select' | 'design' | 'layout' | 'download';

const WIZARD_STEPS: { key: WizardStep; label: string; description: string }[] = [
  { key: 'select', label: 'Select Entries', description: 'Choose which entries to include' },
  { key: 'design', label: 'Design QR', description: 'Customize QR code appearance' },
  { key: 'layout', label: 'PDF Layout', description: 'Configure page layout' },
  { key: 'download', label: 'Download', description: 'Preview and download' },
];

const defaultDesign: QrDesignOptions = {
  foreground_color: '#000000',
  background_color: '#ffffff',
  error_correction: 'M',
  size: 200,
};

const defaultPdfLayout: PdfLayoutOptions = {
  page_size: 'A4',
  margin_top: 15,
  margin_bottom: 15,
  margin_left: 15,
  margin_right: 15,
  columns: 4,
  rows: 5,
  qr_size: 40,
  spacing: 5,
  show_labels: true,
  font_size: 8,
};
const MAX_GENERATED_PDFS = 10;

interface GeneratedPdfItem {
  id: string;
  blob: Blob;
  previewUrl: string;
  fileName: string;
  createdAt: string;
}

function normalizePdfFileName(value: string, fallback: string): string {
  const trimmed = value.trim();
  const safe = trimmed === '' ? fallback : trimmed;
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

function generatePdfId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-0 mb-8">
      {WIZARD_STEPS.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center min-w-0 flex-1">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  isCompleted
                    ? 'bg-indigo-500 text-white'
                    : isCurrent
                    ? 'bg-indigo-500 text-white ring-4 ring-indigo-100'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <div className="mt-1.5 text-center">
                <p
                  className={clsx(
                    'text-xs font-semibold',
                    isCurrent ? 'text-indigo-700' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                  )}
                >
                  {step.label}
                </p>
              </div>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={clsx(
                  'h-0.5 flex-1 mx-2 mb-5 transition-colors',
                  isCompleted ? 'bg-indigo-500' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function QrWizardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();

  const [step, setStep] = useState<WizardStep>('select');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<EntryFilters>({ page: 1, per_page: 20 });
  const [design, setDesign] = useState<QrDesignOptions>(defaultDesign);
  const [pdfLayout, setPdfLayout] = useState<PdfLayoutOptions>(defaultPdfLayout);
  const [downloading, setDownloading] = useState(false);
  const [customPdfName, setCustomPdfName] = useState('');
  const [generatedPdfs, setGeneratedPdfs] = useState<GeneratedPdfItem[]>([]);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [isEntryEditorOpen, setIsEntryEditorOpen] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const generatedPdfUrlsRef = useRef<string[]>([]);
  const hasCustomizedPdfNameRef = useRef(false);
  const lastProjectIdRef = useRef<string | null>(null);

  // For design preview
  const [previewContentType, setPreviewContentType] = useState<ContentType>('url');
  const [previewContent, setPreviewContent] = useState<QrContentData>({ type: 'url', url: '' });

  const { data: project, isLoading: projectLoading } = useProject(id!);
  const { data: entriesData, isLoading: entriesLoading } = useEntries(id!, filters);
  const { mutateAsync: createEntry, isPending: isCreatingEntry } = useCreateEntry(id!);
  const { mutateAsync: updateEntry, isPending: isUpdatingEntry } = useUpdateEntry(id!);
  const { mutateAsync: deleteEntry, isPending: isDeletingEntry } = useDeleteEntry(id!);

  const entries = entriesData?.items ?? [];
  const total = entriesData?.total ?? 0;
  const isSavingEntry = isCreatingEntry || isUpdatingEntry;

  const layoutWithEntries = useMemo(
    () => ({
      ...pdfLayout,
      entry_ids: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
    }),
    [pdfLayout, selectedIds]
  );

  const defaultPdfName = `${project?.name ?? 'qr-codes'}-qr.pdf`;

  const goNext = () => {
    const idx = WIZARD_STEPS.findIndex((s) => s.key === step);
    if (idx < WIZARD_STEPS.length - 1) setStep(WIZARD_STEPS[idx + 1].key);
  };

  const goBack = () => {
    const idx = WIZARD_STEPS.findIndex((s) => s.key === step);
    if (idx > 0) setStep(WIZARD_STEPS[idx - 1].key);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === entries.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(entries.map((e) => e.id)));
  };

  const handleGeneratePdf = async () => {
    if (!project) return;
    setDownloading(true);
    try {
      const blob = await pdfApi.generate(id!, layoutWithEntries, design);
      const generatedName = normalizePdfFileName(customPdfName, defaultPdfName);
      const previewUrl = URL.createObjectURL(blob);
      generatedPdfUrlsRef.current.push(previewUrl);
      const generatedPdf = {
        id: generatePdfId(),
        blob,
        previewUrl,
        fileName: generatedName,
        createdAt: new Date().toISOString(),
      };
      setGeneratedPdfs((prev) => {
        const next = [generatedPdf, ...prev];
        if (next.length <= MAX_GENERATED_PDFS) return next;
        const removed = next.slice(MAX_GENERATED_PDFS);
        removed.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        generatedPdfUrlsRef.current = generatedPdfUrlsRef.current.filter(
          (url) => !removed.some((item) => item.previewUrl === url)
        );
        return next.slice(0, MAX_GENERATED_PDFS);
      });
      setActivePreviewId(generatedPdf.id);
      toast.success('PDF generated. Preview and download it below.');
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadGeneratedPdf = (item: GeneratedPdfItem) => {
    downloadBlob(item.blob, normalizePdfFileName(item.fileName, defaultPdfName));
    toast.success('PDF downloaded successfully');
  };

  const activePdfPreview =
    generatedPdfs.find((item) => item.id === activePreviewId) ?? generatedPdfs[0] ?? null;

  const handleSaveEntry = async (payload: CreateEntry | UpdateEntry) => {
    try {
      if (editingEntry) {
        await updateEntry({ id: editingEntry.id, payload });
        toast.success('Entry updated');
      } else {
        await createEntry(payload as CreateEntry);
        toast.success('Entry added');
      }
      setIsEntryEditorOpen(false);
      setEditingEntry(null);
    } catch {
      toast.error(editingEntry ? 'Failed to update entry' : 'Failed to add entry');
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntryId) return;
    try {
      await deleteEntry(deleteEntryId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteEntryId);
        return next;
      });
      toast.success('Entry deleted');
      setDeleteEntryId(null);
    } catch {
      toast.error('Failed to delete entry');
    }
  };

  useEffect(() => {
    if (!project) return;
    if (lastProjectIdRef.current !== project.id) {
      lastProjectIdRef.current = project.id;
      hasCustomizedPdfNameRef.current = false;
    }
    if (hasCustomizedPdfNameRef.current) return;
    setCustomPdfName(`${project.name}-qr.pdf`);
  }, [project]);

  useEffect(() => () => {
    generatedPdfUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  if (projectLoading) return <PageLoader />;
  if (!project) return <div className="p-8 text-gray-500">Project not found.</div>;

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === step);
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  return (
    <div>
      <PageHeader
        title="Generate QR PDF"
        description={project.name}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.name, href: `/projects/${id}` },
          { label: 'Generate PDF' },
        ]}
      />

      <StepIndicator currentStep={step} />

      {/* ─── Step: Select Entries ─────────────────────────────────────────── */}
      {step === 'select' && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                {selectedIds.size === 0
                  ? 'Select entries to include, or leave none to include all.'
                  : `${selectedIds.size} ${selectedIds.size === 1 ? 'entry' : 'entries'} selected`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    setEditingEntry(null);
                    setIsEntryEditorOpen(true);
                  }}
                >
                  Add entry
                </Button>
                {selectedIds.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear selection
                  </Button>
                )}
              </div>
            </div>
            <EntryFiltersBar filters={filters} onChange={setFilters} />
          </Card>
          <EntryTable
            entries={entries}
            total={total}
            loading={entriesLoading}
            filters={filters}
            onFiltersChange={setFilters}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
              onSelectRow={(entryId) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(entryId)) next.delete(entryId);
                  else next.add(entryId);
                  return next;
                });
              }}
              onEdit={(entry) => {
                setEditingEntry(entry);
                setIsEntryEditorOpen(true);
              }}
              onDelete={(entry) => setDeleteEntryId(entry.id)}
            />
          </div>
        )}

      {/* ─── Step: Design QR ─────────────────────────────────────────────── */}
      {step === 'design' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">QR Design Options</h3>
            <QrDesignOptionsForm value={design} onChange={setDesign} />
            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="text-sm font-medium text-gray-700 mb-3">Preview Content</p>
              <QrTypeSelector value={previewContentType} onChange={(t) => {
                setPreviewContentType(t);
                const defaults: Record<ContentType, QrContentData> = {
                  url: { type: 'url', url: 'https://example.com' },
                  text: { type: 'text', text: 'Sample text' },
                  vcard: { type: 'vcard', first_name: 'John', last_name: 'Doe' },
                  wifi: { type: 'wifi', ssid: 'MyWifi', encryption: 'WPA', hidden: false },
                };
                setPreviewContent(defaults[t]);
              }} />
            </div>
          </Card>
          <div className="flex flex-col gap-4">
            <QrPreview
              request={{ content: previewContent, design }}
              className="flex-1"
            />
          </div>
        </div>
      )}

      {/* ─── Step: PDF Layout ─────────────────────────────────────────────── */}
      {step === 'layout' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Layout Options</h3>
            <PdfLayoutOptionsForm value={pdfLayout} onChange={setPdfLayout} />
          </Card>
          <PdfPreview
            projectId={id!}
            options={layoutWithEntries}
            design={design}
            enabled
            className="lg:sticky lg:top-8"
          />
        </div>
      )}

      {/* ─── Step: Download ──────────────────────────────────────────────── */}
      {step === 'download' && (
        <div className="max-w-4xl mx-auto space-y-5">
          <Card>
            <div className="py-6">
              <div className="max-w-lg mx-auto text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Ready to Download</h3>
              <p className="text-sm text-gray-500 mb-6">
                Your PDF will contain{' '}
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'all'} entries
                arranged in a {pdfLayout.columns}×{pdfLayout.rows} grid.
              </p>

              <div className="grid grid-cols-2 gap-3 text-sm text-left mb-6">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Page: {pdfLayout.page_size}</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Grid: {pdfLayout.columns} × {pdfLayout.rows}</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>QR size: {pdfLayout.qr_size}mm</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Labels: {pdfLayout.show_labels ? 'On' : 'Off'}</span>
                </div>
              </div>

              <div className="mb-4 text-left">
                <Input
                  label="PDF filename"
                  value={customPdfName}
                  onChange={(event) => {
                    hasCustomizedPdfNameRef.current = true;
                    setCustomPdfName(event.target.value);
                  }}
                  placeholder={defaultPdfName}
                  hint="Used as the default name when generating and downloading PDFs."
                />
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={handleGeneratePdf}
                loading={downloading}
                leftIcon={
                  downloading ? undefined : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                  )
                }
              >
                {downloading ? 'Generating PDF…' : 'Generate PDF'}
              </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-800">
                  Generated PDFs ({generatedPdfs.length})
                </h4>
                {generatedPdfs.length === 0 && (
                  <p className="text-xs text-gray-500">Generate a PDF to see it listed here.</p>
                )}
              </div>

              {generatedPdfs.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {generatedPdfs.map((item) => (
                      <div
                        key={item.id}
                        className={clsx(
                          'rounded-lg border p-3',
                          activePdfPreview?.id === item.id
                            ? 'border-indigo-300 bg-indigo-50/40'
                            : 'border-gray-200 bg-white'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <button
                            type="button"
                            className="text-sm font-medium text-left text-indigo-700 hover:underline"
                            onClick={() => setActivePreviewId(item.id)}
                          >
                            Preview
                          </button>
                          <span className="text-xs text-gray-500">
                            {new Date(item.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <Input
                          value={item.fileName}
                          onChange={(event) => {
                            const value = event.target.value;
                            setGeneratedPdfs((prev) =>
                              prev.map((pdf) => (pdf.id === item.id ? { ...pdf, fileName: value } : pdf))
                            );
                          }}
                          placeholder={defaultPdfName}
                        />
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleDownloadGeneratedPdf(item)}
                          >
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 min-h-72">
                    {activePdfPreview ? (
                      <iframe
                        title="Generated PDF preview"
                        src={activePdfPreview.previewUrl}
                        className="w-full h-72 rounded border-0 bg-white"
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-gray-500">
                        Preview will appear here.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
        <Button
          variant="outline"
          onClick={stepIndex === 0 ? () => navigate(`/projects/${id}`) : goBack}
        >
          {stepIndex === 0 ? 'Back to Project' : '← Back'}
        </Button>
        {!isLastStep ? (
          <Button
            onClick={goNext}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            Continue
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => navigate(`/projects/${id}`)}
          >
            Back to project
          </Button>
        )}
      </div>

      <EntryEditorModal
        isOpen={isEntryEditorOpen}
        mode={editingEntry ? 'edit' : 'create'}
        initialEntry={editingEntry}
        loading={isSavingEntry}
        onClose={() => {
          if (isSavingEntry) return;
          setIsEntryEditorOpen(false);
          setEditingEntry(null);
        }}
        onSubmit={handleSaveEntry}
      />

      <ConfirmModal
        isOpen={!!deleteEntryId}
        onClose={() => setDeleteEntryId(null)}
        onConfirm={handleDeleteEntry}
        title="Delete entry"
        message="This entry will be permanently deleted."
        confirmLabel="Delete"
        loading={isDeletingEntry}
      />
    </div>
  );
}
