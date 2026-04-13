import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Check, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, LoadingSpinner } from '@/components/ui';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { QrTypeSelector } from '@/components/qr/QrTypeSelector';
import { QrContentForm } from '@/components/qr/QrContentForm';
import { QrDesignOptionsForm } from '@/components/qr/QrDesignOptions';
import { QrPreview } from '@/components/qr/QrPreview';
import { PdfLayoutOptionsForm } from '@/components/pdf/PdfLayoutOptions';
import { PdfPreview } from '@/components/pdf/PdfPreview';
import { EntryFiltersBar } from '@/components/entries/EntryFilters';
import { EntryTable } from '@/components/entries/EntryTable';
import { useProject } from '@/hooks/useProjects';
import { useEntries } from '@/hooks/useEntries';
import { useToastContext } from '@/components/ui/Toast';
import { pdfApi, downloadBlob } from '@/lib/api';
import type { ContentType, QrContentData, QrDesignOptions, PdfLayoutOptions, EntryFilters } from '@/types';

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

  // For design preview
  const [previewContentType, setPreviewContentType] = useState<ContentType>('url');
  const [previewContent, setPreviewContent] = useState<QrContentData>({ type: 'url', url: '' });

  const { data: project, isLoading: projectLoading } = useProject(id!);
  const { data: entriesData, isLoading: entriesLoading } = useEntries(id!, filters);

  const entries = entriesData?.items ?? [];
  const total = entriesData?.total ?? 0;

  const layoutWithEntries = useMemo(
    () => ({
      ...pdfLayout,
      entry_ids: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
    }),
    [pdfLayout, selectedIds]
  );

  if (projectLoading) return <PageLoader />;
  if (!project) return <div className="p-8 text-gray-500">Project not found.</div>;

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

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await pdfApi.generate(id!, layoutWithEntries);
      downloadBlob(blob, `${project.name}-qr.pdf`);
      toast.success('PDF downloaded successfully');
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

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
            enabled
            className="lg:sticky lg:top-8"
          />
        </div>
      )}

      {/* ─── Step: Download ──────────────────────────────────────────────── */}
      {step === 'download' && (
        <div className="max-w-lg mx-auto">
          <Card>
            <div className="text-center py-6">
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

              <Button
                size="lg"
                className="w-full"
                onClick={handleDownload}
                loading={downloading}
                leftIcon={
                  downloading ? undefined : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                  )
                }
              >
                {downloading ? 'Generating PDF…' : 'Download PDF'}
              </Button>
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
    </div>
  );
}
