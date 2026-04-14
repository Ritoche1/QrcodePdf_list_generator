import { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Modal, Button, FileUpload, Select, LoadingSpinner } from '@/components/ui';
import { importExportApi } from '@/lib/api';
import type { ImportPreviewResult } from '@/lib/api';

interface ImportModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

type Step = 'upload' | 'mapping' | 'done';

const FIELD_OPTIONS = [
  { value: '', label: '— Skip column —' },
  { value: 'content_type', label: 'Content Type' },
  { value: 'label', label: 'Label' },
  { value: 'url', label: 'URL (content)' },
  { value: 'text', label: 'Text (content)' },
  { value: 'first_name', label: 'First Name (vCard)' },
  { value: 'last_name', label: 'Last Name (vCard)' },
  { value: 'phone', label: 'Phone (vCard)' },
  { value: 'email', label: 'Email (vCard)' },
  { value: 'organization', label: 'Organization (vCard)' },
  { value: 'ssid', label: 'SSID (Wi-Fi)' },
  { value: 'password', label: 'Password (Wi-Fi)' },
  { value: 'tags', label: 'Tags' },
  { value: 'status', label: 'Status' },
];

export function ImportModal({ projectId, isOpen, onClose, onSuccess }: ImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [fileId, setFileId] = useState<string>('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setStep('upload');
    setPreview(null);
    setMapping({});
    setError(null);
    onClose();
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const result = await importExportApi.importPreview(projectId, file);
      setPreview(result);
      setMapping(result.suggested_mapping ?? {});
      // Simulated file_id from headers — backend should return it
      setFileId(`pending_${Date.now()}`);
      setStep('mapping');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to process file');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await importExportApi.importConfirm(projectId, {
        column_mapping: mapping,
        file_id: fileId,
      });
      setImportedCount(result.imported);
      setStep('done');
      onSuccess(result.imported);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Entries"
      description="Upload a CSV or Excel file to bulk-import entries"
      size="lg"
      footer={
        step === 'mapping' ? (
          <>
            <Button variant="outline" onClick={() => setStep('upload')} disabled={loading}>
              Back
            </Button>
            <Button variant="primary" onClick={handleConfirm} loading={loading}>
              Import entries
            </Button>
          </>
        ) : step === 'done' ? (
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        ) : null
      }
    >
      {step === 'upload' && (
        <div className="space-y-4">
          <FileUpload
            accept=".csv,.xlsx,.xls"
            maxSize={10 * 1024 * 1024}
            onFile={handleFile}
            label="Drop a CSV or Excel file here"
            hint="Supports .csv, .xlsx, .xls — max 10 MB"
          />
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4">
              <LoadingSpinner size="sm" className="text-indigo-500" />
              <span className="text-sm text-gray-500">Processing file…</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
      )}

      {step === 'mapping' && preview && (
        <div className="space-y-5">
          <div>
            <p className="text-sm text-gray-600 mb-1">
              Detected <strong>{preview.columns.length}</strong> columns. Map each column to a field:
            </p>
          </div>
          {/* Column mapping */}
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
            {preview.columns.map((col) => (
              <div key={col} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{col}</p>
                  {preview.sample_rows[0]?.[col] && (
                    <p className="text-xs text-gray-400 truncate">
                      e.g. {preview.sample_rows[0][col]}
                    </p>
                  )}
                </div>
                <div className="w-48 flex-shrink-0">
                  <Select
                    value={mapping[col] ?? ''}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [col]: e.target.value }))
                    }
                    options={FIELD_OPTIONS}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* Sample preview */}
          {preview.sample_rows.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Sample rows
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="text-xs w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {preview.columns.map((c) => (
                        <th key={c} className="px-3 py-2 text-left font-medium text-gray-500">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.sample_rows.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {preview.columns.map((c) => (
                          <td key={c} className="px-3 py-2 text-gray-600 truncate max-w-32">
                            {row[c] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-500" />
          <h3 className="text-base font-semibold text-gray-900">Import complete</h3>
          <p className="text-sm text-gray-500">
            Successfully imported <strong>{importedCount}</strong> entries.
          </p>
        </div>
      )}
    </Modal>
  );
}
